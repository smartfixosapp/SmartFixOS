import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

const PRODUCT_CATEGORIES = [
  { value: "screen", label: "Pantallas" },
  { value: "battery", label: "Baterías" },
  { value: "charger", label: "Cargadores" },
  { value: "cable", label: "Cables" },
  { value: "case", label: "Fundas" },
  { value: "other", label: "Otros" }
];

const STOCK_LEVELS = [
  { value: "all", label: "Todos" },
  { value: "in_stock", label: "En Stock" },
  { value: "low_stock", label: "Stock Bajo" },
  { value: "out_of_stock", label: "Agotado" }
];

export default function InventoryAdvancedFilters({ open, onClose, onApply, currentFilters }) {
  const [filters, setFilters] = useState({
    stockLevel: "all",
    category: "all",
    priceMin: 0,
    priceMax: 1000,
    searchTerm: "",
    ...currentFilters
  });

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters = {
      stockLevel: "all",
      category: "all",
      priceMin: 0,
      priceMax: 1000,
      searchTerm: ""
    };
    setFilters(resetFilters);
    onApply(resetFilters);
    onClose();
  };

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "priceMin" && value === 0) return false;
    if (key === "priceMax" && value === 1000) return false;
    if (value === "all" || value === "") return false;
    return true;
  }).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Filter className="w-6 h-6 text-red-600" />
            Filtros de Inventario
            {activeFiltersCount > 0 && (
              <Badge className="bg-red-600 text-white">
                {activeFiltersCount} activos
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Search */}
          <div className="space-y-2">
            <Label className="text-gray-300">Buscar Producto</Label>
            <Input
              placeholder="Nombre, SKU o descripción..."
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              className="bg-black/40 border-white/10 text-white"
            />
          </div>

          {/* Stock Level */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Nivel de Stock
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {STOCK_LEVELS.map((level) => (
                <button
                  key={level.value}
                  onClick={() => setFilters({ ...filters, stockLevel: level.value })}
                  className={`p-3 rounded-lg border-2 transition-all text-sm ${
                    filters.stockLevel === level.value
                      ? 'border-red-600 bg-red-600/20 text-white'
                      : 'border-white/10 bg-black/20 text-gray-400 hover:border-white/30'
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Categoría
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <button
                onClick={() => setFilters({ ...filters, category: "all" })}
                className={`p-3 rounded-lg border-2 transition-all text-sm ${
                  filters.category === "all"
                    ? 'border-red-600 bg-red-600/20 text-white'
                    : 'border-white/10 bg-black/20 text-gray-400 hover:border-white/30'
                }`}
              >
                Todas
              </button>
              {PRODUCT_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setFilters({ ...filters, category: cat.value })}
                  className={`p-3 rounded-lg border-2 transition-all text-sm ${
                    filters.category === cat.value
                      ? 'border-red-600 bg-red-600/20 text-white'
                      : 'border-white/10 bg-black/20 text-gray-400 hover:border-white/30'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Rango de Precio
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">
                  ${filters.priceMin.toFixed(2)}
                </span>
                <span className="text-gray-300">
                  ${filters.priceMax.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Mínimo</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={filters.priceMin}
                    onChange={(e) => setFilters({ ...filters, priceMin: parseFloat(e.target.value) || 0 })}
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300">Máximo</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={filters.priceMax}
                    onChange={(e) => setFilters({ ...filters, priceMax: parseFloat(e.target.value) || 1000 })}
                    className="bg-black/40 border-white/10 text-white"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t border-white/10">
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex-1 border-white/10 text-gray-300 hover:bg-white/5"
          >
            <X className="w-4 h-4 mr-2" />
            Limpiar Filtros
          </Button>
          <Button
            onClick={handleApply}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900"
          >
            Aplicar Filtros
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
