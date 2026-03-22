import { ensureResendConfigured, sendResendEmail } from '../lib/server/resend.js';

/**
 * POST /api/send-email
 * Sends a templated order email using tenant email templates and branding.
 * Replaces the Deno /sendTemplatedEmail endpoint.
 *
 * Body: {
 *   event_type: string,       e.g. "ready_for_pickup"
 *   order_data: {             order fields for template interpolation
 *     order_number, customer_name, customer_email,
 *     device_info, initial_problem, amount, balance,
 *     total_paid, sale_number, payment_method,
 *     days_remaining, days_elapsed, delivered_date,
 *     checklist_items, photos_metadata
 *   },
 *   tenant_id: string         (required to fetch templates/settings)
 * }
 */

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@smartfixos.com';

const DEFAULT_LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png";
const EMAIL_TEMPLATES_SLUG = "email-templates-config";

// ── Default templates (mirrors emailTemplateRegistry.js) ─────────────────────
const DEFAULT_TEMPLATE_DEFS = {
  intake: { name: "Orden Recibida", header_title: "¡Orden Recibida!", header_subtitle: "Tu equipo está en buenas manos", alert_title: "Orden confirmada", alert_message: "Hemos recibido tu equipo y ya estamos trabajando en ello.", main_message: "Te mantendremos informado en cada paso del proceso. Recibirás actualizaciones automáticas por email cuando haya cambios en el estado de tu orden.", show_next_steps: true, next_steps_items: ["Diagnóstico: Evaluaremos tu equipo en detalle", "Cotización: Te contactaremos con el costo y tiempo estimado", "Reparación: Una vez aprobado, comenzamos el trabajo", "Notificación: Te avisaremos cuando esté listo"], show_checklist: true, show_photos: true },
  diagnosing: { name: "Diagnóstico en Proceso", header_title: "Diagnóstico en Proceso", header_subtitle: "Estamos evaluando tu equipo", alert_title: "Tu equipo está siendo diagnosticado", alert_message: "Nuestro equipo técnico está evaluando tu dispositivo para determinar el problema y la mejor solución.", main_message: "Te contactaremos pronto con el diagnóstico completo y la cotización de reparación.", show_checklist: true, show_photos: true },
  awaiting_approval: { name: "Esperando Aprobación", header_title: "Cotización Lista", header_subtitle: "Esperamos tu aprobación", alert_title: "Hemos completado el diagnóstico", alert_message: "Tu equipo ha sido evaluado. Por favor revisa la cotización y confirma para proceder con la reparación.", main_message: "Contacta con nosotros para aprobar la reparación o si tienes alguna pregunta sobre la cotización.", show_checklist: true, show_photos: true },
  waiting_parts: { name: "Esperando Piezas", header_title: "Orden de Piezas en Proceso", header_subtitle: "Actualizamos el estado de tu orden", alert_title: "Estamos ordenando las piezas necesarias", alert_message: "Hemos identificado las piezas que necesita tu equipo. Ya las ordenamos y te notificaremos cuando lleguen para comenzar la reparación.", main_message: "El tiempo de espera depende del proveedor, pero te mantendremos informado del progreso." },
  pending_order: { name: "Pendiente de Ordenar", header_title: "Piezas pendientes de ordenar", header_subtitle: "Estamos organizando tu reparación", alert_title: "Cotización y piezas en revisión", alert_message: "Estamos validando piezas, costos y disponibilidad antes de proceder con la reparación.", main_message: "Te notificaremos cuando las piezas estén ordenadas o si necesitamos tu aprobación adicional." },
  part_arrived_waiting_device: { name: "Pieza Lista - Esperando Equipo", header_title: "¡La Pieza Ya Llegó!", header_subtitle: "Esperamos que traigas tu equipo", alert_title: "La pieza necesaria ya está aquí", alert_message: "¡Buenas noticias! La pieza que necesitábamos para tu reparación ya llegó. Por favor trae tu equipo para que podamos comenzar el trabajo.", main_message: "Una vez tengamos tu equipo, comenzaremos la reparación de inmediato.", show_hours: true },
  in_progress: { name: "En Reparación", header_title: "Reparación en Progreso", header_subtitle: "Estamos trabajando en tu equipo", alert_title: "Tu equipo está siendo reparado", alert_message: "Nuestro equipo técnico está trabajando activamente en la reparación de tu dispositivo.", main_message: "Te notificaremos tan pronto esté listo para recoger." },
  ready_for_pickup: { name: "Listo para Recoger", header_title: "¡Tu Equipo Está Listo!", header_subtitle: "Ya puedes venir a recogerlo", alert_title: "¡Reparación Completada!", alert_message: "¡Buenas noticias! Tu equipo ha sido reparado exitosamente y está listo para que lo recojas.", main_message: "Estamos comprometidos a brindarte el mejor servicio. Si tienes alguna pregunta, no dudes en contactarnos.", show_hours: true, show_warranty: true, show_checklist: true, show_photos: true },
  pickup_reminder_15: { name: "Recordatorio de Recogida (15 días)", header_title: "Tu equipo sigue listo para recoger", header_subtitle: "Han pasado 15 días desde que quedó listo", alert_title: "Recordatorio de recogida", alert_message: "Tu equipo permanece listo para recoger. Queremos asegurarnos de que no pierdas tu reparación ni tus accesorios.", main_message: "Pasa por la tienda cuando te sea conveniente. Si necesitas más tiempo, contáctanos para ayudarte.", show_hours: true, show_warranty: true, show_checklist: true, show_photos: true },
  pickup_reminder_3: { name: "Recordatorio Urgente de Recogida (3 días)", header_title: "Recoge tu equipo lo antes posible", header_subtitle: "Último recordatorio de recogida", alert_title: "Tu equipo sigue esperando", alert_message: "Tu orden continúa lista para recoger y han pasado varios días desde la notificación inicial.", main_message: "Por favor coordina tu visita o contáctanos hoy mismo si necesitas una excepción.", show_hours: true, show_warranty: true, show_checklist: true, show_photos: true },
  picked_up: { name: "Equipo Recogido", header_title: "¡Gracias por Recoger tu Equipo!", header_subtitle: "Orden completada", alert_title: "Equipo entregado exitosamente", alert_message: "Has recogido tu equipo. Esperamos que esté funcionando perfectamente.", main_message: "Recuerda que cuentas con garantía sobre la reparación realizada.", show_warranty: true, show_review_request: true },
  delivered: { name: "Orden Entregada", header_title: "¡Orden Completada!", header_subtitle: "Tu equipo ha sido entregado", alert_title: "¡Entrega Exitosa!", alert_message: "Gracias por confiar en nosotros. Esperamos que disfrutes tu equipo como nuevo.", main_message: "Tu satisfacción es nuestra prioridad. Esperamos verte pronto.", show_warranty: true, show_review_request: true },
  cancelled: { name: "Orden Cancelada", header_title: "Orden Cancelada", header_subtitle: "Información importante", alert_title: "Tu orden ha sido cancelada", alert_message: "Esta orden ha sido cancelada según tu solicitud o por las condiciones acordadas.", main_message: "Si tienes alguna pregunta sobre esta cancelación, no dudes en contactarnos.", show_hours: true },
  warranty: { name: "Servicio de Garantía", header_title: "Servicio de Garantía", header_subtitle: "Tu equipo en garantía", alert_title: "Recibimos tu equipo bajo garantía", alert_message: "Hemos recibido tu equipo para servicio bajo garantía. Lo evaluaremos y te contactaremos pronto.", main_message: "Revisaremos tu equipo cuidadosamente para identificar y resolver el problema cubierto por la garantía.", show_warranty: true },
  warranty_check_15: { name: "Seguimiento de Garantía (15 días)", header_title: "Seguimiento de tu garantía", header_subtitle: "Queremos confirmar que todo sigue funcionando bien", alert_title: "Revisión de satisfacción", alert_message: "Han pasado 15 días desde tu entrega y queremos confirmar que el equipo sigue funcionando correctamente.", main_message: "Si notas cualquier comportamiento relacionado con la reparación, responde a este correo o contáctanos.", show_warranty: true, show_review_request: true },
  warranty_expired: { name: "Garantía Vencida", header_title: "Tu garantía ha finalizado", header_subtitle: "Gracias por confiar en nosotros", alert_title: "Fin del periodo de garantía", alert_message: "El periodo de garantía de tu reparación ya concluyó.", main_message: "Si necesitas soporte adicional, puedes visitarnos y con gusto evaluamos el equipo nuevamente.", show_review_request: true },
  deposit_received: { name: "Recibo de Depósito", header_title: "Depósito recibido", header_subtitle: "Tu pago parcial fue registrado", alert_title: "Pago aplicado correctamente", alert_message: "Hemos recibido tu depósito y ya fue aplicado a la orden.", main_message: "Conserva este correo como referencia. Tu balance pendiente aparece actualizado más abajo." },
  payment_received: { name: "Recibo de Pago", header_title: "Pago recibido", header_subtitle: "Tu recibo está listo", alert_title: "Pago confirmado", alert_message: "Tu pago fue procesado correctamente y quedó registrado en la orden.", main_message: "Guarda este correo como evidencia de tu pago. Si el balance llegó a cero, tu orden queda saldada." },
  reparacion_externa: { name: "Reparación Externa", header_title: "Reparación con Servicio Externo", header_subtitle: "Tu equipo va a un especialista", alert_title: "Tu equipo está siendo enviado a reparación externa", alert_message: "Para una mejor atención, tu dispositivo será enviado a un taller especializado.", main_message: "Te notificaremos cuando regrese y esté listo para recoger." },
  sale_completed: { name: "Venta Completada", header_title: "¡Gracias por tu Compra!", header_subtitle: "Tu recibo de venta está listo", alert_title: "Venta procesada exitosamente", alert_message: "Tu compra fue registrada correctamente. Gracias por elegirnos.", main_message: "Guarda este correo como comprobante de tu compra." },
  refund_processed: { name: "Reembolso Procesado", header_title: "Reembolso Procesado", header_subtitle: "Tu devolución fue registrada", alert_title: "Reembolso aplicado", alert_message: "Tu reembolso ha sido procesado y registrado correctamente.", main_message: "Si tienes alguna pregunta sobre el proceso, no dudes en contactarnos." },
};

