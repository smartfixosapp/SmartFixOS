import { createUnifiedClient } from '../../../../lib/unified-custom-sdk-supabase.js';

/**
 * Onboarding SaaS self-service — Fase 7
 * Registra un nuevo tenant completo en un solo paso:
 *   1. Valida email único
 *   2. Genera PIN de 4 dígitos aleatorio
 *   3. Crea Tenant (workspace aislado, 15 días trial)
 *   4. Crea Supabase Auth user (REST API directa — sin npm)
 *   5. Crea app_employee (admin) con PIN + tenant_id + auth_id
 *   6. Envía email de bienvenida con PIN
 *
 * No requiere sesión de usuario — es pública (registro inicial).
 * Usa fetch directo a Supabase REST/Auth API (sin npm:@supabase/supabase-js)
 */

function getSupabaseConfig() {
  const url = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('VITE_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  return { url, key };
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────

async function sbInsert(table, data, { url, key }) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${table} INSERT ${res.status}: ${text}`);
  const arr = JSON.parse(text);
  return Array.isArray(arr) ? arr[0] : arr;
}

async function sbUpsert(table, data, onConflict, { url, key }) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': `resolution=merge-duplicates,return=representation`,
    },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${table} UPSERT ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function sbSelect(table, filter, { url, key }) {
  const params = Object.entries(filter).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const res = await fetch(`${url}/rest/v1/${table}?${params}&select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${table} SELECT ${res.status}: ${text}`);
  return JSON.parse(text);
}

// ── Supabase Auth Admin helpers (sin npm) ─────────────────────────────────────

async function authAdminCreateUser(email, password, fullName, { url, key }) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data };
  return { data };
}

async function authAdminListUsers({ url, key }) {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
  });
  const data = await res.json();
  return data?.users || [];
}

async function authAdminUpdateUser(userId, updates, { url, key }) {
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify(updates),
  });
  return res.ok;
}

// ── Handler principal ──────────────────────────────────────────────────────────

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

    // Validar email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ success: false, error: 'Email inválido' }, { status: 400 });
    }

    const sb = getSupabaseConfig();
    if (!sb.url || !sb.key) {
      return Response.json({ success: false, error: 'Configuración de servidor incompleta' }, { status: 500 });
    }

    // Plan + límites de usuarios
    const plan = ['basic','pro','enterprise'].includes(rawPlan) ? rawPlan : 'basic';
    const PLAN_CONFIG = {
      basic:      { max_users: 1,    monthly_cost: 55,  label: 'Basic'      },
      pro:        { max_users: 3,    monthly_cost: 85,  label: 'Pro'        },
      enterprise: { max_users: 9999, monthly_cost: 0,   label: 'Enterprise' },
    };
    const planConfig = PLAN_CONFIG[plan];

    // SDK sin auth (service role vía unified client)
    const base44 = createUnifiedClient({
      entitiesPath: new URL('../Entities', import.meta.url).pathname
    });

    // 1. Verificar email único en tenants
    const existing = await base44.asServiceRole.entities.Tenant.filter({ email });
    if (existing && existing.length > 0) {
      return Response.json({
        success: false,
        error: 'Este email ya tiene una cuenta registrada'
      }, { status: 409 });
    }

    // 2. Generar PIN de 4 dígitos (criptográficamente seguro)
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    const pin = String(1000 + (arr[0] % 9000)).padStart(4, '0');

    // 3. Calcular fechas de trial
    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + 15);
    const trialEndStr = trialEndDate.toISOString().split('T')[0];

    const tenantName = (businessName || ownerName || 'Mi Taller').trim();
    const slug = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();

    // 4. Crear Tenant
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

    console.log(`✅ Tenant creado: ${tenant.id} (${tenantName})`);

    // 5. Crear Supabase Auth user (REST directo)
    let authUserId = null;
    try {
      const { data: authData, error: authError } = await authAdminCreateUser(email, password, ownerName, sb);
      if (authError) {
        // Si ya existe, buscar por email
        if (authError?.msg?.includes('already') || authError?.code === 'email_exists' || authError?.message?.includes('already')) {
          const users = await authAdminListUsers(sb);
          const found = users.find(u => u.email === email);
          if (found) {
            await authAdminUpdateUser(found.id, { password }, sb);
            authUserId = found.id;
            console.log(`✅ Auth user actualizado: ${authUserId}`);
          }
        } else {
          console.warn('Auth create error (non-critical):', authError);
        }
      } else {
        authUserId = authData?.user?.id || authData?.id;
        console.log(`✅ Auth user creado: ${authUserId}`);
      }
    } catch (authErr) {
      console.warn('Auth user creation failed (non-critical):', authErr.message);
    }

    // 5b. Upsert en tabla users
    if (authUserId) {
      try {
        await sbUpsert('users', {
          id: authUserId,
          email,
          full_name: ownerName,
          role: 'admin',
          tenant_id: tenant.id,
          pin,
        }, 'id', sb);
        console.log(`✅ Users record upserted: ${email} → tenant ${tenant.id}`);
      } catch (e) {
        console.warn('users upsert (non-critical):', e.message);
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
      auth_id: authUserId || null,
      hire_date: now.toISOString().split('T')[0],
    });

    console.log(`✅ Employee admin creado: ${employee.id} (PIN: ${pin})`);

    // 6b. Pre-poblar system_config con branding inicial
    try {
      const brandingValue = JSON.stringify({
        business_name: tenantName,
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
      await sbInsert('system_config', {
        key: 'settings.branding',
        value: brandingValue,
        category: 'general',
        description: 'Configuración de branding y negocio',
        tenant_id: tenant.id,
      }, sb).catch(e => console.warn('system_config insert (non-critical):', e.message));
      console.log(`✅ SystemConfig pre-poblado para ${tenantName}`);
    } catch (e) {
      console.warn('SystemConfig (non-critical):', e.message);
    }

    // 7. Enviar email de bienvenida con PIN
    const appUrl = Deno.env.get('VITE_APP_URL') || 'https://smart-fix-os-smart.vercel.app/Welcome';
    const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png';
    const formattedTrialEnd = trialEndDate.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

    const emailBody = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#e5e7eb;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:40px;">
      <img src="${logoUrl}" alt="SmartFixOS" style="height:50px;width:auto;object-fit:contain;" />
    </div>
    <div style="background:linear-gradient(135deg,#0c1a2e,#0a1520);border:1px solid #1e3a5f;border-radius:20px;padding:40px;margin-bottom:24px;">
      <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 8px;text-align:center;">¡Bienvenido a SmartFixOS!</h1>
      <p style="color:#9ca3af;text-align:center;margin:0 0 32px;font-size:16px;">Tu cuenta para <strong style="color:#e5e7eb;">${tenantName}</strong> está lista</p>
      <div style="background:linear-gradient(135deg,#0e4f6e,#065f46);border:2px solid #06b6d4;border-radius:16px;padding:32px;text-align:center;margin-bottom:32px;">
        <p style="color:#67e8f9;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 12px;">Tu PIN de Acceso</p>
        <div style="font-size:56px;font-weight:900;letter-spacing:16px;color:#ffffff;font-family:monospace;line-height:1;">${pin}</div>
        <p style="color:#a7f3d0;font-size:12px;margin:16px 0 0;">Usa este PIN para ingresar al sistema</p>
      </div>
      <div style="border-top:1px solid #1e3a5f;padding-top:24px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#9ca3af;">Negocio</span>
          <span style="color:#ffffff;font-weight:600;">${tenantName}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
          <span style="color:#9ca3af;">Trial gratuito hasta</span>
          <span style="color:#34d399;font-weight:700;">${formattedTrialEnd}</span>
        </div>
      </div>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#0891b2,#059669);color:#ffffff;font-weight:700;font-size:16px;padding:16px 40px;border-radius:50px;text-decoration:none;">Ingresar ahora →</a>
    </div>
    <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;margin-bottom:24px;">
      <p style="color:#9ca3af;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">Cómo ingresar</p>
      <ol style="color:#d1d5db;font-size:14px;line-height:1.8;padding-left:20px;margin:0;">
        <li>Ve a <a href="${appUrl}" style="color:#22d3ee;">${appUrl}</a></li>
        <li>Ingresa tu PIN: <strong style="color:#ffffff;font-family:monospace;">${pin}</strong></li>
        <li>¡Listo! Puedes cambiar tu PIN desde <em>Configuración → Mi Perfil</em></li>
      </ol>
    </div>
    <div style="text-align:center;">
      <p style="color:#4b5563;font-size:13px;margin:0 0 8px;">¿Preguntas? <a href="mailto:smartfixosapp@gmail.com" style="color:#22d3ee;">smartfixosapp@gmail.com</a></p>
      <p style="color:#374151;font-size:12px;margin:0;">SmartFixOS — Hecho en Puerto Rico 🇵🇷</p>
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
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [email],
          subject: `¡Bienvenido a SmartFixOS! Tu PIN es ${pin}`,
          html: emailBody,
        }),
      });
      if (!resendRes.ok) throw new Error(`Resend ${resendRes.status}: ${await resendRes.text()}`);
      const r = await resendRes.json();
      console.log(`✅ Email de bienvenida enviado a ${email} — id: ${r.id}`);
    } catch (emailErr) {
      console.warn('Welcome email failed (non-critical):', emailErr.message);
    }

    return Response.json({
      success: true,
      tenantId: tenant.id,
      tenantName,
      trialEndDate: trialEndStr,
      trialDays: 15,
    });

  } catch (error) {
    console.error('registerTenant error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
