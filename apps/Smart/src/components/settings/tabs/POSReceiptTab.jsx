import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";
import { Save, Loader2, Receipt, ShieldCheck, FileText, Star, Clock, Info } from "lucide-react";

const SLUG = "pos-receipt-config";

const DEFAULTS = {
  warranty_text: "",
  conditions_text: "",
  review_link: "",
  footer_text: "",
  show_hours: false,
  send_email: true,
  send_whatsapp: true,
  send_print: true,
};

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-[24px] p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-white/60" />
        </div>
        <h3 className="text-white font-black text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Toggle({ label, sublabel, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-white text-sm font-bold">{label}</p>
        {sublabel && <p className="text-white/40 text-xs mt-0.5">{sublabel}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-6 rounded-full transition-colors ${checked ? "bg-cyan-500" : "bg-white/10"}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

export default function POSReceiptTab() {
  const [config, setConfig] = useState(DEFAULTS);
  const [settingId, setSettingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bizInfo, setBizInfo] = useState({});

  useEffect(() => {
    Promise.all([
      dataClient.entities.AppSettings.filter({ slug: SLUG }),
      dataClient.entities.AppSettings.filter({ slug: "business-info" }),
    ]).then(([receiptRes, bizRes]) => {
      if (receiptRes?.[0]) {
        setSettingId(receiptRes[0].id);
        setConfig({ ...DEFAULTS, ...receiptRes[0].payload });
        // Sync to localStorage so the modal can read it instantly
        localStorage.setItem("pos_receipt_config", JSON.stringify({ ...DEFAULTS, ...receiptRes[0].payload }));
      }
      if (bizRes?.[0]?.payload) setBizInfo(bizRes[0].payload);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const set = (key, val) => setConfig(p => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (settingId) {
        await dataClient.entities.AppSettings.update(settingId, { payload: config });
      } else {
        const created = await dataClient.entities.AppSettings.create({ slug: SLUG, payload: config });
        if (created?.id) setSettingId(created.id);
      }
      localStorage.setItem("pos_receipt_config", JSON.stringify(config));
      toast.success("✅ Configuración guardada");
    } catch {
      toast.error("Error guardando configuración");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Business info preview */}
      {(bizInfo.name || bizInfo.address || bizInfo.phone) && (
        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <p className="text-cyan-300/80 text-sm">
            El recibo incluirá automáticamente: <strong>{bizInfo.name}</strong>
            {bizInfo.address ? `, ${bizInfo.address}` : ""}
            {bizInfo.phone ? `, ${bizInfo.phone}` : ""}.
            Edita en <em>Info del Negocio</em>.
          </p>
        </div>
      )}

      {/* Garantía */}
      <Section icon={ShieldCheck} title="Texto de Garantía">
        <p className="text-white/40 text-xs">Aparece en el recibo después del total.</p>
        <textarea
          rows={4}
          placeholder="Ej: Garantía de 30 días en mano de obra. Partes sujetas a disponibilidad..."
          value={config.warranty_text}
          onChange={e => set("warranty_text", e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:outline-none focus:border-cyan-500/50"
        />
      </Section>

      {/* Condiciones POS */}
      <Section icon={FileText} title="Condiciones de Venta">
        <p className="text-white/40 text-xs">Política de devoluciones u otras condiciones.</p>
        <textarea
          rows={3}
          placeholder="Ej: No se aceptan devoluciones después de 7 días. Guarda tu recibo..."
          value={config.conditions_text}
          onChange={e => set("conditions_text", e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:outline-none focus:border-cyan-500/50"
        />
      </Section>

      {/* Reseñas */}
      <Section icon={Star} title="Link de Reseña">
        <p className="text-white/40 text-xs">Se añade al final del recibo para invitar al cliente a dejar una reseña.</p>
        <input
          type="url"
          placeholder="https://g.page/r/... (Google Reviews)"
          value={config.review_link}
          onChange={e => set("review_link", e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-cyan-500/50"
        />
      </Section>

      {/* Pie de recibo */}
      <Section icon={Receipt} title="Pie de Página del Recibo">
        <input
          type="text"
          placeholder="Ej: ¡Gracias por tu preferencia! Visítanos de nuevo."
          value={config.footer_text}
          onChange={e => set("footer_text", e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-cyan-500/50"
        />
      </Section>

      {/* Opciones de envío */}
      <Section icon={Receipt} title="Métodos de Envío Disponibles">
        <p className="text-white/40 text-xs mb-2">Elige qué opciones aparecen al finalizar una venta.</p>
        <div className="space-y-4">
          <Toggle
            label="Email"
            sublabel="Envío de recibo por correo electrónico"
            checked={config.send_email}
            onChange={v => set("send_email", v)}
          />
          <Toggle
            label="WhatsApp"
            sublabel="Abrir conversación con el recibo"
            checked={config.send_whatsapp}
            onChange={v => set("send_whatsapp", v)}
          />
          <Toggle
            label="Imprimir"
            sublabel="Impresora térmica o regular"
            checked={config.send_print}
            onChange={v => set("send_print", v)}
          />
        </div>
      </Section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-sm shadow-lg disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? "Guardando..." : "Guardar Configuración"}
      </button>
    </div>
  );
}
