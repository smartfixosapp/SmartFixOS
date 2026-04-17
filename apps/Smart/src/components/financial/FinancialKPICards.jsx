import React from "react";
import { TrendingUp, TrendingDown, DollarSign, Clock, Wallet } from "lucide-react";

const KPICard = React.memo(function KPICard({ label, sublabel, value, icon: Icon, scheme, onClick, active }) {
  const colors = {
    green:  { bg: "bg-apple-green/12",  text: "text-apple-green",  iconBg: "bg-apple-green/15" },
    red:    { bg: "bg-apple-red/12",    text: "text-apple-red",    iconBg: "bg-apple-red/15" },
    blue:   { bg: "bg-apple-blue/12",   text: "text-apple-blue",   iconBg: "bg-apple-blue/15" },
    orange: { bg: "bg-apple-orange/12", text: "text-apple-orange", iconBg: "bg-apple-orange/15" },
  };
  const c = colors[scheme] || colors.blue;

  return (
    <button
      onClick={onClick}
      className={`apple-press apple-card relative text-left p-4 rounded-apple-md transition-all overflow-hidden ${
        active ? `${c.bg}` : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="apple-text-caption2 font-semibold apple-label-tertiary leading-none">{label}</p>
          <p className={`apple-text-title2 tabular-nums mt-1.5 leading-none ${active ? c.text : "apple-label-primary"}`}>
            ${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {sublabel && (
            <p className="apple-text-caption2 apple-label-tertiary tabular-nums mt-1.5 leading-tight">{sublabel}</p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-apple-sm flex items-center justify-center shrink-0 ${active ? c.iconBg : "bg-gray-sys6 dark:bg-gray-sys5"}`}>
          <Icon className={`w-5 h-5 ${active ? c.text : "apple-label-secondary"}`} />
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
    <div className="apple-type grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
      <KPICard
        label="Ingresos"
        sublabel={dateFilter !== "today" ? `Hoy: $${todayRevenue.toFixed(2)}` : `${filteredSalesCount} venta${filteredSalesCount !== 1 ? "s" : ""}`}
        value={totalRevenue}
        icon={TrendingUp}
        scheme="green"
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
        scheme={netProfit >= 0 ? "blue" : "red"}
        active={activeTab === "desglose"}
        onClick={() => onCardClick("desglose")}
      />
      <KPICard
        label="Pagos Pendientes"
        sublabel={unsettledTotal > 0 ? "Por salir del banco" : "Todo liquidado"}
        value={unsettledTotal}
        icon={Clock}
        scheme={unsettledTotal > 0 ? "orange" : "blue"}
        active={activeTab === "diferidos"}
        onClick={() => onCardClick("diferidos")}
      />
    </div>
  );
});
