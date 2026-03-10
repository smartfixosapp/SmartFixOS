import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreditCard, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function PaymentActivationScreen({ 
  tenantId, 
  tenantName, 
  onPaymentSuccess, 
  onPaymentError,
  onCancel 
}) {
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [cardInfo, setCardInfo] = useState({
    cardNumber: "",
    cardExpiry: "",
    cardCvc: "",
    cardName: ""
  });

  const handlePayment = async () => {
    // Validaciones básicas
    if (!cardInfo.cardNumber || cardInfo.cardNumber.length < 13) {
      setPaymentError("Número de tarjeta inválido");
      return;
    }
    if (!cardInfo.cardExpiry || !cardInfo.cardExpiry.includes("/")) {
      setPaymentError("Fecha de expiración inválida (MM/AA)");
      return;
    }
    if (!cardInfo.cardCvc || cardInfo.cardCvc.length < 3) {
      setPaymentError("CVC inválido");
      return;
    }
    if (!cardInfo.cardName) {
      setPaymentError("Nombre del titular obligatorio");
      return;
    }

    setLoading(true);
    setPaymentError(null);

    try {
      // En producción, esto se integraría con Stripe
      // Por ahora, simulamos el pago
      const response = await fetch("/.netlify/functions/processPayment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          planPrice: 65,
          cardNumber: cardInfo.cardNumber.slice(-4), // Solo últimos 4 dígitos
          cardName: cardInfo.cardName
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success("¡Plan activado exitosamente!");
        setTimeout(() => onPaymentSuccess(), 1500);
      } else {
        setPaymentError(data.error || "Error al procesar el pago");
        onPaymentError?.(data.error);
      }
    } catch (error) {
      console.error("Payment error:", error);
      setPaymentError("Error al procesar el pago. Intenta nuevamente.");
      onPaymentError?.(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCardNumberChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 16);
    setCardInfo({ ...cardInfo, cardNumber: value });
  };

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, "").slice(0, 4);
    if (value.length >= 2) {
      value = value.slice(0, 2) + "/" + value.slice(2);
    }
    setCardInfo({ ...cardInfo, cardExpiry: value });
  };

  const handleCvcChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setCardInfo({ ...cardInfo, cardCvc: value });
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-[0_0_60px_rgba(6,182,212,0.3)]">
            <CreditCard className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Activa tu plan SmartFixOS</h1>
        </div>

        {/* Resumen */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-8">
          <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Plan</span>
              <span className="text-white font-semibold">SmartFixOS</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tienda</span>
              <span className="text-white font-semibold">{tenantName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Precio mensual</span>
              <span className="text-xl font-black text-emerald-400">$65.00</span>
            </div>
          </div>

          {/* Formulario */}
          <div className="space-y-4">
            {paymentError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-300 text-sm font-semibold">Error en el pago</p>
                  <p className="text-red-200/80 text-sm">{paymentError}</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 mb-2 block font-semibold">Titular de la tarjeta</label>
              <Input
                value={cardInfo.cardName}
                onChange={(e) => setCardInfo({ ...cardInfo, cardName: e.target.value })}
                placeholder="Nombre completo"
                className="bg-black/40 border-cyan-500/20 text-white placeholder:text-gray-600 h-11"
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-2 block font-semibold">Número de tarjeta</label>
              <Input
                value={cardInfo.cardNumber}
                onChange={handleCardNumberChange}
                placeholder="1234 5678 9012 3456"
                className="bg-black/40 border-cyan-500/20 text-white placeholder:text-gray-600 h-11 font-mono"
                disabled={loading}
              />
              <p className="text-xs text-gray-500 mt-1">Se procesa de forma segura con Stripe</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-2 block font-semibold">Vencimiento</label>
                <Input
                  value={cardInfo.cardExpiry}
                  onChange={handleExpiryChange}
                  placeholder="MM/AA"
                  className="bg-black/40 border-cyan-500/20 text-white placeholder:text-gray-600 h-11 font-mono"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-2 block font-semibold">CVC</label>
                <Input
                  value={cardInfo.cardCvc}
                  onChange={handleCvcChange}
                  placeholder="123"
                  className="bg-black/40 border-cyan-500/20 text-white placeholder:text-gray-600 h-11 font-mono"
                  disabled={loading}
                  type="password"
                />
              </div>
            </div>

            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-3 mt-4">
              <p className="text-xs text-cyan-300 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                Tu información de pago es procesada de forma segura.
              </p>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="space-y-3">
          <Button
            onClick={handlePayment}
            disabled={loading || !cardInfo.cardNumber || !cardInfo.cardExpiry || !cardInfo.cardCvc || !cardInfo.cardName}
            className="w-full h-14 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-lg shadow-[0_0_60px_rgba(6,182,212,0.3)]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Procesando pago...
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Confirmar y activar plan
              </>
            )}
          </Button>
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={loading}
            className="w-full h-12 border-white/20 text-white hover:bg-white/5"
          >
            Cancelar
          </Button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Se cobrará $65.00 mensuales. Puedes cancelar en cualquier momento.
        </p>
      </div>
    </div>
  );
}
