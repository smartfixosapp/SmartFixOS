/**
 * Helpers para registro automático de auditoría
 * 
 * Registra todas las acciones importantes del sistema para:
 * - Compliance y regulaciones
 * - Debugging y troubleshooting
 * - Análisis de comportamiento
 * - Seguridad y detección de fraudes
 */

import { base44 } from "@/api/base44Client";

/**
 * Crea un registro de auditoría
 * 
 * @param {object} logData - Datos del log
 * @param {string} logData.action - Acción realizada
 * @param {string} logData.entity_type - Tipo de entidad
 * @param {string} logData.entity_id - ID de la entidad
 * @param {string} logData.entity_number - Número legible (opcional)
 * @param {object} logData.changes - Cambios realizados
 * @param {string} logData.severity - Severidad (info, warning, error, critical)
 * @param {object} logData.metadata - Metadata adicional
 */
export async function createAuditLog(logData) {
  try {
    // Obtener usuario actual (puede ser null para acciones automáticas)
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      // Usuario no autenticado o acción automática
      console.log('📝 [AuditLog] Registrando acción automática del sistema');
    }

    // Obtener información del navegador
    const ipAddress = await getClientIP();
    const userAgent = navigator.userAgent;

    const auditData = {
      action: logData.action,
      entity_type: logData.entity_type,
      entity_id: logData.entity_id,
      entity_number: logData.entity_number || null,
      user_id: user?.id || null,
      user_name: user?.full_name || user?.email || 'Sistema',
      user_role: user?.role || 'system',
      changes: logData.changes || {},
      ip_address: ipAddress,
      user_agent: userAgent,
      severity: logData.severity || 'info',
      metadata: {
        ...logData.metadata,
        timestamp: new Date().toISOString(),
        platform: 'web'
      }
    };

    // Usar service role para garantizar que se registre
    await base44.asServiceRole.entities.AuditLog.create(auditData);

    console.log('✅ [AuditLog] Registro creado:', logData.action, logData.entity_type);

  } catch (error) {
    // NO fallar la operación principal si falla el audit log
    console.error('⚠️ [AuditLog] Error registrando auditoría:', error);
  }
}

/**
 * Registra creación de una entidad
 */
export async function logCreate(entityType, entityId, entityNumber, newData, metadata = {}) {
  await createAuditLog({
    action: 'create',
    entity_type: entityType,
    entity_id: entityId,
    entity_number: entityNumber,
    changes: {
      after: newData
    },
    severity: 'info',
    metadata
  });
}

/**
 * Registra actualización de una entidad
 */
export async function logUpdate(entityType, entityId, entityNumber, beforeData, afterData, metadata = {}) {
  await createAuditLog({
    action: 'update',
    entity_type: entityType,
    entity_id: entityId,
    entity_number: entityNumber,
    changes: {
      before: beforeData,
      after: afterData,
      modified_fields: getModifiedFields(beforeData, afterData)
    },
    severity: 'info',
    metadata
  });
}

/**
 * Registra eliminación de una entidad
 */
export async function logDelete(entityType, entityId, entityNumber, beforeData, metadata = {}) {
  await createAuditLog({
    action: 'delete',
    entity_type: entityType,
    entity_id: entityId,
    entity_number: entityNumber,
    changes: {
      before: beforeData
    },
    severity: 'warning',
    metadata
  });
}

/**
 * Registra cambio de estado de una orden
 */
export async function logOrderStatusChange(orderId, orderNumber, oldStatus, newStatus, reason = '') {
  await createAuditLog({
    action: 'status_change',
    entity_type: 'order',
    entity_id: orderId,
    entity_number: orderNumber,
    changes: {
      before: { status: oldStatus },
      after: { status: newStatus },
      reason: reason
    },
    severity: 'info',
    metadata: {
      old_status: oldStatus,
      new_status: newStatus,
      reason: reason
    }
  });
}

/**
 * Registra apertura de caja
 */
export async function logCashDrawerOpen(drawerId, openingBalance, denominations) {
  await createAuditLog({
    action: 'cash_drawer_open',
    entity_type: 'cash_register',
    entity_id: drawerId,
    changes: {
      after: {
        opening_balance: openingBalance,
        denominations: denominations
      }
    },
    severity: 'info',
    metadata: {
      opening_balance: openingBalance
    }
  });
}

/**
 * Registra cierre de caja
 */
export async function logCashDrawerClose(drawerId, closingBalance, expected, difference) {
  await createAuditLog({
    action: 'cash_drawer_close',
    entity_type: 'cash_register',
    entity_id: drawerId,
    changes: {
      closing_balance: closingBalance,
      expected_balance: expected,
      difference: difference
    },
    severity: difference !== 0 ? 'warning' : 'info',
    metadata: {
      closing_balance: closingBalance,
      expected_balance: expected,
      difference: difference,
      has_discrepancy: difference !== 0
    }
  });
}

/**
 * Registra una venta
 */
export async function logSaleCompleted(saleId, saleNumber, total, paymentMethod, items) {
  await createAuditLog({
    action: 'sale_completed',
    entity_type: 'sale',
    entity_id: saleId,
    entity_number: saleNumber,
    changes: {
      after: {
        total: total,
        payment_method: paymentMethod,
        items_count: items.length
      }
    },
    severity: 'info',
    metadata: {
      total: total,
      payment_method: paymentMethod,
      items: items
    }
  });
}

/**
 * Registra anulación de venta
 */
