import { createPortal } from "react-dom";
import { X, Check } from "lucide-react";
import { useEscapeLayer } from "@/components/orderDetail/ui";
import { tint } from "@/components/pos/native/posUi";

export const W = { card: "#1C1C1E", card2: "#2C2C2E", sub: "#8E8E93", ter: "rgba(235,235,245,0.3)", sep: "rgba(84,84,88,0.6)" };

export function Overlay({ children, z = 300, onEscape }) {
  useEscapeLayer(true, onEscape);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed inset-0 flex flex-col" style={{ zIndex: z, background: "#000", color: "#fff" }} role="dialog" aria-modal="true">{children}</div>,
    document.body
  );
}

export function Card({ children, style, color, className = "" }) {
  return <div className={className} style={{ background: W.card, borderRadius: 16, padding: 16, border: color ? `1px solid ${tint(color, 0.25)}` : "none", ...style }}>{children}</div>;
}

export function Caption({ children, style }) {
  return <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase", ...style }}>{children}</p>;
}

export function Chip({ label, active, color = "#FF9F0A", onClick, Icon, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} className="apple-press flex items-center gap-1.5 whitespace-nowrap disabled:opacity-40"
      style={{ padding: "7px 13px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: active ? color : "#3A3A3C", color: "#fff", ...style }}>
      {Icon && <Icon className="w-3.5 h-3.5" />} {label}
    </button>
  );
}

export function Input({ label, value, onChange, placeholder, type = "text", inputMode, mono, style, autoFocus, maxLength, disabled }) {
  return (
    <label className="flex flex-col" style={{ gap: 4 }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: W.sub }}>{label}</span>}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} inputMode={inputMode} autoFocus={autoFocus} maxLength={maxLength} disabled={disabled}
        className="outline-none" style={{ background: W.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit", colorScheme: "dark", minWidth: 0, ...style }} />
    </label>
  );
}

export function TextArea({ label, value, onChange, placeholder, rows = 4, minHeight, style }) {
  return (
    <label className="flex flex-col" style={{ gap: 4 }}>
      {label && <span style={{ fontSize: 12, fontWeight: 600, color: W.sub }}>{label}</span>}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="outline-none" style={{ background: W.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, resize: "vertical", minHeight, ...style }} />
    </label>
  );
}

export function StepHeader({ icon: Icon, color, title, subtitle }) {
  return (
    <div className="flex items-center gap-3">
      <span style={{ width: 46, height: 46, borderRadius: 14, background: tint(color, 0.15), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-6 h-6" /></span>
      <span className="min-w-0">
        <span className="block truncate" style={{ fontSize: 24, fontWeight: 800 }}>{title}</span>
        <span className="block" style={{ fontSize: 14, color: W.sub }}>{subtitle}</span>
      </span>
    </div>
  );
}

export function Banner({ color, children, onDismiss }) {
  return (
    <div className="flex items-start gap-2" style={{ padding: "10px 12px", borderRadius: 12, background: tint(color, 0.12), color, fontSize: 14 }}>
      <span className="flex-1">{children}</span>
      {onDismiss && <button onClick={onDismiss} aria-label="Cerrar"><X className="w-4 h-4" /></button>}
    </div>
  );
}

export function Switch({ on, onChange, color = "#FF9F0A", label }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} aria-label={label} style={{ width: 51, height: 31, borderRadius: 999, background: on ? color : "#3A3A3C", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} />
    </button>
  );
}

export function Avatar({ name, color = "#0A84FF", size = 40 }) {
  const n = String(name || "").trim();
  const init = n ? n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() : "?";
  return <span style={{ width: size, height: size, borderRadius: 999, background: tint(color, 0.2), color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, flexShrink: 0 }}>{init}</span>;
}

export function CheckMark({ color }) {
  return <span style={{ width: 22, height: 22, borderRadius: 999, background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>;
}

export const money = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);
