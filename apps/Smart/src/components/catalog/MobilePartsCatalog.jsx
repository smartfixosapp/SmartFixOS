import React, { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  Box,
  Zap,
  Wrench,
  Tag,
  Package,
  Monitor,
  Battery,
  Cable,
  HardDrive,
  Smartphone,
  Grid
} from "lucide-react";
import { calculateDiscountedPrice } from "../inventory/DiscountBadge";

/**
 * MobilePartsCatalog
 * Componente compartido de catálogo para Órdenes y POS Mobile.
 * Emite items vía callback sin gestionar carrito.
 */
export default function MobilePartsCatalog({
  products = [],
  services = [],
  loading = false,
  onAddItem, // callback: (item) => void
}) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");

  // Helper para identificar servicios
  const isServiceItem = (item) => {
    if (item._type === 'service') return true;
    return item.tipo_principal === "servicios" ||
           item.part_type === "servicio" ||
           item.part_type === "diagnostic" ||
           item.category === "diagnostic" ||
           (item.name || "").toLowerCase().includes("diagnostico");
  };

  const isAccessoryItem = (item) => item.tipo_principal === 'accesorios';

  // Categorías estáticas
  const categories = useMemo(() => {
    const all = [
      ...products.map(p => ({ ...p, _type: 'product' })),
      ...services.map(s => ({ ...s, _type: 'service' }))
    ];
    return [
      { id: "services", label: "Servicios", icon: Zap, count: all.filter(isServiceItem).length },
      { id: "accessories", label: "Accesorios", icon: Box, count: all.filter(isAccessoryItem).length },
      { id: "parts", label: "Piezas", icon: Wrench, count: all.filter(i => !isServiceItem(i) && !isAccessoryItem(i)).length },
    ];
  }, [products, services]);

  // Icono por categoría
  const getCategoryIcon = (cat) => {
    const c = (cat || "").toLowerCase();
    if (c.includes("screen") || c.includes("pantalla")) return <Monitor className="w-4 h-4" />;
    if (c.includes("battery") || c.includes("bateria")) return <Battery className="w-4 h-4" />;
    if (c.includes("cable") || c.includes("cargador")) return <Cable className="w-4 h-4" />;
    if (c.includes("storage") || c.includes("disco")) return <HardDrive className="w-4 h-4" />;
    if (c.includes("repair") || c.includes("reparacion")) return <Wrench className="w-4 h-4" />;
    return <Smartphone className="w-4 h-4" />;
  };

  // Filtrar items por categoría y búsqueda
  const filteredItems = useMemo(() => {
    let allItems = [
      ...products.map(p => ({ ...p, _type: 'product' })),
      ...services.map(s => ({ ...s, _type: 'service' }))
    ];

    if (activeCategory === "services") {
      allItems = allItems.filter(isServiceItem);
    } else if (activeCategory === "accessories") {
      allItems = allItems.filter(isAccessoryItem);
    } else if (activeCategory === "parts") {
      allItems = allItems.filter(i => !isServiceItem(i) && !isAccessoryItem(i));
    }

    if (search) {
      const q = search.toLowerCase();
      allItems = allItems.filter(item =>
        (item.name || "").toLowerCase().includes(q) ||
        (item.sku || "").toLowerCase().includes(q) ||
        (item.code || "").toLowerCase().includes(q) ||
        (item.description || "").toLowerCase().includes(q)
      );
    }

    return allItems;
  }, [activeCategory, search, products, services]);

  const handleAddItem = useCallback((item) => {
    if (onAddItem) {
      onAddItem(item);
    }
  }, [onAddItem]);

  return (
    <div className="apple-type flex flex-col h-full apple-surface">
      {/* Search Bar */}
      <div className="p-4 apple-surface-elevated" style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
        <div className="relative mb-3">
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <Search className="w-4 h-4 apple-label-tertiary" strokeWidth={2.5} />
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pieza, producto..."
            className="apple-input w-full pl-10 pr-4 h-10 apple-text-subheadline"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveCategory("all")}
            className={`apple-press flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-apple-md font-semibold transition-all ${
              activeCategory === "all"
                ? "bg-apple-blue/15 text-apple-blue"
                : "apple-card apple-label-secondary"
            }`}
          >
            <Grid className="w-5 h-5" strokeWidth={2.5} />
          </button>
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`apple-press flex-1 flex items-center justify-center gap-2 px-3 py-3 rounded-apple-md font-semibold transition-all ${
                  activeCategory === cat.id
                    ? "bg-apple-blue/15 text-apple-blue"
                    : "apple-card apple-label-secondary"
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={2.5} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Items Grid */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 space-y-2 apple-surface">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin w-8 h-8 border-4 border-apple-blue border-t-transparent rounded-full" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 apple-label-tertiary">
            <Package className="w-16 h-16 mb-4 opacity-40" />
            <p className="apple-text-subheadline">No se encontraron resultados</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isProduct = item._type === 'product';
            const finalPrice = isProduct ? calculateDiscountedPrice(item) : item.price;
            const hasDiscount = isProduct && finalPrice < item.price;
            const isOutOfStock = isProduct && item.stock <= 0;
            const stockInfo = isProduct ? item.stock : null;

            return (
              <div
                key={item.id}
                className={`
                  apple-list-row relative apple-card p-4
                  ${isOutOfStock ? "opacity-50" : ""}
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className="w-12 h-12 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center flex-shrink-0">
                    {isProduct ? (
                      <Package className="w-6 h-6 text-apple-blue" />
                    ) : (
                      <Wrench className="w-6 h-6 text-apple-blue" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="apple-label-primary apple-text-subheadline font-semibold truncate">{item.name}</h3>

                    {isProduct && (
                      <div className="mt-1">
                        {stockInfo > 0 ? (
                          <span className="apple-text-caption1 text-apple-green font-semibold tabular-nums">
                            {stockInfo > 9999 ? "9999 en" : `${stockInfo} en`} stock
                          </span>
                        ) : (
                          <span className="apple-text-caption1 text-apple-red font-semibold tabular-nums">
                            {stockInfo} en stock
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price & Button */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="apple-label-primary apple-text-headline font-bold tabular-nums">${finalPrice.toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => !isOutOfStock && handleAddItem(item)}
                      disabled={isOutOfStock}
                      className={`apple-press w-9 h-9 rounded-apple-sm flex items-center justify-center transition-all ${
                        isOutOfStock
                          ? "bg-gray-sys5 apple-label-tertiary cursor-not-allowed"
                          : "bg-apple-blue/15 text-apple-blue"
                      }`}
                    >
                      <Plus className="w-5 h-5" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* Out of Stock Overlay */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-black/40 rounded-apple-md flex items-center justify-center backdrop-blur-[2px]">
                    <span className="bg-apple-red text-white px-3 py-1 rounded-full apple-text-caption1 font-bold">
                      AGOTADO
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
