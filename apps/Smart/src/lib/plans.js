/**
 * SmartFixOS — Plan Definitions & Feature Flags
 *
 * Source of truth for plan limits and feature access.
 * Used by both frontend (usePlanLimits hook) and backend (checkPlanLimits function).
 *
 * 3 planes:
 *   starter  — Técnico solo         — $14.99/mes
 *   pro      — Taller (2-5 people)  — $39.99/mes
 *   business — Operación seria      — $79.99/mes
 */

// ── Plan definitions ─────────────────────────────────────────────

export const PLANS = {
  starter: {
    id: 'starter',
    label: 'Starter',
    price: 14.99,
    priceAnnual: 149.90, // 2 meses gratis
    tagline: 'Para técnicos independientes',
    trialDays: 14,
    extraUserCost: null, // no permite usuarios extra
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    price: 39.99,
    priceAnnual: 399.90,
    tagline: 'Para talleres con equipo',
    trialDays: 14,
    extraUserCost: 7,
  },
  business: {
    id: 'business',
    label: 'Business',
    price: 79.99,
    priceAnnual: 799.90,
    tagline: 'Para operaciones serias',
    trialDays: 14,
    extraUserCost: 5,
  },
};

// ── Limits per plan ──────────────────────────────────────────────

export const PLAN_LIMITS = {
  starter: {
    max_users:           1,
    max_active_orders:   50,
    max_customers:       200,
    max_skus:            100,
    max_custom_statuses: 0,
    max_cash_registers:  0,
    max_roles:           0,
  },
  pro: {
    max_users:           5,
    max_active_orders:   -1, // unlimited
    max_customers:       -1,
    max_skus:            1000,
    max_custom_statuses: 12,
    max_cash_registers:  1,
    max_roles:           3, // owner, technician, cashier (predefined)
  },
  business: {
    max_users:           10,
    max_active_orders:   -1,
    max_customers:       -1,
    max_skus:            -1,
    max_custom_statuses: -1,
    max_cash_registers:  3,
    max_roles:           -1,
  },
};

// ── Feature flags per plan ───────────────────────────────────────
// true = enabled, false = blocked

export const PLAN_FEATURES = {
  starter: {
    // Orders
    orders_create:            true,
    orders_assign_technician: false,
    orders_internal_notes:    false,
    orders_photos:            false,
    orders_change_history:    false,

    // Customers
    customers_basic:       true,
    customers_tags:        false,
    customers_segments:    false,

    // Workflow
    workflow_default:      true,
    workflow_custom:       false,

    // Inventory
    inventory_basic:       true,
    inventory_alerts:      false,
    inventory_costs:       false,
    inventory_suppliers:   false,
    inventory_purchase_orders: false,
    inventory_reorder:     false,

    // POS
    pos_basic:             true,
    pos_cash_open_close:   false,
    pos_discounts:         false,
    pos_credit_notes:      false,
    pos_multi_register:    false,

    // Reports
    reports_dashboard:     true,
    reports_by_technician: false,
    reports_by_service:    false,
    reports_export_csv:    false,
    reports_financial:     false,
    reports_export_pdf:    false,

    // Permissions
    permissions_roles:     false,
    permissions_custom:    false,

    // Automation
    automations_triggers:  false,
    automations_emails:    false,
    automations_scheduled: false,

    // Extras
    api_access:            false,
    priority_support:      false,
    multi_location:        false,
  },

  pro: {
    orders_create:            true,
    orders_assign_technician: true,
    orders_internal_notes:    true,
    orders_photos:            true,
    orders_change_history:    true,

    customers_basic:       true,
    customers_tags:        true,
    customers_segments:    true,

    workflow_default:      true,
    workflow_custom:       true,

    inventory_basic:       true,
    inventory_alerts:      true,
    inventory_costs:       true,
    inventory_suppliers:   true,
    inventory_purchase_orders: true,
    inventory_reorder:     false,

    pos_basic:             true,
    pos_cash_open_close:   true,
    pos_discounts:         true,
    pos_credit_notes:      true,
    pos_multi_register:    false,

    reports_dashboard:     true,
    reports_by_technician: true,
    reports_by_service:    true,
    reports_export_csv:    true,
    reports_financial:     false,
    reports_export_pdf:    false,

    permissions_roles:     true,  // 3 predefined roles
    permissions_custom:    false,

    automations_triggers:  false,
    automations_emails:    false,
    automations_scheduled: false,

    api_access:            false,
    priority_support:      false,
    multi_location:        false,
  },

  business: {
    orders_create:            true,
    orders_assign_technician: true,
    orders_internal_notes:    true,
    orders_photos:            true,
    orders_change_history:    true,

    customers_basic:       true,
    customers_tags:        true,
    customers_segments:    true,

    workflow_default:      true,
    workflow_custom:       true,

    inventory_basic:       true,
    inventory_alerts:      true,
    inventory_costs:       true,
    inventory_suppliers:   true,
    inventory_purchase_orders: true,
    inventory_reorder:     true,

    pos_basic:             true,
    pos_cash_open_close:   true,
    pos_discounts:         true,
    pos_credit_notes:      true,
    pos_multi_register:    true,

    reports_dashboard:     true,
    reports_by_technician: true,
    reports_by_service:    true,
    reports_export_csv:    true,
    reports_financial:     true,
    reports_export_pdf:    true,

    permissions_roles:     true,
    permissions_custom:    true,

    automations_triggers:  true,
    automations_emails:    true,
    automations_scheduled: true,

    api_access:            true,
    priority_support:      true,
    multi_location:        false, // future
  },
};

// ── Helpers ──────────────────────────────────────────────────────

/** Normalize legacy plan names to new plan IDs */
export function normalizePlanId(raw) {
  const map = {
    smartfixos: 'starter',
    basic: 'starter',
    starter: 'starter',
    pro: 'pro',
    enterprise: 'business',
    business: 'business',
  };
  return map[String(raw || '').trim().toLowerCase()] || 'starter';
}

/** Get plan config (metadata + limits + features) */
export function getPlan(planId) {
  const id = normalizePlanId(planId);
  return {
    ...PLANS[id],
    limits: PLAN_LIMITS[id],
    features: PLAN_FEATURES[id],
  };
}

/** Check if a specific feature is enabled for a plan */
export function canUsePlanFeature(planId, featureKey) {
  const id = normalizePlanId(planId);
  const features = PLAN_FEATURES[id];
  if (!features) return false;
  return features[featureKey] === true;
}

/** Check if a limit is exceeded. Returns { allowed: bool, current, max, upgradeNeeded } */
export function checkPlanLimit(planId, limitKey, currentCount) {
  const id = normalizePlanId(planId);
  const limits = PLAN_LIMITS[id];
  if (!limits) return { allowed: false, current: currentCount, max: 0, upgradeNeeded: true };

  const max = limits[limitKey];
  if (max === -1) return { allowed: true, current: currentCount, max: Infinity, upgradeNeeded: false };

  return {
    allowed: currentCount < max,
    current: currentCount,
    max,
    upgradeNeeded: currentCount >= max,
  };
}

/** Get the next plan up for upgrade messaging */
export function getUpgradePlan(currentPlanId) {
  const id = normalizePlanId(currentPlanId);
  const upgradeMap = { starter: 'pro', pro: 'business', business: null };
  const nextId = upgradeMap[id];
  return nextId ? PLANS[nextId] : null;
}

/** List all feature keys */
export function getAllFeatureKeys() {
  return Object.keys(PLAN_FEATURES.starter);
}
