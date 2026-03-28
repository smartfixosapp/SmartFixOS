import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from "react";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import {
  ClipboardList,
  Wallet,
  StickyNote,
  Search,
  Clock,
  Settings as SettingsIcon,
  Users,
  Wrench,
  Bell,
  Smartphone,
  Zap,
  LogOut,
  Package,
  BarChart3,
  ExternalLink,
  Link,
  LayoutGrid,
  AlertCircle,
  X,
  CheckCircle2,
  Shield,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  PackageCheck,
  Timer,
  ShoppingCart,
  ChevronRight
} from "lucide-react";

import { format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/components/utils/i18n";
import { createPageUrl } from "@/components/utils/helpers";
import PunchButton from "@/components/dashboard/PunchButton";
import { debounce, catalogCache } from "@/components/utils/dataCache";

import WorkOrderWizard from "../components/workorder/WorkOrderWizard";
import FirstTimeSetupWizard, { isSetupComplete } from "../components/onboarding/FirstTimeSetupWizard";
import MobileMoreMenu from "../components/dashboard/MobileMoreMenu";
import { useDeviceDetection } from "../components/utils/useDeviceDetection";
import {
  Settings as SettingsIcon2,
  FileText,
  PiggyBank
} from "lucide-react";
import OpenDrawerDialog from "../components/cash/OpenDrawerDialog";
import CloseDrawerDialog from "../components/cash/CloseDrawerDialog";
import SoftwareServiceDialog from "../components/orders/SoftwareServiceDialog";
import UnlocksDialog from "../components/unlocks/UnlocksDialog";

import {
  ORDER_STATUSES,
  getStatusConfig,
  getEffectiveOrderStatus,
  normalizeStatusId
} from "@/components/utils/statusRegistry";

import WorkOrderPanel from "../components/workorder/WorkOrderPanel";
import WorkOrderPanelErrorBoundary from "../components/workorder/WorkOrderPanelErrorBoundary";
import FullNotificationPanel from "../components/notifications/FullNotificationPanel";
import UserMenuModal from "../components/layout/UserMenuModal";
import PersonalNotesWidget from "../components/dashboard/PersonalNotesWidget";
import PriorityOrdersWidget from "../components/dashboard/PriorityOrdersWidget";
import FinancialOverviewWidget from "../components/dashboard/FinancialOverviewWidget";
import SmartDailyGoalWidget from "../components/dashboard/SmartDailyGoalWidget";
import TimeTrackingModal from "../components/timetracking/TimeTrackingModal";
import LogoutModal from "../components/dashboard/LogoutModal";

import {
  getCachedStatus,
  subscribeToCashRegister,
  checkCashRegisterStatus
} from "@/components/cash/CashRegisterService";

import SmartNotificationsEngine from "../components/notifications/SmartNotificationsEngine";

// ⭐️ NUEVO IMPORT — Reparaciones rápidas
import QuickRepairPanel from "@/components/quickrepairs/QuickRepairPanel";
import RechargesPanel from "@/components/recharges/RechargesPanel";
import DashboardLinksConfig from "@/components/dashboard/DashboardLinksConfig";
import WorkQueueWidget from "@/components/dashboard/WorkQueueWidget";
import DailyTransactionsModal from "@/components/dashboard/DailyTransactionsModal";
import MonthlyReportModal, { shouldShowMonthlyReport } from "@/components/financial/MonthlyReportModal";
const DASHBOARD_WIDGETS_KEY = "smartfix_dashboard_widgets";
const CUSTOM_WIDGETS_KEY = "smartfix_custom_link_widgets";

// ------------------------

function readSessionSync() {
  try {
    const raw =
      localStorage.getItem("employee_session") ||
      sessionStorage.getItem("911-session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className="fixed top-4 right-4 z-[9999]">
      <div
        className={`min-w-[260px] max-w-sm rounded-lg border px-4 py-3 shadow-lg backdrop-blur-md ${
          toast.variant === "error"
            ? "bg-gradient-to-r from-red-600/90 to-red-800/90 border-red-400 text-white"
            : "bg-gradient-to-r from-emerald-600/90 to-emerald-800/90 border-emerald-400 text-white"
        }`}
      >
        <div className="font-semibold">{toast.title}</div>
        {toast.message && (
          <div className="text-sm opacity-90">{toast.message}</div>
        )}
        <button
          className="mt-2 text-xs underline opacity-90 hover:opacity-100"
          onClick={onClose}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------

// -----------------------------------------

export default function Dashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { isMobile, isMobileSmall, deviceType } = useDeviceDetection();

  const [session, setSession] = useState(() => readSessionSync());
  const hasRedirected = useRef(false);
  const [showMonthlyReport, setShowMonthlyReport] = useState(false);

  // Auto-show monthly report on last day of month
  useEffect(() => {
    const timer = setTimeout(() => {
      if (shouldShowMonthlyReport()) setShowMonthlyReport(true);
    }, 3000); // delay 3s after load so dashboard is ready first
    return () => clearTimeout(timer);
  }, []);

  const sessionRef = useRef(session);
  const [loading, setLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(
    () => getCachedStatus().isOpen
  );
  const [currentDrawer, setCurrentDrawer] = useState(
    () => getCachedStatus().drawer
  );

  const [recentOrders, setRecentOrders] = useState([]);
  const [activeRechargesCount, setActiveRechargesCount] = useState(0);
  const [priceListItems, setPriceListItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [priceSearch, setPriceSearch] = useState("");

  const [showWorkOrderWizard, setShowWorkOrderWizard] = useState(false);
  const [showOpenDrawer, setShowOpenDrawer] = useState(false);
  const [showCloseDrawer, setShowCloseDrawer] = useState(false);

  const lastFetchRef = useRef(0);

  const [toast, setToast] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // ⭐️ NUEVO STATE PARA REPARACIONES RÁPIDAS
  const [showQuickRepair, setShowQuickRepair] = useState(false);
  const [showRechargesPanel, setShowRechargesPanel] = useState(false);
  
  // ⭐️ ESTADO PARA SERVICIOS DE SOFTWARE
  const [showSoftwareService, setShowSoftwareService] = useState(false);
  const [showUnlocksDialog, setShowUnlocksDialog] = useState(false);
  
  // ⭐️ ESTADO FILTRO PARA ÓRDENES
  const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);
  const [showUnlocksFilter, setShowUnlocksFilter] = useState(false);
  const [showTimeTracking, setShowTimeTracking] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDashboardConfig, setShowDashboardConfig] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState(() => {
    try {
      const raw = localStorage.getItem(DASHBOARD_WIDGETS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return { kpiIncome: true, kpiGoal: true, kpiActive: true, kpiDelivered: true, kpiOverdue: true, orders: false, priceList: false, urgentOrders: false, readyPickup: false, posSalesToday: false, criticalStock: false, newCustomers: false, cashStatus: false, avgRepairTime: false, technicianLoad: false, navNewOrder: true, navOrders: true, navInventory: true, navFinancial: true, navReports: false, ...parsed };
    } catch { return { kpiIncome: true, kpiGoal: true, kpiActive: true, kpiDelivered: true, kpiOverdue: true, orders: false, priceList: false, urgentOrders: false, readyPickup: false, posSalesToday: false, criticalStock: false, newCustomers: false, cashStatus: false, avgRepairTime: false, technicianLoad: false, navNewOrder: true, navOrders: true, navInventory: true, navFinancial: true, navReports: false }; }
  });
  const [customWidgets, setCustomWidgets] = useState(() => {
    try {
      const raw = localStorage.getItem("smartfix_custom_link_widgets");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [widgetOrder, setWidgetOrder] = useState(() => {
    try {
      const raw = localStorage.getItem("smartfix_widget_order");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDailyTransactions, setShowDailyTransactions] = useState(false);
  // Widget extra data
  const [newCustomersCount, setNewCustomersCount] = useState(0);
  const [todayTxCount, setTodayTxCount] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const handleCashButtonClick = async () => {
    try {
      const status = await checkCashRegisterStatus();
      const isOpen = Boolean(status?.isOpen);
      const fallbackDrawer = currentDrawer || getCachedStatus()?.drawer || null;
      const drawer = status?.drawer || fallbackDrawer;
      setDrawerOpen(isOpen);
      setCurrentDrawer(drawer);

      if (isOpen) {
        setShowCloseDrawer(true);
        setShowOpenDrawer(false);
      } else {
        setShowOpenDrawer(true);
        setShowCloseDrawer(false);
      }
    } catch (error) {
      console.error("Error checking cash status:", error);
      const cached = getCachedStatus();
      if (cached?.isOpen && cached?.drawer) {
        setCurrentDrawer(cached.drawer);
        setShowCloseDrawer(true);
      } else {
        setShowOpenDrawer(true);
      }
    }
  };
  
  const showToast = (title, message = "", variant = "success") => {
    setToast({ title, message, variant });
    setTimeout(() => setToast(null), 2500);
  };

  // REDIRECCIÓN SI NO HAY SESIÓN
  useEffect(() => {
    if (!session && !hasRedirected.current) {
      hasRedirected.current = true;
      navigate(createPageUrl("PinAccess"));
    }
  }, [session, navigate]);

  // Cargar nombre del negocio y mostrar wizard si es primer inicio
  useEffect(() => {
    const loadBusinessName = async () => {
      const tenantId = localStorage.getItem("smartfix_tenant_id");
      if (!tenantId) return; // Super admin u otro caso — no mostrar wizard
      let foundName = "";
      try {
        const { data: rows } = await supabase
          .from("system_config")
          .select("value")
          .eq("key", "settings.branding")
          .eq("tenant_id", tenantId)
          .limit(1);
        if (rows?.length) {
          const parsed = typeof rows[0].value === "string"
            ? JSON.parse(rows[0].value)
            : rows[0].value;
          if (parsed?.business_name) foundName = parsed.business_name;
        }
      } catch { /* fallback */ }
      // Fallback: nombre del tenant
      if (!foundName) {
        try {
          const { data: t } = await supabase.from("tenant").select("name").eq("id", tenantId).single();
          if (t?.name) foundName = t.name;
        } catch { /* silent */ }
      }
      if (foundName) setBusinessName(foundName);
      if (foundName) {
        setSession((prev) => prev ? { ...prev, storeName: foundName } : prev);
        try {
          const localRaw = localStorage.getItem("employee_session");
          if (localRaw) {
            const parsed = JSON.parse(localRaw);
            localStorage.setItem("employee_session", JSON.stringify({ ...parsed, storeName: foundName }));
          }
        } catch {}
        try {
          const sessionRaw = sessionStorage.getItem("911-session");
          if (sessionRaw) {
            const parsed = JSON.parse(sessionRaw);
            sessionStorage.setItem("911-session", JSON.stringify({ ...parsed, storeName: foundName }));
          }
        } catch {}
      }
      // Mostrar wizard solo si no está completo en localStorage ni en BD
      if (!isSetupComplete()) {
        try {
          const { data: tMeta } = await supabase.from("tenant").select("metadata").eq("id", tenantId).single();
          if (tMeta?.metadata?.setup_complete === true) {
            localStorage.setItem("smartfix_setup_complete", "true"); // sincronizar
          } else {
            setShowSetupWizard(true);
          }
        } catch {
          setShowSetupWizard(true);
        }
      }
    };
    loadBusinessName();
  }, []);

  // Monitoreo caja registradora
  useEffect(() => {
    checkCashRegisterStatus();
    const unsubscribe = subscribeToCashRegister(({ isOpen, drawer }) => {
      setDrawerOpen(isOpen);
      setCurrentDrawer(drawer);
    });
    return unsubscribe;
  }, []);

  // Notificaciones inteligentes
  useEffect(() => {
    const runSmartChecks = async () => {
      const lastRun = localStorage.getItem("smart_notifications_last_run");
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

      if (!lastRun || parseInt(lastRun) < sixHoursAgo) {
        console.log("🤖 Ejecutando motor de notificaciones inteligentes...");
        await SmartNotificationsEngine.runAllChecks();
        localStorage.setItem("smart_notifications_last_run", Date.now().toString());
      }
    };
    runSmartChecks();
    const interval = setInterval(runSmartChecks, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Chequeo de sesión cada 5 segundos
  useEffect(() => {
    const tick = () => {
      const s = readSessionSync();
      setSession((prev) => (JSON.stringify(prev) !== JSON.stringify(s) ? s : prev));
    };
    const iv = setInterval(tick, 5000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const loadFreshData = useCallback(async (force = false) => {
    if (!sessionRef.current?.userId) return;

    const now = Date.now();
    if (!force && now - lastFetchRef.current < 120000) return;
    lastFetchRef.current = now;

    setLoading(true);
    try {
      // ✅ OPTIMIZACIÓN: Cargar solo órdenes activas para reducir payload
      let orderFilter =
        sessionRef.current.userRole === "technician"
          ? { 
              assigned_to: sessionRef.current.userId, 
              deleted: false,
              status: { $nin: ["delivered", "cancelled", "completed"] }
            }
          : { 
              deleted: false,
              status: { $nin: ["delivered", "cancelled", "completed"] }
            };

      const [orders, recharges, products, services] = await Promise.all([
        dataClient.entities.Order.filter(orderFilter, "-updated_date", 100).catch(err => {
          console.error("Error loading orders:", err);
          return [];
        }),
        dataClient.entities.Recharge.filter({}, "-created_date", 50).catch(err => {
          console.error("Error loading recharges:", err);
          return [];
        }),
        catalogCache.get('active_products') || dataClient.entities.Product.filter({ active: true }, "-created_date", 50).then(p => {
          catalogCache.set('active_products', p, 300000); // 5 min cache
          return p;
        }).catch(err => {
          console.error("Error loading products:", err);
          return catalogCache.get('active_products') || [];
        }),
        catalogCache.get('active_services') || dataClient.entities.Service.filter({ active: true }, "-created_date", 50).then(s => {
          catalogCache.set('active_services', s, 300000); // 5 min cache
          return s;
        }).catch(err => {
          console.error("Error loading services:", err);
          return catalogCache.get('active_services') || [];
        })
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const rechargesToday = (recharges || []).filter(r => new Date(r.created_date) >= today);
      setActiveRechargesCount(rechargesToday.length);

      // ✅ Separar órdenes con optimización
      const activeOrders = [];
      const unlockOrders = [];
      
      for (const o of (orders || [])) {
        if (o.device_type === "Software" || (o.order_number && o.order_number.startsWith("SW-"))) {
          unlockOrders.push(o);
        } else {
          activeOrders.push(o);
        }
      }

      const priceListData = [
        ...(products || []).map((p) => ({ ...p, type: "product" })),
        ...(services || []).map((s) => ({ ...s, type: "service" }))
      ];

      setRecentOrders([...activeOrders, ...unlockOrders]);
      setPriceListItems(priceListData);

      // ── Ingresos, gastos y ganancia del día / mes ─────────────────────────
      try {
        const now        = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const tenantId   = localStorage.getItem("smartfix_tenant_id");
        if (tenantId) {
          const { data: txRows } = await supabase
            .from("transaction")
            .select("amount, type, created_date")
            .eq("tenant_id", tenantId)
            .gte("created_date", monthStart);
          const rows = txRows || [];
          const todayIncome    = rows.filter(r => r.type === "income"  && r.created_date >= todayStart).reduce((s, r) => s + (Number(r.amount) || 0), 0);
          const todayExpenses  = rows.filter(r => r.type === "expense" && r.created_date >= todayStart).reduce((s, r) => s + (Number(r.amount) || 0), 0);
          const monthIncome    = rows.filter(r => r.type === "income").reduce((s, r) => s + (Number(r.amount) || 0), 0);
          setKpiIncome({ today: todayIncome, month: monthIncome, todayExpenses, loading: false });
          setTodayTxCount(rows.filter(r => r.created_date >= todayStart).length);

          // New customers this week
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          const { count: custCount } = await supabase
            .from("customer")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenantId)
            .gte("created_date", weekAgo);
          setNewCustomersCount(custCount ?? 0);
        } else {
          setKpiIncome({ today: 0, month: 0, todayExpenses: 0, loading: false });
        }
      } catch {
        setKpiIncome({ today: 0, month: 0, todayExpenses: 0, loading: false });
      }
    } catch (err) {
      console.error("Error loading data:", err);
      // No limpiar datos existentes en caso de error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;

    loadFreshData();
    loadUnreadNotifications();
    // ✅ OPTIMIZACIÓN: Aumentar intervalo a 5 minutos para reducir carga
    const iv = setInterval(() => loadFreshData(), 300000);
    return () => clearInterval(iv);
  }, [session, loadFreshData]);

  useEffect(() => {
    const handleForceRefresh = () => {
      loadFreshData(true);
    };

    const handleWorkorderDeleted = (event) => {
      const deletedOrderId = event?.detail?.orderId;
      const deletedOrderNumber = event?.detail?.orderNumber;

      setRecentOrders((prev) =>
        (prev || []).filter((order) => {
          const sameId = deletedOrderId ? String(order?.id) === String(deletedOrderId) : false;
          const sameNumber =
            deletedOrderNumber && order?.order_number
              ? String(order.order_number) === String(deletedOrderNumber)
              : false;
          return !(sameId || sameNumber);
        })
      );

      loadFreshData(true);
    };

    window.addEventListener("force-refresh", handleForceRefresh);
    window.addEventListener("workorder-created", handleForceRefresh);
    window.addEventListener("workorder-deleted", handleWorkorderDeleted);

    return () => {
      window.removeEventListener("force-refresh", handleForceRefresh);
      window.removeEventListener("workorder-created", handleForceRefresh);
      window.removeEventListener("workorder-deleted", handleWorkorderDeleted);
    };
  }, [loadFreshData]);

  useEffect(() => {
    const handleOpen = () => setShowDashboardConfig(true);
    const handleQuick = () => setShowQuickRepair(true);
    const handleWidgetUpdate = () => {
      try {
        const raw = localStorage.getItem(DASHBOARD_WIDGETS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        setWidgetConfig({ kpiIncome: true, kpiGoal: true, kpiActive: true, kpiDelivered: true, kpiOverdue: true, orders: false, priceList: false, urgentOrders: false, readyPickup: false, posSalesToday: false, criticalStock: false, newCustomers: false, cashStatus: false, avgRepairTime: false, technicianLoad: false, navNewOrder: true, navOrders: true, navInventory: true, navFinancial: true, navReports: false, ...parsed });
      } catch {}
    };
    const handleCustomWidgetUpdate = () => {
      try {
        const raw = localStorage.getItem("smartfix_custom_link_widgets");
        setCustomWidgets(raw ? JSON.parse(raw) : []);
      } catch {}
    };
    const handleWidgetOrderUpdate = () => {
      try {
        const raw = localStorage.getItem("smartfix_widget_order");
        setWidgetOrder(raw ? JSON.parse(raw) : null);
      } catch {}
    };

    window.addEventListener('open-dashboard-config', handleOpen);
    window.addEventListener('open-quick-repair', handleQuick);
    window.addEventListener('dashboard-widgets-updated', handleWidgetUpdate);
    window.addEventListener('dashboard-widgets-updated', handleWidgetOrderUpdate);
    window.addEventListener('dashboard-custom-widgets-updated', handleCustomWidgetUpdate);

    return () => {
      window.removeEventListener('open-dashboard-config', handleOpen);
      window.removeEventListener('open-quick-repair', handleQuick);
      window.removeEventListener('dashboard-widgets-updated', handleWidgetUpdate);
      window.removeEventListener('dashboard-widgets-updated', handleWidgetOrderUpdate);
      window.removeEventListener('dashboard-custom-widgets-updated', handleCustomWidgetUpdate);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(loadUnreadNotifications, 30000);
    window.addEventListener('notification-created', loadUnreadNotifications);
    window.addEventListener('notification-read', loadUnreadNotifications);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('notification-created', loadUnreadNotifications);
      window.removeEventListener('notification-read', loadUnreadNotifications);
    };
  }, [session?.userId]);

  const loadUnreadNotifications = async () => {
    if (!session?.userId) return;
    try {
      const notifications = await dataClient.entities.Notification.filter({
        user_id: session.userId,
        is_read: false
      });
      setUnreadNotifications(notifications?.length || 0);
    } catch (error) {
      setUnreadNotifications(0);
    }
  };

  const handleNavigate = (path) => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    navigate(createPageUrl(path));
  };

  const handleProtectedNavigate = async (path) => {
    if (session?.userRole === "admin" || session?.userRole === "manager") {
      handleNavigate(path);
      return;
    }

    const adminPin = prompt("🔐 PIN de administrador:");
    if (!adminPin) return;

    try {
      const admins = await dataClient.entities.User.filter({
        role: "admin",
        pin: adminPin,
        active: true
      });
      if (admins?.length > 0) {
        showToast("✅ Acceso concedido");
        handleNavigate(path);
      } else {
        showToast("❌ PIN incorrecto", "Acceso denegado", "error");
      }
    } catch {
      showToast("❌ Error", "Intenta nuevamente", "error");
    }
  };

  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [kpiIncome, setKpiIncome] = useState({ today: 0, month: 0, todayExpenses: 0, loading: true });
  const DAILY_GOAL_KEY = "smartfix_daily_goal_override";
  const kpiDailyGoal = useMemo(() => {
    try { return Number(localStorage.getItem(DAILY_GOAL_KEY) || 0) || 1000; } catch { return 1000; }
  }, []);
  
  const handleOrderSelect = (orderId) => {
    setSelectedOrderId(orderId);
  };

  const handleNavigateWithFilter = (statusId) => {
    setSelectedStatusFilter(statusId);
  };

  const filteredOrders = useMemo(() => {
    let orders = recentOrders;

    // Si se seleccionó filtro de desbloqueos
    if (showUnlocksFilter) {
      orders = orders.filter(
        (o) => o.device_type === "Software" || 
               (o.order_number && o.order_number.startsWith("SW-"))
      );
    } else {
      // Excluir desbloqueos para órdenes normales
      orders = orders.filter(
        (o) => o.device_type !== "Software" && 
               !(o.order_number && o.order_number.startsWith("SW-"))
      );

      // Filtrar por estado seleccionado
      if (selectedStatusFilter) {
        orders = orders.filter(o => getEffectiveOrderStatus(o) === selectedStatusFilter);
      }
    }

    // Filtrar por búsqueda
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      orders = orders.filter(
        (o) =>
          String(o.order_number).toLowerCase().includes(q) ||
          String(o.customer_name).toLowerCase().includes(q) ||
          String(o.customer_phone).toLowerCase().includes(q)
      );
    }

    // Si no hay filtro de estado ni búsqueda ni desbloqueos, no mostrar nada
    if (!selectedStatusFilter && !q && !showUnlocksFilter) return [];

    return orders.slice(0, 20);
  }, [recentOrders, searchTerm, selectedStatusFilter, showUnlocksFilter]);

  const filteredPriceList = useMemo(() => {
    const q = priceSearch.trim().toLowerCase();
    if (!q) return [];
    return priceListItems
      .filter(
        (i) =>
          i.name?.toLowerCase().includes(q) ||
          i.sku?.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [priceListItems, priceSearch]);

  // ── KPI stats computed from already-loaded orders ──────────────────────────
  const kpiStats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeStatuses = ["pending", "in_progress", "waiting_parts", "ready_for_pickup", "diagnosed"];

    const active = recentOrders.filter(o =>
      activeStatuses.includes(getEffectiveOrderStatus(o)) &&
      o.device_type !== "Software" &&
      !(o.order_number && o.order_number.startsWith("SW-"))
    );
    const readyToPickup = recentOrders.filter(o =>
      getEffectiveOrderStatus(o) === "ready_for_pickup"
    );
    const deliveredToday = recentOrders.filter(o => {
      const s = getEffectiveOrderStatus(o);
      if (s !== "delivered" && s !== "completed" && s !== "picked_up") return false;
      const d = new Date(o.updated_date || o.created_date);
      return d >= todayStart;
    });
    const overdue = recentOrders.filter(o => {
      const s = getEffectiveOrderStatus(o);
      if (!activeStatuses.includes(s)) return false;
      const d = new Date(o.updated_date || o.created_date);
      return d < sevenDaysAgo;
    });
    return { active: active.length, readyToPickup: readyToPickup.length, deliveredToday: deliveredToday.length, overdue: overdue.length };
  }, [recentOrders]);

  // Widget: Órdenes urgentes (active orders not updated in 5+ days)
  const urgentOrdersList = useMemo(() => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const activeStatuses = ["pending", "in_progress", "waiting_parts", "diagnosed", "intake"];
    return recentOrders.filter(o => {
      const s = getEffectiveOrderStatus(o);
      if (!activeStatuses.includes(s)) return false;
      const d = new Date(o.updated_date || o.created_date);
      return d < fiveDaysAgo;
    }).slice(0, 8);
  }, [recentOrders]);

  // Widget: Listos para recoger
  const readyPickupList = useMemo(() =>
    recentOrders.filter(o => getEffectiveOrderStatus(o) === "ready_for_pickup").slice(0, 8)
  , [recentOrders]);

  // Widget: Stock crítico
  const criticalStockList = useMemo(() =>
    priceListItems.filter(i => i.type === "product" && typeof i.stock === "number" && i.stock <= Math.max(i.min_stock || 0, 3)).slice(0, 10)
  , [priceListItems]);

  // Widget: Tiempo promedio de reparación (days from created to delivered, last 30 orders)
  const avgRepairTime = useMemo(() => {
    const completed = recentOrders.filter(o => {
      const s = getEffectiveOrderStatus(o);
      return ["delivered","completed","picked_up"].includes(s) && o.created_date && o.updated_date;
    });
    if (completed.length === 0) return null;
    const avg = completed.reduce((sum, o) => {
      const diff = (new Date(o.updated_date) - new Date(o.created_date)) / (1000 * 60 * 60 * 24);
      return sum + diff;
    }, 0) / completed.length;
    return Math.round(avg * 10) / 10;
  }, [recentOrders]);

  // Widget: Carga por técnico (active orders grouped by assigned_to_name)
  const technicianLoad = useMemo(() => {
    const activeStatuses = ["pending", "in_progress", "waiting_parts", "diagnosed", "intake", "ready_for_pickup"];
    const map = {};
    recentOrders.forEach(o => {
      const s = getEffectiveOrderStatus(o);
      if (!activeStatuses.includes(s)) return;
      const name = o.assigned_to_name || o.technician_name || "Sin asignar";
      map[name] = (map[name] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [recentOrders]);

  const stockPill = (item) => {
    if (item.type !== "product" || typeof item.stock !== "number") return null;
    const cls =
      item.stock <= 0
        ? "bg-red-600/20 text-red-300 border-red-600/30"
        : item.stock <= (item.min_stock || 0)
        ? "bg-yellow-600/20 text-yellow-300"
        : "bg-emerald-600/20 text-emerald-300";

    return (
      <span className={`px-2 py-0.5 rounded-md border text-xs ${cls}`}>
        {item.stock <= 0 ? t("outOfStock") : item.stock}
      </span>
    );
  };

  const statusCounts = useMemo(() => {
    const counts = {};
    ORDER_STATUSES.filter((s) => s.isActive).forEach((s) => {
      counts[s.id] = 0;
    });

    // ✅ Filtrar desbloqueos también en el conteo
    const filteredRecentOrders = recentOrders.filter(
      (o) => o.device_type !== "Software" && 
             !(o.order_number && o.order_number.startsWith("SW-"))
    );

    filteredRecentOrders.forEach((order) => {
      const normalized = getEffectiveOrderStatus(order);
      if (counts.hasOwnProperty(normalized)) counts[normalized]++;
    });

    // Contar desbloqueos
    counts.unlocks = recentOrders.filter(
      (o) => o.device_type === "Software" ||
             (o.order_number && o.order_number.startsWith("SW-"))
    ).length;

    // Contar garantías
    counts.warranty = recentOrders.filter(
      (o) => getEffectiveOrderStatus(o) === "warranty"
    ).length;

    return counts;
  }, [recentOrders]);

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20 md:pb-6">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Wizard primer inicio — solo para tenants nuevos */}
      {showSetupWizard && (
        <FirstTimeSetupWizard
          onComplete={() => {
            setShowSetupWizard(false);
            // Recargar nombre actualizado
            const tid = localStorage.getItem("smartfix_tenant_id");
            if (tid) supabase.from("system_config").select("value").eq("key","settings.branding").eq("tenant_id",tid).limit(1)
              .then(({ data }) => {
                if (data?.length) {
                  const p = typeof data[0].value === "string" ? JSON.parse(data[0].value) : data[0].value;
                  if (p?.business_name) setBusinessName(p.business_name);
                }
              });
          }}
        />
      )}

      <div className="px-2 sm:px-3 md:px-6 lg:px-8 xl:px-12 2xl:px-16 pt-[calc(env(safe-area-inset-top,0px)+10px)] sm:pt-[calc(env(safe-area-inset-top,0px)+14px)] md:pt-6 lg:pt-8 pb-6">
        <div className="max-w-[2560px] mx-auto space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8">
          
          {/* === DESKTOP: HEADER "APPLE CONTROL CENTER" === */}
          <div className="hidden md:block bg-[#121215]/40 backdrop-blur-[40px] border border-white/10 rounded-[40px] p-5 md:p-8 lg:p-10 shadow-[0_32px_80px_rgba(0,0,0,0.45)] relative overflow-hidden group">
            {/* Glossy overlay with subtle inner glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.05] to-transparent pointer-events-none" />
            <div className="absolute inset-0 border border-white/10 rounded-[40px] pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" />

            {/* BARRA SUPERIOR MINIMALISTA */}
            <div className="flex flex-wrap items-center justify-between gap-4 lg:gap-6 mb-6 lg:mb-8 xl:mb-10 relative z-10">
              <div className="flex items-center gap-3 lg:gap-4">
                <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-full pl-1 pr-6 py-1.5 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                  <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-tr from-sky-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-[0_8px_20px_rgba(14,165,233,0.3)] border border-white/20">
                    <span className="text-sm lg:text-base font-black text-white uppercase tracking-tighter">{session?.userName?.substring(0,2) || 'US'}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm lg:text-base font-black text-white leading-none tracking-tight">{session?.userName || 'Usuario'}</span>
                    <span className="text-[10px] lg:text-xs text-white/40 leading-none mt-1 font-black tracking-widest uppercase">{businessName || session?.storeName || "SmartFixOS"}</span>
                  </div>
                </div>

                <PunchButton 
                  userId={session?.userId}
                  userName={session?.userName}
                  variant="apple" // Assume PunchButton handles variants or just ignore for now, styling it locally via wrapper if needed
                  onPunchStatusChange={(status) => {
                    if (status) showToast("👋 ¡Hola!", "Turno iniciado");
                    else showToast("👋 ¡Adiós!", "Turno finalizado");
                  }}
                />
              </div>

              <div className="flex items-center gap-3 lg:gap-4">
                <button
                  onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                  className="relative w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-full bg-white/6 hover:bg-white/10 border border-white/8 flex items-center justify-center transition-all active:scale-95 group shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                >
                  <Bell className="w-5 h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 text-white/70 group-hover:text-white transition-colors" />
                  {unreadNotifications > 0 && (
                    <span className="absolute top-0 right-0 w-3 h-3 lg:w-4 lg:h-4 bg-red-500 border border-[#1c1c1e] rounded-full" />
                  )}
                </button>

                <button
                  onClick={() => setShowDashboardConfig(true)}
                  className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-white/5 hover:bg-indigo-500/10 border border-white/10 hover:border-indigo-500/20 flex items-center justify-center transition-all active:scale-90 group shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  title="Personalizar Dashboard"
                >
                  <LayoutGrid className="w-5 h-5 lg:w-6 lg:h-6 text-white/20 group-hover:text-indigo-400 transition-all duration-500" />
                </button>

                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/20 flex items-center justify-center transition-all active:scale-90 group shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-5 h-5 lg:w-6 lg:h-6 text-white/20 group-hover:text-rose-400 transition-all duration-500" />
                </button>
              </div>
            </div>

            {/* ── KPI BAR ─────────────────────────────────────────────────── */}
            {(() => {
              const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
              const todayProfit = kpiIncome.today - kpiIncome.todayExpenses;
              const goalPct = kpiDailyGoal > 0 ? Math.min(100, Math.round((kpiIncome.today / kpiDailyGoal) * 100)) : 0;
              const cards = [
                {
                  widgetId: "kpiIncome",
                  label: "Ingresos hoy",
                  value: kpiIncome.loading ? "…" : fmt(kpiIncome.today),
                  sub: kpiIncome.loading ? "" : `Ganancia: ${fmt(todayProfit)}`,
                  icon: DollarSign,
                  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20",
                  glow: "shadow-[0_0_20px_rgba(52,211,153,0.08)]"
                },
                {
                  widgetId: "kpiGoal",
                  label: "Meta diaria",
                  value: kpiIncome.loading ? "…" : `${goalPct}%`,
                  sub: `${fmt(kpiIncome.today)} / ${fmt(kpiDailyGoal)}`,
                  icon: TrendingUp,
                  color: goalPct >= 100 ? "text-yellow-400" : goalPct >= 70 ? "text-emerald-400" : "text-blue-400",
                  bg: goalPct >= 100 ? "bg-yellow-500/10" : "bg-blue-500/10",
                  border: goalPct >= 100 ? "border-yellow-500/20" : "border-blue-500/20",
                  glow: goalPct >= 100 ? "shadow-[0_0_20px_rgba(251,191,36,0.12)]" : "",
                  progress: goalPct
                },
                {
                  widgetId: "kpiActive",
                  label: "Órdenes activas",
                  value: kpiStats.active,
                  sub: `${kpiStats.readyToPickup} lista${kpiStats.readyToPickup !== 1 ? "s" : ""} para recoger`,
                  icon: Wrench,
                  color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20",
                  glow: "shadow-[0_0_20px_rgba(129,140,248,0.08)]"
                },
                {
                  widgetId: "kpiDelivered",
                  label: "Entregadas hoy",
                  value: kpiStats.deliveredToday,
                  sub: "reparaciones completadas",
                  icon: PackageCheck,
                  color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20",
                  glow: ""
                },
                {
                  widgetId: "kpiOverdue",
                  label: "Sin movimiento",
                  value: kpiStats.overdue,
                  sub: "+ 7 días sin actualizar",
                  icon: Timer,
                  color: kpiStats.overdue > 0 ? "text-red-400" : "text-slate-500",
                  bg: kpiStats.overdue > 0 ? "bg-red-500/10" : "bg-white/[0.03]",
                  border: kpiStats.overdue > 0 ? "border-red-500/20" : "border-white/[0.07]",
                  glow: kpiStats.overdue > 0 ? "shadow-[0_0_20px_rgba(248,113,113,0.1)]" : ""
                },
              ].filter(c => widgetConfig[c.widgetId] !== false);
              return (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 relative z-10 mb-2">
                  {cards.map((kpi) => (
                    <div key={kpi.label} className={`rounded-2xl border ${kpi.border} ${kpi.bg} ${kpi.glow} px-4 py-3 flex flex-col gap-1 transition-all`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg ${kpi.bg} border ${kpi.border} flex items-center justify-center flex-shrink-0`}>
                          <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                        </div>
                        <p className="text-[11px] text-white/40 font-medium truncate">{kpi.label}</p>
                      </div>
                      <p className={`text-2xl font-black ${kpi.color} leading-tight`}>{kpi.value}</p>
                      {kpi.progress !== undefined && (
                        <div className="w-full bg-white/10 rounded-full h-1 mt-0.5">
                          <div className={`h-1 rounded-full transition-all ${kpi.color.replace("text-","bg-")}`} style={{ width: `${kpi.progress}%` }} />
                        </div>
                      )}
                      {kpi.sub && <p className="text-[10px] text-white/25 truncate">{kpi.sub}</p>}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ═══ WIDGETS EXTRAS ══════════════════════════════════════════ */}
            {(widgetConfig.urgentOrders || widgetConfig.readyPickup || widgetConfig.posSalesToday || widgetConfig.criticalStock || widgetConfig.newCustomers || widgetConfig.cashStatus || widgetConfig.avgRepairTime || widgetConfig.technicianLoad || widgetConfig.navNewOrder || widgetConfig.navOrders || widgetConfig.navInventory || widgetConfig.navFinancial || widgetConfig.navReports || customWidgets.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-2">
                {(() => {
                  const DEFAULT_ORDER = ['urgentOrders','readyPickup','posSalesToday','criticalStock','newCustomers','cashStatus','avgRepairTime','technicianLoad','navNewOrder','navOrders','navInventory','navFinancial','navReports'];
                  const order = widgetOrder || DEFAULT_ORDER;
                  const widgetJSX = order.map(id => {
                    if (id === 'urgentOrders' && widgetConfig.urgentOrders) return (
                      <div key="urgentOrders" className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-red-500/20 rounded-[28px] p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                              <AlertCircle className="w-4 h-4 text-red-400" />
                            </div>
                            <span className="text-white/80 font-black text-xs uppercase tracking-tight">Urgentes</span>
                          </div>
                          <span className="text-2xl font-black text-red-400">{urgentOrdersList.length}</span>
                        </div>
                        {urgentOrdersList.length > 0 && (
                          <div className="space-y-1.5">
                            {urgentOrdersList.slice(0,4).map(o => (
                              <div key={o.id} onClick={() => handleOrderSelect(o.id)} className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] rounded-xl cursor-pointer hover:bg-white/[0.06] transition-colors">
                                <span className="text-white/70 text-xs font-bold truncate">{o.customer_name || "Cliente"}</span>
                                <span className="text-red-400/70 text-[10px] font-black ml-2 shrink-0">#{o.order_number?.split('-')?.pop()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {urgentOrdersList.length === 0 && <p className="text-white/20 text-xs text-center py-2 font-bold">Sin órdenes urgentes</p>}
                      </div>
                    );
                    if (id === 'readyPickup' && widgetConfig.readyPickup) return (
                      <div key="readyPickup" className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-emerald-500/20 rounded-[28px] p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                              <PackageCheck className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className="text-white/80 font-black text-xs uppercase tracking-tight">Para Recoger</span>
                          </div>
                          <span className="text-2xl font-black text-emerald-400">{readyPickupList.length}</span>
                        </div>
                        {readyPickupList.length > 0 && (
                          <div className="space-y-1.5">
                            {readyPickupList.slice(0,4).map(o => (
                              <div key={o.id} onClick={() => handleOrderSelect(o.id)} className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] rounded-xl cursor-pointer hover:bg-white/[0.06] transition-colors">
                                <span className="text-white/70 text-xs font-bold truncate">{o.customer_name || "Cliente"}</span>
                                <span className="text-emerald-400/70 text-[10px] font-black ml-2 shrink-0">#{o.order_number?.split('-')?.pop()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {readyPickupList.length === 0 && <p className="text-white/20 text-xs text-center py-2 font-bold">Sin órdenes listas</p>}
                      </div>
                    );
                    if (id === 'posSalesToday' && widgetConfig.posSalesToday) return (
                      <div key="posSalesToday" className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-cyan-500/20 rounded-[28px] p-5 space-y-3">
                        <div className="flex items-center gap-2.5 mb-1">
                          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                            <ShoppingCart className="w-4 h-4 text-cyan-400" />
                          </div>
                          <span className="text-white/80 font-black text-xs uppercase tracking-tight">Transacciones hoy</span>
                        </div>
                        <p className="text-3xl font-black text-cyan-400">{todayTxCount}</p>
                        <p className="text-white/30 text-[11px] font-bold">movimientos registrados</p>
                      </div>
                    );
                    if (id === 'criticalStock' && widgetConfig.criticalStock) return (
                      <div key="criticalStock" className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-orange-500/20 rounded-[28px] p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                              <Package className="w-4 h-4 text-orange-400" />
                            </div>
                            <span className="text-white/80 font-black text-xs uppercase tracking-tight">Stock Crítico</span>
                          </div>
                          <span className="text-2xl font-black text-orange-400">{criticalStockList.length}</span>
                        </div>
                        {criticalStockList.length > 0 && (
                          <div className="space-y-1.5">
                            {criticalStockList.slice(0,4).map(item => (
                              <div key={item.id} className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] rounded-xl">
                                <span className="text-white/70 text-xs font-bold truncate">{item.name}</span>
                                <span className={`text-[10px] font-black ml-2 shrink-0 ${item.stock <= 0 ? 'text-red-400' : 'text-orange-400'}`}>{item.stock <= 0 ? 'Agotado' : `${item.stock} uds`}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {criticalStockList.length === 0 && <p className="text-white/20 text-xs text-center py-2 font-bold">Stock en orden</p>}
                      </div>
                    );
                    if (id === 'newCustomers' && widgetConfig.newCustomers) return (
                      <div key="newCustomers" className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-violet-500/20 rounded-[28px] p-5 space-y-2">
                        <div className="flex items-center gap-2.5 mb-1">
                          <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                            <Users className="w-4 h-4 text-violet-400" />
                          </div>
                          <span className="text-white/80 font-black text-xs uppercase tracking-tight">Clientes nuevos</span>
                        </div>
                        <p className="text-3xl font-black text-violet-400">{newCustomersCount}</p>
                        <p className="text-white/30 text-[11px] font-bold">esta semana</p>
                      </div>
                    );
                    if (id === 'cashStatus' && widgetConfig.cashStatus) return (
                      <button key="cashStatus"
                        onClick={handleCashButtonClick}
                        className={`bg-[#1C1C1E]/60 backdrop-blur-xl border rounded-[28px] p-5 space-y-2 text-left w-full hover:brightness-110 transition-all active:scale-95 group ${drawerOpen ? 'border-emerald-500/20' : 'border-red-500/20'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${drawerOpen ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                              <Wallet className={`w-4 h-4 ${drawerOpen ? 'text-emerald-400' : 'text-red-400'}`} />
                            </div>
                            <span className="text-white/80 font-black text-xs uppercase tracking-tight">Estado de Caja</span>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                        </div>
                        <p className={`text-lg font-black ${drawerOpen ? 'text-emerald-400' : 'text-red-400'}`}>{drawerOpen ? '● Abierta' : '● Cerrada'}</p>
                        <p className="text-white/30 text-[11px] font-bold">
                          Ingresos hoy: ${Number(kpiIncome.today || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                        </p>
                      </button>
                    );
                    if (id === 'avgRepairTime' && widgetConfig.avgRepairTime) return (
                      <div key="avgRepairTime" className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-sky-500/20 rounded-[28px] p-5 space-y-2">
                        <div className="flex items-center gap-2.5 mb-1">
                          <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                            <Clock className="w-4 h-4 text-sky-400" />
                          </div>
                          <span className="text-white/80 font-black text-xs uppercase tracking-tight">Tiempo Promedio</span>
                        </div>
                        <p className="text-3xl font-black text-sky-400">{avgRepairTime !== null ? `${avgRepairTime}d` : '—'}</p>
                        <p className="text-white/30 text-[11px] font-bold">días por reparación</p>
                      </div>
                    );
                    if (id === 'technicianLoad' && widgetConfig.technicianLoad) return (
                      <div key="technicianLoad" className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-amber-500/20 rounded-[28px] p-5 space-y-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                            <Wrench className="w-4 h-4 text-amber-400" />
                          </div>
                          <span className="text-white/80 font-black text-xs uppercase tracking-tight">Carga por Técnico</span>
                        </div>
                        {technicianLoad.length > 0 ? (
                          <div className="space-y-2">
                            {technicianLoad.map(([name, count]) => {
                              const max = technicianLoad[0]?.[1] || 1;
                              return (
                                <div key={name} className="space-y-0.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-white/60 text-[11px] font-bold truncate max-w-[70%]">{name}</span>
                                    <span className="text-amber-400 text-[11px] font-black">{count}</span>
                                  </div>
                                  <div className="w-full bg-white/[0.06] rounded-full h-1">
                                    <div className="h-1 rounded-full bg-amber-500/60 transition-all" style={{ width: `${(count/max)*100}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-white/20 text-xs text-center py-2 font-bold">Sin órdenes asignadas</p>
                        )}
                      </div>
                    );
                    if (id === 'navNewOrder' && widgetConfig.navNewOrder) return (
                      <button key="navNewOrder"
                        onClick={() => setShowWorkOrderWizard(true)}
                        className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-sky-500/20 rounded-[28px] p-5 space-y-3 text-left w-full hover:bg-[#1C1C1E]/80 transition-all active:scale-95 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
                              <ClipboardList className="w-4 h-4 text-sky-400" />
                            </div>
                            <span className="text-white/80 font-black text-xs uppercase tracking-tight">Nueva Orden</span>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                        </div>
                        <p className="text-white/30 text-[11px] font-bold">Crear nueva orden de trabajo</p>
                      </button>
                    );
                    if (id === 'navOrders' && widgetConfig.navOrders) return (
                      <button key="navOrders"
                        onClick={() => handleNavigate("Orders")}
                        className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-purple-500/20 rounded-[28px] p-5 space-y-3 text-left w-full hover:bg-[#1C1C1E]/80 transition-all active:scale-95 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                              <ClipboardList className="w-4 h-4 text-purple-400" />
                            </div>
                            <span className="text-white/80 font-black text-xs uppercase tracking-tight">Órdenes</span>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                        </div>
                        <p className="text-white/30 text-[11px] font-bold">Ver historial y gestión</p>
                      </button>
                    );
                    if (id === 'navInventory' && widgetConfig.navInventory) return (
                      <button key="navInventory"
                        onClick={() => handleNavigate("Inventory")}
                        className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-teal-500/20 rounded-[28px] p-5 space-y-3 text-left w-full hover:bg-[#1C1C1E]/80 transition-all active:scale-95 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                              <Package className="w-4 h-4 text-teal-400" />
                            </div>
                            <span className="text-white/80 font-black text-xs uppercase tracking-tight">Inventario</span>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                        </div>
                        <p className="text-white/30 text-[11px] font-bold">Stock y productos</p>
                      </button>
                    );
                    if (id === 'navFinancial' && widgetConfig.navFinancial) return (
                      <button key="navFinancial"
                        onClick={() => handleNavigate("Financial")}
                        className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-emerald-500/20 rounded-[28px] p-5 space-y-3 text-left w-full hover:bg-[#1C1C1E]/80 transition-all active:scale-95 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                              <Wallet className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className="text-white/80 font-black text-xs uppercase tracking-tight">Finanzas</span>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                        </div>
                        <p className="text-white/30 text-[11px] font-bold">Resumen financiero</p>
                      </button>
                    );
                    if (id === 'navReports' && widgetConfig.navReports) return (
                      <button key="navReports"
                        onClick={() => handleNavigate("FinancialReports")}
                        className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-indigo-500/20 rounded-[28px] p-5 space-y-3 text-left w-full hover:bg-[#1C1C1E]/80 transition-all active:scale-95 group"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                              <BarChart3 className="w-4 h-4 text-indigo-400" />
                            </div>
                            <span className="text-white/80 font-black text-xs uppercase tracking-tight">Reportes</span>
                          </div>
                          <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                        </div>
                        <p className="text-white/30 text-[11px] font-bold">P&L y análisis</p>
                      </button>
                    );
                    return null;
                  }).filter(Boolean);
                  const customWidgetCards = customWidgets.map(widget => (
                    <button
                      key={widget.id}
                      onClick={() => window.open(widget.url, '_blank')}
                      className="bg-[#1C1C1E]/60 backdrop-blur-xl border border-white/10 rounded-[28px] p-5 space-y-3 text-left w-full hover:bg-[#1C1C1E]/80 transition-all active:scale-95 group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <ExternalLink className="w-4 h-4 text-white/40" />
                          </div>
                          <span className="text-white/80 font-black text-xs uppercase tracking-tight truncate max-w-[120px]">{widget.name}</span>
                        </div>
                        <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white/50 transition-colors" />
                      </div>
                      <p className="text-white/20 text-[11px] font-bold truncate">{widget.url.replace(/^https?:\/\//, '')}</p>
                    </button>
                  ));
                  return [...widgetJSX, ...customWidgetCards];
                })()}

              </div>
            )}
          </div>

{/* FinancialOverviewWidget + SmartDailyGoalWidget removed — replaced by KPI bar */}

          {/* === MÓVIL: PREMIUM SEQUOIA HEADER === */}
          <div className="md:hidden space-y-5">
            {/* Elegant Mobile Header */}
            <div className="flex flex-col gap-4 px-1">
              <div className="flex items-center justify-between px-2 pt-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                    <p className="text-[#8E8E93] text-[9px] font-black uppercase tracking-[0.25em]">SmartFix Pro</p>
                  </div>
                  <h2 className="text-3xl font-black text-white tracking-tighter mt-1">
                    Hola, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">{session?.userName?.split(' ')[0]}</span>
                  </h2>
                </div>
                
                <button
                  onClick={() => setShowUserMenu(true)}
                  className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl flex items-center justify-center shadow-lg active:scale-90 transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-black text-white shadow-inner">
                    {session?.userName?.substring(0,2) || 'US'}
                  </div>
                </button>
              </div>

              {/* Quick Action Bar - Dynamic Island Style */}
              <div className="flex items-center gap-2 p-1.5 bg-white/[0.02] border border-white/[0.05] rounded-3xl backdrop-blur-2xl">
                <button
                  onClick={handleCashButtonClick}
                  className={cn(
                    "flex-1 h-12 rounded-2xl border flex items-center justify-center gap-2 transition-all active:scale-95",
                    drawerOpen 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  )}
                >
                  <Wallet className="w-5 h-5" strokeWidth={2.5} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{drawerOpen ? "Caja Abierta" : "Caja Cerrada"}</span>
                </button>

                <div className="flex items-center gap-1.5 pr-1">
                  <button
                    onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                    className="relative w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center active:scale-90 transition-all"
                  >
                    <Bell className="w-5 h-5 text-white/50" strokeWidth={2} />
                    {unreadNotifications > 0 && (
                      <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.6)]" />
                    )}
                  </button>
                  
                  <PunchButton
                    userId={session?.userId}
                    userName={session?.userName}
                    variant="mobile-icon"
                    onPunchStatusChange={(status) => {
                      if (status) showToast("👋 ¡Hola!", "Turno iniciado");
                      else showToast("👋 ¡Adiós!", "Turno finalizado");
                    }}
                  />

                  <button
                    onClick={() => setShowDashboardConfig(true)}
                    className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center active:scale-90 transition-all"
                    title="Personalizar"
                  >
                    <LayoutGrid className="w-5 h-5 text-white/50" strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── KPI BAR MÓVIL ─────────────────────────────────────────── */}
            {(() => {
              const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
              const todayProfit = kpiIncome.today - kpiIncome.todayExpenses;
              const goalPct = kpiDailyGoal > 0 ? Math.min(100, Math.round((kpiIncome.today / kpiDailyGoal) * 100)) : 0;
              const cards = [
                { widgetId: "kpiIncome", label: "Ingresos hoy", value: kpiIncome.loading ? "…" : fmt(kpiIncome.today), sub: `Ganancia: ${fmt(todayProfit)}`, icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                { widgetId: "kpiGoal", label: "Meta diaria", value: kpiIncome.loading ? "…" : `${goalPct}%`, sub: `${fmt(kpiIncome.today)} / ${fmt(kpiDailyGoal)}`, icon: TrendingUp, color: goalPct >= 100 ? "text-yellow-400" : goalPct >= 70 ? "text-emerald-400" : "text-blue-400", bg: goalPct >= 100 ? "bg-yellow-500/10" : "bg-blue-500/10", border: goalPct >= 100 ? "border-yellow-500/20" : "border-blue-500/20", progress: goalPct },
                { widgetId: "kpiActive", label: "Activas", value: kpiStats.active, sub: `${kpiStats.readyToPickup} listas`, icon: Wrench, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
                { widgetId: "kpiDelivered", label: "Entregadas hoy", value: kpiStats.deliveredToday, sub: "completadas", icon: PackageCheck, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
                { widgetId: "kpiOverdue", label: "Sin movimiento", value: kpiStats.overdue, sub: "+7 días", icon: Timer, color: kpiStats.overdue > 0 ? "text-red-400" : "text-slate-500", bg: kpiStats.overdue > 0 ? "bg-red-500/10" : "bg-white/[0.03]", border: kpiStats.overdue > 0 ? "border-red-500/20" : "border-white/[0.07]" },
              ].filter(c => widgetConfig[c.widgetId] !== false);
              return (
                <div className="grid grid-cols-2 gap-2 px-2 sm:px-1">
                  {cards.map((kpi) => (
                    <div key={kpi.label} className={`rounded-2xl border ${kpi.border} ${kpi.bg} px-3 py-2.5 flex flex-col gap-0.5`}>
                      <div className="flex items-center gap-1.5">
                        <kpi.icon className={`w-3.5 h-3.5 ${kpi.color} flex-shrink-0`} />
                        <p className="text-[10px] text-white/40 truncate">{kpi.label}</p>
                      </div>
                      <p className={`text-xl font-black ${kpi.color} leading-tight`}>{kpi.value}</p>
                      {kpi.progress !== undefined && (
                        <div className="w-full bg-white/10 rounded-full h-1">
                          <div className={`h-1 rounded-full ${kpi.color.replace("text-","bg-")}`} style={{ width: `${kpi.progress}%` }} />
                        </div>
                      )}
                      {kpi.sub && <p className="text-[10px] text-white/25 truncate">{kpi.sub}</p>}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ═══ WIDGETS EXTRAS MÓVIL ════════════════════════════════════ */}
            {(widgetConfig.urgentOrders || widgetConfig.readyPickup || widgetConfig.posSalesToday || widgetConfig.criticalStock || widgetConfig.newCustomers || widgetConfig.cashStatus || widgetConfig.avgRepairTime || widgetConfig.technicianLoad || widgetConfig.navNewOrder || widgetConfig.navOrders || widgetConfig.navInventory || widgetConfig.navFinancial || widgetConfig.navReports || customWidgets.length > 0) && (
              <div className="grid grid-cols-2 gap-3 mx-1">
                {(() => {
                  const DEFAULT_ORDER = ['urgentOrders','readyPickup','posSalesToday','criticalStock','newCustomers','cashStatus','avgRepairTime','technicianLoad','navNewOrder','navOrders','navInventory','navFinancial','navReports'];
                  const order = widgetOrder || DEFAULT_ORDER;
                  const widgetJSX = order.map(id => {
                    if (id === 'urgentOrders' && widgetConfig.urgentOrders) return (
                      <div key="urgentOrders" className="bg-[#1C1C1E]/60 border border-red-500/20 rounded-[24px] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Urgentes</span>
                        </div>
                        <p className="text-2xl font-black text-red-400">{urgentOrdersList.length}</p>
                        <p className="text-white/20 text-[10px] font-bold mt-0.5">sin actualizar +5d</p>
                      </div>
                    );
                    if (id === 'readyPickup' && widgetConfig.readyPickup) return (
                      <div key="readyPickup" className="bg-[#1C1C1E]/60 border border-emerald-500/20 rounded-[24px] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <PackageCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Para recoger</span>
                        </div>
                        <p className="text-2xl font-black text-emerald-400">{readyPickupList.length}</p>
                        <p className="text-white/20 text-[10px] font-bold mt-0.5">listas para entregar</p>
                      </div>
                    );
                    if (id === 'posSalesToday' && widgetConfig.posSalesToday) return (
                      <div key="posSalesToday" className="bg-[#1C1C1E]/60 border border-cyan-500/20 rounded-[24px] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <ShoppingCart className="w-4 h-4 text-cyan-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Transacciones</span>
                        </div>
                        <p className="text-2xl font-black text-cyan-400">{todayTxCount}</p>
                        <p className="text-white/20 text-[10px] font-bold mt-0.5">movimientos hoy</p>
                      </div>
                    );
                    if (id === 'criticalStock' && widgetConfig.criticalStock) return (
                      <div key="criticalStock" className="bg-[#1C1C1E]/60 border border-orange-500/20 rounded-[24px] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-orange-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Stock crítico</span>
                        </div>
                        <p className="text-2xl font-black text-orange-400">{criticalStockList.length}</p>
                        <p className="text-white/20 text-[10px] font-bold mt-0.5">productos bajos</p>
                      </div>
                    );
                    if (id === 'newCustomers' && widgetConfig.newCustomers) return (
                      <div key="newCustomers" className="bg-[#1C1C1E]/60 border border-violet-500/20 rounded-[24px] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-violet-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Clientes nuevos</span>
                        </div>
                        <p className="text-2xl font-black text-violet-400">{newCustomersCount}</p>
                        <p className="text-white/20 text-[10px] font-bold mt-0.5">esta semana</p>
                      </div>
                    );
                    if (id === 'cashStatus' && widgetConfig.cashStatus) return (
                      <button key="cashStatus" onClick={handleCashButtonClick} className={`bg-[#1C1C1E]/60 border rounded-[24px] p-4 text-left w-full active:scale-95 transition-all ${drawerOpen ? 'border-emerald-500/20' : 'border-red-500/20'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className={`w-4 h-4 shrink-0 ${drawerOpen ? 'text-emerald-400' : 'text-red-400'}`} />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Caja</span>
                        </div>
                        <p className={`text-sm font-black ${drawerOpen ? 'text-emerald-400' : 'text-red-400'}`}>{drawerOpen ? '● Abierta' : '● Cerrada'}</p>
                        <p className="text-white/20 text-[10px] font-bold mt-0.5">${Number(kpiIncome.today||0).toLocaleString("en-US",{maximumFractionDigits:0})} hoy</p>
                      </button>
                    );
                    if (id === 'avgRepairTime' && widgetConfig.avgRepairTime) return (
                      <div key="avgRepairTime" className="bg-[#1C1C1E]/60 border border-sky-500/20 rounded-[24px] p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">T. Promedio</span>
                        </div>
                        <p className="text-2xl font-black text-sky-400">{avgRepairTime !== null ? `${avgRepairTime}d` : '—'}</p>
                        <p className="text-white/20 text-[10px] font-bold mt-0.5">por reparación</p>
                      </div>
                    );
                    if (id === 'technicianLoad' && widgetConfig.technicianLoad) return (
                      <div key="technicianLoad" className="bg-[#1C1C1E]/60 border border-amber-500/20 rounded-[24px] p-4 col-span-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight">Carga por Técnico</span>
                        </div>
                        {technicianLoad.length > 0 ? (
                          <div className="grid grid-cols-2 gap-2">
                            {technicianLoad.map(([name, count]) => (
                              <div key={name} className="flex items-center justify-between bg-white/[0.03] rounded-xl px-3 py-1.5">
                                <span className="text-white/60 text-[10px] font-bold truncate">{name}</span>
                                <span className="text-amber-400 text-xs font-black ml-2 shrink-0">{count}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-white/20 text-xs text-center font-bold">Sin asignaciones</p>
                        )}
                      </div>
                    );
                    if (id === 'navNewOrder' && widgetConfig.navNewOrder) return (
                      <button key="navNewOrder" onClick={() => setShowWorkOrderWizard(true)} className="bg-[#1C1C1E]/60 border border-sky-500/20 rounded-[24px] p-4 text-left active:scale-95 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <ClipboardList className="w-4 h-4 text-sky-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Nueva Orden</span>
                        </div>
                        <p className="text-white/40 text-xs font-bold">Crear orden</p>
                      </button>
                    );
                    if (id === 'navOrders' && widgetConfig.navOrders) return (
                      <button key="navOrders" onClick={() => handleNavigate("Orders")} className="bg-[#1C1C1E]/60 border border-purple-500/20 rounded-[24px] p-4 text-left active:scale-95 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <ClipboardList className="w-4 h-4 text-purple-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Órdenes</span>
                        </div>
                        <p className="text-white/40 text-xs font-bold">Ver historial</p>
                      </button>
                    );
                    if (id === 'navInventory' && widgetConfig.navInventory) return (
                      <button key="navInventory" onClick={() => handleNavigate("Inventory")} className="bg-[#1C1C1E]/60 border border-teal-500/20 rounded-[24px] p-4 text-left active:scale-95 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <Package className="w-4 h-4 text-teal-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Inventario</span>
                        </div>
                        <p className="text-white/40 text-xs font-bold">Stock</p>
                      </button>
                    );
                    if (id === 'navFinancial' && widgetConfig.navFinancial) return (
                      <button key="navFinancial" onClick={() => handleNavigate("Financial")} className="bg-[#1C1C1E]/60 border border-emerald-500/20 rounded-[24px] p-4 text-left active:scale-95 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Finanzas</span>
                        </div>
                        <p className="text-white/40 text-xs font-bold">Resumen</p>
                      </button>
                    );
                    if (id === 'navReports' && widgetConfig.navReports) return (
                      <button key="navReports" onClick={() => handleNavigate("FinancialReports")} className="bg-[#1C1C1E]/60 border border-indigo-500/20 rounded-[24px] p-4 text-left active:scale-95 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">Reportes</span>
                        </div>
                        <p className="text-white/40 text-xs font-bold">P&L</p>
                      </button>
                    );
                    return null;
                  }).filter(Boolean);
                  const customWidgetCards = customWidgets.map(widget => (
                    <button key={widget.id} onClick={() => window.open(widget.url, '_blank')} className="bg-[#1C1C1E]/60 border border-white/10 rounded-[24px] p-4 text-left active:scale-95 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <ExternalLink className="w-4 h-4 text-white/30 shrink-0" />
                        <span className="text-white/60 text-[10px] font-black uppercase tracking-tight truncate">{widget.name}</span>
                      </div>
                      <p className="text-white/30 text-[10px] font-bold truncate">{widget.url.replace(/^https?:\/\//, '')}</p>
                    </button>
                  ));
                  return [...widgetJSX, ...customWidgetCards];
                })()}

              </div>
            )}

            {/* === MÓDULO UNIFICADO: Órdenes + Lista de Precios (MÓVIL) === */}
            {(widgetConfig.orders || widgetConfig.priceList) && (
            <div className="mx-1 mt-2">
              <div className="bg-[#1C1C1E]/40 backdrop-blur-3xl border border-white/[0.08] rounded-[32px] shadow-2xl overflow-hidden">
            {widgetConfig.orders && (
            <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                      <ClipboardList className="w-4 h-4 text-blue-400" />
                    </div>
                    <h3 className="text-white/90 font-black text-sm uppercase tracking-tight">Órdenes</h3>
                  </div>
                  <button
                    onClick={() => navigate(createPageUrl("Orders"))}
                    className="flex items-center gap-1 text-blue-400 text-[10px] font-black uppercase tracking-tight active:opacity-70"
                  >
                    Ver todas <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Chips de estado → navegan a Orders con filtro */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar" style={{ touchAction: 'pan-x' }}>
                  {ORDER_STATUSES.filter(s => s.isActive).map(status => {
                    const count = statusCounts[status.id] || 0;
                    const isPending = status.id === "pending_order";
                    return (
                      <button
                        key={status.id}
                        onClick={() => navigate(createPageUrl(`Orders?status=${status.id}`))}
                        className={cn(
                          "flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-2xl border transition-all active:scale-95 min-w-[56px]",
                          isPending && count > 0
                            ? "bg-red-500/20 border-red-500/40 animate-pulse"
                            : count > 0
                              ? "bg-white/[0.05] border-white/10"
                              : "bg-white/[0.02] border-white/[0.05] opacity-40"
                        )}
                      >
                        <span className={cn(
                          "text-lg font-black leading-none",
                          isPending && count > 0 ? "text-red-400" : count > 0 ? "text-white" : "text-white/30"
                        )}>
                          {count}
                        </span>
                        <span className="text-[7px] font-black uppercase tracking-tight text-white/40 text-center leading-tight max-w-[60px]">
                          {status.label}
                        </span>
                      </button>
                    );
                  })}
                  {/* Garantías */}
                  {statusCounts.warranty > 0 && (
                    <button
                      onClick={() => navigate(createPageUrl("Orders?status=warranty"))}
                      className="flex-shrink-0 flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-2xl border bg-amber-500/10 border-amber-500/20 transition-all active:scale-95 min-w-[56px]"
                    >
                      <span className="text-lg font-black leading-none text-amber-400">{statusCounts.warranty}</span>
                      <span className="text-[7px] font-black uppercase tracking-tight text-white/40 text-center leading-tight">Garantías</span>
                    </button>
                  )}
                </div>

                {/* Órdenes recientes — sin requerir filtro */}
                <div className="space-y-2">
                  {recentOrders
                    .filter(o => o.device_type !== "Software" && !(o.order_number?.startsWith("SW-")))
                    .slice(0, 6)
                    .map(order => {
                      const statusConfig = getStatusConfig(getEffectiveOrderStatus(order));
                      return (
                        <div
                          key={order.id}
                          onClick={() => handleOrderSelect(order.id)}
                          className="flex items-center justify-between gap-3 p-3.5 bg-white/[0.03] border border-white/[0.05] rounded-2xl active:scale-[0.98] transition-all cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-black text-sm truncate uppercase tracking-tight">
                              {order.customer_name || "Cliente"}
                            </p>
                            <p className="text-white/30 text-[9px] font-bold uppercase tracking-tight mt-0.5">
                              {order.order_number} · {order.device_model || "Dispositivo"}
                            </p>
                          </div>
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border flex-shrink-0",
                            statusConfig.colorClasses?.includes('bg-') ? statusConfig.colorClasses : "bg-white/5 border-white/10 text-white/50"
                          )}>
                            {statusConfig.label}
                          </span>
                        </div>
                      );
                    })}
                  {recentOrders.filter(o => o.device_type !== "Software" && !(o.order_number?.startsWith("SW-"))).length === 0 && (
                    <div className="text-center py-6">
                      <p className="text-white/20 text-[10px] font-black uppercase tracking-widest">Sin órdenes recientes</p>
                    </div>
                  )}
                </div>
            </div>
            )}

            {/* Divider entre secciones */}
            {widgetConfig.orders && widgetConfig.priceList && (
              <div className="mx-5 border-t border-white/[0.06]" />
            )}

{/* WorkQueueWidget removed */}

            {/* Lista de Precios — dentro del card unificado */}
            {widgetConfig.priceList && (
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <PiggyBank className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-white font-black text-sm uppercase tracking-tight">{t('priceList')}</h3>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2">
                  <Search className="h-4 w-4 text-white/20" />
                </div>
                <input
                  value={priceSearch}
                  onChange={e => setPriceSearch(e.target.value)}
                  placeholder="Buscar productos o servicios..."
                  className="w-full pl-11 pr-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:bg-white/[0.08] transition-all"
                />
              </div>
              {priceSearch && filteredPriceList.length > 0 && (
                <div className="space-y-2.5 max-h-[260px] overflow-y-auto no-scrollbar">
                  {filteredPriceList.slice(0, 15).map(item => (
                    <div key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 p-3.5 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-black text-sm truncate uppercase tracking-tight">{item.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-[8px] font-black uppercase tracking-tight px-2 py-0.5 rounded-md border",
                            item.type === "service" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          )}>
                            {item.type === "service" ? "Servicio" : "Producto"}
                          </span>
                          {stockPill(item)}
                        </div>
                      </div>
                      <p className="text-emerald-400 font-black text-lg tracking-tighter flex-shrink-0">${(item.price || 0).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
              {priceSearch && filteredPriceList.length === 0 && (
                <p className="text-white/20 text-xs font-black uppercase tracking-widest text-center py-3">Sin resultados para "{priceSearch}"</p>
              )}
            </div>
            )}
              </div>{/* fin card unificado */}
            </div>
            )}

          </div>

          {/* === BUSCAR ÓRDENES (SEQUOIA STYLE - SOLO DESKTOP, widget opcional) === */}
          {widgetConfig.orders && <Card className="hidden md:block bg-gradient-to-br from-purple-600/10 via-blue-600/10 to-cyan-600/10 backdrop-blur-3xl border border-white/10 rounded-[32px] lg:rounded-[40px] xl:rounded-[48px] shadow-2xl relative overflow-hidden mt-6">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -top-20 -left-20 w-60 h-60 lg:w-80 lg:h-80 bg-purple-500/20 rounded-full blur-[100px] animate-pulse" />
            <CardContent className="p-4 sm:p-6 lg:p-8 xl:p-10 flex flex-col max-h-[600px] lg:max-h-[700px] xl:max-h-[800px]">
              {/* HEADER STICKY */}
              <div className="sticky top-0 z-10 bg-black/20 backdrop-blur-3xl pb-4 lg:pb-6 space-y-4 lg:space-y-6 -mx-6 lg:-mx-8 xl:-mx-10 px-6 lg:px-8 xl:px-10 -mt-6 lg:-mt-8 xl:-mt-10 pt-6 lg:pt-8 xl:pt-10 border-b border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white text-lg lg:text-xl xl:text-2xl font-black flex items-center gap-3 tracking-tight">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <ClipboardList className="w-5 h-5 text-blue-400" />
                    </div>
                    {t('orders')}
                  </h3>
                </div>

                {/* Buscador estilo Sequoia - Glassmorphic */}
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 lg:pl-5 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 lg:h-6 lg:w-6 text-white/20 group-focus-within:text-blue-500 transition-colors duration-500" />
                  </div>
                  <input 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    placeholder="Buscar por cliente, número..." 
                    className="block w-full pl-12 lg:pl-14 xl:pl-16 pr-6 py-4 lg:py-5 bg-black/40 border border-white/10 rounded-2xl lg:rounded-3xl text-sm lg:text-base xl:text-lg text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-black/60 transition-all duration-500 font-bold" 
                  />
                  <div className="absolute inset-0 border border-white/5 rounded-2xl lg:rounded-3xl pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" />
                </div>

                {/* Chips de Estados estilo Sequoia */}
                <div className="flex gap-3 lg:gap-4 overflow-x-auto pb-4 no-scrollbar -mx-1 px-1">
                  {ORDER_STATUSES.filter((s) => s.isActive).map((status) => {
                    const count = statusCounts[status.id] || 0;
                    const isSelected = selectedStatusFilter === status.id;
                    const isPendingOrder = status.id === "pending_order";

                    return (
                      <button 
                        key={status.id} 
                        onClick={() => {
                          setSelectedStatusFilter(isSelected ? null : status.id);
                          setShowUnlocksFilter(false);
                        }}
                        disabled={count === 0} 
                        className={`
                          px-4 lg:px-6 py-2.5 lg:py-3 rounded-full text-xs lg:text-sm font-black whitespace-nowrap transition-all duration-500 border uppercase tracking-widest
                          ${isPendingOrder && count > 0
                            ? 'bg-gradient-to-r from-red-600 to-red-800 text-white border-red-500 shadow-[0_0_24px_rgba(220,38,38,0.5)] animate-pulse scale-105'
                            : isSelected 
                              ? 'bg-white text-black border-white shadow-[0_8px_24px_rgba(255,255,255,0.2)] scale-105' 
                              : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white active:scale-95 shadow-inner'
                          }
                          ${count === 0 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        {status.label} <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] lg:text-xs font-black ${isPendingOrder && count > 0 ? 'bg-white/20 text-white' : isSelected ? 'bg-black text-white' : 'bg-white/10 text-white/60'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Lista de Órdenes estilo iOS - CON SCROLL */}
              {filteredOrders.length === 0 ? (
                <div className="text-center py-12 lg:py-16 xl:py-20 bg-white/5 rounded-2xl lg:rounded-3xl border border-white/5 border-dashed mt-4 lg:mt-6">
                  <ClipboardList className="w-12 h-12 lg:w-16 lg:h-16 xl:w-20 xl:h-20 mx-auto text-white/20 mb-3 lg:mb-4" />
                  <p className="text-white/40 text-sm lg:text-base xl:text-lg font-medium px-4">
                    {searchTerm ? t('noOrdersFound') : 'Selecciona un estado para ver órdenes'}
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar mt-4 lg:mt-6">
                  <div className="space-y-3 lg:space-y-4 xl:space-y-5">
                    {filteredOrders.map((order) => {
                      const statusConfig = getStatusConfig(order.status);
                      return (
                        <div 
                          key={order.id}
                          onClick={() => handleOrderSelect(order.id)} 
                          className="group p-5 lg:p-6 bg-white/5 hover:bg-[#121215]/60 backdrop-blur-3xl rounded-[28px] lg:rounded-[32px] border border-white/5 hover:border-white/20 cursor-pointer transition-all duration-700 active:scale-[0.98] shadow-lg hover:shadow-2xl"
                        >
                          <div className="flex justify-between items-start gap-4 lg:gap-6">
                            <div className="flex items-start gap-4 lg:gap-5 min-w-0">
                              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center shrink-0 border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-700">
                                <Smartphone className="w-6 h-6 lg:w-7 lg:h-7 text-blue-400 group-hover:text-blue-300 transition-colors" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-black text-white text-base lg:text-lg truncate group-hover:text-blue-400 transition-colors duration-500 uppercase tracking-tight">{order.customer_name || "Cliente Desconocido"}</p>
                                <p className="text-xs lg:text-sm text-white/40 truncate flex items-center gap-2 mt-1.5 font-bold uppercase tracking-widest">
                                  <span className="bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 shadow-inner">{order.order_number || "#"}</span>
                                  <span className="opacity-30">•</span>
                                  <span className="group-hover:text-white/60 transition-colors">{order.device_model || "Dispositivo"}</span>
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <span className={`px-4 py-1.5 rounded-full text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] border shadow-sm ${statusConfig.colorClasses} bg-opacity-10 border-opacity-30`}>
                                {statusConfig.label}
                              </span>
                              <span className="text-[10px] text-white/20 font-black uppercase tracking-widest">
                                {format(new Date(order.created_date), "d MMM", { locale: es })}
                              </span>
                            </div>
                          </div>
                        </div>

                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>}

          {/* === LISTA DE PRECIOS DESKTOP (widget opcional) === */}
          {widgetConfig.priceList && (
            <div className="hidden md:block bg-[#1C1C1E]/40 backdrop-blur-3xl border border-emerald-500/20 rounded-[32px] shadow-2xl p-6 space-y-5 mt-6">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <PiggyBank className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="text-white font-black text-base uppercase tracking-tight">Lista de Precios</h3>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center">
                  <Search className="h-4 w-4 text-white/20" />
                </div>
                <input
                  value={priceSearch}
                  onChange={(e) => setPriceSearch(e.target.value)}
                  placeholder="Buscar productos o servicios..."
                  className="w-full pl-11 pr-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:bg-white/[0.08] transition-all"
                />
              </div>
              {priceSearch && filteredPriceList.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[320px] overflow-y-auto no-scrollbar">
                  {filteredPriceList.slice(0, 24).map((item) => (
                    <div key={`d-${item.type}-${item.id}`} className="p-3 bg-white/[0.02] border border-white/[0.05] rounded-2xl">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-black text-sm truncate uppercase tracking-tight">{item.name}</p>
                          <span className={cn("text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md border mt-1 inline-block", item.type === "service" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20")}>
                            {item.type === "service" ? "Servicio" : "Producto"}
                          </span>
                        </div>
                        <p className="text-emerald-400 font-black text-base tracking-tighter shrink-0">${(item.price || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {priceSearch && filteredPriceList.length === 0 && (
                <p className="text-white/20 text-sm text-center py-4 font-bold">Sin resultados para "{priceSearch}"</p>
              )}
            </div>
          )}

        </div>

{/* WorkQueueWidget + PersonalNotesWidget removed per user request */}

      {/* -----------------------------
            MODALES / DIALOGS
      ------------------------------ */}

      {showWorkOrderWizard && (
        <WorkOrderWizard
          open={showWorkOrderWizard}
          onClose={() => setShowWorkOrderWizard(false)}
          onSuccess={() => loadFreshData()}
        />
      )}

      {showOpenDrawer && (
        <OpenDrawerDialog
          isOpen={showOpenDrawer}
          onClose={() => setShowOpenDrawer(false)}
          onSuccess={() => {
            setShowOpenDrawer(false);
            checkCashRegisterStatus();
            showToast("✅ Caja abierta");
          }}
        />
      )}

      {showCloseDrawer && (
        <CloseDrawerDialog
          isOpen={showCloseDrawer}
          onClose={() => setShowCloseDrawer(false)}
          drawer={currentDrawer}
          onSuccess={() => {
            setShowCloseDrawer(false);
            showToast("✅ Caja cerrada");
          }}
        />
      )}



      {session && (
        <UserMenuModal
          open={showUserMenu}
          onClose={() => setShowUserMenu(false)}
          user={{
            id: session.userId,
            email: session.userEmail,
            full_name: session.userName,
            role: session.userRole
          }}
        />
      )}

      {/* ⭐️ MODAL REPARACIONES RÁPIDAS */}
      {showQuickRepair && (
        <QuickRepairPanel
          open={showQuickRepair}
          onClose={() => setShowQuickRepair(false)}
          onSuccess={() => {
            setShowQuickRepair(false);
            loadFreshData();
            showToast("✅ Reparación rápida creada");
          }}
        />
      )}

      {/* ⭐️ MODAL SERVICIOS DE SOFTWARE */}
      {showSoftwareService && (
        <SoftwareServiceDialog
          open={showSoftwareService}
          onClose={() => setShowSoftwareService(false)}
          onSuccess={() => {
            setShowSoftwareService(false);
            loadFreshData();
            showToast("✅ Servicio de software creado");
          }}
        />
      )}

      {/* ⭐️ MODAL DE DESBLOQUEOS MEJORADO */}
      {showUnlocksDialog && (
        <UnlocksDialog
          open={showUnlocksDialog}
          onClose={() => setShowUnlocksDialog(false)}
          onSuccess={() => {
            loadFreshData();
            showToast("✅ Actualizado exitosamente");
          }}
        />
      )}

      {/* ⭐️ MODAL DE RECARGAS */}
      {showRechargesPanel && (
        <RechargesPanel
          open={showRechargesPanel}
          onClose={() => setShowRechargesPanel(false)}
        />
      )}

      {/* ✅ PANEL DE NOTIFICACIONES */}
      {showNotificationPanel && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowNotificationPanel(false)}>
          <div className="absolute top-20 sm:top-24 right-4 w-[95vw] max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <FullNotificationPanel user={session} onClose={() => {
              setShowNotificationPanel(false);
              loadUnreadNotifications();
            }} />
          </div>
        </div>
      )}

      {/* ✅ PANEL DE ORDEN SELECCIONADA */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm">
          <WorkOrderPanelErrorBoundary onClose={() => setSelectedOrderId(null)} onReset={() => setSelectedOrderId(null)}>
          <WorkOrderPanel
            orderId={selectedOrderId}
            onClose={() => {
              setSelectedOrderId(null);
              loadFreshData();
            }}
            onUpdate={() => {
              setSelectedOrderId(null);
              loadFreshData();
            }}
            onDelete={() => {
              setSelectedOrderId(null);
              // Forzar recarga inmediata
              lastFetchRef.current = 0;
              loadFreshData();
            }}
          />
          </WorkOrderPanelErrorBoundary>
        </div>
      )}

      {/* ✅ MODAL DE CONTROL DE TIEMPO */}
      {showTimeTracking && (
        <TimeTrackingModal
          open={showTimeTracking}
          onClose={() => setShowTimeTracking(false)}
          session={session}
        />
      )}

      {/* ✅ MODAL DE LOGOUT */}
      <LogoutModal
        open={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={() => {
          setShowLogoutModal(false);
          localStorage.removeItem("employee_session");
          sessionStorage.removeItem("911-session");
          window.location.href = "/PinAccess";
        }}
      />

      {/* ✅ MODAL DE CONFIGURACIÓN DEL DASHBOARD */}
      {showDashboardConfig && (
        <DashboardLinksConfig
          open={showDashboardConfig}
          onClose={() => setShowDashboardConfig(false)}
        />
      )}

      {/* ✅ REPORTE MENSUAL AUTOMÁTICO (día 31) */}
      <MonthlyReportModal
        open={showMonthlyReport}
        onClose={() => setShowMonthlyReport(false)}
      />

      {/* ✅ MENÚ "MÁS" PARA MÓVIL */}
      {showMoreMenu && (
        <MobileMoreMenu
          open={showMoreMenu}
          onClose={() => setShowMoreMenu(false)}
          buttons={[]}
          onButtonClick={() => {}}
        />
      )}

      {/* ✅ CALCULADORA DE PRECIOS */}

      {/* ✅ TRANSACCIONES DEL DÍA */}
      {showDailyTransactions && (
        <DailyTransactionsModal
          open={showDailyTransactions}
          onClose={() => setShowDailyTransactions(false)}
          currentDrawer={currentDrawer}
        />
      )}

      {/* ✨ ANIMACIONES ESTILO SEQUOIA */}
      <style>{`
        @keyframes rudolph-glow {
          0%, 100% {
            background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
            box-shadow: 0 0 20px rgba(220, 38, 38, 0.8), 0 0 40px rgba(220, 38, 38, 0.6), inset 0 0 15px rgba(255, 255, 255, 0.3);
            transform: scale(1);
          }
          50% {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            box-shadow: 0 0 30px rgba(239, 68, 68, 1), 0 0 60px rgba(239, 68, 68, 0.8), inset 0 0 20px rgba(255, 255, 255, 0.5);
            transform: scale(1.05);
          }
        }

        .rudolph-nose {
          animation: rudolph-glow 1.2s ease-in-out infinite;
          border: 2px solid rgba(239, 68, 68, 0.8) !important;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        .delay-500 {
          animation-delay: 500ms;
        }

        .delay-1000 {
          animation-delay: 1000ms;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #06b6d4 0%, #8b5cf6 100%);
          border-radius: 10px;
        }

        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }

        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  </div>
);
}
