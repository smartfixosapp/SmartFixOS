import { supabase } from "../../../../lib/supabase-client.js";
import { lineItems, lineTotal, num, r2, uuid, adjustStock, voidExpenses, fetchPO } from "@/lib/comprasApi";

const nowISO = () => new Date().toISOString();
const lineKey = (purchaseId, lineId) => `${purchaseId}#${lineId}`;
const normalized = (s) => String(s || "").trim().toLowerCase();
const labelOf = (lines) => lines.map((l) => l.product_name).join(", ");
const cleanupMarker = (orderNumber) => `Limpieza al cancelar la orden ${orderNumber}`;
const RESERVED = /[,.:()"]/;

function orValue(column, op, value) {
  return RESERVED.test(value) ? `${column}.${op}."${value.replace(/"/g, "")}"` : `${column}.${op}.${value}`;
}

function isExclusivePending(po, orderId) {
  const lines = lineItems(po);
  return po.status === "ordered" && lines.length > 0 && lines.every((l) => l.linked_work_order_id === orderId && num(l.received_quantity) <= 0);
}

async function listAllPOs(tenantId) {
  const pageSize = 500;
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from("purchase_order").select("*").eq("tenant_id", tenantId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, from + pageSize - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return out;
}

async function lastCleanup(orderNumber, tenantId) {
  const marker = cleanupMarker(orderNumber);
  const { data, error } = await supabase.from("transaction").select("amount,category,description,created_at")
    .eq("tenant_id", tenantId).eq("type", "stock_adjustment")
    .or(`${orValue("description", "eq", marker)},${orValue("description", "like", `${marker} |*`)}`)
    .order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return { date: null, excludedKeys: new Set() };
  const text = String(row.description || "");
  const at = text.indexOf(" | ");
  const keys = at >= 0 ? text.slice(at + 3).split(",").filter(Boolean) : [];
  return { date: row.created_at ? new Date(row.created_at) : null, excludedKeys: new Set(keys) };
}

async function stockOutByName(orderNumber, tenantId, since) {
  const reasons = [
    `Usada en orden ${orderNumber}`,
    `Usada en la orden ${orderNumber}`,
    `Piezas en orden ${orderNumber}`,
    `Devuelta al cancelar la orden ${orderNumber}`,
  ];
  const conditions = reasons.map((r) => orValue("description", "ilike", `*${r}`)).join(",");
  const { data, error } = await supabase.from("transaction").select("amount,category,description,created_at")
    .eq("tenant_id", tenantId).eq("type", "stock_adjustment").or(conditions).limit(1000);
  if (error) throw error;
  const net = {};
  for (const row of data || []) {
    if (since) {
      const at = row.created_at ? new Date(row.created_at) : null;
      if (!at || at <= since) continue;
    }
    const text = String(row.description || "");
    if (!text.startsWith("[")) continue;
    const close = text.indexOf("] ");
    if (close < 0) continue;
    const name = text.slice(1, close);
    const sign = row.category === "stock_in" ? -1 : 1;
    net[name] = (net[name] || 0) + sign * Math.abs(num(row.amount));
  }
  return net;
}

export async function buildCancelPlan({ orderId, orderNumber, tenantId }) {
  const { data: orderRow, error } = await supabase.from("order").select("order_items,status").eq("id", orderId).maybeSingle();
  if (error) throw error;
  const items = Array.isArray(orderRow?.order_items) ? orderRow.order_items : [];
  const cleanup = await lastCleanup(orderNumber, tenantId);

  const plan = {
    orderId, orderNumber, tenantId, alreadyCancelled: orderRow?.status === "cancelled", historySince: cleanup.date,
    stockReturns: [], arrivedParts: [], pendingPurchases: [], sharedPurchases: [], draftRemovals: [], linkedPurchaseIds: [], manualParts: [], manualExpenseTotal: 0,
  };

  const purchases = (await listAllPOs(tenantId)).filter((po) => lineItems(po).some((l) => l.linked_work_order_id === orderId));
  const purchasedById = {};
  const purchasedFreeText = new Set();

  for (const po of purchases) {
    const mine = lineItems(po).filter((l) => l.linked_work_order_id === orderId && l.is_tool !== true);
    if (!mine.length) continue;
    for (const line of mine) {
      if (line.inventory_item_id) purchasedById[line.inventory_item_id] = (purchasedById[line.inventory_item_id] || 0) + num(line.quantity);
      else purchasedFreeText.add(normalized(line.product_name));
    }
    if (po.status === "cancelled") continue;
    if (po.status === "draft") {
      plan.draftRemovals.push({ id: po.id, purchaseNumber: po.po_number, itemsLabel: labelOf(mine) });
      continue;
    }
    for (const line of mine.filter((l) => num(l.received_quantity) > 0)) {
      if (line.inventory_item_id) {
        plan.arrivedParts.push({
          id: lineKey(po.id, line.id), purchaseId: po.id, lineId: line.id, productId: line.inventory_item_id, name: line.product_name,
          quantity: num(line.received_quantity), purchaseNumber: po.po_number, cost: num(line.unit_cost) * num(line.received_quantity),
          include: !cleanup.excludedKeys.has(lineKey(po.id, line.id)),
        });
      } else {
        plan.manualParts.push({ id: lineKey(po.id, line.id), name: line.product_name, quantity: num(line.received_quantity) });
      }
    }
    const pending = mine.filter((l) => num(l.quantity) - num(l.received_quantity) > 0);
    if (isExclusivePending(po, orderId)) {
      plan.pendingPurchases.push({
        id: po.id, purchaseNumber: po.po_number, itemsLabel: labelOf(pending),
        quantity: pending.reduce((s, l) => s + (num(l.quantity) - num(l.received_quantity)), 0), amount: num(po.total_amount), cancelPurchase: true,
      });
    } else {
      if (pending.length) plan.sharedPurchases.push({ id: po.id, purchaseNumber: po.po_number, itemsLabel: labelOf(pending) });
      plan.linkedPurchaseIds.push(po.id);
    }
  }

  const partOrder = [];
  const parts = {};
  for (const item of items.filter((i) => i && i.type === "part")) {
    if (!parts[item.id]) { partOrder.push(item.id); parts[item.id] = { name: item.name, quantity: 0 }; }
    parts[item.id].quantity += Math.trunc(num(item.quantity));
  }
  if (partOrder.length) {
    const pool = await stockOutByName(orderNumber, tenantId, cleanup.date);
    const granted = {};
    for (const pid of partOrder) {
      const entry = parts[pid];
      const uncovered = Math.max(0, entry.quantity - Math.ceil(purchasedById[pid] || 0));
      const give = Math.min(uncovered, Math.floor(pool[entry.name] || 0));
      if (give <= 0) continue;
      granted[pid] = give;
      pool[entry.name] = (pool[entry.name] || 0) - give;
    }
    for (const pid of partOrder) {
      const entry = parts[pid];
      const already = granted[pid] || 0;
      const give = Math.min(entry.quantity - already, Math.floor(pool[entry.name] || 0));
      if (give <= 0) continue;
      granted[pid] = already + give;
      pool[entry.name] = (pool[entry.name] || 0) - give;
    }
    for (const pid of partOrder) {
      if (granted[pid] > 0) plan.stockReturns.push({ id: pid, productId: pid, name: parts[pid].name, quantity: granted[pid], include: true });
    }
  }

  for (const item of items.filter((i) => i && i.type === "manual" && !purchasedFreeText.has(normalized(i.name)))) {
    plan.manualParts.push({ id: item.id, name: item.name, quantity: num(item.quantity) });
  }
  if (plan.manualParts.length) {
    const { data } = await supabase.from("transaction").select("amount").eq("tenant_id", tenantId).eq("order_id", orderId)
      .eq("type", "expense").eq("category", "parts").eq("is_deleted", false).limit(50);
    plan.manualExpenseTotal = (data || []).reduce((s, r) => s + Math.abs(num(r.amount)), 0);
  }

  plan.isEmpty = !plan.stockReturns.length && !plan.arrivedParts.length && !plan.pendingPurchases.length && !plan.sharedPurchases.length
    && !plan.draftRemovals.length && !plan.manualParts.length && !plan.linkedPurchaseIds.length;
  plan.hasPendingWork = plan.stockReturns.length > 0 || plan.pendingPurchases.length > 0 || plan.draftRemovals.length > 0
    || plan.sharedPurchases.length > 0 || plan.arrivedParts.some((p) => p.include);
  return plan;
}

export function unitsBackToInventory(plan) {
  return plan.stockReturns.filter((r) => r.include).reduce((s, r) => s + r.quantity, 0) + plan.arrivedParts.filter((p) => p.include).reduce((s, p) => s + p.quantity, 0);
}

export function doneMessage(plan) {
  const units = Math.round(unitsBackToInventory(plan));
  return units > 0 ? `Orden ${plan.orderNumber} cancelada · ${units} pieza(s) de vuelta al inventario` : `Orden ${plan.orderNumber} cancelada`;
}

async function addStock({ productId, quantity, reason, who, tenantId }) {
  try {
    const { data: prod, error } = await supabase.from("product").select("id,type").eq("id", productId).maybeSingle();
    if (error || !prod) return false;
    if (prod.type === "service") return true;
    return await adjustStock(tenantId, productId, quantity, reason, who);
  } catch {
    return false;
  }
}

async function flipDeductedLines(orderId) {
  try {
    const { data, error } = await supabase.from("order").select("order_items").eq("id", orderId).maybeSingle();
    if (error) throw error;
    const items = Array.isArray(data?.order_items) ? data.order_items.map((i) => ({ ...i })) : null;
    if (!items) return new Set();
    const flipped = new Set();
    items.forEach((i) => { if (i && i.type === "part") { i.type = "product"; flipped.add(i.id); } });
    if (!flipped.size) return flipped;
    const { error: upErr } = await supabase.from("order").update({ order_items: items, updated_date: nowISO() }).eq("id", orderId);
    if (upErr) throw upErr;
    return flipped;
  } catch {
    return null;
  }
}

async function removeFromDraft(po, orderId) {
  const all = lineItems(po);
  const remaining = all.filter((l) => l.linked_work_order_id !== orderId);
  if (remaining.length === all.length) return true;
  try {
    if (!remaining.length) {
      const { error } = await supabase.from("purchase_order").update({ status: "cancelled", updated_at: nowISO() }).eq("id", po.id);
      if (error) throw error;
    } else {
      const sub = r2(remaining.reduce((s, l) => s + lineTotal(l), 0));
      const total = r2(sub + num(po.shipping_cost) + num(po.tax_amount));
      const { error } = await supabase.from("purchase_order").update({ line_items: remaining, subtotal: sub, total_amount: total, updated_at: nowISO() }).eq("id", po.id);
      if (error) throw error;
    }
    return true;
  } catch {
    return false;
  }
}

async function settleLinkedLines(po, { orderId, orderNumber, excludedArrived, who, tenantId }) {
  const failures = [];
  const items = lineItems(po).map((l) => ({ ...l }));
  const splits = [];
  let changed = false;
  for (const line of items) {
    if (line.linked_work_order_id !== orderId || line.is_tool === true) continue;
    const total = num(line.quantity);
    const received = num(line.received_quantity);
    const pending = total - received;
    let release = true;
    if (received > 0 && line.inventory_item_id) {
      if (excludedArrived.has(lineKey(po.id, line.id))) {
        release = false;
        if (pending > 0 && total > 0) {
          const remainder = {
            ...line, id: uuid(), quantity: pending, received_quantity: 0,
            line_total: r2(num(line.line_total) * pending / total), tax_amount: r2(num(line.tax_amount) * pending / total),
            linked_work_order_id: null, linked_work_order_number: null,
          };
          line.quantity = received;
          line.line_total = r2(num(line.line_total) - remainder.line_total);
          line.tax_amount = r2(num(line.tax_amount) - remainder.tax_amount);
          splits.push(remainder);
          changed = true;
        }
      } else {
        const ok = await addStock({ productId: line.inventory_item_id, quantity: received, reason: `Llegó para la orden ${orderNumber}, cancelada`, who, tenantId });
        if (!ok) { failures.push(`${line.product_name} no entró al inventario.`); release = false; }
      }
    }
    if (release) {
      line.linked_work_order_id = null;
      line.linked_work_order_number = null;
      changed = true;
    }
  }
  if (!changed) return failures;
  const { error } = await supabase.from("purchase_order").update({ line_items: [...items, ...splits], updated_at: nowISO() }).eq("id", po.id);
  if (error) failures.push(`La compra ${po.po_number} sigue amarrada a esta orden. Revísala en Compras.`);
  return failures;
}

async function deletePartLinks(orderId, tenantId, purchaseIds) {
  const { data } = await supabase.from("part_link").select("id,purchase_order_id,status").eq("tenant_id", tenantId).eq("order_id", orderId).limit(200);
  for (const link of data || []) {
    if (!link.purchase_order_id || !purchaseIds.has(link.purchase_order_id) || link.status === "received") continue;
    await supabase.from("part_link").delete().eq("id", link.id);
  }
}

async function writeCleanupMarker(orderNumber, excludedKeys, tenantId, who) {
  const base = cleanupMarker(orderNumber);
  const keys = [...excludedKeys].sort();
  const description = keys.length ? `${base} | ${keys.join(",")}` : base;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { error } = await supabase.from("transaction").insert({ tenant_id: tenantId, type: "stock_adjustment", category: "stock_in", amount: 0, description, recorded_by: who });
    if (!error) return true;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

export async function applyCancelPlan(plan, { tenantId, employeeName }) {
  const failures = [];
  const who = String(employeeName || "").trim() || "Web";
  const number = plan.orderNumber;

  const flipped = await flipDeductedLines(plan.orderId);
  if (flipped) {
    const wanted = plan.stockReturns.filter((r) => r.include && flipped.has(r.productId));
    if (wanted.length) {
      try {
        const pool = await stockOutByName(number, tenantId, plan.historySince);
        for (const r of wanted) {
          const quantity = Math.min(r.quantity, Math.floor(pool[r.name] || 0));
          if (quantity <= 0) continue;
          pool[r.name] = (pool[r.name] || 0) - quantity;
          const ok = await addStock({ productId: r.productId, quantity, reason: `Devuelta al cancelar la orden ${number}`, who, tenantId });
          if (!ok) failures.push(`${r.name} no volvió al inventario.`);
        }
      } catch {
        failures.push("No se pudo confirmar qué piezas salieron del inventario, así que ninguna volvió. Ajústalo a mano.");
      }
    }
  } else {
    failures.push("No se pudo actualizar el carrito de la orden, así que ninguna pieza volvió al inventario. Vuelve a elegir Cancelada en la orden para intentarlo de nuevo.");
  }

  const excludedArrived = new Set(plan.arrivedParts.filter((p) => !p.include).map((p) => p.id));
  const cancelChoice = new Map(plan.pendingPurchases.map((p) => [p.id, p.cancelPurchase]));
  const draftIds = new Set(plan.draftRemovals.map((d) => d.id));
  const purchaseIds = [...new Set([...plan.arrivedParts.map((p) => p.purchaseId), ...plan.pendingPurchases.map((p) => p.id), ...plan.linkedPurchaseIds, ...plan.draftRemovals.map((d) => d.id)])];
  const released = new Set();

  for (const purchaseId of purchaseIds) {
    let po;
    try { po = await fetchPO(purchaseId); } catch { failures.push("No se pudo revisar una compra ligada a la orden. Revísala en Compras."); continue; }
    if (!po || po.status === "cancelled") continue;

    if (po.status === "draft") {
      if (await removeFromDraft(po, plan.orderId)) released.add(purchaseId);
      else failures.push(`No se pudo sacar la pieza del pedido abierto ${po.po_number}.`);
      continue;
    }
    if (draftIds.has(purchaseId)) failures.push(`El pedido ${po.po_number} ya se había enviado, así que la pieza sigue en esa compra. Revísala en Compras.`);

    if (cancelChoice.get(purchaseId) === true && isExclusivePending(po, plan.orderId)) {
      const { error } = await supabase.from("purchase_order").update({ status: "cancelled", updated_at: nowISO() }).eq("id", purchaseId);
      if (error) { failures.push(`No se pudo cancelar la compra ${po.po_number}.`); continue; }
      released.add(purchaseId);
      try { await voidExpenses(tenantId, purchaseId); } catch { failures.push(`La compra ${po.po_number} se canceló, pero su gasto no se pudo anular. Anúlalo en Finanzas.`); }
      continue;
    }
    failures.push(...await settleLinkedLines(po, { orderId: plan.orderId, orderNumber: number, excludedArrived, who, tenantId }));
  }

  if (released.size) await deletePartLinks(plan.orderId, tenantId, released);
  if (flipped && !(await writeCleanupMarker(number, excludedArrived, tenantId, who))) {
    failures.push("No se pudo dejar constancia de esta limpieza. Si vuelves a cancelar esta orden, revisa bien las piezas que te ofrezca.");
  }
  return failures;
}
