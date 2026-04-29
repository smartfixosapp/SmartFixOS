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
    <div className="min-h-dvh apple-surface apple-type py-3 sm:py-6">
      <div className="app-container">
        {/* Header con estadísticas */}
        <div className="apple-card p-6 mb-6">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="apple-text-title1 apple-label-primary flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-apple-sm bg-apple-blue/15">
                  <Zap className="w-6 h-6 text-apple-blue" />
                </span>
                Recargas
              </h1>
              <p className="apple-text-subheadline apple-label-secondary mt-2">
                Gestión de recargas prepagadas
              </p>
            </div>
            <Button
              onClick={() => setShowRechargeDialog(true)}
              className="apple-btn apple-btn-primary apple-btn-lg"
            >
              <Zap className="w-5 h-5 mr-2" />
              Nueva Recarga
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="apple-surface-elevated rounded-apple-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-blue/15">
                  <BarChart3 className="w-4 h-4 text-apple-blue" />
                </span>
                <span className="apple-text-caption1 apple-label-secondary">Total</span>
              </div>
              <p className="apple-text-title2 apple-label-primary tabular-nums">{stats.count}</p>
              <p className="apple-text-caption1 apple-label-secondary">Recargas</p>
            </div>

            <div className="apple-surface-elevated rounded-apple-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-green/15">
                  <DollarSign className="w-4 h-4 text-apple-green" />
                </span>
                <span className="apple-text-caption1 apple-label-secondary">Ventas</span>
              </div>
              <p className="apple-text-title2 apple-label-primary tabular-nums">{money(stats.total)}</p>
              <p className="apple-text-caption1 apple-label-secondary">Total vendido</p>
            </div>

            <div className="apple-surface-elevated rounded-apple-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-green/15">
                  <TrendingUp className="w-4 h-4 text-apple-green" />
                </span>
                <span className="apple-text-caption1 apple-label-secondary">Comisión</span>
              </div>
              <p className="apple-text-title2 apple-label-primary tabular-nums">{money(stats.commission)}</p>
              <p className="apple-text-caption1 apple-label-secondary">Ganancia</p>
            </div>

            <div className="apple-surface-elevated rounded-apple-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-red/15">
                  <XCircle className="w-4 h-4 text-apple-red" />
                </span>
                <span className="apple-text-caption1 apple-label-secondary">Reembolsos</span>
              </div>
              <p className="apple-text-title2 apple-label-primary tabular-nums">{stats.refunded}</p>
              <p className="apple-text-caption1 apple-label-secondary">Canceladas</p>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="apple-card p-4 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 apple-label-tertiary" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por número, cliente..."
                className="apple-input pl-10"
              />
            </div>

            {/* Fecha */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="apple-input"
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
              className="apple-input"
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
              className="apple-input"
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
              className="apple-btn apple-btn-tinted"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Actualizar
            </Button>
            <Button
              onClick={exportToCSV}
              className="apple-btn apple-btn-tinted"
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
              <div key={i} className="apple-card p-6 animate-pulse">
                <div className="h-6 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm w-32 mb-3" />
                <div className="h-4 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm w-full mb-2" />
                <div className="h-4 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm w-24" />
              </div>
            ))}
          </div>
        ) : filteredRecharges.length === 0 ? (
          <div className="apple-card p-12 text-center">
            <span className="inline-flex items-center justify-center w-20 h-20 rounded-apple-lg bg-apple-blue/12 mx-auto mb-4">
              <Zap className="w-10 h-10 text-apple-blue" />
            </span>
            <p className="apple-text-body apple-label-secondary">
              {searchTerm ? "No se encontraron recargas" : "No hay recargas registradas"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRecharges.map(recharge => {
              const statusConfig = {
                completed: { color: "bg-apple-green/15 text-apple-green", icon: CheckCircle2, label: "Completada" },
                failed: { color: "bg-apple-red/15 text-apple-red", icon: XCircle, label: "Fallida" },
                refunded: { color: "bg-apple-orange/15 text-apple-orange", icon: RefreshCw, label: "Reembolsada" }
              }[recharge.status] || { color: "bg-apple-green/15 text-apple-green", icon: CheckCircle2, label: "Completada" };

              const StatusIcon = statusConfig.icon;

              return (
                <div
                  key={recharge.id}
                  className="apple-card p-6 apple-press transition-all"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="apple-text-caption1 apple-label-tertiary mb-1 tabular-nums">#{recharge.recharge_number}</p>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-apple-sm bg-apple-blue/15">
                          <Smartphone className="w-4 h-4 text-apple-blue" />
                        </span>
                        <p className="apple-text-headline apple-label-primary tabular-nums">
                          {recharge.phone_number}
                        </p>
                      </div>
                    </div>
                    <Badge className={`${statusConfig.color} border-0 rounded-apple-sm`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </div>

                  {/* Compañía */}
                  <div className="mb-4">
                    <Badge className="bg-apple-purple/15 text-apple-purple border-0 rounded-apple-sm">
                      {recharge.carrier === "Otra" ? recharge.carrier_custom : recharge.carrier}
                    </Badge>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 mb-4">
                    {recharge.customer_name && (
                      <div className="flex items-center gap-2 apple-text-subheadline apple-label-secondary">
                        <User className="w-4 h-4 text-apple-blue flex-shrink-0" />
                        <span>{recharge.customer_name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 apple-text-subheadline apple-label-secondary">
                      <Calendar className="w-4 h-4 text-apple-blue flex-shrink-0" />
                      <span className="tabular-nums">{format(new Date(recharge.created_date), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                    </div>
                    <div className="flex items-center gap-2 apple-text-caption1 apple-label-tertiary">
                      <FileText className="w-3 h-3 flex-shrink-0" />
                      <span>{recharge.employee_name || "—"}</span>
                    </div>
                  </div>

                  {/* Monto y comisión */}
                  <div
                    className="pt-4"
                    style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="apple-text-subheadline apple-label-secondary">Monto</span>
                      <span className="apple-text-title2 text-apple-green tabular-nums">
                        {money(recharge.amount)}
                      </span>
                    </div>
                    {recharge.commission > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="apple-text-caption1 apple-label-tertiary">Comisión</span>
                        <span className="apple-text-subheadline text-apple-green tabular-nums">
                          +{money(recharge.commission)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  {recharge.status === "completed" && (
                    <Button
                      onClick={() => handleRefund(recharge)}
                      className="apple-btn apple-btn-destructive w-full mt-4"
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
