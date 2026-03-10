import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  FileText,
  Download,
  Filter,
  TrendingUp,
  Package,
  Users,
  DollarSign,
  BarChart3
} from "lucide-react";
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import ExportService from "./ExportService";

const REPORT_TYPES = [
  {
    id: "sales",
    label: "Ventas",
    icon: DollarSign,
    color: "text-green-500",
    bgColor: "bg-green-600/20",
    description: "Análisis de ventas y transacciones"
  },
  {
    id: "inventory",
    label: "Inventario",
    icon: Package,
    color: "text-blue-500",
    bgColor: "bg-blue-600/20",
    description: "Estado del inventario y movimientos"
  },
  {
    id: "customers",
    label: "Clientes",
    icon: Users,
    color: "text-purple-500",
    bgColor: "bg-purple-600/20",
    description: "Actividad y análisis de clientes"
  }
];

const DATE_RANGES = [
  { id: "today", label: "Hoy" },
  { id: "yesterday", label: "Ayer" },
  { id: "week", label: "Últimos 7 días" },
  { id: "month", label: "Últimos 30 días" },
  { id: "custom", label: "Personalizado" }
];

export default function ReportGenerator() {
  const [selectedReport, setSelectedReport] = useState("sales");
  const [dateRange, setDateRange] = useState("week");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const [filters, setFilters] = useState({
    category: "all",
    customerStatus: "all",
    paymentMethod: "all"
  });
  
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Categorías dinámicas
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadCategories();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      await base44.auth.me();
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
    }
  };

  const loadCategories = async () => {
    try {
      const products = await base44.entities.Product.list();
      const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const getDateRangeFilter = () => {
    const now = new Date();
    
    switch (dateRange) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case "week":
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      case "month":
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case "custom":
        if (customDateFrom && customDateTo) {
          return {
            start: startOfDay(new Date(customDateFrom)),
            end: endOfDay(new Date(customDateTo))
          };
        }
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
      default:
        return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    }
  };

  const generateReport = async () => {
    if (!isAuthenticated) {
      alert("Debe iniciar sesión para generar reportes");
      return;
    }

    setLoading(true);
    
    try {
      const { start, end } = getDateRangeFilter();
      
      if (selectedReport === "sales") {
        await generateSalesReport(start, end);
      } else if (selectedReport === "inventory") {
        await generateInventoryReport();
      } else if (selectedReport === "customers") {
        await generateCustomerReport(start, end);
      }
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Error al generar el reporte: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const generateSalesReport = async (start, end) => {
    const sales = await base44.entities.Sale.list("-created_date", 1000);
    
    const filtered = sales.filter(sale => {
      const saleDate = new Date(sale.created_date);
      const inRange = isWithinInterval(saleDate, { start, end });
      const matchesPayment = filters.paymentMethod === "all" || sale.payment_method === filters.paymentMethod;
      return inRange && matchesPayment && !sale.voided;
    });

    const total = filtered.reduce((sum, s) => sum + (s.total || 0), 0);
    const tax = filtered.reduce((sum, s) => sum + (s.tax_amount || 0), 0);
    const avgSale = filtered.length > 0 ? total / filtered.length : 0;

    setReportData({
      type: "sales",
      data: filtered,
      summary: {
        total: filtered.length,
        revenue: total,
        tax,
        avgSale,
        dateRange: `${format(start, "dd/MM/yyyy")} - ${format(end, "dd/MM/yyyy")}`
      }
    });
  };

  const generateInventoryReport = async () => {
    const products = await base44.entities.Product.list();
    
    const filtered = products.filter(p => {
      const matchesCategory = filters.category === "all" || p.category === filters.category;
      return p.active && matchesCategory;
    });

    const totalValue = filtered.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost || 0)), 0);
    const lowStock = filtered.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length;
    const outOfStock = filtered.filter(p => (p.stock || 0) === 0).length;

    setReportData({
      type: "inventory",
      data: filtered,
      summary: {
        total: filtered.length,
        totalValue,
        lowStock,
        outOfStock,
        avgStock: filtered.reduce((sum, p) => sum + (p.stock || 0), 0) / filtered.length
      }
    });
  };

  const generateCustomerReport = async (start, end) => {
    const [customers, orders] = await Promise.all([
      base44.entities.Customer.list(),
      base44.entities.Order.list("-created_date", 1000)
    ]);

    const filteredOrders = orders.filter(o => {
      const orderDate = new Date(o.created_date);
      return isWithinInterval(orderDate, { start, end });
    });

    const customersWithActivity = customers.map(c => {
      const customerOrders = filteredOrders.filter(o => o.customer_id === c.id);
      const totalSpent = customerOrders.reduce((sum, o) => sum + (o.amount_paid || 0), 0);
      return {
        ...c,
        ordersInPeriod: customerOrders.length,
        totalSpent,
        status: customerOrders.length === 0 ? "inactive" : customerOrders.length >= 5 ? "vip" : "active"
      };
    });

    const filtered = customersWithActivity.filter(c => {
      const matchesStatus = filters.customerStatus === "all" || c.status === filters.customerStatus;
      return matchesStatus;
    });

    const totalRevenue = filtered.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalOrders = filtered.reduce((sum, c) => sum + c.ordersInPeriod, 0);

    setReportData({
      type: "customers",
      data: filtered,
      summary: {
        total: filtered.length,
        totalRevenue,
        totalOrders,
        avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
        dateRange: `${format(start, "dd/MM/yyyy")} - ${format(end, "dd/MM/yyyy")}`
      }
    });
  };

  const handleExport = (format) => {
    if (!reportData) {
      alert("Primero genere un reporte");
      return;
    }

    const { type, data, summary } = reportData;

    if (type === "sales") {
      ExportService.exportSalesReport(data, summary.dateRange, format);
    } else if (type === "inventory") {
      ExportService.exportInventoryReport(data, format);
    } else if (type === "customers") {
      const orders = []; // Ya calculado en el reporte
      ExportService.exportCustomerActivityReport(data, orders, format);
    }
  };

  if (!isAuthenticated) {
    return (
      <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <CardContent className="p-12 flex flex-col items-center justify-center">
          <FileText className="w-16 h-16 text-gray-600 mb-4" />
          <p className="text-gray-400 text-center">Debe iniciar sesión para acceder a los reportes</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selector de tipo de reporte */}
      <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-red-600" />
            Generador de Reportes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {REPORT_TYPES.map((report) => {
              const Icon = report.icon;
              const isSelected = selectedReport === report.id;
              
              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report.id)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-red-600 bg-red-600/10"
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${report.bgColor}`}>
                      <Icon className={`w-6 h-6 ${report.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white mb-1">{report.label}</h3>
                      <p className="text-xs text-gray-400">{report.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Filter className="w-5 h-5 text-red-600" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rango de fechas */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">Rango de Fechas</label>
            <div className="flex flex-wrap gap-2">
              {DATE_RANGES.map((range) => (
                <button
                  key={range.id}
                  onClick={() => setDateRange(range.id)}
                  className={`px-4 py-2 rounded-lg text-sm transition ${
                    dateRange === range.id
                      ? "bg-red-600 text-white"
                      : "bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {dateRange === "custom" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Fecha Desde</label>
                <input
                  type="date"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/15 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-2 block">Fecha Hasta</label>
                <input
                  type="date"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/15 text-white"
                />
              </div>
            </div>
          )}

          {/* Filtros específicos por tipo de reporte */}
          {selectedReport === "sales" && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Método de Pago</label>
              <select
                value={filters.paymentMethod}
                onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/15 text-white"
              >
                <option value="all">Todos</option>
                <option value="cash">Efectivo</option>
                <option value="card">Tarjeta</option>
                <option value="ath_movil">ATH Móvil</option>
                <option value="mixed">Mixto</option>
              </select>
            </div>
          )}

          {selectedReport === "inventory" && categories.length > 0 && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Categoría</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/15 text-white"
              >
                <option value="all">Todas</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          )}

          {selectedReport === "customers" && (
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Estado del Cliente</label>
              <select
                value={filters.customerStatus}
                onChange={(e) => setFilters({ ...filters, customerStatus: e.target.value })}
                className="w-full px-4 py-2 rounded-lg bg-black/40 border border-white/15 text-white"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="vip">VIP</option>
                <option value="inactive">Inactivos</option>
              </select>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              onClick={generateReport}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {loading ? "Generando..." : "Generar Reporte"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados del reporte */}
      {reportData && (
        <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-red-600" />
                Resultados
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleExport("csv")}
                  variant="outline"
                  className="border-white/15"
                >
                  <Download className="w-4 h-4 mr-2" />
                  CSV
                </Button>
                <Button
                  onClick={() => handleExport("pdf")}
                  variant="outline"
                  className="border-white/15"
                >
                  <Download className="w-4 h-4 mr-2" />
                  PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {reportData.type === "sales" && (
                <>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Total Ventas</p>
                    <p className="text-2xl font-bold text-white">{reportData.summary.total}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Ingresos</p>
                    <p className="text-2xl font-bold text-green-500">${reportData.summary.revenue.toFixed(2)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">IVU Recaudado</p>
                    <p className="text-2xl font-bold text-yellow-500">${reportData.summary.tax.toFixed(2)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Promedio por Venta</p>
                    <p className="text-2xl font-bold text-white">${reportData.summary.avgSale.toFixed(2)}</p>
                  </div>
                </>
              )}

              {reportData.type === "inventory" && (
                <>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Total Productos</p>
                    <p className="text-2xl font-bold text-white">{reportData.summary.total}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Valor Inventario</p>
                    <p className="text-2xl font-bold text-green-500">${reportData.summary.totalValue.toFixed(2)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Bajo Stock</p>
                    <p className="text-2xl font-bold text-orange-500">{reportData.summary.lowStock}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Agotados</p>
                    <p className="text-2xl font-bold text-red-500">{reportData.summary.outOfStock}</p>
                  </div>
                </>
              )}

              {reportData.type === "customers" && (
                <>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Total Clientes</p>
                    <p className="text-2xl font-bold text-white">{reportData.summary.total}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Total Órdenes</p>
                    <p className="text-2xl font-bold text-blue-500">{reportData.summary.totalOrders}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Ingresos</p>
                    <p className="text-2xl font-bold text-green-500">${reportData.summary.totalRevenue.toFixed(2)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                    <p className="text-xs text-gray-400 mb-1">Promedio/Orden</p>
                    <p className="text-2xl font-bold text-white">${reportData.summary.avgOrderValue.toFixed(2)}</p>
                  </div>
                </>
              )}
            </div>

            {/* Tabla de datos */}
            <div className="overflow-x-auto">
              <div className="text-sm text-gray-400 mb-2">
                Mostrando {reportData.data.length} registros
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