export async function logSaleVoided(saleId, saleNumber, reason, total) {
  await createAuditLog({
    action: 'sale_voided',
    entity_type: 'sale',
    entity_id: saleId,
    entity_number: saleNumber,
    changes: {
      before: { voided: false },
      after: { voided: true, void_reason: reason }
    },
    severity: 'warning',
    metadata: {
      reason: reason,
      amount: total
    }
  });
}

/**
 * Registra un gasto
 */
export async function logExpense(transactionId, amount, category, description) {
  await createAuditLog({
    action: 'expense_recorded',
    entity_type: 'transaction',
    entity_id: transactionId,
    changes: {
      after: {
        amount: amount,
        category: category,
        description: description
      }
    },
    severity: 'info',
    metadata: {
      amount: amount,
      category: category
    }
  });
}

/**
 * Registra cambios en inventario
 */
export async function logInventoryChange(productId, productName, movementType, quantity, previousStock, newStock) {
  await createAuditLog({
    action: 'inventory_change',
    entity_type: 'inventory',
    entity_id: productId,
    entity_number: productName,
    changes: {
      before: { stock: previousStock },
      after: { stock: newStock },
      movement: {
        type: movementType,
        quantity: quantity
      }
    },
    severity: newStock < 0 ? 'warning' : 'info',
    metadata: {
      movement_type: movementType,
      quantity: quantity,
      previous_stock: previousStock,
      new_stock: newStock
    }
  });
}

/**
 * Registra acceso a configuración sensible
 */
export async function logConfigAccess(configKey, action = 'view') {
  await createAuditLog({
    action: `config_${action}`,
    entity_type: 'config',
    entity_id: configKey,
    changes: {},
    severity: action === 'update' ? 'warning' : 'info',
    metadata: {
      config_key: configKey,
      action: action
    }
  });
}

/**
 * Registra inicio de sesión
 */
export async function logUserLogin(userId, userName, userRole) {
  await createAuditLog({
    action: 'user_login',
    entity_type: 'user',
    entity_id: userId,
    changes: {},
    severity: 'info',
    metadata: {
      user_name: userName,
      user_role: userRole
    }
  });
}

/**
 * Registra cierre de sesión
 */
export async function logUserLogout(userId, userName) {
  await createAuditLog({
    action: 'user_logout',
    entity_type: 'user',
    entity_id: userId,
    changes: {},
    severity: 'info',
    metadata: {
      user_name: userName
    }
  });
}

/**
 * Registra error crítico
 */
export async function logError(action, entityType, entityId, errorMessage, errorStack) {
  await createAuditLog({
    action: `error_${action}`,
    entity_type: entityType,
    entity_id: entityId,
    changes: {},
    severity: 'error',
    metadata: {
      error_message: errorMessage,
      error_stack: errorStack
    }
  });
}

// ========================================
// HELPERS INTERNOS
// ========================================

/**
 * Obtiene los campos que cambiaron entre dos objetos
 */
function getModifiedFields(before, after) {
  const modified = [];
  const allKeys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);

  allKeys.forEach(key => {
    const beforeValue = before?.[key];
    const afterValue = after?.[key];

    if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
      modified.push({
        field: key,
        before: beforeValue,
        after: afterValue
      });
    }
  });

  return modified;
}

/**
 * Obtiene la IP del cliente (mejor esfuerzo)
 */
async function getClientIP() {
  try {
    // En producción, esto debería venir del servidor
    // Por ahora retornamos un placeholder
    return 'client-side';
  } catch {
    return 'unknown';
  }
}

// ========================================
// CONSULTAS DE AUDITORÍA
// ========================================

/**
 * Obtiene el historial de auditoría de una entidad
 */
export async function getEntityAuditLog(entityType, entityId, limit = 50) {
  try {
    const logs = await base44.entities.AuditLog.filter({
      entity_type: entityType,
      entity_id: entityId
    });

    // Ordenar por fecha descendente
    return logs.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    ).slice(0, limit);

  } catch (error) {
    console.error('Error obteniendo audit log:', error);
    return [];
  }
}

/**
 * Obtiene auditoría por usuario
 */
export async function getUserAuditLog(userId, limit = 100) {
  try {
    const logs = await base44.entities.AuditLog.filter({
      user_id: userId
    });

    return logs.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    ).slice(0, limit);

  } catch (error) {
    console.error('Error obteniendo audit log de usuario:', error);
    return [];
  }
}

/**
 * Obtiene auditoría por acción
 */
export async function getAuditLogByAction(action, entityType = null, limit = 100) {
  try {
    const filter = { action };
    if (entityType) {
      filter.entity_type = entityType;
    }

    const logs = await base44.entities.AuditLog.filter(filter);

    return logs.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    ).slice(0, limit);

  } catch (error) {
    console.error('Error obteniendo audit log por acción:', error);
    return [];
  }
}

/**
 * Obtiene logs críticos recientes
 */
export async function getCriticalLogs(limit = 50) {
  try {
    const logs = await base44.entities.AuditLog.filter({
      severity: 'critical'
    });

    return logs.sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    ).slice(0, limit);

  } catch (error) {
    console.error('Error obteniendo logs críticos:', error);
    return [];
  }
}

export default {
  createAuditLog,
  logCreate,
  logUpdate,
  logDelete,
  logOrderStatusChange,
  logCashDrawerOpen,
  logCashDrawerClose,
  logSaleCompleted,
  logSaleVoided,
  logExpense,
  logInventoryChange,
  logConfigAccess,
  logUserLogin,
  logUserLogout,
  logError,
  getEntityAuditLog,
  getUserAuditLog,
  getAuditLogByAction,
  getCriticalLogs
};
