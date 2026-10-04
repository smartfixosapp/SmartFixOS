import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, Check, Building2, Calendar } from "lucide-react";
import { ORDER_KINDS } from "@/lib/ordersBoard";
import { anchorInView } from "@/lib/viewport";

const BRAND = "#F2662E";

function SectionTitle({ children }) {
  return <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "#8E8E93", margin: "10px 12px 4px" }}>{children}</p>;
}

function Option({ selected, onClick, children }) {
  return (
    <button onClick={onClick} className="apple-press" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 10, color: "#fff", fontSize: 14, textAlign: "left" }}>
      <span style={{ width: 16, display: "inline-flex", justifyContent: "center" }}>{selected && <Check className="w-4 h-4" style={{ color: BRAND }} />}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{children}</span>
    </button>
  );
}

export default function OrdersFilterMenu({
  active, b2bAvailable, b2bCount, b2bOnly, onB2b,
  kind, kindCounts, onKind,
  deviceType, deviceTypes, onDeviceType,
  showDates, onToggleDates,
  onClear,
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen((v) => !v);
  };

  const anchor = rect ? anchorInView(rect.left, rect.bottom + 8, 260, 420, 12) : { left: 12, top: 60 };
  const { left, top } = anchor;

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Filtros"
        title="Filtros"
        className="apple-press"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 40, height: 40, borderRadius: 999, background: active ? "rgba(242,102,46,0.18)" : "rgba(255,255,255,0.08)", color: active ? BRAND : "#fff", flexShrink: 0 }}
      >
        <SlidersHorizontal className="w-4 h-4" />
      </button>
      {open && createPortal(
        <div onPointerDown={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 3000 }}>
          <div
            onPointerDown={(e) => e.stopPropagation()}
            style={{ position: "fixed", left, top, width: 260, maxHeight: "min(calc(70dvh / var(--ui-zoom, 1)), 560px)", overflowY: "auto", borderRadius: 16, background: "rgba(44,44,46,0.97)", backdropFilter: "blur(20px)", boxShadow: "0 14px 44px rgba(0,0,0,0.55)", padding: 6 }}
          >
            {b2bAvailable && (
              <>
                <Option selected={b2bOnly} onClick={() => onB2b(!b2bOnly)}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Building2 className="w-4 h-4" /> Solo corporativos ({b2bCount})</span>
                </Option>
                <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "4px 8px" }} />
              </>
            )}
            <SectionTitle>TIPO</SectionTitle>
            <Option selected={!kind} onClick={() => onKind(null)}>Todas</Option>
            {ORDER_KINDS.map((k) => (
              <Option key={k.id} selected={kind === k.id} onClick={() => onKind(kind === k.id ? null : k.id)}>{k.label} ({kindCounts[k.id] || 0})</Option>
            ))}
            {deviceTypes.length > 0 && (
              <>
                <SectionTitle>EQUIPO</SectionTitle>
                <Option selected={!deviceType} onClick={() => onDeviceType(null)}>Todos</Option>
                {deviceTypes.map((dt) => (
                  <Option key={dt} selected={deviceType === dt} onClick={() => onDeviceType(deviceType === dt ? null : dt)}>{dt}</Option>
                ))}
              </>
            )}
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 8px" }} />
            <Option selected={showDates} onClick={() => { onToggleDates(); setOpen(false); }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Calendar className="w-4 h-4" /> {showDates ? "Ocultar filtro de fechas" : "Filtrar por fechas"}</span>
            </Option>
            {active && (
              <>
                <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "6px 8px" }} />
                <button onClick={() => { onClear(); setOpen(false); }} className="apple-press" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, color: "#FF453A", fontSize: 14, fontWeight: 600, textAlign: "left" }}>
                  Limpiar filtros
                </button>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
