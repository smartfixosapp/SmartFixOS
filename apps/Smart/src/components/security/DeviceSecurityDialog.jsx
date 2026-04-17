import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Lock, Grid3x3, Hash } from "lucide-react";
import PatternLock from "./PatternLock";

export default function DeviceSecurityDialog({ open, onClose, onSave }) {
  const [securityType, setSecurityType] = useState("pin");
  const [pin, setPin] = useState("");
  const [showPatternDialog, setShowPatternDialog] = useState(false);
  const [savedPattern, setSavedPattern] = useState(null);

  const handlePinSave = () => {
    if (pin.length !== 4 || !/^\d+$/.test(pin)) {
      alert("El PIN debe tener exactamente 4 dígitos");
      return;
    }

    onSave({
      type: "pin",
      value: pin
    });
    setPin("");
    onClose();
  };

  const handlePatternSave = (patternString) => {
    setSavedPattern(patternString);
    onSave({
      type: "pattern",
      value: patternString
    });
    setShowPatternDialog(false);
    onClose();
  };

  const handleSubmit = () => {
    if (securityType === "pin") {
      handlePinSave();
    } else {
      setShowPatternDialog(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="apple-type max-w-md apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden" hideCloseButton>
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-2">
                <Lock className="w-6 h-6 text-apple-blue" />
                Método de Bloqueo del Equipo
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 mt-6">
              <div className="space-y-4">
                <Label className="apple-text-subheadline apple-label-secondary">Selecciona el método</Label>
                <RadioGroup value={securityType} onValueChange={setSecurityType}>
                  <div className="apple-press flex items-center space-x-3 p-4 apple-card rounded-apple-md cursor-pointer">
                    <RadioGroupItem value="pin" id="pin" />
                    <Label htmlFor="pin" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Hash className="w-5 h-5 text-apple-red" />
                      <div>
                        <p className="apple-text-body font-medium apple-label-primary">PIN Numérico</p>
                        <p className="apple-text-footnote apple-label-tertiary">4 dígitos numéricos</p>
                      </div>
                    </Label>
                  </div>

                  <div className="apple-press flex items-center space-x-3 p-4 apple-card rounded-apple-md cursor-pointer">
                    <RadioGroupItem value="pattern" id="pattern" />
                    <Label htmlFor="pattern" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Grid3x3 className="w-5 h-5 text-apple-red" />
                      <div>
                        <p className="apple-text-body font-medium apple-label-primary">Patrón Gestual</p>
                        <p className="apple-text-footnote apple-label-tertiary">Cuadrícula 3×3</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {securityType === "pin" && (
                <div className="space-y-2">
                  <Label className="apple-text-subheadline apple-label-secondary">Ingresa el PIN del dispositivo</Label>
                  <Input
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="0000"
                    className="apple-input text-center text-2xl tabular-nums"
                  />
                  <p className="apple-text-caption1 apple-label-tertiary text-center">
                    Este PIN se usará para verificar la identidad del cliente
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="apple-btn apple-btn-secondary flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={securityType === "pin" && pin.length !== 4}
                  className="apple-btn apple-btn-primary flex-1"
                >
                  {securityType === "pin" ? "Guardar PIN" : "Configurar Patrón"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PatternLock
        open={showPatternDialog}
        onClose={() => setShowPatternDialog(false)}
        onSave={handlePatternSave}
        mode="set"
      />
    </>
  );
}
