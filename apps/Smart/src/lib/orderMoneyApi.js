import { supabase } from "../../../../lib/supabase-client.js";
import { orderTotal } from "@/lib/orderEmails";

const nowISO = () => new Date().toISOString();
const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const PAYMENT_METHODS = {
  cash: { label: "Efectivo", color: "#30D158" },
  card: { label: "Tarjeta", color: "#0A84FF" },
  ath_movil: { label: "ATH Móvil", color: "#ED4A17" },
};

export function methodLabel(raw) {
  const r = String(raw || "").toLowerCase();
  if (r === "cash" || r === "efectivo") return "Efectivo";
  if (r === "card" || r === "tarjeta") return "Tarjeta";
  if (r === "ath_movil" || r === "ath" || r === "athmovil") return "ATH Movil";
  if (r === "transfer") return "Transferencia";
  if (!r) return "Otro";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function tenantPaymentMethods(tenant) {
  const pm = tenant?.settings?.payment_methods || {};
  const has = (k) => pm[k] === undefined || pm[k] === null ? true : !!pm[k];
  const builtIns = [];
  if (has("cash")) builtIns.push("cash");
  if (has("card")) builtIns.push("card");
  if (has("ath") && !pm.athHidden) builtIns.push("ath_movil");
  const custom = (Array.isArray(pm.custom) ? pm.custom : []).filter((c) => c && c.enabled !== false && c.label);
  const qrFor = (key) => {
    const q = key === "cash" ? pm.cashQR : key === "card" ? pm.cardQR : key === "ath_movil" ? pm.athQR : null;
    return q && (q.imageBase64 || q.paymentURL) ? q : null;
  };
  return { builtIns, custom, qrFor };
}

export async function findOpenRegister(tenantId) {
  const { data, error } = await supabase.from("cash_register").select("id,status,opened_by,closed_by,created_at").eq("tenant_id", tenantId).eq("status", "open").limit(1);
  if (error) return { failOpen: true };
  return { register: data?.[0] || null };
}

async function listOrderTransactions(orderId, filter) {
  let q = supabase.from("transaction").select("*").eq("order_id", orderId);
  q = filter(q);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).filter((t) => t.is_deleted !== true);
}

export function listDeposits(orderId) {
  return listOrderTransactions(orderId, (q) => q.eq("type", "revenue").eq("category", "repair_payment").order("created_at", { ascending: true }).limit(100));
}

export function listRefunds(orderId) {
  return listOrderTransactions(orderId, (q) => q.eq("type", "refund").order("created_at", { ascending: true }).limit(100));
}

export async function recordOrderPayment({ order, amount, method, customLabel, by }) {
  const total = orderTotal(order);
  const paid = n(order.amount_paid);
  const hasEstimate = total > 0;
  const outstanding = Math.max(0, total - paid);
  const applied = hasEstimate && outstanding > 0 ? Math.min(amount, outstanding) : amount;
  const existing = await listOrderTransactions(order.id, (q) => q.eq("type", "revenue").eq("category", "repair_payment").limit(200));
  const dup = existing.some((t) => Math.abs(n(t.amount) - applied) < 0.005 && Date.now() - new Date(t.created_at).getTime() < 120000);
  let txId = null;
  if (!dup) {
    const payment_method = customLabel ? String(customLabel).toLowerCase() : method;
    const { data, error } = await supabase.from("transaction").insert({
      tenant_id: order.tenant_id,
      type: "revenue",
      category: "repair_payment",
      amount: applied,
      description: `Pago orden ${order.order_number} · ${order.customer_name || "Cliente"}`,
      payment_method,
      recorded_by: by || "Web",
      order_id: order.id,
      order_number: order.order_number,
      is_settled: method !== "card",
    }).select("id").single();
    if (error || !data?.id) throw new Error("No se pudo registrar el pago en Finanzas. La orden NO se marcó pagada; intenta de nuevo.");
    txId = data.id;
  }
  const newPaid = hasEstimate ? Math.min(paid + amount, total) : paid + amount;
  const newBalance = hasEstimate ? Math.max(0, total - newPaid) : 0;
  const isPaidNow = hasEstimate && newBalance <= 0.004;
  const { error: upErr } = await supabase.from("order").update({ amount_paid: newPaid, balance_due: newBalance, paid: isPaidNow, updated_date: nowISO() }).eq("id", order.id);
  if (upErr) throw upErr;
  if (order.customer_id) {
    supabase.rpc("increment_loyalty_points", { p_customer_id: order.customer_id, p_tenant_id: order.tenant_id, p_delta: Math.round(applied) }).then(() => {}, () => {});
  }
  return { applied, isPaidNow, transactionId: txId, duplicate: dup };
}

export async function recalcOrderPaid(order) {
  const rows = await listOrderTransactions(order.id, (q) => q.in("type", ["revenue", "refund"]).limit(100));
  const revenue = rows.filter((t) => t.type === "revenue" && t.category === "repair_payment").reduce((s, t) => s + n(t.amount), 0);
  const refunds = rows.filter((t) => t.type === "refund").reduce((s, t) => s + Math.abs(n(t.amount)), 0);
  const total = orderTotal(order);
  const newPaid = Math.max(0, revenue - refunds);
  const newBalance = Math.max(0, total - newPaid);
  const { error } = await supabase.from("order").update({ amount_paid: newPaid, balance_due: newBalance, paid: total > 0 && newBalance <= 0.004, updated_date: nowISO() }).eq("id", order.id);
  if (error) throw error;
  return { newPaid, newBalance };
}

export async function addDeposit({ order, amount, method, by }) {
  const { error } = await supabase.from("transaction").insert({
    tenant_id: order.tenant_id,
    type: "revenue",
    category: "repair_payment",
    amount,
    description: `Depósito orden ${order.order_number}`,
    payment_method: method,
    recorded_by: by || "Web",
    order_id: order.id,
    order_number: order.order_number,
  });
  if (error) throw error;
  return recalcOrderPaid(order);
}

export async function editDeposit({ order, txId, amount }) {
  const { error } = await supabase.from("transaction").update({ amount }).eq("id", txId);
  if (error) throw error;
  return recalcOrderPaid(order);
}

export async function deleteDeposit({ order, txId }) {
  const { error } = await supabase.from("transaction").delete().eq("id", txId);
  if (error) throw error;
  return recalcOrderPaid(order);
}

export async function recordOrderRefund({ order, amount, method, reason, by }) {
  const currentPaid = n(order.amount_paid);
  const refunded = Math.min(amount, currentPaid);
  const newPaid = Math.max(0, currentPaid - refunded);
  const total = orderTotal(order);
  const newBalance = Math.max(0, total - newPaid);
  const { error: upErr } = await supabase.from("order").update({ amount_paid: newPaid, balance_due: newBalance, paid: newPaid > 0 && newBalance === 0, updated_date: nowISO() }).eq("id", order.id);
  if (upErr) throw upErr;
  const { error } = await supabase.from("transaction").insert({
    tenant_id: order.tenant_id,
    type: "refund",
    category: "refund",
    amount: refunded,
    description: `Devolución orden ${order.order_number} · ${order.customer_name || "Cliente"}`,
    payment_method: method,
    recorded_by: by || "Web",
    order_id: order.id,
    order_number: order.order_number,
    refund_metadata: { reason: String(reason || "").trim() || null, original_amount: currentPaid, refunded_at: nowISO() },
  });
  if (error) throw error;
  return { refunded };
}
