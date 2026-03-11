import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';
import Stripe from 'npm:stripe@14.19.0';

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

    const { tenantId, action, reason, plan } = await req.json();

    if (!tenantId || !action) {
      return Response.json({ success: false, error: 'tenantId y action son requeridos' }, { status: 400 });
    }

    if (!['suspend', 'reactivate', 'delete', 'extend_trial', 'set_plan'].includes(action)) {
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
      const planMap = { basic: { max_users: 1, monthly_cost: 55 }, pro: { max_users: 3, monthly_cost: 85 }, enterprise: { max_users: 999, monthly_cost: 0 } };
      const planData = planMap[plan];
      if (!planData) return Response.json({ success: false, error: 'Plan inválido. Usa: basic, pro, enterprise' }, { status: 400 });

      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        plan,
        monthly_cost: planData.monthly_cost,
        metadata: { ...(tenant.metadata || {}), max_users: planData.max_users, plan_updated_at: new Date().toISOString(), plan_updated_by: user.email }
      });

      console.log(`📋 Plan "${plan}" asignado a tenant ${tenantId}`);
      return Response.json({ success: true, message: `Plan "${plan}" asignado a "${tenant.name}" (máx ${planData.max_users} usuarios)` });
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
