import React, { useState, useEffect } from "react";
import { dataClient } from "@/components/api/dataClient";
import { toast } from "sonner";
import {
  Save, Loader2, Receipt, ShieldCheck, FileText,
  Info, Eye, EyeOff, Monitor, Mail
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

// ── Preview del email ─────────────────────────────────────────────────────────
function EmailPreview({ config, bizInfo }) {
  const fromName = config.email_from_name || bizInfo.name || "SmartFixOS";
  const subject = (config.email_subject_sale || "🧾 Tu recibo de venta #{number}").replace("#{number}", "S-2026-0042");
  const dateStr = new Date().toLocaleDateString("es-PR", { day: "numeric", month: "long", year: "numeric" });
  const logo = bizInfo.logo_url;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#0F0F12;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:16px 12px;">
    <div style="background:linear-gradient(135deg,#0891b2 0%,#059669 60%,#65a30d 100%);border-radius:20px 20px 0 0;padding:32px 28px;text-align:center;">
      ${logo ? `<img src="${logo}" alt="Logo" style="max-height:48px;max-width:140px;margin:0 auto 14px;display:block;filter:brightness(0) invert(1);" onerror="this.style.display='none'" />` : ''}
      <h1 style="margin:0;color:white;font-size:20px;font-weight:800;letter-spacing:-0.3px;">🧾 Recibo de Venta</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">${fromName}</p>
    </div>
    <div style="background:#1a1a2e;border-left:1px solid rgba(255,255,255,0.08);border-right:1px solid rgba(255,255,255,0.08);padding:24px 28px;">
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-left:4px solid #0891b2;border-radius:12px;padding:16px 18px;margin-bottom:20px;">
        <div style="color:rgba(255,255,255,0.4);font-size:10px;text-transform:uppercase;letter-spacing:1px;">NÚMERO DE RECIBO</div>
        <div style="color:white;font-size:20px;font-weight:800;margin:4px 0 6px;">S-2026-0042</div>
        <div style="color:rgba(255,255,255,0.5);font-size:12px;">📅 ${dateStr}</div>
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;margin-top:10px;">
          <div style="color:white;font-weight:700;font-size:14px;">👤 Francis Reyes</div>
          <div style="color:rgba(255,255,255,0.5);font-size:12px;margin-top:3px;">📞 787-555-1234</div>
        </div>
      </div>
      <div style="margin-bottom:18px;">
        <div style="color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">ARTÍCULOS</div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:rgba(255,255,255,0.05);">
              <th style="padding:8px 10px;text-align:left;color:rgba(255,255,255,0.5);font-size:10px;font-weight:600;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Artículo</th>
              <th style="padding:8px 6px;text-align:center;color:rgba(255,255,255,0.5);font-size:10px;font-weight:600;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Cant.</th>
              <th style="padding:8px 10px;text-align:right;color:rgba(255,255,255,0.5);font-size:10px;font-weight:600;text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.08);">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding:9px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.9);font-size:13px;">iPhone 14 – Pantalla LCD</td><td style="padding:9px 6px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:center;color:rgba(255,255,255,0.5);font-size:12px;">1</td><td style="padding:9px 10px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;color:#34d399;font-weight:700;font-size:13px;">$149.99</td></tr>
            <tr><td style="padding:9px 10px;border-bottom:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.9);font-size:13px;">Protector de Vidrio</td><td style="padding:9px 6px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:center;color:rgba(255,255,255,0.5);font-size:12px;">1</td><td style="padding:9px 10px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;color:#34d399;font-weight:700;font-size:13px;">$14.99</td></tr>
            <tr><td style="padding:9px 10px;color:rgba(255,255,255,0.9);font-size:13px;">Limpieza General</td><td style="padding:9px 6px;text-align:center;color:rgba(255,255,255,0.5);font-size:12px;">1</td><td style="padding:9px 10px;text-align:right;color:#34d399;font-weight:700;font-size:13px;">$9.80</td></tr>
          </tbody>
        </table>
      </div>
      <div style="background:rgba(5,150,105,0.1);border:1px solid rgba(5,150,105,0.3);border-radius:12px;padding:16px 18px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;color:rgba(255,255,255,0.6);font-size:13px;"><span>Subtotal</span><span>$174.78</span></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:10px;color:rgba(255,255,255,0.6);font-size:13px;"><span>IVU (11.5%)</span><span>$20.10</span></div>
        <div style="border-top:2px solid rgba(5,150,105,0.5);padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
          <span style="color:white;font-size:17px;font-weight:800;">TOTAL</span>
          <span style="color:#34d399;font-size:26px;font-weight:800;">$194.88</span>
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;margin-top:8px;display:flex;justify-content:space-between;color:rgba(255,255,255,0.5);font-size:12px;">
          <span>Método de pago</span><span style="color:rgba(255,255,255,0.8);font-weight:600;">💳 Tarjeta</span>
        </div>
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-top:none;border-radius:0 0 20px 20px;padding:20px 28px;text-align:center;">
      <p style="margin:0 0 3px;color:rgba(255,255,255,0.6);font-size:13px;font-weight:600;">${fromName}</p>
      ${bizInfo.phone ? `<p style="margin:0 0 3px;color:rgba(255,255,255,0.4);font-size:11px;">📞 ${bizInfo.phone}</p>` : ''}
      <p style="margin:10px 0 0;color:rgba(255,255,255,0.25);font-size:10px;">Powered by SmartFixOS</p>
    </div>
  </div>
</body>
</html>`;

  return (
    <iframe
      srcDoc={html}
      title="Email Preview"
      style={{ width: "100%", height: "620px", border: "none", borderRadius: "12px", display: "block" }}
    />
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
  const [previewTab, setPreviewTab] = useState("receipt"); // "receipt" | "email"

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
          <div className="w-[340px] flex-shrink-0">
            <div className="sticky top-4">
              {/* Tab switcher */}
              <div className="flex items-center gap-1 mb-3 bg-white/5 border border-white/10 rounded-2xl p-1">
                <button
                  onClick={() => setPreviewTab("receipt")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    previewTab === "receipt"
                      ? "bg-white/10 text-white shadow"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Recibo 80mm
                </button>
                <button
                  onClick={() => setPreviewTab("email")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    previewTab === "email"
                      ? "bg-white/10 text-white shadow"
                      : "text-white/40 hover:text-white/60"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </button>
              </div>

              {previewTab === "receipt" ? (
                <>
                  <div className="bg-[#1a1a1f] border border-white/10 rounded-[20px] p-4 overflow-auto max-h-[80vh]">
                    <ReceiptPreview config={config} bizInfo={bizInfo} />
                  </div>
                  <p className="text-white/25 text-[10px] text-center mt-2">Datos de ejemplo — el recibo real usará la venta actual</p>
                </>
              ) : (
                <>
                  <div className="bg-[#0F0F12] border border-white/10 rounded-[20px] overflow-hidden">
                    <EmailPreview config={config} bizInfo={bizInfo} />
                  </div>
                  <p className="text-white/25 text-[10px] text-center mt-2">Vista previa del email — datos de ejemplo</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
