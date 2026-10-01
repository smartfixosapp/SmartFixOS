import { supabase } from "../../../../../lib/supabase-client.js";
import { sendStatusEmail } from "@/lib/orderEmails";
import { addInternalNote } from "@/lib/orderDetailApi";
import { newLine, addToOpenDraft } from "@/lib/comprasApi";
import {
  naturalCompare, newUUID, nowISONoFrac, cartTotals, willDeductStock, isServiceItem, IVU, LIQUID_ADVISORY, sanitizeEmail, isValidEmail,
} from "./helpers";

async function pageAll(build, max = 5000, page = 1000) {
  const out = [];
  for (let off = 0; off < max; off += page) {
    const { data, error } = await build().range(off, Math.min(off + page, max) - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function loadCatalog(tenantId) {
  const [categories, brands, families, models, photos] = await Promise.all([
    supabase.from("device_category").select("*").order("name", { ascending: true }).limit(200).then(({ data, error }) => { if (error) throw error; return data || []; }),
    pageAll(() => supabase.from("brand").select("*").order("name", { ascending: true }), 500, 500),
    pageAll(() => supabase.from("device_family").select("*").order("name", { ascending: true }), 1000),
    pageAll(() => supabase.from("device_model").select("*").order("name", { ascending: true }), 2000),
    pageAll(() => supabase.from("device_model_photo").select("model_id,image_url").eq("tenant_id", tenantId), 5000).catch(() => []),
  ]);
  families.sort((a, b) => naturalCompare(b.name, a.name));
  models.sort((a, b) => naturalCompare(b.name, a.name));
  const photoByModel = {};
  photos.forEach((p) => { if (p.model_id && p.image_url) photoByModel[p.model_id] = p.image_url; });
  return { categories, brands, families, models, photoByModel };
}

export function buildSearchIndex(cat) {
  const famById = new Map(cat.families.map((f) => [f.id, f]));
  const brandById = new Map(cat.brands.map((b) => [b.id, b]));
  const catById = new Map(cat.categories.map((c) => [c.id, c]));
  const rows = [];
  cat.models.forEach((model) => {
    const fam = famById.get(model.family_id);
    const brand = fam && brandById.get(fam.brand_id);
    const category = brand && catById.get(brand.category_id);
    if (!fam || !brand || !category) return;
    const haystack = `${brand.name} ${fam.name} ${model.name}`.toLowerCase();
    rows.push({ match: { model, family: fam, brand, category }, haystack, compact: haystack.replace(/[\s-]/g, "") });
  });
  return rows;
}

export function searchModels(index, query) {
  const clean = String(query || "").toLowerCase().trim();
  if (!clean) return [];
  const terms = clean.split(/\s+/).filter(Boolean);
  const compact = clean.replace(/[\s-]/g, "");
  const scored = [];
  index.forEach((row) => {
    const name = String(row.match.model.name || "").toLowerCase();
    let score;
    if (name === clean) score = 0;
    else if (name.startsWith(clean)) score = 1;
    else if (terms.every((t) => row.haystack.includes(t))) score = 2;
    else if (compact && row.compact.includes(compact)) score = 3;
    else return;
    scored.push([score, row]);
  });
  return scored.sort((a, b) => (a[0] !== b[0] ? a[0] - b[0] : naturalCompare(a[1].match.model.name, b[1].match.model.name))).slice(0, 30).map((x) => x[1].match);
}

export async function loadDeviceChips(tenantId, customerId, index) {
  if (!index.length) return [];
  const { data } = await supabase.from("order").select("customer_id,device_model").eq("tenant_id", tenantId).eq("is_deleted", false).order("created_at", { ascending: false }).limit(200);
  const rows = data || [];
  const byName = new Map();
  index.forEach((r) => byName.set(String(r.match.model.name).toLowerCase(), r.match));
  const chips = [];
  const seen = new Set();
  const add = (name, fromCustomer) => {
    const key = String(name || "").trim().toLowerCase();
    if (!key || seen.has(key)) return;
    const m = byName.get(key);
    if (!m) return;
    seen.add(key);
    chips.push({ match: m, fromCustomer });
  };
  if (customerId) {
    for (const r of rows) {
      if (r.customer_id !== customerId) continue;
      add(r.device_model, true);
      if (chips.length >= 3) break;
    }
  }
  const counts = {};
  rows.forEach((r) => { const n = String(r.device_model || "").trim(); if (n) counts[n] = (counts[n] || 0) + 1; });
  for (const [name] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    add(name, false);
    if (chips.length >= 10) break;
  }
  return chips;
}

async function insertOne(table, body) {
  const { data, error } = await supabase.from(table).insert(body).select("*").single();
  if (error) throw error;
  return data;
}

export const createCategory = (name) => insertOne("device_category", { name: name.trim() });
export const createBrand = (name, categoryId, tenantId) => insertOne("brand", { name: name.trim(), category_id: categoryId, ...(tenantId ? { tenant_id: tenantId } : {}) });
export const createFamily = (name, brandId, tenantId) => insertOne("device_family", { name: name.trim(), brand_id: brandId, ...(tenantId ? { tenant_id: tenantId } : {}) });
export const createModel = (name, familyId, tenantId) => insertOne("device_model", { name: name.trim(), family_id: familyId, ...(tenantId ? { tenant_id: tenantId } : {}) });

const sanitizeIlike = (s) => s.replace(/,/g, " ").replace(/\(/g, " ").replace(/\)/g, " ");

export async function searchCustomers(tenantId, query) {
  const trimmed = String(query || "").trim();
  if (!trimmed) return [];
  const q = sanitizeIlike(trimmed.toLowerCase());
  const parts = [`name.ilike.%${q}%`, `phone.ilike.%${q}%`, `email.ilike.%${q}%`];
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 4) parts.push(`phone.ilike.%${digits.split("").join("%")}%`);
  const { data, error } = await supabase.from("customer").select("*").eq("tenant_id", tenantId).or(parts.join(",")).order("name", { ascending: true }).limit(50);
  if (error) throw error;
  return data || [];
}

export async function recentCustomers(tenantId) {
  const { data } = await supabase.from("order").select("customer_id").eq("tenant_id", tenantId).eq("is_deleted", false).order("created_at", { ascending: false }).limit(60);
  const ids = [];
  (data || []).forEach((r) => { if (r.customer_id && !ids.includes(r.customer_id) && ids.length < 8) ids.push(r.customer_id); });
  if (!ids.length) return [];
  const { data: cs } = await supabase.from("customer").select("*").in("id", ids);
  const byId = new Map((cs || []).map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export async function fetchCustomerById(id) {
  const { data } = await supabase.from("customer").select("*").eq("id", id).limit(1);
  return data?.[0] || null;
}

export async function findDuplicateByPhone(tenantId, phone) {
  const normalized = String(phone || "").replace(/\D/g, "");
  if (!normalized) return null;
  const { data, error } = await supabase.from("customer").select("*").eq("tenant_id", tenantId).ilike("phone", `%${normalized.split("").join("%")}%`).limit(20);
  if (error) throw error;
  return (data || []).find((c) => String(c.phone || "").replace(/\D/g, "") === normalized) || null;
}

export class InvalidEmailError extends Error {
  constructor() { super("El correo electrónico no es válido. Usa solo letras inglesas, números y símbolos básicos (sin acentos)."); }
}

export async function insertCustomer(tenantId, nc) {
  const email = sanitizeEmail(nc.email);
  if (email && !isValidEmail(email)) throw new InvalidEmailError();
  const fullName = [nc.name.trim(), nc.lastName.trim()].filter(Boolean).join(" ");
  const payload = { name: fullName, tenant_id: tenantId, preferred_language: nc.language || "es", risk_flag: false };
  if (nc.phone) payload.phone = nc.phone;
  if (email) payload.email = email;
  if (nc.notes) payload.notes = nc.notes;
  if (nc.isB2b) {
    payload.is_b2b = true;
    if (nc.companyName) payload.company_name = nc.companyName;
    payload.tax_id = nc.taxId ? nc.taxId : null;
    payload.billing_email = nc.billingEmail ? nc.billingEmail : null;
  }
  if (nc.hasSecondary) {
    if (nc.secondaryPhone) payload.secondary_phone = nc.secondaryPhone;
    if (nc.secondaryEmail) payload.secondary_email = nc.secondaryEmail;
  }
  return insertOne("customer", payload);
}

export function normalizedRoles(e) {
  const list = Array.isArray(e?.roles) && e.roles.length ? e.roles : e?.role ? [e.role] : ["technician"];
  return list.map((r) => String(r).toLowerCase());
}

export async function loadTechnicians(tenantId) {
  const { data, error } = await supabase.from("app_employee").select("*").eq("tenant_id", tenantId).order("full_name", { ascending: true }).limit(200);
  if (error) throw error;
  const eligible = (data || []).filter((e) => e.active !== false && normalizedRoles(e).includes("technician"));
  const { data: orders } = await supabase.from("order").select("assigned_to,status").eq("tenant_id", tenantId).eq("is_deleted", false).limit(1000);
  const counts = {};
  (orders || []).forEach((o) => { if (o.assigned_to && o.status !== "delivered" && o.status !== "cancelled") counts[o.assigned_to] = (counts[o.assigned_to] || 0) + 1; });
  return { employees: eligible, counts };
}

export async function loadProducts(tenantId) {
  return pageAll(() => supabase.from("product").select("*").eq("tenant_id", tenantId).eq("active", true).order("name", { ascending: true }), 5000);
}

export async function loadSupplierData(tenantId, productId) {
  const [{ data: sup }, { data: pos }] = await Promise.all([
    supabase.from("supplier").select("*").eq("tenant_id", tenantId).order("name", { ascending: true }).limit(100),
    supabase.from("purchase_order").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(300),
  ]);
  const suppliers = (sup || []).filter((s) => s.active !== false);
  const counts = {};
  const lastCost = {};
  let incoming = 0;
  let lastSupplierKey = null;
  (pos || []).forEach((po) => {
    const lines = Array.isArray(po.line_items) ? po.line_items : [];
    const mine = lines.filter((l) => l?.inventory_item_id === productId);
    if (!mine.length) return;
    const key = po.supplier_id || po.supplier_name || "";
    if (key) {
      counts[key] = (counts[key] || 0) + 1;
      const uc = mine.map((l) => Number(l.unit_cost) || 0).find((c) => c > 0);
      if (lastCost[key] === undefined && uc !== undefined) lastCost[key] = uc;
      if (!lastSupplierKey) lastSupplierKey = key;
    }
    if (po.status === "ordered" || po.status === "partial") mine.forEach((l) => { incoming += Math.max(0, (Number(l.quantity) || 0) - (Number(l.received_quantity) || 0)); });
  });
  return { suppliers, counts, lastCost, incoming, lastSupplierKey };
}

export async function predictPromisedDays(tenantId, familyName, fallbackDays) {
  const family = String(familyName || "").trim();
  if (!family || !tenantId) return { days: fallbackDays, samples: 0 };
  const { data } = await supabase.from("order").select("created_date,updated_date").eq("tenant_id", tenantId).eq("status", "delivered").eq("device_family", family).eq("is_deleted", false).order("updated_date", { ascending: false }).limit(30);
  const durations = [];
  (data || []).forEach((r) => {
    const c = r.created_date ? new Date(r.created_date) : null;
    const u = r.updated_date ? new Date(r.updated_date) : null;
    if (!c || !u || Number.isNaN(c.getTime()) || Number.isNaN(u.getTime())) return;
    const d = (u - c) / 86400000;
    if (d > 0 && d < 30) durations.push(d);
  });
  if (durations.length >= 3) return { days: Math.max(1, Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)), samples: durations.length };
  return { days: fallbackDays, samples: 0 };
}

export async function searchOrdersForWarranty(tenantId) {
  const { data, error } = await supabase.from("order").select("*").eq("tenant_id", tenantId).eq("is_deleted", false).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

async function nextOrderNumber(tenantId) {
  const { data, error } = await supabase.rpc("next_order_number", { p_tenant_id: tenantId });
  if (!error && data) return typeof data === "string" ? data : String(data);
  const { data: rows } = await supabase.from("order").select("order_number").eq("tenant_id", tenantId).not("order_number", "is", null).order("created_date", { ascending: false }).limit(500);
  const max = (rows || []).map((r) => parseInt(String(r.order_number).split("-").pop(), 10)).filter((n) => Number.isFinite(n)).reduce((m, n) => Math.max(m, n), 0);
  return `WO-${max + 1}`;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export async function resizeJpeg(file, maxDim, quality) {
  const img = await loadImage(file);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", quality));
}

const thumbPath = (p) => { const i = p.lastIndexOf("."); return i < 0 ? `${p}_thumb` : `${p.slice(0, i)}_thumb${p.slice(i)}`; };

async function uploadJpegWithThumb(bucketName, path, file) {
  const bucket = supabase.storage.from(bucketName);
  const main = await resizeJpeg(file, 1800, bucketName === "products" ? 0.85 : 0.82);
  const { error } = await bucket.upload(path, main, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  resizeJpeg(file, 480, 0.6).then((small) => bucket.upload(thumbPath(path), small, { contentType: "image/jpeg", upsert: true })).catch(() => {});
  return bucket.getPublicUrl(path).data.publicUrl;
}

export function warmUpload(tenantId, file) {
  return uploadJpegWithThumb("uploads", `tenants/${tenantId}/wizard-tmp/${newUUID()}.jpg`, file);
}

export async function saveModelPhoto(tenantId, modelId, file) {
  const url = await uploadJpegWithThumb("products", `${tenantId}/models/${newUUID()}.jpg`, file);
  const { error } = await supabase.from("device_model_photo").upsert({ tenant_id: tenantId, model_id: modelId, image_url: url, updated_at: nowISONoFrac() });
  if (error) throw error;
  return url;
}

async function uploadSignature(tenantId, orderNumber, blob) {
  const path = `tenants/${tenantId}/orders/${orderNumber}/signature.png`;
  const bucket = supabase.storage.from("uploads");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { error } = await bucket.upload(path, blob, { contentType: "image/png", upsert: false });
    if (!error) return bucket.getPublicUrl(path).data.publicUrl;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 400));
  }
  return null;
}

async function adjustStock(line, orderNumber, by, tenantId) {
  const p = line.product;
  const current = Number(p.stock) || 0;
  const next = Math.max(0, current - line.quantity);
  const { error } = await supabase.from("product").update({ stock: next }).eq("id", p.id);
  if (error) throw error;
  await supabase.from("transaction").insert({ tenant_id: tenantId, type: "stock_adjustment", category: "stock_out", amount: Math.abs(next - current), description: `[${p.name}] Usada en la orden ${orderNumber}`, recorded_by: by });
}

function prDateParts() {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Puerto_Rico", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m, d] = f.split("-");
  return { ymd: `${y}-${m}-${d}`, yymmdd: `${y.slice(2)}${m}${d}` };
}

async function nextPONumber(tenantId) {
  const { yymmdd } = prDateParts();
  const { data, error } = await supabase.rpc("next_po_number", { p_tenant_id: tenantId, p_date_part: yymmdd });
  if (!error && data) return String(data);
  const prefix = `PO-${yymmdd}`;
  const { data: rows } = await supabase.from("purchase_order").select("id").eq("tenant_id", tenantId).like("po_number", `${prefix}-%`).limit(999);
  return `${prefix}-${String((rows || []).length + 1).padStart(3, "0")}`;
}

async function addPartToSupplierDraft(pending, order, tenantId, createdByName) {
  if (!pending.supplierId) throw new Error("Falta el suplidor del pedido.");
  const line = newLine({
    inventory_item_id: pending.productId || null, product_name: pending.productName, quantity: pending.quantity, unit_cost: pending.unitCost, unit_price: pending.unitPrice,
    linked_work_order_id: order.id, linked_work_order_number: order.order_number,
  });
  return addToOpenDraft({ tenantId, supplier: { id: pending.supplierId, name: pending.supplierName }, line, by: createdByName });
}

async function createSupplierPO(pending, order, tenantId, createdByName) {
  const poNumber = await nextPONumber(tenantId);
  const total = pending.quantity * pending.unitCost;
  const po = await insertOne("purchase_order", {
    tenant_id: tenantId, po_number: poNumber, supplier_id: pending.supplierId || null, supplier_name: pending.supplierName, status: "ordered",
    order_date: prDateParts().ymd,
    line_items: [{
      id: newUUID(), inventory_item_id: pending.productId || null, product_name: pending.productName, quantity: pending.quantity, received_quantity: 0,
      unit_cost: pending.unitCost, unit_price: pending.unitPrice, tax_rate: 0, tax_amount: 0, line_total: total, is_tool: false,
      linked_work_order_id: order.id, linked_work_order_number: order.order_number, is_ai_imported: false,
    }],
    subtotal: total, tax_amount: 0, shipping_cost: 0, total_amount: total, currency: "USD",
    notes: `Pedida al crear la orden · Para la orden ${order.order_number}`, created_by_name: createdByName,
  });
  if (total > 0) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { error } = await supabase.from("transaction").insert({ tenant_id: tenantId, type: "expense", category: "parts", amount: total, description: `Orden compra ${po.po_number} · ${po.supplier_name || "Suplidor"}`, payment_method: "cash", recorded_by: createdByName || "Web", order_id: po.id, is_settled: true });
      if (!error) break;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 400));
    }
  }
  return po;
}

