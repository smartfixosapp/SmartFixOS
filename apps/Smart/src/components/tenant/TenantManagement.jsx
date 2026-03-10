import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, Users, Settings, TrendingUp, Plus, Search,
  Eye, EyeOff, Edit2, Trash2, Crown, Shield, CheckCircle,
  XCircle, Clock, MoreVertical, X, Loader2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenant } from "../utils/tenantContext";

export default function TenantManagement() {
  const { isSuperAdmin } = useTenant();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTenant, setNewTenant] = useState({
    name: "",
    slug: "",
    owner_email: "",
    plan: "trial",
    status: "trial"
  });

  useEffect(() => {
    if (isSuperAdmin) {
      loadTenants();
    }
  }, [isSuperAdmin]);

  const loadTenants = async () => {
    try {
      const data = await base44.entities.Tenant.list("-created_date", 100);
      setTenants(data || []);
    } catch (error) {
      toast.error("Error al cargar tenants");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    if (!newTenant.name || !newTenant.slug || !newTenant.owner_email) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      await base44.entities.Tenant.create(newTenant);
      toast.success("✅ Tenant creado exitosamente");
      setShowCreateModal(false);
      setNewTenant({ name: "", slug: "", owner_email: "", plan: "trial", status: "trial" });
      await loadTenants();
    } catch (error) {
      toast.error("Error al crear tenant: " + (error.message || "Intenta nuevamente"));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active": return "bg-green-500/20 text-green-300 border-green-500/30";
      case "suspended": return "bg-red-500/20 text-red-300 border-red-500/30";
      case "trial": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
      default: return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const getPlanColor = (plan) => {
    switch (plan) {
      case "enterprise": return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "professional": return "bg-blue-500/20 text-blue-300 border-blue-500/30";
      case "basic": return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
      default: return "bg-gray-500/20 text-gray-300 border-gray-500/30";
    }
  };

  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.owner_email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <Shield className="w-16 h-16 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Acceso Denegado</h2>
        <p className="text-gray-400">Solo los Super Admins pueden acceder a esta sección</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600/10 to-pink-600/10 border border-purple-500/20 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Gestión de Tenants</h1>
              <p className="text-purple-200/80 text-sm">Panel de Super Admin</p>
            </div>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Tenant
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Card className="bg-black/40 border-cyan-500/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Tenants</p>
              <p className="text-2xl font-bold text-white">{tenants.length}</p>
            </div>
            <Building2 className="w-8 h-8 text-cyan-400" />
          </div>
        </Card>
        <Card className="bg-black/40 border-green-500/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Activos</p>
              <p className="text-2xl font-bold text-white">
                {tenants.filter(t => t.status === "active").length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </Card>
        <Card className="bg-black/40 border-yellow-500/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">En Trial</p>
              <p className="text-2xl font-bold text-white">
                {tenants.filter(t => t.status === "trial").length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </Card>
        <Card className="bg-black/40 border-red-500/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Suspendidos</p>
              <p className="text-2xl font-bold text-white">
                {tenants.filter(t => t.status === "suspended").length}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre, slug o email..."
            className="pl-10 bg-black/40 border-white/10 text-white"
          />
        </div>
      </div>

      {/* Tenants List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTenants.map(tenant => (
          <Card
            key={tenant.id}
            className="bg-black/40 border-white/10 p-4 hover:border-cyan-500/30 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-bold">{tenant.name}</h3>
                  <p className="text-xs text-gray-400">/{tenant.slug}</p>
                </div>
              </div>
              <button className="text-gray-400 hover:text-white">
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <Crown className="w-3 h-3 text-yellow-400" />
                <span className="text-gray-400">{tenant.owner_email}</span>
              </div>
            </div>

            <div className="flex gap-2 mb-3">
              <Badge className={getStatusColor(tenant.status)}>
                {tenant.status}
              </Badge>
              <Badge className={getPlanColor(tenant.plan)}>
                {tenant.plan}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-white/10 text-gray-300"
              >
                <Eye className="w-3 h-3 mr-1" />
                Ver
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-white/10 text-gray-300"
              >
                <Settings className="w-3 h-3 mr-1" />
                Config
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredTenants.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No se encontraron tenants</p>
        </div>
      )}

      {/* Modal Crear Tenant */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="bg-slate-900 border-purple-500/30 text-white max-w-2xl z-[9999]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              Crear Nuevo Tenant
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="text-gray-300 text-sm mb-2 block">Nombre del Tenant *</label>
              <Input
                value={newTenant.name}
                onChange={(e) => setNewTenant({...newTenant, name: e.target.value})}
                placeholder="Mi Empresa"
                className="bg-black/40 border-white/10 text-white"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm mb-2 block">Slug (URL-friendly) *</label>
              <Input
                value={newTenant.slug}
                onChange={(e) => setNewTenant({...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                placeholder="mi-empresa"
                className="bg-black/40 border-white/10 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Solo letras minúsculas, números y guiones</p>
            </div>

            <div>
              <label className="text-gray-300 text-sm mb-2 block">Email del Propietario *</label>
              <Input
                value={newTenant.owner_email}
                onChange={(e) => setNewTenant({...newTenant, owner_email: e.target.value})}
                placeholder="propietario@example.com"
                type="email"
                className="bg-black/40 border-white/10 text-white"
              />
            </div>

            <div>
              <label className="text-gray-300 text-sm mb-2 block">Plan</label>
              <select
                value={newTenant.plan}
                onChange={(e) => setNewTenant({...newTenant, plan: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
              >
                <option value="free">Free</option>
                <option value="basic">Basic</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label className="text-gray-300 text-sm mb-2 block">Estado</label>
              <select
                value={newTenant.status}
                onChange={(e) => setNewTenant({...newTenant, status: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-white"
              >
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setShowCreateModal(false)}
                variant="outline"
                className="flex-1 border-white/10 text-gray-300"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateTenant}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear Tenant
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
