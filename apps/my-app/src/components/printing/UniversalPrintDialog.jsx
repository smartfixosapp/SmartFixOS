import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, FileText, X, Mail, MessageCircle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { openWhatsApp } from "@/components/utils/helpers";
import ThermalSaleReceipt from "./ThermalSaleReceipt";
import ThermalOrderReceipt from "./ThermalOrderReceipt";

export default function UniversalPrintDialog({
  open,
  onClose,
  type = "sale", // "sale" o "order"
  data,
  customer
}) {
  const [printerType, setPrinterType] = useState(null); // "thermal" o "standard"
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState({ email: false, whatsapp: false });
  const [sent, setSent] = useState({ email: false, whatsapp: false });
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [showManualInput, setShowManualInput] = useState(null);
  const [businessInfo, setBusinessInfo] = useState(null);

  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem("printer_type");
      if (saved) {
        setPrinterType(saved);
        setShowPreview(true);
      }
      loadBusinessInfo();
    }
  }, [open]);

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

  const selectPrinter = (type) => {
    setPrinterType(type);
    localStorage.setItem("printer_type", type);
    setShowPreview(true);
  };

  const handlePrint = () => {
    window.print();
    toast.success("✅ Imprimiendo recibo");
    setTimeout(() => onClose?.(), 1000);
  };

  const handleSendEmail = async (email) => {
    const targetEmail = email || manualEmail;

    if (!targetEmail) {
      toast.error("Ingresa un email válido");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(targetEmail)) {
      toast.error("Formato de email inválido");
      return;
    }

    setSending((prev) => ({ ...prev, email: true }));
    try {
      const customerName = customer?.name || data.customer_name || "Cliente";

      const itemsList = (type === "sale" ? data.items : data.order_items || []).map((item, idx) =>
      `<tr style="background: ${idx % 2 === 0 ? '#F9FAFB' : 'white'};">
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; color: #1F2937; font-weight: 600;">${item.name}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: center; color: #374151;">${item.quantity || item.qty || 1}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: right; color: #6B7280;">$${(item.price || 0).toFixed(2)}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: bold; color: #059669;">$${((item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}</td>
        </tr>`
      ).join('');

      const totals = type === "sale" ? {
        subtotal: data.subtotal || 0,
        tax: data.tax_amount || 0,
        total: data.total || 0,
        discount: data.discount_amount || 0
      } : (() => {
        const items = data.order_items || [];
        const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || item.quantity || 1), 0);
        const labor = data.labor_cost || 0;
        const total = subtotal + labor;
        const tax = total * (data.tax_rate || 0.115);
        return { subtotal, labor, total: total + tax, tax };
      })();

      const emailBody = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="margin: 0; padding: 0; background: #F3F4F6;">
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #00A8E8 0%, #10B981 50%, #A8D700 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: bold;">
                ${type === "sale" ? "🧾 Recibo de Venta" : "🔧 Orden de Reparación"}
              </h1>
            </div>
            
            <div style="padding: 40px 30px; background: white;">
              <div style="background: #F9FAFB; border-left: 4px solid #00A8E8; padding: 20px; margin-bottom: 30px; border-radius: 8px;">
                <p style="margin: 0; color: #6B7280; font-size: 12px;">NÚMERO</p>
                <p style="margin: 4px 0 0 0; color: #111827; font-size: 20px; font-weight: bold;">
                  ${type === "sale" ? data.sale_number : data.order_number}
                </p>
                <p style="margin: 8px 0 0 0; color: #6B7280; font-size: 14px;">${format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                ${customer?.name || data.customer_name ? `
                <div style="border-top: 1px solid #E5E7EB; padding-top: 12px; margin-top: 12px;">
                  <p style="margin: 0; color: #111827; font-weight: bold;">${customer?.name || data.customer_name}</p>
                  ${customer?.phone || data.customer_phone ? `<p style="margin: 4px 0 0 0; color: #374151;">📞 ${customer?.phone || data.customer_phone}</p>` : ''}
                </div>
                ` : ''}
              </div>

              <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <thead>
                  <tr style="background: #374151;">
                    <th style="padding: 12px; text-align: left; color: white;">Artículo</th>
                    <th style="padding: 12px; text-align: center; color: white;">Cant.</th>
                    <th style="padding: 12px; text-align: right; color: white;">Precio</th>
                    <th style="padding: 12px; text-align: right; color: white;">Total</th>
                  </tr>
                </thead>
                <tbody>${itemsList}</tbody>
              </table>

              <div style="background: #F0FDF4; border: 2px solid #10B981; border-radius: 12px; padding: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Subtotal</span>
                  <span style="font-weight: bold;">$${totals.subtotal.toFixed(2)}</span>
                </div>
                ${totals.labor > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>Mano de Obra</span>
                  <span style="font-weight: bold;">$${totals.labor.toFixed(2)}</span>
                </div>` : ''}
                ${totals.discount > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #059669;">
                  <span>Descuento</span>
                  <span style="font-weight: bold;">-$${totals.discount.toFixed(2)}</span>
                </div>` : ''}
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span>IVU (11.5%)</span>
                  <span style="font-weight: bold;">$${totals.tax.toFixed(2)}</span>
                </div>
                <div style="border-top: 3px solid #10B981; padding-top: 12px; margin-top: 12px; display: flex; justify-content: space-between;">
                  <span style="font-size: 20px; font-weight: bold; color: #059669;">TOTAL</span>
                  <span style="font-size: 28px; font-weight: bold; color: #059669;">$${totals.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div style="background: #F9FAFB; padding: 30px; text-align: center; border-top: 3px solid #E5E7EB;">
              <p style="margin: 0; color: #111827; font-weight: bold;">✨ SmartFixOS</p>
              <p style="margin: 8px 0 0 0; color: #9CA3AF; font-size: 11px;">
                ${format(new Date(), "dd/MM/yyyy 'a las' HH:mm:ss")}
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const fromName = businessInfo?.business_name || "SmartFixOS";
      await base44.integrations.Core.SendEmail({
        from_name: fromName,
        to: targetEmail,
        subject: `${type === "sale" ? "🧾 Recibo de Venta" : "🔧 Orden de Reparación"} #${type === "sale" ? data.sale_number : data.order_number}`,
        body: emailBody
      });

      setSent((prev) => ({ ...prev, email: true }));
      setShowManualInput(null);
      setManualEmail("");
      toast.success("✅ Recibo enviado por email");
    } catch (error) {
      toast.error("Error al enviar email");
    } finally {
      setSending((prev) => ({ ...prev, email: false }));
    }
  };

  const handleSendWhatsApp = (phone) => {
    const targetPhone = phone || manualPhone;

    if (!targetPhone) {
      toast.error("Ingresa un número de teléfono");
      return;
    }

    const customerName = customer?.name || data.customer_name || "Cliente";
    const itemsList = (type === "sale" ? data.items : data.order_items || []).map((item) =>
    `• ${item.name} x${item.quantity || item.qty || 1} - $${((item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}`
    ).join('\n');

    const totals = type === "sale" ? {
      subtotal: data.subtotal || 0,
      tax: data.tax_amount || 0,
      total: data.total || 0
    } : (() => {
      const items = data.order_items || [];
      const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || item.quantity || 1), 0);
      const labor = data.labor_cost || 0;
      const total = subtotal + labor;
      const tax = total * (data.tax_rate || 0.115);
      return { subtotal, labor, total: total + tax, tax };
    })();

    const message = `
${type === "sale" ? "🧾 *RECIBO DE VENTA*" : "🔧 *ORDEN DE REPARACIÓN*"}
━━━━━━━━━━━━━━━━━━━━

📋 *${type === "sale" ? "Recibo" : "Orden"}:* ${type === "sale" ? data.sale_number : data.order_number}
👤 *Cliente:* ${customerName}
📅 *Fecha:* ${format(new Date(), 'dd/MM/yyyy HH:mm')}
${type === "order" && data.device_brand ? `🔧 *Equipo:* ${data.device_brand} ${data.device_model || ''}` : ''}

*ITEMS:*
${itemsList}

━━━━━━━━━━━━━━━━━━━━
💵 *Subtotal:* $${totals.subtotal.toFixed(2)}
${totals.labor > 0 ? `🔧 *Mano de Obra:* $${totals.labor.toFixed(2)}\n` : ''}📊 *IVU (11.5%):* $${totals.tax.toFixed(2)}
━━━━━━━━━━━━━━━━━━━━
✅ *TOTAL:* $${totals.total.toFixed(2)}
${type === "order" ? `\n💰 *Pagado:* $${(data.amount_paid || 0).toFixed(2)}\n⚠️ *Balance:* $${(data.balance_due || 0).toFixed(2)}` : ''}

━━━━━━━━━━━━━━━━━━━━
🔧 *SmartFixOS*
Gracias por su confianza
    `.trim();

    openWhatsApp(targetPhone, message);
    setSent((prev) => ({ ...prev, whatsapp: true }));
    setShowManualInput(null);
    setManualPhone("");
    toast.success("✅ Abriendo WhatsApp");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md">
      <div className="h-full overflow-y-auto p-4">
        <div className="min-h-full flex items-center justify-center">
          <div className="w-full max-w-4xl bg-[#0F0F12] border-2 border-cyan-500/30 rounded-2xl shadow-[0_24px_80px_rgba(0,168,232,0.6)]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-cyan-500/20">
              <h2 className="text-2xl font-black text-white flex items-center gap-3">
                <Printer className="w-7 h-7 text-cyan-400" />
                Imprimir Recibo
              </h2>
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="text-gray-400 hover:text-white">

                <X className="w-6 h-6" />
              </Button>
            </div>

            {!showPreview ?
            // Selector de impresora
            <div className="p-8">
                <p className="text-gray-300 text-center mb-8 text-lg">
                  Selecciona el tipo de impresora
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                  onClick={() => selectPrinter("thermal")}
                  className="group relative overflow-hidden bg-gradient-to-br from-orange-600/20 to-amber-600/20 border-2 border-orange-500/40 hover:border-orange-400/70 rounded-2xl p-8 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_40px_rgba(249,115,22,0.3)]">

                    <div className="text-center">
                      <div className="text-6xl mb-4">🧾</div>
                      <h3 className="text-white font-black text-2xl mb-2">Impresora Térmica</h3>
                      <p className="text-gray-400 text-sm">
                        Recibo compacto 58mm/80mm
                      </p>
                    </div>
                  </button>

                  <button
                  onClick={() => selectPrinter("standard")}
                  className="group relative overflow-hidden bg-gradient-to-br from-blue-600/20 to-cyan-600/20 border-2 border-blue-500/40 hover:border-blue-400/70 rounded-2xl p-8 transition-all hover:scale-105 active:scale-95 shadow-[0_12px_40px_rgba(37,99,235,0.3)]">

                    <div className="text-center">
                      <div className="text-6xl mb-4">📄</div>
                      <h3 className="text-white font-black text-2xl mb-2">Impresora Normal</h3>
                      <p className="text-gray-400 text-sm">
                        Recibo formato A4 / Carta
                      </p>
                    </div>
                  </button>
                </div>
              </div> :

            // Preview y opciones de impresión
            <div>
                <div className="p-6 bg-cyan-600/10 border-b border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                        <Printer className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-white font-bold">
                          {printerType === "thermal" ? "Impresora Térmica" : "Impresora Normal"}
                        </p>
                        <p className="text-cyan-300 text-sm">
                          {printerType === "thermal" ? "Recibo compacto" : "Formato completo"}
                        </p>
                      </div>
                    </div>
                    <Button
                    onClick={() => {
                      setShowPreview(false);
                      setPrinterType(null);
                      localStorage.removeItem("printer_type");
                    }}
                    variant="outline"
                    size="sm"
                    className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-600/20">

                      Cambiar
                    </Button>
                  </div>
                </div>

                {/* Preview del recibo */}
                <div className="p-6 max-h-[60vh] overflow-y-auto bg-gradient-to-br from-slate-900 to-black">
                  {printerType === "thermal" ?
                type === "sale" ?
                <ThermalSaleReceipt sale={data} customer={customer} /> :

                <ThermalOrderReceipt order={data} /> :


                <StandardReceipt type={type} data={data} customer={customer} />
                }
                </div>

                {/* Botones de acción */}
                <div className="p-6 border-t border-cyan-500/20 bg-black/40 space-y-3">
                  <Button
                  onClick={handlePrint}
                  className="w-full h-14 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-700 hover:to-emerald-700 shadow-[0_8px_24px_rgba(0,168,232,0.5)] font-bold text-lg">

                    <Printer className="w-6 h-6 mr-2" />
                    Imprimir
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    {showManualInput === 'email' ?
                  <div className="col-span-2 flex gap-2">
                        <Input
                      type="email"
                      value={manualEmail}
                      onChange={(e) => setManualEmail(e.target.value)}
                      placeholder="cliente@email.com"
                      className="flex-1 bg-black/40 border-white/15 text-white"
                      autoFocus />

                        <Button
                      onClick={() => handleSendEmail()}
                      disabled={sending.email || !manualEmail}
                      className="bg-blue-600 hover:bg-blue-700">

                          {sending.email ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
                        </Button>
                        <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setShowManualInput(null);
                        setManualEmail("");
                      }}
                      className="text-gray-400">

                          <X className="w-4 h-4" />
                        </Button>
                      </div> :

                  <Button
                    onClick={() => customer?.email || data.customer_email ? handleSendEmail(customer?.email || data.customer_email) : setShowManualInput('email')}
                    disabled={sending.email || sent.email}
                    className="bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-700 hover:to-blue-900 h-12">

                        {sending.email ?
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :
                    sent.email ?
                    <Check className="w-4 h-4 mr-2" /> :

                    <Mail className="w-4 h-4 mr-2" />
                    }
                        {sent.email ? "Enviado" : "Email"}
                      </Button>
                  }

                    {showManualInput === 'whatsapp' ?
                  <div className="col-span-2 flex gap-2">
                        <Input
                      type="tel"
                      value={manualPhone}
                      onChange={(e) => setManualPhone(e.target.value)}
                      placeholder="(787) 123-4567"
                      className="flex-1 bg-black/40 border-white/15 text-white"
                      autoFocus />

                        <Button
                      onClick={() => handleSendWhatsApp()}
                      disabled={!manualPhone}
                      className="bg-green-600 hover:bg-green-700">

                          Enviar
                        </Button>
                        <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setShowManualInput(null);
                        setManualPhone("");
                      }}
                      className="text-gray-400">

                          <X className="w-4 h-4" />
                        </Button>
                      </div> :

                  <Button
                    onClick={() => customer?.phone || data.customer_phone ? handleSendWhatsApp(customer?.phone || data.customer_phone) : setShowManualInput('whatsapp')}
                    disabled={sent.whatsapp}
                    className="bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 h-12">

                        {sent.whatsapp ?
                    <Check className="w-4 h-4 mr-2" /> :

                    <MessageCircle className="w-4 h-4 mr-2" />
                    }
                        {sent.whatsapp ? "Enviado" : "WhatsApp"}
                      </Button>
                  }
                  </div>

                  <Button
                  onClick={onClose}
                  variant="outline" className="bg-background text-slate-900 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-sm hover:text-accent-foreground w-full h-12 border-2 border-gray-500/30 hover:bg-gray-700">


                    Cerrar
                  </Button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          
          ${printerType === "thermal" ? `
            #thermal-receipt-root,
            #thermal-receipt-root * {
              visibility: visible !important;
            }
            
            #thermal-receipt-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 80mm !important;
            }
            
            @page {
              size: 80mm auto;
              margin: 0;
            }
          ` : `
            #standard-receipt-root,
            #standard-receipt-root * {
              visibility: visible !important;
            }
            
            #standard-receipt-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
            }
            
            @page {
              size: letter;
              margin: 15mm;
            }
          `}
        }
      `}</style>
    </div>);

}

// Recibo estándar formato A4
function StandardReceipt({ type, data, customer }) {
  const calculateTotal = () => {
    if (type === "sale") {
      return {
        subtotal: data.subtotal || 0,
        tax: data.tax_amount || 0,
        total: data.total || 0,
        discount: data.discount_amount || 0
      };
    } else {
      const items = data.order_items || [];
      const subtotal = items.reduce((sum, item) =>
      sum + (item.price || 0) * (item.qty || item.quantity || 1), 0
      );
      const labor = data.labor_cost || 0;
      const total = subtotal + labor;
      const tax = total * (data.tax_rate || 0.115);
      return {
        subtotal,
        labor,
        total: total + tax,
        tax
      };
    }
  };

  const totals = calculateTotal();

  return (
    <div id="standard-receipt-root" style={{
      maxWidth: '210mm',
      margin: '0 auto',
      background: 'white',
      padding: '20mm',
      fontFamily: 'Arial, sans-serif',
      color: '#000'
    }}>
      {/* Header con logo y branding */}
      <div style={{ textAlign: 'center', marginBottom: '15mm', borderBottom: '3px solid #00A8E8', paddingBottom: '10mm' }}>
        <h1 style={{ fontSize: '32pt', fontWeight: 'bold', color: '#00A8E8', margin: 0 }}>
          SmartFixOS
        </h1>
        <p style={{ fontSize: '14pt', color: '#666', margin: '5mm 0 0 0' }}>
          {type === "sale" ? "RECIBO DE VENTA" : "ORDEN DE REPARACIÓN"}
        </p>
        <p style={{ fontSize: '11pt', color: '#999', margin: '3mm 0 0 0' }}>
          {new Date(data.created_date || new Date()).toLocaleString('es-PR')}
        </p>
      </div>

      {/* Número de documento */}
      <div style={{
        background: 'linear-gradient(135deg, #00A8E8 0%, #10B981 100%)',
        padding: '8mm',
        borderRadius: '8px',
        marginBottom: '10mm',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '12pt', color: 'white', margin: '0 0 3mm 0', fontWeight: 'bold' }}>
          {type === "sale" ? "VENTA #" : "ORDEN #"}
        </p>
        <p style={{ fontSize: '24pt', fontWeight: 'bold', color: 'white', margin: 0, letterSpacing: '2px' }}>
          {type === "sale" ? data.sale_number : data.order_number || 'SIN #'}
        </p>
      </div>

      {/* Cliente */}
      {(customer || data.customer_name) &&
      <div style={{ marginBottom: '10mm', padding: '8mm', background: '#f8f9fa', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '14pt', fontWeight: 'bold', margin: '0 0 3mm 0', color: '#00A8E8' }}>
            CLIENTE
          </h3>
          <p style={{ fontSize: '12pt', margin: '2mm 0', fontWeight: 'bold' }}>
            {customer?.name || data.customer_name}
          </p>
          <p style={{ fontSize: '11pt', margin: '1mm 0', color: '#666' }}>
            📱 {customer?.phone || data.customer_phone || 'N/A'}
          </p>
          {(customer?.email || data.customer_email) &&
        <p style={{ fontSize: '11pt', margin: '1mm 0', color: '#666' }}>
              ✉️ {customer?.email || data.customer_email}
            </p>
        }
        </div>
      }

      {/* Dispositivo (solo para órdenes) */}
      {type === "order" &&
      <div style={{ marginBottom: '10mm', padding: '8mm', background: '#f8f9fa', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '14pt', fontWeight: 'bold', margin: '0 0 3mm 0', color: '#10B981' }}>
            EQUIPO
          </h3>
          <p style={{ fontSize: '12pt', margin: '2mm 0', fontWeight: 'bold' }}>
            {data.device_brand} {data.device_model}
          </p>
          {data.device_serial &&
        <p style={{ fontSize: '10pt', margin: '1mm 0', color: '#666' }}>
              S/N: {data.device_serial}
            </p>
        }
          {data.initial_problem &&
        <div style={{ marginTop: '3mm' }}>
              <p style={{ fontSize: '10pt', fontWeight: 'bold', margin: '0 0 2mm 0' }}>
                Problema reportado:
              </p>
              <p style={{ fontSize: '10pt', color: '#666', whiteSpace: 'pre-wrap' }}>
                {data.initial_problem}
              </p>
            </div>
        }
        </div>
      }

      {/* Items */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '10mm',
        fontSize: '11pt'
      }}>
        <thead>
          <tr style={{ background: '#00A8E8', color: 'white' }}>
            <th style={{ padding: '3mm', textAlign: 'left', borderBottom: '2px solid #0891B2' }}>
              Artículo
            </th>
            <th style={{ padding: '3mm', textAlign: 'center', borderBottom: '2px solid #0891B2' }}>
              Cant.
            </th>
            <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '2px solid #0891B2' }}>
              Precio
            </th>
            <th style={{ padding: '3mm', textAlign: 'right', borderBottom: '2px solid #0891B2' }}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {(type === "sale" ? data.items : data.order_items || []).map((item, idx) =>
          <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '3mm' }}>{item.name}</td>
              <td style={{ padding: '3mm', textAlign: 'center' }}>
                {item.quantity || item.qty || 1}
              </td>
              <td style={{ padding: '3mm', textAlign: 'right' }}>
                ${(item.price || 0).toFixed(2)}
              </td>
              <td style={{ padding: '3mm', textAlign: 'right', fontWeight: 'bold' }}>
                ${((item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Totales */}
      <div style={{ marginLeft: 'auto', width: '60%', marginBottom: '10mm' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontSize: '12pt' }}>
          <span>Subtotal:</span>
          <span>${totals.subtotal.toFixed(2)}</span>
        </div>
        {totals.labor > 0 &&
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontSize: '12pt' }}>
            <span>Mano de Obra:</span>
            <span>${totals.labor.toFixed(2)}</span>
          </div>
        }
        {totals.discount > 0 &&
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontSize: '12pt', color: '#059669' }}>
            <span>Descuento:</span>
            <span>-${totals.discount.toFixed(2)}</span>
          </div>
        }
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2mm 0', fontSize: '12pt' }}>
          <span>IVU (11.5%):</span>
          <span>${totals.tax.toFixed(2)}</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4mm 0',
          borderTop: '3px solid #00A8E8',
          fontSize: '16pt',
          fontWeight: 'bold'
        }}>
          <span>TOTAL:</span>
          <span style={{ color: '#00A8E8' }}>${totals.total.toFixed(2)}</span>
        </div>
      </div>

      {/* Info de pago */}
      {type === "sale" &&
      <div style={{
        background: '#10B981',
        color: 'white',
        padding: '6mm',
        borderRadius: '6px',
        marginBottom: '10mm'
      }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12pt', fontWeight: 'bold' }}>
            <span>Método de Pago:</span>
            <span>
              {data.payment_method === 'cash' ? '💵 Efectivo' :
            data.payment_method === 'card' ? '💳 Tarjeta' :
            data.payment_method === 'ath_movil' ? '📱 ATH Móvil' :
            data.payment_method}
            </span>
          </div>
          {data.payment_details?.change_given > 0 &&
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt', marginTop: '2mm' }}>
              <span>Cambio:</span>
              <span>${data.payment_details.change_given.toFixed(2)}</span>
            </div>
        }
        </div>
      }

      {/* Estado de orden */}
      {type === "order" &&
      <div style={{ marginBottom: '10mm', padding: '6mm', background: '#f8f9fa', borderRadius: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt', marginBottom: '2mm' }}>
            <span>Pagado:</span>
            <span style={{ fontWeight: 'bold', color: '#10B981' }}>
              ${(data.amount_paid || 0).toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12pt', fontWeight: 'bold' }}>
            <span>Balance:</span>
            <span style={{ color: '#EF4444' }}>
              ${(data.balance_due || 0).toFixed(2)}
            </span>
          </div>
        </div>
      }

      {/* Footer */}
      <div style={{
        borderTop: '2px dashed #ccc',
        paddingTop: '8mm',
        marginTop: '10mm',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '14pt', fontWeight: 'bold', color: '#00A8E8', margin: '0 0 3mm 0' }}>
          ¡Gracias por su preferencia!
        </p>
        <p style={{ fontSize: '10pt', color: '#666', margin: '2mm 0' }}>
          {type === "sale" ? `Atendido por: ${data.employee || 'Sistema'}` : `Creado por: ${data.created_by_name || ''}`}
        </p>
        <p style={{ fontSize: '9pt', color: '#999', marginTop: '5mm' }}>
          SmartFixOS - Sistema de Gestión Inteligente
        </p>
      </div>
    </div>);

}
