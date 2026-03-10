import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

// 🔐 VALIDAR ESTADO DEL TRIAL
// Se ejecuta antes de permitir acceso al PIN

export async function validateTrialStatusHandler(req) {
  console.log("🦕 validateTrialStatus called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const { tenantId } = await req.json();

    if (!tenantId) {
      return Response.json({ error: 'Tenant ID required' }, { status: 400 });
    }

    const tenant = await base44.asServiceRole.entities.Tenant.get(tenantId);

    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Validar trial
    const now = new Date();
    const trialEndDate = tenant.trial_end_date ? new Date(tenant.trial_end_date) : null;
    
    const isTrialActive = trialEndDate && now < trialEndDate;
    const isSubscriptionActive = tenant.subscription_status === "active";
    const canAccess = isTrialActive || isSubscriptionActive;

    // Si trial expiró pero no fue marcado como tal, actualizarlo
    if (!isTrialActive && trialEndDate && tenant.trial_status !== 'expired' && !isSubscriptionActive) {
      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        trial_status: 'expired',
        subscription_status: 'inactive',
      });
    }

    return Response.json({
      canAccess,
      isTrialActive,
      isSubscriptionActive,
      isTrialExpired: trialEndDate && now >= trialEndDate,
      daysRemaining: trialEndDate ? Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24)) : 0,
      trialEndDate: tenant.trial_end_date,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
      }
    });
  } catch (error) {
    console.error('Trial validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};
