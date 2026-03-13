/**
 * POST /api/seed-email-templates
 * Seeds all default email templates for a tenant (or all tenants).
 * Safe to call multiple times — uses "ignore-duplicates" conflict strategy.
 *
 * Body: { tenantId?: string }
 *   - If tenantId provided: seed only that tenant
 *   - If omitted: seed ALL tenants (SuperAdmin use)
 */

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbH() {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
  };
}

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

function buildDefaultRows(tenant_id) {
  return Object.keys(DEFAULT_TEMPLATE_DEFS).map(eventType => {
    const def = DEFAULT_TEMPLATE_DEFS[eventType];
    return {
      tenant_id,
      event_type: eventType,
      enabled: true,
      send_to: 'customer',
      show_phone_contact: true,
      show_whatsapp_contact: true,
      show_checklist: def.show_checklist !== false,
      show_photos: def.show_photos !== false,
      is_default: true,
      ...def,
    };
  });
}

async function seedForTenant(tenant_id) {
  const rows = buildDefaultRows(tenant_id);
  const res = await fetch(`${SB_URL}/rest/v1/email_template`, {
    method: 'POST',
    headers: {
      ...sbH(),
      'Prefer': 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.status);
    throw new Error(`seed failed for ${tenant_id}: ${err}`);
  }
  return rows.length;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  if (!SB_KEY) return res.status(500).json({ success: false, error: 'Server misconfiguration' });

  const { tenantId } = req.body || {};

  try {
    if (tenantId) {
      // Seed a single tenant
      const count = await seedForTenant(tenantId);
      return res.status(200).json({
        success: true,
        message: `✅ ${count} plantillas sembradas para la tienda`,
        tenant: tenantId,
        count,
      });
    }

    // No tenantId — seed ALL active tenants
    const tenantsRes = await fetch(`${SB_URL}/rest/v1/tenant?select=id,name&status=neq.deleted`, {
      headers: sbH(),
    });
    if (!tenantsRes.ok) throw new Error('Could not fetch tenants');
    const tenants = await tenantsRes.json();

    const results = [];
    for (const t of tenants) {
      try {
        const count = await seedForTenant(t.id);
        results.push({ id: t.id, name: t.name, seeded: count, ok: true });
      } catch (e) {
        results.push({ id: t.id, name: t.name, ok: false, error: e.message });
      }
    }

    const ok = results.filter(r => r.ok).length;
    return res.status(200).json({
      success: true,
      message: `✅ Plantillas sembradas para ${ok}/${tenants.length} tiendas`,
      results,
    });

  } catch (e) {
    console.error('seed-email-templates error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
