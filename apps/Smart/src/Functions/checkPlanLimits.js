/**
 * checkPlanLimits — Backend enforcement for the 3 quantity limits.
 *
 * Endpoints:
 *   POST /checkPlanLimits
 *   Body: { tenantId, key: "max_active_orders" | "max_customers" | "max_skus", currentCount }
 *
 * Returns: { allowed: bool, plan, max?, current?, upgradeNeeded?, upgradeTo? }
 */
import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

const PLAN_LIMITS = {
  starter: { max_orders_monthly: 50, max_skus: 50 },
  pro:     { max_orders_monthly: -1, max_skus: -1 },
};

const PLAN_INFO = {
  starter: { label: 'Starter', price: 14.99 },
  pro:     { label: 'Pro',     price: 39.99 },
};

const UPGRADE_MAP = { starter: 'pro', pro: null };

function normalizePlan(raw) {
  const map = { smartfixos: 'starter', basic: 'starter', enterprise: 'pro', business: 'pro' };
  const n = String(raw || '').trim().toLowerCase();
  return map[n] || (PLAN_LIMITS[n] ? n : 'starter');
}

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

  try {
    const base44 = createClientFromRequest(req, {
      functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),
      entitiesPath: new URL('../Entities', import.meta.url).pathname,
    });

    const body = await req.json();
    const { tenantId, key, currentCount } = body;

    if (!tenantId || !key) {
      return Response.json({ allowed: false, error: 'tenantId and key are required' }, { status: 400 });
    }

    const tenant = await base44.asServiceRole.entities.Tenant.get(tenantId);
    if (!tenant) {
      return Response.json({ allowed: false, error: 'Tenant not found' }, { status: 404 });
    }

    const planId = normalizePlan(tenant.plan);
    const limits = PLAN_LIMITS[planId] || PLAN_LIMITS.starter;
    const max = limits[key];

    if (max === undefined) {
      return Response.json({ allowed: false, error: `Unknown limit key: ${key}` }, { status: 400 });
    }

    if (max === -1) {
      return Response.json({ allowed: true, plan: planId, max: -1, current: currentCount || 0, upgradeNeeded: false });
    }

    const count = Number(currentCount) || 0;
    const allowed = count < max;
    const nextPlanId = UPGRADE_MAP[planId];

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
  } catch (error) {
    console.error('checkPlanLimits error:', error);
    return Response.json({ allowed: false, error: error.message }, { status: 500 });
  }
}
