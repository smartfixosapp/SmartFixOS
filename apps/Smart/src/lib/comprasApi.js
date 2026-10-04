import { supabase } from "../../../../lib/supabase-client.js";
import { catalogTopMatches } from "@/lib/wizard/helpers";
import { changeStatusRpc } from "@/lib/orderDetailApi";
import { adjustStockAtomic } from "@/lib/stockAdjust";
import { sendStatusEmail } from "@/lib/orderEmails";

export const PR_TZ = "America/Puerto_Rico";
const FUNCTIONS_URL = import.meta.env.VITE_FUNCTION_URL || "https://smartfixos.onrender.com";

export const num = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/[^\d.,-]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
export const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const uuid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);

const partsIn = (date, options) => {
  const out = {};
  new Intl.DateTimeFormat("en-CA", { timeZone: PR_TZ, ...options }).formatToParts(date).forEach((p) => { out[p.type] = p.value; });
  return out;
};
export function prDay(date = new Date()) {
  const p = partsIn(date, { year: "numeric", month: "2-digit", day: "2-digit" });
  return `${p.year}-${p.month}-${p.day}`;
}
export function prYYMMDD(date = new Date()) {
  const p = partsIn(date, { year: "2-digit", month: "2-digit", day: "2-digit" });
  return `${p.year}${p.month}${p.day}`;
}
const dayNum = (s) => { const [y, m, d] = String(s || "").slice(0, 10).split("-").map((x) => parseInt(x, 10)); return Number.isFinite(y) ? Date.UTC(y, m - 1, d) : NaN; };
export const daysBetweenDays = (a, b) => Math.round((dayNum(b) - dayNum(a)) / 86400000);

export function addDaysStr(day, n) {
  const [y, m, d] = String(day).slice(0, 10).split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export const delayedDays = (method) => (method === "check" ? 3 : method === "credit" ? 30 : 0);

export async function imageToJpegBlob(file, max = 512) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(bmp.width * scale));
    c.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", 0.85));
  } catch {
    throw new Error("No se pudo procesar la imagen");
  }
}

export const STATUS = {
  draft: { label: "Borrador", color: "#8E8E93" },
  ordered: { label: "Ordenada", color: "#66B3FF" },
  partial: { label: "Parcial", color: "#FFC733" },
  received: { label: "Recibida", color: "#4DC780" },
  cancelled: { label: "Cancelada", color: "#FF7373" },
};
export const STATUS_KEYS = ["draft", "ordered", "partial", "received", "cancelled"];
export const statusMeta = (s) => STATUS[s] || { label: s || "—", color: "#8E8E93" };

export const PAY_METHODS = [
  ["cash", "Efectivo"], ["card", "Tarjeta"], ["ath", "ATH Móvil"], ["transfer", "Transferencia"], ["check", "Cheque"], ["credit", "Crédito"],
];
export const payLabel = (k) => (PAY_METHODS.find((m) => m[0] === k) || [k, k])[1];

export function lineItems(po) {
  let li = po?.line_items;
  if (typeof li === "string") { try { li = JSON.parse(li); } catch { li = []; } }
  return Array.isArray(li) ? li : [];
}

export const lineQty = (l) => num(l.quantity);
export const lineReceived = (l) => num(l.received_quantity);
export const linePending = (l) => Math.max(0, lineQty(l) - lineReceived(l));
export const lineTotal = (l) => (l.line_total !== undefined && l.line_total !== null ? num(l.line_total) : lineQty(l) * num(l.unit_cost));
export const isTool = (l) => l?.is_tool === true;

export const hasStocked = (po) => String(po?.notes || "").includes("[STOCKED]");
export const paidMarker = (po) => { const m = String(po?.notes || "").match(/\[PAID:([^\]]*)\]/); return m ? m[1] : null; };
export const cleanNotes = (notes) => String(notes || "").replace(/\s*\[STOCKED\]/g, "").replace(/\s*\[PAID:[^\]]*\]/g, "").trim();
export const isTerminal = (po) => po?.status === "received" || po?.status === "cancelled";

export function overdueDays(po, today = prDay()) {
  if (!(po?.status === "ordered" || po?.status === "partial") || !po.expected_date) return 0;
  const d = daysBetweenDays(String(po.expected_date).slice(0, 10), today);
  return d > 0 ? d : 0;
}

export function woLabels(po) {
  const set = [];
  lineItems(po).forEach((l) => { const n = String(l.linked_work_order_number || "").trim(); if (n && !set.includes(n)) set.push(n); });
  return set;
}

export function woBadgeText(po) {
  const w = woLabels(po);
  if (!w.length) return null;
  return w.length === 1 ? w[0] : `${w[0]} +${w.length - 1}`;
}

export function poSubtotal(po) {
  return r2(lineItems(po).reduce((s, l) => s + lineQty(l) * num(l.unit_cost), 0));
}

