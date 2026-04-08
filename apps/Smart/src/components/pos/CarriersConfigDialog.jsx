import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";
import { Settings, Plus, Trash2, Edit2, Check, X } from "lucide-react";

export default function CarriersConfigDialog({ open, onClose, onSave }) {
  const [carriers, setCarriers] = useState([
    { name: "Claro", color: "from-red-600 to-red-800", icon: "📱", active: true },
    { name: "T-Mobile", color: "from-pink-600 to-pink-800", icon: "📞", active: true },
    { name: "AT&T", color: "from-blue-600 to-blue-800", icon: "📲", active: true },
    { name: "Liberty", color: "from-orange-600 to-orange-800", icon: "📳", active: true },
    { name: "Boost", color: "from-green-600 to-green-800", icon: "🚀", active: true },
    { name: "Cricket", color: "from-lime-600 to-lime-800", icon: "🦗", active: true },
    { name: "Metro", color: "from-purple-600 to-purple-800", icon: "🚇", active: true },
    { name: "Simple Mobile", color: "from-cyan-600 to-cyan-800", icon: "📱", active: true },
    { name: "Ultra Mobile", color: "from-indigo-600 to-indigo-800", icon: "💎", active: true },
    { name: "H2O", color: "from-blue-500 to-blue-700", icon: "💧", active: true },
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
      color: "from-gray-600 to-gray-800",
      icon: "📱",
      active: true
    }]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#020617] border border-cyan-500/30 max-w-2xl text-white max-h-[90vh] overflow-hidden flex flex-col z-[300]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-cyan-400" />
            Gestión de Compañías
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {carriers.map((carrier, index) => (
            <div
              key={index}
              className={`bg-black/40 border rounded-xl p-4 transition-all ${
                carrier.active ? "border-white/10" : "border-white/5 opacity-50"
              }`}
            >
              {editIndex === index ? (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      value={editIcon}
                      onChange={(e) => setEditIcon(e.target.value)}
                      className="w-16 text-center text-2xl bg-black/30 border-white/10"
                      placeholder="📱"
                      maxLength={2}
                    />
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-black/30 border-white/10 text-white"
                      placeholder="Nombre del carrier"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={saveEdit}
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500"
                    >
                      <Check className="w-4 h-4 mr-1" /> Guardar
                    </Button>
                    <Button
                      onClick={cancelEdit}
                      size="sm"
                      variant="outline"
                      className="flex-1 border-white/20"
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
                      <h4 className="text-white font-semibold">{carrier.name}</h4>
                      {!carrier.active && (
                        <span className="text-xs text-gray-500">Desactivado</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(index)}
                      className={`w-12 h-6 rounded-full transition-all relative ${
                        carrier.active ? "bg-emerald-600" : "bg-gray-700"
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
                      className="text-cyan-400 hover:text-cyan-300 h-8 w-8"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => removeCarrier(index)}
                      size="icon"
                      variant="ghost"
                      aria-label={`Eliminar carrier ${carrier.name}`}
                      className="text-red-400 hover:text-red-300 h-8 w-8"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-4 border-t border-white/10">
          <Button
            onClick={addCarrier}
            variant="outline"
            className="flex-1 border-cyan-500/30 text-cyan-400"
          >
            <Plus className="w-4 h-4 mr-2" />
            Agregar Carrier
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-600"
          >
            {saving ? "Guardando..." : "Guardar Cambios"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
