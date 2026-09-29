import { supabase } from "../../../../../lib/supabase-client.js";
import { addMonths, monthStart } from "@/lib/finance/tz";

async function transactionsBetween(tenantId, from, to) {
  const rows = [];
  for (let off = 0; off < 20000; off += 1000) {
    const { data, error } = await supabase.from("transaction").select("*").eq("tenant_id", tenantId).eq("is_deleted", false)
      .gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).order("created_at", { ascending: false }).range(off, off + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

export function currentMonthTransactions(tenantId, tz) {
  const start = monthStart(new Date(), tz);
  return transactionsBetween(tenantId, start, addMonths(start, 1, tz));
}

export async function loadLedger(tenantId, selectedMonth, tz) {
  const from = addMonths(monthStart(selectedMonth, tz), -2, tz);
  const to = addMonths(monthStart(selectedMonth, tz), 1, tz);
  const [tx, po, ot] = await Promise.all([
    transactionsBetween(tenantId, from, to),
    supabase.from("purchase_order").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200),
    supabase.from("one_time_expense").select("*").eq("tenant_id", tenantId).order("name", { ascending: true }).limit(200),
  ]);
  return {
    transactions: tx,
    purchaseOrders: po.error ? [] : po.data || [],
    oneTimeExpenses: ot.error ? [] : ot.data || [],
  };
}

export function subscribeTransactions(tenantId, onChange) {
  let timer = null;
  const ch = supabase
    .channel(`fin-tx-${tenantId}-${Date.now().toString(36)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "transaction", filter: `tenant_id=eq.${tenantId}` }, () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, 800);
    })
    .subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(ch); };
}

async function insertTx(body) {
  const { data, error } = await supabase.from("transaction").insert(body).select("*").single();
  if (error) throw error;
  return data;
}

const by = (name) => (String(name || "").trim() ? name : "Web");

export function payRecurring({ tenantId, item, amount, method, recordedBy }) {
  const paid = amount ?? item.amount;
  const partial = paid < item.amount - 0.01;
  return insertTx({
    tenant_id: tenantId, type: "expense", category: "fixed", amount: paid,
    description: partial ? `${item.name} (parcial)` : item.name,
    payment_method: method, recorded_by: by(recordedBy), is_deleted: false,
  });
}

export function payIVU({ tenantId, amount, monthName, method, recordedBy }) {
  return insertTx({
    tenant_id: tenantId, type: "expense", category: "tax", amount,
    description: `IVU ${monthName}`, payment_method: method, recorded_by: by(recordedBy), is_deleted: false,
  });
}

export async function payPurchaseOrder({ tenantId, po, method, recordedBy }) {
  const newNotes = `${po.notes || ""} [PAID:${method}]`.trim();
  const tx = await insertTx({
    tenant_id: tenantId, type: "expense", category: "purchase", amount: Number(po.total_amount) || 0,
    description: `Orden compra · ${po.supplier_name || "Suplidor desconocido"}`, order_id: po.id,
    payment_method: method, recorded_by: by(recordedBy), is_deleted: false,
  });
  const { error } = await supabase.from("purchase_order").update({ notes: newNotes, updated_at: new Date().toISOString() }).eq("id", po.id);
  if (error) throw error;
  return tx;
}

export async function undoPayment({ tx, purchaseOrders }) {
  const { error } = await supabase.from("transaction").update({ is_deleted: true }).eq("id", tx.id);
  if (error) throw error;
  if (tx.category === "purchase" && tx.order_id) {
    const po = (purchaseOrders || []).find((p) => p.id === tx.order_id);
    if (po) {
      const cleaned = String(po.notes || "").replace(/\s*\[PAID:[^\]]*\]/g, "").trim();
      await supabase.from("purchase_order").update({ notes: cleaned, updated_at: new Date().toISOString() }).eq("id", tx.order_id);
    }
  }
}

export async function updateCategory(txId, tenantId, category) {
  const { error } = await supabase.from("transaction").update({ category }).eq("id", txId).eq("tenant_id", tenantId);
  if (error) throw error;
}

export async function updateExpense(txId, fields) {
  const { error } = await supabase.from("transaction").update(fields).eq("id", txId);
  if (error) throw error;
}

export async function softDeleteTx(txId) {
  const { error } = await supabase.from("transaction").update({ is_deleted: true }).eq("id", txId);
  if (error) throw error;
}

export function insertExpense(body) {
  return insertTx(body);
}

export function insertIncome(body) {
  return insertTx(body);
}

export async function recentExpenseTemplates(tenantId) {
  const { data } = await supabase.from("transaction").select("description,category,amount,payment_method")
    .eq("tenant_id", tenantId).eq("type", "expense").eq("is_deleted", false).order("created_at", { ascending: false }).limit(40);
  const cats = ["supplies", "rent", "utilities", "marketing", "repairs", "taxes", "other"];
  const methods = ["cash", "card", "ath_movil", "transfer", "check"];
  const seen = new Set();
  const out = [];
  (data || []).forEach((tx) => {
    if (out.length >= 6) return;
    const desc = String(tx.description || "").trim();
    if (!desc || !cats.includes(tx.category)) return;
    const key = desc.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ description: desc, amount: Number(tx.amount) || 0, category: tx.category, method: methods.includes(tx.payment_method) ? tx.payment_method : "cash" });
  });
  return out;
}

export async function uploadReceipt(tenantId, blob) {
  const uuid = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
  const path = `expense_receipts/${tenantId}/${uuid}.jpg`;
  const bucket = supabase.storage.from("uploads");
  const { error } = await bucket.upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return bucket.getPublicUrl(path).data.publicUrl;
}
