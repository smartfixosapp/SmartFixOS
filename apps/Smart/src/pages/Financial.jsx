/**
 * Financial — dashboard de finanzas del taller.
 *
 * Ensambla los 15 componentes de apps/Smart/src/components/financial/, que
 * existían en el repo sin ninguna página que los montara (huérfanos desde
 * el pivote a la app nativa iOS). useFinancialData ya trae todos los
 * cálculos (KPIs, movimientos combinados, desglose por venta, breakdown por
 * método de pago) con nombres de retorno que calzan exactamente con las
 * props de estos componentes — esta página es principalmente el "glue" que
 * faltaba, más el layout de pestañas.
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  Plus, ScanLine, FileText, Wallet, PieChart, TrendingUp,
  Users, PiggyBank, Bell,
} from "lucide-react";
import { dataClient } from "@/components/api/dataClient";
import useFinancialData from "@/hooks/useFinancialData";

import FinancialHeader from "@/components/financial/FinancialHeader";
import FinancialKPICards from "@/components/financial/FinancialKPICards";
import AlertasWidget from "@/components/financial/AlertasWidget";
import MovimientosTab from "@/components/financial/MovimientosTab";
import DesgloseTab from "@/components/financial/DesgloseTab";
import DeferredPaymentsPanel from "@/components/financial/DeferredPaymentsPanel";
import FinancialCharts from "@/components/financial/FinancialCharts";
import EnhancedReports from "@/components/financial/EnhancedReports";
import TechnicianProductivityTab from "@/components/financial/TechnicianProductivityTab";
import GastosOperacionalesWidget from "@/components/financial/GastosOperacionalesWidget";
import OneTimeExpensesWidget from "@/components/financial/OneTimeExpensesWidget";
import ExpenseDialog from "@/components/financial/ExpenseDialog";
import TransactionsModal from "@/components/financial/TransactionsModal";
import MonthlyReportModal from "@/components/financial/MonthlyReportModal";
import JenaiExpenseCapture from "@/components/financial/JenaiExpenseCapture";

const TABS = [
  { id: "movimientos", label: "Movimientos", icon: Wallet },
  { id: "desglose", label: "Desglose", icon: PieChart },
  { id: "diferidos", label: "Diferidos", icon: Bell },
  { id: "graficos", label: "Gráficos", icon: TrendingUp },
  { id: "reportes", label: "Reportes", icon: FileText },
  { id: "productividad", label: "Técnicos", icon: Users },
  { id: "presupuesto", label: "Presupuesto", icon: PiggyBank },
];

export default function Financial() {
  const fin = useFinancialData();

  // Datos extra solo para los gráficos de órdenes/inventario (no los trae el hook)
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [orderRows, productRows] = await Promise.all([
          dataClient.entities.Order.list("-updated_date", 1000).catch(() => []),
          dataClient.entities.Product.list().catch(() => []),
        ]);
        if (active) {
          setOrders(orderRows || []);
          setProducts(productRows || []);
        }
      } catch {
        // Los gráficos degradan a vacío si esto falla — no bloquea el resto de la página.
      }
    })();
    return () => { active = false; };
  }, []);

  // Modales
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [monthlyReportOpen, setMonthlyReportOpen] = useState(false);
  const [jenaiCaptureOpen, setJenaiCaptureOpen] = useState(false);

  const openNewExpense = useCallback(() => {
    setEditingExpense(null);
    setExpenseDialogOpen(true);
  }, []);

  const handleEditExpense = useCallback((raw) => {
    setEditingExpense(raw);
    setExpenseDialogOpen(true);
  }, []);

  const handleExpenseSuccess = useCallback(() => {
    setExpenseDialogOpen(false);
    setEditingExpense(null);
    fin.handleManualRefresh();
  }, [fin]);

  const handleCardClick = useCallback((tab, subFilter) => {
    fin.setActiveTab(tab);
    if (subFilter) fin.setMovFilter(subFilter);
  }, [fin]);

  const handleViewPO = useCallback(() => {
    // No hay vista de órdenes de compra reconectada todavía en la web —
    // placeholder consciente, no un enlace roto silencioso.
    alert("El detalle de órdenes de compra todavía no está disponible en la web.");
  }, []);

  return (
    <div className="apple-type min-h-dvh apple-surface pb-16">
      <FinancialHeader
        loading={fin.loading}
        totalMovements={fin.combinedMovements.length}
        dateFilter={fin.dateFilter}
        setDateFilter={fin.setDateFilter}
        customStartDate={fin.customStartDate}
        setCustomStartDate={fin.setCustomStartDate}
        customEndDate={fin.customEndDate}
        setCustomEndDate={fin.setCustomEndDate}
        onRefresh={fin.handleManualRefresh}
      />

      <div className="app-container pt-3">
        <AlertasWidget />
      </div>

      <div className="app-container pt-3">
        <FinancialKPICards
          totalRevenue={fin.totalRevenue}
          totalExpenses={fin.totalExpenses}
          netProfit={fin.netProfit}
          unsettledTotal={fin.unsettledTotal}
          todayRevenue={fin.todayRevenue}
          todayExpenses={fin.todayExpenses}
          filteredSalesCount={fin.filteredSales.length}
          activeTab={fin.activeTab}
          onCardClick={handleCardClick}
          dateFilter={fin.dateFilter}
        />
      </div>

      {/* Acciones rápidas */}
      <div className="app-container pt-3 flex flex-wrap gap-2">
        <button
          onClick={openNewExpense}
          className="apple-press inline-flex items-center gap-1.5 rounded-apple-md bg-apple-orange text-white px-3.5 h-9 apple-text-footnote font-semibold"
        >
          <Plus className="w-3.5 h-3.5" /> Gasto
        </button>
        <button
          onClick={() => setJenaiCaptureOpen(true)}
          className="apple-press inline-flex items-center gap-1.5 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary px-3.5 h-9 apple-text-footnote font-semibold"
        >
          <ScanLine className="w-3.5 h-3.5" /> Escanear recibo (IA)
        </button>
        <button
          onClick={() => setTransactionsModalOpen(true)}
          className="apple-press inline-flex items-center gap-1.5 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary px-3.5 h-9 apple-text-footnote font-semibold"
        >
          <Wallet className="w-3.5 h-3.5" /> Ventas
        </button>
        <button
          onClick={() => setMonthlyReportOpen(true)}
          className="apple-press inline-flex items-center gap-1.5 rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 apple-label-primary px-3.5 h-9 apple-text-footnote font-semibold"
        >
          <FileText className="w-3.5 h-3.5" /> Reporte mensual
        </button>
      </div>

      {/* Tabs */}
      <div className="app-container pt-4 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = fin.activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => fin.setActiveTab(t.id)}
              className={`apple-press shrink-0 inline-flex items-center gap-1.5 rounded-apple-md px-3 h-9 apple-text-footnote font-semibold transition-all ${
                active ? "bg-apple-blue text-white" : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary"
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="app-container pt-3">
        {fin.activeTab === "movimientos" && (
          <MovimientosTab
            combinedMovements={fin.combinedMovements}
            movFilter={fin.movFilter}
            setMovFilter={fin.setMovFilter}
            loading={fin.loading}
            paymentMethodBreakdown={fin.paymentMethodBreakdown}
            onEditExpense={handleEditExpense}
            onDeleteExpense={fin.handleDeleteExpense}
            onViewPO={handleViewPO}
          />
        )}

        {fin.activeTab === "desglose" && (
          <DesgloseTab filteredSales={fin.filteredSales} loading={fin.loading} />
        )}

        {fin.activeTab === "diferidos" && (
          <DeferredPaymentsPanel
            transactions={fin.transactions}
            mode="full"
            onTransactionsChanged={fin.handleManualRefresh}
          />
        )}

        {fin.activeTab === "graficos" && (
          <FinancialCharts
            sales={fin.filteredSales}
            expenses={fin.filteredExpenses}
            orders={orders}
            products={products}
            customers={fin.customersList}
          />
        )}

        {fin.activeTab === "reportes" && (
          <EnhancedReports
            dateFilter={fin.dateFilter}
            customStartDate={fin.customStartDate}
            customEndDate={fin.customEndDate}
          />
        )}

        {fin.activeTab === "productividad" && (
          <TechnicianProductivityTab
            dateFilter={fin.dateFilter}
            customStartDate={fin.customStartDate}
            customEndDate={fin.customEndDate}
          />
        )}

        {fin.activeTab === "presupuesto" && (
          <div className="space-y-3">
            <GastosOperacionalesWidget />
            <OneTimeExpensesWidget />
          </div>
        )}
      </div>

      <ExpenseDialog
        open={expenseDialogOpen}
        onClose={() => { setExpenseDialogOpen(false); setEditingExpense(null); }}
        onSuccess={handleExpenseSuccess}
        drawer={fin.currentDrawer}
        editingExpense={editingExpense}
      />
      <TransactionsModal
        open={transactionsModalOpen}
        onClose={() => setTransactionsModalOpen(false)}
        sales={fin.filteredSales}
        title="Ventas del periodo"
      />
      <MonthlyReportModal
        open={monthlyReportOpen}
        onClose={() => setMonthlyReportOpen(false)}
      />
      <JenaiExpenseCapture
        open={jenaiCaptureOpen}
        onClose={() => setJenaiCaptureOpen(false)}
        onSuccess={() => { setJenaiCaptureOpen(false); fin.handleManualRefresh(); }}
      />
    </div>
  );
}
