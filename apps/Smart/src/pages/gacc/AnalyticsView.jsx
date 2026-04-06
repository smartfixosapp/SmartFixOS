/**
 * GACC — Analytics View
 * Churn predictor, Revenue forecast, Cohort analysis, Usage heatmap, LTV, Feature adoption
 */
import React, { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, AlertTriangle, Target, Users, DollarSign,
  Calendar, BarChart3, PieChart, Activity, Zap, Flame, RefreshCw,
  ArrowUpRight, ArrowDownRight, Layers, Package
} from "lucide-react";
import { useGACC, getPlanConfig, PLAN_OPTIONS, timeAgo } from "./gaccContext";

// ── Churn Risk Score ─────────────────────────────────────────────────────────
function calculateChurnRisk(tenant) {
  let score = 0;
  const now = Date.now();

  // Days since last login (40% weight)
  if (!tenant.last_login) score += 40;
  else {
    const days = (now - new Date(tenant.last_login).getTime()) / 86400000;
    if (days > 30) score += 40;
    else if (days > 14) score += 25;
    else if (days > 7) score += 10;
  }

  // Failed payments (30% weight)
  const failed = tenant.failed_payment_attempts || 0;
  if (failed >= 3) score += 30;
  else if (failed >= 2) score += 20;
  else if (failed >= 1) score += 10;

  // Subscription status (20% weight)
  const sub = tenant.effective_subscription_status || tenant.subscription_status;
  if (sub === "past_due") score += 20;
  else if (sub === "paused") score += 15;
  else if (sub === "cancelled") score += 20;

  // Setup complete (10% weight)
  if (tenant.metadata?.setup_complete === false) score += 10;

  return Math.min(100, score);
}

