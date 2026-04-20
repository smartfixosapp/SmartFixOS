import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Receipt, Building2, Users, Package, Upload, Sparkles, Loader2, CheckCircle2, AlertCircle, ArrowLeft, X, Camera } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTION_URL || "https://smartfixos.onrender.com";

const DOCUMENT_TYPES = [
  {
    id: "receipt",
    label: "Recibo",
    description: "Luma, AAA, tienda, servicio",
    icon: Receipt,
    color: "emerald",
  },
  {
    id: "statement",
    label: "Estado de cuenta",
    description: "Multiples transacciones del banco",
    icon: Building2,
    color: "blue",
  },
  {
    id: "payroll",
    label: "Pago a empleado",
    description: "Screenshot ATH Movil / Zelle",
    icon: Users,
    color: "violet",
  },
  {
    id: "invoice",
    label: "Factura de inventario",
    description: "Compra de piezas a proveedor",
    icon: Package,
    color: "amber",
  },
];

const COLOR_MAP = {
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", iconBg: "bg-emerald-500/15" },
  blue:    { bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-400",    iconBg: "bg-blue-500/15" },
  violet:  { bg: "bg-violet-500/10",  border: "border-violet-500/30",  text: "text-violet-400",  iconBg: "bg-violet-500/15" },
  amber:   { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-400",   iconBg: "bg-amber-500/15" },
};

export default function JenaiExpenseCapture({ open, onClose, onSuccess }) {
  // step: "select" | "upload" | "processing" | "confirm" | "saving"
  const [step, setStep] = useState("select");
  const [docType, setDocType] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [error, setError] = useState("");
  const [selectedTxs, setSelectedTxs] = useState(new Set()); // for statement mode
  const fileInputRef = useRef(null);

  const reset = () => {
    setStep("select");
    setDocType(null);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileUrl(null);
    setExtracted(null);
    setError("");
    setSelectedTxs(new Set());
  };

  const handleClose = () => {
    reset();
    onClose?.();
  };

  const handleSelectType = (type) => {
    setDocType(type);
    setStep("upload");
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.type.startsWith("image/")) {
      toast.error("Solo se aceptan imagenes (PNG, JPG, WEBP)");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      toast.error("Archivo muy grande (max 10MB)");
      return;
    }
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const handleProcess = async () => {
    if (!file || !docType) return;
    setStep("processing");
    setError("");
    try {
      // 1. Upload file to storage
      const uploadResult = await base44.integrations.Core.UploadFile({ file, category: "expenses" });
      const uploadedUrl = uploadResult?.file_url;
      if (!uploadedUrl) throw new Error("No se pudo subir el archivo");
      setFileUrl(uploadedUrl);

      // 2. Call AI extraction endpoint
      const res = await fetch(`${FUNCTIONS_URL}/ai/extract-expense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_url: uploadedUrl, document_type: docType.id }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setExtracted(data);

      // For statements, pre-select all suggested transactions
      if (docType.id === "statement" && Array.isArray(data.transactions)) {
        const allIdx = new Set();
        data.transactions.forEach((tx, idx) => {
          if (tx.suggested_import !== false) allIdx.add(idx);
        });
        setSelectedTxs(allIdx);
      }
      setStep("confirm");
    } catch (err) {
      console.error("AI extract error:", err);
      setError(err.message || "Error procesando el documento");
      setStep("upload");
    }
  };

  const handleSave = async () => {
    if (!extracted || !docType) return;
    setStep("saving");
    try {
      if (docType.id === "receipt" || docType.id === "payroll") {
        // Create single transaction
        const txData = {
          type: "expense",
          amount: Number(extracted.amount || 0),
          description: extracted.description || extracted.vendor || "Gasto",
          category: extracted.category || (docType.id === "payroll" ? "payroll" : "other_expense"),
          payment_method: extracted.payment_method || "other",
          created_date: extracted.date ? new Date(extracted.date).toISOString() : new Date().toISOString(),
          notes: JSON.stringify({
            source: "jenai",
            doc_type: docType.id,
            file_url: fileUrl,
            vendor: extracted.vendor,
            employee_name: extracted.employee_name,
            confidence: extracted.confidence,
            extra_notes: extracted.notes,
          }),
        };
        await dataClient.entities.Transaction.create(txData);
        toast.success(`Gasto creado: $${txData.amount.toFixed(2)}`);
      } else if (docType.id === "statement") {
        // Create multiple transactions
        const toImport = (extracted.transactions || []).filter((_, idx) => selectedTxs.has(idx));
        if (toImport.length === 0) {
          toast.error("Selecciona al menos una transaccion");
          setStep("confirm");
          return;
        }
        for (const tx of toImport) {
          await dataClient.entities.Transaction.create({
            type: tx.type === "income" ? "revenue" : "expense",
            amount: Number(tx.amount || 0),
            description: tx.description || tx.vendor || "Transaccion",
            category: tx.category || "other_expense",
            payment_method: "other",
            created_date: tx.date ? new Date(tx.date).toISOString() : new Date().toISOString(),
            notes: JSON.stringify({
              source: "jenai",
              doc_type: "statement",
              file_url: fileUrl,
              vendor: tx.vendor,
              account: extracted.account_name,
            }),
          });
        }
        toast.success(`${toImport.length} transacciones importadas`);
      } else if (docType.id === "invoice") {
        // Create purchase order
        const lineItems = (extracted.line_items || []).map((it, i) => ({
          id: `li-${Date.now()}-${i}`,
          product_name: it.product_name,
          quantity: Number(it.quantity || 1),
          unit_cost: Number(it.unit_cost || 0),
          line_total: Number(it.line_total || (Number(it.unit_cost || 0) * Number(it.quantity || 1))),
        }));
        const poNumber = extracted.invoice_number || `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`;
        await dataClient.entities.PurchaseOrder.create({
          po_number: poNumber,
          supplier_name: extracted.supplier_name || "Sin proveedor",
          status: "draft",
          order_date: extracted.date || new Date().toISOString().slice(0, 10),
          line_items: lineItems,
          subtotal: Number(extracted.subtotal || 0),
          tax_amount: Number(extracted.tax_amount || 0),
          shipping_cost: Number(extracted.shipping_cost || 0),
          total_amount: Number(extracted.total_amount || 0),
          currency: "USD",
          notes: `Importado con Jeani desde factura. 📎 Archivo: ${fileUrl}`,
        });
        toast.success(`Orden de compra creada: ${poNumber}`);
      }
      onSuccess?.();
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Error guardando: " + (err.message || ""));
      setStep("confirm");
    }
  };

  const renderSelectStep = () => (
    <div className="space-y-3">
      <p className="text-sm text-white/60">Que tipo de documento quieres subir?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DOCUMENT_TYPES.map((type) => {
          const c = COLOR_MAP[type.color];
          return (
            <button
              key={type.id}
              onClick={() => handleSelectType(type)}
              className={`${c.bg} ${c.border} border p-4 rounded-2xl text-left transition-all hover:scale-[1.02] active:scale-[0.98]`}
            >
              <div className={`w-10 h-10 rounded-xl ${c.iconBg} flex items-center justify-center mb-3`}>
                <type.icon className={`w-5 h-5 ${c.text}`} />
              </div>
              <p className="text-white font-bold text-sm">{type.label}</p>
              <p className="text-[11px] text-white/40 mt-0.5">{type.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderUploadStep = () => {
    const c = COLOR_MAP[docType.color];
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => { reset(); setStep("select"); }} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/50 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <p className="text-sm font-black text-white">{docType.label}</p>
            <p className="text-[11px] text-white/40">{docType.description}</p>
          </div>
        </div>

        {/* File picker / preview */}
        {!previewUrl ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`w-full border-2 border-dashed ${c.border} ${c.bg} rounded-2xl p-8 flex flex-col items-center justify-center gap-2 hover:bg-white/[0.02] transition-colors`}
          >
            <Camera className={`w-10 h-10 ${c.text}`} />
            <p className={`text-sm font-bold ${c.text}`}>Subir imagen</p>
            <p className="text-[11px] text-white/40">PNG, JPG, WEBP hasta 10MB</p>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/40">
              <img src={previewUrl} alt="Preview" className="w-full max-h-[300px] object-contain" />
              <button
                onClick={() => { setFile(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/70 backdrop-blur text-white flex items-center justify-center hover:bg-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-white/50 text-center">{file?.name} · {(file?.size / 1024).toFixed(0)} KB</p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleClose} className="flex-1 bg-white/5 hover:bg-white/10 text-white h-11 rounded-xl font-bold">
            Cancelar
          </Button>
          <Button
            onClick={handleProcess}
            disabled={!file}
            className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white h-11 rounded-xl font-black disabled:opacity-40"
          >
            <Sparkles className="w-4 h-4 mr-1.5" /> Analizar con Jeani
          </Button>
        </div>
      </div>
    );
  };

  const renderProcessingStep = () => (
    <div className="py-12 flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <Loader2 className="w-12 h-12 text-violet-400 animate-spin" />
        <Sparkles className="w-5 h-5 text-violet-300 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div className="text-center">
        <p className="text-white font-bold">Jeani esta leyendo el documento...</p>
        <p className="text-xs text-white/40 mt-1">Extrayendo monto, proveedor, fecha y categoria</p>
      </div>
    </div>
  );

  const renderConfirmStep = () => {
    if (!extracted) return null;

    // Receipt / Payroll confirmation
    if (docType.id === "receipt" || docType.id === "payroll") {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-emerald-300">
              Jeani detecto los datos. Confidence: <span className="font-black">{extracted.confidence}</span>
            </p>
          </div>
          <div className="space-y-2">
            <EditableField label="Monto" value={extracted.amount} onChange={(v) => setExtracted({ ...extracted, amount: Number(v) })} prefix="$" type="number" />
            <EditableField label={docType.id === "payroll" ? "Empleado" : "Proveedor"} value={extracted.employee_name || extracted.vendor} onChange={(v) => setExtracted({ ...extracted, [docType.id === "payroll" ? "employee_name" : "vendor"]: v })} />
            <EditableField label="Descripcion" value={extracted.description} onChange={(v) => setExtracted({ ...extracted, description: v })} />
            <EditableField label="Fecha" value={extracted.date} onChange={(v) => setExtracted({ ...extracted, date: v })} type="date" />
            <EditableField label="Categoria" value={extracted.category} onChange={(v) => setExtracted({ ...extracted, category: v })} />
          </div>
          {renderConfirmFooter()}
        </div>
      );
    }

    // Statement: show list of transactions with checkboxes
    if (docType.id === "statement") {
      const txs = extracted.transactions || [];
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white">{extracted.account_name || "Estado de cuenta"}</p>
              <p className="text-[11px] text-white/40">{extracted.period} · {txs.length} transacciones</p>
            </div>
            <button
              onClick={() => {
                if (selectedTxs.size === txs.length) setSelectedTxs(new Set());
                else setSelectedTxs(new Set(txs.map((_, i) => i)));
              }}
              className="text-[11px] font-black text-violet-400"
            >
              {selectedTxs.size === txs.length ? "Deseleccionar" : "Seleccionar todo"}
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto space-y-1 bg-black/40 rounded-xl p-2 border border-white/5">
            {txs.map((tx, idx) => (
              <label
                key={idx}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedTxs.has(idx) ? "bg-violet-500/10" : "hover:bg-white/[0.03]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedTxs.has(idx)}
                  onChange={(e) => {
                    const next = new Set(selectedTxs);
                    if (e.target.checked) next.add(idx);
                    else next.delete(idx);
                    setSelectedTxs(next);
                  }}
                  className="w-4 h-4 accent-violet-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-bold truncate">{tx.vendor || tx.description}</p>
                  <p className="text-[10px] text-white/40">{tx.date} · {tx.category || "sin categoria"}</p>
                </div>
                <p className={`text-sm font-black tabular-nums ${tx.type === "income" ? "text-emerald-400" : "text-red-400"}`}>
                  {tx.type === "income" ? "+" : "-"}${Number(tx.amount || 0).toFixed(2)}
                </p>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-white/50 text-center">
            {selectedTxs.size} de {txs.length} seleccionadas para importar
          </p>
          {renderConfirmFooter()}
        </div>
      );
    }

    // Invoice: show line items
    if (docType.id === "invoice") {
      const items = extracted.line_items || [];
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
            <Package className="w-4 h-4 text-amber-400" />
            <div className="flex-1">
              <p className="text-xs text-amber-300 font-bold">{extracted.supplier_name}</p>
              <p className="text-[10px] text-amber-300/70">{extracted.invoice_number} · {extracted.date}</p>
            </div>
            <p className="text-base font-black text-amber-300 tabular-nums">${Number(extracted.total_amount || 0).toFixed(2)}</p>
          </div>
          <div className="max-h-[250px] overflow-y-auto space-y-1 bg-black/40 rounded-xl p-2 border border-white/5">
            {items.map((it, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02]">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-bold truncate">{it.product_name}</p>
                  <p className="text-[10px] text-white/40">
                    {it.quantity} x ${Number(it.unit_cost || 0).toFixed(2)}
                  </p>
                </div>
                <p className="text-sm font-black text-white tabular-nums">${Number(it.line_total || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/50">
            Se creara una orden de compra en estado "borrador" que podras editar.
          </p>
          {renderConfirmFooter()}
        </div>
      );
    }

    return null;
  };

  const renderConfirmFooter = () => (
    <div className="flex gap-2 pt-2">
      <Button onClick={() => setStep("upload")} className="flex-1 bg-white/5 hover:bg-white/10 text-white h-11 rounded-xl font-bold">
        <ArrowLeft className="w-4 h-4 mr-1" /> Volver
      </Button>
      <Button
        onClick={handleSave}
        className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white h-11 rounded-xl font-black"
      >
        <CheckCircle2 className="w-4 h-4 mr-1" /> Confirmar y guardar
      </Button>
    </div>
  );

  const renderSavingStep = () => (
    <div className="py-12 flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-10 h-10 text-violet-400 animate-spin" />
      <p className="text-white font-bold">Guardando...</p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg bg-[#0A0A0A] border border-violet-500/20 rounded-2xl p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-violet-500 to-purple-600" />
        <div className="p-5">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-violet-500/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-400" />
              </div>
              <DialogTitle className="text-lg font-black text-white">Subir con Jeani</DialogTitle>
            </div>
          </DialogHeader>
          {step === "select" && renderSelectStep()}
          {step === "upload" && renderUploadStep()}
          {step === "processing" && renderProcessingStep()}
          {step === "confirm" && renderConfirmStep()}
          {step === "saving" && renderSavingStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditableField({ label, value, onChange, prefix, type = "text" }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-white/[0.02] rounded-xl border border-white/5">
      <label className="text-[10px] font-black text-white/40 uppercase tracking-widest w-24 shrink-0">{label}</label>
      <div className="flex-1 flex items-center gap-1">
        {prefix && <span className="text-sm text-white/60">{prefix}</span>}
        <Input
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent border-0 text-white text-sm h-8 p-1 font-bold"
        />
      </div>
    </div>
  );
}
