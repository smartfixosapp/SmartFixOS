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

      toast.success("✅ ¡Administrador creado!");
      
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
      <div className="setup-fullscreen-container">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        </div>

        <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl">
            
            {/* Header */}
            <div className="text-center mb-8">
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 to-emerald-500/30 blur-2xl animate-pulse"></div>
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                  alt="SmartFixOS"
                  className="relative h-24 w-auto object-contain mx-auto drop-shadow-[0_4px_16px_rgba(0,168,232,0.8)]"
                />
              </div>
              <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 via-emerald-400 to-lime-400 bg-clip-text text-transparent mb-2">
                Bienvenido a SmartFixOS
              </h1>
              <p className="text-gray-400 text-lg">Configuración inicial • Primera vez</p>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    s <= step ? "w-10 bg-gradient-to-r from-cyan-500 to-emerald-500" : "w-6 bg-slate-700"
                  }`}
                />
              ))}
            </div>

            {/* Card */}
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-2xl border-2 border-cyan-500/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(6,182,212,0.3)]">
              
              {/* Step 1: Nombre */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(6,182,212,0.6)]">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">¿Cómo te llamas?</h2>
                    <p className="text-gray-400">Serás el administrador principal</p>
                  </div>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    className="h-14 text-lg bg-black/40 border-cyan-500/30 text-white"
                    autoFocus
                  />
                </div>
              )}

              {/* Step 2: Email */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(16,185,129,0.6)]">
                      <Mail className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Tu correo electrónico</h2>
                    <p className="text-gray-400">Para recuperación y notificaciones</p>
                  </div>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="ejemplo@gmail.com"
                    className="h-14 text-lg bg-black/40 border-emerald-500/30 text-white"
                    autoFocus
                  />
                </div>
              )}

              {/* Step 3: Contraseña */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(59,130,246,0.6)]">
                      <KeyRound className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Contraseña de acceso</h2>
                    <p className="text-gray-400">Para iniciar sesión en la cuenta (mín. 8 caracteres)</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block">Contraseña</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="Mínimo 8 caracteres"
                          className="h-14 text-lg bg-black/40 border-blue-500/30 text-white pr-12"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block">Confirmar contraseña</label>
                      <div className="relative">
                        <Input
                          type={showPasswordConfirm ? "text" : "password"}
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          placeholder="Repite la contraseña"
                          className="h-14 text-lg bg-black/40 border-blue-500/30 text-white pr-12"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
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
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(168,85,247,0.6)]">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Crea tu PIN de acceso</h2>
                    <p className="text-gray-400">4 dígitos para cambios de turno de empleados</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block">PIN (4 dígitos)</label>
                      <Input
                        type="password"
                        maxLength={4}
                        value={formData.pin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setFormData({ ...formData, pin: val });
                        }}
                        placeholder="••••"
                        className="h-14 text-2xl tracking-widest text-center bg-black/40 border-purple-500/30 text-white"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block">Confirmar PIN</label>
                      <Input
                        type="password"
                        maxLength={4}
                        value={pinConfirm}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setPinConfirm(val);
                        }}
                        placeholder="••••"
                        className="h-14 text-2xl tracking-widest text-center bg-black/40 border-purple-500/30 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 5: Confirmación */}
              {step === 5 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(16,185,129,0.6)] animate-pulse">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">¡Todo listo!</h2>
                    <p className="text-gray-400">Confirma y guarda tu PIN antes de continuar</p>
                  </div>

                  {/* PIN destacado — el más importante */}
                  <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50 rounded-2xl p-5 text-center">
                    <p className="text-xs text-purple-300 mb-1 font-semibold uppercase tracking-wider">Tu PIN de acceso</p>
                    <p className="text-5xl font-black tracking-[0.3em] text-white mb-2">{formData.pin}</p>
                    <p className="text-xs text-purple-200/70">📱 Úsalo en la pantalla de empleados para entrar al sistema</p>
                  </div>

                  <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400">Nombre</p>
                        <p className="text-white font-semibold">{formData.full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400">Email (login + empleado)</p>
                        <p className="text-white font-semibold">{formData.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Shield className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400">Rol</p>
                        <p className="text-white font-semibold">Administrador</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <KeyRound className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400">Contraseña de cuenta</p>
                        <p className="text-white font-semibold">••••••••</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                    <p className="text-amber-200 text-xs">
                      ⚠️ <strong>Anota tu PIN ahora.</strong> Lo necesitas para seleccionar tu perfil de empleado cada vez que entres al sistema.
                    </p>
                  </div>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 mt-8">
                {step > 1 && step < TOTAL_STEPS && (
                  <Button
                    onClick={() => setStep(step - 1)}
                    variant="outline"
                    className="flex-1 h-14 border-white/20 text-white hover:bg-white/5"
                    disabled={loading}
                  >
                    Atrás
                  </Button>
                )}

                {step < TOTAL_STEPS ? (
                  <Button
                    onClick={handleNext}
                    className="flex-1 h-14 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold"
                  >
                    Siguiente →
                  </Button>
                ) : (
                  <Button
                    onClick={handleFinish}
                    disabled={loading}
                    className="flex-1 h-14 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold"
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
                <p className="text-gray-500 text-sm">
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
          background: radial-gradient(circle at top, #0f172a 0%, #020617 45%, #000 90%);
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </>
  );
}
