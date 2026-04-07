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

  const planId = useMemo(() => normalizePlanId(currentTenant?.plan), [currentTenant?.plan]);
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
