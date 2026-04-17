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

  const [actionLoading, setActionLoading] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleteReason, setDeleteReason] = useState("");
  const menuRef = useRef(null);

  useEffect(() => {
    if (isSuperAdmin) loadTenants();
  }, [isSuperAdmin]);

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
      toast.success("Tenant creado exitosamente");
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
      case "active":    return "bg-apple-green/15 text-apple-green border-0";
      case "suspended": return "bg-apple-red/15 text-apple-red border-0";
      case "cancelled": return "bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary border-0";
      case "trial":
      default:          return "bg-apple-yellow/15 text-apple-yellow border-0";
    }
  };

  const getSubscriptionColor = (status) => {
    switch (status) {
      case "active":   return "text-apple-green";
      case "trial":    return "text-apple-yellow";
      case "past_due": return "text-apple-orange";
      case "paused":
      case "cancelled":return "text-apple-red";
      default:         return "apple-label-tertiary";
    }
  };

  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.slug?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isSuperAdmin) {
    return (
      <div className="apple-type p-8 text-center">
        <Shield className="w-16 h-16 text-apple-red mx-auto mb-4" />
        <h2 className="apple-text-title2 apple-label-primary mb-2">Acceso Denegado</h2>
        <p className="apple-label-tertiary apple-text-subheadline">Solo los Super Admins pueden acceder a esta sección</p>
      </div>
    );
  }

  if (loading && tenants.length === 0) {
    return (
      <div className="apple-type flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-apple-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="apple-type p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-apple-purple/12 rounded-apple-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-apple-md bg-apple-purple/15 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-apple-purple" />
            </div>
            <div>
              <h1 className="apple-text-title2 apple-label-primary">Gestión de Tenants</h1>
              <p className="text-apple-purple apple-text-subheadline">Panel de Super Admin</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={loadTenants}
              variant="outline"
              size="sm"
              className="apple-btn apple-btn-secondary apple-press"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="apple-btn apple-btn-primary apple-press"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Tenant
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="apple-card border-0 p-4">
          <p className="apple-label-tertiary apple-text-subheadline">Total</p>
          <p className="apple-text-title2 apple-label-primary tabular-nums">{tenants.length}</p>
        </Card>
        <Card className="apple-card border-0 p-4">
          <p className="apple-label-tertiary apple-text-subheadline">Activos</p>
          <p className="apple-text-title2 apple-label-primary tabular-nums">{tenants.filter(t => t.status === "active").length}</p>
        </Card>
        <Card className="apple-card border-0 p-4">
          <p className="apple-label-tertiary apple-text-subheadline">En Trial</p>
          <p className="apple-text-title2 apple-label-primary tabular-nums">{tenants.filter(t => t.subscription_status === "trial").length}</p>
        </Card>
        <Card className="apple-card border-0 p-4">
          <p className="apple-label-tertiary apple-text-subheadline">Suspendidos</p>
          <p className="apple-text-title2 apple-label-primary tabular-nums">{tenants.filter(t => t.status === "suspended").length}</p>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="w-4 h-4 apple-label-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre, email o slug..."
          className="apple-input pl-10"
        />
      </div>

      {/* Tenants List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" ref={menuRef}>
        {filteredTenants.map(tenant => (
          <Card
            key={tenant.id}
            className={`apple-card border-0 p-4 transition-all relative ${
              tenant.status === 'suspended' ? 'opacity-60' : ''
            }`}
          >
            {actionLoading === tenant.id && (
              <div className="absolute inset-0 bg-black/60 rounded-apple-md flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
              </div>
            )}

            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-apple-blue" />
                </div>
                <div className="min-w-0">
                  <h3 className="apple-label-primary apple-text-subheadline truncate">{tenant.name}</h3>
                  <p className="apple-text-caption1 apple-label-tertiary tabular-nums">/{tenant.slug}</p>
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setOpenMenuId(openMenuId === tenant.id ? null : tenant.id)}
                  className="apple-label-tertiary hover:apple-label-primary p-1 rounded-apple-sm transition-colors apple-press"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {openMenuId === tenant.id && (
                  <div className="absolute right-0 top-7 w-44 apple-surface-elevated rounded-apple-md shadow-apple-xl z-50 overflow-hidden border-0">
                    {tenant.status !== 'suspended' ? (
                      <button
                        onClick={() => handleAction(tenant.id, 'suspend')}
                        className="w-full flex items-center gap-2 px-4 py-2.5 apple-text-subheadline text-apple-orange hover:bg-apple-orange/12 transition-colors apple-press"
                      >
                        <PauseCircle className="w-4 h-4" />
                        Suspender
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAction(tenant.id, 'reactivate')}
                        className="w-full flex items-center gap-2 px-4 py-2.5 apple-text-subheadline text-apple-green hover:bg-apple-green/12 transition-colors apple-press"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Reactivar
                      </button>
                    )}
                    <div style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }} />
                    <button
                      onClick={() => { setDeleteDialog(tenant); setOpenMenuId(null); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 apple-text-subheadline text-apple-red hover:bg-apple-red/12 transition-colors apple-press"
                    >
                      <Trash2 className="w-4 h-4" />
                      Eliminar cuenta
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5 mb-3 apple-text-subheadline">
              <div className="flex items-center gap-2 apple-label-tertiary">
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate">{tenant.email}</span>
              </div>
              {tenant.admin_phone && (
                <div className="flex items-center gap-2 apple-label-tertiary">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span className="tabular-nums">{tenant.admin_phone}</span>
                </div>
              )}
              {tenant.trial_end_date && (
                <div className="flex items-center gap-2 apple-label-tertiary">
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span className="tabular-nums">Trial hasta {new Date(tenant.trial_end_date).toLocaleDateString('es')}</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Badge className={getStatusColor(tenant.status)}>
                {tenant.status === 'active' ? 'Activo' :
                 tenant.status === 'suspended' ? 'Suspendido' :
                 tenant.status === 'cancelled' ? 'Cancelado' : 'Trial'}
              </Badge>
              {tenant.subscription_status && (
                <span className={`apple-text-caption1 ${getSubscriptionColor(tenant.subscription_status)}`}>
                  {tenant.subscription_status}
                </span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {filteredTenants.length === 0 && !loading && (
        <div className="text-center py-12">
          <Building2 className="w-16 h-16 apple-label-tertiary mx-auto mb-4" />
          <p className="apple-label-tertiary apple-text-subheadline">No se encontraron tenants</p>
        </div>
      )}

      {/* Dialog Confirmar Eliminación */}
      <Dialog open={!!deleteDialog} onOpenChange={(open) => { if (!open) { setDeleteDialog(null); setDeleteReason(""); } }}>
        <DialogContent className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-md z-[9999]">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-apple-red">
                <div className="w-10 h-10 rounded-apple-sm bg-apple-red/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-apple-red" />
                </div>
                <span className="apple-text-title3">Eliminar cuenta</span>
              </DialogTitle>
            </DialogHeader>

            <div className="mt-2 space-y-4">
              <div className="bg-apple-red/12 rounded-apple-md p-4">
                <p className="apple-label-primary apple-text-headline mb-1">{deleteDialog?.name}</p>
                <p className="apple-label-tertiary apple-text-subheadline">{deleteDialog?.email}</p>
              </div>

              <p className="apple-label-secondary apple-text-subheadline">
                Esta acción es <strong className="text-apple-red">permanente e irreversible</strong>. Se eliminarán:
              </p>
              <ul className="apple-label-tertiary apple-text-subheadline space-y-1 list-disc list-inside">
                <li>El tenant y toda su configuración</li>
                <li>Todos los empleados/usuarios del tenant</li>
                <li>La suscripción de Stripe (si existe)</li>
              </ul>

              <div>
                <label className="apple-label-secondary apple-text-footnote mb-2 block">Motivo (opcional)</label>
                <Input
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ej: Cuenta de prueba sin actividad"
                  className="apple-input"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 apple-btn apple-btn-secondary apple-press"
                  onClick={() => { setDeleteDialog(null); setDeleteReason(""); }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={!!actionLoading}
                  className="flex-1 apple-btn apple-btn-destructive apple-press"
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Crear Tenant */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-2xl z-[9999]">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-3">
                <div className="w-10 h-10 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-apple-purple" />
                </div>
                Crear Nuevo Tenant
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <label className="apple-label-secondary apple-text-footnote mb-2 block">Nombre del Tenant *</label>
                <Input
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({...newTenant, name: e.target.value})}
                  placeholder="Mi Empresa"
                  className="apple-input"
                />
              </div>
              <div>
                <label className="apple-label-secondary apple-text-footnote mb-2 block">Slug (URL-friendly) *</label>
                <Input
                  value={newTenant.slug}
                  onChange={(e) => setNewTenant({...newTenant, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')})}
                  placeholder="mi-empresa"
                  className="apple-input tabular-nums"
                />
              </div>
              <div>
                <label className="apple-label-secondary apple-text-footnote mb-2 block">Email del Propietario *</label>
                <Input
                  value={newTenant.owner_email}
                  onChange={(e) => setNewTenant({...newTenant, owner_email: e.target.value})}
                  placeholder="propietario@example.com"
                  type="email"
                  className="apple-input"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowCreateModal(false)}
                  variant="outline"
                  className="flex-1 apple-btn apple-btn-secondary apple-press"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateTenant}
                  disabled={loading}
                  className="flex-1 apple-btn apple-btn-primary apple-press"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" />Crear Tenant</>}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
