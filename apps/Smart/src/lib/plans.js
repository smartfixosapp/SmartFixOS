/**
 * SmartFixOS — Plan Definitions
 *
 *   solo — $19/mes — talleres individuales, sin módulos de equipo
 *   team — $39/mes — empleados, nómina, comisiones, chat, finanzas mensual…
 *   pro  — $79/mes — multi-sucursal, empleados ilimitados, export, soporte
 *
 * Facturación anual: paga 10 meses, llevas 12 (2 meses gratis)
 */

// ── Plan definitions ─────────────────────────────────────────────

export const PLANS = {
  solo: {
    id: 'solo',
    label: 'Plan Solo',
    price: 19,
    priceAnnual: 190,
    tagline: 'Para técnicos independientes',
    trialDays: 14,
  },
  team: {
    id: 'team',
    label: 'Plan Equipo',
    price: 39,
    priceAnnual: 390,
    tagline: 'Gestión completa de equipo',
    trialDays: 14,
  },
  pro: {
    id: 'pro',
    label: 'Plan Pro',
    price: 79,
    priceAnnual: 790,
    tagline: 'Varias sucursales y todo el poder',
    trialDays: 14,
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
  pro: {
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
    pro:        'pro',
    // Trial / top-tier equivalents
    trial:      'team',
    beta:       'pro',
    founders_lifetime: 'pro',
    // Legacy
    starter:    'solo',
    basic:      'solo',
    smartfixos: 'solo',
    business:   'pro',
    enterprise: 'pro',
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
  if (id === 'solo') return PLANS.team;
  if (id === 'team') return PLANS.pro;
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
