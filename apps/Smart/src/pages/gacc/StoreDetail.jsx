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
import { useGACC, getStatusBadge, presenceStatus, timeAgo, getPlanConfig, PLAN_OPTIONS, normalizePlan } from "./gaccContext";
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
  const { adminSupabase } = useGACC();
  const planConfig = getPlanConfig(tenant.effective_plan || tenant.plan);
  const badge = getStatusBadge(tenant);
  const daysAsCustomer = tenant.created_date
    ? Math.floor((Date.now() - new Date(tenant.created_date).getTime()) / 86400000)
    : 0;

  // ── Monthly orders counter ──
  const [monthlyOrders, setMonthlyOrders] = useState(null);
  const [skuCount, setSkuCount] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const [{ count: orderCount }, { count: products }] = await Promise.all([
          adminSupabase.from("order").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).gte("created_date", monthStart),
          adminSupabase.from("product").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
        ]);
        setMonthlyOrders(orderCount || 0);
        setSkuCount(products || 0);
      } catch (e) {
        console.error("Error loading usage:", e);
      }
    })();
  }, [tenant.id]);

  const ordersLimit = planConfig.maxOrdersMonthly;
  const skusLimit = planConfig.maxSkus;
  const ordersPct = ordersLimit > 0 && monthlyOrders !== null ? Math.min(100, (monthlyOrders / ordersLimit) * 100) : 0;
  const skusPct = skusLimit > 0 && skuCount !== null ? Math.min(100, (skuCount / skusLimit) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Quick KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Plan", value: planConfig.label, sub: `$${tenant.effective_monthly_cost || 0}/mo` },
          { label: "Dias como cliente", value: daysAsCustomer, sub: tenant.created_date ? new Date(tenant.created_date).toLocaleDateString("es") : "--" },
          { label: "Ultimo acceso", value: timeAgo(tenant.last_login) || "Nunca", sub: tenant.last_login ? new Date(tenant.last_login).toLocaleDateString("es") : "" },
          { label: "Estado pago", value: tenant.last_payment_date ? "Al dia" : "Sin pagos", sub: tenant.last_payment_date ? `$${tenant.last_payment_amount || 0}` : "Trial activo" },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold">{k.label}</p>
            <p className="text-lg font-black text-white mt-1">{k.value}</p>
            {k.sub && <p className="text-[10px] text-gray-600">{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* Usage limits — orders monthly + SKUs */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-4">
        <p className="text-[12px] font-bold text-gray-400 uppercase tracking-wide">Uso del Plan</p>

        {/* Monthly orders */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <p className="text-[12px] text-white font-semibold">Ordenes este mes</p>
              <span className="text-[9px] text-gray-700">renueva el dia 1</span>
            </div>
            <p className="text-[12px] font-bold text-white tabular-nums">
              {monthlyOrders === null ? "--" : monthlyOrders}
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-gray-500">{ordersLimit === -1 ? "∞" : ordersLimit}</span>
            </p>
          </div>
          {ordersLimit > 0 ? (
            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${ordersPct}%` }}
                transition={{ duration: 0.6 }}
                className={`h-full rounded-full ${
                  ordersPct >= 90 ? "bg-gradient-to-r from-amber-500 to-red-500" :
                  ordersPct >= 70 ? "bg-gradient-to-r from-yellow-500 to-amber-500" :
                  "bg-gradient-to-r from-emerald-500 to-cyan-500"
                }`}
              />
            </div>
          ) : (
            <p className="text-[10px] text-emerald-400">Sin limite</p>
          )}
        </div>

        {/* SKUs */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <p className="text-[12px] text-white font-semibold">SKUs en inventario</p>
              <span className="text-[9px] text-gray-700">total acumulado</span>
            </div>
            <p className="text-[12px] font-bold text-white tabular-nums">
              {skuCount === null ? "--" : skuCount}
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-gray-500">{skusLimit === -1 ? "∞" : skusLimit}</span>
            </p>
          </div>
          {skusLimit > 0 ? (
            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${skusPct}%` }}
                transition={{ duration: 0.6 }}
                className={`h-full rounded-full ${
                  skusPct >= 90 ? "bg-gradient-to-r from-amber-500 to-red-500" :
                  skusPct >= 70 ? "bg-gradient-to-r from-yellow-500 to-amber-500" :
                  "bg-gradient-to-r from-blue-500 to-purple-500"
                }`}
              />
            </div>
          ) : (
            <p className="text-[10px] text-emerald-400">Sin limite</p>
          )}
        </div>
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

// ── Change Plan Modal ─────────────────────────────────────────────────────────
function ChangePlanModal({ tenant, open, onClose }) {
  const { adminSupabase, appClient, refresh } = useGACC();
  const currentPlan = normalizePlan(tenant.effective_plan || tenant.plan || "starter");
  const currentCost = tenant.effective_monthly_cost || getPlanConfig(currentPlan).monthlyCost || 14.99;

  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [monthlyCost, setMonthlyCost] = useState(currentCost);
  const [saving, setSaving] = useState(false);

  // Sync cost when plan changes
  const handlePlanChange = (planKey) => {
    setSelectedPlan(planKey);
    const config = getPlanConfig(planKey);
    setMonthlyCost(config.monthlyCost);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Clean metadata: remove legacy max_users field
      const metadata = { ...(tenant.metadata || {}) };
      delete metadata.max_users;

      const { error: tenantErr } = await adminSupabase
        .from("tenant")
        .update({
          plan: selectedPlan,
          monthly_cost: monthlyCost,
          subscription_status: "active",
          metadata,
        })
        .eq("id", tenant.id);
      if (tenantErr) throw tenantErr;

      // Update subscription if exists
      if (tenant.latest_subscription?.id) {
        await adminSupabase
          .from("subscription")
          .update({ plan: selectedPlan, amount: monthlyCost, status: "active" })
          .eq("id", tenant.latest_subscription.id);
      } else {
        await adminSupabase.from("subscription").insert({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          plan: selectedPlan,
          status: "active",
          amount: monthlyCost,
          payment_method: tenant.payment_method || "stripe",
        });
      }

      try {
        await appClient.functions.manageTenant({
          tenantId: tenant.id,
          action: "set_plan",
          plan: selectedPlan,
          monthlyCost: monthlyCost,
        });
      } catch {}

      // Signal other tabs (app interna) that plan changed
      localStorage.setItem("gacc_plan_updated", Date.now().toString());
      localStorage.setItem("gacc_tenant_updated", Date.now().toString());

      toast.success(`Plan actualizado a ${getPlanConfig(selectedPlan).label} ($${monthlyCost}/mo)`);
      await refresh();
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
              <p className="text-[14px] font-bold text-white">Cambiar Plan</p>
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

            {/* Plan Limits Info */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold mb-2">Limites del plan {getPlanConfig(selectedPlan).label}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                  <p className="text-[10px] text-gray-600">Ordenes / mes</p>
                  <p className="text-[14px] font-black text-white">
                    {getPlanConfig(selectedPlan).maxOrdersMonthly === -1 ? "Ilimitado" : getPlanConfig(selectedPlan).maxOrdersMonthly}
                  </p>
                  <p className="text-[9px] text-gray-700">Renueva cada mes</p>
                </div>
                <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2">
                  <p className="text-[10px] text-gray-600">SKUs en inventario</p>
                  <p className="text-[14px] font-black text-white">
                    {getPlanConfig(selectedPlan).maxSkus === -1 ? "Ilimitado" : getPlanConfig(selectedPlan).maxSkus}
                  </p>
                  <p className="text-[9px] text-gray-700">Total acumulado</p>
                </div>
              </div>
              <div className="mt-2 px-2 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <p className="text-[10px] text-emerald-400">Todas las features estan desbloqueadas en ambos planes</p>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold mb-2">Resumen del cambio</p>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-gray-600">Plan</p>
                  <p className="text-[13px] font-bold text-white">{getPlanConfig(selectedPlan).label}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-600">Costo</p>
                  <p className="text-[13px] font-bold text-white">${monthlyCost}/mo</p>
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

// ── Edit Store Modal ─────────────────────────────────────────────────────────
function EditStoreModal({ tenant, open, onClose }) {
  const { adminSupabase, refresh } = useGACC();
  const [form, setForm] = useState({
    name: tenant.name || "",
    email: tenant.email || "",
    admin_name: tenant.admin_name || "",
    admin_phone: tenant.admin_phone || "",
    country: tenant.country || "",
    currency: tenant.currency || "USD",
    timezone: tenant.timezone || "America/Puerto_Rico",
    address: tenant.address || "",
  });
  const [saving, setSaving] = useState(false);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error("Nombre y email son requeridos"); return; }
    setSaving(true);
    try {
      const { error } = await adminSupabase.from("tenant").update(form).eq("id", tenant.id);
      if (error) throw error;
      toast.success("Tienda actualizada");
      await refresh();
      onClose();
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const fields = [
    { key: "name", label: "Nombre", placeholder: "Nombre de la tienda", required: true },
    { key: "email", label: "Email", placeholder: "email@ejemplo.com", type: "email", required: true },
    { key: "admin_name", label: "Contacto / Admin", placeholder: "Nombre del administrador" },
    { key: "admin_phone", label: "Telefono", placeholder: "+1 787 000 0000" },
    { key: "country", label: "Pais", placeholder: "PR, US, MX..." },
    { key: "address", label: "Direccion", placeholder: "Direccion fisica" },
    { key: "timezone", label: "Timezone", placeholder: "America/Puerto_Rico" },
  ];

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-[#141416] border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div>
              <p className="text-[14px] font-bold text-white">Editar Tienda</p>
              <p className="text-[11px] text-gray-600">{tenant.name}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.05]">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {fields.map(f => (
              <div key={f.key}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">
                  {f.label} {f.required && <span className="text-red-400">*</span>}
                </p>
                <input
                  type={f.type || "text"}
                  value={form[f.key]}
                  onChange={e => update(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[13px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40"
                />
              </div>
            ))}
            <div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide font-bold mb-1">Moneda</p>
              <select
                value={form.currency}
                onChange={e => update("currency", e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[13px] text-white outline-none cursor-pointer"
              >
                {["USD", "EUR", "MXN", "COP", "ARS", "BRL"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 hover:text-white transition-all">Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-[12px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all disabled:opacity-50">
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Guardar
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accessing, setAccessing] = useState(false);
  const { appClient, adminSupabase, refresh } = useGACC();
  const badge = getStatusBadge(tenant);
  const presence = presenceStatus(tenant.last_seen);
  const planConfig = getPlanConfig(tenant.effective_plan || tenant.plan);

  // Access the store as its owner
  const handleAccessStore = async () => {
    setAccessing(true);
    try {
      // Find the admin/owner employee
      const { data: employees } = await adminSupabase
        .from("app_employee")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("active", true)
        .order("created_date", { ascending: true });

      const owner = employees?.find(e => e.role === "admin" || e.position === "admin") || employees?.[0];

      if (!owner) {
        toast.error("Esta tienda no tiene empleados registrados");
        setAccessing(false);
        return;
      }

      // Build session object that matches what PinAccess creates
      const session = {
        tenant_id: tenant.id,
        employee_id: owner.id,
        user_id: owner.id,
        full_name: owner.full_name,
        email: owner.email,
        role: owner.role || owner.position || "admin",
        position: owner.position || owner.role || "admin",
        permissions: ["all"],
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
        },
        _impersonated_by: "gacc_admin",
        _impersonation_started: new Date().toISOString(),
      };

      localStorage.setItem("employee_session", JSON.stringify(session));
      sessionStorage.setItem("911-session", JSON.stringify(session));
      localStorage.setItem("smartfix_tenant_id", tenant.id);
      localStorage.setItem("current_tenant_id", tenant.id);

      toast.success(`Accediendo como ${owner.full_name || owner.email}...`);
      setTimeout(() => { window.location.href = "/Dashboard"; }, 600);
    } catch (e) {
      toast.error("Error: " + e.message);
      setAccessing(false);
    }
  };

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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAccessStore}
              disabled={accessing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 transition-all disabled:opacity-50"
              title="Acceder a esta tienda como admin"
            >
              {accessing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              Acceder
            </button>
            <button
              onClick={() => setShowPlanModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-all"
              title="Cambiar plan"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Cambiar Plan
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="p-2 rounded-xl text-gray-600 hover:text-white border border-white/[0.07] hover:border-white/[0.15] transition-all"
              title="Editar tienda"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-xl text-gray-600 hover:text-white border border-white/[0.07] hover:border-white/[0.15] transition-all" title="Enviar email">
              <Mail className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2 rounded-xl text-gray-600 hover:text-red-400 border border-white/[0.07] hover:border-red-500/30 hover:bg-red-500/5 transition-all"
              title="Eliminar tienda permanentemente"
            >
              <Trash2 className="w-4 h-4" />
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

      {/* Modals */}
      <ChangePlanModal tenant={tenant} open={showPlanModal} onClose={() => setShowPlanModal(false)} />
      <EditStoreModal tenant={tenant} open={showEditModal} onClose={() => setShowEditModal(false)} />
      <DeleteStoreModal tenant={tenant} open={showDeleteModal} onClose={() => setShowDeleteModal(false)} onDeleted={onBack} />
    </div>
  );
}

// ── Delete Store Modal ───────────────────────────────────────────────────────
function DeleteStoreModal({ tenant, open, onClose, onDeleted }) {
  const { appClient, adminSupabase, refresh } = useGACC();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [step, setStep] = useState(1);
  const canDelete = confirmText.trim().toLowerCase() === (tenant?.name || "").toLowerCase();

  const handleClose = () => {
    setConfirmText("");
    setStep(1);
    onClose();
  };

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    try {
      // Try manageTenant function first (preferred — cleans everything)
      let success = false;
      try {
        await appClient.functions.manageTenant({ tenantId: tenant.id, action: "delete" });
        success = true;
      } catch (e) {
        console.warn("manageTenant delete failed, trying direct delete:", e.message);
      }

      // Fallback: direct delete of tenant and related data
      if (!success) {
        // Delete related data first
        await adminSupabase.from("app_employee").delete().eq("tenant_id", tenant.id);
        await adminSupabase.from("subscription").delete().eq("tenant_id", tenant.id);
        await adminSupabase.from("tenant_membership").delete().eq("tenant_id", tenant.id);
        // Delete the tenant itself
        const { error } = await adminSupabase.from("tenant").delete().eq("id", tenant.id);
        if (error) throw error;
      }

      // Log admin action
      try {
        const log = JSON.parse(localStorage.getItem("gacc_admin_log") || "[]");
        log.unshift({
          action: `Tienda eliminada: ${tenant.name}`,
          target: tenant.email,
          type: "danger",
          time: new Date().toISOString(),
        });
        localStorage.setItem("gacc_admin_log", JSON.stringify(log.slice(0, 50)));
      } catch {}

      toast.success(`Tienda "${tenant.name}" eliminada permanentemente`);
      await refresh();
      handleClose();
      onDeleted?.();
    } catch (e) {
      toast.error("Error eliminando: " + e.message);
    } finally {
      setDeleting(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-md bg-[#141416] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-red-500/20 bg-red-500/[0.03]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-[14px] font-bold text-white">Eliminar Tienda</p>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.05]">
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {step === 1 ? (
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4">
                <p className="text-[13px] text-red-300 font-bold mb-2">Esta accion NO se puede deshacer</p>
                <ul className="text-[11px] text-gray-400 space-y-1 list-disc pl-4">
                  <li>Se eliminara la tienda <strong className="text-white">{tenant.name}</strong></li>
                  <li>Se eliminaran todos los empleados registrados</li>
                  <li>Se cancelaran las suscripciones</li>
                  <li>Los datos historicos (ordenes, ventas, clientes) pueden persistir</li>
                  <li>El email <strong className="text-white">{tenant.email}</strong> podra registrarse nuevamente</li>
                </ul>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={handleClose} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 hover:text-white transition-all">
                  Cancelar
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all"
                >
                  Continuar
                </button>
              </div>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-4">
              <div>
                <p className="text-[12px] text-gray-400 mb-2">
                  Para confirmar, escribe el nombre exacto de la tienda:
                </p>
                <p className="text-[13px] text-white font-mono bg-white/[0.05] px-3 py-2 rounded-lg border border-white/[0.08] mb-3">
                  {tenant.name}
                </p>
                <input
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  placeholder="Escribe el nombre de la tienda"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[13px] text-white placeholder:text-gray-700 focus:outline-none focus:border-red-500/40"
                />
              </div>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => setStep(1)} className="px-4 py-2 rounded-xl text-[12px] text-gray-500 hover:text-white transition-all">
                  Atras
                </button>
                <button
                  onClick={handleDelete}
                  disabled={!canDelete || deleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Eliminar Permanentemente
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
