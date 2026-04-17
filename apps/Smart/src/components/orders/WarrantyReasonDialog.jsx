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
      <DialogContent className="apple-type max-w-md apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-6 overflow-hidden" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-2">
            <Shield className="w-6 h-6 text-apple-yellow" />
            Razón de Garantía
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="p-3 bg-apple-yellow/12 rounded-apple-md flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-apple-yellow flex-shrink-0 mt-0.5" />
            <p className="apple-text-subheadline text-apple-yellow">
              Describe brevemente por qué el equipo volvió a taller bajo garantía
            </p>
          </div>

          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: Cliente reporta que el problema persiste, pantalla sigue parpadeando..."
            className="apple-input min-h-[120px] resize-none"
            autoFocus
          />

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="apple-btn apple-btn-secondary apple-press flex-1"
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!reason.trim() || saving}
              className="apple-btn apple-press flex-1 bg-apple-yellow text-white font-semibold hover:opacity-90"
            >
              {saving ? "Guardando..." : "Confirmar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
