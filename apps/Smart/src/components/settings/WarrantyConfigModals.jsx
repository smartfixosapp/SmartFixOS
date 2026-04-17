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
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-2xl">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="apple-label-primary flex items-center gap-3">
              <div className="w-10 h-10 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                <Shield className="w-5 h-5 text-apple-green" />
              </div>
              <span className="apple-text-title3">Garantía por Venta</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            <div className="space-y-2">
              <label className="apple-label-secondary apple-text-footnote">Duración (opcional)</label>
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ej: 30 días, 90 días, 1 año"
                className="apple-input h-12"
              />
              <p className="apple-text-caption1 apple-label-tertiary">Si varía por producto, déjalo vacío</p>
            </div>

            <div className="space-y-2">
              <label className="apple-label-secondary apple-text-footnote">Términos de Garantía *</label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escribe los términos de garantía que aplican a las ventas..."
                className="apple-input min-h-[200px]"
              />
              <p className="apple-text-caption1 apple-label-tertiary">Este texto aparecerá en los recibos de venta</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 apple-btn apple-btn-secondary apple-press"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 apple-btn apple-btn-primary apple-press"
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
            </div>
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
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-2xl">
        <div className="p-6">
          <DialogHeader>
            <DialogTitle className="apple-label-primary flex items-center gap-3">
              <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center">
                <Shield className="w-5 h-5 text-apple-blue" />
              </div>
              <span className="apple-text-title3">Garantía por Reparación</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-4">
            <div className="space-y-2">
              <label className="apple-label-secondary apple-text-footnote">Términos de Garantía *</label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Ej: 30 días estándar. No cubre caídas, mojadas, rupturas..."
                className="apple-input min-h-[200px]"
              />
              <p className="apple-text-caption1 apple-label-tertiary">Este texto aparecerá en los recibos de reparación cuando se entregue el equipo</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 apple-btn apple-btn-secondary apple-press"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                className="flex-1 apple-btn apple-btn-primary apple-press"
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
