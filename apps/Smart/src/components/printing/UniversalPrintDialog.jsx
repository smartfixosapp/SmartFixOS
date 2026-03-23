import React, { useState, useEffect } from "react";
import { Printer, X, Mail, MessageCircle, Check, Loader2, Download } from "lucide-react";
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
  const [sending, setSending] = useState({ email: false, whatsapp: false });
  const [sent, setSent] = useState({ email: false, whatsapp: false });
  const [manualEmail, setManualEmail] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [businessInfo, setBusinessInfo] = useState(null);
  const [logo, setLogo] = useState("");

  useEffect(() => {
    if (open) {
      loadBusinessInfo();
      loadLogo();
      const phone = customer?.phone || data?.customer_phone || "";
      const email = customer?.email || data?.customer_email || "";
      if (phone) setManualPhone(phone);
      if (email) setManualEmail(email);
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

  const loadLogo = async () => {
    try {
      const configs = await base44.entities.AppSettings.filter({ slug: "app-branding" });
      if (configs?.length > 0 && configs[0].payload?.logo_url) {
        setLogo(configs[0].payload.logo_url);
      }
    } catch (error) {
      console.log("No logo configured");
    }
  };

  const handlePrint = () => {
    window.print();
    toast.success("✅ Imprimiendo recibo");
    setTimeout(() => onClose?.(), 1000);
  };

  const generateThermalPDFBlob = async () => {
    const receiptEl = document.getElementById("thermal-receipt-root");
    if (!receiptEl) throw new Error("Receipt element not found");
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(receiptEl, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const mmWidth = 80;
    const mmHeight = (canvas.height / canvas.width) * mmWidth;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [mmWidth, mmHeight],
    });
    doc.addImage(imgData, "JPEG", 0, 0, mmWidth, mmHeight);
    return doc.output("blob");
  };

  const handleGeneratePDF = async () => {
    try {
      toast.loading("Generando PDF...");
      const pdfBlob = await generateThermalPDFBlob();
      const fileName = `${type === "sale" ? "Recibo" : "Orden"}_${type === "sale" ? data.sale_number : data.order_number}.pdf`;
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      URL.revokeObjectURL(url); a.remove();
      toast.dismiss();
      toast.success("✅ PDF descargado");
    } catch (error) {
      toast.dismiss();
      toast.error("Error generando PDF");
      console.error(error);
    }
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

    setSending(prev => ({ ...prev, email: true }));
    try {
      // Generar PDF
      const pdfBlob = await generateThermalPDFBlob();
      const { file_url: pdfUrl } = await base44.integrations.Core.UploadFile({ file: pdfBlob });
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
        const subtotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || item.quantity || 1)), 0);
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

      setSent(prev => ({ ...prev, email: true }));
      setManualEmail("");
      toast.success("✅ Recibo enviado por email");
    } catch (error) {
      toast.error("Error al enviar email");
    } finally {
      setSending(prev => ({ ...prev, email: false }));
    }
  };

  const handleSendWhatsApp = async (phone) => {
    const targetPhone = phone || manualPhone;

    if (!targetPhone) {
      toast.error("Ingresa un número de teléfono");
      return;
    }

    setSending(prev => ({ ...prev, whatsapp: true }));
    try {
      toast.loading("Generando PDF para WhatsApp...");
      const pdfBlob = await generateThermalPDFBlob();
      toast.dismiss();

      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type === "sale" ? "Recibo" : "Orden"}_${type === "sale" ? data.sale_number : data.order_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();

      const message = `
${type === "sale" ? "🧾 *RECIBO DE VENTA*" : "🔧 *ORDEN DE REPARACIÓN*"}
━━━━━━━━━━━━━━━━━━━━

${businessInfo?.business_name || '911 Smart Fix'}

📋 *${type === "sale" ? "Recibo" : "Orden"}:* ${type === "sale" ? data.sale_number : data.order_number}
👤 *Cliente:* ${customer?.name || data.customer_name || "Cliente"}
📅 *Fecha:* ${format(new Date(), 'dd/MM/yyyy HH:mm')}

📄 *Tu recibo completo está adjunto en PDF*
(Por favor, adjunta el archivo PDF descargado)

━━━━━━━━━━━━━━━━━━━━
🔧 *${businessInfo?.business_name || '911 Smart Fix'}*
${businessInfo?.business_phone ? `📞 ${businessInfo.business_phone}` : ''}
Gracias por su preferencia
      `.trim();

      openWhatsApp(targetPhone, message);
      setSent(prev => ({ ...prev, whatsapp: true }));
      setManualPhone("");
      toast.success("✅ PDF descargado - Abriendo WhatsApp");
    } catch (error) {
      toast.error("Error al generar PDF");
      console.error(error);
    } finally {
      setSending(prev => ({ ...prev, whatsapp: false }));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md">
      <div className="h-full overflow-y-auto p-4">
        <div className="min-h-full flex items-center justify-center">
          <div className="w-full max-w-sm bg-[#0F0F12] border border-white/10 rounded-3xl shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center">
                  <Printer className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-black text-sm">
                    {type === "sale" ? "Recibo de Venta" : "Recibo de Orden"}
                  </h2>
                  <p className="text-white/40 text-[11px]">
                    #{type === "sale" ? data?.sale_number : data?.order_number}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Preview */}
            <div className="px-4 py-4 bg-gradient-to-b from-white/[0.02] to-transparent overflow-y-auto max-h-[50vh]">
              {type === "sale"
                ? <ThermalSaleReceipt sale={data} customer={customer} />
                : <ThermalOrderReceipt order={data} />
              }
            </div>

            {/* Actions */}
            <div className="px-4 pb-5 pt-3 border-t border-white/[0.06] space-y-2">

              {/* Print */}
              <button
                onClick={handlePrint}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-black text-sm shadow-[0_4px_20px_rgba(6,182,212,0.3)] active:scale-[0.98] transition-all"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>

              {/* WhatsApp */}
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
                    <input
                      type="tel"
                      placeholder="Número WhatsApp"
                      value={manualPhone}
                      onChange={e => setManualPhone(e.target.value)}
                      className="w-full pl-9 pr-3 h-11 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>
                  <button
                    onClick={() => handleSendWhatsApp(manualPhone)}
                    disabled={sending.whatsapp || !manualPhone}
                    className="h-11 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-sm flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    {sending.whatsapp
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : sent.whatsapp
                        ? <Check className="w-4 h-4" />
                        : <MessageCircle className="w-4 h-4" />
                    }
                    WA
                  </button>
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400" />
                    <input
                      type="email"
                      placeholder="Email del cliente"
                      value={manualEmail}
                      onChange={e => setManualEmail(e.target.value)}
                      className="w-full pl-9 pr-3 h-11 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                  <button
                    onClick={() => handleSendEmail(manualEmail)}
                    disabled={sending.email || !manualEmail}
                    className="h-11 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    {sending.email
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : sent.email
                        ? <Check className="w-4 h-4" />
                        : <Mail className="w-4 h-4" />
                    }
                    Email
                  </button>
                </div>
              </div>

              {/* Download PDF */}
              <button
                onClick={handleGeneratePDF}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 text-white/60 font-bold text-sm hover:bg-white/10 transition-all active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                Descargar PDF
              </button>

            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #thermal-receipt-root, #thermal-receipt-root * { visibility: visible !important; }
          #thermal-receipt-root {
            position: absolute !important; left: 0 !important; top: 0 !important;
            width: 80mm !important;
          }
          @page { size: 80mm auto; margin: 0; }
        }
      `}</style>
    </div>
  );
}