export async function createOrder({ s, tenantId, tenant, createdByName, onPhase, onBackgroundError }) {
  if (!tenantId) throw new Error("No se encontró el taller activo. Vuelve a iniciar sesión.");
  if (!s.customer && !s.anonymous && !String(s.nc?.name || "").trim()) throw new Error("Falta el cliente de la orden.");
  if (s.serviceType === "visit" && !String(s.appointmentLocation || "").trim()) throw new Error("Ingresa la dirección de la visita antes de crear la orden.");
  const photos = s.mode === "unlock" ? s.unlockPhotos : s.photos;
  onPhase(photos.length ? "Subiendo fotos..." : "Creando orden...");
  const orderNumber = await nextOrderNumber(tenantId);
  const photoTask = (async () => {
    if (!photos.length) return [];
    const cached = photos.map((p) => p.url).filter(Boolean);
    const pending = photos.filter((p) => !p.url);
    const bucket = supabase.storage.from("uploads");
    const results = await Promise.all(pending.map(async (p, i) => {
      try {
        const path = `tenants/${tenantId}/orders/${orderNumber}/photo_${i}_${newUUID()}.jpg`;
        const main = await resizeJpeg(p.file, 1800, 0.82);
        const { error } = await bucket.upload(path, main, { contentType: "image/jpeg", upsert: false });
        if (error) return null;
        resizeJpeg(p.file, 480, 0.6).then((small) => bucket.upload(thumbPath(path), small, { contentType: "image/jpeg", upsert: true })).catch(() => {});
        return bucket.getPublicUrl(path).data.publicUrl;
      } catch {
        return null;
      }
    }));
    return [...cached, ...results.filter(Boolean)];
  })();
  const sigTask = s.signatureBlob ? uploadSignature(tenantId, orderNumber, s.signatureBlob) : Promise.resolve(null);
  const photoURLs = await photoTask;
  onPhase(s.signatureBlob ? "Guardando firma..." : "Creando orden...");
  const signatureURL = await sigTask;
  onPhase("Creando orden...");
  if (s.signatureBlob && !signatureURL) throw new Error("No se pudo guardar la firma del cliente. La orden no se creó para no perder la autorización — revisa tu conexión e intenta de nuevo.");
  if (photos.length && !photoURLs.length) throw new Error("No se pudieron guardar las fotos del equipo. La orden no se creó para no perder la evidencia — revisa tu conexión e intenta de nuevo.");

  const customer = s.customer;
  const payload = {
    tenant_id: tenantId, order_number: orderNumber, customer_name: s.anonymous ? "Anónimo" : customer?.name || "", status: "intake",
    priority: s.highPriority ? "high" : "normal", created_by_name: createdByName || "Usuario", created_date: nowISONoFrac(), updated_date: nowISONoFrac(),
    is_quick_service: s.mode === "quick",
  };
  if (customer?.id) payload.customer_id = customer.id;
  if (customer?.phone) payload.customer_phone = customer.phone;
  if (customer?.email) payload.customer_email = customer.email;
  if (s.promisedDate) payload.promised_date = nowISONoFrac(s.promisedDate);
  if (s.mode === "unlock") {
    const digits = s.imei.replace(/\D/g, "");
    if (digits) payload.device_serial = digits;
    if (s.unlockBrand) payload.device_brand = s.unlockBrand;
    if (s.unlockModel) payload.device_model = s.unlockModel;
    const carrier = s.unlockCarrier.trim();
    payload.device_type = carrier ? `Bloqueado: ${carrier}` : "Desbloqueo";
    if (s.unlockType) payload.initial_problem = { blacklist: "Lista Negra", carrier_unlock: "Desbloqueo Carrier", imei_change: "Cambio de IMEI" }[s.unlockType];
  } else {
    if (s.category) payload.device_type = s.category.name;
    if (s.brand) payload.device_brand = s.brand.name;
    if (s.family) payload.device_family = s.family.name;
    const modelName = s.model?.name || (s.customModelText ? s.customModelText : null);
    if (modelName) payload.device_model = modelName;
    const imei = String(s.security.device_imei || "").trim();
    const serial = String(s.security.device_serial || "").trim();
    const combined = [imei, serial].filter(Boolean).join(" / ");
    if (combined) payload.device_serial = combined;
    const problem = s.problem.trim();
    if (problem) payload.initial_problem = problem;
  }
  const noteParts = [];
  if (s.mode === "quick") noteParts.push("[Quick]");
  if (s.mode === "recharge") {
    noteParts.push("[Recarga]");
    if (s.rechargePhone.trim()) noteParts.push(`Tel: ${s.rechargePhone.trim()}`);
    const carrier = (s.rechargeCarrier === "Otro" ? (s.rechargeCarrierOther || "") : s.rechargeCarrier).trim();
    if (carrier) noteParts.push(`Operadora: ${carrier}`);
  }
  if (s.mode === "unlock") {
    noteParts.push("[Desbloqueo]");
    if (s.unlockType) noteParts.push(`Tipo: ${{ blacklist: "Lista Negra", carrier_unlock: "Desbloqueo Carrier", imei_change: "Cambio de IMEI" }[s.unlockType]}`);
    if (s.unlockCarrier.trim()) noteParts.push(`Carrier: ${s.unlockCarrier.trim()}`);
  }
  const damaged = s.checklist.filter((c) => c.status === "damaged").map((c) => c.label);
  if (damaged.length) noteParts.push(`Dañados: ${damaged.join(", ")}`);
  if (noteParts.length) payload.status_note = noteParts.join(" · ");
  if (s.termsAccepted) payload.terms_accepted = true;
  if (s.liquidDamage) {
    payload.liquid_damage = true;
    const keys = [s.liquidCorrosion && "corrosion", s.liquidHumidity && "humidity_indicator", s.liquidDried && "customer_dried"].filter(Boolean);
    if (keys.length) payload.liquid_damage_indicators = keys;
  }
  if (photoURLs.length) payload.device_photos = photoURLs;
  const estimate = Number(String(s.estimateText).replace(",", ".")) || 0;
  if (s.cart.length) {
    payload.order_items = s.cart.map((l) => ({
      id: l.product.id || newUUID(),
      type: l.product.type === "service" ? "service" : willDeductStock(l) ? "part" : "product",
      name: l.product.name, quantity: l.quantity, price: l.unitPrice, total: l.unitPrice * l.quantity,
      ...(l.originalPrice !== undefined && l.originalPrice - l.unitPrice > 0.001 ? { original_price: l.originalPrice, offer_id: l.offerId || null, offer_label: l.offerLabel || null } : {}),
    }));
    if (estimate === 0) {
      payload.cost_estimate = cartTotals(s.cart).total;
      payload.tax_rate = IVU;
    }
  }
  const sec = {};
  const put = (k, v) => { if (v !== undefined && v !== null && String(v) !== "") sec[k] = v; };
  put("device_pin", s.security.device_pin);
  put("device_password", s.security.device_password);
  put("device_imei", s.security.device_imei);
  put("device_serial", s.security.device_serial);
  put("notes", s.security.notes);
  const pv = Array.isArray(s.security.pattern_vector) ? s.security.pattern_vector.map((n) => Math.trunc(Number(n))).filter((n) => Number.isFinite(n)) : [];
  if (pv.length) sec.pattern_vector = pv;
  put("imei_check_result", s.security.imei_check_result);
  put("photo_exception_reason", s.security.photo_exception_reason);
  if (signatureURL) sec.signature_url = signatureURL;
  if (Object.keys(sec).length) payload.device_security = sec;
  if (estimate > 0) payload.cost_estimate = estimate;
  if (s.employee) {
    if (s.employee.id) payload.assigned_to = s.employee.id;
    payload.assigned_to_name = s.employee.full_name;
  }
  payload.service_type = s.serviceType;
  if (s.serviceType !== "workshop") {
    payload.appointment_at = s.appointmentDate.toISOString();
    const loc = s.appointmentLocation.trim();
    if (s.serviceType === "visit") payload.appointment_location = loc;
    else if (loc) payload.appointment_location = loc;
  }

  const { data: order, error } = await supabase.from("order").insert(payload).select("*").single();
  if (error) throw error;

  let orderForEmail = order;
  const by = createdByName || "Web";
  if (s.liquidDamage) {
    try {
      const { data: row } = await supabase.from("order").select("status_history").eq("id", order.id).maybeSingle();
      const history = Array.isArray(row?.status_history) ? row.status_history : row?.status_history == null ? [] : null;
      if (history) {
        const next = [...history, { status: null, timestamp: new Date().toISOString(), changed_by: by, note: LIQUID_ADVISORY, visible_to_customer: false, kind: "customer_advisory" }];
        await supabase.from("order").update({ status_history: next }).eq("id", order.id);
        orderForEmail = { ...order, status_history: next };
      }
    } catch {
      orderForEmail = order;
    }
  }
  if (String(order.customer_email || "").trim() && tenant) {
    sendStatusEmail({ order: orderForEmail, tenant, status: "intake" }).catch((e) => {
      addInternalNote(order.id, `No se pudo enviar el correo de recepción a ${order.customer_email}: ${e?.message || e}. El cliente NO recibió confirmación — reenvíalo desde Documentos.`, "Sistema").catch(() => {});
    });
  }
  const stockLines = s.cart.filter(willDeductStock);
  if (stockLines.length) {
    (async () => {
      let failed = 0;
      for (const l of stockLines) { try { await adjustStock(l, order.order_number, by, tenantId); } catch { failed += 1; } }
      if (failed) onBackgroundError?.(`No se pudo descontar el inventario de ${failed} pieza${failed === 1 ? "" : "s"} de la orden ${order.order_number}. Ajústalo a mano.`);
    })();
  }
  if (s.pendingParts.length) {
    (async () => {
      let failed = 0;
      for (const p of s.pendingParts) { try { if (p.mode === "draft") await addPartToSupplierDraft(p, order, tenantId, createdByName); else await createSupplierPO(p, order, tenantId, createdByName); } catch { failed += 1; } }
      if (failed) onBackgroundError?.(`No se pudo crear ${failed} pedido${failed === 1 ? "" : "s"} a suplidor de la orden ${order.order_number}. Pídelo a mano.`);
    })();
  }
  return order;
}

export async function refetchOrder(id) {
  for (let i = 0; i < 3; i += 1) {
    const { data } = await supabase.from("order").select("*").eq("id", id).limit(1);
    if (data?.[0]) return data[0];
    await new Promise((r) => setTimeout(r, 300));
  }
  return null;
}

export async function registerOpen(tenantId) {
  const { data } = await supabase.from("cash_register").select("id").eq("tenant_id", tenantId).eq("status", "open").limit(1);
  return !!data?.[0];
}

export { isServiceItem };
