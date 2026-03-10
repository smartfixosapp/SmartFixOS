// ============================================
// 👈 MIGRACIÓN: Data Client Layer
// Capa de adaptación para migrar de Base44 → Neon
// Variable de entorno: VITE_DATA_BACKEND=base44|neon
// ============================================

import { base44 } from "@/api/base44Client";

// ============================================
// 👈 MIGRACIÓN: Utilities - Retry & Error Handling
// ============================================

// 👈 MIGRACIÓN: Wrapper con timeout, reintentos y logging
async function fetchJSON(path, options = {}, retries = 2) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[NEON] 🔄 Request: ${path} (attempt ${attempt + 1}/${retries + 1})`);

      const response = await fetch(path, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      // 👈 MIGRACIÓN: Reintentar en errores de servidor
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        console.warn(`[NEON] ⚠️ Server error ${response.status}, retrying...`);
        lastError = new Error(`Server error: ${response.status}`);
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Backoff
          continue;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      console.log(`[NEON] ✅ Success: ${path} (${result.data?.length || 0} records)`);
      
      return result;

    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error;

      if (error.name === 'AbortError') {
        console.warn(`[NEON] ⏱️ Timeout on ${path}`);
      } else {
        console.warn(`[NEON] ❌ Error on ${path}:`, error.message);
      }

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  // 👈 MIGRACIÓN: Si todos los reintentos fallan
  console.error(`[NEON] 💥 Failed after ${retries + 1} attempts: ${path}`);
  throw lastError;
}

// ============================================
// BASE44 ADAPTER (Actual - Sin cambios)
// ============================================

// 👈 MIGRACIÓN: Adapter para Base44 - usa la API actual
const createBase44Adapter = (entityName) => ({
  async list(sort = "-created_date", limit = 100) {
    return await base44.entities[entityName].list(sort, limit);
  },

  async filter(query, sort = "-created_date", limit = 100) {
    return await base44.entities[entityName].filter(query, sort, limit);
  },

  async create(data) {
    return await base44.entities[entityName].create(data);
  },

  async update(id, data) {
    return await base44.entities[entityName].update(id, data);
  },

  async delete(id) {
    await base44.entities[entityName].delete(id);
  },

  async get(id) {
    return await base44.entities[entityName].get(id);
  }
});

// 👈 MIGRACIÓN: Cliente Base44 completo
const base44Client = {
  entities: {
    Sale: createBase44Adapter("Sale"),
    Transaction: createBase44Adapter("Transaction"),
    CashRegister: createBase44Adapter("CashRegister"),
    CashDrawerMovement: createBase44Adapter("CashDrawerMovement"),
    Order: createBase44Adapter("Order"),
    Customer: createBase44Adapter("Customer"),
    Product: createBase44Adapter("Product"),
    // 👈 MIGRACIÓN: Entidades adicionales
    User: createBase44Adapter("User"),
    Notification: createBase44Adapter("Notification"),
    AuditLog: createBase44Adapter("AuditLog"),
    DeviceCategory: createBase44Adapter("DeviceCategory"),
    Brand: createBase44Adapter("Brand"),
    DeviceModel: createBase44Adapter("DeviceModel"),
    AppSettings: createBase44Adapter("AppSettings"),
    ExternalLink: createBase44Adapter("ExternalLink"),
    WorkOrderEvent: createBase44Adapter("WorkOrderEvent"),
    EmailLog: createBase44Adapter("EmailLog"),
    FileUpload: createBase44Adapter("FileUpload"),
    InventoryMovement: createBase44Adapter("InventoryMovement"),
    Service: createBase44Adapter("Service"),
    DiscountCode: createBase44Adapter("DiscountCode"),
    TimeEntry: createBase44Adapter("TimeEntry"),
    Announcement: createBase44Adapter("Announcement"),
    CommunicationQueue: createBase44Adapter("CommunicationQueue"),
    CustomerPortalToken: createBase44Adapter("CustomerPortalToken"),
    SequenceCounter: createBase44Adapter("SequenceCounter"),
    SystemConfig: createBase44Adapter("SystemConfig"),
    UserNotificationSettings: createBase44Adapter("UserNotificationSettings"),
    FixedExpense: createBase44Adapter("FixedExpense"),
    WorkOrderWizardConfig: createBase44Adapter("WorkOrderWizardConfig"),
  }
};

// ============================================
// NEON ADAPTER (Nuevo - PostgreSQL via Netlify Functions)
// ============================================

// 👈 MIGRACIÓN: Adapter para Neon - usa Netlify Functions con retry logic
const createNeonAdapter = (entityName) => ({
  async list(sort = "-created_date", limit = 100) {
    const result = await fetchJSON(`/.netlify/functions/${entityName.toLowerCase()}List`, {
      method: "POST",
      body: JSON.stringify({ limit, offset: 0 })
    });
    return result.data || [];
  },

  async filter(query, sort = "-created_date", limit = 100) {
    const result = await fetchJSON(`/.netlify/functions/${entityName.toLowerCase()}Filter`, {
      method: "POST",
      body: JSON.stringify({ query, sort, limit, offset: 0 })
    });
    return result.data || [];
  },

  async create(data) {
    const result = await fetchJSON(`/.netlify/functions/${entityName.toLowerCase()}Create`, {
      method: "POST",
      body: JSON.stringify({ data })
    });
    return result.data;
  },

  async update(id, data) {
    const result = await fetchJSON(`/.netlify/functions/${entityName.toLowerCase()}Update`, {
      method: "POST",
      body: JSON.stringify({ id, data })
    });
    return result.data;
  },

  async delete(id) {
    await fetchJSON(`/.netlify/functions/${entityName.toLowerCase()}Delete`, {
      method: "POST",
      body: JSON.stringify({ id })
    });
  },

  async get(id) {
    const result = await fetchJSON(`/.netlify/functions/${entityName.toLowerCase()}Get`, {
      method: "POST",
      body: JSON.stringify({ id })
    });
    return result.data;
  }
});

// 👈 MIGRACIÓN: Cliente Neon completo con retry logic
const neonClient = {
  entities: {
    Sale: createNeonAdapter("sale"),
    Transaction: createNeonAdapter("transaction"),
    CashRegister: createNeonAdapter("cashRegister"),
    CashDrawerMovement: createNeonAdapter("cashDrawerMovement"),
    Order: createNeonAdapter("order"),
    Customer: createNeonAdapter("customer"),
    Product: createNeonAdapter("product"),
    // 👈 MIGRACIÓN: Entidades adicionales (Fase 3+)
    User: createNeonAdapter("user"),
    Notification: createNeonAdapter("notification"),
    AuditLog: createNeonAdapter("auditLog"),
    DeviceCategory: createNeonAdapter("deviceCategory"),
    Brand: createNeonAdapter("brand"),
    DeviceModel: createNeonAdapter("deviceModel"),
    AppSettings: createNeonAdapter("appSettings"),
    ExternalLink: createNeonAdapter("externalLink"),
    WorkOrderEvent: createNeonAdapter("workOrderEvent"),
    EmailLog: createNeonAdapter("emailLog"),
    FileUpload: createNeonAdapter("fileUpload"),
    InventoryMovement: createNeonAdapter("inventoryMovement"),
    Service: createNeonAdapter("service"),
    DiscountCode: createNeonAdapter("discountCode"),
    TimeEntry: createNeonAdapter("timeEntry"),
    Announcement: createNeonAdapter("announcement"),
    CommunicationQueue: createNeonAdapter("communicationQueue"),
    CustomerPortalToken: createNeonAdapter("customerPortalToken"),
    SequenceCounter: createNeonAdapter("sequenceCounter"),
    SystemConfig: createNeonAdapter("systemConfig"),
    UserNotificationSettings: createNeonAdapter("userNotificationSettings"),
    FixedExpense: createNeonAdapter("fixedExpense"),
    WorkOrderWizardConfig: createNeonAdapter("workOrderWizardConfig"),
  }
};

// ============================================
// DATA CLIENT - Selector de Backend
// ============================================

// 👈 MIGRACIÓN: Leer variable de entorno (default: base44)
const DATA_BACKEND = import.meta.env?.VITE_DATA_BACKEND || "base44";

// 👈 MIGRACIÓN: Log de configuración
console.log(`
╔════════════════════════════════════════╗
║  🔄 DATA CLIENT INITIALIZATION        ║
║  Backend: ${DATA_BACKEND.toUpperCase().padEnd(28)}║
║  Mode: ${DATA_BACKEND === 'base44' ? 'Base44 (Actual)' : 'Neon PostgreSQL'} ║
╚════════════════════════════════════════╝
`);

// 👈 MIGRACIÓN: Export del cliente según configuración
export const dataClient = DATA_BACKEND === "neon" ? neonClient : base44Client;

// 👈 MIGRACIÓN: Helper para cambiar backend en runtime (para testing)
export const switchBackend = (backend) => {
  console.log(`🔄 Switching data backend to: ${backend.toUpperCase()}`);
  return backend === "neon" ? neonClient : base44Client;
};

// 👈 MIGRACIÓN: Helper para verificar cual backend está activo
export const getActiveBackend = () => DATA_BACKEND;

// 👈 MIGRACIÓN: Helper para verificar si Neon está disponible
export const isNeonAvailable = async () => {
  try {
    const response = await fetch("/.netlify/functions/neonHealth", {
      method: "GET"
    });
    return response.ok;
  } catch {
    return false;
  }
};

// ============================================
// MIGRATION UTILITIES
// ============================================

// 👈 MIGRACIÓN: Utility para migrar datos de Base44 → Neon
export const migrateEntity = async (entityName, batchSize = 100) => {
  console.log(`🔄 Iniciando migración de ${entityName}...`);
  
  const stats = { success: 0, failed: 0, errors: [] };
  
  try {
    // 1. Obtener datos de Base44
    const data = await base44.entities[entityName].list("-created_date", 10000);
    console.log(`📊 Registros encontrados en Base44: ${data.length}`);
    
    // 2. Migrar en lotes
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        await fetchJSON("/.netlify/functions/neonMigrate", {
          method: "POST",
          body: JSON.stringify({
            entity: entityName,
            records: batch
          })
        });
        
        stats.success += batch.length;
        console.log(`✅ Migrados ${stats.success}/${data.length} registros`);
      } catch (error) {
        stats.failed += batch.length;
        stats.errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`);
      }
    }
    
    console.log(`✅ Migración completada: ${stats.success} exitosos, ${stats.failed} fallidos`);
  } catch (error) {
    console.error(`❌ Error en migración de ${entityName}:`, error);
    stats.errors.push(error.message);
  }
  
  return stats;
};

// 👈 MIGRACIÓN: Utility para validar sincronización Base44 ↔ Neon
export const validateSync = async (entityName) => {
  try {
    const [base44Data, neonData] = await Promise.all([
      base44.entities[entityName].list("-created_date", 10000),
      neonClient.entities[entityName].list("-created_date", 10000)
    ]);
    
    const base44Count = base44Data.length;
    const neonCount = neonData.length;
    const synced = base44Count === neonCount;
    
    console.log(`
🔍 Validación de Sincronización - ${entityName}
  Base44: ${base44Count} registros
  Neon:   ${neonCount} registros
  Status: ${synced ? '✅ SINCRONIZADO' : '⚠️ DESINCRONIZADO'}
    `);
    
    return { base44Count, neonCount, synced };
  } catch (error) {
    console.error(`❌ Error validando sync de ${entityName}:`, error);
    throw error;
  }
};

// 👈 MIGRACIÓN: Default export
export default dataClient;
