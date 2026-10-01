import { supabase } from "../../../../lib/supabase-client.js";
import { safeTZ, startOfDay, zonedParts, zonedDate, addDays, daysBetween } from "@/lib/finance/tz";
import { ownerPinExists } from "@/lib/posApi";
import { periodContaining } from "@/lib/finance/payroll";
import { fetchEntries, elapsedHours, matchIdsFor } from "@/lib/punchApi";

export const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

const LIST_COLUMNS = "id,order_number,created_date,updated_date,tenant_id,customer_id,customer_name,customer_phone,customer_email,device_type,device_brand,device_family,device_model,device_color,device_serial,initial_problem,labor_cost,cost_estimate,amount_paid,balance_due,tax_rate,paid,deposit_amount,status,status_note,priority,assigned_to,assigned_to_name,created_by_name,progress_percentage,is_deleted,service_type,appointment_at,appointment_location,appointment_note,warranty_days,customer_approval_status,not_repairable_resolved_at,promised_date,review_rating,review_feedback,reopen_count,last_reopen_reason,last_reopen_at,warranty_claim,abandoned_at,storage_fee_total,property_claim_ready_at,property_claimed_at";

const TERMINAL = new Set(["delivered", "cancelled", "warranty", "abandoned"]);

export function isClosed(o) {
  if (o.status === "not_repairable") return !!o.not_repairable_resolved_at;
  return TERMINAL.has(o.status);
}

