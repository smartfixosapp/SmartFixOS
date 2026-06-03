import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Check, ArrowDown, ArrowRight, Plus, Minus, Loader2, CheckCircle2, FlaskConical,
  Compass, Download, Smartphone, ShieldCheck, Bell, Sparkles, Inbox, AlertCircle,
} from "lucide-react";
import { supabase } from "../../../../lib/supabase-client.js";

const BETA_SLOTS_ENDPOINT = "https://idntuvtabecwubzswpwi.supabase.co/functions/v1/beta-slots";

import tour00 from "../assets/images/screenshots/00-welcome.png";
import tour01 from "../assets/images/screenshots/01-bienvenido.png";
import tour02 from "../assets/images/screenshots/02-ordenes-empty.png";
import tour03 from "../assets/images/screenshots/03-inicio.png";
import tour04 from "../assets/images/screenshots/04-finanzas-dashboard.png";
import tour05 from "../assets/images/screenshots/05-reporte-mensual.png";
import tour06 from "../assets/images/screenshots/06-ordenes-list.png";
import tour07 from "../assets/images/screenshots/07-pos-catalogo.png";
import tour08 from "../assets/images/screenshots/08-pos-cart.png";
import tour09 from "../assets/images/screenshots/09-ajustes.png";
import tour10 from "../assets/images/screenshots/10-info-negocio.png";
import tour11 from "../assets/images/screenshots/11-ivu-config.png";
import tour12 from "../assets/images/screenshots/12-orden-detail.png";
import tour13 from "../assets/images/screenshots/13-notificar-cliente.png";
import tour14 from "../assets/images/screenshots/14-smart-search.png";
import tour15 from "../assets/images/screenshots/15-compras-empty.png";
import tour16 from "../assets/images/screenshots/16-compras-paso1-suplidor.png";
import tour17 from "../assets/images/screenshots/17-compras-suplidor-selected.png";
import tour18 from "../assets/images/screenshots/18-compras-paso2-productos.png";
import tour19 from "../assets/images/screenshots/19-compras-paso2-add-producto.png";

// ─────────────────────────────────────────────────────────────────────────────
//  FEATURE FLAGS
// ─────────────────────────────────────────────────────────────────────────────
const TESTFLIGHT_ENABLED = true;
const TESTFLIGHT_URL     = "https://testflight.apple.com/join/MjGuBHkP";
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
             style={{ background: "rgba(255,87,34,0.15)" }}>
          <CheckCircle2 className="w-7 h-7" style={{ color: "#FF5722" }} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-white mb-2"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}>
          Casi listo
        </h2>
        <p className="text-white/65 text-[15px] leading-relaxed mb-7">
          Tu enlace de acceso está listo. Abre la app Archilla OS para terminar de iniciar sesión.
        </p>
        <a
          href={deepLink}
          className="block w-full bg-white text-black font-semibold py-3.5 rounded-xl hover:bg-white/90 transition-colors mb-3"
        >
          Abrir en Archilla OS
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

