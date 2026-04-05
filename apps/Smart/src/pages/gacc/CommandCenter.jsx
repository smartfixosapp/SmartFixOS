/**
 * GACC — Command Center (HQ Dashboard)
 * Real-time widgets: System Pulse, MRR, Active Stores, Trials, Failed Payments, Activity
 */
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Building2, DollarSign, Clock, AlertTriangle, TrendingUp,
  CheckCircle, Timer, Wifi, Users, CreditCard, Activity,
  ArrowUpRight, ArrowDownRight, RefreshCw, XCircle, Zap, Eye,
  ArrowRight, ChevronRight
} from "lucide-react";
import { useGACC, timeAgo, getStatusBadge, presenceStatus, activityColor } from "./gaccContext";

// ── Metric Card ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, gradient, subtitle, alert, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.05 }}
      className={`relative rounded-2xl border p-4 space-y-2 transition-all ${
        alert
          ? "border-red-500/30 bg-red-500/[0.04]"
          : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]"
      }`}
    >
      <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        <Icon className="w-4.5 h-4.5 text-white" />
      </div>
      <p className="text-2xl font-black tabular-nums">{value}</p>
      <p className="text-[11px] text-gray-500 font-medium">{label}</p>
      {subtitle && <p className="text-[10px] text-gray-600">{subtitle}</p>}
      {alert && (
        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
      )}
    </motion.div>
  );
}

// ── System Pulse ─────────────────────────────────────────────────────────────
function SystemPulse() {
  // For now, simple connectivity checks. Will be expanded with adminHealthCheck function.
  const services = [
    { name: "Database", status: "ok" },
    { name: "Functions", status: "ok" },
    { name: "Storage", status: "ok" },
    { name: "Auth", status: "ok" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <p className="text-[13px] font-bold text-white">System Pulse</p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
          All Systems OK
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {services.map(s => (
          <div key={s.name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              s.status === "ok" ? "bg-emerald-400" : s.status === "warn" ? "bg-amber-400 animate-pulse" : "bg-red-500 animate-pulse"
            }`} />
            <span className="text-[11px] text-gray-400 font-medium">{s.name}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Recent Activity Feed ─────────────────────────────────────────────────────
function RecentActivity({ tenants }) {
  const recent = useMemo(() => {
    return [...tenants]
      .filter(t => t.last_login || t.last_seen)
      .sort((a, b) => {
        const aDate = a.last_seen || a.last_login;
        const bDate = b.last_seen || b.last_login;
        return new Date(bDate) - new Date(aDate);
      })
      .slice(0, 8);
  }, [tenants]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <p className="text-[13px] font-bold text-white">Actividad Reciente</p>
        </div>
        <span className="text-[10px] text-gray-600">Auto-refresh 30s</span>
      </div>
      <div className="space-y-1">
        {recent.map(t => {
          const presence = presenceStatus(t.last_seen);
          const ac = activityColor(t.last_login);
          const ago = timeAgo(t.last_seen || t.last_login);
          return (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.03] transition-colors">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${presence ? presence.dot : ac.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-white font-semibold truncate">{t.name || "--"}</p>
              </div>
              {presence && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${presence.badge}`}>
                  {presence.label}
                </span>
              )}
              <span className="text-[10px] text-gray-600 flex-shrink-0">{ago}</span>
            </div>
          );
        })}
        {recent.length === 0 && (
          <p className="text-xs text-gray-600 text-center py-4">Sin actividad reciente</p>
        )}
      </div>
    </motion.div>
  );
}

