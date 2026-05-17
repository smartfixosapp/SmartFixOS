import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ChevronLeft, ArrowRight, Zap } from "lucide-react";
import { PLANS } from "@/lib/plans";

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

function NavPill({ onBack, onLogin }) {
  return (
    <nav className="sticky top-4 z-50 flex justify-center px-4">
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2 py-1.5 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Volver
        </button>
        <span className="rounded-full px-4 py-2 text-sm font-semibold text-white bg-white/5">
          Planes
        </span>
        <button
          onClick={onLogin}
          className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black hover:bg-white/90 transition-colors active:scale-95"
        >
          Iniciar Sesión
        </button>
      </div>
    </nav>
  );
}

function PlanCard({
  badge,
  name,
  price,
  priceSuffix,
  annualNote,
  features,
  ctaLabel,
  ctaVariant = "outline",
  glowPosition = "top-left",
  onClick,
  highlighted = false,
  delay = 0,
}) {
  const glowClass =
    glowPosition === "top-right"
      ? "-top-12 -right-12"
      : glowPosition === "top-center"
      ? "-top-16 left-1/2 -translate-x-1/2"
      : "-top-12 -left-12";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      className={`relative flex flex-col overflow-hidden rounded-[28px] border bg-[#0a0a0c] p-8 transition-all duration-300 ${
        highlighted
          ? "border-white/20 shadow-[0_24px_80px_rgba(255,255,255,0.06),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-white/[0.07] shadow-[0_20px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
      }`}
    >
      <div
        className={`pointer-events-none absolute h-44 w-44 rounded-full bg-white/[0.18] blur-3xl ${glowClass}`}
        aria-hidden
      />
      {highlighted && (
        <div
          className="pointer-events-none absolute -bottom-16 -right-12 h-44 w-44 rounded-full bg-white/[0.10] blur-3xl"
          aria-hidden
        />
      )}

      <div className="relative">
        <p className="text-xs font-medium tracking-wide text-white/50">{badge}</p>
        <h3 className="mt-1 text-base font-semibold text-white">{name}</h3>
      </div>

      <div className="relative mt-6">
        <div className="flex items-baseline gap-1">
          <span className="text-5xl sm:text-6xl font-semibold tracking-tight text-white">
            {price}
          </span>
          <span className="text-2xl font-medium text-white/40">{priceSuffix}</span>
        </div>
        {annualNote && (
          <p className="mt-2 text-xs font-medium text-white/40">{annualNote}</p>
        )}
      </div>

      <div className="relative my-7 h-px w-full bg-white/[0.08]" />

      <ul className="relative flex-1 space-y-3.5">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-3 text-sm text-white/75">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
              <Check className="h-3 w-3 text-white" strokeWidth={3} />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onClick}
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

function BillingToggle({ annual, onChange }) {
  return (
    <button
      onClick={() => onChange(!annual)}
      className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 transition-colors hover:bg-white/[0.05]"
      role="switch"
      aria-checked={annual}
    >
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          annual ? "bg-white" : "bg-white/15"
        }`}
      >
        <span
          className={`absolute h-4 w-4 rounded-full bg-black transition-transform ${
            annual ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
      <span className="text-sm font-medium text-white/80">
        Facturación anual
        <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">
          −33%
        </span>
      </span>
    </button>
  );
}

export default function Pricing() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);

  const priceFor = (plan) => {
    if (annual) {
      const monthly = plan.priceAnnual / 12;
      return `$${monthly.toFixed(2)}`;
    }
    return `$${plan.price.toFixed(2)}`;
  };

  const annualNote = (plan) =>
    annual
      ? `$${plan.priceAnnual.toFixed(2)} facturado anualmente`
      : "Cancela cuando quieras";

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-black text-white selection:bg-white/20">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(1200px 600px at 50% -200px, rgba(255,255,255,0.06), transparent 60%)",
        }}
        aria-hidden
      />

      <NavPill
        onBack={() => navigate(-1)}
        onLogin={() => navigate("/PinAccess")}
      />

      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
        <header className="relative mb-12 text-center">
          <h1
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-4 sm:-top-8 select-none text-[22vw] sm:text-[16rem] font-bold tracking-tighter leading-none text-white/[0.05]"
            style={{ filter: "blur(2px)" }}
          >
            Pricing
          </h1>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative pt-20 sm:pt-32"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[11px] font-semibold tracking-wide text-white/70">
              <Zap className="w-3 h-3" />
              15 días gratis · sin tarjeta de crédito
            </span>
            <h2 className="mt-5 text-4xl sm:text-6xl font-semibold tracking-tight text-white">
              Planes simples.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-base sm:text-lg text-white/45">
              Sin contratos. Sin sorpresas. Cancela cuando quieras.
            </p>

            <div className="mt-8 flex justify-center">
              <BillingToggle annual={annual} onChange={setAnnual} />
            </div>
          </motion.div>
        </header>

        <section className="relative mx-auto grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
          <PlanCard
            badge="Plan Solo"
            name={PLANS.solo.tagline}
            price={priceFor(PLANS.solo)}
            priceSuffix="/m"
            annualNote={annualNote(PLANS.solo)}
            features={SOLO_FEATURES}
            ctaLabel="Empezar gratis"
            ctaVariant="outline"
            glowPosition="top-left"
            onClick={() => navigate(`/PinAccess?action=register&plan=solo`)}
            delay={0.1}
          />

          <PlanCard
            badge="Plan Equipo"
            name={PLANS.team.tagline}
            price={priceFor(PLANS.team)}
            priceSuffix="/m"
            annualNote={annualNote(PLANS.team)}
            features={TEAM_FEATURES}
            ctaLabel="Empezar gratis"
            ctaVariant="solid"
            glowPosition="top-right"
            highlighted
            onClick={() => navigate(`/PinAccess?action=register&plan=team`)}
            delay={0.2}
          />
        </section>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mx-auto mt-12 max-w-xl text-center text-sm text-white/40"
        >
          Ambos planes incluyen{" "}
          <span className="text-white/70 font-medium">15 días de prueba gratis</span>.
          No se requiere tarjeta de crédito. Puedes cambiar de plan o cancelar en
          cualquier momento desde{" "}
          <button
            onClick={() => navigate("/billing")}
            className="text-white/60 underline underline-offset-2 hover:text-white transition-colors"
          >
            tu portal de suscripción
          </button>
          .
        </motion.p>
      </main>
    </div>
  );
}
