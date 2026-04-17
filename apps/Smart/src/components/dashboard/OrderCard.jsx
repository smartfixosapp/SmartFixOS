import React from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Rediseño responsive con Apple HIG:
 * - Área táctil grande (p-4 en móviles, md:p-3 en tablet/desktop)
 * - Tipografía clara y jerarquía visual
 * - Badges de estado consistentes y accesibles
 * - Layout fluido: se apila en iPhone y se organiza en filas en iPad/desktop
 * - Truncado inteligente para que no rompa el layout en pantallas pequeñas
 */

const statusColors = {
  intake: "bg-apple-blue/15 text-apple-blue",
  diagnosing: "bg-apple-purple/15 text-apple-purple",
  awaiting_approval: "bg-apple-yellow/15 text-apple-yellow",
  waiting_parts: "bg-apple-orange/15 text-apple-orange",
  in_progress: "bg-apple-blue/15 text-apple-blue",
  ready_for_pickup: "bg-apple-green/15 text-apple-green",
  picked_up: "bg-apple-green/15 text-apple-green",
  completed: "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary",
  cancelled: "bg-apple-red/15 text-apple-red",
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
  const statusClass = statusColors[statusKey] || "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary";
  const statusText = statusLabels[statusKey] || statusKey?.replace(/_/g, " ") || "—";
  const isQuickOrder = order?.status_metadata?.quick_order === true;
  const isB2B = order?.company_id || order?.company_name;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(order?.id)}
      className="apple-type apple-press group relative w-full text-left overflow-hidden rounded-apple-lg apple-card p-4"
      aria-label={`Orden ${order?.order_number || "sin número"} de ${order?.customer_name || "cliente"}`}
    >
      <div className="relative z-10 flex flex-col gap-3">
        {/* Header: Nº de orden + Estado */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="apple-text-headline apple-label-primary leading-tight truncate">
                {order?.customer_name || "Cliente"}
                {isB2B && <span className="ml-1 text-[12px]">🏢</span>}
              </p>
            </div>
            <p className="mt-0.5 apple-text-caption2 apple-label-tertiary tabular-nums">
              {order?.order_number || "WO-LOCAL"}
            </p>
          </div>

          <Badge
            className={`shrink-0 ${statusClass} apple-text-caption2 font-semibold px-2 py-0.5 rounded-full border-0`}
          >
            {statusText}
          </Badge>
        </div>

        {/* Body: Dispositivo */}
        <div className="apple-surface rounded-apple-sm p-2.5 flex items-center justify-between gap-3">
          <span className="apple-text-footnote font-medium apple-label-secondary truncate">
            {`${safe(order?.device_brand)} ${safe(order?.device_model)}`.trim() || "Modelo no especificado"}
          </span>
          <span className="apple-text-caption2 apple-label-tertiary whitespace-nowrap tabular-nums">{created}</span>
        </div>
      </div>
    </button>
  );
};

export default SimplifiedOrderCard;
