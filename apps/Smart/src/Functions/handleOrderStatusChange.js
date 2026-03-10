import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';
import { sendTemplatedEmailWithBase44 } from './emailTemplateRuntime.js';

/**
 * Handle Order Status Change
 * Triggered by Entity Automation when an Order is updated.
 *
 * For every status change, fetches the matching EmailTemplate from DB
 * (via sendTemplatedEmailWithBase44) and sends the email.
 * If no template exists for a given status, it logs and skips gracefully.
 */
export async function handleOrderStatusChangeHandler(req) {
    try {
        const base44 = createClientFromRequest(req, {
            functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),
            entitiesPath: new URL('../Entities', import.meta.url).pathname
        });

        // Parse the automation payload
        const payload = await req.json();
        const { event, data, old_data } = payload;

        // Only care about updates where status changed
        if (event.type !== 'update' || !data || !old_data) {
            return Response.json({ message: 'Ignored: Not an update or missing data' });
        }

        const newStatus = data.status;
        const oldStatus = old_data.status;

        if (!newStatus || newStatus === oldStatus) {
            return Response.json({ success: true, message: 'Status unchanged, no action needed' });
        }

        console.log(`[Order ${data.id}] Status changed: ${oldStatus} → ${newStatus}`);

        // Fetch fresh order with all fields so the email has complete info
        const freshOrders = await base44.asServiceRole.entities.Order.filter({ id: data.id });
        const freshOrder = freshOrders?.[0] || data;

        // Build device info string
        const deviceInfo = [
            freshOrder.device_brand,
            freshOrder.device_model,
            freshOrder.device_type
        ].filter(Boolean).join(' ');

        // Build the order_data object used by emailTemplateRuntime variable interpolation
        const order_data = {
            order_number:    freshOrder.order_number   || '',
            customer_name:   freshOrder.customer_name  || '',
            customer_email:  freshOrder.customer_email || '',
            device_info:     deviceInfo,
            initial_problem: freshOrder.initial_problem || freshOrder.problem_description || '',
            amount:          freshOrder.total_price    ?? freshOrder.amount ?? 0,
            balance:         freshOrder.balance        ?? 0,
            total_paid:      freshOrder.total_paid     ?? 0,
            sale_number:     freshOrder.sale_number    || '',
            payment_method:  freshOrder.payment_method || '',
            photos_metadata: freshOrder.photos_metadata  || [],
            checklist_items: freshOrder.checklist_items  || [],
        };

        // Send the templated email (fetches template from DB, renders HTML, logs result)
        const emailResult = await sendTemplatedEmailWithBase44(base44, {
            event_type: newStatus,
            order_data
        });

        console.log(`[Order ${data.id}] Email result for status "${newStatus}":`, emailResult);

        // Extra side-effect for part_arrived_waiting_device: record arrival timestamp
        if (newStatus === 'part_arrived_waiting_device') {
            await base44.asServiceRole.entities.Order.update(data.id, {
                status_metadata: {
                    ...(data.status_metadata || {}),
                    part_arrived_at: new Date().toISOString(),
                    last_notification_sent: new Date().toISOString()
                }
            });
        }

        return Response.json({
            success: true,
            status_changed: `${oldStatus} → ${newStatus}`,
            email: emailResult
        });

    } catch (error) {
        console.error('Error in handleOrderStatusChange:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}
