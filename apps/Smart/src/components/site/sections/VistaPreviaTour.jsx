import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Section, Eyebrow, Heading, Lede, GlowBlob } from "../primitives";
import { PhoneMock } from "../PhoneMock";
import { EASE, VIEWPORT, fadeUpSm, scaleIn, staggerList } from "../motion";

import s00 from "../../../assets/images/screenshots/00-welcome.png";
import s01 from "../../../assets/images/screenshots/01-bienvenido.png";
import s02 from "../../../assets/images/screenshots/02-ordenes-empty.png";
import s03 from "../../../assets/images/screenshots/03-inicio.png";
import s04 from "../../../assets/images/screenshots/04-finanzas-dashboard.png";
import s05 from "../../../assets/images/screenshots/05-reporte-mensual.png";
import s06 from "../../../assets/images/screenshots/06-ordenes-list.png";
import s07 from "../../../assets/images/screenshots/07-pos-catalogo.png";
import s08 from "../../../assets/images/screenshots/08-pos-cart.png";
import s09 from "../../../assets/images/screenshots/09-ajustes.png";
import s10 from "../../../assets/images/screenshots/10-info-negocio.png";
import s11 from "../../../assets/images/screenshots/11-ivu-config.png";
import s12 from "../../../assets/images/screenshots/12-orden-detail.png";
import s13 from "../../../assets/images/screenshots/13-notificar-cliente.png";
import s14 from "../../../assets/images/screenshots/14-smart-search.png";
import s15 from "../../../assets/images/screenshots/15-compras-empty.png";
import s16 from "../../../assets/images/screenshots/16-compras-paso1-suplidor.png";
import s17 from "../../../assets/images/screenshots/17-compras-suplidor-selected.png";
import s18 from "../../../assets/images/screenshots/18-compras-paso2-productos.png";
import s19 from "../../../assets/images/screenshots/19-compras-paso2-add-producto.png";

const DUR_FADE = 0.3;

const HERO = [
  { src: s00, caption: "Bienvenida", tilt: -3 },
  { src: s07, caption: "Punto de venta", tilt: 0 },
  { src: s04, caption: "Finanzas", tilt: 3 },
];

const GRUPOS = [
  {
    titulo: "Órdenes",
    shots: [
      { src: s02, caption: "Sin órdenes aún", alt: "Pantalla de órdenes vacía en Archilla OS" },
      { src: s06, caption: "Lista de órdenes", alt: "Lista de órdenes en Archilla OS" },
      { src: s12, caption: "Detalle de la orden", alt: "Detalle de una orden en Archilla OS" },
      { src: s13, caption: "Avisar al cliente", alt: "Notificar al cliente desde Archilla OS" },
    ],
  },
  {
    titulo: "Punto de venta",
    shots: [
      { src: s07, caption: "Catálogo", alt: "Catálogo del punto de venta en Archilla OS" },
      { src: s08, caption: "Carrito y total", alt: "Carrito del punto de venta en Archilla OS" },
      { src: s14, caption: "Smart Search", alt: "Búsqueda global Smart Search en Archilla OS" },
    ],
  },
  {
    titulo: "Finanzas e IVU",
    shots: [
      { src: s04, caption: "Resumen del día", alt: "Dashboard de finanzas en Archilla OS" },
      { src: s05, caption: "Reporte mensual", alt: "Reporte mensual en Archilla OS" },
      { src: s11, caption: "IVU 11.5%", alt: "Configuración de IVU en Archilla OS" },
    ],
  },
  {
    titulo: "Compras e inventario",
    shots: [
      { src: s15, caption: "Sin compras aún", alt: "Pantalla de compras vacía en Archilla OS" },
      { src: s16, caption: "Elegir suplidor", alt: "Paso 1, elegir suplidor en Archilla OS" },
      { src: s17, caption: "Suplidor listo", alt: "Suplidor seleccionado en Archilla OS" },
      { src: s18, caption: "Productos de la orden", alt: "Paso 2, productos de la orden de compra en Archilla OS" },
      { src: s19, caption: "Añadir producto", alt: "Añadir producto a la orden de compra en Archilla OS" },
    ],
  },
  {
    titulo: "Setup y ajustes",
    shots: [
      { src: s00, caption: "Bienvenida", alt: "Pantalla de bienvenida en Archilla OS" },
      { src: s01, caption: "Crea tu taller", alt: "Pantalla de bienvenida inicial en Archilla OS" },
      { src: s10, caption: "Info del negocio", alt: "Información del negocio en Archilla OS" },
      { src: s09, caption: "Ajustes", alt: "Pantalla de ajustes en Archilla OS" },
      { src: s03, caption: "Inicio", alt: "Pantalla de inicio en Archilla OS" },
    ],
  },
];

function Highlight({ item }) {
  return (
    <motion.div variants={scaleIn} className="flex flex-col items-center">
      <PhoneMock src={item.src} alt={item.caption} width={236} float glow tilt={item.tilt} />
      <span className="mt-6 font-mono text-[12px] uppercase tracking-[0.16em]" style={{ color: "var(--ar-text-3)" }}>
        {item.caption}
      </span>
    </motion.div>
  );
}

