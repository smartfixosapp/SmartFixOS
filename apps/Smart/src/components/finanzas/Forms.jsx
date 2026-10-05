import { useEffect, useState } from "react";
import { Package, Home, Zap, Megaphone, Hammer, FileText, MoreHorizontal, CheckCircle2, Loader2, AlertTriangle, Trash2, ScanLine, X } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { insertExpense, insertIncome, recentExpenseTemplates, updateExpense, softDeleteTx } from "@/lib/finance/api";
import { money } from "./ui";
import ExpenseReceiptScanner from "./ExpenseReceiptScanner";

export const EXPENSE_CATEGORIES = [
  { id: "supplies", label: "Insumos / Piezas", Icon: Package, color: FP.warning },
  { id: "rent", label: "Renta", Icon: Home, color: FP.vip },
  { id: "utilities", label: "Servicios (luz, agua, internet)", Icon: Zap, color: FP.warning },
  { id: "marketing", label: "Marketing", Icon: Megaphone, color: FP.danger },
  { id: "repairs", label: "Reparaciones del local", Icon: Hammer, color: FP.warning },
  { id: "taxes", label: "Impuestos", Icon: FileText, color: "#8E8E93" },
  { id: "other", label: "Otro", Icon: MoreHorizontal, color: "#8E8E93" },
];

export const PAYROLL_METHODS = [
  ["cash", "Efectivo"], ["card", "Tarjeta"], ["ath_movil", "ATH Móvil"], ["transfer", "Transferencia"], ["check", "Cheque"],
];

