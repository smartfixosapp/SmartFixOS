import { createUnifiedClient } from '../../../../lib/unified-custom-sdk-supabase.js';
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Onboarding SaaS self-service — Fase 7
 * Registra un nuevo tenant completo en un solo paso:
 *   1. Valida email único
 *   2. Genera PIN de 4 dígitos aleatorio
 *   3. Crea Tenant (workspace aislado, 15 días trial)
 *   4. Crea Supabase Auth user
 *   5. Crea app_employee (admin) con PIN + tenant_id + auth_id
 *   6. Envía email de bienvenida con PIN
 *
 * No requiere sesión de usuario — es pública (registro inicial).
 */
export async function registerTenantHandler(req) {
  console.log("🦕 registerTenant called");
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    const { ownerName, email, password, phone, businessName, country, plan: rawPlan } = await req.json();

    if (!ownerName || !email || !password) {
      return Response.json({
        success: false,
        error: 'Nombre, email y contraseña son requeridos'
      }, { status: 400 });
    }

    // Plan + límites de usuarios
    const plan = ['basic','pro','enterprise'].includes(rawPlan) ? rawPlan : 'basic';
    const PLAN_CONFIG = {
      basic:      { max_users: 1,    monthly_cost: 55,  label: 'Basic'      },
      pro:        { max_users: 3,    monthly_cost: 85,  label: 'Pro'        },
      enterprise: { max_users: 9999, monthly_cost: 0,   label: 'Enterprise' },
    };
    const planConfig = PLAN_CONFIG[plan];

    // Email básico válido
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ success: false, error: 'Email inválido' }, { status: 400 });
    }

    // Cliente service role (sin auth — es registro público)
    const base44 = createUnifiedClient({
      entitiesPath: new URL('../Entities', import.meta.url).pathname
    });

    // Cliente Supabase Admin (para crear auth users)
    const supabaseAdmin = createClient(
      Deno.env.get('VITE_SUPABASE_URL'),
      Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Verificar email único en tenants
    const existing = await base44.asServiceRole.entities.Tenant.filter({ email });
    if (existing && existing.length > 0) {
      return Response.json({
        success: false,
        error: 'Este email ya tiene una cuenta registrada'
      }, { status: 409 });
    }

    // 2. Generar PIN de 4 dígitos (1000–9999, nunca 0000)
    const pin = Math.floor(1000 + Math.random() * 9000).toString();

    // 3. Calcular fechas de trial
    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + 15);
    const trialEndStr = trialEndDate.toISOString().split('T')[0];

    // Crear slug del negocio
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();

    // 4. Crear Tenant
    const tenantName = businessName || ownerName; // wizard lo actualizará después
    const tenant = await base44.asServiceRole.entities.Tenant.create({
      name: tenantName,
      slug,
      email,
      password_hash: crypto.randomUUID(),
      country: country || 'US',
      currency: 'USD',
      status: 'active',
      plan,
      monthly_cost: planConfig.monthly_cost,
      subscription_status: 'trial',
      trial_period_days: 15,
      trial_end_date: trialEndStr,
      admin_name: ownerName,
      admin_phone: phone || '',
      timezone: 'America/Puerto_Rico',
      metadata: {
        max_users: planConfig.max_users,
        plan_label: planConfig.label,
        setup_complete: false,
      },
    });

    console.log(`✅ Tenant creado: ${tenant.id} (${businessName})`);

    // 5. Crear Supabase Auth user (o actualizar si ya existe)
    let authUserId = null;
    try {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: ownerName }
      });
      if (authError) {
        // Si ya existe, buscar y actualizar su contraseña
        if (authError.message?.includes('already been registered') || authError.code === 'email_exists') {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
          const existing = listData?.users?.find(u => u.email === email);
          if (existing) {
            await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
            authUserId = existing.id;
            console.log(`✅ Auth user actualizado: ${authUserId}`);
          }
        } else {
          throw authError;
        }
      } else {
        authUserId = authData.user?.id;
        console.log(`✅ Auth user creado: ${authUserId}`);
      }
    } catch (authErr) {
      console.warn('Auth user creation failed (non-critical):', authErr.message);
      // Continuamos aunque falle — el PIN funciona de todas formas
    }

    // 5b. Upsert users table record (para que Acceso Seguro resuelva tenant correcto)
    if (authUserId) {
      try {
        await supabaseAdmin.from('users').upsert({
          id: authUserId,
          email,
          full_name: ownerName,
          role: 'admin',
          tenant_id: tenant.id,
          pin,
        }, { onConflict: 'id' });
        console.log(`✅ Users table record upserted: ${email} → tenant ${tenant.id}`);
      } catch (userRecordErr) {
        console.warn('Could not upsert users table record:', userRecordErr.message);
      }
    }

    // 6. Crear app_employee (primer admin)
    const employee = await base44.asServiceRole.entities.AppEmployee.create({
      full_name: ownerName,
      email,
      phone: phone || '',
      pin,
      role: 'admin',
      status: 'active',
      active: true,
      tenant_id: tenant.id,
      hire_date: now.toISOString().split('T')[0],
    });

    console.log(`✅ Employee admin creado: ${employee.id} (PIN: ${pin})`);

    // 6b. Pre-poblar SystemConfig con nombre del negocio para que el dashboard lo muestre
    try {
      const brandingValue = JSON.stringify({
        business_name: businessName,
        phone: phone || '',
        email,
        logo_url: '',
        primary_color: '#0891b2',
        secondary_color: '#000000',
        address: '',
        timezone: 'America/Puerto_Rico',
        tax_rate: 0.115,
        currency: 'USD',
        date_format: 'MM/dd/yyyy',
      });
      await supabaseAdmin.from('system_config').upsert({
        key: 'settings.branding',
        value: brandingValue,
        category: 'general',
        description: 'Configuración de branding y negocio',
        tenant_id: tenant.id,
      }, { onConflict: 'key,tenant_id' }).catch(() =>
        // Si no tiene tenant_id unique, insertar sin conflict
        supabaseAdmin.from('system_config').insert({
          key: 'settings.branding',
          value: brandingValue,
          category: 'general',
          description: 'Configuración de branding y negocio',
          tenant_id: tenant.id,
        })
      );
      // También poblar AppSettings para UserMenuModal
      await supabaseAdmin.from('app_settings').upsert({
        slug: 'app-main-settings',
        payload: { business_name: businessName, business_phone: phone || '', business_email: email },
        tenant_id: tenant.id,
      }, { onConflict: 'slug,tenant_id' }).catch(() =>
        supabaseAdmin.from('app_settings').insert({
          slug: 'app-main-settings',
          payload: { business_name: businessName, business_phone: phone || '', business_email: email },
          tenant_id: tenant.id,
        })
      );
      console.log(`✅ SystemConfig + AppSettings pre-poblados para ${businessName}`);
    } catch (configErr) {
      console.warn('Could not pre-populate SystemConfig (non-critical):', configErr.message);
    }

    // 7. Enviar email de bienvenida con PIN
    const appUrl = Deno.env.get('VITE_APP_URL') || 'https://smart-fix-os-smart.vercel.app/Welcome';
    const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png';
    const formattedTrialEnd = trialEndDate.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

    const emailBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#e5e7eb;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:40px;">
      <img src="${logoUrl}" alt="SmartFixOS" style="height:50px;width:auto;object-fit:contain;" />
    </div>

    <!-- Bienvenida -->
    <div style="background:linear-gradient(135deg,#0c1a2e,#0a1520);border:1px solid #1e3a5f;border-radius:20px;padding:40px;margin-bottom:24px;">
      <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 8px;text-align:center;">
        ¡Bienvenido a SmartFixOS!
      </h1>
      <p style="color:#9ca3af;text-align:center;margin:0 0 32px;font-size:16px;">
        Tu cuenta para <strong style="color:#e5e7eb;">${businessName}</strong> está lista
      </p>

      <!-- PIN Box -->
      <div style="background:linear-gradient(135deg,#0e4f6e,#065f46);border:2px solid #06b6d4;border-radius:16px;padding:32px;text-align:center;margin-bottom:32px;">
        <p style="color:#67e8f9;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;">
          Tu PIN de Acceso
        </p>
        <div style="font-size:56px;font-weight:900;letter-spacing:16px;color:#ffffff;font-family:monospace;line-height:1;">
          ${pin}
        </div>
        <p style="color:#a7f3d0;font-size:12px;margin:16px 0 0;">
          Usa este PIN para ingresar al sistema
        </p>
      </div>

      <!-- Info -->
      <div style="border-top:1px solid #1e3a5f;padding-top:24px;space-y:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#9ca3af;">Negocio</span>
          <span style="color:#ffffff;font-weight:600;">${businessName}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#9ca3af;">Plan</span>
          <span style="color:#34d399;font-weight:600;">15 días Trial Gratis ✓</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#9ca3af;">Trial gratuito hasta</span>
          <span style="color:#34d399;font-weight:700;">${formattedTrialEnd}</span>
        </div>
      </div>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#0891b2,#059669);color:#ffffff;font-weight:700;font-size:16px;padding:16px 40px;border-radius:50px;text-decoration:none;box-shadow:0 0 30px rgba(6,182,212,0.4);">
        Ingresar ahora →
      </a>
    </div>

    <!-- Cómo ingresar -->
    <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="color:#9ca3af;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">
        Cómo ingresar
      </p>
      <ol style="color:#d1d5db;font-size:14px;line-height:1.8;padding-left:20px;margin:0;">
        <li>Ve a <a href="${appUrl}" style="color:#22d3ee;">${appUrl}</a></li>
        <li>Ingresa tu PIN: <strong style="color:#ffffff;font-family:monospace;">${pin}</strong></li>
        <li>¡Listo! Puedes cambiar tu PIN desde <em>Configuración → Mi Perfil</em></li>
      </ol>
    </div>

    <!-- Footer -->
    <div style="text-align:center;">
      <p style="color:#4b5563;font-size:13px;margin:0 0 8px;">
        ¿Preguntas? Escríbenos a <a href="mailto:support@smartfixos.com" style="color:#22d3ee;">support@smartfixos.com</a>
      </p>
      <p style="color:#374151;font-size:12px;margin:0;">
        SmartFixOS — Hecho en Puerto Rico 🇵🇷
      </p>
    </div>

  </div>
