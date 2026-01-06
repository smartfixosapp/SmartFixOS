import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Building, Phone, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function VerifySetup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    pin: "",
    pinConfirm: "",
    business_name: "",
    business_phone: ""
  });
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // Verificar token al cargar
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        toast.error("Token inválido");
        setVerifying(false);
        return;
      }

      try {
        const { base44 } = await import("@/api/base44Client");
        const tokenRecords = await base44.entities.SystemConfig.filter({
          key: `verification_token_${token}`,
          category: 'setup'
        });

        if (tokenRecords && tokenRecords.length > 0) {
          setTokenValid(true);
        } else {
          toast.error("Token inválido o expirado");
        }
      } catch (error) {
        console.error("Error verifying token:", error);
        toast.error("Error al verificar token");
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleNext = () => {
    if (step === 1) {
      if (formData.pin.length !== 4) {
        toast.error("El PIN debe tener 4 dígitos");
        return;
      }
      if (formData.pin !== formData.pinConfirm) {
        toast.error("Los PINs no coinciden");
        return;
      }
    }
    setStep(step + 1);
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const { base44 } = await import("@/api/base44Client");
      const response = await base44.functions.invoke('verifyAndCreateAdmin', {
        token: token,
        pin: formData.pin,
        business_name: formData.business_name,
        business_phone: formData.business_phone
      });

      if (response.success) {
        toast.success("✅ ¡Cuenta creada exitosamente!");
        setTimeout(() => {
          navigate("/PinAccess", { replace: true });
        }, 1500);
      } else {
        toast.error(response.error || "Error al crear cuenta");
        setLoading(false);
      }
    } catch (error) {
      console.error("Error creating account:", error);
      toast.error("Error al crear cuenta");
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="setup-fullscreen-container">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Verificando...</p>
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
            background: radial-gradient(circle at top, #0f172a 0%, #020617 45%, #000 90%);
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="setup-fullscreen-container">
        <div className="text-center max-w-md p-8">
          <div className="w-20 h-20 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Token Inválido o Expirado</h2>
          <p className="text-gray-400 mb-6">
            El enlace de verificación no es válido o ha expirado. Por favor, solicita un nuevo enlace.
          </p>
          <Button
            onClick={() => navigate("/InitialSetup", { replace: true })}
            className="bg-gradient-to-r from-cyan-600 to-emerald-600"
          >
            Volver al inicio
          </Button>
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
            background: radial-gradient(circle at top, #0f172a 0%, #020617 45%, #000 90%);
            display: flex;
            align-items: center;
            justify-content: center;
          }
        `}</style>
      </div>
    );
  }

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
                Email Verificado ✓
              </h1>
              <p className="text-gray-400 text-lg">Completa tu configuración</p>
            </div>

            {/* Progress */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all duration-500 ${
                    s <= step ? "w-12 bg-gradient-to-r from-cyan-500 to-emerald-500" : "w-8 bg-slate-700"
                  }`}
                />
              ))}
            </div>

            {/* Card */}
            <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-2xl border-2 border-cyan-500/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(6,182,212,0.3)]">
              
              {/* Step 1: PIN */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(168,85,247,0.6)]">
                      <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Crea tu PIN de acceso</h2>
                    <p className="text-gray-400">4 dígitos para entrar al sistema</p>
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
                        value={formData.pinConfirm}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setFormData({ ...formData, pinConfirm: val });
                        }}
                        placeholder="••••"
                        className="h-14 text-2xl tracking-widest text-center bg-black/40 border-purple-500/30 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Business Info */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(6,182,212,0.6)]">
                      <Building className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Información del Negocio</h2>
                    <p className="text-gray-400">Opcional - puedes configurarlo después</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block">Nombre del Negocio</label>
                      <Input
                        value={formData.business_name}
                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                        placeholder="Ej: TechRepair Solutions"
                        className="h-14 text-lg bg-black/40 border-cyan-500/30 text-white"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-2 block flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Teléfono del Negocio
                      </label>
                      <Input
                        type="tel"
                        value={formData.business_phone}
                        onChange={(e) => setFormData({ ...formData, business_phone: e.target.value })}
                        placeholder="(787) 123-4567"
                        className="h-14 text-lg bg-black/40 border-cyan-500/30 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Confirmation */}
              {step === 3 && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(16,185,129,0.6)] animate-pulse">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">¡Todo Listo!</h2>
                  <p className="text-gray-400 mb-6">
                    Haz clic en finalizar para crear tu cuenta de administrador
                  </p>
                  {formData.business_name && (
                    <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-4">
                      <p className="text-cyan-300 text-sm">
                        🏢 {formData.business_name}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 mt-8">
                {step > 1 && step < 3 && (
                  <Button
                    onClick={() => setStep(step - 1)}
                    variant="outline"
                    className="flex-1 h-14 border-white/20 text-white hover:bg-white/5"
                    disabled={loading}
                  >
                    Atrás
                  </Button>
                )}
                
                {step < 3 ? (
                  <Button
                    onClick={handleNext}
                    className="flex-1 h-14 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold"
                  >
                    {step === 2 ? 'Siguiente (Opcional) →' : 'Siguiente →'}
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
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Finalizar Setup
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Indicador de paso */}
              <div className="text-center mt-6">
                <p className="text-gray-500 text-sm">
                  Paso {step} de 3
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
