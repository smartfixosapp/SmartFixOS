import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

export async function notifyWarrantyCheckHandler(req) {
  console.log("🦕 notifyWarrantyCheck called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    // Solo admins pueden ejecutar
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Buscar órdenes en estado delivered
    const orders = await base44.asServiceRole.entities.Order.filter({
      status: "delivered",
      deleted: false
    });

    if (!orders || orders.length === 0) {
      return Response.json({ message: "No hay órdenes entregadas", processed: 0 });
    }

    const now = new Date();
    const notified = [];

    for (const order of orders) {
      try {
        // ✅ ARREGLO: Refrescar la orden desde la BD para garantizar datos actuales
        const freshOrders = await base44.asServiceRole.entities.Order.filter({ id: order.id });
        const freshOrder = freshOrders?.[0] || order;
        
        // Calcular días desde que está delivered
        const statusHistory = freshOrder.status_history || [];
        const deliveredEntry = statusHistory.find(h => h.status === "delivered");
        
        if (!deliveredEntry) continue;

        const deliveredDate = new Date(deliveredEntry.timestamp);
        const daysSinceDelivered = Math.floor((now - deliveredDate) / (1000 * 60 * 60 * 24));

        // Enviar email a los 15 días (solo una vez)
        if (daysSinceDelivered === 15) {
          const customer = freshOrder.customer_email;
          if (!customer) continue;

          const subject = `✅ Check de Garantía: 15 días desde tu reparación - ${freshOrder.order_number}`;
          const body = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 30px; border-radius: 12px;">
              <h2 style="color: #333; margin-bottom: 20px;">Hola ${freshOrder.customer_name},</h2>
              
              <p style="font-size: 16px; color: #555; line-height: 1.6;">
                Han pasado <strong>15 días</strong> desde que recogiste tu <strong>${freshOrder.device_brand} ${freshOrder.device_model}</strong>.
              </p>
              
              <div style="background: #d1f2eb; border-left: 4px solid #1abc9c; padding: 15px; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0; color: #0e6655; font-size: 14px;">
                  ✅ <strong>Garantía activa:</strong> Tienes 15 días más de garantía (hasta los 30 días).
                </p>
              </div>
              
              <p style="font-size: 16px; color: #555; line-height: 1.6; margin-top: 20px;">
                <strong>¿Todo está funcionando correctamente?</strong>
              </p>
              
              <p style="font-size: 14px; color: #666; line-height: 1.6;">
                Si experimentas algún problema con la reparación que realizamos, por favor contáctanos de inmediato. 
                Estamos aquí para asegurarnos de que todo esté perfecto.
              </p>
              
              <p style="font-size: 14px; color: #666;">
                📌 <strong>Número de orden:</strong> ${freshOrder.order_number}<br>
                📅 <strong>Fecha de entrega:</strong> ${deliveredEntry.timestamp ? format(new Date(deliveredEntry.timestamp), "d 'de' MMMM, yyyy", { locale: es }) : 'N/A'}<br>
                ⏱️ <strong>Días de garantía restantes:</strong> 15 días
              </p>
              
              <p style="margin-top: 30px; font-size: 14px; color: #888;">
                Gracias por confiar en nosotros,<br>
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
      message: `Procesadas ${orders.length} órdenes entregadas`,
      notified: notified.length,
      orders: notified
    });

  } catch (error) {
    console.error("Error en notifyWarrantyCheck:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
