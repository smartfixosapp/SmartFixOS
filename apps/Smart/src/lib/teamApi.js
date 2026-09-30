import { supabase } from "../../../../lib/supabase-client.js";
import { sendRawEmail } from "@/lib/orderEmails";
import { safeTZ, startOfDay, zonedParts, zonedDate } from "@/lib/finance/tz";
import { fetchEmployees, loadPayroll, payrollLines, lastClosedWeek, employeeRate } from "@/lib/finance/payroll";
import { matchIdsFor, fetchOpenEntry } from "@/lib/punchApi";

export { fetchEmployees, employeeRate };

export const ROLE_ORDER = ["owner", "admin", "manager", "contable", "cashier", "technician"];
export const ROLE_META = {
  owner: { label: "Dueño", color: "#F2662E" },
  admin: { label: "Administrador", color: "#BF5AF2" },
  manager: { label: "Gerente", color: "#66B3FF" },
  contable: { label: "Contable", color: "#F2662E" },
  cashier: { label: "Cajero", color: "#FFA640" },
  technician: { label: "Técnico", color: "#40C8E0" },
};
export const ASSIGNABLE_ON_CREATE = ["admin", "manager", "contable", "cashier", "technician"];
export const ADMIN_LEVEL = ["owner", "admin", "manager", "contable"];

export const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function rolesOf(emp) {
  const r = Array.isArray(emp?.roles) ? emp.roles.map((x) => String(x).toLowerCase()).filter(Boolean) : [];
  if (r.length) return r;
  if (emp?.role) return [String(emp.role).toLowerCase()];
  return ["technician"];
}
export const primaryRole = (roles) => ROLE_ORDER.find((r) => roles.includes(r)) || "technician";
export const roleColor = (emp) => (ROLE_META[primaryRole(rolesOf(emp))] || ROLE_META.owner).color;
export const roleLabels = (roles) => ROLE_ORDER.filter((r) => roles.includes(r)).map((r) => ROLE_META[r].label);
export const isAdminLevel = (roles) => roles.some((r) => ADMIN_LEVEL.includes(r));
export const sortedRoles = (roles) => [...new Set(roles)].sort();
export const randomPin = () => String(Math.floor(Math.random() * 10000)).padStart(4, "0");
export const isActive = (emp) => emp?.active !== false && emp?.status !== "inactive";

export function planLimit(plan) {
  const p = String(plan || "").toLowerCase();
  return ["basic", "free", "simple", "expired"].includes(p) ? 0 : 5;
}

export function limitMessage(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "solo") return "Plan SOLO permite solo 1 usuario. Cambia a TEAM en smartfixos.com para hasta 5 empleados.";
  if (p === "team") return "Llegaste al límite de 5 empleados del plan TEAM.";
  return "Esta función requiere un plan superior. Manéjalo en smartfixos.com.";
}

