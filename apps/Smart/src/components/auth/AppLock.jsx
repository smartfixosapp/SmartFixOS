import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LogOut } from "lucide-react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { signOut } from "@/components/auth/signOut";
import { ownerPinExists } from "@/lib/posApi";
import { workshopCode, pinLockoutUntil, resetPinLockout, registerPinFailure, verifyOwnerPinStrict, PunchError } from "@/lib/punchApi";
import { PinDots, Keypad, usePinEntry, BRAND } from "@/components/punch/PinPad";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_ROLES = ["owner", "admin", "manager", "super_admin"];

const lockKey = (tid) => `archilla_app_locked_${tid}`;

function readLocal(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function requestAppLock() {
  const tid = readLocal("smartfix_tenant_id");
  if (tid) {
    try {
      localStorage.setItem(lockKey(tid), "1");
    } catch {
      window.dispatchEvent(new Event("archilla:lock"));
      return;
    }
  }
  window.dispatchEvent(new Event("archilla:lock"));
}

function isLockedStored(tid) {
  return !!tid && readLocal(lockKey(tid)) === "1";
}

function clearLock(tid) {
  try {
    if (tid) localStorage.removeItem(lockKey(tid));
  } catch {
    return;
  }
}

function lockoutMessage(until) {
  const mins = Math.floor((until.getTime() - Date.now()) / 60000) + 1;
  return mins <= 1 ? "Demasiados intentos. Espera 1 minuto." : `Demasiados intentos. Espera ${mins} minutos.`;
}

function ConfirmSwitch({ tenantId, onCancel }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 520, padding: 16 }} role="alertdialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => !busy && onCancel()} />
      <div className="relative w-full" style={{ maxWidth: 320, background: "#2C2C2E", borderRadius: 16, overflow: "hidden", color: "#fff" }}>
        <div className="text-center" style={{ padding: "18px 16px 14px" }}>
          <p style={{ fontSize: 17, fontWeight: 600 }}>¿Cambiar de cuenta?</p>
          <p style={{ fontSize: 13, marginTop: 4, color: "rgba(255,255,255,0.85)" }}>Se cerrará la sesión y el PIN de este equipo.</p>
        </div>
        <div className="flex flex-col" style={{ borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
          <button disabled={busy} onClick={async () => { setBusy(true); clearLock(tenantId); await signOut(); }} style={{ padding: "12px 0", fontSize: 16, fontWeight: 600, color: "#FF453A" }}>{busy ? "Cerrando…" : "Cambiar de cuenta"}</button>
          <button disabled={busy} onClick={onCancel} style={{ padding: "12px 0", fontSize: 16, color: "#0A84FF", borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function LockScreen({ tenantId, onUnlock }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [failures, setFailures] = useState(() => Number(readLocal(`pin_failures_${tenantId}`)) || 0);
  const [hasOwnerPin, setHasOwnerPin] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [lockUntil, setLockUntil] = useState(() => pinLockoutUntil(tenantId));
  const [who, setWho] = useState({ name: "", email: "" });
  const tenantName = readLocal("smartfix_tenant_name");
  const entryRef = useRef(null);
  const locked = !!lockUntil && new Date() < lockUntil;

  useEffect(() => {
    ownerPinExists(tenantId).then(setHasOwnerPin).catch(() => setHasOwnerPin(false));
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      setWho({ name: u?.user_metadata?.full_name || "", email: u?.email || "" });
    }).catch(() => {});
    if (lockUntil && new Date() < lockUntil) setError(lockoutMessage(lockUntil));
  }, [tenantId]);

  useEffect(() => {
    if (!lockUntil) return undefined;
    const ms = lockUntil.getTime() - Date.now();
    const done = () => { resetPinLockout(tenantId); setLockUntil(null); setFailures(0); setError(null); };
    if (ms <= 0) { done(); return undefined; }
    const t = setTimeout(done, ms + 50);
    return () => clearTimeout(t);
  }, [lockUntil, tenantId]);

  const fail = useCallback((message) => {
    const r = registerPinFailure(tenantId);
    setFailures(r.failures);
    entryRef.current?.clear();
    if (r.locked) { setLockUntil(pinLockoutUntil(tenantId)); setError("Demasiados intentos. Bloqueado por 5 minutos."); } else setError(message || (5 - r.failures === 1 ? "1 intento restante." : `${5 - r.failures} intentos restantes.`));
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, [tenantId]);

  const onComplete = useCallback(async (pin) => {
    setBusy(true);
    setError(null);
    try {
      let ownerOk = false;
      try {
        ownerOk = await verifyOwnerPinStrict(tenantId, pin);
      } catch (e) {
        entryRef.current?.clear();
        setError(e instanceof PunchError && e.kind === "network" ? "Sin conexión. Intenta de nuevo." : "No se pudo verificar el PIN. Intenta de nuevo.");
        return;
      }
      if (ownerOk) {
        if (readLocal("smartfix_tenant_role") === "owner") {
          resetPinLockout(tenantId);
          onUnlock();
        } else {
          entryRef.current?.clear();
          setError("Para volver a la cuenta del dueño inicia sesión completa.");
          setConfirm(true);
        }
        return;
      }
      let res;
      try {
        res = await fetch(`${SUPABASE_URL}/functions/v1/employee-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ workshop_code: workshopCode(tenantId), pin }),
        });
      } catch {
        entryRef.current?.clear();
        setError("Sin conexión. Intenta de nuevo.");
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) fail();
        else { entryRef.current?.clear(); setError("No se pudo verificar el PIN. Intenta de nuevo."); }
        return;
      }
      if (body?.employee?.active === false) {
        entryRef.current?.clear();
        setError("Tu acceso está desactivado. Habla con el dueño del taller.");
        return;
      }
      const email = String(body?.auth?.email || "").toLowerCase();
      const roles = [...(Array.isArray(body?.employee?.roles) ? body.employee.roles : []), body?.employee?.role].filter(Boolean).map((r) => String(r).toLowerCase());
      const dest = roles.some((r) => ADMIN_ROLES.includes(r)) ? "/Dashboard" : "/Orders";
      if (email && email === String(who.email || "").toLowerCase()) {
        resetPinLockout(tenantId);
        onUnlock();
        return;
      }
      const { error: signErr } = await supabase.auth.signInWithPassword({ email: body.auth.email, password: body.auth.pin });
      if (signErr) {
        entryRef.current?.clear();
        setError("No se pudo verificar el PIN. Intenta de nuevo.");
        return;
      }
      resetPinLockout(tenantId);
      clearLock(tenantId);
      try {
        const tid = body?.tenant?.id || tenantId;
        localStorage.setItem("smartfix_tenant_id", tid);
        localStorage.setItem("current_tenant_id", tid);
        localStorage.removeItem("employee_session");
      } catch {
        window.location.assign(dest);
        return;
      }
      window.location.assign(dest);
    } finally {
      setBusy(false);
    }
  }, [tenantId, onUnlock, fail, who.email]);

  const entry = usePinEntry({ length: 4, onComplete, disabled: busy || locked });
  entryRef.current = entry;
  const first = String(who.name || "").trim().split(/\s+/)[0];

  return createPortal(
    <div className="apple-type fixed inset-0 flex flex-col" style={{ zIndex: 500, background: "#000", color: "#fff" }} role="dialog" aria-modal="true" aria-label="Acceso con PIN">
      <div style={{ padding: 16 }}>
        <button onClick={() => setConfirm(true)} className="flex items-center gap-2" style={{ fontSize: 15, color: BRAND, fontWeight: 500 }}>
          <LogOut className="w-4 h-4" /> Cambiar de cuenta
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center" style={{ gap: 20, padding: "0 16px 40px" }}>
        <div className="flex flex-col items-center text-center" style={{ gap: 6 }}>
          <p style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>Archilla OS</p>
          <p style={{ fontSize: 17, color: "#8E8E93" }}>{first ? `Hola, ${first}` : "Acceso rápido"}</p>
          {tenantName && <p className="flex items-center gap-2" style={{ fontSize: 14, color: "#8E8E93" }}><span style={{ width: 8, height: 8, borderRadius: 999, background: "#30D158" }} /> {tenantName}</p>}
        </div>
        <PinDots length={4} filled={entry.pin.length} shake={shake} />
        <p style={{ minHeight: 20, fontSize: 14, color: "#FF453A", textAlign: "center" }}>{error || ""}</p>
        <Keypad onDigit={entry.add} onBack={entry.back} disabled={busy || locked} busy={busy} />
        <p style={{ fontSize: 12, color: "#8E8E93" }}>También puedes escribirlo con el teclado</p>
        {failures > 0 && (hasOwnerPin
          ? <button onClick={() => setConfirm(true)} style={{ fontSize: 13, color: BRAND, textAlign: "center" }}>¿Olvidaste tu PIN? Entra con tu email o Apple para restablecerlo</button>
          : <p style={{ fontSize: 13, color: "#8E8E93", textAlign: "center" }}>¿Olvidaste tu PIN? Pide a tu jefe que lo resetee desde el perfil de empleado.</p>)}
      </div>
      {confirm && <ConfirmSwitch tenantId={tenantId} onCancel={() => setConfirm(false)} />}
    </div>,
    document.body
  );
}

const NEVER_SECONDS = 86400;
const COLD_GAP_MS = 15000;
const secNum = (key, def) => { const n = Number(readLocal(key)); return readLocal(key) === "" || !Number.isFinite(n) ? def : n; };
const activeKey = (tid) => `archilla_last_active_${tid}`;
const userKey = (tid) => `archilla_user_active_${tid}`;
const sharedStamp = (tid) => Number(readLocal(userKey(tid))) || 0;

function useAutoLock(tenantId, locked) {
  const lastActivity = useRef(Date.now());
  const lastWrite = useRef(0);
  const hiddenAt = useRef(null);
  useEffect(() => {
    if (!tenantId) return undefined;
    const write = (key) => { try { localStorage.setItem(key, String(Date.now())); } catch { return; } };
    const prevStamp = Number(readLocal(activeKey(tenantId))) || 0;
    if (readLocal("security.lockOnColdLaunch") === "true" && prevStamp && Date.now() - prevStamp > COLD_GAP_MS && !isLockedStored(tenantId)) requestAppLock();
    write(activeKey(tenantId));
    const bump = (e) => {
      if (e && e.isTrusted === false) return;
      const now = Date.now();
      lastActivity.current = now;
      if (now - lastWrite.current > 2000) { lastWrite.current = now; write(userKey(tenantId)); }
    };
    const evs = ["pointerdown", "pointermove", "keydown", "touchstart", "touchmove", "wheel", "mousemove"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true, capture: true }));
    const tick = setInterval(() => {
      write(activeKey(tenantId));
      if (isLockedStored(tenantId)) return;
      const idle = secNum("security.idleLockSeconds", 1800);
      const last = Math.max(lastActivity.current, sharedStamp(tenantId));
      if (idle < NEVER_SECONDS && Date.now() - last >= idle * 1000) requestAppLock();
    }, 5000);
    const onVis = () => {
      if (document.visibilityState === "hidden") { hiddenAt.current = Date.now(); write(activeKey(tenantId)); return; }
      const leftAt = hiddenAt.current;
      hiddenAt.current = null;
      const away = leftAt === null ? 0 : Date.now() - Math.max(leftAt, sharedStamp(tenantId));
      write(activeKey(tenantId));
      const bg = secNum("security.backgroundLockSeconds", 900);
      if (!isLockedStored(tenantId) && leftAt !== null && bg < NEVER_SECONDS && away >= bg * 1000) { requestAppLock(); return; }
      lastActivity.current = Date.now();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { evs.forEach((e) => window.removeEventListener(e, bump, { capture: true })); clearInterval(tick); document.removeEventListener("visibilitychange", onVis); };
  }, [tenantId]);
  useEffect(() => { if (!locked) lastActivity.current = Date.now(); }, [locked]);
}

export default function AppLock() {
  const [tenantId, setTenantId] = useState(() => readLocal("smartfix_tenant_id"));
  const [locked, setLocked] = useState(() => isLockedStored(readLocal("smartfix_tenant_id")));
  useAutoLock(tenantId, locked);
  useEffect(() => {
    const sync = () => {
      const tid = readLocal("smartfix_tenant_id");
      setTenantId(tid);
      setLocked(isLockedStored(tid));
    };
    window.addEventListener("archilla:lock", sync);
    window.addEventListener("storage", sync);
    return () => { window.removeEventListener("archilla:lock", sync); window.removeEventListener("storage", sync); };
  }, []);
  if (!locked || !tenantId || typeof document === "undefined") return null;
  return <LockScreen tenantId={tenantId} onUnlock={() => { clearLock(tenantId); setLocked(false); }} />;
}
