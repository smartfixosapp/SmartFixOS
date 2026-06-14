import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { Section, Eyebrow, Heading, cx } from "../primitives";
import { EASE, VIEWPORT, fadeUpSm, staggerList } from "../motion";

const FAQS = [
  {
    q: "¿Esto de verdad funciona o es promesa?",
    a: "Funciona. Corre todos los días en un taller real (911 Smart Fix). Esto no es vaporware.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "$19 Solo o $49 Equipo al mes. Pruebas 14 días gratis, sin tarjeta.",
  },
  {
    q: "¿Cómo me suscribo?",
    a: "Desde el app (App Store) o desde la web, lo que prefieras. Los planes y los 14 días gratis están en ambos.",
  },
  {
    q: "¿Necesito tarjeta para probar?",
    a: "No. Tienes 14 días gratis para probar, sin tarjeta.",
  },
  {
    q: "¿Calcula el IVU de Puerto Rico?",
    a: "Sí, el 11.5% se calcula solo en cada venta y en tus reportes.",
  },
  {
    q: "¿Sirve para más de un técnico?",
    a: "Sí. El plan Equipo da chat interno, nómina, comisiones y multi-device en tiempo real.",
  },
  {
    q: "¿Mis datos están seguros?",
    a: "Sí. Tu información es tuya, respaldada en la nube, y la puedes exportar.",
  },
  {
    q: "¿En qué teléfonos corre?",
    a: "Hoy en iPhone vía TestFlight. ¿Prefieres empezar desde la computadora? Crea tu taller en la web.",
  },
];

function FaqItem({ q, a, open, onToggle }) {
  return (
    <motion.div variants={fadeUpSm} className="border-b border-ar-line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="ar-focus-ring flex w-full items-center justify-between gap-4 rounded-lg py-6 text-left sm:py-7"
      >
        <span
          className="font-brico font-semibold text-[clamp(17px,2.2vw,20px)] leading-snug"
          style={{ color: "var(--ar-text)" }}
        >
          {q}
        </span>
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="shrink-0"
          style={{ color: open ? "var(--ar-accent)" : "var(--ar-text-2)" }}
        >
          <ChevronDown className="h-5 w-5" strokeWidth={2.2} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="overflow-hidden"
          >
            <p
              className="max-w-[58ch] pb-6 pr-10 text-[clamp(15px,1.8vw,17px)] leading-[1.6] sm:pb-7"
              style={{ color: "var(--ar-text-2)" }}
            >
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQ() {
  const [openSet, setOpenSet] = useState(() => new Set());

  const toggle = (i) =>
    setOpenSet((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <Section narrow id="faq">
      <Eyebrow>· PREGUNTAS</Eyebrow>
      <Heading as="h2" size="h2" className="mt-5">
        Lo que todo el mundo pregunta.
      </Heading>

      <motion.div
        variants={staggerList}
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        className="mt-12 sm:mt-14"
      >
        {FAQS.map((item, i) => (
          <FaqItem
            key={i}
            q={item.q}
            a={item.a}
            open={openSet.has(i)}
            onToggle={() => toggle(i)}
          />
        ))}
      </motion.div>
    </Section>
  );
}
