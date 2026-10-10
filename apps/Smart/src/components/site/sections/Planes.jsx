import React, { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Minus, Plus, Store, X } from "lucide-react";
import { Section, Eyebrow, Heading, Lede, GlowBlob, cx } from "../primitives";
import { EASE, VIEWPORT, fadeUp, staggerList } from "../motion";
import { REGISTRO_PATH } from "../constants";

const SOLO_BASE = 20;
const SOLO_EXTRA_TECH = 5;
const SOLO_MAX_TECH = 5;
const COMPLETO_PRICE = 49;
const COMPLETO_USERS = 5;
const COMPLETO_MULTITIENDA_LISTA = false;

const soloPrice = (techs) => SOLO_BASE + SOLO_EXTRA_TECH * (techs - 1);

const SOLO_INCLUYE = [
  "Boletos con estados, fotos y notas",
  "Clientes con su historial",
  "Piezas por boleto (nombre y cantidad)",
  "Chat interno y ponche del equipo",
];
const SOLO_NO_INCLUYE = ["POS y cobros", "Inventario", "Finanzas e IVU"];

const COMPLETO_INCLUYE = [
  "Todo lo de Solo boletos",
  "Órdenes con cobros y POS",
  "Finanzas y reportes · IVU 11.5%",
  "Inventario y compras",
  "Portal del cliente",
  "Nómina y comisiones",
  "Multi-device en tiempo real",
];

function Pill({ children }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
      style={{ borderColor: "var(--ar-border-strong)", color: "var(--ar-text-2)" }}
    >
      {children}
    </span>
  );
}

function TechStepper({ value, onChange }) {
  return (
    <div
      className="mt-6 flex items-center justify-between rounded-2xl border px-4 py-3"
      style={{ borderColor: "var(--ar-border)", background: "var(--ar-bg-elev)" }}
    >
      <div className="flex flex-col leading-tight">
        <span className="text-[14px] font-semibold" style={{ color: "var(--ar-text)" }}>
          Técnicos
        </span>
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ar-ink3">
          +${SOLO_EXTRA_TECH}/mes cada extra
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label="Quitar un técnico"
          disabled={value <= 1}
          onClick={() => onChange(value - 1)}
          className="ar-focus-ring flex h-9 w-9 items-center justify-center rounded-full border transition-opacity disabled:opacity-30"
          style={{ borderColor: "var(--ar-border-strong)", color: "var(--ar-text)" }}
        >
          <Minus className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <span
          aria-live="polite"
          className="w-6 text-center font-brico text-[22px] font-bold tabular-nums"
          style={{ color: "var(--ar-text)" }}
        >
          {value}
        </span>
        <button
          type="button"
          aria-label="Agregar un técnico"
          disabled={value >= SOLO_MAX_TECH}
          onClick={() => onChange(value + 1)}
          className="ar-focus-ring flex h-9 w-9 items-center justify-center rounded-full border transition-opacity disabled:opacity-30"
          style={{ borderColor: "var(--ar-border-strong)", color: "var(--ar-text)" }}
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function UsersRow() {
  return (
    <div
      className="mt-6 flex items-center justify-between rounded-2xl border px-4 py-3"
      style={{ borderColor: "var(--ar-border-accent)", background: "rgba(255,87,34,0.06)" }}
    >
      <div className="flex flex-col leading-tight">
        <span className="text-[14px] font-semibold" style={{ color: "var(--ar-text)" }}>
          Usuarios incluidos
        </span>
        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-ar-ink3">
          Sin costo por usuario
        </span>
      </div>
      <span className="font-brico text-[22px] font-bold tabular-nums" style={{ color: "var(--ar-accent)" }}>
        {COMPLETO_USERS}
      </span>
    </div>
  );
}

function MultitiendaRow({ lista = true }) {
  return (
    <li className="flex items-start gap-2.5 text-[14px] leading-[1.4]" style={{ color: "var(--ar-text)" }}>
      <Store className="mt-[1px] h-4 w-4 shrink-0" strokeWidth={2.4} style={{ color: "var(--ar-accent)" }} />
      <span className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Multitienda incluida</span>
          {!lista && <Pill>Próximamente</Pill>}
        </span>
        <span className="text-[13px] text-ar-ink2">Mueves boletos entre tiendas y las ves todas juntas</span>
      </span>
    </li>
  );
}

function PlanCard({ nombre, para, featured, price, priceSuffix, control, multitiendaLista, incluye, noIncluye, cta }) {
  return (
    <motion.article
      variants={fadeUp}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.28, ease: EASE }}
      className={cx(
        "relative flex flex-col rounded-3xl border bg-ar-card p-7 ar-shadow-card sm:p-8",
        featured ? "hover:ar-shadow-lift-accent" : "hover:ar-shadow-card"
      )}
      style={{ borderColor: featured ? "var(--ar-border-accent)" : "var(--ar-border)" }}
    >
      {featured && (
        <span
          className="absolute -top-3 left-7 inline-flex items-center rounded-full px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white ar-grad"
          style={{ boxShadow: "0 8px 20px -10px var(--ar-glow)" }}
        >
          Todo incluido
        </span>
      )}

      <h3 className="font-brico text-2xl font-bold tracking-[-0.02em]" style={{ color: "var(--ar-text)" }}>
        {nombre}
      </h3>
      <p className="mt-2 min-h-[44px] text-[15px] leading-[1.45] text-ar-ink2">{para}</p>

      <div className="mt-6 flex items-end gap-3">
        <motion.span
          key={price}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="font-brico text-[52px] font-extrabold leading-none tracking-[-0.03em] tabular-nums"
          style={{ color: "var(--ar-text)" }}
        >
          ${price}
        </motion.span>
        <span className="flex flex-col pb-1 leading-tight">
          <span className="font-brico text-[20px] font-bold" style={{ color: "var(--ar-text-2)" }}>
            /mes
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ar-ink3">{priceSuffix}</span>
        </span>
      </div>

      {control}

      <ul className="mt-7 flex flex-col gap-3">
        <MultitiendaRow lista={multitiendaLista} />
        {incluye.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14px] leading-[1.4]" style={{ color: "var(--ar-text)" }}>
            <Check className="mt-[1px] h-4 w-4 shrink-0" strokeWidth={2.6} style={{ color: "var(--ar-accent)" }} />
            <span>{f}</span>
          </li>
        ))}
        {noIncluye.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14px] leading-[1.4] text-ar-ink3">
            <X className="mt-[1px] h-4 w-4 shrink-0" strokeWidth={2.4} />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <Link
          to={REGISTRO_PATH}
          className={cx(
            "ar-focus-ring inline-flex h-14 w-full items-center justify-center rounded-2xl px-7 text-[15px] font-semibold",
            featured ? "ar-grad ar-shadow-btn text-white" : "border"
          )}
          style={featured ? undefined : { borderColor: "var(--ar-border-strong)", color: "var(--ar-text)" }}
        >
          {cta}
        </Link>
      </div>
    </motion.article>
  );
}

