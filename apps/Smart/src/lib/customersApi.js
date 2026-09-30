import { supabase } from "../../../../lib/supabase-client.js";
import { sanitizeEmail, isValidEmail } from "@/lib/wizard/helpers";
import { sendRawEmail } from "@/lib/orderEmails";

export const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const displayName = (c) => (String(c?.company_name || "").trim() ? c.company_name : c?.name || "Cliente");
export const tierOf = (c) => String(c?.loyalty_tier || "bronze");
export const isVip = (c) => {
  const t = tierOf(c).toLowerCase();
  return t === "vip" || t === "gold" || t === "platinum" || num(c?.total_spent) >= 500;
};
export const isRisk = (c) => c?.risk_flag === true;
export const isB2b = (c) => c?.is_b2b === true;

export function isNewThisMonth(c) {
  if (!c?.created_at) return false;
  const d = new Date(c.created_at);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function isInactive90(c, lastOrderMap) {
  if (!(num(c?.total_orders) > 0)) return false;
  const last = lastOrderMap[c.id];
  if (!last) return true;
  return last < new Date(Date.now() - 90 * 86400000);
}

export const BUCKETS = [
  ["all", "Todos", "#F2662E"],
  ["vip", "VIP", "#FFC733"],
  ["b2b", "B2B", "#66B3FF"],
  ["new", "Nuevos", "#4DC780"],
  ["risk", "Riesgo", "#FF7373"],
  ["inactive", "Reactivar", "#FFA640"],
];

export function inBucket(c, bucket, lastOrderMap) {
  switch (bucket) {
    case "vip": return isVip(c);
    case "b2b": return isB2b(c);
    case "new": return isNewThisMonth(c);
    case "risk": return isRisk(c);
    case "inactive": return isInactive90(c, lastOrderMap);
    default: return true;
  }
}

export async function fetchCustomers(tenantId) {
  const out = [];
  for (let off = 0; off < 20000; off += 1000) {
    const { data, error } = await supabase.from("customer").select("*").eq("tenant_id", tenantId).order("name", { ascending: true }).range(off, off + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function fetchLastOrderMap(tenantId) {
  const map = {};
  const { data } = await supabase.from("order").select("customer_id,created_at").eq("tenant_id", tenantId).eq("is_deleted", false).order("created_at", { ascending: false }).limit(3000);
  (data || []).forEach((r) => {
    if (!r.customer_id || !r.created_at) return;
    if (!map[r.customer_id]) map[r.customer_id] = new Date(r.created_at);
  });
  return map;
}

export function subscribeCustomers(tenantId, onChange) {
  let timer = null;
  const channel = supabase.channel(`customers-${tenantId}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "customer", filter: `tenant_id=eq.${tenantId}` }, () => { clearTimeout(timer); timer = setTimeout(onChange, 500); })
    .subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(channel); };
}

export function emptyInput() {
  return { name: "", lastName: "", phone: "", email: "", notes: "", language: "es", birthdayOn: false, birthday: "", referrer: null, riskFlag: false, riskNote: "", isB2b: false, companyName: "", taxId: "", billingEmail: "" };
}

export function inputFromCustomer(c) {
  return {
    ...emptyInput(), name: c.name || "", phone: c.phone || "", email: c.email || "", notes: c.notes || "", riskFlag: c.risk_flag === true, riskNote: c.risk_note || "",
    isB2b: c.is_b2b === true, companyName: c.company_name || "", taxId: c.tax_id || "", billingEmail: c.billing_email || "",
    birthdayOn: !!c.birthday, birthday: c.birthday ? String(c.birthday).slice(0, 10) : "", language: c.preferred_language === "en" ? "en" : "es",
  };
}

export const fullName = (i) => [i.name.trim(), i.lastName.trim()].filter(Boolean).join(" ");
export const inputValid = (i) => !!fullName(i) && (!!i.phone || !!i.email);

export class CustomerInputError extends Error {}

export function buildPayload(input, tenantId) {
  const email = sanitizeEmail(input.email);
  const billing = sanitizeEmail(input.billingEmail);
  if (email && !isValidEmail(email)) throw new CustomerInputError("El correo electrónico no es válido. Usa solo letras inglesas, números y símbolos básicos (sin acentos ni espacios).");
  if (input.isB2b && billing && !isValidEmail(billing)) throw new CustomerInputError("El email de facturación no es válido. Usa solo letras inglesas, números y símbolos básicos.");
  const p = { name: fullName(input), tenant_id: tenantId, preferred_language: input.language === "en" ? "en" : "es", risk_flag: !!input.riskFlag };
  if (input.phone) p.phone = input.phone;
  if (email) p.email = email;
  if (input.notes) p.notes = input.notes;
  if (input.riskNote) p.risk_note = input.riskNote;
  if (input.birthdayOn && input.birthday) p.birthday = input.birthday;
  if (input.isB2b) {
    p.is_b2b = true;
    if (input.companyName) p.company_name = input.companyName;
    p.tax_id = input.taxId ? input.taxId : null;
    p.billing_email = billing ? billing : null;
  }
  return p;
}

export async function createCustomerRow(tenantId, input) {
  const payload = buildPayload(input, tenantId);
  if (input.referrer?.id) payload.referred_by_id = input.referrer.id;
  const { data, error } = await supabase.from("customer").insert(payload).select("*").single();
  if (error) throw error;
  if (input.referrer?.id) {
    supabase.rpc("increment_loyalty_points", { p_customer_id: input.referrer.id, p_tenant_id: tenantId, p_delta: 50 }).then(() => {}, () => {});
  }
  return data;
}

export async function updateCustomerRow(id, tenantId, input) {
  const payload = buildPayload(input, tenantId);
  const { data, error } = await supabase.from("customer").update(payload).eq("id", id).select("*");
  if (error) throw error;
  return data?.[0] || null;
}

export async function setMembership(id, tenantId, isMember) {
  const { error } = await supabase.from("customer").update({ is_member: isMember }).eq("id", id).eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function deleteCustomerRow(id) {
  const { error } = await supabase.from("customer").delete().eq("id", id);
  if (error) throw error;
}

export async function recentOrdersFor(tenantId, customer, limit = 5) {
  let q = supabase.from("order").select("*").eq("tenant_id", tenantId).eq("is_deleted", false);
  q = customer.id ? q.eq("customer_id", customer.id) : q.eq("customer_name", customer.name);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function searchCustomersForPicker(tenantId, query) {
  const q = String(query || "").trim().toLowerCase().replace(/[,()]/g, " ");
  let req = supabase.from("customer").select("*").eq("tenant_id", tenantId);
  if (q) req = req.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,company_name.ilike.%${q}%`);
  const { data, error } = await req.order("name", { ascending: true }).limit(50);
  if (error) throw error;
  return data || [];
}

export const phoneDigits = (s) => String(s || "").replace(/\D/g, "");

export function greeting(customer, shop) {
  const first = String(customer?.name || "").trim().split(/\s+/)[0] || customer?.name || "";
  return `Hola ${first}, te escribimos de ${shop || "Archilla OS"}.`;
}

export async function campaignContext(tenantId) {
  const { data } = await supabase.from("order").select("customer_id,created_at").eq("tenant_id", tenantId).eq("is_deleted", false).order("created_at", { ascending: false }).limit(5000);
  const last = {};
  (data || []).forEach((r) => { if (r.customer_id && r.created_at && !last[r.customer_id]) last[r.customer_id] = new Date(r.created_at); });
  return last;
}

export const SEGMENTS = [
  ["all", "Todos los clientes"],
  ["vip", "VIP"],
  ["b2b", "B2B"],
  ["inactive", "No visitan hace 90+ días"],
  ["new", "Nuevos este mes"],
];

export function segmentRecipients(customers, segment, lastMap) {
  const withEmail = customers.filter((c) => String(c.email || "").includes("@"));
  const cutoff = new Date(Date.now() - 90 * 86400000);
  return withEmail.filter((c) => {
    if (segment === "vip") return tierOf(c).toLowerCase().includes("vip") || num(c.total_spent) >= 500;
    if (segment === "b2b") return c.is_b2b === true;
    if (segment === "inactive") { const l = lastMap[c.id]; return !l || l < cutoff; }
    if (segment === "new") return isNewThisMonth(c);
    return true;
  });
}

const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendCampaign({ tenant, tenantId, recipients, subject, body, onProgress, signal }) {
  let sent = 0;
  let failed = 0;
  const fromName = String(tenant?.name || "").trim() || "Archilla OS";
  for (const c of recipients) {
    if (signal?.aborted) break;
    const personalized = body.replace(/\{nombre\}/gi, String(c.name || "").trim().split(/\s+/)[0] || "");
    const html = `<div style="font-family:-apple-system,sans-serif;font-size:15px;color:#222;line-height:1.5">${escHtml(personalized).replace(/\n/g, "<br>")}</div>`;
    try {
      const ok = await sendRawEmail({ tenantId, to: c.email, subject, html, replyTo: String(tenant?.email || "").includes("@") ? tenant.email : undefined, fromName });
      if (ok) sent += 1; else failed += 1;
    } catch {
      failed += 1;
    }
    onProgress?.({ sent, failed, total: recipients.length });
    await new Promise((r) => setTimeout(r, 250));
  }
  return { sent, failed };
}
