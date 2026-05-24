import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { useHydrateSessionFromURL } from "@/lib/useHydrateSessionFromURL";
import { supabase } from "../../../../lib/supabase-client.js";
import { STRIPE_PRICES, PLANS, isStripeConfigured } from "@/lib/stripe";
import DownloadAppGate from "@/components/DownloadAppGate";

/**
 * /upgrade?plan=solo|team
 *
 * Sprint 135 pivot — this route is the target of the iOS app's
 * SFSafariViewController when the user taps "Upgrade" in-app.
 *
 * Flow:
 *   1. Validate plan param (solo | team)
 *   2. Verify Stripe is configured (frontend pk + price IDs)
 *   3. Read Supabase session. If absent → DownloadAppGate (Sprint 135
 *      removed the web /signup; signup now lives in iOS)
 *   4. Look up the tenant for this user via auth_user_tenants RPC
 *      (no more ensureTenantExists from web — iOS creates the tenant)
 *   5. Call create-checkout-session edge function
 *   6. window.location.href = data.url (Stripe hosted Checkout)
 *
 * On Stripe return, the user lands back here with ?upgrade=success or
 * ?upgrade=canceled — but the iOS app's SFSafariViewController owns the
 * dismissal so the iOS app handles those URLs via its own URL handler.
 * For visitors who somehow hit those return URLs directly in a browser,
 * we still render a graceful confirmation.
 */
export default function Upgrade() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("checking"); // checking | redirecting | error | no_auth
  const [errorMsg, setErrorMsg] = useState("");

  // Hydrate Supabase session from ?t=&r= if iOS app passed JWT (Approach A).
  // Hook always strips those params from the URL before we look at them.
  const hydrated = useHydrateSessionFromURL();

  const planSlug = (searchParams.get("plan") || "").toLowerCase();
  const stripeReturn = searchParams.get("upgrade"); // 'success' | 'canceled' | null

  useEffect(() => {
    let cancelled = false;

    // Wait for the session hydration to settle before reading auth state.
    if (!hydrated) return;

    // If we're rendering a Stripe return URL, skip the checkout creation flow.
    if (stripeReturn === "success" || stripeReturn === "canceled") return;

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

        // 3. Verificar sesión — sin user → DownloadAppGate
        const session = await getCurrentSession();
        if (!session) {
          setStatus("no_auth");
          return;
        }

        // 4. Buscar tenant del owner via auth_user_tenants RPC.
        //    iOS app es responsable de crear el tenant durante el signup
        //    nativo — la web sólo lee.
        const { data: tenantsRpc, error: rpcErr } = await supabase.rpc(
          "auth_user_tenants",
        );
        if (cancelled) return;
        if (rpcErr) throw rpcErr;

        const tenantId =
          Array.isArray(tenantsRpc) && tenantsRpc.length > 0
            ? tenantsRpc[0].tenant_id
            : null;
        if (!tenantId) {
          setErrorMsg(
            "No encontramos un taller asociado a tu cuenta. Crea tu cuenta desde la app SmartFixOS.",
          );
          setStatus("error");
          return;
        }

        setStatus("redirecting");
        const priceId = STRIPE_PRICES[planSlug];
        const { data, error } = await supabase.functions.invoke(
          "create-checkout-session",
          {
            body: {
              price_id:    priceId,
              tenant_id:   tenantId,
              success_url: `${window.location.origin}/upgrade-success?from=stripe`,
              cancel_url:  `${window.location.origin}/upgrade?plan=${planSlug}&upgrade=canceled`,
            },
          },
        );
        if (cancelled) return;

        if (error) {
          let body = data;
          if (!body && error.context && typeof error.context.json === "function") {
            try { body = await error.context.json(); } catch { /* fall through */ }
          }
          const httpStatus = error.context?.status ?? null;
          const bodyError = body?.error || "";

          if (/no such price/i.test(bodyError)) {
            const planName = PLANS[planSlug]?.name || planSlug;
            setErrorMsg(
              `El plan ${planName} no está disponible para checkout en este momento. ` +
              `Escríbenos a archillastudios@gmail.com — lo arreglamos en minutos.`,
            );
            setStatus("error");
            return;
          }
          if (httpStatus === 401) {
            setErrorMsg("Tu sesión expiró. Vuelve a abrir esta pantalla desde la app.");
            setStatus("error");
            return;
          }
          if (httpStatus === 403) {
            setErrorMsg("No tienes permisos para suscribir este taller.");
            setStatus("error");
            return;
          }
          if (httpStatus === 404) {
            setErrorMsg("No encontramos el taller. Cierra esta pantalla e intenta de nuevo desde la app.");
            setStatus("error");
            return;
          }

          throw new Error(bodyError || error.message || "Checkout no disponible");
        }
        if (!data?.url) throw new Error("Stripe no devolvió URL de checkout.");

        window.location.href = data.url;
      } catch (err) {
        if (cancelled) return;
        console.error("[upgrade] error:", err);
        setErrorMsg(
          err?.message ||
            "Algo salió mal abriendo Stripe Checkout. Intenta de nuevo desde la app.",
        );
        setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, [hydrated, planSlug, stripeReturn]);

  // ── Stripe-return short-circuit (rare on web; iOS handles it natively) ─
  if (stripeReturn === "success") {
    return (
      <StripeReturn
        title="¡Pago confirmado!"
        body="Vuelve a la app SmartFixOS — tu plan se activa en segundos."
      />
    );
  }
  if (stripeReturn === "canceled") {
    return (
      <StripeReturn
        title="Pago cancelado"
        body="Tu trial sigue activo. Cuando quieras reintenta desde la app."
      />
    );
  }

  // ── Gate "no autenticado": abre la app ───────────────────────────────
  if (status === "no_auth") {
    const planName = PLANS[planSlug]?.name || "tu plan";
    const planAmount = PLANS[planSlug]?.price;
    return (
      <DownloadAppGate
        planLabel={planAmount ? `Plan ${planName} · $${planAmount}/mes` : null}
        title="Suscríbete desde la app."
        body="Para empezar tu plan necesitas tener la app SmartFixOS instalada. Descárgala, crea tu taller, y desde ahí abrimos Stripe Checkout para ti."
      />
    );
  }

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
                to="/"
                className="inline-flex items-center gap-2 rounded-full bg-white text-black px-5 h-10 text-[13px] font-semibold hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Volver a inicio
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

// ── Stripe return state — visitor lands here on a browser after paying ────
function StripeReturn({ title, body }) {
  const isSuccess = title.includes("confirmado");
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white antialiased font-sans flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full text-center"
      >
        <div className={`inline-flex items-center justify-center h-14 w-14 rounded-full mb-6 ${isSuccess ? "bg-lime-400/15 border border-lime-400/30" : "bg-white/[0.04] border border-white/15"}`}>
          {isSuccess ? (
            <svg className="h-7 w-7" style={{ color: "#8FC93F" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="m9 11 3 3L22 4" />
            </svg>
          ) : (
            <AlertTriangle className="h-7 w-7 text-white/60" />
          )}
        </div>
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
        >
          {title}
        </h1>
        <p className="mt-4 text-[15px] text-white/55 leading-relaxed">{body}</p>
        <Link
          to="/"
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-white text-black px-6 h-11 text-[13px] font-semibold hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Ir a smartfixos.com
        </Link>
      </motion.div>
    </div>
  );
}
