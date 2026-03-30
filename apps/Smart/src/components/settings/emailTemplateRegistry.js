export const EVENT_TYPES = {
  intake: {
    label: "Orden: Recepción",
    icon: "📥",
    emoji: "📱",
    color: "from-emerald-500 to-green-600",
    alertColor: { bg: "#F0FDF4", border: "#10B981", title: "#065F46", text: "#064E3B" }
  },
  diagnosing: {
    label: "Orden: Diagnóstico",
    icon: "🔍",
    emoji: "🔬",
    color: "from-sky-500 to-blue-600",
    alertColor: { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" }
  },
  awaiting_approval: {
    label: "Orden: Esperando Aprobación",
    icon: "⏳",
    emoji: "🤝",
    color: "from-amber-500 to-yellow-600",
    alertColor: { bg: "#FFFBEB", border: "#F59E0B", title: "#B45309", text: "#78350F" }
  },
  waiting_parts: {
    label: "Orden: Esperando Pieza",
    icon: "📦",
    emoji: "⏰",
    color: "from-orange-500 to-red-500",
    alertColor: { bg: "#FFF7ED", border: "#F97316", title: "#C2410C", text: "#7C2D12" }
  },
  pending_order: {
    label: "Orden: Pendiente Ordenar",
    icon: "🛒",
    emoji: "📋",
    color: "from-yellow-500 to-amber-600",
    alertColor: { bg: "#FEF3C7", border: "#F59E0B", title: "#92400E", text: "#78350F" }
  },
  in_progress: {
    label: "Orden: En Reparación",
    icon: "🔧",
    emoji: "⚡",
    color: "from-cyan-500 to-blue-600",
    alertColor: { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" }
  },
  part_arrived_waiting_device: {
    label: "Orden: Pieza Lista",
    icon: "📬",
    emoji: "📦",
    color: "from-sky-500 to-cyan-600",
    alertColor: { bg: "#F0F9FF", border: "#0EA5E9", title: "#0369A1", text: "#075985" }
  },
  reparacion_externa: {
    label: "Orden: Reparación Externa",
    icon: "🏢",
    emoji: "🔧",
    color: "from-violet-500 to-purple-600",
    alertColor: { bg: "#F5F3FF", border: "#8B5CF6", title: "#6D28D9", text: "#5B21B6" }
  },
  ready_for_pickup: {
    label: "Orden: Listo para Recoger",
    icon: "✅",
    emoji: "✨",
    color: "from-emerald-500 to-green-600",
    alertColor: { bg: "#F0FDF4", border: "#10B981", title: "#065F46", text: "#064E3B" }
  },
  pickup_reminder_15: {
    label: "Recordatorio: Recoger en 15 días",
    icon: "⏰",
    emoji: "📦",
    color: "from-amber-500 to-yellow-600",
    alertColor: { bg: "#FFFBEB", border: "#F59E0B", title: "#B45309", text: "#78350F" }
  },
  pickup_reminder_3: {
    label: "Recordatorio: Recoger en 3 días",
    icon: "🚨",
    emoji: "📦",
    color: "from-red-500 to-rose-600",
    alertColor: { bg: "#FEF2F2", border: "#DC2626", title: "#991B1B", text: "#7F1D1D" }
  },
  picked_up: {
    label: "Orden: Recogido",
    icon: "🤝",
    emoji: "🙏",
    color: "from-green-500 to-emerald-600",
    alertColor: { bg: "#ECFDF5", border: "#059669", title: "#047857", text: "#065F46" }
  },
  delivered: {
    label: "Orden: Entregado",
    icon: "🚚",
    emoji: "🙏",
    color: "from-green-500 to-emerald-600",
    alertColor: { bg: "#ECFDF5", border: "#059669", title: "#047857", text: "#065F46" }
  },
  cancelled: {
    label: "Orden: Cancelado",
    icon: "❌",
    emoji: "📞",
    color: "from-red-500 to-rose-600",
    alertColor: { bg: "#FEF2F2", border: "#DC2626", title: "#991B1B", text: "#7F1D1D" }
  },
  warranty: {
    label: "Orden: Garantía",
    icon: "🛡️",
    emoji: "🔧",
    color: "from-amber-500 to-yellow-600",
    alertColor: { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" }
  },
  warranty_check_15: {
    label: "Garantía: Seguimiento 15 días",
    icon: "🧪",
    emoji: "🛡️",
    color: "from-emerald-500 to-green-600",
    alertColor: { bg: "#ECFDF5", border: "#10B981", title: "#047857", text: "#065F46" }
  },
  warranty_expired: {
    label: "Garantía: Vencida",
    icon: "⌛",
    emoji: "🛡️",
    color: "from-indigo-500 to-violet-600",
    alertColor: { bg: "#EEF2FF", border: "#6366F1", title: "#3730A3", text: "#4338CA" }
  },
  deposit_received: {
    label: "Pago: Depósito recibido",
    icon: "💵",
    emoji: "🧾",
    color: "from-sky-500 to-blue-600",
    alertColor: { bg: "#EFF6FF", border: "#3B82F6", title: "#1E40AF", text: "#1E3A8A" }
  },
  payment_received: {
    label: "Pago: Recibo generado",
    icon: "💳",
    emoji: "🧾",
    color: "from-emerald-500 to-green-600",
    alertColor: { bg: "#ECFDF5", border: "#10B981", title: "#047857", text: "#065F46" }
  },
  sale_completed: {
    label: "Venta: Completada",
    icon: "💰",
    emoji: "🎉",
    color: "from-emerald-500 to-green-600",
    alertColor: { bg: "#ECFDF5", border: "#10B981", title: "#047857", text: "#065F46" }
  },
  refund_processed: {
    label: "Venta: Reembolso",
    icon: "💸",
    emoji: "🔄",
    color: "from-orange-500 to-amber-600",
    alertColor: { bg: "#FEF2F2", border: "#F59E0B", title: "#B45309", text: "#78350F" }
  }
};

export const DEFAULT_TEMPLATES = {
  intake: {
    name: "Orden Recibida",
    header_title: "¡Orden Recibida!",
    header_subtitle: "Tu equipo está en buenas manos",
    alert_title: "Orden confirmada",
    alert_message: "Hemos recibido tu equipo y ya estamos trabajando en ello.",
    main_message: "Te mantendremos informado en cada paso del proceso. Recibirás actualizaciones automáticas por email cuando haya cambios en el estado de tu orden.",
    show_next_steps: true,
    next_steps_items: ["Diagnóstico: Evaluaremos tu equipo en detalle", "Cotización: Te contactaremos con el costo y tiempo estimado", "Reparación: Una vez aprobado, comenzamos el trabajo", "Notificación: Te avisaremos cuando esté listo"],
    show_hours: false,
    show_warranty: false,
    show_review_request: false,
    show_checklist: true,
    show_photos: true
  },
  diagnosing: {
    name: "Diagnóstico en Proceso",
    header_title: "Diagnóstico en Proceso",
    header_subtitle: "Estamos evaluando tu equipo",
    alert_title: "Tu equipo está siendo diagnosticado",
    alert_message: "Nuestro equipo técnico está evaluando tu dispositivo para determinar el problema y la mejor solución.",
    main_message: "Te contactaremos pronto con el diagnóstico completo y la cotización de reparación.",
    show_checklist: true,
    show_photos: true
  },
  awaiting_approval: {
    name: "Esperando Aprobación",
    header_title: "Cotización Lista",
    header_subtitle: "Esperamos tu aprobación",
    alert_title: "Hemos completado el diagnóstico",
    alert_message: "Tu equipo ha sido evaluado. Por favor revisa la cotización y confirma para proceder con la reparación.",
    main_message: "Contacta con nosotros para aprobar la reparación o si tienes alguna pregunta sobre la cotización.",
    show_checklist: true,
    show_photos: true
  },
  waiting_parts: {
    name: "Esperando Piezas",
    header_title: "Orden de Piezas en Proceso",
    header_subtitle: "Actualizamos el estado de tu orden",
    alert_title: "Estamos ordenando las piezas necesarias",
    alert_message: "Hemos identificado las piezas que necesita tu equipo. Ya las ordenamos y te notificaremos cuando lleguen para comenzar la reparación.",
    main_message: "El tiempo de espera depende del proveedor, pero te mantendremos informado del progreso."
  },
  pending_order: {
    name: "Pendiente de Ordenar",
    header_title: "Piezas pendientes de ordenar",
    header_subtitle: "Estamos organizando tu reparación",
    alert_title: "Cotización y piezas en revisión",
    alert_message: "Estamos validando piezas, costos y disponibilidad antes de proceder con la reparación.",
    main_message: "Te notificaremos cuando las piezas estén ordenadas o si necesitamos tu aprobación adicional."
  },
  part_arrived_waiting_device: {
    name: "Pieza Lista - Esperando Equipo",
    header_title: "¡La Pieza Ya Llegó!",
    header_subtitle: "Esperamos que traigas tu equipo",
    alert_title: "La pieza necesaria ya está aquí",
    alert_message: "¡Buenas noticias! La pieza que necesitábamos para tu reparación ya llegó. Por favor trae tu equipo para que podamos comenzar el trabajo.",
    main_message: "Una vez tengamos tu equipo, comenzaremos la reparación de inmediato.",
    show_hours: true
  },
  in_progress: {
    name: "En Reparación",
    header_title: "Reparación en Progreso",
    header_subtitle: "Estamos trabajando en tu equipo",
    alert_title: "Tu equipo está siendo reparado",
    alert_message: "Nuestro equipo técnico está trabajando activamente en la reparación de tu dispositivo.",
    main_message: "Te notificaremos tan pronto esté listo para recoger."
  },
  ready_for_pickup: {
    name: "Listo para Recoger",
    header_title: "¡Tu Equipo Está Listo!",
    header_subtitle: "Ya puedes venir a recogerlo",
    alert_title: "¡Reparación Completada!",
    alert_message: "¡Buenas noticias! Tu equipo ha sido reparado exitosamente y está listo para que lo recojas.",
    main_message: "Estamos comprometidos a brindarte el mejor servicio. Si tienes alguna pregunta, no dudes en contactarnos.",
    show_hours: true,
    show_warranty: true,
    show_review_request: false,
    show_checklist: true,
    show_photos: true
  },
  pickup_reminder_15: {
    name: "Recordatorio de Recogida (15 días)",
    header_title: "Tu equipo sigue listo para recoger",
    header_subtitle: "Han pasado 15 días desde que quedó listo",
    alert_title: "Recordatorio de recogida",
    alert_message: "Tu equipo permanece listo para recoger. Queremos asegurarnos de que no pierdas tu reparación ni tus accesorios.",
    main_message: "Pasa por la tienda cuando te sea conveniente. Si necesitas más tiempo, contáctanos para ayudarte.",
    show_hours: true,
    show_warranty: true,
    show_checklist: true,
    show_photos: true
  },
  pickup_reminder_3: {
    name: "Recordatorio Urgente de Recogida (3 días)",
    header_title: "Recoge tu equipo lo antes posible",
    header_subtitle: "Último recordatorio de recogida",
    alert_title: "Tu equipo sigue esperando",
    alert_message: "Tu orden continúa lista para recoger y han pasado varios días desde la notificación inicial.",
    main_message: "Por favor coordina tu visita o contáctanos hoy mismo si necesitas una excepción.",
    show_hours: true,
    show_warranty: true,
    show_checklist: true,
    show_photos: true
  },
  picked_up: {
    name: "Equipo Recogido",
    header_title: "¡Gracias por Recoger tu Equipo!",
    header_subtitle: "Orden completada",
    alert_title: "Equipo entregado exitosamente",
    alert_message: "Has recogido tu equipo. Esperamos que esté funcionando perfectamente.",
    main_message: "Recuerda que cuentas con garantía sobre la reparación realizada.",
    show_warranty: true,
    show_review_request: true
  },
  delivered: {
    name: "Orden Entregada",
    header_title: "¡Orden Completada!",
    header_subtitle: "Tu equipo ha sido entregado",
    alert_title: "¡Entrega Exitosa!",
    alert_message: "Gracias por confiar en nosotros. Esperamos que disfrutes tu equipo como nuevo.",
    main_message: "Tu satisfacción es nuestra prioridad. Esperamos verte pronto.",
    show_hours: false,
    show_warranty: true,
    show_review_request: true,
    show_checklist: false,
    show_photos: false
  },
  cancelled: {
    name: "Orden Cancelada",
    header_title: "Orden Cancelada",
    header_subtitle: "Información importante",
    alert_title: "Tu orden ha sido cancelada",
    alert_message: "Esta orden ha sido cancelada según tu solicitud o por las condiciones acordadas.",
    main_message: "Si tienes alguna pregunta sobre esta cancelación, no dudes en contactarnos.",
    show_hours: true
  },
  warranty: {
    name: "Servicio de Garantía",
    header_title: "Servicio de Garantía",
    header_subtitle: "Tu equipo en garantía",
    alert_title: "Recibimos tu equipo bajo garantía",
    alert_message: "Hemos recibido tu equipo para servicio bajo garantía. Lo evaluaremos y te contactaremos pronto.",
    main_message: "Revisaremos tu equipo cuidadosamente para identificar y resolver el problema cubierto por la garantía.",
    show_warranty: true
  },
  warranty_check_15: {
    name: "Seguimiento de Garantía (15 días)",
    header_title: "Seguimiento de tu garantía",
    header_subtitle: "Queremos confirmar que todo sigue funcionando bien",
    alert_title: "Revisión de satisfacción",
    alert_message: "Han pasado 15 días desde tu entrega y queremos confirmar que el equipo sigue funcionando correctamente.",
    main_message: "Si notas cualquier comportamiento relacionado con la reparación, responde a este correo o contáctanos.",
    show_warranty: true,
    show_review_request: true
  },
  warranty_expired: {
    name: "Garantía Vencida",
    header_title: "Tu garantía ha finalizado",
    header_subtitle: "Gracias por confiar en nosotros",
    alert_title: "Fin del periodo de garantía",
    alert_message: "El periodo de garantía de tu reparación ya concluyó.",
    main_message: "Si necesitas soporte adicional, puedes visitarnos y con gusto evaluamos el equipo nuevamente.",
    show_review_request: true
  },
  deposit_received: {
    name: "Recibo de Depósito",
    header_title: "Depósito recibido",
    header_subtitle: "Tu pago parcial fue registrado",
    alert_title: "Depósito aplicado — ${{total_paid}}",
    alert_message: "Recibimos tu depósito de ${{total_paid}} mediante {{payment_method}}. El desglose completo aparece abajo.",
    main_message: "Conserva este correo como comprobante. Cuando tu orden esté lista te avisaremos para coordinar el balance restante.",
    show_phone_contact: true,
    show_whatsapp_contact: true
  },
  payment_received: {
    name: "Recibo de Pago",
    header_title: "Pago recibido",
    header_subtitle: "Tu recibo está listo",
    alert_title: "Pago confirmado — ${{total_paid}}",
    alert_message: "Procesamos tu pago de ${{total_paid}} mediante {{payment_method}}. El desglose completo aparece abajo.",
    main_message: "Guarda este correo como comprobante de pago. Si tienes alguna pregunta sobre el recibo, contáctanos.",
    show_phone_contact: true,
    show_whatsapp_contact: true
  },
  sale_completed: {
    name: "Recibo de Venta",
    header_title: "¡Gracias por tu compra!",
    header_subtitle: "Tu recibo de venta está listo",
    alert_title: "Venta completada — ${{total_paid}}",
    alert_message: "Completamos tu venta por un total de ${{total_paid}} mediante {{payment_method}}. El detalle aparece abajo.",
    main_message: "¡Gracias por preferirnos! Si tienes alguna pregunta sobre tu compra, con gusto te atendemos.",
    show_review_request: true,
    show_phone_contact: true,
    show_whatsapp_contact: true
  },
  refund_processed: {
    name: "Reembolso Procesado",
    header_title: "Reembolso procesado",
    header_subtitle: "Tu devolución ha sido registrada",
    alert_title: "Reembolso de ${{total_paid}} en proceso",
    alert_message: "Procesamos tu reembolso de ${{total_paid}} al método {{payment_method}}. El detalle aparece abajo.",
    main_message: "Los reembolsos pueden tardar entre 3 y 10 días hábiles en reflejarse según tu banco o método de pago. Si tienes dudas, contáctanos.",
    show_phone_contact: true,
    show_whatsapp_contact: true
  }
};

export function buildSystemTemplate(eventType) {
  const defaults = DEFAULT_TEMPLATES[eventType];
  if (!defaults) return null;
  return {
    id: `system-${eventType}`,
    event_type: eventType,
    enabled: true,
    send_to: "customer",
    show_checklist: defaults.show_checklist !== false,
    show_photos: defaults.show_photos !== false,
    show_phone_contact: true,
    show_whatsapp_contact: true,
    is_default: true,
    is_system_template: true,
    ...defaults
  };
}

export function mergeTemplatesWithSystemDefaults(savedTemplates = []) {
  const sortedTemplates = [...(savedTemplates || [])].sort((a, b) => {
    const aPriority = a?.is_default ? 0 : 1;
    const bPriority = b?.is_default ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;

    const aDate = new Date(a?.updated_date || a?.created_date || 0).getTime();
    const bDate = new Date(b?.updated_date || b?.created_date || 0).getTime();
    return aDate - bDate;
  });

  const savedByType = new Map(sortedTemplates.map((template) => [template.event_type, template]));
  const merged = Object.keys(DEFAULT_TEMPLATES).map((eventType) => {
    const saved = savedByType.get(eventType);
    return {
      ...buildSystemTemplate(eventType),
      ...(saved || {})
    };
  });

  const customOnly = sortedTemplates.filter((template) => !DEFAULT_TEMPLATES[template.event_type]);
  return [...merged, ...customOnly];
}
