import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator } from "lucide-react";

export default function EditAmountModal({ 
  isOpen, 
  onClose, 
  title, 
  currentValue, 
  onSave 
}) {
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAmount(currentValue?.toString() || "");
    }
  }, [isOpen, currentValue]);

  const handleSave = () => {
    const val = parseFloat(amount);
    onSave(isNaN(val) ? 0 : val);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xs bg-zinc-900 border-zinc-800 text-white z-[9999]">
        <DialogHeader>
          <DialogTitle className="text-center flex flex-col items-center gap-2">
            <span className="text-xl font-medium">{title}</span>
            <span className="text-zinc-400 text-sm font-normal">Editar Monto Total</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative w-full px-4">
            <div className="absolute left-8 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-3xl">$</div>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="h-20 pl-12 text-4xl text-center font-bold bg-zinc-950 border-zinc-800 focus:ring-emerald-500 rounded-2xl [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
          </div>
          
          <div className="text-center space-y-1">
             <p className="text-zinc-500 text-xs uppercase tracking-wider font-medium">Valor Actual</p>
             <p className="text-xl font-bold text-emerald-400">
               ${(parseFloat(amount) || 0).toFixed(2)}
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
