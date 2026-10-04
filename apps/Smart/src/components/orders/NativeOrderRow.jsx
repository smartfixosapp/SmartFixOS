import { StickyNote } from "lucide-react";
import { statusInfo } from "@/lib/orderStatus";
import { dwellInfo, latestNote, daysUntilPromised, deviceKind } from "@/lib/ordersBoard";
import { displayDevice, relativeTime, tint } from "@/components/orderDetail/ui";
import { KIND_ICON, DWELL_COLOR, SERVICE_LABEL, PRIORITY, Pill, AssignmentChip } from "@/components/orders/orderBits";

export default function NativeOrderRow({ order, onClick }) {
  const info = statusInfo(order.status);
  const Icon = KIND_ICON[deviceKind(order)];
  const dwell = dwellInfo(order);
  const note = latestNote(order);
  const days = daysUntilPromised(order);
  const device = displayDevice(order);
  const priority = PRIORITY[String(order.priority || "").toLowerCase()];
  const service = SERVICE_LABEL[String(order.service_type || "").toLowerCase()];

  return (
    <button type="button" onClick={onClick} className="apple-press w-full flex items-stretch text-left" style={{ gap: 10, padding: "10px 14px" }}>
      <span style={{ width: 4, borderRadius: 999, background: info.color, flexShrink: 0 }} />
      <span style={{ width: 30, height: 30, borderRadius: 8, background: "#3A3A3C", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon className="w-3.5 h-3.5" style={{ color: "#8E8E93" }} />
      </span>
      <span className="flex-1 min-w-0 flex flex-col" style={{ gap: 3 }}>
        <span className="flex items-baseline justify-between" style={{ gap: 8 }}>
          <span className="truncate" style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{order.customer_name || "Cliente desconocido"}</span>
          <span className="flex-shrink-0" style={{ fontSize: 11, color: "#8E8E93" }}>
            <b style={{ fontWeight: 600 }}>{order.order_number || "—"}</b>
            {" · "}
            {dwell ? <span style={{ color: DWELL_COLOR[dwell.severity], fontWeight: dwell.severity === "normal" ? 400 : 700 }}>{dwell.label}</span> : order.created_date ? relativeTime(order.created_date) : ""}
          </span>
        </span>
        {device && <span className="truncate" style={{ fontSize: 12, color: "#8E8E93" }}>{device}</span>}
        {note && (
          <span className="flex items-start" style={{ gap: 5, padding: "3px 6px", borderRadius: 6, background: "rgba(118,118,128,0.18)", minWidth: 0 }}>
            <StickyNote className="w-2.5 h-2.5 flex-shrink-0" style={{ color: "#8E8E93", marginTop: 2 }} />
            <span className="truncate" style={{ fontSize: 10.5, color: "#8E8E93" }}>{note}</span>
          </span>
        )}
        <span className="flex flex-wrap items-center" style={{ gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: tint(info.color, 0.16), color: info.color }}>{info.label}</span>
          {order.warranty_claim === true && <Pill color="#FF9F0A">Reclamo garantía</Pill>}
          {order.liquid_damage === true && <Pill color="#0A84FF">Líquido</Pill>}
          {priority && <Pill color={priority.color}>{priority.label}</Pill>}
          {service && <Pill color="#40C8E0">{service}</Pill>}
          {days !== null && days < 0 && <Pill color="#FF453A">Atrasada {-days}d</Pill>}
          {days === 0 && <Pill color="#FF9F0A">Vence hoy</Pill>}
          <span style={{ flex: 1 }} />
          <AssignmentChip order={order} />
        </span>
      </span>
    </button>
  );
}
