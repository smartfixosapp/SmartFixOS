import React, { useState, useEffect, useRef, useMemo } from "react";
import JENAIInsightBanner from "@/components/jenai/JENAIInsightBanner";
import { callJENAI } from "@/lib/jenaiEngine";
import { dataClient } from "@/components/api/dataClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Receipt,
  CreditCard, Landmark, RefreshCw, Plus, Target, PieChart,
  Edit2, Trash2, Save, Download, Filter, X, AlertTriangle, Sparkles,
  ShoppingCart, Eye, Truck
} from "lucide-react";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import OpenDrawerDialog from "../components/cash/OpenDrawerDialog";
import CloseDrawerDialog from "../components/cash/CloseDrawerDialog";
import ExpenseDialog from "../components/financial/ExpenseDialog";
import TimeTrackingModal from "../components/timetracking/TimeTrackingModal";
import AlertasWidget from "../components/financial/AlertasWidget";
import EnhancedReports from "../components/financial/EnhancedReports";
import OneTimeExpensesWidget from "../components/financial/OneTimeExpensesWidget";
import GastosOperacionalesWidget from "../components/financial/GastosOperacionalesWidget";
import MonthlyReportModal from "../components/financial/MonthlyReportModal";
import TechnicianProductivityTab from "../components/financial/TechnicianProductivityTab";
import { toast } from "sonner";
import TransactionsModal from "../components/financial/TransactionsModal";
import PurchaseOrderDialog from "../components/inventory/PurchaseOrderDialog";
import PurchaseOrderDetailDialog from "../components/inventory/PurchaseOrderDetailDialog";
import ImportPODialog from "../components/inventory/ImportPODialog";
import { loadSuppliersSafe } from "@/components/utils/suppliers";
import { useNavigate } from "react-router-dom";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { PlanGate, UpgradePrompt } from "@/components/plan/UpgradePrompt";
import {
  getCachedStatus,
  subscribeToCashRegister,
  checkCashRegisterStatus
} from "@/components/cash/CashRegisterService";
import { mergeSales, mergeTransactions, upsertLocalSale, upsertLocalTransactions } from "@/components/utils/localFinancialCache";
import ErrorBoundary from "@/components/utils/ErrorBoundary";


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
  const { can: canPlan } = usePlanLimits();
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
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);
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
  const [movFilter, setMovFilter] = useState("all"); // "all" | "income" | "expense"
  const [activeTab, setActiveTab] = useState("resumen");
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // ── Órdenes de Compra (movido desde Inventario) ──
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [poProducts, setPoProducts] = useState([]);
  const [poWorkOrders, setPoWorkOrders] = useState([]);
  const [showPODialog, setShowPODialog] = useState(false);
  const [showImportPO, setShowImportPO] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [viewingPO, setViewingPO] = useState(null);
  const [poSearch, setPoSearch] = useState("");
  const [poStatusFilter, setPoStatusFilter] = useState("all");
  const [poQuickFilter, setPoQuickFilter] = useState("all"); // all | week | overdue | unpaid | drafts
  const [poSortBy, setPoSortBy] = useState("date"); // date | total | supplier
  const [poSortDir, setPoSortDir] = useState("desc"); // asc | desc
  const [poViewMode, setPoViewMode] = useState("list"); // list | grouped
  const [selectedPOIds, setSelectedPOIds] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [deletingPOId, setDeletingPOId] = useState(null);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [creatingReorderPO, setCreatingReorderPO] = useState(null);

  // Permisos: solo admin/owner pueden borrar OCs.
  // Cualquier usuario puede crear/editar/marcar recibidas.
  const canDeletePO = useMemo(() => {
    try {
      const session = JSON.parse(localStorage.getItem("employee_session") || "{}");
      const role = String(session?.role || "user").toLowerCase();
      return ["admin", "owner", "manager", "superadmin"].includes(role);
    } catch {
      return false;
    }
  }, []);

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

      // Notificaciones de OCs vencidas — máximo 1 por OC cada 24h
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
                type: "warning",
                title: `OC vencida: ${po.po_number}`,
                message: `${po.supplier_name || "Sin proveedor"} · esperada el ${po.expected_date} · $${Number(po.total_amount || 0).toFixed(2)}`,
                read: false,
                category: "purchase_order",
                reference_id: po.id,
              });
              newIds.push(po.id);
            } catch (notifErr) {
              console.warn("No se pudo crear notificación:", notifErr);
            }
          }
          try { localStorage.setItem(notifyKey, JSON.stringify(newIds)); } catch { /* */ }
          if (overdueNew.length > 0) {
            toast.warning(`${overdueNew.length} orden${overdueNew.length === 1 ? "" : "es"} de compra vencida${overdueNew.length === 1 ? "" : "s"}`);
          }
        }
      } catch (overdueErr) {
        console.warn("Overdue check error:", overdueErr);
      }

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

  // ── Desglose financiero detallado ──────────────────────────────────────────
  const totalIVU = filteredSales.reduce((s, sale) => s + Number(sale.tax_amount || 0), 0);
  const totalRevenueBeforeTax = totalRevenue - totalIVU; // ingresos sin IVU
  const totalPartsCost = filteredSales.reduce((sum, sale) => {
    const items = Array.isArray(sale?.items) ? sale.items : [];
    return sum + items.reduce((s, item) => {
      const qty = Number(item?.quantity || 0);
      return s + Number(item?.line_cost || (Number(item?.cost || 0) * qty));
    }, 0);
  }, 0);
  const grossMargin = totalRevenueBeforeTax - totalPartsCost; // margen bruto
  const trueNetProfit = grossMargin - totalExpenses; // ganancia neta real

  // Payment method breakdown
  const paymentMethodBreakdown = React.useMemo(() => {
    const methods = {
      cash:      { label: "Efectivo",  emoji: "💵", colorBar: "bg-emerald-500", colorText: "text-emerald-400", colorBg: "bg-emerald-500/10 border-emerald-500/20", total: 0, count: 0 },
      card:      { label: "Tarjeta",   emoji: "💳", colorBar: "bg-blue-500",    colorText: "text-blue-400",    colorBg: "bg-blue-500/10 border-blue-500/20",         total: 0, count: 0 },
      ath_movil: { label: "ATH Móvil", emoji: "📱", colorBar: "bg-purple-500",  colorText: "text-purple-400",  colorBg: "bg-purple-500/10 border-purple-500/20",     total: 0, count: 0 },
      mixed:     { label: "Mixto",     emoji: "🔀", colorBar: "bg-amber-500",   colorText: "text-amber-400",   colorBg: "bg-amber-500/10 border-amber-500/20",       total: 0, count: 0 },
      other:     { label: "Otro",      emoji: "🏦", colorBar: "bg-slate-500",   colorText: "text-slate-400",   colorBg: "bg-slate-500/10 border-slate-500/20",       total: 0, count: 0 },
    };
    const safeList = Array.isArray(filteredSales) ? filteredSales : [];
    safeList.forEach(s => {
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

  const CATEGORY_LABELS = {
    rent: "Renta", utilities: "Utilidades", supplies: "Suministros",
    payroll: "Nómina", parts: "Piezas", maintenance: "Mantenimiento",
    insurance: "Seguros", taxes: "Impuestos", other_expense: "Otros Gastos",
    repair_payment: "Cobro de Reparación", refund: "Devolución",
    cash_movement: "Movimiento de Caja"
  };

  const combinedMovements = React.useMemo(() => {
    const income = (Array.isArray(filteredSales) ? filteredSales : []).map(s => ({
      id: `sale-${s.id}`,
      kind: "income",
      date: getEntityDate(s),
      title: s.customer_name || "Consumidor Final",
      subtitle: `#${s.sale_number || '---'} · ${s.items?.length || 0} artículo${(s.items?.length || 0) !== 1 ? 's' : ''}`,
      amount: s.total || 0,
      method: s.payment_method,
      raw: s,
      canEdit: false
    }));
    const expns = (Array.isArray(filteredExpenses) ? filteredExpenses : []).map(e => {
      // Buscar PO enlazada por order_number (OC PO-XXX)
      const poRef = e.order_number && String(e.order_number).startsWith("PO-")
        ? purchaseOrders.find((po) => po.po_number === e.order_number)
        : null;
      return {
        id: `expense-${e.id}`,
        kind: "expense",
        date: getEntityDate(e),
        title: e.description || "Gasto",
        subtitle: CATEGORY_LABELS[e.category] || e.category || "Misceláneo",
        amount: getExpenseMagnitude(e.amount),
        method: e.payment_method || "cash",
        raw: e,
        canEdit: e._source === "transaction",
        origId: e.id,
        linkedPO: poRef || null,
      };
    });
    return [...income, ...expns].sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date) - new Date(a.date);
    });
  }, [filteredSales, filteredExpenses, purchaseOrders]);

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

  const fetchAiSummary = async () => {
    setAiLoading(true);
    setAiSummary("");
    try {
      const periodLabel =
        dateFilter === "today" ? "hoy" :
        dateFilter === "week"  ? "esta semana" :
        dateFilter === "month" ? "este mes" : "todo el periodo";

      const categoryTotals = filteredExpenses.reduce((acc, e) => {
        const cat = e.category || "other_expense";
        acc[cat] = (acc[cat] || 0) + getExpenseMagnitude(e.amount);
        return acc;
      }, {});

      const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cat, amount]) => ({ label: CATEGORY_LABELS[cat] || cat, amount }));

      const avgTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;
      const margin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;

      const text = await callJENAI(
`PERIODO: ${periodLabel}
- Ingresos: $${totalRevenue.toFixed(2)}
- Gastos: $${totalExpenses.toFixed(2)}
- Ganancia neta: $${netProfit.toFixed(2)}
- Margen: ${margin}%
- Ventas/cobros: ${filteredSales.length}
- Ticket promedio: $${avgTicket.toFixed(2)}
- Ingreso hoy: $${todayRevenue.toFixed(2)}
- Gastos hoy: $${todayExpenses.toFixed(2)}
${topCategories.length > 0 ? `- Top 5 gastos: ${topCategories.map(c => `${c.label} $${c.amount.toFixed(0)}`).join(", ")}` : ""}
${paymentMethodBreakdown.length > 0 ? `- Metodos de pago: ${paymentMethodBreakdown.map(p => `${p.label} $${p.total.toFixed(0)}`).join(", ")}` : ""}

Analiza como experto financiero de taller de reparacion.`,
        {
          maxTokens: 400,
          temperature: 0.35,
          systemPrompt: `Eres JENAI, analista financiero de SmartFixOS. Responde en espanol.
Formato obligatorio:
1. RESUMEN (2 oraciones del estado financiero)
2. SALUD FINANCIERA: score del 1-10 con justificacion breve
3. PUNTO FUERTE: algo positivo que destacar
4. ALERTA: riesgo o problema a atender (si hay)
5. ACCION RECOMENDADA: una accion concreta para mejorar
Maximo 150 palabras. Texto plano, sin markdown.`
        }
      );
      setAiSummary(text);
    } catch (err) {
      console.error("AI summary error:", err);
      setAiSummary("No se pudo conectar con JENAI.");
    } finally {
      setAiLoading(false);
    }
  };

  const exportAccountingCSV = () => {
    try {
      const esc = (v) => {
        const s = String(v ?? "").replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
      };
      const row = (...cols) => cols.map(esc).join(",");

      const periodLabel = dateFilter === "today" ? "Hoy"
        : dateFilter === "week" ? "Últimos 7 días"
        : dateFilter === "month" ? "Mes actual"
        : dateFilter === "quarter" ? "Trimestre"
        : dateFilter === "year" ? "Año"
        : `${customStartDate} a ${customEndDate}`;

      let csv = `LIBRO CONTABLE - ${periodLabel}\n`;
      csv += `Exportado: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;

      // ── Journal entries (all movements) ──────────────────────────────
      csv += "LIBRO DIARIO\n";
      csv += row("Fecha","Hora","Tipo","Descripción","Referencia","Débito","Crédito","Método de Pago","Categoría") + "\n";

      const allMovements = [
        ...filteredSales.map(s => ({
          date: getEntityDate(s),
          tipo: "Ingreso",
          desc: s.customer_name ? `Venta — ${s.customer_name}` : "Venta",
          ref: s.sale_number || s.id?.slice(0, 8) || "",
          debit: 0,
          credit: Number(s.total || 0),
          method: s.payment_method || "",
          cat: "Ventas",
        })),
        ...filteredExpenses.map(e => ({
          date: e.created_date || e.date,
          tipo: "Gasto",
          desc: e.description || e.name || "Gasto",
          ref: e.id?.slice(0, 8) || "",
          debit: getExpenseMagnitude(e.amount),
          credit: 0,
          method: e.payment_method || "",
          cat: e.category || "Gasto General",
        })),
      ].sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

      allMovements.forEach(m => {
        const d = m.date ? new Date(m.date) : null;
        csv += row(
          d ? format(d, "dd/MM/yyyy") : "",
          d ? format(d, "HH:mm") : "",
          m.tipo, m.desc, m.ref,
          m.debit ? m.debit.toFixed(2) : "",
          m.credit ? m.credit.toFixed(2) : "",
          m.method, m.cat
        ) + "\n";
      });

      // ── Summary by category ───────────────────────────────────────────
      csv += "\nRESUMEN POR CATEGORÍA DE GASTO\n";
      csv += row("Categoría", "Total") + "\n";
      const catMap = {};
      filteredExpenses.forEach(e => {
        const cat = e.category || "other";
        catMap[cat] = (catMap[cat] || 0) + getExpenseMagnitude(e.amount);
      });
      Object.entries(catMap).sort((a, b) => b[1] - a[1]).forEach(([cat, total]) => {
        csv += row(cat, total.toFixed(2)) + "\n";
      });

      // ── Tax summary ───────────────────────────────────────────────────
      const totalIVU = filteredSales.reduce((s, sale) => s + Number(sale.tax_amount || 0), 0);
      const totalGrossIncome = filteredSales.reduce((s, sale) => s + Number(sale.total || 0), 0);
      const totalNetIncome = totalGrossIncome - totalIVU;
      const totalExpTotal = filteredExpenses.reduce((s, e) => s + getExpenseMagnitude(e.amount), 0);

      csv += "\nRESUMEN FISCAL\n";
      csv += row("Concepto", "Monto") + "\n";
      csv += row("Ingresos Brutos", totalGrossIncome.toFixed(2)) + "\n";
      csv += row("IVU Cobrado (11.5%)", totalIVU.toFixed(2)) + "\n";
      csv += row("Ingresos Netos (sin IVU)", totalNetIncome.toFixed(2)) + "\n";
      csv += row("Total de Gastos", totalExpTotal.toFixed(2)) + "\n";
      csv += row("Utilidad Neta", (totalNetIncome - totalExpTotal).toFixed(2)) + "\n";

      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contabilidad_${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("exportAccountingCSV error:", e);
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
    <div className="min-h-screen bg-black/95 flex flex-col">

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur-2xl border-b border-white/5 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight leading-none">Finanzas</h1>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest leading-none mt-0.5 truncate">
                {loading ? "Cargando…" : `${filteredSales.length + filteredExpenses.length} movimientos`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Filtro de período — etiquetas cortas en móvil */}
            <div className="flex items-center gap-0.5 p-0.5 sm:p-1 bg-white/5 rounded-2xl border border-white/10">
              {[
                { id: "today", label: "Hoy",  labelSm: "Hoy" },
                { id: "week",  label: "7d",   labelSm: "7d"  },
                { id: "month", label: "Mes",  labelSm: "Mes" },
                { id: "all",   label: "Todo", labelSm: "Todo"},
                { id: "custom",label: "📅",   labelSm: "📅"  },
              ].map((p) => (
                <button key={p.id} onClick={() => setDateFilter(p.id)}
                  className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black transition-all ${
                    dateFilter === p.id
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow"
                      : "text-white/30 hover:text-white/60"
                  }`}
                >{p.label}</button>
              ))}
            </div>
            <button onClick={handleManualRefresh} disabled={loading}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0">
              <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={() => navigate(-1)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-colors shrink-0">
              <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </div>
        {dateFilter === "custom" && (
          <div className="max-w-7xl mx-auto flex gap-2 mt-2 pt-2 border-t border-white/5">
            <input type="date" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 text-white text-xs h-9 rounded-xl px-3 focus:border-cyan-500/50 outline-none" />
            <span className="text-white/20 self-center text-xs">→</span>
            <input type="date" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)}
              className="flex-1 bg-black/40 border border-white/10 text-white text-xs h-9 rounded-xl px-3 focus:border-cyan-500/50 outline-none" />
          </div>
        )}
      </div>

      {/* ── JENAI Financial Insights ── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-3">
        <JENAIInsightBanner
          context="financial"
          data={{
            todayIncome: todayRevenue || 0,
            monthIncome: totalRevenue || 0,
            monthExpenses: totalExpenses || 0,
            netProfit: (totalRevenue || 0) - (totalExpenses || 0),
            margin: totalRevenue > 0 ? Math.round(((totalRevenue - totalExpenses) / totalRevenue) * 100) : 0,
            txCount: transactions?.length || 0,
          }}
          accentColor="emerald"
          autoLoad={false}
        />
      </div>

      {/* ── Layout principal ── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4 pb-28 flex-1">
        <div className="lg:flex lg:gap-5 lg:items-start">

          {/* ── Sidebar (KPIs + acciones) — sticky en desktop ── */}
          <div className="lg:w-64 xl:w-72 shrink-0 space-y-2 mb-4 lg:mb-0 lg:sticky lg:top-[72px]">
            {loadError && (
              <div className="flex items-center justify-between gap-3 p-3 bg-red-950/40 border border-red-500/30 rounded-2xl">
                <div className="flex items-center gap-2 text-red-300 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{loadError}</span>
                </div>
                <button onClick={handleManualRefresh} className="text-xs font-black text-red-300 hover:text-red-100 uppercase tracking-widest">Reintentar</button>
              </div>
            )}
            <ErrorBoundary><AlertasWidget /></ErrorBoundary>

            {/* Card: Compras pendientes — visible en cualquier tab */}
            {(() => {
              const pending = (purchaseOrders || []).filter((po) => !["received", "cancelled"].includes(po.status || "draft"));
              if (pending.length === 0) return null;
              const total = pending.reduce((s, po) => s + Number(po.total_amount || 0), 0);
              const overdue = pending.filter((po) => {
                if (!po.expected_date) return false;
                return String(po.expected_date).slice(0, 10) < new Date().toISOString().slice(0, 10);
              });
              return (
                <button
                  onClick={() => setActiveTab("compras")}
                  className={`w-full text-left p-3 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] ${
                    overdue.length > 0
                      ? "bg-red-500/[0.06] border-red-500/25 hover:bg-red-500/10"
                      : "bg-amber-500/[0.05] border-amber-500/20 hover:bg-amber-500/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      overdue.length > 0 ? "bg-red-500/15 text-red-400" : "bg-amber-500/15 text-amber-400"
                    }`}>
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-black ${overdue.length > 0 ? "text-red-300" : "text-amber-300"}`}>
                        Compras pendientes
                      </p>
                      <p className="text-[10px] text-white/50 truncate">
                        {pending.length} orden{pending.length === 1 ? "" : "es"} por recibir
                        {overdue.length > 0 && ` · ⚠ ${overdue.length} vencida${overdue.length === 1 ? "" : "s"}`}
                      </p>
                    </div>
                    <p className={`text-lg font-black tabular-nums shrink-0 ${overdue.length > 0 ? "text-red-300" : "text-amber-300"}`}>
                      ${total.toFixed(2)}
                    </p>
                  </div>
                </button>
              );
            })()}

            {/* ── Navegación unificada — todos los botones ── */}
            <div className="flex flex-col gap-2">
              {(() => {
                const NAV = [
                  {
                    id: "income",     tab: "movimientos", filter: "income",
                    label: "Dinero que entró",    sublabel: "Cobros y pagos recibidos",
                    value: totalRevenue,           icon: TrendingUp,
                    active: activeTab === "movimientos" && movFilter === "income",
                    scheme: "emerald",
                  },
                  {
                    id: "expense",    tab: "movimientos", filter: "expense",
                    label: "Dinero que salió",    sublabel: "Gastos del negocio",
                    value: totalExpenses,          icon: TrendingDown,
                    active: activeTab === "movimientos" && movFilter === "expense",
                    scheme: "red",
                  },
                  {
                    id: "desglose",   tab: "desglose",    filter: null,
                    label: netProfit >= 0 ? "Ganancia neta" : "Déficit",
                    sublabel: "Cobrado − piezas − IVU − gastos",
                    value: Math.abs(netProfit),    icon: DollarSign,
                    active: activeTab === "desglose",
                    scheme: netProfit >= 0 ? "cyan" : "red",
                  },
                  {
                    id: "todos",      tab: "movimientos", filter: "all",
                    label: "Todos los movimientos", sublabel: "Entradas y salidas juntas",
                    value: null,                   icon: Receipt,
                    active: activeTab === "movimientos" && movFilter === "all",
                    scheme: "slate",
                  },
                  {
                    id: "compromisos", tab: "compromisos", filter: null,
                    label: "Compromisos",          sublabel: "Gastos fijos y pendientes",
                    value: null,                   icon: Target,
                    active: activeTab === "compromisos",
                    scheme: "slate",
                  },
                  {
                    id: "compras",    tab: "compras",     filter: null,
                    label: "Órdenes de compra",    sublabel: "Compras a proveedores",
                    value: null,                   icon: ShoppingCart,
                    active: activeTab === "compras",
                    scheme: "slate",
                  },
                  {
                    id: "reportes",   tab: "reportes",    filter: null,
                    label: "Reportes",             sublabel: "Análisis y exportar datos",
                    value: null,                   icon: PieChart,
                    active: activeTab === "reportes",
                    scheme: "slate",
                  },
                  {
                    id: "tecnicos",   tab: "tecnicos",    filter: null,
                    label: "Técnicos",             sublabel: "Productividad del equipo",
                    value: null,                   icon: TrendingUp,
                    active: activeTab === "tecnicos",
                    scheme: "slate",
                  },
                ];

                const colors = {
                  emerald: { bg: "bg-emerald-500/10", bgActive: "bg-emerald-600", border: "border-emerald-500/30", text: "text-emerald-400", sub: "text-emerald-300/50" },
                  red:     { bg: "bg-red-500/10",     bgActive: "bg-red-600",     border: "border-red-500/30",     text: "text-red-400",     sub: "text-red-300/50" },
                  cyan:    { bg: "bg-cyan-500/10",    bgActive: "bg-cyan-600",    border: "border-cyan-500/30",    text: "text-cyan-400",    sub: "text-cyan-300/50" },
                  slate:   { bg: "bg-white/[0.04]",  bgActive: "bg-white/15",    border: "border-white/10",       text: "text-white/50",    sub: "text-white/25" },
                };

                return NAV.map(k => {
                  const c = colors[k.scheme];
                  return (
                    <button key={k.id}
                      onClick={() => { setActiveTab(k.tab); if (k.filter !== null) setMovFilter(k.filter || "all"); }}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border transition-all active:scale-[0.98] ${k.active ? c.bgActive + " border-transparent" : c.bg + " " + c.border}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${k.active ? "bg-white/20" : "bg-white/[0.06]"}`}>
                          <k.icon className={`w-4 h-4 ${k.active ? "text-white" : c.text}`} />
                        </div>
                        <div className="text-left min-w-0">
                          <p className={`text-sm font-black leading-tight ${k.active ? "text-white" : "text-white/80"}`}>{k.label}</p>
                          <p className={`text-[10px] font-bold leading-tight mt-0.5 ${k.active ? "text-white/60" : c.sub}`}>{k.sublabel}</p>
                        </div>
                      </div>
                      {k.value !== null && (
                        <p className={`text-lg font-black tabular-nums shrink-0 ${k.active ? "text-white" : c.text}`}>
                          ${k.value.toFixed(2)}
                        </p>
                      )}
                    </button>
                  );
                });
              })()}

              {/* Acciones de caja */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/[0.06]">
                <button onClick={() => {
                    if (!canPlan('pos_cash_open_close')) {
                      toast.error("Abrir/cerrar caja disponible en el plan Pro", { duration: 5000 });
                      return;
                    }
                    drawerOpen ? setShowCloseDrawer(true) : setShowOpenDrawer(true);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-2xl border transition-all active:scale-95 ${
                    drawerOpen ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/10"
                  }`}
                >
                  <Wallet className={`w-4 h-4 shrink-0 ${drawerOpen ? "text-emerald-400" : "text-white/30"}`} />
                  <p className={`text-xs font-black truncate ${drawerOpen ? "text-emerald-400" : "text-white/40"}`}>{drawerOpen ? "Caja abierta" : "Caja cerrada"}</p>
                </button>
                <button onClick={() => { setExpenseDefaultCategory(null); setShowExpenseDialog(true); }}
                  className="flex items-center gap-2.5 px-3 py-3 rounded-2xl border border-orange-500/20 bg-orange-500/[0.08] transition-all active:scale-95">
                  <Plus className="w-4 h-4 text-orange-400 shrink-0" />
                  <p className="text-xs font-black text-orange-300 truncate">Nuevo gasto</p>
                </button>
              </div>
            </div>
          </div>

          {/* ── Contenido principal ── */}
          <div className="flex-1 min-w-0">

        {/* Tab: Movimientos */}
        {activeTab === "movimientos" && (
          <div className="space-y-3 mt-1">
            {/* Filter pills */}
            <div className="flex gap-1.5 justify-end">
              {[
                { id: "all", label: "Todos" },
                { id: "income", label: "✅ Entradas" },
                { id: "expense", label: "🔴 Salidas" },
              ].map(f => (
                <button key={f.id} onClick={() => setMovFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all border ${
                    movFilter === f.id
                      ? f.id === "income" ? "bg-emerald-600 border-emerald-600 text-white"
                        : f.id === "expense" ? "bg-red-600 border-red-600 text-white"
                        : "bg-cyan-600 border-cyan-600 text-white"
                      : "bg-white/[0.04] border-white/[0.08] text-white/30 hover:text-white/60"
                  }`}
                >{f.label}</button>
              ))}
            </div>

            {/* Lista */}
            {loading ? (
              <div className="py-12 text-center">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-white/20" />
                <p className="text-xs text-white/20 font-bold">Cargando…</p>
              </div>
            ) : combinedMovements.filter(m => movFilter === "all" || m.kind === movFilter).length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-white/25 font-bold text-sm">Sin movimientos en este período</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {combinedMovements.filter(m => movFilter === "all" || m.kind === movFilter).map((m) => (
                  <div key={m.id} className="group flex items-center gap-3 p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] transition-all">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      m.kind === "income" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                    }`}>
                      {m.kind === "income" ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate leading-tight">{m.title}</p>
                      <p className="text-[11px] text-white/30 truncate">
                        {m.subtitle}
                        {m.date ? ` · ${format(new Date(m.date), "dd MMM HH:mm", { locale: es })}` : ""}
                        {m.linkedPO && (
                          <>
                            {" · "}
                            <button
                              onClick={() => { setActiveTab("compras"); setViewingPO(m.linkedPO); }}
                              className="text-cyan-400 hover:text-cyan-300 font-black underline decoration-dotted"
                              title="Ver orden de compra"
                            >
                              🛒 {m.linkedPO.po_number}
                            </button>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <p className={`text-sm font-black ${m.kind === "income" ? "text-emerald-400" : "text-red-400"}`}>
                        {m.kind === "income" ? "+" : "-"}${m.amount.toFixed(2)}
                      </p>
                      {m.canEdit && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEditExpense(m.raw)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-white/30 hover:text-cyan-400 flex items-center justify-center transition-colors">
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button onClick={() => handleDeleteExpense(m.origId)} className="w-6 h-6 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/30 hover:text-red-400 flex items-center justify-center transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Métodos de pago — solo si hay datos */}
            {paymentMethodBreakdown.length > 0 && (
              <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mt-2">
                <p className="text-xs font-black text-white/50 uppercase tracking-widest mb-3">¿Cómo te pagaron?</p>
                <div className="w-full h-2.5 rounded-full overflow-hidden flex mb-4">
                  {paymentMethodBreakdown.map((m) => (
                    <div key={m.key} className={`h-full ${m.colorBar}`} style={{ width: `${m.pct}%` }} />
                  ))}
                </div>
                <div className="space-y-2.5">
                  {paymentMethodBreakdown.map((m) => (
                    <div key={m.key} className="flex items-center gap-2.5">
                      <span className="text-base w-6 text-center">{m.emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-white">{m.label}</span>
                          <span className={`text-xs font-black ${m.colorText}`}>${m.total.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1">
                          <div className={`h-full rounded-full ${m.colorBar}`} style={{ width: `${m.pct}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-white/30 font-bold w-8 text-right">{m.pct.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab: Compromisos */}
        {activeTab === "compromisos" && (
          <div className="space-y-2 mt-1">
            <ErrorBoundary><OneTimeExpensesWidget /></ErrorBoundary>
            <ErrorBoundary><GastosOperacionalesWidget /></ErrorBoundary>
          </div>
        )}

        {/* Tab: Órdenes de Compra */}
        {activeTab === "compras" && (() => {
          const statusLabel = (s) => ({
            draft: "Borrador", pending: "Pendiente", ordered: "Enviada",
            partial: "Parcial", received: "Recibida", cancelled: "Cancelada",
          })[s] || s || "—";
          const statusColor = (s) => ({
            draft:     "bg-white/[0.06] text-white/60 border-white/10",
            pending:   "bg-amber-500/15 text-amber-300 border-amber-500/20",
            ordered:   "bg-cyan-500/15 text-cyan-300 border-cyan-500/20",
            partial:   "bg-violet-500/15 text-violet-300 border-violet-500/20",
            received:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
            cancelled: "bg-red-500/15 text-red-300 border-red-500/20",
          })[s] || "bg-white/[0.06] text-white/60 border-white/10";

          // Margen esperado: Σ(price venta × qty) − Σ(costo × qty)
          const estimatedMargin = (po) => {
            const items = po.line_items || po.items || [];
            let revenue = 0;
            let cost = 0;
            for (const it of items) {
              const qty = Number(it.quantity || 0);
              const unitCost = Number(it.unit_cost || it.cost || 0);
              cost += unitCost * qty;
              const prodId = it.inventory_item_id || it.product_id;
              const prod = poProducts.find((p) => p.id === prodId);
              const price = prod?.price != null ? Number(prod.price) : unitCost * 1.5;
              revenue += price * qty;
            }
            return { revenue, cost, margin: revenue - cost, pct: cost > 0 ? ((revenue - cost) / cost) * 100 : 0 };
          };

          // Helpers para fecha esperada
          const todayStr = new Date().toISOString().slice(0, 10);
          const isOverdue = (po) => {
            if (!po.expected_date) return false;
            if (["received", "cancelled"].includes(po.status)) return false;
            return String(po.expected_date).slice(0, 10) < todayStr;
          };
          const daysUntilExpected = (po) => {
            if (!po.expected_date) return null;
            const exp = new Date(po.expected_date);
            const now = new Date();
            return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
          };

          const q = poSearch.trim().toLowerCase();
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

          const matchesQuick = (po) => {
            const st = po.status || "draft";
            switch (poQuickFilter) {
              case "week": {
                const d = String(po.created_date || po.created_at || po.order_date || "").slice(0, 10);
                return d >= weekAgo;
              }
              case "overdue": return isOverdue(po);
              case "unpaid":
                return !["received", "cancelled"].includes(st) &&
                       !/\[PAID:[^\]]+\]/.test(po.notes || "");
              case "drafts": return st === "draft";
              default: return true;
            }
          };

          const filteredPOs = (purchaseOrders || []).filter((po) => {
            if (!matchesQuick(po)) return false;
            if (poStatusFilter !== "all" && (po.status || "draft") !== poStatusFilter) return false;
            if (!q) return true;
            return (
              String(po.po_number || "").toLowerCase().includes(q) ||
              String(po.supplier_name || "").toLowerCase().includes(q) ||
              String(po.notes || "").toLowerCase().includes(q)
            );
          });

          // Sort
          const sortedPOs = [...filteredPOs].sort((a, b) => {
            const dir = poSortDir === "asc" ? 1 : -1;
            switch (poSortBy) {
              case "total":
                return (Number(a.total_amount || 0) - Number(b.total_amount || 0)) * dir;
              case "supplier":
                return String(a.supplier_name || "").localeCompare(String(b.supplier_name || "")) * dir;
              case "date":
              default: {
                const da = new Date(a.created_date || a.created_at || a.order_date || 0).getTime();
                const db = new Date(b.created_date || b.created_at || b.order_date || 0).getTime();
                return (da - db) * dir;
              }
            }
          });
          const displayPOs = sortedPOs;

          // Stats globales (sobre todas las POs, no filtradas)
          const allPOs = purchaseOrders || [];
          const monthStart = new Date();
          monthStart.setDate(1);
          monthStart.setHours(0, 0, 0, 0);
          const monthPOs = allPOs.filter((po) => {
            const d = new Date(po.created_date || po.created_at || po.order_date || 0);
            return d >= monthStart;
          });
          const monthTotal = monthPOs.reduce((s, po) => s + Number(po.total_amount || 0), 0);
          const pendingPOs = allPOs.filter((po) => !["received", "cancelled"].includes(po.status || "draft"));
          const pendingTotal = pendingPOs.reduce((s, po) => s + Number(po.total_amount || 0), 0);
          const overduePOs = allPOs.filter(isOverdue);

          const totalPending = sortedPOs
            .filter((po) => !["received", "cancelled"].includes(po.status || "draft"))
            .reduce((s, po) => s + Number(po.total_amount || 0), 0);

          return (
            <div className="space-y-3 mt-1">
              {/* Stats bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <p className="text-[10px] text-white/40 uppercase font-black tracking-wider">Este mes</p>
                  <p className="text-white text-lg font-black tabular-nums mt-1">${monthTotal.toFixed(2)}</p>
                  <p className="text-[10px] text-white/30 font-bold">{monthPOs.length} orden{monthPOs.length === 1 ? "" : "es"}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/20">
                  <p className="text-[10px] text-amber-400/70 uppercase font-black tracking-wider">Pendiente</p>
                  <p className="text-amber-300 text-lg font-black tabular-nums mt-1">${pendingTotal.toFixed(2)}</p>
                  <p className="text-[10px] text-amber-400/50 font-bold">{pendingPOs.length} sin recibir</p>
                </div>
                <div className={`p-3 rounded-xl border ${overduePOs.length > 0 ? "bg-red-500/[0.05] border-red-500/25" : "bg-white/[0.03] border-white/[0.08]"}`}>
                  <p className={`text-[10px] uppercase font-black tracking-wider ${overduePOs.length > 0 ? "text-red-400/70" : "text-white/40"}`}>Vencidas</p>
                  <p className={`text-lg font-black tabular-nums mt-1 ${overduePOs.length > 0 ? "text-red-300" : "text-white/40"}`}>{overduePOs.length}</p>
                  <p className={`text-[10px] font-bold ${overduePOs.length > 0 ? "text-red-400/50" : "text-white/30"}`}>
                    {overduePOs.length > 0 ? "requieren atención" : "todo al día"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                  <p className="text-[10px] text-white/40 uppercase font-black tracking-wider">Total OCs</p>
                  <p className="text-white text-lg font-black tabular-nums mt-1">{allPOs.length}</p>
                  <p className="text-[10px] text-white/30 font-bold">registradas</p>
                </div>
              </div>

              {/* Header acciones */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => { setEditingPO(null); setShowPODialog(true); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/20 text-cyan-300 text-xs font-black hover:bg-cyan-500/25 transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" /> Nueva orden de compra
                </button>
                <button
                  onClick={() => setShowImportPO(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/20 text-violet-300 text-xs font-black hover:bg-violet-500/25 transition-all active:scale-95"
                  title="Sube una foto, PDF o CSV y Jeani la convierte en orden de compra"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Importar con Jeani
                </button>
                {(() => {
                  const lowStock = (poProducts || []).filter((p) => {
                    const s = Number(p.stock || 0);
                    const m = Number(p.min_stock || 0);
                    return m > 0 && s < m && p.active !== false;
                  });
                  if (lowStock.length === 0) return null;
                  return (
                    <button
                      onClick={() => setShowReorderModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-300 text-xs font-black hover:bg-amber-500/25 transition-all active:scale-95"
                      title="Productos con stock bajo del mínimo"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" /> Reordenar ({lowStock.length})
                    </button>
                  );
                })()}
                {displayPOs.length > 0 && (
                  <button
                    onClick={() => {
                      const rows = [
                        ["PO Number", "Proveedor", "Estado", "Fecha orden", "Fecha esperada", "Items", "Subtotal", "Impuesto", "Envío", "Total", "Notas"].join(","),
                        ...displayPOs.map((po) => {
                          const notes = String(po.notes || "")
                            .replace(/\[PAID:[^\]]+\]/g, "")
                            .replace(/\[STOCKED\]/g, "")
                            .replace(/📎\s*Archivo importado:\s*\S+/g, "")
                            .replace(/"/g, '""')
                            .replace(/[\r\n]+/g, " ")
                            .trim();
                          return [
                            `"${po.po_number || ""}"`,
                            `"${(po.supplier_name || "").replace(/"/g, '""')}"`,
                            po.status || "draft",
                            String(po.order_date || "").slice(0, 10),
                            String(po.expected_date || "").slice(0, 10),
                            (po.line_items || po.items || []).length,
                            Number(po.subtotal || 0).toFixed(2),
                            Number(po.tax_amount || 0).toFixed(2),
                            Number(po.shipping_cost || 0).toFixed(2),
                            Number(po.total_amount || 0).toFixed(2),
                            `"${notes}"`,
                          ].join(",");
                        }),
                      ].join("\n");
                      const blob = new Blob(["\ufeff" + rows], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `ordenes_compra_${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success(`Exportadas ${displayPOs.length} órdenes a CSV`);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs font-black hover:text-white transition-all active:scale-95"
                    title="Descargar las OCs filtradas como CSV"
                  >
                    <Download className="w-3.5 h-3.5" /> Exportar CSV
                  </button>
                )}
                <div className="ml-auto flex items-center gap-2 text-xs">
                  <span className="text-white/40 font-bold">Filtradas:</span>
                  <span className="text-amber-300 font-black tabular-nums">${totalPending.toFixed(2)}</span>
                </div>
              </div>

              {/* Bulk actions bar */}
              {selectedPOIds.size > 0 && (
                <div className="flex items-center gap-2 p-2 rounded-xl bg-cyan-500/[0.08] border border-cyan-500/25 flex-wrap">
                  <span className="text-xs font-black text-cyan-300">
                    {selectedPOIds.size} seleccionada{selectedPOIds.size === 1 ? "" : "s"}
                  </span>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`¿Marcar ${selectedPOIds.size} como recibidas? Esto incrementará el stock automáticamente.`)) return;
                      setBulkActionLoading(true);
                      let ok = 0;
                      for (const id of selectedPOIds) {
                        try {
                          await dataClient.entities.PurchaseOrder.update(id, { status: "received" });
                          ok++;
                        } catch (err) {
                          console.warn("Bulk mark received failed for", id, err);
                        }
                      }
                      setBulkActionLoading(false);
                      setSelectedPOIds(new Set());
                      toast.success(`${ok} orden${ok === 1 ? "" : "es"} marcada${ok === 1 ? "" : "s"} como recibida${ok === 1 ? "" : "s"}`);
                      loadData();
                    }}
                    disabled={bulkActionLoading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-300 text-[11px] font-black hover:bg-emerald-500/25 disabled:opacity-40"
                  >
                    {bulkActionLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : "✅"}
                    Marcar recibidas
                  </button>
                  {canDeletePO && (
                    <button
                      onClick={async () => {
                        if (!window.confirm(`¿Borrar ${selectedPOIds.size} orden${selectedPOIds.size === 1 ? "" : "es"} de compra? Esta acción no se puede deshacer.`)) return;
                        setBulkActionLoading(true);
                        let ok = 0;
                        for (const id of selectedPOIds) {
                          try {
                            await dataClient.entities.PurchaseOrder.delete(id);
                            ok++;
                          } catch (err) {
                            console.warn("Bulk delete failed for", id, err);
                          }
                        }
                        setBulkActionLoading(false);
                        setSelectedPOIds(new Set());
                        toast.success(`${ok} orden${ok === 1 ? "" : "es"} borrada${ok === 1 ? "" : "s"}`);
                        loadData();
                      }}
                      disabled={bulkActionLoading}
                      title="Borrar (solo admin)"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-[11px] font-black hover:bg-red-500/20 disabled:opacity-40"
                    >
                      <Trash2 className="w-3 h-3" />
                      Borrar
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedPOIds(new Set())}
                    className="ml-auto px-2 py-1 text-[10px] text-white/50 hover:text-white font-bold"
                  >
                    Limpiar selección
                  </button>
                </div>
              )}

              {/* Quick filter chips */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { id: "all", label: "Todas", count: allPOs.length },
                  { id: "week", label: "Esta semana", count: allPOs.filter((po) => { const d = String(po.created_date || po.created_at || po.order_date || "").slice(0, 10); return d >= weekAgo; }).length },
                  { id: "overdue", label: "⚠ Vencidas", count: overduePOs.length },
                  { id: "unpaid", label: "Sin pagar", count: allPOs.filter((po) => !["received", "cancelled"].includes(po.status || "draft") && !/\[PAID:[^\]]+\]/.test(po.notes || "")).length },
                  { id: "drafts", label: "Borradores", count: allPOs.filter((po) => (po.status || "draft") === "draft").length },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setPoQuickFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all ${
                      poQuickFilter === f.id
                        ? f.id === "overdue" ? "bg-red-600 border-red-600 text-white"
                          : "bg-cyan-600 border-cyan-600 text-white"
                        : "bg-white/[0.04] border-white/[0.08] text-white/50 hover:text-white/80"
                    }`}
                  >
                    {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
                  </button>
                ))}
              </div>

              {/* Búsqueda + sort */}
              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  value={poSearch}
                  onChange={(e) => setPoSearch(e.target.value)}
                  placeholder="Buscar por número, proveedor o nota…"
                  className="max-w-xs bg-white/[0.04] border-white/10 text-white text-xs"
                />
                <div className="flex gap-1 items-center ml-auto flex-wrap">
                  <div className="flex gap-0.5 bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
                    <button
                      onClick={() => setPoViewMode("list")}
                      className={`px-2 py-1 rounded text-[10px] font-black transition-all ${
                        poViewMode === "list" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      Lista
                    </button>
                    <button
                      onClick={() => setPoViewMode("grouped")}
                      className={`px-2 py-1 rounded text-[10px] font-black transition-all ${
                        poViewMode === "grouped" ? "bg-white/15 text-white" : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      Por proveedor
                    </button>
                  </div>
                  <span className="text-[10px] text-white/40 font-black uppercase ml-2">Ordenar:</span>
                  <select
                    value={poSortBy}
                    onChange={(e) => setPoSortBy(e.target.value)}
                    className="bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white font-bold"
                  >
                    <option value="date">Fecha</option>
                    <option value="total">Total</option>
                    <option value="supplier">Proveedor</option>
                  </select>
                  <button
                    onClick={() => setPoSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="px-2 py-1 rounded-lg bg-white/[0.04] border border-white/10 text-white/60 text-[11px] font-bold hover:text-white"
                    title={poSortDir === "asc" ? "Ascendente" : "Descendente"}
                  >
                    {poSortDir === "asc" ? "↑" : "↓"}
                  </button>
                </div>
              </div>

              {/* Lista */}
              {loading ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-white/20" />
                  <p className="text-xs text-white/20 font-bold">Cargando órdenes…</p>
                </div>
              ) : displayPOs.length === 0 ? (
                <div className="py-16 text-center bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                  <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-white/20" />
                  {allPOs.length === 0 ? (
                    <>
                      <p className="text-white font-black text-base">Aún no hay órdenes de compra</p>
                      <p className="text-white/40 text-xs mt-1 mb-4">
                        Crea una manualmente o importa una foto/PDF con Jeani
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => { setEditingPO(null); setShowPODialog(true); }}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/25 text-cyan-300 text-xs font-black hover:bg-cyan-500/25"
                        >
                          <Plus className="w-3.5 h-3.5" /> Crear manual
                        </button>
                        <button
                          onClick={() => setShowImportPO(true)}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-200 text-xs font-black hover:bg-violet-500/30"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Importar con Jeani
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-white/60 font-black text-sm">Sin resultados</p>
                      <p className="text-white/30 text-[11px] mt-1">
                        Ajusta los filtros o busca con otros términos
                      </p>
                      <button
                        onClick={() => { setPoQuickFilter("all"); setPoSearch(""); setPoStatusFilter("all"); }}
                        className="mt-3 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10 text-white/60 text-[11px] font-bold hover:text-white"
                      >
                        Limpiar filtros
                      </button>
                    </>
                  )}
                </div>
              ) : poViewMode === "grouped" ? (
                <div className="space-y-3">
                  {(() => {
                    const groups = new Map();
                    for (const po of displayPOs) {
                      const key = po.supplier_name || "Sin proveedor";
                      if (!groups.has(key)) groups.set(key, []);
                      groups.get(key).push(po);
                    }
                    const arr = Array.from(groups.entries()).sort((a, b) => {
                      const tA = a[1].reduce((s, po) => s + Number(po.total_amount || 0), 0);
                      const tB = b[1].reduce((s, po) => s + Number(po.total_amount || 0), 0);
                      return tB - tA;
                    });
                    return arr.map(([name, items]) => {
                      const total = items.reduce((s, po) => s + Number(po.total_amount || 0), 0);
                      const pending = items.filter((po) => !["received", "cancelled"].includes(po.status || "draft"));
                      return (
                        <div key={name} className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-3">
                          <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-white/[0.06]">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-black text-white truncate">📦 {name}</p>
                              <p className="text-[10px] text-white/40">
                                {items.length} orden{items.length === 1 ? "" : "es"}
                                {pending.length > 0 && ` · ${pending.length} pendiente${pending.length === 1 ? "" : "s"}`}
                              </p>
                            </div>
                            <p className="text-base font-black text-white tabular-nums shrink-0">${total.toFixed(2)}</p>
                          </div>
                          <div className="space-y-1">
                            {items.map((po) => {
                              const st = po.status || "draft";
                              return (
                                <button
                                  key={po.id}
                                  onClick={() => setViewingPO(po)}
                                  className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                                >
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${statusColor(st)}`}>
                                    {statusLabel(st)}
                                  </span>
                                  <span className="flex-1 min-w-0 text-xs text-white/70 truncate">
                                    {po.po_number || `OC-${String(po.id || "").slice(-6)}`}
                                  </span>
                                  {isOverdue(po) && (
                                    <span className="text-[9px] text-red-400 font-black">⚠ Vencida</span>
                                  )}
                                  <span className="text-xs font-black text-white tabular-nums">${Number(po.total_amount || 0).toFixed(2)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {displayPOs.map((po) => {
                    const itemsCount = (po.items || po.line_items || []).length;
                    const date = po.created_date || po.created_at || po.order_date;
                    const status = po.status || "draft";
                    const isDeletingThis = deletingPOId === po.id;
                    return (
                      <div
                        key={po.id}
                        className={`group flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                          selectedPOIds.has(po.id)
                            ? "bg-cyan-500/[0.08] border-cyan-500/30"
                            : "bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.06]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPOIds.has(po.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedPOIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(po.id)) next.delete(po.id);
                              else next.add(po.id);
                              return next;
                            });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 accent-cyan-500 shrink-0 cursor-pointer"
                        />
                        <button
                          type="button"
                          onClick={() => setViewingPO(po)}
                          className="flex-1 min-w-0 flex items-center gap-3 text-left"
                        >
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-cyan-500/10 text-cyan-400">
                            <Truck className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-white font-black text-sm truncate">
                                {po.po_number || `OC-${String(po.id || "").slice(-6)}`}
                              </p>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${statusColor(status)}`}>
                                {statusLabel(status)}
                              </span>
                              {isOverdue(po) && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-red-500/20 text-red-300 border border-red-500/30">
                                  ⚠ Vencida {Math.abs(daysUntilExpected(po))}d
                                </span>
                              )}
                              {!isOverdue(po) && po.expected_date && !["received", "cancelled"].includes(status) && (() => {
                                const d = daysUntilExpected(po);
                                if (d == null) return null;
                                return (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                    Llega en {d === 0 ? "hoy" : `${d}d`}
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-[11px] text-white/40 truncate">
                              {po.supplier_name || "Suplidor no definido"} · {itemsCount} productos
                              {date ? ` · ${format(new Date(date), "dd MMM yyyy", { locale: es })}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-0.5 shrink-0">
                            <p className="text-sm font-black text-white tabular-nums">
                              ${Number(po.total_amount || 0).toFixed(2)}
                            </p>
                            {(() => {
                              const m = estimatedMargin(po);
                              if (m.margin <= 0) return null;
                              return (
                                <p className="text-[10px] font-black text-emerald-400 tabular-nums" title={`Ingreso estimado: $${m.revenue.toFixed(2)}`}>
                                  +${m.margin.toFixed(0)} ({m.pct.toFixed(0)}%)
                                </p>
                              );
                            })()}
                          </div>
                          <Eye className="w-4 h-4 text-white/30 shrink-0" />
                        </button>
                        {canDeletePO && (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = window.confirm(
                                `¿Borrar la orden de compra ${po.po_number || ""}?\n\nEsto NO borra los gastos ya registrados en Finanzas (esos hay que borrarlos por separado si existen).`,
                              );
                              if (!ok) return;
                              setDeletingPOId(po.id);
                              try {
                                await dataClient.entities.PurchaseOrder.delete(po.id);
                                setPurchaseOrders((list) => list.filter((x) => x.id !== po.id));
                                toast.success("Orden de compra borrada");
                              } catch (err) {
                                console.error("Delete PO error:", err);
                                toast.error("No se pudo borrar: " + (err?.message || ""));
                              } finally {
                                setDeletingPOId(null);
                              }
                            }}
                            disabled={isDeletingThis}
                            title="Borrar orden de compra (solo admin)"
                            className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-red-500/20 text-white/30 hover:text-red-400 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-40"
                          >
                            {isDeletingThis ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Spend Analytics — por proveedor */}
              {allPOs.length >= 2 && (() => {
                const bySup = new Map();
                for (const po of allPOs) {
                  const name = po.supplier_name || "Sin proveedor";
                  const amt = Number(po.total_amount || 0);
                  bySup.set(name, (bySup.get(name) || 0) + amt);
                }
                const chartData = Array.from(bySup.entries())
                  .map(([name, total]) => ({ name: name.length > 18 ? name.slice(0, 16) + "…" : name, total }))
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 10);
                if (chartData.length < 2) return null;
                const colors = ["#06b6d4", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#6366f1", "#84cc16", "#f97316"];
                return (
                  <div className="mt-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black text-white/60 uppercase tracking-wider">
                        💰 Gasto por proveedor (histórico)
                      </p>
                      <p className="text-[10px] text-white/30">Top {chartData.length}</p>
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                        <XAxis type="number" tick={{ fill: "#ffffff60", fontSize: 10 }} axisLine={{ stroke: "#ffffff10" }} tickFormatter={(v) => `$${v.toFixed(0)}`} />
                        <YAxis type="category" dataKey="name" width={130} tick={{ fill: "#ffffff80", fontSize: 11 }} axisLine={{ stroke: "#ffffff10" }} />
                        <Tooltip
                          cursor={{ fill: "#ffffff08" }}
                          contentStyle={{ background: "#111114", border: "1px solid #ffffff20", borderRadius: "8px", fontSize: "11px" }}
                          formatter={(v) => [`$${Number(v).toFixed(2)}`, "Total"]}
                        />
                        <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                          {chartData.map((_, i) => (
                            <Cell key={i} fill={colors[i % colors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    {/* Insight */}
                    {(() => {
                      const top = chartData[0];
                      const totalAll = chartData.reduce((s, d) => s + d.total, 0);
                      const pctTop = totalAll > 0 ? (top.total / totalAll) * 100 : 0;
                      return (
                        <p className="text-[11px] text-white/50 mt-2">
                          💡 <span className="text-white/80 font-bold">{top.name}</span> representa el{" "}
                          <span className="text-cyan-300 font-black">{pctTop.toFixed(0)}%</span>{" "}
                          de tus compras (${top.total.toFixed(0)} de ${totalAll.toFixed(0)} total)
                        </p>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Tab: Reportes — lazy mount */}
        {activeTab === "reportes" && (
          <PlanGate feature="reports_financial" fallback={<UpgradePrompt feature="reports_financial" message="Reportes financieros disponibles en el plan Business" />}>
          <div className="space-y-3 mt-1">
            <div className="flex gap-2">
              <PlanGate feature="reports_export_csv" fallback={<UpgradePrompt feature="reports_export_csv" inline />}>
              <button onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-indigo-300 text-xs font-black hover:bg-indigo-500/25 transition-all active:scale-95">
                <Download className="w-3.5 h-3.5" /> Exportar CSV
              </button>
              </PlanGate>
              <PlanGate feature="reports_export_csv" fallback={<UpgradePrompt feature="reports_export_csv" inline />}>
              <button onClick={exportAccountingCSV}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/15 text-emerald-300 text-xs font-black hover:bg-emerald-500/20 transition-all active:scale-95">
                <Download className="w-3.5 h-3.5" /> Contabilidad CSV
              </button>
              </PlanGate>
              <button onClick={() => setShowMonthlyReport(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/50 text-xs font-black hover:text-white transition-all active:scale-95">
                <PieChart className="w-3.5 h-3.5" /> Reporte Mensual
              </button>
              <button onClick={fetchAiSummary} disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500/15 border border-violet-500/20 text-violet-300 text-xs font-black hover:bg-violet-500/25 transition-all active:scale-95 disabled:opacity-50 ml-auto">
                {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {aiLoading ? "Analizando…" : "Analizar IA"}
              </button>
            </div>

            {(aiSummary || aiLoading) && (
              <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/20">
                {aiLoading && !aiSummary ? (
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{animationDelay:"0ms"}} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{animationDelay:"150ms"}} />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{animationDelay:"300ms"}} />
                    <span className="text-xs text-violet-400/60 font-bold ml-1">Analizando…</span>
                  </div>
                ) : (
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-line">{aiSummary}</p>
                )}
              </div>
            )}

            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4">
              <ErrorBoundary>
                <EnhancedReports dateFilter={dateFilter} customStartDate={customStartDate} customEndDate={customEndDate} />
              </ErrorBoundary>
            </div>
          </div>
          </PlanGate>
        )}

        {/* Tab: Técnicos */}
        {activeTab === "tecnicos" && (
          <PlanGate feature="reports_by_technician" fallback={<UpgradePrompt feature="reports_by_technician" message="Reportes por técnico disponibles en el plan Pro" />}>
          <div className="mt-1">
            <ErrorBoundary>
              <TechnicianProductivityTab
                dateFilter={dateFilter}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
              />
            </ErrorBoundary>
          </div>
          </PlanGate>
        )}

        {/* Tab: Desglose Neto — tabla por venta */}
        {activeTab === "desglose" && (() => {
          const desgloseRows = filteredSales.map(sale => {
            const items = Array.isArray(sale?.items) ? sale.items : [];
            const salePartsCost = items.reduce((s, item) => {
              const qty = Number(item?.quantity || 0);
              return s + Number(item?.line_cost || (Number(item?.cost || 0) * qty));
            }, 0);
            const saleIVU = Number(sale.tax_amount || 0);
            const saleCobrado = Number(sale.total || 0);
            const saleNeta = saleCobrado - saleIVU - salePartsCost;
            const desc = items.length > 0
              ? items.map(i => i.name || i.service_name || i.product_name || "Artículo").join(", ")
              : sale.notes || "Sin descripción";
            return {
              id: sale.id,
              cliente: sale.customer_name || "Consumidor Final",
              desc,
              fecha: getEntityDate(sale),
              cobrado: saleCobrado,
              piezas: salePartsCost,
              ivu: saleIVU,
              neta: saleNeta,
            };
          });

          const totCobrado  = desgloseRows.reduce((s, r) => s + r.cobrado, 0);
          const totPiezas   = desgloseRows.reduce((s, r) => s + r.piezas,  0);
          const totIVU      = desgloseRows.reduce((s, r) => s + r.ivu,     0);
          const totNeta     = desgloseRows.reduce((s, r) => s + r.neta,    0);

          return (
            <div className="space-y-2 mt-1">
              {loading ? (
                <div className="py-12 text-center">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-white/20" />
                  <p className="text-xs text-white/20 font-bold">Cargando…</p>
                </div>
              ) : desgloseRows.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-white/25 font-bold text-sm">Sin ventas en este período</p>
                </div>
              ) : (
                desgloseRows.map(r => {
                  const netaPositive = r.neta >= 0;
                  return (
                    <div key={r.id} className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] transition-all space-y-3">
                      {/* Fila superior: info secundaria + ganancia neta destacada */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                            <TrendingUp className="w-3 h-3" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-white/60 font-bold text-xs truncate leading-tight">{r.cliente}</p>
                            <p className="text-[10px] text-white/25 truncate">
                              {r.desc}{r.fecha ? ` · ${format(new Date(r.fecha), "dd MMM, h:mm a", { locale: es })}` : ""}
                            </p>
                          </div>
                        </div>
                        {/* Ganancia neta — número prominente */}
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-0.5">Neta</p>
                          <p className={`text-xl font-black tabular-nums leading-none ${netaPositive ? "text-cyan-400" : "text-red-400"}`}>
                            {netaPositive ? "+" : "−"}${Math.abs(r.neta).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      {/* Fila inferior: 3 chips de desglose */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-emerald-500/[0.08] border border-emerald-500/15 rounded-xl px-3 py-2 text-center">
                          <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">Cobrado</p>
                          <p className="text-sm font-black text-emerald-400 tabular-nums mt-0.5">${r.cobrado.toFixed(2)}</p>
                        </div>
                        <div className="bg-orange-500/[0.08] border border-orange-500/15 rounded-xl px-3 py-2 text-center">
                          <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">Piezas</p>
                          <p className="text-sm font-black text-orange-400 tabular-nums mt-0.5">
                            {r.piezas > 0 ? `$${r.piezas.toFixed(2)}` : "$0.00"}
                          </p>
                        </div>
                        <div className="bg-amber-500/[0.08] border border-amber-500/15 rounded-xl px-3 py-2 text-center">
                          <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">IVU</p>
                          <p className="text-sm font-black text-amber-400 tabular-nums mt-0.5">
                            {r.ivu > 0 ? `$${r.ivu.toFixed(2)}` : "$0.00"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Tarjeta de totales */}
              {desgloseRows.length > 0 && (
                <div className={`p-4 rounded-2xl border-2 space-y-3 mt-1 ${totNeta >= 0 ? "bg-cyan-500/[0.06] border-cyan-500/25" : "bg-red-500/[0.06] border-red-500/25"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-black text-sm">Total del período</p>
                      <p className="text-[10px] text-white/30">{desgloseRows.length} venta{desgloseRows.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-0.5">Neta total</p>
                      <p className={`text-2xl font-black tabular-nums leading-none ${totNeta >= 0 ? "text-cyan-400" : "text-red-400"}`}>
                        {totNeta >= 0 ? "+" : "−"}${Math.abs(totNeta).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-emerald-500/[0.08] border border-emerald-500/15 rounded-xl px-3 py-2 text-center">
                      <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">Cobrado</p>
                      <p className="text-sm font-black text-emerald-400 tabular-nums mt-0.5">${totCobrado.toFixed(2)}</p>
                    </div>
                    <div className="bg-orange-500/[0.08] border border-orange-500/15 rounded-xl px-3 py-2 text-center">
                      <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">Piezas</p>
                      <p className="text-sm font-black text-orange-400 tabular-nums mt-0.5">${totPiezas.toFixed(2)}</p>
                    </div>
                    <div className="bg-amber-500/[0.08] border border-amber-500/15 rounded-xl px-3 py-2 text-center">
                      <p className="text-[9px] font-black text-white/25 uppercase tracking-widest">IVU</p>
                      <p className="text-sm font-black text-amber-400 tabular-nums mt-0.5">${totIVU.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

          </div>{/* fin main content */}
        </div>{/* fin lg:flex */}
      </div>{/* fin max-w-7xl outer */}

      {/* ── Dialogs ── */}
      {showOpenDrawer && <OpenDrawerDialog open={showOpenDrawer} onClose={() => setShowOpenDrawer(false)} onSuccess={handleActionSuccess} />}
      {showCloseDrawer && <CloseDrawerDialog open={showCloseDrawer} onClose={() => setShowCloseDrawer(false)} onSuccess={handleActionSuccess} drawer={currentDrawer} />}
      {showExpenseDialog && <ExpenseDialog open={showExpenseDialog} onClose={() => setShowExpenseDialog(false)} onSuccess={handleActionSuccess} drawer={currentDrawer} defaultCategory={expenseDefaultCategory} />}
      {showTimeTrackingModal && (
        <TimeTrackingModal open={showTimeTrackingModal} onClose={() => { setShowTimeTrackingModal(false); loadData(); }} session={null} />
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
      <MonthlyReportModal
        open={showMonthlyReport}
        onClose={() => setShowMonthlyReport(false)}
      />

      {/* ── Órdenes de Compra ── */}
      {showPODialog && (
        <PurchaseOrderDialog
          open={showPODialog}
          onClose={() => { setShowPODialog(false); setEditingPO(null); loadData(); }}
          purchaseOrder={editingPO}
          suppliers={suppliers}
          products={poProducts}
        />
      )}
      {viewingPO && (
        <PurchaseOrderDetailDialog
          open={Boolean(viewingPO)}
          onClose={() => { setViewingPO(null); loadData(); }}
          purchaseOrder={viewingPO}
          suppliers={suppliers}
          products={poProducts}
        />
      )}
      {showImportPO && (
        <ImportPODialog
          open={showImportPO}
          onClose={() => { setShowImportPO(false); loadData(); }}
          suppliers={suppliers}
          products={poProducts}
          workOrders={poWorkOrders}
          existingPOs={purchaseOrders}
        />
      )}

      {/* Modal — Reorden de productos con stock bajo */}
      {showReorderModal && (() => {
        const lowStock = (poProducts || []).filter((p) => {
          const s = Number(p.stock || 0);
          const m = Number(p.min_stock || 0);
          return m > 0 && s < m && p.active !== false;
        });
        // Agrupar por supplier_id (los sin proveedor van a "sin proveedor")
        const bySupplier = new Map();
        for (const p of lowStock) {
          const key = p.supplier_id || "__none__";
          if (!bySupplier.has(key)) bySupplier.set(key, []);
          bySupplier.get(key).push(p);
        }
        const createReorderPO = async (supplierId, items) => {
          setCreatingReorderPO(supplierId);
          try {
            const supplier = suppliers.find((s) => s.id === supplierId);
            const lineItems = items.map((p, i) => {
              const needed = Math.max(1, Number(p.min_stock || 5) * 2 - Number(p.stock || 0));
              const cost = Number(p.cost || 0);
              return {
                id: `li-${Date.now()}-${i}`,
                inventory_item_id: p.id,
                product_name: p.name,
                quantity: needed,
                unit_cost: cost,
                line_total: needed * cost,
              };
            });
            const subtotal = lineItems.reduce((s, it) => s + it.line_total, 0);
            const poNumber = `PO-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 900 + 100)}`;
            await dataClient.entities.PurchaseOrder.create({
              po_number: poNumber,
              supplier_id: supplierId && supplierId !== "__none__" ? supplierId : "",
              supplier_name: supplier?.name || "Sin proveedor",
              status: "draft",
              order_date: new Date().toISOString().slice(0, 10),
              line_items: lineItems,
              subtotal,
              total_amount: subtotal,
              currency: "USD",
              notes: `Reorden automática de ${items.length} producto${items.length === 1 ? "" : "s"} con stock bajo`,
            });
            toast.success(`Borrador creado: ${poNumber} con ${items.length} items`);
            await loadData();
          } catch (err) {
            console.error("Reorder PO error:", err);
            toast.error("No se pudo crear: " + (err?.message || ""));
          } finally {
            setCreatingReorderPO(null);
          }
        };
        return (
          <Dialog open={showReorderModal} onOpenChange={(v) => !v && setShowReorderModal(false)}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-zinc-950 border-white/10 text-white">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Reordenar productos con stock bajo
                </DialogTitle>
              </DialogHeader>
              <p className="text-xs text-white/50">
                {lowStock.length} producto{lowStock.length === 1 ? "" : "s"} con stock por debajo del mínimo,
                agrupados por proveedor. Crea un borrador de OC por cada proveedor con la cantidad sugerida
                (2× el stock mínimo).
              </p>
              <div className="space-y-3 mt-2">
                {Array.from(bySupplier.entries()).map(([supId, items]) => {
                  const supplier = suppliers.find((s) => s.id === supId);
                  const name = supplier?.name || "Sin proveedor asignado";
                  const totalCost = items.reduce((s, p) => {
                    const needed = Math.max(1, Number(p.min_stock || 5) * 2 - Number(p.stock || 0));
                    return s + Number(p.cost || 0) * needed;
                  }, 0);
                  return (
                    <div key={supId} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black text-white truncate">{name}</p>
                          <p className="text-[11px] text-white/40">
                            {items.length} producto{items.length === 1 ? "" : "s"} · Total estimado ${totalCost.toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => createReorderPO(supId, items)}
                          disabled={creatingReorderPO === supId}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 text-xs font-black hover:bg-cyan-500/30 disabled:opacity-40"
                        >
                          {creatingReorderPO === supId ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Crear OC
                        </button>
                      </div>
                      <div className="space-y-1">
                        {items.map((p) => {
                          const needed = Math.max(1, Number(p.min_stock || 5) * 2 - Number(p.stock || 0));
                          return (
                            <div key={p.id} className="flex items-center gap-2 text-[11px] py-1">
                              <span className="flex-1 text-white/70 truncate">{p.name}</span>
                              <span className="text-red-400 font-bold tabular-nums">Stock: {p.stock || 0}/{p.min_stock}</span>
                              <span className="text-emerald-400 font-black tabular-nums w-16 text-right">Pedir: {needed}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <DialogFooter>
                <button
                  onClick={() => setShowReorderModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white/60 text-xs font-bold hover:text-white"
                >
                  Cerrar
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

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
      <DialogContent className="max-w-[95vw] sm:max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden p-0">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-600 to-blue-600" />

        <div className="p-5">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                <Target className="w-4 h-4 text-cyan-400" />
              </div>
              <DialogTitle className="text-xl font-black text-white tracking-tight text-left">
                {expense ? "Configurar Distribución" : "Nueva Distribución"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Nombre del Gasto</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej. Renta del Local"
                className="bg-white/5 border-white/10 text-white h-11 rounded-2xl px-4 focus:border-cyan-500/50 font-bold"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Categoría</label>
              <div className="grid grid-cols-5 gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, category: cat.value, icon: cat.icon })}
                    className={`flex flex-col items-center justify-center py-2.5 rounded-xl border transition-all text-[8px] font-black uppercase tracking-tight ${
                      formData.category === cat.value
                        ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400"
                        : "bg-white/5 border-white/5 text-white/40 hover:border-white/20"
                    }`}
                  >
                    <span className="text-lg mb-0.5">{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Aporte Fijo ($)</label>
                <Input type="number" step="0.01" value={formData.fixed_amount} onChange={(e) => setFormData({ ...formData, fixed_amount: e.target.value })} placeholder="0.00" className="bg-white/5 border-white/10 text-white h-11 rounded-2xl px-4 focus:border-cyan-500/50 font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Utilidad (%)</label>
                <Input type="number" step="0.1" value={formData.percentage} onChange={(e) => setFormData({ ...formData, percentage: e.target.value })} placeholder="0" className="bg-white/5 border-white/10 text-white h-11 rounded-2xl px-4 focus:border-cyan-500/50 font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Frecuencia</label>
                <select value={formData.frequency} onChange={(e) => setFormData({ ...formData, frequency: e.target.value })} className="w-full bg-white/5 border border-white/10 text-white rounded-2xl h-11 px-4 font-bold focus:outline-none focus:border-cyan-500/50 appearance-none cursor-pointer">
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
                <Input type="number" value={formData.due_day} onChange={(e) => setFormData({ ...formData, due_day: e.target.value })} placeholder="Ej. 5" className="bg-white/5 border-white/10 text-white h-11 rounded-2xl px-4 focus:border-cyan-500/50 font-bold" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" onClick={onClose} className="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white h-12 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white h-12 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all">
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
      <DialogContent className="max-w-md bg-[#0A0A0A] border border-red-500/20 rounded-2xl p-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-600 to-orange-600" />
        <div className="p-5">
          <DialogHeader className="mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <Receipt className="w-4 h-4 text-red-400" />
              </div>
              <DialogTitle className="text-xl font-black text-white tracking-tight text-left">
                Editar Movimiento
              </DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Monto ($)</label>
              <Input type="number" step="0.01" min="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className="bg-white/5 border-white/10 text-white h-11 rounded-2xl px-4 focus:border-red-500/50 font-bold" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Descripción</label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="bg-white/5 border-white/10 text-white h-11 rounded-2xl px-4 focus:border-red-500/50 font-bold" required />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-1">Categoría</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full bg-white/5 border border-white/10 text-white rounded-2xl h-11 px-4 font-bold focus:outline-none focus:border-red-500/50 appearance-none cursor-pointer">
                {categories.map((cat) => (<option key={cat.value} value={cat.value}>{cat.label}</option>))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" onClick={onClose} className="flex-1 bg-white/5 border border-white/10 text-white h-12 rounded-2xl font-black uppercase tracking-widest hover:bg-white/10 transition-all">Cancelar</Button>
              <Button type="submit" className="flex-1 bg-gradient-to-r from-red-600 to-orange-600 text-white h-12 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all">Guardar</Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
