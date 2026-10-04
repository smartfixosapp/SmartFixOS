import React from "react";
import { Phone, MessageSquare, MessageCircle, ShieldCheck, Droplets, AlertTriangle, Clock, CheckCircle2, XCircle, Shield } from "lucide-react";
import { statusInfo, isTerminal } from "@/lib/orderStatus";
import { remainingBalance } from "@/lib/orderEmails";
import { deviceBucket } from "@/lib/deviceBucket";
import { dwellInfo, initialsOf } from "@/lib/ordersBoard";
import { BUCKET_STYLE, DWELL_COLOR } from "@/components/orders/orderBits";
import { C, tint, Card, Pill, money, displayDevice } from "./ui";

function daysUntilPromised(order) {
  if (!order?.promised_date || isTerminal(order.status)) return null;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const target = new Date(order.promised_date); target.setHours(0, 0, 0, 0);
  return Math.round((target - start) / 86400000);
}

function deliveredAt(order) {
  const hist = Array.isArray(order.status_history) ? order.status_history : [];
  const last = [...hist].reverse().find((e) => e?.status === "delivered");
  return last?.timestamp || (order.status === "delivered" ? order.updated_date : null);
}

function warrantyInfo(order) {
  if (order.status !== "delivered") return null;
  const days = order.warranty_days === null || order.warranty_days === undefined ? 30 : Number(order.warranty_days);
  if (days === 0) return { none: true };
  const from = deliveredAt(order);
  if (!from) return null;
  const until = new Date(new Date(from).getTime() + days * 86400000);
  const left = Math.ceil((until.getTime() - Date.now()) / 86400000);
  return { until, left };
}

function Stat({ label, value, color, onClick }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`${onClick ? "apple-press " : ""}text-left min-w-0`} style={{ padding: "8px 11px", borderRadius: 12, background: C.card2 }}>
      <span className="block" style={{ fontSize: 11, color: C.sub }}>{label}</span>
      <span className="block truncate" style={{ fontSize: 14, fontWeight: 700, color: color || C.text, marginTop: 1 }}>{value}</span>
    </Tag>
  );
}

