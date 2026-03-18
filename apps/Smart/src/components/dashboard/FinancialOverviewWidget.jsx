import React, { useCallback, useEffect, useMemo, useState } from "react";
import { dataClient } from "@/components/api/dataClient";
import { CalendarClock, ChevronRight, DollarSign, PiggyBank, TrendingUp, Loader2, Banknote, CreditCard } from "lucide-react";
import { endOfDay, format, isWithinInterval, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { mergeSales, mergeTransactions, upsertLocalSale, upsertLocalTransactions } from "@/components/utils/localFinancialCache";

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

const LOCAL_FIXED_EXPENSES_KEY = "smartfix_local_fixed_expenses";

const readLocalFixedExpenses = () => {
  try {
    const raw = localStorage.getItem(LOCAL_FIXED_EXPENSES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const computeSaleProfit = (sale) => {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  return items.reduce((sum, item) => {
    const qty = Number(item?.quantity || 0);
    const total = Number(item?.total || (Number(item?.price || 0) * qty));
    const lineCost = Number(item?.line_cost || (Number(item?.cost || 0) * qty));
    const explicitLineProfit = item?.line_profit;
    const lineProfit = explicitLineProfit != null ? Number(explicitLineProfit || 0) : (total - lineCost);
    return sum + (Number.isFinite(lineProfit) ? lineProfit : 0);
  }, 0);
};

export default function FinancialOverviewWidget({ compact = false, onClick }) {
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
      const localFixed = readLocalFixedExpenses();
      const mergedFixed = [...(fixedData || []), ...localFixed];
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
        return isWithinInterval(new Date(d), { start: todayStart, end: todayEnd });
      } catch {
        return false;
      }
    });

    const expenseTransactionsToday = transactions.filter((t) => {
      if (t?.type !== "expense") return false;
      const d = getEntityDate(t);
      if (!d) return false;
      try {
        return isWithinInterval(new Date(d), { start: todayStart, end: todayEnd });
      } catch {
        return false;
      }
    });

    const salesToday = sales.filter((s) => {
      const d = getEntityDate(s);
      if (!d) return false;
      try {
        return isWithinInterval(new Date(d), { start: todayStart, end: todayEnd });
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
      className={`w-full text-left rounded-[32px] border transition-all duration-500 group overflow-hidden relative shadow-2xl ${
        compact
          ? "bg-zinc-900/40 backdrop-blur-3xl border-white/10 p-5"
          : "bg-zinc-900/40 backdrop-blur-3xl border-white/10 p-6 lg:p-8"
      }`}
    >
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-emerald-500/10 pointer-events-none" />
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] group-hover:bg-blue-500/20 transition-all duration-1000" />
      <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] group-hover:bg-emerald-500/20 transition-all duration-1000" />
      
      <div className="relative z-10 flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-blue-500/40 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-white/40">Smart Analytics</p>
            </div>
            <p className="text-2xl font-black text-white tracking-tight leading-none mt-1">Resumen de hoy</p>
          </div>
        </div>
        <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/20 transition-all duration-300">
          <ChevronRight className="w-6 h-6 text-white group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
          <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Sincronizando caja...</p>
        </div>
      ) : (
        <div className="relative z-10 space-y-6">
          {/* Main Stats Grid */}
          <div className={`grid grid-cols-2 ${compact ? "gap-3" : "gap-4"}`}>
            <div className="relative rounded-[24px] bg-white/5 border border-white/5 p-5 group/card transition-all duration-500 hover:bg-white/10 overflow-hidden">
               <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/card:scale-110 transition-transform">
                <DollarSign className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Entradas</p>
              <p className="text-3xl font-black text-emerald-400 tracking-tight">${summary.todayRevenue.toFixed(2)}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[70%]" />
                </div>
              </div>
            </div>

            <div className="relative rounded-[24px] bg-white/5 border border-white/5 p-5 group/card transition-all duration-500 hover:bg-white/10 overflow-hidden">
              <div className="absolute top-0 right-0 p-3 opacity-20 group-hover/card:scale-110 transition-transform">
                <TrendingUp className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-black mb-1">Ganancia Real</p>
              <p className="text-3xl font-black text-blue-400 tracking-tight">${summary.todayProfit.toFixed(2)}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[45%]" />
                </div>
              </div>
            </div>
          </div>

          {/* Transactions List */}
          <div className="rounded-[28px] bg-black/40 border border-white/5 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between mb-5 px-1">
              <p className="text-xs font-black text-white/80 uppercase tracking-[0.15em] flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-blue-400" />
                Transacciones Recientes
              </p>
              <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">Hoy</p>
              </div>
            </div>

            {summary.recentTransactions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="w-6 h-6 text-white/20" />
                </div>
                <p className="text-sm font-bold text-white/30">Sin transacciones registradas hoy</p>
              </div>
            ) : (
              <div className="space-y-3">
                {summary.recentTransactions.map((t) => (
                  <div key={t.id} className="group/item flex items-center justify-between bg-white/5 p-3 rounded-2xl hover:bg-white/10 border border-transparent hover:border-white/5 transition-all duration-300">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        t.type === 'revenue' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      }`}>
                        {t.payment_method === 'cash' ? <Banknote className="w-5 h-5" /> : 
                         t.payment_method === 'ath_movil' ? <Smartphone className="w-5 h-5" /> : 
                         <CreditCard className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white tracking-tight truncate group-hover/item:text-blue-400 transition-colors">
                          {t.description || "Transacción"}
                        </p>
                        <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
                          {format(new Date(getEntityDate(t)), "h:mm a", { locale: es })} • {t.payment_method}
                        </p>
                      </div>
                    </div>
                    <div className="text-right pl-4">
                      <p className={`text-base font-black tracking-tight ${
                        t.type === 'revenue' ? "text-emerald-400" : "text-red-400"
                      }`}>
                        {t.type === 'revenue' ? '+' : '-'}${toMoney(t.amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-4 h-4 text-emerald-400" />
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Reserva: <span className="text-white">${summary.todaySetAside.toFixed(2)}</span></p>
            </div>
            <p className="text-xs font-black text-blue-400 bg-blue-500/10 px-4 py-2 rounded-xl border border-blue-500/20 uppercase tracking-widest group-hover:bg-blue-500/20 transition-all">
              Ver Detalles Finanzas
            </p>
          </div>
        </div>
      )}
    </button>
  );
}
