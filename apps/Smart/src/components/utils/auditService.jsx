import { dataClient } from "@/components/api/dataClient";

/**
 * 🔍 Servicio de Auditoría - Registra todas las acciones importantes del sistema
 * Centralizado para garantizar consistencia y trazabilidad completa
 */

export class AuditService {
  /**
   * Registra una acción en el sistema
   * @param {string} action - Acción realizada (create, update, delete, etc)
   * @param {string} entityType - Tipo de entidad afectada (order, sale, transaction, etc)
   * @param {string} entityId - ID de la entidad
   * @param {string} entityNumber - Número legible (WO-00023, S-001, etc)
   * @param {object} changes - Cambios realizados {before, after}
   * @param {string} severity - Severidad (info, warning, error, critical)
   */
  static async log(action, entityType, entityId, entityNumber, changes = {}, severity = "info") {
    try {
      let user = null;
      try { 
        user = await dataClient.auth.me(); 
      } catch (e) {
        console.warn("⚠️ No user context for audit");
      }

      const auditEntry = {
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        entity_number: entityNumber || null,
        user_id: user?.id || null,
        user_name: user?.full_name || "Sistema",
        user_role: user?.role || "unknown",
        changes,
        severity,
        metadata: {
          timestamp: new Date().toISOString(),
          userAgent: navigator?.userAgent || "unknown",
          ip_address: "client"
        }
      };

      await dataClient.entities.AuditLog.create(auditEntry);
      console.log(`✅ Auditoría registrada: ${action} - ${entityType} - ${entityNumber}`);
    } catch (error) {
      console.error("🔴 Error registrando auditoría:", error);
      // No lanzar error para no interrumpir la operación principal
    }
  }

  /**
   * Registra creación de entidad
   */
  static async logCreate(entityType, entityId, entityNumber, data) {
    return this.log("create", entityType, entityId, entityNumber, { after: data }, "info");
  }

  /**
   * Registra actualización de entidad
   */
  static async logUpdate(entityType, entityId, entityNumber, before, after) {
    return this.log("update", entityType, entityId, entityNumber, { before, after }, "info");
  }

  /**
   * Registra eliminación de entidad
   */
  static async logDelete(entityType, entityId, entityNumber, data, reason = "") {
    return this.log("delete", entityType, entityId, entityNumber, { before: data, reason }, "warning");
  }

  /**
   * Registra pagos/transacciones
   */
  static async logPayment(type, entityType, entityId, entityNumber, amount, method, details = {}) {
    return this.log(`payment_${type}`, entityType, entityId, entityNumber, { 
      amount, 
      method, 
      details 
    }, "info");
  }

  /**
   * Registra error crítico
   */
  static async logError(action, entityType, entityId, errorMessage) {
    return this.log(action, entityType, entityId, null, { error: errorMessage }, "critical");
  }

  /**
   * Registra cambio de estado
   */
  static async logStatusChange(entityType, entityId, entityNumber, oldStatus, newStatus, reason = "") {
    return this.log("status_change", entityType, entityId, entityNumber, {
      before: { status: oldStatus },
      after: { status: newStatus },
      reason
    }, "info");
  }

  /**
   * Registra acceso/login
   */
  static async logAccess(user) {
    try {
      await dataClient.entities.AuditLog.create({
        action: "login",
        entity_type: "user",
        entity_id: user?.id,
        user_id: user?.id,
        user_name: user?.full_name,
        user_role: user?.role,
        severity: "info",
        metadata: { userAgent: navigator?.userAgent }
      });
    } catch (e) {
      console.warn("⚠️ Error logging access:", e);
    }
  }
}

export default AuditService;
