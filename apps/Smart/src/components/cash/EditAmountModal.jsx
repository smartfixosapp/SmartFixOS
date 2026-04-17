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
      <DialogContent className="apple-type sm:max-w-xs apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden z-[9999]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-center flex flex-col items-center gap-2">
            <span className="apple-text-title3 apple-label-primary">{title}</span>
            <span className="apple-text-subheadline apple-label-secondary font-normal">Editar Monto Total</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4 px-6">
          <div className="relative w-full">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 apple-label-tertiary font-semibold text-3xl tabular-nums">$</div>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="apple-input h-20 pl-12 text-4xl text-center font-semibold tabular-nums rounded-apple-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              autoFocus
            />
          </div>

          <div className="text-center space-y-1">
             <p className="apple-text-caption2 apple-label-tertiary font-medium">Valor Actual</p>
             <p className="apple-text-title1 tabular-nums text-apple-green">
               ${(parseFloat(amount) || 0).toFixed(2)}
             </p>
          </div>
        </div>

        <DialogFooter className="sm:justify-center px-6 pb-6">
          <Button
            className="apple-btn apple-btn-primary apple-btn-lg w-full"
            onClick={handleSave}
          >
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
