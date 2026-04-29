import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../../../lib/supabase-client.js";
import { CheckCircle2, XCircle, Clock, Wrench, Package, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

function currency(n) {
  return (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const STATUS = {
  loading: "loading",
  notFound: "not_found",
  ready: "ready",
  approved: "approved",
  rejected: "rejected",
  alreadyActed: "already_acted",
  error: "error",
};

export default function CustomerApproval() {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const [order, setOrder] = useState(null);
  const [pageStatus, setPageStatus] = useState(STATUS.loading);
  const [submitting, setSubmitting] = useState(false);
  const [bizName, setBizName] = useState("SmartFixOS");
  const [showItems, setShowItems] = useState(true);

  useEffect(() => {
    if (!orderId) { setPageStatus(STATUS.notFound); return; }
    (async () => {
      try {
        const tenantId = new URLSearchParams(window.location.search).get("t") ||
          localStorage.getItem("smartfix_tenant_id");

        let q = supabase.from("order").select("*").eq("id", orderId);
        if (tenantId) q = q.eq("tenant_id", tenantId);
        const { data: ord, error } = await q.single();
        if (error || !ord) { setPageStatus(STATUS.notFound); return; }

        setOrder(ord);

        // Fetch tenant name
        if (tenantId || ord.tenant_id) {
          const { data: tenant } = await supabase
            .from("tenant")
            .select("name")
            .eq("id", tenantId || ord.tenant_id)
            .single();
          if (tenant?.name) setBizName(tenant.name);
        }

        if (ord.customer_approval_status === "approved") {
          setPageStatus(STATUS.alreadyActed);
        } else if (ord.customer_approval_status === "rejected") {
          setPageStatus(STATUS.alreadyActed);
        } else {
          setPageStatus(STATUS.ready);
        }
      } catch (e) {
        console.error(e);
        setPageStatus(STATUS.error);
      }
    })();
  }, [orderId]);

  async function handleDecision(decision) {
    if (!order) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("order")
        .update({
          customer_approval_status: decision,
          customer_approval_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      if (error) throw error;
      setPageStatus(decision === "approved" ? STATUS.approved : STATUS.rejected);
    } catch (e) {
      console.error(e);
      alert("Ocurrió un error al procesar tu respuesta. Intenta de nuevo.");
    }
    setSubmitting(false);
  }

  // Compute items + totals
  const items = Array.isArray(order?.order_items) ? order.order_items : [];
  const subtotal = items.reduce((s, i) => {
    const qty = Number(i?.qty || i?.quantity || 1);
    const price = Number(i?.price || 0);
    const disc = Number(i?.discount_percentage || 0);
    return s + price * qty * (1 - disc / 100);
  }, 0);
  const total = subtotal;

  // ── Pages ──────────────────────────────────────────────────────────────────

  if (pageStatus === STATUS.loading) {
    return (
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-apple-blue/20 border-t-apple-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (pageStatus === STATUS.notFound || pageStatus === STATUS.error) {
    return (
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-14 h-14 rounded-apple-sm bg-apple-orange/12 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-apple-orange" />
          </div>
          <p className="apple-text-title3 apple-label-primary">Enlace no válido</p>
          <p className="apple-text-subheadline apple-label-secondary mt-1">Este link de aprobación no existe o expiró.</p>
        </div>
      </div>
    );
  }

  if (pageStatus === STATUS.approved) {
    return (
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-apple-sm bg-apple-green/12 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-apple-green" />
          </div>
          <p className="apple-text-title1 apple-label-primary">¡Aprobado!</p>
          <p className="apple-text-subheadline apple-label-secondary mt-2">Comenzaremos a trabajar en tu equipo enseguida.</p>
          <p className="apple-text-footnote apple-label-tertiary mt-4">{bizName}</p>
        </div>
      </div>
    );
  }

  if (pageStatus === STATUS.rejected) {
    return (
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-apple-sm bg-apple-red/12 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-9 h-9 text-apple-red" />
          </div>
          <p className="apple-text-title1 apple-label-primary">Reparación rechazada</p>
          <p className="apple-text-subheadline apple-label-secondary mt-2">Hemos registrado tu respuesta. Contactaremos al taller para coordinar la devolución.</p>
          <p className="apple-text-footnote apple-label-tertiary mt-4">{bizName}</p>
        </div>
      </div>
    );
  }

  if (pageStatus === STATUS.alreadyActed) {
    const acted = order?.customer_approval_status;
    return (
      <div className="min-h-dvh apple-surface apple-type flex items-center justify-center px-4">
        <div className="text-center">
          <div className={`w-14 h-14 rounded-apple-sm ${acted === "approved" ? "bg-apple-green/12" : "bg-apple-red/12"} flex items-center justify-center mx-auto mb-4`}>
            {acted === "approved" ? (
              <CheckCircle2 className="w-7 h-7 text-apple-green" />
            ) : (
              <XCircle className="w-7 h-7 text-apple-red" />
            )}
          </div>
          <p className="apple-text-title3 apple-label-primary">Ya respondiste esta cotización</p>
          <p className="apple-text-subheadline apple-label-secondary mt-1">
            {acted === "approved" ? "Aprobaste" : "Rechazaste"} esta reparación.
          </p>
          <p className="apple-text-footnote apple-label-tertiary mt-4">{bizName}</p>
        </div>
      </div>
    );
  }

  // STATUS.ready — show estimate
  return (
    <div className="min-h-dvh apple-surface apple-type">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="apple-text-footnote apple-label-tertiary">{bizName}</p>
          <h1 className="apple-text-title1 apple-label-primary">Cotización de Reparación</h1>
          <p className="apple-text-subheadline apple-label-secondary">
            {order?.order_number && <span className="tabular-nums">Orden {order.order_number} · </span>}
            {order?.device_brand} {order?.device_model}
          </p>
        </div>

        {/* Customer name */}
        {order?.customer_name && (
          <div className="apple-card p-4 text-center">
            <p className="apple-text-footnote apple-label-secondary mb-1">Preparada para</p>
            <p className="apple-text-title3 apple-label-primary">{order.customer_name}</p>
          </div>
        )}

        {/* Waiting indicator */}
        <div className="flex items-center gap-2 p-3 rounded-apple-md bg-apple-yellow/12">
          <Clock className="w-4 h-4 text-apple-yellow shrink-0" />
          <p className="apple-text-subheadline text-apple-yellow font-semibold">Esperando tu aprobación para comenzar</p>
        </div>

        {/* Items */}
        {items.length > 0 && (
          <div className="apple-card overflow-hidden">
            <button
              onClick={() => setShowItems(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 apple-press"
            >
              <span className="apple-text-subheadline apple-label-secondary font-semibold">
                Detalle ({items.length} {items.length === 1 ? "item" : "items"})
              </span>
              {showItems ? <ChevronUp className="w-4 h-4 apple-label-tertiary" /> : <ChevronDown className="w-4 h-4 apple-label-tertiary" />}
            </button>
            {showItems && (
              <div>
                {items.map((item, idx) => {
                  const qty = Number(item?.qty || item?.quantity || 1);
                  const price = Number(item?.price || 0);
                  const disc = Number(item?.discount_percentage || 0);
                  const lineTotal = price * qty * (1 - disc / 100);
                  const Icon = item?.type === "service" ? Wrench : Package;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
                    >
                      <div className="w-8 h-8 rounded-apple-sm bg-apple-blue/12 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-apple-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="apple-text-subheadline apple-label-primary font-semibold truncate">{item?.name || "Item"}</p>
                        <p className="apple-text-caption1 apple-label-tertiary tabular-nums">
                          {currency(price)} × {qty}{disc > 0 ? ` · -${disc}%` : ""}
                        </p>
                      </div>
                      <p className="apple-text-subheadline apple-label-primary font-semibold shrink-0 tabular-nums">{currency(lineTotal)}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <div
              className="px-4 py-3 flex justify-between items-center"
              style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
            >
              <span className="apple-text-subheadline apple-label-secondary font-semibold">Total estimado</span>
              <span className="apple-text-title3 apple-label-primary font-semibold tabular-nums">{currency(total)}</span>
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="apple-card p-6 text-center">
            <p className="apple-text-subheadline apple-label-secondary">El taller tiene tu cotización preparada. Usa los botones abajo para responder.</p>
          </div>
        )}

        {/* Notes from order */}
        {order?.notes && (
          <div className="apple-card p-4">
            <p className="apple-text-caption1 apple-label-tertiary font-semibold mb-1">Notas del técnico</p>
            <p className="apple-text-subheadline apple-label-primary leading-relaxed">{order.notes}</p>
          </div>
        )}

        {/* CTA buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => handleDecision("rejected")}
            disabled={submitting}
            className="py-4 rounded-apple-md bg-apple-red/12 text-apple-red apple-text-body font-semibold apple-press disabled:opacity-50 flex flex-col items-center justify-center gap-1"
          >
            <XCircle className="w-5 h-5" />
            Rechazar
          </button>
          <button
            onClick={() => handleDecision("approved")}
            disabled={submitting}
            className="py-4 rounded-apple-md bg-apple-green/15 text-apple-green apple-text-body font-semibold apple-press disabled:opacity-50 flex flex-col items-center justify-center gap-1"
          >
            <CheckCircle2 className="w-5 h-5" />
            Aprobar
          </button>
        </div>

        <p className="text-center apple-label-secondary apple-text-caption1 pb-4">
          Tu respuesta será notificada al taller inmediatamente.
        </p>
      </div>
    </div>
  );
}
