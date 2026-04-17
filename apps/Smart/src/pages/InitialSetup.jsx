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
      const { appClient } = await import("@/api/appClient");
      await appClient.functions.invoke('sendVerificationEmail', {
        email: formData.email,
        full_name: formData.full_name,
        token: token
      });

      setEmailSent(true);
      toast.success("Email de verificación enviado");
    } catch (error) {
      console.error("Error sending verification:", error);
      toast.error("Error al enviar verificación");
    } finally {
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
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-apple-xs transition-all duration-500 ${
                    s <= step ? "w-12 bg-apple-blue" : "w-8 bg-gray-sys6 dark:bg-gray-sys5"
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
                    <p className="apple-text-subheadline apple-label-secondary">Serás el administrador principal del sistema</p>
                  </div>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Ej: Juan Pérez"
                    className="apple-input h-14 text-lg"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
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
                    <p className="apple-text-subheadline apple-label-secondary">Te enviaremos un link de verificación</p>
                  </div>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="tu@email.com"
                    className="apple-input h-14 text-lg tabular-nums"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                  />
                </div>
              )}

              {/* Step 3: Verificación */}
              {step === 3 && !emailSent && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-apple-purple" />
                    </div>
                    <h2 className="apple-text-title2 apple-label-primary mb-2">Confirma tu información</h2>
                    <p className="apple-text-subheadline apple-label-secondary">Te enviaremos un email para verificar tu cuenta</p>
                  </div>
                  <div className="apple-list rounded-apple-lg p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-apple-blue" />
                      <div>
                        <p className="apple-text-caption1 apple-label-secondary">Nombre</p>
                        <p className="apple-text-body apple-label-primary font-semibold">{formData.full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-apple-green" />
                      <div>
                        <p className="apple-text-caption1 apple-label-secondary">Email</p>
                        <p className="apple-text-body apple-label-primary font-semibold tabular-nums">{formData.email}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Email Sent */}
              {emailSent && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 rounded-apple-sm bg-apple-green/15 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-10 h-10 text-apple-green" />
                  </div>
                  <h2 className="apple-text-title2 apple-label-primary mb-2">¡Email enviado!</h2>
                  <p className="apple-text-body apple-label-secondary mb-6">
                    Hemos enviado un link de verificación a:<br/>
                    <span className="text-apple-blue font-semibold tabular-nums">{formData.email}</span>
                  </p>
                  <div className="bg-apple-blue/12 rounded-apple-md p-4">
                    <p className="apple-text-footnote text-apple-blue">
                      Revisa tu bandeja de entrada y haz clic en el link para continuar
                    </p>
                  </div>
                  <p className="apple-text-caption1 apple-label-tertiary mt-4">
                    Si no recibes el email en 5 minutos, revisa tu carpeta de spam
                  </p>
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-3 mt-8">
                {step > 1 && step < 3 && (
                  <Button
                    onClick={() => setStep(step - 1)}
                    className="apple-btn apple-btn-secondary apple-btn-lg flex-1"
                    disabled={loading}
                  >
                    Atrás
                  </Button>
                )}

                {step < 3 && (
                  <Button
                    onClick={handleNext}
                    className="apple-btn apple-btn-primary apple-btn-lg flex-1"
                  >
                    Siguiente
                  </Button>
                )}

                {step === 3 && !emailSent && (
                  <Button
                    onClick={handleSendVerification}
                    disabled={loading}
                    className="apple-btn apple-btn-primary apple-btn-lg flex-1"
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
                  <p className="apple-text-footnote apple-label-tertiary tabular-nums">
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
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </>
  );
}
