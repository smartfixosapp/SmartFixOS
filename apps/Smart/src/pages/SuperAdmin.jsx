import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import appClient from "@/api/appClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { apiUrl } from "@/lib/apiUrl";
import {
  Shield, Building2, CheckCircle, XCircle, Clock, DollarSign,
  Search, RefreshCw, LogOut, AlertTriangle, TrendingUp,
  Users, Mail, Calendar, ChevronDown, ChevronRight, Eye,
  PlayCircle, PauseCircle, Trash2, BarChart3, Activity, Power,
  Pencil, KeyRound, X, Save, Zap, Database, ShoppingBag, ArrowLeftRight,
  StickyNote, MessageSquarePlus, MessageSquare, Timer,
  Wifi, WifiOff, ArrowUpDown, UserPlus, Send, Copy, ExternalLink,
  HardDrive, Folder, FolderOpen, Image, FileText, Film, File, ArrowLeft,
  Download, Link2, CreditCard, Plus, ToggleLeft, ToggleRight,
  Banknote, Globe
} from "lucide-react";

// ── Admin Supabase client (Lazy limited singleton) ──
let adminSupabaseInstance = null;
const getAdminClient = () => {
  if (adminSupabaseInstance) return adminSupabaseInstance;
  const _SA_URL = import.meta.env.VITE_SUPABASE_URL || "https://idntuvtabecwubzswpwi.supabase.co";
  const _SA_SRK = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (_SA_SRK) {
    adminSupabaseInstance = createClient(_SA_URL, _SA_SRK, { 
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } 
    });
    return adminSupabaseInstance;
  }
  return supabase; // fallback
};
const adminSupabase = getAdminClient();

const SUPER_SESSION_KEY   = "smartfix_saas_session";
const SUPER_ADMIN_EMAIL   = "smartfixosapp@gmail.com";
const SESSION_TIMEOUT_MS  = 2 * 60 * 60 * 1000; // 2 horas
// LEGACY: /SuperAdmin redirige a /GACC. Solo 2 planes: Starter $14.99 y Pro $39.99.
const PLAN_OPTIONS = [
  { key: "starter", label: "Starter", sub: "$14.99/mo · 50 ordenes/mes", maxUsers: 999, monthlyCost: 14.99, color: "from-slate-500 to-slate-600" },
  { key: "pro", label: "Pro", sub: "$39.99/mo · Sin limites", maxUsers: 999, monthlyCost: 39.99, color: "from-blue-500 to-indigo-600" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2)  return "Ahora mismo";
  if (mins < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days === 1) return "Ayer";
  if (days < 7)  return `Hace ${days} días`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `Hace ${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? "s" : ""}`;
}
function activityColor(dateStr) {
  if (!dateStr) return { dot: "bg-gray-700", badge: "bg-gray-500/15 text-gray-500", label: "Nunca" };
  const days = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (days < 1)  return { dot: "bg-emerald-400", badge: "bg-emerald-500/15 text-emerald-400", label: "Hoy" };
  if (days < 3)  return { dot: "bg-lime-400",   badge: "bg-lime-500/15 text-lime-400",   label: "Reciente" };
  if (days < 7)  return { dot: "bg-amber-400",  badge: "bg-amber-500/15 text-amber-400", label: "Esta semana" };
  if (days < 30) return { dot: "bg-orange-400", badge: "bg-orange-500/15 text-orange-400", label: "Este mes" };
  return { dot: "bg-red-500", badge: "bg-red-500/15 text-red-400", label: "Inactivo" };
}

