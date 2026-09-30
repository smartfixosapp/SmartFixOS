import { supabase } from "../../../../lib/supabase-client.js";
import { normalizeTaxPercent } from "@/lib/taxRate";
import { partMatchContext, scorePart, fuzzyPartMatches, searchProducts, isServiceItem, isFullDeviceItem } from "@/lib/wizard/helpers";
import {
  num, r2, uuid, fetchSuppliers, fetchOpenDraft, addToOpenDraft, dissolveStaleDrafts, orderPartNow, newLine, lineItems,
} from "@/lib/comprasApi";
import { changeStatusRpc } from "@/lib/orderDetailApi";

const nowISO = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

export const isDiscount = (l) => l?.type === "discount";
export const itemLines = (order) => (Array.isArray(order?.order_items) ? order.order_items : []).filter((l) => l && !isDiscount(l));
export const discountOf = (order) => (Array.isArray(order?.order_items) ? order.order_items : []).filter(isDiscount).reduce((s, l) => s + Math.abs(num(l.total)), 0);
export const lineTotalOf = (l) => num(l.total !== undefined && l.total !== null ? l.total : num(l.price) * num(l.quantity || 1));

export function taxModelOf(order, tenant) {
  const raw = order?.tax_rate;
  if (raw === null || raw === undefined || raw === "") {
    return { on: true, pct: r2(normalizeTaxPercent(tenant?.settings?.tax_rate)) };
  }
  const rate = num(raw);
  const frac = rate > 1 ? rate / 100 : rate;
  return frac > 0 ? { on: true, pct: r2(frac * 100) } : { on: false, pct: 0 };
}

export function moneyModel({ lines, labor, taxOn, taxPct, discount, credit }) {
  const itemsSubtotal = r2(lines.filter((l) => !isDiscount(l)).reduce((s, l) => s + lineTotalOf(l), 0));
  const rate = taxOn ? num(taxPct) / 100 : 0;
  const base = itemsSubtotal + num(labor);
  const tax = r2(base * rate);
  const grand = Math.max(0, r2(base + tax - num(discount)));
  const balance = r2(grand - credit);
  return { itemsSubtotal, tax, grand, balance, rate };
}

export async function paymentsTotal(orderId) {
  const { data } = await supabase.from("transaction").select("amount,type").eq("order_id", orderId).in("type", ["revenue", "refund"]).eq("is_deleted", false).limit(200);
  const rows = data || [];
  const rev = rows.filter((t) => t.type === "revenue").reduce((s, t) => s + Math.abs(num(t.amount)), 0);
  const ref = rows.filter((t) => t.type === "refund").reduce((s, t) => s + Math.abs(num(t.amount)), 0);
  return Math.max(0, r2(rev - ref));
}

export async function stockDiff({ tenantId, before, after, orderNumber, by }) {
  const qty = (list) => { const m = {}; list.filter((l) => l.type === "part" && l.id).forEach((l) => { m[l.id] = (m[l.id] || 0) + num(l.quantity); }); return m; };
  const b = qty(before);
  const a = qty(after);
  const ids = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  for (const id of ids) {
    const delta = (a[id] || 0) - (b[id] || 0);
    if (!delta) continue;
    const { data: prod } = await supabase.from("product").select("id,name,type,stock").eq("id", id).maybeSingle();
    if (!prod || prod.type === "service" || prod.stock === null || prod.stock === undefined) continue;
    const old = num(prod.stock);
    const next = Math.max(0, old - delta);
    const { error } = await supabase.from("product").update({ stock: next }).eq("id", id);
    if (error) continue;
    supabase.from("transaction").insert({ tenant_id: tenantId, type: "stock_adjustment", category: delta < 0 ? "stock_in" : "stock_out", amount: Math.abs(next - old), description: `[${prod.name}] Piezas en orden ${orderNumber}`, recorded_by: by || "Web" }).then(() => {}, () => {});
  }
}

