import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Check, Eye, EyeOff, Zap } from "lucide-react";
import { toast } from "sonner";
import { PlanGate, UpgradePrompt } from "@/components/plan/UpgradePrompt";

function generateEmployeeCode() {
  return `EMP${Date.now().toString().slice(-6)}`;
}

function generatePin() {
  return String(Math.floor(Math.random() * 9000) + 1000);
}

export default function CreateUserModal({ onClose, onCreate, roles }) {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    role: "technician",
    employee_code: generateEmployeeCode(),
    generated_pin: generatePin(),
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

    if (!formData.first_name?.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    if (!formData.last_name?.trim()) {
      toast.error("El apellido es requerido");
      return;
    }
    if (!formData.email?.trim()) {
      toast.error("El email es requerido");
      return;
    }

    setSaving(true);

    const userData = {
      full_name: `${formData.first_name.trim()} ${formData.last_name.trim()}`.trim(),
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone || "",
      customRole: formData.role,
      employee_code: formData.employee_code,
      pin: formData.generated_pin,
      hourly_rate: formData.hourly_rate,
      active: formData.active,
      send_invite: true
    };

    await onCreate(userData);
    setSaving(false);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="relative mb-6">
            <div className="relative flex items-center gap-4">
              <div className="w-16 h-16 rounded-apple-md bg-apple-blue/15 flex items-center justify-center">
                <Zap className="w-8 h-8 text-apple-blue" />
              </div>
              <div>
                <h2 className="apple-text-title1 apple-label-primary">
                  Crear Nuevo Usuario
                </h2>
                <p className="apple-label-tertiary apple-text-subheadline">Completa la información del empleado</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Información Básica */}
            <div className="space-y-4">
              <h3 className="apple-text-headline apple-label-primary">Información Básica</h3>

              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="apple-text-footnote apple-label-secondary mb-2 block">Nombre *</label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                      className="apple-input h-12"
                      placeholder="Aida"
                    />
                  </div>
                  <div>
                    <label className="apple-text-footnote apple-label-secondary mb-2 block">Apellido *</label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                      className="apple-input h-12"
                      placeholder="Torres"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="apple-text-footnote apple-label-secondary mb-2 block">Teléfono</label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="apple-input h-10 tabular-nums"
                    placeholder="(787) 123-4567"
                  />
                </div>
                <div>
                  <label className="apple-text-footnote apple-label-secondary mb-2 block">Email *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="apple-input h-10"
                    placeholder="usuario@smartfix.com"
                  />
                </div>
              </div>

            </div>

            {/* Rol */}
            <div>
              <label className="apple-text-headline apple-label-primary mb-4 block">Rol del Sistema *</label>
              <PlanGate feature="permissions_roles" fallback={
                <div className="space-y-2">
                  <p className="apple-text-subheadline apple-label-tertiary">Rol asignado: <span className="apple-label-primary">Técnico</span></p>
                  <UpgradePrompt feature="permissions_roles" message="Selección de roles disponible en el plan Pro" />
                </div>
              }>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {roles.map(role => {
                  const Icon = role.icon;
                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setFormData({...formData, role: role.value})}
                      className={`flex items-center justify-center gap-2 px-3 py-3 rounded-apple-sm transition-all apple-text-subheadline apple-press ${
                        formData.role === role.value
                          ? `apple-btn apple-btn-primary`
                          : 'bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{role.label}</span>
                    </button>
                  );
                })}
              </div>
              </PlanGate>
            </div>

            {/* Seguridad */}
            <div className="space-y-4">
              <h3 className="apple-text-headline apple-label-primary">Seguridad</h3>

              <div>
                <label className="apple-text-footnote apple-label-secondary mb-2 block">PIN temporal generado</label>
                <div className="relative">
                  <Input
                    type={showPin ? "text" : "password"}
                    value={formData.generated_pin}
                    readOnly
                    className="apple-input h-12 tabular-nums text-xl pr-12"
                    placeholder="1234"
                    maxLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-apple-blue apple-press"
                  >
                    {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="apple-text-caption1 apple-label-tertiary">
                    Se enviará invitación por email. El empleado podrá cambiar este PIN al activar su cuenta.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setFormData({...formData, generated_pin: generatePin(), employee_code: generateEmployeeCode()})}
                    className="apple-btn apple-btn-tinted apple-press"
                  >
                    <Zap className="w-3 h-3 mr-1" />
                    Regenerar
                  </Button>
                </div>
              </div>

              <div>
                <label className="apple-text-footnote apple-label-secondary mb-2 block">Tarifa por Hora ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({...formData, hourly_rate: e.target.value})}
                  className="apple-input h-12 tabular-nums"
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
                className="flex-1 apple-btn apple-btn-secondary apple-press h-12"
              >
                <X className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="flex-1 apple-btn apple-btn-primary apple-press h-12"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Enviar invitación
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
