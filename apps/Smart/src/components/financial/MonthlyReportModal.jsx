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
  payroll: "bg-blue-500/20 text-blue-300",
  parts: "bg-pink-500/20 text-pink-300",
  supplies: "bg-amber-500/20 text-amber-300",
  repair_payment: "bg-cyan-500/20 text-cyan-300",
  refund: "bg-red-500/20 text-red-300",
  other_expense: "bg-slate-500/20 text-slate-300",
  income: "bg-emerald-500/20 text-emerald-300",
  revenue: "bg-emerald-500/20 text-emerald-300",
  service: "bg-violet-500/20 text-violet-300",
};

// ── Print styles ──────────────────────────────────────────────────────────────
const PRINT_CSS = `
  @media print {
    body * { visibility: hidden !important; }
    #monthly-report-print, #monthly-report-print * { visibility: visible !important; }
    #monthly-report-print {
      position: fixed !important; top: 0 !important; left: 0 !important;
      width: 100% !important; background: white !important; color: black !important;
      padding: 24px !important; font-family: Arial, sans-serif !important;
    }
    .no-print { display: none !important; }
    .print-table { width: 100% !important; border-collapse: collapse !important; }
    .print-table td, .print-table th { border: 1px solid #ccc !important; padding: 6px 10px !important; font-size: 11px !important; }
    .print-table th { background: #f0f0f0 !important; font-weight: bold !important; }
    .print-section { page-break-inside: avoid !important; margin-bottom: 16px !important; }
    h1, h2, h3 { color: black !important; }
    .print-positive { color: #16a34a !important; font-weight: bold !important; }
    .print-negative { color: #dc2626 !important; font-weight: bold !important; }
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
    <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 no-print">
      <div className="w-full max-w-3xl bg-[#0d1117] border border-white/[0.08] rounded-[32px] text-white shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#0d1117]/95 backdrop-blur-sm px-6 pt-6 pb-4 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Reporte Mensual</h2>
              <p className="text-[9px] font-black uppercase tracking-widest text-white/30">{monthLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Month selector */}
            <select
              value={format(month, "yyyy-MM")}
              onChange={(e) => setMonth(new Date(e.target.value + "-01"))}
              className="bg-white/5 border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none"
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.08] text-white/60 hover:text-white text-xs font-bold transition-all no-print"
            >
              <Printer className="w-3.5 h-3.5" />
              PDF
            </button>
            <button onClick={handleClose} className="w-9 h-9 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Print area */}
        <div id="monthly-report-print" className="p-6 space-y-6">

          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-white/30">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Cargando reporte...</span>
            </div>
          ) : (
            <>
              {/* ── Summary Cards ── */}
              <div className="print-section grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[20px] p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-400/60 mb-1">Ingresos</p>
                  <p className="text-2xl font-black text-emerald-400 print-positive">{fmtUSD(totalRevenue)}</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-[20px] p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-400/60 mb-1">Gastos</p>
                  <p className="text-2xl font-black text-red-400 print-negative">{fmtUSD(totalExpenses)}</p>
                </div>
                <div className={`border rounded-[20px] p-4 ${netProfit >= 0 ? "bg-cyan-500/10 border-cyan-500/20" : "bg-orange-500/10 border-orange-500/20"}`}>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">Neto</p>
                  <p className={`text-2xl font-black ${netProfit >= 0 ? "text-cyan-400 print-positive" : "text-orange-400 print-negative"}`}>
                    {netProfit >= 0 ? "+" : ""}{fmtUSD(netProfit)}
                  </p>
                </div>
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-[20px] p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-1">Transacciones</p>
                  <p className="text-2xl font-black text-white/70">{txs.length}</p>
                </div>
              </div>

              {/* ── Expenses by Category ── */}
              {Object.keys(expenseByCategory).length > 0 && (
                <div className="print-section space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-400" />
                    <h3 className="font-black text-white">Gastos por Categoría</h3>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(expenseByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amt]) => {
                        const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
                        return (
                          <div key={cat} className="flex items-center gap-3">
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full w-28 text-center flex-shrink-0 ${CATEGORY_COLORS[cat] || "bg-white/10 text-white/50"}`}>
                              {CAT_LABELS[cat] || cat}
                            </span>
                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-red-400/60 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-sm font-black text-white/80 w-20 text-right flex-shrink-0">{fmtUSD(amt)}</span>
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
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-black text-white">Ingresos por Categoría</h3>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(revenueByCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([cat, amt]) => {
                        const pct = totalRevenue > 0 ? (amt / totalRevenue) * 100 : 0;
                        return (
                          <div key={cat} className="flex items-center gap-3">
                            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full w-28 text-center flex-shrink-0 ${CATEGORY_COLORS[cat] || "bg-white/10 text-white/50"}`}>
                              {CAT_LABELS[cat] || cat}
                            </span>
                            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400/60 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-sm font-black text-white/80 w-20 text-right flex-shrink-0">{fmtUSD(amt)}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* ── Transaction Table ── */}
              <div className="print-section space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  <h3 className="font-black text-white">Todas las Transacciones ({allSorted.length})</h3>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
                  <table className="w-full print-table text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                        <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Fecha</th>
                        <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Tipo</th>
                        <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Categoría</th>
                        <th className="text-left px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Descripción</th>
                        <th className="text-right px-4 py-3 text-[9px] font-black uppercase tracking-widest text-white/30">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSorted.map((tx, i) => {
                        const isIncome = tx.type === "revenue" || tx.type === "income";
                        const dateStr = tx.created_date || tx.created_at;
                        return (
                          <tr key={tx.id || i} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-2.5 text-white/40 whitespace-nowrap">
                              {dateStr ? format(new Date(dateStr), "dd/MM HH:mm") : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isIncome ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                                {isIncome ? "Ingreso" : "Gasto"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-white/50">
                              {CAT_LABELS[tx.category] || tx.category || "—"}
                            </td>
                            <td className="px-4 py-2.5 text-white/70 max-w-[200px] truncate">
                              {tx.description || "—"}
                            </td>
                            <td className={`px-4 py-2.5 text-right font-black whitespace-nowrap ${isIncome ? "text-emerald-400" : "text-red-400"}`}>
                              {isIncome ? "+" : "-"}{fmtUSD(tx.amount)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-white/[0.1] bg-white/[0.03]">
                        <td colSpan={4} className="px-4 py-3 text-xs font-black text-white/50">Total Neto del Mes</td>
                        <td className={`px-4 py-3 text-right text-base font-black ${netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {netProfit >= 0 ? "+" : ""}{fmtUSD(netProfit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
                <p className="text-[9px] text-white/50 font-bold uppercase tracking-widest">
                  SmartFixOS · Reporte {monthLabel} · Generado {format(new Date(), "dd/MM/yyyy HH:mm")}
                </p>
                <button
                  onClick={handlePrint}
                  className="no-print flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-sm transition-all hover:from-cyan-500 hover:to-blue-500 active:scale-[0.98]"
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
