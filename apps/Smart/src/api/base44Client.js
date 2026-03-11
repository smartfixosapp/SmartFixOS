import { customClient } from "../../../../lib/unified-custom-sdk-supabase.js";

import Customer from "@/Entities/Customer.json";
import Order from "@/Entities/Order.json";
import Transaction from "@/Entities/Transaction.json";
import CashRegister from "@/Entities/CashRegister.json";
import Product from "@/Entities/Product.json";
import Service from "@/Entities/Service.json";
import TimeEntry from "@/Entities/TimeEntry.json";
import CashDrawerMovement from "@/Entities/CashDrawerMovement.json";
import SystemConfig from "@/Entities/SystemConfig.json";
import Sale from "@/Entities/Sale.json";
import DeviceModel from "@/Entities/DeviceModel.json";
import EmailLog from "@/Entities/EmailLog.json";
import InventoryMovement from "@/Entities/InventoryMovement.json";
import AuditLog from "@/Entities/AuditLog.json";
import WorkOrderConfig from "@/Entities/WorkOrderConfig.json";
import DeviceCategory from "@/Entities/DeviceCategory.json";
import Brand from "@/Entities/Brand.json";
import DeviceSubcategory from "@/Entities/DeviceSubcategory.json";
import DeviceFamily from "@/Entities/DeviceFamily.json";
import CatalogImportLog from "@/Entities/CatalogImportLog.json";
import ModelCompatibility from "@/Entities/ModelCompatibility.json";
import WorkOrderEvent from "@/Entities/WorkOrderEvent.json";
import KeyValue from "@/Entities/KeyValue.json";
import CommunicationQueue from "@/Entities/CommunicationQueue.json";
import Role from "@/Entities/Role.json";
import Permission from "@/Entities/Permission.json";
import RolePermission from "@/Entities/RolePermission.json";
import UserRole from "@/Entities/UserRole.json";
import TechnicianProfile from "@/Entities/TechnicianProfile.json";
import TechnicianMetrics from "@/Entities/TechnicianMetrics.json";
import Supplier from "@/Entities/Supplier.json";
import PurchaseOrder from "@/Entities/PurchaseOrder.json";
import AppSettings from "@/Entities/AppSettings.json";
import AppEmployee from "@/Entities/AppEmployee.json";
import Announcement from "@/Entities/Announcement.json";
import ExternalLink from "@/Entities/ExternalLink.json";
import NotificationSettings from "@/Entities/NotificationSettings.json";
import WorkOrderWizardConfig from "@/Entities/WorkOrderWizardConfig.json";
import DiscountCode from "@/Entities/DiscountCode.json";
import BiometricCredential from "@/Entities/BiometricCredential.json";
import Notification from "@/Entities/Notification.json";
import UserNotificationSettings from "@/Entities/UserNotificationSettings.json";
import FixedExpense from "@/Entities/FixedExpense.json";
import FileUpload from "@/Entities/FileUpload.json";
import SequenceCounter from "@/Entities/SequenceCounter.json";
import CustomerPortalToken from "@/Entities/CustomerPortalToken.json";
import PartType from "@/Entities/PartType.json";
import Invoice from "@/Entities/Invoice.json";
import AccessoryCategory from "@/Entities/AccessoryCategory.json";
import PersonalNote from "@/Entities/PersonalNote.json";
import OneTimeExpense from "@/Entities/OneTimeExpense.json";
import Recharge from "@/Entities/Recharge.json";
import EmployeePayment from "@/Entities/EmployeePayment.json";
import NotificationRule from "@/Entities/NotificationRule.json";
import Tenant from "@/Entities/Tenant.json";
import TenantRole from "@/Entities/TenantRole.json";
import TenantMembership from "@/Entities/TenantMembership.json";
import Appointment from "@/Entities/Appointment.json";
import MaintenanceReminder from "@/Entities/MaintenanceReminder.json";
import Subscription from "@/Entities/Subscription.json";
import CommunicationHistory from "@/Entities/CommunicationHistory.json";
import CustomerSegment from "@/Entities/CustomerSegment.json";
import EmailTemplate from "@/Entities/EmailTemplate.json";

