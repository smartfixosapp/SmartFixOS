import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ClipboardList, Package, Users,
  BarChart3, CreditCard, MessageSquare, Zap,
  Check, Star, Download,
} from "lucide-react";
import { supabase } from "../../../../lib/supabase-client.js";
import { PLANS } from "@/lib/plans";

// ─────────────────────────────────────────────────────────────────
//  🚩 FEATURE FLAGS — cambiar aquí para habilitar/deshabilitar
// -----------------------------------------------------------------
const TESTFLIGHT_ENABLED = false;          // true = muestra botón de descarga real
const TESTFLIGHT_URL     = "https://testflight.apple.com/join/XXXXXXXX"; // tu URL
const ANDROID_ENABLED    = false;          // true = muestra botón Google Play
const GOOGLE_PLAY_URL    = "";             // tu URL de Play Store cuando esté lista
// ─────────────────────────────────────────────────────────────────

// ── Design tokens ────────────────────────────────────────────────
const B  = "#0ea5e9";
const BG = "#07080a";

// ── Planes ───────────────────────────────────────────────────────
const SOLO_FEATURES = [
  "Órdenes de trabajo ilimitadas",
  "POS y caja registradora",
  "Inventario y catálogo de servicios",
  "Finanzas y reportes de ingresos",
  "Clientes ilimitados",
  "15 días de prueba gratis",
];
const TEAM_FEATURES = [
  "Todo lo del Plan Solo",
  "Empleados y nómina",
  "Horarios y ponchados",
  "Órdenes de compra a suplidores",
  "Chat interno del equipo",
  "Reporte mensual en PDF",
  "Comisiones por técnico",
];

// ── Auth redirect ────────────────────────────────────────────────
function useAuthRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/Dashboard", { replace: true });
    });
  }, [navigate]);
}

