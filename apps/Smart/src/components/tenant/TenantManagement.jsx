import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { manageTenant } from "@/api/functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, Users, Settings, TrendingUp, Plus, Search,
  Eye, EyeOff, Edit2, Trash2, Crown, Shield, CheckCircle,
  XCircle, Clock, MoreVertical, X, Loader2, PauseCircle,
  PlayCircle, AlertTriangle, Calendar, Mail, Phone, RefreshCw
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
    name: "", slug: "", owner_email: "", plan: "trial", status: "trial"
  });

  // Acciones
  const [actionLoading, setActionLoading] = useState(null); // tenantId en proceso
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null); // tenant a eliminar
  const [deleteReason, setDeleteReason] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (isSuperAdmin) loadTenants();
  }, [isSuperAdmin]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadTenants = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Tenant.list("-created_date", 100);
      setTenants(data || []);
    } catch {
      toast.error("Error al cargar tenants");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (tenantId, action, reason = "") => {
    setActionLoading(tenantId);
    setOpenMenuId(null);
    try {
      const result = await manageTenant({ tenantId, action, reason });
      if (result?.success) {
        toast.success(result.message);
        await loadTenants();
      } else {
        toast.error(result?.error || "Error al ejecutar la acción");
      }
    } catch (err) {
      toast.error("Error: " + (err.message || "Intenta nuevamente"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    await handleAction(deleteDialog.id, "delete", deleteReason);
    setDeleteDialog(null);
    setDeleteReason("");
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
      case "active":    return "bg-green-500/20 text-green-300 border-green-500/30";
      case "suspended": return "bg-red-500/20 text-red-300 border-red-500/30";
      case "cancelled": return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      case "trial":
      default:          return "bg-yellow-500/20 text-yellow-300 border-yellow-500/30";
    }
  };

  const getSubscriptionColor = (status) => {
    switch (status) {
      case "active":   return "text-green-400";
      case "trial":    return "text-yellow-400";
      case "past_due": return "text-orange-400";
      case "paused":
      case "cancelled":return "text-red-400";
      default:         return "text-gray-400";
    }
  };

  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug?.toLowerCase().includes(searchQuery.toLowerCase())
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

  if (loading && tenants.length === 0) {
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
          <div className="flex gap-2">
            <Button
              onClick={loadTenants}
              variant="outline"
              size="sm"
              className="border-white/20 text-gray-300"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Tenant
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="bg-black/40 border-cyan-500/20 p-4">
          <p className="text-gray-400 text-sm">Total</p>
          <p className="text-2xl font-bold text-white">{tenants.length}</p>
        </Card>
        <Card className="bg-black/40 border-green-500/20 p-4">
          <p className="text-gray-400 text-sm">Activos</p>
          <p className="text-2xl font-bold text-white">{tenants.filter(t => t.status === "active").length}</p>
        </Card>
        <Card className="bg-black/40 border-yellow-500/20 p-4">
          <p className="text-gray-400 text-sm">En Trial</p>
          <p className="text-2xl font-bold text-white">{tenants.filter(t => t.subscription_status === "trial").length}</p>
        </Card>
        <Card className="bg-black/40 border-red-500/20 p-4">
          <p className="text-gray-400 text-sm">Suspendidos</p>
          <p className="text-2xl font-bold text-white">{tenants.filter(t => t.status === "suspended").length}</p>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, email o slug..."
          className="pl-10 bg-black/40 border-white/10 text-white"
        />
      </div>

      {/* Tenants List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" ref={menuRef}>
        {filteredTenants.map(tenant => (
          <Card
            key={tenant.id}
            className={`bg-black/40 border-white/10 p-4 transition-all relative ${
              tenant.status === 'suspended' ? 'opacity-60' : 'hover:border-purple-500/30'
            }`}
          >
            {/* Spinner si está procesando */}
            {actionLoading === tenant.id && (
              <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            )}

            {/* Header de la card */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-white font-bold truncate">{tenant.name}</h3>
                  <p className="text-xs text-gray-500">/{tenant.slug}</p>
                </div>
              </div>

              {/* Dropdown Menu */}
              <div className="relative">
                <button
                  onClick={() => setOpenMenuId(openMenuId === tenant.id ? null : tenant.id)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {openMenuId === tenant.id && (
                  <div className="absolute right-0 top-7 w-44 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {tenant.status !== 'suspended' ? (
                      <button
                        onClick={() => handleAction(tenant.id, 'suspend')}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-orange-300 hover:bg-orange-500/10 transition-colors"
                      >
                        <PauseCircle className="w-4 h-4" />
                        Suspender
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(tenant.id, 'reactivate')}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-green-300 hover:bg-green-500/10 transition-colors"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Reactivar
                      </button>
                    )}
                    <div className="border-t border-white/10" />
                    <button
                      onClick={() => { setDeleteDialog(tenant); setOpenMenuId(null); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar cuenta
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="space-y-1.5 mb-3 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{tenant.email}</span>
              </div>
              {tenant.admin_phone && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span>{tenant.admin_phone}</span>
                </div>
              )}
              {tenant.trial_end_date && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>Trial hasta {new Date(tenant.trial_end_date).toLocaleDateString('es')}</span>
                </div>
              )}
            </div>

            {/* Badges */}
            <div className="flex gap-2 flex-wrap">
              <Badge className={getStatusColor(tenant.status)}>
                {tenant.status === 'active' ? 'Activo' :
                 tenant.status === 'suspended' ? 'Suspendido' :
                 tenant.status === 'cancelled' ? 'Cancelado' : 'Trial'}
              </Badge>
              {tenant.subscription_status && (
                <span className={`text-xs font-semibold ${getSubscriptionColor(tenant.subscription_status)}`}>
                  {tenant.subscription_status}
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {filteredTenants.length === 0 && !loading && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No se encontraron tenants</p>
        </div>
      )}

      {/* ── Dialog Confirmar Eliminación ── */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) { setDeleteDialog(null); setDeleteReason(""); } }}>
        <DialogContent className="bg-slate-900 border-red-500/30 text-white max-w-md z-[9999]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              Eliminar cuenta
            </DialogTitle>
          </DialogHeader>

          <div className="mt-2 space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <p className="text-white font-bold mb-1">{deleteDialog?.name}</p>
              <p className="text-gray-400 text-sm">{deleteDialog?.email}</p>
            </div>

            <p className="text-gray-300 text-sm">
              Esta acción es <strong className="text-red-400">permanente e irreversible</strong>. Se eliminarán:
            </p>
            <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
              <li>El tenant y toda su configuración</li>
              <li>Todos los empleados/usuarios del tenant</li>
              <li>La suscripción de Stripe (si existe)</li>
            </ul>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Motivo (opcional)</label>
              <Input
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Ej: Cuenta de prueba sin actividad"
                className="bg-black/40 border-white/10 text-white"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 border-white/20 text-gray-300"
                onClick={() => { setDeleteDialog(null); setDeleteReason(""); }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleDelete}
                disabled={!!actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold"
              >
                {actionLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Crear Tenant ── */}
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
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" />Crear Tenant</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
