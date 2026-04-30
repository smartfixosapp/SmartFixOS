import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { dataClient } from "@/components/api/dataClient";
import { base44 } from "@/api/base44Client";
// IA removida del hook financiero — solo vive en Órdenes de Compra.
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { toast } from "sonner";
import {
  getCachedStatus,
  subscribeToCashRegister,
  checkCashRegisterStatus
} from "@/components/cash/CashRegisterService";
import { mergeSales, mergeTransactions, upsertLocalSale, upsertLocalTransactions } from "@/components/utils/localFinancialCache";
import { loadSuppliersSafe } from "@/components/utils/suppliers";

// ── Utility functions ────────────────────────────────────────────

const getFrequencyDivisor = (frequency) => {
  const divisors = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, yearly: 365 };
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
  return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
};

export const parseFixedExpenseNotes = (notes) => {
  if (!notes || typeof notes !== "string") return { notesText: "", fixedAmount: 0 };
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object") return { notesText: parsed.text || "", fixedAmount: Number(parsed.fixed_amount || 0) };
  } catch { /* plain text */ }
  return { notesText: notes, fixedAmount: 0 };
};

export const serializeFixedExpenseNotes = (notesText, fixedAmount) => {
  const clean = String(notesText || "").trim();
  const amount = Number(fixedAmount || 0);
  if (amount > 0) return JSON.stringify({ text: clean, fixed_amount: amount });
  return clean;
};

export const getExpenseMagnitude = (amount) => Math.abs(Number(amount || 0));
export const getEntityDate = (item) => item?.created_date || item?.created_at || item?.updated_date || item?.updated_at || null;

export const computeSaleProfit = (sale) => {
  const items = Array.isArray(sale?.items) ? sale.items : [];
  return items.reduce((sum, item) => {
    const qty = Number(item?.quantity || 0);
    const total = Number(item?.total || (Number(item?.price || 0) * qty));
    const lineCost = Number(item?.line_cost || (Number(item?.cost || 0) * qty));
    const lineProfit = item?.line_profit != null ? Number(item.line_profit || 0) : (total - lineCost);
    return sum + lineProfit;
  }, 0);
};

export const CATEGORY_LABELS = {
  rent: "Renta", utilities: "Utilidades", supplies: "Suministros",
  payroll: "Nómina", parts: "Piezas", maintenance: "Mantenimiento",
  insurance: "Seguros", taxes: "Impuestos", other_expense: "Otros Gastos",
  repair_payment: "Cobro de Reparación", refund: "Devolución",
  cash_movement: "Movimiento de Caja"
};

