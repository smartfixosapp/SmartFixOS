const LOCAL_ORDERS_KEY = "smartfix_local_orders";
const LOCAL_ORDER_SEQ_KEY = "smartfix_local_seq_order";
const LOCAL_ORDER_REBASE_ONCE_KEY = "smartfix_local_orders_rebased_v1";

function safeParseArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractOrderSequence(orderNumber) {
  const match = String(orderNumber || "").match(/^WO-(\d+)$/i);
  if (!match) return 0;
  const n = Number(match[1] || 0);
  return Number.isFinite(n) ? n : 0;
}

function canonicalOrderNumber(orderNumber) {
  const raw = String(orderNumber || "").trim();
  const normalized = raw.match(/^WO-0*(\d+)$/i);
  if (!normalized) return null;
  const n = Number(normalized[1] || 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `WO-${n}`;
}

function toCanonicalOrderNumber(orderOrNumber) {
  if (!orderOrNumber) return null;
  if (typeof orderOrNumber === "string") {
    return canonicalOrderNumber(orderOrNumber) || String(orderOrNumber).trim() || null;
  }
  return (
    canonicalOrderNumber(orderOrNumber.order_number) ||
    (orderOrNumber.order_number ? String(orderOrNumber.order_number).trim() : null)
  );
}

function migrateLocalOrderStore() {
  try {
    const current = safeParseArray(localStorage.getItem(LOCAL_ORDERS_KEY));
    if (!current.length) return current;
    const alreadyRebased = localStorage.getItem(LOCAL_ORDER_REBASE_ONCE_KEY) === "1";

    // One-time hard rebase: WO-1..WO-N por fecha de creación.
    if (!alreadyRebased) {
      const sorted = [...current].sort((a, b) => {
        const ad = new Date(a?.created_date || 0).getTime();
        const bd = new Date(b?.created_date || 0).getTime();
        return ad - bd;
      });
      const rebased = sorted.map((order, idx) => ({
        ...order,
        order_number: `WO-${idx + 1}`
      }));
      localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(rebased));
      localStorage.setItem(LOCAL_ORDER_SEQ_KEY, String(rebased.length));
      localStorage.setItem(LOCAL_ORDER_REBASE_ONCE_KEY, "1");
      return rebased;
    }

    // Migración liviana luego del rebase: normalizar formato WO-0007 -> WO-7.
    let max = 0;
    let changed = false;
    const migrated = current.map((order) => {
      const canonical = canonicalOrderNumber(order?.order_number);
      if (canonical) {
        max = Math.max(max, extractOrderSequence(canonical));
        if (order?.order_number !== canonical) changed = true;
        return { ...order, order_number: canonical };
      }
      return order;
    });

    if (changed) localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(migrated));
    const stored = Number(localStorage.getItem(LOCAL_ORDER_SEQ_KEY) || 0);
    localStorage.setItem(LOCAL_ORDER_SEQ_KEY, String(Math.max(max, Number.isFinite(stored) ? stored : 0)));
    return migrated;
  } catch {
    return safeParseArray(localStorage.getItem(LOCAL_ORDERS_KEY));
  }
}

function nextLocalOrderNumber(existingOrders = []) {
  let stored = 0;
  try {
    stored = Number(localStorage.getItem(LOCAL_ORDER_SEQ_KEY) || 0);
  } catch {
    stored = 0;
  }
  const safeStored = Number.isFinite(stored) ? stored : 0;
  const next = safeStored > 0 ? safeStored + 1 : (existingOrders?.length || 0) + 1;
  try {
    localStorage.setItem(LOCAL_ORDER_SEQ_KEY, String(next));
  } catch {
    // no-op
  }
  return `WO-${next}`;
}

function normalizeOrder(order) {
  if (!order || typeof order !== "object") return null;
  const existing = migrateLocalOrderStore();
  const derivedId =
    order.id ||
    (order.order_number ? `local-order-${String(order.order_number)}` : null) ||
    `local-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const canonical = canonicalOrderNumber(order.order_number);
  const fallbackNumber = canonical ? null : nextLocalOrderNumber(existing);
  return {
    ...order,
    id: derivedId,
    created_date: order.created_date || new Date().toISOString(),
    status: order.status || "pending",
    customer_name: order.customer_name || order.customer?.name || "Cliente",
    order_number: canonical || fallbackNumber || order.order_number || null,
  };
}

export function getLocalOrders() {
  try {
    return migrateLocalOrderStore()
      .map(normalizeOrder)
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function upsertLocalOrder(order) {
  const incoming = order || {};
  const current = getLocalOrders();
  const canonicalIncomingNumber = canonicalOrderNumber(incoming.order_number) || incoming.order_number;
  const existing = current.find((o) =>
    (incoming?.id && String(o?.id) === String(incoming.id)) ||
    (canonicalIncomingNumber && String(o?.order_number) === String(canonicalIncomingNumber))
  );
  const normalized = normalizeOrder({ ...(existing || {}), ...(incoming || {}) });
  if (!normalized) return;

  const merged = [
    normalized,
    ...current.filter((o) => !(
      String(o?.id) === String(normalized.id) ||
      (normalized.order_number && String(o?.order_number) === String(normalized.order_number))
    ))
  ];
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(merged.slice(0, 1000)));
  } catch {
    // no-op
  }
}

export function mergeOrders(remoteOrders = [], localOrders = []) {
  const map = new Map();
  [...localOrders, ...remoteOrders].forEach((order) => {
    const normalized = normalizeOrder(order);
    if (!normalized) return;
    map.set(normalized.id, { ...(map.get(normalized.id) || {}), ...normalized });
  });

  return Array.from(map.values()).sort((a, b) => {
    const ad = new Date(a.created_date || 0).getTime();
    const bd = new Date(b.created_date || 0).getTime();
    return bd - ad;
  });
}

export function removeLocalOrder(orderRef) {
  if (!orderRef) return;
  try {
    const orderId = typeof orderRef === "object" ? orderRef.id : orderRef;
    const orderNumber = toCanonicalOrderNumber(orderRef);
    const current = getLocalOrders();
    const filtered = current.filter((o) => {
      const sameId = orderId ? String(o?.id) === String(orderId) : false;
      const currentNumber = toCanonicalOrderNumber(o);
      const sameOrderNumber = orderNumber && currentNumber ? String(currentNumber) === String(orderNumber) : false;
      return !(sameId || sameOrderNumber);
    });
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(filtered));
  } catch {
    // no-op
  }
}
