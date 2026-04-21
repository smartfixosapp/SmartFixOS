import { useCallback, useMemo } from "react";
import { useTenant } from "@/components/utils/tenantContext";
import { normalizePlanId, getPlan, checkPlanLimit, getUpgradePlan } from "@/lib/plans";

/**
 * usePlanLimits — React hook for plan-based limit checking.
 *
 * Simplified to enforce ONLY quantity limits (orders, customers, products).
 * Features are always available — `can()` always returns true.
 *
 * Usage:
 *   const { checkLimit, plan, upgradeTo } = usePlanLimits();
 *   const { allowed, current, max } = checkLimit('max_active_orders', orders.length);
 *   if (!allowed) toast.error(`Límite ${current}/${max} — upgrade a ${upgradeTo.label}`);
 */
export function usePlanLimits() {
  const { currentTenant } = useTenant();

  const planId = useMemo(() => {
    // Try plan field first, then metadata fallbacks
    const raw = currentTenant?.plan
      || currentTenant?.metadata?.plan
      || currentTenant?.metadata?.plan_label
      || currentTenant?.subscription_plan;
    const id = normalizePlanId(raw);
    // Debug: log plan resolution to catch mismatches
    if (currentTenant?.id && id === 'starter' && raw) {
      console.debug(`[PlanLimits] Tenant ${currentTenant.id} plan="${raw}" → resolved="${id}"`);
    }
    if (currentTenant?.id && !raw) {
      console.warn(`[PlanLimits] Tenant ${currentTenant.id} has NO plan field — defaulting to starter. Set tenant.plan in the admin panel.`);
    }
    return id;
  }, [currentTenant?.plan, currentTenant?.metadata, currentTenant?.subscription_plan, currentTenant?.id]);
  const planConfig = useMemo(() => getPlan(planId), [planId]);

  /** Quantity limit check */
  const checkLimitFn = useCallback((limitKey, currentCount) => {
    return checkPlanLimit(planId, limitKey, currentCount);
  }, [planId]);

  /** Read a limit value (-1 / Infinity = unlimited) */
  const limitOf = useCallback((limitKey) => {
    return planConfig.limits?.[limitKey] ?? -1;
  }, [planConfig]);

  /** Compatibility — all features unlocked */
  const can = useCallback(() => true, []);

  const upgradeTo = useMemo(() => getUpgradePlan(planId), [planId]);

  return {
    plan: planConfig,
    planId,
    can,
    limitOf,
    checkLimit: checkLimitFn,
    upgradeTo,
    isStarter: planId === 'starter',
    isPro: planId === 'pro',
  };
}
