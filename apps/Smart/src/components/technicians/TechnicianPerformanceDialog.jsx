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
      if (value >= 90) return "text-apple-green";
      if (value >= 70) return "text-apple-yellow";
      return "text-apple-red";
    }
    if (type === "rating") {
      if (value >= 4.5) return "text-apple-green";
      if (value >= 3.5) return "text-apple-yellow";
      return "text-apple-red";
    }
    return "apple-label-primary";
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-type max-w-5xl max-h-[90vh] overflow-y-auto apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden">
        <DialogHeader className="p-6">
          <div className="flex items-center justify-between">
            <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-apple-red" />
              Desempeño de {technician.full_name}
            </DialogTitle>
            <div className="flex gap-2">
              {["month", "quarter", "year"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`apple-press px-3 py-1 rounded-apple-sm apple-text-footnote transition ${
                    timeRange === range
                      ? "bg-apple-red text-white"
                      : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
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
            <div className="animate-spin w-12 h-12 border-4 border-apple-red border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-6 p-6 pt-0">
            {/* KPIs Principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="apple-card border-0">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="apple-text-caption1 apple-label-tertiary">Total Órdenes</p>
                      <p className="apple-text-title2 apple-label-primary mt-1 tabular-nums">
                        {metrics?.totalOrders || 0}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-apple-blue" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="apple-card border-0">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="apple-text-caption1 apple-label-tertiary">Completadas</p>
                      <p className="apple-text-title2 text-apple-green mt-1 tabular-nums">
                        {metrics?.completed || 0}
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-apple-green" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="apple-card border-0">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="apple-text-caption1 apple-label-tertiary">Rating Promedio</p>
                      <p className={`apple-text-title2 mt-1 flex items-center gap-1 tabular-nums ${getPerformanceColor(metrics?.avgRating, "rating")}`}>
                        {(metrics?.avgRating || 0).toFixed(1)}
                        <Star className="w-5 h-5 fill-current" />
                      </p>
                      <p className="apple-text-caption2 apple-label-tertiary">
                        {metrics?.totalRatings || 0} valoraciones
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-apple-sm bg-apple-yellow/15 flex items-center justify-center">
                      <Award className="w-5 h-5 text-apple-yellow" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="apple-card border-0">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="apple-text-caption1 apple-label-tertiary">Tasa de Éxito</p>
                      <p className={`apple-text-title2 mt-1 tabular-nums ${getPerformanceColor(metrics?.successRate, "rate")}`}>
                        {(metrics?.successRate || 0).toFixed(0)}%
                      </p>
                    </div>
                    <div className="w-10 h-10 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
                      <Target className="w-5 h-5 text-apple-purple" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Métricas Detalladas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="apple-card border-0">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <Clock className="w-5 h-5 text-apple-blue" />
                    <p className="apple-text-subheadline font-semibold apple-label-primary">Tiempo Promedio</p>
                  </div>
                  <p className="apple-text-title1 apple-label-primary tabular-nums">
                    {(metrics?.avgCompletionHours || 0).toFixed(1)} hrs
                  </p>
                  <p className="apple-text-caption1 apple-label-tertiary mt-1">Por reparación</p>
                </CardContent>
              </Card>

              <Card className="apple-card border-0">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <CheckCircle className="w-5 h-5 text-apple-green" />
                    <p className="apple-text-subheadline font-semibold apple-label-primary">Entregas a Tiempo</p>
                  </div>
                  <p className={`apple-text-title1 tabular-nums ${getPerformanceColor(metrics?.onTimeRate, "rate")}`}>
                    {(metrics?.onTimeRate || 0).toFixed(0)}%
                  </p>
                  <p className="apple-text-caption1 apple-label-tertiary mt-1 tabular-nums">
                    {Math.round((metrics?.completed || 0) * ((metrics?.onTimeRate || 0) / 100))} de {metrics?.completed || 0}
                  </p>
                </CardContent>
              </Card>

              <Card className="apple-card border-0">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <TrendingUp className="w-5 h-5 text-apple-green" />
                    <p className="apple-text-subheadline font-semibold apple-label-primary">Ingresos Generados</p>
                  </div>
                  <p className="apple-text-title1 text-apple-green tabular-nums">
                    ${(metrics?.revenue || 0).toFixed(2)}
                  </p>
                  <p className="apple-text-caption1 apple-label-tertiary mt-1">En el período</p>
                </CardContent>
              </Card>
            </div>

            {/* Estado Actual */}
            <Card className="apple-card border-0">
              <CardContent className="pt-6">
                <h3 className="apple-text-headline apple-label-primary mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-apple-red" />
                  Estado Actual
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-3 bg-apple-blue/12 rounded-apple-md">
                    <p className="apple-text-caption1 text-apple-blue mb-1">En Progreso</p>
                    <p className="apple-text-title2 text-apple-blue tabular-nums">
                      {metrics?.inProgress || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-apple-purple/12 rounded-apple-md">
                    <p className="apple-text-caption1 text-apple-purple mb-1">Capacidad</p>
                    <p className="apple-text-title2 text-apple-purple tabular-nums">
                      {metrics?.inProgress || 0}/{technician.availability?.max_capacity || 5}
                    </p>
                  </div>
                  <div className="p-3 bg-apple-yellow/12 rounded-apple-md">
                    <p className="apple-text-caption1 text-apple-yellow mb-1">Especialidades</p>
                    <p className="apple-text-title2 text-apple-yellow tabular-nums">
                      {technician.specializations?.length || 0}
                    </p>
                  </div>
                  <div className="p-3 bg-apple-green/12 rounded-apple-md">
                    <p className="apple-text-caption1 text-apple-green mb-1">Certificaciones</p>
                    <p className="apple-text-title2 text-apple-green tabular-nums">
                      {technician.certifications?.length || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Órdenes Recientes */}
            <Card className="apple-card border-0">
              <CardContent className="pt-6">
                <h3 className="apple-text-headline apple-label-primary mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-apple-red" />
                  Órdenes Recientes
                </h3>
                <div className="space-y-2">
                  {orders.length > 0 ? (
                    orders.map((order) => (
                      <div
                        key={order.id}
                        className="p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md flex items-center justify-between"
                      >
                        <div>
                          <p className="apple-label-primary apple-text-subheadline font-medium">{order.order_number}</p>
                          <p className="apple-text-caption1 apple-label-tertiary">
                            {order.customer_name} • {order.device_brand} {order.device_model}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className="bg-apple-blue/15 text-apple-blue border-0">
                            {order.status}
                          </Badge>
                          <span className="apple-text-caption2 apple-label-tertiary">
                            {format(new Date(order.created_date), "dd MMM", { locale: es })}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center apple-label-tertiary apple-text-body py-4">
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
