import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Hash, Grid3x3, Trash2 } from "lucide-react";
import PatternLock from "../security/PatternLock";
import { base44 } from "@/api/base44Client";
import { toast } from "react-hot-toast";

export default function SecurityEditDialog({ open, onClose, order, onUpdate }) {
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [notes, setNotes] = useState("");
  const [showPatternDialog, setShowPatternDialog] = useState(false);
  const [patternImage, setPatternImage] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && order?.device_security) {
      const sec = order.device_security;
      // Decodificar valores existentes
      try {
        setPin(sec.device_pin ? atob(sec.device_pin) : "");
      } catch {
        setPin("");
      }
      try {
        setPassword(sec.device_password ? atob(sec.device_password) : "");
      } catch {
        setPassword("");
      }
      setNotes(sec.security_notes || "");
      setPatternImage(sec.pattern_image || null);
    } else if (open) {
      setPin("");
      setPassword("");
      setNotes("");
      setPatternImage(null);
    }
  }, [open, order]);

  const handlePatternSave = (patternString) => {
    setPatternImage(patternString);
    setShowPatternDialog(false);
  };

  const handleSave = async () => {
    if (!order?.id) return;

    setSaving(true);
    try {
      const securityData = {
        device_pin: pin ? btoa(pin) : null,
        device_password: password ? btoa(password) : null,
        security_notes: notes || null,
        pattern_image: patternImage || null
      };

      await base44.entities.Order.update(order.id, {
        device_security: securityData
      });

      // Crear evento
      let me = null;
      try {
        me = await base44.auth.me();
      } catch {}

      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "security_updated",
        description: "Información de seguridad actualizada",
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null
      });

      toast.success("✅ Seguridad actualizada");
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error("Error saving security:", error);
      toast.error("Error al guardar seguridad");
    } finally {
      setSaving(false);
    }
  };

  const handleClearPattern = () => {
    setPatternImage(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-lg bg-gradient-to-br from-slate-900 to-black border-purple-500/30 max-h-[90vh] overflow-y-auto z-[100]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Lock className="w-6 h-6 text-purple-400" />
              Seguridad del Dispositivo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* PIN */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <Hash className="w-4 h-4 text-cyan-400" />
                PIN Numérico
              </Label>
              <Input
                type="text"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Ingresa PIN..."
                className="bg-black/40 border-white/15 text-white"
              />
              <p className="text-xs text-gray-500">4-6 dígitos numéricos</p>
            </div>

            {/* PASSWORD */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                Contraseña
              </Label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa contraseña..."
                className="bg-black/40 border-white/15 text-white"
              />
            </div>

            {/* PATRÓN */}
            <div className="space-y-2">
              <Label className="text-gray-300 flex items-center gap-2">
                <Grid3x3 className="w-4 h-4 text-purple-400" />
                Patrón de Bloqueo (Android)
              </Label>
              
              {patternImage ? (
                <div className="bg-black/40 border border-purple-500/30 rounded-lg p-4">
                  <img
                    src={patternImage}
                    alt="Patrón"
                    className="w-full max-w-[200px] mx-auto rounded-md border border-purple-400/30"
                  />
                  <div className="flex gap-2 mt-3">
                    <Button
                      onClick={() => setShowPatternDialog(true)}
                      variant="outline"
                      className="flex-1 border-white/15"
                    >
                      Cambiar Patrón
                    </Button>
                    <Button
                      onClick={handleClearPattern}
                      variant="outline"
                      className="border-red-500/30 text-red-400 hover:bg-red-600/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setShowPatternDialog(true)}
                  variant="outline"
                  className="w-full border-white/15 hover:border-purple-500/50"
                >
                  <Grid3x3 className="w-4 h-4 mr-2" />
                  Configurar Patrón
                </Button>
              )}
            </div>

            {/* NOTAS */}
            <div className="space-y-2">
              <Label className="text-gray-300">Notas Adicionales</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Face ID deshabilitado, patrón alternativo..."
                className="bg-black/40 border-white/15 text-white min-h-[80px]"
              />
            </div>

            {/* ACCIONES */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PatternLock
        open={showPatternDialog}
        onClose={() => setShowPatternDialog(false)}
        onSave={handlePatternSave}
        mode="set"
      />
    </>
  );
}
