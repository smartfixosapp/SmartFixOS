import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { dataClient } from "@/components/api/dataClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { uploadFile as uploadFileFn } from "@/api/functions";
import {
  Mail, Plus, Edit2, Trash2, Power, PowerOff, Eye,
  Loader2, Save, X, CheckCircle, ChevronDown, ChevronUp, Upload, Send } from
"lucide-react";
import {
  EVENT_TYPES,
  DEFAULT_TEMPLATES,
  buildSystemTemplate,
  mergeTemplatesWithSystemDefaults
} from "@/components/settings/emailTemplateRegistry";

const EMAIL_TEMPLATES_SETTINGS_SLUG = "email-templates-config";

const TEMPLATE_GROUPS = [
  {
    id: 'orders',
    label: 'Órdenes de Trabajo',
    icon: '🔧',
    types: ['intake','diagnosing','awaiting_approval','waiting_parts','pending_order','part_arrived_waiting_device','reparacion_externa','in_progress','ready_for_pickup','picked_up','delivered','cancelled','warranty'],
  },
  {
    id: 'reminders',
    label: 'Recordatorios Automáticos',
    icon: '⏰',
    types: ['pickup_reminder_15','pickup_reminder_3','warranty_check_15','warranty_expired'],
  },
  {
    id: 'payments',
    label: 'Pagos & Ventas',
    icon: '💳',
    types: ['deposit_received','payment_received','sale_completed','refund_processed'],
  },
];

const TEMPLATE_VARIABLES = [
  { key: '{{order_number}}',   desc: 'Número de orden' },
  { key: '{{customer_name}}',  desc: 'Nombre del cliente' },
  { key: '{{device_info}}',    desc: 'Equipo (marca/modelo)' },
  { key: '{{initial_problem}}',desc: 'Problema reportado' },
  { key: '{{amount}}',         desc: 'Total de la orden' },
  { key: '{{balance}}',        desc: 'Balance pendiente' },
  { key: '{{total_paid}}',     desc: 'Total pagado' },
  { key: '{{payment_method}}', desc: 'Método de pago' },
  { key: '{{sale_number}}',    desc: 'Número de venta' },
  { key: '{{days_remaining}}', desc: 'Días restantes' },
  { key: '{{days_elapsed}}',   desc: 'Días transcurridos' },
];

function getHeaderGradient(eventType) {
  const map = {
    intake:                       'linear-gradient(135deg,#10B981 0%,#059669 100%)',
    diagnosing:                   'linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%)',
    awaiting_approval:            'linear-gradient(135deg,#F59E0B 0%,#B45309 100%)',
    waiting_parts:                'linear-gradient(135deg,#F97316 0%,#C2410C 100%)',
    pending_order:                'linear-gradient(135deg,#F59E0B 0%,#92400E 100%)',
    part_arrived_waiting_device:  'linear-gradient(135deg,#0EA5E9 0%,#0369A1 100%)',
    reparacion_externa:           'linear-gradient(135deg,#8B5CF6 0%,#6D28D9 100%)',
    in_progress:                  'linear-gradient(135deg,#3B82F6 0%,#1D4ED8 100%)',
    ready_for_pickup:             'linear-gradient(135deg,#10B981 0%,#047857 100%)',
    pickup_reminder_15:           'linear-gradient(135deg,#F59E0B 0%,#B45309 100%)',
    pickup_reminder_3:            'linear-gradient(135deg,#DC2626 0%,#991B1B 100%)',
    picked_up:                    'linear-gradient(135deg,#059669 0%,#065F46 100%)',
    delivered:                    'linear-gradient(135deg,#059669 0%,#065F46 100%)',
    cancelled:                    'linear-gradient(135deg,#DC2626 0%,#991B1B 100%)',
    warranty:                     'linear-gradient(135deg,#3B82F6 0%,#1E40AF 100%)',
    warranty_check_15:            'linear-gradient(135deg,#10B981 0%,#065F46 100%)',
    warranty_expired:             'linear-gradient(135deg,#6366F1 0%,#3730A3 100%)',
    deposit_received:             'linear-gradient(135deg,#0EA5E9 0%,#0369A1 100%)',
    payment_received:             'linear-gradient(135deg,#10B981 0%,#059669 100%)',
    sale_completed:               'linear-gradient(135deg,#10B981 0%,#065F46 100%)',
    refund_processed:             'linear-gradient(135deg,#F97316 0%,#C2410C 100%)',
  };
  return map[eventType] || 'linear-gradient(135deg,#00A8E8 0%,#10B981 50%,#A8D700 100%)';
}

const EMAIL_TEMPLATE_ALLOWED_FIELDS = [
  "name",
  "event_type",
  "logo_url",
  "header_title",
  "header_subtitle",
  "alert_title",
  "alert_message",
  "main_message",
  "show_next_steps",
  "next_steps_items",
  "show_hours",
  "custom_hours",
  "show_warranty",
  "warranty_type",
  "custom_warranty",
  "show_review_request",
  "review_link",
  "show_checklist",
  "show_photos",
  "show_phone_contact",
  "custom_phone",
  "show_whatsapp_contact",
  "custom_whatsapp",
  "custom_sections",
  "enabled",
  "send_to",
  "is_default"
];

const sanitizeEmailTemplatePayload = (template) => {
  const safe = {};

  for (const key of EMAIL_TEMPLATE_ALLOWED_FIELDS) {
    if (template?.[key] !== undefined) {
      safe[key] = template[key];
    }
  }

  safe.name = String(safe.name || "").trim();
  safe.event_type = String(safe.event_type || "").trim();
  safe.logo_url = String(safe.logo_url || "").trim();
  safe.header_title = String(safe.header_title || "").trim();
  safe.header_subtitle = String(safe.header_subtitle || "").trim();
  safe.alert_title = String(safe.alert_title || "").trim();
  safe.alert_message = String(safe.alert_message || "").trim();
  safe.main_message = String(safe.main_message || "").trim();
  safe.custom_hours = String(safe.custom_hours || "").trim();
  safe.custom_warranty = String(safe.custom_warranty || "").trim();
  safe.review_link = String(safe.review_link || "").trim();
  safe.custom_phone = String(safe.custom_phone || "").trim();
  safe.custom_whatsapp = String(safe.custom_whatsapp || "").trim();

  safe.show_next_steps = !!safe.show_next_steps;
  safe.show_hours = !!safe.show_hours;
  safe.show_warranty = !!safe.show_warranty;
  safe.show_review_request = !!safe.show_review_request;
  safe.show_checklist = !!safe.show_checklist;
  safe.show_photos = !!safe.show_photos;
  safe.show_phone_contact = safe.show_phone_contact !== false;
  safe.show_whatsapp_contact = safe.show_whatsapp_contact !== false;
  safe.enabled = safe.enabled !== false;
  safe.is_default = !!safe.is_default;
  safe.send_to = ["customer", "admin", "both"].includes(safe.send_to) ? safe.send_to : "customer";
  safe.warranty_type = ["sales", "repairs"].includes(safe.warranty_type) ? safe.warranty_type : "repairs";
  safe.next_steps_items = Array.isArray(safe.next_steps_items)
    ? safe.next_steps_items.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  safe.custom_sections = Array.isArray(safe.custom_sections)
    ? safe.custom_sections
        .map((section) => ({
          title: String(section?.title || "").trim(),
          content: String(section?.content || "").trim(),
          style: ["info", "warning", "success", "danger"].includes(section?.style) ? section.style : "info"
        }))
        .filter((section) => section.title || section.content)
    : [];

  return safe;
};

