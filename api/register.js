/**
 * Vercel Serverless Function — /api/register
 * Handles new tenant registration (replaces Render/Deno registerTenant)
 * Runtime: Node.js 18 (Vercel default)
 */

// SB_URL is not secret (already in browser bundle) — hardcode as fallback
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
// SB_KEY must be set in Vercel dashboard as SUPABASE_SERVICE_ROLE_KEY
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@smartfixos.com';
const FROM_NAME = process.env.FROM_NAME || 'SmartFixOS';
const APP_URL = process.env.APP_URL || 'https://smart-fix-os.vercel.app';

const sbHeaders = {
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
};

async function sbSelect(table, filters, select = 'id') {
  const q = Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${q}&select=${select}`, { headers: sbHeaders });
  const text = await res.text();
  if (!res.ok) throw new Error(`SELECT ${table}: ${res.status} ${text}`);
  return JSON.parse(text);
}

async function sbInsert(table, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders, 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`INSERT ${table}: ${res.status} ${text}`);
  const arr = JSON.parse(text);
  return Array.isArray(arr) ? arr[0] : arr;
}

async function sbUpsert(table, data) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(data),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`UPSERT ${table}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function authCreateUser(email, password, fullName) {
  const res = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  const data = await res.json();
  if (!res.ok && res.status !== 422) return { error: data };
  return { data };
}

async function authFindUserByEmail(email) {
  const res = await fetch(`${SB_URL}/auth/v1/admin/users?per_page=1000`, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data?.users || []).find(u => u.email === email) || null;
}

async function sbDelete(table, filters) {
  const q = Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  await fetch(`${SB_URL}/rest/v1/${table}?${q}`, {
    method: 'DELETE',
    headers: sbHeaders,
  });
}

/**
 * Limpia TODOS los registros de un email no activado:
 * system_config, app_employee, users (tabla), tenant
 * También elimina el Supabase Auth user si existe
 */
async function cleanupPendingAccount(email) {
  console.log(`🧹 Limpiando cuenta pendiente: ${email}`);

  // Buscar tenant para obtener tenant_id
  const tenants = await sbSelect('tenant', { email }, 'id');
  const tenantId = tenants[0]?.id;

  // Borrar system_config por tenant_id
  if (tenantId) {
    await sbDelete('system_config', { tenant_id: tenantId });
  }

  // Borrar app_employee
  await sbDelete('app_employee', { email });

  // Borrar users (tabla pública)
  await sbDelete('users', { email });

  // Borrar tenant
  await sbDelete('tenant', { email });

  // Borrar Supabase Auth user
  try {
    const authUser = await authFindUserByEmail(email);
    if (authUser?.id) {
      await fetch(`${SB_URL}/auth/v1/admin/users/${authUser.id}`, {
        method: 'DELETE',
        headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
      });
      console.log(`🗑️ Auth user eliminado: ${authUser.id}`);
    }
  } catch (e) {
    console.warn('Auth delete (non-critical):', e.message);
  }

  console.log(`✅ Cuenta pendiente limpiada: ${email}`);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  if (!SB_KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY not set in Vercel environment variables');
    return res.status(500).json({ success: false, error: 'Server misconfiguration: missing service key. Add SUPABASE_SERVICE_ROLE_KEY in Vercel dashboard.' });
  }

  try {
    const { ownerName, email, password, phone, businessName, country, plan: rawPlan } = req.body || {};

    if (!ownerName || !email || !password) {
      return res.status(400).json({ success: false, error: 'Nombre, email y contraseña son requeridos' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Email inválido' });
    }

    const planMap = { basic: 'smartfixos', pro: 'pro', enterprise: 'enterprise' };
    const plan = planMap[rawPlan] || 'smartfixos';
    const PLANS = {
      smartfixos: { max_users: 1,    monthly_cost: 55,  label: 'Basic'      },
      pro:        { max_users: 3,    monthly_cost: 85,  label: 'Pro'        },
      enterprise: { max_users: 9999, monthly_cost: 0,   label: 'Enterprise' },
    };
    const planCfg = PLANS[plan];

    // 1. Email único — si existe pero nunca activó, limpiar y permitir re-registro
    const existing = await sbSelect('tenant', { email }, 'id,metadata');
    if (existing.length > 0) {
      const meta = existing[0]?.metadata || {};
      const isActivated = meta.setup_complete === true;
      if (isActivated) {
        return res.status(409).json({ success: false, error: 'Este email ya tiene una cuenta activa. ¿Olvidaste tu PIN? Contáctanos.' });
      }
      // Cuenta existe pero nunca completó activación → limpiar automáticamente
      await cleanupPendingAccount(email);
      console.log(`♻️ Re-registro permitido para ${email} (cuenta anterior sin activar)`);
    }

    // 2. Token de activación (24h)
    const { randomUUID } = await import('crypto');
    const activationToken = randomUUID();
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
      name: tenantName, slug, email,
      password_hash: randomUUID(),
      country: country || 'US', currency: 'USD', status: 'active',
      plan, monthly_cost: planCfg.monthly_cost,
      subscription_status: 'active', trial_period_days: 15,
      trial_end_date: trialEndStr, admin_name: ownerName,
      admin_phone: phone || '', timezone: 'America/Puerto_Rico',
      metadata: { max_users: planCfg.max_users, plan_label: planCfg.label, setup_complete: false },
    });
    console.log(`✅ Tenant: ${tenant.id} (${tenantName})`);

    // 4. Supabase Auth user
    let authUserId = null;
    try {
      const { data: authData, error: authErr } = await authCreateUser(email, password, ownerName);
      if (authErr) {
        const found = await authFindUserByEmail(email);
        if (found) authUserId = found.id;
      } else {
        authUserId = authData?.id || authData?.user?.id || null;
      }
    } catch (e) { console.warn('Auth (non-critical):', e.message); }

    // 5. Upsert users
    if (authUserId) {
      try {
        await sbUpsert('users', { id: authUserId, email, full_name: ownerName, role: 'admin', tenant_id: tenant.id, active: false });
      } catch (e) { console.warn('users upsert:', e.message); }
    }

    // 6. Crear app_employee (sin PIN, pendiente activación)
    const employee = await sbInsert('app_employee', {
      full_name: ownerName, email, phone: phone || '', pin: null,
      role: 'admin', status: 'pending', active: false,
      tenant_id: tenant.id, hire_date: now.toISOString().split('T')[0],
      activation_token: activationToken, activation_expires_at: activationExpiry,
    });
    console.log(`✅ Employee: ${employee.id}`);

    // 7. system_config branding inicial
    try {
      await sbInsert('system_config', {
        key: 'settings.branding',
        value: JSON.stringify({ business_name: tenantName, phone: phone || '', email, logo_url: '', primary_color: '#0891b2', secondary_color: '#000000', address: '', timezone: 'America/Puerto_Rico', tax_rate: 0.115, currency: 'USD', date_format: 'MM/dd/yyyy' }),
        category: 'general', description: 'Configuración de branding', tenant_id: tenant.id,
      });
    } catch (e) { console.warn('system_config:', e.message); }

    // 8. Email de activación
    const activationUrl = `${APP_URL}/TenantActivate?token=${activationToken}&email=${encodeURIComponent(email)}`;
    const logoUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png';
    const formattedEnd = trialEndDate.toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });

    if (RESEND_KEY) {
      try {
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Arial,sans-serif;color:#e5e7eb;">
<div style="max-width:600px;margin:0 auto;padding:40px 20px;">
  <div style="text-align:center;margin-bottom:32px;"><img src="${logoUrl}" alt="SmartFixOS" style="height:48px;"/></div>
  <div style="background:linear-gradient(135deg,#0c1a2e,#0a1520);border:1px solid #1e3a5f;border-radius:20px;padding:36px;margin-bottom:20px;">
    <h1 style="color:#fff;font-size:26px;font-weight:800;margin:0 0 8px;text-align:center;">¡Bienvenido a SmartFixOS!</h1>
    <p style="color:#9ca3af;text-align:center;margin:0 0 28px;font-size:15px;">Tu cuenta para <strong style="color:#e5e7eb;">${tenantName}</strong> fue creada ✅</p>
    <div style="background:linear-gradient(135deg,#0e4f6e,#065f46);border:2px solid #06b6d4;border-radius:14px;padding:28px;text-align:center;margin-bottom:28px;">
      <p style="color:#67e8f9;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 16px;">Último paso</p>
      <p style="color:#d1d5db;font-size:14px;margin:0 0 20px;">Configura tu taller y elige tu PIN de acceso</p>
      <a href="${activationUrl}" style="display:inline-block;background:linear-gradient(135deg,#0891b2,#059669);color:#fff;font-weight:800;font-size:17px;padding:16px 44px;border-radius:50px;text-decoration:none;">Activar mi cuenta →</a>
      <p style="color:#a7f3d0;font-size:11px;margin:16px 0 0;">⚠️ Expira en 24 horas</p>
    </div>
    <div style="border-top:1px solid #1e3a5f;padding-top:20px;font-size:14px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span style="color:#9ca3af;">Negocio</span><span style="color:#fff;font-weight:600;">${tenantName}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;"><span style="color:#9ca3af;">Plan</span><span style="color:#fff;font-weight:600;">${planCfg.label}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="color:#9ca3af;">Trial hasta</span><span style="color:#34d399;font-weight:700;">${formattedEnd}</span></div>
    </div>
  </div>
  <div style="text-align:center;font-size:12px;color:#4b5563;">
    <p>¿No creaste esta cuenta? Ignora este mensaje.</p>
    <p>SmartFixOS — Hecho en Puerto Rico 🇵🇷</p>
  </div>
</div></body></html>`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [email], subject: `¡Activa tu cuenta SmartFixOS, ${ownerName}!`, html }),
        });
        console.log(`✅ Email enviado a ${email}`);
      } catch (e) { console.warn('Email:', e.message); }
    }

    return res.status(200).json({
      success: true,
      tenantId: tenant.id,
      tenantName,
      trialEndDate: trialEndStr,
      trialDays: 15,
    });

  } catch (error) {
    console.error('❌ register error:', error.message);
    return res.status(500).json({ success: false, error: `Error: ${error.message}` });
  }
}
