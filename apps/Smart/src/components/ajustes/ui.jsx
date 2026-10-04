import { Children } from "react";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Loader2, AlertTriangle } from "lucide-react";
import { tint } from "@/components/pos/native/posUi";

export const A = { bg: "#000", card: "#1C1C1E", card2: "#2C2C2E", sub: "#8E8E93", ter: "rgba(235,235,245,0.3)", sep: "rgba(84,84,88,0.6)", brand: "#F2662E", success: "#4DC780", warning: "#FFA640", danger: "#FF7373", info: "#66B3FF", vip: "#FFC733", teal: "#40C8E0" };

export function SubPage({ title, onBack, right, children, width = 1400, inline }) {
  return (
    <div className="mx-auto" style={{ maxWidth: width, width: "100%" }}>
      {(onBack || right || inline) && (
        <div className="relative flex items-center justify-between" style={{ minHeight: 44, marginBottom: inline ? 18 : 6 }}>
          {inline && <span className="absolute inset-x-0 text-center pointer-events-none" style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>}
          {onBack ? <button onClick={onBack} aria-label="Atrás" className="apple-press flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 999, background: A.card, border: `0.5px solid ${A.sep}` }}><ChevronLeft className="w-5 h-5" /></button> : <span />}
          {right}
        </div>
      )}
      {!inline && <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15, margin: "0 0 18px" }}>{title}</h1>}
      <div className="sp-grid" style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 60 }}>{children}</div>
    </div>
  );
}

export function Group({ header, headerRight, footer, footerColor, icon: Icon, children, pad = true, form }) {
  const isForm = form !== undefined ? form : pad !== false;
  const kids = isForm && pad !== false ? Children.toArray(children).filter(Boolean) : null;
  return (
    <div className="flex flex-col" data-group="1" style={{ gap: isForm ? 10 : 8 }}>
      {header && (isForm
        ? <p className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 500, color: A.sub, padding: "0 16px" }}>{Icon && <Icon className="w-[18px] h-[18px]" />}<span className="flex-1">{header}</span>{headerRight}</p>
        : <p className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: A.sub, textTransform: "uppercase", padding: "0 4px" }}>{Icon && <Icon className="w-3.5 h-3.5" />}{header}</p>)}
      {kids ? (
        <div style={{ background: A.card, borderRadius: isForm ? 24 : 16, overflow: "hidden" }} className="flex flex-col">
          {kids.map((k, i) => (
            <div key={i} style={{ padding: "14px 16px", borderTop: i ? `0.5px solid ${A.sep}` : "none" }}>{k}</div>
          ))}
        </div>
      ) : (
        <div style={{ background: A.card, borderRadius: isForm ? 24 : 16, padding: pad ? 16 : 0, overflow: "hidden" }} className="flex flex-col">{children}</div>
      )}
      {footer && <p style={{ fontSize: 13, color: footerColor || A.sub, padding: isForm ? "0 16px" : "0 4px", whiteSpace: "pre-line" }}>{footer}</p>}
    </div>
  );
}

export function Row({ Icon, color = A.brand, title, sub, onClick, right, locked, lockLabel, first, dim, chevron = true }) {
  const Tag = onClick && !locked ? "button" : "div";
  return (
    <Tag onClick={locked ? undefined : onClick} className={`relative flex items-center gap-3 text-left w-full ${onClick && !locked ? "apple-press" : ""}`} style={{ padding: "14px 16px", opacity: locked || dim ? 0.5 : 1 }}>
      {!first && <span aria-hidden="true" style={{ position: "absolute", top: 0, left: Icon ? 56 : 16, right: 0, height: 0.5, background: A.sep }} />}
      {Icon && <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(color, dim ? 0.08 : 0.14), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon className="w-4 h-4" /></span>}
      <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 17, lineHeight: 1.25 }}>{title}</span>{sub && <span className="block" style={{ fontSize: 12, color: A.sub, marginTop: 3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{sub}</span>}</span>
      {right}
      {locked ? <span style={{ padding: "2px 10px", borderRadius: 999, background: tint(A.brand, 0.16), color: A.brand, fontSize: 11, fontWeight: 700 }}>{lockLabel || "Plan Equipo"}</span> : onClick && chevron ? <ChevronRight className="w-3.5 h-3.5" style={{ color: A.ter }} strokeWidth={2.5} /> : null}
    </Tag>
  );
}

export function Toggle({ on, onChange, label, color = A.brand, disabled }) {
  return <button type="button" onClick={() => !disabled && onChange(!on)} role="switch" aria-checked={on} aria-label={label} disabled={disabled} style={{ width: 51, height: 31, borderRadius: 999, background: on ? color : "#3A3A3C", position: "relative", flexShrink: 0, transition: "background 0.2s", opacity: disabled ? 0.4 : 1 }}><span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} /></button>;
}

