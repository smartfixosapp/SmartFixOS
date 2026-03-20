import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';
import Stripe from 'npm:stripe@14.19.0';

/**
 * Crea una sesión de Stripe Checkout en modo suscripción para activar el plan del tenant.
 * Retorna la URL del checkout hosted de Stripe — el frontend redirige al usuario ahí.
 */
export async function createStripeSubscriptionHandler(req) {
  console.log("🦕 createStripeSubscription called");
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    const base44 = createClientFromRequest(req, {
      functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),
      entitiesPath: new URL('../Entities', import.meta.url).pathname
    });

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ success: false, error: 'No autenticado' }, { status: 401 });
    }

    const { tenantId, successUrl, cancelUrl } = await req.json();
    if (!tenantId) {
      return Response.json({ success: false, error: 'tenantId requerido' }, { status: 400 });
    }

    const tenant = await base44.entities.Tenant.get(tenantId);
    if (!tenant) {
      return Response.json({ success: false, error: 'Tienda no encontrada' }, { status: 404 });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    const origin = req.headers.get("origin") || Deno.env.get("VITE_APP_URL") || "http://localhost:5173";

    // Obtener o crear Stripe Customer para el tenant
    let stripeCustomerId = tenant.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: tenant.name,
        metadata: {
          tenant_id: tenantId,
          app_id: Deno.env.get("APP_ID") || ""
        }
      });
      stripeCustomerId = customer.id;
      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        stripe_customer_id: stripeCustomerId
      });
    }

    // Crear Stripe Checkout Session en modo suscripción
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'SmartFixOS',
              description: 'Sistema de gestión para talleres de reparación electrónica',
            },
            unit_amount: Math.round((tenant.monthly_cost || 49) * 100),
            recurring: { interval: 'month' }
          },
          quantity: 1,
        }
      ],
      mode: 'subscription',
      success_url: successUrl || `${origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${origin}/?payment_cancelled=true`,
      metadata: {
        tenant_id: tenantId,
        app_id: Deno.env.get("APP_ID") || ""
      },
      subscription_data: {
        metadata: {
          tenant_id: tenantId
        }
      }
    });

    console.log(`✅ Stripe Checkout session created for tenant ${tenantId}: ${session.id}`);
    return Response.json({ success: true, url: session.url });

  } catch (error) {
    console.error("createStripeSubscription error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
