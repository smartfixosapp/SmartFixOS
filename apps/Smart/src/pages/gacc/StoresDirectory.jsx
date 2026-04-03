/**
 * GACC — Stores Directory
 * Advanced tenant list with filters, sorting, health indicators, bulk actions
 */
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Search, Building2, Filter, ArrowUpDown, ChevronDown, ChevronRight,
  MoreHorizontal, Eye, PauseCircle, PlayCircle, Pencil, Trash2,
  Clock, Mail, UserPlus, Download, RefreshCw, Plus, StickyNote,
  CreditCard, Users, ShoppingBag, Zap, KeyRound, ExternalLink
} from "lucide-react";
import { useGACC, getStatusBadge, presenceStatus, activityColor, timeAgo, getPlanConfig, PLAN_OPTIONS } from "./gaccContext";
import appClient from "@/api/appClient";
import { toast } from "sonner";

// ── Health indicator ─────────────────────────────────────────────────────────
function healthStatus(tenant) {
  const now = Date.now();
  const lastLogin = tenant.last_login ? new Date(tenant.last_login).getTime() : 0;
  const daysSinceLogin = lastLogin ? (now - lastLogin) / 86400000 : 999;
  const sub = tenant.effective_subscription_status || tenant.subscription_status;
  const failedPayments = tenant.failed_payment_attempts || 0;

  if (tenant.status === "suspended" || tenant.status === "cancelled")
    return { level: "dead", color: "bg-gray-600", label: "Inactiva" };
  if (failedPayments >= 2 || sub === "past_due")
    return { level: "critical", color: "bg-red-500 animate-pulse", label: "Critica" };
  if (daysSinceLogin > 30 || failedPayments >= 1)
    return { level: "warning", color: "bg-amber-400", label: "Riesgo" };
  if (daysSinceLogin > 7)
    return { level: "attention", color: "bg-orange-400", label: "Atencion" };
  return { level: "healthy", color: "bg-emerald-400", label: "Saludable" };
}

// ── Filters ──────────────────────────────────────────────────────────────────
const STATUS_FILTERS = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Activas" },
  { key: "trial", label: "Trial" },
  { key: "suspended", label: "Suspendidas" },
  { key: "pending", label: "Sin activar" },
  { key: "cancelled", label: "Canceladas" },
];

const SORT_OPTIONS = [
  { key: "recent", label: "Mas recientes" },
  { key: "oldest", label: "Mas antiguas" },
  { key: "mrr-high", label: "Mayor MRR" },
  { key: "mrr-low", label: "Menor MRR" },
  { key: "activity", label: "Ultima actividad" },
  { key: "health", label: "Salud (peores primero)" },
  { key: "name", label: "Nombre A-Z" },
];

