import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { Check, Mail, MessageCircle, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { openWhatsApp } from "@/components/utils/helpers";

export default function ReceiptModal({ open, onClose, saleData, customer }) {
  const [sending, setSending] = useState({ email: false, whatsapp: false });
  const [sent, setSent] = useState({ email: false, whatsapp: false });
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [showManualInput, setShowManualInput] = useState(null);
  const [businessInfo, setBusinessInfo] = useState(null);

  React.useEffect(() => {
    loadBusinessInfo();
  }, []);

  const loadBusinessInfo = async () => {
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "app-main-settings" });
      if (configs?.length) {
        setBusinessInfo(configs[0].payload);
      }
    } catch (error) {
      console.log("Using default business info");
    }
  };

  const handleSendEmail = async (email) => {
    const targetEmail = email || manualEmail;
    
    console.log("[ReceiptEmail] Iniciando envío de recibo por email");
    console.log("[ReceiptEmail] Email destino:", targetEmail);
    
    if (!targetEmail) {
      toast.error("Ingresa un email válido");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      toast.error("Formato de email inválido");
      return;
    }

    setSending(prev => ({ ...prev, email: true }));
    try {
      const customerName = customer?.name || "Cliente";

      const itemsList = saleData.items.map((item, idx) => 
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
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                alt="SmartFixOS"
                style="height: 80px; width: auto; margin: 0 auto 16px auto; display: block; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.2));"
              />
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                🧾 Recibo de Venta
              </h1>
              <p style="color: rgba(255,255,255,0.95); margin: 8px 0 0 0; font-size: 14px;">
                Gracias por tu compra
              </p>
            </div>
            
            <div style="padding: 40px 30px; background: white;">
              
              <div style="background: #F9FAFB; border-left: 4px solid #00A8E8; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 15px;">
                  <div>
                    <p style="margin: 0; color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">RECIBO</p>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 20px; font-weight: bold;">${saleData.sale_number}</p>
                  </div>
                  <div>
                    <p style="margin: 0; color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">FECHA</p>
                    <p style="margin: 4px 0 0 0; color: #111827; font-size: 16px; font-weight: 600;">${format(new Date(), 'dd/MM/yyyy')}</p>
                    <p style="margin: 2px 0 0 0; color: #6B7280; font-size: 14px;">${format(new Date(), 'HH:mm')}</p>
                  </div>
                </div>

                ${customer ? `
                <div style="border-top: 1px solid #E5E7EB; padding-top: 15px;">
                  <p style="margin: 0; color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">CLIENTE</p>
                  <p style="margin: 4px 0 0 0; color: #111827; font-size: 18px; font-weight: bold;">${customer.name}</p>
                  ${customer.phone ? `<p style="margin: 4px 0 0 0; color: #374151; font-size: 14px;">📞 ${customer.phone}</p>` : ''}
                  ${customer.email ? `<p style="margin: 4px 0 0 0; color: #374151; font-size: 14px;">✉️ ${customer.email}</p>` : ''}
                </div>
                ` : ''}
              </div>

              <div style="margin-bottom: 30px;">
                <h3 style="color: #111827; font-size: 18px; font-weight: bold; margin: 0 0 15px 0;">
                  📦 Detalles de la Compra
                </h3>
                
                <table style="width: 100%; border-collapse: collapse; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background: linear-gradient(135deg, #374151 0%, #1F2937 100%);">
                      <th style="padding: 14px 12px; text-align: left; color: white; font-size: 13px; font-weight: 600;">Descripción</th>
                      <th style="padding: 14px 12px; text-align: center; color: white; font-size: 13px; font-weight: 600;">Cant.</th>
                      <th style="padding: 14px 12px; text-align: right; color: white; font-size: 13px; font-weight: 600;">Precio</th>
                      <th style="padding: 14px 12px; text-align: right; color: white; font-size: 13px; font-weight: 600;">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsList}
                  </tbody>
                </table>
              </div>

              <div style="background: linear-gradient(135deg, #F0FDF4 0%, #ECFDF5 100%); border: 2px solid #10B981; border-radius: 12px; padding: 25px; margin-top: 30px;">
                <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #374151; font-size: 15px; font-weight: 600;">Subtotal</span>
                  <span style="color: #1F2937; font-size: 18px; font-weight: bold;">$${saleData.subtotal.toFixed(2)}</span>
                </div>
                
                ${saleData.discount_amount > 0 ? `
                <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #FEF3C7; border-radius: 6px;">
                  <span style="color: #92400E; font-size: 14px; font-weight: 600;">🎁 Descuento</span>
                  <span style="color: #92400E; font-size: 16px; font-weight: bold;">-$${saleData.discount_amount.toFixed(2)}</span>
                </div>
                ` : ''}
                
                <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #374151; font-size: 15px; font-weight: 600;">IVU (11.5%)</span>
                  <span style="color: #1F2937; font-size: 18px; font-weight: bold;">$${saleData.tax_amount.toFixed(2)}</span>
                </div>
                
                <div style="border-top: 3px solid #10B981; padding-top: 15px; margin-top: 15px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #059669; font-size: 22px; font-weight: 900;">TOTAL PAGADO</span>
                  <span style="color: #059669; font-size: 36px; font-weight: 900;">$${saleData.total.toFixed(2)}</span>
                </div>
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #D1FAE5; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color: #374151; font-size: 14px; font-weight: 600;">💳 Método de Pago</span>
                  <span style="display: inline-block; padding: 8px 16px; background: ${
                    saleData.payment_method === 'cash' ? '#10B981' : 
                    saleData.payment_method === 'card' ? '#3B82F6' : 
                    saleData.payment_method === 'ath_movil' ? '#F59E0B' : 
                    saleData.payment_method === 'bank_transfer' ? '#8B5CF6' : '#6B7280'
                  }; color: white; border-radius: 8px; font-weight: bold; font-size: 14px; text-transform: uppercase;">
                    ${saleData.payment_method === "cash" ? "💵 Efectivo" : 
                      saleData.payment_method === "card" ? "💳 Tarjeta" : 
                      saleData.payment_method === "ath_movil" ? "📱 ATH Móvil" : 
                      saleData.payment_method === "bank_transfer" ? "🏦 Transferencia" :
                      saleData.payment_method === "check" ? "📄 Cheque" :
                      saleData.payment_method}
                  </span>
                </div>
                
                ${saleData.payment_details?.change_given > 0 ? `
                <div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #EFF6FF; border-radius: 6px;">
                  <span style="color: #1E40AF; font-size: 14px; font-weight: 600;">💰 Cambio Devuelto</span>
                  <span style="color: #1E40AF; font-size: 18px; font-weight: bold;">$${saleData.payment_details.change_given.toFixed(2)}</span>
                </div>
                ` : ''}
              </div>

              ${saleData.workOrder ? `
              <div style="background: #DBEAFE; border-left: 4px solid #3B82F6; padding: 20px; margin-top: 30px; border-radius: 8px;">
                <h3 style="color: #1E40AF; font-size: 16px; font-weight: bold; margin: 0 0 12px 0;">
                  🔧 Orden de Trabajo: ${saleData.workOrder.order_number}
                </h3>
                <div style="display: grid; gap: 8px;">
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #374151; font-size: 14px;">Equipo:</span>
                    <span style="color: #1F2937; font-weight: 600; font-size: 14px;">${saleData.workOrder.device_brand} ${saleData.workOrder.device_model}</span>
                  </div>
                  ${saleData.workOrder.balance_after_this_payment > 0.01 ? `
                  <div style="display: flex; justify-content: space-between; padding: 10px; background: #FEF3C7; border-radius: 6px; margin-top: 8px;">
                    <span style="color: #92400E; font-size: 14px; font-weight: 600;">⚠️ Balance Pendiente</span>
                    <span style="color: #92400E; font-size: 16px; font-weight: bold;">$${saleData.workOrder.balance_after_this_payment.toFixed(2)}</span>
                  </div>
                  ` : `
                  <div style="padding: 10px; background: #D1FAE5; border-radius: 6px; text-align: center; margin-top: 8px;">
                    <span style="color: #065F46; font-size: 14px; font-weight: bold;">✅ ORDEN COMPLETAMENTE PAGADA</span>
                  </div>
                  `}
                </div>
              </div>
              ` : ''}

              ${saleData.points_earned > 0 ? `
              <div style="background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); border: 2px solid #F59E0B; padding: 20px; margin-top: 30px; border-radius: 12px; text-align: center;">
                <p style="margin: 0; color: #92400E; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                  ⭐ Puntos Ganados
                </p>
                <p style="margin: 8px 0 0 0; color: #B45309; font-size: 42px; font-weight: 900;">
                  +${saleData.points_earned}
                </p>
                <p style="margin: 4px 0 0 0; color: #78350F; font-size: 13px;">
                  Sigue acumulando para obtener descuentos
                </p>
              </div>
              ` : ''}
            </div>

            <div style="background: #F9FAFB; padding: 30px; text-align: center; border-top: 3px solid #E5E7EB;">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                alt="SmartFixOS"
                style="height: 60px; width: auto; margin: 0 auto 16px auto; display: block;"
              />
              <p style="margin: 0 0 8px 0; color: #111827; font-size: 16px; font-weight: bold;">
                ✨ SmartFixOS
              </p>
              <p style="margin: 0 0 4px 0; color: #6B7280; font-size: 13px;">
                Tu taller de reparación de confianza
              </p>
              <p style="margin: 12px 0 0 0; color: #9CA3AF; font-size: 11px;">
                Este recibo fue generado automáticamente el ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm:ss")}
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      console.log("[ReceiptEmail] Enviando email...");

      const fromName = businessInfo?.business_name || "SmartFixOS";

      const result = await base44.integrations.Core.SendEmail({
        from_name: fromName,
        to: targetEmail,
        subject: `🧾 Recibo de Venta #${saleData.sale_number} - ${fromName}`,
        body: emailBody
      });

      console.log("[ReceiptEmail] ✅ Resultado:", result);

      setSent(prev => ({ ...prev, email: true }));
      setShowManualInput(null);
      setManualEmail("");
      toast.success("✅ Recibo enviado por email");
    } catch (error) {
      console.error("[ReceiptEmail] ❌ ERROR:", error);
      toast.error(`Error al enviar email: ${error.message || 'Error desconocido'}`);
    } finally {
      setSending(prev => ({ ...prev, email: false }));
    }
  };

  const handleSendWhatsApp = (phone) => {
    const targetPhone = phone || manualPhone;
    
    if (!targetPhone) {
      toast.error("Ingresa un número de teléfono");
      return;
    }

    const customerName = customer?.name || "Cliente";

    const itemsList = saleData.items.map(item => 
      `• ${item.name} x${item.quantity} - $${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');

    const message = `
🧾 *RECIBO DE VENTA*
━━━━━━━━━━━━━━━━━━━━

📋 *Recibo:* ${saleData.sale_number}
👤 *Cliente:* ${customerName}
📅 *Fecha:* ${format(new Date(), 'dd/MM/yyyy HH:mm')}

*ITEMS:*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💵 *Subtotal:* $${saleData.subtotal.toFixed(2)}
📊 *IVU (11.5%):* $${saleData.tax_amount.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
✅ *TOTAL:* $${saleData.total.toFixed(2)}

💳 *Método de pago:* ${
  saleData.payment_method === "cash" ? "Efectivo" : 
  saleData.payment_method === "card" ? "Tarjeta" : 
  saleData.payment_method === "ath_movil" ? "ATH Móvil" : 
  saleData.payment_method
}${saleData.payment_details?.change_given > 0 ? 
  `\n💰 *Cambio:* $${saleData.payment_details.change_given.toFixed(2)}` : ''}

━━━━━━━━━━━━━━━━━━━━
🔧 *SmartFixOS*
Gracias por su compra
    `.trim();

    openWhatsApp(targetPhone, message);
    setSent(prev => ({ ...prev, whatsapp: true }));
    setShowManualInput(null);
    setManualPhone("");
    toast.success("✅ Abriendo WhatsApp");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md w-[95vw] max-h-[90vh] bg-gradient-to-br from-[#2B2B2B] to-black border-red-600/30 overflow-hidden flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 pb-2 px-4 pt-4">
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <Check className="w-5 h-5 text-green-500" />
            ¡Venta Procesada!
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-3">
            <div className="text-center pb-3 border-b border-white/10">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                alt="SmartFixOS"
                className="h-20 w-auto mx-auto mb-2 object-contain"
              />
              <p className="text-xs text-gray-400">Recibo de Venta</p>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-gray-500 uppercase">Recibo</p>
                <p className="text-sm font-bold text-white">{saleData.sale_number}</p>
              </div>

              {customer && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Cliente</p>
                  <p className="text-sm text-white font-semibold">{customer.name}</p>
                  {customer.phone && <p className="text-xs text-gray-400">{customer.phone}</p>}
                  {customer.email && <p className="text-xs text-gray-400">{customer.email}</p>}
                </div>
              )}

              <div>
                <p className="text-[10px] text-gray-500 uppercase">Fecha</p>
                <p className="text-xs text-white">{format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3">
              <p className="text-xs font-semibold text-gray-400 mb-2">ITEMS</p>
              <div className="space-y-1.5">
                {saleData.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="text-white truncate">{item.name}</p>
                      <p className="text-gray-500 text-[10px]">${item.price.toFixed(2)} × {item.quantity}</p>
                    </div>
                    <p className="text-white font-semibold ml-2">${(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 space-y-1.5">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Subtotal</span>
                <span className="text-white">${saleData.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>IVU ({((saleData.tax_rate || 0.115) * 100).toFixed(1)}%)</span>
                <span className="text-white">${saleData.tax_amount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <span className="text-base font-bold text-white">TOTAL</span>
                <span className="text-2xl font-bold text-emerald-400">${saleData.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Método de pago</span>
                <span className="text-white capitalize">
                  {saleData.payment_method === "cash" ? "Efectivo" : 
                   saleData.payment_method === "card" ? "Tarjeta" : 
                   saleData.payment_method === "ath_movil" ? "ATH Móvil" : 
                   saleData.payment_method}
                </span>
              </div>
              {saleData.payment_details?.change_given > 0 && (
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Cambio</span>
                  <span className="text-white">${saleData.payment_details.change_given.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-white font-semibold text-center text-sm">¿Enviar recibo al cliente?</p>
            
            {showManualInput === 'email' ? (
              <div className="space-y-2">
                <Label className="text-gray-300 text-xs">Email del cliente</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className="flex-1 bg-black/40 border-white/15 text-white h-9 text-sm"
                    autoFocus
                  />
                  <Button
                    onClick={() => handleSendEmail()}
                    disabled={sending.email || !manualEmail}
                    className="bg-blue-600 hover:bg-blue-700 h-9 px-3"
                  >
                    {sending.email ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowManualInput(null);
                      setManualEmail("");
                    }}
                    className="text-gray-400 h-9 px-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => customer?.email ? handleSendEmail(customer.email) : setShowManualInput('email')}
                disabled={sending.email || sent.email}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 h-11"
              >
                {sending.email ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : sent.email ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Email Enviado
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    {customer?.email ? "Enviar por Email" : "Ingresar Email y Enviar"}
                  </>
                )}
              </Button>
            )}

            {showManualInput === 'whatsapp' ? (
              <div className="space-y-2">
                <Label className="text-gray-300 text-xs">Teléfono del cliente</Label>
                <div className="flex gap-2">
                  <Input
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="(787) 123-4567"
                    className="flex-1 bg-black/40 border-white/15 text-white h-9 text-sm"
                    autoFocus
                  />
                  <Button
                    onClick={() => handleSendWhatsApp()}
                    disabled={!manualPhone}
                    className="bg-green-600 hover:bg-green-700 h-9 px-3"
                  >
                    Enviar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowManualInput(null);
                      setManualPhone("");
                    }}
                    className="text-gray-400 h-9 px-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                onClick={() => customer?.phone ? handleSendWhatsApp(customer.phone) : setShowManualInput('whatsapp')}
                disabled={sent.whatsapp}
                className="w-full bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 h-11"
              >
                {sent.whatsapp ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    WhatsApp Abierto
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    {customer?.phone ? "Enviar por WhatsApp" : "Ingresar Teléfono y Enviar"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 flex gap-2 p-4 border-t border-white/10 bg-black/20">
          <Button
            onClick={onClose}
            className="flex-1 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 h-10"
          >
            <X className="w-4 h-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
