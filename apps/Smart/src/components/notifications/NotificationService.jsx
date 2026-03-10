import { base44 } from "@/api/base44Client";

/**
 * Servicio centralizado para crear y enviar notificaciones
 * Compatible con la función RPC notifyNewOrder y el sistema de notificaciones in-app
 */
class NotificationService {
  /**
   * Crear una notificación para un usuario
   * 
   * @param {object} options - Opciones de notificación
   * @param {string} options.userId - ID del usuario destinatario
   * @param {string} options.userEmail - Email del usuario (opcional)
   * @param {string} options.type - Tipo de notificación
   * @param {string} options.title - Título
   * @param {string} options.body - Cuerpo del mensaje
   * @param {string} options.relatedEntityType - Tipo de entidad relacionada
   * @param {string} options.relatedEntityId - ID de la entidad
   * @param {string} options.relatedEntityNumber - Número legible
   * @param {string} options.actionUrl - URL de acción
   * @param {string} options.actionLabel - Label del botón
   * @param {string} options.priority - Prioridad (low, normal, high, urgent)
   * @param {object} options.metadata - Metadata adicional
   */
  static async createNotification({
    userId,
    userEmail,
    type,
    title,
    body,
    relatedEntityType,
    relatedEntityId,
    relatedEntityNumber,
    actionUrl,
    actionLabel,
    priority = "normal",
    metadata = {}
  }) {
    try {
      const notification = await base44.entities.Notification.create({
        user_id: userId,
        user_email: userEmail,
        type,
        title,
        body,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        related_entity_number: relatedEntityNumber,
        action_url: actionUrl,
        action_label: actionLabel,
        priority,
        metadata,
        is_read: false,
        sent_via: ["in_app"]
      });

      console.log('✅ [NotificationService] Notificación creada:', notification.id);

      // Trigger custom event for in-app notifications
      window.dispatchEvent(new CustomEvent("new-notification", { detail: notification }));

      // Try to send web push if user has it enabled
      await this.sendWebPush(userId, notification);

      return notification;
    } catch (error) {
      console.error("[NotificationService] Error creating notification:", error);
      return null;
    }
  }