function buildSystemTemplate(eventType) {
  const def = DEFAULT_TEMPLATE_DEFS[eventType];
  if (!def) return null;
  return {
    event_type: eventType,
    enabled: true,
    send_to: 'customer',
    show_checklist: def.show_checklist !== false,
    show_photos: def.show_photos !== false,
    show_phone_contact: true,
    show_whatsapp_contact: true,
    is_default: true,
    is_system_template: true,
    ...def,
  };
}

// ── Auto-seed all default templates for a tenant ──────────────────────────────
async function seedDefaultTemplatesForTenant(tenant_id) {
  const rows = Object.keys(DEFAULT_TEMPLATE_DEFS).map(eventType => ({
    tenant_id,
    event_type: eventType,
    enabled: true,
    send_to: 'customer',
    ...buildSystemTemplate(eventType),
    is_system_template: undefined, // not a DB column
  }));

  try {
    const res = await fetch(`${SB_URL}/rest/v1/email_template`, {
      method: 'POST',
      headers: {
        ...sbH(),
        'Prefer': 'resolution=ignore-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    });
    if (res.ok) {
      console.log(`✅ Seeded ${rows.length} default email templates for tenant ${tenant_id}`);
    } else {
      const err = await res.text().catch(() => res.status);
      console.warn(`⚠️ Could not seed email templates: ${err}`);
    }
  } catch (e) {
    console.warn(`⚠️ seed templates error: ${e.message}`);
  }
}

// ── Supabase helpers ──────────────────────────────────────────────────────────
function sbH() {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
  };
}

async function sbQuery(table, params) {
  // Build query string; don't encode 'select' param (PostgREST needs literal *)
  const parts = Object.entries(params).map(([k, v]) =>
    k === 'select' ? `${k}=${v}` : `${k}=${encodeURIComponent(v)}`
  );
  const qs = parts.join('&');
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?${qs}`, { headers: sbH() });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

// ── Template helpers (ported from emailTemplateRuntime.js) ───────────────────
function getAlertColorForStatus(status) {
  const colors = {
    intake:                      { bg: "#F0FDF4", border: "#10B981", title: "#065F46", text: "#064E3B" },
    diagnosing:                  { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" },
    awaiting_approval:           { bg: "#FFFBEB", border: "#F59E0B", title: "#B45309", text: "#78350F" },
    waiting_parts:               { bg: "#FFF7ED", border: "#F97316", title: "#C2410C", text: "#7C2D12" },
    pending_order:               { bg: "#FEF3C7", border: "#F59E0B", title: "#92400E", text: "#78350F" },
    part_arrived_waiting_device: { bg: "#F0F9FF", border: "#0EA5E9", title: "#0369A1", text: "#075985" },
    in_progress:                 { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" },
    ready_for_pickup:            { bg: "#F0FDF4", border: "#10B981", title: "#065F46", text: "#064E3B" },
    delivered:                   { bg: "#ECFDF5", border: "#059669", title: "#047857", text: "#065F46" },
    picked_up:                   { bg: "#ECFDF5", border: "#059669", title: "#047857", text: "#065F46" },
    cancelled:                   { bg: "#FEF2F2", border: "#DC2626", title: "#991B1B", text: "#7F1D1D" },
    warranty:                    { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" },
    pickup_reminder_15:          { bg: "#FFFBEB", border: "#F59E0B", title: "#B45309", text: "#78350F" },
    pickup_reminder_3:           { bg: "#FEF2F2", border: "#DC2626", title: "#991B1B", text: "#7F1D1D" },
    warranty_check_15:           { bg: "#ECFDF5", border: "#10B981", title: "#047857", text: "#065F46" },
    warranty_expired:            { bg: "#EEF2FF", border: "#6366F1", title: "#3730A3", text: "#4338CA" },
    payment_received:            { bg: "#ECFDF5", border: "#10B981", title: "#047857", text: "#065F46" },
    deposit_received:            { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" },
  };
  return colors[status] || { bg: "#F9FAFB", border: "#6B7280", title: "#374151", text: "#1F2937" };
}

function interpolate(text, variables) {
  if (typeof text !== "string") return text || "";
  return text.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
    const value = variables[key.trim()];
    return value === undefined || value === null ? "" : String(value);
  });
}

function buildVariables(orderData = {}) {
  return {
    order_number:   orderData.order_number   || "",
    customer_name:  orderData.customer_name  || "",
    device_info:    orderData.device_info    || "",
    initial_problem: orderData.initial_problem || "",
    amount:         orderData.amount   != null ? Number(orderData.amount).toFixed(2)     : "",
    balance:        orderData.balance  != null ? Number(orderData.balance).toFixed(2)    : "",
    total_paid:     orderData.total_paid != null ? Number(orderData.total_paid).toFixed(2) : "",
    sale_number:    orderData.sale_number    || "",
    payment_method: orderData.payment_method || "",
    days_remaining: orderData.days_remaining != null ? String(orderData.days_remaining) : "",
    days_elapsed:   orderData.days_elapsed   != null ? String(orderData.days_elapsed)   : "",
    delivered_date: orderData.delivered_date || "",
  };
}

function buildEmailHtml(template, businessInfo, branding, order_data) {
  const logoUrl      = branding.logo_url || DEFAULT_LOGO_URL;
  const alertColor   = getAlertColorForStatus(template._event_type || "");
  const variables    = buildVariables(order_data);

  const nextStepsHTML = template.show_next_steps && template.next_steps_items?.length ? `
    <div style="background:#F0F9FF;border-radius:16px;padding:24px;margin:30px 0;border:2px solid #BFDBFE;">
      <h3 style="color:#1E40AF;font-size:18px;font-weight:800;margin:0 0 16px 0;">🔄 Próximos Pasos</h3>
      <ol style="margin:0;padding-left:20px;color:#1E3A8A;font-size:15px;line-height:1.8;">
        ${template.next_steps_items.map(s => `<li style="margin:8px 0;">${interpolate(s, variables)}</li>`).join("")}
      </ol>
    </div>` : "";

  const hoursHTML = (() => {
    if (!template.show_hours) return "";
    if (template.custom_hours) {
      return `<div style="background:#ECFDF5;border-radius:16px;padding:28px;margin:35px 0;text-align:center;border:2px solid #10B981;">
        <p style="font-size:20px;font-weight:800;color:#065F46;margin:0 0 16px 0;">🕐 Horario de Recogida</p>
        <p style="color:#047857;font-size:16px;font-weight:600;margin:0;line-height:1.6;white-space:pre-line;">${template.custom_hours}</p>
      </div>`;
    }
    const days = [
      { key: "hours_monday", label: "Lunes" },
      { key: "hours_tuesday", label: "Martes" },
      { key: "hours_wednesday", label: "Miércoles" },
      { key: "hours_thursday", label: "Jueves" },
      { key: "hours_friday", label: "Viernes" },
      { key: "hours_saturday", label: "Sábado" },
      { key: "hours_sunday", label: "Domingo" },
    ];
    const hasSpecific = days.some(d => businessInfo[d.key]);
    if (!hasSpecific) {
      return `<div style="background:#ECFDF5;border-radius:16px;padding:28px;margin:35px 0;text-align:center;border:2px solid #10B981;">
        <p style="font-size:20px;font-weight:800;color:#065F46;margin:0 0 16px 0;">🕐 Horario de Recogida</p>
        <p style="color:#047857;font-size:18px;font-weight:700;margin:0;">${businessInfo.hours_weekdays || "9:00 AM - 5:00 PM"}</p>
      </div>`;
    }
    const lines = days.filter(d => businessInfo[d.key])
      .map(d => `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(5,150,105,0.1);">
        <span style="font-weight:600;color:#047857;">${d.label}:</span>
        <span style="color:#065F46;">${businessInfo[d.key]}</span>
      </div>`).join("");
    return `<div style="background:#ECFDF5;border-radius:16px;padding:28px;margin:35px 0;border:2px solid #10B981;">
      <p style="font-size:20px;font-weight:800;color:#065F46;margin:0 0 20px 0;text-align:center;">🕐 Horario de Recogida</p>
      <div style="max-width:400px;margin:0 auto;">${lines}</div>
    </div>`;
  })();

  const warrantyText = template.custom_warranty || (template.warranty_type === "sales" ? branding.warranty_sales : branding.warranty_repairs);
  const warrantyHTML = template.show_warranty && warrantyText ? `
    <div style="background:#EFF6FF;border-radius:16px;padding:28px;margin:35px 0;border:2px solid #3B82F6;">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#1D4ED8);padding:12px 24px;border-radius:12px;">
          <p style="color:white;font-size:18px;font-weight:800;margin:0;">🛡️ GARANTÍA</p>
        </div>
      </div>
      <p style="color:#1E40AF;font-size:15px;line-height:1.8;margin:0;text-align:center;font-weight:500;">${interpolate(warrantyText, variables)}</p>
    </div>` : "";

  const reviewLink = template.review_link || businessInfo.google_review_link;
  const reviewHTML = template.show_review_request && reviewLink ? `
    <div style="background:linear-gradient(135deg,#FFFBEB,#FEF3C7);border-radius:16px;padding:32px;margin:35px 0;text-align:center;border:2px solid #FCD34D;">
      <p style="font-size:22px;font-weight:800;color:#78350F;margin:0 0 12px 0;">⭐ ¿Qué tal fue tu experiencia?</p>
      <a href="${reviewLink}" style="display:inline-block;background:linear-gradient(135deg,#EA4335,#FBBC04);color:white;padding:18px 48px;border-radius:12px;text-decoration:none;font-weight:800;font-size:18px;">📝 Dejar una Reseña en Google</a>
    </div>` : "";

  const phoneToUse    = template.custom_phone    || businessInfo.business_phone;
  const whatsappToUse = template.custom_whatsapp || businessInfo.business_whatsapp;
  const showPhone     = template.show_phone_contact    !== false && phoneToUse;
  const showWhatsapp  = template.show_whatsapp_contact !== false && whatsappToUse;
  const contactHTML   = !showPhone && !showWhatsapp ? "" : `
    <div style="background:#F9FAFB;border-radius:12px;padding:24px;margin:30px 0;text-align:center;border:2px solid #E5E7EB;">
      <p style="color:#111827;font-size:15px;font-weight:600;margin:0 0 16px 0;">💬 Contáctanos</p>
      <div style="display:flex;justify-content:center;gap:20px;flex-wrap:wrap;">
        ${showPhone ? `<a href="tel:${phoneToUse}" style="background:#111827;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;">📞 Llamar</a>` : ""}
        ${showWhatsapp ? `<a href="https://wa.me/${String(whatsappToUse).replace(/\D/g, "")}" style="background:#10B981;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:600;">💬 WhatsApp</a>` : ""}
      </div>
    </div>`;

  const checklistHTML = (() => {
    if (!template.show_checklist) return "";
    if (order_data.checklist_items?.length) {
      return `<div style="background:#F0F9FF;border-radius:16px;padding:28px;margin:35px 0;border:2px solid #0EA5E9;">
        <p style="font-size:20px;font-weight:800;color:#075985;margin:0 0 20px 0;text-align:center;">✅ Condiciones Verificadas</p>
        <div style="background:white;border-radius:12px;padding:20px;">
          <div style="display:grid;gap:12px;">
            ${order_data.checklist_items.map(item => {
              const label = typeof item === "string" ? item : item?.label || "";
              return `<div style="display:flex;align-items:center;gap:10px;padding:12px;background:#ECFEFF;border-radius:8px;">
                <span style="color:#10B981;font-size:20px;font-weight:bold;">✓</span>
                <span style="color:#0E7490;font-weight:600;">${interpolate(label, variables)}</span>
              </div>`;
            }).join("")}
          </div>
        </div>
      </div>`;
    }
    return `<div style="background:#F0F9FF;border-radius:16px;padding:28px;margin:35px 0;border:2px solid #0EA5E9;">
      <p style="font-size:20px;font-weight:800;color:#075985;margin:0 0 16px 0;text-align:center;">✅ Condiciones Verificadas</p>
      <p style="color:#0369A1;font-size:14px;text-align:center;margin:0;font-style:italic;">Las condiciones del equipo han sido verificadas por nuestro equipo técnico al momento de la recepción.</p>
    </div>`;
  })();

  const photosHTML = template.show_photos && order_data.photos_metadata?.length ? `
    <div style="background:#F5F3FF;border-radius:16px;padding:28px;margin:35px 0;border:2px solid #A78BFA;">
      <p style="font-size:20px;font-weight:800;color:#5B21B6;margin:0 0 20px 0;text-align:center;">📸 Fotos del Equipo</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;">
        ${order_data.photos_metadata.filter(p => p.visible_to_customer !== false).slice(0, 6)
          .map(photo => `<div style="aspect-ratio:1;border-radius:12px;overflow:hidden;background:#EDE9FE;">
            <img src="${photo.thumbUrl || photo.publicUrl || photo.url}" alt="Foto" style="width:100%;height:100%;object-fit:cover;" />
          </div>`).join("")}
      </div>
    </div>` : "";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:20px;background:#F3F4F6;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:650px;margin:0 auto;background:#fff;">
    <div style="background:linear-gradient(135deg,#00A8E8 0%,#10B981 50%,#A8D700 100%);padding:60px 30px;text-align:center;border-radius:20px 20px 0 0;">
      <img src="${logoUrl}" alt="${businessInfo.business_name || 'SmartFixOS'}" style="height:120px;width:auto;margin:0 auto;display:block;" />
      <h1 style="color:white;margin:20px 0 0;font-size:32px;font-weight:800;">${interpolate(template.header_title, variables)}</h1>
      <p style="color:rgba(255,255,255,0.98);margin:12px 0 0;font-size:18px;font-weight:600;">${interpolate(template.header_subtitle || "", variables)}</p>
    </div>
    <div style="background:white;padding:50px 40px;border-radius:0 0 20px 20px;">
      <p style="font-size:20px;color:#111827;margin:0 0 30px;font-weight:600;">Hola <strong>${variables.customer_name}</strong> 👋</p>
      <div style="border-radius:16px;padding:24px;margin:30px 0;border-left:6px solid;background:${alertColor.bg};border-left-color:${alertColor.border};">
        <p style="margin:0;color:${alertColor.title};font-size:22px;font-weight:800;">${interpolate(template.alert_title, variables)}</p>
        <p style="margin:12px 0 0;color:${alertColor.text};font-size:16px;line-height:1.6;">${interpolate(template.alert_message, variables)}</p>
      </div>
      <div style="background:#F9FAFB;border-radius:16px;padding:28px;margin:30px 0;border:2px solid #E5E7EB;">
        ${variables.order_number ? `<div style="margin-bottom:24px;"><p style="color:#6B7280;font-size:12px;font-weight:700;margin:0 0 6px;">ORDEN</p><p style="color:#111827;font-size:24px;font-weight:800;margin:0;">${variables.order_number}</p></div>` : ""}
        ${variables.device_info  ? `<div><p style="color:#6B7280;font-size:12px;font-weight:700;margin:0 0 6px;">EQUIPO</p><p style="color:#111827;font-size:18px;font-weight:600;margin:0;">${variables.device_info}</p></div>` : ""}
      </div>
      ${nextStepsHTML}${hoursHTML}${checklistHTML}${photosHTML}${warrantyHTML}${reviewHTML}
      ${template.main_message ? `<p style="color:#374151;line-height:1.8;font-size:16px;margin:20px 0;">${interpolate(template.main_message, variables)}</p>` : ""}
      ${contactHTML}
      <div style="margin-top:50px;padding-top:30px;border-top:2px solid #E5E7EB;text-align:center;">
        <img src="${logoUrl}" alt="${businessInfo.business_name || 'SmartFixOS'}" style="height:60px;width:auto;margin:0 auto 20px;opacity:0.7;" />
        <p style="margin:8px 0;color:#111827;font-size:14px;font-weight:700;">${businessInfo.business_name || "SmartFixOS"}</p>
        ${businessInfo.business_address ? `<p style="margin:8px 0;color:#6B7280;font-size:13px;">${businessInfo.business_address}</p>` : ""}
        ${businessInfo.business_phone   ? `<p style="margin:8px 0;color:#6B7280;font-size:13px;">📞 ${businessInfo.business_phone}</p>` : ""}
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { event_type, order_data = {}, tenant_id } = req.body || {};
  if (!event_type) return res.status(400).json({ success: false, error: 'event_type es requerido' });
  if (!tenant_id)  return res.status(400).json({ success: false, error: 'tenant_id es requerido' });
  if (!SB_KEY)     return res.status(500).json({ success: false, error: 'Server misconfiguration' });
  try {
    ensureResendConfigured();
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }

  try {
    // ── Fetch templates and settings in parallel ──────────────────────────────
    // NOTE: app_settings is a GLOBAL table (no tenant_id column) — query by slug only.
    //       email_template IS tenant-scoped — filter by tenant_id.
    const [configRows, legacyRows, businessRows, brandingRows] = await Promise.all([
      sbQuery('app_settings', { 'slug': `eq.${EMAIL_TEMPLATES_SLUG}`, 'select': '*' }),
      sbQuery('email_template', { 'event_type': `eq.${event_type}`, 'enabled': 'eq.true', 'tenant_id': `eq.${tenant_id}`, 'select': '*' }),
      sbQuery('app_settings', { 'slug': `eq.app-main-settings`, 'select': '*' }),
      sbQuery('app_settings', { 'slug': `eq.business-branding`, 'select': '*' }),
    ]);

    // Configured templates (from email-templates-config setting) or legacy table
    const configuredTemplates = Array.isArray(configRows?.[0]?.payload?.templates)
      ? configRows[0].payload.templates
      : [];
    const matchingConfigured = configuredTemplates.filter(
      t => t?.event_type === event_type && t?.enabled !== false
    );
    let templates = matchingConfigured.length > 0 ? matchingConfigured : legacyRows;

    // ── Auto-seed + system-default fallback ───────────────────────────────────
    if (!templates || templates.length === 0) {
      // If tenant has NO templates at all, seed all defaults for them
      if (legacyRows.length === 0) {
        // Check if tenant has ANY templates (not just this event)
        const anyRows = await sbQuery('email_template', {
          'tenant_id': `eq.${tenant_id}`,
          'select': 'id',
          'limit': '1',
        });
        if (!anyRows || anyRows.length === 0) {
          // No templates at all — seed all defaults (fire-and-forget style)
          seedDefaultTemplatesForTenant(tenant_id);
        }
      }

      // Always fall back to in-memory system default so the email sends NOW
      const sysDefault = buildSystemTemplate(event_type);
      if (!sysDefault) {
        return res.status(200).json({
          success: false,
          message: `No hay plantilla activa para el evento: ${event_type}`,
        });
      }
      templates = [sysDefault];
      console.log(`ℹ️  Using system default template for ${event_type} (tenant: ${tenant_id})`);
    }

    const template = { ...(templates.find(t => t.is_default) || templates[0]), _event_type: event_type };
    const businessInfo = businessRows?.[0]?.payload || {};
    const branding     = brandingRows?.[0]?.payload  || {};

    // ── Build email HTML ──────────────────────────────────────────────────────
    const emailHTML = buildEmailHtml(template, businessInfo, branding, order_data);
    const variables  = buildVariables(order_data);
    const subjectBase = interpolate(template.header_title || template.name || "Actualización de tu orden", variables);
    const subject    = variables.order_number ? `${subjectBase} - ${variables.order_number}` : subjectBase;

    // ── Determine recipients ──────────────────────────────────────────────────
    const recipients = [];
    if (template.send_to === "customer" || template.send_to === "both") {
      if (order_data.customer_email) recipients.push(order_data.customer_email);
    }
    if (template.send_to === "admin" || template.send_to === "both") {
      recipients.push(businessInfo.business_email || `admin@smartfixos.com`);
    }
    // Default: send to customer if no send_to specified
    if (!template.send_to && order_data.customer_email) {
      recipients.push(order_data.customer_email);
    }

    if (recipients.length === 0) {
      return res.status(200).json({ success: false, message: 'No hay destinatarios para este email' });
    }

    // ── Send via Resend ───────────────────────────────────────────────────────
    const results = [];
    for (const recipient of recipients) {
      try {
        await sendResendEmail({
          to: recipient,
          subject,
          html: emailHTML,
          fromName: 'SmartFixOS',
          fromEmail: FROM_EMAIL,
        });
        results.push({ recipient, success: true });
        console.log(`✅ Email sent to ${recipient} (event: ${event_type}, tenant: ${tenant_id})`);
      } catch (error) {
        console.error(`❌ Resend error for ${recipient}:`, error.message);
        results.push({ recipient, success: false, error: String(error.message) });
      }
    }

    const anySuccess = results.some(r => r.success);
    return res.status(200).json({
      success: anySuccess,
      template_used: template.name || template.event_type,
      subject,
      results,
    });

  } catch (e) {
    console.error('send-email error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
