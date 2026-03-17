import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download, FileText, DollarSign, TrendingUp, TrendingDown,
  Wallet, CreditCard, Landmark, Receipt, Users, Package,
  Target, Calendar, PieChart, BarChart3, Clock
} from "lucide-react";
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import jsPDF from "jspdf";

export default function EnhancedReports({ dateFilter, customStartDate, customEndDate }) {
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState({
    sales: [],
    transactions: [],
    expenses: [],
    recharges: [],
    employeePayments: [],
    fixedExpenses: [],
    oneTimeExpenses: []
  });

  useEffect(() => {
    loadReportData();
  }, [dateFilter, customStartDate, customEndDate]);

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

  const loadReportData = async () => {
    setLoading(true);
    try {
      const [sales, transactions, recharges, employeePayments, fixedExpenses, oneTimeExpenses] = await Promise.all([
        dataClient.entities.Sale.list("-created_date", 1000).catch(err => { console.error("Error loading sales:", err); return []; }),
        dataClient.entities.Transaction.list("-created_date", 1000).catch(err => { console.error("Error loading transactions:", err); return []; }),
        dataClient.entities.Recharge?.list("-created_date", 500).catch(err => { console.error("Error loading recharges:", err); return []; }) || Promise.resolve([]),
        dataClient.entities.EmployeePayment?.list("-created_date", 500).catch(err => { console.error("Error loading employee payments:", err); return []; }) || Promise.resolve([]),
        dataClient.entities.FixedExpense?.list("-created_date", 200).catch(err => { console.error("Error loading fixed expenses:", err); return []; }) || Promise.resolve([]),
        dataClient.entities.OneTimeExpense?.list("-created_date", 200).catch(err => { console.error("Error loading one-time expenses:", err); return []; }) || Promise.resolve([])
      ]);

      setReportData({
        sales: (sales || []).filter(s => !s.voided),
        transactions: transactions || [],
        expenses: (transactions || []).filter(t => t.type === 'expense'),
        recharges: recharges || [],
        employeePayments: employeePayments || [],
        fixedExpenses: fixedExpenses || [],
        oneTimeExpenses: oneTimeExpenses || []
      });
    } catch (error) {
      console.error("Error loading report data:", error);
      toast.error("Error cargando datos del reporte");
    } finally {
      setLoading(false);
    }
  };

  const { start: filterStart, end: filterEnd } = getDateRange();

  const filterByDate = (items, dateField = 'created_date') => {
    return items.filter(item => {
      try {
        return isWithinInterval(new Date(item[dateField]), { start: filterStart, end: filterEnd });
      } catch {
        return false;
      }
    });
  };

  const filteredSales = filterByDate(reportData.sales);
  const filteredRecharges = filterByDate(reportData.recharges);
  const filteredExpenses = filterByDate(reportData.expenses);
  const filteredEmployeePayments = filterByDate(reportData.employeePayments);

  // 📊 CÁLCULOS DE INGRESOS
  const salesRevenue = filteredSales.reduce((sum, s) => sum + (s.subtotal || 0), 0);
  const rechargesRevenue = filteredRecharges.reduce((sum, r) => sum + (r.commission || 0), 0);
  const totalGrossRevenue = salesRevenue + rechargesRevenue;
  const totalTaxCollected = filteredSales.reduce((sum, s) => sum + (s.tax_amount || 0), 0);
  const totalNetRevenue = totalGrossRevenue; // Sin impuestos

  // 💳 INGRESOS POR MÉTODO DE PAGO
  const revenueByPaymentMethod = {};
  const paymentMethods = ['cash', 'card', 'ath_movil', 'transfer', 'mixed'];
  
  paymentMethods.forEach(method => {
    const salesByMethod = filteredSales.filter(s => s.payment_method === method);
    const rechargesByMethod = filteredRecharges.filter(r => r.payment_method === method);
    
    revenueByPaymentMethod[method] = {
      count: salesByMethod.length + rechargesByMethod.length,
      amount: salesByMethod.reduce((sum, s) => sum + (s.total || 0), 0) +
              rechargesByMethod.reduce((sum, r) => sum + (r.amount || 0), 0)
    };
  });

  // 💸 GASTOS POR CATEGORÍA DETALLADOS
  const expensesByCategory = {
    'general_expenses': {
      label: 'Gastos Generales',
      icon: '💵',
      items: filteredExpenses,
      total: filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
    },
    'employee_payments': {
      label: 'Pagos a Empleados',
      icon: '👥',
      items: filteredEmployeePayments,
      total: filteredEmployeePayments.reduce((sum, p) => sum + (p.amount || 0), 0)
    },
    'goals_expenses': {
      label: 'Metas y Compras',
      icon: '🎯',
      items: reportData.oneTimeExpenses.filter(e => 
        e.status === 'purchased' && filterByDate([e]).length > 0
      ),
      total: reportData.oneTimeExpenses
        .filter(e => e.status === 'purchased' && filterByDate([e]).length > 0)
        .reduce((sum, e) => sum + (e.target_amount || 0), 0)
    },
    'fixed_expenses': {
      label: 'Gastos Fijos (Estimado)',
      icon: '📅',
      items: reportData.fixedExpenses.filter(e => e.active),
      total: reportData.fixedExpenses
        .filter(e => e.active)
        .reduce((sum, e) => sum + ((totalNetRevenue * (e.percentage / 100)) || 0), 0)
    }
  };

  const totalExpenses = Object.values(expensesByCategory).reduce((sum, cat) => sum + cat.total, 0);
  const netProfit = totalNetRevenue - totalExpenses;

  // 📄 EXPORTAR A PDF
  const exportToPDF = async () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Logo
      try {
        const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png';
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = logoUrl;
        await new Promise((resolve) => {
          img.onload = () => {
            doc.addImage(img, 'PNG', pageWidth / 2 - 25, 10, 50, 20);
            resolve();
          };
          img.onerror = resolve;
        });
      } catch (e) {
        console.log("Logo no disponible");
      }

      // Header
      doc.setFontSize(20);
      doc.setTextColor(0, 168, 232);
      doc.text('REPORTE FINANCIERO DETALLADO', pageWidth / 2, 40, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Período: ${format(filterStart, 'dd/MM/yyyy')} - ${format(filterEnd, 'dd/MM/yyyy')}`, pageWidth / 2, 47, { align: 'center' });
      doc.text(`Generado: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, 52, { align: 'center' });

      let yPos = 60;

      // 📊 RESUMEN EJECUTIVO
      doc.setFontSize(14);
      doc.setTextColor(0, 168, 232);
      doc.text('RESUMEN EJECUTIVO', 14, yPos);
      yPos += 7;

      const summaryData = [
        ['Ingresos Brutos', `$${totalGrossRevenue.toFixed(2)}`],
        ['Ingresos Netos (sin IVU)', `$${totalNetRevenue.toFixed(2)}`],
        ['IVU Recaudado', `$${totalTaxCollected.toFixed(2)}`],
        ['Total Gastos', `$${totalExpenses.toFixed(2)}`],
        ['Utilidad Neta', `$${netProfit.toFixed(2)}`],
        ['Total Transacciones', `${filteredSales.length + filteredRecharges.length}`]
      ];

      // Tabla manual de resumen
      doc.setFontSize(10);
      doc.setFillColor(0, 168, 232);
      doc.setTextColor(255, 255, 255);
      doc.rect(14, yPos, pageWidth - 28, 7, 'F');
      doc.text('Concepto', 16, yPos + 5);
      doc.text('Monto', pageWidth - 50, yPos + 5);
      yPos += 7;

      doc.setTextColor(0, 0, 0);
      summaryData.forEach(([label, value], idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(14, yPos, pageWidth - 28, 6, 'F');
        }
        doc.text(label, 16, yPos + 4);
        doc.text(value, pageWidth - 50, yPos + 4);
        yPos += 6;
      });

      yPos += 5;

      // 💳 INGRESOS POR MÉTODO DE PAGO
      doc.setFontSize(14);
      doc.setTextColor(0, 168, 232);
      doc.text('INGRESOS POR MÉTODO DE PAGO', 14, yPos);
      yPos += 7;

      const paymentMethodLabels = {
        cash: 'Efectivo',
        card: 'Tarjeta',
        ath_movil: 'ATH Móvil',
        transfer: 'Transferencia',
        mixed: 'Mixto'
      };

      const paymentData = Object.entries(revenueByPaymentMethod)
        .filter(([_, data]) => data.amount > 0)
        .map(([method, data]) => [
          paymentMethodLabels[method] || method,
          data.count,
          `$${data.amount.toFixed(2)}`
        ]);

      // Tabla manual de métodos de pago
      doc.setFontSize(10);
      doc.setFillColor(16, 185, 129);
      doc.setTextColor(255, 255, 255);
      doc.rect(14, yPos, pageWidth - 28, 7, 'F');
      doc.text('Método', 16, yPos + 5);
      doc.text('Trans.', 90, yPos + 5);
      doc.text('Total', pageWidth - 40, yPos + 5);
      yPos += 7;

      doc.setTextColor(0, 0, 0);
      paymentData.forEach(([method, count, total], idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(14, yPos, pageWidth - 28, 6, 'F');
        }
        doc.text(method, 16, yPos + 4);
        doc.text(String(count), 90, yPos + 4);
        doc.text(total, pageWidth - 40, yPos + 4);
        yPos += 6;
      });

      yPos += 5;

      // 💸 GASTOS POR CATEGORÍA
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(0, 168, 232);
      doc.text('GASTOS POR CATEGORÍA', 14, yPos);
      yPos += 7;

      const expensesData = Object.entries(expensesByCategory)
        .filter(([_, cat]) => cat.total > 0)
        .map(([key, cat]) => [
          `${cat.icon} ${cat.label}`,
          cat.items.length,
          `$${cat.total.toFixed(2)}`
        ]);

      // Tabla manual de gastos
      doc.setFontSize(10);
      doc.setFillColor(239, 68, 68);
      doc.setTextColor(255, 255, 255);
      doc.rect(14, yPos, pageWidth - 28, 7, 'F');
      doc.text('Categoría', 16, yPos + 5);
      doc.text('Cant.', 120, yPos + 5);
      doc.text('Total', pageWidth - 40, yPos + 5);
      yPos += 7;

      doc.setTextColor(0, 0, 0);
      expensesData.forEach(([category, count, total], idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(14, yPos, pageWidth - 28, 6, 'F');
        }
        doc.text(category, 16, yPos + 4);
        doc.text(String(count), 120, yPos + 4);
        doc.text(total, pageWidth - 40, yPos + 4);
        yPos += 6;
      });

      yPos += 5;

      // 📦 DETALLE DE VENTAS
      if (yPos > 230) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(0, 168, 232);
      doc.text('DETALLE DE VENTAS', 14, yPos);
      yPos += 7;

      const salesData = filteredSales.slice(0, 50).map(s => [
        s.sale_number,
        format(new Date(s.created_date), 'dd/MM/yy HH:mm'),
        s.customer_name || 'Cliente',
        paymentMethodLabels[s.payment_method] || s.payment_method,
        `$${(s.total || 0).toFixed(2)}`
      ]);

      // Tabla manual de ventas (primeras 20)
      doc.setFontSize(9);
      doc.setFillColor(0, 168, 232);
      doc.setTextColor(255, 255, 255);
      doc.rect(14, yPos, pageWidth - 28, 6, 'F');
      doc.text('#Venta', 16, yPos + 4);
      doc.text('Fecha', 55, yPos + 4);
      doc.text('Cliente', 90, yPos + 4);
      doc.text('Método', 135, yPos + 4);
      doc.text('Total', pageWidth - 30, yPos + 4);
      yPos += 6;

      doc.setTextColor(0, 0, 0);
      salesData.slice(0, 20).forEach(([num, date, customer, method, total], idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        if (idx % 2 === 0) {
          doc.setFillColor(245, 245, 245);
          doc.rect(14, yPos, pageWidth - 28, 5, 'F');
        }
        doc.text(num, 16, yPos + 3.5);
        doc.text(date, 55, yPos + 3.5);
        doc.text(customer.substring(0, 15), 90, yPos + 3.5);
        doc.text(method.substring(0, 8), 135, yPos + 3.5);
        doc.text(total, pageWidth - 30, yPos + 3.5);
        yPos += 5;
      });

      // Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`SmartFixOS - Reporte Financiero`, 14, doc.internal.pageSize.getHeight() - 10);
        doc.text(`Página ${i} de ${totalPages}`, pageWidth - 40, doc.internal.pageSize.getHeight() - 10);
      }

      doc.save(`reporte_financiero_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
      toast.success("✅ Reporte PDF exportado");
    } catch (error) {
      console.error("Error exportando PDF:", error);
      toast.error("❌ Error al exportar PDF");
    }
  };

  // 📊 EXPORTAR A EXCEL (CSV)
  const exportToExcel = () => {
    try {
      let csv = '\uFEFF'; // UTF-8 BOM
      csv += "SMARTFIXOS - REPORTE FINANCIERO DETALLADO\n\n";
      csv += `Período:,${format(filterStart, 'dd/MM/yyyy')} - ${format(filterEnd, 'dd/MM/yyyy')}\n`;
      csv += `Generado:,${format(new Date(), 'dd/MM/yyyy HH:mm')}\n\n`;

      // RESUMEN
      csv += "RESUMEN EJECUTIVO\n";
      csv += "Concepto,Monto\n";
      csv += `Ingresos Brutos,${totalGrossRevenue.toFixed(2)}\n`;
      csv += `Ingresos Netos (sin IVU),${totalNetRevenue.toFixed(2)}\n`;
      csv += `IVU Recaudado,${totalTaxCollected.toFixed(2)}\n`;
      csv += `Total Gastos,${totalExpenses.toFixed(2)}\n`;
      csv += `Utilidad Neta,${netProfit.toFixed(2)}\n`;
      csv += `Total Transacciones,${filteredSales.length + filteredRecharges.length}\n\n`;

      // MÉTODOS DE PAGO
      csv += "INGRESOS POR MÉTODO DE PAGO\n";
      csv += "Método,Transacciones,Total\n";
      Object.entries(revenueByPaymentMethod).forEach(([method, data]) => {
        if (data.amount > 0) {
          const label = { cash: 'Efectivo', card: 'Tarjeta', ath_movil: 'ATH Móvil', transfer: 'Transferencia', mixed: 'Mixto' }[method] || method;
          csv += `${label},${data.count},${data.amount.toFixed(2)}\n`;
        }
      });
      csv += "\n";

      // GASTOS POR CATEGORÍA
      csv += "GASTOS POR CATEGORÍA\n";
      csv += "Categoría,Cantidad,Total\n";
      Object.entries(expensesByCategory).forEach(([key, cat]) => {
        if (cat.total > 0) {
          csv += `"${cat.label}",${cat.items.length},${cat.total.toFixed(2)}\n`;
        }
      });
      csv += "\n";

      // DETALLE VENTAS
      csv += "DETALLE DE VENTAS\n";
      csv += "#Venta,Fecha,Hora,Cliente,Items,Método,Subtotal,IVU,Total\n";
      filteredSales.forEach(s => {
        const fecha = format(new Date(s.created_date), 'dd/MM/yyyy');
        const hora = format(new Date(s.created_date), 'HH:mm:ss');
        csv += `${s.sale_number},${fecha},${hora},"${s.customer_name || 'Cliente'}",${s.items?.length || 0},${s.payment_method},${(s.subtotal || 0).toFixed(2)},${(s.tax_amount || 0).toFixed(2)},${(s.total || 0).toFixed(2)}\n`;
      });
      csv += "\n";

      // DETALLE GASTOS
      csv += "DETALLE DE GASTOS\n";
      csv += "Fecha,Hora,Categoría,Descripción,Monto,Registrado Por\n";
      filteredExpenses.forEach(e => {
        const fecha = format(new Date(e.created_date), 'dd/MM/yyyy');
        const hora = format(new Date(e.created_date), 'HH:mm:ss');
        csv += `${fecha},${hora},${e.category || 'General'},"${e.description || 'Sin descripción'}",${(e.amount || 0).toFixed(2)},"${e.recorded_by || 'Sistema'}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `reporte_financiero_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("✅ Reporte Excel (CSV) exportado");
    } catch (error) {
      console.error("Error exportando Excel:", error);
      toast.error("❌ Error al exportar Excel");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-cyan-500/20 rounded-full" />
          <div className="absolute top-0 w-20 h-20 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <PieChart className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-cyan-400" />
        </div>
        <div className="text-center">
          <p className="text-xl font-black text-white tracking-tighter mb-2">Compilando Inteligencia Financiera</p>
          <p className="text-sm text-white/30 uppercase tracking-[0.2em] font-bold">Analizando flujos de caja y distribución...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pt-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* 📊 RESUMEN EJECUTIVO */}
      <div className="relative overflow-hidden bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl group">
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-cyan-600/10 rounded-full blur-[100px]" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <BarChart3 className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight">Resumen de Inteligencia</h3>
              <p className="text-xs text-white/30 font-bold uppercase tracking-[0.2em]">Visión General del Rendimiento</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={exportToPDF}
              className="bg-white/5 border-white/10 text-white hover:bg-cyan-500/20 hover:text-cyan-400 hover:border-cyan-500/30 rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 px-4 transition-all"
            >
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button
              variant="outline"
              onClick={exportToExcel}
              className="bg-white/5 border-white/10 text-white hover:bg-emerald-500/20 hover:text-emerald-400 hover:border-emerald-500/30 rounded-xl font-bold uppercase tracking-widest text-[10px] h-10 px-4 transition-all"
            >
              <Download className="w-4 h-4 mr-2" /> Excel
            </Button>
          </div>
        </div>

        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Main Net Profit Card */}
          <div className={`lg:col-span-3 p-8 rounded-[32px] border transition-all duration-500 ${netProfit >= 0 ? 'bg-emerald-500/5 border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'bg-red-500/5 border-red-500/20 shadow-lg shadow-red-500/5'}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <p className={`text-xs font-black uppercase tracking-[0.3em] mb-2 ${netProfit >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>Utilidad Neta del Período</p>
                <h4 className={`text-6xl font-black tracking-tighter ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h4>
              </div>
              <div className="flex gap-4">
                <div className="text-right">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Transacciones</p>
                  <p className="text-2xl font-black text-white">{filteredSales.length + filteredRecharges.length}</p>
                </div>
                <div className="w-px h-12 bg-white/10 mx-2 self-center" />
                <div className="text-right">
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-1">Efectividad</p>
                  <p className="text-2xl font-black text-cyan-400">{totalNetRevenue > 0 ? Math.round((netProfit / totalNetRevenue) * 100) : 0}%</p>
                </div>
              </div>
            </div>
          </div>

          {[
            { label: 'Ingresos Brutos', value: totalGrossRevenue, color: 'emerald', icon: DollarSign, sub: 'Ventas + Comisiones' },
            { label: 'Ingresos Netos', value: totalNetRevenue, color: 'cyan', icon: TrendingUp, sub: 'Excluyendo Impuestos' },
            { label: 'IVU Recaudado', value: totalTaxCollected, color: 'blue', icon: Receipt, sub: 'Retención Gubernamental' },
            { label: 'Total Gastos', value: totalExpenses, color: 'red', icon: TrendingDown, sub: 'Operativos + Fijos' },
            { label: 'Ticket Promedio', value: filteredSales.length > 0 ? totalGrossRevenue / filteredSales.length : 0, color: 'amber', icon: Package, sub: 'Por Pedido' },
            { label: 'Impacto Gastos', value: totalGrossRevenue > 0 ? (totalExpenses / totalGrossRevenue) * 100 : 0, color: 'purple', icon: Target, isPercent: true, sub: 'Sobre Ingresos' }
          ].map((item, idx) => (
            <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-[32px] p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl bg-${item.color}-500/10 flex items-center justify-center border border-${item.color}-500/20`}>
                  <item.icon className={`w-5 h-5 text-${item.color}-400`} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{item.label}</p>
                  <p className="text-[9px] text-white/10 font-bold uppercase">{item.sub}</p>
                </div>
              </div>
              <p className="text-3xl font-black text-white tracking-tight">
                {item.isPercent ? '' : '$'}{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{item.isPercent ? '%' : ''}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 💳 INGRESOS POR MÉTODO DE PAGO */}
        <div className="relative overflow-hidden bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <CreditCard className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Fuentes de Ingreso</h3>
              <p className="text-xs text-white/30 font-bold uppercase tracking-widest">Distribución de Cobros</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(revenueByPaymentMethod).map(([method, data]) => {
              const icons = { cash: Wallet, card: CreditCard, ath_movil: Landmark, transfer: DollarSign, mixed: Receipt };
              const labels = { cash: 'Efectivo', card: 'Tarjeta', ath_movil: 'ATH Móvil', transfer: 'Transferencia', mixed: 'Mixto' };
              const Icon = icons[method];
              
              return (
                <div key={method} className="bg-white/[0.03] p-5 rounded-3xl border border-white/5 group hover:bg-emerald-500/5 hover:border-emerald-500/10 transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/5">
                        <Icon className="w-4 h-4 text-emerald-400" />
                      </div>
                      <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{labels[method]}</p>
                    </div>
                    <span className="text-[10px] font-black text-white/20">{data.count} ops</span>
                  </div>
                  <p className="text-2xl font-black text-white">${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                      style={{ width: `${totalGrossRevenue > 0 ? (data.amount / totalGrossRevenue) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 💸 GASTOS POR CATEGORÍA DETALLADOS */}
        <div className="relative overflow-hidden bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
              <PieChart className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">Análisis de Egresos</h3>
              <p className="text-xs text-white/30 font-bold uppercase tracking-widest">Distribución de Gastos</p>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(expensesByCategory).map(([key, cat]) => (
              <div key={key} className="bg-white/[0.03] p-5 rounded-3xl border border-white/5 hover:bg-red-500/5 hover:border-red-500/10 transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-black/40 flex items-center justify-center text-2xl border border-white/5 shadow-inner">
                      {cat.icon}
                    </div>
                    <div>
                      <p className="text-sm font-black text-white uppercase tracking-tight">{cat.label}</p>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{cat.items.length} Entradas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-red-400">${cat.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-widest">
                      {totalExpenses > 0 ? Math.round((cat.total / totalExpenses) * 100) : 0}% del total
                    </p>
                  </div>
                </div>
                <div className="mt-4 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" 
                    style={{ width: `${totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
