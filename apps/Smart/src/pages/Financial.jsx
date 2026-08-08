/**
 * Financial — dashboard de finanzas del taller.
 *
 * Simplificado de 7 pestañas a 3 (Resumen · Movimientos · Reportes), con
 * Desglose/Diferidos como sub-vista de Movimientos y Gráficos/Técnicos/
 * Presupuesto como sub-vista de Reportes. El resumen ejecutivo en Resumen lo
 * genera Gemini (gratis) — junto con el escaneo de recibos y la
 * auto-categorización, es el único proveedor de IA que usa finanzas ahora
 * (antes había 3 mezclados, dos de ellos con la llave expuesta en el
 * navegador). Ver geminiSummary.js, geminiCategorizeExpense.js y
 * aiExtractExpense.js.
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  Plus, ScanLine, FileText, Wallet, Sparkles, RefreshCw,
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

const PRIMARY_TABS = [
  { id: "resumen", label: "Resumen", icon: Sparkles },
  { id: "movimientos", label: "Movimientos", icon: Wallet },
  { id: "reportes", label: "Reportes", icon: FileText },
];

const MOV_SUBTABS = [
  { id: "todos", label: "Todos" },
  { id: "desglose", label: "Desglose" },
  { id: "diferidos", label: "Diferidos" },
];

const REPORT_SUBTABS = [
  { id: "reportes", label: "Reportes" },
  { id: "graficos", label: "Gráficos" },
  { id: "tecnicos", label: "Técnicos" },
  { id: "presupuesto", label: "Presupuesto" },
];

function SubTabs({ items, active, onChange }) {
  return (
    <div className="flex gap-1 mb-3">
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`apple-press rounded-apple-sm px-3 h-8 apple-text-caption1 font-semibold transition-all ${
            active === t.id ? "bg-apple-blue/15 text-apple-blue" : "apple-label-tertiary"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

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

  // Sub-pestañas de Movimientos y Reportes
  const [movSubTab, setMovSubTab] = useState("todos");
  const [reportSubTab, setReportSubTab] = useState("reportes");

  // Resumen de IA: se recalcula cuando cambian los datos del periodo, no
  // solo la primera vez que se abre la pestaña.
  useEffect(() => {
    if (fin.loading) return;
    fin.fetchAiSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fin.loading, fin.dateFilter, fin.totalRevenue, fin.totalExpenses]);

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

  // FinancialKPICards fue diseñado para pestañas planas (movimientos/desglose/
  // diferidos) — aquí las tres vivan dentro de "Movimientos", así que un click
  // navega al tab primario correcto y selecciona la sub-pestaña que corresponde.
  const handleCardClick = useCallback((tab, subFilter) => {
    if (tab === "desglose") { fin.setActiveTab("movimientos"); setMovSubTab("desglose"); return; }
    if (tab === "diferidos") { fin.setActiveTab("movimientos"); setMovSubTab("diferidos"); return; }
    fin.setActiveTab("movimientos");
    setMovSubTab("todos");
    if (subFilter) fin.setMovFilter(subFilter);
  }, [fin]);

  const handleViewPO = useCallback(() => {
    // No hay vista de órdenes de compra reconectada todavía en la web —
    // placeholder consciente, no un enlace roto silencioso.
    alert("El detalle de órdenes de compra todavía no está disponible en la web.");
  }, []);

  const kpiActiveTab = fin.activeTab === "movimientos" ? movSubTab : fin.activeTab;

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
          activeTab={kpiActiveTab}
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

      {/* Tabs primarios */}
      <div className="app-container pt-4 flex gap-1 overflow-x-auto pb-1">
        {PRIMARY_TABS.map((t) => {
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
        {fin.activeTab === "resumen" && (
          <div className="space-y-3">
            <div className="apple-card rounded-apple-lg p-4 bg-apple-purple/10 border border-apple-purple/20">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-apple-sm bg-apple-purple/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-apple-purple" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="apple-text-caption2 font-bold text-apple-purple uppercase tracking-wide">
                      Resumen generado por IA
                    </span>
                    <button
                      onClick={fin.fetchAiSummary}
                      disabled={fin.aiLoading}
                      className="apple-press w-6 h-6 rounded-apple-xs bg-apple-purple/15 text-apple-purple flex items-center justify-center shrink-0"
                      title="Regenerar"
                    >
                      <RefreshCw className={`w-3 h-3 ${fin.aiLoading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                  {fin.aiLoading ? (
                    <p className="apple-text-footnote apple-label-tertiary mt-2">Analizando tus finanzas...</p>
                  ) : fin.aiSummary ? (
                    <p className="apple-text-subheadline apple-label-primary mt-2 whitespace-pre-line leading-relaxed">
                      {fin.aiSummary}
                    </p>
                  ) : (
                    <p className="apple-text-footnote apple-label-tertiary mt-2">
                      Sin datos suficientes todavía para un resumen de este periodo.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {fin.paymentMethodBreakdown.length > 0 && (
              <div className="apple-card rounded-apple-lg p-4">
                <p className="apple-text-caption2 font-semibold apple-label-tertiary mb-2">Método de pago principal</p>
                <div className="flex items-center justify-between">
                  <span className="apple-text-subheadline font-semibold apple-label-primary">
                    {fin.paymentMethodBreakdown[0].emoji} {fin.paymentMethodBreakdown[0].label}
                  </span>
                  <span className="apple-text-subheadline font-bold apple-label-primary tabular-nums">
                    ${fin.paymentMethodBreakdown[0].total.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => { fin.setActiveTab("movimientos"); setMovSubTab("todos"); }}
              className="apple-press w-full text-left apple-text-footnote font-semibold text-apple-blue py-1"
            >
              Ver todos los movimientos →
            </button>
          </div>
        )}

        {fin.activeTab === "movimientos" && (
          <div>
            <SubTabs items={MOV_SUBTABS} active={movSubTab} onChange={setMovSubTab} />
            {movSubTab === "todos" && (
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
            {movSubTab === "desglose" && (
              <DesgloseTab filteredSales={fin.filteredSales} loading={fin.loading} />
            )}
            {movSubTab === "diferidos" && (
              <DeferredPaymentsPanel
                transactions={fin.transactions}
                mode="full"
                onTransactionsChanged={fin.handleManualRefresh}
              />
            )}
          </div>
        )}

        {fin.activeTab === "reportes" && (
          <div>
            <SubTabs items={REPORT_SUBTABS} active={reportSubTab} onChange={setReportSubTab} />
            {reportSubTab === "reportes" && (
              <EnhancedReports
                dateFilter={fin.dateFilter}
                customStartDate={fin.customStartDate}
                customEndDate={fin.customEndDate}
              />
            )}
            {reportSubTab === "graficos" && (
              <FinancialCharts
                sales={fin.filteredSales}
                expenses={fin.filteredExpenses}
                orders={orders}
                products={products}
                customers={fin.customersList}
              />
            )}
            {reportSubTab === "tecnicos" && (
              <TechnicianProductivityTab
                dateFilter={fin.dateFilter}
                customStartDate={fin.customStartDate}
                customEndDate={fin.customEndDate}
              />
            )}
            {reportSubTab === "presupuesto" && (
              <div className="space-y-3">
                <GastosOperacionalesWidget />
                <OneTimeExpensesWidget />
              </div>
            )}
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
