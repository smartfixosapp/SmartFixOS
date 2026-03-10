import { createClientFromRequest } from '../../../../lib/unified-custom-sdk-supabase.js';
import { v4 as uuidv4 } from 'npm:uuid@9.0.1';

// 🏪 CREAR TENANT Y USUARIO ADMIN
// Registro de nueva tienda con trial automático

export async function createTenantHandler(req) {
  console.log("🦕 createTenant called");
  try {
    const base44 = createClientFromRequest(req,{functionsBaseUrl: Deno.env.get('VITE_FUNCTION_URL'),entitiesPath:new URL('../Entities', import.meta.url).pathname});
    const { name, email, password, country, adminName, phone } = await req.json();

    // Validación
    if (!name || !email || !password || !country) {
      return Response.json({ 
        error: 'Name, email, password, and country are required' 
      }, { status: 400 });
    }

    // Verificar que no exista email duplicado
    const existing = await base44.asServiceRole.entities.Tenant.filter({ email });
    if (existing && existing.length > 0) {
      return Response.json({ 
        error: 'Email already registered' 
      }, { status: 409 });
    }

    // Crear slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();

    // Calcular fechas de trial
    const trialStartDate = new Date();
    const trialEndDate = new Date(trialStartDate);
    trialEndDate.setDate(trialEndDate.getDate() + 15); // 15 días de trial

    // Crear Tenant
    const tenantData = {
      name,
      slug,
      email,
      password_hash: await hashPassword(password), // Simple hash (en producción usar bcrypt)
      country,
      currency: 'USD',
      status: 'active',
      plan: 'smartfixos',
      monthly_cost: 65,
      subscription_status: 'trial',
      trial_status: 'active',
      trial_period_days: 15,
      trial_end_date: trialEndDate.toISOString().split('T')[0],
      admin_name: adminName || name,
      admin_phone: phone || '',
      timezone: 'America/Puerto_Rico',
    };

    const tenant = await base44.asServiceRole.entities.Tenant.create(tenantData);

    // Send welcome email
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>¡Bienvenido a SmartFixOS!</h2>
        <p>Hola ${adminName || name},</p>
        <p>Tu tienda <strong>${name}</strong> está lista. Tienes acceso completo durante <strong>15 días</strong>.</p>
        <p><strong>Detalles de tu cuenta:</strong></p>
        <ul>
          <li>Email: ${email}</li>
          <li>Período de prueba: hasta ${trialEndDate.toLocaleDateString()}</li>
        </ul>
        <p>Después de los 15 días, podrás activar tu plan por $65/mes para continuar.</p>
        <a href="https://smartfixos.app" style="background-color: #00A8E8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 20px;">
          Iniciar Sesión
        </a>
        <p style="margin-top: 40px; color: #999; font-size: 12px;">
          ¿Preguntas? Contacta a support@smartfixos.com
        </p>
      </div>
    `;

    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: '¡Bienvenido a SmartFixOS! Tu prueba gratuita está activa',
        body: emailBody,
        from_name: 'SmartFixOS'
      });
    } catch (emailError) {
      console.warn('Email send failed (non-critical):', emailError);
    }

    // Log creation
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'tenant_created',
      entity_type: 'tenant',
      entity_id: tenant.id,
      entity_number: tenant.slug,
      severity: 'info',
      metadata: {
        email,
        country,
        trialDays: 15,
      }
    });

    return Response.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        email: tenant.email,
        trialEndDate: tenant.trial_end_date,
        trialDays: 15,
      }
    });
  } catch (error) {
    console.error('Create tenant error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

// Simple hash function (usar bcrypt en producción)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
