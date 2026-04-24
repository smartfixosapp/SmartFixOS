import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { apiUrl } from "@/lib/apiUrl";
import {
  Mail, MessageCircle, Printer, X, Send, Check,
  Loader2, ChevronRight, History, Receipt,
  FileDown, Share2, CheckCircle2
} from "lucide-react";
import { dataClient } from "@/components/api/dataClient";
import { jsPDF } from "jspdf";

const cn = (...classes) => classes.filter(Boolean).join(" ");

// ── Historial en localStorage (últimas 15 ventas) ──────────────────────────
const HISTORY_KEY = "smartfix_pos_sale_history";

export function saveSaleToHistory(entry) {
  try {
    const prev = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    const next = [entry, ...prev.filter(e => e.saleId !== entry.saleId)].slice(0, 15);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch { /* no-op */ }
}

export function getSaleHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
}

// ── Config helpers ─────────────────────────────────────────────────────────
function getConfig() {
  try { return JSON.parse(localStorage.getItem("pos_receipt_config") || "{}"); } catch { return {}; }
}

function toCurrencyNumber(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n : 0;
}

// ── PDF Receipt generator (jsPDF text-based, no html2canvas) ──────────────
async function generateReceiptPDF(sale, customer, items, biz) {
  const config = getConfig();
  // jsPDF imported statically at top of file

  const pw = 80;       // 80mm wide (thermal paper)
  const margin = 5;
  const cw = pw - margin * 2;
  const lineH = 5;

  // Pre-calc height
  let estH = 90;
  (items || []).forEach(item => {
    const label = `${item.name} x${item.quantity}`;
    estH += Math.ceil(label.length / 28) * lineH + 2;
  });
  if (config.warranty_text)   estH += 20;
  if (config.conditions_text) estH += 20;
  const pageH = Math.max(160, estH);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pw, pageH] });
  let y = 8;

  const txt = (text, opts = {}) => {
    const { size = 9, bold = false, align = "left", color = [30, 30, 30], maxW = cw } = opts;
    pdf.setFontSize(size);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setTextColor(...color);
    const x = align === "center" ? pw / 2 : align === "right" ? pw - margin : margin;
    const lines = pdf.splitTextToSize(String(text), maxW);
    lines.forEach(line => { pdf.text(line, x, y, { align }); y += lineH; });
    return lines.length;
  };

  const divider = (dashed = false) => {
    pdf.setDrawColor(180, 180, 180);
    pdf.setLineWidth(0.3);
    if (dashed) {
      for (let x = margin; x < pw - margin; x += 3)
        pdf.line(x, y, Math.min(x + 2, pw - margin), y);
    } else {
      pdf.line(margin, y, pw - margin, y);
    }
    y += 3;
  };

  const row = (label, val, bold = false) => {
    pdf.setFontSize(bold ? 11 : 9);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setTextColor(30, 30, 30);
    pdf.text(label, margin, y);
    pdf.text(val, pw - margin, y, { align: "right" });
    y += lineH;
  };

  // ── Header ──
  txt(biz?.name || "SmartFixOS", { size: 14, bold: true, align: "center" });
  if (biz?.address) txt(biz.address, { size: 7, align: "center", color: [100, 100, 100] });
  if (biz?.phone)   txt(`Tel: ${biz.phone}`, { size: 7, align: "center", color: [100, 100, 100] });
  y += 2;
  divider();

  // ── Receipt meta ──
  const num = sale?.sale_number || sale?.id?.slice(-6) || "—";
  txt(`Recibo #${num}`, { size: 12, bold: true, align: "center" });
  txt(new Date().toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" }), { size: 8, align: "center", color: [100, 100, 100] });
  const custName = customer?.name || customer?.full_name || "";
  if (custName) txt(custName, { size: 9, align: "center" });
  y += 1;
  divider(true);

  // ── Items ──
  txt("ARTÍCULOS", { size: 7, color: [140, 140, 140] });
  y += 1;
  (items || []).forEach(item => {
    const lineTotal = `$${(toCurrencyNumber(item.price) * toCurrencyNumber(item.quantity || 1)).toFixed(2)}`;
    const label = `${item.name} x${item.quantity || 1}`;
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(30, 30, 30);
    const wrapped = pdf.splitTextToSize(label, cw - 16);
    pdf.text(wrapped, margin, y);
    pdf.text(lineTotal, pw - margin, y, { align: "right" });
    y += wrapped.length * lineH;
  });
  divider(true);

  // ── Totals ──
  const sub = toCurrencyNumber(sale?.subtotal);
  const tax = toCurrencyNumber(sale?.tax_amount);
  const total = toCurrencyNumber(sale?.total_amount || sale?.total);
  if (sub > 0) row("Subtotal", `$${sub.toFixed(2)}`);
  if (tax > 0) row("IVU (11.5%)", `$${tax.toFixed(2)}`);
  y += 1;
  divider();
  row("TOTAL", `$${total.toFixed(2)}`, true);
  y += 1;

  const payLabel = { cash: "Efectivo", card: "Tarjeta", ath_movil: "ATH Móvil" }[sale?.payment_method] || sale?.payment_method || "";
  if (payLabel) txt(`Método: ${payLabel}`, { size: 8, color: [100, 100, 100] });

  y += 3;
  divider(true);

  // ── Warranty / conditions ──
  if (config.warranty_text) {
    txt("Garantía:", { size: 7, bold: true, color: [80, 80, 80] });
    txt(config.warranty_text, { size: 7, color: [120, 120, 120] });
    y += 2;
  }
  if (config.conditions_text) {
    txt("Condiciones:", { size: 7, bold: true, color: [80, 80, 80] });
    txt(config.conditions_text, { size: 7, color: [120, 120, 120] });
    y += 2;
  }

  divider();
  txt("Powered by SmartFixOS", { size: 6, align: "center", color: [180, 180, 180] });

  return pdf.output("blob");
}

