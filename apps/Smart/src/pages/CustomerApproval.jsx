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
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (pageStatus === STATUS.notFound || pageStatus === STATUS.error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-white font-bold text-lg">Enlace no válido</p>
          <p className="text-white/40 text-sm mt-1">Este link de aprobación no existe o expiró.</p>
        </div>
      </div>
    );
  }

  if (pageStatus === STATUS.approved) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-9 h-9 text-emerald-400" />
          </div>
          <p className="text-white font-black text-2xl">¡Aprobado!</p>
          <p className="text-white/50 text-sm mt-2">Comenzaremos a trabajar en tu equipo enseguida.</p>
          <p className="text-white/30 text-xs mt-4">{bizName}</p>
        </div>
      </div>
    );
  }

  if (pageStatus === STATUS.rejected) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-9 h-9 text-red-400" />
          </div>
          <p className="text-white font-black text-2xl">Reparación rechazada</p>
          <p className="text-white/50 text-sm mt-2">Hemos registrado tu respuesta. Contactaremos al taller para coordinar la devolución.</p>
          <p className="text-white/30 text-xs mt-4">{bizName}</p>
        </div>
      </div>
    );
  }

  if (pageStatus === STATUS.alreadyActed) {
    const acted = order?.customer_approval_status;
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="text-center">
          {acted === "approved" ? (
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          ) : (
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          )}
          <p className="text-white font-bold text-lg">Ya respondiste esta cotización</p>
          <p className="text-white/40 text-sm mt-1">
            {acted === "approved" ? "Aprobaste" : "Rechazaste"} esta reparación.
          </p>
          <p className="text-white/30 text-xs mt-4">{bizName}</p>
        </div>
      </div>
    );
  }

  // STATUS.ready — show estimate
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-black text-white/30 uppercase tracking-widest">{bizName}</p>
          <h1 className="text-2xl font-black tracking-tight">Cotización de Reparación</h1>
          <p className="text-white/40 text-sm">
            {order?.order_number && <span>Orden {order.order_number} · </span>}
            {order?.device_brand} {order?.device_model}
          </p>
        </div>

        {/* Customer name */}
        {order?.customer_name && (
          <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/[0.07] text-center">
            <p className="text-white/40 text-xs mb-1">Preparada para</p>
            <p className="font-black text-lg">{order.customer_name}</p>
          </div>
        )}

        {/* Waiting indicator */}
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/15">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300 font-semibold">Esperando tu aprobación para comenzar</p>
        </div>

        {/* Items */}
        {items.length > 0 && (
          <div className="rounded-2xl border border-white/[0.07] overflow-hidden">
            <button
              onClick={() => setShowItems(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
            >
              <span className="text-xs font-black text-white/50 uppercase tracking-widest">
                Detalle ({items.length} {items.length === 1 ? "item" : "items"})
              </span>
              {showItems ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
            </button>
            {showItems && (
              <div className="divide-y divide-white/[0.05]">
                {items.map((item, idx) => {
                  const qty = Number(item?.qty || item?.quantity || 1);
                  const price = Number(item?.price || 0);
                  const disc = Number(item?.discount_percentage || 0);
                  const lineTotal = price * qty * (1 - disc / 100);
                  const Icon = item?.type === "service" ? Wrench : Package;
                  return (
                    <div key={idx} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-7 h-7 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-white/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{item?.name || "Item"}</p>
                        <p className="text-[11px] text-white/30">
                          {currency(price)} × {qty}{disc > 0 ? ` · -${disc}%` : ""}
                        </p>
                      </div>
                      <p className="text-sm font-black text-white shrink-0">{currency(lineTotal)}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="px-4 py-3 bg-white/[0.03] border-t border-white/[0.07] flex justify-between items-center">
              <span className="text-xs font-black text-white/40 uppercase tracking-widest">Total estimado</span>
              <span className="text-xl font-black text-white">{currency(total)}</span>
            </div>
          </div>
        )}

        {items.length === 0 && (
          <div className="p-6 rounded-2xl border border-white/[0.07] text-center">
            <p className="text-white/40 text-sm">El taller tiene tu cotización preparada. Usa los botones abajo para responder.</p>
          </div>
        )}

        {/* Notes from order */}
        {order?.notes && (
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.07]">
            <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Notas del técnico</p>
            <p className="text-sm text-white/70 leading-relaxed">{order.notes}</p>
          </div>
        )}

        {/* CTA buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => handleDecision("rejected")}
            disabled={submitting}
            className="py-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-400 font-black text-base hover:bg-red-500/10 active:scale-95 transition-all disabled:opacity-50"
          >
            <XCircle className="w-5 h-5 mx-auto mb-1" />
            Rechazar
          </button>
          <button
            onClick={() => handleDecision("approved")}
            disabled={submitting}
            className="py-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300 font-black text-base hover:bg-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1" />
            Aprobar
          </button>
        </div>

        <p className="text-center text-white/20 text-xs pb-4">
          Tu respuesta será notificada al taller inmediatamente.
        </p>
      </div>
    </div>
  );
}
