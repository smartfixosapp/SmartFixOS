import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Download, FileText, Calendar, Filter, TrendingUp, DollarSign, CreditCard } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function FinancialReportsPage() {
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("month");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [category, setCategory] = useState("all");
  const [reportData, setReportData] = useState(null);

  useEffect(() => {
    updateDateRange(period);
  }, [period]);

  const updateDateRange = (p) => {
    const now = new Date();
    switch(p) {
      case "today":
        setStartDate(format(startOfDay(now), "yyyy-MM-dd"));
        setEndDate(format(endOfDay(now), "yyyy-MM-dd"));
        break;
      case "week":
        setStartDate(format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        setEndDate(format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        break;
      case "month":
        setStartDate(format(startOfMonth(now), "yyyy-MM-dd"));
        setEndDate(format(endOfMonth(now), "yyyy-MM-dd"));
        break;
      case "year":
        setStartDate(format(startOfYear(now), "yyyy-MM-dd"));
        setEndDate(format(endOfYear(now), "yyyy-MM-dd"));
        break;
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const [sales, transactions] = await Promise.all([
        base44.entities.Sale.list("-created_date", 1000),
        base44.entities.Transaction.list("-created_date", 1000)
      ]);

      const filterByDate = (item) => {
        const itemDate = new Date(item.created_date);
        return itemDate >= start && itemDate <= end;
      };

      const filterByPayment = (item) => 
        paymentMethod === "all" || item.payment_method === paymentMethod;

      const filterByCategory = (item) => 
        category === "all" || item.category === category;

      const filteredSales = sales.filter(s => !s.voided && filterByDate(s) && filterByPayment(s));
      const filteredTransactions = transactions.filter(t => filterByDate(t) && filterByCategory(t));

      const revenue = filteredSales.reduce((sum, s) => sum + (s.total || 0), 0);
      const expenses = filteredTransactions
        .filter(t => t.type === "expense")
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const revenueByMethod = {};
      filteredSales.forEach(s => {
        const method = s.payment_method || "other";
        revenueByMethod[method] = (revenueByMethod[method] || 0) + s.total;
      });

      const expensesByCategory = {};
      filteredTransactions.filter(t => t.type === "expense").forEach(t => {
        const cat = t.category || "other";
        expensesByCategory[cat] = (expensesByCategory[cat] || 0) + t.amount;
      });

      const dailyData = {};
      filteredSales.forEach(s => {
        const day = format(new Date(s.created_date), "yyyy-MM-dd");
        if (!dailyData[day]) dailyData[day] = { date: day, revenue: 0, expenses: 0 };
        dailyData[day].revenue += s.total;
      });
      filteredTransactions.filter(t => t.type === "expense").forEach(t => {
        const day = format(new Date(t.created_date), "yyyy-MM-dd");
        if (!dailyData[day]) dailyData[day] = { date: day, revenue: 0, expenses: 0 };
        dailyData[day].expenses += t.amount;
      });

      const trend = Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date));

      setReportData({
        revenue,
        expenses,
        netProfit: revenue - expenses,
        salesCount: filteredSales.length,
        revenueByMethod,
        expensesByCategory,
        trend
      });

      toast.success("Reporte generado exitosamente");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Error al generar reporte");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!reportData) return;
    
    let csv = "Fecha,Ingresos,Gastos,Utilidad Neta\n";
    reportData.trend.forEach(row => {
      csv += `${row.date},${row.revenue.toFixed(2)},${row.expenses.toFixed(2)},${(row.revenue - row.expenses).toFixed(2)}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_${startDate}_${endDate}.csv`;
    a.click();
    toast.success("CSV exportado");
  };

  const exportPDF = () => {
    toast.info("Exportación PDF en desarrollo");
  };

  const COLORS = ["#00A8E8", "#10B981", "#A8D700", "#F59E0B", "#EF4444"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black to-[#0A0A0A] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-white">📊 Reportes Financieros</h1>
        </div>

        <Card className="bg-black/40 border-cyan-500/20">
          <CardHeader>
            <CardTitle className="text-white">Filtros de Reporte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-gray-300 text-sm mb-2 block">Periodo</label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="bg-black/60 border-cyan-500/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hoy</SelectItem>
                    <SelectItem value="week">Esta Semana</SelectItem>
                    <SelectItem value="month">Este Mes</SelectItem>
                    <SelectItem value="year">Este Año</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-gray-300 text-sm mb-2 block">Desde</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-black/60 border-cyan-500/30 text-white"
                />
              </div>

              <div>
                <label className="text-gray-300 text-sm mb-2 block">Hasta</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-black/60 border-cyan-500/30 text-white"
                />
              </div>

              <div>
                <label className="text-gray-300 text-sm mb-2 block">Método de Pago</label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="bg-black/60 border-cyan-500/30 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                    <SelectItem value="ath_movil">ATH Móvil</SelectItem>
                    <SelectItem value="bank_transfer">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={generateReport}
                disabled={loading}
                className="bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700"
              >
                {loading ? "Generando..." : "Generar Reporte"}
              </Button>
              {reportData && (
                <>
                  <Button onClick={exportCSV} variant="outline" className="border-cyan-500/30 text-cyan-400">
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>
                  <Button onClick={exportPDF} variant="outline" className="border-cyan-500/30 text-cyan-400">
                    <FileText className="w-4 h-4 mr-2" />
                    PDF
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {reportData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-emerald-600/20 to-green-600/20 border-emerald-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-8 h-8 text-emerald-400" />
                    <h3 className="text-gray-300 text-sm">Ingresos Totales</h3>
                  </div>
                  <p className="text-4xl font-black text-emerald-400">${reportData.revenue.toFixed(2)}</p>
                  <p className="text-sm text-gray-400 mt-2">{reportData.salesCount} ventas</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-600/20 to-red-800/20 border-red-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="w-8 h-8 text-red-400" />
                    <h3 className="text-gray-300 text-sm">Gastos Totales</h3>
                  </div>
                  <p className="text-4xl font-black text-red-400">${reportData.expenses.toFixed(2)}</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border-cyan-500/30">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <CreditCard className="w-8 h-8 text-cyan-400" />
                    <h3 className="text-gray-300 text-sm">Utilidad Neta</h3>
                  </div>
                  <p className={`text-4xl font-black ${reportData.netProfit >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
                    ${reportData.netProfit.toFixed(2)}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Tabs defaultValue="trend" className="space-y-6">
              <TabsList className="bg-black/60 border-cyan-500/20">
                <TabsTrigger value="trend">Tendencias</TabsTrigger>
                <TabsTrigger value="methods">Métodos de Pago</TabsTrigger>
                <TabsTrigger value="expenses">Gastos por Categoría</TabsTrigger>
              </TabsList>

              <TabsContent value="trend">
                <Card className="bg-black/40 border-cyan-500/20">
                  <CardHeader>
                    <CardTitle className="text-white">Evolución de Ingresos y Gastos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={reportData.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis dataKey="date" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #444" }} />
                        <Legend />
                        <Line type="monotone" dataKey="revenue" stroke="#10B981" name="Ingresos" strokeWidth={2} />
                        <Line type="monotone" dataKey="expenses" stroke="#EF4444" name="Gastos" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="methods">
                <Card className="bg-black/40 border-cyan-500/20">
                  <CardHeader>
                    <CardTitle className="text-white">Ingresos por Método de Pago</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <PieChart>
                        <Pie
                          data={Object.entries(reportData.revenueByMethod).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={120}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.keys(reportData.revenueByMethod).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #444" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="expenses">
                <Card className="bg-black/40 border-cyan-500/20">
                  <CardHeader>
                    <CardTitle className="text-white">Gastos por Categoría</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={Object.entries(reportData.expensesByCategory).map(([name, value]) => ({ name, value }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                        <XAxis dataKey="name" stroke="#888" />
                        <YAxis stroke="#888" />
                        <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #444" }} />
                        <Bar dataKey="value" fill="#EF4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
