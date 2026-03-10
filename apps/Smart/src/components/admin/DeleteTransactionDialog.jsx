import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";

export default function DeleteTransactionDialog({ open, onClose, transaction, onSuccess }) {
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") {
      toast.error("Debes escribir DELETE para confirmar");
      return;
    }

    if (!reason.trim()) {
      toast.error("Debes ingresar una razón");
      return;
    }

    setProcessing(true);
    try {
      const result = await dataClient.functions.invoke("deleteTransaction", {
        transaction_id: transaction.id,
        reason
      });

      if (result.data?.success) {
        toast.success(`✅ Transacción eliminada: ${transaction.order_number}`);
        setConfirmText("");
        setReason("");
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      toast.error("Error al eliminar: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (!open || !transaction) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0F0F12] border border-red-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl shadow-red-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-bold text-white">Eliminar Transacción</h2>
            <p className="text-sm text-white/60 mt-1">Esta acción NO se puede deshacer</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white transition-colors ml-auto"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 space-y-2">
          <p className="text-sm font-semibold text-white">Detalles de la transacción:</p>
          <div className="text-xs text-white/70 space-y-1">
            <div className="flex justify-between">
              <span>Orden:</span>
              <span className="font-mono text-white">{transaction.order_number}</span>
            </div>
            <div className="flex justify-between">
              <span>Tipo:</span>
              <span className="font-mono text-white">{transaction.type}</span>
            </div>
            <div className="flex justify-between">
              <span>Monto:</span>
              <span className="font-mono text-white">${transaction.amount?.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-white/80 mb-2 block">
              Razón de eliminación
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-10 bg-[#18181B] border border-white/10 rounded-lg text-white px-3 text-sm"
            >
              <option value="">-- Selecciona razón --</option>
              <option value="error">Error de entrada</option>
              <option value="duplicate">Duplicado</option>
              <option value="fraud">Fraude/Robo</option>
              <option value="system_test">Prueba del sistema</option>
              <option value="other">Otra (especificar abajo)</option>
            </select>
          </div>

          {reason === "other" && (
            <Input
              placeholder="Especifica la razón..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-10 bg-[#18181B] border-white/10"
            />
          )}

          <div>
            <label className="text-xs font-semibold text-white/80 mb-2 block">
              Escriba "DELETE" para confirmar
            </label>
            <Input
              placeholder="DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              className="h-10 bg-[#18181B] border-red-500/30 text-white font-mono"
              disabled={processing}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 bg-white/5 border-white/10 text-white hover:bg-white/10"
            onClick={onClose}
            disabled={processing}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            disabled={confirmText !== "DELETE" || !reason || processing}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/30"
          >
            {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
}
