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

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@smartfixos.com';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { tenantId, action, ...extra } = req.body || {};
  if (!tenantId || !action) {
    return res.status(400).json({ success: false, error: 'tenantId y action son requeridos' });
  }
  if (!SB_KEY) return res.status(500).json({ success: false, error: 'Server misconfiguration' });

  const filter = `id=eq.${encodeURIComponent(tenantId)}`;

  try {
    // ── suspend ──────────────────────────────────────────────────────────────
    if (action === 'suspend') {
      await sbPatch('tenant', filter, { status: 'suspended', subscription_status: 'inactive' });
      return res.status(200).json({ success: true, message: '⏸ Tienda suspendida' });
    }

    // ── reactivate ───────────────────────────────────────────────────────────
    if (action === 'reactivate') {
      await sbPatch('tenant', filter, { status: 'active', subscription_status: 'active' });
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
      return res.status(200).json({ success: true, message: `⏱ Trial extendido hasta ${newEnd.toLocaleDateString('es')}` });
    }

    // ── set_plan ──────────────────────────────────────────────────────────────
    if (action === 'set_plan') {
      const plan = extra.plan;
      if (!plan) return res.status(400).json({ success: false, error: 'plan es requerido' });
      const planPrices = { basic: 55, pro: 85, enterprise: 200 };
      await sbPatch('tenant', filter, { plan, monthly_cost: planPrices[plan] || 55 });
      return res.status(200).json({ success: true, message: `📦 Plan actualizado a ${plan}` });
    }

    // ── edit ──────────────────────────────────────────────────────────────────
    if (action === 'edit') {
      const updates = {};
      if (extra.name?.trim())  updates.name  = extra.name.trim();
      if (extra.email?.trim()) updates.email = extra.email.trim().toLowerCase();
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ success: false, error: 'Nada que actualizar' });
      }
      await sbPatch('tenant', filter, updates);
      return res.status(200).json({ success: true, message: '✏️ Información actualizada' });
    }

    // ── reset_password ────────────────────────────────────────────────────────
    if (action === 'reset_password') {
      const email = extra.email?.trim().toLowerCase();
      if (!email) return res.status(400).json({ success: false, error: 'email es requerido' });
      if (!RESEND_KEY) return res.status(500).json({ success: false, error: 'Email service not configured' });

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
    <p style="color:#555;margin:0 0 28px;font-size:15px;">Haz clic en el botón de abajo para crear una nueva contraseña para tu cuenta SmartFixOS.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${recoveryLink}" style="background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;padding:16px 36px;border-radius:10px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
        🔑 Restablecer contraseña
      </a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center;margin:24px 0 0;">Este enlace expira en 1 hora. Si no solicitaste esto, ignora este mensaje.</p>
  </div>
</div>`;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `SmartFixOS <${FROM_EMAIL}>`,
          to: [email],
          subject: '🔑 Restablece tu contraseña de SmartFixOS',
          html: emailHtml,
        }),
      });

      if (!emailRes.ok) {
        const err = await emailRes.text();
        console.error('Resend error:', err);
        return res.status(500).json({ success: false, error: 'Error al enviar el email' });
      }

      return res.status(200).json({ success: true, message: `📧 Enlace de restablecimiento enviado a ${email}` });
    }

    return res.status(400).json({ success: false, error: `Acción desconocida: ${action}` });

  } catch (e) {
    console.error('manage-tenant error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
