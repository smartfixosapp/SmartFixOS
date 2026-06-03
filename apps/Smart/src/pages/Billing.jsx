import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, ChevronLeft, Mail, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import appClient from "@/api/appClient";
import { createStripePortalSession } from "@/api/functions";

// ── Billing Portal Page ──────────────────────────────────────────────────
// Permite a los usuarios gestionar su suscripción via Stripe Billing Portal.
//
// Flujos:
//   1. Usuario autenticado → crea portal session directamente.
//   2. Sin sesión → muestra campo de email → backend busca tenant y crea session.
//
// La URL /billing?portal_return=true es el return_url del portal de Stripe.

export default function Billing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const justReturned = searchParams.get("portal_return") === "true";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Try authenticated flow on mount
  useEffect(() => {
    const tryAuthenticatedFlow = async () => {
      try {
        await appClient.auth.me(); // throws if not authenticated
        await redirectToPortal({});
      } catch {
        // Not authenticated — show email form
        setCheckingAuth(false);
      }
    };
    if (!justReturned) {
      tryAuthenticatedFlow();
    } else {
      setCheckingAuth(false);
    }
  }, []);

  const redirectToPortal = async ({ emailOverride }) => {
    setLoading(true);
    setError(null);
    try {
      const body = emailOverride ? { email: emailOverride } : {};
      const result = await createStripePortalSession(body);
      if (result?.url) {
        window.location.href = result.url;
      } else {
        throw new Error(result?.error || "No se pudo generar el enlace del portal.");
      }
    } catch (err) {
      setError(err.message || "Error al conectar con el portal. Intenta de nuevo.");
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.includes("@")) return;
    redirectToPortal({ emailOverride: trimmed });
  };

  // ── Just returned from Stripe portal ───────────────────────────
  if (justReturned) {
    return (
      <div className="relative min-h-dvh overflow-x-hidden bg-black text-white flex items-center justify-center px-4">
        <BgGradient />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-sm"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.06] border border-white/10">
            <CheckCircle className="h-8 w-8 text-white/80" />
          </div>
          <h2 className="text-2xl font-semibold text-white">¡Listo!</h2>
          <p className="mt-2 text-sm text-white/50">
            Los cambios en tu suscripción se reflejarán en la app en los próximos minutos.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90 transition-colors active:scale-95"
          >
            Ir al Dashboard
            <ArrowRight className="h-4 w-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Loading / auth check ────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div className="relative min-h-dvh bg-black flex items-center justify-center">
        <BgGradient />
        <Loader2 className="h-6 w-6 text-white/40 animate-spin" />
      </div>
    );
  }

  // ── Email form ──────────────────────────────────────────────────
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-black text-white">
      <BgGradient />

      {/* Back nav */}
      <div className="absolute top-6 left-6 z-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white transition-colors backdrop-blur-xl"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver
        </button>
      </div>

      <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="w-full max-w-sm"
        >
          {/* Icon */}
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.04]">
              <CreditCard className="h-7 w-7 text-white/70" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Gestionar suscripción</h1>
              <p className="mt-1.5 text-sm text-white/45">
                Ingresa el email de tu cuenta para acceder al portal de Stripe.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                disabled={loading}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-4 pl-11 pr-4 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/25 focus:bg-white/[0.06] transition-all disabled:opacity-50"
              />
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || !email.includes("@")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white py-4 text-sm font-semibold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Acceder al portal
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-white/25">
            Serás redirigido de forma segura al portal de Stripe.
            <br />
            Archilla OS no almacena datos de tarjetas.
          </p>
        </motion.div>
      </main>
    </div>
  );
}

function BgGradient() {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-50"
      style={{
        background:
          "radial-gradient(800px 400px at 50% 0%, rgba(255,255,255,0.04), transparent 60%)",
      }}
      aria-hidden
    />
  );
}
