import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, Eye, EyeOff, Zap } from "lucide-react";
import { toast } from "sonner";

export default function CreateUserModal({ onClose, onCreate, roles }) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "technician",
    employee_code: `EMP${String(Math.floor(Math.random() * 9000) + 1000)}`,
    pin: "",
    hourly_rate: "",
    active: true,
    permissions: {
      view_reports: false,
      view_financials: false,
      manage_inventory: false,
      create_orders: true,
      process_sales: true,
    }
  });
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.full_name?.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!formData.employee_code?.trim()) {
      toast.error("El código de empleado es requerido");
      return;
    }
    if (!formData.pin?.trim() || formData.pin.length < 4) {
      toast.error("El PIN debe tener al menos 4 dígitos");
      return;
    }
    if (!/^\d+$/.test(formData.pin)) {
      toast.error("El PIN solo puede contener números");
      return;
    }

    setSaving(true);
    
    const userData = {
      full_name: formData.full_name,
      email: formData.email || `${formData.employee_code}@smartfix.local`,
      phone: formData.phone || "",
      customRole: formData.role, // Pasar el rol personalizado
      employee_code: formData.employee_code,
      pin: formData.pin,
      active: formData.active
    };

    await onCreate(userData);
    setSaving(false);
  };

  const selectedRole = roles.find(r => r.value === formData.role) || roles[2];
  const RoleIcon = selectedRole.icon;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-950 border-cyan-500/30 text-white max-h-[90vh] overflow-y-auto theme-light:bg-white theme-light:border-gray-300">
        {/* Header */}
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-lg">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                Crear Nuevo Usuario
              </h2>
              <p className="text-cyan-300/60 text-sm theme-light:text-gray-600">Completa la información del empleado</p>
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
                placeholder="Juan Pérez"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-cyan-300/60 mb-2 block theme-light:text-gray-600">Código *</label>
                <div className="relative">
                  <Input
                    value={formData.employee_code}
                    onChange={(e) => setFormData({...formData, employee_code: e.target.value.toUpperCase()})}
                    className="bg-slate-900/60 border-cyan-500/20 text-white h-12 rounded-xl font-mono pr-24 theme-light:bg-white theme-light:border-gray-300"
                    placeholder="EMP001"
                    readOnly
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setFormData({...formData, employee_code: `EMP${String(Math.floor(Math.random() * 9000) + 1000)}`})}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-10 bg-cyan-600/20 hover:bg-cyan-600/40 text-cyan-300 text-xs"
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Nuevo
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-xs text-cyan-300/60 mb-2 block theme-light:text-gray-600">Teléfono</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="bg-slate-900/60 border-cyan-500/20 text-white h-12 rounded-xl theme-light:bg-white theme-light:border-gray-300"
                  placeholder="(787) 123-4567"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-cyan-300/60 mb-2 block theme-light:text-gray-600">Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                className="bg-slate-900/60 border-cyan-500/20 text-white h-12 rounded-xl theme-light:bg-white theme-light:border-gray-300"
                placeholder="usuario@smartfix.com"
              />
            </div>
          </div>

          {/* Rol */}
          <div>
            <label className="text-lg font-bold text-cyan-400 mb-4 block theme-light:text-gray-900">Rol del Sistema *</label>
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
              <label className="text-xs text-cyan-300/60 mb-2 block theme-light:text-gray-600">PIN de Acceso * (4 dígitos)</label>
              <div className="relative">
                <Input
                  type={showPin ? "text" : "password"}
                  value={formData.pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setFormData({...formData, pin: val});
                  }}
                  className="bg-slate-900/60 border-cyan-500/20 text-white h-12 rounded-xl font-mono text-xl pr-12 theme-light:bg-white theme-light:border-gray-300"
                  placeholder="1234"
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
                placeholder="15.00"
              />
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
              className="flex-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 h-12 rounded-xl shadow-[0_0_40px_rgba(6,182,212,0.4)]"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  Creando...
                </>
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Crear Usuario
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
