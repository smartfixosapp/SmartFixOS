/**
 * Helpers para gestión de tokens del portal de clientes
 * 
 * Permite a los clientes acceder al estado de sus órdenes
 * sin necesidad de crear una cuenta o autenticarse.
 */

import { base44 } from "@/api/base44Client";

/**
 * Genera un token único base64 para acceso al portal
 * 
 * @param {string} orderId - ID de la orden
 * @param {number} expiresInDays - Días hasta expiración (null = nunca expira)
 * @returns {Promise<object>} { token, url, expires_at }
 */
export async function generatePortalToken(orderId, expiresInDays = null) {
  try {
    console.log('🔐 Generando token de portal para orden:', orderId);

    // ✅ GENERAR TOKEN BASE64 ÚNICO
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 15);
    const tokenData = `${orderId}:${timestamp}:${randomPart}`;
    const token = btoa(tokenData); // Base64

    // ✅ CALCULAR FECHA DE EXPIRACIÓN
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresInDays);
      expiresAt = expirationDate.toISOString();
    }

    // ✅ GUARDAR TOKEN EN BASE DE DATOS
    const tokenRecord = await base44.entities.CustomerPortalToken.create({
      order_id: orderId,
      token: token,
      expires_at: expiresAt,
      access_count: 0,
      revoked: false,
      metadata: {
        generated_at: new Date().toISOString(),
        generated_by: 'system'
      }
    });

    // ✅ GENERAR URL DEL PORTAL
    const baseUrl = window.location.origin;
    const portalUrl = `${baseUrl}/CustomerPortal?token=${token}`;

    console.log('✅ Token generado:', token);
    console.log('🔗 URL del portal:', portalUrl);

    return {
      token: token,
      url: portalUrl,
      expires_at: expiresAt,
      token_id: tokenRecord.id
    };

  } catch (error) {
    console.error('❌ Error generando token de portal:', error);
    throw error;
  }
}

/**
 * Valida un token y obtiene la orden asociada
 * 
 * @param {string} token - Token base64
 * @returns {Promise<object>} Orden completa con info del token
 */
export async function getOrderByToken(token) {
  try {
    console.log('🔍 Validando token de portal...');

    const result = await base44.functions.invoke('getPortalOrder', {
      token: token
    });

    if (result.success) {
      console.log('✅ Orden obtenida:', result.order.order_number);
      return result;
    } else {
      console.warn('⚠️ Token inválido:', result.error);
      throw new Error(result.error || 'Token inválido');
    }

  } catch (error) {
    console.error('❌ Error obteniendo orden por token:', error);
    throw error;
  }
}

/**
 * Revoca un token para que ya no pueda ser usado
 * 
 * @param {string} tokenId - ID del token a revocar
 * @param {string} reason - Razón de revocación
 */
export async function revokePortalToken(tokenId, reason = '') {
  try {
    console.log('🚫 Revocando token:', tokenId);

    const user = await base44.auth.me();

    await base44.entities.CustomerPortalToken.update(tokenId, {
      revoked: true,
      revoked_at: new Date().toISOString(),
      revoked_by: user?.email || 'system',
      metadata: {
        revocation_reason: reason
      }
    });

    console.log('✅ Token revocado exitosamente');
    return { success: true };

  } catch (error) {
    console.error('❌ Error revocando token:', error);
    throw error;
  }
}

/**
 * Obtiene todos los tokens activos de una orden
 * 
 * @param {string} orderId - ID de la orden
 * @returns {Promise<Array>} Lista de tokens activos
 */
export async function getOrderTokens(orderId) {
  try {
    const tokens = await base44.entities.CustomerPortalToken.filter({
      order_id: orderId,
      revoked: false
    });

    // Filtrar tokens expirados
    const now = new Date();
    const activeTokens = tokens.filter(t => {
      if (!t.expires_at) return true; // Sin expiración
      return new Date(t.expires_at) > now;
    });

    return activeTokens;

  } catch (error) {
    console.error('❌ Error obteniendo tokens de orden:', error);
    throw error;
  }
}

/**
 * Genera y envía por email el enlace del portal al cliente
 * 
 * @param {string} orderId - ID de la orden
 * @param {string} customerEmail - Email del cliente
 * @param {string} customerName - Nombre del cliente
 * @param {number} expiresInDays - Días de validez del enlace
 */
