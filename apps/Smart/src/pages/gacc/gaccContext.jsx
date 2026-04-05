/**
 * GACC Context — shared data layer for all GACC sub-views
 * Provides: tenants, subscriptions, metrics, loading state, actions
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import appClient from "@/api/appClient";

// ── Admin Supabase client (service role, lazy singleton) ─────────────────────
let _adminInstance = null;
export function getAdminClient() {
  if (_adminInstance) return _adminInstance;
  const url = import.meta.env.VITE_SUPABASE_URL || "https://idntuvtabecwubzswpwi.supabase.co";
  const srk = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (srk) {
    _adminInstance = createClient(url, srk, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    return _adminInstance;
  }
  return supabase;
}

// ── Plan config ──────────────────────────────────────────────────────────────
// Synced with /lib/plans.js — these are the canonical plan IDs
export const PLAN_OPTIONS = [
  { key: "starter", label: "Starter", sub: "1 usuario · $14.99/mo", maxUsers: 1, monthlyCost: 14.99, color: "from-slate-500 to-slate-600" },
  { key: "pro", label: "Pro", sub: "5 usuarios · $39.99/mo", maxUsers: 5, monthlyCost: 39.99, color: "from-blue-500 to-indigo-600" },
  { key: "business", label: "Business", sub: "10 usuarios · $79.99/mo", maxUsers: 10, monthlyCost: 79.99, color: "from-purple-500 to-pink-600" },
];

export function normalizePlan(plan) {
  // Map all legacy plan names to canonical IDs (same as plans.js normalizePlanId)
  const map = {
    smartfixos: "starter",
    basic: "starter",
    starter: "starter",
    pro: "pro",
    enterprise: "business",
    business: "business",
  };
  return map[String(plan || "").trim().toLowerCase()] || "starter";
}

export function getPlanConfig(plan) {
  return PLAN_OPTIONS.find(o => o.key === normalizePlan(plan)) || PLAN_OPTIONS[0];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "Ahora mismo";
  if (mins < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days} dias`;
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`;
  if (days < 365) return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? "es" : ""}`;
  return `Hace ${Math.floor(days / 365)} ano${Math.floor(days / 365) > 1 ? "s" : ""}`;
}

export function activityColor(dateStr) {
  if (!dateStr) return { dot: "bg-gray-700", badge: "bg-gray-500/15 text-gray-500", label: "Nunca" };
  const days = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (days < 1)  return { dot: "bg-emerald-400 animate-pulse", badge: "bg-emerald-500/15 text-emerald-400", label: "Hoy" };
  if (days < 3)  return { dot: "bg-lime-400", badge: "bg-lime-500/15 text-lime-400", label: "Reciente" };
  if (days < 7)  return { dot: "bg-amber-400", badge: "bg-amber-500/15 text-amber-400", label: "Esta semana" };
  if (days < 30) return { dot: "bg-orange-400", badge: "bg-orange-500/15 text-orange-400", label: "Este mes" };
  return { dot: "bg-red-500", badge: "bg-red-500/15 text-red-400", label: "Inactivo" };
}

export function presenceStatus(lastSeenStr) {
  if (!lastSeenStr) return null;
  const mins = (Date.now() - new Date(lastSeenStr).getTime()) / 60000;
  if (mins < 4) return { label: "Online", dot: "bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" };
  if (mins < 30) return { label: "Reciente", dot: "bg-amber-400", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  return null;
}

export function getStatusBadge(tenant) {
  const sub = tenant.effective_subscription_status || tenant.subscription_status;
  const trialDate = tenant.effective_trial_end_date || tenant.trial_end_date;

  // Priority 1: setup incomplete
  if (tenant.metadata?.setup_complete === false)
    return { label: "Sin activar", cls: "bg-purple-500/20 text-purple-300 border-purple-500/40" };

  // Priority 2: suspended / cancelled
  if (tenant.status === "suspended")
    return { label: "Suspendida", cls: "bg-red-500/20 text-red-300 border-red-500/30" };
  if (tenant.status === "cancelled")
    return { label: "Cancelada", cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" };

  // Priority 3: check if already paying (has made a payment or subscription is active with payment)
  const hasPaid = !!(tenant.last_payment_date || tenant.last_payment_amount > 0 ||
    tenant.stripe_subscription_id || tenant.latest_subscription?.last_payment_status === "succeeded");

  // If already paying, show as active — trial is irrelevant
  if (hasPaid && (sub === "active" || tenant.status === "active"))
    return { label: "Activa", cls: "bg-green-500/20 text-green-300 border-green-500/30" };

  // Priority 4: trial (only if NOT paying)
  const trialLeft = trialDate ? Math.ceil((new Date(trialDate) - new Date()) / 86400000) : null;
  if (trialLeft !== null && trialLeft > 0)
    return { label: `Trial (${trialLeft}d)`, cls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" };
  if (trialLeft !== null && trialLeft <= 0)
    return { label: "Trial vencido", cls: "bg-orange-500/20 text-orange-300 border-orange-500/30" };

  // Priority 5: active without trial
  if (sub === "active" || tenant.status === "active")
    return { label: "Activa", cls: "bg-green-500/20 text-green-300 border-green-500/30" };

  return { label: tenant.status || "--", cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
}

// ── Context ──────────────────────────────────────────────────────────────────
const GACCContext = createContext(null);

export function useGACC() {
  const ctx = useContext(GACCContext);
  if (!ctx) throw new Error("useGACC must be used within GACCProvider");
  return ctx;
}

export function GACCProvider({ children }) {
  const [tenants, setTenants] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const adminSupabase = getAdminClient();

  const loadTenants = useCallback(async () => {
    setLoading(true);
    try {
      let tenantRows, tenantError;
      ({ data: tenantRows, error: tenantError } = await adminSupabase
        .from("tenant")
        .select("id, name, email, slug, plan, status, subscription_status, trial_end_date, created_date, last_login, last_seen, country, currency, timezone, metadata, monthly_cost, admin_name, admin_phone, address, logo_url, stripe_customer_id, stripe_subscription_id, next_billing_date, last_payment_date, last_payment_amount, failed_payment_attempts, activated_date, payment_method")
        .order("created_date", { ascending: false })
        .limit(500));

      if (tenantError && tenantError.message?.includes("last_seen")) {
        ({ data: tenantRows, error: tenantError } = await adminSupabase
          .from("tenant")
          .select("id, name, email, slug, plan, status, subscription_status, trial_end_date, created_date, last_login, country, currency, timezone, metadata, monthly_cost, admin_name, admin_phone, address, logo_url, stripe_customer_id, stripe_subscription_id, next_billing_date, last_payment_date, last_payment_amount, failed_payment_attempts, activated_date, payment_method")
          .order("created_date", { ascending: false })
          .limit(500));
      }

      const { data: subscriptionRows } = await adminSupabase
        .from("subscription")
        .select("*")
        .order("created_at", { ascending: false });

      if (tenantError) throw tenantError;

      setSubscriptions(subscriptionRows || []);

      const subscriptionsByTenant = new Map();
      for (const row of subscriptionRows || []) {
        if (!row?.tenant_id || subscriptionsByTenant.has(row.tenant_id)) continue;
        subscriptionsByTenant.set(row.tenant_id, row);
      }

      const normalized = (tenantRows || []).map((tenant) => {
        const latestSub = subscriptionsByTenant.get(tenant.id) || null;
        const effectivePlan = normalizePlan(latestSub?.plan || tenant.plan);
        const planConfig = getPlanConfig(effectivePlan);
        const metadataLimit = Number(tenant?.metadata?.max_users || 0) || 0;
        return {
          ...tenant,
          latest_subscription: latestSub,
          effective_plan: effectivePlan,
          effective_subscription_status: latestSub?.status || tenant.subscription_status,
          effective_monthly_cost: Number(latestSub?.amount ?? tenant.monthly_cost ?? planConfig.monthlyCost) || planConfig.monthlyCost,
          effective_trial_end_date: latestSub?.trial_end_date || tenant.trial_end_date || null,
          effective_max_users: Math.max(metadataLimit, planConfig.maxUsers || 0),
        };
      });

      setTenants(normalized);
      setLastRefresh(new Date());
    } catch (e) {
      toast.error("Error cargando tiendas: " + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + auto-refresh every 30s
  useEffect(() => {
    loadTenants();
    const iv = setInterval(loadTenants, 30 * 1000);
    return () => clearInterval(iv);
  }, [loadTenants]);

  // ── Computed metrics ──────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const now = Date.now();
    const active = tenants.filter(t => t.status === "active");
    const trials = tenants.filter(t => {
      const te = t.effective_trial_end_date || t.trial_end_date;
      return te && new Date(te) > new Date() && t.status === "active";
    });
    const trialsExpiring = trials.filter(t => {
      const te = t.effective_trial_end_date || t.trial_end_date;
      return Math.ceil((new Date(te) - new Date()) / 86400000) <= 3;
    });
    const suspended = tenants.filter(t => t.status === "suspended");
    const pending = tenants.filter(t => t.metadata?.setup_complete === false);
    const paying = tenants.filter(t => {
      const sub = t.effective_subscription_status || t.subscription_status;
      return sub === "active" && t.status === "active" && !trials.includes(t);
    });
    const mrr = tenants
      .filter(t => t.status === "active")
      .reduce((sum, t) => sum + (t.effective_monthly_cost || 0), 0);

    const failedPayments = subscriptions.filter(s => s.last_payment_status === "failed" && s.status !== "cancelled");

    const online = tenants.filter(t => t.last_seen && (now - new Date(t.last_seen).getTime()) < 4 * 60000).length;
    const active24h = tenants.filter(t => t.last_login && (now - new Date(t.last_login).getTime()) < 86400000).length;
    const active7d = tenants.filter(t => t.last_login && (now - new Date(t.last_login).getTime()) < 7 * 86400000).length;
    const neverLoggedIn = tenants.filter(t => !t.last_login).length;

    return {
      total: tenants.length,
      active: active.length,
      trials: trials.length,
      trialsExpiring: trialsExpiring.length,
      suspended: suspended.length,
      pending: pending.length,
      paying: paying.length,
      mrr,
      failedPayments: failedPayments.length,
      online,
      active24h,
      active7d,
      neverLoggedIn,
    };
  }, [tenants, subscriptions]);

  const value = {
    tenants,
    subscriptions,
    loading,
    lastRefresh,
    metrics,
    refresh: loadTenants,
    adminSupabase,
    appClient,
  };

  return <GACCContext.Provider value={value}>{children}</GACCContext.Provider>;
}