export function matchesQuery(po, q) {
  const s = String(q || "").trim().toLowerCase();
  if (!s) return true;
  return [po.po_number, po.supplier_name, po.notes, po.tracking_number].some((v) => String(v || "").toLowerCase().includes(s));
}

export function dateLabel(raw, today = prDay()) {
  if (!raw) return "";
  const day = String(raw).slice(0, 10);
  const diff = daysBetweenDays(day, today);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  const [y, m, d] = day.split("-").map((x) => parseInt(x, 10));
  return new Intl.DateTimeFormat("es-PR", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(Date.UTC(y, m - 1, d))).replace(/\./g, "");
}

export function longDate(raw) {
  if (!raw) return "";
  const day = String(raw).slice(0, 10);
  const [y, m, d] = day.split("-").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y)) return "";
  const s = new Intl.DateTimeFormat("es-PR", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, d))).replace(/\./g, "");
  return s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

export function summaryStats(pos, today = prDay()) {
  const month = today.slice(0, 7);
  let active = 0;
  let toReceive = 0;
  let thisMonth = 0;
  pos.forEach((p) => {
    if (p.status === "draft" || p.status === "ordered" || p.status === "partial") active += 1;
    if (p.status === "ordered" || p.status === "partial") toReceive += num(p.total_amount);
    if (p.status !== "cancelled" && String(p.order_date || "").slice(0, 7) === month) thisMonth += num(p.total_amount);
  });
  return { active, toReceive: r2(toReceive), thisMonth: r2(thisMonth) };
}

