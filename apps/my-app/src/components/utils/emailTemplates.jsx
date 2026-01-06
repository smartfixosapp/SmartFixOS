/**
 * Templates de email profesionales para SmartFixOS
 * Header con colores del logo, cuerpo profesional con alto contraste
 */

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png";

const EMAIL_STYLES = {
  container: "font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff;",
  header: "background: linear-gradient(135deg, #00A8E8 0%, #10B981 50%, #A8D700 100%); padding: 60px 30px; text-align: center; border-radius: 20px 20px 0 0;",
  headerTitle: "color: white; margin: 20px 0 0 0; font-size: 32px; font-weight: 800; text-shadow: 0 2px 10px rgba(0,0,0,0.3); letter-spacing: -0.5px;",
  headerSubtitle: "color: rgba(255,255,255,0.98); margin: 12px 0 0 0; font-size: 18px; font-weight: 600; letter-spacing: 0.3px;",
  body: "background: white; padding: 50px 40px; border-radius: 0 0 20px 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.08);",
  greeting: "font-size: 20px; color: #111827; margin: 0 0 30px 0; font-weight: 600;",
  alert: "border-radius: 16px; padding: 24px; margin: 30px 0; border-left: 6px solid;",
  infoBox: "background: #F9FAFB; border-radius: 16px; padding: 28px; margin: 30px 0; border: 2px solid #E5E7EB;",
  infoLabel: "color: #6B7280; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px 0;",
  infoValue: "color: #111827; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;",
  text: "color: #374151; line-height: 1.8; font-size: 16px; margin: 20px 0;",
  checklist: "background: #F9FAFB; border-radius: 12px; padding: 20px; margin: 25px 0; border: 2px solid #E5E7EB;",
  checklistTitle: "color: #111827; font-size: 14px; font-weight: 700; margin: 0 0 12px 0; text-transform: uppercase;",
  checklistItem: "color: #374151; font-size: 14px; margin: 8px 0; padding-left: 24px; position: relative;",
  photoGrid: "display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin: 30px 0;",
  photo: "border: 2px solid #E5E7EB; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: transform 0.2s;",
  button: "display: inline-block; background: linear-gradient(135deg, #00A8E8, #10B981); color: white; padding: 16px 40px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; box-shadow: 0 6px 20px rgba(0,168,232,0.3); transition: all 0.3s;",
  footer: "margin-top: 50px; padding-top: 30px; border-top: 2px solid #E5E7EB; text-align: center;",
  footerText: "margin: 8px 0; color: #6B7280; font-size: 13px; line-height: 1.6;",
  badge: "display: inline-block; background: linear-gradient(135deg, #00A8E8, #10B981); color: white; padding: 8px 20px; border-radius: 20px; font-size: 13px; font-weight: 700; margin: 0 4px; box-shadow: 0 2px 8px rgba(0,168,232,0.3);"
};

/**
 * Email de bienvenida cuando se crea una orden
 */
