import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Star,
  Clock,
  CheckCircle,
  Target,
  Calendar,
  Award,
  MessageSquare
} from "lucide-react";
import { format, differenceInHours, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";

export default function TechnicianPerformanceDialog({ open, onClose, technician }) {
  const [orders, setOrders] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("month"); // month, quarter, year

  useEffect(() => {
    if (open && technician) {
      loadPerformanceData();
    }
  }, [open, technician, timeRange]);

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      // Cargar todas las órdenes del técnico
      const allOrders = await base44.entities.Order.filter(
        { assigned_to: technician.user_id },
        "-created_date",
        1000
      );

      // Filtrar por rango de tiempo
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case "month":
          startDate = startOfMonth(now);
          break;
        case "quarter":
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case "year":
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = startOfMonth(now);
      }

      const filteredOrders = allOrders.filter(o => 
        new Date(o.created_date) >= startDate
      );

      // Calcular métricas
      const completed = filteredOrders.filter(o => 
        ["completed", "picked_up"].includes(o.status)
      );

      const inProgress = filteredOrders.filter(o => 
        ["intake", "diagnosing", "in_progress", "awaiting_approval"].includes(o.status)
      );

      // Tiempo promedio de completación
      let avgCompletionHours = 0;
      if (completed.length > 0) {
        const totalHours = completed.reduce((sum, order) => {
          try {
            const start = new Date(order.created_date);
            const end = new Date(order.updated_date);
            return sum + differenceInHours(end, start);
          } catch {
            return sum;
          }
        }, 0);
        avgCompletionHours = totalHours / completed.length;
      }

      // Calcular ratings promedio
      let avgRating = 0;
      let totalRatings = 0;
      
      // En un sistema real, aquí cargarías los ratings de una entidad CustomerRating
      // Por ahora usamos datos del perfil
      if (technician.performance_metrics?.avg_customer_rating) {
        avgRating = technician.performance_metrics.avg_customer_rating;
        totalRatings = technician.performance_metrics.total_ratings || 0;
      }

      // Tasa de éxito
      const successRate = filteredOrders.length > 0
        ? (completed.length / filteredOrders.length) * 100
        : 0;

      // Órdenes a tiempo (completadas antes de la fecha estimada)
      const onTimeOrders = completed.filter(o => {
        if (!o.estimated_completion) return true;
        try {
          const estimated = new Date(o.estimated_completion);
          const actual = new Date(o.updated_date);
          return actual <= estimated;
        } catch {
          return true;
        }
      });

      const onTimeRate = completed.length > 0
        ? (onTimeOrders.length / completed.length) * 100
        : 0;

      // Ingresos generados
      const revenue = completed.reduce((sum, o) => sum + (o.amount_paid || 0), 0);

      setMetrics({
        totalOrders: filteredOrders.length,
        completed: completed.length,
        inProgress: inProgress.length,
        avgCompletionHours,
        avgRating,
        totalRatings,
        successRate,
        onTimeRate,
        revenue
      });

      setOrders(filteredOrders.slice(0, 10)); // Últimas 10 órdenes
      setLoading(false);
    } catch (error) {
      console.error("Error loading performance data:", error);
      setLoading(false);
    }
  };

  const getPerformanceColor = (value, type) => {
    if (type === "rate") {
      if (value >= 90) return "text-green-400";
      if (value >= 70) return "text-yellow-400";
      return "text-red-400";
    }
    if (type === "rating") {
      if (value >= 4.5) return "text-green-400";
      if (value >= 3.5) return "text-yellow-400";
      return "text-red-400";
    }
    return "text-white";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl text-white flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-red-600" />
              Desempeño de {technician.full_name}
            </DialogTitle>
            <div className="flex gap-2">
              {["month", "quarter", "year"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    timeRange === range
                      ? "bg-red-600 text-white"
                      : "bg-black/40 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {range === "month" && "Mes"}
                  {range === "quarter" && "Trimestre"}
                  {range === "year" && "Año"}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex items-center justify-center">
            <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPIs Principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Total Órdenes</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {metrics?.totalOrders || 0}
                      </p>
                    </div>
                    <Calendar className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Completadas</p>
                      <p className="text-2xl font-bold text-green-400 mt-1">
                        {metrics?.completed || 0}
                      </p>
                    </div>
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Rating Promedio</p>
                      <p className={`text-2xl font-bold mt-1 flex items-center gap-1 ${getPerformanceColor(metrics?.avgRating, "rating")}`}>
                        {(metrics?.avgRating || 0).toFixed(1)}
                        <Star className="w-5 h-5 fill-current" />
                      </p>
                      <p className="text-xs text-gray-500">
                        {metrics?.totalRatings || 0} valoraciones
                      </p>
                    </div>
                    <Award className="w-8 h-8 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Tasa de Éxito</p>
                      <p className={`text-2xl font-bold mt-1 ${getPerformanceColor(metrics?.successRate, "rate")}`}>
                        {(metrics?.successRate || 0).toFixed(0)}%
                      </p>
                    </div>
                    <Target className="w-8 h-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Métricas Detalladas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="w-5 h-5 text-blue-400" />
                    <p className="font-semibold text-white">Tiempo Promedio</p>
                  </div>
                  <p className="text-3xl font-bold text-white">
                    {(metrics?.avgCompletionHours || 0).toFixed(1)} hrs
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Por reparación</p>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <p className="font-semibold text-white">Entregas a Tiempo</p>
                  </div>
                  <p className={`text-3xl font-bold ${getPerformanceColor(metrics?.onTimeRate, "rate")}`}>
                    {(metrics?.onTimeRate || 0).toFixed(0)}%
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {Math.round((metrics?.completed || 0) * ((metrics?.onTimeRate || 0) / 100))} de {metrics?.completed || 0}
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <p className="font-semibold text-white">Ingresos Generados</p>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">
                    ${(metrics?.revenue || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">En el período</p>
                </CardContent>
              </Card>
            </div>

            {/* Estado Actual */}
            <Card className="bg-black/40 border-white/10">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-red-600" />
                  Estado Actual
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 bg-blue-600/10 rounded-lg border border-blue-600/30">
                    <p className="text-xs text-blue-300 mb-1">En Progreso</p>
                    <p className="text-2xl font-bold text-blue-400">
                      {metrics?.inProgress || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-600/10 rounded-lg border border-purple-600/30">
                    <p className="text-xs text-purple-300 mb-1">Capacidad</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {metrics?.inProgress || 0}/{technician.availability?.max_capacity || 5}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-600/10 rounded-lg border border-yellow-600/30">
                    <p className="text-xs text-yellow-300 mb-1">Especialidades</p>
                    <p className="text-2xl font-bold text-yellow-400">
                      {technician.specializations?.length || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-emerald-600/10 rounded-lg border border-emerald-600/30">
                    <p className="text-xs text-emerald-300 mb-1">Certificaciones</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {technician.certifications?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Órdenes Recientes */}
            <Card className="bg-black/40 border-white/10">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-red-600" />
                  Órdenes Recientes
                </h3>
                <div className="space-y-2">
                  {orders.length > 0 ? (
                    orders.map((order) => (
                      <div
                        key={order.id}
                        className="p-3 bg-black/40 rounded-lg border border-white/10 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-white font-medium">{order.order_number}</p>
                          <p className="text-xs text-gray-400">
                            {order.customer_name} • {order.device_brand} {order.device_model}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-blue-600/20 text-blue-300 border-blue-600/30">
                            {order.status}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {format(new Date(order.created_date), "dd MMM", { locale: es })}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-400 py-4">
                      No hay órdenes en este período
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
