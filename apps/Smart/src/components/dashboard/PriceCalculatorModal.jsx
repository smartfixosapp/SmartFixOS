import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, DollarSign, Clock, Percent, X } from "lucide-react";
import { motion } from "framer-motion";

export default function PriceCalculatorModal({ open, onClose }) {
  const [partCost, setPartCost] = useState("");
  const [laborMode, setLaborMode] = useState("price"); // "price" o "percentage"
  const [laborCost, setLaborCost] = useState("");
  const [profitPercentage, setProfitPercentage] = useState("");
  const IVU_RATE = 0.115; // 11.5% IVU de Puerto Rico

  const calculatePrice = () => {
    const cost = Number(partCost) || 0;
    let labor = 0;

    if (laborMode === "price") {
      labor = Number(laborCost) || 0;
    } else if (laborMode === "percentage") {
      const profit = Number(profitPercentage) || 0;
      // subtotal sin IVU es cost + labor, el total con IVU = subtotal * (1 + 0.115)
      // Si queremos un margen de ganancia X%, entonces: labor = cost * (profit / 100)
      labor = cost * (profit / 100);
    }

    const subtotal = cost + labor;
    const ivu = subtotal * IVU_RATE;
    const total = subtotal + ivu;

    return {
      partCost: cost,
      laborCost: labor,
      subtotal,
      ivu,
      total
    };
  };

  const results = calculatePrice();

  const generatePDF = async () => {
    // Función no usada por ahora
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-[#0A0A0A]/95 backdrop-blur-2xl border-white/10 text-white shadow-2xl rounded-[32px] p-0">
        <div className="sticky top-0 z-20 bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-white/5 p-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 rounded-2xl">
              <Calculator className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-white">Calculadora de Precios</DialogTitle>
              <p className="text-white/50 text-sm font-medium mt-1">
                Calcula cotizaciones rápidas para trabajos personalizados
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Entrada de Costo de Pieza */}
          <div className="space-y-2">
            <Label className="text-white/70 text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Costo de Pieza
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              value={partCost}
              onChange={(e) => setPartCost(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 text-base"
            />
          </div>

          {/* Selector de modo Mano de Obra / Porcentaje */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setLaborMode("price")}
                className={`flex-1 h-10 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  laborMode === "price"
                    ? "bg-gradient-to-r from-cyan-500/40 to-emerald-500/40 border border-cyan-500/60 text-white"
                    : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Precio
              </button>
              <button
                onClick={() => setLaborMode("percentage")}
                className={`flex-1 h-10 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                  laborMode === "percentage"
                    ? "bg-gradient-to-r from-cyan-500/40 to-emerald-500/40 border border-cyan-500/60 text-white"
                    : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                }`}
              >
                <Percent className="w-4 h-4" />
                Porcentaje
              </button>
            </div>

            {laborMode === "price" ? (
              <div className="space-y-2">
                <Label className="text-white/70 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Mano de Obra
                </Label>
                <Input
                  type="number"
                  placeholder="65.00"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 text-base"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-white/70 text-sm flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  % de Ganancia
                </Label>
                <Input
                  type="number"
                  placeholder="50"
                  value={profitPercentage}
                  onChange={(e) => setProfitPercentage(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/30 h-11 text-base"
                />
                <p className="text-white/50 text-xs">Basado en el costo de pieza</p>
              </div>
            )}
          </div>

          {/* Resultado */}
          {(partCost || laborCost) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 border border-cyan-500/20 rounded-3xl p-6">
              <div className="flex justify-between items-center bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 rounded-2xl p-4 border border-cyan-500/30">
                <span className="text-white font-bold text-lg">Precio Total (IVU incluido):</span>
                <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                  ${results.total.toFixed(2)}
                </span>
              </div>
            </motion.div>
          )}

        </div>
      </DialogContent>
    </Dialog>);

}
