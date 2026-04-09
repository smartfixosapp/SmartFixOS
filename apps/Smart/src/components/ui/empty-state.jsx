import React from "react";
import { cn } from "@/lib/utils";

/**
 * Standardized empty state for tables, lists, search results, etc.
 * Use this whenever a list/grid has no items so the UX is consistent
 * across the whole app.
 *
 * Usage:
 *   <EmptyState
 *     icon={Inbox}
 *     title="No hay órdenes"
 *     description="Crea tu primera orden de trabajo para empezar."
 *     action={<Button onClick={...}>Crear orden</Button>}
 *   />
 *
 * Variants:
 *   size="sm"  → compact (in cards/sidebars)
 *   size="md"  → default (in main content areas)
 *   size="lg"  → spacious (full page empty)
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = "md",
  className,
  ...props
}) {
  const sizes = {
    sm: {
      wrapper: "py-8 px-4",
      iconBox: "w-12 h-12 rounded-2xl mb-3",
      iconClass: "w-5 h-5",
      title: "text-sm font-bold",
      description: "text-xs mt-1",
    },
    md: {
      wrapper: "py-12 px-6",
      iconBox: "w-16 h-16 rounded-3xl mb-4",
      iconClass: "w-7 h-7",
      title: "text-base font-bold",
      description: "text-sm mt-1.5 max-w-sm",
    },
    lg: {
      wrapper: "py-20 px-8",
      iconBox: "w-20 h-20 rounded-3xl mb-5",
      iconClass: "w-9 h-9",
      title: "text-lg font-bold",
      description: "text-sm mt-2 max-w-md",
    },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        s.wrapper,
        className
      )}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            "liquid-glass-subtle flex items-center justify-center text-white/40",
            s.iconBox
          )}
        >
          <Icon className={s.iconClass} strokeWidth={2} />
        </div>
      )}
      {title && (
        <p className={cn("text-white/80", s.title)}>{title}</p>
      )}
      {description && (
        <p className={cn("text-white/40", s.description)}>{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