</body>
</html>`;

    try {
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) throw new Error('RESEND_API_KEY no configurado');

      const fromEmail = Deno.env.get('FROM_EMAIL') || 'noreply@smartfixos.com';
      const fromName  = Deno.env.get('FROM_NAME')  || 'SmartFixOS';

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [email],
          subject: `¡Bienvenido a SmartFixOS! Tu PIN es ${pin}`,
          html: emailBody,
        }),
      });

      if (!resendRes.ok) {
        const errText = await resendRes.text();
        throw new Error(`Resend ${resendRes.status}: ${errText}`);
      }
      const resendData = await resendRes.json();
      console.log(`✅ Email de bienvenida enviado a ${email} — id: ${resendData.id}`);
    } catch (emailErr) {
      console.warn('Welcome email failed (non-critical):', emailErr.message);
    }

    // Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'tenant_registered',
        entity_type: 'tenant',
        entity_id: tenant.id,
        entity_number: slug,
        severity: 'info',
        metadata: { email, businessName, trialEndDate: trialEndStr }
      });
    } catch (_) { /* non-critical */ }

    return Response.json({
      success: true,
      tenantId: tenant.id,
      tenantName: businessName,
      trialEndDate: trialEndStr,
      trialDays: 15
    });

  } catch (error) {
    console.error('registerTenant error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
