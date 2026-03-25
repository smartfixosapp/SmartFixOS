import React, { useState, useEffect } from "react";
import { Printer, X, Mail, MessageCircle, Check, Loader2 } from "lucide-react";
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
      const docNumber = type === "sale" ? data.sale_number : data.order_number;

      const itemsList = (type === "sale" ? data.items : data.order_items || []).map((item) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.9);font-weight:600;font-size:14px;">${item.name}</td>
          <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:center;color:rgba(255,255,255,0.5);font-size:13px;">${item.quantity || item.qty || 1}</td>
          <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;color:#34d399;font-weight:700;font-size:14px;">$${((item.price || 0) * (item.quantity || item.qty || 1)).toFixed(2)}</td>
        </tr>`
      ).join('');

      const totals = type === "sale" ? {
        subtotal: data.subtotal || 0,
        tax: data.tax_amount || 0,
        total: data.total || 0,
        discount: data.discount_amount || 0,
        labor: 0
      } : (() => {
        const items = data.order_items || [];
        const subtotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || item.quantity || 1)), 0);
        const labor = data.labor_cost || 0;
        const total = subtotal + labor;
        const tax = total * (data.tax_rate || 0.115);
        return { subtotal, labor, total: total + tax, tax, discount: 0 };
      })();

      const posConfig = (() => { try { return JSON.parse(localStorage.getItem("pos_receipt_config") || "{}"); } catch { return {}; } })();
      const fromName = posConfig.email_from_name || businessInfo?.business_name || "SmartFixOS";
      const subjectTemplate = type === "sale"
        ? (posConfig.email_subject_sale || "🧾 Tu recibo de venta #{number}")
        : (posConfig.email_subject_order || "🔧 Tu orden de reparación #{number}");
      const subject = subjectTemplate.replace("#{number}", docNumber);

      const emailBody = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0F0F12;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:20px 16px;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0891b2 0%,#059669 60%,#65a30d 100%);border-radius:20px 20px 0 0;padding:36px 32px;text-align:center;">
      ${logo ? `<img src="${logo}" alt="Logo" style="max-height:50px;max-width:160px;margin:0 auto 16px;display:block;filter:brightness(0) invert(1);" onerror="this.style.display='none'" />` : ''}
      <h1 style="margin:0;color:white;font-size:22px;font-weight:800;letter-spacing:-0.3px;">
        ${type === "sale" ? "🧾 Recibo de Venta" : "🔧 Orden de Reparación"}
      </h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">${fromName}</p>
    </div>

    <!-- Body -->
    <div style="background:#1a1a2e;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);padding:28px 32px;">

      <!-- Order info card -->
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-left:4px solid #0891b2;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
        <div style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;">NÚMERO DE ${type === "sale" ? "RECIBO" : "ORDEN"}</div>
        <div style="color:white;font-size:22px;font-weight:800;margin:4px 0 8px;">${docNumber}</div>
        <div style="color:rgba(255,255,255,0.5);font-size:13px;">📅 ${format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
        ${customerName ? `
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;margin-top:12px;">
          <div style="color:white;font-weight:700;font-size:15px;">👤 ${customerName}</div>
          ${customer?.phone || data.customer_phone ? `<div style="color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px;">📞 ${customer?.phone || data.customer_phone}</div>` : ''}
        </div>` : ''}
      </div>

      <!-- Items -->
      <div style="margin-bottom:20px;">
        <div style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">ARTÍCULOS</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:rgba(255,255,255,0.05);">
              <th style="padding:10px 12px;text-align:left;color:rgba(255,255,255,0.5);font-size:11px;font-weight:600;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Artículo</th>
              <th style="padding:10px 8px;text-align:center;color:rgba(255,255,255,0.5);font-size:11px;font-weight:600;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Cant.</th>
              <th style="padding:10px 12px;text-align:right;color:rgba(255,255,255,0.5);font-size:11px;font-weight:600;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsList}
          </tbody>
        </table>
      </div>

      <!-- Totals -->
      <div style="background:rgba(5,150,105,0.1);border:1px solid rgba(5,150,105,0.3);border-radius:12px;padding:18px 20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:rgba(255,255,255,0.6);font-size:14px;">
          <span>Subtotal</span><span>$${totals.subtotal.toFixed(2)}</span>
        </div>
        ${totals.labor > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;color:rgba(255,255,255,0.6);font-size:14px;"><span>Mano de Obra</span><span>$${totals.labor.toFixed(2)}</span></div>` : ''}
        ${totals.discount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#34d399;font-size:14px;"><span>Descuento</span><span>-$${totals.discount.toFixed(2)}</span></div>` : ''}
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;color:rgba(255,255,255,0.6);font-size:14px;">
          <span>IVU (11.5%)</span><span>$${totals.tax.toFixed(2)}</span>
        </div>
        <div style="border-top:2px solid rgba(5,150,105,0.5);padding-top:12px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:white;font-size:18px;font-weight:800;">TOTAL</span>
          <span style="color:#34d399;font-size:28px;font-weight:800;">$${totals.total.toFixed(2)}</span>
        </div>
        ${type === "sale" && data.payment_method ? `
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;margin-top:10px;display:flex;justify-content:space-between;color:rgba(255,255,255,0.5);font-size:13px;">
          <span>Método de pago</span>
          <span style="color:rgba(255,255,255,0.8);font-weight:600;">${data.payment_method === 'cash' ? '💵 Efectivo' : data.payment_method === 'card' ? '💳 Tarjeta' : data.payment_method === 'ath_movil' ? '📱 ATH Móvil' : data.payment_method}</span>
        </div>` : ''}
      </div>

    </div>

    <!-- Footer -->
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 20px 20px;padding:24px 32px;text-align:center;">
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.6);font-size:14px;font-weight:600;">${fromName}</p>
      ${businessInfo?.business_phone ? `<p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:12px;">📞 ${businessInfo.business_phone}</p>` : ''}
      <p style="margin:12px 0 0;color:rgba(255,255,255,0.25);font-size:11px;">Powered by SmartFixOS</p>
    </div>

  </div>
