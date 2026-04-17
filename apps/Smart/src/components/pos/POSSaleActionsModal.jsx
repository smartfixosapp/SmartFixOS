import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { sendEmail } from "@/api/functions";
import {
  Mail, MessageCircle, Printer, X, Send, Check,
  Loader2, ChevronRight, History, Clock, Receipt
} from "lucide-react";
import { dataClient } from "@/components/api/dataClient";

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

// ── Formato de recibo ──────────────────────────────────────────────────────
function getConfig() {
  try { return JSON.parse(localStorage.getItem("pos_receipt_config") || "{}"); } catch { return {}; }
}

function formatReceiptText(sale, customer, items, biz) {
  const config = getConfig();
  const name = biz?.name || "SmartFixOS";
  const phone = biz?.phone || biz?.whatsapp || "";
  const addr = biz?.address || "";
  const date = new Date().toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" });
  const total = `$${Number(sale?.total_amount || sale?.total || 0).toFixed(2)}`;
  const num = sale?.sale_number || sale?.id?.slice(-6) || "—";

  const itemLines = (items || []).map(i =>
    `• ${i.name} x${i.quantity} — $${(Number(i.price || 0) * Number(i.quantity || 1)).toFixed(2)}`
  ).join("\n");

  let text = `*${name}*\n`;
  if (addr) text += `${addr}\n`;
  if (phone) text += `Tel/WhatsApp: ${phone}\n`;
  text += `\n🧾 *Recibo #${num}*\n📅 ${date}\n`;
  if (customer?.name || customer?.full_name) text += `👤 ${customer.name || customer.full_name}\n`;
  text += `\n*Artículos:*\n${itemLines}\n\n*Total: ${total}*\n`;
  if (config.warranty_text)   text += `\n📋 *Garantía:*\n${config.warranty_text}\n`;
  if (config.conditions_text) text += `\n📌 *Condiciones:*\n${config.conditions_text}\n`;
  if (config.review_link)     text += `\n⭐ Reseña: ${config.review_link}\n`;
  if (config.footer_text)     text += `\n${config.footer_text}\n`;
  return text;
}

