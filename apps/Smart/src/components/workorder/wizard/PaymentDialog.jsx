import React, { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, CreditCard, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { SendEmail } from "@/api/integrations";
import { recordSaleAndTransactions, resolveActiveTenantId } from "@/components/financial/recordSale";
import { upsertLocalOrder } from "@/components/utils/localOrderCache";
import { upsertLocalSale, upsertLocalTransactions } from "@/components/utils/localFinancialCache";

export default function PaymentDialog({ open, onClose, order, onSuccess, isCreating = false, onPaymentData }) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    if (open) {
      loadUser();
    }
  }, [open]);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const handleSubmit = async () => {
    const paymentAmount = parseFloat(amount);
    
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error("Por favor ingresa un monto válido");
      return;
    }

    // If creating (in wizard), just pass data back
    if (isCreating) {
      const paymentData = {
        amount: paymentAmount,
        payment_method: paymentMethod,
        notes,
        timestamp: new Date().toISOString(),
        recorded_by: user?.full_name || user?.email
      };
      
      if (onPaymentData) {
        onPaymentData(paymentData);
      }
      
      setAmount("");
      setPaymentMethod("cash");
      setNotes("");
      onClose();
      return;
    }

    // If editing existing order
    if (!order || !order.id) {
      toast.error("Error: No se puede procesar el pago sin una orden válida");
      return;
    }

    setLoading(true);

    try {
      const currentPaid = order.amount_paid || 0;
      const newTotalPaid = currentPaid + paymentAmount;
      
      // Calculate total with tax respecting taxable items
      let totalWithTax = 0;
      const parts = order.parts_needed || [];
      
      if (parts.length > 0) {
        totalWithTax = parts.reduce((sum, item) => {
          const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
          const itemTax = item.taxable !== false ? itemTotal * 0.115 : 0;
          return sum + itemTotal + itemTax;
        }, 0);
      } else {
        // Fallback if no parts details
        totalWithTax = (order.cost_estimate || 0) * 1.115;
      }

      const balanceDue = Math.max(0, totalWithTax - newTotalPaid);

      const saleNumber = `WO-PAY-${Date.now().toString().slice(-8)}`;
      const tenantId = resolveActiveTenantId();
      const { sale: createdSale, transactions: createdTransactions, order: updatedOrder } = await recordSaleAndTransactions({
        sale: {
        sale_number: saleNumber,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        items: [{
          type: "service",
          name: `Pago - Orden ${order.order_number}`,
          quantity: 1,
          price: paymentAmount, // Payment is just a transaction amount
          total: paymentAmount
        }],
        subtotal: paymentAmount,
        tax_rate: 0, // Payment record doesn't need tax calculation again usually, or depends on accounting. 
        // But to be consistent with previous logic:
        // If we want to show tax paid, we need to know the ratio.
        // For simplicity in partial payments, we often just record the amount.
        // But let's try to match the ratio of the order if possible, or just 0 for now as it's a payment on account.
        // Actually, previous code reversed tax: price: paymentAmount / 1.115.
        // This assumes ALL payment includes tax. 
        // If we have mixed taxable/non-taxable, this is inaccurate.
        // Better to record it as a flat payment amount for now to avoid complex reverse math without full context.
        tax_amount: 0,
        discount_amount: 0,
        total: paymentAmount,
        amount_paid: paymentAmount,
        amount_due: 0,
        payment_method: paymentMethod,
        employee: user?.full_name || user?.email,
        order_id: order.id,
        order_number: order.order_number,
        voided: false,
        notes: `Pago de Work Order ${order.order_number}`,
        tenant_id: tenantId,
        },
        transactions: [{
          order_id: order.id,
          order_number: order.order_number,
          type: "revenue",
          amount: paymentAmount,
          description: `Pago recibido - Orden ${order.order_number}${notes ? ` - ${notes}` : ''}`,
          category: "repair_payment",
          payment_method: paymentMethod,
          recorded_by: user?.full_name || user?.email,
          tenant_id: tenantId,
        }],
        orderUpdate: {
          id: order.id,
          changes: {
            amount_paid: newTotalPaid,
            balance_due: balanceDue,
            paid: balanceDue === 0,
          },
        },
      });

      // Create work order event
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "payment",
        description: `Pago de $${paymentAmount.toFixed(2)} registrado${notes ? `: ${notes}` : ''}`,
        user_id: user?.id,
        user_name: user?.full_name || user?.email,
        user_role: user?.role,
        metadata: {
          amount: paymentAmount,
          payment_method: paymentMethod,
          new_balance: balanceDue,
          sale_number: saleNumber
        }
      });

      // Send email if customer has email
      if (order.customer_email) {
        try {
          await SendEmail({
            to: order.customer_email,
            template_key: "custom",
            custom_subject: `Recibo de Pago ${saleNumber} - Orden ${order.order_number}`,
            custom_body: "",
            event_type: "payment_received",
            order_data: {
              order_number: order.order_number,
              customer_name: order.customer_name,
              customer_email: order.customer_email,
              device_info: order.device_model || order.device_type || "Equipo en reparación",
              amount: paymentAmount.toFixed(2),
              balance: balanceDue.toFixed(2),
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
            subject: `Recibo de Pago ${saleNumber}`,
            body: `Plantilla enviada: payment_received`,
            event_type: "payment_received",
            status: "sent",
            sent_at: new Date().toISOString(),
            sent_by: user?.full_name || user?.email
          });

          await base44.entities.WorkOrderEvent.create({
            order_id: order.id,
            order_number: order.order_number,
            event_type: "email_sent",
            description: `Recibo de pago enviado a ${order.customer_email}`,
            user_id: user?.id,
            user_name: user?.full_name || user?.email,
            user_role: user?.role,
            metadata: {
              email_type: "payment_receipt",
              sale_number: saleNumber
            }
          });
        } catch (emailError) {
          console.error("Error sending email:", emailError);
        }
      }

      // Audit log
      try {
        await base44.entities.AuditLog.create({
          action: `payment_work_order_${order.order_number}`,
          entity_type: "order",
          entity_id: order.id,
          entity_number: order.order_number,
          user_id: user?.id,
          user_name: user?.full_name || user?.email,
          user_role: user?.role,
          changes: {
            amount: paymentAmount,
            payment_method: paymentMethod,
            new_balance: balanceDue,
            sale_number: saleNumber
          }
        });
      } catch (auditError) {
        console.error("Error creating audit log:", auditError);
      }

      if (updatedOrder?.id) upsertLocalOrder(updatedOrder);
      if (createdSale?.id) upsertLocalSale(createdSale);
      if (Array.isArray(createdTransactions) && createdTransactions.length) {
        upsertLocalTransactions(createdTransactions);
      }

      setAmount("");
      setPaymentMethod("cash");
      setNotes("");
      
      toast.success(`Pago procesado. Recibo: ${saleNumber}. Balance: $${balanceDue.toFixed(2)}`);
      try {
        window.dispatchEvent(new CustomEvent("sale-completed", {
          detail: {
            sale: createdSale,
            order: updatedOrder,
            transactions: createdTransactions,
            orderId: order.id,
            amountPaid: paymentAmount,
            paymentMode: "full"
          }
        }));
        window.dispatchEvent(new Event("force-refresh"));
      } catch (refreshError) {
        console.warn("Financial refresh events failed:", refreshError);
      }
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error processing payment:", error);
      toast.error("Error al procesar el pago: " + error.message);
    }

    setLoading(false);
  };

  const parsedAmount = parseFloat(amount) || 0;
  const quickAmounts = [20, 50, 100];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md apple-surface-elevated rounded-apple-lg shadow-apple-lg border-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4" style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}>
          <DialogTitle className="apple-text-title2 apple-label-primary flex items-center gap-2.5 m-0">
            <span className="w-9 h-9 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-apple-green" />
            </span>
            Registrar Pago
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">
          {/* Amount display */}
          <div className="flex flex-col items-center py-2">
            <span className="apple-text-footnote apple-label-tertiary">Monto a Pagar</span>
            <span className="apple-text-title1 apple-label-primary tabular-nums mt-1">
              ${parsedAmount.toFixed(2)}
            </span>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <Label className="apple-text-footnote apple-label-secondary">Cantidad</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="apple-input tabular-nums"
              autoFocus
            />
          </div>

          {/* Quick amount buttons */}
          <div className="flex gap-2">
            {quickAmounts.map((qa) => (
              <button
                key={qa}
                type="button"
                onClick={() => setAmount(String(qa))}
                className="apple-btn apple-btn-tinted apple-press flex-1 tabular-nums"
              >
                ${qa}
              </button>
            ))}
          </div>

          {/* Payment method - apple list rows */}
          <div className="space-y-1.5">
            <Label className="apple-text-footnote apple-label-secondary">Método de Pago</Label>
            <div className="apple-list">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`apple-list-row apple-press w-full text-left ${paymentMethod === "cash" ? "bg-apple-blue/12" : ""}`}
              >
                <span className="w-8 h-8 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-apple-green" />
                </span>
                <span className="apple-text-body apple-label-primary flex-1">Efectivo</span>
                {paymentMethod === "cash" && <span className="apple-text-subheadline text-apple-blue">Seleccionado</span>}
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("card")}
                className={`apple-list-row apple-press w-full text-left ${paymentMethod === "card" ? "bg-apple-blue/12" : ""}`}
              >
                <span className="w-8 h-8 rounded-apple-sm bg-apple-blue/12 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-apple-blue" />
                </span>
                <span className="apple-text-body apple-label-primary flex-1">Tarjeta</span>
                {paymentMethod === "card" && <span className="apple-text-subheadline text-apple-blue">Seleccionado</span>}
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("transfer")}
                className={`apple-list-row apple-press w-full text-left ${paymentMethod === "transfer" ? "bg-apple-blue/12" : ""}`}
              >
                <span className="w-8 h-8 rounded-apple-sm bg-apple-purple/12 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-apple-purple" />
                </span>
                <span className="apple-text-body apple-label-primary flex-1">ATH Móvil</span>
                {paymentMethod === "transfer" && <span className="apple-text-subheadline text-apple-blue">Seleccionado</span>}
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="apple-text-footnote apple-label-secondary">Notas (opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales del pago..."
              className="apple-input"
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <Button
              onClick={onClose}
              className="apple-btn apple-btn-secondary apple-btn-lg apple-press flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !amount}
              className="apple-btn apple-btn-primary apple-btn-lg apple-press flex-1"
            >
              {loading ? "Procesando..." : "Pagar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
