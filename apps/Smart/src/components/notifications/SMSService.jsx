import { base44 } from "@/api/base44Client";
import { formatPhoneE164 } from "@/utils";
import { tenantBrandName } from "@/lib/tenantBrand";

/**
 * Servicio para enviar SMS a clientes
 * Usa Twilio a través de las integraciones de base44
 */
class SMSService {
  /**
   * Verifica si SMS está habilitado en la configuración
   */
  static async isSMSEnabled() {
    try {
      const config = await base44.entities.SystemConfig.filter({ key: "sms_settings" });
      if (!config?.length) return false;
      
      const settings = typeof config[0].value === "string" 
        ? JSON.parse(config[0].value) 
        : config[0].value;
      
      return settings?.enabled === true;
    } catch (error) {
      console.error("Error checking SMS settings:", error);
      return false;
    }
  }

  /**
   * Obtiene la configuración de SMS
   */
  static async getSMSSettings() {
    try {
      const config = await base44.entities.SystemConfig.filter({ key: "sms_settings" });
      if (!config?.length) {
        return {
          enabled: false,
          from_number: "",
          auto_send_ready: true,
          auto_send_reminders: true,
          auto_send_status_changes: false
        };
      }
      
      const settings = typeof config[0].value === "string" 
        ? JSON.parse(config[0].value) 
        : config[0].value;
      
      return settings;
    } catch (error) {
      console.error("Error getting SMS settings:", error);
      return { enabled: false };
    }
  }

  /**
   * Envía un SMS usando la API de Twilio
   */
  static async sendSMS({ to, message, from = null }) {
    try {
      const enabled = await this.isSMSEnabled();
      if (!enabled) {
        console.log("SMS disabled in settings");
        return { success: false, error: "SMS está deshabilitado" };
      }

      // Formatear número a E.164
      const phoneE164 = formatPhoneE164(to);
      
      // Obtener número de origen de la configuración
      const settings = await this.getSMSSettings();
      const fromNumber = from || settings.from_number;

      if (!fromNumber) {
        throw new Error("No hay número de origen configurado");
      }

      // Usar integración de Twilio (simulado - en producción conectar con Twilio real)
      // En base44, esto se haría con una integración custom de Twilio
      const response = await this.sendViaTwilio({
        to: phoneE164,
        from: fromNumber,
        body: message
      });

      // Registrar en auditoría
      try {
        const me = await base44.auth.me().catch(() => null);
        await base44.entities.AuditLog.create({
          action: "sms_sent",
          entity_type: "customer",
          user_id: me?.id || null,
          user_name: me?.full_name || me?.email || "Sistema",
          user_role: me?.role || "system",
          changes: {
            to: phoneE164,
            message: message.substring(0, 100),
            success: true
          }
        });
      } catch (auditError) {
        console.warn("Could not create audit log:", auditError);
      }

      return { success: true, messageId: response.sid };
    } catch (error) {
      console.error("Error sending SMS:", error);
      
      // Registrar error en auditoría
      try {
        const me = await base44.auth.me().catch(() => null);
        await base44.entities.AuditLog.create({
          action: "sms_failed",
          entity_type: "customer",
          user_id: me?.id || null,
          user_name: me?.full_name || me?.email || "Sistema",
          user_role: me?.role || "system",
          changes: {
            to,
            error: error.message,
            success: false
          }
        });
      } catch (auditError) {
        console.warn("Could not create audit log:", auditError);
      }

      return { success: false, error: error.message };
    }
  }

  /**
   * Envía SMS a través de Twilio
   * En producción, esto conectaría con la API real de Twilio
   */
  static async sendViaTwilio({ to, from, body }) {
    // Simular envío (en producción usar Twilio SDK)
    console.log("📱 SMS enviado:", { to, from, body });
    
    // En producción, hacer esto:
    /*
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const client = require('twilio')(accountSid, authToken);
    
    const message = await client.messages.create({
      body,
      from,
      to
    });
    
    return message;
    */
    
    return { 
      sid: `SMS_${Date.now()}`,
      status: "sent",
      to,
      from,
      body
    };
  }

