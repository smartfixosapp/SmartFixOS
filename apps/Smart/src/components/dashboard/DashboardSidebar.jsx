import React from "react";
import { cn } from "@/lib/utils";
import {
  DollarSign, Wallet, LogOut, ClipboardList, Search, Users
} from "lucide-react";
import PunchButton from "./PunchButton";

/**
 * Desktop left sidebar for the Dashboard PULSO layout.
 * Contains: user avatar, action buttons, income KPI, quick links.
 *
 * Extracted from Dashboard.jsx to reduce file size and improve
 * maintainability. All state lives in the parent — this component
 * is purely presentational with callback props.
 */
export default function DashboardSidebar({
  session,
  businessName,
  kpiIncome,
  kpiDailyGoal,
  drawerOpen,
  showToast,
  onNavigate,
  onCashClick,
  onLogout,
  onNewOrder,
  onPriceList,
}) {
  const fmt = (n) =>
    `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const goalPct =
    kpiDailyGoal > 0
      ? Math.min(100, Math.round((kpiIncome.today / kpiDailyGoal) * 100))
      : 0;

  return (
    <div
      className="relative z-10 w-[260px] xl:w-[300px] shrink-0 flex flex-col gap-3 p-6 lg:p-7"
      style={{ borderRight: "0.5px solid rgb(var(--separator) / 0.29)" }}
    >
      {/* Usuario */}
      <div className="flex items-center gap-3 rounded-apple-md pl-2 pr-3 py-2 bg-gray-sys6 dark:bg-gray-sys5">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "rgb(var(--apple-blue))" }}
        >
          <span className="apple-text-footnote font-semibold text-white">
            {session?.userName?.substring(0, 2)?.toUpperCase() || "US"}
          </span>
        </div>
        <div className="min-w-0">
          <p className="apple-text-headline apple-label-primary leading-tight truncate">
            {session?.userName || "Usuario"}
          </p>
          <p className="apple-text-caption1 apple-label-secondary leading-tight mt-0.5 truncate">
            {businessName || session?.storeName || "SmartFixOS"}
          </p>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="flex items-center gap-2">
        <PunchButton
          userId={session?.userId}
          userName={session?.userName}
          variant="apple"
          onPunchStatusChange={(status) => {
            if (status) showToast("👋 ¡Hola!", "Turno iniciado");
            else showToast("👋 ¡Adiós!", "Turno finalizado");
          }}
        />
        <button
          onClick={onCashClick}
          className={cn(
            "apple-press flex-1 h-10 rounded-apple-sm flex items-center justify-center transition-colors",
            drawerOpen
              ? "bg-apple-green/15 text-apple-green"
              : "bg-apple-red/15 text-apple-red"
          )}
          title={drawerOpen ? "Cerrar caja" : "Abrir caja"}
        >
          <Wallet className="w-4 h-4" />
        </button>
        <button
          onClick={onLogout}
          className="apple-press flex-1 h-10 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary hover:text-apple-red flex items-center justify-center transition-colors"
          title="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>

      {/* Divider */}
      <div
        style={{
          height: "0.5px",
          backgroundColor: "rgb(var(--separator) / 0.29)",
        }}
      />

      {/* KPI Ingresos hoy */}
      <button
        onClick={() => onNavigate("Financial")}
        className="apple-press apple-card p-3.5 flex items-center gap-3 text-left"
      >
        <div className="w-10 h-10 rounded-apple-sm bg-apple-green/15 flex items-center justify-center shrink-0">
          <DollarSign className="w-[18px] h-[18px] text-apple-green" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="apple-text-title3 text-apple-green leading-tight tabular-nums">
            {kpiIncome.loading ? "…" : fmt(kpiIncome.today)}
          </p>
          <p className="apple-text-caption1 apple-label-secondary truncate">
            Ingresos hoy{kpiDailyGoal > 0 ? ` · ${goalPct}% meta` : ""}
          </p>
        </div>
      </button>

      {/* Accesos rápidos */}
      <button
        onClick={onNewOrder}
        className="apple-press min-h-[44px] bg-apple-blue/12 rounded-apple-sm flex items-center gap-3 px-3.5"
      >
        <ClipboardList className="w-[18px] h-[18px] text-apple-blue shrink-0" />
        <span className="apple-text-footnote font-medium text-apple-blue">
          Nueva orden
        </span>
      </button>
      <button
        onClick={onPriceList}
        className="apple-press min-h-[44px] bg-apple-purple/12 rounded-apple-sm flex items-center gap-3 px-3.5"
      >
        <Search className="w-[18px] h-[18px] text-apple-purple shrink-0" />
        <span className="apple-text-footnote font-medium text-apple-purple">
          Lista precios
        </span>
      </button>
      <button
        onClick={() => onNavigate("Customers")}
        className="apple-press min-h-[44px] bg-apple-indigo/12 rounded-apple-sm flex items-center gap-3 px-3.5"
      >
        <Users className="w-[18px] h-[18px] text-apple-indigo shrink-0" />
        <span className="apple-text-footnote font-medium text-apple-indigo">
          Clientes
        </span>
      </button>
    </div>
  );
}
