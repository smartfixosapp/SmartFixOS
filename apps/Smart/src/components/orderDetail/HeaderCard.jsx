import React from "react";
import { Phone, MessageSquare, MessageCircle, Mail, ShieldCheck, Droplets, AlertTriangle, Clock, CheckCircle2, XCircle, Shield } from "lucide-react";
import { statusInfo, isOrderClosed } from "@/lib/orderStatus";
import { remainingBalance } from "@/lib/orderEmails";
import { C, tint, Card, Pill, money, displayDevice } from "./ui";

function daysUntilPromised(order) {
  if (!order?.promised_date || isOrderClosed(order)) return null;
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

export default function HeaderCard({ order, previousCount, onOpenHistory, onCharge, onPromisedDate, onContact, onEmail, onApproval, onWarranty, isDesktop }) {
  const st = statusInfo(order.status);
  const balance = remainingBalance(order);
  const due = daysUntilPromised(order);
  const hasPhone = !!String(order.customer_phone || "").trim();
  const hasEmail = !!String(order.customer_email || "").trim();
  const approval = order.customer_approval_status;
  const w = warrantyInfo(order);

  const contactTiles = [
    { key: "call", label: "Llamar", Icon: Phone, color: C.green },
    { key: "sms", label: "SMS", Icon: MessageSquare, color: C.blue },
    { key: "whatsapp", label: "WhatsApp", Icon: MessageCircle, color: "#25D366" },
    ...(hasEmail ? [{ key: "email", label: "Email", Icon: Mail, color: C.amber }] : []),
  ];

  return (
    <Card>
      <p style={{ fontSize: 13, color: C.sub }}>{order.order_number || "—"}</p>
      <div className="flex items-start justify-between gap-3" style={{ marginTop: 4 }}>
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <button onClick={onOpenHistory} className="apple-press text-left" style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1.2 }}>
            {order.customer_name || "Cliente"}
          </button>
          {previousCount > 0 && (
            <Pill color={C.brand}>{previousCount} {previousCount === 1 ? "previa" : "previas"}</Pill>
          )}
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 700, color: st.color, background: tint(st.color, 0.12), border: `1px solid ${tint(st.color, 0.25)}`, whiteSpace: "nowrap" }}>
          <st.Icon className="w-4 h-4" /> {st.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-2" style={{ marginTop: 10 }}>
        {order.warranty_claim && <Pill color={C.amber} icon={ShieldCheck}>Garantía</Pill>}
        {order.liquid_damage && <Pill color={C.blue} icon={Droplets}>Daño por líquido</Pill>}
        {balance > 0
          ? <Pill color={C.red} onClick={onCharge}>Balance {money(balance)}</Pill>
          : <Pill color={C.green}>Pagado</Pill>}
        {due !== null && (
          <Pill
            onClick={onPromisedDate}
            color={due < 0 ? C.red : due === 0 ? C.amber : C.sub}
            icon={Clock}
          >
            {due < 0 ? `Atrasada ${Math.abs(due)}d` : due === 0 ? "Para hoy" : `Listo para ${new Date(order.promised_date).toLocaleDateString("es-PR", { day: "numeric", month: "short" })}`}
          </Pill>
        )}
      </div>

      <p style={{ fontSize: 15, color: C.sub, marginTop: 10 }}>{displayDevice(order) || "Equipo"}</p>
      {isDesktop && order.initial_problem && (
        <p className="flex items-start gap-2" style={{ fontSize: 14, color: C.text, marginTop: 6 }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: C.amber, marginTop: 2 }} />
          <span className="line-clamp-2">{order.initial_problem}</span>
        </p>
      )}

      {hasPhone && (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${contactTiles.length}, minmax(0, 1fr))`, marginTop: 14 }}>
          {contactTiles.map((t) => (
            <button
              key={t.key}
              onClick={() => (t.key === "email" ? onEmail() : onContact(t.key))}
              className="apple-press flex flex-col items-center justify-center gap-1"
              style={{ minHeight: 56, borderRadius: 12, background: tint(t.color, 0.15), color: t.color, fontSize: 13, fontWeight: 600 }}
            >
              <t.Icon className="w-5 h-5" />
              {t.label}
            </button>
          ))}
        </div>
      )}

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
