const DEFAULT_LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png";
const EMAIL_TEMPLATES_SETTINGS_SLUG = "email-templates-config";

function getAlertColorForStatus(status) {
  const colors = {
    intake: { bg: "#F0FDF4", border: "#10B981", title: "#065F46", text: "#064E3B" },
    diagnosing: { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" },
    awaiting_approval: { bg: "#FFFBEB", border: "#F59E0B", title: "#B45309", text: "#78350F" },
    waiting_parts: { bg: "#FFF7ED", border: "#F97316", title: "#C2410C", text: "#7C2D12" },
    waiting_customer: { bg: "#FFF1F2", border: "#F43F5E", title: "#9F1239", text: "#881337" },
    pending_order: { bg: "#FEF3C7", border: "#F59E0B", title: "#92400E", text: "#78350F" },
    part_arrived_waiting_device: { bg: "#F0F9FF", border: "#0EA5E9", title: "#0369A1", text: "#075985" },
    in_progress: { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" },
    ready_for_pickup: { bg: "#F0FDF4", border: "#10B981", title: "#065F46", text: "#064E3B" },
    delivered: { bg: "#ECFDF5", border: "#059669", title: "#047857", text: "#065F46" },
    picked_up: { bg: "#ECFDF5", border: "#059669", title: "#047857", text: "#065F46" },
    cancelled: { bg: "#FEF2F2", border: "#DC2626", title: "#991B1B", text: "#7F1D1D" },
    warranty: { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" },
    pickup_reminder_15: { bg: "#FFFBEB", border: "#F59E0B", title: "#B45309", text: "#78350F" },
    pickup_reminder_3: { bg: "#FEF2F2", border: "#DC2626", title: "#991B1B", text: "#7F1D1D" },
    warranty_check_15: { bg: "#ECFDF5", border: "#10B981", title: "#047857", text: "#065F46" },
    warranty_expired: { bg: "#EEF2FF", border: "#6366F1", title: "#3730A3", text: "#4338CA" },
    payment_received: { bg: "#ECFDF5", border: "#10B981", title: "#047857", text: "#065F46" },
    deposit_received: { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" }
  };
  return colors[status] || { bg: "#F9FAFB", border: "#6B7280", title: "#374151", text: "#1F2937" };
}

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

function interpolate(text, variables) {
  if (typeof text !== "string") return text;
  return text.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const value = variables[key.trim()];
    return value === undefined || value === null ? "" : String(value);
  });
}

function buildVariables(orderData = {}) {
  return {
    order_number: orderData.order_number || "",
    customer_name: orderData.customer_name || "",
    device_info: orderData.device_info || "",
    initial_problem: orderData.initial_problem || "",
    amount: orderData.amount != null ? Number(orderData.amount).toFixed(2) : "",
    balance: orderData.balance != null ? Number(orderData.balance).toFixed(2) : "",
    total_paid: orderData.total_paid != null ? Number(orderData.total_paid).toFixed(2) : "",
    sale_number: orderData.sale_number || "",
    payment_method: orderData.payment_method || "",
    days_remaining: orderData.days_remaining != null ? String(orderData.days_remaining) : "",
    days_elapsed: orderData.days_elapsed != null ? String(orderData.days_elapsed) : "",
    delivered_date: orderData.delivered_date || ""
  };
}

const _cache = {
  templates: { data: null, ts: 0 },
  business: { data: null, ts: 0 },
};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function sendTemplatedEmailWithBase44(base44, { event_type, order_data = {} }) {
  const now = Date.now();

  if (!_cache.templates.data || now - _cache.templates.ts > CACHE_TTL_MS) {
    const [templateSettings, legacyTemplates] = await Promise.all([
      base44.asServiceRole.entities.AppSettings.filter({ slug: EMAIL_TEMPLATES_SETTINGS_SLUG }).catch(() => []),
      base44.asServiceRole.entities.EmailTemplate.filter({ enabled: true }).catch(() => [])
    ]);
    _cache.templates.data = { templateSettings, legacyTemplates };
    _cache.templates.ts = now;
  }

  const { templateSettings, legacyTemplates } = _cache.templates.data;

  const configuredTemplates = Array.isArray(templateSettings?.[0]?.payload?.templates)
    ? templateSettings[0].payload.templates
    : [];

  const matchingConfiguredTemplates = configuredTemplates.filter(
    (template) => template?.event_type === event_type && template?.enabled !== false
  );

  const matchingLegacy = legacyTemplates.filter((t) => t.event_type === event_type);
  const templates = matchingConfiguredTemplates.length > 0 ? matchingConfiguredTemplates : matchingLegacy;

  if (!templates || templates.length === 0) {
    return { success: false, message: `No hay plantilla activa para: ${event_type}` };
  }

  const template = templates.find((t) => t.is_default) || templates[0];

  if (!_cache.business.data || now - _cache.business.ts > CACHE_TTL_MS) {
    const [businessConfigs, brandingConfigs] = await Promise.all([
      base44.asServiceRole.entities.AppSettings.filter({ slug: "app-main-settings" }),
      base44.asServiceRole.entities.AppSettings.filter({ slug: "business-branding" })
    ]);
    _cache.business.data = { businessConfigs, brandingConfigs };
    _cache.business.ts = now;
  }

  const { businessConfigs, brandingConfigs } = _cache.business.data;

  const businessInfo = businessConfigs?.[0]?.payload || {};
  const branding = brandingConfigs?.[0]?.payload || {};
  // Logo unificado: usa solo el logo de Branding (no por plantilla)
  const logoUrl = branding.logo_url || DEFAULT_LOGO_URL;
  const alertColor = getAlertColorForStatus(event_type);
  const variables = buildVariables(order_data);

  // Bloque de desglose financiero — solo para eventos de pago
  const PAYMENT_EVENT_TYPES = new Set(['deposit_received', 'payment_received', 'sale_completed', 'refund_processed']);
  const paymentSummaryHTML = PAYMENT_EVENT_TYPES.has(event_type) ? (() => {
    const isRefund  = event_type === 'refund_processed';
    const isSale    = event_type === 'sale_completed';
    const isDeposit = event_type === 'deposit_received';
    const titleMap  = {
      deposit_received: '🧾 Resumen del Depósito',
      payment_received: '🧾 Recibo de Pago',
      sale_completed:   '🧾 Recibo de Venta',
      refund_processed: '🧾 Detalle del Reembolso',
    };
    const rows = [
      ...(isSale && variables.sale_number ? [{ label: 'Número de venta', value: variables.sale_number, bold: true }] : []),
      ...(!isRefund && variables.amount    ? [{ label: isSale ? 'Total de la venta' : 'Total de la orden', value: `$${variables.amount}` }] : []),
      ...(variables.total_paid             ? [{ label: isRefund ? 'Monto reembolsado' : isDeposit ? 'Depósito recibido' : 'Monto pagado', value: `$${variables.total_paid}`, highlight: true }] : []),
      ...(!isRefund && !isSale && variables.balance !== undefined && variables.balance !== ''
        ? [{ label: 'Balance pendiente', value: parseFloat(variables.balance) === 0 ? '✅ Saldado' : `$${variables.balance}`, balanceColor: parseFloat(variables.balance) === 0 ? '#059669' : '#DC2626' }]
        : []),
      ...(variables.payment_method ? [{ label: isRefund ? 'Método de reembolso' : 'Método de pago', value: variables.payment_method }] : []),
    ];
    if (rows.length === 0) return '';
    const rowsHTML = rows.map((row, idx) => {
      const isLast = idx === rows.length - 1;
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
      <p style="font-size:18px;font-weight:800;color:#065F46;margin:0 0 20px 0;text-align:center;">${titleMap[event_type]}</p>
      <div style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">${rowsHTML}</div>
    </div>`;
  })() : '';

  const nextStepsHTML = template.show_next_steps && template.next_steps_items?.length ? `
    <div style="background: #F0F9FF; border-radius: 16px; padding: 24px; margin: 30px 0; border: 2px solid #BFDBFE;">
      <h3 style="color: #1E40AF; font-size: 18px; font-weight: 800; margin: 0 0 16px 0;">🔄 Próximos Pasos</h3>
      <ol style="margin: 0; padding-left: 20px; color: #1E3A8A; font-size: 15px; line-height: 1.8;">
        ${template.next_steps_items.map((step) => `<li style="margin: 8px 0;">${interpolate(step, variables)}</li>`).join("")}
      </ol>
    </div>
  ` : "";

  // Horario de Recogida — usa custom_hours de la plantilla o el horario del negocio
  const hoursHTML = (() => {
    if (!template.show_hours) return "";
    if (template.custom_hours) {
      return `
    <div style="background: #ECFDF5; border-radius: 16px; padding: 28px; margin: 35px 0; text-align: center; border: 2px solid #10B981;">
      <p style="font-size: 20px; font-weight: 800; color: #065F46; margin: 0 0 16px 0;">🕐 Horario de Recogida</p>
      <p style="color: #047857; font-size: 16px; font-weight: 600; margin: 0; line-height: 1.6; white-space: pre-line;">${template.custom_hours}</p>
    </div>
  `;
    }
    const days = [
      { key: "hours_monday", label: "Lunes" },
      { key: "hours_tuesday", label: "Martes" },
      { key: "hours_wednesday", label: "Miércoles" },
      { key: "hours_thursday", label: "Jueves" },
      { key: "hours_friday", label: "Viernes" },
      { key: "hours_saturday", label: "Sábado" },
      { key: "hours_sunday", label: "Domingo" }
    ];
    const hasSpecificHours = days.some((d) => businessInfo[d.key]);
    if (!hasSpecificHours) {
      return `
    <div style="background: #ECFDF5; border-radius: 16px; padding: 28px; margin: 35px 0; text-align: center; border: 2px solid #10B981;">
      <p style="font-size: 20px; font-weight: 800; color: #065F46; margin: 0 0 16px 0;">🕐 Horario de Recogida</p>
      <p style="color: #047857; font-size: 18px; font-weight: 700; margin: 0;">${businessInfo.hours_weekdays || "9:00 AM - 5:00 PM"}</p>
    </div>
  `;
    }
    const hoursLines = days
      .filter((d) => businessInfo[d.key])
      .map((d) => `<div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(5,150,105,0.1);"><span style="font-weight: 600; color: #047857;">${d.label}:</span><span style="color: #065F46;">${businessInfo[d.key]}</span></div>`)
      .join("");
    return `
    <div style="background: #ECFDF5; border-radius: 16px; padding: 28px; margin: 35px 0; border: 2px solid #10B981;">
      <p style="font-size: 20px; font-weight: 800; color: #065F46; margin: 0 0 20px 0; text-align: center;">🕐 Horario de Recogida</p>
      <div style="max-width: 400px; margin: 0 auto;">${hoursLines}</div>
    </div>
  `;
  })();

  const warrantyText = template.custom_warranty || (template.warranty_type === "sales" ? branding.warranty_sales : branding.warranty_repairs);
  const warrantyHTML = template.show_warranty && warrantyText ? `
    <div style="background: #EFF6FF; border-radius: 16px; padding: 28px; margin: 35px 0; border: 2px solid #3B82F6;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="display: inline-block; background: linear-gradient(135deg, #3B82F6, #1D4ED8); padding: 12px 24px; border-radius: 12px;">
          <p style="color: white; font-size: 18px; font-weight: 800; margin: 0;">🛡️ GARANTÍA</p>
        </div>
      </div>
      <p style="color: #1E40AF; font-size: 15px; line-height: 1.8; margin: 0; text-align: center; font-weight: 500;">
        ${interpolate(warrantyText, variables)}
      </p>
    </div>
  ` : "";

  const reviewLink = template.review_link || businessInfo.google_review_link;
  const reviewHTML = template.show_review_request && reviewLink ? `
    <div style="background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); border-radius: 16px; padding: 32px; margin: 35px 0; text-align: center; border: 2px solid #FCD34D;">
      <p style="font-size: 22px; font-weight: 800; color: #78350F; margin: 0 0 12px 0;">⭐ ¿Qué tal fue tu experiencia?</p>
      <a href="${reviewLink}" style="display: inline-block; background: linear-gradient(135deg, #EA4335, #FBBC04); color: white; padding: 18px 48px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 18px;">📝 Dejar una Reseña en Google</a>
    </div>
  ` : "";

  const phoneToUse = template.custom_phone || businessInfo.business_phone;
  const whatsappToUse = template.custom_whatsapp || businessInfo.business_whatsapp;
  const showPhone = template.show_phone_contact !== false && phoneToUse;
  const showWhatsapp = template.show_whatsapp_contact !== false && whatsappToUse;
  const contactHTML = !showPhone && !showWhatsapp ? "" : `
    <div style="background: #F9FAFB; border-radius: 12px; padding: 24px; margin: 30px 0; text-align: center; border: 2px solid #E5E7EB;">
      <p style="color: #111827; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">💬 Contáctanos</p>
      <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
        ${showPhone ? `<a href="tel:${phoneToUse}" style="background: #111827; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">📞 Llamar</a>` : ""}
        ${showWhatsapp ? `<a href="https://wa.me/${String(whatsappToUse).replace(/\D/g, "")}" style="background: #10B981; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600;">💬 WhatsApp</a>` : ""}
      </div>
    </div>
  `;

  // Condiciones Verificadas — siempre se muestra si show_checklist está activado
  const checklistHTML = (() => {
    if (!template.show_checklist) return "";
    if (order_data.checklist_items?.length) {
      return `
    <div style="background: #F0F9FF; border-radius: 16px; padding: 28px; margin: 35px 0; border: 2px solid #0EA5E9;">
      <p style="font-size: 20px; font-weight: 800; color: #075985; margin: 0 0 20px 0; text-align: center;">✅ Condiciones Verificadas</p>
      <div style="background: white; border-radius: 12px; padding: 20px;">
        <div style="display: grid; gap: 12px;">
          ${order_data.checklist_items.map((item) => {
            const label = typeof item === "string" ? item : item?.label || "";
            return `<div style="display: flex; align-items: center; gap: 10px; padding: 12px; background: #ECFEFF; border-radius: 8px;">
              <span style="color: #10B981; font-size: 20px; font-weight: bold;">✓</span>
              <span style="color: #0E7490; font-weight: 600;">${interpolate(label, variables)}</span>
            </div>`;
          }).join("")}
        </div>
      </div>
      <p style="color: #0369A1; font-size: 13px; text-align: center; margin: 16px 0 0 0; font-style: italic;">* Verificación realizada al recibir tu equipo</p>
    </div>
  `;
    }
    // Sección genérica cuando la orden no tiene items específicos
    return `
    <div style="background: #F0F9FF; border-radius: 16px; padding: 28px; margin: 35px 0; border: 2px solid #0EA5E9;">
      <p style="font-size: 20px; font-weight: 800; color: #075985; margin: 0 0 16px 0; text-align: center;">✅ Condiciones Verificadas</p>
      <p style="color: #0369A1; font-size: 14px; text-align: center; margin: 0; font-style: italic;">Las condiciones del equipo han sido verificadas por nuestro equipo técnico al momento de la recepción.</p>
    </div>
  `;
  })();

  const photosHTML = template.show_photos && order_data.photos_metadata?.length ? `
    <div style="background: #F5F3FF; border-radius: 16px; padding: 28px; margin: 35px 0; border: 2px solid #A78BFA;">
      <p style="font-size: 20px; font-weight: 800; color: #5B21B6; margin: 0 0 20px 0; text-align: center;">📸 Fotos del Equipo</p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
        ${order_data.photos_metadata.filter((p) => p.visible_to_customer !== false).slice(0, 6).map((photo) => `
          <div style="aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #EDE9FE;">
            <img src="${photo.thumbUrl || photo.publicUrl || photo.url}" alt="Foto del equipo" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>
        `).join("")}
      </div>
    </div>
  ` : "";

  const emailHTML = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin: 0; padding: 20px; background: #F3F4F6;">
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff;">
        <div style="background: ${getHeaderGradient(event_type)}; padding: 60px 30px; text-align: center; border-radius: 20px 20px 0 0;">
          <img src="${logoUrl}" alt="${businessInfo.business_name || 'SmartFixOS'}" style="height: 120px; width: auto; margin: 0 auto; display: block;" />
          <h1 style="color: white; margin: 20px 0 0 0; font-size: 32px; font-weight: 800;">${interpolate(template.header_title, variables)}</h1>
          <p style="color: rgba(255,255,255,0.98); margin: 12px 0 0 0; font-size: 18px; font-weight: 600;">${interpolate(template.header_subtitle || "", variables)}</p>
        </div>
        <div style="background: white; padding: 50px 40px; border-radius: 0 0 20px 20px;">
          <p style="font-size: 20px; color: #111827; margin: 0 0 30px 0; font-weight: 600;">Hola <strong>${variables.customer_name}</strong> 👋</p>
          <div style="border-radius: 16px; padding: 24px; margin: 30px 0; border-left: 6px solid; background: ${alertColor.bg}; border-left-color: ${alertColor.border};">
            <p style="margin: 0; color: ${alertColor.title}; font-size: 22px; font-weight: 800;">${interpolate(template.alert_title, variables)}</p>
            <p style="margin: 12px 0 0 0; color: ${alertColor.text}; font-size: 16px; line-height: 1.6;">${interpolate(template.alert_message, variables)}</p>
          </div>
          <div style="background: #F9FAFB; border-radius: 16px; padding: 28px; margin: 30px 0; border: 2px solid #E5E7EB;">
            ${variables.order_number ? `<div style="margin-bottom: 24px;"><p style="color: #6B7280; font-size: 12px; font-weight: 700; margin: 0 0 6px 0;">ORDEN</p><p style="color: #111827; font-size: 24px; font-weight: 800; margin: 0;">${variables.order_number}</p></div>` : ""}
            ${variables.device_info ? `<div><p style="color: #6B7280; font-size: 12px; font-weight: 700; margin: 0 0 6px 0;">EQUIPO</p><p style="color: #111827; font-size: 18px; font-weight: 600; margin: 0;">${variables.device_info}</p></div>` : ""}
          </div>
          ${paymentSummaryHTML}
          ${nextStepsHTML}${hoursHTML}${checklistHTML}${photosHTML}${warrantyHTML}${reviewHTML}
          ${template.main_message ? `<p style="color: #374151; line-height: 1.8; font-size: 16px; margin: 20px 0;">${interpolate(template.main_message, variables)}</p>` : ""}
          ${contactHTML}
          <div style="margin-top: 50px; padding-top: 30px; border-top: 2px solid #E5E7EB; text-align: center;">
            <img src="${logoUrl}" alt="${businessInfo.business_name || 'SmartFixOS'}" style="height: 60px; width: auto; margin: 0 auto 20px; opacity: 0.7;" />
            <p style="margin: 8px 0; color: #111827; font-size: 14px; font-weight: 700;">${businessInfo.business_name || "SmartFixOS"}</p>
            ${businessInfo.business_address ? `<p style="margin: 8px 0; color: #6B7280; font-size: 13px;">${businessInfo.business_address}</p>` : ""}
            ${businessInfo.business_phone ? `<p style="margin: 8px 0; color: #6B7280; font-size: 13px;">📞 ${businessInfo.business_phone}</p>` : ""}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const subjectBase = interpolate(template.header_title || template.name || "Actualización de tu orden", variables);
  const subject = variables.order_number ? `${subjectBase} - ${variables.order_number}` : subjectBase;

  const recipients = [];
  if (template.send_to === "customer" || template.send_to === "both") {
    if (order_data.customer_email) recipients.push(order_data.customer_email);
  }
  if (template.send_to === "admin" || template.send_to === "both") {
    recipients.push(businessInfo.business_email || "admin@smartfixos.com");
  }

  const results = [];
  for (const recipient of recipients) {
    try {
      await base44.integrations.Core.SendEmail({
        to: recipient,
        subject,
        body: emailHTML
      });
      results.push({ recipient, success: true });
      await base44.asServiceRole.entities.EmailLog.create({
        to_email: recipient,
        subject,
        body_html: emailHTML,
        status: "sent",
        sent_at: new Date().toISOString(),
        metadata: { event_type, template_id: template.id, order_number: order_data.order_number || null }
      });
    } catch (error) {
      results.push({ recipient, success: false, error: error.message });
    }
  }

  return { success: true, template_used: template.name, subject, results };
}
