import React from "react";
import { motion } from "framer-motion";

const SplashLoader = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeInOut" }}
      className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0a0a0a]"
    >
      {/* Fondo con efecto de profundidad */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-purple-500/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo con animación de rebote estilo Apple */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ 
            scale: [0.5, 1.1, 1],
            opacity: 1,
            rotate: 360
          }}
          transition={{ 
            scale: { 
              type: "spring", 
              stiffness: 260, 
              damping: 20,
              duration: 1.5 
            },
            rotate: { 
              duration: 25, 
              repeat: Infinity, 
              ease: "linear" 
            },
            opacity: { duration: 0.5 }
          }}
          className="w-32 h-32 sm:w-40 sm:h-40 drop-shadow-[0_0_30px_rgba(59,130,246,0.3)]"
        >
          <img 
            src="/icons/icon-1024.png" 
            alt="SmartFixOS Logo" 
            className="w-full h-full object-contain"
          />
        </motion.div>

        {/* Texto de carga elegante */}
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [0.4, 0.7, 0.4]
            }}
            transition={{ 
              duration: 2.5, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="flex flex-col items-center gap-2"
          >
            <p className="text-white/60 text-xs font-bold tracking-[0.3em] uppercase">
              SmartFixOS
            </p>
            <p className="text-white/30 text-[10px] font-medium tracking-[0.1em] uppercase">
              Iniciando sistema...
            </p>
          </motion.div>
          
          {/* Barra de progreso sutil */}
          <div className="w-32 h-[2px] bg-white/5 rounded-full overflow-hidden relative">
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ 
                duration: 2, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            />
          </div>
        </div>
      </div>

      {/* Marca de agua inferior */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 text-white/10 text-[10px] uppercase tracking-widest font-bold"
      >
        911 SmartFix © 2026
      </motion.div>
    </motion.div>
  );
};

export default SplashLoader;
