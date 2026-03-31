import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, Edit, Trash2, Search, UserPlus, 
  Mail, Phone, Code, Lock, Eye, EyeOff, 
  Calendar, Activity, X, Check, DollarSign,
  Users, Zap, AlertCircle, Clock,
  Building2, CreditCard, Wallet, BarChart3,
  Smartphone, FileText, Plus, Loader2, Sparkles,
  ExternalLink, Package
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import AdminAuthGate from "../components/users/AdminAuthGate";
import UserCard from "../components/users/UserCard";
import CreateUserModal from "../components/users/CreateUserModal";
import EditUserModal from "../components/users/EditUserModal";
import TimeTrackingModal from "../components/timetracking/TimeTrackingModal";
import TermsModalsManager from "../components/settings/TermsModalsManager";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { ensureTenantAdminUser } from "@/components/utils/adminBootstrap";
import EmployeeProfileDrawer from "../components/users/EmployeeProfileDrawer";

const ROLES = [
  { value: "admin",      label: "Administrador", color: "from-cyan-600 to-blue-600",   icon: Shield,     badge: "bg-cyan-500"  },
  { value: "technician", label: "Técnico",        color: "from-blue-600 to-blue-800",   icon: Activity,   badge: "bg-blue-500"  },
  { value: "cashier",    label: "Cajero",          color: "from-green-600 to-green-800", icon: DollarSign, badge: "bg-green-500" },
];

const ADMIN_CORE_PANEL_BUTTONS = [
  { id: "users", label: "Gestión de Usuarios", icon: "Users", gradient: "from-cyan-600 to-blue-600", view: "users", type: "view", enabled: true, order: 0 },
  { id: "time", label: "Control de Tiempo", icon: "Clock", gradient: "from-emerald-600 to-green-600", view: "time", type: "view", enabled: true, order: 1 },
  { id: "business_info", label: "Info del Negocio", icon: "Building2", gradient: "from-orange-600 to-amber-600", view: "business_info", type: "view", enabled: true, order: 2 },
  { id: "payment_methods", label: "Métodos de Pago", icon: "CreditCard", gradient: "from-green-600 to-emerald-600", view: "payment_methods", type: "view", enabled: true, order: 3 },
  { id: "inventory", label: "Inventario", icon: "Package", gradient: "from-teal-500 to-cyan-600", action: "Inventory", type: "navigate", enabled: true, order: 4 },
  { id: "suppliers", label: "Suplidores", icon: "Package", gradient: "from-indigo-600 to-blue-600", action: "Inventory", type: "navigate", enabled: true, order: 5 },
  { id: "financial", label: "Finanzas", icon: "Wallet", gradient: "from-purple-600 to-violet-600", action: "Financial", type: "navigate", enabled: true, order: 6 },
  { id: "reports", label: "Reportes", icon: "BarChart3", gradient: "from-indigo-600 to-blue-600", action: "Reports", type: "navigate", enabled: true, order: 7 },
  { id: "database", label: "Base de Datos", icon: "FileText", gradient: "from-slate-600 to-slate-800", action: "Settings", type: "navigate", enabled: true, order: 8 },
];

const LOCAL_USERS_STORAGE_KEY = "smartfix_local_users";
const SYSTEM_USER_EMAILS = new Set([
  "admin@smartfixos.com",
  "smartfixosapp@gmail.com"
  // NOTE: 911smartfix@gmail.com removed — es un email válido de tenant owner
]);

function getCurrentTenantId() {
  const fromStorage =
    localStorage.getItem("smartfix_tenant_id") ||
    localStorage.getItem("current_tenant_id");
  if (fromStorage) return fromStorage;

  const sessionCandidates = [
    sessionStorage.getItem("911-session"),
    localStorage.getItem("employee_session"),
    localStorage.getItem("smartfix_session")
  ];

  for (const raw of sessionCandidates) {
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      const tenantId =
        parsed?.tenant_id ||
        parsed?.tenantId ||
        parsed?.user?.tenant_id ||
        parsed?.session?.tenant_id;
      if (tenantId) return tenantId;
    } catch {}
  }

  return null;
}

function getSessionCandidates() {
  return [
    sessionStorage.getItem("911-session"),
    localStorage.getItem("employee_session"),
    localStorage.getItem("smartfix_session")
  ];
}

function readSessionIdentity() {
  for (const raw of getSessionCandidates()) {
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed) continue;
      const email = parsed?.email || parsed?.userEmail || parsed?.user?.email || null;
      const authId = parsed?.auth_id || parsed?.authId || parsed?.id || parsed?.userId || null;
      if (email || authId) {
        return {
          email: String(email || "").trim().toLowerCase() || null,
          authId: authId || null,
        };
      }
    } catch {}
  }
  return { email: null, authId: null };
}

async function resolveTenantIdFromSession() {
  const { email, authId } = readSessionIdentity();

  if (authId) {
    const { data: authUsers } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_id", authId)
      .not("tenant_id", "is", null)
      .limit(1);
    const authTenantId = authUsers?.[0]?.tenant_id || null;
    if (authTenantId) return authTenantId;
  }

  if (email) {
    const [{ data: userRows }, { data: employeeRows }] = await Promise.all([
      supabase
        .from("users")
        .select("tenant_id")
        .eq("email", email)
        .not("tenant_id", "is", null)
        .limit(1),
      supabase
        .from("app_employee")
        .select("tenant_id")
        .eq("email", email)
        .not("tenant_id", "is", null)
        .limit(1)
    ]);

    return userRows?.[0]?.tenant_id || employeeRows?.[0]?.tenant_id || null;
  }

  return null;
}

function readLocalUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    const tenantId = getCurrentTenantId();
    return parsed.filter((user) => {
      if (!user || user.active === false) return false;
      if (!tenantId) return true;
      return !user.tenant_id || String(user.tenant_id) === String(tenantId);
    });
  } catch {
    return [];
  }
}

function writeLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_STORAGE_KEY, JSON.stringify(users || []));
}

function isLocalUserId(userId) {
  return String(userId || "").startsWith("local-user-");
}

function isLikelyNetworkError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    error instanceof TypeError ||
    message.includes("load failed") ||
    message.includes("failed to fetch") ||
    message.includes("network")
  );
}

function getPlanUserLimitFromKey(plan) {
  const normalized = String(plan || "").trim().toLowerCase();
  if (normalized === "smartfixos" || normalized === "basic") return 1;
  if (normalized === "pro") return 3;
  if (normalized === "enterprise") return 999;
  return null;
}

function isSystemUserLike(candidate) {
  const fullName = String(candidate?.full_name || candidate?.name || "").trim().toLowerCase();
  const role = String(candidate?.role || candidate?.position || "").trim().toLowerCase();
  const email = String(candidate?.email || "").trim().toLowerCase();

  if (SYSTEM_USER_EMAILS.has(email)) return true;
  if (role === "super_admin" || role === "saas_owner" || role === "superadmin") return true;
  if (fullName.includes("smartfixos")) return true;
  if (fullName.includes("super admin")) return true;
  return false;
}