const LOCAL_FIXED_EXPENSES_KEY = "smartfix_local_fixed_expenses";
const readLocalFixedExpenses = () => {
  try {
    const raw = localStorage.getItem(LOCAL_FIXED_EXPENSES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};
const writeLocalFixedExpenses = (rows) => {
  try { localStorage.setItem(LOCAL_FIXED_EXPENSES_KEY, JSON.stringify(Array.isArray(rows) ? rows : [])); } catch { /* */ }
};

const normalizeEntityRecord = (payload) => {
  if (!payload) return null;
  if (payload.id || payload._id) return payload;
  if (payload.data && (payload.data.id || payload.data._id)) return payload.data;
  if (Array.isArray(payload.items) && payload.items[0]) return payload.items[0];
  if (Array.isArray(payload.data) && payload.data[0]) return payload.data[0];
  return null;
};

// ── Main Hook ────────────────────────────────────────────────────

export default function useFinancialData() {
  const [sales, setSales] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(() => getCachedStatus().isOpen);
  const [currentDrawer, setCurrentDrawer] = useState(() => getCachedStatus().drawer);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [oneTimeExpenses, setOneTimeExpenses] = useState([]);
  const [loadError, setLoadError] = useState("");

  // Filters
  const [dateFilter, setDateFilter] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [movFilter, setMovFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("resumen");

  // Purchase orders
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [poProducts, setPoProducts] = useState([]);
  const [poWorkOrders, setPoWorkOrders] = useState([]);
  const [customersList, setCustomersList] = useState([]);

  // AI
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const isFetching = useRef(false);
  const recentFixedExpenseMutationAt = useRef(0);

  // ── Date range ──────────────────────────────────────────────────

  const getDateRange = useCallback(() => {
    const now = new Date();
    let start, end;
    switch (dateFilter) {
      case "all": return { start: null, end: null };
      case "today": start = startOfDay(now); end = endOfDay(now); break;
      case "week": start = new Date(now); start.setDate(now.getDate() - 7); end = now; break;
      case "month": start = new Date(now); start.setMonth(now.getMonth() - 1); end = now; break;
      case "custom":
        if (customStartDate && customEndDate) { start = startOfDay(new Date(customStartDate)); end = endOfDay(new Date(customEndDate)); }
        else { start = startOfDay(now); end = endOfDay(now); }
        break;
      default: start = startOfDay(now); end = endOfDay(now);
    }
    return { start, end };
  }, [dateFilter, customStartDate, customEndDate]);

  const { start: filterStart, end: filterEnd } = getDateRange();

  // ── Filtered data ───────────────────────────────────────────────

  const revenueTransactions = useMemo(() => transactions.filter(t => {
    if (t.type !== 'revenue') return false;
    if (dateFilter === "all") return true;
    try {
      const d = getEntityDate(t);
      if (!d) return false;
      return isWithinInterval(new Date(d), { start: filterStart, end: filterEnd });
    } catch { return false; }
  }), [transactions, dateFilter, filterStart, filterEnd]);

  const filteredExpenses = useMemo(() => expenses.filter(e => {
    if (dateFilter === "all") return true;
    try {
      const d = getEntityDate(e);
      if (!d) return false;
      return isWithinInterval(new Date(d), { start: filterStart, end: filterEnd });
    } catch { return false; }
  }), [expenses, dateFilter, filterStart, filterEnd]);

  const filteredSales = useMemo(() => sales.filter(s => {
    if (dateFilter === "all") return true;
    try {
      const d = getEntityDate(s);
      if (!d) return false;
      return isWithinInterval(new Date(d), { start: filterStart, end: filterEnd });
    } catch { return false; }
  }), [sales, dateFilter, filterStart, filterEnd]);

  // ── Computed values ─────────────────────────────────────────────

  const totalRevenue = useMemo(() => revenueTransactions.reduce((s, t) => s + (t.amount || 0), 0), [revenueTransactions]);
  const totalExpenses = useMemo(() => filteredExpenses.reduce((s, e) => s + getExpenseMagnitude(e.amount), 0), [filteredExpenses]);
  const netProfit = totalRevenue - totalExpenses;

  const unsettledExpenses = useMemo(() => (expenses || []).filter(e => e?.is_settled === false && !e?.is_deleted), [expenses]);
  const unsettledTotal = useMemo(() => unsettledExpenses.reduce((s, e) => s + getExpenseMagnitude(e.amount), 0), [unsettledExpenses]);
  const settledExpensesTotal = useMemo(() =>
    filteredExpenses.filter(e => e?.is_settled !== false).reduce((s, e) => s + getExpenseMagnitude(e.amount), 0),
  [filteredExpenses]);

  const totalIVU = useMemo(() => filteredSales.reduce((s, sale) => s + Number(sale.tax_amount || 0), 0), [filteredSales]);
  const totalPartsCost = useMemo(() => filteredSales.reduce((sum, sale) => {
    const items = Array.isArray(sale?.items) ? sale.items : [];
    return sum + items.reduce((s, item) => {
      const qty = Number(item?.quantity || 0);
      return s + Number(item?.line_cost || (Number(item?.cost || 0) * qty));
    }, 0);
  }, 0), [filteredSales]);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const todayRevenue = useMemo(() => revenueTransactions.filter(t => {
    try {
      const d = getEntityDate(t);
      if (!d) return false;
      return isWithinInterval(new Date(d), { start: todayStart, end: todayEnd });
    } catch { return false; }
  }).reduce((s, t) => s + (t.amount || 0), 0), [revenueTransactions]);

  const todayExpenses = useMemo(() => expenses.filter(e => {
    try {
      const d = getEntityDate(e);
      if (!d) return false;
      return isWithinInterval(new Date(d), { start: todayStart, end: todayEnd });
    } catch { return false; }
  }).reduce((s, e) => s + getExpenseMagnitude(e.amount), 0), [expenses]);

  const todaySalesProfit = useMemo(() =>
    filteredSales.filter(s => {
      try {
        const d = getEntityDate(s);
        if (!d) return false;
        return isWithinInterval(new Date(d), { start: todayStart, end: todayEnd });
      } catch { return false; }
    }).reduce((sum, sale) => sum + computeSaleProfit(sale), 0),
  [filteredSales]);

  const paymentMethodBreakdown = useMemo(() => {
    const methods = {
      cash:      { label: "Efectivo",  emoji: "💵", colorBar: "bg-emerald-500", colorText: "text-emerald-400", colorBg: "bg-emerald-500/10 border-emerald-500/20", total: 0, count: 0 },
      card:      { label: "Tarjeta",   emoji: "💳", colorBar: "bg-blue-500",    colorText: "text-blue-400",    colorBg: "bg-blue-500/10 border-blue-500/20",       total: 0, count: 0 },
      ath_movil: { label: "ATH Móvil", emoji: "📱", colorBar: "bg-purple-500",  colorText: "text-purple-400",  colorBg: "bg-purple-500/10 border-purple-500/20",   total: 0, count: 0 },
      mixed:     { label: "Mixto",     emoji: "🔀", colorBar: "bg-amber-500",   colorText: "text-amber-400",   colorBg: "bg-amber-500/10 border-amber-500/20",     total: 0, count: 0 },
      other:     { label: "Otro",      emoji: "🏦", colorBar: "bg-slate-500",   colorText: "text-slate-400",   colorBg: "bg-slate-500/10 border-slate-500/20",     total: 0, count: 0 },
    };
    (filteredSales || []).forEach(s => {
      const m = s.payment_method || "other";
      const key = methods[m] ? m : "other";
      methods[key].total += Number(s.total || 0);
      methods[key].count += 1;
    });
    const grandTotal = Object.values(methods).reduce((sum, m) => sum + m.total, 0) || 1;
    return Object.entries(methods)
      .map(([key, m]) => ({ key, ...m, pct: grandTotal > 0 ? ((m.total / grandTotal) * 100) : 0 }))
      .filter(m => m.count > 0)
      .sort((a, b) => b.total - a.total);
  }, [filteredSales]);

  const combinedMovements = useMemo(() => {
    const income = (filteredSales || []).map(s => ({
      id: `sale-${s.id}`, kind: "income", date: getEntityDate(s),
      title: s.customer_name || "Consumidor Final",
      subtitle: `#${s.sale_number || '---'} · ${s.items?.length || 0} artículo${(s.items?.length || 0) !== 1 ? 's' : ''}`,
      amount: s.total || 0, method: s.payment_method, raw: s, canEdit: false
    }));
    const expns = (filteredExpenses || []).map(e => {
      const poRef = e.order_number && String(e.order_number).startsWith("PO-")
        ? purchaseOrders.find((po) => po.po_number === e.order_number) : null;
      return {
        id: `expense-${e.id}`, kind: "expense", date: getEntityDate(e),
        title: e.description || "Gasto",
        subtitle: CATEGORY_LABELS[e.category] || e.category || "Misceláneo",
        amount: getExpenseMagnitude(e.amount), method: e.payment_method || "cash",
        raw: e, canEdit: e._source === "transaction", origId: e.id, linkedPO: poRef || null,
      };
    });
    return [...income, ...expns].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });
  }, [filteredSales, filteredExpenses, purchaseOrders]);

  const dailyAllocations = useMemo(() => fixedExpenses.map(expense => {
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
      ...expense, notes_text: parsedNotes.notesText, fixed_amount: fixedAmount,
      daily_target: useTargetMode ? dailyTargetToMeetDueDate : (useFixedAmount ? dailyByAmount : dailyByPercentage),
      daily_amount: amountToSetAsideToday,
      allocation_mode: useTargetMode ? "target_due_day" : (useFixedAmount ? "amount" : "percentage"),
      actual_percentage: percentage, days_remaining: daysRemaining,
      next_due_date: nextDueDate, suggested_percentage: suggestedPercentage
    };
  }).sort((a, b) => a.priority - b.priority), [fixedExpenses, todaySalesProfit]);

  // ── Data loading ────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (isFetching.current) return;
    isFetching.current = true;
    setLoading(true);
    setLoadError("");

    try {
      const safeList = async (entity, limit = 500) => {
        try { return await entity.list("-created_date", limit); }
        catch { return entity.list("-created_at", limit).catch(() => []); }
      };

      const [
        salesData, transactionsData, fixedExpensesData, oneTimeExpensesData,
        cashMovementsData, cashStatus, purchaseOrdersData, suppliersData, productsData, workOrdersData
      ] = await Promise.all([
        safeList(dataClient.entities.Sale, 500),
        safeList(dataClient.entities.Transaction, 500),
        safeList(dataClient.entities.FixedExpense, 100),
        safeList(dataClient.entities.OneTimeExpense, 100),
        safeList(dataClient.entities.CashDrawerMovement, 500),
        checkCashRegisterStatus().catch(() => getCachedStatus()),
        (dataClient.entities.PurchaseOrder?.list
          ? dataClient.entities.PurchaseOrder.list("-created_date", 200).catch(() =>
              dataClient.entities.PurchaseOrder.list("-created_at", 200).catch(() => []))
          : Promise.resolve([])),
        loadSuppliersSafe().catch(() => []),
        (dataClient.entities.Product?.list
          ? dataClient.entities.Product.list("-created_date", 500).catch(() => [])
          : Promise.resolve([])),
        (dataClient.entities.Order?.list
          ? dataClient.entities.Order.list("-created_date", 200).catch(() => [])
          : Promise.resolve([]))
      ]);

      setPurchaseOrders(Array.isArray(purchaseOrdersData) ? purchaseOrdersData : []);
      setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
      setPoProducts(Array.isArray(productsData) ? productsData : []);
      setPoWorkOrders(Array.isArray(workOrdersData) ? workOrdersData : []);

      try {
        const customersData = dataClient.entities.Customer?.list
          ? await dataClient.entities.Customer.list("-created_date", 500).catch(() => []) : [];
        setCustomersList(Array.isArray(customersData) ? customersData : []);
      } catch { /* */ }

      // Overdue PO notifications
      try {
        const todayKey = new Date().toISOString().slice(0, 10);
        const notifyKey = `po_overdue_notify_${todayKey}`;
        const alreadyNotified = JSON.parse(localStorage.getItem(notifyKey) || "[]");
        const overdueNew = (purchaseOrdersData || []).filter((po) => {
          if (!po.expected_date) return false;
          if (["received", "cancelled"].includes(po.status)) return false;
          if (String(po.expected_date).slice(0, 10) >= todayKey) return false;
          return !alreadyNotified.includes(po.id);
        });
        if (overdueNew.length > 0 && dataClient.entities.Notification?.create) {
          const newIds = [...alreadyNotified];
          for (const po of overdueNew) {
            try {
              await dataClient.entities.Notification.create({
                type: "warning", title: `OC vencida: ${po.po_number}`,
                message: `${po.supplier_name || "Sin proveedor"} · esperada el ${po.expected_date} · $${Number(po.total_amount || 0).toFixed(2)}`,
                read: false, category: "purchase_order", reference_id: po.id,
              });
              newIds.push(po.id);
            } catch { /* */ }
          }
          try { localStorage.setItem(notifyKey, JSON.stringify(newIds)); } catch { /* */ }
          if (overdueNew.length > 0) toast.warning(`${overdueNew.length} orden${overdueNew.length === 1 ? "" : "es"} de compra vencida${overdueNew.length === 1 ? "" : "s"}`);
        }
      } catch { /* */ }

      const validSales = (salesData || []).filter(s => !s.voided);
      const expenseTransactions = (transactionsData || []).filter(t => t.type === 'expense').map(t => ({ ...t, _source: "transaction" }));

      const drawerExpenses = (cashMovementsData || []).filter(m => m.type === "expense").map(m => ({
        id: `movement-${m.id}`, movement_id: m.id, type: "expense",
        amount: m.amount || 0, description: m.description || m.reference || "Gasto de caja",
        category: "cash_movement", payment_method: "cash",
        recorded_by: m.employee || "Sistema",
        created_date: m.created_date || m.created_at || null,
        created_at: m.created_at || m.created_date || null, _source: "movement"
      }));

      const normalizeText = (value) => String(value || "").trim().toLowerCase();
      const isDuplicateExpense = (movExp) => {
        const movDate = new Date(getEntityDate(movExp) || 0).getTime();
        return expenseTransactions.some((tx) => {
          const txDate = new Date(getEntityDate(tx) || 0).getTime();
          const closeInTime = Number.isFinite(movDate) && Number.isFinite(txDate) && Math.abs(movDate - txDate) <= 2 * 60 * 1000;
          return closeInTime && getExpenseMagnitude(tx.amount) === getExpenseMagnitude(movExp.amount) && normalizeText(tx.description) === normalizeText(movExp.description);
        });
      };

      const mergedExpenses = [
        ...expenseTransactions,
        ...drawerExpenses.filter(m => !isDuplicateExpense(m))
      ].sort((a, b) => new Date(getEntityDate(b) || 0).getTime() - new Date(getEntityDate(a) || 0).getTime());

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
        if ((Array.isArray(incoming) ? incoming.length : 0) === 0 && (prev?.length || 0) > 0 && mutationWasRecent) return prev;
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
  }, []);

  // ── Effects ─────────────────────────────────────────────────────

  useEffect(() => {
    loadData();
    const unsubscribeCash = subscribeToCashRegister(({ isOpen, drawer }) => {
      setDrawerOpen(!!isOpen);
      setCurrentDrawer(drawer || null);
    });
    checkCashRegisterStatus().catch(() => null);

    const handleRefresh = () => { if (!isFetching.current) loadData(); };
    const handleSaleCompleted = (event) => {
      const sale = event?.detail?.sale;
      const txs = Array.isArray(event?.detail?.transactions) ? event.detail.transactions : [];
      if (sale?.id) upsertLocalSale(sale);
      if (txs.length) upsertLocalTransactions(txs);
      if (sale) setSales((prev) => [sale, ...(prev || []).filter((row) => String(row?.id || "") !== String(sale?.id || ""))]);
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
      const raw = event?.detail;
      if (!raw) return;
      const norm = { ...raw, type: "expense", amount: Number(raw.amount || 0), created_date: raw.created_date || raw.created_at || new Date().toISOString(), _source: raw._source || "transaction" };
      setTransactions((prev) => { const l = Array.isArray(prev) ? prev : []; if (l.some((t) => t.id === norm.id)) return l; return [norm, ...l]; });
      setExpenses((prev) => { const l = Array.isArray(prev) ? prev : []; if (l.some((e) => e.id === norm.id)) return l; return [norm, ...l]; });
      setDateFilter("all");
      setActiveTab("movimientos");
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
  }, [loadData]);

  // ── Actions ─────────────────────────────────────────────────────

  const handleManualRefresh = useCallback(() => {
    if (loading || isFetching.current) { toast.warning("Ya hay una actualización en curso"); return; }
    toast.info("Actualizando datos...");
    loadData();
  }, [loading, loadData]);

  const handleSaveFixedExpense = useCallback(async (expenseData, editingExpense) => {
    const confirmPersisted = async (fallbackData, expectedId = null) => {
      const list = await dataClient.entities.FixedExpense.list("-created_date", 50).catch(async () =>
        dataClient.entities.FixedExpense.list("-created_at", 50).catch(() => []));
      const rows = Array.isArray(list) ? list : [];
      if (expectedId) { const byId = rows.find((item) => String(item?.id || item?._id || "") === String(expectedId)); if (byId) return byId; }
      const now = Date.now();
      return rows.find((item) => {
        const createdRaw = item?.created_date || item?.created_at;
        const createdTs = createdRaw ? new Date(createdRaw).getTime() : 0;
        const withinWindow = Number.isFinite(createdTs) ? Math.abs(now - createdTs) < 120000 : true;
        return withinWindow && String(item?.name || "").trim().toLowerCase() === String(fallbackData?.name || "").trim().toLowerCase()
          && String(item?.category || "") === String(fallbackData?.category || "") && String(item?.frequency || "") === String(fallbackData?.frequency || "");
      }) || null;
    };
    const percentageValue = parseFloat(expenseData.percentage || 0);
    const fixedAmountValue = parseFloat(expenseData.fixed_amount || 0);
    const dataToSave = {
      name: expenseData.name, category: expenseData.category,
      percentage: Number.isFinite(percentageValue) ? percentageValue : 0,
      frequency: expenseData.frequency, due_day: expenseData.due_day ? parseInt(expenseData.due_day) : null,
      priority: parseInt(expenseData.priority || 5), icon: expenseData.icon || "💰",
      notes: serializeFixedExpenseNotes(expenseData.notes || "", fixedAmountValue),
      active: expenseData.active !== false
    };
    try {
      if (editingExpense) {
        recentFixedExpenseMutationAt.current = Date.now();
        const updatedPayload = await dataClient.entities.FixedExpense.update(editingExpense.id, dataToSave);
        const updated = normalizeEntityRecord(updatedPayload) || updatedPayload;
        const updatedId = updated?.id || updated?._id || editingExpense.id;
        const updatedLocal = (updated?.id || updated?._id) ? updated : (await confirmPersisted(dataToSave, updatedId));
        if (!updatedLocal?.id && !updatedLocal?._id) {
          const localFallback = { ...editingExpense, ...dataToSave, id: editingExpense.id, _local_only: true, updated_date: new Date().toISOString() };
          writeLocalFixedExpenses([localFallback, ...readLocalFixedExpenses().filter((r) => String(r?.id || "") !== String(editingExpense.id))]);
          setFixedExpenses((prev) => (prev || []).map((item) => String(item?.id || "") === String(editingExpense.id) ? localFallback : item));
          toast.warning("Guardado local. Pendiente sincronizar.");
          window.dispatchEvent(new Event("fixed-expenses-updated"));
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
        const createdLocal = createdId ? created : (await confirmPersisted(dataToSave, createdId));
        if (!createdLocal?.id && !createdLocal?._id) {
          const localRow = { id: `local-fixed-${Date.now()}`, ...dataToSave, created_date: new Date().toISOString(), _local_only: true };
          writeLocalFixedExpenses([localRow, ...readLocalFixedExpenses()]);
          setFixedExpenses((prev) => [localRow, ...(prev || [])]);
          toast.warning("Guardado local. Pendiente sincronizar.");
          window.dispatchEvent(new Event("fixed-expenses-updated"));
          return;
        }
        writeLocalFixedExpenses(readLocalFixedExpenses().filter((r) => String(r?.id || "") !== String(createdLocal?.id || createdLocal?._id || "")));
        setFixedExpenses((prev) => [createdLocal, ...(prev || [])]);
        toast.success("Gasto creado");
      }
      window.dispatchEvent(new Event("fixed-expenses-updated"));
      setTimeout(() => loadData(), 1500);
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(`Error: ${error.message || "No se pudo guardar"}`);
    }
  }, [loadData]);

  const handleDeleteFixedExpense = useCallback(async (expenseId) => {
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
  }, [loadData]);

  const handleUpdateExpense = useCallback(async (expenseData, editingTransaction) => {
    if (!editingTransaction?.id) return;
    try {
      await dataClient.entities.Transaction.update(editingTransaction.id, {
        amount: parseFloat(expenseData.amount), description: expenseData.description.trim(), category: expenseData.category || "other_expense"
      });
      toast.success("Gasto actualizado");
      loadData();
    } catch (error) {
      console.error("Error actualizando gasto:", error);
      toast.error("No se pudo actualizar el gasto");
    }
  }, [loadData]);

  const handleDeleteExpense = useCallback(async (expenseId) => {
    if (!confirm("¿Eliminar este gasto registrado?")) return;
    try {
      await dataClient.entities.Transaction.delete(expenseId);
      toast.success("Gasto eliminado");
      loadData();
    } catch (error) {
      console.error("Error eliminando gasto:", error);
      toast.error("No se pudo eliminar el gasto");
    }
  }, [loadData]);

  const deletePOWithWOCleanup = useCallback(async (po) => {
    const lineItems = po.line_items || po.items || [];
    const linkedWoIds = [...new Set(lineItems.map((it) => it.linked_work_order_id || it.work_order_id).filter(Boolean))];
    for (const woId of linkedWoIds) {
      try {
        const wo = await base44.entities.Order.get(woId);
        if (!wo) continue;
        const parts = Array.isArray(wo.parts_needed) ? wo.parts_needed : [];
        const orderItems = Array.isArray(wo.order_items) ? wo.order_items : [];
        const newParts = parts.filter((i) => i.po_id !== po.id);
        const newOrderItems = orderItems.filter((i) => i.po_id !== po.id);
        if (newParts.length !== parts.length || newOrderItems.length !== orderItems.length) {
          await base44.entities.Order.update(woId, { parts_needed: newParts, order_items: newOrderItems });
        }
      } catch { /* */ }
    }
    await dataClient.entities.PurchaseOrder.delete(po.id);
    return { linkedItems: lineItems.filter((it) => it.linked_work_order_id || it.work_order_id).length, linkedWoIds: linkedWoIds.length };
  }, []);

  // Resumen IA financiero removido — IA solo vive en Órdenes de Compra.
  const fetchAiSummary = useCallback(async () => {
    setAiLoading(false);
    setAiSummary("");
  }, []);

  const exportAccountingCSV = useCallback(() => {
    try {
      const esc = (v) => { const s = String(v ?? "").replace(/"/g, '""'); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s; };
      const row = (...cols) => cols.map(esc).join(",");
      const periodLabel = dateFilter === "today" ? "Hoy" : dateFilter === "week" ? "Últimos 7 días" : dateFilter === "month" ? "Mes actual" : `${customStartDate} a ${customEndDate}`;
      let csv = `LIBRO CONTABLE - ${periodLabel}\nExportado: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\nLIBRO DIARIO\n`;
      csv += row("Fecha","Hora","Tipo","Descripción","Referencia","Débito","Crédito","Método de Pago","Categoría") + "\n";
      const allMovements = [
        ...filteredSales.map(s => ({ date: getEntityDate(s), tipo: "Ingreso", desc: s.customer_name ? `Venta — ${s.customer_name}` : "Venta", ref: s.sale_number || s.id?.slice(0, 8) || "", debit: 0, credit: Number(s.total || 0), method: s.payment_method || "", cat: "Ventas" })),
        ...filteredExpenses.map(e => ({ date: e.created_date || e.date, tipo: "Gasto", desc: e.description || e.name || "Gasto", ref: e.id?.slice(0, 8) || "", debit: getExpenseMagnitude(e.amount), credit: 0, method: e.payment_method || "", cat: e.category || "Gasto General" })),
      ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
      allMovements.forEach(m => { const d = m.date ? new Date(m.date) : null; csv += row(d ? format(d, "dd/MM/yyyy") : "", d ? format(d, "HH:mm") : "", m.tipo, m.desc, m.ref, m.debit ? m.debit.toFixed(2) : "", m.credit ? m.credit.toFixed(2) : "", m.method, m.cat) + "\n"; });
      csv += "\nRESUMEN POR CATEGORÍA DE GASTO\n" + row("Categoría", "Total") + "\n";
      const catMap = {};
      filteredExpenses.forEach(e => { const cat = e.category || "other"; catMap[cat] = (catMap[cat] || 0) + getExpenseMagnitude(e.amount); });
      Object.entries(catMap).sort((a, b) => b[1] - a[1]).forEach(([cat, total]) => { csv += row(cat, total.toFixed(2)) + "\n"; });
      const csvIVU = filteredSales.reduce((s, sale) => s + Number(sale.tax_amount || 0), 0);
      const totalGross = filteredSales.reduce((s, sale) => s + Number(sale.total || 0), 0);
      const totalNet = totalGross - csvIVU;
      const totalExp = filteredExpenses.reduce((s, e) => s + getExpenseMagnitude(e.amount), 0);
      csv += "\nRESUMEN FISCAL\n" + row("Concepto", "Monto") + "\n";
      csv += row("Ingresos Brutos", totalGross.toFixed(2)) + "\n";
      csv += row("IVU Cobrado (11.5%)", csvIVU.toFixed(2)) + "\n";
      csv += row("Ingresos Netos (sin IVU)", totalNet.toFixed(2)) + "\n";
      csv += row("Total de Gastos", totalExp.toFixed(2)) + "\n";
      csv += row("Utilidad Neta", (totalNet - totalExp).toFixed(2)) + "\n";
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `contabilidad_${format(new Date(), "yyyy-MM-dd")}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { console.error("exportAccountingCSV error:", e); }
  }, [dateFilter, customStartDate, customEndDate, filteredSales, filteredExpenses]);

  const exportToCSV = useCallback(() => {
    try {
      const totalSalesProfit = filteredSales.reduce((sum, sale) => sum + computeSaleProfit(sale), 0);
      const partsCost = filteredSales.reduce((sum, sale) => {
        const items = Array.isArray(sale?.items) ? sale.items : [];
        return sum + items.reduce((s, item) => { const qty = Number(item?.quantity || 0); return s + Number(item?.line_cost || (Number(item?.cost || 0) * qty)); }, 0);
      }, 0);
      const categoryTotals = filteredExpenses.reduce((acc, e) => { const cat = e.category || 'other_expense'; acc[cat] = (acc[cat] || 0) + getExpenseMagnitude(e.amount); return acc; }, {});
      let csv = "REPORTE FINANCIERO DETALLADO\n\n";
      csv += `Período: ${dateFilter === 'today' ? 'Hoy' : dateFilter === 'week' ? 'Última Semana' : dateFilter === 'month' ? 'Último Mes' : `${customStartDate} a ${customEndDate}`}\n`;
      csv += `Fecha de Exportación: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;
      csv += "RESUMEN CERTIFICADO\n";
      csv += `Ingresos Totales (Bruto),${totalRevenue.toFixed(2)}\n`;
      csv += `Costo Total de Piezas,${partsCost.toFixed(2)}\n`;
      csv += `Ganancia Real de Ventas,${totalSalesProfit.toFixed(2)}\n`;
      csv += `Gastos Totales,${totalExpenses.toFixed(2)}\n`;
      csv += `Utilidad Neta Final,${(totalSalesProfit - totalExpenses).toFixed(2)}\n`;
      csv += `Total de Ventas,${filteredSales.length}\n\n`;
      csv += "DESGLOSE DE GASTOS POR CATEGORÍA\n";
      csv += `Nómina,${(categoryTotals['payroll'] || 0).toFixed(2)}\nRenta,${(categoryTotals['rent'] || 0).toFixed(2)}\nImpuestos,${(categoryTotals['taxes'] || 0).toFixed(2)}\nUtilidades,${(categoryTotals['utilities'] || 0).toFixed(2)}\nPiezas,${(categoryTotals['parts'] || 0).toFixed(2)}\nOtros,${(categoryTotals['other_expense'] || 0).toFixed(2)}\n\n`;
      csv += "VENTAS DETALLADAS\nNúmero,Fecha,Hora,Cliente,Items,Método,Subtotal,IVU,Total\n";
      filteredSales.forEach(s => {
        const d = getEntityDate(s);
        csv += `${s.sale_number},${d ? format(new Date(d), 'dd/MM/yyyy') : "-"},${d ? format(new Date(d), 'HH:mm:ss') : "-"},"${s.customer_name || 'Cliente'}",${s.items?.length || 0},${s.payment_method},${(s.subtotal || 0).toFixed(2)},${(s.tax_amount || 0).toFixed(2)},${(s.total || 0).toFixed(2)}\n`;
      });
      csv += "\nGASTOS DETALLADOS\nFecha,Hora,Descripción,Categoría,Monto,Registrado Por\n";
      filteredExpenses.forEach(e => {
        const d = getEntityDate(e);
        csv += `${d ? format(new Date(d), 'dd/MM/yyyy') : "-"},${d ? format(new Date(d), 'HH:mm:ss') : "-"},"${e.description || 'Sin descripción'}",${e.category || 'Otro'},${(e.amount || 0).toFixed(2)},"${e.recorded_by || 'Sistema'}"\n`;
      });
      csv += "\nDESGLOSE POR MÉTODO DE PAGO\nMétodo,Transacciones,Total\n";
      const pm = {};
      filteredSales.forEach(s => { const m = s.payment_method || 'sin_definir'; if (!pm[m]) pm[m] = { count: 0, total: 0 }; pm[m].count++; pm[m].total += (s.total || 0); });
      Object.keys(pm).forEach(m => { csv += `${m},${pm[m].count},${pm[m].total.toFixed(2)}\n`; });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a"); const url = URL.createObjectURL(blob);
      link.setAttribute("href", url); link.setAttribute("download", `finanzas_${dateFilter}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
      toast.success("Reporte exportado exitosamente");
    } catch (error) { console.error("Error exportando:", error); toast.error("Error al exportar el reporte"); }
  }, [dateFilter, customStartDate, customEndDate, filteredSales, filteredExpenses, totalRevenue, totalExpenses]);

  const canDeletePO = useMemo(() => {
    try {
      const session = JSON.parse(localStorage.getItem("employee_session") || "{}");
      const role = String(session?.role || "user").toLowerCase();
      return ["admin", "owner", "manager", "superadmin"].includes(role);
    } catch { return false; }
  }, []);

  return {
    // Raw data
    sales, transactions, expenses, fixedExpenses, oneTimeExpenses,
    purchaseOrders, suppliers, poProducts, poWorkOrders, customersList,
    // State
    loading, loadError, drawerOpen, currentDrawer, canDeletePO,
    // Filters
    dateFilter, setDateFilter, customStartDate, setCustomStartDate,
    customEndDate, setCustomEndDate, movFilter, setMovFilter,
    activeTab, setActiveTab,
    // Computed
    filteredSales, filteredExpenses, revenueTransactions,
    totalRevenue, totalExpenses, netProfit,
    unsettledExpenses, unsettledTotal, settledExpensesTotal,
    totalIVU, totalPartsCost,
    todayRevenue, todayExpenses, todaySalesProfit,
    paymentMethodBreakdown, combinedMovements, dailyAllocations,
    // AI
    aiSummary, aiLoading, fetchAiSummary,
    // Actions
    loadData, handleManualRefresh,
    handleSaveFixedExpense, handleDeleteFixedExpense,
    handleUpdateExpense, handleDeleteExpense,
    deletePOWithWOCleanup,
    exportToCSV, exportAccountingCSV,
    // Setters needed by sub-components
    setPurchaseOrders,
  };
}
