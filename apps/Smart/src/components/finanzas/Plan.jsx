import { useEffect, useRef, useState } from "react";
import { Target, Home, Users, Repeat, SlidersHorizontal, ChevronRight, History, AlertTriangle, Banknote, Clock, BadgeCheck, Share, Loader2, Star, Pencil, Info, CheckCircle2, Gauge, Hourglass, Zap, Package, Megaphone, Hammer, FileText, RefreshCw, Plus, Minus, Trash2 } from "lucide-react";
import { Dialog, TextAction, AlertDialog, ErrorBanner, Toggle, tint } from "@/components/pos/native/posUi";
import { FP, recurringItems, planDailyMinimum, dayHours, num } from "@/lib/finance/ledger";
import { employeeRate } from "@/lib/finance/payroll";
import { money, cardStyle, Empty, KPITile, ActionCard, BigActionRow, downloadText } from "./ui";

const initials = (name) => String(name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";

const ROLE_LABEL = { owner: "Dueño", admin: "Administrador", manager: "Gerente", contable: "Contable", cashier: "Cajero", technician: "Técnico" };
const ROLE_RANK = { owner: 0, admin: 1, manager: 2, contable: 3, cashier: 4, technician: 5 };

export function employeeRoles(emp) {
  const parse = (r) => { const v = String(r || "").trim().toLowerCase(); return ROLE_LABEL[v] ? v : null; };
  const set = [...new Set((Array.isArray(emp?.roles) ? emp.roles : []).map(parse).filter(Boolean))];
  if (set.length) return set;
  const single = parse(emp?.role);
  return single ? [single] : ["technician"];
}

export const displayRoles = (emp) => employeeRoles(emp).sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b]).map((r) => ROLE_LABEL[r]).join(" · ");
export const displayRole = (emp) => ROLE_LABEL[employeeRoles(emp).sort((a, b) => ROLE_RANK[a] - ROLE_RANK[b])[0]];

export async function buildPayrollReceiptPDF(r, tenant) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const L = 40;
  const W = 612;
  const text = (s, x, y, { size = 12, bold = false, color = [0, 0, 0], align = "left" } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(s), x, y, { baseline: "top", align });
  };
  let y = 40;
  text(tenant?.name || "Taller", L, y, { size: 22, bold: true });
  y += 28;
  if (tenant?.address) { text(tenant.address, L, y, { size: 11, color: [85, 85, 85] }); y += 16; }
  doc.setDrawColor(209, 209, 209);
  doc.setLineWidth(0.5);
  doc.line(L, y + 6, W - L, y + 6);
  y += 12 + 16;
  text("COMPROBANTE DE NOMINA", L, y, { size: 18, bold: true });
  const dateText = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(r.paidAt).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  text(dateText, L, y + 22, { size: 11, color: [85, 85, 85] });
  y += 40 + 20;
  text("DETALLE DEL PAGO", L, y, { size: 9, bold: true, color: [128, 128, 128] });
  y += 16;
  const mid = W / 2;
  const row = (l1, v1, l2, v2) => {
    text(l1.toUpperCase(), L, y, { size: 9, bold: true, color: [128, 128, 128] });
    text(v1, L, y + 12, { size: 12, bold: true });
    if (l2) {
      text(l2.toUpperCase(), mid, y, { size: 9, bold: true, color: [128, 128, 128] });
      text(v2, mid, y + 12, { size: 12, bold: true });
    }
    y += 30;
  };
  row("Empleado", r.employeeName, "Rol", r.role || "—");
  row("Horas trabajadas", `${r.hours.toFixed(1)} h`, "Tarifa por hora", `$${r.hourlyRate.toFixed(2)}`);
  row("Metodo de pago", r.method, "Fecha", new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(r.paidAt));
  if (r.periodLabel) row("Periodo", r.periodLabel);
  y += 18;
  doc.setFillColor(242, 242, 242);
  doc.roundedRect(L, y, W - L * 2, 54, 10, 10, "F");
  text("TOTAL PAGADO", L + 16, y + 20, { size: 12, bold: true, color: [85, 85, 85] });
  text(`$${r.total.toFixed(2)}`, W - L - 16, y + 14, { size: 24, bold: true, align: "right" });
  text("Generado con Archilla OS · Este comprobante no sustituye documentos oficiales de nomina.", L, 792 - 50, { size: 9, color: [128, 128, 128] });
  return doc.output("blob");
}