export const entitySchemas = {
  Customer,
  Order,
  Transaction,
  CashRegister,
  Product,
  Service,
  TimeEntry,
  CashDrawerMovement,
  SystemConfig,
  Sale,
  DeviceModel,
  EmailLog,
  InventoryMovement,
  AuditLog,
  WorkOrderConfig,
  DeviceCategory,
  Brand,
  DeviceSubcategory,
  DeviceFamily,
  CatalogImportLog,
  ModelCompatibility,
  WorkOrderEvent,
  KeyValue,
  CommunicationQueue,
  Role,
  Permission,
  RolePermission,
  UserRole,
  TechnicianProfile,
  TechnicianMetrics,
  Supplier,
  PurchaseOrder,
  AppSettings,
  AppEmployee,
  Announcement,
  ExternalLink,
  NotificationSettings,
  WorkOrderWizardConfig,
  DiscountCode,
  BiometricCredential,
  Notification,
  UserNotificationSettings,
  FixedExpense,
  FileUpload,
  SequenceCounter,
  CustomerPortalToken,
  PartType,
  Invoice,
  AccessoryCategory,
  PersonalNote,
  OneTimeExpense,
  Recharge,
  EmployeePayment,
  NotificationRule,
  Tenant,
  TenantRole,
  TenantMembership,
  Appointment,
  MaintenanceReminder,
  Subscription,
  CommunicationHistory,
  CustomerSegment,
  EmailTemplate,
};


export const base44 = customClient({
    functionsBaseUrl: import.meta.env.VITE_FUNCTION_URL,
    entitySchemas,
});

const LOCAL_ORDERS_KEY = "smartfix_local_orders";
const LOCAL_ORDER_SEQ_KEY = "smartfix_local_seq_order";
const LOCAL_ORDER_REBASE_ONCE_KEY = "smartfix_local_orders_rebased_v1";
const LOCAL_PRODUCTS_KEY = "smartfix_local_products";
const LOCAL_SERVICES_KEY = "smartfix_local_services";

function canUseLocalStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readLocalOrders() {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_ORDERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function canonicalOrderNumber(orderNumber) {
  const raw = String(orderNumber || "").trim();
  const normalized = raw.match(/^WO-0*(\d+)$/i);
  if (!normalized) return null;
  const n = Number(normalized[1] || 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `WO-${n}`;
}

function extractOrderSequence(orderNumber) {
  const match = String(orderNumber || "").match(/^WO-(\d+)$/i);
  if (!match) return 0;
  const n = Number(match[1] || 0);
  return Number.isFinite(n) ? n : 0;
}

function generateLocalOrderNumber() {
  if (!canUseLocalStorage()) return `WO-${Date.now()}`;
  const existing = migrateLocalOrdersStore();
  const stored = Number(window.localStorage.getItem(LOCAL_ORDER_SEQ_KEY) || 0);
  const safeStored = Number.isFinite(stored) ? stored : 0;
  const next = safeStored > 0 ? safeStored + 1 : (existing?.length || 0) + 1;
  try {
    window.localStorage.setItem(LOCAL_ORDER_SEQ_KEY, String(next));
  } catch {
    // no-op
  }
  return `WO-${next}`;
}

function migrateLocalOrdersStore() {
  if (!canUseLocalStorage()) return [];
  const current = readLocalOrders();
  if (!current.length) return current;
  const alreadyRebased = window.localStorage.getItem(LOCAL_ORDER_REBASE_ONCE_KEY) === "1";

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
    try {
      window.localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(rebased));
      window.localStorage.setItem(LOCAL_ORDER_SEQ_KEY, String(rebased.length));
      window.localStorage.setItem(LOCAL_ORDER_REBASE_ONCE_KEY, "1");
    } catch {
      // no-op
    }
    return rebased;
  }

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

  try {
    if (changed) window.localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(migrated));
    const stored = Number(window.localStorage.getItem(LOCAL_ORDER_SEQ_KEY) || 0);
    window.localStorage.setItem(LOCAL_ORDER_SEQ_KEY, String(Math.max(max, Number.isFinite(stored) ? stored : 0)));
  } catch {
    // no-op
  }
  return migrated;
}

