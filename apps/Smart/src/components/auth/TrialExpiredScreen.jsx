import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, Lock, CheckCircle, ArrowRight } from "lucide-react";
import { PLANS } from "@/lib/plans";

export default function TrialExpiredScreen({ tenantName, onActivatePlan, onContactSupport }) {
  const navigate = useNavigate();
  return (
    <div className="apple-type fixed inset-0 apple-surface backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-apple-lg bg-apple-red/15 flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-apple-red" />
          </div>
          <h1 className="apple-text-large-title apple-label-primary mb-3">Tu período de prueba ha finalizado</h1>
          <p className="apple-text-body apple-label-secondary">
            Gracias por probar SmartFixOS
          </p>
        </div>

        {/* Mensaje principal */}
        <div className="apple-card rounded-apple-lg p-8 mb-8 space-y-6">
          <div>
            <p className="apple-text-body apple-label-primary leading-relaxed">
              Tu acceso de prueba de <span className="font-semibold text-apple-blue">15 días</span> ha terminado.
            </p>
            <p className="apple-text-body apple-label-secondary mt-3">
              Para continuar utilizando el sistema y acceder a tus órdenes, clientes y operaciones, necesitas activar un plan.
            </p>
          </div>

          {/* Recordatorio de valor */}
          <div className="pt-6" style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}>
            <p className="apple-text-footnote apple-label-tertiary font-semibold mb-3">Durante tu prueba pudiste usar:</p>
            <div className="space-y-2">
              {[
                "Gestión completa de órdenes de reparación",
                "Control de clientes e historial",
                "Acceso seguro por tienda y PIN",
                "Operación diaria sin límites"
              ].map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-apple-green flex-shrink-0 mt-0.5" />
                  <span className="apple-text-footnote apple-label-secondary">{feature}</span>
                </div>
              ))}
            </div>
            <p className="apple-text-footnote text-apple-blue mt-4 font-semibold">
              ✓ Todo eso sigue intacto. Tus datos no se han perdido.
            </p>
          </div>

          {/* Planes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="liquid-glass rounded-2xl p-5 text-center">
              <p className="apple-text-footnote apple-label-tertiary mb-1">{PLANS.starter.label}</p>
              <p className="text-2xl font-black text-white tabular-nums">${PLANS.starter.price}</p>
              <p className="apple-text-caption2 apple-label-tertiary mt-1">/ mes</p>
              <p className="apple-text-caption2 apple-label-secondary mt-2">{PLANS.starter.tagline}</p>
            </div>
            <div className="liquid-glass-strong rounded-2xl p-5 text-center ring-1 ring-cyan-500/30">
              <p className="apple-text-footnote text-cyan-400 mb-1">{PLANS.pro.label}</p>
              <p className="text-2xl font-black text-white tabular-nums">${PLANS.pro.price}</p>
              <p className="apple-text-caption2 apple-label-tertiary mt-1">/ mes</p>
              <p className="apple-text-caption2 text-cyan-400/70 mt-2">{PLANS.pro.tagline}</p>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="space-y-3 mb-6">
          <Button
            onClick={onActivatePlan}
            className="apple-btn apple-btn-primary apple-btn-lg w-full"
          >
            Activar plan y continuar
          </Button>
          <Button
            onClick={onContactSupport}
            variant="outline"
            className="apple-btn apple-btn-secondary w-full"
          >
            Contactar por email
          </Button>
        </div>

        {/* Texto de soporte */}
        <p className="text-center apple-text-caption1 apple-label-tertiary mb-4">
          Si necesitas ayuda con la activación o tienes una pregunta antes de continuar, contáctanos directamente.
        </p>

        {/* Nota legal */}
        <div className="apple-surface-elevated rounded-apple-md p-4 text-center">
          <p className="apple-text-caption1 apple-label-tertiary">
            <Lock className="w-3 h-3 inline mr-1.5" />
            Tus datos permanecen seguros y guardados. El acceso se restablecerá automáticamente al activar el plan.
          </p>
        </div>
      </div>
    </div>
  );
}
