import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Trash2, Edit2, Save, X, Smartphone, Monitor, Box, Wrench, Battery } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const ICON_OPTIONS = [
"Smartphone", "Tablet", "Laptop", "Monitor", "Watch",
"Headphones", "Speaker", "Camera", "Gamepad", "Box"];


const PART_ICON_OPTIONS = [
"Monitor", "Battery", "Wrench", "Box", "Cpu",
"HardDrive", "Wifi", "Cable", "Speaker", "Camera"];


export default function ManageCategoriesDialog({ open, onClose, onUpdate }) {
  const [deviceCategories, setDeviceCategories] = useState([]);
  const [partTypes, setPartTypes] = useState([]);
  const [accessoryCategories, setAccessoryCategories] = useState([]);
  const [editingDevice, setEditingDevice] = useState(null);
  const [editingPart, setEditingPart] = useState(null);
  const [editingAccessory, setEditingAccessory] = useState(null);
  const [newDeviceForm, setNewDeviceForm] = useState({ name: "", slug: "", icon_name: "Smartphone" });
  const [newPartForm, setNewPartForm] = useState({ name: "", slug: "", icon_name: "Monitor" });
  const [newAccessoryForm, setNewAccessoryForm] = useState({ name: "", slug: "", icon_name: "Box" });
  const [saving, setSaving] = useState(false);

  const norm = (v) => String(v || "").trim().toLowerCase();

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  const loadData = async () => {
    try {
      const [cats, parts, accs] = await Promise.all([
      base44.entities.DeviceCategory.list(),
      base44.entities.PartType.list(),
      base44.entities.AccessoryCategory?.list() ?? []]
      );
      setDeviceCategories(cats || []);
      setPartTypes(parts || []);
      setAccessoryCategories(accs || []);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const handleAddDeviceCategory = async () => {
    if (!newDeviceForm.name || !newDeviceForm.slug || saving) {
      toast.error("Completa nombre y slug");
      return;
    }
    if (deviceCategories.some((c) => norm(c.name) === norm(newDeviceForm.name) || norm(c.slug || c.icon) === norm(newDeviceForm.slug))) {
      toast.warning("Esa categoría ya existe");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.DeviceCategory.create({
        name: newDeviceForm.name,
        icon: newDeviceForm.slug,
        icon_name: newDeviceForm.icon_name,
        active: true,
        order: deviceCategories.length
      });
      setNewDeviceForm({ name: "", slug: "", icon_name: "Smartphone" });
      await loadData();
      onUpdate?.();
      toast.success("Categoría creada");
    } catch (error) {
      console.error("Error creating category:", error);
      toast.error("Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPartType = async () => {
    if (!newPartForm.name || !newPartForm.slug || saving) {
      toast.error("Completa nombre y slug");
      return;
    }
    if (partTypes.some((p) => norm(p.name) === norm(newPartForm.name) || norm(p.slug) === norm(newPartForm.slug))) {
      toast.warning("Ese tipo de pieza ya existe");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.PartType.create({
        name: newPartForm.name,
        slug: newPartForm.slug,
        icon_name: newPartForm.icon_name,
        active: true,
        order: partTypes.length
      });
      setNewPartForm({ name: "", slug: "", icon_name: "Monitor" });
      await loadData();
      onUpdate?.();
      toast.success("Tipo de pieza creado");
    } catch (error) {
      console.error("Error creating part type:", error);
      toast.error("Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = async (id) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try {
      await base44.entities.DeviceCategory.delete(id);
      await loadData();
      onUpdate?.();
      toast.success("Eliminado");
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Error al eliminar");
    }
  };

  const handleDeletePart = async (id) => {
    if (!confirm("¿Eliminar este tipo de pieza?")) return;
    try {
      await base44.entities.PartType.delete(id);
      await loadData();
      onUpdate?.();
      toast.success("Eliminado");
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Error al eliminar");
    }
  };

  const handleUpdateDevice = async (item) => {
    try {
      await base44.entities.DeviceCategory.update(item.id, item);
      setEditingDevice(null);
      await loadData();
      onUpdate?.();
      toast.success("Actualizado");
    } catch (error) {
      console.error("Error updating:", error);
      toast.error("Error al actualizar");
    }
  };

  const handleUpdatePart = async (item) => {
    try {
      await base44.entities.PartType.update(item.id, item);
      setEditingPart(null);
      await loadData();
      onUpdate?.();
      toast.success("Actualizado");
    } catch (error) {
      console.error("Error updating:", error);
      toast.error("Error al actualizar");
    }
  };

  const handleAddAccessoryCategory = async () => {
    if (!newAccessoryForm.name || !newAccessoryForm.slug || saving) {
      toast.error("Completa nombre y slug");
      return;
    }
    if (accessoryCategories.some((a) => norm(a.name) === norm(newAccessoryForm.name) || norm(a.slug) === norm(newAccessoryForm.slug))) {
      toast.warning("Esa categoría de accesorio ya existe");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.AccessoryCategory.create({
        name: newAccessoryForm.name,
        slug: newAccessoryForm.slug,
        icon_name: newAccessoryForm.icon_name,
        active: true,
        order: accessoryCategories.length
      });
      setNewAccessoryForm({ name: "", slug: "", icon_name: "Box" });
      await loadData();
      onUpdate?.();
      toast.success("Categoría de accesorio creada");
    } catch (error) {
      console.error("Error creating accessory category:", error);
      toast.error("Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccessory = async (id) => {
    if (!confirm("¿Eliminar esta categoría de accesorio?")) return;
    try {
      await base44.entities.AccessoryCategory.delete(id);
      await loadData();
      onUpdate?.();
      toast.success("Eliminado");
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Error al eliminar");
    }
  };

  const handleUpdateAccessory = async (item) => {
    try {
      await base44.entities.AccessoryCategory.update(item.id, item);
      setEditingAccessory(null);
      await loadData();
      onUpdate?.();
      toast.success("Actualizado");
    } catch (error) {
      console.error("Error updating:", error);
      toast.error("Error al actualizar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-6 overflow-y-auto max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-apple-blue" />
            Gestionar Categorías y Tipos
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="devices" className="space-y-4">
          <div className="overflow-x-auto pb-1">
            <TabsList className="apple-card w-full grid grid-cols-4 gap-1 p-1">
              <TabsTrigger value="devices" className="data-[state=active]:bg-apple-blue data-[state=active]:text-white apple-text-subheadline px-2 sm:px-3 whitespace-nowrap">
                <Smartphone className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Dispositivos</span>
              </TabsTrigger>
              <TabsTrigger value="parts" className="data-[state=active]:bg-apple-green data-[state=active]:text-white apple-text-subheadline px-2 sm:px-3 whitespace-nowrap">
                <Wrench className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Piezas</span>
              </TabsTrigger>
              <TabsTrigger value="accessories" className="data-[state=active]:bg-apple-purple data-[state=active]:text-white apple-text-subheadline px-2 sm:px-3 whitespace-nowrap">
                <Box className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Accesorios</span>
              </TabsTrigger>
              <TabsTrigger value="services" className="data-[state=active]:bg-apple-orange data-[state=active]:text-white apple-text-subheadline px-2 sm:px-3 whitespace-nowrap">
                <Wrench className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Servicios</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="devices" className="space-y-6">
            {/* Información sobre subcategorías */}
            <div className="bg-apple-blue/12 rounded-apple-md p-4">
              <p className="text-apple-blue font-semibold apple-text-subheadline mb-2">Estructura de Dispositivos</p>
              <div className="apple-text-caption1 apple-label-secondary space-y-1">
                <p>• <strong>Dispositivo Completo:</strong> Para vender equipos completos (celular, tablet, laptop)</p>
                <p>• <strong>Piezas/Servicios:</strong> Para vender partes y reparaciones</p>
                <p className="mt-2 apple-label-tertiary">Las subcategorías se gestionan automáticamente al crear productos</p>
              </div>
            </div>

            {/* Crear nueva categoría */}
            <div className="bg-apple-blue/12 rounded-apple-md p-4 space-y-3">
              <p className="text-apple-blue font-semibold apple-text-subheadline">Nueva Categoría de Dispositivo</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  value={newDeviceForm.name}
                  onChange={(e) => setNewDeviceForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre (ej: iPhone)"
                  className="apple-input" />

                <Input
                  value={newDeviceForm.slug}
                  onChange={(e) => setNewDeviceForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="ID único (ej: iphone)"
                  className="apple-input" />

              </div>
              <Button onClick={handleAddDeviceCategory} className="apple-btn apple-btn-primary w-full">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Categoría de Dispositivo
              </Button>
            </div>

            {/* Lista de categorías */}
            <div className="space-y-2">
              {deviceCategories.map((cat) =>
              <div key={cat.id} className="apple-card p-4">
                  {editingDevice?.id === cat.id ?
                <div className="space-y-3">
                      <Input
                    value={editingDevice.name}
                    onChange={(e) => setEditingDevice((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Nombre de la categoría"
                    className="apple-input" />

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdateDevice(editingDevice)} className="apple-btn apple-btn-primary bg-apple-green">
                          <Save className="w-4 h-4 mr-1" />
                          Guardar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingDevice(null)} className="bg-background text-slate-900 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground h-8 border-white/15">
                          <X className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div> :

                <div className="flex items-center justify-between">
                      <div>
                        <p className="apple-label-primary apple-text-subheadline font-semibold">{cat.name}</p>
                        <p className="apple-text-caption1 apple-label-tertiary">ID: {cat.icon || cat.slug}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingDevice(cat)} className="apple-btn apple-btn-plain text-apple-blue">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteDevice(cat.id)} className="apple-btn apple-btn-plain text-apple-red">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                }
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="parts" className="space-y-6">
            {/* Información sobre tipos de piezas */}
            <div className="bg-apple-purple/12 rounded-apple-md p-4">
              <p className="text-apple-purple font-semibold apple-text-subheadline mb-2">Tipos de Piezas/Servicios</p>
              <div className="apple-text-caption1 apple-label-secondary space-y-1">
                <p>• <strong>Pantallas:</strong> Para pantallas de cualquier dispositivo</p>
                <p>• <strong>Baterías:</strong> Para baterías de reemplazo</p>
                <p>• <strong>Servicios:</strong> Para reparaciones y servicios</p>
                <p>• <strong>Otros:</strong> Para cualquier otra pieza o accesorio</p>
              </div>
            </div>

            {/* Crear nuevo tipo */}
            <div className="bg-apple-green/12 rounded-apple-md p-4 space-y-3">
              <p className="text-apple-green font-semibold apple-text-subheadline">Nuevo Tipo de Pieza/Servicio</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  value={newPartForm.name}
                  onChange={(e) => setNewPartForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre (ej: Pantallas)"
                  className="apple-input" />

                <Input
                  value={newPartForm.slug}
                  onChange={(e) => setNewPartForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="ID único (ej: pantalla)"
                  className="apple-input" />

              </div>
              <Button onClick={handleAddPartType} className="apple-btn apple-btn-primary bg-apple-green w-full">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Tipo de Pieza
              </Button>
            </div>

            {/* Lista de tipos */}
            <div className="space-y-2">
              {partTypes.map((pt) =>
              <div key={pt.id} className="apple-card p-4">
                  {editingPart?.id === pt.id ?
                <div className="space-y-3">
                      <Input
                    value={editingPart.name}
                    onChange={(e) => setEditingPart((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Nombre del tipo de pieza"
                    className="apple-input" />

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdatePart(editingPart)} className="apple-btn apple-btn-primary bg-apple-green">
                          <Save className="w-4 h-4 mr-1" />
                          Guardar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingPart(null)} className="bg-background text-slate-900 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground h-8 border-white/15">
                          <X className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div> :

                <div className="flex items-center justify-between">
                      <div>
                        <p className="apple-label-primary apple-text-subheadline font-semibold">{pt.name}</p>
                        <p className="apple-text-caption1 apple-label-tertiary">ID: {pt.slug}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingPart(pt)} className="apple-btn apple-btn-plain text-apple-green">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeletePart(pt.id)} className="apple-btn apple-btn-plain text-apple-red">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                }
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="accessories" className="space-y-6">
            {/* Información sobre accesorios */}
            <div className="bg-apple-red/12 rounded-apple-md p-4">
              <p className="text-apple-red font-semibold apple-text-subheadline mb-2">Categorías de Accesorios</p>
              <div className="apple-text-caption1 apple-label-secondary space-y-1">
                <p>• <strong>Cables:</strong> Para cables USB, Lightning, USB-C, etc.</p>
                <p>• <strong>Covers/Fundas:</strong> Para fundas, cases, protectores de dispositivos</p>
                <p>• <strong>Protectores:</strong> Para micas, vidrios templados, etc.</p>
                <p>• <strong>Otros:</strong> Para cualquier otro accesorio</p>
              </div>
            </div>

            {/* Crear nueva categoría de accesorio */}
            <div className="bg-apple-purple/12 rounded-apple-md p-4 space-y-3">
              <p className="text-apple-purple font-semibold apple-text-subheadline">Nueva Categoría de Accesorio</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  value={newAccessoryForm.name}
                  onChange={(e) => setNewAccessoryForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre (ej: Cables)"
                  className="apple-input" />

                <Input
                  value={newAccessoryForm.slug}
                  onChange={(e) => setNewAccessoryForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="ID único (ej: cables)"
                  className="apple-input" />

              </div>
              <Button onClick={handleAddAccessoryCategory} className="apple-btn apple-btn-primary bg-apple-purple w-full">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Categoría de Accesorio
              </Button>
            </div>

            {/* Lista de categorías de accesorios */}
            <div className="space-y-2">
              {accessoryCategories.map((acc) =>
              <div key={acc.id} className="apple-card p-4">
                  {editingAccessory?.id === acc.id ?
                <div className="space-y-3">
                      <Input
                    value={editingAccessory.name}
                    onChange={(e) => setEditingAccessory((a) => ({ ...a, name: e.target.value }))}
                    placeholder="Nombre de la categoría"
                    className="apple-input" />

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdateAccessory(editingAccessory)} className="apple-btn apple-btn-primary bg-apple-purple">
                          <Save className="w-4 h-4 mr-1" />
                          Guardar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingAccessory(null)} className="border-white/15">
                          <X className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div> :

                <div className="flex items-center justify-between">
                      <div>
                        <p className="apple-label-primary apple-text-subheadline font-semibold">{acc.name}</p>
                        <p className="apple-text-caption1 apple-label-tertiary">ID: {acc.slug}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingAccessory(acc)} className="apple-btn apple-btn-plain text-apple-purple">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteAccessory(acc.id)} className="apple-btn apple-btn-plain text-apple-red">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                }
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="services" className="space-y-6">
            {/* Información sobre servicios */}
            <div className="bg-apple-orange/12 rounded-apple-md p-4">
              <p className="text-apple-orange font-semibold apple-text-subheadline mb-2">Categorías Compartidas</p>
              <div className="apple-text-caption1 apple-label-secondary space-y-1">
                <p>Los Servicios comparten las mismas <strong>Categorías de Dispositivo</strong> que los Productos.</p>
                <p>Aquí puedes gestionar las categorías de dispositivos (ej: Smartphone, Laptop) que se usarán tanto para inventario como para servicios.</p>
              </div>
            </div>

            {/* Reutilizar gestión de categorías de dispositivo */}
            <div className="bg-apple-blue/12 rounded-apple-md p-4 space-y-3">
              <p className="text-apple-blue font-semibold apple-text-subheadline">Nueva Categoría de Dispositivo</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  value={newDeviceForm.name}
                  onChange={(e) => setNewDeviceForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Nombre (ej: Consola)"
                  className="apple-input" />

                <Input
                  value={newDeviceForm.slug}
                  onChange={(e) => setNewDeviceForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="ID único (ej: consola)"
                  className="apple-input" />

              </div>
              <Button onClick={handleAddDeviceCategory} className="apple-btn apple-btn-primary w-full">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Categoría
              </Button>
            </div>

            {/* Lista de categorías (misma lista que en dispositivos) */}
            <div className="space-y-2">
              {deviceCategories.map((cat) =>
              <div key={cat.id} className="apple-card p-4">
                  {editingDevice?.id === cat.id ?
                <div className="space-y-3">
                      <Input
                    value={editingDevice.name}
                    onChange={(e) => setEditingDevice((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Nombre de la categoría"
                    className="apple-input" />

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleUpdateDevice(editingDevice)} className="apple-btn apple-btn-primary bg-apple-green">
                          <Save className="w-4 h-4 mr-1" />
                          Guardar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingDevice(null)} className="bg-background text-slate-900 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:bg-accent hover:text-accent-foreground h-8 border-white/15">
                          <X className="w-4 h-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div> :

                <div className="flex items-center justify-between">
                      <div>
                        <p className="apple-label-primary apple-text-subheadline font-semibold">{cat.name}</p>
                        <p className="apple-text-caption1 apple-label-tertiary">ID: {cat.icon || cat.slug}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingDevice(cat)} className="apple-btn apple-btn-plain text-apple-blue">
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteDevice(cat.id)} className="apple-btn apple-btn-plain text-apple-red">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                }
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>);

}
