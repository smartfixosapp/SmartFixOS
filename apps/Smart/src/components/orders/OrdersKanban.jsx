import React, { useMemo, useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";
import { ORDER_STATUSES, getEffectiveOrderStatus } from "@/components/utils/statusRegistry";
import { Smartphone, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Columnas del Kanban (orden visual del flujo del taller)
const KANBAN_STATUSES = [
  "intake",
  "diagnosing",
  "waiting_parts",
  "in_progress",
  "ready_for_pickup",
  "delivered",
];

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function urgencyColor(days) {
  if (days >= 3) return "border-red-500/50 bg-red-500/[0.06]";
  if (days >= 1) return "border-yellow-500/40 bg-yellow-500/[0.05]";
  return "border-emerald-500/40 bg-emerald-500/[0.05]";
}

function KanbanCard({ order, index, onClick }) {
  const days = daysSince(order.updated_date || order.created_date);
  const urgency = urgencyColor(days);
  return (
    <Draggable draggableId={String(order.id)} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(order)}
          className={cn(
            "rounded-xl border p-3 mb-2 cursor-pointer transition-all",
            "hover:bg-white/[0.06] active:scale-[0.98]",
            urgency,
            snapshot.isDragging && "ring-2 ring-violet-400/50 shadow-2xl scale-[1.02]"
          )}
        >
          {/* Header: # orden + días */}
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold text-white/40">
              {order.order_number || `#${String(order.id).slice(0, 6)}`}
            </span>
            <div className="flex items-center gap-1 text-[10px] text-white/40">
              <Clock className="w-3 h-3" />
              {days === 0 ? "hoy" : `${days}d`}
            </div>
          </div>

          {/* Cliente */}
          <div className="flex items-center gap-1.5 mb-1">
            <User className="w-3 h-3 text-white/40 shrink-0" />
            <p className="text-xs text-white/80 font-bold truncate">
              {order.customer_name || "Cliente"}
            </p>
          </div>

          {/* Equipo */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <Smartphone className="w-3 h-3 text-white/40 shrink-0" />
            <p className="text-[11px] text-white/55 truncate">
              {[order.device_brand, order.device_model].filter(Boolean).join(" ") || "Equipo"}
            </p>
          </div>

          {/* Técnico */}
          {order.assigned_to_name && (
            <div className="text-[10px] text-violet-300/70 font-bold truncate">
              👤 {order.assigned_to_name}
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}

function KanbanColumn({ status, orders, onCardClick }) {
  const statusConfig = ORDER_STATUSES.find((s) => s.id === status) || {
    label: status,
    color: "#64748b",
  };

  return (
    <div className="flex flex-col w-[280px] shrink-0 h-full">
      {/* Header de columna */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t-2xl border border-b-0"
        style={{
          background: `${statusConfig.color}15`,
          borderColor: `${statusConfig.color}40`,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: statusConfig.color }}
          />
          <h3 className="text-xs font-semibold text-white/85">
            {statusConfig.label}
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-white/60 bg-white/10 rounded-full px-2 py-0.5">
          {orders.length}
        </span>
      </div>

      {/* Drop zone */}
      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 min-h-[200px] p-2 rounded-b-2xl border border-t-0 overflow-y-auto",
              "transition-colors",
              snapshot.isDraggingOver
                ? "bg-violet-500/10 border-violet-400/40"
                : "bg-white/[0.02] border-white/10"
            )}
          >
            {orders.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center py-8 text-white/20 text-[10px] font-semibold">
                Vacío
              </div>
            )}
            {orders.map((order, idx) => (
              <KanbanCard
                key={order.id}
                order={order}
                index={idx}
                onClick={onCardClick}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

export default function OrdersKanban({ orders, onCardClick, onOrderUpdated }) {
  const [updating, setUpdating] = useState(false);

  // Agrupar órdenes por estado
  const grouped = useMemo(() => {
    const map = {};
    KANBAN_STATUSES.forEach((s) => (map[s] = []));
    (orders || []).forEach((o) => {
      const st = getEffectiveOrderStatus(o);
      if (map[st]) map[st].push(o);
    });
    // Ordenar cada columna: más viejas primero (top = más urgente)
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        const da = new Date(a.updated_date || a.created_date || 0).getTime();
        const db = new Date(b.updated_date || b.created_date || 0).getTime();
        return da - db;
      });
    });
    return map;
  }, [orders]);

  const onDragEnd = useCallback(
    async (result) => {
      const { destination, source, draggableId } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }
      const newStatus = destination.droppableId;
      const order = orders.find((o) => String(o.id) === String(draggableId));
      if (!order) return;

      setUpdating(true);
      // Optimistic update
      const optimistic = { ...order, status: newStatus, updated_date: new Date().toISOString() };
      onOrderUpdated?.(optimistic);

      try {
        const updated = await dataClient.entities.Order.update(order.id, {
          status: newStatus,
        });
        onOrderUpdated?.(updated || optimistic);
        toast.success(
          `Orden ${order.order_number || ""} → ${
            (ORDER_STATUSES.find((s) => s.id === newStatus) || {}).label || newStatus
          }`
        );
      } catch (err) {
        console.error("Kanban update error:", err);
        toast.error("No se pudo actualizar el estado");
        // Revertir
        onOrderUpdated?.(order);
      } finally {
        setUpdating(false);
      }
    },
    [orders, onOrderUpdated]
  );

  return (
    <div className="relative">
      {updating && (
        <div className="absolute top-2 right-2 z-10 text-[10px] text-violet-300 font-bold animate-pulse">
          Actualizando…
        </div>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4 min-h-[500px]">
          {KANBAN_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              orders={grouped[status] || []}
              onCardClick={onCardClick}
            />
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
