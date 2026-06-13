import { createClientFromRequest, createUnifiedClient } from '../../../../lib/unified-custom-sdk-supabase.js';
import Stripe from 'npm:stripe@14.19.0';

/**
 * Crea una sesión del Stripe Billing Portal para que el tenant gestione
 * su suscripción (cancelar, cambiar método de pago, ver facturas).
 *
 * Acepta dos modos:
 *   1. Usuario autenticado (Bearer token) — usa su tenant directamente.
 *   2. Email lookup — recibe { email } en el body, busca el tenant por email.
 *      Útil cuando el usuario llega desde el botón del iOS app sin sesión web.
 */
export async function createStripePortalSessionHandler(req) {
  console.log("🦕 createStripePortalSession called");

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
  const origin = req.headers.get("origin") || Deno.env.get("VITE_APP_URL") || "https://app.archillaos.com";

  try {
    const body = await req.json().catch(() => ({}));
    const { email, returnUrl } = body;
    const redirectUrl = returnUrl || `${origin}/billing?portal_return=true`;

    // ── Mode 1: authenticated user ───────────────────────────────
    let tenant = null;
    try {
      const base44 = createClientFromRequest(req, {
        functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),
        entitiesPath: new URL('../Entities', import.meta.url).pathname
      });
      const user = await base44.auth.me();
      if (user) {
        const tenants = await base44.entities.Tenant.filter({ owner_email: user.email }, '-created_date', 1);
        tenant = tenants?.[0] || null;
      }
    } catch {
      // No valid auth token — fall through to email lookup
    }

    // ── Mode 2: email lookup ─────────────────────────────────────
    if (!tenant && email) {
      const serviceClient = createUnifiedClient({
        entitiesPath: new URL('../Entities', import.meta.url).pathname
      });
      const tenants = await serviceClient.asServiceRole.entities.Tenant.filter(
        { owner_email: email.toLowerCase().trim() },
        '-created_date',
        1
      );
      tenant = tenants?.[0] || null;
    }

    if (!tenant) {
      return Response.json(
        { error: 'No se encontró ninguna cuenta asociada a este email.' },
        { status: 404 }
      );
    }

    if (!tenant.stripe_customer_id) {
      return Response.json(
        { error: 'Esta cuenta no tiene una suscripción activa de Stripe.' },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: redirectUrl,
    });

    console.log(`✅ Portal session creado para tenant ${tenant.id}: ${session.url}`);
    return Response.json({ url: session.url });

  } catch (error) {
    console.error("createStripePortalSession error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
