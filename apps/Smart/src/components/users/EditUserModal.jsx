import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, Eye, EyeOff, Edit3 } from "lucide-react";
import { toast } from "sonner";

export default function EditUserModal({ user, onClose, onUpdate, roles }) {
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
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

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
              <div className={`w-14 h-7 rounded-full transition-all ${
                formData.active ? 'bg-gradient-to-r from-emerald-600 to-green-600' : 'bg-slate-700'
              }`}>
                <div className={`w-6 h-6 bg-white rounded-full shadow-lg transition-all ${
                  formData.active ? 'translate-x-7' : 'translate-x-0.5'
                } mt-0.5`} />
              </div>
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="flex-1 border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/10 h-12 rounded-xl theme-light:border-gray-300"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving}
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
