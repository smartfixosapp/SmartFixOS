import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Play, Square, Timer, AlertTriangle, CheckCircle2, Circle, Sun, Moon, CreditCard, Lightbulb, Package, CircleDollarSign, Power, Lock, ListChecks, Loader2, X } from "lucide-react";
import { useEscapeLayer } from "@/components/orderDetail/ui";
import { fetchTenant } from "@/lib/orderDetailApi";
import { tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { safeTZ, fmt } from "@/lib/finance/tz";
import {
  fetchOpenTenantEntries, fetchOpenEntry, weekHours, matchIdsFor, currentAuthUid, verifyEmployeePin, punchIn, closeEntry, closeAutomatically,
  requiresAutomaticClose, isFromEarlierDay, automaticCloseMessage, usesBusinessClose, entryIn, elapsedHours, hm, punchTimeLabel, shortTime,
  pinLockoutUntil, resetPinLockout, registerPinFailure, lastPunchEmployee, saveLastPunchEmployee, subscribeTimeEntries,
  shiftTasks, isShiftTaskDone, setShiftTaskDone, PunchError,
} from "@/lib/punchApi";
import { PinDots, Keypad, usePinEntry, BRAND } from "./PinPad";
import { PunchTimeField, resolvePunchTime } from "./PunchTime";
import { overlappingEntry } from "@/lib/teamTime";

const ROLE_LABEL = { owner: "Dueño", admin: "Administrador", manager: "Gerente", contable: "Contable", cashier: "Cajero", technician: "Técnico", tech: "Técnico" };
const initials = (name) => {
  const n = String(name || "").trim();
  if (!n) return "?";
  return n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
};

function Overlay({ children, z = 400, onEscape }) {
  useEscapeLayer(true, onEscape);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed inset-0 flex flex-col" style={{ zIndex: z, background: "#000", color: "#fff" }} role="dialog" aria-modal="true">{children}</div>,
    document.body
  );
}

export function PunchPinScreen({ tenantId, title, onCancel, onVerified }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [lockUntil, setLockUntil] = useState(() => pinLockoutUntil(tenantId));
  const last = useMemo(() => lastPunchEmployee(tenantId), [tenantId]);
  const locked = !!lockUntil && new Date() < lockUntil;
  const entryRef = useRef(null);

  useEffect(() => {
    if (lockUntil && new Date() < lockUntil) setError("Demasiados intentos. Espera un momento.");
  }, []);

  useEffect(() => {
    if (!lockUntil) return undefined;
    const ms = lockUntil.getTime() - Date.now();
    const release = () => { resetPinLockout(tenantId); setLockUntil(null); setError(null); };
    if (ms <= 0) { release(); return undefined; }
    const t = setTimeout(release, ms + 50);
    return () => clearTimeout(t);
  }, [lockUntil, tenantId]);

  const fail = (message) => {
    const r = registerPinFailure(tenantId);
    entryRef.current?.clear();
    if (r.locked) { setLockUntil(pinLockoutUntil(tenantId)); setError("Demasiados intentos. Bloqueado por 5 minutos."); } else setError(message || "PIN incorrecto.");
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const onComplete = useCallback(async (pin) => {
    setBusy(true);
    setError(null);
    try {
      const emp = await verifyEmployeePin({ tenantId, pin });
      if (emp.active === false) {
        entryRef.current?.clear();
        setError("Tu acceso está desactivado. Habla con el dueño del taller.");
        setBusy(false);
        return;
      }
      resetPinLockout(tenantId);
      setBusy(false);
      onVerified(emp);
    } catch (e) {
      setBusy(false);
      if (e instanceof PunchError && e.kind === "rejected") { fail(); return; }
      if (e instanceof PunchError && e.kind === "noOwner") { entryRef.current?.clear(); setError(e.message); return; }
      entryRef.current?.clear();
      setError(e instanceof PunchError && e.kind === "network" ? "Sin conexión. Intenta de nuevo." : "No se pudo verificar el PIN. Intenta de nuevo.");
    }
  }, [tenantId, onVerified]);

  const entry = usePinEntry({ length: 4, onComplete, disabled: busy || locked });
  entryRef.current = entry;
  const addDigit = (d) => {
    if (lockUntil && new Date() >= lockUntil) { resetPinLockout(tenantId); setLockUntil(null); setError(null); }
    entry.add(d);
  };

  return (
    <Overlay z={420} onEscape={onCancel}>
      <div className="flex justify-end" style={{ padding: 16 }}>
        <button onClick={onCancel} style={{ fontSize: 17, color: BRAND, fontWeight: 500 }}>Cancelar</button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: 22, padding: "0 16px 40px" }}>
        <div className="flex flex-col items-center" style={{ gap: 4 }}>
          <p style={{ fontSize: 15, color: "#8E8E93" }}>Ingresa tu PIN para</p>
          <p style={{ fontSize: 22, fontWeight: 700 }}>{title}</p>
        </div>
        {last && <span style={{ padding: "6px 12px", borderRadius: 999, background: tint(BRAND, 0.14), color: BRAND, fontSize: 13, fontWeight: 600 }}>Última vez: {last} — ¿eres tú?</span>}
        <PinDots length={4} filled={entry.pin.length} shake={shake} />
        <p style={{ minHeight: 20, fontSize: 14, color: "#FF453A", textAlign: "center" }}>{error || ""}</p>
        <Keypad onDigit={addDigit} onBack={entry.back} disabled={busy || locked} busy={busy} />
        <p style={{ fontSize: 12, color: "#8E8E93" }}>También puedes escribirlo con el teclado</p>
      </div>
    </Overlay>
  );
}

