import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, ArrowLeft, CreditCard } from "lucide-react";
import {
  ensureTenantExists,
  getCurrentSession,
} from "@/lib/auth";
import { supabase } from "../../../../lib/supabase-client.js";

/**
 * /dashboard/billing
 *
 * Wrapper around Stripe Customer Portal. Calls our edge function
 * `create-portal-session` which returns the hosted portal URL; we redirect
 * the user to Stripe (cambio de plan, update tarjeta, cancelar).
 *
 * Pre-conditions:
 *   - User authenticated (else → /login)
 *   - Tenant exists (ensureTenantExists creates one if not)
 *   - tenant.stripe_customer_id is set — only after first paid checkout.
 *     If missing, the edge function returns 409 / code='NO_CUSTOMER' and
 *     we show a friendly "subscribe first" screen with a back-to-dashboard
 *     CTA.
 *
 * Coexists with the legacy /billing route (Billing.jsx) which has its own
 * pre-Sprint-134 portal flow via the Deno functions server. This is the
 * canonical Sprint 134+ entry point.
 */
export default function DashboardBilling() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking"); // checking | redirecting | error | no_customer
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1. Sesión
        const session = await getCurrentSession();
        if (!session) {
          navigate(
            "/login?next=" + encodeURIComponent("/dashboard/billing"),
            { replace: true },
          );
          return;
        }

        // 2. Tenant
        const tenant = await ensureTenantExists();
        if (cancelled) return;
        if (!tenant?.id) {
          setErrorMsg("No pudimos encontrar tu taller. Vuelve al dashboard.");
          setStatus("error");
          return;
        }

        // 3. Edge function de Memo
        setStatus("redirecting");
        const { data, error } = await supabase.functions.invoke(
          "create-portal-session",
          {
            body: {
              tenant_id:  tenant.id,
              return_url: `${window.location.origin}/dashboard`,
            },
          },
        );
        if (cancelled) return;

        if (error) {
          // No customer todavía (caso común si está en trial). El edge
          // function devuelve 409 con body { error, code: 'NO_CUSTOMER' };
          // supabase-js lo expone como error.message con el texto adentro.
          const raw = error.message || "";
          if (raw.includes("NO_CUSTOMER") || raw.includes("No Stripe customer")) {
            setStatus("no_customer");
            return;
          }
          throw error;
        }
        if (!data?.url) {
          if (data?.code === "NO_CUSTOMER") {
            setStatus("no_customer");
            return;
          }
          throw new Error("No recibimos URL del portal de Stripe.");
        }

        window.location.href = data.url;
      } catch (err) {
        if (cancelled) return;
        console.error("[dashboard/billing] error:", err);
        setErrorMsg(
          err?.message ||
            "No pudimos abrir el portal. Intenta de nuevo desde tu dashboard.",
        );
        setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white antialiased font-sans flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        {(status === "checking" || status === "redirecting") && (
          <>
            <Loader2 className={`h-7 w-7 animate-spin mx-auto mb-5 ${status === "redirecting" ? "text-lime-400" : "text-white/55"}`} />
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
            >
              {status === "redirecting" ? "Abriendo tu portal…" : "Validando tu cuenta…"}
            </h1>
            <p className="mt-3 text-[14px] text-white/45">
              Te llevamos a Stripe donde puedes cambiar plan, actualizar tarjeta y cancelar.
            </p>
          </>
        )}

        {status === "no_customer" && (
          <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-6 text-left">
            <div className="flex items-start gap-3 mb-4">
              <CreditCard className="h-5 w-5 mt-0.5 flex-shrink-0 text-white/60" />
              <div>
                <div className="text-base font-semibold text-white">
                  Aún no tienes suscripción
                </div>
                <p className="mt-1 text-[13.5px] text-white/65 leading-relaxed">
                  El portal de Stripe se abre después de tu primer pago. Activa un
                  plan desde tu dashboard y luego vuelves aquí para manejarlo.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-lime-400 text-black px-5 h-10 text-[13px] font-semibold hover:bg-lime-300 transition-colors"
              >
                Ver planes en mi dashboard
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-6 text-left">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-300" />
              <div>
                <div className="text-base font-semibold text-white">
                  No pudimos abrir el portal
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
