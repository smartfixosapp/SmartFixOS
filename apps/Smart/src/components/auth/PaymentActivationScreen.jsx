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
    <div className="apple-type fixed inset-0 apple-surface backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-apple-lg bg-apple-blue/15 flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-10 h-10 text-apple-blue" />
          </div>
          <h1 className="apple-text-title1 apple-label-primary mb-2">Activa tu plan {planInfo.label}</h1>
          <p className="apple-label-tertiary apple-text-subheadline">Pago seguro procesado por Stripe</p>
        </div>

        {/* Resumen del plan */}
        <div className="apple-card rounded-apple-lg p-8 mb-6">
          <div className="space-y-4 mb-6 pb-6" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
            <div className="flex justify-between items-center">
              <span className="apple-label-secondary apple-text-body">Plan</span>
              <span className="apple-label-primary apple-text-body font-semibold">{planInfo.label}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="apple-label-secondary apple-text-body">Tienda</span>
              <span className="apple-label-primary apple-text-body font-semibold">{tenantName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="apple-label-secondary apple-text-body">Precio mensual</span>
              <span className="apple-text-title3 font-semibold text-apple-green tabular-nums">${planInfo.price} USD</span>
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
                <CheckCircle className="w-4 h-4 text-apple-green flex-shrink-0" />
                <span className="apple-label-secondary apple-text-subheadline">{benefit}</span>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-4 bg-apple-red/12 rounded-apple-md p-3">
              <p className="text-apple-red apple-text-subheadline">{error}</p>
            </div>
          )}
        </div>

        {/* Seguridad */}
        <div className="bg-apple-blue/12 rounded-apple-md p-4 mb-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-apple-blue flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-apple-blue apple-text-subheadline font-semibold">Pago 100% seguro con Stripe</p>
              <p className="text-apple-blue apple-text-caption1 mt-0.5 opacity-80">
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
            className="apple-btn apple-btn-primary apple-btn-lg w-full"
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
            className="apple-btn apple-btn-secondary w-full"
          >
            Cancelar
          </Button>
        </div>

        <p className="text-center apple-text-caption1 apple-label-tertiary mt-6 tabular-nums">
          Se cobrará $49.00 USD/mes. Puedes cancelar en cualquier momento.
        </p>
      </div>
    </div>
  );
}
