import { supabase } from "../../../../lib/supabase-client.js";
import { recordSaleAndTransactions } from "@/components/financial/recordSale";
import { fetchRegister, fetchOpenRegister } from "@/lib/cashRegisterApi";
import { itemToPayload, isFullDevice, r2 } from "@/lib/posLogic";

const nowISO = () => new Date().toISOString();

export async function loadProducts(tenantId) {
  const { data, error } = await supabase
    .from("product")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return data || [];
}

export async function loadVariants(tenantId) {
  const { data, error } = await supabase
    .from("product_variant")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(2000);
  if (error) return {};
  const map = {};
  (data || []).forEach((v) => {
    const k = v.product_id || "";
    if (!map[k]) map[k] = [];
    map[k].push(v);
  });
  return map;
}

export async function loadOffers(tenantId) {
  const { data, error } = await supabase
    .from("offer")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return [];
  return data || [];
}

export async function loadCatalog(tenantId) {
  const [products, register] = await Promise.all([loadProducts(tenantId), fetchOpenRegister(tenantId)]);
  const [variants, offers] = await Promise.all([loadVariants(tenantId), loadOffers(tenantId)]);
  return { products, register, variants, offers };
}

export class RegisterClosedError extends Error {
  constructor(closedBy) {
    const name = String(closedBy || "").trim();
    super(name ? `La caja ya fue cerrada por ${name}.` : "La caja ya fue cerrada en otro dispositivo.");
    this.name = "RegisterClosedError";
  }
}

export async function confirmRegisterStillOpen(register) {
  const current = await fetchRegister(register.id);
  if (current && String(current.status || "").toLowerCase() === "open") return;
  throw new RegisterClosedError(current?.closed_by);
}

