import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Shield, Save, X } from "lucide-react";
import { toast } from "sonner";

export function WarrantySalesModal({ isOpen, onClose, currentText, onSave }) {
  const initialData = typeof currentText === 'object' ? currentText : { text: currentText || "", duration: "" };
  const [text, setText] = useState(initialData.text || "");
  const [duration, setDuration] = useState(initialData.duration || "");

  const handleSave = () => {
    if (!text.trim()) {
      toast.error("Escribe los términos de garantía");
      return;
    }
    onSave({ text: text.trim(), duration: duration.trim() });
    toast.success("Garantía por Venta guardada");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-[#1c1c1e] to-black/90 border border-white/20 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            Garantía por Venta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          <div className="space-y-2">
            <label className="text-white/70 text-sm font-semibold">Duración (opcional)</label>
            <Input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Ej: 30 días, 90 días, 1 año"
              className="bg-white/5 border-white/10 text-white rounded-xl h-12"
            />
            <p className="text-xs text-gray-400">Si varía por producto, déjalo vacío</p>
          </div>

          <div className="space-y-2">
            <label className="text-white/70 text-sm font-semibold">Términos de Garantía *</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escribe los términos de garantía que aplican a las ventas..."
              className="bg-white/5 border-white/10 text-white rounded-xl min-h-[200px]"
            />
            <p className="text-xs text-gray-400">Este texto aparecerá en los recibos de venta</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-white/10 text-white hover:bg-white/5"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WarrantyRepairsModal({ isOpen, onClose, currentText, onSave }) {
  const [text, setText] = useState(currentText || "30 días estándar. No cubre caídas, mojadas, rupturas, guayazos ni desperfectos de fábrica.");

  const handleSave = () => {
    if (!text.trim()) {
      toast.error("Escribe los términos de garantía");
      return;
    }
    onSave(text.trim());
    toast.success("Garantía por Reparación guardada");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-br from-[#1c1c1e] to-black/90 border border-white/20 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-400" />
            </div>
            Garantía por Reparación
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-4">
          <div className="space-y-2">
            <label className="text-white/70 text-sm font-semibold">Términos de Garantía *</label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ej: 30 días estándar. No cubre caídas, mojadas, rupturas..."
              className="bg-white/5 border-white/10 text-white rounded-xl min-h-[200px]"
            />
            <p className="text-xs text-gray-400">Este texto aparecerá en los recibos de reparación cuando se entregue el equipo</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-white/10 text-white hover:bg-white/5"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