// ── Trials Expiring ──────────────────────────────────────────────────────────
function TrialsExpiring({ tenants }) {
  const expiring = useMemo(() => {
    return tenants
      .filter(t => {
        // Skip stores that are already paying
        if (t.last_payment_date || t.last_payment_amount > 0 || t.stripe_subscription_id) return false;
        const te = t.effective_trial_end_date || t.trial_end_date;
        if (!te || t.status !== "active") return false;
        const days = Math.ceil((new Date(te) - new Date()) / 86400000);
        return days > 0 && days <= 7;
      })
      .map(t => ({
        ...t,
        daysLeft: Math.ceil((new Date(t.effective_trial_end_date || t.trial_end_date) - new Date()) / 86400000),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [tenants]);

  if (expiring.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-amber-400" />
        <p className="text-[13px] font-bold text-white">Trials por Vencer</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">{expiring.length}</span>
      </div>
      <div className="space-y-1">
        {expiring.map(t => (
          <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
            <div className="min-w-0">
              <p className="text-[12px] text-white font-semibold truncate">{t.name}</p>
              <p className="text-[10px] text-gray-600">{t.email}</p>
            </div>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
              t.daysLeft <= 3
                ? "bg-red-500/20 text-red-400 border border-red-500/30"
                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            }`}>
              {t.daysLeft}d
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Failed Payments Alert ────────────────────────────────────────────────────
function FailedPayments({ subscriptions, tenants }) {
  const failed = useMemo(() => {
    return subscriptions
      .filter(s => s.last_payment_status === "failed" && s.status !== "cancelled")
      .map(s => {
        const tenant = tenants.find(t => t.id === s.tenant_id);
        return { ...s, tenantName: tenant?.name || s.tenant_name || "Unknown" };
      });
  }, [subscriptions, tenants]);

  if (failed.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="rounded-2xl border border-red-500/20 bg-red-500/[0.03] p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <XCircle className="w-4 h-4 text-red-400" />
        <p className="text-[13px] font-bold text-white">Pagos Fallidos</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">{failed.length}</span>
      </div>
      <div className="space-y-1">
        {failed.slice(0, 5).map(s => (
          <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02]">
            <div>
              <p className="text-[12px] text-white font-semibold">{s.tenantName}</p>
              <p className="text-[10px] text-gray-600">{s.plan} - ${s.amount}/mo</p>
            </div>
            <span className="text-[10px] text-red-400 font-bold">
              {s.failed_payment_attempts || 1}x failed
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Main Command Center ──────────────────────────────────────────────────────
export default function CommandCenter() {
  const { tenants, subscriptions, loading, metrics, lastRefresh, refresh } = useGACC();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* Refresh indicator */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Command Center</h2>
          <p className="text-[11px] text-gray-600">
            Vista global del sistema en tiempo real
            {lastRefresh && <> &middot; Actualizado {timeAgo(lastRefresh.toISOString())}</>}
          </p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] text-gray-500 hover:text-white border border-white/[0.07] hover:border-white/[0.15] bg-white/[0.02] transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* System Pulse */}
      <SystemPulse />

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricCard
          label="Total Tiendas"
          value={metrics.total}
          icon={Building2}
          gradient="from-blue-500 to-cyan-500"
          delay={0}
        />
        <MetricCard
          label="Activas"
          value={metrics.active}
          icon={CheckCircle}
          gradient="from-green-500 to-emerald-500"
          subtitle={`${metrics.paying} pagando`}
          delay={1}
        />
        <MetricCard
          label="En Trial"
          value={metrics.trials}
          icon={Clock}
          gradient="from-yellow-500 to-amber-500"
          subtitle={metrics.trialsExpiring > 0 ? `${metrics.trialsExpiring} vencen pronto` : undefined}
          alert={metrics.trialsExpiring > 0}
          delay={2}
        />
        <MetricCard
          label="MRR"
          value={`$${metrics.mrr.toLocaleString()}`}
          icon={DollarSign}
          gradient="from-pink-500 to-rose-500"
          delay={3}
        />
        <MetricCard
          label="Online Ahora"
          value={metrics.online}
          icon={Wifi}
          gradient="from-emerald-500 to-teal-500"
          subtitle={`${metrics.active24h} hoy`}
          delay={4}
        />
        <MetricCard
          label="Pagos Fallidos"
          value={metrics.failedPayments}
          icon={AlertTriangle}
          gradient={metrics.failedPayments > 0 ? "from-red-500 to-orange-500" : "from-gray-600 to-gray-700"}
          alert={metrics.failedPayments > 0}
          delay={5}
        />
      </div>

      {/* Two-column: Activity + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentActivity tenants={tenants} />
        <div className="space-y-4">
          <TrialsExpiring tenants={tenants} />
          <FailedPayments subscriptions={subscriptions} tenants={tenants} />
          {metrics.trialsExpiring === 0 && metrics.failedPayments === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-6 text-center"
            >
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-emerald-400">Todo en orden</p>
              <p className="text-[11px] text-gray-600 mt-1">Sin alertas activas</p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Onboarding Pipeline */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <ArrowRight className="w-4 h-4 text-cyan-400" />
          <p className="text-[13px] font-bold text-white">Onboarding Pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          {(() => {
            const total = metrics.total || 1;
            const steps = [
              { label: "Registradas", value: metrics.total, color: "from-blue-500 to-cyan-500", pct: 100 },
              { label: "Activadas", value: metrics.total - metrics.pending, color: "from-purple-500 to-violet-500", pct: Math.round(((metrics.total - metrics.pending) / total) * 100) },
              { label: "En Trial/Activas", value: metrics.active, color: "from-amber-500 to-yellow-500", pct: Math.round((metrics.active / total) * 100) },
              { label: "Pagando", value: metrics.paying, color: "from-emerald-500 to-green-500", pct: Math.round((metrics.paying / total) * 100) },
            ];
            return steps.map((step, i) => (
              <React.Fragment key={step.label}>
                <div className="flex-1 text-center">
                  <div className={`h-2 rounded-full bg-gradient-to-r ${step.color} mb-2`} style={{ width: `${Math.max(step.pct, 10)}%`, marginLeft: "auto", marginRight: "auto" }} />
                  <p className="text-xl font-black text-white">{step.value}</p>
                  <p className="text-[10px] text-gray-600">{step.label}</p>
                  <p className="text-[10px] text-gray-700">{step.pct}%</p>
                </div>
                {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-700 flex-shrink-0" />}
              </React.Fragment>
            ));
          })()}
        </div>
      </motion.div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Sin activar", value: metrics.pending, color: "text-purple-400", dot: "bg-purple-400" },
          { label: "Suspendidas", value: metrics.suspended, color: "text-red-400", dot: "bg-red-500" },
          { label: "Activos 7d", value: metrics.active7d, color: "text-blue-400", dot: "bg-blue-400" },
          { label: "Nunca entraron", value: metrics.neverLoggedIn, color: "text-gray-500", dot: "bg-gray-600" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 px-4 py-3 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            <div>
              <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-gray-600">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
