// === ImportPODialog.jsx — Importar Orden de Compra leída por IA (Jeani) ===
// Acepta imagen (jpg/png/webp), PDF o CSV. Usa /ai/invoke (vision) para
// extraer items, hace fuzzy-match contra el catálogo de productos, y crea
// la PurchaseOrder como borrador una vez que el usuario confirma.

import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Upload, FileText, Image as ImageIcon, Sparkles, CheckCircle2,
  AlertCircle, Loader2, Trash2, Plus, X, RefreshCw,
} from "lucide-react";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

// Normaliza texto para comparar: minúsculas, sin puntuación, sin dobles espacios.
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Score simple 0-1 por coincidencia de palabras + bonus si una incluye a la otra.
function matchScore(a, b) {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return 0.75 + ratio * 0.2;
  }
  const wa = new Set(na.split(" ").filter(Boolean));
  const wb = new Set(nb.split(" ").filter(Boolean));
  if (!wa.size || !wb.size) return 0;
  let hits = 0;
  for (const w of wa) if (wb.has(w)) hits++;
  return hits / Math.max(wa.size, wb.size);
}

function findBestProductMatch(rawName, products) {
  if (!rawName || !Array.isArray(products) || products.length === 0) return null;
  let best = null;
  let bestScore = 0;
  for (const p of products) {
    const candidates = [p.name, p.sku, p.barcode, p.description].filter(Boolean);
    for (const c of candidates) {
      const s = matchScore(rawName, c);
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
  }
  if (bestScore < 0.45) return null;
  return { product: best, score: bestScore };
}

// Parse muy básico de CSV en el cliente. Espera columnas con headers como
// "nombre/descripcion", "cantidad/qty", "precio/costo".
function parseCSV(text) {
  const lines = String(text || "").split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headerCells = lines[0].split(",").map((h) => norm(h));
  const idx = (labels) => headerCells.findIndex((h) => labels.some((l) => h.includes(l)));
  const nameIdx = idx(["nombre", "description", "descripcion", "producto", "item"]);
  const qtyIdx = idx(["cantidad", "qty", "cant"]);
  const priceIdx = idx(["precio", "costo", "cost", "unit", "price"]);
  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    if (!cells.length) continue;
    const raw_name = (cells[nameIdx] || cells[0] || "").trim();
    if (!raw_name) continue;
    const quantity = Number(String(cells[qtyIdx] || "1").replace(/[^0-9.]/g, "")) || 1;
    const unit_price = Number(String(cells[priceIdx] || "0").replace(/[^0-9.]/g, "")) || 0;
    items.push({ raw_name, quantity, unit_price, total: quantity * unit_price });
  }
  return items;
}

// Llama al LLM con visión para extraer la OC.
// Pedimos JSON en el prompt y lo parseamos en cliente: es más permisivo
// que los structured outputs y evita errores de schema strict.
async function extractWithAI(fileUrl) {
  const prompt = `Eres Jeani, asistente de SmartFixOS. Lee esta orden de compra / factura / proforma de proveedor y devuelve SOLO un objeto JSON válido (sin texto antes ni después, sin markdown, sin \`\`\`) con esta forma:

{
  "supplier_name": "string",
  "order_date": "YYYY-MM-DD",
  "currency": "USD",
  "subtotal": 0,
  "tax": 0,
  "shipping": 0,
  "total_amount": 0,
  "notes": "",
  "items": [
    { "raw_name": "nombre tal cual aparece", "sku": "", "quantity": 1, "unit_price": 0, "total": 0 }
  ]
}

Reglas:
- raw_name = nombre del producto tal cual aparece en la línea, completo.
- Si un valor no aparece, usa 0 para números y "" para strings. NO inventes datos.
- NO incluyas filas de subtotal/impuesto/envío/total dentro de items — van en sus campos.
- Si el archivo no es legible o no es una orden de compra, devuelve {"items": []}.
- Devuelve EXCLUSIVAMENTE el JSON. Nada más.`;

  let raw;
  try {
    raw = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [fileUrl],
    });
  } catch (err) {
    throw new Error(
      err?.message?.includes("LLM invocation failed")
        ? "Jeani no pudo procesar el archivo (servidor IA no disponible). Verifica que el OPENAI_API_KEY esté configurado en el servidor de funciones."
        : err?.message || "Falló la llamada a Jeani",
    );
  }

  // InvokeLLM puede devolver: string, {response: string}, o un objeto ya parseado
  let text = "";
  if (typeof raw === "string") text = raw;
  else if (raw?.response) text = raw.response;
  else if (raw?.data?.message) {
    if (typeof raw.data.message === "string") text = raw.data.message;
    else return raw.data.message;
  } else if (typeof raw === "object") {
    return raw;
  }

  // Limpiar markdown / fences si los hay
  text = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Buscar el primer { y el último }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Jeani devolvió texto pero no JSON válido. Prueba con otra foto más clara.");
  }
  const jsonText = text.slice(start, end + 1);
  try {
    return JSON.parse(jsonText);
  } catch (e) {
    throw new Error("No se pudo parsear el JSON de Jeani: " + e.message);
  }
}

