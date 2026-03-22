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
  const name = biz?.name || "SmartFixOS";
  const phone = biz?.phone || "";
  const addr = biz?.address || "";
  const date = new Date().toLocaleDateString("es-PR", { year: "numeric", month: "long", day: "numeric" });
  const total = Number(sale?.total_amount || sale?.total || 0).toFixed(2);
  const num = sale?.sale_number || sale?.id?.slice(-6) || "—";

  const rows = (items || []).map(i => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #eee">${i.name}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">$${(Number(i.price || 0) * Number(i.quantity || 1)).toFixed(2)}</td>
    </tr>`).join("");

  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#fff;padding:32px;border-radius:12px">
    <h1 style="margin:0 0 4px;font-size:22px;color:#111">${name}</h1>
    ${addr ? `<p style="margin:0;color:#666;font-size:13px">${addr}</p>` : ""}
    ${phone ? `<p style="margin:0;color:#666;font-size:13px">Tel: ${phone}</p>` : ""}
    <hr style="margin:20px 0;border:none;border-top:1px solid #eee"/>
    <p style="margin:0 0 4px;font-size:13px;color:#888">Recibo #${num} · ${date}</p>
    ${customer?.name || customer?.full_name ? `<p style="margin:4px 0;font-size:14px;color:#333">Cliente: <strong>${customer.name || customer.full_name}</strong></p>` : ""}
    <table style="width:100%;margin-top:16px;border-collapse:collapse;font-size:14px">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:8px;text-align:left">Artículo</th>
        <th style="padding:8px;text-align:center">Cant.</th>
        <th style="padding:8px;text-align:right">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:right;margin-top:16px;font-size:20px;font-weight:bold;color:#111">Total: $${total}</div>
    ${config.warranty_text ? `<div style="margin-top:20px;padding:12px;background:#f9f9f9;border-radius:8px;font-size:12px;color:#555"><strong>Garantía:</strong><br/>${config.warranty_text}</div>` : ""}
    ${config.conditions_text ? `<div style="margin-top:12px;padding:12px;background:#f9f9f9;border-radius:8px;font-size:12px;color:#555"><strong>Condiciones:</strong><br/>${config.conditions_text}</div>` : ""}
    ${config.review_link ? `<div style="margin-top:16px;text-align:center"><a href="${config.review_link}" style="color:#2563eb;font-size:13px">⭐ Déjanos una reseña</a></div>` : ""}
    ${config.footer_text ? `<p style="margin-top:16px;text-align:center;font-size:12px;color:#888">${config.footer_text}</p>` : ""}
    <p style="margin-top:24px;text-align:center;font-size:11px;color:#aaa">Generado por SmartFixOS</p>
  </div>`;
}

