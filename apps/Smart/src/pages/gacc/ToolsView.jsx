/**
 * GACC — Internal Tools
 * Data Explorer, Storage Manager, Feature Flags, Bulk Actions, Diagnostics
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Wrench, Database, HardDrive, ToggleLeft, ToggleRight, Zap,
  Search, RefreshCw, Download, Trash2, Eye, Filter, Play,
  CheckCircle, XCircle, AlertTriangle, Building2, Clock,
  Users, ShoppingBag, Mail, ArrowRight, Settings
} from "lucide-react";
import { useGACC, timeAgo, getPlanConfig } from "./gaccContext";
import { toast } from "sonner";

// ── Data Explorer ────────────────────────────────────────────────────────────
function DataExplorer() {
  const { adminSupabase } = useGACC();
  const [table, setTable] = useState("tenant");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(25);
  const [columns, setColumns] = useState([]);

  const TABLES = ["tenant", "subscription", "order", "sale", "customer", "product", "inventory", "app_employee", "users", "transaction", "audit_log", "notification"];

  const query = async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await adminSupabase
        .from(table)
        .select("*")
        .order("created_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      setData(rows || []);
      if (rows?.length > 0) setColumns(Object.keys(rows[0]).slice(0, 10));
    } catch (e) {
      toast.error("Query error: " + e.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { query(); }, [table, limit]);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Database className="w-4 h-4 text-cyan-400" />
        <p className="text-[13px] font-bold text-white">Data Explorer</p>
        <span className="text-[10px] text-gray-600">Read-only</span>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={table}
          onChange={e => setTable(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-[12px] text-white outline-none cursor-pointer"
        >
          {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
          className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-[12px] text-gray-400 outline-none cursor-pointer"
        >
          {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} rows</option>)}
        </select>
        <button onClick={query} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all">
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Query
        </button>
        <span className="text-[10px] text-gray-600">{data.length} results</span>
      </div>

      {/* Data table */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-xl border border-white/[0.05]">
        {data.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-8">Sin datos</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[#0d0d0f] z-10">
              <tr className="border-b border-white/[0.06]">
                {columns.map(col => (
                  <th key={col} className="text-left px-3 py-2 text-[10px] text-gray-600 uppercase tracking-wide font-bold whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                  {columns.map(col => (
                    <td key={col} className="px-3 py-2 text-gray-400 max-w-[200px] truncate whitespace-nowrap">
                      {typeof row[col] === "object" ? JSON.stringify(row[col])?.slice(0, 50) : String(row[col] ?? "--")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Storage Manager ──────────────────────────────────────────────────────────
function StorageManager() {
  const { adminSupabase, tenants } = useGACC();
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await adminSupabase.storage.listBuckets();
        if (error) throw error;
        setBuckets(data || []);
      } catch (e) {
        console.error("Storage error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <HardDrive className="w-4 h-4 text-orange-400" />
        <p className="text-[13px] font-bold text-white">Storage Manager</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><RefreshCw className="w-5 h-5 animate-spin text-gray-600" /></div>
      ) : buckets.length === 0 ? (
        <p className="text-xs text-gray-600 text-center py-6">Sin buckets encontrados</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {buckets.map(bucket => (
            <div key={bucket.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 mb-2">
                <HardDrive className="w-4 h-4 text-gray-500" />
                <p className="text-[12px] text-white font-semibold">{bucket.name}</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-600">
                <span>{bucket.public ? "Publico" : "Privado"}</span>
                <span>Creado: {bucket.created_at ? new Date(bucket.created_at).toLocaleDateString("es") : "--"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Feature Flags ────────────────────────────────────────────────────────────
function FeatureFlags() {
  const { adminSupabase, tenants, refresh } = useGACC();
  const [flags, setFlags] = useState([
    { key: "pos_enabled", label: "POS Module", description: "Sistema de punto de venta", enabled: true },
    { key: "ai_analytics", label: "AI Analytics", description: "Analitica con inteligencia artificial", enabled: true },
    { key: "appointments", label: "Appointments", description: "Sistema de citas", enabled: true },
    { key: "customer_portal", label: "Customer Portal", description: "Portal de clientes externo", enabled: true },
    { key: "multi_location", label: "Multi-Location", description: "Soporte para multiples sucursales", enabled: false },
    { key: "api_access", label: "API Access", description: "Acceso a API externa", enabled: false },
    { key: "custom_branding", label: "Custom Branding", description: "Logo y colores personalizados", enabled: false },
    { key: "advanced_reports", label: "Advanced Reports", description: "Reportes financieros avanzados", enabled: true },
  ]);

  const toggleFlag = (key) => {
    setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
    toast.success(`Feature flag "${key}" actualizado`);
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-purple-400" />
          <p className="text-[13px] font-bold text-white">Feature Flags</p>
        </div>
        <span className="text-[10px] text-gray-600">{flags.filter(f => f.enabled).length} de {flags.length} activos</span>
      </div>

      <div className="space-y-2">
        {flags.map(flag => (
          <div key={flag.key} className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.05] bg-white/[0.015] hover:bg-white/[0.03] transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-[12px] text-white font-semibold">{flag.label}</p>
              <p className="text-[10px] text-gray-600">{flag.description}</p>
            </div>
            <button
              onClick={() => toggleFlag(flag.key)}
              className={`p-1.5 rounded-lg transition-all ${
                flag.enabled ? "text-emerald-400 hover:bg-emerald-500/10" : "text-gray-600 hover:bg-white/[0.05]"
              }`}
            >
              {flag.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 rounded-xl bg-blue-500/5 border border-blue-500/10">
        <p className="text-[10px] text-blue-400">Los feature flags se persisten cuando se conecte el sistema de configuracion global. Actualmente son visuales.</p>
      </div>
    </div>
  );
}

// ── Diagnostics ──────────────────────────────────────────────────────────────
function Diagnostics() {
  const { tenants, adminSupabase } = useGACC();
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);

  const runDiagnostics = async () => {
    setRunning(true);
    const checks = [];

    // Check each tenant's health
    for (const t of tenants) {
      const issues = [];

      if (!t.email) issues.push("Sin email");
      if (t.metadata?.setup_complete === false) issues.push("Setup incompleto");
      if (!t.last_login) issues.push("Nunca ha entrado");
      if (t.status === "active" && !t.plan) issues.push("Sin plan asignado");
      if ((t.failed_payment_attempts || 0) > 0) issues.push(`${t.failed_payment_attempts} pagos fallidos`);

      const trialEnd = t.effective_trial_end_date || t.trial_end_date;
      if (trialEnd && new Date(trialEnd) < new Date() && t.status === "active") {
        issues.push("Trial vencido pero sigue activa");
      }

      checks.push({
        tenant: t.name,
        email: t.email,
        status: issues.length === 0 ? "ok" : issues.length <= 1 ? "warn" : "error",
        issues,
      });
    }

    // DB connectivity
    try {
      const { count } = await adminSupabase.from("tenant").select("id", { count: "exact", head: true });
      checks.unshift({ tenant: "DATABASE", email: "", status: "ok", issues: [], system: true, detail: `${count} tenants en DB` });
    } catch (e) {
      checks.unshift({ tenant: "DATABASE", email: "", status: "error", issues: [e.message], system: true });
    }

    setResults(checks);
    setRunning(false);
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <p className="text-[13px] font-bold text-white">Diagnostics</p>
        </div>
        <button
          onClick={runDiagnostics}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all"
        >
          {running ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Run Diagnostics
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
              r.status === "ok" ? "border-emerald-500/15 bg-emerald-500/[0.02]" :
              r.status === "warn" ? "border-amber-500/15 bg-amber-500/[0.02]" :
              "border-red-500/15 bg-red-500/[0.02]"
            }`}>
              {r.status === "ok" ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" /> :
               r.status === "warn" ? <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" /> :
               <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className={`text-[12px] font-semibold ${r.system ? "text-cyan-400" : "text-white"}`}>{r.tenant}</p>
                {r.detail && <p className="text-[10px] text-gray-600">{r.detail}</p>}
                {r.issues.length > 0 && (
                  <p className="text-[10px] text-gray-500">{r.issues.join(" | ")}</p>
                )}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-4 text-[10px] text-gray-600 mt-2 px-1">
            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-emerald-400" /> {results.filter(r => r.status === "ok").length} OK</span>
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> {results.filter(r => r.status === "warn").length} Warnings</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-400" /> {results.filter(r => r.status === "error").length} Errors</span>
          </div>
        </div>
      )}

      {results.length === 0 && !running && (
        <p className="text-xs text-gray-600 text-center py-6">Ejecuta diagnosticos para verificar el estado de todas las tiendas</p>
      )}
    </div>
  );
}

// ── Bulk Actions ─────────────────────────────────────────────────────────────
function BulkActions() {
  const { tenants, appClient, refresh } = useGACC();
  const [action, setAction] = useState("");
  const [running, setRunning] = useState(false);

  const actions = [
    { key: "extend_trials", label: "Extender trials (15 dias)", description: "Extiende el trial de todas las tiendas con trial activo", color: "text-amber-400" },
    { key: "suspend_expired", label: "Suspender trials vencidos", description: "Suspende tiendas cuyo trial ya vencio", color: "text-red-400" },
  ];

  const executeBulk = async (actionKey) => {
    if (!confirm(`Ejecutar "${actions.find(a => a.key === actionKey)?.label}" en todas las tiendas aplicables?`)) return;
    setRunning(true);
    try {
      if (actionKey === "extend_trials") {
        const trials = tenants.filter(t => {
          const te = t.effective_trial_end_date || t.trial_end_date;
          return te && new Date(te) > new Date() && t.status === "active";
        });
        let count = 0;
        for (const t of trials) {
          try {
            await appClient.functions.manageTenant({ tenantId: t.id, action: "extend_trial" });
            count++;
          } catch {}
        }
        toast.success(`Trial extendido para ${count} tiendas`);
      } else if (actionKey === "suspend_expired") {
        const expired = tenants.filter(t => {
          const te = t.effective_trial_end_date || t.trial_end_date;
          return te && new Date(te) < new Date() && t.status === "active";
        });
        let count = 0;
        for (const t of expired) {
          try {
            await appClient.functions.manageTenant({ tenantId: t.id, action: "suspend" });
            count++;
          } catch {}
        }
        toast.success(`${count} tiendas suspendidas`);
      }
      refresh();
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-red-400" />
        <p className="text-[13px] font-bold text-white">Bulk Actions</p>
      </div>

      <div className="space-y-2">
        {actions.map(a => (
          <div key={a.key} className="flex items-center justify-between px-4 py-3 rounded-xl border border-white/[0.05] bg-white/[0.015]">
            <div>
              <p className={`text-[12px] font-semibold ${a.color}`}>{a.label}</p>
              <p className="text-[10px] text-gray-600">{a.description}</p>
            </div>
            <button
              onClick={() => executeBulk(a.key)}
              disabled={running}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white/[0.05] text-gray-400 border border-white/[0.1] hover:text-white hover:border-white/[0.2] transition-all disabled:opacity-50"
            >
              {running ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              Ejecutar
            </button>
          </div>
        ))}
      </div>

      <div className="px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/10">
        <p className="text-[10px] text-red-400">Las bulk actions afectan multiples tiendas. Usa con precaucion.</p>
      </div>
    </div>
  );
}

// ── Main Tools View ──────────────────────────────────────────────────────────
export default function ToolsView() {
  const [tab, setTab] = useState("explorer"); // explorer | storage | flags | bulk | diagnostics

  const tabs = [
    { key: "explorer", label: "Data Explorer", icon: Database },
    { key: "storage", label: "Storage", icon: HardDrive },
    { key: "flags", label: "Feature Flags", icon: Settings },
    { key: "bulk", label: "Bulk Actions", icon: Zap },
    { key: "diagnostics", label: "Diagnostics", icon: AlertTriangle },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white">Internal Tools</h2>
          <p className="text-[11px] text-gray-600">Herramientas de administracion y diagnostico</p>
        </div>
      </div>

      {/* Tool tabs */}
      <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.05] overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap ${
              tab === t.key ? "bg-white/[0.08] text-white" : "text-gray-600 hover:text-gray-400"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "explorer" && <DataExplorer />}
      {tab === "storage" && <StorageManager />}
      {tab === "flags" && <FeatureFlags />}
      {tab === "bulk" && <BulkActions />}
      {tab === "diagnostics" && <Diagnostics />}
    </div>
  );
}
