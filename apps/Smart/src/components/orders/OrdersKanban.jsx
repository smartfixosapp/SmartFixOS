import React, { useMemo } from "react";
import { ORDER_STATUS, statusInfo } from "@/lib/orderStatus";
import { Smartphone } from "lucide-react";

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function relativeAgeLabel(days) {
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days === 2) return "anteayer";
  if (days < 30) return `hace ${days}d`;
  return `hace ${Math.floor(days / 30)}m`;
}

function OrderRow({ order, statusColor, statusLabel, onClick }) {
  const days = daysSince(order.updated_date || order.created_date);
  const device = [order.device_brand, order.device_model].filter(Boolean).join(" ") || "Equipo";
  const initials = (order.assigned_to_name || "").trim().slice(0, 2).toUpperCase();

  return (
    <div style={{ display: "flex", gap: 10 }}>
      <div style={{ width: 3, borderRadius: 999, background: statusColor, flexShrink: 0 }} />
      <button
        onClick={() => onClick?.(order)}
        className="apple-press"
        style={{
          flexGrow: 1, minWidth: 0, textAlign: "left", background: "transparent", border: "none",
          padding: "0 0 14px", display: "flex", flexDirection: "column", gap: 6, cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="apple-text-caption1" style={{ color: "rgba(255,255,255,0.4)" }}>
            {order.order_number || `#${String(order.id).slice(0, 6)}`}
          </span>
          <span className="apple-text-caption1" style={{ color: "#FF453A", fontWeight: 600 }}>
            en {statusLabel.toLowerCase()} {relativeAgeLabel(days)}
          </span>
        </div>
        <span className="apple-text-headline" style={{ fontWeight: 700, color: "#fff" }}>
          {order.customer_name || "Cliente"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Smartphone className="w-3.5 h-3.5" style={{ color: "rgba(255,255,255,0.4)", flexShrink: 0 }} />
          <span className="apple-text-subheadline" style={{ color: "rgba(255,255,255,0.45)" }}>{device}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
          <span
            className="apple-text-caption1"
            style={{
              padding: "4px 10px", borderRadius: 999, fontWeight: 700,
              background: `${statusColor}26`, color: statusColor,
            }}
          >
            {statusLabel}
          </span>
          {order.assigned_to_name ? (
            <span
              className="apple-text-caption1"
              style={{
                width: 22, height: 22, borderRadius: 999, background: "#34C759", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 10,
              }}
            >
              {initials || "?"}
            </span>
          ) : (
            <span
              className="apple-text-caption1"
              style={{ padding: "4px 10px", borderRadius: 999, fontWeight: 700, background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}
            >
              Sin asignar
            </span>
          )}
        </div>
      </button>
    </div>
  );
}

export default function OrdersKanban({ orders, onCardClick }) {
  const grouped = useMemo(() => {
    const map = new Map();
    (orders || []).forEach((o) => {
      const st = o.status || "intake";
      if (!map.has(st)) map.set(st, []);
      map.get(st).push(o);
    });
    map.forEach((list) => {
      list.sort((a, b) => {
        const da = new Date(a.updated_date || a.created_date || 0).getTime();
        const db = new Date(b.updated_date || b.created_date || 0).getTime();
        return da - db;
      });
    });
    const order = new Map(Object.keys(ORDER_STATUS).map((k, i) => [k, i]));
    return Array.from(map.entries()).sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99));
  }, [orders]);

  if (grouped.length === 0) {
    return (
      <div className="text-center py-16 apple-label-tertiary apple-text-subheadline">
        No hay órdenes que coincidan
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {grouped.map(([statusId, list]) => {
        const config = statusInfo(statusId);
        return (
          <div key={statusId} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span className="apple-text-headline" style={{ fontWeight: 700, color: config.color }}>
                {config.label} &mdash; en orden de llegada
              </span>
              <span className="apple-text-caption1" style={{ color: "rgba(255,255,255,0.4)" }}>
                {list.length} {list.length === 1 ? "orden" : "órdenes"} &middot; trabaja la más antigua primero
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {list.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  statusColor={config.color}
                  statusLabel={config.label}
                  onClick={onCardClick}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
