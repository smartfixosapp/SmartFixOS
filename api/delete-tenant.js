/**
 * POST /api/delete-tenant
 * SuperAdmin only: cascade-delete a tenant and all their data
 * Body: { tenantId: string }
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const { tenantId } = req.body || {};
  if (!tenantId) return res.status(400).json({ success: false, error: 'tenantId es requerido' });
  if (!SB_KEY) return res.status(500).json({ success: false, error: 'Server misconfiguration' });

  try {
    const filter = `tenant_id=eq.${encodeURIComponent(tenantId)}`;
    const deleted = { tables: [], authUsers: 0, errors: [] };

    // ── 1. Collect auth user IDs before deleting ──────────────────────────────
    const [employees, users] = await Promise.all([
      sbSelect('app_employee', filter, 'id,auth_user_id,email'),
      sbSelect('users', filter, 'id,auth_user_id,email'),
    ]);

    // ── 2. Delete operational data tables ────────────────────────────────────
    // Order matters: delete child tables before parent tables
    const tables = [
      'work_order_event',
      'email_log',
      'fn_trigger_rule',
      'notification',
      'invoice',
      'sale_item',
      'sale',
      'transaction',
      'order_payment',
      'order_part',
      'work_order',
      'order',
      'inventory',
      'purchase_order',
      'supplier',
      'service',
      'product',
      'customer',
      'email_template',
      'app_settings',
      'system_config',
      'app_employee',
      'users',
    ];

    for (const table of tables) {
      const ok = await sbDelete(table, filter);
      if (ok) deleted.tables.push(table);
    }

    // ── 3. Delete the tenant row ──────────────────────────────────────────────
    await sbDelete('tenant', `id=eq.${encodeURIComponent(tenantId)}`);
    deleted.tables.push('tenant');

    // ── 4. Delete Supabase Auth users ─────────────────────────────────────────
    const authIds = new Set();
    [...employees, ...users].forEach(e => {
      if (e.auth_user_id) authIds.add(e.auth_user_id);
    });

    for (const authId of authIds) {
      const ok = await deleteAuthUser(authId);
      if (ok) deleted.authUsers++;
      else deleted.errors.push(`auth_user ${authId} no eliminado`);
    }

    console.log(`✅ Tenant ${tenantId} deleted — tables: ${deleted.tables.length}, auth users: ${deleted.authUsers}`);
    return res.status(200).json({
      success: true,
      message: `Tienda eliminada (${deleted.tables.length} tablas limpiadas, ${deleted.authUsers} usuarios eliminados)`,
      deleted,
    });

  } catch (e) {
    console.error('delete-tenant error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
