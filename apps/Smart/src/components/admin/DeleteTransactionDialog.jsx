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
        toast.success(`Transacción eliminada: ${transaction.order_number}`);
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
    <div className="apple-type fixed inset-0 z-[200] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
      <div className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-md w-full">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-apple-red flex-shrink-0 mt-1" />
            <div>
              <h2 className="apple-text-title3 apple-label-primary">Eliminar Transacción</h2>
              <p className="apple-text-subheadline apple-label-tertiary mt-1">Esta acción no se puede deshacer</p>
            </div>
            <button
              onClick={onClose}
              className="apple-label-tertiary hover:apple-label-primary transition-colors ml-auto apple-press"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-apple-red/12 rounded-apple-md p-3 space-y-2">
            <p className="apple-text-subheadline apple-label-primary">Detalles de la transacción:</p>
            <div className="apple-text-caption1 apple-label-secondary space-y-1">
              <div className="flex justify-between">
                <span>Orden:</span>
                <span className="tabular-nums apple-label-primary">{transaction.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Tipo:</span>
                <span className="tabular-nums apple-label-primary">{transaction.type}</span>
              </div>
              <div className="flex justify-between">
                <span>Monto:</span>
                <span className="tabular-nums apple-label-primary">${transaction.amount?.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="apple-text-footnote apple-label-secondary mb-2 block">
                Razón de eliminación
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="apple-input w-full h-10"
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
                className="apple-input h-10"
              />
            )}

            <div>
              <label className="apple-text-footnote apple-label-secondary mb-2 block">
                Escriba "DELETE" para confirmar
              </label>
              <Input
                placeholder="DELETE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                className="apple-input h-10 tabular-nums"
                disabled={processing}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 apple-btn apple-btn-secondary apple-press"
              onClick={onClose}
              disabled={processing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || !reason || processing}
              className="flex-1 apple-btn apple-btn-destructive apple-press"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Eliminar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
