/**
 * GET /api/validate-token?token=xxx
 * Validates an activation token server-side (uses service role key — bypasses RLS)
 */
import { checkRateLimit, getClientIP, tooManyRequests } from './_lib/rateLimit.js';
const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sbHeaders = {
  'Content-Type': 'application/json',
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ valid: false, error: 'Method not allowed' });

  // Rate limit: máx 20 validaciones por IP por 10 minutos
  const rl = checkRateLimit(getClientIP(req), 'validate-token', { max: 20, windowMs: 10 * 60_000 });
  if (!rl.ok) return tooManyRequests(res, rl.retryAfterSec);

  const { token } = req.query;
  if (!token) return res.status(400).json({ valid: false, error: 'Token requerido' });

  try {
    // Query app_employee by activation_token
    const empRes = await fetch(
      `${SB_URL}/rest/v1/app_employee?activation_token=eq.${encodeURIComponent(token)}&select=id,tenant_id,email,full_name,activation_expires_at,status`,
      { headers: sbHeaders }
    );
    const empText = await empRes.text();
    if (!empRes.ok) return res.status(500).json({ valid: false, error: `DB error: ${empText}` });

    const rows = JSON.parse(empText);
    if (!rows.length) return res.status(404).json({ valid: false, error: 'Token no encontrado' });

    const emp = rows[0];

    // Check expiry
    if (emp.activation_expires_at && new Date(emp.activation_expires_at) < new Date()) {
      return res.status(410).json({ valid: false, error: 'Token expirado' });
    }

    // Already activated
    if (emp.status === 'active') {
      return res.status(200).json({ valid: false, alreadyActive: true });
    }

    // Fetch tenant name for prefill
    let tenantName = '';
    let adminPhone = '';
    if (emp.tenant_id) {
      const tRes = await fetch(
        `${SB_URL}/rest/v1/tenant?id=eq.${emp.tenant_id}&select=name,admin_phone`,
        { headers: sbHeaders }
      );
      if (tRes.ok) {
        const tRows = await tRes.json();
        tenantName = tRows[0]?.name || '';
        adminPhone = tRows[0]?.admin_phone || '';
      }
    }

    return res.status(200).json({
      valid: true,
      employeeId: emp.id,
      tenantId: emp.tenant_id,
      email: emp.email,
      fullName: emp.full_name,
      tenantName,
      adminPhone,
    });

  } catch (e) {
    console.error('validate-token error:', e.message);
    return res.status(500).json({ valid: false, error: e.message });
  }
}