const TASK_ICON = { "creditcard.fill": CreditCard, "lightbulb.fill": Lightbulb, "shippingbox.fill": Package, "dollarsign.circle.fill": CircleDollarSign, power: Power, "lock.fill": Lock };

export function ShiftTaskGate({ kind, tenant, tenantId, tz, employeeName, cashOpen, onOpenCloseCash, onDone }) {
  const tasks = shiftTasks(tenant, kind);
  const [, force] = useState(0);
  const color = kind === "opening" ? "#FF9F0A" : FP.info;
  const Icon = kind === "opening" ? Sun : Moon;
  const toggle = (t) => { setShiftTaskDone(tenantId, tz, kind, t.id, !isShiftTaskDone(tenantId, tz, kind, t.id), employeeName); force((n) => n + 1); };
  return (
    <Overlay z={300} onEscape={onDone}>
      <div className="flex-1 overflow-y-auto" style={{ background: "#000" }}>
        <div className="mx-auto flex flex-col" style={{ maxWidth: 560, padding: "40px 16px 24px", gap: 16 }}>
          <div className="flex flex-col" style={{ gap: 4 }}>
            <p className="flex items-center gap-2" style={{ fontSize: 28, fontWeight: 800 }}><Icon className="w-7 h-7" style={{ color }} /> {kind === "opening" ? "Tareas de apertura" : "Tareas de cierre"}</p>
            <p style={{ fontSize: 15, color: "#8E8E93" }}>{kind === "opening" ? "Antes de atender, repasa esto." : "Repasa esto antes de irte."}</p>
          </div>
          {tasks.map((t) => {
            const done = isShiftTaskDone(tenantId, tz, kind, t.id);
            const TIcon = TASK_ICON[t.icon] || ListChecks;
            const cash = kind === "closing" && /efectivo/i.test(t.label) && cashOpen && !done;
            return (
              <div key={t.id} className="flex items-center gap-3" style={{ padding: 14, borderRadius: 16, background: done ? tint(color, 0.08) : "#1C1C1E", border: `1px solid ${done ? tint(color, 0.3) : "transparent"}` }}>
                <button onClick={() => (cash ? onOpenCloseCash?.(() => { setShiftTaskDone(tenantId, tz, kind, t.id, true, employeeName); force((n) => n + 1); }) : toggle(t))} aria-label={done ? "Marcar pendiente" : "Marcar hecha"} className="flex items-center gap-3 flex-1 text-left">
                  {done ? <CheckCircle2 className="w-6 h-6" style={{ color }} /> : <Circle className="w-6 h-6" style={{ color: "#8E8E93" }} />}
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: tint(color, 0.15), color, display: "flex", alignItems: "center", justifyContent: "center" }}><TIcon className="w-4 h-4" /></span>
                  <span style={{ fontSize: 16, textDecoration: done ? "line-through" : "none", color: done ? "#8E8E93" : "#fff" }}>{t.label}</span>
                </button>
                {cash && <button onClick={() => onOpenCloseCash?.(() => { setShiftTaskDone(tenantId, tz, kind, t.id, true, employeeName); force((n) => n + 1); })} style={{ fontSize: 14, fontWeight: 700, color }}>Abrir</button>}
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ padding: 16, borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
        <button onClick={onDone} className="apple-press w-full mx-auto block" style={{ maxWidth: 560, height: 52, borderRadius: 16, background: color, color: "#fff", fontSize: 17, fontWeight: 700 }}>
          {kind === "opening" ? "Listo, ya adentro" : "Listo, taller cerrado"}
        </button>
      </div>
    </Overlay>
  );
}

function ChoiceDialog({ title, message, actions, onClose }) {
  useEscapeLayer(true, onClose);
  return createPortal(
    <div className="apple-type fixed inset-0 flex items-center justify-center" style={{ zIndex: 440, padding: 16 }} role="alertdialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose} />
      <div className="relative w-full" style={{ maxWidth: 320, background: "#2C2C2E", borderRadius: 16, color: "#fff", overflow: "hidden" }}>
        <div className="text-center" style={{ padding: "18px 16px 14px" }}>
          <p style={{ fontSize: 17, fontWeight: 600 }}>{title}</p>
          {message && <p style={{ fontSize: 13, marginTop: 4, color: "rgba(255,255,255,0.85)" }}>{message}</p>}
        </div>
        <div className="flex flex-col" style={{ borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
          {actions.map((a, i) => (
            <button key={a.label} onClick={() => { onClose(); a.onPress?.(); }} style={{ padding: "12px 0", fontSize: 16, fontWeight: a.bold ? 600 : 400, color: a.destructive ? "#FF453A" : "#0A84FF", borderTop: i ? "0.5px solid rgba(84,84,88,0.6)" : "none" }}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function PunchKiosk({ open, onClose, tenantId, tenant, sessionEmployee, cashOpen, onOpenCloseCash, onChanged }) {
  const tz = safeTZ(tenant?.timezone);
  const hours = tenant?.settings?.business_hours;
  const [now, setNow] = useState(() => new Date());
  const [timeText, setTimeText] = useState(null);
  const [onDuty, setOnDuty] = useState([]);
  const [selfOpen, setSelfOpen] = useState(null);
  const [week, setWeek] = useState(0);
  const [error, setError] = useState(null);
  const [pinFor, setPinFor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [choice, setChoice] = useState(null);
  const [done, setDone] = useState(null);
  const [gate, setGate] = useState(null);
  const [authUid, setAuthUid] = useState(null);
  const selfIds = useMemo(() => matchIdsFor(sessionEmployee, authUid), [sessionEmployee, authUid]);
  const selfName = String(sessionEmployee?.full_name || "").trim() || "Usuario";

  const load = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [list, mine, w] = await Promise.all([
        fetchOpenTenantEntries(tenantId),
        selfIds.length ? fetchOpenEntry(tenantId, selfIds) : Promise.resolve(null),
        selfIds.length ? weekHours({ tenantId, matchIds: selfIds, tz }) : Promise.resolve(0),
      ]);
      setOnDuty(list);
      setSelfOpen(mine);
      setWeek(w);
    } catch (e) {
      setError(e?.message || String(e));
    }
  }, [tenantId, selfIds, tz]);

  useEffect(() => {
    if (!open) return undefined;
    setError(null);
    setDone(null);
    setGate(null);
    currentAuthUid().then(setAuthUid);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [open]);

  useEffect(() => {
    if (!open || !tenantId) return undefined;
    load();
    return subscribeTimeEntries(tenantId, load);
  }, [open, tenantId, load]);

  if (!open) return null;

  const isSelf = (emp) => !!emp?.id && selfIds.includes(emp.id);
  const punchedIn = !!selfOpen;
  const statusText = punchedIn ? `Ponchado · entrada ${shortTime(entryIn(selfOpen), tz)}` : "Sin ponchar · Listo para entrar";
  const statusColor = punchedIn ? FP.success : "#8E8E93";
  const RANK = { owner: 0, admin: 1, manager: 2, contable: 3, cashier: 4, technician: 5, tech: 5 };
  const roles = (Array.isArray(sessionEmployee?.roles) && sessionEmployee.roles.length ? sessionEmployee.roles : [sessionEmployee?.role].filter(Boolean)).map((r) => String(r).toLowerCase()).sort((a, b) => (RANK[a] ?? 9) - (RANK[b] ?? 9));
  const roleLine = [ROLE_LABEL[roles[0]] || (roles[0] ? roles[0].charAt(0).toUpperCase() + roles[0].slice(1) : "Empleado"), tenant?.name].filter(Boolean).join(" · ");
  const weekLabel = (() => { const x = hm(week); return `Esta semana: ${x.h}h ${x.m}m`; })();
  const selfElapsed = punchedIn ? hm(elapsedHours(selfOpen, now)) : null;
  const longHours = punchedIn ? Math.floor(elapsedHours(selfOpen, now)) : 0;

  const finish = (action, employee, at) => {
    saveLastPunchEmployee(tenantId, employee.full_name);
    setDone({ action, name: String(employee.full_name || "").trim() || "Usuario", at: at || new Date(), self: isSelf(employee) });
    load();
    onChanged?.();
  };

  const doClockIn = async (employee) => {
    const when = resolvePunchTime(timeText);
    if (when.error) { setError(when.error); return; }
    setBusy(true);
    try {
      if (when.backdated) {
        const conflict = await overlappingEntry({ tenantId, matchIds: matchIdsFor(employee), clockIn: when.at, clockOut: null, tz });
        if (conflict) { setError(conflict.message); setBusy(false); return; }
      }
      await punchIn({ tenantId, employee, at: when.at });
      setTimeText(null);
      finish("in", employee, when.at);
    } catch (e) {
      if (e instanceof PunchError && e.kind === "alreadyOpen") await handleExistingOpen(e.entry, employee);
      else setError(e?.message ? `No se pudo confirmar el ponche. Revisa tu conexión e intenta de nuevo.` : "Sin conexión. Intenta de nuevo.");
    }
    setBusy(false);
  };

  const freshHours = async () => {
    const t = await fetchTenant(tenantId);
    if (!t) throw new PunchError("tenant");
    return t.settings?.business_hours;
  };
  const CONFIRM_FAIL = "No se pudo confirmar el ponche. Revisa tu conexión e intenta de nuevo.";

  const handleExistingOpen = async (entry, employee) => {
    const self = isSelf(employee);
    if (isFromEarlierDay(entry, tz)) {
      let h;
      try { h = await freshHours(); } catch { setError(CONFIRM_FAIL); return; }
      if (requiresAutomaticClose(entry, h, tz)) {
        const since = punchTimeLabel(entryIn(entry), tz);
        setChoice({
          title: self ? `Tienes un turno abierto desde ${since}` : `${employee.full_name} tiene un turno abierto desde ${since}`,
          message: automaticCloseMessage(entryIn(entry), h, tz),
          actions: [
            { label: "Cerrar y ponchar entrada", bold: true, onPress: async () => { setBusy(true); try { const h2 = await freshHours(); await closeAutomatically(entry, h2, tz, tenantId); await doClockIn(employee); } catch { setError(CONFIRM_FAIL); } setBusy(false); } },
            { label: "Dejarlo abierto" },
          ],
        });
        return;
      }
    }
    const since = punchTimeLabel(entryIn(entry), tz);
    setError(self ? `Ya estabas ponchado desde ${since}.` : `${employee.full_name} ya estaba ponchado desde ${since}.`);
    load();
  };

  const doClose = async (employee, entry) => {
    const when = resolvePunchTime(timeText);
    if (when.error) { setError(when.error); return; }
    setBusy(true);
    try {
      const r = await closeEntry({ entryId: entry.id, at: when.at, tenantId });
      if (r.status === "closed") { setTimeText(null); finish("out", employee, when.at); }
      else { setError(isSelf(employee) ? "Tu turno ya estaba cerrado." : `${employee.full_name} no tiene un turno abierto.`); load(); }
    } catch {
      setError("No se pudo confirmar el ponche. Revisa tu conexión e intenta de nuevo.");
    }
    setBusy(false);
  };

  const submit = async (employee, intent) => {
    setError(null);
    if (!employee?.id) { setError("No se pudo identificar al empleado."); return; }
    const ids = matchIdsFor(employee);
    let open;
    try {
      open = await fetchOpenEntry(tenantId, ids);
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
      return;
    }
    if (intent === "in") {
      if (open) await handleExistingOpen(open, employee);
      else await doClockIn(employee);
      return;
    }
    if (!open) { setError(isSelf(employee) ? "Tu turno ya estaba cerrado." : `${employee.full_name} no tiene un turno abierto.`); load(); return; }
    let outHours = hours;
    if (isFromEarlierDay(open, tz)) {
      try { outHours = await freshHours(); } catch { setError(CONFIRM_FAIL); return; }
    }
    if (requiresAutomaticClose(open, outHours, tz)) {
      const since = punchTimeLabel(entryIn(open), tz);
      setChoice({
        title: isSelf(employee) ? `Tienes un turno abierto desde ${since}` : `${employee.full_name} tiene un turno abierto desde ${since}`,
        message: automaticCloseMessage(entryIn(open), outHours, tz),
        actions: [
          { label: usesBusinessClose(entryIn(open), outHours, tz) ? "Cerrar a la hora de cierre" : "Cerrar con tope de 12 horas", bold: true, onPress: async () => { setBusy(true); try { const h2 = await freshHours(); const r = await closeAutomatically(open, h2, tz, tenantId); if (r.status === "closed") finish("out", employee, r.entry?.clock_out ? new Date(r.entry.clock_out) : undefined); else load(); } catch { setError(CONFIRM_FAIL); } setBusy(false); } },
          { label: "Dejarlo abierto" },
        ],
      });
      return;
    }
    if (isSelf(employee)) { await doClose(employee, open); return; }
    const x = hm(elapsedHours(open));
    setChoice({
      title: `¿Cerrar el turno de ${employee.full_name}?`,
      message: `Lleva ${x.h}h ${x.m}m ponchado(a) — confirma que es correcto antes de registrar su salida.`,
      actions: [{ label: "Sí, cerrar turno", bold: true, onPress: () => doClose(employee, open) }, { label: "Cancelar" }],
    });
  };

  const afterDone = async () => {
    const action = done?.action;
    setDone(null);
    if (action === "in" && shiftTasks(tenant, "opening").some((t) => !isShiftTaskDone(tenantId, tz, "opening", t.id))) { setGate("opening"); return; }
    if (action === "out") {
      const still = await fetchOpenTenantEntries(tenantId).catch(() => onDuty);
      if (still.length === 0 && shiftTasks(tenant, "closing").some((t) => !isShiftTaskDone(tenantId, tz, "closing", t.id))) { setGate("closing"); return; }
    }
    onClose();
  };

  const clock = fmt(now, tz, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const dateLine = fmt(now, tz, { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

  return (
    <>
      {!gate && <Overlay z={400} onEscape={() => { if (!pinFor && !choice) onClose(); }}>
        <div className="flex justify-end" style={{ padding: 16 }}>
          <button onClick={onClose} style={{ fontSize: 17, color: BRAND, fontWeight: 500 }}>Cancelar</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex flex-col items-center text-center" style={{ maxWidth: 760, padding: "0 16px 32px", gap: 22 }}>
            <div className="flex flex-col items-center" style={{ gap: 4 }}>
              <span style={{ fontSize: "clamp(52px, 11vw, 96px)", fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.05 }}>{clock}</span>
              <span style={{ fontSize: 18, fontWeight: 500, color: "#8E8E93" }}>{dateLine}</span>
            </div>
            <div className="flex flex-col items-center" style={{ gap: 8 }}>
              <span style={{ width: 128, height: 128, borderRadius: 999, background: tint(punchedIn ? FP.warning : BRAND, 0.2), color: punchedIn ? FP.warning : BRAND, border: `4px solid ${tint(punchedIn ? FP.warning : BRAND, 0.35)}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, fontWeight: 700 }}>{initials(selfName)}</span>
              <span className="truncate" style={{ maxWidth: "100%", fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 700 }}>{selfName}</span>
              <span style={{ fontSize: 18, fontWeight: 500, color: "#8E8E93" }}>{roleLine}</span>
            </div>
            <span className="flex items-center gap-2" style={{ padding: "8px 18px", borderRadius: 999, background: tint(statusColor, 0.14), border: `1px solid ${tint(statusColor, 0.28)}`, color: statusColor, fontSize: 18, fontWeight: 600 }}>
              <span style={{ width: 14, height: 14, borderRadius: 999, background: statusColor }} /> {statusText}
            </span>
            <span style={{ padding: "6px 14px", borderRadius: 999, background: tint(FP.success, 0.14), color: FP.success, fontSize: 14, fontWeight: 600 }}>{weekLabel}</span>
            <div className="w-full flex flex-col" style={{ gap: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.06em", color: "#8E8E93" }}>EN TURNO AHORA</p>
              {onDuty.length === 0 ? <p style={{ fontSize: 15, color: "#8E8E93" }}>Nadie ha ponchado todavía</p> : (
                <div className="flex overflow-x-auto" style={{ paddingBottom: 4 }}><div className="flex" style={{ gap: 16, margin: "0 auto" }}>
                  {onDuty.map((e) => (
                    <div key={e.id} className="flex flex-col items-center" style={{ width: 90, gap: 4, flexShrink: 0 }}>
                      <span style={{ width: 44, height: 44, borderRadius: 999, background: tint(FP.success, 0.2), color: FP.success, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700 }}>{initials(e.employee_name)}</span>
                      <span className="truncate w-full" style={{ fontSize: 12, fontWeight: 600 }}>{e.employee_name || "Empleado"}</span>
                      <span style={{ fontSize: 11, color: "#8E8E93" }}>{shortTime(entryIn(e), tz)}</span>
                    </div>
                  ))}
                </div></div>
              )}
            </div>
            {punchedIn && (
              <div className="w-full flex items-center gap-3 text-left" style={{ padding: 18, borderRadius: 20, background: tint(FP.success, 0.07), border: `1px solid ${tint(FP.success, 0.25)}` }}>
                <span style={{ width: 52, height: 52, borderRadius: 12, background: tint(FP.success, 0.18), color: FP.success, display: "flex", alignItems: "center", justifyContent: "center" }}><Timer className="w-6 h-6" /></span>
                <span className="flex flex-col">
                  <span style={{ fontSize: 15, color: "#8E8E93" }}>Horas trabajadas</span>
                  <span style={{ fontSize: 34, fontWeight: 700, color: FP.success, fontVariantNumeric: "tabular-nums" }}>{selfElapsed.h}h {selfElapsed.m}m</span>
                </span>
              </div>
            )}
            {punchedIn && longHours > 12 && (
              <div className="w-full flex items-center gap-3 text-left" style={{ padding: 16, borderRadius: 20, background: tint(FP.warning, 0.08), border: `1px solid ${tint(FP.warning, 0.3)}` }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, background: tint(FP.warning, 0.18), color: FP.warning, display: "flex", alignItems: "center", justifyContent: "center" }}><AlertTriangle className="w-4 h-4" /></span>
                <span className="flex-1 flex flex-col">
                  <span style={{ fontSize: 15, fontWeight: 600 }}>Llevas {longHours}h ponchado.</span>
                  <span style={{ fontSize: 12, color: "#8E8E93" }}>¿Olvidaste ponchar salida?</span>
                </span>
                <button onClick={() => setPinFor("out")} style={{ padding: "8px 12px", borderRadius: 999, background: FP.warning, color: "#fff", fontSize: 12, fontWeight: 700 }}>Ponchar salida</button>
              </div>
            )}
            {error && (
              <div className="w-full flex items-center gap-2 text-left" style={{ maxWidth: 460, padding: "10px 12px", borderRadius: 12, background: tint(FP.danger, 0.12), color: FP.danger, fontSize: 14 }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> <span className="flex-1">{error}</span>
                <button onClick={() => setError(null)} aria-label="Cerrar"><X className="w-4 h-4" /></button>
              </div>
            )}
            <div style={{ width: "100%", maxWidth: 460 }}><PunchTimeField value={timeText} onChange={setTimeText} now={now} accent={BRAND} /></div>
            <div className="flex justify-center" style={{ gap: 20, paddingTop: 8 }}>
              {[["in", "Entrar", Play, BRAND], ["out", "Salir", Square, "#FF453A"]].map(([k, label, Icon, c]) => (
                <button key={k} onClick={() => setPinFor(k)} disabled={busy} className="apple-press flex flex-col items-center justify-center disabled:opacity-50"
                  style={{ width: "min(170px, 40vw)", height: "min(170px, 40vw)", borderRadius: 32, background: c, color: "#fff", gap: 10, fontSize: 24, fontWeight: 700 }}>
                  {busy ? <Loader2 className="w-9 h-9 animate-spin" /> : <Icon className="w-10 h-10" fill="#fff" />}
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Overlay>}
      {pinFor && (
        <PunchPinScreen tenantId={tenantId} title={pinFor === "in" ? "Ponchar entrada" : "Ponchar salida"} onCancel={() => setPinFor(null)}
          onVerified={(emp) => { const intent = pinFor; setPinFor(null); submit(emp, intent); }} />
      )}
      {choice && <ChoiceDialog {...choice} onClose={() => setChoice(null)} />}
      {done && (
        <Overlay z={425} onEscape={afterDone}>
          <div className="flex-1 flex flex-col items-center justify-center text-center" style={{ gap: 14, padding: 24 }}>
            <CheckCircle2 className="w-20 h-20" style={{ color: FP.success }} />
            <p style={{ fontSize: 28, fontWeight: 800 }}>{done.action === "in" ? "Entrada registrada" : "Salida registrada"}</p>
            <p style={{ fontSize: 17, color: "#8E8E93" }}>{done.name} · {fmt(done.at, tz, { hour: "numeric", minute: "2-digit" })}</p>
            {!done.self && <p style={{ fontSize: 14, color: "#8E8E93" }}>Tu sesión sigue como {selfName}.</p>}
            <button onClick={afterDone} className="apple-press" style={{ marginTop: 12, width: 260, height: 52, borderRadius: 16, background: FP.success, color: "#fff", fontSize: 17, fontWeight: 700 }}>Listo</button>
          </div>
        </Overlay>
      )}
      {gate && (
        <ShiftTaskGate kind={gate} tenant={tenant} tenantId={tenantId} tz={tz} employeeName={selfName} cashOpen={cashOpen}
          onOpenCloseCash={onOpenCloseCash} onDone={() => { setGate(null); onClose(); }} />
      )}
    </>
  );
}