function ShotCard({ shot, onOpen }) {
  return (
    <motion.button
      type="button"
      variants={fadeUpSm}
      onClick={onOpen}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.28, ease: EASE }}
      className="ar-focus-ring group relative w-[200px] shrink-0 snap-start overflow-hidden rounded-3xl border bg-ar-card text-left ar-shadow-card sm:w-[224px]"
      style={{ borderColor: "var(--ar-border)" }}
    >
      <div className="overflow-hidden rounded-t-3xl bg-ar-elev">
        <img
          src={shot.src}
          alt={shot.alt}
          loading="lazy"
          className="block w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
          style={{ aspectRatio: "9 / 16" }}
        />
      </div>
      <span className="block px-4 py-3.5 font-mono text-[12px]" style={{ color: "var(--ar-text-2)" }}>
        {shot.caption}
      </span>
    </motion.button>
  );
}

function Grupo({ grupo, onOpen }) {
  return (
    <div>
      <motion.h3
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.45, ease: EASE }}
        className="font-brico text-[clamp(18px,2.2vw,24px)] font-bold tracking-[-0.03em]"
        style={{ color: "var(--ar-text)" }}
      >
        {grupo.titulo}
      </motion.h3>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="ar-tour-rail -mx-5 mt-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:px-8 xl:-mx-10 xl:px-10"
        style={{ scrollPaddingLeft: "1.25rem", WebkitOverflowScrolling: "touch", scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {grupo.shots.map((shot, i) => (
          <ShotCard key={shot.src} shot={shot} onOpen={() => onOpen(shot, i)} />
        ))}
        <span aria-hidden className="w-1 shrink-0 snap-none" />
      </motion.div>
    </div>
  );
}

function Lightbox({ shots, index, onClose, onPrev, onNext }) {
  const shot = shots[index];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DUR_FADE, ease: EASE }}
      onClick={onClose}
      className="fixed inset-0 z-[120] flex items-center justify-center p-5 sm:p-8"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={shot?.caption}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="ar-focus-ring absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full border sm:right-8 sm:top-8"
        style={{ borderColor: "var(--ar-border)", background: "rgba(20,20,20,0.6)", color: "var(--ar-text)" }}
      >
        <X className="h-5 w-5" strokeWidth={2} />
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        aria-label="Anterior"
        className="ar-focus-ring absolute left-3 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border sm:left-6"
        style={{ borderColor: "var(--ar-border)", background: "rgba(20,20,20,0.6)", color: "var(--ar-text)" }}
      >
        <ChevronLeft className="h-6 w-6" strokeWidth={2} />
      </button>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="Siguiente"
        className="ar-focus-ring absolute right-3 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border sm:right-6"
        style={{ borderColor: "var(--ar-border)", background: "rgba(20,20,20,0.6)", color: "var(--ar-text)" }}
      >
        <ChevronRight className="h-6 w-6" strokeWidth={2} />
      </button>

      <AnimatePresence mode="wait">
        <motion.figure
          key={shot?.src}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: DUR_FADE, ease: EASE }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-full flex-col items-center"
        >
          <img
            src={shot?.src}
            alt={shot?.alt}
            className="block max-h-[78vh] w-auto rounded-3xl ar-shadow-device"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          />
          <figcaption className="mt-4 font-mono text-[12px] uppercase tracking-[0.16em]" style={{ color: "var(--ar-text-2)" }}>
            {shot?.caption}
          </figcaption>
        </motion.figure>
      </AnimatePresence>
    </motion.div>
  );
}

export function VistaPreviaTour() {
  const [box, setBox] = useState(null);

  const openBox = useCallback((grupoIndex, shotIndex) => {
    setBox({ grupoIndex, shotIndex });
  }, []);

  const closeBox = useCallback(() => setBox(null), []);

  const step = useCallback((dir) => {
    setBox((prev) => {
      if (!prev) return prev;
      const shots = GRUPOS[prev.grupoIndex].shots;
      const next = (prev.shotIndex + dir + shots.length) % shots.length;
      return { ...prev, shotIndex: next };
    });
  }, []);

  useEffect(() => {
    if (!box) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeBox();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [box, closeBox, step]);

  const activeShots = box ? GRUPOS[box.grupoIndex].shots : [];

  return (
    <Section id="por-dentro" border className="relative overflow-hidden">
      <GlowBlob size={620} className="left-1/2 top-0" style={{ transform: "translate(-50%,-40%)" }} opacity={0.1} blur={100} />
      <style>{`.ar-tour-rail::-webkit-scrollbar{display:none}`}</style>

      <div className="mx-auto max-w-[52rem] text-center">
        <Eyebrow align="center">· POR DENTRO</Eyebrow>
        <Heading as="h2" size="h2" className="mt-5">
          Míralo por dentro. Está todo aquí.
        </Heading>
        <Lede className="mx-auto mt-5 max-w-[54ch]">
          Capturas reales del día a día, no mockups. La app está construida y corriendo.
        </Lede>
      </div>

      <motion.div
        initial="hidden"
        whileInView="show"
        viewport={VIEWPORT}
        variants={staggerList}
        className="mt-16 grid grid-cols-1 items-end justify-items-center gap-12 sm:grid-cols-3 sm:gap-6"
      >
        {HERO.map((item) => (
          <Highlight key={item.caption} item={item} />
        ))}
      </motion.div>

      <div className="mt-20 flex flex-col gap-14 sm:mt-24">
        {GRUPOS.map((grupo, gi) => (
          <Grupo key={grupo.titulo} grupo={grupo} onOpen={(_, si) => openBox(gi, si)} />
        ))}
      </div>

      <AnimatePresence>
        {box && (
          <Lightbox
            shots={activeShots}
            index={box.shotIndex}
            onClose={closeBox}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
          />
        )}
      </AnimatePresence>
    </Section>
  );
}
