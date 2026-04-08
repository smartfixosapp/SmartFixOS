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
  const prompt = `Eres Jeani, asistente de SmartFixOS (sistema para talleres de reparación de electrónicos). Lee esta orden de compra / factura / proforma de proveedor y devuelve SOLO un objeto JSON válido (sin texto antes ni después, sin markdown, sin \`\`\`) con esta forma:

{
  "supplier_name": "string",
  "order_date": "YYYY-MM-DD",
  "currency": "USD",
  "subtotal": 0,
  "tax": 0,
  "shipping": 0,
  "total_amount": 0,
  "payment_method": "paypal",
  "notes": "",
  "items": [
    { "raw_name": "nombre tal cual aparece", "sku": "", "quantity": 1, "unit_price": 0, "total": 0, "category": "screen" }
  ]
}

Reglas:
- raw_name = nombre del producto tal cual aparece en la línea, completo.
- Si un valor no aparece, usa 0 para números y "" para strings. NO inventes datos.
- NO incluyas filas de subtotal/impuesto/envío/total dentro de items — van en sus campos.
- Si el archivo no es legible o no es una orden de compra, devuelve {"items": []}.
- category debe ser UNO de: "screen" (pantallas/LCD/OLED/display), "battery" (baterías/batt), "charger" (cargadores/adapters), "cable" (cables USB/lightning/type-c), "case" (fundas/covers/protectores), "diagnostic" (herramientas/equipos de diagnóstico), "other" (cualquier otra cosa como tornillos, flex, parlantes, cámaras, etc.)
- payment_method detecta cómo fue pagada la orden si aparece en el documento (busca "Payment", "Paid by", "Method", logos de PayPal/Visa/Mastercard, "Check", "Wire", etc). Valores permitidos: "paypal", "check", "card", "cash", "transfer", "other". Si NO aparece, usa "" (string vacío).
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

// Pide al LLM que matchee semánticamente cada item extraído contra el catálogo.
// Le pasamos solo los TOP-K candidatos por fuzzy para mantener el prompt corto.
// Devuelve un Map<rawName, productId|null>.
async function matchItemsWithAI(rawItems, products) {
  if (!rawItems?.length || !products?.length) return new Map();

  // Para cada item, escogemos los top 8 candidatos por fuzzy y unimos.
  // Eso reduce muchísimo el catálogo enviado al LLM.
  const candidateIds = new Set();
  for (const it of rawItems) {
    const scored = products
      .map((p) => ({ p, s: matchScore(it.raw_name, p.name) +
                            matchScore(it.raw_name, p.sku || "") * 0.5 }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 8);
    for (const c of scored) candidateIds.add(c.p.id);
  }
  // Si el catálogo es chico (<60), mandamos todo
  let slimCatalog;
  if (products.length <= 60) {
    slimCatalog = products;
  } else {
    slimCatalog = products.filter((p) => candidateIds.has(p.id));
  }
  if (slimCatalog.length === 0) return new Map();

  const catalogText = slimCatalog
    .map((p) => `${p.id}|${p.name}${p.sku ? ` [${p.sku}]` : ""}`)
    .join("\n");

  const itemsText = rawItems
    .map((it, i) => `${i + 1}. ${it.raw_name}`)
    .join("\n");

  const prompt = `Eres Jeani, asistente experto en piezas y accesorios de reparación de electrónicos para SmartFixOS.

Tengo una orden de compra con estos items (cada uno tiene su número):
${itemsText}

Y este es mi catálogo de productos en inventario (formato: id|nombre [sku]):
${catalogText}

Tu tarea: para cada item de la orden, encontrar el producto del catálogo que más probablemente sea EL MISMO ARTÍCULO, aunque el nombre sea distinto, esté en otro idioma, use jerga, abreviaturas o nombres en clave.
Ejemplos de matching válido:
- "Tiger Diaples 15" ↔ "Pantalla iPhone 15 LCD"  (jerga de proveedor)
- "iPhone 15 Pro Max battery OEM" ↔ "Bateria iPhone 15 Pro Max"
- "S23 Ultra screen incell" ↔ "Pantalla Samsung S23 Ultra"
- "USB-C type C cable 1m black" ↔ "Cable USB-C 1m negro"

Reglas estrictas:
- Solo matchea si estás SEGURO de que es el mismo artículo. Si dudas, devuelve null.
- No inventes IDs. Solo usa IDs del catálogo que te di.
- Devuelve SOLO un JSON con esta forma exacta, sin texto adicional, sin markdown:

