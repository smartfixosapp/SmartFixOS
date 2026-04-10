import React from "react";
import { TrendingUp, TrendingDown, DollarSign, Clock, Wallet } from "lucide-react";

const KPICard = React.memo(function KPICard({ label, sublabel, value, icon: Icon, scheme, onClick, active }) {
  const colors = {
    emerald: { bg: "bg-emerald-500/[0.08]", border: "border-emerald-500/20", text: "text-emerald-400", iconBg: "bg-emerald-500/15" },
    red:     { bg: "bg-red-500/[0.08]",     border: "border-red-500/20",     text: "text-red-400",     iconBg: "bg-red-500/15" },
    cyan:    { bg: "bg-cyan-500/[0.08]",     border: "border-cyan-500/20",    text: "text-cyan-400",    iconBg: "bg-cyan-500/15" },
    amber:   { bg: "bg-amber-500/[0.08]",    border: "border-amber-500/20",   text: "text-amber-400",   iconBg: "bg-amber-500/15" },
  };
  const c = colors[scheme] || colors.cyan;

  return (
    <button
      onClick={onClick}
      className={`relative text-left p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden ${
        active ? `${c.bg} ${c.border} ring-1 ring-${scheme === "emerald" ? "emerald" : scheme === "red" ? "red" : scheme === "amber" ? "amber" : "cyan"}-500/30` : `bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]`
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">{label}</p>
          <p className={`text-2xl font-black tabular-nums mt-1.5 leading-none ${active ? c.text : "text-white"}`}>
            ${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {sublabel && (
            <p className="text-[10px] text-white/30 font-bold mt-1.5 leading-tight">{sublabel}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${active ? c.iconBg : "bg-white/[0.06]"}`}>
          <Icon className={`w-5 h-5 ${active ? c.text : "text-white/30"}`} />
        </div>
      </div>
    </button>
  );
});

export default React.memo(function FinancialKPICards({
  totalRevenue, totalExpenses, netProfit, unsettledTotal,
  todayRevenue, todayExpenses, filteredSalesCount,
  activeTab, onCardClick, dateFilter,
}) {
  const periodLabel = dateFilter === "today" ? "hoy" : dateFilter === "week" ? "7 días" : dateFilter === "month" ? "este mes" : "total";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      <KPICard
        label="Ingresos"
        sublabel={dateFilter !== "today" ? `Hoy: $${todayRevenue.toFixed(2)}` : `${filteredSalesCount} venta${filteredSalesCount !== 1 ? "s" : ""}`}
        value={totalRevenue}
        icon={TrendingUp}
        scheme="emerald"
        active={activeTab === "movimientos"}
        onClick={() => onCardClick("movimientos", "income")}
      />
      <KPICard
        label="Gastos"
        sublabel={dateFilter !== "today" ? `Hoy: $${todayExpenses.toFixed(2)}` : `${periodLabel}`}
        value={totalExpenses}
        icon={TrendingDown}
        scheme="red"
        active={activeTab === "movimientos"}
        onClick={() => onCardClick("movimientos", "expense")}
      />
      <KPICard
        label={netProfit >= 0 ? "Ganancia Neta" : "Déficit"}
        sublabel="Cobrado - piezas - IVU - gastos"
        value={netProfit}
        icon={DollarSign}
        scheme={netProfit >= 0 ? "cyan" : "red"}
        active={activeTab === "desglose"}
        onClick={() => onCardClick("desglose")}
      />
      <KPICard
        label="Pagos Pendientes"
        sublabel={unsettledTotal > 0 ? "Por salir del banco" : "Todo liquidado"}
        value={unsettledTotal}
        icon={Clock}
        scheme={unsettledTotal > 0 ? "amber" : "cyan"}
        active={activeTab === "diferidos"}
        onClick={() => onCardClick("diferidos")}
      />
    </div>
  );
});
