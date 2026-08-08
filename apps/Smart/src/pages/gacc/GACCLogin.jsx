/**
 * GACCLogin — Acceso al panel SuperAdmin (GACC) por OTP + PIN secreto.
 *
 * Reemplaza el antiguo gate de /PinAccess (eliminado del flujo web) y cierra
 * el hallazgo crítico de SECURITY_AUDIT_2026-04-21.md: ya no hay ninguna
 * service_role key en el navegador. Este flujo llama a sendAdminOtp /
 * verifyAdminOtp (apps/Smart/src/Functions/) y, si el OTP + PIN son
 * correctos, guarda el token de sesión de panel que emite verifyAdminOtp.
 * Ese token es lo único que el navegador conoce — gaccDataProxy.js lo
 * valida server-side en cada query antes de usar la service_role key real.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUPER_SESSION_KEY } from "./gaccContext";

const FUNCTIONS_URL = import.meta.env.VITE_FUNCTION_URL || "http://localhost:8686";
const DEFAULT_ADMIN_EMAIL = "smartfixosapp@gmail.com";

export default function GACCLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState("email"); // email -> otp
  const [email, setEmail] = useState(DEFAULT_ADMIN_EMAIL);
  const [sessionId, setSessionId] = useState(null);
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/sendAdminOtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "No se pudo enviar el código.");
        return;
      }
      if (!json.sessionId) {
        // El servidor responde success:true sin sessionId cuando el email
        // no coincide con SUPER_ADMIN_EMAIL, para no revelar cuál es válido.
        toast.success("Si el email es válido, recibirás un código.");
        return;
      }
      setSessionId(json.sessionId);
      setStep("otp");
      toast.success("Código enviado. Revisa tu email.");
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${FUNCTIONS_URL}/verifyAdminOtp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, otp, adminPin: pin }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error || "Código o PIN incorrecto.");
        return;
      }
      localStorage.setItem(SUPER_SESSION_KEY, JSON.stringify({
        role: "saas_owner",
        token: json.token,
        expiresAt: json.expiresAt,
        loginTime: Date.now(),
      }));
      toast.success("Acceso concedido.");
      navigate("/GACC", { replace: true });
    } catch {
      toast.error("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-3">
            <Shield className="h-6 w-6 text-cyan-400" />
          </div>
          <h1 className="text-white font-semibold text-lg">Panel SuperAdmin</h1>
          <p className="text-gray-500 text-sm">Archilla OS · GACC</p>
        </div>

        {step === "email" && (
          <form onSubmit={requestOtp} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="bg-white/[0.03] border-white/10 text-white"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar código"}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verifyOtp} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Código de 6 dígitos</label>
              <Input
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                required
                autoFocus
                className="bg-white/[0.03] border-white/10 text-white tracking-[0.3em] text-center font-mono text-lg"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">PIN secreto</label>
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                className="bg-white/[0.03] border-white/10 text-white"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-cyan-600 hover:bg-cyan-500">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("email"); setOtp(""); setPin(""); }}
              className="w-full text-xs text-gray-500 hover:text-gray-300"
            >
              Solicitar otro código
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
