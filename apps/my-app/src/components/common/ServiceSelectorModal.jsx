import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Package, Wrench, Smartphone, Plus, X, Percent } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function ServiceSelectorModal({ open, onClose, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all"); // all, service, part, offer

  useEffect(() => {
    if (open) {
      loadItems();
    }
  }, [open]);

  const loadItems = async () => {
    setLoading(true);
    try {
      // Cargar productos y servicios activos
      const products = await base44.entities.Product.list("-created_date", 100);
      const activeItems = products.filter(p => p.active !== false);
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
      <DialogContent className="z-[100] max-w-2xl bg-[#0f172a] border border-cyan-500/20 text-white p-0 gap-0 max-h-[85vh] flex flex-col">
        <DialogHeader className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              Selector de Servicios y Piezas
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, SKU o descripción..."
                className="pl-9 bg-black/30 border-white/10 text-white focus:border-cyan-500/50"
                autoFocus
              />
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={() => setCategory("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === "all" 
                    ? "bg-cyan-600 text-white" 
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setCategory("service")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === "service" 
                    ? "bg-purple-600 text-white" 
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                <Wrench className="w-3 h-3" />
                Servicios
              </button>
              <button
                onClick={() => setCategory("part")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === "part" 
                    ? "bg-emerald-600 text-white" 
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
                }`}
              >
                <Package className="w-3 h-3" />
                Piezas
              </button>
              <button
                onClick={() => setCategory("offer")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  category === "offer" 
                    ? "bg-amber-500 text-white" 
                    : "bg-white/5 text-gray-400 hover:bg-white/10"
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No se encontraron resultados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-cyan-500/30 transition-all group text-left"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.part_type === "servicio" 
                        ? "bg-purple-500/20 text-purple-400" 
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {item.part_type === "servicio" ? <Wrench className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.name}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>${item.price}</span>
                        {item.part_type !== "servicio" && (
                          <span className={item.stock > 0 ? "text-emerald-400" : "text-red-400"}>
                            • Stock: {item.stock}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 group-hover:bg-cyan-600 flex items-center justify-center transition-colors">
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
