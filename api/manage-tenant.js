import { checkRateLimit, getClientIP, tooManyRequests } from './_lib/rateLimit.js';

/**
 * POST /api/manage-tenant
 * SuperAdmin only: perform management actions on a tenant
 *
 * Actions:
 *   suspend        — set status='suspended'
 *   reactivate     — set status='active'
 *   extend_trial   — add 15 days to trial_end_date
 *   set_plan       — set plan=extra.plan
 *   edit           — set name and/or email from extra.name / extra.email
 *   reset_password — generate Supabase recovery link + send via Resend
 *
 * Body: { tenantId, action, ...extra }
 */

import { randomUUID } from 'crypto';
import { ensureResendConfigured, sendResendEmail } from '../lib/server/resend.js';
import { requireSuperAdmin } from '../lib/server/requireSuperAdmin.js';

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@archillaos.com';

function sbH() {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
  };
}

async function sbPatch(table, filter, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...sbH(), 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.status);
    throw new Error(`PATCH ${table}: ${err}`);
  }
  return res.json();
}

async function sbGet(table, filter, select = '*') {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}&select=${select}`, {
    headers: sbH(),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

async function sbList(table, query) {
  const res = await fetch(`${SB_URL}/rest/v1/${table}?${query}`, { headers: sbH() });
  if (!res.ok) {
    const err = await res.text().catch(() => res.status);
    throw new Error(`GET ${table}: ${err}`);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

async function sbCount(table, filter) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?select=id&${filter}`, {
      headers: { ...sbH(), Prefer: 'count=exact', Range: '0-0' },
    });
    const range = res.headers.get('content-range') || '';
    const total = Number(range.split('/')[1]);
    return Number.isFinite(total) ? total : 0;
  } catch {
    return 0;
  }
}

function pickTenant(t) {
  return {
    id: t.id,
    name: t.name,
    email: t.email,
    admin_name: t.admin_name,
    admin_phone: t.admin_phone,
    country: t.country,
    currency: t.currency,
    plan: t.plan,
    status: t.status,
    subscription_status: t.subscription_status,
    monthly_cost: t.monthly_cost,
    trial_end_date: t.trial_end_date,
    next_billing_date: t.next_billing_date,
    billing_source: t.billing_source,
    apple_product_id: t.apple_product_id,
    created_at: t.created_at,
    last_seen: t.last_seen,
    logo_url: t.logo_url,
  };
}

