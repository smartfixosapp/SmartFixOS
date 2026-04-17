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
    <div className="apple-type space-y-3">
      {/* Filter pills */}
      <div className="flex gap-1.5 justify-end">
        {[
          { id: "all", label: "Todos" },
          { id: "income", label: "Entradas" },
          { id: "expense", label: "Salidas" },
        ].map(f => (
          <button key={f.id} onClick={() => setMovFilter(f.id)}
            className={`apple-press px-3 py-1.5 rounded-apple-sm apple-text-caption1 font-semibold transition-all ${
              movFilter === f.id
                ? f.id === "income" ? "bg-apple-green text-white"
                  : f.id === "expense" ? "bg-apple-red text-white"
                  : "bg-apple-blue text-white"
                : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
            }`}
          >{f.label}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="py-12 text-center">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 apple-label-secondary" />
          <p className="apple-text-footnote apple-label-secondary">Cargando...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="apple-label-tertiary apple-text-subheadline">Sin movimientos en este periodo</p>
        </div>
      ) : (
        <div className="apple-list">
          {filtered.map((m) => (
            <div key={m.id} className="apple-list-row apple-press group flex items-center gap-3 p-3.5 transition-all">
              <div className={`w-8 h-8 rounded-apple-sm flex items-center justify-center shrink-0 ${
                m.kind === "income" ? "bg-apple-green/15 text-apple-green" : "bg-apple-red/15 text-apple-red"
              }`}>
                {m.kind === "income" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="apple-label-primary apple-text-footnote font-semibold truncate leading-tight">{m.title}</p>
                <p className="apple-text-caption1 apple-label-tertiary tabular-nums truncate">
                  {m.subtitle}
                  {m.date ? ` \u00B7 ${format(new Date(m.date), "dd MMM HH:mm", { locale: es })}` : ""}
                  {m.linkedPO && (
                    <>
                      {" \u00B7 "}
                      <button
                        onClick={(e) => { e.stopPropagation(); onViewPO(m.linkedPO); }}
                        className="text-apple-blue font-semibold underline decoration-dotted"
                      >
                        {m.linkedPO.po_number}
                      </button>
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <p className={`apple-text-subheadline font-semibold tabular-nums ${m.kind === "income" ? "text-apple-green" : "text-apple-red"}`}>
                  {m.kind === "income" ? "+" : "-"}${m.amount.toFixed(2)}
                </p>
                {m.canEdit && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEditExpense(m.raw)} className="apple-press w-6 h-6 rounded-apple-xs bg-apple-blue/12 text-apple-blue flex items-center justify-center transition-colors">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={() => onDeleteExpense(m.origId)} className="apple-press w-6 h-6 rounded-apple-xs bg-apple-red/12 text-apple-red flex items-center justify-center transition-colors">
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
        <div className="apple-card rounded-apple-md p-4 mt-2">
          <p className="apple-text-footnote font-semibold apple-label-secondary mb-3">Como te pagaron</p>
          <div className="w-full h-2.5 rounded-full overflow-hidden flex mb-4 bg-gray-sys6 dark:bg-gray-sys5">
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
                    <span className="apple-text-caption1 font-semibold apple-label-primary">{m.label}</span>
                    <span className={`apple-text-caption1 font-semibold tabular-nums ${m.colorText}`}>${m.total.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-gray-sys6 dark:bg-gray-sys5 rounded-full h-1">
                    <div className={`h-full rounded-full ${m.colorBar}`} style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
                <span className="apple-text-caption2 apple-label-tertiary tabular-nums font-semibold w-8 text-right">{m.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