</body>
</html>`;

      await base44.integrations.Core.SendEmail({
        from_name: fromName,
        to: targetEmail,
        subject: subject,
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
    const toastId = toast.loading("Generando enlace del recibo...");
    try {
      const pdfBlob = await generateThermalPDFBlob();
      const docNumber = type === "sale" ? data.sale_number : data.order_number;
      const fileName = `receipts/${docNumber}_${Date.now()}.pdf`;

      // Subir PDF a Storage y obtener URL pública
      const { file_url: pdfUrl } = await base44.integrations.Core.UploadFile({
        file: pdfBlob,
        file_name: fileName,
      });

      toast.dismiss(toastId);

      const bizName = businessInfo?.business_name || '911 Smart Fix';
      const customerName = customer?.name || data.customer_name || "Cliente";
      const message = [
        `${type === "sale" ? "🧾 *Recibo de Venta*" : "🔧 *Orden de Reparación*"}`,
        `━━━━━━━━━━━━━━━━━━━━`,
        ``,
        `📋 *#${docNumber}*`,
        `👤 ${customerName}`,
        `📅 ${format(new Date(), 'dd/MM/yyyy')}`,
        ``,
        `Haz clic en el enlace para ver y descargar tu recibo:`,
        pdfUrl,
        ``,
        `━━━━━━━━━━━━━━━━━━━━`,
        `🔧 *${bizName}*`,
        businessInfo?.business_phone ? `📞 ${businessInfo.business_phone}` : null,
        `Gracias por su preferencia`,
      ].filter(Boolean).join('\n');

      openWhatsApp(targetPhone, message);
      setSent(prev => ({ ...prev, whatsapp: true }));
      setManualPhone("");
      toast.success("✅ Enlace generado — abriendo WhatsApp");
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Error al generar enlace");
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
