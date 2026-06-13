import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight } from "lucide-react";

/**
 * /upgrade-success?from=stripe
 *
 * Sprint 135 — closes the upgrade loop. Stripe Checkout's success_url
 * lands here (declared by create-checkout-session edge function). The
 * page:
 *
 *   1. Shows a brief confirmation card (so the user sees something
 *      familiar after Stripe's chrome closes).
 *   2. After a short delay, navigates to `smartfixos://refresh-plan` —
 *      a Universal Link claimed by the iOS app (paths declared in
 *      apple-app-site-association). iOS captures it via onOpenURL,
 *      dismisses the SFSafariViewController sheet, and triggers a
 *      PlanGate refresh so the new plan shows immediately.
 *   3. Provides a manual "Vuelve a la app" link in case the auto deep
 *      link doesn't fire (user is on desktop, or the iOS scheme isn't
 *      registered).
 *
 * IMPORTANT: this page is fired from BOTH the SFSafariViewController
 * (iOS user) AND a regular desktop browser (rare, but possible if
 * someone completes Stripe Checkout from a forwarded link). The page
 * degrades gracefully — on desktop the deep link silently fails and
 * the user gets the "Volver a archillaos.com" fallback.
 */
export default function UpgradeSuccess() {
  const [searchParams] = useSearchParams();
  const [deepLinkFired, setDeepLinkFired] = useState(false);

  // 1500ms gives the user a moment to register the success before the
  // SFSafariViewController auto-dismisses.
  useEffect(() => {
    const t = setTimeout(() => {
      // navigator.userAgent gating is unreliable for SFSafariViewController;
      // we just fire the deep link unconditionally. On desktop it's a no-op
      // (browser tries to open the scheme handler and silently fails).
      window.location.href = "smartfixos://refresh-plan";
      setDeepLinkFired(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white antialiased font-sans flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full text-center"
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.55, ease: [0.34, 1.46, 0.5, 1] }}
          className="inline-flex items-center justify-center h-16 w-16 rounded-full mb-6"
          style={{
            background: "rgba(143,201,63,0.15)",
            border: "1px solid rgba(143,201,63,0.35)",
            boxShadow: "0 10px 40px -10px rgba(143,201,63,0.45)",
          }}
        >
          <CheckCircle2 className="h-8 w-8" style={{ color: "#8FC93F" }} />
        </motion.div>

        <h1
          className="text-3xl sm:text-4xl font-semibold tracking-tight"
          style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
        >
          ¡Pago confirmado!
        </h1>
        <p className="mt-4 text-[15px] text-white/55 leading-relaxed">
          {deepLinkFired
            ? "Te llevamos de vuelta a Archilla OS…"
            : "Estamos activando tu plan."}
        </p>

        <p className="mt-2 text-[12px] text-white/35">
          Si tu app no se abre automáticamente, púlsala manualmente desde el ícono.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3">
          <a
            href="smartfixos://refresh-plan"
            className="inline-flex items-center gap-2 rounded-full bg-lime-400 text-black px-6 h-11 text-[13px] font-semibold hover:bg-lime-300 transition-colors shadow-[0_10px_40px_rgba(143,201,63,0.30)]"
          >
            Abrir Archilla OS <ArrowRight className="h-4 w-4" />
          </a>
          <Link
            to="/"
            className="text-[12px] text-white/40 hover:text-white/70 transition-colors"
          >
            o vuelve a archillaos.com
          </Link>
        </div>

        {searchParams.get("from") === "stripe" && (
          <p className="mt-8 text-[11px] uppercase tracking-[0.24em] text-white/25">
            Pago procesado por Stripe
          </p>
        )}
      </motion.div>
    </div>
  );
}
