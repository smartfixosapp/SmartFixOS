import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, User, Smartphone, AlertCircle, Image, FileText } from "lucide-react";

export default function ConfirmationStep({ formData }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="w-8 h-8 text-green-400" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-2">Confirmar Orden de Trabajo</h3>
        <p className="text-gray-400">Revisa la información antes de crear la orden</p>
      </div>

      <Card className="bg-gray-900 border-gray-800 p-6 space-y-4">
        {/* Device Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Smartphone className="w-5 h-5 text-blue-400" />
            <h4 className="font-semibold text-white">Equipo</h4>
          </div>
          <div className="pl-7 space-y-1">
            <p className="text-gray-300">
              {formData.device_category?.name} - {formData.device_model?.name}
            </p>
            {formData.device_model?.brand && (
              <p className="text-sm text-gray-500">Marca: {formData.device_model.brand}</p>
            )}
          </div>
        </div>

        {/* Problem */}
        {formData.problem && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-orange-400" />
              <h4 className="font-semibold text-white">Problema</h4>
            </div>
            <div className="pl-7">
              <p className="text-gray-300">{formData.problem}</p>
              {formData.problem_description && (
                <p className="text-sm text-gray-500 mt-1">{formData.problem_description}</p>
              )}
            </div>
          </div>
        )}

        {/* Customer Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <User className="w-5 h-5 text-purple-400" />
            <h4 className="font-semibold text-white">Cliente</h4>
          </div>
          <div className="pl-7 space-y-1">
            <p className="text-gray-300">
              {formData.customer.name} {formData.customer.last_name}
            </p>
            <p className="text-sm text-gray-500">{formData.customer.phone}</p>
            {formData.customer.email && (
              <p className="text-sm text-gray-500">{formData.customer.email}</p>
            )}
          </div>
        </div>

        {/* Comments */}
        {(formData.comments || formData.internal_notes) && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-gray-400" />
              <h4 className="font-semibold text-white">Comentarios</h4>
            </div>
            <div className="pl-7 space-y-2">
              {formData.comments && (
                <div>
                  <Badge variant="outline" className="mb-1 text-xs">Visibles</Badge>
                  <p className="text-sm text-gray-400">{formData.comments}</p>
                </div>
              )}
              {formData.internal_notes && (
                <div>
                  <Badge variant="outline" className="mb-1 text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                    Internos
                  </Badge>
                  <p className="text-sm text-gray-400">{formData.internal_notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Media */}
        {formData.media_files && formData.media_files.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Image className="w-5 h-5 text-green-400" />
              <h4 className="font-semibold text-white">Archivos adjuntos</h4>
            </div>
            <div className="pl-7">
              <p className="text-sm text-gray-400">
                {formData.media_files.length} archivo(s) adjunto(s)
              </p>
            </div>
          </div>
        )}

        {/* Signature */}
        {formData.signature && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Check className="w-5 h-5 text-green-400" />
              <h4 className="font-semibold text-white">Firma</h4>
            </div>
            <div className="pl-7">
              <img 
                src={formData.signature} 
                alt="Firma del cliente" 
                className="border border-gray-700 rounded max-w-xs"
              />
            </div>
          </div>
        )}

        {/* Terms */}
        {formData.terms_accepted && (
          <div>
            <div className="flex items-center gap-2">
              <Check className="w-5 h-5 text-green-400" />
              <p className="text-sm text-gray-300">Términos y condiciones aceptados</p>
            </div>
          </div>
        )}
      </Card>

      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-blue-400 text-center">
          Al confirmar, se creará la orden y se enviará un email de confirmación al cliente
        </p>
      </div>
    </div>
  );
}
