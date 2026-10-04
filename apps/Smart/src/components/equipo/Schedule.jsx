import { useEffect, useMemo, useState } from "react";
import { Loader2, Copy, Mail, MessageCircle, MessageSquare, Check } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { Banner, W, money } from "@/components/wizard/ui";
import {
  DAY_LONG, DAY_SHORT, DAY_INITIAL, normalizeSchedule, dayHours, dayRange, hoursText, scheduleTotal, timeValue, parseTimeValue, applyTemplate, scheduleSig, scheduleMessage, whatsappUrl,
  publishIcs, sendScheduleEmail, saveSchedule, clockLabel,
} from "@/lib/teamTime";
import { employeeRate, isActive, ConflictError, num, fetchEmployee } from "@/lib/teamApi";
import { copyText } from "@/lib/teamApi";

const BRAND = "#F2662E";
const GREEN = "#4DC780";
const RED = "#FF7373";
const PALETTE = ["#40C8E0", "#FF9F0A", "#BF5AF2", "#66B3FF", "#FF6482", "#5E5CE6", "#63E6BE", "#A2845E"];

function TimeInput({ label, h, m, onChange, disabled }) {
  return (
    <label className="flex flex-col" style={{ gap: 2 }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>{label}</span>
      <input type="time" value={timeValue(h, m)} disabled={disabled} onChange={(e) => { const v = parseTimeValue(e.target.value); if (v) onChange(v.h, v.m); }} className="outline-none" style={{ background: W.card2, color: "#fff", borderRadius: 10, padding: "8px 10px", fontSize: 15, colorScheme: "dark" }} />
    </label>
  );
}

function Toggle({ on, onChange, label }) {
  return <button onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label} style={{ width: 46, height: 28, borderRadius: 999, background: on ? GREEN : "#3A3A3C", position: "relative", flexShrink: 0 }}><span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 24, height: 24, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button>;
}

