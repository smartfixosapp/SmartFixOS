import { supabase } from "../../../../lib/supabase-client.js";
import { normalizeTaxPercent } from "@/lib/taxRate";

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function merge3(base, edited, server) {
  if (edited === null || edited === undefined) return undefined;
  if (same(edited, base)) return server;
  if (isObj(edited) && isObj(server)) {
    const out = { ...server };
    const keys = new Set([...Object.keys(edited), ...Object.keys(isObj(base) ? base : {})]);
    keys.forEach((k) => {
      if (!(k in edited)) { delete out[k]; return; }
      const r = merge3(isObj(base) ? base[k] : undefined, edited[k], server[k]);
      if (r === undefined) delete out[k]; else out[k] = r;
    });
    return out;
  }
  return edited;
}

export async function fetchTenantRow(tenantId) {
  const { data, error } = await supabase.from("tenant").select("*").eq("id", tenantId).maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function updateTenant({ tenantId, columns = {}, settingsEdits = null, baseSettings = {} }) {
  const fresh = await fetchTenantRow(tenantId);
  if (!fresh) throw new Error("No se encontró el taller.");
  const patch = { ...columns };
  if (settingsEdits && Object.keys(settingsEdits).length) {
    const server = isObj(fresh.settings) ? fresh.settings : {};
    const out = { ...server };
    Object.keys(settingsEdits).forEach((k) => {
      const r = merge3(baseSettings?.[k], settingsEdits[k], server[k]);
      if (r === undefined) delete out[k]; else out[k] = r;
    });
    patch.settings = out;
  }
  if (!Object.keys(patch).length) return fresh;
  const { data, error } = await supabase.from("tenant").update(patch).eq("id", tenantId).select("*");
  if (error) throw error;
  if (!data?.length) throw new Error("Sin permiso para guardar estos cambios.");
  return data[0];
}

export const settingsOf = (tenant) => (isObj(tenant?.settings) ? tenant.settings : {});

export const DAYS = [["monday", "Lunes"], ["tuesday", "Martes"], ["wednesday", "Miércoles"], ["thursday", "Jueves"], ["friday", "Viernes"], ["saturday", "Sábado"], ["sunday", "Domingo"]];

export function businessHoursOf(tenant) {
  const raw = settingsOf(tenant).business_hours;
  const def = {};
  DAYS.forEach(([k]) => {
    def[k] = k === "saturday" ? { open: "10:00", close: "17:00", closed: false } : k === "sunday" ? { open: "00:00", close: "00:00", closed: true } : { open: "09:00", close: "17:00", closed: false };
  });
  if (!isObj(raw)) return { hours: def, stored: false };
  const hours = {};
  DAYS.forEach(([k]) => { const d = raw[k]; hours[k] = isObj(d) ? { open: String(d.open || "09:00"), close: String(d.close || "17:00"), closed: d.closed === true } : def[k]; });
  return { hours, stored: true };
}

export function paymentMethodsOf(tenant) {
  const raw = settingsOf(tenant).payment_methods;
  const r = isObj(raw) ? raw : {};
  return {
    cash: r.cash !== false, card: r.card !== false, ath: r.ath !== false, athHidden: r.athHidden === true,
    custom: (Array.isArray(r.custom) ? r.custom : []).filter((c) => c && c.id).map((c) => ({ id: c.id, label: c.label || "", enabled: c.enabled !== false, ...(c.qr && (c.qr.imageBase64 || c.qr.paymentURL) ? { qr: c.qr } : {}) })),
    ...(r.cashQR ? { cashQR: r.cashQR } : {}), ...(r.cardQR ? { cardQR: r.cardQR } : {}), ...(r.athQR ? { athQR: r.athQR } : {}),
  };
}

export const RECIBO_DEFAULTS = { sale_subject: "Tu recibo de venta #{number}", order_subject: "Tu orden de reparación #{number}", send_email: true, send_whatsapp: true, send_print: true };
export function posReciboOf(tenant) {
  const r = settingsOf(tenant).pos_recibo;
  const o = isObj(r) ? r : {};
  return { sale_subject: o.sale_subject ?? RECIBO_DEFAULTS.sale_subject, order_subject: o.order_subject ?? RECIBO_DEFAULTS.order_subject, send_email: o.send_email !== false, send_whatsapp: o.send_whatsapp !== false, send_print: o.send_print !== false };
}

export const hiddenStatusesOf = (tenant) => { const h = settingsOf(tenant).hidden_order_statuses; return Array.isArray(h) ? h.map(String) : []; };
export const taxPercentOf = (tenant) => normalizeTaxPercent(settingsOf(tenant).tax_rate);

export const DEFAULT_ABANDONMENT = "El cliente debe recoger su equipo dentro de los 30 días luego de ser notificado que está listo. Pasado ese plazo aplica un cargo diario por almacenaje. Los equipos no reclamados dentro de los 90 días desde dicha notificación se considerarán abandonados, y el taller podrá disponer de ellos conforme a la ley aplicable para recuperar los costos de reparación y almacenaje.";

export function policiesOf(tenant) {
  const p = settingsOf(tenant).policies;
  const o = isObj(p) ? p : {};
  return { repair_warranty: o.repair_warranty || "", sales_warranty: o.sales_warranty || "", sales_terms: o.sales_terms || "", abandonment_terms: o.abandonment_terms || "" };
}

export function recurringOf(tenant) {
  const r = settingsOf(tenant).recurring_expenses;
  const items = isObj(r) && Array.isArray(r.items) ? r.items : [];
  return items.filter((i) => i && i.id).map((i) => ({ ...i, amount: Number(i.amount) || 0, day_of_month: parseInt(i.day_of_month, 10) || 1 }));
}

export const PLAN_NAMES = { trial: "Prueba gratis", boletos: "Solo boletos", solo: "SOLO (anterior)", team: "Completo", beta: "Beta", pro: "Pro (legacy)", enterprise: "Enterprise (legacy)", founders_lifetime: "Founder ∞", free: "Free (legacy)", expired: "Vencido" };
export const planKey = (tenant) => String(tenant?.plan || "").toLowerCase();
export const planName = (tenant) => PLAN_NAMES[planKey(tenant)] || "—";
export const hasInternalChat = (tenant) => ["trial", "boletos", "solo", "team", "beta", "pro", "enterprise", "founders_lifetime"].includes(planKey(tenant));

export function trialDays(tenant) {
  if (!tenant?.trial_end_date) return null;
  const d = Math.ceil((new Date(tenant.trial_end_date).getTime() - Date.now()) / 86400000);
  return Math.max(0, d);
}

export function planSummary(tenant) {
  if (planKey(tenant) === "trial") { const d = trialDays(tenant); if (d !== null) return `Trial: ${d} días`; }
  return planName(tenant);
}

export const isAdminRole = (role) => ["owner", "admin", "manager", "contable", "super_admin"].includes(String(role || "").toLowerCase());
export const isPlanProOrAbove = (tenant) => { const p = planKey(tenant); return !p || ["pro", "enterprise", "founders_lifetime", "beta"].includes(p); };
export const isPlanTeamOrAbove = (tenant) => { const p = planKey(tenant); return !p || ["trial", "team", "pro", "enterprise", "founders_lifetime", "beta"].includes(p); };

export const localGet = (k, d = null) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } };
export const localSet = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { return; } };