export function ToggleRow({ Icon, color, title, sub, on, onChange, first, disabled, tintColor, after, bold = true }) {
  return (
    <div className="relative flex items-center gap-3" style={{ padding: "14px 16px" }}>
      {!first && <span aria-hidden="true" style={{ position: "absolute", top: 0, left: Icon ? 56 : 16, right: 0, height: 0.5, background: A.sep }} />}
      {Icon && <span style={{ width: 32, height: 32, borderRadius: 8, background: tint(color || A.brand, on === false ? 0.08 : 0.14), color: on === false ? A.sub : color || A.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.25s, color 0.25s" }}><Icon className="w-4 h-4" /></span>}
      <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 17, lineHeight: 1.25, fontWeight: bold ? 600 : 400 }}>{title}</span>{sub && <span className="block" style={{ fontSize: 12, color: A.sub, marginTop: 3 }}>{sub}</span>}</span>
      <Toggle on={on} onChange={onChange} label={title} disabled={disabled} color={tintColor} />
      {after}
    </div>
  );
}

export function Field({ label, value, onChange, placeholder, type = "text", inputMode, disabled, rows, maxLength, mono, suffix, plain }) {
  const style = { background: plain ? "transparent" : "#000", color: "#fff", borderRadius: 10, padding: plain ? "4px 0" : "12px 14px", fontSize: 17, width: "100%", fontFamily: mono ? "ui-monospace, Menlo, monospace" : "inherit", colorScheme: "dark" };
  return (
    <label className="flex flex-col" style={{ gap: 6 }}>
      {label && <span style={{ fontSize: 17, fontWeight: 600 }}>{label}</span>}
      <span className="flex items-center gap-2">
        {rows ? <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} disabled={disabled} maxLength={maxLength} className="outline-none" style={{ ...style, resize: "vertical" }} />
          : <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} inputMode={inputMode} disabled={disabled} maxLength={maxLength} className="outline-none" style={style} />}
        {suffix}
      </span>
    </label>
  );
}

export function PrimaryBtn({ children, onClick, busy, disabled, color = A.brand, busyLabel, icon }) {
  return (
    <div style={{ background: A.card, borderRadius: 24, padding: 16 }}>
      <button onClick={onClick} disabled={busy || disabled} className="apple-press w-full flex items-center justify-center gap-2 disabled:opacity-50" style={{ height: 50, borderRadius: 999, background: color, color: "#fff", fontSize: 17, fontWeight: 700 }}>{busy ? <><Loader2 className="w-5 h-5 animate-spin" /> {busyLabel || "Guardando..."}</> : <>{icon === false ? null : <Check className="w-5 h-5" />}{children}</>}</button>
    </div>
  );
}

export function SelectRow({ label, value, onChange, options, Icon }) {
  const cur = options.find(([k]) => k === value);
  return (
    <label className="relative flex items-center gap-3" style={{ cursor: "pointer", minHeight: 30 }}>
      <span className="flex-1 flex items-center gap-2" style={{ fontSize: 17 }}>{Icon && <Icon className="w-[18px] h-[18px]" style={{ color: A.sub }} />}{label}</span>
      <span className="flex items-center gap-1" style={{ fontSize: 17, color: A.sub }}>{cur ? cur[1] : value}<ChevronsUpDown className="w-4 h-4" /></span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", colorScheme: "dark" }}>
        {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </label>
  );
}

export function ErrorLine({ message }) {
  if (!message) return null;
  return <p className="flex items-center gap-2" style={{ fontSize: 13, color: A.danger }}><AlertTriangle className="w-4 h-4" /> {message}</p>;
}

export function Chips({ value, options, onChange }) {
  return <div className="grid" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>{options.map(([k, l]) => <button key={k} onClick={() => onChange(k)} style={{ padding: "8px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, background: value === k ? "#636366" : "transparent" }}>{l}</button>)}</div>;
}

export function ActionRow({ Icon, label, onClick, color = A.brand, disabled, first }) {
  return (
    <button onClick={onClick} disabled={disabled} className="apple-press relative flex items-center gap-3 text-left w-full disabled:opacity-40" style={{ padding: "14px 16px", color, fontSize: 17 }}>
      {!first && <span aria-hidden="true" style={{ position: "absolute", top: 0, left: 16, right: 0, height: 0.5, background: A.sep }} />}
      {Icon && <Icon className="w-[18px] h-[18px]" />}{label}
    </button>
  );
}
