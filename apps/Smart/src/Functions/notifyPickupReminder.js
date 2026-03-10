import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

export async function notifyPickupReminderHandler(req) {
  console.log("🦕 notifyPickupReminder called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    // Solo admins pueden ejecutar
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar órdenes en estado ready_for_pickup
    const orders = await base44.asServiceRole.entities.Order.filter({
      status: "ready_for_pickup",
      deleted: false
    });

    if (!orders || orders.length === 0) {
      return Response.json({ message: "No hay órdenes listas para recoger", processed: 0 });
    }

    const now = new Date();
    const notified = [];

    for (const order of orders) {
      try {
        // ✅ ARREGLO: Refrescar la orden desde la BD para garantizar datos actuales
        const freshOrders = await base44.asServiceRole.entities.Order.filter({ id: order.id });
        const freshOrder = freshOrders?.[0] || order;
        
        // Calcular días desde que está ready_for_pickup
        const statusHistory = freshOrder.status_history || [];
        const readyEntry = statusHistory.find(h => h.status === "ready_for_pickup");
        
        if (!readyEntry) continue;

        const readyDate = new Date(readyEntry.timestamp);
        const daysSinceReady = Math.floor((now - readyDate) / (1000 * 60 * 60 * 24));

        // Enviar email a los 15 días (solo una vez)
        if (daysSinceReady === 15) {
          const customer = freshOrder.customer_email;
          if (!customer) continue;

          const subject = `⏰ Recordatorio: Tu equipo lleva 15 días listo para recoger - ${freshOrder.order_number}`;
          const body = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 30px; border-radius: 12px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hola ${freshOrder.customer_name},</h2>
              
              <p style="font-size: 16px; color: #555; line-height: 1.6;">
                Tu equipo <strong>${freshOrder.device_brand} ${freshOrder.device_model}</strong> lleva <strong>15 días</strong> listo para recoger.
              </p>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  ⚠️ <strong>Importante:</strong> Después de 30 días sin recoger, el equipo podría ser decomisado según nuestros términos de servicio.
                </p>
              </div>
              
              <p style="font-size: 14px; color: #666;">
                📌 <strong>Número de orden:</strong> ${freshOrder.order_number}<br>
                ⏱️ <strong>Días transcurridos:</strong> 15 días<br>
                ⏳ <strong>Días restantes:</strong> 15 días
              </p>
              
              <p style="margin-top: 30px; font-size: 14px; color: #555;">
                Por favor, recoge tu equipo lo antes posible. Si tienes alguna pregunta, no dudes en contactarnos.
              </p>
              
              <p style="margin-top: 30px; font-size: 14px; color: #888;">
                Saludos,<br>
                <strong>911 Smart Fix</strong>
              </p>
            </div>
          `;

          await base44.integrations.Core.SendEmail({
            to: customer,
            subject,
            body
          });

          notified.push(freshOrder.order_number);
        }
      } catch (err) {
        console.error(`Error procesando orden ${order.id}:`, err);
      }
    }

    return Response.json({ 
      message: `Procesadas ${orders.length} órdenes`,
      notified: notified.length,
      orders: notified
    });

  } catch (error) {
    console.error("Error en notifyPickupReminder:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
