import { useState, useEffect, useCallback, useMemo } from "react";
import { useTenant } from "@/components/utils/tenantContext";
import { normalizePlanId, getPlan, canUsePlanFeature, checkPlanLimit, getUpgradePlan } from "@/lib/plans";

/**
 * usePlanLimits — React hook for plan-based feature gating and limit checking.
 *
 * Usage:
 *   const { can, limitOf, checkLimit, plan, upgradeTo } = usePlanLimits();
 *
 *   if (!can('orders_assign_technician')) showUpgradePrompt();
 *   const { allowed, max } = checkLimit('max_users', currentUserCount);
 */
export function usePlanLimits() {
  const { currentTenant } = useTenant();

  const planId = useMemo(() => {
    return normalizePlanId(currentTenant?.plan);
  }, [currentTenant?.plan]);

  const planConfig = useMemo(() => getPlan(planId), [planId]);

  /** Check if a feature flag is enabled for the current plan */
  const can = useCallback((featureKey) => {
    return canUsePlanFeature(planId, featureKey);
  }, [planId]);

  /** Get a specific limit value (-1 = unlimited) */
  const limitOf = useCallback((limitKey) => {
    return planConfig.limits?.[limitKey] ?? 0;
  }, [planConfig]);

  /** Check if a limit is exceeded given current count */
  const checkLimitFn = useCallback((limitKey, currentCount) => {
    return checkPlanLimit(planId, limitKey, currentCount);
  }, [planId]);

  /** Get upgrade plan info (null if already on highest plan) */
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
    isBusiness: planId === 'business',
  };
}
