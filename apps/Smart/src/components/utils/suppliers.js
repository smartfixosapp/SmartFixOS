import appClient from "@/api/appClient";
import { dataClient } from "@/components/api/dataClient";

const SUPPLIERS_CACHE_KEY = "smartfix_suppliers_cache";

function readCachedSuppliers() {
  try {
    const raw = localStorage.getItem(SUPPLIERS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCachedSuppliers(suppliers) {
  try {
    localStorage.setItem(SUPPLIERS_CACHE_KEY, JSON.stringify(Array.isArray(suppliers) ? suppliers : []));
  } catch {
    // no-op
  }
}

function normalizeSupplierPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function dedupeSuppliers(list = []) {
  const byKey = new Map();
  for (const supplier of list) {
    if (!supplier) continue;
    const id = String(supplier.id || "").trim();
    const name = String(supplier.name || "").trim().toLowerCase();
    const key = id || `name:${name}`;
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, supplier);
  }
  return Array.from(byKey.values());
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSupplierRecord(record = {}) {
  const name = String(record?.name || record?.supplier_name || "").trim();
  const id = String(record?.id || record?.supplier_id || "").trim();
  if (!name && !id) return null;
  return {
    id: id || `virtual-supplier-${slugify(name) || Date.now()}`,
    name: name || id,
    contact_name: record?.contact_name || "",
    phone: record?.phone || "",
    email: record?.email || "",
    website: record?.website || "",
    address: record?.address || "",
    notes: record?.notes || "",
    active: record?.active !== false,
    is_virtual: !id
  };
}

async function loadSuppliersFromPurchaseOrders() {
  const fetchers = [
    () => appClient.entities.PurchaseOrder?.list?.("-created_date", 300),
    () => appClient.entities.PurchaseOrder?.list?.(),
    () => appClient.entities.PurchaseOrder?.filter?.({}, "-created_date", 300),
    () => dataClient.entities.PurchaseOrder?.list?.("-created_date", 300),
    () => dataClient.entities.PurchaseOrder?.list?.(),
    () => dataClient.entities.PurchaseOrder?.filter?.({}, "-created_date", 300)
  ];

  for (const fetcher of fetchers) {
    try {
      const payload = await fetcher();
      const rows = normalizeSupplierPayload(payload);
      if (!rows.length) continue;
      const virtualSuppliers = rows
        .map((row) => normalizeSupplierRecord({
          supplier_id: row?.supplier_id,
          supplier_name: row?.supplier_name
        }))
        .filter(Boolean);
      if (virtualSuppliers.length > 0) {
        return dedupeSuppliers(virtualSuppliers);
      }
    } catch {
      // ignore and try next source
    }
  }
  return [];
}

function buildVirtualSupplier(name) {
  const supplierName = String(name || "").trim();
  if (!supplierName) return null;
  return normalizeSupplierRecord({
    supplier_name: supplierName
  });
}

async function loadSuppliersFromProductsAndOrders() {
  const virtual = [];

  const productFetchers = [
    () => appClient.entities.Product?.list?.("-created_date", 500),
    () => appClient.entities.Product?.filter?.({}, "-created_date", 500),
    () => dataClient.entities.Product?.list?.("-created_date", 500),
    () => dataClient.entities.Product?.filter?.({}, "-created_date", 500)
  ];
  for (const fetcher of productFetchers) {
    try {
      const rows = normalizeSupplierPayload(await fetcher());
      if (!rows.length) continue;
      for (const row of rows) {
        const v1 = buildVirtualSupplier(row?.supplier_name);
        const v2 = buildVirtualSupplier(row?.supplier);
        if (v1) virtual.push(v1);
        if (v2) virtual.push(v2);
      }
      if (virtual.length > 0) break;
    } catch {
      // ignore
    }
  }

  const orderFetchers = [
    () => appClient.entities.Order?.list?.("-created_date", 500),
    () => appClient.entities.Order?.filter?.({ deleted: false }, "-created_date", 500),
    () => dataClient.entities.Order?.list?.("-created_date", 500),
    () => dataClient.entities.Order?.filter?.({ deleted: false }, "-created_date", 500)
  ];
  for (const fetcher of orderFetchers) {
    try {
      const rows = normalizeSupplierPayload(await fetcher());
      if (!rows.length) continue;
      for (const row of rows) {
        const v = buildVirtualSupplier(row?.parts_supplier);
        if (v) virtual.push(v);
      }
      if (virtual.length > 0) break;
    } catch {
      // ignore
    }
  }

  return dedupeSuppliers(virtual);
}

export async function loadSuppliersSafe() {
  const cached = dedupeSuppliers(readCachedSuppliers());
  const attempts = [
    () => appClient.entities.Supplier?.list?.("-created_date"),
    () => appClient.entities.Supplier?.list?.(),
    () => appClient.entities.Supplier?.filter?.({}, "-created_date"),
    () => appClient.entities.Supplier?.filter?.({}),
    () => dataClient.entities.Supplier?.list?.("-created_date"),
    () => dataClient.entities.Supplier?.list?.(),
    () => dataClient.entities.Supplier?.filter?.({}, "-created_date"),
    () => dataClient.entities.Supplier?.filter?.({})
  ];

  for (const attempt of attempts) {
    try {
      const payload = await attempt();
      const suppliers = dedupeSuppliers(normalizeSupplierPayload(payload));
      if (suppliers.length > 0) {
        writeCachedSuppliers(suppliers);
        return suppliers;
      }
      // Si remoto responde vacío, mantener y usar lo último cacheado.
      if (cached.length > 0) return cached;
    } catch {
      // try next source
    }
  }

  const fromPO = await loadSuppliersFromPurchaseOrders();
  if (fromPO.length > 0) {
    const merged = dedupeSuppliers([...cached, ...fromPO]);
    writeCachedSuppliers(merged);
    return merged;
  }

  const fromProductsAndOrders = await loadSuppliersFromProductsAndOrders();
  if (fromProductsAndOrders.length > 0) {
    const merged = dedupeSuppliers([...cached, ...fromProductsAndOrders]);
    writeCachedSuppliers(merged);
    return merged;
  }

  return cached;
}

export function upsertSupplierInCache(supplier) {
  if (!supplier?.id && !supplier?.name) return;
  const current = dedupeSuppliers(readCachedSuppliers());
  const next = dedupeSuppliers([
    supplier,
    ...current.filter((s) => String(s?.id || "") !== String(supplier?.id || ""))
  ]);
  writeCachedSuppliers(next);
}

export function removeSupplierFromCache(supplierId) {
  const id = String(supplierId || "");
  if (!id) return;
  const current = dedupeSuppliers(readCachedSuppliers());
  writeCachedSuppliers(current.filter((s) => String(s?.id || "") !== id));
}
