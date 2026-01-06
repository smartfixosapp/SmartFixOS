
import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import NotificationService from "../notifications/NotificationService";
import { DollarSign, CreditCard, Smartphone, MoreHorizontal } from "lucide-react";

const PROMOS = {
  "VERANO10": { type: "percent", value: 10 },
  "PROMO5": { type: "amount", value: 5 },
  "DESCUENTO20": { type: "percent", value: 20 }
};

export default function PaymentModal({ open, onClose, subtotal, items = [], workOrderId = null, onSuccess }) {
  const [enteredAmount, setEnteredAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [processing, setProcessing] = useState(false);
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  
  const [discountType, setDiscountType] = useState("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [promoCode, setPromoCode] = useState("");

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
  const tax = subtotalAfterDiscount * taxRate;
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
      let currentOrder = null;
      
      if (workOrderId) {
        try {
          currentOrder = await base44.entities.Order.get(workOrderId);
          const orderTotal = Number(currentOrder.total || 0);
          const currentPaid = Number(currentOrder.total_paid || currentOrder.amount_paid || 0);
          const newTotalPaid = currentPaid + finalAmount;
          newBalance = Math.max(0, orderTotal - newTotalPaid);
          
          const updateData = {
            total: orderTotal,
            total_paid: newTotalPaid,
            amount_paid: newTotalPaid,
            balance_due: newBalance,
            balance: newBalance,
            paid: newBalance <= 0.01,
            pos_discount_value: parseFloat(discountValue) || 0,
            pos_discount_type: discountType,
            pos_discount_applied_total: discountAmount
          };

          // ✅ LÓGICA DE CAMBIO DE ESTADO
          // Si es "cobro completo" (mode=full) y el balance queda en 0 → cambiar a ready_for_pickup
          // Si es "depósito" (mode=deposit) → NO cambiar estado
          if (paymentMode === "full" && newBalance <= 0.01) {
            const currentStatus = String(currentOrder.status || "").toLowerCase();
            const terminalStatuses = ["picked_up", "cancelled", "completed"];
            
            if (!terminalStatuses.includes(currentStatus)) {
              updateData.status = "ready_for_pickup";
            }
          }

          await base44.entities.Order.update(workOrderId, updateData);

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

          try {
            await base44.entities.Transaction.create({
              order_id: workOrderId,
              order_number: currentOrder.order_number,
              type: "revenue",
              amount: finalAmount,
              description: `${paymentMode === "deposit" ? "Depósito" : "Pago"} ${paymentMethod} - Orden ${currentOrder.order_number}`,
              category: "repair_payment",
              payment_method: paymentMethod,
              recorded_by: me?.full_name || me?.email || "Sistema"
            });
          } catch (txError) {
            console.warn("Could not create transaction:", txError);
          }

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

      await base44.entities.Sale.create(saleData);
      
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">Procesar Pago</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Totales */}
          <div className="space-y-2 p-4 bg-gray-50 rounded-lg border">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="text-gray-900 font-medium">${subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-red-600">Descuento</span>
                <span className="text-red-600 font-medium">-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">IVU (11.5%)</span>
              <span className="text-gray-900 font-medium">${tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span className="text-gray-900">Total</span>
              <span className="text-red-600">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Métodos de pago */}
          <div>
            <Label className="text-gray-700 mb-2 block">Método de pago</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={paymentMethod === "cash" ? "default" : "outline"}
                onClick={() => {
                  setPaymentMethod("cash");
                  setShowCustomAmount(true);
                }}
                className={paymentMethod === "cash" ? "bg-red-600 hover:bg-red-700" : ""}>
                <DollarSign className="w-4 h-4 mr-2" />
                Efectivo
              </Button>
              <Button
                variant={paymentMethod === "card" ? "default" : "outline"}
                onClick={() => {
                  setPaymentMethod("card");
                  setShowCustomAmount(true);
                }}
                className={paymentMethod === "card" ? "bg-red-600 hover:bg-red-700" : ""}>
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
                className={paymentMethod === "ath_movil" ? "bg-red-600 hover:bg-red-700" : ""}>
                <Smartphone className="w-4 h-4 mr-2" />
                ATH Móvil
              </Button>
              <Button
                variant={paymentMethod === "mixed" ? "default" : "outline"}
                onClick={() => {
                  setPaymentMethod("mixed");
                  setShowCustomAmount(true);
                }}
                className={paymentMethod === "mixed" ? "bg-red-600 hover:bg-red-700" : ""}>
                <MoreHorizontal className="w-4 h-4 mr-2" />
                Otro
              </Button>
            </div>
          </div>

          {/* Montos rápidos */}
          {showCustomAmount && paymentMethod !== "ath_movil" && (
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
                      className="border-red-600 text-red-600 hover:bg-red-50">
                      ${amt.toFixed(2)}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-gray-700 mb-2 block">Monto recibido</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={enteredAmount}
                  onChange={(e) => setEnteredAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-12 text-lg"
                  autoFocus
                />
              </div>

              {change > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-green-700 font-semibold">Cambio a devolver</span>
                    <span className="text-green-700 font-bold text-xl">${change.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ATH Móvil - Sin input de monto */}
          {paymentMethod === "ath_movil" && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Se procesará el pago de <strong>${total.toFixed(2)}</strong> por ATH Móvil
              </p>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={processing}
              className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={() => handleProcessPayment()}
              disabled={processing || (paymentMethod !== "ath_movil" && amountPaid <= 0)}
              className="flex-1 bg-red-600 hover:bg-red-700">
              {processing ? "Procesando..." : "Confirmar Pago"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
