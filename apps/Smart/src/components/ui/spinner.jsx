import React from "react";
import { cn } from "@/lib/utils";

/**
 * Standardized loading spinner. Use this instead of ad-hoc <Loader2 className="animate-spin" />
 * so the loading affordance is consistent across the whole app.
 *
 * Why a custom CSS spinner instead of <Loader2>?
 *   - Smaller (no SVG icon download per loader)
 *   - Crisp at any size (CSS border, not SVG path)
 *   - Theme-aware via currentColor
 *
 * Sizes: xs (16px) · sm (20px) · md (24px) · lg (32px) · xl (48px)
 *
 * Usage:
 *   <Spinner />              → md, inherits text color
 *   <Spinner size="lg" />    → larger
 *   <Spinner className="text-cyan-400" /> → tinted
 *
 *   Center on a page:
 *     <div className="flex items-center justify-center min-h-[60vh]">
 *       <Spinner size="lg" />
 *     </div>
 *
 *   Inside a button:
 *     <Button disabled={loading}>
 *       {loading ? <Spinner size="sm" className="mr-2" /> : null}
 *       Guardar
 *     </Button>
 */
export function Spinner({ size = "md", className, ...props }) {
  const sizes = {
    xs: "w-4 h-4 border-2",
    sm: "w-5 h-5 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-[3px]",
    xl: "w-12 h-12 border-[3px]",
  };

  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn(
        "inline-block rounded-full animate-spin",
        // Track is a faint white, head is solid white. On light surfaces
        // override via className (e.g. "border-slate-200 border-t-slate-700")
        "border-white/15 border-t-white/80",
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      <span className="sr-only">Cargando…</span>
    </span>
  );
}

/**
 * Full-page loader with optional message.
 * Use as Suspense fallback or for top-level page loads.
 *
 *   <PageSpinner />
 *   <PageSpinner message="Cargando órdenes..." />
 */
export function PageSpinner({ message, className, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-screen bg-[#0a0a0c] text-white/60",
        className
      )}
      {...props}
    >
      <Spinner size="lg" className="text-white/70" />
      {message && (
        <p className="mt-4 text-sm font-medium">{message}</p>
      )}
    </div>
  );
}
