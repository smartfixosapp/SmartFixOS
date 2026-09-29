const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

export async function requireMember(req, { requestedTenantId = null, anyTenant = false } = {}) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { status: 401, error: 'Sesión requerida' };

  const res = await fetch(`${SB_URL}/rest/v1/rpc/get_user_tenants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SB_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: '{}',
  }).catch(() => null);
  if (!res || !res.ok) return { status: 401, error: 'Sesión inválida o vencida' };

  const tenants = await res.json().catch(() => []);
  if (!Array.isArray(tenants) || tenants.length === 0) {
    return { status: 403, error: 'Tu cuenta no pertenece a ningún taller' };
  }

  let match = null;
  if (requestedTenantId) match = tenants.find((t) => t.tenant_id === requestedTenantId) || null;
  else if (tenants.length === 1 || anyTenant) match = tenants[0];
  if (!match) return { status: 403, error: 'No tienes acceso a ese taller' };

  return { tenantId: match.tenant_id, role: match.role, tenants };
}
