import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export const C = {
  bg: "#000",
  card: "#1C1C1E",
  card2: "#2C2C2E",
  brand: "#F2662E",
  text: "#fff",
  sub: "#8E8E93",
  green: "#30D158",
  red: "#FF453A",
  amber: "#FF9F0A",
  blue: "#0A84FF",
  indigo: "#5E5CE6",
  teal: "#40C8E0",
  pink: "#FF375F",
  sep: "rgba(255,255,255,0.08)",
};

export function tint(hex, a) {
  const alpha = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
  return `${hex}${alpha}`;
}

export function Card({ children, style, className = "" }) {
  return (
    <div className={className} style={{ background: C.card, borderRadius: 16, padding: 16, ...style }}>
      {children}
    </div>
  );
}

export function SectionHeader({ children, right }) {
  return (
    <div className="flex items-center justify-between" style={{ margin: "4px 4px 8px" }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: C.sub, textTransform: "uppercase" }}>{children}</p>
      {right}
    </div>
  );
}

export function Pill({ color, children, onClick, disabled, icon: Icon, solid = false, style }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      disabled={disabled}
      className={onClick ? "apple-press disabled:opacity-50" : ""}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
        padding: "5px 11px", borderRadius: 999, fontSize: 13, fontWeight: 600,
        background: solid ? color : tint(color, 0.14), color: solid ? "#fff" : color,
        border: solid ? "none" : `1px solid ${tint(color, 0.25)}`,
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </Tag>
  );
}

export function Btn({ children, onClick, disabled, color = C.brand, variant = "solid", icon: Icon, style, type = "button" }) {
  const solid = variant === "solid";
  const ghost = variant === "ghost";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="apple-press disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
        minHeight: 48, padding: "0 18px", borderRadius: 14, fontSize: 15, fontWeight: 700,
        background: solid ? color : ghost ? "transparent" : C.card2,
        color: solid ? "#fff" : ghost ? C.sub : variant === "secondary" ? C.text : color,
        ...style,
      }}
    >
      {Icon && <Icon className="w-[18px] h-[18px]" />}
      {children}
    </button>
  );
}

const escapeStack = [];

export function useEscapeLayer(open, onEscape) {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;
  useEffect(() => {
    if (!open) return undefined;
    const token = {};
    escapeStack.push(token);
    const onKey = (e) => {
      if (e.key !== "Escape" || e.defaultPrevented || escapeStack[escapeStack.length - 1] !== token) return;
      handlerRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const i = escapeStack.indexOf(token);
      if (i >= 0) escapeStack.splice(i, 1);
    };
  }, [open]);
}

export function Sheet({ open, onClose, title, children, footer, width = 480, dismissable = true, zIndex }) {
  useEscapeLayer(open, () => { if (dismissable) onClose?.(); });
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed inset-0 z-[300] flex items-end sm:items-center justify-center" style={zIndex ? { zIndex } : undefined} role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => dismissable && onClose?.()} />
      <div
        className="relative w-full flex flex-col"
        style={{ maxWidth: width, maxHeight: "90dvh", background: C.card, borderRadius: 24, color: C.text, overflow: "hidden" }}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between gap-3" style={{ padding: "16px 18px 10px" }}>
            <p style={{ fontSize: 18, fontWeight: 800 }}>{title}</p>
            {dismissable && (
              <button onClick={onClose} className="apple-press" aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 999, background: C.card2, display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="overflow-y-auto" style={{ padding: "4px 18px 18px" }}>{children}</div>
        {footer && <div style={{ padding: "12px 18px 18px", borderTop: `0.5px solid ${C.sep}` }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ConfirmSheet({ open, onClose, icon: Icon, iconColor = C.amber, title, message, confirmLabel, confirmColor = C.brand, onConfirm, busy, cancelLabel = "Cancelar" }) {
  return (
    <Sheet open={open} onClose={onClose} width={420}>
      <div className="flex flex-col items-center text-center" style={{ paddingTop: 16 }}>
        {Icon && (
          <span style={{ width: 64, height: 64, borderRadius: 999, background: tint(iconColor, 0.14), color: iconColor, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <Icon className="w-7 h-7" />
          </span>
        )}
        <p style={{ fontSize: 19, fontWeight: 800 }}>{title}</p>
        {message && <p style={{ fontSize: 15, color: C.sub, marginTop: 8 }}>{message}</p>}
        <div className="w-full flex flex-col gap-2" style={{ marginTop: 22 }}>
          <Btn onClick={onConfirm} disabled={busy} color={confirmColor}>{busy ? "Un momento…" : confirmLabel}</Btn>
          <Btn onClick={onClose} disabled={busy} variant="ghost">{cancelLabel}</Btn>
        </div>
      </div>
    </Sheet>
  );
}

export function Row({ label, value, onClick, valueColor, children }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={onClick ? "apple-press w-full text-left" : ""}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: `0.5px solid ${C.sep}` }}
    >
      <span style={{ fontSize: 15, color: C.sub }}>{label}</span>
      {children || <span style={{ fontSize: 15, color: valueColor || C.text, textAlign: "right" }}>{value}</span>}
    </Tag>
  );
}

export function relativeTime(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.round(h / 24);
  if (d < 30) return `hace ${d} ${d === 1 ? "día" : "días"}`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
  const y = Math.round(mo / 12);
  return `hace ${y} ${y === 1 ? "año" : "años"}`;
}

export function shortDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("es-PR", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export function money(v) {
  const n = Number(v);
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

export function displayDevice(order) {
  const raw = [order?.device_brand, order?.device_family, order?.device_model].filter(Boolean).join(" ");
  const seen = new Set();
  return raw.split(" ").filter((w) => {
    const k = w.toLowerCase();
    if (!w || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).join(" ");
}

export function phoneDigits(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

export function firstName(name) {
  const f = String(name || "").trim().split(/\s+/)[0];
  return f || "el cliente";
}
