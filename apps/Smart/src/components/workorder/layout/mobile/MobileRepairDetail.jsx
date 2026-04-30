import React, { useState, useRef, useCallback, useEffect, memo } from "react";
import { ChevronLeft, Loader2, Zap, Info, Clock, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/capacitor";

import MobileProgressStepper from "./MobileProgressStepper";
import MobileAccionesTab from "./MobileAccionesTab";
import MobileInformacionTab from "./MobileInformacionTab";
import MobileHistorialTab from "./MobileHistorialTab";
import usePullToRefresh from "./usePullToRefresh";
import AddItemModal from "@/components/workorder/AddItemModal";

const TABS = [
  { id: "acciones", label: "Acciones", icon: Zap },
  { id: "informacion", label: "Info", icon: Info },
  { id: "historial", label: "Historial", icon: Clock },
];

// Memoized tab components — only re-render if their own props change
const MemoAccionesTab = memo(MobileAccionesTab);
const MemoInformacionTab = memo(MobileInformacionTab);
const MemoHistorialTab = memo(MobileHistorialTab);

function MobileRepairDetail({
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
  const [showCatalog, setShowCatalog] = useState(false);
  // editMode controla si los lápices y la interactividad de los rows aparecen
  // en MobileInformacionTab. Por defecto desactivado para una vista limpia
  // de "solo lectura"; al tocar el botón "Editar" del header se activa.
  const [editMode, setEditMode] = useState(false);
  const scrollRef = useRef(null);
  const o = order || {};

  // Listen for catalog open event from MobileAccionesTab
  useEffect(() => {
    const handler = () => setShowCatalog(true);
    document.addEventListener("wo:open-catalog", handler);
    return () => document.removeEventListener("wo:open-catalog", handler);
  }, []);

  // Pull to refresh
  const { pullDistance, isRefreshing, onTouchStart, onTouchMove, onTouchEnd } = usePullToRefresh(onUpdate);

  const switchTab = useCallback((newIndex) => {
    if (newIndex < 0 || newIndex >= TABS.length) return;
    setActiveTab(prev => {
      if (prev === newIndex) return prev;
      triggerHaptic("light");
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      return newIndex;
    });
  }, []);

  return (
    <div className="h-full flex flex-col apple-surface apple-type overflow-hidden">
      {/* ── HEADER estilo iOS (nav bar translúcido) ── */}
      <div
        className="flex-shrink-0 apple-surface-secondary relative"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 20px) + 8px)",
          borderBottom: "0.5px solid rgb(var(--separator) / 0.29)",
        }}
      >
        <div className="flex items-center justify-between px-2 py-2">
          <button
            onClick={onClose}
            className="apple-press h-10 pl-1 pr-3 rounded-full flex items-center gap-1 text-apple-blue"
            aria-label="Volver"
          >
            <ChevronLeft className="w-[22px] h-[22px]" strokeWidth={2.4} />
            <span className="apple-text-body">Volver</span>
          </button>
          <div className="flex-1 text-center min-w-0">
            <h1 className="apple-text-headline apple-label-primary truncate">Detalles</h1>
          </div>
          <button
            onClick={onDelete}
            className="apple-press w-10 h-10 rounded-full flex items-center justify-center text-apple-red"
            aria-label="Eliminar"
          >
            <Trash2 className="w-[19px] h-[19px]" />
          </button>
        </div>
      </div>

      {/* ── TAB BAR estilo iOS Segmented Control ── */}
      <div
        className="flex-shrink-0 apple-surface-secondary"
        style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
      >
        <div className="flex">
          {TABS.map((tab, i) => {
            const Icon = tab.icon;
            const isActive = activeTab === i;
            return (
              <button
                key={tab.id}
                onClick={() => switchTab(i)}
                className={cn(
                  "apple-press flex-1 py-2 flex flex-col items-center gap-0.5 relative",
                  isActive ? "text-apple-blue" : "apple-label-tertiary"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon
                  className={cn("w-[22px] h-[22px] transition-colors", isActive ? "text-apple-blue" : "apple-label-tertiary")}
                  strokeWidth={isActive ? 2.1 : 1.8}
                />
                <span className={cn(
                  "apple-text-caption1 transition-colors",
                  isActive ? "text-apple-blue font-semibold" : "apple-label-tertiary font-medium"
                )}>
                  {tab.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-6 right-6 h-[2.5px] bg-apple-blue rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── PROGRESS STEPPER ── */}
      <div
        className="flex-shrink-0"
        style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.20)" }}
      >
        <MobileProgressStepper
          activeStatuses={activeStatuses}
          status={status}
          order={o}
        />
      </div>

      {/* ── PULL TO REFRESH INDICATOR ── */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex-shrink-0 flex items-center justify-center overflow-hidden"
          style={{ height: isRefreshing ? 40 : pullDistance * 0.5 }}
        >
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 text-apple-blue animate-spin" />
          ) : (
            <div
              className="w-5 h-5 rounded-full border-2 border-apple-blue border-t-transparent"
              style={{ transform: `rotate(${pullDistance * 3}deg)`, opacity: Math.min(pullDistance / 80, 1) }}
            />
          )}
        </div>
      )}

      {/* ── TAB CONTENT (no animation, simple swap) ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="px-4 py-4">
          {activeTab === 0 && (
            <MemoAccionesTab
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
            <MemoInformacionTab
              order={o}
              status={status}
              onUpdate={onUpdate}
              onPaymentClick={onPaymentClick}
              onSecurityEdit={onSecurityEdit}
            />
          )}
          {activeTab === 2 && (
            <MemoHistorialTab
              order={o}
              onUpdate={onUpdate}
            />
          )}
        </div>
      </div>

      {/* ── ADD ITEM MODAL ── */}
      <AddItemModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        order={o}
        onItemsUpdated={(newItems) => {
          onOrderItemsUpdate?.(newItems);
          setShowCatalog(false);
        }}
        onRemoteSaved={onRemoteSaved}
      />
    </div>
  );
}

export default memo(MobileRepairDetail);