export function PayrollReceiptDialog({ receipt, onClose, onShare }) {
  if (!receipt) return null;
  const line = (l, v) => <div className="flex justify-between" style={{ fontSize: 15 }}><span style={{ color: "#8E8E93" }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span></div>;
  return (
    <Dialog open onClose={onClose} title="Comprobante" width={440} leading={<span />} trailing={<TextAction bold onClick={onClose}>Listo</TextAction>}>
      <div className="flex flex-col items-center" style={{ gap: 12, paddingTop: 12 }}>
        <BadgeCheck className="w-11 h-11" style={{ color: FP.success }} />
        <p style={{ fontSize: 20, fontWeight: 700 }}>Pago registrado</p>
        <p style={{ fontSize: 15, color: "#8E8E93" }}>{receipt.employeeName} · {money(receipt.total)}</p>
        <div className="w-full flex flex-col" style={{ gap: 8, padding: 12, borderRadius: 16, background: "#2C2C2E" }}>
          {line("Horas", `${receipt.hours.toFixed(1)} h`)}
          {line("Tarifa", money(receipt.hourlyRate))}
          {line("Metodo", receipt.method)}
          {receipt.periodLabel && line("Periodo", receipt.periodLabel)}
        </div>
        <button onClick={onShare} className="apple-press w-full flex items-center justify-center gap-2" style={{ padding: "14px 0", borderRadius: 16, background: FP.brand, color: "#fff", fontSize: 16, fontWeight: 600 }}>
          <Share className="w-4 h-4" /> Compartir comprobante (PDF)
        </button>
      </div>
    </Dialog>
  );
}

export function PayrollHistoryDialog({ employee, loader, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!employee) return;
    setLoading(true);
    loader(employee).then(setRows, () => setRows([])).finally(() => setLoading(false));
  }, [employee]);
  if (!employee) return null;
  const labelFor = (pm) => ({ cash: "Efectivo", card: "Tarjeta", ath_movil: "ATH Movil", transfer: "Transferencia" }[pm] || (pm ? pm.charAt(0).toUpperCase() + pm.slice(1) : "Otro"));
  return (
    <Dialog open onClose={onClose} title={employee.full_name} width={460} leading={<TextAction onClick={onClose}>Cerrar</TextAction>} trailing={null}>
      {loading ? <div className="flex flex-col items-center" style={{ padding: 40, gap: 8, color: "#8E8E93" }}><Loader2 className="w-5 h-5 animate-spin" /> Cargando pagos...</div>
        : rows.length === 0 ? <p className="text-center" style={{ padding: 40, color: "#8E8E93" }}>Sin pagos registrados</p>
          : (
            <div style={{ borderRadius: 12, background: "#2C2C2E", marginTop: 8 }}>
              {rows.map((tx, i) => (
                <div key={tx.id} className="flex items-center justify-between" style={{ padding: "10px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600 }}>{tx.created_at ? new Intl.DateTimeFormat("es-PR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(tx.created_at)) : "—"}</p>
                    {tx.payment_method && <p style={{ fontSize: 12, color: "#8E8E93" }}>{labelFor(tx.payment_method)}</p>}
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: FP.vip }}>{money(tx.amount)}</span>
                </div>
              ))}
            </div>
          )}
    </Dialog>
  );
}

const DAY_LABELS = { 1: "Domingo", 2: "Lunes", 3: "Martes", 4: "Miércoles", 5: "Jueves", 6: "Viernes", 7: "Sábado" };
const emptySchedule = () => ({ days: [1, 2, 3, 4, 5, 6, 7].map((w) => ({ weekday: w, enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 })), reminderLeadMinutes: 10, remindersEnabled: false, hourlyRate: 0 });
const fmtHour = (h, m) => `${h === 0 ? 12 : h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}${h >= 12 ? "pm" : "am"}`;
const sameShifts = (a, b) => JSON.stringify(a.days) === JSON.stringify(b.days) && a.reminderLeadMinutes === b.reminderLeadMinutes && a.remindersEnabled === b.remindersEnabled;

