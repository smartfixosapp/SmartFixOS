import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Hash, Grid3x3, Trash2 } from "lucide-react";
import PatternLock from "../security/PatternLock";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

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
        <DialogContent className="max-w-2xl overflow-hidden border border-fuchsia-400/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_26%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.14),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.10),transparent_26%),linear-gradient(180deg,rgba(4,8,22,0.985),rgba(2,6,18,0.99))] p-0 shadow-[0_40px_140px_rgba(0,0,0,0.62)] max-h-[92vh] z-[99999] flex flex-col">
          <DialogHeader className="border-b border-white/10 bg-[linear-gradient(90deg,rgba(6,182,212,0.10),rgba(124,58,237,0.12),rgba(236,72,153,0.05))] px-6 py-6 sm:px-8">
            <DialogTitle className="flex items-center gap-4 text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-fuchsia-400/20 bg-[linear-gradient(180deg,rgba(124,58,237,0.18),rgba(236,72,153,0.14))] text-fuchsia-200 shadow-[0_16px_40px_rgba(124,58,237,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]">
                <Lock className="h-7 w-7" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-200/55">Acceso del equipo</p>
                <h2 className="mt-1 text-[30px] font-black tracking-[-0.03em]">Seguridad del Dispositivo</h2>
                <p className="mt-1 text-sm font-medium text-white/45">
                  Registra PIN, contrasena, patron y notas sin salir del flujo de recepcion.
                </p>
              </div>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 p-6 sm:p-8 overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: "touch" }}>
            {/* PIN */}
            <div className="space-y-3 rounded-[28px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.025))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <Label className="flex items-center gap-2 text-base font-bold text-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10">
                  <Hash className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="flex flex-col">
                  <span>PIN Numerico</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30">Acceso rapido</span>
                </div>
              </Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Ingresa PIN..."
                className="h-14 rounded-[18px] border-white/10 bg-black/35 px-5 text-2xl font-black tracking-[0.22em] text-white placeholder:text-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-cyan-400/35 focus:ring-cyan-500/20"
              />
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-white/35">4-6 digitos numericos</p>
            </div>

            {/* PASSWORD */}
            <div className="space-y-3 rounded-[28px] border border-emerald-400/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.025))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <Label className="flex items-center gap-2 text-base font-bold text-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10">
                  <Lock className="h-4 w-4 text-emerald-300" />
                </div>
                <div className="flex flex-col">
                  <span>Contrasena</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30">Clave adicional</span>
                </div>
              </Label>
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ingresa contrasena..."
                className="h-14 rounded-[18px] border-white/10 bg-black/35 px-5 text-xl font-bold text-white placeholder:text-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-emerald-400/35 focus:ring-emerald-500/20"
              />
            </div>

            {/* PATRÓN */}
            <div className="space-y-4 rounded-[30px] border border-fuchsia-500/18 bg-[linear-gradient(180deg,rgba(76,29,149,0.16),rgba(10,10,18,0.52))] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.05)]">
              <Label className="flex items-center gap-2 text-base font-bold text-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10">
                  <Grid3x3 className="h-4 w-4 text-purple-300" />
                </div>
                <div className="flex flex-col">
                  <span>Patron de Bloqueo (Android)</span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30">Trazo visual</span>
                </div>
              </Label>
              
              {patternImage ? (
                <div className="rounded-[24px] border border-fuchsia-400/20 bg-[linear-gradient(180deg,rgba(3,7,18,0.85),rgba(8,10,18,0.7))] p-4 sm:p-5">
                  <img
                    src={patternImage}
                    alt="Patrón"
                    className="mx-auto w-full max-w-[240px] rounded-[20px] border border-fuchsia-400/20 bg-black/35 p-2 shadow-[0_12px_30px_rgba(0,0,0,0.22)]"
                  />
                  <div className="mt-4 flex gap-3">
                    <Button
                      onClick={() => setShowPatternDialog(true)}
                      variant="outline"
                      className="h-12 flex-1 rounded-2xl border-white/10 bg-white/95 text-base font-black text-slate-950 shadow-[0_10px_30px_rgba(255,255,255,0.08)] hover:bg-white"
                    >
                      Cambiar Patron
                    </Button>
                    <Button
                      onClick={handleClearPattern}
                      variant="outline"
                      className="h-12 rounded-2xl border-red-400/30 bg-white px-4 text-red-500 shadow-[0_10px_30px_rgba(255,255,255,0.07)] hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setShowPatternDialog(true)}
                  variant="outline"
                  className="h-14 w-full rounded-2xl border-white/10 bg-white/[0.04] text-base font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:border-fuchsia-400/35 hover:bg-white/[0.06]"
                >
                  <Grid3x3 className="w-4 h-4 mr-2" />
                  Configurar Patron
                </Button>
              )}
            </div>

            {/* NOTAS */}
            <div className="space-y-3 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.025))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <Label className="text-base font-bold text-slate-100">Notas Adicionales</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ej: Face ID deshabilitado, patrón alternativo..."
                className="min-h-[120px] rounded-[18px] border-white/10 bg-black/35 p-4 text-white placeholder:text-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-fuchsia-400/35 focus:ring-fuchsia-500/20"
              />
            </div>

            {/* ACCIONES */}
            <div className="grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="h-14 rounded-[20px] border border-white/15 bg-white text-lg font-black text-slate-950 shadow-[0_12px_30px_rgba(255,255,255,0.08)] hover:bg-white/90"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="h-14 rounded-[20px] bg-[linear-gradient(90deg,#06b6d4,#7c3aed,#db2777)] text-lg font-black text-white shadow-[0_20px_45px_rgba(124,58,237,0.32)] hover:brightness-110"
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
