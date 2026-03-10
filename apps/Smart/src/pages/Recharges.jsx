import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Zap, Search, TrendingUp, DollarSign, Smartphone,
  Calendar, User, FileText, Filter, Download,
  RefreshCw, XCircle, CheckCircle2, BarChart3
} from "lucide-react";
import RechargeDialog from "../components/pos/RechargeDialog";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function Recharges() {
  const [recharges, setRecharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCarrier, setFilterCarrier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showRechargeDialog, setShowRechargeDialog] = useState(false);
  const [dateRange, setDateRange] = useState("today");

  useEffect(() => {
    loadRecharges();
  }, []);

  const loadRecharges = async () => {
    setLoading(true);
    try {
      const data = await dataClient.entities.Recharge.list("-created_date", 500);
      setRecharges(data || []);
    } catch (error) {
      console.error("Error loading recharges:", error);
      toast.error("Error al cargar recargas");
    } finally {
      setLoading(false);
    }
  };

  const handleRechargeComplete = async () => {
    // Recarga completada desde el POS, recargar lista
    await loadRecharges();
  };

  const handleRefund = async (recharge) => {
    if (!confirm(`¿Reembolsar recarga ${recharge.recharge_number}?\n\nMonto: ${money(recharge.amount)}`)) return;

    try {
      await dataClient.entities.Recharge.update(recharge.id, {
        status: "refunded",
        refunded_at: new Date().toISOString(),
        refund_reason: "Reembolso solicitado"
      });
      toast.success("✅ Recarga reembolsada");
      await loadRecharges();
    } catch (error) {
      console.error("Error refunding recharge:", error);
      toast.error("Error al reembolsar");
    }
  };

  // Filtros
  const filteredRecharges = recharges.filter(r => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || 
      r.phone_number?.toLowerCase().includes(search) ||
      r.customer_name?.toLowerCase().includes(search) ||
      r.recharge_number?.toLowerCase().includes(search);
    
    const matchesCarrier = filterCarrier === "all" || r.carrier === filterCarrier;
    const matchesStatus = filterStatus === "all" || r.status === filterStatus;

    let matchesDate = true;
    if (dateRange !== "all") {
      const rechargeDate = new Date(r.created_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateRange === "today") {
        matchesDate = rechargeDate >= today;
      } else if (dateRange === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        matchesDate = rechargeDate >= weekAgo;
      } else if (dateRange === "month") {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        matchesDate = rechargeDate >= monthAgo;
      }
    }

    return matchesSearch && matchesCarrier && matchesStatus && matchesDate;
  });

  // Estadísticas
  const stats = {
    total: filteredRecharges.reduce((sum, r) => sum + (r.status === "completed" ? r.amount : 0), 0),
    count: filteredRecharges.filter(r => r.status === "completed").length,
    commission: filteredRecharges.reduce((sum, r) => sum + (r.status === "completed" ? (r.commission || 0) : 0), 0),
    refunded: filteredRecharges.filter(r => r.status === "refunded").length
  };

  const carriers = [...new Set(recharges.map(r => r.carrier))].filter(Boolean);

  const exportToCSV = () => {
    const headers = ["Fecha", "Número", "Compañía", "Monto", "Comisión", "Cliente", "Método de Pago", "Estado", "Empleado"];
    const rows = filteredRecharges.map(r => [
      format(new Date(r.created_date), "dd/MM/yyyy HH:mm"),
      r.phone_number,
      r.carrier === "Otra" ? r.carrier_custom : r.carrier,
      r.amount,
      r.commission || 0,
      r.customer_name || "N/A",
      r.payment_method,
      r.status,
      r.employee_name || ""
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recargas_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("📥 Exportado a CSV");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] theme-light:bg-gray-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header con estadísticas */}
        <div className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 mb-6 shadow-[0_8px_32px_rgba(0,168,232,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3 theme-light:text-gray-900">
                <Zap className="w-8 h-8 text-cyan-500" />
                Recargas
              </h1>
              <p className="text-gray-400 text-sm mt-2 theme-light:text-gray-600">
                Gestión de recargas prepagadas
              </p>
            </div>
            <Button
              onClick={() => setShowRechargeDialog(true)}
              className="bg-gradient-to-r from-cyan-600 to-emerald-700 h-12 shadow-[0_4px_20px_rgba(0,168,232,0.4)]"
            >
              <Zap className="w-5 h-5 mr-2" />
              Nueva Recarga
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-black/30 border border-cyan-500/20 rounded-xl p-4 theme-light:bg-white">
              <div className="flex items-center justify-between mb-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-600/30 theme-light:bg-cyan-100 theme-light:text-cyan-700">
                  Total
                </Badge>
              </div>
              <p className="text-2xl font-bold text-white theme-light:text-gray-900">{stats.count}</p>
              <p className="text-xs text-gray-400 theme-light:text-gray-600">Recargas</p>
            </div>

            <div className="bg-black/30 border border-emerald-500/20 rounded-xl p-4 theme-light:bg-white">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-600/30 theme-light:bg-emerald-100 theme-light:text-emerald-700">
                  Ventas
                </Badge>
              </div>
              <p className="text-2xl font-bold text-white theme-light:text-gray-900">{money(stats.total)}</p>
              <p className="text-xs text-gray-400 theme-light:text-gray-600">Total vendido</p>
            </div>

            <div className="bg-black/30 border border-green-500/20 rounded-xl p-4 theme-light:bg-white">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <Badge className="bg-green-600/20 text-green-300 border-green-600/30 theme-light:bg-green-100 theme-light:text-green-700">
                  Comisión
                </Badge>
              </div>
              <p className="text-2xl font-bold text-white theme-light:text-gray-900">{money(stats.commission)}</p>
              <p className="text-xs text-gray-400 theme-light:text-gray-600">Ganancia</p>
            </div>

            <div className="bg-black/30 border border-red-500/20 rounded-xl p-4 theme-light:bg-white">
              <div className="flex items-center justify-between mb-2">
                <XCircle className="w-5 h-5 text-red-400" />
                <Badge className="bg-red-600/20 text-red-300 border-red-600/30 theme-light:bg-red-100 theme-light:text-red-700">
                  Reembolsos
                </Badge>
              </div>
              <p className="text-2xl font-bold text-white theme-light:text-gray-900">{stats.refunded}</p>
              <p className="text-xs text-gray-400 theme-light:text-gray-600">Canceladas</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-black/40 border border-cyan-500/20 rounded-2xl p-4 mb-6 theme-light:bg-white theme-light:border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número, cliente..."
                className="pl-10 bg-black/30 border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300"
              />
            </div>

            {/* Fecha */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="h-10 px-3 rounded-lg bg-black/30 border border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
            >
              <option value="all">Todas las fechas</option>
              <option value="today">Hoy</option>
              <option value="week">Última semana</option>
              <option value="month">Último mes</option>
            </select>

            {/* Compañía */}
            <select
              value={filterCarrier}
              onChange={(e) => setFilterCarrier(e.target.value)}
              className="h-10 px-3 rounded-lg bg-black/30 border border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
            >
              <option value="all">Todas las compañías</option>
              {carriers.map(carrier => (
                <option key={carrier} value={carrier}>{carrier}</option>
              ))}
            </select>

            {/* Estado */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-3 rounded-lg bg-black/30 border border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
            >
              <option value="all">Todos los estados</option>
              <option value="completed">Completadas</option>
              <option value="failed">Fallidas</option>
              <option value="refunded">Reembolsadas</option>
            </select>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              onClick={loadRecharges}
              variant="outline"
              size="sm"
              className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/10 theme-light:border-cyan-300"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            <Button
              onClick={exportToCSV}
              variant="outline"
              size="sm"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/10 theme-light:border-emerald-300"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Lista de recargas */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-black/40 border border-cyan-500/10 rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-32 mb-3" />
                <div className="h-4 bg-gray-800 rounded w-full mb-2" />
                <div className="h-4 bg-gray-800 rounded w-24" />
              </div>
            ))}
          </div>
        ) : filteredRecharges.length === 0 ? (
          <div className="bg-black/40 border border-cyan-500/20 rounded-2xl p-12 text-center theme-light:bg-white">
            <Zap className="w-20 h-20 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg theme-light:text-gray-600">
              {searchTerm ? "No se encontraron recargas" : "No hay recargas registradas"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecharges.map(recharge => {
              const statusConfig = {
                completed: { color: "bg-emerald-600/20 text-emerald-300 border-emerald-600/30", icon: CheckCircle2, label: "Completada" },
                failed: { color: "bg-red-600/20 text-red-300 border-red-600/30", icon: XCircle, label: "Fallida" },
                refunded: { color: "bg-orange-600/20 text-orange-300 border-orange-600/30", icon: RefreshCw, label: "Reembolsada" }
              }[recharge.status] || statusConfig.completed;

              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={recharge.id}
                  className="bg-black/40 border border-cyan-500/20 rounded-2xl p-6 hover:shadow-[0_8px_32px_rgba(0,168,232,0.3)] transition-all theme-light:bg-white theme-light:border-gray-200"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1 theme-light:text-gray-600">#{recharge.recharge_number}</p>
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-cyan-400" />
                        <p className="text-white font-bold text-lg font-mono theme-light:text-gray-900">
                          {recharge.phone_number}
                        </p>
                      </div>
                    </div>
                    <Badge className={statusConfig.color}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {/* Compañía */}
                  <div className="mb-4">
                    <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
                      {recharge.carrier === "Otra" ? recharge.carrier_custom : recharge.carrier}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 text-sm mb-4">
                    {recharge.customer_name && (
                      <div className="flex items-center gap-2 text-gray-300 theme-light:text-gray-700">
                        <User className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <span>{recharge.customer_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-300 theme-light:text-gray-700">
                      <Calendar className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <span>{format(new Date(recharge.created_date), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400 text-xs theme-light:text-gray-600">
                      <FileText className="w-3 h-3 flex-shrink-0" />
                      <span>{recharge.employee_name || "—"}</span>
                    </div>
                  </div>

                  {/* Monto y comisión */}
                  <div className="border-t border-white/5 pt-4 theme-light:border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm theme-light:text-gray-600">Monto</span>
                      <span className="text-2xl font-bold text-emerald-400 theme-light:text-emerald-700">
                        {money(recharge.amount)}
                      </span>
                    </div>
                    {recharge.commission > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-xs theme-light:text-gray-600">Comisión</span>
                        <span className="text-green-400 text-sm font-bold theme-light:text-green-700">
                          +{money(recharge.commission)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  {recharge.status === "completed" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRefund(recharge)}
                      className="w-full mt-4 border-red-500/30 text-red-400 hover:bg-red-600/10"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Reembolsar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diálogo de nueva recarga - Redirige al POS */}
      {showRechargeDialog && (
        <RechargeDialog
          open={showRechargeDialog}
          onClose={() => setShowRechargeDialog(false)}
          onRechargeComplete={() => {
            setShowRechargeDialog(false);
            handleRechargeComplete();
          }}
        />
      )}
    </div>
  );
}