function useBetaSlots() {
  const [data, setData] = useState({ loading: true, error: false, slots: null });

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const fetchSlots = async () => {
      try {
        const res = await fetch(BETA_SLOTS_ENDPOINT, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData({ loading: false, error: false, slots: json });
      } catch (_err) {
        if (!cancelled) setData((prev) => ({ loading: false, error: true, slots: prev.slots }));
      }
    };

    fetchSlots();
    timer = setInterval(fetchSlots, 30_000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return data;
}

function BetaSlotsCounter({ slots, loading, error }) {
  if (loading && !slots) {
    return (
      <div className="mt-5 inline-flex items-center gap-2 text-[12px] text-white/35">
        <Loader2 className="h-3 w-3 animate-spin" />
        Consultando cupos…
      </div>
    );
  }

  if (error && !slots) {
    return (
      <div className="mt-5 inline-flex items-center gap-2 text-[12px] text-white/35">
        <AlertCircle className="h-3 w-3" />
        No pudimos verificar cupos. Intenta el botón de todas formas.
      </div>
    );
  }

  if (!slots) return null;

  const { remaining, limit, status } = slots;

  if (status === "full") {
    return (
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/[0.04] border border-white/15 px-4 py-2 text-[12px] font-medium text-white/70">
        <Inbox className="h-3.5 w-3.5" />
        Beta llena · anótate a la lista de espera abajo
      </div>
    );
  }

  if (status === "low") {
    return (
      <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-red-500/15 border border-red-500/40 px-4 py-2 text-[12px] font-bold uppercase tracking-[0.12em] text-red-300">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-400" />
        </span>
        Últimos {remaining} cupos
      </div>
    );
  }

  return (
    <div className="mt-5 inline-flex items-center gap-2 text-[12.5px] text-white/55">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#FF5722", boxShadow: "0 0 8px #FF5722" }} />
      <span><span className="text-white font-semibold tabular-nums">{remaining}</span> de {limit} cupos disponibles</span>
    </div>
  );
}

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmedEmail)) {
      setErrorMsg("Necesitamos un email válido.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("waitlist").insert({
        email: trimmedEmail,
        phone: phone.trim() || null,
        business_name: businessName.trim() || null,
        source: "beta-full",
      });
      if (error) {
        if (error.code === "23505") {
          setDone(true);
          return;
        }
        throw error;
      }
      setDone(true);
    } catch (err) {
      setErrorMsg(err?.message || "Algo salió mal. Intenta otra vez.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-[#FF5722]/30 bg-[#FF5722]/[0.06] px-6 py-5 text-center">
        <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-[#FF5722]/15 border border-[#FF5722]/30 mb-3">
          <CheckCircle2 className="h-5 w-5" style={{ color: "#FF5722" }} />
        </div>
        <div className="text-[15px] font-semibold text-white mb-1">Estás en la lista</div>
        <p className="text-[13px] text-white/55 leading-relaxed max-w-sm mx-auto">
          Te escribimos en cuanto abramos el próximo cupo. Mientras tanto, descarga TestFlight para tenerlo listo cuando llegue tu turno.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Tu email"
        className="w-full bg-white/[0.04] border border-white/12 focus:border-white/40 rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/35 outline-none transition-colors"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Teléfono (opcional)"
          className="w-full bg-white/[0.04] border border-white/12 focus:border-white/40 rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/35 outline-none transition-colors"
        />
        <input
          type="text"
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="Nombre del taller (opcional)"
          className="w-full bg-white/[0.04] border border-white/12 focus:border-white/40 rounded-xl px-4 py-3 text-[14px] text-white placeholder:text-white/35 outline-none transition-colors"
        />
      </div>
      {errorMsg && (
        <div className="text-[12.5px] text-red-300 flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5" />
          {errorMsg}
        </div>
      )}
      <button
        type="submit"
        disabled={submitting || !email}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-black font-semibold px-5 py-3 text-[14px] hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Anotándote…
          </>
        ) : (
          "Anótame a la lista"
        )}
      </button>
      <p className="text-[11.5px] text-white/35 leading-relaxed">
        Solo usamos tu contacto para avisarte cuando se libere un cupo. No spam.
      </p>
    </form>
  );
}

const COMO_ENTRAR_STEPS = [
  { icon: Compass,      title: "Tap al botón",          body: "Únete a la beta arriba abre la página de TestFlight en Safari." },
  { icon: Smartphone,   title: "¿No tienes TestFlight?", body: "Apple te lleva al App Store. TestFlight es gratis, solo necesitas tu Apple ID." },
  { icon: Download,     title: "Instala TestFlight",     body: "Tap Get. No te pide tarjeta, ni Apple Developer, ni nada raro." },
  { icon: ArrowRight,   title: "Abre TestFlight",        body: "El invite ya está cacheado en tu cuenta. Ves Archilla OS esperándote." },
  { icon: CheckCircle2, title: "Tap Accept → Install",   body: "La app baja en ~10 segundos a tu home screen." },
  { icon: Sparkles,     title: "Punto naranja = beta",   body: "Vas a verlo al lado del nombre. Es la marca oficial de Apple para apps beta." },
  { icon: ShieldCheck,  title: "14 días gratis",         body: "Crea tu taller dentro de la app. Sin tarjeta. Cancelable cuando quieras." },
  { icon: Bell,         title: "Updates automáticos",    body: "Cada vez que sacamos un build nuevo, TestFlight te notifica y actualizas con un tap." },
];

