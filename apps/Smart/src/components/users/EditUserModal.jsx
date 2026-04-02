import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, Edit3, Send, Delete, KeyRound, RotateCcw } from "lucide-react";
import { toast } from "sonner";

// ── PinPad visual para cambio de PIN ─────────────────────────────────────────
function PinPadSection({ currentPin, onPinChange }) {
  const [stage, setStage] = useState("idle"); // "idle" | "entering" | "confirming" | "done" | "mismatch"
  const [newPin, setNewPin]       = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const handleKey = (key) => {
    if (stage === "idle") return;
    const isEntering  = stage === "entering";
    const isConfirming = stage === "confirming";
    const current = isEntering ? newPin : confirmPin;
    const setter  = isEntering ? setNewPin : setConfirmPin;

    if (key === "⌫") {
      setter(current.slice(0, -1));
      if (stage === "mismatch") setStage("confirming");
      return;
    }
    if (current.length >= 4) return;

    const next = current + String(key);
    setter(next);

    if (next.length === 4) {
      if (isEntering) {
        setStage("confirming");
      } else {
        // Confirmar
        if (next === newPin) {
          setStage("done");
          onPinChange(next);
          toast.success("PIN listo — recuerda guardar los cambios");
        } else {
          setStage("mismatch");
          setConfirmPin("");
          setTimeout(() => {
            setStage("confirming");
            setConfirmPin("");
          }, 800);
        }
      }
    }
  };

  const startChange = () => {
    setStage("entering");
    setNewPin("");
    setConfirmPin("");
  };

  const cancel = () => {
    setStage("idle");
    setNewPin("");
    setConfirmPin("");
    onPinChange(currentPin); // revert
  };

  const displayPin  = stage === "confirming" || stage === "mismatch" ? confirmPin : newPin;
  const numbers = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [null, 0, "⌫"]];

  // Estado idle — mostrar botón de cambio
  if (stage === "idle") {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl bg-violet-500/10 border border-violet-500/20">
        <div>
          <p className="text-white font-semibold text-sm theme-light:text-gray-900">PIN de Acceso</p>
          <p className="text-violet-300/60 text-xs">
            {currentPin ? "PIN configurado ••••" : "Sin PIN — el usuario no puede entrar"}
          </p>
        </div>
        <button
          type="button"
          onClick={startChange}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600/80 hover:bg-violet-500 text-white text-xs font-bold transition-all"
        >
          <KeyRound className="w-3.5 h-3.5" />
          {currentPin ? "Cambiar PIN" : "Asignar PIN"}
        </button>
      </div>
    );
  }

  // Estado done
  if (stage === "done") {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-emerald-300 font-semibold text-sm">Nuevo PIN listo</p>
            <p className="text-emerald-400/60 text-xs">Se guardará al hacer clic en "Actualizar"</p>
          </div>
        </div>
        <button
          type="button"
          onClick={startChange}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 text-xs transition-all"
        >
          <RotateCcw className="w-3 h-3" />
          Cambiar
        </button>
      </div>
    );
  }

  // Estado entering / confirming / mismatch — mostrar pad
  const isMismatch  = stage === "mismatch";
  const isConfirming = stage === "confirming" || isMismatch;
  const dotCount    = displayPin.length;

  return (
    <div className="rounded-xl bg-zinc-900/80 border border-violet-500/20 p-4 space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <p className={`text-sm font-bold ${isMismatch ? "text-red-400" : isConfirming ? "text-amber-300" : "text-violet-300"}`}>
          {isMismatch   ? "❌ PINs no coinciden — intenta de nuevo"
          : isConfirming ? "Confirma el nuevo PIN"
          : "Escribe el nuevo PIN (4 dígitos)"}
        </p>
        <button type="button" onClick={cancel} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Dots indicadores */}
      <div className="flex justify-center gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
            i < dotCount
              ? isMismatch ? "bg-red-400 border-red-400" : "bg-violet-400 border-violet-400 scale-110"
              : "border-white/20 bg-transparent"
          }`} />
        ))}
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-2">
        {numbers.flat().map((key, idx) => {
          if (key === null) return <div key={idx} />;
          const isBackspace = key === "⌫";
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleKey(key)}
              className={`h-12 rounded-xl font-bold text-lg transition-all active:scale-95 ${
                isBackspace
                  ? "bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20"
                  : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
              }`}
            >
              {isBackspace ? <Delete className="w-4 h-4 mx-auto" /> : key}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function EditUserModal({ user, onClose, onUpdate, onResendInvite, roles }) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "technician",
    employee_code: "",
    pin: "",
    hourly_rate: "",
    active: true,
    permissions: {}
  });
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);

  const isPending = user?.status === "pending";

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        email: user.email || "",
        phone: user.phone || "",
        role: user.position || user.role || "technician", // Usar position como rol principal
        employee_code: user.employee_code || "",
        pin: user.pin || "",
        hourly_rate: user.hourly_rate || "",
        active: user.active !== false,
        permissions: user.permissions || {}
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.full_name?.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (formData.pin?.trim() && formData.pin.length < 4) {
      toast.error("El PIN debe tener al menos 4 dígitos");
      return;
    }
    if (formData.pin?.trim() && !/^\d+$/.test(formData.pin)) {
      toast.error("El PIN solo puede contener números");
      return;
    }

    setSaving(true);
    
    try {
      const userData = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        customRole: formData.role,
        active: formData.active,
        hourly_rate: parseFloat(formData.hourly_rate) || 0,
        ...(formData.pin?.trim() && { pin: formData.pin })
      };

      await onUpdate(user.id, userData);
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Error al actualizar: " + (error.message || "Intenta nuevamente"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndResend = async () => {
    if (!formData.full_name?.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!formData.email?.trim()) {
      toast.error("El email es requerido para reenviar la invitación");
      return;
    }

    setResending(true);
    try {
      const userData = {
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        customRole: formData.role,
        active: formData.active,
        hourly_rate: parseFloat(formData.hourly_rate) || 0,
        ...(formData.pin?.trim() && { pin: formData.pin })
      };
      await onUpdate(user.id, userData);
      await onResendInvite({ ...user, email: formData.email, full_name: formData.full_name });
    } catch (error) {
      console.error("Error saving and resending:", error);
      toast.error("Error al guardar: " + (error.message || "Intenta nuevamente"));
    } finally {
      setResending(false);
    }
  };

  const selectedRole = roles.find(r => r.value === formData.role) || roles[2];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-950 border-cyan-500/30 text-white max-h-[90vh] overflow-y-auto theme-light:bg-white theme-light:border-gray-300">
        {/* Header */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
              <Edit3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Editar Usuario
              </h2>
              <p className="text-cyan-300/60 text-sm theme-light:text-gray-600">{user?.employee_code}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información Básica */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-cyan-400 theme-light:text-gray-900">Información Básica</h3>
            
            <div>
              <label className="text-xs text-cyan-300/60 mb-2 block theme-light:text-gray-600">Nombre Completo *</label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                className="bg-slate-900/60 border-cyan-500/20 text-white h-12 rounded-xl theme-light:bg-white theme-light:border-gray-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-cyan-300/60 mb-2 block theme-light:text-gray-600">Teléfono</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="bg-slate-900/60 border-cyan-500/20 text-white h-12 rounded-xl theme-light:bg-white theme-light:border-gray-300"
                />
              </div>
              <div>
                <label className="text-xs text-cyan-300/60 mb-2 block theme-light:text-gray-600">Email</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="bg-slate-900/60 border-cyan-500/20 text-white h-12 rounded-xl theme-light:bg-white theme-light:border-gray-300"
                />
              </div>
            </div>
          </div>

          {/* Rol */}
          <div>
            <label className="text-lg font-bold text-cyan-400 mb-4 block theme-light:text-gray-900">Rol del Sistema</label>
            <div className="grid grid-cols-2 gap-3">
              {roles.map(role => {
                const Icon = role.icon;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setFormData({...formData, role: role.value})}
                    className={`flex items-center gap-3 px-4 py-4 rounded-xl border-2 transition-all ${
                      formData.role === role.value
                        ? `bg-gradient-to-r ${role.color} text-white border-transparent shadow-lg scale-105`
                        : 'bg-slate-900/40 border-cyan-500/10 text-white/60 hover:bg-slate-900/60 theme-light:bg-gray-100 theme-light:border-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-bold">{role.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seguridad */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-cyan-400 theme-light:text-gray-900">Seguridad</h3>
            
            <div>
              <label className="text-xs text-cyan-300/60 mb-2 block theme-light:text-gray-600">
                PIN de Acceso (4 dígitos)
              </label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  value={formData.pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setFormData({...formData, pin: val});
                  }}
                  className="bg-slate-900/60 border-cyan-500/20 text-white h-12 rounded-xl font-mono text-xl pr-12 theme-light:bg-white theme-light:border-gray-300"
                  placeholder="••••"
                  maxLength={4}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-400 hover:text-cyan-300"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-cyan-300/60 mb-2 block theme-light:text-gray-600">Tarifa por Hora ($)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({...formData, hourly_rate: e.target.value})}
                className="bg-slate-900/60 border-cyan-500/20 text-white h-12 rounded-xl theme-light:bg-white theme-light:border-gray-300"
              />
            </div>
          </div>

          {/* Estado */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-emerald-600/10 to-green-600/10 border border-emerald-500/30">
            <div>
              <p className="text-white font-bold theme-light:text-gray-900">Usuario Activo</p>
              <p className="text-xs text-cyan-300/60 theme-light:text-gray-600">
                {formData.active ? "Puede acceder al sistema" : "Acceso bloqueado"}
              </p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({...formData, active: e.target.checked})}
                className="sr-only peer"
              />
              <div className={`w-11 h-6 rounded-full transition-all flex-shrink-0 ${
                formData.active ? 'bg-gradient-to-r from-emerald-600 to-green-600' : 'bg-slate-700'
              }`}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-lg transition-all ${
                  formData.active ? 'translate-x-6' : 'translate-x-0.5'
                } mt-1`} />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex flex-col gap-3 pt-6">
            {(isPending && onResendInvite) && (
              <Button
                type="button"
                disabled={resending || saving}
                onClick={handleSaveAndResend}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 h-12 rounded-xl shadow-lg text-white font-bold"
              >
                {resending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Guardando y reenviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Guardar y reenviar invitación
                  </>
                )}
              </Button>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving || resending}
                className="flex-1 border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/10 h-12 rounded-xl theme-light:border-gray-300"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || resending}
                className="flex-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-12 rounded-xl shadow-[0_0_40px_rgba(99,102,241,0.4)]"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Actualizar Usuario
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
