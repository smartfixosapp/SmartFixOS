import React, { useState, useEffect, useRef } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DollarSign, TrendingUp, Wallet, Receipt,
  CreditCard, Landmark, RefreshCw, Plus, Target, PieChart,
  Edit2, Trash2, Save, Calendar, Download, Filter, X, AlertTriangle
} from "lucide-react";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import OpenDrawerDialog from "../components/cash/OpenDrawerDialog";
import CloseDrawerDialog from "../components/cash/CloseDrawerDialog";
import ExpenseDialog from "../components/financial/ExpenseDialog";
import TimeTrackingModal from "../components/timetracking/TimeTrackingModal";
import AlertasWidget from "../components/financial/AlertasWidget";
import ReportesFinancieros from "../components/financial/ReportesFinancieros";
import EnhancedReports from "../components/financial/EnhancedReports";
import OneTimeExpensesWidget from "../components/financial/OneTimeExpensesWidget";
import GastosOperacionalesWidget from "../components/financial/GastosOperacionalesWidget";
import { toast } from "sonner";
import TransactionsModal from "../components/financial/TransactionsModal";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import {
  getCachedStatus,
  subscribeToCashRegister,
  checkCashRegisterStatus
} from "@/components/cash/CashRegisterService";
import { mergeSales, mergeTransactions, upsertLocalSale, upsertLocalTransactions } from "@/components/utils/localFinancialCache";
import ErrorBoundary from "@/components/utils/ErrorBoundary";

const StatCard = ({ title, value, icon: Icon, color, onClick, subtitle }) => (
  <div 
    onClick={onClick}
    className={`relative overflow-hidden p-6 rounded-[28px] border transition-all duration-300 group ${
      onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''
    } ${
      color === 'green' ? 'bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40 shadow-[0_8px_32px_rgba(16,185,129,0.1)]' :
      color === 'red' ? 'bg-red-500/10 border-red-500/20 hover:border-red-500/40 shadow-[0_8px_32px_rgba(239,68,68,0.1)]' :
      color === 'blue' ? 'bg-cyan-500/10 border-cyan-500/20 hover:border-cyan-500/40 shadow-[0_8px_32px_rgba(6,182,212,0.1)]' : 
      'bg-white/5 border-white/10 hover:border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.2)]'
    } backdrop-blur-xl`}
  >
    {/* Glow effect */}
    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-[40px] opacity-20 transition-opacity group-hover:opacity-40 ${
      color === 'green' ? 'bg-emerald-400' :
      color === 'red' ? 'bg-red-400' :
      color === 'blue' ? 'bg-cyan-400' : 'bg-white'
    }`} />

    <div className="relative flex justify-between items-start">
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{title}</p>
        <h3 className={`text-2xl sm:text-3xl font-black tracking-tight ${
          color === 'green' ? 'text-emerald-400' :
          color === 'red' ? 'text-red-400' :
          color === 'blue' ? 'text-cyan-400' : 'text-white'
        }`}>
          {value}
        </h3>
        {subtitle && <p className="text-[10px] text-white/30 font-medium">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-2xl border transition-colors duration-300 ${
        color === 'green' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/30' :
        color === 'red' ? 'bg-red-500/20 border-red-500/30 text-red-400 group-hover:bg-red-500/30' :
        color === 'blue' ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400 group-hover:bg-cyan-500/30' : 
        'bg-white/10 border-white/10 text-white group-hover:bg-white/20'
      }`}>
        <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
    </div>
  </div>
);

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

const parseFixedExpenseNotes = (notes) => {
  if (!notes || typeof notes !== "string") {
    return { notesText: "", fixedAmount: 0 };
  }
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object") {
      return {
        notesText: parsed.text || "",
        fixedAmount: Number(parsed.fixed_amount || 0)
      };
    }
  } catch {
    // Fallback a texto plano
  }
  return { notesText: notes, fixedAmount: 0 };
};

const serializeFixedExpenseNotes = (notesText, fixedAmount) => {
  const cleanNotes = String(notesText || "").trim();
  const amount = Number(fixedAmount || 0);
  if (amount > 0) {
    return JSON.stringify({
      text: cleanNotes,
      fixed_amount: amount
    });
  }
  return cleanNotes;
};

const getExpenseMagnitude = (amount) => Math.abs(Number(amount || 0));

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

