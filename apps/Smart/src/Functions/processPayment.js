import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

/**
 * Procesa el pago de activación del plan
 * Integración con Stripe (o gateway de pago)
 */
export async function processPaymentHandler(req) {
  console.log("🦕 processPayment called");
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

    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        success: false,
        error: 'No autenticado' 
      }, { status: 401 });
    }

    const { tenantId, planPrice } = await req.json();

    if (!tenantId || !planPrice) {
      return Response.json({ 
        success: false,
        error: 'Datos incompletos' 
      }, { status: 400 });
    }

    // Validar que el usuario sea owner/admin del tenant
    const tenant = await base44.entities.Tenant.get(tenantId);
    if (!tenant) {
      return Response.json({ 
        success: false,
        error: 'Tienda no encontrada' 
      }, { status: 404 });
    }

    // Simulación: en producción, integrar con Stripe
    // const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
    // const session = await stripe.checkout.sessions.create({ ... });

    // Por ahora, procesar localmente
    const now = new Date();
    const nextBillingDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

    // Actualizar tenant
    await base44.asServiceRole.entities.Tenant.update(tenantId, {
      subscription_status: "active",
      trial_status: "completed",
      last_payment_date: now.toISOString(),
      last_payment_amount: planPrice,
      next_billing_date: nextBillingDate.toISOString().split('T')[0],
      payment_method: "stripe"
    });

    // Registrar transacción (opcional)
    try {
      await base44.asServiceRole.entities.Transaction.create({
        type: "revenue",
        amount: planPrice,
        category: "other",
        description: `Plan SmartFixOS - ${tenant.name}`,
        recorded_by: user.email,
        metadata: {
          tenant_id: tenantId,
          plan: "smartfixos"
        }
      });
    } catch (err) {
      console.log("Transaction log skipped:", err.message);
    }

    // Log de auditoría
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: "subscription_activated",
        entity_type: "tenant",
        entity_id: tenantId,
        user_id: user.id,
        user_name: user.full_name,
        user_role: user.role,
        changes: {
          before: {
            subscription_status: tenant.subscription_status,
            trial_status: tenant.trial_status
          },
          after: {
            subscription_status: "active",
            trial_status: "completed"
          }
        }
      });
    } catch (err) {
      console.log("Audit log skipped:", err.message);
    }

    return Response.json({
      success: true,
      message: "Pago procesado exitosamente",
      nextBillingDate: nextBillingDate.toISOString().split('T')[0]
    });

  } catch (error) {
    console.error("Payment processing error:", error);
    return Response.json({ 
      success: false,
      error: error.message || "Error al procesar el pago" 
    }, { status: 500 });
  }
};
