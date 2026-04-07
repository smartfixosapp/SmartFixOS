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
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
        <Lock className="h-3 w-3" />
        <span>{limitInfo || `Upgrade a ${upgradeLabel}`}</span>
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
          {message || `Upgrade al plan ${upgradeLabel} para continuar`}
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
