import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, CalendarPlus, Send, CircleDollarSign, Pencil, Play, Check, User } from "lucide-react";
import { AlertDialog, tint } from "@/components/pos/native/posUi";
import { Banner, Input, W, money } from "@/components/wizard/ui";
import { safeTZ, zonedParts, zonedDate, startOfDay, addDays, dayString, fmt } from "@/lib/finance/tz";
import { periodContaining, lastClosedWeek, periodRangeLabel, loadPayroll, payrollLines, hoursLabel, detectOverlaps, parsePayrollTag } from "@/lib/finance/payroll";
import { fetchTenantEntries, subscribeTimeEntries, shortTime, entryIn, elapsedHours } from "@/lib/punchApi";
import { fetchEmployeeEntries, fetchPaymentsFor, normalizeSchedule, scheduleSig, scheduleTotal, hoursText, serializeSchedule, sendScheduleEmail } from "@/lib/teamTime";
import { fetchEmployees, patchLocked, rolesOf, isAdminLevel, isActive, roleColor, roleLabels, employeeRate, ConflictError, num } from "@/lib/teamApi";
import { PAY_METHOD_LABEL, PAY_METHOD_COLOR } from "@/lib/payrollReceipt";
import { ScheduleRows, TemplateMenu, SendScheduleDialog, ScheduleBuilderDialog } from "./Schedule";
import { AddPunchDialog, EditHoursDialog, EditPunchesDialog, dayShort } from "./Ponches";
import { PayEmployeeDialog, BatchPayrollDialog } from "./Payroll";

const BRAND = "#F2662E";
const GREEN = "#4DC780";
const RED = "#FF7373";
const WARN = "#FFA640";
const INFO = "#66B3FF";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DOW = ["D", "L", "M", "M", "J", "V", "S"];

