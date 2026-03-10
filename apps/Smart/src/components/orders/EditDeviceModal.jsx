import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { dataClient } from "@/components/api/dataClient";

export default function EditDeviceModal({ open, order, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    device_type: order?.device_type || "",
    device_brand: order?.device_brand || "",
    device_family: order?.device_family || "",
    device_model: order?.device_model || "",
    device_subcategory: order?.device_subcategory || "",
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await dataClient.entities.Order.update(order.id, formData);
      toast.success("✅ Equipo actualizado");
      onUpdate({ ...order, ...formData });
      onClose();
    } catch (error) {
      console.error("Error actualizando equipo:", error);
      toast.error("Error al actualizar equipo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 to-slate-950 border border-cyan-500/20">
        <DialogHeader>
          <DialogTitle className="text-white">Modificar Equipo</DialogTitle>
          <DialogDescription className="text-slate-400">
            Actualiza los datos del dispositivo para #{order?.order_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-white mb-1 block">Tipo de Equipo</label>
            <Input
              value={formData.device_type}
              onChange={(e) => handleChange("device_type", e.target.value)}
              placeholder="Ej: Smartphone, Tablet, Laptop..."
              className="bg-slate-800/50 border-slate-600/50 text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white mb-1 block">Marca</label>
            <Input
              value={formData.device_brand}
              onChange={(e) => handleChange("device_brand", e.target.value)}
              placeholder="Ej: Apple, Samsung, Lenovo..."
              className="bg-slate-800/50 border-slate-600/50 text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white mb-1 block">Familia</label>
            <Input
              value={formData.device_family}
              onChange={(e) => handleChange("device_family", e.target.value)}
              placeholder="Ej: iPhone, Galaxy S, MacBook..."
              className="bg-slate-800/50 border-slate-600/50 text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white mb-1 block">Modelo</label>
            <Input
              value={formData.device_model}
              onChange={(e) => handleChange("device_model", e.target.value)}
              placeholder="Ej: iPhone 15 Pro, Galaxy S24..."
              className="bg-slate-800/50 border-slate-600/50 text-white placeholder-slate-500"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-white mb-1 block">Subcategoría</label>
            <Input
              value={formData.device_subcategory}
              onChange={(e) => handleChange("device_subcategory", e.target.value)}
              placeholder="Ej: Smartphone, Smartwatch, Accesorio..."
              className="bg-slate-800/50 border-slate-600/50 text-white placeholder-slate-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-slate-600/50 text-white hover:bg-slate-800/50"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              "Guardar cambios"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
