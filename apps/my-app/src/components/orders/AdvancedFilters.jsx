import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ORDER_STATUSES } from "@/components/utils/statusRegistry";

export default function AdvancedFilters({ open, onClose, onApply, currentFilters }) {
  const [filters, setFilters] = useState({
    customerName: "",
    customerId: "",
    deviceBrand: "",
    deviceModel: "",
    dateRangeType: "any", // any, created, updated
    dateFrom: null,
    dateTo: null,
    statuses: [], // Multiple status selection
    ...currentFilters
  });

  const [brands, setBrands] = useState([]);
  const [models, setModels] = useState([]);

  useEffect(() => {
    if (open) {
      loadBrandsAndModels();
    }
  }, [open]);

  const loadBrandsAndModels = async () => {
    try {
      const [brandsData, modelsData] = await Promise.all([
        base44.entities.Brand.list().catch(() => []),
        base44.entities.DeviceModel.list().catch(() => [])
      ]);
      setBrands(brandsData || []);
      setModels(modelsData || []);
    } catch (error) {
      console.error("Error loading brands/models:", error);
    }
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    const resetFilters = {
      customerName: "",
      customerId: "",
      deviceBrand: "",
      deviceModel: "",
      dateRangeType: "any",
      dateFrom: null,
      dateTo: null,
      statuses: []
    };
    setFilters(resetFilters);
    onApply(resetFilters);
    onClose();
  };

  const toggleStatus = (statusId) => {
    setFilters(prev => ({
      ...prev,
      statuses: prev.statuses.includes(statusId)
        ? prev.statuses.filter(s => s !== statusId)
        : [...prev.statuses, statusId]
    }));
  };

  const activeFiltersCount = Object.values(filters).filter(v => {
    if (Array.isArray(v)) return v.length > 0;
    if (v === null || v === undefined) return false;
    if (v === "any") return false;
    return v !== "";
  }).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <Filter className="w-6 h-6 text-red-600" />
            Filtros Avanzados
            {activeFiltersCount > 0 && (
              <Badge className="bg-red-600 text-white">
                {activeFiltersCount} activos
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Customer Filters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Cliente
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Nombre del Cliente</Label>
                <Input
                  placeholder="Buscar por nombre..."
                  value={filters.customerName}
                  onChange={(e) => setFilters({ ...filters, customerName: e.target.value })}
                  className="bg-black/40 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">ID del Cliente</Label>
                <Input
                  placeholder="ID del cliente..."
                  value={filters.customerId}
                  onChange={(e) => setFilters({ ...filters, customerId: e.target.value })}
                  className="bg-black/40 border-white/10 text-white"
                />
              </div>
            </div>
          </div>

          {/* Device Filters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Dispositivo
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Marca</Label>
                <Select
                  value={filters.deviceBrand}
                  onValueChange={(value) => setFilters({ ...filters, deviceBrand: value, deviceModel: "" })}
                >
                  <SelectTrigger className="bg-black/40 border-white/10 text-white">
                    <SelectValue placeholder="Todas las marcas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las marcas</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.name}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300">Modelo</Label>
                <Select
                  value={filters.deviceModel}
                  onValueChange={(value) => setFilters({ ...filters, deviceModel: value })}
                  disabled={!filters.deviceBrand || filters.deviceBrand === "all"}
                >
                  <SelectTrigger className="bg-black/40 border-white/10 text-white">
                    <SelectValue placeholder="Todos los modelos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los modelos</SelectItem>
                    {models
                      .filter(m => !filters.deviceBrand || filters.deviceBrand === "all" || m.brand_id === brands.find(b => b.name === filters.deviceBrand)?.id)
                      .map((model) => (
                        <SelectItem key={model.id} value={model.name}>
                          {model.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Date Range Filters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Rango de Fechas
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Tipo de Fecha</Label>
                <Select
                  value={filters.dateRangeType}
                  onValueChange={(value) => setFilters({ ...filters, dateRangeType: value })}
                >
                  <SelectTrigger className="bg-black/40 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Cualquier fecha</SelectItem>
                    <SelectItem value="created">Fecha de creación</SelectItem>
                    <SelectItem value="updated">Última actualización</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filters.dateRangeType !== "any" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Desde</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal bg-black/40 border-white/10 text-white hover:bg-black/60"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dateFrom ? format(filters.dateFrom, "PPP") : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.dateFrom}
                          onSelect={(date) => setFilters({ ...filters, dateFrom: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300">Hasta</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-left font-normal bg-black/40 border-white/10 text-white hover:bg-black/60"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dateTo ? format(filters.dateTo, "PPP") : "Seleccionar fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={filters.dateTo}
                          onSelect={(date) => setFilters({ ...filters, dateTo: date })}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Filters */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">
              Estados
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {ORDER_STATUSES.map((status) => (
                <button
                  key={status.id}
                  onClick={() => toggleStatus(status.id)}
                  className={`p-3 rounded-lg border-2 transition-all text-sm ${
                    filters.statuses.includes(status.id)
                      ? 'border-red-600 bg-red-600/20 text-white'
                      : 'border-white/10 bg-black/20 text-gray-400 hover:border-white/30'
                  }`}
                >
                  {status.label}
                </button>
              ))}
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
