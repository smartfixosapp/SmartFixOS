// ============================================
// 👈 MIGRACIÓN: Data Client - Adapter Unificado
// Capa de abstracción sobre Base44 (hoy) y Neon (futuro)
// ============================================

import appClient from "@/api/appClient";

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
      if (session?.user?.tenant_id) return session.user.tenant_id;
      if (session?.session?.tenant_id) return session.session.tenant_id;
    }
    // Fallback: clave directa (guardada por PinAccess durante resolución de admin)
    return (
      localStorage.getItem("smartfix_tenant_id") ||
      localStorage.getItem("current_tenant_id") ||
      sessionStorage.getItem("current_tenant_id") ||
      null
    );
  } catch {
    return (
      localStorage.getItem("smartfix_tenant_id") ||
      localStorage.getItem("current_tenant_id") ||
      sessionStorage.getItem("current_tenant_id") ||
      null
    );
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
const appClientAdapter = {
  entities: {
    // ── Entidades con tenant_id (inyección automática) ──────────────────────
    Customer:            tenantScoped(appClient.entities.Customer),
    Order:               tenantScoped(appClient.entities.Order),
    WorkOrderEvent:      tenantScoped(appClient.entities.WorkOrderEvent),
    Sale:                tenantScoped(appClient.entities.Sale),
    Transaction:         tenantScoped(appClient.entities.Transaction),
    CashRegister:        tenantScoped(appClient.entities.CashRegister),
    CashDrawerMovement:  tenantScoped(appClient.entities.CashDrawerMovement),
    Product:             tenantScoped(appClient.entities.Product),
    Service:             tenantScoped(appClient.entities.Service),
    InventoryMovement:   tenantScoped(appClient.entities.InventoryMovement),
    User:                tenantScoped(appClient.entities.User),
    Notification:        tenantScoped(appClient.entities.Notification),
    ExternalLink:        tenantScoped(appClient.entities.ExternalLink),
    TimeEntry:           tenantScoped(appClient.entities.TimeEntry),
    AuditLog:            tenantScoped(appClient.entities.AuditLog),
    WorkOrderWizardConfig: tenantScoped(appClient.entities.WorkOrderWizardConfig),
    DiscountCode:        tenantScoped(appClient.entities.DiscountCode),
    CustomerPortalToken: tenantScoped(appClient.entities.CustomerPortalToken),
    Announcement:        tenantScoped(appClient.entities.Announcement),
    SequenceCounter:     tenantScoped(appClient.entities.SequenceCounter),
    Invoice:             tenantScoped(appClient.entities.Invoice),
    PersonalNote:        tenantScoped(appClient.entities.PersonalNote),
    OneTimeExpense:      tenantScoped(appClient.entities.OneTimeExpense),
    Recharge:            tenantScoped(appClient.entities.Recharge),
    FixedExpense:        tenantScoped(appClient.entities.FixedExpense),
    NotificationRule:    tenantScoped(appClient.entities.NotificationRule),
    TechnicianProfile:   tenantScoped(appClient.entities.TechnicianProfile),
    PurchaseOrder:       tenantScoped(appClient.entities.PurchaseOrder),
    EmployeePayment:     tenantScoped(appClient.entities.EmployeePayment),
    KeyValue:            tenantScoped(appClient.entities.KeyValue),

    // ── Entidades globales / catálogo (sin tenant_id) ────────────────────────
    // device_category, brand, device_model no tienen columna tenant_id en la DB.
    DeviceCategory: {
      list: (order, limit) => appClient.entities.DeviceCategory.list(order, limit),
      filter: (q, order) => appClient.entities.DeviceCategory.filter(q, order),
      create: (data) => appClient.entities.DeviceCategory.create(data),
      update: (id, data) => appClient.entities.DeviceCategory.update(id, data),
      delete: (id) => appClient.entities.DeviceCategory.delete(id),
    },
    Brand: {
      list: (order, limit) => appClient.entities.Brand.list(order, limit),
      filter: (q, order) => appClient.entities.Brand.filter(q, order),
      create: (data) => appClient.entities.Brand.create(data),
      update: (id, data) => appClient.entities.Brand.update(id, data),
      delete: (id) => appClient.entities.Brand.delete(id),
    },
    DeviceModel: {
      list: (order, limit) => appClient.entities.DeviceModel.list(order, limit),
      filter: (q, order) => appClient.entities.DeviceModel.filter(q, order),
      create: (data) => appClient.entities.DeviceModel.create(data),
      update: (id, data) => appClient.entities.DeviceModel.update(id, data),
      delete: (id) => appClient.entities.DeviceModel.delete(id),
    },
    // Tenant — acceso global (no scoped, Tenant ES el tenant root)
    Tenant: {
      list:   (order, limit) => appClient.entities.Tenant.list(order, limit),
      filter: (q, order)     => appClient.entities.Tenant.filter(q, order),
      get:    (id)           => appClient.entities.Tenant.get(id),
      update: (id, data)     => appClient.entities.Tenant.update(id, data),
      delete: (id)           => appClient.entities.Tenant.delete(id),
    },
    // AppEmployee — acceso global para queries de superadmin, etc.
    AppEmployee: {
      list:   (order, limit) => appClient.entities.AppEmployee.list(order, limit),
      filter: (q, order)     => appClient.entities.AppEmployee.filter(q, order),
      get:    (id)           => appClient.entities.AppEmployee.get(id),
      create: (data)         => appClient.entities.AppEmployee.create(data),
      update: (id, data)     => appClient.entities.AppEmployee.update(id, data),
      delete: (id)           => appClient.entities.AppEmployee.delete(id),
    },
    // AppSettings y SystemConfig se acceden por slug; no filtrar por tenant_id
    // para evitar romper registros existentes sin tenant_id asignado.
    AppSettings: {
      list: (order, limit) => appClient.entities.AppSettings.list(order, limit),
      filter: (q, order) => appClient.entities.AppSettings.filter(q, order),
      create: (data) => appClient.entities.AppSettings.create(data),
      update: (id, data) => appClient.entities.AppSettings.update(id, data),
    },
    SystemConfig: {
      filter: (q, order) => appClient.entities.SystemConfig.filter(q, order),
      create: (data) => appClient.entities.SystemConfig.create(data),
      update: (id, data) => appClient.entities.SystemConfig.update(id, data),
    },
    // AppUpdate — novedades del sistema, visibles en PinAccess (sin tenant filter)
    AppUpdate: {
      list:   (order, limit) => appClient.entities.AppUpdate.list(order, limit),
      filter: (q, order)     => appClient.entities.AppUpdate.filter(q, order),
      get:    (id)           => appClient.entities.AppUpdate.get(id),
      create: (data)         => appClient.entities.AppUpdate.create(data),
      update: (id, data)     => appClient.entities.AppUpdate.update(id, data),
      delete: (id)           => appClient.entities.AppUpdate.delete(id),
    },
  },
  auth: {
    me: async () => {
      // 🔄 Inteligent Retry: Wait for Supabase session to settle on mobile
      let attempts = 0;
      const maxAttempts = 15; // 15 * 200ms = 3.0s total wait
      
      while (attempts < maxAttempts) {
        try {
          const user = await appClient.auth.me();
          if (user) {
            console.log("✅ Auth: me() success!");
            return user;
          }
          
          // Check for session evidence silently
          const empKey = localStorage.getItem('employee_session');
          const sbKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
          
          if (!empKey && !sbKey) break; 
          
          await new Promise(r => setTimeout(r, 200));
          attempts++;
        } catch (error) {
          await new Promise(r => setTimeout(r, 200));
          attempts++;
        }
      }

      try {
        const user = await appClient.auth.me();
        return user || null;
      } catch (error) {
        // Only log CRITICAL error if we are NOT on a public/auth path
        const publicPaths = ['/Welcome', '/PinAccess', '/Setup', '/InitialSetup', '/Activate'];
        const isPublic = publicPaths.some(p => window.location.pathname.includes(p));
        
        if (!isPublic) {
          console.error("🔴 CRITICAL: Auth connection failed:", error?.message || error);
        }
        return null;
      }
    },
    updateMe: async (data) => {
      try {
        return await appClient.auth.updateMe(data);
      } catch (e) {
        console.warn("⚠️ UpdateMe falló (Posible modo standalone)", e);
        return { ...MOCK_ADMIN_USER, ...data };
      }
    },
    redirectToLogin: (nextUrl) => {
      try {
        return appClient.auth.redirectToLogin?.(nextUrl);
      } catch (e) {
        console.warn("⚠️ RedirectLogin ignorado en modo standalone");
        window.location.href = "/"; // Fallback simple
      }
    },
    logout: (redirectUrl) => {
      try {
        return appClient.auth.logout?.(redirectUrl);
      } catch (e) {
        console.warn("⚠️ Logout ignorado en modo standalone");
        window.location.reload();
      }
    },
  },
  mail: {
    send: (payload) => appClient.integrations?.Core?.SendEmail
      ? appClient.integrations.Core.SendEmail(payload)
      : Promise.reject(new Error("Email integration not available")),
  },
  files: {
    upload: (file) => appClient.integrations?.Core?.UploadFile
      ? appClient.integrations.Core.UploadFile({ file })
      : Promise.reject(new Error("Upload integration not available")),
  },
};

// 👈 MIGRACIÓN: Export único para toda la app
export const dataClient = appClientAdapter;

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
