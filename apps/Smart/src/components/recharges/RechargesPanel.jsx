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
    <div className="apple-type space-y-6">

      {/* Stats Cards */}
      <div className="apple-card p-6 relative overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
          <div className="bg-apple-blue/12 rounded-apple-md p-5">
            <div className="flex items-center gap-2 mb-2 apple-label-secondary apple-text-caption1 font-semibold">
              <BarChart3 className="w-4 h-4" />
              Total Recargas
            </div>
            <p className="apple-text-title1 font-bold apple-label-primary tabular-nums">{stats.count}</p>
          </div>

          <div className="bg-apple-yellow/12 rounded-apple-md p-5">
            <div className="flex items-center gap-2 mb-2 apple-label-secondary apple-text-caption1 font-semibold">
              <DollarSign className="w-4 h-4" />
              Total Vendido
            </div>
            <p className="apple-text-title1 font-bold apple-label-primary tabular-nums">{money(stats.total)}</p>
          </div>

          <div className="bg-apple-green/12 rounded-apple-md p-5">
            <div className="flex items-center gap-2 mb-2 text-apple-green apple-text-caption1 font-semibold">
              <TrendingUp className="w-4 h-4" />
              Ganancia
            </div>
            <p className="apple-text-title1 font-bold text-apple-green tabular-nums">{money(stats.commission)}</p>
          </div>

          <div className="bg-apple-red/12 rounded-apple-md p-5">
            <div className="flex items-center gap-2 mb-2 text-apple-red apple-text-caption1 font-semibold">
              <XCircle className="w-4 h-4" />
              Reembolsos
            </div>
            <p className="apple-text-title1 font-bold apple-label-primary tabular-nums">{stats.refunded}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="apple-card p-2 flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 apple-label-tertiary" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="apple-input w-full pl-12 h-12"
            />
          </div>

          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="apple-input h-12 px-4 cursor-pointer"
          >
            <option value="all">Todas las fechas</option>
            <option value="today">Hoy</option>
            <option value="week">Esta semana</option>
            <option value="month">Este mes</option>
          </select>

          <select
            value={filterCarrier}
            onChange={(e) => setFilterCarrier(e.target.value)}
            className="apple-input h-12 px-4 cursor-pointer"
          >
            <option value="all">Todas las compañías</option>
            {carriers.map(carrier => (
              <option key={carrier} value={carrier}>{carrier}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="apple-input h-12 px-4 cursor-pointer"
          >
            <option value="all">Todos los estados</option>
            <option value="completed">Completadas</option>
            <option value="failed">Fallidas</option>
            <option value="refunded">Reembolsadas</option>
          </select>

          <div className="flex gap-2 ml-auto">
            <Button onClick={loadRecharges} variant="ghost" size="icon" aria-label="Recargar lista" className="apple-press apple-btn apple-btn-plain h-12 w-12 rounded-apple-sm apple-label-secondary">
              <RefreshCw className="w-5 h-5" />
            </Button>
            <Button onClick={exportToCSV} variant="ghost" size="icon" aria-label="Exportar a CSV" className="apple-press apple-btn apple-btn-plain h-12 w-12 rounded-apple-sm apple-label-secondary">
              <Download className="w-5 h-5" />
            </Button>
        </div>
      </div>

      {/* Lista de recargas */}
      {loading ? (
        <div className="text-center py-20">
          <div className="animate-spin w-10 h-10 border-4 border-apple-yellow border-t-transparent rounded-full mx-auto" />
        </div>
      ) : filteredRecharges.length === 0 ? (
        <div className="apple-card p-20 text-center">
          <Zap className="w-20 h-20 apple-label-tertiary mx-auto mb-6" />
          <h3 className="apple-text-title3 apple-label-primary mb-2">No hay recargas</h3>
          <p className="apple-label-secondary apple-text-subheadline">No se encontraron transacciones con los filtros actuales.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecharges.map(recharge => {
              const statusConfig = {
                completed: { tint: "green", icon: CheckCircle2, label: "Exitosa" },
                failed: { tint: "red", icon: XCircle, label: "Fallida" },
                refunded: { tint: "orange", icon: RefreshCw, label: "Reembolsada" }
              }[recharge.status] || { tint: "green", icon: CheckCircle2, label: "Exitosa" };

              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={recharge.id}
                  className="apple-list-row apple-card p-5 transition-all group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary border-0 font-medium">
                          {recharge.carrier === "Otra" ? recharge.carrier_custom : recharge.carrier}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="apple-label-primary font-bold apple-text-title3 font-mono tabular-nums">
                          {recharge.phone_number}
                        </p>
                      </div>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-apple-${statusConfig.tint}/15 text-apple-${statusConfig.tint}`}>
                      <StatusIcon className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-3 mb-5">
                    <div className="flex items-center justify-between apple-text-subheadline">
                      <div className="flex items-center gap-2 apple-label-secondary">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(recharge.created_date), "d MMM, HH:mm", { locale: es })}</span>
                      </div>
                    </div>

                    {recharge.customer_name && (
                      <div className="flex items-center gap-2 apple-text-subheadline apple-label-secondary">
                        <User className="w-4 h-4 text-apple-blue" />
                        <span className="font-medium">{recharge.customer_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Monto y comisión */}
                  <div className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm p-4 flex items-center justify-between">
                    <div>
                      <span className="apple-label-tertiary apple-text-caption2 font-semibold block mb-1">Monto</span>
                      <p className="apple-text-title3 font-bold apple-label-primary tabular-nums">
                        {money(recharge.amount)}
                      </p>
                    </div>
                    {recharge.commission > 0 && (
                      <div className="text-right">
                        <span className="apple-label-tertiary apple-text-caption2 font-semibold block mb-1">Comisión</span>
                        <p className="text-apple-green font-bold tabular-nums">
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
                      className="apple-btn apple-btn-plain w-full mt-4 apple-label-tertiary h-9 apple-text-caption1 font-medium"
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
