import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, User, Mail, Lock, Check, Sparkles, Eye, EyeOff, KeyRound } from "lucide-react";
import appClient from "@/api/appClient";
import { toast } from "sonner";

export default function Setup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    pin: ""
  });
  const [loading, setLoading] = useState(false);
  const [pinConfirm, setPinConfirm] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const TOTAL_STEPS = 5;

  const handleNext = () => {
    if (step === 1 && !formData.full_name.trim()) {
      toast.error("Ingresa tu nombre");
      return;
    }
    if (step === 2 && !formData.email.trim()) {
      toast.error("Ingresa tu email");
      return;
    }
    if (step === 3) {
      if (formData.password.length < 8) {
        toast.error("La contraseña debe tener mínimo 8 caracteres");
        return;
      }
      if (formData.password !== passwordConfirm) {
        toast.error("Las contraseñas no coinciden");
        return;
      }
    }
    if (step === 4) {
      if (formData.pin.length !== 4) {
        toast.error("El PIN debe tener 4 dígitos");
        return;
      }
      if (formData.pin !== pinConfirm) {
        toast.error("Los PINs no coinciden");
        return;
      }
    }
    setStep(step + 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      // Use backend function to bypass permission checks for the first user
      const response = await appClient.functions.invoke('createFirstAdmin', {
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        pin: formData.pin
      });

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success("¡Administrador creado!");

      setTimeout(() => {
        navigate("/PinAccess", { replace: true });
      }, 1500);
    } catch (error) {
      console.error("Error creating admin:", error);
      toast.error(error.message || "Error al crear administrador");
      setLoading(false);
    }
  };

  return (
    <>
      <div className="setup-fullscreen-container apple-surface apple-type">
        <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl">

            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-block mb-6">
                <img
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                  alt="SmartFixOS"
                  className="h-24 w-auto object-contain mx-auto"
                />
              </div>
              <h1 className="apple-text-large-title apple-label-primary mb-2">
                Bienvenido a SmartFixOS
              </h1>
              <p className="apple-text-body apple-label-secondary">Configuración inicial · Primera vez</p>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-apple-xs transition-all duration-500 ${
                    s <= step ? "w-10 bg-apple-blue" : "w-6 bg-gray-sys6 dark:bg-gray-sys5"
                  }`}
                />
              ))}
            </div>

            {/* Card */}
            <div className="apple-card rounded-apple-xl p-8 shadow-apple-lg">

              {/* Step 1: Nombre */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-apple-blue" />
                    </div>
                    <h2 className="apple-text-title2 apple-label-primary mb-2">¿Cómo te llamas?</h2>
                    <p className="apple-text-subheadline apple-label-secondary">Serás el administrador principal</p>
                  </div>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    className="apple-input h-14 text-lg"
                    autoFocus
                  />
                </div>
              )}

              {/* Step 2: Email */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-apple-sm bg-apple-green/15 flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-8 h-8 text-apple-green" />
                    </div>
                    <h2 className="apple-text-title2 apple-label-primary mb-2">Tu correo electrónico</h2>
                    <p className="apple-text-subheadline apple-label-secondary">Para recuperación y notificaciones</p>
                  </div>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ejemplo@gmail.com"
                    className="apple-input h-14 text-lg tabular-nums"
                    autoFocus
                  />
                </div>
              )}

              {/* Step 3: Contraseña */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-apple-sm bg-apple-indigo/15 flex items-center justify-center mx-auto mb-4">
                      <KeyRound className="w-8 h-8 text-apple-indigo" />
                    </div>
                    <h2 className="apple-text-title2 apple-label-primary mb-2">Contraseña de acceso</h2>
                    <p className="apple-text-subheadline apple-label-secondary">Para iniciar sesión en la cuenta (mín. 8 caracteres)</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="apple-text-footnote apple-label-secondary mb-2 block">Contraseña</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Mínimo 8 caracteres"
                          className="apple-input h-14 text-lg pr-12"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 apple-label-tertiary apple-press"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="apple-text-footnote apple-label-secondary mb-2 block">Confirmar contraseña</label>
                      <div className="relative">
                        <Input
                          type={showPasswordConfirm ? "text" : "password"}
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          placeholder="Repite la contraseña"
                          className="apple-input h-14 text-lg pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 apple-label-tertiary apple-press"
                        >
                          {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: PIN */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-8 h-8 text-apple-purple" />
                    </div>
                    <h2 className="apple-text-title2 apple-label-primary mb-2">Crea tu PIN de acceso</h2>
                    <p className="apple-text-subheadline apple-label-secondary">4 dígitos para cambios de turno de empleados</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="apple-text-footnote apple-label-secondary mb-2 block">PIN (4 dígitos)</label>
                      <Input
                        type="password"
                        maxLength={4}
                        value={formData.pin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setFormData({ ...formData, pin: val });
                        }}
                        placeholder="••••"
                        className="apple-input h-14 text-2xl text-center tabular-nums"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="apple-text-footnote apple-label-secondary mb-2 block">Confirmar PIN</label>
                      <Input
                        type="password"
                        maxLength={4}
                        value={pinConfirm}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setPinConfirm(val);
                        }}
                        placeholder="••••"
                        className="apple-input h-14 text-2xl text-center tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Confirmación */}
              {step === 5 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-apple-sm bg-apple-green/15 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-apple-green" />
                    </div>
                    <h2 className="apple-text-title2 apple-label-primary mb-2">¡Todo listo!</h2>
                    <p className="apple-text-subheadline apple-label-secondary">Confirma y guarda tu PIN antes de continuar</p>
                  </div>

                  {/* PIN destacado — el más importante */}
                  <div className="bg-apple-purple/12 rounded-apple-lg p-5 text-center">
                    <p className="apple-text-footnote text-apple-purple mb-1 font-semibold">Tu PIN de acceso</p>
                    <p className="apple-text-large-title apple-label-primary tabular-nums mb-2" style={{ letterSpacing: '0.3em' }}>{formData.pin}</p>
                    <p className="apple-text-caption1 apple-label-secondary">Úsalo en la pantalla de empleados para entrar al sistema</p>
                  </div>

                  <div className="apple-list rounded-apple-lg p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-apple-blue flex-shrink-0" />
                      <div>
                        <p className="apple-text-caption1 apple-label-secondary">Nombre</p>
                        <p className="apple-text-body apple-label-primary font-semibold">{formData.full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-apple-green flex-shrink-0" />
                      <div>
                        <p className="apple-text-caption1 apple-label-secondary">Email (login + empleado)</p>
                        <p className="apple-text-body apple-label-primary font-semibold tabular-nums">{formData.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-apple-purple flex-shrink-0" />
                      <div>
                        <p className="apple-text-caption1 apple-label-secondary">Rol</p>
                        <p className="apple-text-body apple-label-primary font-semibold">Administrador</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <KeyRound className="w-4 h-4 text-apple-indigo flex-shrink-0" />
                      <div>
                        <p className="apple-text-caption1 apple-label-secondary">Contraseña de cuenta</p>
                        <p className="apple-text-body apple-label-primary font-semibold">••••••••</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-apple-orange/12 rounded-apple-md p-4">
                    <p className="apple-text-footnote text-apple-orange">
                      <strong>Anota tu PIN ahora.</strong> Lo necesitas para seleccionar tu perfil de empleado cada vez que entres al sistema.
                    </p>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 mt-8">
                {step > 1 && step < TOTAL_STEPS && (
                  <Button
                    onClick={() => setStep(step - 1)}
                    className="apple-btn apple-btn-secondary apple-btn-lg flex-1"
                    disabled={loading}
                  >
                    Atrás
                  </Button>
                )}

                {step < TOTAL_STEPS ? (
                  <Button
                    onClick={handleNext}
                    className="apple-btn apple-btn-primary apple-btn-lg flex-1"
                  >
                    Siguiente
                  </Button>
                ) : (
                  <Button
                    onClick={handleFinish}
                    disabled={loading}
                    className="apple-btn apple-btn-primary apple-btn-lg flex-1"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Creando...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        Crear Administrador
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Indicador de paso */}
              <div className="text-center mt-6">
                <p className="apple-text-footnote apple-label-tertiary tabular-nums">
                  Paso {step} de {TOTAL_STEPS}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .setup-fullscreen-container {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          margin: 0;
          padding: 0;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </>
  );
}