const parse = (t) => {
  const n = Number(String(t || "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const dateOnly = (iso) => {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const backdated = (value, timeFrom) => {
  const [y, m, d] = value.split("-").map(Number);
  const base = timeFrom ? new Date(timeFrom) : new Date();
  return new Date(y, m - 1, d, base.getHours(), base.getMinutes(), base.getSeconds(), base.getMilliseconds()).toISOString();
};

function Section({ title, footer, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      {title && <p style={{ fontSize: 12, color: "#8E8E93", textTransform: "uppercase", margin: "0 4px 6px" }}>{title}</p>}
      <div style={{ borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>{children}</div>
      {footer && <p style={{ fontSize: 12, color: "#8E8E93", margin: "6px 4px 0" }}>{footer}</p>}
    </div>
  );
}

const inputStyle = { width: "100%", padding: "12px 14px", background: "transparent", color: "#fff", fontSize: 16, border: "none", outline: "none", colorScheme: "dark" };

function MethodSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={{ ...inputStyle, appearance: "auto" }}>
      {PAYROLL_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  );
}

export function AddExpenseDialog({ open, onClose, tenantId, recordedBy, onSaved }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("supplies");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [recent, setRecent] = useState([]);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [taxAmount, setTaxAmount] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    setAmount(""); setCategory("supplies"); setMethod("cash"); setNotes(""); setDate(todayStr()); setError(null); setSaving(false);
    setReceiptUrl(""); setTaxAmount(0); setScanOpen(false);
    recentExpenseTemplates(tenantId).then(setRecent, () => setRecent([]));
  }, [open, tenantId]);
  const amt = parse(amount);
  const cat = EXPENSE_CATEGORIES.find((c) => c.id === category);
  const taxExceeds = taxAmount > 0 && amt > 0 && taxAmount > amt;
  useEffect(() => { setError(taxExceeds ? "El IVU del recibo no puede ser mayor que el monto del gasto." : null); }, [taxExceeds]);
  const canSubmit = amt > 0 && !saving && !taxExceeds;
  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const body = {
      tenant_id: tenantId, type: "expense", category, amount: amt,
      description: notes.trim() ? notes : cat.label,
      payment_method: method, recorded_by: String(recordedBy || "").trim() || "Usuario",
      tax_amount: taxAmount > 0 ? taxAmount : 0, deductible_tax: taxAmount > 0,
    };
    if (receiptUrl) { body.receipt_url = receiptUrl; body.scanned_at = new Date().toISOString(); }
    if (date !== todayStr()) body.created_at = backdated(date);
    try {
      const tx = await insertExpense(body);
      onSaved?.(tx);
      onClose();
    } catch (e) {
      setError(e?.message || String(e));
      setSaving(false);
    }
  };
  const applyScan = (r) => {
    if (r.amount > 0) setAmount(r.amount.toFixed(2));
    if (r.taxAmount > 0) setTaxAmount(r.taxAmount);
    if (r.date) setDate(r.date > todayStr() ? todayStr() : r.date);
    if (r.vendor) {
      const tag = `${r.vendor}${r.invoiceNumber ? ` · Factura ${r.invoiceNumber}` : ""}`;
      setNotes((prev) => (prev.trim() ? `${tag} — ${prev}` : tag));
    }
    setReceiptUrl(r.receiptUrl || "");
  };
  return (
    <Dialog open={open} onClose={onClose} title="Nuevo gasto" width={620} height="88dvh"
      leading={<TextAction onClick={onClose}>Cancelar</TextAction>}
      trailing={saving ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8E8E93" }} /> : <TextAction bold disabled={!canSubmit} color={canSubmit ? FP.danger : "#8E8E93"} onClick={submit}>Guardar</TextAction>}>
      {recent.length > 0 && (
        <Section title="Gastos recientes">
          <div className="flex gap-2 overflow-x-auto" style={{ padding: 10, scrollbarWidth: "none" }}>
            {recent.map((t) => (
              <button key={t.description} onClick={() => { setAmount(Number.isInteger(t.amount) ? String(t.amount) : t.amount.toFixed(2)); setCategory(t.category); setMethod(t.method); setNotes(t.description); }}
                className="apple-press text-left" style={{ padding: "8px 12px", borderRadius: 10, background: tint(FP.brand, 0.1), flexShrink: 0 }}>
                <span className="block truncate" style={{ fontSize: 12, fontWeight: 600, maxWidth: 160 }}>{t.description}</span>
                <span className="block" style={{ fontSize: 11, color: "#8E8E93" }}>{money(t.amount)}</span>
              </button>
            ))}
          </div>
        </Section>
      )}
      <Section title="Recibo (opcional)">
        {receiptUrl ? (
          <div className="flex items-center gap-3" style={{ padding: "12px 14px" }}>
            <CheckCircle2 className="w-5 h-5" style={{ color: FP.success }} />
            <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Recibo adjunto</span><span className="block" style={{ fontSize: 12, color: "#8E8E93" }}>Smart IA pre-llenó monto, fecha y vendedor</span></span>
            <button onClick={() => { setReceiptUrl(""); setTaxAmount(0); }} aria-label="Quitar recibo" style={{ color: "#8E8E93" }}><X className="w-5 h-5" /></button>
          </div>
        ) : (
          <button onClick={() => setScanOpen(true)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px" }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: tint(FP.brand, 0.16), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><ScanLine className="w-5 h-5" /></span>
            <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Escanear recibo</span><span className="block" style={{ fontSize: 12, color: "#8E8E93" }}>Foto, screenshot o PDF · Smart IA llena los campos</span></span>
          </button>
        )}
      </Section>
      <Section title="Monto" footer={amt > 0 ? `Se registrará como gasto en la categoría '${cat.label}'.` : null}>
        <div style={{ padding: "8px 14px" }}>
          <p style={{ fontSize: 12, color: "#8E8E93" }}>Monto</p>
          <div className="flex items-center gap-1">
            <span style={{ color: "#8E8E93" }}>$</span>
            <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal"
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 20, fontWeight: 700 }} />
          </div>
        </div>
      </Section>
      <Section title="Categoría">
        <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 8, padding: 10 }}>
          {EXPENSE_CATEGORIES.map((c) => {
            const sel = category === c.id;
            return (
              <button key={c.id} onClick={() => setCategory(c.id)} className="apple-press flex items-center gap-2 text-left"
                style={{ padding: "8px 12px", borderRadius: 12, background: sel ? tint(c.color, 0.14) : "rgba(255,255,255,0.04)", border: `1px solid ${sel ? tint(c.color, 0.55) : "rgba(255,255,255,0.08)"}` }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: tint(c.color, 0.18), color: c.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><c.Icon className="w-4 h-4" /></span>
                <span className="flex-1" style={{ fontSize: 14, fontWeight: 600 }}>{c.label}</span>
                {sel && <CheckCircle2 className="w-5 h-5" style={{ color: c.color }} />}
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="Pago y fecha">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div><p style={{ fontSize: 12, color: "#8E8E93", padding: "8px 14px 0" }}>Método de pago</p><MethodSelect value={method} onChange={setMethod} /></div>
          <div><p style={{ fontSize: 12, color: "#8E8E93", padding: "8px 14px 0" }}>Fecha</p><input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} style={inputStyle} /></div>
        </div>
      </Section>
      <Section title="Detalles">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalles del gasto (opcional)" rows={3} style={{ ...inputStyle, resize: "none" }} />
      </Section>
      {error && <p className="flex items-center gap-1.5" style={{ marginTop: 14, fontSize: 14, color: FP.danger }}><AlertTriangle className="w-4 h-4" /> {error}</p>}
      <ExpenseReceiptScanner open={scanOpen} tenantId={tenantId} onClose={() => setScanOpen(false)} onConfirm={applyScan} />
    </Dialog>
  );
}

export function AddIncomeDialog({ open, onClose, tenantId, recordedBy, onSaved }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setAmount(""); setMethod("cash"); setDesc(""); setDate(todayStr()); setSaving(false); setError(null); } }, [open]);
  const amt = parse(amount);
  const canSubmit = amt > 0 && !saving;
  const submit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    const body = {
      tenant_id: tenantId, type: "revenue", category: "other_income", amount: amt,
      description: desc.trim() || "Ingreso manual", payment_method: method,
      recorded_by: String(recordedBy || "").trim() || "Usuario", deductible_tax: false,
    };
    if (date !== todayStr()) body.created_at = backdated(date);
    try {
      const tx = await insertIncome(body);
      onSaved?.(tx);
      onClose();
    } catch (e) {
      setError(e?.message || String(e));
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Nuevo ingreso" width={560}
      leading={<TextAction onClick={onClose}>Cancelar</TextAction>}
      trailing={saving ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8E8E93" }} /> : <TextAction bold disabled={!canSubmit} color={canSubmit ? FP.success : "#8E8E93"} onClick={submit}>Guardar</TextAction>}>
      <Section title="Ingreso">
        <div className="grid grid-cols-1 sm:grid-cols-2">
          <div style={{ padding: "8px 14px" }}>
            <p style={{ fontSize: 12, color: "#8E8E93" }}>Monto</p>
            <div className="flex items-center gap-1">
              <span style={{ color: "#8E8E93" }}>$</span>
              <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: FP.success, fontSize: 20, fontWeight: 700 }} />
            </div>
          </div>
          <div><p style={{ fontSize: 12, color: "#8E8E93", padding: "8px 14px 0" }}>Recibido con</p><MethodSelect value={method} onChange={setMethod} /></div>
        </div>
      </Section>
      <Section title="Detalles">
        <div><p style={{ fontSize: 12, color: "#8E8E93", padding: "8px 14px 0" }}>Fecha</p><input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || todayStr())} style={inputStyle} /></div>
        <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", marginLeft: 14 }} />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripcion del ingreso (opcional)" rows={2} style={{ ...inputStyle, resize: "none" }} />
      </Section>
      {error && <p className="flex items-center gap-1.5" style={{ marginTop: 14, fontSize: 14, color: FP.danger }}><AlertTriangle className="w-4 h-4" /> {error}</p>}
    </Dialog>
  );
}