export default function ImportPODialog({ open, onClose, suppliers = [], products = [] }) {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null); // { supplier_name, items: [...], ... }
  const [reviewRows, setReviewRows] = useState([]); // [{ raw_name, product_id, product_name, quantity, unit_cost, matchScore }]
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) {
      setFile(null);
      setFileUrl("");
      setExtracted(null);
      setReviewRows([]);
      setSupplierId("");
      setOrderDate(new Date().toISOString().slice(0, 10));
      setNotes("");
      setError("");
      setUploading(false);
      setExtracting(false);
      setSaving(false);
    }
  }, [open]);

  const acceptFile = (f) => {
    if (!f) return;
    const max = 15 * 1024 * 1024;
    if (f.size > max) {
      toast.error("Archivo demasiado grande (máx 15 MB)");
      return;
    }
    setFile(f);
    setError("");
    setExtracted(null);
    setReviewRows([]);
  };

  const handleFilePick = (e) => acceptFile(e.target.files?.[0]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragOver) setDragOver(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) acceptFile(f);
  };

  const isImage = file && /^image\//.test(file.type);
  const isPdf = file && (file.type === "application/pdf" || /\.pdf$/i.test(file.name));
  const isCsv = file && (/csv/i.test(file.type) || /\.csv$/i.test(file.name));
  const isExcel = file && /\.(xlsx|xls)$/i.test(file.name);

  const runExtraction = async () => {
    if (!file) return;
    setError("");
    setExtracting(true);
    try {
      // Caso 1: CSV — se parsea 100% en el cliente (no necesita IA)
      if (isCsv) {
        const text = await file.text();
        const items = parseCSV(text);
        if (items.length === 0) {
          throw new Error("No se detectaron items en el CSV. Asegúrate de tener columnas de nombre, cantidad y precio.");
        }
        applyExtracted({ supplier_name: "", items, currency: "USD" });
        return;
      }

      if (isExcel) {
        throw new Error("Excel aún no soportado. Exporta como CSV o envía una foto/PDF.");
      }

      if (!isImage && !isPdf) {
        throw new Error("Formato no soportado. Usa imagen (JPG/PNG), PDF o CSV.");
      }

      // Caso 2: imagen o PDF — subir a Storage y llamar a la IA
      setUploading(true);
      const upl = await base44.integrations.Core.UploadFile({ file, category: "purchase-orders" });
      setUploading(false);
      if (!upl?.file_url) throw new Error("No se pudo subir el archivo");
      setFileUrl(upl.file_url);

      const data = await extractWithAI(upl.file_url);
      if (!data || !Array.isArray(data.items) || data.items.length === 0) {
        throw new Error("Jeani no pudo leer items en este archivo. Prueba con otra foto o con más luz.");
      }
      applyExtracted(data);
    } catch (err) {
      console.error("ImportPO error:", err);
      setError(err?.message || "Error procesando el archivo");
      toast.error(err?.message || "Error procesando el archivo");
    } finally {
      setUploading(false);
      setExtracting(false);
    }
  };

  const applyExtracted = (data) => {
    setExtracted(data);
    if (data.order_date) setOrderDate(String(data.order_date).slice(0, 10));
    if (data.notes) setNotes(data.notes);

    // Intentar match de proveedor
    if (data.supplier_name && suppliers?.length) {
      let bestSup = null;
      let bestSupScore = 0;
      for (const s of suppliers) {
        const sc = matchScore(data.supplier_name, s.name);
        if (sc > bestSupScore) { bestSupScore = sc; bestSup = s; }
      }
      if (bestSup && bestSupScore >= 0.5) setSupplierId(bestSup.id);
    }

    // Crear filas de review con matches
    const rows = (data.items || []).map((it) => {
      const match = findBestProductMatch(it.raw_name, products);
      return {
        raw_name: it.raw_name || "",
        product_id: match?.product?.id || "",
        product_name: match?.product?.name || it.raw_name || "",
        quantity: Number(it.quantity || 1),
        unit_cost: Number(it.unit_price || 0),
        matchScore: match?.score || 0,
      };
    });
    setReviewRows(rows);
  };

  const updateRow = (idx, patch) => {
    setReviewRows((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeRow = (idx) => {
    setReviewRows((rows) => rows.filter((_, i) => i !== idx));
  };
  const addEmptyRow = () => {
    setReviewRows((rows) => [
      ...rows,
      { raw_name: "", product_id: "", product_name: "", quantity: 1, unit_cost: 0, matchScore: 0 },
    ]);
  };
  const onPickProduct = (idx, productId) => {
    const p = products.find((x) => x.id === productId);
    updateRow(idx, {
      product_id: productId,
      product_name: p?.name || "",
      unit_cost: p?.cost != null ? Number(p.cost) : reviewRows[idx].unit_cost,
      matchScore: 1,
    });
  };

  const subtotal = useMemo(
    () => reviewRows.reduce((s, r) => s + Number(r.quantity || 0) * Number(r.unit_cost || 0), 0),
    [reviewRows],
  );

  const matchedCount = reviewRows.filter((r) => r.product_id).length;
  const unmatchedCount = reviewRows.length - matchedCount;

  const genPoNumber = () => {
    const d = new Date().toISOString().slice(2, 10).replace(/-/g, "");
    const r = Math.floor(Math.random() * 900 + 100);
    return `PO-${d}-${r}`;
  };

  const handleCreate = async () => {
    if (reviewRows.length === 0) {
      toast.error("No hay items para crear la orden");
      return;
    }
    const supplier = suppliers.find((s) => s.id === supplierId);
    setSaving(true);
    try {
      const lineItems = reviewRows.map((r, i) => ({
        id: `li-${Date.now()}-${i}`,
        inventory_item_id: r.product_id || undefined,
        product_name: r.product_name || r.raw_name,
        description: r.raw_name && r.raw_name !== r.product_name ? r.raw_name : "",
        quantity: Number(r.quantity || 0),
        unit_cost: Number(r.unit_cost || 0),
        line_total: Number(r.quantity || 0) * Number(r.unit_cost || 0),
      }));
      const payload = {
        po_number: genPoNumber(),
        supplier_id: supplierId || "",
        supplier_name: supplier?.name || extracted?.supplier_name || "",
        status: "draft",
        order_date: orderDate,
        line_items: lineItems,
        subtotal,
        tax_amount: Number(extracted?.tax || 0),
        shipping_cost: Number(extracted?.shipping || 0),
        total_amount: subtotal + Number(extracted?.tax || 0) + Number(extracted?.shipping || 0),
        currency: extracted?.currency || "USD",
        notes: notes || "",
        attachment_url: fileUrl || undefined,
      };
      await base44.entities.PurchaseOrder.create(payload);
      toast.success(`Orden de compra importada · ${lineItems.length} items`);
      onClose?.();
    } catch (err) {
      console.error("Create PO error:", err);
      toast.error(err?.message || "No se pudo crear la orden");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose?.()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto bg-zinc-950 border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-violet-400" />
            Importar orden de compra con Jeani
          </DialogTitle>
        </DialogHeader>

        {/* Paso 1 — selección de archivo */}
        {!extracted && (
          <div className="space-y-4">
            <label
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`block border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? "border-violet-400/60 bg-violet-500/10 scale-[1.01]"
                  : "border-white/15 hover:bg-white/[0.03]"
              }`}
            >
              <input
                type="file"
                accept="image/*,application/pdf,.pdf,.csv,.xlsx,.xls"
                onChange={handleFilePick}
                className="hidden"
              />
              <Upload className={`w-10 h-10 mx-auto mb-2 transition-colors ${dragOver ? "text-violet-300" : "text-white/30"}`} />
              <p className={`font-black text-sm transition-colors ${dragOver ? "text-violet-200" : "text-white/80"}`}>
                {dragOver
                  ? "Suelta el archivo aquí"
                  : file
                    ? file.name
                    : "Arrastra el archivo aquí o haz click"}
              </p>
              <p className="text-[11px] text-white/40 mt-1">
                Imagen (JPG/PNG), PDF o CSV · máx 15 MB
              </p>
              {file && !dragOver && (
                <p className="text-[10px] text-white/50 mt-1">
                  {(file.size / 1024).toFixed(1)} KB · {file.type || "archivo"}
                </p>
              )}
            </label>

            {isExcel && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Excel aún no es soportado. Exporta como CSV desde tu hoja de cálculo, o envía una foto/PDF.
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <DialogFooter>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 text-xs font-bold hover:text-white"
              >
                Cancelar
              </button>
              <button
                onClick={runExtraction}
                disabled={!file || extracting || uploading || isExcel}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-200 text-xs font-black hover:bg-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                 extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                 <Sparkles className="w-3.5 h-3.5" />}
                {uploading ? "Subiendo…" : extracting ? "Jeani está leyendo…" : "Leer con Jeani"}
              </button>
            </DialogFooter>
          </div>
        )}

        {/* Paso 2 — review */}
        {extracted && (
          <div className="space-y-3">
            {/* Resumen del archivo leído */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <p className="text-[10px] text-white/40 uppercase font-black tracking-wider">Proveedor</p>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full mt-1 bg-transparent text-white text-sm font-bold outline-none"
                >
                  <option value="" className="bg-zinc-900">
                    {extracted.supplier_name || "Sin proveedor"}
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id} className="bg-zinc-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <p className="text-[10px] text-white/40 uppercase font-black tracking-wider">Fecha</p>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="mt-1 bg-transparent border-0 text-white text-sm font-bold p-0 h-auto"
                />
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <p className="text-[10px] text-white/40 uppercase font-black tracking-wider">Total estimado</p>
                <p className="text-white text-lg font-black tabular-nums mt-1">{money(subtotal)}</p>
              </div>
            </div>

            {/* Stats matching */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-black">
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                {matchedCount} matcheados
              </span>
              {unmatchedCount > 0 && (
                <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 font-black">
                  <AlertCircle className="w-3 h-3 inline mr-1" />
                  {unmatchedCount} sin match
                </span>
              )}
              <button
                onClick={() => { setExtracted(null); setReviewRows([]); }}
                className="ml-auto text-[11px] text-white/40 hover:text-white/70 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Leer otro archivo
              </button>
            </div>

            {/* Tabla review */}
            <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
              {reviewRows.map((row, idx) => {
                const scoreColor =
                  row.matchScore >= 0.8 ? "text-emerald-400" :
                  row.matchScore >= 0.45 ? "text-amber-400" : "text-red-400";
                return (
                  <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-white/30 font-black uppercase">Extraído</p>
                        <p className="text-xs text-white/60 truncate">{row.raw_name || "—"}</p>
                      </div>
                      <button
                        onClick={() => removeRow(idx)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 flex items-center justify-center"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-12 gap-2 mt-2">
                      <div className="col-span-12 md:col-span-6">
                        <p className="text-[10px] text-white/30 font-black uppercase mb-0.5">Producto en inventario</p>
                        <select
                          value={row.product_id}
                          onChange={(e) => onPickProduct(idx, e.target.value)}
                          className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                        >
                          <option value="">— Sin match (se creará como descripción) —</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}{p.sku ? ` · ${p.sku}` : ""}
                            </option>
                          ))}
                        </select>
                        {row.matchScore > 0 && (
                          <p className={`text-[10px] mt-0.5 font-black ${scoreColor}`}>
                            Confianza: {(row.matchScore * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <p className="text-[10px] text-white/30 font-black uppercase mb-0.5">Cant.</p>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={row.quantity}
                          onChange={(e) => updateRow(idx, { quantity: Number(e.target.value || 0) })}
                          className="bg-white/[0.04] border-white/10 text-white text-xs h-8"
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <p className="text-[10px] text-white/30 font-black uppercase mb-0.5">Costo u.</p>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.unit_cost}
                          onChange={(e) => updateRow(idx, { unit_cost: Number(e.target.value || 0) })}
                          className="bg-white/[0.04] border-white/10 text-white text-xs h-8"
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2 flex items-end">
                        <p className="text-sm font-black text-white tabular-nums">
                          {money(Number(row.quantity || 0) * Number(row.unit_cost || 0))}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={addEmptyRow}
                className="w-full p-2 rounded-xl border border-dashed border-white/10 text-white/40 hover:text-white/70 hover:bg-white/[0.03] text-xs font-bold flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar línea manual
              </button>
            </div>

            {/* Notas */}
            <div>
              <p className="text-[10px] text-white/30 font-black uppercase mb-1">Notas</p>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas opcionales"
                className="bg-white/[0.04] border-white/10 text-white text-xs"
              />
            </div>

            <DialogFooter className="gap-2">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 text-xs font-bold hover:text-white disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || reviewRows.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 text-xs font-black hover:bg-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {saving ? "Creando…" : `Crear orden (${reviewRows.length} items)`}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
