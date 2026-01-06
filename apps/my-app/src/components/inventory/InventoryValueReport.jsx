import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  BarChart3,
  Download
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear } from "date-fns";
import { es } from "date-fns/locale";

export default function InventoryValueReport({ open, onClose }) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [timeRange, setTimeRange] = useState("month"); // month, year, all

  useEffect(() => {
    if (open) {
      loadReportData();
    }
  }, [open, timeRange]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [products, movements, sales] = await Promise.all([
        base44.entities.Product.filter({ active: true }),
        base44.entities.InventoryMovement.list("-created_date", 1000),
        base44.entities.Sale.list("-created_date", 1000)
      ]);

      // Calcular valor total del inventario
      const totalInventoryValue = products.reduce((sum, p) => {
        const stock = Number(p.stock || 0);
        const cost = Number(p.cost || 0);
        return sum + (stock * cost);
      }, 0);

      const totalRetailValue = products.reduce((sum, p) => {
        const stock = Number(p.stock || 0);
        const price = Number(p.price || 0);
        return sum + (stock * price);
      }, 0);

      // Filtrar movimientos por período
      const now = new Date();
      let startDate;
      
      switch (timeRange) {
        case "month":
          startDate = startOfMonth(now);
          break;
        case "year":
          startDate = startOfYear(now);
          break;
        default:
          startDate = new Date(0); // All time
      }

      const periodMovements = movements.filter(m => 
        new Date(m.created_date) >= startDate
      );

      const periodSales = sales.filter(s => 
        new Date(s.created_date) >= startDate && !s.voided
      );

      // Calcular COGS (Cost of Goods Sold)
      let cogs = 0;
      for (const sale of periodSales) {
        if (sale.items) {
          for (const item of sale.items) {
            if (item.type === "product") {
              const product = products.find(p => p.id === item.id);
              if (product) {
                const cost = Number(product.cost || 0);
                const quantity = Number(item.quantity || 0);
                cogs += cost * quantity;
              }
            }
          }
        }
      }

      // Ingresos del período
      const revenue = periodSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const grossProfit = revenue - cogs;
      const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      // Stock por categoría
      const categoryBreakdown = {};
      products.forEach(p => {
        const category = p.category || "other";
        if (!categoryBreakdown[category]) {
          categoryBreakdown[category] = {
            count: 0,
            value: 0,
            items: 0
          };
        }
        categoryBreakdown[category].count += 1;
        categoryBreakdown[category].items += Number(p.stock || 0);
        categoryBreakdown[category].value += Number(p.stock || 0) * Number(p.cost || 0);
      });

      // Productos más vendidos
      const productSales = {};
      periodSales.forEach(sale => {
        if (sale.items) {
          sale.items.forEach(item => {
            if (item.type === "product") {
              if (!productSales[item.id]) {
                productSales[item.id] = {
                  name: item.name,
                  quantity: 0,
                  revenue: 0
                };
              }
              productSales[item.id].quantity += Number(item.quantity || 0);
              productSales[item.id].revenue += Number(item.total || 0);
            }
          });
        }
      });

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

      // Productos de bajo stock
      const lowStockProducts = products.filter(p => {
        const stock = Number(p.stock || 0);
        const minStock = Number(p.min_stock || 0);
        return stock > 0 && stock <= minStock;
      }).length;

      const outOfStockProducts = products.filter(p => {
        const stock = Number(p.stock || 0);
        return stock === 0;
      }).length;

      setReportData({
        totalInventoryValue,
        totalRetailValue,
        totalProducts: products.length,
        totalUnits: products.reduce((sum, p) => sum + Number(p.stock || 0), 0),
        cogs,
        revenue,
        grossProfit,
        grossMargin,
        categoryBreakdown,
        topProducts,
        lowStockProducts,
        outOfStockProducts,
        periodLabel: timeRange === "month" ? "Este Mes" : timeRange === "year" ? "Este Año" : "Total"
      });

      setLoading(false);
    } catch (error) {
      console.error("Error loading inventory report:", error);
      setLoading(false);
    }
  };

  const exportReport = () => {
    if (!reportData) return;

    const csvContent = [
      ["REPORTE DE VALOR DE INVENTARIO"],
      [`Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`],
      [""],
      ["RESUMEN GENERAL"],
      ["Valor Total del Inventario (Costo)", `$${reportData.totalInventoryValue.toFixed(2)}`],
      ["Valor Total del Inventario (Venta)", `$${reportData.totalRetailValue.toFixed(2)}`],
      ["Total de Productos", reportData.totalProducts],
      ["Total de Unidades", reportData.totalUnits],
      [""],
      [`VENTAS - ${reportData.periodLabel}`],
      ["Ingresos", `$${reportData.revenue.toFixed(2)}`],
      ["Costo de Mercancía Vendida", `$${reportData.cogs.toFixed(2)}`],
      ["Ganancia Bruta", `$${reportData.grossProfit.toFixed(2)}`],
      ["Margen Bruto", `${reportData.grossMargin.toFixed(2)}%`],
      [""],
      ["ALERTAS"],
      ["Productos con Bajo Stock", reportData.lowStockProducts],
      ["Productos Agotados", reportData.outOfStockProducts]
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `inventory-report-${Date.now()}.csv`;
    link.click();
  };

  const categoryLabels = {
    screen: "Pantallas",
    battery: "Baterías",
    charger: "Cargadores",
    cable: "Cables",
    case: "Fundas",
    other: "Otros"
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-5xl bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
          <div className="py-12 flex items-center justify-center">
            <div className="animate-spin w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-red-600" />
              Reporte de Valor de Inventario
            </DialogTitle>
            <div className="flex gap-2">
              {["month", "year", "all"].map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1 rounded-lg text-sm transition ${
                    timeRange === range
                      ? "bg-red-600 text-white"
                      : "bg-black/40 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {range === "month" && "Mes"}
                  {range === "year" && "Año"}
                  {range === "all" && "Todo"}
                </button>
              ))}
              <button
                onClick={exportReport}
                className="px-3 py-1 rounded-lg text-sm bg-green-600 hover:bg-green-700 text-white flex items-center gap-1"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
            </div>
          </div>
        </DialogHeader>

        {reportData && (
          <div className="space-y-6">
            {/* KPIs Principales */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Valor Inventario (Costo)</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        ${reportData.totalInventoryValue.toFixed(2)}
                      </p>
                    </div>
                    <DollarSign className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Valor Inventario (Venta)</p>
                      <p className="text-2xl font-bold text-green-400 mt-1">
                        ${reportData.totalRetailValue.toFixed(2)}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Total Productos</p>
                      <p className="text-2xl font-bold text-white mt-1">
                        {reportData.totalProducts}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {reportData.totalUnits} unidades
                      </p>
                    </div>
                    <Package className="w-8 h-8 text-purple-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-gray-400">Margen Bruto</p>
                      <p className="text-2xl font-bold text-yellow-400 mt-1">
                        {reportData.grossMargin.toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {reportData.periodLabel}
                      </p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-yellow-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Ventas del Período */}
            <Card className="bg-black/40 border-white/10">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-red-600" />
                  Análisis de Ventas - {reportData.periodLabel}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-green-600/10 rounded-lg border border-green-600/30">
                    <p className="text-xs text-green-300 mb-1">Ingresos</p>
                    <p className="text-2xl font-bold text-green-400">
                      ${reportData.revenue.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-red-600/10 rounded-lg border border-red-600/30">
                    <p className="text-xs text-red-300 mb-1">COGS</p>
                    <p className="text-2xl font-bold text-red-400">
                      ${reportData.cogs.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-600/10 rounded-lg border border-blue-600/30">
                    <p className="text-xs text-blue-300 mb-1">Ganancia Bruta</p>
                    <p className="text-2xl font-bold text-blue-400">
                      ${reportData.grossProfit.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-600/10 rounded-lg border border-purple-600/30">
                    <p className="text-xs text-purple-300 mb-1">Margen</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {reportData.grossMargin.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Por Categoría */}
              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-white mb-4">Inventario por Categoría</h3>
                  <div className="space-y-3">
                    {Object.entries(reportData.categoryBreakdown).map(([category, data]) => (
                      <div key={category} className="flex items-center justify-between p-3 bg-black/40 rounded-lg">
                        <div>
                          <p className="text-white font-medium">
                            {categoryLabels[category] || category}
                          </p>
                          <p className="text-xs text-gray-400">
                            {data.count} productos • {data.items} unidades
                          </p>
                        </div>
                        <p className="text-lg font-bold text-white">
                          ${data.value.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Productos Más Vendidos */}
              <Card className="bg-black/40 border-white/10">
                <CardContent className="pt-6">
                  <h3 className="font-semibold text-white mb-4">Top 5 Productos - {reportData.periodLabel}</h3>
                  <div className="space-y-3">
                    {reportData.topProducts.map((product, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-black/40 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className="bg-red-600">{idx + 1}</Badge>
                          <div>
                            <p className="text-white font-medium">{product.name}</p>
                            <p className="text-xs text-gray-400">
                              {product.quantity} unidades vendidas
                            </p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-green-400">
                          ${product.revenue.toFixed(2)}
                        </p>
                      </div>
                    ))}
                    {reportData.topProducts.length === 0 && (
                      <p className="text-center text-gray-400 py-4">
                        No hay ventas en este período
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alertas */}
            <Card className="bg-black/40 border-red-900/30">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-orange-600" />
                  Alertas de Inventario
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-yellow-600/10 rounded-lg border border-yellow-600/30">
                    <p className="text-sm text-yellow-300 mb-1">Productos con Bajo Stock</p>
                    <p className="text-3xl font-bold text-yellow-400">
                      {reportData.lowStockProducts}
                    </p>
                  </div>
                  <div className="p-4 bg-red-600/10 rounded-lg border border-red-600/30">
                    <p className="text-sm text-red-300 mb-1">Productos Agotados</p>
                    <p className="text-3xl font-bold text-red-400">
                      {reportData.outOfStockProducts}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
