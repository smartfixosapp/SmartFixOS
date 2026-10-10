import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeftRight, Layers, Store } from "lucide-react";
import { Section, Eyebrow, Heading, Lede, GlowBlob } from "../primitives";
import { VIEWPORT, fadeUp, staggerList } from "../motion";

const PUNTOS = [
  {
    icon: Store,
    titulo: "Eliges tu tienda",
    texto: "Al abrir la app decides a cuál entras. Cada empleado entra directo a la suya.",
  },
  {
    icon: Layers,
    titulo: "O las ves todas juntas",
    texto: "Los boletos de todas tus tiendas en una sola lista, ordenados por estado.",
  },
  {
    icon: ArrowLeftRight,
    titulo: "Mueves boletos",
    texto: "Pasas un boleto de una tienda a otra con un toque, sin volver a escribir nada.",
  },
];

const DESCRIPCION =
  "Demostración de la multitienda de Archilla OS: elegir una tienda, ver los boletos de todas juntas y mover un boleto de una tienda a otra.";

export function Multitienda() {
  const reduce = useReducedMotion();

  return (
    <Section id="multitienda" className="relative overflow-hidden">
      <GlowBlob size={520} className="right-0 top-1/3" style={{ transform: "translate(30%,-30%)" }} opacity={0.08} blur={110} />

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="flex flex-col items-start"
      >
        <motion.div variants={fadeUp}>
          <Eyebrow>· MULTITIENDA</Eyebrow>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Heading as="h2" className="mt-5 max-w-[22ch]">
            Más de una tienda, un solo lugar.
          </Heading>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Lede className="mt-5 max-w-[58ch]">
            Lleva todas tus sucursales desde la misma cuenta. Incluida en los dos planes.
          </Lede>
        </motion.div>
      </motion.div>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        className="ar-shadow-lift mt-12 overflow-hidden rounded-3xl border"
        style={{ borderColor: "var(--ar-border)", background: "#0a0a0a" }}
      >
        {reduce ? (
          <img src="/video/multitienda-poster.jpg" alt={DESCRIPCION} className="block w-full" />
        ) : (
          <video
            className="block w-full"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/video/multitienda-poster.jpg"
            aria-label={DESCRIPCION}
          >
            <source src="/video/multitienda.mp4" type="video/mp4" />
          </video>
        )}
      </motion.div>

      <motion.ul
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3"
      >
        {PUNTOS.map(({ icon: Icon, titulo, texto }) => (
          <motion.li key={titulo} variants={fadeUp} className="flex flex-col gap-3">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-xl border"
              style={{ borderColor: "var(--ar-border-accent)", background: "rgba(255,87,34,0.08)" }}
            >
              <Icon className="h-5 w-5" strokeWidth={2.2} style={{ color: "var(--ar-accent)" }} />
            </span>
            <h3 className="font-brico text-[19px] font-bold tracking-[-0.02em]" style={{ color: "var(--ar-text)" }}>
              {titulo}
            </h3>
            <p className="max-w-[40ch] text-[15px] leading-[1.5] text-ar-ink2">{texto}</p>
          </motion.li>
        ))}
      </motion.ul>
    </Section>
  );
}
