import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Building2, Globe, Palette, DollarSign, Bell, Shield, Database,
  Save, Loader2, Check, ChevronRight, Sparkles, Settings as SettingsIcon,
  Users, ClipboardList, Package, Receipt, Clock, Mail,
  Smartphone, FileText, CreditCard, Wallet, UserCircle, Plus, Edit2, Trash2,
  X, Eye, EyeOff, Wrench, CheckSquare, Camera, Key, Lock, Search,
  Fingerprint, ShieldCheck, ShieldAlert, History, Download, AlertCircle,
  Briefcase, ShoppingCart, BarChart3, TrendingDown, Activity, GripVertical,
  Layout, Grid, Zap, ExternalLink
} from "lucide-react";
import { useI18n } from "@/components/utils/i18n";
import ImportExportTab from "@/components/settings/ImportExportTab";
import WizardConfigPanel from "@/components/settings/WizardConfigPanel";
import DeviceCatalogManager from "@/components/settings/DeviceCatalogManager";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get("section");
    if (section) {
      setActiveSection(section);
    }
  }, []);

  // General config
  const [appConfig, setAppConfig] = useState({
    business_name: "911 SmartFix",
    slogan: "Tu taller de confianza",
    business_phone: "",
    business_whatsapp: "",
    business_email: "",
    business_address: "",
    hours_weekdays: "",
    tax_rate: 11.5,
    currency: "USD",
    timezone: "America/Puerto_Rico",
    language: "es",
    google_review_link: ""
  });

  const [theme, setTheme] = useState("dark");
  const [paymentMethods, setPaymentMethods] = useState({
    cash: true,
    card: true,
    ath_movil: true,
    bank_transfer: false,
    check: false
  });
  const [customPaymentMethods, setCustomPaymentMethods] = useState([]);
  const [newCustomMethod, setNewCustomMethod] = useState("");

  // =========================
  // 👇 NUEVO: Enlaces Útiles
  // =========================
  const [usefulLinks, setUsefulLinks] = useState([]); // 👈
  const [newUsefulLink, setNewUsefulLink] = useState({ name: "", url: "" }); // 👈
  
  // Dashboard Buttons Config
  const [dashboardButtons, setDashboardButtons] = useState([]);
  const [showCreateCustom, setShowCreateCustom] = useState(false);
  const [customButton, setCustomButton] = useState({
    label: "",
    icon: "ExternalLink",
    gradient: "from-cyan-600 to-blue-600",
    action: "",
    type: "navigate"
  });

  // Admin Panel Buttons Config
  const [adminPanelButtons, setAdminPanelButtons] = useState([]);
  const [showCreateAdminButton, setShowCreateAdminButton] = useState(false);
  const [customAdminButton, setCustomAdminButton] = useState({
    label: "",
    icon: "Shield",
    gradient: "from-cyan-600 to-blue-600",
    action: "",
    type: "navigate",
    view: ""
  });



  useEffect(() => {
    loadAllSettings();
  }, []);



  const loadAllSettings = async () => {
    try {
      const [configRes, themeRes, pmRes, linksRes, buttonsRes, adminButtonsRes] = await Promise.all([
        base44.entities.AppSettings.filter({ slug: "app-main-settings" }),
        base44.entities.AppSettings.filter({ slug: "app-theme" }),
        base44.entities.AppSettings.filter({ slug: "payment-methods" }),
        base44.entities.AppSettings.filter({ slug: "useful-links" }),
        base44.entities.AppSettings.filter({ slug: "dashboard-buttons" }),
        base44.entities.AppSettings.filter({ slug: "admin-panel-buttons" })
      ]);

      if (configRes?.length) {
        setAppConfig({ ...appConfig, ...configRes[0].payload });
      }
      if (themeRes?.length) {
        setTheme(themeRes[0].payload?.theme || "dark");
      }
      if (pmRes?.length) {
        const saved = pmRes[0].payload;
        setPaymentMethods({ ...paymentMethods, ...saved });
        setCustomPaymentMethods(saved.custom_methods || []);
      }

      // =========================
      // 👇 NUEVO: cargar enlaces
      // =========================
      if (linksRes?.length) {
        const payload = linksRes[0].payload;
        setUsefulLinks(Array.isArray(payload) ? payload : (payload?.links || []));
      }
      
      // Cargar botones del dashboard
      if (buttonsRes?.length) {
        const savedButtons = buttonsRes[0].payload?.buttons || [];
        setDashboardButtons(savedButtons);
      } else {
        // Primera vez: crear todos los botones
        const initialButtons = ALL_PAGE_BUTTONS.map((btn, idx) => ({
          ...btn,
          action: btn.page,
          type: "navigate",
          enabled: ["orders", "customers", "inventory", "pos"].includes(btn.id),
          order: idx
        }));
        setDashboardButtons(initialButtons);
      }

      // Cargar botones del panel administrativo
      if (adminButtonsRes?.length) {
        const savedAdminButtons = adminButtonsRes[0].payload?.buttons || [];
        setAdminPanelButtons(savedAdminButtons);
      } else {
        // Botones por defecto del panel administrativo
        const initialAdminButtons = [
          { id: "users", label: "Panel Administrativo", icon: "Shield", gradient: "from-cyan-600 to-blue-600", view: "users", enabled: true, order: 0 },
          { id: "time", label: "Control de Tiempo", icon: "Clock", gradient: "from-emerald-600 to-green-600", view: "time", enabled: true, order: 1 },
          { id: "business_info", label: "Info del Negocio", icon: "Building2", gradient: "from-orange-600 to-amber-600", view: "business_info", enabled: true, order: 2 },
          { id: "payment_methods", label: "Métodos de Pago", icon: "CreditCard", gradient: "from-green-600 to-emerald-600", view: "payment_methods", enabled: true, order: 3 },
          { id: "financial", label: "Finanzas", icon: "Wallet", gradient: "from-purple-600 to-violet-600", type: "navigate", action: "Financial", enabled: true, order: 4 },
          { id: "reports", label: "Reportes", icon: "BarChart3", gradient: "from-indigo-600 to-blue-600", type: "navigate", action: "Reports", enabled: true, order: 5 }
        ];
        setAdminPanelButtons(initialAdminButtons);
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
      
      if (appConfig.language !== language) {
        await setLanguage(appConfig.language);
        toast.success("✅ Idioma actualizado");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.success("✅ Configuración guardada");
      }
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    setLoading(true);
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
      toast.success(`✅ Tema ${newTheme === "light" ? "claro" : "oscuro"} aplicado`);
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast.error("Error al guardar tema");
    } finally {
      setLoading(false);
    }
  };

  const savePaymentMethods = async () => {
    setLoading(true);
    try {
      const payload = {
        ...paymentMethods,
        custom_methods: customPaymentMethods
      };
      const configs = await base44.entities.AppSettings.filter({ slug: "payment-methods" });
      if (configs?.length) {
        await base44.entities.AppSettings.update(configs[0].id, { payload });
      } else {
        await base44.entities.AppSettings.create({
          slug: "payment-methods",
          payload,
          description: "Métodos de pago"
        });
      }
      toast.success("✅ Métodos de pago actualizados");
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const addCustomMethod = () => {
    const name = newCustomMethod.trim();
    if (!name) {
      toast.error("Escribe el nombre del método");
      return;
    }
    if (customPaymentMethods.some(m => m.toLowerCase() === name.toLowerCase())) {
      toast.error("Este método ya existe");
      return;
    }
    setCustomPaymentMethods([...customPaymentMethods, name]);
    setNewCustomMethod("");
    toast.success(`✅ ${name} añadido`);
  };

  const removeCustomMethod = (index) => {
    setCustomPaymentMethods(customPaymentMethods.filter((_, i) => i !== index));
  };

  const saveWizardConfig = async () => {
    setLoading(true);
    try {
      if (wizardConfig?.id) {
        await base44.entities.WorkOrderWizardConfig.update(wizardConfig.id, wizardConfig);
      } else {
        await base44.entities.WorkOrderWizardConfig.create(wizardConfig);
      }
      toast.success("✅ Wizard configurado");
      loadWizardConfig();
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const saveEmailConfig = async () => {
    setLoading(true);
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "email-config" });
      if (configs?.length) {
        await base44.entities.AppSettings.update(configs[0].id, { payload: emailConfig });
      } else {
        await base44.entities.AppSettings.create({
          slug: "email-config",
          payload: emailConfig,
          description: "Configuración de email"
        });
      }
      toast.success("✅ Configuración de email guardada");
    } catch (error) {
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async () => {
    if (!editingUser.full_name || !editingUser.email || !editingUser.pin || !editingUser.employee_code || !editingUser.phone || !editingUser.position) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }
    if (editingUser.pin.length !== 4 || !/^\d{4}$/.test(editingUser.pin)) {
      toast.error("PIN debe ser 4 dígitos");
      return;
    }

    setLoading(true);
    try {
      if (editingUser.id) {
        await base44.entities.AppEmployee.update(editingUser.id, editingUser);
        toast.success("✅ Empleado actualizado");
      } else {
        await base44.entities.AppEmployee.create(editingUser);
        toast.success("✅ Empleado creado");
      }
      setEditingUser(null);
      loadUsers();
    } catch (error) {
      toast.error("Error al guardar empleado");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.role === "admin") {
      const adminCount = users.filter((u) => u.role === "admin" && u.id !== user.id).length;
      if (adminCount === 0) {
        toast.error("❌ No puedes eliminar el último admin");
        return;
      }
    }

    if (!confirm(`¿Eliminar a "${user.full_name}"?`)) return;

    setLoading(true);
    try {
      await base44.entities.AppEmployee.delete(user.id);
      toast.success("✅ Empleado eliminado");
      loadUsers();
    } catch (error) {
      toast.error("Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // 👇 NUEVO: helpers enlaces
  // =========================
  const addUsefulLink = () => { // 👈
    const name = (newUsefulLink?.name || "").trim(); // 👈
    const url = (newUsefulLink?.url || "").trim(); // 👈
    if (!name || !url) { // 👈
      toast.error("Completa nombre y URL"); // 👈
      return; // 👈
    } // 👈
    setUsefulLinks([...usefulLinks, { name, url }]); // 👈
    setNewUsefulLink({ name: "", url: "" }); // 👈
    toast.success("✅ Enlace añadido"); // 👈
  }; // 👈

  const removeUsefulLink = (index) => { // 👈
    setUsefulLinks(usefulLinks.filter((_, i) => i !== index)); // 👈
  }; // 👈

  const updateUsefulLink = (index, patch) => { // 👈
    setUsefulLinks(usefulLinks.map((l, i) => i === index ? { ...l, ...patch } : l)); // 👈
  }; // 👈

  const saveUsefulLinks = async () => {
    setLoading(true);
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "useful-links" });
      const payload = { links: usefulLinks };
      if (configs?.length) {
        await base44.entities.AppSettings.update(configs[0].id, { payload });
      } else {
        await base44.entities.AppSettings.create({
          slug: "useful-links",
          payload,
          description: "Enlaces útiles"
        });
      }
      toast.success("✅ Enlaces guardados");
    } catch (error) {
      console.error("Error saving links:", error);
      toast.error("Error al guardar enlaces");
    } finally {
      setLoading(false);
    }
  };

  // Dashboard Buttons Helpers
  const ICON_OPTIONS = [
    { value: "Shield", label: "Escudo", component: Shield },
    { value: "Clock", label: "Reloj", component: Clock },
    { value: "Building2", label: "Edificio", component: Building2 },
    { value: "CreditCard", label: "Tarjeta", component: CreditCard },
    { value: "ClipboardList", label: "Clipboard", component: ClipboardList },
    { value: "Wrench", label: "Herramienta", component: Wrench },
    { value: "Smartphone", label: "Teléfono", component: Smartphone },
    { value: "Zap", label: "Rayo", component: Zap },
    { value: "Package", label: "Paquete", component: Package },
    { value: "Wallet", label: "Billetera", component: Wallet },
    { value: "BarChart3", label: "Gráfica", component: BarChart3 },
    { value: "ExternalLink", label: "Enlace", component: ExternalLink },
    { value: "Users", label: "Usuarios", component: Users },
    { value: "FileText", label: "Archivo", component: FileText },
    { value: "ShoppingCart", label: "Carrito", component: ShoppingCart }
  ];

  const GRADIENT_OPTIONS = [
    { value: "from-purple-500 to-pink-600", label: "Morado-Rosa" },
    { value: "from-orange-500 to-red-600", label: "Naranja-Rojo" },
    { value: "from-indigo-500 to-purple-600", label: "Índigo-Morado" },
    { value: "from-amber-500 to-yellow-600", label: "Ámbar-Amarillo" },
    { value: "from-teal-500 to-cyan-600", label: "Verde-Cian" },
    { value: "from-green-600 to-emerald-700", label: "Verde-Esmeralda" },
    { value: "from-blue-600 to-indigo-700", label: "Azul-Índigo" },
    { value: "from-cyan-600 to-blue-600", label: "Cian-Azul" }
  ];

  // Botones automáticos para todas las páginas del sistema
  const ALL_PAGE_BUTTONS = [
    { id: "orders", label: "Órdenes", icon: "ClipboardList", gradient: "from-purple-500 to-pink-600", page: "Orders" },
    { id: "customers", label: "Clientes", icon: "Users", gradient: "from-blue-600 to-indigo-700", page: "Customers" },
    { id: "inventory", label: "Inventario", icon: "Package", gradient: "from-teal-500 to-cyan-600", page: "Inventory" },
    { id: "pos", label: "POS", icon: "ShoppingCart", gradient: "from-green-600 to-emerald-700", page: "POS" },
    { id: "financial", label: "Finanzas", icon: "Wallet", gradient: "from-emerald-600 to-green-700", page: "Financial" },
    { id: "reports", label: "Reportes", icon: "BarChart3", gradient: "from-blue-600 to-indigo-700", page: "Reports" },
    { id: "financial_reports", label: "Reportes Financieros", icon: "BarChart3", gradient: "from-purple-600 to-indigo-700", page: "FinancialReports" },
    { id: "recharges", label: "Recargas", icon: "Zap", gradient: "from-amber-500 to-yellow-600", page: "Recharges" },
    { id: "notifications", label: "Notificaciones", icon: "Bell", gradient: "from-orange-500 to-red-600", page: "Notifications" },
    { id: "technicians", label: "Técnicos", icon: "Wrench", gradient: "from-cyan-500 to-blue-600", page: "Technicians" },
    { id: "settings", label: "Configuración", icon: "SettingsIcon", gradient: "from-cyan-600 to-blue-600", page: "Settings" },
    { id: "users", label: "Panel Administrativo", icon: "Users", gradient: "from-pink-500 to-rose-600", page: "UsersManagement" }
  ];

  const loadDashboardButtons = async () => {
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "dashboard-buttons" });
      
      if (configs?.length > 0) {
        const savedButtons = configs[0].payload?.buttons || [];
        setDashboardButtons(savedButtons);
      } else {
        // Primera vez: crear todos los botones con algunos habilitados por defecto
        const initialButtons = ALL_PAGE_BUTTONS.map((btn, idx) => ({
          ...btn,
          action: btn.page,
          type: "navigate",
          enabled: ["orders", "customers", "inventory", "pos"].includes(btn.id),
          order: idx
        }));
        setDashboardButtons(initialButtons);
      }
    } catch (error) {
      console.error("Error loading dashboard buttons:", error);
      const initialButtons = ALL_PAGE_BUTTONS.map((btn, idx) => ({
        ...btn,
        action: btn.page,
        type: "navigate",
        enabled: ["orders", "customers", "inventory", "pos"].includes(btn.id),
        order: idx
      }));
      setDashboardButtons(initialButtons);
    }
  };

  const handleToggleButton = (buttonId) => {
    setDashboardButtons(dashboardButtons.map(btn => 
      btn.id === buttonId ? { ...btn, enabled: !btn.enabled } : btn
    ));
  };

  const handleDeleteButton = (buttonId) => {
    if (confirm("¿Eliminar este botón del dashboard?")) {
      setDashboardButtons(dashboardButtons.filter(btn => btn.id !== buttonId));
      toast.success("✅ Botón eliminado");
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(dashboardButtons);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedButtons = items.map((btn, idx) => ({
      ...btn,
      order: idx
    }));

    setDashboardButtons(updatedButtons);
  };

  const saveDashboardButtons = async () => {
    setLoading(true);
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "dashboard-buttons" });
      
      const payload = {
        buttons: dashboardButtons.map(btn => ({
          id: btn.id,
          label: btn.label,
          icon: btn.icon,
          gradient: btn.gradient,
          action: btn.action || btn.page,
          type: btn.type || "navigate",
          page: btn.page,
          enabled: btn.enabled,
          order: btn.order
        }))
      };

      if (configs?.length) {
        await base44.entities.AppSettings.update(configs[0].id, { payload });
      } else {
        await base44.entities.AppSettings.create({
          slug: "dashboard-buttons",
          payload
        });
      }

      toast.success("✅ Configuración guardada");
      window.dispatchEvent(new CustomEvent('dashboard-buttons-updated'));
    } catch (error) {
      console.error("Error saving dashboard buttons:", error);
      toast.error("Error al guardar configuración");
    } finally {
      setLoading(false);
    }
  };

  const saveAdminPanelButtons = async () => {
    setLoading(true);
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "admin-panel-buttons" });
      
      const payload = {
        buttons: adminPanelButtons.map(btn => ({
          id: btn.id,
          label: btn.label,
          icon: btn.icon,
          gradient: btn.gradient,
          view: btn.view,
          action: btn.action,
          type: btn.type || "view",
          enabled: btn.enabled,
          order: btn.order
        }))
      };

      if (configs?.length) {
        await base44.entities.AppSettings.update(configs[0].id, { payload });
      } else {
        await base44.entities.AppSettings.create({
          slug: "admin-panel-buttons",
          payload
        });
      }

      toast.success("✅ Panel Administrativo configurado");
      window.dispatchEvent(new CustomEvent('admin-panel-buttons-updated'));
    } catch (error) {
      console.error("Error saving admin panel buttons:", error);
      toast.error("Error al guardar configuración");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdminButton = (buttonId) => {
    setAdminPanelButtons(adminPanelButtons.map(btn => 
      btn.id === buttonId ? { ...btn, enabled: !btn.enabled } : btn
    ));
  };

  const handleDeleteAdminButton = (buttonId) => {
    if (confirm("¿Eliminar este botón del Panel Administrativo?")) {
      setAdminPanelButtons(adminPanelButtons.filter(btn => btn.id !== buttonId));
      toast.success("✅ Botón eliminado");
    }
  };

  const handleDragEndAdmin = (result) => {
    if (!result.destination) return;

    const items = Array.from(adminPanelButtons);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedButtons = items.map((btn, idx) => ({
      ...btn,
      order: idx
    }));

    setAdminPanelButtons(updatedButtons);
  };

  const addCustomAdminButton = () => {
    if (!customAdminButton.label) {
      toast.error("El nombre del botón es obligatorio");
      return;
    }

    const newButton = {
      id: `custom_${Date.now()}`,
      label: customAdminButton.label,
      icon: customAdminButton.icon,
      gradient: customAdminButton.gradient,
      type: customAdminButton.type,
      view: customAdminButton.type === "view" ? customAdminButton.view : undefined,
      action: customAdminButton.type === "navigate" ? customAdminButton.action : customAdminButton.type === "external" ? customAdminButton.action : undefined,
      enabled: true,
      order: adminPanelButtons.length
    };

    setAdminPanelButtons([...adminPanelButtons, newButton]);
    setCustomAdminButton({ label: "", icon: "Shield", gradient: "from-cyan-600 to-blue-600", action: "", type: "navigate", view: "" });
    setShowCreateAdminButton(false);
    toast.success("✅ Botón personalizado creado");
  };

  const sections = [
    {
      id: "admin_panel",
      icon: Shield,
      title: "Panel Administrativo",
      description: "Empleados y permisos",
      color: "from-orange-600 to-amber-600",
      shadowColor: "rgba(251,146,60,0.4)",
      isNavigation: true,
      navigateTo: "UsersManagement"
    },
    {
      id: "regional",
      icon: Globe,
      title: "Regional y Fiscal",
      description: "Idioma, moneda, impuestos",
      color: "from-blue-600 to-indigo-600",
      shadowColor: "rgba(59,130,246,0.4)"
    },
    {
      id: "appearance",
      icon: Palette,
      title: "Apariencia",
      description: "Tema visual del sistema",
      color: "from-purple-600 to-pink-600",
      shadowColor: "rgba(168,85,247,0.4)"
    },
    {
      id: "wizard",
      icon: ClipboardList,
      title: "Wizard de Órdenes",
      description: "Configurar nueva orden",
      color: "from-violet-600 to-purple-600",
      shadowColor: "rgba(139,92,246,0.4)"
    },
    {
      id: "dashboard_buttons",
      icon: Sparkles,
      title: "Configurar Dashboard",
      description: "Personalizar botones principales",
      color: "from-purple-600 to-pink-600",
      shadowColor: "rgba(168,85,247,0.4)"
    },
    {
      id: "inventory",
      icon: Package,
      title: "Inventario",
      description: "Gestión de productos y stock",
      color: "from-teal-500 to-cyan-600",
      shadowColor: "rgba(20,184,166,0.4)",
      isNavigation: true,
      navigateTo: "Inventory"
    }
  ];



  if (activeSection) {
    const section = sections.find(s => s.id === activeSection);
    const Icon = section?.icon || SettingsIcon;

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] theme-light:bg-gray-50 p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 mb-6 shadow-[0_8px_32px_rgba(0,168,232,0.3)] theme-light:bg-white theme-light:border-gray-200">
            <Button
              onClick={() => setActiveSection(null)}
              variant="ghost"
              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/10 mb-4 theme-light:text-cyan-600"
            >
              <ChevronRight className="w-5 h-5 mr-2 rotate-180" />
              Volver a Settings
            </Button>
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center shadow-lg`}>
                <Icon className="w-9 h-9 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white theme-light:text-gray-900">{section.title}</h1>
                <p className="text-cyan-200/80 theme-light:text-gray-600">{section.description}</p>
              </div>
            </div>
          </div>

          {/* REGIONAL */}
          {activeSection === "regional" && (
            <div className="space-y-4">
              <Card className="bg-black/40 border border-cyan-500/20 p-6 theme-light:bg-white theme-light:border-gray-200">
                <div className="space-y-4">
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Idioma del Sistema</label>
                    <select value={appConfig.language} onChange={(e) => setAppConfig({...appConfig, language: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white h-12 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900">
                      <option value="es">🇪🇸 Español</option>
                      <option value="en">🇺🇸 English</option>
                      <option value="zh">🇨🇳 中文</option>
                      <option value="de">🇩🇪 Deutsch</option>
                      <option value="fr">🇫🇷 Français</option>
                    </select>
                    <p className="text-xs text-amber-400 mt-2 theme-light:text-amber-600">⚠️ El sistema se recargará para aplicar el nuevo idioma</p>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">IVU / Impuesto (%)</label>
                    <Input type="number" step="0.1" value={appConfig.tax_rate} onChange={(e) => setAppConfig({...appConfig, tax_rate: parseFloat(e.target.value)})} className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" />
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Moneda</label>
                    <select value={appConfig.currency} onChange={(e) => setAppConfig({...appConfig, currency: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white h-12 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900">
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="MXN">MXN ($)</option>
                      <option value="CNY">CNY (¥)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Zona Horaria</label>
                    <select value={appConfig.timezone} onChange={(e) => setAppConfig({...appConfig, timezone: e.target.value})} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white h-12 theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900">
                      <option value="America/Puerto_Rico">Puerto Rico (AST)</option>
                      <option value="America/New_York">New York (EST/EDT)</option>
                      <option value="America/Los_Angeles">Los Angeles (PST/PDT)</option>
                      <option value="America/Chicago">Chicago (CST/CDT)</option>
                      <option value="America/Mexico_City">Mexico City (CST)</option>
                      <option value="Europe/Madrid">Madrid (CET)</option>
                      <option value="Europe/London">London (GMT)</option>
                      <option value="Asia/Shanghai">Shanghai (CST)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                    </select>
                  </div>
                </div>
              </Card>
              <Button onClick={saveAppConfig} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 h-14 text-lg font-bold shadow-lg">
                {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Guardando...</> : <><Save className="w-5 h-5 mr-2" />Guardar Cambios</>}
              </Button>
            </div>
          )}

          {/* APPEARANCE */}
          {activeSection === "appearance" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => handleThemeChange("dark")} disabled={loading} className={`group relative overflow-hidden p-8 rounded-2xl border-2 transition-all ${theme === "dark" ? "bg-gradient-to-br from-slate-900 to-black border-purple-500 shadow-[0_12px_40px_rgba(168,85,247,0.4)]" : "bg-black/20 border-white/10 hover:border-white/20"}`}>
                  <div className="text-center">
                    <div className="text-6xl mb-4">🌙</div>
                    <h3 className="text-white font-bold text-xl mb-2">Tema Oscuro</h3>
                    <p className="text-gray-400 text-sm">Fondo oscuro profesional</p>
                    {theme === "dark" && <div className="mt-4"><Badge className="bg-purple-600/30 text-purple-200 border-purple-500/50">✓ Activo</Badge></div>}
                  </div>
                </button>
                <button onClick={() => handleThemeChange("light")} disabled={loading} className={`group relative overflow-hidden p-8 rounded-2xl border-2 transition-all ${theme === "light" ? "bg-gradient-to-br from-white to-gray-100 border-purple-500 shadow-[0_12px_40px_rgba(168,85,247,0.4)]" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
                  <div className="text-center">
                    <div className="text-6xl mb-4">☀️</div>
                    <h3 className={`font-bold text-xl mb-2 ${theme === "light" ? "text-gray-900" : "text-white"}`}>Tema Claro</h3>
                    <p className={`text-sm ${theme === "light" ? "text-gray-600" : "text-gray-400"}`}>Fondo claro minimalista</p>
                    {theme === "light" && <div className="mt-4"><Badge className="bg-purple-600/30 text-purple-700 border-purple-500/50">✓ Activo</Badge></div>}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* WIZARD */}
          {activeSection === "wizard" && <WizardConfigPanel />}



          {/* DASHBOARD BUTTONS */}
          {activeSection === "dashboard_buttons" && (
            <div className="space-y-4">
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-4 mb-4 theme-light:bg-cyan-50 theme-light:border-cyan-300">
                <div className="flex items-start gap-3">
                  <Grid className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-semibold mb-1 theme-light:text-gray-900">Gestiona tus Botones</p>
                    <p className="text-cyan-300/70 text-sm theme-light:text-gray-600">
                      Arrastra para reordenar • Activa/Desactiva según necesites • Crea botones personalizados
                    </p>
                  </div>
                </div>
              </div>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="buttons">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3"
                    >
                      {dashboardButtons.map((button, index) => {
                        const IconComponent = typeof button.icon === 'string' 
                          ? ICON_OPTIONS.find(i => i.value === button.icon)?.component || ExternalLink
                          : button.icon;
                        
                        return (
                          <Draggable key={button.id} draggableId={button.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={`relative overflow-hidden rounded-2xl border transition-all theme-light:bg-white ${
                                  snapshot.isDragging
                                    ? "border-cyan-500 shadow-[0_0_40px_rgba(6,182,212,0.4)] scale-105"
                                    : button.enabled
                                    ? "border-cyan-500/30 bg-slate-800/40 hover:border-cyan-500/50"
                                    : "border-slate-700/30 bg-slate-900/40 opacity-60"
                                }`}
                              >
                                <div className="flex items-center gap-4 p-4">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="cursor-grab active:cursor-grabbing"
                                  >
                                    <GripVertical className="w-5 h-5 text-slate-500" />
                                  </div>

                                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${button.gradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
                                    <IconComponent className="w-6 h-6 text-white" />
                                  </div>

                                  <div className="flex-1">
                                    <p className="text-white font-bold theme-light:text-gray-900">{button.label}</p>
                                    <p className="text-slate-400 text-xs mt-0.5 theme-light:text-gray-600">
                                      {button.page || button.action} • Orden: {index + 1}
                                    </p>
                                  </div>

                                  <Button
                                    onClick={() => handleDeleteButton(button.id)}
                                    variant="ghost"
                                    size="icon"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-600/20"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>

                                  <button
                                    onClick={() => handleToggleButton(button.id)}
                                    className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
                                      button.enabled
                                        ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-lg"
                                        : "bg-slate-700/50 text-slate-400 border border-slate-600"
                                    }`}
                                  >
                                    {button.enabled ? (
                                      <>
                                        <Eye className="w-4 h-4" />
                                        Activo
                                      </>
                                    ) : (
                                      <>
                                        <EyeOff className="w-4 h-4" />
                                        Inactivo
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <Button
                onClick={() => setShowCreateCustom(true)}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 h-12"
              >
                <Plus className="w-5 h-5 mr-2" />
                Crear Botón Personalizado
              </Button>

              {showCreateCustom && (
                <Card className="bg-black/60 border border-cyan-500/30 p-6 theme-light:bg-white">
                  <h3 className="text-white font-bold mb-4 theme-light:text-gray-900">Nuevo Botón Personalizado</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Nombre del Botón *</label>
                      <Input
                        value={customButton.label}
                        onChange={(e) => setCustomButton({...customButton, label: e.target.value})}
                        placeholder="Ej: Configuración Avanzada"
                        className="bg-black/40 border-white/10 text-white theme-light:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Tipo de Acción</label>
                      <select
                        value={customButton.type}
                        onChange={(e) => setCustomButton({...customButton, type: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white theme-light:bg-white theme-light:text-gray-900"
                      >
                        <option value="navigate">Navegar a Página</option>
                        <option value="external">Enlace Externo</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">
                        {customButton.type === "navigate" ? "Página" : "URL"} *
                      </label>
                      <Input
                        value={customButton.action}
                        onChange={(e) => setCustomButton({...customButton, action: e.target.value})}
                        placeholder={customButton.type === "navigate" ? "Ej: Settings" : "https://..."}
                        className="bg-black/40 border-white/10 text-white theme-light:bg-white"
                      />
                    </div>

                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Icono</label>
                      <select
                        value={customButton.icon}
                        onChange={(e) => setCustomButton({...customButton, icon: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white theme-light:bg-white theme-light:text-gray-900"
                      >
                        {ICON_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Gradiente</label>
                      <select
                        value={customButton.gradient}
                        onChange={(e) => setCustomButton({...customButton, gradient: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white theme-light:bg-white theme-light:text-gray-900"
                      >
                        {GRADIENT_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        onClick={() => setShowCreateCustom(false)}
                        variant="outline"
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => {
                          if (!customButton.label || !customButton.action) {
                            toast.error("Completa nombre y acción");
                            return;
                          }
                          
                          const newButton = {
                            id: `custom_${Date.now()}`,
                            label: customButton.label,
                            icon: customButton.icon,
                            gradient: customButton.gradient,
                            type: customButton.type,
                            action: customButton.action,
                            enabled: true,
                            order: dashboardButtons.length
                          };

                          setDashboardButtons([...dashboardButtons, newButton]);
                          setCustomButton({ label: "", icon: "ExternalLink", gradient: "from-cyan-600 to-blue-600", action: "", type: "navigate" });
                          setShowCreateCustom(false);
                          toast.success("✅ Botón personalizado creado");
                        }}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600"
                      >
                        Crear Botón
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              <Button 
                onClick={saveDashboardButtons} 
                disabled={loading} 
                className="w-full bg-gradient-to-r from-cyan-500 to-emerald-600 hover:from-cyan-600 hover:to-emerald-700 h-14 text-lg font-bold shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            </div>
          )}




        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] theme-light:bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Hero Header */}
        <div className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-8 mb-8 shadow-[0_12px_48px_rgba(0,168,232,0.4)] theme-light:bg-white theme-light:border-gray-200">
          <div className="flex items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-emerald-500 blur-3xl opacity-30 animate-pulse" />
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center shadow-2xl shadow-cyan-600/50">
                <SettingsIcon className="w-14 h-14 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-3 theme-light:text-gray-900">
                Config
              </h1>
              <p className="text-cyan-200/80 text-lg theme-light:text-gray-600">
                Personaliza y configura tu sistema SmartFixOS
              </p>
            </div>
          </div>
        </div>

        {/* Settings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => {
                  if (section.isNavigation) {
                    navigate(createPageUrl(section.navigateTo));
                  } else {
                    setActiveSection(section.id);
                  }
                }}
                className="group relative overflow-hidden bg-black/40 backdrop-blur-xl border border-white/10 hover:border-cyan-500/50 rounded-2xl p-6 transition-all hover:scale-105 active:scale-95 theme-light:bg-white theme-light:border-gray-200 theme-light:hover:border-cyan-500/50 hover:shadow-[0_16px_48px_rgba(0,168,232,0.3)]"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-emerald-500/0 group-hover:from-cyan-500/10 group-hover:to-emerald-500/10 transition-all duration-500" />
                
                <div className="relative">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${section.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon className="w-9 h-9 text-white" />
                  </div>
                  
                  <h3 className="text-white font-bold text-xl mb-2 theme-light:text-gray-900">
                    {section.title}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4 theme-light:text-gray-600">
                    {section.description}
                  </p>
                  
                  <div className="flex items-center gap-2 text-cyan-400 text-sm font-medium group-hover:gap-4 transition-all theme-light:text-cyan-600">
                    <span>Configurar</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="mt-8 bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/20 rounded-2xl p-6 theme-light:bg-blue-50 theme-light:border-blue-300">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 flex items-center justify-center flex-shrink-0 theme-light:bg-blue-200">
              <Sparkles className="w-6 h-6 text-blue-400 theme-light:text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-white font-bold mb-2 theme-light:text-gray-900">💡 Configuración Inteligente</h4>
              <p className="text-blue-200/80 text-sm theme-light:text-gray-700">
                Todos los cambios se aplican inmediatamente en todo el sistema. El cambio de idioma recargará la aplicación para actualizar todas las traducciones.
              </p>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
