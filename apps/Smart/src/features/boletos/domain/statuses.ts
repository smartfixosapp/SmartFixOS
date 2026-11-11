export type StatusKey =
  | "intake"
  | "diagnosing"
  | "waiting_parts"
  | "por_reparar"
  | "in_progress"
  | "ready_for_pickup"
  | "waiting_customer"
  | "pending_order"
  | "part_arrived_waiting_device"
  | "reparacion_externa"
  | "scheduled"
  | "warranty"
  | "delivered"
  | "cancelled"
  | "not_repairable"
  | "abandoned";

export type StatusGroup = "main" | "special" | "closed";

export interface StatusDef {
  key: StatusKey;
  group: StatusGroup;
  label: string;
  long: string;
  terminal: boolean;
  email: boolean;
  to: readonly StatusKey[];
  reopen: boolean;
}

export const STATUSES: readonly StatusDef[] = [
  {
    "key": "intake",
    "group": "main",
    "label": "Recibido",
    "long": "Recepción",
    "terminal": false,
    "email": true,
    "to": [
      "diagnosing",
      "waiting_parts",
      "por_reparar",
      "in_progress",
      "ready_for_pickup",
      "waiting_customer",
      "pending_order",
      "part_arrived_waiting_device",
      "reparacion_externa",
      "scheduled",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "diagnosing",
    "group": "main",
    "label": "Diagnóstico",
    "long": "Diagnóstico",
    "terminal": false,
    "email": true,
    "to": [
      "intake",
      "waiting_parts",
      "por_reparar",
      "in_progress",
      "ready_for_pickup",
      "waiting_customer",
      "pending_order",
      "part_arrived_waiting_device",
      "reparacion_externa",
      "scheduled",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "waiting_parts",
    "group": "main",
    "label": "Esperando pieza",
    "long": "Esperando piezas",
    "terminal": false,
    "email": true,
    "to": [
      "intake",
      "diagnosing",
      "por_reparar",
      "in_progress",
      "ready_for_pickup",
      "waiting_customer",
      "pending_order",
      "part_arrived_waiting_device",
      "reparacion_externa",
      "scheduled",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "por_reparar",
    "group": "main",
    "label": "Por reparar",
    "long": "Por reparar",
    "terminal": false,
    "email": true,
    "to": [
      "intake",
      "diagnosing",
      "waiting_parts",
      "in_progress",
      "ready_for_pickup",
      "waiting_customer",
      "pending_order",
      "part_arrived_waiting_device",
      "reparacion_externa",
      "scheduled",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "in_progress",
    "group": "main",
    "label": "En reparación",
    "long": "En reparación",
    "terminal": false,
    "email": true,
    "to": [
      "intake",
      "diagnosing",
      "waiting_parts",
      "por_reparar",
      "ready_for_pickup",
      "waiting_customer",
      "pending_order",
      "part_arrived_waiting_device",
      "reparacion_externa",
      "scheduled",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "ready_for_pickup",
    "group": "main",
    "label": "Listo",
    "long": "Listo para recoger",
    "terminal": false,
    "email": true,
    "to": [
      "intake",
      "diagnosing",
      "waiting_parts",
      "por_reparar",
      "in_progress",
      "waiting_customer",
      "pending_order",
      "part_arrived_waiting_device",
      "reparacion_externa",
      "scheduled",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "waiting_customer",
    "group": "special",
    "label": "Esperando cliente",
    "long": "Esperando al cliente",
    "terminal": false,
    "email": true,
    "to": [
      "intake",
      "diagnosing",
      "waiting_parts",
      "por_reparar",
      "in_progress",
      "ready_for_pickup",
      "pending_order",
      "part_arrived_waiting_device",
      "reparacion_externa",
      "scheduled",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "pending_order",
    "group": "special",
    "label": "Pendiente a ordenar",
    "long": "Pendiente a ordenar la pieza",
    "terminal": false,
    "email": false,
    "to": [
      "intake",
      "diagnosing",
      "waiting_parts",
      "por_reparar",
      "in_progress",
      "ready_for_pickup",
      "waiting_customer",
      "part_arrived_waiting_device",
      "reparacion_externa",
      "scheduled",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "part_arrived_waiting_device",
    "group": "special",
    "label": "Pieza lista, falta equipo",
    "long": "Pieza lista, esperando el equipo",
    "terminal": false,
    "email": true,
    "to": [
      "intake",
      "diagnosing",
      "waiting_parts",
      "por_reparar",
      "in_progress",
      "ready_for_pickup",
      "waiting_customer",
      "pending_order",
      "reparacion_externa",
      "scheduled",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "reparacion_externa",
    "group": "special",
    "label": "Reparación externa",
    "long": "Enviado a reparación externa",
    "terminal": false,
    "email": false,
    "to": [
      "intake",
      "diagnosing",
      "waiting_parts",
      "por_reparar",
      "in_progress",
      "ready_for_pickup",
      "waiting_customer",
      "pending_order",
      "part_arrived_waiting_device",
      "scheduled",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "scheduled",
    "group": "special",
    "label": "Agendado",
    "long": "Visita agendada",
    "terminal": false,
    "email": true,
    "to": [
      "intake",
      "diagnosing",
      "waiting_parts",
      "por_reparar",
      "in_progress",
      "ready_for_pickup",
      "waiting_customer",
      "pending_order",
      "part_arrived_waiting_device",
      "reparacion_externa",
      "delivered",
      "cancelled",
      "not_repairable",
      "abandoned"
    ],
    "reopen": false
  },
  {
    "key": "warranty",
    "group": "special",
    "label": "Garantía",
    "long": "En garantía",
    "terminal": true,
    "email": true,
    "to": [
      "in_progress"
    ],
    "reopen": false
  },
  {
    "key": "delivered",
    "group": "closed",
    "label": "Entregado",
    "long": "Entregado al cliente",
    "terminal": true,
    "email": true,
    "to": [
      "warranty"
    ],
    "reopen": true
  },
  {
    "key": "cancelled",
    "group": "closed",
    "label": "Cancelado",
    "long": "Boleto cancelado",
    "terminal": true,
    "email": true,
    "to": [],
    "reopen": true
  },
  {
    "key": "not_repairable",
    "group": "closed",
    "label": "No reparable",
    "long": "Equipo no reparable",
    "terminal": true,
    "email": true,
    "to": [],
    "reopen": true
  },
  {
    "key": "abandoned",
    "group": "closed",
    "label": "Abandonado",
    "long": "Equipo abandonado",
    "terminal": true,
    "email": true,
    "to": [],
    "reopen": true
  }
];

export const REOPEN_TO: readonly StatusKey[] = ["intake","diagnosing","waiting_parts","por_reparar","in_progress","ready_for_pickup","waiting_customer","pending_order","part_arrived_waiting_device","reparacion_externa"];

export const STATUS_BY_KEY: Readonly<Record<string, StatusDef>> = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

export function isStatusKey(v: unknown): v is StatusKey {
  return typeof v === "string" && v in STATUS_BY_KEY;
}

export function statusLabel(v: unknown): string {
  return isStatusKey(v) ? STATUS_BY_KEY[v].label : String(v || "Sin estatus");
}

export function statusColorVar(v: unknown): string {
  return isStatusKey(v) ? `var(--repara-status-${v.replace(/_/g, "-")})` : "var(--repara-text3)";
}

export const CLOSED_KEYS: readonly StatusKey[] = STATUSES.filter((s) => s.group === "closed").map((s) => s.key);
