import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign, Calculator, Lock, Banknote, CreditCard, ArrowUpCircle, TrendingDown, FileDown, Receipt } from "lucide-react";
import { closeCashRegister } from "@/components/cash/CashRegisterService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { dataClient as base44 } from "@/components/api/dataClient";
import EditDenominationModal from "./EditDenominationModal";
import EditAmountModal from "./EditAmountModal";
import { createCashRegisterClosingEmail, getBusinessInfo } from "../utils/emailTemplates";

// Definición de denominaciones
const DENOMINATIONS = [
    { id: 'bills_100', label: '$100', value: 100, color: 'bg-apple-purple/15', textColor: 'text-apple-purple' },
    { id: 'bills_50', label: '$50', value: 50, color: 'bg-apple-blue/15', textColor: 'text-apple-blue' },
    { id: 'bills_20', label: '$20', value: 20, color: 'bg-apple-green/15', textColor: 'text-apple-green' },
    { id: 'bills_10', label: '$10', value: 10, color: 'bg-apple-yellow/15', textColor: 'text-apple-yellow' },
    { id: 'bills_5', label: '$5', value: 5, color: 'bg-apple-orange/15', textColor: 'text-apple-orange' },
    { id: 'bills_1', label: '$1', value: 1, color: 'bg-apple-red/15', textColor: 'text-apple-red' },
    { id: 'coins_025', label: '$0.25', value: 0.25, type: 'coin', color: 'bg-gray-sys6 dark:bg-gray-sys5', textColor: 'apple-label-secondary' },
    { id: 'coins_010', label: '$0.10', value: 0.10, type: 'coin', color: 'bg-gray-sys6 dark:bg-gray-sys5', textColor: 'apple-label-secondary' },
    { id: 'coins_005', label: '$0.05', value: 0.05, type: 'coin', color: 'bg-gray-sys6 dark:bg-gray-sys5', textColor: 'apple-label-secondary' },
    { id: 'coins_001', label: '$0.01', value: 0.01, type: 'coin', color: 'bg-gray-sys6 dark:bg-gray-sys5', textColor: 'apple-label-secondary' },
];

function sumPaymentMethodsFromSale(sale) {
  const methods = Array.isArray(sale?.payment_details?.methods) ? sale.payment_details.methods : [];
  if (!methods.length) {
    const total = Number(sale?.amount_paid || sale?.total || 0);
    const method = sale?.payment_method;
    return {
      cash: method === "cash" ? total : 0,
      card: method === "card" ? total : 0,
      ath: method === "ath_movil" ? total : 0
    };
  }
  return methods.reduce((acc, m) => {
    const amount = Number(m?.amount || 0);
    const method = m?.method;
    if (method === "cash") acc.cash += amount;
    if (method === "card") acc.card += amount;
    if (method === "ath_movil") acc.ath += amount;
    return acc;
  }, { cash: 0, card: 0, ath: 0 });
}

