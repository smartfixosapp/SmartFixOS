import { dataClient } from "@/components/api/dataClient";
import NotificationService from "./NotificationService";

/**
 * Motor de notificaciones inteligentes con IA
 * Analiza el estado del negocio y envía notificaciones proactivas
 */
class SmartNotificationsEngine {
  
  /**
   * 1️⃣ ALERTAS DE STOCK CON IA
   * Analiza patrones de venta para predecir desabastecimiento
   */
  static async checkLowStockWithAI() {
    try {
      const products = await dataClient.entities.Product.list();
      const lowStockProducts = products.filter(p => 
        p.stock <= (p.min_stock || 5) && p.stock > 0
      );

      if (lowStockProducts.length === 0) return;

      // Obtener historial de órdenes recientes (últimos 30 días)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const orders = await dataClient.entities.Order.list('-created_date', 200);
      const recentOrders = orders.filter(o => new Date(o.created_date) >= thirtyDaysAgo);

      // Analizar con IA para determinar urgencia real
      const analysis = await dataClient.integrations.Core.InvokeLLM({
        prompt: `Analiza estos productos con bajo stock y su historial de demanda para determinar cuáles requieren atención urgente:

Productos con bajo stock:
${JSON.stringify(lowStockProducts.map(p => ({
  name: p.name,
  current_stock: p.stock,
  min_stock: p.min_stock,
  category: p.category,
  price: p.price
})), null, 2)}

Órdenes recientes (últimos 30 días): ${recentOrders.length} órdenes

Analiza:
1. Velocidad de rotación de cada producto
2. Probabilidad de desabastecimiento en los próximos 7 días
3. Impacto económico potencial
4. Acción recomendada (urgente, pronto, monitorear)

Devuelve un JSON con prioridades y acciones sugeridas.`,
        response_json_schema: {
          type: "object",
          properties: {
            urgent_products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_id: { type: "string" },
                  product_name: { type: "string" },
                  risk_score: { type: "number" },
                  estimated_stockout_days: { type: "number" },
                  recommended_action: { type: "string" },
                  suggested_order_quantity: { type: "number" }
                }
              }
            },
            summary: { type: "string" }
          }
        }
      });

      // Enviar notificaciones según prioridad IA
      const admins = await dataClient.entities.User.list();
      const targetUsers = admins.filter(u => u.role === "admin" || u.role === "manager");

      for (const urgentProduct of analysis.urgent_products) {
        for (const user of targetUsers) {
          await NotificationService.createNotification({
            userId: user.id,
            userEmail: user.email,
            type: "low_stock",
            title: `🤖 IA: Stock crítico - ${urgentProduct.product_name}`,
            body: `Riesgo: ${urgentProduct.risk_score}/10. Desabastecimiento estimado en ${urgentProduct.estimated_stockout_days} días. ${urgentProduct.recommended_action}`,
            relatedEntityType: "product",
            relatedEntityId: urgentProduct.product_id,
            actionUrl: `/Inventory`,
            actionLabel: "Gestionar inventario",
            priority: urgentProduct.risk_score >= 8 ? "urgent" : "high",
            metadata: {
              ai_analysis: true,
              risk_score: urgentProduct.risk_score,
              stockout_days: urgentProduct.estimated_stockout_days,
              suggested_quantity: urgentProduct.suggested_order_quantity
            }
          });
        }
      }

      console.log('✅ SmartNotificationsEngine: Análisis de stock con IA completado');
      return analysis;
    } catch (error) {
      console.error("Error en checkLowStockWithAI:", error);
      return null;
    }
  }

  /**
   * 2️⃣ ÓRDENES DE COMPRA VENCIDAS O CON RETRASO
   */
  static async checkOverduePurchaseOrders() {
    try {
      const pos = await dataClient.entities.PurchaseOrder.list('-created_date', 200);
      const today = new Date();

      const overdue = pos.filter(po => {
        if (po.status === 'received' || po.status === 'cancelled') return false;
        if (!po.expected_delivery_date) return false;
        const deliveryDate = new Date(po.expected_delivery_date);
        return deliveryDate < today;
      });

      if (overdue.length === 0) return;

      const admins = await dataClient.entities.User.list();
      const targetUsers = admins.filter(u => u.role === "admin" || u.role === "manager");

      for (const po of overdue) {
        const daysOverdue = Math.floor((today - new Date(po.expected_delivery_date)) / (1000 * 60 * 60 * 24));

        for (const user of targetUsers) {
          await NotificationService.createNotification({
            userId: user.id,
            userEmail: user.email,
            type: "purchase_order_overdue",
            title: `⏰ Orden de compra vencida: ${po.po_number}`,
            body: `${daysOverdue} días de retraso. Proveedor: ${po.supplier_name || 'N/A'}. Total: $${po.total_amount?.toFixed(2) || '0'}`,
            relatedEntityType: "purchase_order",
            relatedEntityId: po.id,
            actionUrl: `/Inventory`,
            actionLabel: "Ver orden",
            priority: daysOverdue > 7 ? "urgent" : "high",
            metadata: {
              po_number: po.po_number,
              days_overdue: daysOverdue,
              supplier: po.supplier_name,
              total: po.total_amount
            }
          });
        }
      }

      console.log(`✅ SmartNotificationsEngine: ${overdue.length} órdenes vencidas notificadas`);
      return overdue;
    } catch (error) {
      console.error("Error en checkOverduePurchaseOrders:", error);
      return null;
    }
  }

  /**
   * 3️⃣ ANÁLISIS DE RENTABILIDAD Y SUGERENCIAS PROACTIVAS
   */
  static async analyzeProfitabilityAndSuggest() {
    try {
      const [services, sales, orders] = await Promise.all([
        dataClient.entities.Service.list(),
        dataClient.entities.Sale.list('-created_date', 300),
        dataClient.entities.Order.list('-created_date', 300)
      ]);

      // Análisis IA de rentabilidad
      const analysis = await dataClient.integrations.Core.InvokeLLM({
        prompt: `Analiza la rentabilidad de estos servicios basándote en ventas y órdenes de trabajo:

Servicios disponibles:
${JSON.stringify(services.map(s => ({
  name: s.name,
  price: s.price,
  cost: s.cost,
  category: s.category
})), null, 2)}

Total de ventas recientes: ${sales.length}
Total de órdenes de trabajo: ${orders.length}

Identifica:
1. Servicios poco rentables o poco vendidos
2. Oportunidades de promoción
3. Servicios premium que podrían aumentar ventas
4. Recomendaciones específicas para aumentar rentabilidad

Devuelve acciones concretas y promociones sugeridas.`,
        response_json_schema: {
          type: "object",
          properties: {
            low_performing_services: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  service_name: { type: "string" },
                  issue: { type: "string" },
                  suggested_action: { type: "string" },
                  discount_percentage: { type: "number" }
                }
              }
            },
            upsell_opportunities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  service_name: { type: "string" },
                  reason: { type: "string" }
                }
              }
            },
            summary: { type: "string" }
          }
        }
      });

      // Notificar solo a admins sobre insights de rentabilidad
      const admins = await dataClient.entities.User.list();
      const targetUsers = admins.filter(u => u.role === "admin");

      for (const user of targetUsers) {
        await NotificationService.createNotification({
          userId: user.id,
          userEmail: user.email,
          type: "business_insight",
          title: "💡 IA: Oportunidades de rentabilidad detectadas",
          body: `${analysis.low_performing_services.length} servicios poco rentables. ${analysis.upsell_opportunities.length} oportunidades de upsell identificadas.`,
          actionUrl: `/Reports`,
          actionLabel: "Ver análisis completo",
          priority: "normal",
          metadata: {
            ai_analysis: true,
            analysis_summary: analysis.summary,
            low_performing: analysis.low_performing_services.length,
            opportunities: analysis.upsell_opportunities.length
          }
        });
      }

      console.log('✅ SmartNotificationsEngine: Análisis de rentabilidad completado');
      return analysis;
    } catch (error) {
      console.error("Error en analyzeProfitabilityAndSuggest:", error);
      return null;
    }
  }

  /**
   * 4️⃣ RECORDATORIOS DE MANTENIMIENTO PREVENTIVO A CLIENTES
   */
  static async sendMaintenanceReminders() {
    try {
      const customers = await dataClient.entities.Customer.list();
      const orders = await dataClient.entities.Order.list('-created_date', 500);
      
      // Agrupar órdenes por cliente
      const customerOrders = {};
      for (const order of orders) {
        if (!customerOrders[order.customer_id]) {
          customerOrders[order.customer_id] = [];
        }
        customerOrders[order.customer_id].push(order);
      }

      const today = new Date();
      const maintenanceNeeded = [];

      // Analizar cada cliente con IA
      for (const customer of customers) {
        const custOrders = customerOrders[customer.id] || [];
        if (custOrders.length === 0) continue;

        const lastOrder = custOrders[0];
        const daysSinceLastService = Math.floor((today - new Date(lastOrder.created_date)) / (1000 * 60 * 60 * 24));

        // Si hace más de 90 días, analizar con IA si necesita mantenimiento
        if (daysSinceLastService > 90) {
          maintenanceNeeded.push({
            customer_id: customer.id,
            customer_name: customer.name,
            customer_phone: customer.phone,
            customer_email: customer.email,
            last_service_days: daysSinceLastService,
            device_type: lastOrder.device_type,
            last_service: lastOrder.initial_problem
          });
        }
      }

      if (maintenanceNeeded.length === 0) return;

      // IA determina qué clientes contactar y con qué mensaje
      const aiRecommendations = await dataClient.integrations.Core.InvokeLLM({
        prompt: `Analiza estos clientes que no han recibido servicio recientemente y determina quiénes deberían recibir recordatorio de mantenimiento:

${JSON.stringify(maintenanceNeeded.slice(0, 50), null, 2)}

Para cada cliente, determina:
1. Si necesita recordatorio (basado en tipo de dispositivo y último servicio)
2. Mensaje personalizado de recordatorio
3. Servicio preventivo sugerido

Devuelve solo clientes que deberían recibir recordatorio.`,
        response_json_schema: {
          type: "object",
          properties: {
            customers_to_contact: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  customer_id: { type: "string" },
                  customer_name: { type: "string" },
                  personalized_message: { type: "string" },
                  suggested_service: { type: "string" },
                  urgency: { type: "string" }
                }
              }
            }
          }
        }
      });

      // Crear notificaciones para staff sobre clientes a contactar
      const admins = await dataClient.entities.User.list();
      const targetUsers = admins.filter(u => u.role === "admin" || u.role === "manager");

      for (const recommendation of aiRecommendations.customers_to_contact.slice(0, 10)) {
        for (const user of targetUsers) {
          await NotificationService.createNotification({
            userId: user.id,
            userEmail: user.email,
            type: "maintenance_reminder",
            title: `🔧 IA: Cliente para mantenimiento - ${recommendation.customer_name}`,
            body: `${recommendation.personalized_message} | Sugerencia: ${recommendation.suggested_service}`,
            relatedEntityType: "customer",
            relatedEntityId: recommendation.customer_id,
            actionUrl: `/Customers`,
            actionLabel: "Contactar cliente",
            priority: recommendation.urgency === "high" ? "high" : "normal",
            metadata: {
              ai_analysis: true,
              customer_name: recommendation.customer_name,
              suggested_service: recommendation.suggested_service,
              message: recommendation.personalized_message
            }
          });
        }
      }

      console.log(`✅ SmartNotificationsEngine: ${aiRecommendations.customers_to_contact.length} recordatorios de mantenimiento generados`);
      return aiRecommendations;
    } catch (error) {
      console.error("Error en sendMaintenanceReminders:", error);
      return null;
    }
  }

  /**
   * EJECUTAR TODAS LAS VERIFICACIONES
   */
  static async runAllChecks() {
    // 🛡️ Sincronización: No ejecutar si no hay sesión activa
    try {
      const session = sessionStorage.getItem("911-session") || localStorage.getItem("employee_session");
      if (!session) {
        console.log('🤖 SmartNotificationsEngine: Esperando a inicio de sesión para analizar...');
        return null;
      }
    } catch (e) { return null; }

    console.log('🤖 SmartNotificationsEngine: Iniciando análisis...');
    
    const results = await Promise.allSettled([
      this.checkLowStockWithAI(),
      this.checkOverduePurchaseOrders(),
      this.analyzeProfitabilityAndSuggest(),
      this.sendMaintenanceReminders()
    ]);

    const summary = {
      low_stock: results[0].status === 'fulfilled' ? results[0].value : null,
      overdue_pos: results[1].status === 'fulfilled' ? results[1].value : null,
      profitability: results[2].status === 'fulfilled' ? results[2].value : null,
      maintenance: results[3].status === 'fulfilled' ? results[3].value : null
    };

    console.log('✅ SmartNotificationsEngine: Análisis completado', summary);
    return summary;
  }
}

export default SmartNotificationsEngine;
