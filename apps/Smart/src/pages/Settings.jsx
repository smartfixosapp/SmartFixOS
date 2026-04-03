import React, { useState, useEffect } from "react";
import { supabase } from "../../../../lib/supabase-client.js";
import FeedbackModal from "@/components/settings/FeedbackModal";
import UserSessionSettings from "@/components/settings/UserSessionSettings";
import UpdatesManager from "@/components/settings/UpdatesManager";
import { dataClient } from "@/components/api/dataClient";
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
  BarChart3, ExternalLink, ChevronDown, Upload, MessageSquarePlus, Bot
} from "lucide-react";
import { useI18n } from "@/components/utils/i18n";
import ImportExportTab from "@/components/settings/ImportExportTab";
import WizardConfigPanel from "@/components/settings/WizardConfigPanel";
import DeviceCatalogManager from "@/components/settings/DeviceCatalogManager";
import { WarrantySalesModal, WarrantyRepairsModal } from "@/components/settings/WarrantyConfigModals";
import EmailTemplatesTab from "@/components/settings/tabs/EmailTemplatesTab";
import POSReceiptTab from "@/components/settings/tabs/POSReceiptTab";
import ShiftTasksManager from "@/components/settings/ShiftTasksManager";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

// Clave por-dispositivo — debe coincidir exactamente con PinAccess.jsx
function getBiometricKey() {
  let deviceId = localStorage.getItem("smartfix_device_id");
  if (!deviceId) {
    deviceId = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 16);
    localStorage.setItem("smartfix_device_id", deviceId);
  }
  return `smartfix_biometric_${deviceId}`;
}
const BIOMETRIC_LOGIN_KEY = getBiometricKey();

