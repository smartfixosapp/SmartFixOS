import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import {
  ensureTenantExists,
  getCurrentSession,
} from "@/lib/auth";
import { supabase } from "../../../../lib/supabase-client.js";
import { STRIPE_PRICES, PLANS, isStripeConfigured } from "@/lib/stripe";

/**
 * /upgrade?plan=solo|team
 *
 * Deep-link wrapper around the Stripe Checkout flow. Use this from
 * emails, marketing banners, or in-app links when you want to drop
 * the user straight into checkout for a specific plan.
 *
 * Behavior:
 *   1. If no session → redirect to /signup?next=/upgrade?plan=X
 *      (after signup confirmation user lands on /dashboard, where
 *       the inline upgrade buttons live; the deep-link is a one-shot
 *       redirect, we don't try to preserve it across login)
 *   2. ensureTenantExists()
 *   3. Validate plan param → call create-checkout-session edge fn →
 *      window.location.href = data.url (Stripe hosted Checkout)
 *
 * Shows a clean loading shell while the redirect happens. Errors
 * surface with a back-to-dashboard CTA.
 */
export default function Upgrade() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("checking"); // checking | redirecting | error
  const [errorMsg, setErrorMsg] = useState("");

  const planSlug = (searchParams.get("plan") || "").toLowerCase();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1. Validar plan param antes de pedir sesión — falla rápido si bad URL
        if (!planSlug || !PLANS[planSlug]) {
          setErrorMsg(
            `Plan inválido: "${planSlug || "(vacío)"}". Las opciones son "solo" o "team".`,
          );
          setStatus("error");
          return;
        }

        // 2. Verificar configuración de Stripe
        if (!isStripeConfigured()) {
          setErrorMsg("Stripe no está configurado todavía. Avísanos a archillastudios@gmail.com.");
          setStatus("error");
          return;
        }

        // 3. Verificar sesión — sin user logueado mandamos a signup
        const session = await getCurrentSession();
        if (!session) {
          // Guardamos el plan para que después de login el usuario regrese
          // (opcional — por ahora solo redirigimos)
          navigate(
            `/signup?next=${encodeURIComponent(`/upgrade?plan=${planSlug}`)}`,
            { replace: true },
          );
          return;
        }

        // 4. Asegurar tenant
        const tenant = await ensureTenantExists();
        if (cancelled) return;

        if (!tenant?.id) {
          setErrorMsg("No pudimos encontrar tu taller. Vuelve al dashboard.");
          setStatus("error");
          return;
        }

        // 5. Si el plan ya está activo, mejor mandarlo al portal o al dashboard
        if (tenant.plan === planSlug && tenant.subscription_status === "active") {
          navigate("/dashboard?already_on_plan=1", { replace: true });
          return;
        }

        // 6. Llamar al edge function de Memo
        setStatus("redirecting");
        const priceId = STRIPE_PRICES[planSlug];
        const { data, error } = await supabase.functions.invoke(
          "create-checkout-session",
          {
            body: {
              price_id:    priceId,
              tenant_id:   tenant.id,
              success_url: `${window.location.origin}/dashboard?upgrade=success`,
              cancel_url:  `${window.location.origin}/dashboard?upgrade=canceled`,
            },
          },
        );
        if (cancelled) return;

        if (error) throw error;
        if (!data?.url) throw new Error("Stripe no devolvió URL de checkout.");

        // 7. Redirect fuera
        window.location.href = data.url;
      } catch (err) {
        if (cancelled) return;
        console.error("[upgrade] error:", err);
        setErrorMsg(
          err?.message ||
            "Algo salió mal abriendo Stripe Checkout. Intenta de nuevo desde tu dashboard.",
        );
        setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [planSlug, navigate]);

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white antialiased font-sans flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        {status === "checking" && (
          <>
            <Loader2 className="h-7 w-7 animate-spin mx-auto mb-5 text-white/55" />
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
            >
              Preparando tu checkout…
            </h1>
            <p className="mt-3 text-[14px] text-white/45">
              Estamos validando tu cuenta y conectando con Stripe.
            </p>
          </>
        )}

        {status === "redirecting" && (
          <>
            <Loader2 className="h-7 w-7 animate-spin mx-auto mb-5 text-lime-400" />
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
            >
              Te llevamos a Stripe…
            </h1>
            <p className="mt-3 text-[14px] text-white/45">
              Si no te redirige en 5 segundos, escríbenos a{" "}
              <a
                href="mailto:archillastudios@gmail.com"
                className="text-white hover:underline underline-offset-4 decoration-white/30"
              >
                archillastudios@gmail.com
              </a>
              .
            </p>
          </>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-6 text-left">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-300" />
              <div>
                <div className="text-base font-semibold text-white">
                  No pudimos iniciar el checkout
                </div>
                <p className="mt-1 text-[13.5px] text-white/65 leading-relaxed">
                  {errorMsg}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-white text-black px-5 h-10 text-[13px] font-semibold hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Volver al dashboard
              </Link>
              <a
                href="mailto:archillastudios@gmail.com"
                className="text-[13px] text-white/55 hover:text-white transition-colors"
              >
                Soporte
              </a>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
