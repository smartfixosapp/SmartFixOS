import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, RefreshCw, ArrowRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

/**
 * /VerifyEmail — shown after registration to confirm the user should
 * check their inbox for the activation link.
 *
 * Query params:
 *   ?email=user@example.com    — pre-fills the email display
 *   &name=Mi Taller            — shows the tenant name
 *   &trial=2026-05-05          — shows trial end date
 *
 * This is NOT a verification gate — it's a confirmation page.
 * The actual verification happens when the user clicks the activation
 * link in their email, which leads to /TenantActivate.
 */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const email = params.get("email") || "";
  const name = params.get("name") || "tu taller";
  const trial = params.get("trial");

  const trialFormatted = trial
    ? new Date(trial).toLocaleDateString("es", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const res = await fetch("/fn/api/resend-activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResent(true);
        toast.success("Email reenviado");
      } else {
        toast.error("No se pudo reenviar. Intenta en unos minutos.");
      }
    } catch {
      toast.error("Error de conexion");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#000000] text-white flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="liquid-glass-strong rounded-3xl p-8 sm:p-10 max-w-md w-full text-center"
      >
        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-10 h-10 text-cyan-400" />
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">
          Revisa tu email
        </h1>
        <p className="text-white/50 text-sm sm:text-base mb-8">
          Enviamos un link de activacion a
        </p>

        {/* Email display */}
        <div className="liquid-glass rounded-2xl px-5 py-4 mb-6">
          <p className="text-cyan-400 font-bold text-base break-all">{email || "tu email"}</p>
        </div>

        {/* Steps */}
        <div className="text-left space-y-4 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-cyan-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-cyan-400 text-xs font-black">1</span>
            </div>
            <div>
              <p className="text-white/80 text-sm font-semibold">Abre tu bandeja de entrada</p>
              <p className="text-white/40 text-xs">Busca un email de SmartFixOS</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-cyan-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-cyan-400 text-xs font-black">2</span>
            </div>
            <div>
              <p className="text-white/80 text-sm font-semibold">Haz clic en "Activar mi cuenta"</p>
              <p className="text-white/40 text-xs">El link expira en 24 horas</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div>
              <p className="text-white/80 text-sm font-semibold">Configura tu taller y elige tu PIN</p>
              <p className="text-white/40 text-xs">Solo toma 2 minutos</p>
            </div>
          </div>
        </div>

        {/* Trial info */}
        {trialFormatted && (
          <div className="liquid-glass-subtle rounded-xl px-4 py-3 mb-6">
            <p className="text-white/50 text-xs">
              <span className="text-white/70 font-semibold">{name}</span> — Plan activo con trial hasta{" "}
              <span className="text-emerald-400 font-semibold">{trialFormatted}</span>
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleResend}
            disabled={resending || resent}
            variant="ghost"
            className="w-full h-12 rounded-xl text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium"
          >
            {resending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : resent ? (
              <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {resent ? "Email reenviado" : "Reenviar email"}
          </Button>

          <Button
            onClick={() => navigate("/PinAccess")}
            variant="ghost"
            className="w-full h-12 rounded-xl text-white/40 hover:text-white/60 text-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Volver al inicio
          </Button>
        </div>

        {/* Spam hint */}
        <p className="text-white/30 text-[11px] mt-6">
          No lo encuentras? Revisa la carpeta de spam o promociones.
        </p>
      </motion.div>
    </div>
  );
}
