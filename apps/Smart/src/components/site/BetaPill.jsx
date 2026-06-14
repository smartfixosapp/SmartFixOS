import React from "react";
import { Inbox } from "lucide-react";
import { cx, useCountUp } from "./primitives";
import { useBetaSlots } from "./useBetaSlots";

function Dot({ color = "var(--ar-ok)" }) {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="ar-ping-soft absolute inline-flex h-full w-full rounded-full" style={{ background: color }} />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function BetaPill({ className = "" }) {
  const { slots, loading } = useBetaSlots();
  const remaining = slots?.remaining ?? 0;
  const count = useCountUp(remaining, !!slots, 1100);
  const status = slots?.status;

  const base = "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 font-mono text-[12px]";

  if (loading && !slots) {
    return (
      <span className={cx(base, className)} style={{ borderColor: "var(--ar-border)", color: "var(--ar-text-3)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ar-text-3)" }} />
        Consultando cupos…
      </span>
    );
  }

  if (status === "full") {
    return (
      <span className={cx(base, className)} style={{ borderColor: "var(--ar-border)", color: "var(--ar-text-2)" }}>
        <Inbox className="h-3.5 w-3.5" />
        Beta llena · únete al waitlist
      </span>
    );
  }

  const low = status === "low";
  return (
    <span
      className={cx(base, className)}
      style={{
        borderColor: low ? "rgba(255,82,71,0.4)" : "var(--ar-border-accent)",
        color: "var(--ar-text)",
        background: "rgba(255,87,34,0.06)",
      }}
    >
      <Dot color={low ? "var(--ar-danger)" : "var(--ar-ok)"} />
      <span className="uppercase tracking-[0.14em]">
        {low ? "Últimos " : "Quedan "}
        <span className="font-semibold tabular-nums" style={{ color: "var(--ar-text)" }}>{Math.round(count)}</span>
        {" cupos beta"}
      </span>
    </span>
  );
}
