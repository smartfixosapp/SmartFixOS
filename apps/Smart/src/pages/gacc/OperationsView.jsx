/**
 * GACC — Operations
 * System Health, Activity Feed, Error Tracker, Function Logs
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity, Zap, Server, Database, HardDrive, Shield, Globe,
  CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw,
  Wifi, WifiOff, TrendingUp, Users, ShoppingBag, ArrowUpDown,
  Filter, Eye
} from "lucide-react";
import { useGACC, timeAgo, presenceStatus, activityColor } from "./gaccContext";

// ── System Health Check ──────────────────────────────────────────────────────
function SystemHealth() {
  const { adminSupabase } = useGACC();
  const [checks, setChecks] = useState([
    { name: "Database", icon: Database, status: "checking", latency: null },
    { name: "Storage", icon: HardDrive, status: "checking", latency: null },
    { name: "Auth", icon: Shield, status: "checking", latency: null },
    { name: "Functions", icon: Server, status: "checking", latency: null },
  ]);
  const [lastCheck, setLastCheck] = useState(null);

  const runHealthCheck = async () => {
    const newChecks = [...checks].map(c => ({ ...c, status: "checking", latency: null }));
    setChecks(newChecks);

    // DB check
    const dbStart = Date.now();
    try {
      const { error } = await adminSupabase.from("tenant").select("id").limit(1);
      newChecks[0] = { ...newChecks[0], status: error ? "error" : "ok", latency: Date.now() - dbStart, error: error?.message };
    } catch (e) { newChecks[0] = { ...newChecks[0], status: "error", latency: Date.now() - dbStart, error: e.message }; }

    // Storage check
    const stStart = Date.now();
    try {
      const { error } = await adminSupabase.storage.listBuckets();
      newChecks[1] = { ...newChecks[1], status: error ? "error" : "ok", latency: Date.now() - stStart, error: error?.message };
    } catch (e) { newChecks[1] = { ...newChecks[1], status: "error", latency: Date.now() - stStart, error: e.message }; }

    // Auth check
    const authStart = Date.now();
    try {
      const { error } = await adminSupabase.auth.getSession();
      newChecks[2] = { ...newChecks[2], status: "ok", latency: Date.now() - authStart };
    } catch (e) { newChecks[2] = { ...newChecks[2], status: "error", latency: Date.now() - authStart, error: e.message }; }

    // Functions check
    const fnStart = Date.now();
    try {
      const port = import.meta.env.VITE_FUNCTIONS_PORT || 8686;
      const res = await fetch(`http://localhost:${port}/health`, { signal: AbortSignal.timeout(5000) }).catch(() => null);
      newChecks[3] = { ...newChecks[3], status: res?.ok ? "ok" : "warn", latency: Date.now() - fnStart, error: res?.ok ? null : "No response or non-200" };
    } catch (e) { newChecks[3] = { ...newChecks[3], status: "warn", latency: Date.now() - fnStart, error: "No local server" }; }

    setChecks([...newChecks]);
    setLastCheck(new Date());
  };

  useEffect(() => { runHealthCheck(); }, []);

  const allOk = checks.every(c => c.status === "ok");
  const hasError = checks.some(c => c.status === "error");

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className={`w-4 h-4 ${allOk ? "text-emerald-400" : hasError ? "text-red-400" : "text-amber-400"}`} />
          <p className="text-[13px] font-bold text-white">System Health</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
            allOk ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            : hasError ? "bg-red-500/15 text-red-400 border-red-500/30"
            : "bg-amber-500/15 text-amber-400 border-amber-500/30"
          }`}>
            {allOk ? "All OK" : hasError ? "Issues Detected" : "Degraded"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lastCheck && <span className="text-[10px] text-gray-600">Checked {timeAgo(lastCheck.toISOString())}</span>}
          <button onClick={runHealthCheck} className="p-1.5 rounded-lg text-gray-600 hover:text-white hover:bg-white/[0.05] transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {checks.map(check => {
          const Icon = check.icon;
          return (
            <div key={check.name} className={`rounded-xl border p-3 transition-all ${
              check.status === "ok" ? "border-emerald-500/20 bg-emerald-500/[0.03]"
              : check.status === "error" ? "border-red-500/20 bg-red-500/[0.03]"
              : check.status === "warn" ? "border-amber-500/20 bg-amber-500/[0.03]"
              : "border-white/[0.05] bg-white/[0.01]"
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${
                  check.status === "ok" ? "text-emerald-400"
                  : check.status === "error" ? "text-red-400"
                  : check.status === "warn" ? "text-amber-400"
                  : "text-gray-600 animate-pulse"
                }`} />
                <span className="text-[12px] text-white font-semibold">{check.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold ${
                  check.status === "ok" ? "text-emerald-400" : check.status === "error" ? "text-red-400" : check.status === "warn" ? "text-amber-400" : "text-gray-600"
                }`}>
                  {check.status === "checking" ? "Checking..." : check.status.toUpperCase()}
                </span>
                {check.latency !== null && (
                  <span className="text-[10px] text-gray-600 tabular-nums">{check.latency}ms</span>
                )}
              </div>
              {check.error && <p className="text-[9px] text-red-400/70 mt-1 truncate">{check.error}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Global Activity Feed ─────────────────────────────────────────────────────
function ActivityFeed({ tenants }) {
  const [filterType, setFilterType] = useState("all");

  const feed = useMemo(() => {
    const events = [];

    tenants.forEach(t => {
      if (t.last_login) events.push({ type: "login", tenant: t.name, date: t.last_login, detail: "Login" });
      if (t.created_date) events.push({ type: "register", tenant: t.name, date: t.created_date, detail: "Registro" });
      if (t.activated_date) events.push({ type: "activate", tenant: t.name, date: t.activated_date, detail: "Activacion" });
    });

    return events
      .filter(e => filterType === "all" || e.type === filterType)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 30);
  }, [tenants, filterType]);

  const typeConfig = {
    login: { icon: Wifi, color: "text-emerald-400", dot: "bg-emerald-400" },
    register: { icon: Users, color: "text-blue-400", dot: "bg-blue-400" },
    activate: { icon: CheckCircle, color: "text-purple-400", dot: "bg-purple-400" },
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <p className="text-[13px] font-bold text-white">Activity Feed</p>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-lg p-0.5">
          {[
            { key: "all", label: "Todo" },
            { key: "login", label: "Logins" },
            { key: "register", label: "Registros" },
            { key: "activate", label: "Activaciones" },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all ${
                filterType === f.key ? "bg-white/[0.08] text-white" : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 max-h-[400px] overflow-y-auto">
        {feed.map((event, i) => {
          const cfg = typeConfig[event.type] || typeConfig.login;
          return (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.02] transition-colors">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
              <div className="flex-1 min-w-0">
                <span className="text-[12px] text-white font-semibold">{event.tenant}</span>
                <span className={`text-[11px] ml-2 ${cfg.color}`}>{event.detail}</span>
              </div>
              <span className="text-[10px] text-gray-600 flex-shrink-0 tabular-nums">
                {new Date(event.date).toLocaleDateString("es", { day: "2-digit", month: "short" })} {new Date(event.date).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })}
        {feed.length === 0 && <p className="text-xs text-gray-600 text-center py-6">Sin eventos</p>}
      </div>
    </div>
  );
}

// ── Presence Monitor ─────────────────────────────────────────────────────────
function PresenceMonitor({ tenants }) {
  const { metrics } = useGACC();

  const presenceData = useMemo(() => {
    return tenants
      .filter(t => t.last_seen || t.last_login)
      .map(t => {
        const presence = presenceStatus(t.last_seen);
        const ac = activityColor(t.last_login);
        return { ...t, presence, ac };
      })
      .sort((a, b) => {
        const aDate = a.last_seen || a.last_login || "";
        const bDate = b.last_seen || b.last_login || "";
        return new Date(bDate) - new Date(aDate);
      });
  }, [tenants]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-emerald-400" />
          <p className="text-[13px] font-bold text-white">Presencia en Tiempo Real</p>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> {metrics.online} online</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> {metrics.active24h} hoy</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> {metrics.active7d} semana</span>
        </div>
      </div>

      <div className="space-y-1">
        {presenceData.map(t => (
          <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.02] transition-colors">
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.presence ? t.presence.dot : t.ac.dot}`} />
            <p className="text-[12px] text-white font-semibold flex-1 truncate">{t.name}</p>
            {t.presence && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-bold ${t.presence.badge}`}>
                {t.presence.label}
              </span>
            )}
            <span className="text-[10px] text-gray-600 flex-shrink-0">
              {timeAgo(t.last_seen || t.last_login)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Operations View ─────────────────────────────────────────────────────
export default function OperationsView() {
  const { tenants, loading, refresh } = useGACC();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Operations</h2>
          <p className="text-[11px] text-gray-600">Monitoreo del sistema y actividad global</p>
        </div>
        <button onClick={refresh} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] text-gray-500 hover:text-white border border-white/[0.07] hover:border-white/[0.15] bg-white/[0.02] transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <SystemHealth />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityFeed tenants={tenants} />
        <PresenceMonitor tenants={tenants} />
      </div>
    </div>
  );
}
