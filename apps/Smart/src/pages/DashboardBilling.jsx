import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, AlertTriangle, ArrowLeft, CreditCard } from "lucide-react";
import { getCurrentSession } from "@/lib/auth";
import { supabase } from "../../../../lib/supabase-client.js";
import DownloadAppGate from "@/components/DownloadAppGate";

/**
 * /dashboard/billing
 *
 * Sprint 135 pivot — target of the iOS app's SFSafariViewController when
 * the user taps "Manejar suscripción" in-app. Calls create-portal-session
 * edge function and redirects to the Stripe Customer Portal.
 *
 * Pre-conditions:
 *   - User authenticated (else → DownloadAppGate)
 *   - Tenant exists for the user's email (iOS creates it during signup)
 *   - tenant.stripe_customer_id is set — only after first paid checkout.
 *     If missing, the edge function returns 409 / code='NO_CUSTOMER' and
 *     we show a friendly "subscribe first" screen.
 *
 * Coexists with the legacy /billing route (Billing.jsx) which has its own
 * pre-Sprint-134 portal flow via the Deno functions server.
 */
export default function DashboardBilling() {
  const [status, setStatus] = useState("checking"); // checking | redirecting | error | no_customer | no_auth
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // 1. Sesión
        const session = await getCurrentSession();
        if (!session) {
          setStatus("no_auth");
          return;
        }

        // 2. Tenant del owner via RPC (iOS lo crea — la web sólo lee)
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

        // 3. Edge function de portal
        setStatus("redirecting");
        const { data, error } = await supabase.functions.invoke(
          "create-portal-session",
          {
            body: {
              tenant_id:  tenantId,
              return_url: `${window.location.origin}/dashboard/billing?portal=closed`,
            },
          },
        );
        if (cancelled) return;

        if (error) {
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
            "No pudimos abrir el portal. Intenta de nuevo desde la app.",
        );
        setStatus("error");
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // ── No-auth gate ──────────────────────────────────────────────────────
  if (status === "no_auth") {
    return (
      <DownloadAppGate
        title="Maneja tu suscripción desde la app."
        body="Para abrir el portal de Stripe necesitas tener la app SmartFixOS instalada y haber iniciado sesión. Descárgala y desde Ajustes → Suscripción aparece este mismo botón."
      />
    );
  }

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
                  plan desde la app SmartFixOS y luego vuelves aquí para manejarlo.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-5">
              <Link
                to="/upgrade?plan=solo"
                className="inline-flex items-center gap-2 rounded-full bg-lime-400 text-black px-5 h-10 text-[13px] font-semibold hover:bg-lime-300 transition-colors"
              >
                Suscribirme a Solo · $19
              </Link>
              <Link
                to="/upgrade?plan=team"
                className="inline-flex items-center gap-2 rounded-full bg-white text-black px-5 h-10 text-[13px] font-semibold hover:bg-gray-100 transition-colors"
              >
                Suscribirme a Equipo · $49
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
