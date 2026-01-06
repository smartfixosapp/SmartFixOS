import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, User, Sparkles, Check, Send } from "lucide-react";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";

export default function InitialSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    full_name: "",
    email: ""
  });
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Verificar si ya existe un administrador
  useEffect(() => {
    const checkExistingAdmin = async () => {
      try {
        const users = await dataClient.entities.User.filter({ role: 'admin', active: true });
        if (users && users.length > 0) {
          // Ya existe un admin, redirigir
          navigate("/PinAccess", { replace: true });
        }
      } catch (error) {
        console.log("No admin found, continuing setup");
      }
    };
    checkExistingAdmin();
  }, [navigate]);

  const handleNext = () => {
    if (step === 1 && !formData.full_name.trim()) {
      toast.error("Ingresa tu nombre completo");
      return;
    }
    if (step === 2 && !formData.email.trim()) {
      toast.error("Ingresa tu email");
      return;
    }
    if (step === 2 && !formData.email.includes('@')) {
      toast.error("Email inválido");
      return;
    }
    setStep(step + 1);
  };

  const handleSendVerification = async () => {
    setLoading(true);
    try {
      // Generar token único
      const token = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Guardar token en la base de datos
      await dataClient.entities.SystemConfig.create({
        key: `verification_token_${token}`,
        value: JSON.stringify({
          full_name: formData.full_name,
          email: formData.email,
          created_at: new Date().toISOString()
        }),
        category: 'setup',
        description: 'Email verification token for initial setup'
      });

      // Enviar email de verificación
      const { base44 } = await import("@/api/base44Client");
      await base44.functions.invoke('sendVerificationEmail', {
        email: formData.email,
        full_name: formData.full_name,
        token: token
      });

      setEmailSent(true);
      toast.success("📧 Email de verificación enviado");
    } catch (error) {
      console.error("Error sending verification:", error);
      toast.error("Error al enviar verificación");
    } finally {
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
              <p className="text-gray-400 text-lg">Configuración Inicial • Primera Vez</p>
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
              
              {/* Step 1: Nombre */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(6,182,212,0.6)]">
                      <User className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">¿Cómo te llamas?</h2>
                    <p className="text-gray-400">Serás el administrador principal del sistema</p>
                  </div>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    className="h-14 text-lg bg-black/40 border-cyan-500/30 text-white"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
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
                    <p className="text-gray-400">Te enviaremos un link de verificación</p>
                  </div>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="tu@email.com"
                    className="h-14 text-lg bg-black/40 border-emerald-500/30 text-white"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  />
                </div>
              )}

              {/* Step 3: Verificación */}
              {step === 3 && !emailSent && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(168,85,247,0.6)] animate-pulse">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Confirma tu información</h2>
                    <p className="text-gray-400">Te enviaremos un email para verificar tu cuenta</p>
                  </div>
                  <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-cyan-400" />
                      <div>
                        <p className="text-xs text-gray-400">Nombre</p>
                        <p className="text-white font-bold">{formData.full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-emerald-400" />
                      <div>
                        <p className="text-xs text-gray-400">Email</p>
                        <p className="text-white font-bold">{formData.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Sent */}
              {emailSent && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center mx-auto mb-4 shadow-[0_0_40px_rgba(16,185,129,0.6)] animate-bounce">
                    <Check className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">¡Email Enviado!</h2>
                  <p className="text-gray-400 mb-6">
                    Hemos enviado un link de verificación a:<br/>
                    <span className="text-cyan-400 font-bold">{formData.email}</span>
                  </p>
                  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
                    <p className="text-cyan-300 text-sm">
                      📬 Revisa tu bandeja de entrada y haz clic en el link para continuar
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-4">
                    Si no recibes el email en 5 minutos, revisa tu carpeta de spam
                  </p>
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
                
                {step < 3 && (
                  <Button
                    onClick={handleNext}
                    className="flex-1 h-14 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold"
                  >
                    Siguiente →
                  </Button>
                )}

                {step === 3 && !emailSent && (
                  <Button
                    onClick={handleSendVerification}
                    disabled={loading}
                    className="flex-1 h-14 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5 mr-2" />
                        Enviar Verificación
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Indicador de paso */}
              {!emailSent && (
                <div className="text-center mt-6">
                  <p className="text-gray-500 text-sm">
                    Paso {step} de 3
                  </p>
                </div>
              )}
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
