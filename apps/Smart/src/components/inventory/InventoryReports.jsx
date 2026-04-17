import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, TrendingUp, TrendingDown, AlertTriangle,
  Package, DollarSign, ShoppingCart, Activity
} from "lucide-react";
import { dataClient } from "@/components/api/dataClient";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function InventoryReports({ open, onClose, isEmbedded = false }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    totalCost: 0,
    potentialRevenue: 0,
    avgMargin: 0
  });

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const prods = await dataClient.entities.Product.list();
      setProducts(prods || []);

      // ✅ Filtrar productos: EXCLUIR SERVICIOS (solo dispositivos, piezas, accesorios)
      const activeProducts = (prods || []).filter(p => {
        // Excluir servicios de múltiples formas
        const isService = p.tipo_principal === "servicios" ||
                         p.type === 'service' ||
                         p.part_type === "servicio" ||
                         p.subcategoria === "servicio";
        return p.active !== false && !isService;
      });

      const totalItems = activeProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
      const totalValue = activeProducts.reduce((sum, p) => {
        const stock = Number(p.stock) || 0;
        const price = Number(p.price) || 0;
        return sum + (stock * price);
      }, 0);
      const totalCost = activeProducts.reduce((sum, p) =>
        sum + ((Number(p.stock) || 0) * (Number(p.cost) || 0)), 0
      );
      const potentialRevenue = totalValue - totalCost;
      const avgMargin = totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : 0;

      const lowStockItems = activeProducts.filter(p => {
        const stock = Number(p.stock) || 0;
        const minStock = Number(p.min_stock) || 5;
        return stock > 0 && stock <= minStock;
      }).length;

      const outOfStockItems = activeProducts.filter(p => (Number(p.stock) || 0) === 0).length;

      setStats({
        totalItems,
        totalValue,
        lowStockItems,
        outOfStockItems,
        totalCost,
        potentialRevenue,
        avgMargin
      });
    } catch (error) {
      console.error("Error loading inventory reports:", error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Top 5 productos por valor (SIN SERVICIOS)
  const topByValue = [...products]
    .filter(p => {
      const isService = p.tipo_principal === "servicios" ||
                       p.type === 'service' ||
                       p.part_type === "servicio" ||
                       p.subcategoria === "servicio";
      return p.active !== false && !isService;
    })
    .map(p => ({
      ...p,
      totalValue: (Number(p.stock) || 0) * (Number(p.price) || 0)
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  // ✅ Productos con stock bajo (SIN SERVICIOS)
  const lowStockProducts = products
    .filter(p => {
      const isService = p.tipo_principal === "servicios" ||
                       p.type === 'service' ||
                       p.part_type === "servicio" ||
                       p.subcategoria === "servicio";
      const stock = Number(p.stock) || 0;
      const minStock = Number(p.min_stock) || 5;
      return p.active !== false && !isService && stock > 0 && stock <= minStock;
    })
    .sort((a, b) => (Number(a.stock) - Number(a.min_stock || 5)) - (Number(b.stock) - Number(b.min_stock || 5)));

  // ✅ Productos agotados (SIN SERVICIOS)
  const outOfStockProducts = products
    .filter(p => {
      const isService = p.tipo_principal === "servicios" ||
                       p.type === 'service' ||
                       p.part_type === "servicio" ||
                       p.subcategoria === "servicio";
      return p.active !== false && !isService && (Number(p.stock) || 0) === 0;
    });

  const ContentWrapper = isEmbedded ? 'div' : Dialog;
  const InnerWrapper = isEmbedded ? 'div' : DialogContent;
  const HeaderWrapper = isEmbedded ? 'div' : DialogHeader;
  const TitleWrapper = isEmbedded ? 'h2' : DialogTitle;

  const content = (
    <>
      <HeaderWrapper className={isEmbedded ? "mb-6" : ""}>
        <TitleWrapper className="apple-text-title2 apple-label-primary flex items-center gap-3">
          <BarChart3 className="w-7 h-7 text-apple-blue" />
          Reportes de Inventario
        </TitleWrapper>
      </HeaderWrapper>

        {loading ? (
          <div className="py-12 text-center">
            <Activity className="w-12 h-12 text-apple-blue mx-auto mb-3 animate-spin" />
            <p className="apple-label-secondary">Generando reportes...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tarjetas de estadísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-apple-blue/12 rounded-apple-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-5 h-5 text-apple-blue" />
                  <Badge className="bg-apple-blue/15 text-apple-blue border-0">
                    Unidades
                  </Badge>
                </div>
                <p className="apple-text-title2 font-bold apple-label-primary tabular-nums">{stats.totalItems}</p>
                <p className="apple-text-caption1 apple-label-secondary">Items en inventario</p>
              </div>

              <div className="bg-apple-green/12 rounded-apple-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-5 h-5 text-apple-green" />
                  <Badge className="bg-apple-green/15 text-apple-green border-0">
                    Valor
                  </Badge>
                </div>
                <p className="apple-text-title2 font-bold apple-label-primary tabular-nums">{money(stats.totalValue)}</p>
                <p className="apple-text-caption1 apple-label-secondary">Valor total (PVP)</p>
              </div>

              <div className="bg-apple-yellow/12 rounded-apple-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-5 h-5 text-apple-yellow" />
                  <Badge className="bg-apple-yellow/15 text-apple-yellow border-0">
                    Alertas
                  </Badge>
                </div>
                <p className="apple-text-title2 font-bold apple-label-primary tabular-nums">{stats.lowStockItems}</p>
                <p className="apple-text-caption1 apple-label-secondary">Con stock bajo</p>
              </div>

              <div className="bg-apple-red/12 rounded-apple-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <TrendingDown className="w-5 h-5 text-apple-red" />
                  <Badge className="bg-apple-red/15 text-apple-red border-0">
                    Agotados
                  </Badge>
                </div>
                <p className="apple-text-title2 font-bold apple-label-primary tabular-nums">{stats.outOfStockItems}</p>
                <p className="apple-text-caption1 apple-label-secondary">Sin stock</p>
              </div>
            </div>

            {/* Margen de ganancia */}
            <div className="apple-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="apple-text-headline apple-label-primary flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-apple-green" />
                  Análisis Financiero
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Costo Total</p>
                  <p className="apple-text-title3 font-bold text-apple-red tabular-nums">{money(stats.totalCost)}</p>
                </div>
                <div>
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Ganancia Potencial</p>
                  <p className="apple-text-title3 font-bold text-apple-green tabular-nums">{money(stats.potentialRevenue)}</p>
                </div>
                <div>
                  <p className="apple-text-caption1 apple-label-secondary mb-1">Margen Promedio</p>
                  <p className="apple-text-title3 font-bold text-apple-blue tabular-nums">{stats.avgMargin.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Top 5 productos por valor */}
            <div className="apple-card p-5">
              <h3 className="apple-text-headline apple-label-primary mb-4 flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-apple-purple" />
                Top 5 Productos (por valor en stock)
              </h3>
              <div className="space-y-2">
                {topByValue.length === 0 ? (
                  <p className="apple-label-tertiary apple-text-subheadline text-center py-4">
                    No hay datos suficientes
                  </p>
                ) : (
                  topByValue.map((item, idx) => (
                    <div key={item.id} className="apple-list-row flex items-center justify-between p-3 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-apple-purple flex items-center justify-center text-white font-bold apple-text-subheadline flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="apple-label-primary apple-text-subheadline font-semibold truncate">{item.name}</p>
                          <p className="apple-text-caption1 apple-label-tertiary tabular-nums">
                            {Number(item.stock)} unidades × {money(item.price)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="apple-text-headline font-bold text-apple-green tabular-nums">{money(item.totalValue)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Productos con stock bajo */}
            {lowStockProducts.length > 0 && (
              <div className="bg-apple-yellow/12 rounded-apple-md p-5">
                <h3 className="apple-text-headline font-bold text-apple-yellow mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Productos con Stock Bajo
                </h3>
                <div className="space-y-2">
                  {lowStockProducts.slice(0, 10).map((item) => (
                    <div key={item.id} className="apple-list-row flex items-center justify-between p-3 apple-surface-elevated rounded-apple-sm">
                      <div>
                        <p className="apple-label-primary apple-text-subheadline font-semibold">{item.name}</p>
                        <p className="apple-text-caption1 apple-label-secondary">
                          {item.device_category} • {item.part_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-apple-yellow font-bold tabular-nums">
                          {Number(item.stock)} / {Number(item.min_stock) || 5}
                        </p>
                        <p className="apple-text-caption1 apple-label-tertiary">actual / mínimo</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Productos agotados */}
            {outOfStockProducts.length > 0 && (
              <div className="bg-apple-red/12 rounded-apple-md p-5">
                <h3 className="apple-text-headline font-bold text-apple-red mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5" />
                  Productos Agotados
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {outOfStockProducts.slice(0, 10).map((item) => (
                    <div key={item.id} className="p-3 apple-surface-elevated rounded-apple-sm">
                      <p className="apple-label-primary apple-text-subheadline font-semibold">{item.name}</p>
                      <p className="apple-text-caption1 apple-label-secondary">
                        {item.device_category} • {item.part_type}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

      {!isEmbedded && (
        <div className="pt-4" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <Button onClick={onClose} className="apple-btn apple-btn-primary w-full">
            Cerrar
          </Button>
        </div>
      )}
    </>
  );

  if (isEmbedded) {
    return <div className="apple-type apple-label-primary">{content}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-6 overflow-y-auto max-w-6xl max-h-[90vh]">
        {content}
      </DialogContent>
    </Dialog>
  );
}
