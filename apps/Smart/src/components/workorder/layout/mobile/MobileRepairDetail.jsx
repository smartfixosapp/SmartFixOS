import React, { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/capacitor";

import MobileProgressStepper from "./MobileProgressStepper";
import MobileAccionesTab from "./MobileAccionesTab";
import MobileInformacionTab from "./MobileInformacionTab";
import MobileHistorialTab from "./MobileHistorialTab";
import usePullToRefresh from "./usePullToRefresh";

const TABS = [
  { id: "acciones", label: "Acciones" },
  { id: "informacion", label: "Informacion" },
  { id: "historial", label: "Historial" },
];

const SWIPE_THRESHOLD = 50;

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction < 0 ? 300 : -300, opacity: 0 }),
};

export default function MobileRepairDetail({
  order,
  status,
  activeStatuses,
  closedStatuses,
  changingStatus,
  onChangeStatus,
  onPaymentClick,
  onPrint,
  onDelete,
  onSecurityEdit,
  onClose,
  onUpdate,
  onOrderItemsUpdate,
  onRemoteSaved,
  stageContent,
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [direction, setDirection] = useState(0);
  const scrollRef = useRef(null);
  const o = order || {};

  // Pull to refresh
  const { pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(onUpdate);

  const switchTab = useCallback((newIndex) => {
    if (newIndex === activeTab || newIndex < 0 || newIndex >= TABS.length) return;
    setDirection(newIndex > activeTab ? 1 : -1);
    setActiveTab(newIndex);
    triggerHaptic("light");
    // Scroll to top on tab change
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab]);

  const handleDragEnd = useCallback((_, info) => {
    const { offset, velocity } = info;
    if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > 500) {
      if (offset.x < 0 && activeTab < TABS.length - 1) {
        switchTab(activeTab + 1);
      } else if (offset.x > 0 && activeTab > 0) {
        switchTab(activeTab - 1);
      }
    }
  }, [activeTab, switchTab]);

  return (
    <div className="h-full flex flex-col bg-[#0D0D0F] overflow-hidden">
      {/* ── HEADER ── */}
      <div
        className="flex-shrink-0 border-b border-white/[0.08] bg-[#0D0D0F]"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 20px) + 10px)" }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <div className="flex-1 text-center min-w-0">
            <h1 className="text-lg font-black text-white tracking-tight">Detalles de reparacion</h1>
          </div>
          <button
            onClick={onDelete}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-500/10 active:scale-90 transition-all"
          >
            <Trash2 className="w-5 h-5 text-white/50 hover:text-red-400" />
          </button>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div className="flex-shrink-0 border-b border-white/[0.08] bg-[#0D0D0F]">
        <div className="flex">
          {TABS.map((tab, i) => (
            <button
              key={tab.id}
              onClick={() => switchTab(i)}
              className={cn(
                "flex-1 py-3 text-sm font-semibold transition-all relative",
                activeTab === i ? "text-white" : "text-white/40"
              )}
            >
              {tab.label}
              {activeTab === i && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-4 right-4 h-0.5 bg-cyan-500 rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── PROGRESS STEPPER ── */}
      <div className="flex-shrink-0 border-b border-white/[0.06]">
        <MobileProgressStepper
          activeStatuses={activeStatuses}
          status={status}
          order={o}
        />
      </div>

      {/* ── PULL TO REFRESH INDICATOR ── */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex-shrink-0 flex items-center justify-center overflow-hidden transition-all"
          style={{ height: isRefreshing ? 40 : pullDistance * 0.5 }}
        >
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
          ) : (
            <div
              className="w-5 h-5 rounded-full border-2 border-cyan-400 border-t-transparent transition-transform"
              style={{ transform: `rotate(${pullDistance * 3}deg)`, opacity: Math.min(pullDistance / 80, 1) }}
            />
          )}
        </div>
      )}

      {/* ── SWIPEABLE CONTENT ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.25 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            className="px-4 py-4"
          >
            {activeTab === 0 && (
              <MobileAccionesTab
                order={o}
                status={status}
                activeStatuses={activeStatuses}
                closedStatuses={closedStatuses}
                changingStatus={changingStatus}
                onChangeStatus={onChangeStatus}
                onPaymentClick={onPaymentClick}
                onPrint={onPrint}
                onSecurityEdit={onSecurityEdit}
                onSwitchTab={switchTab}
                onUpdate={onUpdate}
                stageContent={stageContent}
              />
            )}
            {activeTab === 1 && (
              <MobileInformacionTab
                order={o}
                status={status}
                onUpdate={onUpdate}
                onPaymentClick={onPaymentClick}
                onSecurityEdit={onSecurityEdit}
              />
            )}
            {activeTab === 2 && (
              <MobileHistorialTab
                order={o}
                onUpdate={onUpdate}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
}
