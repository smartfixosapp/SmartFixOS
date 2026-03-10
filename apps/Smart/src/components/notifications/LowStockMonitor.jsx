// AI NOTE: Servicio automático para monitorear stock bajo y enviar notificaciones
// Se ejecuta cada hora para verificar productos con stock bajo

import { dataClient } from "@/components/api/dataClient";
import NotificationService from "./NotificationService";

export class LowStockMonitor {
  static async checkLowStockProducts() {
    try {
      console.log("[LowStockMonitor] Iniciando verificación de stock bajo...");
      
      const products = await dataClient.entities.Product.filter({ active: true });
      const lowStockProducts = [];

      for (const product of products) {
        const currentStock = Number(product.stock) || 0;
        const minStock = Number(product.min_stock) || 5;
        
        // Solo productos (no servicios) y con stock bajo
        if (product.type !== 'service' && currentStock > 0 && currentStock <= minStock) {
          // Verificar si ya se notificó recientemente
          const lastAlert = product.last_stock_alert ? new Date(product.last_stock_alert) : null;
          const hoursSinceLastAlert = lastAlert ? (Date.now() - lastAlert.getTime()) / (1000 * 60 * 60) : 999;
          
          // Solo notificar si pasaron más de 24 horas desde la última alerta
          if (hoursSinceLastAlert > 24 || !product.low_stock_notified) {
            lowStockProducts.push({
              ...product,
              currentStock,
              minStock
            });
          }
        }
      }

      console.log(`[LowStockMonitor] Encontrados ${lowStockProducts.length} productos con stock bajo`);

      // Enviar notificaciones
      if (lowStockProducts.length > 0) {
        // Obtener administradores
        const users = await dataClient.entities.User.list();
        const admins = (users || []).filter(u => u.role === 'admin' || u.role === 'manager');

        for (const admin of admins) {
          if (!admin.id || !admin.email) continue;

          // Crear notificación resumen
          await NotificationService.createNotification({
            userId: admin.id,
            userEmail: admin.email,
            type: "low_stock",
            title: `⚠️ ${lowStockProducts.length} productos con stock bajo`,
            body: `Verifica el inventario y ordena nuevas piezas`,
            relatedEntityType: "inventory",
            actionUrl: "/Inventory",
            actionLabel: "Ver inventario",
            priority: "high",
            metadata: {
              products_count: lowStockProducts.length,
              products: lowStockProducts.map(p => ({
                name: p.name,
                current_stock: p.currentStock,
                min_stock: p.minStock
              }))
            }
          });
        }

        // Marcar productos como notificados
        for (const product of lowStockProducts) {
          await dataClient.entities.Product.update(product.id, {
            low_stock_notified: true,
            last_stock_alert: new Date().toISOString()
          });
        }

        console.log(`[LowStockMonitor] ✅ Notificaciones enviadas a ${admins.length} administradores`);
      }

      return {
        checked: products.length,
        lowStock: lowStockProducts.length,
        notified: lowStockProducts.length > 0
      };
    } catch (error) {
      console.error("[LowStockMonitor] Error:", error);
      return {
        checked: 0,
        lowStock: 0,
        notified: false,
        error: error.message
      };
    }
  }

  // Ejecutar verificación automática cada hora
  static startAutoCheck() {
    // Ejecutar inmediatamente
    this.checkLowStockProducts();
    
    // Luego cada hora
    setInterval(() => {
      this.checkLowStockProducts();
    }, 60 * 60 * 1000); // 1 hora
  }
}

// Auto-iniciar monitor cuando se importa este módulo
if (typeof window !== 'undefined') {
  // Ejecutar primera vez después de 5 segundos (dar tiempo a que cargue la app)
  setTimeout(() => {
    LowStockMonitor.checkLowStockProducts();
  }, 5000);
  
  // Luego cada hora
  setInterval(() => {
    LowStockMonitor.checkLowStockProducts();
  }, 60 * 60 * 1000);
}
