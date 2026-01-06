import React, { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { Clock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

/* ========= Estados: etiqueta + color ========= */
const STATUS_META = {
  intake:               { label: "Recepción",             cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  diagnosing:           { label: "Diagnóstico",           cls: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  awaiting_approval:    { label: "Esperando aprobación",  cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  waiting_parts:        { label: "Esperando pieza",       cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  reparacion_externa:   { label: "Reparación externa",    cls: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  in_progress:          { label: "En reparación",         cls: "bg-sky-500/20 text-sky-400 border-sky-500/30" },
  ready_for_pickup:     { label: "Listo para recoger",    cls: "bg-green-600/20 text-green-400 border-green-600/30" },
  picked_up:            { label: "Entregado",             cls: "bg-emerald-600/20 text-emerald-400 border-emerald-600/30" },
  completed:            { label: "Completado",            cls: "bg-gray-500/20 text-gray-300 border-gray-500/30" },
  cancelled:            { label: "Cancelado",             cls: "bg-red-600/20 text-red-400 border-red-600/30" },
};

/* ========= Prioridad ========= */
const PRIORITY_META = {
  normal: "bg-gray-700/50 text-gray-300 border-gray-600/40",
  high:   "bg-orange-500/20 text-orange-400 border-orange-500/30",
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
};

/* ========= Fila (memoizada) ========= */
const OrderRow = memo(function OrderRow({ order, onClick }) {
  const {
    id,
    order_number,
    status,
    priority = "normal",
    progress_percentage = 0,
    created_date,
    customer_name,
    customer_phone,
    device_brand,
    device_model,
    repair_tasks = [],
  } = order || {};

  const st = STATUS_META[status] || { label: (status || "").replace(/_/g, " "), cls: "bg-gray-700/40 text-gray-300 border-gray-600/30" };
  const priorityCls = PRIORITY_META[(priority || "normal").toLowerCase()] || PRIORITY_META.normal;

  const daysOld = useMemo(
    () => (created_date ? differenceInDays(new Date(), new Date(created_date)) : 0),
    [created_date]
  );

  const isClosed = status === "picked_up" || status === "completed" || status === "cancelled";
  const isOverdue = !isClosed && daysOld > 14;

  const tasksDone = repair_tasks.filter(t => (t?.status || "").toLowerCase() === "completed").length;
  const tasksTotal = repair_tasks.length;

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.(order);
    }
  };

  const formattedDate = created_date
    ? format(new Date(created_date), "dd MMM yyyy", { locale: es })
    : "—";

  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -14 }}
    >
      <Card
        role="button"
        tabIndex={0}
        aria-label={`Abrir orden ${order_number}`}
        onClick={() => onClick?.(order)}
        onKeyDown={handleKeyDown}
        className={`p-4 sm:p-6 cursor-pointer transition-all duration-200 bg-gradient-to-br from-gray-900 to-black border-gray-800 hover:border-red-500/50 hover:shadow-xl hover:shadow-red-600/20 focus:outline-none focus:ring-2 focus:ring-red-600/40 ${
          isOverdue ? "border-l-4 border-l-red-500" : ""
        }`}
      >
        <div className="space-y-3 sm:space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            {/* Izquierda */}
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold text-white truncate">{order_number || "SIN NÚM."}</h3>

                {/* Estado */}
                <Badge className={`${st.cls} text-xs`} variant="outline">
                  {st.label}
                </Badge>

                {/* Prioridad */}
                {priority && priority.toLowerCase() !== "normal" && (
                  <Badge className={`${priorityCls} text-xs border`} variant="outline">
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </Badge>
                )}

                {/* Atrasado */}
                {isOverdue && (
                  <Badge className="bg-red-500/20 text-red-400 flex items-center gap-1 border-red-500/30 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    Atrasado
                  </Badge>
                )}
              </div>

              {/* Cliente / Dispositivo */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-1 sm:gap-x-3 text-xs sm:text-sm text-gray-400">
                <span className="font-medium text-gray-300 truncate">{customer_name || "—"}</span>
                <span className="hidden sm:inline">•</span>
                <span className="break-all">{customer_phone || "—"}</span>
                <span className="hidden sm:inline">•</span>
                <span className="truncate">{[device_brand, device_model].filter(Boolean).join(" ") || "—"}</span>
              </div>
            </div>

            {/* Derecha */}
            <div className="text-left sm:text-right flex-shrink-0">
              <p className="text-xs text-gray-500">Creada</p>
              <p className="font-medium text-gray-300 text-sm">{formattedDate}</p>
            </div>
          </div>

          {/* Progreso */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium text-gray-400">Progreso</span>
              <span className="text-xs sm:text-sm font-bold text-white" aria-live="polite">
                {Math.max(0, Math.min(100, Number(progress_percentage) || 0))}%
              </span>
            </div>
            <div
              className="w-full bg-gray-800 rounded-full h-2 sm:h-3 overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.max(0, Math.min(100, Number(progress_percentage) || 0))}
            >
              <div
                className="h-full bg-gradient-to-r from-red-600 to-red-800 transition-all duration-300 rounded-full"
                style={{ width: `${Math.max(0, Math.min(100, Number(progress_percentage) || 0))}%` }}
              />
            </div>
          </div>

          {/* Tareas */}
          {tasksTotal > 0 && (
            <div className="pt-3 border-t border-gray-800">
              <p className="text-xs sm:text-sm text-gray-400 mb-2">
                {tasksDone} / {tasksTotal} tareas completadas
              </p>
              <div className="flex flex-wrap gap-2">
                {repair_tasks.slice(0, 2).map((task, idx) => (
                  <Badge key={idx} className="bg-gray-800 text-gray-300 text-xs border-gray-700/60">
                    {task?.description || "Tarea"}
                  </Badge>
                ))}
                {tasksTotal > 2 && (
                  <Badge className="bg-gray-800 text-gray-300 text-xs border-gray-700/60">
                    +{tasksTotal - 2} más
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
});

/* ========= Lista principal ========= */
function OrderList({ orders = [], loading = false, onOrderClick }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 sm:p-6 bg-gray-900 border-gray-800">
            <div className="space-y-3">
              <div className="flex justify-between gap-4">
                <Skeleton className="h-6 w-24 sm:w-32 bg-gray-800" />
                <Skeleton className="h-6 w-16 sm:w-20 bg-gray-800" />
              </div>
              <Skeleton className="h-4 w-full bg-gray-800" />
              <Skeleton className="h-2 w-full bg-gray-800" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!orders.length) {
    return (
      <Card className="p-8 sm:p-12 text-center bg-gray-900 border-gray-800">
        <Clock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-600 mb-4" />
        <p className="text-gray-400 text-base sm:text-lg">No se encontraron órdenes</p>
        <p className="text-gray-500 text-xs sm:text-sm mt-2">Intenta ajustar los filtros de búsqueda</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:gap-4">
      {orders.map((order) => (
        <OrderRow key={order.id} order={order} onClick={onOrderClick} />
      ))}
    </div>
  );
}

export default memo(OrderList);
