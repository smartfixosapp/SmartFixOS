import React, { useMemo } from "react";
import { ChevronRight, Clock, Smartphone, Laptop, Tablet, Watch, Gamepad2, Box, Zap } from "lucide-react";
import { getStatusConfig, normalizeStatusId, getEffectiveOrderStatus } from "@/components/utils/statusRegistry";
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

// Orden lógico de trabajo (lo que hay que atender primero)
const WORK_ORDER = [
  "intake",
  "diagnosing",
  "awaiting_approval",
  "pending_order",
  "waiting_parts",
  "part_arrived_waiting_device",
  "reparacion_externa",
  "in_progress",
  "warranty",
];

// Estados "listos" que NO son trabajo activo
const DONE_STATUSES = new Set(["ready_for_pickup", "picked_up", "delivered", "completed", "cancelled"]);

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
  // Filtrar solo órdenes activas (no listas/entregadas/canceladas) y ordenarlas
  const queue = useMemo(() => {
    const active = (orders || []).filter(o => {
      const st = getEffectiveOrderStatus(o);
      return !DONE_STATUSES.has(st);
    });

    // Ordenar por: 1) status en WORK_ORDER, 2) fecha más antigua primero
    return active.sort((a, b) => {
      const stA = getEffectiveOrderStatus(a);
      const stB = getEffectiveOrderStatus(b);
      const idxA = WORK_ORDER.indexOf(stA);
      const idxB = WORK_ORDER.indexOf(stB);
      if (idxA !== idxB) return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
      // Dentro del mismo status, órdenes más antiguas primero
      const dateA = new Date(a.created_date || 0).getTime();
      const dateB = new Date(b.created_date || 0).getTime();
      return dateA - dateB;
    });
  }, [orders]);

  // Agrupar por status para mostrar headers
  const grouped = useMemo(() => {
    const groups = {};
    queue.forEach(o => {
      const st = getEffectiveOrderStatus(o);
      if (!groups[st]) groups[st] = [];
      groups[st].push(o);
    });
    return groups;
  }, [queue]);

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
          <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Cola de trabajo</p>
          <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2 py-0.5">
            {queue.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {WORK_ORDER.filter(st => grouped[st]?.length > 0).map(st => {
          const cfg = getStatusConfig(st);
          const list = grouped[st];
          return (
            <div key={st}>
              <div className="flex items-center gap-2 px-2 mb-1.5">
                <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color || "#6B7280" }} />
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{cfg.label}</span>
                <span className="text-[9px] text-white/25 ml-auto">{list.length}</span>
              </div>
              <div className="space-y-1">
                {list.map(order => {
                  const isSelected = String(order.id) === String(selectedOrderId);
                  const isQuick = order?.status_metadata?.quick_order === true;
                  return (
                    <button
                      key={order.id}
                      onClick={() => onSelectOrder?.(order)}
                      className={cn(
                        "w-full text-left rounded-xl px-2.5 py-2 transition-all active:scale-[0.98] border",
                        isSelected
                          ? "bg-cyan-500/15 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                          : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-black text-white/80 shrink-0">#{order.order_number}</span>
                            {isQuick && (
                              <Zap className="w-2.5 h-2.5 text-amber-400 shrink-0" title="Reparación rápida" />
                            )}
                            <span className="text-[9px] text-white/30 ml-auto flex items-center gap-0.5 shrink-0">
                              <Clock className="w-2.5 h-2.5" />
                              {timeSince(order.created_date)}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-white truncate">{order.customer_name || "Sin nombre"}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <DeviceIcon type={order.device_type} brand={order.device_brand} model={order.device_model} />
                            <p className="text-[10px] text-white/40 truncate">
                              {[order.device_brand, order.device_model].filter(Boolean).join(" ") || "—"}
                            </p>
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
        })}
      </div>
    </div>
  );
}
