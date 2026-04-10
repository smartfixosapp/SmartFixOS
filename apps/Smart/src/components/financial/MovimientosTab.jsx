import React from "react";
import { TrendingUp, TrendingDown, RefreshCw, Edit2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default React.memo(function MovimientosTab({
  combinedMovements, movFilter, setMovFilter, loading,
  paymentMethodBreakdown, onEditExpense, onDeleteExpense,
  onViewPO,
}) {
  const filtered = combinedMovements.filter(m => movFilter === "all" || m.kind === movFilter);

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-1.5 justify-end">
        {[
          { id: "all", label: "Todos" },
          { id: "income", label: "Entradas" },
          { id: "expense", label: "Salidas" },
        ].map(f => (
          <button key={f.id} onClick={() => setMovFilter(f.id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border ${
              movFilter === f.id
                ? f.id === "income" ? "bg-emerald-600 border-emerald-600 text-white"
                  : f.id === "expense" ? "bg-red-600 border-red-600 text-white"
                  : "bg-cyan-600 border-cyan-600 text-white"
                : "bg-white/[0.04] border-white/[0.08] text-white/30 hover:text-white/60"
            }`}
          >{f.label}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-white/50" />
          <p className="text-xs text-white/50 font-bold">Cargando...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-white/25 font-bold text-sm">Sin movimientos en este periodo</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((m) => (
            <div key={m.id} className="group flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-all">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                m.kind === "income" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
              }`}>
                {m.kind === "income" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm truncate leading-tight">{m.title}</p>
                <p className="text-[11px] text-white/30 truncate">
                  {m.subtitle}
                  {m.date ? ` \u00B7 ${format(new Date(m.date), "dd MMM HH:mm", { locale: es })}` : ""}
                  {m.linkedPO && (
                    <>
                      {" \u00B7 "}
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewPO(m.linkedPO); }}
                        className="text-cyan-400 hover:text-cyan-300 font-black underline decoration-dotted"
                      >
                        {m.linkedPO.po_number}
                      </button>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <p className={`text-sm font-black ${m.kind === "income" ? "text-emerald-400" : "text-red-400"}`}>
                  {m.kind === "income" ? "+" : "-"}${m.amount.toFixed(2)}
                </p>
                {m.canEdit && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEditExpense(m.raw)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white/30 hover:text-cyan-400 flex items-center justify-center transition-colors">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteExpense(m.origId)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 flex items-center justify-center transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment method breakdown */}
      {paymentMethodBreakdown.length > 0 && (
        <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mt-2">
          <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-3">Como te pagaron</p>
          <div className="w-full h-2.5 rounded-full overflow-hidden flex mb-4">
            {paymentMethodBreakdown.map((m) => (
              <div key={m.key} className={`h-full ${m.colorBar}`} style={{ width: `${m.pct}%` }} />
            ))}
          </div>
          <div className="space-y-2.5">
            {paymentMethodBreakdown.map((m) => (
              <div key={m.key} className="flex items-center gap-2.5">
                <span className="text-base w-6 text-center">{m.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-bold text-white">{m.label}</span>
                    <span className={`text-xs font-black ${m.colorText}`}>${m.total.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-white/5 rounded-full h-1">
                    <div className={`h-full rounded-full ${m.colorBar}`} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
                <span className="text-[10px] text-white/30 font-bold w-8 text-right">{m.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
