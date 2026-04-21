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
    // Try plan field first, then metadata fallbacks, then price-based detection
    const raw = currentTenant?.plan
      || currentTenant?.metadata?.plan
      || currentTenant?.metadata?.plan_label
      || currentTenant?.subscription_plan;

    let id = normalizePlanId(raw);

    // Safety net: if plan resolved to starter but monthly_cost matches Pro,
    // the tenant likely has Pro but the plan field is stale/missing.
    // This prevents false "limit reached" toasts for paying Pro customers.
    if (id === 'starter' && currentTenant?.monthly_cost >= 39) {
      console.info(`[PlanLimits] Plan field="${raw}" resolved to starter but monthly_cost=$${currentTenant.monthly_cost} → overriding to pro`);
      id = 'pro';
    }

    if (currentTenant?.id && !raw && !currentTenant?.monthly_cost) {
      console.warn(`[PlanLimits] Tenant ${currentTenant.id} has NO plan field — defaulting to starter.`);
    }

    return id;
  }, [currentTenant?.plan, currentTenant?.metadata, currentTenant?.subscription_plan, currentTenant?.monthly_cost, currentTenant?.id]);
  const planConfig = useMemo(() => getPlan(planId), [planId]);

  /** Quantity limit check — returns allowed:true if tenant hasn't loaded yet
   *  to prevent false "limit reached" errors during async tenant fetch */
  const checkLimitFn = useCallback((limitKey, currentCount) => {
    if (!currentTenant?.id) {
      // Tenant not loaded yet — don't block the user
      return { allowed: true, current: currentCount, max: Infinity, upgradeNeeded: false };
    }
    return checkPlanLimit(planId, limitKey, currentCount);
  }, [planId, currentTenant?.id]);

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
