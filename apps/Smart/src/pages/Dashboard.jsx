import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from "react";
import { dataClient } from "@/components/api/dataClient";
import { base44 } from "@/api/base44Client";
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
  Smartphone,
  Zap,
  LogOut,
  Package,
  BarChart3,
  ExternalLink,
  Link,
  LayoutGrid,
  X,
  CheckCircle2,
  AlertTriangle,
  Shield,
  ArrowUpRight,
  DollarSign,
  Timer,
  Check,
  Sunrise,
  Sunset,
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
import TechnicianView from "../components/dashboard/TechnicianView";
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
  getStatusConfig,
  getEffectiveOrderStatus,
  normalizeStatusId
} from "@/components/utils/statusRegistry";

import WorkOrderPanel from "../components/workorder/WorkOrderPanel";
import WorkOrderPanelErrorBoundary from "../components/workorder/WorkOrderPanelErrorBoundary";
import FullNotificationPanel from "../components/notifications/FullNotificationPanel";
import UserMenuModal from "../components/layout/UserMenuModal";
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
import DailyTransactionsModal from "@/components/dashboard/DailyTransactionsModal";
import MonthlyReportModal, { shouldShowMonthlyReport } from "@/components/financial/MonthlyReportModal";
const DASHBOARD_WIDGETS_KEY = "smartfix_dashboard_widgets_v2";
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
// ── ARIA se gestiona desde /components/aria/ARIAChat.jsx (componente global) ──


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
  // Filtro del feed de atención (null | 'urgent' | 'ready')
  // Feed categorías: tareas de turno
  const [pendingShiftTasks, setPendingShiftTasks] = useState([]);
  const [completingTaskId, setCompletingTaskId] = useState(null);
  // Categoría activa en el panel de atención
  const [showUnlocksFilter, setShowUnlocksFilter] = useState(false);
  const [showTimeTracking, setShowTimeTracking] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDashboardConfig, setShowDashboardConfig] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState(() => {
    try {
      const raw = localStorage.getItem(DASHBOARD_WIDGETS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return { kpiIncome: true, kpiGoal: true, kpiActive: true, kpiDelivered: true, kpiOverdue: true, orders: false, priceList: false, urgentOrders: true, readyPickup: true, posSalesToday: true, criticalStock: true, newCustomers: false, cashStatus: true, avgRepairTime: false, technicianLoad: false, navNewOrder: true, navOrders: true, navInventory: true, navFinancial: true, navReports: false, ...parsed };
    } catch { return { kpiIncome: true, kpiGoal: true, kpiActive: true, kpiDelivered: true, kpiOverdue: true, orders: false, priceList: false, urgentOrders: true, readyPickup: true, posSalesToday: true, criticalStock: true, newCustomers: false, cashStatus: true, avgRepairTime: false, technicianLoad: false, navNewOrder: true, navOrders: true, navInventory: true, navFinancial: true, navReports: false }; }
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
  const [showPriceList, setShowPriceList] = useState(false);
  const [priceListSearch, setPriceListSearch] = useState("");
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
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") runSmartChecks();
    }, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Chequeo de sesion cada 30s (solo si tab visible)
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      const s = readSessionSync();
      setSession((prev) => (JSON.stringify(prev) !== JSON.stringify(s) ? s : prev));
    };
    const iv = setInterval(tick, 60000); // 60s en vez de 30s
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
      const closedStatuses = ["delivered", "cancelled", "completed", "picked_up"];
      const isTech = sessionRef.current.userRole === "technician";

      const [allOrders, recharges, products, services] = await Promise.all([
        // Usar .list() igual que Orders.jsx — más confiable que .filter() con $nin
        // Reducido de 300 → 120 para acelerar la carga del Dashboard. Las órdenes
        // cerradas se filtran localmente después, así que 120 recientes por updated_date
        // suele cubrir todas las activas (típicamente < 50). Si hay más, el usuario
        // puede refrescar o ir a /Orders que trae su propia lista.
        dataClient.entities.Order.list("-updated_date", 120).catch(err => {
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

      // Filtrar localmente — más robusto que usar $nin en el servidor
      const orders = (allOrders || []).filter(o => {
        if (o.deleted) return false;
        const s = getEffectiveOrderStatus(o);
        if (closedStatuses.includes(s)) return false;
        // Si es técnico, solo sus órdenes
        if (isTech && o.assigned_to !== sessionRef.current.userId) return false;
        return true;
      });

      const activeOrders = [];
      const unlockOrders = [];
      for (const o of orders) {
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
            .select("amount, type, created_at")
            .eq("tenant_id", tenantId)
            .gte("created_at", monthStart);
          const rows = txRows || [];
          const isIncome = (r) => r.type === "revenue" || r.type === "income";
          const todayIncome    = rows.filter(r => isIncome(r) && r.created_at >= todayStart).reduce((s, r) => s + (Number(r.amount) || 0), 0);
          const todayExpenses  = rows.filter(r => r.type === "expense" && r.created_at >= todayStart).reduce((s, r) => s + (Number(r.amount) || 0), 0);
          const monthIncome    = rows.filter(r => isIncome(r)).reduce((s, r) => s + (Number(r.amount) || 0), 0);
          setKpiIncome({ today: todayIncome, month: monthIncome, todayExpenses, loading: false });
          setTodayTxCount(rows.filter(r => r.created_at >= todayStart).length);

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
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") loadFreshData();
    }, 300000);
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
        setWidgetConfig({ kpiIncome: true, kpiGoal: true, kpiActive: true, kpiDelivered: true, kpiOverdue: true, orders: false, priceList: false, urgentOrders: true, readyPickup: true, posSalesToday: true, criticalStock: true, newCustomers: false, cashStatus: true, avgRepairTime: false, technicianLoad: false, navNewOrder: true, navOrders: true, navInventory: true, navFinancial: true, navReports: false, ...parsed });
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
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadUnreadNotifications();
    }, 60000);
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

  const priceListFiltered = React.useMemo(() => {
    if (!priceListSearch.trim()) return priceListItems.slice(0, 40);
    const q = priceListSearch.toLowerCase();
    return priceListItems
      .filter(p => p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q))
      .slice(0, 40);
  }, [priceListItems, priceListSearch]);

  // ── KPI stats computed from already-loaded orders ──────────────────────────

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



  // Tareas de turno pendientes del usuario
  useEffect(() => {
    if (!session?.userId) return;
    const load = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const allTasks = await base44.entities.ShiftTask.filter({ active: true }, 'sort_order', 100);
        const role = session.role || '';
        const myTasks = (allTasks || []).filter(t =>
          (!t.assigned_to_employee_id && !t.assigned_to_role)
          || t.assigned_to_employee_id === session.userId
          || t.assigned_to_role === role
        );
        const logs = await base44.entities.ShiftTaskLog.filter(
          { employee_id: session.userId, shift_date: today }, '-completed_at', 100
        );
        const done = new Set((logs || []).map(l => l.task_id));
        setPendingShiftTasks(myTasks.filter(t => !done.has(t.id)));
      } catch (e) {
        console.error('[Dashboard] Error loading shift tasks:', e);
      }
    };
    load();
  }, [session?.userId]);

  const handleCompleteTask = async (task) => {
    if (completingTaskId) return;
    setCompletingTaskId(task.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      let sessionStart = now;
      try {
        const stored = JSON.parse(localStorage.getItem('smartfix_session_start') || 'null');
        if (stored?.date === today) sessionStart = stored.time;
      } catch (_) {}
      await base44.entities.ShiftTaskLog.create({
        task_id: task.id,
        task_title: task.title,
        task_type: task.type,
        employee_id: session.userId,
        employee_name: session.userName || '',
        shift_date: today,
        session_started_at: sessionStart,
        completed_at: now,
      });
      setPendingShiftTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (e) {
      console.error('[Dashboard] Error completing task:', e);
    } finally {
      setCompletingTaskId(null);
    }
  };

  if (!session) return null;

  // Resumen rápido — datos derivados de recentOrders y priceListItems (ya cargados)
  const quickStats = useMemo(() => {
    const closedStatuses = ["picked_up", "completed", "cancelled", "delivered"];
    const listas = recentOrders.filter(o => {
      const s = getEffectiveOrderStatus(o);
      return s === "ready" || s === "ready_for_pickup";
    }).length;
    const retrasadas = recentOrders.filter(o => {
      const s = getEffectiveOrderStatus(o);
      if (closedStatuses.includes(s)) return false;
      const d = new Date(o.updated_date || o.created_date);
      return (Date.now() - d.getTime()) / 86400000 >= 3;
    }).length;
    const stockCrit = priceListItems.filter(p =>
      p.type === "product" && typeof p.stock === "number" &&
      (p.stock <= 0 || (p.min_stock > 0 && p.stock <= p.min_stock))
    ).length;
    const completed = recentOrders.filter(o => {
      const s = getEffectiveOrderStatus(o);
      return ["delivered", "completed", "picked_up"].includes(s) && o.created_date && o.updated_date;
    });
    const avgDays = completed.length > 0
      ? completed.reduce((sum, o) => sum + Math.max(0, (new Date(o.updated_date) - new Date(o.created_date)) / 86400000), 0) / completed.length
      : 0;
    return { listas, retrasadas, stockCrit, avgDays: Math.round(avgDays * 10) / 10 };
  }, [recentOrders, priceListItems]);

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Technician simplified view — replaces full dashboard */}
      {session?.userRole === "technician" ? (
        <>
          <TechnicianView
            session={session}
            onNewOrder={() => setShowWorkOrderWizard(true)}
          />
          {showWorkOrderWizard && (
            <WorkOrderWizard
              key="normal-wizard-top"
              open={showWorkOrderWizard}
              onClose={() => setShowWorkOrderWizard(false)}
              onOrderCreated={() => { setShowWorkOrderWizard(false); }}
            />
          )}
        </>
      ) : (<>

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

      <div className="px-2 md:px-6 lg:px-8 xl:px-12 pt-[calc(env(safe-area-inset-top,0px)+6px)] md:pt-3 lg:pt-4 pb-[calc(80px+env(safe-area-inset-bottom,0px))] md:pb-3 flex-1 min-h-0 flex flex-col">
        <div className="max-w-[2560px] mx-auto w-full flex-1 min-h-0 flex flex-col">
          
          {/* === DESKTOP: PULSO — layout horizontal estilo Apple === */}
          <div className="apple-card hidden md:flex md:flex-row md:flex-1 md:min-h-0 apple-type overflow-hidden !rounded-apple-2xl">

            {/* ── Panel izquierdo: usuario + KPIs + accesos rápidos ── */}
            <div className="relative z-10 w-[260px] xl:w-[300px] shrink-0 flex flex-col gap-3 p-6 lg:p-7" style={{ borderRight: "0.5px solid rgb(var(--separator) / 0.29)" }}>

              {/* Usuario */}
              <div className="flex items-center gap-3 rounded-apple-md pl-2 pr-3 py-2 bg-gray-sys6 dark:bg-gray-sys5">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgb(var(--apple-blue))" }}
                >
                  <span className="apple-text-footnote font-semibold text-white">{session?.userName?.substring(0,2)?.toUpperCase() || 'US'}</span>
                </div>
                <div className="min-w-0">
                  <p className="apple-text-headline apple-label-primary leading-tight truncate">{session?.userName || 'Usuario'}</p>
                  <p className="apple-text-caption1 apple-label-secondary leading-tight mt-0.5 truncate">{businessName || session?.storeName || "SmartFixOS"}</p>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="flex items-center gap-2">
                <PunchButton userId={session?.userId} userName={session?.userName} variant="apple" onPunchStatusChange={(status) => { if (status) showToast("👋 ¡Hola!", "Turno iniciado"); else showToast("👋 ¡Adiós!", "Turno finalizado"); }} />
                <button
                  onClick={handleCashButtonClick}
                  className={cn(
                    "apple-press flex-1 h-10 rounded-apple-sm flex items-center justify-center transition-colors",
                    drawerOpen
                      ? "bg-apple-green/15 text-apple-green"
                      : "bg-apple-red/15 text-apple-red"
                  )}
                  title={drawerOpen ? "Cerrar caja" : "Abrir caja"}
                >
                  <Wallet className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="apple-press flex-1 h-10 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary hover:text-apple-red flex items-center justify-center transition-colors"
                  title="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Divider */}
              <div style={{ height: "0.5px", backgroundColor: "rgb(var(--separator) / 0.29)" }} />

              {/* KPI Ingresos hoy */}
              {(() => {
                const fmt = (n) => `$${Number(n||0).toLocaleString("en-US",{maximumFractionDigits:0})}`;
                const goalPct = kpiDailyGoal > 0 ? Math.min(100, Math.round((kpiIncome.today / kpiDailyGoal) * 100)) : 0;
                return (
                  <button
                    onClick={() => handleNavigate("Financial")}
                    className="apple-press apple-card p-3.5 flex items-center gap-3 text-left"
                  >
                    <div className="w-10 h-10 rounded-apple-sm bg-apple-green/15 flex items-center justify-center shrink-0">
                      <DollarSign className="w-[18px] h-[18px] text-apple-green" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="apple-text-title3 text-apple-green leading-tight tabular-nums">{kpiIncome.loading ? "…" : fmt(kpiIncome.today)}</p>
                      <p className="apple-text-caption1 apple-label-secondary truncate">
                        Ingresos hoy{kpiDailyGoal > 0 ? ` · ${goalPct}% meta` : ''}
                      </p>
                    </div>
                  </button>
                );
              })()}

              {/* Accesos rápidos */}
              <button onClick={() => setShowWorkOrderWizard(true)} className="apple-press min-h-[44px] bg-apple-blue/12 rounded-apple-sm flex items-center gap-3 px-3.5">
                <ClipboardList className="w-[18px] h-[18px] text-apple-blue shrink-0" />
                <span className="apple-text-footnote font-medium text-apple-blue">Nueva orden</span>
              </button>
              <button onClick={() => { setShowPriceList(true); setPriceListSearch(""); }} className="apple-press min-h-[44px] bg-apple-purple/12 rounded-apple-sm flex items-center gap-3 px-3.5">
                <Search className="w-[18px] h-[18px] text-apple-purple shrink-0" />
                <span className="apple-text-footnote font-medium text-apple-purple">Lista precios</span>
              </button>
              <button onClick={() => handleNavigate("Customers")} className="apple-press min-h-[44px] bg-apple-indigo/12 rounded-apple-sm flex items-center gap-3 px-3.5">
                <Users className="w-[18px] h-[18px] text-apple-indigo shrink-0" />
                <span className="apple-text-footnote font-medium text-apple-indigo">Clientes</span>
              </button>
            </div>

            {/* ── Panel derecho: Tareas del turno ── */}
            <div className="relative z-10 flex-1 flex flex-col min-h-0 p-6 lg:p-7">
              {/* Header */}
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-apple-xs bg-apple-blue/15 flex items-center justify-center">
                    <ClipboardList className="w-3.5 h-3.5 text-apple-blue" />
                  </div>
                  <span className="apple-text-headline apple-label-primary">Tareas del turno</span>
                </div>
                {pendingShiftTasks.length > 0 && (
                  <span className="min-w-6 h-6 px-2 rounded-full flex items-center justify-center apple-text-caption1 font-semibold text-white bg-apple-blue tabular-nums">
                    {pendingShiftTasks.length}
                  </span>
                )}
              </div>

              {/* Lista de tareas */}
              <div className="flex-1 apple-card overflow-hidden flex flex-col min-h-0 !p-0">
                <div className="flex-1 overflow-y-auto apple-scroll">
                  {pendingShiftTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 h-full gap-3">
                      <CheckCircle2 className="w-10 h-10 text-apple-green" />
                      <p className="apple-text-callout apple-label-secondary">Todo al día</p>
                    </div>
                  ) : (
                    pendingShiftTasks.map((task, idx) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-3 px-5 py-3.5"
                        style={idx > 0 ? { borderTop: "0.5px solid rgb(var(--separator) / 0.29)" } : undefined}
                      >
                        <div className={`w-9 h-9 rounded-apple-sm flex items-center justify-center shrink-0 ${task.type === 'opening' ? 'bg-apple-orange/15 text-apple-orange' : 'bg-apple-indigo/15 text-apple-indigo'}`}>
                          {task.type === 'opening' ? <Sunrise className="w-4 h-4" /> : <Sunset className="w-4 h-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="apple-text-body font-semibold apple-label-primary truncate">{task.title}</p>
                          {task.description && <p className="apple-text-footnote apple-label-secondary truncate">{task.description}</p>}
                        </div>
                        {task.priority === 'urgent' && (
                          <span className="apple-text-caption2 font-semibold px-1.5 py-0.5 rounded-full bg-apple-red/15 text-apple-red shrink-0">
                            Urgente
                          </span>
                        )}
                        <button
                          onClick={() => handleCompleteTask(task)}
                          disabled={completingTaskId === task.id}
                          className={`apple-press w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                            completingTaskId === task.id
                              ? 'bg-apple-green/25 text-apple-green animate-pulse'
                              : 'bg-apple-green/15 text-apple-green'
                          }`}
                        >
                          <Check className="w-[18px] h-[18px]" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Resumen rápido (KPIs) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4 shrink-0">
                <button
                  onClick={() => handleNavigate("Orders")}
                  className={cn(
                    "apple-press apple-card p-3 flex items-center gap-2.5 transition-colors",
                    quickStats.listas > 0 ? "" : ""
                  )}
                >
                  <CheckCircle2 className={cn("w-4 h-4 shrink-0", quickStats.listas > 0 ? "text-apple-green" : "apple-label-tertiary")} />
                  <div className="text-left min-w-0">
                    <p className={cn("apple-text-headline leading-tight tabular-nums", quickStats.listas > 0 ? "text-apple-green" : "apple-label-tertiary")}>{quickStats.listas}</p>
                    <p className="apple-text-caption2 apple-label-secondary">Listas</p>
                  </div>
                </button>
                <button
                  onClick={() => handleNavigate("Orders")}
                  className="apple-press apple-card p-3 flex items-center gap-2.5 transition-colors"
                >
                  <Clock className={cn("w-4 h-4 shrink-0", quickStats.retrasadas > 0 ? "text-apple-orange" : "apple-label-tertiary")} />
                  <div className="text-left min-w-0">
                    <p className={cn("apple-text-headline leading-tight tabular-nums", quickStats.retrasadas > 0 ? "text-apple-orange" : "apple-label-tertiary")}>{quickStats.retrasadas}</p>
                    <p className="apple-text-caption2 apple-label-secondary">Retrasadas</p>
                  </div>
                </button>
                <button
                  onClick={() => handleNavigate("Inventory")}
                  className="apple-press apple-card p-3 flex items-center gap-2.5 transition-colors"
                >
                  <AlertTriangle className={cn("w-4 h-4 shrink-0", quickStats.stockCrit > 0 ? "text-apple-red" : "apple-label-tertiary")} />
                  <div className="text-left min-w-0">
                    <p className={cn("apple-text-headline leading-tight tabular-nums", quickStats.stockCrit > 0 ? "text-apple-red" : "apple-label-tertiary")}>{quickStats.stockCrit}</p>
                    <p className="apple-text-caption2 apple-label-secondary">Stock crítico</p>
                  </div>
                </button>
                <div className="apple-card p-3 flex items-center gap-2.5">
                  <Package className="w-4 h-4 apple-label-tertiary shrink-0" />
                  <div className="text-left min-w-0">
                    <p className="apple-text-headline apple-label-secondary leading-tight tabular-nums">{quickStats.avgDays}d</p>
                    <p className="apple-text-caption2 apple-label-secondary">Tiempo prom.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* === MÓVIL: PULSO (Apple style) === */}
          <div className="md:hidden apple-type flex flex-col flex-1 min-h-0 gap-3 overflow-y-auto apple-scroll" style={{ WebkitOverflowScrolling: "touch" }}>
            {/* ── Header: greeting + avatar ── */}
            <div className="flex items-center justify-between px-4 pt-1 shrink-0">
              <div className="min-w-0 flex-1">
                <p className="apple-text-footnote apple-label-secondary">
                  {(() => { const h = new Date().getHours(); return h < 12 ? "Buenos días" : h < 18 ? "Buenas tardes" : "Buenas noches"; })()}
                </p>
                <h2 className="apple-text-title1 apple-label-primary truncate">
                  {session?.userName?.split(' ')[0] || 'Usuario'}
                </h2>
              </div>
              <button
                onClick={() => setShowUserMenu(true)}
                className="apple-press w-10 h-10 rounded-full bg-apple-blue flex items-center justify-center shrink-0"
                aria-label="Menu de usuario"
              >
                <span className="apple-text-footnote font-semibold text-white">{session?.userName?.substring(0,2)?.toUpperCase() || 'US'}</span>
              </button>
            </div>

            {/* ── Quick Actions: Nueva Orden (prominente) + Precios ── */}
            <div className="flex gap-2 px-4 shrink-0">
              <button onClick={() => setShowWorkOrderWizard(true)} className="apple-btn apple-btn-primary apple-btn-lg flex-1">
                <ClipboardList className="w-[18px] h-[18px]" />
                <span>Nueva orden</span>
              </button>
              <button onClick={() => { setShowPriceList(true); setPriceListSearch(""); }} className="apple-btn apple-btn-secondary apple-btn-lg px-4" style={{ width: 'auto', flex: '0 0 auto' }}>
                <Search className="w-[18px] h-[18px]" />
                <span>Precios</span>
              </button>
            </div>

            {/* ── Status row: Caja + Punch ── */}
            <div className="flex items-center gap-2 px-4 shrink-0">
              <button
                onClick={handleCashButtonClick}
                className={cn(
                  "apple-press flex-1 h-10 rounded-apple-sm flex items-center justify-center gap-2 apple-text-footnote font-medium transition-colors",
                  drawerOpen
                    ? "bg-apple-green/15 text-apple-green"
                    : "bg-apple-red/15 text-apple-red"
                )}
              >
                <Wallet className="w-4 h-4" />
                {drawerOpen ? "Caja abierta" : "Caja cerrada"}
              </button>
              <PunchButton userId={session?.userId} userName={session?.userName} variant="mobile-icon" onPunchStatusChange={(status) => { if (status) showToast("Turno iniciado"); else showToast("Turno finalizado"); }} />
            </div>

            {/* ── Ingresos hoy ── */}
            <div className="px-4 shrink-0">
              <button
                onClick={() => handleNavigate("Financial")}
                className="apple-press w-full apple-card p-4 flex items-center gap-3 text-left"
              >
                <div className="w-11 h-11 rounded-apple-sm bg-apple-green/15 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-apple-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="apple-text-caption1 apple-label-secondary">Ingresos hoy</p>
                  <p className="apple-text-title2 apple-label-primary tabular-nums leading-tight">
                    {kpiIncome.loading ? "…" : `$${(kpiIncome.today||0).toLocaleString("en-US",{maximumFractionDigits:0})}`}
                  </p>
                </div>
                <svg className="w-3 h-4 apple-label-tertiary shrink-0" viewBox="0 0 6 10" fill="currentColor" aria-hidden><path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
              </button>
            </div>

            {/* ── Tareas del turno (list estilo iOS) ── */}
            <div className={cn(
              "mx-4 flex flex-col",
              pendingShiftTasks.length > 0 ? "flex-1 min-h-0" : ""
            )}>
              <div className="flex items-center justify-between px-1 pb-2">
                <h3 className="apple-text-footnote apple-label-secondary font-medium tracking-wide">Tareas del turno</h3>
                {pendingShiftTasks.length > 0 && (
                  <span className="min-w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white bg-apple-blue px-1.5 tabular-nums">
                    {pendingShiftTasks.length}
                  </span>
                )}
              </div>
              {pendingShiftTasks.length > 0 ? (
                <div className="apple-list flex-1 overflow-y-auto apple-scroll">
                  {pendingShiftTasks.map(task => (
                    <div key={task.id} className="apple-list-row !min-h-0 !py-3">
                      <div className="w-8 h-8 rounded-apple-xs bg-apple-blue/15 flex items-center justify-center shrink-0">
                        <ClipboardList className="w-4 h-4 text-apple-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="apple-text-footnote font-semibold apple-label-primary truncate">{task.title}</p>
                      </div>
                      <button
                        onClick={() => handleCompleteTask(task)}
                        disabled={completingTaskId === task.id}
                        className="apple-press w-7 h-7 rounded-full bg-apple-green/15 text-apple-green flex items-center justify-center shrink-0"
                        aria-label="Completar tarea"
                      >
                        <Check className="w-[14px] h-[14px]" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="apple-card py-5 flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-apple-green" />
                  <p className="apple-text-footnote apple-label-secondary">Todo al día</p>
                </div>
              )}
            </div>
          </div>

        </div>
{/* WorkQueueWidget + PersonalNotesWidget removed per user request */}

      {/* -----------------------------
            MODALES / DIALOGS
      ------------------------------ */}

      {showWorkOrderWizard && (
        <WorkOrderWizard
          key="normal-wizard"
          open={showWorkOrderWizard}
          onClose={() => setShowWorkOrderWizard(false)}
          onSuccess={(createdOrder) => {
            setShowWorkOrderWizard(false);
            loadFreshData();
            if (createdOrder?.id) setSelectedOrderId(createdOrder.id);
          }}
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

      {/* Price List Modal */}
      {showPriceList && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-4" onClick={() => setShowPriceList(false)}>
          <div className="w-full max-w-lg bg-[#111] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                <Search className="w-5 h-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-white">Lista de Precios</h3>
                <p className="text-[10px] text-white/30 font-bold">{priceListItems.length} productos</p>
              </div>
              <button onClick={() => setShowPriceList(false)} className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/30 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <input
                autoFocus
                type="text"
                placeholder="Buscar producto o servicio..."
                value={priceListSearch}
                onChange={e => setPriceListSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 h-12 text-white text-sm font-medium placeholder-white/20 focus:outline-none focus:border-violet-500/50"
              />
            </div>
            <div className="max-h-[50vh] overflow-y-auto pb-4">
              {priceListFiltered.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-white/50 font-bold text-sm">Sin resultados</p>
                </div>
              ) : (
                priceListFiltered.map(item => (
                  <div key={item.id} className="flex items-center gap-4 px-5 py-3 border-t border-white/[0.04] first:border-0">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                      {item.type === 'service' ? <Wrench className="w-4 h-4 text-violet-400" /> : <Package className="w-4 h-4 text-violet-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{item.name}</p>
                      {item.sku && <p className="text-[10px] text-white/25 font-medium">SKU: {item.sku}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-emerald-400">${(item.price || 0).toFixed(2)}</p>
                      {typeof item.stock === 'number' && (
                        <p className={`text-[10px] font-bold ${item.stock <= 0 ? 'text-red-400' : 'text-white/25'}`}>
                          {item.stock <= 0 ? 'Agotado' : `Stock: ${item.stock}`}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
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
    </>)}
  </div>
);
}