const TOUR_GROUPS = [
  {
    eyebrow: "Operaciones del día",
    title: "Cada orden desde que entra hasta que la entregas.",
    screens: [
      { src: tour03, caption: "Inicio · resumen del día" },
      { src: tour06, caption: "Lista de órdenes activas" },
      { src: tour02, caption: "Tu primer día · vacío" },
      { src: tour12, caption: "Detalle de una orden" },
      { src: tour13, caption: "Notificar al cliente" },
    ],
  },
  {
    eyebrow: "Punto de venta",
    title: "Cobra rápido. Sin pelearte con la calculadora.",
    screens: [
      { src: tour07, caption: "Catálogo del POS" },
      { src: tour08, caption: "Carrito y total" },
      { src: tour14, caption: "Smart Search global" },
    ],
  },
  {
    eyebrow: "Finanzas",
    title: "Cuánto entró, cuánto salió, cuánto te quedó.",
    screens: [
      { src: tour04, caption: "Dashboard financiero" },
      { src: tour05, caption: "Reporte del mes" },
      { src: tour11, caption: "IVU 11.5% automático" },
    ],
  },
  {
    eyebrow: "Compras e inventario",
    title: "Stock que se ajusta solo cuando vendes o recibes.",
    screens: [
      { src: tour15, caption: "Compras · vacío" },
      { src: tour16, caption: "Paso 1 · elige suplidor" },
      { src: tour17, caption: "Suplidor confirmado" },
      { src: tour18, caption: "Paso 2 · productos" },
      { src: tour19, caption: "Agregar producto" },
    ],
  },
  {
    eyebrow: "Setup y ajustes",
    title: "Configuras tu taller una vez y se acabó.",
    screens: [
      { src: tour00, caption: "Welcome" },
      { src: tour01, caption: "Bienvenido al sistema" },
      { src: tour10, caption: "Info del negocio" },
      { src: tour09, caption: "Ajustes generales" },
    ],
  },
];

function PhoneScreenshot({ src, caption, index }) {
  return (
    <motion.figure
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay: (index % 5) * 0.05, duration: 0.5 }}
      className="group flex flex-col items-center"
    >
      <div className="relative w-full max-w-[200px] aspect-[9/19.5] rounded-[2.2rem] bg-[#0f0f0f] border border-white/[0.08] p-[5px] shadow-[0_20px_50px_rgba(0,0,0,0.4)] transition-all duration-500 group-hover:-translate-y-1 group-hover:shadow-[0_30px_70px_rgba(255,87,34,0.12)] group-hover:border-white/15">
        <div className="absolute top-[14px] left-1/2 -translate-x-1/2 h-[18px] w-[80px] rounded-full bg-black z-10" />
        <img
          src={src}
          alt={caption}
          loading="lazy"
          className="block w-full h-full rounded-[1.85rem] object-cover object-top"
        />
      </div>
      <figcaption className="mt-4 text-[12.5px] text-white/55 text-center leading-snug px-1">
        {caption}
      </figcaption>
    </motion.figure>
  );
}

