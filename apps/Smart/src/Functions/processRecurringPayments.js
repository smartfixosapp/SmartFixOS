import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

// Función para procesar pagos recurrentes mensuales
// Se ejecuta automáticamente cada día para verificar y procesar pagos vencidos
export async function processRecurringPaymentsHandler(req) {
  console.log("🦕 processRecurringPayments called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    // Verificar que sea admin
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Obtener todas las tiendas con suscripción activa
    const activeTenants = await base44.entities.Tenant.filter({
      subscription_status: 'active'
    });

    if (!activeTenants || activeTenants.length === 0) {
      return Response.json({ 
        success: true,
        message: 'No active subscriptions to process'
      });
    }

    const today = new Date();
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      tenants_processed: []
    };

    // Procesar cada tienda
    for (const tenant of activeTenants) {
      try {
        // Verificar si es fecha de cobro
        if (!tenant.next_billing_date) {
          continue;
        }

        const nextBillingDate = new Date(tenant.next_billing_date);
        
        // Si aún no es fecha de cobro, saltar
        if (nextBillingDate > today) {
          continue;
        }

        results.processed++;

        // Simular procesamiento de pago
        // En producción: integrar con Stripe, PayPal, etc.
        const paymentSuccessful = await processPayment(tenant, base44);

        if (paymentSuccessful) {
          results.successful++;

          // Actualizar tenant: pago realizado, resetear contador de intentos
          const newNextBillingDate = new Date(nextBillingDate);
          newNextBillingDate.setMonth(newNextBillingDate.getMonth() + 1);

          await base44.entities.Tenant.update(tenant.id, {
            subscription_status: 'active',
            last_payment_date: new Date().toISOString(),
            last_payment_amount: tenant.monthly_cost,
            failed_payment_attempts: 0,
            next_billing_date: newNextBillingDate.toISOString().split('T')[0]
          });

          // Crear registro de suscripción exitosa
          await base44.entities.Subscription.create({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            plan: tenant.plan,
            status: 'active',
            amount: tenant.monthly_cost,
            billing_cycle_start: nextBillingDate.toISOString().split('T')[0],
            billing_cycle_end: newNextBillingDate.toISOString().split('T')[0],
            next_billing_date: newNextBillingDate.toISOString().split('T')[0],
            payment_method: tenant.payment_method,
            last_payment_date: new Date().toISOString(),
            last_payment_amount: tenant.monthly_cost,
            last_payment_status: 'succeeded'
          });

          results.tenants_processed.push({
            id: tenant.id,
            name: tenant.name,
            status: 'success',
            amount: tenant.monthly_cost
          });

        } else {
          results.failed++;

          const newFailedAttempts = (tenant.failed_payment_attempts || 0) + 1;
          const newStatus = newFailedAttempts >= 3 ? 'past_due' : 'active';

          // Actualizar tenant: pago fallido, incrementar contador
          await base44.entities.Tenant.update(tenant.id, {
            subscription_status: newStatus,
            failed_payment_attempts: newFailedAttempts
          });

          // Crear registro de pago fallido
          await base44.entities.Subscription.create({
            tenant_id: tenant.id,
            tenant_name: tenant.name,
            plan: tenant.plan,
            status: newStatus,
            amount: tenant.monthly_cost,
            next_billing_date: tenant.next_billing_date,
            payment_method: tenant.payment_method,
            last_payment_status: 'failed'
          });

          results.tenants_processed.push({
            id: tenant.id,
            name: tenant.name,
            status: 'failed',
            attempts: newFailedAttempts
          });
        }

      } catch (error) {
        console.error(`Error processing tenant ${tenant.id}:`, error);
        results.failed++;
      }
    }

    return Response.json({ 
      success: true,
      results
    });

  } catch (error) {
    console.error('Error in processRecurringPayments:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
};

// Simular procesamiento de pago
// En producción: integrar con Stripe, PayPal, etc.
async function processPayment(tenant, base44) {
  try {
    // Aquí iría la lógica real de pago con Stripe/PayPal
    // Por ahora: simular 95% de éxito
    const isSuccessful = Math.random() < 0.95;
    
    return isSuccessful;

  } catch (error) {
    console.error('Payment processing error:', error);
    return false;
  }
}
