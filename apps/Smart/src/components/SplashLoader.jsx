import React from "react";
import { motion } from "framer-motion";

/**
 * SplashLoader — pantalla de bienvenida estilo "Spark Reveal".
 *
 * Filosofía: rápido, limpio, premium. Estilo Apple boot — el logo aparece
 * enfocándose y un destello sutil lo acompaña; texto y línea aparecen
 * después con stagger. Total ~1.2s antes de fade out.
 *
 * Performance:
 *   - Solo `transform`, `opacity` y `filter` (todas GPU-aceleradas)
 *   - El backdrop coincide con el LaunchScreen.storyboard nativo (#05060a)
 *     para que la transición desde el splash de iOS sea invisible
 *   - Respeta `prefers-reduced-motion`
 */
const SplashLoader = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#05060a" }}
    >
      {/* ── Capa 1: gradient ambiente sutil (apenas perceptible) ─── */}
      <div className="splash-ambient" aria-hidden="true" />

      {/* ── Capa 2: destello que aparece detrás del logo una sola vez ─── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: [0, 0.7, 0], scale: [0.6, 1.4, 1.8] }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
        className="splash-spark"
        aria-hidden="true"
      />

      {/* ── Logo: aparece enfocándose desde un blur sutil ─── */}
      <motion.div
        initial={{ scale: 0.86, opacity: 0, filter: "blur(8px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-28 h-28 sm:w-32 sm:h-32"
      >
        <img
          src="/icons/icon-1024.png"
          alt="SmartFixOS"
          className="w-full h-full object-contain"
          style={{
            filter: "drop-shadow(0 0 24px rgba(10, 132, 255, 0.55))",
          }}
        />
      </motion.div>

      {/* ── Línea horizontal que se dibuja debajo del logo ─── */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.55 }}
        className="mt-7 h-px w-32 origin-left bg-gradient-to-r from-transparent via-white/35 to-transparent"
        aria-hidden="true"
      />

      {/* ── Wordmark + tagline ─── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: 0.65 }}
        className="mt-4 flex flex-col items-center"
      >
        <p className="text-white text-[15px] font-semibold tracking-tight">
          SmartFixOS
        </p>
        <p className="mt-1 text-white/40 text-[10px] tracking-[0.32em] uppercase">
          Smart · Fix · Operate
        </p>
      </motion.div>

      {/* ── Indicator de actividad sutil (solo si tarda más de 1s en cargar) ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.1 }}
        className="absolute"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 56px)",
        }}
        aria-label="Cargando"
      >
        <div className="splash-dots" aria-hidden="true">
          <span /><span /><span />
        </div>
      </motion.div>

      <style>{`
        /* ── Ambient gradient — detalle muy sutil para no quedar plano ─ */
        .splash-ambient {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 45% at 50% 38%, rgba(10, 132, 255, 0.10), transparent 65%),
            radial-gradient(ellipse 70% 50% at 50% 100%, rgba(94, 92, 230, 0.06), transparent 70%);
          pointer-events: none;
        }

        /* ── Destello detrás del logo ─── */
        .splash-spark {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 260px;
          height: 260px;
          margin-left: -130px;
          margin-top: -130px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(10, 132, 255, 0.45) 0%,
            rgba(10, 132, 255, 0.18) 35%,
            transparent 70%
          );
          filter: blur(12px);
          pointer-events: none;
        }

        /* ── Tres puntos de "cargando" — pulsan en secuencia ─── */
        .splash-dots {
          display: flex;
          gap: 6px;
        }
        .splash-dots span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.55);
          animation: splashDot 1.2s ease-in-out infinite;
        }
        .splash-dots span:nth-child(2) { animation-delay: 0.15s; }
        .splash-dots span:nth-child(3) { animation-delay: 0.30s; }
        @keyframes splashDot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30%           { transform: translateY(-4px); opacity: 1; }
        }

        /* ── Respetar preferencia de usuario ─── */
        @media (prefers-reduced-motion: reduce) {
          .splash-spark,
          .splash-dots span {
            animation: none !important;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default SplashLoader;
