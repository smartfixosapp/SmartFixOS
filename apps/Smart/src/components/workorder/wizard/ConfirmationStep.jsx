import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, User, Smartphone, AlertCircle, Image, FileText } from "lucide-react";

export default function ConfirmationStep({ formData }) {
  return (
    <div className="apple-type space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
          <Check className="w-8 h-8 text-apple-green" />
        </div>
        <h3 className="apple-text-title2 apple-label-primary mb-2">Confirmar Orden de Trabajo</h3>
        <p className="apple-text-subheadline apple-label-secondary">Revisa la información antes de crear la orden</p>
      </div>

      <Card className="apple-card p-6 space-y-4">
        {/* Device Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-apple-sm bg-apple-blue/12 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-apple-blue" />
            </div>
            <h4 className="apple-text-headline apple-label-primary">Equipo</h4>
          </div>
          <div className="pl-10 space-y-1">
            <p className="apple-text-body apple-label-primary">
              {formData.device_category?.name} - {formData.device_model?.name}
            </p>
            {formData.device_model?.brand && (
              <p className="apple-text-footnote apple-label-tertiary">Marca: {formData.device_model.brand}</p>
            )}
          </div>
        </div>

        <div style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }} />

        {/* Problem */}
        {formData.problem && (
          <>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-apple-sm bg-apple-orange/15 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-apple-orange" />
                </div>
                <h4 className="apple-text-headline apple-label-primary">Problema</h4>
              </div>
              <div className="pl-10">
                <p className="apple-text-body apple-label-primary">{formData.problem}</p>
                {formData.problem_description && (
                  <p className="apple-text-footnote apple-label-tertiary mt-1">{formData.problem_description}</p>
                )}
              </div>
            </div>
            <div style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }} />
          </>
        )}

        {/* Customer Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-apple-sm bg-apple-purple/12 flex items-center justify-center">
              <User className="w-4 h-4 text-apple-purple" />
            </div>
            <h4 className="apple-text-headline apple-label-primary">Cliente</h4>
          </div>
          <div className="pl-10 space-y-1">
            <p className="apple-text-body apple-label-primary">
              {formData.customer.name} {formData.customer.last_name}
            </p>
            <p className="apple-text-footnote apple-label-tertiary tabular-nums">{formData.customer.phone}</p>
            {formData.customer.email && (
              <p className="apple-text-footnote apple-label-tertiary">{formData.customer.email}</p>
            )}
          </div>
        </div>

        {/* Comments */}
        {(formData.comments || formData.internal_notes) && (
          <>
            <div style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }} />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center">
                  <FileText className="w-4 h-4 apple-label-secondary" />
                </div>
                <h4 className="apple-text-headline apple-label-primary">Comentarios</h4>
              </div>
              <div className="pl-10 space-y-2">
                {formData.comments && (
                  <div>
                    <Badge variant="outline" className="mb-1 apple-text-caption1">Visibles</Badge>
                    <p className="apple-text-footnote apple-label-secondary">{formData.comments}</p>
                  </div>
                )}
                {formData.internal_notes && (
                  <div>
                    <Badge variant="outline" className="mb-1 apple-text-caption1 bg-apple-yellow/15 text-apple-yellow border-transparent">
                      Internos
                    </Badge>
                    <p className="apple-text-footnote apple-label-secondary">{formData.internal_notes}</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Media */}
        {formData.media_files && formData.media_files.length > 0 && (
          <>
            <div style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }} />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                  <Image className="w-4 h-4 text-apple-green" />
                </div>
                <h4 className="apple-text-headline apple-label-primary">Archivos adjuntos</h4>
              </div>
              <div className="pl-10">
                <p className="apple-text-footnote apple-label-secondary tabular-nums">
                  {formData.media_files.length} archivo(s) adjunto(s)
                </p>
              </div>
            </div>
          </>
        )}

        {/* Signature */}
        {formData.signature && (
          <>
            <div style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }} />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-apple-sm bg-apple-green/15 flex items-center justify-center">
                  <Check className="w-4 h-4 text-apple-green" />
                </div>
                <h4 className="apple-text-headline apple-label-primary">Firma</h4>
              </div>
              <div className="pl-10">
                <img
                  src={formData.signature}
                  alt="Firma del cliente"
                  className="rounded-apple-sm max-w-xs"
                  style={{ border: "0.5px solid rgb(var(--separator) / 0.29)" }}
                />
              </div>
            </div>
          </>
        )}

        {/* Terms */}
        {formData.terms_accepted && (
          <>
            <div style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }} />
            <div>
              <div className="flex items-center gap-2">
                <Check className="w-5 h-5 text-apple-green" />
                <p className="apple-text-subheadline apple-label-primary">Términos y condiciones aceptados</p>
              </div>
            </div>
          </>
        )}
      </Card>

      <div className="p-4 bg-apple-blue/12 rounded-apple-sm">
        <p className="apple-text-footnote text-apple-blue text-center">
          Al confirmar, se creará la orden y se enviará un email de confirmación al cliente
        </p>
      </div>
    </div>
  );
}
