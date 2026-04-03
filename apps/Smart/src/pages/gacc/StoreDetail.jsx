/**
 * GACC — Store Detail (Ficha Interna de Tienda)
 * Tabs: Overview, Subscription, Activity, Employees, Support Notes, Audit
 */
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Building2, Mail, Phone, Globe, MapPin, Calendar,
  Users, ShoppingBag, DollarSign, CreditCard, Activity, Clock,
  Shield, Pencil, PauseCircle, PlayCircle, Trash2, KeyRound,
  ChevronRight, RefreshCw, Copy, ExternalLink, Eye, StickyNote,
  Send, CheckCircle, XCircle, AlertTriangle, MoreHorizontal
} from "lucide-react";
import { useGACC, getStatusBadge, presenceStatus, timeAgo, getPlanConfig, PLAN_OPTIONS } from "./gaccContext";
import { toast } from "sonner";

// ── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: "overview", label: "Overview", icon: Eye },
  { key: "subscription", label: "Subscription", icon: CreditCard },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "employees", label: "Employees", icon: Users },
  { key: "notes", label: "Notes", icon: StickyNote },
  { key: "audit", label: "Audit", icon: Shield },
];

// ── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ tenant }) {
  const planConfig = getPlanConfig(tenant.effective_plan || tenant.plan);
  const badge = getStatusBadge(tenant);
  const daysAsCustomer = tenant.created_date
    ? Math.floor((Date.now() - new Date(tenant.created_date).getTime()) / 86400000)
    : 0;

  return (
    <div className="space-y-6">
      {/* Quick KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Plan", value: planConfig.label, sub: `$${tenant.effective_monthly_cost || 0}/mo` },
          { label: "Dias como cliente", value: daysAsCustomer, sub: tenant.created_date ? new Date(tenant.created_date).toLocaleDateString("es") : "--" },
          { label: "Ultimo acceso", value: timeAgo(tenant.last_login) || "Nunca", sub: tenant.last_login ? new Date(tenant.last_login).toLocaleDateString("es") : "" },
          { label: "Empleados max", value: tenant.effective_max_users || "--", sub: `Plan: ${planConfig.maxUsers}` },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold">{k.label}</p>
            <p className="text-lg font-black text-white mt-1">{k.value}</p>
            {k.sub && <p className="text-[10px] text-gray-600">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Contact info */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide">Informacion de Contacto</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: Mail, label: "Email", value: tenant.email },
            { icon: Phone, label: "Telefono", value: tenant.admin_phone || "--" },
            { icon: Users, label: "Admin", value: tenant.admin_name || "--" },
            { icon: Globe, label: "Pais", value: tenant.country || "--" },
            { icon: MapPin, label: "Direccion", value: tenant.address || "--" },
            { icon: Clock, label: "Timezone", value: tenant.timezone || "--" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <item.icon className="w-4 h-4 text-gray-600 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-600">{item.label}</p>
                <p className="text-[12px] text-white truncate">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Config / Metadata */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide">Configuracion</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          <div>
            <p className="text-gray-600">Slug</p>
            <p className="text-white font-mono">{tenant.slug || "--"}</p>
          </div>
          <div>
            <p className="text-gray-600">Moneda</p>
            <p className="text-white">{tenant.currency || "USD"}</p>
          </div>
          <div>
            <p className="text-gray-600">Metodo de pago</p>
            <p className="text-white">{tenant.payment_method || "--"}</p>
          </div>
          <div>
            <p className="text-gray-600">Setup completo</p>
            <p className="text-white">{tenant.metadata?.setup_complete === false ? "No" : "Si"}</p>
          </div>
        </div>
        {tenant.stripe_customer_id && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-gray-600">Stripe ID:</span>
            <code className="text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{tenant.stripe_customer_id}</code>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Subscription Tab ─────────────────────────────────────────────────────────
function SubscriptionTab({ tenant }) {
  const { subscriptions } = useGACC();
  const tenantSubs = useMemo(() =>
    subscriptions.filter(s => s.tenant_id === tenant.id).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [subscriptions, tenant.id]
  );

  return (
    <div className="space-y-4">
      {/* Current subscription */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide">Suscripcion Actual</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-[10px] text-gray-600">Plan</p>
            <p className="text-sm font-bold text-white">{getPlanConfig(tenant.effective_plan).label}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-600">Monto</p>
            <p className="text-sm font-bold text-white">${tenant.effective_monthly_cost || 0}/mo</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-600">Proximo cobro</p>
            <p className="text-sm text-white">{tenant.next_billing_date || "--"}</p>
          </div>
          <div>
            <p className="text-[10px] text-gray-600">Intentos fallidos</p>
            <p className={`text-sm font-bold ${(tenant.failed_payment_attempts || 0) > 0 ? "text-red-400" : "text-white"}`}>
              {tenant.failed_payment_attempts || 0}
            </p>
          </div>
        </div>
        {tenant.last_payment_date && (
          <div className="text-[11px] text-gray-500">
            Ultimo pago: ${tenant.last_payment_amount || 0} el {new Date(tenant.last_payment_date).toLocaleDateString("es")}
          </div>
        )}
      </div>

      {/* Subscription history */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide">Historial de Suscripciones</p>
        {tenantSubs.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">Sin registros</p>
        ) : (
          <div className="space-y-2">
            {tenantSubs.map(sub => (
              <div key={sub.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div>
                  <p className="text-[12px] text-white font-semibold">{getPlanConfig(sub.plan).label} - ${sub.amount}/mo</p>
                  <p className="text-[10px] text-gray-600">
                    {sub.created_at ? new Date(sub.created_at).toLocaleDateString("es") : "--"}
                    {sub.cancellation_date && ` — Cancelado ${new Date(sub.cancellation_date).toLocaleDateString("es")}`}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                  sub.status === "active" ? "bg-green-500/15 text-green-400 border-green-500/30"
                  : sub.status === "past_due" ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                  : sub.status === "cancelled" ? "bg-gray-500/15 text-gray-400 border-gray-500/30"
                  : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                }`}>
                  {sub.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Employees Tab ────────────────────────────────────────────────────────────
function EmployeesTab({ tenant }) {
  const { adminSupabase } = useGACC();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: users }, { data: appEmployees }] = await Promise.all([
          adminSupabase.from("users").select("*").eq("tenant_id", tenant.id).order("full_name"),
          adminSupabase.from("app_employee").select("*").eq("tenant_id", tenant.id).order("full_name"),
        ]);

        const seen = new Set();
        const merged = [];
        for (const emp of [...(users || []), ...(appEmployees || [])]) {
          const key = emp.email?.toLowerCase() || emp.id;
          if (seen.has(key)) continue;
          seen.add(key);
          if (emp.active === false) continue;
          merged.push(emp);
        }
        setEmployees(merged);
      } catch (e) {
        console.error("Error loading employees:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenant.id]);

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-gray-600" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide">
          Empleados ({employees.length})
        </p>
      </div>
      {employees.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-8">Sin empleados registrados</p>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          {employees.map((emp, i) => (
            <div key={emp.id} className={`flex items-center gap-3 px-4 py-3 ${i < employees.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-purple-300 flex-shrink-0">
                {(emp.full_name || emp.email || "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-white font-semibold truncate">{emp.full_name || "Sin nombre"}</p>
                <p className="text-[10px] text-gray-600 truncate">{emp.email || "--"} {emp.phone ? `| ${emp.phone}` : ""}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                emp.role === "admin" ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/30"
                : emp.role === "technician" ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                : "bg-green-500/15 text-green-400 border-green-500/30"
              }`}>
                {emp.role || emp.position || "staff"}
              </span>
              <span className="text-[10px] text-gray-600">
                PIN: {emp.pin ? "****" : "--"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Activity Tab ─────────────────────────────────────────────────────────────
function ActivityTab({ tenant }) {
  const { adminSupabase } = useGACC();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const now = new Date();
        const d7 = new Date(now - 7 * 86400000).toISOString();
        const d30 = new Date(now - 30 * 86400000).toISOString();

        const [orders7d, orders30d, ordersTotal, customers, sales30d] = await Promise.all([
          adminSupabase.from("order").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).gte("created_date", d7),
          adminSupabase.from("order").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).gte("created_date", d30),
          adminSupabase.from("order").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
          adminSupabase.from("customer").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
          adminSupabase.from("sale").select("id, total", { count: "exact" }).eq("tenant_id", tenant.id).gte("created_date", d30),
        ]);

        const revenue30d = (sales30d.data || []).reduce((sum, s) => sum + (Number(s.total) || 0), 0);

        setStats({
          orders7d: orders7d.count || 0,
          orders30d: orders30d.count || 0,
          ordersTotal: ordersTotal.count || 0,
          customers: customers.count || 0,
          sales30d: sales30d.count || 0,
          revenue30d,
        });
      } catch (e) {
        console.error("Error loading activity:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenant.id]);

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-gray-600" /></div>;
  if (!stats) return <p className="text-xs text-gray-600 text-center py-8">Error cargando actividad</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: "Ordenes (7d)", value: stats.orders7d, color: "text-blue-400" },
          { label: "Ordenes (30d)", value: stats.orders30d, color: "text-purple-400" },
          { label: "Ordenes total", value: stats.ordersTotal, color: "text-white" },
          { label: "Clientes", value: stats.customers, color: "text-cyan-400" },
          { label: "Ventas (30d)", value: stats.sales30d, color: "text-green-400" },
          { label: "Revenue (30d)", value: `$${stats.revenue30d.toLocaleString()}`, color: "text-pink-400" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold">{s.label}</p>
            <p className={`text-xl font-black mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide mb-3">Timeline</p>
        <div className="space-y-2 text-[11px]">
          {tenant.activated_date && (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-gray-600 w-24">{new Date(tenant.activated_date).toLocaleDateString("es")}</span>
              <span className="text-white">Tienda activada</span>
            </div>
          )}
          {tenant.created_date && (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="text-gray-600 w-24">{new Date(tenant.created_date).toLocaleDateString("es")}</span>
              <span className="text-white">Registro creado</span>
            </div>
          )}
          {tenant.last_login && (
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span className="text-gray-600 w-24">{new Date(tenant.last_login).toLocaleDateString("es")}</span>
              <span className="text-white">Ultimo login</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Notes Tab (placeholder) ──────────────────────────────────────────────────
function NotesTab({ tenant }) {
  const [notes, setNotes] = useState(tenant.metadata?.admin_notes || "");
  const [saving, setSaving] = useState(false);
  const { adminSupabase } = useGACC();

  const save = async () => {
    setSaving(true);
    try {
      const metadata = { ...(tenant.metadata || {}), admin_notes: notes };
      const { error } = await adminSupabase.from("tenant").update({ metadata }).eq("id", tenant.id);
      if (error) throw error;
      toast.success("Notas guardadas");
    } catch (e) {
      toast.error("Error guardando notas: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide">Notas Internas</p>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notas internas sobre esta tienda (solo visible para admins)..."
          rows={6}
          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-[13px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40 resize-none"
        />
        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Audit Tab ────────────────────────────────────────────────────────────────
function AuditTab({ tenant }) {
  const { adminSupabase } = useGACC();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await adminSupabase
          .from("audit_log")
          .select("*")
          .or(`entity_id.eq.${tenant.id},metadata->>tenant_id.eq.${tenant.id}`)
          .order("created_date", { ascending: false })
          .limit(50);
        setLogs(data || []);
      } catch (e) {
        console.error("Error loading audit logs:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenant.id]);

  if (loading) return <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-gray-600" /></div>;

  return (
    <div className="space-y-3">
      <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide">
        Audit Trail ({logs.length})
      </p>
      {logs.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-8">Sin registros de auditoria</p>
      ) : (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden">
          {logs.map((log, i) => (
            <div key={log.id} className={`px-4 py-3 ${i < logs.length - 1 ? "border-b border-white/[0.04]" : ""}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${
                    log.severity === "critical" ? "bg-red-500" : log.severity === "warning" ? "bg-amber-400" : "bg-blue-400"
                  }`} />
                  <p className="text-[12px] text-white font-semibold">{log.action}</p>
                  <span className="text-[10px] text-gray-600">{log.entity_type}</span>
                </div>
                <span className="text-[10px] text-gray-600">
                  {log.created_date ? timeAgo(log.created_date) : "--"}
                </span>
              </div>
              {log.user_name && (
                <p className="text-[10px] text-gray-600 mt-1">por {log.user_name} ({log.user_role || "--"})</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Change Plan & Users Modal ─────────────────────────────────────────────────
function ChangePlanModal({ tenant, open, onClose }) {
  const { adminSupabase, appClient, refresh } = useGACC();
  const currentPlan = tenant.effective_plan || tenant.plan || "smartfixos";
  const currentMaxUsers = tenant.effective_max_users || getPlanConfig(currentPlan).maxUsers || 1;
  const currentCost = tenant.effective_monthly_cost || getPlanConfig(currentPlan).monthlyCost || 55;

  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [maxUsers, setMaxUsers] = useState(currentMaxUsers);
  const [monthlyCost, setMonthlyCost] = useState(currentCost);
  const [saving, setSaving] = useState(false);

  // Sync cost when plan changes
  const handlePlanChange = (planKey) => {
    setSelectedPlan(planKey);
    const config = getPlanConfig(planKey);
    setMonthlyCost(config.monthlyCost);
    setMaxUsers(config.maxUsers);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update tenant
      const metadata = { ...(tenant.metadata || {}), max_users: maxUsers };
      const { error: tenantErr } = await adminSupabase
        .from("tenant")
        .update({ plan: selectedPlan, monthly_cost: monthlyCost, metadata })
        .eq("id", tenant.id);
      if (tenantErr) throw tenantErr;

      // Update subscription if exists
      if (tenant.latest_subscription?.id) {
        await adminSupabase
          .from("subscription")
          .update({ plan: selectedPlan, amount: monthlyCost })
          .eq("id", tenant.latest_subscription.id);
      }

      // Also call manageTenant for plan change side-effects
      try {
        await appClient.functions.manageTenant({
          tenantId: tenant.id,
          action: "set_plan",
          plan: selectedPlan,
          monthlyCost: monthlyCost,
        });
      } catch {}

      toast.success(`Plan actualizado a ${getPlanConfig(selectedPlan).label} ($${monthlyCost}/mo, ${maxUsers} usuarios)`);
      refresh();
      onClose();
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-[#141416] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div>
              <p className="text-[14px] font-bold text-white">Cambiar Plan & Usuarios</p>
              <p className="text-[11px] text-gray-600">{tenant.name}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.05]">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* Plan selector */}
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-2">Plan</p>
              <div className="space-y-2">
                {PLAN_OPTIONS.map(plan => (
                  <button
                    key={plan.key}
                    onClick={() => handlePlanChange(plan.key)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                      selectedPlan === plan.key
                        ? "border-purple-500/50 bg-purple-500/10"
                        : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                        selectedPlan === plan.key ? "border-purple-400" : "border-gray-600"
                      }`}>
                        {selectedPlan === plan.key && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                      </span>
                      <div className="text-left">
                        <p className="text-[13px] text-white font-semibold">{plan.label}</p>
                        <p className="text-[10px] text-gray-600">{plan.sub}</p>
                      </div>
                    </div>
                    <span className="text-[13px] font-bold text-white">${plan.monthlyCost || "Custom"}/mo</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Monthly cost override */}
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-2">Costo Mensual (USD)</p>
              <input
                type="number"
                value={monthlyCost}
                onChange={e => setMonthlyCost(Number(e.target.value) || 0)}
                min={0}
                className="w-full px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[14px] text-white font-bold focus:outline-none focus:border-purple-500/40 tabular-nums"
              />
              <p className="text-[10px] text-gray-700 mt-1">Puedes poner un precio custom diferente al del plan</p>
            </div>

            {/* Max users */}
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide font-bold mb-2">Usuarios Maximos</p>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMaxUsers(Math.max(1, maxUsers - 1))}
                  className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white font-bold text-lg hover:bg-white/[0.1] transition-all"
                >
                  -
                </button>
                <input
                  type="number"
                  value={maxUsers}
                  onChange={e => setMaxUsers(Math.max(1, Number(e.target.value) || 1))}
                  min={1}
                  className="w-24 text-center px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[18px] text-white font-black focus:outline-none focus:border-purple-500/40 tabular-nums"
                />
                <button
                  onClick={() => setMaxUsers(maxUsers + 1)}
                  className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white font-bold text-lg hover:bg-white/[0.1] transition-all"
                >
                  +
                </button>
                <span className="text-[11px] text-gray-600">
                  Plan default: {getPlanConfig(selectedPlan).maxUsers}
                </span>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold mb-2">Resumen del cambio</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-gray-600">Plan</p>
                  <p className="text-[13px] font-bold text-white">{getPlanConfig(selectedPlan).label}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600">Costo</p>
                  <p className="text-[13px] font-bold text-white">${monthlyCost}/mo</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600">Usuarios</p>
                  <p className="text-[13px] font-bold text-white">{maxUsers}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 hover:text-white transition-all">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[12px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Guardar Cambios
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// ── Main Store Detail ────────────────────────────────────────────────────────
export default function StoreDetail({ tenant, onBack }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const badge = getStatusBadge(tenant);
  const presence = presenceStatus(tenant.last_seen);
  const planConfig = getPlanConfig(tenant.effective_plan || tenant.plan);

  const tabContent = {
    overview: <OverviewTab tenant={tenant} />,
    subscription: <SubscriptionTab tenant={tenant} />,
    activity: <ActivityTab tenant={tenant} />,
    employees: <EmployeesTab tenant={tenant} />,
    notes: <NotesTab tenant={tenant} />,
    audit: <AuditTab tenant={tenant} />,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

      {/* Back + Header */}
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-gray-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a Stores
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {tenant.logo_url ? (
              <img src={tenant.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-400" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">{tenant.name || "--"}</h2>
                {presence && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${presence.badge}`}>
                    {presence.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badge.cls}`}>
                  {badge.label}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${planConfig.color} text-white font-bold`}>
                  {planConfig.label}
                </span>
                <span className="text-[11px] text-gray-600">{tenant.email}</span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-all"
              title="Cambiar plan y usuarios"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Plan & Usuarios
            </button>
            <button className="p-2 rounded-xl text-gray-600 hover:text-white border border-white/[0.07] hover:border-white/[0.15] transition-all" title="Enviar email">
              <Mail className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.05] overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
              activeTab === t.key
                ? "bg-white/[0.08] text-white"
                : "text-gray-600 hover:text-gray-400"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>{tabContent[activeTab]}</div>

      {/* Plan & Users modal */}
      <ChangePlanModal tenant={tenant} open={showPlanModal} onClose={() => setShowPlanModal(false)} />
    </div>
  );
}
