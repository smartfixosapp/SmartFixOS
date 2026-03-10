import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import SMSService from "./SMSService";

const SMS_TEMPLATES = {
  order_ready: (order) => `🎉 ¡Buenas noticias de 911 SmartFix!

Su ${order.device_brand} ${order.device_model} está listo para recoger.

Orden: ${order.order_number}
${order.balance_due > 0 ? `Saldo: $${order.balance_due.toFixed(2)}` : '✅ Pagado'}

Horario: Lun-Sáb 9AM-6PM

¡Gracias por confiar en nosotros! 🛠️`,

  in_progress: (order) => `🔧 Actualización - 911 SmartFix

Orden: ${order.order_number}

Hemos comenzado a trabajar en su ${order.device_brand} ${order.device_model}.

Le notificaremos cuando esté listo.

📞 (787) 123-4567`,

  waiting_parts: (order) => `⏳ Actualización - 911 SmartFix

Orden: ${order.order_number}

Estamos esperando piezas para su ${order.device_brand} ${order.device_model}.

Le avisaremos cuando lleguen.

📞 (787) 123-4567`,

  diagnosis_complete: (order) => `🔍 Diagnóstico Completo - 911 SmartFix

Orden: ${order.order_number}

Hemos completado el diagnóstico de su ${order.device_brand} ${order.device_model}.

${order.cost_estimate ? `Costo estimado: $${order.cost_estimate.toFixed(2)}` : ''}

Llámenos para más detalles.
📞 (787) 123-4567`,

  custom: () => `911 SmartFix - `
};

export default function SMSDialog({ open, onClose, order }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [characterCount, setCharacterCount] = useState(0);

  useEffect(() => {
    checkSMSEnabled();
  }, []);

  useEffect(() => {
    if (open && order) {
      setMessage(SMS_TEMPLATES.custom());
      setResult(null);
    }
  }, [open, order]);

  useEffect(() => {
    setCharacterCount(message.length);
  }, [message]);

  const checkSMSEnabled = async () => {
    const enabled = await SMSService.isSMSEnabled();
    setSmsEnabled(enabled);
  };

  const handleTemplateSelect = (templateKey) => {
    const template = SMS_TEMPLATES[templateKey];
    if (template && order) {
      setMessage(template(order));
    }
  };

  const handleSend = async () => {
    if (!message.trim() || !order) return;

    setSending(true);
    setResult(null);

    try {
      const response = await SMSService.sendSMS({
        to: order.customer_phone,
        message: message.trim()
      });

      setResult(response);

      if (response.success) {
        setTimeout(() => {
          onClose();
          setMessage("");
          setResult(null);
        }, 2000);
      }
    } catch (error) {
      setResult({ success: false, error: error.message });
    } finally {
      setSending(false);
    }
  };

  if (!order) return null;

  const segmentCount = Math.ceil(characterCount / 160);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-red-600" />
            Enviar SMS a Cliente
          </DialogTitle>
        </DialogHeader>

        {!smsEnabled ? (
          <div className="p-6 bg-yellow-600/20 border border-yellow-600/30 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-yellow-200 font-semibold">SMS no configurado</p>
                <p className="text-yellow-300/80 text-sm mt-1">
                  Configure SMS en Ajustes → Notificaciones para habilitar esta función.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="bg-black/40 border border-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Cliente</p>
                    <p className="text-white font-medium">{order.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">Teléfono</p>
                    <p className="text-white font-medium">{order.customer_phone}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-sm text-gray-400">Orden</p>
                  <p className="text-white font-medium">{order.order_number}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-gray-400">Plantillas rápidas:</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTemplateSelect("order_ready")}
                    className="border-green-600/30 hover:bg-green-600/20 text-green-300"
                  >
                    ✅ Listo para recoger
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTemplateSelect("in_progress")}
                    className="border-blue-600/30 hover:bg-blue-600/20 text-blue-300"
                  >
                    🔧 En progreso
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTemplateSelect("waiting_parts")}
                    className="border-orange-600/30 hover:bg-orange-600/20 text-orange-300"
                  >
                    ⏳ Esperando piezas
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTemplateSelect("diagnosis_complete")}
                    className="border-purple-600/30 hover:bg-purple-600/20 text-purple-300"
                  >
                    🔍 Diagnóstico
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-400">Mensaje:</p>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`${characterCount > 160 ? 'bg-yellow-600/20 text-yellow-300' : 'bg-gray-600/20 text-gray-300'}`}>
                      {characterCount} caracteres
                    </Badge>
                    <Badge variant="outline" className="bg-gray-600/20 text-gray-300">
                      {segmentCount} {segmentCount === 1 ? 'SMS' : 'SMS'}
                    </Badge>
                  </div>
                </div>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escriba su mensaje aquí..."
                  rows={8}
                  className="bg-black/40 border-white/10 text-white resize-none"
                  maxLength={480}
                />
                <p className="text-xs text-gray-500">
                  💡 Los mensajes de más de 160 caracteres se envían como múltiples SMS.
                </p>
              </div>

              {result && (
                <div className={`p-4 rounded-lg border ${
                  result.success 
                    ? 'bg-green-600/20 border-green-600/30' 
                    : 'bg-red-600/20 border-red-600/30'
                }`}>
                  <div className="flex items-start gap-3">
                    {result.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-semibold ${result.success ? 'text-green-200' : 'text-red-200'}`}>
                        {result.success ? '✅ SMS enviado correctamente' : '❌ Error al enviar SMS'}
                      </p>
                      {result.error && (
                        <p className="text-sm text-red-300/80 mt-1">{result.error}</p>
                      )}
                      {result.success && result.messageId && (
                        <p className="text-xs text-green-300/60 mt-1">ID: {result.messageId}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={sending}
                className="border-gray-700"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar SMS
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
