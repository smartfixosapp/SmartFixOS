import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import appClient from "@/api/appClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Building2, CheckCircle, XCircle, Clock, DollarSign,
  Search, RefreshCw, LogOut, AlertTriangle, TrendingUp,
  Users, Mail, Calendar, ChevronDown, ChevronRight, Eye,
  PlayCircle, PauseCircle, Trash2, BarChart3, Activity, Power,
  Pencil, KeyRound, X, Save
} from "lucide-react";

const SUPER_SESSION_KEY = "smartfix_saas_session";
const SUPER_ADMIN_EMAIL  = "smartfixosapp@gmail.com";
const PLAN_OPTIONS = [
  { key: "smartfixos", label: "Basic", sub: "1 usuario · $55/mo", maxUsers: 1, monthlyCost: 55, color: "from-slate-500 to-slate-600" },
  { key: "pro", label: "Pro", sub: "3 usuarios · $85/mo", maxUsers: 3, monthlyCost: 85, color: "from-blue-500 to-indigo-600" },
  { key: "enterprise", label: "Enterprise", sub: "Ilimitado · Consultoría", maxUsers: 999, monthlyCost: 0, color: "from-purple-500 to-pink-600" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  const [tab,        setTab]          = useState("tenants"); // tenants | metrics
  const [tenantUsers,        setTenantUsers]        = useState({}); // { [tenantId]: [] }
  const [tenantUsersLoading, setTenantUsersLoading] = useState({}); // { [tenantId]: bool }
  const [confirmDelete,      setConfirmDelete]      = useState(null); // tenantId to confirm delete
  const [editTenant,         setEditTenant]         = useState(null); // { id, name, email } being edited
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

  // ── Auth guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem(SUPER_SESSION_KEY);
    if (!raw) { navigate("/PinAccess", { replace: true }); return; }
    try {
      const sess = JSON.parse(raw);
      if (sess?.role !== "saas_owner") { navigate("/PinAccess", { replace: true }); return; }
    } catch {
      navigate("/PinAccess", { replace: true }); return;
    }
    setAuthorized(true);
    loadTenants();
  }, []);

  // ── Data ──────────────────────────────────────────────────────────────────
  const loadTenants = async () => {
    setLoading(true);
    try {
      const [tenantRows, subscriptionRows] = await Promise.all([
        appClient.entities.Tenant.list("-created_date", 500),
        supabase
          .from("subscription")
          .select("id, tenant_id, plan, status, amount, trial_end_date, next_billing_date, created_at")
          .order("created_at", { ascending: false }),
      ]);

      const subscriptionsByTenant = new Map();
      for (const row of subscriptionRows?.data || []) {
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
    if (tenantUsers[tenantId]) return; // already loaded
    setTenantUsersLoading(prev => ({ ...prev, [tenantId]: true }));
    try {
      const tenantRecord = tenants.find((candidate) => candidate.id === tenantId);
      const [{ data: userRows, error: usersError }, { data: employeeRows, error: employeesError }] = await Promise.all([
        supabase
          .from("users")
          .select("id, auth_id, full_name, email, role, status, pin, position, phone, employee_code, hourly_rate, active")
          .eq("tenant_id", tenantId)
          .order("full_name"),
        supabase
          .from("app_employee")
          .select("id, full_name, email, role, status, pin, position, phone, employee_code, hourly_rate, active")
          .eq("tenant_id", tenantId)
          .order("full_name"),
      ]);

      if (usersError) throw usersError;
      if (employeesError) throw employeesError;

      const ownerFallback = tenantRecord?.email ? [{
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

  const toggleExpanded = useCallback((tenantId) => {
    const opening = expanded !== tenantId;
    setExpanded(opening ? tenantId : null);
    if (opening) loadTenantUsers(tenantId);
  }, [expanded, loadTenantUsers]);

  const doAction = async (tenantId, action, extra = {}) => {
    setActionId(tenantId + action);
    try {
      const res = await fetch('/api/manage-tenant', {
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

  const doDelete = async (tenantId) => {
    setActionId(tenantId + "delete");
    try {
      const res = await fetch('/api/delete-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
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

  const doEditSave = async () => {
    if (!editTenant) return;
    setActionId(editTenant.id + "edit");
    try {
      const res = await fetch('/api/manage-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: editTenant.id, action: 'edit', ...editForm }),
      });
      const data = await res.json();
      if (data?.success) {
        toast.success(data.message || "✅ Guardado");
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

  const doSeedTemplates = async (tenantId) => {
    setActionId(tenantId + "seed");
    try {
      const res = await fetch('/api/seed-email-templates', {
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
      const res = await fetch('/api/manage-tenant', {
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

  const handleLogout = () => {
    localStorage.removeItem(SUPER_SESSION_KEY);
    localStorage.removeItem("smartfix_saved_creds"); // evita auto-login al salir
    navigate("/PinAccess", { replace: true });
  };

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metrics = React.useMemo(() => {
    const active    = tenants.filter(t => t.status === "active");
    const onTrial   = active.filter(t => (t.effective_trial_end_date || t.trial_end_date) && new Date(t.effective_trial_end_date || t.trial_end_date) > new Date());
    const paying    = active.filter(t => (t.effective_subscription_status || t.subscription_status) === "active");
    const suspended = tenants.filter(t => t.status === "suspended" || t.status === "cancelled");
    const overdue   = active.filter(t => (t.effective_trial_end_date || t.trial_end_date) && new Date(t.effective_trial_end_date || t.trial_end_date) < new Date() && (t.effective_subscription_status || t.subscription_status) !== "active");
    return {
      total:     tenants.length,
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
    <div className="min-h-screen bg-[#030303] text-white font-sans">

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

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={doEditSave}
                  disabled={!!actionId}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" /> Guardar cambios
                </button>
                <button
                  onClick={() => doResetPassword(editForm.email || editTenant?.email)}
                  disabled={!!actionId}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 text-sm font-semibold hover:bg-yellow-500/20 transition-all disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" /> Enviar reset de contraseña
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
                  onClick={() => doDelete(confirmDelete)}
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

      {/* ── Top bar ── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/70 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.4)]">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="leading-none">
              <p className="text-sm font-black text-white tracking-tight">SmartFixOS</p>
              <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest">Control Panel</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-xl p-1">
            {[
              { key: "tenants", label: "Tiendas",  icon: Building2  },
              { key: "metrics", label: "Métricas", icon: BarChart3   },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tab === t.key
                    ? "bg-white/10 text-white shadow"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors px-3 py-1.5 rounded-full border border-white/10 hover:border-red-500/30"
          >
            <LogOut className="w-3.5 h-3.5" /> Salir
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "Total",     value: metrics.total,     icon: Building2,   grad: "from-blue-500 to-cyan-500"    },
            { label: "Activas",   value: metrics.active,    icon: CheckCircle, grad: "from-green-500 to-emerald-500"},
            { label: "Trial",     value: metrics.trial,     icon: Clock,       grad: "from-yellow-500 to-amber-500" },
            { label: "Pagando",   value: metrics.paying,    icon: DollarSign,  grad: "from-purple-500 to-pink-500"  },
            { label: "Vencidas",  value: metrics.overdue,   icon: AlertTriangle,grad:"from-orange-500 to-red-500"  },
            { label: "MRR",       value: `$${metrics.mrr}`, icon: TrendingUp,  grad: "from-cyan-500 to-blue-500"   },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 space-y-2"
            >
              <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${m.grad} flex items-center justify-center`}>
                <m.icon className="w-4 h-4 text-white" />
              </div>
              <p className="text-2xl font-black">{m.value}</p>
              <p className="text-[11px] text-gray-500 font-medium">{m.label}</p>
            </motion.div>
          ))}
        </div>

        {tab === "tenants" && (
          <>
            {/* ── Search bar ── */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Buscar tienda, email o slug..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-xl pl-9 pr-4 h-10 focus:outline-none focus:ring-2 focus:ring-purple-500/40 placeholder-gray-600"
                />
              </div>
              <button
                onClick={loadTenants}
                disabled={loading}
                className="h-10 w-10 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/[0.08] flex items-center justify-center transition-all disabled:opacity-40"
              >
                <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? "animate-spin" : ""}`} />
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
                      className="bg-white/[0.025] border border-white/[0.07] rounded-2xl overflow-hidden hover:bg-white/[0.045] transition-all"
                    >
                      {/* Row */}
                      <div className="flex items-center gap-3 p-4">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-purple-500/20 flex items-center justify-center font-black text-purple-300 text-sm flex-shrink-0">
                          {(tenant.name || "?")[0].toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-sm truncate">{tenant.name || "Sin nombre"}</p>
                          <p className="text-xs text-gray-500 truncate">{tenant.email || "—"}</p>
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

                                {/* Seed email templates */}
                                <button
                                  onClick={() => doSeedTemplates(tenant.id)}
                                  disabled={!!busy}
                                  title="Crear las plantillas base de email para esta tienda"
                                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 hover:bg-teal-500/20 transition-all disabled:opacity-50"
                                >
                                  <Mail className="w-3.5 h-3.5" /> Sembrar plantillas
                                </button>

                                {/* Delete */}
                                <button
                                  onClick={() => setConfirmDelete(tenant.id)}
                                  disabled={!!busy}
                                  className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-red-900/20 border border-red-700/30 text-red-400 hover:bg-red-900/40 transition-all disabled:opacity-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                </button>

                                {busy && <RefreshCw className="w-3.5 h-3.5 animate-spin text-gray-400 self-center ml-1" />}
                              </div>

                              {/* Plan selector */}
                              <div>
                                <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-widest mb-2">Cambiar Plan</p>
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
                                <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-widest mb-2 flex items-center gap-1.5">
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
                                      const isActive = emp.status === "active";
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
                  <p className="text-4xl font-black text-white">${metrics.mrr}</p>
                  <p className="text-xs text-gray-500 mt-1">MRR real ({metrics.paying} tiendas pagando)</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-400">${metrics.mrr * 12}</p>
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
      </main>
    </div>
  );
}
