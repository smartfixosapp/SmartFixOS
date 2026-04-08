import React from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Rediseño responsive:
 * - Área táctil grande (p-4 en móviles, md:p-3 en tablet/desktop)
 * - Tipografía clara y jerarquía visual
 * - Badges de estado consistentes y accesibles
 * - Layout fluido: se apila en iPhone y se organiza en filas en iPad/desktop
 * - Truncado inteligente para que no rompa el layout en pantallas pequeñas
 */

const statusColors = {
  intake: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  diagnosing: "bg-violet-500/15 text-violet-300 border-violet-500/25",
  awaiting_approval: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  waiting_parts: "bg-orange-500/15 text-orange-300 border-orange-500/25",
  in_progress: "bg-cyan-500/15 text-cyan-300 border-cyan-500/25",
  ready_for_pickup: "bg-emerald-600/15 text-emerald-300 border-emerald-600/25",
  picked_up: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  completed: "bg-zinc-500/15 text-zinc-300 border-zinc-500/25",
  cancelled: "bg-rose-600/15 text-rose-300 border-rose-600/25",
};

const statusLabels = {
  intake: "Recibido",
  diagnosing: "Diagnosticando",
  awaiting_approval: "Esperando aprobación",
  waiting_parts: "Esperando piezas",
  in_progress: "En progreso",
  ready_for_pickup: "Listo para recoger",
  picked_up: "Entregado",
  completed: "Completado",
  cancelled: "Cancelado",
};

const safe = (v) => (v == null ? "" : String(v));

const SimplifiedOrderCard = ({ order, onSelect }) => {
  const created =
    order?.created_date
      ? format(new Date(order.created_date), "dd MMM", { locale: es })
      : "—";

  const statusKey = safe(order?.status);
  const statusClass = statusColors[statusKey] || "bg-zinc-600/15 text-zinc-300 border-zinc-500/25";
  const statusText = statusLabels[statusKey] || statusKey?.replace(/_/g, " ") || "—";
  const isQuickOrder = order?.status_metadata?.quick_order === true;
  const isB2B = order?.company_id || order?.company_name;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(order?.id)}
      className="
        group relative w-full text-left overflow-hidden
        rounded-[24px] border
        bg-[#121215]/40 backdrop-blur-2xl
        border-white/[0.06] hover:border-white/20
        transition-all duration-300
        active:scale-[0.98]
        p-4
      "
      aria-label={`Orden ${order?.order_number || "sin número"} de ${order?.customer_name || "cliente"}`}
    >
      <div className="relative z-10 flex flex-col gap-3">
        {/* Header: Nº de orden + Estado */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-black text-white text-[15px] leading-tight truncate tracking-tight">
                {order?.customer_name || "Cliente"}
                {isB2B && <span className="ml-1 text-[12px]">🏢</span>}
              </p>
            </div>
            <p className="mt-0.5 text-[10px] font-black text-white/30 uppercase tracking-[0.12em]">
              {order?.order_number || "WO-LOCAL"}
            </p>
          </div>

          <Badge
            className={`shrink-0 border ${statusClass} text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-md`}
          >
            {statusText}
          </Badge>
        </div>

        {/* Body: Dispositivo */}
        <div className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-2.5 flex items-center justify-between gap-3">
          <span className="text-[12px] font-semibold text-white/70 truncate">
            {`${safe(order?.device_brand)} ${safe(order?.device_model)}`.trim() || "Modelo no especificado"}
          </span>
          <span className="text-[10px] font-black text-white/50 uppercase whitespace-nowrap">{created}</span>
        </div>
      </div>
    </button>
  );
};

export default SimplifiedOrderCard;
