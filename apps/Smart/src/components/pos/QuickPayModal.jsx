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
import { toast } from "sonner";
import { sendTemplatedEmail } from "@/api/functions";

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

  // ── Success screen ────────────────────────────────────────────────────────
  const [successData, setSuccessData] = useState(null);

  // ── Pago ─────────────────────────────────────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [cashReceived, setCashReceived] = useState("");
  const [splitCashAmount, setSplitCashAmount] = useState("");
  const [splitAthAmount, setSplitAthAmount] = useState("");
  const [athMovilPhone, setAthMovilPhone] = useState("");
  const [athMovilName, setAthMovilName] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  // 📞 Auto-rellenar Teléfono y Nombre del pagador con datos del cliente de la orden
  useEffect(() => {
    const custName = order?.customer_name || "";
    const custPhone = order?.customer_phone || order?.phone || "";
    if (custName) setAthMovilName((prev) => prev || custName);
    if (custPhone) setAthMovilPhone((prev) => prev || custPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.customer_id]);
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
      discount_percentage: toCurrencyNumber(item.discount_percentage || item.discount_percent || 0),
    }));
  }, [order]);

  // ── Totales (respeta descuentos y IVU por item) ─────────────────────────
  const subtotal = cart.reduce((s, i) => {
    const base = toCurrencyNumber(i.price) * toCurrencyNumber(i.quantity);
    const disc = toCurrencyNumber(i.discount_percentage);
    return s + (base - base * (disc / 100));
  }, 0);
  const taxableSubtotal = cart.reduce((s, i) => {
    if (i.taxable === false) return s;
    const base = toCurrencyNumber(i.price) * toCurrencyNumber(i.quantity);
    const disc = toCurrencyNumber(i.discount_percentage);
    return s + (base - base * (disc / 100));
  }, 0);
  const tax = taxEnabled ? taxableSubtotal * taxRate : 0;
  const total = subtotal + tax;

  const totalPaid = toCurrencyNumber(order?.total_paid || order?.amount_paid || 0);
  // Use the recalculated total (with discounts) instead of stale order.total
  const orderTotal = total;
  const orderBalance = Math.max(0, orderTotal - totalPaid);

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

      // 📧 Enviar recibo por email al cliente (si tiene email registrado)
      if (order?.customer_email) {
        const isDeposit = paymentMode === "deposit" || (newBalance > 0.01);
        const eventType = isDeposit ? "deposit_received" : "payment_received";
        const deviceLine = [order.device_brand, order.device_model].filter(Boolean).join(" ") || order.device_type || "tu equipo";
        const paymentMethodLabel = paymentMethod === "cash" ? "Efectivo"
          : paymentMethod === "card" ? "Tarjeta"
          : paymentMethod === "ath_movil" ? "ATH Móvil"
          : paymentMethod === "mixed" ? "Pago Mixto"
          : paymentMethod || "";
        sendTemplatedEmail({
          event_type: eventType,
          order_data: {
            order_number: order.order_number,
            customer_name: order.customer_name || "Cliente",
            customer_email: order.customer_email,
            device_info: deviceLine,
            sale_number: saleNumber,
            amount: effectiveTotal,
            total_paid: amountPaid,
            balance: newBalance,
            payment_method: paymentMethodLabel,
          }
        }).catch(err => console.warn("[QuickPayModal] email recibo falló:", err?.message || err));
      }

      window.dispatchEvent(new CustomEvent("sale-completed", {
        detail: { sale, order: updatedOrder, transactions: createdTransactions, orderId: order?.id, amountPaid, paymentMode },
      }));
      window.dispatchEvent(new Event("force-refresh"));

      onSuccess?.({ sale, updatedOrder });
      // Show success screen instead of closing immediately
      setSuccessData({ sale, updatedOrder, amountPaid, saleNumber });
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

  // ── Success screen after payment ──────────────────────────────────────────
  if (successData) {
    const phone = order?.customer_phone || "";
    const email = order?.customer_email || "";
    const digits = phone.replace(/\D/g, "");
    const intl = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;
    const receiptMsg = encodeURIComponent(
      `¡Hola ${order?.customer_name || ""}! Tu orden *${order?.order_number || ""}* por $${Number(successData.amountPaid).toFixed(2)} ha sido procesada. ¡Gracias!`
    );
    const waHref = digits ? `https://wa.me/${intl}?text=${receiptMsg}` : null;
    const mailHref = email
      ? `mailto:${email}?subject=Recibo%20Orden%20${order?.order_number || ""}&body=${encodeURIComponent(`Hola ${order?.customer_name || ""},\n\nTu orden ${order?.order_number || ""} por $${Number(successData.amountPaid).toFixed(2)} ha sido procesada.\n\n¡Gracias por tu preferencia!`)}`
      : null;

    return (
      <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-[#0A0A0A] border border-white/10 rounded-[32px] p-8 w-full max-w-sm text-center space-y-6 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
          {/* Check icon */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30">
            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/30">Pago completado</p>
            <p className="text-3xl font-black text-white mt-1">${Number(successData.amountPaid).toFixed(2)}</p>
            {order?.customer_name && (
              <p className="text-sm text-white/50 mt-1">{order.customer_name}</p>
            )}
            <p className="text-[11px] text-white/25 mt-1">{successData.saleNumber}</p>
          </div>

          {/* Send options */}
          <div className="grid grid-cols-3 gap-2">
            {waHref ? (
              <a href={waHref} target="_blank" rel="noreferrer"
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-emerald-400 hover:bg-emerald-500/20 transition">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className="text-[10px] font-black uppercase tracking-wide">WhatsApp</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/8 px-3 py-3 text-white/50">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span className="text-[10px] font-black uppercase tracking-wide">WhatsApp</span>
              </div>
            )}
            {mailHref ? (
              <a href={mailHref}
                className="flex flex-col items-center gap-1.5 rounded-2xl border border-blue-500/25 bg-blue-500/10 px-3 py-3 text-blue-400 hover:bg-blue-500/20 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="text-[10px] font-black uppercase tracking-wide">Email</span>
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/8 px-3 py-3 text-white/50">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <span className="text-[10px] font-black uppercase tracking-wide">Email</span>
              </div>
            )}
            <button onClick={() => window.print()}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-violet-500/25 bg-violet-500/10 px-3 py-3 text-violet-400 hover:bg-violet-500/20 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-wide">Imprimir</span>
            </button>
          </div>

          <button onClick={onClose}
            className="w-full h-12 rounded-2xl bg-white/8 hover:bg-white/12 text-white font-black text-sm uppercase tracking-wide transition">
            Cerrar
          </button>
        </div>
      </div>
    );
  }

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
