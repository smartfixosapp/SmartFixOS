// ============================================
// 👈 MIGRACIÓN: Data Client - Adapter Unificado
// Capa de abstracción sobre Base44 (hoy) y Neon (futuro)
// ============================================

import { base44 } from "@/api/base44Client";

// 🛡️ MODO STANDALONE / EXPORT-SAFE
// Usuario simulado para garantizar acceso administrativo fuera del entorno Base44
// (Netlify, Localhost, etc) cuando no hay conexión con el backend de auth.
const MOCK_ADMIN_USER = {
  id: "standalone-admin",
  email: "admin@export.local",
  full_name: "Admin (Modo Standalone)",
  role: "admin",
  permissions: ["all"],
  is_mock: true
};

// ─── Fase 5b: Multi-tenant injection ─────────────────────────────────────────
// Lee el tenant_id de la sesión activa (guardado en PinAccess al hacer login).
// Devuelve null si el usuario aún no está autenticado.
function getTenantId() {
  try {
    const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
    if (raw) {
      const session = JSON.parse(raw);
      if (session?.tenant_id) return session.tenant_id;
    }
    // Fallback: clave directa (guardada por PinAccess durante resolución de admin)
    return localStorage.getItem("smartfix_tenant_id") || null;
  } catch {
    return null;
  }
}

/**
 * Envuelve una entidad del SDK para inyectar tenant_id automáticamente en:
 *   - list()   → convierte en filter({ tenant_id }) cuando hay sesión
 *   - filter() → agrega tenant_id al objeto de condiciones
 *   - create() → agrega tenant_id al objeto de datos
 * get / update / delete no cambian (operan por id, no necesitan filtro de tenant).
 *
 * Si no hay tenant_id en sesión (ej: primera vez, setup inicial) las operaciones
 * pasan sin cambios para mantener compatibilidad con el modo single-tenant.
 */
function tenantScoped(entity) {
  return {
    // Pass-throughs explícitos para métodos que no llevan filtro tenant
    // (los métodos están en el prototype del entity, no en sus propias props,
    //  por eso el spread ...entity no los incluye confiablemente)
    get:    (id)           => entity.get(id),
    update: (id, data)     => entity.update(id, data),
    delete: (id)           => entity.delete(id),
    // Métodos que SÍ inyectan tenant_id
    list(order, limit) {
      const tid = getTenantId();
      if (tid) return entity.filter({ tenant_id: tid }, order, limit);
      return entity.list(order, limit);
    },
    filter(q = {}, order, limit) {
      const tid = getTenantId();
      if (tid) return entity.filter({ ...q, tenant_id: tid }, order, limit);
      return entity.filter(q, order, limit);
    },
    create(data) {
      const tid = getTenantId();
      if (tid && !data?.tenant_id) return entity.create({ ...data, tenant_id: tid });
      return entity.create(data);
    },
  };
}