export function displayDevice(o) {
  const raw = [o.device_brand, o.device_family, o.device_model].filter((x) => x && String(x).trim()).join(" ");
  const seen = new Set();
  return raw.split(/\s+/).filter((w) => {
    const k = w.toLowerCase();
    if (!w || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).join(" ");
}

export const displayName = (o) => o.customer_name || "Cliente desconocido";
export const displayNumber = (o) => o.order_number || o.id || "-";
export const orderTotal = (o) => (o.cost_estimate !== null && o.cost_estimate !== undefined && o.cost_estimate !== "" ? num(o.cost_estimate) : num(o.labor_cost));
export const remainingBalance = (o) => (o.balance_due !== null && o.balance_due !== undefined && o.balance_due !== "" ? num(o.balance_due) : Math.max(0, orderTotal(o) - num(o.amount_paid)));
export const isAppointment = (o) => (o.service_type || "workshop") !== "workshop";

export async function fetchDashboardOrders(tenantId) {
  const { data, error } = await supabase.from("order").select(LIST_COLUMNS).eq("tenant_id", tenantId).eq("is_deleted", false).order("created_date", { ascending: false }).limit(400);
  if (error) throw error;
  return data || [];
}

export async function fetchTodayTotals(tenantId, tz) {
  const start = startOfDay(new Date(), safeTZ(tz));
  const { data, error } = await supabase.from("transaction").select("type,amount,created_at").eq("tenant_id", tenantId).eq("is_deleted", false)
    .gte("created_at", start.toISOString()).order("created_at", { ascending: true }).limit(2000);
  if (error) throw error;
  const rows = data || [];
  const revenue = rows.filter((t) => t.type === "revenue").reduce((s, t) => s + num(t.amount), 0);
  const expenses = rows.filter((t) => t.type === "expense").reduce((s, t) => s + num(t.amount), 0);
  return { revenue, expenses, net: revenue - expenses };
}

export function subscribeDashboard(tenantId, onChange) {
  let timer = null;
  const fire = () => { clearTimeout(timer); timer = setTimeout(onChange, 600); };
  const channel = supabase.channel(`inicio-${tenantId}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "order", filter: `tenant_id=eq.${tenantId}` }, fire)
    .on("postgres_changes", { event: "*", schema: "public", table: "transaction", filter: `tenant_id=eq.${tenantId}` }, fire)
    .on("postgres_changes", { event: "*", schema: "public", table: "cash_register", filter: `tenant_id=eq.${tenantId}` }, fire)
    .subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(channel); };
}

const DAY = 86400000;
const refDate = (o) => new Date(o.updated_date || o.created_date || Date.now());
const warrantyDays = (o) => (o.warranty_days === null || o.warranty_days === undefined || o.warranty_days === "" ? 30 : Math.trunc(num(o.warranty_days)));

export function warrantyDaysLeftCard(o) {
  const days = Math.floor((Date.now() - refDate(o).getTime()) / DAY);
  return warrantyDays(o) - days;
}

export function activeWarrantyOrders(orders) {
  return orders.filter((o) => {
    if (o.status === "warranty") return true;
    if (o.status !== "delivered") return false;
    const wd = warrantyDays(o);
    if (wd === 0) return false;
    return Math.floor((Date.now() - refDate(o).getTime()) / DAY) <= wd;
  }).sort((a, b) => refDate(a) - refDate(b));
}

export function warrantySummary(list) {
  const claims = list.filter((o) => o.status === "warranty");
  const urgent = list.filter((o) => { if (o.status !== "delivered") return false; const dl = warrantyDaysLeftCard(o); return dl >= 0 && dl <= 7; });
  const preview = [
    ...claims.map((o) => ({ order: o, daysLeft: null, total: warrantyDays(o) })),
    ...list.filter((o) => o.status === "delivered").map((o) => ({ order: o, daysLeft: warrantyDaysLeftCard(o), total: warrantyDays(o) })).filter((x) => x.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft),
  ].slice(0, 4);
  return { claims: claims.length, urgent: urgent.length, alDia: Math.max(0, list.length - claims.length - urgent.length), preview };
}

export async function fetchWarrantyScreenOrders(tenantId) {
  const { data, error } = await supabase.from("order").select("*").eq("tenant_id", tenantId).eq("is_deleted", false).in("status", ["warranty", "delivered"]).order("updated_date", { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).filter((o) => {
    if (o.status === "warranty") return true;
    const wd = warrantyDays(o);
    if (wd === 0) return false;
    return Math.floor((Date.now() - refDate(o).getTime()) / DAY) <= wd;
  });
}

export function deliveredAt(o) {
  const hist = Array.isArray(o.status_history) ? o.status_history : [];
  let latest = null;
  hist.forEach((e) => {
    if (e?.status !== "delivered" || !e.timestamp) return;
    const t = new Date(e.timestamp);
    if (!Number.isNaN(t.getTime()) && (!latest || t > latest)) latest = t;
  });
  return latest || refDate(o);
}

export function warrantyScreenDaysLeft(o) {
  const days = Math.floor((Date.now() - deliveredAt(o).getTime()) / DAY);
  return Math.max(0, warrantyDays(o) - days);
}

export { warrantyDays };

export function waMessage(o, shop) {
  const name = String(o.customer_name || "").trim().split(/\s+/)[0] || "";
  const device = displayDevice(o) || "equipo";
  const n = displayNumber(o);
  if (o.status === "ready_for_pickup") return `Hola ${name}, tu ${device} está listo para recoger en ${shop}. Orden: ${n}.`;
  if (o.status === "delivered" && remainingBalance(o) > 0.005) return `Hola ${name}, tienes un balance pendiente de $${remainingBalance(o).toFixed(2)} de tu orden ${n}. — ${shop}`;
  return `Hola ${name}, te escribimos de ${shop} sobre tu orden ${n}.`;
}

export const cleanPhone = (p) => String(p || "").replace(/[^\d+]/g, "");

export function waLink(phone, text) {
  const digits = cleanPhone(phone).replace(/\+/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function fetchAppointments(tenantId, tz) {
  const start = startOfDay(new Date(), safeTZ(tz));
  const { data, error } = await supabase.from("order").select("*").eq("tenant_id", tenantId).neq("service_type", "workshop").gte("appointment_at", start.toISOString()).neq("is_deleted", true).order("appointment_at", { ascending: true }).limit(200);
  if (error) throw error;
  return data || [];
}

export function appointmentBucket(date, tz) {
  const z = safeTZ(tz);
  const d = daysBetween(startOfDay(new Date(), z), date, z);
  if (d <= 0) return "hoy";
  if (d === 1) return "manana";
  if (d < 7) return "semana";
  return "despues";
}

export function isMonthlyLimitReached(tenant, orders, tz) {
  const plan = String(tenant?.plan || "").toLowerCase();
  if (!["free", "basic", "simple"].includes(plan)) return false;
  let role = "";
  try {
    role = localStorage.getItem("smartfix_tenant_role") || "";
  } catch {
    role = "";
  }
  if (role === "super_admin") return false;
  const z = safeTZ(tz);
  const p = zonedParts(new Date(), z);
  const monthStart = zonedDate(p.y, p.m, 1, z);
  return orders.filter((o) => o.created_date && new Date(o.created_date) >= monthStart).length >= 50;
}

export function trialInfo(tenant) {
  const plan = String(tenant?.plan || "").toLowerCase();
  if (plan === "beta") return { kind: "beta" };
  if (plan !== "trial") return null;
  const end = tenant?.trial_end_date ? new Date(tenant.trial_end_date) : null;
  if (!end || Number.isNaN(end.getTime())) return { kind: "trial", days: null };
  const days = Math.max(0, Math.ceil((end.getTime() - Date.now()) / DAY));
  return { kind: "trial", days };
}

export function shouldBlockApp(tenant) {
  return String(tenant?.plan || "").toLowerCase() === "expired" || String(tenant?.subscription_status || "").toLowerCase() === "expired";
}

const RECIBO_DEFAULTS = { sale_subject: "Tu recibo de venta #{number}", order_subject: "Tu orden de reparación #{number}", send_email: true, send_whatsapp: true, send_print: true };

export function primerosPasosFlags(tenant) {
  const s = tenant?.settings || {};
  const t = (v) => String(v || "").trim();
  const info = !!(t(tenant?.name) && t(tenant?.logo_url) && t(tenant?.address));
  const taxRaw = s.tax_rate;
  const tax = (taxRaw === undefined || taxRaw === null || taxRaw === "" ? 11.5 : num(taxRaw)) > 0;
  const pm = s.payment_methods;
  const payments = !pm || typeof pm !== "object" ? true : !!(pm.cash !== false || pm.card !== false || (pm.ath !== false && !pm.athHidden));
  const r = s.pos_recibo;
  const reciboDiff = r && typeof r === "object" && Object.keys(RECIBO_DEFAULTS).some((k) => (r[k] === undefined ? false : r[k] !== RECIBO_DEFAULTS[k]));
  const pol = s.policies || {};
  const recibo = !!reciboDiff || !!(t(pol.repair_warranty) || t(pol.sales_warranty) || t(pol.sales_terms));
  return { info, tax, payments, recibo };
}

async function hasRow(table, tenantId, extra) {
  let q = supabase.from(table).select("id").eq("tenant_id", tenantId).limit(1);
  if (extra) q = extra(q);
  const { data } = await q;
  return (data || []).length > 0;
}

export async function primerosPasosCounts(tenantId) {
  const [products, orders, sales, pin] = await Promise.all([
    hasRow("product", tenantId, (q) => q.eq("active", true)).catch(() => false),
    hasRow("order", tenantId, (q) => q.eq("is_deleted", false)).catch(() => false),
    hasRow("sale", tenantId).catch(() => false),
    ownerPinExists(tenantId).catch(() => false),
  ]);
  return { products, orders, sales, pin };
}

export async function loadMiTurno({ tenantId, employee, authUid, tz }) {
  if (!employee?.id && !authUid) return { hours: 0, rate: 0, schedule: null };
  let emp = employee;
  if (employee?.id) {
    const { data } = await supabase.from("app_employee").select("*").eq("tenant_id", tenantId).eq("id", employee.id).limit(1);
    if (data?.[0]) emp = data[0];
  }
  const rate = emp?.hourly_rate !== null && emp?.hourly_rate !== undefined && emp?.hourly_rate !== "" ? num(emp.hourly_rate) : num(emp?.schedule?.hourlyRate);
  const ids = matchIdsFor(emp, authUid);
  const p = periodContaining(new Date(), safeTZ(tz));
  const entries = await fetchEntries({ tenantId, matchIds: ids, from: p.start, to: new Date() }).catch(() => []);
  return { hours: entries.reduce((s, e) => s + elapsedHours(e), 0), rate, schedule: emp?.schedule && Array.isArray(emp.schedule.days) ? emp.schedule : null };
}

export async function listQuotes(tenantId) {
  const { data, error } = await supabase.from("quote").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(300);
  if (error) throw error;
  return data || [];
}

export function quoteStatus(q) {
  return ["pending", "accepted", "lost"].includes(q?.status) ? q.status : "pending";
}

export function quoteValidUntil(q) {
  const raw = String(q?.valid_until || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function quoteExpired(q) {
  const until = quoteValidUntil(q);
  return quoteStatus(q) === "pending" && !!until && until < new Date();
}

export const r2q = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export function quoteSummary(q) {
  const parts = [q?.device_label, q?.part_label].map((x) => String(x || "").trim()).filter(Boolean);
  return parts.length ? parts.join(" · ") : "Cotización";
}

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

export async function insertQuote({ tenantId, partPrice, labor, taxRatePercent, customerName, customerPhone, deviceLabel, partLabel, productId, partCost, createdByName }) {
  const part = Math.max(0, num(partPrice));
  const lab = Math.max(0, num(labor));
  const rate = Math.max(0, num(taxRatePercent)) / 100;
  const subtotal = part + lab;
  const taxAmount = r2(subtotal * rate);
  const valid = new Date(Date.now() + 15 * DAY);
  const body = {
    tenant_id: tenantId, part_price: part, labor: lab, tax_rate: rate, tax_amount: taxAmount, total: r2(subtotal + taxAmount), status: "pending",
    valid_until: `${valid.getFullYear()}-${String(valid.getMonth() + 1).padStart(2, "0")}-${String(valid.getDate()).padStart(2, "0")}`,
  };
  const t = (v) => String(v || "").trim();
  if (t(customerName)) body.customer_name = t(customerName);
  if (t(customerPhone)) body.customer_phone = t(customerPhone);
  if (t(deviceLabel)) body.device_label = t(deviceLabel);
  if (t(partLabel)) body.part_label = t(partLabel);
  if (productId) body.product_id = productId;
  if (t(createdByName)) body.created_by_name = t(createdByName);
  if (num(partCost) > 0) body.part_cost = num(partCost);
  const { data, error } = await supabase.from("quote").insert(body).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateQuoteStatus(id, status) {
  const { error } = await supabase.from("quote").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteQuote(id) {
  const { error } = await supabase.from("quote").delete().eq("id", id);
  if (error) throw error;
}

export function laborChipAmounts(tenantId) {
  let hist = {};
  try {
    hist = JSON.parse(localStorage.getItem(`quote.labor.${tenantId}`) || "{}") || {};
  } catch {
    hist = {};
  }
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => Number(k)).filter((v) => v > 0);
  let list = top;
  if (top.length < 3) list = [...new Set([...top, 20, 40, 60, 80, 100])].slice(0, 5);
  return list.sort((a, b) => a - b);
}

export function recordLaborChip(tenantId, amount) {
  if (!(amount > 0)) return;
  try {
    const k = `quote.labor.${tenantId}`;
    const hist = JSON.parse(localStorage.getItem(k) || "{}") || {};
    const key = amount.toFixed(2);
    hist[key] = (hist[key] || 0) + 1;
    localStorage.setItem(k, JSON.stringify(hist));
  } catch {
    return;
  }
}

export async function listOffers(tenantId) {
  const { data, error } = await supabase.from("offer").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function listActiveProducts(tenantId) {
  const { data, error } = await supabase.from("product").select("*").eq("tenant_id", tenantId).eq("active", true).order("name", { ascending: true }).limit(5000);
  if (error) throw error;
  return data || [];
}

export const offerType = (o) => (["fixed", "percent", "combo", "amount"].includes(o?.offer_type) ? o.offer_type : "percent");
export const offerLive = (o) => o?.active !== false && (!o?.ends_at || new Date(o.ends_at) > new Date());
export const offerDaysLeft = (o) => (o?.ends_at ? Math.max(0, Math.ceil((new Date(o.ends_at).getTime() - Date.now()) / DAY)) : null);
export const offerExpiringSoon = (o) => offerLive(o) && offerDaysLeft(o) !== null && offerDaysLeft(o) <= 2;
export const offerLabel = (o) => String(o?.label || "").trim() || ({ fixed: "Precio especial", percent: "Descuento", combo: "Combo", amount: "Descuento" }[offerType(o)]);

export function offerPromoPrice(o, base) {
  if (o?.value === null || o?.value === undefined || o?.value === "") return base;
  const v = num(o?.value);
  const t = offerType(o);
  if (t === "fixed") return Math.max(0, v);
  if (t === "percent") return Math.max(0, base * (1 - v / 100));
  if (t === "amount") return v > 0 ? Math.max(0, base - v) : base;
  return base;
}

const cleanText = (v) => String(v || "").trim();

function deviceColumns(device) {
  return {
    device_brand: cleanText(device?.brand) || null,
    device_family: cleanText(device?.family) || null,
    device_model_tag: cleanText(device?.model) || null,
    part_filter: cleanText(device?.partFilter) || null,
  };
}

export async function insertOffer({ tenantId, scope, productId, category, type, value, label, endsAt, device }) {
  const body = { tenant_id: tenantId, offer_type: type, active: true };
  if (scope === "device") Object.entries(deviceColumns(device)).forEach(([k, v]) => { if (v) body[k] = v; });
  else if (scope === "product") body.product_id = productId;
  else body.category = category;
  if (type !== "combo") body.value = num(value);
  if (String(label || "").trim()) body.label = String(label).trim();
  if (endsAt) body.ends_at = endsAt.toISOString().replace(/\.\d{3}Z$/, "Z");
  const { error } = await supabase.from("offer").insert(body);
  if (error) throw error;
}

export async function updateOffer(id, { type, value, label, endsAt, device }) {
  const body = { offer_type: type, label: String(label || "").trim(), ends_at: endsAt ? endsAt.toISOString().replace(/\.\d{3}Z$/, "Z") : null };
  if (type !== "combo") body.value = num(value);
  if (device) Object.assign(body, deviceColumns(device));
  const { error } = await supabase.from("offer").update(body).eq("id", id);
  if (error) throw error;
}

export async function setOfferActive(id, active) {
  const { error } = await supabase.from("offer").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function deleteOffer(id) {
  const { error } = await supabase.from("offer").delete().eq("id", id);
  if (error) throw error;
}

export function offerEndsAtFor(dateStr, timeFrom = new Date()) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d, timeFrom.getHours(), timeFrom.getMinutes(), timeFrom.getSeconds());
}

export function defaultOfferEnd() {
  const d = new Date(Date.now() + 7 * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function leftOpenYesterday(entry, register, tz) {
  const start = startOfDay(new Date(), safeTZ(tz));
  const punch = entry && !entry.clock_out && entry.clock_in && new Date(entry.clock_in) < start ? new Date(entry.clock_in) : null;
  const regAt = register?.created_at ? new Date(register.created_at) : null;
  const cash = register && regAt && regAt < start ? regAt : null;
  return { punch, cash };
}

export function relativeDayLabel(date, tz) {
  const z = safeTZ(tz);
  const d = daysBetween(date, new Date(), z);
  const p = zonedParts(date, z);
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  const time = `${h12}:${String(p.mi).padStart(2, "0")}${p.h < 12 ? "am" : "pm"}`;
  if (d === 1) return `ayer ${time}`;
  const mon = new Intl.DateTimeFormat("es-PR", { timeZone: z, month: "short" }).format(date).replace(".", "").toLowerCase();
  return `${p.d} ${mon} ${time}`;
}

export { addDays };