export function createWelcomeEmail({ 
  orderNumber, 
  customerName, 
  deviceInfo, 
  problem, 
  checklistItems = [], 
  photoUrls = [],
  businessInfo = {}
}) {
  const checklistHTML = checklistItems.length ? `
    <div style="${EMAIL_STYLES.checklist}">
      <h3 style="${EMAIL_STYLES.checklistTitle}">📋 Condiciones Verificadas</h3>
      <ul style="margin: 0; padding: 0; list-style: none;">
        ${checklistItems.map(item => `
          <li style="${EMAIL_STYLES.checklistItem}">
            <span style="position: absolute; left: 0; color: #10B981; font-size: 16px; font-weight: bold;">✓</span>
            ${typeof item === 'string' ? item : item.label}
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  const photosHTML = photoUrls.length ? `
    <div style="margin: 35px 0;">
      <h3 style="color: #111827; font-size: 16px; font-weight: 700; margin: 0 0 16px 0;">📸 Fotos de Evidencia</h3>
      <div style="${EMAIL_STYLES.photoGrid}">
        ${photoUrls.slice(0, 6).map(url => `
          <div style="${EMAIL_STYLES.photo}">
            <img src="${url}" alt="Evidencia" style="width: 100%; height: auto; display: block;" />
          </div>
        `).join('')}
      </div>
      ${photoUrls.length > 6 ? `<p style="text-align: center; color: #6B7280; font-size: 13px; margin-top: 12px;">+${photoUrls.length - 6} foto(s) adicional(es)</p>` : ''}
    </div>
  ` : '';

  return {
    subject: `✅ Orden Recibida - ${orderNumber} | SmartFixOS`,
    body: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Orden Recibida - ${orderNumber}</title>
      </head>
      <body style="margin: 0; padding: 20px; background: #F3F4F6;">
        <div style="${EMAIL_STYLES.container}">
          <!-- Header con gradiente del logo -->
          <div style="${EMAIL_STYLES.header}">
            <img 
              src="${LOGO_URL}"
              alt="SmartFixOS"
              style="height: 120px; width: auto; margin: 0 auto; display: block; filter: drop-shadow(0 4px 20px rgba(0,0,0,0.2));"
            />
            <h1 style="${EMAIL_STYLES.headerTitle}">¡Orden Recibida!</h1>
            <p style="${EMAIL_STYLES.headerSubtitle}">Tu equipo está en buenas manos</p>
          </div>

          <!-- Cuerpo profesional con alto contraste -->
          <div style="${EMAIL_STYLES.body}">
            <p style="${EMAIL_STYLES.greeting}">
              Hola <strong style="color: #111827;">${customerName}</strong> 👋
            </p>

            <!-- Alert de confirmación -->
            <div style="${EMAIL_STYLES.alert} background: #F0FDF4; border-left-color: #10B981;">
              <p style="margin: 0; color: #065F46; font-size: 22px; font-weight: 800;">
                ✅ Orden confirmada
              </p>
              <p style="margin: 12px 0 0 0; color: #064E3B; font-size: 16px; line-height: 1.6;">
                Hemos recibido tu <strong>${deviceInfo || "equipo"}</strong> y ya estamos trabajando en ello.
              </p>
            </div>

            <!-- Información de la orden -->
            <div style="${EMAIL_STYLES.infoBox}">
              <div style="margin-bottom: 24px;">
                <p style="${EMAIL_STYLES.infoLabel}">Número de Orden</p>
                <p style="${EMAIL_STYLES.infoValue}">${orderNumber}</p>
              </div>
              
              <div style="margin-bottom: 24px;">
                <p style="${EMAIL_STYLES.infoLabel}">Equipo</p>
                <p style="color: #111827; font-size: 18px; font-weight: 600; margin: 0;">
                  ${deviceInfo || "—"}
                </p>
              </div>

              ${problem ? `
                <div>
                  <p style="${EMAIL_STYLES.infoLabel}">Problema Reportado</p>
                  <p style="color: #1F2937; font-size: 16px; margin: 6px 0 0 0; line-height: 1.6; background: white; padding: 16px; border-radius: 8px; border: 2px solid #E5E7EB;">
                    ${problem}
                  </p>
                </div>
              ` : ''}
            </div>

            ${checklistHTML}
            ${photosHTML}

            <!-- Próximos pasos -->
            <div style="background: #F0F9FF; border-radius: 16px; padding: 24px; margin: 30px 0; border: 2px solid #BFDBFE;">
              <h3 style="color: #1E40AF; font-size: 18px; font-weight: 800; margin: 0 0 16px 0;">
                🔄 Próximos Pasos
              </h3>
              <ol style="margin: 0; padding-left: 20px; color: #1E3A8A; font-size: 15px; line-height: 1.8;">
                <li style="margin: 8px 0;"><strong>Diagnóstico:</strong> Evaluaremos tu equipo en detalle</li>
                <li style="margin: 8px 0;"><strong>Cotización:</strong> Te contactaremos con el costo y tiempo estimado</li>
                <li style="margin: 8px 0;"><strong>Reparación:</strong> Una vez aprobado, comenzamos el trabajo</li>
                <li style="margin: 8px 0;"><strong>Notificación:</strong> Te avisaremos cuando esté listo</li>
              </ol>
            </div>

            <p style="${EMAIL_STYLES.text}">
              <strong style="color: #111827;">Te mantendremos informado</strong> en cada paso del proceso. 
              Recibirás actualizaciones automáticas por email cuando haya cambios en el estado de tu orden.
            </p>

            ${businessInfo.phone || businessInfo.whatsapp ? `
              <div style="background: #F9FAFB; border-radius: 12px; padding: 24px; margin: 30px 0; text-align: center; border: 2px solid #E5E7EB;">
                <p style="color: #111827; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">
                  💬 Contáctanos
                </p>
                <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
                  ${businessInfo.phone ? `
                    <a href="tel:${businessInfo.phone}" 
                       style="display: inline-flex; align-items: center; gap: 8px; background: #111827; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                      📞 ${businessInfo.phone}
                    </a>
                  ` : ''}
                  ${businessInfo.whatsapp ? `
                    <a href="https://wa.me/${businessInfo.whatsapp.replace(/\D/g, '')}" 
                       style="display: inline-flex; align-items: center; gap: 8px; background: #10B981; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
                      💬 WhatsApp
                    </a>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Footer -->
            <div style="${EMAIL_STYLES.footer}">
              <img 
                src="${LOGO_URL}"
                alt="SmartFixOS"
                style="height: 60px; width: auto; margin: 0 auto 20px auto; display: block; opacity: 0.7;"
              />
              <p style="margin: 8px 0; color: #111827; font-size: 14px; font-weight: 700;">
                SmartFixOS
              </p>
              <p style="margin: 4px 0; color: #6B7280; font-size: 13px;">
                ${businessInfo.slogan || "Tu taller de confianza"}
              </p>
              ${businessInfo.address ? `
                <p style="${EMAIL_STYLES.footerText}">${businessInfo.address}</p>
              ` : ''}
              ${businessInfo.phone ? `
                <p style="${EMAIL_STYLES.footerText}">📞 ${businessInfo.phone}</p>
              ` : ''}
              ${businessInfo.hours_weekdays ? `
                <p style="${EMAIL_STYLES.footerText}">
                  🕐 ${businessInfo.hours_weekdays}
                </p>
              ` : ''}
              <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #E5E7EB;">
                <p style="color: #9CA3AF; font-size: 11px; margin: 0;">
                  ${new Date().toLocaleDateString('es-PR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
                <p style="color: #9CA3AF; font-size: 11px; margin: 8px 0 0 0;">
                  Este es un email automático, por favor no respondas a este mensaje.
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

/**
 * Email de cambio de estado de orden
 */
export function createStatusChangeEmail({
  orderNumber,
  customerName,
  deviceInfo,
  newStatus,
  previousStatus,
  businessInfo = {}
}) {
  const statusMessages = {
    awaiting_approval: {
      icon: '⏳',
      alertBg: '#FFFBEB',
      alertBorder: '#F59E0B',
      alertTitle: '#B45309',
      alertText: '#78350F',
      title: 'Esperando tu Aprobación',
      message: 'Hemos completado el diagnóstico y necesitamos tu confirmación para proceder con la reparación. Puedes responder directamente a este email para aprobar o hacer consultas.',
      emoji: '🤝',
      showReplyNote: true
    },
    waiting_parts: {
      icon: '📦',
      alertBg: '#FFF7ED',
      alertBorder: '#F97316',
      alertTitle: '#C2410C',
      alertText: '#7C2D12',
      title: 'Esperando Piezas',
      message: 'Estamos esperando las piezas necesarias. Te notificaremos cuando lleguen y continuemos con la reparación.',
      emoji: '⏰'
    },
    in_progress: {
      icon: '🔧',
      alertBg: '#EFF6FF',
      alertBorder: '#3B82F6',
      alertTitle: '#1E40AF',
      alertText: '#1E3A8A',
      title: 'Reparación en Proceso',
      message: 'Tu equipo está ahora en manos de nuestros técnicos expertos. Estamos trabajando en ello.',
      emoji: '⚡'
    },
    ready_for_pickup: {
      icon: '🎉',
      alertBg: '#F0FDF4',
      alertBorder: '#10B981',
      alertTitle: '#065F46',
      alertText: '#064E3B',
      title: '¡Tu Equipo Está Listo!',
      message: '¡Buenas noticias! Tu equipo ha sido reparado exitosamente y está listo para que lo recojas.',
      emoji: '✨',
      showHours: true
    },
    delivered: {
      icon: '✅',
      alertBg: '#ECFDF5',
      alertBorder: '#059669',
      alertTitle: '#047857',
      alertText: '#065F46',
      title: '¡Orden Completada!',
      message: 'Gracias por confiar en SmartFixOS. Esperamos que disfrutes tu equipo como nuevo.',
      emoji: '🙏',
      showReview: true,
      showGoogleReview: true
    },
    diagnosing: {
      icon: '🔍',
      alertBg: '#EFF6FF',
      alertBorder: '#3B82F6',
      alertTitle: '#1E40AF',
      alertText: '#1E3A8A',
      title: 'Diagnóstico en Proceso',
      message: 'Estamos realizando un diagnóstico detallado de tu equipo. Te contactaremos pronto con los resultados.',
      emoji: '🔬'
    },
    cancelled: {
      icon: '❌',
      alertBg: '#FEF2F2',
      alertBorder: '#DC2626',
      alertTitle: '#991B1B',
      alertText: '#7F1D1D',
      title: 'Orden Cancelada',
      message: 'Tu orden ha sido cancelada. Si tienes preguntas, no dudes en contactarnos.',
      emoji: '📞'
    }
  };

  const statusInfo = statusMessages[newStatus] || {
    icon: '📋',
    alertBg: '#F9FAFB',
    alertBorder: '#6B7280',
    alertTitle: '#374151',
    alertText: '#1F2937',
    title: 'Actualización de Estado',
    message: 'El estado de tu orden ha cambiado.',
    emoji: '📱'
  };

  const subject = `${statusInfo.icon} ${statusInfo.title} - ${orderNumber}`;

  const replyNoteSection = statusInfo.showReplyNote ? `
    <div style="background: #FEF3C7; border-radius: 16px; padding: 24px; margin: 30px 0; border: 2px solid #F59E0B;">
      <p style="color: #92400E; font-size: 16px; font-weight: 700; margin: 0 0 8px 0; text-align: center;">
        💬 Puedes responder directamente a este email
      </p>
      <p style="color: #78350F; font-size: 14px; margin: 0; text-align: center;">
        Tu respuesta llegará automáticamente a nuestro sistema
      </p>
    </div>
  ` : '';

  const hoursSection = statusInfo.showHours && businessInfo.hours_weekdays ? `
    <div style="background: #ECFDF5; border-radius: 16px; padding: 28px; margin: 35px 0; text-align: center; border: 2px solid #10B981;">
      <p style="font-size: 20px; font-weight: 800; color: #065F46; margin: 0 0 16px 0;">
        🕐 Horario de Recogida
      </p>
      <p style="color: #047857; font-size: 18px; font-weight: 700; margin: 0;">
        ${businessInfo.hours_weekdays}
      </p>
    </div>
  ` : '';

  const googleReviewSection = statusInfo.showGoogleReview && businessInfo.google_review_link ? `
    <div style="background: linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%); border-radius: 16px; padding: 32px; margin: 35px 0; text-align: center; border: 2px solid #FCD34D; box-shadow: 0 4px 16px rgba(251,191,36,0.2);">
      <p style="font-size: 22px; font-weight: 800; color: #78350F; margin: 0 0 12px 0;">
        ⭐ ¿Qué tal fue tu experiencia?
      </p>
      <p style="color: #92400E; font-size: 16px; margin: 0 0 24px 0; line-height: 1.6;">
        Tu opinión es muy importante para nosotros y ayuda a otros clientes a conocernos mejor
      </p>
      <div style="margin: 20px 0;">
        <div style="display: flex; justify-content: center; gap: 8px; font-size: 36px; margin-bottom: 24px;">
          ⭐⭐⭐⭐⭐
        </div>
        <a href="${businessInfo.google_review_link}" 
           style="display: inline-block; background: linear-gradient(135deg, #EA4335, #FBBC04); color: white; padding: 18px 48px; border-radius: 12px; text-decoration: none; font-weight: 800; font-size: 18px; box-shadow: 0 6px 24px rgba(234,67,53,0.4); transition: all 0.3s;">
          📝 Dejar una Reseña en Google
        </a>
      </div>
      <p style="color: #92400E; font-size: 13px; margin: 16px 0 0 0; font-style: italic;">
        Solo toma un minuto y nos ayuda muchísimo 🙏
      </p>
    </div>
  ` : '';

  const reviewSection = statusInfo.showReview && !businessInfo.google_review_link ? `
    <div style="background: #FFFBEB; border-radius: 16px; padding: 28px; margin: 35px 0; text-align: center; border: 2px solid #FCD34D;">
      <p style="font-size: 18px; font-weight: 700; color: #78350F; margin: 0 0 12px 0;">
        ⭐ ¿Qué tal fue tu experiencia?
      </p>
      <p style="color: #92400E; font-size: 14px; margin: 0 0 20px 0;">
        Tu opinión nos ayuda a mejorar cada día
      </p>
      <div style="display: flex; justify-content: center; gap: 8px; font-size: 32px;">
        ⭐⭐⭐⭐⭐
      </div>
    </div>
  ` : '';

  return {
    subject,
    body: `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${statusInfo.title} - ${orderNumber}</title>
      </head>
      <body style="margin: 0; padding: 20px; background: #F3F4F6;">
        <div style="${EMAIL_STYLES.container}">
          <!-- Header con gradiente del logo -->
          <div style="${EMAIL_STYLES.header}">
            <img 
              src="${LOGO_URL}"
              alt="SmartFixOS"
              style="height: 120px; width: auto; margin: 0 auto; display: block; filter: drop-shadow(0 4px 20px rgba(0,0,0,0.2));"
            />
            <h1 style="${EMAIL_STYLES.headerTitle}">${statusInfo.emoji} ${statusInfo.title}</h1>
            <p style="${EMAIL_STYLES.headerSubtitle}">Actualización de tu orden</p>
          </div>

          <!-- Cuerpo profesional -->
          <div style="${EMAIL_STYLES.body}">
            <p style="${EMAIL_STYLES.greeting}">
              Hola <strong style="color: #111827;">${customerName}</strong>,
            </p>

            <!-- Estado Alert con colores profesionales -->
            <div style="${EMAIL_STYLES.alert} background: ${statusInfo.alertBg}; border-left-color: ${statusInfo.alertBorder};">
              <p style="margin: 0; color: ${statusInfo.alertTitle}; font-size: 24px; font-weight: 800;">
                ${statusInfo.icon} ${statusInfo.title}
              </p>
              <p style="margin: 16px 0 0 0; color: ${statusInfo.alertText}; font-size: 17px; line-height: 1.7; font-weight: 500;">
                ${statusInfo.message}
              </p>
            </div>

            <!-- Info de la orden -->
            <div style="${EMAIL_STYLES.infoBox}">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px;">
                <div>
                  <p style="${EMAIL_STYLES.infoLabel}">Orden</p>
                  <p style="${EMAIL_STYLES.infoValue}">${orderNumber}</p>
                </div>
                <div>
                  <p style="${EMAIL_STYLES.infoLabel}">Estado</p>
                  <p style="color: ${statusInfo.alertTitle}; font-size: 20px; font-weight: 800; margin: 0;">
                    ${statusInfo.title}
                  </p>
                </div>
              </div>
              
              <div>
                <p style="${EMAIL_STYLES.infoLabel}">Equipo</p>
                <p style="color: #111827; font-size: 18px; font-weight: 600; margin: 0;">
                  ${deviceInfo || "—"}
                </p>
              </div>
            </div>

            ${replyNoteSection}
            ${hoursSection}
            ${googleReviewSection}
            ${reviewSection}

            <p style="${EMAIL_STYLES.text}">
              Estamos comprometidos a brindarte el mejor servicio. Si tienes alguna pregunta, 
              <strong style="color: #111827;">no dudes en contactarnos</strong>.
            </p>

            ${businessInfo.phone || businessInfo.whatsapp ? `
              <div style="background: #F9FAFB; border-radius: 12px; padding: 24px; margin: 30px 0; text-align: center; border: 2px solid #E5E7EB;">
                <p style="color: #111827; font-size: 15px; font-weight: 600; margin: 0 0 16px 0;">
                  💬 Contáctanos
                </p>
                <div style="display: flex; justify-content: center; gap: 20px; flex-wrap: wrap;">
                  ${businessInfo.phone ? `
                    <a href="tel:${businessInfo.phone}" 
                       style="display: inline-flex; align-items: center; gap: 8px; background: #111827; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                      📞 Llamar
                    </a>
                  ` : ''}
                  ${businessInfo.whatsapp ? `
                    <a href="https://wa.me/${businessInfo.whatsapp.replace(/\D/g, '')}" 
                       style="display: inline-flex; align-items: center; gap: 8px; background: #10B981; color: white; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: 600; box-shadow: 0 4px 12px rgba(16,185,129,0.3);">
                      💬 WhatsApp
                    </a>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Footer -->
            <div style="${EMAIL_STYLES.footer}">
              <img 
                src="${LOGO_URL}"
                alt="SmartFixOS"
                style="height: 60px; width: auto; margin: 0 auto 20px auto; display: block; opacity: 0.7;"
              />
              <p style="margin: 8px 0; color: #111827; font-size: 14px; font-weight: 700;">
                SmartFixOS
              </p>
              <p style="margin: 4px 0; color: #6B7280; font-size: 13px;">
                ${businessInfo.slogan || "Tu taller de confianza"}
              </p>
              ${businessInfo.address ? `
                <p style="${EMAIL_STYLES.footerText}">${businessInfo.address}</p>
              ` : ''}
              ${businessInfo.phone ? `
                <p style="${EMAIL_STYLES.footerText}">📞 ${businessInfo.phone}</p>
              ` : ''}
              ${businessInfo.hours_weekdays ? `
                <p style="${EMAIL_STYLES.footerText}">
                  🕐 ${businessInfo.hours_weekdays}
                </p>
              ` : ''}
              <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #E5E7EB;">
                <p style="color: #9CA3AF; font-size: 11px; margin: 0;">
                  ${new Date().toLocaleDateString('es-PR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric'
                  })}
                </p>
                <p style="color: #9CA3AF; font-size: 11px; margin: 8px 0 0 0;">
                  Este es un email automático, por favor no respondas a este mensaje.
                </p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

/**
 * Cargar configuración del negocio para emails
 */
export async function getBusinessInfo() {
  try {
    const { base44 } = await import("@/api/base44Client");
    const configs = await base44.entities.AppSettings.filter({ slug: "app-main-settings" });
    
    if (configs?.length) {
      const payload = configs[0].payload || {};
      return {
        ...payload,
        phone: payload.business_phone || payload.phone || "",
        whatsapp: payload.business_whatsapp || payload.whatsapp || "",
        address: payload.business_address || payload.address || "",
        google_review_link: payload.google_review_link || ""
      };
    }
    
    return {
      business_name: "SmartFixOS",
      slogan: "Tu taller de confianza",
      phone: "",
      whatsapp: "",
      address: "",
      hours_weekdays: "",
      website: "",
      google_review_link: ""
    };
  } catch (error) {
    console.error("Error loading business info for email:", error);
    return {
      business_name: "SmartFixOS",
      slogan: "Tu taller de confianza"
    };
  }
}
