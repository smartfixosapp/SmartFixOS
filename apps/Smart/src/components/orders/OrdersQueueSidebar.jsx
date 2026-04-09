import React, { useMemo } from "react";
import { ChevronRight, Clock, Smartphone, Laptop, Tablet, Watch, Gamepad2, Box, Zap } from "lucide-react";
import { getStatusConfig, getEffectiveOrderStatus } from "@/components/utils/statusRegistry";
import { cn } from "@/lib/utils";

const DEVICE_ICONS = {
  smartphone: Smartphone, phone: Smartphone, celular: Smartphone, iphone: Smartphone,
  laptop: Laptop, notebook: Laptop, macbook: Laptop,
  tablet: Tablet, ipad: Tablet,
  watch: Watch, smartwatch: Watch, reloj: Watch,
  console: Gamepad2, consola: Gamepad2,
};

function DeviceIcon({ type, brand, model }) {
  const search = `${type || ""} ${brand || ""} ${model || ""}`.toLowerCase();
  const Icon = Object.entries(DEVICE_ICONS).find(([k]) => search.includes(k))?.[1] || Box;
  return <Icon className="w-3.5 h-3.5 text-white/50 shrink-0" />;
}

// Estados ACCIONABLES — solo los que estamos trabajando en el momento
const ACTIONABLE_STATUSES = new Set([
  "intake",       // Recepción
  "diagnosing",   // Diagnóstico
  "in_progress",  // En Reparación
  "warranty",     // Garantía
]);

function extractSeq(orderNumber) {
  if (!orderNumber) return 0;
  const match = String(orderNumber).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

function timeSince(date) {
  if (!date) return "";
  const now = Date.now();
  const diff = Math.max(0, now - new Date(date).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function OrdersQueueSidebar({ orders = [], selectedOrderId, onSelectOrder }) {
  // Lista plana ordenada por # de orden ascendente (las más viejas primero)
  // Solo muestra órdenes ACCIONABLES (no las que esperan clientes/proveedores)
  const queue = useMemo(() => {
    const active = (orders || []).filter(o => {
      const st = getEffectiveOrderStatus(o);
      return ACTIONABLE_STATUSES.has(st);
    });

    return active.sort((a, b) => {
      const seqA = extractSeq(a.order_number);
      const seqB = extractSeq(b.order_number);
      if (seqA !== seqB) return seqA - seqB; // Menor número = más viejo = primero
      // Fallback: por fecha de creación
      return new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime();
    });
  }, [orders]);

  if (queue.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <Box className="w-10 h-10 text-white/15 mb-3" />
        <p className="text-sm text-white/40 font-semibold">Sin órdenes activas</p>
        <p className="text-xs text-white/25 mt-1">Las nuevas aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-white/[0.06] bg-[#0D0D0F]/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Cola de trabajo</p>
            <p className="text-[9px] text-white/25 mt-0.5">Ordenadas por #</p>
          </div>
          <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">
            {queue.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {queue.map((order, idx) => {
          const isSelected = String(order.id) === String(selectedOrderId);
          const isQuick = order?.status_metadata?.quick_order === true;
          const stCfg = getStatusConfig(order);
          const position = idx + 1;
          return (
            <button
              key={order.id}
              onClick={() => onSelectOrder?.(order)}
              className={cn(
                "w-full text-left rounded-xl px-2.5 py-2 transition-all active:scale-[0.98] border relative",
                isSelected
                  ? "bg-cyan-500/15 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]"
              )}
            >
              {/* Position indicator */}
              <div className="absolute -left-1 top-2 flex items-center justify-center">
                <span className="text-[8px] font-black text-white/20">{position}</span>
              </div>

              <div className="flex items-start gap-2 pl-2">
                <div className="flex-1 min-w-0">
                  {/* Header: order # + status dot + time */}
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: stCfg.color || "#6B7280" }}
                      title={stCfg.label}
                    />
                    <span className="text-[10px] font-black text-white/80 shrink-0">#{order.order_number}</span>
                    {isQuick && (
                      <Zap className="w-2.5 h-2.5 text-amber-400 shrink-0" title="Reparación rápida" />
                    )}
                    <span className="text-[9px] text-white/25 ml-auto flex items-center gap-0.5 shrink-0">
                      <Clock className="w-2.5 h-2.5" />
                      {timeSince(order.created_date)}
                    </span>
                  </div>

                  {/* Customer */}
                  <p className="text-xs font-semibold text-white truncate">{order.customer_name || "Sin nombre"}</p>

                  {/* Device */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <DeviceIcon type={order.device_type} brand={order.device_brand} model={order.device_model} />
                    <p className="text-[10px] text-white/40 truncate">
                      {[order.device_brand, order.device_model].filter(Boolean).join(" ") || "—"}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="mt-1">
                    <span
                      className="inline-block text-[9px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
                      style={{
                        backgroundColor: `${stCfg.color || "#6B7280"}20`,
                        color: stCfg.color || "#9CA3AF",
                        border: `1px solid ${stCfg.color || "#6B7280"}40`,
                      }}
                    >
                      {stCfg.label}
                    </span>
                  </div>
                </div>
                <ChevronRight className={cn("w-3 h-3 shrink-0 mt-1 transition-transform", isSelected ? "text-cyan-400" : "text-white/20")} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
