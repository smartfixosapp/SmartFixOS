import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Wrench, Building2, StickyNote, CheckCircle2 } from "lucide-react";
import { statusInfo } from "@/lib/orderStatus";
import { dwellInfo, latestNote, daysUntilPromised, deviceKind, orderAmount, groupForBoard, groupFlat, quickActionsFor } from "@/lib/ordersBoard";
import { KIND_ICON, DWELL_COLOR, SERVICE_LABEL, PRIORITY, Pill, AssignmentChip } from "@/components/orders/orderBits";
import { displayDevice, money, tint, relativeTime } from "@/components/orderDetail/ui";
import { anchorInView } from "@/lib/viewport";

function OrderTile({ order, companyName, onClick, onMenu }) {
  const info = statusInfo(order.status);
  const Icon = KIND_ICON[deviceKind(order)] || Wrench;
  const dwell = dwellInfo(order);
  const note = latestNote(order);
  const days = daysUntilPromised(order);
  const device = displayDevice(order);
  const priority = PRIORITY[String(order.priority || "").toLowerCase()];
  const service = SERVICE_LABEL[String(order.service_type || "").toLowerCase()];
  const pressTimer = useRef(null);
  const longPressed = useRef(false);

  const startPress = (e) => {
    if (!onMenu || e.pointerType !== "touch") return;
    longPressed.current = false;
    const x = e.clientX;
    const y = e.clientY;
    pressTimer.current = setTimeout(() => { longPressed.current = true; onMenu(order, x, y); }, 500);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  return (
    <button
      type="button"
      onClick={() => { if (longPressed.current) { longPressed.current = false; return; } onClick?.(order); }}
      onContextMenu={(e) => { if (!onMenu) return; e.preventDefault(); onMenu(order, e.clientX, e.clientY); }}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      className="apple-press hover-lift"
      style={{
        position: "relative", textAlign: "left", height: 214, padding: 10, borderRadius: 14, cursor: "pointer",
        background: "#1C1C1E", border: `1px solid ${tint(info.color, 0.28)}`, display: "flex", flexDirection: "column", gap: 6,
        width: "100%", minWidth: 0, WebkitTouchCallout: "none", userSelect: "none",
      }}
    >
      <span style={{ position: "absolute", top: 1, left: 10, right: 10, height: 3, borderRadius: 2, background: info.color }} />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon className="w-3.5 h-3.5" style={{ color: "#8E8E93" }} />
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#8E8E93" }}>{order.order_number || `#${String(order.id).slice(0, 6)}`}</span>
          {dwell ? (
            <span style={{ fontSize: 11, fontWeight: dwell.severity === "normal" ? 400 : 700, color: DWELL_COLOR[dwell.severity], whiteSpace: "nowrap" }}>{dwell.label}</span>
          ) : order.created_date ? (
            <span style={{ fontSize: 11, color: DWELL_COLOR.normal, whiteSpace: "nowrap" }}>{relativeTime(order.created_date)}</span>
          ) : null}
        </span>
      </div>

      <span style={{ fontSize: 17, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>
        {order.customer_name || "Cliente desconocido"}
      </span>
      {companyName && (
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#5E5CE6", minWidth: 0 }}>
          <Building2 className="w-3 h-3" style={{ flexShrink: 0 }} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{companyName}</span>
        </span>
      )}
      {device && (
        <span style={{ fontSize: 12, color: "#8E8E93", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%" }}>{device}</span>
      )}
      {note && (
        <span style={{ display: "flex", alignItems: "flex-start", gap: 5, padding: "4px 6px", borderRadius: 6, background: "rgba(118,118,128,0.18)", minWidth: 0 }}>
          <StickyNote className="w-2.5 h-2.5" style={{ color: "#8E8E93", marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 10.5, color: "#8E8E93", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{note}</span>
        </span>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
        <Pill color={info.color}>{info.label}</Pill>
        {order.warranty_claim === true && <Pill color="#FF9F0A">Reclamo garantía</Pill>}
        {order.liquid_damage === true && <Pill color="#0A84FF">Líquido</Pill>}
        {priority && <Pill color={priority.color}>{priority.label}</Pill>}
        {service && <Pill color="#40C8E0">{service}</Pill>}
        {days !== null && days < 0 && <Pill color="#FF453A">Atrasada {-days}d</Pill>}
        {days === 0 && <Pill color="#FF9F0A">Vence hoy</Pill>}
      </div>

      <span style={{ flex: 1 }} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <AssignmentChip order={order} />
      </div>
    </button>
  );
}

const QUICK_META = {
  in_progress: { label: "En Reparación", Icon: Wrench },
  ready_for_pickup: { label: "Listo", Icon: CheckCircle2 },
};

function QuickMenu({ menu, order, onClose, onPick }) {
  const statuses = order ? quickActionsFor(order) : [];
  const visible = !!menu && statuses.length > 0;
  useEffect(() => {
    if (!menu) return undefined;
    const close = () => onClose();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);
  useEffect(() => { if (menu && !visible) onClose(); }, [menu, visible, onClose]);
  if (!visible) return null;
  const { left, top } = anchorInView(menu.x, menu.y, 190, statuses.length * 46 + 8);
  return createPortal(
    <div onPointerDown={onClose} style={{ position: "fixed", inset: 0, zIndex: 3000 }}>
      <div onPointerDown={(e) => e.stopPropagation()} style={{ position: "fixed", left, top, width: 190, borderRadius: 14, background: "rgba(44,44,46,0.96)", backdropFilter: "blur(20px)", boxShadow: "0 12px 40px rgba(0,0,0,0.5)", padding: 4 }}>
        {statuses.map((status) => {
          const { label, Icon } = QUICK_META[status];
          return (
            <button key={status} onClick={() => { onClose(); onPick(order, status); }} className="apple-press" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 12px", borderRadius: 10, color: "#fff", fontSize: 15, textAlign: "left" }}>
              <Icon className="w-4 h-4" style={{ color: statusInfo(status).color }} /> {label}
            </button>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}

export default function OrdersKanban({ orders, onCardClick, companyById = {}, onQuickStatus, flat = false, hiddenStatuses = [] }) {
  const [menu, setMenu] = useState(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const groups = useMemo(
    () => (flat ? groupFlat(orders || []) : groupForBoard(orders || [], hiddenStatuses)),
    [orders, flat, hiddenStatuses],
  );
  const visible = groups.filter((g) => g.orders.length > 0);

  if (visible.length === 0) {
    return <div className="text-center py-16 apple-label-tertiary apple-text-subheadline">No hay órdenes que coincidan</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 32 }}>
      {visible.map((group) => {
        const total = group.orders.reduce((s, o) => s + orderAmount(o), 0);
        return (
          <section key={group.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {group.label && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: group.tint || "#8E8E93" }}>{group.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "#8E8E93" }}>
                    {group.orders.length} {group.orders.length === 1 ? "orden" : "órdenes"}
                  </span>
                  {total > 0 && (
                    <>
                      <span style={{ color: "rgba(235,235,245,0.3)" }}>·</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: group.tint || "#8E8E93" }}>{money(total)}</span>
                    </>
                  )}
                </div>
                {group.subtitle && <span style={{ fontSize: 11, color: "rgba(235,235,245,0.3)" }}>{group.subtitle}</span>}
              </div>
            )}
            <div className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10 }}>
              {group.orders.map((order) => (
                <OrderTile
                  key={order.id}
                  order={order}
                  companyName={companyById[order.customer_id]}
                  onClick={onCardClick}
                  onMenu={onQuickStatus && quickActionsFor(order).length > 0 ? (o, x, y) => setMenu({ id: o.id, x, y }) : null}
                />
              ))}
            </div>
          </section>
        );
      })}
      <QuickMenu menu={menu} order={menu ? orders.find((o) => o.id === menu.id) : null} onClose={closeMenu} onPick={(o, status) => onQuickStatus?.(o, status)} />
    </div>
  );
}