export function ScheduleRows({ schedule, onChange }) {
  const setDay = (weekday, patch) => onChange({ ...schedule, days: schedule.days.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)) });
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {schedule.days.map((d) => {
        const s = d.startHour + d.startMinute / 60;
        const e = d.endHour + d.endMinute / 60;
        const left = Math.max(0, Math.min(100, ((s - 6) / 17) * 100));
        const width = Math.max(2, Math.min(100 - left, (((e <= s ? e + 24 : e) - s) / 17) * 100));
        return (
          <div key={d.weekday} style={{ padding: 12, borderRadius: 14, background: "#1C1C1E" }}>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 15, fontWeight: 700, width: 92 }}>{DAY_LONG[d.weekday - 1]}</span>
              <div className="flex-1" style={{ height: 8, borderRadius: 999, background: "#2C2C2E", position: "relative", overflow: "hidden" }}>
                {d.enabled && <span style={{ position: "absolute", left: `${left}%`, width: `${width}%`, top: 0, bottom: 0, borderRadius: 999, background: "linear-gradient(90deg,#66B3FF,#F2662E)" }} />}
              </div>
              <span style={{ fontSize: 12, color: d.enabled ? "#fff" : W.sub, minWidth: 100, textAlign: "right" }}>{d.enabled ? dayRange(d) : "Libre"}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: BRAND, width: 40, textAlign: "right" }}>{d.enabled ? hoursText(dayHours(d)) : ""}</span>
              <Toggle on={d.enabled} onChange={(v) => setDay(d.weekday, { enabled: v })} label={`${DAY_LONG[d.weekday - 1]} activo`} />
            </div>
            {d.enabled && (
              <div className="flex" style={{ gap: 12, marginTop: 10 }}>
                <TimeInput label="ENTRADA" h={d.startHour} m={d.startMinute} onChange={(h, m) => setDay(d.weekday, { startHour: h, startMinute: m })} />
                <TimeInput label="SALIDA" h={d.endHour} m={d.endMinute} onChange={(h, m) => setDay(d.weekday, { endHour: h, endMinute: m })} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TemplateMenu({ schedule, onChange }) {
  const [open, setOpen] = useState(false);
  const items = [["weekday10-5", "Lun–Vie · 10am–5pm"], ["weeksat10-6", "Lun–Sáb · 10am–6pm"], ["copyFirst", "Copiar 1er día a los activos"], ["clear", "Limpiar (todos cerrados)"]];
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="apple-press" style={{ padding: "7px 14px", borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND, fontSize: 13, fontWeight: 700 }}>Plantillas rápidas</button>
      {open && (
        <div className="absolute" style={{ top: 38, left: 0, zIndex: 40, minWidth: 240, background: "#2C2C2E", borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
          {items.map(([k, l], i) => <button key={k} onClick={() => { onChange(applyTemplate(schedule, k)); setOpen(false); }} className="apple-press w-full text-left" style={{ padding: "10px 14px", fontSize: 14, borderTop: i ? `0.5px solid ${W.sub}33` : "none" }}>{l}</button>)}
        </div>
      )}
    </div>
  );
}

export function SendScheduleDialog({ open, onClose, onSent, tenant, tenantId, employee, schedule }) {
  const [ics, setIcs] = useState(null);
  const [busyEmail, setBusyEmail] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const shop = String(tenant?.name || "").trim() || "Archilla OS";
  useEffect(() => { if (sent) onSent?.(); }, [sent]);
  useEffect(() => {
    if (!open || !employee) return;
    setIcs(null); setSent(null); setError(null); setCopied(false);
    publishIcs({ tenantId, employee, shop, schedule, tz: tenant?.timezone }).then(setIcs, () => setIcs({ url: null, stable: false }));
  }, [open, employee?.id]);
  if (!employee) return null;
  const url = ics?.url || null;
  const text = scheduleMessage({ shop, schedule, url });
  const phone = String(employee.phone || "").trim();
  const email = String(employee.email || "").trim();
  const first = String(employee.full_name || "").trim().split(/\s+/)[0] || "";
  const sendEmail = async () => {
    setBusyEmail(true); setError(null);
    try { const ok = await sendScheduleEmail({ tenant, tenantId, employee, schedule, url }); if (ok) setSent("Email"); else setError("No se pudo enviar el email. Revisa la dirección."); } catch { setError("No se pudo enviar el email. Revisa la dirección."); } finally { setBusyEmail(false); }
  };
  const btn = (color, children, props) => <button {...props} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ padding: "13px 0", borderRadius: 14, background: color, color: "#fff", fontWeight: 700, fontSize: 15 }}>{children}</button>;
  return (
    <Dialog open={open} onClose={onClose} title="Enviar horario" width={480} height="90dvh" leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Vista previa</p>
        <div style={{ padding: 14, borderRadius: 16, background: "#fff", color: "#111" }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: BRAND }}>{shop}</p>
          <p style={{ fontSize: 15, fontWeight: 700 }}>Tu horario semanal</p>
          <p style={{ fontSize: 13, color: "#555" }}>Hola {first}, este es tu horario asignado.</p>
          <div className="grid grid-cols-7" style={{ gap: 4, marginTop: 10 }}>
            {[2, 3, 4, 5, 6, 7, 1].map((w) => { const d = schedule.days.find((x) => x.weekday === w); return (
              <div key={w} style={{ border: "1px solid #eee", borderRadius: 8, padding: "6px 2px", textAlign: "center", fontSize: 10 }}>
                <b style={{ color: "#666" }}>{DAY_SHORT[w - 1]}</b>
                {d.enabled ? <><div>{clockLabel(d.startHour, d.startMinute)}</div><div style={{ color: "#999" }}>a</div><div>{clockLabel(d.endHour, d.endMinute)}</div><b style={{ color: BRAND }}>{hoursText(dayHours(d))}</b></> : <div style={{ color: "#999", marginTop: 14 }}>Libre</div>}
              </div>
            ); })}
          </div>
          <p style={{ fontWeight: 700, marginTop: 8, fontSize: 13 }}>Total: {hoursText(scheduleTotal(schedule))} horas/semana</p>
        </div>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Enviar por</p>
        {phone && <a href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer" onClick={() => setSent("WhatsApp")} className="apple-press w-full flex items-center justify-center gap-2" style={{ padding: "13px 0", borderRadius: 14, background: "#25A244", color: "#fff", fontWeight: 700 }}><MessageCircle className="w-5 h-5" /> WhatsApp</a>}
        {phone && <a href={`sms:${phone.replace(/\D/g, "")}?&body=${encodeURIComponent(text)}`} onClick={() => setSent("SMS")} className="apple-press w-full flex items-center justify-center gap-2" style={{ padding: "13px 0", borderRadius: 14, background: BRAND, color: "#fff", fontWeight: 700 }}><MessageSquare className="w-5 h-5" /> SMS / Mensaje</a>}
        {email && btn("#0A84FF", <>{busyEmail ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />} {busyEmail ? "Enviando…" : "Email"}</>, { onClick: sendEmail, disabled: busyEmail })}
        {!phone && !email && <p style={{ fontSize: 13, color: W.sub }}>Este empleado no tiene teléfono ni email. Agrégalos en su perfil.</p>}
        {btn("#3A3A3C", <>{copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />} {copied ? "Mensaje copiado" : "Copiar mensaje"}</>, { onClick: async () => setCopied(await copyText(text)) })}
        {url && <p style={{ fontSize: 12, color: W.sub }}>El mensaje incluye un enlace para que el empleado agregue el horario a su calendario (se repite cada semana).</p>}
        {ics && !ics.stable && <p style={{ fontSize: 12, color: "#FFA640" }}>No se pudo actualizar el enlace de siempre. Este mensaje lleva uno nuevo; el anterior se queda con el horario viejo.</p>}
        {sent && <p style={{ fontSize: 13, color: GREEN, fontWeight: 600 }}>Enviado por {sent}</p>}
        {error && <Banner color={RED}>{error}</Banner>}
      </div>
    </Dialog>
  );
}

export function ScheduleBuilderDialog({ open, onClose, tenant, tenantId, employees, onSaved }) {
  const active = useMemo(() => (employees || []).filter(isActive), [employees]);
  const [emp, setEmp] = useState(null);
  const [draft, setDraft] = useState(null);
  const [base, setBase] = useState(null);
  const [same, setSame] = useState(false);
  const [common, setCommon] = useState({ sh: 9, sm: 0, eh: 17, em: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [sendFor, setSendFor] = useState(null);
  const [rows, setRows] = useState(active);

  useEffect(() => { if (open) { setRows(active); setEmp(null); setDraft(null); setError(null); setSaved(false); } }, [open]);

  const pick = async (e) => {
    setError(null); setSaved(false);
    let fresh = e;
    try { fresh = (await fetchEmployee(tenantId, e.id)) || e; } catch { fresh = e; }
    setEmp(fresh);
    const s = normalizeSchedule(fresh.schedule, employeeRate(fresh));
    setDraft(s); setBase(scheduleSig(s));
    const first = s.days.find((d) => d.enabled);
    if (first) setCommon({ sh: first.startHour, sm: first.startMinute, eh: first.endHour, em: first.endMinute });
  };

  const applyCommon = (c, daysOn) => setDraft((d) => ({ ...d, days: d.days.map((x) => (daysOn(x.weekday) ? { ...x, enabled: true, startHour: c.sh, startMinute: c.sm, endHour: c.eh, endMinute: c.em } : x)) }));
  const chip = (label, fn) => <button key={label} onClick={() => { fn(); }} className="apple-press" style={{ padding: "6px 12px", borderRadius: 999, background: "#3A3A3C", fontSize: 13, fontWeight: 600 }}>{label}</button>;

  const save = async (thenSend) => {
    if (!emp || !draft || busy) return;
    setBusy(true); setError(null);
    try {
      const upd = await saveSchedule(emp, draft);
      setEmp(upd); setBase(scheduleSig(normalizeSchedule(upd.schedule, employeeRate(upd))));
      setRows((p) => p.map((r) => (r.id === upd.id ? upd : r)));
      setSaved(true); onSaved?.(upd);
      if (thenSend) setSendFor(upd);
    } catch (e) {
      if (e instanceof ConflictError && e.fresh) { setEmp(e.fresh); setRows((p) => p.map((r) => (r.id === e.fresh.id ? e.fresh : r))); }
      setError(e?.message || String(e));
    } finally { setBusy(false); }
  };

  const rate = emp ? employeeRate(emp) : 0;
  const total = draft ? scheduleTotal(draft) : 0;
  const dirty = draft && base !== scheduleSig(draft);

  return (
    <>
      <Dialog open={open} onClose={onClose} title="Crear horario" width={1100} height="92dvh" leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>} bodyPadding="4px 16px 16px">
        <div className="grid" style={{ gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", alignItems: "start", paddingTop: 6 }}>
          <div className="flex flex-col" style={{ gap: 12 }}>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>EDITAR HORARIO</p>
            <select value={emp?.id || ""} onChange={(e) => { const x = rows.find((r) => r.id === e.target.value); if (x) pick(x); }} aria-label="Escoger empleado" style={{ background: "#2C2C2E", color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, colorScheme: "dark" }}>
              <option value="">Escoger empleado</option>
              {rows.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
            {!draft ? <div className="text-center" style={{ padding: 30, color: W.sub }}><b style={{ color: "#fff" }}>Selecciona un empleado</b><p style={{ fontSize: 13, marginTop: 4 }}>Toca a alguien en la cuadrícula para crear o ajustar su horario.</p></div> : (
              <>
                <div className="grid grid-cols-7" style={{ gap: 4 }}>
                  {[2, 3, 4, 5, 6, 7, 1].map((w) => { const d = draft.days.find((x) => x.weekday === w); return (
                    <div key={w} style={{ borderRadius: 10, overflow: "hidden", background: "#1C1C1E", textAlign: "center", fontSize: 10 }}>
                      <div style={{ padding: "4px 0", background: d.enabled ? BRAND : "#2C2C2E", fontWeight: 800 }}>{DAY_SHORT[w - 1]}</div>
                      <div style={{ padding: "6px 0", color: d.enabled ? "#fff" : W.sub }}>{d.enabled ? <>{clockLabel(d.startHour, d.startMinute)}<br />{clockLabel(d.endHour, d.endMinute)}<br /><b style={{ color: BRAND }}>{hoursText(dayHours(d))}</b></> : "Libre"}</div>
                    </div>
                  ); })}
                </div>
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>PLANTILLA RÁPIDA</p>
                <div className="flex flex-wrap" style={{ gap: 8 }}>
                  {chip("Lun-Vie", () => applyCommon(common, (w) => w >= 2 && w <= 6))}
                  {chip("Mar-Sáb", () => applyCommon(common, (w) => w >= 3 && w <= 7))}
                  {chip("Todos", () => applyCommon(common, () => true))}
                  {chip("Limpiar", () => setDraft((d) => applyTemplate(d, "clear")))}
                </div>
                <div className="flex items-center" style={{ gap: 10 }}>
                  <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Misma hora todos los días</span><span className="block" style={{ fontSize: 12, color: W.sub }}>Un solo horario para los días activos</span></span>
                  <Toggle on={same} onChange={setSame} label="Misma hora todos los días" />
                </div>
                {same ? (
                  <div className="flex flex-col" style={{ gap: 10, padding: 12, borderRadius: 14, background: "#1C1C1E" }}>
                    <div className="flex" style={{ gap: 12 }}>
                      <TimeInput label="ENTRADA" h={common.sh} m={common.sm} onChange={(h, m) => { const c = { ...common, sh: h, sm: m }; setCommon(c); applyCommonActive(setDraft, c); }} />
                      <TimeInput label="SALIDA" h={common.eh} m={common.em} onChange={(h, m) => { const c = { ...common, eh: h, em: m }; setCommon(c); applyCommonActive(setDraft, c); }} />
                    </div>
                    <div className="flex" style={{ gap: 6 }}>
                      {[1, 2, 3, 4, 5, 6, 7].map((w) => { const d = draft.days.find((x) => x.weekday === w); return <button key={w} onClick={() => setDraft((p) => ({ ...p, days: p.days.map((x) => (x.weekday === w ? { ...x, enabled: !x.enabled, startHour: common.sh, startMinute: common.sm, endHour: common.eh, endMinute: common.em } : x)) }))} aria-label={DAY_LONG[w - 1]} aria-pressed={d.enabled} style={{ width: 36, height: 36, borderRadius: 999, background: d.enabled ? BRAND : "#3A3A3C", fontWeight: 700, fontSize: 13 }}>{DAY_INITIAL[w - 1]}</button>; })}
                    </div>
                  </div>
                ) : <ScheduleRows schedule={draft} onChange={setDraft} />}
                <div className="flex items-center justify-between" style={{ fontSize: 14 }}>
                  <span>{draft.days.filter((d) => d.enabled).length} días activos · {hoursText(total)}/sem</span>
                  <b style={{ color: GREEN }}>{rate > 0 ? `${money(total * rate)}/sem` : ""}</b>
                </div>
                <div className="flex" style={{ gap: 8 }}>
                  <button onClick={() => save(false)} disabled={busy} className="apple-press flex-1 disabled:opacity-50" style={{ padding: "12px 0", borderRadius: 12, background: BRAND, color: "#fff", fontWeight: 700 }}>{busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Guardar horario"}</button>
                  <button onClick={() => save(true)} disabled={busy} className="apple-press flex-1 disabled:opacity-50" style={{ padding: "12px 0", borderRadius: 12, border: `1px solid ${BRAND}`, color: BRAND, fontWeight: 700 }}>Guardar y enviar</button>
                </div>
                {saved && !dirty && <p style={{ fontSize: 13, color: GREEN, fontWeight: 600 }}>Horario guardado</p>}
                {error && <Banner color={RED}>{error}</Banner>}
              </>
            )}
          </div>
          <div className="flex flex-col" style={{ gap: 10, minWidth: 0 }}>
            <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>CUADRÍCULA SEMANAL</p>
            <p style={{ fontSize: 12, color: W.sub }}>Empleado por fila, día por columna. Toca a alguien para editar su horario.</p>
            {!rows.length ? <p style={{ color: W.sub }}>No hay empleados activos</p> : (
              <div className="overflow-x-auto" style={{ borderRadius: 14, background: "#1C1C1E", padding: 10 }}>
                <div className="grid" style={{ gridTemplateColumns: "150px repeat(7, minmax(54px, 1fr))", gap: 4, fontSize: 11, minWidth: 560 }}>
                  <span style={{ color: W.sub, fontWeight: 800 }}>EMPLEADO</span>
                  {[2, 3, 4, 5, 6, 7, 1].map((w) => <span key={w} className="text-center" style={{ color: W.sub, fontWeight: 800 }}>{DAY_SHORT[w - 1]}</span>)}
                  {rows.map((r, i) => {
                    const s = normalizeSchedule(r.schedule, employeeRate(r));
                    const hrs = scheduleTotal(s);
                    const color = PALETTE[i % PALETTE.length];
                    return [
                      <button key={`${r.id}-n`} onClick={() => pick(r)} className="apple-press text-left flex items-center gap-2" style={{ padding: "6px 4px", borderRadius: 8, background: emp?.id === r.id ? "rgba(242,102,46,0.12)" : "transparent" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
                        <span className="min-w-0"><span className="block truncate" style={{ fontSize: 12, fontWeight: 700 }}>{r.full_name}</span><span className="block" style={{ fontSize: 10, color: W.sub }}>{hrs > 0 ? `${hoursText(hrs)}/sem · ${money(hrs * employeeRate(r))}` : "Sin horario"}</span></span>
                      </button>,
                      ...[2, 3, 4, 5, 6, 7, 1].map((w) => { const d = s.days.find((x) => x.weekday === w); return <button key={`${r.id}-${w}`} onClick={() => pick(r)} className="text-center" style={{ borderRadius: 8, padding: "5px 0", background: d.enabled ? tint(color, 0.22) : "#2C2C2E", color: d.enabled ? "#fff" : W.sub, fontSize: 11 }}>{d.enabled ? <>{`${d.startHour % 12 || 12}-${d.endHour % 12 || 12}`}<br />{Math.round(dayHours(d))}h</> : "—"}</button>; }),
                    ];
                  })}
                  <span style={{ color: W.sub, fontWeight: 800, paddingTop: 4 }}>TOTAL</span>
                  {[2, 3, 4, 5, 6, 7, 1].map((w) => <span key={w} className="text-center" style={{ fontWeight: 700, paddingTop: 4 }}>{hoursText(rows.reduce((t, r) => { const d = normalizeSchedule(r.schedule, employeeRate(r)).days.find((x) => x.weekday === w); return t + (d.enabled ? dayHours(d) : 0); }, 0))}</span>)}
                </div>
                <div className="flex" style={{ gap: 16, marginTop: 10, fontSize: 12, color: W.sub }}>
                  <span>HORAS / SEMANA <b style={{ color: "#fff" }}>{hoursText(rows.reduce((t, r) => t + scheduleTotal(normalizeSchedule(r.schedule, employeeRate(r))), 0))}</b></span>
                  <span>COSTO APROX / SEMANA <b style={{ color: GREEN }}>{money(rows.reduce((t, r) => t + scheduleTotal(normalizeSchedule(r.schedule, employeeRate(r))) * employeeRate(r), 0))}</b></span>
                  <span>EMPLEADOS <b style={{ color: "#fff" }}>{rows.length}</b></span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>
      <SendScheduleDialog open={!!sendFor} employee={sendFor} schedule={sendFor ? normalizeSchedule(sendFor.schedule, employeeRate(sendFor)) : null} tenant={tenant} tenantId={tenantId} onClose={() => setSendFor(null)} />
    </>
  );
}

function applyCommonActive(setDraft, c) {
  setDraft((d) => ({ ...d, days: d.days.map((x) => (x.enabled ? { ...x, startHour: c.sh, startMinute: c.sm, endHour: c.eh, endMinute: c.em } : x)) }));
}

export function MiHorario({ employee }) {
  const s = normalizeSchedule(employee?.schedule, employeeRate(employee));
  const rate = employeeRate(employee);
  const total = scheduleTotal(s);
  const has = s.days.some((d) => d.enabled);
  return (
    <div className="flex flex-col" style={{ gap: 14, maxWidth: 560 }}>
      <Banner color={has ? "#FFC733" : "#FFA640"}><b>{has ? "Definido por administrador" : "Sin horario asignado"}</b><br />{has ? "Tu horario lo asigna el administrador. Si algo no cuadra, pídele que lo cambie." : "Todavía no te han asignado un horario."}</Banner>
      <div style={{ padding: 14, borderRadius: 16, background: "#1C1C1E" }}>
        <div className="flex justify-between" style={{ fontSize: 15 }}><span>Pago por hora</span><b>{rate > 0 ? `${money(rate)}/hr` : "—"}</b></div>
        <p style={{ fontSize: 12, color: W.sub, marginTop: 6 }}>El pago por hora es definido por el administrador.</p>
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Tu horario semanal</p>
      <div style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>
        {[2, 3, 4, 5, 6, 7, 1].map((w, i) => { const d = s.days.find((x) => x.weekday === w); return (
          <div key={w} className="flex items-center" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
            <span className="flex-1" style={{ fontWeight: 600 }}>{DAY_LONG[w - 1]}</span>
            {d.enabled ? <><span style={{ fontSize: 14, marginRight: 10 }}>{dayRange(d)}</span><b style={{ color: BRAND, fontSize: 13 }}>{hoursText(dayHours(d))}</b></> : <span style={{ color: W.sub }}>Libre</span>}
          </div>
        ); })}
      </div>
      <p style={{ fontSize: 12, color: W.sub }}>Al abrir la app cerca de tu hora de entrada, te pide ponchar.</p>
      <div style={{ padding: 14, borderRadius: 16, background: "#1C1C1E" }}>
        <div className="flex justify-between" style={{ fontSize: 15, padding: "4px 0" }}><span>Horas semanales</span><b>{hoursText(total)}</b></div>
        <div className="flex justify-between" style={{ fontSize: 15, padding: "4px 0" }}><span>Pago semanal estimado</span><b style={{ color: GREEN }}>{money(total * rate)}</b></div>
      </div>
    </div>
  );
}

export { num };
