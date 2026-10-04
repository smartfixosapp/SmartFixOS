import { ORDER_STATUS, PICKER_GROUPS, isOrderClosed, isTerminal } from "@/lib/orderStatus";
import { relativeTime } from "@/components/orderDetail/ui";

const NOTE_EXCLUDED_KINDS = new Set(["call", "sms", "whatsapp", "email", "photo"]);

const stamp = (e) => new Date(e?.timestamp || e?.created_date || 0).getTime() || 0;

export function createdAt(order) {
  const t = new Date(order?.created_date || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

export function currentStatusSince(order) {
  const history = Array.isArray(order?.status_history) ? order.status_history : [];
  const matches = history.filter((e) => e && e.status === order.status && e.kind !== "email" && e.kind !== "internal_note");
  const latest = matches.reduce((max, e) => Math.max(max, stamp(e)), 0);
  return latest || createdAt(order) || null;
}

export function dwellInfo(order) {
  if (order?.status !== "intake" && order?.status !== "diagnosing") return null;
  const since = currentStatusSince(order);
  if (!since) return null;
  const hours = (Date.now() - since) / 3600000;
  const [warnAt, dangerAt] = order.status === "intake" ? [2, 4] : [24, 48];
  const severity = hours >= dangerAt ? "danger" : hours >= warnAt ? "warning" : "normal";
  const stage = order.status === "intake" ? "en recepción" : "en diagnóstico";
  return { label: `${stage} ${relativeTime(new Date(since).toISOString())}`, severity };
}

export function latestNote(order) {
  const history = Array.isArray(order?.status_history) ? order.status_history : [];
  let best = null;
  for (const e of history) {
    if (!e || NOTE_EXCLUDED_KINDS.has(e.kind)) continue;
    const note = String(e.note || "").trim();
    if (!note) continue;
    if (!best || stamp(e) >= stamp(best)) best = { ...e, note };
  }
  return best ? best.note : null;
}

export function daysUntilPromised(order) {
  if (!order?.promised_date || isOrderClosed(order) || isTerminal(order.status)) return null;
  if (order.status === "cancelled" || order.status === "not_repairable") return null;
  const target = new Date(order.promised_date);
  if (Number.isNaN(target.getTime())) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

export function deviceKind(order) {
  const s = `${order?.device_type || ""} ${order?.device_brand || ""} ${order?.device_family || ""} ${order?.device_model || ""}`.toLowerCase();
  const has = (kws) => kws.some((k) => s.includes(k));
  if (has(["consola", "console", "playstation", "ps5", "ps4", "ps3", "xbox", "nintendo", "switch"])) return "console";
  if (has(["tablet", "ipad"])) return "tablet";
  if (has(["comput", "laptop", "macbook", "desktop", "surface", "imac", "notebook"])) return "computer";
  if (has(["celular", "phone", "iphone", "telefono", "teléfono", "galaxy", "smartphone", "movil", "móvil", "pixel"])) return "phone";
  if (has(["software", "desbloqueo", "unlock", "bloqueado"])) return "unlock";
  return "other";
}

export function orderKind(order) {
  const note = String(order?.status_note || "").toLowerCase();
  if (note.includes("[recarga]")) return "recharges";
  const dt = String(order?.device_type || "").toLowerCase();
  if (note.includes("[desbloqueo]") || dt === "software" || dt === "desbloqueo" || dt.startsWith("bloqueado:")) return "unlocks";
  return "repairs";
}

export const ORDER_KINDS = [
  { id: "repairs", label: "Reparaciones" },
  { id: "unlocks", label: "Desbloqueos" },
  { id: "recharges", label: "Recargas" },
];

export function deviceTypeLabel(order) {
  return String(order?.device_type || "").trim();
}

export function initialsOf(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase();
}

const STATUS_ORDER = (() => {
  const flat = PICKER_GROUPS.flatMap((g) => g.statuses);
  const extra = Object.keys(ORDER_STATUS).filter((k) => !flat.includes(k));
  return new Map([...flat, ...extra].map((k, i) => [k, i]));
})();

export const statusSortIndex = (id) => (STATUS_ORDER.has(id) ? STATUS_ORDER.get(id) : 99);

export function orderAmount(order) {
  if (order?.cost_estimate != null && order.cost_estimate !== "") return Number(order.cost_estimate) || 0;
  if (order?.labor_cost != null && order.labor_cost !== "") return Number(order.labor_cost) || 0;
  return 0;
}

export function groupForBoard(orders, hiddenStatuses = []) {
  const oldestFirst = (a, b) => createdAt(a) - createdAt(b);
  const intake = orders.filter((o) => o.status === "intake");
  const diagnosing = orders.filter((o) => o.status === "diagnosing");
  const regularIntake = intake.filter((o) => !o.is_quick_service).sort(oldestFirst);
  const regularDiagnosing = diagnosing.filter((o) => !o.is_quick_service).sort(oldestFirst);
  const quick = [...intake, ...diagnosing].filter((o) => o.is_quick_service).sort(oldestFirst);

  const groups = [];
  if (regularIntake.length) {
    groups.push({ id: "queue-intake", label: "Recepción — en orden de llegada", tint: ORDER_STATUS.intake.color, subtitle: "Trabaja la más antigua primero", orders: regularIntake });
  }
  if (regularDiagnosing.length) {
    groups.push({ id: "queue-diagnosis", label: "Diagnóstico — en orden de llegada", tint: ORDER_STATUS.diagnosing.color, subtitle: "Trabaja la más antigua primero", orders: regularDiagnosing });
  }
  if (quick.length) {
    groups.push({ id: "queue-quick", label: "Rápidas — sin restricción", tint: "#30D158", subtitle: null, orders: quick });
  }
  const rest = new Map();
  orders.forEach((o) => {
    if (o.status === "intake" || o.status === "diagnosing") return;
    if (hiddenStatuses.includes(String(o.status))) return;
    if (!rest.has(o.status)) rest.set(o.status, []);
    rest.get(o.status).push(o);
  });
  Array.from(rest.entries())
    .sort((a, b) => statusSortIndex(a[0]) - statusSortIndex(b[0]))
    .forEach(([status, list]) => {
      const cfg = ORDER_STATUS[status] || { label: status || "—", color: "#8E8E93" };
      groups.push({ id: `status-${status}`, label: cfg.label, tint: cfg.color, subtitle: null, orders: list.sort(oldestFirst) });
    });
  return groups;
}

export function quickActionsFor(order) {
  if (!order || isOrderClosed(order) || order.status === "cancelled" || order.status === "not_repairable") return [];
  return order.status === "in_progress" ? ["ready_for_pickup"] : ["in_progress"];
}

export function groupFlat(orders) {
  const newestFirst = (a, b) => createdAt(b) - createdAt(a);
  return [{ id: "search", label: "", tint: null, subtitle: null, orders: orders.slice().sort(newestFirst) }];
}
