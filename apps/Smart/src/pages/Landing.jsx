import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { Check, ArrowDown, ArrowRight, Plus, Minus, Loader2, CheckCircle2, FlaskConical } from "lucide-react";
import { supabase } from "../../../../lib/supabase-client.js";

import ss01 from "../assets/images/screenshots/ss01.png";
import ss02 from "../assets/images/screenshots/ss02.png";
import ss03 from "../assets/images/screenshots/ss03.png";

// ─────────────────────────────────────────────────────────────────────────────
//  FEATURE FLAGS
// ─────────────────────────────────────────────────────────────────────────────
const TESTFLIGHT_ENABLED = false;
const TESTFLIGHT_URL     = "https://testflight.apple.com/join/XXXXXXXX";
const ANDROID_ENABLED    = false;
const GOOGLE_PLAY_URL    = "";

function HashHandoffNotice() {
  const [tokens, setTokens] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const captured = window.__SFOS_AUTH_HASH;
    if (captured && captured.indexOf("access_token") !== -1) {
      setTokens(captured);
      try { delete window.__SFOS_AUTH_HASH; } catch (_) {}
    }
  }, []);

  if (!tokens || dismissed) return null;

  const deepLink = `smartfixos://auth-callback${tokens}`;

  return (
    <div className="fixed inset-0 z-[100] bg-[#0a0a0a]/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#111] border border-white/[0.08] rounded-2xl p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center"
             style={{ background: "rgba(143,201,63,0.15)" }}>
          <CheckCircle2 className="w-7 h-7" style={{ color: "#8FC93F" }} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white mb-2"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>
          Casi listo
        </h2>
        <p className="text-white/65 text-[15px] leading-relaxed mb-7">
          Tu enlace de acceso está listo. Abre la app SmartFixOS para terminar de iniciar sesión.
        </p>
        <a
          href={deepLink}
          className="block w-full bg-white text-black font-semibold py-3.5 rounded-xl hover:bg-white/90 transition-colors mb-3"
        >
          Abrir en SmartFixOS
        </a>
        <button
          onClick={() => setDismissed(true)}
          className="block w-full text-white/45 hover:text-white text-[13px] py-2 transition-colors"
        >
          Cerrar
        </button>
        <p className="mt-5 text-[12px] text-white/35 leading-relaxed">
          ¿No tienes la app aún? Descárgala desde el App Store y vuelve a intentar el enlace.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Animated wordmark — "smartfix[engranaje]s"
// ─────────────────────────────────────────────────────────────────────────────
const GEAR_PATH = "M 90.57 39.13 L 91.48 43.43 L 99.38 42.18 L 99.38 57.82 L 91.48 56.57 L 90.57 60.87 L 89.21 65.05 L 96.68 67.92 L 88.86 81.47 L 82.64 76.43 L 79.70 79.70 L 76.43 82.64 L 81.47 88.86 L 67.92 96.68 L 65.05 89.21 L 60.87 90.57 L 56.57 91.48 L 57.82 99.38 L 42.18 99.38 L 43.43 91.48 L 39.13 90.57 L 34.95 89.21 L 32.08 96.68 L 18.53 88.86 L 23.57 82.64 L 20.30 79.70 L 17.36 76.43 L 11.14 81.47 L 3.32 67.92 L 10.79 65.05 L 9.43 60.87 L 8.52 56.57 L 0.62 57.82 L 0.62 42.18 L 8.52 43.43 L 9.43 39.13 L 10.79 34.95 L 3.32 32.08 L 11.14 18.53 L 17.36 23.57 L 20.30 20.30 L 23.57 17.36 L 18.53 11.14 L 32.08 3.32 L 34.95 10.79 L 39.13 9.43 L 43.43 8.52 L 42.18 0.62 L 57.82 0.62 L 56.57 8.52 L 60.87 9.43 L 65.05 10.79 L 67.92 3.32 L 81.47 11.14 L 76.43 17.36 L 79.70 20.30 L 82.64 23.57 L 88.86 18.53 L 96.68 32.08 L 89.21 34.95 L 90.57 39.13 Z";

function AnimatedWordmark({ size = "hero", centerColor = "#0a0a0a" }) {
  const isHero = size === "hero";
  const clipId = `gear-clip-${size}`;

  // Letters enter quick (40ms stagger) so attention lands on the gear faster.
  const letterCount = 8; // "smartfix"
  const letterStagger = 0.04;
  const gearDelay  = 0.05 + letterCount * letterStagger; // 0.37s
  const finalSDelay = gearDelay + 0.25; // gear lands first, then the closing "s"

  return (
    <div
      className={
        isHero
          ? "flex items-center justify-center font-[800] leading-[0.85] tracking-[-0.045em] text-white select-none"
          : "flex items-center justify-center font-[700] leading-[0.85] tracking-[-0.04em] text-white select-none"
      }
      style={{
        fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
        fontSize: isHero ? "clamp(64px, 14vw, 180px)" : "44px",
      }}
      aria-label="smartfixos"
    >
      {"smartfix".split("").map((ch, i) => (
        <motion.span
          key={`l-${i}`}
          initial={{ opacity: 0, y: "0.5em", scale: 0.85 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: 0.05 + i * letterStagger,
            duration: 0.6,
            ease: [0.16, 1, 0.3, 1],
          }}
          style={{ display: "inline-block" }}
        >
          {ch}
        </motion.span>
      ))}

      {/* Engranaje — entrada con rotación + overshoot, después loop infinito */}
      <motion.span
        initial={{ opacity: 0, scale: 0.3, rotate: -160 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{
          delay: gearDelay,
          duration: 0.95,
          ease: [0.34, 1.46, 0.5, 1], // overshoot back-out — el gear "encaja"
        }}
        className="relative inline-grid place-items-center"
        style={{ width: "0.92em", height: "0.92em", margin: "0 -0.02em" }}
        aria-hidden
      >
        {/* Halo: flash brillante en la entrada, después pulso suave */}
        <motion.span
          className="pointer-events-none absolute inset-[8%] rounded-full -z-10"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 0.55], scale: [0.5, 1.45, 1] }}
          transition={{
            delay: gearDelay,
            duration: 0.9,
            times: [0, 0.45, 1],
            ease: "easeOut",
          }}
          style={{
            background:
              "radial-gradient(circle, rgba(143,201,63,0.32) 0%, rgba(31,160,220,0.28) 50%, transparent 75%)",
            filter: "blur(8px)",
            animation: `sfx-halo 4s ease-in-out infinite ${gearDelay + 0.9}s`,
          }}
        />
        <svg
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            width: "100%", height: "100%", overflow: "visible",
            transformOrigin: "50% 50%",
            // Spin starts after the entrance overshoot finishes
            animation: `sfx-gear-spin 14s linear infinite ${gearDelay + 0.95}s`,
          }}
        >
          <defs>
            <clipPath id={clipId}><path d={GEAR_PATH} /></clipPath>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect x="0"  y="0" width="50" height="100" fill="#1FA0DC" />
            <rect x="50" y="0" width="50" height="100" fill="#8FC93F" />
          </g>
          <circle cx="50" cy="50" r="22" fill={centerColor} />
        </svg>
      </motion.span>

      {/* "s" final — entra después del gear, completa la palabra */}
      <motion.span
        initial={{ opacity: 0, y: "0.5em", scale: 0.85 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: finalSDelay, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: "inline-block" }}
      >
        s
      </motion.span>

      <style>{`
        @keyframes sfx-gear-spin { to { transform: rotate(360deg); } }
        @keyframes sfx-halo {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Hero — wordmark + tagline + social proof + botones de descarga
// ─────────────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
      <AnimatedWordmark />

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.7 }}
        className="mt-10 text-center text-base sm:text-lg text-white/55 max-w-md leading-relaxed font-medium"
      >
        El sistema operativo para talleres de reparación.
        <br />
        Hecho por un técnico, para técnicos.
      </motion.p>

      {/* Social proof line — diseñado y probado en talleres reales */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.7 }}
        className="mt-6 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/35"
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "#8FC93F", boxShadow: "0 0 8px #8FC93F" }}
        />
        Probado en talleres reales · Puerto Rico
      </motion.div>

      {/* CTA principal — TestFlight (el único entry point real hoy) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.7 }}
        className="mt-12 flex flex-col items-center"
      >
        {TESTFLIGHT_ENABLED ? (
          <a
            href={TESTFLIGHT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-4 rounded-3xl bg-white text-black px-8 sm:px-10 py-5 transition-all hover:bg-gray-50 hover:-translate-y-1 hover:scale-[1.02] shadow-[0_20px_60px_rgba(56,189,248,0.30)] active:scale-[0.98]"
          >
            {/* Badge "DISPONIBLE AHORA" flotante encima */}
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-lime-400 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black shadow-md whitespace-nowrap">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black/60 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-black" />
              </span>
              Disponible ahora
            </span>

            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white shrink-0">
              <FlaskConical className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[12px] font-medium text-gray-500">Únete al beta</span>
              <span className="text-xl sm:text-2xl font-bold text-black tracking-tight">TestFlight</span>
            </div>
            <ArrowRight className="h-5 w-5 text-black/40 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </a>
        ) : (
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("waitlist")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            title="Reserva tu acceso al beta — te avisamos en cuanto abra"
            className="group relative inline-flex items-center gap-4 rounded-3xl bg-white text-black px-8 sm:px-10 py-5 transition-all hover:bg-gray-50 hover:-translate-y-1 hover:scale-[1.02] shadow-[0_20px_60px_rgba(56,189,248,0.30)] active:scale-[0.98] cursor-pointer"
          >
            {/* Badge "Beta abre pronto" flotante encima */}
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-lime-400 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black shadow-md whitespace-nowrap">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black/60 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-black" />
              </span>
              Beta abre pronto
            </span>

            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white shrink-0">
              <FlaskConical className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[12px] font-medium text-gray-500">Reserva tu beta</span>
              <span className="text-xl sm:text-2xl font-bold text-black tracking-tight">TestFlight</span>
            </div>
            <ArrowRight className="h-5 w-5 text-black/40 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </button>
        )}

        {/* CTAs secundarios — App Store + Google Play más pequeños */}
        <div className="mt-8 flex flex-col items-center gap-3.5">
          <span className="text-[10px] uppercase tracking-[0.24em] text-white/35">
            También próximamente
          </span>
          <div className="flex items-center gap-3">
            {/* App Store secondary */}
            <button
              type="button"
              disabled
              title="Próximamente"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] border border-white/10 text-white/75 px-4 py-2.5 cursor-not-allowed transition-colors hover:bg-white/[0.10]"
            >
              <AppleIcon className="h-4 w-4 fill-white/75" />
              <span className="text-[13px] font-semibold">App Store</span>
            </button>

            {/* Google Play secondary */}
            {ANDROID_ENABLED ? (
              <a
                href={GOOGLE_PLAY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] border border-white/10 text-white px-4 py-2.5 transition-colors hover:bg-white/[0.10]"
              >
                <GooglePlayIcon className="h-4 w-4" />
                <span className="text-[13px] font-semibold">Google Play</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                title="Próximamente"
                className="inline-flex items-center gap-2 rounded-2xl bg-white/[0.06] border border-white/10 text-white/75 px-4 py-2.5 cursor-not-allowed transition-colors hover:bg-white/[0.10]"
              >
                <GooglePlayIcon className="h-4 w-4" />
                <span className="text-[13px] font-semibold">Google Play</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Scroll cue */}
      <motion.button
        type="button"
        onClick={() => document.getElementById("historia")?.scrollIntoView({ behavior: "smooth" })}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 8, 0] }}
        transition={{
          opacity: { delay: 1.6, duration: 0.6 },
          y: { delay: 1.6, duration: 2.4, repeat: Infinity, ease: "easeInOut" },
        }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 hover:text-white/60 transition-colors"
        aria-label="Bajar a Historia"
      >
        <span className="text-[10px] uppercase tracking-[0.3em] font-medium">Conoce la historia</span>
        <ArrowDown className="w-4 h-4" />
      </motion.button>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Historia
// ─────────────────────────────────────────────────────────────────────────────
function Historia() {
  return (
    <section id="historia" className="px-6 py-32 sm:py-40">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }} transition={{ duration: 0.6 }}
          className="text-[11px] uppercase tracking-[0.24em] font-medium text-white/40 mb-10"
        >
          La historia
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }} transition={{ duration: 0.7 }}
          className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-white"
          style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
        >
          De técnico a creador.
        </motion.h2>

        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-120px" }} transition={{ delay: 0.1, duration: 0.7 }}
          className="mt-12 space-y-7 text-[17px] leading-[1.7] text-white/70"
        >
          <p>
            Soy técnico de reparación. Llevo años con celulares en la mano —
            pantallas rotas, baterías muertas, IMEIs duplicados, gente que vuelve
            con el equipo que le entregaste ayer.
          </p>
          <p>
            <span className="text-white">Pasé más de 5 años buscando</span> —
            literalmente — la app que organizara mi taller. Probé todas las que
            prometían algo. <span className="text-white">Ninguna completaba lo que un taller necesita en el día a día.</span>
            {" "}Demasiados clicks, datos perdidos, ventas que no cuadraban con la caja,
            funciones a medias.
          </p>

          <blockquote
            className="border-l-2 pl-6 py-1 my-12 text-2xl sm:text-3xl font-medium leading-[1.3] text-white"
            style={{ borderColor: "#8FC93F", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          >
            Por eso construí SmartFixOS.
            <br />
            <span className="text-white/55 text-xl sm:text-2xl">
              El sistema que yo siempre quise tener.
            </span>
          </blockquote>

          <p>
            Tickets en 30 segundos. Caja que cuadra al peso. Inventario que sabe
            qué pantalla te queda antes de prometérsela al cliente.{" "}
            <span className="text-white">Notificaciones automáticas por email</span>
            {" "}— y cuando quieras, también por <span className="text-white">WhatsApp, SMS o llamada</span>{" "}
            cuando el equipo esté listo. Una sola pantalla, en español.
          </p>
          <p>
            No es otro CRM disfrazado. Es el día a día de un taller, en una app.
          </p>

          <div className="pt-6 flex items-center gap-3 text-sm text-white/45">
            <span className="h-px w-8" style={{ background: "#8FC93F" }} />
            Francis <span className="text-white/30">·</span> San Juan, PR
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Vista previa — 3 screenshots reales
// ─────────────────────────────────────────────────────────────────────────────
const PREVIEW_SHOTS = [
  { src: ss01, label: "Página inicial", hint: "Login en segundos. Abres la app y ya estás dentro del taller." },
  { src: ss02, label: "Dashboard",      hint: "Ingresos del día, alertas e indicadores — todo de un vistazo." },
  { src: ss03, label: "Órdenes",        hint: "Cada ticket en una pantalla. Estado, técnico, fecha de promesa." },
];

function VistaPrevia() {
  return (
    <section id="vista-previa" className="px-6 py-32 sm:py-40 border-t border-white/[0.06]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}
            className="text-[11px] uppercase tracking-[0.24em] font-medium text-white/40 mb-6"
          >
            Vista previa
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.05, duration: 0.7 }}
            className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-white"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          >
            Esto no es vaporware.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.15, duration: 0.7 }}
            className="mt-5 text-white/50 text-base max-w-lg mx-auto leading-relaxed"
          >
            La app está construida. Capturas reales del día a día, no mockups.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 max-w-4xl mx-auto">
          {PREVIEW_SHOTS.map(({ src, label, hint }, i) => (
            <motion.figure
              key={label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: i * 0.08, duration: 0.6 }}
              className="flex flex-col items-center"
            >
              <div className="relative w-full max-w-[260px] aspect-[9/19.5] rounded-[36px] overflow-hidden bg-black border border-white/10 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
                <img
                  src={src}
                  alt={label}
                  className="w-full h-full object-cover object-top"
                  loading="lazy"
                />
              </div>
              <figcaption className="mt-5 text-center">
                <div className="text-sm font-semibold text-white">{label}</div>
                <div className="mt-1 text-[13px] text-white/45 max-w-[230px] mx-auto leading-relaxed">{hint}</div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Planes
// ─────────────────────────────────────────────────────────────────────────────
// ✱ Plans aligned with BILLING_CONTRACT.md §1 — slugs: solo / team
//   Trial: 14 days, no card required. Upgrade flow lives on the web
//   (Stripe Checkout) — never inside the iOS app per Apple guidelines.
const SOLO_FEATURES = [
  "1 usuario (técnico independiente)",
  "Órdenes de trabajo ilimitadas",
  "POS y caja registradora",
  "Inventario y catálogo de servicios",
  "Recibos en PDF",
  "14 días de prueba gratis",
];
const TEAM_FEATURES = [
  "Todo lo del Plan Solo",
  "Hasta 5 empleados",
  "Chat interno del equipo",
  "Multi-device en tiempo real",
  "Finanzas y reportes",
  "Caja con turnos y comisiones",
];

// ── Count-up hook — anima un número de 0 → target cuando entra en viewport
function useCountUp(target, { duration = 900, inView = false } = {}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const num = parseFloat(target);
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(num * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [target, duration, inView]);
  return value;
}

function PlanCard({ name, price, tagline, features, highlighted = false, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const displayPrice = useCountUp(price, { inView, duration: 950 });

  return (
    <motion.article
      ref={ref}
      initial={{ opacity: 0, y: 36, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      whileHover={{ y: -6 }}
      transition={{ delay, duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
      className={[
        "group/plan relative flex flex-col rounded-2xl p-8 sm:p-10 border transition-shadow duration-500",
        highlighted
          ? "bg-white text-black border-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)] hover:shadow-[0_40px_90px_-20px_rgba(143,201,63,0.55)]"
          : "bg-transparent text-white border-white/10 hover:border-lime-400/35 hover:shadow-[0_30px_70px_-25px_rgba(143,201,63,0.30)]",
      ].join(" ")}
    >
      {/* Glow ambient detrás de la card destacada — sale al hover */}
      {highlighted && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 -z-10 opacity-0 group-hover/plan:opacity-100 transition-opacity duration-700"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(143,201,63,0.35) 0%, rgba(31,160,220,0.18) 35%, transparent 70%)",
            filter: "blur(28px)",
          }}
        />
      )}

      {/* Badge "Recomendado" con dot pulsante */}
      {highlighted && (
        <motion.span
          initial={{ opacity: 0, y: -10, scale: 0.85 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: delay + 0.35, duration: 0.6, ease: [0.34, 1.46, 0.5, 1] }}
          className="absolute -top-3 left-8 inline-flex items-center gap-1.5 rounded-full bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white"
        >
          <motion.span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: "#8FC93F", boxShadow: "0 0 8px #8FC93F" }}
            animate={{ opacity: [1, 0.35, 1], scale: [1, 1.2, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
          Recomendado
        </motion.span>
      )}

      <header>
        <div className={highlighted ? "text-[11px] uppercase tracking-[0.22em] font-semibold text-black/55" : "text-[11px] uppercase tracking-[0.22em] font-semibold text-white/45"}>
          Plan {name}
        </div>
        <p className={highlighted ? "mt-1.5 text-base font-medium text-black/75" : "mt-1.5 text-base font-medium text-white/65"}>
          {tagline}
        </p>
      </header>

      <div className="mt-8 flex items-baseline gap-1.5">
        <span
          className="text-5xl sm:text-[56px] font-bold tracking-tight leading-none tabular-nums"
          style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          aria-label={`$${price} al mes`}
        >
          ${displayPrice}
        </span>
        <span className={highlighted ? "text-base font-medium text-black/45" : "text-base font-medium text-white/40"}>
          / mes
        </span>
      </div>
      <p className={highlighted ? "mt-2 text-xs text-black/50" : "mt-2 text-xs text-white/35"}>
        Cancela cuando quieras. 14 días gratis.
      </p>

      {/* Divider que se "dibuja" al entrar */}
      <motion.div
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay: delay + 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: "left" }}
        className={highlighted ? "my-8 h-px w-full bg-black/15" : "my-8 h-px w-full bg-white/10"}
      />

      <ul className="space-y-3.5 flex-1">
        {features.map((f, i) => (
          <motion.li
            key={f}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: delay + 0.45 + i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-start gap-3 text-[14.5px] leading-[1.4]"
          >
            <motion.span
              initial={{ scale: 0 }}
              whileInView={{ scale: 1 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: delay + 0.5 + i * 0.07, duration: 0.45, ease: [0.34, 1.46, 0.5, 1] }}
              className={highlighted ? "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-black mt-px" : "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06] mt-px"}
            >
              <Check className="h-3 w-3" strokeWidth={3} style={{ color: "#8FC93F" }} />
            </motion.span>
            <span className={highlighted ? "text-black/85" : "text-white/75"}>{f}</span>
          </motion.li>
        ))}
      </ul>

      <motion.button
        type="button" disabled
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ delay: delay + 0.45 + features.length * 0.07, duration: 0.6 }}
        whileHover={{ scale: 1.02 }}
        className={[
          "mt-10 h-12 w-full rounded-full text-sm font-semibold cursor-not-allowed",
          "inline-flex items-center justify-center gap-2.5 px-4 whitespace-nowrap",
          highlighted
            ? "bg-black text-white"
            : "bg-white/[0.04] text-white/65 border border-white/10",
        ].join(" ")}
        title="Disponible cuando lancemos las apps"
      >
        <AppleIcon className={highlighted ? "h-4 w-4 fill-white" : "h-4 w-4 fill-white/80"} />
        <GooglePlayIcon className="h-4 w-4" />
        <span>Próximamente</span>
      </motion.button>
    </motion.article>
  );
}

function Planes() {
  return (
    <section
      id="planes"
      className="relative px-6 py-32 sm:py-40 border-t border-white/[0.06] overflow-hidden"
    >
      {/* Ambient glows — sutiles, sólo dan profundidad */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 1.4 }}
        className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full -z-0"
        style={{
          background:
            "radial-gradient(circle, rgba(143,201,63,0.06) 0%, transparent 60%)",
          filter: "blur(30px)",
        }}
      />

      <div className="relative max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2.5 mb-6"
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: "#8FC93F", boxShadow: "0 0 10px #8FC93F" }}
            />
            <span className="text-[11px] uppercase tracking-[0.24em] font-medium text-white/45">
              Planes
            </span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.05, duration: 0.7 }}
            className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-white"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          >
            Dos planes. <span className="text-white/55">Sin sorpresas.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.15, duration: 0.7 }}
            className="mt-5 text-white/50 text-base max-w-md mx-auto leading-relaxed"
          >
            Empieza solo o con tu equipo. Cancela cuando quieras.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          <PlanCard name="Solo"   price="19" tagline="Para el técnico independiente." features={SOLO_FEATURES} delay={0} />
          <PlanCard name="Equipo" price="49" tagline="Cuando ya no eres solo tú."     features={TEAM_FEATURES} highlighted delay={0.12} />
        </div>

        {/* Línea final — reassurance */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: 0.6, duration: 0.7 }}
          className="mt-14 text-center text-[13px] text-white/40"
        >
          Sin contratos · Sin tarjeta para el trial ·{" "}
          <span className="text-white/65">Cambias entre planes cuando quieras</span>
        </motion.p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  FAQ — acordeón con 4 preguntas
// ─────────────────────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: "¿Cuándo sale realmente?",
    a: "Las apps de iOS y Android están en la recta final. Si te suscribes a la lista de espera, eres de los primeros en recibir el link cuando abramos las descargas — sin filtros ni waitlist diferida.",
  },
  {
    q: "¿Cuánto cuesta cuando termine el trial?",
    a: "$19/mes el Plan Solo. $49/mes el Plan Equipo. Sin contratos. Cancelas cuando quieras desde www.smartfixos.com. Los primeros 14 días son gratis, sin pedir tarjeta.",
  },
  {
    q: "¿Necesito instalar algo en mi computadora?",
    a: "No. SmartFixOS corre 100% en el celular o tablet. Sin servidores que mantener, sin actualizaciones manuales. Si tienes iPhone, iPad o Android moderno, ya tienes todo lo que necesitas.",
  },
  {
    q: "¿Mis datos son míos si me cancelo?",
    a: "Siempre. Tus órdenes, clientes e inventario se exportan a Excel o PDF desde la app con un click. Si cancelas, te damos 90 días para descargar todo antes de borrar tu base.",
  },
];

function FAQItem({ item, isOpen, onToggle }) {
  return (
    <div className="border-b border-white/[0.08]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-6 py-6 text-left group"
      >
        <span
          className={[
            "text-base sm:text-lg font-medium tracking-tight transition-colors",
            isOpen ? "text-white" : "text-white/80 group-hover:text-white",
          ].join(" ")}
        >
          {item.q}
        </span>
        <span
          className={[
            "flex-shrink-0 h-7 w-7 rounded-full border flex items-center justify-center transition-all",
            isOpen
              ? "bg-white text-black border-white"
              : "border-white/20 text-white/60 group-hover:border-white/40 group-hover:text-white/90",
          ].join(" ")}
        >
          {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-6 pr-12 text-[15px] leading-[1.65] text-white/60">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FAQ() {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <section id="faq" className="px-6 py-32 sm:py-40 border-t border-white/[0.06]">
      <div className="max-w-2xl mx-auto">
        <div className="mb-12">
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}
            className="text-[11px] uppercase tracking-[0.24em] font-medium text-white/40 mb-6"
          >
            Preguntas
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.05, duration: 0.7 }}
            className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-white"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          >
            Lo que siempre nos preguntan.
          </motion.h2>
        </div>

        <div>
          {FAQ_ITEMS.map((item, i) => (
            <FAQItem
              key={item.q}
              item={item}
              isOpen={openIdx === i}
              onToggle={() => setOpenIdx(openIdx === i ? -1 : i)}
            />
          ))}
        </div>

        <p className="mt-12 text-sm text-white/45">
          ¿Otra duda?{" "}
          <a href="mailto:smartfixosapp@gmail.com" className="text-white hover:underline underline-offset-4 decoration-white/30">
            Escríbeme directo
          </a>
          .
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Waitlist — captura emails antes del lanzamiento
// ─────────────────────────────────────────────────────────────────────────────
function Waitlist() {
  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [error, setError]   = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      setStatus("error");
      setError("Esa dirección no se ve bien. Intenta de nuevo.");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const { error: insertErr } = await supabase
        .from("landing_waitlist")
        .insert({
          email: cleaned,
          source: "landing",
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 240) : null,
        });
      if (insertErr) {
        // 23505 = unique violation — ya estabas en la lista. Lo tratamos como éxito.
        if (insertErr.code === "23505") {
          setStatus("success");
          return;
        }
        throw insertErr;
      }
      setStatus("success");
    } catch (err) {
      console.error("[waitlist] insert error:", err);
      setStatus("error");
      setError("Algo salió mal. Escríbenos a smartfixosapp@gmail.com.");
    }
  };

  return (
    <section id="waitlist" className="px-6 py-32 sm:py-40 border-t border-white/[0.06]">
      <div className="max-w-xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}
          className="text-[11px] uppercase tracking-[0.24em] font-medium text-white/40 mb-6"
        >
          Lista de espera
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.05, duration: 0.7 }}
          className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-white"
          style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
        >
          Te aviso el día que abramos.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.15, duration: 0.7 }}
          className="mt-5 text-white/55 text-base leading-relaxed max-w-md mx-auto"
        >
          Sin spam, sin newsletter semanal. Un solo email cuando podamos abrir las descargas.
        </motion.p>

        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-10 inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-4"
            >
              <CheckCircle2 className="h-5 w-5" style={{ color: "#8FC93F" }} />
              <span className="text-[15px] text-white/85">
                ¡Listo! Te aviso en cuanto las apps estén disponibles.
              </span>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={submit}
              initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.25, duration: 0.7 }}
              className="mt-10 flex flex-col sm:flex-row items-stretch gap-3 max-w-md mx-auto"
            >
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="tu@email.com"
                aria-label="Tu email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (status === "error") setStatus("idle"); }}
                disabled={status === "loading"}
                className="flex-1 h-12 rounded-full bg-white/[0.04] border border-white/15 px-5 text-[15px] text-white placeholder-white/35 outline-none focus:border-white/40 focus:bg-white/[0.06] transition-colors"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="h-12 px-6 rounded-full bg-white text-black font-semibold text-[14px] inline-flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Apuntando…
                  </>
                ) : (
                  <>
                    Avísame
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        {status === "error" && (
          <p className="mt-3 text-[13px]" style={{ color: "#ff6b6b" }}>{error}</p>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Footer
// ─────────────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="px-6 py-20 border-t border-white/[0.06]">
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-8">
        <AnimatedWordmark size="footer" />

        <div className="text-[13px] text-white/45">
          ¿Preguntas? Escríbeme:{" "}
          <a href="mailto:smartfixosapp@gmail.com" className="text-white hover:underline underline-offset-4 decoration-white/30">
            smartfixosapp@gmail.com
          </a>
        </div>

        {/* Legal links — required visible by Stripe before live mode */}
        <div className="pt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px]">
          <Link to="/legal/terms" className="text-white/55 hover:text-white transition-colors">
            Términos
          </Link>
          <span className="text-white/15">·</span>
          <Link to="/legal/refunds" className="text-white/55 hover:text-white transition-colors">
            Reembolsos
          </Link>
          <span className="text-white/15">·</span>
          <a
            href="https://smartfixos-privacidad.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/55 hover:text-white transition-colors"
          >
            Privacidad
          </a>
        </div>

        <div className="text-[11px] uppercase tracking-[0.22em] text-white/25 pt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          <span>SmartFixOS © 2026</span>
          <span className="text-white/15">·</span>
          <span>v3.5.0</span>
          <span className="text-white/15">·</span>
          <span>San Juan, PR · Hecho a mano 🇵🇷</span>
        </div>

        {/* Studio credit — Archilla Studios construyó SmartFixOS */}
        <div className="mt-6 pt-8 border-t border-white/[0.04] w-full flex flex-col items-center gap-3">
          <span className="text-[10px] uppercase tracking-[0.28em] text-white/30">
            Diseño y desarrollo
          </span>
          <a
            href="mailto:archillastudios@gmail.com"
            className="inline-flex items-center gap-3 opacity-80 hover:opacity-100 transition-opacity"
            aria-label="Archilla Studios"
          >
            <img
              src="/archilla-studios.png"
              alt="Archilla Studios"
              className="h-10 w-auto object-contain"
              loading="lazy"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}

// ─── Icons ─────────────────────────────────────────────────────────────────
function AppleIcon({ className }) {
  return (
    <svg viewBox="0 0 814 1000" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 790.7 0 663 0 541.8c0-207.8 113.4-317.7 224.5-317.7 100.4 0 163.4 60.2 220.8 60.2 54.7 0 127.9-62.5 240.3-62.5zm-284.4-154.8c22.6-26.8 39.3-65.4 39.3-104.5 0-5.5-.5-11.1-1.6-15.4C450 73.9 385.5 111 345.4 155.1c-20.3 22.6-40.9 61-40.9 101.1 0 6 1 12 1.5 14.2 2.6.5 6.8.9 10.8.9 36.4 0 97.2-35.5 127-85.2z" />
    </svg>
  );
}
function GooglePlayIcon({ className }) {
  return (
    <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1z" fill="#00C3FF" />
      <path d="M47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256.6L47 0z" fill="#34A853" />
      <path d="M472.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8z" fill="#FFC107" />
      <path d="M104.6 499l280.8-161.2-60.1-60.1L104.6 499z" fill="#EA4335" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Página
// ─────────────────────────────────────────────────────────────────────────────
export default function Landing() {
  return (
    <div className="min-h-dvh bg-[#0a0a0a] text-white antialiased font-sans">
      <HashHandoffNotice />
      <Hero />
      <Historia />
      <VistaPrevia />
      <Planes />
      <FAQ />
      <Waitlist />
      <Footer />
    </div>
  );
}
