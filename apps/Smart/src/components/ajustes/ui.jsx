import { ChevronLeft, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import { tint } from "@/components/pos/native/posUi";

export const A = { bg: "#000", card: "#1C1C1E", card2: "#2C2C2E", sub: "#8E8E93", ter: "rgba(235,235,245,0.3)", sep: "rgba(84,84,88,0.6)", brand: "#F2662E", success: "#4DC780", warning: "#FFA640", danger: "#FF7373", info: "#66B3FF", vip: "#FFC733", teal: "#40C8E0" };

export function SubPage({ title, onBack, right, children, width = 1400 }) {
  return (
    <div className="mx-auto" style={{ maxWidth: width, width: "100%" }}>
      <div className="flex items-center gap-3" style={{ padding: "4px 0 14px" }}>
        {onBack && <button onClick={onBack} aria-label="Atrás" className="apple-press flex items-center justify-center" style={{ width: 36, height: 36, borderRadius: 999, background: A.card }}><ChevronLeft className="w-5 h-5" /></button>}
        <h1 className="flex-1" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</h1>
        {right}
      </div>
      <div style={{ display: "grid", gap: 20, paddingBottom: 60, alignItems: "start", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 520px), 1fr))" }}>{children}</div>
    </div>
  );
}

export function Group({ header, footer, footerColor, icon: Icon, children, pad = true }) {
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {header && <p className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: A.sub, textTransform: "uppercase", padding: "0 4px" }}>{Icon && <Icon className="w-3.5 h-3.5" />}{header}</p>}
      <div style={{ background: A.card, borderRadius: 16, padding: pad ? 16 : 0, overflow: "hidden" }} className="flex flex-col">{children}</div>
      {footer && <p style={{ fontSize: 12, color: footerColor || A.sub, padding: "0 4px", whiteSpace: "pre-line" }}>{footer}</p>}
    </div>
  );
}

export function Row({ Icon, color = A.brand, title, sub, onClick, right, locked, lockLabel, first, dim }) {
  const Tag = onClick && !locked ? "button" : "div";
  return (
    <Tag onClick={locked ? undefined : onClick} className={`flex items-center gap-3 text-left w-full ${onClick && !locked ? "apple-press" : ""}`} style={{ padding: "14px 16px", borderTop: first ? "none" : `0.5px solid ${A.sep}`, opacity: locked || dim ? 0.5 : 1 }}>
      {Icon && <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(color, dim ? 0.08 : 0.14), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-4 h-4" /></span>}
      <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 16 }}>{title}</span>{sub && <span className="block" style={{ fontSize: 12, color: A.sub, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{sub}</span>}</span>
      {right}
      {locked ? <span style={{ padding: "2px 10px", borderRadius: 999, background: tint(A.brand, 0.16), color: A.brand, fontSize: 11, fontWeight: 700 }}>{lockLabel || "Plan Equipo"}</span> : onClick ? <ChevronRight className="w-4 h-4" style={{ color: A.ter }} /> : null}
    </Tag>
  );
}

export function Toggle({ on, onChange, label, color = A.success, disabled }) {
  return <button type="button" onClick={() => !disabled && onChange(!on)} role="switch" aria-checked={on} aria-label={label} disabled={disabled} style={{ width: 51, height: 31, borderRadius: 999, background: on ? color : "#3A3A3C", position: "relative", flexShrink: 0, transition: "background 0.2s", opacity: disabled ? 0.4 : 1 }}><span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} /></button>;
}

export function ToggleRow({ Icon, color, title, sub, on, onChange, first, disabled }) {
  return (
    <div className="flex items-center gap-3" style={{ padding: "13px 16px", borderTop: first ? "none" : `0.5px solid ${A.sep}` }}>
      {Icon && <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(color || A.brand, on === false ? 0.08 : 0.16), color: color || A.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-4 h-4" /></span>}
      <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 16 }}>{title}</span>{sub && <span className="block" style={{ fontSize: 12, color: A.sub }}>{sub}</span>}</span>
      <Toggle on={on} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

export function Field({ label, value, onChange, placeholder, type = "text", inputMode, disabled, rows, maxLength, mono, suffix }) {
  const style = { background: A.card2, color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16, width: "100%", fontFamily: mono ? "ui-monospace, Menlo, monospace" : "inherit", colorScheme: "dark" };
  return (
    <label className="flex flex-col" style={{ gap: 6 }}>
      {label && <span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span>}
      <span className="flex items-center gap-2">
        {rows ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled} maxLength={maxLength} className="outline-none" style={{ ...style, resize: "vertical" }} />
          : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} inputMode={inputMode} disabled={disabled} maxLength={maxLength} className="outline-none" style={style} />}
        {suffix}
      </span>
    </label>
  );
}

export function PrimaryBtn({ children, onClick, busy, disabled, color = A.brand, busyLabel }) {
  return <button onClick={onClick} disabled={busy || disabled} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ padding: "15px 0", borderRadius: 14, background: color, color: "#fff", fontSize: 17, fontWeight: 700 }}>{busy ? <><Loader2 className="w-5 h-5 animate-spin" /> {busyLabel || "Guardando..."}</> : children}</button>;
}

export function ErrorLine({ message }) {
  if (!message) return null;
  return <p className="flex items-center gap-2" style={{ fontSize: 13, color: A.danger }}><AlertTriangle className="w-4 h-4" /> {message}</p>;
}

export function Chips({ value, options, onChange }) {
  return <div className="grid" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>{options.map(([k, l]) => <button key={k} onClick={() => onChange(k)} style={{ padding: "8px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, background: value === k ? "#636366" : "transparent" }}>{l}</button>)}</div>;
}
