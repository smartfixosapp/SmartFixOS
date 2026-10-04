import { Smartphone, Tablet, Laptop, Gamepad2, LockOpen, Wrench, User } from "lucide-react";
import { tint } from "@/components/orderDetail/ui";
import { initialsOf } from "@/lib/ordersBoard";

export const KIND_ICON = { console: Gamepad2, tablet: Tablet, computer: Laptop, phone: Smartphone, unlock: LockOpen, other: Wrench };
export const DWELL_COLOR = { normal: "rgba(235,235,245,0.3)", warning: "#FF9F0A", danger: "#FF453A" };
export const SERVICE_LABEL = { visit: "Visita técnica", remote: "Remoto" };
export const PRIORITY = { high: { label: "Alta", color: "#FF9F0A" }, urgent: { label: "Urgente", color: "#FF453A" } };

export function Pill({ color, children }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: tint(color, 0.16), color, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export function AssignmentChip({ order }) {
  const label = String(order.assigned_to_name || order.assigned_to || "").trim();
  if (!label) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 999, background: "rgba(255,159,10,0.15)", color: "#FF9F0A" }}>
        <User className="w-2.5 h-2.5" /> Sin asignar
      </span>
    );
  }
  return (
    <span title={`Técnico: ${label}`} style={{ width: 20, height: 20, borderRadius: 999, background: "#30D158", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700 }}>
      {initialsOf(label) || "?"}
    </span>
  );
}
