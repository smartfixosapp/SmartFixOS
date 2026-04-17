import React, { useState } from "react";
import { X, MessageSquarePlus, Lightbulb, Bug, HelpCircle, Send, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "../../../../../lib/supabase-client.js";
import { toast } from "sonner";

const TYPES = [
  { id: "suggestion", label: "Sugerencia",  icon: Lightbulb,          color: "text-apple-yellow border-apple-yellow/30 bg-apple-yellow/12"  },
  { id: "bug",        label: "Problema",    icon: Bug,                 color: "text-apple-red    border-apple-red/30    bg-apple-red/12"    },
  { id: "question",   label: "Pregunta",    icon: HelpCircle,          color: "text-apple-blue   border-apple-blue/30   bg-apple-blue/12"   },
  { id: "other",      label: "Otro",        icon: MessageSquarePlus,   color: "text-apple-purple border-apple-purple/30 bg-apple-purple/12" },
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
            <h2 style="margin:0 0 8px;font-size:22px">Nuevo Feedback — SmartFixOS</h2>
            <p style="color:#888;margin:0 0 24px;font-size:13px">${new Date().toLocaleString("es", { timeZone: "America/Puerto_Rico" })}</p>
            <div style="background:#ffffff10;border-radius:12px;padding:20px;margin-bottom:20px">
              <p style="margin:0 0 6px;font-size:12px;color:#888">Tienda</p>
              <p style="margin:0;font-size:16px;font-weight:600">${tenantName}</p>
              ${tenantEmail ? `<p style="margin:4px 0 0;font-size:13px;color:#aaa">${tenantEmail}</p>` : ""}
            </div>
            <div style="background:#ffffff10;border-radius:12px;padding:20px;margin-bottom:20px">
              <p style="margin:0 0 6px;font-size:12px;color:#888">Tipo</p>
              <p style="margin:0;font-size:15px;font-weight:600">${typeLabel}</p>
            </div>
            <div style="background:#ffffff10;border-radius:12px;padding:20px;margin-bottom:20px">
              <p style="margin:0 0 6px;font-size:12px;color:#888">Título</p>
              <p style="margin:0;font-size:18px;font-weight:700">${title.trim()}</p>
            </div>
            <div style="background:#ffffff10;border-radius:12px;padding:20px">
              <p style="margin:0 0 6px;font-size:12px;color:#888">Mensaje</p>
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
    <div className="apple-type fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full sm:max-w-lg apple-surface-elevated rounded-t-apple-lg sm:rounded-apple-lg shadow-apple-xl border-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: '0.5px solid rgb(var(--separator) / 0.29)' }}>
          <div className="w-10 h-10 rounded-apple-sm bg-apple-blue/15 flex items-center justify-center flex-shrink-0">
            <MessageSquarePlus className="w-5 h-5 text-apple-blue" />
          </div>
          <div className="flex-1">
            <h2 className="apple-label-primary apple-text-headline">Enviar Feedback</h2>
            <p className="apple-label-tertiary apple-text-caption1">Tu opinión nos ayuda a mejorar</p>
          </div>
          <button onClick={onClose} className="apple-label-tertiary hover:apple-label-primary transition-colors p-1 apple-press">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          /* ── Success state ── */
          <div className="px-6 py-12 text-center">
            <div className="w-20 h-20 rounded-full bg-apple-green/15 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-apple-green" />
            </div>
            <h3 className="apple-label-primary apple-text-title2 mb-2">¡Gracias por tu feedback!</h3>
            <p className="apple-label-tertiary apple-text-subheadline max-w-xs mx-auto mb-6">
              Recibimos tu mensaje. Lo revisaremos y tomaremos en cuenta para mejorar SmartFixOS.
            </p>
            <button
              onClick={onClose}
              className="apple-btn apple-btn-secondary apple-press"
            >
              Cerrar
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

            {/* Type selector */}
            <div>
              <p className="apple-text-footnote apple-label-secondary mb-3">Tipo</p>
              <div className="grid grid-cols-4 gap-2">
                {TYPES.map(t => {
                  const Icon = t.icon;
                  const active = type === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setType(t.id)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-apple-md text-center transition-all apple-press ${
                        active
                          ? t.color
                          : "bg-gray-sys6 dark:bg-gray-sys5 apple-label-tertiary"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="apple-text-caption2">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="apple-text-footnote apple-label-secondary block mb-2">
                Título *
              </label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Resumen breve..."
                maxLength={120}
                required
                className="apple-input w-full"
              />
            </div>

            {/* Message */}
            <div>
              <label className="apple-text-footnote apple-label-secondary block mb-2">
                Descripción *
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Cuéntanos con detalle tu sugerencia, problema o pregunta..."
                maxLength={1000}
                required
                rows={4}
                className="apple-input w-full resize-none"
              />
              <p className="text-right apple-text-caption2 apple-label-tertiary mt-1 tabular-nums">{message.length}/1000</p>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !title.trim() || !message.trim()}
              className="apple-btn apple-btn-primary apple-btn-lg apple-press w-full flex items-center justify-center gap-2"
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
