import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, TrendingDown } from "lucide-react";
import { useI18n } from "@/components/utils/i18n";

export default function InventoryAlertsWidget() {
  const { t } = useI18n();
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLowStockItems();
  }, []);

  const loadLowStockItems = async () => {
    try {
      const products = await base44.entities.Product.list("-created_date", 100);
      
      // Filtrar solo productos con stock bajo o agotado
      // Excluir servicios (type !== "service")
      const filtered = (products || [])
        .filter(p => p.type !== "service") // Solo productos, no servicios
        .filter(p => {
          const stock = Number(p.stock || 0);
          const minStock = Number(p.min_stock || 5);
          return stock <= minStock;
        })
        .sort((a, b) => {
          const aStock = Number(a.stock || 0);
          const bStock = Number(b.stock || 0);
          return aStock - bStock;
        })
        .slice(0, 5);

      setLowStockItems(filtered);
    } catch (error) {
      console.error("Error loading low stock items:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (item) => {
    const stock = Number(item.stock || 0);
    if (stock === 0) {
      return { label: t('outOfStock'), color: "bg-red-600/20 text-red-300 border-red-600/30" };
    }
    return { label: t('lowStock'), color: "bg-amber-600/20 text-amber-300 border-amber-600/30" };
  };

  return (
    <Card className="bg-transparent border-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
          {t('inventoryAlerts')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full" />
          </div>
        ) : lowStockItems.length === 0 ? (
          <div className="text-center py-6">
            <Package className="w-12 h-12 mx-auto text-gray-600 mb-2" />
            <p className="text-gray-400 text-sm">{t('stockOk')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {lowStockItems.map((item) => {
              const status = getStockStatus(item);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/10 hover:border-amber-600/40 transition-all"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-amber-600/10 flex items-center justify-center flex-shrink-0">
                      <TrendingDown className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{item.name}</p>
                      <p className="text-gray-400 text-xs">
                        {t('stock')}: <span className="font-semibold">{item.stock || 0}</span>
                        {item.min_stock && ` / ${t('minStock')}: ${item.min_stock}`}
                      </p>
                    </div>
                  </div>
                  <Badge className={`${status.color} text-xs whitespace-nowrap`}>
                    {status.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
