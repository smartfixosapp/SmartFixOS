import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download, Calendar, DollarSign, Package, Users, ClipboardList,
  TrendingUp, FileText, RefreshCw, Wallet, BarChart3, Sparkles,
  ShoppingCart, Clock, AlertCircle, CheckCircle, XCircle, ArrowUpRight, X } from
"lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import TransactionsModal from "../components/financial/TransactionsModal";
import TicketAnalysisModal from "../components/financial/TicketAnalysisModal";
import TaxBreakdownModal from "../components/financial/TaxBreakdownModal";
import TransactionCountModal from "../components/financial/TransactionCountModal";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

const MetricCard = ({ title, value, subtitle, icon: Icon, trend, color = "cyan", onClick }) => {
  const colorClasses = {
    cyan: "from-cyan-600/20 to-cyan-800/20 border-cyan-500/30 text-cyan-400 theme-light:from-cyan-100 theme-light:to-cyan-200 theme-light:border-cyan-300 theme-light:text-cyan-600",
    blue: "from-blue-600/20 to-blue-800/20 border-blue-500/30 text-blue-400 theme-light:from-blue-100 theme-light:to-blue-200 theme-light:border-blue-300 theme-light:text-blue-600",
    emerald: "from-emerald-600/20 to-emerald-800/20 border-emerald-500/30 text-emerald-400 theme-light:from-emerald-100 theme-light:to-emerald-200 theme-light:border-emerald-300 theme-light:text-emerald-600",
    purple: "from-purple-600/20 to-purple-800/20 border-purple-500/30 text-purple-400 theme-light:from-purple-100 theme-light:to-purple-200 theme-light:border-purple-300 theme-light:text-purple-600",
    amber: "from-amber-600/20 to-amber-800/20 border-amber-500/30 text-amber-400 theme-light:from-amber-100 theme-light:to-amber-200 theme-light:border-amber-300 theme-light:text-amber-600",
    red: "from-red-600/20 to-red-800/20 border-red-500/30 text-red-400 theme-light:from-red-100 theme-light:to-red-200 theme-light:border-red-300 theme-light:text-red-600"
  };

  const getTextColorClass = (colorKey) => {
    const classes = colorClasses[colorKey] || colorClasses.cyan; // Default to cyan if key not found
    const match = classes.match(/(text-\w+-\d+)(?:\s|$)/);
    const lightMatch = classes.match(/(theme-light:text-\w+-\d+)(?:\s|$)/);
    return `${match ? match[1] : ''} ${lightMatch ? lightMatch[1] : ''}`.trim();
  };


  return (
    <div 
      onClick={onClick}
      className={`bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,168,232,0.2)] hover:border-cyan-500/50 transition-all group theme-light:bg-white theme-light:border-gray-200 theme-light:hover:border-cyan-500/50 ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]} border backdrop-blur-sm group-hover:scale-110 transition-transform`}>
          <Icon className={`w-6 h-6 ${getTextColorClass(color)}`} />
        </div>
        {trend &&
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
        trend > 0 ? 'bg-emerald-600/20 text-emerald-400 theme-light:bg-emerald-100 theme-light:text-emerald-700' : 'bg-red-600/20 text-red-400 theme-light:bg-red-100 theme-light:text-red-700'}`
        }>
            <ArrowUpRight className={`w-3 h-3 ${trend < 0 ? 'rotate-90' : ''}`} />
            {Math.abs(trend)}%
          </div>
        }
      </div>
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 theme-light:text-gray-600">{title}</p>
        <p className="text-3xl font-bold text-white mb-1 theme-light:text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-500 theme-light:text-gray-600">{subtitle}</p>}
      </div>
    </div>);

};

export default function Reports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("sales");

  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));

  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showCountModal, setShowCountModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    const loadingToast = toast.loading("Cargando reportes...");

    try {
      const [salesData, ordersData, productsData, timeData, transactionsData] = await Promise.allSettled([
      base44.entities.Sale.list("-created_date", 200).catch(() => []),
      base44.entities.Order.list("-created_date", 200).catch(() => []),
      base44.entities.Product.list("-created_date", 100).catch(() => []),
      base44.entities.TimeEntry.list("-created_date", 200).catch(() => []),
      base44.entities.Transaction.list("-created_date", 200).catch(() => [])]
      );

      setSales(salesData.status === "fulfilled" ? salesData.value || [] : []);
      setOrders(ordersData.status === "fulfilled" ? ordersData.value || [] : []);
      setProducts(productsData.status === "fulfilled" ? productsData.value || [] : []);
      setTimeEntries(timeData.status === "fulfilled" ? timeData.value || [] : []);
      setTransactions(transactionsData.status === "fulfilled" ? transactionsData.value || [] : []);

      toast.success("✅ Reportes cargados", { id: loadingToast });
    } catch (error) {
      console.error("Error loading reports:", error);
      toast.error("Error al cargar datos", { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const filterByDateRange = (items, dateField = 'created_date') => {
    return items.filter((item) => {
      try {
        const itemDate = new Date(item[dateField]);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        return itemDate >= start && itemDate <= end;
      } catch {
        return false;
      }
    });
  };

  const filteredSales = useMemo(() => filterByDateRange(sales.filter((s) => !s.voided)), [sales, startDate, endDate]);
  const filteredOrders = useMemo(() => filterByDateRange(orders), [orders, startDate, endDate]);
  const filteredTimeEntries = useMemo(() => filterByDateRange(timeEntries, 'clock_in'), [timeEntries, startDate, endDate]);

  const salesAnalysis = useMemo(() => {
    const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalTransactions = filteredSales.length;
    const avgTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    const productSales = {};
    const serviceSales = {};

    filteredSales.forEach((sale) => {
      (sale.items || []).forEach((item) => {
        if (item.type === 'product') {
          if (!productSales[item.name]) {
            productSales[item.name] = { name: item.name, quantity: 0, revenue: 0 };
          }
          productSales[item.name].quantity += item.quantity || 0;
          productSales[item.name].revenue += (item.price || 0) * (item.quantity || 0);
        } else {
          if (!serviceSales[item.name]) {
            serviceSales[item.name] = { name: item.name, count: 0, revenue: 0 };
          }
          serviceSales[item.name].count += 1;
          serviceSales[item.name].revenue += (item.price || 0) * (item.quantity || 1);
        }
      });
    });

    const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    const topServices = Object.values(serviceSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    const paymentMethods = filteredSales.reduce((acc, s) => {
      const method = s.payment_method || 'cash';
      acc[method] = (acc[method] || 0) + (s.total || 0);
      return acc;
    }, {});

    return { totalRevenue, totalTransactions, avgTicket, topProducts, topServices, paymentMethods };
  }, [filteredSales]);

  const ordersAnalysis = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const completedOrders = filteredOrders.filter((o) => o.status === 'completed' || o.status === 'picked_up').length;
    const activeOrders = filteredOrders.filter((o) => !['completed', 'picked_up', 'cancelled'].includes(o.status)).length;
    const cancelledOrders = filteredOrders.filter((o) => o.status === 'cancelled').length;

    const avgRepairValue = filteredOrders.length > 0 ?
    filteredOrders.reduce((sum, o) => sum + (o.cost_estimate || 0), 0) / filteredOrders.length :
    0;

    const deviceTypes = filteredOrders.reduce((acc, o) => {
      const type = o.device_type || 'Unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    const statusBreakdown = filteredOrders.reduce((acc, o) => {
      const status = o.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      totalOrders, completedOrders, activeOrders, cancelledOrders,
      completionRate: totalOrders > 0 ? completedOrders / totalOrders * 100 : 0,
      avgRepairValue, deviceTypes, statusBreakdown
    };
  }, [filteredOrders]);

  const inventoryAnalysis = useMemo(() => {
    const totalProducts = products.length;
    const totalValue = products.reduce((sum, p) => sum + (p.stock || 0) * (p.cost || 0), 0);
    const lowStock = products.filter((p) => (p.stock || 0) <= (p.min_stock || 5)).length;
    const outOfStock = products.filter((p) => (p.stock || 0) === 0).length;

    const categoryBreakdown = products.reduce((acc, p) => {
      const cat = p.category || 'other';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    return { totalProducts, totalValue, lowStock, outOfStock, categoryBreakdown };
  }, [products]);

  const timeAnalysis = useMemo(() => {
    const totalHours = filteredTimeEntries.reduce((sum, entry) => {
      if (entry.clock_out) {
        const hours = (new Date(entry.clock_out) - new Date(entry.clock_in)) / (1000 * 60 * 60);
        return sum + hours;
      }
      return sum;
    }, 0);

    const employeeHours = filteredTimeEntries.reduce((acc, entry) => {
      const name = entry.employee_name || 'Unknown';
      if (entry.clock_out) {
        const hours = (new Date(entry.clock_out) - new Date(entry.clock_in)) / (1000 * 60 * 60);
        acc[name] = (acc[name] || 0) + hours;
      }
      return acc;
    }, {});

    return { totalHours, totalEntries: filteredTimeEntries.length, employeeHours };
  }, [filteredTimeEntries]);

  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error("No hay datos para exportar");
      return;
    }

    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) =>
    Object.values(row).map((val) =>
    typeof val === 'string' && val.includes(',') ? `"${val}"` : val
    ).join(",")
    );

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("✅ Reporte exportado");
  };

  const exportSalesReport = () => {
    const data = filteredSales.map((s) => ({
      fecha: format(new Date(s.created_date), "yyyy-MM-dd HH:mm"),
      numero_venta: s.sale_number,
      cliente: s.customer_name,
      subtotal: s.subtotal,
      impuestos: s.tax_amount,
      total: s.total,
      metodo_pago: s.payment_method,
      empleado: s.employee
    }));
    exportToCSV(data, "ventas");
  };

  const exportOrdersReport = () => {
    const data = filteredOrders.map((o) => ({
      fecha: format(new Date(o.created_date), "yyyy-MM-dd"),
      numero_orden: o.order_number,
      cliente: o.customer_name,
      telefono: o.customer_phone,
      dispositivo: `${o.device_brand || ''} ${o.device_model || ''}`,
      problema: o.initial_problem,
      estado: o.status,
      estimado: o.cost_estimate,
      pagado: o.amount_paid
    }));
    exportToCSV(data, "ordenes");
  };

  const exportInventoryReport = () => {
    const data = products.map((p) => ({
      nombre: p.name,
      sku: p.sku,
      categoria: p.category,
      precio: p.price,
      costo: p.cost,
      stock: p.stock,
      activo: p.active ? "Sí" : "No"
    }));
    exportToCSV(data, "inventario");
  };

  const exportTimeReport = () => {
    const data = filteredTimeEntries.map((t) => ({
      fecha: format(new Date(t.clock_in), "yyyy-MM-dd"),
      empleado: t.employee_name,
      entrada: t.clock_in ? format(new Date(t.clock_in), "HH:mm") : "N/A",
      salida: t.clock_out ? format(new Date(t.clock_out), "HH:mm") : "Activo",
      horas: t.clock_out ? ((new Date(t.clock_out) - new Date(t.clock_in)) / (1000 * 60 * 60)).toFixed(2) : "N/A"
    }));
    exportToCSV(data, "ponches");
  };

  const setDateRange = (range) => {
    const today = new Date();
    switch (range) {
      case "today":
        setStartDate(format(today, "yyyy-MM-dd"));
        setEndDate(format(today, "yyyy-MM-dd"));
        break;
      case "week":
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - 7);
        setStartDate(format(weekStart, "yyyy-MM-dd"));
        setEndDate(format(today, "yyyy-MM-dd"));
        break;
      case "month":
        setStartDate(format(startOfMonth(today), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(today), "yyyy-MM-dd"));
        break;
      case "last_month":
        const lastMonth = subMonths(today, 1);
        setStartDate(format(startOfMonth(lastMonth), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(lastMonth), "yyyy-MM-dd"));
        break;
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] theme-light:bg-gray-50 p-4 sm:p-6">
      <div className="max-w-[1920px] mx-auto space-y-6">
        {/* Hero Header con colores del logo */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-emerald-600/20 to-lime-600/20 blur-3xl opacity-30"></div>
          <div className="relative bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-3xl p-8 shadow-[0_16px_64px_rgba(0,168,232,0.5)] theme-light:bg-white theme-light:border-gray-200 theme-light:shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-4xl sm:text-5xl font-bold text-white flex items-center gap-4 mb-2 theme-light:text-gray-900">
                  <div className="relative">
                    <div className="absolute inset-0 bg-cyan-600 blur-2xl opacity-50"></div>
                    <BarChart3 className="relative w-12 h-12 text-cyan-500" />
                  </div>
                  Reportes y Análisis
                </h1>
                <p className="text-gray-400 text-lg theme-light:text-gray-600">Inteligencia de negocio en tiempo real</p>
              </div>
              <div className="flex items-center gap-3">
                <Button onClick={loadData} disabled={loading} className="bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800 shadow-[0_8px_32px_rgba(0,168,232,0.5)]">
                  <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
                <Button
                  onClick={() => navigate(createPageUrl("UsersManagement"))}
                  size="icon"
                  variant="ghost"
                  className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-600/10 theme-light:text-cyan-600"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Date Filters Glass con mejor espaciado y separación */}
        <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200 theme-light:shadow-md">
          <div className="space-y-8">
            {/* Inputs de fecha con más espacio vertical */}
            <div className="space-y-5">
              <h3 className="text-white text-base font-semibold mb-4 theme-light:text-gray-900">Seleccionar Rango de Fechas</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-gray-300 text-sm block font-medium theme-light:text-gray-700">
                    Fecha Inicio
                  </label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-black/40 border-cyan-500/20 text-white h-12 w-full theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900" />

                </div>
                <div className="space-y-2">
                  <label className="text-gray-300 text-sm block font-medium theme-light:text-gray-700">
                    Fecha Fin
                  </label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-black/40 border-cyan-500/20 text-white h-12 w-full theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900" />

                </div>
              </div>
            </div>
            
            {/* Separador visual */}
            <div className="border-t border-cyan-500/10 theme-light:border-gray-200"></div>
            
            {/* Botones de atajos */}
            <div className="space-y-3">
              <label className="text-gray-300 text-sm block font-medium theme-light:text-gray-700">
                Rangos rápidos
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Button
                  onClick={() => setDateRange("today")}
                  variant="outline" className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground border-cyan-500/20 hover:bg-cyan-600/10 h-11 theme-light:border-gray-300 theme-light:text-gray-700 theme-light:hover:bg-gray-50">

                  Hoy
                </Button>
                <Button
                  onClick={() => setDateRange("week")}
                  variant="outline" className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground border-cyan-500/20 hover:bg-cyan-600/10 h-11 theme-light:border-gray-300 theme-light:text-gray-700 theme-light:hover:bg-gray-50">

                  7 días
                </Button>
                <Button
                  onClick={() => setDateRange("month")}
                  variant="outline" className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground border-cyan-500/20 hover:bg-cyan-600/10 h-11 theme-light:border-gray-300 theme-light:text-gray-700 theme-light:hover:bg-gray-50">

                  Este mes
                </Button>
                <Button
                  onClick={() => setDateRange("last_month")}
                  variant="outline" className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground border-cyan-500/20 hover:bg-cyan-600/10 h-11 theme-light:border-gray-300 theme-light:text-gray-700 theme-light:hover:bg-gray-50">

                  Mes pasado
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs con colores del logo */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="bg-black/40 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-2 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200 theme-light:shadow-md">
            <TabsList className="bg-transparent gap-2 w-full justify-start overflow-x-auto">
              <TabsTrigger value="sales" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-emerald-600 data-[state=active]:to-emerald-800 data-[state=active]:text-white rounded-xl flex items-center gap-2">
                <DollarSign className="w-4 h-4" />Ventas
              </TabsTrigger>
              <TabsTrigger value="orders" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-blue-600 data-[state=active]:text-white rounded-xl flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />Órdenes
              </TabsTrigger>
              <TabsTrigger value="inventory" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-teal-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white rounded-xl flex items-center gap-2">
                <Package className="w-4 h-4" />Inventario
              </TabsTrigger>
              <TabsTrigger value="time" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-lime-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white rounded-xl flex items-center gap-2">
                <Clock className="w-4 h-4" />Tiempo
              </TabsTrigger>
            </TabsList>
          </div>

          {/* SALES TAB */}
          <TabsContent value="sales" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard 
                title="Ingresos Totales" 
                value={`$${salesAnalysis.totalRevenue.toFixed(2)}`} 
                subtitle={`${salesAnalysis.totalTransactions} transacciones`} 
                icon={DollarSign} 
                color="emerald"
                onClick={() => setShowTransactionsModal(true)}
              />
              <MetricCard 
                title="Ticket Promedio" 
                value={`$${salesAnalysis.avgTicket.toFixed(2)}`} 
                subtitle="Por transacción" 
                icon={TrendingUp} 
                color="cyan"
                onClick={() => setShowTicketModal(true)}
              />
              <MetricCard 
                title="IVU Recaudado" 
                value={`$${(salesAnalysis.totalRevenue * 0.115).toFixed(2)}`} 
                subtitle="11.5% de ventas" 
                icon={FileText} 
                color="purple"
                onClick={() => setShowTaxModal(true)}
              />
              <MetricCard 
                title="Transacciones" 
                value={salesAnalysis.totalTransactions} 
                subtitle="Ventas completadas" 
                icon={ShoppingCart} 
                color="amber"
                onClick={() => setShowCountModal(true)}
              />
            </div>

            <div className="flex gap-3">
              <Button onClick={exportSalesReport} className="bg-gradient-to-r from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900 shadow-[0_4px_20px_rgba(16,185,129,0.4)]">
                <Download className="w-4 h-4 mr-2" />Exportar Ventas (CSV)
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
                    <Package className="w-5 h-5 text-emerald-500" />
                    Top 10 Productos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {salesAnalysis.topProducts.map((product, i) =>
                    <div key={i} className="flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-emerald-600/50 transition-all group theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:hover:border-emerald-500/50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform theme-light:bg-emerald-100 theme-light:border-emerald-300">
                            <span className="text-white font-bold text-sm theme-light:text-emerald-700">#{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate theme-light:text-gray-900">{product.name}</p>
                            <p className="text-xs text-gray-400 theme-light:text-gray-600">{product.quantity} unidades</p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-600/30 ml-3 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300">
                          ${product.revenue.toFixed(2)}
                        </Badge>
                      </div>
                    )}
                    {salesAnalysis.topProducts.length === 0 &&
                    <div className="text-center py-12 text-gray-500 theme-light:text-gray-600">
                        <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No hay datos</p>
                      </div>
                    }
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
                    <Sparkles className="w-5 h-5 text-cyan-500" />
                    Top 10 Servicios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {salesAnalysis.topServices.map((service, i) =>
                    <div key={i} className="flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-cyan-600/50 transition-all group theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:hover:border-cyan-500/50">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center group-hover:scale-110 transition-transform theme-light:bg-cyan-100 theme-light:border-cyan-300">
                            <span className="text-white font-bold text-sm theme-light:text-cyan-700">#{i + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate theme-light:text-gray-900">{service.name}</p>
                            <p className="text-xs text-gray-400 theme-light:text-gray-600">{service.count} servicios</p>
                          </div>
                        </div>
                        <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-600/30 ml-3 theme-light:bg-cyan-100 theme-light:text-cyan-700 theme-light:border-cyan-300">
                          ${service.revenue.toFixed(2)}
                        </Badge>
                      </div>
                    )}
                    {salesAnalysis.topServices.length === 0 &&
                    <div className="text-center py-12 text-gray-500 theme-light:text-gray-600">
                        <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No hay datos</p>
                      </div>
                    }
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
                  <Wallet className="w-5 h-5 text-emerald-500" />
                  Ingresos por Método de Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {Object.entries(salesAnalysis.paymentMethods).map(([method, amount]) =>
                  <div key={method} className="bg-black/30 backdrop-blur-sm border border-cyan-500/10 rounded-xl p-4 hover:border-emerald-600/50 transition-all theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:hover:border-emerald-500/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className={`w-5 h-5 ${
                      method === 'cash' ? 'text-emerald-400 theme-light:text-emerald-600' :
                      method === 'card' ? 'text-cyan-400 theme-light:text-cyan-600' :
                      method === 'ath_movil' ? 'text-lime-400 theme-light:text-lime-600' : 'text-amber-400 theme-light:text-amber-600'}`
                      } />
                        <span className="text-white font-medium capitalize theme-light:text-gray-900">
                          {method === 'cash' ? 'Efectivo' :
                        method === 'card' ? 'Tarjeta' :
                        method === 'ath_movil' ? 'ATH Móvil' : 'Mixto'}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-white theme-light:text-gray-900">${amount.toFixed(2)}</p>
                    </div>
                  )}
                  {Object.keys(salesAnalysis.paymentMethods).length === 0 &&
                  <div className="col-span-4 text-center py-8 text-gray-500 theme-light:text-gray-600">No hay datos</div>
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ORDERS TAB */}
          <TabsContent value="orders" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Órdenes" value={ordersAnalysis.totalOrders} subtitle={`${ordersAnalysis.activeOrders} activas`} icon={ClipboardList} color="cyan" />
              <MetricCard title="Completadas" value={ordersAnalysis.completedOrders} subtitle={`${ordersAnalysis.completionRate.toFixed(1)}% tasa`} icon={CheckCircle} color="emerald" />
              <MetricCard title="Valor Promedio" value={`$${ordersAnalysis.avgRepairValue.toFixed(2)}`} subtitle="Por orden" icon={DollarSign} color="purple" />
              <MetricCard title="Canceladas" value={ordersAnalysis.cancelledOrders} subtitle={`${(ordersAnalysis.cancelledOrders / Math.max(ordersAnalysis.totalOrders, 1) * 100).toFixed(1)}%`} icon={XCircle} color="red" />
            </div>

            <Button onClick={exportOrdersReport} className="bg-gradient-to-r from-cyan-600 to-emerald-700 hover:from-cyan-700 hover:to-emerald-800 shadow-[0_4px_20px_rgba(0,168,232,0.4)]">
              <Download className="w-4 h-4 mr-2" />Exportar Órdenes (CSV)
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
                    <Package className="w-5 h-5 text-cyan-500" />
                    Por Tipo de Dispositivo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(ordersAnalysis.deviceTypes).sort(([, a], [, b]) => b - a).map(([type, count]) =>
                    <div key={type} className="flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-cyan-600/50 transition-all theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:hover:border-cyan-500/50">
                        <span className="text-white font-medium capitalize theme-light:text-gray-900">{type}</span>
                        <Badge className="bg-cyan-600/20 text-cyan-300 border-cyan-600/30 theme-light:bg-cyan-100 theme-light:text-cyan-700 theme-light:border-cyan-300">{count}</Badge>
                      </div>
                    )}
                    {Object.keys(ordersAnalysis.deviceTypes).length === 0 &&
                    <div className="text-center py-8 text-gray-500 theme-light:text-gray-600">No hay datos</div>
                    }
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
                    <BarChart3 className="w-5 h-5 text-emerald-500" />
                    Por Estado
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(ordersAnalysis.statusBreakdown).sort(([, a], [, b]) => b - a).map(([status, count]) =>
                    <div key={status} className="flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-emerald-600/50 transition-all theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:hover:border-emerald-500/50">
                        <span className="text-white font-medium capitalize theme-light:text-gray-900">{status.replace(/_/g, ' ')}</span>
                        <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-600/30 theme-light:bg-emerald-100 theme-light:text-emerald-700 theme-light:border-emerald-300">{count}</Badge>
                      </div>
                    )}
                    {Object.keys(ordersAnalysis.statusBreakdown).length === 0 &&
                    <div className="text-center py-8 text-gray-500 theme-light:text-gray-600">No hay datos</div>
                    }
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* INVENTORY TAB */}
          <TabsContent value="inventory" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard title="Total Productos" value={inventoryAnalysis.totalProducts} subtitle="En catálogo" icon={Package} color="cyan" />
              <MetricCard title="Valor Total" value={`$${inventoryAnalysis.totalValue.toFixed(2)}`} subtitle="Costo inventario" icon={DollarSign} color="emerald" />
              <MetricCard title="Stock Bajo" value={inventoryAnalysis.lowStock} subtitle="Requieren reorden" icon={AlertCircle} color="amber" />
              <MetricCard title="Agotados" value={inventoryAnalysis.outOfStock} subtitle="Sin stock" icon={XCircle} color="red" />
            </div>

            <Button onClick={exportInventoryReport} className="bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800 shadow-[0_4px_20px_rgba(20,184,166,0.4)]">
              <Download className="w-4 h-4 mr-2" />Exportar Inventario (CSV)
            </Button>

            <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
                  <BarChart3 className="w-5 h-5 text-teal-500" />
                  Productos por Categoría
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(inventoryAnalysis.categoryBreakdown).sort(([, a], [, b]) => b - a).map(([category, count]) =>
                  <div key={category} className="flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-teal-600/50 transition-all theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:hover:border-teal-500/50">
                      <p className="text-white font-medium capitalize mb-2 theme-light:text-gray-900">{category.replace(/_/g, ' ')}</p>
                      <div className="flex items-center justify-between">
                        <Badge className="bg-teal-600/20 text-teal-300 border-teal-600/30 theme-light:bg-teal-100 theme-light:text-teal-700 theme-light:border-teal-300">{count} productos</Badge>
                      </div>
                    </div>
                  )}
                  {Object.keys(inventoryAnalysis.categoryBreakdown).length === 0 &&
                  <div className="col-span-2 text-center py-8 text-gray-500 theme-light:text-gray-600">No hay productos</div>
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TIME TAB */}
          <TabsContent value="time" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard title="Total Horas" value={timeAnalysis.totalHours.toFixed(1)} subtitle={`${timeAnalysis.totalEntries} entradas`} icon={Clock} color="amber" />
              <MetricCard title="Promedio/Empleado" value={(timeAnalysis.totalHours / Math.max(Object.keys(timeAnalysis.employeeHours).length, 1)).toFixed(1)} subtitle="Horas por empleado" icon={TrendingUp} color="cyan" />
              <MetricCard title="Empleados" value={Object.keys(timeAnalysis.employeeHours).length} subtitle="Con registros" icon={Users} color="emerald" />
            </div>

            <Button onClick={exportTimeReport} className="bg-gradient-to-r from-lime-600 to-emerald-700 hover:from-lime-700 hover:to-emerald-800 shadow-[0_4px_20px_rgba(168,215,0,0.4)]">
              <Download className="w-4 h-4 mr-2" />Exportar Ponches (CSV)
            </Button>

            <Card className="bg-black/40 backdrop-blur-xl border-cyan-500/20 shadow-[0_8px_32px_rgba(0,168,232,0.2)] theme-light:bg-white theme-light:border-gray-200">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
                  <Users className="w-5 h-5 text-lime-500" />
                  Horas por Empleado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(timeAnalysis.employeeHours).sort(([, a], [, b]) => b - a).map(([name, hours]) =>
                  <div key={name} className="flex items-center justify-between p-4 bg-black/30 backdrop-blur-sm border border-cyan-500/10 rounded-xl hover:border-lime-600/50 transition-all theme-light:bg-gray-50 theme-light:border-gray-200 theme-light:hover:border-lime-500/50">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-lime-600/20 border border-lime-500/30 flex items-center justify-center theme-light:bg-lime-100 theme-light:border-lime-300">
                          <Users className="w-5 h-5 text-lime-400 theme-light:text-lime-600" />
                        </div>
                        <span className="text-white font-medium theme-light:text-gray-900">{name}</span>
                      </div>
                      <Badge className="bg-lime-600/20 text-lime-300 border-lime-600/30 theme-light:bg-lime-100 theme-light:text-lime-700 theme-light:border-lime-300">
                        {hours.toFixed(1)} hrs
                      </Badge>
                    </div>
                  )}
                  {Object.keys(timeAnalysis.employeeHours).length === 0 &&
                  <div className="text-center py-12 text-gray-500 theme-light:text-gray-600">
                      <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>No hay datos</p>
                    </div>
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <TransactionsModal 
        open={showTransactionsModal} 
        onClose={() => setShowTransactionsModal(false)}
        sales={filteredSales}
        title="Detalles de Transacciones"
      />

      <TicketAnalysisModal
        open={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        sales={filteredSales}
      />

      <TaxBreakdownModal
        open={showTaxModal}
        onClose={() => setShowTaxModal(false)}
        sales={filteredSales}
      />

      <TransactionCountModal
        open={showCountModal}
        onClose={() => setShowCountModal(false)}
        sales={filteredSales}
      />
    </div>);

}
