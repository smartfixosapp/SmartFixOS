import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';
import { sendTemplatedEmailWithBase44 } from './emailTemplateRuntime.js';

/**
 * Función diaria que actualiza los contadores de pickup y warranty
 * Envía emails automáticos según los días transcurridos
 */
export async function updateOrderCountdownsHandler(req) {
  console.log("🦕 updateOrderCountdowns called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});

    // Cargar términos y condiciones una vez
    let termsHtml = "";
    try {
      const termsConfig = await base44.asServiceRole.entities.WorkOrderWizardConfig.filter({ key: "default" });
      if (termsConfig?.length > 0 && termsConfig[0].terms_text?.es) {
        const termsText = termsConfig[0].terms_text.es.replace(/\n/g, '<br/>');
        termsHtml = `
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; margin: 25px 0; border-radius: 8px;">
            <h3 style="color: #374151; font-size: 14px; font-weight: bold; margin-bottom: 10px;">📋 Términos y Condiciones</h3>
            <div style="color: #6b7280; font-size: 12px; line-height: 1.6;">
              ${termsText}
            </div>
          </div>
        `;
      }
    } catch (err) {
      console.error("Error cargando términos:", err);
    }

    // Obtener todas las órdenes con contadores activos
    const allOrders = await base44.asServiceRole.entities.Order.filter({});

    for (const order of allOrders) {
      const now = new Date();
      let needsUpdate = false;
      const updates = {};

      // ==================== CONTADOR DE PICKUP ====================
      if (order.status === 'ready_for_pickup' && order.pickup_countdown?.started_at) {
        const startDate = new Date(order.pickup_countdown.started_at);
        const daysPassed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, 30 - daysPassed);

        updates.pickup_countdown = {
          ...order.pickup_countdown,
          days_remaining: daysRemaining,
          expired: daysRemaining === 0
        };
        needsUpdate = true;

        // Recordatorio a los 15 días (15 días restantes)
        if (daysRemaining === 15 && !order.pickup_countdown.reminder_15_sent && order.customer_email) {
          await sendTemplatedEmailWithBase44(base44, {
            event_type: 'pickup_reminder_15',
            order_data: {
              order_number: order.order_number,
              customer_name: order.customer_name || 'Cliente',
              customer_email: order.customer_email,
              device_info: `${order.device_brand || ''} ${order.device_model || ''}`.trim(),
              days_remaining: 15,
              days_elapsed: 15,
              initial_problem: order.initial_problem || ''
            }
          });

          updates.pickup_countdown.reminder_15_sent = true;
        }

        // Recordatorio urgente a los 3 días (27 días pasados)
        if (daysRemaining === 3 && !order.pickup_countdown.reminder_3_sent && order.customer_email) {
          await sendTemplatedEmailWithBase44(base44, {
            event_type: 'pickup_reminder_3',
            order_data: {
              order_number: order.order_number,
              customer_name: order.customer_name || 'Cliente',
              customer_email: order.customer_email,
              device_info: `${order.device_brand || ''} ${order.device_model || ''}`.trim(),
              days_remaining: 3,
              days_elapsed: 27,
              initial_problem: order.initial_problem || ''
            }
          });

          updates.pickup_countdown.reminder_3_sent = true;
        }
      }

      // ==================== CONTADOR DE GARANTÍA ====================
      if ((order.status === 'delivered' || order.status === 'completed') && order.warranty_countdown?.started_at) {
        const startDate = new Date(order.warranty_countdown.started_at);
        const daysPassed = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.max(0, 30 - daysPassed);

        updates.warranty_countdown = {
          ...order.warranty_countdown,
          days_remaining: daysRemaining,
          expired: daysRemaining === 0
        };
        needsUpdate = true;

        // Checkup a los 15 días
        if (daysRemaining === 15 && !order.warranty_countdown.checkup_15_sent && order.customer_email) {
          await sendTemplatedEmailWithBase44(base44, {
            event_type: 'warranty_check_15',
            order_data: {
              order_number: order.order_number,
              customer_name: order.customer_name || 'Cliente',
              customer_email: order.customer_email,
              device_info: `${order.device_brand || ''} ${order.device_model || ''}`.trim(),
              days_remaining: 15,
              days_elapsed: 15,
              initial_problem: order.initial_problem || ''
            }
          });

          updates.warranty_countdown.checkup_15_sent = true;
        }

        // Aviso de expiración de garantía (día 0)
        if (daysRemaining === 0 && !order.warranty_countdown.expiry_notice_sent && order.customer_email) {
          await sendTemplatedEmailWithBase44(base44, {
            event_type: 'warranty_expired',
            order_data: {
              order_number: order.order_number,
              customer_name: order.customer_name || 'Cliente',
              customer_email: order.customer_email,
              device_info: `${order.device_brand || ''} ${order.device_model || ''}`.trim(),
              days_remaining: 0,
              days_elapsed: 30,
              initial_problem: order.initial_problem || ''
            }
          });

          updates.warranty_countdown.expiry_notice_sent = true;
        }
      }

      // Actualizar la orden si hubo cambios
      if (needsUpdate && Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.Order.update(order.id, updates);
      }
    }

    return Response.json({
      success: true,
      message: 'Contadores actualizados exitosamente',
      processed: allOrders.length
    });

  } catch (error) {
    console.error('Error actualizando contadores:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
};
