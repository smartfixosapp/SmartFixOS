import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";
import {
  Save, Loader2, Receipt, ShieldCheck, FileText,
  Info, Eye, EyeOff, Monitor, Smartphone, Mail
} from "lucide-react";

const SLUG = "pos-receipt-config";

const DEFAULTS = {
  warranty_text: "",
  conditions_text: "",
  footer_text: "",
  show_hours: false,
  send_email: true,
  send_whatsapp: true,
  send_print: true,
  email_from_name: "",
  email_subject_sale: "🧾 Tu recibo de venta #{number}",
  email_subject_order: "🔧 Tu orden de reparación #{number}",
};

// ── Mock sale para la vista previa ────────────────────────────────────────────
const MOCK_SALE = {
  sale_number: "S-2026-0042",
  created_date: new Date().toISOString(),
  employee: "Carlos Pérez",
  payment_method: "card",
  subtotal: 174.78,
  tax_amount: 20.10,
  total: 194.88,
  discount_amount: 0,
  items: [
    { name: "iPhone 14 – Pantalla LCD", price: 149.99, quantity: 1 },
    { name: "Protector de Vidrio", price: 14.99, quantity: 1 },
    { name: "Limpieza General", price: 9.80, quantity: 1 },
  ],
};

const MOCK_CUSTOMER = { name: "Francis Reyes", phone: "787-555-1234" };

