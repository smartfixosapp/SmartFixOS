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
      <div className="apple-type flex items-center justify-center py-10 gap-3">
        <BarChart3 className="w-4 h-4 text-apple-blue animate-pulse" />
        <p className="apple-text-footnote apple-label-tertiary font-semibold">Cargando reporte…</p>
      </div>
    );
  }

  const kpiColorMap = {
    green: "text-apple-green",
    blue: "text-apple-blue",
    indigo: "text-apple-indigo",
    red: "text-apple-red",
    orange: "text-apple-orange",
    purple: "text-apple-purple",
  };

  return (
    <div className="apple-type space-y-3">

      {/* Cabecera + exportar */}
      <div className="flex items-center justify-between gap-2">
        <p className="apple-text-caption2 font-semibold apple-label-tertiary">Resumen del período</p>
        <div className="flex gap-1.5">
          <button onClick={exportToPDF}
            className="apple-press flex items-center gap-1.5 px-3 py-1.5 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary apple-text-caption1 font-semibold transition-colors">
            <FileText className="w-3 h-3" /> PDF
          </button>
          <button onClick={exportToExcel}
            className="apple-press flex items-center gap-1.5 px-3 py-1.5 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary apple-text-caption1 font-semibold transition-colors">
            <Download className="w-3 h-3" /> Excel
          </button>
        </div>
      </div>

      {/* Neto + transacciones */}
      <div className={`apple-card flex items-center justify-between p-4 rounded-apple-md ${netProfit >= 0 ? 'bg-apple-green/12' : 'bg-apple-red/12'}`}>
        <div>
          <p className={`apple-text-caption2 font-semibold mb-0.5 ${netProfit >= 0 ? 'text-apple-green' : 'text-apple-red'}`}>Utilidad neta</p>
          <p className={`apple-text-large-title tabular-nums leading-none ${netProfit >= 0 ? 'text-apple-green' : 'text-apple-red'}`}>
            ${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="apple-text-caption2 apple-label-tertiary font-semibold">Transacciones</p>
            <p className="apple-text-title2 tabular-nums apple-label-primary">{filteredSales.length + filteredRecharges.length}</p>
          </div>
          <div>
            <p className="apple-text-caption2 apple-label-tertiary font-semibold">Efectividad</p>
            <p className="apple-text-title2 tabular-nums text-apple-blue">{totalNetRevenue > 0 ? Math.round((netProfit / totalNetRevenue) * 100) : 0}%</p>
          </div>
        </div>
      </div>

      {/* KPIs grid 2×3 */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: 'Brutos', value: totalGrossRevenue, color: 'green', icon: DollarSign },
          { label: 'Netos', value: totalNetRevenue, color: 'blue', icon: TrendingUp },
          { label: 'IVU', value: totalTaxCollected, color: 'indigo', icon: Receipt },
          { label: 'Gastos', value: totalExpenses, color: 'red', icon: TrendingDown },
          { label: 'Ticket avg', value: filteredSales.length > 0 ? totalGrossRevenue / filteredSales.length : 0, color: 'orange', icon: Package },
          { label: '% Gastos', value: totalGrossRevenue > 0 ? (totalExpenses / totalGrossRevenue) * 100 : 0, color: 'purple', icon: Target, isPercent: true },
        ].map((item, idx) => (
          <div key={idx} className="apple-card rounded-apple-sm p-3">
            <item.icon className={`w-3 h-3 mb-1.5 ${kpiColorMap[item.color]}`} />
            <p className={`apple-text-headline tabular-nums leading-none ${kpiColorMap[item.color]}`}>
              {item.isPercent ? '' : '$'}{item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{item.isPercent ? '%' : ''}
            </p>
            <p className="apple-text-caption2 apple-label-tertiary font-semibold mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      {/* Fuentes de ingreso */}
      {Object.values(revenueByPaymentMethod).some(d => d.amount > 0) && (
        <div className="apple-card rounded-apple-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-3.5 h-3.5 text-apple-green" />
            <p className="apple-text-caption2 font-semibold apple-label-tertiary">Fuentes de ingreso</p>
          </div>
          <div className="space-y-2">
            {Object.entries(revenueByPaymentMethod)
              .filter(([, data]) => data.amount > 0)
              .map(([method, data]) => {
                const icons = { cash: Wallet, card: CreditCard, ath_movil: Landmark, transfer: DollarSign, mixed: Receipt };
                const labels = { cash: 'Efectivo', card: 'Tarjeta', ath_movil: 'ATH Móvil', transfer: 'Transferencia', mixed: 'Mixto' };
                const Icon = icons[method];
                const pct = totalGrossRevenue > 0 ? (data.amount / totalGrossRevenue) * 100 : 0;
                return (
                  <div key={method} className="flex items-center gap-2.5">
                    <Icon className="w-3.5 h-3.5 text-apple-green shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="apple-text-caption1 font-semibold apple-label-primary">{labels[method]}</span>
                        <span className="apple-text-caption1 font-semibold tabular-nums text-apple-green">${data.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-gray-sys6 dark:bg-gray-sys5 rounded-full h-1">
                        <div className="h-full rounded-full bg-apple-green" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="apple-text-caption2 apple-label-tertiary font-semibold tabular-nums w-7 text-right shrink-0">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Egresos por categoría */}
      {totalExpenses > 0 && (
        <div className="apple-card rounded-apple-md p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-3.5 h-3.5 text-apple-red" />
            <p className="apple-text-caption2 font-semibold apple-label-tertiary">Egresos por categoría</p>
          </div>
          <div className="space-y-2.5">
            {Object.entries(expensesByCategory)
              .filter(([, cat]) => cat.total > 0)
              .map(([key, cat]) => {
                const pct = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm w-6 text-center shrink-0">{cat.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="apple-text-caption1 font-semibold apple-label-primary truncate">{cat.label}</span>
                        <span className="apple-text-caption1 font-semibold tabular-nums text-apple-red shrink-0 ml-2">${cat.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="w-full bg-gray-sys6 dark:bg-gray-sys5 rounded-full h-1">
                        <div className="h-full rounded-full bg-apple-red" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="apple-text-caption2 apple-label-tertiary font-semibold tabular-nums w-7 text-right shrink-0">{pct.toFixed(0)}%</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
