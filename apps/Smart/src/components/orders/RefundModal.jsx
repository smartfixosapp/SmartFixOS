import React, { useState } from "react";
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
import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function RefundModal({ order, open, onClose, onSuccess }) {
  const [monto, setMonto] = useState("");
  const [razon, setRazon] = useState("");
  const [metodo, setMetodo] = useState("");
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  React.useEffect(() => {
    if (open) {
      loadUser();
      setMonto("");
      setRazon("");
      setMetodo("");
      setNota("");
    }
  }, [open]);

  const loadUser = async () => {
    const userData = await base44.auth.me();
    setUser(userData);
  };

  const amountPaid = order?.amount_paid || 0;
  const costEstimate = order?.cost_estimate || 0;
  const montoNum = parseFloat(monto) || 0;
  const nuevoBalance = costEstimate - (amountPaid - montoNum);
  const nuevoPageado = amountPaid - montoNum;

  const isValid =
    montoNum > 0 &&
    montoNum <= amountPaid &&
    razon &&
    metodo &&
    user &&
    user.role &&
    ["admin", "manager"].includes(user.role);

  const handleSubmit = async () => {
    if (!isValid) {
      toast.error("Completa todos los campos correctamente");
      return;
    }

    setLoading(true);
    try {
      const result = await base44.functions.invoke("registerRefund", {
        order_id: order.id,
        order_number: order.order_number,
        refund_amount: -montoNum,
        refund_reason: razon,
        refund_method: metodo,
        refund_note: nota,
        current_amount_paid: amountPaid,
        cost_estimate: costEstimate,
      });

      if (result.success) {
        toast.success(`✅ Reembolso ${result.refund_number} registrado`);
        onSuccess();
        onClose();
      } else {
        toast.error(result.error || "Error registrando reembolso");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-[#2B2B2B] to-black border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">
            Registrar reembolso
          </DialogTitle>
          <p className="text-xs text-gray-400 mt-1">
            Devuelve dinero ya cobrado. Esto NO cambia el costo estimado.
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Monto */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">
              Monto a reembolsar (máx. ${amountPaid.toFixed(2)})
            </Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={amountPaid}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0.00"
              className="bg-black border-gray-700 text-white"
              disabled={loading}
            />
            {montoNum > amountPaid && (
              <p className="text-xs text-red-400">
                Máximo: ${amountPaid.toFixed(2)}
              </p>
            )}
          </div>

          {/* Razón */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">Razón</Label>
            <Select value={razon} onValueChange={setRazon} disabled={loading}>
              <SelectTrigger className="bg-black border-gray-700 text-white">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="theft">Robo</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="return">Devolución</SelectItem>
                <SelectItem value="cancelation">Cancelación</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Método */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">Método</Label>
            <Select value={metodo} onValueChange={setMetodo} disabled={loading}>
              <SelectTrigger className="bg-black border-gray-700 text-white">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="ath_movil">ATH Móvil</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
            {metodo === "card" && (
              <p className="text-xs text-yellow-500 mt-1">
                ⚠️ Reversa manual pendiente en Stripe
              </p>
            )}
          </div>

          {/* Nota */}
          <div className="space-y-2">
            <Label className="text-gray-300 text-sm">Nota (opcional)</Label>
            <Textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Detalles adicionales..."
              className="bg-black border-gray-700 text-white h-20"
              disabled={loading}
            />
          </div>

          {/* Resumen */}
          <Alert className="bg-blue-500/10 border-blue-500/30">
            <AlertCircle className="w-4 h-4 text-blue-400" />
            <AlertDescription className="text-blue-300 text-sm">
              <div className="space-y-1">
                <div>
                  Pagado actual: <strong>${amountPaid.toFixed(2)}</strong>
                </div>
                <div>
                  Reembolso: <strong>-${montoNum.toFixed(2)}</strong>
                </div>
                <div className="pt-1 border-t border-blue-500/20">
                  Nuevo pagado:{" "}
                  <strong>${nuevoPageado.toFixed(2)}</strong>
                </div>
                <div>
                  Balance: <strong>${nuevoBalance.toFixed(2)}</strong>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Botones */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-gray-700 text-gray-300"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isValid || loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Confirmar reembolso"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
