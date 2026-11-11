/**
 * Optimizaciones de Base de Datos y Performance
 * 
 * Recomendaciones de índices, paginación, y políticas de retención
 * para garantizar performance óptimo del sistema.
 */

/**
 * ============================================
 * ÍNDICES RECOMENDADOS
 * ============================================
 * 
 * Nota: Base44 maneja índices automáticamente, pero estas son
 * las recomendaciones para queries frecuentes del sistema.
 */

export const RECOMMENDED_INDEXES = {
  // Order - Queries más comunes
  Order: [
    { fields: ['created_date'], direction: 'descending', usage: 'Listar boletos recientes' },
    { fields: ['status'], direction: 'ascending', usage: 'Filtrar por estado' },
    { fields: ['customer_id'], direction: 'ascending', usage: 'Boletos por cliente' },
    { fields: ['assigned_to'], direction: 'ascending', usage: 'Boletos por técnico' },
    { fields: ['order_number'], direction: 'ascending', usage: 'Búsqueda por número (único)' },
    { 
      fields: ['status', 'created_date'], 
      direction: 'compound', 
      usage: 'Filtrar por estado + ordenar por fecha' 
    },
    { 
      fields: ['deleted', 'created_date'], 
      direction: 'compound', 
      usage: 'Excluir eliminadas + ordenar' 
    }
  ],

  // Sale - Reportes financieros frecuentes
  Sale: [
    { fields: ['created_date'], direction: 'descending', usage: 'Listar ventas recientes' },
    { fields: ['voided'], direction: 'ascending', usage: 'Filtrar ventas válidas' },
    { fields: ['payment_method'], direction: 'ascending', usage: 'Reportes por método de pago' },
    { fields: ['employee'], direction: 'ascending', usage: 'Ventas por empleado' },
    { fields: ['sale_number'], direction: 'ascending', usage: 'Búsqueda por número (único)' },
    { 
      fields: ['voided', 'created_date'], 
      direction: 'compound', 
      usage: 'Excluir anuladas + ordenar por fecha' 
    },
    { 
      fields: ['payment_method', 'created_date'], 
      direction: 'compound', 
      usage: 'Reportes por método + periodo' 
    }
  ],

  // Transaction - Analytics financieros
  Transaction: [
    { fields: ['created_date'], direction: 'descending', usage: 'Listar transacciones recientes' },
    { fields: ['type'], direction: 'ascending', usage: 'Filtrar por tipo (revenue/expense)' },
    { fields: ['category'], direction: 'ascending', usage: 'Reportes por categoría' },
    { fields: ['order_id'], direction: 'ascending', usage: 'Transacciones por orden' },
    { 
      fields: ['type', 'created_date'], 
      direction: 'compound', 
      usage: 'Filtrar tipo + ordenar por fecha' 
    },
    { 
      fields: ['category', 'created_date'], 
      direction: 'compound', 
      usage: 'Reportes por categoría + periodo' 
    }
  ],

  // CashRegister - Queries diarias
  CashRegister: [
    { fields: ['date'], direction: 'descending', usage: 'Buscar por fecha' },
    { fields: ['status'], direction: 'ascending', usage: 'Filtrar cajas abiertas/cerradas' },
    { 
      fields: ['date', 'status'], 
      direction: 'compound', 
      usage: 'Buscar caja específica del día' 
    }
  ],

  // AuditLog - Para compliance y debugging
  AuditLog: [
    { fields: ['created_date'], direction: 'descending', usage: 'Logs recientes' },
    { fields: ['entity_type'], direction: 'ascending', usage: 'Filtrar por tipo de entidad' },
    { fields: ['entity_id'], direction: 'ascending', usage: 'Historial de una entidad' },
    { fields: ['user_id'], direction: 'ascending', usage: 'Acciones de un usuario' },
    { fields: ['action'], direction: 'ascending', usage: 'Filtrar por tipo de acción' },
    { fields: ['severity'], direction: 'ascending', usage: 'Filtrar logs críticos' },
    { 
      fields: ['entity_type', 'entity_id', 'created_date'], 
      direction: 'compound', 
      usage: 'Historial completo de entidad' 
    }
  ],

  // Customer - Búsquedas frecuentes
  Customer: [
    { fields: ['name'], direction: 'ascending', usage: 'Búsqueda por nombre' },
    { fields: ['phone'], direction: 'ascending', usage: 'Búsqueda por teléfono' },
    { fields: ['email'], direction: 'ascending', usage: 'Búsqueda por email' },
    { fields: ['total_spent'], direction: 'descending', usage: 'Top clientes' }
  ],

  // Product - Inventario
  Product: [
    { fields: ['name'], direction: 'ascending', usage: 'Búsqueda por nombre' },
    { fields: ['stock'], direction: 'ascending', usage: 'Alertas de stock bajo' },
    { fields: ['active'], direction: 'ascending', usage: 'Filtrar productos activos' },
    { 
      fields: ['active', 'stock'], 
      direction: 'compound', 
      usage: 'Productos activos con stock bajo' 
    }
  ]
};

