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
  LayoutGrid,
  AlertCircle,
  X,
  CheckCircle2,
  Shield,
  ArrowUpRight,
  TrendingUp,
  DollarSign,
  PackageCheck,
  Timer
} from "lucide-react";

import { format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/components/utils/i18n";
import { createPageUrl } from "@/components/utils/helpers";
import PunchButton from "@/components/dashboard/PunchButton";
import { debounce, catalogCache } from "@/components/utils/dataCache";
import { DashboardCardSkeleton } from "@/components/ui/loading-skeleton";

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
const LOCAL_DASHBOARD_BUTTONS_KEY = "smartfix_dashboard_buttons_local";

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

const ADMIN_CORE_DASHBOARD_BUTTONS = [
  { id: "new_order", label: "Nueva Orden", icon: "ClipboardList", gradient: "from-blue-500 to-cyan-600", action: "showWorkOrderWizard", type: "modal", enabled: true },
  { id: "orders", label: "Órdenes", icon: "ClipboardList", gradient: "from-purple-500 to-pink-600", action: "Orders", type: "navigate", enabled: true },
  { id: "inventory", label: "Inventario", icon: "Package", gradient: "from-teal-500 to-cyan-600", action: "Inventory", type: "navigate", enabled: true },
  { id: "financial", label: "Finanzas", icon: "Wallet", gradient: "from-emerald-600 to-green-700", action: "Financial", type: "navigate", enabled: true },
];

const LEGACY_DASHBOARD_DEFAULT_IDS = new Set([
  "pos",
  "customers",
  "reports",
  "recharges",
  "technicians",
  "notifications",
  "users",
  "database"
]);

function mergeAdminDashboardButtons(savedButtons = []) {
  const savedMap = new Map((savedButtons || []).map((b) => [b.id, b]));
  const customButtons = (savedButtons || []).filter(
    (b) => !ADMIN_CORE_DASHBOARD_BUTTONS.some((d) => d.id === b.id) && !LEGACY_DASHBOARD_DEFAULT_IDS.has(b?.id)
  );

  const mergedDefaults = ADMIN_CORE_DASHBOARD_BUTTONS.map((defaults, idx) => {
    const saved = savedMap.get(defaults.id) || {};
    return {
      ...saved,
      ...defaults,
      order: Number.isFinite(saved.order) ? saved.order : idx,
      enabled: saved.enabled !== undefined ? saved.enabled : defaults.enabled !== false
    };
  });

  const merged = [...mergedDefaults, ...customButtons.map((b, idx) => ({
    ...b,
    order: Number.isFinite(b.order) ? b.order : mergedDefaults.length + idx
  }))];

  return merged
    .sort((a, b) => a.order - b.order)
    .map((b, idx) => ({ ...b, order: idx }));
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
  const [loadingButtons, setLoadingButtons] = useState(true);

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
  const [dashboardButtons, setDashboardButtons] = useState([]);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDailyTransactions, setShowDailyTransactions] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const readLocalDashboardButtons = useCallback(() => {
    try {
      const raw = localStorage.getItem(LOCAL_DASHBOARD_BUTTONS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const writeLocalDashboardButtons = useCallback((buttons) => {
    try {
      localStorage.setItem(LOCAL_DASHBOARD_BUTTONS_KEY, JSON.stringify(buttons || []));
    } catch {
      // no-op
    }
  }, []);

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
    loadDashboardButtons();
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

  const loadDashboardButtons = useCallback(async (useCache = true) => {
    setLoadingButtons(true);
    try {
      const currentRole = sessionRef.current?.userRole || sessionRef.current?.role;
      const isAdminSession = currentRole === "admin" || currentRole === "manager";

      // Intentar caché primero
      const cached = useCache ? catalogCache.get('dashboard-buttons') : null;
      if (cached) {
        const source = isAdminSession ? mergeAdminDashboardButtons(cached) : cached;
        setDashboardButtons(source.filter(b => b.enabled).sort((a, b) => a.order - b.order));
        return;
      }

      const configs = await dataClient.entities.AppSettings.filter({ slug: "dashboard-buttons" });
      if (configs?.length > 0) {
        const buttons = configs[0].payload?.buttons || [];
        const source = isAdminSession ? mergeAdminDashboardButtons(buttons) : buttons;
        catalogCache.set('dashboard-buttons', source);
        writeLocalDashboardButtons(source);
        setDashboardButtons(source.filter(b => b.enabled).sort((a, b) => a.order - b.order));
      } else {
        const localButtons = readLocalDashboardButtons();
        const source = isAdminSession ? mergeAdminDashboardButtons(localButtons) : localButtons;
        setDashboardButtons(source.filter((b) => b?.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      }
    } catch (error) {
      console.error("Error loading dashboard buttons:", error);
      const currentRole = sessionRef.current?.userRole || sessionRef.current?.role;
      const isAdminSession = currentRole === "admin" || currentRole === "manager";
      const localButtons = readLocalDashboardButtons();
      const source = isAdminSession ? mergeAdminDashboardButtons(localButtons) : localButtons;
      setDashboardButtons(source.filter((b) => b?.enabled !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    } finally {
      setLoadingButtons(false);
    }
  }, [readLocalDashboardButtons, writeLocalDashboardButtons]);

  useEffect(() => {
    const handleUpdate = () => {
      catalogCache.invalidate('dashboard-buttons');
      loadDashboardButtons(false);
    };
    const handleOpen = () => setShowDashboardConfig(true);
    const handleQuick = () => setShowQuickRepair(true); // Manejar evento del FAB
    
    window.addEventListener('dashboard-buttons-updated', handleUpdate);
    window.addEventListener('open-dashboard-config', handleOpen);
    window.addEventListener('open-quick-repair', handleQuick);
    
    return () => {
      window.removeEventListener('dashboard-buttons-updated', handleUpdate);
      window.removeEventListener('open-dashboard-config', handleOpen);
      window.removeEventListener('open-quick-repair', handleQuick);
    };
  }, [loadDashboardButtons]);

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
        orders = orders.filter(o => normalizeStatusId(o.status) === selectedStatusFilter);
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
      activeStatuses.includes(normalizeStatusId(o.status)) &&
      o.device_type !== "Software" &&
      !(o.order_number && o.order_number.startsWith("SW-"))
    );
    const readyToPickup = recentOrders.filter(o =>
      normalizeStatusId(o.status) === "ready_for_pickup"
    );
    const deliveredToday = recentOrders.filter(o => {
      const s = normalizeStatusId(o.status);
      if (s !== "delivered" && s !== "completed" && s !== "picked_up") return false;
      const d = new Date(o.updated_date || o.created_date);
      return d >= todayStart;
    });
    const overdue = recentOrders.filter(o => {
      const s = normalizeStatusId(o.status);
      if (!activeStatuses.includes(s)) return false;
      const d = new Date(o.updated_date || o.created_date);
      return d < sevenDaysAgo;
    });
    return { active: active.length, readyToPickup: readyToPickup.length, deliveredToday: deliveredToday.length, overdue: overdue.length };
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
      const normalized = normalizeStatusId(order.status);
      if (counts.hasOwnProperty(normalized)) counts[normalized]++;
    });

    // Contar desbloqueos
    counts.unlocks = recentOrders.filter(
      (o) => o.device_type === "Software" || 
             (o.order_number && o.order_number.startsWith("SW-"))
    ).length;

    // Contar garantías
    counts.warranty = recentOrders.filter(
      (o) => normalizeStatusId(o.status) === "warranty"
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
          <div className="hidden md:block bg-[#121215]/40 backdrop-blur-[40px] border border-white/10 rounded-[40px] p-8 lg:p-10 shadow-[0_32px_80px_rgba(0,0,0,0.45)] relative overflow-hidden group">
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
                  onClick={handleCashButtonClick}
                  className={`relative w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-full border flex items-center justify-center transition-all active:scale-95 group shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ${
                    drawerOpen 
                      ? "bg-emerald-500/10 hover:bg-emerald-500/16 border-emerald-500/20 hover:border-emerald-500/25" 
                      : "bg-rose-500/10 hover:bg-rose-500/16 border-rose-500/20 hover:border-rose-500/25"
                  }`}
                  title={drawerOpen ? "Cerrar Caja" : "Abrir Caja"}
                >
                  <Wallet className={`w-5 h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 transition-colors ${
                    drawerOpen ? "text-emerald-400 group-hover:text-emerald-300" : "text-red-400 group-hover:text-red-300"
                  }`} />
                  <span className={`absolute -bottom-1 -right-1 w-3 h-3 lg:w-4 lg:h-4 rounded-full border-2 border-[#1c1c1e] ${
                    drawerOpen ? "bg-emerald-500" : "bg-red-500"
                  }`} />
                </button>

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
                  label: "Ingresos hoy",
                  value: kpiIncome.loading ? "…" : fmt(kpiIncome.today),
                  sub: kpiIncome.loading ? "" : `Ganancia: ${fmt(todayProfit)}`,
                  icon: DollarSign,
                  color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20",
                  glow: "shadow-[0_0_20px_rgba(52,211,153,0.08)]"
                },
                {
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
                  label: "Órdenes activas",
                  value: kpiStats.active,
                  sub: `${kpiStats.readyToPickup} lista${kpiStats.readyToPickup !== 1 ? "s" : ""} para recoger`,
                  icon: Wrench,
                  color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20",
                  glow: "shadow-[0_0_20px_rgba(129,140,248,0.08)]"
                },
                {
                  label: "Entregadas hoy",
                  value: kpiStats.deliveredToday,
                  sub: "reparaciones completadas",
                  icon: PackageCheck,
                  color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20",
                  glow: ""
                },
                {
                  label: "Sin movimiento",
                  value: kpiStats.overdue,
                  sub: "+ 7 días sin actualizar",
                  icon: Timer,
                  color: kpiStats.overdue > 0 ? "text-red-400" : "text-slate-500",
                  bg: kpiStats.overdue > 0 ? "bg-red-500/10" : "bg-white/[0.03]",
                  border: kpiStats.overdue > 0 ? "border-red-500/20" : "border-white/[0.07]",
                  glow: kpiStats.overdue > 0 ? "shadow-[0_0_20px_rgba(248,113,113,0.1)]" : ""
                },
              ];
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

            {/* BENTO GRID LAYOUT */}
            {dashboardButtons.length > 0 && (
              <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 xl:gap-8 relative z-10">
                
                {/* APPS GRID */}
                <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 3xl:grid-cols-7 4xl:grid-cols-8 gap-3 lg:gap-4 xl:gap-5 2xl:gap-6 flex-1">
                  {dashboardButtons.map(btn => {
                    const iconMap = {
                      'ClipboardList': ClipboardList,
                      'Wrench': Wrench,
                      'Smartphone': Smartphone,
                      'Zap': Zap,
                      'Package': Package,
                      'Wallet': Wallet,
                      'BarChart3': BarChart3,
                      'Users': Users,
                      'Bell': Bell,
                      'SettingsIcon': SettingsIcon,
                      'ExternalLink': ExternalLink
                    };
                    const IconComponent = (typeof btn.icon === 'string' && iconMap[btn.icon]) ? iconMap[btn.icon] : ExternalLink;

                    const getIconGradient = (label) => {
                      if (label.includes("Nueva")) return "from-sky-500 to-blue-600";
                      if (label.includes("Finanzas")) return "from-emerald-500 to-teal-600";
                      if (label.includes("Recargas")) return "from-emerald-500 to-green-600";
                      if (label.includes("Rápidas")) return "from-amber-500 to-orange-600";
                      if (label.includes("Desbloqueos")) return "from-violet-500 to-fuchsia-600";
                      
                      const gradients = [
                        "from-sky-500 to-blue-600",
                        "from-fuchsia-500 to-purple-600",
                        "from-cyan-500 to-emerald-600",
                        "from-rose-500 to-pink-600",
                        "from-amber-500 to-orange-600",
                        "from-slate-500 to-slate-600"
                      ];
                      let hash = 0;
                      for (let i = 0; i < label.length; i++) {
                        hash = label.charCodeAt(i) + ((hash << 5) - hash);
                      }
                      return gradients[Math.abs(hash) % gradients.length];
                    };

                    const getCount = (label) => {
                        // Nueva Orden -> Active orders (excluding unlocks/software)
                        if (label.includes("Nueva")) {
                            const active = recentOrders.filter(o => 
                                !["delivered", "cancelled", "completed", "picked_up"].includes(o.status) &&
                                o.device_type !== "Software" &&
                                !(o.order_number && o.order_number.startsWith("SW-"))
                            );
                            return active.length;
                        }
                        // Recargas -> Today's recharges
                        if (label.includes("Recargas")) return activeRechargesCount;
                        // Rápidas -> Active quick repairs (assuming tagged or identified, but for now active orders is best proxy or same as Nueva)
                        if (label.includes("Rápidas")) {
                             const active = recentOrders.filter(o => 
                                !["delivered", "cancelled", "completed", "picked_up"].includes(o.status) &&
                                o.device_type !== "Software"
                            );
                            return active.length;
                        }
                        // Desbloqueos -> Active unlocks
                        if (label.includes("Desbloqueos")) {
                            const unlocks = recentOrders.filter(o => 
                                !["delivered", "cancelled", "completed", "picked_up", "ready_for_pickup"].includes(o.status) &&
                                (o.device_type === "Software" || (o.order_number && o.order_number.startsWith("SW-")))
                            );
                            return unlocks.length;
                        }
                        return null;
                    };

                    const count = getCount(btn.label);

                    const handleClick = () => {
                      // Forzar apertura de modal para botones de nueva orden
                        if (btn.id === "new_order" || btn.action === "showWorkOrderWizard" || btn.action === "/WorkOrderWizard") {
                          setShowWorkOrderWizard(true);
                        return;
                      }
                      if (btn.type === "modal") {
                        if (btn.action === "showQuickRepair") setShowQuickRepair(true);
                        else if (btn.action === "showUnlocksDialog") setShowUnlocksDialog(true);
                      } else if (btn.type === "navigate") {
                        if (btn.action === "/Recharges" || btn.action === "Recharges") {
                          setShowRechargesPanel(true);
                        } else {
                          handleNavigate(btn.action);
                        }
                      } else if (btn.type === "external") {
                        window.open(btn.action, '_blank');
                      }
                    };

                    const getSubtitle = (b) => {
                      if (b.id === "new_order" || b.action === "showWorkOrderWizard") return "Crear nueva orden";
                      if (b.label.includes("Órdenes")) return "Ver historial";
                      if (b.label.includes("Inventario")) return "Stock y productos";
                      if (b.label.includes("Finanzas")) return "Resumen diario";
                      if (b.label.includes("Recargas")) return "Gestionar recargas";
                      if (b.label.includes("Rápidas")) return "Reparación express";
                      if (b.label.includes("Desbloqueos")) return "IMEI & software";
                      if (b.label.includes("Cliente")) return "Base de clientes";
                      if (b.label.includes("Reportes") || b.label.includes("Reporte")) return "Análisis y métricas";
                      if (b.type === "navigate") return "Ver más →";
                      return "Abrir módulo";
                    };

                    return (
                      <button
                        key={btn.id}
                        onClick={handleClick}
                        className="group relative bg-[#121215]/40 hover:bg-[#121215]/60 backdrop-blur-3xl border border-white/[0.08] hover:border-white/20 rounded-[32px] px-6 py-6 flex flex-col items-start justify-between aspect-[1.1/1] transition-all duration-500 active:scale-95 shadow-[0_16px_40px_rgba(0,0,0,0.3)] hover:shadow-[0_32px_64px_rgba(0,0,0,0.5)] overflow-hidden"
                      >
                        {/* Top shine */}
                        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        {/* Color wash on hover */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${getIconGradient(btn.label)} opacity-0 group-hover:opacity-[0.07] transition-opacity duration-500 pointer-events-none`} />
                        {/* Bottom glow */}
                        <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/40 to-transparent pointer-events-none`} />

                        <div className="flex justify-between w-full items-start gap-4 relative z-10">
                          <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] bg-gradient-to-br ${getIconGradient(btn.label)} flex items-center justify-center shadow-[0_12px_24px_rgba(0,0,0,0.4)] mb-3 text-white transition-all duration-500 group-hover:scale-110 group-hover:rotate-6`}>
                            <IconComponent className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
                          </div>
                          {count !== null && (
                            <span className="inline-flex items-center justify-center min-w-[32px] h-8 px-2.5 rounded-full bg-white/10 border border-white/10 text-xs font-black text-white shadow-lg group-hover:bg-white/15 transition-all duration-300">{count}</span>
                          )}
                        </div>

                        <div className="flex flex-col items-start gap-1 relative z-10 mt-auto w-full">
                          <span className="text-sm sm:text-base lg:text-lg font-black text-white/90 leading-tight text-left tracking-tight group-hover:text-white transition-colors duration-300 uppercase">
                            {btn.label}
                          </span>
                          <div className="flex items-center justify-between w-full mt-0.5">
                            <span className="text-[10px] font-medium text-white/25 tracking-wide group-hover:text-white/50 transition-colors duration-300">
                              {getSubtitle(btn)}
                            </span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-white/0 group-hover:text-white/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </div>
                        </div>
                      </button>
                    );

                  })}
                </nav>

                {/* WIDGETS COLUMN */}
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-4 xl:gap-5 w-full lg:w-[280px] xl:w-[320px] 2xl:w-[400px]" />
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
                </div>
              </div>
            </div>

            {/* ── KPI BAR MÓVIL ─────────────────────────────────────────── */}
            {(() => {
              const fmt = (n) => `$${Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
              const todayProfit = kpiIncome.today - kpiIncome.todayExpenses;
              const goalPct = kpiDailyGoal > 0 ? Math.min(100, Math.round((kpiIncome.today / kpiDailyGoal) * 100)) : 0;
              const cards = [
                { label: "Ingresos hoy", value: kpiIncome.loading ? "…" : fmt(kpiIncome.today), sub: `Ganancia: ${fmt(todayProfit)}`, icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                { label: "Meta diaria", value: kpiIncome.loading ? "…" : `${goalPct}%`, sub: `${fmt(kpiIncome.today)} / ${fmt(kpiDailyGoal)}`, icon: TrendingUp, color: goalPct >= 100 ? "text-yellow-400" : goalPct >= 70 ? "text-emerald-400" : "text-blue-400", bg: goalPct >= 100 ? "bg-yellow-500/10" : "bg-blue-500/10", border: goalPct >= 100 ? "border-yellow-500/20" : "border-blue-500/20", progress: goalPct },
                { label: "Activas", value: kpiStats.active, sub: `${kpiStats.readyToPickup} listas`, icon: Wrench, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20" },
                { label: "Entregadas hoy", value: kpiStats.deliveredToday, sub: "completadas", icon: PackageCheck, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
                { label: "Sin movimiento", value: kpiStats.overdue, sub: "+7 días", icon: Timer, color: kpiStats.overdue > 0 ? "text-red-400" : "text-slate-500", bg: kpiStats.overdue > 0 ? "bg-red-500/10" : "bg-white/[0.03]", border: kpiStats.overdue > 0 ? "border-red-500/20" : "border-white/[0.07]" },
              ];
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

            {/* Mobile Bento Grid - App Icons Style */}
            {(loading || loadingButtons) && dashboardButtons.length === 0 ? (
              <div className="grid grid-cols-2 gap-3 px-1">
                {[1, 2, 3, 4].map(i => <DashboardCardSkeleton key={i} />)}
              </div>
            ) : dashboardButtons.length > 0 ? (
               <div className="grid grid-cols-2 gap-4 px-1 pt-2">
                {dashboardButtons.map(btn => {
                  const iconMap = {
                    'ClipboardList': ClipboardList,
                    'Wrench': Wrench,
                    'Smartphone': Smartphone,
                    'Zap': Zap,
                    'Package': Package,
                    'Wallet': Wallet,
                    'BarChart3': BarChart3,
                    'Users': Users,
                    'Bell': Bell,
                    'SettingsIcon': SettingsIcon,
                    'ExternalLink': ExternalLink
                  };
                  const IconComponent = (typeof btn.icon === 'string' && iconMap[btn.icon]) ? iconMap[btn.icon] : ExternalLink;

                  const getIconGradient = (label) => {
                    if (label.includes("Nueva")) return "from-blue-500 to-indigo-600 shadow-blue-500/20";
                    if (label.includes("Finanzas")) return "from-emerald-500 to-teal-600 shadow-emerald-500/20";
                    if (label.includes("Recargas")) return "from-amber-400 to-orange-500 shadow-amber-500/20";
                    if (label.includes("Rápidas")) return "from-rose-500 to-pink-600 shadow-rose-500/20";
                    if (label.includes("Desbloqueos")) return "from-violet-500 to-fuchsia-600 shadow-violet-500/20";
                    return "from-slate-500 to-slate-700 shadow-slate-500/20";
                  };

                  const getCount = (label) => {
                      if (label.includes("Nueva")) {
                          const active = recentOrders.filter(o => 
                              !["delivered", "cancelled", "completed", "picked_up"].includes(o.status) &&
                              o.device_type !== "Software" &&
                              !(o.order_number && o.order_number.startsWith("SW-"))
                          );
                          return active.length;
                      }
                      if (label.includes("Recargas")) return activeRechargesCount;
                      if (label.includes("Rápidas")) {
                           const active = recentOrders.filter(o => 
                              !["delivered", "cancelled", "completed", "picked_up"].includes(o.status) &&
                              o.device_type !== "Software"
                          );
                          return active.length;
                      }
                      if (label.includes("Desbloqueos")) {
                          const unlocks = recentOrders.filter(o => 
                              !["delivered", "cancelled", "completed", "picked_up", "ready_for_pickup"].includes(o.status) &&
                              (o.device_type === "Software" || (o.order_number && o.order_number.startsWith("SW-")))
                          );
                          return unlocks.length;
                      }
                      return null;
                  };

                  const count = getCount(btn.label);

                  const handleClick = () => {
                    if (btn.id === "new_order" || btn.action === "showWorkOrderWizard" || btn.action === "/WorkOrderWizard") {
                      setShowWorkOrderWizard(true);
                      return;
                    }
                    if (btn.type === "modal") {
                      if (btn.action === "showQuickRepair") setShowQuickRepair(true);
                      else if (btn.action === "showUnlocksDialog") setShowUnlocksDialog(true);
                    } else if (btn.type === "navigate") {
                      if (btn.action === "/Recharges" || btn.action === "Recharges") {
                        setShowRechargesPanel(true);
                      } else {
                        handleNavigate(btn.action);
                      }
                    } else if (btn.type === "external") {
                      window.open(btn.action, '_blank');
                    }
                  };

                  const getMobileSubtitle = (b) => {
                    if (b.id === "new_order" || b.action === "showWorkOrderWizard") return "Crear orden";
                    if (b.label.includes("Órdenes")) return "Ver historial";
                    if (b.label.includes("Inventario")) return "Stock";
                    if (b.label.includes("Finanzas")) return "Resumen";
                    if (b.label.includes("Recargas")) return "Gestionar";
                    if (b.label.includes("Rápidas")) return "Express";
                    if (b.label.includes("Desbloqueos")) return "IMEI";
                    if (b.label.includes("Cliente")) return "Clientes";
                    return "Abrir";
                  };

                  return (
                    <button
                      key={btn.id}
                      onClick={handleClick}
                      className="group relative bg-[#1C1C1E]/50 border border-white/[0.07] rounded-[28px] p-5 flex flex-col items-start justify-between min-h-[148px] active:scale-95 transition-all duration-300 shadow-xl overflow-hidden touch-manipulation"
                    >
                      {/* Inner shine */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] to-transparent pointer-events-none" />
                      {/* Color wash on tap */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${getIconGradient(btn.label).split(' shadow')[0]} opacity-0 active:opacity-[0.08] transition-opacity duration-200 pointer-events-none`} />

                      <div className="flex justify-between w-full items-start gap-3 relative z-10">
                        <div className={`w-12 h-12 rounded-[18px] bg-gradient-to-br ${getIconGradient(btn.label)} flex items-center justify-center shadow-lg`}>
                          <IconComponent className="w-6 h-6 text-white" strokeWidth={2.5} />
                        </div>
                        {count !== null && (
                          <span className="flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-white/10 border border-white/10 text-[10px] font-black text-white/90">
                            {count}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-start relative z-10 mt-auto w-full">
                        <span className="text-sm font-black text-white/95 leading-none tracking-tight">
                          {btn.label}
                        </span>
                        <div className="flex items-center justify-between w-full mt-2">
                          <span className="text-[10px] font-medium text-white/30 tracking-wide">
                            {getMobileSubtitle(btn)}
                          </span>
                          <ArrowUpRight className="w-3 h-3 text-white/20" />
                        </div>
                      </div>
                    </button>
               );
                })}
              </div>
            ) : null}

            {/* === BÚSQUEDA DE ÓRDENES MÓVIL === */}
            <div className="mx-1 mt-2">
              <div className="bg-[#1C1C1E]/40 backdrop-blur-3xl border border-white/[0.08] rounded-[32px] shadow-2xl overflow-hidden p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                      <ClipboardList className="w-4 h-4 text-blue-400" />
                    </div>
                    <h3 className="text-white/90 font-black text-sm uppercase tracking-tight">Gestión de Órdenes</h3>
                  </div>
                </div>

                {/* Chips de Estados - Premium Horizontal Scroll */}
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2 pt-2">
                  {ORDER_STATUSES.filter((s) => s.isActive).slice(0, 6).map((status) => {
                       const count = statusCounts[status.id] || 0;
                       const isSelected = selectedStatusFilter === status.id;
                       const isPendingOrder = status.id === "pending_order";

                       const iconMap = {
                         'intake': ClipboardList,
                         'diagnosing': Search,
                         'awaiting_approval': Clock,
                         'waiting_parts': Package,
                         'pending_order': AlertCircle,
                         'in_progress': Wrench,
                         'ready_for_pickup': CheckCircle2,
                       };
                       const StatusIcon = iconMap[status.id] || ClipboardList;

                       return (
                         <button 
                           key={status.id} 
                           onClick={() => {
                             setSelectedStatusFilter(isSelected ? null : status.id);
                             setShowUnlocksFilter(false);
                           }}
                           disabled={count === 0}
                           className={cn(
                             "relative flex-shrink-0 w-14 h-14 rounded-2xl transition-all border flex items-center justify-center active:scale-90 shadow-lg group",
                             isPendingOrder && count > 0
                               ? 'bg-red-500 border-red-400/50 shadow-red-500/40 animate-pulse'
                               : isSelected 
                                 ? 'bg-white border-white scale-105' 
                                 : 'bg-white/[0.03] border-white/[0.08]'
                           )}
                         >
                           <StatusIcon className={cn(
                             "w-6 h-6 transition-colors",
                             isSelected ? 'text-black' : 'text-white/60 group-hover:text-white'
                           )} strokeWidth={2.5} />
                           
                           {count > 0 && (
                             <span className={cn(
                               "absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[9px] font-black flex items-center justify-center shadow-lg border border-black/20",
                               isPendingOrder ? 'bg-white text-red-600' : isSelected ? 'bg-black text-white' : 'bg-blue-500 text-white'
                             )}>
                               {count}
                             </span>
                           )}
                           
                           {/* Invisible Label below for accessibility/reference if needed, but keeping it clean */}
                           <span className={cn(
                             "absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-tighter whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity",
                             isSelected ? "text-white" : "text-white/40"
                           )}>
                             {status.label}
                           </span>
                         </button>
                       );
                     })}

                     {/* Botón Garantías */}
                     <button 
                       onClick={() => {
                         setSelectedStatusFilter(selectedStatusFilter === "warranty" ? null : "warranty");
                         setShowUnlocksFilter(false);
                       }}
                       disabled={statusCounts.warranty === 0}
                       className={cn(
                         "relative flex-shrink-0 w-14 h-14 rounded-2xl transition-all border flex items-center justify-center active:scale-90 shadow-lg group",
                         selectedStatusFilter === "warranty" 
                           ? 'bg-white border-white scale-105' 
                           : 'bg-white/[0.03] border-white/[0.08]'
                       )}
                     >
                       <Shield className={cn(
                         "w-6 h-6 transition-colors",
                         selectedStatusFilter === "warranty" ? 'text-black' : 'text-white/60 group-hover:text-white'
                       )} strokeWidth={2.5} />
                       {statusCounts.warranty > 0 && (
                         <span className={cn(
                           "absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full text-[9px] font-black flex items-center justify-center shadow-lg border border-black/20",
                           selectedStatusFilter === "warranty" ? 'bg-black text-white' : 'bg-amber-500 text-white'
                         )}>
                           {statusCounts.warranty}
                         </span>
                       )}
                       <span className={cn(
                         "absolute -bottom-6 left-1/2 -translate-x-1/2 text-[8px] font-black uppercase tracking-tighter whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity",
                         selectedStatusFilter === "warranty" ? "text-white" : "text-white/40"
                       )}>
                         Garantías
                       </span>
                     </button>
                </div>

                {/* Buscador - Premium Sequoia Style */}
                <div className="relative pt-2">
                  <div className="absolute left-4 top-[calc(50%+4px)] -translate-y-1/2 h-5 w-5 flex items-center justify-center">
                    <Search className="h-4 w-4 text-white/30" strokeWidth={2.5} />
                  </div>
                  <input 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    placeholder="Buscar por orden, cliente o serial..." 
                    className="w-full pl-11 pr-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-white/[0.08] transition-all shadow-inner" 
                  />
                </div>
              </div>
            </div>

                              {/* Lista reducida - Modern Style */}
                <div className="pt-2">
                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-10 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                      <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                        <ClipboardList className="w-6 h-6 text-white/10" />
                      </div>
                      <p className="text-white/30 text-[10px] uppercase font-black tracking-widest">
                        {searchTerm ? 'Sin resultados' : 'Selecciona un estado'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[320px] overflow-y-auto no-scrollbar pt-1">
                      {filteredOrders.slice(0, 6).map((order) => {
                        const statusConfig = getStatusConfig(order.status);
                        return (
                          <div 
                            key={order.id}
                            onClick={() => handleOrderSelect(order.id)} 
                            className="group/order p-4 bg-white/[0.03] hover:bg-white/[0.06] rounded-2xl border border-white/[0.05] active:scale-[0.98] transition-all touch-manipulation cursor-pointer relative overflow-hidden"
                          >
                            <div className="flex justify-between items-start gap-3 relative z-10">
                              <div className="min-w-0 flex-1">
                                <p className="font-black text-white text-sm truncate tracking-tight uppercase group-hover/order:text-blue-400 transition-colors">
                                  {order.customer_name || "Cliente"}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[9px] font-black text-blue-500 uppercase tracking-tighter">#{order.order_number?.split('-')?.pop()}</span>
                                  <span className="w-1 h-1 rounded-full bg-white/20" />
                                  <p className="text-[9px] text-white/40 truncate font-black uppercase">
                                    {order.device_model || "Equipo"}
                                  </p>
                                </div>
                              </div>
                              <div className={cn(
                                "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border shadow-sm",
                                statusConfig.colorClasses.includes('bg-') ? statusConfig.colorClasses : `bg-white/5 border-white/10 text-white/60`
                              )}>
                                {statusConfig.label}
                              </div>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/[0.02] to-blue-500/0 opacity-0 group-hover/order:opacity-100 transition-opacity" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

{/* WorkQueueWidget removed */}

            {/* === LISTA DE PRECIOS MÓVIL === */}
            <div className="bg-[#1C1C1E]/40 backdrop-blur-3xl border border-emerald-500/20 rounded-[32px] shadow-2xl mx-1 mb-safe p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <PiggyBank className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-white font-black text-sm uppercase tracking-tight">{t('priceList')}</h3>
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center">
                  <Search className="h-4 w-4 text-white/20" />
                </div>
                <input 
                  value={priceSearch} 
                  onChange={(e) => setPriceSearch(e.target.value)} 
                  placeholder="Buscar productos..." 
                  className="w-full pl-11 pr-4 py-3.5 bg-white/[0.04] border border-white/[0.08] rounded-2xl text-sm text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:bg-white/[0.08] transition-all" 
                />
              </div>

              {priceSearch && filteredPriceList.length > 0 && (
                <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar pt-1">
                  {filteredPriceList.slice(0, 15).map((item) => (
                    <div 
                      key={`${item.type}-${item.id}`} 
                      className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-black text-sm truncate uppercase tracking-tight">{item.name}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-md border",
                              item.type === "service" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            )}>
                              {item.type === "service" ? "Servicio" : "Producto"}
                            </span>
                            {stockPill(item)}
                          </div>
                        </div>
                        <p className="text-emerald-400 font-black text-lg tracking-tighter">${(item.price || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* === BUSCAR ÓRDENES (SEQUOIA STYLE - SOLO DESKTOP) === */}
          <Card className="hidden md:block bg-gradient-to-br from-purple-600/10 via-blue-600/10 to-cyan-600/10 backdrop-blur-3xl border border-white/10 rounded-[32px] lg:rounded-[40px] xl:rounded-[48px] shadow-2xl relative overflow-hidden mt-6">
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
          </Card>

          {/* === LISTA DE PRECIOS - SEQUOIA STYLE === */}
          <Card className="hidden md:block bg-[#121215]/40 backdrop-blur-[40px] border border-emerald-500/20 rounded-[40px] shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse" />
            <CardContent className="p-8 lg:p-10 space-y-8 relative z-10">
              <h3 className="text-white text-2xl font-black flex items-center gap-4 tracking-tighter uppercase">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                  <PiggyBank className="w-8 h-8 text-emerald-400" />
                </div>
                {t('priceList')}
              </h3>
              
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Search className="w-6 h-6 text-white/20 group-focus-within:text-emerald-400 transition-colors duration-500" />
                </div>
                <input 
                  value={priceSearch} 
                  onChange={(e) => setPriceSearch(e.target.value)} 
                  placeholder={t('searchProducts')} 
                  className="bg-black/40 border border-white/10 pl-14 pr-6 rounded-2xl h-14 lg:h-16 text-base lg:text-lg text-white w-full outline-none focus:ring-2 focus:ring-emerald-500/50 font-bold transition-all duration-500 placeholder-white/20" 
                />
                <div className="absolute inset-0 border border-white/5 rounded-2xl pointer-events-none shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" />
              </div>

              {priceSearch && filteredPriceList.length > 0 && (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredPriceList.map((item) => (
                    <div 
                      key={`${item.type}-${item.id}`} 
                      className="group/item p-5 bg-white/5 hover:bg-[#121215]/60 backdrop-blur-3xl border border-white/5 hover:border-emerald-500/30 rounded-2xl lg:rounded-3xl transition-all duration-700 shadow-lg hover:shadow-2xl"
                    >
                      <div className="flex items-center justify-between gap-6">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-black text-lg truncate group-hover:text-emerald-400 transition-colors duration-500 uppercase tracking-tight">{item.name}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge className={`${item.type === "service" ? "bg-blue-600/20 text-blue-300" : "bg-emerald-600/20 text-emerald-300"} font-black uppercase tracking-widest text-[10px] px-3 border border-white/10`}>
                              {item.type === "service" ? t('service') : t('product')}
                            </Badge>
                            {stockPill(item)}
                          </div>
                        </div>
                        <p className="text-emerald-400 font-black text-2xl tracking-tighter shadow-sm">${(item.price || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>


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
          buttons={dashboardButtons.slice(2)}
          onButtonClick={(btn) => {
            // Forzar apertura de modal para botones de nueva orden
            if (btn.id === "new_order" || btn.action === "showWorkOrderWizard" || btn.action === "/WorkOrderWizard") {
              setShowWorkOrderWizard(true);
              return;
            }
            if (btn.type === "modal") {
              if (btn.action === "showQuickRepair") setShowQuickRepair(true);
              else if (btn.action === "showUnlocksDialog") setShowUnlocksDialog(true);
            } else if (btn.type === "navigate") {
              if (btn.action === "/Recharges" || btn.action === "Recharges") {
                setShowRechargesPanel(true);
              } else if (false) {
                setShowWorkOrderWizard(true);
              } else {
                handleNavigate(btn.action);
              }
            } else if (btn.type === "external") {
              window.open(btn.action, '_blank');
            }
          }}
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
