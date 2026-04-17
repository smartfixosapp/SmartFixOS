import React, { useState, useEffect } from "react";
import appClient from "@/api/appClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Edit, Trash2, Globe, Phone, Mail, MapPin, Search,
  ExternalLink, Loader2 } from
"lucide-react";
import { toast } from "sonner";
import { loadSuppliersSafe, upsertSupplierInCache, removeSupplierFromCache } from "@/components/utils/suppliers";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradePrompt } from "@/components/plan/UpgradePrompt";

export default function SuppliersDialog({ open, onClose }) {
  const { can: canPlan } = usePlanLimits();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    contact_name: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    notes: "",
    external_links: [],
    active: true
  });

  useEffect(() => {
    if (open) {
      loadSuppliers();
    }
  }, [open]);

  const normalizeEntity = (payload) => {
    if (!payload) return null;
    if (payload.id || payload.name) return payload;
    if (payload.data && (payload.data.id || payload.data.name)) return payload.data;
    if (Array.isArray(payload.items) && payload.items[0]) return payload.items[0];
    if (Array.isArray(payload.data) && payload.data[0]) return payload.data[0];
    return null;
  };

  const buildSupplierPayload = (source = {}) => {
    const cleaned = {
      name: String(source.name || "").trim(),
      contact_name: String(source.contact_name || "").trim(),
      phone: String(source.phone || "").trim(),
      email: String(source.email || "").trim(),
      website: String(source.website || "").trim(),
      address: String(source.address || "").trim(),
      notes: String(source.notes || "").trim(),
      active: source.active !== false,
      payment_terms: "NET-30",
      currency: "USD",
    };

    return Object.fromEntries(
      Object.entries(cleaned).filter(([, value]) => value !== "")
    );
  };

  const toLocalSupplier = (source) => ({
    id: source?.id || `local-supplier-${Date.now()}`,
    name: source?.name || formData.name.trim(),
    contact_name: source?.contact_name || formData.contact_name || "",
    phone: source?.phone || formData.phone || "",
    email: source?.email || formData.email || "",
    website: source?.website || formData.website || "",
    address: source?.address || formData.address || "",
    notes: source?.notes || formData.notes || "",
    external_links: source?.external_links || formData.external_links || [],
    active: source?.active !== false
  });

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await loadSuppliersSafe();
      const next = Array.isArray(data) ? data : [];
      setSuppliers((prev) => {
        if (next.length > 0) return next;
        // Evita vaciar UI si backend responde vacío temporalmente.
        return prev || [];
      });
    } catch (error) {
      console.error("Error loading suppliers:", error);
      toast.warning("Sin conexión a proveedores. Mostrando datos guardados.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast.error("El nombre del proveedor es requerido");
      return;
    }
    if (!formData.phone?.trim()) {
      toast.error("El teléfono del proveedor es requerido");
      return;
    }

    setLoading(true);
    try {
      const payload = buildSupplierPayload(formData);
      if (editingSupplier) {
        const updatedPayload = await appClient.entities.Supplier.update(editingSupplier.id, payload);
        const updated = toLocalSupplier(normalizeEntity(updatedPayload) || { ...editingSupplier, ...formData, id: editingSupplier.id });
        setSuppliers((prev) => prev.map((s) => (s.id === editingSupplier.id ? { ...s, ...updated } : s)));
        upsertSupplierInCache(updated);
        toast.success("✅ Proveedor actualizado");
      } else {
        const createdPayload = await appClient.entities.Supplier.create(payload);
        const created = toLocalSupplier(normalizeEntity(createdPayload) || formData);
        setSuppliers((prev) => [created, ...prev.filter((s) => String(s.id) !== String(created.id))]);
        upsertSupplierInCache(created);
        toast.success("✅ Proveedor creado");
      }

      // Recarga silenciosa; si remoto viene vacío, mantiene lo actual.
      await loadSuppliers();
      resetForm();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error(error?.message || "Error al guardar proveedor");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || "",
      contact_name: supplier.contact_name || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      website: supplier.website || "",
      address: supplier.address || "",
      notes: supplier.notes || "",
      external_links: supplier.external_links || [],
      active: supplier.active !== false
    });
    setShowForm(true);
  };

  const handleDelete = async (supplier) => {
    if (!confirm(`¿Eliminar proveedor "${supplier.name}"?`)) return;

    setLoading(true);
    try {
      await appClient.entities.Supplier.delete(supplier.id);
      removeSupplierFromCache(supplier.id);
      toast.success("✅ Proveedor eliminado");
      await loadSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast.error("Error al eliminar proveedor");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingSupplier(null);
    setShowForm(false);
    setFormData({
      name: "",
      contact_name: "",
      phone: "",
      email: "",
      website: "",
      address: "",
      notes: "",
      external_links: [],
      active: true
    });
  };

  const addExternalLink = () => {
    setFormData({
      ...formData,
      external_links: [...(formData.external_links || []), ""]
    });
  };

  const updateExternalLink = (index, value) => {
    const links = [...(formData.external_links || [])];
    links[index] = value;
    setFormData({ ...formData, external_links: links });
  };

  const removeExternalLink = (index) => {
    const links = [...(formData.external_links || [])];
    links.splice(index, 1);
    setFormData({ ...formData, external_links: links });
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.contact_name?.toLowerCase().includes(term) ||
      s.phone?.includes(term) ||
      s.email?.toLowerCase().includes(term));

  });

  if (!canPlan('inventory_suppliers')) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-6 overflow-hidden max-w-md">
          <DialogHeader>
            <DialogTitle className="apple-text-headline apple-label-primary">Proveedores</DialogTitle>
          </DialogHeader>
          <UpgradePrompt feature="inventory_suppliers" message="Gestión de proveedores disponible en el plan Pro" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-6 overflow-hidden max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-2">
            <Globe className="w-6 h-6 text-apple-blue" />
            Gestión de Proveedores
          </DialogTitle>
        </DialogHeader>

        {!showForm ?
        <div className="space-y-4">
            {/* Search and Actions */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 apple-label-tertiary" />
                <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar proveedor..."
                className="apple-input pl-10" />

              </div>
              <Button
              type="button"
              onClick={() => setShowForm(true)}
              className="apple-btn apple-btn-primary">

                <Plus className="w-4 h-4 mr-2" />
                Nuevo Proveedor
              </Button>
            </div>

            {/* Suppliers List */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {loading ?
            <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-apple-blue animate-spin" />
                </div> :
            filteredSuppliers.length === 0 ?
            <div className="text-center py-12 apple-label-secondary apple-text-subheadline">
                  {searchTerm ? "No se encontraron proveedores" : "No hay proveedores registrados"}
                </div> :

            filteredSuppliers.map((supplier) =>
            <div
              key={supplier.id}
              className="apple-list-row apple-card p-4 transition-all">

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="apple-text-headline apple-label-primary truncate">
                            {supplier.name}
                          </h3>
                          {!supplier.active &&
                    <Badge className="bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary border-0">
                              Inactivo
                            </Badge>
                    }
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 apple-text-subheadline apple-label-secondary">
                          {supplier.contact_name &&
                    <div className="flex items-center gap-2">
                              <span className="font-medium">Contacto:</span> {supplier.contact_name}
                            </div>
                    }
                          {supplier.phone &&
                    <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4" />
                              {supplier.phone}
                            </div>
                    }
                          {supplier.email &&
                    <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4" />
                              {supplier.email}
                            </div>
                    }
                          {supplier.website &&
                    <a
                      href={supplier.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-apple-blue">

                              <Globe className="w-4 h-4" />
                              Website
                              <ExternalLink className="w-3 h-3" />
                            </a>
                    }
                        </div>

                        {supplier.external_links?.length > 0 &&
                  <div className="mt-3 flex flex-wrap gap-2">
                            {supplier.external_links.map((link, idx) =>
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="apple-text-caption1 px-2 py-1 bg-apple-green/15 text-apple-green border-0 rounded-apple-xs flex items-center gap-1">

                                Link {idx + 1}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                    )}
                          </div>
                  }
                      </div>

                      <div className="flex gap-2">
                        <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => handleEdit(supplier)} className="apple-btn apple-btn-secondary h-9 w-9"
                    disabled={supplier.is_virtual}
                    aria-label={`Editar proveedor ${supplier.name}`}
                    title={supplier.is_virtual ? "Proveedor detectado desde compras. Crea uno formal para editar." : "Editar proveedor"}>


                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => handleDelete(supplier)}
                    className="apple-btn apple-btn-destructive"
                    disabled={supplier.is_virtual}
                    aria-label={`Eliminar proveedor ${supplier.name}`}
                    title={supplier.is_virtual ? "Proveedor detectado desde compras. No se elimina desde aquí." : "Eliminar proveedor"}>

                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
            )
            }
            </div>
          </div> :

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="apple-text-subheadline apple-label-secondary mb-1 block">Nombre del Proveedor *</label>
                <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: MobilePartsPro"
                className="apple-input" />

              </div>

              <div>
                <label className="apple-text-subheadline apple-label-secondary mb-1 block">Persona de Contacto</label>
                <Input
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Nombre del contacto"
                className="apple-input" />

              </div>

              <div>
                <label className="apple-text-subheadline apple-label-secondary mb-1 block">Teléfono</label>
                <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(787) 123-4567"
                className="apple-input" />

              </div>

              <div>
                <label className="apple-text-subheadline apple-label-secondary mb-1 block">Email</label>
                <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contacto@proveedor.com"
                className="apple-input" />

              </div>

              <div className="md:col-span-2">
                <label className="apple-text-subheadline apple-label-secondary mb-1 block">Sitio Web</label>
                <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://www.proveedor.com"
                className="apple-input" />

              </div>

              <div className="md:col-span-2">
                <label className="apple-text-subheadline apple-label-secondary mb-1 block">Dirección</label>
                <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Calle, Ciudad, Estado, ZIP"
                className="apple-input" />

              </div>

              <div className="md:col-span-2">
                <label className="apple-text-subheadline apple-label-secondary mb-1 block">Notas</label>
                <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales..."
                className="apple-input"
                rows={3} />

              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="apple-text-subheadline apple-label-secondary">Enlaces Externos (Catálogos)</label>
                  <Button
                  type="button"
                  size="sm"
                  onClick={addExternalLink}
                  className="apple-btn apple-btn-primary bg-apple-green">

                    <Plus className="w-3 h-3 mr-1" />
                    Añadir Link
                  </Button>
                </div>
                <div className="space-y-2">
                  {formData.external_links?.map((link, idx) =>
                <div key={idx} className="flex gap-2">
                      <Input
                    value={link}
                    onChange={(e) => updateExternalLink(idx, e.target.value)}
                    placeholder="https://..."
                    className="apple-input flex-1" />

                      <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => removeExternalLink(idx)}
                    aria-label="Eliminar enlace externo"
                    className="apple-btn apple-btn-destructive">

                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 apple-label-secondary cursor-pointer">
                  <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-black/20" />

                  <span className="text-sm">Proveedor activo</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
              <Button
              type="button"
              onClick={resetForm}
              variant="outline" className="apple-btn apple-btn-secondary flex-1"

              disabled={loading}>

                Cancelar
              </Button>
              <Button
              type="button"
              onClick={handleSave}
              disabled={loading || !formData.name?.trim()}
              className="apple-btn apple-btn-primary flex-1">

                {loading ?
              <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Guardando...
                  </> :

              <>
                    {editingSupplier ? "Actualizar" : "Crear"} Proveedor
                  </>
              }
              </Button>
            </div>
          </div>
        }
      </DialogContent>
    </Dialog>);

}