/**
 * ============================================
 * LÍMITES DE PAGINACIÓN
 * ============================================
 */

export const PAGINATION_LIMITS = {
  // Límites por defecto
  DEFAULT: 50,
  MAX: 500,
  MIN: 10,

  // Límites específicos por entidad
  Order: {
    default: 50,
    max: 200,
    dashboard: 20,
    list: 50
  },
  
  Sale: {
    default: 50,
    max: 500,
    dashboard: 10,
    report: 1000  // Para reportes se permite más
  },
  
  Transaction: {
    default: 100,
    max: 500,
    report: 1000
  },
  
  AuditLog: {
    default: 100,
    max: 500,
    critical: 50
  },
  
  Customer: {
    default: 50,
    max: 200,
    search: 20
  },
  
  Product: {
    default: 50,
    max: 200,
    pos: 100
  }
};

/**
 * ============================================
 * RATE LIMITS RECOMENDADOS
 * ============================================
 */

export const RATE_LIMITS = {
  // Requests por minuto por usuario
  perUser: {
    read: 120,      // 2 req/seg para lecturas
    write: 30,      // 0.5 req/seg para escrituras
    delete: 10      // Muy limitado para deletes
  },

  // Requests por minuto por IP
  perIP: {
    read: 300,
    write: 60,
    delete: 20
  },

  // Bulk operations
  bulk: {
    maxRecords: 100,  // Máximo registros en bulk create/update
    requestsPerMinute: 10
  }
};

/**
 * ============================================
 * POLÍTICAS DE RETENCIÓN
 * ============================================
 */

export const RETENTION_POLICIES = {
  // AuditLog - Política de archivo
  AuditLog: {
    hotStorage: 90,      // Días en almacenamiento rápido
    warmStorage: 365,    // Días en almacenamiento medio
    coldArchive: null,   // null = retención indefinida en archivo frío
    autoArchive: true,   // Habilitar archivo automático
    archiveThreshold: 365, // Días antes de mover a archivo frío
    severity: {
      critical: null,    // Nunca archivar logs críticos
      error: 730,        // 2 años
      warning: 365,      // 1 año
      info: 90          // 90 días
    }
  },

  // Notification - Limpiar notificaciones antiguas
  Notification: {
    hotStorage: 30,      // 30 días en app
    autoDelete: true,
    deleteThreshold: 90  // Eliminar después de 90 días
  },

  // FileUpload - Gestión de archivos
  FileUpload: {
    hotStorage: 365,
    autoArchive: false,  // Los archivos se mantienen accesibles
    deleteOrphaned: 180  // Eliminar archivos sin referencia después de 6 meses
  },

  // WorkOrderEvent - Historial de eventos
  WorkOrderEvent: {
    hotStorage: 180,     // 6 meses accesibles rápidamente
    warmStorage: 730,    // 2 años
    coldArchive: null    // Retención indefinida
  },

  // EmailLog - Logs de emails
  EmailLog: {
    hotStorage: 30,
    warmStorage: 90,
    autoDelete: true,
    deleteThreshold: 365 // 1 año
  }
};

