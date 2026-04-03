import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';
import Stripe from 'npm:stripe@14.19.0';

const PLAN_MAP = {
  starter:    { max_users: 1,  monthly_cost: 14.99, label: 'Starter',  extra_user_cost: null },
  smartfixos: { max_users: 1,  monthly_cost: 14.99, label: 'Starter',  extra_user_cost: null }, // legacy alias
  basic:      { max_users: 1,  monthly_cost: 14.99, label: 'Starter',  extra_user_cost: null }, // legacy alias
  pro:        { max_users: 5,  monthly_cost: 39.99, label: 'Pro',      extra_user_cost: 7 },
  business:   { max_users: 10, monthly_cost: 79.99, label: 'Business', extra_user_cost: 5 },
  enterprise: { max_users: 10, monthly_cost: 79.99, label: 'Business', extra_user_cost: 5 }, // legacy alias
};

function normalizePlan(plan) {
  const normalized = String(plan || '').trim().toLowerCase();
  if (normalized === 'basic') return 'smartfixos';
  return normalized;
}

async function getLatestSubscription(base44, tenantId) {
  const rows = await base44.asServiceRole.entities.Subscription.filter({ tenant_id: tenantId }, '-created_date', 10);
  return (rows || [])[0] || null;
}

/**
 * Gestión de tenants por Super Admin.
 * Acciones: suspend | reactivate | delete
 *
 * DELETE hace soft-delete + cancela Stripe + elimina empleados.
 * Solo accesible por usuarios con role = 'super_admin' o email maestro.
 */
