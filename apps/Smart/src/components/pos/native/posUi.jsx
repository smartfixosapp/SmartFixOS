import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useEscapeLayer } from "@/components/orderDetail/ui";

export const P = {
  bg: "#000",
  card: "#1C1C1E",
  card2: "#2C2C2E",
  card3: "#3A3A3C",
  fill: "rgba(118,118,128,0.24)",
  text: "#fff",
  sub: "#8E8E93",
  ter: "rgba(235,235,245,0.3)",
  sep: "rgba(84,84,88,0.6)",
  brand: "#F2662E",
  success: "#4DC780",
  warning: "#FFA640",
  danger: "#FF7373",
  info: "#66B3FF",
  vip: "#FFC733",
  cash: "#30D158",
  card_: "#0A84FF",
  ath: "#ED4A17",
};

export function tint(hex, a) {
  const alpha = Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
  return `${hex}${alpha}`;
}

export function Dialog({ open, onClose, title, children, footer, width = 520, dismissable = true, height, leading, trailing, bodyPadding = "4px 18px 18px" }) {
  useEscapeLayer(open, () => { if (dismissable) onClose?.(); });
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed inset-0 z-[330] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.62)" }} onClick={() => dismissable && onClose?.()} />
      <div className="relative w-full flex flex-col" style={{ maxWidth: width, height: height || "auto", maxHeight: "94dvh", background: P.card, borderRadius: 24, color: P.text, overflow: "hidden" }}>
        {(title !== undefined || leading || trailing) && (
          <div className="flex items-center justify-between gap-3" style={{ padding: "14px 16px 10px", minHeight: 52 }}>
            <div style={{ minWidth: 80 }}>{leading}</div>
            <p className="truncate text-center flex-1" style={{ fontSize: 17, fontWeight: 700 }}>{title}</p>
            <div className="flex justify-end" style={{ minWidth: 80 }}>
              {trailing !== undefined ? trailing : dismissable && (
                <button onClick={onClose} className="apple-press" aria-label="Cerrar" style={{ width: 30, height: 30, borderRadius: 999, background: P.card2, display: "flex", alignItems: "center", justifyContent: "center", color: P.sub }}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto" style={{ padding: bodyPadding }}>{children}</div>
        {footer && <div style={{ padding: "12px 18px 18px", borderTop: `0.5px solid ${P.sep}` }}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function TextAction({ children, onClick, color = P.brand, disabled, bold }) {
  return (
    <button onClick={onClick} disabled={disabled} className="apple-press disabled:opacity-40" style={{ fontSize: 16, fontWeight: bold ? 700 : 500, color }}>
      {children}
    </button>
  );
}

export function PromptDialog({ open, title, message, placeholder, initial = "", inputMode = "decimal", actions, onClose }) {
  const [value, setValue] = useState(initial);
  useEffect(() => { if (open) setValue(initial); }, [open, initial]);
  useEscapeLayer(open, onClose);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed inset-0 z-[350] flex items-center justify-center" style={{ padding: 16 }} role="alertdialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose} />
      <div className="relative w-full" style={{ maxWidth: 320, background: "#2C2C2E", borderRadius: 16, color: P.text, overflow: "hidden" }}>
        <div className="text-center" style={{ padding: "18px 16px 12px" }}>
          <p style={{ fontSize: 17, fontWeight: 600 }}>{title}</p>
          {message && <p style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-line", color: "rgba(255,255,255,0.85)" }}>{message}</p>}
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const primary = actions.find((a) => a.primary) || actions[actions.length - 1];
                primary.onPress(value);
                onClose?.();
              }
            }}
            placeholder={placeholder}
            inputMode={inputMode}
            style={{ marginTop: 14, width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1C1C1E", color: P.text, border: `0.5px solid ${P.sep}`, outline: "none", fontSize: 15 }}
          />
        </div>
        <div className="flex" style={{ borderTop: `0.5px solid ${P.sep}` }}>
          {actions.map((a, i) => (
            <button
              key={a.label}
              onClick={() => { a.onPress?.(value); onClose?.(); }}
              className="flex-1 apple-press"
              style={{ padding: "12px 0", fontSize: 16, fontWeight: a.primary ? 600 : 400, color: a.destructive ? "#FF453A" : "#0A84FF", borderLeft: i ? `0.5px solid ${P.sep}` : "none" }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AlertDialog({ open, title, message, actions, onClose }) {
  useEscapeLayer(open, onClose);
  if (!open || typeof document === "undefined") return null;
  const stacked = actions.length > 2;
  return createPortal(
    <div className="apple-type fixed inset-0 z-[350] flex items-center justify-center" style={{ padding: 16 }} role="alertdialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.55)" }} onClick={onClose} />
      <div className="relative w-full" style={{ maxWidth: 300, background: "#2C2C2E", borderRadius: 16, color: P.text, overflow: "hidden" }}>
        <div className="text-center" style={{ padding: "18px 16px 14px" }}>
          <p style={{ fontSize: 17, fontWeight: 600 }}>{title}</p>
          {message && <p style={{ fontSize: 13, marginTop: 4, color: "rgba(255,255,255,0.85)", whiteSpace: "pre-line" }}>{message}</p>}
        </div>
        <div className={stacked ? "flex flex-col" : "flex"} style={{ borderTop: `0.5px solid ${P.sep}` }}>
          {actions.map((a, i) => (
            <button
              key={a.label}
              onClick={() => { onClose?.(); a.onPress?.(); }}
              className="flex-1 apple-press"
              style={{ padding: "12px 0", fontSize: 16, fontWeight: a.bold ? 600 : 400, color: a.destructive ? "#FF453A" : "#0A84FF", borderLeft: !stacked && i ? `0.5px solid ${P.sep}` : "none", borderTop: stacked && i ? `0.5px solid ${P.sep}` : "none" }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2" style={{ padding: 12, borderRadius: 12, background: tint(P.danger, 0.12), border: `1px solid ${tint(P.danger, 0.3)}` }}>
      <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: P.danger, marginTop: 2 }} />
      <p className="flex-1" style={{ fontSize: 13 }}>{message}</p>
      {onDismiss && <button onClick={onDismiss} aria-label="Cerrar aviso" style={{ color: P.sub }}><X className="w-4 h-4" /></button>}
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast || typeof document === "undefined") return null;
  return createPortal(
    <div className="apple-type fixed left-0 right-0 flex justify-center pointer-events-none" style={{ bottom: 28, zIndex: 400 }}>
      <div className="flex items-center gap-2" style={{ padding: "10px 16px", borderRadius: 999, background: "rgba(44,44,46,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", color: P.text, fontSize: 14, fontWeight: 600, boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
        {toast.isError ? <XCircle className="w-4 h-4" style={{ color: P.danger }} /> : <CheckCircle2 className="w-4 h-4" style={{ color: P.success }} />}
        {toast.message}
      </div>
    </div>,
    document.body
  );
}

export function SectionHeader({ children }) {
  return <p style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", color: P.sub, textTransform: "uppercase", marginBottom: 8 }}>{children}</p>;
}

export function Toggle({ on, onChange, label, icon, disabled = false, compact = false }) {
  return (
    <button type="button" role="switch" aria-checked={!!on} aria-label={compact ? label : undefined} disabled={disabled} onClick={() => onChange(!on)} className={compact ? "flex items-center flex-shrink-0 disabled:opacity-50" : "w-full flex items-center justify-between disabled:opacity-50"} style={{ padding: compact ? 0 : "6px 0" }}>
      {!compact && <span className="flex items-center gap-2" style={{ fontSize: 15, color: P.text }}>{icon}{label}</span>}
      <span style={{ width: 51, height: 31, borderRadius: 999, background: on ? P.cash : P.card3, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }} />
      </span>
    </button>
  );
}