export function Planes() {
  const [techs, setTechs] = useState(1);
  const price = soloPrice(techs);
  const soloMax = soloPrice(SOLO_MAX_TECH);

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
          <Heading as="h2" className="mt-5 max-w-[20ch]">
            Un plan para cada taller.
          </Heading>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Lede className="mt-5 max-w-[58ch]">
            14 días gratis, sin tarjeta. Los dos planes incluyen multitienda y puedes cambiar cuando quieras.
          </Lede>
        </motion.div>
      </motion.div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="mx-auto mt-12 grid max-w-4xl grid-cols-1 items-stretch gap-6 md:grid-cols-2"
      >
        <PlanCard
          nombre="Solo boletos"
          para="Para talleres que solo necesitan llevar sus boletos, en una tienda o en varias."
          price={price}
          priceSuffix={techs === 1 ? "1 técnico" : `${techs} técnicos`}
          control={<TechStepper value={techs} onChange={setTechs} />}
          multitiendaLista
          incluye={SOLO_INCLUYE}
          noIncluye={SOLO_NO_INCLUYE}
          cta="Empezar gratis"
        />
        <PlanCard
          nombre="Completo"
          featured
          para="Todo tu taller en una app: boletos, caja, finanzas, inventario y tu equipo."
          price={COMPLETO_PRICE}
          priceSuffix={`hasta ${COMPLETO_USERS} usuarios`}
          control={<UsersRow />}
          multitiendaLista={COMPLETO_MULTITIENDA_LISTA}
          incluye={COMPLETO_INCLUYE}
          noIncluye={[]}
          cta="Empezar gratis"
        />
      </motion.div>

      <motion.p
        variants={fadeUp}
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        className="mx-auto mt-8 max-w-3xl text-center font-mono text-[12px] leading-[1.6] text-ar-ink3"
      >
        Con {SOLO_MAX_TECH} técnicos, Solo boletos queda en ${soloMax}/mes. Completo (${COMPLETO_PRICE}) suma POS, cobros,
        inventario y finanzas. 14 días gratis, sin tarjeta. Cancela cuando quieras.
      </motion.p>
    </Section>
  );
}
