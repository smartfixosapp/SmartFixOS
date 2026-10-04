import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, UserPlus, Wrench, Lock, Dices, Check, ChevronLeft, ChevronRight, Users, UserX, Trash2, Clock } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { Banner, Input, Switch, W, money } from "@/components/wizard/ui";
import { supabase } from "../../../../../lib/supabase-client.js";
import { subscribeTimeEntries, closeEntry, matchIdsFor, shortTime } from "@/lib/punchApi";
import { hoursLabel } from "@/lib/finance/payroll";
import {
  ROLE_ORDER, ROLE_META, ADMIN_LEVEL, rolesOf, roleColor, roleLabels, isAdminLevel, isActive, randomPin, planLimit, limitMessage, countActive, fetchEmployees, liveState, workingSince, openOrdersOf, employeeRate,
  updateEmployee, setPushEnabled, resetPin, deactivate, reactivate, hasAnyHistory, deleteEmployee, deactivationPreflight, ConflictError, fetchEmployee, sortedRoles, num,
} from "@/lib/teamApi";
import NewEmployeeDialog from "./NewEmployee";

const BRAND = "#F2662E";
const GREEN = "#4DC780";
const RED = "#FF7373";
const WARN = "#FFA640";

const dayLabel = (raw) => { if (!raw) return ""; return new Intl.DateTimeFormat("es-PR", { day: "numeric", month: "short" }).format(new Date(raw)).replace(/\./g, ""); };

function Avatar({ emp, size = 44 }) {
  const n = String(emp.full_name || "").trim();
  const init = n ? n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() : "?";
  const c = roleColor(emp);
  return <span style={{ width: size, height: size, borderRadius: 999, background: tint(c, 0.2), color: c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 800, flexShrink: 0 }}>{init}</span>;
}

function Section({ title, footer, children, disabled }) {
  return (
    <div className="flex flex-col" style={{ gap: 6, opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
      {title && <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>{title}</p>}
      <div style={{ borderRadius: 16, background: "#1C1C1E", padding: 14 }}>{children}</div>
      {footer && <p style={{ fontSize: 12, color: W.sub }}>{footer}</p>}
    </div>
  );
}

function DeactivateDialog({ open, emp, tenant, onClose, onDone }) {
  const [pre, setPre] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open || !emp) return;
    setPre(null); setError(null);
    deactivationPreflight(emp, tenant).then(setPre, () => setPre({ openEntry: null, unpaidHours: 0, balance: 0, hasPayroll: false, openOrders: 0, commission: 0 }));
  }, [open, emp?.id, emp?.updated_at]);
  if (!emp) return null;
  const closeShift = async () => {
    if (!pre?.openEntry) return;
    try { await closeEntry({ entryId: pre.openEntry.id, tenantId: emp.tenant_id }); setPre({ ...pre, openEntry: null }); } catch (e) { setError(e?.message || String(e)); }
  };
  const go = async () => {
    setBusy(true); setError(null);
    try { onDone(await deactivate(emp)); onClose(); } catch (e) { if (e instanceof ConflictError && e.fresh) onDone(e.fresh); setError(e?.message || String(e)); } finally { setBusy(false); }
  };
  const nothing = pre && !pre.openEntry && !(pre.unpaidHours > 0 || pre.balance > 0) && !pre.openOrders && !(pre.commission > 0);
  const row = (l, v, extra) => <div key={l} className="flex items-center gap-2" style={{ padding: "8px 0", fontSize: 14 }}><span className="flex-1" style={{ color: W.sub }}>{l}</span><span style={{ fontWeight: 600 }}>{v}</span>{extra}</div>;
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Desactivar empleado" width={460} leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={<TextAction bold color={WARN} onClick={go} disabled={busy || !pre}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Desactivar"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        <p style={{ fontSize: 17, fontWeight: 700 }}>¿Desactivar a {emp.full_name}?</p>
        <p style={{ fontSize: 13, color: W.sub }}>No podrá entrar con su PIN ni ponchar. Sus horas, pagos y comisiones se guardan. Puedes reactivarlo cuando quieras.</p>
        {!pre ? <div className="flex justify-center" style={{ padding: 16 }}><Loader2 className="w-5 h-5 animate-spin" style={{ color: W.sub }} /></div> : (
          <div style={{ borderRadius: 14, background: "#2C2C2E", padding: "4px 14px" }}>
            {pre.openEntry && row("Turno abierto", `desde ${shortTime(new Date(pre.openEntry.clock_in), tenant?.timezone || undefined)}`, <button onClick={closeShift} className="apple-press" style={{ color: BRAND, fontWeight: 700, fontSize: 13 }}>Cerrar turno ahora</button>)}
            {(pre.unpaidHours > 0 || pre.balance > 0) && row("Horas sin pagar", `${hoursLabel(pre.unpaidHours)} · ${money(pre.balance)}`)}
            {pre.openOrders > 0 && row("Órdenes asignadas", pre.openOrders)}
            {pre.commission > 0 && row("Comisión pendiente", money(pre.commission))}
            {nothing && <p style={{ padding: "10px 0", fontSize: 14, color: W.sub }}>Sin pendientes.</p>}
          </div>
        )}
        <p style={{ fontSize: 12, color: W.sub }}>Nada de esto bloquea la desactivación, es solo un aviso.</p>
        {error && <Banner color={RED}>{error}</Banner>}
      </div>
    </Dialog>
  );
}

