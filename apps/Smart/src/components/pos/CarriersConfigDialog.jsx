import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";
import { Settings, Plus, Trash2, Edit2, Check, X } from "lucide-react";

export default function CarriersConfigDialog({ open, onClose, onSave }) {
  const [carriers, setCarriers] = useState([
    { name: "Claro", tint: "red", icon: "📱", active: true },
    { name: "T-Mobile", tint: "red", icon: "📞", active: true },
    { name: "AT&T", tint: "blue", icon: "📲", active: true },
    { name: "Liberty", tint: "orange", icon: "📳", active: true },
    { name: "Boost", tint: "green", icon: "🚀", active: true },
    { name: "Cricket", tint: "green", icon: "🦗", active: true },
    { name: "Metro", tint: "purple", icon: "🚇", active: true },
    { name: "Simple Mobile", tint: "blue", icon: "📱", active: true },
    { name: "Ultra Mobile", tint: "indigo", icon: "💎", active: true },
    { name: "H2O", tint: "blue", icon: "💧", active: true },
  ]);
  const [editIndex, setEditIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) loadCarriers();
  }, [open]);

  const loadCarriers = async () => {
    try {
      const configs = await dataClient.entities.SystemConfig.filter({ key: "recharge.carriers" });
      if (configs?.length) {
        const saved = JSON.parse(configs[0].value);
        setCarriers(saved);
      }
    } catch (error) {
      console.error("Error loading carriers:", error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const configs = await dataClient.entities.SystemConfig.filter({ key: "recharge.carriers" });

      if (configs?.length) {
        await dataClient.entities.SystemConfig.update(configs[0].id, {
          value: JSON.stringify(carriers)
        });
      } else {
        await dataClient.entities.SystemConfig.create({
          key: "recharge.carriers",
          value: JSON.stringify(carriers),
          category: "general",
          description: "Configuración de carriers para recargas"
        });
      }

      toast.success("✅ Carriers guardados");
      onSave?.(carriers);
      onClose();
    } catch (error) {
      console.error("Error saving carriers:", error);
      toast.error("Error guardando carriers");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (index) => {
    const updated = [...carriers];
    updated[index].active = !updated[index].active;
    setCarriers(updated);
  };

  const startEdit = (index) => {
    setEditIndex(index);
    setEditName(carriers[index].name);
    setEditIcon(carriers[index].icon);
  };

  const saveEdit = () => {
    if (!editName.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    const updated = [...carriers];
    updated[editIndex].name = editName.trim();
    updated[editIndex].icon = editIcon || "📱";
    setCarriers(updated);
    setEditIndex(null);
    setEditName("");
    setEditIcon("");
    toast.success("Carrier actualizado");
  };

  const cancelEdit = () => {
    setEditIndex(null);
    setEditName("");
    setEditIcon("");
  };

  const removeCarrier = (index) => {
    if (!confirm(`¿Eliminar "${carriers[index].name}"?`)) return;
    const updated = carriers.filter((_, i) => i !== index);
    setCarriers(updated);
    toast.success("Carrier eliminado");
  };

  const addCarrier = () => {
    setCarriers([...carriers, {
      name: "Nuevo Carrier",
      tint: "blue",
      icon: "📱",
      active: true
    }]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-6 overflow-hidden max-w-2xl max-h-[90vh] flex flex-col z-[300]">
        <DialogHeader>
          <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-2">
            <Settings className="w-6 h-6 text-apple-blue" />
            Gestión de Compañías
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {carriers.map((carrier, index) => (
            <div
              key={index}
              className={`apple-card p-4 transition-all ${
                carrier.active ? "" : "opacity-50"
              }`}
            >
              {editIndex === index ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={editIcon}
                      onChange={(e) => setEditIcon(e.target.value)}
                      className="apple-input w-16 text-center apple-text-title2"
                      placeholder="📱"
                      maxLength={2}
                    />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="apple-input flex-1"
                      placeholder="Nombre del carrier"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={saveEdit}
                      size="sm"
                      className="apple-btn apple-btn-primary bg-apple-green flex-1"
                    >
                      <Check className="w-4 h-4 mr-1" /> Guardar
                    </Button>
                    <Button
                      onClick={cancelEdit}
                      size="sm"
                      variant="outline"
                      className="apple-btn apple-btn-secondary flex-1"
                    >
                      <X className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{carrier.icon}</span>
                    <div>
                      <h4 className="apple-label-primary apple-text-subheadline font-semibold">{carrier.name}</h4>
                      {!carrier.active && (
                        <span className="apple-text-caption1 apple-label-tertiary">Desactivado</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(index)}
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        carrier.active ? "bg-apple-green" : "bg-gray-sys5"
                      }`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        carrier.active ? "right-0.5" : "left-0.5"
                      }`} />
                    </button>
                    <Button
                      onClick={() => startEdit(index)}
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar carrier ${carrier.name}`}
                      className="apple-btn apple-btn-plain text-apple-blue h-8 w-8"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => removeCarrier(index)}
                      size="icon"
                      variant="ghost"
                      aria-label={`Eliminar carrier ${carrier.name}`}
                      className="apple-btn apple-btn-plain text-apple-red h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-4" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <Button
            onClick={addCarrier}
            variant="outline"
            className="apple-btn apple-btn-tinted flex-1"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Carrier
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="apple-btn apple-btn-primary flex-1"
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
