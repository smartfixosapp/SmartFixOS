import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight, ClipboardList, Package, Users,
  BarChart3, CreditCard, MessageSquare,
  ShoppingCart, Clock, Zap, Star,
} from "lucide-react";
import { supabase } from "../../../../lib/supabase-client.js";

// ── Auth redirect for already-logged-in users ────────────────────────────
function useAuthRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/Dashboard", { replace: true });
    });
  }, [navigate]);
}

// ── Design tokens ────────────────────────────────────────────────────────
const B = "#0ea5e9";       // brand blue
const BG = "#07080a";      // near-black background

// ── Fade-in helper ───────────────────────────────────────────────────────
const FadeUp = ({ children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-40px" }}
    transition={{ delay, duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
    className={className}
  >
    {children}
  </motion.div>
);

// ── Marquee ──────────────────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  "Órdenes de trabajo", "POS y caja", "Inventario", "Empleados",
  "Nómina", "Comisiones", "Horarios", "Chat interno",
  "Finanzas", "Reportes PDF", "Órdenes de compra", "Clientes",
];

function Marquee() {
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div className="relative overflow-hidden py-4 border-y border-white/[0.06]">
      {/* fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10"
        style={{ background: `linear-gradient(to right, ${BG}, transparent)` }} />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10"
        style={{ background: `linear-gradient(to left, ${BG}, transparent)` }} />

      <div className="flex animate-[sfos-marquee_35s_linear_infinite]">
        {items.map((item, i) => (
          <span
            key={i}
            className="mx-6 flex flex-shrink-0 items-center gap-2.5 text-sm font-medium text-white/30 whitespace-nowrap"
          >
            <span className="h-1 w-1 rounded-full flex-shrink-0" style={{ background: B, opacity: 0.6 }} />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── iOS Phone mockup (CSS-only) ──────────────────────────────────────────
function PhoneMockup() {
  return (
    <div
      className="relative mx-auto"
      style={{ width: 220, height: 440 }}
    >
      {/* Outer shell */}
      <div
        className="absolute inset-0 rounded-[40px] border-2 border-white/10"
        style={{ background: "linear-gradient(145deg, #111316, #0a0b0d)" }}
      />
      {/* Side buttons */}
      <div className="absolute -left-[3px] top-20 h-8 w-[3px] rounded-l-full bg-white/10" />
      <div className="absolute -left-[3px] top-32 h-12 w-[3px] rounded-l-full bg-white/10" />
      <div className="absolute -left-[3px] top-48 h-12 w-[3px] rounded-l-full bg-white/10" />
      <div className="absolute -right-[3px] top-28 h-14 w-[3px] rounded-r-full bg-white/10" />
      {/* Screen bezel */}
      <div className="absolute inset-[3px] rounded-[38px] overflow-hidden"
        style={{ background: "#0a0b0d" }}
      >
        {/* Dynamic Island */}
        <div className="mx-auto mt-4 h-6 w-20 rounded-full bg-black flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-white/5" />
        </div>
        {/* Screen content */}
        <div className="px-4 pt-3 space-y-2.5">
          {/* Status bar */}
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
          {/* App header */}
          <div className="flex items-center justify-between mt-1">
            <span className="text-[11px] font-bold text-white">Dashboard</span>
            <div className="h-5 w-5 rounded-full" style={{ background: `${B}30` }}>
              <div className="h-full w-full rounded-full flex items-center justify-center">
                <div className="h-2 w-2 rounded-full" style={{ background: B }} />
              </div>
            </div>
          </div>
          {/* Revenue card */}
          <div className="rounded-2xl p-3 text-white"
            style={{ background: `linear-gradient(135deg, ${B}30, ${B}10)`, border: `1px solid ${B}25` }}
          >
            <p className="text-[8px] text-white/40 mb-0.5">Ingresos hoy</p>
            <p className="text-base font-bold">$1,842</p>
            <p className="text-[8px] text-white/40 mt-0.5">+18% vs ayer</p>
          </div>
          {/* Mini cards row */}
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Órdenes", val: "12", color: "#a78bfa" },
              { label: "Pendientes", val: "4",  color: "#fb923c" },
            ].map(c => (
              <div key={c.label} className="rounded-xl p-2.5 bg-white/[0.04] border border-white/[0.06]">
                <p className="text-[7px] text-white/30 mb-1">{c.label}</p>
                <p className="text-xs font-bold" style={{ color: c.color }}>{c.val}</p>
              </div>
            ))}
          </div>
          {/* Orders list */}
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
      {/* Ambient glow under phone */}
      <div
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 h-20 w-36 rounded-full blur-2xl opacity-30"
        style={{ background: B }}
      />
    </div>
  );
}

