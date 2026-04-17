import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Package, Wrench, Smartphone, Plus, X, Percent } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function ServiceSelectorModal({ open, onClose, onSelect, deviceModel, deviceCategory }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all"); // all, service, part, offer

  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open, deviceModel, deviceCategory]);

  const loadItems = async () => {
    setLoading(true);
    try {
      // Cargar productos y servicios activos
      const products = await base44.entities.Product.list("-created_date", 100);
      let activeItems = products.filter(p => p.active !== false);

      // 1. Filtrar por categoría de dispositivo (Estricto para servicios y piezas)
      if (deviceCategory) {
        const qCat = deviceCategory.toLowerCase();
        activeItems = activeItems.filter(p => {
          // Si el item tiene categoría asignada, DEBE coincidir
          if (p.device_category) {
            return p.device_category.toLowerCase() === qCat;
          }
          // Si no tiene categoría, permitimos que pase (puede ser genérico)
          return true;
        });
      }

      // 2. Filtrar por modelo (Principalmente para piezas)
      if (deviceModel && deviceModel.length > 2) {
        const q = deviceModel.toLowerCase();
        activeItems = activeItems.filter(p => {
          // Los servicios ya fueron filtrados por categoría arriba, así que los dejamos pasar el filtro de modelo de texto
          if (p.part_type === 'servicio') return true;

          const nameMatch = p.name.toLowerCase().includes(q);
          const compatMatch = p.compatibility_models?.some((m) => m.toLowerCase().includes(q));
          return nameMatch || compatMatch;
        });
      }

      setItems(activeItems);
    } catch (error) {
      console.error("Error loading items:", error);
      toast.error("Error al cargar el catálogo");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                          (item.sku && item.sku.toLowerCase().includes(search.toLowerCase())) ||
                          (item.description && item.description.toLowerCase().includes(search.toLowerCase()));

    if (category === "all") return matchesSearch;
    if (category === "service") return matchesSearch && item.part_type === "servicio";
    if (category === "part") return matchesSearch && item.part_type !== "servicio";
    if (category === "offer") return matchesSearch && item.discount_active;

    return matchesSearch;
  });

  const handleSelect = (item) => {
    onSelect(item);
    toast.success(`${item.name} añadido`);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-type z-[100] max-w-2xl apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="p-4" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <div className="flex items-center justify-between">
            <DialogTitle className="apple-text-headline apple-label-primary flex items-center gap-2">
              <Search className="w-5 h-5 text-apple-blue" />
              Selector de Servicios y Piezas
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar selector de servicios" className="h-8 w-8 apple-label-secondary hover:apple-label-primary">
              <X className="w-5 h-5" />
            </Button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 apple-label-tertiary" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, SKU o descripción..."
                className="apple-input pl-9"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setCategory("all")}
                className={`apple-press px-3 py-1.5 rounded-apple-sm apple-text-caption1 font-medium transition-colors ${
                  category === "all"
                    ? "bg-apple-blue text-white"
                    : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setCategory("service")}
                className={`apple-press flex items-center gap-1.5 px-3 py-1.5 rounded-apple-sm apple-text-caption1 font-medium transition-colors ${
                  category === "service"
                    ? "bg-apple-purple text-white"
                    : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
                }`}
              >
                <Wrench className="w-3 h-3" />
                Servicios
              </button>
              <button
                onClick={() => setCategory("part")}
                className={`apple-press flex items-center gap-1.5 px-3 py-1.5 rounded-apple-sm apple-text-caption1 font-medium transition-colors ${
                  category === "part"
                    ? "bg-apple-green text-white"
                    : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
                }`}
              >
                <Package className="w-3 h-3" />
                Piezas
              </button>
              <button
                onClick={() => setCategory("offer")}
                className={`apple-press flex items-center gap-1.5 px-3 py-1.5 rounded-apple-sm apple-text-caption1 font-medium transition-colors ${
                  category === "offer"
                    ? "bg-apple-orange text-white"
                    : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
                }`}
              >
                <Percent className="w-3 h-3" />
                Ofertas
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-apple-blue"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 apple-label-tertiary">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="apple-text-body">No se encontraron resultados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="apple-press flex items-center justify-between p-3 rounded-apple-md apple-card border-0 hover:bg-gray-sys6 dark:hover:bg-gray-sys5 transition-all group text-left"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-10 h-10 rounded-apple-sm flex items-center justify-center flex-shrink-0 ${
                      item.part_type === "servicio"
                        ? "bg-apple-purple/15 text-apple-purple"
                        : "bg-apple-green/15 text-apple-green"
                    }`}>
                      {item.part_type === "servicio" ? <Wrench className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="apple-text-subheadline font-medium apple-label-primary truncate">{item.name}</p>
                      <div className="flex items-center gap-2 apple-text-caption1 apple-label-secondary">
                        <span className="tabular-nums">${item.price}</span>
                        {item.part_type !== "servicio" && (
                          <span className={`tabular-nums ${item.stock > 0 ? "text-apple-green" : "text-apple-red"}`}>
                            • Stock: {item.stock}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-sys6 dark:bg-gray-sys5 group-hover:bg-apple-blue flex items-center justify-center transition-colors">
                    <Plus className="w-4 h-4 text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