/**
 * Helper para aplicar límite de paginación
 * 
 * @param {string} entityType - Tipo de entidad
 * @param {number} requestedLimit - Límite solicitado
 * @param {string} context - Contexto (dashboard, list, report, etc)
 * @returns {number} Límite validado
 */
export function getValidatedLimit(entityType, requestedLimit = null, context = 'default') {
  const entityLimits = PAGINATION_LIMITS[entityType] || PAGINATION_LIMITS;
  
  // Si no se especifica límite, usar el default del contexto
  if (!requestedLimit) {
    return entityLimits[context] || entityLimits.default || PAGINATION_LIMITS.DEFAULT;
  }

  // Validar contra máximos
  const maxLimit = entityLimits.max || PAGINATION_LIMITS.MAX;
  const minLimit = PAGINATION_LIMITS.MIN;

  return Math.max(minLimit, Math.min(requestedLimit, maxLimit));
}

/**
 * Helper para queries optimizadas con paginación
 * 
 * @param {string} entityType - Tipo de entidad
 * @param {object} filters - Filtros de query
 * @param {string} sortField - Campo para ordenar
 * @param {number} limit - Límite de registros
 * @param {number} skip - Registros a saltar (offset)
 * @returns {Promise<object>} { data, hasMore, total }
 */
export async function paginatedQuery(entityType, filters = {}, sortField = '-created_date', limit = null, skip = 0) {
  const { base44 } = await import('@/api/base44Client');
  
  // Validar límite
  const validatedLimit = getValidatedLimit(entityType, limit);
  
  // Agregar 1 al límite para detectar si hay más registros
  const fetchLimit = validatedLimit + 1;
  
  // Ejecutar query
  const results = await base44.entities[entityType].filter(
    filters,
    sortField,
    fetchLimit,
    skip
  );

  // Determinar si hay más registros
  const hasMore = results.length > validatedLimit;
  
  // Retornar solo el límite solicitado
  const data = hasMore ? results.slice(0, validatedLimit) : results;

  return {
    data,
    hasMore,
    total: data.length,
    limit: validatedLimit,
    skip
  };
}

/**
 * Limpieza automática de AuditLog según política de retención
 * 
 * IMPORTANTE: Ejecutar esta función con cron job o manualmente
 * 
 * @returns {Promise<object>} { archived, deleted, errors }
 */
export async function archiveOldAuditLogs() {
  const { base44 } = await import('@/api/base44Client');
  const policy = RETENTION_POLICIES.AuditLog;
  
  if (!policy.autoArchive) {
    return { archived: 0, deleted: 0, errors: [], message: 'Auto-archive disabled' };
  }

  const now = new Date();
  const archiveThresholdDate = new Date(now - policy.archiveThreshold * 24 * 60 * 60 * 1000);
  
  try {
    // Obtener logs antiguos (no críticos)
    const oldLogs = await base44.entities.AuditLog.filter({
      created_date: { $lt: archiveThresholdDate.toISOString() },
      severity: { $ne: 'critical' }
    });

    console.log(`📦 [AuditLog] Encontrados ${oldLogs.length} logs para archivar`);

    let archived = 0;
    let errors = [];

    // Por cada log, marcarlo como archivado (o moverlo según implementación)
    for (const log of oldLogs) {
      try {
        // Opción 1: Actualizar metadata para indicar que está archivado
        await base44.entities.AuditLog.update(log.id, {
          metadata: {
            ...log.metadata,
            archived: true,
            archived_at: new Date().toISOString(),
            original_created: log.created_date
          }
        });
        
        archived++;

        // Opción 2: Si tienes un storage de archivo frío, exportar aquí
        // await exportToColdStorage(log);

      } catch (error) {
        errors.push({ logId: log.id, error: error.message });
      }
    }

    console.log(`✅ [AuditLog] ${archived} logs archivados`);

    return {
      archived,
      deleted: 0,
      errors,
      message: `Successfully archived ${archived} audit logs`
    };

  } catch (error) {
    console.error('❌ [AuditLog] Error archiving:', error);
    return {
      archived: 0,
      deleted: 0,
      errors: [{ error: error.message }],
      message: 'Failed to archive logs'
    };
  }
}