const writeLocalFixedExpenses = (rows) => {
  try {
    localStorage.setItem(LOCAL_FIXED_EXPENSES_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    // no-op
  }
};

const normalizeEntityRecord = (payload) => {
  if (!payload) return null;
  if (payload.id || payload._id) return payload;
  if (payload.data && (payload.data.id || payload.data._id)) return payload.data;
  if (Array.isArray(payload.items) && payload.items[0]) return payload.items[0];
  if (Array.isArray(payload.data) && payload.data[0]) return payload.data[0];
  return null;
};

export default function Financial() {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(() => getCachedStatus().isOpen);
  const [currentDrawer, setCurrentDrawer] = useState(() => getCachedStatus().drawer);
  const [showOpenDrawer, setShowOpenDrawer] = useState(false);
  const [showCloseDrawer, setShowCloseDrawer] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [expenseDefaultCategory, setExpenseDefaultCategory] = useState(null);
  const [showTimeTrackingModal, setShowTimeTrackingModal] = useState(false);
  const [activeTab, setActiveTab] = useState("sales");
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [showFixedExpenseDialog, setShowFixedExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [oneTimeExpenses, setOneTimeExpenses] = useState([]);
  const [dateFilter, setDateFilter] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [modalSales, setModalSales] = useState([]);
  const [modalTitle, setModalTitle] = useState("Detalles de Transacciones");
  const [loadError, setLoadError] = useState("");
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showEditExpenseDialog, setShowEditExpenseDialog] = useState(false);
  const [reportsView, setReportsView] = useState("enhanced");

  const isFetching = useRef(false);
  const recentFixedExpenseMutationAt = useRef(0);

  const getEntityDate = (item) => item?.created_date || item?.created_at || item?.updated_date || item?.updated_at || null;
  
  useEffect(() => {
    loadData();
    const unsubscribeCash = subscribeToCashRegister(({ isOpen, drawer }) => {
      setDrawerOpen(!!isOpen);
      setCurrentDrawer(drawer || null);
    });
    checkCashRegisterStatus().catch(() => null);
    
    const handleRefresh = () => {
      if (!isFetching.current) {
        loadData();
      }
    };
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
      handleRefresh();
    };

    const handleExpenseCreated = (event) => {
      const rawExpense = event?.detail;
      if (!rawExpense) return;

      const normalizedExpense = {
        ...rawExpense,
        type: "expense",
        amount: Number(rawExpense.amount || 0),
        created_date: rawExpense.created_date || rawExpense.created_at || new Date().toISOString(),
        _source: rawExpense._source || "transaction"
      };

      setTransactions((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.some((t) => t.id === normalizedExpense.id)) return list;
        return [normalizedExpense, ...list];
      });

      setExpenses((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        if (list.some((e) => e.id === normalizedExpense.id)) return list;
        return [normalizedExpense, ...list];
      });

      setDateFilter("all");
      setActiveTab("expenses");
    };
    
    window.addEventListener("sale-completed", handleSaleCompleted);
    window.addEventListener("drawer-closed", handleRefresh);
    window.addEventListener("drawer-opened", handleRefresh);
    window.addEventListener("expense-created", handleExpenseCreated);

    return () => {
      unsubscribeCash();
      window.removeEventListener("sale-completed", handleSaleCompleted);
      window.removeEventListener("drawer-closed", handleRefresh);
      window.removeEventListener("drawer-opened", handleRefresh);
      window.removeEventListener("expense-created", handleExpenseCreated);
    };
  }, []);

  const loadData = async () => {
    if (isFetching.current) return;
    
    isFetching.current = true;
    setLoading(true);
    setLoadError("");

    try {
      const safeList = async (entity, limit = 500) => {
        try {
          return await entity.list("-created_date", limit);
        } catch {
          return entity.list("-created_at", limit).catch(() => []);
        }
      };

      const [salesData, transactionsData, fixedExpensesData, oneTimeExpensesData, cashMovementsData, cashStatus] = await Promise.all([
        safeList(dataClient.entities.Sale, 500),
        safeList(dataClient.entities.Transaction, 500),
        safeList(dataClient.entities.FixedExpense, 100),
        safeList(dataClient.entities.OneTimeExpense, 100),
        safeList(dataClient.entities.CashDrawerMovement, 500),
        checkCashRegisterStatus().catch(() => getCachedStatus())
      ]);

      const validSales = (salesData || []).filter(s => !s.voided);
      const expenseTransactions = (transactionsData || [])
        .filter(t => t.type === 'expense')
        .map(t => ({ ...t, _source: "transaction" }));

      const drawerExpenses = (cashMovementsData || [])
        .filter(m => m.type === "expense")
        .map(m => ({
          id: `movement-${m.id}`,
          movement_id: m.id,
          type: "expense",
          amount: m.amount || 0,
          description: m.description || m.reference || "Gasto de caja",
          category: "cash_movement",
          payment_method: "cash",
          recorded_by: m.employee || "Sistema",
          created_date: m.created_date || m.created_at || null,
          created_at: m.created_at || m.created_date || null,
          _source: "movement"
        }));

      const normalizeText = (value) => String(value || "").trim().toLowerCase();
      const isDuplicateExpense = (movementExpense) => {
        const movementDate = new Date(getEntityDate(movementExpense) || 0).getTime();
        return expenseTransactions.some((tx) => {
          const txDate = new Date(getEntityDate(tx) || 0).getTime();
          const closeInTime = Number.isFinite(movementDate) && Number.isFinite(txDate) && Math.abs(movementDate - txDate) <= 2 * 60 * 1000;
          return (
            closeInTime &&
            getExpenseMagnitude(tx.amount) === getExpenseMagnitude(movementExpense.amount) &&
            normalizeText(tx.description) === normalizeText(movementExpense.description)
          );
        });
      };

      const mergedExpenses = [
        ...expenseTransactions,
        ...drawerExpenses.filter(m => !isDuplicateExpense(m))
      ].sort((a, b) => {
        const aDate = new Date(getEntityDate(a) || 0).getTime();
        const bDate = new Date(getEntityDate(b) || 0).getTime();
        return bDate - aDate;
      });

      setSales(mergeSales(validSales));
      setTransactions(mergeTransactions(transactionsData || []));
      setExpenses(mergedExpenses);
      setFixedExpenses((prev) => {
        const incoming = fixedExpensesData || [];
        const mutationWasRecent = Date.now() - recentFixedExpenseMutationAt.current < 30000;
        const localRows = readLocalFixedExpenses();
        const merged = [...(Array.isArray(incoming) ? incoming : []), ...localRows];
        const deduped = merged.filter((item, idx, arr) => {
          const id = String(item?.id || item?._id || "");
          if (id) return arr.findIndex((x) => String(x?.id || x?._id || "") === id) === idx;
          const sig = `${String(item?.name || "").trim().toLowerCase()}|${item?.category || ""}|${item?.frequency || ""}|${item?.due_day || ""}`;
          return arr.findIndex((x) => `${String(x?.name || "").trim().toLowerCase()}|${x?.category || ""}|${x?.frequency || ""}|${x?.due_day || ""}` === sig) === idx;
        });
        // Evita que un refetch vacío borre lo recién creado por estado local.
        if ((Array.isArray(incoming) ? incoming.length : 0) === 0 && (prev?.length || 0) > 0 && mutationWasRecent) {
          return prev;
        }
        return deduped;
      });
      setOneTimeExpenses(oneTimeExpensesData || []);

      setDrawerOpen(!!cashStatus?.isOpen);
      setCurrentDrawer(cashStatus?.drawer || null);

    } catch (error) {
      console.error('Error loading data:', error);
      setLoadError("No se pudieron cargar los datos de finanzas. Intenta actualizar.");
      toast.error("Error cargando datos de finanzas");
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  };

  // Función para filtrar por fechas
  const getDateRange = () => {
    const now = new Date();
    let start, end;

    switch (dateFilter) {
      case "all":
        return { start: null, end: null };
      case "today":
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = now;
        break;
      case "month":
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        end = now;
        break;
      case "custom":
        if (customStartDate && customEndDate) {
          start = startOfDay(new Date(customStartDate));
          end = endOfDay(new Date(customEndDate));
        } else {
          start = startOfDay(now);
          end = endOfDay(now);
        }
        break;
      default:
        start = startOfDay(now);
        end = endOfDay(now);
    }

    return { start, end };
  };

  const { start: filterStart, end: filterEnd } = getDateRange();

  const revenueTransactions = transactions.filter(t => {
    if (t.type !== 'revenue') return false;
    if (dateFilter === "all") return true;
    try {
      const entryDate = getEntityDate(t);
      if (!entryDate) return false;
      return isWithinInterval(new Date(entryDate), { start: filterStart, end: filterEnd });
    } catch { return false; }
  });

  const filteredExpenses = expenses.filter(e => {
    if (dateFilter === "all") return true;
    try {
      const entryDate = getEntityDate(e);
      if (!entryDate) return false;
      return isWithinInterval(new Date(entryDate), { start: filterStart, end: filterEnd });
    } catch { return false; }
  });

  const filteredSales = sales.filter(s => {
    if (dateFilter === "all") return true;
    try {
      const entryDate = getEntityDate(s);
      if (!entryDate) return false;
      return isWithinInterval(new Date(entryDate), { start: filterStart, end: filterEnd });
    } catch { return false; }
  });

  const totalRevenue = revenueTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + getExpenseMagnitude(e.amount), 0);
  const netProfit = totalRevenue - totalExpenses;

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const todayRevenue = revenueTransactions.filter(t => {
    try {
      const entryDate = getEntityDate(t);
      if (!entryDate) return false;
      return isWithinInterval(new Date(entryDate), { start: todayStart, end: todayEnd });
    } catch { return false; }
  }).reduce((sum, t) => sum + (t.amount || 0), 0);

  const todayExpenses = expenses.filter(e => {
    try {
      const entryDate = getEntityDate(e);
      if (!entryDate) return false;
      return isWithinInterval(new Date(entryDate), { start: todayStart, end: todayEnd });
    } catch { return false; }
  }).reduce((sum, e) => sum + getExpenseMagnitude(e.amount), 0);

  const todayNetProfit = todayRevenue - todayExpenses;

  const computeSaleProfit = (sale) => {
    const items = Array.isArray(sale?.items) ? sale.items : [];
    return items.reduce((sum, item) => {
      const qty = Number(item?.quantity || 0);
      const total = Number(item?.total || (Number(item?.price || 0) * qty));
      const lineCost = Number(item?.line_cost || (Number(item?.cost || 0) * qty));
      const explicitLineProfit = item?.line_profit;
      const lineProfit = explicitLineProfit != null ? Number(explicitLineProfit || 0) : (total - lineCost);
      return sum + lineProfit;
    }, 0);
  };

  const todaySalesProfit = filteredSales
    .filter(s => {
      try {
        const entryDate = getEntityDate(s);
        if (!entryDate) return false;
        return isWithinInterval(new Date(entryDate), { start: todayStart, end: todayEnd });
      } catch {
        return false;
      }
    })
    .reduce((sum, sale) => sum + computeSaleProfit(sale), 0);

  // Cálculos de ventas con/sin IVU
  const salesWithTax = filteredSales.filter(s => (s.tax_amount || 0) > 0);
  const salesWithoutTax = filteredSales.filter(s => (s.tax_amount || 0) === 0);
  
  const totalSalesWithTax = salesWithTax.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalSalesWithoutTax = salesWithoutTax.reduce((sum, s) => sum + (s.total || 0), 0);

  const openTransactionsModal = (sales, title) => {
    setModalSales(sales);
    setModalTitle(title);
    setShowTransactionsModal(true);
  };

  const dailyAllocations = fixedExpenses.map(expense => {
    const parsedNotes = parseFixedExpenseNotes(expense.notes);
    const fixedAmount = Number(parsedNotes.fixedAmount || 0);
    const percentage = Number(expense.percentage || 0);
    const dailyByAmount = fixedAmount > 0 ? fixedAmount / getFrequencyDivisor(expense.frequency) : 0;
    const allocationBase = Math.max(0, todaySalesProfit);
    const dailyByPercentage = allocationBase > 0 ? (allocationBase * (percentage / 100)) : 0;
    const hasDueDay = Number(expense.due_day || 0) > 0;
    const nextDueDate = hasDueDay ? getNextDueDate(expense.due_day) : null;
    const daysRemaining = nextDueDate ? getDaysUntilDate(nextDueDate) : null;
    const dailyTargetToMeetDueDate = fixedAmount > 0 && daysRemaining ? fixedAmount / daysRemaining : 0;
    const useTargetMode = fixedAmount > 0 && !!daysRemaining;
    const useFixedAmount = fixedAmount > 0 && !useTargetMode;
    const todayAvailable = Math.max(0, todaySalesProfit);
    const suggestedPercentage = useTargetMode && todayAvailable > 0 ? (dailyTargetToMeetDueDate / todayAvailable) * 100 : null;
    const amountToSetAsideToday = useTargetMode
      ? Math.min(todayAvailable, dailyTargetToMeetDueDate)
      : (useFixedAmount ? Math.min(todayAvailable, dailyByAmount) : dailyByPercentage);

    return {
      ...expense,
      notes_text: parsedNotes.notesText,
      fixed_amount: fixedAmount,
      daily_target: useTargetMode ? dailyTargetToMeetDueDate : (useFixedAmount ? dailyByAmount : dailyByPercentage),
      daily_amount: amountToSetAsideToday,
      allocation_mode: useTargetMode ? "target_due_day" : (useFixedAmount ? "amount" : "percentage"),
      actual_percentage: percentage,
      days_remaining: daysRemaining,
      next_due_date: nextDueDate,
      suggested_percentage: suggestedPercentage
    };
  }).sort((a, b) => a.priority - b.priority);

  const paymentMethodIcons = { cash: Wallet, card: CreditCard, ath_movil: Landmark, mixed: DollarSign };

  const handleActionSuccess = (createdItem = null) => {
    setShowOpenDrawer(false);
    setShowCloseDrawer(false);
    setShowExpenseDialog(false);
    setShowFixedExpenseDialog(false);
    setEditingExpense(null);
    setDateFilter("all");

    if (createdItem && createdItem.type === "expense") {
      setTransactions((prev) => [createdItem, ...(prev || [])]);
      setExpenses((prev) => [createdItem, ...(prev || [])]);
      setActiveTab("expenses");
    }

    loadData();
    setTimeout(() => loadData(), 1500);
  };

  const handleSaveFixedExpense = async (expenseData) => {
    try {
      const confirmPersistedFixedExpense = async (fallbackData, expectedId = null) => {
        const list = await dataClient.entities.FixedExpense.list("-created_date", 50).catch(async () =>
          dataClient.entities.FixedExpense.list("-created_at", 50).catch(() => [])
        );
        const rows = Array.isArray(list) ? list : [];

        if (expectedId) {
          const byId = rows.find((item) => String(item?.id || item?._id || "") === String(expectedId));
          if (byId) return byId;
        }

        const now = Date.now();
        return rows.find((item) => {
          const createdRaw = item?.created_date || item?.created_at;
          const createdTs = createdRaw ? new Date(createdRaw).getTime() : 0;
          const withinWindow = Number.isFinite(createdTs) ? Math.abs(now - createdTs) < 120000 : true;
          return (
            withinWindow &&
            String(item?.name || "").trim().toLowerCase() === String(fallbackData?.name || "").trim().toLowerCase() &&
            String(item?.category || "") === String(fallbackData?.category || "") &&
            String(item?.frequency || "") === String(fallbackData?.frequency || "")
          );
        }) || null;
      };

      const percentageValue = parseFloat(expenseData.percentage || 0);
      const fixedAmountValue = parseFloat(expenseData.fixed_amount || 0);
      const dataToSave = {
        name: expenseData.name,
        category: expenseData.category,
        percentage: Number.isFinite(percentageValue) ? percentageValue : 0,
        frequency: expenseData.frequency,
        due_day: expenseData.due_day ? parseInt(expenseData.due_day) : null,
        priority: parseInt(expenseData.priority || 5),
        icon: expenseData.icon || "💰",
        notes: serializeFixedExpenseNotes(expenseData.notes || "", fixedAmountValue),
        active: expenseData.active !== false
      };

      if (editingExpense) {
        recentFixedExpenseMutationAt.current = Date.now();
        const updatedPayload = await dataClient.entities.FixedExpense.update(editingExpense.id, dataToSave);
        const updated = normalizeEntityRecord(updatedPayload) || updatedPayload;
        const updatedId = updated?.id || updated?._id || editingExpense.id;
        const updatedLocal = (updated?.id || updated?._id)
          ? updated
          : (await confirmPersistedFixedExpense(dataToSave, updatedId));
        if (!updatedLocal?.id && !updatedLocal?._id) {
          const localRows = readLocalFixedExpenses();
          const localFallback = { ...editingExpense, ...dataToSave, id: editingExpense.id, _local_only: true, updated_date: new Date().toISOString() };
          writeLocalFixedExpenses([localFallback, ...localRows.filter((r) => String(r?.id || "") !== String(editingExpense.id))]);
          setFixedExpenses((prev) => (prev || []).map((item) => String(item?.id || "") === String(editingExpense.id) ? localFallback : item));
          toast.warning("Guardado local. Pendiente sincronizar con base de datos.");
          window.dispatchEvent(new Event("fixed-expenses-updated"));
          setShowFixedExpenseDialog(false);
          setEditingExpense(null);
          return;
        }
        writeLocalFixedExpenses(readLocalFixedExpenses().filter((r) => String(r?.id || "") !== String(updatedLocal?.id || updatedLocal?._id || "")));
        setFixedExpenses((prev) => (prev || []).map((item) => item.id === editingExpense.id ? updatedLocal : item));
        toast.success("Gasto actualizado");
      } else {
        recentFixedExpenseMutationAt.current = Date.now();
        const createdPayload = await dataClient.entities.FixedExpense.create(dataToSave);
        const created = normalizeEntityRecord(createdPayload) || createdPayload;
        const createdId = created?.id || created?._id || null;
        const createdLocal = createdId ? created : (await confirmPersistedFixedExpense(dataToSave, createdId));
        if (!createdLocal?.id && !createdLocal?._id) {
          const localRow = {
            id: `local-fixed-${Date.now()}`,
            ...dataToSave,
            created_date: new Date().toISOString(),
            _local_only: true
          };
          writeLocalFixedExpenses([localRow, ...readLocalFixedExpenses()]);
          setFixedExpenses((prev) => [localRow, ...(prev || [])]);
          toast.warning("Guardado local. Pendiente sincronizar con base de datos.");
          window.dispatchEvent(new Event("fixed-expenses-updated"));
          setShowFixedExpenseDialog(false);
          setEditingExpense(null);
          return;
        }
        writeLocalFixedExpenses(readLocalFixedExpenses().filter((r) => String(r?.id || "") !== String(createdLocal?.id || createdLocal?._id || "")));
        setFixedExpenses((prev) => [createdLocal, ...(prev || [])]);
        toast.success("Gasto creado");
      }
      window.dispatchEvent(new Event("fixed-expenses-updated"));
      setShowFixedExpenseDialog(false);
      setEditingExpense(null);
      // Evitar que un reload inmediato pise el estado local optimista
      setTimeout(() => loadData(), 1500);
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(`Error: ${error.message || "No se pudo guardar"}`);
    }
  };

  const handleDeleteFixedExpense = async (expenseId) => {
    if (!confirm("¿Eliminar este gasto fijo?")) return;
    try {
      if (String(expenseId || "").startsWith("local-fixed-")) {
        writeLocalFixedExpenses(readLocalFixedExpenses().filter((item) => String(item?.id || "") !== String(expenseId)));
        setFixedExpenses((prev) => (prev || []).filter((item) => String(item?.id || "") !== String(expenseId)));
        window.dispatchEvent(new Event("fixed-expenses-updated"));
        toast.success("Gasto local eliminado");
        return;
      }
      recentFixedExpenseMutationAt.current = Date.now();
      await dataClient.entities.FixedExpense.delete(expenseId);
      setFixedExpenses((prev) => (prev || []).filter((item) => item.id !== expenseId));
      writeLocalFixedExpenses(readLocalFixedExpenses().filter((item) => String(item?.id || "") !== String(expenseId)));
      window.dispatchEvent(new Event("fixed-expenses-updated"));
      toast.success("Gasto eliminado");
      setTimeout(() => loadData(), 2000);
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Error al eliminar");
    }
  };

  const getCategoryIcon = (category) => {
    const icons = { rent: "🏢", utilities: "⚡", payroll: "👥", inventory: "📦", marketing: "📢", insurance: "🛡️", maintenance: "🔧", savings: "💎", taxes: "🧾", other: "📝" };
    return icons[category] || "💰";
  };

  const handleManualRefresh = () => {
    if (loading || isFetching.current) {
      toast.warning("⏳ Ya hay una actualización en curso");
      return;
    }
    toast.info("🔄 Actualizando datos...");
    loadData();
  };

  const handleEditExpense = (expense) => {
    setEditingTransaction(expense);
    setShowEditExpenseDialog(true);
  };

  const handleUpdateExpense = async (expenseData) => {
    if (!editingTransaction?.id) return;
    try {
      await dataClient.entities.Transaction.update(editingTransaction.id, {
        amount: parseFloat(expenseData.amount),
        description: expenseData.description.trim(),
        category: expenseData.category || "other_expense"
      });
      toast.success("Gasto actualizado");
      setShowEditExpenseDialog(false);
      setEditingTransaction(null);
      loadData();
    } catch (error) {
      console.error("Error actualizando gasto:", error);
      toast.error("No se pudo actualizar el gasto");
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!confirm("¿Eliminar este gasto registrado?")) return;
    try {
      await dataClient.entities.Transaction.delete(expenseId);
      toast.success("Gasto eliminado");
      loadData();
    } catch (error) {
      console.error("Error eliminando gasto:", error);
      toast.error("No se pudo eliminar el gasto");
    }
  };

  const exportToCSV = () => {
    try {
      // Calcular detalles avanzados para la exportación
      const totalSalesProfit = filteredSales.reduce((sum, sale) => sum + computeSaleProfit(sale), 0);
      const partsCost = filteredSales.reduce((sum, sale) => {
        const items = Array.isArray(sale?.items) ? sale.items : [];
        return sum + items.reduce((iSum, item) => {
          const qty = Number(item?.quantity || 0);
          return iSum + Number(item?.line_cost || (Number(item?.cost || 0) * qty));
        }, 0);
      }, 0);
      
      const categoryTotals = filteredExpenses.reduce((acc, e) => {
        const cat = e.category || 'other_expense';
        acc[cat] = (acc[cat] || 0) + getExpenseMagnitude(e.amount);
        return acc;
      }, {});

      // Crear CSV detallado
      let csv = "REPORTE FINANCIERO DETALLADO\n\n";
      csv += `Período: ${dateFilter === 'today' ? 'Hoy' : dateFilter === 'week' ? 'Última Semana' : dateFilter === 'month' ? 'Último Mes' : `${customStartDate} a ${customEndDate}`}\n`;
      csv += `Fecha de Exportación: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;

      // Resumen
      csv += "RESUMEN CERTIFICADO\n";
      csv += `Ingresos Totales (Bruto),${totalRevenue.toFixed(2)}\n`;
      csv += `Costo Total de Piezas,${partsCost.toFixed(2)}\n`;
      csv += `Ganancia Real de Ventas,${totalSalesProfit.toFixed(2)}\n`;
      csv += `Gastos Totales,${totalExpenses.toFixed(2)}\n`;
      csv += `Utilidad Neta Final (Ganancia Real - Gastos),${(totalSalesProfit - totalExpenses).toFixed(2)}\n`;
      csv += `Total de Ventas,${filteredSales.length}\n\n`;

      csv += "DESGLOSE DE GASTOS POR CATEGORÍA\n";
      csv += `Nómina (Payroll),${(categoryTotals['payroll'] || 0).toFixed(2)}\n`;
      csv += `Renta (Rent),${(categoryTotals['rent'] || 0).toFixed(2)}\n`;
      csv += `Impuestos (Taxes),${(categoryTotals['taxes'] || 0).toFixed(2)}\n`;
      csv += `Utilidades (Utilities),${(categoryTotals['utilities'] || 0).toFixed(2)}\n`;
      csv += `Inventario/Piezas (Parts),${(categoryTotals['parts'] || 0).toFixed(2)}\n`;
      csv += `Otros Gastos,${(categoryTotals['other_expense'] || 0).toFixed(2)}\n\n`;

      // Ventas detalladas
      csv += "VENTAS DETALLADAS\n";
      csv += "Número de Venta,Fecha,Hora,Cliente,Items,Método de Pago,Subtotal,IVU,Total\n";
      filteredSales.forEach(s => {
        const rowDate = getEntityDate(s);
        const fecha = rowDate ? format(new Date(rowDate), 'dd/MM/yyyy') : "-";
        const hora = rowDate ? format(new Date(rowDate), 'HH:mm:ss') : "-";
        const subtotal = (s.subtotal || 0).toFixed(2);
        const ivu = (s.tax_amount || 0).toFixed(2);
        const total = (s.total || 0).toFixed(2);
        csv += `${s.sale_number},${fecha},${hora},"${s.customer_name || 'Cliente'}",${s.items?.length || 0},${s.payment_method},${subtotal},${ivu},${total}\n`;
      });

      csv += "\n";

      // Gastos detallados
      csv += "GASTOS DETALLADOS\n";
      csv += "Fecha,Hora,Descripción,Categoría,Monto,Registrado Por\n";
      filteredExpenses.forEach(e => {
        const rowDate = getEntityDate(e);
        const fecha = rowDate ? format(new Date(rowDate), 'dd/MM/yyyy') : "-";
        const hora = rowDate ? format(new Date(rowDate), 'HH:mm:ss') : "-";
        csv += `${fecha},${hora},"${e.description || 'Sin descripción'}",${e.category || 'Otro'},${(e.amount || 0).toFixed(2)},"${e.recorded_by || 'Sistema'}"\n`;
      });

      csv += "\n";

      // Desglose por método de pago
      csv += "DESGLOSE POR MÉTODO DE PAGO\n";
      csv += "Método,Cantidad de Transacciones,Total\n";
      const paymentMethods = {};
      filteredSales.forEach(s => {
        const method = s.payment_method || 'sin_definir';
        if (!paymentMethods[method]) {
          paymentMethods[method] = { count: 0, total: 0 };
        }
        paymentMethods[method].count++;
        paymentMethods[method].total += (s.total || 0);
      });
      Object.keys(paymentMethods).forEach(method => {
        csv += `${method},${paymentMethods[method].count},${paymentMethods[method].total.toFixed(2)}\n`;
      });

      // Descargar
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `finanzas_${dateFilter}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("✅ Reporte exportado exitosamente");
    } catch (error) {
      console.error("Error exportando:", error);
      toast.error("❌ Error al exportar el reporte");
    }
  };

  return (
    <div className="min-h-screen bg-black/95 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        <div className="relative overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[40px] p-8 shadow-2xl group">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-600/10 rounded-full blur-[100px] group-hover:bg-cyan-600/20 transition-all duration-700" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/20 transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <DollarSign className="w-10 h-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-black text-white tracking-tighter mb-1">Finanzas</h1>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-sm text-white/40 font-bold uppercase tracking-[0.2em]">Gestión de Capital & Utilidad</p>
                </div>
              </div>
            </div>
            <Button
              onClick={() => navigate(createPageUrl("UsersManagement"))}
              className="w-14 h-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-all hover:scale-110 active:scale-90"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        <ErrorBoundary><AlertasWidget /></ErrorBoundary>

        {loadError && (
          <Card className="bg-red-950/40 border-red-500/40">
            <CardContent className="p-3 sm:p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-red-200">
                <AlertTriangle className="w-4 h-4" />
                <p className="text-xs sm:text-sm">{loadError}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-red-400/40 text-red-200 hover:bg-red-900/30"
                onClick={handleManualRefresh}
              >
                Reintentar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Filtros de Fecha */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center border border-cyan-500/30">
                <Filter className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg tracking-tight">Período de Análisis</h3>
                <p className="text-xs text-white/40 uppercase tracking-widest font-black">Filtrar registros</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-black/40 border border-white/5 rounded-[20px] backdrop-blur-md">
              {[
                { id: "all", label: "Historial" },
                { id: "today", label: "Hoy" },
                { id: "week", label: "Semana" },
                { id: "month", label: "Mes" },
                { id: "custom", label: "Rango" },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setDateFilter(pill.id)}
                  className={`px-5 py-2 rounded-2xl text-xs font-bold transition-all duration-300 ${
                    dateFilter === pill.id
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-600/20 scale-105"
                      : "text-white/40 hover:text-white/70 hover:bg-white/5"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
          
          {dateFilter === "custom" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-white/5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Desde</label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-black/40 border-white/10 text-white h-12 rounded-2xl px-4 focus:border-cyan-500/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Hasta</label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-black/40 border-white/10 text-white h-12 rounded-2xl px-4 focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button 
            onClick={handleManualRefresh} 
            disabled={loading} 
            className="rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white h-12 px-6 transition-all active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="font-bold">Actualizar</span>
          </Button>

          <Button 
            onClick={exportToCSV} 
            className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white h-12 px-6 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="font-bold">Exportar CSV</span>
          </Button>

          <div className="h-8 w-[1px] bg-white/10 mx-2 hidden md:block" />

          <Button 
            onClick={() => setShowTimeTrackingModal(true)} 
            className="rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white h-12 px-6 shadow-lg shadow-teal-900/20 transition-all active:scale-95 group"
          >
            <Wallet className="w-4 h-4 mr-2" />
            <span className="font-bold">Pagar Nómina</span>
          </Button>

          <Button 
            onClick={() => { setExpenseDefaultCategory(null); setShowExpenseDialog(true); }} 
            className="rounded-2xl bg-white/5 border border-orange-500/30 hover:bg-orange-600 hover:border-orange-500 text-white h-12 px-6 transition-all active:scale-95 group"
          >
            <Plus className="w-4 h-4 mr-2 text-orange-400 group-hover:text-white" />
            <span className="font-bold">Nuevo Gasto</span>
          </Button>

          {drawerOpen ? (
            <Button 
              onClick={() => setShowCloseDrawer(true)} 
              className="rounded-2xl bg-red-500/10 border border-red-500/30 hover:bg-red-600 text-red-400 hover:text-white h-12 px-6 transition-all active:scale-95"
            >
              <Wallet className="w-4 h-4 mr-2" />
              <span className="font-bold">Cerrar Caja</span>
            </Button>
          ) : (
            <Button 
              onClick={() => setShowOpenDrawer(true)} 
              className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-600 text-emerald-400 hover:text-white h-12 px-6 transition-all active:scale-95"
            >
              <Wallet className="w-4 h-4 mr-2" />
              <span className="font-bold">Abrir Caja</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard 
            title="Ingresos" 
            value={`$${totalRevenue.toFixed(2)}`} 
            subtitle="Recaudación bruta"
            icon={TrendingUp} 
            color="green"
            onClick={() => openTransactionsModal(filteredSales, "Todas las Transacciones")}
          />
          <StatCard 
            title="Con IVU" 
            value={`$${totalSalesWithTax.toFixed(2)}`} 
            subtitle="Ventas grabadas"
            icon={Receipt} 
            color="blue"
            onClick={() => openTransactionsModal(salesWithTax, "Ventas con IVU")}
          />
          <StatCard 
            title="Sin IVU" 
            value={`$${totalSalesWithoutTax.toFixed(2)}`} 
            subtitle="Ventas exentas"
            icon={Receipt} 
            color="blue"
            onClick={() => openTransactionsModal(salesWithoutTax, "Ventas sin IVU")}
          />
          <StatCard 
            title="IVU" 
            value={`$${filteredSales.reduce((sum, s) => sum + (s.tax_amount || 0), 0).toFixed(2)}`} 
            subtitle="Impuesto total"
            icon={Landmark} 
            color="blue"
            onClick={() => openTransactionsModal(filteredSales, "Desglose de IVU")}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
          <div className="flex justify-center px-4 -mt-4">
            <TabsList className="bg-white/5 border border-white/10 backdrop-blur-xl p-1 rounded-[22px] h-auto flex w-full max-w-[600px] gap-1 shadow-2xl">
              <TabsTrigger 
                value="sales" 
                className="flex-1 rounded-[18px] px-2 sm:px-8 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-600/20 transition-all duration-300"
              >
                <div className="flex items-center gap-2">
                  <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="font-bold text-[11px] sm:text-sm">Ventas</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="allocations" 
                className="flex-1 rounded-[18px] px-2 sm:px-8 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-600/20 transition-all duration-300"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="font-bold text-[11px] sm:text-sm">Distribución</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="expenses" 
                className="flex-1 rounded-[18px] px-2 sm:px-8 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-600/20 transition-all duration-300"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="font-bold text-[11px] sm:text-sm">Gastos</span>
                </div>
              </TabsTrigger>
              <TabsTrigger 
                value="reportes" 
                className="flex-1 rounded-[18px] px-2 sm:px-8 py-2.5 data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-cyan-600/20 transition-all duration-300"
              >
                <div className="flex items-center gap-2">
                  <PieChart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="font-bold text-[11px] sm:text-sm">Informes</span>
                </div>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="sales">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Registro de Ventas</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Transacciones liquidadas</p>
                </div>
                <div className="px-6 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest text-center">Total Periodo</p>
                  <p className="text-2xl font-black text-emerald-400">${totalRevenue.toFixed(2)}</p>
                </div>
              </div>
              <div className="p-4 sm:p-6 lg:p-8">
                {loading ? (
                  <div className="p-20 text-center">
                    <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-cyan-500/50" />
                    <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Sincronizando...</p>
                  </div>
                ) : filteredSales.length === 0 ? (
                  <div className="p-20 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Receipt className="w-10 h-10 text-white/20" />
                    </div>
                    <p className="text-xl font-black text-white/40 tracking-tight">Sin Ventas</p>
                    <p className="text-sm text-white/20">No se encontraron registros en este rango.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredSales.map((s) => {
                      const Icon = paymentMethodIcons[s.payment_method] || DollarSign;
                      return (
                        <div key={s.id} className="group p-5 bg-white/[0.03] hover:bg-white/[0.06] rounded-[24px] border border-white/5 hover:border-white/10 transition-all duration-300">
                          <div className="flex items-center justify-between gap-6">
                            <div className="flex items-center gap-5">
                              <div className="w-12 h-12 rounded-[18px] bg-black/40 border border-white/5 flex items-center justify-center text-white/60 group-hover:text-cyan-400 group-hover:border-cyan-500/30 transition-all">
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-black text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded-lg border border-cyan-400/20 uppercase">#{s.sale_number}</span>
                                  <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                                    {getEntityDate(s) ? format(new Date(getEntityDate(s)), 'dd MMM, HH:mm', { locale: es }) : "-"}
                                  </span>
                                </div>
                                <h4 className="text-white font-bold truncate tracking-tight">{s.customer_name || 'Consumidor Final'}</h4>
                                <p className="text-xs text-white/40 font-medium">{s.items?.length || 0} productos liquidados</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-2xl font-black text-emerald-400 tracking-tighter">${(s.total || 0).toFixed(2)}</p>
                              <div className="flex items-center justify-end gap-1.5 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">Cobrado</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="allocations" className="space-y-6">
            <ErrorBoundary><OneTimeExpensesWidget /></ErrorBoundary>

            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500/10 to-cyan-500/10 border border-white/10 rounded-[32px] p-8 shadow-xl">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-[60px]" />
              
              <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                    <Calendar className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white tracking-tight">Análisis de Utilidad</h3>
                    <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Proyección {format(new Date(), "MMMM yyyy", { locale: es })}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 xs:grid-cols-3 gap-4 flex-1 max-w-2xl">
                  <div className="p-4 bg-white/[0.03] rounded-2xl border border-emerald-500/10">
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1">Ingresos</p>
                    <p className="text-xl font-black text-emerald-400">${todayRevenue.toFixed(2)}</p>
                  </div>
                  <div className="p-4 bg-white/[0.03] rounded-2xl border border-red-500/10">
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1">Egresos</p>
                    <p className="text-xl font-black text-red-400">-${todayExpenses.toFixed(2)}</p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${todayNetProfit >= 0 ? 'bg-cyan-500/10 border-cyan-500/10' : 'bg-red-500/10 border-red-500/10'}`}>
                    <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1">Neto Hoy</p>
                    <p className={`text-xl font-black ${todayNetProfit >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>${todayNetProfit.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            <ErrorBoundary><GastosOperacionalesWidget /></ErrorBoundary>
          </TabsContent>

          <TabsContent value="expenses">
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-white tracking-tight">Talonario de Gastos</h3>
                  <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Resumen de egresos</p>
                </div>
                <div className="px-6 py-2 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
                  <p className="text-[10px] text-red-400 font-black uppercase tracking-widest">Subtotal Salidas</p>
                  <p className="text-2xl font-black text-red-400">-${totalExpenses.toFixed(2)}</p>
                </div>
              </div>
              <div className="p-4 sm:p-6 lg:p-8">
                {loading ? (
                  <div className="p-20 text-center">
                    <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-red-500/50" />
                    <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Cargando egresos...</p>
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <div className="p-20 text-center">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CreditCard className="w-10 h-10 text-white/20" />
                    </div>
                    <p className="text-xl font-black text-white/40 tracking-tight">Todo en Balance</p>
                    <p className="text-sm text-white/20">No se han registrado gastos para este periodo.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredExpenses.map((e) => (
                      <div key={e.id} className="group p-5 bg-white/[0.03] hover:bg-white/[0.06] rounded-[24px] border border-white/5 hover:border-white/10 transition-all duration-300">
                        <div className="flex items-center justify-between gap-6">
                          <div className="flex items-center gap-5">
                            <div className="w-12 h-12 rounded-[18px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                              <Receipt className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-red-400/70 uppercase tracking-widest">{e.category || "Misceláneo"}</span>
                                <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
                                  {getEntityDate(e) ? format(new Date(getEntityDate(e)), 'dd MMM, HH:mm', { locale: es }) : "-"}
                                </span>
                              </div>
                              <h4 className="text-white font-bold truncate tracking-tight">{e.description}</h4>
                              <p className="text-xs text-white/40 font-medium">Registrado por {e.recorded_by || "Sistema"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <p className="text-2xl font-black text-red-400 tracking-tighter">-${getExpenseMagnitude(e.amount).toFixed(2)}</p>
                            {e._source === "transaction" && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="icon"
                                  onClick={() => handleEditExpense(e)}
                                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white/40 hover:text-cyan-400 transition-all"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  onClick={() => handleDeleteExpense(e.id)}
                                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reportes">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={reportsView === "enhanced" ? "default" : "outline"}
                  className={reportsView === "enhanced" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                  onClick={() => setReportsView("enhanced")}
                >
                  Reporte Detallado
                </Button>
                <Button
                  size="sm"
                  variant={reportsView === "classic" ? "default" : "outline"}
                  className={reportsView === "classic" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                  onClick={() => setReportsView("classic")}
                >
                  Reporte Clásico
                </Button>
              </div>

              {reportsView === "enhanced" ? (
                <ErrorBoundary>
                  <EnhancedReports
                    dateFilter={dateFilter}
                    customStartDate={customStartDate}
                    customEndDate={customEndDate}
                  />
                </ErrorBoundary>
              ) : (
                <ReportesFinancieros />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {showOpenDrawer && <OpenDrawerDialog open={showOpenDrawer} onClose={() => setShowOpenDrawer(false)} onSuccess={handleActionSuccess} />}
      {showCloseDrawer && <CloseDrawerDialog open={showCloseDrawer} onClose={() => setShowCloseDrawer(false)} onSuccess={handleActionSuccess} drawer={currentDrawer} />}
      {showExpenseDialog && <ExpenseDialog open={showExpenseDialog} onClose={() => setShowExpenseDialog(false)} onSuccess={handleActionSuccess} drawer={currentDrawer} defaultCategory={expenseDefaultCategory} />}
      {showTimeTrackingModal && (
        <TimeTrackingModal
          open={showTimeTrackingModal}
          onClose={() => {
            setShowTimeTrackingModal(false);
            loadData();
          }}
          session={null}
        />
      )}
      {showEditExpenseDialog && (
        <EditExpenseDialog
          open={showEditExpenseDialog}
          onClose={() => {
            setShowEditExpenseDialog(false);
            setEditingTransaction(null);
          }}
          onSave={handleUpdateExpense}
          expense={editingTransaction}
        />
      )}
      {showFixedExpenseDialog && <FixedExpenseDialog open={showFixedExpenseDialog} onClose={() => { setShowFixedExpenseDialog(false); setEditingExpense(null); }} onSave={handleSaveFixedExpense} expense={editingExpense} />}
      
      <TransactionsModal 
        open={showTransactionsModal} 
        onClose={() => setShowTransactionsModal(false)}
        sales={modalSales}
        title={modalTitle}
      />
    </div>
  );
}

function FixedExpenseDialog({ open, onClose, onSave, expense }) {
  const [formData, setFormData] = useState({
    name: "", category: "other", percentage: "", fixed_amount: "", frequency: "monthly", 
    due_day: "", priority: 5, icon: "💰", notes: "", active: true
  });

  useEffect(() => {
    if (expense) {
      const parsedNotes = parseFixedExpenseNotes(expense.notes);
      setFormData({
        name: expense.name || "", category: expense.category || "other", percentage: expense.percentage || "", fixed_amount: parsedNotes.fixedAmount || "",
        frequency: expense.frequency || "monthly", due_day: expense.due_day || "", priority: expense.priority || 5,
        icon: expense.icon || "💰", notes: parsedNotes.notesText || "", active: expense.active !== false
      });
    } else {
      setFormData({ name: "", category: "other", percentage: "", fixed_amount: "", frequency: "monthly", due_day: "", priority: 5, icon: "💰", notes: "", active: true });
    }
  }, [expense, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      toast.error("Nombre obligatorio");
      return;
    }
    const percentage = parseFloat(formData.percentage || 0);
    const fixedAmount = parseFloat(formData.fixed_amount || 0);
    const hasPercentage = Number.isFinite(percentage) && percentage > 0;
    const hasFixedAmount = Number.isFinite(fixedAmount) && fixedAmount > 0;

    if (!hasPercentage && !hasFixedAmount) {
      toast.error("Ingresa porcentaje o monto fijo");
      return;
    }

    if (hasPercentage && (percentage < 0 || percentage > 100)) {
      toast.error("Porcentaje debe estar entre 0 y 100");
      return;
    }

    if (hasFixedAmount && fixedAmount <= 0) {
      toast.error("Monto fijo debe ser mayor a 0");
      return;
    }
    
    // Validar due_day para frecuencias que lo requieren
    if ((formData.frequency === "monthly" || formData.frequency === "quarterly") && !formData.due_day) {
      toast.error("Día de vencimiento es obligatorio para esta frecuencia");
      return;
    }
    
    // Convertir due_day a número si existe
    const dataToSave = { 
      ...formData, 
      percentage: hasPercentage ? percentage : 0,
      fixed_amount: hasFixedAmount ? fixedAmount : 0,
      due_day: formData.due_day ? parseInt(formData.due_day) : null
    };
    
    await onSave(dataToSave);
  };

  const categories = [
    { value: "rent", label: "Renta", icon: "🏢" }, { value: "utilities", label: "Luz/Agua", icon: "⚡" },
    { value: "payroll", label: "Nómina", icon: "👥" }, { value: "inventory", label: "Inventario", icon: "📦" },
    { value: "savings", label: "Ahorro", icon: "💎" }, { value: "taxes", label: "Impuestos", icon: "🧾" },
    { value: "marketing", label: "Marketing", icon: "📢" }, { value: "insurance", label: "Seguro", icon: "🛡️" },
    { value: "maintenance", label: "Mantenimiento", icon: "🔧" }, { value: "other", label: "Otros", icon: "📝" }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl bg-[#0A0A0A]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl overflow-hidden p-0">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-600 to-blue-600" />
        
        <div className="p-8 sm:p-10">
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <Target className="w-6 h-6 text-cyan-400" />
              </div>
              <DialogTitle className="text-2xl font-black text-white tracking-tight text-left">
                {expense ? "Configurar Distribución" : "Nueva Distribución"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Nombre del Gasto</label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  placeholder="Ej. Renta del Local" 
                  className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-cyan-500/50 transition-all font-bold" 
                  required 
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Categoría</label>
                <div className="grid grid-cols-5 gap-2">
                  {categories.map(cat => (
                    <button 
                      key={cat.value} 
                      type="button" 
                      onClick={() => setFormData({ ...formData, category: cat.value, icon: cat.icon })}
                      className={`group relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-300 ${
                        formData.category === cat.value 
                          ? "bg-cyan-500/20 border-cyan-500/40 shadow-lg shadow-cyan-500/10" 
                          : "bg-white/5 border-white/5 hover:border-white/20"
                      }`}
                    >
                      <span className="text-2xl mb-1 filter drop-shadow-md group-hover:scale-110 transition-transform">{cat.icon}</span>
                      <span className={`text-[9px] font-black uppercase tracking-tight ${formData.category === cat.value ? 'text-cyan-400' : 'text-white/40'}`}>
                        {cat.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Aporte Fijo ($)</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={formData.fixed_amount} 
                    onChange={(e) => setFormData({ ...formData, fixed_amount: e.target.value })} 
                    placeholder="0.00" 
                    className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-cyan-500/50 font-bold" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Utilidad (%)</label>
                  <Input 
                    type="number" 
                    step="0.1" 
                    value={formData.percentage} 
                    onChange={(e) => setFormData({ ...formData, percentage: e.target.value })} 
                    placeholder="0" 
                    className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-cyan-500/50 font-bold" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Frecuencia</label>
                  <select 
                    value={formData.frequency} 
                    onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-2xl h-12 px-5 font-bold focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer"
                  >
                    <option value="daily">Diario</option>
                    <option value="weekly">Semanal</option>
                    <option value="biweekly">Quincenal</option>
                    <option value="monthly">Mensual</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Día de Cobro (1-31)</label>
                  <Input 
                    type="number" 
                    value={formData.due_day} 
                    onChange={(e) => setFormData({ ...formData, due_day: e.target.value })} 
                    placeholder="Ej. 5" 
                    className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-cyan-500/50 font-bold" 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button 
                type="button" 
                onClick={onClose} 
                className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white h-14 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-cyan-600/20 active:scale-95 transition-all"
              >
                {expense ? "Actualizar" : "Confirmar"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditExpenseDialog({ open, onClose, onSave, expense }) {
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    category: "other_expense"
  });

  useEffect(() => {
    if (!open) return;
    setFormData({
      amount: expense?.amount ?? "",
      description: expense?.description || "",
      category: expense?.category || "other_expense"
    });
  }, [open, expense]);

  const categories = [
    { value: "rent", label: "Renta" },
    { value: "utilities", label: "Utilidades" },
    { value: "supplies", label: "Suministros" },
    { value: "payroll", label: "Nómina" },
    { value: "parts", label: "Piezas/Inventario" },
    { value: "maintenance", label: "Mantenimiento" },
    { value: "insurance", label: "Seguros" },
    { value: "taxes", label: "Impuestos" },
    { value: "other_expense", label: "Otros Gastos" }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);

    if (!amount || amount <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Ingresa una descripción");
      return;
    }

    await onSave({
      amount,
      description: formData.description,
      category: formData.category
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#0A0A0A]/95 backdrop-blur-3xl border border-red-500/20 rounded-[32px] shadow-2xl p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 to-orange-600" />
        <div className="p-8">
          <DialogHeader className="mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <Receipt className="w-6 h-6 text-red-400" />
              </div>
              <DialogTitle className="text-2xl font-black text-white tracking-tight text-left">
                Editar Movimiento
              </DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Monto del Gasto ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-red-500/50 font-bold"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Descripción</label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="bg-white/5 border-white/10 text-white h-12 rounded-2xl px-5 focus:border-red-500/50 font-bold"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Categoría</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full bg-white/5 border border-white/10 text-white rounded-2xl h-12 px-5 font-bold focus:outline-none focus:border-red-500/50 appearance-none cursor-pointer"
              >
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" onClick={onClose} className="flex-1 bg-white/5 border border-white/10 text-white h-14 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 text-white h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-900/20 active:scale-95 transition-all">
                Guardar Cambios
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
