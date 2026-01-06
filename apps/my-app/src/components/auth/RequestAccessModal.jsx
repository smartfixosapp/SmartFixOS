import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Mail, Phone, Building2, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";

export default function RequestAccessModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    store_branch: "",
    store_phone: ""
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.full_name || formData.full_name.length < 2) {
      toast.error("El nombre debe tener al menos 2 caracteres");
      return false;
    }
    if (!formData.email || !formData.email.includes("@")) {
      toast.error("Email inválido");
      return false;
    }
    if (!formData.phone || formData.phone.length < 6) {
      toast.error("Teléfono inválido");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      // Verificar si ya existe
      const existing = await dataClient.entities.AppEmployee.filter({ email: formData.email });

      let employeeId;

      if (existing && existing.length > 0) {
        const employee = existing[0];
        
        if (employee.active && employee.status === "active") {
          toast.info("Ya tienes una cuenta activa. Contacta al administrador si necesitas ayuda.");
          setLoading(false);
          return;
        }

        if (employee.status === "pending") {
          toast.info("Tu solicitud ya está pendiente de aprobación. Te notificaremos por email.");
          setLoading(false);
          return;
        }

        // Actualizar registro existente
        await dataClient.entities.AppEmployee.update(employee.id, {
          ...formData,
          status: "pending",
          portal_access_enabled: false,
          active: false
        });
        employeeId = employee.id;
      } else {
        // Crear nuevo
        const newEmployee = await dataClient.entities.AppEmployee.create({
          ...formData,
          status: "pending",
          portal_access_enabled: false,
          active: false,
          role: "technician",
          position: "Empleado",
          employee_code: `EMP-${Date.now()}`
        });
        employeeId = newEmployee.id;
      }

      // Enviar email al ADMIN
      await sendAdminNotificationEmail(employeeId, formData);
      
      setSuccess(true);
      toast.success("Solicitud enviada. Recibirás un email cuando sea aprobada.");

      setTimeout(() => {
        onClose();
        setSuccess(false);
        setFormData({
          full_name: "",
          email: "",
          phone: "",
          store_branch: "",
          store_phone: ""
        });
      }, 2000);

    } catch (error) {
      console.error("Error requesting access:", error);
      toast.error("Error al solicitar acceso");
    } finally {
      setLoading(false);
    }
  };

  const sendAdminNotificationEmail = async (employeeId, data) => {
    const approveUrl = `${window.location.origin}/UsersManagement?action=approve&id=${employeeId}`;
    const rejectUrl = `${window.location.origin}/UsersManagement?action=reject&id=${employeeId}`;
    
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #06b6d4; font-size: 32px; margin: 0;">SmartFixOS</h1>
          <p style="color: #f59e0b; font-size: 18px; margin-top: 10px;">⚠️ Nueva Solicitud de Acceso</p>
        </div>
        
        <div style="background: rgba(255,255,255,0.05); padding: 30px; border-radius: 12px; border: 2px solid rgba(6,182,212,0.3);">
          <h2 style="color: #10b981; margin-top: 0;">Nueva Solicitud Recibida</h2>
          
          <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #e2e8f0; margin: 8px 0;"><strong>Nombre:</strong> ${data.full_name}</p>
            <p style="color: #e2e8f0; margin: 8px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="color: #e2e8f0; margin: 8px 0;"><strong>Teléfono:</strong> ${data.phone}</p>
            <p style="color: #e2e8f0; margin: 8px 0;"><strong>Sucursal:</strong> ${data.store_branch || "No especificada"}</p>
            <p style="color: #e2e8f0; margin: 8px 0;"><strong>Tel. Tienda:</strong> ${data.store_phone || "No especificado"}</p>

            <p style="color: #94a3b8; margin: 8px 0; font-size: 12px;"><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${approveUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 18px; margin: 10px; box-shadow: 0 4px 20px rgba(16,185,129,0.4);">
              ✅ Aprobar
            </a>
            <a href="${rejectUrl}" 
               style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 18px; margin: 10px; box-shadow: 0 4px 20px rgba(239,68,68,0.4);">
              ❌ Rechazar
            </a>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
            <p style="color: #94a3b8; font-size: 14px; margin: 0;">
              También puedes aprobar/rechazar desde el módulo de Usuarios en el sistema.
            </p>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px; color: #64748b; font-size: 12px;">
          <p>© ${new Date().getFullYear()} SmartFixOS • Sistema de Gestión</p>
        </div>
      </div>
    `;

    try {
      // Obtener email del admin desde AppSettings
      const settings = await dataClient.entities.AppSettings.filter({ slug: "app-main-settings" });
      const adminEmail = settings?.[0]?.payload?.business_email || "admin@smartfixos.com";

      await dataClient.mail.send({
        to: adminEmail,
        from_name: "SmartFixOS Sistema",
        subject: "⚠️ Nueva Solicitud de Acceso - Requiere Aprobación",
        body: emailBody
      });
    } catch (error) {
      console.error("Error sending admin email:", error);
      throw error;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-slate-900 to-black border-2 border-cyan-500/30">
        {success ? (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6 animate-bounce">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">¡Solicitud Enviada!</h3>
            <p className="text-gray-300 mb-2">Un administrador revisará tu solicitud</p>
            <p className="text-sm text-gray-500">Recibirás un email cuando sea aprobada</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-2xl text-white">Solicitar Acceso</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    Completa el formulario para crear tu cuenta
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <Label className="text-white">Nombre Completo *</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => handleChange("full_name", e.target.value)}
                  placeholder="Juan Pérez"
                  className="bg-slate-800/50 border-cyan-500/30 text-white"
                />
              </div>

              <div>
                <Label className="text-white flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email *
                </Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="juan@ejemplo.com"
                  className="bg-slate-800/50 border-cyan-500/30 text-white"
                />
              </div>

              <div>
                <Label className="text-white flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Teléfono *
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="787-123-4567"
                  className="bg-slate-800/50 border-cyan-500/30 text-white"
                />
              </div>

              <div>
                <Label className="text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Sucursal / Tienda
                </Label>
                <Input
                  value={formData.store_branch}
                  onChange={(e) => handleChange("store_branch", e.target.value)}
                  placeholder="Tienda principal"
                  className="bg-slate-800/50 border-cyan-500/30 text-white"
                />
              </div>

              <div>
                <Label className="text-white">Teléfono de la Tienda</Label>
                <Input
                  value={formData.store_phone}
                  onChange={(e) => handleChange("store_phone", e.target.value)}
                  placeholder="787-000-0000"
                  className="bg-slate-800/50 border-cyan-500/30 text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700/50"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Enviar Link
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
