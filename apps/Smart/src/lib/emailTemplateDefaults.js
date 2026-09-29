export const EMAIL_TEMPLATE_DEFAULTS = {
  "intake": {
    "subject": {
      "es": "Recibimos tu equipo · Orden {order_number}",
      "en": "We received your device · Order {order_number}"
    },
    "hero_title": {
      "es": "Hemos recibido tu equipo",
      "en": "We've received your device"
    },
    "hero_line": {
      "es": "Recibimos tu equipo en el taller. Te contactamos cuando completemos el diagnóstico.",
      "en": "We received your device at the shop. We'll contact you when we complete the diagnosis."
    },
    "isActive": true
  },
  "diagnosing": {
    "subject": {
      "es": "Diagnóstico en proceso · Orden {order_number}",
      "en": "Diagnosis in progress · Order {order_number}"
    },
    "hero_title": {
      "es": "Estamos diagnosticando tu equipo",
      "en": "We're diagnosing your device"
    },
    "hero_line": {
      "es": "Nuestro técnico está examinando el equipo para identificar exactamente qué necesita. Te avisamos en cuanto tengamos la cotización lista.",
      "en": "Our technician is examining the device to identify exactly what it needs. We'll let you know as soon as the estimate is ready."
    },
    "isActive": true
  },
  "in_progress": {
    "subject": {
      "es": "Reparación iniciada · Orden {order_number}",
      "en": "Repair started · Order {order_number}"
    },
    "hero_title": {
      "es": "Tu equipo está en reparación",
      "en": "Your device is in repair"
    },
    "hero_line": {
      "es": "Comenzamos con la reparación. Te notificamos en cuanto esté listo para recoger.",
      "en": "We started the repair. We'll notify you as soon as it's ready for pickup."
    },
    "isActive": true
  },
  "waiting_customer": {
    "subject": {
      "es": "Necesitamos tu respuesta · Orden {order_number}",
      "en": "We need your response · Order {order_number}"
    },
    "hero_title": {
      "es": "Necesitamos tu respuesta",
      "en": "We need your response"
    },
    "hero_line": {
      "es": "Tenemos una pregunta sobre tu orden y necesitamos tu decisión para continuar. Responde este correo o llámanos para que sigamos avanzando.",
      "en": "We have a question about your order and need your decision to continue. Reply to this email or call us so we can keep moving."
    },
    "isActive": true
  },
  "waiting_parts": {
    "subject": {
      "es": "Ordenando tu pieza · Orden {order_number}",
      "en": "Ordering your part · Order {order_number}"
    },
    "hero_title": {
      "es": "Estamos ordenando tu pieza",
      "en": "We're ordering your part"
    },
    "hero_line": {
      "es": "Identificamos la pieza que necesita tu equipo y la hemos pedido al proveedor. Te avisamos en cuanto llegue para iniciar la reparación.",
      "en": "We identified the part your device needs and ordered it from the supplier. We'll let you know as soon as it arrives so we can start the repair."
    },
    "isActive": true
  },
  "reparacion_externa": {
    "subject": {
      "es": "Actualización de tu orden · {order_number}",
      "en": "Your order update · {order_number}"
    },
    "hero_title": {
      "es": "Tu equipo está siendo atendido",
      "en": "Your device is being serviced"
    },
    "hero_line": {
      "es": "Tu equipo ha sido enviado a un servicio especializado. Te contactamos cuando regrese al taller.",
      "en": "Your device has been sent to a specialized service. We'll contact you when it returns to the shop."
    },
    "isActive": false
  },
  "part_arrived": {
    "subject": {
      "es": "Pieza lista · Trae tu equipo · Orden {order_number}",
      "en": "Part ready · Bring your device · Order {order_number}"
    },
    "hero_title": {
      "es": "Llegó tu pieza — trae el equipo",
      "en": "Your part arrived — bring the device"
    },
    "hero_line": {
      "es": "Buenas noticias, la pieza que necesitábamos para tu reparación ya llegó al taller. Pasa con tu equipo cuando puedas para iniciar la reparación.",
      "en": "Good news — the part we needed for your repair has arrived at the shop. Bring your device by whenever you can so we can start the repair."
    },
    "isActive": true
  },
  "ready_for_pickup": {
    "subject": {
      "es": "Listo para recoger · Orden {order_number}",
      "en": "Ready for pickup · Order {order_number}"
    },
    "hero_title": {
      "es": "¡Tu equipo está listo para recoger!",
      "en": "Your device is ready for pickup!"
    },
    "hero_line": {
      "es": "Completamos la reparación. Pasa por el taller cuando puedas para entregártelo.",
      "en": "We completed the repair. Stop by the shop when you can to pick it up."
    },
    "isActive": true
  },
  "delivered": {
    "subject": {
      "es": "Recibo · Orden {order_number}",
      "en": "Receipt · Order {order_number}"
    },
    "hero_title": {
      "es": "¡Gracias por confiar en nosotros!",
      "en": "Thank you for trusting us!"
    },
    "hero_line": {
      "es": "Tu equipo ha sido entregado. Conserva este correo como comprobante para garantía o futuras consultas.",
      "en": "Your device has been delivered. Keep this email as proof for warranty or future questions."
    },
    "isActive": true
  },
  "cancelled": {
    "subject": {
      "es": "Orden cancelada · {order_number}",
      "en": "Order cancelled · {order_number}"
    },
    "hero_title": {
      "es": "Tu orden fue cancelada",
      "en": "Your order was cancelled"
    },
    "hero_line": {
      "es": "Cancelamos la orden según solicitud. Si tienes alguna duda, contáctanos.",
      "en": "We cancelled the order as requested. If you have any questions, contact us."
    },
    "isActive": true
  },
  "warranty_expired": {
    "subject": {
      "es": "Tu garantía finalizó · Orden {order_number}",
      "en": "Your warranty ended · Order {order_number}"
    },
    "hero_title": {
      "es": "Tu garantía ha finalizado",
      "en": "Your warranty has ended"
    },
    "hero_line": {
      "es": "El periodo de garantía de tu equipo ha terminado. Cualquier nueva reparación será cotizada por separado.",
      "en": "Your device's warranty period has ended. Any new repair will be quoted separately."
    },
    "isActive": true
  },
  "pending_order": {
    "subject": {
      "es": "Pendiente de ordenar pieza · Orden {order_number}",
      "en": "Pending to order part · Order {order_number}"
    },
    "hero_title": {
      "es": "Vamos a ordenar tu pieza",
      "en": "We'll order your part"
    },
    "hero_line": {
      "es": "Identificamos la pieza que necesita tu equipo. Estamos coordinando la orden y te avisamos en cuanto llegue para iniciar la reparación.",
      "en": "We identified the part your device needs. We're coordinating the order and will let you know as soon as it arrives so we can start the repair."
    },
    "isActive": true
  },
  "device_picked_up": {
    "subject": {
      "es": "Gracias por recoger tu equipo · Orden {order_number}",
      "en": "Thanks for picking up your device · Order {order_number}"
    },
    "hero_title": {
      "es": "Gracias por confiar en nosotros",
      "en": "Thank you for trusting us"
    },
    "hero_line": {
      "es": "Confirmamos que recogiste tu equipo. Si tienes cualquier duda con la reparación, conserva este correo y respóndenos cuando quieras.",
      "en": "We confirm you picked up your device. If you have any questions about the repair, keep this email and reply anytime."
    },
    "isActive": true
  },
  "abandoned": {
    "subject": {
      "es": "Tu equipo sigue sin reclamar · Orden {order_number}",
      "en": "Tu equipo sigue sin reclamar · Orden {order_number}"
    },
    "hero_title": {
      "es": "Tu equipo sigue esperando en el taller",
      "en": "Tu equipo sigue esperando en el taller"
    },
    "hero_line": {
      "es": "Han pasado varios días sin que recojas tu equipo y está acumulando cargos de almacenaje. Pasa a recogerlo lo antes posible para evitar cargos adicionales.",
      "en": "Han pasado varios días sin que recojas tu equipo y está acumulando cargos de almacenaje. Pasa a recogerlo lo antes posible para evitar cargos adicionales."
    },
    "isActive": true
  },
  "not_repairable": {
    "subject": {
      "es": "No pudimos reparar tu equipo · Orden {order_number}",
      "en": "No pudimos reparar tu equipo · Orden {order_number}"
    },
    "hero_title": {
      "es": "No pudimos reparar tu equipo",
      "en": "No pudimos reparar tu equipo"
    },
    "hero_line": {
      "es": "Revisamos tu equipo a fondo. Lamentablemente el daño no tiene reparación viable. Abajo te mostramos lo que encontramos.",
      "en": "Revisamos tu equipo a fondo. Lamentablemente el daño no tiene reparación viable. Abajo te mostramos lo que encontramos."
    },
    "isActive": true
  },
  "deposit_receipt": {
    "subject": {
      "es": "Recibo de depósito · Orden {order_number}",
      "en": "Deposit receipt · Order {order_number}"
    },
    "hero_title": {
      "es": "Depósito recibido",
      "en": "Deposit received"
    },
    "hero_line": {
      "es": "Confirmamos el depósito que aplicamos a tu orden. Adjuntamos el detalle abajo.",
      "en": "We confirm the deposit applied to your order. Detail attached below."
    },
    "isActive": true
  },
  "payment_receipt": {
    "subject": {
      "es": "Recibo de pago · Orden {order_number}",
      "en": "Payment receipt · Order {order_number}"
    },
    "hero_title": {
      "es": "Pago recibido",
      "en": "Payment received"
    },
    "hero_line": {
      "es": "Recibimos tu pago. Conserva este correo como comprobante.",
      "en": "We received your payment. Keep this email as proof."
    },
    "isActive": true
  },
  "sale_receipt": {
    "subject": {
      "es": "Tu recibo de venta · #{order_number}",
      "en": "Your sales receipt · #{order_number}"
    },
    "hero_title": {
      "es": "¡Gracias por tu compra!",
      "en": "Thank you for your purchase!"
    },
    "hero_line": {
      "es": "Esperamos que disfrutes tu producto. Adjuntamos el recibo abajo para tus archivos.",
      "en": "We hope you enjoy your product. The receipt is attached below for your records."
    },
    "isActive": true
  },
  "refund_processed": {
    "subject": {
      "es": "Reembolso procesado · {order_number}",
      "en": "Reembolso procesado · {order_number}"
    },
    "hero_title": {
      "es": "Reembolso procesado",
      "en": "Refund processed"
    },
    "hero_line": {
      "es": "Procesamos tu reembolso. Dependiendo del banco puede tardar 3-7 días en reflejarse.",
      "en": "We processed your refund. Depending on the bank it may take 3-7 days to show."
    },
    "isActive": true
  }
};

export const ABANDONMENT_DEFAULT_TERMS = {
  "es": "El cliente debe recoger su equipo dentro de los 30 días luego de ser notificado que está listo. Pasado ese plazo aplica un cargo diario por almacenaje. Los equipos no reclamados dentro de los 90 días desde dicha notificación se considerarán abandonados, y el taller podrá disponer de ellos conforme a la ley aplicable para recuperar los costos de reparación y almacenaje.",
  "en": "The customer must pick up their device within 30 days after being notified it is ready. After that period a daily storage fee applies. Devices not claimed within 90 days from that notification will be considered abandoned, and the shop may dispose of them in accordance with applicable law to recover repair and storage costs."
};
