import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../../../lib/supabase-client.js";
import { CheckCircle2, Printer, Clock, Package, Wrench } from "lucide-react";

const STATUS_LABELS = {
  intake:          "Recepción / Diagnóstico",
  diagnosing:      "En Diagnóstico",
  in_progress:     "En Reparación",
  waiting_parts:   "Esperando Piezas",
  ready:           "Listo para Recoger",
  completed:       "Completado",
  delivered:       "Entregado",
  picked_up:       "Retirado",
  cancelled:       "Cancelado",
};

const PAID_STATUSES = ["completed", "delivered", "picked_up"];

function fmt(date) {
  if (!date) return "—";
  const d = new Date(date);
  return d.toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" });
}

function currency(n) {
  return (Number(n) || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function Receipt() {
  const [params] = useSearchParams();
  const orderId  = params.get("order_id");
  const autoPrint = params.get("print") === "1";
  const [order, setOrder]   = useState(null);
  const [txs, setTxs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const [bizName, setBizName] = useState("SmartFixOS");

  useEffect(() => {
    if (!orderId) { setError("ID de orden no proporcionado."); setLoading(false); return; }

    (async () => {
      try {
        const tenantId = localStorage.getItem("smartfix_tenant_id");

        // Fetch order
        let q = supabase.from("order").select("*").eq("id", orderId);
        if (tenantId) q = q.eq("tenant_id", tenantId);
        const { data: ord, error: ordErr } = await q.single();
        if (ordErr || !ord) throw new Error("Orden no encontrada.");
        setOrder(ord);

        // Fetch transactions for this order (para recibo de pago)
        const { data: txData } = await supabase
          .from("transaction")
          .select("*")
          .eq("order_id", orderId)
          .eq("type", "income")
          .order("created_date", { ascending: false });
        setTxs(txData || []);

        // Fetch biz name from app_settings if available
        const { data: cfg } = await supabase
          .from("app_settings")
          .select("payload")
          .eq("slug", "general-settings")
          .single();
        if (cfg?.payload?.storeName) setBizName(cfg.payload.storeName);
      } catch (e) {
        setError(e.message || "Error al cargar la orden.");
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // Auto-print cuando se carga con ?print=1
  useEffect(() => {
    if (!autoPrint || loading || !order) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
  }, [autoPrint, loading, order]);

  if (loading) return (
    <div className="min-h-dvh apple-surface apple-type flex items-center justify-center">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <span key={i} className="w-2 h-2 rounded-full bg-apple-blue animate-bounce"
            style={{ animationDelay: `${i*150}ms` }} />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-dvh apple-surface apple-type flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        <p className="apple-text-large-title">❌</p>
        <p className="apple-text-title3 apple-label-primary">{error}</p>
        <p className="apple-text-subheadline apple-label-secondary">Verifica el link o contacta al taller.</p>
      </div>
    </div>
  );

  const isPaid    = PAID_STATUSES.includes(order.status);
  const totalPaid = txs.reduce((s, t) => s + (t.amount || 0), 0);
  const receiptNum = order.order_number || `#${order.id?.slice(-6).toUpperCase()}`;

  // ── Recibo de pago (completado)
  const PaymentReceipt = () => (
    <div className="space-y-5">
      {/* Header estado */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-apple-md bg-apple-green/12 print:bg-white print:border print:border-gray-200">
        <CheckCircle2 className="w-5 h-5 text-apple-green shrink-0" />
        <div>
          <p className="apple-text-subheadline text-apple-green font-semibold print:text-black">Pago Completado</p>
          <p className="apple-text-caption1 text-apple-green/80 print:text-gray-500">{STATUS_LABELS[order.status] || order.status}</p>
        </div>
        <span className="ml-auto apple-text-title3 text-apple-green font-semibold tabular-nums print:text-black">{currency(totalPaid || order.total_amount)}</span>
      </div>

      {/* Líneas de items */}
      {(order.order_items?.length > 0) ? (
        <div className="space-y-1.5">
          <p className="apple-text-caption1 apple-label-tertiary font-semibold mb-2 print:text-gray-500">Desglose</p>
          {order.order_items.map((item, i) => (
            <div key={i} className="flex justify-between apple-text-subheadline">
              <span className="apple-label-secondary print:text-black">{item.name || item.description || "Servicio"}</span>
              <span className="apple-label-primary font-medium tabular-nums print:text-black">{currency(item.price || item.amount || 0)}</span>
            </div>
          ))}
          <div
            className="my-2"
            style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
          />
        </div>
      ) : null}

      {/* Totales */}
      <div className="apple-card p-4 space-y-2 print:border print:border-gray-200">
        {order.subtotal > 0 && (
          <div className="flex justify-between apple-text-subheadline apple-label-secondary print:text-black">
            <span>Subtotal</span><span className="tabular-nums">{currency(order.subtotal)}</span>
          </div>
        )}
        {order.tax_amount > 0 && (
          <div className="flex justify-between apple-text-subheadline apple-label-secondary print:text-black">
            <span>IVU (11.5%)</span><span className="tabular-nums">{currency(order.tax_amount)}</span>
          </div>
        )}
        <div
          className="flex justify-between apple-text-body apple-label-primary font-semibold pt-1 print:text-black"
          style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
        >
          <span>Total</span>
          <span className="text-apple-green tabular-nums print:text-black">{currency(totalPaid || order.total_amount)}</span>
        </div>
      </div>

      {/* Método de pago */}
      {txs.length > 0 && (
        <div className="space-y-1.5">
          <p className="apple-text-caption1 apple-label-tertiary font-semibold print:text-gray-500">Pagos</p>
          {txs.map((t, i) => (
            <div key={i} className="flex justify-between items-center px-3 py-2 rounded-apple-sm bg-apple-surface-secondary print:bg-white print:border print:border-gray-200">
              <span className="apple-text-subheadline apple-label-secondary capitalize print:text-black">{t.payment_method?.replace("_", " ") || "Efectivo"}</span>
              <div className="text-right">
                <p className="apple-text-subheadline apple-label-primary font-semibold tabular-nums print:text-black">{currency(t.amount)}</p>
                <p className="apple-text-caption2 apple-label-tertiary tabular-nums print:text-gray-500">{fmt(t.created_date)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ── Recibo de entrada (intake)
  const IntakeReceipt = () => (
    <div className="space-y-4">
      {/* Estado actual */}
      <div className="flex items-center gap-2 px-4 py-3 rounded-apple-md bg-apple-purple/12 print:bg-white print:border print:border-gray-200">
        <Clock className="w-4 h-4 text-apple-purple shrink-0" />
        <div>
          <p className="apple-text-subheadline text-apple-purple font-semibold print:text-black">Equipo Recibido</p>
          <p className="apple-text-caption1 text-apple-purple/80 print:text-gray-500">{STATUS_LABELS[order.status] || order.status}</p>
        </div>
      </div>

      {/* Problema */}
      <div className="apple-card px-4 py-3 space-y-1.5 print:border print:border-gray-200">
        <p className="apple-text-caption1 apple-label-tertiary font-semibold print:text-gray-500">Problema Reportado</p>
        <p className="apple-text-subheadline apple-label-primary leading-relaxed whitespace-pre-wrap print:text-black">
          {order.initial_problem || "Sin descripción"}
        </p>
      </div>

      {/* Nota de taller */}
      <div className="px-4 py-2.5 rounded-apple-md bg-apple-yellow/12 print:bg-white print:border print:border-gray-200">
        <p className="apple-text-caption1 text-apple-yellow leading-relaxed print:text-gray-700">
          Este documento confirma que {bizName} recibió tu equipo para diagnóstico y/o reparación.
          Te contactaremos cuando tengamos novedades.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh apple-surface apple-type flex flex-col items-center px-4 py-8 print:bg-white print:text-black">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / Biz name */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center mx-auto mb-3 print:hidden">
            <Wrench className="w-6 h-6 text-apple-purple" />
          </div>
          <h1 className="apple-text-title2 apple-label-primary font-semibold print:text-black">{bizName}</h1>
          <p className="apple-text-caption1 apple-label-tertiary print:text-gray-500">
            {isPaid ? "Recibo de Pago" : "Recibo de Recepción"}
          </p>
        </div>

        {/* Número de orden */}
        <div className="text-center">
          <span className="inline-block px-4 py-1.5 rounded-apple-sm apple-surface-secondary apple-text-subheadline font-semibold apple-label-secondary tabular-nums print:border print:border-gray-300 print:bg-white print:text-gray-700">
            {receiptNum}
          </span>
        </div>

        {/* Datos del cliente y equipo */}
        <div className="apple-card overflow-hidden print:border print:border-gray-200">
          {[
            ["Cliente",  order.customer_name],
            ["Teléfono", order.customer_phone || "—"],
            ["Equipo",   `${order.device_brand || ""} ${order.device_model || ""}`.trim() || "—"],
            ["Fecha",    fmt(order.created_date)],
          ].map(([label, val], idx) => (
            <div
              key={label}
              className="flex justify-between items-center px-4 py-2.5"
              style={idx > 0 ? { borderTop: "0.5px solid rgb(var(--separator) / 0.29)" } : undefined}
            >
              <span className="apple-text-caption1 apple-label-tertiary print:text-gray-400">{label}</span>
              <span className="apple-text-subheadline apple-label-primary font-medium print:text-black">{val}</span>
            </div>
          ))}
        </div>

        {/* Cuerpo del recibo */}
        {isPaid ? <PaymentReceipt /> : <IntakeReceipt />}

        {/* Acciones (no se imprimen) */}
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 apple-btn apple-btn-secondary apple-press"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </button>
          {order.customer_phone && (
            <a
              href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Hola ${order.customer_name}, aquí está tu recibo de ${bizName}: ${window.location.href}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 apple-btn apple-btn-primary apple-press flex items-center justify-center gap-2"
            >
              WhatsApp
            </a>
          )}
        </div>

        {/* Footer */}
        <p className="text-center apple-text-caption2 apple-label-tertiary print:text-gray-400">
          Powered by SmartFixOS · <span className="tabular-nums">{new Date().getFullYear()}</span>
        </p>
      </div>

      {/* CSS de impresión */}
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:text-black { color: black !important; }
          .print\\:border-gray-200 { border-color: #e5e7eb !important; }
          .print\\:text-gray-400 { color: #9ca3af !important; }
          .print\\:text-gray-500 { color: #6b7280 !important; }
          .print\\:text-gray-700 { color: #374151 !important; }
        }
      `}</style>
    </div>
  );
}