export async function persistAll({ order, tenantId, lines, labor, taxOn, taxPct, discount, credit, by }) {
  const { data: cur, error: curErr } = await supabase.from("order").select("order_items").eq("id", order.id).maybeSingle();
  if (curErr) throw curErr;
  const beforeLines = (Array.isArray(cur?.order_items) ? cur.order_items : []).filter((l) => l && !isDiscount(l));
  const clean = lines.filter((l) => !isDiscount(l));
  const d = Math.max(0, r2(discount));
  const items = d > 0 ? [...clean, { id: `discount-${Math.random().toString(36).slice(2, 10)}`, type: "discount", name: "Descuento", quantity: 1, price: -d, total: -d }] : clean;
  const m = moneyModel({ lines: clean, labor, taxOn, taxPct, discount: d, credit });
  const fields = {
    order_items: items, labor_cost: r2(labor), tax_rate: taxOn ? r2(num(taxPct)) / 100 : 0, cost_estimate: m.grand, balance_due: Math.max(0, r2(m.grand - credit)),
    paid: credit >= m.grand - 0.01 && m.grand > 0, updated_date: nowISO(),
  };
  const { error } = await supabase.from("order").update(fields).eq("id", order.id);
  if (error) throw error;
  await stockDiff({ tenantId, before: beforeLines, after: clean, orderNumber: order.order_number, by });
  return { ...order, ...fields };
}

