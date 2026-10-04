import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../../../lib/supabase-client.js";
import { PinDots, Keypad, usePinEntry, BRAND } from "@/components/punch/PinPad";

const KEY = "archilla_pin_change_needed";

export function flagPinChange(employeeId) {
  try { localStorage.setItem(KEY, String(employeeId || "")); } catch { return; }
  window.dispatchEvent(new Event("archilla:pinflag"));
}

function isLocked() {
  try {
    const tid = localStorage.getItem("smartfix_tenant_id");
    return !!tid && localStorage.getItem(`archilla_app_locked_${tid}`) === "1";
  } catch {
    return false;
  }
}

function pending() {
  try { return localStorage.getItem(KEY) || ""; } catch { return ""; }
}

export default function ChangePinGate() {
  const [empId, setEmpId] = useState(pending);
  const [locked, setLocked] = useState(isLocked);
  useEffect(() => {
    const sync = () => { setEmpId(pending()); setLocked(isLocked()); };
    const t = setInterval(sync, 1000);
    window.addEventListener("archilla:pinflag", sync);
    window.addEventListener("archilla:lock", sync);
    window.addEventListener("storage", sync);
    return () => { clearInterval(t); window.removeEventListener("archilla:pinflag", sync); window.removeEventListener("archilla:lock", sync); window.removeEventListener("storage", sync); };
  }, []);
  if (!empId || locked) return null;
  return <GateInner key={empId} empId={empId} onDone={() => setEmpId("")} />;
}

function GateInner({ empId, onDone }) {
  const [first, setFirst] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const entryRef = useRef(null);

  const onComplete = useCallback(async (pin) => {
    if (first === null) {
      if (pin === "1234" || /^(\d)\1{3}$/.test(pin)) {
        entryRef.current?.clear();
        setError("Elige un PIN menos obvio.");
        return;
      }
      setFirst(pin);
      setError(null);
      entryRef.current?.clear();
      return;
    }
    if (pin !== first) {
      setFirst(null);
      setError("Los PIN no coinciden. Empieza de nuevo.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      entryRef.current?.clear();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc("update_employee_pin", { p_employee_id: empId, p_new_pin: pin });
      if (rpcErr) {
        const { error: upErr } = await supabase.from("app_employee").update({ pin, pin_is_temp: false }).eq("id", empId);
        if (upErr) throw upErr;
      }
      try { localStorage.removeItem(KEY); } catch { return; }
      onDone();
    } catch {
      setError("No se pudo guardar el PIN. Intenta de nuevo.");
      setFirst(null);
      entryRef.current?.clear();
    }
    setBusy(false);
  }, [first, empId, onDone]);

  const entry = usePinEntry({ length: 4, onComplete, disabled: busy });
  entryRef.current = entry;

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed inset-0 flex flex-col items-center justify-center" style={{ zIndex: 490, background: "#000", color: "#fff", gap: 22, padding: 16 }} role="dialog" aria-modal="true">
      <div className="flex flex-col items-center text-center" style={{ gap: 6 }}>
        <p style={{ fontSize: 24, fontWeight: 800 }}>Crea tu PIN</p>
        <p style={{ fontSize: 15, color: "#8E8E93" }}>{first === null ? "Tu PIN actual es temporal. Elige uno de 4 dígitos que solo tú sepas." : "Escríbelo otra vez para confirmar."}</p>
      </div>
      <PinDots length={4} filled={entry.pin.length} shake={shake} />
      <p style={{ minHeight: 20, fontSize: 14, color: "#FF453A", textAlign: "center" }}>{error || ""}</p>
      <Keypad onDigit={entry.add} onBack={entry.back} disabled={busy} busy={busy} />
      <span style={{ color: BRAND, fontSize: 13 }}>{busy ? "Guardando…" : ""}</span>
    </div>,
    document.body,
  );
}
