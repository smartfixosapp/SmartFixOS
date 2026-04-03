import React from "react";
import { Lock } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";

/**
 * UpgradePrompt — Shows an inline upgrade message when a feature is blocked by the current plan.
 *
 * Props:
 *   feature  — feature key from PLAN_FEATURES
 *   message  — optional custom message
 *   inline   — if true, renders as a small inline badge instead of a card
 *   current  — optional current count (for limit display)
 *   max      — optional max count (for limit display)
 *   children — rendered if the feature IS available (acts as a gate)
 */
export function UpgradePrompt({ feature, message, inline = false, current, max, children }) {
  const { can, upgradeTo, plan } = usePlanLimits();

  const hasAccess = feature ? can(feature) : false;

  if (hasAccess) return children || null;

  const upgradeLabel = upgradeTo?.label || 'un plan superior';
  const defaultMessage = `Disponible en el plan ${upgradeLabel}`;
  const limitInfo = (current !== undefined && max !== undefined) ? `${current}/${max} usados` : null;

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
        <Lock className="h-3 w-3" />
        <span>{limitInfo || upgradeLabel}</span>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
      <div className="flex-shrink-0 p-2.5 rounded-xl bg-amber-500/10">
        <Lock className="h-4 w-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white/90">
          {message || defaultMessage}
        </p>
        <p className="text-xs text-white/40 mt-0.5">
          {limitInfo && <span className="text-amber-400/70 mr-2">{limitInfo}</span>}
          Plan actual: {plan.label} (${plan.price}/mes)
        </p>
      </div>
    </div>
  );
}

/**
 * PlanGate — Conditionally renders children based on plan feature access.
 * If blocked, shows UpgradePrompt or a custom fallback.
 */
export function PlanGate({ feature, children, fallback }) {
  const { can } = usePlanLimits();

  if (can(feature)) return children;

  return fallback || <UpgradePrompt feature={feature} />;
}

/**
 * LimitGate — Conditionally renders children based on a numeric plan limit.
 * Shows current/max usage when limit is reached.
 *
 * Usage:
 *   <LimitGate limitKey="max_users" currentCount={users.length}>
 *     <CreateUserButton />
 *   </LimitGate>
 */
export function LimitGate({ limitKey, currentCount, message, children, fallback }) {
  const { checkLimit } = usePlanLimits();
  const result = checkLimit(limitKey, currentCount);

  if (result.allowed) return children;

  return fallback || (
    <UpgradePrompt
      message={message}
      current={result.current}
      max={result.max}
    />
  );
}
