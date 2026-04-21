import React from "react";
import { cn } from "@/lib/utils";
import {
  ClipboardList, CheckCircle2, Check, Clock, AlertTriangle, Package,
  Sunrise, Sunset
} from "lucide-react";

/**
 * Shift tasks panel + quick stats KPI grid for the Dashboard.
 * Used in both desktop (right panel) and mobile (stacked) layouts.
 *
 * Extracted from Dashboard.jsx to reduce file size and improve
 * maintainability. All state lives in the parent.
 */
export default function DashboardShiftTasks({
  pendingShiftTasks,
  completingTaskId,
  quickStats,
  onCompleteTask,
  onNavigate,
}) {
  return (
    <div className="relative z-10 flex-1 flex flex-col min-h-0 p-6 lg:p-7">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-apple-xs bg-apple-blue/15 flex items-center justify-center">
            <ClipboardList className="w-3.5 h-3.5 text-apple-blue" />
          </div>
          <span className="apple-text-headline apple-label-primary">
            Tareas del turno
          </span>
        </div>
        {pendingShiftTasks.length > 0 && (
          <span className="min-w-6 h-6 px-2 rounded-full flex items-center justify-center apple-text-caption1 font-semibold text-white bg-apple-blue tabular-nums">
            {pendingShiftTasks.length}
          </span>
        )}
      </div>

      {/* Lista de tareas */}
      <div className="flex-1 apple-card overflow-hidden flex flex-col min-h-0 !p-0">
        <div className="flex-1 overflow-y-auto apple-scroll">
          {pendingShiftTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 h-full gap-3">
              <CheckCircle2 className="w-10 h-10 text-apple-green" />
              <p className="apple-text-callout apple-label-secondary">
                Todo al día
              </p>
            </div>
          ) : (
            pendingShiftTasks.map((task, idx) => (
              <div
                key={task.id}
                className="flex items-center gap-3 px-5 py-3.5"
                style={
                  idx > 0
                    ? {
                        borderTop:
                          "0.5px solid rgb(var(--separator) / 0.29)",
                      }
                    : undefined
                }
              >
                <div
                  className={`w-9 h-9 rounded-apple-sm flex items-center justify-center shrink-0 ${
                    task.type === "opening"
                      ? "bg-apple-orange/15 text-apple-orange"
                      : "bg-apple-indigo/15 text-apple-indigo"
                  }`}
                >
                  {task.type === "opening" ? (
                    <Sunrise className="w-4 h-4" />
                  ) : (
                    <Sunset className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="apple-text-body font-semibold apple-label-primary truncate">
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="apple-text-footnote apple-label-secondary truncate">
                      {task.description}
                    </p>
                  )}
                </div>
                {task.priority === "urgent" && (
                  <span className="apple-text-caption2 font-semibold px-1.5 py-0.5 rounded-full bg-apple-red/15 text-apple-red shrink-0">
                    Urgente
                  </span>
                )}
                <button
                  onClick={() => onCompleteTask(task)}
                  disabled={completingTaskId === task.id}
                  className={`apple-press w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                    completingTaskId === task.id
                      ? "bg-apple-green/25 text-apple-green animate-pulse"
                      : "bg-apple-green/15 text-apple-green"
                  }`}
                >
                  <Check className="w-[18px] h-[18px]" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Resumen rápido (KPIs) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 shrink-0">
        <button
          onClick={() => onNavigate("Orders")}
          className="apple-press apple-card p-3 flex items-center gap-2.5 transition-colors"
        >
          <CheckCircle2
            className={cn(
              "w-4 h-4 shrink-0",
              quickStats.listas > 0 ? "text-apple-green" : "apple-label-tertiary"
            )}
          />
          <div className="text-left min-w-0">
            <p
              className={cn(
                "apple-text-headline leading-tight tabular-nums",
                quickStats.listas > 0 ? "text-apple-green" : "apple-label-tertiary"
              )}
            >
              {quickStats.listas}
            </p>
            <p className="apple-text-caption2 apple-label-secondary">Listas</p>
          </div>
        </button>
        <button
          onClick={() => onNavigate("Orders")}
          className="apple-press apple-card p-3 flex items-center gap-2.5 transition-colors"
        >
          <Clock
            className={cn(
              "w-4 h-4 shrink-0",
              quickStats.retrasadas > 0
                ? "text-apple-orange"
                : "apple-label-tertiary"
            )}
          />
          <div className="text-left min-w-0">
            <p
              className={cn(
                "apple-text-headline leading-tight tabular-nums",
                quickStats.retrasadas > 0
                  ? "text-apple-orange"
                  : "apple-label-tertiary"
              )}
            >
              {quickStats.retrasadas}
            </p>
            <p className="apple-text-caption2 apple-label-secondary">
              Retrasadas
            </p>
          </div>
        </button>
        <button
          onClick={() => onNavigate("Inventory")}
          className="apple-press apple-card p-3 flex items-center gap-2.5 transition-colors"
        >
          <AlertTriangle
            className={cn(
              "w-4 h-4 shrink-0",
              quickStats.stockCrit > 0
                ? "text-apple-red"
                : "apple-label-tertiary"
            )}
          />
          <div className="text-left min-w-0">
            <p
              className={cn(
                "apple-text-headline leading-tight tabular-nums",
                quickStats.stockCrit > 0
                  ? "text-apple-red"
                  : "apple-label-tertiary"
              )}
            >
              {quickStats.stockCrit}
            </p>
            <p className="apple-text-caption2 apple-label-secondary">
              Stock crítico
            </p>
          </div>
        </button>
        <div className="apple-card p-3 flex items-center gap-2.5">
          <Package className="w-4 h-4 apple-label-tertiary shrink-0" />
          <div className="text-left min-w-0">
            <p className="apple-text-headline apple-label-secondary leading-tight tabular-nums">
              {quickStats.avgDays}d
            </p>
            <p className="apple-text-caption2 apple-label-secondary">
              Tiempo prom.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
