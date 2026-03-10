import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, Plus, Receipt, CreditCard, 
  Wallet, ArrowRight, ShoppingCart
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import PaymentDialog from "../../workorder/wizard/PaymentDialog";
import DepositDialog from "../../workorder/wizard/DepositDialog";

export default function WorkOrderPayments({ order, onUpdate, user }) {
  const navigate = useNavigate();
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDepositDialog, setShowDepositDialog] = useState(false);
  const [processingPOS, setProcessingPOS] = useState(false);

  const taxRate = 0.115;
  const subtotal = order.cost_estimate ? order.cost_estimate / (1 + taxRate) : 0;
  const taxAmount = subtotal * taxRate;
  const total = order.cost_estimate || 0;
  const amountPaid = order.amount_paid || 0;
  const balanceDue = Math.max(0, total - amountPaid);

  // Cargar transacciones
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  React.useEffect(() => {
    loadTransactions();
  }, [order.id]);

  const loadTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const txs = await base44.entities.Transaction.filter({ order_id: order.id });
      setTransactions(txs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    } catch (error) {
      console.error("Error loading transactions:", error);
    }
    setLoadingTransactions(false);
  };

  const handleOpenPOS = async () => {
    // Abrir POS con carrito precargado
    if (balanceDue <= 0) {
      alert("No hay saldo pendiente");
      return;
    }

    setProcessingPOS(true);

    try {
      // Crear sale draft para POS
      const saleData = {
        order_id: order.id,
        order_number: order.order_number,
        customer_id: order.customer_id,
        customer_name: order.customer_name,
        items: order.parts_needed || [],
        subtotal: subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total: total,
        amount_due: balanceDue,
        draft: true
      };

      // Guardar en localStorage para que POS lo recoja
      localStorage.setItem('pos_draft_from_wo', JSON.stringify(saleData));

      // Navegar a POS
      navigate(createPageUrl("POS?from_wo=" + order.id));
    } catch (error) {
      console.error("Error opening POS:", error);
      alert("Error al abrir POS: " + error.message);
    }

    setProcessingPOS(false);
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-4">
      {/* Resumen Financiero */}
      <Card className="bg-gradient-to-br from-gray-900 to-black border-[#FF0000]/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <DollarSign className="w-5 h-5 text-[#FF0000]" />
            Resumen Financiero
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Subtotal:</span>
            <span className="text-white font-medium">${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">IVU ({(taxRate * 100).toFixed(1)}%):</span>
            <span className="text-white font-medium">${taxAmount.toFixed(2)}</span>
          </div>
          <div className="h-px bg-gray-700"></div>
          <div className="flex justify-between text-lg">
            <span className="text-white font-bold">Total:</span>
            <span className="text-white font-bold">${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-green-400">Pagado:</span>
            <span className="text-green-400 font-medium">${amountPaid.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg">
            <span className="text-[#FF0000] font-bold">Saldo:</span>
            <span className="text-[#FF0000] font-bold">${balanceDue.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Botones de Acción */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Button
          onClick={() => setShowDepositDialog(true)}
          disabled={balanceDue <= 0}
          className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900"
        >
          <Wallet className="w-4 h-4 mr-2" />
          Depositar
        </Button>

        <Button
          onClick={() => setShowPaymentDialog(true)}
          disabled={balanceDue <= 0}
          className="bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900"
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Pagar Total
        </Button>

        {/* NUEVO: Botón Facturar en POS (solo si está en "Para cobrar") */}
        {order.status === "checkout" && balanceDue > 0 && (
          <Button
            onClick={handleOpenPOS}
            disabled={processingPOS}
            className="col-span-full bg-gradient-to-r from-[#FF0000] to-red-800 hover:from-red-700 hover:to-red-900"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            {processingPOS ? "Abriendo POS..." : "Facturar en POS"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Historial de Transacciones */}
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Historial de Pagos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingTransactions ? (
            <p className="text-gray-500 text-sm">Cargando...</p>
          ) : transactions.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay pagos registrados</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="p-3 bg-black rounded-lg border border-gray-800 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CreditCard className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-white font-medium">
                        {tx.description || "Pago"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{format(new Date(tx.created_date), "d MMM yyyy, HH:mm", { locale: es })}</span>
                      <span>•</span>
                      <span className="capitalize">{tx.payment_method}</span>
                      <span>•</span>
                      <span>{tx.recorded_by}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">
                      ${tx.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <PaymentDialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        order={order}
        onSuccess={() => {
          setShowPaymentDialog(false);
          loadTransactions();
          onUpdate();
        }}
        isCreating={false}
      />

      <DepositDialog
        open={showDepositDialog}
        onClose={() => setShowDepositDialog(false)}
        order={order}
        onSuccess={() => {
          setShowDepositDialog(false);
          loadTransactions();
          onUpdate();
        }}
        isCreating={false}
      />
    </div>
  );
}