export default function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection]   = useState(null);
  const [showPriceWidget, setShowPriceWidget] = useState(() => localStorage.getItem("smartfix_show_price_widget") !== "false");
  const [jenaiEnabled, setJenaiEnabled] = useState(() => localStorage.getItem("smartfix_jenai_disabled") !== "true");
  const [showFeedback,  setShowFeedback]    = useState(false);

  // ── Sesión del usuario actual ──────────────────────────────────────────
  const currentSession = (() => {
    try {
      const raw = sessionStorage.getItem("911-session") || localStorage.getItem("employee_session");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const currentUserRole = currentSession?.role || currentSession?.userRole || "";
  const currentUserEmail = currentSession?.email || currentSession?.userEmail || "";
  const isAdmin = currentUserRole === "admin";
  const isSuperAdmin = currentUserEmail === "smartfixosapp@gmail.com" || currentUserEmail === "911smartfix@gmail.com";

  // Biometric state (mobile only)
  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || !!window.Capacitor;
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricProfile, setBiometricProfile] = useState(null);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const loadBiometricProfile = () => {
    try { return JSON.parse(localStorage.getItem(BIOMETRIC_LOGIN_KEY) || "null"); } catch { return null; }
  };
  const saveBiometricProfile = (profile) => {
    try { localStorage.setItem(BIOMETRIC_LOGIN_KEY, JSON.stringify(profile)); } catch {}
    setBiometricProfile(profile);
  };
  const clearBiometricProfile = () => {
    localStorage.removeItem(BIOMETRIC_LOGIN_KEY);
    setBiometricProfile(null);
  };

  useEffect(() => {
    const checkBiometrics = async () => {
      setBiometricProfile(loadBiometricProfile());
      
      const { Capacitor } = await import('@capacitor/core');
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        try {
          const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
          const result = await NativeBiometric.isAvailable();
          setBiometricSupported(result.isAvailable);
        } catch (err) {
          console.error("Biometric detection failed:", err);
          setBiometricSupported(false);
        }
      } else {
        // Desktop/browser — intentar WebAuthn (Mac Touch ID, Windows Hello, etc.)
        try {
          if (window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
            const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            setBiometricSupported(available);
          } else if (window.PublicKeyCredential) {
            // API disponible pero sin isUserVerifyingPlatformAuthenticatorAvailable (navegadores viejos)
            // En Mac, asumir que hay Touch ID si hay hardware
            const isMac = /Mac/.test(navigator.platform || navigator.userAgent) && !/iPhone|iPad|iPod/.test(navigator.userAgent);
            setBiometricSupported(isMac);
          }
        } catch (err) {
          console.warn("WebAuthn check failed:", err);
          // En Mac, si el check falla aún intentamos mostrar la opción
          const isMac = /Mac/.test(navigator.platform || navigator.userAgent) && !/iPhone|iPad|iPod/.test(navigator.userAgent);
          setBiometricSupported(isMac);
        }
      }
    };

    checkBiometrics().catch(console.warn);
  }, []);

  const handleEnableBiometric = async () => {
    const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
    if (!raw) { toast.error("Inicia sesión primero"); return; }
    const sessionData = JSON.parse(raw);
    
    setBiometricLoading(true);
    try {
      const { Capacitor } = await import('@capacitor/core');
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        const { NativeBiometric } = await import('@capgo/capacitor-native-biometric');
        // Simple verification to confirm identity before saving
        await NativeBiometric.verifyIdentity({
          reason: "Confirma tu identidad para activar el acceso rápido",
          title: "Activar Face ID / Huella",
          subtitle: "Usa tu biometría para guardar el perfil",
          description: "Esto te permitirá entrar sin PIN la próxima vez."
        });
        
        // Save the profile info (session) - same structure as PinAccess expects
        // credentialId es REQUERIDO por PinAccess.loadBiometricProfile()
        saveBiometricProfile({
          credentialId: "native_stored",
          isNative: true,
          userId: sessionData.id || sessionData.userId,
          tenantId: sessionData.tenant_id || null,
          session: sessionData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          deviceKey: navigator.userAgent.slice(0, 120),
        });
        toast.success("✅ Face ID / Huella activada correctamente");
      } else {
        // Fallback for Web (WebAuthn)
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);
        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: { name: "SmartFixOS", id: window.location.hostname },
            user: { id: new TextEncoder().encode(sessionData.id || sessionData.userId), name: sessionData.email || sessionData.userName, displayName: sessionData.full_name || sessionData.userName },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
            timeout: 60000,
          },
        });
        if (!credential?.rawId) throw new Error("No se pudo crear la credencial");
        const toB64 = (buf) => { const b = new Uint8Array(buf); let s = ""; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
        saveBiometricProfile({ credentialId: toB64(credential.rawId), userId: sessionData.id || sessionData.userId, tenantId: sessionData.tenant_id || null, session: sessionData, createdAt: new Date().toISOString() });
        toast.success("✅ Biometría activada (Web)");
      }
    } catch (err) {
      if (err?.name !== "NotAllowedError") toast.error("Error: " + (err?.message || "No se pudo activar"));
    } finally {
      setBiometricLoading(false);
    }
  };

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
    business_maps_link: "",
    business_hours: {
      monday: { open: "09:00", close: "18:00", closed: false },
      tuesday: { open: "09:00", close: "18:00", closed: false },
      wednesday: { open: "09:00", close: "18:00", closed: false },
      thursday: { open: "09:00", close: "18:00", closed: false },
      friday: { open: "09:00", close: "18:00", closed: false },
      saturday: { open: "09:00", close: "14:00", closed: false },
      sunday: { open: "09:00", close: "18:00", closed: true }
    },
    tax_rate: 11.5,
    currency: "USD",
    timezone: "America/Puerto_Rico",
    language: "es",
    google_review_link: "",
    facebook_url: "",
    instagram_url: "",
    custom_social_url: "",
  });

  // Business branding config
  const [businessBranding, setBusinessBranding] = useState({
    logo_url: "",
    store_name: "",
    terms_sales: "",
    terms_workorders: "",
    warranty_repairs: "",
    warranty_sales: "",
    conditions_text: "",
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [showWarrantySalesModal, setShowWarrantySalesModal] = useState(false);
  const [showWarrantyRepairsModal, setShowWarrantyRepairsModal] = useState(false);

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
      const [configRes, themeRes, pmRes, linksRes, adminButtonsRes, brandingRes] = await Promise.all([
        dataClient.entities.AppSettings.filter({ slug: "app-main-settings" }).catch(() => []),
        dataClient.entities.AppSettings.filter({ slug: "app-theme" }).catch(() => []),
        dataClient.entities.AppSettings.filter({ slug: "payment-methods" }).catch(() => []),
        dataClient.entities.AppSettings.filter({ slug: "useful-links" }).catch(() => []),
        dataClient.entities.AppSettings.filter({ slug: "admin-panel-buttons" }).catch(() => []),
        dataClient.entities.AppSettings.filter({ slug: "business-branding" }).catch(() => [])
      ]);

      if (configRes?.length) {
         const loaded = configRes[0].payload;
         setAppConfig({
           ...appConfig,
           ...loaded,
           business_hours: loaded.business_hours || appConfig.business_hours
         });
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

      // Cargar botones del panel administrativo
      if (adminButtonsRes?.length) {
        const savedAdminButtons = adminButtonsRes[0].payload?.buttons || [];
        setAdminPanelButtons(savedAdminButtons);
      } else {
        // Botones por defecto del panel administrativo
           const initialAdminButtons = [
             { id: "users", label: "Panel Administrativo", icon: "Shield", gradient: "from-cyan-600 to-blue-600", view: "users", enabled: true, order: 0 },
             { id: "time", label: "Control de Tiempo", icon: "Clock", gradient: "from-emerald-600 to-green-600", view: "time", enabled: true, order: 1 },
             { id: "payment_methods", label: "Métodos de Pago", icon: "CreditCard", gradient: "from-green-600 to-emerald-600", view: "payment_methods", enabled: true, order: 2 },
             { id: "business_info", label: "Info del Negocio", icon: "Building2", gradient: "from-orange-600 to-amber-600", view: "business_info", enabled: true, order: 3 },
             { id: "financial", label: "Finanzas", icon: "Wallet", gradient: "from-purple-600 to-violet-600", type: "navigate", action: "Financial", enabled: true, order: 4 }
        ];
        setAdminPanelButtons(initialAdminButtons);
      }

      // Cargar branding
      if (brandingRes?.length) {
        setBusinessBranding({ ...businessBranding, ...brandingRes[0].payload });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };



  const saveAppConfig = async () => {
    setLoading(true);
    try {
      // 1. Guardar en app_settings (fuente principal)
      const configs = await dataClient.entities.AppSettings.filter({ slug: "app-main-settings" });
      if (configs?.length) {
        await dataClient.entities.AppSettings.update(configs[0].id, { payload: appConfig });
      } else {
        await dataClient.entities.AppSettings.create({
          slug: "app-main-settings",
          payload: appConfig,
          description: "Configuración principal"
        });
      }

      // 2. Sincronizar en system_config (lo que lee el Dashboard para el nombre del negocio)
      const tenantId = localStorage.getItem("smartfix_tenant_id") || localStorage.getItem("current_tenant_id");
      if (tenantId) {
        const branding = {
          business_name: appConfig.business_name,
          slogan:        appConfig.slogan,
          phone:         appConfig.business_phone,
          whatsapp:      appConfig.business_whatsapp,
          email:         appConfig.business_email,
          address:       appConfig.business_address,
          logo_url:      businessBranding.logo_url || "",
          timezone:      appConfig.timezone,
          tax_rate:      appConfig.tax_rate,
          currency:      appConfig.currency,
          google_review_link: appConfig.google_review_link,
          facebook_url:  appConfig.facebook_url,
          instagram_url: appConfig.instagram_url,
          custom_social_url: appConfig.custom_social_url,
        };
        const { data: existing } = await supabase
          .from("system_config").select("id")
          .eq("key", "settings.branding").eq("tenant_id", tenantId).limit(1);
        if (existing?.length) {
          await supabase.from("system_config").update({ value: JSON.stringify(branding) }).eq("id", existing[0].id);
        } else {
          await supabase.from("system_config").insert({
            key: "settings.branding", value: JSON.stringify(branding),
            category: "general", description: "Configuración del taller", tenant_id: tenantId,
          });
        }
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
      const configs = await dataClient.entities.AppSettings.filter({ slug: "app-theme" });
      if (configs?.length) {
        await dataClient.entities.AppSettings.update(configs[0].id, { payload: { theme: newTheme } });
      } else {
        await dataClient.entities.AppSettings.create({
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
      const configs = await dataClient.entities.AppSettings.filter({ slug: "payment-methods" });
      if (configs?.length) {
        await dataClient.entities.AppSettings.update(configs[0].id, { payload });
      } else {
        await dataClient.entities.AppSettings.create({
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
        await dataClient.entities.WorkOrderWizardConfig.update(wizardConfig.id, wizardConfig);
      } else {
        await dataClient.entities.WorkOrderWizardConfig.create(wizardConfig);
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
      const configs = await dataClient.entities.AppSettings.filter({ slug: "email-config" });
      if (configs?.length) {
        await dataClient.entities.AppSettings.update(configs[0].id, { payload: emailConfig });
      } else {
        await dataClient.entities.AppSettings.create({
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
        await dataClient.entities.AppEmployee.update(editingUser.id, editingUser);
        toast.success("✅ Empleado actualizado");
      } else {
        await dataClient.entities.AppEmployee.create(editingUser);
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
      await dataClient.entities.AppEmployee.delete(user.id);
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
      const configs = await dataClient.entities.AppSettings.filter({ slug: "useful-links" });
      const payload = { links: usefulLinks };
      if (configs?.length) {
        await dataClient.entities.AppSettings.update(configs[0].id, { payload });
      } else {
        await dataClient.entities.AppSettings.create({
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

  const saveAdminPanelButtons = async () => {
    setLoading(true);
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "admin-panel-buttons" });
      
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
        await dataClient.entities.AppSettings.update(configs[0].id, { payload });
      } else {
        await dataClient.entities.AppSettings.create({
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

  const handleLogoUpload = async (file) => {
    if (!file) return;
    
    setUploadingLogo(true);
    try {
      const result = await dataClient.files.upload(file);
      const file_url = result?.file_url || result?.url || result?.public_url || "";
      setBusinessBranding({ ...businessBranding, logo_url: file_url });
      toast.success("Logo subido correctamente");
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast.error("Error al subir logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveBusinessBranding = async () => {
    setLoading(true);
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "business-branding" });
      const payload = businessBranding;
      
      if (configs?.length) {
        await dataClient.entities.AppSettings.update(configs[0].id, { payload });
      } else {
        await dataClient.entities.AppSettings.create({
          slug: "business-branding",
          payload,
          description: "Logo y términos del negocio"
        });
      }
      
      toast.success("✅ Información guardada");
    } catch (error) {
      console.error("Error saving branding:", error);
      toast.error("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  const savePolicies = async () => {
    setLoading(true);
    try {
      // 1. business-branding → email templates consume warranty_repairs / warranty_sales
      const brandingConfigs = await dataClient.entities.AppSettings.filter({ slug: "business-branding" });
      const brandingPayload = {
        ...(brandingConfigs?.[0]?.payload || {}),
        ...businessBranding,
      };
      if (brandingConfigs?.length) {
        await dataClient.entities.AppSettings.update(brandingConfigs[0].id, { payload: brandingPayload });
      } else {
        await dataClient.entities.AppSettings.create({ slug: "business-branding", payload: brandingPayload, description: "Logo y políticas del negocio" });
      }

      // 2. pos-receipt-config → POS receipts consume warranty_text / conditions_text
      const receiptConfigs = await dataClient.entities.AppSettings.filter({ slug: "pos-receipt-config" });
      const receiptPayload = {
        ...(receiptConfigs?.[0]?.payload || {}),
        warranty_text: businessBranding.warranty_repairs || "",
        conditions_text: businessBranding.conditions_text || "",
      };
      if (receiptConfigs?.length) {
        await dataClient.entities.AppSettings.update(receiptConfigs[0].id, { payload: receiptPayload });
      } else {
        await dataClient.entities.AppSettings.create({ slug: "pos-receipt-config", payload: receiptPayload });
      }

      toast.success("✅ Políticas guardadas");
    } catch {
      toast.error("Error al guardar políticas");
    } finally {
      setLoading(false);
    }
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

  // Sections organized into logical groups
  const sectionGroups = [
    {
      groupId: "negocio",
      groupLabel: "Tu Negocio",
      sections: [
        {
          id: "business_info",
          icon: Building2,
          title: "Info del Negocio",
          description: "Logo, contacto y horarios",
          color: "from-orange-600 to-amber-600",
        },
        {
          id: "regional",
          icon: Globe,
          title: "Idioma y Región",
          description: "Idioma del sistema y zona horaria",
          color: "from-blue-600 to-indigo-600",
        },
        {
          id: "business_policies",
          icon: ShieldCheck,
          title: "Políticas del Negocio",
          description: "Garantías de reparación, ventas y condiciones",
          color: "from-indigo-600 to-violet-600",
        },
        {
          id: "email_templates",
          icon: Mail,
          title: "Notificaciones",
          description: "Plantillas de email automáticas",
          color: "from-emerald-600 to-green-600",
        },
      ]
    },
    {
      groupId: "personalizacion",
      groupLabel: "Personalización",
      sections: [
        {
          id: "wizard",
          icon: ClipboardList,
          title: "Catálogo",
          description: "Dispositivos, marcas y modelos",
          color: "from-violet-600 to-purple-600",
        },
        {
          id: "inventory",
          icon: Package,
          title: "Inventario",
          description: "Productos y stock",
          color: "from-teal-500 to-cyan-600",
          isNavigation: true,
          navigateTo: "Inventory"
        },
        {
          id: "pos_receipt",
          icon: Receipt,
          title: "POS & Recibo",
          description: "Garantía, condiciones y envío de recibos",
          color: "from-amber-500 to-orange-600",
        },
      ]
    },
    {
      groupId: "sistema",
      groupLabel: "Sistema",
      sections: [
        {
          id: "admin_panel",
          icon: Users,
          title: "Empleados",
          description: "Usuarios y permisos",
          color: "from-cyan-600 to-blue-600",
          isNavigation: true,
          navigateTo: "UsersManagement"
        },
        {
          id: "payment_methods",
          icon: CreditCard,
          title: "Métodos de Pago",
          description: "Efectivo, tarjeta, ATH Móvil y más",
          color: "from-green-600 to-teal-600",
        },
        {
          id: "financial_nav",
          icon: Wallet,
          title: "Finanzas & Reportes",
          description: "Caja, ventas, gastos e informes",
          color: "from-emerald-600 to-green-700",
          isNavigation: true,
          navigateTo: "Financial"
        },
        {
          id: "shift_tasks",
          icon: ClipboardList,
          title: "Tareas de Turno",
          description: "Tareas de apertura y cierre por empleado",
          color: "from-amber-500 to-orange-600",
        },
        {
          id: "jenai_toggle",
          icon: Bot,
          title: "Asistente DARJENI",
          description: "IA flotante en todas las pantallas",
          color: "from-blue-500 to-violet-600",
          isToggle: true,
        },
        // Seguridad y Sesión — biometría + timeout, visible para TODOS
        {
          id: "biometric",
          icon: Fingerprint,
          title: "Seguridad y Sesión",
          description: "Biometría y tiempo de inactividad",
          color: "from-indigo-500 to-purple-600",
        },
      ]
    },
  ];

  // Flat list still needed for activeSection lookup
  const sections = sectionGroups.flatMap(g => g.sections);



  if (activeSection) {
    const section = sections.find(s => s.id === activeSection);
    const Icon = section?.icon || SettingsIcon;

    return (
      <div
        className="min-h-screen bg-black/90 backdrop-blur-3xl theme-light:bg-gray-50 p-4 sm:p-6 relative"
        style={{ paddingTop: "10px" }}
      >
        {/* Fondos animados flotantes */}
        <div className="fixed -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />
        <div className="fixed -bottom-40 -left-40 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-[120px] animate-pulse delay-1000 pointer-events-none" />
        
        <div className="max-w-5xl mx-auto">
          {/* Section Header Sequoia Style */}
          <div className="mb-5">
            <button
              onClick={() => setActiveSection(null)}
              className="flex items-center gap-3 text-white/60 hover:text-white transition-all duration-300 mb-6 text-sm font-bold group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 group-hover:from-white/15 group-hover:to-white/10 border border-white/10 flex items-center justify-center transition-all active:scale-95 shadow-lg">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </div>
              Volver
            </button>
            
            <div className="flex items-center gap-4 sm:gap-6">
              <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-[20px] sm:rounded-[26px] bg-gradient-to-br ${section.color} flex items-center justify-center shadow-2xl transition-all duration-300 flex-shrink-0`}>
                <Icon className="w-7 h-7 sm:w-10 sm:h-10 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tighter mb-1">{section.title}</h1>
                <p className="text-white/60 text-sm sm:text-lg font-bold">{section.description}</p>
              </div>
            </div>
          </div>

          {/* IDIOMA Y REGIÓN */}
          {activeSection === "regional" && (
            <div className="space-y-5">

              {/* ── Idioma ── */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-48 h-48 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-full blur-[80px]" />
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/30 to-indigo-500/20 border border-blue-500/20 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Idioma del Sistema</p>
                    <p className="text-white/40 text-xs">Cambia el idioma de toda la interfaz</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative z-10">
                  {[
                    { value: "es", flag: "🇵🇷", label: "Español", sublabel: "Puerto Rico / Latinoamérica" },
                    { value: "en", flag: "🇺🇸", label: "English",  sublabel: "United States" },
                  ].map((lang) => (
                    <button
                      key={lang.value}
                      onClick={() => setAppConfig({ ...appConfig, language: lang.value })}
                      className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                        appConfig.language === lang.value
                          ? "border-blue-500/60 bg-blue-500/15 shadow-[0_0_20px_rgba(59,130,246,0.2)]"
                          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/20"
                      }`}
                    >
                      <span className="text-3xl leading-none">{lang.flag}</span>
                      <div className="flex-1">
                        <p className={`font-black text-base ${appConfig.language === lang.value ? "text-blue-300" : "text-white"}`}>{lang.label}</p>
                        <p className="text-white/40 text-xs mt-0.5">{lang.sublabel}</p>
                      </div>
                      {appConfig.language === lang.value && (
                        <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                <p className="text-xs text-orange-400/80 font-medium ml-1 mt-4 flex items-center gap-1.5 relative z-10">
                  <AlertCircle className="w-3.5 h-3.5" />
                  El cambio de idioma requiere recargar la página para aplicarse completamente
                </p>
              </div>

              {/* ── Zona Horaria ── */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Zona Horaria</p>
                    <p className="text-white/40 text-xs">Afecta fechas, horas y reportes del sistema</p>
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={appConfig.timezone}
                    onChange={(e) => setAppConfig({ ...appConfig, timezone: e.target.value })}
                    className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl px-4 py-3.5 text-white appearance-none outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  >
                    <optgroup label="🌎 Caribe & Puerto Rico" className="bg-gray-900">
                      <option value="America/Puerto_Rico" className="bg-gray-900">🇵🇷 Puerto Rico (AST, UTC-4)</option>
                      <option value="America/Santo_Domingo" className="bg-gray-900">🇩🇴 República Dominicana (AST, UTC-4)</option>
                    </optgroup>
                    <optgroup label="🌎 Estados Unidos" className="bg-gray-900">
                      <option value="America/New_York" className="bg-gray-900">🇺🇸 New York / Miami (ET, UTC-5)</option>
                      <option value="America/Chicago" className="bg-gray-900">🇺🇸 Chicago / Houston (CT, UTC-6)</option>
                      <option value="America/Denver" className="bg-gray-900">🇺🇸 Denver / Phoenix (MT, UTC-7)</option>
                      <option value="America/Los_Angeles" className="bg-gray-900">🇺🇸 Los Angeles / Seattle (PT, UTC-8)</option>
                    </optgroup>
                    <optgroup label="🌎 América Latina" className="bg-gray-900">
                      <option value="America/Mexico_City" className="bg-gray-900">🇲🇽 Ciudad de México (CST, UTC-6)</option>
                      <option value="America/Bogota" className="bg-gray-900">🇨🇴 Colombia (COT, UTC-5)</option>
                      <option value="America/Lima" className="bg-gray-900">🇵🇪 Perú (PET, UTC-5)</option>
                      <option value="America/Santiago" className="bg-gray-900">🇨🇱 Chile (CLT, UTC-4/-3)</option>
                      <option value="America/Argentina/Buenos_Aires" className="bg-gray-900">🇦🇷 Argentina (ART, UTC-3)</option>
                      <option value="America/Sao_Paulo" className="bg-gray-900">🇧🇷 São Paulo (BRT, UTC-3)</option>
                    </optgroup>
                    <optgroup label="🌍 Europa" className="bg-gray-900">
                      <option value="Europe/Madrid" className="bg-gray-900">🇪🇸 España (CET, UTC+1/+2)</option>
                      <option value="Europe/London" className="bg-gray-900">🇬🇧 Reino Unido (GMT, UTC+0/+1)</option>
                    </optgroup>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                </div>
              </div>

              <Button
                onClick={saveAppConfig}
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-[20px] h-14 text-lg font-black shadow-[0_0_30px_rgba(59,130,246,0.4)] active:scale-95 transition-all duration-300"
              >
                {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <><Check className="w-5 h-5 mr-2" />Guardar Idioma y Región</>}
              </Button>
            </div>
          )}



          {/* BUSINESS INFO */}
          {activeSection === "business_info" && (
            <div className="space-y-5">

              {/* ── 1. Identidad Visual ── */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-48 h-48 bg-gradient-to-br from-orange-500/20 to-amber-500/10 rounded-full blur-[80px]" />
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500/30 to-amber-500/20 border border-orange-500/20 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-orange-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Identidad Visual</p>
                    <p className="text-white/40 text-xs">Logo, nombre y slogan — aparecen en recibos, emails y el sistema</p>
                  </div>
                </div>

                <div className="space-y-5 relative z-10">
                  {/* Logo */}
                  <div className="flex items-center gap-5 p-4 bg-black/30 rounded-2xl border border-white/10">
                    <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {businessBranding.logo_url ? (
                        <img src={businessBranding.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                      ) : (
                        <Building2 className="w-8 h-8 text-white/20" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <p className="text-white/60 text-xs font-semibold">Logo de la Tienda</p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => document.getElementById('logo-upload-input').click()}
                          disabled={uploadingLogo}
                          className="bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-300 rounded-xl h-9 px-4 text-sm font-bold"
                        >
                          {uploadingLogo ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Subiendo...</> : <><Upload className="w-4 h-4 mr-1.5" />{businessBranding.logo_url ? "Cambiar" : "Subir Logo"}</>}
                        </Button>
                        {businessBranding.logo_url && (
                          <Button variant="ghost" size="icon" onClick={() => setBusinessBranding({ ...businessBranding, logo_url: "" })} className="text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl h-9 w-9">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <p className="text-white/25 text-xs">PNG, JPG · 500×200 px recomendado</p>
                    </div>
                  </div>
                  <input id="logo-upload-input" type="file" accept="image/png,image/jpeg,image/jpg" onChange={(e) => handleLogoUpload(e.target.files[0])} className="hidden" />

                  {/* Nombre + Slogan */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-white/60 text-xs font-semibold ml-1">Nombre de la Tienda *</label>
                      <Input
                        value={appConfig.business_name}
                        onChange={(e) => setAppConfig({ ...appConfig, business_name: e.target.value })}
                        placeholder="Ej: 911 SmartFix"
                        className="bg-white/5 border-white/10 text-white rounded-xl h-12 focus:bg-white/10"
                      />
                      <p className="text-white/25 text-xs ml-1">Aparece en recibos, emails y el dashboard</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-white/60 text-xs font-semibold ml-1">Slogan / Tagline</label>
                      <Input
                        value={appConfig.slogan || ""}
                        onChange={(e) => setAppConfig({ ...appConfig, slogan: e.target.value })}
                        placeholder="Tu taller de confianza"
                        className="bg-white/5 border-white/10 text-white rounded-xl h-12 focus:bg-white/10"
                      />
                      <p className="text-white/25 text-xs ml-1">Subtítulo que acompaña el nombre</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 2. Información de Contacto ── */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 rounded-full blur-[80px]" />
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-blue-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Información de Contacto</p>
                    <p className="text-white/40 text-xs">Teléfono, email y dirección que aparecen en recibos y comunicaciones</p>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-white/60 text-xs font-semibold ml-1">📞 Teléfono del Negocio</label>
                      <Input value={appConfig.business_phone} onChange={(e) => setAppConfig({ ...appConfig, business_phone: e.target.value })} placeholder="(787) 123-4567" className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:bg-white/10" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-white/60 text-xs font-semibold ml-1">💬 WhatsApp</label>
                      <Input value={appConfig.business_whatsapp} onChange={(e) => setAppConfig({ ...appConfig, business_whatsapp: e.target.value })} placeholder="(787) 123-4567" className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:bg-white/10" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-white/60 text-xs font-semibold ml-1">✉️ Email del Negocio</label>
                    <Input value={appConfig.business_email} onChange={(e) => setAppConfig({ ...appConfig, business_email: e.target.value })} placeholder="info@smartfix.com" className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:bg-white/10" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-white/60 text-xs font-semibold ml-1">📍 Dirección Física</label>
                    <Input value={appConfig.business_address} onChange={(e) => setAppConfig({ ...appConfig, business_address: e.target.value })} placeholder="Calle Principal #123, San Juan, PR" className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:bg-white/10" />
                  </div>
                </div>
              </div>

              {/* ── 3. Horarios ── */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-green-500/20 border border-emerald-500/20 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Horarios de Atención</p>
                    <p className="text-white/40 text-xs">Se muestran en recibos y comunicaciones con clientes</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map((day) => {
                    const dayLabel = { monday:'Lunes', tuesday:'Martes', wednesday:'Miércoles', thursday:'Jueves', friday:'Viernes', saturday:'Sábado', sunday:'Domingo' }[day];
                    const hours = appConfig.business_hours[day];
                    return (
                      <div key={day} className="flex items-center gap-3 px-4 py-3 bg-white/[0.04] hover:bg-white/[0.06] rounded-2xl border border-white/[0.07] transition-colors">
                        <span className="text-white font-semibold text-sm w-24 shrink-0">{dayLabel}</span>
                        {!hours.closed ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input type="time" value={hours.open} onChange={(e) => setAppConfig({ ...appConfig, business_hours: {...appConfig.business_hours, [day]: {...hours, open: e.target.value}} })} className="bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                            <span className="text-white/30 font-bold">—</span>
                            <input type="time" value={hours.close} onChange={(e) => setAppConfig({ ...appConfig, business_hours: {...appConfig.business_hours, [day]: {...hours, close: e.target.value}} })} className="bg-white/5 border border-white/10 text-white rounded-xl px-3 py-2 text-sm flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
                          </div>
                        ) : (
                          <span className="flex-1 text-red-400 text-sm font-semibold">Cerrado</span>
                        )}
                        <button onClick={() => setAppConfig({ ...appConfig, business_hours: {...appConfig.business_hours, [day]: {...hours, closed: !hours.closed}} })} className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${hours.closed ? 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10' : 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25'}`}>
                          {hours.closed ? 'Abrir' : 'Cerrar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── 4. Redes Sociales & Links ── */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute -right-20 -bottom-20 w-48 h-48 bg-gradient-to-br from-purple-500/20 to-pink-500/10 rounded-full blur-[80px]" />
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 border border-purple-500/20 flex items-center justify-center">
                    <ExternalLink className="w-5 h-5 text-purple-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Redes Sociales & Links</p>
                    <p className="text-white/40 text-xs">Se usan como botones en plantillas de email y recibos</p>
                  </div>
                </div>

                <div className="space-y-4 relative z-10">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-white/60 text-xs font-semibold ml-1">📘 Facebook</label>
                      <Input value={appConfig.facebook_url || ""} onChange={(e) => setAppConfig({ ...appConfig, facebook_url: e.target.value })} placeholder="https://facebook.com/tutienda" className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:bg-white/10" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-white/60 text-xs font-semibold ml-1">📸 Instagram</label>
                      <Input value={appConfig.instagram_url || ""} onChange={(e) => setAppConfig({ ...appConfig, instagram_url: e.target.value })} placeholder="https://instagram.com/tutienda" className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:bg-white/10" />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-white/60 text-xs font-semibold ml-1">⭐ Google Reviews</label>
                    <Input value={appConfig.google_review_link || ""} onChange={(e) => setAppConfig({ ...appConfig, google_review_link: e.target.value })} placeholder="https://g.page/r/..." className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:bg-white/10" />
                    <p className="text-white/25 text-xs ml-1">Los clientes pueden dejar una reseña desde su recibo</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-white/60 text-xs font-semibold ml-1">🌐 Sitio Web / Otro Link</label>
                    <Input value={appConfig.custom_social_url || ""} onChange={(e) => setAppConfig({ ...appConfig, custom_social_url: e.target.value })} placeholder="https://tusitioweb.com" className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:bg-white/10" />
                  </div>
                </div>
              </div>

              {/* ── 5. Fiscal ── */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute -right-20 -bottom-20 w-48 h-48 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-full blur-[80px]" />
                <div className="flex items-center gap-3 mb-6 relative z-10">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Fiscal</p>
                    <p className="text-white/40 text-xs">Moneda e impuestos aplicados en órdenes y recibos</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                  <div className="space-y-1.5">
                    <label className="text-white/60 text-xs font-semibold ml-1">💵 Moneda</label>
                    <select
                      value={appConfig.currency || "USD"}
                      onChange={(e) => setAppConfig({ ...appConfig, currency: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 text-white rounded-xl h-11 px-3 focus:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/20 appearance-none"
                    >
                      <option value="USD" className="bg-gray-900">🇺🇸 USD — Dólar americano</option>
                      <option value="EUR" className="bg-gray-900">🇪🇺 EUR — Euro</option>
                      <option value="MXN" className="bg-gray-900">🇲🇽 MXN — Peso mexicano</option>
                      <option value="COP" className="bg-gray-900">🇨🇴 COP — Peso colombiano</option>
                      <option value="DOP" className="bg-gray-900">🇩🇴 DOP — Peso dominicano</option>
                      <option value="GBP" className="bg-gray-900">🇬🇧 GBP — Libra esterlina</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-white/60 text-xs font-semibold ml-1">🧾 IVU / Impuesto (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={appConfig.tax_rate ?? 11.5}
                      onChange={(e) => setAppConfig({ ...appConfig, tax_rate: parseFloat(e.target.value) || 0 })}
                      placeholder="11.5"
                      className="bg-white/5 border-white/10 text-white rounded-xl h-11 focus:bg-white/10"
                    />
                    <p className="text-white/25 text-xs ml-1">Puerto Rico: 11.5% · Introduce 0 si no aplica impuesto</p>
                  </div>
                </div>
              </div>

              <Button
                onClick={async () => { await saveBusinessBranding(); await saveAppConfig(); }}
                disabled={loading}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-[20px] h-14 text-lg font-black shadow-[0_0_30px_rgba(249,115,22,0.4)] active:scale-95 transition-all duration-300"
              >
                {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <><Check className="w-5 h-5 mr-2" />Guardar Info del Negocio</>}
              </Button>

              {/* Modales de Garantías (ocultos, pueden activarse desde otro módulo) */}
              <WarrantySalesModal
                isOpen={showWarrantySalesModal}
                onClose={() => setShowWarrantySalesModal(false)}
                currentText={businessBranding.warranty_sales}
                onSave={(data) => setBusinessBranding({ ...businessBranding, warranty_sales: data })}
              />

              <WarrantyRepairsModal
                isOpen={showWarrantyRepairsModal}
                onClose={() => setShowWarrantyRepairsModal(false)}
                currentText={businessBranding.warranty_repairs}
                onSave={(text) => setBusinessBranding({ ...businessBranding, warranty_repairs: text })}
              />
            </div>
          )}

          {/* WIZARD */}
          {activeSection === "wizard" && <WizardConfigPanel />}

          {/* EMAIL TEMPLATES */}
          {activeSection === "email_templates" && <EmailTemplatesTab />}

          {/* POLÍTICAS DEL NEGOCIO */}
          {activeSection === "business_policies" && (
            <div className="space-y-5">

              {/* Garantía Reparaciones */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute -right-20 -top-20 w-48 h-48 bg-gradient-to-br from-indigo-500/20 to-violet-500/10 rounded-full blur-[80px]" />
                <div className="flex items-center gap-3 mb-5 relative z-10">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Garantía de Reparaciones</p>
                    <p className="text-white/40 text-xs">Aparece en emails de entrega/recogida y en recibos de servicio</p>
                  </div>
                </div>
                <textarea
                  rows={4}
                  placeholder="Ej: 90 días de garantía en mano de obra. Las piezas tienen garantía del fabricante. No cubre daños por agua o golpes posteriores."
                  value={businessBranding.warranty_repairs || ""}
                  onChange={(e) => setBusinessBranding({ ...businessBranding, warranty_repairs: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:outline-none focus:border-indigo-500/50 relative z-10"
                />
              </div>

              {/* Garantía Ventas */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-full blur-[80px]" />
                <div className="flex items-center gap-3 mb-5 relative z-10">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Garantía de Ventas</p>
                    <p className="text-white/40 text-xs">Aplica a productos vendidos — aparece en recibos de POS y emails de pago</p>
                  </div>
                </div>
                <textarea
                  rows={4}
                  placeholder="Ej: 30 días de garantía contra defectos de fábrica. No se aceptan devoluciones en accesorios sin empaque original."
                  value={businessBranding.warranty_sales || ""}
                  onChange={(e) => setBusinessBranding({ ...businessBranding, warranty_sales: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:outline-none focus:border-emerald-500/50 relative z-10"
                />
              </div>

              {/* Condiciones de Venta */}
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 relative overflow-hidden">
                <div className="absolute -right-20 -bottom-20 w-48 h-48 bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-full blur-[80px]" />
                <div className="flex items-center gap-3 mb-5 relative z-10">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base">Condiciones de Venta</p>
                    <p className="text-white/40 text-xs">Política de devoluciones y términos generales — aparece en todos los recibos</p>
                  </div>
                </div>
                <textarea
                  rows={4}
                  placeholder="Ej: No se aceptan devoluciones después de 7 días. Guarda tu recibo como comprobante. Equipos no reclamados después de 30 días serán considerados abandonados."
                  value={businessBranding.conditions_text || ""}
                  onChange={(e) => setBusinessBranding({ ...businessBranding, conditions_text: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:outline-none focus:border-amber-500/50 relative z-10"
                />
              </div>

              {/* Info banner */}
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-2xl px-4 py-3 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                <p className="text-indigo-300/70 text-xs">
                  Estos textos se aplican automáticamente en <strong>emails de estado de orden</strong> y en los <strong>recibos de POS</strong>. No necesitas configurarlos por separado en cada plantilla ni en el tab de POS & Recibo.
                </p>
              </div>

              <Button
                onClick={savePolicies}
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white rounded-[20px] h-14 text-lg font-black shadow-[0_0_30px_rgba(99,102,241,0.4)] active:scale-95 transition-all duration-300"
              >
                {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <><Check className="w-5 h-5 mr-2" />Guardar Políticas del Negocio</>}
              </Button>
            </div>
          )}

          {/* POS & RECIBO */}
          {activeSection === "pos_receipt" && <POSReceiptTab />}

          {/* TAREAS DE TURNO */}
          {activeSection === "shift_tasks" && (
            <div className="space-y-6">
              <ShiftTasksManager />
            </div>
          )}

          {/* SEGURIDAD Y SESIÓN — biometría + timeout por usuario */}
          {activeSection === "biometric" && (
            <div className="space-y-6">
              {/* ── Sección Biometría (solo en dispositivos con soporte) ── */}
              {(isMobileDevice || biometricSupported) && (
                <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/20 flex items-center justify-center">
                      <Fingerprint className="w-5 h-5 text-indigo-300" />
                    </div>
                    <div>
                      <p className="text-white font-black text-base">Acceso Biométrico</p>
                      <p className="text-white/40 text-xs">Face ID, Touch ID o huella digital</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${biometricProfile ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-white/5 border border-white/10"}`}>
                      {/iphone|ipad/i.test(navigator.userAgent) ? (
                        <svg viewBox="0 0 24 24" className={`w-8 h-8 ${biometricProfile ? "text-emerald-400" : "text-white/30"}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M9 3H5a2 2 0 00-2 2v4M9 3h6M15 3h4a2 2 0 012 2v4M3 15v4a2 2 0 002 2h4m6 0h4a2 2 0 002-2v-4M9 9h.01M15 9h.01M9 14.5s1 1.5 3 1.5 3-1.5 3-1.5" />
                        </svg>
                      ) : (
                        <Fingerprint className={`w-8 h-8 ${biometricProfile ? "text-emerald-400" : "text-white/30"}`} />
                      )}
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">
                        {/iphone|ipad/i.test(navigator.userAgent) ? "Face ID / Touch ID" : /mac/i.test(navigator.userAgent) && !/iPhone|iPad|iPod/.test(navigator.userAgent) ? "Touch ID" : "Huella digital"}
                      </p>
                      <p className={`text-sm font-medium ${biometricProfile ? "text-emerald-400" : "text-white/40"}`}>
                        {biometricProfile ? "Activo en este dispositivo" : "No configurado"}
                      </p>
                      {biometricProfile?.session?.userName && (
                        <p className="text-white/50 text-xs mt-0.5">Usuario: {biometricProfile.session.userName}</p>
                      )}
                    </div>
                  </div>

                  <p className="text-white/50 text-sm">
                    {biometricSupported
                      ? "Activa el acceso biométrico para entrar sin escribir tu PIN cada vez."
                      : /mac/i.test(navigator.userAgent) && !/iPhone|iPad|iPod/.test(navigator.userAgent)
                        ? "Asegúrate de tener Touch ID configurado en Ajustes del Sistema de macOS."
                        : "Este dispositivo no soporta autenticación biométrica."}
                  </p>

                  {biometricSupported && (
                    biometricProfile ? (
                      <button
                        onClick={clearBiometricProfile}
                        disabled={biometricLoading}
                        className="w-full h-12 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 font-semibold hover:bg-red-500/15 transition-all active:scale-95 disabled:opacity-40"
                      >
                        Quitar Face ID / Huella de este dispositivo
                      </button>
                    ) : (
                      <button
                        onClick={handleEnableBiometric}
                        disabled={biometricLoading}
                        className="w-full h-12 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                      >
                        {biometricLoading ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Activando...</>
                        ) : (
                          <>{/iphone|ipad|mac/i.test(navigator.userAgent) ? "Activar Face ID" : "Activar Huella digital"}</>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}

              {/* ── Sección Tiempo de Inactividad ── */}
              <UserSessionSettings />
            </div>
          )}

          {/* MÉTODOS DE PAGO */}
          {activeSection === "payment_methods" && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/30 to-teal-500/20 border border-green-500/20 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-green-300" />
                  </div>
                  <div>
                    <p className="text-white font-black text-lg">Métodos habilitados</p>
                    <p className="text-white/40 text-sm">Activa los que acepta tu negocio</p>
                  </div>
                </div>

                {[
                  { key: "cash",          label: "Efectivo",         icon: "💵" },
                  { key: "card",          label: "Tarjeta",          icon: "💳" },
                  { key: "ath_movil",     label: "ATH Móvil",        icon: "📱" },
                  { key: "bank_transfer", label: "Transferencia",    icon: "🏦" },
                  { key: "check",         label: "Cheque",           icon: "📝" },
                ].map(({ key, label, icon }) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                    <span className="text-white font-semibold text-base">{icon} {label}</span>
                    <button
                      onClick={() => setPaymentMethods({ ...paymentMethods, [key]: !paymentMethods[key] })}
                      className={`w-12 h-7 rounded-full transition-colors relative flex items-center px-1 ${paymentMethods[key] ? "bg-green-500" : "bg-white/10"}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${paymentMethods[key] ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                ))}

                {/* Métodos personalizados */}
                {customPaymentMethods.length > 0 && (
                  <div className="pt-2 space-y-2">
                    <p className="text-white/40 text-xs font-bold uppercase tracking-wider">Personalizados</p>
                    {customPaymentMethods.map((method, i) => (
                      <div key={i} className="flex items-center justify-between py-2">
                        <span className="text-white font-semibold">✨ {method}</span>
                        <button
                          onClick={() => removeCustomMethod(i)}
                          className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-500/10 transition-all"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Añadir método personalizado */}
                <div className="flex gap-2 pt-2">
                  <Input
                    value={newCustomMethod}
                    onChange={(e) => setNewCustomMethod(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addCustomMethod()}
                    placeholder="Nombre del método personalizado"
                    className="bg-white/5 border-white/10 rounded-xl h-11 text-white placeholder-white/20 focus:bg-white/10 flex-1"
                  />
                  <Button onClick={addCustomMethod} className="bg-green-600 hover:bg-green-500 text-white rounded-xl h-11 px-4 font-bold">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Button
                onClick={savePaymentMethods}
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-teal-500 hover:from-green-600 hover:to-teal-600 text-white rounded-[20px] h-14 text-lg font-black shadow-[0_0_30px_rgba(16,185,129,0.4)] active:scale-95 transition-all duration-300"
              >
                {loading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : "Guardar Métodos de Pago"}
              </Button>
            </div>
          )}




        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-black/90 backdrop-blur-3xl theme-light:bg-gray-50 p-4 sm:p-6 relative"
      style={{ paddingTop: "10px" }}
    >
      {/* Fondos animados flotantes estilo macOS Sequoia */}
      <div className="fixed -top-60 -right-60 w-[500px] h-[500px] bg-gradient-to-br from-purple-500/15 to-pink-500/10 rounded-full blur-[140px] animate-pulse pointer-events-none" />
      <div className="fixed -bottom-60 -left-60 w-[500px] h-[500px] bg-gradient-to-br from-blue-500/15 to-cyan-500/10 rounded-full blur-[140px] animate-pulse delay-1000 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto">
        {/* Hero Header iOS Style - Icon Focused */}
        <div className="flex items-center justify-center sm:justify-start gap-4 sm:gap-6 mb-8">
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-[28px] bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl border border-white/20 backdrop-blur-md transform hover:scale-105 transition-transform duration-500">
            <SettingsIcon className="w-10 h-10 sm:w-14 sm:h-14 text-white" strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl sm:text-5xl font-black text-white tracking-tighter mb-1">
              Configuración
            </h1>
            <p className="text-white/60 text-sm sm:text-xl font-semibold hidden sm:block">
              Personaliza tu experiencia SmartFixOS
            </p>
          </div>
        </div>

        {/* Settings — grouped layout */}
        <div className="space-y-6">
          {sectionGroups.map(group => (
            <div key={group.groupId}>
              {/* Group label */}
              <p className="text-xs font-black text-white/30 uppercase tracking-[0.15em] mb-4 px-1">
                {group.groupLabel}
              </p>
              {/* Cards row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {group.sections.map(section => {
                  const Icon = section.icon;
                  const isOn = section.isToggle
                    ? (section.id === "jenai_toggle" ? jenaiEnabled : showPriceWidget)
                    : null;

                  return (
                    <button
                      key={section.id}
                      onClick={() => {
                        if (section.isToggle) {
                          if (section.id === "jenai_toggle") {
                            const next = !jenaiEnabled;
                            setJenaiEnabled(next);
                            localStorage.setItem("smartfix_jenai_disabled", String(!next));
                            window.dispatchEvent(new CustomEvent("smartfix:jenai-toggle", { detail: { enabled: next } }));
                          }
                        } else if (section.isNavigation) {
                          navigate(createPageUrl(section.navigateTo));
                        } else {
                          setActiveSection(section.id);
                        }
                      }}
                      className="group flex items-center gap-4 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] hover:border-white/[0.15] rounded-2xl px-4 py-4 transition-all duration-200 active:scale-[0.98] text-left"
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${section.color} shadow-lg`}>
                        <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-sm leading-tight">{section.title}</p>
                        <p className="text-white/40 text-xs mt-0.5 truncate">{section.description}</p>
                      </div>
                      {section.isToggle ? (
                        <div className={`relative w-11 h-6 rounded-full transition-colors duration-300 flex-shrink-0 ${isOn ? "bg-cyan-500" : "bg-white/10"}`}>
                          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-300 ${isOn ? "translate-x-5" : "translate-x-0.5"}`} />
                        </div>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/50 flex-shrink-0 transition-colors" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Feedback banner */}
        <div className="mt-8 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 border border-purple-500/20 rounded-[24px] p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-600 flex items-center justify-center flex-shrink-0 shadow-lg">
            <MessageSquarePlus className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">¿Tienes una sugerencia o problema?</p>
            <p className="text-gray-500 text-xs mt-0.5">Cuéntanos — leemos cada mensaje</p>
          </div>
          <button
            onClick={() => setShowFeedback(true)}
            className="flex-shrink-0 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-all border border-white/10 hover:border-white/20"
          >
            Enviar feedback
          </button>
        </div>
      </div>

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}

    </div>
  );
}