export async function sendPortalLinkEmail(orderId, customerEmail, customerName, expiresInDays = 30) {
  try {
    console.log('📧 Enviando enlace del portal a:', customerEmail);

    // ✅ Generar token
    const { url, expires_at } = await generatePortalToken(orderId, expiresInDays);

    // ✅ Obtener info de la orden
    const orders = await base44.entities.Order.filter({ id: orderId });
    const order = orders[0];

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    // ✅ Formatear fecha de expiración
    let expiryText = '';
    if (expires_at) {
      const expiryDate = new Date(expires_at);
      expiryText = `
        <p style="color: #6B7280; font-size: 14px;">
          🕐 <strong>Nota:</strong> Este enlace expirará el ${expiryDate.toLocaleDateString('es-ES', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      `;
    }

    // ✅ Crear email HTML
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; padding: 20px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #00A8E8 0%, #10B981 50%, #A8D700 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; font-size: 28px; font-weight: bold; margin: 0;">📱 Estado de tu Orden</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
            ${order.order_number}
          </p>
        </div>

        <!-- Body -->
        <div style="padding: 30px; background: #F9FAFB;">
          <p style="font-size: 16px; color: #111827; margin: 0 0 10px 0;">
            Hola <strong>${customerName}</strong>,
          </p>
          
          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            ¡Gracias por confiar en nosotros! Hemos recibido tu dispositivo <strong>${order.device_brand} ${order.device_model}</strong> 
            y estamos trabajando en él.
          </p>

          <p style="font-size: 16px; color: #374151; line-height: 1.6;">
            Puedes ver el estado de tu reparación en tiempo real haciendo clic en el botón de abajo:
          </p>

          <!-- CTA Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${url}" 
               style="display: inline-block; background: linear-gradient(135deg, #00A8E8 0%, #10B981 100%); 
                      color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; 
                      font-size: 16px; font-weight: bold; box-shadow: 0 4px 12px rgba(0,168,232,0.3);">
              🔍 Ver Estado de mi Orden
            </a>
          </div>

          <!-- Info Box -->
          <div style="background: white; border-left: 4px solid #00A8E8; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 0; color: #374151; font-size: 14px;">
              <strong style="color: #00A8E8;">💡 Consejo:</strong> Guarda este email para poder consultar 
              el estado de tu orden en cualquier momento.
            </p>
          </div>

          ${expiryText}

          <p style="font-size: 14px; color: #6B7280; margin-top: 20px;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:
          </p>
          <p style="font-size: 12px; color: #0EA5E9; word-break: break-all; background: #F3F4F6; padding: 10px; border-radius: 4px;">
            ${url}
          </p>
        </div>

        <!-- Footer -->
        <div style="margin-top: 30px; padding: 20px; text-align: center; background: #F3F4F6; border-radius: 0 0 12px 12px;">
          <p style="margin: 0; color: #6B7280; font-size: 12px;">
            Este es un mensaje automático. Si tienes preguntas, contáctanos directamente.
          </p>
          <div style="margin-top: 15px;">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
                 alt="SmartFixOS"
                 style="height: 40px; width: auto;" />
          </div>
        </div>
      </div>
    `;

    // ✅ Enviar email
    await base44.functions.invoke('sendEmail', {
      from_name: "SmartFixOS - Portal de Clientes",
      to_email: customerEmail,
      subject: `📱 Estado de tu Orden ${order.order_number}`,
      body_html: emailBody,
      metadata: {
        order_id: orderId,
        order_number: order.order_number,
        notification_type: 'portal_link',
        token_expires_at: expires_at
      }
    });

    console.log('✅ Email enviado exitosamente');
    return { success: true, url };

  } catch (error) {
    console.error('❌ Error enviando enlace del portal:', error);
    throw error;
  }
}

/**
 * Genera mensaje de WhatsApp con el enlace del portal
 * 
 * @param {string} orderId - ID de la orden
 * @param {string} orderNumber - Número de la orden
 * @param {number} expiresInDays - Días de validez
 * @returns {Promise<object>} { url, message }
 */
export async function generateWhatsAppPortalLink(orderId, orderNumber, expiresInDays = 30) {
  try {
    const { url } = await generatePortalToken(orderId, expiresInDays);

    const message = `
🔧 *Estado de tu Reparación*

Orden: *${orderNumber}*

Puedes consultar el estado de tu dispositivo en tiempo real aquí:
${url}

${expiresInDays ? `⏰ El enlace es válido por ${expiresInDays} días.` : ''}

¡Gracias por tu confianza! 🙌
    `.trim();

    return { url, message };

  } catch (error) {
    console.error('❌ Error generando enlace de WhatsApp:', error);
    throw error;
  }
}

export default {
  generatePortalToken,
  getOrderByToken,
  revokePortalToken,
  getOrderTokens,
  sendPortalLinkEmail,
  generateWhatsAppPortalLink
};
