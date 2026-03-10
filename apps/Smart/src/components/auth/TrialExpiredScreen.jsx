import React from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, Lock, CheckCircle } from "lucide-react";

export default function TrialExpiredScreen({ tenantName, onActivatePlan, onContactSupport }) {
  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-600 to-red-600 flex items-center justify-center mx-auto mb-6 shadow-[0_0_60px_rgba(220,38,38,0.4)]">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white mb-3">Tu período de prueba ha finalizado</h1>
          <p className="text-gray-300 text-lg">
            Gracias por probar SmartFixOS
          </p>
        </div>

        {/* Mensaje principal */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 mb-8 space-y-6">
          <div>
            <p className="text-white text-base leading-relaxed">
              Tu acceso de prueba de <span className="font-bold text-cyan-400">15 días</span> ha terminado.
            </p>
            <p className="text-gray-300 text-base mt-3">
              Para continuar utilizando el sistema y acceder a tus órdenes, clientes y operaciones, necesitas activar un plan.
            </p>
          </div>

          {/* Recordatorio de valor */}
          <div className="border-t border-white/10 pt-6">
            <p className="text-gray-400 text-sm font-semibold mb-3">Durante tu prueba pudiste usar:</p>
            <div className="space-y-2">
              {[
                "Gestión completa de órdenes de reparación",
                "Control de clientes e historial",
                "Acceso seguro por tienda y PIN",
                "Operación diaria sin límites"
              ].map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-300 text-sm">{feature}</span>
                </div>
              ))}
            </div>
            <p className="text-cyan-400 text-sm mt-4 font-semibold">
              ✓ Todo eso sigue intacto. Tus datos no se han perdido.
            </p>
          </div>

          {/* Precio */}
          <div className="bg-gradient-to-r from-cyan-600/20 to-emerald-600/20 border border-cyan-500/30 rounded-2xl p-6 text-center">
            <p className="text-gray-400 text-sm mb-2">Plan SmartFixOS</p>
            <p className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              $65 / mes
            </p>
            <p className="text-gray-400 text-xs mt-3">por tienda</p>
            <div className="mt-4 space-y-1 text-sm text-gray-400">
              <p>✓ Sin contratos largos</p>
              <p>✓ Sin cargos ocultos</p>
            </div>
          </div>
        </div>

        {/* Botones */}
        <div className="space-y-3 mb-6">
          <Button
            onClick={onActivatePlan}
            className="w-full h-14 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-bold text-lg shadow-[0_0_60px_rgba(6,182,212,0.3)]"
          >
            Activar plan y continuar
          </Button>
          <Button
            onClick={onContactSupport}
            variant="outline"
            className="w-full h-12 border-white/20 text-white hover:bg-white/5"
          >
            Contactar por email
          </Button>
        </div>

        {/* Texto de soporte */}
        <p className="text-center text-xs text-gray-500 mb-4">
          Si necesitas ayuda con la activación o tienes una pregunta antes de continuar, contáctanos directamente.
        </p>

        {/* Nota legal */}
        <div className="bg-black/40 border border-white/5 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-400">
            <Lock className="w-3 h-3 inline mr-1.5" />
            Tus datos permanecen seguros y guardados. El acceso se restablecerá automáticamente al activar el plan.
          </p>
        </div>
      </div>
    </div>
  );
}
