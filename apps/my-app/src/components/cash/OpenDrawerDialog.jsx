import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { openCashRegister } from "./CashRegisterService";
import { base44 } from "@/api/base44Client";

const DENOMINATIONS = [
{ key: 'bills_100', label: '$100', value: 100, color: 'from-purple-600 to-purple-800' },
{ key: 'bills_50', label: '$50', value: 50, color: 'from-blue-600 to-blue-800' },
{ key: 'bills_20', label: '$20', value: 20, color: 'from-green-600 to-green-800' },
{ key: 'bills_10', label: '$10', value: 10, color: 'from-yellow-600 to-yellow-800' },
{ key: 'bills_5', label: '$5', value: 5, color: 'from-orange-600 to-orange-800' },
{ key: 'bills_1', label: '$1', value: 1, color: 'from-gray-600 to-gray-800' },
{ key: 'coins_1', label: '$1', value: 1, color: 'from-gray-500 to-gray-700' },
{ key: 'coins_050', label: '$0.50', value: 0.50, color: 'from-gray-400 to-gray-600' },
{ key: 'coins_025', label: '$0.25', value: 0.25, color: 'from-gray-400 to-gray-600' }];


export default function OpenDrawerDialog({ open, onClose, onSuccess }) {
  const [denominations, setDenominations] = useState(
    DENOMINATIONS.reduce((acc, d) => ({ ...acc, [d.key]: 0 }), {})
  );
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const longPressTimer = useRef(null);
  const [longPressing, setLongPressing] = useState(null);

  const total = DENOMINATIONS.reduce((sum, d) =>
  sum + (denominations[d.key] || 0) * d.value, 0
  );

  const handleIncrement = (key) => {
    setDenominations((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
  };

  const handleEdit = (key, value) => {
    setDenominations((prev) => ({ ...prev, [key]: Math.max(0, parseInt(value) || 0) }));
  };

  const handleOpen = async () => {
    if (total <= 0) {
      toast.error("El monto inicial debe ser mayor a $0");
      return;
    }

    setLoading(true);
    try {
      const user = await base44.auth.me();
      await openCashRegister(denominations, user);
      toast.success("✅ Caja abierta exitosamente");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error opening drawer:", error);
      toast.error(error.message || "Error al abrir caja");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl bg-gradient-to-br from-black to-[#0D0D0D] border-cyan-500/30">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <Wallet className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-500" />
            Abrir Caja Registradora
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {DENOMINATIONS.map((denom) =>
            <div key={denom.key}>
                {editing === denom.key ?
              <div className="space-y-2">
                    <div className="text-white font-bold text-xs sm:text-sm mb-1">{denom.label}</div>
                    <Input
                  type="number"
                  value={denominations[denom.key]}
                  onChange={(e) => handleEdit(denom.key, e.target.value)}
                  onBlur={() => setEditing(null)}
                  autoFocus
                  className="bg-black/60 border-yellow-400/50 text-white text-center text-xl sm:text-2xl font-bold h-12 sm:h-14" />
                    <p className="text-yellow-400 text-[10px] sm:text-xs text-center">✏️ Editando</p>
                  </div> :

              <button
                onClick={() => handleIncrement(denom.key)}
                onTouchStart={() => {
                  longPressTimer.current = setTimeout(() => {
                    setLongPressing(denom.key);
                    setEditing(denom.key);
                  }, 2000);
                }}
                onTouchEnd={() => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                  }
                  setLongPressing(null);
                }}
                onTouchMove={() => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                  }
                  setLongPressing(null);
                }}
                onMouseDown={() => {
                  longPressTimer.current = setTimeout(() => {
                    setLongPressing(denom.key);
                    setEditing(denom.key);
                  }, 2000);
                }}
                onMouseUp={() => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                  }
                  setLongPressing(null);
                }}
                onMouseLeave={() => {
                  if (longPressTimer.current) {
                    clearTimeout(longPressTimer.current);
                  }
                  setLongPressing(null);
                }}
                className={`w-full bg-gradient-to-br ${denom.color} p-4 rounded-xl border-2 transition-all relative overflow-hidden ${
                longPressing === denom.key ? 'border-yellow-400 scale-95' : 'border-white/20 hover:border-white/40'}`
                }>

                    {longPressing === denom.key &&
                <div className="absolute inset-0 bg-yellow-400/20 animate-pulse" />
                }
                    <div className="text-white font-bold text-sm sm:text-base lg:text-lg relative z-10">{denom.label}</div>
                    <div className="text-white/80 text-xl sm:text-2xl font-black mt-0.5 sm:mt-1 relative z-10">
                      {denominations[denom.key] || 0}
                    </div>
                    {longPressing === denom.key &&
                <div className="absolute bottom-1 left-0 right-0 text-yellow-400 text-[8px] sm:text-[10px] font-bold text-center z-10">
                        Mantén presionado...
                      </div>
                }
                  </button>
              }
              </div>
            )}
          </div>

          <div className="bg-black/40 border border-emerald-500/30 rounded-xl p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-bold text-sm">💰 Resumen - Hoy</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-emerald-300 text-xs font-semibold mb-1">TOTAL</p>
                    <p className="text-white text-2xl sm:text-3xl font-black">${total.toFixed(2)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-emerald-400 opacity-50" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={onClose} className="bg-zinc-900 text-slate-50 px-4 py-2 text-sm font-semibold rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground flex-1 border-gray-400 hover:bg-gray-700 h-10 sm:h-11">

              Cancelar
            </Button>
            <Button
              onClick={handleOpen}
              disabled={loading || total <= 0}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 h-10 sm:h-11 text-sm">

              {loading ? "Abriendo..." : "Abrir Caja"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>);

}
