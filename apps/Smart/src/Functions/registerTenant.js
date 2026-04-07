/**
 * registerTenant — Onboarding SaaS self-service (Fase 7 v2)
 *
 * USA ÚNICAMENTE fetch directo al REST API de Supabase.
 * SIN imports de npm (evita fallos de descarga en Render/Deno).
 *
 * Flujo:
 *   1. Validar email único en tabla tenant
 *   2. Generar token de activación (UUID, 24h)
 *   3. Crear registro en tabla tenant (trial 15 días)
 *   4. Crear Supabase Auth user (REST /auth/v1/admin/users)
 *   5. Upsert en tabla users (sin PIN todavía)
 *   6. Crear registro en tabla app_employee (status:pending, sin PIN)
 *   7. Pre-poblar system_config con branding inicial
 *   8. Enviar email con LINK de activación (no PIN)
 */

function getSb() {
  const url = Deno.env.get('VITE_SUPABASE_URL') || Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return { url, key };
}

const SB_HEADERS = (key) => ({
  'Content-Type': 'application/json',
  'apikey': key,
  'Authorization': `Bearer ${key}`,
});

async function sbSelect(table, filters, { url, key }) {
  const q = Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const res = await fetch(`${url}/rest/v1/${table}?${q}&select=id`, {
    headers: SB_HEADERS(key),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`SELECT ${table}: ${res.status} ${text}`);
  return JSON.parse(text);
}

async function sbInsert(table, data, { url, key }) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...SB_HEADERS(key), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`INSERT ${table}: ${res.status} ${text}`);
  const arr = JSON.parse(text);
  return Array.isArray(arr) ? arr[0] : arr;
}

async function sbUpsert(table, data, { url, key }) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...SB_HEADERS(key), 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`UPSERT ${table}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function authCreateUser(email, password, fullName, { url, key }) {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  const data = await res.json();
  if (!res.ok && res.status !== 422) return { error: data };
  return { data };
}

async function authFindUserByEmail(email, { url, key }) {
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=1000`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.users || []).find(u => u.email === email) || null;
}

