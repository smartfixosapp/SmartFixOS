import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
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
import { DollarSign, CreditCard, Smartphone, MoreHorizontal, Wallet, Check, Receipt, X } from "lucide-react";
import { toast } from "sonner";

export default function DepositDialog({ open, onClose, order, onSuccess, isCreating = false, onDepositData }) {
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
    // Preferimos el total guardado, si no, calculamos estimado
    if (order.total) return Number(order.total);
    const est = Number(order.cost_estimate || 0);
    // Asumimos que cost_estimate ya incluye o no tax según lógica de negocio, 
    // pero para consistencia usamos cost_estimate como base.
    // Si cost_estimate es subtotal:
    // return est * 1.115;
    // Por seguridad, usaremos cost_estimate directo si no hay total explícito
    return est;
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
      
      // 1. Actualizar Orden
      await base44.entities.Order.update(order.id, {
        amount_paid: newTotalPaid,
        deposit_amount: (order.deposit_amount || 0) + depositAmount,
        balance_due: newBalance,
        // Si el balance llega a 0, ¿cambiamos estado? 
        // En depósitos parciales NO solemos cambiar estado automáticamente a menos que sea Full Payment.
        // Pero si salda la cuenta, podríamos. Por seguridad, mantenemos estado o movemos a 'ready_for_pickup' si está listo.
        // Aquí solo actualizamos montos.
      });

      // 2. Crear Transacción Financiera
      await base44.entities.Transaction.create({
        order_id: order.id,
        order_number: order.order_number,
        type: "revenue",
        amount: depositAmount,
        description: `Depósito - Orden ${order.order_number}${notes ? ` - ${notes}` : ''}`,
        category: "repair_payment",
        payment_method: paymentMethod,
        recorded_by: user?.full_name || user?.email
      });

      // 3. Crear Registro de Venta (Sale) para KPI y Recibo
      const saleNumber = `DEP-${Date.now().toString().slice(-6)}`;
      await base44.entities.Sale.create({
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
        is_deposit: true, // Flag útil
        notes: notes || `Depósito a cuenta`
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
          // Lógica de email...
          const emailBody = `
            <h2>Recibo de Depósito</h2>
            <p>Hola ${order.customer_name},</p>
            <p>Hemos recibido tu depósito de <strong>$${depositAmount.toFixed(2)}</strong>.</p>
            <p><strong>Orden:</strong> ${order.order_number}</p>
            <p><strong>Nuevo Balance:</strong> $${newBalance.toFixed(2)}</p>
            <p>Gracias por tu pago.</p>
          `;
          await base44.integrations.Core.SendEmail({
            to: order.customer_email,
            subject: `Recibo de Depósito - ${saleNumber}`,
            body: emailBody
          });
        } catch (e) {
          console.error("Error sending email", e);
        }
      }

      toast.success("Depósito registrado correctamente");
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
    { id: "cash", label: "Efectivo", icon: DollarSign, color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
    { id: "card", label: "Tarjeta", icon: CreditCard, color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
    { id: "ath_movil", label: "ATH Móvil", icon: Smartphone, color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
    { id: "mixed", label: "Otro", icon: MoreHorizontal, color: "text-gray-400", bg: "bg-gray-400/10 border-gray-400/20" }
  ];

  const quickAmounts = [20, 50, 100];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-[#1a1a1a] to-black border-gray-800 text-white p-0 gap-0">
        <DialogHeader className="p-4 border-b border-gray-800">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-500" />
            Registrar Depósito
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-6">
          
          {/* Resumen de la Orden */}
          <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800 space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>Total Orden</span>
              <span>${orderTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-green-400/80">
              <span>Pagado</span>
              <span>- ${amountPaid.toFixed(2)}</span>
            </div>
            <div className="h-px bg-gray-800 my-1" />
            <div className="flex justify-between text-lg font-bold">
              <span className="text-white">Balance Pendiente</span>
              <span className="text-emerald-400">${balanceDue.toFixed(2)}</span>
            </div>
          </div>

          {/* Selección de Método de Pago */}
          <div className="space-y-3">
            <Label className="text-gray-400 text-xs uppercase tracking-wider">Método de Pago</Label>
            <div className="grid grid-cols-2 gap-2">
              {paymentMethods.map((method) => {
                const isSelected = paymentMethod === method.id;
                const Icon = method.icon;
                return (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`
                      relative p-3 rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-2 h-20
                      ${isSelected 
                        ? `${method.bg} ring-1 ring-offset-0 ring-white/20` 
                        : "bg-gray-900/40 border-gray-800 hover:bg-gray-800"
                      }
                    `}
                  >
                    <Icon className={`w-6 h-6 ${method.color}`} />
                    <span className={`text-xs font-medium ${isSelected ? "text-white" : "text-gray-400"}`}>
                      {method.label}
                    </span>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Entrada de Monto */}
          <div className="space-y-3">
            <Label className="text-gray-400 text-xs uppercase tracking-wider">Monto a Depositar</Label>
            
            {/* Botones Rápidos */}
            <div className="flex gap-2 mb-2">
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  onClick={() => setAmount(String(amt))}
                  className="flex-1 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm font-medium text-gray-300 transition-colors"
                  disabled={amt > balanceDue + 1} // Deshabilitar si excede por mucho
                >
                  ${amt}
                </button>
              ))}
              <button
                onClick={() => setAmount(String(balanceDue.toFixed(2)))}
                className="flex-1 py-1.5 rounded-lg bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-800 text-sm font-medium text-emerald-400 transition-colors"
              >
                Saldar
              </button>
            </div>

            {/* Input Numérico */}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-500">$</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="pl-8 h-14 text-2xl font-bold bg-black border-gray-800 focus:border-emerald-500/50 transition-all rounded-xl text-white"
                autoFocus
              />
            </div>
            
            {/* Cambio (Solo visual) */}
            {paymentMethod === "cash" && depositAmount > balanceDue && (
              <div className="flex items-center justify-between px-3 py-2 bg-yellow-900/20 rounded-lg border border-yellow-700/30 text-yellow-500 text-sm">
                 <span>Cambio estimado:</span>
                 <span className="font-bold">${(depositAmount - balanceDue).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Notas */}
          <div className="space-y-2">
            <Label className="text-gray-400 text-xs uppercase tracking-wider">Notas (Opcional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referencia, número de cheque..."
              className="bg-black/50 border-gray-800 text-sm min-h-[60px] resize-none focus:border-gray-700"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-900/30 flex gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="flex-1 h-12 text-gray-400 hover:text-white hover:bg-gray-800"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={loading || !isValidAmount}
            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg shadow-emerald-900/20"
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
      </DialogContent>
    </Dialog>
  );
}
