import {
  Inbox, Stethoscope, UserRound, ShoppingCart, Package, PackageCheck, Building2,
  Hourglass, Wrench, CheckCircle2, CalendarClock, ShieldCheck, BadgeCheck, XCircle,
  Ban, Archive,
} from "lucide-react";

export const ORDER_STATUS = {
  intake: { label: "Recepción", color: "#3B82F6", Icon: Inbox, group: "main" },
  diagnosing: { label: "Diagnóstico", color: "#8B5CF6", Icon: Stethoscope, group: "main" },
  waiting_customer: { label: "Esperando Cliente", color: "#F43F5E", Icon: UserRound, group: "special" },
  pending_order: { label: "Pendiente a Ordenar", color: "#B71C1C", Icon: ShoppingCart, group: "special" },
  waiting_parts: { label: "Esperando Piezas", color: "#F97316", Icon: Package, group: "main" },
  part_arrived_waiting_device: { label: "Pieza lista / Esperando cliente", color: "#FACC15", Icon: PackageCheck, group: "special" },
  reparacion_externa: { label: "Reparación Externa", color: "#EC4899", Icon: Building2, group: "special" },
  por_reparar: { label: "Por reparar", color: "#6366F2", Icon: Hourglass, group: "main" },
  in_progress: { label: "En Reparación", color: "#06B6D4", Icon: Wrench, group: "main" },
  ready_for_pickup: { label: "Listo para Recoger", color: "#10B981", Icon: CheckCircle2, group: "main" },
  scheduled: { label: "Agendado", color: "#6B7280", Icon: CalendarClock, group: null },
  warranty: { label: "Garantía", color: "#F59E0B", Icon: ShieldCheck, group: "close" },
  delivered: { label: "Entregado", color: "#059669", Icon: BadgeCheck, group: "main" },
  cancelled: { label: "Cancelado", color: "#DC2626", Icon: XCircle, group: "close" },
  not_repairable: { label: "No reparable", color: "#44403C", Icon: Ban, group: "close" },
  abandoned: { label: "Abandonado", color: "#800021", Icon: Archive, group: "close" },
};

export const PICKER_GROUPS = [
  { key: "main", title: "FLUJO PRINCIPAL", statuses: ["intake", "diagnosing", "waiting_parts", "por_reparar", "in_progress", "ready_for_pickup", "delivered"] },
  { key: "special", title: "CASOS ESPECIALES", statuses: ["waiting_customer", "pending_order", "part_arrived_waiting_device", "reparacion_externa"] },
  { key: "close", title: "CERRAR ORDEN", statuses: ["warranty", "cancelled", "not_repairable", "abandoned"] },
];

export const TERMINAL_STATUSES = ["delivered", "cancelled", "warranty", "not_repairable", "abandoned"];
export const COMMON_STATUSES = ["intake", "diagnosing", "in_progress", "ready_for_pickup", "delivered"];
export const NON_MAILABLE_STATUSES = ["pending_order", "reparacion_externa"];

const NEXT_STATUS = {
  intake: "diagnosing",
  diagnosing: "in_progress",
  waiting_customer: "in_progress",
  pending_order: "waiting_parts",
  waiting_parts: "in_progress",
  part_arrived_waiting_device: "in_progress",
  reparacion_externa: "in_progress",
  in_progress: "ready_for_pickup",
  ready_for_pickup: "delivered",
  scheduled: "delivered",
};

export const NOTE_PRESETS = {
  diagnosing: ["Comenzamos el diagnóstico", "Diagnóstico casi listo"],
  waiting_parts: ["Esperando que llegue la pieza", "Pieza pedida al suplidor"],
  pending_order: ["Pendiente de ordenar la pieza"],
  part_arrived_waiting_device: ["Pieza llegó, esperando que traigan el equipo"],
  por_reparar: ["En cola para reparar"],
  in_progress: ["Empezamos la reparación", "Reparación en progreso, sin novedades"],
  ready_for_pickup: ["Equipo listo, cliente avisado"],
  waiting_customer: ["Esperando respuesta del cliente"],
  reparacion_externa: ["Enviado a servicio externo"],
};

export function statusInfo(raw) {
  return ORDER_STATUS[raw] || { label: raw || "—", color: "#8E8E93", Icon: Inbox, group: null };
}

export function nextStatusFor(raw) {
  return NEXT_STATUS[raw] || null;
}

export function isTerminal(raw) {
  return TERMINAL_STATUSES.includes(raw);
}

export function isOrderClosed(order) {
  if (!order) return false;
  if (order.status === "not_repairable" || order.status === "cancelled") return !!order.not_repairable_resolved_at;
  return isTerminal(order.status);
}

export function withAlpha(hex, alpha) {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255).toString(16).padStart(2, "0");
  return `${hex}${a}`;
}

export const STAGE_GUIDE = {
  intake: { title: "En Recepción", subtitle: "Toma fotos del equipo y registra el problema reportado por el cliente.", pills: [{ key: "to_waiting_parts", label: "Piezas en pedido", color: "#F97316" }] },
  diagnosing: { title: "En Diagnóstico", subtitle: "Examina el equipo y prepara la cotización para enviar al cliente.", pills: [{ key: "to_waiting_parts", label: "Piezas en pedido", color: "#F97316" }, { key: "to_not_repairable", label: "No reparable", color: "#44403C" }] },
  por_reparar: { title: "Por reparar", subtitle: "La pieza llegó y el equipo está aquí, en cola esperando reparación.", pills: [{ key: "to_in_progress", label: "Iniciar reparación", color: "#30D158" }] },
  in_progress: { title: "En reparación", subtitle: "Trabajando en el equipo. Marca como listo cuando termines.", pills: [{ key: "to_not_repairable", label: "No reparable", color: "#44403C" }] },
  pending_order: { title: "Pendiente a ordenar", subtitle: "Hay que ordenar la pieza al proveedor. Cuando la ordenes, marca como Piezas en pedido.", pills: [] },
  waiting_parts: { title: "Esperando piezas", subtitle: "La pieza viene en camino. Cliente no recibe notificación hasta que llegue.", pills: [{ key: "to_part_arrived", label: "Pieza llegó", color: "#14B8A6" }] },
  part_arrived_waiting_device: { title: "Pieza recibida", subtitle: "Avisa al cliente que traiga el equipo para iniciar la reparación.", pills: [] },
  reparacion_externa: { title: "Reparación externa", subtitle: "El equipo está en taller externo. Se notifica al cliente solo al volver.", pills: [] },
  waiting_customer: { title: "Esperando al cliente", subtitle: "Necesitamos respuesta del cliente para continuar.", pills: [] },
  warranty: { title: "En garantía", subtitle: "Servicio cubierto por la garantía original. No se cobra al cliente.", pills: [] },
  delivered: { title: "Orden entregada", subtitle: "Cliente recogió el equipo. Conserva el recibo durante el período de garantía.", pills: [] },
  cancelled: { title: "Orden cancelada", subtitle: "El cliente canceló la orden. No hay acciones adicionales.", pills: [] },
  scheduled: { title: "Visita programada", subtitle: "El cliente tiene una cita agendada. Confirma la visita antes de la fecha.", pills: [] },
};