{
  "matches": [
    { "item_number": 1, "product_id": "uuid-o-null", "confidence": 0.95, "reason": "explicación breve" }
  ]
}`;

  let raw;
  try {
    raw = await base44.integrations.Core.InvokeLLM({ prompt });
  } catch (err) {
    throw new Error("Jeani no pudo matchear los items: " + (err?.message || ""));
  }

  let text = "";
  if (typeof raw === "string") text = raw;
  else if (raw?.response) text = raw.response;
  else if (raw?.data?.message) text = typeof raw.data.message === "string" ? raw.data.message : JSON.stringify(raw.data.message);
  else if (typeof raw === "object") text = JSON.stringify(raw);

  text = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const s = text.indexOf("{");
  const e = text.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("Jeani no devolvió JSON al matchear");
  let parsed;
  try {
    parsed = JSON.parse(text.slice(s, e + 1));
  } catch (err) {
    throw new Error("JSON de matching inválido: " + err.message);
  }

  const result = new Map();
  for (const m of parsed?.matches || []) {
    const idx = Number(m.item_number) - 1;
    if (idx < 0 || idx >= rawItems.length) continue;
    const item = rawItems[idx];
    if (m.product_id && slimCatalog.some((p) => p.id === m.product_id)) {
      result.set(item.raw_name, {
        product_id: m.product_id,
        confidence: Number(m.confidence || 0.9),
      });
    }
  }
  return result;
}

export default function ImportPODialog({ open, onClose, suppliers = [], products = [], workOrders = [], existingPOs = [] }) {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState(null); // { supplier_name, items: [...], ... }
  const [reviewRows, setReviewRows] = useState([]); // [{ raw_name, product_id, product_name, quantity, unit_cost, matchScore }]
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [creatingProductIdx, setCreatingProductIdx] = useState(null);
  const [aiMatching, setAiMatching] = useState(false);
  // Pago — para registrar el gasto en Finanzas al momento de importar
  const [paidAtOrder, setPaidAtOrder] = useState(true); // por defecto sí pagaste (PayPal/cheque)
  const [paymentMethod, setPaymentMethod] = useState("paypal");
  // Sub-modal: crear producto nuevo (pide precio antes)
  const [newProductForRow, setNewProductForRow] = useState(null); // { idx, name, cost, price, category }
  // Bulk create
  const [bulkMarginPct, setBulkMarginPct] = useState(50);
  const [bulkCreating, setBulkCreating] = useState(false);
  // Historial de precios — Map<product_id, [{date, cost}]>
  const [priceHistory, setPriceHistory] = useState({});
  // Catálogo "vivo" — incluye los productos recién creados desde este diálogo
  const [liveProducts, setLiveProducts] = useState(products);
  useEffect(() => { setLiveProducts(products); }, [products]);
  // Multi-file queue
  const [fileQueue, setFileQueue] = useState([]); // pending files
  const [batchProgress, setBatchProgress] = useState(null); // { current, total }

  useEffect(() => {
    if (!open) {
      setFile(null);
      setFileUrl("");
      setExtracted(null);
      setReviewRows([]);
      setSupplierId("");
      setOrderDate(new Date().toISOString().slice(0, 10));
      setExpectedDate("");
      setNotes("");
      setError("");
      setUploading(false);
      setExtracting(false);
      setSaving(false);
      setPaidAtOrder(true);
      setPaymentMethod("paypal");
      setNewProductForRow(null);
      setBulkMarginPct(50);
      setBulkCreating(false);
      setPriceHistory({});
      setFileQueue([]);
      setBatchProgress(null);
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

  const acceptFiles = (files) => {
    if (!files || files.length === 0) return;
    if (files.length === 1) {
      acceptFile(files[0]);
      setFileQueue([]);
      return;
    }
    // Multi-file: acepta el primero como actual y encola el resto
    const arr = Array.from(files);
    const max = 15 * 1024 * 1024;
    const valid = arr.filter((f) => f.size <= max);
    if (valid.length === 0) {
      toast.error("Ningún archivo válido (máx 15 MB cada uno)");
      return;
    }
    if (valid.length < arr.length) {
      toast.warning(`${arr.length - valid.length} archivo(s) omitidos por tamaño`);
    }
    acceptFile(valid[0]);
    setFileQueue(valid.slice(1));
    toast.info(`📚 Cola de ${valid.length} archivos · Procesa el actual y luego pasamos al siguiente`);
  };

  const handleFilePick = (e) => acceptFiles(e.target.files);

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
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) acceptFiles(files);
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

    // Método de pago — prioridad: lo que Jeani detectó del PDF > default del supplier > heurística
    const validMethods = ["paypal", "check", "card", "cash", "transfer", "other"];
    if (data.payment_method && validMethods.includes(data.payment_method)) {
      setPaymentMethod(data.payment_method);
    }

    // Intentar match de proveedor
    if (data.supplier_name && suppliers?.length) {
      let bestSup = null;
      let bestSupScore = 0;
      for (const s of suppliers) {
        const sc = matchScore(data.supplier_name, s.name);
        if (sc > bestSupScore) { bestSupScore = sc; bestSup = s; }
      }
      if (bestSup && bestSupScore >= 0.5) {
        setSupplierId(bestSup.id);
        // Solo fallback: si Jeani NO detectó el método, usar el default del supplier o heurística
        if (!data.payment_method || !validMethods.includes(data.payment_method)) {
          if (bestSup.default_payment_method) {
            setPaymentMethod(bestSup.default_payment_method);
          } else {
            const supName = norm(bestSup.name + " " + (data.supplier_name || ""));
            if (supName.includes("waves") || supName.includes("pr mobile") || supName.includes("prmobile")) {
              setPaymentMethod("check");
            } else {
              setPaymentMethod("paypal");
            }
          }
        }
      }
    } else if (data.supplier_name && (!data.payment_method || !validMethods.includes(data.payment_method))) {
      const supName = norm(data.supplier_name);
      if (supName.includes("waves") || supName.includes("pr mobile") || supName.includes("prmobile")) {
        setPaymentMethod("check");
      } else {
        setPaymentMethod("paypal");
      }
    }

    // Crear filas de review con matches
    const rows = (data.items || []).map((it) => {
      const match = findBestProductMatch(it.raw_name, liveProducts);
      return {
        raw_name: it.raw_name || "",
        product_id: match?.product?.id || "",
        product_name: match?.product?.name || it.raw_name || "",
        quantity: Number(it.quantity || 1),
        unit_cost: Number(it.unit_price || 0),
        matchScore: match?.score || 0,
        work_order_id: "",
        ai_category: it.category || "other", // Categoría sugerida por Jeani
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
      { raw_name: "", product_id: "", product_name: "", quantity: 1, unit_cost: 0, matchScore: 0, work_order_id: "" },
    ]);
  };
  const onPickProduct = (idx, productId) => {
    const p = liveProducts.find((x) => x.id === productId);
    updateRow(idx, {
      product_id: productId,
      product_name: p?.name || "",
      unit_cost: p?.cost != null ? Number(p.cost) : reviewRows[idx].unit_cost,
      matchScore: 1,
    });
  };

  // Abre el sub-modal para crear un producto nuevo a partir de la línea extraída.
  // El sub-modal pide el PRECIO DE VENTA antes de crearlo (importante porque
  // luego podríamos enlazarlo a una orden de trabajo y facturarlo al cliente).
  const openCreateProductModal = (idx) => {
    const row = reviewRows[idx];
    if (!row?.raw_name) {
      toast.error("Esta línea no tiene nombre — añádelo primero");
      return;
    }
    const cost = Number(row.unit_cost || 0);
    setNewProductForRow({
      idx,
      name: row.raw_name.trim(),
      cost,
      price: cost > 0 ? Math.round(cost * 1.5 * 100) / 100 : "", // sugerencia 50% margen
      category: row.ai_category || "screen",
      tipo_principal: "dispositivos",
    });
  };

  // Crea productos en masa para todos los items sin match, usando el margen global.
  const bulkCreateNewProducts = async () => {
    const toCreate = reviewRows
      .map((r, i) => ({ row: r, idx: i }))
      .filter(({ row }) => !row.product_id && row.raw_name);
    if (toCreate.length === 0) {
      toast.info("No hay items sin match para crear");
      return;
    }
    const ok = window.confirm(
      `¿Crear ${toCreate.length} producto${toCreate.length === 1 ? "" : "s"} nuevo${toCreate.length === 1 ? "" : "s"} en inventario con margen de ${bulkMarginPct}%?`
    );
    if (!ok) return;
    setBulkCreating(true);
    const supplier = suppliers.find((s) => s.id === supplierId);
    const created = [];
    let failed = 0;
    for (const { row, idx } of toCreate) {
      const cost = Number(row.unit_cost || 0);
      const price = cost > 0 ? Math.round(cost * (1 + bulkMarginPct / 100) * 100) / 100 : 0;
      try {
        const product = await base44.entities.Product.create({
          name: row.raw_name.trim(),
          type: "product",
          cost,
          price,
          stock: 0,
          min_stock: 5,
          active: true,
          supplier_id: supplier?.id || "",
          supplier_name: supplier?.name || extracted?.supplier_name || "",
          category: row.ai_category || "other",
          tipo_principal: "dispositivos",
        });
        if (product?.id) {
          created.push({ idx, product });
        }
      } catch (err) {
        console.warn(`No se pudo crear ${row.raw_name}:`, err);
        failed++;
      }
    }
    // Aplicar los matches
    setLiveProducts((list) => [...created.map((c) => c.product), ...list]);
    setReviewRows((rows) =>
      rows.map((r, i) => {
        const hit = created.find((c) => c.idx === i);
        if (!hit) return r;
        return {
          ...r,
          product_id: hit.product.id,
          product_name: hit.product.name,
          matchScore: 1,
        };
      })
    );
    setBulkCreating(false);
    if (failed > 0) {
      toast.warning(`Creados ${created.length}, fallaron ${failed}`);
    } else {
      toast.success(`${created.length} producto${created.length === 1 ? "" : "s"} creado${created.length === 1 ? "" : "s"} con ${bulkMarginPct}% de margen`);
    }
  };

  // Carga el historial de precios (últimas compras) para los productos matcheados
  const loadPriceHistory = async () => {
    const productIds = Array.from(
      new Set(reviewRows.filter((r) => r.product_id).map((r) => r.product_id))
    );
    if (productIds.length === 0) return;
    const history = {};
    // Por cada producto, pedimos los últimos movimientos "purchase"
    await Promise.all(
      productIds.map(async (pid) => {
        try {
          const movements = await base44.entities.InventoryMovement.filter
            ? await base44.entities.InventoryMovement.filter(
                { product_id: pid, movement_type: "purchase" },
                "-created_date",
                5
              )
            : [];
          // Cada movimiento no tiene el costo directo; lo inferimos de las notas o skip
          // Si tu InventoryMovement no guarda costo, esto quedará vacío y no mostramos nada.
          if (Array.isArray(movements) && movements.length > 0) {
            history[pid] = movements;
          }
        } catch { /* silent */ }
      })
    );
    setPriceHistory(history);
  };

  useEffect(() => {
    // Cargar historial cuando cambian las filas matcheadas
    if (extracted && reviewRows.some((r) => r.product_id)) {
      loadPriceHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extracted]);

  // Confirma la creación desde el sub-modal
  const confirmCreateProduct = async () => {
    const draft = newProductForRow;
    if (!draft?.name?.trim()) { toast.error("Falta el nombre"); return; }
    if (!draft.price || Number(draft.price) <= 0) {
      toast.error("Pon el precio de venta antes de crear el producto");
      return;
    }
    setCreatingProductIdx(draft.idx);
    try {
      const supplier = suppliers.find((s) => s.id === supplierId);
      const payload = {
        name: draft.name.trim(),
        type: "product",
        cost: Number(draft.cost || 0),
        price: Number(draft.price),
        stock: 0,
        min_stock: 5,
        active: true,
        supplier_id: supplier?.id || "",
        supplier_name: supplier?.name || extracted?.supplier_name || "",
        category: draft.category || undefined,
        tipo_principal: draft.tipo_principal || "dispositivos",
      };
      const created = await base44.entities.Product.create(payload);
      if (!created?.id) throw new Error("No se devolvió el ID del producto creado");

      setLiveProducts((list) => [created, ...list]);
      updateRow(draft.idx, {
        product_id: created.id,
        product_name: created.name,
        matchScore: 1,
      });
      toast.success(`Producto "${created.name}" creado · Precio venta $${Number(draft.price).toFixed(2)}`);
      setNewProductForRow(null);
    } catch (err) {
      console.error("Create product error:", err);
      toast.error(err?.message || "No se pudo crear el producto");
    } finally {
      setCreatingProductIdx(null);
    }
  };

  // Pide al LLM que matchee los items extraídos contra el catálogo
  // usando comprensión semántica (entiende jerga, abreviaturas, etc.).
  const runAIMatching = async () => {
    if (reviewRows.length === 0) return;
    if (liveProducts.length === 0) {
      toast.error("No hay productos en el catálogo para matchear");
      return;
    }
    setAiMatching(true);
    try {
      const rawItems = reviewRows.map((r) => ({ raw_name: r.raw_name }));
      const matches = await matchItemsWithAI(rawItems, liveProducts);
      if (matches.size === 0) {
        toast.info("Jeani no encontró matches nuevos seguros");
        return;
      }
      let updated = 0;
      setReviewRows((rows) =>
        rows.map((r) => {
          // No sobreescribimos matches manuales (los que ya tienen score >= 1)
          if (r.product_id && r.matchScore >= 1) return r;
          const m = matches.get(r.raw_name);
          if (!m) return r;
          const p = liveProducts.find((x) => x.id === m.product_id);
          if (!p) return r;
          updated++;
          return {
            ...r,
            product_id: p.id,
            product_name: p.name,
            unit_cost: r.unit_cost || (p.cost != null ? Number(p.cost) : 0),
            matchScore: m.confidence || 0.9,
          };
        }),
      );
      toast.success(`Jeani matcheó ${updated} item${updated === 1 ? "" : "s"} más`);
    } catch (err) {
      console.error("AI matching error:", err);
      toast.error(err?.message || "Falló el matching con IA");
    } finally {
      setAiMatching(false);
    }
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

    // Detectar posibles duplicados: mismo proveedor, misma fecha, mismo total (±$1)
    const candidateTotal = subtotal + Number(extracted?.tax || 0) + Number(extracted?.shipping || 0);
    const nameForMatch = (supplier?.name || extracted?.supplier_name || "").toLowerCase().trim();
    const duplicate = (existingPOs || []).find((po) => {
      if (!nameForMatch) return false;
      const supMatch = (po.supplier_name || "").toLowerCase().trim() === nameForMatch;
      if (!supMatch) return false;
      const dateMatch = String(po.order_date || "").slice(0, 10) === orderDate;
      if (!dateMatch) return false;
      const totalDiff = Math.abs(Number(po.total_amount || 0) - candidateTotal);
      return totalDiff <= 1;
    });
    if (duplicate) {
      const ok = window.confirm(
        `⚠️ Posible duplicado detectado\n\n` +
        `Ya existe una orden con los mismos datos:\n` +
        `• ${duplicate.po_number}\n` +
        `• ${duplicate.supplier_name}\n` +
        `• ${duplicate.order_date} · $${Number(duplicate.total_amount || 0).toFixed(2)}\n\n` +
        `¿Quieres crearla de todos modos?`
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      const lineItems = reviewRows.map((r, i) => {
        const wo = r.work_order_id ? workOrders.find((w) => w.id === r.work_order_id) : null;
        return {
          id: `li-${Date.now()}-${i}`,
          inventory_item_id: r.product_id || undefined,
          product_name: r.product_name || r.raw_name,
          description: r.raw_name && r.raw_name !== r.product_name ? r.raw_name : "",
          quantity: Number(r.quantity || 0),
          unit_cost: Number(r.unit_cost || 0),
          line_total: Number(r.quantity || 0) * Number(r.unit_cost || 0),
          linked_work_order_id: r.work_order_id || undefined,
          linked_work_order_number: wo?.order_number || undefined,
        };
      });
      const totalAmount = subtotal + Number(extracted?.tax || 0) + Number(extracted?.shipping || 0);
      const poNumber = genPoNumber();

      // El schema actual de purchase_order no tiene columna attachment_url,
      // así que guardamos el URL del archivo dentro de notes para no perderlo.
      // También guardamos un marcador "PAID:method" para que el dialog de detalle
      // sepa que ya se pagó y NO duplique el gasto cuando se reciba.
      const notesParts = [
        notes || "",
        paidAtOrder ? `[PAID:${paymentMethod}]` : "",
        fileUrl ? `📎 Archivo importado: ${fileUrl}` : "",
      ].filter(Boolean);
      const notesWithMeta = notesParts.join("\n").trim();

      const payload = {
        po_number: poNumber,
        supplier_id: supplierId || "",
        supplier_name: supplier?.name || extracted?.supplier_name || "",
        status: paidAtOrder ? "ordered" : "draft",
        order_date: orderDate,
        expected_date: expectedDate || null,
        line_items: lineItems,
        subtotal,
        tax_amount: Number(extracted?.tax || 0),
        shipping_cost: Number(extracted?.shipping || 0),
        total_amount: totalAmount,
        currency: extracted?.currency || "USD",
        notes: notesWithMeta,
      };
      await base44.entities.PurchaseOrder.create(payload);

      // Aprender el método de pago del proveedor para la próxima vez
      if (paidAtOrder && supplier?.id && supplier.default_payment_method !== paymentMethod) {
        try {
          await base44.entities.Supplier.update(supplier.id, {
            default_payment_method: paymentMethod,
          });
        } catch (supErr) {
          console.warn("No se pudo guardar el método de pago del proveedor:", supErr);
        }
      }

      // Si la usuario marcó "Ya pagué" → registrar el gasto en Finanzas
      if (paidAtOrder && totalAmount > 0) {
        try {
          const itemsDesc = lineItems
            .map((it) => `${it.product_name} x${it.quantity}`)
            .join(", ");
          await base44.entities.Transaction.create({
            type: "expense",
            category: "parts",
            amount: Math.round(totalAmount * 100) / 100,
            description: `OC ${poNumber}${supplier?.name ? ` — ${supplier.name}` : extracted?.supplier_name ? ` — ${extracted.supplier_name}` : ""}. ${itemsDesc}`.slice(0, 500),
            payment_method: paymentMethod,
            order_number: poNumber,
            notes: `Gasto auto-registrado al importar OC. Pago: ${paymentMethod}`,
          });
        } catch (txErr) {
          console.warn("No se pudo registrar el gasto auto:", txErr);
          toast.warning("OC creada, pero el gasto no se registró: " + (txErr?.message || ""));
        }
      }

      // ── Inyectar items en las Órdenes de Trabajo enlazadas ──────────────
      // Para que aparezcan en el resumen financiero de cada WO con su precio venta.
      const woGroups = new Map(); // wo_id → array de items
      for (const r of reviewRows) {
        if (!r.work_order_id) continue;
        const product = liveProducts.find((p) => p.id === r.product_id);
        // Precio venta: del producto (si existe) o costo*1.5 como fallback
        const sellPrice =
          product?.price != null && Number(product.price) > 0
            ? Number(product.price)
            : Math.round(Number(r.unit_cost || 0) * 1.5 * 100) / 100;
        const item = {
          id: `wo-part-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "product",
          name: r.product_name || r.raw_name,
          quantity: Number(r.quantity || 0),
          price: sellPrice,
        };
        const list = woGroups.get(r.work_order_id) || [];
        list.push(item);
        woGroups.set(r.work_order_id, list);
      }

      let woUpdated = 0;
      for (const [woId, newItems] of woGroups) {
        try {
          const wo = await base44.entities.Order.get(woId);
          const existing = Array.isArray(wo?.parts_needed) ? wo.parts_needed : [];
          await base44.entities.Order.update(woId, {
            parts_needed: [...existing, ...newItems],
          });
          woUpdated++;
        } catch (err) {
          console.warn(`No se pudo enlazar items a WO ${woId}:`, err);
        }
      }
      if (woGroups.size > 0) {
        if (woUpdated === woGroups.size) {
          toast.success(`Items enlazados a ${woUpdated} orden${woUpdated === 1 ? "" : "es"} de trabajo`);
        } else {
          toast.warning(`Solo ${woUpdated}/${woGroups.size} órdenes de trabajo se pudieron actualizar`);
        }
      }

      toast.success(
        paidAtOrder
          ? `OC importada · ${lineItems.length} items · Gasto $${totalAmount.toFixed(2)} registrado`
          : `OC importada · ${lineItems.length} items (borrador)`,
      );

      // Insight opcional de Jeani: comparar con compras recientes del mismo proveedor
      try {
        const supName = supplier?.name || extracted?.supplier_name || "";
        const recentSameSupplier = (existingPOs || [])
          .filter((po) => (po.supplier_name || "").toLowerCase() === supName.toLowerCase())
          .slice(0, 5);
        if (supName && recentSameSupplier.length >= 1) {
          const avgRecent = recentSameSupplier.reduce((s, p) => s + Number(p.total_amount || 0), 0) / recentSameSupplier.length;
          const diffPct = avgRecent > 0 ? ((totalAmount - avgRecent) / avgRecent) * 100 : 0;
          if (Math.abs(diffPct) >= 15) {
            const direction = diffPct > 0 ? "más" : "menos";
            toast(
              `💡 Jeani: Gastaste ${Math.abs(diffPct).toFixed(0)}% ${direction} que tu promedio con ${supName} (últimas ${recentSameSupplier.length} OCs: $${avgRecent.toFixed(0)} prom.)`,
              { duration: 8000 },
            );
          }
        }
      } catch { /* insight no-critical */ }

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
                multiple
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] col-span-2 md:col-span-1">
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
                <p className="text-[10px] text-white/40 uppercase font-black tracking-wider">Fecha orden</p>
                <Input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="mt-1 bg-transparent border-0 text-white text-sm font-bold p-0 h-auto"
                />
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <p className="text-[10px] text-white/40 uppercase font-black tracking-wider">Llega el (opcional)</p>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="mt-1 bg-transparent border-0 text-white text-sm font-bold p-0 h-auto"
                />
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <p className="text-[10px] text-white/40 uppercase font-black tracking-wider">Total estimado</p>
                <p className="text-white text-lg font-black tabular-nums mt-1">{money(subtotal)}</p>
              </div>
            </div>

            {/* Stats matching */}
            <div className="flex items-center gap-2 text-[11px] flex-wrap">
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
                onClick={runAIMatching}
                disabled={aiMatching || reviewRows.length === 0}
                title="Usa IA para entender jerga, abreviaturas y nombres en otro idioma"
                className="px-2 py-1 rounded-md bg-violet-500/15 text-violet-300 border border-violet-500/25 font-black hover:bg-violet-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {aiMatching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {aiMatching ? "Matcheando…" : "Mejorar matches con Jeani"}
              </button>
              <button
                onClick={() => { setExtracted(null); setReviewRows([]); }}
                className="ml-auto text-[11px] text-white/40 hover:text-white/70 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Leer otro archivo
              </button>
            </div>

            {/* Bulk create — aparece solo si hay items sin match */}
            {unmatchedCount > 0 && (
              <div className="p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white">
                    Crear los {unmatchedCount} sin match como productos nuevos
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Se crean con el margen global. Puedes ajustarlo después en Inventario.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/50 font-black uppercase">Margen:</span>
                  <input
                    type="range"
                    min="10"
                    max="150"
                    step="5"
                    value={bulkMarginPct}
                    onChange={(e) => setBulkMarginPct(Number(e.target.value))}
                    className="w-24 accent-emerald-500"
                  />
                  <span className="text-sm font-black text-emerald-300 tabular-nums w-10">{bulkMarginPct}%</span>
                </div>
                <button
                  onClick={bulkCreateNewProducts}
                  disabled={bulkCreating}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-black hover:bg-emerald-500/30 disabled:opacity-40"
                >
                  {bulkCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  Crear todos
                </button>
              </div>
            )}

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
                        <div className="flex gap-1">
                          <select
                            value={row.product_id}
                            onChange={(e) => onPickProduct(idx, e.target.value)}
                            className="flex-1 min-w-0 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                          >
                            <option value="">— Sin match —</option>
                            {liveProducts.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}{p.sku ? ` · ${p.sku}` : ""}
                              </option>
                            ))}
                          </select>
                          {!row.product_id && (
                            <button
                              type="button"
                              onClick={() => openCreateProductModal(idx)}
                              disabled={creatingProductIdx === idx || !row.raw_name}
                              title="Crear este item como producto nuevo en inventario (te pide el precio de venta primero)"
                              className="shrink-0 px-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[10px] font-black hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                            >
                              {creatingProductIdx === idx ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Plus className="w-3 h-3" />
                              )}
                              Crear nuevo
                            </button>
                          )}
                        </div>
                        {row.matchScore > 0 && (
                          <p className={`text-[10px] mt-0.5 font-black ${scoreColor}`}>
                            {row.product_id ? `Confianza: ${(row.matchScore * 100).toFixed(0)}%` : ""}
                          </p>
                        )}
                        {/* Enlazar a una orden de trabajo (opcional) */}
                        {workOrders.length > 0 && (
                          <div className="mt-1">
                            <p className="text-[9px] text-white/30 font-black uppercase mb-0.5">
                              Enlazar a orden de trabajo (opcional)
                            </p>
                            <select
                              value={row.work_order_id || ""}
                              onChange={(e) => updateRow(idx, { work_order_id: e.target.value })}
                              className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white"
                            >
                              <option value="">— Sin orden de trabajo —</option>
                              {workOrders.slice(0, 100).map((wo) => (
                                <option key={wo.id} value={wo.id}>
                                  {wo.order_number || wo.id?.slice(-6)}
                                  {wo.customer_name ? ` · ${wo.customer_name}` : ""}
                                </option>
                              ))}
                            </select>
                          </div>
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
                        {row.product_id && (() => {
                          const prod = liveProducts.find((p) => p.id === row.product_id);
                          const lastCost = prod?.cost != null ? Number(prod.cost) : null;
                          if (lastCost == null || lastCost <= 0) return null;
                          const diff = Number(row.unit_cost || 0) - lastCost;
                          const pct = lastCost > 0 ? (diff / lastCost) * 100 : 0;
                          const color = diff > 0.01 ? "text-red-400" : diff < -0.01 ? "text-emerald-400" : "text-white/40";
                          return (
                            <p className={`text-[9px] mt-0.5 font-black ${color}`} title="Último costo registrado en este producto">
                              Antes: ${lastCost.toFixed(2)}
                              {Math.abs(pct) >= 1 && ` (${pct > 0 ? "+" : ""}${pct.toFixed(0)}%)`}
                            </p>
                          );
                        })()}
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

            {/* Pago — registrar gasto al importar */}
            <div className="p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/20">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paidAtOrder}
                  onChange={(e) => setPaidAtOrder(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-white">
                    Ya pagué esta orden — registrar gasto en Finanzas
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    Marcado: crea el gasto al toque y la OC nace en estado <b>Enviada</b>.
                    Sin marcar: la OC nace como <b>Borrador</b> y el gasto se crea cuando la marques como <b>Recibida</b>.
                  </p>
                </div>
              </label>
              {paidAtOrder && (
                <div className="mt-2 flex items-center gap-2 ml-6">
                  <span className="text-[10px] text-white/40 font-black uppercase">Pagué con:</span>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-xs text-white font-bold"
                  >
                    <option value="paypal">💳 PayPal</option>
                    <option value="check">🧾 Cheque</option>
                    <option value="card">💳 Tarjeta</option>
                    <option value="cash">💵 Efectivo</option>
                    <option value="transfer">🏦 Transferencia</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
              )}
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

      {/* Sub-modal — Crear producto nuevo (pide precio venta) */}
      <Dialog open={!!newProductForRow} onOpenChange={(v) => !v && setNewProductForRow(null)}>
        <DialogContent className="max-w-md bg-zinc-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Crear producto nuevo en inventario
            </DialogTitle>
          </DialogHeader>
          {newProductForRow && (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-white/40 font-black uppercase mb-1">Nombre</p>
                <Input
                  value={newProductForRow.name}
                  onChange={(e) => setNewProductForRow((d) => ({ ...d, name: e.target.value }))}
                  className="bg-white/[0.04] border-white/10 text-white text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-white/40 font-black uppercase mb-1">Costo (lo que pagas)</p>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProductForRow.cost}
                    onChange={(e) => setNewProductForRow((d) => ({ ...d, cost: Number(e.target.value || 0) }))}
                    className="bg-white/[0.04] border-white/10 text-white text-sm"
                  />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-400 font-black uppercase mb-1">Precio venta *</p>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="$0.00"
                    value={newProductForRow.price}
                    onChange={(e) => setNewProductForRow((d) => ({ ...d, price: e.target.value }))}
                    className="bg-emerald-500/[0.05] border-emerald-500/30 text-white text-sm font-black"
                  />
                </div>
              </div>
              {Number(newProductForRow.cost) > 0 && Number(newProductForRow.price) > 0 && (
                <p className="text-[11px] text-white/50">
                  Margen: <span className="font-black text-emerald-300">
                    {(((Number(newProductForRow.price) - Number(newProductForRow.cost)) / Number(newProductForRow.cost)) * 100).toFixed(0)}%
                  </span>
                  {" · "}
                  Ganancia por unidad: <span className="font-black text-emerald-300">
                    ${(Number(newProductForRow.price) - Number(newProductForRow.cost)).toFixed(2)}
                  </span>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-white/40 font-black uppercase mb-1">Categoría</p>
                  <select
                    value={newProductForRow.category}
                    onChange={(e) => setNewProductForRow((d) => ({ ...d, category: e.target.value }))}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
                  >
                    <option value="screen">Pantalla</option>
                    <option value="battery">Batería</option>
                    <option value="charger">Cargador</option>
                    <option value="cable">Cable</option>
                    <option value="case">Case / Funda</option>
                    <option value="diagnostic">Diagnóstico</option>
                    <option value="other">Otro</option>
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 font-black uppercase mb-1">Tipo</p>
                  <select
                    value={newProductForRow.tipo_principal}
                    onChange={(e) => setNewProductForRow((d) => ({ ...d, tipo_principal: e.target.value }))}
                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-2 py-2 text-xs text-white"
                  >
                    <option value="dispositivos">Dispositivos / Piezas</option>
                    <option value="accesorios">Accesorios</option>
                  </select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button
              onClick={() => setNewProductForRow(null)}
              className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 text-xs font-bold hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={confirmCreateProduct}
              disabled={creatingProductIdx !== null || !newProductForRow?.price}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-black hover:bg-emerald-500/30 disabled:opacity-40"
            >
              {creatingProductIdx !== null ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Crear producto
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
