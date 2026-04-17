import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import NotificationService from "../notifications/NotificationService";
import { recordSaleAndTransactions, resolveActiveTenantId } from "@/components/financial/recordSale";
import { upsertLocalOrder } from "@/components/utils/localOrderCache";
import { upsertLocalSale, upsertLocalTransactions } from "@/components/utils/localFinancialCache";
import { DollarSign, CreditCard, Smartphone, MoreHorizontal } from "lucide-react";
import { useDeviceDetection } from "../utils/useDeviceDetection";

const PROMOS = {
  "VERANO10": { type: "percent", value: 10 },
  "PROMO5": { type: "amount", value: 5 },
  "DESCUENTO20": { type: "percent", value: 20 }
};

export default function PaymentModal({ open, onClose, subtotal, items = [], workOrderId = null, onSuccess }) {
  const { isDesktop } = useDeviceDetection();
  const [enteredAmount, setEnteredAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [processing, setProcessing] = useState(false);
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [taxEnabled, setTaxEnabled] = useState(true);

  useEffect(() => {
    if (open && workOrderId) {
      loadOrderDiscount();
    }
  }, [open, workOrderId]);

  useEffect(() => {
    if (open) {
      setEnteredAmount("");
      setShowCustomAmount(false);
    }
  }, [open]);

  const loadOrderDiscount = async () => {
    if (!workOrderId) return;
    try {
      const order = await base44.entities.Order.get(workOrderId);
      if (order.pos_discount_value) {
        setDiscountValue(String(order.pos_discount_value));
        setDiscountType(order.pos_discount_type || "percent");
      }
    } catch (e) {
      console.warn("Could not load order discount:", e);
    }
  };

  const applyPromoCode = () => {
    const code = promoCode.trim().toUpperCase();
    const promo = PROMOS[code];
    if (promo) {
      setDiscountType(promo.type);
      setDiscountValue(String(promo.value));
    } else if (code) {
      alert("Código promo no válido");
    }
  };

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (val <= 0) return 0;
    
    if (discountType === "percent") {
      const percent = Math.min(val, 100);
      return subtotal * (percent / 100);
    } else {
      return Math.min(val, subtotal);
    }
  }, [discountValue, discountType, subtotal]);

  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount);
  const taxRate = 0.115;

  // Calculate taxable portion respecting item.taxable (default true)
  const taxableSubtotal = useMemo(() => {
    if (!items || items.length === 0) return subtotal; // Fallback if no items passed
    return items.reduce((sum, item) => {
      // Si taxable no está definido, por defecto es true
      const isTaxable = item.taxable !== false;
      return sum + (isTaxable ? (item.price || 0) * (item.quantity || 1) : 0);
    }, 0);
  }, [items, subtotal]);

  // Prorate discount on taxable base
  const discountRatio = subtotal > 0 ? subtotalAfterDiscount / subtotal : 1;
  const taxableBase = taxableSubtotal * discountRatio;

  const tax = taxEnabled ? taxableBase * taxRate : 0;
  const total = subtotalAfterDiscount + tax;

  const amountPaid = parseFloat(enteredAmount) || (paymentMethod === "ath_movil" ? total : 0);
  const change = Math.max(0, amountPaid - total);

  const quickAmounts = [total, 25, 30, 50, 100].filter(amt => amt > 0);

  const handleProcessPayment = async (amount = null) => {
    const finalAmount = amount || amountPaid;
    
    if (finalAmount <= 0) {
      alert("Ingresa un monto válido");
      return;
    }

    setProcessing(true);
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}

      // ✅ Detectar modo de pago desde URL
      const urlParams = new URLSearchParams(window.location.search);
      const paymentMode = urlParams.get("mode") || "full"; // "full" = cobro completo, "deposit" = depósito

      const saleData = {
        sale_number: `SALE-${Date.now()}`,
        items: items.map(item => ({
          type: item.type || "product",
          id: item.id,
          name: item.name,
          quantity: item.quantity || 1,
          price: item.price,
          total: (item.price || 0) * (item.quantity || 1)
        })),
        subtotal: subtotal,
        discount_amount: discountAmount,
        discount_type: discountType,
        discount_value: parseFloat(discountValue) || 0,
        tax_rate: taxRate,
        tax_amount: tax,
        total: total,
        amount_paid: finalAmount,
        amount_due: Math.max(0, total - finalAmount),
        payment_method: paymentMethod,
        payment_details: {
          methods: [{ method: paymentMethod, amount: finalAmount }],
          change_given: change
        },
        employee: me?.full_name || me?.email || "Sistema"
      };

      if (workOrderId) {
        saleData.order_id = workOrderId;
      }

      let newBalance = 0;
      let newTotalPaid = 0;
      let currentOrder = null;
      
      if (workOrderId) {
        try {
          currentOrder = await base44.entities.Order.get(workOrderId);
          const orderTotal = Number(currentOrder.total || 0);
          const currentPaid = Number(currentOrder.total_paid || currentOrder.amount_paid || 0);
          newTotalPaid = currentPaid + finalAmount;
          newBalance = Math.max(0, orderTotal - newTotalPaid);

          await base44.entities.WorkOrderEvent.create({
            order_id: workOrderId,
            order_number: currentOrder.order_number,
            event_type: "payment",
            description: `${paymentMode === "deposit" ? "Depósito" : "Pago"} recibido: $${finalAmount.toFixed(2)} (${paymentMethod})${change > 0 ? ` - Cambio: $${change.toFixed(2)}` : ""} | Total pagado: $${newTotalPaid.toFixed(2)} | Balance: $${newBalance.toFixed(2)}${paymentMode === "deposit" ? " (sin cambio de estado)" : ""}`,
            user_name: me?.full_name || me?.email || "Sistema",
            user_id: me?.id || null,
            metadata: { 
              amount: finalAmount, 
              method: paymentMethod,
              change_given: change,
              total_paid: newTotalPaid,
              balance: newBalance,
              sale_number: saleData.sale_number,
              is_full_payment: newBalance <= 0.01,
              payment_mode: paymentMode,
              discount_applied: discountAmount
            }
          });

          // ✅ Enviar recibo por email
          if (currentOrder.customer_email) {
            try {
              const emailBody = `
                <h2>${paymentMode === "deposit" ? "Depósito Registrado" : "Recibo de Pago"} - 911 SmartFix</h2>
                <p><strong>Orden:</strong> ${currentOrder.order_number}</p>
                <p><strong>Cliente:</strong> ${currentOrder.customer_name}</p>
                <p><strong>Método de pago:</strong> ${paymentMethod}</p>
                <p><strong>Monto ${paymentMode === "deposit" ? "depositado" : "pagado"}:</strong> $${finalAmount.toFixed(2)}</p>
                ${change > 0 ? `<p><strong>Cambio:</strong> $${change.toFixed(2)}</p>` : ''}
                <p><strong>Total de la orden:</strong> $${orderTotal.toFixed(2)}</p>
                <p><strong>Total pagado:</strong> $${newTotalPaid.toFixed(2)}</p>
                <p><strong>Balance pendiente:</strong> $${newBalance.toFixed(2)}</p>
                ${newBalance <= 0.01 ? '<p style="color: green; font-weight: bold;">✓ Orden saldada completamente</p>' : ''}
                ${paymentMode === "deposit" ? '<p style="color: orange;"><em>Nota: Este fue registrado como depósito. El estado de la orden no ha cambiado.</em></p>' : ''}
              `;

              await base44.integrations.Core.SendEmail({
                to: currentOrder.customer_email,
                subject: `${paymentMode === "deposit" ? "Depósito" : "Recibo de pago"} - Orden ${currentOrder.order_number}`,
                body: emailBody
              });

              await base44.entities.WorkOrderEvent.create({
                order_id: workOrderId,
                order_number: currentOrder.order_number,
                event_type: "email_sent",
                description: `Recibo de ${paymentMode === "deposit" ? "depósito" : "pago"} enviado por email`,
                user_name: me?.full_name || me?.email || "Sistema",
                user_id: me?.id || null,
                metadata: { email_type: "payment_receipt", to: currentOrder.customer_email }
              });
            } catch (emailError) {
              console.warn("Could not send receipt email:", emailError);
              await base44.entities.WorkOrderEvent.create({
                order_id: workOrderId,
                order_number: currentOrder.order_number,
                event_type: "email_failed",
                description: "No se pudo enviar recibo por email",
                user_name: me?.full_name || me?.email || "Sistema",
                user_id: me?.id || null,
                metadata: { error: emailError.message }
              });
            }
          } else {
            await base44.entities.WorkOrderEvent.create({
              order_id: workOrderId,
              order_number: currentOrder.order_number,
              event_type: "note_added",
              description: "No se envió recibo: cliente sin email",
              user_name: me?.full_name || me?.email || "Sistema",
              user_id: me?.id || null,
              metadata: { email_skipped: true }
            });
          }

          window.dispatchEvent(new CustomEvent('order-payment-processed', { 
            detail: { 
              orderId: workOrderId,
              amountPaid: finalAmount,
              newBalance,
              totalPaid: newTotalPaid,
              paymentMode
            } 
          }));

          console.log(`✅ ${paymentMode === "deposit" ? "Depósito" : "Pago"} procesado - Total pagado: $${newTotalPaid.toFixed(2)} - Balance: $${newBalance.toFixed(2)}`);
        } catch (err) {
          console.error("Error updating work order payment:", err);
          alert(`Error al actualizar el pago: ${err.message}`);
          setProcessing(false);
          return;
        }
      }

      const tenantId = resolveActiveTenantId();
      const orderUpdate = workOrderId && currentOrder ? {
        id: workOrderId,
        changes: {
          total: Number(currentOrder.total || 0),
          amount_paid: newTotalPaid,
          balance_due: newBalance,
          paid: newBalance <= 0.01,
          pos_discount_value: parseFloat(discountValue) || 0,
          pos_discount_type: discountType,
          pos_discount_applied_total: discountAmount,
        },
      } : null;

      const { sale: createdSale, transactions: createdTransactions, order: updatedOrder } = await recordSaleAndTransactions({
        sale: {
        ...saleData,
        tenant_id: tenantId,
        deposit_credit: paymentMode === "deposit" ? finalAmount : 0,
        notes: paymentMode === "deposit"
          ? `Depósito registrado desde POS${saleData.notes ? ` | ${saleData.notes}` : ""}`
          : saleData.notes
        },
        transactions: workOrderId && currentOrder ? [{
          order_id: workOrderId,
          order_number: currentOrder.order_number,
          type: "revenue",
          amount: finalAmount,
          description: `${paymentMode === "deposit" ? "Depósito" : "Pago"} ${paymentMethod} - Orden ${currentOrder.order_number}`,
          category: "repair_payment",
          payment_method: paymentMethod,
          recorded_by: me?.full_name || me?.email || "Sistema",
          tenant_id: tenantId,
        }] : [],
        orderUpdate,
      });
      try {
        if (updatedOrder?.id) upsertLocalOrder(updatedOrder);
        if (createdSale?.id) upsertLocalSale(createdSale);
        if (Array.isArray(createdTransactions) && createdTransactions.length) upsertLocalTransactions(createdTransactions);
        window.dispatchEvent(new CustomEvent("sale-completed", {
          detail: {
            sale: createdSale,
            order: updatedOrder,
            transactions: createdTransactions,
            orderId: workOrderId,
            amountPaid: finalAmount,
            paymentMode
          }
        }));
        window.dispatchEvent(new Event("force-refresh"));
      } catch (refreshError) {
        console.warn("Financial refresh events failed:", refreshError);
      }
      
      onSuccess?.({ change, amountPaid: finalAmount, total, balance: newBalance, order: currentOrder });
      
      // Mostrar mensaje de éxito
      if (workOrderId && currentOrder) {
        if (newBalance <= 0.01) {
          alert(`✅ ORDEN SALDADA\n\nBalance: $0.00\nLa orden está completamente pagada.${paymentMode === "full" ? "\nEstado actualizado a: Listo para recoger" : ""}`);
        } else {
          alert(`✅ ${paymentMode === "deposit" ? "Depósito" : "Pago"} procesado\n\nPagado: $${finalAmount.toFixed(2)}\nBalance restante: $${newBalance.toFixed(2)}${paymentMode === "deposit" ? "\n\nNota: Estado de la orden sin cambios" : ""}`);
        }
      }
      
      onClose();
    } catch (error) {
      console.error("Error processing payment:", error);
      alert("Error al procesar el pago");
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  // Contenido compartido
  const summaryContent = (
    <div className="apple-type space-y-2 p-4 apple-card">
      <div className="flex justify-between apple-text-subheadline tabular-nums">
        <span className="apple-label-secondary">Subtotal</span>
        <span className="apple-label-primary font-semibold">${subtotal.toFixed(2)}</span>
      </div>
      {discountAmount > 0 && (
        <div className="flex justify-between apple-text-subheadline tabular-nums">
          <span className="text-apple-red">Descuento</span>
          <span className="text-apple-red font-semibold">-${discountAmount.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between apple-text-subheadline items-center">
        <div className="flex items-center gap-2">
          <span className="apple-label-secondary">IVU (11.5%)</span>
          <button
            onClick={() => setTaxEnabled(!taxEnabled)}
            className={`apple-press apple-text-caption1 px-2 py-0.5 rounded-apple-sm transition-colors ${
              taxEnabled
                ? "bg-apple-red/15 text-apple-red"
                : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary"
            }`}
          >
            {taxEnabled ? "Remover" : "Aplicar"}
          </button>
        </div>
        <span className={`font-semibold tabular-nums ${taxEnabled ? "apple-label-primary" : "apple-label-tertiary line-through"}`}>
          ${(taxEnabled ? tax : (taxableBase * taxRate)).toFixed(2)}
        </span>
      </div>
      <div className="flex justify-between apple-text-headline font-bold pt-2 tabular-nums" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
        <span className="apple-label-primary">Total</span>
        <span className="text-apple-red">${total.toFixed(2)}</span>
      </div>
    </div>
  );

  const paymentMethodsContent = (
    <div>
      <Label className="apple-label-secondary apple-text-subheadline mb-2 block">Método de pago</Label>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={paymentMethod === "cash" ? "default" : "outline"}
          onClick={() => {
            setPaymentMethod("cash");
            setShowCustomAmount(true);
          }}
          className={paymentMethod === "cash" ? "apple-btn apple-btn-primary bg-apple-red" : "apple-btn apple-btn-secondary"}>
          <DollarSign className="w-4 h-4 mr-2" />
          Efectivo
        </Button>
        <Button
          variant={paymentMethod === "card" ? "default" : "outline"}
          onClick={() => {
            setPaymentMethod("card");
            setShowCustomAmount(true);
          }}
          className={paymentMethod === "card" ? "apple-btn apple-btn-primary bg-apple-red" : "apple-btn apple-btn-secondary"}>
          <CreditCard className="w-4 h-4 mr-2" />
          Tarjeta
        </Button>
        <Button
          variant={paymentMethod === "ath_movil" ? "default" : "outline"}
          onClick={() => {
            setPaymentMethod("ath_movil");
            setShowCustomAmount(false);
            setEnteredAmount(String(total));
          }}
          className={paymentMethod === "ath_movil" ? "apple-btn apple-btn-primary bg-apple-red" : "apple-btn apple-btn-secondary"}>
          <Smartphone className="w-4 h-4 mr-2" />
          ATH Móvil
        </Button>
        <Button
          variant={paymentMethod === "transfer" ? "default" : "outline"}
          onClick={() => {
            setPaymentMethod("transfer");
            setShowCustomAmount(false);
            setEnteredAmount("");
          }}
          className={paymentMethod === "transfer" ? "apple-btn apple-btn-primary bg-apple-red" : "apple-btn apple-btn-secondary"}>
          <Smartphone className="w-4 h-4 mr-2" />
          Depósito
        </Button>
        <Button
          variant={paymentMethod === "mixed" ? "default" : "outline"}
          onClick={() => {
            setPaymentMethod("mixed");
            setShowCustomAmount(true);
          }}
          className={paymentMethod === "mixed" ? "apple-btn apple-btn-primary bg-apple-red col-span-2" : "apple-btn apple-btn-secondary col-span-2"}>
          <MoreHorizontal className="w-4 h-4 mr-2" />
          Otro
        </Button>
      </div>
    </div>
  );

  // Desktop: Sheet lateral con TODO el contenido
  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent 
          side="right" 
          className="apple-type w-full sm:max-w-xl apple-surface-elevated p-6 flex flex-col gap-4 overflow-hidden"
        >
          <SheetHeader>
            <SheetTitle className="apple-text-title2 apple-label-primary">Procesar Pago</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            {summaryContent}
            {paymentMethodsContent}

            {/* Montos rápidos */}
            {showCustomAmount && paymentMethod !== "ath_movil" && paymentMethod !== "transfer" && (
              <>
                <div>
                  <Label className="apple-label-secondary apple-text-subheadline mb-2 block">Montos rápidos</Label>
                  <div className="flex gap-2 flex-wrap">
                    {quickAmounts.map((amt) => (
                      <Button
                        key={amt}
                        size="sm"
                        variant="outline"
                        onClick={() => setEnteredAmount(String(amt))}
                        className="apple-btn apple-btn-tinted bg-apple-red/12 text-apple-red">
                        ${amt.toFixed(2)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="apple-label-secondary apple-text-subheadline mb-2 block">Monto recibido</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={enteredAmount}
                    onChange={(e) => setEnteredAmount(e.target.value)}
                    placeholder="0.00"
                    className="apple-input h-12 apple-text-headline tabular-nums"
                    autoFocus
                  />
                </div>

                {change > 0 && (
                  <div className="p-3 bg-apple-green/12 rounded-apple-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-apple-green font-semibold apple-text-subheadline">Cambio a devolver</span>
                      <span className="text-apple-green font-bold apple-text-title3 tabular-nums">${change.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ATH Móvil */}
            {paymentMethod === "ath_movil" && (
              <div className="p-4 bg-apple-blue/12 rounded-apple-sm">
                <p className="apple-text-subheadline text-apple-blue tabular-nums">
                  Se procesará el pago de <strong>${total.toFixed(2)}</strong> por ATH Móvil
                </p>
              </div>
            )}

            {/* Depósito */}
            {paymentMethod === "transfer" && (
              <>
                <div>
                  <Label className="apple-label-secondary apple-text-subheadline mb-2 block">Montos rápidos</Label>
                  <div className="flex gap-2 flex-wrap">
                    {quickAmounts.map((amt) => (
                      <Button
                        key={amt}
                        size="sm"
                        variant="outline"
                        onClick={() => setEnteredAmount(String(amt))}
                        className="apple-btn apple-btn-tinted bg-apple-red/12 text-apple-red">
                        ${amt.toFixed(2)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="apple-label-secondary apple-text-subheadline mb-2 block">Monto del depósito</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={enteredAmount}
                    onChange={(e) => setEnteredAmount(e.target.value)}
                    placeholder="0.00"
                    className="apple-input h-12 apple-text-headline tabular-nums"
                    autoFocus
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={processing}
              className="apple-btn apple-btn-secondary flex-1">
              Cancelar
            </Button>
            <Button
              onClick={() => handleProcessPayment()}
              disabled={processing || (paymentMethod !== "ath_movil" && amountPaid <= 0)}
              className="apple-btn apple-btn-primary bg-apple-red flex-1">
              {processing ? "Procesando..." : "Confirmar Pago"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Mobile: Solo Dialog
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-type apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-6 overflow-hidden max-w-[95vw] sm:max-w-md flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="apple-text-title2 apple-label-primary">Procesar Pago</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 px-1">
          {summaryContent}
          {paymentMethodsContent}

          {/* Montos rápidos y monto recibido */}
          {showCustomAmount && paymentMethod !== "ath_movil" && paymentMethod !== "transfer" && (
            <>
              <div>
                <Label className="apple-label-secondary apple-text-subheadline mb-2 block">Montos rápidos</Label>
                <div className="flex gap-2 flex-wrap">
                  {quickAmounts.map((amt) => (
                    <Button
                      key={amt}
                      size="sm"
                      variant="outline"
                      onClick={() => setEnteredAmount(String(amt))}
                      className="apple-btn apple-btn-tinted bg-apple-red/12 text-apple-red">
                      ${amt.toFixed(2)}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="apple-label-secondary apple-text-subheadline mb-2 block">Monto recibido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={enteredAmount}
                  onChange={(e) => setEnteredAmount(e.target.value)}
                  placeholder="0.00"
                  className="apple-input h-12 apple-text-headline tabular-nums"
                  autoFocus
                />
              </div>

              {change > 0 && (
                <div className="p-3 bg-apple-green/12 rounded-apple-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-apple-green font-semibold apple-text-subheadline">Cambio a devolver</span>
                    <span className="text-apple-green font-bold apple-text-title3 tabular-nums">${change.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ATH Móvil - Sin input de monto */}
          {paymentMethod === "ath_movil" && (
            <div className="p-4 bg-apple-blue/12 rounded-apple-sm">
              <p className="apple-text-subheadline text-apple-blue tabular-nums">
                Se procesará el pago de <strong>${total.toFixed(2)}</strong> por ATH Móvil
              </p>
            </div>
          )}

          {/* Depósito - Con input de monto */}
          {paymentMethod === "transfer" && (
            <>
              <div>
                <Label className="text-gray-700 mb-2 block">Montos rápidos</Label>
                <div className="flex gap-2 flex-wrap">
                  {quickAmounts.map((amt) => (
                    <Button
                      key={amt}
                      size="sm"
                      variant="outline"
                      onClick={() => setEnteredAmount(String(amt))}
                      className="apple-btn apple-btn-tinted bg-apple-red/12 text-apple-red">
                      ${amt.toFixed(2)}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="apple-label-secondary apple-text-subheadline mb-2 block">
                  Ingresa la cantidad a depositar (máximo: ${total.toFixed(2)})
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  value={enteredAmount}
                  onChange={(e) => setEnteredAmount(e.target.value)}
                  placeholder="0.00"
                  className="apple-input h-12 apple-text-headline tabular-nums"
                  autoFocus
                  inputMode="decimal"
                />
              </div>
            </>
          )}

          {/* Botones de acción fijos al final */}
          <div className="flex gap-2 pt-4 flex-shrink-0 sticky bottom-0 apple-surface-elevated pb-safe" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={processing}
              className="apple-btn apple-btn-secondary flex-1">
              Cancelar
            </Button>
            <Button
              onClick={() => handleProcessPayment()}
              disabled={processing || (paymentMethod !== "ath_movil" && amountPaid <= 0)}
              className="apple-btn apple-btn-primary bg-apple-red flex-1">
              {processing ? "Procesando..." : "Confirmar Pago"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
