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
      className={`w-full text-left rounded-[24px] border transition-all duration-300 active:scale-95 ${
        compact
          ? "bg-[linear-gradient(180deg,rgba(9,18,29,0.82),rgba(10,23,35,0.68))] border-white/10 p-4 shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
          : "bg-[linear-gradient(180deg,rgba(9,18,29,0.82),rgba(10,23,35,0.68))] border-white/10 p-5 lg:p-6 shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-[0_6px_14px_rgba(0,0,0,0.14)]">
            <DollarSign className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.18em] font-black text-white/58">Finanzas</p>
            <p className="text-sm font-bold text-white">Resumen de hoy</p>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-cyan-200/80" />
      </div>

      {loading ? (
        <div className="mt-4 text-xs text-white/60">Cargando resumen financiero...</div>
      ) : (
        <>
          <div className={`mt-4 grid ${compact ? "grid-cols-2 gap-2" : "grid-cols-2 lg:grid-cols-4 gap-3"}`}>
            <div className="rounded-2xl bg-black/14 border border-white/10 p-2.5 text-center">
              <p className="text-[10px] text-white/52 uppercase tracking-[0.14em]">Entrada</p>
              <p className="text-lg font-black text-emerald-300">${summary.todayRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-black/14 border border-white/10 p-2.5 text-center">
              <p className="text-[10px] text-white/52 uppercase tracking-[0.14em]">Ganancia real</p>
              <p className="text-lg font-black text-cyan-300">${summary.todayProfit.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-black/14 border border-white/10 p-2.5 text-center">
              <p className="text-[10px] text-white/52 uppercase tracking-[0.14em]">Apartar hoy</p>
              <p className="text-lg font-black text-amber-300">${summary.todaySetAside.toFixed(2)}</p>
            </div>
            <div className="rounded-2xl bg-black/14 border border-white/10 p-2.5 text-center">
              <p className="text-[10px] text-white/52 uppercase tracking-[0.14em]">Pendiente</p>
              <p className="text-lg font-black text-white">
                {summary.pendingCount} · ${summary.pendingAmount.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-2xl bg-black/14 border border-white/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-white/80 flex items-center gap-1">
                <CalendarClock className="w-3.5 h-3.5 text-cyan-300" />
                Próximos pagos
              </p>
              <p className="text-[11px] text-emerald-300 flex items-center gap-1">
                <PiggyBank className="w-3.5 h-3.5" />
                Neto: ${summary.netAfterReserve.toFixed(2)}
              </p>
            </div>

            {summary.nextPayments.length === 0 ? (
              <p className="text-xs text-white/50">No hay gastos fijos activos.</p>
            ) : (
              <div className="space-y-1.5">
                {summary.nextPayments.map((item) => (
                  <div key={item.id} className="flex items-center justify-between text-xs">
                    <div className="min-w-0">
                      <p className="text-white font-medium truncate">{item.name}</p>
                      <p className="text-white/50">
                        {item.dueDate
                          ? `Vence ${format(item.dueDate, "d MMM", { locale: es })} (${item.daysRemaining}d)`
                          : "Sin fecha de vencimiento"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-cyan-300 font-semibold">${toMoney(item.goalAmount).toFixed(2)}</p>
                      <p className="text-amber-300/90">Hoy: ${toMoney(item.todayAmount).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 flex items-center gap-1 text-[11px] text-cyan-200/80">
            <TrendingUp className="w-3.5 h-3.5" />
            Toca aquí para editar en Finanzas
          </div>
        </>
      )}
    </button>
  );
}
