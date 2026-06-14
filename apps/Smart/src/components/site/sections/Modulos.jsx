import React from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  ShoppingCart,
  LineChart,
  PackageSearch,
  Users,
  UserCheck,
} from "lucide-react";
import { Section, Eyebrow, Heading, Lede, Chip, GlowBlob, cx } from "../primitives";
import { EASE, VIEWPORT, fadeUp, fadeUpSm, staggerList } from "../motion";

import s06 from "../../../assets/images/screenshots/06-ordenes-list.png";
import s07 from "../../../assets/images/screenshots/07-pos-catalogo.png";
import s04 from "../../../assets/images/screenshots/04-finanzas-dashboard.png";
import s18 from "../../../assets/images/screenshots/18-compras-paso2-productos.png";
import s14 from "../../../assets/images/screenshots/14-smart-search.png";
import s13 from "../../../assets/images/screenshots/13-notificar-cliente.png";

const MODULES = [
  {
    icon: ClipboardList,
    title: "Órdenes de trabajo",
    benefit: "Del mostrador a entregado, sin perder una.",
    features: ["Ticket en 30s", "Fotos por estado", "Garantías", "Aviso automático al cliente"],
    shot: s06,
    shotAlt: "Lista de órdenes en Archilla OS",
    featured: true,
  },
  {
    icon: ShoppingCart,
    title: "POS + Caja registradora",
    benefit: "Cobra rápido y cuadra al peso.",
    features: ["Carrito y cobro", "Turnos y comisiones", "Cierre de caja"],
    shot: s07,
    shotAlt: "Catálogo del punto de venta",
  },
  {
    icon: LineChart,
    title: "Finanzas",
    benefit: "Cuánto te quedó de verdad.",
    features: [
      "Ingresos, gastos, utilidad neta",
      "Resta las piezas",
      "IVU 11.5% PR automático",
      "Reportes diarios y mensuales",
    ],
    shot: s04,
    shotAlt: "Dashboard de finanzas",
  },
  {
    icon: PackageSearch,
    title: "Compras + Inventario",
    benefit: "El inventario se cuida solo.",
    features: ["Órdenes de compra a suplidores", "Se ajusta al vender o recibir", "Suplidores integrados"],
    shot: s18,
    shotAlt: "Orden de compra con productos",
  },
  {
    icon: Users,
    title: "Equipo",
    benefit: "Todos en la misma página, en tiempo real.",
    features: ["Chat interno", "Empleados y nómina", "Multi-device al instante"],
    shot: s14,
    shotAlt: "Búsqueda global Smart Search",
  },
  {
    icon: UserCheck,
    title: "Portal del cliente",
    benefit: "Tu cliente aprueba y sigue su equipo solo.",
    features: ["Aprobación de presupuesto", "Seguimiento del estado", "Magic link, sin apps"],
    shot: s13,
    shotAlt: "Notificación al cliente",
  },
];

const BANDA = [
  "Login por magic link",
  "Smart Search global",
  "Plan financiero con mínimo diario",
  "Excedente para invertir",
];

function ModuleCard({ icon: Icon, title, benefit, features, shot, shotAlt, featured = false }) {
  return (
    <motion.article
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.28, ease: EASE }}
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-3xl border bg-ar-card ar-shadow-card",
        "hover:ar-shadow-lift-accent",
        featured && "lg:col-span-2"
      )}
      style={{
        borderColor: featured ? "var(--ar-border-accent)" : "var(--ar-border)",
      }}
    >
      <div className="flex flex-col gap-4 p-6 sm:p-7">
        <span
          className="ar-grad inline-flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{ boxShadow: "0 8px 20px -10px var(--ar-glow)" }}
        >
          <Icon className="h-5 w-5 text-white" strokeWidth={2} />
        </span>

        <div>
          <h3 className="font-brico text-xl font-bold tracking-[-0.02em]" style={{ color: "var(--ar-text)" }}>
            {title}
          </h3>
          <p className="mt-1.5 text-[15px] leading-[1.45] text-ar-ink2">{benefit}</p>
        </div>

        <ul className="flex flex-col gap-1.5">
          {features.map((f) => (
            <li key={f} className="flex items-start gap-2 font-mono text-[12px] leading-[1.4] text-ar-ink3">
              <span
                aria-hidden
                className="mt-[5px] h-1 w-1 shrink-0 rounded-full"
                style={{ background: "var(--ar-accent)" }}
              />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mt-auto px-6 sm:px-7">
        <motion.div
          initial={{ y: 0 }}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.45, ease: EASE }}
          className={cx(
            "overflow-hidden rounded-2xl border bg-ar-elev",
            featured ? "h-44 sm:h-52" : "h-36 sm:h-40"
          )}
          style={{ borderColor: "var(--ar-border)" }}
        >
          <img
            src={shot}
            alt={shotAlt}
            loading="lazy"
            className="block w-full object-cover object-top"
            style={{ height: "calc(100% + 24px)" }}
          />
        </motion.div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 bottom-0 h-12 sm:inset-x-7"
          style={{ background: "linear-gradient(to top, var(--ar-card), transparent)" }}
        />
      </div>
    </motion.article>
  );
}

export function Modulos() {
  return (
    <Section id="modulos" className="relative overflow-hidden">
      <GlowBlob size={620} className="left-1/2 top-0" style={{ transform: "translate(-50%,-40%)" }} opacity={0.1} blur={100} />

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="flex flex-col items-start"
      >
        <motion.div variants={fadeUp}>
          <Eyebrow>· TODO LO QUE HACE</Eyebrow>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Heading as="h2" className="mt-5 max-w-[20ch]">
            No es una libreta digital. Es el sistema operativo de tu taller.
          </Heading>
        </motion.div>

        <motion.div variants={fadeUp}>
          <Lede className="mt-5 max-w-[58ch]">
            Seis módulos que trabajan juntos. Esto no es vaporware — está construido y corriendo.
          </Lede>
        </motion.div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        {MODULES.map((m) => (
          <ModuleCard key={m.title} {...m} />
        ))}
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        transition={{ delayChildren: 0.15 }}
        className="mt-10 flex flex-wrap items-center gap-2.5"
      >
        {BANDA.map((b) => (
          <motion.div key={b} variants={fadeUpSm}>
            <Chip>{b}</Chip>
          </motion.div>
        ))}
      </motion.div>
    </Section>
  );
}
