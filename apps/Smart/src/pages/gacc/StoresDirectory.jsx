/**
 * GACC — Stores Directory
 * Advanced tenant list with filters, sorting, health indicators, bulk actions
 */
import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Building2, Filter, ArrowUpDown, ChevronDown, ChevronRight,
  MoreHorizontal, Eye, PauseCircle, PlayCircle, Pencil, Trash2,
  Clock, Mail, UserPlus, Download, RefreshCw, Plus, StickyNote,
  CreditCard, Users, ShoppingBag, Zap, KeyRound, ExternalLink,
  XCircle, CheckCircle, Send
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
function StoreRow({ tenant, onSelect, onAction, isSelected, onToggleSelect }) {
  const badge = getStatusBadge(tenant);
  const presence = presenceStatus(tenant.last_seen);
  const ac = activityColor(tenant.last_login);
  const health = healthStatus(tenant);
  const planConfig = getPlanConfig(tenant.effective_plan || tenant.plan);
  const ago = timeAgo(tenant.last_seen || tenant.last_login);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = React.useRef(null);

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
      <div className="flex-shrink-0">
        <button
          ref={btnRef}
          onClick={() => {
            if (!menuOpen && btnRef.current) {
              const rect = btnRef.current.getBoundingClientRect();
              setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 });
            }
            setMenuOpen(!menuOpen);
          }}
          className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.06] transition-all opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>

        {menuOpen && createPortal(
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setMenuOpen(false)} />
            <div
              className="fixed z-[9999] w-48 rounded-xl bg-[#141416] border border-white/[0.1] shadow-2xl py-1"
              style={{ top: menuPos.top, left: Math.max(8, menuPos.left) }}
            >
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
          </>,
          document.body
        )}
      </div>
    </div>
  );
}

// ── Export CSV ───────────────────────────────────────────────────────────────
function exportToCSV(tenants, filename = "tiendas") {
  const headers = ["Nombre", "Email", "Plan", "MRR", "Status", "Pais", "Creada", "Ultimo Login"];
  const rows = tenants.map(t => [
    t.name || "",
    t.email || "",
    getPlanConfig(t.effective_plan || t.plan).label,
    t.effective_monthly_cost || 0,
    t.status || "",
    t.country || "",
    t.created_date ? new Date(t.created_date).toLocaleDateString("es") : "",
    t.last_login ? new Date(t.last_login).toLocaleDateString("es") : "Nunca",
  ]);
  const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast.success(`Exportado ${rows.length} tiendas a CSV`);
}

