const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

function allowedEmails() {
  const raw = process.env.SUPER_ADMIN_EMAILS || 'archillastudios@gmail.com';
  return new Set(raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export async function requireSuperAdmin(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { status: 401, error: 'Sesión requerida' };

  const res = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { apikey: SB_ANON_KEY, Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!res || !res.ok) return { status: 401, error: 'Sesión inválida o vencida' };

  const user = await res.json().catch(() => null);
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email || !user?.email_confirmed_at && !user?.confirmed_at) {
    return { status: 403, error: 'Cuenta sin verificar' };
  }
  if (!allowedEmails().has(email)) return { status: 403, error: 'No autorizado' };

  return { email, userId: user.id };
}
