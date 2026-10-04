import { useEffect, useRef, useState } from "react";
import { Loader2, ScanLine, FileUp, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Dialog, TextAction } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { scanExpenseReceipt } from "@/lib/finance/receiptScan";

const fieldStyle = { width: "100%", padding: "12px 14px", background: "rgba(255,255,255,0.06)", color: "#fff", fontSize: 16, border: "none", outline: "none", borderRadius: 12 };

export default function ExpenseReceiptScanner({ open, tenantId, onClose, onConfirm }) {
  const [state, setState] = useState("upload");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [amount, setAmount] = useState("");
  const [tax, setTax] = useState("");
  const [vendor, setVendor] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { if (open) { setState("upload"); setError(null); setResult(null); setAmount(""); setTax(""); setVendor(""); } }, [open]);

  const pick = async (file) => {
    if (!file) return;
    setState("processing");
    setError(null);
    try {
      const r = await scanExpenseReceipt(file, tenantId);
      setResult(r);
      setAmount(r.amount > 0 ? r.amount.toFixed(2) : "");
      setTax(r.taxAmount > 0 ? r.taxAmount.toFixed(2) : "");
      setVendor(r.vendor);
      setState("review");
    } catch (e) {
      setError(e?.message || "No se pudo leer el recibo.");
      setState("error");
    }
  };

  const num = (v) => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const use = () => {
    onConfirm({ receiptUrl: result.receiptUrl, amount: num(amount), taxAmount: num(tax), vendor: vendor.trim(), invoiceNumber: result.invoiceNumber, date: result.date });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Escanear recibo" width={520} height="auto" leading={<TextAction onClick={onClose}>Cancelar</TextAction>}
      trailing={state === "review" ? <TextAction bold onClick={use}>Usar datos</TextAction> : null}>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; pick(f); }} />
      {state === "upload" && (
        <div className="flex flex-col items-center text-center" style={{ padding: "28px 16px", gap: 10 }}>
          <ScanLine className="w-12 h-12" style={{ color: FP.brand }} />
          <p style={{ fontSize: 18, fontWeight: 700 }}>Sube el recibo o factura</p>
          <p style={{ fontSize: 14, color: "#8E8E93" }}>Acepta JPG, PNG, PDF · Máximo 10MB</p>
          <button onClick={() => fileRef.current?.click()} className="apple-press flex items-center gap-2" style={{ marginTop: 8, height: 46, padding: "0 22px", borderRadius: 14, background: FP.brand, color: "#fff", fontSize: 16, fontWeight: 700 }}><FileUp className="w-5 h-5" /> Elegir archivo</button>
        </div>
      )}
      {state === "processing" && (
        <div className="flex flex-col items-center text-center" style={{ padding: "48px 16px", gap: 12 }}>
          <Loader2 className="w-9 h-9 animate-spin" style={{ color: FP.brand }} />
          <p style={{ fontSize: 16, fontWeight: 600 }}>Smart IA está leyendo el recibo…</p>
        </div>
      )}
      {state === "error" && (
        <div className="flex flex-col items-center text-center" style={{ padding: "32px 16px", gap: 10 }}>
          <AlertTriangle className="w-10 h-10" style={{ color: FP.danger }} />
          <p style={{ fontSize: 18, fontWeight: 700 }}>No se pudo leer el recibo</p>
          <p style={{ fontSize: 14, color: "#8E8E93" }}>{error}</p>
          <button onClick={() => { setState("upload"); setError(null); }} className="apple-press" style={{ marginTop: 6, height: 44, padding: "0 20px", borderRadius: 14, background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 15, fontWeight: 600 }}>Reintentar</button>
        </div>
      )}
      {state === "review" && (
        <div className="flex flex-col" style={{ gap: 12, padding: "8px 0" }}>
          <p className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 700 }}><CheckCircle2 className="w-5 h-5" style={{ color: FP.success }} /> Smart IA leyó el recibo</p>
          <label className="flex flex-col" style={{ gap: 4 }}><span style={{ fontSize: 12, color: "#8E8E93" }}>Monto</span><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.00" style={fieldStyle} /></label>
          <label className="flex flex-col" style={{ gap: 4 }}><span style={{ fontSize: 12, color: "#8E8E93" }}>IVU/IVA del recibo</span><input value={tax} onChange={(e) => setTax(e.target.value)} inputMode="decimal" placeholder="0.00" style={fieldStyle} /></label>
          <label className="flex flex-col" style={{ gap: 4 }}><span style={{ fontSize: 12, color: "#8E8E93" }}>Vendedor</span><input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Nombre del vendedor" style={fieldStyle} /></label>
          {result?.invoiceNumber && <p style={{ fontSize: 12, color: "#8E8E93" }}>Factura {result.invoiceNumber}</p>}
        </div>
      )}
    </Dialog>
  );
}
