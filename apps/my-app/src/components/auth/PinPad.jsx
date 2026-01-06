import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Shield, Delete } from "lucide-react";
import { toast } from "sonner";

export default function PinPad({ onSuccess, onCancel, title = "PIN Maestro", subtitle = "Acceso a administración de usuarios" }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleNumberClick = (num) => {
    if (pin.length < 4) {
      setPin(pin + num);
      setError(false);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  const handleSubmit = () => {
    // PIN por defecto: 9110
    if (pin === "9110") {
      toast.success("✅ Acceso autorizado");
      onSuccess?.();
    } else {
      setError(true);
      setPin("");
      toast.error("❌ PIN incorrecto");
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Header con icono */}
      <div className="text-center mb-12">
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-600 to-red-800 mx-auto mb-6 flex items-center justify-center shadow-[0_0_60px_rgba(220,38,38,0.4)]">
          <Shield className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
        <p className="text-gray-400 text-sm">{subtitle}</p>
      </div>

      {/* Indicador de PIN */}
      <div className="flex justify-center gap-4 mb-12">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full transition-all ${
              i < pin.length
                ? error
                  ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]"
                  : "bg-gradient-to-r from-cyan-500 to-emerald-500 shadow-[0_0_12px_rgba(0,168,232,0.6)]"
                : "bg-gray-700"
            }`}
          />
        ))}
      </div>

      {/* Teclado numérico */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleNumberClick(num.toString())}
            className="bg-[#1e293b] hover:bg-[#334155] active:scale-95 rounded-2xl h-20 text-white text-2xl font-bold transition-all border border-white/5 hover:border-cyan-500/30 shadow-lg"
          >
            {num}
          </button>
        ))}

        {/* Fila inferior: Borrar, 0, Confirmar */}
        <button
          onClick={handleDelete}
          className="bg-[#1e293b] hover:bg-[#334155] active:scale-95 rounded-2xl h-20 text-white flex items-center justify-center transition-all border border-white/5 hover:border-red-500/30"
        >
          <Delete className="w-6 h-6" />
        </button>

        <button
          onClick={() => handleNumberClick("0")}
          className="bg-[#1e293b] hover:bg-[#334155] active:scale-95 rounded-2xl h-20 text-white text-2xl font-bold transition-all border border-white/5 hover:border-cyan-500/30 shadow-lg"
        >
          0
        </button>

        <button
          onClick={handleSubmit}
          disabled={pin.length < 4}
          className={`rounded-2xl h-20 text-white text-2xl font-bold transition-all flex items-center justify-center ${
            pin.length >= 4
              ? "bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 shadow-[0_8px_32px_rgba(220,38,38,0.5)] active:scale-95"
              : "bg-gray-800 opacity-50 cursor-not-allowed"
          }`}
        >
          ✓
        </button>
      </div>

      {/* Botón cancelar */}
      <button
        onClick={onCancel}
        className="w-full text-gray-400 hover:text-white transition-colors text-sm"
      >
        Cancelar
      </button>

      {/* Info PIN por defecto */}
      <p className="text-gray-600 text-xs text-center mt-6">
        PIN por defecto: 9110 (cambiar después de primer acceso)
      </p>
    </div>
  );
}