export function PayrollEditDialog({ employee, onClose, onSave, refetch }) {
  const [baseline, setBaseline] = useState(employee);
  const [rate, setRate] = useState("");
  const [schedule, setSchedule] = useState(emptySchedule());
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const rateStr = (e) => { const r = employeeRate(e); return r > 0 ? r.toFixed(2) : ""; };
  const schedOf = (e) => (e?.schedule && Array.isArray(e.schedule.days) ? e.schedule : emptySchedule());
  const rateRef = useRef(rate);
  const schedRef = useRef(schedule);
  rateRef.current = rate;
  schedRef.current = schedule;
  const merge = (old, fresh, force) => {
    let conflict = false;
    if (rateRef.current === rateStr(old)) setRate(rateStr(fresh));
    else if (Math.abs(employeeRate(fresh) - employeeRate(old)) > 0.0001) conflict = true;
    if (sameShifts(schedRef.current, schedOf(old))) setSchedule(schedOf(fresh));
    else if (!sameShifts(schedOf(fresh), schedOf(old))) conflict = true;
    if (force || !conflict) setBaseline(fresh);
    return conflict;
  };
  useEffect(() => {
    if (!employee) return undefined;
    let alive = true;
    setBaseline(employee);
    setRate(rateStr(employee));
    setSchedule(schedOf(employee));
    rateRef.current = rateStr(employee);
    schedRef.current = schedOf(employee);
    setLoadError(null);
    setSaveError(null);
    refetch(employee).then((fresh) => {
      if (!alive) return;
      if (!fresh) { setLoadError("Este empleado ya no existe."); return; }
      if (fresh.id !== employee.id) return;
      merge(employee, fresh, false);
    }, () => {});
    return () => { alive = false; };
  }, [employee]);
  if (!employee) return null;
  const parsedRate = Number(String(rate).replace(",", ".")) || 0;
  const weekly = schedule.days.filter((d) => d.enabled).reduce((s, d) => s + dayHours(d), 0);
  const setDay = (w, patch) => setSchedule((s) => ({ ...s, days: s.days.map((d) => (d.weekday === w ? { ...d, ...patch } : d)) }));
  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(baseline, parsedRate, schedule);
      setSaving(false);
      onClose();
    } catch (e) {
      setSaving(false);
      if (e?.fresh) {
        merge(baseline, e.fresh, true);
        setSaveError("Otro dispositivo cambió este empleado. Revisa los datos y guarda de nuevo.");
      } else setSaveError(e?.message || String(e));
    }
  };
  const stepper = (value, set) => (
    <span className="flex" style={{ borderRadius: 8, background: "#3A3A3C", overflow: "hidden" }}>
      <button onClick={() => set(Math.max(0, value - 1))} disabled={value <= 0} aria-label="Menos" className="disabled:opacity-30" style={{ padding: "4px 12px" }}><Minus className="w-4 h-4" /></button>
      <span style={{ width: 0.5, background: "rgba(84,84,88,0.6)" }} />
      <button onClick={() => set(Math.min(23, value + 1))} disabled={value >= 23} aria-label="Más" className="disabled:opacity-30" style={{ padding: "4px 12px" }}><Plus className="w-4 h-4" /></button>
    </span>
  );
  const section = (title, children) => (
    <div style={{ marginTop: 18 }}>
      <p style={{ fontSize: 12, color: "#8E8E93", textTransform: "uppercase", margin: "0 4px 6px" }}>{title}</p>
      <div style={{ borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>{children}</div>
    </div>
  );
  const kv = (l, v) => <div className="flex justify-between" style={{ padding: "12px 14px", fontSize: 16, borderTop: "0.5px solid rgba(84,84,88,0.6)" }}><span>{l}</span><span style={{ color: "#8E8E93" }}>{v}</span></div>;
  return (
    <Dialog open onClose={onClose} title="Nomina y horario" width={560} height="88dvh"
      leading={<TextAction onClick={onClose}>Cancelar</TextAction>}
      trailing={saving ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8E8E93" }} /> : <TextAction bold disabled={!!loadError} onClick={save}>Guardar</TextAction>}>
      {(loadError || saveError) && <div style={{ marginTop: 12 }}><ErrorBanner message={loadError || saveError} /></div>}
      {section("Empleado", <>
        <div className="flex justify-between" style={{ padding: "12px 14px", fontSize: 16 }}><span>Nombre</span><span style={{ color: "#8E8E93" }}>{employee.full_name}</span></div>
        {kv("Rol", displayRoles(employee))}
      </>)}
      {section("Pago", <>
        <div className="flex items-center justify-between" style={{ padding: "8px 14px", fontSize: 16 }}>
          <span>Tarifa por hora</span>
          <span className="flex items-center gap-1"><span style={{ color: "#8E8E93" }}>$</span><input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="0.00" inputMode="decimal" style={{ width: 90, textAlign: "right", background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 16 }} /></span>
        </div>
        {kv("Horas por semana", `${weekly.toFixed(0)} h`)}
        {kv("Pago semanal estimado", money(parsedRate * weekly))}
      </>)}
      {section("Horario", schedule.days.map((d, i) => (
        <div key={d.weekday} className="flex flex-col" style={{ padding: "8px 14px", gap: 6, borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
          <Toggle on={d.enabled} onChange={(v) => setDay(d.weekday, { enabled: v })} label={DAY_LABELS[d.weekday]} />
          {d.enabled && (
            <>
              <div className="flex items-center justify-between" style={{ fontSize: 12 }}><span style={{ color: "#8E8E93" }}>Entrada</span><span className="flex items-center gap-3"><b>{fmtHour(d.startHour, d.startMinute)}</b>{stepper(d.startHour, (v) => setDay(d.weekday, { startHour: v }))}</span></div>
              <div className="flex items-center justify-between" style={{ fontSize: 12 }}><span style={{ color: "#8E8E93" }}>Salida</span><span className="flex items-center gap-3"><b>{fmtHour(d.endHour, d.endMinute)}</b>{stepper(d.endHour, (v) => setDay(d.weekday, { endHour: v }))}</span></div>
              <div className="flex items-center justify-between" style={{ fontSize: 12 }}><span style={{ color: "#8E8E93" }}>Horas</span><b style={{ color: FP.brand }}>{dayHours(d).toFixed(1)} h</b></div>
            </>
          )}
        </div>
      )))}
    </Dialog>
  );
}

const REC_CATS = [
  ["rent", "Renta", FP.vip, Home], ["utilities", "Servicios", FP.warning, Zap], ["supplies", "Insumos", FP.warning, Package],
  ["marketing", "Marketing", FP.danger, Megaphone], ["repairs", "Reparaciones", FP.warning, Hammer], ["taxes", "Impuestos", "#8E8E93", FileText], ["other", "Otro", FP.info, RefreshCw],
];
const recCat = (c) => REC_CATS.find((x) => x[0] === c) || REC_CATS[REC_CATS.length - 1];

function RecurringItemDialog({ open, existing, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("other");
  const [day, setDay] = useState(1);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!open) return;
    setName(existing?.name || "");
    setAmount(existing ? num(existing.amount).toFixed(2) : "");
    setCategory(existing?.category || "other");
    setDay(existing?.day_of_month || 1);
    setNotes(existing?.notes || "");
  }, [open, existing]);
  const amt = Number(String(amount).replace(",", ".")) || 0;
  const ok = name.trim() && amt > 0;
  const submit = () => {
    if (!ok) return;
    const item = { id: existing?.id || (crypto?.randomUUID?.() || String(Date.now())).toUpperCase(), name: name.trim(), amount: amt, category, day_of_month: day };
    if (notes.trim()) item.notes = notes.trim();
    if (existing?.last_confirmed_ym) item.last_confirmed_ym = existing.last_confirmed_ym;
    onSubmit(item);
    onClose();
  };
  const sec = (title, children) => (
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 12, color: "#8E8E93", textTransform: "uppercase", margin: "0 4px 6px" }}>{title}</p>
      <div style={{ borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>{children}</div>
    </div>
  );
  const field = { width: "100%", padding: "12px 14px", background: "transparent", color: "#fff", border: "none", outline: "none", fontSize: 16 };
  return (
    <Dialog open={open} onClose={onClose} title={existing ? "Editar gasto fijo" : "Nuevo gasto fijo"} width={480}
      leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold disabled={!ok} onClick={submit}>{existing ? "Guardar" : "Agregar"}</TextAction>}>
      {sec("Nombre", <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Renta, Internet, Spotify..." style={field} />)}
      {sec("Monto mensual", <div className="flex items-center" style={{ paddingLeft: 14 }}><span style={{ color: "#8E8E93" }}>$</span><input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" style={{ ...field, fontSize: 20, fontWeight: 700 }} /></div>)}
      {sec("Categoría", REC_CATS.map(([k, l, color, Icon], i) => (
        <button key={k} onClick={() => setCategory(k)} className="w-full flex items-center gap-3 text-left" style={{ padding: "8px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
          <span style={{ width: 30, height: 30, borderRadius: 7, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" /></span>
          <span className="flex-1" style={{ fontSize: 16 }}>{l}</span>
          {category === k && <CheckCircle2 className="w-4 h-4" style={{ color: FP.brand }} />}
        </button>
      )))}
      {sec("Día del mes", (
        <div className="flex items-center justify-between" style={{ padding: "8px 14px" }}>
          <span style={{ fontSize: 16 }}>Día {day}</span>
          <span className="flex" style={{ borderRadius: 8, background: "#3A3A3C", overflow: "hidden" }}>
            <button onClick={() => setDay((d) => Math.max(1, d - 1))} disabled={day <= 1} aria-label="Menos" className="disabled:opacity-30" style={{ padding: "6px 14px" }}><Minus className="w-4 h-4" /></button>
            <span style={{ width: 0.5, background: "rgba(84,84,88,0.6)" }} />
            <button onClick={() => setDay((d) => Math.min(28, d + 1))} disabled={day >= 28} aria-label="Más" className="disabled:opacity-30" style={{ padding: "6px 14px" }}><Plus className="w-4 h-4" /></button>
          </span>
        </div>
      ))}
      {sec("Notas (opcional)", <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Proveedor, contrato, etc." style={field} />)}
    </Dialog>
  );
}

export function GastosFijosDialog({ open, onClose, loadItems, applyOp }) {
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    setReady(false);
    setError(null);
    loadItems().then((list) => { if (alive) { setItems(list); setReady(true); } }, () => { if (alive) setError("No se pudieron cargar los gastos fijos. Cierra y vuelve a intentar."); });
    return () => { alive = false; };
  }, [open]);
  const persist = async (op) => {
    if (!ready) return;
    setError(null);
    try { setItems(await applyOp(op)); } catch (e) { setError(`No se pudo guardar: ${e?.message || e}`); }
  };
  return (
    <>
      <Dialog open={open && !adding && !editing} onClose={onClose} title="Gastos Fijos" width={560} height="80dvh" leading={<TextAction onClick={onClose}>Cerrar</TextAction>}
        trailing={<button onClick={() => setAdding(true)} disabled={!ready} aria-label="Agregar" className="disabled:opacity-40" style={{ color: FP.brand }}><Plus className="w-6 h-6" /></button>}>
        {!ready && !error ? <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: "#8E8E93" }} /></div> : !ready ? null : items.length === 0 ? (
          <div className="flex flex-col items-center text-center" style={{ padding: "30px 12px", gap: 10 }}>
            <RefreshCw className="w-11 h-11" style={{ color: FP.brand }} />
            <p style={{ fontSize: 17, fontWeight: 600 }}>Sin gastos fijos</p>
            <p style={{ fontSize: 15, color: "#8E8E93" }}>Agrega renta, internet, luz y otras facturas mensuales para que aparezcan en Finanzas cada mes.</p>
            <button onClick={() => setAdding(true)} className="apple-press w-full flex items-center justify-center gap-2" style={{ padding: "10px 0", borderRadius: 12, background: FP.brand, color: "#fff", fontWeight: 600 }}><Plus className="w-4 h-4" /> Agregar primer gasto</button>
          </div>
        ) : (
          <>
            <div className="flex justify-between" style={{ fontSize: 12, color: "#8E8E93", textTransform: "uppercase", margin: "12px 4px 6px" }}><span>Gastos configurados</span><span>{items.length}</span></div>
            <div style={{ borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>
              {items.map((it, i) => {
                const [, , color, Icon] = recCat(it.category);
                return (
                  <div key={it.id} className="flex items-center gap-3" style={{ padding: "8px 14px", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>
                    <button onClick={() => setEditing(it)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                      <span style={{ width: 36, height: 36, borderRadius: 8, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-4 h-4" /></span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate" style={{ fontSize: 16 }}>{it.name}</span>
                        <span className="block truncate" style={{ fontSize: 12, color: "#8E8E93" }}>Día {it.day_of_month}{it.notes ? ` · ${it.notes}` : ""}</span>
                      </span>
                      <span style={{ fontSize: 15, fontWeight: 600, color: FP.danger }}>{money(it.amount)}</span>
                    </button>
                    <button onClick={() => setConfirmDel(it)} aria-label="Eliminar" style={{ color: FP.danger }}><Trash2 className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: "#8E8E93", margin: "6px 4px 0" }}>Toca para editar · Se confirman cada mes en Finanzas</p>
          </>
        )}
        {error && <p className="flex items-center gap-1.5" style={{ marginTop: 12, fontSize: 14, color: FP.danger }}><AlertTriangle className="w-4 h-4" /> {error}</p>}
      </Dialog>
      <RecurringItemDialog open={open && (adding || !!editing)} existing={editing} onClose={() => { setAdding(false); setEditing(null); }}
        onSubmit={(item) => persist({ type: editing ? "replace" : "add", item })} />
      <AlertDialog open={!!confirmDel} title={`¿Eliminar ${confirmDel?.name || ""}?`} onClose={() => setConfirmDel(null)}
        actions={[{ label: "Eliminar", destructive: true, onPress: () => persist({ type: "remove", item: confirmDel }) }, { label: "Cancelar", bold: true }]} />
    </>
  );
}

export function PlanFinancieroDialog({ open, onClose, tenant, employees, monthRows, todayRows, profitGoal, laborOverride, onProfitGoal, onLaborOverride }) {
  const [edit, setEdit] = useState(null);
  const [value, setValue] = useState("");
  const plan = planDailyMinimum({ tenant, employees, profitGoal, laborOverride });
  const variable = (rows) => rows.filter((t) => t.type === "expense" && ["parts", "supplies"].includes(t.category)).reduce((s, t) => s + num(t.amount), 0);
  const rev = (rows) => rows.filter((t) => t.type === "revenue").reduce((s, t) => s + num(t.amount), 0);
  const monthRevenue = rev(monthRows);
  const monthVariable = variable(monthRows);
  const todayRevenue = rev(todayRows);
  const todayVariable = variable(todayRows);
  const monthNet = monthRevenue - monthVariable;
  const todayNet = todayRevenue - todayVariable;
  const surplus = monthNet - plan.total;
  const m0 = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: tenant?.currency || "USD", maximumFractionDigits: 0 }).format(Math.round(v));
  const bills = recurringItems(tenant).filter((b) => b.amount > 0).sort((a, b) => a.day_of_month - b.day_of_month);
  const card = { ...cardStyle, padding: 16 };
  const brow = (Icon, color, label, sub, v, onClick) => (
    <button onClick={onClick} disabled={!onClick} className="w-full flex items-center gap-2 text-left">
      <Icon className="w-4 h-4" style={{ color, width: 26 }} />
      <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{label}</span><span className="block" style={{ fontSize: 11, color: "#8E8E93" }}>{sub}</span></span>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{m0(v)}</span>
      {onClick && <Pencil className="w-3 h-3" style={{ color: "rgba(235,235,245,0.3)" }} />}
    </button>
  );
  const pct = plan.total > 0 ? Math.min(Math.max(monthNet / plan.total, 0), 1) : 0;
  return (
    <>
      <Dialog open={open && !edit} onClose={onClose} title="Plan financiero" width={620} height="88dvh" leading={<span />} trailing={<TextAction onClick={onClose}>Cerrar</TextAction>}>
        <div className="flex flex-col" style={{ gap: 16, paddingTop: 8 }}>
          <div className="flex flex-col items-center" style={{ ...card, padding: "24px 16px", gap: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "#8E8E93" }}>MÍNIMO DIARIO</p>
            <p style={{ fontSize: 46, fontWeight: 800, color: FP.brand }}>{m0(plan.minimum)}</p>
            <p style={{ fontSize: 12, color: "#8E8E93" }}>para cubrir todo y ganar lo que quieres</p>
          </div>
          <div className="flex flex-col" style={{ ...card, gap: 8 }}>
            <div className="flex justify-between"><span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#8E8E93" }}>HOY</span><span style={{ fontSize: 12, color: "#8E8E93" }}>mínimo {m0(plan.minimum)}</span></div>
            <div className="flex gap-5">
              <div><p style={{ fontSize: 11, color: "#8E8E93" }}>Vendido</p><p style={{ fontSize: 15, fontWeight: 700 }}>{m0(todayRevenue)}</p></div>
              <div><p style={{ fontSize: 11, color: "#8E8E93" }}>Piezas y materiales</p><p style={{ fontSize: 15, fontWeight: 700, color: FP.danger }}>-{m0(todayVariable)}</p></div>
              <div><p style={{ fontSize: 11, color: "#8E8E93" }}>Neta</p><p style={{ fontSize: 15, fontWeight: 700, color: todayNet >= plan.minimum ? FP.success : "#fff" }}>{m0(todayNet)}</p></div>
            </div>
            {todayNet >= plan.minimum
              ? <p className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, color: FP.success }}><CheckCircle2 className="w-4 h-4" /> Mínimo de hoy cumplido</p>
              : <p className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 600, color: FP.warning }}><Gauge className="w-4 h-4" /> Te faltan {m0(plan.minimum - todayNet)} netos hoy</p>}
          </div>
          <div className="flex flex-col" style={{ ...card, gap: 8 }}>
            <div className="flex justify-between"><span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#8E8E93" }}>ESTE MES</span><span style={{ fontSize: 12, fontWeight: 600 }}>{m0(monthNet)} de {m0(plan.total)}</span></div>
            {monthVariable > 0 && <p style={{ fontSize: 11, color: "#8E8E93" }}>Ingresos {m0(monthRevenue)} − piezas y materiales {m0(monthVariable)} = neta {m0(monthNet)}</p>}
            <div style={{ height: 4, borderRadius: 999, background: "#3A3A3C" }}><div style={{ width: `${pct * 100}%`, height: "100%", borderRadius: 999, background: surplus >= 0 ? FP.success : FP.brand }} /></div>
            {surplus >= 0 ? (
              <div className="flex items-start gap-1.5"><BadgeCheck className="w-4 h-4" style={{ color: FP.success }} />
                <div><p style={{ fontSize: 12, color: "#8E8E93" }}>Cubriste gastos, nómina y tu ganancia</p><p style={{ fontSize: 15, fontWeight: 700, color: FP.success }}>Sobrante libre: {m0(surplus)}</p><p style={{ fontSize: 11, color: "#8E8E93" }}>disponible para invertir o ahorrar</p></div>
              </div>
            ) : <p className="flex items-start gap-1.5" style={{ fontSize: 12, color: "#8E8E93" }}><Hourglass className="w-4 h-4" style={{ color: FP.warning }} /> Te falta {m0(-surplus)} para cubrir todo y ganar tu meta este mes.</p>}
          </div>
          <div className="flex flex-col" style={{ ...card, gap: 8 }}>
            {brow(Home, FP.vip, "Gastos fijos", "Renta, luz, internet…", plan.fixed)}
            <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />
            {brow(Users, FP.info, "Nómina (mes)", laborOverride > 0 ? "Manual" : "Auto de tus empleados", plan.labor, () => { setEdit("labor"); setValue(laborOverride > 0 ? String(Math.trunc(laborOverride)) : ""); })}
            <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />
            {brow(Star, FP.success, "Tu ganancia", "Lo que quieres ganar limpio", profitGoal, () => { setEdit("profit"); setValue(profitGoal > 0 ? String(Math.trunc(profitGoal)) : ""); })}
            <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />
            <div className="flex justify-between" style={{ fontSize: 15, fontWeight: 700 }}><span>Total a generar / mes</span><span>{m0(plan.total)}</span></div>
            <div className="flex justify-between" style={{ fontSize: 12 }}><span style={{ color: "#8E8E93" }}>÷ {plan.openDays} días abiertos × ~4.3 semanas</span><b style={{ color: FP.brand }}>= {m0(plan.minimum)}/día</b></div>
          </div>
          {bills.length > 0 && (
            <div className="flex flex-col" style={{ ...card, gap: 8 }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "#8E8E93" }}>PRÓXIMOS PAGOS</p>
              {bills.map((b, i) => (
                <div key={b.id}>
                  {i > 0 && <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", marginBottom: 8 }} />}
                  <div className="flex items-center gap-2"><span className="flex-1" style={{ fontSize: 15, fontWeight: 500 }}>{b.name}</span><span style={{ fontSize: 12, color: "#8E8E93" }}>día {b.day_of_month}</span><span style={{ width: 80, textAlign: "right", fontSize: 15, fontWeight: 600 }}>{m0(b.amount)}</span></div>
                </div>
              ))}
            </div>
          )}
          {plan.labor === 0 && (
            <p className="flex items-start gap-2" style={{ padding: 12, borderRadius: 12, background: tint(FP.info, 0.1), fontSize: 12, color: "#8E8E93" }}>
              <Info className="w-4 h-4" style={{ color: FP.info, flexShrink: 0 }} /> Pon la tarifa por hora y el horario de cada empleado en Ajustes → Empleados, o toca {'"Nómina"'} para ponerla a mano.
            </p>
          )}
        </div>
      </Dialog>
      <Dialog open={open && !!edit} onClose={() => setEdit(null)} title={edit === "profit" ? "Tu ganancia mensual" : "Nómina mensual"} width={440}
        leading={<TextAction onClick={() => setEdit(null)}>Cancelar</TextAction>}
        trailing={<TextAction bold onClick={() => { const v = Number(String(value).replace(/[^\d.]/g, "")) || 0; if (edit === "profit") onProfitGoal(v); else onLaborOverride(v); setEdit(null); }}>Guardar</TextAction>}>
        <p style={{ fontSize: 15, color: "#8E8E93", marginTop: 12 }}>{edit === "profit" ? "Cuánto quieres ganar limpio al mes, encima de cubrir gastos y nómina." : "Déjalo en $0 para calcularla sola de las tarifas de tus empleados."}</p>
        <div className="flex items-center gap-2" style={{ marginTop: 16, padding: 16, borderRadius: 12, background: "#2C2C2E" }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#8E8E93" }}>$</span>
          <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" inputMode="numeric" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 38, fontWeight: 800 }} />
        </div>
      </Dialog>
    </>
  );
}

export default function PlanTab({ p, onPlanFinanciero, onGastosFijos }) {
  const [confirmAll, setConfirmAll] = useState(false);
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <ActionCard Icon={Target} title="Plan financiero" subtitle="Meta del día, mínimo para cubrir gastos" color={FP.entra} onClick={onPlanFinanciero} />
      <ActionCard Icon={Home} title="Gastos fijos" subtitle="Renta, luz, agua y otros que se repiten" color={FP.warning} onClick={onGastosFijos} />
      <div style={{ ...cardStyle }}>
        <div className="flex items-center gap-2" style={{ padding: "12px 12px 8px" }}>
          <Users className="w-5 h-5" style={{ color: FP.nomina }} />
          <div className="flex-1">
            <p style={{ fontSize: 17, fontWeight: 700 }}>Horarios y tarifas</p>
            {p.periodLabel && <p style={{ fontSize: 12, color: "#8E8E93" }}>Semana {p.periodLabel}</p>}
          </div>
          {p.pendingCount > 0 && <span style={{ padding: "3px 8px", borderRadius: 999, background: FP.warning, color: "#fff", fontSize: 12, fontWeight: 700 }}>{p.pendingCount} pendiente{p.pendingCount === 1 ? "" : "s"}</span>}
        </div>
        <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />
        {p.error && <div style={{ padding: 12 }}><ErrorBanner message={p.error} /></div>}
        {p.employees.length === 0 ? <Empty>No hay empleados activos</Empty> : (
          <>
            {!p.error && (
              <div className="grid grid-cols-3" style={{ gap: 8, padding: 12 }}>
                <KPITile label="Planilla semanal" value={p.weeklyTotal} Icon={Banknote} color={FP.nomina} />
                <KPITile label="Por pagar" value={p.pendingTotal} Icon={Clock} color={FP.warning} />
                <div className="flex flex-col" style={{ gap: 4, padding: 12, borderRadius: 12, background: "#2C2C2E" }}>
                  <span className="flex items-center gap-1" style={{ fontSize: 9, fontWeight: 600, color: "#8E8E93" }}><Users className="w-3.5 h-3.5" style={{ color: FP.info }} /> EMPLEADOS</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: FP.info }}>{p.activeCount}</span>
                </div>
              </div>
            )}
            {!p.error && <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />}
            {p.employees.map((emp) => {
              const line = p.lineFor(emp);
              const unknown = p.unavailable;
              const paid = p.isPaid(emp);
              const rate = employeeRate(emp);
              const note = p.noteFor(emp);
              return (
                <div key={emp.id} style={{ borderBottom: "0.5px solid rgba(84,84,88,0.6)" }}>
                  <button onClick={() => p.onEdit(emp)} className="w-full flex items-center gap-3 text-left" style={{ padding: "8px 12px" }}>
                    <span style={{ width: 40, height: 40, borderRadius: 999, background: tint("#BF5AF2", 0.2), color: "#BF5AF2", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{initials(emp.full_name)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1"><span className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{emp.full_name}</span>{p.isRecurring(emp) && <Repeat className="w-3 h-3" style={{ color: FP.vip }} />}</span>
                      <span className="block truncate" style={{ fontSize: 12, color: "#8E8E93" }}>{rate > 0 ? `$${rate.toFixed(2)}/hora` : "Tarifa sin definir"} · {unknown ? "—" : `${(line?.hours || 0).toFixed(1)} h trabajadas`}</span>
                      {note && <span className="block truncate" style={{ fontSize: 11, color: FP.warning }}>{note}</span>}
                    </span>
                    <span className="flex flex-col items-end" style={{ gap: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: paid || unknown ? "#8E8E93" : FP.vip }}>{unknown ? "—" : money(line?.gross || 0)}</span>
                      <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: FP.brand }} />
                    </span>
                    <ChevronRight className="w-3 h-3" style={{ color: "rgba(235,235,245,0.3)" }} />
                  </button>
                  <div className="flex items-center gap-3" style={{ padding: "0 12px 8px" }}>
                    <button onClick={() => p.onHistory(emp)} className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: FP.brand }}><History className="w-3.5 h-3.5" /> Ver pagos</button>
                    {line?.hasOverlaps && <span className="flex items-center gap-1" style={{ fontSize: 12, color: FP.warning }}><AlertTriangle className="w-3.5 h-3.5" /> Ponches encimados</span>}
                    {line?.hasOverlaps && p.onReviewPunches && <button onClick={() => p.onReviewPunches(emp)} className="apple-press" style={{ fontSize: 12, fontWeight: 700, color: FP.brand }}>Revisar ponches</button>}
                    <span className="flex-1" />
                    <span style={{ fontSize: 12, color: "#8E8E93" }}>Pago fijo semanal</span>
                    <button onClick={() => p.setRecurring(emp, !p.isRecurring(emp))} aria-label="Pago fijo semanal" style={{ width: 51, height: 31, borderRadius: 999, background: p.isRecurring(emp) ? "#30D158" : "#3A3A3C", position: "relative", flexShrink: 0 }}>
                      <span style={{ position: "absolute", top: 2, left: p.isRecurring(emp) ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} />
                    </button>
                  </div>
                </div>
              );
            })}
            <BigActionRow label={`Pagar toda la nómina (${money(p.pendingTotal)})`} color={FP.nomina} disabled={p.pendingCount === 0 || p.pendingTotal <= 0 || p.payingAll} onClick={() => setConfirmAll(true)} />
            <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", marginLeft: 12 }} />
            <BigActionRow label="Exportar planilla (CSV)" color={FP.brand} disabled={p.unavailable} onClick={p.exportCSV} />
          </>
        )}
      </div>
      <AlertDialog
        open={confirmAll}
        title={`¿Pagar la nómina a ${p.pendingCount} empleados por ${money(p.pendingTotal)}?`}
        message={[p.pendingNames, p.unperiodedWarning].filter(Boolean).join("\n\n")}
        onClose={() => setConfirmAll(false)}
        actions={[
          ...[["cash", "Efectivo"], ["card", "Tarjeta"], ["ath_movil", "ATH Móvil"], ["transfer", "Transferencia"], ["check", "Cheque"]].map(([k, l]) => ({ label: l, onPress: () => p.payAll(k) })),
          { label: "Cancelar", bold: true },
        ]}
      />
    </div>
  );
}

export function payrollCSV(employees, p) {
  const san = (s) => String(s || "").replace(/,/g, ";").replace(/\n/g, " ").replace(/"/g, "'");
  const rows = ["Empleado,Horas,Tarifa,Total,Estado,Fijo"];
  employees.forEach((emp) => {
    const line = p.lineFor(emp);
    rows.push([san(emp.full_name), (line?.hours || 0).toFixed(1), (line?.rate ?? employeeRate(emp)).toFixed(2), (line?.gross || 0).toFixed(2), p.isPaid(emp) ? "Pagado" : "Pendiente", p.isRecurring(emp) ? "Si" : "No"].join(","));
  });
  downloadText(rows.join("\n"), "Planilla.csv");
}
