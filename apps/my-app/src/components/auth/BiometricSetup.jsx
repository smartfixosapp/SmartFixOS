import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Fingerprint, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const getDeviceFingerprint = () => {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;
  const screen = `${window.screen.width}x${window.screen.height}`;
  const fingerprint = btoa(`${ua}${platform}${language}${screen}`);
  return fingerprint;
};

const getDeviceInfo = () => {
  const ua = navigator.userAgent;
  let browser = "Unknown";
  let os = "Unknown";
  
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  
  if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("Mac")) os = "macOS";
  else if (ua.includes("Windows")) os = "Windows";
  
  return { platform: navigator.platform, browser, os };
};

export default function BiometricSetup({ open, onClose, user }) {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (open) {
      checkBiometricSupport();
      checkExistingCredential();
    }
  }, [open, user]);

  const checkBiometricSupport = async () => {
    setChecking(true);
    try {
      if (!window.PublicKeyCredential) {
        setSupported(false);
        return;
      }

      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      setSupported(available);
    } catch (error) {
      console.error("Error checking biometric support:", error);
      setSupported(false);
    } finally {
      setChecking(false);
    }
  };

  const checkExistingCredential = async () => {
    if (!user?.id) return;
    
    try {
      const deviceId = getDeviceFingerprint();
      const credentials = await base44.entities.BiometricCredential.filter({
        user_id: user.id,
        device_id: deviceId,
        active: true
      });
      setHasExisting(credentials?.length > 0);
    } catch (error) {
      console.error("Error checking existing credential:", error);
    }
  };

  const handleEnableBiometric = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const deviceId = getDeviceFingerprint();
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: "911 SmartFix",
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(user.id),
          name: user.email || user.full_name,
          displayName: user.full_name,
        },
        pubKeyCredParams: [
          {
            alg: -7,
            type: "public-key"
          },
          {
            alg: -257,
            type: "public-key"
          }
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        timeout: 60000,
        attestation: "direct"
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      if (!credential) {
        throw new Error("No se pudo crear la credencial");
      }

      await base44.entities.BiometricCredential.create({
        user_id: user.id,
        user_name: user.full_name,
        device_id: deviceId,
        device_fingerprint: deviceId,
        credential_id: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
        public_key: btoa(String.fromCharCode(...new Uint8Array(credential.response.getPublicKey?.() || []))),
        device_info: getDeviceInfo(),
        last_used: new Date().toISOString(),
        active: true
      });

      toast.success("✅ Autenticación biométrica habilitada");
      onClose?.();
    } catch (error) {
      console.error("Error enabling biometric:", error);
      
      if (error.name === "NotAllowedError") {
        toast.error("Acceso denegado o cancelado");
      } else if (error.name === "NotSupportedError") {
        toast.error("Autenticación biométrica no soportada en este dispositivo");
      } else {
        toast.error("Error al habilitar biométricos: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisableBiometric = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const deviceId = getDeviceFingerprint();
      const credentials = await base44.entities.BiometricCredential.filter({
        user_id: user.id,
        device_id: deviceId,
        active: true
      });

      for (const cred of credentials) {
        await base44.entities.BiometricCredential.update(cred.id, { active: false });
      }

      toast.success("✅ Autenticación biométrica deshabilitada");
      setHasExisting(false);
    } catch (error) {
      console.error("Error disabling biometric:", error);
      toast.error("Error al deshabilitar biométricos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-[#2B2B2B] to-black border-red-600/30">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Fingerprint className="w-6 h-6 text-red-500" />
            Autenticación Biométrica
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {checking ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-2" />
              <p className="text-gray-400 text-sm">Verificando compatibilidad...</p>
            </div>
          ) : !supported ? (
            <div className="bg-yellow-600/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-yellow-300 font-semibold text-sm mb-1">
                    Biométricos no disponibles
                  </p>
                  <p className="text-gray-400 text-xs">
                    Este dispositivo no soporta autenticación biométrica o no tiene un sensor configurado.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center">
                    <Fingerprint className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold">Login Rápido</h3>
                    <p className="text-xs text-gray-400">FaceID / TouchID / Huella</p>
                  </div>
                  {hasExisting && (
                    <Check className="w-5 h-5 text-green-500" />
                  )}
                </div>

                <p className="text-gray-300 text-sm mb-4">
                  {hasExisting 
                    ? "La autenticación biométrica ya está habilitada en este dispositivo."
                    : "Habilita la autenticación biométrica para iniciar sesión de forma rápida y segura usando tu rostro o huella digital."}
                </p>

                <div className="bg-blue-600/10 border border-blue-500/30 rounded-lg p-3 mb-4">
                  <p className="text-blue-300 text-xs">
                    <strong>Seguridad:</strong> Tus datos biométricos nunca salen de tu dispositivo. 
                    Solo se guarda una clave segura que confirma tu identidad.
                  </p>
                </div>

                {hasExisting ? (
                  <Button
                    onClick={handleDisableBiometric}
                    disabled={loading}
                    variant="outline"
                    className="w-full border-red-600/30 text-red-400 hover:bg-red-600/20"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Deshabilitando...
                      </>
                    ) : (
                      "Deshabilitar Biométricos"
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleEnableBiometric}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Configurando...
                      </>
                    ) : (
                      <>
                        <Fingerprint className="w-4 h-4 mr-2" />
                        Habilitar Biométricos
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="text-center">
                <Button
                  onClick={onClose}
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                  disabled={loading}
                >
                  Cerrar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