// ── Componente principal ───────────────────────────────────────────────────
export default function POSSaleActionsModal({ open, onClose, sale, customer, cartItems, onPrint }) {
  const [tab, setTab] = useState(null);
  const [emailAddr, setEmailAddr] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({ email: false, wa: false });
  const [businessInfo, setBusinessInfo] = useState(null);

  useEffect(() => {
    if (!open) { setTab(null); setSent({ email: false, wa: false }); return; }

    // Email: usar email del cliente
    setEmailAddr(customer?.email || "");

    // WhatsApp: usar teléfono del cliente
    setWaPhone(customer?.phone || customer?.mobile || "");

    // Cargar info del negocio
    dataClient.entities.AppSettings.filter({ slug: "business-info" })
      .then(res => { if (res?.[0]?.payload) setBusinessInfo(res[0].payload); })
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
      await sendEmail({ to_email: emailAddr, subject: `Recibo — ${bizName}`, body_html: receiptHtml });
      setSent(p => ({ ...p, email: true }));
      toast.success("✅ Recibo enviado por email");
    } catch { toast.error("Error enviando email"); }
    finally { setSending(false); }
  };

  const handleSendWhatsApp = () => {
    const cleaned = waPhone.replace(/\D/g, "");
    if (!cleaned) { toast.error("Ingresa el teléfono del cliente"); return; }
    window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(receiptText)}`, "_blank");
    setSent(p => ({ ...p, wa: true }));
    toast.success("WhatsApp abierto");
  };

  const ActionCard = ({ icon: Icon, label, sublabel, color, onClick, done }) => (
    <button onClick={onClick}
      className={cn("w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left",
        done ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
      )}
    >
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0", color)}>
        {done ? <Check className="w-5 h-5 text-white" /> : <Icon className="w-5 h-5 text-white" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm">{label}</p>
        <p className="text-white/40 text-xs mt-0.5 truncate">{sublabel}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f0f12] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h3 className="text-white font-black text-lg">✅ Venta completada</h3>
            <p className="text-white/40 text-sm mt-0.5">¿Cómo enviamos el recibo?</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-3">
          {tab === null && (<>
            <ActionCard icon={Mail} label="Enviar por Email"
              sublabel={emailAddr || "Sin email guardado — puedes escribirlo"}
              color="bg-blue-600/80" done={sent.email} onClick={() => setTab("email")} />
            <ActionCard icon={MessageCircle} label="Enviar por WhatsApp"
              sublabel={waPhone || "Sin teléfono guardado — puedes escribirlo"}
              color="bg-emerald-600/80" done={sent.wa} onClick={() => setTab("whatsapp")} />
            <ActionCard icon={Printer} label="Imprimir Recibo"
              sublabel="Impresora térmica o regular"
              color="bg-slate-600/80" done={false}
              onClick={() => { onPrint?.(); onClose(); }} />
            <button onClick={onClose}
              className="w-full mt-1 py-3 text-white/30 text-sm hover:text-white/50 transition-colors">
              Omitir
            </button>
          </>)}

          {tab === "email" && (
            <div className="space-y-3">
              <button onClick={() => setTab(null)} className="text-white/40 text-sm hover:text-white/60">← Volver</button>
              <input autoFocus type="email" placeholder="correo@ejemplo.com"
                value={emailAddr} onChange={e => setEmailAddr(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500/50" />
              <button onClick={handleSendEmail} disabled={sending || sent.email}
                className={cn("w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all",
                  sent.email ? "bg-emerald-600/80 text-white" : "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg"
                )}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent.email ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {sending ? "Enviando..." : sent.email ? "¡Enviado!" : "Enviar Email"}
              </button>
            </div>
          )}

          {tab === "whatsapp" && (
            <div className="space-y-3">
              <button onClick={() => setTab(null)} className="text-white/40 text-sm hover:text-white/60">← Volver</button>
              <p className="text-white/40 text-xs">Teléfono del cliente (al que enviarás el recibo)</p>
              <input autoFocus type="tel" placeholder="+1 787 000 0000"
                value={waPhone} onChange={e => setWaPhone(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50" />
              <button onClick={handleSendWhatsApp}
                className="w-full py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-green-500 text-white shadow-lg">
                <MessageCircle className="w-4 h-4" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#0f0f12] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <History className="w-5 h-5 text-cyan-400" />
            <h3 className="text-white font-black text-lg">Historial de Ventas</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10">
            <X className="w-4 h-4 text-white/50" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 pb-6 space-y-2">
          {history.length === 0 && (
            <p className="text-white/30 text-sm text-center py-8">No hay ventas recientes guardadas</p>
          )}
          {history.map(entry => (
            <button key={entry.saleId} onClick={() => { onReopen?.(entry); onClose(); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-left transition-all">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <Receipt className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm">#{entry.saleNumber}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {entry.customerName || "Sin cliente"} · ${Number(entry.total).toFixed(2)}
                </p>
                <p className="text-white/25 text-xs">
                  {new Date(entry.date).toLocaleString("es-PR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
