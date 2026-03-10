import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, RotateCcw, Search, AlertCircle, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";
import DeleteOrderDialog from "./DeleteOrderDialog";
import DeleteTransactionDialog from "./DeleteTransactionDialog";
import ResetTransactionsDialog from "./ResetTransactionsDialog";
import SystemAuditPanel from "./SystemAuditPanel";

export default function SystemToolsPanel() {
  const [activeTab, setActiveTab] = useState("audit");
  const [orderSearch, setOrderSearch] = useState("");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [foundOrder, setFoundOrder] = useState(null);
  const [foundTransaction, setFoundTransaction] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [showDeleteOrderDialog, setShowDeleteOrderDialog] = useState(false);
  const [showDeleteTransactionDialog, setShowDeleteTransactionDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);

  const searchOrder = async () => {
    if (!orderSearch.trim()) {
      toast.error("Ingresa número de orden");
      return;
    }

    setLoading(true);
    try {
      const orders = await dataClient.entities.Order.filter({
        order_number: orderSearch.trim()
      });

      if (orders.length > 0) {
        setFoundOrder(orders[0]);
      } else {
        toast.error("Orden no encontrada");
        setFoundOrder(null);
      }
    } catch (error) {
      toast.error("Error buscando orden: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const searchTransaction = async () => {
    if (!transactionSearch.trim()) {
      toast.error("Ingresa ID o número de orden");
      return;
    }

    setLoading(true);
    try {
      // Buscar por ID o order_number
      let transactions = [];
      try {
        const tx = await dataClient.entities.Transaction.get(transactionSearch.trim());
        if (tx) transactions = [tx];
      } catch {
        // Si no es un ID, buscar por order_number
        transactions = await dataClient.entities.Transaction.filter({
          order_number: transactionSearch.trim()
        });
      }

      if (transactions.length > 0) {
        setFoundTransaction(transactions[0]);
      } else {
        toast.error("Transacción no encontrada");
        setFoundTransaction(null);
      }
    } catch (error) {
      toast.error("Error buscando transacción: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-orange-600/20 to-red-600/20 border border-orange-500/30 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-2xl font-bold text-white">Herramientas del Sistema</h2>
            <p className="text-sm text-white/70 mt-1">
              ⚠️ Solo para administrador. Cambios se registran en AuditLog.
            </p>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-2 border-b border-white/10 overflow-x-auto">
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-4 py-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "audit"
              ? "border-blue-500 text-white"
              : "border-transparent text-white/60 hover:text-white/80"
          }`}
        >
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Auditoría
        </button>
        <button
          onClick={() => {
            setActiveTab("delete_order");
            setFoundOrder(null);
            setOrderSearch("");
          }}
          className={`px-4 py-2 border-b-2 transition-all whitespace-nowrap ${
            activeTab === "delete_order"
              ? "border-orange-500 text-white"
              : "border-transparent text-white/60 hover:text-white/80"
          }`}
        >
          <Trash2 className="w-4 h-4 inline mr-2" />
          Eliminar Orden
        </button>
        <button
          onClick={() => {
            setActiveTab("delete_transaction");
            setFoundTransaction(null);
            setTransactionSearch("");
          }}
          className={`px-4 py-2 border-b-2 transition-all ${
            activeTab === "delete_transaction"
              ? "border-orange-500 text-white"
              : "border-transparent text-white/60 hover:text-white/80"
          }`}
        >
          <Trash2 className="w-4 h-4 inline mr-2" />
          Eliminar Transacción
        </button>
        <button
          onClick={() => setActiveTab("reset_transactions")}
          className={`px-4 py-2 border-b-2 transition-all ${
            activeTab === "reset_transactions"
              ? "border-red-500 text-white"
              : "border-transparent text-white/60 hover:text-white/80"
          }`}
        >
          <RotateCcw className="w-4 h-4 inline mr-2" />
          Reset Transacciones
        </button>
      </div>

      {/* CONTENT */}
      <div className="space-y-4">
        {/* TAB: AUDITORÍA */}
        {activeTab === "audit" && (
          <SystemAuditPanel />
        )}

        {/* TAB: ELIMINAR ORDEN */}
        {activeTab === "delete_order" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ingresa número de orden (ej: WO-001)"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && searchOrder()}
                className="flex-1 h-11 bg-[#18181B] border-white/10"
              />
              <Button
                onClick={searchOrder}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white h-11"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {foundOrder && (
              <div className="bg-[#18181B] border border-white/10 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-white/60">Orden</p>
                    <p className="text-white font-mono">{foundOrder.order_number}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Cliente</p>
                    <p className="text-white">{foundOrder.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Total</p>
                    <p className="text-white font-mono">${foundOrder.cost_estimate?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Estado</p>
                    <p className="text-white">{foundOrder.status}</p>
                  </div>
                </div>

                <Button
                  onClick={() => setShowDeleteOrderDialog(true)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar esta orden
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TAB: ELIMINAR TRANSACCIÓN */}
        {activeTab === "delete_transaction" && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ingresa ID o número de orden"
                value={transactionSearch}
                onChange={(e) => setTransactionSearch(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && searchTransaction()}
                className="flex-1 h-11 bg-[#18181B] border-white/10"
              />
              <Button
                onClick={searchTransaction}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white h-11"
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>

            {foundTransaction && (
              <div className="bg-[#18181B] border border-white/10 rounded-lg p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-white/60">Orden</p>
                    <p className="text-white font-mono">{foundTransaction.order_number}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Tipo</p>
                    <p className="text-white">{foundTransaction.type}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Monto</p>
                    <p className="text-white font-mono">${foundTransaction.amount?.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-white/60">Método</p>
                    <p className="text-white">{foundTransaction.payment_method}</p>
                  </div>
                </div>

                <Button
                  onClick={() => setShowDeleteTransactionDialog(true)}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Eliminar esta transacción
                </Button>
              </div>
            )}
          </div>
        )}

        {/* TAB: RESET TRANSACCIONES */}
        {activeTab === "reset_transactions" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Reset de Transacciones</h3>
              <ul className="text-sm text-white/70 space-y-1 list-disc list-inside">
                <li>Eliminará TODAS las transacciones (soft delete)</li>
                <li>Resetará TODAS las órdenes a amount_paid=0</li>
                <li>Se registrará en AuditLog permanentemente</li>
                <li>Requiere confirmación en 3 pasos</li>
              </ul>
            </div>

            <Button
              onClick={() => setShowResetDialog(true)}
              className="w-full bg-red-600 hover:bg-red-700 text-white h-11 font-bold"
            >
              <RotateCcw className="w-5 h-5 mr-2" />
              INICIAR RESET
            </Button>
          </div>
        )}
      </div>

      {/* DIALOGS */}
      <DeleteOrderDialog
        open={showDeleteOrderDialog}
        onClose={() => setShowDeleteOrderDialog(false)}
        order={foundOrder}
        onSuccess={() => {
          setFoundOrder(null);
          setOrderSearch("");
        }}
      />

      <DeleteTransactionDialog
        open={showDeleteTransactionDialog}
        onClose={() => setShowDeleteTransactionDialog(false)}
        transaction={foundTransaction}
        onSuccess={() => {
          setFoundTransaction(null);
          setTransactionSearch("");
        }}
      />

      <ResetTransactionsDialog
        open={showResetDialog}
        onClose={() => setShowResetDialog(false)}
        onSuccess={() => {
          toast.success("✅ Reset completado");
        }}
      />
    </div>
  );
}