/**
 * Limpieza de notificaciones antiguas
 * 
 * @returns {Promise<object>} { deleted, errors }
 */
export async function cleanOldNotifications() {
  const { base44 } = await import('@/api/base44Client');
  const policy = RETENTION_POLICIES.Notification;
  
  if (!policy.autoDelete) {
    return { deleted: 0, errors: [], message: 'Auto-delete disabled' };
  }

  const now = new Date();
  const deleteThresholdDate = new Date(now - policy.deleteThreshold * 24 * 60 * 60 * 1000);
  
  try {
    // Obtener notificaciones antiguas y leídas
    const oldNotifications = await base44.entities.Notification.filter({
      created_date: { $lt: deleteThresholdDate.toISOString() },
      is_read: true
    });

    console.log(`🗑️ [Notifications] Encontradas ${oldNotifications.length} notificaciones para eliminar`);

    let deleted = 0;
    let errors = [];

    for (const notif of oldNotifications) {
      try {
        await base44.entities.Notification.delete(notif.id);
        deleted++;
      } catch (error) {
        errors.push({ notifId: notif.id, error: error.message });
      }
    }

    console.log(`✅ [Notifications] ${deleted} notificaciones eliminadas`);

    return {
      deleted,
      errors,
      message: `Successfully deleted ${deleted} old notifications`
    };

  } catch (error) {
    console.error('❌ [Notifications] Error cleaning:', error);
    return {
      deleted: 0,
      errors: [{ error: error.message }],
      message: 'Failed to clean notifications'
    };
  }
}

/**
 * Estadísticas de uso de base de datos
 * 
 * @returns {Promise<object>} Estadísticas por entidad
 */
export async function getDatabaseStats() {
  const { base44 } = await import('@/api/base44Client');
  
  const entities = [
    'Order',
    'Sale', 
    'Transaction',
    'Customer',
    'Product',
    'AuditLog',
    'Notification',
    'FileUpload'
  ];

  const stats = {};

  for (const entity of entities) {
    try {
      const records = await base44.entities[entity].list('-created_date', 1);
      const count = records.length > 0 ? 'Has records' : 'Empty';
      
      stats[entity] = {
        status: 'accessible',
        lastRecord: records.length > 0 ? records[0].created_date : null
      };
    } catch (error) {
      stats[entity] = {
        status: 'error',
        error: error.message
      };
    }
  }

  return stats;
}

/**
 * Verificar salud de índices (simulado)
 * Retorna queries lentas o que necesitan índices
 */
export function getIndexHealth() {
  return {
    recommended: RECOMMENDED_INDEXES,
    slowQueries: [
      {
        entity: 'Order',
        query: 'Filter by status without index',
        recommendation: 'Add index on status field',
        impact: 'medium'
      },
      {
        entity: 'Sale',
        query: 'Filter by created_date range',
        recommendation: 'Add index on created_date',
        impact: 'high'
      }
    ],
    summary: {
      total: Object.keys(RECOMMENDED_INDEXES).length,
      critical: 3,
      recommended: 15
    }
  };
}

export default {
  RECOMMENDED_INDEXES,
  PAGINATION_LIMITS,
  RATE_LIMITS,
  RETENTION_POLICIES,
  getValidatedLimit,
  paginatedQuery,
  archiveOldAuditLogs,
  cleanOldNotifications,
  getDatabaseStats,
  getIndexHealth
};
