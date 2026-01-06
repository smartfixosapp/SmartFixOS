import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export default function TermsStep({ formData, updateFormData, config }) {
  const termsText = config?.terms_text?.es || `
    <h3>Términos y Condiciones - 911 SmartFix Puerto Rico</h3>
    
    <p>1. El cliente autoriza la reparación del equipo descrito en esta orden.</p>
    
    <p>2. Se requiere un depósito del 50% para iniciar la reparación. El saldo restante debe pagarse antes de la entrega del equipo.</p>
    
    <p>3. El tiempo estimado de reparación es solo una estimación y puede variar según disponibilidad de piezas.</p>
    
    <p>4. 911 SmartFix no se hace responsable por pérdida de datos. Se recomienda hacer respaldo antes de entregar el equipo.</p>
    
    <p>5. Las reparaciones tienen garantía de 30 días en mano de obra. Las piezas tienen garantía del fabricante.</p>
    
    <p>6. Si el equipo no es recogido en 60 días después de completada la reparación, 911 SmartFix se reserva el derecho de disponer del equipo.</p>
    
    <p>7. Al firmar esta orden, el cliente acepta todos los términos y condiciones aquí descritos.</p>
  `;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-bold text-white mb-2">Términos y Condiciones</h3>
        <p className="text-gray-400 text-sm">Por favor lee y acepta los términos</p>
      </div>

      <Card className="bg-black border-gray-800 p-6 max-h-96 overflow-y-auto">
        <div 
          className="prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: termsText }}
        />
      </Card>

      <div className="flex items-start gap-3 p-4 bg-gray-900 rounded-lg border border-gray-800">
        <Checkbox
          id="terms"
          checked={formData.terms_accepted}
          onCheckedChange={(checked) => updateFormData('terms_accepted', checked)}
          className="mt-1"
        />
        <Label
          htmlFor="terms"
          className="text-white font-medium cursor-pointer"
        >
          He leído y acepto los términos y condiciones *
        </Label>
      </div>

      {!formData.terms_accepted && (
        <div className="text-sm text-yellow-400 flex items-center gap-2">
          <span>⚠️</span>
          Debes aceptar los términos para continuar
        </div>
      )}
    </div>
  );
}