  /**
   * Envía SMS cuando una orden está lista para recoger
   */
  static async sendOrderReadySMS(order) {
    const settings = await this.getSMSSettings();
    if (!settings.enabled || !settings.auto_send_ready) {
      return { success: false, error: "Auto-send disabled" };
    }

    if (!order.customer_phone) {
      return { success: false, error: "No phone number" };
    }

    const message = `🎉 ¡Buenas noticias de ${tenantBrandName()}!

Su ${order.device_brand} ${order.device_model} está listo para recoger.

Orden: ${order.order_number}
${order.balance_due > 0 ? `Saldo pendiente: $${order.balance_due.toFixed(2)}` : '✅ Pagado completamente'}

Horario: Lun-Sáb 9AM-6PM
Traiga esta orden al recoger.

¡Gracias por confiar en nosotros! 🛠️`;

    return await this.sendSMS({
      to: order.customer_phone,
      message
    });
  }

  /**
   * Envía recordatorio de cita
   */
  static async sendAppointmentReminder({ customerPhone, customerName, appointmentDate, orderNumber }) {
    const settings = await this.getSMSSettings();
    if (!settings.enabled || !settings.auto_send_reminders) {
      return { success: false, error: "Auto-send disabled" };
    }

    const message = `📅 Recordatorio de ${tenantBrandName()}

Hola ${customerName},

Le recordamos su cita para el ${appointmentDate}.

Orden: ${orderNumber}

Si necesita reagendar, llámenos al (787) 123-4567.

¡Nos vemos pronto! 🛠️`;

    return await this.sendSMS({
      to: customerPhone,
      message
    });
  }

  /**
   * Envía actualización de estado personalizada
   */
  static async sendStatusUpdateSMS({ order, statusMessage }) {
    const settings = await this.getSMSSettings();
    if (!settings.enabled || !settings.auto_send_status_changes) {
      return { success: false, error: "Auto-send disabled" };
    }

    if (!order.customer_phone) {
      return { success: false, error: "No phone number" };
    }

    const message = `📱 Actualización - ${tenantBrandName()}

Orden: ${order.order_number}
Cliente: ${order.customer_name}

${statusMessage}

Para más detalles, llámenos al (787) 123-4567.`;

    return await this.sendSMS({
      to: order.customer_phone,
      message
    });
  }

  /**
   * Envía promoción personalizada
   */
  static async sendPromotionSMS({ customerPhone, customerName, promotionText }) {
    const settings = await this.getSMSSettings();
    if (!settings.enabled) {
      return { success: false, error: "SMS disabled" };
    }

    const message = `🎁 ¡Oferta Especial! - ${tenantBrandName()}

Hola ${customerName},

${promotionText}

Visítanos o llámanos al (787) 123-4567.

Para cancelar SMS, responde STOP.`;

    return await this.sendSMS({
      to: customerPhone,
      message
    });
  }

  /**
   * Envía SMS masivo a múltiples clientes
   */
  static async sendBulkSMS({ customers, message }) {
    const results = [];
    
    for (const customer of customers) {
      if (!customer.phone) continue;
      
      const customMessage = message
        .replace(/\{name\}/g, customer.name)
        .replace(/\{customer_name\}/g, customer.name);
      
      const result = await this.sendSMS({
        to: customer.phone,
        message: customMessage
      });
      
      results.push({
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        success: result.success,
        error: result.error
      });
      
      // Esperar 1 segundo entre mensajes para evitar rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }

  /**
   * Envía SMS de orden recibida (confirmación inicial)
   */
  static async sendOrderReceivedSMS(order) {
    const settings = await this.getSMSSettings();
    if (!settings.enabled) {
      return { success: false, error: "SMS disabled" };
    }

    if (!order.customer_phone) {
      return { success: false, error: "No phone number" };
    }

    const message = `✅ Orden Recibida - ${tenantBrandName()}

Gracias ${order.customer_name}!

Hemos recibido su ${order.device_brand} ${order.device_model}.

Orden: ${order.order_number}
${order.assigned_to_name ? `Técnico: ${order.assigned_to_name}` : ''}

Le notificaremos cuando esté listo.

📞 (787) 123-4567`;

    return await this.sendSMS({
      to: order.customer_phone,
      message
    });
  }
}

export default SMSService;
