import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Trash2, Scissors } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { Banner, Input, TextArea, W, money } from "@/components/wizard/ui";
import { safeTZ, zonedParts, zonedDate, startOfDay, fmt } from "@/lib/finance/tz";
import { detectOverlaps, hoursLabel } from "@/lib/finance/payroll";
import { fetchEntry, fetchOpenTenantEntries, fetchTenantEntries, subscribeTimeEntries, shortTime, entryIn, elapsedHours, matchIdsFor } from "@/lib/punchApi";
import { overlappingEntry, addManualEntry, updateEntry, deleteEntry, trimSecond, fetchEmployeeEntries, EntryConflict } from "@/lib/teamTime";
import { rolesOf, isAdminLevel, roleColor, employeeRate } from "@/lib/teamApi";

const BRAND = "#F2662E";
const GREEN = "#4DC780";
const RED = "#FF7373";
const WARN = "#FFA640";
const INFO = "#66B3FF";

export const dayShort = (date, tz) => fmt(date, safeTZ(tz), { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(/(^|\s)\S/g, (c) => c.toUpperCase());

export function toLocalInput(date, tz) {
  const p = zonedParts(date, safeTZ(tz));
  return `${String(p.y).padStart(4, "0")}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}T${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}
export function fromLocalInput(v, tz) {
  const m = String(v || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return zonedDate(+m[1], +m[2], +m[3], safeTZ(tz), +m[4], +m[5]);
}
const dayInput = (date, tz) => toLocalInput(date, tz).slice(0, 10);

function Toggle({ on, onChange, label }) {
  return <button onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label} style={{ width: 46, height: 28, borderRadius: 999, background: on ? GREEN : "#3A3A3C", position: "relative", flexShrink: 0 }}><span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 24, height: 24, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button>;
}

function sameIdentity(self, employee) {
  if (!self || !employee) return false;
  return [self.id, self.auth_user_id].some((x) => x && (x === employee.id || x === employee.auth_user_id));
}

export function AddPunchDialog({ open, employee, self, tenant, tenantId, onClose, onSaved }) {
  const tz = tenant?.timezone;
  const [day, setDay] = useState("");
  const [inT, setInT] = useState("10:00");
  const [hasOut, setHasOut] = useState(true);
  const [outT, setOutT] = useState("17:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setDay(dayInput(new Date(), tz)); setInT("10:00"); setHasOut(true); setOutT("17:00"); setError(null); } }, [open, employee?.id]);
  if (!employee) return null;
  const forbidden = !sameIdentity(self, employee) && !isAdminLevel(rolesOf(self));
  const cin = fromLocalInput(`${day}T${inT}`, tz);
  const cout = hasOut ? fromLocalInput(`${day}T${outT}`, tz) : null;
  const total = cin && cout ? (cout - cin) / 3600000 : null;
  const save = async () => {
    if (busy || forbidden || !cin) return;
    if (cin > new Date()) { setError("La entrada no puede estar en el futuro."); return; }
    if (cout && cout <= cin) { setError("La salida debe ser después de la entrada."); return; }
    setBusy(true); setError(null);
    try {
      const clash = await overlappingEntry({ tenantId, matchIds: matchIdsFor(employee, null), clockIn: cin, clockOut: cout, tz });
      if (clash) { setError(clash.message); return; }
      onSaved(await addManualEntry({ tenantId, employee, clockIn: cin, clockOut: cout }));
      onClose();
    } catch (e) {
      setError(e?.message || String(e));
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Añadir ponche" width={440} leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={<TextAction bold onClick={save} disabled={busy || forbidden}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        {forbidden && <Banner color={RED}>No tienes permiso para cambiar el ponche de otra persona.</Banner>}
        <div style={{ padding: 14, borderRadius: 14, background: "#2C2C2E" }}><span style={{ color: W.sub, fontSize: 12 }}>Empleado</span><p style={{ fontSize: 16, fontWeight: 700 }}>{employee.full_name}</p></div>
        <Input label="Día" type="date" value={day} onChange={setDay} />
        <Input label="Entrada" type="time" value={inT} onChange={setInT} />
        <div className="flex items-center"><span className="flex-1" style={{ fontSize: 15 }}>Tiene salida</span><Toggle on={hasOut} onChange={setHasOut} label="Tiene salida" /></div>
        {hasOut && <Input label="Salida" type="time" value={outT} onChange={setOutT} />}
        <p style={{ fontSize: 13, color: W.sub }}>{total !== null && total > 0 ? `Total: ${hoursLabel(total)}` : hasOut ? "" : "En curso"}</p>
        {error && <Banner color={RED}>{error}</Banner>}
      </div>
    </Dialog>
  );
}

export function EditHoursDialog({ open, entry: initial, self, tenant, tenantId, employees, onClose, onDone }) {
  const tz = tenant?.timezone;
  const [entry, setEntry] = useState(initial);
  const [inV, setInV] = useState("");
  const [hasOut, setHasOut] = useState(false);
  const [outV, setOutV] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [delOpen, setDelOpen] = useState(false);
  const admin = isAdminLevel(rolesOf(self));

  useEffect(() => {
    if (!open || !initial) return;
    let alive = true;
    setError(null); setReason("");
    const apply = (e) => { setEntry(e); setInV(toLocalInput(entryIn(e), tz)); setHasOut(!!e.clock_out); setOutV(e.clock_out ? toLocalInput(new Date(e.clock_out), tz) : toLocalInput(new Date(), tz)); };
    apply(initial);
    fetchEntry(initial.id).then((fresh) => {
      if (!alive) return;
      if (!fresh) { setError("Este ponche ya no existe."); return; }
      if (fresh.updated_at !== initial.updated_at || fresh.clock_out !== initial.clock_out || fresh.clock_in !== initial.clock_in) {
        apply(fresh);
        setError(fresh.clock_out ? `Cambió en otro dispositivo: entrada ${shortTime(entryIn(fresh), tz)}, salida ${shortTime(new Date(fresh.clock_out), tz)}. Revisa y guarda otra vez.` : `Cambió en otro dispositivo: entrada ${shortTime(entryIn(fresh), tz)}, sigue en curso. Revisa y guarda otra vez.`);
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, [open, initial?.id]);

  if (!entry) return null;
  const cin = inV === toLocalInput(entryIn(entry), tz) ? entryIn(entry) : fromLocalInput(inV, tz);
  const cout = !hasOut ? null : entry.clock_out && outV === toLocalInput(new Date(entry.clock_out), tz) ? new Date(entry.clock_out) : fromLocalInput(outV, tz);
  const total = cin && cout ? (cout - cin) / 3600000 : null;
  const lockedClosed = !admin && !!entry.clock_out;
  const by = String(self?.full_name || "").trim() || "Dueño";

  const save = async () => {
    if (busy || lockedClosed || !cin) return;
    if (!reason.trim()) { setError("Escribe el motivo del ajuste."); return; }
    if (hasOut && !cout) { setError("Escribe una hora de salida válida."); return; }
    if (cout && cout <= cin) { setError("La salida debe ser después de la entrada."); return; }
    setBusy(true); setError(null);
    try {
      const owner = (employees || []).find((x) => x.id === entry.employee_id || x.auth_user_id === entry.employee_id);
      const clash = await overlappingEntry({ tenantId, matchIds: matchIdsFor(owner || { id: entry.employee_id }, null), clockIn: cin, clockOut: cout, excludeId: entry.id, tz });
      if (clash) { setError(clash.message); return; }
      const row = await updateEntry({ entry, clockIn: cin, clockOut: cout, reason: reason.trim(), by });
      onDone?.(row); onClose();
    } catch (e) {
      if (e instanceof EntryConflict) {
        const fresh = await fetchEntry(entry.id).catch(() => null);
        setError(fresh ? "Otro dispositivo cambió este ponche. Revisa y guarda otra vez." : "Este ponche ya no existe.");
        if (fresh) { setEntry(fresh); setInV(toLocalInput(entryIn(fresh), tz)); setHasOut(!!fresh.clock_out); if (fresh.clock_out) setOutV(toLocalInput(new Date(fresh.clock_out), tz)); }
      } else setError("No pudimos guardar el cambio. Intenta de nuevo.");
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    setBusy(true);
    try { await deleteEntry(entry); onDone?.(null, entry); onClose(); } catch (e) { setError(e instanceof EntryConflict ? "Otro dispositivo cambió este ponche. Revisa y vuelve a intentar." : "No pudimos borrar el ponche. Intenta de nuevo."); } finally { setBusy(false); }
  };

  return (
    <>
      <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Editar horas" width={460} height="88dvh" leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={<TextAction bold onClick={save} disabled={busy || lockedClosed}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</TextAction>}>
        <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
          {lockedClosed && <Banner color={WARN}>Solo un administrador puede corregir un ponche ya cerrado.</Banner>}
          <p style={{ fontSize: 13, color: W.sub }}>{entry.employee_name}</p>
          <Input label="Hora de entrada" type="datetime-local" value={inV} onChange={setInV} />
          <div className="flex items-center"><span className="flex-1" style={{ fontSize: 15 }}>Tiene salida</span><Toggle on={hasOut} onChange={setHasOut} label="Tiene salida" /></div>
          {hasOut ? <Input label="Hora de salida" type="datetime-local" value={outV} onChange={setOutV} /> : <p style={{ fontSize: 13, color: W.sub }}>Ponche en curso (sin salida registrada)</p>}
          {total !== null && <div className="flex justify-between" style={{ fontSize: 15 }}><span>Total de horas</span><b style={{ color: BRAND }}>{hoursLabel(Math.max(0, total))}</b></div>}
          <TextArea label="Motivo del ajuste" value={reason} onChange={setReason} rows={3} placeholder="Ej: PIN equivocado, se le olvidó ponchar salida…" />
          <p style={{ fontSize: 12, color: W.sub }}>{entry.edited_by && entry.edit_reason ? `Última edición por ${entry.edited_by}: "${entry.edit_reason}"` : "Obligatorio — queda guardado para que se sepa quién y por qué se ajustó este ponche."}</p>
          {error && <Banner color={RED}>{error}</Banner>}
          {admin && <button onClick={() => setDelOpen(true)} disabled={busy} className="apple-press flex items-center justify-center gap-2" style={{ padding: "12px 0", borderRadius: 12, background: tint(RED, 0.14), color: RED, fontWeight: 700 }}><Trash2 className="w-4 h-4" /> Borrar este ponche</button>}
        </div>
      </Dialog>
      <AlertDialog open={delOpen} title="¿Borrar este ponche?" message="Esta accion no se puede deshacer." onClose={() => setDelOpen(false)} actions={[{ label: "Cancelar" }, { label: "Borrar ponche", destructive: true, onPress: doDelete }]} />
    </>
  );
}

function flagOf(entry, now = new Date()) {
  if (String(entry.edited_by || "").toLowerCase().includes("auto")) return ["Auto ponche", INFO];
  if (!entry.clock_out) return elapsedHours(entry, now) > 12 ? ["Turno largo", WARN] : null;
  const mins = (new Date(entry.clock_out) - entryIn(entry)) / 60000;
  return mins < 10 ? ["Sospechoso", RED] : null;
}

function rangeText(e, tz) {
  return `${shortTime(entryIn(e), tz)} → ${e.clock_out ? shortTime(new Date(e.clock_out), tz) : "en curso"}`;
}

export function EditPunchesDialog({ open, onClose, tenant, tenantId, self, scope, employees }) {
  const tz = tenant?.timezone;
  const zone = safeTZ(tz);
  const admin = isAdminLevel(rolesOf(self));
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [edit, setEdit] = useState(null);
  const [delPair, setDelPair] = useState(null);
  const [busy, setBusy] = useState(false);
  const by = String(self?.full_name || "").trim() || "Dueño";

  const load = useCallback(async () => {
    try {
      if (scope) setRows(await fetchEmployeeEntries({ tenantId, employee: scope.employee, from: scope.period.start, to: scope.period.end }));
      else {
        const [day, open] = await Promise.all([fetchTenantEntries({ tenantId, from: startOfDay(new Date(), zone), to: new Date(Date.now() + 60000) }), fetchOpenTenantEntries(tenantId)]);
        const map = new Map();
        [...day, ...open].forEach((e) => map.set(e.id, e));
        setRows([...map.values()].sort((a, b) => { const ao = !a.clock_out; const bo = !b.clock_out; if (ao !== bo) return ao ? -1 : 1; return entryIn(b) - entryIn(a); }));
      }
      setError(null);
    } catch (e) { setError(e?.message || String(e)); setRows((p) => p || []); }
  }, [tenantId, scope?.employee?.id, scope?.period?.start?.getTime?.(), zone]);

  useEffect(() => { if (open) { setRows(null); load(); } }, [open, load]);
  useEffect(() => (open ? subscribeTimeEntries(tenantId, load) : undefined), [open, tenantId, load]);

  const overlaps = useMemo(() => (scope && rows ? detectOverlaps(rows).overlaps.filter((o) => o.kind !== "openOverlap") : []), [rows, scope]);
  const rate = scope ? employeeRate(scope.employee) : 0;
  const empColor = (e) => { const emp = (employees || []).find((x) => x.id === e.employee_id); return emp ? roleColor(emp) : BRAND; };

  const trim = async (o) => {
    if (!admin) { setError("Solo un administrador puede corregir un ponche ya cerrado."); return; }
    setBusy(true);
    try { await trimSecond({ first: o.first, second: o.second, by }); await load(); } catch { setError("No pudimos recortar el ponche. Intenta de nuevo."); } finally { setBusy(false); }
  };
  const delShorter = async () => {
    const o = delPair;
    if (!o) return;
    const dur = (e) => (e.clock_out ? new Date(e.clock_out) - entryIn(e) : Infinity);
    const target = dur(o.first) <= dur(o.second) ? o.first : o.second;
    setBusy(true);
    try { await deleteEntry(target); await load(); } catch { setError("No pudimos borrar el ponche. Intenta de nuevo."); } finally { setBusy(false); }
  };

  const row = (e, flagless) => {
    const flag = flagless ? null : flagOf(e);
    const color = flag ? flag[1] : empColor(e);
    return (
      <button key={e.id} onClick={() => admin && setEdit(e)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "11px 14px" }}>
        <span style={{ width: 38, height: 38, borderRadius: 999, background: tint(color, 0.2), color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{String(e.employee_name || "?").trim().slice(0, 1).toUpperCase()}</span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap"><span className="truncate" style={{ fontSize: 15, fontWeight: 700 }}>{e.employee_name}</span>{flag && <span style={{ padding: "1px 8px", borderRadius: 999, background: tint(flag[1], 0.16), color: flag[1], fontSize: 10, fontWeight: 800 }}>{flag[0]}</span>}</span>
          <span className="block" style={{ fontSize: 12, color: W.sub }}>{scope ? `${dayShort(entryIn(e), tz)} · ` : ""}{rangeText(e, tz)}{e.clock_out ? ` · ${hoursLabel(elapsedHours(e))}` : ""}</span>
        </span>
        {admin && <Pencil className="w-4 h-4" style={{ color: W.sub }} />}
      </button>
    );
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} title={scope ? scope.employee.full_name : "Editar ponches"} width={620} height="90dvh" leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
        <div className="flex flex-col" style={{ gap: 12, paddingTop: 6 }}>
          {error && <Banner color={RED} onDismiss={() => setError(null)}>{error}</Banner>}
          {rows === null ? <div className="flex justify-center" style={{ padding: 40 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: W.sub }} /></div> : (
            <>
              {scope && overlaps.length > 0 && (
                <>
                  <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Ponches encimados</p>
                  {overlaps.map((o) => (
                    <div key={o.id} style={{ padding: 12, borderRadius: 14, background: "#1C1C1E", border: `1px solid ${tint(RED, 0.3)}` }}>
                      <div className="flex items-center justify-between"><b>{dayShort(o.start, tz)}</b><span style={{ fontSize: 12, color: RED }}>se enciman {hoursLabel(o.hours)} (−{money(o.hours * rate)})</span></div>
                      {[o.first, o.second].map((e) => <div key={e.id} className="flex items-center" style={{ padding: "6px 0", fontSize: 14 }}><span className="flex-1">{rangeText(e, tz)}</span>{admin && <button onClick={() => setEdit(e)} aria-label="Editar"><Pencil className="w-4 h-4" style={{ color: W.sub }} /></button>}</div>)}
                      <div className="flex" style={{ gap: 8, marginTop: 6 }}>
                        <button onClick={() => trim(o)} disabled={busy || !(!o.second.clock_out || new Date(o.second.clock_out) >= new Date(o.first.clock_out))} className="apple-press flex items-center gap-1 disabled:opacity-40" style={{ padding: "7px 14px", borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND, fontSize: 13, fontWeight: 700 }}><Scissors className="w-3.5 h-3.5" /> Recortar</button>
                        <button onClick={() => (admin ? setDelPair(o) : setError("Solo un administrador puede corregir un ponche ya cerrado."))} disabled={busy} className="apple-press" style={{ padding: "7px 14px", borderRadius: 999, background: tint(RED, 0.16), color: RED, fontSize: 13, fontWeight: 700 }}>Borrar repetido</button>
                      </div>
                    </div>
                  ))}
                  <p style={{ fontSize: 12, color: W.sub }}>Recortar mueve la entrada del segundo ponche al final del primero y guarda el motivo. Borrar repetido pide confirmar antes de borrar.</p>
                </>
              )}
              {scope && <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Todos los ponches de la semana</p>}
              {!rows.length ? <div className="text-center" style={{ padding: 30, color: W.sub }}><b style={{ color: "#fff" }}>{scope ? "Sin ponches en esa semana" : "Sin ponches hoy"}</b><p style={{ fontSize: 13, marginTop: 4 }}>{scope ? "No hay ponches para revisar." : "Nadie ha ponchado todavía."}</p></div> : (
                <div style={{ borderRadius: 14, background: "#1C1C1E", overflow: "hidden" }}>{rows.map((e, i) => <div key={e.id} style={{ borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>{row(e, !!scope)}</div>)}</div>
              )}
            </>
          )}
        </div>
      </Dialog>
      <EditHoursDialog open={!!edit} entry={edit} self={self} tenant={tenant} tenantId={tenantId} employees={scope ? [scope.employee] : employees} onClose={() => setEdit(null)} onDone={() => load()} />
      <AlertDialog open={!!delPair} title="¿Borrar este ponche repetido?" message={delPair ? `Se va a borrar: ${rangeText((delPair.first.clock_out ? new Date(delPair.first.clock_out) - entryIn(delPair.first) : Infinity) <= (delPair.second.clock_out ? new Date(delPair.second.clock_out) - entryIn(delPair.second) : Infinity) ? delPair.first : delPair.second, tz)}. Esta acción no se puede deshacer.` : ""} onClose={() => setDelPair(null)}
        actions={[{ label: "Cancelar" }, { label: "Borrar repetido", destructive: true, onPress: delShorter }]} />
    </>
  );
}

