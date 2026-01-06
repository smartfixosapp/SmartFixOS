import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Box, X, Tag, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from 'react-hot-toast';
import { calculateDiscountedPrice } from "../inventory/DiscountBadge";

export default function AddItemModal({ open, onClose, onSave, order }) {
  const [tab, setTab] = useState("products");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      console.log("[AddItemModal] Abriendo modal");
      loadInventory();
      setSearch("");
      setTab("products");
    }
  }, [open]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      console.log("[AddItemModal] Cargando inventario...");
      const [prods, servs] = await Promise.all([
      base44.entities.Product.filter({ active: true }, undefined, 200),
      base44.entities.Service.filter({ active: true }, undefined, 100)]
      );
      console.log("[AddItemModal] Productos:", prods?.length || 0, "Servicios:", servs?.length || 0);
      setProducts(prods || []);
      setServices(servs || []);
    } catch (error) {
      console.error("[AddItemModal] Error:", error);
      toast.error("Error cargando inventario");
      setProducts([]);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    let items = tab === "products" ? products : tab === "offers" ? products : services;

    // 🏷️ FILTRAR SOLO OFERTAS
    if (tab === "offers") {
      items = items.filter((p) => {
        const hasDiscount = p.discount_active && p.discount_percentage > 0;
        const notExpired = !p.discount_end_date || new Date(p.discount_end_date) >= new Date();
        return hasDiscount && notExpired;
      });
    } else if (tab === "products") {
      // En tab productos, excluir ofertas
      items = items.filter((p) => {
        const hasDiscount = p.discount_active && p.discount_percentage > 0;
        const notExpired = !p.discount_end_date || new Date(p.discount_end_date) >= new Date();
        return !(hasDiscount && notExpired);
      });
    }

    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter((item) =>
    (item.name || "").toLowerCase().includes(q) ||
    (item.sku || "").toLowerCase().includes(q) ||
    (item.code || "").toLowerCase().includes(q) ||
    (item.description || "").toLowerCase().includes(q)
    );
  }, [tab, search, products, services]);

  const handleSelectItem = (item) => {
    console.log("[AddItemModal] Seleccionado:", item.name);

    if (tab === "products" || tab === "offers") {
      const finalPrice = tab === "offers" ? calculateDiscountedPrice(item) : item.price;
      const hasDiscount = tab === "offers" && finalPrice < item.price;

      if (hasDiscount) {
        toast.success(`🏷️ Oferta aplicada: -${item.discount_percentage}% en ${item.name}`);
      }

      onSave({
        __kind: "product",
        __source_id: item.id,
        type: "product",
        name: item.name,
        price: finalPrice,
        originalPrice: hasDiscount ? item.price : null,
        discountApplied: hasDiscount ? item.discount_percentage : null,
        discountLabel: hasDiscount ? item.discount_label : null,
        cost: item.cost,
        qty: 1,
        sku: item.sku,
        stock: item.stock,
        min_stock: item.min_stock,
        taxable: item.taxable !== false,
        from_inventory: true
      });
    } else {
      onSave({
        __kind: "service",
        __source_id: item.id,
        type: "service",
        name: item.name,
        price: item.price,
        qty: 1,
        code: item.code,
        from_inventory: true
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm">
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-[#111114] to-[#0D0D0D] border border-cyan-500/20 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-[0_24px_80px_rgba(0,168,232,0.5)] theme-light:bg-white theme-light:border-gray-200">
          <div className="flex items-center justify-between p-6 border-b border-cyan-500/20 bg-gradient-to-r from-cyan-600/10 to-emerald-600/10 theme-light:border-gray-200 theme-light:from-cyan-50 theme-light:to-emerald-50">
            <h2 className="text-xl font-bold text-white flex items-center gap-2 theme-light:text-gray-900">
              <Plus className="w-6 h-6 text-cyan-500 theme-light:text-cyan-600" />
              Añadir Pieza / Servicio
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center theme-light:bg-gray-100 theme-light:hover:bg-gray-200">

              <X className="w-5 h-5 text-white theme-light:text-gray-900" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 px-4 sm:px-6 pt-4">
            <button
              onClick={() => setTab("products")}
              className={`px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                tab === "products"
                  ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white shadow-lg"
                  : "bg-slate-800 text-gray-300 border border-slate-700 hover:bg-slate-700"
              }`}
            >
              📦 Productos ({products.length})
            </button>
            <button
              onClick={() => setTab("offers")}
              className={`px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                tab === "offers"
                  ? "bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg"
                  : "bg-slate-800 text-gray-300 border border-slate-700 hover:bg-slate-700"
              }`}
            >
              🏷️ Ofertas ({products.filter(p => p.discount_active && p.discount_percentage > 0).length})
            </button>
            <button
              onClick={() => setTab("services")}
              className={`px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                tab === "services"
                  ? "bg-gradient-to-r from-cyan-600 to-emerald-600 text-white shadow-lg"
                  : "bg-slate-800 text-gray-300 border border-slate-700 hover:bg-slate-700"
              }`}
            >
              🔧 Servicios ({services.length})
            </button>
          </div>

          <div className="px-6 pt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Buscar por nombre, SKU, código..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 bg-black/40 border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900" />

            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading ?
            <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                <p className="text-gray-400 text-sm theme-light:text-gray-600">Cargando inventario...</p>
              </div> :
            filteredItems.length === 0 ?
            <div className="text-center py-12 border-2 border-dashed border-cyan-500/20 rounded-lg theme-light:border-gray-300">
                <Box className="w-12 h-12 mx-auto text-gray-600 mb-3" />
                <p className="text-gray-500 text-sm mb-2 theme-light:text-gray-600">
                  {search ? "No se encontraron resultados" : tab === "offers" ? "No hay ofertas activas" : `No hay ${tab === "products" ? "productos" : "servicios"}`}
                </p>
                {search &&
              <Button
                variant="outline"
                onClick={() => setSearch("")}
                className="mt-2 border-cyan-500/20 theme-light:border-gray-300">

                    Limpiar búsqueda
                  </Button>
              }
              </div> :

            <div className="space-y-2">
                {filteredItems.map((item) => {
                const finalPrice = tab === "offers" ? calculateDiscountedPrice(item) : item.price;
                const hasDiscount = tab === "offers" && finalPrice < item.price;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className={`w-full flex items-center justify-between p-4 border rounded-xl hover:shadow-[0_8px_32px_rgba(16,185,129,0.2)] transition-all text-left group ${
                    hasDiscount ?
                    'bg-gradient-to-r from-orange-600/10 to-red-600/10 border-orange-500/40 hover:border-orange-400/70 theme-light:from-orange-50 theme-light:to-red-50 theme-light:border-orange-300' :
                    'bg-black/20 border-cyan-500/20 hover:border-emerald-500/50 hover:bg-white/10 theme-light:bg-white theme-light:border-gray-200 theme-light:hover:border-emerald-500/50 theme-light:hover:shadow-lg'}`
                    }>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-base truncate group-hover:text-cyan-300 transition-colors theme-light:text-gray-900 theme-light:group-hover:text-cyan-700">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge className={tab === "services" ? "bg-lime-600/20 text-lime-300 border-lime-600/30 theme-light:bg-lime-100 theme-light:text-lime-700 theme-light:border-lime-300" : "bg-cyan-600/20 text-cyan-300 border-cyan-600/30 theme-light:bg-cyan-100 theme-light:text-cyan-700 theme-light:border-cyan-300"}>
                            {tab === "services" ? "Servicio" : "Producto"}
                          </Badge>
                          {hasDiscount &&
                        <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white animate-pulse">
                              <Zap className="w-3 h-3 mr-1" />
                              -{item.discount_percentage}% OFERTA
                            </Badge>
                        }
                          {item.sku && <span className="text-xs text-gray-400 theme-light:text-gray-600">SKU: {item.sku}</span>}
                          {item.code && <span className="text-xs text-gray-400 theme-light:text-gray-600">Código: {item.code}</span>}
                          {tab !== "services" &&
                        <Badge className={
                        item.stock <= 0 ? "bg-red-600/20 text-red-300 border-red-600/30 theme-light:bg-red-100 theme-light:text-red-700 theme-light:border-red-300" :
                        item.stock <= item.min_stock ? "bg-amber-600/20 text-amber-300 border-amber-600/30 theme-light:bg-amber-100 theme-light:text-amber-700 theme-light:border-amber-300" :
                        "bg-emerald-600/20 text-emerald-300 border-emerald-600/30 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300"
                        }>
                              Stock: {item.stock || 0}
                            </Badge>
                        }
                        </div>
                        {item.description &&
                      <p className="text-xs text-gray-500 mt-1 truncate theme-light:text-gray-600">{item.description}</p>
                      }
                      </div>
                      <div className="flex flex-col items-end gap-1 ml-4">
                        <span className={`text-xl font-semibold ${hasDiscount ? 'text-orange-400 theme-light:text-orange-600' : 'text-emerald-400 theme-light:text-emerald-600'}`}>
                          ${finalPrice.toFixed(2)}
                        </span>
                        {hasDiscount &&
                      <span className="text-sm text-gray-500 line-through">
                            ${item.price.toFixed(2)}
                          </span>
                      }
                        <Plus className="w-6 h-6 text-gray-400 group-hover:text-emerald-400 transition-colors theme-light:group-hover:text-emerald-600" />
                      </div>
                    </button>);

              })}
              </div>
            }
          </div>
        </div>
      </div>
    </div>);

}
