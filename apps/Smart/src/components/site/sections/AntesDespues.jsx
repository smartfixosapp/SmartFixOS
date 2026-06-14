import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { Section, Eyebrow, Heading, GlowBlob, useInViewOnce } from "../primitives";
import { EASE } from "../motion";

const PARES = [
  {
    antes: "Apuntas las órdenes en una libreta y a veces se pierde una.",
    con: "Cada orden viva en la app, con fotos y su estado.",
  },
  {
    antes: "Sacas el IVU con la calculadora y rezas que cuadre.",
    con: "IVU 11.5% calculado solo en cada venta.",
  },
  {
    antes: "El Excel de cuentas lo actualizas… cuando puedes.",
    con: "Ingresos, gastos y utilidad neta al día, sin teclear.",
  },
  {
    antes: "Le escribes a cada cliente por WhatsApp, uno por uno.",
    con: "El cliente recibe el aviso automático en cada paso.",
  },
  {
    antes: "La caja la cuentas a mano y nunca da igual.",
    con: "Cierre de caja que cuadra al peso.",
  },
];

const STAGGER_ROW = 0.07;
const antesLast = (PARES.length - 1) * STAGGER_ROW;
const conStart = antesLast + 0.25;

function AntesRow({ text, index, on }) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 12 }}
      animate={on ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
      transition={{ duration: 0.45, ease: EASE, delay: index * STAGGER_ROW }}
      className="flex items-start gap-3"
    >
      <span
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: "var(--ar-border)" }}
      >
        <X className="h-3.5 w-3.5" strokeWidth={1.8} style={{ color: "var(--ar-text-3)" }} />
      </span>
      <span className="text-[15px] leading-[1.45]" style={{ color: "var(--ar-text-2)" }}>
        {text}
      </span>
    </motion.li>
  );
}

function ConRow({ text, index, on }) {
  const delay = conStart + index * STAGGER_ROW;
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={on ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      className="flex items-start gap-3"
    >
      <span
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: "rgba(62,197,177,0.12)", boxShadow: "0 0 0 1px rgba(62,197,177,0.35)" }}
      >
        <motion.svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <motion.path
            d="M5 12.5 L10 17.5 L19 7"
            stroke="var(--ar-ok)"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={on ? { pathLength: 1 } : { pathLength: 0 }}
            transition={{ duration: 0.35, ease: EASE, delay: delay + 0.12 }}
          />
        </motion.svg>
      </span>
      <span className="text-[15px] leading-[1.45]" style={{ color: "var(--ar-text)" }}>
        {text}
      </span>
    </motion.li>
  );
}

export function AntesDespues() {
  const [ref, on] = useInViewOnce("-80px");

  return (
    <Section border>
      <Eyebrow>· ANTES / DESPUÉS</Eyebrow>
      <Heading
        as="h2"
        size="h2"
        className="mt-5"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        Lo de antes dolía. Lo de ahora alivia.
      </Heading>

      <div ref={ref} className="mt-12 grid gap-5 md:grid-cols-2">
        <div
          className="rounded-3xl border p-6 sm:p-7"
          style={{ background: "var(--ar-bg-elev)", borderColor: "var(--ar-border)" }}
        >
          <div
            className="font-mono uppercase"
            style={{ fontSize: 12, letterSpacing: "0.22em", color: "var(--ar-text-3)" }}
          >
            ANTES
          </div>
          <ul className="mt-6 flex flex-col gap-4">
            {PARES.map((p, i) => (
              <AntesRow key={p.antes} text={p.antes} index={i} on={on} />
            ))}
          </ul>
        </div>

        <div
          className="relative overflow-hidden rounded-3xl border p-6 sm:p-7"
          style={{ background: "var(--ar-card)", borderColor: "var(--ar-border-accent)", boxShadow: "0 0 0 1px var(--ar-border-accent), 0 24px 60px -36px var(--ar-glow)" }}
        >
          <GlowBlob size={320} className="-right-10 -top-10" opacity={0.14} blur={80} />
          <div
            className="font-mono uppercase"
            style={{ fontSize: 12, letterSpacing: "0.22em", color: "var(--ar-accent)" }}
          >
            CON ARCHILLA
          </div>
          <ul className="mt-6 flex flex-col gap-4">
            {PARES.map((p, i) => (
              <ConRow key={p.con} text={p.con} index={i} on={on} />
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
