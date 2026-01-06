import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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

export default function SuppliersDialog({ open, onClose }) {
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

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Supplier.list("-created_date");
      setSuppliers(data || []);
    } catch (error) {
      console.error("Error loading suppliers:", error);
      toast.error("Error al cargar proveedores");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast.error("El nombre del proveedor es requerido");
      return;
    }

    setLoading(true);
    try {
      if (editingSupplier) {
        await base44.entities.Supplier.update(editingSupplier.id, formData);
        toast.success("✅ Proveedor actualizado");
      } else {
        await base44.entities.Supplier.create(formData);
        toast.success("✅ Proveedor creado");
      }

      await loadSuppliers();
      resetForm();
    } catch (error) {
      console.error("Error saving supplier:", error);
      toast.error("Error al guardar proveedor");
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
      await base44.entities.Supplier.delete(supplier.id);
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] bg-[#0f0f10] border border-cyan-500/20 text-white shadow-[0_24px_80px_rgba(0,168,232,0.7)] theme-light:bg-white theme-light:border-gray-200 theme-light:text-gray-900">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold flex items-center gap-2 theme-light:text-gray-900">
            <Globe className="w-6 h-6 text-cyan-500 theme-light:text-cyan-600" />
            Gestión de Proveedores
          </DialogTitle>
        </DialogHeader>

        {!showForm ?
        <div className="space-y-4">
            {/* Search and Actions */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 theme-light:text-gray-500" />
                <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar proveedor..."
                className="pl-10 bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />

              </div>
              <Button
              type="button"
              onClick={() => setShowForm(true)}
              className="bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800 shadow-[0_4px_16px_rgba(0,168,232,0.4)]">

                <Plus className="w-4 h-4 mr-2" />
                Nuevo Proveedor
              </Button>
            </div>

            {/* Suppliers List */}
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {loading ?
            <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                </div> :
            filteredSuppliers.length === 0 ?
            <div className="text-center py-12 text-gray-400 theme-light:text-gray-600">
                  {searchTerm ? "No se encontraron proveedores" : "No hay proveedores registrados"}
                </div> :

            filteredSuppliers.map((supplier) =>
            <div
              key={supplier.id}
              className="bg-black/40 border border-white/10 rounded-lg p-4 hover:border-cyan-600/40 transition-all theme-light:bg-white theme-light:border-gray-200 theme-light:hover:border-cyan-500/50">

                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-white truncate theme-light:text-gray-900">
                            {supplier.name}
                          </h3>
                          {!supplier.active &&
                    <Badge className="bg-gray-600/20 text-gray-400 border-gray-600/30 theme-light:bg-gray-100 theme-light:text-gray-600 theme-light:border-gray-300">
                              Inactivo
                            </Badge>
                    }
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-400 theme-light:text-gray-600">
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
                      className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 theme-light:text-cyan-600 theme-light:hover:text-cyan-700">

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
                      className="text-xs px-2 py-1 bg-emerald-600/20 text-emerald-300 border border-emerald-600/30 rounded hover:bg-emerald-600/30 flex items-center gap-1 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300">

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
                    onClick={() => handleEdit(supplier)} className="bg-background text-slate-900 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-9 w-9 border-white/15 hover:bg-white/5 theme-light:border-gray-300 theme-light:hover:bg-gray-100">


                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => handleDelete(supplier)}
                    className="border-cyan-600/30 text-cyan-400 hover:bg-cyan-600/20 theme-light:border-cyan-500 theme-light:text-cyan-600 theme-light:hover:bg-cyan-50">

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
                <label className="text-sm text-gray-300 mb-1 block theme-light:text-gray-700">Nombre del Proveedor *</label>
                <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: MobilePartsPro"
                className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />

              </div>

              <div>
                <label className="text-sm text-gray-300 mb-1 block theme-light:text-gray-700">Persona de Contacto</label>
                <Input
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Nombre del contacto"
                className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />

              </div>

              <div>
                <label className="text-sm text-gray-300 mb-1 block theme-light:text-gray-700">Teléfono</label>
                <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(787) 123-4567"
                className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />

              </div>

              <div>
                <label className="text-sm text-gray-300 mb-1 block theme-light:text-gray-700">Email</label>
                <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contacto@proveedor.com"
                className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />

              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-gray-300 mb-1 block theme-light:text-gray-700">Sitio Web</label>
                <Input
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://www.proveedor.com"
                className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />

              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-gray-300 mb-1 block theme-light:text-gray-700">Dirección</label>
                <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Calle, Ciudad, Estado, ZIP"
                className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300" />

              </div>

              <div className="md:col-span-2">
                <label className="text-sm text-gray-300 mb-1 block theme-light:text-gray-700">Notas</label>
                <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionales..."
                className="bg-black/20 border-white/10 theme-light:bg-white theme-light:border-gray-300"
                rows={3} />

              </div>

              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-gray-300 theme-light:text-gray-700">Enlaces Externos (Catálogos)</label>
                  <Button
                  type="button"
                  size="sm"
                  onClick={addExternalLink}
                  className="bg-gradient-to-r from-emerald-600 to-lime-600 hover:from-emerald-700 hover:to-lime-700">

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
                    className="bg-black/20 border-white/10 flex-1 theme-light:bg-white theme-light:border-gray-300" />

                      <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => removeExternalLink(idx)}
                    className="border-cyan-600/30 text-cyan-400 hover:bg-cyan-600/20 theme-light:border-cyan-500 theme-light:text-cyan-600 theme-light:hover:bg-cyan-50">

                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-gray-300 cursor-pointer theme-light:text-gray-700">
                  <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-600 bg-black/20" />

                  <span className="text-sm">Proveedor activo</span>
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/10 theme-light:border-gray-200">
              <Button
              type="button"
              onClick={resetForm}
              variant="outline"
              className="flex-1 border-white/15 hover:bg-white/5 theme-light:border-gray-300 theme-light:text-gray-700 theme-light:hover:bg-gray-100"
              disabled={loading}>

                Cancelar
              </Button>
              <Button
              type="button"
              onClick={handleSave}
              disabled={loading || !formData.name?.trim()}
              className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800 shadow-[0_4px_16px_rgba(0,168,232,0.4)]">

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