function RoundBtn({ label, Icon, color, onClick }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className="apple-press" style={{ width: 40, height: 40, borderRadius: 999, background: tint(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon className="w-[18px] h-[18px]" />
    </button>
  );
}

export default function HeaderCard({ order, previousCount, onOpenHistory, onCharge, onPromisedDate, onContact, onTech, onApproval, onWarranty, isDesktop }) {
  const st = statusInfo(order.status);
  const bs = BUCKET_STYLE[deviceBucket(order)] || BUCKET_STYLE.other;
  const dwell = dwellInfo(order);
  const balance = remainingBalance(order);
  const due = daysUntilPromised(order);
  const hasPhone = !!String(order.customer_phone || "").trim();
  const approval = order.customer_approval_status;
  const w = warrantyInfo(order);
  const paid = !!order.paid || balance <= 0.009;

  const statusPill = (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, color: st.color, background: tint(st.color, 0.12), border: `1px solid ${tint(st.color, 0.3)}`, whiteSpace: "nowrap" }}>
      <st.Icon className="w-4 h-4" /> {st.label}
    </span>
  );
  const dwellEl = dwell && (
    <span className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: dwell.severity === "normal" ? 500 : 700, color: DWELL_COLOR[dwell.severity] }}>
      <Clock className="w-3.5 h-3.5" /> {dwell.label}
    </span>
  );

  const dueValue = due === null
    ? "Sin fecha"
    : due < 0 ? `Atrasada ${Math.abs(due)}d` : due === 0 ? "Para hoy" : new Date(order.promised_date).toLocaleDateString("es-PR", { day: "numeric", month: "short" });
  const dueColor = due !== null && due < 0 ? C.red : due === 0 ? C.amber : due === null ? C.sub : C.text;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span style={{ width: 52, height: 52, borderRadius: 15, background: tint(bs.color, 0.16), color: bs.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <bs.Icon className="w-7 h-7" />
        </span>
        <div className="min-w-0 flex-1">
          <p style={{ fontSize: isDesktop ? 22 : 19, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>{displayDevice(order) || "Equipo"}</p>
          <p style={{ fontSize: 13, color: C.sub, marginTop: 3 }}>{[order.order_number, order.device_color].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        {isDesktop && (
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {statusPill}
            {dwellEl}
          </div>
        )}
      </div>

      {!isDesktop && (
        <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap" style={{ marginTop: 10 }}>
          {statusPill}
          {dwellEl}
        </div>
      )}

      {(order.warranty_claim || order.liquid_damage) && (
        <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
          {order.warranty_claim && <Pill color={C.amber} icon={ShieldCheck}>Garantía</Pill>}
          {order.liquid_damage && <Pill color={C.blue} icon={Droplets}>Daño por líquido</Pill>}
        </div>
      )}

      <div style={{ height: 0.5, background: C.sep, margin: "14px 0" }} />

      <div className="flex items-center gap-3">
        <button onClick={onOpenHistory} className="apple-press flex items-center gap-3 text-left min-w-0 flex-1">
          <span style={{ width: 38, height: 38, borderRadius: 999, background: tint(C.brand, 0.16), color: C.brand, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {initialsOf(order.customer_name) || "?"}
          </span>
          <span className="min-w-0">
            <span className="block truncate" style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{order.customer_name || "Cliente"}</span>
            <span className="flex items-center gap-2 min-w-0">
              <span className="truncate" style={{ fontSize: 13, color: C.sub }}>{[order.customer_phone, isDesktop ? order.customer_email : null].filter(Boolean).join(" · ") || "Sin contacto"}</span>
              {previousCount > 0 && <Pill color={C.brand} style={{ padding: "1px 8px", fontSize: 11 }}>{previousCount} {previousCount === 1 ? "previa" : "previas"}</Pill>}
            </span>
          </span>
        </button>
        {hasPhone && (
          <div className="flex items-center gap-2 shrink-0">
            <RoundBtn label="Llamar" Icon={Phone} color={C.green} onClick={() => onContact("call")} />
            <RoundBtn label="WhatsApp" Icon={MessageCircle} color="#25D366" onClick={() => onContact("whatsapp")} />
            <RoundBtn label="SMS" Icon={MessageSquare} color={C.blue} onClick={() => onContact("sms")} />
          </div>
        )}
      </div>

      {order.initial_problem && (
        <p className="flex items-start gap-2" style={{ fontSize: 14, color: C.text, marginTop: 14, padding: "10px 12px", borderRadius: 12, background: C.card2 }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: C.amber, marginTop: 2 }} />
          <span className="line-clamp-3" style={{ whiteSpace: "pre-wrap" }}>{order.initial_problem}</span>
        </p>
      )}

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))", marginTop: 12 }}>
        <Stat label="Balance" value={paid ? "Pagado" : money(balance)} color={paid ? C.green : C.red} onClick={onCharge} />
        <Stat label="Técnico" value={order.assigned_to_name || "Sin asignar"} color={order.assigned_to_name ? C.text : C.amber} onClick={onTech} />
        <Stat label="Entrega" value={dueValue} color={dueColor} onClick={onPromisedDate} />
      </div>

      {["pending", "approved", "rejected"].includes(approval) && (
        <div className="flex flex-wrap items-center gap-2" style={{ marginTop: 14 }}>
          {approval === "pending" && <Pill color={C.amber} icon={Clock}>Pendiente de aprobación</Pill>}
          {approval === "approved" && <Pill color={C.green} icon={CheckCircle2}>Cotización aprobada</Pill>}
          {approval === "rejected" && <Pill color={C.red} icon={XCircle}>Cotización rechazada</Pill>}
          {approval === "pending" && (
            <>
              <Pill color={C.green} solid onClick={() => onApproval(true)}>Aprobó</Pill>
              <Pill color={C.sub} onClick={() => onApproval(false)}>Rechazó</Pill>
            </>
          )}
        </div>
      )}

      {w && (
        <div className="flex items-center justify-between gap-3" style={{ marginTop: 14, padding: "10px 12px", borderRadius: 12, background: tint(w.none ? C.sub : w.left > 0 ? C.green : C.sub, 0.12) }}>
          <span className="flex items-center gap-2" style={{ fontSize: 14, color: w.none ? C.sub : w.left > 0 ? C.green : C.sub }}>
            <Shield className="w-4 h-4" />
            {w.none
              ? "Sin garantía"
              : `${w.left > 0 ? `Bajo garantía · ${w.left} ${w.left === 1 ? "día restante" : "días restantes"}` : "Garantía vencida"} · hasta ${w.until.toLocaleDateString("es-PR", { day: "numeric", month: "short", year: "numeric" })}`}
          </span>
          <button onClick={onWarranty} className="apple-press" style={{ fontSize: 14, fontWeight: 600, color: w.none ? C.brand : C.sub }}>
            {w.none ? "Añadir garantía" : "Editar garantía"}
          </button>
        </div>
      )}
    </Card>
  );
}
