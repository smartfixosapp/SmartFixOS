/**
 * Maintenance Jobs - Tareas de mantenimiento automáticas
 * 
 * Este archivo define tareas periódicas para optimización
 * y limpieza de la base de datos.
 * 
 * NOTA: Debe ejecutarse como cron job o scheduled task
 */

import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Initialize client for this function
const customClient = createUnifiedClient({functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL')});

/**
 * Job principal de mantenimiento
 * Ejecuta todas las tareas de limpieza y optimización
 */
export async function maintenanceJobsHandler(req) {
  console.log("🦕 maintenanceJobs called");
  try {
    // Autenticación con service role (privilegios admin)
    // Using pre-configured unified client
    
    // Verificar que se ejecuta con credenciales de admin
    const user = await customClient.auth.me().catch(() => null);
    
    if (!user || user.role !== 'admin') {
      return Response.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 401 }
      );
    }

    const results = {
      timestamp: new Date().toISOString(),
      jobs: []
    };

    // ============================================
    // JOB 1: Limpiar AuditLog antiguo (>365 días)
    // ============================================
    try {
      const archiveThresholdDate = new Date();
      archiveThresholdDate.setDate(archiveThresholdDate.getDate() - 365);

      const oldLogs = await customClient.asServiceRole.entities.AuditLog.filter({
        severity: { $ne: 'critical' } // No archivar logs críticos
      });

      // Filtrar en memoria logs > 365 días
      const logsToArchive = oldLogs.filter(log => {
        const logDate = new Date(log.created_date);
        return logDate < archiveThresholdDate;
      });

      let archived = 0;
      for (const log of logsToArchive.slice(0, 100)) { // Máximo 100 por ejecución
        try {
          await customClient.asServiceRole.entities.AuditLog.update(log.id, {
            metadata: {
              ...log.metadata,
              archived: true,
              archived_at: new Date().toISOString()
            }
          });
          archived++;
        } catch (err) {
          console.error('Error archiving log:', err);
        }
      }

      results.jobs.push({
        name: 'Archive AuditLog',
        status: 'completed',
        archived,
        total: logsToArchive.length
      });

    } catch (error) {
      results.jobs.push({
        name: 'Archive AuditLog',
        status: 'error',
        error: error.message
      });
    }

    // ============================================
    // JOB 2: Limpiar notificaciones antiguas (>90 días)
    // ============================================
    try {
      const deleteThresholdDate = new Date();
      deleteThresholdDate.setDate(deleteThresholdDate.getDate() - 90);

      const oldNotifs = await customClient.asServiceRole.entities.Notification.filter({
        is_read: true
      });

      // Filtrar en memoria notificaciones > 90 días
      const notifsToDelete = oldNotifs.filter(notif => {
        const notifDate = new Date(notif.created_date);
        return notifDate < deleteThresholdDate;
      });

      let deleted = 0;
      for (const notif of notifsToDelete.slice(0, 100)) { // Máximo 100 por ejecución
        try {
          await customClient.asServiceRole.entities.Notification.delete(notif.id);
          deleted++;
        } catch (err) {
          console.error('Error deleting notification:', err);
        }
      }

      results.jobs.push({
        name: 'Clean Notifications',
        status: 'completed',
        deleted,
        total: notifsToDelete.length
      });

    } catch (error) {
      results.jobs.push({
        name: 'Clean Notifications',
        status: 'error',
        error: error.message
      });
    }

    // ============================================
    // JOB 3: Limpiar EmailLog antiguo (>365 días)
    // ============================================
    try {
      const deleteThresholdDate = new Date();
      deleteThresholdDate.setDate(deleteThresholdDate.getDate() - 365);

      const oldEmails = await customClient.asServiceRole.entities.EmailLog.filter({
        status: 'sent'
      });

      // Filtrar en memoria emails > 365 días
      const emailsToDelete = oldEmails.filter(email => {
        const emailDate = new Date(email.created_date);
        return emailDate < deleteThresholdDate;
      });

      let deleted = 0;
      for (const email of emailsToDelete.slice(0, 100)) {
        try {
          await customClient.asServiceRole.entities.EmailLog.delete(email.id);
          deleted++;
        } catch (err) {
          console.error('Error deleting email log:', err);
        }
      }

      results.jobs.push({
        name: 'Clean EmailLog',
        status: 'completed',
        deleted,
        total: emailsToDelete.length
      });

    } catch (error) {
      results.jobs.push({
        name: 'Clean EmailLog',
        status: 'error',
        error: error.message
      });
    }

    // ============================================
    // JOB 4: Verificar órdenes huérfanas (sin customer)
    // ============================================
    try {
      const orders = await customClient.asServiceRole.entities.Order.filter({
        deleted: false
      });

      const orphanedOrders = orders.filter(o => !o.customer_id || o.customer_id.trim() === '');

      results.jobs.push({
        name: 'Check Orphaned Orders',
        status: 'completed',
        orphaned: orphanedOrders.length,
        total: orders.length,
        warning: orphanedOrders.length > 0 ? 'Found orders without customer_id' : null
      });

    } catch (error) {
      results.jobs.push({
        name: 'Check Orphaned Orders',
        status: 'error',
        error: error.message
      });
    }

    // ============================================
    // JOB 5: Actualizar loyalty points de clientes
    // ============================================
    try {
      const customers = await customClient.asServiceRole.entities.Customer.list('name', 100);
      
      let updated = 0;
      for (const customer of customers) {
        // Recalcular loyalty points basado en total_spent
        const expectedPoints = Math.floor((customer.total_spent || 0) / 10); // 1 punto por cada $10
        
        if (customer.loyalty_points !== expectedPoints) {
          try {
            await customClient.asServiceRole.entities.Customer.update(customer.id, {
              loyalty_points: expectedPoints
            });
            updated++;
          } catch (err) {
            console.error('Error updating customer:', err);
          }
        }
      }

      results.jobs.push({
        name: 'Update Loyalty Points',
        status: 'completed',
        updated,
        total: customers.length
      });

    } catch (error) {
      results.jobs.push({
        name: 'Update Loyalty Points',
        status: 'error',
        error: error.message
      });
    }

    // ============================================
    // Registrar ejecución en AuditLog
    // ============================================
    try {
      await customClient.asServiceRole.entities.AuditLog.create({
        action: 'maintenance_jobs',
        entity_type: 'system',
        user_id: user.id,
        user_name: user.full_name || user.email,
        user_role: user.role,
        changes: {
          jobs: results.jobs
        },
        severity: 'info',
        metadata: {
          execution_time: new Date().toISOString(),
          jobs_count: results.jobs.length
        }
      });
    } catch (error) {
      console.error('Error logging maintenance:', error);
    }

    // Retornar resultados
    return Response.json({
      success: true,
      message: 'Maintenance jobs completed',
      results
    });

  } catch (error) {
    console.error('❌ [Maintenance] Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
