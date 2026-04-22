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
        navigate("/PinAccess", {
          state: { activated: true, email: employee.email },
        });
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
      <div className="fixed inset-0 apple-surface apple-type flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-apple-blue animate-spin mx-auto mb-4" />
          <p className="apple-text-body apple-label-primary">Validando token...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 apple-surface apple-type flex items-center justify-center p-6">
        <div className="max-w-md w-full apple-card rounded-apple-xl p-8 text-center shadow-apple-lg">
          <div className="w-20 h-20 rounded-apple-sm bg-apple-red/15 flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-apple-red" />
          </div>
          <h1 className="apple-text-title2 apple-label-primary mb-4">Error de activación</h1>
          <p className="apple-text-body apple-label-secondary mb-6">{error}</p>
          <Button
            onClick={() => navigate("/PinAccess")}
            className="apple-btn apple-btn-destructive apple-btn-lg"
          >
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="fixed inset-0 apple-surface apple-type flex items-center justify-center p-6">
        <div className="max-w-md w-full apple-card rounded-apple-xl p-8 text-center shadow-apple-lg">
          <div className="w-20 h-20 rounded-apple-sm bg-apple-green/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-apple-green" />
          </div>
          <h1 className="apple-text-title1 apple-label-primary mb-4">¡Cuenta activada!</h1>
          <p className="apple-text-body apple-label-secondary mb-2">Tu cuenta ha sido activada exitosamente</p>
          <p className="apple-text-footnote apple-label-tertiary">Redirigiendo al inicio de sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 apple-surface apple-type flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-apple-blue" />
          </div>
          <h1 className="apple-text-large-title apple-label-primary mb-3">Activar cuenta</h1>
          <p className="apple-text-body apple-label-secondary">
            ¡Hola <span className="text-apple-blue font-semibold">{employee?.full_name}</span>!
          </p>
          <p className="apple-text-subheadline apple-label-secondary mt-2">Crea tu PIN de acceso</p>
        </div>

        {/* Formulario */}
        <div className="apple-card rounded-apple-xl p-8 space-y-6 shadow-apple-lg">
          <div>
            <Label className="apple-text-footnote apple-label-secondary flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4" />
              PIN de 4 dígitos
            </Label>
            <Input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="apple-input h-16 text-2xl text-center tabular-nums"
            />
          </div>

          <div>
            <Label className="apple-text-footnote apple-label-secondary flex items-center gap-2 mb-2">
              <Lock className="w-4 h-4" />
              Confirmar PIN
            </Label>
            <Input
              type="password"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              placeholder="••••"
              className="apple-input h-16 text-2xl text-center tabular-nums"
            />
          </div>

          <div className="bg-apple-blue/12 rounded-apple-md p-4">
            <p className="apple-text-footnote text-apple-blue flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Tu PIN será usado para acceder al sistema
            </p>
          </div>

          <Button
            onClick={handleActivate}
            disabled={activating || !pin || !confirmPin || pin.length !== 4}
            className="apple-btn apple-btn-primary apple-btn-lg w-full h-16"
          >
            {activating ? (
              <>
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
                Activando...
              </>
            ) : (
              <>
                <CheckCircle className="w-6 h-6 mr-3" />
                Activar cuenta
              </>
            )}
          </Button>
        </div>

        <div className="text-center mt-6">
          <p className="apple-text-footnote apple-label-tertiary">
            Al activar tu cuenta aceptas los términos de uso
          </p>
        </div>
      </div>
    </div>
  );
}