function normalizeLocalOrder(order) {
  if (!order || typeof order !== "object") return null;
  const id =
    order.id ||
    (order.order_number ? `local-order-${String(order.order_number)}` : null) ||
    `local-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    ...order,
    id,
    created_date: order.created_date || new Date().toISOString(),
    status: order.status || "pending",
    customer_name: order.customer_name || "Cliente",
    order_number: canonicalOrderNumber(order.order_number) || generateLocalOrderNumber(),
  };
}

function upsertLocalOrder(order) {
  if (!canUseLocalStorage()) return;
  const incoming = order || {};
  const current = migrateLocalOrdersStore();
  const canonicalIncomingNumber = canonicalOrderNumber(incoming.order_number) || incoming.order_number;
  const existing = current.find((o) =>
    (incoming?.id && String(o?.id) === String(incoming.id)) ||
    (canonicalIncomingNumber && String(o?.order_number) === String(canonicalIncomingNumber))
  );
  const mergedPayload = { ...(existing || {}), ...(incoming || {}) };
  const normalized = normalizeLocalOrder(mergedPayload);
  if (!normalized) return;
  const merged = [
    normalized,
    ...current.filter((o) => !(
      String(o?.id) === String(normalized.id) ||
      (normalized.order_number && String(o?.order_number) === String(normalized.order_number))
    ))
  ].slice(0, 1000);
  try {
    window.localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(merged));
  } catch {
    // no-op
  }
}

function removeLocalOrder(ref) {
  if (!canUseLocalStorage()) return;
  const id = typeof ref === "object" ? ref?.id : ref;
  const orderNumberRaw = typeof ref === "object" ? ref?.order_number : null;
  const orderNumber = canonicalOrderNumber(orderNumberRaw) || (orderNumberRaw ? String(orderNumberRaw).trim() : null);
  const current = migrateLocalOrdersStore();
  const filtered = current.filter((o) => {
    const sameId = id ? String(o?.id) === String(id) : false;
    const currentNumber =
      canonicalOrderNumber(o?.order_number) || (o?.order_number ? String(o.order_number).trim() : null);
    const sameOrderNumber = orderNumber && currentNumber ? String(currentNumber) === String(orderNumber) : false;
    return !(sameId || sameOrderNumber);
  });
  try {
    window.localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(filtered));
  } catch {
    // no-op
  }
}

function mergeOrders(remote = [], local = []) {
  const map = new Map();
  [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])]
    .map(normalizeLocalOrder)
    .filter(Boolean)
    .forEach((order) => {
      const prev = map.get(order.id);
      if (!prev) {
        map.set(order.id, order);
        return;
      }
      const prevTs = new Date(prev.updated_date || prev.created_date || 0).getTime();
      const nextTs = new Date(order.updated_date || order.created_date || 0).getTime();
      if (nextTs >= prevTs) {
        map.set(order.id, { ...prev, ...order });
      } else {
        map.set(order.id, { ...order, ...prev });
      }
    });
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.created_date || 0).getTime() - new Date(a.created_date || 0).getTime()
  );
}

function applyOrderQuery(rows = [], query = {}) {
  const q = query && typeof query === "object" ? query : {};
  const entries = Object.entries(q);
  if (!entries.length) return rows;

  return rows.filter((row) => {
    for (const [key, expected] of entries) {
      const rowValue = row?.[key];

      // deleted: false should include undefined as false
      if (key === "deleted" && expected === false) {
        if (Boolean(rowValue) === true) return false;
        continue;
      }

      if (expected && typeof expected === "object" && !Array.isArray(expected)) {
        if (Array.isArray(expected.$nin)) {
          if (expected.$nin.includes(rowValue)) return false;
          continue;
        }
        if (Array.isArray(expected.$in)) {
          if (!expected.$in.includes(rowValue)) return false;
          continue;
        }
      }

      if (rowValue !== expected) return false;
    }
    return true;
  });
}

function applyOrderSortAndLimit(rows = [], sortBy, limit) {
  const output = [...rows];
  if (typeof sortBy === "string" && sortBy.trim()) {
    const desc = sortBy.startsWith("-");
    const field = desc ? sortBy.slice(1) : sortBy;
    output.sort((a, b) => {
      const av = a?.[field];
      const bv = b?.[field];
      if (field.includes("date")) {
        const at = new Date(av || 0).getTime();
        const bt = new Date(bv || 0).getTime();
        return desc ? bt - at : at - bt;
      }
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return desc ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1);
    });
  }

  if (Number.isFinite(limit) && limit > 0) {
    return output.slice(0, limit);
  }
  return output;
}

function readLocalItems(storageKey) {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeCatalogItem(item) {
  if (!item || typeof item !== "object") return null;
  const signature = [
    String(item.sku || "").trim().toLowerCase(),
    String(item.code || "").trim().toLowerCase(),
    String(item.name || "").trim().toLowerCase(),
    String(item.part_type || "").trim().toLowerCase(),
    String(item.tipo_principal || "").trim().toLowerCase(),
    String(item.price ?? ""),
  ].join("|");
  const id =
    item.id ||
    (item.sku ? `local-item-${String(item.sku)}` : null) ||
    (item.code ? `local-item-${String(item.code)}` : null) ||
    `local-item-${signature || "generic"}`;
  return {
    ...item,
    id,
    name: item.name || "Item",
    active: item.active !== false,
    created_date: item.created_date || new Date().toISOString(),
  };
}

function catalogIdentity(item) {
  if (!item || typeof item !== "object") return "";
  const name = String(item.name || "").trim().toLowerCase();
  const sku = String(item.sku || "").trim().toLowerCase();
  const code = String(item.code || "").trim().toLowerCase();
  const partType = String(item.part_type || "").trim().toLowerCase();
  const mainType = String(item.tipo_principal || "").trim().toLowerCase();
  const sub = String(item.subcategoria || item.category || "").trim().toLowerCase();
  const brand = String(item.brand || item.device_brand || "").trim().toLowerCase();
  const model = String(item.model || item.device_model || "").trim().toLowerCase();
  const price = String(item.price ?? item.sale_price ?? item.regular_price ?? "");
  return [name, sku, code, partType, mainType, sub, brand, model, price].join("|");
}

function upsertLocalItem(storageKey, item) {
  if (!canUseLocalStorage()) return;
  const normalized = normalizeCatalogItem(item);
  if (!normalized) return;
  const current = readLocalItems(storageKey);
  const identity = catalogIdentity(normalized);
  const merged = [
    normalized,
    ...current.filter((o) => {
      const sameId = o?.id === normalized.id;
      const sameIdentity = identity && catalogIdentity(o) === identity;
      return !(sameId || sameIdentity);
    })
  ].slice(0, 2000);
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(merged));
  } catch {
    // no-op
  }
}

function mergeCatalogItems(remote = [], local = []) {
  const map = new Map();
  [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])]
    .map(normalizeCatalogItem)
    .filter(Boolean)
    .forEach((item) => {
      const identity = catalogIdentity(item);
      const key = item.sku || item.code || identity || item.id;
      map.set(key, { ...(map.get(key) || {}), ...item });
    });
  return Array.from(map.values());
}

function wrapCatalogEntity(entity, storageKey) {
  if (!entity) return;

  const originalCreate = entity.create?.bind(entity);
  const originalUpdate = entity.update?.bind(entity);
  const originalList = entity.list?.bind(entity);
  const originalFilter = entity.filter?.bind(entity);

  if (originalCreate) {
    entity.create = async (data) => {
      const created = await originalCreate(data);
      upsertLocalItem(storageKey, created || data);
      return created;
    };
  }

  if (originalUpdate) {
    entity.update = async (id, data) => {
      const updated = await originalUpdate(id, data);
      upsertLocalItem(storageKey, { ...(updated || {}), ...(data || {}), id });
      return updated;
    };
  }

  if (originalList) {
    entity.list = async (...args) => {
      try {
        const remote = await originalList(...args);
        const merged = mergeCatalogItems(remote, readLocalItems(storageKey));
        merged.forEach((item) => upsertLocalItem(storageKey, item));
        return merged;
      } catch (error) {
        console.warn("[base44] Catalog.list fallback local:", error);
        return mergeCatalogItems([], readLocalItems(storageKey));
      }
    };
  }

  if (originalFilter) {
    entity.filter = async (...args) => {
      try {
        const remote = await originalFilter(...args);
        const merged = mergeCatalogItems(remote, readLocalItems(storageKey));
        merged.forEach((item) => upsertLocalItem(storageKey, item));
        return merged;
      } catch (error) {
        console.warn("[base44] Catalog.filter fallback local:", error);
        return mergeCatalogItems([], readLocalItems(storageKey));
      }
    };
  }
}

// Global offline-safe wrapper for orders
if (base44?.entities?.Order) {
  const orderEntity = base44.entities.Order;
  const originalCreate = orderEntity.create?.bind(orderEntity);
  const originalUpdate = orderEntity.update?.bind(orderEntity);
  const originalGet = orderEntity.get?.bind(orderEntity);
  const originalList = orderEntity.list?.bind(orderEntity);
  const originalFilter = orderEntity.filter?.bind(orderEntity);
  const originalDelete = orderEntity.delete?.bind(orderEntity);

  if (originalCreate) {
    orderEntity.create = async (data) => {
      const optimistic = normalizeLocalOrder({
        ...(data || {}),
        id:
          data?.id ||
          `local-order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        created_date: data?.created_date || new Date().toISOString(),
        updated_date: new Date().toISOString(),
      });

      try {
        const created = await originalCreate(data);
        upsertLocalOrder(created || optimistic || data);
        return created || optimistic || data;
      } catch (error) {
        console.warn("[base44] Order.create fallback local:", error);
        upsertLocalOrder(optimistic || data);
        return optimistic || data;
      }
    };
  }

  if (originalUpdate) {
    orderEntity.update = async (id, data) => {
      const optimistic = {
        ...(data || {}),
        id,
        updated_date: data?.updated_date || new Date().toISOString(),
      };
      try {
        const updated = await originalUpdate(id, data);
        upsertLocalOrder({ ...optimistic, ...(updated || {}) });
        return updated;
      } catch (error) {
        console.warn("[base44] Order.update fallback local:", error);
        upsertLocalOrder(optimistic);
        return optimistic;
      }
    };
  }

  if (originalGet) {
    orderEntity.get = async (id, ...rest) => {
      try {
        const remote = await originalGet(id, ...rest);
        if (remote) upsertLocalOrder(remote);
        return remote || mergeOrders([], readLocalOrders()).find((o) => String(o.id) === String(id)) || null;
      } catch (error) {
        console.warn("[base44] Order.get fallback local:", error);
        return mergeOrders([], readLocalOrders()).find((o) => String(o.id) === String(id)) || null;
      }
    };
  }

  if (originalList) {
    orderEntity.list = async (...args) => {
      try {
        const remote = await originalList(...args);
        const merged = mergeOrders(remote, readLocalOrders());
        merged.forEach((o) => upsertLocalOrder(o));
        return merged;
      } catch (error) {
        console.warn("[base44] Order.list fallback local:", error);
        return mergeOrders([], readLocalOrders());
      }
    };
  }

  if (originalFilter) {
    orderEntity.filter = async (...args) => {
      const [query, sortBy, limit] = args;
      try {
        const remote = await originalFilter(...args);
        const merged = mergeOrders(remote, readLocalOrders());
        merged.forEach((o) => upsertLocalOrder(o));
        return applyOrderSortAndLimit(applyOrderQuery(merged, query), sortBy, limit);
      } catch (error) {
        console.warn("[base44] Order.filter fallback local:", error);
        const merged = mergeOrders([], readLocalOrders());
        return applyOrderSortAndLimit(applyOrderQuery(merged, query), sortBy, limit);
      }
    };
  }

  if (originalDelete) {
    orderEntity.delete = async (id, ...rest) => {
      try {
        const deleted = await originalDelete(id, ...rest);
        removeLocalOrder({
          id,
          order_number: deleted?.order_number,
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("workorder-deleted", {
              detail: {
                orderId: id,
                orderNumber: deleted?.order_number || null,
              },
            })
          );
        }
        return deleted;
      } catch (error) {
        console.warn("[base44] Order.delete fallback local:", error);
        removeLocalOrder({ id });
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("workorder-deleted", {
              detail: {
                orderId: id,
                orderNumber: null,
              },
            })
          );
        }
        return { id, deleted: true, local_only: true };
      }
    };
  }
}