// 👈 MIGRACIÓN: Adaptador Base44 (1:1 con API actual)
const base44Adapter = {
  entities: {
    // ── Entidades con tenant_id (inyección automática) ──────────────────────
    Customer:            tenantScoped({ ...base44.entities.Customer }),
    Order:               tenantScoped({ ...base44.entities.Order }),
    WorkOrderEvent:      tenantScoped({ ...base44.entities.WorkOrderEvent }),
    Sale:                tenantScoped({ ...base44.entities.Sale }),
    Transaction:         tenantScoped({ ...base44.entities.Transaction }),
    CashRegister:        tenantScoped({ ...base44.entities.CashRegister }),
    CashDrawerMovement:  tenantScoped({ ...base44.entities.CashDrawerMovement }),
    Product:             tenantScoped({ ...base44.entities.Product }),
    Service:             tenantScoped({ ...base44.entities.Service }),
    InventoryMovement:   tenantScoped({ ...base44.entities.InventoryMovement }),
    User:                tenantScoped({ ...base44.entities.User }),
    Notification:        tenantScoped({ ...base44.entities.Notification }),
    ExternalLink:        tenantScoped({ ...base44.entities.ExternalLink }),
    TimeEntry:           tenantScoped({ ...base44.entities.TimeEntry }),
    AuditLog:            tenantScoped({ ...base44.entities.AuditLog }),
    WorkOrderWizardConfig: tenantScoped({ ...base44.entities.WorkOrderWizardConfig }),
    DiscountCode:        tenantScoped({ ...base44.entities.DiscountCode }),
    CustomerPortalToken: tenantScoped({ ...base44.entities.CustomerPortalToken }),
    Announcement:        tenantScoped({ ...base44.entities.Announcement }),
    SequenceCounter:     tenantScoped({ ...base44.entities.SequenceCounter }),
    Invoice:             tenantScoped({ ...base44.entities.Invoice }),
    PersonalNote:        tenantScoped({ ...base44.entities.PersonalNote }),
    OneTimeExpense:      tenantScoped({ ...base44.entities.OneTimeExpense }),
    Recharge:            tenantScoped({ ...base44.entities.Recharge }),
    FixedExpense:        tenantScoped({ ...base44.entities.FixedExpense }),
    NotificationRule:    tenantScoped({ ...base44.entities.NotificationRule }),
    TechnicianProfile:   tenantScoped({ ...base44.entities.TechnicianProfile }),
    PurchaseOrder:       tenantScoped({ ...base44.entities.PurchaseOrder }),
    EmployeePayment:     tenantScoped({ ...base44.entities.EmployeePayment }),
    KeyValue:            tenantScoped({ ...base44.entities.KeyValue }),

    // ── Entidades globales / catálogo (sin tenant_id) ────────────────────────
    // device_category, brand, device_model no tienen columna tenant_id en la DB.
    DeviceCategory: {
      list: (order, limit) => base44.entities.DeviceCategory.list(order, limit),
      filter: (q, order) => base44.entities.DeviceCategory.filter(q, order),
      create: (data) => base44.entities.DeviceCategory.create(data),
      update: (id, data) => base44.entities.DeviceCategory.update(id, data),
      delete: (id) => base44.entities.DeviceCategory.delete(id),
    },
    Brand: {
      list: (order, limit) => base44.entities.Brand.list(order, limit),
      filter: (q, order) => base44.entities.Brand.filter(q, order),
      create: (data) => base44.entities.Brand.create(data),
      update: (id, data) => base44.entities.Brand.update(id, data),
      delete: (id) => base44.entities.Brand.delete(id),
    },
    DeviceModel: {
      list: (order, limit) => base44.entities.DeviceModel.list(order, limit),
      filter: (q, order) => base44.entities.DeviceModel.filter(q, order),
      create: (data) => base44.entities.DeviceModel.create(data),
      update: (id, data) => base44.entities.DeviceModel.update(id, data),
      delete: (id) => base44.entities.DeviceModel.delete(id),
    },
    // Tenant — acceso global (no scoped, Tenant ES el tenant root)
    Tenant: {
      list:   (order, limit) => base44.entities.Tenant.list(order, limit),
      filter: (q, order)     => base44.entities.Tenant.filter(q, order),
      get:    (id)           => base44.entities.Tenant.get(id),
      update: (id, data)     => base44.entities.Tenant.update(id, data),
      delete: (id)           => base44.entities.Tenant.delete(id),
    },
    // AppEmployee — acceso global para queries de superadmin, etc.
    AppEmployee: {
      list:   (order, limit) => base44.entities.AppEmployee.list(order, limit),
      filter: (q, order)     => base44.entities.AppEmployee.filter(q, order),
      get:    (id)           => base44.entities.AppEmployee.get(id),
      create: (data)         => base44.entities.AppEmployee.create(data),
      update: (id, data)     => base44.entities.AppEmployee.update(id, data),
      delete: (id)           => base44.entities.AppEmployee.delete(id),
    },
    // AppSettings y SystemConfig se acceden por slug; no filtrar por tenant_id
    // para evitar romper registros existentes sin tenant_id asignado.
    AppSettings: {
      list: (order, limit) => base44.entities.AppSettings.list(order, limit),
      filter: (q, order) => base44.entities.AppSettings.filter(q, order),
      create: (data) => base44.entities.AppSettings.create(data),
      update: (id, data) => base44.entities.AppSettings.update(id, data),
    },
    SystemConfig: {
      filter: (q, order) => base44.entities.SystemConfig.filter(q, order),
      create: (data) => base44.entities.SystemConfig.create(data),
      update: (id, data) => base44.entities.SystemConfig.update(id, data),
    },
  },
  auth: {
    me: async () => {
      try {
        // 🔐 SOLO autenticación real Base44 - SIN MOCK
        const user = await base44.auth.me();
        if (!user) {
          console.warn("⚠️ Auth: No authenticated. Retornando null.");
          return null;
        }
        return user;
      } catch (error) {
        console.error("🔴 CRITICAL: Auth connection failed", error);
        return null; // No fallback to mock
      }
    },
    updateMe: async (data) => {
      try {
        return await base44.auth.updateMe(data);
      } catch (e) {
        console.warn("⚠️ UpdateMe falló (Posible modo standalone)", e);
        return { ...MOCK_ADMIN_USER, ...data };
      }
    },
    redirectToLogin: (nextUrl) => {
      try {
        return base44.auth.redirectToLogin?.(nextUrl);
      } catch (e) {
        console.warn("⚠️ RedirectLogin ignorado en modo standalone");
        window.location.href = "/"; // Fallback simple
      }
    },
    logout: (redirectUrl) => {
      try {
        return base44.auth.logout?.(redirectUrl);
      } catch (e) {
        console.warn("⚠️ Logout ignorado en modo standalone");
        window.location.reload();
      }
    },
  },
  mail: {
    send: (payload) => base44.integrations?.Core?.SendEmail
      ? base44.integrations.Core.SendEmail(payload)
      : Promise.reject(new Error("Email integration not available")),
  },
  files: {
    upload: (file) => base44.integrations?.Core?.UploadFile
      ? base44.integrations.Core.UploadFile({ file })
      : Promise.reject(new Error("Upload integration not available")),
  },
};

// 👈 MIGRACIÓN: Export único para toda la app
export const dataClient = base44Adapter;

// 👈 MIGRACIÓN: Helper para debugging
export const getActiveBackend = () => "supabase";

// 👈 MIGRACIÓN: Log de inicialización
console.log(`
╔════════════════════════════════════════╗
║  🔄 DATA CLIENT INITIALIZATION        ║
║  Backend: SUPABASE                    ║
║  Mode: Unified SDK (Supabase)         ║
╚════════════════════════════════════════╝
`);
