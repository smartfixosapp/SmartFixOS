import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { openWhatsApp } from "@/components/utils/helpers";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function PrintDialog({ open, onClose, type, data, customer }) {
  const [sending, setSending] = useState(false);
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [showPhoneInput, setShowPhoneInput] = useState(false);

  const customerEmail = type === "order" ? data?.customer_email : customer?.email;
  const customerPhone = type === "order" ? data?.customer_phone : customer?.phone;

  const handleSendEmail = async () => {
    const emailToUse = customerEmail || manualEmail;
    
    if (!emailToUse) {
      setShowEmailInput(true);
      toast.error("Ingresa un email");
      return;
    }

    setSending(true);
    try {
      if (type === "order") {
        const emailBody = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background: #F3F4F6;">
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="background: linear-gradient(135deg, #00A8E8 0%, #10B981 50%, #A8D700 100%); padding: 40px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                  🔧 Orden de Trabajo
                </h1>
              </div>
              
              <div style="padding: 40px 30px; background: white;">
                <div style="background: #F9FAFB; border-left: 4px solid #00A8E8; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                  <div style="margin-bottom: 15px;">
                    <p style="margin: 0; color: #6B7280; font-size: 12px;">ORDEN</p>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 24px; font-weight: bold;">${data.order_number}</p>
                  </div>
                  <div>
                    <p style="margin: 0; color: #6B7280; font-size: 12px;">CLIENTE</p>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 18px; font-weight: bold;">${data.customer_name}</p>
                  </div>
                </div>

                <div style="background: #F0FDF4; border: 2px solid #10B981; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                  <p style="margin: 0 0 10px 0; color: #374151; font-weight: bold;">EQUIPO:</p>
                  <p style="margin: 0; color: #1F2937; font-size: 16px;">${data.device_brand || ''} ${data.device_model || ''}</p>
                  ${data.device_serial ? `<p style="margin: 8px 0 0 0; color: #6B7280; font-size: 14px;">Serie: ${data.device_serial}</p>` : ''}
                </div>

                ${data.initial_problem ? `
                <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin-bottom: 20px;">
                  <p style="margin: 0 0 8px 0; color: #92400E; font-weight: bold; font-size: 12px;">PROBLEMA REPORTADO:</p>
                  <p style="margin: 0; color: #78350F; white-space: pre-wrap;">${data.initial_problem}</p>
                </div>
                ` : ''}

                <div style="text-align: center; padding: 20px; background: #F9FAFB; border-radius: 8px;">
                  <p style="margin: 0; color: #6B7280; font-size: 12px;">
                    SmartFixOS - Gracias por confiar en nosotros
                  </p>
                </div>
              </div>
            </div>
          </body>
          </html>
        `;

        await base44.integrations.Core.SendEmail({
          from_name: "SmartFixOS",
          to: emailToUse,
          subject: `🔧 Orden #${data.order_number} - SmartFixOS`,
          body: emailBody
        });

        toast.success("✅ Orden enviada por email");
      } else {
        const itemsList = (data.items || []).map((item, idx) => 
          `<tr style="background: ${idx % 2 === 0 ? '#F9FAFB' : 'white'};">
            <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; color: #1F2937; font-weight: 600;">${item.name}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: center; color: #374151;">${item.quantity}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: right; color: #6B7280;">$${item.price.toFixed(2)}</td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: bold; color: #059669;">$${(item.price * item.quantity).toFixed(2)}</td>
          </tr>`
        ).join('');

        const emailBody = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; background: #F3F4F6;">
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
              <div style="background: linear-gradient(135deg, #00A8E8 0%, #10B981 50%, #A8D700 100%); padding: 40px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                  🧾 Recibo de Venta
                </h1>
              </div>
              
              <div style="padding: 40px 30px; background: white;">
                <div style="background: #F9FAFB; border-left: 4px solid #00A8E8; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px;">
                    <div>
                      <p style="margin: 0; color: #6B7280; font-size: 12px;">RECIBO</p>
                      <p style="margin: 4px 0 0 0; color: #111827; font-size: 20px; font-weight: bold;">${data.sale_number}</p>
                    </div>
                    <div>
                      <p style="margin: 0; color: #6B7280; font-size: 12px;">FECHA</p>
                      <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 600;">${format(new Date(data.created_date), 'dd/MM/yyyy')}</p>
                    </div>
                  </div>
                  ${customer ? `
                  <div style="border-top: 1px solid #E5E7EB; padding-top: 15px;">
                    <p style="margin: 0; color: #6B7280; font-size: 12px;">CLIENTE</p>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 18px; font-weight: bold;">${customer.name}</p>
                  </div>
                  ` : ''}
                </div>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                  <thead>
                    <tr style="background: #374151;">
                      <th style="padding: 12px; text-align: left; color: white;">Descripción</th>
                      <th style="padding: 12px; text-align: center; color: white;">Cant.</th>
                      <th style="padding: 12px; text-align: right; color: white;">Precio</th>
                      <th style="padding: 12px; text-align: right; color: white;">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsList}
                  </tbody>
                </table>

                <div style="background: #F0FDF4; border: 2px solid #10B981; border-radius: 12px; padding: 20px;">
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #374151;">Subtotal</span>
                    <span style="color: #1F2937; font-weight: bold;">$${(data.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <span style="color: #374151;">IVU (11.5%)</span>
                    <span style="color: #1F2937; font-weight: bold;">$${(data.tax_amount || 0).toFixed(2)}</span>
                  </div>
                  <div style="border-top: 2px solid #10B981; padding-top: 12px; margin-top: 12px; display: flex; justify-content: space-between;">
                    <span style="color: #059669; font-size: 20px; font-weight: 900;">TOTAL</span>
                    <span style="color: #059669; font-size: 32px; font-weight: 900;">$${(data.total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div style="background: #F9FAFB; padding: 20px; text-align: center;">
                <p style="margin: 0; color: #6B7280; font-size: 11px;">
                  SmartFixOS • Gracias por su compra
                </p>
              </div>
            </div>
          </body>
          </html>
        `;

        await base44.integrations.Core.SendEmail({
          from_name: "SmartFixOS",
          to: emailToUse,
          subject: `🧾 Recibo #${data.sale_number} - SmartFixOS`,
          body: emailBody
        });

        toast.success("✅ Recibo enviado por email");
      }

      setManualEmail("");
      setShowEmailInput(false);
      onClose();
    } catch (error) {
      console.error("Error sending email:", error);
      toast.error("Error al enviar email");
    } finally {
      setSending(false);
    }
  };

  const handleSendWhatsApp = async () => {
    const phoneToUse = customerPhone || manualPhone;
    
    if (!phoneToUse) {
      setShowPhoneInput(true);
      toast.error("Ingresa un teléfono");
      return;
    }

    let message = "";
    
    if (type === "order") {
      message = `
🔧 *ORDEN DE TRABAJO*
━━━━━━━━━━━━━━━━━━━━

📋 *Orden:* ${data.order_number}
👤 *Cliente:* ${data.customer_name}
📱 *Equipo:* ${data.device_brand || ''} ${data.device_model || ''}
${data.device_serial ? `🔢 *Serie:* ${data.device_serial}` : ''}

${data.initial_problem ? `⚠️ *Problema:*\n${data.initial_problem}` : ''}

━━━━━━━━━━━━━━━━━━━━
🔧 SmartFixOS
      `.trim();
    } else {
      const itemsList = (data.items || []).map(item => 
        `• ${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`
      ).join('\n');

      message = `
🧾 *RECIBO DE VENTA*
━━━━━━━━━━━━━━━━━━━━

📋 *Recibo:* ${data.sale_number}
👤 *Cliente:* ${customer?.name || 'Cliente'}
📅 *Fecha:* ${format(new Date(data.created_date), 'dd/MM/yyyy HH:mm')}

*ITEMS:*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💵 *Subtotal:* $${(data.subtotal || 0).toFixed(2)}
📊 *IVU (11.5%):* $${(data.tax_amount || 0).toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
✅ *TOTAL:* $${(data.total || 0).toFixed(2)}

━━━━━━━━━━━━━━━━━━━━
🔧 SmartFixOS
Gracias por su compra
      `.trim();
    }

    openWhatsApp(phoneToUse, message);
    toast.success("✅ Abriendo WhatsApp");
    setManualPhone("");
    setShowPhoneInput(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-[#0F0F12] border-cyan-500/30 theme-light:bg-white theme-light:border-gray-200">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2 theme-light:text-gray-900">
            <MessageCircle className="w-6 h-6 text-cyan-500" />
            Enviar {type === "order" ? "Orden" : "Recibo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-4">
          {/* EMAIL */}
          <div className="space-y-2">
            <Button
              onClick={handleSendEmail}
              disabled={sending || (!customerEmail && !manualEmail)}
              className="w-full h-16 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 flex items-center gap-3 justify-start"
            >
              <Mail className="w-6 h-6" />
              <div className="text-left">
                <div className="font-bold">Enviar por Email</div>
                <div className="text-xs opacity-80">
                  {customerEmail || manualEmail || 'Sin email registrado'}
                </div>
              </div>
            </Button>

            {!customerEmail && (
              <Input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="Ingresa email manualmente..."
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            )}
          </div>

          {/* WHATSAPP */}
          <div className="space-y-2">
            <Button
              onClick={handleSendWhatsApp}
              disabled={!customerPhone && !manualPhone}
              className="w-full h-16 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 flex items-center gap-3 justify-start"
            >
              <MessageCircle className="w-6 h-6" />
              <div className="text-left">
                <div className="font-bold">Enviar por WhatsApp</div>
                <div className="text-xs opacity-80">
                  {customerPhone || manualPhone || 'Sin teléfono registrado'}
                </div>
              </div>
            </Button>

            {!customerPhone && (
              <Input
                type="tel"
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                placeholder="Ingresa teléfono manualmente..."
                className="bg-black/40 border-white/15 text-white theme-light:bg-white theme-light:border-gray-300 theme-light:text-gray-900"
              />
            )}
          </div>

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full border-gray-700 hover:bg-gray-800 theme-light:border-gray-300 theme-light:hover:bg-gray-100"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
