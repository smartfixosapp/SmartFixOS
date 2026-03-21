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
  const remoteList = Array.isArray(remote) ? remote : [];
  if (remoteList.length > 0) {
    // Supabase is source of truth: include local only if not in remote
    const remoteIds = new Set(remoteList.map((r) => String(r?.id || "")));
    const localOnly = getLocalSales().filter((s) => !remoteIds.has(String(s?.id || "")));
    return mergeById(remoteList, localOnly);
  }
  // Offline fallback
  return mergeById(remoteList, getLocalSales());
}

export function mergeTransactions(remote = []) {
  const remoteList = Array.isArray(remote) ? remote : [];
  if (remoteList.length > 0) {
    // Supabase is source of truth: include local only if not in remote
    const remoteIds = new Set(remoteList.map((r) => String(r?.id || "")));
    const localOnly = getLocalTransactions().filter((t) => !remoteIds.has(String(t?.id || "")));
    return mergeById(remoteList, localOnly);
  }
  // Offline fallback
  return mergeById(remoteList, getLocalTransactions());
}

const LOCAL_FIXED_EXPENSES_KEY = "smartfix_local_fixed_expenses";

export function readLocalFixedExpenses() {
  try {
    const raw = localStorage.getItem(LOCAL_FIXED_EXPENSES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
