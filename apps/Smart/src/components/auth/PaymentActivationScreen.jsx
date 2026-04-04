import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2, CheckCircle, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { createStripeSubscription } from "@/api/functions";
import { getPlan, normalizePlanId } from "@/lib/plans";

export default function PaymentActivationScreen({
  tenantId,
  tenantName,
  tenantPlan,
  onPaymentSuccess,
  onPaymentError,
  onCancel
}) {
  const planInfo = getPlan(tenantPlan || "starter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Detectar retorno exitoso desde Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_success") === "true") {
      // Limpiar params de la URL
      const url = new URL(window.location.href);
      url.searchParams.delete("payment_success");
      url.searchParams.delete("session_id");
      window.history.replaceState({}, "", url.toString());
      toast.success("¡Plan activado exitosamente!");
      onPaymentSuccess?.();
    }
    if (params.get("payment_cancelled") === "true") {
      const url = new URL(window.location.href);
      url.searchParams.delete("payment_cancelled");
      window.history.replaceState({}, "", url.toString());
      setError("Pago cancelado. Puedes intentarlo de nuevo cuando quieras.");
    }
  }, []);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const result = await createStripeSubscription({
        tenantId,
        successUrl: `${origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/?payment_cancelled=true`
      });

      const data = result?.data ?? result;
      if (!data?.url) {
        throw new Error(data?.error || "No se recibió la URL de pago");
      }

      // Redirigir a Stripe Checkout
      window.location.href = data.url;

    } catch (err) {
      console.error("Checkout error:", err);
      const msg = err.message || "Error al iniciar el pago. Intenta nuevamente.";
      setError(msg);
      onPaymentError?.(msg);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-[0_0_60px_rgba(6,182,212,0.3)]">
            <CreditCard className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Activa tu plan {planInfo.label}</h1>
          <p className="text-gray-400 text-sm">Pago seguro procesado por Stripe</p>
        </div>

        {/* Resumen del plan */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-6">
          <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Plan</span>
              <span className="text-white font-semibold">Starter</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Tienda</span>
              <span className="text-white font-semibold">{tenantName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Precio mensual</span>
              <span className="text-xl font-black text-emerald-400">$49.00 USD</span>
            </div>
          </div>

          {/* Beneficios */}
          <div className="space-y-2">
            {[
              "Órdenes de reparación ilimitadas",
              "POS y gestión de caja",
              "Inventario y stock",
              "Clientes y historial",
              "Panel financiero",
              "Soporte por email"
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-gray-300 text-sm">{benefit}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Seguridad */}
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-cyan-300 text-sm font-semibold">Pago 100% seguro con Stripe</p>
              <p className="text-cyan-400/70 text-xs mt-0.5">
                Serás redirigido a la página de Stripe para ingresar tus datos de pago de forma segura. Nunca almacenamos tu información de tarjeta.
              </p>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="space-y-3">
          <Button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full h-14 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-lg shadow-[0_0_60px_rgba(6,182,212,0.3)]"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Redirigiendo a Stripe...
              </>
            ) : (
              <>
                <ExternalLink className="w-5 h-5 mr-2" />
                Pagar con Stripe
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

        <p className="text-center text-xs text-gray-500 mt-6">
          Se cobrará $49.00 USD/mes. Puedes cancelar en cualquier momento.
        </p>
      </div>
    </div>
  );
}