// Global offline-safe wrapper for catalog entities
wrapCatalogEntity(base44?.entities?.Product, LOCAL_PRODUCTS_KEY);
wrapCatalogEntity(base44?.entities?.Service, LOCAL_SERVICES_KEY);

// ─── Fase 5b: Tenant-scoped injection ────────────────────────────────────────
// Envuelve entity methods para inyectar tenant_id automáticamente.
// Se aplica DESPUÉS de todos los wrappers offline, por lo que la inyección
// cubre tanto las rutas remotas como los fallbacks locales.
//
// Lógica de seguridad:
//   • Si no hay tenant_id en sesión → pasa sin cambios (modo single-tenant).
//   • list()   → se convierte en filter({ tenant_id }) para filtrar en la DB.
//   • filter() → merge de tenant_id en las condiciones.
//   • create() → agrega tenant_id al payload (solo si no viene ya).
//   • get / update / delete → sin cambios (operan por id).
function getTenantIdFromSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.tenant_id) return session.tenant_id;
    }
    return localStorage.getItem("smartfix_tenant_id") || null;
  } catch {
    return null;
  }
}

function applyTenantScope(entity) {
  if (!entity) return;
  const origList   = entity.list?.bind(entity);
  const origFilter = entity.filter?.bind(entity);
  const origCreate = entity.create?.bind(entity);

  if (origList) {
    entity.list = async (order, limit, ...rest) => {
      const tid = getTenantIdFromSession();
      if (tid) return entity.filter({ tenant_id: tid }, order, limit, ...rest);
      return origList(order, limit, ...rest);
    };
  }
  if (origFilter) {
    entity.filter = async (q = {}, order, limit, ...rest) => {
      const tid = getTenantIdFromSession();
      if (tid) return origFilter({ ...q, tenant_id: tid }, order, limit, ...rest);
      return origFilter(q, order, limit, ...rest);
    };
  }
  if (origCreate) {
    entity.create = async (data) => {
      const tid = getTenantIdFromSession();
      if (tid && !data?.tenant_id) return origCreate({ ...data, tenant_id: tid });
      return origCreate(data);
    };
  }
}

