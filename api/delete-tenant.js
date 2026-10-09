/**
 * POST /api/delete-tenant
 * SuperAdmin only — two modes:
 *
 * MODE 1 — Delete by tenantId (existing behavior):
 *   Body: { tenantId: string }
 *   Cascade-deletes a tenant and ALL its data, then removes Auth users.
 *
 * MODE 2 — Nuclear delete by email (new):
 *   Body: { email: string }
 *   Finds all records for that email across:
 *     - Supabase Auth (hard-deletes the auth user)
 *     - users table
 *     - app_employee table
 *     - tenant table (if email matches owner)
 *     - ALL tenant data (orders, transactions, inventory, etc.)
 */

import { requireSuperAdmin } from '../lib/server/requireSuperAdmin.js';

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

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
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` },
    });
    return res.status < 300;
  } catch { return false; }
}

// Toda tabla con columna tenant_id, verificada contra el esquema real
// (2026-10-09, information_schema.columns) — el esquema no tiene FKs
// (0 constraints), así que nada se borra en cascada solo: cada tabla
// tiene que listarse aquí explícitamente. audit_log se excluye a
// propósito (conserva el historial de que esta tienda existió y se
// borró). Si se agrega una tabla nueva con tenant_id, hay que sumarla
// aquí a mano — no hay forma automática de detectarla en runtime sin
// un segundo roundtrip a information_schema.
const TENANT_SCOPED_TABLES = [
  'announcement', 'app_employee', 'app_settings', 'app_update', 'appointment',
  'billing_event', 'biometric_credential', 'brand', 'cash_drawer_movement',
  'cash_register', 'communication_history', 'communication_queue', 'customer',
  'customer_portal_token', 'customer_segment', 'daily_goal_log', 'device_category',
  'device_family', 'device_model', 'device_model_photo', 'device_subcategory',
  'device_token', 'discount_code', 'email_log', 'email_template', 'employee_payment',
  'external_link', 'file_upload', 'fixed_expense', 'internal_message',
  'inventory_movement', 'invoice', 'key_value', 'maintenance_reminder',
  'notification', 'notification_rule', 'notification_settings', 'offer',
  'one_time_expense', 'order_link', 'order_sequence', 'owner_pin', 'part_link',
  'personal_note', 'po_number_sequence', 'product', 'product_category',
  'product_variant', 'purchase_order', 'push_queue', 'quote', 'receipt_link',
  'recharge', 'sale', 'sequence_counter', 'service', 'shift_task', 'shift_task_log',
  'subscription', 'subscription_event', 'supplier', 'system_config',
  'technician_metrics', 'technician_profile', 'tenant_membership', 'tenant_role',
  'time_entry', 'transaction', 'work_order_config', 'work_order_event',
  'work_order_wizard_config', 'workshop_task',
  // order/users van después (las lee cascadeDeleteTenant para recoger
  // auth ids antes de borrar), pero igual se listan aquí para el log
  'order', 'users',
];

// Tenants que esta funcion nunca puede borrar, pase lo que pase —
// freno de seguridad contra un tap equivocado en la app admin.
const PROTECTED_TENANT_IDS = new Set([
  'dc902f30-ef85-4ac0-8032-df64bae3f7f0', // 911 Smart Fix (Francis)
  'cafe0001-0000-4000-8000-000000000001', // Demo tenant (Apple Review)
]);

async function logTenantDeletion(adminEmail, tenantId, tenantName, deleted) {
  try {
    const now = new Date().toISOString();
    await fetch(`${SB_URL}/rest/v1/audit_log`, {
      method: 'POST',
      headers: { ...sbHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        created_at: now,
        updated_at: now,
        created_by_id: adminEmail,
        created_by: adminEmail,
        action: 'tenant.delete',
        entity_type: 'tenant',
        entity_id: tenantId,
        user_id: adminEmail,
        user_name: adminEmail,
        user_role: 'super_admin',
        severity: 'critical',
        changes: { tenant_name: tenantName || null, tables_cleared: deleted.tables.length, auth_users_deleted: deleted.authUsers },
        tenant_id: tenantId,
      }),
    });
  } catch {}
}

// Cascade-delete all data for a tenant (given tenantId)
async function cascadeDeleteTenant(tenantId, deleted) {
  if (PROTECTED_TENANT_IDS.has(tenantId)) {
    throw new Error('Esta tienda está protegida y no se puede eliminar desde aquí.');
  }

  const filter = `tenant_id=eq.${encodeURIComponent(tenantId)}`;

  // Collect auth IDs before wiping tables
  const [employees, users] = await Promise.all([
    sbSelect('app_employee', filter, 'id,auth_user_id,email'),
    sbSelect('users',        filter, 'id,auth_user_id,auth_id,email'),
  ]);

  const authIds = new Set();
  [...employees, ...users].forEach(e => {
    if (e.auth_user_id) authIds.add(e.auth_user_id);
    if (e.auth_id)      authIds.add(e.auth_id);
  });

  // Delete all operational tables
  for (const table of TENANT_SCOPED_TABLES) {
    const ok = await sbDelete(table, filter);
    if (ok) deleted.tables.push(table);
  }

  // Delete tenant row
  await sbDelete('tenant', `id=eq.${encodeURIComponent(tenantId)}`);
  deleted.tables.push('tenant');

  // Delete Supabase Auth users found in this tenant
  for (const authId of authIds) {
    const ok = await deleteAuthUser(authId);
    if (ok) deleted.authUsers++;
    else deleted.errors.push(`auth_user ${authId} no eliminado`);
  }

  return authIds;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });
  const admin = await requireSuperAdmin(req);
  if (admin.error) return res.status(admin.status).json({ success: false, error: admin.error });
  if (!SB_KEY) return res.status(500).json({ success: false, error: 'Server misconfiguration' });

  const { tenantId, email } = req.body || {};

  // ── MODE 2: Nuclear delete by email ────────────────────────────────────────
  if (email && !tenantId) {
    const cleanEmail  = email.trim().toLowerCase();
    const encodedEmail = encodeURIComponent(cleanEmail);
    const deleted = { tables: [], authUsers: 0, errors: [] };

    try {
      // 1. Find tenant(s) by owner email
      const tenantRows = await sbSelect('tenant', `email=eq.${encodedEmail}`, 'id,name');

      // 2. Cascade-delete each tenant found
      const processedAuthIds = new Set();
      for (const t of tenantRows) {
        const ids = await cascadeDeleteTenant(t.id, deleted);
        ids.forEach(id => processedAuthIds.add(id));
      }

      // 3. Also look up users/employees that may belong to OTHER tenants with this email
      const [userRows, empRows] = await Promise.all([
        sbSelect('users',        `email=eq.${encodedEmail}`, 'id,auth_user_id,auth_id,tenant_id'),
        sbSelect('app_employee', `email=eq.${encodedEmail}`, 'id,auth_user_id,tenant_id'),
      ]);

      // Collect any remaining auth IDs not already deleted
      const extraAuthIds = new Set();
      for (const u of [...userRows, ...empRows]) {
        if (u.auth_user_id && !processedAuthIds.has(u.auth_user_id)) extraAuthIds.add(u.auth_user_id);
        if (u.auth_id      && !processedAuthIds.has(u.auth_id))      extraAuthIds.add(u.auth_id);
      }

      // 4. Scan Supabase Auth directly for this email (catches orphaned accounts)
      try {
        const authListRes = await fetch(
          `${SB_URL}/auth/v1/admin/users?email=${encodedEmail}&per_page=10`,
          { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } },
        );
        if (authListRes.ok) {
          const authData = await authListRes.json();
          for (const au of (authData?.users || [])) {
            if (au.email?.toLowerCase() === cleanEmail && au.id && !processedAuthIds.has(au.id)) {
              extraAuthIds.add(au.id);
            }
          }
        }
      } catch (e) {
        deleted.errors.push(`Auth scan: ${e.message}`);
      }

      // 5. Delete remaining auth users
      for (const authId of extraAuthIds) {
        const ok = await deleteAuthUser(authId);
        if (ok) deleted.authUsers++;
        else deleted.errors.push(`auth_user ${authId} no eliminado`);
      }

      // 6. Delete remaining rows in users/app_employee for this email
      await sbDelete('users',        `email=eq.${encodedEmail}`);
      await sbDelete('app_employee', `email=eq.${encodedEmail}`);

      const summary = [
        `${deleted.authUsers} usuario(s) Auth eliminado(s)`,
        `${tenantRows.length} tenant(s) + datos eliminados`,
        `${deleted.tables.length} tablas limpiadas`,
      ].join(' · ');

      console.log(`☢️ Nuclear delete [${cleanEmail}]: ${summary}`);
      return res.status(200).json({
        success: true,
        message: summary,
        report: { email: cleanEmail, ...deleted, tenantsFound: tenantRows.map(t => t.name || t.id) },
      });

    } catch (e) {
      console.error('delete-tenant (email mode) error:', e.message);
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ── MODE 1: Delete by tenantId (original behavior) ─────────────────────────
  if (!tenantId) {
    return res.status(400).json({ success: false, error: 'Se requiere tenantId o email' });
  }

  try {
    const existing = await sbSelect('tenant', `id=eq.${encodeURIComponent(tenantId)}`, 'id,name');
    const tenantName = existing[0]?.name || null;

    const deleted = { tables: [], authUsers: 0, errors: [] };
    await cascadeDeleteTenant(tenantId, deleted);
    await logTenantDeletion(admin.email, tenantId, tenantName, deleted);

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
