import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import {
  Section,
  Eyebrow,
  Heading,
  Lede,
  GlowBlob,
  useCountUp,
  useInViewOnce,
  cx,
} from "../primitives";
import { EASE, VIEWPORT, fadeUp, staggerList } from "../motion";
import { REGISTRO_PATH } from "../constants";

const PLANES = [
  {
    nombre: "Solo",
    para: "Un técnico, un mostrador.",
    precio: 19,
    features: [
      "Órdenes",
      "POS",
      "Finanzas",
      "IVU 11.5%",
      "Inventario",
      "Portal del cliente",
      "1 usuario",
    ],
    featured: false,
  },
  {
    nombre: "Equipo",
    para: "Tú y tu equipo.",
    precio: 49,
    features: [
      "Todo lo de Solo",
      "Hasta 5 usuarios",
      "Chat interno",
      "Nómina y comisiones",
      "Multi-device en tiempo real",
    ],
    featured: true,
  },
];

function BetaBadge() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.14em]"
      style={{
        borderColor: "rgba(62,197,177,0.4)",
        color: "var(--ar-ok)",
        background: "rgba(62,197,177,0.08)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ar-ok)", boxShadow: "0 0 8px var(--ar-ok)" }} />
      Gratis en beta
    </span>
  );
}

function PlanCard({ nombre, para, precio, features, featured }) {
  const [ref, seen] = useInViewOnce();
  const count = useCountUp(precio, seen, 900);

  return (
    <motion.article
      ref={ref}
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.28, ease: EASE }}
      className={cx(
        "relative flex flex-col rounded-3xl border bg-ar-card p-7 ar-shadow-card sm:p-8",
        featured ? "hover:ar-shadow-lift-accent" : "hover:ar-shadow-card"
      )}
      style={{
        borderColor: featured ? "var(--ar-border-accent)" : "var(--ar-border)",
        transform: featured ? "scale(1.015)" : undefined,
      }}
    >
      {featured && (
        <span
          className="absolute -top-3 left-7 inline-flex items-center rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white ar-grad"
          style={{ boxShadow: "0 8px 20px -10px var(--ar-glow)" }}
        >
          Más popular
        </span>
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="font-brico text-2xl font-bold tracking-[-0.02em]" style={{ color: "var(--ar-text)" }}>
          {nombre}
        </h3>
        <BetaBadge />
      </div>

      <p className="mt-2 text-[15px] leading-[1.45] text-ar-ink2">{para}</p>

      <div className="mt-6 flex items-end gap-3">
        <span className="font-brico text-[44px] font-extrabold leading-none tracking-[-0.03em]" style={{ color: "var(--ar-text)" }}>
          Gratis
        </span>
        <span className="flex flex-col leading-tight pb-1">
          <span className="font-brico text-[20px] font-bold tabular-nums line-through" style={{ color: "var(--ar-text-3)" }}>
            ${Math.round(count)}/mes
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ar-ink3">precio futuro</span>
        </span>
      </div>

      <ul className="mt-7 flex flex-col gap-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14px] leading-[1.4]" style={{ color: "var(--ar-text)" }}>
            <Check className="mt-[1px] h-4 w-4 shrink-0" strokeWidth={2.6} style={{ color: "var(--ar-accent)" }} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <Link
        to={REGISTRO_PATH}
        className="ar-grad ar-shadow-btn ar-focus-ring mt-8 inline-flex h-14 w-full items-center justify-center rounded-2xl px-7 text-[15px] font-semibold text-white"
      >
        Empezar gratis
      </Link>
    </motion.article>
  );
}

export function Planes() {
  return (
    <Section id="planes" className="relative overflow-hidden">
      <GlowBlob size={560} className="left-1/2 top-0" style={{ transform: "translate(-50%,-30%)" }} opacity={0.1} blur={100} />

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="flex flex-col items-start"
      >
        <motion.div variants={fadeUp}>
          <Eyebrow>· PLANES</Eyebrow>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Heading as="h2" className="mt-5 max-w-[18ch]">
            Gratis durante la beta. Punto.
          </Heading>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Lede className="mt-5 max-w-[56ch]">
            Mientras estamos en beta, todo es gratis y sin tarjeta. Cuando salgamos del App Store, estos serán los precios.
          </Lede>
        </motion.div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="mx-auto mt-12 grid max-w-3xl grid-cols-1 items-start gap-6 md:grid-cols-2"
      >
        {PLANES.map((p) => (
          <PlanCard key={p.nombre} {...p} />
        ))}
      </motion.div>

      <motion.p
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        className="mx-auto mt-8 max-w-3xl text-center font-mono text-[12px] leading-[1.6] text-ar-ink3"
      >
        Durante la beta no se cobra y no pedimos tarjeta. El alta, el pago y la suscripción se manejan desde la web — nunca dentro del app. Los precios aplican solo al salir del App Store oficial.
      </motion.p>
    </Section>
  );
}
