import React from "react";
import { motion } from "framer-motion";
import {
  Section,
  Eyebrow,
  Heading,
  useCountUp,
  useInViewOnce,
} from "../primitives";
import { VIEWPORT, fadeUp, staggerList } from "../motion";

const STATS = [
  { value: 1, suffix: "", label: "taller real corriéndolo todos los días" },
  { value: 11.5, suffix: "%", decimals: 1, label: "IVU calculado al peso" },
  { value: 30, suffix: "s", label: "para hacer una orden" },
  { value: 100, suffix: "%", label: "en español, hecho en Puerto Rico" },
];

function StatBlock({ value, suffix, decimals = 0, label }) {
  const [ref, seen] = useInViewOnce();
  const count = useCountUp(value, seen, 1100);
  const shown = decimals > 0 ? count.toFixed(decimals) : Math.round(count);

  return (
    <motion.div
      ref={ref}
      variants={fadeUp}
      className="flex flex-col items-center rounded-3xl border bg-ar-card px-5 py-7 text-center ar-shadow-card"
      style={{ borderColor: "var(--ar-border)" }}
    >
      <span className="font-brico text-[clamp(40px,7vw,64px)] font-extrabold leading-none tracking-[-0.04em] tabular-nums" style={{ color: "var(--ar-text)" }}>
        {shown}
        <span style={{ color: "var(--ar-accent)" }}>{suffix}</span>
      </span>
      <span className="mt-3 max-w-[20ch] font-mono text-[12px] leading-[1.4] text-ar-ink2">
        {label}
      </span>
    </motion.div>
  );
}

export function PruebaSocial() {
  return (
    <Section id="prueba-social" className="relative overflow-hidden">
      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="flex flex-col items-start"
      >
        <motion.div variants={fadeUp}>
          <Eyebrow>· QUIÉN LO USA</Eyebrow>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Heading as="h2" className="mt-5 max-w-[22ch]">
            Hecho en el mostrador, no en una oficina.
          </Heading>
        </motion.div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="mt-12 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4"
      >
        {STATS.map((s) => (
          <StatBlock key={s.label} {...s} />
        ))}
      </motion.div>
    </Section>
  );
}