async function audit(admin, tenantId, action, severity, changes) {
  const now = new Date().toISOString();
  try {
    await fetch(`${SB_URL}/rest/v1/audit_log`, {
      method: 'POST',
      headers: { ...sbH(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: randomUUID(),
        created_at: now,
        updated_at: now,
        created_by_id: admin.email,
        created_by: admin.email,
        action,
        entity_type: 'tenant',
        entity_id: tenantId,
        user_id: admin.email,
        user_name: admin.email,
        user_role: 'super_admin',
        changes: changes || {},
        severity,
        tenant_id: tenantId,
      }),
    });
  } catch {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const admin = await requireSuperAdmin(req);
  if (admin.error) return res.status(admin.status).json({ success: false, error: admin.error });

  // Rate limit: máx 30 acciones admin por IP por 10 minutos
  const rl = checkRateLimit(getClientIP(req), 'manage-tenant', { max: 30, windowMs: 10 * 60_000 });
  if (!rl.ok) return tooManyRequests(res, rl.retryAfterSec);

  const { tenantId, action, ...extra } = req.body || {};
  const tenantlessActions = new Set(['list_tenants', 'list_billing_events']);
  if (!action || (!tenantId && !tenantlessActions.has(action))) {
    return res.status(400).json({ success: false, error: 'tenantId y action son requeridos' });
  }
  if (!SB_KEY) return res.status(500).json({ success: false, error: 'Server misconfiguration' });

  const filter = `id=eq.${encodeURIComponent(tenantId || '')}`;
  const reason = typeof extra.reason === 'string' ? extra.reason.trim().slice(0, 500) : null;

  try {
    if (action === 'list_tenants') {
      const rows = await sbList('tenant', 'select=*&order=created_at.desc&limit=500');
      return res.status(200).json({ success: true, tenants: rows.map(pickTenant) });
    }

    if (action === 'list_billing_events') {
      const rows = await sbList('billing_event', 'select=*&order=created_at.desc&limit=300').catch(() => []);
      return res.status(200).json({ success: true, events: rows });
    }

    if (action === 'tenant_overview') {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const tid = encodeURIComponent(tenantId);
      const [tenantRows, employees, customers, orders, ordersMonth, lastOrder, events, billing] = await Promise.all([
        sbList('tenant', `select=*&${filter}&limit=1`),
        sbCount('app_employee', `tenant_id=eq.${tid}`),
        sbCount('customer', `tenant_id=eq.${tid}`),
        sbCount('order', `tenant_id=eq.${tid}`),
        sbCount('order', `tenant_id=eq.${tid}&created_date=gte.${encodeURIComponent(monthStart.toISOString())}`),
        sbList('order', `select=created_date&tenant_id=eq.${tid}&order=created_date.desc&limit=1`).catch(() => []),
        sbList('audit_log', `select=id,created_at,created_by,action,severity,changes&tenant_id=eq.${tid}&order=created_at.desc&limit=30`).catch(() => []),
        sbList('billing_event', `select=*&tenant_id=eq.${tid}&order=created_at.desc&limit=30`).catch(() => []),
      ]);
      if (!tenantRows[0]) return res.status(404).json({ success: false, error: 'Tienda no encontrada' });
      return res.status(200).json({
        success: true,
        tenant: pickTenant(tenantRows[0]),
        insights: {
          employees,
          customers,
          orders,
          orders_this_month: ordersMonth,
          last_order_at: lastOrder[0]?.created_date || null,
        },
        events,
        billing,
      });
    }

    // ── suspend ──────────────────────────────────────────────────────────────
    if (action === 'suspend') {
      await sbPatch('tenant', filter, { status: 'suspended', subscription_status: 'inactive' });
      await audit(admin, tenantId, 'tenant.suspend', 'high', { reason });
      return res.status(200).json({ success: true, message: '⏸ Tienda suspendida' });
    }

    // ── reactivate ───────────────────────────────────────────────────────────
    if (action === 'reactivate') {
      await sbPatch('tenant', filter, { status: 'active', subscription_status: 'active' });
      await audit(admin, tenantId, 'tenant.reactivate', 'high', { reason });
      return res.status(200).json({ success: true, message: '▶️ Tienda reactivada' });
    }

    // ── extend_trial ─────────────────────────────────────────────────────────
    if (action === 'extend_trial') {
      const tenant = await sbGet('tenant', filter, 'id,trial_end_date');
      const currentEnd = tenant?.trial_end_date ? new Date(tenant.trial_end_date) : new Date();
      const newEnd = new Date(Math.max(currentEnd, new Date()) + 0);
      newEnd.setTime(Math.max(currentEnd.getTime(), Date.now()));
      newEnd.setDate(newEnd.getDate() + 15);
      await sbPatch('tenant', filter, { trial_end_date: newEnd.toISOString() });
      await audit(admin, tenantId, 'tenant.extend_trial', 'medium', { reason, trial_end_date: newEnd.toISOString() });
      return res.status(200).json({ success: true, message: `⏱ Trial extendido hasta ${newEnd.toLocaleDateString('es')}` });
    }

    // ── set_plan ──────────────────────────────────────────────────────────────
    if (action === 'set_plan') {
      const plan = extra.plan;
      if (!plan) return res.status(400).json({ success: false, error: 'plan es requerido' });
      const updates = { plan };
      if (extra.monthly_cost !== undefined) updates.monthly_cost = Number(extra.monthly_cost) || 0;
      await sbPatch('tenant', filter, updates);
      await audit(admin, tenantId, 'tenant.set_plan', 'high', { reason, plan, monthly_cost: updates.monthly_cost ?? null });
      return res.status(200).json({ success: true, message: `📦 Plan actualizado a ${plan}` });
    }

    // ── edit ──────────────────────────────────────────────────────────────────
    if (action === 'edit') {
      const updates = {};
      if (extra.name?.trim())            updates.name                 = extra.name.trim();
      if (extra.email?.trim())           updates.email                = extra.email.trim().toLowerCase();
      if (extra.admin_name?.trim())      updates.admin_name           = extra.admin_name.trim();
      if (extra.admin_phone !== undefined) updates.admin_phone        = String(extra.admin_phone || '').trim();
      if (extra.country?.trim())         updates.country              = extra.country.trim();
      if (extra.currency?.trim())        updates.currency             = extra.currency.trim();
      if (extra.timezone?.trim())        updates.timezone             = extra.timezone.trim();
      if (extra.address !== undefined)   updates.address              = String(extra.address || '').trim();
      if (extra.plan?.trim())            updates.plan                 = extra.plan.trim();
      if (extra.status?.trim())          updates.status               = extra.status.trim();
      if (extra.subscription_status?.trim()) updates.subscription_status = extra.subscription_status.trim();
      if (extra.trial_end_date)          updates.trial_end_date       = extra.trial_end_date;
      if (extra.monthly_cost !== undefined)  updates.monthly_cost     = Number(extra.monthly_cost) || 0;
      // max_users se guarda en metadata (no en columna directa)
      if (extra.max_users !== undefined) {
        const maxU = Number(extra.max_users) || 1;
        // Leer metadata actual y mergear
        const current = await sbGet('tenant', filter, 'metadata');
        const newMeta = { ...(current?.metadata || {}), max_users: maxU };
        updates.metadata = newMeta;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'Nada que actualizar' });
      }
      await sbPatch('tenant', filter, updates);
      await audit(admin, tenantId, 'tenant.edit', 'medium', { reason, fields: Object.keys(updates) });
      return res.status(200).json({ success: true, message: '✏️ Información actualizada' });
    }

    // ── reset_password ────────────────────────────────────────────────────────
    if (action === 'reset_password') {
      const email = extra.email?.trim().toLowerCase();
      if (!email) return res.status(400).json({ success: false, error: 'email es requerido' });
      ensureResendConfigured();

      // Generate Supabase recovery link
      const linkRes = await fetch(`${SB_URL}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB_KEY,
          'Authorization': `Bearer ${SB_KEY}`,
        },
        body: JSON.stringify({ type: 'recovery', email }),
      });

      let recoveryLink = null;
      if (linkRes.ok) {
        const linkData = await linkRes.json();
        recoveryLink = linkData?.action_link || null;
      }

      if (!recoveryLink) {
        // Fallback: trigger Supabase built-in recovery email (may not work without SMTP config)
        await fetch(`${SB_URL}/auth/v1/recover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY },
          body: JSON.stringify({ email }),
        });
        await audit(admin, tenantId, 'tenant.reset_password', 'medium', { reason, email });
        return res.status(200).json({ success: true, message: '📧 Enlace de restablecimiento enviado' });
      }

      // Send via Resend
      const emailHtml = `
<div style="font-family:Arial,sans-serif;background:#f4f4f5;padding:40px;max-width:560px;margin:0 auto;">
  <div style="background:#fff;border-radius:16px;padding:36px;box-shadow:0 2px 12px rgba(0,0,0,0.07);">
    <div style="text-align:center;margin-bottom:28px;">
      <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png" alt="SmartFixOS" style="height:44px;" />
    </div>
    <h2 style="color:#111;margin:0 0 8px;">Restablecer contraseña</h2>
    <p style="color:#555;margin:0 0 28px;font-size:15px;">Haz clic en el botón de abajo para crear una nueva contraseña para tu cuenta Archilla OS.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${recoveryLink}" style="background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;padding:16px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
        🔑 Restablecer contraseña
      </a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:24px 0 0;">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este mensaje.</p>
  </div>
</div>`;

      await sendResendEmail({
        to: email,
        subject: 'Restablece tu contraseña de Archilla OS',
        html: emailHtml,
        fromName: 'Archilla OS',
        fromEmail: FROM_EMAIL,
      });

      await audit(admin, tenantId, 'tenant.reset_password', 'medium', { reason, email });
      return res.status(200).json({ success: true, message: `📧 Enlace de restablecimiento enviado a ${email}` });
    }

    // ── create_first_user ────────────────────────────────────────────────────
    if (action === 'create_first_user') {
      const { email, full_name, phone, pin: userPin } = extra;
      if (!email || !full_name || !userPin) {
        return res.status(400).json({ success: false, error: 'email, full_name y pin son requeridos' });
      }
      if (!/^\d{4}$/.test(userPin)) {
        return res.status(400).json({ success: false, error: 'PIN debe ser exactamente 4 dígitos' });
      }

      // Insert into app_employee
      const empRes = await fetch(`${SB_URL}/rest/v1/app_employee`, {
        method: 'POST',
        headers: { ...sbH(), 'Prefer': 'return=representation' },
        body: JSON.stringify({
          full_name: full_name.trim(),
          email: email.trim().toLowerCase(),
          phone: (phone || '').trim(),
          pin: userPin,
          role: 'admin',
          status: 'active',
          active: true,
          tenant_id: tenantId,
          hire_date: new Date().toISOString().split('T')[0],
        }),
      });
      const empText = await empRes.text();
      if (!empRes.ok) throw new Error(`INSERT app_employee: ${empText}`);
      const empData = JSON.parse(empText);
      const employee = Array.isArray(empData) ? empData[0] : empData;

      // Also update users table if a record exists
      try {
        await sbPatch(
          'users',
          `email=eq.${encodeURIComponent(email.trim().toLowerCase())}`,
          { full_name: full_name.trim(), pin: userPin, active: true }
        );
      } catch (e) { /* non-critical — users row may not exist yet */ }

      console.log(`✅ First user created: ${email} in tenant ${tenantId}`);
      return res.status(200).json({ success: true, employee, message: 'Usuario creado correctamente' });
    }

    return res.status(400).json({ success: false, error: `Acción desconocida: ${action}` });

  } catch (e) {
    console.error('manage-tenant error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
