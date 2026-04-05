import React, { useState } from "react";
import { Phone, MessageCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { triggerHaptic } from "@/lib/capacitor";

export default function MobileQuickContactFAB({ phone, customerName, orderNumber }) {
  const [expanded, setExpanded] = useState(false);

  if (!phone) return null;

  const cleanPhone = phone.replace(/\D/g, "");
  const waMsg = encodeURIComponent(
    `Hola ${customerName || ""}, le contactamos de SmartFixOS sobre su orden #${orderNumber || ""}.`
  );

  const toggle = () => {
    triggerHaptic("light");
    setExpanded(v => !v);
  };

  return (
    <div className="fixed bottom-24 right-4 z-30 flex flex-col-reverse items-end gap-2">
      <AnimatePresence>
        {expanded && (
          <>
            <motion.a
              key="call"
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 10 }}
              transition={{ duration: 0.2 }}
              href={`tel:${phone}`}
              className="w-12 h-12 rounded-full bg-blue-600 shadow-lg shadow-blue-600/30 flex items-center justify-center active:scale-90 transition-transform"
            >
              <Phone className="w-5 h-5 text-white" />
            </motion.a>
            <motion.a
              key="wa"
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 10 }}
              transition={{ duration: 0.2, delay: 0.05 }}
              href={`https://wa.me/${cleanPhone}?text=${waMsg}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-12 h-12 rounded-full bg-green-600 shadow-lg shadow-green-600/30 flex items-center justify-center active:scale-90 transition-transform"
            >
              <MessageCircle className="w-5 h-5 text-white" />
            </motion.a>
          </>
        )}
      </AnimatePresence>

      {/* Main toggle */}
      <button
        onClick={toggle}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all active:scale-90 ${
          expanded
            ? "bg-white/10 border border-white/20"
            : "bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/30"
        }`}
      >
        {expanded ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <MessageCircle className="w-6 h-6 text-white" />
        )}
      </button>
    </div>
  );
}
