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
import AlertasWidget from "../components/financial/AlertasWidget";
import ReportesFinancieros from "../components/financial/ReportesFinancieros";
import EnhancedReports from "../components/financial/EnhancedReports";
import OneTimeExpensesWidget from "../components/financial/OneTimeExpensesWidget";
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

const StatCard = ({ title, value, icon: Icon, color, onClick }) => (
  <Card 
    onClick={onClick}
    className={`bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-600/20 transition-all theme-light:bg-white theme-light:border-gray-200 ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}>
    <CardContent className="p-3 sm:p-4 lg:pt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0">
        <div className="flex-1 w-full">
          <p className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-400 uppercase tracking-wide theme-light:text-gray-600">{title}</p>
          <p className={`text-xl sm:text-2xl lg:text-3xl font-bold mt-1 sm:mt-2 ${
            color === 'green' ? 'text-emerald-400 theme-light:text-emerald-600' :
            color === 'red' ? 'text-red-400 theme-light:text-red-600' :
            color === 'blue' ? 'text-cyan-400 theme-light:text-cyan-600' : 'text-white theme-light:text-gray-900'
          }`}>{value}</p>
        </div>
        <div className={`p-2 sm:p-2.5 lg:p-3 rounded-lg sm:rounded-xl border ${
          color === 'green' ? 'bg-emerald-600/20 border-emerald-500/30 theme-light:bg-emerald-100' :
          color === 'red' ? 'bg-red-600/20 border-red-500/30 theme-light:bg-red-100' :
          color === 'blue' ? 'bg-cyan-600/20 border-cyan-500/30 theme-light:bg-cyan-100' : 'bg-gray-600/20 border-gray-500/30'
        }`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ${
            color === 'green' ? 'text-emerald-400 theme-light:text-emerald-600' :
            color === 'red' ? 'text-red-400 theme-light:text-red-600' :
            color === 'blue' ? 'text-cyan-400 theme-light:text-cyan-600' : 'text-gray-400'
          }`} />
        </div>
      </div>
    </CardContent>
  </Card>
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
      // Crear CSV detallado
      let csv = "REPORTE FINANCIERO DETALLADO\n\n";
      csv += `Período: ${dateFilter === 'today' ? 'Hoy' : dateFilter === 'week' ? 'Última Semana' : dateFilter === 'month' ? 'Último Mes' : `${customStartDate} a ${customEndDate}`}\n`;
      csv += `Fecha de Exportación: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;

      // Resumen
      csv += "RESUMEN\n";
      csv += `Ingresos Totales,${totalRevenue.toFixed(2)}\n`;
      csv += `Gastos Totales,${totalExpenses.toFixed(2)}\n`;
      csv += `Utilidad Neta,${netProfit.toFixed(2)}\n`;
      csv += `Total de Ventas,${filteredSales.length}\n\n`;

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
        
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Finanzas</h1>
                <p className="text-base text-gray-400 font-medium">Control de ingresos y gastos</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(createPageUrl("UsersManagement"))}
              size="icon"
              variant="ghost"
              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/10 theme-light:text-cyan-600"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        <AlertasWidget />

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
        <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/20 theme-light:bg-white">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white theme-light:text-gray-900">Filtrar por Período</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <Button
                onClick={() => setDateFilter("all")}
                variant={dateFilter === "all" ? "default" : "outline"}
                className={dateFilter === "all" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                size="sm"
              >
                Todo
              </Button>
              <Button
                onClick={() => setDateFilter("today")}
                variant={dateFilter === "today" ? "default" : "outline"}
                className={dateFilter === "today" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                size="sm"
              >
                Hoy
              </Button>
              <Button
                onClick={() => setDateFilter("week")}
                variant={dateFilter === "week" ? "default" : "outline"}
                className={dateFilter === "week" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                size="sm"
              >
                Semana
              </Button>
              <Button
                onClick={() => setDateFilter("month")}
                variant={dateFilter === "month" ? "default" : "outline"}
                className={dateFilter === "month" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                size="sm"
              >
                Mes
              </Button>
              <Button
                onClick={() => setDateFilter("custom")}
                variant={dateFilter === "custom" ? "default" : "outline"}
                className={dateFilter === "custom" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                size="sm"
              >
                Personalizado
              </Button>
            </div>
            
            {dateFilter === "custom" && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Desde</label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-black/40 border-cyan-500/20 text-white h-9 text-sm theme-light:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Hasta</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-black/40 border-cyan-500/20 text-white h-9 text-sm theme-light:bg-white"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleManualRefresh} disabled={loading} variant="outline" className="border-cyan-500/20 h-8 sm:h-9 text-xs sm:text-sm theme-light:border-gray-300">
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Actualizar</span>
            <span className="xs:hidden">↻</span>
          </Button>

          <Button onClick={exportToCSV} className="bg-gradient-to-r from-purple-600 to-blue-600 h-8 sm:h-9 text-xs sm:text-sm">
            <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">Exportar</span>
          </Button>

          <Button onClick={() => setShowExpenseDialog(true)} className="bg-orange-600 hover:bg-orange-700 h-8 sm:h-9 text-xs sm:text-sm">
            <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Registrar Gasto</span>
            <span className="sm:hidden">Gasto</span>
          </Button>

          {drawerOpen ? (
            <Button onClick={() => setShowCloseDrawer(true)} className="bg-red-800 hover:bg-red-900 h-8 sm:h-9 text-xs sm:text-sm">
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Cerrar Caja</span>
              <span className="sm:hidden">Cerrar</span>
            </Button>
          ) : (
            <Button onClick={() => setShowOpenDrawer(true)} className="bg-emerald-600 hover:bg-emerald-700 h-8 sm:h-9 text-xs sm:text-sm">
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Abrir Caja</span>
              <span className="sm:hidden">Abrir</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          <StatCard 
            title="Ingresos Totales" 
            value={`$${totalRevenue.toFixed(2)}`} 
            icon={TrendingUp} 
            color="green"
            onClick={() => openTransactionsModal(filteredSales, "Todas las Transacciones")}
          />
          <StatCard 
            title="Ventas con IVU" 
            value={`$${totalSalesWithTax.toFixed(2)}`} 
            icon={Receipt} 
            color="blue"
            onClick={() => openTransactionsModal(salesWithTax, "Ventas con IVU")}
          />
          <StatCard 
            title="Ventas sin IVU" 
            value={`$${totalSalesWithoutTax.toFixed(2)}`} 
            icon={Receipt} 
            color="blue"
            onClick={() => openTransactionsModal(salesWithoutTax, "Ventas sin IVU")}
          />
          <StatCard 
            title="IVU Recaudado" 
            value={`$${filteredSales.reduce((sum, s) => sum + (s.tax_amount || 0), 0).toFixed(2)}`} 
            icon={Landmark} 
            color="blue"
            onClick={() => openTransactionsModal(filteredSales, "Desglose de IVU")}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-black/40 border border-cyan-500/20 backdrop-blur-xl w-full grid grid-cols-2 sm:grid-cols-4 gap-0.5 sm:gap-1 p-0.5 sm:p-1 theme-light:bg-white">
            <TabsTrigger value="sales" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white text-[10px] sm:text-xs lg:text-sm px-1 sm:px-2 py-1.5 sm:py-2">
              <span className="hidden sm:inline">💵 Ventas</span>
              <span className="sm:hidden">💵</span>
            </TabsTrigger>
            <TabsTrigger value="allocations" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white text-[10px] sm:text-xs lg:text-sm px-1 sm:px-2 py-1.5 sm:py-2">
              <span className="hidden sm:inline">💰 Gastos Fijos</span>
              <span className="sm:hidden">💰</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white text-[10px] sm:text-xs lg:text-sm px-1 sm:px-2 py-1.5 sm:py-2">
              <span className="hidden sm:inline">💸 Gastos</span>
              <span className="sm:hidden">💸</span>
            </TabsTrigger>
            <TabsTrigger value="reportes" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white text-[10px] sm:text-xs lg:text-sm px-1 sm:px-2 py-1.5 sm:py-2">
              <span className="hidden sm:inline">📊 Reportes</span>
              <span className="sm:hidden">📊</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/20 theme-light:bg-white">
              <CardHeader className="p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-white flex items-center justify-between text-base sm:text-lg lg:text-xl theme-light:text-gray-900">
                  <span>💵 Ventas</span>
                  <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/30 theme-light:bg-emerald-100 text-xs sm:text-sm">${totalRevenue.toFixed(2)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                {loading ? (
                  <div className="p-8 sm:p-12 text-center">
                    <RefreshCw className="w-10 h-10 sm:w-12 sm:h-12 animate-spin mx-auto mb-4 text-cyan-500" />
                    <p className="text-gray-400 text-sm sm:text-base">Cargando...</p>
                  </div>
                ) : filteredSales.length === 0 ? (
                  <div className="p-8 sm:p-12 text-center">
                    <Receipt className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-lg sm:text-xl font-bold text-gray-400">No hay ventas en este período</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
                    {filteredSales.map((s) => {
                      const Icon = paymentMethodIcons[s.payment_method] || DollarSign;
                      return (
                        <div key={s.id} className="p-3 sm:p-4 bg-black/30 rounded-lg sm:rounded-xl border border-cyan-500/10 theme-light:bg-gray-50">
                          <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-3 mb-1 sm:mb-2 flex-wrap">
                                <Badge className="bg-cyan-600/20 text-cyan-300 font-mono text-[10px] sm:text-xs theme-light:bg-cyan-100">{s.sale_number}</Badge>
                                <Badge variant="outline" className="capitalize flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs">
                                  <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  <span className="hidden xs:inline">{s.payment_method === 'ath_movil' ? 'ATH' : s.payment_method}</span>
                                </Badge>
                              </div>
                              <p className="text-white text-xs sm:text-sm truncate theme-light:text-gray-900">{s.customer_name || 'Cliente'} • {s.items?.length || 0} items</p>
                              <p className="text-gray-500 text-[10px] sm:text-xs">
                                {getEntityDate(s) ? format(new Date(getEntityDate(s)), 'dd/MM/yyyy HH:mm') : "-"}
                              </p>
                            </div>
                            <p className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-400 theme-light:text-emerald-600 whitespace-nowrap">${(s.total || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocations" className="space-y-3 sm:space-y-4 lg:space-y-6">
            <OneTimeExpensesWidget />

            <div className="bg-gradient-to-br from-cyan-600/20 to-emerald-600/20 border-2 border-cyan-500/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 theme-light:bg-white">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                <div>
                  <h3 className="text-white font-bold text-sm sm:text-base lg:text-xl theme-light:text-gray-900">Utilidad de Hoy: {format(new Date(), "dd 'de' MMMM", { locale: es })}</h3>
                  <p className="text-gray-400 text-[10px] sm:text-xs lg:text-sm theme-light:text-gray-600">Los % se calculan sobre esta ganancia</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                <div className="bg-black/30 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-emerald-500/20 theme-light:bg-emerald-50">
                  <p className="text-xs sm:text-sm text-emerald-200 mb-1 theme-light:text-emerald-700">💵 Ingresos de Hoy</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-400 theme-light:text-emerald-600">${todayRevenue.toFixed(2)}</p>
                  <p className="text-[10px] sm:text-xs text-emerald-200/80 theme-light:text-emerald-700">Ganancia de ventas base: ${todaySalesProfit.toFixed(2)}</p>
                </div>
                <div className="bg-black/30 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-red-500/20 theme-light:bg-red-50">
                  <p className="text-xs sm:text-sm text-red-200 mb-1 theme-light:text-red-700">💸 Gastos de Hoy</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-black text-red-400 theme-light:text-red-600">${todayExpenses.toFixed(2)}</p>
                </div>
                <div className="bg-black/30 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-cyan-500/20 theme-light:bg-cyan-50">
                  <p className="text-xs sm:text-sm text-cyan-200 mb-1 theme-light:text-cyan-700">✨ Utilidad de Hoy</p>
                  <p className={`text-xl sm:text-2xl lg:text-3xl font-black ${todayNetProfit >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>${todayNetProfit.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => { setEditingExpense(null); setShowFixedExpenseDialog(true); }} className="bg-gradient-to-r from-cyan-600 to-emerald-700 h-8 sm:h-9 text-xs sm:text-sm">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Añadir Gasto Fijo</span>
                <span className="sm:hidden">Añadir</span>
              </Button>
            </div>

            <div className="space-y-2 sm:space-y-3 lg:space-y-4">
              {fixedExpenses.length === 0 ? (
                <Card className="bg-gradient-to-br from-amber-600/10 to-amber-800/10 border-amber-500/20 theme-light:bg-white">
                  <CardContent className="p-8 sm:p-12 text-center">
                    <PieChart className="w-16 h-16 sm:w-20 sm:h-20 text-amber-400 mx-auto mb-4" />
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 theme-light:text-gray-900">No hay gastos fijos</h3>
                    <Button onClick={() => setShowFixedExpenseDialog(true)} className="bg-gradient-to-r from-cyan-600 to-emerald-700 mt-4 text-sm sm:text-base">
                      <Plus className="w-4 h-4 mr-2" />Crear Primer Gasto
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                dailyAllocations.map((allocation) => (
                  <Card key={allocation.id} className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-cyan-500/20 theme-light:bg-white">
                    <CardContent className="p-3 sm:p-4 lg:p-5">
                      <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 flex-wrap">
                        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-600/30 to-emerald-600/30 flex items-center justify-center text-2xl sm:text-3xl border border-cyan-500/30 flex-shrink-0">
                            {allocation.icon || getCategoryIcon(allocation.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white truncate theme-light:text-gray-900">{allocation.name}</h3>
                            {allocation.allocation_mode === "target_due_day" ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge className="bg-emerald-600/30 text-emerald-200 font-mono text-[10px] sm:text-xs theme-light:bg-emerald-100">
                                  Meta ${allocation.fixed_amount.toFixed(2)} para día {allocation.due_day}
                                </Badge>
                                <Badge className="bg-amber-600/30 text-amber-200 font-mono text-[10px] sm:text-xs theme-light:bg-amber-100">
                                  {allocation.days_remaining} días restantes
                                </Badge>
                                {Number.isFinite(allocation.suggested_percentage) && (
                                  <Badge className="bg-cyan-600/30 text-cyan-200 font-mono text-[10px] sm:text-xs theme-light:bg-cyan-100">
                                    Sugerido hoy: {allocation.suggested_percentage.toFixed(1)}% de utilidad
                                  </Badge>
                                )}
                              </div>
                            ) : allocation.allocation_mode === "amount" ? (
                              <Badge className="bg-emerald-600/30 text-emerald-200 font-mono text-[10px] sm:text-xs theme-light:bg-emerald-100">
                                ${allocation.fixed_amount.toFixed(2)} / {allocation.frequency}
                              </Badge>
                            ) : (
                              <Badge className="bg-cyan-600/30 text-cyan-200 font-mono text-[10px] sm:text-xs theme-light:bg-cyan-100">
                                {allocation.actual_percentage}%
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-right order-3 sm:order-2 w-full sm:w-auto">
                          <p className="text-[10px] sm:text-xs lg:text-sm text-gray-400">
                            {allocation.allocation_mode === "target_due_day" ? "Apartar hoy (meta)" : "Apartar hoy"}
                          </p>
                          <p className="text-2xl sm:text-2xl lg:text-3xl font-black text-emerald-400 theme-light:text-emerald-600">${allocation.daily_amount.toFixed(2)}</p>
                          {allocation.allocation_mode === "target_due_day" && (
                            <p className="text-[10px] sm:text-xs text-gray-500">
                              Objetivo diario: ${allocation.daily_target.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 order-2 sm:order-3">
                          <Button size="icon" variant="ghost" onClick={() => { setEditingExpense(allocation); setShowFixedExpenseDialog(true); }} className="text-cyan-400 hover:bg-cyan-600/20 h-8 w-8 sm:h-9 sm:w-9">
                            <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteFixedExpense(allocation.id)} className="text-red-400 hover:bg-red-600/20 h-8 w-8 sm:h-9 sm:w-9">
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="expenses">
            <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/20 theme-light:bg-white">
              <CardHeader className="p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-white text-base sm:text-lg lg:text-xl theme-light:text-gray-900">Gastos Registrados</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                {loading ? (
                  <div className="p-8 sm:p-12 text-center">
                    <RefreshCw className="w-10 h-10 sm:w-12 sm:h-12 animate-spin mx-auto mb-4 text-cyan-500" />
                    <p className="text-gray-400 text-sm sm:text-base">Cargando gastos...</p>
                  </div>
                ) : filteredExpenses.length === 0 ? (
                  <p className="text-gray-500 text-center py-6 sm:py-8 text-sm sm:text-base">No hay gastos en este período</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
                    {filteredExpenses.map((e) => (
                      <div key={e.id} className="p-3 bg-black/30 rounded-lg border border-red-500/10 theme-light:bg-gray-50">
                        <div className="flex justify-between gap-3 flex-wrap sm:flex-nowrap">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs sm:text-sm truncate theme-light:text-gray-900">{e.description}</p>
                            <p className="text-gray-500 text-[10px] sm:text-xs">
                              {getEntityDate(e) ? format(new Date(getEntityDate(e)), 'dd/MM/yyyy HH:mm') : "-"} • {e.category || "other_expense"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-red-400 font-bold text-lg sm:text-xl theme-light:text-red-600 whitespace-nowrap">-${getExpenseMagnitude(e.amount).toFixed(2)}</p>
                            {e._source === "transaction" ? (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEditExpense(e)}
                                  className="text-cyan-400 hover:bg-cyan-600/20 h-8 w-8"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleDeleteExpense(e.id)}
                                  className="text-red-400 hover:bg-red-600/20 h-8 w-8"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            ) : (
                              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                                Caja
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
                <EnhancedReports
                  dateFilter={dateFilter}
                  customStartDate={customStartDate}
                  customEndDate={customEndDate}
                />
              ) : (
                <ReportesFinancieros />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {showOpenDrawer && <OpenDrawerDialog open={showOpenDrawer} onClose={() => setShowOpenDrawer(false)} onSuccess={handleActionSuccess} />}
      {showCloseDrawer && <CloseDrawerDialog open={showCloseDrawer} onClose={() => setShowCloseDrawer(false)} onSuccess={handleActionSuccess} drawer={currentDrawer} />}
      {showExpenseDialog && <ExpenseDialog open={showExpenseDialog} onClose={() => setShowExpenseDialog(false)} onSuccess={handleActionSuccess} drawer={currentDrawer} />}
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
      <DialogContent className="max-w-[95vw] sm:max-w-2xl bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/30 max-h-[90vh] overflow-y-auto theme-light:bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-white flex items-center gap-2 theme-light:text-gray-900">
            <Target className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-500" />
            {expense ? "Editar Gasto Fijo" : "Nuevo Gasto Fijo"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 mt-2 sm:mt-4">
          <div>
            <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">Nombre *</label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Renta, Luz, Nómina" className="bg-black/40 border-cyan-500/20 text-white h-10 sm:h-11 theme-light:bg-white theme-light:text-gray-900" required />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">Categoría</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
              {categories.map(cat => (
                <button key={cat.value} type="button" onClick={() => setFormData({ ...formData, category: cat.value, icon: cat.icon })}
                  className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all ${formData.category === cat.value ? "bg-gradient-to-br from-cyan-600/80 to-emerald-800/80 border-cyan-300/50 scale-105" : "bg-black/30 border-white/10 hover:border-cyan-500/30"}`}>
                  <div className="text-xl sm:text-2xl mb-0.5 sm:mb-1">{cat.icon}</div>
                  <div className="text-[9px] sm:text-xs font-medium text-white">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">Porcentaje (%)</label>
              <Input type="number" step="0.1" min="0" max="100" value={formData.percentage} onChange={(e) => setFormData({ ...formData, percentage: e.target.value })} placeholder="30" className="bg-black/40 border-cyan-500/20 text-white h-11 sm:h-12 theme-light:bg-white theme-light:text-gray-900" />
            </div>
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">Monto fijo</label>
              <Input type="number" step="0.01" min="0" value={formData.fixed_amount} onChange={(e) => setFormData({ ...formData, fixed_amount: e.target.value })} placeholder="Ej. 1500" className="bg-black/40 border-emerald-500/20 text-white h-11 sm:h-12 theme-light:bg-white theme-light:text-gray-900" />
            </div>
          </div>
          <p className="text-[11px] text-gray-500">Puedes usar porcentaje, monto fijo o ambos. Si hay monto fijo, el cálculo diario usa ese monto según la frecuencia.</p>

            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">Frecuencia</label>
              <select 
              value={formData.frequency} 
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full bg-black/40 border border-cyan-500/20 text-white rounded-lg h-11 px-3 theme-light:bg-white theme-light:text-gray-900 theme-light:border-gray-300"
              >
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>
          </div>

          {(formData.frequency === "monthly" || formData.frequency === "quarterly" || parseFloat(formData.fixed_amount || 0) > 0) && (
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">
                Día de vencimiento (1-31)
              </label>
              <Input 
                type="number" 
                min="1" 
                max="31" 
                value={formData.due_day} 
                onChange={(e) => setFormData({ ...formData, due_day: e.target.value })} 
                placeholder="Ej. 5 para día 5 de cada mes" 
                className="bg-black/40 border-cyan-500/20 text-white h-11 theme-light:bg-white theme-light:text-gray-900" 
              />
              <p className="text-xs text-gray-500 mt-1">
                Si defines monto fijo, se usa para calcular cuánto apartar cada día hasta este vencimiento.
              </p>
            </div>
          )}

          <div className="flex gap-2 sm:gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/15 h-10 sm:h-11 text-sm">Cancelar</Button>
            <Button type="submit" className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-700 h-10 sm:h-11 text-sm">
              <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />{expense ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </form>
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
      <DialogContent className="max-w-md bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Editar Gasto
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block">
              Monto *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="bg-black border-gray-700 text-white"
              required
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block">
              Descripción *
            </label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="bg-black border-gray-700 text-white"
              required
            />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block">
              Categoría *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full bg-black border border-gray-700 text-white rounded-md h-10 px-3"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-gray-700">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-700">
              Guardar cambios
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
