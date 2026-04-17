import React from "react";
import { Lock } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";

/**
 * UpgradePrompt — Inline upgrade message for quantity limits.
 *
 * Props:
 *   message  — message to show
 *   inline   — small badge instead of card
 *   current  — current count (optional)
 *   max      — max allowed (optional)
 */
export function UpgradePrompt({ message, inline = false, current, max, children }) {
  const { plan, upgradeTo } = usePlanLimits();
  const upgradeLabel = upgradeTo?.label || 'Pro';
  const limitInfo = (current !== undefined && max !== undefined && max !== Infinity)
    ? `${current}/${max} usados`
    : null;

  if (inline) {
    return (
      <span className="apple-type inline-flex items-center gap-1.5 apple-text-caption1 text-apple-orange bg-apple-orange/12 px-2.5 py-1 rounded-apple-sm">
        <Lock className="h-3 w-3" />
        <span className="tabular-nums">{limitInfo || `Upgrade a ${upgradeLabel}`}</span>
      </span>
    );
  }

  return (
    <div className="apple-type flex items-center gap-3 p-4 rounded-apple-lg apple-surface-elevated">
      <div className="flex-shrink-0 p-2.5 rounded-apple-sm bg-apple-orange/15">
        <Lock className="h-4 w-4 text-apple-orange" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="apple-text-subheadline apple-label-primary">
          {message || `Upgrade al plan ${upgradeLabel} para continuar`}
        </p>
        <p className="apple-text-caption1 apple-label-tertiary mt-0.5">
          {limitInfo && <span className="text-apple-orange mr-2 tabular-nums">{limitInfo}</span>}
          Plan actual: {plan.label} (<span className="tabular-nums">${plan.price}</span>/mes)
        </p>
      </div>
    </div>
  );
}

/**
 * PlanGate — pass-through. Features are no longer gated.
 * Kept for backwards compatibility with existing call sites.
 */
export function PlanGate({ children }) {
  return children || null;
}

/**
 * LimitGate — render children only if quantity limit not exceeded.
 * Use for the 3 active limits: max_active_orders, max_customers, max_skus.
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
