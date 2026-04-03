import React from "react";
import { Lock } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";

/**
 * UpgradePrompt — Shows an inline upgrade message when a feature is blocked by the current plan.
 *
 * Usage:
 *   <UpgradePrompt feature="orders_assign_technician" />
 *   <UpgradePrompt feature="reports_financial" message="Reportes financieros disponibles en Business" />
 *
 * Props:
 *   feature  — feature key from PLAN_FEATURES
 *   message  — optional custom message
 *   inline   — if true, renders as a small inline badge instead of a card
 *   children — rendered if the feature IS available (acts as a gate)
 */
export function UpgradePrompt({ feature, message, inline = false, children }) {
  const { can, upgradeTo, plan } = usePlanLimits();

  const hasAccess = can(feature);

  // If feature is available, render children (pass-through)
  if (hasAccess) return children || null;

  const upgradeLabel = upgradeTo?.label || 'un plan superior';
  const defaultMessage = `Disponible en el plan ${upgradeLabel}`;

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
        <Lock className="h-3 w-3" />
        {upgradeLabel}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-3 p-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30">
      <div className="flex-shrink-0 p-2 rounded-full bg-muted">
        <Lock className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {message || defaultMessage}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tu plan actual: {plan.label} (${plan.price}/mes)
        </p>
      </div>
    </div>
  );
}

/**
 * PlanGate — Conditionally renders children based on plan feature access.
 * If blocked, shows UpgradePrompt or a custom fallback.
 *
 * Usage:
 *   <PlanGate feature="pos_cash_open_close" fallback={<UpgradePrompt feature="pos_cash_open_close" />}>
 *     <CashRegisterControls />
 *   </PlanGate>
 */
export function PlanGate({ feature, children, fallback }) {
  const { can } = usePlanLimits();

  if (can(feature)) return children;

  return fallback || <UpgradePrompt feature={feature} />;
}
