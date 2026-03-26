import React, { useState, useEffect, useCallback } from "react";
import CheckoutModalDesktop from "./CheckoutModalDesktop";
import { dataClient } from "@/components/api/dataClient";
import { recordSaleAndTransactions, resolveActiveTenantId } from "@/components/financial/recordSale";
import { AuditService } from "@/components/utils/auditService";
import { upsertLocalOrder } from "@/components/utils/localOrderCache";
import { upsertLocalSale, upsertLocalTransactions } from "@/components/utils/localFinancialCache";
import {
  getCachedStatus,
  subscribeToCashRegister,
  checkCashRegisterStatus
} from "@/components/cash/CashRegisterService";
import OpenDrawerDialog from "@/components/cash/OpenDrawerDialog";
import { toast } from "react-hot-toast";

function toCurrencyNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * QuickPayModal — muestra CheckoutModalDesktop directamente desde WorkOrderPanel
 * sin navegar al POS. Maneja su propio estado de pago.
 *
 * Props:
 *   order       — la orden a cobrar
 *   paymentMode — "full" | "deposit"
 *   onClose     — callback al cerrar sin pagar
 *   onSuccess   — callback tras pago exitoso (recibe { sale, updatedOrder })
 */
export default function QuickPayModal({ order, paymentMode = "full", onClose, onSuccess }) {
  // ── Drawer ────────────────────────────────────────────────────────────────
  const [currentDrawer, setCurrentDrawer] = useState(() => getCachedStatus().drawer);
  const [loadingDrawer, setLoadingDrawer] = useState(() => !getCachedStatus().isInitialized);
  const [showOpenDrawerModal, setShowOpenDrawerModal] = useState(false);

  // ── Pago ─────────────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [cashReceived, setCashReceived] = useState("");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [splitAthAmount, setSplitAthAmount] = useState("");
  const [athMovilPhone, setAthMovilPhone] = useState("");
  const [athMovilName, setAthMovilName] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [processing, setProcessing] = useState(false);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(0.115);
  const [enabledPaymentMethods, setEnabledPaymentMethods] = useState({ cash: true, card: true, ath_movil: true });

  // ── Cajón: suscripción ────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = subscribeToCashRegister(({ drawer, isInitialized }) => {
      setCurrentDrawer(drawer || null);
      if (isInitialized) setLoadingDrawer(false);
    });

    const status = getCachedStatus();
    if (status.isInitialized) {
      setLoadingDrawer(false);
      setCurrentDrawer(status.drawer || null);
    } else {
      setLoadingDrawer(true);
      checkCashRegisterStatus().finally(() => setLoadingDrawer(false));
    }

    return () => unsubscribe();
  }, []);

  // ── Config: tax rate y métodos de pago ────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [taxCfg, pmCfg] = await Promise.all([
          dataClient.entities.AppSettings.filter({ slug: "app-main-settings" }),
          dataClient.entities.AppSettings.filter({ slug: "payment-methods" }),
        ]);
        if (taxCfg?.length && taxCfg[0].payload?.tax_rate) {
          setTaxRate(taxCfg[0].payload.tax_rate / 100);
        }
        if (pmCfg?.length) {
          setEnabledPaymentMethods((prev) => ({ ...prev, ...pmCfg[0].payload }));
        }
      } catch (e) {
        console.warn("[QuickPayModal] Config load error:", e);
      }
    })();
  }, []);

  // ── Construir cart desde la orden ─────────────────────────────────────────
  const cart = React.useMemo(() => {
    const rawItems = (order?.order_items?.length)
      ? order.order_items
      : [
          ...(order?.repair_tasks || []).map(t => ({
            id: t.id,
            name: t.name || t.description || "Servicio",
            price: t.cost || 0,
            cost: t.labor_cost || 0,
            type: "service",
            taxable: t.taxable !== false,
            quantity: 1,
          })),
          ...(order?.parts_needed || []).map(p => ({
            id: p.id,
            name: p.name || "Parte",
            price: p.price || 0,
            cost: p.cost_price || 0,
            type: "product",
            taxable: p.taxable !== false,
            quantity: p.quantity || 1,
          })),
        ];

    return rawItems.map(item => ({
      id: item.id || `item-${Math.random().toString(36).slice(2, 9)}`,
      name: item.name || "Artículo",
      price: toCurrencyNumber(item.price || item.cost || 0),
      cost: toCurrencyNumber(item.cost_price || item.labor_cost || item.cost || 0),
      quantity: item.qty || item.quantity || 1,
      type: item.type || "product",
      taxable: item.taxable !== false,
    }));
  }, [order]);

  // ── Totales ───────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + toCurrencyNumber(i.price) * toCurrencyNumber(i.quantity), 0);
  const taxableSubtotal = cart.reduce((s, i) => s + (i.taxable !== false ? toCurrencyNumber(i.price) * toCurrencyNumber(i.quantity) : 0), 0);
  const tax = taxEnabled ? taxableSubtotal * taxRate : 0;
  const total = subtotal + tax;

  const totalPaid = toCurrencyNumber(order?.total_paid || order?.amount_paid || 0);
  const orderTotal = toCurrencyNumber(order?.total ?? order?.grand_total ?? order?.total_amount ?? order?.cost_estimate ?? 0);
  const orderBalance = Math.max(
    0,
    order?.balance_due != null && Number(order.balance_due) > 0
      ? Number(order.balance_due)
      : orderTotal - totalPaid > 0
        ? orderTotal - totalPaid
        : 0
  );

  const effectiveTotal = paymentMode === "deposit"
    ? Math.min(parseFloat(depositAmount) || 0, orderBalance)
    : orderBalance > 0 ? orderBalance : total;

  const mixedCash = parseFloat(splitCashAmount) || 0;
  const mixedAth = parseFloat(splitAthAmount) || 0;
  const mixedTotal = mixedCash + mixedAth;
  const change = paymentMethod === "cash" && cashReceived ? Math.max(0, parseFloat(cashReceived) - effectiveTotal) : 0;

  const isPaymentValid = paymentMode === "deposit"
    ? (parseFloat(depositAmount) > 0 && parseFloat(depositAmount) <= orderBalance && !!paymentMethod)
    : paymentMethod === "cash" ? parseFloat(cashReceived) >= effectiveTotal
    : paymentMethod === "mixed" ? mixedTotal >= effectiveTotal
    : !!paymentMethod;

  // ── Pagar ─────────────────────────────────────────────────────────────────
  const handleConfirmPayment = useCallback(async () => {
    if (!isPaymentValid || cart.length === 0) {
      toast.error("Valida los datos de pago");
      return;
    }
    if (!currentDrawer) {
      toast.error("⚠️ Abre la caja primero");
      setShowOpenDrawerModal(true);
      return;
    }

    setProcessing(true);
    try {
      let me = null;
      try { me = await dataClient.auth.me(); } catch {}

      const amountPaid = paymentMode === "deposit"
        ? parseFloat(depositAmount)
        : paymentMethod === "cash" ? parseFloat(cashReceived)
        : paymentMethod === "mixed" ? mixedTotal
        : effectiveTotal;

      const amountPaidOnOrder = Math.min(amountPaid, orderBalance);
      const newTotalPaid = totalPaid + amountPaidOnOrder;
      const newBalance = Math.max(0, orderBalance - amountPaidOnOrder);

      const saleNumber = `S-${new Date().toISOString().split("T")[0]}-${Math.floor(Math.random() * 9000 + 1000)}`;
      const paymentMethods = paymentMethod === "mixed"
        ? [
            ...(mixedCash > 0 ? [{ method: "cash", amount: mixedCash }] : []),
            ...(mixedAth > 0 ? [{ method: "ath_movil", amount: mixedAth, phone: athMovilPhone, sender_name: athMovilName }] : []),
          ]
        : [{ method: paymentMethod, amount: amountPaid }];

      const saleItems = cart.map(item => ({
        type: item.type,
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        price: toCurrencyNumber(item.price),
        total: toCurrencyNumber(item.price) * toCurrencyNumber(item.quantity),
        taxable: item.taxable,
        cost: toCurrencyNumber(item.cost),
        line_cost: toCurrencyNumber(item.cost) * toCurrencyNumber(item.quantity),
        line_profit: (toCurrencyNumber(item.price) - toCurrencyNumber(item.cost)) * toCurrencyNumber(item.quantity),
      }));

      const tenantId = resolveActiveTenantId();
      const saleData = {
        sale_number: saleNumber,
        customer_id: order?.customer_id || null,
        customer_name: order?.customer_name || null,
        order_id: order?.id || null,
        order_number: order?.order_number || null,
        items: saleItems,
        subtotal,
        tax_amount: tax,
        total: effectiveTotal,
        amount_paid: amountPaid,
        amount_due: Math.max(0, effectiveTotal - amountPaid),
        payment_method: paymentMethod,
        payment_details: {
          methods: paymentMethods,
          change_given: paymentMethod === "cash" ? change : 0,
          ath_movil_phone: ["ath_movil", "mixed"].includes(paymentMethod) ? athMovilPhone : null,
          ath_movil_name: ["ath_movil", "mixed"].includes(paymentMethod) ? athMovilName : null,
        },
        employee: me?.full_name || "Sistema",
        deposit_credit: paymentMode === "deposit" ? amountPaid : 0,
        notes: paymentMode === "deposit" ? "Depósito registrado desde panel de orden" : undefined,
        tenant_id: tenantId,
      };

      const result = await recordSaleAndTransactions({
        sale: saleData,
        transactions: paymentMethods.map(m => ({
          order_id: order?.id || null,
          order_number: order?.order_number || null,
          type: "revenue",
          amount: Number(m.amount || 0),
          description: `Venta ${saleNumber}${paymentMode === "deposit" ? " (depósito)" : ""}`,
          category: order || saleItems.some(i => i.type === "service") ? "repair_payment" : "parts",
          payment_method: m.method,
          recorded_by: me?.full_name || "Sistema",
          tenant_id: tenantId,
        })),
        orderUpdate: {
          id: order.id,
          changes: {
            amount_paid: newTotalPaid,
            balance_due: newBalance,
            paid: newBalance <= 0.01,
          },
        },
      });

      const { sale, order: updatedOrder, transactions: createdTransactions = [] } = result;

      try { await AuditService.logCreate("Sale", sale.id, saleNumber, saleData); } catch {}
      try { await AuditService.logPayment(paymentMode, "Order", order.id, order.order_number, amountPaid, paymentMethod, { old_balance: orderBalance, new_balance: newBalance }); } catch {}

      if (updatedOrder?.id) upsertLocalOrder(updatedOrder);
      if (sale?.id) upsertLocalSale(sale);
      if (createdTransactions.length) upsertLocalTransactions(createdTransactions);

      toast.success(`✅ Venta procesada - ${saleNumber}`);

      window.dispatchEvent(new CustomEvent("sale-completed", {
        detail: { sale, order: updatedOrder, transactions: createdTransactions, orderId: order?.id, amountPaid, paymentMode },
      }));
      window.dispatchEvent(new Event("force-refresh"));

      onSuccess?.({ sale, updatedOrder });
      onClose?.();
    } catch (error) {
      console.error("[QuickPayModal] Payment error:", error);
      toast.error(`Error al procesar el pago: ${error?.message || "desconocido"}`);
    } finally {
      setProcessing(false);
    }
  }, [
    isPaymentValid, cart, currentDrawer, paymentMode, depositAmount, paymentMethod,
    cashReceived, mixedTotal, effectiveTotal, orderBalance, totalPaid, mixedCash, mixedAth,
    athMovilPhone, athMovilName, subtotal, tax, change, order, onSuccess, onClose,
  ]);

  // Si no hay cajón y no estamos cargando, no bloqueamos — CheckoutModal lo manejará
  return (
    <>
      <CheckoutModalDesktop
        open={true}
        onClose={onClose}
        cart={cart}
        total={total}
        effectiveTotal={effectiveTotal}
        subtotal={subtotal}
        tax={tax}
        taxEnabled={taxEnabled}
        setTaxEnabled={setTaxEnabled}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        cashReceived={cashReceived}
        setCashReceived={setCashReceived}
        splitCashAmount={splitCashAmount}
        setSplitCashAmount={setSplitCashAmount}
        splitAthAmount={splitAthAmount}
        setSplitAthAmount={setSplitAthAmount}
        depositAmount={depositAmount}
        setDepositAmount={setDepositAmount}
        athMovilPhone={athMovilPhone}
        setAthMovilPhone={setAthMovilPhone}
        athMovilName={athMovilName}
        setAthMovilName={setAthMovilName}
        change={change}
        isPaymentValid={isPaymentValid}
        processing={processing}
        onConfirmPayment={handleConfirmPayment}
        enabledPaymentMethods={enabledPaymentMethods}
        paymentMode={paymentMode}
        totalPaid={totalPaid}
        workOrderId={order?.id}
        orderBalance={orderBalance}
        orderTotal={orderTotal}
        currentDrawer={currentDrawer}
        quickDepositAmounts={[20, 50, 100, 200]}
        quickCashAmounts={[20, 50, 100, 200]}
      />

      {showOpenDrawerModal && (
        <OpenDrawerDialog
          open={showOpenDrawerModal}
          onClose={() => setShowOpenDrawerModal(false)}
          onSuccess={(drawer) => {
            setCurrentDrawer(drawer);
            setShowOpenDrawerModal(false);
          }}
        />
      )}
    </>
  );
}
