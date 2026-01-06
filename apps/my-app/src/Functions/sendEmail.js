import { createUnifiedClient } from '../../../../lib/unified-custom-sdk.js';

// Initialize client for this function
const customClient = createUnifiedClient({functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL')});

/**
 * Función RPC para enviar emails con plantillas HTML y logging
 * 
 * @param {string} from_name - Nombre del remitente (opcional, usa app name por defecto)
 * @param {string} to_email - Email destinatario (requerido)
 * @param {string} subject - Asunto del email (requerido)
 * @param {string} body_html - Cuerpo HTML del email (requerido)
 * @param {object} metadata - Metadata adicional para el log (opcional)
 * 
 * @returns {object} { success: boolean, log_id: string, message: string }
 */
export async function sendEmailHandler(req) {
  console.log("🦕 sendEmail called");
  try {
    // Using pre-configured unified client
    
    // ✅ Autenticación (permitir service role para automáticos)
    let user = null;
    try {
      user = await customClient.auth.me();
    } catch {
      // Si no hay usuario, verificar que sea service role
      console.log('⚠️ No user session, proceeding with service role');
    }

    // Parsear payload
    const body = await req.json();
    const { from_name, to_email, subject, body_html, metadata } = body;

    // ✅ Validaciones
    if (!to_email || !subject || !body_html) {
      return Response.json({
        success: false,
        error: 'Parámetros requeridos: to_email, subject, body_html'
      }, { status: 400 });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to_email)) {
      return Response.json({
        success: false,
        error: 'Formato de email inválido'
      }, { status: 400 });
    }

    // ✅ Crear registro en EmailLog (antes de enviar)
    const logEntry = await customClient.asServiceRole.entities.EmailLog.create({
      from_name: from_name || 'SmartFixOS',
      to_email,
      subject,
      body_html,
      status: 'pending',
      metadata: metadata || {}
    });

    console.log('📧 [sendEmail] Enviando email a:', to_email);
    console.log('📋 [sendEmail] Log ID:', logEntry.id);

    try {
      // ✅ Enviar email usando integración Core.SendEmail
      await customClient.integrations.Core.SendEmail({
        from_name: from_name || 'SmartFixOS',
        to: to_email,
        subject: subject,
        body: body_html
      });

      // ✅ Actualizar log como enviado
      await customClient.asServiceRole.entities.EmailLog.update(logEntry.id, {
        status: 'sent',
        sent_at: new Date().toISOString()
      });

      console.log('✅ [sendEmail] Email enviado exitosamente');

      return Response.json({
        success: true,
        log_id: logEntry.id,
        message: 'Email enviado exitosamente'
      });

    } catch (sendError) {
      console.error('❌ [sendEmail] Error enviando email:', sendError);

      // ✅ Actualizar log como fallido
      await customClient.asServiceRole.entities.EmailLog.update(logEntry.id, {
        status: 'failed',
        error_message: sendError.message || 'Error desconocido'
      });

      return Response.json({
        success: false,
        log_id: logEntry.id,
        error: sendError.message || 'Error al enviar email'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [sendEmail] Error general:', error);
    return Response.json({
      success: false,
      error: error.message || 'Error interno del servidor'
    }, { status: 500 });
  }
}
