/**
 * SmartFixOS — Plan Definitions
 *
 *   solo — $14.99/mes — talleres individuales, sin módulos de equipo
 *   team — $44.99/mes — todo desbloqueado: empleados, nómina, comisiones, chat…
 *
 * Facturación anual: -33%  →  solo $9.99/m ($119.88/año),  team $29.99/m ($359.88/año)
 */

// ── Plan definitions ─────────────────────────────────────────────

export const PLANS = {
  solo: {
    id: 'solo',
    label: 'Plan Solo',
    price: 14.99,
    priceAnnual: 119.88,   // $9.99/mo × 12
    tagline: 'Para técnicos independientes',
    trialDays: 15,
  },
  team: {
    id: 'team',
    label: 'Plan Equipo',
    price: 44.99,
    priceAnnual: 359.88,   // $29.99/mo × 12
    tagline: 'Gestión completa de equipo',
    trialDays: 15,
  },
};

// ── Limits per plan (-1 = unlimited) ─────────────────────────────

export const PLAN_LIMITS = {
  solo: {
    max_orders_monthly:  -1,
    max_skus:            -1,
  },
  team: {
    max_orders_monthly:  -1,
    max_skus:            -1,
  },
};

// ── Helpers ──────────────────────────────────────────────────────

/** Normalize legacy plan names to canonical plan IDs */
export function normalizePlanId(raw) {
  const map = {
    // Current
    solo:       'solo',
    team:       'team',
    // Legacy
    starter:    'solo',
    basic:      'solo',
    smartfixos: 'solo',
    pro:        'team',
    business:   'team',
    enterprise: 'team',
  };
  return map[String(raw || '').trim().toLowerCase()] || 'solo';
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

/** Get the upgrade plan (null if already on highest) */
export function getUpgradePlan(currentPlanId) {
  const id = normalizePlanId(currentPlanId);
  return id === 'solo' ? PLANS.team : null;
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
