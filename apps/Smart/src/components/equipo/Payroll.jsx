import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, Check, Download, Banknote, CreditCard, Smartphone, ArrowLeftRight, FileText } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { Banner, Input, W, money } from "@/components/wizard/ui";
import { safeTZ } from "@/lib/finance/tz";
import {
  loadPayroll, payrollLines, paymentsDiffer, punchesDiffer, hoursLabel, periodRangeLabel, periodContaining, lastClosedPeriod, nextPeriod, previousPeriod, recordPayrollPayment, payrollKindDbLabel, round2,
} from "@/lib/finance/payroll";
import { rolesOf, roleLabels, employeeRate } from "@/lib/teamApi";
import { PAY_METHOD_LABEL, PAY_METHOD_COLOR, buildPayrollReceiptPDF, receiptFileName } from "@/lib/payrollReceipt";
import { sharePdfBlob } from "@/lib/invoicesApi";
import { dayShort } from "./Ponches";
import { shortTime, entryIn } from "@/lib/punchApi";

const BRAND = "#F2662E";
const GREEN = "#4DC780";
const RED = "#FF7373";
const WARN = "#FFA640";
const METHODS = ["cash", "card", "ath_movil", "transfer", "check"];
const METHOD_ICON = { cash: Banknote, card: CreditCard, ath_movil: Smartphone, transfer: ArrowLeftRight, check: FileText };

const Sec = ({ title, children, footer }) => (
  <div className="flex flex-col" style={{ gap: 6 }}>
    {title && <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>{title}</p>}
    <div style={{ borderRadius: 14, background: "#2C2C2E", padding: 14 }}>{children}</div>
    {footer && <p style={{ fontSize: 12, color: W.sub }}>{footer}</p>}
  </div>
);

function MethodPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap" style={{ gap: 8 }}>
      {METHODS.map((m) => { const Icon = METHOD_ICON[m]; const on = value === m; return (
        <button key={m} onClick={() => onChange(m)} className="apple-press flex items-center gap-2" style={{ padding: "9px 14px", borderRadius: 12, background: on ? tint(PAY_METHOD_COLOR[m], 0.2) : "#1C1C1E", border: `1px solid ${on ? PAY_METHOD_COLOR[m] : "transparent"}`, fontSize: 14, fontWeight: 600 }}>
          <Icon className="w-4 h-4" style={{ color: PAY_METHOD_COLOR[m] }} /> {PAY_METHOD_LABEL[m]} {on && <Check className="w-3.5 h-3.5" style={{ color: PAY_METHOD_COLOR[m] }} />}
        </button>
      ); })}
    </div>
  );
}