function formatReceiptHtml(sale, customer, items, biz) {
  const config = getConfig();
  const fromName = config.email_from_name || biz?.name || "SmartFixOS";
  const phone = biz?.phone || "";
  const date = new Date().toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" });
  const total = Number(sale?.total_amount || sale?.total || 0).toFixed(2);
  const subtotal = Number(sale?.subtotal || 0).toFixed(2);
  const tax = Number(sale?.tax_amount || 0).toFixed(2);
  const num = sale?.sale_number || sale?.id?.slice(-6) || "—";
  const subject = (config.email_subject_sale || "🧾 Tu recibo de venta #{number}").replace("#{number}", num);
  const logo = biz?.logo_url || "";
  const customerName = customer?.name || customer?.full_name || "";

  const payLabel = sale?.payment_method === "cash" ? "💵 Efectivo"
    : sale?.payment_method === "card" ? "💳 Tarjeta"
    : sale?.payment_method === "ath_movil" ? "📱 ATH Móvil"
    : sale?.payment_method || "";

  const rows = (items || []).map(i =>
    `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.9);font-size:14px;">${i.name}</td>
      <td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:center;color:rgba(255,255,255,0.5);font-size:13px;">${i.quantity || 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;color:#34d399;font-weight:700;font-size:14px;">$${(Number(i.price || 0) * Number(i.quantity || 1)).toFixed(2)}</td>
    </tr>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#1a1a2e;font-family:'Segoe UI',Arial,sans-serif;" bgcolor="#1a1a2e">
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1a1a2e" style="background:#1a1a2e;"><tr><td align="center" style="padding:20px 16px;">
<div style="max-width:600px;width:100%;">

  <div style="background:linear-gradient(135deg,#0891b2 0%,#059669 60%,#65a30d 100%);border-radius:20px 20px 0 0;padding:36px 32px;text-align:center;">
    ${logo ? `<img src="${logo}" alt="Logo" style="max-height:50px;max-width:160px;margin:0 auto 16px;display:block;filter:brightness(0) invert(1);" />` : ""}
    <h1 style="margin:0;color:white;font-size:22px;font-weight:800;">🧾 Recibo de Venta</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">${fromName}</p>
  </div>

  <div style="background:#1a1a2e;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);padding:28px 32px;">

    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-left:4px solid #0891b2;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
      <div style="color:rgba(255,255,255,0.4);font-size:11px;text-transform:uppercase;letter-spacing:1px;">NÚMERO DE RECIBO</div>
      <div style="color:white;font-size:22px;font-weight:800;margin:4px 0 8px;">${num}</div>
      <div style="color:rgba(255,255,255,0.5);font-size:13px;">📅 ${date}</div>
      ${customerName ? `
      <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:12px;margin-top:12px;">
        <div style="color:white;font-weight:700;font-size:15px;">👤 ${customerName}</div>
        ${phone ? `<div style="color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px;">📞 ${phone}</div>` : ""}
      </div>` : ""}
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
      <div style="border-top:2px solid rgba(5,150,105,0.5);padding-top:12px;display:table;width:100%;">
        <span style="display:table-cell;color:white;font-size:18px;font-weight:800;">TOTAL</span>
        <span style="display:table-cell;text-align:right;color:#34d399;font-size:28px;font-weight:800;">$${total}</span>
      </div>
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
</body>
</html>`;
}

// (sendViaResend eliminado — usamos el servidor Deno vía sendEmail de @/api/functions)

// ── Componente principal ───────────────────────────────────────────────────
export default function POSSaleActionsModal({ open, onClose, sale, customer, cartItems, onPrint }) {
  const [tab, setTab] = useState(null);
  const [emailAddr, setEmailAddr] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({ email: false, wa: false });
  const [businessInfo, setBusinessInfo] = useState(null);
  const cfg = getConfig();

  useEffect(() => {
    if (!open) { setTab(null); setSent({ email: false, wa: false }); return; }

    // Email: usar email del cliente
    setEmailAddr(customer?.email || "");

    // WhatsApp: usar teléfono del cliente
    setWaPhone(customer?.phone || customer?.mobile || "");

    // Cargar info del negocio + branding (logo)
    Promise.all([
      dataClient.entities.AppSettings.filter({ slug: "business-info" }).catch(() => []),
      dataClient.entities.AppSettings.filter({ slug: "business-branding" }).catch(() => []),
    ]).then(([bizRes, brandingRes]) => {
      const info = bizRes?.[0]?.payload || {};
      const branding = brandingRes?.[0]?.payload || {};
      setBusinessInfo({ ...info, logo_url: branding.logo_url || info.logo_url || "" });
    })
      .catch(() => {});

    // Guardar en historial al abrir el modal (venta ya completada)
    if (sale?.id) {
      saveSaleToHistory({
        saleId: sale.id,
        saleNumber: sale.sale_number || sale.id.slice(-6),
        total: Number(sale.total_amount || sale.total || 0),
        date: new Date().toISOString(),
        customerName: customer?.name || customer?.full_name || null,
        items: cartItems || [],
        sale,
        customer,
      });
    }
  }, [open, sale?.id]);

  if (!open) return null;

  const receiptText = formatReceiptText(sale, customer, cartItems, businessInfo);
  const receiptHtml = formatReceiptHtml(sale, customer, cartItems, businessInfo);
  const bizName = businessInfo?.name || "SmartFixOS";

  const handleSendEmail = async () => {
    if (!emailAddr) { toast.error("Ingresa un email"); return; }
    setSending(true);
    try {
      // Llama directamente a la Vercel serverless function /api/send-raw-email
      // (RESEND_API_KEY está en process.env de Vercel, no en el frontend)
      const res = await fetch('/api/send-raw-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailAddr,
          subject: `Recibo de venta — ${bizName}`,
          html: receiptHtml,
          from_name: bizName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `Error ${res.status}`);
      }
      setSent(p => ({ ...p, email: true }));
      toast.success("✅ Recibo enviado por email");
    } catch (err) {
      console.error("Email error:", err);
      toast.error(`Error enviando email: ${err.message}`);
    } finally { setSending(false); }
  };

  const handleSendWhatsApp = () => {
    const cleaned = waPhone.replace(/\D/g, "");
    if (!cleaned) { toast.error("Ingresa el teléfono del cliente"); return; }
    window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(receiptText)}`, "_blank");
    setSent(p => ({ ...p, wa: true }));
    toast.success("WhatsApp abierto");
  };

  const ActionCard = ({ icon: Icon, label, sublabel, tint, onClick, done }) => (
    <button onClick={onClick}
      className={cn("apple-press apple-list-row w-full flex items-center gap-4 p-4 rounded-apple-md text-left transition-all",
        done ? `bg-apple-green/12` : "apple-card"
      )}
    >
      <div className={cn("w-11 h-11 rounded-apple-sm flex items-center justify-center flex-shrink-0", done ? "bg-apple-green text-white" : `bg-apple-${tint}/15 text-apple-${tint}`)}>
        {done ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="apple-label-primary apple-text-subheadline font-semibold">{label}</p>
        <p className="apple-label-secondary apple-text-caption1 mt-0.5 truncate">{sublabel}</p>
      </div>
      <ChevronRight className="w-4 h-4 apple-label-tertiary flex-shrink-0" />
    </button>
  );

  return (
    <div className="apple-type fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden w-full max-w-sm">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h3 className="apple-label-primary apple-text-headline">Venta completada</h3>
            <p className="apple-label-secondary apple-text-subheadline mt-0.5">¿Cómo enviamos el recibo?</p>
          </div>
          <button onClick={onClose} className="apple-press w-8 h-8 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center">
            <X className="w-4 h-4 apple-label-secondary" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {tab === null && (<>
            {cfg.send_email !== false && (
              <ActionCard icon={Mail} label="Enviar por Email"
                sublabel={emailAddr || "Sin email guardado — puedes escribirlo"}
                tint="blue" done={sent.email} onClick={() => setTab("email")} />
            )}
            {cfg.send_whatsapp !== false && (
              <ActionCard icon={MessageCircle} label="Enviar por WhatsApp"
                sublabel={waPhone || "Sin teléfono guardado — puedes escribirlo"}
                tint="green" done={sent.wa} onClick={() => setTab("whatsapp")} />
            )}
            {cfg.send_print !== false && (
              <ActionCard icon={Printer} label="Imprimir Recibo"
                sublabel="Impresora térmica o regular"
                tint="indigo" done={false}
                onClick={() => { onPrint?.(); onClose(); }} />
            )}
            <button onClick={onClose}
              className="apple-btn apple-btn-plain w-full mt-1 py-3 apple-label-tertiary apple-text-subheadline">
              Omitir
            </button>
          </>)}

          {tab === "email" && (
            <div className="space-y-3">
              <button onClick={() => setTab(null)} className="apple-label-secondary apple-text-subheadline">← Volver</button>
              <input autoFocus type="email" placeholder="correo@ejemplo.com"
                value={emailAddr} onChange={e => setEmailAddr(e.target.value)}
                className="apple-input w-full px-4 py-3 apple-text-subheadline" />
              <button onClick={handleSendEmail} disabled={sending || sent.email}
                className={cn("apple-btn w-full",
                  sent.email ? "apple-btn-primary bg-apple-green" : "apple-btn-primary"
                )}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : sent.email ? <Check className="w-4 h-4 mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {sending ? "Enviando..." : sent.email ? "¡Enviado!" : "Enviar Email"}
              </button>
            </div>
          )}

          {tab === "whatsapp" && (
            <div className="space-y-3">
              <button onClick={() => setTab(null)} className="apple-label-secondary apple-text-subheadline">← Volver</button>
              <p className="apple-label-secondary apple-text-caption1">Teléfono del cliente (al que enviarás el recibo)</p>
              <input autoFocus type="tel" placeholder="+1 787 000 0000"
                value={waPhone} onChange={e => setWaPhone(e.target.value)}
                className="apple-input w-full px-4 py-3 apple-text-subheadline" />
              <button onClick={handleSendWhatsApp}
                className="apple-btn apple-btn-primary bg-apple-green w-full">
                <MessageCircle className="w-4 h-4 mr-2" />
                Abrir WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modal de historial de ventas ───────────────────────────────────────────
export function POSSaleHistoryModal({ open, onClose, onReopen }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (open) setHistory(getSaleHistory());
  }, [open]);

  if (!open) return null;

  return (
    <div className="apple-type fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="apple-surface-elevated rounded-apple-lg shadow-apple-xl border-0 p-0 overflow-hidden w-full max-w-sm max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-apple-blue" />
            <h3 className="apple-label-primary apple-text-headline">Historial de Ventas</h3>
          </div>
          <button onClick={onClose} className="apple-press w-8 h-8 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center">
            <X className="w-4 h-4 apple-label-secondary" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-2">
          {history.length === 0 && (
            <p className="apple-label-tertiary apple-text-subheadline text-center py-8">No hay ventas recientes guardadas</p>
          )}
          {history.map(entry => (
            <button key={entry.saleId} onClick={() => { onReopen?.(entry); onClose(); }}
              className="apple-press apple-list-row w-full flex items-center gap-4 p-4 rounded-apple-md apple-card text-left transition-all">
              <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-4 h-4 text-apple-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="apple-label-primary apple-text-subheadline font-semibold tabular-nums">#{entry.saleNumber}</p>
                <p className="apple-label-secondary apple-text-caption1 mt-0.5 tabular-nums">
                  {entry.customerName || "Sin cliente"} · ${Number(entry.total).toFixed(2)}
                </p>
                <p className="apple-label-tertiary apple-text-caption1 tabular-nums">
                  {new Date(entry.date).toLocaleString("es-PR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 apple-label-tertiary flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
