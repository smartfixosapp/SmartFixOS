// ============================================
// 🔔 ADVANCED NOTIFICATIONS ENGINE
// Motor avanzado para evaluar reglas y disparar notificaciones
// ============================================

import { dataClient } from "@/components/api/dataClient";

class AdvancedNotificationsEngine {
  constructor() {
    this.isRunning = false;
    this.evaluationInterval = 5 * 60 * 1000; // 5 minutos
  }

  // ✅ Iniciar motor
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("🚀 Advanced Notifications Engine started");
    
    this.runEvaluation();
    this.interval = setInterval(() => this.runEvaluation(), this.evaluationInterval);
  }

  // ✅ Detener motor
  stop() {
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    console.log("🛑 Advanced Notifications Engine stopped");
  }

  // ✅ Ejecutar evaluación de todas las reglas activas
  async runEvaluation() {
    try {
      const rules = await dataClient.entities.NotificationRule.filter({ active: true });
      
      if (!rules || rules.length === 0) {
        console.log("📋 No active notification rules found");
        return;
      }

      console.log(`🔍 Evaluating ${rules.length} notification rules...`);

      for (const rule of rules) {
        try {
          await this.evaluateRule(rule);
        } catch (error) {
          console.error(`❌ Error evaluating rule ${rule.name}:`, error);
        }
      }
    } catch (error) {
      console.error("❌ Error in notification engine:", error);
    }
  }

  // ✅ Evaluar una regla específica
  async evaluateRule(rule) {
    const { trigger_type, conditions, frequency, last_triggered } = rule;

    // Verificar frecuencia
    if (frequency === "once" && last_triggered) {
      return; // Ya se disparó una vez
    }

    if (frequency === "daily" && last_triggered) {
      const daysSince = (Date.now() - new Date(last_triggered).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 1) return;
    }

    // Evaluar según tipo de trigger
    let shouldTrigger = false;
    let affectedEntities = [];

    switch (trigger_type) {
      case "low_stock":
        ({ shouldTrigger, affectedEntities } = await this.evaluateLowStock(conditions));
        break;
      case "pending_order":
        ({ shouldTrigger, affectedEntities } = await this.evaluatePendingOrders(conditions));
        break;
      case "inactive_customer":
        ({ shouldTrigger, affectedEntities } = await this.evaluateInactiveCustomers(conditions));
        break;
      case "order_deadline":
        ({ shouldTrigger, affectedEntities } = await this.evaluateOrderDeadlines(conditions));
        break;
      case "custom_condition":
        ({ shouldTrigger, affectedEntities } = await this.evaluateCustomCondition(conditions));
        break;
      default:
        console.warn(`Unknown trigger type: ${trigger_type}`);
    }

    if (shouldTrigger && affectedEntities.length > 0) {
      await this.dispatchNotifications(rule, affectedEntities);
      
      // Actualizar regla
      await dataClient.entities.NotificationRule.update(rule.id, {
        last_triggered: new Date().toISOString(),
        trigger_count: (rule.trigger_count || 0) + 1,
        next_evaluation: this.calculateNextEvaluation(frequency)
      });
    }
  }

  // ✅ Evaluar stock bajo
  async evaluateLowStock(conditions) {
    const products = await dataClient.entities.Product.filter({ active: true });
    const threshold = conditions.threshold || 5;
    
    const affectedProducts = products.filter(p => 
      typeof p.stock === 'number' && 
      p.stock <= threshold &&
      p.stock > 0
    );

    return {
      shouldTrigger: affectedProducts.length > 0,
      affectedEntities: affectedProducts
    };
  }

  // ✅ Evaluar órdenes pendientes
  async evaluatePendingOrders(conditions) {
    const orders = await dataClient.entities.Order.filter({ deleted: false });
    const daysPending = conditions.threshold || 7;
    const cutoffDate = new Date(Date.now() - daysPending * 24 * 60 * 60 * 1000);

    const pendingOrders = orders.filter(o => 
      !["delivered", "cancelled", "picked_up"].includes(o.status) &&
      new Date(o.created_date) < cutoffDate
    );

    return {
      shouldTrigger: pendingOrders.length > 0,
      affectedEntities: pendingOrders
    };
  }

  // ✅ Evaluar clientes inactivos
  async evaluateInactiveCustomers(conditions) {
    const customers = await dataClient.entities.Customer.list("-updated_date", 500);
    const inactiveDays = conditions.threshold || 30;
    const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

    const inactiveCustomers = customers.filter(c => 
      new Date(c.updated_date) < cutoffDate &&
      c.total_orders > 0
    );

    return {
      shouldTrigger: inactiveCustomers.length > 0,
      affectedEntities: inactiveCustomers.slice(0, 10) // Máximo 10
    };
  }

  // ✅ Evaluar deadlines de órdenes
  async evaluateOrderDeadlines(conditions) {
    const orders = await dataClient.entities.Order.filter({ deleted: false });
    const daysUntilDeadline = conditions.threshold || 2;

    const ordersNearDeadline = orders.filter(o => {
      if (!o.estimated_completion) return false;
      if (["delivered", "cancelled", "picked_up"].includes(o.status)) return false;

      const deadline = new Date(o.estimated_completion);
      const now = new Date();
      const daysLeft = (deadline - now) / (1000 * 60 * 60 * 24);

      return daysLeft <= daysUntilDeadline && daysLeft > 0;
    });

    return {
      shouldTrigger: ordersNearDeadline.length > 0,
      affectedEntities: ordersNearDeadline
    };
  }

  // ✅ Evaluar condición personalizada
  async evaluateCustomCondition(conditions) {
    // Implementación básica para condiciones custom
    if (!conditions.entity_type || !conditions.field) {
      return { shouldTrigger: false, affectedEntities: [] };
    }

    try {
      const entityClient = dataClient.entities[conditions.entity_type];
      if (!entityClient) return { shouldTrigger: false, affectedEntities: [] };

      const entities = await entityClient.list();
      const { field, operator, value } = conditions;

      const matching = entities.filter(entity => {
        const fieldValue = entity[field];
        
        switch (operator) {
          case "less_than":
            return Number(fieldValue) < Number(value);
          case "greater_than":
            return Number(fieldValue) > Number(value);
          case "equals":
            return String(fieldValue) === String(value);
          case "not_equals":
            return String(fieldValue) !== String(value);
          case "contains":
            return String(fieldValue).includes(String(value));
          default:
            return false;
        }
      });

      return {
        shouldTrigger: matching.length > 0,
        affectedEntities: matching
      };
    } catch (error) {
      console.error("Error evaluating custom condition:", error);
      return { shouldTrigger: false, affectedEntities: [] };
    }
  }

  // ✅ Disparar notificaciones
  async dispatchNotifications(rule, affectedEntities) {
    const { notification_config, target_roles, target_users } = rule;

    // Obtener usuarios objetivo
    let targetUserIds = [];

    if (target_users && target_users.length > 0) {
      targetUserIds = target_users;
    } else if (target_roles && target_roles.length > 0) {
      const users = await dataClient.entities.User.filter({ active: true });
      targetUserIds = users
        .filter(u => target_roles.includes(u.role))
        .map(u => u.id);
    } else {
      // Por defecto, enviar a admins
      const users = await dataClient.entities.User.filter({ role: 'admin', active: true });
      targetUserIds = users.map(u => u.id);
    }

    // Crear notificaciones
    for (const userId of targetUserIds) {
      const notification = {
        user_id: userId,
        title: this.interpolateTemplate(notification_config.title, affectedEntities[0]),
        message: this.interpolateTemplate(notification_config.message, affectedEntities[0]),
        type: this.mapTriggerToType(rule.trigger_type),
        priority: notification_config.priority || 'normal',
        rule_id: rule.id,
        actions: notification_config.actions || this.generateDefaultActions(rule, affectedEntities[0]),
        metadata: {
          trigger_type: rule.trigger_type,
          affected_count: affectedEntities.length,
          rule_name: rule.name
        }
      };

      if (affectedEntities[0]) {
        notification.related_entity_id = affectedEntities[0].id;
        notification.related_entity_type = this.getEntityType(rule.trigger_type);
      }

      await dataClient.entities.Notification.create(notification);
    }

    // Disparar evento global
    window.dispatchEvent(new CustomEvent('notification-created'));
    
    console.log(`✅ Dispatched ${targetUserIds.length} notifications for rule: ${rule.name}`);
  }

  // ✅ Interpolar template con datos de entidad
  interpolateTemplate(template, entity) {
    if (!template || !entity) return template;
    
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return entity[key] || match;
    });
  }

  // ✅ Mapear trigger type a notification type
  mapTriggerToType(triggerType) {
    const map = {
      low_stock: 'low_stock',
      pending_order: 'pending_order',
      inactive_customer: 'inactive_customer',
      order_deadline: 'order_update',
      payment_due: 'payment'
    };
    return map[triggerType] || 'info';
  }

  // ✅ Obtener tipo de entidad
  getEntityType(triggerType) {
    const map = {
      low_stock: 'Product',
      pending_order: 'Order',
      inactive_customer: 'Customer',
      order_deadline: 'Order'
    };
    return map[triggerType];
  }

  // ✅ Generar acciones por defecto
  generateDefaultActions(rule, entity) {
    const actions = [];

    switch (rule.trigger_type) {
      case "low_stock":
        actions.push({
          id: "view_product",
          label: "Ver Producto",
          action_type: "navigate",
          action_data: { page: "Inventory" },
          style: "primary"
        });
        break;
      case "pending_order":
        actions.push({
          id: "view_order",
          label: "Ver Orden",
          action_type: "navigate",
          action_data: { 
            page: "Orders",
            order_id: entity?.id 
          },
          style: "primary"
        });
        break;
      case "inactive_customer":
        actions.push({
          id: "view_customer",
          label: "Ver Cliente",
          action_type: "navigate",
          action_data: { page: "Customers" },
          style: "primary"
        });
        break;
    }

    actions.push({
      id: "dismiss",
      label: "Descartar",
      action_type: "dismiss",
      style: "secondary"
    });

    return actions;
  }

  // ✅ Calcular próxima evaluación
  calculateNextEvaluation(frequency) {
    const now = new Date();
    switch (frequency) {
      case "daily":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      case "weekly":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() + this.evaluationInterval).toISOString();
    }
  }
}

// Singleton
export const notificationEngine = new AdvancedNotificationsEngine();

// Auto-start (opcional)
if (typeof window !== 'undefined') {
  // Solo en cliente
  const autoStart = localStorage.getItem('notification_engine_enabled') !== 'false';
  if (autoStart) {
    notificationEngine.start();
  }
}

export default notificationEngine;
