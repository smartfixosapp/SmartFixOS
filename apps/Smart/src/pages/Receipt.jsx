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
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <span key={i} className="w-2 h-2 rounded-full bg-violet-500 animate-bounce"
            style={{ animationDelay: `${i*150}ms` }} />
        ))}
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className="text-center space-y-3">
        <p className="text-4xl">❌</p>
        <p className="text-white font-bold text-lg">{error}</p>
        <p className="text-white/40 text-sm">Verifica el link o contacta al taller.</p>
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
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-black text-emerald-300">Pago Completado</p>
          <p className="text-xs text-emerald-400/60">{STATUS_LABELS[order.status] || order.status}</p>
        </div>
        <span className="ml-auto text-lg font-black text-emerald-300">{currency(totalPaid || order.total_amount)}</span>
      </div>

      {/* Líneas de items */}
      {(order.order_items?.length > 0) ? (
        <div className="space-y-1.5">
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mb-2">Desglose</p>
          {order.order_items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-white/70">{item.name || item.description || "Servicio"}</span>
              <span className="text-white/90 font-medium">{currency(item.price || item.amount || 0)}</span>
            </div>
          ))}
          <div className="h-px bg-white/8 my-2" />
        </div>
      ) : null}

      {/* Totales */}
      <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] p-4 space-y-2">
        {order.subtotal > 0 && (
          <div className="flex justify-between text-sm text-white/50">
            <span>Subtotal</span><span>{currency(order.subtotal)}</span>
          </div>
        )}
        {order.tax_amount > 0 && (
          <div className="flex justify-between text-sm text-white/50">
            <span>IVU (11.5%)</span><span>{currency(order.tax_amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-black text-white pt-1 border-t border-white/10">
          <span>Total</span>
          <span className="text-emerald-300">{currency(totalPaid || order.total_amount)}</span>
        </div>
      </div>

      {/* Método de pago */}
      {txs.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Pagos</p>
          {txs.map((t, i) => (
            <div key={i} className="flex justify-between items-center px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <span className="text-sm text-white/60 capitalize">{t.payment_method?.replace("_", " ") || "Efectivo"}</span>
              <div className="text-right">
                <p className="text-sm font-bold text-white">{currency(t.amount)}</p>
                <p className="text-[10px] text-white/30">{fmt(t.created_date)}</p>
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
      <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-violet-500/10 border border-violet-500/25">
        <Clock className="w-4 h-4 text-violet-400 shrink-0" />
        <div>
          <p className="text-sm font-bold text-violet-300">Equipo Recibido</p>
          <p className="text-xs text-violet-400/60">{STATUS_LABELS[order.status] || order.status}</p>
        </div>
      </div>

      {/* Problema */}
      <div className="px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] space-y-1.5">
        <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Problema Reportado</p>
        <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
          {order.initial_problem || "Sin descripción"}
        </p>
      </div>

      {/* Nota de taller */}
      <div className="px-4 py-2.5 rounded-2xl bg-amber-500/[0.07] border border-amber-500/20">
        <p className="text-xs text-amber-300/70 leading-relaxed">
          Este documento confirma que {bizName} recibió tu equipo para diagnóstico y/o reparación.
          Te contactaremos cuando tengamos novedades.
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-8 print:bg-white print:text-black">
      <div className="w-full max-w-sm space-y-6">

        {/* Logo / Biz name */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center mx-auto mb-3 print:hidden">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-black text-white print:text-black">{bizName}</h1>
          <p className="text-xs text-white/40 print:text-gray-500">
            {isPaid ? "Recibo de Pago" : "Recibo de Recepción"}
          </p>
        </div>

        {/* Número de orden */}
        <div className="text-center">
          <span className="inline-block px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-sm font-mono font-bold text-white/80 print:border-gray-300 print:text-gray-700">
            {receiptNum}
          </span>
        </div>

        {/* Datos del cliente y equipo */}
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.07] divide-y divide-white/[0.06] print:border-gray-200 print:divide-gray-200">
          {[
            ["Cliente",  order.customer_name],
            ["Teléfono", order.customer_phone || "—"],
            ["Equipo",   `${order.device_brand || ""} ${order.device_model || ""}`.trim() || "—"],
            ["Fecha",    fmt(order.created_date)],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between items-center px-4 py-2.5">
              <span className="text-xs text-white/35 print:text-gray-400">{label}</span>
              <span className="text-sm text-white/85 font-medium print:text-black">{val}</span>
            </div>
          ))}
        </div>

        {/* Cuerpo del recibo */}
        {isPaid ? <PaymentReceipt /> : <IntakeReceipt />}

        {/* Acciones (no se imprimen) */}
        <div className="flex gap-2 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/[0.06] border border-white/10 text-sm font-bold text-white/70 hover:bg-white/10 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          {order.customer_phone && (
            <a
              href={`https://wa.me/${order.customer_phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                `Hola ${order.customer_name}, aquí está tu recibo de ${bizName}: ${window.location.href}`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl bg-green-600 hover:bg-green-500 text-sm font-bold text-white transition-colors"
            >
              💬 WhatsApp
            </a>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-white/50 print:text-gray-400">
          Powered by SmartFixOS · {new Date().getFullYear()}
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
          .print\\:divide-gray-200 > * { border-color: #e5e7eb !important; }
          .print\\:text-gray-400 { color: #9ca3af !important; }
          .print\\:text-gray-500 { color: #6b7280 !important; }
          .print\\:text-gray-700 { color: #374151 !important; }
        }
      `}</style>
    </div>
  );
}
