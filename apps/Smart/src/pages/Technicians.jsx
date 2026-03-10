
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
    const interval = setInterval(loadData, 60000); // Refresh cada minuto
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [techProfiles, allUsers, orders] = await Promise.all([
        base44.entities.TechnicianProfile.list(),
        base44.entities.User.filter({ active: true }),
        base44.entities.Order.list("-updated_date", 500)
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
        return "bg-green-600/20 text-green-300 border-green-600/30";
      case "busy":
        return "bg-yellow-600/20 text-yellow-300 border-yellow-600/30";
      case "offline":
        return "bg-gray-600/20 text-gray-300 border-gray-600/30";
      case "on_break":
        return "bg-blue-600/20 text-blue-300 border-blue-600/30";
      default:
        return "bg-gray-600/20 text-gray-300 border-gray-600/30";
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] p-4 sm:p-6 flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Glass */}
        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Wrench className="w-8 h-8 text-red-500" />
                Técnicos
              </h1>
              <p className="text-gray-400 mt-2">Gestiona tu equipo técnico</p>
            </div>
            <Button
              onClick={handleCreateProfile}
              className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Técnico
            </Button>
          </div>
        </div>

        {/* KPIs del Equipo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Técnicos</p>
                  <p className="text-3xl font-bold text-white mt-1">{technicians.length}</p>
                  <p className="text-xs text-green-400 mt-1">
                    {availableTechs} disponibles
                  </p>
                </div>
                <div className="p-3 rounded-full bg-blue-600/20">
                  <Users className="w-6 h-6 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Trabajos Completados</p>
                  <p className="text-3xl font-bold text-white mt-1">{totalCompletedJobs}</p>
                  <p className="text-xs text-gray-500 mt-1">Este mes</p>
                </div>
                <div className="p-3 rounded-full bg-green-600/20">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Rating Promedio</p>
                  <p className="text-3xl font-bold text-white mt-1 flex items-center gap-2">
                    {avgTeamRating.toFixed(1)}
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Del equipo</p>
                </div>
                <div className="p-3 rounded-full bg-yellow-600/20">
                  <Award className="w-6 h-6 text-yellow-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Eficiencia</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {technicians.length > 0
                      ? ((technicians.reduce((s, t) => s + (t.metrics?.success_rate || 0), 0) / technicians.length) || 0).toFixed(0)
                      : 0}%
                  </p>
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Tasa de éxito
                  </p>
                </div>
                <div className="p-3 rounded-full bg-purple-600/20">
                  <Target className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtros y Búsqueda */}
        <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  placeholder="Buscar técnico por nombre, email o especialización..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-black/40 border-white/15 text-white"
                />
              </div>

              <div className="flex gap-2">
                {["all", "available", "busy", "offline"].map((status) => (
                  <Button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    variant={filterStatus === status ? "default" : "outline"}
                    className={
                      filterStatus === status
                        ? "bg-red-600 hover:bg-red-700"
                        : "border-white/15"
                    }
                  >
                    {status === "all" ? "Todos" : getStatusLabel(status)}
                  </Button>
                ))}
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 rounded-lg bg-black/40 border border-white/15 text-white"
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
            <Card key={tech.id} className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30 hover:border-red-600/50 transition-all">
              <CardContent className="pt-6">
                {/* Header del Técnico */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-xl">
                      {tech.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{tech.full_name}</h3>
                      <p className="text-xs text-gray-400">{tech.email}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(tech.availability?.status || "offline")}>
                    {getStatusLabel(tech.availability?.status || "offline")}
                  </Badge>
                </div>

                {/* Especializations */}
                {tech.specializations && tech.specializations.length > 0 && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {tech.specializations.slice(0, 3).map((spec, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs border-white/20">
                          {spec}
                        </Badge>
                      ))}
                      {tech.specializations.length > 3 && (
                        <Badge variant="outline" className="text-xs border-white/20">
                          +{tech.specializations.length - 3}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Métricas */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-black/40 p-3 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">Trabajos</p>
                    <p className="text-lg font-bold text-white">
                      {tech.metrics?.completed_jobs || 0}
                      <span className="text-xs text-gray-500">/{tech.metrics?.total_jobs || 0}</span>
                    </p>
                  </div>

                  <div className="bg-black/40 p-3 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">Rating</p>
                    <p className="text-lg font-bold text-white flex items-center gap-1">
                      {(tech.performance_metrics?.avg_customer_rating || 0).toFixed(1)}
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    </p>
                  </div>

                  <div className="bg-black/40 p-3 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">Éxito</p>
                    <p className="text-lg font-bold text-green-400">
                      {(tech.metrics?.success_rate || 0).toFixed(0)}%
                    </p>
                  </div>

                  <div className="bg-black/40 p-3 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">Activos</p>
                    <p className="text-lg font-bold text-blue-400">
                      {tech.metrics?.active_jobs || 0}
                      <span className="text-xs text-gray-500">/{tech.availability?.max_capacity || 5}</span>
                    </p>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-white/15"
                    onClick={() => handleViewPerformance(tech)}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Desempeño
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-white/15"
                    onClick={() => handleEditProfile(tech)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-white/15"
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
          <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
            <CardContent className="py-12 text-center">
              <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No se encontraron técnicos</p>
              <Button
                onClick={handleCreateProfile}
                className="mt-4 bg-red-600 hover:bg-red-700"
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