// Entidades con columna tenant_id en la DB (ver 008_tenant_isolation.sql).
// DeviceCategory, Brand, DeviceModel, DeviceFamily, DeviceSubcategory, Tenant,
// TenantMembership, TenantRole, Subscription, AppSettings, SystemConfig son
// globales/catálogo — no se les inyecta tenant_id.
const TENANT_SCOPED_ENTITIES = [
  "Customer", "Order", "WorkOrderEvent", "Sale", "Transaction",
  "CashRegister", "CashDrawerMovement", "Product", "Service",
  "InventoryMovement", "User", "Notification", "ExternalLink",
  "TimeEntry", "AuditLog", "WorkOrderWizardConfig", "WorkOrderConfig",
  "DiscountCode", "CustomerPortalToken", "Announcement", "SequenceCounter",
  "Invoice", "PersonalNote", "OneTimeExpense", "Recharge", "FixedExpense",
  "NotificationRule", "TechnicianProfile", "TechnicianMetrics", "Supplier",
  "PurchaseOrder", "AppEmployee", "BiometricCredential", "CustomerSegment",
  "Appointment", "KeyValue", "CommunicationHistory", "CommunicationQueue",
  "MaintenanceReminder", "FileUpload", "EmailTemplate", "EmailLog",
  "NotificationSettings",
];

for (const name of TENANT_SCOPED_ENTITIES) {
  applyTenantScope(base44?.entities?.[name]);
}