function getUserIdentityKeys(user) {
  const keys = [];
  if (user?.id) keys.push(`id:${String(user.id).toLowerCase()}`);
  if (user?.auth_id) keys.push(`auth:${String(user.auth_id).toLowerCase()}`);
  if (user?.email) keys.push(`email:${String(user.email).trim().toLowerCase()}`);
  if (user?.employee_code) keys.push(`code:${String(user.employee_code).trim().toLowerCase()}`);
  return keys;
}

function mergeUsers(remoteUsers = [], localUsers = []) {
  const merged = [];
  const keyToIndex = new Map();

  for (const candidate of [...(remoteUsers || []), ...(localUsers || [])]) {
    if (!candidate || candidate.active === false || isSystemUserLike(candidate)) continue;

    const keys = getUserIdentityKeys(candidate);
    const existingIndex = keys.map((key) => keyToIndex.get(key)).find((idx) => Number.isInteger(idx));

    if (Number.isInteger(existingIndex)) {
      merged[existingIndex] = {
        ...candidate,
        ...merged[existingIndex],
        entity_source: merged[existingIndex]?.entity_source || candidate.entity_source,
        position: merged[existingIndex]?.position || candidate.position,
        employee_code: merged[existingIndex]?.employee_code || candidate.employee_code,
        pin: merged[existingIndex]?.pin || candidate.pin,
        phone: merged[existingIndex]?.phone || candidate.phone,
        hourly_rate: merged[existingIndex]?.hourly_rate ?? candidate.hourly_rate,
        permissions: merged[existingIndex]?.permissions || candidate.permissions,
        tenant_id: merged[existingIndex]?.tenant_id || candidate.tenant_id,
      };
      getUserIdentityKeys(merged[existingIndex]).forEach((key) => keyToIndex.set(key, existingIndex));
      continue;
    }

    const nextIndex = merged.length;
    merged.push(candidate);
    keys.forEach((key) => keyToIndex.set(key, nextIndex));
  }

  return merged;
}

async function fetchTenantUsers() {
  let tenantId = getCurrentTenantId();

  const runQueries = async (currentTenantId) => {
    let usersQuery = supabase
      .from("users")
      .select("id, email, full_name, role, position, employee_code, pin, phone, hourly_rate, active, permissions, tenant_id, auth_id, created_at, updated_at")
      .eq("active", true);
    if (currentTenantId) usersQuery = usersQuery.eq("tenant_id", currentTenantId);

    let employeesQuery = supabase
      .from("app_employee")
      .select("id, email, full_name, role, position, employee_code, pin, phone, hourly_rate, active, permissions, tenant_id, created_at, updated_at")
      .eq("active", true);
    if (currentTenantId) employeesQuery = employeesQuery.eq("tenant_id", currentTenantId);

    const [{ data: userRows, error: usersError }, { data: employeeRows, error: employeesError }] = await Promise.all([
      usersQuery,
      employeesQuery,
    ]);

    if (usersError) throw usersError;
    if (employeesError) throw employeesError;

    return { userRows: userRows || [], employeeRows: employeeRows || [] };
  };

  let { userRows, employeeRows } = await runQueries(tenantId);

  if ((!userRows.length && !employeeRows.length) && tenantId) {
    const resolvedTenantId = await resolveTenantIdFromSession().catch(() => null);
    if (resolvedTenantId && String(resolvedTenantId) !== String(tenantId)) {
      localStorage.setItem("smartfix_tenant_id", resolvedTenantId);
      localStorage.setItem("current_tenant_id", resolvedTenantId);
      tenantId = resolvedTenantId;
      ({ userRows, employeeRows } = await runQueries(tenantId));
    }
  }

  const normalizedUsers = (userRows || []).map((user) => ({ ...user, entity_source: "users" }));
  const normalizedEmployees = (employeeRows || []).map((employee) => ({ ...employee, entity_source: "app_employee" }));

  return mergeUsers(normalizedUsers, normalizedEmployees);
}

function mergeAdminPanelButtons(savedButtons = []) {
  const cleaned = (savedButtons || []).filter(
    (btn) =>
      !String(btn.label || "").toLowerCase().includes("paga todo") &&
      btn.label !== "Panel Administrativo"
  );

  const savedMap = new Map(cleaned.map((b) => [b.id, b]));
  const customButtons = cleaned.filter(
    (b) => !ADMIN_CORE_PANEL_BUTTONS.some((d) => d.id === b.id)
  );

  const mergedDefaults = ADMIN_CORE_PANEL_BUTTONS.map((defaults, idx) => {
    const saved = savedMap.get(defaults.id) || {};
    return {
      ...saved,
      ...defaults,
      order: Number.isFinite(saved.order) ? saved.order : idx,
      enabled: true
    };
  });

  return [...mergedDefaults, ...customButtons]
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
    .map((b, idx) => ({ ...b, order: idx }));
}

