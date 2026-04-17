/**
 * MonthlyReportModal — Resumen financiero mensual
 * Se muestra automáticamente el último día del mes (detectable al cargar el Dashboard).
 * Genera un PDF imprimible con todo: ingresos, gastos, nómina, neto.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { dataClient } from "@/components/api/dataClient";
import {
  X, Printer, TrendingUp, TrendingDown, DollarSign, FileText,
  RefreshCw, CheckCircle2, BarChart3, Calendar, ChevronDown
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";

// ── Storage key ───────────────────────────────────────────────────────────────
const LS_KEY = "smartfix_monthly_report_shown";

export function shouldShowMonthlyReport() {
  try {
    const today = new Date();
    const lastDay = endOfMonth(today).getDate();
    if (today.getDate() !== lastDay) return false;

    const key = format(today, "yyyy-MM");
    const shown = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    return !shown[key];
  } catch { return false; }
}

function markReportShown() {
  try {
    const key = format(new Date(), "yyyy-MM");
    const shown = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    shown[key] = true;
    localStorage.setItem(LS_KEY, JSON.stringify(shown));
  } catch {}
}

// ── Category labels ───────────────────────────────────────────────────────────
const CAT_LABELS = {
  payroll: "Nómina",
  parts: "Piezas/Repuestos",
  supplies: "Suministros",
  repair_payment: "Pago reparación",
  refund: "Reembolso",
  other_expense: "Otros gastos",
  income: "Ingresos",
  revenue: "Ingresos",
  service: "Servicios",
};

const fmtUSD = (v) => `$${Number(v || 0).toFixed(2)}`;

const CATEGORY_COLORS = {
  payroll: "bg-apple-blue/15 text-apple-blue",
  parts: "bg-apple-red/15 text-apple-red",
  supplies: "bg-apple-orange/15 text-apple-orange",
  repair_payment: "bg-apple-blue/15 text-apple-blue",
  refund: "bg-apple-red/15 text-apple-red",
  other_expense: "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary",
  income: "bg-apple-green/15 text-apple-green",
  revenue: "bg-apple-green/15 text-apple-green",
  service: "bg-apple-purple/15 text-apple-purple",
};

// ── Print styles ──────────────────────────────────────────────────────────────
const PRINT_CSS = `
  @media print {
    body * { visibility: hidden !important; }
    #monthly-report-print, #monthly-report-print * { visibility: visible !important; }
    #monthly-report-print {
      position: fixed !important; top: 0 !important; left: 0 !important;
      width: 100% !important; background: white !important; color: black !important;
      padding: 24px !important; font-family: -apple-system, BlinkMacSystemFont, sans-serif !important;
    }
    .no-print { display: none !important; }
    .print-table { width: 100% !important; border-collapse: collapse !important; }
    .print-table td, .print-table th { border: 1px solid #ccc !important; padding: 6px 10px !important; font-size: 11px !important; }
    .print-table th { background: #f0f0f0 !important; font-weight: 600 !important; }
    .print-section { page-break-inside: avoid !important; margin-bottom: 16px !important; }
    h1, h2, h3 { color: black !important; }
    .print-positive { color: #34C759 !important; font-weight: 600 !important; }
    .print-negative { color: #FF3B30 !important; font-weight: 600 !important; }
  }
`;

// ── Main Component ────────────────────────────────────────────────────────────

export default function MonthlyReportModal({ open, onClose, targetMonth }) {
  const [loading, setLoading] = useState(false);
  const [txs, setTxs] = useState([]);
  const [sales, setSales] = useState([]);
  const [month, setMonth] = useState(() => targetMonth || new Date());
  const styleRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (!styleRef.current) {
      const s = document.createElement("style");
      s.textContent = PRINT_CSS;
      document.head.appendChild(s);
      styleRef.current = s;
    }
    loadData();
  }, [open, month]);

  useEffect(() => {
    return () => { if (styleRef.current) { styleRef.current.remove(); styleRef.current = null; } };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allTxs, allSales] = await Promise.all([
        dataClient.entities.Transaction.list("-created_date", 2000).catch(() => []),
        dataClient.entities.Sale.list("-created_date", 2000).catch(() => []),
      ]);

      const start = startOfMonth(month);
      const end = endOfMonth(month);

      const filterMonth = (arr, dateField = "created_date") =>
        (Array.isArray(arr) ? arr : []).filter((r) => {
          const d = new Date(r[dateField] || r.created_at || 0);
          return d >= start && d <= end;
        });

      setTxs(filterMonth(allTxs));
      setSales(filterMonth(allSales));
    } catch (err) {
      console.error("Monthly report load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    markReportShown();
    onClose?.();
  };

  const handlePrint = () => {
    window.print();
    markReportShown();
  };

  // ── Calculations ────────────────────────────────────────────────────────────
  const revenues = txs.filter((t) => t.type === "revenue" || t.type === "income");
  const expenses = txs.filter((t) => t.type === "expense");

  const totalRevenue = revenues.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalExpenses = expenses.reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalSalesRev = sales.reduce((s, s2) => s + Number(s2.total_amount || s2.total || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  // Group expenses by category
  const expenseByCategory = {};
  for (const tx of expenses) {
    const cat = tx.category || "other_expense";
    if (!expenseByCategory[cat]) expenseByCategory[cat] = 0;
    expenseByCategory[cat] += Number(tx.amount || 0);
  }

  // Group revenues by category
  const revenueByCategory = {};
  for (const tx of revenues) {
    const cat = tx.category || "income";
    if (!revenueByCategory[cat]) revenueByCategory[cat] = 0;
    revenueByCategory[cat] += Number(tx.amount || 0);
  }

  // All transactions sorted by date
  const allSorted = [...txs].sort((a, b) =>
    new Date(b.created_date || b.created_at || 0) - new Date(a.created_date || a.created_at || 0)
  );

  const monthLabel = format(month, "MMMM yyyy", { locale: es }).replace(/^\w/, (c) => c.toUpperCase());

  if (!open) return null;

  return (
    <div className="apple-type fixed inset-0 z-[99999] bg-black/50 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 no-print">
      <div className="w-full max-w-3xl apple-surface-elevated rounded-apple-lg shadow-apple-xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 apple-surface-elevated backdrop-blur-sm px-6 pt-6 pb-4 flex items-center justify-between" style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-apple-md bg-apple-green/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-apple-green" />
            </div>
            <div>
              <h2 className="apple-text-title3 apple-label-primary">Reporte Mensual</h2>
              <p className="apple-text-caption2 font-semibold apple-label-tertiary">{monthLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Month selector */}
            <select
              value={format(month, "yyyy-MM")}
              onChange={(e) => setMonth(new Date(e.target.value + "-01"))}
              className="apple-input apple-text-footnote rounded-apple-sm px-3 py-2 tabular-nums"
            >
              {Array.from({ length: 12 }, (_, i) => {
                const d = subMonths(new Date(), i);
                return (
                  <option key={i} value={format(d, "yyyy-MM")}>
                    {format(d, "MMMM yyyy", { locale: es })}
                  </option>
                );
              })}
            </select>
            <button
              onClick={handlePrint}
              className="apple-press flex items-center gap-2 px-4 py-2 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary apple-text-caption1 font-semibold transition-all no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              PDF
            </button>
            <button onClick={handleClose} className="apple-press w-9 h-9 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-secondary transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Print area */}
        <div id="monthly-report-print" className="p-6 space-y-6">

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 apple-label-tertiary">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="apple-text-body">Cargando reporte...</span>
            </div>
          ) : (
            <>
              {/* ── Summary Cards ── */}
              <div className="print-section grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="apple-card bg-apple-green/12 rounded-apple-md p-4">
                  <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1">Ingresos</p>
                  <p className="apple-text-title2 tabular-nums text-apple-green print-positive">{fmtUSD(totalRevenue)}</p>
                </div>
                <div className="apple-card bg-apple-red/12 rounded-apple-md p-4">
                  <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1">Gastos</p>
                  <p className="apple-text-title2 tabular-nums text-apple-red print-negative">{fmtUSD(totalExpenses)}</p>
                </div>
                <div className={`apple-card rounded-apple-md p-4 ${netProfit >= 0 ? "bg-apple-blue/12" : "bg-apple-orange/12"}`}>
                  <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1">Neto</p>
                  <p className={`apple-text-title2 tabular-nums ${netProfit >= 0 ? "text-apple-blue print-positive" : "text-apple-orange print-negative"}`}>
                    {netProfit >= 0 ? "+" : ""}{fmtUSD(netProfit)}
                  </p>
                </div>
                <div className="apple-card rounded-apple-md p-4">
                  <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-1">Transacciones</p>
                  <p className="apple-text-title2 tabular-nums apple-label-primary">{txs.length}</p>
                </div>
              </div>

              {/* ── Expenses by Category ── */}
              {Object.keys(expenseByCategory).length > 0 && (
                <div className="print-section space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-apple-red" />
                    <h3 className="apple-text-headline apple-label-primary">Gastos por Categoría</h3>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(expenseByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amt]) => {
                        const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
                        return (
                          <div key={cat} className="flex items-center gap-3">
                            <span className={`apple-text-caption2 font-semibold px-2.5 py-1 rounded-full w-28 text-center flex-shrink-0 ${CATEGORY_COLORS[cat] || "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"}`}>
                              {CAT_LABELS[cat] || cat}
                            </span>
                            <div className="flex-1 h-2 bg-gray-sys6 dark:bg-gray-sys5 rounded-full overflow-hidden">
                              <div className="h-full bg-apple-red rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="apple-text-footnote font-semibold tabular-nums apple-label-primary w-20 text-right flex-shrink-0">{fmtUSD(amt)}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* ── Revenue by Category ── */}
              {Object.keys(revenueByCategory).length > 0 && (
                <div className="print-section space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-apple-green" />
                    <h3 className="apple-text-headline apple-label-primary">Ingresos por Categoría</h3>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(revenueByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amt]) => {
                        const pct = totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0;
                        return (
                          <div key={cat} className="flex items-center gap-3">
                            <span className={`apple-text-caption2 font-semibold px-2.5 py-1 rounded-full w-28 text-center flex-shrink-0 ${CATEGORY_COLORS[cat] || "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"}`}>
                              {CAT_LABELS[cat] || cat}
                            </span>
                            <div className="flex-1 h-2 bg-gray-sys6 dark:bg-gray-sys5 rounded-full overflow-hidden">
                              <div className="h-full bg-apple-green rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="apple-text-footnote font-semibold tabular-nums apple-label-primary w-20 text-right flex-shrink-0">{fmtUSD(amt)}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* ── Transaction Table ── */}
              <div className="print-section space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-apple-blue" />
                  <h3 className="apple-text-headline apple-label-primary tabular-nums">Todas las Transacciones ({allSorted.length})</h3>
                </div>
                <div className="overflow-x-auto rounded-apple-md apple-card">
                  <table className="w-full print-table apple-text-footnote">
                    <thead>
                      <tr className="bg-gray-sys6 dark:bg-gray-sys5" style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                        <th className="text-left px-4 py-3 apple-text-caption2 font-semibold apple-label-tertiary">Fecha</th>
                        <th className="text-left px-4 py-3 apple-text-caption2 font-semibold apple-label-tertiary">Tipo</th>
                        <th className="text-left px-4 py-3 apple-text-caption2 font-semibold apple-label-tertiary">Categoría</th>
                        <th className="text-left px-4 py-3 apple-text-caption2 font-semibold apple-label-tertiary">Descripción</th>
                        <th className="text-right px-4 py-3 apple-text-caption2 font-semibold apple-label-tertiary">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSorted.map((tx, i) => {
                        const isIncome = tx.type === "revenue" || tx.type === "income";
                        const dateStr = tx.created_date || tx.created_at;
                        return (
                          <tr key={tx.id || i} className="transition-colors" style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                            <td className="px-4 py-2.5 apple-label-tertiary tabular-nums whitespace-nowrap">
                              {dateStr ? format(new Date(dateStr), "dd/MM HH:mm") : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`apple-text-caption2 font-semibold px-2 py-0.5 rounded-full ${isIncome ? "bg-apple-green/15 text-apple-green" : "bg-apple-red/15 text-apple-red"}`}>
                                {isIncome ? "Ingreso" : "Gasto"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 apple-label-secondary">
                              {CAT_LABELS[tx.category] || tx.category || "—"}
                            </td>
                            <td className="px-4 py-2.5 apple-label-primary max-w-[200px] truncate">
                              {tx.description || "—"}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap ${isIncome ? "text-apple-green" : "text-apple-red"}`}>
                              {isIncome ? "+" : "-"}{fmtUSD(tx.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-sys6 dark:bg-gray-sys5" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                        <td colSpan={4} className="px-4 py-3 apple-text-footnote font-semibold apple-label-secondary">Total Neto del Mes</td>
                        <td className={`px-4 py-3 text-right apple-text-headline tabular-nums font-semibold ${netProfit >= 0 ? "text-apple-green" : "text-apple-red"}`}>
                          {netProfit >= 0 ? "+" : ""}{fmtUSD(netProfit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                <p className="apple-text-caption2 apple-label-secondary font-semibold tabular-nums">
                  SmartFixOS · Reporte {monthLabel} · Generado {format(new Date(), "dd/MM/yyyy HH:mm")}
                </p>
                <button
                  onClick={handlePrint}
                  className="apple-btn apple-btn-primary apple-press no-print flex items-center gap-2 px-6 py-3"
                >
                  <Printer className="w-4 h-4" />
                  Guardar como PDF
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
