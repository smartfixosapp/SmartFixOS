/**
 * Master Settings Service
 * 
 * Gestiona configuración jerárquica de la aplicación con soporte para:
 * - Overrides por scope (global → tenant → location → role → user)
 * - Migración de configuraciones legacy
 * - Reactividad mediante SettingsBus
 */

import { base44 } from "@/api/base44Client";
import { SettingsBus } from "@/components/events/SettingsBus";

// ==================== DEFAULT SETTINGS ====================
export const DEFAULT_MASTER_SETTINGS = {
  ui: {
    theme: "dark", // dark | light | system
    accent_color: "#FF0000",
    density: "comfortable", // compact | comfortable | spacious
    dialogs: {
      zIndex: 50,
      forceTopLayer: true,
      backdropBlur: true
    },
    animations: {
      enabled: true,
      duration: 200 // ms
    }
  },

  dashboard: {
    columns: 4,
    cards: {
      revenue: { enabled: true, order: 0 },
      tickets_open: { enabled: true, order: 1 },
      inventory_low: { enabled: true, order: 2 },
      b2b_pipeline: { enabled: true, order: 3 },
      recent_orders: { enabled: true, order: 4, limit: 12 },
      price_list: { enabled: true, order: 5, limit: 30 }
    },
    refresh_interval: 60000 // ms
  },

  orders: {
    list_view: {
      default_view: "board", // board | list
      column_count: 3,
      limit_per_column: 8,
      show_b2b_hub: true,
      hide_closed_by_default: true
    },
    filters: {
      show_priority_toggle: true,
      show_mine_toggle: true,
      show_b2b_toggle: true
    },
    auto_refresh: true,
    refresh_interval: 60000
  },

  workorder: {
    wizard: {
      steps_order: [
        "customer", "brand", "subcategory", "family", "model",
        "problem", "security", "checklist", "assignment", "signature", "summary"
      ],
      steps_enabled: {
        customer: true,
        brand: true,
        subcategory: true,
        family: true,
        model: true,
        problem: true,
        security: true,
        checklist: true,
        assignment: true,
        signature: true,
        summary: true
      },
      auto_advance: true,
      signature_policy: "allow_later", // required_before_create | allow_later | optional
      require_family_by_brand: {
        apple: "skip", // skip | auto | required
        samsung: "required",
        default: "auto"
      },
      media: {
        require_photo_on_intake: false,
        max_photo_size_mb: 10,
        allow_video: true,
        max_video_size_mb: 50
      }
    },
    panel: {
      timeline: {
        enable_images: true,
        lightbox: true,
        swipe_navigation: true
      },
      comments: {
        enable_mentions: true,
        enable_attachments: true
      },
      default_view: "summary" // summary | timeline | checklist
    }
  },

  inventory: {
    low_stock_threshold: 5,
    allow_negative_stock: false,
    sku_format: "AUTO", // AUTO | MANUAL | BARCODE
    auto_generate_barcodes: true,
    track_variants: false,
    track_serials: true,
    stock_alerts: {
      enabled: true,
      notify_roles: ["admin", "manager"]
    }
  },

  purchasing: {
    po_prefix: "PO-",
    require_approval_over_amount: 500,
    default_terms: "NET-30",
    auto_create_from_low_stock: false,
    preferred_suppliers: []
  },

  reports: {
    enabled: true,
    date_defaults: {
      sales: "today",
      inventory: "current",
      employee: "this_week"
    },
    export_formats: ["csv", "xlsx", "pdf"],
    auto_email_daily: false,
    recipients: []
  },

  printing: {
    templates: {
      workorder_ticket: "default", // default | compact | detailed
      receipt: "standard"
    },
    options: {
      show_logo: true,
      show_qr: true,
      show_barcode: true,
      show_photos: false
    },
    label_size: "4x6", // 4x6 | 4x4 | thermal
    printer_defaults: {
      workorder: "default",
      receipt: "default",
      label: "default"
    }
  },

  integrations: {
    google_drive: {
      enabled: false,
      client_id: "",
      folder_id: ""
    },
    slack: {
      enabled: false,
      webhook_url: "",
      channel: "#workorders"
    },
    quickbooks: {
      enabled: false,
      company_id: "",
      sync_invoices: false
    }
  },

  notifications: {
    email: {
      enabled: true,
      from_name: "911 SmartFix",
      from_email: "no-reply@911smartfix.com"
    },
    sms: {
      enabled: false,
      provider: "twilio"
    },
    push: {
      enabled: false
    },
    rules: {
      workorder_created_customer: { email: true, sms: false, push: false },
      workorder_status_changed: { email: true, sms: false, push: false },
      workorder_ready_for_pickup: { email: true, sms: true, push: false },
      low_stock_alert: { email: true, sms: false, push: false },
      daily_summary: { email: false, sms: false, push: false }
    }
  },

  users: {
    roles: {
      admin: {
        permissions: ["*"]
      },
      manager: {
        permissions: [
          "view_reports", "view_financials", "manage_inventory",
          "manage_employees", "manage_cash_drawer", "create_orders",
          "process_sales", "apply_discounts", "process_refunds",
          "edit_time_entries"
        ]
      },
      technician: {
        permissions: [
          "create_orders", "view_assigned_orders", "update_order_status",
          "add_photos", "add_notes"
        ]
      },
      service: {
        permissions: [
          "create_orders", "process_sales", "view_orders", "add_notes"
        ]
      }
    },
    password_policy: {
      min_length: 4,
      require_pin: true,
      pin_length: 4
    }
  },

  security: {
    session_timeout_minutes: 480, // 8 hours
    mfa_enabled: false,
    pin_auth_enabled: true,
    require_pin_change_days: 0, // 0 = never
    max_failed_attempts: 5
  },

  media: {
    max_upload_mb: 10,
    image_quality: 0.85,
    auto_resize: true,
    max_width: 1920,
    max_height: 1920,
    allowed_types: ["image/jpeg", "image/png", "image/webp", "video/mp4"]
  },

  performance: {
    poll_interval_ms: 60000,
    lazy_load_lists: true,
    virtual_scroll_threshold: 100,
    cache_ttl_seconds: 300
  },

  multi_tenancy: {
    mode: "single", // single | multi
    isolation: "strict", // strict | soft
    allow_cross_tenant: false,
    default_tenant: "main"
  }
};

