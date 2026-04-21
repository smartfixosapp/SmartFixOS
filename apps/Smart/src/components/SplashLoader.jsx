import React from "react";
import { motion } from "framer-motion";

/**
 * SplashLoader — pantalla de bienvenida con fondo animado.
 *
 * Se muestra al iniciar la app (después de que el splash nativo de iOS se
 * oculta) mientras el resto del JS se parsea / el app se inicializa.
 *
 * Diseño:
 *   - Logo SmartFixOS centrado, con scale-in + pulse suave + glow dinámico
 *   - 3 orbes de color flotando detrás (cyan / emerald / blue)
 *   - Gradient mesh de fondo que se desplaza lentamente
 *   - Dust particles tenues
 *   - Barra de progreso sutil al pie
 *
 * Performance: animaciones CSS puras (transform / opacity / filter) para que
 * la GPU las compose sin costo en el main thread. `prefers-reduced-motion`
 * respetado — si el usuario lo configura, todo queda estático.
 */
const SplashLoader = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center overflow-hidden"
      style={{ backgroundColor: "#05060a" }}
    >
      {/* ── Capa 1: gradient mesh de fondo (muy sutil, se desplaza) ─── */}
      <div className="splash-mesh" />

      {/* ── Capa 2: orbes flotantes de color ─── */}
      <div className="splash-orb splash-orb-cyan" />
      <div className="splash-orb splash-orb-emerald" />
      <div className="splash-orb splash-orb-blue" />

      {/* ── Capa 3: dust particles tenues ─── */}
      <div className="splash-dust">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{ "--i": i }} />
        ))}
      </div>

      {/* ── Contenido principal: logo + marca + barra ─── */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-8">
        {/* Logo con glow pulsante detrás */}
        <div className="relative">
          <div className="splash-logo-glow" />
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 18, duration: 0.9 }}
            className="relative z-10 w-32 h-32 sm:w-40 sm:h-40 splash-logo-float"
          >
            <img
              src="/icons/icon-1024.png"
              alt="SmartFixOS"
              className="w-full h-full object-contain drop-shadow-[0_0_40px_rgba(6,182,212,0.55)]"
            />
          </motion.div>
        </div>

        {/* Marca + subtítulo */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-col items-center gap-1.5"
        >
          <p className="text-white font-semibold tracking-wide text-base">SmartFixOS</p>
          <p className="text-white/50 text-xs tracking-[0.22em] uppercase">Cargando</p>
        </motion.div>

        {/* Barra de progreso sutil */}
        <div className="w-32 h-[2px] rounded-full overflow-hidden bg-white/8 relative">
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-400 splash-progress" />
        </div>
      </div>

      {/* ── Marca de agua inferior ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
        className="absolute bottom-10 text-white/50 text-[10px] tracking-wider"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        911 SmartFix · © 2026
      </motion.div>

      <style>{`
        /* ── Gradient mesh de fondo — se desplaza lento ─── */
        .splash-mesh {
          position: absolute;
          inset: -20%;
          background:
            radial-gradient(ellipse 60% 40% at 30% 20%, rgba(6,182,212,0.18), transparent 60%),
            radial-gradient(ellipse 50% 60% at 75% 80%, rgba(16,185,129,0.15), transparent 60%),
            radial-gradient(ellipse 70% 50% at 50% 50%, rgba(59,130,246,0.12), transparent 70%);
          animation: splashMeshShift 18s ease-in-out infinite alternate;
          will-change: transform;
        }
        @keyframes splashMeshShift {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-4%, 3%) scale(1.08); }
          100% { transform: translate(3%, -4%) scale(1.04); }
        }

        /* ── Orbes de color flotantes ─── */
        .splash-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          opacity: 0.7;
          will-change: transform;
        }
        .splash-orb-cyan {
          width: 50vw; height: 50vw;
          background: radial-gradient(circle, rgba(6,182,212,0.55), transparent 65%);
          top: -15vw; left: -15vw;
          animation: splashFloat1 11s ease-in-out infinite;
        }
        .splash-orb-emerald {
          width: 45vw; height: 45vw;
          background: radial-gradient(circle, rgba(16,185,129,0.45), transparent 65%);
          bottom: -12vw; right: -12vw;
          animation: splashFloat2 13s ease-in-out infinite;
        }
        .splash-orb-blue {
          width: 38vw; height: 38vw;
          background: radial-gradient(circle, rgba(59,130,246,0.4), transparent 65%);
          top: 55%; right: 18%;
          animation: splashFloat3 15s ease-in-out infinite;
        }
        @keyframes splashFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(4vw, 5vw) scale(1.1); }
          66%      { transform: translate(-3vw, 3vw) scale(0.95); }
        }
        @keyframes splashFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-5vw, -4vw) scale(1.12); }
        }
        @keyframes splashFloat3 {
          0%, 100% { transform: translate(0, 0) scale(0.9); }
          50%      { transform: translate(3vw, -5vw) scale(1.05); }
        }

        /* ── Dust particles ─── */
        .splash-dust {
          position: absolute; inset: 0;
          pointer-events: none;
        }
        .splash-dust span {
          position: absolute;
          width: 3px; height: 3px;
          border-radius: 50%;
          background: rgba(255,255,255,0.5);
          left: calc((var(--i) * 5.555%) + 2%);
          top: calc((var(--i) * 5.555%) + 5%);
          opacity: 0;
          animation: splashDust 6s ease-in-out infinite;
          animation-delay: calc(var(--i) * 0.28s);
          box-shadow: 0 0 4px rgba(255,255,255,0.8);
        }
        @keyframes splashDust {
          0%, 100% { opacity: 0; transform: translateY(0); }
          50%      { opacity: 0.7; transform: translateY(-18px); }
        }

        /* ── Glow dinámico alrededor del logo ─── */
        .splash-logo-glow {
          position: absolute;
          inset: -45%;
          background:
            radial-gradient(circle, rgba(6,182,212,0.55) 0%, rgba(16,185,129,0.25) 40%, transparent 70%);
          filter: blur(28px);
          animation: splashGlowPulse 3s ease-in-out infinite;
        }
        @keyframes splashGlowPulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 0.95; transform: scale(1.12); }
        }

        /* ── Logo flotando suavemente ─── */
        .splash-logo-float {
          animation: splashLogoFloat 4s ease-in-out infinite;
        }
        @keyframes splashLogoFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-6px) scale(1.02); }
        }

        /* ── Barra de progreso — se desliza ─── */
        .splash-progress {
          animation: splashProgress 1.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes splashProgress {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }

        /* ── Respetar preferencia de usuario ─── */
        @media (prefers-reduced-motion: reduce) {
          .splash-mesh,
          .splash-orb,
          .splash-dust span,
          .splash-logo-glow,
          .splash-logo-float,
          .splash-progress {
            animation: none !important;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default SplashLoader;
