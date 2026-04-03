/**
 * GACC — Revenue & Billing
 * MRR breakdown, subscription management, failed payments, payment history, dunning
 */
import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, TrendingDown, CreditCard, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Users, Building2, RefreshCw,
  XCircle, CheckCircle, Clock, Mail, PauseCircle, RotateCcw,
  ChevronRight, Filter, BarChart3, PieChart
} from "lucide-react";
import { useGACC, getPlanConfig, PLAN_OPTIONS, timeAgo } from "./gaccContext";
import { toast } from "sonner";

// ── MRR Breakdown Card ───────────────────────────────────────────────────────
function MRRBreakdown({ tenants, subscriptions }) {
  const breakdown = useMemo(() => {
    const byPlan = {};
    PLAN_OPTIONS.forEach(p => { byPlan[p.key] = { count: 0, mrr: 0, label: p.label, color: p.color }; });

    tenants.filter(t => t.status === "active").forEach(t => {
      const plan = t.effective_plan || t.plan || "smartfixos";
      if (!byPlan[plan]) byPlan[plan] = { count: 0, mrr: 0, label: plan, color: "from-gray-500 to-gray-600" };
      byPlan[plan].count++;
      byPlan[plan].mrr += (t.effective_monthly_cost || 0);
    });

    const totalMRR = Object.values(byPlan).reduce((s, p) => s + p.mrr, 0);
    const totalCount = Object.values(byPlan).reduce((s, p) => s + p.count, 0);
    const arr = totalMRR * 12;

    return { byPlan, totalMRR, totalCount, arr };
  }, [tenants]);

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "MRR", value: `$${breakdown.totalMRR.toLocaleString()}`, icon: DollarSign, grad: "from-pink-500 to-rose-500" },
          { label: "ARR", value: `$${breakdown.arr.toLocaleString()}`, icon: TrendingUp, grad: "from-purple-500 to-violet-500" },
          { label: "Tiendas pagando", value: breakdown.totalCount, icon: Building2, grad: "from-blue-500 to-cyan-500" },
          { label: "ARPS", value: breakdown.totalCount > 0 ? `$${Math.round(breakdown.totalMRR / breakdown.totalCount)}` : "$0", icon: Users, grad: "from-emerald-500 to-teal-500" },
        ].map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
          >
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${m.grad} flex items-center justify-center mb-2`}>
              <m.icon className="w-4 h-4 text-white" />
            </div>
            <p className="text-2xl font-black tabular-nums">{m.value}</p>
            <p className="text-[11px] text-gray-500 font-medium">{m.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Plan breakdown */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-4 h-4 text-purple-400" />
          <p className="text-[13px] font-bold text-white">MRR por Plan</p>
        </div>
        <div className="space-y-3">
          {Object.entries(breakdown.byPlan).filter(([, v]) => v.count > 0).map(([key, plan]) => {
            const pct = breakdown.totalMRR > 0 ? Math.round((plan.mrr / breakdown.totalMRR) * 100) : 0;
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${plan.color} text-white font-bold`}>
                      {plan.label}
                    </span>
                    <span className="text-[11px] text-gray-500">{plan.count} tiendas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-white tabular-nums">${plan.mrr.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-600">{pct}%</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className={`h-full rounded-full bg-gradient-to-r ${plan.color}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Failed Payments / Dunning ────────────────────────────────────────────────
function DunningQueue({ subscriptions, tenants, onAction }) {
  const failed = useMemo(() => {
    return subscriptions
      .filter(s => s.last_payment_status === "failed" || s.status === "past_due")
      .map(s => {
        const tenant = tenants.find(t => t.id === s.tenant_id);
        return {
          ...s,
          tenantName: tenant?.name || s.tenant_name || "Desconocida",
          tenantEmail: tenant?.email || "",
          tenantStatus: tenant?.status || "unknown",
          attempts: s.failed_payment_attempts || tenant?.failed_payment_attempts || 1,
        };
      })
      .sort((a, b) => (b.attempts || 0) - (a.attempts || 0));
  }, [subscriptions, tenants]);

  const pastDue = useMemo(() => {
    return tenants.filter(t => {
      const sub = t.effective_subscription_status || t.subscription_status;
      return sub === "past_due" || (t.failed_payment_attempts || 0) > 0;
    });
  }, [tenants]);

  const allDunning = failed.length > 0 ? failed : pastDue.map(t => ({
    id: t.id,
    tenantName: t.name,
    tenantEmail: t.email,
    plan: t.effective_plan || t.plan,
    amount: t.effective_monthly_cost || 0,
    attempts: t.failed_payment_attempts || 0,
    status: "past_due",
    tenant_id: t.id,
  }));

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <p className="text-[13px] font-bold text-white">Dunning / Pagos Fallidos</p>
          {allDunning.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">{allDunning.length}</span>
          )}
        </div>
      </div>

      {allDunning.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm text-emerald-400 font-bold">Sin pagos pendientes</p>
          <p className="text-[11px] text-gray-600 mt-1">Todos los cobros estan al dia</p>
        </div>
      ) : (
        <div className="space-y-2">
          {allDunning.map(item => (
            <div key={item.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white font-semibold">{item.tenantName}</p>
                <p className="text-[11px] text-gray-600">{item.tenantEmail} &middot; {getPlanConfig(item.plan).label} &middot; ${item.amount}/mo</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  (item.attempts || 0) >= 3 ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                  (item.attempts || 0) >= 2 ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" :
                  "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                }`}>
                  {item.attempts}x fallido
                </span>
                <button
                  onClick={() => onAction("email", item)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
                  title="Contactar"
                >
                  <Mail className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onAction("suspend", item)}
                  className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  title="Suspender"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Subscriptions Table ──────────────────────────────────────────────────────
