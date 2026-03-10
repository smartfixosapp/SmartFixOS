import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';

// 📧 NOTIFICACIONES DE TRIAL AUTOMÁTICAS
// 1. Recordatorio 7 días antes de expirar
// 2. Notificación de expiración
// 3. Mensaje post-activación de plan

export async function trialNotificationServiceHandler(req) {
  console.log("🦕 trialNotificationService called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, tenantId } = await req.json();

    if (action === 'send-trial-reminder') {
      return await sendTrialReminder(base44, tenantId);
    } else if (action === 'send-trial-expiration') {
      return await sendTrialExpiration(base44, tenantId);
    } else if (action === 'send-activation-confirmation') {
      return await sendActivationConfirmation(base44, tenantId);
    } else if (action === 'check-and-notify-all') {
      return await checkAndNotifyAll(base44);
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Trial notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

// 📧 Recordatorio 7 días antes de expirar
async function sendTrialReminder(base44, tenantId) {
  const tenant = await base44.entities.Tenant.get(tenantId);
  
  if (!tenant || !tenant.trial_end_date) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const daysLeft = Math.ceil((new Date(tenant.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24));

  if (daysLeft !== 7) {
    return Response.json({ warning: 'Not 7 days yet' }, { status: 200 });
  }

  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>¡Te quedan 7 días de prueba!</h2>
      <p>Hola ${tenant.admin_name || 'Administrador'},</p>
      <p>Tu período de prueba en SmartFixOS vence en <strong>7 días</strong> (${tenant.trial_end_date}).</p>
      <p>Para continuar usando el sistema sin interrupciones, activa tu plan de pago ahora.</p>
      <p><strong>Plan SmartFixOS: $65/mes</strong></p>
      <a href="https://smartfixos.app/Activate" style="background-color: #00A8E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Activar Plan Ahora
      </a>
      <p style="margin-top: 40px; color: #999; font-size: 12px;">
        Si tienes preguntas, contáctanos: support@smartfixos.com
      </p>
    </div>
  `;

  await base44.integrations.Core.SendEmail({
    to: tenant.email,
    subject: '⏰ Tu prueba gratuita vence en 7 días',
    body: emailBody,
    from_name: 'SmartFixOS'
  });

  // Log notification
  await base44.entities.Notification.create({
    to_email: tenant.email,
    subject: 'Trial reminder (7 days)',
    type: 'trial_reminder',
    tenant_id: tenantId,
    sent_at: new Date().toISOString(),
  });

  return Response.json({ success: true, message: 'Trial reminder sent' });
}

// 📧 Notificación de expiración
async function sendTrialExpiration(base44, tenantId) {
  const tenant = await base44.entities.Tenant.get(tenantId);
  
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #FF6B6B;">Tu período de prueba ha finalizado</h2>
      <p>Hola ${tenant.admin_name || 'Administrador'},</p>
      <p>Tu prueba gratuita en SmartFixOS ha expirado. Para continuar accediendo al sistema y no perder tus datos, necesitas activar un plan.</p>
      <p><strong>Plan SmartFixOS: $65/mes</strong></p>
      <p>✅ Acceso completo al sistema</p>
      <p>✅ Gestión de órdenes de trabajo</p>
      <p>✅ Sistema POS integrado</p>
      <p>✅ Reportes y analíticas</p>
      <a href="https://smartfixos.app/Activate" style="background-color: #00A8E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
        Activar Plan Ahora
      </a>
      <p style="margin-top: 40px; color: #999; font-size: 12px;">
        Tus datos están seguros. No se eliminarán aunque el período haya expirado.
      </p>
    </div>
  `;

  await base44.integrations.Core.SendEmail({
    to: tenant.email,
    subject: '⚠️ Tu período de prueba ha expirado',
    body: emailBody,
    from_name: 'SmartFixOS'
  });

  // Log notification
  await base44.entities.Notification.create({
    to_email: tenant.email,
    subject: 'Trial expired notification',
    type: 'trial_expired',
    tenant_id: tenantId,
    sent_at: new Date().toISOString(),
  });

  // Update tenant
  await base44.entities.Tenant.update(tenantId, {
    trial_status: 'expired',
    subscription_status: 'inactive'
  });

  return Response.json({ success: true, message: 'Trial expiration notification sent' });
}

// 📧 Confirmación post-activación
async function sendActivationConfirmation(base44, tenantId) {
  const tenant = await base44.entities.Tenant.get(tenantId);
  
  if (!tenant) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10B981;">¡Plan activado correctamente!</h2>
      <p>Hola ${tenant.admin_name || 'Administrador'},</p>
      <p>Tu plan de pago en SmartFixOS está activo. ¡Gracias por confiar en nosotros!</p>
      <p><strong>Detalles de tu suscripción:</strong></p>
      <ul>
        <li>Plan: ${tenant.plan || 'SmartFixOS'}</li>
        <li>Costo: $${tenant.monthly_cost || 65}/mes</li>
        <li>Próximo pago: ${tenant.next_billing_date || 'N/A'}</li>
      </ul>
      <p>Acceso completo al sistema disponible 24/7. Tus datos están protegidos con encriptación de grado empresarial.</p>
      <a href="https://smartfixos.app" style="background-color: #00A8E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
        Ir a SmartFixOS
      </a>
      <p style="margin-top: 40px; color: #999; font-size: 12px;">
        ¿Preguntas? Contacta a support@smartfixos.com
      </p>
    </div>
  `;

  await base44.integrations.Core.SendEmail({
    to: tenant.email,
    subject: '✅ Tu plan en SmartFixOS está activo',
    body: emailBody,
    from_name: 'SmartFixOS'
  });

  // Log notification
  await base44.entities.Notification.create({
    to_email: tenant.email,
    subject: 'Plan activated',
    type: 'plan_activated',
    tenant_id: tenantId,
    sent_at: new Date().toISOString(),
  });

  return Response.json({ success: true, message: 'Activation confirmation sent' });
}

// 🔄 Chequeo automático de todos los tenants
async function checkAndNotifyAll(base44) {
  const tenants = await base44.entities.Tenant.list("-created_date", 1000);
  const results = { reminders: 0, expirations: 0, errors: 0 };

  for (const tenant of tenants) {
    try {
      if (!tenant.trial_end_date) continue;

      const daysLeft = Math.ceil(
        (new Date(tenant.trial_end_date) - new Date()) / (1000 * 60 * 60 * 24)
      );

      // Reminder at 7 days
      if (daysLeft === 7 && !tenant.trial_reminder_sent) {
        await sendTrialReminder(base44, tenant.id);
        await base44.entities.Tenant.update(tenant.id, { trial_reminder_sent: true });
        results.reminders++;
      }

      // Expiration notice
      if (daysLeft === 0 && tenant.trial_status !== 'expired') {
        await sendTrialExpiration(base44, tenant.id);
        results.expirations++;
      }
    } catch (error) {
      console.error(`Error processing tenant ${tenant.id}:`, error);
      results.errors++;
    }
  }

  return Response.json({ success: true, results });
}
