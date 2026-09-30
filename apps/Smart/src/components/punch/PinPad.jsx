import { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Loader2 } from "lucide-react";

export const BRAND = "#F2662E";

export function PinDots({ length, filled, shake }) {
  return (
    <div className="flex items-center justify-center" style={{ gap: 18, animation: shake ? "pinshake 0.4s" : "none" }}>
      {Array.from({ length }, (_, i) => (
        <span key={i} style={{ width: 16, height: 16, borderRadius: 999, background: i < filled ? BRAND : "transparent", border: `2px solid ${i < filled ? BRAND : "rgba(255,255,255,0.35)"}`, transition: "background 0.15s" }} />
      ))}
      <style>{"@keyframes pinshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-10px)}40%{transform:translateX(10px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}"}</style>
    </div>
  );
}

export function usePinEntry({ length = 4, onComplete, disabled }) {
  const [pin, setPinState] = useState("");
  const pinRef = useRef("");
  const busyRef = useRef(false);
  const setPin = useCallback((v) => { pinRef.current = v; setPinState(v); }, []);
  const add = useCallback((d) => {
    if (disabled || busyRef.current) return;
    const p = pinRef.current;
    if (p.length >= length) return;
    const next = p + d;
    setPin(next);
    if (next.length === length) {
      busyRef.current = true;
      Promise.resolve(onComplete(next)).finally(() => { busyRef.current = false; });
    }
  }, [disabled, length, onComplete, setPin]);
  const back = useCallback(() => { if (!busyRef.current) setPin(pinRef.current.slice(0, -1)); }, [setPin]);
  const clear = useCallback(() => setPin(""), [setPin]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (/^[0-9]$/.test(e.key)) { e.preventDefault(); add(e.key); } else if (e.key === "Backspace") { e.preventDefault(); back(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [add, back]);
  return { pin, add, back, clear };
}

export function Keypad({ onDigit, onBack, disabled, busy, size = 76 }) {
  const key = (label, onClick, aria) => (
    <button key={aria || label} onClick={onClick} disabled={disabled} aria-label={aria || label} className="apple-press flex items-center justify-center disabled:opacity-40"
      style={{ width: size, height: size, borderRadius: 999, background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: size * 0.38, fontWeight: 500 }}>
      {label}
    </button>
  );
  return (
    <div className="grid grid-cols-3" style={{ gap: 18, justifyItems: "center" }}>
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => key(d, () => onDigit(d)))}
      <span style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" }}>{busy && <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#8E8E93" }} />}</span>
      {key("0", () => onDigit("0"))}
      <button onClick={onBack} disabled={disabled} aria-label="Borrar" className="apple-press flex items-center justify-center disabled:opacity-40" style={{ width: size, height: size, borderRadius: 999, color: "#fff" }}>
        <Delete className="w-7 h-7" />
      </button>
    </div>
  );
}