// ── Invite Store Modal ───────────────────────────────────────────────────────
function InviteStoreModal({ open, onClose }) {
  const { appClient, refresh } = useGACC();
  const [form, setForm] = useState({ ownerName: "", email: "", businessName: "", plan: "smartfixos" });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleInvite = async () => {
    if (!form.email.trim() || !form.businessName.trim()) { toast.error("Email y nombre del negocio son requeridos"); return; }
    setSending(true);
    setResult(null);
    try {
      const res = await appClient.functions.createTenant({
        ownerName: form.ownerName.trim(),
        email: form.email.trim(),
        businessName: form.businessName.trim(),
        plan: form.plan,
      });
      setResult({ success: true, name: form.businessName });
      toast.success(`Tienda "${form.businessName}" creada`);
      refresh();
    } catch (e) {
      toast.error("Error: " + e.message);
      setResult({ success: false, error: e.message });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    setForm({ ownerName: "", email: "", businessName: "", plan: "smartfixos" });
    setResult(null);
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-[#141416] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <p className="text-[14px] font-bold text-white">Invitar Nueva Tienda</p>
            <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.05]">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {result?.success ? (
            <div className="px-5 py-8 text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
              <p className="text-lg font-bold text-white">Tienda Creada</p>
              <p className="text-[12px] text-gray-500">"{result.name}" esta lista con 15 dias de trial.</p>
              <button onClick={handleClose} className="px-4 py-2 rounded-xl text-[12px] font-semibold bg-white/[0.05] text-white border border-white/[0.1] hover:bg-white/[0.1] transition-all">
                Cerrar
              </button>
            </div>
          ) : (
            <>
              <div className="px-5 py-4 space-y-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">Nombre del Negocio <span className="text-red-400">*</span></p>
                  <input value={form.businessName} onChange={e => update("businessName", e.target.value)} placeholder="Mi Taller de Reparacion"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[13px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">Email <span className="text-red-400">*</span></p>
                  <input type="email" value={form.email} onChange={e => update("email", e.target.value)} placeholder="dueño@taller.com"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[13px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">Nombre del Contacto</p>
                  <input value={form.ownerName} onChange={e => update("ownerName", e.target.value)} placeholder="Juan Perez"
                    className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[13px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">Plan</p>
                  <div className="flex gap-2">
                    {PLAN_OPTIONS.map(p => (
                      <button key={p.key} onClick={() => update("plan", p.key)}
                        className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all ${
                          form.plan === p.key ? "border-purple-500/50 bg-purple-500/10 text-white" : "border-white/[0.06] text-gray-600 hover:text-white"
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
                <button onClick={handleClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 hover:text-white transition-all">Cancelar</button>
                <button onClick={handleInvite} disabled={sending}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[12px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all disabled:opacity-50">
                  {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Crear Tienda
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
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
  const [showInvite, setShowInvite] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [savedViews, setSavedViews] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gacc_saved_views") || "[]"); }
    catch { return []; }
  });
  const [viewName, setViewName] = useState("");
  const [showSaveView, setShowSaveView] = useState(false);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(t => t.id)));
  };

  const bulkAction = async (action) => {
    const selected = tenants.filter(t => selectedIds.has(t.id));
    if (selected.length === 0) return;
    if (!confirm(`Ejecutar "${action}" en ${selected.length} tiendas?`)) return;

    try {
      for (const t of selected) {
        try {
          await appClient.functions.manageTenant({ tenantId: t.id, action });
        } catch (e) { console.warn(`Error en ${t.name}:`, e.message); }
      }
      toast.success(`${action} ejecutado en ${selected.length} tiendas`);
      setSelectedIds(new Set());
      refresh();
    } catch (e) {
      toast.error("Error: " + e.message);
    }
  };

  const saveView = () => {
    if (!viewName.trim()) return;
    const view = { name: viewName.trim(), search, statusFilter, planFilter, sortBy, id: Date.now().toString() };
    const newViews = [...savedViews, view];
    setSavedViews(newViews);
    localStorage.setItem("gacc_saved_views", JSON.stringify(newViews));
    setViewName("");
    setShowSaveView(false);
    toast.success(`Vista "${view.name}" guardada`);
  };

  const loadView = (view) => {
    setSearch(view.search || "");
    setStatusFilter(view.statusFilter || "all");
    setPlanFilter(view.planFilter || "all");
    setSortBy(view.sortBy || "recent");
    toast.success(`Vista "${view.name}" aplicada`);
  };

  const deleteView = (id) => {
    const newViews = savedViews.filter(v => v.id !== id);
    setSavedViews(newViews);
    localStorage.setItem("gacc_saved_views", JSON.stringify(newViews));
  };

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
          <button
            onClick={() => exportToCSV(filtered)}
            className="p-2 rounded-xl text-gray-600 hover:text-white border border-white/[0.07] hover:border-white/[0.15] transition-all"
            title="Exportar CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all"
          >
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

      {/* Saved Views + Bulk Actions Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {savedViews.length > 0 && (
            <>
              <span className="text-[10px] text-gray-600 uppercase tracking-wide font-bold">Vistas:</span>
              {savedViews.map(v => (
                <div key={v.id} className="group flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]">
                  <button onClick={() => loadView(v)} className="text-[10px] text-gray-400 hover:text-white font-semibold">
                    {v.name}
                  </button>
                  <button onClick={() => deleteView(v.id)} className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400">
                    <XCircle className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </>
          )}
          {!showSaveView ? (
            <button onClick={() => setShowSaveView(true)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-gray-600 hover:text-white border border-white/[0.06] hover:border-white/[0.12] transition-all">
              <Plus className="w-3 h-3" /> Guardar vista
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <input value={viewName} onChange={e => setViewName(e.target.value)} placeholder="Nombre..." autoFocus className="w-28 px-2 py-1 rounded-lg bg-white/[0.05] border border-white/[0.1] text-[10px] text-white outline-none" />
              <button onClick={saveView} className="p-1 rounded-lg text-emerald-400 hover:bg-emerald-500/10">
                <CheckCircle className="w-3 h-3" />
              </button>
              <button onClick={() => { setShowSaveView(false); setViewName(""); }} className="p-1 rounded-lg text-gray-600 hover:text-white">
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
            <span className="text-[11px] text-purple-300 font-semibold">{selectedIds.size} seleccionadas</span>
            <button onClick={() => bulkAction("suspend")} className="text-[10px] px-2 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25">
              Suspender
            </button>
            <button onClick={() => bulkAction("reactivate")} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25">
              Reactivar
            </button>
            <button onClick={() => bulkAction("extend_trial")} className="text-[10px] px-2 py-1 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25">
              Extender Trial
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-[10px] px-2 py-1 rounded-lg text-gray-500 hover:text-white">
              Limpiar
            </button>
          </div>
        )}
      </div>

      {/* Table header */}
      <div className="hidden sm:flex items-center gap-3 px-4 py-2 text-[10px] text-gray-600 uppercase tracking-wide font-bold border-b border-white/[0.06]">
        <input
          type="checkbox"
          checked={selectedIds.size > 0 && selectedIds.size === filtered.length}
          onChange={selectAll}
          className="w-3 h-3 accent-purple-500 cursor-pointer"
        />
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

      {/* Invite modal */}
      <InviteStoreModal open={showInvite} onClose={() => setShowInvite(false)} />
    </div>
  );
}
