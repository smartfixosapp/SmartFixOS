import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Shield, AlertCircle } from "lucide-react";

export default function WarrantyReasonDialog({ open, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      return;
    }

    setSaving(true);
    try {
      await onConfirm(trimmed);
      setReason("");
      onClose();
    } catch (error) {
      console.error("Error guardando razón de garantía:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-[#1c1c1e] to-black border-amber-500/30" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-400" />
            Razón de Garantía
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/90">
              Describe brevemente por qué el equipo volvió a taller bajo garantía
            </p>
          </div>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Cliente reporta que el problema persiste, pantalla sigue parpadeando..."
            className="min-h-[120px] bg-black/40 border-amber-500/30 text-white placeholder-gray-500 focus:ring-amber-500/50 resize-none"
            autoFocus
          />

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/20 text-white hover:bg-white/5"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!reason.trim() || saving}
              className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold shadow-lg shadow-amber-500/20"
            >
              {saving ? "Guardando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
