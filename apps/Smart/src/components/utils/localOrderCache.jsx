import { getEffectiveOrderStatus } from "@/components/utils/statusRegistry";

const LOCAL_ORDERS_KEY = "smartfix_local_orders";
const LOCAL_ORDER_SEQ_KEY = "smartfix_local_seq_order";
const LOCAL_ORDER_REBASE_ONCE_KEY = "smartfix_local_orders_rebased_v1";

const STATUS_PRIORITY = {
  intake: 10,
  diagnosing: 20,
  pending_order: 30,
  waiting_parts: 40,
  part_arrived_waiting_device: 50,
  reparacion_externa: 60,
  in_progress: 70,
  ready_for_pickup: 80,
  picked_up: 90,
  delivered: 100,
  completed: 110,
  warranty: 120,
  cancelled: 130,
};

function safeParseArray(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getActiveTenantId() {
  try {
    const rawSession =
      localStorage.getItem("employee_session") ||
      sessionStorage.getItem("911-session");
    if (rawSession) {
      const session = JSON.parse(rawSession);
      if (session?.tenant_id) return String(session.tenant_id);
    }

    return (
      localStorage.getItem("smartfix_tenant_id") ||
      localStorage.getItem("current_tenant_id") ||
      null
    );
  } catch {
    return localStorage.getItem("smartfix_tenant_id") || localStorage.getItem("current_tenant_id") || null;
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
  const activeTenantId = getActiveTenantId();
  const derivedId =
    order.id ||
    (order.order_number ? `local-order-${String(order.order_number)}` : null) ||
    `local-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const canonical = canonicalOrderNumber(order.order_number);
  const fallbackNumber = canonical ? null : nextLocalOrderNumber(existing);
  return {
    ...order,
    id: derivedId,
    tenant_id: order.tenant_id || activeTenantId || null,
    created_date: order.created_date || new Date().toISOString(),
    status: getEffectiveOrderStatus(order),
    customer_name: order.customer_name || order.customer?.name || "Cliente",
    order_number: canonical || fallbackNumber || order.order_number || null,
  };
}

function toTimestamp(value) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function getStatusPriority(order) {
  return STATUS_PRIORITY[normalizeStatus(getEffectiveOrderStatus(order))] || 0;
}

function getDataCompleteness(order) {
  if (!order || typeof order !== "object") return 0;
  return [
    order.customer_name,
    order.customer_phone,
    order.device_brand,
    order.device_model,
    order.assigned_to,
    order.assigned_to_name,
    order.status_note,
    order.status_history,
    order.status_metadata,
    order.order_items,
    order.updated_date,
    order.created_date,
  ].reduce((score, value) => {
    if (Array.isArray(value)) return score + (value.length ? 1 : 0);
    if (value && typeof value === "object") return score + (Object.keys(value).length ? 1 : 0);
    return score + (value ? 1 : 0);
  }, 0);
}

function preferOrderVersion(currentOrder, candidateOrder) {
  if (!currentOrder) return candidateOrder;
  if (!candidateOrder) return currentOrder;

  const currentUpdated = toTimestamp(currentOrder.updated_date);
  const candidateUpdated = toTimestamp(candidateOrder.updated_date);
  if (candidateUpdated !== currentUpdated) {
    return candidateUpdated > currentUpdated ? candidateOrder : currentOrder;
  }

  const currentCreated = toTimestamp(currentOrder.created_date);
  const candidateCreated = toTimestamp(candidateOrder.created_date);
  if (candidateCreated !== currentCreated) {
    return candidateCreated > currentCreated ? candidateOrder : currentOrder;
  }

  const currentStatusPriority = getStatusPriority(currentOrder);
  const candidateStatusPriority = getStatusPriority(candidateOrder);
  if (candidateStatusPriority !== currentStatusPriority) {
    return candidateStatusPriority > currentStatusPriority ? candidateOrder : currentOrder;
  }

  const currentCompleteness = getDataCompleteness(currentOrder);
  const candidateCompleteness = getDataCompleteness(candidateOrder);
  if (candidateCompleteness !== currentCompleteness) {
    return candidateCompleteness > currentCompleteness ? candidateOrder : currentOrder;
  }

  return currentOrder;
}

export function getLocalOrders() {
  try {
    const activeTenantId = getActiveTenantId();
    return migrateLocalOrderStore()
      .map(normalizeOrder)
      .filter((order) => {
        if (!order) return false;
        if (!activeTenantId) return !order.tenant_id;
        return String(order.tenant_id || "") === String(activeTenantId);
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function getUnsyncedLocalOrders(remoteOrders = []) {
  const remoteList = Array.isArray(remoteOrders) ? remoteOrders.map(normalizeOrder).filter(Boolean) : [];
  const remoteIds = new Set(remoteList.map((order) => String(order?.id || "")));
  const remoteNumbers = new Set(
    remoteList
      .map((order) => toCanonicalOrderNumber(order))
      .filter(Boolean)
      .map((value) => String(value))
  );

  return getLocalOrders().filter((order) => {
    const orderId = String(order?.id || "");
    const orderNumber = toCanonicalOrderNumber(order);
    return !remoteIds.has(orderId) && !(orderNumber && remoteNumbers.has(String(orderNumber)));
  });
}

export function upsertLocalOrder(order) {
  const activeTenantId = getActiveTenantId();
  const incoming = {
    ...(order || {}),
    tenant_id: order?.tenant_id || activeTenantId || null,
  };
  const current = getLocalOrders();
  const canonicalIncomingNumber = canonicalOrderNumber(incoming.order_number) || incoming.order_number;
  const existing = current.find((o) =>
    (incoming?.id && String(o?.id) === String(incoming.id)) ||
    (canonicalIncomingNumber && String(o?.order_number) === String(canonicalIncomingNumber))
  );
  const mergedInput = { ...(existing || {}), ...(incoming || {}) };
  const normalized = normalizeOrder(preferOrderVersion(existing, normalizeOrder(mergedInput)));
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
    const canonicalNumber = canonicalOrderNumber(normalized.order_number);
    const key = canonicalNumber || normalized.id;
    map.set(key, preferOrderVersion(map.get(key), normalized));
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
