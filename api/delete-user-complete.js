/**
 * POST /api/delete-user-complete
 * Nuclear delete: removes a user/email from ALL locations in the system.
 * Body: { email: string, deleteTenant?: boolean }
 *
 * Actions performed:
 *  1. Find auth_user_id from users + app_employee tables
 *  2. Scan Supabase Auth for the email directly
 *  3. Delete from Supabase Auth (hard delete, irreversible)
 *  4. Delete from users table (by email)
 *  5. Delete from app_employee table (by email)
 *  6. If deleteTenant=true → cascade-delete all tenant data too
 */

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
  };
}

async function sbSelect(table, filter, select = 'id') {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}&select=${select}`, {
      headers: sbHeaders(),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

async function sbDelete(table, filter) {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}`, {
      method: 'DELETE',
      headers: sbHeaders(),
    });
    return res.status < 300;
  } catch { return false; }
}

async function deleteAuthUser(authId) {
  try {
    const res = await fetch(`${SB_URL}/auth/v1/admin/users/${authId}`, {
      method: 'DELETE',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
      },
    });
    return res.status < 300;
  } catch { return false; }
}

async function cascadeDeleteTenant(tenantId) {
  const filter = `tenant_id=eq.${encodeURIComponent(tenantId)}`;
  const tables = [
    'work_order_event', 'email_log', 'fn_trigger_rule', 'notification',
    'invoice', 'sale_item', 'sale', 'transaction', 'order_payment',
    'order_part', 'work_order', 'order', 'inventory', 'purchase_order',
    'supplier', 'service', 'product', 'customer', 'email_template',
    'app_settings', 'system_config', 'app_employee', 'users',
  ];
  let deleted = 0;
  for (const table of tables) {
    const ok = await sbDelete(table, filter);
    if (ok) deleted++;
  }
  await sbDelete('tenant', `id=eq.${encodeURIComponent(tenantId)}`);
  return deleted;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { email, deleteTenant = false } = req.body || {};
  if (!email || !email.trim()) return res.status(400).json({ success: false, error: 'email es requerido' });
  if (!SB_KEY) return res.status(500).json({ success: false, error: 'Server misconfiguration: missing SUPABASE_SERVICE_ROLE_KEY' });

  const cleanEmail = email.trim().toLowerCase();
  const encodedEmail = encodeURIComponent(cleanEmail);
  const report = { email: cleanEmail, authDeleted: 0, tablesCleared: [], tenantsDeleted: 0, errors: [] };

  try {
    // ── 1. Find user records by email to get auth IDs ─────────────────────────
    const [userRows, employeeRows] = await Promise.all([
      sbSelect('users', `email=eq.${encodedEmail}`, 'id,auth_user_id,auth_id,tenant_id'),
      sbSelect('app_employee', `email=eq.${encodedEmail}`, 'id,auth_user_id,tenant_id'),
    ]);

    const authIds = new Set();
    const tenantIds = new Set();

    for (const u of [...userRows, ...employeeRows]) {
      if (u.auth_user_id) authIds.add(u.auth_user_id);
      if (u.auth_id)      authIds.add(u.auth_id);
      if (u.tenant_id)    tenantIds.add(u.tenant_id);
    }

    // ── 2. Scan Supabase Auth directly by email (catches accounts not in DB) ──
    try {
      const authListRes = await fetch(
        `${SB_URL}/auth/v1/admin/users?email=${encodedEmail}&per_page=10`,
        { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } },
      );
      if (authListRes.ok) {
        const authData = await authListRes.json();
        for (const au of (authData?.users || [])) {
          if (au.email?.toLowerCase() === cleanEmail && au.id) {
            authIds.add(au.id);
          }
        }
      }
    } catch (e) {
      report.errors.push(`Auth scan: ${e.message}`);
    }

    // ── 3. Delete from Supabase Auth ──────────────────────────────────────────
    for (const authId of authIds) {
      const ok = await deleteAuthUser(authId);
      if (ok) report.authDeleted++;
      else report.errors.push(`Auth user ${authId} — no se pudo eliminar`);
    }

    // ── 4. Delete from users table ────────────────────────────────────────────
    const usersOk = await sbDelete('users', `email=eq.${encodedEmail}`);
    if (usersOk) report.tablesCleared.push('users');

    // ── 5. Delete from app_employee table ────────────────────────────────────
    const empOk = await sbDelete('app_employee', `email=eq.${encodedEmail}`);
    if (empOk) report.tablesCleared.push('app_employee');

    // ── 6. If requested, cascade-delete tenant(s) ────────────────────────────
    if (deleteTenant) {
      // Also scan tenant table for owner email
      const tenantRows = await sbSelect('tenant', `email=eq.${encodedEmail}`, 'id');
      for (const t of tenantRows) tenantIds.add(t.id);

      for (const tenantId of tenantIds) {
        const tablesDeleted = await cascadeDeleteTenant(tenantId);
        report.tenantsDeleted++;
        report.tablesCleared.push(`tenant(${tenantId.slice(0, 8)}…) [${tablesDeleted} tablas]`);
      }
    }

    const summary = [
      report.authDeleted > 0 ? `${report.authDeleted} usuario(s) Auth eliminado(s)` : 'Auth: no encontrado',
      `Tablas: ${report.tablesCleared.length > 0 ? report.tablesCleared.join(', ') : 'ninguna'}`,
      report.tenantsDeleted > 0 ? `${report.tenantsDeleted} tenant(s) eliminado(s) en cascada` : null,
    ].filter(Boolean).join(' · ');

    console.log(`☢️ Nuclear delete [${cleanEmail}]: ${summary}`);
    return res.status(200).json({ success: true, message: summary, report });

  } catch (e) {
    console.error('delete-user-complete error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
