import React from "react";
import { Star, Lock, Zap, AlertTriangle } from "lucide-react";
import { remainingBalance } from "@/lib/orderEmails";
import { isTerminal } from "@/lib/orderStatus";
import { C, Card, SectionHeader, Row, money } from "./ui";

function Stars({ rating }) {
  const color = rating <= 3 ? C.red : "#FFD60A";
  return (
    <span className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className="w-5 h-5" style={{ color: n <= rating ? color : C.card2, fill: n <= rating ? color : "transparent" }} />
      ))}
    </span>
  );
}

export function RatingCard({ order }) {
  const rating = parseInt(order.review_rating, 10);
  return (
    <>
      {Number.isFinite(rating) && rating > 0 && (
        <div>
          <SectionHeader>Calificación del cliente</SectionHeader>
          <Card>
            <Stars rating={rating} />
            {order.review_feedback && <p style={{ fontSize: 14, color: C.text, marginTop: 8 }}>{order.review_feedback}</p>}
          </Card>
        </div>
      )}

    </>
  );
}

export function QuickServiceCard({ order, onQuickService }) {
  const showQuick = order.status === "intake" || order.status === "diagnosing";
  return (
    <>
      {showQuick && (
        <div>
          <SectionHeader>Tipo de orden</SectionHeader>
          <Card>
            <div className="grid grid-cols-2 gap-1" style={{ padding: 3, borderRadius: 12, background: C.card2 }}>
              {[[false, "Regular"], [true, "Rápida"]].map(([v, l]) => {
                const on = !!order.is_quick_service === v;
                return (
                  <button key={l} onClick={() => onQuickService(v)} className="apple-press" style={{ padding: "9px 0", borderRadius: 10, fontSize: 14, fontWeight: 700, background: on ? "#fff" : "transparent", color: on ? "#000" : C.sub }}>
                    {l}
                  </button>
                );
              })}
            </div>
            <p className="flex items-center gap-2" style={{ fontSize: 13, marginTop: 10, color: order.is_quick_service ? C.green : C.sub }}>
              {order.is_quick_service ? <Zap className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {order.is_quick_service ? "Sale de la cola de Diagnóstico — se puede trabajar en cualquier momento" : "Sigue el orden de llegada"}
            </p>
          </Card>
        </div>
      )}

    </>
  );
}

export function DeviceCard({ order, onPromisedDate, compact = false }) {
  const reported = order.device_security?.imei_check_result === "reported";
  const hasPromised = !!order.promised_date && !isTerminal(order.status);
  const serial = order.device_serial || order.device_security?.device_imei;
  const hasContent = !compact || !!order.device_color || !!serial || reported || !hasPromised;
  if (!hasContent) return null;
  return (
      <div>
        <SectionHeader>Dispositivo</SectionHeader>
        <Card style={{ padding: "0 16px" }}>
          {!compact && order.device_type && <Row label="Tipo" value={order.device_type} />}
          {!compact && order.device_brand && <Row label="Marca" value={order.device_brand} />}
          {!compact && (order.device_model || order.device_family) && <Row label="Modelo" value={order.device_model || order.device_family} />}
          {order.device_color && <Row label="Color" value={order.device_color} />}
          {(order.device_serial || order.device_security?.device_imei) && <Row label="Serial/IMEI" value={order.device_serial || order.device_security?.device_imei} />}
          {reported && (
            <p className="flex items-center gap-2" style={{ padding: "12px 0", fontSize: 14, color: C.red, fontWeight: 600 }}>
              <AlertTriangle className="w-4 h-4" /> Este equipo fue reportado como robado/perdido
            </p>
          )}
          {!hasPromised && <Row label="Listo para" value="Sin fecha" valueColor={C.sub} onClick={onPromisedDate} />}
        </Card>
      </div>
  );
}

export default function InfoSections({ order, onOpenHistory, onTech, onQuickService, onPromisedDate }) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const balance = remainingBalance(order);

  return (
    <div className="flex flex-col gap-5">
      <RatingCard order={order} />
      <div>
        <SectionHeader>Cliente</SectionHeader>
        <Card style={{ padding: "0 16px" }}>
          <Row label="Nombre" value={order.customer_name || "—"} onClick={onOpenHistory} />
          <Row label="Telefono" value={order.customer_phone || "—"} onClick={order.customer_phone ? () => { window.location.href = `tel:${String(order.customer_phone).replace(/[^\d+]/g, "")}`; } : undefined} />
          <Row label="Email" value={order.customer_email || "—"} />
          <Row label="Técnico" value={order.assigned_to_name || "Sin asignar"} valueColor={order.assigned_to_name ? C.text : C.amber} onClick={onTech} />
        </Card>
      </div>

      <QuickServiceCard order={order} onQuickService={onQuickService} />
      <DeviceCard order={order} onPromisedDate={onPromisedDate} />
      {order.initial_problem && (
        <div>
          <SectionHeader>Problema Reportado</SectionHeader>
          <Card><p style={{ fontSize: 15, color: C.text, whiteSpace: "pre-wrap" }}>{order.initial_problem}</p></Card>
        </div>
      )}

      <div>
        <SectionHeader>Financiero</SectionHeader>
        <Card style={{ padding: "0 16px" }}>
          <div style={{ padding: "12px 0", borderBottom: `0.5px solid ${C.sep}` }}>
            <p style={{ fontSize: 15, color: C.sub, marginBottom: items.length ? 8 : 0 }}>Artículos</p>
            {items.length === 0 ? (
              <p style={{ fontSize: 14, color: C.sub }}>Carrito vacío</p>
            ) : items.map((it, idx) => {
              const qty = parseInt(it.quantity ?? 1, 10) || 1;
              const price = Number(it.price || 0);
              const isDiscount = it.type === "discount";
              const total = it.total != null ? Number(it.total) : qty * price;
              return (
                <div key={it.id || idx} className="flex justify-between gap-3" style={{ padding: "6px 0" }}>
                  <div className="min-w-0">
                    <p className="truncate" style={{ fontSize: 14, color: isDiscount ? C.red : C.text }}>{it.name || "Item"}</p>
                    {!isDiscount && <p style={{ fontSize: 12, color: C.sub }}>{qty} × {money(price)}{Number(it.discountPercent || it.discount_percent || 0) > 0 ? ` · -${it.discountPercent || it.discount_percent}%` : ""}</p>}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: isDiscount ? C.red : C.text }}>{money(total)}</p>
                </div>
              );
            })}
          </div>
          {Number(order.cost_estimate || 0) > 0 && <Row label="Cotizacion" value={money(order.cost_estimate)} />}
          {Number(order.labor_cost || 0) > 0 && <Row label="Mano de Obra" value={money(order.labor_cost)} />}
          <Row label="Pagado" value={money(order.amount_paid)} valueColor={C.green} />
          {Number(order.balance_due || 0) > 0 && <Row label="Balance" value={money(order.balance_due)} valueColor={C.red} />}
          <Row label="Estado de Pago" value={order.paid || balance <= 0 ? "Pagado ✓" : "Pendiente"} valueColor={order.paid || balance <= 0 ? C.green : C.amber} />
        </Card>
      </div>
    </div>
  );
}