  /**
   * Notificar nueva orden a admin/manager usando RPC
   * 
   * @param {string} orderId - ID de la orden
   * @returns {Promise<object>} Resultado de la notificación
   */
  static async notifyNewOrder(orderId) {
    try {
      console.log('🔔 [NotificationService] Notificando nueva orden:', orderId);

      const result = await base44.functions.invoke('notifyNewOrder', {
        order_id: orderId
      });

      if (result.success) {
        console.log(`✅ ${result.notifications_sent} notificaciones enviadas`);
        return result;
      } else {
        console.error('❌ Error en notifyNewOrder:', result.error);
        return result;
      }
    } catch (error) {
      console.error('[NotificationService] Error calling notifyNewOrder:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar web push si el usuario tiene habilitado
   */
  static async sendWebPush(userId, notification) {
    try {
      const settings = await base44.entities.UserNotificationSettings.filter({ user_id: userId });
      
      if (!settings?.length) return;
      
      const userSettings = settings[0];
      
      // Check if user wants this type and has web push enabled
      const typeEnabled = this.isNotificationTypeEnabled(userSettings, notification.type);
      
      if (!typeEnabled || !userSettings.channel_web_push || !userSettings.web_push_subscription) {
        return;
      }

      // Request browser notification permission if not granted
      if ("Notification" in window && Notification.permission === "granted") {
        const notif = new Notification(notification.title, {
          body: notification.body,
          icon: "/icon-192.png",
          badge: "/badge-72.png",
          tag: notification.id,
          data: {
            url: notification.action_url,
            notificationId: notification.id
          },
          requireInteraction: notification.priority === "urgent"
        });

        notif.onclick = (event) => {
          event.preventDefault();
          window.focus();
          if (notification.action_url) {
            window.location.href = notification.action_url;
          }
          notif.close();
        };
      }

    } catch (error) {
      console.error("[NotificationService] Error sending web push:", error);
    }
  }

  /**
   * Verificar si un tipo de notificación está habilitado para el usuario
   */
  static isNotificationTypeEnabled(userSettings, type) {
    const mapping = {
      new_order: userSettings.receive_new_order_notifications,
      status_change: userSettings.receive_status_change_notifications,
      low_stock: userSettings.receive_low_stock_notifications,
      order_ready: userSettings.receive_order_ready_notifications,
      payment_received: userSettings.receive_payment_notifications,
      urgent_order: userSettings.receive_urgent_notifications,
      assignment: userSettings.receive_assignment_notifications
    };
    
    return mapping[type] !== false;
  }

  /**
   * Marcar notificación como leída
   */
  static async markAsRead(notificationId) {
    try {
      await base44.entities.Notification.update(notificationId, {
        is_read: true,
        read_at: new Date().toISOString()
      });
      
      window.dispatchEvent(new CustomEvent("notification-read", { detail: { id: notificationId } }));
      
      console.log('✅ Notificación marcada como leída:', notificationId);
    } catch (error) {
      console.error("[NotificationService] Error marking as read:", error);
    }
  }

  /**
   * Marcar todas como leídas
   */
  static async markAllAsRead(userId) {
    try {
      const unread = await base44.entities.Notification.filter({
        user_id: userId,
        is_read: false
      });

      for (const notif of unread) {
        await base44.entities.Notification.update(notif.id, {
          is_read: true,
          read_at: new Date().toISOString()
        });
      }

      window.dispatchEvent(new Event("all-notifications-read"));
      
      console.log(`✅ ${unread.length} notificaciones marcadas como leídas`);
    } catch (error) {
      console.error("[NotificationService] Error marking all as read:", error);
    }
  }

  /**
   * Obtener notificaciones de un usuario
   * 
   * @param {string} userId - ID del usuario
   * @param {boolean} unreadOnly - Solo no leídas
   * @param {number} limit - Límite de resultados
   */
  static async getUserNotifications(userId, unreadOnly = false, limit = 50) {
    try {
      let notifications;
      
      if (unreadOnly) {
        notifications = await base44.entities.Notification.filter({
          user_id: userId,
          is_read: false
        });
      } else {
        notifications = await base44.entities.Notification.filter({
          user_id: userId
        });
      }

      // Ordenar por fecha descendente
      const sorted = notifications.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );

      return sorted.slice(0, limit);

    } catch (error) {
      console.error('[NotificationService] Error getting notifications:', error);
      return [];
    }
  }

  /**
   * Contar notificaciones no leídas
   */
  static async getUnreadCount(userId) {
    try {
      const unread = await base44.entities.Notification.filter({
        user_id: userId,
        is_read: false
      });

      return unread.length;
    } catch (error) {
      console.error('[NotificationService] Error getting unread count:', error);
      return 0;
    }
  }

  /**
   * Solicitar permiso de notificaciones web push
   */
  static async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("Este navegador no soporta notificaciones");
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission !== "denied") {
      const permission = await Notification.requestPermission();
      return permission === "granted";
    }

    return false;
  }

  /**
   * Guardar subscription de web push
   */
  static async saveWebPushSubscription(userId, subscription) {
    try {
      const settings = await base44.entities.UserNotificationSettings.filter({ user_id: userId });
      
      const data = {
        user_id: userId,
        web_push_subscription: subscription,
        channel_web_push: true,
        device_info: {
          browser: navigator.userAgent,
          platform: navigator.platform,
          device_id: `${userId}-${Date.now()}`
        }
      };

      if (settings?.length) {
        await base44.entities.UserNotificationSettings.update(settings[0].id, data);
      } else {
        await base44.entities.UserNotificationSettings.create(data);
      }

      console.log('✅ Web push subscription guardada');
      return true;
    } catch (error) {
      console.error("[NotificationService] Error saving subscription:", error);
      return false;
    }
  }

  /**
   * Eliminar una notificación
   */
  static async deleteNotification(notificationId) {
    try {
      await base44.entities.Notification.delete(notificationId);
      window.dispatchEvent(new CustomEvent("notification-deleted", { detail: { id: notificationId } }));
      console.log('✅ Notificación eliminada:', notificationId);
    } catch (error) {
      console.error('[NotificationService] Error deleting notification:', error);
    }
  }
}

export default NotificationService;
