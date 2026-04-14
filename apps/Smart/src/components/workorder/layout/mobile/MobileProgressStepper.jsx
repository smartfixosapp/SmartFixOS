import React, { useMemo, memo } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusConfig, normalizeStatusId } from "@/components/utils/statusRegistry";
import CountdownBadge from "@/components/orders/CountdownBadge";

function timeSince(date) {
  const now = new Date();
  const diff = Math.max(0, now - date);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function MobileProgressStepper({ activeStatuses, status, order }) {
  const currentIdx = activeStatuses.findIndex(s => normalizeStatusId(status) === s.id);
  const currentConfig = getStatusConfig(status);

  const timeInStatus = useMemo(() => {
    const history = order?.status_history;
    if (Array.isArray(history) && history.length > 0) {
      const last = [...history].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0];
      return last?.timestamp ? timeSince(new Date(last.timestamp)) : null;
    }
    return order?.created_date ? timeSince(new Date(order.created_date)) : null;
  }, [order?.status_history, order?.created_date]);

  return (
    <div className="px-4 py-3 space-y-2">
      {/* Dots + connecting lines */}
      <div className="flex items-center gap-0">
        {activeStatuses.map((s, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;
          const config = getStatusConfig(s.id);
          return (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center" style={{ flex: "0 0 auto" }}>
                <div
                  className={cn(
                    "w-3 h-3 rounded-full border-2 transition-all",
                    isCurrent
                      ? "border-cyan-400 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)]"
                      : isCompleted
                      ? "border-cyan-500/60 bg-cyan-500/60"
                      : "border-white/15 bg-white/5"
                  )}
                  title={s.label}
                />
              </div>
              {i < activeStatuses.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full transition-all",
                    i < currentIdx ? "bg-cyan-500/50" : "bg-white/[0.06]"
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Current status label + timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentConfig.color || "#6B7280" }} />
          <span className="text-xs font-bold text-white/70">{currentConfig.label}</span>
          <span className="text-[10px] text-white/30">{currentIdx + 1}/{activeStatuses.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {timeInStatus && (
            <span className="flex items-center gap-1 text-[10px] text-white/40">
              <Clock className="w-3 h-3" />
              {timeInStatus}
            </span>
          )}
          <CountdownBadge order={order} />
        </div>
      </div>
    </div>
  );
}
