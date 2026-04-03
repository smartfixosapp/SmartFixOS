import React, { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Send, MessageCircle, Mail, Users, Star, Clock,
  CheckCircle, AlertCircle, Copy, ChevronDown, Megaphone,
  Loader2, ExternalLink
} from "lucide-react";
import { sendEmail } from "@/api/functions";
import toast from "react-hot-toast";

// ── Helpers ─────────────────────────────────────────────────────────────────

function applyVars(text, customer, tallerName) {
  return (text || "")
    .replace(/\{\{nombre\}\}/gi, customer.name || "Cliente")
    .replace(/\{\{taller\}\}/gi, tallerName || "SmartFixOS")
    .replace(/\{\{telefono\}\}/gi, customer.phone || "")
    .replace(/\{\{email\}\}/gi, customer.email || "");
}

function buildHtml(bodyText, customerName, tallerName) {
  const processedBody = applyVars(bodyText, { name: customerName }, tallerName);
  const lines = processedBody.split("\n").map(l => `<p style="margin:0 0 10px 0;line-height:1.6">${l || "&nbsp;"}</p>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#111;border-radius:16px;overflow:hidden;border:1px solid #222">
<tr><td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:28px 32px;text-align:center">
<h1 style="margin:0;color:#fff;font-size:22px;font-weight:900;letter-spacing:-0.5px">${tallerName || "SmartFixOS"}</h1>
<p style="margin:6px 0 0;color:rgba(255,255,255,0.7);font-size:13px">Taller de reparación</p>
</td></tr>
<tr><td style="padding:32px">
<p style="margin:0 0 18px;color:#fff;font-size:16px;font-weight:700">Hola, ${customerName} 👋</p>
<div style="color:#ccc;font-size:14px">${lines}</div>
</td></tr>
<tr><td style="background:#0d0d0d;padding:20px 32px;text-align:center;border-top:1px solid #1f1f1f">
<p style="margin:0;color:#555;font-size:11px">© ${new Date().getFullYear()} ${tallerName || "SmartFixOS"} · Powered by SmartFixOS</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function getWhatsAppUrl(phone, text) {
  const digits = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function isInactive(customer, months) {
  const d = customer.updated_at || customer.created_at;
  if (!d) return true;
  const diff = (Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24 * 30);
  return diff >= months;
}

// ── Filtros ──────────────────────────────────────────────────────────────────
const FILTERS = [
  { id: "all",      label: "Todos los clientes",   icon: Users },
  { id: "vip",      label: "Solo VIP (3+ órdenes)", icon: Star },
  { id: "inactive", label: "Sin visita en 3+ meses", icon: Clock },
];

// ── Componente principal ─────────────────────────────────────────────────────
export default function BulkOfferModal({ open, onClose, customers = [] }) {
  const tallerName = localStorage.getItem("smartfix_business_name") || "SmartFixOS";

  const [tab, setTab]           = useState("email"); // "email" | "whatsapp"
  const [filter, setFilter]     = useState("all");
  const [subject, setSubject]   = useState(`🎉 Oferta especial de ${tallerName}`);
  const [body, setBody]         = useState(
    `Hola {{nombre}},\n\nTenemos una oferta especial para ti en {{taller}}.\n\n✅ Trae tu dispositivo esta semana y obtén un descuento especial en reparaciones.\n\n¡Te esperamos!`
  );
  const [sending, setSending]   = useState(false);
  const [results, setResults]   = useState(null); // { sent, failed, errors }
  const [copied, setCopied]     = useState(false);
  const bodyRef = useRef(null);

  // ── Computed lists ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (filter === "vip")      return customers.filter(c => (c.total_orders || 0) >= 3);
    if (filter === "inactive") return customers.filter(c => isInactive(c, 3));
    return customers;
  }, [customers, filter]);

  const emailList = useMemo(() => filtered.filter(c => c.email?.includes("@")), [filtered]);
  const waList    = useMemo(() => filtered.filter(c => c.phone && !c.email?.includes("@")), [filtered]);
  const waAll     = useMemo(() => filtered.filter(c => c.phone), [filtered]);

  // ── Insert variable helper ────────────────────────────────────────────────
  const insertVar = (v) => {
    const el = bodyRef.current;
    if (!el) { setBody(b => b + v); return; }
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const newVal = body.slice(0, start) + v + body.slice(end);
    setBody(newVal);
    setTimeout(() => { el.focus(); el.setSelectionRange(start + v.length, start + v.length); }, 0);
  };

  // ── Send emails ───────────────────────────────────────────────────────────
  const handleSendEmails = async () => {
    if (!emailList.length) return;
    if (!subject.trim() || !body.trim()) { toast.error("Completa el asunto y el mensaje"); return; }
    setSending(true);
    setResults(null);
    let sent = 0, failed = 0, errors = [];
    for (const customer of emailList) {
      try {
        await sendEmail({
          to_email: customer.email,
          subject: applyVars(subject, customer, tallerName),
          body_html: buildHtml(body, customer.name || "Cliente", tallerName),
          from_name: tallerName,
          metadata: { type: "bulk_offer", filter, customer_id: customer.id },
        });
        sent++;
      } catch (e) {
        failed++;
        errors.push(`${customer.name || customer.email}: ${e.message}`);
      }
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 120));
    }
    setSending(false);
    setResults({ sent, failed, errors });
    if (sent > 0) toast.success(`✅ ${sent} email${sent !== 1 ? "s" : ""} enviado${sent !== 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} fallaron`);
  };

  // ── Copy message ─────────────────────────────────────────────────────────
  const handleCopyMessage = () => {
    navigator.clipboard?.writeText(body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ y: 60, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", damping: 24, stiffness: 280 }}
          className="w-full sm:max-w-xl bg-[#0e0e0e] border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.07] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-pink-600 flex items-center justify-center shadow-lg">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-black text-base">Enviar Oferta Masiva</h2>
                <p className="text-white/30 text-[11px]">{filtered.length} clientes · {emailList.length} emails · {waAll.length} WhatsApp</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* ── Filtro ── */}
            <div>
              <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-2">Destinatarios</p>
              <div className="flex flex-col gap-1.5">
                {FILTERS.map(f => {
                  const count = f.id === "all" ? customers.length
                    : f.id === "vip" ? customers.filter(c => (c.total_orders || 0) >= 3).length
                    : customers.filter(c => isInactive(c, 3)).length;
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setFilter(f.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${
                        filter === f.id
                          ? "border-blue-500/50 bg-blue-500/10"
                          : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]"
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${filter === f.id ? "text-blue-400" : "text-white/30"}`} />
                      <span className={`flex-1 text-sm font-bold ${filter === f.id ? "text-white" : "text-white/50"}`}>{f.label}</span>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-full ${filter === f.id ? "bg-blue-500/20 text-blue-300" : "bg-white/5 text-white/30"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Asunto (solo email) ── */}
            <div>
              <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest mb-2">Asunto del email</p>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Asunto del email..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-blue-500/40 transition-colors"
              />
            </div>

            {/* ── Mensaje ── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/40 text-[11px] font-bold uppercase tracking-widest">Mensaje</p>
                <div className="flex gap-1.5">
                  {["{{nombre}}", "{{taller}}", "{{telefono}}"].map(v => (
                    <button
                      key={v}
                      onClick={() => insertVar(v)}
                      className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 text-[10px] font-mono transition-colors"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={6}
                placeholder="Escribe tu mensaje..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-blue-500/40 transition-colors resize-none font-mono"
              />
              <p className="text-white/20 text-[10px] mt-1 px-1">Haz clic en una variable para insertarla en el cursor</p>
            </div>

            {/* ── Tabs: Email / WhatsApp ── */}
            <div>
              <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-1 mb-3">
                <button
                  onClick={() => setTab("email")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all ${
                    tab === "email" ? "bg-blue-600 text-white shadow" : "text-white/30 hover:text-white/60"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${tab === "email" ? "bg-white/20" : "bg-white/5"}`}>{emailList.length}</span>
                </button>
                <button
                  onClick={() => setTab("whatsapp")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-black transition-all ${
                    tab === "whatsapp" ? "bg-green-600 text-white shadow" : "text-white/30 hover:text-white/60"
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${tab === "whatsapp" ? "bg-white/20" : "bg-white/5"}`}>{waAll.length}</span>
                </button>
              </div>

              {/* Email tab */}
              {tab === "email" && (
                <div className="space-y-3">
                  {emailList.length === 0 ? (
                    <div className="text-center py-8 text-white/20">
                      <Mail className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Ningún cliente con email en este filtro</p>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                        {emailList.map(c => (
                          <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03]">
                            <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-300 text-xs font-black shrink-0">
                              {(c.name || "?")[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-xs font-bold truncate">{c.name || "Sin nombre"}</p>
                              <p className="text-white/30 text-[10px] truncate">{c.email}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Results */}
                      {results && (
                        <div className={`rounded-2xl px-4 py-3 ${results.failed === 0 ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
                          <div className="flex items-center gap-2">
                            {results.failed === 0
                              ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                              : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
                            <p className="text-sm font-bold text-white">
                              {results.sent} enviados{results.failed > 0 ? `, ${results.failed} fallaron` : " ✓"}
                            </p>
                          </div>
                          {results.errors.length > 0 && (
                            <div className="mt-2 space-y-0.5">
                              {results.errors.map((e, i) => <p key={i} className="text-amber-300/60 text-[10px] font-mono">{e}</p>)}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* WhatsApp tab */}
              {tab === "whatsapp" && (
                <div className="space-y-3">
                  {waAll.length === 0 ? (
                    <div className="text-center py-8 text-white/20">
                      <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Ningún cliente con teléfono en este filtro</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopyMessage}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-colors text-xs font-bold text-white/50 hover:text-white/80"
                        >
                          {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? "Copiado" : "Copiar mensaje"}
                        </button>
                        <p className="text-white/20 text-[10px]">Abre cada contacto para enviar</p>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {waAll.map(c => {
                          const msg = applyVars(body, c, tallerName);
                          return (
                            <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                              <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-green-300 text-xs font-black shrink-0">
                                {(c.name || "?")[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-xs font-bold truncate">{c.name || "Sin nombre"}</p>
                                <p className="text-white/30 text-[10px]">{c.phone}</p>
                              </div>
                              <a
                                href={getWhatsAppUrl(c.phone, msg)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-[11px] font-black transition-colors shrink-0"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Enviar
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 pb-5 pt-3 border-t border-white/[0.07] shrink-0">
            {tab === "email" ? (
              <button
                onClick={handleSendEmails}
                disabled={sending || emailList.length === 0}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm transition-all active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30"
              >
                {sending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-4 h-4" /> Enviar {emailList.length} email{emailList.length !== 1 ? "s" : ""}</>
                )}
              </button>
            ) : (
              <div className="text-center text-white/30 text-xs">
                Toca <strong className="text-white/50">Enviar</strong> en cada contacto para abrir WhatsApp con el mensaje listo
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
