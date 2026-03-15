import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Loader2, Shield, Lock } from "lucide-react";
import { toast } from "sonner";

const LOCAL_USERS_STORAGE_KEY = "smartfix_local_users";

function readLocalUsers() {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_STORAGE_KEY, JSON.stringify(users || []));
}

export default function Activate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [activating, setActivating] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setError("Token de activación no encontrado");
      setLoading(false);
      return;
    }

    validateToken(token);
  }, []);

  const validateToken = async (token) => {
    try {
      const employees = await dataClient.entities.AppEmployee.filter({
        activation_token: token
      });

      if (!employees || employees.length === 0) {
        setError("Token de activación inválido");
        setLoading(false);
        return;
      }

      const emp = employees[0];

      // Verificar expiración
      if (emp.activation_expires_at) {
        const expiresAt = new Date(emp.activation_expires_at);
        if (expiresAt < new Date()) {
          setError("El token de activación ha expirado");
          setLoading(false);
          return;
        }
      }

      // Ya activado
      if (emp.status === "active" && emp.active && emp.portal_access_enabled) {
        setSuccess(true);
        toast.success("Tu cuenta ya está activada");
        setTimeout(() => navigate("/PinAccess"), 3000);
        setLoading(false);
        return;
      }

      setEmployee(emp);
      setLoading(false);

    } catch (error) {
      console.error("Error validating token:", error);
      setError("Error al validar el token");
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast.error("El PIN debe ser de 4 dígitos numéricos");
      return;
    }

    if (pin !== confirmPin) {
      toast.error("Los PINs no coinciden");
      return;
    }

    setActivating(true);

    try {
      // Activar empleado
      await dataClient.entities.AppEmployee.update(employee.id, {
        pin: pin,
        status: "active",
        active: true,
        portal_access_enabled: true,
        activation_token: null,
        activation_expires_at: null
      });

      const tenantId = employee.tenant_id || localStorage.getItem("smartfix_tenant_id") || null;
      if (tenantId) {
        localStorage.setItem("smartfix_tenant_id", tenantId);
        localStorage.setItem("current_tenant_id", tenantId);
      }

      const activatedProfile = {
        id: employee.id,
        email: employee.email,
        full_name: employee.full_name,
        role: employee.role || "user",
        position: employee.position || employee.role || "user",
        employee_code: employee.employee_code || "",
        pin,
        phone: employee.phone || "",
        hourly_rate: employee.hourly_rate ?? 0,
        active: true,
        status: "active",
        portal_access_enabled: true,
        tenant_id: tenantId,
        permissions: employee.permissions || {},
      };

      try {
        const { data: existingUsers, error: lookupError } = await supabase
          .from("users")
          .select("id, tenant_id, email, full_name, role, position, employee_code, pin, phone, active, hourly_rate, permissions")
          .eq("email", employee.email)
          .limit(1);

        if (lookupError) throw lookupError;

        if (!existingUsers || existingUsers.length === 0) {
          const insertPayload = {
            email: activatedProfile.email,
            full_name: activatedProfile.full_name,
            role: activatedProfile.role,
            position: activatedProfile.position,
            employee_code: activatedProfile.employee_code,
            pin: activatedProfile.pin,
            phone: activatedProfile.phone,
            active: true,
            tenant_id: activatedProfile.tenant_id,
            hourly_rate: activatedProfile.hourly_rate,
            permissions: activatedProfile.permissions,
          };
          const { error: insertError } = await supabase.from("users").insert(insertPayload);
          if (insertError) throw insertError;
        } else {
          const currentUser = existingUsers[0];
          const updatePayload = {
            full_name: activatedProfile.full_name,
            role: employee.role || currentUser.role || "user",
            position: employee.position || currentUser.position || employee.role || "user",
            employee_code: employee.employee_code || currentUser.employee_code || "",
            pin,
            phone: employee.phone || currentUser.phone || "",
            active: true,
            tenant_id: tenantId || currentUser.tenant_id || null,
            hourly_rate: employee.hourly_rate ?? currentUser.hourly_rate ?? 0,
            permissions: employee.permissions || currentUser.permissions || {},
          };
          const { error: updateError } = await supabase
            .from("users")
            .update(updatePayload)
            .eq("id", currentUser.id);
          if (updateError) throw updateError;
        }
      } catch (userError) {
        console.error("User creation failed during activation:", userError);
        toast.error("La cuenta se activó, pero faltó sincronizar el perfil interno en la nube.");
      }

      const localUsers = readLocalUsers();
      const dedupedUsers = localUsers.filter(
        (candidate) =>
          String(candidate.email || "").trim().toLowerCase() !== String(activatedProfile.email || "").trim().toLowerCase()
      );
      writeLocalUsers([...dedupedUsers, activatedProfile]);

      setSuccess(true);
      toast.success("¡Cuenta activada exitosamente!");

      setTimeout(() => {
        navigate("/PinAccess");
      }, 2000);

    } catch (error) {
      console.error("Error activating account:", error);
      toast.error("Error al activar la cuenta");
    } finally {
      setActivating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Validando token...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gradient-to-br from-slate-900 to-black border-2 border-red-500/50 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Error de Activación</h1>
          <p className="text-gray-300 mb-6">{error}</p>
          <Button
            onClick={() => navigate("/PinAccess")}
            className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700"
          >
            Volver al Inicio
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-gradient-to-br from-slate-900 to-black border-2 border-emerald-500/50 rounded-2xl p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6 animate-bounce">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">¡Cuenta Activada! 🎉</h1>
          <p className="text-gray-300 mb-2">Tu cuenta ha sido activada exitosamente</p>
          <p className="text-sm text-gray-500">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mx-auto mb-6 shadow-[0_0_60px_rgba(6,182,212,0.6)]">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white mb-3">Activar Cuenta</h1>
          <p className="text-gray-300 text-lg">
            ¡Hola <span className="text-cyan-400 font-bold">{employee?.full_name}</span>!
          </p>
          <p className="text-gray-400 mt-2">Crea tu PIN de acceso</p>
        </div>

        {/* Formulario */}
        <div className="bg-gradient-to-br from-slate-900/80 to-black/80 backdrop-blur-xl border-2 border-cyan-500/30 rounded-3xl p-8 space-y-6">
          <div>
            <Label className="text-white flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4" />
              PIN de 4 Dígitos
            </Label>
            <Input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="bg-slate-800/50 border-cyan-500/40 text-white text-center text-2xl tracking-widest h-16"
            />
          </div>

          <div>
            <Label className="text-white flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4" />
              Confirmar PIN
            </Label>
            <Input
              type="password"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="bg-slate-800/50 border-cyan-500/40 text-white text-center text-2xl tracking-widest h-16"
            />
          </div>

          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
            <p className="text-sm text-cyan-300 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Tu PIN será usado para acceder al sistema
            </p>
          </div>

          <Button
            onClick={handleActivate}
            disabled={activating || !pin || !confirmPin || pin.length !== 4}
            className="w-full h-16 bg-gradient-to-r from-cyan-600 via-emerald-600 to-lime-600 hover:from-cyan-500 hover:via-emerald-500 hover:to-lime-500 text-xl font-bold shadow-[0_0_60px_rgba(6,182,212,0.5)]"
          >
            {activating ? (
              <>
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                Activando...
              </>
            ) : (
              <>
                <CheckCircle className="w-6 h-6 mr-3" />
                Activar Cuenta
              </>
            )}
          </Button>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-500 text-sm">
            Al activar tu cuenta aceptas los términos de uso
          </p>
        </div>
      </div>
    </div>
  );
}