const readFileAsDataUrl = (file) =>
new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ""));
  reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
  reader.readAsDataURL(file);
});

export default function EmailTemplatesTab() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [businessInfo, setBusinessInfo] = useState({});
  const [brandingRecordId, setBrandingRecordId] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [loadWarning, setLoadWarning] = useState("");
  const [openGroups, setOpenGroups] = useState({ orders: false, reminders: false, payments: false });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [customizedTypes, setCustomizedTypes] = useState(new Set());

  const pickUploadUrl = (result) =>
  result?.file_url ||
  result?.url ||
  result?.public_url ||
  result?.signed_url ||
  result?.download_url ||
  "";

  const readTemplateSettings = async () => {
    const configs = await dataClient.entities.AppSettings.filter({ slug: EMAIL_TEMPLATES_SETTINGS_SLUG }).catch(() => []);
    const record = configs?.[0] || null;
    const storedTemplates = Array.isArray(record?.payload?.templates) ? record.payload.templates : [];
    return { record, storedTemplates };
  };

  const writeTemplateSettings = async (templatesToStore) => {
    const payload = { templates: Array.isArray(templatesToStore) ? templatesToStore : [] };
    const { record } = await readTemplateSettings();

    if (record?.id) {
      return dataClient.entities.AppSettings.update(record.id, { payload });
    }

    return dataClient.entities.AppSettings.create({
      slug: EMAIL_TEMPLATES_SETTINGS_SLUG,
      payload
    });
  };

  useEffect(() => {
    const init = async () => {
      await loadBusinessInfo();
      await loadTemplates();
    };
    init();
  }, []);

  const createMissingDefaultTemplates = async () => {
    try {
      const existing = await base44.entities.EmailTemplate.filter({});
      const existingTypes = new Set(existing.map(t => t.event_type));

      const missingEventTypes = Object.keys(DEFAULT_TEMPLATES).filter((eventType) => !existingTypes.has(eventType));

      if (missingEventTypes.length > 0) {
        console.log(`[EmailTemplatesTab] Creando ${missingEventTypes.length} plantillas por defecto...`);
        for (const eventType of missingEventTypes) {
          const templatePayload = buildSystemTemplate(eventType);
          if (!templatePayload) continue;
          const { id, is_system_template, ...createPayload } = templatePayload;
          await base44.entities.EmailTemplate.create(createPayload);
        }
        toast.success(`✅ Se prepararon ${missingEventTypes.length} plantillas del sistema`);
      }
    } catch (error) {
      console.error("Error creating default templates:", error);
    }
  };

  const loadBusinessInfo = async () => {
    try {
      const [configRes, brandingRes] = await Promise.all([
      base44.entities.AppSettings.filter({ slug: "app-main-settings" }),
      base44.entities.AppSettings.filter({ slug: "business-branding" })]
      );

      const config = configRes?.[0]?.payload || {};
      const brandingRecord = brandingRes?.[0] || null;
      const branding = brandingRecord?.payload || {};

      setBrandingRecordId(brandingRecord?.id || null);
      setBusinessInfo({
        business_name: config.business_name || "SmartFixOS",
        phone: config.business_phone || "",
        whatsapp: config.business_whatsapp || "",
        address: config.business_address || "",
        hours_weekdays: config.hours_weekdays || "9:00 AM - 5:00 PM",
        hours_monday: config.hours_monday || "",
        hours_tuesday: config.hours_tuesday || "",
        hours_wednesday: config.hours_wednesday || "",
        hours_thursday: config.hours_thursday || "",
        hours_friday: config.hours_friday || "",
        hours_saturday: config.hours_saturday || "",
        hours_sunday: config.hours_sunday || "",
        google_review_link: config.google_review_link || "",
        logo_url: branding.logo_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png",
        warranty_repairs: branding.warranty_repairs || "",
        warranty_sales: branding.warranty_sales || ""
      });
    } catch (error) {
      console.error("Error loading business info:", error);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { storedTemplates } = await readTemplateSettings();
      if (storedTemplates.length > 0) {
        setTemplates(mergeTemplatesWithSystemDefaults(storedTemplates));
        setCustomizedTypes(new Set(storedTemplates.map(t => t.event_type)));
        setLoadWarning("");
        return;
      }

      const legacyData = await base44.entities.EmailTemplate.filter({}, "-created_date", 100).catch(() => []);
      setTemplates(mergeTemplatesWithSystemDefaults(legacyData || []));
      setCustomizedTypes(new Set((legacyData || []).filter(t => t.id).map(t => t.event_type)));
      setLoadWarning("");
    } catch (error) {
      console.error("Error loading templates:", error);
      setTemplates(mergeTemplatesWithSystemDefaults([]));
      setLoadWarning("");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate.name || !editingTemplate.header_title || !editingTemplate.alert_title) {
      toast.error("Completa los campos requeridos");
      return;
    }

    setLoading(true);
    try {
      const payload = sanitizeEmailTemplatePayload(editingTemplate);
      const { storedTemplates } = await readTemplateSettings();
      const currentTemplates = Array.isArray(storedTemplates) ? [...storedTemplates] : [];
      const nextTemplates = currentTemplates.filter((template) => template?.event_type !== payload.event_type);
      nextTemplates.push(payload);

      await writeTemplateSettings(nextTemplates);
      toast.success("✅ Plantilla guardada");
      setCustomizedTypes(prev => new Set([...prev, payload.event_type]));
      setShowEditor(false);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error(error?.message ? `Error al guardar plantilla: ${error.message}` : "Error al guardar plantilla");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm("¿Eliminar esta plantilla?")) return;

    setLoading(true);
    try {
      const templateToDelete = templates.find((template) => template.id === id);
      if (!templateToDelete?.event_type) {
        throw new Error("No se pudo identificar la plantilla");
      }
      const { storedTemplates } = await readTemplateSettings();
      const nextTemplates = (storedTemplates || []).filter((template) => template?.event_type !== templateToDelete.event_type);
      await writeTemplateSettings(nextTemplates);
      toast.success("✅ Plantilla restablecida al valor del sistema");
      setCustomizedTypes(prev => { const next = new Set(prev); next.delete(templateToDelete.event_type); return next; });
      await loadTemplates();
    } catch (error) {
      toast.error(error?.message ? `Error al eliminar: ${error.message}` : "Error al eliminar");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTemplate = async (template) => {
    setLoading(true);
    try {
      const payload = sanitizeEmailTemplatePayload({
        ...template,
        enabled: !template.enabled
      });
      const { storedTemplates } = await readTemplateSettings();
      const nextTemplates = (storedTemplates || []).filter((row) => row?.event_type !== payload.event_type);
      nextTemplates.push(payload);
      await writeTemplateSettings(nextTemplates);
      toast.success(template.enabled ? "Plantilla desactivada" : "Plantilla activada");
      await loadTemplates();
    } catch (error) {
      toast.error(error?.message ? `Error al actualizar: ${error.message}` : "Error al actualizar");
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;

    const fileType = String(file.type || "").toLowerCase();
    const fileName = String(file.name || "").toLowerCase();
    const looksLikeImage =
    fileType.startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(fileName);

    if (!looksLikeImage) {
      toast.error("Selecciona una imagen válida");
      return;
    }

    if (/\.(heic|heif)$/i.test(fileName) || fileType === "image/heic" || fileType === "image/heif") {
      toast.error("HEIC no es compatible aquí. Usa PNG, JPG o WEBP");
      return;
    }

    // Validar tamaño de imagen (máximo 4MB)
    if (file.size > 4000000) {
      toast.error("El logo debe ser menor a 4MB");
      return;
    }

    setUploadingLogo(true);
    try {
      let uploadedUrl = "";

      try {
        const uploadResult = await uploadFileFn({
          file,
          file_name: file.name || "email-template-logo",
          related_entity_type: "email_template",
          metadata: { source: "email_template_editor" }
        });
        uploadedUrl = pickUploadUrl(uploadResult);
      } catch (functionError) {
        console.warn("Email template logo upload via function failed:", functionError);
      }

      if (!uploadedUrl) {
        try {
          const uploadResult = await base44.integrations.Core.UploadFile({ file });
          uploadedUrl = pickUploadUrl(uploadResult);
        } catch (coreError) {
          console.warn("Email template logo upload via Core failed:", coreError);
        }
      }

      if (!uploadedUrl) {
        if (file.size > 750000) {
          throw new Error("La subida remota falló y el archivo es muy grande para incrustarlo. Usa PNG/JPG menor de 750KB");
        }

        uploadedUrl = await readFileAsDataUrl(file);
        if (!uploadedUrl) {
          throw new Error("La subida no devolvió una URL válida");
        }

        toast.success("Logo preparado en modo embebido");
      } else {
        toast.success("Logo subido correctamente");
      }

      // Guardar en business-branding para que aplique a todas las plantillas
      try {
        if (brandingRecordId) {
          const existing = await base44.entities.AppSettings.filter({ slug: "business-branding" });
          const rec = existing?.[0];
          if (rec) {
            await base44.entities.AppSettings.update(rec.id, {
              payload: { ...rec.payload, logo_url: uploadedUrl }
            });
          }
        } else {
          await base44.entities.AppSettings.create({
            slug: "business-branding",
            payload: { logo_url: uploadedUrl }
          });
        }
      } catch (saveError) {
        console.warn("No se pudo guardar logo en Branding:", saveError);
      }

      setBusinessInfo((prev) => ({ ...prev, logo_url: uploadedUrl }));
    } catch (error) {
      console.error("Error uploading email template logo:", error);
      toast.error(error?.message ? `Error al subir logo: ${error.message}` : "Error al subir logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error("Ingresa un email para la prueba");
      return;
    }

    setSendingTest(true);
    try {
      const logoToUse = businessInfo.logo_url;
      const warrantyText = editingTemplate.custom_warranty || (
      editingTemplate.warranty_type === 'sales' ? businessInfo.warranty_sales : businessInfo.warranty_repairs);
      const hoursText = editingTemplate.custom_hours || null;

      const previewHTML = generatePreview(editingTemplate, logoToUse, warrantyText, hoursText);

      if (!previewHTML) {
        throw new Error("No se pudo generar el HTML del email (plantilla vacía)");
      }

      await base44.integrations.Core.SendEmail({
        to: testEmail,
        subject: `[PRUEBA] ${editingTemplate.header_title}`,
        body: previewHTML
      });

      toast.success(`✅ Email de prueba enviado a ${testEmail}`);
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error(error?.message ? `Error: ${error.message}` : "Error al enviar email de prueba");
    } finally {
      setSendingTest(false);
    }
  };

  const generatePreview = (template, logoUrlOverride, warrantyTextOverride, hoursTextOverride) => {
    if (!template) return "";

    const eventInfo = EVENT_TYPES[template.event_type];
    const alertColor = eventInfo?.alertColor || { bg: "#F9FAFB", border: "#6B7280", title: "#374151", text: "#1F2937" };
    const logoToUse = logoUrlOverride || businessInfo.logo_url;
    const warrantyText = warrantyTextOverride || template.custom_warranty || (
    template.warranty_type === 'sales' ? businessInfo.warranty_sales : businessInfo.warranty_repairs);

    // Bloque de desglose financiero — solo para eventos de pago (preview con placeholders)
    const PAYMENT_EVENT_TYPES = ['deposit_received', 'payment_received', 'sale_completed', 'refund_processed'];
    const paymentSummaryHTML = PAYMENT_EVENT_TYPES.includes(template.event_type) ? (() => {
      const isRefund  = template.event_type === 'refund_processed';
      const isSale    = template.event_type === 'sale_completed';
      const isDeposit = template.event_type === 'deposit_received';
      const titleMap  = {
        deposit_received: '🧾 Resumen del Depósito',
        payment_received: '🧾 Recibo de Pago',
        sale_completed:   '🧾 Recibo de Venta',
        refund_processed: '🧾 Detalle del Reembolso',
      };
      const rows = [
        ...(isSale    ? [{ label: 'Número de venta',                                          value: '{{sale_number}}',    bold: true }] : []),
        ...(!isRefund ? [{ label: isSale ? 'Total de la venta' : 'Total de la orden',          value: '${{amount}}' }]                  : []),
        [{ label: isRefund ? 'Monto reembolsado' : isDeposit ? 'Depósito recibido' : 'Monto pagado', value: '${{total_paid}}', highlight: true }][0],
        ...(!isRefund && !isSale ? [{ label: 'Balance pendiente', value: '${{balance}}', balanceColor: '#DC2626' }] : []),
        { label: isRefund ? 'Método de reembolso' : 'Método de pago', value: '{{payment_method}}' },
      ];
      const rowsHTML = rows.filter(Boolean).map((row, idx, arr) => {
        const isLast = idx === arr.length - 1;
        const valueColor = row.balanceColor || (row.highlight ? '#059669' : row.bold ? '#111827' : '#374151');
        const valueFontWeight = (row.highlight || row.bold) ? '800' : '600';
        const valueFontSize   = (row.highlight || row.bold) ? '18px' : '15px';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 20px;${isLast ? '' : 'border-bottom:1px solid #F3F4F6;'}">
          <span style="color:#6B7280;font-size:14px;font-weight:500;">${row.label}</span>
          <span style="color:${valueColor};font-size:${valueFontSize};font-weight:${valueFontWeight};">${row.value}</span>
        </div>`;
      }).join('');
      return `
        <div style="background:linear-gradient(135deg,#F0FDF4 0%,#ECFDF5 100%);border-radius:16px;padding:28px;margin:30px 0;border:2px solid #10B981;">
          <p style="font-size:18px;font-weight:800;color:#065F46;margin:0 0 20px 0;text-align:center;">${titleMap[template.event_type]}</p>
          <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">${rowsHTML}</div>
        </div>`;
    })() : '';

    const nextStepsHTML = template.show_next_steps && template.next_steps_items?.length ? `
      <div style="background: #F0F9FF; border-radius: 16px; padding: 24px; margin: 30px 0; border: 2px solid #BFDBFE;">
        <h3 style="color: #1E40AF; font-size: 18px; font-weight: 800; margin: 0 0 16px 0;">
          🔄 Próximos Pasos
        </h3>
        <ol style="margin: 0; padding-left: 20px; color: #1E3A8A; font-size: 15px; line-height: 1.8;">
          ${template.next_steps_items.map((step) => `<li style="margin: 8px 0;">${step}</li>`).join('')}
        </ol>
      </div>
    ` : '';

    const generateHoursHTML = () => {
      if (!template.show_hours) return '';

      // Si hay horario personalizado en la plantilla, usarlo
      if (hoursTextOverride || template.custom_hours) {
        const customHours = hoursTextOverride || template.custom_hours;
        return `
          <div style="background: #ECFDF5; border-radius: 16px; padding: 28px; margin: 35px 0; text-align: center; border: 2px solid #10B981;">
            <p style="font-size: 20px; font-weight: 800; color: #065F46; margin: 0 0 16px 0;">🕐 Horario de Recogida</p>
            <p style="color: #047857; font-size: 16px; font-weight: 600; margin: 0; line-height: 1.6; white-space: pre-line;">
              ${customHours}
            </p>
          </div>
        `;
      }

      const days = [
      { key: 'hours_monday', label: 'Lunes' },
      { key: 'hours_tuesday', label: 'Martes' },
      { key: 'hours_wednesday', label: 'Miércoles' },
      { key: 'hours_thursday', label: 'Jueves' },
      { key: 'hours_friday', label: 'Viernes' },
      { key: 'hours_saturday', label: 'Sábado' },
      { key: 'hours_sunday', label: 'Domingo' }];


      const hasSpecificHours = days.some((day) => businessInfo[day.key]);

      if (!hasSpecificHours) {
        return `
          <div style="background: #ECFDF5; border-radius: 16px; padding: 28px; margin: 35px 0; text-align: center; border: 2px solid #10B981;">
            <p style="font-size: 20px; font-weight: 800; color: #065F46; margin: 0 0 16px 0;">🕐 Horario de Recogida</p>
            <p style="color: #047857; font-size: 18px; font-weight: 700; margin: 0;">${businessInfo.hours_weekdays || "9:00 AM - 5:00 PM"}</p>
          </div>
        `;
      }

      const hoursLines = days.
      filter((day) => businessInfo[day.key]).
      map((day) => `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(5, 150, 105, 0.1);">
          <span style="font-weight: 600; color: #047857;">${day.label}:</span>
          <span style="color: #065F46;">${businessInfo[day.key]}</span>
        </div>`).
      join('');

      return `
        <div style="background: #ECFDF5; border-radius: 16px; padding: 28px; margin: 35px 0; border: 2px solid #10B981;">
          <p style="font-size: 20px; font-weight: 800; color: #065F46; margin: 0 0 20px 0; text-align: center;">🕐 Horario de Recogida</p>
          <div style="max-width: 400px; margin: 0 auto;">
            ${hoursLines}
          </div>
        </div>
      `;
    };

    const hoursHTML = generateHoursHTML();

    const warrantyHTML = template.show_warranty && warrantyText ? `
      <div style="background: #EFF6FF; border-radius: 16px; padding: 28px; margin: 35px 0; border: 2px solid #3B82F6;">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="display: inline-block; background: linear-gradient(135deg, #3B82F6, #1D4ED8); padding: 12px 24px; border-radius: 12px; box-shadow: 0 4px 16px rgba(59,130,246,0.3);">
            <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">🛡️ GARANTÍA INCLUIDA</p>
          </div>
        </div>
        <p style="color: #1E40AF; font-size: 15px; line-height: 1.8; margin: 0; text-align: center; font-weight: 500;">
          ${warrantyText}
        </p>
      </div>
    ` : '';

    const reviewLink = template.review_link || businessInfo.google_review_link;
    const reviewHTML = template.show_review_request && reviewLink ? `
      <div style="background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); border-radius: 16px; padding: 32px; margin: 35px 0; text-align: center; border: 2px solid #FCD34D; box-shadow: 0 4px 16px rgba(251,191,36,0.2);">
        <p style="font-size: 22px; font-weight: 800; color: #78350F; margin: 0 0 12px 0;">
          ⭐ ¿Qué tal fue tu experiencia?
        </p>
        <p style="color: #92400E; font-size: 16px; margin: 0 0 24px 0; line-height: 1.6;">
          Tu opinión es muy importante para nosotros
        </p>
        <div style="margin: 20px 0;">
          <div style="display: flex; justify-content: center; gap: 8px; font-size: 36px; margin-bottom: 24px;">
            ⭐⭐⭐⭐⭐
          </div>
          <a href="${reviewLink}" 
             style="display: inline-block; background: linear-gradient(135deg, #EA4335, #FBBC04); color: white; padding: 18px 48px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 18px; box-shadow: 0 6px 24px rgba(234,67,53,0.4);">
            📝 Dejar una Reseña en Google
          </a>
        </div>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${template.header_title}</title>
      </head>
      <body style="margin: 0; padding: 20px; background: #F3F4F6;">
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff;">
          <!-- Header con gradiente -->
          <div style="background: ${getHeaderGradient(template.event_type)}; padding: 60px 30px; text-align: center; border-radius: 20px 20px 0 0;">
            <img
              src="${logoToUse}"
              alt="${businessInfo.business_name}"
              style="max-height: 120px; max-width: 300px; width: auto; height: auto; margin: 0 auto; display: block; filter: drop-shadow(0 4px 20px rgba(0,0,0,0.2)); object-fit: contain;"
            />
            <h1 style="color: white; margin: 20px 0 0 0; font-size: 32px; font-weight: 800; text-shadow: 0 2px 10px rgba(0,0,0,0.3);">
              ${template.header_title || "Título del Email"}
            </h1>
            <p style="color: rgba(255,255,255,0.98); margin: 12px 0 0 0; font-size: 18px; font-weight: 600;">
              ${template.header_subtitle || "Actualización de tu orden"}
            </p>
          </div>

          <!-- Cuerpo -->
          <div style="background: white; padding: 50px 40px; border-radius: 0 0 20px 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.08);">
            <p style="font-size: 20px; color: #111827; margin: 0 0 30px 0; font-weight: 600;">
              Hola <strong>{{customer_name}}</strong> 👋
            </p>

            <!-- Alert principal -->
            <div style="border-radius: 16px; padding: 24px; margin: 30px 0; border-left: 6px solid; background: ${alertColor.bg}; border-left-color: ${alertColor.border};">
              <p style="margin: 0; color: ${alertColor.title}; font-size: 22px; font-weight: 800;">
                ${eventInfo?.emoji} ${template.alert_title || "Título"}
              </p>
              <p style="margin: 12px 0 0 0; color: ${alertColor.text}; font-size: 16px; line-height: 1.6;">
                ${template.alert_message || "Mensaje principal"}
              </p>
            </div>

            <!-- Info de la orden -->
            <div style="background: #F9FAFB; border-radius: 16px; padding: 28px; margin: 30px 0; border: 2px solid #E5E7EB;">
              <div style="margin-bottom: 24px;">
                <p style="color: #6B7280; font-size: 12px; font-weight: 700; text-transform: uppercase; margin: 0 0 6px 0;">Número de Orden</p>
                <p style="color: #111827; font-size: 24px; font-weight: 800; margin: 0;">{{order_number}}</p>
              </div>
              <div>
                <p style="color: #6B7280; font-size: 12px; font-weight: 700; text-transform: uppercase; margin: 0 0 6px 0;">Equipo</p>
                <p style="color: #111827; font-size: 18px; font-weight: 600; margin: 0;">{{device_info}}</p>
              </div>
            </div>

            ${paymentSummaryHTML}
            ${nextStepsHTML}
            ${hoursHTML}
            ${warrantyHTML}
            ${reviewHTML}

            ${template.main_message ? `
              <p style="color: #374151; line-height: 1.8; font-size: 16px; margin: 20px 0;">
                ${template.main_message}
              </p>
            ` : ''}

            <!-- Checklist de Condiciones Verificadas -->
            ${template.show_checklist ? `
              <div style="background: #F0F9FF; border-radius: 16px; padding: 28px; margin: 35px 0; border: 2px solid #0EA5E9;">
                <p style="font-size: 20px; font-weight: 800; color: #075985; margin: 0 0 20px 0; text-align: center;">✅ Condiciones Verificadas</p>
                <div style="background: white; border-radius: 12px; padding: 20px;">
                  <div style="display: grid; gap: 12px;">
                    <div style="display: flex; align-items: center; gap: 10px; padding: 12px; background: #ECFEFF; border-radius: 8px;">
                      <span style="color: #10B981; font-size: 20px;">✓</span>
                      <span style="color: #0E7490; font-weight: 600;">Pantalla</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; padding: 12px; background: #ECFEFF; border-radius: 8px;">
                      <span style="color: #10B981; font-size: 20px;">✓</span>
                      <span style="color: #0E7490; font-weight: 600;">Batería</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; padding: 12px; background: #ECFEFF; border-radius: 8px;">
                      <span style="color: #10B981; font-size: 20px;">✓</span>
                      <span style="color: #0E7490; font-weight: 600;">Botones</span>
                    </div>
                  </div>
                </div>
                <p style="color: #0369A1; font-size: 13px; text-align: center; margin: 16px 0 0 0; font-style: italic;">
                  * Verificación realizada al recibir tu equipo
                </p>
              </div>
            ` : ''}

            <!-- Fotos de la Orden -->
            ${template.show_photos ? `
              <div style="background: #F5F3FF; border-radius: 16px; padding: 28px; margin: 35px 0; border: 2px solid #A78BFA;">
                <p style="font-size: 20px; font-weight: 800; color: #5B21B6; margin: 0 0 20px 0; text-align: center;">📸 Fotos del Equipo</p>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                  <div style="aspect-ratio: 1; background: linear-gradient(135deg, #DDD6FE 0%, #C4B5FD 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 48px; opacity: 0.5;">📷</span>
                  </div>
                  <div style="aspect-ratio: 1; background: linear-gradient(135deg, #DDD6FE 0%, #C4B5FD 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 48px; opacity: 0.5;">📷</span>
                  </div>
                </div>
                <p style="color: #6D28D9; font-size: 13px; text-align: center; margin: 16px 0 0 0; font-style: italic;">
                  * Registro visual del estado de tu equipo
                </p>
              </div>
            ` : ''}

            <!-- Contacto -->
            ${(() => {
      const phoneToUse = template.custom_phone || businessInfo.phone;
      const whatsappToUse = template.custom_whatsapp || businessInfo.whatsapp;
      const showPhone = template.show_phone_contact !== false && phoneToUse;
      const showWhatsapp = template.show_whatsapp_contact !== false && whatsappToUse;

      if (!showPhone && !showWhatsapp) return '';

      return `
                <div style="background: #F9FAFB; border-radius: 12px; padding: 24px; margin: 30px 0; text-align: center; border: 2px solid #E5E7EB;">
                  <p style="color: #111827; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">
                    💬 Contáctanos
                  </p>
                  <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
                    ${showPhone ? `
                      <a href="tel:${phoneToUse}" 
                         style="display: inline-flex; align-items: center; gap: 8px; background: #111827; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">
                        📞 Llamar
                      </a>
                    ` : ''}
                    ${showWhatsapp ? `
                      <a href="https://wa.me/${whatsappToUse.replace(/\D/g, '')}" 
                         style="display: inline-flex; align-items: center; gap: 8px; background: #10B981; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">
                        💬 WhatsApp
                      </a>
                    ` : ''}
                  </div>
                </div>
              `;
    })()}

            <!-- Footer -->
            <div style="margin-top: 50px; padding-top: 30px; border-top: 2px solid #E5E7EB; text-align: center;">
              <img 
                src="${logoToUse}"
                alt="${businessInfo.business_name}"
                style="max-height: 60px; max-width: 200px; width: auto; height: auto; margin: 0 auto 20px auto; display: block; opacity: 0.7; object-fit: contain;"
              />
              <p style="margin: 8px 0; color: #111827; font-size: 14px; font-weight: 700;">
                ${businessInfo.business_name}
              </p>
              <p style="margin: 4px 0; color: #6B7280; font-size: 13px;">
                ${businessInfo.slogan}
              </p>
              ${businessInfo.address ? `<p style="margin: 8px 0; color: #6B7280; font-size: 13px;">${businessInfo.address}</p>` : ''}
              ${businessInfo.phone ? `<p style="margin: 8px 0; color: #6B7280; font-size: 13px;">📞 ${businessInfo.phone}</p>` : ''}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  if (loading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>);

  }

  if (showEditor) {
    const eventInfo = EVENT_TYPES[editingTemplate?.event_type];

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => {
                setShowEditor(false);
                setEditingTemplate(null);
                setShowPreview(false);
                setShowAdvanced(false);
              }}
              className="bg-white text-black hover:bg-gray-100 border-0">

              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <div>
              <h2 className="text-2xl font-black text-white">
                {editingTemplate?.id ? "Editar Plantilla" : "Nueva Plantilla"}
              </h2>
              <p className="text-white/60 text-sm">
                {eventInfo ? `${eventInfo.icon} ${eventInfo.label}` : "Configurar email"}
              </p>
            </div>
          </div>
          
          <Button
            onClick={() => setShowPreview(!showPreview)}
            className="bg-white text-black hover:bg-gray-100 border-0">

            <Eye className="w-4 h-4 mr-2" />
            {showPreview ? "Ocultar" : "Vista Previa"}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Editor */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-white/70 text-sm font-semibold">Nombre de la Plantilla *</label>
                <Input
                  value={editingTemplate?.name || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  placeholder="Ej: Email de Orden Lista"
                  className="bg-white/5 border-white/10 text-white rounded-xl h-12" />

              </div>

              <div className="space-y-2">
                <label className="text-white/70 text-sm font-semibold">Tipo de Evento *</label>
                <select
                  value={editingTemplate?.event_type || ""}
                  onChange={(e) => {
                    const defaultData = DEFAULT_TEMPLATES[e.target.value] || {};
                    setEditingTemplate({
                      ...editingTemplate,
                      event_type: e.target.value,
                      ...defaultData
                    });
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl h-12 text-white px-4">

                  <option value="">Selecciona un evento</option>
                  {Object.entries(EVENT_TYPES).map(([key, info]) =>
                  <option key={key} value={key} className="bg-gray-900">
                      {info.icon} {info.label}
                    </option>
                  )}
                </select>
              </div>

              <div className="h-px bg-white/10" />

              {/* Logo — unificado desde Branding */}
              <div className="space-y-2">
                <label className="text-white/70 text-sm font-semibold">Logo</label>
                <div className="flex items-start gap-3 p-4 bg-white/5 rounded-xl border border-white/10">
                  {businessInfo.logo_url
                    ? <img src={businessInfo.logo_url} alt="Logo actual" className="max-h-[50px] max-w-[140px] object-contain bg-white/10 rounded-lg p-2 shrink-0" />
                    : <span className="text-2xl mt-0.5 shrink-0">🏪</span>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">Logo unificado de la tienda</p>
                    <p className="text-white/50 text-xs mt-1">Aplica a todas las plantillas. También editable en <strong className="text-white/70">Branding</strong>.</p>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                      id="email-template-logo-input"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={uploadingLogo}
                      onClick={() => document.getElementById("email-template-logo-input").click()}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors disabled:opacity-50"
                    >
                      {uploadingLogo ? "Subiendo..." : "Cambiar logo"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/10" />

              <div className="space-y-2">
                <label className="text-white/70 text-sm font-semibold">Título del Header *</label>
                <Input
                  value={editingTemplate?.header_title || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, header_title: e.target.value })}
                  placeholder="Ej: ¡Tu Equipo Está Listo!"
                  className="bg-white/5 border-white/10 text-white rounded-xl h-12" />

              </div>

              <div className="space-y-2">
                <label className="text-white/70 text-sm font-semibold">Subtítulo del Header</label>
                <Input
                  value={editingTemplate?.header_subtitle || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, header_subtitle: e.target.value })}
                  placeholder="Actualización de tu orden"
                  className="bg-white/5 border-white/10 text-white rounded-xl h-12" />

              </div>

              <div className="h-px bg-white/10" />

              <div className="space-y-2">
                <label className="text-white/70 text-sm font-semibold">Título del Cuadro Principal *</label>
                <Input
                  value={editingTemplate?.alert_title || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, alert_title: e.target.value })}
                  placeholder="Ej: ¡Orden Confirmada!"
                  className="bg-white/5 border-white/10 text-white rounded-xl h-12" />

              </div>

              <div className="space-y-2">
                <label className="text-white/70 text-sm font-semibold">Mensaje del Cuadro Principal *</label>
                <Textarea
                  value={editingTemplate?.alert_message || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, alert_message: e.target.value })}
                  placeholder="¡Buenas noticias! Tu equipo está listo..."
                  className="bg-white/5 border-white/10 text-white rounded-xl min-h-[100px]" />

              </div>

              <div className="space-y-2">
                <label className="text-white/70 text-sm font-semibold">Mensaje Adicional (opcional)</label>
                <Textarea
                  value={editingTemplate?.main_message || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, main_message: e.target.value })}
                  placeholder="Mensaje extra que aparecerá en el cuerpo del email..."
                  className="bg-white/5 border-white/10 text-white rounded-xl min-h-[80px]" />

              </div>
            </div>

            {/* Variables Panel */}
            <div className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-[20px] p-5">
              <p className="text-amber-300 text-sm font-bold mb-3">📎 Variables disponibles — clic para copiar</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map(v => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => { navigator.clipboard?.writeText(v.key); toast.success(`Copiado: ${v.key}`); }}
                    className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-mono rounded-lg border border-amber-500/30 transition-colors"
                    title={v.desc}
                  >
                    {v.key}
                  </button>
                ))}
              </div>
              <p className="text-amber-400/60 text-xs mt-2">Pega la variable en cualquier campo de texto del editor</p>
            </div>

            {/* Advanced Toggle */}
            <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-[28px] overflow-hidden backdrop-blur-xl shadow-2xl">
              <button
                type="button"
                onClick={() => setShowAdvanced(v => !v)}
                className="w-full flex items-center justify-between px-7 py-5 hover:bg-white/5 transition-colors"
              >
                <span className="text-white font-bold">⚙️ Opciones Avanzadas</span>
                <ChevronDown className={`w-5 h-5 text-white/60 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
              </button>

            {showAdvanced && <div className="px-7 pb-7 space-y-4 border-t border-white/10 pt-5">

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={editingTemplate?.show_hours || false}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, show_hours: e.target.checked })}
                  className="w-5 h-5 rounded" />

                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">Mostrar Horario de Recogida</p>
                  <p className="text-white/60 text-xs">Para estados como "Listo para Recoger"</p>
                </div>
              </label>

              {editingTemplate?.show_hours &&
              <div className="pl-8 space-y-2">
                  <label className="text-white/60 text-xs font-bold">Horario Personalizado (opcional)</label>
                  <Textarea
                  value={editingTemplate?.custom_hours || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, custom_hours: e.target.value })}
                  placeholder={`Lunes a Viernes: 9:00 AM - 5:00 PM\nSábados: 9:00 AM - 2:00 PM\nDomingos: Cerrado`}
                  className="bg-white/5 border-white/10 text-white rounded-xl min-h-[80px] text-sm" />

                  <p className="text-xs text-gray-400">Si está vacío, se usará el horario del negocio</p>
                </div>
              }

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={editingTemplate?.show_warranty || false}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    show_warranty: e.target.checked,
                    warranty_type: e.target.checked ? editingTemplate?.warranty_type || 'repairs' : undefined
                  })}
                  className="w-5 h-5 rounded" />

                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">Mostrar Garantía</p>
                  <p className="text-white/60 text-xs">Para estados como "Entregado" o "Recogido"</p>
                </div>
              </label>

              {editingTemplate?.show_warranty &&
              <div className="pl-8 space-y-3">
                  <div className="space-y-2">
                    <label className="text-white/60 text-xs font-bold">Tipo de Garantía</label>
                    <select
                    value={editingTemplate?.warranty_type || 'repairs'}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, warranty_type: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl h-10 text-white px-3 text-sm">

                      <option value="repairs" className="bg-gray-900">Garantía por Reparación</option>
                      <option value="sales" className="bg-gray-900">Garantía por Venta</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-white/60 text-xs font-bold">Texto de Garantía Personalizado (opcional)</label>
                    <Textarea
                    value={editingTemplate?.custom_warranty || ""}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, custom_warranty: e.target.value })}
                    placeholder="Escribe aquí el texto de garantía que quieres mostrar..."
                    className="bg-white/5 border-white/10 text-white rounded-xl min-h-[100px] text-sm" />

                    <p className="text-xs text-gray-400">
                      Si está vacío, se usará la garantía configurada en Branding
                    </p>
                  </div>
                </div>
              }

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={editingTemplate?.show_review_request || false}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, show_review_request: e.target.checked })}
                  className="w-5 h-5 rounded" />

                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">Solicitar Reseña</p>
                  <p className="text-white/60 text-xs">Para "Entregado" o "Recogido"</p>
                </div>
              </label>

              {editingTemplate?.show_review_request &&
              <div className="pl-8 space-y-2">
                  <label className="text-white/60 text-xs font-bold">Link de Reseñas (opcional)</label>
                  <Input
                  value={editingTemplate?.review_link || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, review_link: e.target.value })}
                  placeholder="https://g.page/r/..."
                  className="bg-white/5 border-white/10 text-white rounded-xl h-10 text-sm" />

                  <p className="text-xs text-gray-400">
                    Google, Yelp, o cualquier plataforma. Si está vacío, usa el del negocio
                  </p>
                </div>
              }

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={editingTemplate?.show_next_steps || false}
                  onChange={(e) => setEditingTemplate({
                    ...editingTemplate,
                    show_next_steps: e.target.checked,
                    next_steps_items: e.target.checked ? editingTemplate?.next_steps_items || [""] : []
                  })}
                  className="w-5 h-5 rounded" />

                <div>
                  <p className="text-white font-semibold text-sm">Mostrar Próximos Pasos</p>
                  <p className="text-white/60 text-xs">Lista de pasos siguientes</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={editingTemplate?.show_checklist !== false}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, show_checklist: e.target.checked })}
                  className="w-5 h-5 rounded" />

                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">Mostrar Checklist de Condiciones Verificadas</p>
                  <p className="text-white/60 text-xs">Muestra las condiciones del equipo verificadas</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={editingTemplate?.show_photos !== false}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, show_photos: e.target.checked })}
                  className="w-5 h-5 rounded" />

                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">Mostrar Fotos de la Orden</p>
                  <p className="text-white/60 text-xs">Muestra las fotos tomadas del equipo</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={editingTemplate?.show_phone_contact !== false}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, show_phone_contact: e.target.checked })}
                  className="w-5 h-5 rounded" />

                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">Mostrar Botón de Llamada</p>
                  <p className="text-white/60 text-xs">Botón para llamar al negocio</p>
                </div>
              </label>

              {editingTemplate?.show_phone_contact !== false &&
              <div className="pl-8 space-y-2">
                  <label className="text-white/60 text-xs font-bold">Número de Teléfono (opcional)</label>
                  <Input
                  value={editingTemplate?.custom_phone || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, custom_phone: e.target.value })}
                  placeholder="787-344-4995"
                  className="bg-white/5 border-white/10 text-white rounded-xl h-10 text-sm" />

                  <p className="text-xs text-gray-400">
                    Si está vacío, se usará el teléfono del negocio
                  </p>
                </div>
              }

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={editingTemplate?.show_whatsapp_contact !== false}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, show_whatsapp_contact: e.target.checked })}
                  className="w-5 h-5 rounded" />

                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">Mostrar Botón de WhatsApp</p>
                  <p className="text-white/60 text-xs">Botón para chatear por WhatsApp</p>
                </div>
              </label>

              {editingTemplate?.show_whatsapp_contact !== false &&
              <div className="pl-8 space-y-2">
                  <label className="text-white/60 text-xs font-bold">Número de WhatsApp (opcional)</label>
                  <Input
                  value={editingTemplate?.custom_whatsapp || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, custom_whatsapp: e.target.value })}
                  placeholder="787-344-4995"
                  className="bg-white/5 border-white/10 text-white rounded-xl h-10 text-sm" />

                  <p className="text-xs text-gray-400">
                    Si está vacío, se usará el WhatsApp del negocio
                  </p>
                </div>
              }

              {editingTemplate?.show_next_steps &&
              <div className="space-y-3 pl-8">
                  {(editingTemplate.next_steps_items || [""]).map((step, idx) =>
                <div key={idx} className="flex gap-2">
                      <Input
                    value={step}
                    onChange={(e) => {
                      const items = [...(editingTemplate.next_steps_items || [])];
                      items[idx] = e.target.value;
                      setEditingTemplate({ ...editingTemplate, next_steps_items: items });
                    }}
                    placeholder={`Paso ${idx + 1}`}
                    className="bg-white/5 border-white/10 text-white rounded-xl h-10 text-sm" />

                      <Button
                    onClick={() => {
                      const items = editingTemplate.next_steps_items.filter((_, i) => i !== idx);
                      setEditingTemplate({ ...editingTemplate, next_steps_items: items });
                    }}
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:bg-red-500/10">

                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                )}
                  <Button
                  onClick={() => setEditingTemplate({
                    ...editingTemplate,
                    next_steps_items: [...(editingTemplate.next_steps_items || []), ""]
                  })}
                  variant="outline"
                  size="sm" className="bg-background text-slate-900 px-3 text-xs font-semibold rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-8 border-white/10 hover:bg-white/5">


                    <Plus className="w-3 h-3 mr-2" />
                    Añadir Paso
                  </Button>
                </div>
              }

              <div className="h-px bg-white/10" />

              <div className="space-y-2">
                <label className="text-white/70 text-sm font-semibold">Enviar a</label>
                <select
                  value={editingTemplate?.send_to || "customer"}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, send_to: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl h-12 text-white px-4">

                  <option value="customer" className="bg-gray-900">Cliente</option>
                  <option value="admin" className="bg-gray-900">Administrador</option>
                  <option value="both" className="bg-gray-900">Ambos</option>
                </select>
              </div>

              <label className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-all">
                <input
                  type="checkbox"
                  checked={editingTemplate?.enabled !== false}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, enabled: e.target.checked })}
                  className="w-5 h-5 rounded" />

                <div>
                  <p className="text-white font-semibold text-sm">Plantilla Activa</p>
                  <p className="text-white/60 text-xs">Los emails se enviarán automáticamente</p>
                </div>
              </label>
            </div>}
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleSaveTemplate}
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl h-14 font-bold">

                {loading ?
                <Loader2 className="w-5 h-5 mr-2 animate-spin" /> :

                <Save className="w-5 h-5 mr-2" />
                }
                Guardar Plantilla
              </Button>

              {/* Botón de Prueba */}
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                <p className="text-amber-400 text-sm font-semibold mb-3">🧪 Enviar Email de Prueba</p>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="tu@email.com"
                    className="bg-white/5 border-white/10 text-white rounded-xl h-11 flex-1" />

                  <Button
                    onClick={handleSendTest}
                    disabled={sendingTest || !editingTemplate?.event_type}
                    className="bg-amber-500 hover:bg-amber-600 text-white">

                    {sendingTest ?
                    <Loader2 className="w-4 h-4 animate-spin" /> :

                    <Send className="w-4 h-4" />
                    }
                  </Button>
                </div>
                <p className="text-xs text-amber-400/70 mt-2">Envía una prueba para ver cómo queda</p>
              </div>
            </div>
          </div>

          {/* Preview */}
          {showPreview &&
          <div className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
              <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-[28px] p-7 backdrop-blur-xl shadow-2xl">
                <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-cyan-400" />
                  Vista Previa del Email
                </h3>
                <div
                className="bg-gray-100 rounded-xl overflow-auto max-h-[calc(100vh-12rem)] custom-scrollbar"
                dangerouslySetInnerHTML={{ __html: generatePreview(
                    editingTemplate,
                    editingTemplate.logo_url || businessInfo.logo_url,
                    editingTemplate.custom_warranty || (editingTemplate.warranty_type === 'sales' ? businessInfo.warranty_sales : businessInfo.warranty_repairs),
                    editingTemplate.custom_hours
                  ) }} />

              </div>
            </div>
          }
        </div>
      </div>);

  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Plantillas de Email</h2>
          <p className="text-white/60 text-sm mt-1">
            Configura las plantillas base que el sistema usa para notificar al cliente
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingTemplate({
              name: "",
              event_type: "",
              logo_url: "",
              header_title: "",
              header_subtitle: "Actualización de tu orden",
              alert_title: "",
              alert_message: "",
              main_message: "",
              enabled: true,
              send_to: "customer",
              show_hours: false,
              custom_hours: "",
              show_warranty: false,
              warranty_type: "repairs",
              custom_warranty: "",
              show_review_request: false,
              review_link: "",
              show_next_steps: false,
              next_steps_items: [],
              show_checklist: true,
              show_photos: true,
              show_phone_contact: true,
              custom_phone: "",
              show_whatsapp_contact: true,
              custom_whatsapp: ""
            });
            setShowEditor(true);
          }}
          className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-xl">

          <Plus className="w-4 h-4 mr-2" />
          Nueva Plantilla
        </Button>
      </div>

      {loadWarning && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {loadWarning}
        </div>
      )}

      {/* Accordion Groups */}
      <div className="space-y-4">
        {TEMPLATE_GROUPS.map(group => {
          const groupTemplates = templates.filter(t => group.types.includes(t.event_type));
          const activeCount = groupTemplates.filter(t => t.enabled !== false).length;
          const customCount = groupTemplates.filter(t => customizedTypes.has(t.event_type)).length;
          const isOpen = openGroups[group.id];

          return (
            <div key={group.id} className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-[24px] overflow-hidden backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setOpenGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                className="w-full flex items-center gap-4 p-5 hover:bg-white/5 transition-colors text-left"
              >
                <span className="text-3xl">{group.icon}</span>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-base">{group.label}</h3>
                  <p className="text-white/50 text-xs mt-0.5">
                    {groupTemplates.length} plantillas · {activeCount} activas{customCount > 0 ? ` · ${customCount} editadas` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {customCount > 0 && (
                    <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">{customCount} editadas</Badge>
                  )}
                  <ChevronDown className={`w-5 h-5 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-white/10 pt-4">
                  {groupTemplates.map(tmpl => {
                    const eventInfo = EVENT_TYPES[tmpl.event_type];
                    const isCustomized = customizedTypes.has(tmpl.event_type);

                    return (
                      <div
                        key={tmpl.id}
                        className={`bg-white/5 border rounded-[16px] p-4 transition-all ${tmpl.enabled !== false ? "border-cyan-500/20" : "border-white/10 opacity-60"}`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                            style={{ background: getHeaderGradient(tmpl.event_type) }}
                          >
                            {eventInfo?.icon || "📧"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <h3 className="text-white font-bold text-sm truncate flex-1">{tmpl.name}</h3>
                              <div className="flex items-center gap-1 shrink-0 ml-1">
                                {isCustomized
                                  ? <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px] px-1.5 py-0">Editada</Badge>
                                  : <Badge className="bg-white/10 text-white/50 border-white/10 text-[10px] px-1.5 py-0">Sistema</Badge>
                                }
                                {tmpl.enabled !== false
                                  ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">Activa</Badge>
                                  : <Badge className="bg-white/10 text-white/60 border-white/20 text-[10px] px-1.5 py-0">Inactiva</Badge>
                                }
                              </div>
                            </div>
                            <p className="text-white/50 text-xs line-clamp-1">{tmpl.header_title}</p>
                            <div className="flex items-center gap-1.5 mt-3">
                              <button
                                type="button"
                                onClick={() => { setEditingTemplate({ ...tmpl }); setShowEditor(true); setShowAdvanced(false); }}
                                className="flex-1 h-7 px-2 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors inline-flex items-center justify-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewTemplate(tmpl)}
                                title="Vista previa"
                                className="h-7 px-2 text-xs rounded-lg bg-white/10 hover:bg-cyan-500/20 text-white border border-white/20 hover:border-cyan-500/40 transition-colors inline-flex items-center justify-center"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleTemplate(tmpl)}
                                className="h-7 px-2 text-xs rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors inline-flex items-center justify-center"
                              >
                                {tmpl.enabled !== false ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                              </button>
                              {isCustomized && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTemplate(tmpl.id)}
                                  title="Restablecer al sistema"
                                  className="h-7 px-2 text-xs rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-colors inline-flex items-center justify-center"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {templates.length === 0 &&
      <div className="text-center py-20 bg-gradient-to-br from-white/5 to-white/3 border border-white/10 rounded-[28px]">
          <Mail className="w-16 h-16 text-white/20 mx-auto mb-4" />
          <p className="text-white/60 text-lg font-semibold">No hay plantillas configuradas</p>
          <p className="text-white/40 text-sm mt-2">Crea plantillas personalizadas para cada estado de orden</p>
        </div>
      }

      {/* Quick Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#0F172A] border border-white/10 rounded-[28px] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: getHeaderGradient(previewTemplate.event_type) }}
                >
                  {EVENT_TYPES[previewTemplate.event_type]?.icon || '📧'}
                </div>
                <div>
                  <h3 className="text-white font-bold">{previewTemplate.name}</h3>
                  <p className="text-white/50 text-xs">{EVENT_TYPES[previewTemplate.event_type]?.label}</p>
                </div>
              </div>
              <Button
                onClick={() => setPreviewTemplate(null)}
                variant="ghost"
                size="icon"
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div
              className="flex-1 overflow-auto bg-gray-100 custom-scrollbar"
              dangerouslySetInnerHTML={{
                __html: generatePreview(
                  previewTemplate,
                  businessInfo.logo_url,
                  previewTemplate.custom_warranty || (previewTemplate.warranty_type === 'sales' ? businessInfo.warranty_sales : businessInfo.warranty_repairs),
                  previewTemplate.custom_hours
                )
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #00A8E8, #10B981);
          border-radius: 4px;
        }
      `}</style>
    </div>);

}
