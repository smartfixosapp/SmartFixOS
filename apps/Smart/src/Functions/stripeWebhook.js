import { createUnifiedClient } from '../../../../lib/unified-custom-sdk-supabase.js';
import Stripe from 'npm:stripe@14.19.0';

/**
 * Webhook handler para eventos de Stripe.
 * IMPORTANTE: necesita el body crudo (sin parsear) para verificar la firma.
 *
 * Eventos manejados:
 * - checkout.session.completed → activa suscripción del tenant
 * - invoice.payment_succeeded  → actualiza próxima fecha de cobro
 * - invoice.payment_failed     → incrementa intentos fallidos, marca past_due si >= 3
 * - customer.subscription.deleted → cancela suscripción del tenant
 */
export async function stripeWebhookHandler(req) {
  console.log("🦕 stripeWebhook called");

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const sig = req.headers.get('stripe-signature');

  let event;
  const rawBody = await req.text();

  try {
    if (webhookSecret && sig) {
      event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
    } else {
      // Dev mode sin webhook secret configurado: parsear directamente
      console.warn("⚠️ STRIPE_WEBHOOK_SECRET no configurado — verificación de firma desactivada");
      event = JSON.parse(rawBody);
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return Response.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Cliente service role (sin auth de usuario — es un evento de Stripe)
  const base44 = createUnifiedClient({
    entitiesPath: new URL('../Entities', import.meta.url).pathname
  });

  try {
    switch (event.type) {

      // ✅ Suscripción completada (primer pago exitoso)
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const tenantId = session.metadata?.tenant_id;
        if (!tenantId) {
          console.warn("checkout.session.completed: no tenant_id en metadata");
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const nextBillingDate = new Date(subscription.current_period_end * 1000)
          .toISOString().split('T')[0];
        const amount = (session.amount_total || 0) / 100;

        await base44.asServiceRole.entities.Tenant.update(tenantId, {
          subscription_status: 'active',
          trial_status: 'completed',
          stripe_subscription_id: session.subscription,
          last_payment_date: new Date().toISOString(),
          last_payment_amount: amount,
          next_billing_date: nextBillingDate,
          failed_payment_attempts: 0,
          payment_method: 'stripe'
        });

        await base44.asServiceRole.entities.Subscription.create({
          tenant_id: tenantId,
          plan: 'smartfixos',
          status: 'active',
          amount,
          billing_cycle_start: new Date().toISOString().split('T')[0],
          billing_cycle_end: nextBillingDate,
          next_billing_date: nextBillingDate,
          payment_method: 'stripe',
          last_payment_date: new Date().toISOString(),
          last_payment_amount: amount,
          last_payment_status: 'succeeded',
          metadata: {
            stripe_session_id: session.id,
            stripe_subscription_id: session.subscription
          }
        });

        console.log(`✅ Tenant ${tenantId} activado — suscripción ${session.subscription}`);
        break;
      }

      // ✅ Pago recurrente exitoso
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (!invoice.subscription || invoice.billing_reason === 'subscription_create') break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const tenantId = subscription.metadata?.tenant_id;
        if (!tenantId) break;

        const nextBillingDate = new Date(subscription.current_period_end * 1000)
          .toISOString().split('T')[0];
        const amount = (invoice.amount_paid || 0) / 100;

        await base44.asServiceRole.entities.Tenant.update(tenantId, {
          subscription_status: 'active',
          last_payment_date: new Date().toISOString(),
          last_payment_amount: amount,
          next_billing_date: nextBillingDate,
          failed_payment_attempts: 0
        });

        await base44.asServiceRole.entities.Subscription.create({
          tenant_id: tenantId,
          plan: 'smartfixos',
          status: 'active',
          amount,
          next_billing_date: nextBillingDate,
          payment_method: 'stripe',
          last_payment_date: new Date().toISOString(),
          last_payment_amount: amount,
          last_payment_status: 'succeeded',
          metadata: { stripe_invoice_id: invoice.id }
        });

        console.log(`✅ Pago recurrente exitoso para tenant ${tenantId}: $${amount}`);
        break;
      }

      // ❌ Pago fallido
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
        const tenantId = subscription.metadata?.tenant_id;
        if (!tenantId) break;

        const tenant = await base44.asServiceRole.entities.Tenant.get(tenantId);
        const failedAttempts = (tenant?.failed_payment_attempts || 0) + 1;
        const newStatus = failedAttempts >= 3 ? 'past_due' : 'active';
        const amount = (invoice.amount_due || 0) / 100;

        await base44.asServiceRole.entities.Tenant.update(tenantId, {
          subscription_status: newStatus,
          failed_payment_attempts: failedAttempts
        });

        await base44.asServiceRole.entities.Subscription.create({
          tenant_id: tenantId,
          plan: 'smartfixos',
          status: newStatus,
          amount,
          payment_method: 'stripe',
          last_payment_status: 'failed',
          metadata: { stripe_invoice_id: invoice.id, attempt: failedAttempts }
        });

        console.log(`❌ Pago fallido para tenant ${tenantId} — intento ${failedAttempts}, estado: ${newStatus}`);
        break;
      }

      // 🚫 Suscripción cancelada
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const tenantId = subscription.metadata?.tenant_id;
        if (!tenantId) break;

        await base44.asServiceRole.entities.Tenant.update(tenantId, {
          subscription_status: 'cancelled',
          stripe_subscription_id: null
        });

        await base44.asServiceRole.entities.Subscription.create({
          tenant_id: tenantId,
          plan: 'smartfixos',
          status: 'cancelled',
          payment_method: 'stripe',
          cancellation_date: new Date().toISOString().split('T')[0],
          last_payment_status: 'failed',
          metadata: { stripe_subscription_id: subscription.id }
        });

        console.log(`🚫 Suscripción cancelada para tenant ${tenantId}`);
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }

  return Response.json({ received: true });
}
