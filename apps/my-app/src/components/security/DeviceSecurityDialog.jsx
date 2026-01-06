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
        <DialogContent className="max-w-md bg-gradient-to-br from-[#2B2B2B] to-black border-[#FF0000]/30">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
              <Lock className="w-6 h-6 text-[#FF0000]" />
              Método de Bloqueo del Equipo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-4">
              <Label className="text-gray-300">Selecciona el método</Label>
              <RadioGroup value={securityType} onValueChange={setSecurityType}>
                <div className="flex items-center space-x-3 p-4 bg-black rounded-lg border border-gray-700 hover:border-[#FF0000]/50 cursor-pointer">
                  <RadioGroupItem value="pin" id="pin" />
                  <Label htmlFor="pin" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Hash className="w-5 h-5 text-[#FF0000]" />
                    <div>
                      <p className="font-medium text-white">PIN Numérico</p>
                      <p className="text-sm text-gray-400">4 dígitos numéricos</p>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-black rounded-lg border border-gray-700 hover:border-[#FF0000]/50 cursor-pointer">
                  <RadioGroupItem value="pattern" id="pattern" />
                  <Label htmlFor="pattern" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Grid3x3 className="w-5 h-5 text-[#FF0000]" />
                    <div>
                      <p className="font-medium text-white">Patrón Gestual</p>
                      <p className="text-sm text-gray-400">Cuadrícula 3×3</p>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {securityType === "pin" && (
              <div className="space-y-2">
                <Label className="text-gray-300">Ingresa el PIN del dispositivo</Label>
                <Input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="0000"
                  className="text-center text-2xl tracking-widest bg-black border-gray-700 text-white"
                />
                <p className="text-xs text-gray-500 text-center">
                  Este PIN se usará para verificar la identidad del cliente
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={securityType === "pin" && pin.length !== 4}
                className="flex-1 bg-gradient-to-r from-[#FF0000] to-red-800 hover:from-red-700 hover:to-red-900"
              >
                {securityType === "pin" ? "Guardar PIN" : "Configurar Patrón"}
              </Button>
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
