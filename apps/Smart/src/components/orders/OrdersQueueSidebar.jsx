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
  return <Icon className="w-3.5 h-3.5 apple-label-tertiary shrink-0" />;
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
      <div className="apple-type h-full flex flex-col items-center justify-center text-center p-6">
        <Box className="w-10 h-10 apple-label-tertiary mb-3" />
        <p className="apple-text-subheadline apple-label-secondary font-semibold">Sin órdenes activas</p>
        <p className="apple-text-caption1 apple-label-tertiary mt-1">Las nuevas aparecerán aquí</p>
      </div>
    );
  }

  return (
    <div className="apple-type h-full flex flex-col apple-surface">
      <div className="px-4 py-3 apple-surface-elevated sticky top-0 z-10" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="apple-text-footnote font-semibold apple-label-secondary">Cola de trabajo</p>
            <p className="apple-text-caption2 apple-label-tertiary mt-0.5">Ordenadas por #</p>
          </div>
          <span className="apple-text-caption1 font-semibold text-apple-blue bg-apple-blue/15 rounded-apple-sm px-2 py-0.5 tabular-nums">
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
                "apple-press w-full text-left rounded-apple-md px-2.5 py-2 transition-all relative",
                isSelected
                  ? "bg-apple-blue/15"
                  : "apple-surface-elevated hover:bg-gray-sys6 dark:hover:bg-gray-sys5"
              )}
            >
              {/* Position indicator */}
              <div className="absolute -left-1 top-2 flex items-center justify-center">
                <span className="apple-text-caption2 font-semibold apple-label-tertiary tabular-nums">{position}</span>
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
                    <span className="apple-text-caption1 font-semibold apple-label-primary shrink-0 tabular-nums">#{order.order_number}</span>
                    {isQuick && (
                      <Zap className="w-2.5 h-2.5 text-apple-orange shrink-0" title="Reparación rápida" />
                    )}
                    <span className="apple-text-caption2 apple-label-tertiary ml-auto flex items-center gap-0.5 shrink-0 tabular-nums">
                      <Clock className="w-2.5 h-2.5" />
                      {timeSince(order.created_date)}
                    </span>
                  </div>

                  {/* Customer */}
                  <p className="apple-text-caption1 font-semibold apple-label-primary truncate">{order.customer_name || "Sin nombre"}</p>

                  {/* Device */}
                  <div className="flex items-center gap-1 mt-0.5">
                    <DeviceIcon type={order.device_type} brand={order.device_brand} model={order.device_model} />
                    <p className="apple-text-caption2 apple-label-secondary truncate">
                      {[order.device_brand, order.device_model].filter(Boolean).join(" ") || "—"}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="mt-1">
                    <span
                      className="inline-block apple-text-caption2 font-semibold rounded-apple-sm px-1.5 py-0.5"
                      style={{
                        backgroundColor: `${stCfg.color || "#6B7280"}26`,
                        color: stCfg.color || "#9CA3AF",
                      }}
                    >
                      {stCfg.label}
                    </span>
                  </div>
                </div>
                <ChevronRight className={cn("w-3 h-3 shrink-0 mt-1 transition-transform", isSelected ? "text-apple-blue" : "apple-label-tertiary")} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