export async function addItems({ order, tenantId, pending, by }) {
  const { data: fresh, error } = await supabase.from("order").select("order_items,tax_rate,labor_cost,amount_paid").eq("id", order.id).maybeSingle();
  if (error || !fresh) throw error || new Error("No se encontró la orden");
  const before = Array.isArray(fresh.order_items) ? fresh.order_items : [];
  let items = [...before];
  let manualCost = 0;
  pending.forEach((p) => {
    const qty = Math.max(1, Math.trunc(num(p.quantity)));
    const price = num(p.price);
    if (p.kind === "catalog") {
      const idx = items.findIndex((x) => x.type === "part" && x.id === p.product.id);
      if (idx >= 0) {
        const cur = items[idx];
        items[idx] = { ...cur, quantity: num(cur.quantity) + qty, total: r2(num(cur.total) + qty * price) };
      } else items.push({ id: p.product.id, type: "part", name: p.product.name, quantity: qty, price, total: r2(qty * price) });
    } else if (p.kind === "manual-part") {
      items.push({ id: uuid(), type: "manual", name: p.name, quantity: qty, price, cost: num(p.cost), total: r2(qty * price) });
      manualCost += qty * num(p.cost);
    } else {
      items.push({ id: uuid(), type: "service", name: p.name, quantity: 1, price, total: r2(price) });
    }
  });
  let taxRate = num(fresh.tax_rate);
  if (taxRate > 1) taxRate /= 100;
  const subtotal = items.filter((x) => !isDiscount(x)).reduce((s, x) => s + num(x.total), 0) + num(fresh.labor_cost);
  const discounts = items.filter(isDiscount).reduce((s, x) => s + Math.abs(num(x.total)), 0);
  const total = Math.max(0, r2(subtotal * (1 + taxRate) - discounts));
  const { error: upErr } = await supabase.from("order").update({ order_items: items, cost_estimate: total, balance_due: Math.max(0, r2(total - num(fresh.amount_paid))), updated_date: nowISO() }).eq("id", order.id);
  if (upErr) throw upErr;
  if (manualCost > 0) {
    const row = { tenant_id: tenantId, type: "expense", category: "parts", amount: r2(manualCost), description: `Piezas manuales · Orden ${order.order_number}`, payment_method: "cash", recorded_by: by || "Web", order_id: order.id, is_settled: true };
    for (let i = 0; i < 3; i += 1) {
      const { error: e2 } = await supabase.from("transaction").insert(row);
      if (!e2) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  await stockDiff({ tenantId, before, after: items.filter((x) => !isDiscount(x)), orderNumber: order.order_number, by });
}

export async function fetchProductsByIds(tenantId, ids) {
  if (!ids.length) return {};
  const { data } = await supabase.from("product").select("*").eq("tenant_id", tenantId).in("id", ids).limit(200);
  const out = {};
  (data || []).forEach((p) => { out[p.id] = p; });
  return out;
}

export async function fetchOrderPartLinks(tenantId, orderId) {
  const { data, error } = await supabase.from("part_link").select("*").eq("tenant_id", tenantId).eq("order_id", orderId).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function updatePartLink(id, { url, title, cost, price }) {
  const u = String(url || "").trim();
  const store = /amazon\./i.test(u) ? "amazon" : /ebay\./i.test(u) ? "ebay" : /aliexpress\./i.test(u) ? "aliexpress" : "other";
  const nn = (v) => (v === "" || v === null || v === undefined || !Number.isFinite(num(v)) ? null : num(v));
  const { error } = await supabase.from("part_link").update({ url: u, store, title: String(title || "").trim() || null, cost: nn(cost), price: nn(price) }).eq("id", id);
  if (error) throw error;
}

export async function deletePartLink(id) {
  const { error } = await supabase.from("part_link").delete().eq("id", id);
  if (error) throw error;
}

export async function setLinkStatus(id, status) {
  const { error } = await supabase.from("part_link").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function fetchLinkedPurchaseCosts(tenantId, orderId) {
  const { data, error } = await supabase.from("purchase_order").select("*").eq("tenant_id", tenantId).neq("status", "cancelled").order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const entries = [];
  (data || []).forEach((po) => {
    lineItems(po).forEach((l) => { if (l.linked_work_order_id === orderId) entries.push({ po, line: l }); });
  });
  return entries;
}

export async function openDraftsForOrder(tenantId, orderId) {
  await dissolveStaleDrafts(tenantId).catch(() => {});
  const suppliers = await fetchSuppliers(tenantId).catch(() => []);
  const out = [];
  for (const s of suppliers) {
    const d = await fetchOpenDraft(tenantId, s.id).catch(() => null);
    if (d && lineItems(d).some((l) => l.linked_work_order_id === orderId)) out.push(d);
  }
  return out;
}

export async function moveToWaitingParts(order, by) {
  if (order.status === "waiting_parts") return false;
  await changeStatusRpc(order.id, "waiting_parts", by || "Web", true);
  return true;
}

export async function orderLinkNow({ tenantId, link, by, order }) {
  const res = await orderPartNow({ tenantId, link: { ...link, order_id: order.id, order_number: order.order_number }, by });
  const moved = await moveToWaitingParts(order, by).catch(() => false);
  return { ...res, moved };
}

export async function addLinkToDraft({ tenantId, supplier, link, order, by }) {
  const cost = link.cost !== null && link.cost !== undefined ? num(link.cost) : link.price !== null && link.price !== undefined ? num(link.price) : 0;
  const price = link.price !== null && link.price !== undefined ? num(link.price) : cost;
  const line = newLine({ product_name: String(link.title || "").trim() || "Pieza", quantity: 1, unit_cost: cost, unit_price: price, linked_work_order_id: order.id, linked_work_order_number: order.order_number });
  const po = await addToOpenDraft({ tenantId, supplier, line, by, partLinkId: link.id });
  const moved = await moveToWaitingParts(order, by).catch(() => false);
  return { po, moved };
}

const norm = (s) => String(s || "").trim().toLowerCase();
export const isAccessory = (p) => norm(p.tipo_principal) === "accesorios" || norm(p.type) === "accessory";
export const stockOf = (p) => (p.stock === null || p.stock === undefined || p.stock === "" ? null : num(p.stock));
export const inStock = (p) => { const s = stockOf(p); return s !== null && s > 0; };

export function deviceContext(order) {
  let type = norm(order?.device_type);
  if (type === "temporary" || type.startsWith("desbloqueo") || type.startsWith("bloqueado")) type = "";
  const brand = norm(order?.device_brand);
  const family = norm(order?.device_family);
  let model = norm(order?.device_model);
  if (model.startsWith("temporal:")) model = "";
  return { category: type, brand, family, model, has: !!(brand || family || model) };
}

const hasTag = (p) => !!(String(p.device_model_tag || "") || String(p.device_family || "") || String(p.device_category || "") || String(p.device_brand || ""));

export function rankParts(products, order) {
  const ctx = deviceContext(order);
  const parts = products.filter((p) => !isServiceItem(p) && !isAccessory(p) && !isFullDeviceItem(p));
  const stockFirst = (a, b) => (inStock(b) ? 1 : 0) - (inStock(a) ? 1 : 0) || String(a.name).localeCompare(String(b.name));
  if (!ctx.has) return { matched: [], rest: [...parts].sort(stockFirst) };
  const pctx = partMatchContext(ctx);
  const scored = [];
  const seen = new Set();
  parts.forEach((p) => { const s = scorePart(p, pctx); if (s > 0) { scored.push({ p, s: s + (inStock(p) ? 10 : 0) }); seen.add(p.id); } });
  fuzzyPartMatches(pctx, parts.filter((p) => !seen.has(p.id)), 24).forEach((m) => { scored.push({ p: m.product, s: m.score * 50 + (inStock(m.product) ? 10 : 0) }); seen.add(m.product.id); });
  scored.sort((a, b) => b.s - a.s);
  const generic = parts.filter((p) => !seen.has(p.id) && !hasTag(p)).sort(stockFirst);
  return { matched: scored.map((x) => x.p), rest: generic };
}

export function rankServices(products, order) {
  const ctx = deviceContext(order);
  const services = products.filter((p) => isServiceItem(p));
  if (!ctx.has) return { matched: [], rest: services.sort((a, b) => String(a.name).localeCompare(String(b.name))) };
  const score = (p) => {
    const text = norm([p.name, p.category, p.device_category, p.description, p.subcategoria].join(" "));
    let s = 0;
    if (ctx.brand && text.includes(ctx.brand)) s += 40;
    if (ctx.category && text.includes(ctx.category)) s += 30;
    if (ctx.family && text.includes(ctx.family)) s += 20;
    return s;
  };
  const scored = services.map((p) => ({ p, s: score(p) }));
  return { matched: scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.p), rest: scored.filter((x) => x.s === 0).map((x) => x.p).sort((a, b) => String(a.name).localeCompare(String(b.name))) };
}

export function filterProducts(list, q) {
  return searchProducts(list, q);
}

export async function createInventoryProduct({ tenantId, order, name, service, price, cost, stock, sku, location, category, photoUrl }) {
  const ctx = deviceContext(order);
  const row = {
    tenant_id: tenantId, name, type: service ? "service" : "product", tipo_principal: service ? "servicios" : "dispositivos", subcategoria: "piezas_servicios", price, cost: service ? 0 : cost, active: true, taxable: true,
  };
  if (!service) row.stock = stock;
  if (String(sku || "").trim()) row.sku = sku.trim();
  if (String(location || "").trim()) row.location = location.trim();
  if (category) row.category = category;
  if (service) row.part_type = "servicio";
  if (photoUrl) { row.photo_urls = [photoUrl]; row.image_url = photoUrl; }
  if (ctx.has) {
    if (order.device_type && ctx.category) row.device_category = order.device_type;
    if (order.device_brand) row.device_brand = order.device_brand;
    if (order.device_family) row.device_family = order.device_family;
    if (order.device_model && ctx.model) row.device_model_tag = order.device_model;
  }
  const { data, error } = await supabase.from("product").insert(row).select("*").single();
  if (error) throw error;
  return data;
}

export async function resizeImage(file, max, quality) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la foto"))), "image/jpeg", quality));
}

export async function uploadProductPhoto(tenantId, file) {
  const id = uuid();
  const full = await resizeImage(file, 1800, 0.82);
  const thumb = await resizeImage(file, 480, 0.6);
  const bucket = supabase.storage.from("products");
  const { error } = await bucket.upload(`${tenantId}/${id}.jpg`, full, { contentType: "image/jpeg" });
  if (error) throw error;
  await bucket.upload(`${tenantId}/${id}_thumb.jpg`, thumb, { contentType: "image/jpeg" }).catch(() => {});
  return bucket.getPublicUrl(`${tenantId}/${id}.jpg`).data.publicUrl;
}

