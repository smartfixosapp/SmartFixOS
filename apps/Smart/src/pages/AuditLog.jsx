import React, { useState, useEffect, useMemo } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Search, Filter, Calendar, User, AlertTriangle, Info,
  AlertCircle, CheckCircle2, Clock, ChevronDown, X, Download
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SEVERITY_CONFIG = {
  info: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Info, label: "Info" },
  warning: { color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle, label: "Advertencia" },
  error: { color: "text-red-400", bg: "bg-red-500/10", icon: AlertCircle, label: "Error" },
  critical: { color: "text-red-600", bg: "bg-red-600/20", icon: AlertCircle, label: "Crítico" }
};

const ACTION_LABELS = {
  create: "Creación",
  update: "Actualización",
  delete: "Eliminación",
  status_change: "Cambio de Estado",
  payment_deposit: "Depósito",
  payment_full: "Pago Total",
  login: "Acceso",
  logout: "Cierre de Sesión"
};

function AuditEntry({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const severityConfig = SEVERITY_CONFIG[entry.severity] || SEVERITY_CONFIG.info;
  const SeverityIcon = severityConfig.icon;

  const actionLabel = ACTION_LABELS[entry.action] || entry.action;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-lg p-4 cursor-pointer transition-all ${severityConfig.bg} border-opacity-30`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1">
          <SeverityIcon className={`w-5 h-5 ${severityConfig.color} mt-1 flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white">{actionLabel}</h3>
              <Badge variant="outline" className="text-xs">
                {entry.entity_type}
              </Badge>
              {entry.entity_number && (
                <span className="text-cyan-400 font-mono text-sm">{entry.entity_number}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {entry.user_name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(entry.created_date), "d MMM HH:mm:ss", { locale: es })}
              </span>
            </div>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 space-y-3 border-t border-white/10 pt-3"
          >
            {entry.user_role && (
              <div>
                <p className="text-xs text-gray-500 font-semibold mb-1">Rol</p>
                <p className="text-sm text-white">{entry.user_role}</p>
              </div>
            )}

            {entry.changes?.before && (
              <div>
                <p className="text-xs text-amber-400 font-semibold mb-1">Valores Anteriores</p>
                <pre className="text-xs bg-black/40 p-2 rounded overflow-auto max-h-32 text-gray-300">
                  {JSON.stringify(entry.changes.before, null, 2)}
                </pre>
              </div>
            )}

            {entry.changes?.after && (
              <div>
                <p className="text-xs text-emerald-400 font-semibold mb-1">Valores Nuevos</p>
                <pre className="text-xs bg-black/40 p-2 rounded overflow-auto max-h-32 text-gray-300">
                  {JSON.stringify(entry.changes.after, null, 2)}
                </pre>
              </div>
            )}

            {entry.metadata && (
              <div>
                <p className="text-xs text-gray-500 font-semibold mb-1">Metadata</p>
                <div className="text-xs text-gray-400 space-y-1">
                  <p>Timestamp: {entry.metadata.timestamp}</p>
                  {entry.metadata.ip_address && <p>IP: {entry.metadata.ip_address}</p>}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [selectedEntity, setSelectedEntity] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState("all");

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await dataClient.entities.AuditLog.list("-created_date", 500);
      setLogs(data || []);
      console.log("✅ Auditorías cargadas:", data?.length);
    } catch (error) {
      console.error("Error cargando auditorías:", error);
      toast.error("Error al cargar auditorías");
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filtro de búsqueda
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (log) =>
          log.entity_number?.toLowerCase().includes(q) ||
          log.user_name?.toLowerCase().includes(q) ||
          log.action?.toLowerCase().includes(q)
      );
    }

    // Filtro de severidad
    if (selectedSeverity !== "all") {
      result = result.filter((log) => log.severity === selectedSeverity);
    }

    // Filtro de tipo de entidad
    if (selectedEntity !== "all") {
      result = result.filter((log) => log.entity_type === selectedEntity);
    }

    // Filtro de usuario
    if (selectedUser !== "all") {
      result = result.filter((log) => log.user_name === selectedUser);
    }

    // Filtro de fecha
    if (dateFilter !== "all") {
      const now = new Date();
      const logDate = new Date();

      result = result.filter((log) => {
        const entryDate = new Date(log.created_date);
        if (dateFilter === "today") {
          return entryDate.toDateString() === now.toDateString();
        } else if (dateFilter === "week") {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return entryDate >= weekAgo;
        } else if (dateFilter === "month") {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return entryDate >= monthAgo;
        }
        return true;
      });
    }

    return result;
  }, [logs, searchQuery, selectedSeverity, selectedEntity, selectedUser, dateFilter]);

  const uniqueUsers = useMemo(() => [...new Set(logs.map((log) => log.user_name).filter(Boolean))], [logs]);
  const uniqueEntities = useMemo(() => [...new Set(logs.map((log) => log.entity_type).filter(Boolean))], [logs]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">🔍 Auditoría del Sistema</h1>
          <p className="text-gray-400">Registro completo de todas las acciones en el sistema</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="bg-black/40 border-white/10">
            <CardContent className="p-4">
              <p className="text-xs text-gray-400 mb-1">Total de eventos</p>
              <p className="text-2xl font-bold text-cyan-400">{logs.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardContent className="p-4">
              <p className="text-xs text-gray-400 mb-1">Eventos críticos</p>
              <p className="text-2xl font-bold text-red-400">
                {logs.filter((l) => l.severity === "critical").length}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardContent className="p-4">
              <p className="text-xs text-gray-400 mb-1">Usuarios activos</p>
              <p className="text-2xl font-bold text-blue-400">{uniqueUsers.length}</p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-white/10">
            <CardContent className="p-4">
              <p className="text-xs text-gray-400 mb-1">Entidades auditadas</p>
              <p className="text-2xl font-bold text-purple-400">{uniqueEntities.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por #orden, usuario, acción..."
              className="pl-10 h-11 bg-white/5 border-white/10 text-white rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="all">Todas las severidades</option>
              <option value="info">Info</option>
              <option value="warning">Advertencia</option>
              <option value="error">Error</option>
              <option value="critical">Crítico</option>
            </select>

            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="all">Todas las entidades</option>
              {uniqueEntities.map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>

            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="all">Todos los usuarios</option>
              {uniqueUsers.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>

            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-10 px-3 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
            >
              <option value="all">Todo el tiempo</option>
              <option value="today">Hoy</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
            </select>
          </div>
        </div>

        {/* Logs */}
        <div>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <p className="text-gray-400">Cargando auditorías...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3 opacity-50" />
              <p className="text-gray-400">No se encontraron eventos de auditoría</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-y-auto">
              {filteredLogs.map((log) => (
                <AuditEntry key={log.id} entry={log} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 pt-4 border-t border-white/5">
          Mostrando {filteredLogs.length} de {logs.length} eventos
        </div>
      </div>
    </div>
  );
}