function SubscriptionsTable({ subscriptions, tenants }) {
  const [filter, setFilter] = useState("all");

  const enriched = useMemo(() => {
    return subscriptions.map(s => {
      const tenant = tenants.find(t => t.id === s.tenant_id);
      return { ...s, tenantName: tenant?.name || s.tenant_name || "--", tenantEmail: tenant?.email || "" };
    });
  }, [subscriptions, tenants]);

  const filtered = useMemo(() => {
    if (filter === "all") return enriched;
    return enriched.filter(s => s.status === filter);
  }, [enriched, filter]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-400" />
          <p className="text-[13px] font-bold text-white">Suscripciones</p>
          <span className="text-[10px] text-gray-600">{filtered.length}</span>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
          {["all", "active", "past_due", "cancelled", "paused"].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                filter === f ? "bg-white/[0.08] text-white" : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {f === "all" ? "Todas" : f === "active" ? "Activas" : f === "past_due" ? "Past Due" : f === "cancelled" ? "Canceladas" : "Pausadas"}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-gray-600 uppercase tracking-wide font-bold border-b border-white/[0.05]">
        <div className="col-span-3">Tienda</div>
        <div className="col-span-2">Plan</div>
        <div className="col-span-2">Estado</div>
        <div className="col-span-2 text-right">Monto</div>
        <div className="col-span-3 text-right">Proximo cobro</div>
      </div>

      <div className="max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-8">Sin suscripciones en este filtro</p>
        ) : (
          filtered.map(sub => (
            <div key={sub.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
              <div className="col-span-3 min-w-0">
                <p className="text-[12px] text-white font-semibold truncate">{sub.tenantName}</p>
                <p className="text-[10px] text-gray-600 truncate">{sub.tenantEmail}</p>
              </div>
              <div className="col-span-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${getPlanConfig(sub.plan).color} text-white font-bold`}>
                  {getPlanConfig(sub.plan).label}
                </span>
              </div>
              <div className="col-span-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                  sub.status === "active" ? "bg-green-500/15 text-green-400 border-green-500/30" :
                  sub.status === "past_due" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                  sub.status === "cancelled" ? "bg-gray-500/15 text-gray-400 border-gray-500/30" :
                  "bg-blue-500/15 text-blue-400 border-blue-500/30"
                }`}>
                  {sub.status}
                </span>
              </div>
              <div className="col-span-2 text-right">
                <p className="text-[12px] font-bold text-white tabular-nums">${sub.amount || 0}</p>
                <p className="text-[9px] text-gray-700">/mo</p>
              </div>
              <div className="col-span-3 text-right">
                <p className="text-[11px] text-gray-500">
                  {sub.next_billing_date || sub.billing_cycle_end || "--"}
                </p>
                {sub.last_payment_date && (
                  <p className="text-[10px] text-gray-700">Ult. pago: {timeAgo(sub.last_payment_date)}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Payment History ──────────────────────────────────────────────────────────
function PaymentHistory({ subscriptions, tenants }) {
  const payments = useMemo(() => {
    return subscriptions
      .filter(s => s.last_payment_date)
      .map(s => {
        const tenant = tenants.find(t => t.id === s.tenant_id);
        return {
          id: s.id,
          tenantName: tenant?.name || s.tenant_name || "--",
          amount: s.last_payment_amount || s.amount || 0,
          status: s.last_payment_status || "unknown",
          date: s.last_payment_date,
          plan: s.plan,
        };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20);
  }, [subscriptions, tenants]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-cyan-400" />
        <p className="text-[13px] font-bold text-white">Historial de Pagos</p>
      </div>

      {payments.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-6">Sin pagos registrados</p>
      ) : (
        <div className="space-y-1.5">
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.015] hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${
                  p.status === "succeeded" ? "bg-emerald-400" : p.status === "failed" ? "bg-red-500" : "bg-amber-400"
                }`} />
                <div>
                  <p className="text-[12px] text-white font-semibold">{p.tenantName}</p>
                  <p className="text-[10px] text-gray-600">{getPlanConfig(p.plan).label} &middot; {new Date(p.date).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-[13px] font-bold tabular-nums ${p.status === "failed" ? "text-red-400" : "text-white"}`}>
                  ${p.amount}
                </p>
                <span className={`text-[9px] font-semibold ${
                  p.status === "succeeded" ? "text-emerald-400" : p.status === "failed" ? "text-red-400" : "text-amber-400"
                }`}>
                  {p.status === "succeeded" ? "Exitoso" : p.status === "failed" ? "Fallido" : "Pendiente"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MRR Growth Chart (simple bar chart) ──────────────────────────────────────
function MRRChart({ tenants }) {
  const months = useMemo(() => {
    // Build MRR by month based on tenant created_date
    const now = new Date();
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("es", { month: "short", year: "2-digit" });
      const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      // Count tenants active by end of that month
      const activeTenants = tenants.filter(t => {
        if (!t.created_date) return false;
        return new Date(t.created_date) <= endOfMonth && t.status !== "cancelled";
      });
      const mrr = activeTenants.reduce((sum, t) => sum + (t.effective_monthly_cost || 0), 0);
      const count = activeTenants.length;
      data.push({ label, mrr, count });
    }
    return data;
  }, [tenants]);

  const maxMRR = Math.max(...months.map(m => m.mrr), 1);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-emerald-400" />
        <p className="text-[13px] font-bold text-white">MRR Growth (6 meses)</p>
      </div>
      <div className="flex items-end gap-3 h-40">
        {months.map((m, i) => {
          const height = Math.max((m.mrr / maxMRR) * 100, 4);
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <p className="text-[11px] font-bold text-white tabular-nums">${m.mrr}</p>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${height}%` }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="w-full rounded-t-lg bg-gradient-to-t from-purple-500/60 to-cyan-500/60 min-h-[4px]"
              />
              <p className="text-[10px] text-gray-600">{m.label}</p>
              <p className="text-[9px] text-gray-700">{m.count} tiendas</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Revenue View ────────────────────────────────────────────────────────
export default function RevenueView() {
  const { tenants, subscriptions, loading, refresh } = useGACC();

  const handleDunningAction = (action, item) => {
    if (action === "email") {
      toast.info(`Email a ${item.tenantName} (${item.tenantEmail})`);
    } else if (action === "suspend") {
      if (!confirm(`Suspender "${item.tenantName}" por pago fallido?`)) return;
      toast.info(`Suspension de ${item.tenantName} pendiente de implementar`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Revenue & Billing</h2>
          <p className="text-[11px] text-gray-600">Ingresos, suscripciones y cobros</p>
        </div>
        <button onClick={refresh} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] text-gray-500 hover:text-white border border-white/[0.07] hover:border-white/[0.15] bg-white/[0.02] transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <MRRBreakdown tenants={tenants} subscriptions={subscriptions} />

      {/* MRR Growth Chart */}
      <MRRChart tenants={tenants} />

      <DunningQueue subscriptions={subscriptions} tenants={tenants} onAction={handleDunningAction} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SubscriptionsTable subscriptions={subscriptions} tenants={tenants} />
        <PaymentHistory subscriptions={subscriptions} tenants={tenants} />
      </div>
    </div>
  );
}