function ChurnPredictor({ tenants }) {
  const scored = useMemo(() => {
    return tenants
      .filter(t => t.status === "active")
      .map(t => ({ ...t, churnScore: calculateChurnRisk(t) }))
      .sort((a, b) => b.churnScore - a.churnScore);
  }, [tenants]);

  const critical = scored.filter(t => t.churnScore >= 60);
  const high = scored.filter(t => t.churnScore >= 30 && t.churnScore < 60);
  const low = scored.filter(t => t.churnScore < 30);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-red-400" />
        <p className="text-[13px] font-bold text-white">Churn Risk Predictor</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-3 text-center">
          <p className="text-2xl font-black text-red-400">{critical.length}</p>
          <p className="text-[10px] text-gray-500">Riesgo Critico</p>
          <p className="text-[9px] text-gray-700">Score ≥60</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-3 text-center">
          <p className="text-2xl font-black text-amber-400">{high.length}</p>
          <p className="text-[10px] text-gray-500">Riesgo Alto</p>
          <p className="text-[9px] text-gray-700">Score 30-59</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-3 text-center">
          <p className="text-2xl font-black text-emerald-400">{low.length}</p>
          <p className="text-[10px] text-gray-500">Saludables</p>
          <p className="text-[9px] text-gray-700">Score &lt;30</p>
        </div>
      </div>

      {critical.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold mb-1">Top riesgo</p>
          {critical.slice(0, 5).map(t => (
            <div key={t.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <div className="min-w-0">
                <p className="text-[12px] text-white font-semibold truncate">{t.name}</p>
                <p className="text-[10px] text-gray-600">{t.last_login ? `Ultimo login ${timeAgo(t.last_login)}` : "Nunca entro"}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-red-500" style={{ width: `${t.churnScore}%` }} />
                </div>
                <span className="text-[11px] font-bold text-red-400 tabular-nums">{t.churnScore}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Revenue Forecast ─────────────────────────────────────────────────────────
function RevenueForecast({ tenants }) {
  const forecast = useMemo(() => {
    const activeTenants = tenants.filter(t => t.status === "active");
    const currentMRR = activeTenants.reduce((sum, t) => sum + (t.effective_monthly_cost || 0), 0);

    // Calculate growth rate based on tenant creation dates
    const now = new Date();
    const last30 = activeTenants.filter(t => {
      if (!t.created_date) return false;
      return (now - new Date(t.created_date).getTime()) / 86400000 <= 30;
    });
    const previous30 = activeTenants.filter(t => {
      if (!t.created_date) return false;
      const days = (now - new Date(t.created_date).getTime()) / 86400000;
      return days > 30 && days <= 60;
    });

    const growthRate = previous30.length > 0 ? (last30.length - previous30.length) / previous30.length : 0;
    const newMRR30 = last30.reduce((s, t) => s + (t.effective_monthly_cost || 0), 0);

    // Simple projection: MRR + (new MRR × months)
    const forecast30 = currentMRR + newMRR30;
    const forecast60 = currentMRR + (newMRR30 * 2);
    const forecast90 = currentMRR + (newMRR30 * 3);

    return {
      currentMRR,
      forecast30,
      forecast60,
      forecast90,
      growthRate: growthRate * 100,
      newTenants30: last30.length,
      newMRR30,
    };
  }, [tenants]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-purple-400" />
        <p className="text-[13px] font-bold text-white">Revenue Forecast</p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "MRR Actual", value: forecast.currentMRR, highlight: false },
          { label: "30 dias", value: forecast.forecast30, highlight: false },
          { label: "60 dias", value: forecast.forecast60, highlight: false },
          { label: "90 dias", value: forecast.forecast90, highlight: true },
        ].map(f => (
          <div key={f.label} className={`rounded-xl border p-3 text-center ${
            f.highlight ? "border-purple-500/30 bg-purple-500/[0.05]" : "border-white/[0.06] bg-white/[0.02]"
          }`}>
            <p className="text-[10px] text-gray-600 uppercase tracking-wide font-bold">{f.label}</p>
            <p className={`text-xl font-black mt-1 ${f.highlight ? "text-purple-300" : "text-white"}`}>
              ${Math.round(f.value).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] text-gray-600">Growth Rate</p>
          <p className={`text-sm font-bold ${forecast.growthRate >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {forecast.growthRate >= 0 ? "+" : ""}{forecast.growthRate.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600">Nuevas (30d)</p>
          <p className="text-sm font-bold text-blue-400">{forecast.newTenants30}</p>
        </div>
        <div>
          <p className="text-[10px] text-gray-600">New MRR (30d)</p>
          <p className="text-sm font-bold text-cyan-400">${Math.round(forecast.newMRR30)}</p>
        </div>
      </div>
    </div>
  );
}

// ── Cohort Analysis ──────────────────────────────────────────────────────────
function CohortAnalysis({ tenants }) {
  const cohorts = useMemo(() => {
    const groups = {};
    tenants.forEach(t => {
      if (!t.created_date) return;
      const d = new Date(t.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = { key, total: 0, active: 0, paying: 0, mrr: 0 };
      groups[key].total++;
      if (t.status === "active") groups[key].active++;
      if (t.last_payment_date || t.stripe_subscription_id) {
        groups[key].paying++;
        groups[key].mrr += (t.effective_monthly_cost || 0);
      }
    });
    return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key)).slice(0, 6);
  }, [tenants]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-cyan-400" />
        <p className="text-[13px] font-bold text-white">Cohort Analysis</p>
      </div>

      {cohorts.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-4">Sin datos de cohortes</p>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-2 px-2 text-[10px] text-gray-600 uppercase tracking-wide font-bold border-b border-white/[0.05] pb-2">
            <div>Cohorte</div>
            <div className="text-right">Total</div>
            <div className="text-right">Activas</div>
            <div className="text-right">Pagando</div>
            <div className="text-right">Retencion</div>
          </div>
          {cohorts.map(c => {
            const retention = c.total > 0 ? Math.round((c.active / c.total) * 100) : 0;
            return (
              <div key={c.key} className="grid grid-cols-5 gap-2 px-2 py-2 rounded-lg hover:bg-white/[0.02]">
                <div className="text-[12px] text-white font-semibold tabular-nums">{c.key}</div>
                <div className="text-[12px] text-gray-400 text-right tabular-nums">{c.total}</div>
                <div className="text-[12px] text-emerald-400 text-right tabular-nums">{c.active}</div>
                <div className="text-[12px] text-purple-400 text-right tabular-nums">{c.paying}</div>
                <div className="flex items-center gap-1.5 justify-end">
                  <div className="w-12 h-1 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className={`h-full rounded-full ${
                      retention >= 70 ? "bg-emerald-400" : retention >= 40 ? "bg-amber-400" : "bg-red-400"
                    }`} style={{ width: `${retention}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-white tabular-nums w-8 text-right">{retention}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Usage Heatmap ────────────────────────────────────────────────────────────
function UsageHeatmap({ tenants }) {
  const { adminSupabase } = useGACC();
  const [usage, setUsage] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [orders, sales, customers, products] = await Promise.all([
          adminSupabase.from("order").select("tenant_id").limit(10000),
          adminSupabase.from("sale").select("tenant_id").limit(10000),
          adminSupabase.from("customer").select("tenant_id").limit(10000),
          adminSupabase.from("product").select("tenant_id").limit(10000),
        ]);
        const map = {};
        tenants.forEach(t => {
          map[t.id] = {
            orders: (orders.data || []).filter(r => r.tenant_id === t.id).length,
            sales: (sales.data || []).filter(r => r.tenant_id === t.id).length,
            customers: (customers.data || []).filter(r => r.tenant_id === t.id).length,
            products: (products.data || []).filter(r => r.tenant_id === t.id).length,
          };
        });
        setUsage(map);
      } catch (e) {
        console.error("Usage error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenants.length]);

  const maxValues = useMemo(() => {
    const values = Object.values(usage);
    return {
      orders: Math.max(1, ...values.map(v => v.orders || 0)),
      sales: Math.max(1, ...values.map(v => v.sales || 0)),
      customers: Math.max(1, ...values.map(v => v.customers || 0)),
      products: Math.max(1, ...values.map(v => v.products || 0)),
    };
  }, [usage]);

  const colorFor = (val, max) => {
    const pct = val / max;
    if (pct >= 0.7) return "bg-emerald-500/40 border-emerald-500/50";
    if (pct >= 0.4) return "bg-cyan-500/30 border-cyan-500/40";
    if (pct >= 0.1) return "bg-blue-500/20 border-blue-500/30";
    if (val > 0) return "bg-white/[0.04] border-white/[0.08]";
    return "bg-white/[0.02] border-white/[0.04]";
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-emerald-400" />
        <p className="text-[13px] font-bold text-white">Usage Heatmap</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-gray-600" /></div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-2 px-2 text-[10px] text-gray-600 uppercase tracking-wide font-bold border-b border-white/[0.05] pb-2">
            <div>Tienda</div>
            <div className="text-center">Ordenes</div>
            <div className="text-center">Ventas</div>
            <div className="text-center">Clientes</div>
            <div className="text-center">Productos</div>
          </div>
          {tenants.filter(t => t.status === "active").slice(0, 15).map(t => {
            const u = usage[t.id] || { orders: 0, sales: 0, customers: 0, products: 0 };
            return (
              <div key={t.id} className="grid grid-cols-5 gap-2 px-2 py-1.5 items-center">
                <div className="text-[11px] text-white font-semibold truncate">{t.name}</div>
                {["orders", "sales", "customers", "products"].map(k => (
                  <div key={k} className="flex justify-center">
                    <div className={`w-full max-w-[60px] h-7 rounded-md border flex items-center justify-center text-[10px] font-bold text-white tabular-nums ${colorFor(u[k], maxValues[k])}`}>
                      {u[k]}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── LTV by Plan ──────────────────────────────────────────────────────────────
function LTVByPlan({ tenants }) {
  const ltv = useMemo(() => {
    const now = new Date();
    const byPlan = {};
    PLAN_OPTIONS.forEach(p => { byPlan[p.key] = { label: p.label, count: 0, avgLifetimeMonths: 0, totalMonths: 0, monthlyPrice: p.monthlyCost, color: p.color }; });

    tenants.forEach(t => {
      const plan = t.effective_plan || t.plan || "starter";
      if (!byPlan[plan]) byPlan[plan] = { label: plan, count: 0, avgLifetimeMonths: 0, totalMonths: 0, monthlyPrice: t.effective_monthly_cost || 0, color: "from-gray-500 to-gray-600" };
      if (!t.created_date) return;
      const months = (now - new Date(t.created_date).getTime()) / (86400000 * 30);
      byPlan[plan].count++;
      byPlan[plan].totalMonths += months;
    });

    Object.values(byPlan).forEach(p => {
      p.avgLifetimeMonths = p.count > 0 ? p.totalMonths / p.count : 0;
      p.ltv = p.avgLifetimeMonths * p.monthlyPrice;
    });

    return Object.entries(byPlan).filter(([, v]) => v.count > 0);
  }, [tenants]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-emerald-400" />
        <p className="text-[13px] font-bold text-white">LTV por Plan</p>
      </div>

      <div className="space-y-3">
        {ltv.map(([key, plan]) => (
          <div key={key} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-3">
              <span className={`text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r ${plan.color} text-white font-bold`}>
                {plan.label}
              </span>
              <span className="text-[11px] text-gray-500">{plan.count} tiendas</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[10px] text-gray-600">Lifetime</p>
                <p className="text-[12px] font-bold text-white">{plan.avgLifetimeMonths.toFixed(1)} meses</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-600">LTV</p>
                <p className="text-[14px] font-black text-emerald-400">${Math.round(plan.ltv).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Feature Adoption Tracker ─────────────────────────────────────────────────
function FeatureAdoption({ tenants }) {
  const adoption = useMemo(() => {
    const total = tenants.filter(t => t.status === "active").length || 1;
    const features = [
      { key: "pos_basic", label: "POS", plans: ["starter", "pro", "business"] },
      { key: "inventory_basic", label: "Inventario", plans: ["starter", "pro", "business"] },
      { key: "orders_photos", label: "Fotos en Ordenes", plans: ["pro", "business"] },
      { key: "permissions_roles", label: "Roles y Permisos", plans: ["pro", "business"] },
      { key: "reports_financial", label: "Reportes Financieros", plans: ["business"] },
      { key: "automations_triggers", label: "Automatizaciones", plans: ["business"] },
    ];

    return features.map(f => {
      const eligible = tenants.filter(t =>
        t.status === "active" && f.plans.includes(t.effective_plan || t.plan || "starter")
      ).length;
      const pct = total > 0 ? Math.round((eligible / total) * 100) : 0;
      return { ...f, eligible, pct };
    });
  }, [tenants]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-4 h-4 text-blue-400" />
        <p className="text-[13px] font-bold text-white">Feature Adoption</p>
      </div>

      <div className="space-y-2">
        {adoption.map(f => (
          <div key={f.key}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[12px] text-white font-semibold">{f.label}</p>
              <p className="text-[11px] text-gray-500 tabular-nums">{f.eligible} tiendas &middot; {f.pct}%</p>
            </div>
            <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${f.pct}%` }}
                transition={{ duration: 0.6 }}
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Analytics View ──────────────────────────────────────────────────────
export default function AnalyticsView() {
  const { tenants, loading, refresh } = useGACC();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Analytics</h2>
          <p className="text-[11px] text-gray-600">Inteligencia de negocio, forecast y predicciones</p>
        </div>
        <button onClick={refresh} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] text-gray-500 hover:text-white border border-white/[0.07] hover:border-white/[0.15] bg-white/[0.02] transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <ChurnPredictor tenants={tenants} />
      <RevenueForecast tenants={tenants} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CohortAnalysis tenants={tenants} />
        <LTVByPlan tenants={tenants} />
      </div>

      <UsageHeatmap tenants={tenants} />
      <FeatureAdoption tenants={tenants} />
    </div>
  );
}
