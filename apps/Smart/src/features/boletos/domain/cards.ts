import { equipmentMeta, equipmentOf } from "./equipment";
import { statusLabel } from "./statuses";
import type { HistoryEntry, OrderItemRow, OrderRow } from "./types";

export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function money(v: unknown): string {
  return `$${num(v).toFixed(2)}`;
}

export function initials(name: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function deviceTitle(o: OrderRow): string {
  const model = String(o.device_model ?? "").trim();
  const family = String(o.device_family ?? "").trim();
  const brand = String(o.device_brand ?? "").trim();
  const base = model || family || brand;
  if (!base) return String(o.device_type ?? "").trim() || "Equipo";
  if (brand && !base.toLowerCase().includes(brand.toLowerCase()) && !model) return `${brand} ${base}`;
  return base;
}

export function shortAge(iso: string | null | undefined, now: number = Date.now()): string {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return "";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} d`;
  return `${Math.round(days / 7)} sem`;
}

export function isLate(o: OrderRow, now: number = Date.now()): boolean {
  if (!o.promised_date) return false;
  if (o.status === "delivered" || o.status === "cancelled" || o.status === "not_repairable" || o.status === "abandoned" || o.status === "warranty") return false;
  const t = new Date(o.promised_date).getTime();
  return Number.isFinite(t) && t < now;
}

export function dueAmount(o: OrderRow): number {
  if (o.balance_due !== null && o.balance_due !== undefined && o.balance_due !== "") return Math.max(0, num(o.balance_due));
  return Math.max(0, num(o.cost_estimate) - num(o.amount_paid));
}

export interface CardView {
  id: string;
  number: string;
  icon: string;
  equipmentLabel: string;
  title: string;
  customer: string;
  problem: string;
  status: string;
  statusLabel: string;
  age: string;
  late: boolean;
  amount: string;
  tech: string;
  flags: ("alert" | "drop" | "shield" | "bolt")[];
}

export function toCard(o: OrderRow, now: number = Date.now()): CardView {
  const eq = equipmentMeta(equipmentOf(o));
  const flags: CardView["flags"] = [];
  if (isLate(o, now)) flags.push("alert");
  if (o.liquid_damage) flags.push("drop");
  if (o.warranty_claim || o.status === "warranty") flags.push("shield");
  if (o.priority === "high") flags.push("bolt");
  const due = dueAmount(o);
  return {
    id: o.id,
    number: String(o.order_number ?? "").trim() || "Sin numero",
    icon: eq.icon,
    equipmentLabel: eq.label,
    title: deviceTitle(o),
    customer: String(o.customer_name ?? "").trim() || "Sin cliente",
    problem: String(o.initial_problem ?? "").trim(),
    status: o.status ?? "",
    statusLabel: statusLabel(o.status),
    age: shortAge(o.updated_date ?? o.created_date, now),
    late: isLate(o, now),
    amount: due > 0.004 ? money(due) : "",
    tech: initials(o.assigned_to_name),
    flags,
  };
}

export function sortByUpdated(orders: readonly OrderRow[]): OrderRow[] {
  const t = (o: OrderRow) => new Date(o.updated_date ?? o.created_date ?? 0).getTime() || 0;
  return [...orders].sort((a, b) => t(b) - t(a));
}

export interface ListSummary {
  active: number;
  late: number;
  toCollect: number;
}

export function summarize(orders: readonly OrderRow[], now: number = Date.now()): ListSummary {
  let late = 0;
  let toCollect = 0;
  for (const o of orders) {
    if (isLate(o, now)) late += 1;
    toCollect += dueAmount(o);
  }
  return { active: orders.length, late, toCollect: Math.round(toCollect * 100) / 100 };
}

export interface MoneyView {
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
}

export function moneyView(o: OrderRow): MoneyView {
  const items = (o.order_items ?? []).filter((i) => i && i.type !== "discount");
  const discounts = (o.order_items ?? []).filter((i) => i && i.type === "discount").reduce((s, i) => s + Math.abs(num(i.total)), 0);
  const subtotal = items.reduce((s, i) => s + num(i.total ?? num(i.price) * (num(i.quantity) || 1)), 0) + num(o.labor_cost);
  let rate = num(o.tax_rate);
  if (rate > 1) rate /= 100;
  const tax = Math.round(subtotal * rate * 100) / 100;
  const computed = Math.max(0, Math.round((subtotal + tax - discounts) * 100) / 100);
  const total = o.cost_estimate !== null && o.cost_estimate !== undefined && num(o.cost_estimate) > 0 ? num(o.cost_estimate) : computed;
  const paid = num(o.amount_paid);
  return { subtotal, tax, total, paid, balance: Math.max(0, Math.round((total - paid) * 100) / 100) };
}

export interface PartLine {
  id: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
  supplier: string;
  cost: number | null;
  isService: boolean;
}

export function partLines(o: OrderRow, canSeeCosts: boolean): PartLine[] {
  return (o.order_items ?? [])
    .filter((i): i is OrderItemRow => !!i && i.type !== "discount" && !!String(i.name ?? "").trim())
    .map((i, idx) => {
      const qty = num(i.quantity) || 1;
      const rawCost = i.cost ?? i.unit_cost;
      return {
        id: String(i.id ?? idx),
        name: String(i.name),
        quantity: qty,
        price: num(i.price),
        total: num(i.total ?? num(i.price) * qty),
        supplier: canSeeCosts ? String(i.supplier_name ?? i.supplier ?? "") : "",
        cost: canSeeCosts && rawCost !== undefined && rawCost !== null && rawCost !== "" ? num(rawCost) * qty : null,
        isService: i.type === "service",
      };
    });
}

export interface PartsProfit {
  cost: number;
  gain: number;
}

export function partsProfit(lines: readonly PartLine[], revenue: number): PartsProfit | null {
  if (!lines.some((l) => l.cost !== null)) return null;
  const cost = lines.reduce((s, l) => s + (l.cost ?? 0), 0);
  return { cost: Math.round(cost * 100) / 100, gain: Math.round((revenue - cost) * 100) / 100 };
}

export interface TimelineEntry {
  key: string;
  icon: string;
  title: string;
  detail: string;
  when: string;
  status: string | null;
}

export function timelineOf(o: OrderRow, limit = 8): TimelineEntry[] {
  const history = Array.isArray(o.status_history) ? (o.status_history as HistoryEntry[]) : [];
  const stamp = (e: HistoryEntry) => new Date(e.timestamp ?? 0).getTime() || 0;
  return [...history]
    .filter((e) => e && (e.status || e.note))
    .sort((a, b) => stamp(b) - stamp(a))
    .slice(0, limit)
    .map((e, idx) => {
      const hasStatus = !!e.status && (!e.kind || e.kind === "status");
      const title = hasStatus ? `Paso a ${statusLabel(e.status)}` : e.kind === "internal_note" ? "Nota interna" : e.note ? "Nota" : "Actividad";
      return {
        key: `${e.timestamp ?? idx}-${idx}`,
        icon: hasStatus ? "status" : "note",
        title,
        detail: hasStatus ? String(e.note ?? "") : String(e.note ?? ""),
        when: [e.timestamp ? new Date(e.timestamp).toLocaleString("es-PR", { weekday: "short", hour: "numeric", minute: "2-digit" }) : "", String(e.changed_by ?? "")].filter(Boolean).join(" - "),
        status: e.status ?? null,
      };
    });
}
