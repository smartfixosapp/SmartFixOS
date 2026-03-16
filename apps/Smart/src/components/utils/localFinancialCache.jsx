const LOCAL_SALES_KEY = "smartfix_local_sales";
const LOCAL_TRANSACTIONS_KEY = "smartfix_local_transactions";

function safeParseArray(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
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
      if (session?.user?.tenant_id) return String(session.user.tenant_id);
      if (session?.session?.tenant_id) return String(session.session.tenant_id);
    }
  } catch {
    // no-op
  }

  return (
    localStorage.getItem("smartfix_tenant_id") ||
    localStorage.getItem("current_tenant_id") ||
    sessionStorage.getItem("current_tenant_id") ||
    null
  );
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    ...row,
    tenant_id: row.tenant_id || getActiveTenantId() || null,
  };
}

function filterByTenant(rows = []) {
  const activeTenantId = getActiveTenantId();
  return rows.filter((row) => {
    if (!row) return false;
    if (!activeTenantId) return !row.tenant_id;
    return String(row.tenant_id || "") === String(activeTenantId);
  });
}

function mergeById(primary = [], secondary = []) {
  const map = new Map();
  [...secondary, ...primary].forEach((row) => {
    const normalized = normalizeRow(row);
    if (!normalized) return;
    const key = String(normalized.id || "");
    if (!key) return;
    map.set(key, normalized);
  });
  return Array.from(map.values()).sort((a, b) => {
    const ad = new Date(a.created_date || a.created_at || a.updated_date || 0).getTime();
    const bd = new Date(b.created_date || b.created_at || b.updated_date || 0).getTime();
    return bd - ad;
  });
}

export function getLocalSales() {
  return filterByTenant(safeParseArray(localStorage.getItem(LOCAL_SALES_KEY))).map(normalizeRow).filter(Boolean);
}

export function getLocalTransactions() {
  return filterByTenant(safeParseArray(localStorage.getItem(LOCAL_TRANSACTIONS_KEY))).map(normalizeRow).filter(Boolean);
}

export function upsertLocalSale(sale) {
  const current = getLocalSales();
  const merged = mergeById([sale], current);
  localStorage.setItem(LOCAL_SALES_KEY, JSON.stringify(merged.slice(0, 1000)));
}

export function upsertLocalTransactions(transactions = []) {
  const current = getLocalTransactions();
  const merged = mergeById(Array.isArray(transactions) ? transactions : [], current);
  localStorage.setItem(LOCAL_TRANSACTIONS_KEY, JSON.stringify(merged.slice(0, 2000)));
}

export function mergeSales(remote = []) {
  return mergeById(Array.isArray(remote) ? remote : [], getLocalSales());
}

export function mergeTransactions(remote = []) {
  return mergeById(Array.isArray(remote) ? remote : [], getLocalTransactions());
}
