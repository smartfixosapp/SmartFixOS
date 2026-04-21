/**
 * GACC — Security & Audit
 * Audit log viewer with advanced filters, admin session management
 */
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Lock, Shield, Search, Filter, RefreshCw, Download,
  Eye, AlertTriangle, CheckCircle, Clock, Users, Activity,
  ChevronDown, X, Calendar, Building2
} from "lucide-react";
import { useGACC, timeAgo } from "./gaccContext";

// ── Audit Log Viewer ─────────────────────────────────────────────────────────
function AuditLogViewer() {
  const { adminSupabase, tenants } = useGACC();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Filters
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterSearch, setFilterSearch] = useState("");

  const loadLogs = async () => {
    setLoading(true);
    try {
      let query = adminSupabase
        .from("audit_log")
        .select("*", { count: "exact" })
        .order("created_date", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filterAction) query = query.ilike("action", `%${filterAction}%`);
      if (filterEntity) query = query.eq("entity_type", filterEntity);
      if (filterSeverity) query = query.eq("severity", filterSeverity);

      const { data, count, error } = await query;
      if (error) throw error;

      setLogs(data || []);
      setTotal(count || 0);
    } catch (e) {
      console.error("Error loading audit logs:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); }, [page, filterAction, filterEntity, filterSeverity]);

  const filteredLogs = useMemo(() => {
    if (!filterSearch) return logs;
    const q = filterSearch.toLowerCase();
    return logs.filter(l =>
      (l.action || "").toLowerCase().includes(q) ||
      (l.user_name || "").toLowerCase().includes(q) ||
      (l.entity_type || "").toLowerCase().includes(q) ||
      (l.entity_number || "").toLowerCase().includes(q)
    );
  }, [logs, filterSearch]);

  const severityConfig = {
    info: { color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30", dot: "bg-blue-400" },
    warning: { color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30", dot: "bg-amber-400" },
    error: { color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", dot: "bg-red-500" },
    critical: { color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", dot: "bg-red-500 animate-pulse" },
  };

  const entityTypes = ["order", "sale", "transaction", "cash_register", "product", "customer", "user", "inventory", "config", "file_upload", "email", "notification"];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Buscar en logs..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[13px] text-white placeholder:text-gray-700 focus:outline-none focus:border-purple-500/40 transition-all"
          />
        </div>

        <select
          value={filterEntity}
          onChange={e => { setFilterEntity(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[11px] text-gray-400 outline-none cursor-pointer"
        >
          <option value="">Todas las entidades</option>
          {entityTypes.map(e => <option key={e} value={e}>{e}</option>)}
        </select>

        <select
          value={filterSeverity}
          onChange={e => { setFilterSeverity(e.target.value); setPage(0); }}
          className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[11px] text-gray-400 outline-none cursor-pointer"
        >
          <option value="">Todas las severidades</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="critical">Critical</option>
        </select>

        <input
          value={filterAction}
          onChange={e => { setFilterAction(e.target.value); setPage(0); }}
          placeholder="Filtrar accion..."
          className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[11px] text-white placeholder:text-gray-700 focus:outline-none w-40"
        />

        <button onClick={loadLogs} disabled={loading} className="p-2.5 rounded-xl text-gray-600 hover:text-white border border-white/[0.07] hover:border-white/[0.15] transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-[10px] text-gray-600">
        <span>{total} registros totales</span>
        <span>Pagina {page + 1} de {Math.ceil(total / PAGE_SIZE) || 1}</span>
        <span>{filteredLogs.length} mostrados</span>
      </div>

      {/* Table header */}
      <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 text-[10px] text-gray-600 tracking-wide font-bold border-b border-white/[0.06]">
        <div className="col-span-1">Sev.</div>
        <div className="col-span-2">Accion</div>
        <div className="col-span-2">Entidad</div>
        <div className="col-span-2">Usuario</div>
        <div className="col-span-2">ID/Num</div>
        <div className="col-span-3 text-right">Fecha</div>
      </div>

      {/* Log rows */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] overflow-hidden max-h-[600px] overflow-y-auto">
        {loading && logs.length === 0 ? (
          <div className="flex justify-center py-12"><RefreshCw className="w-5 h-5 animate-spin text-gray-600" /></div>
        ) : filteredLogs.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-12">Sin registros de auditoria</p>
        ) : (
          filteredLogs.map((log, i) => {
            const sev = severityConfig[log.severity] || severityConfig.info;
            return (
              <div key={log.id || i} className={`grid grid-cols-12 gap-2 items-center px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${
                log.severity === "critical" || log.severity === "error" ? "bg-red-500/[0.02]" : ""
              }`}>
                <div className="col-span-1">
                  <span className={`w-2 h-2 rounded-full inline-block ${sev.dot}`} />
                </div>
                <div className="col-span-2">
                  <p className="text-[12px] text-white font-semibold truncate">{log.action || "--"}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.05] text-gray-400 font-mono">
                    {log.entity_type || "--"}
                  </span>
                </div>
                <div className="col-span-2 min-w-0">
                  <p className="text-[11px] text-gray-400 truncate">{log.user_name || "Sistema"}</p>
                  <p className="text-[9px] text-gray-700 truncate">{log.user_role || "--"}</p>
                </div>
                <div className="col-span-2 min-w-0">
                  <p className="text-[10px] text-gray-500 font-mono truncate">{log.entity_number || log.entity_id?.slice(0, 8) || "--"}</p>
                </div>
                <div className="col-span-3 text-right">
                  <p className="text-[11px] text-gray-500">{log.created_date ? timeAgo(log.created_date) : "--"}</p>
                  <p className="text-[9px] text-gray-700">
                    {log.created_date ? new Date(log.created_date).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg text-[11px] text-gray-500 border border-white/[0.07] hover:text-white transition-all disabled:opacity-30"
          >
            Anterior
          </button>
          <span className="text-[11px] text-gray-600">{page + 1} / {Math.ceil(total / PAGE_SIZE)}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={(page + 1) * PAGE_SIZE >= total}
            className="px-3 py-1.5 rounded-lg text-[11px] text-gray-500 border border-white/[0.07] hover:text-white transition-all disabled:opacity-30"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

// ── Admin Sessions ───────────────────────────────────────────────────────────
function AdminSessions() {
  const session = JSON.parse(localStorage.getItem("smartfix_saas_session") || "{}");
  const loginTime = session.loginTime ? new Date(session.loginTime) : null;
  const timeLeft = loginTime ? Math.max(0, 2 * 60 * 60 * 1000 - (Date.now() - loginTime.getTime())) : 0;
  const minsLeft = Math.floor(timeLeft / 60000);

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-4 h-4 text-purple-400" />
        <p className="text-[13px] font-bold text-white">Sesion Actual</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-gray-600">Rol</p>
          <p className="text-[13px] text-white font-bold mt-1">{session.role || "--"}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-gray-600">Login</p>
          <p className="text-[13px] text-white font-bold mt-1">{loginTime ? loginTime.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) : "--"}</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-gray-600">Tiempo restante</p>
          <p className={`text-[13px] font-bold mt-1 ${minsLeft < 15 ? "text-red-400" : "text-white"}`}>{minsLeft} min</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="text-[10px] text-gray-600">Autenticacion</p>
          <p className="text-[13px] text-emerald-400 font-bold mt-1">PIN + Session</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Security View ───────────────────────────────────────────────────────
export default function SecurityView() {
  const [tab, setTab] = useState("audit"); // audit | sessions

  return (
    <div className="app-container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Security & Audit</h2>
          <p className="text-[11px] text-gray-600">Auditoria, accesos y sesiones</p>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.05]">
          <button onClick={() => setTab("audit")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${tab === "audit" ? "bg-white/[0.08] text-white" : "text-gray-600"}`}>
            <Shield className="w-3.5 h-3.5" /> Audit Log
          </button>
          <button onClick={() => setTab("sessions")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${tab === "sessions" ? "bg-white/[0.08] text-white" : "text-gray-600"}`}>
            <Users className="w-3.5 h-3.5" /> Sesiones
          </button>
        </div>
      </div>

      {tab === "audit" && <AuditLogViewer />}
      {tab === "sessions" && <AdminSessions />}
    </div>
  );
}
