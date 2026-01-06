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

      // Calcular estadísticas
      const activeProducts = (prods || []).filter(p => p.active !== false && p.type !== 'service');
      
      const totalItems = activeProducts.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
      const totalValue = activeProducts.reduce((sum, p) => 
        sum + ((Number(p.stock) || 0) * (Number(p.price) || 0)), 0
      );
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

  // Top 5 productos por valor
  const topByValue = [...products]
    .filter(p => p.active !== false && p.type !== 'service')
    .map(p => ({
      ...p,
      totalValue: (Number(p.stock) || 0) * (Number(p.price) || 0)
    }))
    .sort((a, b) => b.totalValue - a.totalValue)
    .slice(0, 5);

  // Productos con stock bajo
  const lowStockProducts = products
    .filter(p => {
      const stock = Number(p.stock) || 0;
      const minStock = Number(p.min_stock) || 5;
      return p.active !== false && stock > 0 && stock <= minStock;
    })
    .sort((a, b) => (Number(a.stock) - Number(a.min_stock || 5)) - (Number(b.stock) - Number(b.min_stock || 5)));

  // Productos agotados
  const outOfStockProducts = products
    .filter(p => p.active !== false && (Number(p.stock) || 0) === 0);

  const ContentWrapper = isEmbedded ? 'div' : Dialog;
  const InnerWrapper = isEmbedded ? 'div' : DialogContent;
  const HeaderWrapper = isEmbedded ? 'div' : DialogHeader;
  const TitleWrapper = isEmbedded ? 'h2' : DialogTitle;

  const content = (
    <>
      <HeaderWrapper className={isEmbedded ? "mb-6" : ""}>
        <TitleWrapper className="text-2xl font-bold text-white flex items-center gap-3 theme-light:text-gray-900">
          <BarChart3 className="w-7 h-7 text-cyan-400" />
          Reportes de Inventario
        </TitleWrapper>
      </HeaderWrapper>

        {loading ? (
          <div className="py-12 text-center">
            <Activity className="w-12 h-12 text-cyan-400 mx-auto mb-3 animate-spin" />
            <p className="text-white/60 theme-light:text-gray-600">Generando reportes...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Tarjetas de estadísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-cyan-600/10 to-cyan-700/10 border border-cyan-500/30 rounded-xl p-4 theme-light:bg-cyan-50 theme-light:border-cyan-300">
                <div className="flex items-center justify-between mb-2">
                  <Package className="w-5 h-5 text-cyan-400" />
                  <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-600/30 theme-light:bg-cyan-100 theme-light:text-cyan-700">
                    Unidades
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-white theme-light:text-gray-900">{stats.totalItems}</p>
                <p className="text-xs text-white/50 theme-light:text-gray-600">Items en inventario</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-600/10 to-emerald-700/10 border border-emerald-500/30 rounded-xl p-4 theme-light:bg-emerald-50 theme-light:border-emerald-300">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-600/30 theme-light:bg-emerald-100 theme-light:text-emerald-700">
                    Valor
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-white theme-light:text-gray-900">{money(stats.totalValue)}</p>
                <p className="text-xs text-white/50 theme-light:text-gray-600">Valor total (PVP)</p>
              </div>

              <div className="bg-gradient-to-br from-amber-600/10 to-amber-700/10 border border-amber-500/30 rounded-xl p-4 theme-light:bg-amber-50 theme-light:border-amber-300">
                <div className="flex items-center justify-between mb-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <Badge className="bg-amber-600/20 text-amber-300 border-amber-600/30 theme-light:bg-amber-100 theme-light:text-amber-700">
                    Alertas
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-white theme-light:text-gray-900">{stats.lowStockItems}</p>
                <p className="text-xs text-white/50 theme-light:text-gray-600">Con stock bajo</p>
              </div>

              <div className="bg-gradient-to-br from-red-600/10 to-red-700/10 border border-red-500/30 rounded-xl p-4 theme-light:bg-red-50 theme-light:border-red-300">
                <div className="flex items-center justify-between mb-2">
                  <TrendingDown className="w-5 h-5 text-red-400" />
                  <Badge className="bg-red-600/20 text-red-300 border-red-600/30 theme-light:bg-red-100 theme-light:text-red-700">
                    Agotados
                  </Badge>
                </div>
                <p className="text-2xl font-bold text-white theme-light:text-gray-900">{stats.outOfStockItems}</p>
                <p className="text-xs text-white/50 theme-light:text-gray-600">Sin stock</p>
              </div>
            </div>

            {/* Margen de ganancia */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-5 theme-light:bg-gray-50 theme-light:border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 theme-light:text-gray-900">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Análisis Financiero
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-white/50 mb-1 theme-light:text-gray-600">Costo Total</p>
                  <p className="text-xl font-bold text-red-400">{money(stats.totalCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-1 theme-light:text-gray-600">Ganancia Potencial</p>
                  <p className="text-xl font-bold text-emerald-400">{money(stats.potentialRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-white/50 mb-1 theme-light:text-gray-600">Margen Promedio</p>
                  <p className="text-xl font-bold text-cyan-400">{stats.avgMargin.toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Top 5 productos por valor */}
            <div className="bg-black/40 border border-white/10 rounded-xl p-5 theme-light:bg-gray-50 theme-light:border-gray-200">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 theme-light:text-gray-900">
                <ShoppingCart className="w-5 h-5 text-purple-400" />
                Top 5 Productos (por valor en stock)
              </h3>
              <div className="space-y-2">
                {topByValue.length === 0 ? (
                  <p className="text-white/40 text-sm text-center py-4 theme-light:text-gray-600">
                    No hay datos suficientes
                  </p>
                ) : (
                  topByValue.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 theme-light:bg-white theme-light:border-gray-200">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-semibold truncate theme-light:text-gray-900">{item.name}</p>
                          <p className="text-xs text-white/40 theme-light:text-gray-600">
                            {Number(item.stock)} unidades × {money(item.price)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-emerald-400">{money(item.totalValue)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Productos con stock bajo */}
            {lowStockProducts.length > 0 && (
              <div className="bg-amber-600/10 border border-amber-500/30 rounded-xl p-5 theme-light:bg-amber-50 theme-light:border-amber-300">
                <h3 className="text-lg font-bold text-amber-300 mb-4 flex items-center gap-2 theme-light:text-amber-700">
                  <AlertTriangle className="w-5 h-5" />
                  ⚠️ Productos con Stock Bajo
                </h3>
                <div className="space-y-2">
                  {lowStockProducts.slice(0, 10).map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-amber-500/30 theme-light:bg-white theme-light:border-amber-300">
                      <div>
                        <p className="text-white font-semibold theme-light:text-gray-900">{item.name}</p>
                        <p className="text-xs text-white/50 theme-light:text-gray-600">
                          {item.device_category} • {item.part_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-amber-300 font-bold theme-light:text-amber-700">
                          {Number(item.stock)} / {Number(item.min_stock) || 5}
                        </p>
                        <p className="text-xs text-white/40 theme-light:text-gray-600">actual / mínimo</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Productos agotados */}
            {outOfStockProducts.length > 0 && (
              <div className="bg-red-600/10 border border-red-500/30 rounded-xl p-5 theme-light:bg-red-50 theme-light:border-red-300">
                <h3 className="text-lg font-bold text-red-300 mb-4 flex items-center gap-2 theme-light:text-red-700">
                  <TrendingDown className="w-5 h-5" />
                  🚫 Productos Agotados
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {outOfStockProducts.slice(0, 10).map((item) => (
                    <div key={item.id} className="p-3 bg-black/20 rounded-lg border border-red-500/30 theme-light:bg-white theme-light:border-red-300">
                      <p className="text-white font-semibold text-sm theme-light:text-gray-900">{item.name}</p>
                      <p className="text-xs text-white/50 theme-light:text-gray-600">
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
        <div className="border-t border-cyan-500/20 pt-4 theme-light:border-gray-200">
          <Button onClick={onClose} className="w-full bg-gradient-to-r from-cyan-600 to-emerald-700">
            Cerrar
          </Button>
        </div>
      )}
    </>
  );

  if (isEmbedded) {
    return <div className="text-white theme-light:text-gray-900">{content}</div>;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0f0f10] border border-cyan-500/20 max-w-6xl max-h-[90vh] overflow-y-auto text-white theme-light:bg-white theme-light:border-gray-200">
        {content}
      </DialogContent>
    </Dialog>
  );
}
