import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, Calculator } from "lucide-react";
import { openCashRegister } from "@/components/cash/CashRegisterService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import EditDenominationModal from "./EditDenominationModal";
import { dataClient as base44 } from "@/components/api/dataClient";

// Definición de denominaciones
const DENOMINATIONS = [
    { id: 'bills_50', label: '$50', value: 50, color: 'bg-apple-blue/15', textColor: 'text-apple-blue' },
    { id: 'bills_20', label: '$20', value: 20, color: 'bg-apple-green/15', textColor: 'text-apple-green' },
    { id: 'bills_10', label: '$10', value: 10, color: 'bg-apple-yellow/15', textColor: 'text-apple-yellow' },
    { id: 'bills_5', label: '$5', value: 5, color: 'bg-apple-orange/15', textColor: 'text-apple-orange' },
    { id: 'bills_1', label: '$1', value: 1, color: 'bg-gray-sys6 dark:bg-gray-sys5', textColor: 'apple-label-primary' },
    { id: 'coins_025', label: '$0.25', value: 0.25, type: 'coin', color: 'bg-gray-sys6 dark:bg-gray-sys5', textColor: 'apple-label-secondary' },
    { id: 'coins_010', label: '$0.10', value: 0.10, type: 'coin', color: 'bg-gray-sys6 dark:bg-gray-sys5', textColor: 'apple-label-secondary' },
    { id: 'coins_005', label: '$0.05', value: 0.05, type: 'coin', color: 'bg-gray-sys6 dark:bg-gray-sys5', textColor: 'apple-label-secondary' },
    { id: 'coins_001', label: '$0.01', value: 0.01, type: 'coin', color: 'bg-gray-sys6 dark:bg-gray-sys5', textColor: 'apple-label-secondary' },
];

