import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Initialize client for this function
const customClient = createUnifiedClient({functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL')});

/**
 * RPC: Notify New Order
 * 
 * Envía notificaciones a admin/manager cuando se crea una nueva orden.
 * Compatible con NotificationService.createNotification del frontend.
 * 
 * @param {string} order_id - ID de la orden creada
 * 
 * @returns {object} {
 *   success: boolean,
 *   notifications_sent: number,
 *   recipients: string[]
 * }
 */
export async function notifyNewOrderHandler(req) {
  console.log("🦕 notifyNewOrder called");
  try {
    // Using pre-configured unified client
    
    // Autenticación requerida
    let user = null;
    try {
      user = await customClient.auth.me();
    } catch {
      return Response.json({
        success: false,
        error: 'Autenticación requerida'
      }, { status: 401 });
    }

    // Parsear parámetros
    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return Response.json({
        success: false,
        error: 'order_id es requerido'
      }, { status: 400 });
    }

    console.log(`🔔 [notifyNewOrder] Enviando notificación para orden: ${order_id}`);

    // Obtener la orden (service role para garantizar acceso)
    const orders = await customClient.asServiceRole.entities.Order.filter({ id: order_id });
    
    if (!orders || orders.length === 0) {
      return Response.json({
        success: false,
        error: 'Orden no encontrada'
      }, { status: 404 });
    }

    const order = orders[0];

    // Obtener todos los usuarios admin y manager
    const [admins, managers] = await Promise.all([
      customClient.asServiceRole.entities.User.filter({ role: 'admin' }),
      customClient.asServiceRole.entities.User.filter({ role: 'manager' })
    ]);

    const recipients = [...admins, ...managers].filter(u => u.email);

    if (recipients.length === 0) {
      console.warn('⚠️ [notifyNewOrder] No hay admin/manager para notificar');
      return Response.json({
        success: true,
        notifications_sent: 0,
        recipients: [],
        message: 'No hay admin/manager configurados'
      });
    }

    console.log(`📧 [notifyNewOrder] Enviando a ${recipients.length} usuarios:`, recipients.map(r => r.email));

    // Crear URL de acción
    const actionUrl = `/Orders?id=${order.id}`;

    // Determinar prioridad basado en el estado/tipo de orden
    let priority = 'normal';
    if (order.priority === 'urgent') {
      priority = 'urgent';
    } else if (order.priority === 'high') {
      priority = 'high';
    }

    // Crear notificación para cada admin/manager
    const notificationPromises = recipients.map(async (recipient) => {
      try {
        // Verificar preferencias de notificación del usuario
        const settings = await customClient.asServiceRole.entities.UserNotificationSettings.filter({
          user_id: recipient.id
        });

        const userSettings = settings?.[0];

        // Si el usuario tiene configuración y deshabilitó new_order, skip
        if (userSettings && userSettings.receive_new_order_notifications === false) {
          console.log(`⏭️ Usuario ${recipient.email} tiene notificaciones de orden deshabilitadas`);
          return null;
        }

        // Crear notificación
        const notification = await customClient.asServiceRole.entities.Notification.create({
          user_id: recipient.id,
          user_email: recipient.email,
          type: 'new_order',
          title: `Nueva Orden: ${order.order_number}`,
          body: `${order.customer_name} - ${order.device_brand} ${order.device_model}`,
          related_entity_type: 'order',
          related_entity_id: order.id,
          related_entity_number: order.order_number,
          action_url: actionUrl,
          action_label: 'Ver Orden',
          priority: priority,
          is_read: false,
          sent_via: ['in_app'],
          metadata: {
            customer_name: order.customer_name,
            device_type: order.device_type,
            device_brand: order.device_brand,
            device_model: order.device_model,
            created_by: user?.full_name || user?.email || 'Sistema',
            created_at: new Date().toISOString()
          }
        });

        console.log(`✅ Notificación creada para ${recipient.email}`);
        return notification.id;

      } catch (error) {
        console.error(`❌ Error creando notificación para ${recipient.email}:`, error);
        return null;
      }
    });

    // Esperar a que todas las notificaciones se creen
    const notificationIds = await Promise.all(notificationPromises);
    const successCount = notificationIds.filter(id => id !== null).length;

    // Registrar en audit log
    try {
      await customClient.asServiceRole.entities.AuditLog.create({
        action: 'notify_new_order',
        entity_type: 'order',
        entity_id: order.id,
        entity_number: order.order_number,
        user_id: user?.id || null,
        user_name: user?.full_name || user?.email || 'Sistema',
        user_role: user?.role || 'system',
        changes: {
          notifications_sent: successCount,
          recipients: recipients.map(r => r.email)
        },
        severity: 'info',
        metadata: {
          order_number: order.order_number,
          customer: order.customer_name,
          priority: priority
        }
      });
    } catch (auditError) {
      console.warn('⚠️ Error registrando en audit log:', auditError);
    }

    return Response.json({
      success: true,
      notifications_sent: successCount,
      recipients: recipients.map(r => r.email),
      message: `Notificaciones enviadas a ${successCount} usuarios`
    });

  } catch (error) {
    console.error('❌ [notifyNewOrder] Error:', error);
    return Response.json({
      success: false,
      error: error.message || 'Error enviando notificaciones'
    }, { status: 500 });
  }
}
