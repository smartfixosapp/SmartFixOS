
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { dataClient } from "@/components/api/dataClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Search,
  Plus,
  Award,
  Clock,
  TrendingUp,
  Star,
  CheckCircle,
  AlertCircle,
  Calendar,
  Bell,
  Settings,
  BarChart3,
  Target,
  Zap,
  Phone,
  Mail,
  Edit,
  Eye,
  Wrench // Added Wrench icon
} from "lucide-react";
import { format, startOfMonth, endOfMonth, differenceInHours } from "date-fns";
import { es } from "date-fns/locale";
import TechnicianProfileDialog from "../components/technicians/TechnicianProfileDialog";
import TechnicianPerformanceDialog from "../components/technicians/TechnicianPerformanceDialog";
import NotificationService from "../components/notifications/NotificationService";

export default function Technicians() {
  const [technicians, setTechnicians] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTechnician, setSelectedTechnician] = useState(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showPerformanceDialog, setShowPerformanceDialog] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("performance");

  useEffect(() => {
    loadData();
    // Refresh cada 5 min y solo si tab visible
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") loadData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [techProfiles, allUsers, orders] = await Promise.all([
        dataClient.entities.TechnicianProfile.list(),
        dataClient.entities.User.filter({ active: true }),
        dataClient.entities.Order.list("-updated_date", 500)
      ]);

      // Calcular métricas en tiempo real
      const enrichedTechs = techProfiles.map(tech => {
        const techOrders = orders.filter(o => o.assigned_to === tech.user_id);
        const completedOrders = techOrders.filter(o =>
          ["completed", "picked_up"].includes(o.status)
        );
        const activeOrders = techOrders.filter(o =>
          ["intake", "diagnosing", "in_progress", "awaiting_approval"].includes(o.status)
        );

        // Calcular tiempo promedio de completación
        let avgCompletionHours = 0;
        if (completedOrders.length > 0) {
          const totalHours = completedOrders.reduce((sum, order) => {
            try {
              const start = new Date(order.created_date);
              const end = new Date(order.updated_date);
              return sum + differenceInHours(end, start);
            } catch {
              return sum;
            }
          }, 0);
          avgCompletionHours = totalHours / completedOrders.length;
        }

        // Calcular tasa de éxito
        const successRate = techOrders.length > 0
          ? (completedOrders.length / techOrders.length) * 100
          : 0;

        return {
          ...tech,
          metrics: {
            total_jobs: techOrders.length,
            completed_jobs: completedOrders.length,
            active_jobs: activeOrders.length,
            avg_completion_time_hours: avgCompletionHours,
            success_rate: successRate,
            current_capacity: activeOrders.length
          }
        };
      });

      setTechnicians(enrichedTechs);
      setUsers(allUsers);
      setLoading(false);
    } catch (error) {
      console.error("Error loading technicians:", error);
      setLoading(false);
    }
  };

  const handleCreateProfile = () => {
    setSelectedTechnician(null);
    setShowProfileDialog(true);
  };

  const handleEditProfile = (tech) => {
    setSelectedTechnician(tech);
    setShowProfileDialog(true);
  };

  const handleViewPerformance = (tech) => {
    setSelectedTechnician(tech);
    setShowPerformanceDialog(true);
  };

  const handleProfileSaved = () => {
    setShowProfileDialog(false);
    setSelectedTechnician(null);
    loadData();
  };

  const handleSendNotification = async (tech, message) => {
    try {
      await NotificationService.notifyTechnician(tech, message);
      alert("Notificación enviada ✅");
    } catch (error) {
      alert("Error al enviar notificación: " + error.message);
    }
  };

  const filteredTechnicians = technicians.filter(tech => {
    const matchesSearch =
      tech.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tech.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tech.specializations?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "available" && tech.availability?.status === "available") ||
      (filterStatus === "busy" && tech.availability?.status === "busy") ||
      (filterStatus === "offline" && tech.availability?.status === "offline");

    return matchesSearch && matchesStatus;
  });

  const sortedTechnicians = [...filteredTechnicians].sort((a, b) => {
    switch (sortBy) {
      case "performance":
        return (b.metrics?.success_rate || 0) - (a.metrics?.success_rate || 0);
      case "jobs":
        return (b.metrics?.completed_jobs || 0) - (a.metrics?.completed_jobs || 0);
      case "rating":
        return (b.performance_metrics?.avg_customer_rating || 0) - (a.performance_metrics?.avg_customer_rating || 0);
      case "name":
        return (a.full_name || "").localeCompare(b.full_name || "");
      default:
        return 0;
    }
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "available":
        return "bg-apple-green/15 text-apple-green";
      case "busy":
        return "bg-apple-yellow/15 text-apple-yellow";
      case "offline":
        return "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary";
      case "on_break":
        return "bg-apple-blue/15 text-apple-blue";
      default:
        return "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary";
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      available: "Disponible",
      busy: "Ocupado",
      offline: "Fuera de línea",
      on_break: "En descanso"
    };
    return labels[status] || status;
  };

  const avgTeamRating = technicians.length > 0
    ? technicians.reduce((sum, t) => sum + (t.performance_metrics?.avg_customer_rating || 0), 0) / technicians.length
    : 0;

  const totalCompletedJobs = technicians.reduce((sum, t) => sum + (t.metrics?.completed_jobs || 0), 0);

  const availableTechs = technicians.filter(t => t.availability?.status === "available").length;

  if (loading) {
    return (
      <div className="min-h-screen apple-surface apple-type p-4 sm:p-6 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-apple-red border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen apple-surface apple-type py-4 sm:py-6">
      <div className="app-container space-y-6">
        {/* Header */}
        <div className="apple-card p-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-apple-sm bg-apple-red/15 flex items-center justify-center shrink-0">
                <Wrench className="w-6 h-6 text-apple-red" />
              </div>
              <div>
                <h1 className="apple-text-large-title apple-label-primary">Técnicos</h1>
                <p className="apple-text-subheadline apple-label-secondary mt-1">Gestiona tu equipo técnico</p>
              </div>
            </div>
            <Button
              onClick={handleCreateProfile}
              className="apple-btn apple-btn-primary apple-press"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Técnico
            </Button>
          </div>
        </div>

        {/* KPIs del Equipo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="apple-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="apple-text-footnote apple-label-secondary">Total Técnicos</p>
                  <p className="apple-text-title1 apple-label-primary mt-1 tabular-nums">{technicians.length}</p>
                  <p className="apple-text-caption1 text-apple-green mt-1 tabular-nums">
                    {availableTechs} disponibles
                  </p>
                </div>
                <div className="w-11 h-11 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                  <Users className="w-6 h-6 text-apple-blue" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="apple-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="apple-text-footnote apple-label-secondary">Trabajos Completados</p>
                  <p className="apple-text-title1 apple-label-primary mt-1 tabular-nums">{totalCompletedJobs}</p>
                  <p className="apple-text-caption1 apple-label-tertiary mt-1">Este mes</p>
                </div>
                <div className="w-11 h-11 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-apple-green" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="apple-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="apple-text-footnote apple-label-secondary">Rating Promedio</p>
                  <p className="apple-text-title1 apple-label-primary mt-1 flex items-center gap-2 tabular-nums">
                    {avgTeamRating.toFixed(1)}
                    <Star className="w-5 h-5 text-apple-yellow fill-current" />
                  </p>
                  <p className="apple-text-caption1 apple-label-tertiary mt-1">Del equipo</p>
                </div>
                <div className="w-11 h-11 rounded-apple-sm bg-apple-yellow/15 flex items-center justify-center">
                  <Award className="w-6 h-6 text-apple-yellow" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="apple-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="apple-text-footnote apple-label-secondary">Eficiencia</p>
                  <p className="apple-text-title1 apple-label-primary mt-1 tabular-nums">
                    {technicians.length > 0
                      ? ((technicians.reduce((s, t) => s + (t.metrics?.success_rate || 0), 0) / technicians.length) || 0).toFixed(0)
                      : 0}%
                  </p>
                  <p className="apple-text-caption1 text-apple-green mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Tasa de éxito
                  </p>
                </div>
                <div className="w-11 h-11 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
                  <Target className="w-6 h-6 text-apple-purple" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros y Búsqueda */}
        <Card className="apple-card">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 apple-label-tertiary" />
                <Input
                  placeholder="Buscar técnico por nombre, email o especialización..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="apple-input pl-10"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                {["all", "available", "busy", "offline"].map((status) => (
                  <Button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={
                      filterStatus === status
                        ? "apple-btn apple-btn-primary apple-press"
                        : "apple-btn apple-btn-secondary apple-press"
                    }
                  >
                    {status === "all" ? "Todos" : getStatusLabel(status)}
                  </Button>
                ))}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="apple-input px-4 py-2"
              >
                <option value="performance">Por Desempeño</option>
                <option value="jobs">Por Trabajos</option>
                <option value="rating">Por Rating</option>
                <option value="name">Por Nombre</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Técnicos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {sortedTechnicians.map((tech) => (
            <Card key={tech.id} className="apple-card apple-press transition-all">
              <CardContent className="pt-6">
                {/* Header del Técnico */}
                <div
                  className="flex items-start justify-between pb-4 mb-4"
                  style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-apple-sm bg-apple-red/15 flex items-center justify-center text-apple-red apple-text-headline">
                      {tech.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h3 className="apple-text-headline apple-label-primary">{tech.full_name}</h3>
                      <p className="apple-text-caption1 apple-label-secondary">{tech.email}</p>
                    </div>
                  </div>
                  <Badge className={`${getStatusColor(tech.availability?.status || "offline")} apple-text-caption2 rounded-apple-xs px-2 py-0.5 border-0`}>
                    {getStatusLabel(tech.availability?.status || "offline")}
                  </Badge>
                </div>

                {/* Especializations */}
                {tech.specializations && tech.specializations.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {tech.specializations.slice(0, 3).map((spec, idx) => (
                        <Badge key={idx} className="apple-text-caption2 bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary rounded-apple-xs px-2 py-0.5 border-0">
                          {spec}
                        </Badge>
                      ))}
                      {tech.specializations.length > 3 && (
                        <Badge className="apple-text-caption2 bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary rounded-apple-xs px-2 py-0.5 border-0">
                          +{tech.specializations.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="apple-surface-secondary rounded-apple-sm p-3">
                    <p className="apple-text-caption2 apple-label-secondary mb-1">Trabajos</p>
                    <p className="apple-text-title3 apple-label-primary tabular-nums">
                      {tech.metrics?.completed_jobs || 0}
                      <span className="apple-text-caption1 apple-label-tertiary">/{tech.metrics?.total_jobs || 0}</span>
                    </p>
                  </div>

                  <div className="apple-surface-secondary rounded-apple-sm p-3">
                    <p className="apple-text-caption2 apple-label-secondary mb-1">Rating</p>
                    <p className="apple-text-title3 apple-label-primary flex items-center gap-1 tabular-nums">
                      {(tech.performance_metrics?.avg_customer_rating || 0).toFixed(1)}
                      <Star className="w-4 h-4 text-apple-yellow fill-current" />
                    </p>
                  </div>

                  <div className="apple-surface-secondary rounded-apple-sm p-3">
                    <p className="apple-text-caption2 apple-label-secondary mb-1">Éxito</p>
                    <p className="apple-text-title3 text-apple-green tabular-nums">
                      {(tech.metrics?.success_rate || 0).toFixed(0)}%
                    </p>
                  </div>

                  <div className="apple-surface-secondary rounded-apple-sm p-3">
                    <p className="apple-text-caption2 apple-label-secondary mb-1">Activos</p>
                    <p className="apple-text-title3 text-apple-blue tabular-nums">
                      {tech.metrics?.active_jobs || 0}
                      <span className="apple-text-caption1 apple-label-tertiary">/{tech.availability?.max_capacity || 5}</span>
                    </p>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="apple-btn apple-btn-secondary apple-press flex-1"
                    onClick={() => handleViewPerformance(tech)}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Desempeño
                  </Button>
                  <Button
                    size="sm"
                    className="apple-btn apple-btn-secondary apple-press flex-1"
                    onClick={() => handleEditProfile(tech)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    className="apple-btn apple-btn-secondary apple-press"
                    onClick={() => handleSendNotification(tech, "Tienes una nueva asignación urgente")}
                  >
                    <Bell className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sortedTechnicians.length === 0 && (
          <Card className="apple-card">
            <CardContent className="py-12 text-center">
              <Users className="w-16 h-16 apple-label-tertiary mx-auto mb-4" />
              <p className="apple-text-body apple-label-secondary">No se encontraron técnicos</p>
              <Button
                onClick={handleCreateProfile}
                className="mt-4 apple-btn apple-btn-primary apple-press"
              >
                <Plus className="w-4 h-4 mr-2" />
                Crear Primer Técnico
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      {showProfileDialog && (
        <TechnicianProfileDialog
          open={showProfileDialog}
          onClose={() => {
            setShowProfileDialog(false);
            setSelectedTechnician(null);
          }}
          technician={selectedTechnician}
          users={users}
          onSaved={handleProfileSaved}
        />
      )}

      {showPerformanceDialog && selectedTechnician && (
        <TechnicianPerformanceDialog
          open={showPerformanceDialog}
          onClose={() => {
            setShowPerformanceDialog(false);
            setSelectedTechnician(null);
          }}
          technician={selectedTechnician}
        />
      )}
    </div>
  );
}