export function ReceiptDialog({ open, info, tenant, onClose }) {
  const [busy, setBusy] = useState(false);
  if (!info) return null;
  const share = async () => {
    setBusy(true);
    try { await sharePdfBlob(await buildPayrollReceiptPDF({ tenant, ...info }), receiptFileName(info.employeeName), { title: `Comprobante de ${info.employeeName}` }); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={onClose} title="Comprobante" width={420} leading={<span />} trailing={<TextAction bold onClick={onClose}>Listo</TextAction>}>
      <div className="flex flex-col items-center text-center" style={{ gap: 10, paddingTop: 8 }}>
        <span style={{ width: 64, height: 64, borderRadius: 999, background: tint(GREEN, 0.16), color: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}><Check className="w-8 h-8" strokeWidth={3} /></span>
        <p style={{ fontSize: 22, fontWeight: 800 }}>Pago registrado</p>
        <p style={{ fontSize: 16, color: W.sub }}>{info.employeeName} · {money(info.amount)}</p>
        <div className="w-full" style={{ borderRadius: 14, background: "#2C2C2E", padding: "6px 14px", textAlign: "left" }}>
          {[info.hours === null ? null : ["Horas", `${(Number(info.hours) || 0).toFixed(1)} h`], info.hours === null ? null : ["Tarifa", money(info.rate)], ["Método", PAY_METHOD_LABEL[info.method] || info.method], info.periodLabel ? ["Periodo", info.periodLabel] : null].filter(Boolean).map(([k, v]) => <div key={k} className="flex justify-between" style={{ padding: "8px 0", fontSize: 14 }}><span style={{ color: W.sub }}>{k}</span><b>{v}</b></div>)}
        </div>
        <button onClick={share} disabled={busy} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ padding: "13px 0", borderRadius: 14, background: BRAND, color: "#fff", fontWeight: 700 }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Compartir comprobante (PDF)</button>
      </div>
    </Dialog>
  );
}

export function PayEmployeeDialog({ open, employee, tenant, tenantId, onClose, onPaid }) {
  const tz = safeTZ(tenant?.timezone);
  const closed = useMemo(() => lastClosedPeriod("week", tz), [tz, open]);
  const [kind, setKind] = useState("sueldo");
  const [line, setLine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [warn, setWarn] = useState(null);
  const [receipt, setReceipt] = useState(null);

  const loadLine = useCallback(async () => {
    const data = await loadPayroll(tenantId, closed);
    return payrollLines(data, closed).find((l) => l.id === employee.id) || null;
  }, [tenantId, closed, employee?.id]);

  useEffect(() => {
    if (!open || !employee) return;
    setKind("sueldo"); setMethod("cash"); setNotes(""); setError(null); setWarn(null); setReceipt(null); setAmount(""); setLine(null); setLoading(true);
    loadLine().then((l) => { setLine(l); if (l && l.balance > 0) setAmount(l.balance.toFixed(2)); }, (e) => setError(`No se pudo calcular la nómina: ${e?.message || e}`)).finally(() => setLoading(false));
  }, [open, employee?.id]);

  if (!employee) return null;
  const rate = employeeRate(employee);
  const amt = Number(String(amount).replace(",", ".")) || 0;
  const sueldo = kind === "sueldo";
  const periodForPay = sueldo ? closed : periodContaining(new Date(), tz);
  const alreadyPaid = line && (line.salaryPaid - line.proratedPaid > 0.009);
  const canPay = amt > 0 && (!sueldo || !!closed) && !busy && !loading;

  const pay = async (force = false) => {
    if (!canPay || !employee.id) { if (!employee.id) setError("No se pudo identificar al empleado."); return; }
    setBusy(true); setError(null);
    try {
      if (sueldo && !force) {
        const fresh = await loadLine();
        if (fresh && (paymentsDiffer(fresh, line) || punchesDiffer(fresh, line))) {
          if (!amount || Math.abs(amt - (line?.balance || 0)) < 0.005) setAmount(fresh.balance > 0 ? fresh.balance.toFixed(2) : "");
          setLine(fresh);
          setError("Otro dispositivo registró pagos en este período. Revisa antes de registrar.");
          return;
        }
      }
      const label = notes.trim() || (sueldo ? payrollKindDbLabel(closed) : `Adelanto a ${employee.full_name}`);
      const tx = await recordPayrollPayment({ tenantId, employeeId: employee.id, employeeName: employee.full_name, amount: round2(amt), method, notes: label, period: periodForPay, kind: sueldo ? "sueldo" : "adelanto" });
      onPaid?.(tx);
      setReceipt({ employeeName: employee.full_name, role: roleLabels(rolesOf(employee)).join(" · "), hours: sueldo ? line?.hours || 0 : null, rate, method, date: new Date(), periodLabel: periodRangeLabel(periodForPay), amount: round2(amt) });
    } catch (e) {
      setError(e?.message || String(e));
    } finally { setBusy(false); }
  };

  if (receipt) return <ReceiptDialog open={open} info={receipt} tenant={tenant} onClose={() => { setReceipt(null); onClose(); }} />;

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Pagar empleado" width={480} height="92dvh" leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={<TextAction bold onClick={() => pay()} disabled={!canPay}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pagar"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
        <div>
          <div className="grid grid-cols-2" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
            {[["sueldo", "Sueldo"], ["adelanto", "Adelanto"]].map(([k, l]) => <button key={k} onClick={() => { setKind(k); setAmount(k === "sueldo" && line?.balance > 0 ? line.balance.toFixed(2) : ""); }} style={{ padding: "8px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, background: kind === k ? "#636366" : "transparent" }}>{l}</button>)}
          </div>
          <p style={{ fontSize: 12, color: W.sub, marginTop: 6 }}>{sueldo ? `Sueldo de la semana ${periodRangeLabel(closed)}` : "El adelanto se descuenta del sueldo de esta semana."}</p>
        </div>
        {sueldo && line && alreadyPaid && <Banner color={WARN}>Ya hay un pago de sueldo para este período. Verifica antes de pagar de nuevo.</Banner>}
        {sueldo && line && line.overlapCount > 0 && <Banner color={WARN}>{line.overlapCount === 1 ? "Hay 1 ponche encimado en esta semana." : `Hay ${line.overlapCount} ponches encimados en esta semana.`} {hoursLabel(line.overlapHours)} no se pagan.</Banner>}
        {sueldo && line && line.hasUnperiodedPayments && <Banner color={WARN}>Hay un pago sin período cerca de esta semana. Verifica que no sea el sueldo antes de pagar.</Banner>}
        {sueldo && !closed && <Banner color={RED}>No hay un período cerrado para pagar.</Banner>}
        <div className="flex items-center gap-3" style={{ padding: 12, borderRadius: 14, background: "#2C2C2E" }}>
          <span style={{ width: 40, height: 40, borderRadius: 999, background: tint(GREEN, 0.2), color: GREEN, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>{String(employee.full_name || "?").trim().slice(0, 1).toUpperCase()}</span>
          <span className="flex-1"><span className="block" style={{ fontWeight: 700 }}>{employee.full_name}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{money(rate)}/hora</span></span>
        </div>
        {loading ? <div className="flex justify-center" style={{ padding: 16 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: W.sub }} /></div> : sueldo && line && (line.gross > 0 || line.undatedOrders > 0) && (
          <Sec title={`Cálculo · ${periodRangeLabel(closed)}`}>
            {[[`Horas (${hoursLabel(line.hours)} × ${money(rate)})`, money(line.labor)],
              line.overlapHours > 0.009 ? ["Horas encimadas (no se pagan)", `−${hoursLabel(line.overlapHours)} · −${money(line.overlapAmount)}`, RED] : null,
              line.commission > 0 ? [`Comisión (${line.commissionRate}% de ${money(line.commissionBase)})`, money(line.commission)] : null,
              ["Total calculado", money(line.gross), GREEN, true],
              line.salaryPaid > 0 ? ["Ya pagado", `−${money(line.salaryPaid)}`] : null,
              line.totalAdvances > 0 ? ["Adelantos", `−${money(line.totalAdvances)}`] : null,
              ["Por pagar", money(line.balance), "#fff", true],
              line.unperiodedPaid > 0 ? ["Pago sin período", money(line.unperiodedPaid), WARN] : null,
              line.undatedOrders > 0 ? ["Órdenes sin fecha de entrega", String(line.undatedOrders), WARN] : null].filter(Boolean).map(([k, v, c, b]) => <div key={k} className="flex justify-between gap-3" style={{ padding: "5px 0", fontSize: 14 }}><span style={{ color: W.sub }}>{k}</span><span style={{ fontWeight: b ? 800 : 600, color: c || "#fff" }}>{v}</span></div>)}
          </Sec>
        )}
        <Sec title="Monto a pagar" footer="Se registrará como gasto del taller categoría 'Payroll'.">
          <div className="flex items-center gap-2"><span style={{ fontSize: 26, color: W.sub }}>$</span><input value={amount} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) setAmount(r); }} inputMode="decimal" placeholder="0.00" aria-label="Monto" className="bg-transparent outline-none flex-1" style={{ color: "#fff", fontSize: 30, fontWeight: 800, minWidth: 0 }} /></div>
          {sueldo && line && line.balance > 0 && <button onClick={() => setAmount(line.balance.toFixed(2))} className="apple-press" style={{ color: BRAND, fontWeight: 700, fontSize: 13, marginTop: 6 }}>Usar por pagar: {money(line.balance)}</button>}
        </Sec>
        <Sec title="Método de pago"><MethodPicker value={method} onChange={setMethod} /></Sec>
        <Input label="Notas" value={notes} onChange={setNotes} placeholder="Concepto, periodo de pago, etc. (opcional)" />
        {error && <Banner color={RED}>{error}</Banner>}
        {warn && <Banner color={WARN}>{warn}</Banner>}
      </div>
    </Dialog>
  );
}

export function BatchPayrollDialog({ open, onClose, tenant, tenantId, onEditPunches, onDone }) {
  const tz = safeTZ(tenant?.timezone);
  const [kind, setKind] = useState("week");
  const [period, setPeriod] = useState(null);
  const [lines, setLines] = useState(null);
  const [rows, setRows] = useState({});
  const [error, setError] = useState(null);
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [doneMsg, setDoneMsg] = useState(null);
  const [rowErr, setRowErr] = useState(null);
  const reqRef = useRef(0);

  const loadFor = useCallback(async (p) => {
    const token = ++reqRef.current;
    setLines(null); setError(null);
    try {
      const ls = payrollLines(await loadPayroll(tenantId, p), p);
      if (token !== reqRef.current) return;
      ls.sort((a, b) => (a.isOrphan - b.isOrphan) || String(a.employee.full_name || "").localeCompare(String(b.employee.full_name || "")));
      setLines(ls);
      const r = {};
      ls.forEach((l) => { const paid = l.salaryPaid - l.proratedPaid > 0.009; r[l.id] = { amount: l.balance > 0 ? l.balance.toFixed(2) : "", included: l.balance > 0.01 && !paid && !l.hasOverlaps && !l.isOrphan }; });
      setRows(r);
    } catch (e) { if (token === reqRef.current) { setError(e?.message || String(e)); setLines([]); } }
  }, [tenantId]);

  useEffect(() => { if (open) { const p = lastClosedPeriod("week", tz); setKind("week"); setPeriod(p); setMethod("cash"); setDoneMsg(null); setRowErr(null); loadFor(p); } }, [open]);

  const changeKind = (k) => { setKind(k); const p = lastClosedPeriod(k, tz); setPeriod(p); loadFor(p); };
  const go = (p) => { setPeriod(p); loadFor(p); };
  const prev = period ? previousPeriod(period) : null;
  const next = period ? nextPeriod(period) : null;
  const nextClosed = next && next.end <= new Date();
  const isLast = period && lastClosedPeriod(kind, tz).start.getTime() === period.start.getTime();

  const selected = (lines || []).filter((l) => !l.isOrphan && l.employee.id && rows[l.id]?.included && Number(rows[l.id].amount) > 0);
  const total = round2(selected.reduce((s, l) => s + Number(rows[l.id].amount), 0));
  const openEntries = (lines || []).flatMap((l) => l.openEntries.map((e) => ({ l, e })));
  const overlapLines = (lines || []).filter((l) => l.hasOverlaps);
  const overlapTotal = round2(overlapLines.reduce((s, l) => s + l.overlapHours, 0));
  const overlapAmt = round2(overlapLines.reduce((s, l) => s + l.overlapAmount, 0));

  const register = async (force = false) => {
    if (busy || !selected.length) return;
    if (!force) {
      const unperiodedSel = selected.filter((l) => l.hasUnperiodedPayments);
      if (openEntries.length || unperiodedSel.length) {
        setConfirm({ title: unperiodedSel.length ? "Hay pagos sin período" : openEntries.length ? "Hay turnos abiertos" : "Revisa antes de registrar", message: [unperiodedSel.length ? "Algunas filas tienen un pago sin período que podría ser el sueldo." : null, openEntries.length ? "Hay turnos abiertos: esas horas no se cuentan hasta que se cierren." : null].filter(Boolean).join("\n") });
        return;
      }
    }
    setBusy(true); setRowErr(null);
    try {
      const fresh = payrollLines(await loadPayroll(tenantId, period), period);
      const changed = selected.some((l) => { const f = fresh.find((x) => x.id === l.id); return !f || paymentsDiffer(f, l) || punchesDiffer(f, l); });
      if (changed) { await loadFor(period); setError("Los ponches o pagos cambiaron en otro dispositivo. Revisa antes de registrar."); return; }
      let n = 0;
      for (const l of selected) {
        try {
          const tipo = l.labor <= 0 && l.commission > 0 ? "comision" : "sueldo";
          await recordPayrollPayment({ tenantId, employeeId: l.employee.id, employeeName: l.employee.full_name, amount: Number(rows[l.id].amount), method, notes: payrollKindDbLabel(period), period, kind: tipo });
          n += 1;
        } catch (e) { setRowErr(`Error con ${l.employee.full_name}: ${e?.message || e}`); await loadFor(period); return; }
      }
      setDoneMsg(`${n} pago${n === 1 ? "" : "s"} registrado${n === 1 ? "" : "s"} correctamente.`);
      onDone?.();
    } catch (e) { setRowErr(e?.message || String(e)); } finally { setBusy(false); }
  };

  const badge = (t, c) => <span key={t} style={{ padding: "1px 7px", borderRadius: 999, background: tint(c, 0.16), color: c, fontSize: 10, fontWeight: 800 }}>{t}</span>;
  const dayFmt = (d) => dayShort(d, tz);

  return (
    <>
      <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Nómina" width={760} height="92dvh" leading={<span />} trailing={<TextAction bold onClick={onClose} disabled={busy}>Cerrar</TextAction>}
        footer={lines && lines.length ? (
          <div className="flex flex-col" style={{ gap: 10 }}>
            <div className="flex items-center gap-2 flex-wrap"><span style={{ fontSize: 13, color: W.sub }}>Método</span><MethodPicker value={method} onChange={setMethod} /></div>
            <div className="flex items-center justify-between"><span style={{ fontSize: 13, color: W.sub }}>{selected.length} empleado{selected.length === 1 ? "" : "s"} seleccionado{selected.length === 1 ? "" : "s"}</span><b style={{ fontSize: 18 }}>{money(total)}</b></div>
            <button onClick={() => register(false)} disabled={busy || !selected.length} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ padding: "14px 0", borderRadius: 14, background: BRAND, color: "#fff", fontSize: 16, fontWeight: 700 }}>{busy ? <><Loader2 className="w-5 h-5 animate-spin" /> Registrando…</> : selected.length > 1 ? `Registrar ${selected.length} pagos · ${money(total)}` : `Registrar pago · ${money(total)}`}</button>
          </div>
        ) : null}>
        <div className="flex flex-col" style={{ gap: 12, paddingTop: 6 }}>
          <div className="grid grid-cols-3" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
            {[["week", "Semana"], ["quincena", "Quincena"], ["month", "Mes"]].map(([k, l]) => <button key={k} onClick={() => changeKind(k)} style={{ padding: "8px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, background: kind === k ? "#636366" : "transparent" }}>{l}</button>)}
          </div>
          {period && (
            <div className="flex items-center justify-between">
              <button onClick={() => go(prev)} aria-label="Período anterior" className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft className="w-5 h-5" /></button>
              <span className="text-center"><b style={{ fontSize: 17 }}>{periodRangeLabel(period)}</b><span className="block" style={{ fontSize: 12, color: W.sub }}>{isLast ? "Último período cerrado" : "Período anterior"}</span></span>
              <button onClick={() => nextClosed && go(next)} disabled={!nextClosed} aria-label="Período siguiente" className="apple-press disabled:opacity-30" style={{ width: 36, height: 36, borderRadius: 999, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight className="w-5 h-5" /></button>
            </div>
          )}
          {error && <Banner color={RED} onDismiss={() => setError(null)}>{error}</Banner>}
          {rowErr && <Banner color={RED} onDismiss={() => setRowErr(null)}>{rowErr}</Banner>}
          {openEntries.length > 0 && <Banner color={WARN}><b>Hay turnos abiertos</b>{openEntries.slice(0, 4).map(({ l, e }) => <span key={e.id} className="block">{l.employee.full_name} · desde {dayFmt(entryIn(e))} {shortTime(entryIn(e), tz)}</span>)}<span className="block" style={{ marginTop: 4 }}>Esas horas no se cuentan hasta que se cierre el turno.</span></Banner>}
          {overlapLines.length > 0 && (
            <Banner color={RED}><b>Hay ponches encimados</b>
              {overlapLines.flatMap((l) => l.overlaps.map((o) => ({ l, o }))).slice(0, 3).map(({ l, o }) => <span key={o.id} className="block">{l.employee.full_name} · {dayFmt(o.start)} {shortTime(entryIn(o.first), tz)}-{o.first.clock_out ? shortTime(new Date(o.first.clock_out), tz) : "en curso"} y {shortTime(entryIn(o.second), tz)}-{o.second.clock_out ? shortTime(new Date(o.second.clock_out), tz) : "en curso"} · {o.kind === "duplicate" ? `duplicado ${hoursLabel(o.hours)}` : `${hoursLabel(o.hours)} encimadas`}</span>)}
              {overlapLines.reduce((n, l) => n + l.overlaps.length, 0) > 3 && <span className="block">y {overlapLines.reduce((n, l) => n + l.overlaps.length, 0) - 3} más</span>}
              <span className="block" style={{ marginTop: 4 }}>No se pagan dos veces: se descontaron {hoursLabel(overlapTotal)} ({money(overlapAmt)})</span>
              <button onClick={() => onEditPunches?.(overlapLines[0].employee, period)} className="apple-press" style={{ marginTop: 8, padding: "7px 14px", borderRadius: 999, background: RED, color: "#fff", fontWeight: 700, fontSize: 13 }}>Revisar ponches</button>
            </Banner>
          )}
          {lines === null ? <div className="flex items-center justify-center gap-2" style={{ padding: 40, color: W.sub }}><Loader2 className="w-5 h-5 animate-spin" /> Calculando horas…</div>
            : !lines.length ? <div className="text-center" style={{ padding: 30, color: W.sub }}><b style={{ color: "#fff" }}>Sin empleados con horas</b><p style={{ fontSize: 13, marginTop: 4 }}>No hay registros de tiempo para el período seleccionado o ningún empleado tiene tarifa horaria configurada.</p></div>
              : (
                <>
                  <div className="flex" style={{ borderRadius: 16, background: "#1C1C1E", padding: "12px 6px" }}>
                    <div className="flex-1 text-center"><p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>TOTAL A PAGAR</p><p style={{ fontSize: 22, fontWeight: 800, color: BRAND }}>{money(total)}</p></div>
                    <div className="flex-1 text-center" style={{ borderLeft: `0.5px solid ${W.sep}` }}><p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>SELECCIONADOS</p><p style={{ fontSize: 22, fontWeight: 800 }}>{selected.length} de {lines.length}</p></div>
                  </div>
                  <div style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>
                    {lines.map((l, i) => {
                      const r = rows[l.id] || { amount: "", included: false };
                      const paid = l.salaryPaid - l.proratedPaid > 0.009;
                      const partial = l.proratedPaid > 0.009;
                      const info = [l.salaryPaid > 0 ? `Ya pagado ${money(l.salaryPaid)}` : null, l.advances > 0 ? `Adelantos ${money(l.advances)}` : null, l.advanceCarry > 0 ? `Adelanto pendiente ${money(l.advanceCarry)}` : null, l.unperiodedPaid > 0 ? `Pago sin período ${money(l.unperiodedPaid)}` : null, l.undatedOrders > 0 ? `Órdenes sin fecha de entrega: ${l.undatedOrders}` : null].filter(Boolean).join(" · ");
                      return (
                        <div key={l.id} className="flex items-center gap-3" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none", opacity: r.included ? 1 : 0.45 }}>
                          <button onClick={() => !l.isOrphan && setRows((p) => ({ ...p, [l.id]: { ...r, included: !r.included } }))} disabled={l.isOrphan} role="checkbox" aria-checked={r.included} aria-label={`Incluir ${l.employee.full_name}`} style={{ width: 26, height: 26, borderRadius: 8, background: r.included ? BRAND : "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{r.included && <Check className="w-4 h-4" strokeWidth={3} />}</button>
                          <span className="flex-1 min-w-0">
                            <span className="flex items-center gap-2 flex-wrap"><span className="truncate" style={{ fontSize: 15, fontWeight: 700 }}>{l.employee.full_name}</span>
                              {l.hasOverlaps && <button onClick={() => onEditPunches?.(l.employee, period)}>{badge("Encimado", RED)}</button>}
                              {paid && badge("Pagado", GREEN)}{partial && badge("Parcialmente cubierto", WARN)}{l.isOrphan && badge("Sin empleado", RED)}{!l.isOrphan && l.employee.active === false && badge("Inactivo", "#8E8E93")}</span>
                            <span className="block" style={{ fontSize: 12, color: l.hasOverlaps || (l.hours <= 0 && !l.commission) ? RED : W.sub }}>
                              {l.hasOverlaps ? `${hoursLabel(l.hours)} pagables · ${hoursLabel(l.overlapHours)} encimadas (−${money(l.overlapAmount)})` : l.commission > 0 ? `Horas ${money(l.labor)} + comisión ${money(l.commission)}` : l.hours > 0 ? `${hoursLabel(l.hours)} trabajadas` : "Sin horas en el período"}
                            </span>
                            {info && <span className="block" style={{ fontSize: 11, color: l.hasUnperiodedPayments || l.undatedOrders > 0 ? WARN : W.sub }}>{info}</span>}
                          </span>
                          <span style={{ fontSize: 13, color: W.sub, width: 54, textAlign: "right" }}>{hoursLabel(l.hours)}</span>
                          <span className="flex items-center" style={{ background: "#2C2C2E", borderRadius: 10, padding: "0 8px" }}><span style={{ color: W.sub }}>$</span><input value={r.amount} onChange={(e) => { const v = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(v)) setRows((p) => ({ ...p, [l.id]: { ...r, amount: v } })); }} inputMode="decimal" aria-label={`Monto ${l.employee.full_name}`} className="bg-transparent outline-none text-right" style={{ width: 76, color: "#fff", fontSize: 15, fontWeight: 700, padding: "8px 0" }} /></span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
        </div>
      </Dialog>
      <AlertDialog open={!!confirm} title={confirm?.title || ""} message={confirm?.message || ""} onClose={() => setConfirm(null)} actions={[{ label: "Cancelar" }, { label: "Registrar de todos modos", bold: true, onPress: () => register(true) }]} />
      <AlertDialog open={!!doneMsg} title="Nómina registrada" message={doneMsg || ""} onClose={() => { setDoneMsg(null); onClose(); }} actions={[{ label: "Listo", bold: true }]} />
    </>
  );
}

