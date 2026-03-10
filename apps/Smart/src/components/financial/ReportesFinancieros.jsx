import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText, Download, Calendar, TrendingUp, TrendingDown,
  DollarSign, RefreshCw, Filter
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
         startOfYear, endOfYear, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

export default function ReportesFinancieros() {
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [period, setPeriod] = useState("month"); // week, month, year, custom
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    generateReport();
  }, [period]);

  const generateReport = async () => {
    setLoading(true);
    try {
      const [sales, transactions] = await Promise.all([
        base44.entities.Sale.list("-created_date", 1000),
        base44.entities.Transaction.list("-created_date", 1000)
      ]);

      // Determinar rango de fechas
      let start, end;
      const today = new Date();

      switch (period) {
        case "week":
          start = startOfWeek(today, { weekStartsOn: 1 });
          end = endOfWeek(today, { weekStartsOn: 1 });
          break;
        case "month":
          start = startOfMonth(today);
          end = endOfMonth(today);
          break;
        case "year":
          start = startOfYear(today);
          end = endOfYear(today);
          break;
        case "custom":
          if (!customStart || !customEnd) {
            toast.error("Selecciona fechas de inicio y fin");
            setLoading(false);
            return;
          }
          start = new Date(customStart);
          end = new Date(customEnd);
          break;
        default:
          start = startOfMonth(today);
          end = endOfMonth(today);
      }

      // Filtrar datos por rango
      const filteredSales = sales.filter(s => {
        if (s.voided) return false;
        try {
          const date = new Date(s.created_date);
          return isWithinInterval(date, { start, end });
        } catch {
          return false;
        }
      });

      const revenueTransactions = transactions.filter(t => {
        if (t.type !== 'revenue') return false;
        try {
          const date = new Date(t.created_date);
          return isWithinInterval(date, { start, end });
        } catch {
          return false;
        }
      });

      const expenseTransactions = transactions.filter(t => {
        if (t.type !== 'expense') return false;
        try {
          const date = new Date(t.created_date);
          return isWithinInterval(date, { start, end });
        } catch {
          return false;
        }
      });

      // Calcular métricas
      const totalRevenue = revenueTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const totalExpenses = expenseTransactions.reduce((sum, t) => sum + (t.amount || 0), 0);
      const netProfit = totalRevenue - totalExpenses;

      // Ingresos por método de pago
      const revenueByMethod = {};
      filteredSales.forEach(s => {
        const method = s.payment_method || "unknown";
        if (!revenueByMethod[method]) revenueByMethod[method] = 0;
        revenueByMethod[method] += s.total || 0;
      });

      // Gastos por categoría
      const expensesByCategory = {};
      expenseTransactions.forEach(t => {
        const cat = t.category || "other";
        if (!expensesByCategory[cat]) expensesByCategory[cat] = 0;
        expensesByCategory[cat] += t.amount || 0;
      });

      // Top productos vendidos
      const productSales = {};
      filteredSales.forEach(s => {
        (s.items || []).forEach(item => {
          const key = item.name || "Sin nombre";
          if (!productSales[key]) {
            productSales[key] = { name: key, qty: 0, total: 0 };
          }
          productSales[key].qty += item.quantity || 1;
          productSales[key].total += (item.price || 0) * (item.quantity || 1);
        });
      });

      const topProducts = Object.values(productSales)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      setReportData({
        period: { start, end, type: period },
        summary: {
          totalRevenue,
          totalExpenses,
          netProfit,
          salesCount: filteredSales.length,
          transactionsCount: revenueTransactions.length
        },
        revenueByMethod,
        expensesByCategory,
        topProducts,
        rawSales: filteredSales,
        rawTransactions: revenueTransactions.concat(expenseTransactions)
      });

    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Error generando reporte");
    }
    setLoading(false);
  };

  const exportToCSV = () => {
    if (!reportData) return;

    try {
      // Header del reporte
      let csvContent = `Reporte Financiero - ${format(reportData.period.start, "dd/MM/yyyy")} al ${format(reportData.period.end, "dd/MM/yyyy")}\n\n`;

      // Resumen
      csvContent += "RESUMEN\n";
      csvContent += `Ingresos Totales,$${reportData.summary.totalRevenue.toFixed(2)}\n`;
      csvContent += `Gastos Totales,$${reportData.summary.totalExpenses.toFixed(2)}\n`;
      csvContent += `Utilidad Neta,$${reportData.summary.netProfit.toFixed(2)}\n`;
      csvContent += `Número de Ventas,${reportData.summary.salesCount}\n`;
      csvContent += `Número de Transacciones,${reportData.summary.transactionsCount}\n\n`;

      // Ingresos por método
      csvContent += "INGRESOS POR METODO DE PAGO\n";
      csvContent += "Método,Monto\n";
      Object.entries(reportData.revenueByMethod).forEach(([method, amount]) => {
        csvContent += `${method},$${amount.toFixed(2)}\n`;
      });
      csvContent += "\n";

      // Gastos por categoría
      csvContent += "GASTOS POR CATEGORIA\n";
      csvContent += "Categoría,Monto\n";
      Object.entries(reportData.expensesByCategory).forEach(([cat, amount]) => {
        csvContent += `${cat},$${amount.toFixed(2)}\n`;
      });
      csvContent += "\n";

      // Top productos
      csvContent += "TOP 10 PRODUCTOS\n";
      csvContent += "Producto,Cantidad,Total\n";
      reportData.topProducts.forEach(p => {
        csvContent += `${p.name},${p.qty},$${p.total.toFixed(2)}\n`;
      });
      csvContent += "\n";

      // Detalle de transacciones
      csvContent += "DETALLE DE TRANSACCIONES\n";
      csvContent += "Fecha,Tipo,Descripción,Método,Monto\n";
      reportData.rawTransactions.forEach(t => {
        const date = format(new Date(t.created_date), "dd/MM/yyyy HH:mm");
        const type = t.type === 'revenue' ? 'Ingreso' : 'Gasto';
        const desc = t.description || t.category || '-';
        const method = t.payment_method || '-';
        csvContent += `${date},${type},"${desc}",${method},$${(t.amount || 0).toFixed(2)}\n`;
      });

      // Crear archivo y descargar
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `reporte-financiero-${format(reportData.period.start, "yyyy-MM-dd")}-${format(reportData.period.end, "yyyy-MM-dd")}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("✅ Reporte exportado a CSV");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Error al exportar CSV");
    }
  };

  const methodLabels = {
    cash: "💵 Efectivo",
    card: "💳 Tarjeta",
    ath_movil: "📱 ATH Móvil",
    bank_transfer: "🏦 Transferencia",
    check: "📄 Cheque",
    unknown: "❓ Desconocido"
  };

  const categoryLabels = {
    repair_payment: "Reparaciones",
    parts: "Piezas",
    supplies: "Suministros",
    other_expense: "Otros",
    refund: "Reembolsos",
    other: "Otros"
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-cyan-500/20 theme-light:bg-white theme-light:border-gray-200">
        <CardHeader className="border-b border-cyan-500/20 pb-4 theme-light:border-gray-200">
          <CardTitle className="text-white flex items-center justify-between theme-light:text-gray-900">
            <span className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-500" />
              Reportes Financieros
            </span>
            {reportData && (
              <Button
                onClick={exportToCSV}
                className="bg-gradient-to-r from-emerald-600 to-lime-700"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Filtros de Periodo */}
          <div className="bg-black/30 rounded-xl p-4 border border-cyan-500/20 theme-light:bg-gray-50 theme-light:border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-cyan-400 theme-light:text-cyan-600" />
              <Label className="text-white font-semibold theme-light:text-gray-900">Periodo del Reporte</Label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
              {[
                { value: "week", label: "Esta Semana" },
                { value: "month", label: "Este Mes" },
                { value: "year", label: "Este Año" },
                { value: "custom", label: "Personalizado" }
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    period === p.value
                      ? "bg-gradient-to-r from-cyan-600 to-emerald-700 border-cyan-500 text-white"
                      : "bg-black/20 border-white/10 text-gray-300 hover:border-cyan-500/50 theme-light:bg-white theme-light:border-gray-200 theme-light:text-gray-700"
                  }`}
                >
                  <Calendar className="w-4 h-4 mx-auto mb-1" />
                  <span className="text-sm font-semibold">{p.label}</span>
                </button>
              ))}
            </div>

            {period === "custom" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-gray-300 text-sm theme-light:text-gray-700">Desde</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="bg-black/40 border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 text-sm theme-light:text-gray-700">Hasta</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="bg-black/40 border-cyan-500/20 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={generateReport}
              disabled={loading}
              className="w-full mt-4 bg-gradient-to-r from-cyan-600 to-emerald-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" />
                  Generar Reporte
                </>
              )}
            </Button>
          </div>

          {/* Reporte */}
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4 text-cyan-500" />
              <p className="text-gray-400 theme-light:text-gray-600">Generando reporte...</p>
            </div>
          ) : !reportData ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4 theme-light:text-gray-400" />
              <p className="text-gray-400 theme-light:text-gray-600">Selecciona un periodo y genera un reporte</p>
            </div>
          ) : (
            <>
              {/* Resumen */}
              <div className="bg-gradient-to-br from-cyan-600/10 to-emerald-600/10 border-2 border-cyan-500/30 rounded-xl p-5 theme-light:bg-white theme-light:border-cyan-300">
                <h3 className="text-white font-bold text-xl mb-4 theme-light:text-gray-900">
                  📊 Resumen: {format(reportData.period.start, "dd MMM", { locale: es })} - {format(reportData.period.end, "dd MMM yyyy", { locale: es })}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-black/30 rounded-xl p-4 theme-light:bg-emerald-50">
                    <p className="text-sm text-emerald-200 mb-1 theme-light:text-emerald-700">💵 Ingresos</p>
                    <p className="text-3xl font-black text-emerald-400 theme-light:text-emerald-600">
                      ${reportData.summary.totalRevenue.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1 theme-light:text-gray-600">
                      {reportData.summary.salesCount} ventas
                    </p>
                  </div>

                  <div className="bg-black/30 rounded-xl p-4 theme-light:bg-red-50">
                    <p className="text-sm text-red-200 mb-1 theme-light:text-red-700">💸 Gastos</p>
                    <p className="text-3xl font-black text-red-400 theme-light:text-red-600">
                      ${reportData.summary.totalExpenses.toFixed(2)}
                    </p>
                  </div>

                  <div className="bg-black/30 rounded-xl p-4 theme-light:bg-cyan-50">
                    <p className="text-sm text-cyan-200 mb-1 theme-light:text-cyan-700">✨ Utilidad Neta</p>
                    <p className={`text-3xl font-black ${
                      reportData.summary.netProfit >= 0 
                        ? 'text-cyan-400 theme-light:text-cyan-600' 
                        : 'text-red-400 theme-light:text-red-600'
                    }`}>
                      ${reportData.summary.netProfit.toFixed(2)}
                    </p>
                  </div>

                  <div className="bg-black/30 rounded-xl p-4 theme-light:bg-purple-50">
                    <p className="text-sm text-purple-200 mb-1 theme-light:text-purple-700">📈 Margen</p>
                    <p className="text-3xl font-black text-purple-400 theme-light:text-purple-600">
                      {reportData.summary.totalRevenue > 0 
                        ? ((reportData.summary.netProfit / reportData.summary.totalRevenue) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Ingresos por Método */}
              <Card className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-emerald-500/20 theme-light:bg-white theme-light:border-gray-200">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                    Ingresos por Método de Pago
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(reportData.revenueByMethod)
                      .sort(([, a], [, b]) => b - a)
                      .map(([method, amount]) => {
                        const percentage = (amount / reportData.summary.totalRevenue) * 100;
                        return (
                          <div key={method} className="bg-black/30 rounded-lg p-4 theme-light:bg-gray-50">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-white font-semibold theme-light:text-gray-900">
                                {methodLabels[method] || method}
                              </span>
                              <div className="text-right">
                                <p className="text-emerald-400 font-bold text-lg theme-light:text-emerald-600">
                                  ${amount.toFixed(2)}
                                </p>
                                <p className="text-xs text-gray-500 theme-light:text-gray-600">
                                  {percentage.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                            <div className="h-2 bg-black/40 rounded-full overflow-hidden theme-light:bg-gray-200">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-lime-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>

              {/* Gastos por Categoría */}
              {Object.keys(reportData.expensesByCategory).length > 0 && (
                <Card className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-red-500/20 theme-light:bg-white theme-light:border-gray-200">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
                      <TrendingDown className="w-5 h-5 text-red-500" />
                      Gastos por Categoría
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(reportData.expensesByCategory)
                        .sort(([, a], [, b]) => b - a)
                        .map(([cat, amount]) => {
                          const percentage = (amount / reportData.summary.totalExpenses) * 100;
                          return (
                            <div key={cat} className="bg-black/30 rounded-lg p-4 theme-light:bg-gray-50">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-white font-semibold theme-light:text-gray-900">
                                  {categoryLabels[cat] || cat}
                                </span>
                                <div className="text-right">
                                  <p className="text-red-400 font-bold text-lg theme-light:text-red-600">
                                    ${amount.toFixed(2)}
                                  </p>
                                  <p className="text-xs text-gray-500 theme-light:text-gray-600">
                                    {percentage.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                              <div className="h-2 bg-black/40 rounded-full overflow-hidden theme-light:bg-gray-200">
                                <div
                                  className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Top Productos */}
              {reportData.topProducts.length > 0 && (
                <Card className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 border-purple-500/20 theme-light:bg-white theme-light:border-gray-200">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
                      <DollarSign className="w-5 h-5 text-purple-500" />
                      Top 10 Productos/Servicios
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {reportData.topProducts.map((product, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-black/30 rounded-lg theme-light:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-purple-600/20 text-purple-200 border-purple-500/30 theme-light:bg-purple-100 theme-light:text-purple-700">
                              #{idx + 1}
                            </Badge>
                            <span className="text-white font-medium theme-light:text-gray-900">{product.name}</span>
                          </div>
                          <div className="text-right">
                            <p className="text-purple-400 font-bold theme-light:text-purple-600">
                              ${product.total.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500 theme-light:text-gray-600">
                              {product.qty} unidades
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
