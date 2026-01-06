import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { 
  Clock, 
  LogOut, 
  UserCircle, 
  ShieldCheck, 
  Bell,
  Settings,
  ChevronRight,
  Database,
  Palette,
  DollarSign,
  Package,
  ExternalLink,
  ClipboardList,
  Globe,
  Users,
  Smartphone,
  Building2,
  FileText,
  Receipt,
  Save,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  CreditCard,
  Wallet,
  Calendar,
  BarChart3,
  TrendingDown,
  Mail,
  Activity,
  AlertCircle,
  Wrench,
  CheckSquare,
  Camera,
  Key,
  Lock,
  Fingerprint,
  ShieldAlert,
  History,
  Download,
  Cpu,
  HardDrive,
  Shield
} from "lucide-react";
import { Label } from "@/components/ui/label";
import NotificationService from "../notifications/NotificationService";

export default function UserMenuModal({ open, onClose, user }) {
  const navigate = useNavigate();
  const [punchStatus, setPunchStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  
  // Settings states
  const [appConfig, setAppConfig] = useState({
    business_name: "911 SmartFix",
    business_phone: "",
    business_email: "",
    tax_rate: 11.5,
    currency: "USD"
  });
  const [theme, setTheme] = useState("dark");
  const [paymentMethods, setPaymentMethods] = useState({
    cash: true,
    card: true,
    ath_movil: true,
    bank_transfer: false,
    check: false
  });

  useEffect(() => {
    if (open && user) {
      checkPunchStatus();
      loadNotificationSettings();
      loadCurrentUser();
      if (activeTab !== "profile") {
        loadSettings();
      }
    }
  }, [open, user, activeTab]);

  // ✅ NUEVO: Cargar el usuario completo desde la DB para obtener el rol actualizado
  const loadCurrentUser = async () => {
    try {
      if (user?.id) {
        const fullUser = await base44.entities.User.get(user.id);
        setCurrentUser(fullUser);
      } else {
        setCurrentUser(user);
      }
    } catch (error) {
      console.error("Error loading current user:", error);
      setCurrentUser(user);
    }
  };

  const checkPunchStatus = async () => {
    try {
      const timeEntryId = sessionStorage.getItem("timeEntryId");
      if (timeEntryId) {
        const entry = await base44.entities.TimeEntry.get(timeEntryId).catch(() => null);
        if (entry && !entry.clock_out) {
          setPunchStatus(entry);
          return;
        }
      }

      const openEntries = await base44.entities.TimeEntry.filter({
        employee_id: user.id,
        clock_out: null
      });

      if (openEntries?.length > 0) {
        setPunchStatus(openEntries[0]);
        sessionStorage.setItem("timeEntryId", openEntries[0].id);
      } else {
        setPunchStatus(null);
      }
    } catch (error) {
      console.error("Error checking punch status:", error);
      setPunchStatus(null);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const settings = await base44.entities.UserNotificationSettings.filter({ user_id: user.id });
      
      if (settings?.length) {
        setNotificationSettings(settings[0]);
      } else {
        // Create default settings
        const defaultSettings = {
          user_id: user.id,
          receive_new_order_notifications: true,
          receive_status_change_notifications: true,
          receive_low_stock_notifications: true,
          receive_order_ready_notifications: true,
          receive_payment_notifications: true,
          receive_urgent_notifications: true,
          receive_assignment_notifications: true,
          channel_web_push: false,
          channel_in_app: true
        };
        
        const created = await base44.entities.UserNotificationSettings.create(defaultSettings);
        setNotificationSettings(created);
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    }
  };

  const handlePunchToggle = async () => {
    setLoading(true);
    try {
      if (punchStatus) {
        // Clock out
        await base44.entities.TimeEntry.update(punchStatus.id, {
          clock_out: new Date().toISOString()
        });
        sessionStorage.removeItem("timeEntryId");
        setPunchStatus(null);
      } else {
        // Clock in
        const newEntry = await base44.entities.TimeEntry.create({
          employee_id: user.id,
          employee_name: user.full_name || user.email,
          clock_in: new Date().toISOString()
        });
        sessionStorage.setItem("timeEntryId", newEntry.id);
        setPunchStatus(newEntry);
      }
      
      window.dispatchEvent(new Event("force-refresh"));
    } catch (error) {
      console.error("Error toggling punch:", error);
      alert("Error al registrar ponche");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    // Cerrar turno automáticamente si está activo
    if (punchStatus) {
      try {
        await base44.entities.TimeEntry.update(punchStatus.id, {
          clock_out: new Date().toISOString()
        });
        sessionStorage.removeItem("timeEntryId");
      } catch (error) {
        console.error("Error closing punch:", error);
      }
    }

    // Limpieza completa y redirección directa
    try {
      onClose();
      localStorage.removeItem("employee_session");
      sessionStorage.removeItem("911-session");
      sessionStorage.removeItem("timeEntryId");
      
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith("dashboard_") || key.includes("session")) {
          sessionStorage.removeItem(key);
        }
      });

      navigate("/PinAccess", { replace: true });
    } catch (error) {
      console.error("Error during logout:", error);
      window.location.href = "/PinAccess";
    }
  };

  const handleToggleNotificationSetting = async (key) => {
    if (!notificationSettings) return;

    try {
      const updated = {
        ...notificationSettings,
        [key]: !notificationSettings[key]
      };

      await base44.entities.UserNotificationSettings.update(notificationSettings.id, updated);
      setNotificationSettings(updated);
    } catch (error) {
      console.error("Error updating notification settings:", error);
    }
  };

  const handleEnableWebPush = async () => {
    const granted = await NotificationService.requestPermission();
    
    if (granted) {
      await handleToggleNotificationSetting("channel_web_push");
      alert("✅ Notificaciones push habilitadas");
    } else {
      alert("❌ Permiso de notificaciones denegado");
    }
  };

  const loadSettings = async () => {
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "app-main-settings" });
      if (configs?.length) {
        setAppConfig({ ...appConfig, ...configs[0].payload });
      }
      
      const themeConfigs = await base44.entities.AppSettings.filter({ slug: "app-theme" });
      if (themeConfigs?.length) {
        setTheme(themeConfigs[0].payload?.theme || "dark");
      }
      
      const pmConfigs = await base44.entities.AppSettings.filter({ slug: "payment-methods" });
      if (pmConfigs?.length) {
        setPaymentMethods({ ...paymentMethods, ...pmConfigs[0].payload });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveAppConfig = async () => {
    setLoading(true);
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "app-main-settings" });
      if (configs?.length) {
        await base44.entities.AppSettings.update(configs[0].id, { payload: appConfig });
      } else {
        await base44.entities.AppSettings.create({
          slug: "app-main-settings",
          payload: appConfig,
          description: "Configuración principal"
        });
      }
      alert("✅ Configuración guardada");
    } catch (error) {
      alert("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "app-theme" });
      if (configs?.length) {
        await base44.entities.AppSettings.update(configs[0].id, { payload: { theme: newTheme } });
      } else {
        await base44.entities.AppSettings.create({
          slug: "app-theme",
          payload: { theme: newTheme },
          description: "Tema de la aplicación"
        });
      }
      alert(`✅ Tema ${newTheme === "light" ? "claro" : "oscuro"} aplicado`);
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      alert("Error al guardar tema");
    }
  };

  const savePaymentMethods = async () => {
    setLoading(true);
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "payment-methods" });
      if (configs?.length) {
        await base44.entities.AppSettings.update(configs[0].id, { payload: paymentMethods });
      } else {
        await base44.entities.AppSettings.create({
          slug: "payment-methods",
          payload: paymentMethods,
          description: "Métodos de pago"
        });
      }
      alert("✅ Métodos de pago actualizados");
    } catch (error) {
      alert("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const displayUser = currentUser || user; // ✅ USAR el usuario completo si está disponible

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-black/90 backdrop-blur-xl border-cyan-500/20 max-w-5xl max-h-[90vh] shadow-[0_24px_80px_rgba(0,168,232,0.7)] theme-light:bg-white theme-light:border-gray-200 theme-light:shadow-lg p-0 gap-0 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
              {/* Info Usuario */}
              <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-xl p-4 theme-light:from-purple-50 theme-light:to-pink-50 theme-light:border-purple-300">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-600 to-emerald-700 flex items-center justify-center shadow-lg">
                    <UserCircle className="w-10 h-10 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-lg theme-light:text-gray-900">{displayUser.full_name || displayUser.email}</p>
                    <p className="text-gray-400 text-sm theme-light:text-gray-600">{displayUser.email}</p>
                    <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-600/30 text-xs mt-1 theme-light:bg-cyan-100 theme-light:text-cyan-700">
                      {displayUser.role || "user"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Punch Status */}
              <div className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-gradient-to-br theme-light:from-cyan-50 theme-light:to-emerald-50 theme-light:border-cyan-300">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400 theme-light:text-cyan-600" />
                <span className="text-white font-medium theme-light:text-gray-900">Estado de Turno</span>
              </div>
              <Badge className={punchStatus 
                ? "bg-emerald-600/20 text-emerald-300 border-emerald-600/30 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300"
                : "bg-gray-600/20 text-gray-300 border-gray-600/30 theme-light:bg-gray-100 theme-light:text-gray-700 theme-light:border-gray-300"
              }>
                {punchStatus ? "Activo" : "Inactivo"}
              </Badge>
            </div>
            
            {punchStatus && (
              <p className="text-xs text-gray-400 mb-3 theme-light:text-gray-600">
                Entrada: {new Date(punchStatus.clock_in).toLocaleString()}
              </p>
            )}

            <Button
              onClick={handlePunchToggle}
              disabled={loading}
              className={`w-full ${
                punchStatus
                  ? "bg-gradient-to-r from-lime-600 to-lime-800 hover:from-lime-700 hover:to-lime-900"
                  : "bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900"
              }`}
            >
              {loading ? "..." : punchStatus ? "Cerrar Turno" : "Abrir Turno"}
            </Button>
          </div>



              {/* Logout Button */}
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full border-red-600/50 text-red-400 hover:bg-red-600/20 theme-light:border-red-300 theme-light:text-red-600 theme-light:hover:bg-red-50"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
