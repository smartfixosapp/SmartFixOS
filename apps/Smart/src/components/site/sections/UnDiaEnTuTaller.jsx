import React, { useRef } from "react";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { Section, Eyebrow, Heading, cx } from "../primitives";
import { PhoneMock } from "../PhoneMock";
import { EASE, DUR, VIEWPORT } from "../motion";
import s12 from "../../../assets/images/screenshots/12-orden-detail.png";
import s13 from "../../../assets/images/screenshots/13-notificar-cliente.png";
import s06 from "../../../assets/images/screenshots/06-ordenes-list.png";
import s03 from "../../../assets/images/screenshots/03-inicio.png";
import s07 from "../../../assets/images/screenshots/07-pos-catalogo.png";
import s04 from "../../../assets/images/screenshots/04-finanzas-dashboard.png";

const STEPS = [
  {
    hora: "9:20 AM",
    titulo: "Entra un iPhone 12",
    copy: "Pantalla rota. Le haces el ticket en 30 segundos, le tiras fotos y el cliente ya recibió un email: «recibimos tu equipo».",
    modulos: ["Órdenes"],
    shot: s12,
    alt: "Detalle de una orden en Archilla OS",
  },
  {
    hora: "9:35 AM",
    titulo: "Diagnóstico",
    copy: "Lo abres, confirmas la falla. Subes la evidencia. El presupuesto le llega al cliente para que apruebe desde su teléfono.",
    modulos: ["Órdenes", "Portal cliente"],
    shot: s13,
    alt: "Notificar al cliente desde Archilla OS",
  },
  {
    hora: "11:00 AM",
    titulo: "A reparar",
    copy: "Pieza descontada del inventario sola. El técnico asignado, el reloj corriendo, la promesa de entrega clara.",
    modulos: ["Reparación", "Inventario"],
    shot: s06,
    alt: "Lista de órdenes en Archilla OS",
  },
  {
    hora: "2:15 PM",
    titulo: "Listo",
    copy: "Cambias el estado a «Listo» y el cliente recibe el aviso automático. Tú sigues con la próxima, sin llamar a nadie.",
    modulos: ["Notificaciones"],
    shot: s03,
    alt: "Pantalla de inicio de Archilla OS",
  },
  {
    hora: "4:40 PM",
    titulo: "Cobras",
    copy: "Carrito, IVU 11.5% calculado solo, cobras, das garantía. La caja se mueve en el mismo segundo.",
    modulos: ["POS", "Caja"],
    shot: s07,
    alt: "Catálogo del punto de venta en Archilla OS",
  },
  {
    hora: "7:00 PM",
    titulo: "Cierras",
    copy: "Cuadras la caja al peso. Ves cuánto entró, cuánto salió y cuánto te quedó de verdad — restando las piezas.",
    modulos: ["Finanzas", "Cierre"],
    shot: s04,
    alt: "Dashboard de finanzas en Archilla OS",
  },
];

function ModulePill({ children }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px]"
      style={{ borderColor: "var(--ar-border)", color: "var(--ar-text-2)" }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--ar-accent)", boxShadow: "0 0 6px var(--ar-accent)" }}
      />
      {children}
    </span>
  );
}

function Node({ reduce }) {
  return (
    <motion.span
      aria-hidden
      className="relative z-10 block rounded-full"
      style={{ width: 16, height: 16, background: "var(--ar-bg)", border: "2px solid var(--ar-border-strong)" }}
      initial={reduce ? false : { scale: 0.6 }}
      whileInView={{
        scale: 1,
        background: "var(--ar-accent)",
        borderColor: "var(--ar-accent)",
        boxShadow: "0 0 0 5px rgba(255,87,34,0.14), 0 0 16px var(--ar-glow)",
      }}
      viewport={{ once: true, margin: "0px 0px -45% 0px" }}
      transition={{ duration: 0.4, ease: EASE }}
    />
  );
}

function Shot({ src, alt }) {
  return (
    <div className="flex justify-center lg:justify-start">
      <PhoneMock src={src} alt={alt} width={190} glow={false} />
    </div>
  );
}

function Copy({ step }) {
  return (
    <div>
      <h3 className="font-brico text-[clamp(20px,2.4vw,26px)] font-bold tracking-[-0.03em]" style={{ color: "var(--ar-text)" }}>
        {step.titulo}
      </h3>
      <p className="mt-2.5 text-[clamp(15px,1.8vw,17px)] leading-[1.5] text-ar-ink2" style={{ color: "var(--ar-text-2)" }}>
        {step.copy}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {step.modulos.map((m) => (
          <ModulePill key={m}>{m}</ModulePill>
        ))}
      </div>
    </div>
  );
}

function Step({ step, index, reduce }) {
  const flip = index % 2 === 1;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: DUR, ease: EASE }}
      className="relative grid grid-cols-[auto_1fr] gap-x-5 sm:gap-x-7"
    >
      <div className="flex flex-col items-center pt-1.5">
        <span className="mb-3 font-mono text-[12px] tracking-[0.04em] tabular-nums" style={{ color: "var(--ar-text-3)" }}>
          {step.hora}
        </span>
        <Node reduce={reduce} />
      </div>

      <div className="pb-14 sm:pb-20">
        <div className="lg:hidden">
          <Copy step={step} />
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={VIEWPORT}
            transition={{ duration: DUR, ease: EASE, delay: 0.12 }}
            className="mt-6 overflow-hidden rounded-3xl border bg-ar-card ar-shadow-card"
            style={{ borderColor: "var(--ar-border)" }}
          >
            <img src={step.shot} alt={step.alt} loading="lazy" className="block w-full object-cover object-top" style={{ aspectRatio: "9 / 14" }} />
          </motion.div>
        </div>

        <div className={cx("hidden items-center gap-10 lg:grid lg:grid-cols-2", flip && "lg:[direction:rtl]")}>
          <div className="lg:[direction:ltr]">
            <Copy step={step} />
          </div>
          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={VIEWPORT}
            transition={{ duration: DUR, ease: EASE, delay: 0.12 }}
            className="lg:[direction:ltr]"
          >
            <Shot src={step.shot} alt={step.alt} />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

export function UnDiaEnTuTaller() {
  const reduce = useReducedMotion();
  const trackRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start 70%", "end 60%"],
  });
  const scaleY = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <Section id="un-dia" border>
      <div className="mx-auto max-w-[52rem] text-center">
        <Eyebrow align="center">· UN DÍA EN TU TALLER</Eyebrow>
        <Heading as="h2" size="h2" className="mt-5">
          De que entra el equipo a que sale pagado.
        </Heading>
      </div>

      <div ref={trackRef} className="relative mx-auto mt-16 max-w-[60rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute top-1.5 bottom-0 w-px"
          style={{ left: "calc(1.875rem)", background: "var(--ar-border)" }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute top-1.5 bottom-0 w-px origin-top"
          style={{
            left: "calc(1.875rem)",
            background: "linear-gradient(var(--ar-accent), var(--ar-accent))",
            boxShadow: "0 0 10px var(--ar-glow)",
            scaleY: reduce ? 1 : scaleY,
          }}
        />

        <div className="relative">
          {STEPS.map((step, i) => (
            <Step key={step.hora} step={step} index={i} reduce={reduce} />
          ))}
        </div>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: DUR, ease: EASE }}
        className="mx-auto mt-6 max-w-[44rem] text-center"
      >
        <Heading as="h3" size="h3" className="italic">
          Cuánto entró, cuánto salió, cuánto te quedó.
        </Heading>
      </motion.div>
    </Section>
  );
}
