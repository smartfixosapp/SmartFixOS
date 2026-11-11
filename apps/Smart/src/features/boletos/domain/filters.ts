import { equipmentOf, equipmentMeta } from "./equipment";
import { CLOSED_KEYS, STATUSES, statusLabel } from "./statuses";
import type { Chip, EquipmentId, FilterState, OrderRow, Vista } from "./types";

export const EMPTY_FILTERS: FilterState = { statuses: [], equipos: [], vista: null, query: "" };

export const VISTAS: readonly { id: Vista; label: string; shortLabel: string; icon: string }[] = [
  { id: "citas", label: "Citas", shortLabel: "Citas", icon: "cal" },
  { id: "piezas", label: "Espera de piezas", shortLabel: "Piezas", icon: "box" },
  { id: "garantias", label: "Garantías", shortLabel: "Garantías", icon: "shield" },
  { id: "cerradas", label: "Cerradas", shortLabel: "Cerradas", icon: "archive" },
];

const PARTS_WAIT = new Set(["waiting_parts", "pending_order", "part_arrived_waiting_device"]);
const CLOSED = new Set<string>(CLOSED_KEYS);

export function isClosed(order: Pick<OrderRow, "status" | "not_repairable_resolved_at">): boolean {
  const s = order.status ?? "";
  if (!CLOSED.has(s)) return false;
  if (s === "cancelled" || s === "not_repairable") return !!order.not_repairable_resolved_at;
  return true;
}

export function inVista(order: OrderRow, vista: Vista): boolean {
  switch (vista) {
    case "cerradas":
      return isClosed(order);
    case "citas":
      return !isClosed(order) && (order.status === "scheduled" || (!!order.appointment_at && !!order.service_type && order.service_type !== "workshop"));
    case "piezas":
      return !isClosed(order) && PARTS_WAIT.has(order.status ?? "");
    case "garantias":
      return order.status === "warranty" || (!isClosed(order) && !!order.warranty_claim);
  }
}

const fold = (v: unknown): string =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export function matchesQuery(order: OrderRow, query: string): boolean {
  const q = fold(query).trim();
  if (!q) return true;
  const digits = q.replace(/\D/g, "");
  const hay = fold([order.order_number, order.customer_name, order.customer_email, order.device_brand, order.device_family, order.device_model, order.device_serial, order.initial_problem].join(" "));
  if (hay.includes(q)) return true;
  if (digits.length >= 3 && String(order.customer_phone ?? "").replace(/\D/g, "").includes(digits)) return true;
  return false;
}

function passes(order: OrderRow, f: FilterState, skip: "statuses" | "equipos" | null): boolean {
  if (order.is_deleted) return false;
  if (f.vista) {
    if (!inVista(order, f.vista)) return false;
  } else if (isClosed(order)) {
    return false;
  }
  if (skip !== "statuses" && f.statuses.length && !f.statuses.includes(order.status ?? "")) return false;
  if (skip !== "equipos" && f.equipos.length && !f.equipos.includes(equipmentOf(order))) return false;
  return matchesQuery(order, f.query);
}

export function applyFilters(orders: readonly OrderRow[], f: FilterState): OrderRow[] {
  return orders.filter((o) => passes(o, f, null));
}

export function statusCounts(orders: readonly OrderRow[], f: FilterState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const o of orders) if (passes(o, f, "statuses")) out[o.status ?? ""] = (out[o.status ?? ""] ?? 0) + 1;
  return out;
}

export function equipmentCounts(orders: readonly OrderRow[], f: FilterState): Record<EquipmentId, number> {
  const out: Record<EquipmentId, number> = { phones: 0, tablets: 0, computers: 0, consoles: 0, unlocks: 0, other: 0 };
  for (const o of orders) if (passes(o, f, "equipos")) out[equipmentOf(o)] += 1;
  return out;
}

export function vistaCounts(orders: readonly OrderRow[], query = ""): Record<Vista, number> {
  const out: Record<Vista, number> = { citas: 0, piezas: 0, garantias: 0, cerradas: 0 };
  for (const o of orders) {
    if (o.is_deleted || !matchesQuery(o, query)) continue;
    for (const v of VISTAS) if (inVista(o, v.id)) out[v.id] += 1;
  }
  return out;
}

export function activeChips(f: FilterState): Chip[] {
  const chips: Chip[] = [];
  if (f.vista) chips.push({ kind: "vista", key: f.vista, label: VISTAS.find((v) => v.id === f.vista)?.label ?? f.vista });
  for (const s of f.statuses) chips.push({ kind: "status", key: s, label: statusLabel(s) });
  for (const e of f.equipos) chips.push({ kind: "equipo", key: e, label: equipmentMeta(e).label });
  return chips;
}

export function removeChip(f: FilterState, chip: Chip): FilterState {
  if (chip.kind === "vista") return { ...f, vista: null };
  if (chip.kind === "status") return { ...f, statuses: f.statuses.filter((s) => s !== chip.key) };
  return { ...f, equipos: f.equipos.filter((e) => e !== chip.key) };
}

export function clearAll(f: FilterState): FilterState {
  return { ...EMPTY_FILTERS, query: f.query };
}

export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}

export function toggleVista(f: FilterState, vista: Vista): FilterState {
  return { ...f, vista: f.vista === vista ? null : vista };
}

export function filterBubble(f: FilterState, panel: "statuses" | "equipos"): number {
  return f[panel].length;
}

export interface StatusGroupBlock {
  status: string;
  label: string;
  orders: OrderRow[];
}

export function groupByStatus(orders: readonly OrderRow[]): StatusGroupBlock[] {
  const known = STATUSES.map((s) => s.key as string);
  const extra = [...new Set(orders.map((o) => o.status ?? "").filter((s) => !known.includes(s)))];
  return [...known, ...extra]
    .map((status) => ({ status, label: statusLabel(status), orders: orders.filter((o) => (o.status ?? "") === status) }))
    .filter((g) => g.orders.length > 0);
}

export const FILTER_PANEL_STATUS_GROUPS: readonly { id: "main" | "special"; title: string }[] = [
  { id: "main", title: "Flujo principal" },
  { id: "special", title: "Especiales" },
];
