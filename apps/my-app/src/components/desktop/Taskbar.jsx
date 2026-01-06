import React from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function Taskbar({ widgets, onRestore }) {
  const minimizedWidgets = widgets.filter(w => w.isMinimized);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-2xl",
        "bg-slate-900/80 backdrop-blur-2xl border border-white/10",
        "shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      )}>
        <AnimatePresence>
          {minimizedWidgets.length === 0 ? (
            <div className="px-4 py-2 text-white/30 text-sm">
              No minimized widgets
            </div>
          ) : (
            minimizedWidgets.map((widget) => {
              const Icon = widget.icon;
              return (
                <motion.button
                  key={widget.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.1, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onRestore(widget.id)}
                  className={cn(
                    "relative p-3 rounded-xl transition-all duration-200",
                    "bg-gradient-to-br hover:shadow-lg",
                    widget.color
                  )}
                >
                  <Icon className={`w-5 h-5 text-white`} />
                  <span className={cn(
                    "absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg",
                    "bg-slate-800 text-white text-xs whitespace-nowrap",
                    "opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
                  )}>
                    {widget.title}
                  </span>
                </motion.button>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
