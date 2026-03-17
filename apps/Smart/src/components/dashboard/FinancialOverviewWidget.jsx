import React, { useCallback, useEffect, useMemo, useState } from "react";
import { dataClient } from "@/components/api/dataClient";
import { CalendarClock, ChevronRight, DollarSign, PiggyBank, TrendingUp } from "lucide-react";
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

    const todaySetAside = allocations.reduce((sum, item) => sum + toMoney(item?.todayAmount), 0);
    const pendingAmount = allocations.reduce((sum, item) => sum + toMoney(item?.goalAmount), 0);
    const nextPayments = allocations.slice(0, compact ? 2 : 3);

    return {
      todayRevenue,
      todayProfit,
      todayExpenses,
      todaySetAside,
      netAfterReserve: todayProfit - todaySetAside,
      pendingCount: allocations.length,
      pendingAmount,
      nextPayments
    };
  }, [compact, fixedExpenses, sales, transactions]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-[32px] border transition-all duration-300 group overflow-hidden relative shadow-2xl ${
        compact
          ? "bg-white/5 backdrop-blur-3xl border-white/10 p-5"
          : "bg-white/5 backdrop-blur-3xl border-white/10 p-6 lg:p-8"
      }`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-cyan-500/5 to-blue-500/5 pointer-events-none" />
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-[60px] group-hover:bg-emerald-500/20 transition-all duration-700" />
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-500">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest font-black text-white/50">Finanzas</p>
            <p className="text-xl font-bold text-white tracking-tight">Resumen de hoy</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
          <ChevronRight className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>

      {loading ? (
        <div className="mt-4 text-xs text-white/60">Cargando resumen financiero...</div>
      ) : (
        <div className="relative z-10">
          <div className={`mt-6 grid grid-cols-2 ${compact ? "gap-3" : "gap-4"}`}>
            <div className="rounded-[20px] bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 p-4 text-center transition-colors">
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Entrada</p>
              <p className="text-2xl font-black text-emerald-400 tracking-tight mt-1">${summary.todayRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-[20px] bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 p-4 text-center transition-colors">
              <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Apartar hoy</p>
              <p className="text-2xl font-black text-amber-400 tracking-tight mt-1">${summary.todaySetAside.toFixed(2)}</p>
            </div>
          </div>

          <div className="mt-4 rounded-[20px] bg-white/5 border border-white/5 p-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
              <p className="text-xs font-bold text-white/80 uppercase tracking-widest flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-cyan-400" />
                Próximos pagos
              </p>
              <p className="text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1.5 uppercase tracking-wide">
                <PiggyBank className="w-4 h-4" />
                Neto: ${summary.netAfterReserve.toFixed(2)}
              </p>
            </div>

            {summary.nextPayments.length === 0 ? (
              <p className="text-sm font-medium text-white/40 text-center py-2">No hay gastos fijos activos.</p>
            ) : (
              <div className="space-y-3">
                {summary.nextPayments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-white/5 p-3 rounded-xl hover:bg-white/10 transition-colors">
                    <div className="min-w-0">
                      <p className="text-white font-bold tracking-tight truncate">{item.name}</p>
                      <p className="text-[10px] font-medium text-white/50 uppercase tracking-wider mt-0.5">
                        {item.dueDate
                          ? `Vence ${format(item.dueDate, "d MMM", { locale: es })} (${item.daysRemaining}d)`
                          : "Sin fecha de vencimiento"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-400 font-bold tracking-tight">${toMoney(item.goalAmount).toFixed(2)}</p>
                      <p className="text-[10px] font-medium text-amber-400 uppercase tracking-wider mt-0.5">Hoy: ${toMoney(item.todayAmount).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-400/80 bg-cyan-500/10 py-3 rounded-xl border border-cyan-500/20 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-all">
            <TrendingUp className="w-4 h-4" />
            Toca aquí para editar en Finanzas
          </div>
        </div>
      )}
    </button>
  );
}
