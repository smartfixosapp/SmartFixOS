import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { dataClient } from "@/components/api/dataClient";

export default function ResetTransactionsDialog({ open, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [confirmText, setConfirmText] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [expectedCode, setExpectedCode] = useState("");

  useEffect(() => {
    if (open) {
      // Generate code: RESET-TRANSACTIONS-<date>
      const today = new Date().toISOString().split('T')[0];
      setExpectedCode(`RESET-TRANSACTIONS-${today}`);
      setStep(1);
      setConfirmText("");
      setConfirmCode("");
      setReason("");
      setCountdown(3);
    }
  }, [open]);

  useEffect(() => {
    if (step === 3 && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, countdown]);

  const handleStep2 = () => {
    if (confirmText !== "RESET-TRANSACTIONS") {
      toast.error('Debes escribir "RESET-TRANSACTIONS"');
      return;
    }
    setStep(2);
  };

  const handleStep3 = () => {
    if (confirmCode !== expectedCode) {
      toast.error(`Código incorrecto. Esperado: ${expectedCode}`);
      return;
    }
    if (!reason.trim()) {
      toast.error("Debes ingresar una razón");
      return;
    }
    setStep(3);
  };

  const handleConfirmReset = async () => {
    setProcessing(true);
    try {
      const result = await dataClient.functions.invoke("resetTransactions", {
        confirmation_code: expectedCode,
        reason
      });

      if (result.data?.success) {
        toast.success(
          `Reset completado: ${result.data.affected.transactions} transacciones, ${result.data.affected.orders} órdenes`
        );
        onSuccess?.();
        onClose();
      }
    } catch (error) {
      toast.error("Error en reset: " + error.message);
      setStep(1);
    } finally {
      setProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="apple-type fixed inset-0 z-[200] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
      <div className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden max-w-md w-full">
        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-apple-orange flex-shrink-0 mt-1" />
            <div>
              <h2 className="apple-text-title3 apple-label-primary">Reset de Transacciones</h2>
              <p className="apple-text-subheadline apple-label-tertiary mt-1 tabular-nums">Paso {step} de 3</p>
            </div>
            <button
              onClick={onClose}
              disabled={processing}
              className="apple-label-tertiary hover:apple-label-primary transition-colors ml-auto disabled:opacity-50 apple-press"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-apple-orange/12 rounded-apple-md p-3">
            <p className="apple-text-caption1 text-apple-orange mb-2">Advertencia crítica:</p>
            <ul className="apple-text-caption1 apple-label-secondary space-y-1 list-disc list-inside">
              <li>Esto eliminará TODAS las transacciones</li>
              <li>Todas las órdenes volverán a amount_paid=0</li>
              <li>No se puede deshacer</li>
              <li>Se registrará en AuditLog</li>
            </ul>
          </div>

          {/* PASO 1 */}
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="apple-text-footnote apple-label-secondary mb-2 block">
                  Razón del reset
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="apple-input w-full h-10"
                >
                  <option value="">-- Selecciona razón --</option>
                  <option value="system_new">Sistema nuevo (dev)</option>
                  <option value="data_cleanup">Limpieza de datos</option>
                  <option value="test_mode">Pruebas</option>
                  <option value="other">Otra</option>
                </select>
              </div>

              <div>
                <label className="apple-text-footnote apple-label-secondary mb-2 block">
                  Escriba "RESET-TRANSACTIONS" para continuar
                </label>
                <Input
                  placeholder="RESET-TRANSACTIONS"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  className="apple-input h-10 tabular-nums"
                  disabled={processing}
                />
              </div>

              <Button
                onClick={handleStep2}
                disabled={confirmText !== "RESET-TRANSACTIONS" || !reason || processing}
                className="apple-btn apple-btn-primary apple-press w-full"
              >
                Continuar (Paso 2)
              </Button>
            </div>
          )}

          {/* PASO 2 */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="apple-text-subheadline apple-label-primary">
                Se ha generado un código de confirmación para hoy:
              </p>
              <div className="bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-md p-3">
                <p className="apple-text-caption1 apple-label-tertiary mb-1">Código requerido:</p>
                <p className="apple-text-body text-apple-orange tabular-nums">{expectedCode}</p>
              </div>

              <div>
                <label className="apple-text-footnote apple-label-secondary mb-2 block">
                  Pegue el código para confirmar
                </label>
                <Input
                  placeholder={expectedCode}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  className="apple-input h-10 tabular-nums"
                  disabled={processing}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1 apple-btn apple-btn-secondary apple-press"
                  disabled={processing}
                >
                  Atrás
                </Button>
                <Button
                  onClick={handleStep3}
                  disabled={confirmCode !== expectedCode || processing}
                  className="flex-1 apple-btn apple-btn-primary apple-press"
                >
                  Continuar (Paso 3)
                </Button>
              </div>
            </div>
          )}

          {/* PASO 3 - CONFIRMACIÓN FINAL */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-apple-red/12 rounded-apple-md p-3">
                <p className="apple-text-subheadline text-apple-red mb-2">Último aviso</p>
                <p className="apple-text-caption1 apple-label-secondary">
                  Estás a punto de resetear permanentemente TODAS las transacciones. Esta acción no se puede deshacer.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="flex-1 apple-btn apple-btn-secondary apple-press"
                  disabled={processing || countdown > 0}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirmReset}
                  disabled={processing || countdown > 0}
                  className="flex-1 apple-btn apple-btn-destructive apple-press tabular-nums"
                >
                  {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {countdown > 0 ? `Confirmar (${countdown}s)` : "Confirmar Reset"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
