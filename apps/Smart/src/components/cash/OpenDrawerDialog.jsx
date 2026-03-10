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
    { id: 'bills_50', label: '$50', value: 50, color: 'bg-blue-500', textColor: 'text-white' },
    { id: 'bills_20', label: '$20', value: 20, color: 'bg-emerald-500', textColor: 'text-white' },
    { id: 'bills_10', label: '$10', value: 10, color: 'bg-yellow-500', textColor: 'text-black' },
    { id: 'bills_5', label: '$5', value: 5, color: 'bg-orange-500', textColor: 'text-white' },
    { id: 'bills_1', label: '$1', value: 1, color: 'bg-slate-500', textColor: 'text-white' },
    { id: 'coins_025', label: '$0.25', value: 0.25, type: 'coin', color: 'bg-slate-600', textColor: 'text-white' },
    { id: 'coins_010', label: '$0.10', value: 0.10, type: 'coin', color: 'bg-slate-600', textColor: 'text-white' },
    { id: 'coins_005', label: '$0.05', value: 0.05, type: 'coin', color: 'bg-slate-600', textColor: 'text-white' },
    { id: 'coins_001', label: '$0.01', value: 0.01, type: 'coin', color: 'bg-slate-600', textColor: 'text-white' },
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
        <DialogContent className="max-w-3xl bg-zinc-950/95 backdrop-blur-xl border border-white/10 shadow-2xl p-0 gap-0 overflow-hidden rounded-3xl [&>button]:hidden max-h-[75vh] flex flex-col">
          {/* Header Apple Style - Compacto */}
          <div className="bg-zinc-900/50 border-b border-white/5 p-4 flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                      <DialogTitle className="text-lg font-bold text-white">Abrir Caja</DialogTitle>
                      <p className="text-zinc-400 text-xs">Efectivo inicial</p>
                  </div>
              </div>
              <div className="text-right">
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Total</p>
                  <div className="text-2xl font-bold text-white font-mono tracking-tight">
                      ${total.toFixed(2)}
                  </div>
              </div>
          </div>

          {/* Content Grid - Scrollable */}
          <div className="p-4 bg-black/40 overflow-y-auto flex-1 select-none">
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
                              "relative aspect-[1.6/1] rounded-[20px] p-4 cursor-pointer transition-all duration-300 select-none group active:scale-[0.94]",
                              d.color,
                              "shadow-[0_4px_16px_rgba(0,0,0,0.25)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.35)] border border-white/10"
                          )}
                      >
                          {/* Apple-style glossy overlay */}
                          <div className="absolute inset-0 rounded-[20px] bg-gradient-to-b from-white/15 via-transparent to-transparent opacity-80" />
                          <div className="absolute inset-0 rounded-[20px] bg-gradient-to-t from-black/10 via-transparent to-transparent" />
                          
                          <div className="relative h-full flex flex-col justify-between z-10">
                              <span className={cn("text-xl font-semibold tracking-tight", d.textColor)}>
                                  {d.label}
                              </span>

                              <div className="self-end">
                                  <span className={cn("text-3xl font-bold tracking-tight tabular-nums", d.textColor)}>
                                      {denominations[d.id] || 0}
                                  </span>
                              </div>
                          </div>

                          {/* Type indicator (Coin/Bill) */}
                          {d.type === 'coin' && (
                              <div className="absolute top-4 right-4 w-6 h-6 rounded-full bg-white/25 backdrop-blur-sm flex items-center justify-center shadow-sm">
                                  <span className="text-[11px] font-bold text-white/90">M</span>
                              </div>
                          )}
                      </div>
                  ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-zinc-500 text-xs">
                  <Calculator className="w-3 h-3" />
                  <span>Mantén presionado para editar cantidad</span>
              </div>
          </div>

          {/* Footer Actions - Compacto */}
          <div className="p-4 bg-zinc-900 border-t border-white/5 flex justify-between gap-3 flex-shrink-0">
              <Button 
                  variant="ghost" 
                  onClick={onClose}
                  className="flex-1 h-12 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-base"
              >
                  Cancelar
              </Button>
              <Button 
                  onClick={handleOpen} 
                  disabled={loading}
                  className="flex-[2] h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-base font-semibold shadow-lg shadow-emerald-900/20"
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