function saleNumber() {
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  return `POS-${uuid.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function recordPosSale({ tenantId, register, cart, totals, payments, customLabel, changeDue, employeeName, customerId, notes }) {
  if (!payments.length) throw new Error("Sin métodos de pago");
  const primary = payments.reduce((a, b) => (b.amount > a.amount ? b : a), payments[0]);
  const primaryMethodKey = customLabel ? customLabel.toLowerCase() : primary.method;
  const totalReceived = r2(payments.reduce((s, p) => s + p.amount, 0));
  let remainingChange = Math.max(0, r2(changeDue));
  const applied = payments.map((p) => {
    if (p.method !== "cash" || remainingChange <= 0) return r2(p.amount);
    const trim = Math.min(p.amount, remainingChange);
    remainingChange = r2(remainingChange - trim);
    return r2(p.amount - trim);
  });
  const appliedTotal = r2(applied.reduce((s, a) => s + a, 0));
  const employee = String(employeeName || "").trim() || "system";
  const number = saleNumber();
  const sale = {
    tenant_id: tenantId,
    sale_number: number,
    items: cart.map(itemToPayload),
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    total: totals.total,
    payment_method: primaryMethodKey,
    employee,
    amount_received: totalReceived,
    amount_paid: appliedTotal,
    change_due: changeDue,
    customer_id: customerId || null,
    order_id: null,
    cash_register_id: register.id,
    is_split_payment: payments.length > 1,
    notes: notes || null,
  };
  const transactions = payments.map((p, i) => ({ p, amount: applied[i] }))
    .filter((x) => x.amount > 0)
    .map(({ p, amount }) => ({
      tenant_id: tenantId,
      type: "revenue",
      amount,
      category: "repair_payment",
      payment_method: customLabel ? customLabel.toLowerCase() : p.method,
      description: payments.length > 1 ? "Venta POS (pago dividido)" : "Venta POS",
      recorded_by: employee,
    }));
  const res = await recordSaleAndTransactions({ sale, transactions, orderUpdate: null });
  let saleId = res?.sale?.id || null;
  if (!saleId) {
    const { data } = await supabase.from("sale").select("id").eq("tenant_id", tenantId).eq("sale_number", number).order("created_at", { ascending: false }).limit(1);
    saleId = data?.[0]?.id || null;
  }
  return { saleId, saleNumber: number };
}

export async function addLoyaltyPoints(customerId, tenantId, delta) {
  if (!customerId || !delta) return;
  try {
    await supabase.rpc("increment_loyalty_points", { p_customer_id: customerId, p_tenant_id: tenantId, p_delta: delta });
  } catch {
    return;
  }
}

async function adjustProductStock(product, delta, reason, byName, tenantId) {
  const current = Number(product.stock) || 0;
  const next = Math.max(0, current + delta);
  const { error } = await supabase.from("product").update({ stock: next }).eq("id", product.id);
  if (error) throw error;
  supabase.from("transaction").insert({
    tenant_id: tenantId,
    type: "stock_adjustment",
    category: delta > 0 ? "stock_in" : "stock_out",
    amount: Math.abs(next - current),
    description: `[${product.name}] ${reason}`,
    recorded_by: byName,
  }).then(() => {}, () => {});
  return next;
}

async function adjustVariantStock(variantId, delta) {
  const { data } = await supabase.from("product_variant").select("id,stock").eq("id", variantId).limit(1);
  const v = data?.[0];
  if (!v) return;
  const next = Math.max(0, (Number(v.stock) || 0) + delta);
  await supabase.from("product_variant").update({ stock: next }).eq("id", variantId);
}

export async function deductStockForSale({ items, products, tenantId, employeeName }) {
  const label = String(employeeName || "").trim() || "POS";
  const deltas = {};
  for (const it of items) {
    if (it.variantId) {
      await adjustVariantStock(it.variantId, -it.quantity).catch(() => {});
      continue;
    }
    if (!it.productId) continue;
    const product = products.find((p) => p.id === it.productId);
    if (!product || !((Number(product.stock) || 0) > 0)) continue;
    const before = Number(product.stock) || 0;
    try {
      const next = await adjustProductStock(product, -it.quantity, "Venta POS", label, tenantId);
      deltas[product.id] = before - next;
      if (isFullDevice(product) && next <= 0) await supabase.from("product").update({ active: false }).eq("id", product.id);
    } catch {
      continue;
    }
  }
  return deltas;
}

export async function restoreStockForSale({ items, products, tenantId, employeeName, deltas }) {
  const label = String(employeeName || "").trim() || "POS";
  for (const it of items) {
    if (it.variantId) {
      await adjustVariantStock(it.variantId, it.quantity).catch(() => {});
      continue;
    }
    if (!it.productId) continue;
    const product = products.find((p) => p.id === it.productId);
    if (!product) continue;
    const giveBack = deltas && deltas[product.id] !== undefined ? deltas[product.id] : it.quantity;
    if (!(giveBack > 0)) continue;
    await adjustProductStock(product, giveBack, "Venta anulada", label, tenantId).catch(() => {});
  }
}

export class AlreadyVoidedError extends Error {
  constructor() {
    super("Esa venta ya fue anulada — no se registró un segundo reembolso.");
    this.name = "AlreadyVoidedError";
  }
}

export async function voidSaleRow({ saleId, reason, byName, byId }) {
  const fields = { voided: true, is_deleted: true, voided_at: nowISO(), void_reason: reason };
  if (String(byName || "").trim()) fields.voided_by_name = byName;
  if (byId) fields.voided_by = byId;
  const { data, error } = await supabase.from("sale").update(fields).eq("id", saleId).eq("voided", false).select("id");
  if (error) throw error;
  if (!data || data.length === 0) throw new AlreadyVoidedError();
}

export async function insertRefundTransaction({ tenantId, amount, paymentMethod, description, recordedBy }) {
  const { error } = await supabase.from("transaction").insert({
    tenant_id: tenantId,
    type: "refund",
    amount: -Math.abs(amount),
    category: "refund",
    payment_method: paymentMethod,
    description,
    recorded_by: String(recordedBy || "").trim() || "system",
  });
  if (error) throw error;
}

export async function voidFromHistory({ sale, tenantId, authorizedByPin, employeeName, employeeId }) {
  const who = authorizedByPin ? "empleado (autorizado con PIN del dueno)" : "dueno";
  const actor = String(employeeName || "").trim() || who;
  await voidSaleRow({ saleId: sale.id, reason: `Venta anulada por ${actor} (${who})`, byName: actor, byId: employeeId });
  const pm = String(sale.payment_method || "").toLowerCase();
  await insertRefundTransaction({
    tenantId,
    amount: Number(sale.total) || 0,
    paymentMethod: ["cash", "card", "ath_movil"].includes(pm) ? pm : "cash",
    description: `Venta ${sale.sale_number || sale.id} anulada`,
    recordedBy: employeeName,
  }).catch(() => {});
  const items = Array.isArray(sale.items) ? sale.items : [];
  for (const it of items) {
    if (!it?.product_id) continue;
    const { data } = await supabase.from("product").select("id,name,stock").eq("id", it.product_id).limit(1);
    const product = data?.[0];
    if (!product) continue;
    await adjustProductStock(product, Number(it.quantity) || 0, `Venta ${sale.sale_number || sale.id} anulada`, String(employeeName || "").trim() || "POS", tenantId).catch(() => {});
  }
}

export async function listSales(tenantId, limit = 50) {
  const { data, error } = await supabase
    .from("sale")
    .select("*,customer:customer_id(id,name,phone,email)")
    .eq("tenant_id", tenantId)
    .eq("voided", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function assignSaleCustomer(saleId, customerId) {
  const { error } = await supabase.from("sale").update({ customer_id: customerId }).eq("id", saleId);
  if (error) throw error;
}

export async function listCustomers(tenantId) {
  const { data, error } = await supabase.from("customer").select("*").eq("tenant_id", tenantId).order("name", { ascending: true }).limit(500);
  if (error) throw error;
  return data || [];
}

export async function fetchCustomer(tenantId, id) {
  const { data } = await supabase.from("customer").select("*").eq("tenant_id", tenantId).eq("id", id).limit(1);
  return data?.[0] || null;
}

export async function createCustomer({ tenantId, firstName, lastName, phone, email, language }) {
  const body = {
    name: `${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim(),
    tenant_id: tenantId,
    preferred_language: language === "en" ? "en" : "es",
    risk_flag: false,
  };
  if (String(phone || "").trim()) body.phone = String(phone).trim();
  if (String(email || "").trim()) body.email = String(email).trim();
  const { data, error } = await supabase.from("customer").insert(body).select("*").single();
  if (error) throw error;
  return data;
}

export async function listUnpaidOrders(tenantId, limit = 200) {
  const { data, error } = await supabase
    .from("order")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_deleted", false)
    .eq("paid", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

async function ownerPinCall(body) {
  try {
    const { data, error } = await supabase.functions.invoke("owner-pin", { body });
    if (error) return null;
    return data || null;
  } catch {
    return null;
  }
}

export async function ownerPinExists(tenantId) {
  if (!tenantId) return false;
  const r = await ownerPinCall({ action: "status", tenant_id: tenantId });
  return r?.exists === true;
}

export async function verifyOwnerPin(tenantId, pin) {
  if (!tenantId || !pin) return false;
  const r = await ownerPinCall({ action: "verify", tenant_id: tenantId, pin });
  return r?.ok === true;
}
