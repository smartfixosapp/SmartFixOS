import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { generateRechargeNumber } from "@/components/utils/sequenceHelpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Zap, Search, TrendingUp, DollarSign, Smartphone,
  Calendar, User, FileText, Download,
  RefreshCw, XCircle, CheckCircle2, BarChart3, X, Plus
} from "lucide-react";
import RechargeDialog from "../pos/RechargeDialog";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function RechargesPanel() {
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
    <div className="space-y-6">

      {/* Stats Cards */}
      <div className="bg-[#1c1c1e] border border-white/10 rounded-[24px] p-6 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-yellow-500/5 pointer-events-none" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          <div className="bg-black/20 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs uppercase font-bold tracking-wider">
              <BarChart3 className="w-4 h-4" />
              Total Recargas
            </div>
            <p className="text-3xl font-bold text-white">{stats.count}</p>
          </div>

          <div className="bg-black/20 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-gray-400 text-xs uppercase font-bold tracking-wider">
              <DollarSign className="w-4 h-4" />
              Total Vendido
            </div>
            <p className="text-3xl font-bold text-white">{money(stats.total)}</p>
          </div>

          <div className="bg-black/20 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-green-400 text-xs uppercase font-bold tracking-wider">
              <TrendingUp className="w-4 h-4" />
              Ganancia
            </div>
            <p className="text-3xl font-bold text-green-400">{money(stats.commission)}</p>
          </div>

          <div className="bg-black/20 border border-white/5 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2 text-red-400 text-xs uppercase font-bold tracking-wider">
              <XCircle className="w-4 h-4" />
              Reembolsos
            </div>
            <p className="text-3xl font-bold text-white">{stats.refunded}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-[#1c1c1e] border border-white/10 rounded-[24px] p-2 flex flex-wrap gap-2 shadow-lg">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-12 bg-black/20 border-transparent text-white rounded-xl h-12 focus:outline-none focus:bg-black/40 transition-colors"
            />
          </div>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="h-12 px-4 rounded-xl bg-white/5 border-transparent text-white focus:bg-white/10 outline-none cursor-pointer"
          >
            <option value="all">Todas las fechas</option>
            <option value="today">Hoy</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
          </select>

          <select
            value={filterCarrier}
            onChange={(e) => setFilterCarrier(e.target.value)}
            className="h-12 px-4 rounded-xl bg-white/5 border-transparent text-white focus:bg-white/10 outline-none cursor-pointer"
          >
            <option value="all">Todas las compañías</option>
            {carriers.map(carrier => (
              <option key={carrier} value={carrier}>{carrier}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-12 px-4 rounded-xl bg-white/5 border-transparent text-white focus:bg-white/10 outline-none cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="completed">Completadas</option>
            <option value="failed">Fallidas</option>
            <option value="refunded">Reembolsadas</option>
          </select>

          <div className="flex gap-2 ml-auto">
            <Button onClick={loadRecharges} variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-gray-400 hover:text-white hover:bg-white/10">
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button onClick={exportToCSV} variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-gray-400 hover:text-white hover:bg-white/10">
              <Download className="w-5 h-5" />
            </Button>
        </div>
      </div>

      {/* Lista de recargas */}
      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full mx-auto" />
        </div>
      ) : filteredRecharges.length === 0 ? (
        <div className="bg-[#1c1c1e] border border-white/10 rounded-[32px] p-20 text-center">
          <Zap className="w-20 h-20 text-white/40 mx-auto mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">No hay recargas</h3>
          <p className="text-gray-500">No se encontraron transacciones con los filtros actuales.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecharges.map(recharge => {
              const statusConfig = {
                completed: { color: "bg-green-500/20 text-green-400 border-green-500/30", icon: CheckCircle2, label: "Exitosa" },
                failed: { color: "bg-red-500/20 text-red-400 border-red-500/30", icon: XCircle, label: "Fallida" },
                refunded: { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: RefreshCw, label: "Reembolsada" }
              }[recharge.status] || statusConfig.completed;

              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={recharge.id}
                  className="bg-[#1c1c1e] hover:bg-[#2c2c2e] border border-white/5 rounded-2xl p-5 transition-all group shadow-md"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-white/10 text-white/80 border-0 hover:bg-white/20 font-medium">
                          {recharge.carrier === "Otra" ? recharge.carrier_custom : recharge.carrier}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-bold text-xl font-mono tracking-wide">
                          {recharge.phone_number}
                        </p>
                      </div>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${statusConfig.color} border-0`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-3 mb-5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(recharge.created_date), "d MMM, HH:mm", { locale: es })}</span>
                      </div>
                    </div>
                    
                    {recharge.customer_name && (
                      <div className="flex items-center gap-2 text-sm text-gray-300">
                        <User className="w-4 h-4 text-blue-400" />
                        <span className="font-medium">{recharge.customer_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Monto y comisión */}
                  <div className="bg-black/30 rounded-xl p-4 flex items-center justify-between border border-white/5">
                    <div>
                      <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Monto</span>
                      <p className="text-xl font-bold text-white">
                        {money(recharge.amount)}
                      </p>
                    </div>
                    {recharge.commission > 0 && (
                      <div className="text-right">
                        <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider block mb-1">Comisión</span>
                        <p className="text-green-400 font-bold">
                          +{money(recharge.commission)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  {recharge.status === "completed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRefund(recharge)}
                      className="w-full mt-4 text-gray-500 hover:text-red-400 hover:bg-red-500/10 h-9 text-xs font-medium"
                    >
                      Reembolsar
                    </Button>
                  )}
                </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
