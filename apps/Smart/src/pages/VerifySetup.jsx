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
        const { appClient } = await import("@/api/appClient");
        const tokenRecords = await appClient.entities.SystemConfig.filter({
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
      const { appClient } = await import("@/api/appClient");
      const response = await appClient.functions.invoke('verifyAndCreateAdmin', {
        token: token,
        pin: formData.pin,
        business_name: formData.business_name,
        business_phone: formData.business_phone
      });

      if (response.success) {
        toast.success("¡Cuenta creada exitosamente!");
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
      <div className="setup-fullscreen-container apple-surface apple-type">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-apple-blue/25 border-t-apple-blue rounded-full animate-spin mx-auto mb-4"></div>
          <p className="apple-text-body apple-label-primary">Verificando...</p>
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
      <div className="setup-fullscreen-container apple-surface apple-type">
        <div className="text-center max-w-md p-8">
          <div className="w-20 h-20 rounded-apple-sm bg-apple-red/15 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-apple-red" />
          </div>
          <h2 className="apple-text-title2 apple-label-primary mb-4">Token inválido o expirado</h2>
          <p className="apple-text-body apple-label-secondary mb-6">
            El enlace de verificación no es válido o ha expirado. Por favor, solicita un nuevo enlace.
          </p>
          <Button
            onClick={() => navigate("/InitialSetup", { replace: true })}
            className="apple-btn apple-btn-primary apple-btn-lg"
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
              <div className="flex items-center justify-center gap-2 mb-2">
                <CheckCircle className="w-7 h-7 text-apple-green" />
                <h1 className="apple-text-large-title apple-label-primary">
                  Email verificado
                </h1>
              </div>
              <p className="apple-text-body apple-label-secondary">Completa tu configuración</p>
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

              {/* Step 1: PIN */}
              {step === 1 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-8 h-8 text-apple-purple" />
                    </div>
                    <h2 className="apple-text-title2 apple-label-primary mb-2">Crea tu PIN de acceso</h2>
                    <p className="apple-text-subheadline apple-label-secondary">4 dígitos para entrar al sistema</p>
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
                        value={formData.pinConfirm}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          setFormData({ ...formData, pinConfirm: val });
                        }}
                        placeholder="••••"
                        className="apple-input h-14 text-2xl text-center tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Business Info */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center mx-auto mb-4">
                      <Building className="w-8 h-8 text-apple-blue" />
                    </div>
                    <h2 className="apple-text-title2 apple-label-primary mb-2">Información del negocio</h2>
                    <p className="apple-text-subheadline apple-label-secondary">Opcional · puedes configurarlo después</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="apple-text-footnote apple-label-secondary mb-2 block">Nombre del negocio</label>
                      <Input
                        value={formData.business_name}
                        onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                        placeholder="Ej: TechRepair Solutions"
                        className="apple-input h-14 text-lg"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="apple-text-footnote apple-label-secondary mb-2 block flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        Teléfono del negocio
                      </label>
                      <Input
                        type="tel"
                        value={formData.business_phone}
                        onChange={(e) => setFormData({ ...formData, business_phone: e.target.value })}
                        placeholder="(787) 123-4567"
                        className="apple-input h-14 text-lg tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Confirmation */}
              {step === 3 && (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 rounded-apple-sm bg-apple-green/15 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-10 h-10 text-apple-green" />
                  </div>
                  <h2 className="apple-text-title2 apple-label-primary mb-2">¡Todo listo!</h2>
                  <p className="apple-text-body apple-label-secondary mb-6">
                    Haz clic en finalizar para crear tu cuenta de administrador
                  </p>
                  {formData.business_name && (
                    <div className="bg-apple-blue/12 rounded-apple-md p-4">
                      <p className="apple-text-footnote text-apple-blue">
                        {formData.business_name}
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
                    className="apple-btn apple-btn-secondary apple-btn-lg flex-1"
                    disabled={loading}
                  >
                    Atrás
                  </Button>
                )}

                {step < 3 ? (
                  <Button
                    onClick={handleNext}
                    className="apple-btn apple-btn-primary apple-btn-lg flex-1"
                  >
                    {step === 2 ? 'Siguiente (opcional)' : 'Siguiente'}
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
                        <CheckCircle className="w-5 h-5 mr-2" />
                        Finalizar Setup
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Indicador de paso */}
              <div className="text-center mt-6">
                <p className="apple-text-footnote apple-label-tertiary tabular-nums">
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
          display: flex;
          align-items: center;
          justify-content: center;
        }
      `}</style>
    </>
  );
}