export default function UsersManagement() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState(() => {
    try {
      const raw =
        sessionStorage.getItem("911-session") ||
        localStorage.getItem("employee_session");
      const session = raw ? JSON.parse(raw) : null;
      const role = session?.userRole || session?.role;
      return role === "admin" || role === "manager";
    } catch {
      return false;
    }
  });
  const [activeView, setActiveView] = useState("users"); // "users" = gestión usuarios, "time" = control tiempo
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [filterRole, setFilterRole] = useState("all");
  const [showTimeTracking, setShowTimeTracking] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [adminPanelButtons, setAdminPanelButtons] = useState([]);
  const [mainTab, setMainTab] = useState("equipo");
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [weekEntries, setWeekEntries] = useState([]);
  const [clockEntries, setClockEntries] = useState([]);
  const [clockLoading, setClockLoading] = useState(null);

  // Settings states
  const [appConfig, setAppConfig] = useState({
    business_name: "911 SmartFix",
    slogan: "Tu taller de confianza",
    business_phone: "",
    business_whatsapp: "",
    business_email: "",
    support_email: "",
    business_address: "",
    business_maps_link: "",
    instagram_link: "",
    facebook_link: "",
    tiktok_link: "",
    business_hours: {
      monday: { open: "09:00", close: "18:00", closed: false },
      tuesday: { open: "09:00", close: "18:00", closed: false },
      wednesday: { open: "09:00", close: "18:00", closed: false },
      thursday: { open: "09:00", close: "18:00", closed: false },
      friday: { open: "09:00", close: "18:00", closed: false },
      saturday: { open: "09:00", close: "14:00", closed: false },
      sunday: { open: "09:00", close: "18:00", closed: true }
    },
    hours_weekdays: "",
    tax_rate: 11.5,
    currency: "USD",
    timezone: "America/Puerto_Rico",
    language: "es",
    google_review_link: "",
    terms_repairs: "",
    terms_sales: "",
    warranty_sales: "",
    warranty_repairs: ""
  });
  const [paymentMethods, setPaymentMethods] = useState({
    cash: true,
    card: true,
    ath_movil: true,
    bank_transfer: false,
    check: false
  });
  const [customPaymentMethods, setCustomPaymentMethods] = useState([]);
  const [newCustomMethod, setNewCustomMethod] = useState("");

  useEffect(() => {
    if (authorized) {
      loadUsers();
      loadPendingRequests();
      checkUrlActions();
      loadSettings();
      loadAdminPanelButtons();
      loadClockEntries();
      loadWeekEntries();
    }

    const handleButtonsUpdate = () => {
      loadAdminPanelButtons();
    };

    window.addEventListener('admin-panel-buttons-updated', handleButtonsUpdate);
    return () => {
      window.removeEventListener('admin-panel-buttons-updated', handleButtonsUpdate);
    };
  }, [authorized]);

  // Load today's clock entries for the Tiempo tab
  const loadClockEntries = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("time_entry")
        .select("*")
        .gte("clock_in", today.toISOString())
        .order("clock_in", { ascending: false });
      setClockEntries(data || []);
    } catch (e) {
      console.error("Error loading clock entries:", e);
    }
  };

  // Load this week's completed entries for the Nómina tab
  const loadWeekEntries = async () => {
    try {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from("time_entry")
        .select("*")
        .gte("clock_in", weekStart.toISOString())
        .not("clock_out", "is", null);
      setWeekEntries(data || []);
    } catch (e) {
      console.error("Error loading week entries:", e);
    }
  };

  const handleClockIn = async (user) => {
    setClockLoading(user.id);
    try {
      const { data, error } = await supabase
        .from("time_entry")
        .insert({
          employee_id: user.id,
          employee_name: user.full_name,
          clock_in: new Date().toISOString(),
          tenant_id: getCurrentTenantId(),
        })
        .select()
        .single();
      if (error) throw error;
      setClockEntries(prev => [data, ...prev]);
      toast.success(`✅ Entrada registrada para ${user.full_name}`);
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar entrada");
    } finally {
      setClockLoading(null);
    }
  };

  const handleClockOut = async (user, entry) => {
    setClockLoading(user.id);
    try {
      const clockOutTime = new Date().toISOString();
      const totalHours = Math.round(
        ((new Date(clockOutTime) - new Date(entry.clock_in)) / 3600000) * 100
      ) / 100;
      const { error } = await supabase
        .from("time_entry")
        .update({ clock_out: clockOutTime, total_hours: totalHours })
        .eq("id", entry.id);
      if (error) throw error;
      setClockEntries(prev =>
        prev.map(e => e.id === entry.id ? { ...e, clock_out: clockOutTime, total_hours: totalHours } : e)
      );
      toast.success(`✅ Salida registrada — ${totalHours.toFixed(1)}h trabajadas`);
    } catch (e) {
      console.error(e);
      toast.error("Error al registrar salida");
    } finally {
      setClockLoading(null);
    }
  };

  const loadSettings = async () => {
    try {
      const [configRes, pmRes] = await Promise.all([
        dataClient.entities.AppSettings.filter({ slug: "app-main-settings" }),
        dataClient.entities.AppSettings.filter({ slug: "payment-methods" })
      ]);

      if (configRes?.length) {
        setAppConfig({ ...appConfig, ...configRes[0].payload });
      }
      if (pmRes?.length) {
        const saved = pmRes[0].payload;
        setPaymentMethods({ ...paymentMethods, ...saved });
        setCustomPaymentMethods(saved.custom_methods || []);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const loadAdminPanelButtons = async () => {
    try {
      const configs = await dataClient.entities.AppSettings.filter({ slug: "admin-panel-buttons" });
      
      if (configs?.length) {
        const savedButtons = configs[0].payload?.buttons || [];
        const merged = mergeAdminPanelButtons(savedButtons);
        setAdminPanelButtons(merged.filter(btn => btn.enabled).sort((a, b) => a.order - b.order));
      } else {
        setAdminPanelButtons(mergeAdminPanelButtons([]));
      }
    } catch (error) {
      console.error("Error loading admin panel buttons:", error);
      setAdminPanelButtons(mergeAdminPanelButtons([]));
    }
  };

  const checkUrlActions = async () => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    const id = params.get("id");

    if (action && id) {
      if (action === "approve") {
        await handleApproveRequest(id);
      } else if (action === "reject") {
        await handleRejectRequest(id);
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const tenantId = getCurrentTenantId();
      const filterCond = tenantId ? { status: "pending", tenant_id: tenantId } : { status: "pending" };
      const pending = await dataClient.entities.AppEmployee.filter(filterCond);
      setPendingRequests(pending || []);
    } catch (error) {
      console.error("Error loading pending requests:", error);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const tenantId = getCurrentTenantId();
      if (tenantId) {
        const rawSession =
          sessionStorage.getItem("911-session") ||
          localStorage.getItem("employee_session");
        let parsedSession = null;
        try {
          parsedSession = rawSession ? JSON.parse(rawSession) : null;
        } catch {}

        await ensureTenantAdminUser(supabase, tenantId, parsedSession);
      }

      const allUsers = await fetchTenantUsers();
      const localUsers = readLocalUsers();
      setUsers(mergeUsers(allUsers || [], localUsers));
    } catch (error) {
      console.error("Error loading users:", error);
      const localUsers = readLocalUsers();
      if (localUsers.length > 0) {
        setUsers(localUsers);
        toast.warning("Sin conexión al servidor. Mostrando usuarios locales.");
      } else {
        toast.error("Error al cargar usuarios");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (userData) => {
    // ── Verificar límite de usuarios del plan ────────────────────────────────
    try {
      const tenantId = localStorage.getItem("smartfix_tenant_id");
      if (tenantId) {
        const { data: tenantData } = await supabase
          .from("tenant")
          .select("plan, metadata")
          .eq("id", tenantId)
          .single();

        let subscriptionPlan = null;
        try {
          const { data: subscriptionData } = await supabase
            .from("subscription")
            .select("plan, status")
            .eq("tenant_id", tenantId)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1);
          subscriptionPlan = subscriptionData?.[0]?.plan || null;
        } catch {}

        const metadataLimit = Number(tenantData?.metadata?.max_users || 0) || null;
        const tenantPlanLimit = getPlanUserLimitFromKey(tenantData?.plan);
        const subscriptionPlanLimit = getPlanUserLimitFromKey(subscriptionPlan);
        const maxUsers = Math.max(
          metadataLimit || 0,
          tenantPlanLimit || 0,
          subscriptionPlanLimit || 0
        ) || 999;

        if (maxUsers < 999) {
          const currentUsers = await fetchTenantUsers();
          const currentCount = (currentUsers || []).length;

          if (currentCount >= maxUsers) {
            const planLabels = { 1: "Basic (1 usuario)", 3: "Pro (3 usuarios)" };
            const currentPlan = planLabels[maxUsers] || `tu plan actual`;
            const nextStep = maxUsers === 1 ? "Pro ($85/mo)" : maxUsers === 3 ? "Enterprise" : "un plan superior";
            toast.error(
              `⚠️ Límite alcanzado: ${currentPlan} solo permite ${maxUsers} usuario${maxUsers === 1 ? "" : "s"}. Contacta al soporte para subir a ${nextStep}.`,
              { duration: 8000 }
            );
            return;
          }
        }
      }
    } catch (limitErr) {
      console.warn("No se pudo verificar límite del plan:", limitErr.message);
      // No bloquear — si falla la verificación, dejar pasar
    }

    try {
      const existing = await fetchTenantUsers().catch(() => []);
      const localUsers = readLocalUsers();
      const normalizedEmail = String(userData.email || "").trim().toLowerCase();
      const existsRemoteDuplicate = (existing || []).some((u) =>
        normalizedEmail && String(u.email || "").trim().toLowerCase() === normalizedEmail
      );
      const existsLocalCode = localUsers.some(
        (u) => normalizedEmail && String(u.email || "").trim().toLowerCase() === normalizedEmail
      );

      if (existsRemoteDuplicate || existsLocalCode) {
        toast.error("Ya existe un usuario con ese email");
        return;
      }

      const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const resolvedTenantId = getCurrentTenantId() || await resolveTenantIdFromSession().catch(() => null);
      if (!resolvedTenantId) {
        toast.error("No se pudo identificar la tienda para este usuario. Vuelve a entrar e intenta otra vez.");
        return;
      }

      localStorage.setItem("smartfix_tenant_id", resolvedTenantId);
      localStorage.setItem("current_tenant_id", resolvedTenantId);

      const cleanData = {
        full_name: userData.full_name,
        email: userData.email,
        phone: userData.phone || "",
        role: userData.customRole,
        position: userData.customRole,
        employee_code: userData.employee_code,
        pin: userData.pin,
        hourly_rate: parseFloat(userData.hourly_rate) || 0,
        tenant_id: resolvedTenantId,
        active: true,
        status: "pending",
        portal_access_enabled: false,
        activation_token: token,
        activation_expires_at: expiresAt
      };

      let newUser = null;
      try {
        const { data: createdRows, error: createError } = await supabase
          .from("app_employee")
          .insert(cleanData)
          .select("*")
          .limit(1);

        if (createError) throw createError;
        newUser = createdRows?.[0] || null;
        if (newUser) newUser.entity_source = "app_employee";
      } catch (createError) {
        if (!isLikelyNetworkError(createError)) throw createError;

        const localUser = {
          id: `local-user-${Date.now()}`,
          ...cleanData,
          entity_source: "local",
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString()
        };
        const nextLocalUsers = [...localUsers, localUser];
        writeLocalUsers(nextLocalUsers);
        newUser = localUser;
        toast.warning("Usuario creado en modo local (sin conexión al servidor).");
      }

      // Algunos backends pueden responder 2xx sin payload de entidad.
      // Si no vino user/id, persistimos local para no romper el flujo.
      if (!newUser || !newUser.id) {
        const localUser = {
          id: `local-user-${Date.now()}`,
          ...cleanData,
          entity_source: "local",
          created_date: new Date().toISOString(),
          updated_date: new Date().toISOString()
        };
        const alreadyExists = localUsers.some((u) => u.id === localUser.id);
        if (!alreadyExists) {
          writeLocalUsers([...localUsers, localUser]);
        }
        newUser = localUser;
        toast.warning("Usuario creado en modo local (respuesta incompleta del servidor).");
      }

      if (!isLocalUserId(newUser.id)) {
        await dataClient.entities.AuditLog.create({
          action: "create_user",
          entity_type: "user",
          entity_id: newUser.id,
          changes: { after: cleanData },
          severity: "info"
        }).catch(() => {}); // Ignorar errores del log
      }

      if (newUser?.email && !isLocalUserId(newUser.id)) {
        try {
          await sendApprovalEmail(newUser, token);
          toast.success("✅ Usuario creado e invitación enviada");
        } catch (mailError) {
          console.error("Error sending invite email:", mailError);
          toast.warning("Usuario creado, pero no se pudo enviar la invitación por email");
        }
      } else {
        toast.success("✅ Usuario creado exitosamente");
      }

      setShowCreateModal(false);
      await loadUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Error al crear usuario: " + (error.message || "Intenta nuevamente"));
    }
  };

  const handleUpdateUser = async (userId, userData) => {
    try {
      // Preparar datos - role solo acepta 'admin' o 'user'
      const cleanData = {
        full_name: userData.full_name,
        email: userData.email,
        phone: userData.phone || "",
        role: userData.customRole,
        position: userData.customRole,
        hourly_rate: parseFloat(userData.hourly_rate) || 0,
        active: userData.active !== false
      };
      
      // Solo agregar PIN si se proporcionó uno nuevo
      if (userData.pin?.trim()) {
        cleanData.pin = userData.pin;
      }

      if (isLocalUserId(userId)) {
        const localUsers = readLocalUsers();
        const updatedLocalUsers = localUsers.map((u) =>
          u.id === userId ? { ...u, ...cleanData, updated_date: new Date().toISOString() } : u
        );
        writeLocalUsers(updatedLocalUsers);
      } else if (editingUser?.entity_source === "app_employee") {
        const { error: updateError } = await supabase
          .from("app_employee")
          .update(cleanData)
          .eq("id", userId);
        if (updateError) throw updateError;
      } else {
        await dataClient.entities.User.update(userId, cleanData);
      }
      toast.success("✅ Usuario actualizado");
      
      if (!isLocalUserId(userId)) {
        await dataClient.entities.AuditLog.create({
          action: "update_user",
          entity_type: "user",
          entity_id: userId,
          changes: { after: cleanData },
          severity: "info"
        }).catch(() => {});
      }

      setEditingUser(null);
      await loadUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Error al actualizar: " + (error.message || "Intenta nuevamente"));
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`⚠️ ¿ELIMINAR PERMANENTEMENTE a ${user.full_name}?\n\nEsta acción NO se puede deshacer.`)) return;

    try {
      if (isLocalUserId(user.id)) {
        const localUsers = readLocalUsers().filter((u) => u.id !== user.id);
        writeLocalUsers(localUsers);
      } else if (user.entity_source === "app_employee") {
        const { error: deleteError } = await supabase
          .from("app_employee")
          .delete()
          .eq("id", user.id);
        if (deleteError) throw deleteError;
      } else {
        await dataClient.entities.User.delete(user.id);
        await dataClient.entities.AuditLog.create({
          action: "delete_user",
          entity_type: "user",
          entity_id: user.id,
          changes: {
            before: {
              full_name: user.full_name,
              email: user.email,
              role: user.role,
              employee_code: user.employee_code
            }
          },
          severity: "warning"
        });
      }

      toast.success("✅ Usuario eliminado");
      setUsers(users.filter(u => u.id !== user.id));
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Error al eliminar usuario");
    }
  };

  const handleToggleActive = async (user) => {
    try {
      const currentUser = await dataClient.auth.me();
      const newActiveState = !user.active;
      
      if (isLocalUserId(user.id)) {
        const localUsers = readLocalUsers();
        const updatedLocalUsers = localUsers.map((u) =>
          u.id === user.id ? { ...u, active: newActiveState, updated_date: new Date().toISOString() } : u
        );
        writeLocalUsers(updatedLocalUsers);
      } else if (user.entity_source === "app_employee") {
        const { error: updateError } = await supabase
          .from("app_employee")
          .update({ active: newActiveState })
          .eq("id", user.id);
        if (updateError) throw updateError;
      } else if (currentUser?.id === user.id) {
        await dataClient.auth.updateMe({ active: newActiveState });
      } else {
        await dataClient.entities.User.update(user.id, { active: newActiveState });
      }
      
      toast.success(user.active ? "Usuario desactivado" : "Usuario activado");
      setUsers(users.map(u => u.id === user.id ? {...u, active: newActiveState} : u));
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast.error("Error al cambiar estado");
    }
  };

  const handleApproveRequest = async (employeeId) => {
    try {
      const employee = await dataClient.entities.AppEmployee.filter({ id: employeeId });
      if (!employee || employee.length === 0) {
        toast.error("Solicitud no encontrada");
        return;
      }

      const emp = employee[0];
      const token = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      await dataClient.entities.AppEmployee.update(employeeId, {
        status: "approved",
        activation_token: token,
        activation_expires_at: expiresAt
      });

      // Enviar email con link de activación
      await sendApprovalEmail(emp, token);

      toast.success(`✅ Solicitud de ${emp.full_name} aprobada`);
      await loadPendingRequests();
    } catch (error) {
      console.error("Error approving request:", error);
      toast.error("Error al aprobar solicitud");
    }
  };

  const handleRejectRequest = async (employeeId) => {
    if (!confirm("¿Rechazar esta solicitud de acceso?")) return;

    try {
      await dataClient.entities.AppEmployee.delete(employeeId);
      toast.success("Solicitud rechazada");
      await loadPendingRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Error al rechazar solicitud");
    }
  };

  const handleResendInvitation = async (user) => {
    if (!user?.email) {
      toast.error("Este empleado no tiene email registrado. Edítalo primero.");
      return;
    }
    try {
      const newToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const newExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from("app_employee")
        .update({
          activation_token: newToken,
          activation_expires_at: newExpiresAt,
          status: "pending"
        })
        .eq("id", user.id);

      if (error) throw error;

      await sendApprovalEmail(user, newToken);
      toast.success(`✅ Invitación reenviada a ${user.email}`);
    } catch (err) {
      console.error("Error resending invitation:", err);
      toast.error("No se pudo reenviar la invitación. Intenta nuevamente.");
    }
  };

  const sendApprovalEmail = async (employee, token) => {
    const activationUrl = `${window.location.origin}/Activate?token=${token}`;
    const approvalDate = new Date().toLocaleDateString('es-PR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const emailBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; padding: 0; background: #ffffff;">
        <!-- Header con logo y estado -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px 30px; text-align: center; border-radius: 0;">
          <div style="background: white; width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h1 style="color: white; font-size: 28px; margin: 0; font-weight: 600; letter-spacing: -0.5px;">Invitación de Acceso</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Tu cuenta fue creada en SmartFixOS</p>
        </div>

        <!-- Contenido principal -->
        <div style="padding: 40px 30px; background: white;">
          <h2 style="color: #1f2937; font-size: 22px; margin: 0 0 15px 0; font-weight: 600;">¡Hola ${employee.full_name}! 👋</h2>
          
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 0 0 25px 0;">
            El administrador creó tu acceso al sistema el día <strong>${approvalDate}</strong>. Para entrar, primero debes activar tu cuenta y definir tu propio PIN.
          </p>

          <!-- Resumen de información -->
          <div style="background: #f9fafb; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 4px;">
            <h3 style="color: #1f2937; font-size: 16px; margin: 0 0 15px 0; font-weight: 600;">📋 Resumen de tu Solicitud</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">Nombre Completo:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${employee.full_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Email:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${employee.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Teléfono:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${employee.phone}</td>
              </tr>
              ${employee.store_branch ? `
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Sucursal:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${employee.store_branch}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Código de Empleado:</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${employee.employee_code}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Fecha de Invitación:</td>
                <td style="padding: 8px 0; color: #10b981; font-size: 14px; font-weight: 600;">${approvalDate}</td>
              </tr>
            </table>
          </div>

          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin: 25px 0;">
            Para completar el proceso de registro, debes <strong>activar tu cuenta</strong> haciendo clic en el siguiente botón:
          </p>

          <!-- Botón de activación -->
          <div style="text-align: center; margin: 35px 0;">
            <a href="${activationUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 18px 45px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 16px rgba(16,185,129,0.3); transition: all 0.3s ease;">
              🚀 Activar Mi Cuenta Ahora
            </a>
          </div>

          <!-- Instrucciones alternativas -->
          <div style="background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <p style="color: #92400e; font-size: 14px; margin: 0 0 10px 0; font-weight: 600;">
              ℹ️ ¿No funciona el botón?
            </p>
            <p style="color: #92400e; font-size: 13px; margin: 0 0 10px 0;">
              Copia y pega el siguiente enlace en tu navegador:
            </p>
            <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid #fcd34d; word-break: break-all;">
              <a href="${activationUrl}" style="color: #059669; font-size: 12px; text-decoration: none;">${activationUrl}</a>
            </div>
          </div>

          <!-- Aviso de expiración -->
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 25px 0; border-radius: 4px;">
            <p style="color: #991b1b; font-size: 14px; margin: 0; font-weight: 500;">
              ⏰ <strong>Importante:</strong> Este enlace de activación expira en <strong>48 horas</strong>. Si no activas tu cuenta dentro de este período, deberás solicitar acceso nuevamente.
            </p>
          </div>

          <!-- Próximos pasos -->
          <div style="margin-top: 30px; padding-top: 25px; border-top: 2px solid #e5e7eb;">
            <h3 style="color: #1f2937; font-size: 18px; margin: 0 0 15px 0; font-weight: 600;">📌 Próximos Pasos</h3>
            <ol style="color: #4b5563; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
              <li style="margin-bottom: 10px;">Haz clic en el botón "Activar Mi Cuenta Ahora"</li>
              <li style="margin-bottom: 10px;">Crea tu <strong>PIN de 4 dígitos</strong> para acceso rápido</li>
              <li style="margin-bottom: 10px;">Completa la configuración de tu perfil</li>
              <li>¡Comienza a usar SmartFixOS!</li>
            </ol>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 10px 0;">
            Si no solicitaste este acceso, por favor ignora este mensaje o contacta al administrador del sistema.
          </p>
          <p style="color: #9ca3af; font-size: 12px; margin: 15px 0 0 0;">
            © ${new Date().getFullYear()} SmartFixOS • Sistema de Gestión de Reparaciones<br>
            Este es un correo automático, por favor no respondas a este mensaje.
          </p>
        </div>
      </div>
    `;

    await dataClient.mail.send({
      to: employee.email,
      from_name: "SmartFixOS - Sistema de Gestión",
      subject: "✅ Activación de tu cuenta en SmartFixOS",
      body: emailBody
    });
  };

  const saveAppConfig = async () => {
    setLoading(true);
    try {
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
      toast.success("✅ Configuración guardada");
    } catch (error) {
      toast.error("Error al guardar");
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

  const filteredUsers = users.filter(user => {
    const search = searchTerm.toLowerCase();
    const userRole = user.position || user.role; // Usar position como rol principal
    const matchesSearch = (
      user.full_name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.employee_code?.toLowerCase().includes(search) ||
      userRole?.toLowerCase().includes(search)
    );
    const matchesRole = filterRole === "all" || userRole === filterRole;
    return matchesSearch && matchesRole;
  });

  const activeUsers = users.filter(u => u.active !== false);
  const inactiveUsers = users.filter(u => u.active === false);

  const getRoleCounts = () => {
    const counts = {};
    ROLES.forEach(role => {
      counts[role.value] = users.filter(u => (u.position || u.role) === role.value).length;
    });
    return counts;
  };

  const roleCounts = getRoleCounts();

  // ── Nómina computed ──────────────────────────────────────────────────────
  const totalWeekHours = weekEntries.reduce((s, e) => s + Number(e.total_hours || 0), 0);
  const totalWeekPay = users.reduce((s, u) => {
    const uHrs = weekEntries
      .filter(e => e.employee_id === u.id)
      .reduce((h, e) => h + Number(e.total_hours || 0), 0);
    return s + uHrs * Number(u.hourly_rate || 0);
  }, 0);

  if (!authorized) {
    return <AdminAuthGate onSuccess={() => setAuthorized(true)} />;
  }

  // Vista de Control de Tiempo
  if (activeView === "time") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 p-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => setActiveView("users")}
            className="flex items-center gap-2 text-white/50 hover:text-white mb-6 text-sm font-bold transition-colors"
          >
            <X className="w-4 h-4" /> Volver
          </button>
          <TimeTrackingModal open={true} onClose={() => setActiveView("users")} />
        </div>
      </div>
    );
  }

  // Vista de Información del Negocio
  if (activeView === "business_info") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-orange-950 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => setActiveView("users")}
            className="flex items-center gap-2 text-white/50 hover:text-white mb-6 text-sm font-bold transition-colors">
            <X className="w-4 h-4" /> Volver
          </button>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-orange-600/10 to-amber-600/10 backdrop-blur-xl border border-orange-500/20 rounded-2xl p-6 mb-6 shadow-[0_8px_32px_rgba(251,146,60,0.4)] theme-light:bg-white theme-light:border-gray-200">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg">
                  <Building2 className="w-9 h-9 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white theme-light:text-gray-900">Información del Negocio</h1>
                  <p className="text-orange-200/80 theme-light:text-gray-600">Datos básicos de tu empresa</p>
                </div>
              </div>
            </div>

            <div className="bg-black/40 border border-orange-500/20 p-6 rounded-2xl theme-light:bg-white theme-light:border-gray-200">
              <div className="space-y-4">
                <div>
                  <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Nombre del Negocio *</label>
                  <Input 
                    value={appConfig.business_name} 
                    onChange={(e) => setAppConfig({...appConfig, business_name: e.target.value})} 
                    placeholder="911 SmartFix"
                    className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                  />
                </div>
                <div className="border-t border-white/10 pt-4 theme-light:border-gray-200">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2 theme-light:text-gray-900">
                    <Smartphone className="w-5 h-5 text-orange-400" />
                    Contacto
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Teléfono Principal *</label>
                      <Input 
                        value={appConfig.business_phone} 
                        onChange={(e) => setAppConfig({...appConfig, business_phone: e.target.value})} 
                        placeholder="(787) 555-1234" 
                        className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                      />
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700 flex items-center gap-2">
                        💬 WhatsApp
                        <Badge className="bg-green-500/20 text-green-300 text-xs theme-light:bg-green-100 theme-light:text-green-700">
                          Para Emails
                        </Badge>
                      </label>
                      <Input 
                        value={appConfig.business_whatsapp} 
                        onChange={(e) => setAppConfig({...appConfig, business_whatsapp: e.target.value})} 
                        placeholder="+17875551234 o 7875551234" 
                        className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                      />
                      <p className="text-xs text-gray-400 mt-2 theme-light:text-gray-600">
                        💡 Aparecerá como botón de contacto en todos los emails
                      </p>
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Email Principal *</label>
                      <Input 
                        value={appConfig.business_email} 
                        onChange={(e) => setAppConfig({...appConfig, business_email: e.target.value})} 
                        placeholder="contacto@911smartfix.com"
                        className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                      />
                    </div>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-4 theme-light:border-gray-200">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2 theme-light:text-gray-900">
                    <Building2 className="w-5 h-5 text-orange-400" />
                    Ubicación y Horarios
                  </h4>
                  <div className="space-y-4">
                    <div>
                        <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Dirección Física</label>
                        <Input 
                          value={appConfig.business_address} 
                          onChange={(e) => setAppConfig({...appConfig, business_address: e.target.value})} 
                          placeholder="123 Calle Principal, San Juan, PR 00901"
                          className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                        />
                      </div>
                      <div>
                        <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Horarios por Día</label>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                            const dayLabel = { monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo' }[day];
                            const hours = appConfig.business_hours[day];
                            return (
                              <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 bg-black/20 rounded-lg border border-white/5 theme-light:bg-gray-50 theme-light:border-gray-200">
                                <span className="text-gray-300 text-sm font-medium w-20 theme-light:text-gray-700">{dayLabel}</span>
                                {!hours.closed ? (
                                  <div className="flex items-center gap-2 flex-1">
                                    <input 
                                      type="time" 
                                      value={hours.open}
                                      onChange={(e) => setAppConfig({
                                        ...appConfig, 
                                        business_hours: {...appConfig.business_hours, [day]: {...hours, open: e.target.value}}
                                      })}
                                      className="bg-black/40 border border-white/10 text-white rounded px-2 py-2 text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                                    />
                                    <span className="text-gray-400">—</span>
                                    <input 
                                      type="time" 
                                      value={hours.close}
                                      onChange={(e) => setAppConfig({
                                        ...appConfig, 
                                        business_hours: {...appConfig.business_hours, [day]: {...hours, close: e.target.value}}
                                      })}
                                      className="bg-black/40 border border-white/10 text-white rounded px-2 py-2 text-sm theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                                    />
                                  </div>
                                ) : (
                                  <span className="text-red-400 text-sm font-bold flex-1">Cerrado</span>
                                )}
                                <button
                                  onClick={() => setAppConfig({
                                    ...appConfig,
                                    business_hours: {...appConfig.business_hours, [day]: {...hours, closed: !hours.closed}}
                                  })}
                                  className={`px-3 py-2 text-xs font-bold rounded transition-colors ${hours.closed ? 'bg-green-600/30 text-green-400 hover:bg-green-600/50' : 'bg-red-600/30 text-red-400 hover:bg-red-600/50'}`}
                                >
                                  {hours.closed ? 'Abrir' : 'Cerrar'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    </div>
                
                <div className="border-t border-white/10 pt-4 theme-light:border-gray-200">
                   <h4 className="text-white font-bold mb-3 flex items-center gap-2 theme-light:text-gray-900">
                     <Sparkles className="w-5 h-5 text-amber-400" />
                     Reseñas y Reputación
                   </h4>
                   <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700 flex items-center gap-2">
                     ⭐ Link de Reseñas de Google
                     <Badge className="bg-amber-500/20 text-amber-300 text-xs theme-light:bg-amber-100 theme-light:text-amber-700">
                       Opcional
                     </Badge>
                   </label>
                   <Input 
                     value={appConfig.google_review_link} 
                     onChange={(e) => setAppConfig({...appConfig, google_review_link: e.target.value})} 
                     placeholder="https://g.page/r/..." 
                     className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                   />
                   <p className="text-xs text-gray-400 mt-2 theme-light:text-gray-600">
                     💡 Botón de reseña en emails cuando la orden sea entregada
                   </p>
                 </div>

                <div className="border-t border-white/10 pt-4 theme-light:border-gray-200">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2 theme-light:text-gray-900">
                    <Mail className="w-5 h-5 text-cyan-400" />
                    Configuración Interna
                  </h4>
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block theme-light:text-gray-700">Email para Solicitudes de Acceso</label>
                    <Input 
                      value={appConfig.access_request_email || ""} 
                      onChange={(e) => setAppConfig({...appConfig, access_request_email: e.target.value})} 
                      placeholder="smartfixosapp@gmail.com"
                      className="bg-black/30 border-white/10 text-white h-12 theme-light:bg-white theme-light:border-gray-300" 
                    />
                    <p className="text-xs text-gray-400 mt-2 theme-light:text-gray-600">
                      💡 Las solicitudes de nuevos empleados se enviarán a este correo
                    </p>
                  </div>
                </div>

                <TermsModalsManager 
                  appConfig={appConfig} 
                  setAppConfig={setAppConfig} 
                  saveAppConfig={saveAppConfig}
                  loading={loading}
                />
              </div>
            </div>
            
            <Button onClick={saveAppConfig} disabled={loading} className="w-full bg-gradient-to-r from-orange-600 to-amber-600 h-14 text-lg font-bold shadow-lg">
              {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Guardando...</> : <>Guardar Cambios</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Vista de Métodos de Pago
  if (activeView === "payment_methods") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-green-950 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => setActiveView("users")}
            className="flex items-center gap-2 text-white/50 hover:text-white mb-6 text-sm font-bold transition-colors">
            <X className="w-4 h-4" /> Volver</button>
          <div className="hidden">
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-br from-green-600/10 to-emerald-600/10 backdrop-blur-xl border border-green-500/20 rounded-2xl p-6 mb-6 shadow-[0_8px_32px_rgba(34,197,94,0.4)]">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <CreditCard className="w-9 h-9 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-white theme-light:text-gray-900">Métodos de Pago</h1>
                  <p className="text-green-200/80 theme-light:text-gray-600">Configurar formas de pago</p>
                </div>
              </div>
            </div>

            {/* Métodos predefinidos */}
            <div className="bg-black/40 border border-green-500/20 p-6 rounded-2xl theme-light:bg-white theme-light:border-gray-200">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
                <CreditCard className="w-5 h-5 text-emerald-400" />
                Métodos de Pago Predefinidos
              </h3>
              <div className="space-y-3">
                {[
                  {key: "cash", label: "Efectivo", icon: Wallet, color: "emerald"},
                  {key: "card", label: "Tarjeta de Crédito/Débito", icon: CreditCard, color: "blue"},
                  {key: "ath_movil", label: "ATH Móvil", icon: Smartphone, color: "orange"},
                  {key: "bank_transfer", label: "Transferencia Bancaria", icon: Building2, color: "purple"},
                  {key: "check", label: "Cheque", icon: FileText, color: "gray"}
                ].map((method) => {
                  const Icon = method.icon;
                  return (
                    <label key={method.key} className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethods[method.key] ? "bg-gradient-to-r from-emerald-600/20 to-green-600/20 border-emerald-500/40 shadow-lg" : "bg-black/20 border-white/10 hover:bg-white/5"} theme-light:bg-gray-50 theme-light:border-gray-200`}>
                      <input type="checkbox" checked={paymentMethods[method.key]} onChange={(e) => setPaymentMethods({...paymentMethods, [method.key]: e.target.checked})} className="hidden" />
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${paymentMethods[method.key] ? "bg-emerald-600 border-emerald-600" : "border-gray-500"}`}>
                        {paymentMethods[method.key] && <Check className="w-4 h-4 text-white" />}
                      </div>
                      <Icon className="w-6 h-6 text-gray-400" />
                      <span className="text-white font-medium flex-1 theme-light:text-gray-900">{method.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Métodos personalizados */}
            <div className="bg-black/40 border border-green-500/20 p-6 rounded-2xl theme-light:bg-white theme-light:border-gray-200">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2 theme-light:text-gray-900">
                <Plus className="w-5 h-5 text-green-400" />
                Métodos Personalizados
              </h3>
              <p className="text-xs text-gray-400 mb-4 theme-light:text-gray-600">
                Agrega métodos de pago adicionales como PayPal, Zelle, Venmo, etc.
              </p>

              {/* Input para agregar */}
              <div className="flex gap-2 mb-4">
                <Input
                  value={newCustomMethod}
                  onChange={(e) => setNewCustomMethod(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomMethod()}
                  placeholder="Ej: PayPal, Zelle, Venmo..."
                  className="flex-1 bg-black/30 border-white/10 text-white theme-light:bg-white theme-light:border-gray-300"
                />
                <Button
                  onClick={addCustomMethod}
                  className="bg-gradient-to-r from-green-600 to-emerald-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar
                </Button>
              </div>

              {/* Lista de métodos personalizados */}
              {customPaymentMethods.length > 0 && (
                <div className="space-y-2">
                  {customPaymentMethods.map((method, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/40 rounded-xl shadow-lg theme-light:bg-green-50 theme-light:border-green-300"
                    >
                      <div className="w-6 h-6 rounded-lg bg-green-600 border-2 border-green-600 flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                      <DollarSign className="w-5 h-5 text-green-400" />
                      <span className="text-white font-medium flex-1 theme-light:text-gray-900">
                        {method}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCustomMethod(index)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-600/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {customPaymentMethods.length === 0 && (
                <div className="bg-blue-600/10 border border-blue-500/20 rounded-lg p-4 text-center theme-light:bg-blue-50 theme-light:border-blue-300">
                  <p className="text-blue-300 text-sm theme-light:text-blue-700">
                    No hay métodos personalizados aún
                  </p>
                </div>
              )}
            </div>

            <Button onClick={savePaymentMethods} disabled={loading} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 h-14 text-lg font-bold shadow-lg">
              {loading ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Guardando...</> : <>Guardar Métodos de Pago</>}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black/95 p-4 sm:p-6 lg:p-8 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Apple Style */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 shadow-2xl flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Gestión de Usuarios</h1>
              <p className="text-base text-gray-400 font-medium">Administra el equipo y sus roles</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(-1)}
            size="icon"
            variant="ghost"
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* ── Tab navigation ── */}
        <div className="flex gap-1 bg-white/[0.04] border border-white/[0.07] rounded-2xl p-1 mb-6">
          {[
            { id: "equipo", label: "Equipo", icon: Users },
            { id: "nomina", label: "Nómina", icon: DollarSign },
            { id: "tiempo", label: "Tiempo", icon: Clock },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                mainTab === t.id
                  ? "bg-white/[0.1] text-white shadow-sm"
                  : "text-white/35 hover:text-white/60"
              }`}
            >
              <t.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ══ TAB: EQUIPO ══ */}
        {mainTab === "equipo" && (
          <>
            {/* Barra de búsqueda y acciones */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, email, código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 bg-white/5 border-white/10 text-white"
                />
              </div>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="w-full sm:w-auto h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-lg"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                Crear Empleado
              </Button>
            </div>

            {/* Grid de Usuarios */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white/[0.04] border border-white/[0.07] rounded-[22px] p-5 animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-[52px] h-[52px] rounded-[16px] bg-white/10" />
                      <div className="flex-1">
                        <div className="h-4 bg-white/10 rounded w-28 mb-2" />
                        <div className="h-3 bg-white/[0.06] rounded w-20" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-3xl p-16 text-center">
                <AlertCircle className="w-10 h-10 text-white/15 mx-auto mb-4" />
                <p className="text-white/30 text-base font-semibold">
                  {searchTerm ? "No se encontraron empleados" : "No hay empleados creados"}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredUsers.map((user) => (
                  <UserCard
                    key={user.id}
                    user={user}
                    roles={ROLES}
                    onClick={() => setSelectedEmployee(user)}
                    onEdit={() => setEditingUser(user)}
                    onDelete={() => handleDeleteUser(user)}
                    onToggleActive={() => handleToggleActive(user)}
                    onResendInvite={() => handleResendInvitation(user)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ══ TAB: NÓMINA ══ */}
        {mainTab === "nomina" && (
          <div className="space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 text-center">
                <p className="text-white font-black text-2xl">{users.length}</p>
                <p className="text-white/35 text-[11px] font-bold uppercase tracking-wide mt-0.5">Empleados</p>
              </div>
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 text-center">
                <p className="text-white font-black text-2xl">{totalWeekHours.toFixed(1)}</p>
                <p className="text-white/35 text-[11px] font-bold uppercase tracking-wide mt-0.5">Hrs semana</p>
              </div>
              <div className="bg-emerald-500/[0.08] border border-emerald-500/20 rounded-2xl p-4 text-center">
                <p className="text-emerald-400 font-black text-2xl">${totalWeekPay.toFixed(0)}</p>
                <p className="text-white/35 text-[11px] font-bold uppercase tracking-wide mt-0.5">A pagar</p>
              </div>
            </div>

            <p className="text-white/25 text-xs font-bold uppercase tracking-widest px-1">
              Horas completadas — últimos 7 días
            </p>

            {users.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm font-semibold">Sin empleados registrados</p>
              </div>
            ) : (
              users.map(user => {
                const userEntries = weekEntries.filter(e => e.employee_id === user.id);
                const hours = userEntries.reduce((s, e) => s + Number(e.total_hours || 0), 0);
                const rate = Number(user.hourly_rate || 0);
                const amount = hours * rate;
                const roleInfo = ROLES.find(r => r.value === (user.position || user.role));
                const nameParts = (user.full_name || "").split(" ").filter(Boolean);
                const initials = nameParts.length >= 2
                  ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                  : (nameParts[0]?.[0] || "?").toUpperCase();

                return (
                  <div
                    key={user.id}
                    className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-4 flex items-center gap-4"
                  >
                    <div className={`w-11 h-11 rounded-[14px] bg-gradient-to-br ${roleInfo?.color || "from-slate-500 to-slate-700"} flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white font-black text-sm">{initials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{user.full_name}</p>
                      <p className="text-white/35 text-xs mt-0.5">
                        {hours.toFixed(1)}h
                        {rate > 0 ? ` × $${rate.toFixed(2)}/hr` : " (sin tarifa)"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`font-black text-base ${amount > 0 ? "text-emerald-400" : "text-white/30"}`}>
                        ${amount.toFixed(2)}
                      </p>
                      <p className="text-white/20 text-[10px]">esta semana</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══ TAB: TIEMPO (Clock in/out) ══ */}
        {mainTab === "tiempo" && (
          <div className="space-y-3">
            {/* Date header */}
            <div className="text-center mb-4">
              <p className="text-white/25 text-xs font-black uppercase tracking-widest">
                {new Date().toLocaleDateString("es-PR", {
                  weekday: "long", day: "numeric", month: "long"
                }).toUpperCase()}
              </p>
              <p className="text-white/50 text-sm font-bold mt-1">
                Registro de entrada y salida
              </p>
            </div>

            <div className="flex justify-end mb-2">
              <button
                onClick={loadClockEntries}
                className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs font-bold transition-colors"
              >
                <Zap className="w-3 h-3" />
                Actualizar
              </button>
            </div>

            {users.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm font-semibold">Sin empleados</p>
              </div>
            ) : (
              users.map(user => {
                const openEntry = clockEntries.find(
                  e => e.employee_id === user.id && !e.clock_out
                );
                const isClockedIn = !!openEntry;
                const roleInfo = ROLES.find(r => r.value === (user.position || user.role));
                const nameParts = (user.full_name || "").split(" ").filter(Boolean);
                const initials = nameParts.length >= 2
                  ? (nameParts[0][0] + nameParts[1][0]).toUpperCase()
                  : (nameParts[0]?.[0] || "?").toUpperCase();
                const isLoading = clockLoading === user.id;

                return (
                  <div
                    key={user.id}
                    className={`rounded-2xl p-4 flex items-center gap-4 border transition-all ${
                      isClockedIn
                        ? "bg-emerald-500/[0.07] border-emerald-500/20"
                        : "bg-white/[0.04] border-white/[0.07]"
                    }`}
                  >
                    {/* Avatar with live dot */}
                    <div className="relative flex-shrink-0">
                      <div className={`w-12 h-12 rounded-[16px] bg-gradient-to-br ${roleInfo?.color || "from-slate-500 to-slate-700"} flex items-center justify-center`}>
                        <span className="text-white font-black text-base">{initials}</span>
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#090a0d] ${
                        isClockedIn ? "bg-emerald-400 animate-pulse" : "bg-slate-600"
                      }`} />
                    </div>

                    {/* Name + status */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{user.full_name}</p>
                      {isClockedIn ? (
                        <p className="text-emerald-400 text-xs font-semibold mt-0.5">
                          Entrada: {(() => {
                            try {
                              return new Date(openEntry.clock_in).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit" });
                            } catch { return ""; }
                          })()}
                        </p>
                      ) : (
                        <p className="text-white/30 text-xs mt-0.5">Sin entrada hoy</p>
                      )}
                    </div>

                    {/* Clock in/out button */}
                    <button
                      onClick={() =>
                        isClockedIn
                          ? handleClockOut(user, openEntry)
                          : handleClockIn(user)
                      }
                      disabled={isLoading}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 flex-shrink-0 border ${
                        isClockedIn
                          ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
                          : "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                      }`}
                    >
                      {isLoading ? (
                        <div className="w-4 h-4 border border-current/30 border-t-current rounded-full animate-spin" />
                      ) : isClockedIn ? (
                        <>
                          <Clock className="w-3.5 h-3.5" />
                          Salida
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          Entrada
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateUser}
          roles={ROLES}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onUpdate={handleUpdateUser}
          onResendInvite={handleResendInvitation}
          roles={ROLES}
        />
      )}

      {/* Employee Profile Drawer */}
      {selectedEmployee && (
        <EmployeeProfileDrawer
          employee={selectedEmployee}
          roles={ROLES}
          onClose={() => setSelectedEmployee(null)}
          onEdit={() => {
            setEditingUser(selectedEmployee);
            setSelectedEmployee(null);
          }}
          onToggleActive={() => {
            handleToggleActive(selectedEmployee);
            setSelectedEmployee(null);
          }}
          onResendInvite={() => handleResendInvitation(selectedEmployee)}
        />
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 3s infinite;
        }
      `}</style>
    </div>
  );
}