function ReactivateDialog({ open, emp, onClose, onDone, atLimit, limitText }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { if (open) { setPin(randomPin()); setError(null); } }, [open, emp?.id]);
  if (!emp) return null;
  const go = async () => {
    if (atLimit) { setError(limitText); return; }
    setBusy(true); setError(null);
    try { onDone(await reactivate(emp, pin)); onClose(); } catch (e) { if (e instanceof ConflictError && e.fresh) onDone(e.fresh); setError(e?.message || String(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title="Reactivar empleado" width={420} leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={<TextAction bold color={GREEN} onClick={go} disabled={busy || pin.length !== 4}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reactivar empleado"}</TextAction>}>
      <div className="flex flex-col" style={{ gap: 12, paddingTop: 8 }}>
        <p style={{ fontSize: 17, fontWeight: 700 }}>Reactivar a {emp.full_name}</p>
        <p style={{ fontSize: 13, color: W.sub }}>PIN temporal (se le pedirá cambiarlo al entrar)</p>
        <Input label="PIN temporal" value={pin} onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 4))} placeholder="4 dígitos" inputMode="numeric" mono />
        <button onClick={() => setPin(randomPin())} className="apple-press self-start flex items-center gap-1" style={{ color: BRAND, fontWeight: 700, fontSize: 14 }}><Dices className="w-4 h-4" /> Otro PIN aleatorio</button>
        <p style={{ fontSize: 12, color: W.sub }}>El PIN no se muestra después; comunícaselo al empleado.</p>
        {error && <Banner color={RED}>{error}</Banner>}
      </div>
    </Dialog>
  );
}