// ==================== SCOPE RESOLUTION ====================
const SCOPE_HIERARCHY = ["global", "tenant", "location", "role", "user"];

/**
 * Obtiene un setting con resolución jerárquica
 * @param {string} path - Ruta al setting (ej: "workorder.wizard.auto_advance")
 * @param {Object} context - { tenant?, location?, role?, user? }
 * @returns {{ value: any, source: string }}
 */
export function getSetting(path, context = {}) {
  const keys = path.split(".");
  let value = keys.reduce((obj, key) => obj?.[key], DEFAULT_MASTER_SETTINGS);
  let source = "default";

  // Cargar settings en memoria (cache simple)
  const cached = window.__masterSettingsCache || {};

  // Revisar jerarquía
  for (const scope of SCOPE_HIERARCHY) {
    const scopeKey = buildScopeKey(scope, context);
    const scopeSettings = cached[scopeKey];
    
    if (scopeSettings) {
      const scopeValue = keys.reduce((obj, key) => obj?.[key], scopeSettings);
      if (scopeValue !== undefined) {
        value = scopeValue;
        source = scopeKey;
      }
    }
  }

  return { value, source };
}

// ==================== PERSISTENCIA ====================

function buildScopeKey(scope, context = {}) {
  if (scope === "global") return "master.settings";
  if (scope === "tenant" && context.tenant) return `master.settings.tenant.${context.tenant}`;
  if (scope === "location" && context.location) return `master.settings.location.${context.location}`;
  if (scope === "role" && context.role) return `master.settings.role.${context.role}`;
  if (scope === "user" && context.user) return `master.settings.user.${context.user}`;
  return "master.settings";
}

/**
 * Carga settings desde SystemConfig
 */