// ── Receipt email HTML (original, dark-themed) ────────────────────────────
function formatReceiptHtml(sale, customer, items, biz) {
  const config = getConfig();
  const fromName = config.email_from_name || biz?.name || "SmartFixOS";
  const phone = biz?.phone || "";
  const date = new Date().toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" });
  const total = toCurrencyNumber(sale?.total_amount || sale?.total).toFixed(2);
  const subtotal = toCurrencyNumber(sale?.subtotal).toFixed(2);
  const tax = toCurrencyNumber(sale?.tax_amount).toFixed(2);
  const num = sale?.sale_number || sale?.id?.slice(-6) || "—";
  const logo = biz?.logo_url || "";
  const customerName = customer?.name || customer?.full_name || "";
  const payLabel = { cash: "💵 Efectivo", card: "💳 Tarjeta", ath_movil: "📱 ATH Móvil" }[sale?.payment_method] || sale?.payment_method || "";

  const rows = (items || []).map(i =>
    `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.9);font-size:14px;">${i.name}</td>
      <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:center;color:rgba(255,255,255,0.5);font-size:13px;">${i.quantity || 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;color:#34d399;font-weight:700;font-size:14px;">$${(toCurrencyNumber(i.price) * toCurrencyNumber(i.quantity || 1)).toFixed(2)}</td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Recibo #${num}</title></head>
<body style="margin:0;padding:0;background:#1a1a2e;font-family:'Segoe UI',Arial,sans-serif;" bgcolor="#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#1a1a2e"><tr><td align="center" style="padding:20px 16px;">
<div style="max-width:600px;width:100%;">
  <div style="background:linear-gradient(135deg,#0891b2,#059669 60%,#65a30d);border-radius:20px 20px 0 0;padding:36px 32px;text-align:center;">
    ${logo ? `<img src="${logo}" alt="Logo" style="max-height:50px;margin-bottom:16px;display:block;filter:brightness(0) invert(1);margin:0 auto 16px;" />` : ""}
    <h1 style="margin:0;color:white;font-size:22px;font-weight:800;">🧾 Recibo de Venta</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">${fromName}</p>
  </div>
  <div style="background:#1a1a2e;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);padding:28px 32px;">
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-left:4px solid #0891b2;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
      <div style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;">NÚMERO DE RECIBO</div>
      <div style="color:white;font-size:22px;font-weight:800;margin:4px 0 8px;">${num}</div>
      <div style="color:rgba(255,255,255,0.5);font-size:13px;">📅 ${date}</div>
      ${customerName ? `<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;margin-top:12px;"><div style="color:white;font-weight:700;font-size:15px;">👤 ${customerName}</div>${phone ? `<div style="color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px;">📞 ${phone}</div>` : ""}</div>` : ""}
    </div>
    <div style="margin-bottom:20px;">
      <div style="color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">ARTÍCULOS</div>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="background:rgba(255,255,255,0.05);">
          <th style="padding:10px 12px;text-align:left;color:rgba(255,255,255,0.5);font-size:11px;font-weight:600;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Artículo</th>
          <th style="padding:10px 8px;text-align:center;color:rgba(255,255,255,0.5);font-size:11px;font-weight:600;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Cant.</th>
          <th style="padding:10px 12px;text-align:right;color:rgba(255,255,255,0.5);font-size:11px;font-weight:600;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="background:rgba(5,150,105,0.1);border:1px solid rgba(5,150,105,0.3);border-radius:12px;padding:18px 20px;">
      ${Number(subtotal) > 0 ? `<div style="display:table;width:100%;margin-bottom:8px;"><span style="display:table-cell;color:rgba(255,255,255,0.6);font-size:14px;">Subtotal</span><span style="display:table-cell;text-align:right;color:rgba(255,255,255,0.6);font-size:14px;">$${subtotal}</span></div>` : ""}
      ${Number(tax) > 0 ? `<div style="display:table;width:100%;margin-bottom:8px;"><span style="display:table-cell;color:rgba(255,255,255,0.6);font-size:14px;">IVU (11.5%)</span><span style="display:table-cell;text-align:right;color:rgba(255,255,255,0.6);font-size:14px;">$${tax}</span></div>` : ""}
      <div style="border-top:2px solid rgba(5,150,105,0.5);padding-top:12px;display:table;width:100%;"><span style="display:table-cell;color:white;font-size:18px;font-weight:800;">TOTAL</span><span style="display:table-cell;text-align:right;color:#34d399;font-size:28px;font-weight:800;">$${total}</span></div>
      ${payLabel ? `<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;margin-top:10px;display:table;width:100%;"><span style="display:table-cell;color:rgba(255,255,255,0.5);font-size:13px;">Método de pago</span><span style="display:table-cell;text-align:right;color:rgba(255,255,255,0.8);font-weight:600;font-size:13px;">${payLabel}</span></div>` : ""}
    </div>
    ${config.warranty_text ? `<div style="margin-top:20px;padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;font-size:12px;color:rgba(255,255,255,0.6);"><strong style="color:rgba(255,255,255,0.8);">📋 Garantía:</strong><br/>${config.warranty_text}</div>` : ""}
    ${config.conditions_text ? `<div style="margin-top:10px;padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;font-size:12px;color:rgba(255,255,255,0.6);"><strong style="color:rgba(255,255,255,0.8);">📌 Condiciones:</strong><br/>${config.conditions_text}</div>` : ""}
  </div>
  <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 20px 20px;padding:24px 32px;text-align:center;">
    <p style="margin:0 0 4px;color:rgba(255,255,255,0.6);font-size:14px;font-weight:600;">${fromName}</p>
    ${phone ? `<p style="margin:0 0 4px;color:rgba(255,255,255,0.4);font-size:12px;">📞 ${phone}</p>` : ""}
    ${config.footer_text ? `<p style="margin:10px 0 0;color:rgba(255,255,255,0.5);font-size:13px;">${config.footer_text}</p>` : ""}
    <p style="margin:12px 0 0;color:rgba(255,255,255,0.2);font-size:11px;">Powered by SmartFixOS</p>
  </div>
</div>
</td></tr></table>
</body></html>`;
}

// ── Plain-text receipt (WhatsApp fallback) ────────────────────────────────
function formatReceiptText(sale, customer, items, biz) {
  const config = getConfig();
  const name = biz?.name || "SmartFixOS";
  const phone = biz?.phone || "";
  const addr = biz?.address || "";
  const date = new Date().toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" });
  const total = `$${toCurrencyNumber(sale?.total_amount || sale?.total).toFixed(2)}`;
  const num = sale?.sale_number || sale?.id?.slice(-6) || "—";
  const itemLines = (items || []).map(i =>
    `• ${i.name} x${i.quantity} — $${(toCurrencyNumber(i.price) * toCurrencyNumber(i.quantity || 1)).toFixed(2)}`
  ).join("\n");
  let text = `*${name}*\n`;
  if (addr) text += `${addr}\n`;
  if (phone) text += `Tel: ${phone}\n`;
  text += `\n🧾 *Recibo #${num}*\n📅 ${date}\n`;
  if (customer?.name || customer?.full_name) text += `👤 ${customer.name || customer.full_name}\n`;
  text += `\n*Artículos:*\n${itemLines}\n\n*Total: ${total}*\n`;
  if (config.warranty_text)   text += `\n📋 *Garantía:*\n${config.warranty_text}\n`;
  if (config.conditions_text) text += `\n📌 *Condiciones:*\n${config.conditions_text}\n`;
  if (config.footer_text)     text += `\n${config.footer_text}\n`;
  return text;
}

// ── Componente principal ───────────────────────────────────────────────────
export default function POSSaleActionsModal({ open, onClose, sale, customer, cartItems, onPrint }) {
  const [tab, setTab] = useState(null);          // null | "email" | "whatsapp_text"
  const [emailAddr, setEmailAddr] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingPDF, setSendingPDF] = useState(false);
  const [sent, setSent] = useState({ email: false, pdf: false });
  const [businessInfo, setBusinessInfo] = useState(null);
  const [recentSales, setRecentSales] = useState([]);
  const cfg = getConfig();

  useEffect(() => {
    if (!open) { setTab(null); setSent({ email: false, pdf: false }); return; }

    setEmailAddr(customer?.email || "");
    setWaPhone(customer?.phone || customer?.mobile || "");

    // Cargar info del negocio
    Promise.all([
      dataClient.entities.AppSettings.filter({ slug: "business-info" }).catch(() => []),
      dataClient.entities.AppSettings.filter({ slug: "business-branding" }).catch(() => []),
    ]).then(([bizRes, brandRes]) => {
      const info = bizRes?.[0]?.payload || {};
      const brand = brandRes?.[0]?.payload || {};
      setBusinessInfo({ ...info, logo_url: brand.logo_url || info.logo_url || "" });
    }).catch(() => {});

    // Guardar venta en historial
    if (sale?.id) {
      const entry = {
        saleId: sale.id,
        saleNumber: sale.sale_number || sale.id.slice(-6),
        total: toCurrencyNumber(sale.total_amount || sale.total),
        date: new Date().toISOString(),
        customerName: customer?.name || customer?.full_name || null,
        items: cartItems || [],
        sale,
        customer,
      };
      saveSaleToHistory(entry);
    }

    // Cargar historial reciente (sin la venta actual)
    const hist = getSaleHistory().filter(e => e.saleId !== sale?.id).slice(0, 4);
    setRecentSales(hist);
  }, [open, sale?.id]);

  if (!open) return null;

  const bizName = businessInfo?.name || "SmartFixOS";
  const totalStr = `$${toCurrencyNumber(sale?.total_amount || sale?.total).toFixed(2)}`;
  const saleNum = sale?.sale_number || sale?.id?.slice(-6) || "—";

  // ── PDF Share ──────────────────────────────────────────────────────────
  const handleSharePDF = useCallback(async () => {
    setSendingPDF(true);
    try {
      const blob = await generateReceiptPDF(sale, customer, cartItems, businessInfo);
      const filename = `Recibo-${saleNum}.pdf`;
      const file = new File([blob], filename, { type: "application/pdf" });

      // Web Share API — funciona en iOS Safari, Android Chrome, abre sheet nativo
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Recibo ${saleNum} — ${bizName}`,
          text: `Aquí está tu recibo de compra`,
        });
        setSent(p => ({ ...p, pdf: true }));
        toast.success("✅ Recibo compartido");
      } else {
        // Fallback: descarga directa
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSent(p => ({ ...p, pdf: true }));
        toast.success("✅ PDF descargado");
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        toast.error(`Error generando PDF: ${err.message}`);
      }
    } finally {
      setSendingPDF(false);
    }
  }, [sale, customer, cartItems, businessInfo, saleNum, bizName]);

  // ── Email ──────────────────────────────────────────────────────────────
  const handleSendEmail = async () => {
    if (!emailAddr) { toast.error("Ingresa un email"); return; }
    setSending(true);
    try {
      const res = await fetch(apiUrl("/api/send-raw-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailAddr,
          subject: `Recibo de venta #${saleNum} — ${bizName}`,
          html: formatReceiptHtml(sale, customer, cartItems, businessInfo),
          from_name: bizName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error || `Error ${res.status}`);
      setSent(p => ({ ...p, email: true }));
      toast.success("✅ Recibo enviado por email");
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    } finally { setSending(false); }
  };

  // ── WhatsApp texto (fallback) ──────────────────────────────────────────
  const handleWhatsAppText = () => {
    const cleaned = waPhone.replace(/\D/g, "");
    if (!cleaned) { toast.error("Ingresa el teléfono del cliente"); return; }
    const text = formatReceiptText(sale, customer, cartItems, businessInfo);
    window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(text)}`, "_blank");
    toast.success("WhatsApp abierto");
  };

  // ── UI ─────────────────────────────────────────────────────────────────
  return (
    <div className="apple-type fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="apple-surface-elevated rounded-t-3xl sm:rounded-apple-lg shadow-apple-xl w-full sm:max-w-sm overflow-hidden max-h-[92dvh] flex flex-col">

        {/* ── Handle (mobile) ── */}
        <div className="flex justify-center pt-3 pb-0 sm:hidden flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-[rgb(var(--separator)/0.5)]" />
        </div>

        {/* ── Success header ── */}
        <div className="flex-shrink-0 bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-transparent px-6 pt-5 pb-5 border-b border-[rgb(var(--separator)/0.2)]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="apple-text-caption1 apple-label-secondary font-semibold tracking-wider uppercase">Venta completada</p>
                <p className="apple-text-large-title font-bold apple-label-primary tabular-nums leading-tight">{totalStr}</p>
                <p className="apple-text-caption1 apple-label-tertiary mt-0.5">Recibo #{saleNum}{customer?.name ? ` · ${customer.name}` : ""}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[rgb(var(--fill-tertiary))] flex items-center justify-center apple-label-secondary flex-shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Actions ── */}
          {tab === null && (
            <div className="px-5 py-4 space-y-2.5">
              <p className="apple-text-caption1 apple-label-tertiary font-semibold tracking-wider uppercase px-1 mb-1">Compartir recibo</p>

              {/* PDF Share — primary action */}
              <button
                onClick={handleSharePDF}
                disabled={sendingPDF}
                className="w-full flex items-center gap-3.5 p-4 rounded-2xl bg-apple-blue/10 border border-apple-blue/20 hover:bg-apple-blue/15 active:scale-[0.98] transition-all text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-apple-blue flex items-center justify-center flex-shrink-0 shadow-sm">
                  {sendingPDF
                    ? <Loader2 className="w-5 h-5 text-white animate-spin" />
                    : sent.pdf
                    ? <Check className="w-5 h-5 text-white" />
                    : <Share2 className="w-5 h-5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="apple-text-subheadline font-semibold text-apple-blue">
                    {sendingPDF ? "Generando PDF…" : sent.pdf ? "¡Compartido!" : "Compartir como PDF"}
                  </p>
                  <p className="apple-text-caption1 apple-label-secondary mt-0.5">
                    WhatsApp · iMessage · Mail · AirDrop…
                  </p>
                </div>
                {!sendingPDF && <ChevronRight className="w-4 h-4 apple-label-tertiary flex-shrink-0" />}
              </button>

              {/* Email */}
              {cfg.send_email !== false && (
                <button
                  onClick={() => setTab("email")}
                  className="w-full flex items-center gap-3.5 p-4 rounded-2xl apple-card hover:apple-card active:scale-[0.98] transition-all text-left"
                >
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", sent.email ? "bg-emerald-500" : "bg-[rgb(var(--fill-secondary))]")}>
                    {sent.email ? <Check className="w-5 h-5 text-white" /> : <Mail className="w-5 h-5 apple-label-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="apple-text-subheadline font-semibold apple-label-primary">Enviar por Email</p>
                    <p className="apple-text-caption1 apple-label-secondary mt-0.5 truncate">{emailAddr || "Sin email — puedes escribirlo"}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 apple-label-tertiary flex-shrink-0" />
                </button>
              )}

              {/* Print */}
              {cfg.send_print !== false && (
                <button
                  onClick={() => { onPrint?.(); onClose(); }}
                  className="w-full flex items-center gap-3.5 p-4 rounded-2xl apple-card hover:apple-card active:scale-[0.98] transition-all text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-[rgb(var(--fill-secondary))] flex items-center justify-center flex-shrink-0">
                    <Printer className="w-5 h-5 apple-label-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="apple-text-subheadline font-semibold apple-label-primary">Imprimir recibo</p>
                    <p className="apple-text-caption1 apple-label-secondary mt-0.5">Impresora térmica o regular</p>
                  </div>
                  <ChevronRight className="w-4 h-4 apple-label-tertiary flex-shrink-0" />
                </button>
              )}

              {/* WhatsApp texto (secondary/plain) */}
              {cfg.send_whatsapp !== false && (
                <button
                  onClick={() => setTab("whatsapp_text")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left"
                >
                  <MessageCircle className="w-4 h-4 apple-label-tertiary flex-shrink-0" />
                  <span className="apple-text-footnote apple-label-tertiary">Compartir como texto (WhatsApp)</span>
                  <ChevronRight className="w-3 h-3 apple-label-quaternary ml-auto flex-shrink-0" />
                </button>
              )}

              {/* Skip */}
              <button
                onClick={onClose}
                className="w-full py-3 apple-text-subheadline apple-label-tertiary font-medium text-center"
              >
                Omitir
              </button>
            </div>
          )}

          {/* ── Email tab ── */}
          {tab === "email" && (
            <div className="px-5 py-4 space-y-3">
              <button onClick={() => setTab(null)} className="apple-text-subheadline apple-label-secondary flex items-center gap-1">
                <ChevronRight className="w-4 h-4 rotate-180" /> Volver
              </button>
              <p className="apple-text-subheadline font-semibold apple-label-primary">Email del cliente</p>
              <input
                autoFocus type="email" placeholder="correo@ejemplo.com"
                value={emailAddr} onChange={e => setEmailAddr(e.target.value)}
                className="apple-input w-full px-4 py-3 apple-text-subheadline"
              />
              <button onClick={handleSendEmail} disabled={sending || sent.email}
                className={cn("apple-btn w-full", sent.email ? "apple-btn-primary bg-emerald-500" : "apple-btn-primary")}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : sent.email ? <Check className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {sending ? "Enviando…" : sent.email ? "¡Enviado!" : "Enviar Email"}
              </button>
            </div>
          )}

          {/* ── WhatsApp texto tab ── */}
          {tab === "whatsapp_text" && (
            <div className="px-5 py-4 space-y-3">
              <button onClick={() => setTab(null)} className="apple-text-subheadline apple-label-secondary flex items-center gap-1">
                <ChevronRight className="w-4 h-4 rotate-180" /> Volver
              </button>
              <p className="apple-text-subheadline font-semibold apple-label-primary">Teléfono del cliente</p>
              <input
                autoFocus type="tel" placeholder="+1 787 000 0000"
                value={waPhone} onChange={e => setWaPhone(e.target.value)}
                className="apple-input w-full px-4 py-3 apple-text-subheadline"
              />
              <button onClick={handleWhatsAppText}
                className="apple-btn apple-btn-primary w-full"
                style={{ background: "#25D366" }}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Abrir WhatsApp
              </button>
              <p className="apple-text-caption1 apple-label-tertiary text-center">
                Esto envía el recibo como mensaje de texto
              </p>
            </div>
          )}

          {/* ── Mini historial reciente ── */}
          {tab === null && recentSales.length > 0 && (
            <div className="px-5 pb-5 pt-1">
              <div
                className="border-t border-[rgb(var(--separator)/0.15)] pt-4"
              >
                <p className="apple-text-caption1 apple-label-tertiary font-semibold tracking-wider uppercase px-1 mb-2">
                  Ventas recientes
                </p>
                <div className="space-y-1.5">
                  {recentSales.map(entry => (
                    <div
                      key={entry.saleId}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[rgb(var(--fill-quaternary))]"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[rgb(var(--fill-secondary))] flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-3.5 h-3.5 apple-label-tertiary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="apple-text-footnote font-semibold apple-label-primary tabular-nums">
                          #{entry.saleNumber}
                          {entry.customerName && <span className="apple-label-secondary font-normal"> · {entry.customerName}</span>}
                        </p>
                        <p className="apple-text-caption2 apple-label-tertiary tabular-nums">
                          {new Date(entry.date).toLocaleString("es-PR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className="apple-text-footnote font-semibold apple-label-secondary tabular-nums flex-shrink-0">
                        ${Number(entry.total).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Safe area bottom ── */}
        <div className="flex-shrink-0" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </div>
  );
}

// ── Modal de historial de ventas (completo, desde botón History) ───────────
export function POSSaleHistoryModal({ open, onClose, onReopen }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (open) setHistory(getSaleHistory());
  }, [open]);

  if (!open) return null;

  return (
    <div className="apple-type fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="apple-surface-elevated rounded-t-3xl sm:rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden w-full sm:max-w-sm max-h-[85dvh] flex flex-col">
        <div className="flex justify-center pt-3 pb-0 sm:hidden flex-shrink-0">
          <div className="w-9 h-1 rounded-full bg-[rgb(var(--separator)/0.5)]" />
        </div>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0 border-b border-[rgb(var(--separator)/0.2)]">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-apple-blue" />
            <h3 className="apple-label-primary apple-text-headline font-semibold">Historial de ventas</h3>
          </div>
          <button onClick={onClose} className="apple-press w-8 h-8 rounded-full bg-[rgb(var(--fill-secondary))] flex items-center justify-center">
            <X className="w-4 h-4 apple-label-secondary" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-1.5">
          {history.length === 0 && (
            <p className="apple-label-tertiary apple-text-subheadline text-center py-10">No hay ventas recientes</p>
          )}
          {history.map(entry => (
            <button key={entry.saleId}
              onClick={() => { onReopen?.(entry); onClose(); }}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-2xl apple-card text-left active:scale-[0.98] transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-apple-blue/15 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-4 h-4 text-apple-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="apple-label-primary apple-text-subheadline font-semibold tabular-nums">
                  #{entry.saleNumber}
                </p>
                <p className="apple-label-secondary apple-text-caption1 mt-0.5">
                  {entry.customerName || "Sin cliente"} · <span className="tabular-nums">${Number(entry.total).toFixed(2)}</span>
                </p>
                <p className="apple-label-tertiary apple-text-caption1 tabular-nums">
                  {new Date(entry.date).toLocaleString("es-PR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 apple-label-tertiary flex-shrink-0" />
            </button>
          ))}
        </div>
        <div className="flex-shrink-0" style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
      </div>
    </div>
  );
}
