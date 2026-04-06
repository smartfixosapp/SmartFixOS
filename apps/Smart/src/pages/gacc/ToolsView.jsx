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
  Users, ShoppingBag, Mail, ArrowRight, Settings, UserCheck,
  Activity, ExternalLink
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

// ── Impersonation Tool ───────────────────────────────────────────────────────
function ImpersonationTool() {
  const { tenants, adminSupabase } = useGACC();
  const [selectedId, setSelectedId] = useState("");
  const [tenantData, setTenantData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return tenants;
    const q = search.toLowerCase();
    return tenants.filter(t => (t.name || "").toLowerCase().includes(q) || (t.email || "").toLowerCase().includes(q));
  }, [tenants, search]);

  const loadTenantData = async (tenantId) => {
    setLoading(true);
    try {
      const [orders, customers, employees, sales] = await Promise.all([
        adminSupabase.from("order").select("id, order_number, status, created_date").eq("tenant_id", tenantId).order("created_date", { ascending: false }).limit(10),
        adminSupabase.from("customer").select("id, full_name, email, phone").eq("tenant_id", tenantId).order("created_date", { ascending: false }).limit(10),
        adminSupabase.from("app_employee").select("id, full_name, email, role, active").eq("tenant_id", tenantId),
        adminSupabase.from("sale").select("id, sale_number, total, created_date").eq("tenant_id", tenantId).order("created_date", { ascending: false }).limit(10),
      ]);
      setTenantData({
        orders: orders.data || [],
        customers: customers.data || [],
        employees: employees.data || [],
        sales: sales.data || [],
      });
    } catch (e) {
      toast.error("Error cargando datos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedTenant = tenants.find(t => t.id === selectedId);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="w-4 h-4 text-amber-400" />
        <p className="text-[13px] font-bold text-white">Impersonation (Read-Only)</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar tienda..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[12px] text-white placeholder:text-gray-700 focus:outline-none"
          />
        </div>
        <select
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setTenantData(null); }}
          className="px-3 py-2 rounded-xl bg-white/[0.05] border border-white/[0.1] text-[12px] text-white outline-none cursor-pointer max-w-xs"
        >
          <option value="">Seleccionar tienda...</option>
          {filtered.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
        </select>
        <button
          onClick={() => selectedId && loadTenantData(selectedId)}
          disabled={!selectedId || loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all disabled:opacity-50"
        >
          {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
          Ver datos
        </button>
      </div>

      {selectedTenant && tenantData && (
        <div className="space-y-3">
          <div className="px-3 py-2 rounded-xl bg-amber-500/5 border border-amber-500/10">
            <p className="text-[11px] text-amber-400 font-semibold">Viendo como: {selectedTenant.name} ({selectedTenant.email})</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Ordenes", value: tenantData.orders.length, color: "text-blue-400" },
              { label: "Clientes", value: tenantData.customers.length, color: "text-cyan-400" },
              { label: "Empleados", value: tenantData.employees.length, color: "text-purple-400" },
              { label: "Ventas", value: tenantData.sales.length, color: "text-green-400" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-center">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-gray-600">{s.label}</p>
              </div>
            ))}
          </div>
          {/* Recent orders */}
          {tenantData.orders.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[11px] font-bold text-gray-400 mb-2">Ultimas Ordenes</p>
              {tenantData.orders.map(o => (
                <div key={o.id} className="flex items-center justify-between py-1.5 text-[11px]">
                  <span className="text-white font-mono">{o.order_number || o.id?.slice(0, 8)}</span>
                  <span className="text-gray-500">{o.status}</span>
                  <span className="text-gray-600">{o.created_date ? new Date(o.created_date).toLocaleDateString("es") : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Admin Activity Log ───────────────────────────────────────────────────────
function AdminActivityLog() {
  const [log, setLog] = useState(() => {
    return JSON.parse(localStorage.getItem("gacc_admin_log") || "[]");
  });

  // Auto-refresh
  useEffect(() => {
    const iv = setInterval(() => {
      setLog(JSON.parse(localStorage.getItem("gacc_admin_log") || "[]"));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <p className="text-[13px] font-bold text-white">Admin Activity Log</p>
        </div>
        <button
          onClick={() => { localStorage.setItem("gacc_admin_log", "[]"); setLog([]); toast.success("Log limpiado"); }}
          className="text-[10px] text-gray-600 hover:text-white transition-all"
        >
          Limpiar
        </button>
      </div>

      {log.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-[11px] text-gray-600">Sin actividad registrada en esta sesion</p>
          <p className="text-[10px] text-gray-700 mt-1">Las acciones de admin se registraran automaticamente</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-[400px] overflow-y-auto">
          {log.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.02] transition-colors">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                entry.type === "danger" ? "bg-red-500" : entry.type === "warning" ? "bg-amber-400" : "bg-blue-400"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white">{entry.action}</p>
                {entry.target && <p className="text-[10px] text-gray-600">{entry.target}</p>}
              </div>
              <span className="text-[10px] text-gray-600 flex-shrink-0">
                {entry.time ? new Date(entry.time).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Backup / Clone / GDPR Tool ───────────────────────────────────────────────
function BackupTool() {
  const { tenants, adminSupabase } = useGACC();
  const [selectedId, setSelectedId] = useState("");
  const [working, setWorking] = useState(false);

  const selected = tenants.find(t => t.id === selectedId);

  const exportTenantData = async (tenant) => {
    setWorking(true);
    try {
      const tables = ["app_employee", "customer", "product", "order", "sale", "transaction", "cash_register", "subscription", "notification", "inventory_movement"];
      const data = { tenant, exported_at: new Date().toISOString() };

      for (const table of tables) {
        try {
          const { data: rows } = await adminSupabase.from(table).select("*").eq("tenant_id", tenant.id);
          data[table] = rows || [];
        } catch { data[table] = []; }
      }

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${tenant.slug || tenant.id}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Backup de ${tenant.name} descargado`);
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setWorking(false);
    }
  };

  const cloneTenant = async (tenant) => {
    if (!confirm(`Clonar "${tenant.name}" como nueva tienda de demo?`)) return;
    setWorking(true);
    try {
      const cloneName = `${tenant.name} (Clone)`;
      const cloneEmail = `clone-${Date.now()}@demo.smartfixos.com`;

      const { data: newTenant, error } = await adminSupabase.from("tenant").insert({
        name: cloneName,
        email: cloneEmail,
        slug: `${tenant.slug || "clone"}-${Date.now()}`,
        plan: tenant.plan,
        status: "active",
        country: tenant.country,
        currency: tenant.currency,
        timezone: tenant.timezone,
        metadata: { ...tenant.metadata, cloned_from: tenant.id, is_clone: true },
        monthly_cost: tenant.monthly_cost,
      }).select().single();

      if (error) throw error;
      toast.success(`Clon creado: ${cloneName}`);
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setWorking(false);
    }
  };

  const gdprDelete = async (tenant) => {
    if (!confirm(`GDPR DELETE: Eliminar TODOS los datos personales de "${tenant.name}"? Esta accion cumple con GDPR/CCPA y es irreversible.`)) return;
    if (!confirm(`ULTIMA CONFIRMACION: Escribir el nombre exacto para confirmar no esta disponible aqui. Escribe "SI" en el siguiente prompt.`)) return;
    const answer = prompt(`Escribe "ELIMINAR ${tenant.name}" para confirmar:`);
    if (answer !== `ELIMINAR ${tenant.name}`) { toast.error("Cancelado"); return; }

    setWorking(true);
    try {
      // Delete all tenant-related PII
      const tables = ["customer", "app_employee", "users", "tenant_membership", "subscription", "audit_log"];
      for (const table of tables) {
        try { await adminSupabase.from(table).delete().eq("tenant_id", tenant.id); } catch {}
      }
      // Delete tenant itself
      await adminSupabase.from("tenant").delete().eq("id", tenant.id);
      toast.success(`GDPR delete completado para ${tenant.name}`);
      setSelectedId("");
    } catch (e) {
      toast.error("Error: " + e.message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Database className="w-4 h-4 text-emerald-400" />
        <p className="text-[13px] font-bold text-white">Backup / Clone / GDPR</p>
      </div>

      <select
        value={selectedId}
        onChange={e => setSelectedId(e.target.value)}
        className="w-full px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-[12px] text-white outline-none cursor-pointer"
      >
        <option value="">Seleccionar tienda...</option>
        {tenants.map(t => <option key={t.id} value={t.id}>{t.name} ({t.email})</option>)}
      </select>

      {selected && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button onClick={() => exportTenantData(selected)} disabled={working} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] hover:bg-emerald-500/10 transition-all disabled:opacity-50">
              <Download className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <p className="text-[12px] text-white font-semibold">Backup JSON</p>
                <p className="text-[9px] text-gray-600">Exportar todos los datos</p>
              </div>
            </button>
            <button onClick={() => cloneTenant(selected)} disabled={working} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-blue-500/20 bg-blue-500/[0.03] hover:bg-blue-500/10 transition-all disabled:opacity-50">
              <Building2 className="w-4 h-4 text-blue-400" />
              <div className="text-left">
                <p className="text-[12px] text-white font-semibold">Clone Tenant</p>
                <p className="text-[9px] text-gray-600">Duplicar para demo</p>
              </div>
            </button>
            <button onClick={() => gdprDelete(selected)} disabled={working} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.03] hover:bg-red-500/10 transition-all disabled:opacity-50">
              <Trash2 className="w-4 h-4 text-red-400" />
              <div className="text-left">
                <p className="text-[12px] text-white font-semibold">GDPR Delete</p>
                <p className="text-[9px] text-gray-600">Borrar PII</p>
              </div>
            </button>
          </div>
          {working && <p className="text-[11px] text-gray-600 text-center">Procesando...</p>}
        </div>
      )}
    </div>
  );
}

// ── Main Tools View ──────────────────────────────────────────────────────────
export default function ToolsView() {
  const [tab, setTab] = useState("explorer");

  const tabs = [
    { key: "explorer", label: "Data Explorer", icon: Database },
    { key: "storage", label: "Storage", icon: HardDrive },
    { key: "flags", label: "Feature Flags", icon: Settings },
    { key: "impersonate", label: "Impersonation", icon: Eye },
    { key: "backup", label: "Backup/Clone", icon: Database },
    { key: "bulk", label: "Bulk Actions", icon: Zap },
    { key: "diagnostics", label: "Diagnostics", icon: AlertTriangle },
    { key: "adminlog", label: "Admin Log", icon: Activity },
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
      {tab === "impersonate" && <ImpersonationTool />}
      {tab === "backup" && <BackupTool />}
      {tab === "bulk" && <BulkActions />}
      {tab === "diagnostics" && <Diagnostics />}
      {tab === "adminlog" && <AdminActivityLog />}
    </div>
  );
}
