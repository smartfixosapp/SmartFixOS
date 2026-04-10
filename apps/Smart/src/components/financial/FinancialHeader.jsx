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
    <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-2xl border-b border-white/5 py-3">
      <div className="app-container flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black text-white tracking-tight leading-none">Finanzas</h1>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest leading-none mt-0.5 truncate">
              {loading ? "Cargando..." : `${totalMovements} movimientos`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-0.5 p-0.5 sm:p-1 bg-white/5 rounded-2xl border border-white/10">
            {[
              { id: "today", label: "Hoy" },
              { id: "week",  label: "7d" },
              { id: "month", label: "Mes" },
              { id: "all",   label: "Todo" },
              { id: "custom",label: "\ud83d\udcc5" },
            ].map((p) => (
              <button key={p.id} onClick={() => setDateFilter(p.id)}
                className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black transition-all ${
                  dateFilter === p.id
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow"
                    : "text-white/30 hover:text-white/60"
                }`}
              >{p.label}</button>
            ))}
          </div>
          <button onClick={onRefresh} disabled={loading}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0">
            <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => navigate(-1)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0">
            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </button>
        </div>
      </div>
      {dateFilter === "custom" && (
        <div className="app-container flex gap-2 mt-2 pt-2 border-t border-white/5">
          <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}
            className="flex-1 bg-black/40 border border-white/10 text-white text-xs h-9 rounded-xl px-3 focus:border-cyan-500/50 outline-none" />
          <span className="text-white/50 self-center text-xs">\u2192</span>
          <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}
            className="flex-1 bg-black/40 border border-white/10 text-white text-xs h-9 rounded-xl px-3 focus:border-cyan-500/50 outline-none" />
        </div>
      )}
    </div>
  );
});