// ── Componente de vista previa del recibo ────────────────────────────────────
function ReceiptPreview({ config, bizInfo }) {
  const hasTerms = config.warranty_text || config.conditions_text;
  const footer = config.footer_text || "¡Gracias por su compra!";

  const payLabel =
    MOCK_SALE.payment_method === "card" ? "💳 Tarjeta" :
    MOCK_SALE.payment_method === "cash" ? "💵 Efectivo" : "📱 ATH Móvil";

  return (
    <div style={{
      fontFamily: "'Courier New', monospace",
      fontSize: "9pt",
      lineHeight: "1.35",
      color: "#000",
      background: "#fff",
      padding: "8mm 6mm",
      width: "72mm",
      boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
      borderRadius: "4px",
      margin: "0 auto",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "4mm" }}>
        {bizInfo.logo_url && (
          <img src={bizInfo.logo_url} alt="Logo" style={{ maxWidth: "40mm", maxHeight: "12mm", margin: "0 auto 2mm", display: "block" }} />
        )}
        <div style={{ fontSize: "12pt", fontWeight: "bold", letterSpacing: "1px" }}>
          {bizInfo.name || "Mi Taller"}
        </div>
        {bizInfo.address && <div style={{ fontSize: "7.5pt", color: "#444" }}>{bizInfo.address}</div>}
        {bizInfo.phone && <div style={{ fontSize: "7.5pt", color: "#444" }}>{bizInfo.phone}</div>}
        <div style={{ fontSize: "8pt", marginTop: "1.5mm" }}>RECIBO DE VENTA</div>
        <div style={{ fontSize: "7.5pt", marginTop: "0.5mm", color: "#555" }}>
          {new Date().toLocaleDateString("es-PR", { day: "numeric", month: "long", year: "numeric" })}
        </div>
      </div>

      <div style={{ borderTop: "2px dashed #000", marginBottom: "3mm" }} />

      {/* Recibo # */}
      <div style={{ textAlign: "center", marginBottom: "3mm" }}>
        <div style={{ fontSize: "7pt", color: "#555" }}>Recibo No.</div>
        <div style={{ fontSize: "10.5pt", fontWeight: "bold" }}>{MOCK_SALE.sale_number}</div>
      </div>

      <div style={{ borderTop: "1px solid #000", marginBottom: "3mm" }} />

      {/* Cliente */}
      <div style={{ marginBottom: "3mm" }}>
        <div style={{ fontSize: "8.5pt", fontWeight: "bold" }}>CLIENTE:</div>
        <div style={{ fontSize: "8.5pt" }}>{MOCK_CUSTOMER.name}</div>
        <div style={{ fontSize: "8pt", color: "#444" }}>{MOCK_CUSTOMER.phone}</div>
      </div>

      {/* Artículos */}
      <div style={{ marginBottom: "3mm" }}>
        <div style={{ fontSize: "8.5pt", fontWeight: "bold", marginBottom: "2mm" }}>ARTÍCULOS:</div>
        {MOCK_SALE.items.map((item, i) => (
          <div key={i} style={{ marginBottom: "1.5mm" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8.5pt", fontWeight: "bold" }}>
              <span style={{ flex: 1, marginRight: "4mm" }}>{item.name}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
            <div style={{ fontSize: "7.5pt", fontWeight: "bold", color: "#333" }}>
              {item.quantity} x ${item.price.toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px solid #000", marginBottom: "3mm" }} />

      {/* Totales */}
      <div style={{ fontSize: "8.5pt", fontWeight: "bold" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1mm" }}>
          <span>Subtotal:</span><span>${MOCK_SALE.subtotal.toFixed(2)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1mm" }}>
          <span>IVU (11.5%):</span><span>${MOCK_SALE.tax_amount.toFixed(2)}</span>
        </div>
        <div style={{ borderTop: "2px solid #000", paddingTop: "2mm", marginTop: "2mm" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11pt", fontWeight: "bold" }}>
            <span>TOTAL:</span><span>${MOCK_SALE.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Pago */}
      <div style={{ marginTop: "3mm", marginBottom: "3mm" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8.5pt" }}>
          <span>Método:</span>
          <span style={{ fontWeight: "bold" }}>{payLabel}</span>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: "2px dashed #000", paddingTop: "3mm", marginTop: "3mm", textAlign: "center" }}>
        <div style={{ fontSize: "8pt", fontWeight: "bold" }}>{footer}</div>
        <div style={{ fontSize: "7pt", marginTop: "2mm", color: "#555" }}>
          Atendido por: {MOCK_SALE.employee}
        </div>
      </div>

      {/* Términos y condiciones */}
      {hasTerms && (
        <div style={{ borderTop: "1px solid #000", paddingTop: "3mm", marginTop: "3mm" }}>
          <div style={{ fontSize: "7.5pt", fontWeight: "bold", textAlign: "center", marginBottom: "2mm" }}>
            TÉRMINOS Y CONDICIONES
          </div>
          {config.warranty_text && (
            <div style={{ fontSize: "7pt", whiteSpace: "pre-wrap", lineHeight: "1.4", marginBottom: "2mm" }}>
              {config.warranty_text}
            </div>
          )}
          {config.conditions_text && (
            <div style={{ fontSize: "7pt", whiteSpace: "pre-wrap", lineHeight: "1.4" }}>
              {config.conditions_text}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-[24px] p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
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
        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-cyan-500" : "bg-white/10"}`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}

function FieldLabel({ label, hint }) {
  return (
    <div className="mb-1">
      <p className="text-white/70 text-xs font-bold uppercase tracking-wide">{label}</p>
      {hint && <p className="text-white/30 text-xs mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function POSReceiptTab() {
  const [config, setConfig] = useState(DEFAULTS);
  const [settingId, setSettingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bizInfo, setBizInfo] = useState({});
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    Promise.all([
      dataClient.entities.AppSettings.filter({ slug: SLUG }),
      dataClient.entities.AppSettings.filter({ slug: "business-info" }),
      dataClient.entities.AppSettings.filter({ slug: "business-branding" }),
    ]).then(([receiptRes, bizRes, brandingRes]) => {
      if (receiptRes?.[0]) {
        setSettingId(receiptRes[0].id);
        const merged = { ...DEFAULTS, ...receiptRes[0].payload };
        setConfig(merged);
        localStorage.setItem("pos_receipt_config", JSON.stringify(merged));
      }
      const info = bizRes?.[0]?.payload || {};
      const branding = brandingRes?.[0]?.payload || {};
      setBizInfo({
        name: info.name || branding.business_name || "",
        address: info.address || "",
        phone: info.phone || "",
        logo_url: branding.logo_url || "",
      });
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
    <div className="space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-black text-base">Plantilla de Recibo POS</h2>
          <p className="text-white/40 text-xs mt-0.5">Los cambios se reflejan en la vista previa al instante</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 text-xs font-bold hover:bg-white/10 transition-colors"
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showPreview ? "Ocultar preview" : "Ver preview"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-xs shadow-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>

      {/* Business info banner */}
      {(bizInfo.name || bizInfo.address || bizInfo.phone) && (
        <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl px-4 py-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
          <p className="text-cyan-300/70 text-xs">
            El recibo incluirá automáticamente: <strong>{bizInfo.name}</strong>
            {bizInfo.address ? `, ${bizInfo.address}` : ""}
            {bizInfo.phone ? `, ${bizInfo.phone}` : ""}.
            Edita en <em>Info del Negocio</em>.
          </p>
        </div>
      )}

      {/* Layout principal: editor + preview */}
      <div className={`flex gap-6 ${showPreview ? "items-start" : ""}`}>

        {/* ── Panel izquierdo: editor ────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          <Section icon={ShieldCheck} title="Texto de Garantía">
            <FieldLabel label="Garantía" hint="Aparece en el recibo después del total" />
            <textarea
              rows={3}
              placeholder="Ej: Garantía de 30 días en mano de obra. Partes sujetas a disponibilidad..."
              value={config.warranty_text}
              onChange={e => set("warranty_text", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:outline-none focus:border-cyan-500/50"
            />
          </Section>

          <Section icon={FileText} title="Condiciones de Venta">
            <FieldLabel label="Condiciones" hint="Política de devoluciones u otras condiciones" />
            <textarea
              rows={3}
              placeholder="Ej: No se aceptan devoluciones después de 7 días. Guarda tu recibo..."
              value={config.conditions_text}
              onChange={e => set("conditions_text", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm resize-none focus:outline-none focus:border-cyan-500/50"
            />
          </Section>

          <Section icon={Receipt} title="Pie de Página">
            <FieldLabel label="Mensaje final" hint="Texto de cierre del recibo" />
            <input
              type="text"
              placeholder="Ej: ¡Gracias por tu preferencia! Visítanos de nuevo."
              value={config.footer_text}
              onChange={e => set("footer_text", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </Section>

          <Section icon={Mail} title="Configuración de Email">
            <FieldLabel label="Nombre del remitente" hint="Aparece como 'De:' en el correo" />
            <input
              type="text"
              placeholder="Ej: 911 Smart Fix"
              value={config.email_from_name}
              onChange={e => set("email_from_name", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <FieldLabel label="Asunto email — Venta" hint="Usa {number} para el número de recibo" />
            <input
              type="text"
              placeholder="🧾 Tu recibo de venta #{number}"
              value={config.email_subject_sale}
              onChange={e => set("email_subject_sale", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-cyan-500/50"
            />
            <FieldLabel label="Asunto email — Orden" hint="Usa {number} para el número de orden" />
            <input
              type="text"
              placeholder="🔧 Tu orden de reparación #{number}"
              value={config.email_subject_order}
              onChange={e => set("email_subject_order", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </Section>

          <Section icon={Receipt} title="Métodos de Envío Disponibles">
            <p className="text-white/40 text-xs -mt-1 mb-1">Elige qué opciones aparecen al finalizar una venta.</p>
            <div className="space-y-4">
              <Toggle label="Email" sublabel="Envío de recibo por correo electrónico" checked={config.send_email} onChange={v => set("send_email", v)} />
              <Toggle label="WhatsApp" sublabel="Abrir conversación con el recibo" checked={config.send_whatsapp} onChange={v => set("send_whatsapp", v)} />
              <Toggle label="Imprimir" sublabel="Impresora térmica o regular" checked={config.send_print} onChange={v => set("send_print", v)} />
            </div>
          </Section>

          {/* Save bottom */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black text-sm shadow-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Guardando..." : "Guardar Configuración"}
          </button>
        </div>

        {/* ── Panel derecho: vista previa ───────────────────────────── */}
        {showPreview && (
          <div className="w-[320px] flex-shrink-0">
            <div className="sticky top-4">
              <div className="flex items-center gap-2 mb-3">
                <Monitor className="w-4 h-4 text-white/40" />
                <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Vista Previa — Recibo 80mm</span>
              </div>
              <div className="bg-[#1a1a1f] border border-white/10 rounded-[20px] p-4 overflow-auto max-h-[80vh]">
                <ReceiptPreview config={config} bizInfo={bizInfo} />
              </div>
              <p className="text-white/25 text-[10px] text-center mt-2">Datos de ejemplo — el recibo real usará la venta actual</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