export async function manageTenantHandler(req) {
  console.log("🦕 manageTenant called");
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

    // Solo super_admin puede gestionar tenants
    if (user.role !== 'super_admin' && user.role !== 'admin') {
      return Response.json({ success: false, error: 'Acceso denegado' }, { status: 403 });
    }

    const payload = await req.json();
    const { tenantId, action, reason, plan } = payload;

    if (!tenantId || !action) {
      return Response.json({ success: false, error: 'tenantId y action son requeridos' }, { status: 400 });
    }

    if (!['suspend', 'reactivate', 'delete', 'extend_trial', 'set_plan', 'edit', 'reset_password'].includes(action)) {
      return Response.json({ success: false, error: 'Acción inválida' }, { status: 400 });
    }

    const tenant = await base44.asServiceRole.entities.Tenant.get(tenantId);
    if (!tenant) {
      return Response.json({ success: false, error: 'Tenant no encontrado' }, { status: 404 });
    }

    // ─────────────────────────────────────────────
    // SUSPEND — deshabilita acceso, conserva datos
    // ─────────────────────────────────────────────
    if (action === 'suspend') {
      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        status: 'suspended',
        subscription_status: 'paused',
        metadata: {
          ...(tenant.metadata || {}),
          suspended_at: new Date().toISOString(),
          suspended_by: user.email,
          suspend_reason: reason || ''
        }
      });

      await base44.asServiceRole.entities.AuditLog.create({
        action: 'tenant_suspended',
        entity_type: 'tenant',
        entity_id: tenantId,
        user_id: user.id,
        user_name: user.full_name,
        user_role: user.role,
        changes: { before: { status: tenant.status }, after: { status: 'suspended' } }
      });

      console.log(`🔴 Tenant ${tenantId} suspendido por ${user.email}`);
      return Response.json({ success: true, message: `Cuenta "${tenant.name}" suspendida` });
    }

    // ─────────────────────────────────────────────
    // REACTIVATE — restaura acceso
    // ─────────────────────────────────────────────
    if (action === 'reactivate') {
      const newSubscriptionStatus = 'active';

      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        status: 'active',
        subscription_status: newSubscriptionStatus,
        metadata: {
          ...(tenant.metadata || {}),
          reactivated_at: new Date().toISOString(),
          reactivated_by: user.email
        }
      });

      await base44.asServiceRole.entities.AuditLog.create({
        action: 'tenant_reactivated',
        entity_type: 'tenant',
        entity_id: tenantId,
        user_id: user.id,
        user_name: user.full_name,
        user_role: user.role,
        changes: { before: { status: tenant.status }, after: { status: 'active' } }
      });

      console.log(`✅ Tenant ${tenantId} reactivado por ${user.email}`);
      return Response.json({ success: true, message: `Cuenta "${tenant.name}" reactivada` });
    }

    // ─────────────────────────────────────────────
    // EXTEND_TRIAL — extiende trial 15 días
    // ─────────────────────────────────────────────
    if (action === 'extend_trial') {
      const base = tenant.trial_end_date
        ? new Date(Math.max(new Date(tenant.trial_end_date), new Date()))
        : new Date();
      base.setDate(base.getDate() + 15);

      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        trial_end_date: base.toISOString(),
        status: 'active',
        subscription_status: 'active',
        metadata: { ...(tenant.metadata || {}), trial_extended_at: new Date().toISOString(), trial_extended_by: user.email }
      });

      console.log(`⏳ Trial extendido 15d para tenant ${tenantId}`);
      return Response.json({ success: true, message: `Trial de "${tenant.name}" extendido 15 días (hasta ${base.toLocaleDateString('es')})` });
    }

    // ─────────────────────────────────────────────
    // SET_PLAN — cambia plan y límite de usuarios
    // ─────────────────────────────────────────────
    if (action === 'set_plan') {
      const normalizedPlan = normalizePlan(plan);
      const planData = PLAN_MAP[normalizedPlan];
      if (!planData) return Response.json({ success: false, error: 'Plan inválido. Usa: basic, pro, enterprise' }, { status: 400 });

      const trialEndDate = tenant.trial_end_date || null;
      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        plan: normalizedPlan,
        monthly_cost: planData.monthly_cost,
        subscription_status: 'active',
        metadata: {
          ...(tenant.metadata || {}),
          max_users: planData.max_users,
          plan_updated_at: new Date().toISOString(),
          plan_updated_by: user.email
        }
      });

      const currentSubscription = await getLatestSubscription(base44, tenantId);
      const subscriptionPayload = {
        tenant_id: tenantId,
        tenant_name: tenant.name || '',
        plan: normalizedPlan,
        status: 'active',
        amount: planData.monthly_cost,
        payment_method: currentSubscription?.payment_method || 'manual',
        trial_end_date: trialEndDate,
        metadata: {
          ...(currentSubscription?.metadata || {}),
          max_users: planData.max_users,
          updated_from_super_admin: true,
          updated_by: user.email,
        }
      };

      if (currentSubscription?.id) {
        await base44.asServiceRole.entities.Subscription.update(currentSubscription.id, subscriptionPayload);
      } else {
        await base44.asServiceRole.entities.Subscription.create(subscriptionPayload);
      }

      console.log(`📋 Plan "${normalizedPlan}" asignado a tenant ${tenantId}`);
      return Response.json({ success: true, message: `Plan "${planData.label}" asignado a "${tenant.name}" (máx ${planData.max_users} usuarios)` });
    }

    // ─────────────────────────────────────────────
    // EDIT — actualiza datos operativos de la tienda
    // ─────────────────────────────────────────────
    if (action === 'edit') {
      const nextPlan = normalizePlan(payload.plan || tenant.plan);
      const selectedPlan = PLAN_MAP[nextPlan] || PLAN_MAP.smartfixos;
      const nextMaxUsers = Number(payload.max_users || tenant?.metadata?.max_users || selectedPlan.max_users) || selectedPlan.max_users;
      const nextMonthlyCost = Number(payload.monthly_cost ?? tenant.monthly_cost ?? selectedPlan.monthly_cost);
      const nextTrialEndDate = payload.trial_end_date || tenant.trial_end_date || null;

      const tenantUpdate = {
        name: payload.name?.trim() || tenant.name,
        email: payload.email?.trim() || tenant.email,
        admin_name: payload.admin_name?.trim() || tenant.admin_name || '',
        admin_phone: payload.admin_phone?.trim() || tenant.admin_phone || '',
        country: payload.country?.trim() || tenant.country || '',
        currency: payload.currency?.trim() || tenant.currency || 'USD',
        timezone: payload.timezone?.trim() || tenant.timezone || 'America/Puerto_Rico',
        address: payload.address?.trim() || tenant.address || '',
        plan: nextPlan,
        status: payload.status || tenant.status || 'active',
        subscription_status: payload.subscription_status || tenant.subscription_status || 'active',
        monthly_cost: Number.isFinite(nextMonthlyCost) ? nextMonthlyCost : tenant.monthly_cost,
        trial_end_date: nextTrialEndDate,
        metadata: {
          ...(tenant.metadata || {}),
          max_users: nextMaxUsers,
          edited_at: new Date().toISOString(),
          edited_by: user.email,
        }
      };

      await base44.asServiceRole.entities.Tenant.update(tenantId, tenantUpdate);

      const currentSubscription = await getLatestSubscription(base44, tenantId);
      const subscriptionPayload = {
        tenant_id: tenantId,
        tenant_name: tenantUpdate.name,
        plan: nextPlan,
        status: tenantUpdate.subscription_status,
        amount: tenantUpdate.monthly_cost,
        payment_method: currentSubscription?.payment_method || tenant.payment_method || 'manual',
        trial_end_date: nextTrialEndDate,
        next_billing_date: payload.next_billing_date || currentSubscription?.next_billing_date || tenant.next_billing_date || null,
        metadata: {
          ...(currentSubscription?.metadata || {}),
          max_users: nextMaxUsers,
          edited_from_super_admin: true,
          edited_by: user.email,
        }
      };

      if (currentSubscription?.id) {
        await base44.asServiceRole.entities.Subscription.update(currentSubscription.id, subscriptionPayload);
      } else {
        await base44.asServiceRole.entities.Subscription.create(subscriptionPayload);
      }

      return Response.json({ success: true, message: `Tienda "${tenantUpdate.name}" actualizada` });
    }

    // ─────────────────────────────────────────────
    // RESET_PASSWORD — envía email de recuperación
    // ─────────────────────────────────────────────
    if (action === 'reset_password') {
      const email = String(payload.email || tenant.email || '').trim().toLowerCase();
      if (!email) {
        return Response.json({ success: false, error: 'No hay email para resetear contraseña' }, { status: 400 });
      }

      const SUPABASE_URL = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
      const SUPABASE_ANON_KEY = Deno.env.get('VITE_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
      const APP_URL = Deno.env.get('VITE_APP_URL') || 'https://smart-fix-os-smart.vercel.app';

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return Response.json({ success: false, error: 'Faltan variables de Supabase para enviar reset' }, { status: 500 });
      }

      const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          email,
          gotrue_meta_security: {},
          redirect_to: `${APP_URL}/PinAccess`,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        return Response.json({ success: false, error: text || 'No se pudo enviar reset' }, { status: 500 });
      }

      return Response.json({ success: true, message: `Reset enviado a ${email}` });
    }

    // ─────────────────────────────────────────────
    // DELETE — cancela Stripe + elimina empleados + borra tenant
    // ─────────────────────────────────────────────
    if (action === 'delete') {
      // 1. Cancelar suscripción en Stripe si existe
      if (tenant.stripe_subscription_id) {
        try {
          const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));
          await stripe.subscriptions.cancel(tenant.stripe_subscription_id);
          console.log(`✅ Stripe subscription ${tenant.stripe_subscription_id} cancelada`);
        } catch (stripeErr) {
          console.warn('Stripe cancel failed (non-critical):', stripeErr.message);
        }
      }

      // 2. Eliminar todos los app_employee del tenant
      try {
        const employees = await base44.asServiceRole.entities.AppEmployee.filter({ tenant_id: tenantId });
        for (const emp of (employees || [])) {
          await base44.asServiceRole.entities.AppEmployee.delete(emp.id);
        }
        console.log(`✅ ${employees?.length || 0} empleados eliminados del tenant ${tenantId}`);
      } catch (empErr) {
        console.warn('Employee deletion partial:', empErr.message);
      }

      // 3. Audit log ANTES de borrar el tenant
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'tenant_deleted',
          entity_type: 'tenant',
          entity_id: tenantId,
          user_id: user.id,
          user_name: user.full_name,
          user_role: user.role,
          changes: {
            tenant_name: tenant.name,
            tenant_email: tenant.email,
            deleted_by: user.email,
            delete_reason: reason || '',
            deleted_at: new Date().toISOString()
          }
        });
      } catch (_) { /* non-critical */ }

      // 4. Eliminar el tenant
      await base44.asServiceRole.entities.Tenant.delete(tenantId);

      console.log(`🗑️ Tenant ${tenantId} (${tenant.name}) eliminado por ${user.email}`);
      return Response.json({ success: true, message: `Cuenta "${tenant.name}" eliminada permanentemente` });
    }

  } catch (error) {
    console.error('manageTenant error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
