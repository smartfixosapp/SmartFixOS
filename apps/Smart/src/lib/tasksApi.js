import { supabase } from "../../../../lib/supabase-client.js";

const nowISO = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
export const num = (v) => { const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

export const OFFSETS = [[300, "5 minutos antes"], [600, "10 minutos antes"], [1800, "30 minutos antes"], [3600, "1 hora antes"], [172800, "2 días antes"]];

export function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().toLowerCase();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 0x3) | 0x8).toString(16); });
}

export function linkedOrdersOf(task) {
  const arr = Array.isArray(task?.linked_orders) ? task.linked_orders.filter((o) => o && o.id) : [];
  if (arr.length) return arr;
  return task?.order_id ? [{ id: task.order_id, order_number: task.order_number, customer_name: task.order_customer_name }] : [];
}

export async function fetchPendingTasks(tenantId) {
  const { data, error } = await supabase.from("workshop_task").select("*").eq("tenant_id", tenantId).is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(300);
  if (error) throw error;
  return (data || []).filter((t) => t.is_deleted !== true);
}

export async function fetchOrderTasks(tenantId, orderId) {
  const base = () => supabase.from("workshop_task").select("*").eq("tenant_id", tenantId).is("completed_at", null).order("due_at", { ascending: true, nullsFirst: false }).limit(100);
  const [a, b] = await Promise.all([base().eq("order_id", orderId), base().contains("linked_orders", [{ id: orderId }])]);
  if (a.error) throw a.error;
  const map = new Map();
  [...(a.data || []), ...(b.error ? [] : b.data || [])].forEach((t) => { if (t.is_deleted !== true) map.set(t.id, t); });
  return [...map.values()].filter((t) => linkedOrdersOf(t).some((o) => o.id === orderId));
}

function payloadFrom(f) {
  const due = f.dueAt ? new Date(f.dueAt) : null;
  const linked = f.orders || [];
  const first = linked[0] || null;
  const cost = f.hasCost && num(f.cost) > 0 ? num(f.cost) : null;
  const p = {
    title: String(f.title).trim(), notes: String(f.notes || "").trim() || null, due_at: due ? due.toISOString().replace(/\.\d{3}Z$/, "Z") : null,
    notify_at: due && f.notify && f.offset ? new Date(due.getTime() - f.offset * 1000).toISOString().replace(/\.\d{3}Z$/, "Z") : null,
    assigned_to: f.assignee?.id || null, assigned_name: f.assignee?.full_name || null, cost,
    order_id: first?.id || null, order_number: first?.order_number || null, order_customer_name: first?.customer_name || null,
  };
  return { payload: p, multi: linked.length > 1 ? linked.map((o) => ({ id: o.id, order_number: o.order_number, customer_name: o.customer_name })) : null };
}

export async function createTask(tenantId, f, createdBy) {
  const { payload, multi } = payloadFrom(f);
  const row = { id: uuid(), tenant_id: tenantId, created_by: createdBy || "Web", ...payload };
  if (multi) row.linked_orders = multi;
  const { data, error } = await supabase.from("workshop_task").insert(row).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateTask(id, f) {
  const { payload, multi } = payloadFrom(f);
  const { data, error } = await supabase.from("workshop_task").update({ ...payload, linked_orders: multi }).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function completeTask(id) {
  const { error } = await supabase.from("workshop_task").update({ completed_at: nowISO() }).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id) {
  const { error } = await supabase.from("workshop_task").update({ is_deleted: true, deleted_at: nowISO() }).eq("id", id);
  if (error) throw error;
}

export async function fetchAllOrdersForPicker(tenantId) {
  const { data, error } = await supabase.from("order").select("id,order_number,customer_name,device_brand,device_family,device_model,status").eq("tenant_id", tenantId).eq("is_deleted", false).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

export function dueLabel(task, now = new Date()) {
  if (!task.due_at) return "";
  const d = new Date(task.due_at);
  const time = new Intl.DateTimeFormat("es-PR", { hour: "numeric", minute: "2-digit" }).format(d).toLowerCase().replace(/\s/g, "");
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return `Hoy ${time}`;
  if (sameDay(d, new Date(now.getTime() + 86400000))) return `Mañana ${time}`;
  if (sameDay(d, new Date(now.getTime() - 86400000))) return "Ayer";
  return new Intl.DateTimeFormat("es-PR", { day: "numeric", month: "short" }).format(d).replace(/\./g, "");
}

export const isOverdue = (task, now = new Date()) => !!task.due_at && !task.completed_at && new Date(task.due_at) < now;

export async function schedulePatch(order, { at, location, note, toStatusScheduled }) {
  const fields = { service_type: "visit", appointment_at: at.toISOString(), appointment_location: String(location || "").trim() || null, appointment_note: String(note || "").trim() || null, updated_date: nowISO() };
  const { error } = await supabase.from("order").update(fields).eq("id", order.id);
  if (error) throw error;
  return { ...order, ...fields, toStatusScheduled };
}
