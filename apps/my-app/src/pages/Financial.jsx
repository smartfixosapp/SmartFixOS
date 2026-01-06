import React, { useState, useEffect, useRef } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DollarSign, TrendingUp, TrendingDown, Wallet, Receipt,
  CreditCard, Landmark, RefreshCw, Plus, Target, PieChart,
  Edit2, Trash2, Save, Calendar, Download, Filter, X
} from "lucide-react";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import OpenDrawerDialog from "../components/cash/OpenDrawerDialog";
import CloseDrawerDialog from "../components/cash/CloseDrawerDialog";
import ExpenseDialog from "../components/financial/ExpenseDialog";
import AlertasWidget from "../components/financial/AlertasWidget";
import ReportesFinancieros from "../components/financial/ReportesFinancieros";
import EnhancedReports from "../components/financial/EnhancedReports";
import OneTimeExpensesWidget from "../components/financial/OneTimeExpensesWidget";
import { toast } from "sonner";
import TransactionsModal from "../components/financial/TransactionsModal";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";

const StatCard = ({ title, value, icon: Icon, color, onClick }) => (
  <Card 
    onClick={onClick}
    className={`bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-600/20 transition-all theme-light:bg-white theme-light:border-gray-200 ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}>
    <CardContent className="p-3 sm:p-4 lg:pt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0">
        <div className="flex-1 w-full">
          <p className="text-[10px] sm:text-xs lg:text-sm font-medium text-gray-400 uppercase tracking-wide theme-light:text-gray-600">{title}</p>
          <p className={`text-xl sm:text-2xl lg:text-3xl font-bold mt-1 sm:mt-2 ${
            color === 'green' ? 'text-emerald-400 theme-light:text-emerald-600' :
            color === 'red' ? 'text-red-400 theme-light:text-red-600' :
            color === 'blue' ? 'text-cyan-400 theme-light:text-cyan-600' : 'text-white theme-light:text-gray-900'
          }`}>{value}</p>
        </div>
        <div className={`p-2 sm:p-2.5 lg:p-3 rounded-lg sm:rounded-xl border ${
          color === 'green' ? 'bg-emerald-600/20 border-emerald-500/30 theme-light:bg-emerald-100' :
          color === 'red' ? 'bg-red-600/20 border-red-500/30 theme-light:bg-red-100' :
          color === 'blue' ? 'bg-cyan-600/20 border-cyan-500/30 theme-light:bg-cyan-100' : 'bg-gray-600/20 border-gray-500/30'
        }`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 ${
            color === 'green' ? 'text-emerald-400 theme-light:text-emerald-600' :
            color === 'red' ? 'text-red-400 theme-light:text-red-600' :
            color === 'blue' ? 'text-cyan-400 theme-light:text-cyan-600' : 'text-gray-400'
          }`} />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function Financial() {
  const navigate = useNavigate();
  const [sales, setSales] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [currentDrawer, setCurrentDrawer] = useState(null);
  const [showOpenDrawer, setShowOpenDrawer] = useState(false);
  const [showCloseDrawer, setShowCloseDrawer] = useState(false);
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("sales");
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [showFixedExpenseDialog, setShowFixedExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [oneTimeExpenses, setOneTimeExpenses] = useState([]);
  const [dateFilter, setDateFilter] = useState("today");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);

  const isFetching = useRef(false);
  
  useEffect(() => {
    loadData();
    
    const handleRefresh = () => {
      if (!isFetching.current) {
        loadData();
      }
    };
    
    window.addEventListener("sale-completed", handleRefresh);
    window.addEventListener("drawer-closed", handleRefresh);
    window.addEventListener("drawer-opened", handleRefresh);

    return () => {
      window.removeEventListener("sale-completed", handleRefresh);
      window.removeEventListener("drawer-closed", handleRefresh);
      window.removeEventListener("drawer-opened", handleRefresh);
    };
  }, []);

  const loadData = async () => {
    if (isFetching.current) return;
    
    isFetching.current = true;
    setLoading(true);

    try {
      const today = format(new Date(), "yyyy-MM-dd");
      
      const [salesData, transactionsData, registers, fixedExpensesData, oneTimeExpensesData] = await Promise.all([
        dataClient.entities.Sale.list("-created_date", 500).catch(() => []),
        dataClient.entities.Transaction.list("-created_date", 500).catch(() => []),
        dataClient.entities.CashRegister.filter({ date: today }).catch(() => []),
        dataClient.entities.FixedExpense.list("-created_date", 100).catch(() => []),
        dataClient.entities.OneTimeExpense.list("-created_date", 100).catch(() => [])
      ]);

      const validSales = (salesData || []).filter(s => !s.voided);
      const expenseTransactions = (transactionsData || []).filter(t => t.type === 'expense');

      setSales(validSales);
      setTransactions(transactionsData || []);
      setExpenses(expenseTransactions);
      setFixedExpenses(fixedExpensesData || []);
      setOneTimeExpenses(oneTimeExpensesData || []);

      const openRegister = registers?.find(r => r.status === 'open');
      setDrawerOpen(!!openRegister);
      setCurrentDrawer(openRegister);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  };

  // Función para filtrar por fechas
  const getDateRange = () => {
    const now = new Date();
    let start, end;

    switch (dateFilter) {
      case "today":
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case "week":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        end = now;
        break;
      case "month":
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        end = now;
        break;
      case "custom":
        if (customStartDate && customEndDate) {
          start = startOfDay(new Date(customStartDate));
          end = endOfDay(new Date(customEndDate));
        } else {
          start = startOfDay(now);
          end = endOfDay(now);
        }
        break;
      default:
        start = startOfDay(now);
        end = endOfDay(now);
    }

    return { start, end };
  };

  const { start: filterStart, end: filterEnd } = getDateRange();

  const revenueTransactions = transactions.filter(t => {
    if (t.type !== 'revenue') return false;
    try {
      return isWithinInterval(new Date(t.created_date), { start: filterStart, end: filterEnd });
    } catch { return false; }
  });

  const filteredExpenses = expenses.filter(e => {
    try {
      return isWithinInterval(new Date(e.created_date), { start: filterStart, end: filterEnd });
    } catch { return false; }
  });

  const filteredSales = sales.filter(s => {
    try {
      return isWithinInterval(new Date(s.created_date), { start: filterStart, end: filterEnd });
    } catch { return false; }
  });

  const totalRevenue = revenueTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const todayRevenue = revenueTransactions.filter(t => {
    try {
      return isWithinInterval(new Date(t.created_date), { start: todayStart, end: todayEnd });
    } catch { return false; }
  }).reduce((sum, t) => sum + (t.amount || 0), 0);

  const todayExpenses = expenses.filter(e => {
    try {
      return isWithinInterval(new Date(e.created_date), { start: todayStart, end: todayEnd });
    } catch { return false; }
  }).reduce((sum, e) => sum + (e.amount || 0), 0);

  const todayNetProfit = todayRevenue - todayExpenses;

  const dailyAllocations = fixedExpenses.map(expense => ({
    ...expense,
    daily_amount: todayNetProfit > 0 ? (todayNetProfit * (expense.percentage / 100)) : 0,
    actual_percentage: expense.percentage
  })).sort((a, b) => a.priority - b.priority);

  const paymentMethodIcons = { cash: Wallet, card: CreditCard, ath_movil: Landmark, mixed: DollarSign };

  const handleActionSuccess = () => {
    setShowOpenDrawer(false);
    setShowCloseDrawer(false);
    setShowExpenseDialog(false);
    setShowFixedExpenseDialog(false);
    setEditingExpense(null);
    setTimeout(() => loadData(), 2000);
  };

  const handleSaveFixedExpense = async (expenseData) => {
    try {
      const dataToSave = {
        name: expenseData.name,
        category: expenseData.category,
        percentage: parseFloat(expenseData.percentage),
        frequency: expenseData.frequency,
        due_day: expenseData.due_day ? parseInt(expenseData.due_day) : null,
        priority: parseInt(expenseData.priority || 5),
        icon: expenseData.icon || "💰",
        notes: expenseData.notes || "",
        active: expenseData.active !== false
      };

      if (editingExpense) {
        await dataClient.entities.FixedExpense.update(editingExpense.id, dataToSave);
        toast.success("Gasto actualizado");
      } else {
        await dataClient.entities.FixedExpense.create(dataToSave);
        toast.success("Gasto creado");
      }
      handleActionSuccess();
    } catch (error) {
      console.error("Error saving:", error);
      toast.error(`Error: ${error.message || "No se pudo guardar"}`);
    }
  };

  const handleDeleteFixedExpense = async (expenseId) => {
    if (!confirm("¿Eliminar este gasto fijo?")) return;
    try {
      await dataClient.entities.FixedExpense.delete(expenseId);
      toast.success("Gasto eliminado");
      setTimeout(() => loadData(), 2000);
    } catch (error) {
      console.error("Error deleting:", error);
      toast.error("Error al eliminar");
    }
  };

  const getCategoryIcon = (category) => {
    const icons = { rent: "🏢", utilities: "⚡", payroll: "👥", inventory: "📦", marketing: "📢", insurance: "🛡️", maintenance: "🔧", savings: "💎", taxes: "🧾", other: "📝" };
    return icons[category] || "💰";
  };

  const handleManualRefresh = () => {
    if (loading || isFetching.current) {
      toast.warning("⏳ Ya hay una actualización en curso");
      return;
    }
    toast.info("🔄 Actualizando datos...");
    loadData();
  };

  const exportToCSV = () => {
    try {
      // Crear CSV detallado
      let csv = "REPORTE FINANCIERO DETALLADO\n\n";
      csv += `Período: ${dateFilter === 'today' ? 'Hoy' : dateFilter === 'week' ? 'Última Semana' : dateFilter === 'month' ? 'Último Mes' : `${customStartDate} a ${customEndDate}`}\n`;
      csv += `Fecha de Exportación: ${format(new Date(), "dd/MM/yyyy HH:mm")}\n\n`;

      // Resumen
      csv += "RESUMEN\n";
      csv += `Ingresos Totales,${totalRevenue.toFixed(2)}\n`;
      csv += `Gastos Totales,${totalExpenses.toFixed(2)}\n`;
      csv += `Utilidad Neta,${netProfit.toFixed(2)}\n`;
      csv += `Total de Ventas,${filteredSales.length}\n\n`;

      // Ventas detalladas
      csv += "VENTAS DETALLADAS\n";
      csv += "Número de Venta,Fecha,Hora,Cliente,Items,Método de Pago,Subtotal,IVU,Total\n";
      filteredSales.forEach(s => {
        const fecha = format(new Date(s.created_date), 'dd/MM/yyyy');
        const hora = format(new Date(s.created_date), 'HH:mm:ss');
        const subtotal = (s.subtotal || 0).toFixed(2);
        const ivu = (s.tax_amount || 0).toFixed(2);
        const total = (s.total || 0).toFixed(2);
        csv += `${s.sale_number},${fecha},${hora},"${s.customer_name || 'Cliente'}",${s.items?.length || 0},${s.payment_method},${subtotal},${ivu},${total}\n`;
      });

      csv += "\n";

      // Gastos detallados
      csv += "GASTOS DETALLADOS\n";
      csv += "Fecha,Hora,Descripción,Categoría,Monto,Registrado Por\n";
      filteredExpenses.forEach(e => {
        const fecha = format(new Date(e.created_date), 'dd/MM/yyyy');
        const hora = format(new Date(e.created_date), 'HH:mm:ss');
        csv += `${fecha},${hora},"${e.description || 'Sin descripción'}",${e.category || 'Otro'},${(e.amount || 0).toFixed(2)},"${e.recorded_by || 'Sistema'}"\n`;
      });

      csv += "\n";

      // Desglose por método de pago
      csv += "DESGLOSE POR MÉTODO DE PAGO\n";
      csv += "Método,Cantidad de Transacciones,Total\n";
      const paymentMethods = {};
      filteredSales.forEach(s => {
        const method = s.payment_method || 'sin_definir';
        if (!paymentMethods[method]) {
          paymentMethods[method] = { count: 0, total: 0 };
        }
        paymentMethods[method].count++;
        paymentMethods[method].total += (s.total || 0);
      });
      Object.keys(paymentMethods).forEach(method => {
        csv += `${method},${paymentMethods[method].count},${paymentMethods[method].total.toFixed(2)}\n`;
      });

      // Descargar
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `finanzas_${dateFilter}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success("✅ Reporte exportado exitosamente");
    } catch (error) {
      console.error("Error exportando:", error);
      toast.error("❌ Error al exportar el reporte");
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#0f172a_0%,#020617_45%,#000_90%)] theme-light:bg-gray-50 p-2 sm:p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 lg:space-y-6">
        
        <div className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 shadow-[0_8px_32px_rgba(0,168,232,0.3)] theme-light:bg-white theme-light:border-gray-200">
          <div className="flex items-center justify-between">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3 theme-light:text-gray-900">
              <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-cyan-500" />
              Finanzas
            </h1>
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

        <AlertasWidget />

        {/* Filtros de Fecha */}
        <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/20 theme-light:bg-white">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white theme-light:text-gray-900">Filtrar por Período</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              <Button
                onClick={() => setDateFilter("today")}
                variant={dateFilter === "today" ? "default" : "outline"}
                className={dateFilter === "today" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                size="sm"
              >
                Hoy
              </Button>
              <Button
                onClick={() => setDateFilter("week")}
                variant={dateFilter === "week" ? "default" : "outline"}
                className={dateFilter === "week" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                size="sm"
              >
                Semana
              </Button>
              <Button
                onClick={() => setDateFilter("month")}
                variant={dateFilter === "month" ? "default" : "outline"}
                className={dateFilter === "month" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                size="sm"
              >
                Mes
              </Button>
              <Button
                onClick={() => setDateFilter("custom")}
                variant={dateFilter === "custom" ? "default" : "outline"}
                className={dateFilter === "custom" ? "bg-gradient-to-r from-cyan-600 to-emerald-600" : "border-cyan-500/20"}
                size="sm"
              >
                Personalizado
              </Button>
            </div>
            
            {dateFilter === "custom" && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Desde</label>
                  <Input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-black/40 border-cyan-500/20 text-white h-9 text-sm theme-light:bg-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Hasta</label>
                  <Input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-black/40 border-cyan-500/20 text-white h-9 text-sm theme-light:bg-white"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleManualRefresh} disabled={loading} variant="outline" className="border-cyan-500/20 h-8 sm:h-9 text-xs sm:text-sm theme-light:border-gray-300">
            <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden xs:inline">Actualizar</span>
            <span className="xs:hidden">↻</span>
          </Button>

          <Button onClick={exportToCSV} className="bg-gradient-to-r from-purple-600 to-blue-600 h-8 sm:h-9 text-xs sm:text-sm">
            <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Exportar CSV</span>
            <span className="sm:hidden">Exportar</span>
          </Button>

          <Button onClick={() => setShowExpenseDialog(true)} className="bg-orange-600 hover:bg-orange-700 h-8 sm:h-9 text-xs sm:text-sm">
            <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Registrar Gasto</span>
            <span className="sm:hidden">Gasto</span>
          </Button>

          {drawerOpen ? (
            <Button onClick={() => setShowCloseDrawer(true)} className="bg-red-800 hover:bg-red-900 h-8 sm:h-9 text-xs sm:text-sm">
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Cerrar Caja</span>
              <span className="sm:hidden">Cerrar</span>
            </Button>
          ) : (
            <Button onClick={() => setShowOpenDrawer(true)} className="bg-emerald-600 hover:bg-emerald-700 h-8 sm:h-9 text-xs sm:text-sm">
              <Wallet className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Abrir Caja</span>
              <span className="sm:hidden">Abrir</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
          <StatCard 
            title="Ingresos Totales" 
            value={`$${totalRevenue.toFixed(2)}`} 
            icon={TrendingUp} 
            color="green"
            onClick={() => setShowTransactionsModal(true)}
          />
          <StatCard 
            title="Ticket Promedio" 
            value={`$${(filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0).toFixed(2)}`} 
            icon={DollarSign} 
            color="blue"
            onClick={() => setShowTransactionsModal(true)}
          />
          <StatCard 
            title="IVU Recaudado" 
            value={`$${filteredSales.reduce((sum, s) => sum + (s.tax_amount || 0), 0).toFixed(2)}`} 
            icon={Receipt} 
            color="blue"
            onClick={() => setShowTransactionsModal(true)}
          />
          <StatCard 
            title="Transacciones" 
            value={filteredSales.length} 
            icon={Receipt} 
            color="blue"
            onClick={() => setShowTransactionsModal(true)}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-black/40 border border-cyan-500/20 backdrop-blur-xl w-full grid grid-cols-2 sm:grid-cols-4 gap-0.5 sm:gap-1 p-0.5 sm:p-1 theme-light:bg-white">
            <TabsTrigger value="sales" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white text-[10px] sm:text-xs lg:text-sm px-1 sm:px-2 py-1.5 sm:py-2">
              <span className="hidden sm:inline">💵 Ventas</span>
              <span className="sm:hidden">💵</span>
            </TabsTrigger>
            <TabsTrigger value="allocations" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white text-[10px] sm:text-xs lg:text-sm px-1 sm:px-2 py-1.5 sm:py-2">
              <span className="hidden sm:inline">💰 Gastos Fijos</span>
              <span className="sm:hidden">💰</span>
            </TabsTrigger>
            <TabsTrigger value="expenses" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white text-[10px] sm:text-xs lg:text-sm px-1 sm:px-2 py-1.5 sm:py-2">
              <span className="hidden sm:inline">💸 Gastos</span>
              <span className="sm:hidden">💸</span>
            </TabsTrigger>
            <TabsTrigger value="reportes" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-cyan-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white text-[10px] sm:text-xs lg:text-sm px-1 sm:px-2 py-1.5 sm:py-2">
              <span className="hidden sm:inline">📊 Reportes</span>
              <span className="sm:hidden">📊</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sales">
            <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/20 theme-light:bg-white">
              <CardHeader className="p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-white flex items-center justify-between text-base sm:text-lg lg:text-xl theme-light:text-gray-900">
                  <span>💵 Ventas</span>
                  <Badge className="bg-emerald-600/20 text-emerald-300 border-emerald-500/30 theme-light:bg-emerald-100 text-xs sm:text-sm">${totalRevenue.toFixed(2)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                {loading ? (
                  <div className="p-8 sm:p-12 text-center">
                    <RefreshCw className="w-10 h-10 sm:w-12 sm:h-12 animate-spin mx-auto mb-4 text-cyan-500" />
                    <p className="text-gray-400 text-sm sm:text-base">Cargando...</p>
                  </div>
                ) : filteredSales.length === 0 ? (
                  <div className="p-8 sm:p-12 text-center">
                    <Receipt className="w-12 h-12 sm:w-16 sm:h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-lg sm:text-xl font-bold text-gray-400">No hay ventas en este período</p>
                  </div>
                ) : (
                  <div className="space-y-2 sm:space-y-3 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
                    {filteredSales.map((s) => {
                      const Icon = paymentMethodIcons[s.payment_method] || DollarSign;
                      return (
                        <div key={s.id} className="p-3 sm:p-4 bg-black/30 rounded-lg sm:rounded-xl border border-cyan-500/10 theme-light:bg-gray-50">
                          <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-3 mb-1 sm:mb-2 flex-wrap">
                                <Badge className="bg-cyan-600/20 text-cyan-300 font-mono text-[10px] sm:text-xs theme-light:bg-cyan-100">{s.sale_number}</Badge>
                                <Badge variant="outline" className="capitalize flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs">
                                  <Icon className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                  <span className="hidden xs:inline">{s.payment_method === 'ath_movil' ? 'ATH' : s.payment_method}</span>
                                </Badge>
                              </div>
                              <p className="text-white text-xs sm:text-sm truncate theme-light:text-gray-900">{s.customer_name || 'Cliente'} • {s.items?.length || 0} items</p>
                              <p className="text-gray-500 text-[10px] sm:text-xs">{format(new Date(s.created_date), 'dd/MM/yyyy HH:mm')}</p>
                            </div>
                            <p className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-400 theme-light:text-emerald-600 whitespace-nowrap">${(s.total || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocations" className="space-y-3 sm:space-y-4 lg:space-y-6">
            <OneTimeExpensesWidget />

            <div className="bg-gradient-to-br from-cyan-600/20 to-emerald-600/20 border-2 border-cyan-500/40 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 theme-light:bg-white">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
                <div>
                  <h3 className="text-white font-bold text-sm sm:text-base lg:text-xl theme-light:text-gray-900">Utilidad de Hoy: {format(new Date(), "dd 'de' MMMM", { locale: es })}</h3>
                  <p className="text-gray-400 text-[10px] sm:text-xs lg:text-sm theme-light:text-gray-600">Los % se calculan sobre esta ganancia</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                <div className="bg-black/30 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-emerald-500/20 theme-light:bg-emerald-50">
                  <p className="text-xs sm:text-sm text-emerald-200 mb-1 theme-light:text-emerald-700">💵 Ingresos de Hoy</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-400 theme-light:text-emerald-600">${todayRevenue.toFixed(2)}</p>
                </div>
                <div className="bg-black/30 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-red-500/20 theme-light:bg-red-50">
                  <p className="text-xs sm:text-sm text-red-200 mb-1 theme-light:text-red-700">💸 Gastos de Hoy</p>
                  <p className="text-xl sm:text-2xl lg:text-3xl font-black text-red-400 theme-light:text-red-600">${todayExpenses.toFixed(2)}</p>
                </div>
                <div className="bg-black/30 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-cyan-500/20 theme-light:bg-cyan-50">
                  <p className="text-xs sm:text-sm text-cyan-200 mb-1 theme-light:text-cyan-700">✨ Utilidad de Hoy</p>
                  <p className={`text-xl sm:text-2xl lg:text-3xl font-black ${todayNetProfit >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>${todayNetProfit.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={() => { setEditingExpense(null); setShowFixedExpenseDialog(true); }} className="bg-gradient-to-r from-cyan-600 to-emerald-700 h-8 sm:h-9 text-xs sm:text-sm">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Añadir Gasto Fijo</span>
                <span className="sm:hidden">Añadir</span>
              </Button>
            </div>

            <div className="space-y-2 sm:space-y-3 lg:space-y-4">
              {fixedExpenses.length === 0 ? (
                <Card className="bg-gradient-to-br from-amber-600/10 to-amber-800/10 border-amber-500/20 theme-light:bg-white">
                  <CardContent className="p-8 sm:p-12 text-center">
                    <PieChart className="w-16 h-16 sm:w-20 sm:h-20 text-amber-400 mx-auto mb-4" />
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-2 theme-light:text-gray-900">No hay gastos fijos</h3>
                    <Button onClick={() => setShowFixedExpenseDialog(true)} className="bg-gradient-to-r from-cyan-600 to-emerald-700 mt-4 text-sm sm:text-base">
                      <Plus className="w-4 h-4 mr-2" />Crear Primer Gasto
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                dailyAllocations.map((allocation) => (
                  <Card key={allocation.id} className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-cyan-500/20 theme-light:bg-white">
                    <CardContent className="p-3 sm:p-4 lg:p-5">
                      <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 flex-wrap">
                        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-cyan-600/30 to-emerald-600/30 flex items-center justify-center text-2xl sm:text-3xl border border-cyan-500/30 flex-shrink-0">
                            {allocation.icon || getCategoryIcon(allocation.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white truncate theme-light:text-gray-900">{allocation.name}</h3>
                            <Badge className="bg-cyan-600/30 text-cyan-200 font-mono text-[10px] sm:text-xs theme-light:bg-cyan-100">{allocation.actual_percentage}%</Badge>
                          </div>
                        </div>
                        <div className="text-right order-3 sm:order-2 w-full sm:w-auto">
                          <p className="text-[10px] sm:text-xs lg:text-sm text-gray-400">Apartar hoy</p>
                          <p className="text-2xl sm:text-2xl lg:text-3xl font-black text-emerald-400 theme-light:text-emerald-600">${allocation.daily_amount.toFixed(2)}</p>
                        </div>
                        <div className="flex gap-1.5 sm:gap-2 order-2 sm:order-3">
                          <Button size="icon" variant="ghost" onClick={() => { setEditingExpense(allocation); setShowFixedExpenseDialog(true); }} className="text-cyan-400 hover:bg-cyan-600/20 h-8 w-8 sm:h-9 sm:w-9">
                            <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteFixedExpense(allocation.id)} className="text-red-400 hover:bg-red-600/20 h-8 w-8 sm:h-9 sm:w-9">
                            <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="expenses">
            <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/20 theme-light:bg-white">
              <CardHeader className="p-3 sm:p-4 lg:p-6">
                <CardTitle className="text-white text-base sm:text-lg lg:text-xl theme-light:text-gray-900">Gastos Registrados</CardTitle>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6">
                {filteredExpenses.length === 0 ? (
                  <p className="text-gray-500 text-center py-6 sm:py-8 text-sm sm:text-base">No hay gastos en este período</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] sm:max-h-[600px] overflow-y-auto">
                    {filteredExpenses.map((e) => (
                      <div key={e.id} className="p-3 bg-black/30 rounded-lg border border-red-500/10 theme-light:bg-gray-50">
                        <div className="flex justify-between gap-3 flex-wrap sm:flex-nowrap">
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-xs sm:text-sm truncate theme-light:text-gray-900">{e.description}</p>
                            <p className="text-gray-500 text-[10px] sm:text-xs">{format(new Date(e.created_date), 'dd/MM/yyyy HH:mm')}</p>
                          </div>
                          <p className="text-red-400 font-bold text-lg sm:text-xl theme-light:text-red-600 whitespace-nowrap">${e.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reportes">
            <EnhancedReports 
              dateFilter={dateFilter}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
            />
          </TabsContent>
        </Tabs>
      </div>

      {showOpenDrawer && <OpenDrawerDialog open={showOpenDrawer} onClose={() => setShowOpenDrawer(false)} onSuccess={handleActionSuccess} />}
      {showCloseDrawer && <CloseDrawerDialog open={showCloseDrawer} onClose={() => setShowCloseDrawer(false)} onSuccess={handleActionSuccess} drawer={currentDrawer} />}
      {showExpenseDialog && <ExpenseDialog open={showExpenseDialog} onClose={() => setShowExpenseDialog(false)} onSuccess={handleActionSuccess} drawer={currentDrawer} />}
      {showFixedExpenseDialog && <FixedExpenseDialog open={showFixedExpenseDialog} onClose={() => { setShowFixedExpenseDialog(false); setEditingExpense(null); }} onSave={handleSaveFixedExpense} expense={editingExpense} />}
      
      <TransactionsModal 
        open={showTransactionsModal} 
        onClose={() => setShowTransactionsModal(false)}
        sales={filteredSales}
        title="Detalles de Transacciones"
      />
    </div>
  );
}

function FixedExpenseDialog({ open, onClose, onSave, expense }) {
  const [formData, setFormData] = useState({
    name: "", category: "other", percentage: "", frequency: "monthly", 
    due_day: "", priority: 5, icon: "💰", notes: "", active: true
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        name: expense.name || "", category: expense.category || "other", percentage: expense.percentage || "",
        frequency: expense.frequency || "monthly", due_day: expense.due_day || "", priority: expense.priority || 5,
        icon: expense.icon || "💰", notes: expense.notes || "", active: expense.active !== false
      });
    } else {
      setFormData({ name: "", category: "other", percentage: "", frequency: "monthly", due_day: "", priority: 5, icon: "💰", notes: "", active: true });
    }
  }, [expense, open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || formData.percentage === "") {
      toast.error("Nombre y porcentaje obligatorios");
      return;
    }
    const percentage = parseFloat(formData.percentage);
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      toast.error("Porcentaje debe estar entre 0 y 100");
      return;
    }
    
    // Validar due_day para frecuencias que lo requieren
    if ((formData.frequency === "monthly" || formData.frequency === "quarterly") && !formData.due_day) {
      toast.error("Día de vencimiento es obligatorio para esta frecuencia");
      return;
    }
    
    // Convertir due_day a número si existe
    const dataToSave = { 
      ...formData, 
      percentage,
      due_day: formData.due_day ? parseInt(formData.due_day) : null
    };
    
    await onSave(dataToSave);
  };

  const categories = [
    { value: "rent", label: "Renta", icon: "🏢" }, { value: "utilities", label: "Luz/Agua", icon: "⚡" },
    { value: "payroll", label: "Nómina", icon: "👥" }, { value: "inventory", label: "Inventario", icon: "📦" },
    { value: "savings", label: "Ahorro", icon: "💎" }, { value: "taxes", label: "Impuestos", icon: "🧾" },
    { value: "marketing", label: "Marketing", icon: "📢" }, { value: "insurance", label: "Seguro", icon: "🛡️" },
    { value: "maintenance", label: "Mantenimiento", icon: "🔧" }, { value: "other", label: "Otros", icon: "📝" }
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/30 max-h-[90vh] overflow-y-auto theme-light:bg-white">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl lg:text-2xl font-bold text-white flex items-center gap-2 theme-light:text-gray-900">
            <Target className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-500" />
            {expense ? "Editar Gasto Fijo" : "Nuevo Gasto Fijo"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 mt-2 sm:mt-4">
          <div>
            <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">Nombre *</label>
            <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej. Renta, Luz, Nómina" className="bg-black/40 border-cyan-500/20 text-white h-10 sm:h-11 theme-light:bg-white theme-light:text-gray-900" required />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">Categoría</label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
              {categories.map(cat => (
                <button key={cat.value} type="button" onClick={() => setFormData({ ...formData, category: cat.value, icon: cat.icon })}
                  className={`p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all ${formData.category === cat.value ? "bg-gradient-to-br from-cyan-600/80 to-emerald-800/80 border-cyan-300/50 scale-105" : "bg-black/30 border-white/10 hover:border-cyan-500/30"}`}>
                  <div className="text-xl sm:text-2xl mb-0.5 sm:mb-1">{cat.icon}</div>
                  <div className="text-[9px] sm:text-xs font-medium text-white">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">Porcentaje *</label>
            <Input type="number" step="0.1" min="0" max="100" value={formData.percentage} onChange={(e) => setFormData({ ...formData, percentage: e.target.value })} placeholder="30" className="bg-black/40 border-cyan-500/20 text-white text-xl sm:text-2xl text-center h-14 sm:h-16 theme-light:bg-white theme-light:text-gray-900" required />
          </div>

          <div>
            <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">Frecuencia</label>
            <select 
              value={formData.frequency} 
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full bg-black/40 border border-cyan-500/20 text-white rounded-lg h-11 px-3 theme-light:bg-white theme-light:text-gray-900 theme-light:border-gray-300"
            >
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
              <option value="yearly">Anual</option>
            </select>
          </div>

          {(formData.frequency === "monthly" || formData.frequency === "quarterly") && (
            <div>
              <label className="text-xs sm:text-sm font-semibold text-gray-300 mb-1.5 sm:mb-2 block theme-light:text-gray-700">
                Día de vencimiento {formData.frequency === "monthly" ? "(1-31)" : ""}
              </label>
              <Input 
                type="number" 
                min="1" 
                max="31" 
                value={formData.due_day} 
                onChange={(e) => setFormData({ ...formData, due_day: e.target.value })} 
                placeholder="Ej. 5 para día 5 de cada mes" 
                className="bg-black/40 border-cyan-500/20 text-white h-11 theme-light:bg-white theme-light:text-gray-900" 
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.frequency === "monthly" 
                  ? "Día del mes en que se debe pagar (ejemplo: 5 para cada día 5)" 
                  : "Día del trimestre"}
              </p>
            </div>
          )}

          <div className="flex gap-2 sm:gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 border-white/15 h-10 sm:h-11 text-sm">Cancelar</Button>
            <Button type="submit" className="flex-1 bg-gradient-to-r from-cyan-600 to-emerald-700 h-10 sm:h-11 text-sm">
              <Save className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />{expense ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
