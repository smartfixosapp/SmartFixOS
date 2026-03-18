import React, { useCallback, useEffect, useMemo, useState } from "react";
import { dataClient } from "@/components/api/dataClient";
import { CalendarClock, ChevronRight, DollarSign, PiggyBank, TrendingUp, Loader2, Banknote, CreditCard, Smartphone } from "lucide-react";
import { endOfDay, format, isWithinInterval, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { mergeSales, mergeTransactions, upsertLocalSale, upsertLocalTransactions, readLocalFixedExpenses } from "@/components/utils/localFinancialCache";

const getFrequencyDivisor = (frequency) => {
  const divisors = {
    daily: 1,
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 90,
    yearly: 365
  };
  return divisors[frequency] || 30;
};

const getEntityDate = (item) =>
  item?.created_date || item?.created_at || item?.updated_date || item?.updated_at || null;

const parseFixedExpenseNotes = (notes) => {
  if (!notes || typeof notes !== "string") return { notesText: "", fixedAmount: 0 };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object") {
      return {
        notesText: parsed.text || "",
        fixedAmount: Number(parsed.fixed_amount || 0)
      };
    }
  } catch {
    // texto plano
  }
  return { notesText: notes, fixedAmount: 0 };
};

const getNextDueDate = (dueDay, now = new Date()) => {
  const day = Math.max(1, Math.min(31, Number(dueDay || 1)));
  const candidate = new Date(now.getFullYear(), now.getMonth(), day, 23, 59, 59, 999);
  if (candidate >= now) return candidate;
  return new Date(now.getFullYear(), now.getMonth() + 1, day, 23, 59, 59, 999);
};

const getDaysUntilDate = (futureDate, now = new Date()) => {
  const diffMs = futureDate.getTime() - now.getTime();
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil(diffMs / msPerDay));
};

const toMoney = (value) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
};


const computeSaleProfit = (sale) => {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  return items.reduce((sum, item) => {
    const qty = Number(item?.quantity || 0);
    const total = Number(item?.total || (Number(item?.price || 0) * qty));
    const lineCost = Number(item?.line_cost || (Number(item?.cost || 0) * qty));
    
    // Si hay una ganancia explícita por línea, usarla. De lo contrario, calcular (total - costo).
    const explicitLineProfit = item?.line_profit;
    const lineProfit = explicitLineProfit != null 
      ? Number(explicitLineProfit || 0) 
      : (total - lineCost);
      
    return sum + (Number.isFinite(lineProfit) ? lineProfit : 0);
  }, 0);
};

const DAILY_GOAL = 1000; // Meta diaria configurable

