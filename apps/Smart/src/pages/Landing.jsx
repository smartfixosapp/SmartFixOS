import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight, Zap, CheckCircle, ChevronRight,
  ClipboardList, Package, Users, BarChart3,
  ShoppingCart, MessageSquare, CreditCard, Star,
} from "lucide-react";
import { supabase } from "../../../../lib/supabase-client.js";

// ── Redirect authenticated users straight to the Dashboard ──────────────
function useAuthRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/Dashboard", { replace: true });
    });
  }, [navigate]);
}

// ── Brand color constants ────────────────────────────────────────────────
const BRAND = "#0ea5e9";    // sky-500 — iOS-style blue
const BRAND_DIM = "rgba(14,165,233,0.15)";

// ── Sub-components ───────────────────────────────────────────────────────

function Nav({ onCTA }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2" : "py-4"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{ background: BRAND }}
          >
            <Zap className="h-4.5 w-4.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">SmartFixOS</span>
        </div>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-1 rounded-full border border-white/10 bg-black/50 px-2 py-1.5 backdrop-blur-xl">
          <NavLink href="#features">Funciones</NavLink>
          <NavLink href="#plans">Planes</NavLink>
        </nav>

        {/* CTA */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCTA("login")}
            className="hidden sm:block text-sm font-medium text-white/60 hover:text-white transition-colors px-3 py-2"
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => onCTA("signup")}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: BRAND }}
          >
            Empezar gratis
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }) {
  return (
    <a
      href={href}
      className="rounded-full px-4 py-1.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white transition-colors"
    >
      {children}
    </a>
  );
}

const FEATURES = [
  {
    icon: ClipboardList,
    title: "Órdenes de trabajo",
    desc: "Crea, asigna y sigue el estado de cada reparación. Historial completo por cliente y técnico.",
    color: BRAND,
  },
  {
    icon: CreditCard,
    title: "POS y caja registradora",
    desc: "Cobra al mostrador, registra pagos en efectivo, tarjeta o transferencia. Cuadre de caja al instante.",
    color: "#a78bfa", // purple
  },
  {
    icon: Package,
    title: "Inventario",
    desc: "Catálogo de partes y servicios, alertas de stock bajo, códigos de barras integrados.",
    color: "#34d399", // emerald
  },
  {
    icon: BarChart3,
    title: "Finanzas",
    desc: "Ingresos del día, semana y mes. Gastos, márgenes y reportes exportables en PDF.",
    color: "#fbbf24", // amber
  },
  {
    icon: Users,
    title: "Empleados y nómina",
    desc: "Horarios, ponchados, comisiones por técnico y pago de nómina — todo en un lugar.",
    color: "#f472b6", // pink
  },
  {
    icon: MessageSquare,
    title: "Chat del equipo",
    desc: "Comunicación interna sin salir de la app. Notificaciones en tiempo real para todo tu equipo.",
    color: "#38bdf8", // sky
  },
];

function FeatureCard({ icon: Icon, title, desc, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ delay, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className="group relative rounded-[24px] border border-white/[0.07] bg-[#0d0d0f] p-6 transition-all duration-300 hover:border-white/15 hover:bg-[#111113]"
    >
      <div
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px]"
        style={{ background: `${color}20` }}
      >
        <Icon className="h-5 w-5" style={{ color }} strokeWidth={1.8} />
      </div>
      <h3 className="mb-1.5 text-sm font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-white/45">{desc}</p>
    </motion.div>
  );
}

function PlanTeaser({ navigate }) {
  return (
    <section id="plans" className="mx-auto max-w-4xl px-5 py-24">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Dos planes. Todo incluido.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base text-white/45">
          Sin límites escondidos. Cancela cuando quieras.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PlanTeaserCard
          name="Plan Solo"
          price="$14.99"
          tagline="Para técnicos independientes"
          items={["Órdenes ilimitadas", "POS y caja", "Inventario y catálogo", "Clientes ilimitados"]}
          delay={0.1}
          onClick={() => navigate("/Pricing")}
        />
        <PlanTeaserCard
          name="Plan Equipo"
          price="$44.99"
          tagline="Gestión completa de equipo"
          items={["Todo del Plan Solo", "Empleados y nómina", "Chat interno", "Comisiones y reportes PDF"]}
          highlight
          delay={0.2}
          onClick={() => navigate("/Pricing")}
        />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.35, duration: 0.5 }}
        className="mt-6 text-center text-sm text-white/30"
      >
        Ambos incluyen <span className="text-white/60 font-medium">15 días gratis</span> · Sin tarjeta de crédito ·{" "}
        <button
          onClick={() => navigate("/Pricing")}
          className="text-white/50 underline underline-offset-2 hover:text-white/80 transition-colors"
        >
          Ver planes completos →
        </button>
      </motion.p>
    </section>
  );
}

