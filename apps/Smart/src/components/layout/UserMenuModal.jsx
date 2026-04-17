import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import appClient from "@/api/appClient";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../../lib/supabase-client.js";
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

const LOCAL_TIME_ENTRIES_KEY = "local_time_entries";
const BIOMETRIC_LOGIN_KEY = "smartfix_biometric_profile";

const readLocalEntries = () => {
  try {
    const raw = localStorage.getItem(LOCAL_TIME_ENTRIES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalEntries = (entries) => {
  try {
    localStorage.setItem(LOCAL_TIME_ENTRIES_KEY, JSON.stringify(entries));
  } catch {
    // ignore local persistence errors
  }
};

const findLocalOpenEntry = (employeeId) =>
readLocalEntries().find((entry) => entry?.employee_id === employeeId && !entry?.clock_out) || null;

const createLocalEntry = (data) => {
  const entries = readLocalEntries();
  const localEntry = { id: `local-time-${Date.now()}`, ...data };
  entries.unshift(localEntry);
  writeLocalEntries(entries);
  return localEntry;
};

const closeLocalEntry = (entryId) => {
  const entries = readLocalEntries();
  const updated = entries.map((entry) =>
  entry?.id === entryId ? { ...entry, clock_out: new Date().toISOString() } : entry
  );
  writeLocalEntries(updated);
  return updated.find((entry) => entry?.id === entryId) || null;
};

function calculateWorkedHours(clockInISO, clockOutISO) {
  const start = clockInISO ? new Date(clockInISO).getTime() : 0;
  const end = clockOutISO ? new Date(clockOutISO).getTime() : Date.now();
  const millis = Math.max(0, end - start);
  return Math.round((millis / 3600000) * 100) / 100;
}

function getTenantIdFromSession() {
  try {
    const raw = localStorage.getItem("employee_session") || sessionStorage.getItem("911-session");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.tenant_id || parsed?.user?.tenant_id || localStorage.getItem("smartfix_tenant_id") || null;
  } catch {
    return localStorage.getItem("smartfix_tenant_id") || null;
  }
}

const normalizeTimeEntry = (payload) => {
  if (!payload) return null;
  if (payload.id || payload.employee_id || payload.clock_in) return payload;
  if (payload.data && (payload.data.id || payload.data.employee_id || payload.data.clock_in)) return payload.data;
  if (Array.isArray(payload.items) && payload.items[0]) return payload.items[0];
  if (Array.isArray(payload.data) && payload.data[0]) return payload.data[0];
  return null;
};

const normalizeTimeEntryList = (payload) => {
  if (Array.isArray(payload)) return payload.map(normalizeTimeEntry).filter(Boolean);
  const single = normalizeTimeEntry(payload);
  return single ? [single] : [];
};

const fetchRemoteOpenEntry = async (employeeId) => {
  const { data, error } = await supabase
    .from("time_entry")
    .select("*")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return normalizeTimeEntry(data);
};

const createRemoteTimeEntry = async (payload) => {
  const attempts = [payload];
  if (payload?.tenant_id) {
    const { tenant_id, ...withoutTenant } = payload;
    attempts.push(withoutTenant);
  }

  let lastError = null;
  for (let index = 0; index < attempts.length; index += 1) {
    const currentPayload = attempts[index];
    const { error } = await supabase
      .from("time_entry")
      .insert(currentPayload);

    if (!error) {
      const createdEntry = await fetchRemoteOpenEntry(currentPayload.employee_id);
      if (createdEntry) return createdEntry;
      throw new Error("TIMEENTRY_CREATE_NOT_VISIBLE");
    }

    lastError = error;
    const message = String(error?.message || "");
    const retryable =
      index === 0 &&
      payload?.tenant_id &&
      (error?.code === "42501" || /row-level security|policy/i.test(message));

    if (!retryable) break;
  }

  throw lastError || new Error("TIMEENTRY_CREATE_FAILED");
};

function formatPunchDateTime(value) {
  if (!value) return "--";
  return new Date(value).toLocaleString("es-PR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

export default function UserMenuModal({ open, onClose, user }) {
  const navigate = useNavigate();
  const [punchStatus, setPunchStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricProfile, setBiometricProfile] = useState(null);
  const [biometricLoading, setBiometricLoading] = useState(false);
  
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

  const getUserId = () => String(user?.id || user?.userId || "").trim();
  const getUserName = () => String(user?.full_name || user?.userName || user?.email || "").trim();

  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  };

  const createChallenge = () => {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    return challenge;
  };

  const loadBiometricProfile = () => {
    try {
      const raw = localStorage.getItem(BIOMETRIC_LOGIN_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.credentialId ? parsed : null;
    } catch {
      return null;
    }
  };

  const saveBiometricProfile = (profile) => {
    localStorage.setItem(BIOMETRIC_LOGIN_KEY, JSON.stringify(profile));
    setBiometricProfile(profile);
  };

  const clearBiometricProfile = () => {
    localStorage.removeItem(BIOMETRIC_LOGIN_KEY);
    setBiometricProfile(null);
  };

  const buildBiometricSession = () => {
    const raw =
      localStorage.getItem("employee_session") ||
      sessionStorage.getItem("911-session");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.id) return parsed;
      } catch {
        // fall through
      }
    }

    const baseUser = currentUser || user;
    return {
      id: baseUser?.id,
      userId: baseUser?.id,
      userEmail: baseUser?.email || "",
      userName: baseUser?.full_name || baseUser?.email || "",
      full_name: baseUser?.full_name || baseUser?.email || "",
      email: baseUser?.email || "",
      role: baseUser?.role || "user",
      userRole: baseUser?.role || "user",
      position: baseUser?.position || baseUser?.role || "user",
      permissions: baseUser?.permissions || {},
      permissions_list: baseUser?.permissions_list || [],
      tenant_id: baseUser?.tenant_id || localStorage.getItem("smartfix_tenant_id") || null,
      loginTime: new Date().toISOString(),
    };
  };

  const checkBiometricSupport = async () => {
    if (!window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
      setBiometricSupported(false);
      return;
    }
    try {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setBiometricSupported(available);
    } catch {
      setBiometricSupported(false);
    }
  };

  const handleEnableBiometric = async () => {
    const baseUser = currentUser || user;
    if (!baseUser?.id) return;

    setBiometricLoading(true);
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: createChallenge(),
          rp: { name: "SmartFixOS", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(`smartfix:${baseUser.id}`),
            name: baseUser.email || baseUser.full_name || baseUser.id,
            displayName: baseUser.full_name || baseUser.email || "Usuario",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },
            { type: "public-key", alg: -257 },
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
            residentKey: "preferred",
          },
          timeout: 60000,
          attestation: "none",
        },
      });

      if (!credential?.rawId) {
        throw new Error("No se pudo crear la credencial biométrica");
      }

      const session = buildBiometricSession();
      saveBiometricProfile({
        version: 1,
        credentialId: arrayBufferToBase64(credential.rawId),
        userId: baseUser.id,
        tenantId: session.tenant_id || null,
        session,
        userLabel: baseUser.full_name || baseUser.email || "Usuario",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      alert("Huella activada en este dispositivo");
    } catch (error) {
      console.error("Biometric setup error:", error);
      alert(error?.name === "NotAllowedError" ? "Activación biométrica cancelada" : (error?.message || "No se pudo activar la huella"));
    } finally {
      setBiometricLoading(false);
    }
  };

  useEffect(() => {
    if (open && user) {
      checkPunchStatus();
      loadNotificationSettings();
      loadCurrentUser();
      checkBiometricSupport();
      setBiometricProfile(loadBiometricProfile());
      if (activeTab !== "profile") {
        loadSettings();
      }
    }
  }, [open, user, activeTab]);

  // ✅ NUEVO: Cargar el usuario completo desde la DB para obtener el rol actualizado
  const loadCurrentUser = async () => {
    try {
      const uid = getUserId();
      if (uid) {
        const fullUser = await appClient.entities.User.get(uid);
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
      const uid = getUserId();
      if (!uid) {
        setPunchStatus(null);
        return;
      }

      const timeEntryId = sessionStorage.getItem("timeEntryId");
      if (timeEntryId) {
        const rawEntry = timeEntryId.startsWith("local-time-") ?
        findLocalOpenEntry(uid) :
        await dataClient.entities.TimeEntry.get(timeEntryId).catch(() => null);
        const entry = normalizeTimeEntry(rawEntry);
        if (entry && !entry.clock_out) {
          setPunchStatus(entry);
          return;
        }
      }

      let openEntries = [];
      try {
        const payload = await dataClient.entities.TimeEntry.filter({
          employee_id: uid,
          clock_out: null
        });
        openEntries = normalizeTimeEntryList(payload);
      } catch {
        openEntries = [];
      }

      if (openEntries.length === 0) {
        try {
          const directOpen = await fetchRemoteOpenEntry(uid);
          openEntries = directOpen ? [directOpen] : [];
        } catch {
          const localOpen = findLocalOpenEntry(uid);
          openEntries = localOpen ? [localOpen] : [];
        }
      }

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
      const uid = getUserId();
      if (!uid) return;
      const settings = await appClient.entities.UserNotificationSettings.filter({ user_id: uid });
      
      if (settings?.length) {
        setNotificationSettings(settings[0]);
      } else {
        // Create default settings
        const defaultSettings = {
          user_id: uid,
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
        
        const created = await appClient.entities.UserNotificationSettings.create(defaultSettings);
        setNotificationSettings(created);
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    }
  };

  const handlePunchToggle = async () => {
    setLoading(true);
    try {
      const uid = getUserId();
      const uname = getUserName();
      if (!uid) {
        alert("No se pudo identificar el usuario para registrar el ponche.");
        return;
      }

      if (punchStatus) {
        // Clock out
        if (String(punchStatus.id || "").startsWith("local-time-")) {
          closeLocalEntry(punchStatus.id);
        } else {
          const clockOutTime = new Date().toISOString();
          const { error } = await supabase
            .from("time_entry")
            .update({
              clock_out: clockOutTime,
              total_hours: calculateWorkedHours(punchStatus.clock_in, clockOutTime)
            })
            .eq("id", punchStatus.id);
          if (error) throw error;
        }
        sessionStorage.removeItem("timeEntryId");
        setPunchStatus(null);
      } else {
        // Clock in
        const payload = {
          employee_id: uid,
          employee_name: uname || "Empleado",
          clock_in: new Date().toISOString(),
          tenant_id: getTenantIdFromSession()
        };
        let newEntry;
        try {
          newEntry = await createRemoteTimeEntry(payload);
          if (!newEntry?.id) throw new Error("TIMEENTRY_CREATE_INVALID_RESPONSE");
        } catch (error) {
          console.error("UserMenu punch create remote failed:", error);
          alert("No se pudo guardar el ponche en la nube");
          return;
        }
        sessionStorage.setItem("timeEntryId", String(newEntry?.id || ""));
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
        if (String(punchStatus.id || "").startsWith("local-time-")) {
          closeLocalEntry(punchStatus.id);
        } else {
          const clockOutTime = new Date().toISOString();
          const { error } = await supabase
            .from("time_entry")
            .update({
              clock_out: clockOutTime,
              total_hours: calculateWorkedHours(punchStatus.clock_in, clockOutTime)
            })
            .eq("id", punchStatus.id);
          if (error) throw error;
        }
        sessionStorage.removeItem("timeEntryId");
      } catch (error) {
        console.error("Error closing punch:", error);
      }
    }

    // Limpieza completa y redirección directa
    try {
      onClose();
      // Solo borramos la sesión, NUNCA la biometría
      localStorage.removeItem("employee_session");
      sessionStorage.removeItem("911-session");
      sessionStorage.removeItem("timeEntryId");
      
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

      await appClient.entities.UserNotificationSettings.update(notificationSettings.id, updated);
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
      const configs = await appClient.entities.AppSettings.filter({ slug: "app-main-settings" });
      if (configs?.length) {
        setAppConfig({ ...appConfig, ...configs[0].payload });
      }
      
      const themeConfigs = await appClient.entities.AppSettings.filter({ slug: "app-theme" });
      if (themeConfigs?.length) {
        setTheme(themeConfigs[0].payload?.theme || "dark");
      }
      
      const pmConfigs = await appClient.entities.AppSettings.filter({ slug: "payment-methods" });
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
      const configs = await appClient.entities.AppSettings.filter({ slug: "app-main-settings" });
      if (configs?.length) {
        await appClient.entities.AppSettings.update(configs[0].id, { payload: appConfig });
      } else {
        await appClient.entities.AppSettings.create({
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
      const configs = await appClient.entities.AppSettings.filter({ slug: "app-theme" });
      if (configs?.length) {
        await appClient.entities.AppSettings.update(configs[0].id, { payload: { theme: newTheme } });
      } else {
        await appClient.entities.AppSettings.create({
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
      const configs = await appClient.entities.AppSettings.filter({ slug: "payment-methods" });
      if (configs?.length) {
        await appClient.entities.AppSettings.update(configs[0].id, { payload: paymentMethods });
      } else {
        await appClient.entities.AppSettings.create({
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
      <DialogContent className="apple-type apple-surface-elevated max-w-5xl max-h-[90vh] shadow-apple-xl p-0 gap-0 flex flex-col rounded-apple-xl">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
              {/* Info Usuario */}
              <div className="apple-card rounded-apple-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-16 h-16 rounded-apple-lg bg-apple-blue/15 flex items-center justify-center">
                    <UserCircle className="w-10 h-10 text-apple-blue" />
                  </div>
                  <div className="flex-1">
                    <p className="apple-label-primary apple-text-title3">{displayUser.full_name || displayUser.email}</p>
                    <p className="apple-label-secondary apple-text-subheadline">{displayUser.email}</p>
                    <Badge className="bg-apple-blue/15 text-apple-blue apple-text-caption1 mt-1 rounded-apple-sm border-0">
                      {displayUser.role || "user"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Punch Status */}
              <div className="apple-card rounded-apple-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-apple-blue" />
                <span className="apple-label-primary apple-text-headline">Estado de Turno</span>
              </div>
              <Badge className={punchStatus
                ? "bg-apple-green/15 text-apple-green apple-text-caption1 rounded-apple-sm border-0"
                : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary apple-text-caption1 rounded-apple-sm border-0"
              }>
                {punchStatus ? "Activo" : "Inactivo"}
              </Badge>
            </div>

            {punchStatus && (
              <p className="apple-text-footnote apple-label-secondary mb-3 tabular-nums">
                Entrada: {formatPunchDateTime(punchStatus.clock_in)}
              </p>
            )}

            <Button
              onClick={handlePunchToggle}
              disabled={loading}
              className={`apple-btn w-full ${punchStatus ? "apple-btn-destructive" : "apple-btn-primary"}`}
            >
              {loading ? "..." : punchStatus ? "Cerrar Turno" : "Abrir Turno"}
            </Button>
          </div>

              {/* Logout Button */}
              <Button
                onClick={handleLogout}
                variant="outline"
                className="apple-btn apple-btn-destructive w-full"
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
