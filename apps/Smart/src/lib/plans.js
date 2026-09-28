/**
 * SmartFixOS — Plan Definitions
 *
 *   solo — $9.99/mes — un solo plan, todo incluido (hasta 5 usuarios,
 *   chat interno, nómina, multi-device). Los ids team/pro/legacy se
 *   mantienen solo para no romper tenants viejos en DB; todos
 *   normalizan a 'solo'.
 */

// ── Plan definitions ─────────────────────────────────────────────

export const PLANS = {
  solo: {
    id: 'solo',
    label: 'Archilla OS',
    price: 9.99,
    priceAnnual: 99.90,
    tagline: 'Todo tu taller, todo incluido',
    trialDays: 14,
  },
};

// ── Limits per plan (-1 = unlimited) ─────────────────────────────

export const PLAN_LIMITS = {
  solo: {
    max_orders_monthly:  -1,
    max_skus:            -1,
  },
};

// ── Helpers ──────────────────────────────────────────────────────

/** Normalize legacy plan names to canonical plan IDs — un solo plan real */
export function normalizePlanId(raw) {
  return 'solo';
}

/** Get plan config (metadata + limits) */
export function getPlan(planId) {
  const id = normalizePlanId(planId);
  return {
    ...PLANS[id],
    limits: PLAN_LIMITS[id],
  };
}

/**
 * Check if a limit is exceeded.
 * Returns { allowed: bool, current, max, upgradeNeeded }
 *
 * Returns allowed:true unconditionally when VITE_BILLING_ENABLED !== 'true'.
 */
export function checkPlanLimit(planId, limitKey, currentCount) {
  if (import.meta.env.VITE_BILLING_ENABLED !== 'true') {
    return { allowed: true, current: currentCount, max: Infinity, upgradeNeeded: false };
  }
  const id = normalizePlanId(planId);
  const limits = PLAN_LIMITS[id];
  if (!limits) return { allowed: true, current: currentCount, max: Infinity, upgradeNeeded: false };

  const max = limits[limitKey];
  if (max === undefined || max === -1) {
    return { allowed: true, current: currentCount, max: Infinity, upgradeNeeded: false };
  }

  return {
    allowed: currentCount < max,
    current: currentCount,
    max,
    upgradeNeeded: currentCount >= max,
  };
}

/** @deprecated Un solo plan — no hay upgrade de tier. Siempre null. */
export function getUpgradePlan(_currentPlanId) {
  return null;
}

// ── Compatibility shims ─────────────────────────────────────────

/** @deprecated Plans no longer use feature flags. Always returns true. */
export function canUsePlanFeature(_planId, _featureKey) {
  return true;
}

/** @deprecated Use PLAN_LIMITS keys directly. */
export function getAllFeatureKeys() {
  return [];
}
