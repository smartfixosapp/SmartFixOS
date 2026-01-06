import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef
} from "react";
import { dataClient } from "@/components/api/dataClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  DollarSign,
  TrendingUp,
  Package,
  BarChart3,
  ExternalLink,
  LayoutGrid
} from "lucide-react";

import { format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/components/utils/i18n";
import { createPageUrl } from "@/components/utils/helpers";
import PunchButton from "@/components/dashboard/PunchButton";

import WorkOrderWizard from "../components/workorder/WorkOrderWizard";
import QuickOrderModal from "../components/workorder/QuickOrderModal";
import MobileMoreMenu from "../components/dashboard/MobileMoreMenu";
import { useDeviceDetection } from "../components/utils/useDeviceDetection";
import {
  Settings as SettingsIcon2,
  FileText
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
import FullNotificationPanel from "../components/notifications/FullNotificationPanel";
import UserMenuModal from "../components/layout/UserMenuModal";
import PersonalNotesWidget from "../components/dashboard/PersonalNotesWidget";
import TimeTrackingModal from "../components/timetracking/TimeTrackingModal";
import LogoutModal from "../components/dashboard/LogoutModal";

import {
  getCachedStatus,
  subscribeToCashRegister
} from "../components/cash/CashRegisterService";

import SmartNotificationsEngine from "../components/notifications/SmartNotificationsEngine";

// ⭐️ NUEVO IMPORT — Reparaciones rápidas
import QuickRepairPanel from "@/components/quickrepairs/QuickRepairPanel";
import DashboardLinksConfig from "@/components/dashboard/DashboardLinksConfig";

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

  const sessionRef = useRef(session);
  const [loading, setLoading] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(
    () => getCachedStatus().isOpen
  );
  const [currentDrawer, setCurrentDrawer] = useState(
    () => getCachedStatus().drawer
  );

  const [recentOrders, setRecentOrders] = useState([]);
  const [priceListItems, setPriceListItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [priceSearch, setPriceSearch] = useState("");

  const [showWorkOrderWizard, setShowWorkOrderWizard] = useState(false);
  const [showQuickOrderModal, setShowQuickOrderModal] = useState(false);
  const [showOpenDrawer, setShowOpenDrawer] = useState(false);
  const [showCloseDrawer, setShowCloseDrawer] = useState(false);

  const lastFetchRef = useRef(0);

  const [stats, setStats] = useState({
    revenue: 0,
    expenses: 0,
    net: 0,
    salesCount: 0
  });

  const [toast, setToast] = useState(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // ⭐️ NUEVO STATE PARA REPARACIONES RÁPIDAS
  const [showQuickRepair, setShowQuickRepair] = useState(false);
  
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

  // Monitoreo caja registradora
  useEffect(() => {
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

  // Cargar estadísticas financieras
  const loadFinancialStats = useCallback(async () => {
    if (!drawerOpen || !currentDrawer) {
      console.log("🔒 Caja cerrada – no cargar stats");
      return;
    }

    try {
      // ✅ USAR LA FECHA DE APERTURA DE LA CAJA ACTUAL
      const drawerOpenDate = new Date(currentDrawer.created_date);

      const sales = await dataClient.entities.Sale.list("-created_date", 300);
      const transactions = await dataClient.entities.Transaction.list("-created_date", 300);

      // ✅ FILTRAR SOLO VENTAS DESDE QUE SE ABRIÓ LA CAJA
      const filteredSales = (sales || []).filter(
        (s) => !s.voided && new Date(s.created_date) >= drawerOpenDate
      );

      const filteredExpenses = (transactions || []).filter(
        (t) => t.type === "expense" && new Date(t.created_date) >= drawerOpenDate
      );

      const revenue = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const expenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

      setStats({
        revenue,
        expenses,
        net: revenue - expenses,
        salesCount: filteredSales.length
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  }, [drawerOpen, currentDrawer]);

  useEffect(() => {
    if (session && drawerOpen) loadFinancialStats();
  }, [session, drawerOpen, loadFinancialStats]);

  // Live refresh callbacks
  useEffect(() => {
    const handleSale = () => setTimeout(() => loadFinancialStats(), 3000);
    const handleCashClosed = () => setStats({ revenue: 0, expenses: 0, net: 0, salesCount: 0 });

    window.addEventListener("sale-completed", handleSale);
    window.addEventListener("cash-register-closed", handleCashClosed);

    return () => {
      window.removeEventListener("sale-completed", handleSale);
      window.removeEventListener("cash-register-closed", handleCashClosed);
    };
  }, [loadFinancialStats]);

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

  const loadFreshData = useCallback(async () => {
    if (!sessionRef.current?.userId) return;

    const now = Date.now();
    if (now - lastFetchRef.current < 120000) return;
    lastFetchRef.current = now;

    setLoading(true);
    try {
      await dataClient.auth.me();

      let orderFilter =
        sessionRef.current.userRole === "technician"
          ? { assigned_to: sessionRef.current.userId, deleted: false }
          : { deleted: false };

      const orders = await dataClient.entities.Order.filter(
        orderFilter,
        "-updated_date",
        100
      );

      const products = await dataClient.entities.Product.filter(
        { active: true },
        "-created_date",
        30
      );

      const services = await dataClient.entities.Service.filter(
        { active: true },
        "-created_date",
        30
      );

      // ✅ Separar órdenes normales y desbloqueos
      const activeOrders = orders.filter(
        (o) => !["delivered", "cancelled"].includes(o.status) && 
               !o.deleted &&
               o.device_type !== "Software" &&
               !(o.order_number && o.order_number.startsWith("SW-"))
      );

      const unlockOrders = orders.filter(
        (o) => !["delivered", "cancelled"].includes(o.status) && 
               !o.deleted &&
               (o.device_type === "Software" || (o.order_number && o.order_number.startsWith("SW-")))
      );

      const priceListData = [
        ...products.map((p) => ({ ...p, type: "product" })),
        ...services.map((s) => ({ ...s, type: "service" }))
      ];

      setRecentOrders([...activeOrders, ...unlockOrders]);
      setPriceListItems(priceListData);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;

    loadFreshData();
    loadUnreadNotifications();
    loadDashboardButtons();
    const iv = setInterval(() => loadFreshData(), 300000);
    return () => clearInterval(iv);
  }, [session, loadFreshData]);

  const loadDashboardButtons = async () => {
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "dashboard-buttons" });
      if (configs?.length > 0) {
        const buttons = configs[0].payload?.buttons || [];
        setDashboardButtons(buttons.filter(b => b.enabled).sort((a, b) => a.order - b.order));
      } else {
        // Si no hay configuración, no mostrar botones
        setDashboardButtons([]);
      }
    } catch (error) {
      console.error("Error loading dashboard buttons:", error);
      setDashboardButtons([]);
    }
  };

  useEffect(() => {
    const handleUpdate = () => loadDashboardButtons();
    const handleOpen = () => setShowDashboardConfig(true);
    window.addEventListener('dashboard-buttons-updated', handleUpdate);
    window.addEventListener('open-dashboard-config', handleOpen);
    return () => {
      window.removeEventListener('dashboard-buttons-updated', handleUpdate);
      window.removeEventListener('open-dashboard-config', handleOpen);
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
      const { base44 } = await import("@/api/base44Client");
      const notifications = await base44.entities.Notification.filter({
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

    return counts;
  }, [recentOrders]);

  if (!session) return null;

  return (
    <div className="min-h-screen pb-20 md:pb-6">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="px-2 sm:px-3 md:px-6 pt-3 sm:pt-4 md:pt-6 pb-6">
        <div className="max-w-[1920px] mx-auto space-y-3 sm:space-y-4 md:space-y-6">
          
          {/* === DESKTOP: HEADER / BAR SUPERIOR === */}
          <div className="hidden md:block bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 shadow-[0_8px_32px_rgba(0,168,232,0.3)]">

            {/* BARRA SUPERIOR CON BOTONES ESTILO MODERNO */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
              <div className="flex gap-2">
                <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-pink-600 h-12 px-4 rounded-xl shadow-lg flex items-center justify-center pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/10" />
                  <span className="text-sm font-bold relative z-10 text-white">{session?.userName || 'Usuario'}</span>
                </div>

                <PunchButton 
                  userId={session?.userId}
                  userName={session?.userName}
                  onPunchStatusChange={(status) => {
                    if (status) {
                      showToast("👋 ¡Bienvenido!", "Buen turno");
                    } else {
                      showToast("👋 ¡Hasta luego!", "Que descanses");
                    }
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">


                <button
                  onClick={() => setShowNotificationPanel(!showNotificationPanel)}
                  className="relative overflow-hidden bg-gradient-to-br from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 h-12 px-4 rounded-xl shadow-lg hover:shadow-[0_8px_24px_rgba(251,146,60,0.4)] active:scale-95 transition-all flex items-center gap-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/10" />
                  <Bell className="w-5 h-5 relative z-10" />
                  <span className="text-sm font-bold relative z-10">Avisos</span>

                  {unreadNotifications > 0 && (
                    <div className="absolute -top-1 -right-1 z-20 min-w-[22px] h-[22px] px-1 rounded-full bg-gradient-to-br from-red-500 to-red-600 border-2 border-white shadow-[0_2px_8px_rgba(239,68,68,0.6)] flex items-center justify-center animate-pulse">
                      <span className="text-white font-black text-[10px]">
                        {unreadNotifications > 99 ? '99+' : unreadNotifications}
                      </span>
                    </div>
                  )}
                </button>

                <button
                  onClick={() => setShowLogoutModal(true)}
                  className="relative overflow-hidden bg-white/5 hover:bg-red-600/20 border border-white/10 hover:border-red-500/30 h-12 w-12 rounded-xl active:scale-95 transition-all flex items-center justify-center group"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-400 transition-colors" />
                </button>
              </div>
            </div>



            {/* BOTONES PRINCIPALES - CENTRADOS */}
            {dashboardButtons.length > 0 && (
              <div className="flex justify-center">
                <nav className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 max-w-4xl">
                  {dashboardButtons.map(btn => {
                    const iconMap = {
                      'ClipboardList': ClipboardList,
                      'Wrench': Wrench,
                      'Smartphone': Smartphone,
                      'Zap': Zap,
                      'Package': Package,
                      'Wallet': Wallet,
                      'BarChart3': BarChart3,
                      'ExternalLink': ExternalLink
                    };
                    const IconComponent = (typeof btn.icon === 'string' && iconMap[btn.icon]) ? iconMap[btn.icon] : ExternalLink;

                    const handleClick = () => {
                      if (btn.type === "modal") {
                        if (btn.action === "showWorkOrderWizard") setShowQuickOrderModal(true);
                        else if (btn.action === "showQuickRepair") setShowQuickRepair(true);
                        else if (btn.action === "showUnlocksDialog") setShowUnlocksDialog(true);
                      } else if (btn.type === "navigate") {
                        handleNavigate(btn.action);
                      } else if (btn.type === "external") {
                        window.open(btn.action, '_blank');
                      }
                    };

                    return (
                      <Button
                        key={btn.id}
                        onClick={handleClick}
                        className={`relative overflow-hidden bg-gradient-to-br ${btn.gradient} hover:brightness-110 h-24 md:h-28 flex-col gap-2 rounded-2xl shadow-lg hover:shadow-2xl active:scale-95 transition-all`}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/10" />
                        <IconComponent className="w-7 h-7 md:w-8 md:h-8 relative z-10" />
                        <span className="text-xs md:text-sm font-bold relative z-10 text-center leading-tight px-2">
                          {btn.label}
                        </span>
                      </Button>
                    );
                  })}
                </nav>
              </div>
            )}
          </div>

          {/* === MÓVIL: SALUDO Y ACCIONES RÁPIDAS === */}
          <div className="md:hidden space-y-3">
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-white text-lg font-bold mb-1">Hola, {session?.userName}</h2>
                  <p className="text-purple-200 text-sm">{format(new Date(), "EEEE, d MMMM", { locale: es })}</p>
                </div>
                <button
                  onClick={() => setShowUserMenu(true)}
                  className="min-w-[44px] min-h-[44px] w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                >
                  <Users className="w-6 h-6 text-white" />
                </button>
              </div>
            </div>



            {dashboardButtons.length > 0 && (
              <div className="flex justify-center px-4">
                <div className="grid grid-cols-2 gap-3 w-full" style={{ maxWidth: '400px' }}>
                  {/* En móvil: mostrar solo primeros 2 botones + botón "Más" */}
                  {isMobile ? (
                    <>
                      {dashboardButtons.slice(0, 2).map(btn => {
                        const iconMap = {
                          'ClipboardList': ClipboardList,
                          'Wrench': Wrench,
                          'Smartphone': Smartphone,
                          'Zap': Zap,
                          'Package': Package,
                          'Wallet': Wallet,
                          'BarChart3': BarChart3,
                          'ExternalLink': ExternalLink
                        };
                        const IconComponent = (typeof btn.icon === 'string' && iconMap[btn.icon]) ? iconMap[btn.icon] : ExternalLink;

                        const handleClick = () => {
                          if (btn.type === "modal") {
                            if (btn.action === "showWorkOrderWizard") setShowQuickOrderModal(true);
                            else if (btn.action === "showQuickRepair") setShowQuickRepair(true);
                            else if (btn.action === "showUnlocksDialog") setShowUnlocksDialog(true);
                          } else if (btn.type === "navigate") {
                            handleNavigate(btn.action);
                          } else if (btn.type === "external") {
                            window.open(btn.action, '_blank');
                          }
                        };

                        return (
                          <Button
                            key={btn.id}
                            onClick={handleClick}
                            className={`relative overflow-hidden bg-gradient-to-br ${btn.gradient} hover:brightness-110 min-h-[110px] h-auto flex-col gap-2 rounded-2xl shadow-lg active:scale-95 transition-all p-4`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/10" />
                            <IconComponent className="w-8 h-8 relative z-10" />
                            <span className="text-sm font-bold relative z-10 text-center leading-tight">
                              {btn.label}
                            </span>
                          </Button>
                        );
                      })}
                      
                      {/* Botón "Más" - Siempre visible si hay más de 2 botones */}
                      {dashboardButtons.length > 2 && (
                        <Button
                          onClick={() => setShowMoreMenu(true)}
                          className="relative overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 min-h-[110px] h-auto flex-col gap-2 rounded-2xl shadow-lg active:scale-95 transition-all p-4 border-2 border-dashed border-white/20 col-start-2"
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/10" />
                          <LayoutGrid className="w-8 h-8 relative z-10 text-white" />
                          <span className="text-sm font-bold relative z-10 text-center leading-tight text-white">
                            Más
                          </span>
                          <span className="text-xs text-gray-300 relative z-10">
                            +{dashboardButtons.length - 2}
                          </span>
                        </Button>
                      )}
                    </>
                  ) : (
                    // En tablet/desktop: mostrar todos los botones
                    dashboardButtons.map(btn => {
                      const iconMap = {
                        'ClipboardList': ClipboardList,
                        'Wrench': Wrench,
                        'Smartphone': Smartphone,
                        'Zap': Zap,
                        'Package': Package,
                        'Wallet': Wallet,
                        'BarChart3': BarChart3,
                        'ExternalLink': ExternalLink
                      };
                      const IconComponent = (typeof btn.icon === 'string' && iconMap[btn.icon]) ? iconMap[btn.icon] : ExternalLink;

                      const handleClick = () => {
                        if (btn.type === "modal") {
                          if (btn.action === "showWorkOrderWizard") setShowQuickOrderModal(true);
                          else if (btn.action === "showQuickRepair") setShowQuickRepair(true);
                          else if (btn.action === "showUnlocksDialog") setShowUnlocksDialog(true);
                        } else if (btn.type === "navigate") {
                          handleNavigate(btn.action);
                        } else if (btn.type === "external") {
                          window.open(btn.action, '_blank');
                        }
                      };

                      return (
                        <Button
                          key={btn.id}
                          onClick={handleClick}
                          className={`relative overflow-hidden bg-gradient-to-br ${btn.gradient} hover:brightness-110 min-h-[110px] h-auto flex-col gap-2 rounded-2xl shadow-lg active:scale-95 transition-all p-4`}
                        >
                          <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/10" />
                          <IconComponent className="w-8 h-8 relative z-10" />
                          <span className="text-sm font-bold relative z-10 text-center leading-tight">
                            {btn.label}
                          </span>
                        </Button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

          </div>

          {/* === REPORTES FINANCIEROS === */}
          <div className="space-y-3">
            {/* KPIs Grid - Responsive 1 columna en móvil pequeño, 2 en móvil normal, 4 en desktop */}
            <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Ingresos Totales */}
              <div className="bg-gradient-to-br from-slate-900/80 to-black/80 backdrop-blur-xl border border-cyan-500/20 rounded-xl p-3 sm:p-4 relative overflow-hidden min-h-[120px]">
                <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center mb-2">
                    <DollarSign className="w-5 h-5 text-cyan-400" />
                  </div>
                  <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide mb-1">Ingresos Totales</p>
                  <p className="text-white text-xl sm:text-2xl font-bold">${stats.revenue.toFixed(2)}</p>
                  <p className="text-gray-500 text-[10px] sm:text-xs mt-1">{stats.salesCount} transacciones</p>
                </div>
              </div>

              {/* Ticket Promedio */}
              <div className="bg-gradient-to-br from-slate-900/80 to-black/80 backdrop-blur-xl border border-purple-500/20 rounded-xl p-3 sm:p-4 relative overflow-hidden min-h-[120px]">
                <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center mb-2">
                    <TrendingUp className="w-5 h-5 text-purple-400" />
                  </div>
                  <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide mb-1">Ticket Promedio</p>
                  <p className="text-white text-xl sm:text-2xl font-bold">
                    ${stats.salesCount > 0 ? (stats.revenue / stats.salesCount).toFixed(2) : '0.00'}
                  </p>
                  <p className="text-gray-500 text-[10px] sm:text-xs mt-1">Por transacción</p>
                </div>
              </div>

              {/* IVU Recaudado */}
              <div className="bg-gradient-to-br from-slate-900/80 to-black/80 backdrop-blur-xl border border-emerald-500/20 rounded-xl p-3 sm:p-4 relative overflow-hidden min-h-[120px]">
                <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center mb-2">
                    <ClipboardList className="w-5 h-5 text-emerald-400" />
                  </div>
                  <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide mb-1">IVU Recaudado</p>
                  <p className="text-white text-xl sm:text-2xl font-bold">${(stats.revenue * 0.115).toFixed(2)}</p>
                  <p className="text-gray-500 text-[10px] sm:text-xs mt-1">11.5% de ventas</p>
                </div>
              </div>

              {/* Transacciones */}
              <div className="bg-gradient-to-br from-slate-900/80 to-black/80 backdrop-blur-xl border border-orange-500/20 rounded-xl p-3 sm:p-4 relative overflow-hidden min-h-[120px]">
                <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="w-10 h-10 rounded-lg bg-orange-600/20 border border-orange-500/30 flex items-center justify-center mb-2">
                    <Wallet className="w-5 h-5 text-orange-400" />
                  </div>
                  <p className="text-gray-400 text-[10px] sm:text-xs uppercase tracking-wide mb-1">Transacciones</p>
                  <p className="text-white text-xl sm:text-2xl font-bold">{stats.salesCount}</p>
                  <p className="text-gray-500 text-[10px] sm:text-xs mt-1">Ventas completadas</p>
                </div>
              </div>
            </div>

            {/* CAJA REGISTRADORA */}
            <Card className="bg-gradient-to-br from-slate-900/80 to-black/80 backdrop-blur-xl border border-cyan-500/20 rounded-xl">
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-emerald-400" />
                    <p className="text-white text-xs sm:text-sm font-bold">
                      {drawerOpen ? "Caja Abierta ✅" : "Caja Cerrada"}
                    </p>
                  </div>
                  <Badge className={`text-[10px] sm:text-xs ${drawerOpen ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/30" : "bg-red-600/20 text-red-300 border-red-500/30"}`}>
                    {drawerOpen ? "Activa" : "Cerrada"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {drawerOpen ? (
                    <>
                      <Button 
                        onClick={() => handleNavigate("Financial")} 
                        className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-700 min-h-[44px] text-xs"
                      >
                        <Wallet className="w-3 h-3 mr-1" />
                        <span className="hidden xs:inline">Ver Transacciones</span>
                        <span className="xs:hidden">Transacciones</span>
                      </Button>
                      <Button 
                        onClick={() => setShowCloseDrawer(true)} 
                        className="flex-1 bg-gradient-to-r from-red-600 to-red-800 min-h-[44px] text-xs"
                      >
                        Cerrar Caja
                      </Button>
                    </>
                  ) : (
                    <Button 
                      onClick={() => setShowOpenDrawer(true)} 
                      className="w-full bg-gradient-to-r from-emerald-600 to-emerald-800 min-h-[44px] text-xs"
                    >
                      <Wallet className="w-3 h-3 mr-1" />Abrir Caja
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* === BUSCAR ÓRDENES === */}
          <Card className="bg-gradient-to-br from-slate-900/60 to-slate-800/60 backdrop-blur-xl border border-cyan-500/20 rounded-2xl">
            <CardContent className="p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-white font-bold text-sm sm:text-base">🔍 {t('orders')}</h3>
              </div>

              <div className="relative">
                <input 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  placeholder="Buscar por cliente o número..." 
                  className="bg-slate-900/60 border border-slate-700 pl-10 pr-4 rounded-xl min-h-[44px] h-11 text-sm text-slate-50 w-full outline-none focus:ring-2 focus:ring-cyan-500/60 placeholder:text-gray-500" 
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>

              {/* ESTADOS DE LAS ÓRDENES */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1">
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
                      style={{
                        backgroundColor: isSelected ? undefined : status.color ? `${status.color}33` : undefined,
                        borderColor: status.color ? `${status.color}66` : undefined,
                      }}
                      className={`px-3 py-2 min-h-[44px] rounded-xl transition-all text-xs font-bold whitespace-nowrap disabled:opacity-30 border ${
                        isSelected
                          ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white scale-105 shadow-lg"
                          : "text-white active:scale-95"
                      } ${isPendingOrder && count > 0 ? "rudolph-nose" : ""}`}
                    >
                      {status.label} ({count})
                    </button>
                  );
                })}
              </div>

              {filteredOrders.length === 0 ? (
                <div className="text-center py-8 sm:py-12">
                  <ClipboardList className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-gray-600 mb-3 opacity-50" />
                  <p className="text-gray-400 text-xs sm:text-sm px-4">
                    {searchTerm ? t('noOrdersFound') : showUnlocksFilter ? 'No hay desbloqueos pendientes' : selectedStatusFilter ? 'No hay órdenes en este estado' : 'Selecciona un estado o busca una orden'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                 {filteredOrders.map((order) => {
                   const statusConfig = getStatusConfig(order.status);
                   const isUnlock = order.device_type === "Software" || (order.order_number && order.order_number.startsWith("SW-"));
                   return (
                     <div 
                       key={order.id}
                       onClick={() => handleOrderSelect(order.id)} 
                       className="p-3 bg-slate-900/60 backdrop-blur-xl rounded-xl border border-slate-700 hover:border-cyan-500/50 cursor-pointer transition-all active:scale-[0.98] min-h-[60px]"
                     >
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-white text-sm truncate">{order.customer_name || "—"}</p>
                            <p className="text-xs text-gray-400 truncate">{order.order_number || "SIN #"}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-medium whitespace-nowrap ${statusConfig.colorClasses}`}>
                              {statusConfig.label}
                            </span>
                            <p className="text-[10px] sm:text-xs text-gray-400 mt-1">
                              {format(new Date(order.created_date), "d MMM", { locale: es })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* === LISTA DE PRECIOS - OCULTA EN MÓVIL === */}
          <Card className="hidden md:block bg-black/40 backdrop-blur-xl border border-cyan-500/20">
            <CardContent className="p-3 sm:p-4 space-y-3">
              <h3 className="text-white font-bold flex items-center gap-2">💰 {t('priceList')}</h3>
              <div className="relative">
                <input 
                  value={priceSearch} 
                  onChange={(e) => setPriceSearch(e.target.value)} 
                  placeholder={t('searchProducts')} 
                  className="bg-black/20 border border-cyan-500/20 pl-8 pr-2 rounded-md h-10 text-sm text-slate-50 w-full outline-none focus:ring-2 focus:ring-cyan-500/60" 
                />
                <Search className="w-4 h-4 text-gray-200/60 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {priceSearch && filteredPriceList.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredPriceList.map((item) => (
                    <div 
                      key={`${item.type}-${item.id}`} 
                      className="p-3 bg-black/20 border border-cyan-500/10 rounded-lg"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-white font-semibold text-sm truncate">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={item.type === "service" ? "bg-blue-600/20 text-blue-300 text-xs" : "bg-emerald-600/20 text-emerald-300 text-xs"}>
                              {item.type === "service" ? t('service') : t('product')}
                            </Badge>
                            {stockPill(item)}
                          </div>
                        </div>
                        <p className="text-emerald-400 font-bold text-lg">${(item.price || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* === WIDGETS === */}
          <div className="max-w-2xl mx-auto">
            <PersonalNotesWidget />
          </div>
        </div>
      </div>

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

      {showQuickOrderModal && (
        <QuickOrderModal
          open={showQuickOrderModal}
          onClose={() => setShowQuickOrderModal(false)}
          onSuccess={() => loadFreshData()}
        />
      )}

      {showOpenDrawer && (
        <OpenDrawerDialog
          open={showOpenDrawer}
          onClose={() => setShowOpenDrawer(false)}
          onSuccess={() => {
            setShowOpenDrawer(false);
            showToast("✅ Caja abierta");
          }}
        />
      )}

      {showCloseDrawer && currentDrawer && (
        <CloseDrawerDialog
          open={showCloseDrawer}
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

      {/* ✅ MENÚ "MÁS" PARA MÓVIL */}
      {showMoreMenu && (
        <MobileMoreMenu
          open={showMoreMenu}
          onClose={() => setShowMoreMenu(false)}
          buttons={dashboardButtons.slice(2)}
          onButtonClick={(btn) => {
            if (btn.type === "modal") {
              if (btn.action === "showWorkOrderWizard") setShowQuickOrderModal(true);
              else if (btn.action === "showQuickRepair") setShowQuickRepair(true);
              else if (btn.action === "showUnlocksDialog") setShowUnlocksDialog(true);
            } else if (btn.type === "navigate") {
              handleNavigate(btn.action);
            } else if (btn.type === "external") {
              window.open(btn.action, '_blank');
            }
          }}
        />
      )}

      {/* ✨ ANIMACIÓN NARIZ DE RUDOLPH */}
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
      `}</style>
    </div>
  );
}
