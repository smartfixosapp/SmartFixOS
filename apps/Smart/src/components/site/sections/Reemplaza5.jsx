import React from "react";
import { motion } from "framer-motion";
import { Notebook, Calculator, Sheet, MessageCircle, Wallet } from "lucide-react";
import { Section, Eyebrow, Heading, Lede, GlowBlob, cx, useInViewOnce } from "../primitives";
import { EASE } from "../motion";

const TOOLS = [
  { icon: Notebook, label: "Libreta", rot: -4 },
  { icon: Calculator, label: "Calculadora", rot: 3 },
  { icon: Sheet, label: "Excel", rot: -2.5 },
  { icon: MessageCircle, label: "WhatsApp suelto", rot: 4 },
  { icon: Wallet, label: "Caja manual", rot: -3 },
];

const STAGGER_TOOLS = 0.06;
const lastDelay = (TOOLS.length - 1) * STAGGER_TOOLS;

function ToolChip({ tool, index, on }) {
  const Icon = tool.icon;
  const delay = index * STAGGER_TOOLS;
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, rotate: tool.rot }}
      animate={on ? { opacity: 1, y: 0, rotate: tool.rot } : { opacity: 0, y: 14, rotate: tool.rot }}
      transition={{ duration: 0.45, ease: EASE, delay }}
      whileHover={{ rotate: 0, y: -2 }}
      className="group inline-flex items-center gap-2 rounded-full border px-3.5 py-2"
      style={{ borderColor: "var(--ar-border)", background: "var(--ar-card)" }}
    >
      <Icon className="h-4 w-4 shrink-0 transition-colors group-hover:text-ar-ink2" strokeWidth={1.8} style={{ color: "var(--ar-text-3)" }} />
      <span
        className="font-mono text-[13px] transition-colors group-hover:no-underline group-hover:text-ar-ink2"
        style={{ color: "var(--ar-text-3)", textDecorationLine: "line-through", textDecorationThickness: "1.5px" }}
      >
        {tool.label}
      </span>
    </motion.div>
  );
}

export function Reemplaza5() {
  const [ref, on] = useInViewOnce("-80px");
  const arrowDelay = lastDelay + 0.18;
  const cardDelay = arrowDelay + 0.22;

  return (
    <Section border>
      <Eyebrow>· UNA APP, NO CINCO</Eyebrow>
      <Heading
        as="h2"
        size="h2"
        className="mt-5"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        Bota las cinco cosas que usas sueltas.
      </Heading>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6, ease: EASE, delay: 0.1 }}
      >
        <Lede className="mt-6 max-w-[58ch]">
          Lo que antes vivía en cinco lugares — y nunca cuadraba — ahora vive en uno solo. Cada orden mueve la caja, la caja mueve las finanzas, las finanzas restan las piezas. Sin copiar nada dos veces.
        </Lede>
      </motion.div>

      <div ref={ref} className="relative mt-12">
        <GlowBlob size={420} className="left-1/2 top-1/2" style={{ transform: "translate(-50%,-50%)" }} opacity={0.1} blur={90} />

        <div className="flex flex-col items-stretch gap-6 md:flex-row md:items-center md:justify-center md:gap-8">
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:max-w-[420px] md:grid-cols-3">
            {TOOLS.map((tool, i) => (
              <div key={tool.label} className={cx("flex", i === TOOLS.length - 1 && "col-span-2 md:col-span-1")}>
                <ToolChip tool={tool} index={i} on={on} />
              </div>
            ))}
          </div>

          <div className="flex shrink-0 items-center justify-center" aria-hidden>
            <motion.svg
              width="44"
              height="44"
              viewBox="0 0 44 44"
              fill="none"
              className="rotate-90 md:rotate-0"
            >
              <motion.path
                d="M6 22 H32"
                stroke="var(--ar-accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={on ? { pathLength: 1 } : { pathLength: 0 }}
                transition={{ duration: 0.4, ease: EASE, delay: arrowDelay }}
              />
              <motion.path
                d="M26 15 L34 22 L26 29"
                stroke="var(--ar-accent)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={on ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                transition={{ duration: 0.28, ease: EASE, delay: arrowDelay + 0.22 }}
              />
            </motion.svg>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={on ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.6, ease: EASE, delay: cardDelay }}
            className="ar-shadow-lift-accent inline-flex shrink-0 items-center gap-3.5 self-center rounded-2xl border px-5 py-4"
            style={{ borderColor: "var(--ar-border-strong)", background: "var(--ar-card)", boxShadow: "0 0 0 1px var(--ar-border-accent), 0 24px 60px -34px var(--ar-glow)" }}
          >
            <img src="/images/logo.png" alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
            <div className="flex flex-col">
              <span className="font-brico text-[17px] font-bold tracking-[-0.03em]" style={{ color: "var(--ar-text)" }}>
                Archilla OS
              </span>
              <span className="text-[13px]" style={{ color: "var(--ar-text-2)" }}>
                Todo en uno, conectado.
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}