function TourCompleto() {
  return (
    <section id="tour" className="relative w-full px-6 py-24 sm:py-32 bg-[#0a0a0a] border-t border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#FF5722", boxShadow: "0 0 10px #FF5722" }} />
            <span className="text-[11px] uppercase tracking-[0.24em] font-medium text-white/45">Tour completo</span>
          </div>
          <h2
            className="text-3xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.05]"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          >
            Mira todo lo que vas a usar.
          </h2>
          <p className="mt-5 text-[15.5px] sm:text-[17px] text-white/55 leading-relaxed max-w-xl mx-auto">
            20 pantallas reales, no mockups. Esto es exactamente lo que ves cuando abres la app en tu iPhone.
          </p>
        </div>

        <div className="space-y-24 sm:space-y-28">
          {TOUR_GROUPS.map((group, gi) => (
            <div key={gi}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5 }}
                className="mb-10 sm:mb-14 max-w-2xl"
              >
                <div className="text-[11px] uppercase tracking-[0.22em] font-medium text-white/35 mb-3">
                  {group.eyebrow}
                </div>
                <h3
                  className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-[1.15]"
                  style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
                >
                  {group.title}
                </h3>
              </motion.div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-10 sm:gap-x-8 sm:gap-y-12">
                {group.screens.map((screen, i) => (
                  <PhoneScreenshot key={i} src={screen.src} caption={screen.caption} index={i} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <a
            href={TESTFLIGHT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-6 h-12 text-[14px] hover:bg-gray-100 transition-colors"
          >
            <FlaskConical className="h-4 w-4" strokeWidth={2.2} />
            Pruébalo tú mismo
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

function ComoEntrar() {
  return (
    <section id="como-entrar" className="relative w-full px-6 py-24 sm:py-32 bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2.5 mb-5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#FF5722", boxShadow: "0 0 10px #FF5722" }} />
            <span className="text-[11px] uppercase tracking-[0.24em] font-medium text-white/45">Cómo entrar</span>
          </div>
          <h2
            className="text-3xl sm:text-5xl font-semibold tracking-tight text-white leading-[1.05]"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          >
            Tap, instala, listo.
          </h2>
          <p className="mt-5 text-[15.5px] sm:text-[17px] text-white/55 leading-relaxed max-w-xl mx-auto">
            Sin tarjeta, sin Apple Developer, sin formularios. Solo tu Apple ID y un par de minutos.
          </p>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
          {COMO_ENTRAR_STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: i * 0.05, duration: 0.5 }}
                className="bg-[#0a0a0a] p-6 sm:p-7 relative flex flex-col"
              >
                <div className="flex items-center gap-3 mb-3.5">
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-white/[0.06] border border-white/10 text-[12px] font-bold text-white/55 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <Icon className="h-4 w-4 text-white/55" strokeWidth={2} />
                </div>
                <div className="text-[14.5px] font-semibold text-white tracking-tight mb-1.5">
                  {step.title}
                </div>
                <p className="text-[13px] text-white/55 leading-relaxed">
                  {step.body}
                </p>
              </motion.li>
            );
          })}
        </ol>

        <div className="mt-10 text-center">
          <a
            href={TESTFLIGHT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white text-black font-semibold px-6 h-12 text-[14px] hover:bg-gray-100 transition-colors"
          >
            <FlaskConical className="h-4 w-4" strokeWidth={2.2} />
            Únete a la beta gratis
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Animated wordmark — logo glossy + "Archilla OS"
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedWordmark({ size = "hero" }) {
  const isHero = size === "hero";

  const word = "Archilla OS";
  const letterStagger = 0.04;
  const logoDelay = 0.05 + word.length * letterStagger;

  return (
    <div
      className={
        isHero
          ? "flex items-center justify-center gap-[0.18em] font-[800] leading-[0.85] tracking-[-0.045em] text-white select-none"
          : "flex items-center justify-center gap-[0.18em] font-[700] leading-[0.85] tracking-[-0.04em] text-white select-none"
      }
      style={{
        fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
        fontSize: isHero ? "clamp(48px, 11vw, 140px)" : "40px",
      }}
      aria-label="Archilla OS"
    >
      {/* Logo glossy — entrada con rotación + overshoot, después flota suave */}
      <motion.span
        initial={{ opacity: 0, scale: 0.3, rotate: -160 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{
          delay: 0.05,
          duration: 0.95,
          ease: [0.34, 1.46, 0.5, 1],
        }}
        className="relative inline-grid place-items-center"
        style={{ width: "1.05em", height: "1.05em", margin: "0 0.04em" }}
        aria-hidden
      >
        {/* Halo naranja: flash brillante en la entrada, después pulso suave */}
        <motion.span
          className="pointer-events-none absolute inset-[6%] rounded-full -z-10"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 1, 0.55], scale: [0.5, 1.45, 1] }}
          transition={{
            delay: 0.05,
            duration: 0.9,
            times: [0, 0.45, 1],
            ease: "easeOut",
          }}
          style={{
            background:
              "radial-gradient(circle, rgba(255,122,77,0.38) 0%, rgba(255,87,34,0.30) 50%, transparent 75%)",
            filter: "blur(8px)",
            animation: `sfx-halo 4s ease-in-out infinite ${logoDelay + 0.9}s`,
          }}
        />
        <img
          src="/images/logo.png"
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            animation: `sfx-logo-float 6s ease-in-out infinite ${logoDelay + 0.95}s`,
          }}
        />
      </motion.span>

      {/* Wordmark "Archilla OS" — letras entran con stagger */}
      <span className="inline-flex">
        {word.split("").map((ch, i) => (
          <motion.span
            key={`l-${i}`}
            initial={{ opacity: 0, y: "0.5em", scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: 0.05 + i * letterStagger,
              duration: 0.6,
              ease: [0.16, 1, 0.3, 1],
            }}
            style={{ display: "inline-block", whiteSpace: "pre" }}
          >
            {ch}
          </motion.span>
        ))}
      </span>

      <style>{`
        @keyframes sfx-logo-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-0.04em); }
        }
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
  const { slots, loading, error } = useBetaSlots();
  const isFull = slots?.status === "full";
  const isLow = slots?.status === "low";

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
      <AnimatedWordmark />

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.0, duration: 0.7 }}
        className="mt-10 text-center text-base sm:text-lg text-white/55 max-w-md leading-relaxed font-medium"
      >
        POS y gestión para tu taller.
        <br />
        Gratis durante la beta · Sin tarjeta.
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
          style={{ background: "#FF5722", boxShadow: "0 0 8px #FF5722" }}
        />
        Probado en talleres reales · Puerto Rico
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.7 }}
        className="mt-12 flex flex-col items-center"
      >
        {isFull ? (
          <button
            type="button"
            onClick={() => document.getElementById("waitlist")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="group relative inline-flex items-center gap-4 rounded-3xl bg-white text-black px-8 sm:px-10 py-5 transition-all hover:bg-gray-50 hover:-translate-y-1 hover:scale-[1.02] shadow-[0_20px_60px_rgba(255,87,34,0.25)] active:scale-[0.98] cursor-pointer"
          >
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-white border border-white/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black shadow-md whitespace-nowrap">
              Beta llena · únete a la lista
            </span>
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a4d] to-[#d83c10] text-white shrink-0">
              <Inbox className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[12px] font-medium text-gray-500">Próximo cupo</span>
              <span className="text-xl sm:text-2xl font-bold text-black tracking-tight">Anótame</span>
            </div>
            <ArrowDown className="h-5 w-5 text-black/40 ml-1 group-hover:translate-y-0.5 transition-transform" />
          </button>
        ) : (
          <a
            href={TESTFLIGHT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-4 rounded-3xl bg-white text-black px-8 sm:px-10 py-5 transition-all hover:bg-gray-50 hover:-translate-y-1 hover:scale-[1.02] shadow-[0_20px_60px_rgba(255,87,34,0.30)] active:scale-[0.98]"
          >
            <span
              className={
                "absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] shadow-md whitespace-nowrap " +
                (isLow
                  ? "bg-red-400 text-black"
                  : "bg-[#FF5722] text-black")
              }
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black/60 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-black" />
              </span>
              {isLow
                ? `Últimos ${slots?.remaining} cupos`
                : "Únete a la beta gratis · 10 cupos"}
            </span>

            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#ff7a4d] to-[#d83c10] text-white shrink-0">
              <FlaskConical className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[12px] font-medium text-gray-500">Únete al beta</span>
              <span className="text-xl sm:text-2xl font-bold text-black tracking-tight">TestFlight</span>
            </div>
            <ArrowRight className="h-5 w-5 text-black/40 ml-1 group-hover:translate-x-0.5 transition-transform" />
          </a>
        )}

        <BetaSlotsCounter slots={slots} loading={loading} error={error} />

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
            style={{ borderColor: "#FF5722", fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          >
            Por eso construí Archilla OS.
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
            <span className="h-px w-8" style={{ background: "#FF5722" }} />
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
  { src: tour03, label: "Inicio",    hint: "Abres la app y ves el resumen del día — órdenes activas, alertas, lo importante." },
  { src: tour04, label: "Finanzas",  hint: "Ingresos, gastos, IVU del mes. Todo calculado solo, sin Excel." },
  { src: tour06, label: "Órdenes",   hint: "Cada ticket con estado, técnico y fecha de promesa en una sola pantalla." },
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

function PlanCard({ name, price, tagline, features, highlighted = false, delay = 0, betaFree = false }) {
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
          ? "bg-white text-black border-white shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)] hover:shadow-[0_40px_90px_-20px_rgba(255,87,34,0.55)]"
          : "bg-transparent text-white border-white/10 hover:border-[#FF5722]/35 hover:shadow-[0_30px_70px_-25px_rgba(255,87,34,0.30)]",
      ].join(" ")}
    >
      {/* Glow ambient detrás de la card destacada — sale al hover */}
      {highlighted && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 -z-10 opacity-0 group-hover/plan:opacity-100 transition-opacity duration-700"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(255,87,34,0.35) 0%, rgba(255,87,34,0.18) 35%, transparent 70%)",
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
            style={{ background: "#FF5722", boxShadow: "0 0 8px #FF5722" }}
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

      {betaFree ? (
        <>
          <div className="mt-8 flex items-baseline gap-3">
            <span
              className="text-5xl sm:text-[56px] font-bold tracking-tight leading-none tabular-nums"
              style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
              aria-label="Gratis durante la beta"
            >
              Gratis
            </span>
            <span
              className={
                (highlighted ? "text-black/35" : "text-white/30") +
                " text-2xl font-semibold line-through tabular-nums"
              }
              aria-label={`Precio regular $${price} al mes`}
            >
              ${displayPrice}
            </span>
          </div>
          <p className={highlighted ? "mt-2 text-xs text-black/55" : "mt-2 text-xs text-white/40"}>
            Sin tarjeta. Gratis mientras estemos en TestFlight beta.
          </p>
        </>
      ) : (
        <>
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
        </>
      )}

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
              <Check className="h-3 w-3" strokeWidth={3} style={{ color: "#FF5722" }} />
            </motion.span>
            <span className={highlighted ? "text-black/85" : "text-white/75"}>{f}</span>
          </motion.li>
        ))}
      </ul>

      {betaFree ? (
        <motion.a
          href={TESTFLIGHT_URL}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: delay + 0.45 + features.length * 0.07, duration: 0.6 }}
          whileHover={{ scale: 1.02 }}
          className={[
            "mt-10 h-12 w-full rounded-full text-sm font-semibold",
            "inline-flex items-center justify-center gap-2 px-4 whitespace-nowrap transition-colors",
            highlighted
              ? "bg-black text-white hover:bg-gray-900"
              : "bg-white text-black hover:bg-gray-100",
          ].join(" ")}
          title="Únete a la beta — gratis mientras dure"
        >
          <FlaskConical className="h-4 w-4" strokeWidth={2.2} />
          <span>Únete a la beta gratis</span>
          <ArrowRight className="h-4 w-4" />
        </motion.a>
      ) : (
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
      )}
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
            "radial-gradient(circle, rgba(255,87,34,0.06) 0%, transparent 60%)",
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
              style={{ background: "#FF5722", boxShadow: "0 0 10px #FF5722" }}
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
            Gratis durante la beta.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.15, duration: 0.7 }}
            className="mt-5 text-white/50 text-base max-w-lg mx-auto leading-relaxed"
          >
            Mientras estemos en TestFlight, los dos planes son <span className="text-white/85 font-medium">gratis sin tarjeta</span>. Estos precios solo entran cuando salgamos al App Store oficial.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          <PlanCard name="Solo"   price="19" tagline="Para el técnico independiente." features={SOLO_FEATURES} delay={0} betaFree />
          <PlanCard name="Equipo" price="49" tagline="Cuando ya no eres solo tú."     features={TEAM_FEATURES} highlighted delay={0.12} betaFree />
        </div>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ delay: 0.6, duration: 0.7 }}
          className="mt-14 text-center text-[13px] text-white/40"
        >
          Sin tarjeta · Sin contratos ·{" "}
          <span className="text-white/65">Te avisamos antes de que los precios entren en vigor</span>
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
    a: "Las apps de iOS y Android están en la recta final. La beta ya está abierta vía TestFlight — únete arriba y empiezas a usar la app hoy. Cuando lancemos al App Store oficial, te aparece como update automático.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "Mientras estemos en TestFlight beta, Archilla OS es completamente gratis — sin tarjeta, sin trial limitado, sin sorpresas. Cuando salgamos al App Store oficial entran los planes Solo ($19/mes) y Equipo ($49/mes), y te avisamos por email con al menos 14 días de anticipación para que decidas.",
  },
  {
    q: "¿Necesito instalar algo en mi computadora?",
    a: "No. Archilla OS corre 100% en el celular o tablet. Sin servidores que mantener, sin actualizaciones manuales. Si tienes iPhone, iPad o Android moderno, ya tienes todo lo que necesitas.",
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
  const { slots } = useBetaSlots();
  const isFull = slots?.status === "full";

  const [email, setEmail]   = useState("");
  const [status, setStatus] = useState("idle");
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

  if (isFull) {
    return (
      <section id="waitlist" className="px-6 py-32 sm:py-40 border-t border-white/[0.06]">
        <div className="max-w-xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }}
            className="text-[11px] uppercase tracking-[0.24em] font-medium text-white/40 mb-6"
          >
            Lista de espera · beta
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.05, duration: 0.7 }}
            className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-white"
            style={{ fontFamily: '"Bricolage Grotesque", system-ui, sans-serif' }}
          >
            Beta llena por ahora.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.15, duration: 0.7 }}
            className="mt-5 text-white/55 text-base leading-relaxed max-w-md mx-auto"
          >
            Los 10 cupos están tomados. Déjanos tu contacto y te avisamos en cuanto se libere uno.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.25, duration: 0.7 }}
            className="mt-10 max-w-md mx-auto text-left"
          >
            <WaitlistForm />
          </motion.div>
        </div>
      </section>
    );
  }

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
          Te aviso cuando salga al App Store.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }} transition={{ delay: 0.15, duration: 0.7 }}
          className="mt-5 text-white/55 text-base leading-relaxed max-w-md mx-auto"
        >
          La beta de TestFlight ya está abierta arriba. Si prefieres esperar la versión oficial del App Store, déjame tu email y te aviso ese día.
        </motion.p>

        <AnimatePresence mode="wait">
          {status === "success" ? (
            <motion.div
              key="ok"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-10 inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.04] px-6 py-4"
            >
              <CheckCircle2 className="h-5 w-5" style={{ color: "#FF5722" }} />
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
          <span>Archilla OS © 2026</span>
          <span className="text-white/15">·</span>
          <span>v3.5.0</span>
          <span className="text-white/15">·</span>
          <span>San Juan, PR · Hecho a mano 🇵🇷</span>
        </div>

        {/* Studio credit — Archilla Studios construyó Archilla OS */}
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
      <ComoEntrar />
      <Historia />
      <VistaPrevia />
      <TourCompleto />
      <Planes />
      <FAQ />
      <Waitlist />
      <Footer />
    </div>
  );
}
