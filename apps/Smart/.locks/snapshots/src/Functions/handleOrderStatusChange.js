import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';
import { createStatusChangeEmail, getBusinessInfo } from '../components/utils/emailTemplates.jsx';

/**
 * Handle Order Status Change
 * Triggered by Entity Automation when an Order is updated.
 * 
 * Logic:
 * - If status changes to "part_arrived_waiting_device", send notification to customer
 * - If status changes to "delivered" or "picked_up", send email with warranty info
 */
export async function handleOrderStatusChangeHandler(req) {
    try {
        const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
        
        // Parse the automation payload
        const payload = await req.json();
        const { event, data, old_data } = payload;
        
        // We only care about updates where status changed
        if (event.type !== 'update' || !data || !old_data) {
            return Response.json({ message: 'Ignored: Not an update or missing data' });
        }
        
        // Check if status changed
        const newStatus = data.status;
        const oldStatus = old_data.status;
        
        // ====== DELIVERED / PICKED UP - EMAIL CON GARANTÍA ======
        if ((newStatus === 'delivered' || newStatus === 'picked_up') && 
            (oldStatus !== 'delivered' && oldStatus !== 'picked_up')) {
            
            console.log(`[Order ${data.id}] Status changed to ${newStatus}. Sending warranty email...`);
            
            const freshOrders = await base44.asServiceRole.entities.Order.filter({ id: data.id });
            const freshOrder = freshOrders?.[0] || data;
            const customerEmail = freshOrder.customer_email;
            
            if (customerEmail) {
                // Obtener info del negocio y texto de garantía
                const businessInfo = await getBusinessInfo();
                const warrantyText = businessInfo.warranty_repairs || "30 días estándar. No cubre caídas, mojadas, rupturas, guayazos ni desperfectos de fábrica.";
                
                const deviceInfo = [
                  freshOrder.device_brand,
                  freshOrder.device_model,
                  freshOrder.device_type
                ].filter(Boolean).join(' ');

                const emailData = createStatusChangeEmail({
                  orderNumber: freshOrder.order_number,
                  customerName: freshOrder.customer_name,
                  deviceInfo,
                  newStatus,
                  previousStatus: oldStatus,
                  businessInfo,
                  logoUrl: businessInfo.logo_url,
                  warrantyText
                });
                
                await base44.integrations.Core.SendEmail({
                    to: customerEmail,
                    subject: emailData.subject,
                    body: emailData.body,
                    from_name: businessInfo.business_name || "SmartFixOS"
                });
                
                console.log(`[Order ${data.id}] Warranty email sent to ${customerEmail}`);
            }

            return Response.json({ success: true, message: 'Warranty email sent' });
        }

        // ====== PART ARRIVED - ESPERANDO EQUIPO ======
        if (newStatus === 'part_arrived_waiting_device' && oldStatus !== 'part_arrived_waiting_device') {
            
            console.log(`[Order ${data.id}] Status changed to part_arrived_waiting_device. Sending notification...`);
            
            const freshOrders = await base44.asServiceRole.entities.Order.filter({ id: data.id });
            const freshOrder = freshOrders?.[0] || data;
            const customerEmail = freshOrder.customer_email;
            
            if (customerEmail) {
                const emailSubject = `Tu pieza ya llegó – estamos esperando tu equipo (Orden #${freshOrder.order_number})`;
                const emailBody = `
                    <div style="font-family: sans-serif; color: #333;">
                        <h2>Hola 👋</h2>
                        <p>Tu pieza para la reparación (Orden <strong>${freshOrder.order_number}</strong>) ya se encuentra en nuestro taller.</p>
                        <p>En este momento estamos esperando que nos entregues tu equipo para poder comenzar el trabajo.</p>
                        <p>Tan pronto recibamos el equipo, procederemos con la reparación.</p>
                        <p>Si tienes alguna pregunta o deseas coordinar la entrega, contáctanos.</p>
                        <br/>
                        <p>— 911 SmartFix</p>
                    </div>
                `;
                
                await base44.integrations.Core.SendEmail({
                    to: customerEmail,
                    subject: emailSubject,
                    body: emailBody,
                    from_name: "911 SmartFix"
                });
                
                console.log(`[Order ${data.id}] Email sent to ${customerEmail}`);
            }
            
            await base44.asServiceRole.entities.Order.update(data.id, {
                status_metadata: {
                    ...data.status_metadata,
                    part_arrived_at: new Date().toISOString(),
                    last_notification_sent: new Date().toISOString()
                }
            });

            return Response.json({ success: true, message: 'Notification sent' });
        }
        
        return Response.json({ success: true, message: 'No action needed' });
        
    } catch (error) {
        console.error('Error in handleOrderStatusChange:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
};
