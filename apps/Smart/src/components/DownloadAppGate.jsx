import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Smartphone } from "lucide-react";

/**
 * DownloadAppGate
 *
 * Sprint 135 pivot — when an unauthenticated visitor lands on /upgrade or
 * /dashboard/billing (web routes only used as targets of iOS's
 * SFSafariViewController), we no longer redirect them to a web /signup —
 * that page is gone. Instead we show this gate: "open the app to do this."
 *
 * Props:
 *   - title      — h1 text (e.g. "Suscríbete desde la app")
 *   - body       — paragraph below the title explaining why
 *   - planLabel  — optional pill at the top ("Plan TEAM · $49/mes")
 */
export default function DownloadAppGate({ title, body, planLabel }) {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white antialiased font-sans flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-md w-full text-center"
      >
        {planLabel && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-lime-300 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
            {planLabel}
          </span>
        )}

        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-white/[0.04] border border-white/10 mb-6">
          <Smartphone className="h-7 w-7 text-lime-400" />
        </div>

        <h1
          className="text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.1]"
          style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
        >
          {title}
        </h1>

        {body && (
          <p className="mt-4 text-[15px] text-white/55 leading-relaxed">
            {body}
          </p>
        )}

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          {/* iOS — TestFlight / App Store */}
          <button
            type="button"
            onClick={() => {
              // Send to landing's waitlist anchor where the real CTAs live
              window.location.href = "/#waitlist";
            }}
            className="inline-flex items-center gap-3.5 rounded-2xl bg-white text-black px-6 py-3.5 hover:bg-gray-50 transition-colors shadow-[0_10px_40px_rgba(255,255,255,0.10)]"
          >
            <svg viewBox="0 0 814 1000" className="h-7 w-7 fill-black" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.8 113.4-317.7 224.5-317.7 100.4 0 163.4 60.2 220.8 60.2 54.7 0 127.9-62.5 240.3-62.5zm-284.4-154.8c22.6-26.8 39.3-65.4 39.3-104.5 0-5.5-.5-11.1-1.6-15.4C450 73.9 385.5 111 345.4 155.1c-20.3 22.6-40.9 61-40.9 101.1 0 6 1 12 1.5 14.2 2.6.5 6.8.9 10.8.9 36.4 0 97.2-35.5 127-85.2z" />
            </svg>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[11px] font-medium text-gray-500">Descarga</span>
              <span className="text-base font-semibold text-black tracking-tight">la app iOS</span>
            </div>
          </button>

          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 h-11 text-[13px] font-semibold text-white/75 hover:bg-white/[0.04] hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a inicio
          </Link>
        </div>

        <p className="mt-10 text-[13px] text-white/40">
          ¿Ya tienes la app y aún ves esta pantalla?{" "}
          <a
            href="mailto:archillastudios@gmail.com"
            className="text-white hover:underline underline-offset-4 decoration-white/30"
          >
            Escríbenos
          </a>
          .
        </p>
      </motion.div>
    </div>
  );
}