function PlanTeaserCard({ name, price, tagline, items, highlight, delay, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      onClick={onClick}
      className={`relative cursor-pointer overflow-hidden rounded-[24px] border p-7 transition-all duration-300 hover:scale-[1.015] ${
        highlight
          ? "border-white/20 bg-[#0d0d0f] shadow-[0_20px_60px_rgba(255,255,255,0.04)]"
          : "border-white/[0.07] bg-[#0a0a0c]"
      }`}
    >
      {highlight && (
        <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-white/[0.06] blur-3xl" />
      )}
      <div className="mb-4">
        <span className="text-xs font-semibold text-white/40">{name}</span>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight text-white">{price}</span>
          <span className="text-lg text-white/30">/m</span>
        </div>
        <p className="mt-0.5 text-xs text-white/40">{tagline}</p>
      </div>
      <div className="h-px w-full bg-white/[0.07] my-5" />
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2.5 text-sm text-white/60">
            <CheckCircle className="h-4 w-4 flex-shrink-0 text-white/30" strokeWidth={1.5} />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center gap-1.5 text-sm font-medium text-white/40">
        Ver más
        <ChevronRight className="h-4 w-4" />
      </div>
    </motion.div>
  );
}

function Footer({ navigate }) {
  return (
    <footer className="border-t border-white/[0.06] px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[9px]"
              style={{ background: BRAND }}
            >
              <Zap className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-bold text-white/80">SmartFixOS</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-white/30">
            <button onClick={() => navigate("/Pricing")} className="hover:text-white/60 transition-colors">Planes</button>
            <button onClick={() => navigate("/billing")} className="hover:text-white/60 transition-colors">Suscripción</button>
            <button onClick={() => navigate("/PinAccess")} className="hover:text-white/60 transition-colors">Iniciar sesión</button>
          </nav>
          <p className="text-xs text-white/20">© 2026 SmartFixOS</p>
        </div>
      </div>
    </footer>
  );
}

// ── Main page ────────────────────────────────────────────────────────────

export default function Landing() {
  useAuthRedirect();
  const navigate = useNavigate();

  const handleCTA = (type) => {
    if (type === "login") navigate("/PinAccess");
    else navigate("/Pricing");
  };

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-[#080809] text-white selection:bg-white/20">

      {/* Global ambient glow */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[500px]"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -10%, ${BRAND}18, transparent 70%)`,
        }}
        aria-hidden
      />

      <Nav onCTA={handleCTA} />

      {/* ── HERO ── */}
      <section className="relative mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-center px-5 pb-16 pt-28 text-center">

        {/* Pill badge */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-white/60 backdrop-blur-sm"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Disponible en iOS — Android próximamente
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
          style={{ lineHeight: 1.05, letterSpacing: "-0.03em" }}
        >
          Gestión{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(135deg, ${BRAND}, #38bdf8)` }}
          >
            inteligente
          </span>{" "}
          para tu taller
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/45 sm:text-xl"
        >
          Órdenes de trabajo, POS, inventario, empleados y finanzas —
          todo en una app diseñada para talleres de reparación electrónica.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <button
            onClick={() => handleCTA("signup")}
            className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:brightness-110 active:scale-[0.97]"
            style={{
              background: `linear-gradient(135deg, ${BRAND}, #38bdf8)`,
              boxShadow: `0 8px 32px ${BRAND}40`,
            }}
          >
            <Zap className="h-4 w-4" strokeWidth={2.5} />
            Empezar gratis — 15 días
          </button>
          <button
            onClick={() => handleCTA("login")}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-white/70 backdrop-blur-sm transition-all hover:bg-white/[0.07] hover:text-white active:scale-[0.97]"
          >
            Ya tengo cuenta
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="mt-5 text-xs text-white/25"
        >
          Sin tarjeta de crédito · Cancela cuando quieras · Datos seguros en Supabase
        </motion.p>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="flex flex-col items-center gap-1.5 text-white/20">
            <div className="h-8 w-px bg-gradient-to-b from-transparent to-white/20" />
            <span className="text-[10px] font-medium tracking-widest uppercase">Scroll</span>
          </div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="mx-auto max-w-6xl px-5 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Todo lo que necesita tu taller
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base text-white/40">
            Diseñado para la realidad del taller de reparaciones — no para empresas corporativas.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.07} />
          ))}
        </div>
      </section>

      {/* ── PLANS TEASER ── */}
      <PlanTeaser navigate={navigate} />

      {/* ── SOCIAL PROOF ── */}
      <section className="mx-auto max-w-2xl px-5 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-4 flex justify-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
            ))}
          </div>
          <blockquote className="text-lg font-medium text-white/70 italic leading-relaxed">
            "Le damos seguimiento a cada reparación, sabemos cuánto ganamos al día y
            el equipo está siempre coordinado — todo desde una sola app."
          </blockquote>
          <p className="mt-4 text-sm text-white/30">
            — Taller beta, Puerto Rico
          </p>
        </motion.div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="mx-auto max-w-2xl px-5 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Empieza hoy, gratis.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-base text-white/40">
            15 días sin compromiso. Sin tarjeta. Sin contratos.
          </p>
          <button
            onClick={() => handleCTA("signup")}
            className="mt-8 inline-flex items-center gap-2 rounded-full px-8 py-4 text-base font-semibold text-white transition-all hover:brightness-110 active:scale-[0.97]"
            style={{
              background: `linear-gradient(135deg, ${BRAND}, #38bdf8)`,
              boxShadow: `0 12px 40px ${BRAND}40`,
            }}
          >
            Crear mi taller gratis
            <ArrowRight className="h-4.5 w-4.5" />
          </button>
        </motion.div>
      </section>

      <Footer navigate={navigate} />
    </div>
  );
}
