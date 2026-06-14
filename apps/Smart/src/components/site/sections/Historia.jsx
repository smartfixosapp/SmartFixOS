import React from "react";
import { motion } from "framer-motion";
import { Section, Eyebrow, Heading, Lede, GlowBlob, useInViewOnce } from "../primitives";
import { EASE } from "../motion";

const para = (delay) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: EASE, delay },
});

export function Historia() {
  const [ref, on] = useInViewOnce("-80px");

  return (
    <Section narrow id="historia" border>
      <div ref={ref} className="relative">
        <GlowBlob
          size={520}
          color="var(--ar-glow)"
          className="left-1/2 top-0"
          style={{ transform: "translate(-50%,-34%)" }}
          opacity={0.14}
          blur={100}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.86 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative inline-flex"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
            style={{ background: "var(--ar-glow)", filter: "blur(26px)", opacity: 0.55 }}
          />
          <img
            src="/images/logo.png"
            alt=""
            className="rounded-2xl"
            style={{ width: 46, height: 46, objectFit: "contain" }}
          />
        </motion.div>

        <Eyebrow className="mt-7">· DE TÉCNICO A CREADOR</Eyebrow>

        <Heading
          as="h2"
          size="h2"
          className="mt-5"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          De técnico a{" "}
          <em className="font-brico" style={{ fontStyle: "italic", color: "var(--ar-accent)" }}>
            creador.
          </em>
        </Heading>

        <div className="mt-8 flex max-w-[60ch] flex-col gap-6">
          <motion.div {...para(0.05)}>
            <Lede>
              Soy Francis. Llevo años con las manos metidas en pantallas rotas, placas quemadas y baterías hinchadas en mi taller, 911 Smart Fix. Conozco el reguero: la libreta, el Excel que no cuadra, los clientes preguntando «¿ya está?» a las 9 de la noche.
            </Lede>
          </motion.div>

          <motion.p
            {...para(0.14)}
            className="text-[clamp(15px,1.7vw,17px)] leading-[1.7]"
            style={{ color: "var(--ar-text-2)" }}
          >
            Busqué un sistema que entendiera{" "}
            <em style={{ fontStyle: "italic" }}>mi</em> taller y no lo encontré. Los que había eran de afuera, en inglés, caros y hechos por gente que nunca ha cambiado una pantalla. Así que lo construí yo.
          </motion.p>

          <motion.p
            {...para(0.23)}
            className="text-[clamp(15px,1.7vw,17px)] leading-[1.7]"
            style={{ color: "var(--ar-text-2)" }}
          >
            Archilla OS es el taller que yo quería tener: rápido, honesto y que te dice la verdad de cuánto te quedó.{" "}
            <span className="relative inline-block font-bold" style={{ color: "var(--ar-text)" }}>
              Esto no es vaporware
              <motion.span
                aria-hidden
                className="absolute -bottom-0.5 left-0 h-[2px] w-full origin-left rounded-full"
                style={{ background: "var(--ar-accent)" }}
                initial={{ scaleX: 0 }}
                animate={on ? { scaleX: 1 } : { scaleX: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: 0.6 }}
              />
            </span>{" "}
            — corre todos los días en mi mostrador.
          </motion.p>
        </div>

        <motion.div
          {...para(0.34)}
          className="mt-9 font-mono text-[13px]"
          style={{ color: "var(--ar-text-3)" }}
        >
          — Francis · 911 Smart Fix · San Juan, PR
        </motion.div>
      </div>
    </Section>
  );
}
