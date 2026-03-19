import React, { useState } from "react";
import { X, MessageSquarePlus, Lightbulb, Bug, HelpCircle, Send, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { toast } from "sonner";

const TYPES = [
  { id: "suggestion", label: "Sugerencia",  icon: Lightbulb,          color: "text-amber-400  border-amber-400/30  bg-amber-400/10"  },
  { id: "bug",        label: "Problema",    icon: Bug,                 color: "text-red-400    border-red-400/30    bg-red-400/10"    },
  { id: "question",   label: "Pregunta",    icon: HelpCircle,          color: "text-cyan-400   border-cyan-400/30   bg-cyan-400/10"   },
  { id: "other",      label: "Otro",        icon: MessageSquarePlus,   color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
];

const ADMIN_EMAIL    = "smartfixosapp@gmail.com";
const SEND_EMAIL_URL = "/api/send-email";

export default function FeedbackModal({ onClose }) {
  const [type,     setType]     = useState("suggestion");
  const [title,    setTitle]    = useState("");
  const [message,  setMessage]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);

  const tenantId    = localStorage.getItem("smartfix_tenant_id")    || null;
  const tenantName  = localStorage.getItem("smartfix_business_name") || "Tienda desconocida";
  const tenantEmail = localStorage.getItem("smartfix_tenant_email")  || "";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Completa el título y el mensaje");
      return;
    }

    setLoading(true);
    try {
      // 1. Guardar en Supabase
      const { error: dbError } = await supabase.from("feedback").insert({
        tenant_id:    tenantId,
        tenant_name:  tenantName,
        tenant_email: tenantEmail,
        type,
        title:   title.trim(),
        message: message.trim(),
        status:  "pending",
      });
      if (dbError) console.warn("[Feedback] DB error:", dbError.message);

      // 2. Enviar email al admin
      const typeLabel = TYPES.find(t => t.id === type)?.label || type;
      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#111">
          <div style="background:#0f0f18;border-radius:16px;padding:32px;color:#fff">
            <h2 style="margin:0 0 8px;font-size:22px">📬 Nuevo Feedback — SmartFixOS</h2>
            <p style="color:#888;margin:0 0 24px;font-size:13px">${new Date().toLocaleString("es", { timeZone: "America/Puerto_Rico" })}</p>
            <div style="background:#ffffff10;border-radius:12px;padding:20px;margin-bottom:20px">
              <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#888">Tienda</p>
              <p style="margin:0;font-size:16px;font-weight:700">${tenantName}</p>
              ${tenantEmail ? `<p style="margin:4px 0 0;font-size:13px;color:#aaa">${tenantEmail}</p>` : ""}
            </div>
            <div style="background:#ffffff10;border-radius:12px;padding:20px;margin-bottom:20px">
              <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#888">Tipo</p>
              <p style="margin:0;font-size:15px;font-weight:600">${typeLabel}</p>
            </div>
            <div style="background:#ffffff10;border-radius:12px;padding:20px;margin-bottom:20px">
              <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#888">Título</p>
              <p style="margin:0;font-size:18px;font-weight:800">${title.trim()}</p>
            </div>
            <div style="background:#ffffff10;border-radius:12px;padding:20px">
              <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#888">Mensaje</p>
              <p style="margin:0;font-size:15px;line-height:1.6;white-space:pre-wrap">${message.trim()}</p>
            </div>
          </div>
        </div>
      `;

      await fetch(SEND_EMAIL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to:      ADMIN_EMAIL,
          subject: `[SmartFixOS Feedback] ${typeLabel}: ${title.trim()} — ${tenantName}`,
          html,
        }),
      });

      setSuccess(true);
    } catch (e) {
      console.error("[Feedback] Error:", e);
      toast.error("Error al enviar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg bg-[#0f0f18] border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/[0.07]">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <MessageSquarePlus className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-white font-black text-base">Enviar Feedback</h2>
            <p className="text-gray-500 text-xs">Tu opinión nos ayuda a mejorar</p>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          /* ── Success state ── */
          <div className="px-6 py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-white font-black text-xl mb-2">¡Gracias por tu feedback!</h3>
            <p className="text-gray-400 text-sm max-w-xs mx-auto mb-6">
              Recibimos tu mensaje. Lo revisaremos y tomaremos en cuenta para mejorar SmartFixOS.
            </p>
            <button
              onClick={onClose}
              className="px-8 py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-all"
            >
              Cerrar
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

            {/* Type selector */}
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-3">Tipo</p>
              <div className="grid grid-cols-4 gap-2">
                {TYPES.map(t => {
                  const Icon = t.icon;
                  const active = type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border text-center transition-all ${
                        active
                          ? t.color
                          : "border-white/10 bg-white/[0.03] text-gray-500 hover:border-white/20"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px] font-semibold leading-tight">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-2">
                Título *
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Resumen breve..."
                maxLength={120}
                required
                className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
              />
            </div>

            {/* Message */}
            <div>
              <label className="text-xs text-gray-500 font-semibold uppercase tracking-wider block mb-2">
                Descripción *
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Cuéntanos con detalle tu sugerencia, problema o pregunta..."
                maxLength={1000}
                required
                rows={4}
                className="w-full bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-3 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all resize-none"
              />
              <p className="text-right text-[11px] text-gray-600 mt-1">{message.length}/1000</p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !title.trim() || !message.trim()}
              className="w-full h-12 rounded-2xl bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 disabled:opacity-30 text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(6,182,212,0.25)]"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                : <><Send className="w-4 h-4" /> Enviar Feedback</>
              }
            </button>

          </form>
        )}
      </div>
    </div>
  );
}