// Presencia en tiempo real basada en last_seen (heartbeat cada 2 min)
function presenceStatus(lastSeenStr) {
  if (!lastSeenStr) return null; // sin datos de presencia
  const mins = (Date.now() - new Date(lastSeenStr).getTime()) / 60000;
  if (mins < 4)   return { label: "Online",   dot: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", icon: "🟢" };
  if (mins < 30)  return { label: "Reciente",  dot: "bg-amber-400",   badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",   icon: "🟡" };
  return null; // offline = sin badge de presencia
}

function normalizePlan(plan) {
  const normalized = String(plan || "").trim().toLowerCase();
  if (normalized === "basic") return "smartfixos";
  return normalized;
}

function getPlanConfig(plan) {
  const normalized = normalizePlan(plan);
  return PLAN_OPTIONS.find((option) => option.key === normalized) || PLAN_OPTIONS[0];
}

function getTenantMaxUsers(tenant) {
  const metadataLimit = Number(tenant?.metadata?.max_users || tenant?.effective_max_users || 0) || 0;
  const planLimit = getPlanConfig(tenant?.effective_plan || tenant?.plan).maxUsers || 0;
  return Math.max(metadataLimit, planLimit);
}

function getUserIdentityKeys(user) {
  const keys = [];
  if (user?.id) keys.push(`id:${String(user.id).toLowerCase()}`);
  if (user?.auth_id) keys.push(`auth:${String(user.auth_id).toLowerCase()}`);
  if (user?.email) keys.push(`email:${String(user.email).trim().toLowerCase()}`);
  if (user?.employee_code) keys.push(`code:${String(user.employee_code).trim().toLowerCase()}`);
  return keys;
}

function isSystemUserLike(candidate) {
  const fullName = String(candidate?.full_name || "").trim().toLowerCase();
  const role = String(candidate?.role || candidate?.position || "").trim().toLowerCase();
  const email = String(candidate?.email || "").trim().toLowerCase();

  if (email === SUPER_ADMIN_EMAIL) return true;
  if (role === "super_admin" || role === "saas_owner" || role === "superadmin") return true;
  if (fullName.includes("smartfixos") || fullName.includes("super admin")) return true;
  return false;
}

function mergeTenantUsers(userRows = [], employeeRows = []) {
  const merged = [];
  const keyToIndex = new Map();

  for (const candidate of [...userRows, ...employeeRows]) {
    if (!candidate || candidate.active === false || isSystemUserLike(candidate)) continue;

    const keys = getUserIdentityKeys(candidate);
    const existingIndex = keys.map((key) => keyToIndex.get(key)).find((idx) => Number.isInteger(idx));

    if (Number.isInteger(existingIndex)) {
      merged[existingIndex] = {
        ...candidate,
        ...merged[existingIndex],
        entity_source: merged[existingIndex]?.entity_source || candidate.entity_source,
        auth_id: merged[existingIndex]?.auth_id || candidate.auth_id,
        pin: merged[existingIndex]?.pin || candidate.pin,
        phone: merged[existingIndex]?.phone || candidate.phone,
        employee_code: merged[existingIndex]?.employee_code || candidate.employee_code,
        hourly_rate: merged[existingIndex]?.hourly_rate ?? candidate.hourly_rate,
      };
      getUserIdentityKeys(merged[existingIndex]).forEach((key) => keyToIndex.set(key, existingIndex));
      continue;
    }

    const nextIndex = merged.length;
    merged.push(candidate);
    keys.forEach((key) => keyToIndex.set(key, nextIndex));
  }

  return merged.sort((a, b) =>
    String(a?.full_name || a?.email || "").localeCompare(String(b?.full_name || b?.email || ""), "es")
  );
}

function getStatusBadge(tenant) {
  const sub = tenant.effective_subscription_status || tenant.subscription_status;
  const trialDate = tenant.effective_trial_end_date || tenant.trial_end_date;
  // ⏳ Pendiente de activación (se registró pero no completó el wizard)
  if (tenant.metadata?.setup_complete === false)
    return { label: "⏳ Sin activar", cls: "bg-purple-500/20 text-purple-300 border-purple-500/40" };
  if (tenant.status === "suspended")
    return { label: "Suspendida", cls: "bg-red-500/20 text-red-300 border-red-500/30" };
  if (tenant.status === "cancelled")
    return { label: "Cancelada",  cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
  const trialLeft = trialDate
    ? Math.ceil((new Date(trialDate) - new Date()) / 86400000)
    : null;
  if (trialLeft !== null && trialLeft > 0)
    return { label: `Trial (${trialLeft}d)`, cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
  if (trialLeft !== null && trialLeft <= 0)
    return { label: "Trial vencido", cls: "bg-orange-500/20 text-orange-300 border-orange-500/30" };
  if (sub === "active" || tenant.status === "active")
    return { label: "Activa", cls: "bg-green-500/20 text-green-300 border-green-500/30" };
  return { label: tenant.status || "—", cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuperAdmin() {
  const navigate  = useNavigate();
  const [authorized, setAuthorized]   = useState(false);
  const [tenants,    setTenants]      = useState([]);
  const [loading,    setLoading]      = useState(true);
  const [search,     setSearch]       = useState("");
  const [actionId,   setActionId]     = useState(null);
  const [expanded,   setExpanded]     = useState(null); // tenant id detalle
  const [tab,        setTab]          = useState("tenants"); // tenants | metrics | activity | storage
  const [activitySort, setActivitySort] = useState("recent"); // recent | oldest | never | atrisk
  const [activityStats,     setActivityStats]     = useState({}); // { [tenantId]: { orders7d, orders30d, totalOrders } }
  const [activityStatsLoaded, setActivityStatsLoaded] = useState(false);
  const [activityStatsLoading, setActivityStatsLoading] = useState(false);

  // ── Storage Browser state ─────────────────────────────────────────────────
  const [storageTenantId,   setStorageTenantId]   = useState(null);   // tenant seleccionado
  const [storagePath,       setStoragePath]       = useState([]);      // breadcrumb de carpetas
  const [storageFiles,      setStorageFiles]      = useState([]);      // archivos en carpeta actual
  const [storageFolders,    setStorageFolders]    = useState([]);      // sub-carpetas en carpeta actual
  const [storageLoading,    setStorageLoading]    = useState(false);
  const [storageStats,      setStorageStats]      = useState({});      // { [tenantId]: { count, size } }
  const [storageStatsLoaded, setStorageStatsLoaded] = useState(false);
  const [tenantUsers,        setTenantUsers]        = useState({}); // { [tenantId]: [] }
  const [tenantUsersLoading, setTenantUsersLoading] = useState({}); // { [tenantId]: bool }
  const [confirmDelete,      setConfirmDelete]      = useState(null); // tenantId to confirm delete
  const [editTenant,         setEditTenant]         = useState(null); // { id, name, email } being edited
  const [editTenantUser,     setEditTenantUser]     = useState(null);
  const [editTenantUserForm, setEditTenantUserForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "technician",
    pin: "",
    active: true,
  });
  const [editForm,           setEditForm]           = useState({
    name: "",
    email: "",
    admin_name: "",
    admin_phone: "",
    country: "",
    currency: "USD",
    timezone: "America/Puerto_Rico",
    address: "",
    plan: "smartfixos",
    status: "active",
    subscription_status: "active",
    trial_end_date: "",
    monthly_cost: 55,
    max_users: 1,
  });

  // ── Nuclear Delete state ────────────────────────────────────────────────────
  const [nuclearModal,      setNuclearModal]      = useState(false);
  const [nuclearEmail,      setNuclearEmail]      = useState("");
  const [nuclearLoading,    setNuclearLoading]    = useState(false);
  const [nuclearResult,     setNuclearResult]     = useState(null); // { success, message, report }

  // ── Tenant Data Viewer state ────────────────────────────────────────────────
  const [dataModal,         setDataModal]         = useState(null); // tenant object
  const [tenantData,        setTenantData]        = useState(null); // { orders, transactions, customers, employees }
  const [tenantDataLoading, setTenantDataLoading] = useState(false);
  const [supportTab,        setSupportTab]        = useState("orders"); // orders | transactions | customers | employees
  const [deletingRecord,    setDeletingRecord]    = useState(null);  // id being deleted

  // ── Invite tenant state ───────────────────────────────────────────────────
  const [inviteModal,   setInviteModal]   = useState(false);
  const [inviteForm,    setInviteForm]    = useState({ ownerName: "", email: "", businessName: "", plan: "smartfixos" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult,  setInviteResult]  = useState(null); // { success, tenantName, trialEndDate } | null

  // ── Feedback state ────────────────────────────────────────────────────────
  const [feedbackList,    setFeedbackList]    = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  // ── Payment methods state ─────────────────────────────────────────────────
  const [paymentMethods,        setPaymentMethods]        = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [paymentMethodForm,     setPaymentMethodForm]     = useState({ name: "", details: "", instructions: "", icon: "💳", enabled: true });
  const [editingPaymentMethod,  setEditingPaymentMethod]  = useState(null); // index being edited
  const [showPaymentForm,       setShowPaymentForm]       = useState(false);

  // ── Notes state ─────────────────────────────────────────────────────────────
  const [noteModal,   setNoteModal]   = useState(null);  // tenant object
  const [noteText,    setNoteText]    = useState("");
  const [noteSaving,  setNoteSaving]  = useState(false);
  const [tenantNotes, setTenantNotes] = useState({});    // { [tenantId]: string }

  // ── Quick stats state ────────────────────────────────────────────────────────
  const [tenantStats,        setTenantStats]        = useState({});  // { [tenantId]: { orders, customers, revenue } }
  const [tenantStatsLoading, setTenantStatsLoading] = useState({});

  // ── Auth guard + session timeout ────────────────────────────────────────────
  useEffect(() => {
    const checkSession = () => {
      const raw = localStorage.getItem(SUPER_SESSION_KEY);
      if (!raw) { navigate("/PinAccess", { replace: true }); return false; }
      try {
        const sess = JSON.parse(raw);
        if (sess?.role !== "saas_owner") { navigate("/PinAccess", { replace: true }); return false; }
        // Verificar timeout de 2 horas
        if (sess.loginTime && (Date.now() - sess.loginTime) > SESSION_TIMEOUT_MS) {
          localStorage.removeItem(SUPER_SESSION_KEY);
          toast.error("Sesión expirada. Inicia sesión de nuevo.");
          navigate("/PinAccess", { replace: true });
          return false;
        }
        // Si no tiene loginTime (sesión antigua), ponerle uno ahora
        if (!sess.loginTime) {
          localStorage.setItem(SUPER_SESSION_KEY, JSON.stringify({ ...sess, loginTime: Date.now() }));
        }
        return true;
      } catch {
        navigate("/PinAccess", { replace: true }); return false;
      }
    };

    if (!checkSession()) return;
    setAuthorized(true);
    loadTenants();

    // Revisar expiración cada 5 minutos (solo si visible)
    const sessionInterval = setInterval(() => {
      if (document.visibilityState === "visible") checkSession();
    }, 5 * 60 * 1000);

    // Auto-refresh de presencia cada 2 minutos (reducido de 30s) y solo si visible
    const presenceInterval = setInterval(() => {
      if (document.visibilityState === "visible") loadTenants();
    }, 2 * 60 * 1000);

    return () => {
      clearInterval(sessionInterval);
      clearInterval(presenceInterval);
    };
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────

  // Carga estadísticas de actividad por tenant (órdenes, clientes) para el tab de actividad
  const loadActivityStats = async (tenantList) => {
    if (activityStatsLoaded || activityStatsLoading) return;
    setActivityStatsLoading(true);
    try {
      const now = new Date();
      const d7  = new Date(now - 7  * 86400000).toISOString();
      const d30 = new Date(now - 30 * 86400000).toISOString();

      const [{ data: orders7d }, { data: orders30d }, { data: allOrders }] = await Promise.all([
        adminSupabase.from("order").select("tenant_id").gte("created_date", d7),
        adminSupabase.from("order").select("tenant_id").gte("created_date", d30),
        adminSupabase.from("order").select("tenant_id").limit(5000),
      ]);

      const count = (rows, tid) => (rows || []).filter(r => r.tenant_id === tid).length;

      const stats = {};
      for (const t of tenantList) {
        stats[t.id] = {
          orders7d:    count(orders7d,  t.id),
          orders30d:   count(orders30d, t.id),
          totalOrders: count(allOrders, t.id),
        };
      }
      setActivityStats(stats);
      setActivityStatsLoaded(true);
    } catch (e) {
      console.error("[SuperAdmin] loadActivityStats error:", e);
    } finally {
      setActivityStatsLoading(false);
    }
  };

  const loadTenants = async () => {
    setLoading(true);
    try {
      // Intentar con last_seen; si falla (columna no existe), reintentar sin ella
      let tenantRows, tenantError;
      const tenantQuery = adminSupabase
        .from("tenant")
        .select("id, name, email, plan, status, subscription_status, trial_end_date, created_date, last_login, last_seen, country, currency, timezone, metadata, monthly_cost, admin_name, admin_phone, address")
        .order("created_date", { ascending: false })
        .limit(500);

      ({ data: tenantRows, error: tenantError } = await tenantQuery);

      // Si falla por columna inexistente (last_seen no migrada aún), reintentar sin ella
      if (tenantError && tenantError.message?.includes("last_seen")) {
        const fallback = await adminSupabase
          .from("tenant")
          .select("id, name, email, plan, status, subscription_status, trial_end_date, created_date, last_login, country, currency, timezone, metadata, monthly_cost, admin_name, admin_phone, address")
          .order("created_date", { ascending: false })
          .limit(500);
        tenantRows = fallback.data;
        tenantError = fallback.error;
      }

      const [{ data: subscriptionRows }] = await Promise.all([
        adminSupabase
          .from("subscription")
          .select("id, tenant_id, plan, status, amount, trial_end_date, next_billing_date, created_at")
          .order("created_at", { ascending: false }),
      ]);

      if (tenantError) throw tenantError;

      const subscriptionsByTenant = new Map();
      for (const row of subscriptionRows || []) {
        if (!row?.tenant_id || subscriptionsByTenant.has(row.tenant_id)) continue;
        subscriptionsByTenant.set(row.tenant_id, row);
      }

      const normalizedTenants = (tenantRows || []).map((tenant) => {
        const latestSubscription = subscriptionsByTenant.get(tenant.id) || null;
        const effectivePlan = normalizePlan(latestSubscription?.plan || tenant.plan);
        const planConfig = getPlanConfig(effectivePlan);
        const metadataLimit = Number(tenant?.metadata?.max_users || 0) || 0;
        return {
          ...tenant,
          latest_subscription: latestSubscription,
          effective_plan: effectivePlan,
          effective_subscription_status: latestSubscription?.status || tenant.subscription_status,
          effective_monthly_cost: Number(latestSubscription?.amount ?? tenant.monthly_cost ?? planConfig.monthlyCost) || planConfig.monthlyCost,
          effective_trial_end_date: latestSubscription?.trial_end_date || tenant.trial_end_date || null,
          effective_max_users: Math.max(metadataLimit, planConfig.maxUsers || 0),
        };
      });

      setTenants(normalizedTenants);
    } catch (e) {
      toast.error("Error cargando tiendas: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Load employees for a given tenant
  const loadTenantUsers = useCallback(async (tenantId) => {
    if (tenantUsers[tenantId] !== undefined) return; // already loaded
    setTenantUsersLoading(prev => ({ ...prev, [tenantId]: true }));
    try {
      const tenantRecord = tenants.find((candidate) => candidate.id === tenantId);
      const [{ data: userRows, error: usersError }, { data: employeeRows, error: employeesError }] = await Promise.all([
        adminSupabase
          .from("users")
          .select("id, auth_id, full_name, email, role, status, pin, position, phone, employee_code, hourly_rate, active, tenant_id")
          .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
          .order("full_name"),
        adminSupabase
          .from("app_employee")
          .select("id, full_name, email, role, status, pin, position, phone, employee_code, hourly_rate, active, tenant_id")
          .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
          .order("full_name"),
      ]);

      if (usersError) throw usersError;
      if (employeesError) throw employeesError;

      const shouldAddOwnerFallback = !userRows?.length && !employeeRows?.length;
      const ownerFallback = shouldAddOwnerFallback && tenantRecord?.email ? [{
        id: `tenant-owner:${tenantId}`,
        full_name: tenantRecord.admin_name || tenantRecord.name || "Dueño",
        email: tenantRecord.email,
        role: "admin",
        status: tenantRecord.status === "suspended" ? "inactive" : "active",
        entity_source: "tenant_owner",
      }] : [];

      const mergedUsers = mergeTenantUsers(
        [...(userRows || []).map((user) => ({ ...user, entity_source: "users" })), ...ownerFallback],
        (employeeRows || []).map((employee) => ({ ...employee, entity_source: "app_employee" })),
      );
      setTenantUsers(prev => ({ ...prev, [tenantId]: mergedUsers }));
    } catch (e) {
      console.warn("loadTenantUsers error:", e.message);
      setTenantUsers(prev => ({ ...prev, [tenantId]: [] }));
    } finally {
      setTenantUsersLoading(prev => ({ ...prev, [tenantId]: false }));
    }
  }, [tenantUsers, tenants]);

  const openEditTenantUser = (tenantId, user) => {
    setEditTenantUser({ ...user, tenantId });
    setEditTenantUserForm({
      full_name: user.full_name || "",
      email: user.email || "",
      phone: user.phone || "",
      role: user.role || user.position || "technician",
      pin: user.pin || "",
      active: user.active !== false && user.status !== "inactive",
    });
  };

  const saveTenantUser = async () => {
    if (!editTenantUser) return;

    const tenantId = editTenantUser.tenantId;
    setActionId(`${tenantId}-${editTenantUser.id}-save`);
    try {
      const payload = {
        full_name: editTenantUserForm.full_name.trim(),
        email: editTenantUserForm.email.trim(),
        phone: editTenantUserForm.phone.trim(),
        role: editTenantUserForm.role,
        position: editTenantUserForm.role,
        pin: editTenantUserForm.pin.trim(),
        active: !!editTenantUserForm.active,
        status: editTenantUserForm.active ? "active" : "inactive",
      };

      if (editTenantUser.entity_source === "app_employee") {
        const { error } = await adminSupabase.from("app_employee").update(payload).eq("id", editTenantUser.id);
        if (error) throw error;
      } else if (editTenantUser.entity_source === "users") {
        const { error } = await adminSupabase.from("users").update(payload).eq("id", editTenantUser.id);
        if (error) throw error;
      } else {
        throw new Error("Ese registro no se puede editar desde aquí");
      }

      toast.success("Usuario actualizado");
      setEditTenantUser(null);
      setTenantUsers((prev) => {
        const next = { ...prev };
        delete next[tenantId];
        return next;
      });
      await loadTenantUsers(tenantId);
    } catch (error) {
      toast.error(error.message || "No se pudo actualizar el usuario");
    } finally {
      setActionId(null);
    }
  };

  const toggleTenantUser = async (tenantId, user) => {
    setActionId(`${tenantId}-${user.id}-toggle`);
    try {
      const nextActive = !(user.active !== false && user.status !== "inactive");
      const payload = {
        active: nextActive,
        status: nextActive ? "active" : "inactive",
      };

      if (user.entity_source === "app_employee") {
        const { error } = await adminSupabase.from("app_employee").update(payload).eq("id", user.id);
        if (error) throw error;
      } else if (user.entity_source === "users") {
        const { error } = await adminSupabase.from("users").update(payload).eq("id", user.id);
        if (error) throw error;
      } else {
        throw new Error("Ese registro no se puede editar desde aquí");
      }

      toast.success(nextActive ? "Usuario activado" : "Usuario desactivado");
      setTenantUsers((prev) => {
        const next = { ...prev };
        delete next[tenantId];
        return next;
      });
      await loadTenantUsers(tenantId);
    } catch (error) {
      toast.error(error.message || "No se pudo cambiar el estado");
    } finally {
      setActionId(null);
    }
  };

  const deleteTenantUser = async (tenantId, user) => {
    if (!confirm(`¿Eliminar a ${user.full_name || user.email}? Esta acción no se puede deshacer.`)) return;

    setActionId(`${tenantId}-${user.id}-delete`);
    try {
      if (user.entity_source === "app_employee") {
        const { error } = await adminSupabase.from("app_employee").delete().eq("id", user.id);
        if (error) throw error;
      } else if (user.entity_source === "users") {
        const { error } = await adminSupabase.from("users").delete().eq("id", user.id);
        if (error) throw error;
      } else {
        throw new Error("Ese registro no se puede borrar desde aquí");
      }

      toast.success("Usuario eliminado");
      setTenantUsers((prev) => {
        const next = { ...prev };
        delete next[tenantId];
        return next;
      });
      await loadTenantUsers(tenantId);
    } catch (error) {
      toast.error(error.message || "No se pudo eliminar el usuario");
    } finally {
      setActionId(null);
    }
  };

  // ── Quick stats ──────────────────────────────────────────────────────────
  const loadTenantStats = useCallback(async (tenantId) => {
    setTenantStatsLoading(prev => {
      if (prev[tenantId]) return prev; // ya cargando
      return { ...prev, [tenantId]: true };
    });
    try {
      const [ordersRes, customersRes, txRes] = await Promise.all([
        adminSupabase.from("order").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        adminSupabase.from("customer").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
        adminSupabase.from("transaction").select("amount, type").eq("tenant_id", tenantId).eq("type", "revenue"),
      ]);
      const revenue = (txRes.data || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
      setTenantStats(prev => {
        if (prev[tenantId]) return prev; // ya cargado
        return { ...prev, [tenantId]: { orders: ordersRes.count ?? 0, customers: customersRes.count ?? 0, revenue } };
      });
    } catch (e) {
      console.warn("loadTenantStats error:", e.message);
    } finally {
      setTenantStatsLoading(prev => ({ ...prev, [tenantId]: false }));
    }
  }, []); // sin deps — usa setters funcionales

  const toggleExpanded = useCallback((tenantId) => {
    const opening = expanded !== tenantId;
    setExpanded(opening ? tenantId : null);
    if (opening) {
      loadTenantUsers(tenantId);
      loadTenantStats(tenantId);
    }
  }, [expanded, loadTenantUsers, loadTenantStats]);

  const doAction = async (tenantId, action, extra = {}) => {
    setActionId(tenantId + action);
    try {
      const res = await fetch(apiUrl('/api/manage-tenant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, action, ...extra }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success(data.message || "✅ Hecho");
        await loadTenants();
        if (action === "suspend" || action === "reactivate") setExpanded(null);
        if (action === "set_plan") {
          setTenantUsers(prev => { const n = { ...prev }; delete n[tenantId]; return n; });
        }
      } else {
        toast.error(data?.error || "Error al ejecutar acción");
      }
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setActionId(null);
    }
  };

  const doDelete = async ({ id: tenantId, email }) => {
    setActionId(tenantId + "delete");
    try {
      // Nuclear delete by email: limpia Auth user + todas las tablas por email Y tenant_id
      const body = email ? { email } : { tenantId };
      const res = await fetch(apiUrl('/api/delete-tenant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success(data.message || "🗑️ Tienda eliminada");
        setConfirmDelete(null);
        setExpanded(null);
        setTenantUsers(prev => { const n = { ...prev }; delete n[tenantId]; return n; });
        await loadTenants();
      } else {
        toast.error(data?.error || "Error al eliminar");
      }
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setActionId(null);
    }
  };

  const openEdit = (tenant) => {
    setEditForm({
      name: tenant.name || "",
      email: tenant.email || "",
      admin_name: tenant.admin_name || "",
      admin_phone: tenant.admin_phone || "",
      country: tenant.country || "",
      currency: tenant.currency || "USD",
      timezone: tenant.timezone || "America/Puerto_Rico",
      address: tenant.address || "",
      plan: normalizePlan(tenant.effective_plan || tenant.plan || "smartfixos"),
      status: tenant.status || "active",
      subscription_status: tenant.effective_subscription_status || tenant.subscription_status || "active",
      trial_end_date: tenant.effective_trial_end_date || tenant.trial_end_date || "",
      monthly_cost: tenant.effective_monthly_cost ?? tenant.monthly_cost ?? getPlanConfig(tenant.effective_plan || tenant.plan).monthlyCost,
      max_users: getTenantMaxUsers(tenant) || getPlanConfig(tenant.effective_plan || tenant.plan).maxUsers,
    });
    setEditTenant(tenant);
  };

  const doEditSave = async (notify = false) => {
    if (!editTenant) return;
    setActionId(editTenant.id + "edit");
    try {
      const res = await fetch(apiUrl('/api/manage-tenant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: editTenant.id, action: 'edit', ...editForm }),
      });
      const data = await res.json();
      if (data?.success) {
        // Si se pidió notificar al tenant, insertar en tabla notification
        if (notify) {
          try {
            // Construir resumen de cambios relevantes
            const prev = editTenant;
            const changes = [];
            if (editForm.plan !== normalizePlan(prev.effective_plan || prev.plan))
              changes.push(`Plan: ${editForm.plan}`);
            const prevMaxUsers = getTenantMaxUsers(prev);
            if (Number(editForm.max_users) !== prevMaxUsers)
              changes.push(`Límite de usuarios: ${editForm.max_users}`);
            if (Number(editForm.monthly_cost) !== Number(prev.effective_monthly_cost ?? prev.monthly_cost))
              changes.push(`Costo mensual: $${editForm.monthly_cost}/mo`);
            if (editForm.status !== prev.status)
              changes.push(`Estado: ${editForm.status}`);
            if (editForm.subscription_status !== (prev.effective_subscription_status || prev.subscription_status))
              changes.push(`Suscripción: ${editForm.subscription_status}`);

            const msgBody = changes.length
              ? `Cambios aplicados: ${changes.join(' · ')}`
              : 'Tu información de cuenta fue actualizada por el administrador de SmartFixOS.';

            await adminSupabase.from('notification').insert({
              tenant_id: editTenant.id,
              type: 'system',
              title: '🔔 Tu cuenta fue actualizada',
              message: msgBody,
              is_read: false,
            });
            toast.success("✅ Guardado y notificación enviada al tenant");
          } catch (notifyErr) {
            console.warn("Notificación no pudo enviarse:", notifyErr?.message);
            toast.success("✅ Guardado (notificación falló)");
          }
        } else {
          toast.success(data.message || "✅ Cambios guardados");
        }
        setEditTenant(null);
        await loadTenants();
      } else {
        toast.error(data?.error || "Error al guardar");
      }
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setActionId(null);
    }
  };

  const doMigrateOrphanData = async (tenant) => {
    const tenantId = typeof tenant === "string" ? tenant : tenant.id;
    const tenantObj = typeof tenant === "string" ? tenants.find(t => t.id === tenantId) : tenant;
    if (!window.confirm(`¿Asignar todos los registros sin tienda a "${tenantObj?.name || tenantId}"?\n\nEsto asigna órdenes, clientes, transacciones y empleados que no tenían tienda asignada. Solo hazlo UNA VEZ para la tienda principal.`)) return;
    setActionId(tenantId + "migrate");
    try {
      const TABLES = ["order", "customer", "transaction", "app_employee", "sale", "invoice", "cash_register", "notification", "work_order_event"];
      const results = await Promise.allSettled(
        TABLES.map(table =>
          adminSupabase.from(table).update({ tenant_id: tenantId }).is("tenant_id", null)
            .then(({ error }) => ({ table, ok: !error, error: error?.message }))
        )
      );
      const failed = results.filter(r => r.status === "rejected" || (r.value && !r.value.ok));
      if (failed.length === 0) {
        toast.success("✅ Datos migrados. Recargando...");
        // Invalidate all caches
        setTenantStats(prev => { const n = { ...prev }; delete n[tenantId]; return n; });
        setTenantUsers(prev => { const n = { ...prev }; delete n[tenantId]; return n; });
        // Reload stats and users
        await Promise.all([loadTenantStats(tenantId), loadTenantUsers(tenantId)]);
        // If data modal is open for this tenant, reload it
        if (dataModal?.id === tenantId) await openTenantData(tenantObj || dataModal);
      } else {
        toast.error(`⚠️ Algunos errores: ${failed.map(f => f.reason || f.value?.error || "?").join(', ')}`);
      }
    } catch (e) {
      toast.error(e.message || "Error al migrar");
    } finally {
      setActionId(null);
    }
  };

  const doSeedTemplates = async (tenantId) => {
    setActionId(tenantId + "seed");
    try {
      const res = await fetch(apiUrl('/api/seed-email-templates'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      if (data?.success) toast.success(data.message || "✅ Plantillas sembradas");
      else toast.error(data?.error || "Error al sembrar plantillas");
    } catch (e) {
      toast.error(e.message || "Error");
    } finally {
      setActionId(null);
    }
  };

  const doResetPassword = async (email) => {
    if (!email) return toast.error("No hay email para este tenant");
    setActionId("reset" + email);
    try {
      const res = await fetch(apiUrl('/api/manage-tenant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: editTenant?.id || "na", action: 'reset_password', email }),
      });
      const data = await res.json();
      if (data?.success) toast.success(data.message);
      else toast.error(data?.error || "Error al enviar");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActionId(null);
    }
  };

  // ── Nuclear delete by email ─────────────────────────────────────────────────
  const doNuclearDelete = async () => {
    if (!nuclearEmail.trim()) return toast.error("Ingresa un email");
    if (!confirm(`☢️ BORRADO TOTAL: Se eliminará "${nuclearEmail}" de Supabase Auth + users + app_employee + tenant + TODOS sus datos (órdenes, clientes, inventario, transacciones). Esta acción es IRREVERSIBLE. ¿Continuar?`)) return;

    setNuclearLoading(true);
    setNuclearResult(null);
    try {
      const res = await fetch(apiUrl('/api/delete-tenant'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: nuclearEmail.trim() }),
      });
      const data = await res.json();
      setNuclearResult(data);
      if (data?.success) {
        toast.success("☢️ " + (data.message || "Eliminado con éxito"));
        await loadTenants();
        setTenantUsers({});
      } else {
        toast.error(data?.error || "Error en el borrado nuclear");
      }
    } catch (e) {
      setNuclearResult({ success: false, error: e.message });
      toast.error(e.message || "Error");
    } finally {
      setNuclearLoading(false);
    }
  };

  // ── Force-activate a pending tenant ──────────────────────────────────────────
  const doForceActivate = async (tenant) => {
    if (!confirm(`¿Activar manualmente la cuenta de "${tenant.name}"? Esto marcará la cuenta como activa sin necesidad del link de activación.`)) return;
    setActionId(tenant.id + "forceactivate");
    try {
      const SB_URL = import.meta.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
      const SB_KEY = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      const headers = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}`, 'Prefer': 'return=representation' };

      // 1. Activate app_employee
      await fetch(`${SB_URL}/rest/v1/app_employee?tenant_id=eq.${tenant.id}&status=eq.pending`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ status: 'active', active: true, activation_token: null, activation_expires_at: null }),
      });

      // 2. Activate users
      await fetch(`${SB_URL}/rest/v1/users?email=eq.${encodeURIComponent(tenant.email)}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ active: true, tenant_id: tenant.id }),
      });

      // 3. Mark tenant setup_complete
      const currentMeta = tenant.metadata || {};
      await fetch(`${SB_URL}/rest/v1/tenant?id=eq.${tenant.id}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ status: 'active', metadata: { ...currentMeta, setup_complete: true } }),
      });

      toast.success(`✅ Cuenta activada: ${tenant.name}`);
      await loadTenants();
    } catch (e) {
      toast.error(e.message || "Error al activar");
    } finally {
      setActionId(null);
    }
  };

  // ── Invite new tenant ────────────────────────────────────────────────────────
  const doInviteTenant = async () => {
    const { ownerName, email, businessName, plan } = inviteForm;
    if (!ownerName.trim() || !email.trim()) return toast.error("Nombre y email son requeridos");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error("Email inválido");

    setInviteLoading(true);
    setInviteResult(null);
    try {
      const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL || "http://localhost:8686";
      const res = await fetch(`${FUNCTIONS_URL}/registerTenant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          email: email.trim().toLowerCase(),
          password: crypto.randomUUID().replace(/-/g, "").slice(0, 16),
          businessName: businessName.trim() || ownerName.trim(),
          plan,
          country: "US",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Error al invitar");
      setInviteResult(data);
      toast.success(`✅ Invitación enviada a ${email}`);
      await loadTenants();
    } catch (e) {
      toast.error(e.message || "Error al enviar invitación");
    } finally {
      setInviteLoading(false);
    }
  };

  // ── Load tenant data (orders + transactions) ─────────────────────────────────
  const openTenantData = async (tenant) => {
    setDataModal(tenant);
    setTenantData(null);
    setTenantDataLoading(true);
    try {
      const [ordersRes, txRes, customersRes, employeesRes] = await Promise.all([
        adminSupabase
          .from("order")
          .select("id, order_number, created_at, status, cost_estimate, amount_paid, customer_name, device_type, device_brand, device_model")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(50),
        adminSupabase
          .from("transaction")
          .select("id, created_at, type, amount, category, description, payment_method")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(50),
        adminSupabase
          .from("customer")
          .select("id, name, email, phone, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false })
          .limit(50),
        adminSupabase
          .from("app_employee")
          .select("id, full_name, email, role, status, pin, created_at")
          .eq("tenant_id", tenant.id)
          .order("created_at", { ascending: false }),
      ]);

      const orders       = ordersRes.data      || [];
      const transactions = txRes.data          || [];
      const customers    = customersRes.data   || [];
      const employees    = employeesRes.data   || [];

      const totalIncome  = transactions.filter(t => t.type === "revenue") .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const ordersByStatus = orders.reduce((acc, o) => {
        acc[o.status || "unknown"] = (acc[o.status || "unknown"] || 0) + 1;
        return acc;
      }, {});

      setTenantData({ orders, transactions, customers, employees, totalIncome, totalExpense, ordersByStatus });
    } catch (e) {
      toast.error("Error cargando datos: " + e.message);
      setTenantData({ orders: [], transactions: [], customers: [], employees: [], totalIncome: 0, totalExpense: 0, ordersByStatus: {} });
    } finally {
      setTenantDataLoading(false);
    }
  };

  // ── Support: delete a record on behalf of tenant ──────────────────────────
  const deleteSupportRecord = async (table, id, label) => {
    if (!window.confirm(`¿Eliminar "${label}"?\n\nEsta acción NO se puede deshacer.`)) return;
    setDeletingRecord(id);
    try {
      const { error } = await adminSupabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success(`✅ "${label}" eliminado`);
      // Refresh data
      await openTenantData(dataModal);
    } catch (e) {
      toast.error("Error al eliminar: " + e.message);
    } finally {
      setDeletingRecord(null);
    }
  };

  // ── Support: reset employee PIN ───────────────────────────────────────────
  const resetEmployeePin = async (employee) => {
    const newPin = window.prompt(`Nuevo PIN para ${employee.full_name || employee.email}:\n(4 dígitos numéricos)`);
    if (!newPin) return;
    if (!/^\d{4}$/.test(newPin)) { toast.error("El PIN debe ser exactamente 4 dígitos"); return; }
    setDeletingRecord(employee.id);
    try {
      const { error } = await adminSupabase.from("app_employee").update({ pin: newPin }).eq("id", employee.id);
      if (error) throw error;
      toast.success(`✅ PIN de ${employee.full_name || employee.email} actualizado`);
      await openTenantData(dataModal);
    } catch (e) {
      toast.error("Error al actualizar PIN: " + e.message);
    } finally {
      setDeletingRecord(null);
    }
  };

  // ── Feedback ──────────────────────────────────────────────────────────────
  const loadFeedback = async () => {
    setFeedbackLoading(true);
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      setFeedbackList(data || []);
    } catch (e) {
      console.error("[SuperAdmin] loadFeedback error:", e);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const markFeedbackStatus = async (id, status) => {
    await adminSupabase.from("feedback").update({ status }).eq("id", id);
    setFeedbackList(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  };

  // ── Storage Browser ───────────────────────────────────────────────────────
  // Carga estadísticas de storage para todos los tenants (cuántos archivos / tamaño)
  const loadStorageStats = async () => {
    if (storageStatsLoaded) return;
    try {
      // Listar carpetas del bucket (cada carpeta = un tenant_id)
      const { data: rootItems } = await adminSupabase.storage
        .from("uploads")
        .list("", { limit: 200, sortBy: { column: "name", order: "asc" } });

      const stats = {};
      const tenantFolders = (rootItems || []).filter(item => !item.metadata); // carpetas no tienen metadata
      for (const folder of tenantFolders) {
        try {
          const { data: items } = await adminSupabase.storage
            .from("uploads")
            .list(folder.name, { limit: 500 });
          const allFiles = [];
          // Iterar sub-carpetas (categorías)
          for (const item of (items || [])) {
            if (!item.metadata) {
              // Es sub-carpeta (categoría)
              const { data: subItems } = await adminSupabase.storage
                .from("uploads")
                .list(`${folder.name}/${item.name}`, { limit: 500 });
              allFiles.push(...(subItems || []).filter(f => f.metadata));
            } else {
              allFiles.push(item);
            }
          }
          const totalSize = allFiles.reduce((acc, f) => acc + (f.metadata?.size || 0), 0);
          stats[folder.name] = { count: allFiles.length, size: totalSize };
        } catch {}
      }
      setStorageStats(stats);
      setStorageStatsLoaded(true);
    } catch (e) {
      console.error("[Storage] loadStorageStats error:", e);
    }
  };

  // Abre el explorador de archivos de un tenant
  const openStorageTenant = async (tenantId) => {
    setStorageTenantId(tenantId);
    setStoragePath([]);
    await browseStoragePath(tenantId, []);
  };

  // Navega a una sub-carpeta
  const browseStoragePath = async (tenantId, pathParts) => {
    setStorageLoading(true);
    try {
      const fullPath = [tenantId, ...pathParts].join("/");
      const { data: items } = await adminSupabase.storage
        .from("uploads")
        .list(fullPath, { limit: 500, sortBy: { column: "created_at", order: "desc" } });

      const folders = (items || []).filter(item => !item.metadata);
      const files   = (items || []).filter(item => !!item.metadata);
      setStorageFolders(folders);
      setStorageFiles(files);
      setStoragePath(pathParts);
    } catch (e) {
      console.error("[Storage] browseStoragePath error:", e);
    } finally {
      setStorageLoading(false);
    }
  };

  // Elimina un archivo del storage
  const deleteStorageFile = async (fileName) => {
    const fullPath = [storageTenantId, ...storagePath, fileName].join("/");
    const { error } = await adminSupabase.storage.from("uploads").remove([fullPath]);
    if (!error) {
      setStorageFiles(prev => prev.filter(f => f.name !== fileName));
      toast.success("Archivo eliminado");
      // Invalidar caché para que se recargue en la próxima visita
      setStorageStatsLoaded(false);
      setStorageStats(prev => {
        const tid = storageTenantId;
        const cur = prev[tid] || { count: 0, size: 0 };
        return { ...prev, [tid]: { count: Math.max(0, cur.count - 1), size: cur.size } };
      });
    } else {
      toast.error("Error al eliminar: " + error.message);
    }
  };

  // Formatea bytes en legible (KB / MB / GB)
  const fmtBytes = (bytes) => {
    if (!bytes) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  // Ícono por tipo de archivo
  const fileIcon = (name = "", size = "w-5 h-5") => {
    const ext = name.split(".").pop().toLowerCase();
    if (["jpg","jpeg","png","gif","webp","svg","bmp"].includes(ext))
      return <Image className={`${size} text-emerald-400`} />;
    if (["mp4","mov","avi","webm","mkv"].includes(ext))
      return <Film className={`${size} text-purple-400`} />;
    if (["pdf","doc","docx","txt","csv","xlsx"].includes(ext))
      return <FileText className={`${size} text-blue-400`} />;
    return <File className={`${size} text-gray-400`} />;
  };

  // URL pública de un archivo
  const getPublicUrl = (tenantId, pathParts, fileName) => {
    const fullPath = [tenantId, ...pathParts, fileName].join("/");
    const { data } = adminSupabase.storage.from("uploads").getPublicUrl(fullPath);
    return data?.publicUrl || "";
  };

  // ── Notes ─────────────────────────────────────────────────────────────────
  const openNote = async (tenant) => {
    setNoteModal(tenant);
    setNoteText(tenantNotes[tenant.id] || "");
    // Cargar nota si no está cargada
    if (tenantNotes[tenant.id] === undefined) {
      try {
        const { data } = await supabase
          .from("system_config")
          .select("value")
          .eq("key", `saas_note_${tenant.id}`)
          .maybeSingle();
        const note = data?.value || "";
        setTenantNotes(prev => ({ ...prev, [tenant.id]: note }));
        setNoteText(note);
      } catch {}
    }
  };

  const saveNote = async () => {
    if (!noteModal) return;
    setNoteSaving(true);
    try {
      await adminSupabase.from("system_config").upsert({
        key: `saas_note_${noteModal.id}`,
        value: noteText,
        category: "admin_notes",
        description: `Nota interna para ${noteModal.name || noteModal.id}`,
      }, { onConflict: "key" });
      setTenantNotes(prev => ({ ...prev, [noteModal.id]: noteText }));
      toast.success("Nota guardada");
      setNoteModal(null);
    } catch (e) {
      toast.error("Error al guardar nota: " + e.message);
    } finally {
      setNoteSaving(false);
    }
  };

  // ── Payment Methods ───────────────────────────────────────────────────────
  const loadPaymentMethods = async () => {
    if (paymentMethodsLoading) return;
    setPaymentMethodsLoading(true);
    try {
      const { data } = await adminSupabase
        .from("system_config")
        .select("value")
        .eq("key", "saas_payment_methods")
        .maybeSingle();
      const methods = data?.value;
      if (Array.isArray(methods) && methods.length > 0) {
        setPaymentMethods(methods);
      } else {
        // Default payment methods
        setPaymentMethods([
          { id: "cash",          name: "Efectivo (Cash)",        icon: "💵", details: "",         instructions: "",                     enabled: true  },
          { id: "credit_card",   name: "Tarjeta de Crédito",     icon: "💳", details: "",         instructions: "Visa, Mastercard, Amex", enabled: true  },
          { id: "debit_card",    name: "Tarjeta de Débito",      icon: "💳", details: "",         instructions: "ATH, Visa Débito",       enabled: true  },
          { id: "zelle",         name: "Zelle",                  icon: "💸", details: "",         instructions: "Enviar a: ",            enabled: true  },
          { id: "venmo",         name: "Venmo",                  icon: "💜", details: "",         instructions: "Enviar a: @",           enabled: false },
          { id: "paypal",        name: "PayPal",                 icon: "🅿️", details: "",         instructions: "Enviar a: ",            enabled: false },
          { id: "cashapp",       name: "Cash App",               icon: "💚", details: "",         instructions: "Enviar a: $",           enabled: false },
          { id: "check",         name: "Cheque",                 icon: "📝", details: "",         instructions: "A nombre de: ",         enabled: false },
          { id: "bank_transfer", name: "Transferencia Bancaria", icon: "🏦", details: "",         instructions: "Número de cuenta: ",    enabled: false },
          { id: "apple_pay",     name: "Apple Pay",              icon: "🍎", details: "",         instructions: "",                     enabled: false },
          { id: "google_pay",    name: "Google Pay",             icon: "🔵", details: "",         instructions: "",                     enabled: false },
          { id: "stripe",        name: "Stripe (Online)",        icon: "⚡", details: "",         instructions: "Pago en línea",         enabled: false },
          { id: "ath_movil",     name: "ATH Móvil",              icon: "🇵🇷", details: "",        instructions: "Perfil: ",              enabled: false },
        ]);
      }
    } catch (e) {
      console.error("[SuperAdmin] loadPaymentMethods error:", e);
    } finally {
      setPaymentMethodsLoading(false);
    }
  };

  const savePaymentMethods = async (methods) => {
    try {
      await adminSupabase.from("system_config").upsert({
        key: "saas_payment_methods",
        value: methods,
        category: "saas_config",
        description: "Métodos de pago disponibles en el sistema SmartFixOS",
      }, { onConflict: "key" });
      setPaymentMethods(methods);
      toast.success("Métodos de pago guardados");
    } catch (e) {
      toast.error("Error al guardar: " + e.message);
    }
  };

  const togglePaymentMethod = async (idx) => {
    const updated = paymentMethods.map((m, i) => i === idx ? { ...m, enabled: !m.enabled } : m);
    await savePaymentMethods(updated);
  };

  const deletePaymentMethod = async (idx) => {
    if (!confirm("¿Eliminar este método de pago?")) return;
    const updated = paymentMethods.filter((_, i) => i !== idx);
    await savePaymentMethods(updated);
  };

  const addOrUpdatePaymentMethod = async () => {
    if (!paymentMethodForm.name.trim()) return toast.error("El nombre es requerido");
    let updated;
    if (editingPaymentMethod !== null) {
      updated = paymentMethods.map((m, i) => i === editingPaymentMethod ? { ...m, ...paymentMethodForm } : m);
    } else {
      const newMethod = {
        ...paymentMethodForm,
        id: paymentMethodForm.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      };
      updated = [...paymentMethods, newMethod];
    }
    await savePaymentMethods(updated);
    setShowPaymentForm(false);
    setEditingPaymentMethod(null);
    setPaymentMethodForm({ name: "", details: "", instructions: "", icon: "💳", enabled: true });
  };

  const handleLogout = async () => {
    localStorage.removeItem(SUPER_SESSION_KEY);
    localStorage.removeItem("smartfix_saved_creds");
    // Cerrar sesión de Supabase para evitar re-login automático por OAuth
    try { await supabase.auth.signOut(); } catch { /* no-op */ }
    navigate("/PinAccess", { replace: true });
  };

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metrics = React.useMemo(() => {
    const active    = tenants.filter(t => t.status === "active");
    const pending   = tenants.filter(t => t.metadata?.setup_complete === false); // registrados sin activar
    const onTrial   = active.filter(t => t.metadata?.setup_complete !== false && (t.effective_trial_end_date || t.trial_end_date) && new Date(t.effective_trial_end_date || t.trial_end_date) > new Date());
    const paying    = active.filter(t => t.metadata?.setup_complete !== false && (t.effective_subscription_status || t.subscription_status) === "active");
    const suspended = tenants.filter(t => t.status === "suspended" || t.status === "cancelled");
    const overdue   = active.filter(t => t.metadata?.setup_complete !== false && (t.effective_trial_end_date || t.trial_end_date) && new Date(t.effective_trial_end_date || t.trial_end_date) < new Date() && (t.effective_subscription_status || t.subscription_status) !== "active");
    return {
      total:     tenants.length,
      pending:   pending.length,
      active:    active.length,
      trial:     onTrial.length,
      paying:    paying.length,
      suspended: suspended.length,
      overdue:   overdue.length,
      mrr:       paying.reduce((sum, t) => sum + (Number(t.effective_monthly_cost ?? t.monthly_cost) || 55), 0),
    };
  }, [tenants]);

  const filtered = tenants.filter(t =>
    !search ||
    t.name?.toLowerCase().includes(search.toLowerCase()) ||
    t.email?.toLowerCase().includes(search.toLowerCase()) ||
    t.slug?.toLowerCase().includes(search.toLowerCase())
  );

  if (!authorized) return null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen apple-surface apple-type">

      {/* ── Note Modal ── */}
      <AnimatePresence>
        {noteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget && !noteSaving) setNoteModal(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-yellow-500/30 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-yellow-400" />
                  Nota interna — {noteModal.name || noteModal.email}
                </h2>
                <button onClick={() => setNoteModal(null)} disabled={noteSaving} className="text-gray-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={5}
                placeholder="Escribe notas privadas sobre esta tienda… (pagos, acuerdos, contacto especial, etc.)"
                className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500/30 placeholder-gray-600"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={saveNote}
                  disabled={noteSaving}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/20 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/30 text-sm font-semibold transition-all disabled:opacity-50"
                >
                  {noteSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Guardar nota
                </button>
                <button
                  onClick={() => setNoteModal(null)}
                  disabled={noteSaving}
                  className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Tenant Modal ── */}
      <AnimatePresence>
        {editTenant && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setEditTenant(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-3xl shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-purple-400" /> Editar Tienda
                </h2>
                <button onClick={() => setEditTenant(null)} className="text-gray-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Nombre del negocio</label>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    placeholder="Nombre del negocio"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Email del dueño</label>
                  <input
                    value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                    type="email"
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    placeholder="email@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Nombre del contacto</label>
                  <input
                    value={editForm.admin_name}
                    onChange={e => setEditForm(f => ({ ...f, admin_name: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    placeholder="Dueño o encargado"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Teléfono del contacto</label>
                  <input
                    value={editForm.admin_phone}
                    onChange={e => setEditForm(f => ({ ...f, admin_phone: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    placeholder="7875551234"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">País</label>
                  <input
                    value={editForm.country}
                    onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    placeholder="Puerto Rico"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Moneda</label>
                  <select
                    value={editForm.currency}
                    onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  >
                    {["USD", "EUR", "MXN", "COP", "ARS", "BRL"].map((currency) => (
                      <option key={currency} value={currency} className="bg-[#111]">{currency}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Zona horaria</label>
                  <input
                    value={editForm.timezone}
                    onChange={e => setEditForm(f => ({ ...f, timezone: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    placeholder="America/Puerto_Rico"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Dirección</label>
                  <input
                    value={editForm.address}
                    onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                    placeholder="Dirección del negocio"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Plan</label>
                  <select
                    value={editForm.plan}
                    onChange={e => {
                      const config = getPlanConfig(e.target.value);
                      setEditForm(f => ({
                        ...f,
                        plan: e.target.value,
                        max_users: config.maxUsers,
                        monthly_cost: config.monthlyCost,
                      }));
                    }}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  >
                    {PLAN_OPTIONS.map((plan) => (
                      <option key={plan.key} value={plan.key} className="bg-[#111]">{plan.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Estado tienda</label>
                  <select
                    value={editForm.status}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  >
                    {["pending", "active", "suspended", "cancelled"].map((status) => (
                      <option key={status} value={status} className="bg-[#111]">{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Estado suscripción</label>
                  <select
                    value={editForm.subscription_status}
                    onChange={e => setEditForm(f => ({ ...f, subscription_status: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  >
                    {["active", "past_due", "cancelled", "paused"].map((status) => (
                      <option key={status} value={status} className="bg-[#111]">{status}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Trial hasta</label>
                  <input
                    value={editForm.trial_end_date ? String(editForm.trial_end_date).slice(0, 10) : ""}
                    onChange={e => setEditForm(f => ({ ...f, trial_end_date: e.target.value }))}
                    type="date"
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Costo mensual</label>
                  <input
                    value={editForm.monthly_cost}
                    onChange={e => setEditForm(f => ({ ...f, monthly_cost: Number(e.target.value || 0) }))}
                    type="number"
                    min="0"
                    step="1"
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Límite de usuarios</label>
                  <input
                    value={editForm.max_users}
                    onChange={e => setEditForm(f => ({ ...f, max_users: Number(e.target.value || 0) }))}
                    type="number"
                    min="1"
                    step="1"
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-300">
                <p className="font-semibold text-white mb-2">Opciones recomendadas por tienda</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-gray-400">
                  <p>1. Contacto del dueño y teléfono para soporte y facturación.</p>
                  <p>2. Plan, costo y límite de usuarios para que el acceso respete la suscripción real.</p>
                  <p>3. País, moneda y zona horaria para que reportes, cobros y fechas salgan correctos.</p>
                  <p>4. Trial, estado y plantillas de email para onboarding y operación de cada tienda.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                {/* Guardar sin notificar */}
                <button
                  onClick={() => doEditSave(false)}
                  disabled={!!actionId}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar
                </button>
                {/* Guardar y notificar al tenant */}
                <button
                  onClick={() => doEditSave(true)}
                  disabled={!!actionId}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {actionId === editTenant?.id + "edit" ? "Guardando..." : "Guardar y notificar"}
                </button>
                <button
                  onClick={() => doResetPassword(editForm.email || editTenant?.email)}
                  disabled={!!actionId}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm font-semibold hover:bg-yellow-500/20 transition-all disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Reset contraseña
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editTenantUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setEditTenantUser(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-white/10 rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" /> Editar Usuario
                </h2>
                <button onClick={() => setEditTenantUser(null)} className="text-gray-500 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Nombre completo</label>
                  <input
                    value={editTenantUserForm.full_name}
                    onChange={(e) => setEditTenantUserForm((f) => ({ ...f, full_name: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Email</label>
                  <input
                    value={editTenantUserForm.email}
                    onChange={(e) => setEditTenantUserForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Teléfono</label>
                  <input
                    value={editTenantUserForm.phone}
                    onChange={(e) => setEditTenantUserForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">Rol</label>
                  <select
                    value={editTenantUserForm.role}
                    onChange={(e) => setEditTenantUserForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2"
                  >
                    {["admin", "manager", "technician", "cashier"].map((role) => (
                      <option key={role} value={role} className="bg-[#111]">{role}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1 font-semibold">PIN</label>
                  <input
                    value={editTenantUserForm.pin}
                    onChange={(e) => setEditTenantUserForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                    className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2"
                    placeholder="1234"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={!!editTenantUserForm.active}
                      onChange={(e) => setEditTenantUserForm((f) => ({ ...f, active: e.target.checked }))}
                    />
                    Usuario activo
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={saveTenantUser}
                  disabled={!!actionId}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar usuario
                </button>
                <button
                  onClick={() => setEditTenantUser(null)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111] border border-red-500/30 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">¿Eliminar esta tienda?</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Esta acción es <strong className="text-red-400">permanente e irreversible</strong>. Se eliminarán todos los datos, usuarios, órdenes y configuración.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => doDelete(confirmDelete || {})}
                  disabled={!!actionId}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {actionId?.includes("delete") ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Sí, eliminar permanentemente
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-semibold transition-all"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Invite Tenant Modal ── */}
      <AnimatePresence>
        {inviteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget && !inviteLoading) setInviteModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#111114] border border-purple-500/20 rounded-2xl p-6 w-full max-w-md shadow-2xl"
            >
              {inviteResult ? (
                /* Success screen */
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white">¡Invitación enviada!</h3>
                  <p className="text-gray-400 text-sm">
                    Se envió el email de activación a <span className="text-white font-medium">{inviteForm.email}</span>
                  </p>
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 text-left space-y-2">
                    <p className="text-xs text-gray-500 font-medium tracking-wide">Resumen</p>
                    <p className="text-sm text-white"><span className="text-gray-500">Negocio:</span> {inviteResult.tenantName}</p>
                    <p className="text-sm text-white"><span className="text-gray-500">Trial hasta:</span> {inviteResult.trialEndDate}</p>
                  </div>
                  <button
                    onClick={() => setInviteModal(false)}
                    className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 font-semibold hover:bg-purple-500/30 transition-all"
                  >
                    Listo
                  </button>
                </div>
              ) : (
                /* Form */
                <>
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                        <UserPlus className="w-4 h-4 text-purple-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white">Invitar tienda</h3>
                    </div>
                    <button onClick={() => setInviteModal(false)} className="text-gray-500 hover:text-white transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Nombre del dueño *</label>
                      <input
                        value={inviteForm.ownerName}
                        onChange={e => setInviteForm(f => ({ ...f, ownerName: e.target.value }))}
                        placeholder="Angel Meléndez"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Email *</label>
                      <input
                        value={inviteForm.email}
                        onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="angel@taller.com"
                        type="email"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Nombre del negocio</label>
                      <input
                        value={inviteForm.businessName}
                        onChange={e => setInviteForm(f => ({ ...f, businessName: e.target.value }))}
                        placeholder="Amp Phone Repair"
                        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1.5 font-medium">Plan</label>
                      <div className="grid grid-cols-3 gap-2">
                        {PLAN_OPTIONS.map(p => (
                          <button key={p.key}
                            onClick={() => setInviteForm(f => ({ ...f, plan: p.key }))}
                            className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                              inviteForm.plan === p.key
                                ? "border-purple-500/60 bg-purple-500/20 text-purple-300"
                                : "border-white/[0.08] bg-white/[0.03] text-gray-500 hover:bg-white/[0.06]"
                            }`}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      onClick={() => setInviteModal(false)}
                      disabled={inviteLoading}
                      className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-gray-500 text-sm hover:bg-white/[0.04] transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={doInviteTenant}
                      disabled={inviteLoading || !inviteForm.ownerName || !inviteForm.email}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300 font-semibold text-sm hover:bg-purple-500/30 transition-all disabled:opacity-40"
                    >
                      {inviteLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {inviteLoading ? "Enviando…" : "Enviar invitación"}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-600 text-center mt-3">
                    Se enviará un email con el link de activación. La contraseña se genera automáticamente.
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Nuclear Delete Modal ── */}
      <AnimatePresence>
        {nuclearModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget && !nuclearLoading) setNuclearModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0f0505] border border-red-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5"
            >
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 border border-red-500/30">
                  <Zap className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-white">☢️ Borrar TODO</h2>
                  <p className="text-xs text-red-300/80">Auth + usuarios + tenant + órdenes + datos completos</p>
                </div>
                <button onClick={() => setNuclearModal(false)} disabled={nuclearLoading} className="ml-auto text-gray-600 hover:text-white transition-colors disabled:opacity-40">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Warning banner */}
              <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] px-4 py-3 text-xs text-red-300 leading-relaxed">
                <p className="font-bold mb-1">⚠️ Esta acción es irreversible</p>
                <p>Se eliminará el email de <strong>Supabase Auth</strong>, tablas <strong>users</strong> y <strong>app_employee</strong>, el <strong>tenant</strong> completo y <strong>todos sus datos</strong>: órdenes, clientes, inventario, transacciones, configuración, etc.</p>
              </div>

              {/* Email input */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5 font-semibold">Email a eliminar por completo</label>
                <input
                  value={nuclearEmail}
                  onChange={e => setNuclearEmail(e.target.value)}
                  type="email"
                  placeholder="usuario@ejemplo.com"
                  disabled={nuclearLoading}
                  onKeyDown={e => e.key === 'Enter' && doNuclearDelete()}
                  className="w-full bg-white/[0.05] border border-red-500/40 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500/40 placeholder-gray-600"
                />
              </div>

              {/* Result */}
              {nuclearResult && (
                <div className={`rounded-xl border p-3 text-xs space-y-1 ${nuclearResult.success ? "border-green-500/30 bg-green-500/5 text-green-300" : "border-red-500/30 bg-red-500/5 text-red-300"}`}>
                  <p className="font-bold">{nuclearResult.success ? "✅ Eliminado correctamente" : "❌ Error"}</p>
                  <p>{nuclearResult.message || nuclearResult.error}</p>
                  {nuclearResult.report?.errors?.length > 0 && (
                    <p className="text-orange-400 mt-1">⚠️ {nuclearResult.report.errors.join(" · ")}</p>
                  )}
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={doNuclearDelete}
                  disabled={nuclearLoading || !nuclearEmail.trim()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all disabled:opacity-40 shadow-lg shadow-red-900/30"
                >
                  {nuclearLoading
                    ? <><RefreshCw className="w-4 h-4 animate-spin" /> Eliminando todo…</>
                    : <><Zap className="w-4 h-4" /> ☢️ BORRAR TODO</>
                  }
                </button>
                <button
                  onClick={() => { setNuclearModal(false); setNuclearResult(null); }}
                  disabled={nuclearLoading}
                  className="px-4 py-3 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm font-semibold transition-all disabled:opacity-40"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tenant Data Viewer Modal ── */}
      <AnimatePresence>
        {dataModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setDataModal(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#080d1a] border border-cyan-500/30 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center gap-3 p-5 border-b border-white/[0.07]">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <Database className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-white truncate">{dataModal.name || "Sin nombre"}</h2>
                  <p className="text-xs text-cyan-400/70">Panel de soporte — ver y gestionar datos</p>
                </div>
                <button
                  onClick={() => openTenantData(dataModal)}
                  disabled={tenantDataLoading}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-white transition-colors disabled:opacity-40 mr-1"
                  title="Recargar"
                >
                  <RefreshCw className={`w-4 h-4 ${tenantDataLoading ? "animate-spin" : ""}`} />
                </button>
                <button onClick={() => setDataModal(null)} className="text-gray-600 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {tenantDataLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-600 gap-3">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                  <p className="text-sm">Cargando datos de la tienda…</p>
                </div>
              ) : tenantData ? (
                <>
                  {/* KPI row */}
                  <div className="grid grid-cols-4 gap-0 border-b border-white/[0.06]">
                    {[
                      { label: "Órdenes",    value: tenantData.orders.length,       color: "text-blue-400"   },
                      { label: "Clientes",   value: tenantData.customers.length,    color: "text-cyan-400"   },
                      { label: "Ingresos",   value: `$${tenantData.totalIncome.toFixed(0)}`,  color: "text-emerald-400" },
                      { label: "Empleados",  value: tenantData.employees.length,    color: "text-purple-400" },
                    ].map((m, i) => (
                      <div key={m.label} className={`p-3 text-center ${i < 3 ? "border-r border-white/[0.06]" : ""}`}>
                        <p className="text-[10px] text-gray-600">{m.label}</p>
                        <p className={`text-xl font-semibold ${m.color}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Migration CTA — shown when all data is 0 */}
                  {tenantData.orders.length === 0 && tenantData.customers.length === 0 && tenantData.employees.length === 0 && (
                    <div className="mx-4 mt-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                      <p className="text-sm font-bold text-amber-300 mb-1">⚠️ No hay datos asignados a esta tienda</p>
                      <p className="text-xs text-amber-200/60 mb-3">
                        Los datos pueden estar en la base de datos sin tienda asignada (antes de la actualización multi-tenant).
                        Si esta es la tienda principal, haz clic en el botón para asignarlos.
                      </p>
                      <button
                        onClick={() => doMigrateOrphanData(dataModal)}
                        disabled={actionId === dataModal?.id + "migrate"}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 text-sm font-bold transition-all disabled:opacity-50"
                      >
                        {actionId === dataModal?.id + "migrate"
                          ? <><RefreshCw className="w-4 h-4 animate-spin" /> Migrando...</>
                          : <><Database className="w-4 h-4" /> Asignar datos huérfanos a esta tienda</>
                        }
                      </button>
                    </div>
                  )}

                  {/* Tabs */}
                  <div className="flex border-b border-white/[0.06] px-4 pt-2 gap-1">
                    {[
                      { id: "orders",       label: "Órdenes",       count: tenantData.orders.length },
                      { id: "transactions", label: "Transacciones", count: tenantData.transactions.length },
                      { id: "customers",    label: "Clientes",      count: tenantData.customers.length },
                      { id: "employees",    label: "Empleados",     count: tenantData.employees.length },
                    ].map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSupportTab(t.id)}
                        className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                          supportTab === t.id
                            ? "border-cyan-400 text-cyan-300"
                            : "border-transparent text-gray-500 hover:text-gray-300"
                        }`}
                      >
                        {t.label}
                        <span className="ml-1.5 text-[10px] opacity-60">({t.count})</span>
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="overflow-y-auto flex-1 p-4">

                    {/* ORDERS */}
                    {supportTab === "orders" && (
                      <div className="space-y-1.5">
                        {tenantData.orders.length === 0
                          ? <p className="text-xs text-gray-600 py-4 text-center">Sin órdenes registradas</p>
                          : tenantData.orders.map(order => (
                            <div key={order.id} className="flex items-center gap-3 bg-white/[0.025] hover:bg-white/[0.04] rounded-xl px-3 py-2.5 text-xs transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold truncate">
                                  {order.order_number ? <span className="text-cyan-400 mr-1">{order.order_number}</span> : null}
                                  {order.customer_name || "Cliente"} — {[order.device_brand, order.device_model || order.device_type].filter(Boolean).join(" ")}
                                </p>
                                <p className="text-gray-500 truncate">{order.created_at ? new Date(order.created_at).toLocaleDateString("es") : "—"} · {order.status || "—"}</p>
                              </div>
                              <span className="font-bold text-emerald-400 flex-shrink-0">
                                {(order.amount_paid || order.cost_estimate) ? `$${Number(order.amount_paid || order.cost_estimate || 0).toFixed(0)}` : "—"}
                              </span>
                              <button
                                onClick={() => deleteSupportRecord("order", order.id, order.order_number || order.customer_name || order.id)}
                                disabled={deletingRecord === order.id}
                                className="flex-shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                                title="Eliminar orden"
                              >
                                {deletingRecord === order.id
                                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))
                        }
                      </div>
                    )}

                    {/* TRANSACTIONS */}
                    {supportTab === "transactions" && (
                      <div className="space-y-1.5">
                        {tenantData.transactions.length === 0
                          ? <p className="text-xs text-gray-600 py-4 text-center">Sin transacciones registradas</p>
                          : tenantData.transactions.map(tx => (
                            <div key={tx.id} className="flex items-center gap-3 bg-white/[0.025] hover:bg-white/[0.04] rounded-xl px-3 py-2.5 text-xs transition-colors">
                              <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${tx.type === "revenue" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                                {tx.type === "revenue" ? "+" : "-"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold truncate">{tx.description || tx.category || "—"}</p>
                                <p className="text-gray-500">{tx.created_at ? new Date(tx.created_at).toLocaleDateString("es") : "—"} · {tx.payment_method || "—"}</p>
                              </div>
                              <span className={`font-bold flex-shrink-0 ${tx.type === "revenue" ? "text-emerald-400" : "text-red-400"}`}>
                                ${Number(tx.amount || 0).toFixed(2)}
                              </span>
                              <button
                                onClick={() => deleteSupportRecord("transaction", tx.id, tx.description || tx.category || tx.id)}
                                disabled={deletingRecord === tx.id}
                                className="flex-shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                                title="Eliminar transacción"
                              >
                                {deletingRecord === tx.id
                                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))
                        }
                      </div>
                    )}

                    {/* CUSTOMERS */}
                    {supportTab === "customers" && (
                      <div className="space-y-1.5">
                        {tenantData.customers.length === 0
                          ? <p className="text-xs text-gray-600 py-4 text-center">Sin clientes registrados</p>
                          : tenantData.customers.map(c => (
                            <div key={c.id} className="flex items-center gap-3 bg-white/[0.025] hover:bg-white/[0.04] rounded-xl px-3 py-2.5 text-xs transition-colors">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-cyan-300 flex-shrink-0">
                                {(c.name || c.email || "?")[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold truncate">{c.name || "Sin nombre"}</p>
                                <p className="text-gray-500 truncate">{c.email || ""} {c.phone ? `· ${c.phone}` : ""}</p>
                              </div>
                              <button
                                onClick={() => deleteSupportRecord("customer", c.id, c.name || c.email || c.id)}
                                disabled={deletingRecord === c.id}
                                className="flex-shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                                title="Eliminar cliente"
                              >
                                {deletingRecord === c.id
                                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))
                        }
                      </div>
                    )}

                    {/* EMPLOYEES */}
                    {supportTab === "employees" && (
                      <div className="space-y-1.5">
                        {tenantData.employees.length === 0
                          ? <p className="text-xs text-gray-600 py-4 text-center">Sin empleados registrados</p>
                          : tenantData.employees.map(emp => (
                            <div key={emp.id} className="flex items-center gap-3 bg-white/[0.025] hover:bg-white/[0.04] rounded-xl px-3 py-2.5 text-xs transition-colors">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
                                {(emp.full_name || emp.email || "?")[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white font-semibold truncate">{emp.full_name || "Sin nombre"}</p>
                                <p className="text-gray-500 truncate">{emp.email || ""} · {emp.role || "—"} · PIN: {emp.pin ? "••••" : "sin PIN"}</p>
                              </div>
                              <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${emp.status === "active" || emp.active !== false ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : "border-red-500/30 text-red-400 bg-red-500/10"}`}>
                                {emp.status === "active" || emp.active !== false ? "Activo" : "Inactivo"}
                              </span>
                              {/* Reset PIN */}
                              <button
                                onClick={() => resetEmployeePin(emp)}
                                disabled={deletingRecord === emp.id}
                                className="flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-semibold text-amber-400 border border-amber-500/20 hover:bg-amber-500/10 transition-all disabled:opacity-40"
                                title="Resetear PIN"
                              >
                                PIN
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => deleteSupportRecord("app_employee", emp.id, emp.full_name || emp.email || emp.id)}
                                disabled={deletingRecord === emp.id}
                                className="flex-shrink-0 p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all disabled:opacity-40"
                                title="Eliminar empleado"
                              >
                                {deletingRecord === emp.id
                                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  : <Trash2 className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          ))
                        }
                      </div>
                    )}

                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 apple-surface-elevated backdrop-blur-2xl" style={{ borderBottom: "0.5px solid rgba(60,60,67,0.29)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
              <Shield className="w-4 h-4 text-apple-purple" />
            </div>
            <div className="leading-none">
              <p className="apple-text-subheadline apple-label-primary">SmartFixOS</p>
              <p className="apple-text-caption2 text-apple-purple">Control Panel</p>
            </div>
          </div>

          {/* Tabs — desktop */}
          <div className="hidden sm:flex items-center gap-1 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-1">
            {[
              { key: "tenants",  label: "Tiendas",   icon: Building2       },
              { key: "metrics",  label: "Métricas",  icon: BarChart3        },
              { key: "activity", label: "Actividad", icon: Activity         },
              { key: "storage",  label: "Storage",   icon: HardDrive        },
              { key: "feedback", label: "Feedback",  icon: MessageSquare   },
              { key: "payments", label: "Pagos",     icon: CreditCard      },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); if (t.key === "feedback") loadFeedback(); if (t.key === "storage") loadStorageStats(); if (t.key === "activity") loadActivityStats(tenants); if (t.key === "payments") loadPaymentMethods(); }}
                className={`apple-press flex items-center gap-1.5 px-3 py-1.5 rounded-apple-sm apple-text-footnote transition-all ${
                  tab === t.key
                    ? "apple-surface-elevated apple-label-primary shadow-sm"
                    : "apple-label-secondary hover:apple-label-primary"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tabs — móvil (select) */}
          <select
            className="sm:hidden apple-input h-8"
            value={tab}
            onChange={e => { const v = e.target.value; setTab(v); if (v === "feedback") loadFeedback(); if (v === "storage") loadStorageStats(); if (v === "activity") loadActivityStats(tenants); if (v === "payments") loadPaymentMethods(); }}
          >
            <option value="tenants">Tiendas</option>
            <option value="metrics">Métricas</option>
            <option value="activity">Actividad</option>
            <option value="storage">Storage</option>
            <option value="feedback">Feedback</option>
            <option value="payments">Pagos</option>
          </select>

          <button
            onClick={() => { setNuclearModal(true); setNuclearResult(null); setNuclearEmail(""); }}
            title="Borrar TODO por email: Auth + tenant + datos completos"
            className="apple-btn apple-btn-destructive apple-text-footnote"
          >
            <Zap className="w-3.5 h-3.5" /> Borrar TODO
          </button>

          {/* Session timer */}
          <div className="hidden sm:flex items-center gap-1.5 apple-text-caption2 apple-label-tertiary px-2 tabular-nums">
            <Timer className="w-3 h-3" />
            <span>Sesión: 2h</span>
          </div>

          <button
            onClick={handleLogout}
            className="apple-btn apple-btn-plain apple-text-footnote"
          >
            <LogOut className="w-3.5 h-3.5" /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total",      value: metrics.total,     icon: Building2,   tint: "blue"    },
            { label: "Sin activar",value: metrics.pending,   icon: Timer,       tint: "purple"  },
            { label: "Activas",    value: metrics.active,    icon: CheckCircle, tint: "green"   },
            { label: "Trial",      value: metrics.trial,     icon: Clock,       tint: "yellow"  },
            { label: "Pagando",    value: metrics.paying,    icon: DollarSign,  tint: "pink"    },
            { label: "MRR",        value: `$${metrics.mrr}`, icon: TrendingUp,  tint: "indigo"  },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="apple-card rounded-apple-lg p-4 space-y-2"
            >
              <div className={`w-8 h-8 rounded-apple-sm bg-apple-${m.tint}/15 flex items-center justify-center`}>
                <m.icon className={`w-4 h-4 text-apple-${m.tint}`} />
              </div>
              <p className="apple-text-title2 apple-label-primary tabular-nums">{m.value}</p>
              <p className="apple-text-caption1 apple-label-tertiary">{m.label}</p>
            </motion.div>
          ))}
        </div>

        {tab === "tenants" && (
          <>
            {/* ── Search bar ── */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 apple-label-tertiary" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar tienda, email o slug..."
                  className="apple-input w-full pl-9 h-10"
                />
              </div>
              <button
                onClick={loadTenants}
                disabled={loading}
                className="apple-btn apple-btn-secondary h-10 w-10 p-0 flex items-center justify-center disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 apple-label-secondary ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                onClick={() => { setInviteModal(true); setInviteResult(null); setInviteForm({ ownerName: "", email: "", businessName: "", plan: "smartfixos" }); }}
                className="apple-btn apple-btn-tinted"
              >
                <UserPlus className="w-4 h-4" /> Invitar tienda
              </button>
            </div>

            {/* ── Tenant list ── */}
            {loading ? (
              <div className="text-center py-20 text-gray-600 text-sm">Cargando tiendas...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-600">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No hay tiendas{search ? " que coincidan" : " registradas aún"}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((tenant, i) => {
                  const badge   = getStatusBadge(tenant);
                  const isOpen  = expanded === tenant.id;
                  const busy    = actionId?.startsWith(tenant.id);

                  return (
                    <motion.div
                      key={tenant.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.025, 0.3) }}
                      className="apple-card rounded-apple-lg overflow-hidden apple-press transition-all"
                    >
                      {/* Row */}
                      <div className="flex items-center gap-3 p-4">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center apple-text-headline text-apple-purple flex-shrink-0">
                          {(tenant.name || "?")[0].toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="apple-text-subheadline apple-label-primary truncate">{tenant.name || "Sin nombre"}</p>
                          <p className="apple-text-caption1 apple-label-tertiary truncate">{tenant.email || "—"}</p>
                        </div>

                        {/* Status badge */}
                        <span className={`hidden sm:inline text-[11px] px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${badge.cls}`}>
                          {badge.label}
                        </span>

                        {/* Date */}
                        <span className="hidden md:block text-xs text-gray-600 flex-shrink-0 w-20 text-right">
                          {tenant.created_date ? new Date(tenant.created_date).toLocaleDateString("es") : "—"}
                        </span>

                        {/* Expand */}
                        <button
                          onClick={() => toggleExpanded(tenant.id)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                        >
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* Detail panel */}
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-white/[0.06] p-4 bg-white/[0.02] space-y-4">

                              {/* ── Quick Stats ── */}
                              <div className="grid grid-cols-3 gap-2">
                                {tenantStatsLoading[tenant.id] ? (
                                  <div className="col-span-3 flex items-center gap-2 text-xs text-gray-600 py-1">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cargando estadísticas…
                                  </div>
                                ) : tenantStats[tenant.id] ? (
                                  <>
                                    {[
                                      { label: "Órdenes totales",  value: tenantStats[tenant.id].orders,    icon: ShoppingBag, color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
                                      { label: "Clientes",         value: tenantStats[tenant.id].customers, icon: Users,       color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
                                      { label: "Ingresos totales", value: `$${Number(tenantStats[tenant.id].revenue || 0).toFixed(0)}`, icon: TrendingUp, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20" },
                                    ].map(s => (
                                      <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-3 py-2 flex items-center gap-2`}>
                                        <s.icon className={`w-3.5 h-3.5 ${s.color} flex-shrink-0`} />
                                        <div>
                                          <p className="text-[10px] text-gray-500">{s.label}</p>
                                          <p className={`text-base font-semibold ${s.color}`}>{s.value}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </>
                                ) : null}
                              </div>

                              {/* ── Internal note preview ── */}
                              {tenantNotes[tenant.id] && (
                                <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/20 rounded-xl px-3 py-2 text-xs">
                                  <StickyNote className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                  <p className="text-yellow-200/70 line-clamp-2">{tenantNotes[tenant.id]}</p>
                                </div>
                              )}

                              {/* Details grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                {[
                                  { label: "Slug",       value: tenant.slug || "—" },
                                  { label: "Plan",       value: getPlanConfig(tenant.effective_plan || tenant.plan).label },
                                  { label: "Límite",     value: `${getTenantMaxUsers(tenant) || 0} usuario${getTenantMaxUsers(tenant) === 1 ? "" : "s"}` },
                                  { label: "Trial hasta",value: (tenant.effective_trial_end_date || tenant.trial_end_date) ? new Date(tenant.effective_trial_end_date || tenant.trial_end_date).toLocaleDateString("es") : "—" },
                                  { label: "ID",         value: tenant.id?.slice(0, 8) + "…" },
                                ].map(d => (
                                  <div key={d.label} className="bg-black/30 rounded-xl p-3">
                                    <p className="text-gray-500 mb-0.5">{d.label}</p>
                                    <p className="text-white font-semibold truncate">{d.value}</p>
                                  </div>
                                ))}
                              </div>

                              {/* Actions */}
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Power toggle — suspender / reactivar */}
                                <button
                                  onClick={() => doAction(tenant.id, tenant.status === "suspended" ? "reactivate" : "suspend")}
                                  disabled={!!busy}
                                  title={tenant.status === "suspended" ? "Reactivar tienda" : "Suspender tienda"}
                                  className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border font-semibold transition-all disabled:opacity-50 ${
                                    tenant.status === "suspended"
                                      ? "bg-green-500/10 border-green-500/30 text-green-300 hover:bg-green-500/20"
                                      : "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                                  }`}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                  {tenant.status === "suspended" ? "Reactivar" : "Suspender"}
                                </button>

                                <button
                                  onClick={() => doAction(tenant.id, "extend_trial")}
                                  disabled={!!busy}
                                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-all disabled:opacity-50"
                                >
                                  <Clock className="w-3.5 h-3.5" /> +15 días trial
                                </button>

                                {/* Edit */}
                                <button
                                  onClick={() => openEdit(tenant)}
                                  disabled={!!busy}
                                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 transition-all disabled:opacity-50"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> Editar
                                </button>

                                {/* Force activate — only for pending accounts */}
                                {tenant.metadata?.setup_complete === false && (
                                  <button
                                    onClick={() => doForceActivate(tenant)}
                                    disabled={!!busy}
                                    title="Activar manualmente sin link de activación"
                                    className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" /> Activar
                                  </button>
                                )}

                                {/* Seed email templates */}
                                <button
                                  onClick={() => doSeedTemplates(tenant.id)}
                                  disabled={!!busy}
                                  title="Crear las plantillas base de email para esta tienda"
                                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 hover:bg-teal-500/20 transition-all disabled:opacity-50"
                                >
                                  <Mail className="w-3.5 h-3.5" /> Sembrar plantillas
                                </button>

                                {/* Migrar datos huérfanos */}
                                <button
                                  onClick={() => doMigrateOrphanData(tenant)}
                                  disabled={actionId === tenant.id + "migrate" || !!busy}
                                  title="Asignar registros sin tienda (datos anteriores a la aislación multi-tenant) a esta tienda"
                                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-all disabled:opacity-50"
                                >
                                  {actionId === tenant.id + "migrate"
                                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    : <Database className="w-3.5 h-3.5" />}
                                  Migrar datos
                                </button>

                                {/* Nota interna */}
                                <button
                                  onClick={() => openNote(tenant)}
                                  disabled={!!busy}
                                  title="Agregar nota interna"
                                  className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl border transition-all disabled:opacity-50 ${
                                    tenantNotes[tenant.id]
                                      ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25"
                                      : "bg-white/[0.04] border-white/10 text-gray-400 hover:text-yellow-300 hover:border-yellow-500/30"
                                  }`}
                                >
                                  <StickyNote className="w-3.5 h-3.5" />
                                  {tenantNotes[tenant.id] ? "Ver nota" : "Agregar nota"}
                                </button>

                                {/* Ver datos */}
                                <button
                                  onClick={() => openTenantData(tenant)}
                                  disabled={!!busy}
                                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
                                >
                                  <Database className="w-3.5 h-3.5" /> Ver datos
                                </button>

                                {/* Eliminar solo datos tenant */}
                                <button
                                  onClick={() => setConfirmDelete({ id: tenant.id, email: tenant.email })}
                                  disabled={!!busy}
                                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-red-900/20 border border-red-700/30 text-red-400 hover:bg-red-900/40 transition-all disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Eliminar tienda
                                </button>

                                {/* Nuclear: borrar TODO incluyendo auth */}
                                <button
                                  onClick={() => {
                                    setNuclearEmail(tenant.email || "");
                                    setNuclearResult(null);
                                    setNuclearModal(true);
                                  }}
                                  disabled={!!busy}
                                  title="Borrar TODO: Auth + tenant + todos los datos"
                                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 hover:bg-red-500/20 font-semibold transition-all disabled:opacity-50"
                                >
                                  <Zap className="w-3.5 h-3.5" /> ☢️ Borrar TODO
                                </button>

                                {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400 self-center ml-1" />}
                              </div>

                              {/* Plan selector */}
                              <div>
                                <p className="text-[11px] text-gray-500 font-semibold mb-2">Cambiar Plan</p>
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    ...PLAN_OPTIONS,
                                  ].map(p => {
                                    const isCurrent = normalizePlan(tenant.effective_plan || tenant.plan) === p.key;
                                    return (
                                      <button
                                        key={p.key}
                                        onClick={() => !isCurrent && doAction(tenant.id, "set_plan", { plan: p.key })}
                                        disabled={!!busy || isCurrent}
                                        className={`flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-all disabled:cursor-default ${
                                          isCurrent
                                            ? `bg-gradient-to-br ${p.color} border-transparent opacity-90`
                                            : "bg-white/[0.03] border-white/10 hover:bg-white/[0.08] disabled:opacity-50"
                                        }`}
                                      >
                                        <span className={`text-xs font-bold ${isCurrent ? "text-white" : "text-gray-300"}`}>
                                          {p.label} {isCurrent && "✓"}
                                        </span>
                                        <span className={`text-[11px] ${isCurrent ? "text-white/70" : "text-gray-600"}`}>{p.sub}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Users list */}
                              <div>
                                <p className="text-[11px] text-gray-500 font-semibold mb-2 flex items-center gap-1.5">
                                  <Users className="w-3.5 h-3.5" /> Usuarios de esta tienda
                                  {Array.isArray(tenantUsers[tenant.id]) && (
                                    <span className="text-[10px] text-gray-600 normal-case tracking-normal">
                                      ({tenantUsers[tenant.id].length}/{getTenantMaxUsers(tenant) || "∞"})
                                    </span>
                                  )}
                                  <button
                                    onClick={() => {
                                      setTenantUsers(prev => { const n = { ...prev }; delete n[tenant.id]; return n; });
                                      loadTenantUsers(tenant.id);
                                    }}
                                    className="ml-1 text-gray-600 hover:text-gray-300 transition-colors"
                                    title="Recargar"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </button>
                                </p>

                                {tenantUsersLoading[tenant.id] ? (
                                  <div className="flex items-center gap-2 text-xs text-gray-600 py-2">
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Cargando usuarios…
                                  </div>
                                ) : !tenantUsers[tenant.id] ? (
                                  <p className="text-xs text-gray-600 py-1">—</p>
                                ) : tenantUsers[tenant.id].length === 0 ? (
                                  <p className="text-xs text-gray-600 py-1">No hay usuarios registrados</p>
                                ) : (
                                  <div className="space-y-1.5">
                                    {tenantUsers[tenant.id].map(emp => {
                                      const roleColor = emp.role === "admin" ? "text-purple-300 bg-purple-500/10 border-purple-500/20"
                                        : emp.role === "manager" ? "text-blue-300 bg-blue-500/10 border-blue-500/20"
                                        : "text-gray-400 bg-white/5 border-white/10";
                                      const isActive = emp.active !== false && emp.status !== "inactive";
                                      const canManageUser = emp.entity_source === "users" || emp.entity_source === "app_employee";
                                      return (
                                        <div key={emp.id} className="flex items-center gap-3 bg-black/20 rounded-xl px-3 py-2">
                                          {/* Avatar */}
                                          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
                                            {(emp.full_name || emp.email || "?")[0].toUpperCase()}
                                          </div>
                                          {/* Name + email */}
                                          <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-white truncate">{emp.full_name || "Sin nombre"}</p>
                                            <p className="text-[11px] text-gray-500 truncate">{emp.email || "—"}</p>
                                          </div>
                                          {/* PIN */}
                                          <span className="hidden sm:inline text-[11px] font-mono text-gray-500 flex-shrink-0">
                                            PIN: {emp.pin || "—"}
                                          </span>
                                          {/* Role */}
                                          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${roleColor}`}>
                                            {emp.role || "user"}
                                          </span>
                                          {/* Status dot */}
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-[11px] text-gray-500 capitalize">{emp.status || "active"}</span>
                                            <div className={`w-2 h-2 rounded-full ${isActive ? "bg-green-400" : "bg-gray-600"}`} title={emp.status} />
                                          </div>
                                          {canManageUser && (
                                            <div className="flex items-center gap-1 flex-shrink-0">
                                              <button
                                                onClick={() => openEditTenantUser(tenant.id, emp)}
                                                className="p-1.5 rounded-lg text-cyan-300 hover:bg-cyan-500/10 transition-all"
                                                title="Editar usuario"
                                              >
                                                <Pencil className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => toggleTenantUser(tenant.id, emp)}
                                                className={`p-1.5 rounded-lg transition-all ${isActive ? "text-yellow-300 hover:bg-yellow-500/10" : "text-green-300 hover:bg-green-500/10"}`}
                                                title={isActive ? "Desactivar usuario" : "Activar usuario"}
                                              >
                                                <Power className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                onClick={() => deleteTenantUser(tenant.id, emp)}
                                                className="p-1.5 rounded-lg text-red-300 hover:bg-red-500/10 transition-all"
                                                title="Eliminar usuario"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === "metrics" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Breakdown by status */}
            <div className="bg-white/[0.025] border border-white/[0.07] rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" /> Estado de Tiendas
              </h3>
              <div className="space-y-3">
                {[
                  { label: "Activas y pagando",  value: metrics.paying,    color: "bg-green-500"  },
                  { label: "En período de trial", value: metrics.trial,     color: "bg-yellow-500" },
                  { label: "Trial vencido",       value: metrics.overdue,   color: "bg-orange-500" },
                  { label: "Suspendidas/Bajas",   value: metrics.suspended, color: "bg-red-500"    },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full ${r.color} flex-shrink-0`} />
                      <span className="text-sm text-gray-400 truncate">{r.label}</span>
                    </div>
                    <span className="font-bold text-white flex-shrink-0">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue */}
            <div className="bg-white/[0.025] border border-white/[0.07] rounded-2xl p-5">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" /> Ingresos Estimados
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-4xl font-semibold text-white">${metrics.mrr}</p>
                  <p className="text-xs text-gray-500 mt-1">MRR real ({metrics.paying} tiendas pagando)</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-emerald-400">${metrics.mrr * 12}</p>
                  <p className="text-xs text-gray-500 mt-1">ARR estimado</p>
                </div>
              </div>
            </div>

            {/* Recent tenants */}
            <div className="bg-white/[0.025] border border-white/[0.07] rounded-2xl p-5 sm:col-span-2">
              <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" /> Últimos 5 Registros
              </h3>
              <div className="space-y-2">
                {[...tenants]
                  .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                  .slice(0, 5)
                  .map(t => {
                    const badge = getStatusBadge(t);
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-3 py-2 border-b border-white/[0.05] last:border-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{t.name || "—"}</p>
                          <p className="text-xs text-gray-500 truncate">{t.email || "—"}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
                          <span className="text-xs text-gray-600">
                            {t.created_date ? new Date(t.created_date).toLocaleDateString("es") : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVIDAD TAB ── */}
        {tab === "activity" && (() => {
          const now = Date.now();
          const onlineNow  = tenants.filter(t => t.last_seen  && (now - new Date(t.last_seen).getTime())  < 4 * 60000).length;
          const active24h  = tenants.filter(t => t.last_login && (now - new Date(t.last_login).getTime()) < 86400000).length;
          const active7d   = tenants.filter(t => t.last_login && (now - new Date(t.last_login).getTime()) < 7*86400000).length;
          const never      = tenants.filter(t => !t.last_login).length;

          // Engagement score: 0-100 basado en actividad recente
          const engagementScore = (tenant) => {
            let score = 0;
            const stats = activityStats[tenant.id] || {};
            if (tenant.last_login) {
              const daysAgo = (now - new Date(tenant.last_login).getTime()) / 86400000;
              if (daysAgo < 1)  score += 40;
              else if (daysAgo < 3)  score += 30;
              else if (daysAgo < 7)  score += 20;
              else if (daysAgo < 14) score += 10;
            }
            if (stats.orders7d  > 10) score += 30;
            else if (stats.orders7d  > 3) score += 20;
            else if (stats.orders7d  > 0) score += 10;
            if (stats.orders30d > 20) score += 30;
            else if (stats.orders30d > 5) score += 20;
            else if (stats.orders30d > 0) score += 10;
            return Math.min(score, 100);
          };

          const engagementBadge = (score) => {
            if (score >= 60) return { label: "Alto",   cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
            if (score >= 30) return { label: "Medio",  cls: "bg-amber-500/15 text-amber-400 border-amber-500/30"       };
            if (score > 0)   return { label: "Bajo",   cls: "bg-orange-500/15 text-orange-400 border-orange-500/30"    };
            return                   { label: "Ninguno", cls: "bg-gray-500/15 text-gray-500 border-gray-500/20"          };
          };

          // At-risk: en trial con < 5 días y no han logueado en 3+ días
          const isAtRisk = (tenant) => {
            const badge = getStatusBadge(tenant);
            const isTrial = badge.label?.includes("Trial") && !badge.label?.includes("vencido");
            if (!isTrial) return false;
            const trialEnd = new Date(tenant.effective_trial_end_date || tenant.trial_end_date);
            const daysLeft = (trialEnd - new Date()) / 86400000;
            if (daysLeft > 5) return false;
            if (!tenant.last_login) return true;
            const lastLoginDays = (now - new Date(tenant.last_login).getTime()) / 86400000;
            return lastLoginDays > 3;
          };

          const atRiskCount = tenants.filter(isAtRisk).length;

          const sorted = [...tenants].sort((a, b) => {
            if (activitySort === "atrisk") {
              const ar = isAtRisk(b) - isAtRisk(a);
              if (ar !== 0) return ar;
            }
            if (activitySort === "engagement") {
              return engagementScore(b) - engagementScore(a);
            }
            if (activitySort === "never") {
              if (!a.last_login && !b.last_login) return 0;
              if (!a.last_login) return -1;
              if (!b.last_login) return 1;
              return 0;
            }
            const aVal = a.last_seen || a.last_login;
            const bVal = b.last_seen || b.last_login;
            if (!aVal && !bVal) return 0;
            if (!aVal) return activitySort === "recent" ? 1 : -1;
            if (!bVal) return activitySort === "recent" ? -1 : 1;
            return activitySort === "recent"
              ? new Date(bVal) - new Date(aVal)
              : new Date(aVal) - new Date(bVal);
          });

          return (
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Online ahora",   value: onlineNow, dot: "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.7)]", color: "text-emerald-400", border: "border-emerald-500/40", bg: "bg-emerald-500/10" },
                  { label: "Activos hoy",    value: active24h, dot: "bg-blue-400",   color: "text-blue-400",   border: "border-blue-500/20",   bg: "bg-blue-500/5"   },
                  { label: "Esta semana",    value: active7d,  dot: "bg-amber-400",  color: "text-amber-400",  border: "border-amber-500/20",  bg: "bg-amber-500/5"  },
                  { label: "En riesgo",      value: atRiskCount, dot: atRiskCount > 0 ? "bg-red-500 animate-pulse" : "bg-gray-600", color: atRiskCount > 0 ? "text-red-400" : "text-gray-500", border: atRiskCount > 0 ? "border-red-500/40" : "border-gray-500/20", bg: atRiskCount > 0 ? "bg-red-500/10" : "bg-gray-500/5" },
                ].map(k => (
                  <div key={k.label} className={`rounded-2xl border ${k.border} ${k.bg} p-4`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${k.dot}`} />
                      <span className={`text-[11px] font-bold tracking-wide ${k.color}`}>{k.label}</span>
                    </div>
                    <p className="text-3xl font-semibold text-white">{k.value}</p>
                    <p className="text-xs text-gray-600 mt-1">tiendas</p>
                  </div>
                ))}
              </div>

              {/* Controls row */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-600 hidden sm:block">Ordenar por:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: "recent",     label: "Más recientes"   },
                      { key: "oldest",     label: "Más antiguos"    },
                      { key: "never",      label: "Sin actividad"   },
                      { key: "engagement", label: "Engagement"      },
                      { key: "atrisk",     label: `⚠️ En riesgo ${atRiskCount > 0 ? `(${atRiskCount})` : ""}` },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => { setActivitySort(opt.key); loadActivityStats(tenants); }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                          activitySort === opt.key
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                            : "bg-white/[0.03] text-gray-500 border-white/[0.07] hover:border-white/20 hover:text-gray-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-gray-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600 animate-pulse" />
                  Auto-refresh 30s
                </p>
              </div>

              {/* Main table */}
              <div className="bg-white/[0.025] border border-white/[0.07] rounded-2xl overflow-hidden">
                {sorted.map((tenant, i) => {
                  const ac       = activityColor(tenant.last_login);
                  const presence = presenceStatus(tenant.last_seen);
                  const ago      = timeAgo(tenant.last_login);
                  const seenAgo  = timeAgo(tenant.last_seen);
                  const badge    = getStatusBadge(tenant);
                  const stats    = activityStats[tenant.id];
                  const score    = engagementScore(tenant);
                  const eng      = engagementBadge(score);
                  const atRisk   = isAtRisk(tenant);

                  // Trial days remaining
                  const trialEnd = tenant.effective_trial_end_date || tenant.trial_end_date;
                  const trialDaysLeft = trialEnd ? Math.ceil((new Date(trialEnd) - new Date()) / 86400000) : null;

                  return (
                    <div
                      key={tenant.id}
                      className={`px-4 py-3.5 ${i < sorted.length - 1 ? "border-b border-white/[0.05]" : ""} ${atRisk ? "bg-red-500/[0.03]" : presence ? "bg-emerald-500/[0.02]" : ""} hover:bg-white/[0.03] transition-colors`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Presencia dot */}
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${presence ? presence.dot : ac.dot}`} />

                        {/* Info principal */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-sm font-bold text-white">{tenant.name || "—"}</p>
                            {atRisk && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/20 border border-red-500/40 text-red-300 font-bold animate-pulse">
                                ⚠️ En riesgo
                              </span>
                            )}
                            {presence && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${presence.badge}`}>
                                {presence.label}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                            <p className="text-[11px] text-gray-600">{tenant.email || "—"}</p>
                            {presence && seenAgo && (
                              <p className="text-[10px] text-emerald-600">Visto {seenAgo}</p>
                            )}
                            {!presence && ago && (
                              <p className="text-[10px] text-gray-600">Último login: {ago}</p>
                            )}
                            {!tenant.last_login && (
                              <p className="text-[10px] text-red-700 font-semibold">Nunca ha entrado</p>
                            )}
                          </div>

                          {/* Stats row */}
                          {stats && (
                            <div className="flex flex-wrap gap-3 mt-1.5">
                              <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                {stats.orders7d} órdenes (7d)
                              </span>
                              <span className="text-[10px] text-gray-600 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                {stats.orders30d} órdenes (30d)
                              </span>
                              <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                Total: {stats.totalOrders}
                              </span>
                            </div>
                          )}
                          {activityStatsLoading && !stats && (
                            <p className="text-[10px] text-gray-700 mt-1">Cargando stats…</p>
                          )}
                        </div>

                        {/* Right side badges */}
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          {/* Plan + status */}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badge.cls}`}>
                            {badge.label}
                          </span>

                          {/* Engagement */}
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${eng.cls}`}>
                            Eng: {eng.label}
                          </span>

                          {/* Trial days */}
                          {trialDaysLeft !== null && trialDaysLeft > 0 && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${trialDaysLeft <= 3 ? "bg-red-500/15 text-red-400 border-red-500/30" : trialDaysLeft <= 7 ? "bg-orange-500/15 text-orange-400 border-orange-500/30" : "bg-gray-500/10 text-gray-500 border-gray-500/20"}`}>
                              {trialDaysLeft}d trial
                            </span>
                          )}

                          {/* Last login date */}
                          {tenant.last_login && (
                            <p className="text-[10px] text-gray-600">
                              {new Date(tenant.last_login).toLocaleDateString("es", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leyenda */}
              <div className="flex flex-wrap gap-4 text-[10px] text-gray-600 px-1">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Online ahora (&lt;4 min)</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Activo hoy</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Esta semana</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Inactivo +30d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-600" /> Sin registro</span>
                <span className="flex items-center gap-1">⚠️ Trial crítico + sin actividad</span>
              </div>
            </div>
          );
        })()}

        {/* ── FEEDBACK TAB ── */}
        {tab === "feedback" && (
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold text-lg">Feedback de tiendas</h2>
                <p className="text-gray-500 text-xs mt-0.5">{feedbackList.length} entradas</p>
              </div>
              <button
                onClick={loadFeedback}
                disabled={feedbackLoading}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                <RefreshCw className={`w-4 h-4 text-gray-400 ${feedbackLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {feedbackLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-600 gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando feedback…</span>
              </div>
            ) : feedbackList.length === 0 ? (
              <div className="text-center py-20">
                <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">Sin feedback aún</p>
              </div>
            ) : (
              <div className="space-y-3">
                {feedbackList.map(fb => {
                  const typeColors = {
                    suggestion: "text-amber-400  bg-amber-400/10  border-amber-400/20",
                    bug:        "text-red-400    bg-red-400/10    border-red-400/20",
                    question:   "text-cyan-400   bg-cyan-400/10   border-cyan-400/20",
                    other:      "text-purple-400 bg-purple-400/10 border-purple-400/20",
                  };
                  const typeLabels = { suggestion: "Sugerencia", bug: "Problema", question: "Pregunta", other: "Otro" };
                  const statusColors = {
                    pending:  "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
                    reviewed: "text-blue-400   bg-blue-400/10   border-blue-400/20",
                    done:     "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
                  };
                  return (
                    <div key={fb.id} className={`bg-white/[0.03] border rounded-2xl p-5 transition-all ${fb.status === "done" ? "border-white/5 opacity-60" : "border-white/10"}`}>
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${typeColors[fb.type] || typeColors.other}`}>
                              {typeLabels[fb.type] || "Otro"}
                            </span>
                            <span className="text-gray-500 text-xs font-semibold">{fb.tenant_name || "Tienda"}</span>
                            {fb.tenant_email && <span className="text-gray-600 text-xs">{fb.tenant_email}</span>}
                            <span className="text-gray-700 text-xs ml-auto">
                              {fb.created_at ? new Date(fb.created_at).toLocaleDateString("es", { day:"2-digit", month:"short", year:"2-digit" }) : "—"}
                            </span>
                          </div>
                          <h3 className="text-white font-bold text-sm">{fb.title}</h3>
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm leading-relaxed mb-4 whitespace-pre-wrap">{fb.message}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[fb.status] || statusColors.pending}`}>
                          {fb.status === "pending" ? "Pendiente" : fb.status === "reviewed" ? "Revisado" : "Resuelto"}
                        </span>
                        <div className="flex items-center gap-1 ml-auto">
                          {fb.status !== "reviewed" && (
                            <button onClick={() => markFeedbackStatus(fb.id, "reviewed")}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all font-semibold">
                              Marcar revisado
                            </button>
                          )}
                          {fb.status !== "done" && (
                            <button onClick={() => markFeedbackStatus(fb.id, "done")}
                              className="text-[11px] px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all font-semibold">
                              Resuelto ✓
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STORAGE TAB ── */}
        {tab === "storage" && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

            {/* Header */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-cyan-400" />
                  Storage por Tienda
                </h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  Archivos organizados por tenant · bucket <span className="text-cyan-400 font-mono">uploads</span>
                </p>
              </div>
              <button
                onClick={() => { setStorageStatsLoaded(false); loadStorageStats(); }}
                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all"
              >
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Breadcrumb + volver */}
            {storageTenantId && (
              <div className="flex items-center gap-2 mb-4 text-xs">
                <button
                  onClick={() => { setStorageTenantId(null); setStorageFiles([]); setStorageFolders([]); setStoragePath([]); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Tiendas
                </button>
                <span className="text-gray-600">/</span>
                <span className="text-cyan-400 font-mono font-bold truncate max-w-[120px]">{storageTenantId}</span>
                {storagePath.map((part, idx) => (
                  <React.Fragment key={idx}>
                    <span className="text-gray-600">/</span>
                    <button
                      onClick={() => browseStoragePath(storageTenantId, storagePath.slice(0, idx + 1))}
                      className="text-gray-300 hover:text-white transition-all"
                    >
                      {part}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Lista de tiendas (pantalla principal) */}
            {!storageTenantId && (
              <>
                {!storageStatsLoaded ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-600 gap-3">
                    <HardDrive className="w-10 h-10 text-gray-700 animate-pulse" />
                    <p className="text-sm">Cargando estadísticas de storage…</p>
                    <p className="text-xs text-gray-700">Esto puede tomar unos segundos</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {tenants.map(tenant => {
                      const stats = storageStats[tenant.id] || { count: 0, size: 0 };
                      return (
                        <button
                          key={tenant.id}
                          onClick={() => openStorageTenant(tenant.id)}
                          className="group text-left p-4 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/5 transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/20 transition-all">
                              <Folder className="w-5 h-5 text-cyan-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-white font-bold text-sm truncate">{tenant.name}</p>
                              <p className="text-gray-500 text-xs truncate font-mono">{tenant.id}</p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="flex items-center gap-1 text-xs text-gray-400">
                                  <File className="w-3 h-3" />
                                  {stats.count} archivo{stats.count !== 1 ? "s" : ""}
                                </span>
                                <span className="text-xs text-gray-500">{fmtBytes(stats.size)}</span>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 transition-all flex-shrink-0 mt-1" />
                          </div>
                        </button>
                      );
                    })}

                    {/* Archivos sin tenant (raíz del bucket - legacy) */}
                    {Object.keys(storageStats).filter(k => !tenants.some(t => t.id === k)).length > 0 && (
                      <div className="col-span-full mt-2">
                        <p className="text-xs text-gray-600 mb-2 font-semibold">
                          Carpetas no asociadas a tienda (archivos legacy)
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {Object.keys(storageStats)
                            .filter(k => !tenants.some(t => t.id === k))
                            .map(key => {
                              const stats = storageStats[key];
                              return (
                                <button
                                  key={key}
                                  onClick={() => openStorageTenant(key)}
                                  className="group text-left p-4 rounded-xl bg-orange-500/5 border border-orange-500/20 hover:border-orange-500/40 transition-all"
                                >
                                  <div className="flex items-center gap-3">
                                    <Folder className="w-5 h-5 text-orange-400" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-gray-300 font-bold text-sm font-mono truncate">{key}</p>
                                      <p className="text-xs text-gray-500">{stats.count} archivos · {fmtBytes(stats.size)}</p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Explorador de archivos de un tenant */}
            {storageTenantId && (
              <>
                {storageLoading ? (
                  <div className="flex items-center justify-center py-16 text-gray-600 gap-3">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Cargando archivos…</span>
                  </div>
                ) : (
                  <>
                    {/* Sub-carpetas (categorías) */}
                    {storageFolders.length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-600 font-semibold mb-2">Carpetas</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {storageFolders.map(folder => (
                            <button
                              key={folder.name}
                              onClick={() => browseStoragePath(storageTenantId, [...storagePath, folder.name])}
                              className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/8 transition-all text-left"
                            >
                              <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
                              <span className="text-gray-300 text-xs font-medium truncate">{folder.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Archivos */}
                    {storageFiles.length === 0 && storageFolders.length === 0 ? (
                      <div className="text-center py-16">
                        <HardDrive className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                        <p className="text-gray-600 text-sm">Esta carpeta está vacía</p>
                      </div>
                    ) : storageFiles.length > 0 ? (
                      <>
                        <p className="text-xs text-gray-600 font-semibold mb-2">
                          Archivos ({storageFiles.length})
                        </p>
                        <div className="space-y-1.5">
                          {storageFiles.map(file => {
                            const pubUrl = getPublicUrl(storageTenantId, storagePath, file.name);
                            const isImage = ["jpg","jpeg","png","gif","webp","svg"].includes(
                              file.name.split(".").pop().toLowerCase()
                            );
                            return (
                              <div
                                key={file.name}
                                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all"
                              >
                                {/* Miniatura o ícono */}
                                <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {isImage ? (
                                    <img
                                      src={pubUrl}
                                      alt={file.name}
                                      className="w-full h-full object-cover rounded-lg"
                                      onError={e => { e.target.style.display = "none"; }}
                                    />
                                  ) : fileIcon(file.name)}
                                </div>

                                {/* Info */}
                                <div className="min-w-0 flex-1">
                                  <p className="text-gray-200 text-xs font-medium truncate">{file.name}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-gray-600 text-[11px]">{fmtBytes(file.metadata?.size)}</span>
                                    {file.created_at && (
                                      <span className="text-gray-700 text-[11px]">
                                        {new Date(file.created_at).toLocaleDateString("es", { day:"2-digit", month:"short", year:"2-digit" })}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Acciones */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                  <a
                                    href={pubUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Abrir"
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 text-gray-400 hover:text-blue-400 transition-all"
                                  >
                                    <Link2 className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    title="Copiar URL"
                                    onClick={() => { navigator.clipboard.writeText(pubUrl); toast.success("URL copiada"); }}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/30 text-gray-400 hover:text-emerald-400 transition-all"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    title="Eliminar"
                                    onClick={() => {
                                      if (confirm(`¿Eliminar "${file.name}"?`)) deleteStorageFile(file.name);
                                    }}
                                    className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Pagos Tab ── */}
        {tab === "payments" && (
          <div className="max-w-3xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold text-lg flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-400" />
                  Métodos de Pago
                </h2>
                <p className="text-gray-500 text-xs mt-0.5">
                  Configura los métodos de pago disponibles para las tiendas SmartFixOS
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowPaymentForm(true); setEditingPaymentMethod(null); setPaymentMethodForm({ name: "", details: "", instructions: "", icon: "💳", enabled: true }); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 text-xs font-semibold transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar método
                </button>
              </div>
            </div>

            {/* Add/Edit Form */}
            {showPaymentForm && (
              <div className="bg-white/[0.04] border border-emerald-500/20 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-white">
                  {editingPaymentMethod !== null ? "Editar método de pago" : "Nuevo método de pago"}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Icono (emoji)</label>
                    <input
                      value={paymentMethodForm.icon}
                      onChange={e => setPaymentMethodForm(f => ({ ...f, icon: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="💳"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Nombre *</label>
                    <input
                      value={paymentMethodForm.name}
                      onChange={e => setPaymentMethodForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="ej: Zelle, PayPal..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Detalles (cuenta/email/usuario)</label>
                    <input
                      value={paymentMethodForm.details}
                      onChange={e => setPaymentMethodForm(f => ({ ...f, details: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="ej: pagos@smartfixos.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1 font-medium">Instrucciones para cliente</label>
                    <input
                      value={paymentMethodForm.instructions}
                      onChange={e => setPaymentMethodForm(f => ({ ...f, instructions: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/10 text-white text-sm rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="ej: Enviar a nombre de..."
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={paymentMethodForm.enabled}
                      onChange={e => setPaymentMethodForm(f => ({ ...f, enabled: e.target.checked }))}
                      className="rounded"
                    />
                    <span className="text-xs text-gray-400">Habilitado por defecto</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={addOrUpdatePaymentMethod}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 text-sm font-semibold transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {editingPaymentMethod !== null ? "Actualizar" : "Agregar"}
                  </button>
                  <button
                    onClick={() => { setShowPaymentForm(false); setEditingPaymentMethod(null); }}
                    className="px-4 py-2 rounded-xl border border-white/10 text-gray-400 hover:text-white text-sm transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Loading */}
            {paymentMethodsLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-600 gap-3">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cargando métodos de pago…</span>
              </div>
            ) : (
              <div className="space-y-2">
                {paymentMethods.length === 0 && (
                  <div className="text-center py-12 text-gray-600">
                    <CreditCard className="w-10 h-10 mx-auto mb-3 text-gray-700" />
                    <p className="text-sm">No hay métodos de pago configurados</p>
                  </div>
                )}
                {paymentMethods.map((method, idx) => (
                  <div
                    key={method.id || idx}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      method.enabled
                        ? "bg-white/[0.04] border-white/[0.08] hover:border-white/20"
                        : "bg-white/[0.02] border-white/[0.04] opacity-60"
                    }`}
                  >
                    {/* Icon */}
                    <span className="text-2xl w-8 text-center flex-shrink-0">{method.icon}</span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold text-sm">{method.name}</p>
                        {method.enabled ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">ACTIVO</span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-500/15 text-gray-500 border border-gray-500/20">INACTIVO</span>
                        )}
                      </div>
                      {method.details && (
                        <p className="text-gray-400 text-xs mt-0.5 truncate">{method.details}</p>
                      )}
                      {method.instructions && (
                        <p className="text-gray-600 text-xs truncate">{method.instructions}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Toggle */}
                      <button
                        onClick={() => togglePaymentMethod(idx)}
                        className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
                          method.enabled
                            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25"
                            : "bg-white/5 border-white/10 text-gray-500 hover:text-white hover:border-white/20"
                        }`}
                        title={method.enabled ? "Desactivar" : "Activar"}
                      >
                        {method.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      {/* Edit */}
                      <button
                        onClick={() => {
                          setEditingPaymentMethod(idx);
                          setPaymentMethodForm({ name: method.name, details: method.details || "", instructions: method.instructions || "", icon: method.icon || "💳", enabled: method.enabled });
                          setShowPaymentForm(true);
                        }}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-blue-400 hover:border-blue-500/30 transition-all"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => deletePaymentMethod(idx)}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:border-red-500/30 transition-all"
                        title="Eliminar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Summary */}
                {paymentMethods.length > 0 && (
                  <div className="mt-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.05] text-xs text-gray-500 flex items-center justify-between">
                    <span>{paymentMethods.filter(m => m.enabled).length} de {paymentMethods.length} métodos activos</span>
                    <button
                      onClick={loadPaymentMethods}
                      className="flex items-center gap-1 text-gray-600 hover:text-white transition-all"
                    >
                      <RefreshCw className="w-3 h-3" /> Recargar
                    </button>
                  </div>
                )}

                {/* Info box */}
                <div className="mt-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <p className="text-xs text-blue-400 font-semibold mb-1">ℹ️ ¿Cómo funciona?</p>
                  <p className="text-xs text-gray-500">
                    Los métodos habilitados aquí estarán disponibles en el POS de todas las tiendas SmartFixOS.
                    Cada tienda puede ver cuáles métodos acepta su taller.
                    Agrega los detalles de cuenta para que aparezcan en los recibos.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