function FinancialOverviewWidgetBase({ compact = false, onClick }) {
  const [sales, setSales] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const safeList = async (entity, limit = 500) => {
      try {
        return await entity.list("-created_date", limit);
      } catch {
        return entity.list("-created_at", limit).catch(() => []);
      }
    };

    try {
      const [salesData, transactionsData, fixedData] = await Promise.all([
        safeList(dataClient.entities.Sale, 500),
        safeList(dataClient.entities.Transaction, 500),
        safeList(dataClient.entities.FixedExpense, 100)
      ]);
      const localFixed = await readLocalFixedExpenses();
      const mergedFixed = [...(fixedData || []), ...(Array.isArray(localFixed) ? localFixed : [])];
      const dedupedFixed = mergedFixed.filter((item, idx, arr) => {
        const id = String(item?.id || item?._id || "");
        if (id) return arr.findIndex((x) => String(x?.id || x?._id || "") === id) === idx;
        const sig = `${String(item?.name || "").trim().toLowerCase()}|${item?.category || ""}|${item?.frequency || ""}|${item?.due_day || ""}`;
        return arr.findIndex((x) => `${String(x?.name || "").trim().toLowerCase()}|${x?.category || ""}|${x?.frequency || ""}|${x?.due_day || ""}` === sig) === idx;
      });
      setSales(mergeSales((salesData || []).filter((s) => !s?.voided)));
      setTransactions(mergeTransactions(transactionsData || []));
      setFixedExpenses(dedupedFixed.filter((f) => f?.active !== false));
    } catch (error) {
      console.error("Error loading financial overview:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const refresh = () => setTimeout(loadData, 400);
    const handleSaleCompleted = (event) => {
      const sale = event?.detail?.sale;
      const txs = Array.isArray(event?.detail?.transactions) ? event.detail.transactions : [];
      if (sale?.id) upsertLocalSale(sale);
      if (txs.length) upsertLocalTransactions(txs);
      if (sale) {
        setSales((prev) => [sale, ...(prev || []).filter((row) => String(row?.id || "") !== String(sale?.id || ""))]);
      }
      if (txs.length) {
        setTransactions((prev) => {
          const existing = Array.isArray(prev) ? prev : [];
          const next = [...existing];
          for (const tx of txs) {
            if (!tx?.id || next.some((row) => String(row?.id || "") === String(tx.id))) continue;
            next.unshift(tx);
          }
          return next;
        });
      }
      refresh();
    };
    window.addEventListener("sale-completed", handleSaleCompleted);
    window.addEventListener("expense-created", refresh);
    window.addEventListener("fixed-expenses-updated", refresh);
    window.addEventListener("force-refresh", refresh);
    return () => {
      window.removeEventListener("sale-completed", handleSaleCompleted);
      window.removeEventListener("expense-created", refresh);
      window.removeEventListener("fixed-expenses-updated", refresh);
      window.removeEventListener("force-refresh", refresh);
    };
  }, [loadData]);

  const summary = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const revenueTransactionsToday = transactions.filter((t) => {
      if (t?.type !== "revenue") return false;
      const d = getEntityDate(t);
      if (!d) return false;
      try {
        const targetDate = new Date(d);
        if (isNaN(targetDate.getTime())) return false;
        return isWithinInterval(targetDate, { start: todayStart, end: todayEnd });
      } catch {
        return false;
      }
    });

    const expenseTransactionsToday = transactions.filter((t) => {
      if (t?.type !== "expense") return false;
      const d = getEntityDate(t);
      if (!d) return false;
      try {
        const targetDate = new Date(d);
        if (isNaN(targetDate.getTime())) return false;
        return isWithinInterval(targetDate, { start: todayStart, end: todayEnd });
      } catch {
        return false;
      }
    });

    const salesToday = sales.filter((s) => {
      const d = getEntityDate(s);
      if (!d) return false;
      try {
        const date = new Date(d);
        if (isNaN(date.getTime())) return false;
        return isWithinInterval(date, { start: todayStart, end: todayEnd });
      } catch {
        return false;
      }
    });

    const entriesFromTransactions = revenueTransactionsToday.reduce((sum, t) => sum + toMoney(t?.amount), 0);
    const entriesFromSalesFallback = salesToday.reduce((sum, s) => sum + toMoney(s?.amount_paid || s?.total), 0);
    const todayRevenue = Math.max(entriesFromTransactions, entriesFromSalesFallback);
    const todayExpenses = expenseTransactionsToday.reduce((sum, t) => sum + toMoney(t?.amount), 0);
    const todayProfit = salesToday.reduce((sum, s) => sum + computeSaleProfit(s), 0);

    const allocations = fixedExpenses.map((expense) => {
      const parsedNotes = parseFixedExpenseNotes(expense?.notes);
      const fixedAmount = toMoney(parsedNotes.fixedAmount || expense?.fixed_amount);
      const percentage = toMoney(expense?.percentage);
      const hasDueDay = Number(expense?.due_day || 0) > 0;
      const nextDueDate = hasDueDay ? getNextDueDate(expense?.due_day, now) : null;
      const daysRemaining = nextDueDate ? getDaysUntilDate(nextDueDate, now) : null;
      const dailyTargetByDueDate = fixedAmount > 0 && daysRemaining ? fixedAmount / daysRemaining : 0;
      const dailyByPercentage = todayProfit > 0 ? (todayProfit * (percentage / 100)) : 0;
      const dailyByAmount = fixedAmount > 0 ? fixedAmount / getFrequencyDivisor(expense?.frequency) : 0;
      const amountToSetAsideToday = fixedAmount > 0 && daysRemaining
        ? Math.min(todayProfit, dailyTargetByDueDate)
        : (fixedAmount > 0 ? Math.min(todayProfit, dailyByAmount) : dailyByPercentage);

      return {
        id: expense?.id,
        name: expense?.name || "Gasto fijo",
        dueDate: nextDueDate,
        dueDay: expense?.due_day || null,
        daysRemaining: daysRemaining ?? null,
        goalAmount: fixedAmount,
        todayAmount: amountToSetAsideToday
      };
    }).sort((a, b) => {
      const aDate = a?.dueDate ? a.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      const bDate = b?.dueDate ? b.dueDate.getTime() : Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });

    const todaySetAside = allocations.reduce((sum, alloc) => sum + (Number.isFinite(alloc.todayAmount) ? alloc.todayAmount : 0), 0);
    const pendingAmount = allocations.reduce((sum, alloc) => sum + (Number.isFinite(alloc.goalAmount) ? alloc.goalAmount : 0), 0);

    const recentTransactions = transactions
      .filter(t => {
        const d = getEntityDate(t);
        return d && isWithinInterval(new Date(d), { start: todayStart, end: todayEnd });
      })
      .sort((a, b) => new Date(getEntityDate(b)) - new Date(getEntityDate(a)))
      .slice(0, 5);

    return {
      todayRevenue,
      todayProfit,
      todayExpenses,
      todaySetAside,
      netAfterReserve: todayProfit - todaySetAside,
      pendingCount: allocations.length,
      pendingAmount,
      nextPayments: allocations,
      recentTransactions
    };
  }, [compact, fixedExpenses, sales, transactions]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left transition-all duration-700 group overflow-hidden relative shadow-[0_32px_80px_rgba(0,0,0,0.4)]",
        compact
          ? "bg-[#121215]/40 backdrop-blur-[40px] border border-white/10 p-5 rounded-[28px] xs:p-6"
          : "bg-[#121215]/40 backdrop-blur-[40px] border border-white/10 p-8 lg:p-10 rounded-[40px]"
      )}
    >
      {/* Background Effects - More subtle and deep */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
      <div className="absolute -right-32 -top-32 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] group-hover:bg-blue-600/20 transition-all duration-1000" />
      <div className="absolute -left-32 -bottom-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] group-hover:bg-emerald-600/20 transition-all duration-1000" />
      
      <div className={cn("relative z-10 flex items-center justify-between", compact ? "mb-6" : "mb-10")}>
        <div className="flex items-center gap-4 xs:gap-5">
          <div className={cn(
            "rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-violet-700 flex items-center justify-center shadow-[0_12px_24px_rgba(37,99,235,0.3)] group-hover:scale-110 group-hover:rotate-6 transition-all duration-700",
            compact ? "w-12 h-12 xs:w-14 xs:h-14 rounded-xl" : "w-16 h-16 rounded-[24px]"
          )}>
            <TrendingUp className={cn("text-white", compact ? "w-6 h-6 xs:w-7 xs:h-7" : "w-8 h-8")} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <p className="text-[9px] uppercase tracking-[0.25em] font-black text-white/30 italic">Smart Analytics</p>
            </div>
            <p className={cn(
              "font-black text-white tracking-tighter leading-none mt-1 uppercase",
              compact ? "text-xl xs:text-2xl" : "text-3xl"
            )}>Resumen de hoy</p>
          </div>
        </div>
        {!compact && (
          <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-500 group-hover:scale-110">
            <ChevronRight className="w-7 h-7 text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-6">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em]">Sincronizando analytics...</p>
        </div>
      ) : (
        <div className="relative z-10 space-y-8">
          {/* Main Stats Grid */}
          <div className={cn("grid grid-cols-2", compact ? "gap-3 xs:gap-4" : "gap-6")}>
            <div className={cn(
              "relative bg-white/[0.03] border border-white/[0.06] group/card transition-all duration-700 hover:bg-white/5 overflow-hidden shadow-inner",
              compact ? "p-4 rounded-[24px]" : "p-6 rounded-[32px]"
            )}>
               <div className="absolute top-0 right-0 p-3 opacity-10 group-hover/card:scale-125 transition-transform duration-700">
                <DollarSign className={cn("text-emerald-400", compact ? "w-8 h-8" : "w-12 h-12")} />
              </div>
              <p className="text-[9px] text-white/25 uppercase tracking-[0.2em] font-black mb-1.5 xs:mb-2">Entradas</p>
              <p className={cn(
                "font-black text-emerald-400 tracking-tighter",
                compact ? "text-2xl xs:text-3xl" : "text-4xl"
              )}>${summary.todayRevenue.toFixed(2)}</p>
              <div className="mt-3 xs:mt-4 flex items-center gap-1.5">
                <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden font-black">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 w-[75%] rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                </div>
              </div>
            </div>

            <div className={cn(
              "relative bg-white/[0.03] border border-white/[0.06] group/card transition-all duration-700 hover:bg-white/5 overflow-hidden shadow-inner",
              compact ? "p-4 rounded-[24px]" : "p-6 rounded-[32px]"
            )}>
              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover/card:scale-125 transition-transform duration-700">
                <TrendingUp className={cn("text-blue-400", compact ? "w-8 h-8" : "w-12 h-12")} />
              </div>
              <p className="text-[9px] text-white/25 uppercase tracking-[0.2em] font-black mb-1.5 xs:mb-2">Ganancia</p>
              <p className={cn(
                "font-black text-blue-400 tracking-tighter",
                compact ? "text-2xl xs:text-3xl" : "text-4xl"
              )}>${summary.todayProfit.toFixed(2)}</p>
              <div className="mt-3 xs:mt-4 flex items-center gap-1.5">
                <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 w-[50%] rounded-full shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                </div>
              </div>
            </div>
          </div>

          {/* 📊 BARRA DE COMPLETADO (NUEVA) */}
          <div className={cn(
            "bg-white/[0.03] border border-white/[0.06] backdrop-blur-3xl overflow-hidden relative",
            compact ? "p-4 rounded-[24px]" : "p-6 rounded-[32px]"
          )}>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.2em]">Meta Diaria: <span className="text-white">${DAILY_GOAL}</span></p>
              </div>
              <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                {Math.min(100, Math.round((summary.todayRevenue / DAILY_GOAL) * 100))}%
              </p>
            </div>
            
            <div className="relative h-4 bg-black/40 rounded-full border border-white/10 p-0.5 overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all duration-1000 ease-out relative"
                style={{ width: `${Math.min(100, (summary.todayRevenue / DAILY_GOAL) * 100)}%` }}
              >
                <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[shimmer_2s_linear_infinite]" />
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className={cn(
            "bg-black/20 border border-white/[0.04] backdrop-blur-3xl shadow-2xl",
            compact ? "p-4 rounded-[24px]" : "p-6 rounded-[32px]"
          )}>
            <div className={cn("flex items-center justify-between px-1", compact ? "mb-4" : "mb-6")}>
              <p className="text-[10px] xs:text-xs font-black text-white/50 uppercase tracking-[0.2em] flex items-center gap-2">
                <CalendarClock className="w-3.5 h-3.5 text-blue-400" />
                Actividad Reciente
              </p>
              <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Hoy</p>
              </div>
            </div>

            {summary.recentTransactions.length === 0 ? (
              <div className={cn("text-center", compact ? "py-8" : "py-12")}>
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3 border border-white/5">
                  <DollarSign className="w-6 h-6 text-white/10" />
                </div>
                <p className="text-[10px] font-black text-white/10 uppercase tracking-widest">Sin actividad</p>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.recentTransactions.map((t) => (
                  <div key={t.id} className="group/item flex items-center justify-between bg-white/[0.02] p-3 rounded-2xl border border-transparent hover:border-white/5 transition-all duration-500">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "rounded-xl flex items-center justify-center shrink-0 shadow-lg",
                        compact ? "w-10 h-10" : "w-12 h-12",
                        t.type === 'revenue' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      )}>
                        {t.payment_method === 'cash' ? <Banknote className={compact ? "w-5 h-5" : "w-6 h-6"} /> : 
                         t.payment_method === 'ath_movil' ? <Smartphone className={compact ? "w-5 h-5" : "w-6 h-6"} /> : 
                         <CreditCard className={compact ? "w-5 h-5" : "w-6 h-6"} />}
                      </div>
                      <div className="min-w-0">
                        <p className={cn(
                          "font-black text-white tracking-tight truncate group-hover/item:text-blue-400 transition-colors uppercase",
                          compact ? "text-sm" : "text-base"
                        )}>
                          {t.description || "Transacción"}
                        </p>
                        <p className="text-[8px] xs:text-[9px] font-black text-white/20 uppercase tracking-widest mt-0.5">
                          {format(new Date(getEntityDate(t)), "h:mm a", { locale: es })} • {t.payment_method}
                        </p>
                      </div>
                    </div>
                    <div className="text-right pl-3">
                      <p className={cn(
                        "font-black tracking-tighter",
                        compact ? "text-base" : "text-lg",
                        t.type === 'revenue' ? "text-emerald-400" : "text-red-400"
                      )}>
                        {t.type === 'revenue' ? '+' : '-'}${toMoney(t.amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-3">
            <div className="flex items-center gap-3">
              <PiggyBank className="w-5 h-5 text-emerald-400" />
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Reserva: <span className="text-white ml-2 text-xs">${summary.todaySetAside.toFixed(2)}</span></p>
            </div>
            <p className="text-[11px] font-black text-blue-400 bg-blue-500/10 px-6 py-2.5 rounded-full border border-blue-500/20 uppercase tracking-[0.2em] group-hover:bg-blue-500/20 shadow-inner transition-all duration-500">
              Ver Analytics
            </p>
          </div>
        </div>
      )}
    </button>

  );
}

class FinancialOverviewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("FinancialOverview Widget Crashed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <button className="group relative w-full h-full bg-red-500/5 backdrop-blur-3xl border border-red-500/20 rounded-[32px] p-6 lg:p-8 flex flex-col items-center justify-center min-h-[400px]">
          <DollarSign className="w-12 h-12 text-red-400 mb-4 opacity-50" />
          <p className="text-red-400 font-semibold text-center">Resumen Financiero no disponible</p>
          <p className="text-white/40 text-sm mt-2 text-center">Ocurrió un error al cargar este widget.</p>
        </button>
      );
    }

    return this.props.children;
  }
}

export default function FinancialOverviewWidget(props) {
  return (
    <FinancialOverviewErrorBoundary>
      <FinancialOverviewWidgetBase {...props} />
    </FinancialOverviewErrorBoundary>
  );
}