export function EditExpenseDialog({ tx, onClose, onChanged }) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [method, setMethod] = useState("cash");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState(null);
  const isCustom = !!tx && !EXPENSE_CATEGORIES.some((c) => c.id === tx.category);
  useEffect(() => {
    if (!tx) return;
    const a = Number(tx.amount) || 0;
    setAmount(Number.isInteger(a) ? String(a) : a.toFixed(2));
    setCategory(EXPENSE_CATEGORIES.some((c) => c.id === tx.category) ? tx.category : "other");
    setMethod(PAYROLL_METHODS.some(([k]) => k === tx.payment_method) ? tx.payment_method : "cash");
    setDesc(tx.description || "");
    setDate(dateOnly(tx.created_at));
    setSaving(false); setDeleting(false); setError(null);
  }, [tx]);
  if (!tx) return null;
  const amt = parse(amount);
  const canSave = amt > 0 && !saving && !deleting;
  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const fields = { amount: amt, payment_method: method, description: desc.trim() };
    if (!isCustom) fields.category = category;
    if (date !== dateOnly(tx.created_at)) fields.created_at = backdated(date, tx.created_at);
    try {
      await updateExpense(tx.id, fields);
      onClose();
      onChanged();
    } catch (e) {
      setError(e?.message || String(e));
      setSaving(false);
    }
  };
  const remove = async () => {
    setDeleting(true);
    setError(null);
    try {
      await softDeleteTx(tx.id);
      onClose();
      onChanged();
    } catch (e) {
      setError(e?.message || String(e));
      setDeleting(false);
    }
  };
  return (
    <>
      <Dialog open onClose={onClose} title="Editar gasto" width={520}
        leading={<TextAction onClick={onClose}>Cerrar</TextAction>}
        trailing={saving ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8E8E93" }} /> : <TextAction bold disabled={!canSave} onClick={save}>Guardar</TextAction>}>
        <Section title="Monto">
          <div className="flex items-center gap-1" style={{ padding: "0 14px" }}>
            <span style={{ color: "#8E8E93" }}>$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" style={inputStyle} />
          </div>
        </Section>
        <Section title="Categoría">
          {isCustom ? (
            <div className="flex justify-between" style={{ padding: "12px 14px", fontSize: 16 }}><span>Categoría</span><span style={{ color: "#8E8E93" }}>{String(tx.category || "—").replace(/^\w/, (c) => c.toUpperCase())}</span></div>
          ) : (
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle, appearance: "auto" }}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          )}
        </Section>
        <Section title="Método"><MethodSelect value={method} onChange={setMethod} /></Section>
        <Section title="Descripción"><textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descripción (opcional)" rows={2} style={{ ...inputStyle, resize: "none" }} /></Section>
        <Section title="Fecha"><input type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value || date)} style={inputStyle} /></Section>
        {tx.recorded_by && <Section><div className="flex justify-between" style={{ padding: "12px 14px", fontSize: 16 }}><span>Registrado por</span><span style={{ color: "#8E8E93" }}>{tx.recorded_by}</span></div></Section>}
        {error && <p className="flex items-center gap-1.5" style={{ marginTop: 14, fontSize: 14, color: FP.danger }}><AlertTriangle className="w-4 h-4" /> {error}</p>}
        <div style={{ marginTop: 18 }}>
          <button onClick={() => setConfirm(true)} disabled={deleting || saving} className="w-full flex items-center justify-center gap-2" style={{ padding: 12, borderRadius: 12, background: "#2C2C2E", color: "#FF453A", fontSize: 16 }}>
            {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Borrar gasto</>}
          </button>
        </div>
      </Dialog>
      <AlertDialog open={confirm} title="Borrar este gasto?" message="Esta accion no se puede deshacer." onClose={() => setConfirm(false)}
        actions={[{ label: "Borrar", destructive: true, onPress: remove }, { label: "Cancelar", bold: true }]} />
    </>
  );
}