export default function OpenDrawerDialog({ isOpen, onClose, onSuccess }) {
  const [denominations, setDenominations] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // { id: 'bills_100', ... }

  // Refs para long press
  const pressTimer = useRef(null);
  const isLongPress = useRef(false);
  const clickProcessed = useRef(false);
  const isTouchDevice = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setDenominations({});
      setEditingItem(null);
    }
  }, [isOpen]);

  const total = DENOMINATIONS.reduce((sum, d) => sum + (denominations[d.id] || 0) * d.value, 0);

  const handleOpen = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      await openCashRegister(denominations, user);
      toast.success("✅ Caja abierta exitosamente");
      window.dispatchEvent(new Event('cash-register-changed'));
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error opening drawer:", error);
      const msg = String(error?.message || error || "").toLowerCase();
      if (
        msg.includes("unrecognized token '<'") ||
        msg.includes("unexpected token '<'") ||
        msg.includes("json parse error") ||
        msg.includes("<!doctype") ||
        msg.includes("load failed") ||
        msg.includes("failed to fetch") ||
        msg.includes("network")
      ) {
        toast.error("Error de conexión con servidor de caja. Intenta nuevamente.");
      } else {
        toast.error(error.message || "Error al abrir caja");
      }
    } finally {
      setLoading(false);
    }
  };

  // --- Long Press Logic ---
  const handleTouchStart = (denom, e) => {
    e.preventDefault();
    isTouchDevice.current = true;
    clickProcessed.current = false;
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      clickProcessed.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      setEditingItem(denom);
    }, 600);
  };

  const handleTouchEnd = (denom, e) => {
    e.preventDefault();
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    
    if (!isLongPress.current && !clickProcessed.current) {
        clickProcessed.current = true;
        setDenominations(prev => ({ ...prev, [denom.id]: (prev[denom.id] || 0) + 1 }));
        if (navigator.vibrate) navigator.vibrate(5);
    }
    
    setTimeout(() => {
      isLongPress.current = false;
      clickProcessed.current = false;
    }, 300);
  };

  const handleMouseDown = (denom) => {
    if (isTouchDevice.current) return;
    clickProcessed.current = false;
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      clickProcessed.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      setEditingItem(denom);
    }, 600);
  };

  const handleMouseUp = (denom) => {
    if (isTouchDevice.current) return;
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    
    if (!isLongPress.current && !clickProcessed.current) {
        clickProcessed.current = true;
        setDenominations(prev => ({ ...prev, [denom.id]: (prev[denom.id] || 0) + 1 }));
        if (navigator.vibrate) navigator.vibrate(5);
    }
    
    setTimeout(() => {
      isLongPress.current = false;
      clickProcessed.current = false;
    }, 300);
  };

  const handleCancel = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    isLongPress.current = false;
    clickProcessed.current = false;
  };

  const handleUpdateQty = (newQty) => {
     if (editingItem) {
         setDenominations(prev => ({ ...prev, [editingItem.id]: newQty }));
     }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl apple-surface-elevated border-0 shadow-apple-xl rounded-apple-lg apple-type p-0 gap-0 overflow-hidden [&>button]:hidden max-h-[75vh] flex flex-col">
          {/* Header */}
          <div
              className="px-5 pt-5 pb-3 flex justify-between items-center flex-shrink-0"
              style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
              <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-apple-green" />
                  </div>
                  <div>
                      <DialogTitle className="apple-text-title2 apple-label-primary">Abrir Caja</DialogTitle>
                      <p className="apple-text-footnote apple-label-secondary">Efectivo inicial</p>
                  </div>
              </div>
              <div className="text-right">
                  <p className="apple-text-caption2 apple-label-tertiary">Total</p>
                  <div className="apple-text-title2 apple-label-primary tabular-nums">
                      ${total.toFixed(2)}
                  </div>
              </div>
          </div>

          {/* Content Grid - Scrollable */}
          <div className="p-5 apple-surface overflow-y-auto flex-1 select-none">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {DENOMINATIONS.map((d) => (
                      <div
                          key={d.id}
                          onMouseDown={() => handleMouseDown(d)}
                          onMouseUp={() => handleMouseUp(d)}
                          onMouseLeave={handleCancel}
                          onTouchStart={(e) => handleTouchStart(d, e)}
                          onTouchEnd={(e) => handleTouchEnd(d, e)}
                          onTouchCancel={handleCancel}
                          onContextMenu={(e) => { e.preventDefault(); }}
                          className={cn(
                              "relative aspect-[1.6/1] rounded-apple-md p-4 cursor-pointer transition-all duration-200 select-none apple-press shadow-apple-sm",
                              d.color
                          )}
                      >
                          <div className="relative h-full flex flex-col justify-between z-10">
                              <span className={cn("apple-text-headline", d.textColor)}>
                                  {d.label}
                              </span>

                              <div className="self-end">
                                  <span className={cn("apple-text-title2 tabular-nums", d.textColor)}>
                                      {denominations[d.id] || 0}
                                  </span>
                              </div>
                          </div>

                          {/* Type indicator (Coin/Bill) */}
                          {d.type === 'coin' && (
                              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gray-sys5 dark:bg-gray-sys4 flex items-center justify-center">
                                  <span className="apple-text-caption2 apple-label-secondary">M</span>
                              </div>
                          )}
                      </div>
                  ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 apple-label-tertiary apple-text-footnote">
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Mantén presionado para editar cantidad</span>
              </div>
          </div>

          {/* Footer Actions */}
          <div
              className="px-5 py-4 flex justify-between gap-3 flex-shrink-0"
              style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
              <Button
                  variant="ghost"
                  onClick={onClose}
                  className="apple-btn apple-btn-secondary apple-btn-lg flex-1"
              >
                  Cancelar
              </Button>
              <Button
                  onClick={handleOpen}
                  disabled={loading}
                  className="apple-btn apple-btn-primary apple-btn-lg flex-[2]"
              >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Confirmar Apertura
              </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <EditDenominationModal 
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          denomination={editingItem}
          currentQty={editingItem ? (denominations[editingItem.id] || 0) : 0}
          onSave={handleUpdateQty}
      />
    </>
  );
}