// ── Store Row ────────────────────────────────────────────────────────────────
function StoreRow({ tenant, onSelect, onAction }) {
  const badge = getStatusBadge(tenant);
  const presence = presenceStatus(tenant.last_seen);
  const ac = activityColor(tenant.last_login);
  const health = healthStatus(tenant);
  const planConfig = getPlanConfig(tenant.effective_plan || tenant.plan);
  const ago = timeAgo(tenant.last_seen || tenant.last_login);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="group flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-0">
      {/* Health dot */}
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${health.color}`} title={health.label} />

      {/* Store info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(tenant)}>
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-bold text-white truncate">{tenant.name || "--"}</p>
          {presence && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md border font-bold ${presence.badge}`}>
              {presence.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[11px] text-gray-600 truncate">{tenant.email}</p>
          {tenant.country && <span className="text-[10px] text-gray-700">{tenant.country}</span>}
        </div>
      </div>

      {/* Plan */}
      <div className="hidden sm:block flex-shrink-0 text-center w-20">
        <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${planConfig.color} text-white font-bold`}>
          {planConfig.label}
        </span>
      </div>

      {/* Status */}
      <div className="flex-shrink-0 w-24 text-right">
        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* MRR */}
      <div className="hidden md:block flex-shrink-0 w-16 text-right">
        <p className="text-[12px] font-bold text-white tabular-nums">${tenant.effective_monthly_cost || 0}</p>
        <p className="text-[9px] text-gray-700">/mo</p>
      </div>

      {/* Last active */}
      <div className="hidden lg:block flex-shrink-0 w-24 text-right">
        <p className="text-[11px] text-gray-500">{ago || "Nunca"}</p>
      </div>

      {/* Actions */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl bg-[#141416] border border-white/[0.1] shadow-2xl py-1">
              {[
                { label: "Ver ficha", icon: Eye, action: "view" },
                { label: "Editar", icon: Pencil, action: "edit" },
                tenant.status === "suspended"
                  ? { label: "Reactivar", icon: PlayCircle, action: "reactivate", color: "text-emerald-400" }
                  : { label: "Suspender", icon: PauseCircle, action: "suspend", color: "text-amber-400" },
                { label: "Extender trial", icon: Clock, action: "extend_trial" },
                { label: "Cambiar plan", icon: CreditCard, action: "set_plan" },
                { label: "Reset password", icon: KeyRound, action: "reset_password" },
                { label: "Enviar email", icon: Mail, action: "email" },
                { label: "Nota interna", icon: StickyNote, action: "note" },
                { divider: true },
                { label: "Eliminar", icon: Trash2, action: "delete", color: "text-red-400" },
              ].map((item, i) => {
                if (item.divider) return <div key={i} className="my-1 border-t border-white/[0.06]" />;
                return (
                  <button
                    key={item.action}
                    onClick={() => { setMenuOpen(false); onAction(item.action, tenant); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-white/[0.05] transition-colors ${
                      item.color || "text-gray-400 hover:text-white"
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Stores Directory ────────────────────────────────────────────────────
export default function StoresDirectory({ onSelectTenant }) {
  const { tenants, loading, metrics, refresh } = useGACC();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [showFilters, setShowFilters] = useState(false);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = [...tenants];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        (t.name || "").toLowerCase().includes(q) ||
        (t.email || "").toLowerCase().includes(q) ||
        (t.slug || "").toLowerCase().includes(q) ||
        (t.admin_phone || "").includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter(t => {
        if (statusFilter === "trial") {
          const te = t.effective_trial_end_date || t.trial_end_date;
          return te && new Date(te) > new Date() && t.status === "active";
        }
        if (statusFilter === "pending") return t.metadata?.setup_complete === false;
        return t.status === statusFilter;
      });
    }

    // Plan filter
    if (planFilter !== "all") {
      list = list.filter(t => (t.effective_plan || t.plan) === planFilter);
    }

    // Sort
    const healthOrder = { critical: 0, warning: 1, attention: 2, healthy: 3, dead: 4 };
    list.sort((a, b) => {
      switch (sortBy) {
        case "recent": return new Date(b.created_date || 0) - new Date(a.created_date || 0);
        case "oldest": return new Date(a.created_date || 0) - new Date(b.created_date || 0);
        case "mrr-high": return (b.effective_monthly_cost || 0) - (a.effective_monthly_cost || 0);
        case "mrr-low": return (a.effective_monthly_cost || 0) - (b.effective_monthly_cost || 0);
        case "activity": {
          const aDate = a.last_seen || a.last_login || "";
          const bDate = b.last_seen || b.last_login || "";
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          return new Date(bDate) - new Date(aDate);
        }
        case "health": return (healthOrder[healthStatus(a).level] || 5) - (healthOrder[healthStatus(b).level] || 5);
        case "name": return (a.name || "").localeCompare(b.name || "", "es");
        default: return 0;
      }
    });

    return list;
  }, [tenants, search, statusFilter, planFilter, sortBy]);

  const handleAction = async (action, tenant) => {
    if (action === "view") {
      onSelectTenant?.(tenant);
      return;
    }

    // Actions via manageTenant function
    if (["suspend", "reactivate", "extend_trial", "reset_password"].includes(action)) {
      try {
        const confirmMsg = {
          suspend: `Suspender "${tenant.name}"?`,
          reactivate: `Reactivar "${tenant.name}"?`,
          extend_trial: `Extender trial 15 dias para "${tenant.name}"?`,
          reset_password: `Enviar reset de password a "${tenant.name}"?`,
        }[action];
        if (!confirm(confirmMsg)) return;

        await appClient.functions.manageTenant({ tenantId: tenant.id, action });
        toast.success(`${action} ejecutado para ${tenant.name}`);
        refresh();
      } catch (e) {
        toast.error(e.message || "Error ejecutando accion");
      }
      return;
    }

    if (action === "delete") {
      if (!confirm(`ELIMINAR permanentemente "${tenant.name}"? Esta accion NO se puede deshacer.`)) return;
      if (!confirm(`CONFIRMAR: Se eliminaran todos los datos de "${tenant.name}". Continuar?`)) return;
      try {
        await appClient.functions.manageTenant({ tenantId: tenant.id, action: "delete" });
        toast.success(`${tenant.name} eliminada`);
        refresh();
      } catch (e) {
        toast.error(e.message || "Error eliminando tienda");
      }
      return;
    }

    // Other actions (edit, email, note, set_plan) -> open store detail
    onSelectTenant?.(tenant, action);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-white">Stores</h2>
          <p className="text-[11px] text-gray-600">{filtered.length} de {tenants.length} tiendas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={loading}
            className="p-2 rounded-xl text-gray-600 hover:text-white border border-white/[0.07] hover:border-white/[0.15] transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all">
            <Plus className="w-3.5 h-3.5" />
            Invitar Tienda
          </button>
        </div>
      </div>

      {/* Search + Filters bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, slug..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[13px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter pills */}
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.05]">
            {STATUS_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                  statusFilter === f.key
                    ? "bg-white/[0.1] text-white"
                    : "text-gray-600 hover:text-gray-400"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[11px] text-gray-400 outline-none cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>

          {/* Plan filter */}
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[11px] text-gray-400 outline-none cursor-pointer"
          >
            <option value="all">Todos los planes</option>
            {PLAN_OPTIONS.map(p => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table header */}
      <div className="hidden sm:flex items-center gap-3 px-4 py-2 text-[10px] text-gray-600 uppercase tracking-wide font-bold border-b border-white/[0.06]">
        <span className="w-2.5" />
        <span className="flex-1">Tienda</span>
        <span className="w-20 text-center">Plan</span>
        <span className="w-24 text-right">Estado</span>
        <span className="hidden md:block w-16 text-right">MRR</span>
        <span className="hidden lg:block w-24 text-right">Actividad</span>
        <span className="w-8" />
      </div>

      {/* Store list */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden">
        {loading && tenants.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 animate-spin text-gray-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="w-8 h-8 text-gray-700 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No se encontraron tiendas</p>
            {search && <p className="text-[11px] text-gray-700 mt-1">Intenta con otra busqueda</p>}
          </div>
        ) : (
          filtered.map(tenant => (
            <StoreRow
              key={tenant.id}
              tenant={tenant}
              onSelect={t => onSelectTenant?.(t)}
              onAction={handleAction}
            />
          ))
        )}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between text-[10px] text-gray-700 px-1">
        <span>{filtered.length} tiendas mostradas</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Saludable</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Riesgo</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Critica</span>
          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-600" /> Inactiva</span>
        </div>
      </div>
    </div>
  );
}