export async function loadMasterSettings(scope = "global", context = {}) {
  const key = buildScopeKey(scope, context);
  
  try {
    const rows = await base44.entities.SystemConfig.filter({ key });
    
    if (rows?.length) {
      const raw = rows[0].value;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      
      // Actualizar cache
      if (!window.__masterSettingsCache) window.__masterSettingsCache = {};
      window.__masterSettingsCache[key] = parsed;
      
      return parsed;
    }
    
    // Si es global y no existe, crear con defaults
    if (scope === "global") {
      await saveMasterSettings("global", DEFAULT_MASTER_SETTINGS);
      return DEFAULT_MASTER_SETTINGS;
    }
    
    return null;
  } catch (error) {
    console.error("Error loading master settings:", error);
    return scope === "global" ? DEFAULT_MASTER_SETTINGS : null;
  }
}

/**
 * Guarda settings en SystemConfig
 */
export async function saveMasterSettings(scope = "global", settings, context = {}) {
  const key = buildScopeKey(scope, context);
  
  try {
    // Obtener diff (comparar con versión anterior)
    const oldSettings = window.__masterSettingsCache?.[key] || {};
    const diff = computeDiff(oldSettings, settings);
    
    // Persistir
    const existing = await base44.entities.SystemConfig.filter({ key });
    const value = JSON.stringify(settings);
    
    if (existing?.length) {
      await base44.entities.SystemConfig.update(existing[0].id, { value });
    } else {
      await base44.entities.SystemConfig.create({
        key,
        value,
        category: "general",
        description: `Master settings for scope: ${key}`
      });
    }
    
    // Actualizar cache
    if (!window.__masterSettingsCache) window.__masterSettingsCache = {};
    window.__masterSettingsCache[key] = settings;
    
    // Compatibilidad con wizard_config legacy
    if (diff.workorder?.wizard) {
      await saveLegacyWizardConfig(settings.workorder.wizard);
    }
    
    // Auditoría
    await auditSettingsChange(scope, context, diff);
    
    // Emitir evento
    SettingsBus.emit("settings:changed", { scope, context, diff, settings });
    
    return true;
  } catch (error) {
    console.error("Error saving master settings:", error);
    return false;
  }
}

/**
 * Migra settings de wizard_config a master.settings
 */
async function saveLegacyWizardConfig(wizardSettings) {
  try {
    const existing = await base44.entities.WorkOrderConfig.filter({ key: "wizard_config" });
    
    const legacyFormat = {
      key: "wizard_config",
      steps_order: wizardSettings.steps_order,
      steps_enabled: wizardSettings.steps_enabled
    };
    
    if (existing?.length) {
      await base44.entities.WorkOrderConfig.update(existing[0].id, legacyFormat);
    } else {
      await base44.entities.WorkOrderConfig.create(legacyFormat);
    }
  } catch (error) {
    console.error("Error syncing legacy wizard config:", error);
  }
}

/**
 * Registra cambio en audit log
 */
async function auditSettingsChange(scope, context, diff) {
  try {
    const user = await base44.auth.me().catch(() => null);
    
    await base44.entities.AuditLog.create({
      action: "update_master_settings",
      entity_type: "config",
      entity_id: buildScopeKey(scope, context),
      user_id: user?.id || "system",
      user_name: user?.full_name || "System",
      user_role: user?.role || "system",
      changes: diff,
      metadata: { scope, context }
    });
  } catch (error) {
    console.error("Error logging settings audit:", error);
  }
}

/**
 * Computa diferencias entre dos objetos
 */
function computeDiff(oldObj, newObj, path = "") {
  const diff = {};
  
  const allKeys = new Set([
    ...Object.keys(oldObj || {}),
    ...Object.keys(newObj || {})
  ]);
  
  for (const key of allKeys) {
    const oldVal = oldObj?.[key];
    const newVal = newObj?.[key];
    
    if (typeof newVal === "object" && newVal !== null && !Array.isArray(newVal)) {
      const nested = computeDiff(oldVal, newVal, `${path}${key}.`);
      if (Object.keys(nested).length > 0) {
        diff[key] = nested;
      }
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      diff[key] = { from: oldVal, to: newVal };
    }
  }
  
  return diff;
}

/**
 * Exporta settings como JSON
 */
export function exportSettings(settings) {
  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `master-settings-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Importa settings desde JSON
 */
export async function importSettings(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        resolve(settings);
      } catch (error) {
        reject(new Error("Invalid JSON file"));
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