// ── Smooth scroll helper ─────────────────────────────────────────
function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Fade-up animation wrapper ────────────────────────────────────
const FadeUp = ({ children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-48px" }}
    transition={{ delay, duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

// ── Marquee strip ────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  "Órdenes de trabajo", "POS y caja", "Inventario", "Empleados",
  "Nómina", "Comisiones", "Horarios", "Chat interno",
  "Finanzas", "Reportes PDF", "Órdenes de compra", "Clientes",
];
function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="relative overflow-hidden py-4 border-y border-white/[0.06]">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10"
        style={{ background: `linear-gradient(to right, ${BG}, transparent)` }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10"
        style={{ background: `linear-gradient(to left, ${BG}, transparent)` }} />
      <div className="flex animate-[sfos-marquee_35s_linear_infinite]">
        {items.map((item, i) => (
          <span key={i} className="mx-6 flex flex-shrink-0 items-center gap-2.5 text-sm font-medium text-white/30 whitespace-nowrap">
            <span className="h-1 w-1 rounded-full flex-shrink-0" style={{ background: B, opacity: 0.6 }} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── CSS iPhone mockup ────────────────────────────────────────────
function PhoneMockup() {
  return (
    <div className="relative mx-auto" style={{ width: 220, height: 440 }}>
      <div className="absolute inset-0 rounded-[40px] border-2 border-white/10"
        style={{ background: "linear-gradient(145deg, #111316, #0a0b0d)" }} />
      <div className="absolute -left-[3px] top-20 h-8 w-[3px] rounded-l-full bg-white/10" />
      <div className="absolute -left-[3px] top-32 h-12 w-[3px] rounded-l-full bg-white/10" />
      <div className="absolute -left-[3px] top-48 h-12 w-[3px] rounded-l-full bg-white/10" />
      <div className="absolute -right-[3px] top-28 h-14 w-[3px] rounded-r-full bg-white/10" />
      <div className="absolute inset-[3px] rounded-[38px] overflow-hidden" style={{ background: "#0a0b0d" }}>
        <div className="mx-auto mt-4 h-6 w-20 rounded-full bg-black flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-white/5" />
        </div>
        <div className="px-4 pt-3 space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-semibold text-white/60">9:41</span>
            <div className="flex gap-1 items-center">
              <div className="h-1.5 w-3 rounded-full bg-white/40" />
              <div className="h-1.5 w-3 rounded-full bg-white/40" />
              <div className="h-1.5 w-4 rounded-full border border-white/40 relative">
                <div className="absolute inset-[1px] right-1 rounded-full bg-white/50" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] font-bold text-white">Dashboard</span>
            <div className="h-5 w-5 rounded-full" style={{ background: `${B}30` }}>
              <div className="h-full w-full rounded-full flex items-center justify-center">
                <div className="h-2 w-2 rounded-full" style={{ background: B }} />
              </div>
            </div>
          </div>
          <div className="rounded-2xl p-3 text-white"
            style={{ background: `linear-gradient(135deg, ${B}30, ${B}10)`, border: `1px solid ${B}25` }}>
            <p className="text-[8px] text-white/40 mb-0.5">Ingresos hoy</p>
            <p className="text-base font-bold">$1,842</p>
            <p className="text-[8px] text-white/40 mt-0.5">+18% vs ayer</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[{ label: "Órdenes", val: "12", color: "#a78bfa" }, { label: "Pendientes", val: "4", color: "#fb923c" }].map(c => (
              <div key={c.label} className="rounded-xl p-2.5 bg-white/[0.04] border border-white/[0.06]">
                <p className="text-[7px] text-white/30 mb-1">{c.label}</p>
                <p className="text-xs font-bold" style={{ color: c.color }}>{c.val}</p>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            {[
              { name: "iPhone 14 Pro", status: "Listo", dot: "#34d399" },
              { name: "Samsung S23",   status: "En reparación", dot: "#fbbf24" },
              { name: "MacBook Air",   status: "Diagnóstico", dot: B },
            ].map(o => (
              <div key={o.name} className="flex items-center justify-between px-1 py-1.5 rounded-lg bg-white/[0.03]">
                <p className="text-[8px] text-white/60 font-medium">{o.name}</p>
                <span className="flex items-center gap-1 text-[7px]" style={{ color: o.dot }}>
                  <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: o.dot }} />
                  {o.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 h-20 w-36 rounded-full blur-2xl opacity-30"
        style={{ background: B }} />
    </div>
  );
}

// ── Bento card ───────────────────────────────────────────────────
function BentoCard({ children, className = "", delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={`relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[#0d0d10] p-6 transition-colors duration-300 hover:border-white/[0.12] ${className}`}
    />
  );
}

// ── Photo slot ───────────────────────────────────────────────────
function PhotoSlot({ src, alt, fallbackGradient, fallbackIcon, fadeRight, borderLeft }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  return (
    <div className={`relative overflow-hidden ${borderLeft ? "border-l border-white/[0.05]" : ""}`}
      style={{ background: errored || !loaded ? fallbackGradient : undefined }}>
      {(!loaded || errored) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="absolute inset-0 opacity-[0.06]" style={{
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }} />
          <span className="relative text-3xl opacity-20 select-none">{fallbackIcon}</span>
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-24 w-24 rounded-full blur-2xl opacity-10"
            style={{ background: B }} />
        </div>
      )}
      {!errored && (
        <img src={src} alt={alt}
          className={`h-full w-full object-cover object-center transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
      {fadeRight && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(to right, transparent 65%, #0d0d10)" }} />
      )}
    </div>
  );
}

// ── Plan card ────────────────────────────────────────────────────
function PlanCard({ badge, name, price, annualNote, features, ctaLabel, ctaVariant = "outline",
  highlighted = false, delay = 0, onCta }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={`relative flex flex-col overflow-hidden rounded-[28px] border bg-[#0a0a0c] p-8 transition-all duration-300 ${
        highlighted
          ? "border-white/20 shadow-[0_24px_80px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-white/[0.07]"
      }`}
    >
      <div className={`pointer-events-none absolute h-44 w-44 rounded-full bg-white/[0.15] blur-3xl ${highlighted ? "-top-12 -right-12" : "-top-12 -left-12"}`} aria-hidden />
      <div className="relative">
        <p className="text-xs font-medium tracking-wide text-white/50">{badge}</p>
        <h3 className="mt-1 text-base font-semibold text-white">{name}</h3>
      </div>
      <div className="relative mt-6">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl font-semibold tracking-tight text-white">{price}</span>
          <span className="text-2xl font-medium text-white/40">/m</span>
        </div>
        <p className="mt-2 text-xs font-medium text-white/40">{annualNote}</p>
      </div>
      <div className="relative my-7 h-px w-full bg-white/[0.08]" />
      <ul className="relative flex-1 space-y-3.5">
        {features.map(f => (
          <li key={f} className="flex items-center gap-3 text-sm text-white/75">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={onCta}
        className={`relative mt-8 inline-flex h-14 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all active:scale-[0.98] ${
          ctaVariant === "solid"
            ? "bg-white text-black hover:bg-white/90 shadow-[0_8px_30px_rgba(255,255,255,0.18)]"
            : "border border-white/15 bg-black/40 text-white hover:bg-white/[0.04] hover:border-white/30"
        }`}
      >
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

// ── Billing toggle ───────────────────────────────────────────────
function BillingToggle({ annual, onChange }) {
  return (
    <button onClick={() => onChange(!annual)} role="switch" aria-checked={annual}
      className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 transition-colors hover:bg-white/[0.05]">
      <span className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${annual ? "bg-white" : "bg-white/15"}`}>
        <span className={`absolute h-4 w-4 rounded-full bg-black transition-transform ${annual ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
      <span className="text-sm font-medium text-white/80">
        Facturación anual
        <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">−33%</span>
      </span>
    </button>
  );
}

// ── Download buttons (conditional on feature flags) ──────────────
function DownloadButtons() {
  if (!TESTFLIGHT_ENABLED && !ANDROID_ENABLED) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 opacity-60">
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white shrink-0"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          <div className="text-left">
            <p className="text-[9px] font-medium text-white/40 uppercase tracking-wide leading-none mb-0.5">Próximamente en</p>
            <p className="text-sm font-semibold text-white leading-none">App Store</p>
          </div>
        </div>
        <p className="text-xs text-white/25">Lanzamiento próximamente · iOS y Android</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      {TESTFLIGHT_ENABLED && (
        <a href={TESTFLIGHT_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.06] px-5 py-3 transition-all hover:bg-white/[0.10] active:scale-[0.97]">
          <Download className="h-5 w-5 text-white/80 shrink-0" />
          <div className="text-left">
            <p className="text-[9px] font-medium text-white/40 uppercase tracking-wide leading-none mb-0.5">Disponible en</p>
            <p className="text-sm font-semibold text-white leading-none">TestFlight (iOS Beta)</p>
          </div>
        </a>
      )}
      {ANDROID_ENABLED && GOOGLE_PLAY_URL && (
        <a href={GOOGLE_PLAY_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/[0.06] px-5 py-3 transition-all hover:bg-white/[0.10] active:scale-[0.97]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white/80 shrink-0"><path d="M3.18 23.76c.37.2.8.2 1.16 0l11.34-6.55-2.6-2.6-9.9 9.15zM.5 1.62C.18 1.99 0 2.54 0 3.25v17.5c0 .71.18 1.26.5 1.63l.08.07 9.8-9.8v-.23L.58 1.55.5 1.62zm19.17 8.9-2.47-1.43-2.93 2.93 2.93 2.93 2.5-1.44c.71-.41.71-1.08-.03-1.99zm-16 12.04L14.8 15.9l-2.6-2.6-9.34 8.6.01.06z"/></svg>
          <div className="text-left">
            <p className="text-[9px] font-medium text-white/40 uppercase tracking-wide leading-none mb-0.5">Disponible en</p>
            <p className="text-sm font-semibold text-white leading-none">Google Play</p>
          </div>
        </a>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────
export default function Landing() {
  useAuthRedirect();
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  const priceFor = (plan) => {
    if (annual) return `$${(plan.priceAnnual / 12).toFixed(2)}`;
    return `$${plan.price.toFixed(2)}`;
  };
  const annualNote = (plan) =>
    annual ? `$${plan.priceAnnual.toFixed(2)} facturado anualmente` : "Cancela cuando quieras";

  const handlePlanCta = () => {
    if (TESTFLIGHT_ENABLED) {
      window.open(TESTFLIGHT_URL, "_blank", "noopener,noreferrer");
    } else {
      document.getElementById("download")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden text-white selection:bg-white/20"
      style={{ background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif" }}>

      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[600px]" aria-hidden
        style={{ background: `radial-gradient(ellipse 60% 40% at 60% -5%, ${B}14, transparent 65%)` }} />

      {/* Grid texture */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.025]" aria-hidden style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      {/* ── NAV ── */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-sm"
        style={{ background: `${BG}cc` }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: B }}>
            <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold tracking-tight">SmartFixOS</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => scrollTo("features")}
            className="hidden sm:block text-sm font-medium text-white/40 hover:text-white/70 transition-colors px-3 py-2">
            Características
          </button>
          <button onClick={() => scrollTo("planes")}
            className="hidden sm:block text-sm font-medium text-white/40 hover:text-white/70 transition-colors px-3 py-2">
            Planes
          </button>
          <button onClick={() => scrollTo("download")}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: B }}>
            {TESTFLIGHT_ENABLED ? "Descargar" : "Próximamente"}
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-2 items-center gap-12 px-6 pt-28 pb-8 lg:pt-36 lg:pb-12">
        <div>
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            {TESTFLIGHT_ENABLED ? "Beta disponible en TestFlight" : "Beta en TestFlight · App Store próximamente"}
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="text-[2.8rem] font-bold leading-[1.06] tracking-[-0.04em] sm:text-6xl lg:text-[4rem]">
            El sistema que{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(135deg, #fff 20%, ${B})` }}>
              tu taller<br />necesitaba.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.6 }}
            className="mt-5 max-w-md text-base leading-relaxed text-white/40 sm:text-lg">
            Órdenes, POS, inventario, empleados y finanzas —
            diseñado específicamente para talleres de reparación electrónica.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.5 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <DownloadButtons />
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.42, duration: 0.5 }}
            className="mt-5 text-xs text-white/20">
            15 días gratis · Sin tarjeta · Cancela cuando quieras
          </motion.p>
        </div>

        <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="flex justify-center lg:justify-end">
          <PhoneMockup />
        </motion.div>
      </section>

      {/* ── MARQUEE ── */}
      <Marquee />

      {/* ── FEATURES BENTO ── */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20 scroll-mt-20">
        <FadeUp className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Todo lo que necesita tu taller</h2>
          <p className="mt-2 text-sm text-white/35">Una sola app. Cero complicaciones.</p>
        </FadeUp>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-3 auto-rows-fr">
          <BentoCard delay={0.05} className="col-span-2 lg:col-span-2 lg:row-span-2">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[13px]" style={{ background: `${B}20` }}>
              <ClipboardList className="h-5 w-5" style={{ color: B }} strokeWidth={1.8} />
            </div>
            <h3 className="mb-1.5 text-base font-semibold">Órdenes de trabajo</h3>
            <p className="text-sm text-white/40 leading-relaxed">Crea y asigna reparaciones en segundos. Estado en tiempo real, historial por cliente, notas y fotos del dispositivo.</p>
            <div className="mt-5 space-y-2">
              {[
                { d: "iPhone 14 Pro", s: "Listo", c: "#34d399" },
                { d: "Samsung S23",   s: "En reparación", c: "#fbbf24" },
                { d: "iPad Air",      s: "Pendiente", c: "#f472b6" },
              ].map(o => (
                <div key={o.d} className="flex items-center justify-between rounded-xl px-3 py-2.5 bg-white/[0.04] border border-white/[0.05]">
                  <span className="text-xs text-white/60 font-medium">{o.d}</span>
                  <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: o.c }}>
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: o.c }} />
                    {o.s}
                  </span>
                </div>
              ))}
            </div>
          </BentoCard>

          <BentoCard delay={0.1} className="col-span-1 lg:col-span-1">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "#a78bfa20" }}>
              <CreditCard className="h-4 w-4 text-violet-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1 text-sm font-semibold">POS y caja</h3>
            <p className="text-xs text-white/35 leading-relaxed">Cobra al mostrador. Cuadre de caja al cierre del día.</p>
          </BentoCard>

          <BentoCard delay={0.13} className="col-span-1 lg:col-span-1">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "#34d39920" }}>
              <Package className="h-4 w-4 text-emerald-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1 text-sm font-semibold">Inventario</h3>
            <p className="text-xs text-white/35 leading-relaxed">Partes, servicios y alertas de stock bajo.</p>
          </BentoCard>

          <BentoCard delay={0.16} className="col-span-2 lg:col-span-2 lg:row-span-2">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[13px]" style={{ background: "#fbbf2420" }}>
              <BarChart3 className="h-5 w-5 text-amber-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1.5 text-base font-semibold">Finanzas y reportes</h3>
            <p className="text-sm text-white/40 leading-relaxed">Ingresos, gastos y márgenes al instante. Reporte mensual en PDF listo para enviar.</p>
            <div className="mt-5 flex items-end gap-1.5 h-16">
              {[40, 65, 50, 80, 55, 90, 70, 95, 60, 85, 75, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm"
                  style={{ height: `${h}%`, background: i === 11 ? `linear-gradient(to top, ${B}, #38bdf8)` : "rgba(255,255,255,0.08)" }} />
              ))}
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-[10px] text-white/20">Ene</span>
              <span className="text-[10px] text-white/20">Dic</span>
            </div>
          </BentoCard>

          <BentoCard delay={0.2} className="col-span-1 lg:col-span-1">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "#f472b620" }}>
              <Users className="h-4 w-4 text-pink-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1 text-sm font-semibold">Empleados</h3>
            <p className="text-xs text-white/35 leading-relaxed">Nómina, horarios y comisiones por técnico.</p>
          </BentoCard>

          <BentoCard delay={0.23} className="col-span-1 lg:col-span-1">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "#38bdf820" }}>
              <MessageSquare className="h-4 w-4 text-sky-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1 text-sm font-semibold">Chat del equipo</h3>
            <p className="text-xs text-white/35 leading-relaxed">Comunicación interna en tiempo real.</p>
          </BentoCard>
        </div>
      </section>

      {/* ── FOUNDER STORY ── */}
      <section id="nosotros" className="mx-auto max-w-6xl px-6 py-16 scroll-mt-20">
        <FadeUp>
          <div className="overflow-hidden rounded-[32px] border border-white/[0.07] bg-[#0d0d10]">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="grid grid-cols-2 gap-0 h-64 lg:h-auto min-h-[280px]">
                <PhotoSlot src="/images/founder-1.jpg" alt="Técnico reparando MacBook"
                  fallbackGradient="linear-gradient(145deg,#0f1115,#13161c,#0a0c10)"
                  fallbackIcon="🔧" fadeRight />
                <PhotoSlot src="/images/founder-2.jpg" alt="Soldando placa en taller"
                  fallbackGradient="linear-gradient(145deg,#0c0e12,#111418,#080a0e)"
                  fallbackIcon="⚡" borderLeft fadeRight />
              </div>
              <div className="flex flex-col justify-center px-8 py-10 lg:px-10 lg:py-12">
                <p className="mb-4 text-[10px] font-bold tracking-[0.15em] uppercase text-white/30">Historia del creador</p>
                <h2 className="text-2xl font-bold tracking-tight leading-snug sm:text-3xl">
                  Creado por un técnico,{" "}
                  <span className="bg-clip-text text-transparent"
                    style={{ backgroundImage: `linear-gradient(135deg, ${B}, #38bdf8)` }}>
                    para técnicos.
                  </span>
                </h2>
                <div className="mt-5 space-y-3 text-sm text-white/45 leading-relaxed">
                  <p>Como técnico de reparación con años de experiencia, probé docenas de sistemas de gestión para talleres.{" "}
                    <span className="text-white/70 font-medium">Ninguno cumplía con mis expectativas.</span></p>
                  <p>Los sistemas existentes eran lentos, complicados, o simplemente no estaban diseñados para el ritmo real de un taller de reparación. Perdía más tiempo navegando menús que reparando dispositivos.</p>
                  <p className="font-semibold text-white/60">Por eso creé SmartFixOS.</p>
                  <p>Un sistema diseñado desde cero para facilitar a los talleres un flujo de trabajo natural y de fácil manejo, con interfaces optimizadas y todas las herramientas que realmente necesitas.</p>
                </div>
                <div className="mt-7 flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5">
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px]"
                    style={{ background: `${B}20` }}>
                    <Zap className="h-3.5 w-3.5" style={{ color: B }} strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/70 mb-0.5">Compromiso Continuo</p>
                    <p className="text-xs text-white/35 leading-relaxed">
                      Actualizaciones constantes y mejoras basadas en las necesidades reales de talleres como el tuyo.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── PLANES ── */}
      <section id="planes" className="mx-auto max-w-6xl px-6 py-20 scroll-mt-20">
        <FadeUp className="mb-12 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[11px] font-semibold tracking-wide text-white/70">
            <Zap className="w-3 h-3" />
            15 días gratis · sin tarjeta de crédito
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-5xl">Planes simples.</h2>
          <p className="mx-auto mt-3 max-w-md text-base text-white/45">Sin contratos. Sin sorpresas. Cancela cuando quieras.</p>
          <div className="mt-8 flex justify-center">
            <BillingToggle annual={annual} onChange={setAnnual} />
          </div>
        </FadeUp>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 max-w-4xl mx-auto">
          <PlanCard
            badge="Plan Solo"
            name={PLANS.solo.tagline}
            price={priceFor(PLANS.solo)}
            annualNote={annualNote(PLANS.solo)}
            features={SOLO_FEATURES}
            ctaLabel={TESTFLIGHT_ENABLED ? "Unirse al beta" : "Próximamente"}
            ctaVariant="outline"
            delay={0.1}
            onCta={handlePlanCta}
          />
          <PlanCard
            badge="Plan Equipo"
            name={PLANS.team.tagline}
            price={priceFor(PLANS.team)}
            annualNote={annualNote(PLANS.team)}
            features={TEAM_FEATURES}
            ctaLabel={TESTFLIGHT_ENABLED ? "Unirse al beta" : "Próximamente"}
            ctaVariant="solid"
            highlighted
            delay={0.2}
            onCta={handlePlanCta}
          />
        </div>

        <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mx-auto mt-10 max-w-xl text-center text-sm text-white/40">
          Ambos planes incluyen <span className="text-white/70 font-medium">15 días de prueba gratis</span>.
          Gestiona tu suscripción en cualquier momento desde{" "}
          <button onClick={() => navigate("/billing")}
            className="text-white/60 underline underline-offset-2 hover:text-white transition-colors">
            tu portal de suscripción
          </button>.
        </motion.p>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section className="mx-auto max-w-xl px-6 py-12 text-center">
        <FadeUp>
          <div className="flex justify-center gap-0.5 mb-4">
            {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
          </div>
          <blockquote className="text-base font-medium text-white/55 italic leading-relaxed">
            "Le damos seguimiento a cada reparación, sabemos cuánto ganamos al día
            y el equipo siempre está coordinado — todo desde una sola app."
          </blockquote>
          <p className="mt-4 text-xs text-white/25">— Taller beta · Puerto Rico</p>
        </FadeUp>
      </section>

      {/* ── DOWNLOAD CTA ── */}
      <section id="download" className="mx-auto max-w-2xl px-6 py-20 text-center scroll-mt-20">
        <FadeUp>
          <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">Tu taller, organizado.</h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-white/35">
            {TESTFLIGHT_ENABLED
              ? "Disponible ahora en TestFlight. App Store próximamente."
              : "Lanzamiento próximo en App Store y Google Play."}
          </p>
          <div className="mt-8 flex justify-center">
            <DownloadButtons />
          </div>
        </FadeUp>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.05] px-6 py-10">
        <div className="mx-auto max-w-6xl flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-[8px]" style={{ background: B }}>
              <Zap className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-white/70">SmartFixOS</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/25">
            <button onClick={() => scrollTo("features")} className="hover:text-white/50 transition-colors">Características</button>
            <button onClick={() => scrollTo("planes")} className="hover:text-white/50 transition-colors">Planes</button>
            <button onClick={() => navigate("/billing")} className="hover:text-white/50 transition-colors">Suscripción</button>
          </nav>
          <p className="text-xs text-white/15">© 2026 SmartFixOS</p>
        </div>
      </footer>
    </div>
  );
}
