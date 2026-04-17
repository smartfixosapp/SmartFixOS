import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { dataClient } from "@/components/api/dataClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, CreditCard, Smartphone, MoreHorizontal, Wallet, Check } from "lucide-react";
import { toast } from "sonner";
import { useDeviceDetection } from "@/components/utils/useDeviceDetection";
import { SendEmail } from "@/api/integrations";
import { recordSaleAndTransactions, resolveActiveTenantId } from "@/components/financial/recordSale";
import { upsertLocalOrder } from "@/components/utils/localOrderCache";
import { upsertLocalSale, upsertLocalTransactions } from "@/components/utils/localFinancialCache";

export default function DepositDialog({ open, onClose, order, onSuccess, isCreating = false, onDepositData }) {
  const { isDesktop } = useDeviceDetection();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Cargar usuario y resetear formulario al abrir
  useEffect(() => {
    if (open) {
      loadUser();
      setAmount("");
      setPaymentMethod("cash");
      setNotes("");
    }
  }, [open]);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (e) {
      console.error("Error loading user", e);
    }
  };

  // Cálculos de la orden
  const orderTotal = useMemo(() => {
    if (!order) return 0;
    if (order.total) return Number(order.total);

    // Calculate based on parts if available to respect taxability
    const parts = order.parts_needed || [];
    if (parts.length > 0) {
      return parts.reduce((sum, item) => {
        const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
        const itemTax = item.taxable !== false ? itemTotal * 0.115 : 0;
        return sum + itemTotal + itemTax;
      }, 0);
    }

    // Fallback: assume all taxable
    return (Number(order.cost_estimate) || 0) * 1.115;
  }, [order]);

  const amountPaid = Number(order?.amount_paid || 0);
  const balanceDue = Math.max(0, orderTotal - amountPaid);

  // Cálculos del depósito actual
  const depositAmount = parseFloat(amount) || 0;

  // Cambio (si paga en efectivo más del balance, aunque en depósito suele ser exacto)
  // En lógica de depósito: Si ingresa más del balance, ¿es cambio o sobrepago?
  // Asumiremos que el monto ingresado es lo que DESEA depositar.
  // Pero validaremos que no exceda el balance.
  const isValidAmount = depositAmount > 0 && depositAmount <= (balanceDue + 0.01); // +0.01 por redondeo

  const handleSubmit = async () => {
    if (!isValidAmount) {
      if (depositAmount > balanceDue) {
        toast.error(`El depósito ($${depositAmount}) no puede exceder el balance ($${balanceDue.toFixed(2)})`);
      } else {
        toast.error("Por favor ingresa un monto válido mayor a 0");
      }
      return;
    }

    // Modo Creación (Wizard) - Solo devolver datos
    if (isCreating) {
      const depositData = {
        amount: depositAmount,
        payment_method: paymentMethod,
        notes,
        timestamp: new Date().toISOString(),
        recorded_by: user?.full_name || user?.email
      };

      onDepositData?.(depositData);
      onClose();
      return;
    }

    // Modo Edición (Orden Existente)
    setLoading(true);
    try {
      const newTotalPaid = amountPaid + depositAmount;
      const newBalance = Math.max(0, orderTotal - newTotalPaid);

      const saleNumber = `DEP-${Date.now().toString().slice(-6)}`;
      const tenantId = resolveActiveTenantId();
      const { sale: createdSale, transactions: createdTransactions, order: updatedOrder } = await recordSaleAndTransactions({
        sale: {
        sale_number: saleNumber,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        items: [{
          type: "service",
          name: `Depósito - Orden ${order.order_number}`,
          quantity: 1,
          price: depositAmount, // Simplificado, sin desglosar tax para depósito puro
          total: depositAmount
        }],
        subtotal: depositAmount, // Ajustar si se requiere desglose tax
        tax_rate: 0, // Depósitos suelen ser pasivos, el tax se paga en la factura final o se prorratea
        tax_amount: 0,
        total: depositAmount,
        amount_paid: depositAmount,
        amount_due: 0,
        payment_method: paymentMethod,
        employee: user?.full_name || user?.email,
        order_id: order.id,
        order_number: order.order_number,
        deposit_credit: depositAmount,
        notes: notes || `Depósito a cuenta`,
        tenant_id: tenantId,
        },
        transactions: [{
          order_id: order.id,
          order_number: order.order_number,
          type: "revenue",
          amount: depositAmount,
          description: `Depósito - Orden ${order.order_number}${notes ? ` - ${notes}` : ''}`,
          category: "repair_payment",
          payment_method: paymentMethod,
          recorded_by: user?.full_name || user?.email,
          tenant_id: tenantId,
        }],
        orderUpdate: {
          id: order.id,
          changes: {
            amount_paid: newTotalPaid,
            deposit_amount: (order.deposit_amount || 0) + depositAmount,
            balance_due: newBalance,
          },
        },
      });

      // 4. Registrar Evento en Historial
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "payment",
        description: `Depósito de $${depositAmount.toFixed(2)} recibido (${paymentMethod})`,
        user_id: user?.id,
        user_name: user?.full_name || user?.email,
        metadata: {
          amount: depositAmount,
          method: paymentMethod,
          new_balance: newBalance,
          sale_number: saleNumber
        }
      });

      // 5. Enviar Email (Opcional)
      if (order.customer_email) {
        try {
          await SendEmail({
            to: order.customer_email,
            template_key: "custom",
            custom_subject: `Recibo de Depósito ${saleNumber} - Orden ${order.order_number}`,
            custom_body: "",
            event_type: "deposit_received",
            order_data: {
              order_number: order.order_number,
              customer_name: order.customer_name,
              customer_email: order.customer_email,
              device_info: order.device_model || order.device_type || "Equipo en reparación",
              amount: depositAmount.toFixed(2),
              balance: newBalance.toFixed(2),
              total_paid: newTotalPaid.toFixed(2),
              sale_number: saleNumber,
              payment_method: paymentMethod,
              initial_problem: order.initial_problem || order.problem_description || ""
            }
          });

          await base44.entities.EmailLog.create({
            order_id: order.id,
            customer_id: order.customer_id,
            to_email: order.customer_email,
            subject: `Recibo de Depósito ${saleNumber}`,
            body: `Plantilla enviada: deposit_received`,
            event_type: "deposit_received",
            status: "sent",
            sent_at: new Date().toISOString(),
            sent_by: user?.full_name || user?.email
          });

          await base44.entities.WorkOrderEvent.create({
            order_id: order.id,
            order_number: order.order_number,
            event_type: "email_sent",
            description: `Recibo de depósito enviado a ${order.customer_email}`,
            user_id: user?.id,
            user_name: user?.full_name || user?.email,
            metadata: {
              email_type: "deposit_receipt",
              sale_number: saleNumber
            }
          });
        } catch (e) {
          console.error("Error sending email", e);
        }
      }

      if (updatedOrder?.id) upsertLocalOrder(updatedOrder);
      if (createdSale?.id) upsertLocalSale(createdSale);
      if (Array.isArray(createdTransactions) && createdTransactions.length) {
        upsertLocalTransactions(createdTransactions);
      }

      toast.success("Depósito registrado correctamente");
      try {
        window.dispatchEvent(new CustomEvent("sale-completed", {
          detail: {
            sale: createdSale,
            order: updatedOrder,
            transactions: createdTransactions,
            orderId: order.id,
            amountPaid: depositAmount,
            paymentMode: "deposit"
          }
        }));
        window.dispatchEvent(new Event("force-refresh"));
      } catch (refreshError) {
        console.warn("Financial refresh events failed:", refreshError);
      }
      onSuccess?.();
      onClose();

    } catch (error) {
      console.error("Error processing deposit:", error);
      toast.error("Error al procesar el depósito: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const paymentMethods = [
    { id: "cash", label: "Efectivo", icon: DollarSign, color: "text-apple-green", bg: "bg-apple-green/15" },
    { id: "card", label: "Tarjeta", icon: CreditCard, color: "text-apple-blue", bg: "bg-apple-blue/15" },
    { id: "ath_movil", label: "ATH Móvil", icon: Smartphone, color: "text-apple-orange", bg: "bg-apple-orange/15" },
    { id: "mixed", label: "Otro", icon: MoreHorizontal, color: "apple-label-secondary", bg: "apple-surface-secondary" }
  ];

  const quickAmounts = [20, 50, 100];

  // Contenido compartido entre Dialog y Sheet
  const contentBody = (
    <div className="overflow-y-auto flex-1 min-h-0 px-4 py-4 space-y-4">

          {/* Resumen de la Orden */}
          <div className="apple-surface-secondary rounded-apple-md p-3 space-y-1.5">
            <div className="flex justify-between apple-text-subheadline apple-label-secondary">
              <span>Total Orden</span>
              <span className="tabular-nums">${orderTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between apple-text-subheadline text-apple-green">
              <span>Pagado</span>
              <span className="tabular-nums">- ${amountPaid.toFixed(2)}</span>
            </div>
            <div className="my-1" style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }} />
            <div className="flex justify-between apple-text-body font-semibold">
              <span className="apple-label-primary">Balance Pendiente</span>
              <span className="text-apple-green tabular-nums">${balanceDue.toFixed(2)}</span>
            </div>
          </div>

          {/* Selección de Método de Pago */}
          <div className="space-y-3">
            <Label className="apple-text-footnote apple-label-secondary font-semibold">Método de Pago</Label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map((method) => {
                const isSelected = paymentMethod === method.id;
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`
                      apple-press relative p-3 rounded-apple-md transition-all duration-200 flex flex-col items-center justify-center gap-2 h-20
                      ${isSelected
                        ? `${method.bg} ring-2 ring-apple-blue`
                        : "apple-card"
                      }
                    `}
                  >
                    <Icon className={`w-6 h-6 ${method.color}`} />
                    <span className={`apple-text-caption1 font-medium ${isSelected ? "apple-label-primary" : "apple-label-secondary"}`}>
                      {method.label}
                    </span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-apple-blue" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Entrada de Monto */}
          <div className="space-y-3">
            <Label className="apple-text-footnote apple-label-secondary font-semibold">Monto a Depositar</Label>

            {/* Botones Rápidos */}
            <div className="flex gap-2 mb-2">
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  onClick={() => setAmount(String(amt))}
                  className="apple-press flex-1 py-1.5 rounded-apple-sm apple-surface-secondary apple-text-subheadline font-medium apple-label-secondary tabular-nums transition-colors"
                  disabled={amt > balanceDue + 1}
                >
                  ${amt}
                </button>
              ))}
              <button
                onClick={() => setAmount(String(balanceDue.toFixed(2)))}
                className="apple-press flex-1 py-1.5 rounded-apple-sm bg-apple-green/15 apple-text-subheadline font-medium text-apple-green transition-colors"
              >
                Saldar
              </button>
            </div>

            {/* Input Numérico */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 apple-text-title2 font-semibold apple-label-tertiary">$</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="apple-input pl-8 h-14 apple-text-title1 font-semibold rounded-apple-md tabular-nums"
                autoFocus
              />
            </div>

            {/* Cambio (Solo visual) */}
            {paymentMethod === "cash" && depositAmount > balanceDue && (
              <div className="flex items-center justify-between px-3 py-2 bg-apple-yellow/12 rounded-apple-sm text-apple-yellow apple-text-subheadline">
                 <span>Cambio estimado:</span>
                 <span className="font-semibold tabular-nums">${(depositAmount - balanceDue).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label className="apple-text-footnote apple-label-secondary font-semibold">Notas (Opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referencia, número de cheque..."
              className="apple-input min-h-[60px] resize-none"
            />
          </div>

        </div>
  );

  // Footer compartido
  const footer = (
    <div
      className="p-4 flex gap-3 shrink-0 apple-surface-secondary"
      style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
    >
      <Button
        variant="ghost"
        onClick={onClose}
        className="apple-btn apple-btn-secondary flex-1 h-12"
      >
        Cancelar
      </Button>
      <Button
        onClick={handleSubmit}
        disabled={loading || !isValidAmount}
        className="apple-btn apple-btn-primary flex-1 h-12"
      >
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Procesando...
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5" />
            Confirmar
          </div>
        )}
      </Button>
    </div>
  );

  // Desktop: Full Overlay Dialog
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-3xl w-[90vw] max-h-[90vh] flex flex-col apple-type">
          <DialogHeader
            className="p-6 pb-4 shrink-0"
            style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
          >
            <DialogTitle className="apple-text-title2 font-semibold apple-label-primary flex items-center gap-3">
              <div className="w-10 h-10 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-apple-green" />
              </div>
              Registrar Depósito
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {contentBody.props.children}
          </div>
          <div
            className="p-6 pt-4 flex gap-3 shrink-0 apple-surface-secondary"
            style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
          >
            {footer.props.children}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Mobile/Tablet: Dialog con contenido simple que redirige al POS
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-[95vw] sm:max-w-md max-h-[92vh] flex flex-col apple-type">
        <DialogHeader
          className="p-4 shrink-0"
          style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
        >
          <DialogTitle className="apple-text-headline font-semibold apple-label-primary flex items-center gap-2">
            <div className="w-8 h-8 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-apple-green" />
            </div>
            Registrar Depósito
          </DialogTitle>
        </DialogHeader>
        {contentBody}
        {footer}
      </DialogContent>
    </Dialog>
  );
}