function EmployeePanel({ emp: initial, tenant, tenantId, self, onBack, onSaved }) {
  const tz = safeTZ(tenant?.timezone);
  const admin = isAdminLevel(rolesOf(self));
  const sameSelf = !!self && [self.id, self.auth_user_id].some((x) => x && (x === initial.id || x === initial.auth_user_id));
  const restricted = !admin && !sameSelf;
  const [emp, setEmp] = useState(initial);
  const [tab, setTab] = useState("horario");
  const [schedule, setSchedule] = useState(normalizeSchedule(initial.schedule, employeeRate(initial)));
  const [baseSig, setBaseSig] = useState(scheduleSig(normalizeSchedule(initial.schedule, employeeRate(initial))));
  const [rate, setRate] = useState(String(employeeRate(initial) || ""));
  const [commission, setCommission] = useState(String(num(initial.commission_rate) || ""));
  const [line, setLine] = useState(null);
  const [lineErr, setLineErr] = useState(null);
  const [entries, setEntries] = useState([]);
  const [range, setRange] = useState("14d");
  const [payments, setPayments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [punchesScope, setPunchesScope] = useState(null);
  const closed = useMemo(() => lastClosedWeek(tz), [tz]);

  const rangeBounds = useCallback(() => {
    const now = new Date();
    if (range === "week") return { from: periodContaining(now, tz).start, to: new Date(now.getTime() + 60000) };
    if (range === "month") { const p = zonedParts(now, tz); return { from: zonedDate(p.y, p.m, 1, tz), to: new Date(now.getTime() + 60000) }; }
    return { from: addDays(startOfDay(now, tz), -14, tz), to: new Date(now.getTime() + 60000) };
  }, [range, tz]);

  const refresh = useCallback(async () => {
    try {
      const { from, to } = rangeBounds();
      const [es, pays] = await Promise.all([fetchEmployeeEntries({ tenantId, employee: emp, from, to }), fetchPaymentsFor(tenantId, emp.id)]);
      setEntries(es.sort((a, b) => entryIn(b) - entryIn(a)));
      setPayments(pays);
    } catch (e) { setError(e?.message || String(e)); }
    try {
      const ls = payrollLines(await loadPayroll(tenantId, closed), closed);
      setLine(ls.find((l) => l.id === emp.id) || null);
      setLineErr(null);
    } catch (e) { setLineErr(e?.message || String(e)); }
  }, [tenantId, emp.id, closed, rangeBounds]);

  useEffect(() => { refresh(); const t = setInterval(refresh, 90000); return () => clearInterval(t); }, [refresh]);

  const dirtySchedule = scheduleSig(schedule) !== baseSig;
  const rateNum = Math.max(0, Number(String(rate).replace(",", ".")) || 0);
  const commNum = Math.max(0, Number(String(commission).replace(",", ".")) || 0);
  const rateChanged = Math.abs(rateNum - employeeRate(emp)) > 0.0001;
  const commChanged = Math.abs(commNum - num(emp.commission_rate)) > 0.0001;

  const buildPatch = () => {
    const f = {};
    if (rateChanged || (emp.hourly_rate === null || emp.hourly_rate === undefined) && rateNum > 0) f.hourly_rate = rateNum;
    if (dirtySchedule || (rateChanged && emp.schedule)) f.schedule = serializeSchedule(schedule, rateNum);
    if (commChanged) f.commission_rate = commNum;
    return f;
  };

  const adopt = (upd, notify = true) => {
    setEmp(upd);
    const s = normalizeSchedule(upd.schedule, employeeRate(upd));
    setSchedule(s); setBaseSig(scheduleSig(s)); setRate(String(employeeRate(upd) || "")); setCommission(String(num(upd.commission_rate) || ""));
    if (notify) onSaved?.(upd);
  };

  const mergeFresh = (fresh) => {
    setEmp(fresh);
    if (!dirtySchedule) { const s = normalizeSchedule(fresh.schedule, employeeRate(fresh)); setSchedule(s); setBaseSig(scheduleSig(s)); }
    if (!rateChanged) setRate(String(employeeRate(fresh) || ""));
    if (!commChanged) setCommission(String(num(fresh.commission_rate) || ""));
    onSaved?.(fresh);
  };

  useEffect(() => {
    if (initial.updated_at !== emp.updated_at && !dirtySchedule && !rateChanged && !commChanged) adopt(initial, false);
  }, [initial.updated_at]);

  const save = async () => {
    if (busy) return;
    if (restricted && (rateChanged || commChanged)) { setError("Solo el dueño o un administrador puede cambiar rol, correo, tarifa o estado."); return null; }
    const f = buildPatch();
    if (!Object.keys(f).length) { setNotice("Sin cambios"); return emp; }
    setBusy(true); setError(null);
    try { const upd = await patchLocked(emp, f); adopt(upd); setNotice("Cambios guardados"); return upd; } catch (e) {
      if (e instanceof ConflictError && e.fresh) mergeFresh(e.fresh);
      setError(e?.message || String(e));
      return null;
    } finally { setBusy(false); }
  };

  const saveAndSend = async () => {
    const f = buildPatch();
    if (Object.keys(f).length) { const upd = await save(); if (!upd) return; }
    setSendOpen(true);
  };

  const weekNow = periodContaining(new Date(), tz);
  const weekEntries = entries.filter((e) => weekNow.contains(entryIn(e)));
  const weekDet = detectOverlaps(weekEntries.filter((e) => e.clock_out));
  const hours7 = hoursLabel(Math.max(0, weekDet.rawHours - weekDet.overlapHours) + weekEntries.filter((e) => !e.clock_out).reduce((s, e) => s + elapsedHours(e), 0));
  const first = String(emp.full_name || "").trim().split(/\s+/)[0] || "";
  const paid = line && (line.salaryPaid - line.proratedPaid > 0.009);
  const totalPays = payments.reduce((s, p) => s + num(p.amount), 0);
  const seg = (k, l) => <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, background: tab === k ? "#636366" : "transparent" }}>{l}</button>;

  return (
    <div className="flex flex-col" style={{ gap: 14, padding: 16 }}>
      {onBack && <button onClick={onBack} className="apple-press flex items-center gap-1 self-start" style={{ color: BRAND, fontWeight: 600 }}><ChevronLeft className="w-5 h-5" /> Nómina y Horario</button>}
      <div className="flex items-center gap-3">
        <span style={{ width: 52, height: 52, borderRadius: 999, background: tint(roleColor(emp), 0.2), color: roleColor(emp), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>{String(emp.full_name || "?").trim().slice(0, 1).toUpperCase()}</span>
        <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 22, fontWeight: 800 }}>{emp.full_name}</span><span className="block" style={{ fontSize: 12, color: roleColor(emp), fontWeight: 600 }}>{roleLabels(rolesOf(emp)).join(" · ")}</span></span>
        <button onClick={save} disabled={busy} className="apple-press disabled:opacity-50" style={{ padding: "9px 18px", borderRadius: 999, background: BRAND, color: "#fff", fontWeight: 700 }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</button>
      </div>
      {error && <Banner color={RED} onDismiss={() => setError(null)}>{error}</Banner>}
      {notice && <Banner color={GREEN} onDismiss={() => setNotice(null)}>{notice}</Banner>}

      <div style={{ padding: 14, borderRadius: 16, background: "#1C1C1E" }}>
        <div className="flex">
          <div className="flex-1 text-center"><p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>HORAS</p><p style={{ fontSize: 24, fontWeight: 800 }}>{line ? hoursLabel(line.hours) : "—"}</p></div>
          <div className="flex-1 text-center" style={{ borderLeft: `0.5px solid ${W.sep}` }}><p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>POR PAGAR</p><p style={{ fontSize: 24, fontWeight: 800, color: line && line.balance > 0 ? GREEN : W.sub }}>{line && line.balance > 0 ? money(line.balance) : "—"}</p></div>
        </div>
        <p className="text-center" style={{ fontSize: 12, color: W.sub, marginTop: 8 }}>Semana cerrada: {periodRangeLabel(closed)}</p>
        <div className="flex flex-col" style={{ gap: 6, marginTop: 8 }}>
          {lineErr && <Banner color={RED}>{lineErr}</Banner>}
          {line && line.openEntries.length > 0 && <Banner color={WARN}>Hay turnos abiertos en esa semana. Ciérralos antes de pagar.</Banner>}
          {line && line.hasUnperiodedPayments && <Banner color={WARN}>Hay un pago sin período cerca de esta semana. Verifica que no sea el sueldo antes de pagar.</Banner>}
          {line && line.overlapCount > 0 && <Banner color={WARN}>{line.overlapCount === 1 ? "Hay 1 ponche encimado en esa semana" : `Hay ${line.overlapCount} ponches encimados en esa semana`} ({hoursLabel(line.overlapHours)} no se cuentan). <button onClick={() => setTab("ponches")} style={{ textDecoration: "underline", fontWeight: 700 }}>Revisar</button></Banner>}
        </div>
        {admin && <button onClick={() => setPayOpen(true)} className="apple-press w-full" style={{ marginTop: 10, padding: "13px 0", borderRadius: 14, background: BRAND, color: "#fff", fontWeight: 700, fontSize: 16 }}>{paid ? `Pagar de nuevo a ${first}` : `Pagar a ${first}`}</button>}
      </div>

      <div className="grid grid-cols-3" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>{seg("horario", "Horario")}{seg("ponches", "Ponches")}{seg("pagos", "Pagos")}</div>

      {tab === "horario" && (
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div className="flex items-center justify-between"><p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Horario del empleado</p>{admin && <TemplateMenu schedule={schedule} onChange={setSchedule} />}</div>
          <div style={{ pointerEvents: admin ? "auto" : "none", opacity: admin ? 1 : 0.7 }}><ScheduleRows schedule={schedule} onChange={setSchedule} /></div>
          {admin && <button onClick={saveAndSend} disabled={busy} className="apple-press w-full disabled:opacity-50" style={{ padding: "13px 0", borderRadius: 14, background: dirtySchedule ? BRAND : "#3A3A3C", color: "#fff", fontWeight: 700 }}>{dirtySchedule ? "Guardar y enviar horario" : sent ? "Horario enviado" : "Enviar horario (WhatsApp/SMS/Email)"}</button>}
          <div className="flex justify-between" style={{ fontSize: 14 }}><span>Total: {hoursText(scheduleTotal(schedule))}/sem</span><b style={{ color: GREEN }}>≈ {money(scheduleTotal(schedule) * rateNum)}/sem</b></div>
        </div>
      )}

      {tab === "ponches" && (
        <div className="flex flex-col" style={{ gap: 10 }}>
          <div className="flex items-center gap-2 flex-wrap">
            {admin && <button onClick={() => setAddOpen(true)} className="apple-press" style={{ padding: "8px 14px", borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND, fontWeight: 700, fontSize: 13 }}>Añadir ponche</button>}
            <span className="flex-1" />
            <select value={range} onChange={(e) => setRange(e.target.value)} aria-label="Rango" style={{ background: "#2C2C2E", color: "#fff", borderRadius: 10, padding: "8px 10px", fontSize: 13, colorScheme: "dark" }}><option value="week">Esta semana</option><option value="14d">14 días</option><option value="month">Este mes</option></select>
          </div>
          {!entries.length ? <p className="text-center" style={{ padding: 24, color: W.sub }}>Sin ponches en {range === "week" ? "esta semana" : range === "month" ? "este mes" : "los últimos 14 días"}</p> : (
            <div style={{ borderRadius: 14, background: "#1C1C1E", overflow: "hidden" }}>
              {(() => { const ov = detectOverlaps(entries).overlaps; const flag = new Map(); ov.forEach((o) => { [o.first, o.second].forEach((e) => flag.set(e.id, o.kind === "duplicate" ? ["Duplicado", RED] : ["Encimado", WARN])); });
                return entries.map((e, i) => { const f = flag.get(e.id); const open = !e.clock_out; return (
                  <button key={e.id} onClick={() => admin && setEditEntry(e)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "11px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
                    <span style={{ width: 30, height: 30, borderRadius: 999, background: tint(open ? INFO : GREEN, 0.18), color: open ? INFO : GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}>{open ? <Play className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" strokeWidth={3} />}</span>
                    <span className="flex-1 min-w-0"><span className="flex items-center gap-2 flex-wrap"><b style={{ fontSize: 14 }}>{dayShort(entryIn(e), tz)}</b>{f && <span style={{ padding: "1px 8px", borderRadius: 999, background: tint(f[1], 0.16), color: f[1], fontSize: 10, fontWeight: 800 }}>{f[0]}</span>}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{shortTime(entryIn(e), tz)} → {open ? "abierta" : shortTime(new Date(e.clock_out), tz)}</span></span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: open ? WARN : "#fff" }}>{hoursLabel(elapsedHours(e))}</span>
                    {admin && <Pencil className="w-3.5 h-3.5" style={{ color: W.sub }} />}
                  </button>); }); })()}
            </div>
          )}
          <p style={{ fontSize: 13, color: W.sub }}>Esta semana: {hours7}</p>
        </div>
      )}

      {tab === "pagos" && (
        <div className="flex flex-col" style={{ gap: 14 }}>
          <div style={{ padding: 14, borderRadius: 16, background: "#1C1C1E" }}>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase", marginBottom: 8 }}>Compensación</p>
            <div className="flex flex-col" style={{ gap: 10 }}>
              <Input label="Pago por hora ($)" value={rate} onChange={(v) => /^\d*[.,]?\d{0,2}$/.test(v) && setRate(v)} inputMode="decimal" disabled={restricted} />
              <Input label="Comisión por orden (%)" value={commission} onChange={(v) => /^\d*[.,]?\d{0,1}$/.test(v) && setCommission(v)} inputMode="decimal" disabled={restricted} />
            </div>
            <p style={{ fontSize: 12, color: W.sub, marginTop: 8 }}>Pago/hora para payroll · Comisión aplicada al total de órdenes entregadas asignadas al técnico.</p>
          </div>
          <div className="flex items-center justify-between"><p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Pagos recientes</p><b style={{ color: GREEN }}>Total: {money(totalPays)}</b></div>
          {!payments.length ? <p className="text-center" style={{ padding: 20, color: W.sub }}>Sin pagos registrados aún</p> : (
            <div style={{ borderRadius: 14, background: "#1C1C1E", overflow: "hidden" }}>
              {payments.map((p, i) => { const tag = parsePayrollTag(p.description, tz); const kindLabel = tag.kind === "adelanto" ? "Adelanto" : tag.kind === "comision" ? "Comisión" : "Sueldo"; const color = PAY_METHOD_COLOR[p.payment_method] || W.sub; return (
                <div key={p.id} className="flex items-center gap-3" style={{ padding: "11px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
                  <span style={{ width: 34, height: 34, borderRadius: 999, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center" }}><CircleDollarSign className="w-4 h-4" /></span>
                  <span className="flex-1 min-w-0"><b style={{ color: GREEN }}>{money(num(p.amount))}</b> <span style={{ fontSize: 12, color: W.sub }}>{PAY_METHOD_LABEL[p.payment_method] || p.payment_method}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{kindLabel}{tag.periodStart ? ` · ${fmt(tag.periodStart, tz, { day: "numeric", month: "short" })} – ${fmt(addDays(tag.periodEnd, -1, tz), tz, { day: "numeric", month: "short" })}` : ""}</span></span>
                  <span style={{ fontSize: 12, color: W.sub }}>{fmt(new Date(p.created_at), tz, { day: "numeric", month: "short" })}</span>
                </div>
              ); })}
            </div>
          )}
        </div>
      )}

      <SendScheduleDialog open={sendOpen} employee={emp} schedule={schedule} tenant={tenant} tenantId={tenantId} onClose={() => setSendOpen(false)} onSent={() => setSent(true)} />
      <AddPunchDialog open={addOpen} employee={emp} self={self} tenant={tenant} tenantId={tenantId} onClose={() => setAddOpen(false)} onSaved={() => refresh()} />
      <EditHoursDialog open={!!editEntry} entry={editEntry} self={self} tenant={tenant} tenantId={tenantId} employees={[emp]} onClose={() => setEditEntry(null)} onDone={() => refresh()} />
      <PayEmployeeDialog open={payOpen} employee={emp} tenant={tenant} tenantId={tenantId} onClose={() => { setPayOpen(false); refresh(); }} onPaid={() => refresh()} />
      <EditPunchesDialog open={!!punchesScope} scope={punchesScope} tenant={tenant} tenantId={tenantId} self={self} onClose={() => { setPunchesScope(null); refresh(); }} />
    </div>
  );
}

export default function Nomina({ tenant, tenantId, self }) {
  const tz = safeTZ(tenant?.timezone);
  const admin = isAdminLevel(rolesOf(self));
  const [employees, setEmployees] = useState(null);
  const [month, setMonth] = useState(() => { const p = zonedParts(new Date(), safeTZ(tenant?.timezone)); return { y: p.y, m: p.m }; });
  const [entries, setEntries] = useState([]);
  const [weekEntries, setWeekEntries] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selectedDay, setSelectedDay] = useState(() => dayString(new Date(), safeTZ(tenant?.timezone)));
  const [error, setError] = useState(null);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [massOpen, setMassOpen] = useState(false);
  const [massMsg, setMassMsg] = useState(null);
  const [massBusy, setMassBusy] = useState(false);
  const [punchScope, setPunchScope] = useState(null);
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1000px)").matches);
  const monthSeq = useRef(0);

  useEffect(() => {
    const m = window.matchMedia("(min-width: 1000px)");
    const on = () => setDesktop(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  const loadEmployees = useCallback(() => fetchEmployees(tenantId).then(setEmployees, (e) => { setError(e?.message || String(e)); setEmployees((p) => p || []); }), [tenantId]);
  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const loadMonth = useCallback(async () => {
    const seq = ++monthSeq.current;
    try {
      const from = zonedDate(month.y, month.m, 1, tz);
      const to = month.m === 12 ? zonedDate(month.y + 1, 1, 1, tz) : zonedDate(month.y, month.m + 1, 1, tz);
      const week = periodContaining(new Date(), tz);
      const [es, ws] = await Promise.all([fetchTenantEntries({ tenantId, from, to }), fetchTenantEntries({ tenantId, from: week.start, to: new Date(Date.now() + 60000) })]);
      if (seq !== monthSeq.current) return;
      setEntries(es); setWeekEntries(ws); setError(null);
    } catch (e) { if (seq === monthSeq.current) setError(e?.message || String(e)); }
  }, [tenantId, month.y, month.m, tz]);
  useEffect(() => { loadMonth(); }, [loadMonth]);
  useEffect(() => subscribeTimeEntries(tenantId, loadMonth), [tenantId, loadMonth]);

  const active = useMemo(() => (employees || []).filter(isActive), [employees]);
  const matches = useCallback((e) => {
    if (filter === "all") return true;
    const emp = active.find((x) => x.id === filter);
    if (!emp) return true;
    return [emp.id, emp.auth_user_id].includes(e.employee_id) || e.employee_name === emp.full_name;
  }, [filter, active]);

  const byDay = useMemo(() => {
    const map = {};
    entries.filter(matches).forEach((e) => { const k = dayString(entryIn(e), tz); (map[k] = map[k] || []).push(e); });
    return map;
  }, [entries, matches, tz]);
  const dayTotal = (k) => (byDay[k] || []).reduce((s, e) => s + elapsedHours(e), 0);

  const first = zonedDate(month.y, month.m, 1, tz);
  const startPad = zonedParts(first, tz).weekday - 1;
  const daysIn = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate();
  const todayKey = dayString(new Date(), tz);
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: daysIn }, (_, i) => i + 1)];
  const keyOf = (d) => `${String(month.y).padStart(4, "0")}-${String(month.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const weekHours = (emp) => {
    const es = weekEntries.filter((e) => [emp.id, emp.auth_user_id].includes(e.employee_id));
    const det = detectOverlaps(es.filter((e) => e.clock_out));
    return Math.max(0, det.rawHours - det.overlapHours) + es.filter((e) => !e.clock_out).reduce((s, e) => s + elapsedHours(e), 0);
  };

  const shiftMonth = (d) => setMonth((p) => { let m = p.m + d; let y = p.y; if (m < 1) { m = 12; y -= 1; } if (m > 12) { m = 1; y += 1; } return { y, m }; });

  const massRecipients = async () => {
    const fresh = await fetchEmployees(tenantId);
    return fresh.filter((e) => isActive(e) && String(e.email || "").trim() && e.schedule);
  };
  const sendMass = async () => {
    setMassBusy(true);
    try {
      const rec = await massRecipients();
      if (!rec.length) { setMassMsg("Ningún empleado tiene email + horario configurado."); return; }
      let sent = 0;
      for (const e of rec) { try { if (await sendScheduleEmail({ tenant, tenantId, employee: e, schedule: normalizeSchedule(e.schedule, employeeRate(e)), url: null })) sent += 1; } catch { continue; } }
      setMassMsg(`Horario enviado por email a ${sent} de ${rec.length} empleado(s).`);
    } finally { setMassBusy(false); }
  };

  const hub = (
    <div className="flex flex-col" style={{ gap: 14 }}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1" style={{ fontSize: 26, fontWeight: 800 }}>Nómina y Horario</h2>
        {admin && <>
          <button onClick={() => setBuilderOpen(true)} aria-label="Crear horario" title="Crear horario" className="apple-press flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND }}><CalendarPlus className="w-5 h-5" /></button>
          <button onClick={() => setMassOpen(true)} aria-label="Enviar horarios" title="Enviar horarios" className="apple-press flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND }}><Send className="w-5 h-5" /></button>
          <button onClick={() => setBatchOpen(true)} aria-label="Nómina" title="Nómina" className="apple-press flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: tint("#FFC733", 0.16), color: "#FFC733" }}><CircleDollarSign className="w-5 h-5" /></button>
        </>}
      </div>
      {error && <Banner color={RED} onDismiss={() => setError(null)}>{error}</Banner>}
      <div style={{ padding: 14, borderRadius: 16, background: "#1C1C1E" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <User className="w-4 h-4" style={{ color: W.sub }} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar por empleado" className="flex-1" style={{ background: "transparent", color: "#fff", fontSize: 15, colorScheme: "dark" }}><option value="all">Todos</option>{active.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select>
        </div>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <button onClick={() => shiftMonth(-1)} aria-label="Mes anterior" className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft className="w-4 h-4" /></button>
          <b style={{ fontSize: 17 }}>{MONTHS[month.m - 1]} {month.y}</b>
          <button onClick={() => shiftMonth(1)} aria-label="Mes siguiente" className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight className="w-4 h-4" /></button>
        </div>
        <div className="grid grid-cols-7" style={{ gap: 4 }}>
          {DOW.map((d, i) => <span key={i} className="text-center" style={{ fontSize: 11, color: W.sub, fontWeight: 700 }}>{d}</span>)}
          {cells.map((d, i) => { if (!d) return <span key={`p${i}`} />; const k = keyOf(d); const h = dayTotal(k); const sel = k === selectedDay; const today = k === todayKey; return (
            <button key={k} onClick={() => setSelectedDay(k)} className="apple-press flex flex-col items-center justify-center" style={{ minHeight: 46, borderRadius: 10, background: sel ? BRAND : h > 0 ? tint(GREEN, 0.12) : "transparent", border: `1px solid ${today && !sel ? BRAND : "transparent"}`, color: sel ? "#fff" : "#fff" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>{d}</span>{h > 0 && <span style={{ fontSize: 10, color: sel ? "#fff" : GREEN, fontWeight: 700 }}>{Math.round(h * 10) / 10}h</span>}
            </button>); })}
        </div>
      </div>
      <div style={{ padding: 14, borderRadius: 16, background: "#1C1C1E" }}>
        {(() => { const list = (byDay[selectedDay] || []).sort((a, b) => entryIn(a) - entryIn(b)); const [y, m, d] = selectedDay.split("-").map(Number); const title = fmt(zonedDate(y, m, d, tz, 12), tz, { weekday: "long", day: "numeric", month: "long" }).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
          return (<>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}><b>{title}</b><b style={{ color: GREEN }}>{hoursLabel(dayTotal(selectedDay))}</b></div>
            {!list.length ? <p style={{ color: W.sub, fontSize: 14 }}>Sin ponches este día</p> : list.map((e) => <div key={e.id} className="flex items-center" style={{ padding: "7px 0", fontSize: 14, gap: 8 }}><span className="flex-1 min-w-0 truncate">{e.employee_name}</span><span style={{ color: W.sub }}>{shortTime(entryIn(e), tz)} – {e.clock_out ? shortTime(new Date(e.clock_out), tz) : "en curso"}</span><b style={{ color: e.clock_out ? "#fff" : WARN, minWidth: 54, textAlign: "right" }}>{hoursLabel(elapsedHours(e))}</b></div>)}
          </>); })()}
      </div>
      <div>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase", marginBottom: 8 }}>Horas esta semana · toca para horario y pago</p>
        {employees === null ? <div className="flex justify-center" style={{ padding: 20 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: W.sub }} /></div> : !active.length ? <p style={{ color: W.sub }}>Sin empleados activos</p> : (
          <div style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>
            {active.map((e, i) => <button key={e.id} onClick={() => setSelectedEmp(e)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "11px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none", background: desktop && selectedEmp?.id === e.id ? "rgba(242,102,46,0.10)" : "transparent" }}>
              <span style={{ width: 32, height: 32, borderRadius: 999, background: tint("#40C8E0", 0.2), color: "#40C8E0", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{String(e.full_name || "?").trim().slice(0, 1).toUpperCase()}</span>
              <span className="flex-1 truncate" style={{ fontWeight: 600 }}>{e.full_name}</span><b>{hoursLabel(weekHours(e))}</b><ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
            </button>)}
          </div>
        )}
      </div>
    </div>
  );

  const panel = selectedEmp ? <EmployeePanel key={selectedEmp.id} emp={selectedEmp} tenant={tenant} tenantId={tenantId} self={self} onBack={!desktop ? () => setSelectedEmp(null) : null} onSaved={(u) => { setEmployees((p) => (p || []).map((x) => (x.id === u.id ? u : x))); loadMonth(); }} />
    : <div className="flex items-center justify-center" style={{ height: 240, color: W.sub }}>Selecciona un empleado para ver su horario y pago</div>;

  return (
    <div>
      {desktop ? (
        <div className="flex" style={{ gap: 20, alignItems: "flex-start" }}><div style={{ width: 460, flexShrink: 0 }}>{hub}</div><div className="flex-1 min-w-0">{panel}</div></div>
      ) : (selectedEmp ? panel : hub)}
      <ScheduleBuilderDialog open={builderOpen} employees={employees || []} tenant={tenant} tenantId={tenantId} onClose={() => setBuilderOpen(false)} onSaved={(u) => { setEmployees((p) => (p || []).map((x) => (x.id === u.id ? u : x))); setSelectedEmp((s) => (s && s.id === u.id ? u : s)); }} />
      <BatchPayrollDialog open={batchOpen} tenant={tenant} tenantId={tenantId} onClose={() => setBatchOpen(false)} onEditPunches={(emp, period) => { setBatchOpen(false); setPunchScope({ employee: emp, period }); }} onDone={() => loadMonth()} />
      <EditPunchesDialog open={!!punchScope} scope={punchScope} tenant={tenant} tenantId={tenantId} self={self} onClose={() => setPunchScope(null)} />
      <AlertDialog open={massOpen} title={`¿Enviar horario por email a ${active.filter((e) => String(e.email || "").trim() && e.schedule).length} empleados?`} message={active.filter((e) => String(e.email || "").trim() && e.schedule).map((e) => e.full_name).join(", ") || "Ningún empleado tiene email + horario configurado."} onClose={() => setMassOpen(false)}
        actions={[{ label: "Cancelar" }, { label: "Enviar horarios", bold: true, onPress: sendMass }]} />
      <AlertDialog open={!!massMsg} title="Horarios" message={massMsg || ""} onClose={() => setMassMsg(null)} actions={[{ label: "Listo", bold: true }]} />
      {massBusy && <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 400, background: "rgba(0,0,0,0.4)" }}><Loader2 className="w-8 h-8 animate-spin" /></div>}
    </div>
  );
}

