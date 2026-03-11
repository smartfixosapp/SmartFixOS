import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';
import Stripe from 'npm:stripe@14.19.0';

/**
 * Función de reconciliación: sincroniza el estado de suscripciones con Stripe.
 * Stripe maneja los cobros recurrentes automáticamente vía webhooks.
 * Esta función es un respaldo en caso de que algún webhook no llegue.
 */
export async function processRecurringPaymentsHandler(req) {
  console.log("🦕 processRecurringPayments called");
  try {
    const base44 = createClientFromRequest(req, {
      functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),
      entitiesPath: new URL('../Entities', import.meta.url).pathname
    });

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

    // Obtener todos los tenants con suscripción Stripe activa o past_due
    const allTenants = await base44.entities.Tenant.filter({});
    const stripeTenants = allTenants.filter(t =>
      t.stripe_subscription_id &&
      ['active', 'past_due'].includes(t.subscription_status)
    );

    if (stripeTenants.length === 0) {
      return Response.json({
        success: true,
        message: 'No hay suscripciones Stripe para sincronizar',
        results: { checked: 0, updated: 0 }
      });
    }

    const results = { checked: 0, updated: 0, errors: 0, details: [] };

    for (const tenant of stripeTenants) {
      try {
        results.checked++;

        const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);

        // Mapear estado de Stripe a nuestro estado
        let newStatus;
        switch (subscription.status) {
          case 'active':    newStatus = 'active';    break;
          case 'trialing':  newStatus = 'active';    break;
          case 'past_due':  newStatus = 'past_due';  break;
          case 'canceled':  newStatus = 'cancelled'; break;
          case 'unpaid':    newStatus = 'past_due';  break;
          default:          newStatus = tenant.subscription_status;
        }

        const nextBillingDate = new Date(subscription.current_period_end * 1000)
          .toISOString().split('T')[0];

        // Solo actualizar si hay cambios relevantes
        const statusChanged = newStatus !== tenant.subscription_status;
        const billingDateChanged = nextBillingDate !== tenant.next_billing_date;

        if (statusChanged || billingDateChanged) {
          await base44.entities.Tenant.update(tenant.id, {
            subscription_status: newStatus,
            next_billing_date: nextBillingDate
          });
          results.updated++;
          results.details.push({
            tenant_id: tenant.id,
            name: tenant.name,
            old_status: tenant.subscription_status,
            new_status: newStatus,
            next_billing_date: nextBillingDate
          });
        }

      } catch (err) {
        console.error(`Error sincronizando tenant ${tenant.id}:`, err.message);
        results.errors++;
      }
    }

    console.log(`✅ Sync completado: ${results.checked} revisados, ${results.updated} actualizados, ${results.errors} errores`);
    return Response.json({ success: true, results });

  } catch (error) {
    console.error('Error in processRecurringPayments:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