// ── Bento card ───────────────────────────────────────────────────────────
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

// ── App Store badge (placeholder) ────────────────────────────────────────
function AppStoreBadge({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/[0.05] px-5 py-3 transition-all hover:bg-white/[0.08] active:scale-[0.97] backdrop-blur-sm"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6 fill-white" xmlns="http://www.w3.org/2000/svg">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
      </svg>
      <div className="text-left">
        <p className="text-[9px] font-medium text-white/40 uppercase tracking-wide leading-none mb-0.5">Próximamente en</p>
        <p className="text-sm font-semibold text-white leading-none">App Store</p>
      </div>
    </button>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────
export default function Landing() {
  useAuthRedirect();
  const navigate = useNavigate();

  return (
    <div className="relative min-h-dvh overflow-x-hidden text-white selection:bg-white/20"
      style={{ background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif" }}
    >
      {/* Global ambient glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[600px]" style={{
        background: `radial-gradient(ellipse 60% 40% at 60% -5%, ${B}14, transparent 65%)`,
      }} aria-hidden />

      {/* Grid texture */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.025]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} aria-hidden />

      {/* ── NAV ── */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ background: B }}>
            <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold tracking-tight">SmartFixOS</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/Pricing")}
            className="hidden sm:block text-sm font-medium text-white/40 hover:text-white/70 transition-colors px-3 py-2">
            Planes
          </button>
          <button onClick={() => navigate("/Pricing")}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-95"
            style={{ background: B }}>
            Empezar gratis
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative mx-auto grid max-w-6xl grid-cols-1 lg:grid-cols-2 items-center gap-12 px-6 pt-28 pb-8 lg:pt-36 lg:pb-12">
        {/* Left */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-white/50"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Beta en TestFlight — App Store próximamente
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="text-[2.8rem] font-bold leading-[1.06] tracking-[-0.04em] sm:text-6xl lg:text-[4rem]"
          >
            El sistema que{" "}
            <span className="bg-clip-text text-transparent"
              style={{ backgroundImage: `linear-gradient(135deg, #fff 20%, ${B})` }}>
              tu taller<br />necesitaba.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.6 }}
            className="mt-5 max-w-md text-base leading-relaxed text-white/40 sm:text-lg"
          >
            Órdenes, POS, inventario, empleados y finanzas —
            diseñado específicamente para talleres de reparación electrónica.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.5 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <AppStoreBadge onClick={() => navigate("/Pricing")} />
            <button
              onClick={() => navigate("/Pricing")}
              className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all hover:bg-white/[0.06] text-white/60 hover:text-white active:scale-95"
            >
              Ver planes y precios
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.42, duration: 0.5 }}
            className="mt-5 text-xs text-white/20"
          >
            15 días gratis · Sin tarjeta · Cancela cuando quieras
          </motion.p>
        </div>

        {/* Right — Phone */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="flex justify-center lg:justify-end"
        >
          <PhoneMockup />
        </motion.div>
      </section>

      {/* ── MARQUEE ── */}
      <Marquee />

      {/* ── BENTO GRID ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <FadeUp className="mb-10 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Todo lo que necesita tu taller
          </h2>
          <p className="mt-2 text-sm text-white/35">
            Una sola app. Cero complicaciones.
          </p>
        </FadeUp>

        {/* Bento grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:grid-rows-3 auto-rows-fr">

          {/* 1 — Órdenes (wide) */}
          <BentoCard delay={0.05} className="col-span-2 lg:col-span-2 lg:row-span-2">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[13px]"
              style={{ background: `${B}20` }}>
              <ClipboardList className="h-5 w-5" style={{ color: B }} strokeWidth={1.8} />
            </div>
            <h3 className="mb-1.5 text-base font-semibold">Órdenes de trabajo</h3>
            <p className="text-sm text-white/40 leading-relaxed">
              Crea y asigna reparaciones en segundos. Estado en tiempo real, historial
              por cliente, notas y fotos del dispositivo.
            </p>
            {/* Mini mockup list */}
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

          {/* 2 — POS */}
          <BentoCard delay={0.1} className="col-span-1 lg:col-span-1">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[11px]"
              style={{ background: "#a78bfa20" }}>
              <CreditCard className="h-4.5 w-4.5 text-violet-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1 text-sm font-semibold">POS y caja</h3>
            <p className="text-xs text-white/35 leading-relaxed">Cobra al mostrador. Cuadre de caja al cierre del día.</p>
          </BentoCard>

          {/* 3 — Inventario */}
          <BentoCard delay={0.13} className="col-span-1 lg:col-span-1">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[11px]"
              style={{ background: "#34d39920" }}>
              <Package className="h-4.5 w-4.5 text-emerald-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1 text-sm font-semibold">Inventario</h3>
            <p className="text-xs text-white/35 leading-relaxed">Partes, servicios y alertas de stock bajo.</p>
          </BentoCard>

          {/* 4 — Finanzas (tall) */}
          <BentoCard delay={0.16} className="col-span-2 lg:col-span-2 lg:row-span-2">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[13px]"
              style={{ background: "#fbbf2420" }}>
              <BarChart3 className="h-5 w-5 text-amber-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1.5 text-base font-semibold">Finanzas y reportes</h3>
            <p className="text-sm text-white/40 leading-relaxed">
              Ingresos, gastos y márgenes al instante. Reporte mensual en PDF listo para enviar.
            </p>
            {/* Revenue chart bars */}
            <div className="mt-5 flex items-end gap-1.5 h-16">
              {[40, 65, 50, 80, 55, 90, 70, 95, 60, 85, 75, 100].map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm transition-all"
                  style={{
                    height: `${h}%`,
                    background: i === 11
                      ? `linear-gradient(to top, ${B}, #38bdf8)`
                      : `rgba(255,255,255,0.08)`,
                  }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-[10px] text-white/20">Ene</span>
              <span className="text-[10px] text-white/20">Dic</span>
            </div>
          </BentoCard>

          {/* 5 — Empleados */}
          <BentoCard delay={0.2} className="col-span-1 lg:col-span-1">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[11px]"
              style={{ background: "#f472b620" }}>
              <Users className="h-4.5 w-4.5 text-pink-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1 text-sm font-semibold">Empleados</h3>
            <p className="text-xs text-white/35 leading-relaxed">Nómina, horarios y comisiones por técnico.</p>
          </BentoCard>

          {/* 6 — Chat */}
          <BentoCard delay={0.23} className="col-span-1 lg:col-span-1">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[11px]"
              style={{ background: "#38bdf820" }}>
              <MessageSquare className="h-4.5 w-4.5 text-sky-400" strokeWidth={1.8} />
            </div>
            <h3 className="mb-1 text-sm font-semibold">Chat del equipo</h3>
            <p className="text-xs text-white/35 leading-relaxed">Comunicación interna en tiempo real.</p>
          </BentoCard>

        </div>
      </section>

      {/* ── FOUNDER STORY ── */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <FadeUp>
          <div className="overflow-hidden rounded-[32px] border border-white/[0.07] bg-[#0d0d10]">
            <div className="grid grid-cols-1 lg:grid-cols-2">

              {/* Photos */}
              <div className="grid grid-cols-2 gap-0 h-64 lg:h-auto">
                <div className="relative overflow-hidden">
                  <img
                    src="/images/founder-1.jpg"
                    alt="Técnico reparando dispositivo"
                    className="h-full w-full object-cover object-center"
                    onError={e => {
                      e.target.style.display = "none";
                      e.target.parentNode.style.background = "linear-gradient(135deg,#111316,#0a0b0d)";
                    }}
                  />
                  {/* fallback overlay pattern */}
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(to right, transparent 80%, #0d0d10)" }} />
                </div>
                <div className="relative overflow-hidden border-l border-white/[0.05]">
                  <img
                    src="/images/founder-2.jpg"
                    alt="Taller de reparación"
                    className="h-full w-full object-cover object-center"
                    onError={e => {
                      e.target.style.display = "none";
                      e.target.parentNode.style.background = "linear-gradient(135deg,#0f1013,#080809)";
                    }}
                  />
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(to right, transparent 80%, #0d0d10)" }} />
                </div>
              </div>

              {/* Text */}
              <div className="flex flex-col justify-center px-8 py-10 lg:px-10 lg:py-12">
                <p className="mb-4 text-[10px] font-bold tracking-[0.15em] uppercase text-white/30">
                  Historia del creador
                </p>

                <h2 className="text-2xl font-bold tracking-tight leading-snug sm:text-3xl">
                  Creado por un técnico,{" "}
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundImage: `linear-gradient(135deg, ${B}, #38bdf8)` }}
                  >
                    para técnicos.
                  </span>
                </h2>

                <div className="mt-5 space-y-3 text-sm text-white/45 leading-relaxed">
                  <p>
                    Como técnico de reparación con años de experiencia, probé docenas de
                    sistemas de gestión para talleres.{" "}
                    <span className="text-white/70 font-medium">
                      Ninguno cumplía con mis expectativas.
                    </span>
                  </p>
                  <p>
                    Los sistemas existentes eran lentos, complicados, o simplemente no estaban
                    diseñados para el ritmo real de un taller de reparación. Perdía más tiempo
                    navegando menús que reparando dispositivos.
                  </p>
                  <p className="font-semibold text-white/60">
                    Por eso creé SmartFixOS.
                  </p>
                  <p>
                    Un sistema diseñado desde cero para lograr facilitar a los talleres de
                    reparación un flujo de trabajo más natural y de fácil manejo, con flujos
                    optimizados, interfaz intuitiva, y todas las herramientas que realmente necesitas.
                  </p>
                </div>

                {/* Commitment badge */}
                <div className="mt-7 flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3.5">
                  <div
                    className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[8px]"
                    style={{ background: `${B}20` }}
                  >
                    <Zap className="h-3.5 w-3.5" style={{ color: B }} strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/70 mb-0.5">Compromiso Continuo</p>
                    <p className="text-xs text-white/35 leading-relaxed">
                      Actualizaciones constantes, nuevas funcionalidades y mejoras
                      basadas en las necesidades reales de talleres como el tuyo.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── PLANS STRIP ── */}
      <section className="mx-auto max-w-4xl px-6 py-12">
        <FadeUp className="rounded-[28px] border border-white/[0.07] bg-[#0d0d10] p-8 sm:p-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-2">Planes</p>
              <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
                Solo o con equipo —<br />tú eliges.
              </h3>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">$14.99</span>
                  <span className="text-sm text-white/30">/m · Solo</span>
                </div>
                <div className="hidden sm:block w-px bg-white/10" />
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">$44.99</span>
                  <span className="text-sm text-white/30">/m · Equipo</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-white/25">15 días gratis · Sin tarjeta de crédito</p>
            </div>
            <button
              onClick={() => navigate("/Pricing")}
              className="flex-shrink-0 inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
              style={{
                background: `linear-gradient(135deg, ${B}, #38bdf8)`,
                boxShadow: `0 8px 32px ${B}35`,
              }}
            >
              Ver planes completos
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </FadeUp>
      </section>

      {/* ── TESTIMONIAL ── */}
      <section className="mx-auto max-w-xl px-6 py-12 text-center">
        <FadeUp>
          <div className="flex justify-center gap-0.5 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <blockquote className="text-base font-medium text-white/55 italic leading-relaxed">
            "Le damos seguimiento a cada reparación, sabemos cuánto ganamos al día
            y el equipo siempre está coordinado — todo desde una sola app."
          </blockquote>
          <p className="mt-4 text-xs text-white/25">— Taller beta · Puerto Rico</p>
        </FadeUp>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        <FadeUp>
          <h2 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
            Tu taller, organizado.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-white/35">
            Empieza hoy con 15 días gratis. Sin tarjeta. Sin compromisos.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <AppStoreBadge onClick={() => navigate("/Pricing")} />
            <button
              onClick={() => navigate("/Pricing")}
              className="text-sm font-medium text-white/40 hover:text-white/70 transition-colors px-4 py-3"
            >
              Ver planes →
            </button>
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
            <button onClick={() => navigate("/Pricing")} className="hover:text-white/50 transition-colors">Planes</button>
            <button onClick={() => navigate("/billing")} className="hover:text-white/50 transition-colors">Suscripción</button>
          </nav>
          <p className="text-xs text-white/15">© 2026 SmartFixOS</p>
        </div>
      </footer>
    </div>
  );
}