export async function registerTenantHandler(req) {
  console.log("🦕 registerTenant called");

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }

  try {
    const sb = getSb();
    const body = await req.json().catch(() => ({}));
    const { ownerName, email, password, phone, businessName, country, plan: rawPlan } = body;

    if (!ownerName || !email || !password) {
      return Response.json({ success: false, error: 'Nombre, email y contraseña son requeridos' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ success: false, error: 'Email inválido' }, { status: 400 });
    }

    const planMap = { basic: 'starter', smartfixos: 'starter', pro: 'pro', enterprise: 'pro', business: 'pro' };
    const plan = planMap[rawPlan] || 'starter';
    const PLANS = {
      starter: { max_users: 999, monthly_cost: 14.99, label: 'Starter' },
      pro:     { max_users: 999, monthly_cost: 39.99, label: 'Pro'     },
    };
    const planCfg = PLANS[plan];

    // 0. Límite beta: máximo 5 tenants
    const MAX_TENANTS = 5;
    const sbUrl = sb.url;
    const sbKey = sb.key;
    const countRes = await fetch(`${sbUrl}/rest/v1/tenant?select=id`, {
      headers: { 'apikey': sbKey, 'Authorization': `Bearer ${sbKey}`, 'Prefer': 'count=exact', 'Range': '0-0' },
    });
    const countHeader = countRes.headers.get('content-range');
    const totalTenants = countHeader ? parseInt(countHeader.split('/')[1], 10) : 0;
    if (totalTenants >= MAX_TENANTS) {
      return Response.json({
        success: false,
        error: 'La aplicación está en modo beta cerrado con cupo lleno. Contáctanos para más información.',
      }, { status: 403 });
    }

    // 1. Email único
    const existing = await sbSelect('tenant', { email }, sb);
    if (existing.length > 0) {
      return Response.json({ success: false, error: 'Este email ya tiene una cuenta registrada' }, { status: 409 });
    }

    // 2. Token de activación (24h)
    const activationToken = crypto.randomUUID();
    const activationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Fechas
    const now = new Date();
    const trialEndDate = new Date(now);
    trialEndDate.setDate(trialEndDate.getDate() + 15);
    const trialEndStr = trialEndDate.toISOString().split('T')[0];
    const tenantName = (businessName || ownerName || 'Mi Taller').trim();
    const slug = tenantName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();

    // 3. Crear tenant
    const tenant = await sbInsert('tenant', {
      name: tenantName,
      slug,
      email,
      password_hash: crypto.randomUUID(),
      country: country || 'US',
      currency: 'USD',
      status: 'active',
      plan,
      monthly_cost: planCfg.monthly_cost,
      subscription_status: 'active',
      trial_period_days: 15,
      trial_end_date: trialEndStr,
      admin_name: ownerName,
      admin_phone: phone || '',
      timezone: 'America/Puerto_Rico',
      metadata: { max_users: planCfg.max_users, plan_label: planCfg.label, setup_complete: false },
    }, sb);
    console.log(`✅ Tenant creado: ${tenant.id} (${tenantName})`);

    // 4. Crear Supabase Auth user
    let authUserId = null;
    try {
      const { data: authData, error: authErr } = await authCreateUser(email, password, ownerName, sb);
      if (authErr) {
        const found = await authFindUserByEmail(email, sb);
        if (found) authUserId = found.id;
        console.log('ℹ️ Auth user ya existía:', authUserId);
      } else {
        authUserId = authData?.id || authData?.user?.id || null;
        console.log(`✅ Auth user creado: ${authUserId}`);
      }
    } catch (e) {
      console.warn('Auth user (non-critical):', e.message);
    }

    // 5. Upsert tabla users (sin PIN — se establece en activación)
    if (authUserId) {
      try {
        await sbUpsert('users', {
          id: authUserId,
          email,
          full_name: ownerName,
          role: 'admin',
          tenant_id: tenant.id,
          active: false,
        }, sb);
        console.log(`✅ users upsert OK`);
      } catch (e) {
        console.warn('users upsert (non-critical):', e.message);
      }
    }

    // 6. Crear app_employee (status: pending, sin PIN — se establece en activación)
    const employee = await sbInsert('app_employee', {
      full_name: ownerName,
      email,
      phone: phone || '',
      pin: null,
      role: 'admin',
      status: 'pending',
      active: false,
      tenant_id: tenant.id,
      hire_date: now.toISOString().split('T')[0],
      activation_token: activationToken,
      activation_expires_at: activationExpiry,
    }, sb);
    console.log(`✅ app_employee creado: ${employee.id} (pendiente activación)`);

    // 7. system_config branding inicial
    try {
      await sbInsert('system_config', {
        key: 'settings.branding',
        value: JSON.stringify({
          business_name: tenantName, phone: phone || '', email,
          logo_url: '', primary_color: '#0891b2', secondary_color: '#000000',
          address: '', timezone: 'America/Puerto_Rico', tax_rate: 0.115,
          currency: 'USD', date_format: 'MM/dd/yyyy',
        }),
        category: 'general',
        description: 'Configuración de branding y negocio',
        tenant_id: tenant.id,
      }, sb);
    } catch (e) {
      console.warn('system_config (non-critical):', e.message);
    }

    // 8. Email de activación con LINK (no PIN)
    const appUrl = Deno.env.get('VITE_APP_URL') || 'https://smart-fix-os-smart.vercel.app';
    const activationUrl = `${appUrl}/TenantActivate?token=${activationToken}&email=${encodeURIComponent(email)}`;
    const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png';
    const formattedEnd = trialEndDate.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

    try {
      const resendKey = Deno.env.get('RESEND_API_KEY');
      if (!resendKey) throw new Error('RESEND_API_KEY no configurado');
      const from = `${Deno.env.get('FROM_NAME') || 'SmartFixOS'} <${Deno.env.get('FROM_EMAIL') || 'noreply@smartfixos.com'}>`;

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#e5e7eb;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:40px;">
    <img src="${logoUrl}" alt="SmartFixOS" style="height:50px;" />
  </div>
  <div style="background:linear-gradient(135deg,#0c1a2e,#0a1520);border:1px solid #1e3a5f;border-radius:20px;padding:40px;margin-bottom:24px;">
    <h1 style="color:#fff;font-size:28px;font-weight:800;margin:0 0 8px;text-align:center;">¡Bienvenido a SmartFixOS!</h1>
    <p style="color:#9ca3af;text-align:center;margin:0 0 32px;font-size:16px;">Tu cuenta para <strong style="color:#e5e7eb;">${tenantName}</strong> fue creada ✅</p>
    <div style="background:linear-gradient(135deg,#0e4f6e,#065f46);border:2px solid #06b6d4;border-radius:16px;padding:32px;text-align:center;margin-bottom:32px;">
      <p style="color:#67e8f9;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 20px;">Último paso: activa tu cuenta</p>
      <p style="color:#d1d5db;font-size:14px;margin:0 0 24px;line-height:1.6;">Haz clic para configurar tu taller y elegir tu PIN de acceso</p>
      <a href="${activationUrl}" style="display:inline-block;background:linear-gradient(135deg,#0891b2,#059669);color:#fff;font-weight:800;font-size:18px;padding:18px 48px;border-radius:50px;text-decoration:none;">Activar mi cuenta →</a>
      <p style="color:#a7f3d0;font-size:12px;margin:20px 0 0;">⚠️ Este link expira en 24 horas</p>
    </div>
    <div style="border-top:1px solid #1e3a5f;padding-top:24px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#9ca3af;">Negocio</span><span style="color:#fff;font-weight:600;">${tenantName}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:12px;">
        <span style="color:#9ca3af;">Plan</span><span style="color:#fff;font-weight:600;">${planCfg.label} — ${planCfg.max_users === 9999 ? 'usuarios ilimitados' : planCfg.max_users + ' usuario(s)'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#9ca3af;">Trial gratuito hasta</span><span style="color:#34d399;font-weight:700;">${formattedEnd}</span>
      </div>
    </div>
  </div>
  <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:24px;margin-bottom:24px;">
    <p style="color:#9ca3af;font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px;">¿Qué pasa al activar?</p>
    <ol style="color:#d1d5db;font-size:14px;line-height:2.2;padding-left:20px;margin:0;">
      <li>Configuras el nombre y logo de tu taller</li>
      <li>Eliges qué información ver en tu dashboard</li>
      <li>Creas tu PIN de acceso personal (tú lo eliges)</li>
      <li>¡Entras directo a tu sistema!</li>
    </ol>
  </div>
  <div style="text-align:center;">
    <p style="color:#4b5563;font-size:13px;margin:0 0 8px;">¿No creaste esta cuenta? Ignora este mensaje.</p>
    <p style="color:#4b5563;font-size:13px;margin:0 0 8px;">¿Preguntas? <a href="mailto:smartfixosapp@gmail.com" style="color:#22d3ee;">smartfixosapp@gmail.com</a></p>
    <p style="color:#374151;font-size:12px;margin:0;">SmartFixOS — Hecho en Puerto Rico 🇵🇷</p>
  </div>
</div></body></html>`;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject: `¡Activa tu cuenta SmartFixOS, ${ownerName}!`, html }),
      });
      if (!emailRes.ok) throw new Error(`Resend ${emailRes.status}: ${await emailRes.text()}`);
      const r = await emailRes.json();
      console.log(`✅ Email de activación enviado a ${email} — id: ${r.id}`);
    } catch (e) {
      console.warn('Email (non-critical):', e.message);
    }

    return Response.json({
      success: true,
      tenantId: tenant.id,
      tenantName,
      trialEndDate: trialEndStr,
      trialDays: 15,
    });

  } catch (error) {
    const msg = error?.message || String(error);
    console.error('❌ registerTenant error:', msg);
    return Response.json({ success: false, error: `Error interno: ${msg}` }, { status: 500 });
  }
}
