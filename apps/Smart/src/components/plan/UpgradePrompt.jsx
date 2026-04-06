import React from "react";

// TEMPORARY: Plan restrictions disabled. All gates let children through.
// Revert when plan system is finalized.

/** UpgradePrompt — pass-through while restrictions are disabled */
export function UpgradePrompt({ children }) {
  return children || null;
}

/** PlanGate — pass-through while restrictions are disabled */
export function PlanGate({ children }) {
  return children || null;
}

/** LimitGate — pass-through while restrictions are disabled */
export function LimitGate({ children }) {
  return children || null;
}
