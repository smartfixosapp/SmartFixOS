import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Apple, Mail, KeyRound } from "lucide-react";
import { Section, Eyebrow, Heading, ButtonPrimary } from "../primitives";
import { EASE, VIEWPORT, fadeUp, fadeUpAt, scaleIn, staggerList } from "../motion";
import { TESTFLIGHT_URL, REGISTRO_PATH } from "../constants";

const STEPS = [
  {
    num: "01",
    icon: Apple,
    title: "Instala TestFlight",
    body: "Bájala del App Store. Es la app de Apple para probar betas.",
  },
  {
    num: "02",
    icon: Mail,
    title: "Abre la invitación",
    body: "Toca el botón de abajo y acepta entrar a la beta de Archilla OS.",
  },
  {
    num: "03",
    icon: KeyRound,
    title: "Crea tu PIN y entra",
    body: "Pones tu PIN, abres tu taller y empiezas a meter órdenes.",
  },
];

function StepCard({ num, icon: Icon, title, body }) {
  return (
    <motion.article
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.28, ease: EASE }}
      className="group relative flex flex-col gap-4 overflow-hidden rounded-3xl border bg-ar-card p-7 ar-shadow-card hover:ar-shadow-lift-accent sm:p-8"
      style={{ borderColor: "var(--ar-border)" }}
    >
      <div className="flex items-center justify-between">
        <motion.span
          variants={scaleIn}
          className="font-mono text-[44px] font-bold leading-none tracking-[-0.04em] tabular-nums"
          style={{ color: "var(--ar-accent)" }}
        >
          {num}
        </motion.span>
        <span
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border bg-ar-elev"
          style={{ borderColor: "var(--ar-border)" }}
        >
          <Icon className="h-5 w-5" strokeWidth={2} style={{ color: "var(--ar-text-2)" }} />
        </span>
      </div>

      <div>
        <h3 className="font-brico text-xl font-bold tracking-[-0.02em]" style={{ color: "var(--ar-text)" }}>
          {title}
        </h3>
        <p className="mt-2 text-[15px] leading-[1.5] text-ar-ink2">{body}</p>
      </div>
    </motion.article>
  );
}

export function ComoEntrar() {
  return (
    <Section id="como-entra" className="relative overflow-hidden">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="flex flex-col items-start"
      >
        <motion.div variants={fadeUp}>
          <Eyebrow>· CÓMO ENTRAR</Eyebrow>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Heading as="h2" className="mt-5 max-w-[18ch]">
            Pruébalo hoy. Tres pasos.
          </Heading>
        </motion.div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        {STEPS.map((s) => (
          <StepCard key={s.num} {...s} />
        ))}
      </motion.div>

      <motion.div {...fadeUpAt(0.1)} className="mt-12 flex flex-col items-center gap-5">
        <ButtonPrimary
          href={TESTFLIGHT_URL}
          target="_blank"
          rel="noopener noreferrer"
          subLabel="14 DÍAS GRATIS · SIN TARJETA"
        >
          Probar el app
        </ButtonPrimary>

        <p className="text-center text-[15px] leading-[1.5] text-ar-ink2">
          ¿Prefieres empezar desde la computadora?{" "}
          <Link
            to={REGISTRO_PATH}
            className="ar-focus-ring rounded-sm font-semibold underline underline-offset-4"
            style={{ color: "var(--ar-accent)", textDecorationColor: "var(--ar-border-accent)" }}
          >
            Crea tu taller en la web
          </Link>
        </p>
      </motion.div>
    </Section>
  );
}
