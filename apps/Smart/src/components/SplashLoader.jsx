import React from "react";
import { motion } from "framer-motion";

const SplashLoader = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="apple-type fixed inset-0 z-[10000] flex flex-col items-center justify-center apple-surface"
    >
      {/* Fondo con efecto de profundidad */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-apple-blue/12 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-apple-purple/12 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo simple - solo aparece, sin rotacion infinita */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, duration: 0.8 }}
          className="w-32 h-32 sm:w-40 sm:h-40 drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]"
        >
          <img
            src="/icons/icon-1024.png"
            alt="SmartFixOS Logo"
            className="w-full h-full object-contain"
          />
        </motion.div>

        {/* Texto de carga */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex flex-col items-center gap-2 opacity-60">
            <p className="apple-label-primary apple-text-footnote font-semibold">SmartFixOS</p>
            <p className="apple-label-tertiary apple-text-caption2">Iniciando sistema...</p>
          </div>

          {/* Barra de progreso CSS pura (sin framer-motion infinity) */}
          <div className="w-32 h-[2px] bg-gray-sys6 dark:bg-gray-sys5 rounded-full overflow-hidden relative">
            <div className="absolute inset-0 bg-apple-blue splash-bar" />
          </div>
          <style>{`
            @keyframes splashBar {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
            .splash-bar { animation: splashBar 2s ease-in-out infinite; }
          `}</style>
        </div>
      </div>

      {/* Marca de agua inferior */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 apple-label-tertiary apple-text-caption2"
      >
        911 SmartFix © 2026
      </motion.div>
    </motion.div>
  );
};

export default SplashLoader;