export async function fetchEmployeesLite(tenantId) {
  const { data, error } = await supabase.from("app_employee").select("id,tenant_id,full_name,auth_user_id,role,roles,active,status,phone").eq("tenant_id", tenantId).order("full_name", { ascending: true }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function countActive(tenantId) {
  const { data, error } = await supabase.from("app_employee").select("id").eq("tenant_id", tenantId).eq("active", true).limit(100);
  if (error) throw error;
  return (data || []).length;
}

export async function fetchEmployee(tenantId, id) {
  const { data, error } = await supabase.from("app_employee").select("*").eq("tenant_id", tenantId).eq("id", id).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function liveState(tenantId, tz) {
  const zone = safeTZ(tz);
  const start = startOfDay(new Date(), zone);
  const [entriesRes, ordersRes] = await Promise.all([
    supabase.from("time_entry").select("employee_id,clock_in,clock_out").eq("tenant_id", tenantId).gte("clock_in", start.toISOString()).lt("clock_in", new Date(Date.now() + 60000).toISOString()).limit(1000),
    supabase.from("order").select("assigned_to,status").eq("tenant_id", tenantId).eq("is_deleted", false).limit(1000),
  ]);
  const working = {};
  (entriesRes.data || []).forEach((e) => { if (!e.clock_out && e.employee_id) working[e.employee_id] = e.clock_in; });
  const counts = {};
  (ordersRes.data || []).forEach((o) => {
    if (!o.assigned_to || o.status === "delivered" || o.status === "cancelled") return;
    counts[o.assigned_to] = (counts[o.assigned_to] || 0) + 1;
  });
  return { working, counts };
}

export const workingSince = (emp, live) => live.working[emp.id] || (emp.auth_user_id ? live.working[emp.auth_user_id] : null) || null;
export const openOrdersOf = (emp, live) => (live.counts[emp.id] || 0) + (emp.auth_user_id && emp.auth_user_id !== emp.id ? live.counts[emp.auth_user_id] || 0 : 0);

export async function createEmployee(tenantId, { fullName, email, phone, roles, hourlyRate }) {
  const rs = sortedRoles(roles.length ? roles : ["technician"]);
  const pin = randomPin();
  const row = { tenant_id: tenantId, full_name: String(fullName).trim(), role: primaryRole(rs), roles: rs, active: true, pin, pin_is_temp: true };
  if (String(email || "").trim()) row.email = email.trim();
  if (String(phone || "").trim()) row.phone = phone.trim();
  if (num(hourlyRate) > 0) row.hourly_rate = num(hourlyRate);
  const { data, error } = await supabase.from("app_employee").insert(row).select("*").single();
  if (error) throw error;
  return { employee: data, pin };
}

export class ConflictError extends Error {}

export async function patchLocked(emp, fields) {
  let q = supabase.from("app_employee").update(fields).eq("id", emp.id).eq("tenant_id", emp.tenant_id);
  if (emp.updated_at) q = q.eq("updated_at", emp.updated_at);
  const { data, error } = await q.select("*");
  if (error) throw error;
  if (data?.[0]) return data[0];
  const fresh = await fetchEmployee(emp.tenant_id, emp.id).catch(() => null);
  if (!fresh) throw new ConflictError("Este empleado ya no existe.");
  const err = new ConflictError("Otro dispositivo cambió este empleado. Revisa los datos y guarda de nuevo.");
  err.fresh = fresh;
  throw err;
}

export async function updateEmployee(emp, { fullName, roles, email, phone }) {
  const rs = sortedRoles(roles);
  const v = (x) => { const t = String(x || "").trim(); return t || null; };
  return patchLocked(emp, { full_name: String(fullName).trim(), role: primaryRole(rs), roles: rs, email: v(email), phone: v(phone) });
}

export async function setPushEnabled(emp, enabled) {
  const { error } = await supabase.from("app_employee").update({ push_enabled: enabled }).eq("id", emp.id).eq("tenant_id", emp.tenant_id);
  if (error) throw error;
}

export async function resetPin(emp, pin) {
  const { data, error } = await supabase.from("app_employee").update({ pin, pin_is_temp: true }).eq("id", emp.id).eq("tenant_id", emp.tenant_id).select("*");
  if (error) throw error;
  return data?.[0] || emp;
}

export const deactivate = (emp) => patchLocked(emp, { active: false, status: "inactive", push_enabled: false, pin_is_temp: true, pin: null });
export const reactivate = (emp, pin) => patchLocked(emp, { active: true, status: "active", push_enabled: true, pin_is_temp: true, pin });

export async function hasAnyHistory(emp) {
  const ids = matchIdsFor(emp, null);
  const [t, p, o] = await Promise.all([
    supabase.from("time_entry").select("id").eq("tenant_id", emp.tenant_id).in("employee_id", ids).limit(1),
    supabase.from("transaction").select("id").eq("tenant_id", emp.tenant_id).eq("is_deleted", false).ilike("description", `[emp:${emp.id}]%`).limit(1),
    supabase.from("order").select("id").eq("tenant_id", emp.tenant_id).eq("is_deleted", false).in("assigned_to", ids).limit(1),
  ]);
  if (t.error) throw t.error;
  if (p.error) throw p.error;
  if (o.error) throw o.error;
  return (t.data || []).length > 0 || (p.data || []).length > 0 || (o.data || []).length > 0;
}

export async function deleteEmployee(emp) {
  const { error } = await supabase.from("app_employee").delete().eq("id", emp.id).eq("tenant_id", emp.tenant_id);
  if (error) throw error;
}

export async function deactivationPreflight(emp, tenant) {
  const ids = matchIdsFor(emp, null);
  const tz = safeTZ(tenant?.timezone);
  const out = { openEntry: null, unpaidHours: 0, balance: 0, hasPayroll: false, openOrders: 0, commission: 0 };
  const [open, orders] = await Promise.all([
    fetchOpenEntry(emp.tenant_id, ids).catch(() => null),
    supabase.from("order").select("status").eq("tenant_id", emp.tenant_id).eq("is_deleted", false).in("assigned_to", ids).limit(500),
  ]);
  out.openEntry = open;
  out.openOrders = (orders.data || []).filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  try {
    const period = lastClosedWeek(tz);
    const lines = payrollLines(await loadPayroll(emp.tenant_id, period), period);
    const line = lines.find((l) => l.id === emp.id || l.employee?.id === emp.id);
    if (line) { out.unpaidHours = line.hours; out.balance = line.balance; out.hasPayroll = true; }
  } catch {
    out.hasPayroll = false;
  }
  const rate = num(emp.commission_rate);
  if (rate > 0) {
    const p = zonedParts(new Date(), tz);
    const monthStart = zonedDate(p.y, p.m, 1, tz);
    const { data } = await supabase.from("order").select("cost_estimate,labor_cost").eq("tenant_id", emp.tenant_id).eq("status", "delivered").in("assigned_to", ids).gte("updated_date", monthStart.toISOString()).limit(1000);
    out.commission = Math.round((data || []).reduce((s, o) => s + (o.cost_estimate ?? o.labor_cost ?? 0), 0) * rate) / 100;
  }
  return out;
}

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendWelcomeEmail({ tenant, tenantId, employee, pin }) {
  const to = String(employee.email || "").trim();
  if (!to) return false;
  const shop = String(tenant?.name || "").trim() || "tu taller";
  const first = String(employee.full_name || "").trim().split(/\s+/)[0] || "";
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111"><h2 style="margin:0 0 8px">Hola ${esc(first)}</h2><p style="font-size:15px;line-height:1.5">${esc(shop)} te dio acceso a Archilla OS.</p><div style="margin:18px 0;padding:16px;background:#F4F4F5;border-radius:12px"><div style="font-size:12px;color:#666;letter-spacing:.06em">TU PIN DE ACCESO</div><div style="font-size:34px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,Menlo,monospace">${esc(pin)}</div></div><p style="font-size:14px;line-height:1.5">Abre Archilla OS en el dispositivo del taller, toca "Cambiar usuario" e ingresa tu PIN de 4 dígitos. Al entrar por primera vez te pediremos crear tu propio PIN.</p></div>`;
  return sendRawEmail({ tenantId, to, subject: `Tu acceso a Archilla OS — ${shop}`, html, replyTo: String(tenant?.email || "").includes("@") ? tenant.email : undefined, fromName: shop });
}

export function shareAccessText(employee, pin) {
  const first = String(employee.full_name || "").trim().split(/\s+/)[0] || "";
  const role = roleLabels(rolesOf(employee)).join(" · ");
  return `Hola ${first}\nTu acceso a Archilla OS está listo.\nNombre: ${employee.full_name}\nRol: ${role}\nPIN: ${pin}\nAbre la app en el dispositivo del taller e ingresa tu PIN para acceder.`;
}

export function invitationText(tenant, code) {
  return `Únete al equipo de ${String(tenant?.name || "").trim() || "nuestro taller"} en Archilla OS. Descarga la app, toca Soy empleado y entra con el código del taller: ${code}`;
}

export function shiftTaskSummary(tenant) {
  const st = tenant?.settings?.shift_tasks;
  const o = Array.isArray(st?.opening) ? st.opening.length : 0;
  const c = Array.isArray(st?.closing) ? st.closing.length : 0;
  return o + c === 0 ? "Sin configurar" : `${o} apertura · ${c} cierre`;
}

export async function saveShiftTasks(tenantId, shiftTasks) {
  const { data: t, error } = await supabase.from("tenant").select("settings").eq("id", tenantId).maybeSingle();
  if (error) throw error;
  const settings = { ...(t?.settings && typeof t.settings === "object" ? t.settings : {}) };
  if (shiftTasks) settings.shift_tasks = shiftTasks; else delete settings.shift_tasks;
  const { data: rows, error: e2 } = await supabase.from("tenant").update({ settings }).eq("id", tenantId).select("id");
  if (e2) throw e2;
  if (!rows?.length) throw new Error("Sin permiso para guardar estos cambios.");
  return settings;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function shareText(text) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try { await navigator.share({ text }); return true; } catch { return false; }
  }
  return copyText(text);
}