function Profile({ emp, self, tenant, atLimit, limitText, onSaved, onBack, onDeleted }) {
  const selfRoles = rolesOf(self);
  const selfAdmin = isAdminLevel(selfRoles);
  const selfIsOwner = selfRoles.includes("owner");
  const sameAsSelf = !!self && [self.id, self.auth_user_id].some((x) => x && (x === emp.id || x === emp.auth_user_id));
  const restricted = !selfAdmin && !sameAsSelf;
  const isOwnerEmp = rolesOf(emp).includes("owner");
  const inactive = !isActive(emp);

  const [name, setName] = useState(emp.full_name || "");
  const [email, setEmail] = useState(emp.email || "");
  const [phone, setPhone] = useState(emp.phone || "");
  const [roles, setRoles] = useState(rolesOf(emp));
  const [push, setPush] = useState(emp.push_enabled !== false);
  const [newPin, setNewPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [deactOpen, setDeactOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const [delState, setDelState] = useState(null);
  const [canDelete, setCanDelete] = useState(null);

  useEffect(() => {
    setName(emp.full_name || ""); setEmail(emp.email || ""); setPhone(emp.phone || ""); setRoles(rolesOf(emp)); setPush(emp.push_enabled !== false);
  }, [emp.id, emp.updated_at]);

  useEffect(() => { setNewPin(""); setError(null); setNotice(null); }, [emp.id]);

  useEffect(() => {
    setCanDelete(null);
    if (!selfIsOwner || isOwnerEmp) return;
    hasAnyHistory(emp).then((h) => setCanDelete(!h), () => setCanDelete(false));
  }, [emp.id, selfIsOwner, isOwnerEmp]);

  useEffect(() => { if (!pinSaved) return undefined; const t = setTimeout(() => setPinSaved(false), 2000); return () => clearTimeout(t); }, [pinSaved]);

  const toggleRole = (r) => {
    if (r === "owner" && (isOwnerEmp || !selfIsOwner)) return;
    setRoles((prev) => { const has = prev.includes(r); if (has && prev.length === 1) return prev; return has ? prev.filter((x) => x !== r) : [...prev, r]; });
  };

  const save = async () => {
    if (busy) return;
    if (!name.trim()) { setError("El nombre no puede estar vacío."); return; }
    const rolesChanged = sortedRoles(roles).join(",") !== sortedRoles(rolesOf(emp)).join(",");
    const emailChanged = String(email || "").trim() !== String(emp.email || "").trim();
    if (restricted && (rolesChanged || emailChanged)) { setError("Solo el dueño o un administrador puede cambiar rol, correo, tarifa o estado."); return; }
    const v = (x) => String(x || "").trim();
    const unchanged = v(name) === v(emp.full_name) && !rolesChanged && v(email) === v(emp.email) && v(phone) === v(emp.phone);
    setBusy(true); setError(null);
    try {
      if (unchanged) {
        const cur = await fetchEmployee(emp.tenant_id, emp.id);
        if (!cur) throw new ConflictError("Este empleado ya no existe.");
        setNotice("Cambios guardados");
        return;
      }
      const upd = await updateEmployee(emp, { fullName: name, roles, email, phone });
      onSaved(upd);
      setNotice("Cambios guardados");
    } catch (e) {
      if (e instanceof ConflictError && e.fresh) onSaved(e.fresh);
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  const togglePush = async (v) => {
    setPush(v);
    try { await setPushEnabled(emp, v); onSaved({ ...emp, push_enabled: v }); } catch (e) { setPush(!v); setError(e?.message || String(e)); }
  };

  const savePin = async () => {
    if (newPin.length !== 4 || busy) return;
    setBusy(true); setError(null);
    try { onSaved(await resetPin(emp, newPin)); setNewPin(""); setPinSaved(true); } catch (e) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };

  const tryDeactivate = () => {
    if (restricted || !selfAdmin) { setError("Solo el dueño o un administrador puede cambiar rol, correo, tarifa o estado."); return; }
    if (isOwnerEmp) { setError("El dueño no se puede desactivar"); return; }
    if (sameAsSelf) { setError("No puedes desactivarte a ti mismo"); return; }
    setDeactOpen(true);
  };

  const doDelete = async () => {
    try {
      if (await hasAnyHistory(emp)) { setDelState(null); setError("Ya no se puede borrar: ahora tiene ponches, pagos u órdenes."); setCanDelete(false); return; }
      await deleteEmployee(emp);
      onDeleted(emp);
    } catch (e) { setError(e?.message || String(e)); }
  };

  const mgmtBtn = (title, sub, color, onClick, Icon) => (
    <button onClick={onClick} className="apple-press w-full flex items-center gap-3 text-left">
      <span style={{ width: 38, height: 38, borderRadius: 12, background: tint(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-5 h-5" /></span>
      <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600, color }}>{title}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{sub}</span></span>
    </button>
  );

  const since = inactive ? dayLabel(emp.updated_at) : null;
  return (
    <div className="flex flex-col" style={{ gap: 16, padding: 16 }}>
      {onBack && <button onClick={onBack} className="apple-press flex items-center gap-1 self-start" style={{ color: BRAND, fontWeight: 600 }}><ChevronLeft className="w-5 h-5" /> Empleados</button>}
      <div className="flex items-center gap-3">
        <Avatar emp={emp} size={56} />
        <span className="flex-1 min-w-0">
          <span className="block truncate" style={{ fontSize: 22, fontWeight: 800 }}>{emp.full_name}</span>
          <span className="flex items-center flex-wrap" style={{ gap: 6, marginTop: 2 }}>
            <span style={{ padding: "2px 10px", borderRadius: 999, background: tint(roleColor(emp), 0.16), color: roleColor(emp), fontSize: 12, fontWeight: 700 }}>{roleLabels(rolesOf(emp)).join(" · ")}</span>
            {inactive && <span style={{ padding: "2px 10px", borderRadius: 999, background: "#3A3A3C", color: W.sub, fontSize: 12, fontWeight: 600 }}>Inactivo desde {since}</span>}
          </span>
          <span className="block truncate" style={{ fontSize: 12, color: W.sub }}>{[emp.email, emp.phone].filter(Boolean).join(" · ")}</span>
        </span>
        <button onClick={save} disabled={busy} className="apple-press disabled:opacity-50" style={{ padding: "9px 18px", borderRadius: 999, background: BRAND, color: "#fff", fontWeight: 700 }}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</button>
      </div>
      {error && <Banner color={RED} onDismiss={() => setError(null)}>{error}</Banner>}
      {notice && <Banner color={GREEN} onDismiss={() => setNotice(null)}>{notice}</Banner>}

      <Section title="Información" footer={restricted ? "Solo el dueño o un administrador puede cambiar rol, correo, tarifa o estado." : null}>
        <div className="flex flex-col" style={{ gap: 10 }}>
          <Input label="Nombre" value={name} onChange={setName} placeholder="Nombre completo" />
          <Input label="Email" value={email} onChange={setEmail} placeholder="email@ejemplo.com" type="email" disabled={restricted} />
          <Input label="Teléfono" value={phone} onChange={setPhone} placeholder="(787) 000-0000" inputMode="tel" />
          <div className="flex items-center" style={{ paddingTop: 4 }}><span className="flex-1" style={{ fontSize: 15 }}>Notificaciones push</span><Switch on={push} onChange={togglePush} color={GREEN} label="Notificaciones push" /></div>
        </div>
      </Section>

      <Section title="Roles" footer={isOwnerEmp ? "Puedes marcar varios — los permisos se suman. El rol de Dueño no se puede quitar." : "Puedes marcar varios — los permisos se suman. Con Técnico marcado, esta persona aparece al asignar trabajos."} disabled={restricted}>
        <div style={{ margin: -14 }}>
          {ROLE_ORDER.map((r, i) => {
            const on = roles.includes(r);
            const locked = r === "owner" && (isOwnerEmp || !selfIsOwner);
            return (
              <button key={r} onClick={() => toggleRole(r)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none", opacity: locked && !on ? 0.4 : 1 }}>
                <span className="flex-1" style={{ fontSize: 15, fontWeight: 600, color: ROLE_META[r].color }}>{ROLE_META[r].label}</span>
                {locked && on ? <Lock className="w-4 h-4" style={{ color: W.sub }} /> : on ? <Check className="w-4 h-4" style={{ color: BRAND }} strokeWidth={3} /> : null}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="PIN de acceso" disabled={inactive || restricted} footer={inactive ? "El empleado está inactivo — reactívalo para darle un PIN nuevo." : "Por seguridad el PIN no se muestra. Escribe uno nuevo para resetearlo — el empleado lo usará para entrar y se le pedirá cambiarlo en su próximo login."}>
        <div className="flex flex-col" style={{ gap: 10 }}>
          <div className="flex items-center"><span className="flex-1" style={{ fontSize: 15 }}>PIN actual</span><span className="flex items-center gap-1" style={{ color: W.sub }}><Lock className="w-3.5 h-3.5" /> Oculto</span></div>
          <div className="flex items-center gap-2">
            <input value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="4 dígitos" aria-label="Nuevo PIN" className="outline-none flex-1" style={{ background: "#2C2C2E", color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, fontFamily: "ui-monospace, Menlo, monospace", minWidth: 0 }} />
            <button onClick={() => setNewPin(randomPin())} className="apple-press flex items-center gap-1" style={{ padding: "10px 12px", borderRadius: 12, background: "#3A3A3C", fontSize: 13, fontWeight: 700 }}><Dices className="w-4 h-4" /> Aleatorio</button>
            <button onClick={savePin} disabled={newPin.length !== 4 || busy} className="apple-press disabled:opacity-40" style={{ padding: "10px 14px", borderRadius: 12, background: pinSaved ? tint(GREEN, 0.2) : BRAND, color: pinSaved ? GREEN : "#fff", fontSize: 13, fontWeight: 700 }}>{pinSaved ? "Guardado" : "Guardar PIN"}</button>
          </div>
        </div>
      </Section>

      <Section title="Gestión">
        <div className="flex flex-col" style={{ gap: 14 }}>
          {isOwnerEmp ? <p style={{ fontSize: 14, color: W.sub }}>El dueño no se puede desactivar</p>
            : sameAsSelf ? <p style={{ fontSize: 14, color: W.sub }}>No puedes desactivarte a ti mismo</p>
              : restricted || !selfAdmin ? <p style={{ fontSize: 14, color: W.sub }}>Solo el dueño o un administrador puede cambiar rol, correo, tarifa o estado.</p>
                : inactive ? mgmtBtn("Reactivar empleado", "Le da un PIN temporal y restaura su acceso", GREEN, () => setReactOpen(true), Users)
                  : mgmtBtn("Desactivar empleado", "No podrá entrar con su PIN ni ponchar. Sus horas y pagos se guardan.", WARN, tryDeactivate, UserX)}
          {selfIsOwner && !isOwnerEmp && (
            <button onClick={() => canDelete && setDelState(true)} disabled={!canDelete} className="apple-press w-full flex items-center gap-3 text-left disabled:opacity-60">
              <span style={{ width: 38, height: 38, borderRadius: 12, background: tint(RED, 0.16), color: RED, display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 className="w-5 h-5" /></span>
              <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600, color: RED }}>Borrar definitivamente</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{canDelete === null ? "Revisando historial…" : canDelete ? "Sin ponches, pagos ni órdenes — se puede borrar" : "Tiene ponches, pagos u órdenes — no se puede borrar"}</span></span>
            </button>
          )}
        </div>
      </Section>

      <DeactivateDialog open={deactOpen} emp={emp} tenant={tenant} onClose={() => setDeactOpen(false)} onDone={onSaved} />
      <ReactivateDialog open={reactOpen} emp={emp} atLimit={atLimit} limitText={limitText} onClose={() => setReactOpen(false)} onDone={onSaved} />
      <AlertDialog open={!!delState} title={`¿Borrar a ${emp.full_name} definitivamente?`} message="Esta acción es irreversible. Solo se puede hacer porque no tiene ponches, pagos ni órdenes." onClose={() => setDelState(null)}
        actions={[{ label: "Cancelar" }, { label: "Borrar definitivamente", destructive: true, onPress: doDelete }]} />
    </div>
  );
}

export default function Empleados({ tenant, tenantId, self, onSelfUpdated }) {
  const [rows, setRows] = useState(null);
  const [live, setLive] = useState({ working: {}, counts: {} });
  const [error, setError] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [limitAlert, setLimitAlert] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const [desktop, setDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 900px)").matches);

  useEffect(() => {
    const m = window.matchMedia("(min-width: 900px)");
    const on = () => setDesktop(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  const selfAdmin = isAdminLevel(rolesOf(self));
  const tz = tenant?.timezone;

  const load = useCallback(async () => {
    try {
      const [emps, lv, cnt] = await Promise.all([fetchEmployees(tenantId), liveState(tenantId, tz), countActive(tenantId).catch(() => 0)]);
      setRows(emps); setLive(lv); setActiveCount(cnt); setError(null);
    } catch (e) { setError(e?.message || String(e)); setRows((p) => p || []); }
  }, [tenantId, tz]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribeTimeEntries(tenantId, () => liveState(tenantId, tz).then(setLive).catch(() => {})), [tenantId, tz]);

  const active = useMemo(() => (rows || []).filter(isActive), [rows]);
  const inactive = useMemo(() => (rows || []).filter((e) => !isActive(e)), [rows]);
  const visible = showInactive ? [...active, ...inactive] : active;
  const selected = (rows || []).find((e) => e.id === selectedId) || null;

  useEffect(() => {
    if (desktop && rows && rows.length && !selected) setSelectedId(visible[0]?.id || null);
  }, [desktop, rows]);

  const atLimit = activeCount >= planLimit(tenant?.plan);
  const replace = (emp) => { setRows((prev) => (prev || []).map((e) => (e.id === emp.id ? { ...e, ...emp } : e))); if (self && [self.id, self.auth_user_id].some((x) => x && (x === emp.id || x === emp.auth_user_id))) onSelfUpdated?.(); };

  const openNew = () => { if (atLimit) { setLimitAlert(true); return; } setNewOpen(true); };

  const card = (emp) => {
    const since = workingSince(emp, live);
    const sel = desktop && emp.id === selectedId;
    const inact = !isActive(emp);
    return (
      <button key={emp.id} onClick={() => { setSelectedId(emp.id); setMobileOpen(true); }} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderRadius: 16, background: sel ? "rgba(242,102,46,0.10)" : "#1C1C1E", border: `1px solid ${since ? tint(GREEN, 0.35) : sel ? tint(BRAND, 0.4) : "transparent"}`, opacity: inact ? 0.7 : 1 }}>
        <Avatar emp={emp} size={48} />
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2 flex-wrap"><span className="truncate" style={{ fontSize: 16, fontWeight: 700 }}>{emp.full_name}</span>{inact && <span style={{ padding: "1px 8px", borderRadius: 999, background: "#3A3A3C", color: W.sub, fontSize: 11 }}>Inactivo desde {dayLabel(emp.updated_at)}</span>}</span>
          <span className="block truncate" style={{ fontSize: 12, color: roleColor(emp), fontWeight: 600 }}>{roleLabels(rolesOf(emp)).join(" · ")}</span>
          <span className="flex items-center gap-3" style={{ fontSize: 12, color: W.sub, marginTop: 2 }}><span className="flex items-center gap-1"><Wrench className="w-3 h-3" /> {openOrdersOf(emp, live)} órdenes</span><span>{employeeRate(emp) > 0 ? `${money(employeeRate(emp))}/h` : "—"}</span></span>
        </span>
        <span className="flex items-center gap-1" style={{ padding: "3px 10px", borderRadius: 999, background: since ? tint(GREEN, 0.16) : "#2C2C2E", color: since ? GREEN : W.sub, fontSize: 12, fontWeight: 700 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: since ? GREEN : W.sub }} /> {since ? `Trabajando · ${shortTime(new Date(since), tz || undefined)}` : "Fuera"}
        </span>
        <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
      </button>
    );
  };

  const list = (
    <div className="flex flex-col" style={{ gap: 10 }}>
      <div className="flex items-center gap-2">
        <h2 className="flex-1" style={{ fontSize: 26, fontWeight: 800 }}>Empleados</h2>
        {selfAdmin && <button onClick={openNew} aria-label="Nuevo empleado" title="Nuevo empleado" className="apple-press flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 999, background: BRAND, color: "#fff" }}><UserPlus className="w-5 h-5" /></button>}
      </div>
      {error && <Banner color={RED} onDismiss={() => setError(null)}>{error}</Banner>}
      {inactive.length > 0 && <button onClick={() => setShowInactive((v) => !v)} className="apple-press self-start" style={{ padding: "6px 12px", borderRadius: 999, background: showInactive ? tint(BRAND, 0.16) : "#2C2C2E", color: showInactive ? BRAND : W.sub, fontSize: 13, fontWeight: 600 }}>Mostrar inactivos ({inactive.length})</button>}
      {rows === null ? <div className="flex items-center justify-center gap-2" style={{ padding: 40, color: W.sub }}><Loader2 className="w-5 h-5 animate-spin" /> Cargando empleados…</div>
        : !visible.length ? <div className="flex flex-col items-center text-center" style={{ padding: "40px 16px", gap: 8, color: W.sub }}><Users className="w-8 h-8" /><b style={{ color: "#fff" }}>Sin empleados</b><span>Aún no hay empleados activos para este taller.</span></div>
          : <div className="flex flex-col" style={{ gap: 10 }}>{visible.map(card)}</div>}
      {rows !== null && <p style={{ fontSize: 12, color: W.sub }}>Toca un empleado para su perfil, rol y PIN. El pago y horario están en Nómina y Horario.</p>}
    </div>
  );

  const profile = selected ? <Profile key={selected.id} emp={selected} self={self} tenant={tenant} atLimit={atLimit} limitText={limitMessage(tenant?.plan)} onSaved={(e) => { replace(e); load(); }} onBack={!desktop ? () => setMobileOpen(false) : null} onDeleted={(e) => { setRows((p) => (p || []).filter((x) => x.id !== e.id)); setSelectedId(null); setMobileOpen(false); load(); }} />
    : <div className="flex items-center justify-center" style={{ height: 240, color: W.sub }}><Clock className="w-5 h-5 mr-2" /> Selecciona un empleado</div>;

  return (
    <div>
      {desktop ? (
        <div className="flex" style={{ gap: 20, alignItems: "flex-start" }}>
          <div style={{ width: 440, flexShrink: 0 }}>{list}</div>
          <div className="flex-1 min-w-0">{profile}</div>
        </div>
      ) : (mobileOpen && selected ? profile : list)}
      <NewEmployeeDialog open={newOpen} onClose={() => setNewOpen(false)} tenant={tenant} tenantId={tenantId} onCreated={() => load()} />
      <AlertDialog open={limitAlert} title="Límite alcanzado" message={limitMessage(tenant?.plan)} onClose={() => setLimitAlert(false)} actions={[{ label: "Entendido", bold: true }]} />
    </div>
  );
}

export { ADMIN_LEVEL, fetchEmployee, matchIdsFor, supabase, num };