export async function fetchPOs(tenantId) {
  const { data, error } = await supabase.from("purchase_order").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchPO(id) {
  const { data, error } = await supabase.from("purchase_order").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data || null;
}

export function subscribePOs(tenantId, onChange) {
  let timer = null;
  const channel = supabase.channel(`po-${tenantId}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "purchase_order", filter: `tenant_id=eq.${tenantId}` }, () => { clearTimeout(timer); timer = setTimeout(onChange, 600); })
    .subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(channel); };
}

export async function nextPoNumber(tenantId) {
  const part = prYYMMDD();
  try {
    const { data, error } = await supabase.rpc("next_po_number", { p_tenant_id: tenantId, p_date_part: part });
    if (!error && typeof data === "string" && data) return data;
    if (!error && Array.isArray(data) && typeof data[0] === "string") return data[0];
  } catch {
    return fallbackPoNumber(tenantId, part);
  }
  return fallbackPoNumber(tenantId, part);
}

async function fallbackPoNumber(tenantId, part) {
  const { count } = await supabase.from("purchase_order").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).like("po_number", `PO-${part}-%`);
  return `PO-${part}-${String((count || 0) + 1).padStart(3, "0")}`;
}

const normName = (s) => String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");

export async function fetchSuppliers(tenantId) {
  const { data, error } = await supabase.from("supplier").select("*").eq("tenant_id", tenantId).eq("active", true).order("name", { ascending: true }).limit(200);
  if (error) throw error;
  const seen = new Set();
  return (data || []).filter((s) => {
    const k = normName(s.name);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function uploadPublic(path, blob, contentType) {
  const bucket = supabase.storage.from("uploads");
  const { error } = await bucket.upload(path, blob, { contentType, upsert: true });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}

export async function uploadSupplierLogo(tenantId, blob) {
  return uploadPublic(`supplier_logos/${tenantId}/${uuid()}.jpg`, blob, "image/jpeg");
}

export async function createSupplier(tenantId, { name, phone, contact_name, email, website, logo_url }) {
  const p = { tenant_id: tenantId, name: String(name || "").trim(), phone: String(phone ?? "").trim(), active: true, currency: "USD", created_by: "Web" };
  if (String(contact_name || "").trim()) p.contact_name = contact_name.trim();
  if (String(email || "").trim()) p.email = email.trim();
  if (String(website || "").trim()) p.website = website.trim();
  if (logo_url) p.logo_url = logo_url;
  const { data, error } = await supabase.from("supplier").insert(p).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id, { name, phone, contact_name, email, website, logo_url }) {
  const v = (x) => { const t = String(x || "").trim(); return t || null; };
  const p = { name: String(name || "").trim(), phone: String(phone || "").trim(), contact_name: v(contact_name), email: v(email), website: v(website) };
  if (logo_url !== undefined) p.logo_url = logo_url;
  const { data, error } = await supabase.from("supplier").update(p).eq("id", id).select("*");
  if (error) throw error;
  return data?.[0] || null;
}

export async function archiveSupplier(id) {
  const { error } = await supabase.from("supplier").update({ active: false }).eq("id", id);
  if (error) throw error;
}

export async function fetchProducts(tenantId) {
  const out = [];
  for (let off = 0; off < 5000; off += 1000) {
    const { data, error } = await supabase.from("product").select("*").eq("tenant_id", tenantId).eq("active", true).order("name", { ascending: true }).range(off, off + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const CLOSED_STATUSES = new Set(["delivered", "cancelled", "abandoned", "completed", "picked_up", "closed"]);
export async function fetchLinkableOrders(tenantId) {
  const { data, error } = await supabase.from("order").select("id,order_number,customer_name,device_brand,device_family,device_model,status,not_repairable_resolved_at").eq("tenant_id", tenantId).eq("is_deleted", false).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return (data || []).filter((o) => {
    const st = String(o.status || "");
    if (CLOSED_STATUSES.has(st)) return false;
    if (st === "not_repairable" && o.not_repairable_resolved_at) return false;
    return true;
  });
}

export function catalogScore(query, products) {
  const m = catalogTopMatches(query, products, 1)[0];
  return m ? { product: m.product, score: m.score } : null;
}

export function newLine(init = {}) {
  const qty = Math.max(1, Math.trunc(num(init.quantity ?? 1)));
  const cost = num(init.unit_cost);
  const l = {
    id: init.id || uuid(), product_name: init.product_name || "", quantity: qty, received_quantity: 0, unit_cost: cost, unit_price: num(init.unit_price), tax_rate: 0, tax_amount: 0,
    line_total: r2(qty * cost), is_tool: init.is_tool === true, is_ai_imported: init.is_ai_imported === true,
  };
  if (init.inventory_item_id) l.inventory_item_id = init.inventory_item_id;
  if (init.description) l.description = init.description;
  if (init.category) l.category = init.category;
  if (init.linked_work_order_id) { l.linked_work_order_id = init.linked_work_order_id; l.linked_work_order_number = init.linked_work_order_number || null; }
  return l;
}

export async function adjustStock(tenantId, productId, delta, reason, by) {
  const { data: prod, error } = await supabase.from("product").select("id,name,stock").eq("id", productId).maybeSingle();
  if (error || !prod) return false;
  const res = await adjustStockAtomic({ id: productId, delta });
  if (!res.ok) throw res.error;
  const { before, after } = res;
  await supabase.from("transaction").insert({
    tenant_id: tenantId, type: "stock_adjustment", category: delta >= 0 ? "stock_in" : "stock_out", amount: Math.abs(after - before), description: `[${prod.name}] ${reason}`, recorded_by: by || "Web",
  });
  return true;
}

export async function recordExpense({ tenantId, po, supplierName, amount, method, by, settled, dueLabel }) {
  const description = `Orden compra ${po.po_number} · ${supplierName || po.supplier_name || ""}${dueLabel ? ` · vence ${dueLabel}` : ""}`;
  const row = { tenant_id: tenantId, type: "expense", category: "parts", amount: r2(amount), description, payment_method: method, recorded_by: by || "Web", order_id: po.id, is_settled: settled };
  let last = null;
  for (let i = 0; i < 3; i += 1) {
    const { error } = await supabase.from("transaction").insert(row);
    if (!error) return true;
    last = error;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (last) throw last;
  return false;
}

function recalcOrderFields(data, current) {
  let taxRate = num(data.tax_rate);
  if (taxRate > 1) taxRate /= 100;
  const isDiscount = (x) => x?.type === "discount";
  const subtotal = current.filter((x) => !isDiscount(x)).reduce((s, x) => s + num(x.total), 0) + num(data.labor_cost);
  const discounts = current.filter(isDiscount).reduce((s, x) => s + Math.abs(num(x.total)), 0);
  const cost = Math.max(0, r2(subtotal + subtotal * taxRate - discounts));
  const balance = Math.max(0, r2(cost - num(data.amount_paid)));
  return { order_items: current, cost_estimate: cost, balance_due: balance, updated_date: new Date().toISOString().replace(/\.\d{3}Z$/, "Z") };
}

export async function removeLinkedEntry(woId, sourceKey) {
  if (!woId || !sourceKey) return;
  try {
    const { data } = await supabase.from("order").select("id,order_items,cost_estimate,labor_cost,amount_paid,tax_rate").eq("id", woId).maybeSingle();
    if (!data) return;
    const items = Array.isArray(data.order_items) ? data.order_items : [];
    const current = items.filter((x) => x?.source_part_link_id !== sourceKey);
    if (current.length === items.length) return;
    await supabase.from("order").update(recalcOrderFields(data, current)).eq("id", woId);
  } catch {
    return;
  }
}

export async function syncItemsToLinkedWorkOrders(items, { sourcePartLinkId, lineKey } = {}) {
  const groups = {};
  items.forEach((l) => { if (l.linked_work_order_id) (groups[l.linked_work_order_id] = groups[l.linked_work_order_id] || []).push(l); });
  const ids = Object.keys(groups);
  await Promise.all(ids.map(async (woId) => {
    try {
      const { data } = await supabase.from("order").select("id,order_items,cost_estimate,labor_cost,amount_paid,tax_rate").eq("id", woId).maybeSingle();
      if (!data) return;
      let current = Array.isArray(data.order_items) ? [...data.order_items] : [];
      groups[woId].forEach((l) => {
        const qty = Math.max(1, Math.trunc(num(l.quantity)));
        const price = num(l.unit_price) > 0 ? num(l.unit_price) : num(l.unit_cost);
        const entry = { id: l.inventory_item_id || uuid(), type: l.inventory_item_id ? "part" : "manual", name: l.product_name, quantity: qty, price, total: r2(qty * price) };
        const key = sourcePartLinkId || (lineKey ? lineKey(l) : null);
        if (key) {
          entry.source_part_link_id = key;
          current = current.filter((x) => x?.source_part_link_id !== key);
        }
        current.push(entry);
      });
      await supabase.from("order").update(recalcOrderFields(data, current)).eq("id", woId);
    } catch {
      return;
    }
  }));
}

export async function ensureSupplier(tenantId, name) {
  return createSupplier(tenantId, { name, phone: "" });
}

export async function createPurchaseOrder({ tenantId, supplier, manualName, lines, expectedDate, notes, tracking, invoiceLink, method, by, checkDate }) {
  if (!tenantId) throw new Error("No se pudo identificar tu tienda. Cierra sesión y vuelve a entrar.");
  if (!lines.length) throw new Error("Agrega al menos un producto antes de crear la orden.");
  let sup = supplier;
  if (!sup && !String(manualName || "").trim()) throw new Error("Selecciona un suplidor antes de crear la orden.");
  if (!sup) sup = await createSupplier(tenantId, { name: manualName, phone: "" });
  const poNumber = await nextPoNumber(tenantId);
  const items = lines.map((l) => ({ ...l, line_total: r2(num(l.quantity) * num(l.unit_cost)) }));
  const subtotal = r2(items.reduce((s, l) => s + l.line_total, 0));
  const noteLines = [String(notes || "").trim(), `Pago: ${payLabel(method)}`].filter(Boolean).join("\n");
  const row = {
    tenant_id: tenantId, po_number: poNumber, supplier_id: sup.id, supplier_name: sup.name, status: "ordered", order_date: prDay(), expected_date: expectedDate || null, line_items: items,
    subtotal, tax_amount: 0, shipping_cost: 0, total_amount: subtotal, currency: "USD", notes: noteLines, tracking_number: String(tracking || "").trim() || null, invoice_link: invoiceLink || null, created_by_name: by || null,
  };
  Object.keys(row).forEach((k) => { if (row[k] === null || row[k] === undefined) delete row[k]; });
  const { data: po, error } = await supabase.from("purchase_order").insert(row).select("*").single();
  if (error) throw error;
  await syncItemsToLinkedWorkOrders(items, { lineKey: (l) => `po-line:${l.id}` });
  let expenseFailed = false;
  if (subtotal > 0) {
    const delayed = method === "check" || method === "credit";
    let dueLabel = "";
    if (delayed && checkDate) {
      const [y, m, d] = String(checkDate).split("-").map((x) => parseInt(x, 10));
      if (Number.isFinite(y)) dueLabel = new Intl.DateTimeFormat("es-PR", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(Date.UTC(y, m - 1, d))).replace(/\./g, "");
    }
    try {
      await recordExpense({ tenantId, po, supplierName: sup.name, amount: subtotal, method, by, settled: !delayed, dueLabel });
    } catch {
      expenseFailed = true;
    }
  }
  return { po, expenseFailed };
}

export async function uploadInvoiceFile(tenantId, file) {
  const ext = (String(file.name || "").split(".").pop() || "").toLowerCase();
  const kind = file.type === "application/pdf" || ext === "pdf" ? "pdf" : /png/.test(file.type) || ext === "png" ? "png" : /heic|heif/.test(file.type) || /heic|heif/.test(ext) ? "heic" : "jpg";
  const type = kind === "pdf" ? "application/pdf" : kind === "png" ? "image/png" : kind === "heic" ? "image/heic" : "image/jpeg";
  return uploadPublic(`purchase_orders/${tenantId}/${uuid()}.${kind}`, file, type);
}

export async function extractInvoice(fileUrl) {
  let token = null;
  try { token = (await supabase.auth.getSession())?.data?.session?.access_token || null; } catch { token = null; }
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${FUNCTIONS_URL}/ai/extract-expense`, { method: "POST", headers, body: JSON.stringify({ file_url: fileUrl, document_type: "invoice" }), signal: ctrl.signal });
    if (!res.ok) throw new Error(`Error ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function applyExtraction(data, { suppliers, products, currentSupplier, prelinked }) {
  let supplier = currentSupplier || null;
  let manualName = "";
  const extractedName = String(data?.supplier_name || "").trim();
  if (!supplier && extractedName) {
    const n = normName(extractedName);
    const hit = n.length >= 3 ? suppliers.find((s) => {
      const sn = normName(s.name);
      if (sn.length < 3) return false;
      return sn === n || ((sn.includes(n) || n.includes(sn)) && Math.abs(sn.length - n.length) <= 4);
    }) : null;
    if (hit) supplier = hit; else manualName = extractedName;
  }
  const lines = (Array.isArray(data?.line_items) ? data.line_items : []).map((it) => {
    const name = String(it.product_name || "").trim();
    const qty = Math.max(1, Math.trunc(num(it.quantity) || 1));
    const cost = num(it.unit_cost) || (num(it.line_total) && qty ? num(it.line_total) / qty : 0);
    const match = name ? catalogScore(name, products) : null;
    const base = { product_name: name, quantity: qty, unit_cost: r2(cost), is_ai_imported: true };
    if (prelinked) { base.linked_work_order_id = prelinked.id; base.linked_work_order_number = prelinked.order_number; }
    if (match && match.score >= 0.65) {
      const listed = num(match.product.price);
      return newLine({ ...base, inventory_item_id: match.product.id, product_name: match.product.name, unit_price: listed > 0 ? listed : cost > 0 ? r2(cost * 1.5) : 0 });
    }
    return newLine({ ...base, unit_price: r2(cost * 1.5) });
  });
  return { supplier, manualName, lines };
}

export async function saveTracking(id, value) {
  const { error } = await supabase.from("purchase_order").update({ tracking_number: String(value || "").trim(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export async function linkLineToOrder({ tenantId, po, lineId, order, by }) {
  const items = lineItems(po).map((l) => ({ ...l }));
  const idx = items.findIndex((l) => l.id === lineId);
  if (idx < 0) throw new Error("No se encontró la línea");
  const line = items[idx];
  const wasLinked = !!line.linked_work_order_id;
  const prevOrderId = line.linked_work_order_id || null;
  if (order) { line.linked_work_order_id = order.id; line.linked_work_order_number = order.order_number; } else { delete line.linked_work_order_id; delete line.linked_work_order_number; }
  const nowLinked = !!line.linked_work_order_id;
  const { data, error } = await supabase.from("purchase_order").update({ line_items: items, updated_at: new Date().toISOString() }).eq("id", po.id).select("*").single();
  if (error) throw error;
  const rec = lineReceived(line);
  if (rec > 0 && !isTool(line) && line.inventory_item_id && wasLinked !== nowLinked) {
    if (!wasLinked && nowLinked) await adjustStock(tenantId, line.inventory_item_id, -rec, `Asignada a la orden ${line.linked_work_order_number}`, by);
    else await adjustStock(tenantId, line.inventory_item_id, rec, "Desvinculada de orden de trabajo", by);
  }
  const poLineKey = (l) => `po-line:${l.id}`;
  if (prevOrderId && prevOrderId !== line.linked_work_order_id) await removeLinkedEntry(prevOrderId, poLineKey(line));
  if (nowLinked) await syncItemsToLinkedWorkOrders([line], { lineKey: poLineKey });
  return data;
}

export async function receivePO({ tenantId, poId, received, location, by, tenant }) {
  const fresh = await fetchPO(poId);
  if (!fresh) throw new Error("Purchase order ya no existe");
  if (fresh.status === "cancelled") throw new Error("Esta compra está cancelada; no se puede recibir.");
  const lines = lineItems(fresh).map((l) => ({ ...l }));
  const gaveta = String(location || "").trim().toUpperCase();
  const applied = lines.map((l) => ({ line: l, qty: Math.min(linePending(l), Math.max(0, num(received?.[l.id]))) }));
  if (!applied.some((a) => a.qty > 0 && !isTool(a.line))) throw new Error("Indica al menos una cantidad recibida.");
  const failed = new Set();
  let stocked = 0;
  for (const { line, qty } of applied) {
    if (qty <= 0 || isTool(line)) continue;
    const hasWO = !!line.linked_work_order_id;
    if (!line.inventory_item_id) {
      if (hasWO) continue;
      const prod = { tenant_id: tenantId, name: line.product_name, type: "product", tipo_principal: "dispositivos", subcategoria: "piezas_servicios", price: Math.max(0, num(line.unit_price)), cost: num(line.unit_cost), active: true, taxable: true, stock: qty };
      if (gaveta) { prod.location = gaveta; line.location = gaveta; }
      if (fresh.supplier_id) prod.supplier_id = fresh.supplier_id;
      const { data: created, error } = await supabase.from("product").insert(prod).select("id").single();
      if (error || !created) { failed.add(line.id); continue; }
      line.inventory_item_id = created.id;
      stocked += 1;
      supabase.from("inventory_movement").insert({ tenant_id: tenantId, product_id: created.id, movement_type: "purchase", quantity: qty, previous_stock: 0, new_stock: qty, unit_cost: num(line.unit_cost), total_amount: r2(qty * num(line.unit_cost)), reference_type: "purchase_order", reference_id: fresh.id, reference_number: fresh.po_number, performed_by: by || "Web" }).then(() => {}, () => {});
      continue;
    }
    const { data: prod, error: selErr } = await supabase.from("product").select("id,stock,cost").eq("id", line.inventory_item_id).maybeSingle();
    if (selErr || !prod) { failed.add(line.id); continue; }
    const patch = {};
    if (num(line.unit_cost) > 0 && Math.abs(num(line.unit_cost) - num(prod.cost)) > 0.001) patch.cost = num(line.unit_cost);
    const res = await adjustStockAtomic({ id: prod.id, delta: hasWO ? 0 : qty, floor: false, extra: patch });
    if (!res.ok) { failed.add(line.id); continue; }
    const before = res.before;
    const after = res.after;
    if (!hasWO) stocked += 1;
    supabase.from("inventory_movement").insert({ tenant_id: tenantId, product_id: prod.id, movement_type: "purchase", quantity: qty, previous_stock: before, new_stock: after, unit_cost: num(line.unit_cost), total_amount: r2(qty * num(line.unit_cost)), reference_type: "purchase_order", reference_id: fresh.id, reference_number: fresh.po_number, performed_by: by || "Web" }).then(() => {}, () => {});
  }

  let expense = 0;
  if (!paidMarker(fresh) && num(fresh.total_amount) > 0) {
    const { data: ex } = await supabase.from("transaction").select("id").eq("order_id", fresh.id).eq("type", "expense").eq("is_deleted", false).limit(1);
    if (!(ex || []).length) {
      const { error } = await supabase.from("transaction").insert({ tenant_id: tenantId, type: "expense", category: "parts", amount: num(fresh.total_amount), description: `Compra a ${fresh.supplier_name || ""} (PO ${fresh.po_number})`, recorded_by: by || "Web", payment_method: "cash", order_id: fresh.id });
      if (!error) expense = num(fresh.total_amount);
    }
  }

  const merged = lines.map((l) => {
    const a = applied.find((x) => x.line.id === l.id);
    const add = a && !failed.has(l.id) ? a.qty : 0;
    return { ...l, received_quantity: Math.min(lineQty(l), lineReceived(l) + add) };
  });
  const allDone = merged.length > 0 && merged.every((l) => lineReceived(l) >= lineQty(l));
  const patch = { status: allDone ? "received" : "partial", received_date: prDay(), received_by_name: by || null, line_items: merged, notes: allDone && !hasStocked(fresh) ? `${String(fresh.notes || "")} [STOCKED]`.trim() : fresh.notes, updated_at: new Date().toISOString() };
  const { data: updated, error: upErr } = await supabase.from("purchase_order").update(patch).eq("id", fresh.id).select("*").single();
  if (upErr) throw upErr;

  const woIds = [...new Set(applied.filter((x) => x.qty > 0 && !isTool(x.line) && x.line.linked_work_order_id).map((x) => x.line.linked_work_order_id))];
  let notified = 0;
  if (woIds.length) {
    const { data: orders } = await supabase.from("order").select("*").in("id", woIds);
    for (const o of orders || []) {
      if (!["waiting_parts", "pending_order", "reparacion_externa"].includes(o.status)) continue;
      try {
        await changeStatusRpc(o.id, "part_arrived_waiting_device", `Web · ${by || "Usuario"}`, true);
        notified += 1;
        if (String(o.customer_email || "").trim() && tenant) sendStatusEmail({ order: { ...o, status: "part_arrived_waiting_device" }, tenant, status: "part_arrived_waiting_device" }).catch(() => {});
      } catch {
        continue;
      }
    }
  }
  if (allDone) await supabase.from("part_link").update({ status: "received" }).eq("purchase_order_id", fresh.id);
  return { po: updated, stocked, expense, notified, failed: failed.size };
}

export async function receiveAllPending(tenantId, po, by, tenant) {
  const received = {};
  lineItems(po).forEach((l) => { received[l.id] = linePending(l); });
  return receivePO({ tenantId, poId: po.id, received, location: "", by, tenant });
}

export async function voidExpenses(tenantId, poId) {
  const { data, error } = await supabase.from("transaction").select("id").eq("tenant_id", tenantId).eq("order_id", poId).eq("type", "expense").eq("is_deleted", false).limit(10);
  if (error) throw error;
  for (const t of data || []) {
    const { error: e2 } = await supabase.from("transaction").update({ is_deleted: true }).eq("id", t.id);
    if (e2) throw e2;
  }
  return (data || []).length;
}

export async function cancelPO({ tenantId, po, by }) {
  if (po.status === "received" || po.status === "partial") {
    for (const l of lineItems(po)) {
      if (l.inventory_item_id && !isTool(l) && lineReceived(l) > 0 && !l.linked_work_order_id) await adjustStock(tenantId, l.inventory_item_id, -lineReceived(l), `Compra ${po.po_number} cancelada`, by);
    }
  }
  const { data, error } = await supabase.from("purchase_order").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", po.id).select("*").single();
  if (error) throw error;
  let voided = true;
  let removed = 0;
  try { removed = await voidExpenses(tenantId, po.id); } catch { voided = false; }
  return { po: data, voided, removed };
}

export async function savePOEdit({ tenantId, po, shipping, expected, tracking, notes }) {
  const ship = Math.max(0, r2(shipping));
  const sub = poSubtotal(po);
  const total = r2(sub + ship + num(po.tax_amount));
  const patch = { shipping_cost: ship, total_amount: total, notes: String(notes || "").trim() || null, tracking_number: String(tracking || "").trim() || null, expected_date: expected || null, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from("purchase_order").update(patch).eq("id", po.id).select("*").single();
  if (error) throw error;
  if (Math.abs(ship - num(po.shipping_cost)) > 0.004) {
    const { data: tx } = await supabase.from("transaction").select("id").eq("tenant_id", tenantId).eq("order_id", po.id).eq("type", "expense").eq("is_deleted", false).order("created_at", { ascending: false }).limit(1);
    if (tx?.[0]) await supabase.from("transaction").update({ amount: total }).eq("id", tx[0].id);
  }
  return data;
}

export function reorderPrefill(po) {
  return {
    supplierId: po.supplier_id || null,
    supplierName: po.supplier_name || "",
    lines: lineItems(po).map((l) => newLine({ ...l, id: undefined, quantity: lineQty(l), linked_work_order_id: null })),
  };
}

export async function fetchOpenDraft(tenantId, supplierId) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase.from("purchase_order").select("*").eq("tenant_id", tenantId).eq("supplier_id", supplierId).eq("status", "draft").gte("created_at", start.toISOString()).order("created_at", { ascending: false }).limit(1);
  return data?.[0] || null;
}

export async function dissolveStaleDrafts(tenantId) {
  const cutoff = new Date(Date.now() - 168 * 3600 * 1000).toISOString();
  const { data } = await supabase.from("purchase_order").select("id").eq("tenant_id", tenantId).eq("status", "draft").lt("created_at", cutoff).limit(50);
  for (const d of data || []) {
    await supabase.from("purchase_order").update({ status: "cancelled", notes: "Pedido sin enviar por más de 168h. Las piezas volvieron a Piezas por ordenar.", updated_at: new Date().toISOString() }).eq("id", d.id);
    await supabase.from("part_link").update({ purchase_order_id: null, status: "to_order" }).eq("purchase_order_id", d.id);
  }
}

export async function closeDraft({ tenantId, po, shipping, tax, method, confirmation, by }) {
  const current = await fetchPO(po.id);
  if (!current) throw new Error("Este pedido ya no existe.");
  if (current.status !== "draft") throw new Error("Este pedido ya no es un borrador. Recarga la lista.");
  const items = lineItems(current);
  const sub = r2(items.reduce((s, l) => s + lineTotal(l), 0));
  const ship = Math.max(0, r2(shipping));
  const tx = Math.max(0, r2(tax));
  const total = r2(sub + ship + tx);
  const poNumber = await nextPoNumber(tenantId);
  const patch = { po_number: poNumber, status: "ordered", subtotal: sub, shipping_cost: ship, tax_amount: tx, total_amount: total, updated_at: new Date().toISOString() };
  if (String(confirmation || "").trim()) patch.tracking_number = confirmation.trim();
  const { data: rows, error } = await supabase.from("purchase_order").update(patch).eq("id", po.id).eq("status", "draft").select("*");
  if (error) throw error;
  const data = rows?.[0];
  if (!data) throw new Error("Este pedido ya no es un borrador. Recarga la lista.");
  await syncItemsToLinkedWorkOrders(items, { lineKey: (l) => `po-line:${l.id}` });
  await supabase.from("part_link").update({ status: "ordered" }).eq("purchase_order_id", po.id);
  let expenseFailed = false;
  if (total > 0) {
    try { await recordExpense({ tenantId, po: data, supplierName: current.supplier_name, amount: total, method, by, settled: method !== "credit" }); } catch { expenseFailed = true; }
  }
  return { po: data, expenseFailed };
}

export async function addToOpenDraft({ tenantId, supplier, line, by, partLinkId }) {
  const draft = await fetchOpenDraft(tenantId, supplier.id);
  let po;
  if (draft) {
    const items = lineItems(draft).map((l) => ({ ...l }));
    const same = items.find((l) => (line.linked_work_order_id ? l.linked_work_order_id === line.linked_work_order_id : !l.linked_work_order_id) && (line.inventory_item_id ? l.inventory_item_id === line.inventory_item_id : !l.inventory_item_id && String(l.product_name).toLowerCase() === String(line.product_name).toLowerCase()));
    if (same) { same.quantity = lineQty(same) + lineQty(line); same.line_total = r2(lineQty(same) * num(same.unit_cost)); } else items.push(line);
    const sub = r2(items.reduce((s, l) => s + lineTotal(l), 0));
    const { data, error } = await supabase.from("purchase_order").update({ line_items: items, subtotal: sub, shipping_cost: 0, tax_amount: 0, total_amount: sub, updated_at: new Date().toISOString() }).eq("id", draft.id).select("*").single();
    if (error) throw error;
    po = data;
  } else {
    const sub = r2(lineTotal(line));
    const { data, error } = await supabase.from("purchase_order").insert({ tenant_id: tenantId, po_number: "BORRADOR", supplier_id: supplier.id, supplier_name: supplier.name, status: "draft", order_date: prDay(), line_items: [line], subtotal: sub, total_amount: sub, currency: "USD", created_by_name: by || null }).select("*").single();
    if (error) throw error;
    po = data;
  }
  if (partLinkId) await supabase.from("part_link").update({ purchase_order_id: po.id }).eq("id", partLinkId);
  return po;
}

export const STORES = {
  amazon: { label: "Amazon", color: "#FF9900" },
  ebay: { label: "eBay", color: "#0085FF" },
  aliexpress: { label: "AliExpress", color: "#E52929" },
  other: { label: "Otra tienda", color: "#8F8F94" },
};

export function storeOf(url, stored) {
  if (stored && STORES[stored]) return stored;
  const u = String(url || "").toLowerCase();
  if (u.includes("amazon.")) return "amazon";
  if (u.includes("ebay.")) return "ebay";
  if (u.includes("aliexpress.")) return "aliexpress";
  return "other";
}

export const PART_STATUS = {
  to_order: { label: "Por ordenar", color: "#FFD60A", next: "ordered" },
  ordered: { label: "Ordenada", color: "#30D158", next: "received" },
  received: { label: "Recibida", color: "#0A84FF", next: "to_order" },
};

export function partTitle(l) {
  const t = String(l.title || "").trim();
  return t || `${STORES[storeOf(l.url, l.store)].label} · pieza`;
}

export function safeUrl(url) {
  const u = String(url || "").trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export async function fetchPartLinks(tenantId) {
  const { data, error } = await supabase.from("part_link").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return (data || []).map((l) => ({ ...l, status: l.status || "to_order", store: storeOf(l.url, l.store) }));
}

export async function setPartLinkStatus(id, status) {
  const { error } = await supabase.from("part_link").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function reorderPartLink(tenantId, l) {
  const row = { tenant_id: tenantId, url: l.url, store: storeOf(l.url, l.store), status: "to_order" };
  if (l.order_id) row.order_id = l.order_id;
  if (l.order_number) row.order_number = l.order_number;
  if (l.title) row.title = l.title;
  if (l.price !== null && l.price !== undefined) row.price = l.price;
  if (l.cost !== null && l.cost !== undefined) row.cost = l.cost;
  const { error } = await supabase.from("part_link").insert(row);
  if (error) throw error;
}

export async function orderPartNow({ tenantId, link, by }) {
  if (link.purchase_order_id || link.status === "ordered" || link.status === "received") throw new Error("Esta pieza ya tiene un pedido.");
  const poNumber = await nextPoNumber(tenantId);
  const store = STORES[storeOf(link.url, link.store)].label;
  const cost = link.cost !== null && link.cost !== undefined ? num(link.cost) : link.price !== null && link.price !== undefined ? num(link.price) : 0;
  const unitPrice = link.price !== null && link.price !== undefined ? num(link.price) : cost;
  const line = newLine({ product_name: partTitle(link), quantity: 1, unit_cost: cost, unit_price: unitPrice, linked_work_order_id: link.order_id || null, linked_work_order_number: link.order_number || null });
  const notes = [`Pieza de ${store}`, link.order_number ? `Para la orden ${link.order_number}` : null, `Link: ${link.url}`].filter(Boolean).join(" · ");
  const { data: po, error } = await supabase.from("purchase_order").insert({ tenant_id: tenantId, po_number: poNumber, supplier_name: store, status: "ordered", order_date: prDay(), line_items: [line], subtotal: cost, total_amount: cost, currency: "USD", notes, invoice_link: link.url, created_by_name: by || null }).select("*").single();
  if (error) throw error;
  await syncItemsToLinkedWorkOrders([line], { sourcePartLinkId: link.id });
  let expenseFailed = false;
  if (cost > 0) { try { await recordExpense({ tenantId, po, supplierName: store, amount: cost, method: "cash", by, settled: true }); } catch { expenseFailed = true; } }
  let linkErr = null;
  for (let i = 0; i < 2 && (i === 0 || linkErr); i += 1) {
    const res = await supabase.from("part_link").update({ status: "ordered", purchase_order_id: po.id }).eq("id", link.id);
    linkErr = res.error;
  }
  return { po, expenseFailed, linkUpdateFailed: !!linkErr };
}
