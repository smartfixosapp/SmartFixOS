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
      <DialogContent className="apple-type sm:max-w-xs apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden z-[9999]">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-center flex flex-col items-center gap-2">
            <span className="text-4xl apple-label-primary">{denomination?.label}</span>
            <span className="apple-text-subheadline apple-label-secondary font-normal">Editar Cantidad</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4 px-6">
          <div className="flex items-center gap-4 w-full justify-center">
            <Button
              variant="outline"
              size="icon"
              className="apple-btn apple-btn-secondary apple-press h-12 w-12 rounded-full"
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
                className="apple-input h-16 text-3xl text-center font-semibold tabular-nums rounded-apple-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              className="apple-btn apple-btn-secondary apple-press h-12 w-12 rounded-full"
              onClick={() => setQty(qty + 1)}
              aria-label="Aumentar cantidad"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </div>

          <div className="text-center space-y-1">
             <p className="apple-text-caption2 apple-label-tertiary font-medium">Total Valor</p>
             <p className="apple-text-title1 tabular-nums text-apple-green">
               ${((parseInt(qty) || 0) * (denomination?.value || 0)).toFixed(2)}
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
