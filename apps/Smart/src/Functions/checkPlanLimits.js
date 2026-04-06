/**
 * checkPlanLimits — Backend enforcement for plan limits and feature access.
 *
 * Called before any gated operation (create employee, create order, etc.)
 * to verify the tenant's plan allows it.
 *
 * Endpoints:
 *   POST /checkPlanLimits
 *   Body: { tenantId, check: "feature" | "limit", key: "...", currentCount?: number }
 *
 * Returns: { allowed: bool, plan, max?, current?, upgradeNeeded?, upgradeTo? }
 */
import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

// ── Plan definitions (mirror of lib/plans.js for Deno) ───────────

const PLAN_LIMITS = {
  starter:  { max_users: 1,  max_active_orders: 50,  max_customers: 200, max_skus: 100, max_custom_statuses: 0, max_cash_registers: 0, max_roles: 0 },
  pro:      { max_users: 5,  max_active_orders: -1,  max_customers: -1,  max_skus: 1000, max_custom_statuses: 12, max_cash_registers: 1, max_roles: 3 },
  business: { max_users: 10, max_active_orders: -1,  max_customers: -1,  max_skus: -1,  max_custom_statuses: -1, max_cash_registers: 3, max_roles: -1 },
};

const PLAN_FEATURES = {
  starter: {
    orders_assign_technician: false, orders_internal_notes: false, orders_photos: false, orders_change_history: false,
    customers_tags: false, customers_segments: false, workflow_custom: false,
    inventory_alerts: false, inventory_costs: false, inventory_suppliers: false, inventory_purchase_orders: false, inventory_reorder: false,
    pos_cash_open_close: false, pos_discounts: false, pos_credit_notes: false, pos_multi_register: false,
    reports_by_technician: false, reports_by_service: false, reports_export_csv: false, reports_financial: false, reports_export_pdf: false,
    permissions_roles: false, permissions_custom: false,
    automations_triggers: false, automations_emails: false, automations_scheduled: false,
    api_access: false, priority_support: false,
  },
  pro: {
    orders_assign_technician: true, orders_internal_notes: true, orders_photos: true, orders_change_history: true,
    customers_tags: true, customers_segments: true, workflow_custom: true,
    inventory_alerts: true, inventory_costs: true, inventory_suppliers: true, inventory_purchase_orders: true, inventory_reorder: false,
    pos_cash_open_close: true, pos_discounts: true, pos_credit_notes: true, pos_multi_register: false,
    reports_by_technician: true, reports_by_service: true, reports_export_csv: true, reports_financial: false, reports_export_pdf: false,
    permissions_roles: true, permissions_custom: false,
    automations_triggers: false, automations_emails: false, automations_scheduled: false,
    api_access: false, priority_support: false,
  },
  business: {
    orders_assign_technician: true, orders_internal_notes: true, orders_photos: true, orders_change_history: true,
    customers_tags: true, customers_segments: true, workflow_custom: true,
    inventory_alerts: true, inventory_costs: true, inventory_suppliers: true, inventory_purchase_orders: true, inventory_reorder: true,
    pos_cash_open_close: true, pos_discounts: true, pos_credit_notes: true, pos_multi_register: true,
    reports_by_technician: true, reports_by_service: true, reports_export_csv: true, reports_financial: true, reports_export_pdf: true,
    permissions_roles: true, permissions_custom: true,
    automations_triggers: true, automations_emails: true, automations_scheduled: true,
    api_access: true, priority_support: true,
  },
};

const PLAN_INFO = {
  starter:  { label: 'Starter',  price: 14.99 },
  pro:      { label: 'Pro',      price: 39.99 },
  business: { label: 'Business', price: 79.99 },
};

const UPGRADE_MAP = { starter: 'pro', pro: 'business', business: null };

function normalizePlan(raw) {
  const map = { smartfixos: 'starter', basic: 'starter', enterprise: 'business' };
  const n = String(raw || '').trim().toLowerCase();
  return map[n] || n || 'starter';
}

// TEMPORARY: All plan restrictions disabled at the backend level too.
// Every feature and limit check returns allowed:true. Revert when plan system is finalized.
const PLAN_RESTRICTIONS_ENABLED = false;

export async function checkPlanLimitsHandler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  // Short-circuit: restrictions disabled globally
  if (!PLAN_RESTRICTIONS_ENABLED) {
    try {
      const body = await req.json();
      return Response.json({
        allowed: true,
        plan: 'business',
        planLabel: 'Business',
        max: -1,
        current: body?.currentCount || 0,
        upgradeNeeded: false,
        upgradeTo: null,
      });
    } catch {
      return Response.json({ allowed: true, plan: 'business', upgradeNeeded: false });
    }
  }

  try {
    const base44 = createClientFromRequest(req, {
      functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),
      entitiesPath: new URL('../Entities', import.meta.url).pathname,
    });

    const body = await req.json();
    const { tenantId, check, key, currentCount } = body;

    if (!tenantId || !check || !key) {
      return Response.json({ allowed: false, error: 'tenantId, check, and key are required' }, { status: 400 });
    }

    const tenant = await base44.asServiceRole.entities.Tenant.get(tenantId);
    if (!tenant) {
      return Response.json({ allowed: false, error: 'Tenant not found' }, { status: 404 });
    }

    const planId = normalizePlan(tenant.plan);
    const nextPlanId = UPGRADE_MAP[planId];

    if (check === 'feature') {
      const features = PLAN_FEATURES[planId] || PLAN_FEATURES.starter;
      const allowed = features[key] === true;
      return Response.json({
        allowed,
        plan: planId,
        planLabel: PLAN_INFO[planId]?.label,
        feature: key,
        upgradeNeeded: !allowed,
        upgradeTo: !allowed && nextPlanId ? PLAN_INFO[nextPlanId] : null,
      });
    }

    if (check === 'limit') {
      const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.starter;
      const max = limits[key];

      if (max === undefined) {
        return Response.json({ allowed: false, error: `Unknown limit key: ${key}` }, { status: 400 });
      }

      if (max === -1) {
        return Response.json({ allowed: true, plan: planId, max: -1, current: currentCount || 0, upgradeNeeded: false });
      }

      const count = currentCount || 0;
      const allowed = count < max;

      return Response.json({
        allowed,
        plan: planId,
        planLabel: PLAN_INFO[planId]?.label,
        limit: key,
        max,
        current: count,
        upgradeNeeded: !allowed,
        upgradeTo: !allowed && nextPlanId ? PLAN_INFO[nextPlanId] : null,
      });
    }

    return Response.json({ allowed: false, error: 'check must be "feature" or "limit"' }, { status: 400 });

  } catch (error) {
    console.error('checkPlanLimits error:', error);
    return Response.json({ allowed: false, error: error.message }, { status: 500 });
  }
}
