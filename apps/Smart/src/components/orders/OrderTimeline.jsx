import React from "react";
import { getStatusConfig } from "@/components/utils/statusRegistry";

export default function OrderTimeline({ order }) {
  const history = Array.isArray(order?.status_history) ? order.status_history : [];
  const entries = history
    .filter((e) => e && e.status)
    .slice()
    .sort((a, b) => new Date(a.timestamp || a.created_date || 0) - new Date(b.timestamp || b.created_date || 0));

  if (entries.length === 0) {
    const cfg = getStatusConfig(order?.status);
    return (
      <div className="text-sm text-white/60">
        Estado actual:{" "}
        <span className="font-semibold" style={{ color: cfg.color }}>{cfg.label}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, i) => {
        const cfg = getStatusConfig(entry.status);
        const date = entry.timestamp || entry.created_date;
        return (
          <div key={i} className="flex items-start gap-3">
            <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
              {date && (
                <p className="text-xs text-white/40">
                  {new Date(date).toLocaleString("es-PR", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              )}
              {entry.note && <p className="text-xs text-white/50 mt-0.5">{entry.note}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