export default function CloseDrawerDialog({ isOpen, onClose, drawer, onSuccess }) {
  const [denominations, setDenominations] = useState({});
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [salesSummary, setSalesSummary] = useState(null);
  const [editingSummaryField, setEditingSummaryField] = useState(null);
  const [dailyExpenses, setDailyExpenses] = useState([]);
  const [showATHModal, setShowATHModal] = useState(false);
  const [athTransactions, setAthTransactions] = useState([]);
  const [loadingATH, setLoadingATH] = useState(false);
  const [paymentMethodsList, setPaymentMethodsList] = useState(['cash','card','ath_movil']);
  const [shiftOrderStats, setShiftOrderStats] = useState(null);

  // Refs para long press
  const pressTimer = useRef(null);
  const isLongPress = useRef(false);

  const buildDefaultSummary = () => {
    const opening = Number(drawer?.opening_balance || 0);
    return {
      totalCash: 0,
      totalCard: 0,
      totalATH: 0,
      expectedCash: Math.round(opening * 100) / 100,
      totalRevenue: 0,
      partsCost: 0,
      realProfit: 0,
      moneyToSetAside: 0
    };
  };

  useEffect(() => {
    if (isOpen && drawer) {
      setDenominations({});
      setEditingItem(null);
      setSalesSummary(buildDefaultSummary());
      fetchSalesSummary();
    }
  }, [isOpen, drawer]);

  const fetchSalesSummary = async () => {
    try {
      const drawerOpenDate = new Date(drawer.created_date);
      // Fetch sales, fixed expenses and daily transactions
      const [sales, fixedExpenses, allTransactions] = await Promise.all([
        base44.entities.Sale.filter({}, "-created_date", 1000),
        base44.entities.FixedExpense.list("-created_date", 100).catch(() => []),
        base44.entities.Transaction.list("-created_date", 500).catch(() => [])
      ]);

      // Filtrar gastos del turno actual
      const expensesInDrawer = (allTransactions || []).filter(t => {
        if (t.type !== "expense") return false;
        try { return new Date(t.created_date) >= drawerOpenDate; } catch { return false; }
      });
      setDailyExpenses(expensesInDrawer); 
      
      const salesInDrawer = sales.filter(s => {
        if (s.voided) return false;
        try {
           return new Date(s.created_date) >= drawerOpenDate;
        } catch { return false; }
      });

      const totalsByMethod = salesInDrawer.reduce((acc, sale) => {
        const t = sumPaymentMethodsFromSale(sale);
        acc.cash += t.cash;
        acc.card += t.card;
        acc.ath += t.ath;
        return acc;
      }, { cash: 0, card: 0, ath: 0 });

      const totalCash = totalsByMethod.cash;
      const totalCard = totalsByMethod.card;
      const totalATH = totalsByMethod.ath;

      const expectedCash = (drawer.opening_balance || 0) + totalCash;
      const totalRevenue = salesInDrawer.reduce((sum, s) => sum + (s.amount_paid || s.total || 0), 0);
      
      // Calcular Costo de Piezas y Ganancia Real
      const partsCost = salesInDrawer.reduce((sum, sale) => {
        const items = Array.isArray(sale?.items) ? sale.items : [];
        return sum + items.reduce((iSum, item) => {
          const qty = Number(item?.quantity || 0);
          return iSum + Number(item?.line_cost || (Number(item?.cost || 0) * qty));
        }, 0);
      }, 0);

      const realProfit = salesInDrawer.reduce((sum, sale) => {
        const items = Array.isArray(sale?.items) ? sale.items : [];
        return sum + items.reduce((iSum, item) => {
          const qty = Number(item?.quantity || 0);
          const total = Number(item?.total || (Number(item?.price || 0) * qty));
          const lineCost = Number(item?.line_cost || (Number(item?.cost || 0) * qty));
          const explicitLineProfit = item?.line_profit;
          const lineProfit = explicitLineProfit != null ? Number(explicitLineProfit || 0) : (total - lineCost);
          return iSum + lineProfit;
        }, 0);
      }, 0);

      // Calcular Dinero a Apartar según FixedExpenses
      const moneyToSetAside = fixedExpenses.reduce((sum, expense) => {
        if (!expense.active) return sum;
        const percentage = Number(expense.percentage || 0);
        
        let fixedAmount = 0;
        try {
          const parsed = JSON.parse(expense.notes);
          if (parsed && typeof parsed === "object") fixedAmount = Number(parsed.fixed_amount || 0);
        } catch {}

        const dailyByPercentage = Math.max(0, realProfit) > 0 ? (realProfit * (percentage / 100)) : 0;
        const divisors = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 90, yearly: 365 };
        const divisor = divisors[expense.frequency] || 30;
        const dailyByAmount = fixedAmount > 0 ? fixedAmount / divisor : 0;
        
        // Asume modo de "Porcentaje" por defecto si se ingresó porcentaje, de lo contrario fijo.
        const setAside = percentage > 0 ? dailyByPercentage : dailyByAmount;
        return sum + setAside;
      }, 0);

      // Load configured payment methods from settings
      try {
        const settingsRecs = await base44.entities.AppSettings.filter({ slug: "general.pos.payment_methods" }).catch(() => []);
        if (settingsRecs?.length > 0) {
          const raw = settingsRecs[0].value || "Cash, Card, ATH Móvil";
          const methods = raw.split(",").map(m => m.trim().toLowerCase()
            .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i').replace(/ó/g, 'o').replace(/ú/g, 'u')
            .replace(/\s+/g, '_'));
          setPaymentMethodsList(methods.length > 0 ? methods : ['cash','card','ath_movil']);
        }
      } catch {}

      // Build ATH transactions with details
      const athSales = salesInDrawer.filter(s => {
        if (s.payment_method === 'ath_movil') return true;
        const methods = Array.isArray(s.payment_details?.methods) ? s.payment_details.methods : [];
        return methods.some(m => m.method === 'ath_movil' && Number(m.amount || 0) > 0);
      });
      setAthTransactions(athSales.map(s => {
        const methods = Array.isArray(s.payment_details?.methods) ? s.payment_details.methods : [];
        const athAmount = methods.length > 0
          ? methods.filter(m => m.method === 'ath_movil').reduce((sum, m) => sum + Number(m.amount || 0), 0)
          : (s.payment_method === 'ath_movil' ? Number(s.amount_paid || s.total || 0) : 0);
        return {
          id: s.id,
          customerName: s.customer_name || s.customer?.name || 'Sin nombre',
          customerPhone: s.customer_phone || s.customer?.phone || '',
          amount: athAmount,
          date: s.created_date,
          reference: s.order_number || s.id?.slice(-6) || ''
        };
      }));

      // Fetch orders completed/updated during this shift
      try {
        const allOrders = await base44.entities.Order.filter({}, "-updated_date", 500).catch(() => []);
        const shiftOrders = (allOrders || []).filter(o => {
          try { return new Date(o.updated_date || o.created_date) >= drawerOpenDate; } catch { return false; }
        });
        const completedStatuses = ["ready_for_pickup", "delivered", "completed", "warranty"];
        const completedInShift = shiftOrders.filter(o => completedStatuses.includes(o.status || o.current_status));
        const newInShift = shiftOrders.filter(o => new Date(o.created_date) >= drawerOpenDate);
        setShiftOrderStats({
          total: shiftOrders.length,
          completed: completedInShift.length,
          newOrders: newInShift.length,
        });
      } catch { /* silent */ }

      // Round to 2 decimals to avoid floating point artifacts
      setSalesSummary({
        totalCash: Math.round(totalCash * 100) / 100,
        totalCard: Math.round(totalCard * 100) / 100,
        totalATH: Math.round(totalATH * 100) / 100,
        expectedCash: Math.round(expectedCash * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        partsCost: Math.round(partsCost * 100) / 100,
        realProfit: Math.round(realProfit * 100) / 100,
        moneyToSetAside: Math.round(moneyToSetAside * 100) / 100
      });
    } catch (error) {
      console.error("Error fetching sales summary:", error);
      setSalesSummary(buildDefaultSummary());
    }
  };

  const total = DENOMINATIONS.reduce((sum, d) => sum + (denominations[d.id] || 0) * d.value, 0);

  const handleClose = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      
      // 1. Cerrar caja en el sistema
      const closingResult = await closeCashRegister(drawer, denominations, user, summary);
      
      // 2. Intentar enviar email de resumen
      try {
        const businessInfo = await getBusinessInfo();
        const emailTemplate = createCashRegisterClosingEmail({
          drawerDate: new Date(drawer.created_date).toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          openedBy: drawer.opened_by || "Técnico",
          closedBy: user?.full_name || user?.email || "Técnico",
          openingBalance: drawer.opening_balance || 0,
          totalRevenue: summary.totalRevenue,
          totalCashSales: summary.totalCash,
          totalCardSales: summary.totalCard,
          totalAthSales: summary.totalATH,
          countedCash: total,
          expectedCash: summary.expectedCash,
          difference: total - summary.expectedCash,
          businessInfo: businessInfo,
          logoUrl: businessInfo.logo_url
        });

        await base44.integrations.Core.SendEmail({
          to: businessInfo.email || "info@smartfixos.com", // Fallback a email de configuración
          subject: emailTemplate.subject,
          body: emailTemplate.body
        });
        toast.success("Resumen enviado por email");
      } catch (emailError) {
        console.warn("No se pudo enviar el email de cierre:", emailError);
      }

      toast.success("Caja cerrada exitosamente");
      window.dispatchEvent(new Event('cash-register-closed'));
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      console.error("Error closing drawer:", error);
      toast.error(error.message || "Error al cerrar caja");
    } finally {
      setLoading(false);
    }
  };

  const handleSummaryUpdate = (val) => {
    if (!editingSummaryField) return;
    const field = editingSummaryField.field;
    
    setSalesSummary(prev => {
      const current = prev || buildDefaultSummary();
      const prevVal = parseFloat(current[field]) || 0;
      const diff = val - prevVal;
      
      const newSummary = { ...current, [field]: val };
      
      // Ajustar Total Revenue
      if (['totalCash', 'totalCard', 'totalATH'].includes(field)) {
          newSummary.totalRevenue = Math.round(((parseFloat(current.totalRevenue) || 0) + diff) * 100) / 100;
      }
      
      // Ajustar Expected Cash si cambia el efectivo
      if (field === 'totalCash') {
        newSummary.expectedCash = Math.round((drawer.opening_balance + val) * 100) / 100;
      }
      
      return newSummary;
    });
    setEditingSummaryField(null);
  };

  // --- Long Press Logic ---
  const handleStart = (denom, e) => {
    if (e) e.preventDefault();
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (navigator.vibrate) navigator.vibrate(50);
      setEditingItem(denom);
    }, 500);
  };

  const handleEnd = (denom, e) => {
    if (e) e.preventDefault();
    
    const wasLongPress = isLongPress.current;
    
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    
    // Solo incrementar si fue click corto
    if (!wasLongPress) {
      setDenominations(prev => ({ ...prev, [denom.id]: (prev[denom.id] || 0) + 1 }));
      if (navigator.vibrate) navigator.vibrate(5);
    }
    
    isLongPress.current = false;
  };

  const handleCancel = (e) => {
    if (e) e.preventDefault();
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    isLongPress.current = false;
  };

  const handleClick = (denom, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDenominations(prev => ({ ...prev, [denom.id]: (prev[denom.id] || 0) + 1 }));
    if (navigator.vibrate) navigator.vibrate(5);
  };

  const handleUpdateQty = (newQty) => {
     if (editingItem) {
         setDenominations(prev => ({ ...prev, [editingItem.id]: newQty }));
     }
  };

  const totalExpenses = dailyExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netProfit = (salesSummary?.totalRevenue || 0) - totalExpenses;

  const handleExportPDF = () => {
    const s = salesSummary || buildDefaultSummary();
    const dateStr = new Date().toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Cierre de Caja — ${dateStr}</title>
    <style>
      body{font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;padding:32px;color:#111}
      h1{font-size:22px;font-weight:800;margin:0 0 4px}
      .sub{color:#666;font-size:13px;margin-bottom:24px}
      .section{background:#f8f8f8;border-radius:12px;padding:16px;margin-bottom:16px}
      .section h2{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#888;margin:0 0 12px}
      .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee;font-size:14px}
      .row:last-child{border-bottom:none}
      .row.total{font-weight:800;font-size:16px;color:#111}
      .row.expense{color:#dc2626}
      .row.profit{color:#16a34a;font-weight:700}
      .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700}
      .balanced{background:#dcfce7;color:#166534}.unbalanced{background:#fee2e2;color:#991b1b}
      .footer{text-align:center;color:#aaa;font-size:11px;margin-top:32px}
    </style></head><body>
    <h1>📋 Cierre de Caja</h1>
    <div class="sub">${dateStr} · Generado por SmartFixOS</div>
    <div class="section">
      <h2>💰 Ventas del Turno</h2>
      <div class="row"><span>Efectivo</span><span>$${(s.totalCash||0).toFixed(2)}</span></div>
      <div class="row"><span>Tarjetas</span><span>$${(s.totalCard||0).toFixed(2)}</span></div>
      <div class="row"><span>ATH Móvil</span><span>$${(s.totalATH||0).toFixed(2)}</span></div>
      <div class="row total"><span>Total Ventas</span><span>$${(s.totalRevenue||0).toFixed(2)}</span></div>
    </div>
    ${dailyExpenses.length > 0 ? `<div class="section">
      <h2>📤 Gastos del Turno</h2>
      ${dailyExpenses.map(e => `<div class="row expense"><span>${e.description || e.category || 'Gasto'}</span><span>-$${Number(e.amount||0).toFixed(2)}</span></div>`).join('')}
      <div class="row total expense"><span>Total Gastos</span><span>-$${totalExpenses.toFixed(2)}</span></div>
    </div>` : ''}
    <div class="section">
      <h2>📊 Resultado</h2>
      <div class="row"><span>Efectivo esperado en caja</span><span>$${(s.expectedCash||0).toFixed(2)}</span></div>
      <div class="row"><span>Efectivo contado</span><span>$${total.toFixed(2)}</span></div>
      <div class="row"><span>Diferencia</span><span class="${isBalanced?'balanced':'unbalanced'} badge">${difference>=0?'+':''}${difference.toFixed(2)}</span></div>
      <div class="row profit"><span>Ganancia Neta</span><span>$${netProfit.toFixed(2)}</span></div>
    </div>
    <div class="footer">SmartFixOS · smartfixos.com · ${new Date().toLocaleTimeString('es-PR')}</div>
    </body></html>`;
    const w = window.open('', '_blank', 'width=800,height=900');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  if (!drawer) return null;
  const summary = salesSummary || buildDefaultSummary();
  const difference = total - summary.expectedCash;
  const isBalanced = Math.abs(difference) < 0.05;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl w-[95vw] apple-surface-elevated border-0 shadow-apple-xl rounded-apple-lg apple-type p-0 gap-0 overflow-hidden h-[90vh] sm:h-[85vh] flex flex-col [&>button]:hidden z-[9999]">
          {/* Header */}
          <div
              className="px-5 pt-5 pb-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 shrink-0"
              style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-apple-sm bg-apple-purple/15 flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5 text-apple-purple" />
                  </div>
                  <div>
                      <DialogTitle className="apple-text-title2 apple-label-primary">Cierre de Caja</DialogTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-apple-green animate-pulse" />
                        <p className="apple-text-footnote apple-label-secondary">
                          {new Date().toLocaleDateString('es-PR', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                      </div>
                  </div>
              </div>
              <div className="flex gap-4 sm:gap-6 text-right w-full sm:w-auto justify-between sm:justify-end">
                  <div>
                      <p className="apple-text-caption2 apple-label-tertiary">Esperado</p>
                      <div className="apple-text-title3 apple-label-secondary tabular-nums">
                          ${summary.expectedCash.toFixed(2)}
                      </div>
                  </div>
                  <div>
                      <p className="apple-text-caption2 apple-label-tertiary">Contado</p>
                      <div className={cn("apple-text-title2 tabular-nums", isBalanced ? "text-apple-green" : "apple-label-primary")}>
                          ${total.toFixed(2)}
                      </div>
                  </div>
              </div>
          </div>

          {/* Contenido con scroll - Botones al final */}
          <div className="flex-1 overflow-y-auto apple-surface flex flex-col">
           <div className="sm:flex sm:flex-row sm:h-full sm:overflow-hidden sm:flex-1">
              {/* Columna única en móvil, Left en desktop */}
              <div
                  className="sm:flex-1 p-5 sm:overflow-y-auto select-none"
                  style={{ borderRight: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                  <p className="apple-text-footnote apple-label-secondary mb-3 sm:mb-4">Conteo de Efectivo</p>

                  <div className="grid grid-cols-3 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 mb-6 sm:mb-0">
                      {DENOMINATIONS.map((d) => (
                          <div
                              key={d.id}
                              onClick={(e) => handleClick(d, e)}
                              onTouchStart={(e) => handleStart(d, e)}
                              onTouchEnd={(e) => handleEnd(d, e)}
                              onTouchCancel={handleCancel}
                              onContextMenu={(e) => { e.preventDefault(); }}
                              className={cn(
                                  "relative aspect-square sm:aspect-[1.5/1] rounded-apple-md p-3 cursor-pointer transition-all duration-200 select-none apple-press shadow-apple-sm",
                                  d.color
                              )}
                          >
                              <div className="relative h-full flex flex-col justify-between">
                                  <span className={cn("apple-text-headline", d.textColor)}>
                                      {d.label}
                                  </span>

                                  <div className="self-end">
                                      <span className={cn("apple-text-title2 tabular-nums", d.textColor)}>
                                          {denominations[d.id] || 0}
                                      </span>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="mt-3 mb-6 sm:mb-0 sm:mt-4 flex items-center justify-center gap-2 apple-label-tertiary apple-text-footnote">
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Mantén presionado para editar</span>
                  </div>

                  {/* Resumen en móvil (abajo del conteo) */}
                  <div
                      className="sm:hidden pt-6 mt-6"
                      style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                      <p className="apple-text-footnote apple-label-secondary mb-3">Resumen del Turno</p>

                      <div className="space-y-2 mb-6 apple-list">
                          <div
                            onClick={() => setEditingSummaryField({ field: 'totalCash', label: 'Ventas Efectivo', value: summary.totalCash })}
                            className="apple-list-row rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 p-3 flex items-center justify-between cursor-pointer apple-press"
                          >
                              <div className="flex items-center gap-2">
                                  <Banknote className="w-4 h-4 text-apple-green shrink-0" />
                                  <span className="apple-text-subheadline apple-label-primary">Efectivo</span>
                              </div>
                              <div className="flex items-center gap-1 tabular-nums">
                                  <span className="apple-text-subheadline apple-label-tertiary">$</span>
                                  <span className="apple-text-subheadline apple-label-primary">
                                    {(parseFloat(summary.totalCash) || 0).toFixed(2)}
                                  </span>
                              </div>
                          </div>
                          <div
                            onClick={() => setEditingSummaryField({ field: 'totalCard', label: 'Tarjetas', value: summary.totalCard })}
                            className="apple-list-row rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 p-3 flex items-center justify-between cursor-pointer apple-press"
                          >
                              <div className="flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 text-apple-blue shrink-0" />
                                  <span className="apple-text-subheadline apple-label-primary">Tarjetas</span>
                              </div>
                              <div className="flex items-center gap-1 tabular-nums">
                                  <span className="apple-text-subheadline apple-label-tertiary">$</span>
                                  <span className="apple-text-subheadline apple-label-primary">
                                    {(parseFloat(summary.totalCard) || 0).toFixed(2)}
                                  </span>
                              </div>
                          </div>
                          <div
                            onClick={() => setShowATHModal(true)}
                            className="apple-list-row rounded-apple-md bg-gray-sys6 dark:bg-gray-sys5 p-3 flex items-center justify-between cursor-pointer apple-press"
                          >
                              <div className="flex items-center gap-2">
                                  <ArrowUpCircle className="w-4 h-4 text-apple-orange shrink-0" />
                                  <span className="apple-text-subheadline apple-label-primary">ATH Móvil</span>
                              </div>
                              <div className="flex items-center gap-1 tabular-nums">
                                  <span className="apple-text-subheadline apple-label-tertiary">$</span>
                                  <span className="apple-text-subheadline apple-label-primary">
                                    {(parseFloat(summary.totalATH) || 0).toFixed(2)}
                                  </span>
                              </div>
                          </div>
                      </div>

                      <div className={cn(
                          "rounded-apple-md p-4 transition-colors duration-300",
                          isBalanced
                              ? "bg-apple-green/12"
                              : "bg-apple-red/12"
                      )}>
                          <div className="flex items-center gap-2 mb-2">
                              {isBalanced
                                  ? <div className="w-1.5 h-1.5 rounded-full bg-apple-green animate-pulse" />
                                  : <div className="w-1.5 h-1.5 rounded-full bg-apple-red animate-pulse" />
                              }
                              <span className={cn("apple-text-subheadline", isBalanced ? "text-apple-green" : "text-apple-red")}>
                                  {isBalanced ? "Cuadre Perfecto" : "Descuadre Detectado"}
                              </span>
                          </div>
                          <div className="flex justify-between items-end">
                              <span className="apple-text-footnote apple-label-secondary">Diferencia</span>
                              <span className={cn("apple-text-title2 tabular-nums", isBalanced ? "text-apple-green" : "text-apple-red")}>
                                  {difference > 0 ? "+" : ""}{difference.toFixed(2)}
                              </span>
                          </div>
                      </div>
                      {!isBalanced && (
                          <p className="apple-text-footnote apple-label-tertiary mt-2 text-center">
                              Verifica billetes grandes
                          </p>
                      )}
                  </div>
              </div>

              {/* Right: Summary Panel - Solo visible en desktop */}
              <div className="hidden sm:flex w-[280px] md:w-[320px] apple-surface-elevated p-5 overflow-y-auto flex-col gap-5">
                  <div>
                      <p className="apple-text-footnote apple-label-secondary mb-3">Resumen del Turno</p>

                      <div className="space-y-2">
                          <div
                            onClick={() => setEditingSummaryField({ field: 'totalCash', label: 'Ventas Efectivo', value: summary.totalCash })}
                            className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-3 flex items-center justify-between cursor-pointer apple-press"
                          >
                              <div className="flex items-center gap-2">
                                  <Banknote className="w-4 h-4 text-apple-green shrink-0" />
                                  <span className="apple-text-subheadline apple-label-primary">Ventas Efectivo</span>
                              </div>
                              <div className="flex items-center gap-1 tabular-nums">
                                  <span className="apple-text-subheadline apple-label-tertiary">$</span>
                                  <span className="apple-text-subheadline apple-label-primary min-w-[3rem] text-right">
                                    {(parseFloat(summary.totalCash) || 0).toFixed(2)}
                                  </span>
                              </div>
                          </div>
                          <div
                            onClick={() => setEditingSummaryField({ field: 'totalCard', label: 'Tarjetas', value: summary.totalCard })}
                            className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-3 flex items-center justify-between cursor-pointer apple-press"
                          >
                              <div className="flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 text-apple-blue shrink-0" />
                                  <span className="apple-text-subheadline apple-label-primary">Tarjetas</span>
                              </div>
                              <div className="flex items-center gap-1 tabular-nums">
                                  <span className="apple-text-subheadline apple-label-tertiary">$</span>
                                  <span className="apple-text-subheadline apple-label-primary min-w-[3rem] text-right">
                                    {(parseFloat(summary.totalCard) || 0).toFixed(2)}
                                  </span>
                              </div>
                          </div>
                          <div
                            onClick={() => setShowATHModal(true)}
                            className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-3 flex items-center justify-between cursor-pointer apple-press"
                          >
                              <div className="flex items-center gap-2">
                                  <ArrowUpCircle className="w-4 h-4 text-apple-orange shrink-0" />
                                  <span className="apple-text-subheadline apple-label-primary">ATH Móvil</span>
                              </div>
                              <div className="flex items-center gap-1 tabular-nums">
                                  <span className="apple-text-subheadline apple-label-tertiary">$</span>
                                  <span className="apple-text-subheadline apple-label-primary min-w-[3rem] text-right">
                                    {(parseFloat(summary.totalATH) || 0).toFixed(2)}
                                  </span>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* Productividad del turno */}
                  {shiftOrderStats && (
                    <div
                        className="pt-4 mt-4"
                        style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                      <p className="apple-text-footnote apple-label-secondary mb-3 flex items-center gap-1.5">
                        <Receipt className="w-3.5 h-3.5 text-apple-blue" /> Productividad del Turno
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Órdenes activas", value: shiftOrderStats.total, color: "apple-label-primary" },
                          { label: "Completadas", value: shiftOrderStats.completed, color: "text-apple-green" },
                          { label: "Nuevas", value: shiftOrderStats.newOrders, color: "text-apple-blue" },
                        ].map(stat => (
                          <div key={stat.label} className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-sm p-2.5 text-center">
                            <p className={`apple-text-title3 tabular-nums ${stat.color}`}>{stat.value}</p>
                            <p className="apple-text-caption2 apple-label-tertiary leading-tight mt-0.5">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gastos del turno */}
                  {dailyExpenses.length > 0 && (
                    <div
                        className="pt-4"
                        style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                      <p className="apple-text-footnote apple-label-secondary mb-3 flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5 text-apple-red" /> Gastos del Turno
                      </p>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                        {dailyExpenses.map((e, i) => (
                          <div key={i} className="flex items-center justify-between bg-apple-red/12 rounded-apple-sm px-3 py-2">
                            <span className="apple-text-caption1 apple-label-secondary truncate max-w-[140px]" title={e.description}>{e.description || e.category || 'Gasto'}</span>
                            <span className="apple-text-caption1 text-apple-red shrink-0 ml-2 tabular-nums">-${Number(e.amount||0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between items-center mt-2 px-1">
                        <span className="apple-text-caption1 apple-label-tertiary">Total gastos</span>
                        <span className="apple-text-subheadline text-apple-red tabular-nums">-${totalExpenses.toFixed(2)}</span>
                      </div>
                      <div
                          className="flex justify-between items-center mt-1 px-1 pt-2"
                          style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                        <span className="apple-text-caption1 apple-label-secondary">Ganancia neta</span>
                        <span className={cn("apple-text-subheadline tabular-nums", netProfit >= 0 ? "text-apple-green" : "text-apple-red")}>
                          ${netProfit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div
                      className="pt-5 mt-auto"
                      style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                      <div className={cn(
                          "rounded-apple-md p-4 transition-colors duration-300",
                          isBalanced
                              ? "bg-apple-green/12"
                              : "bg-apple-red/12"
                      )}>
                          <div className="flex items-center gap-2 mb-2">
                              {isBalanced
                                  ? <div className="w-1.5 h-1.5 rounded-full bg-apple-green animate-pulse" />
                                  : <div className="w-1.5 h-1.5 rounded-full bg-apple-red animate-pulse" />
                              }
                              <span className={cn("apple-text-subheadline", isBalanced ? "text-apple-green" : "text-apple-red")}>
                                  {isBalanced ? "Cuadre Perfecto" : "Descuadre Detectado"}
                              </span>
                          </div>
                          <div className="flex justify-between items-end">
                              <span className="apple-text-footnote apple-label-secondary">Diferencia</span>
                              <span className={cn("apple-text-title2 tabular-nums", isBalanced ? "text-apple-green" : "text-apple-red")}>
                                  {difference > 0 ? "+" : ""}{difference.toFixed(2)}
                              </span>
                          </div>
                      </div>
                      {!isBalanced && (
                          <p className="apple-text-footnote apple-label-tertiary mt-2 text-center">
                              Falta dinero en caja. Verifica los billetes grandes.
                          </p>
                      )}
                      {/* Exportar PDF */}
                      <button
                        onClick={handleExportPDF}
                        className="apple-btn apple-btn-tinted mt-3 w-full flex items-center justify-center gap-2"
                      >
                        <FileDown className="w-4 h-4" />
                        Exportar PDF del turno
                      </button>
                  </div>
              </div>
              </div>

              {/* Footer Actions - Dentro del scroll */}
              <div
                  className="px-5 py-4 flex flex-row justify-between gap-3"
                  style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                  <Button
                      variant="ghost"
                      onClick={onClose}
                      className="apple-btn apple-btn-secondary apple-btn-lg flex-1"
                  >
                      Cancelar
                  </Button>
                  <Button
                      onClick={handleClose}
                      disabled={loading}
                      className={cn(
                          "apple-btn apple-btn-lg flex-[2]",
                          isBalanced ? "apple-btn-primary" : "apple-btn-destructive"
                      )}
                  >
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      <span className="sm:hidden">Cerrar</span>
                      <span className="hidden sm:inline">Confirmar Cierre</span>
                  </Button>
              </div>
              </div>
        </DialogContent>
      </Dialog>
      
      {/* Edit Denomination Modal */}
      <EditDenominationModal 
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          denomination={editingItem}
          currentQty={editingItem ? (denominations[editingItem.id] || 0) : 0}
          onSave={handleUpdateQty}
      />

      {/* Edit Amount Modal */}
      <EditAmountModal
          isOpen={!!editingSummaryField}
          onClose={() => setEditingSummaryField(null)}
          title={editingSummaryField?.label}
          currentValue={editingSummaryField?.value}
          onSave={handleSummaryUpdate}
      />

      {/* ── ATH Móvil Transactions Modal ─────────────────────────── */}
      {showATHModal && (
        <div className="fixed inset-0 z-[9999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowATHModal(false)}>
          <div className="apple-surface-elevated rounded-apple-lg shadow-apple-xl apple-type max-w-md w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div
                className="px-5 pt-5 pb-3 flex items-center justify-between"
                style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-apple-sm bg-apple-orange/15 flex items-center justify-center">
                  <ArrowUpCircle className="w-5 h-5 text-apple-orange" />
                </div>
                <div>
                  <p className="apple-text-title2 apple-label-primary">ATH Móvil</p>
                  <p className="apple-text-footnote apple-label-secondary tabular-nums">{athTransactions.length} transacciones · ${(summary?.totalATH || 0).toFixed(2)}</p>
                </div>
              </div>
              <button onClick={() => setShowATHModal(false)} className="w-8 h-8 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-label-secondary apple-press">
                <span className="apple-text-headline leading-none">×</span>
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(80vh-120px)]">
              {athTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <ArrowUpCircle className="w-10 h-10 apple-label-tertiary mx-auto mb-3" />
                  <p className="apple-text-headline apple-label-secondary">Sin transacciones ATH Móvil</p>
                  <p className="apple-text-footnote apple-label-tertiary mt-1">en este turno</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {athTransactions.map((tx, i) => (
                    <div key={tx.id || i} className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-4 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="apple-text-subheadline apple-label-primary truncate">{tx.customerName}</p>
                        {tx.customerPhone && (
                          <p className="apple-text-caption1 apple-label-tertiary mt-0.5">{tx.customerPhone}</p>
                        )}
                        {tx.reference && (
                          <p className="apple-text-caption2 text-apple-orange mt-0.5">#{tx.reference}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-apple-orange apple-text-headline tabular-nums">${tx.amount.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                  <div
                      className="mt-3 pt-3 flex justify-between items-center"
                      style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
                    <span className="apple-text-footnote apple-label-secondary">Total ATH Móvil</span>
                    <span className="text-apple-orange apple-text-title3 tabular-nums">${(summary?.totalATH || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
