/**
 * SmartFixOS — Plan Definitions (Simplified)
 *
 * Solo 2 planes. Solo 2 limites de cantidad. Todo lo demas desbloqueado.
 *
 *   starter — $14.99/mes — 50 ordenes/mes (renovable) / 50 productos en inventario
 *   pro     — $39.99/mes — ilimitado en todo
 *
 * Nota: las ordenes son por ciclo mensual (renueva cada mes), no acumulado.
 * Los clientes son ilimitados en ambos planes (cada orden crea un cliente,
 * van de la mano).
 */

// ── Plan definitions ─────────────────────────────────────────────

export const PLANS = {
  starter: {
    id: 'starter',
    label: 'Starter',
    price: 14.99,
    priceAnnual: 149.90,
    tagline: 'Para técnicos independientes',
    trialDays: 14,
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    price: 39.99,
    priceAnnual: 399.90,
    tagline: 'Sin límites',
    trialDays: 14,
  },
};

// ── Limits per plan (-1 = unlimited) ─────────────────────────────

export const PLAN_LIMITS = {
  starter: {
    max_active_orders:   50,
    max_customers:       100,
    max_skus:            50,
  },
  pro: {
    max_active_orders:   -1,
    max_customers:       -1,
    max_skus:            -1,
  },
};

// ── Helpers ──────────────────────────────────────────────────────

/** Normalize legacy plan names to new plan IDs */
export function normalizePlanId(raw) {
  const map = {
    smartfixos: 'starter',
    basic:      'starter',
    starter:    'starter',
    pro:        'pro',
    business:   'pro', // legacy — Business no longer exists
    enterprise: 'pro', // legacy
  };
  return map[String(raw || '').trim().toLowerCase()] || 'starter';
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
 */
export function checkPlanLimit(planId, limitKey, currentCount) {
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
  return id === 'starter' ? PLANS.pro : null;
}

// ── Compatibility shims (for old call sites) ────────────────────
// These let existing PlanGate / UpgradePrompt usages compile without errors.
// All features return true (unlocked) — only quantity limits are enforced.

/** @deprecated Plans no longer use feature flags. Always returns true. */
export function canUsePlanFeature(_planId, _featureKey) {
  return true;
}

/** @deprecated Use PLAN_LIMITS keys directly. */
export function getAllFeatureKeys() {
  return [];
}
