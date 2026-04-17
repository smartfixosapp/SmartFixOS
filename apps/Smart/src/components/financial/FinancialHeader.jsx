import React from "react";
import { DollarSign, RefreshCw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default React.memo(function FinancialHeader({
  loading, totalMovements, dateFilter, setDateFilter,
  customStartDate, setCustomStartDate, customEndDate, setCustomEndDate,
  onRefresh,
}) {
  const navigate = useNavigate();

  return (
    <div className="apple-type sticky top-0 z-30 apple-surface backdrop-blur-2xl py-3" style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
      <div className="app-container flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center shrink-0">
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-apple-blue" />
          </div>
          <div className="min-w-0">
            <h1 className="apple-text-headline apple-label-primary leading-none">Finanzas</h1>
            <p className="apple-text-caption2 apple-label-tertiary tabular-nums leading-none mt-0.5 truncate">
              {loading ? "Cargando..." : `${totalMovements} movimientos`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-0.5 p-0.5 sm:p-1 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md">
            {[
              { id: "today", label: "Hoy" },
              { id: "week",  label: "7d" },
              { id: "month", label: "Mes" },
              { id: "all",   label: "Todo" },
              { id: "custom",label: "\ud83d\udcc5" },
            ].map((p) => (
              <button key={p.id} onClick={() => setDateFilter(p.id)}
                className={`apple-press px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-apple-sm apple-text-caption1 font-semibold transition-all ${
                  dateFilter === p.id
                    ? "bg-apple-blue text-white"
                    : "apple-label-tertiary"
                }`}
              >{p.label}</button>
            ))}
          </div>
          <button onClick={onRefresh} disabled={loading}
            className="apple-press w-7 h-7 sm:w-8 sm:h-8 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-secondary transition-colors shrink-0">
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => navigate(-1)}
            className="apple-press w-7 h-7 sm:w-8 sm:h-8 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-secondary transition-colors shrink-0">
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      </div>
      {dateFilter === "custom" && (
        <div className="app-container flex gap-2 mt-2 pt-2" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}
            className="apple-input flex-1 apple-text-footnote h-9 rounded-apple-sm px-3 tabular-nums" />
          <span className="apple-label-secondary self-center apple-text-footnote">\u2192</span>
          <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}
            className="apple-input flex-1 apple-text-footnote h-9 rounded-apple-sm px-3 tabular-nums" />
        </div>
      )}
    </div>
  );
});
