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
      ? format(new Date(order.created_date), "dd MMM, yyyy", { locale: es })
      : "—";

  const statusKey = safe(order?.status);
  const statusClass = statusColors[statusKey] || "bg-zinc-600/15 text-zinc-300 border-zinc-500/25";
  const statusText = statusLabels[statusKey] || statusKey?.replace(/_/g, " ") || "—";

  return (
    <button
      type="button"
      onClick={() => onSelect?.(order?.id)}
      className="
        group w-full text-left
        rounded-2xl md:rounded-xl
        border border-white/10 hover:border-red-600/40
        bg-gradient-to-b from-[#0F0F12] to-[#0C0C0F]
        hover:from-[#111115] hover:to-[#0E0E12]
        transition-colors
        focus:outline-none focus:ring-2 focus:ring-red-600/60
        active:scale-[0.995]
        p-4 md:p-3
      "
      aria-label={`Orden ${order?.order_number || "sin número"} de ${order?.customer_name || "cliente"}`}
    >
      {/* Header: Nº de orden + Estado */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white text-base md:text-sm leading-tight truncate">
              {order?.order_number || "SIN #ORDEN"}
            </p>
            {/* Fecha (móvil: se oculta, iPad/desktop: visible) */}
            <span className="hidden sm:inline text-[11px] md:text-xs text-gray-400">
              {created}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] md:text-xs text-gray-400 truncate">
            {order?.customer_name || "—"}
            {order?.customer_phone ? (
              <span className="text-gray-500"> • {order.customer_phone}</span>
            ) : null}
          </p>
        </div>

        <Badge
          className={`shrink-0 border ${statusClass} text-[11px] md:text-[10px] px-2 py-0.5 rounded-md`}
        >
          {statusText}
        </Badge>
      </div>

      {/* Body: Dispositivo */}
      <div className="mt-3 md:mt-2 text-[12px] md:text-xs text-gray-300 flex items-center justify-between gap-3">
        <span className="truncate">
          {`${safe(order?.device_brand)} ${safe(order?.device_model)}`.trim() || "—"}
        </span>
        {/* Fecha (en móvil se muestra aquí) */}
        <span className="sm:hidden whitespace-nowrap text-gray-400">{created}</span>
      </div>

      {/* Footer sutil: Email si existe (solo si cabe) */}
      {order?.customer_email ? (
        <div className="mt-2 text-[11px] md:text-[10px] text-gray-500 truncate">
          {order.customer_email}
        </div>
      ) : null}
    </button>
  );
};

export default SimplifiedOrderCard;
