import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Minus, Plus, Calculator } from "lucide-react";

export default function EditDenominationModal({ 
  isOpen, 
  onClose, 
  denomination, 
  currentQty, 
  onSave 
}) {
  const [qty, setQty] = useState(currentQty || 0);

  useEffect(() => {
    if (isOpen) {
      setQty(currentQty || 0);
    }
  }, [isOpen, currentQty]);

  const handleSave = () => {
    onSave(parseInt(qty) || 0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xs bg-zinc-900 border-zinc-800 text-white z-[9999]">
        <DialogHeader>
          <DialogTitle className="text-center flex flex-col items-center gap-2">
            <span className="text-4xl">{denomination?.label}</span>
            <span className="text-zinc-400 text-sm font-normal">Editar Cantidad</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="flex items-center gap-4 w-full justify-center">
            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full border-zinc-700 hover:bg-zinc-800"
              onClick={() => setQty(Math.max(0, qty - 1))}
              aria-label="Disminuir cantidad"
            >
              <Minus className="h-6 w-6" />
            </Button>

            <div className="relative w-24">
              <Input
                type="number"
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value) || 0)}
                className="h-16 text-3xl text-center font-bold bg-zinc-950 border-zinc-800 focus:ring-emerald-500 rounded-2xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-12 w-12 rounded-full border-zinc-700 hover:bg-zinc-800"
              onClick={() => setQty(qty + 1)}
              aria-label="Aumentar cantidad"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>
          
          <div className="text-center space-y-1">
             <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Total Valor</p>
             <p className="text-2xl font-bold text-emerald-400">
               ${((parseInt(qty) || 0) * (denomination?.value || 0)).toFixed(2)}
             </p>
          </div>
        </div>

        <DialogFooter className="sm:justify-center">
          <Button 
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl h-12 text-lg font-medium" 
            onClick={handleSave}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
