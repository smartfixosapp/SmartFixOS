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
          `✅ Reset completado: ${result.data.affected.transactions} transacciones, ${result.data.affected.orders} órdenes`
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
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0F0F12] border border-orange-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl shadow-orange-500/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-xl font-bold text-white">Reset de Transacciones</h2>
            <p className="text-sm text-white/60 mt-1">Paso {step} de 3</p>
          </div>
          <button
            onClick={onClose}
            disabled={processing}
            className="text-white/50 hover:text-white transition-colors ml-auto disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
          <p className="text-xs text-orange-300 font-semibold mb-2">⚠️ ADVERTENCIA CRÍTICA:</p>
          <ul className="text-xs text-white/70 space-y-1 list-disc list-inside">
            <li>Esto eliminará TODAS las transacciones</li>
            <li>Todas las órdenes volverán a amount_paid=0</li>
            <li>NO se puede deshacer</li>
            <li>Se registrará en AuditLog</li>
          </ul>
        </div>

        {/* PASO 1 */}
        {step === 1 && (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-white/80 mb-2 block">
                Razón del reset
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-10 bg-[#18181B] border border-white/10 rounded-lg text-white px-3 text-sm"
              >
                <option value="">-- Selecciona razón --</option>
                <option value="system_new">Sistema nuevo (dev)</option>
                <option value="data_cleanup">Limpieza de datos</option>
                <option value="test_mode">Pruebas</option>
                <option value="other">Otra</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/80 mb-2 block">
                Escriba "RESET-TRANSACTIONS" para continuar
              </label>
              <Input
                placeholder="RESET-TRANSACTIONS"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                className="h-10 bg-[#18181B] border-orange-500/30 text-white font-mono"
                disabled={processing}
              />
            </div>

            <Button
              onClick={handleStep2}
              disabled={confirmText !== "RESET-TRANSACTIONS" || !reason || processing}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white"
            >
              Continuar (Paso 2)
            </Button>
          </div>
        )}

        {/* PASO 2 */}
        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-white/80">
              Se ha generado un código de confirmación para hoy:
            </p>
            <div className="bg-[#18181B] border border-white/10 rounded-lg p-3">
              <p className="text-xs text-white/60 mb-1">Código requerido:</p>
              <p className="text-lg font-mono font-bold text-orange-400">{expectedCode}</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/80 mb-2 block">
                Pegue el código para confirmar
              </label>
              <Input
                placeholder={expectedCode}
                value={confirmCode}
                onChange={(e) => setConfirmCode(e.target.value)}
                className="h-10 bg-[#18181B] border-orange-500/30 text-white font-mono"
                disabled={processing}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 bg-white/5 border-white/10 text-white"
                disabled={processing}
              >
                Atrás
              </Button>
              <Button
                onClick={handleStep3}
                disabled={confirmCode !== expectedCode || processing}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
              >
                Continuar (Paso 3)
              </Button>
            </div>
          </div>
        )}

        {/* PASO 3 - CONFIRMACIÓN FINAL */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-sm font-bold text-red-300 mb-2">🔴 ÚLTIMO AVISO</p>
              <p className="text-xs text-white/70">
                Se a punto de resetear permanentemente TODAS las transacciones. Esta acción NO se puede deshacer.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1 bg-white/5 border-white/10 text-white"
                disabled={processing || countdown > 0}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmReset}
                disabled={processing || countdown > 0}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {processing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                {countdown > 0 ? `Confirmar (${countdown}s)` : "CONFIRMAR RESET"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
