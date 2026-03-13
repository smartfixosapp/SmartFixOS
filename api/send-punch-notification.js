/**
 * POST /api/send-punch-notification
 * Sends a punch-in/punch-out email notification to the store owner.
 *
 * Body: {
 *   tenant_id:      string,    required
 *   employee_name:  string,    required
 *   employee_role:  string,    optional  (admin|manager|technician|cashier)
 *   punch_type:     string,    required  "in" | "out"
 *   timestamp:      string,    required  ISO 8601
 *   clock_in_time:  string,    optional  ISO 8601 (for punch_out — to calc hours)
 *   notes:          string,    optional
 * }
 */

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@smartfixos.com';
const DEFAULT_LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png";

function sbH() {
  return {
    'Content-Type': 'application/json',
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
  };
}

async function sbGet(table, filter, select = '*') {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/${table}?${filter}&select=${select}`, { headers: sbH() });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch { return null; }
}

// ── Role labels ────────────────────────────────────────────────────────────────
const ROLE_LABELS = {
  admin:       'Administrador',
  manager:     'Gerente',
  technician:  'Técnico',
  cashier:     'Cajero/a',
};

// ── Format helpers ─────────────────────────────────────────────────────────────
function formatTime(iso, tz = 'America/Puerto_Rico') {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('es-PR', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz });
}

function formatDate(iso, tz = 'America/Puerto_Rico') {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: tz });
}

function calcHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return null;
  const ms = new Date(clockOut) - new Date(clockIn);
  if (ms <= 0) return null;
  const totalMinutes = Math.round(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

// ── Email HTML builder ─────────────────────────────────────────────────────────
function buildPunchEmailHtml({ punch_type, employee_name, employee_role, timestamp, clock_in_time, businessName, logoUrl, notes }) {
  const isIn     = punch_type === 'in';
  const roleLabel = ROLE_LABELS[employee_role] || employee_role || 'Empleado';
  const punchTime = formatTime(timestamp);
  const punchDate = formatDate(timestamp);
  const hoursWorked = !isIn ? calcHours(clock_in_time, timestamp) : null;
  const clockInDisplay = !isIn && clock_in_time ? formatTime(clock_in_time) : null;

  // Colors
  const headerGradient = isIn
    ? 'linear-gradient(135deg,#10B981 0%,#059669 100%)'
    : 'linear-gradient(135deg,#F59E0B 0%,#D97706 100%)';
  const alertBg     = isIn ? '#F0FDF4' : '#FFFBEB';
  const alertBorder = isIn ? '#10B981' : '#F59E0B';
  const alertTitle  = isIn ? '#065F46' : '#92400E';
  const alertText   = isIn ? '#047857' : '#78350F';
  const badgeBg     = isIn ? '#DCFCE7' : '#FEF3C7';
  const badgeText   = isIn ? '#166534' : '#92400E';
  const icon        = isIn ? '🟢' : '🔴';
  const action      = isIn ? '¡Entró a trabajar!' : 'Salió del turno';
  const emoji       = isIn ? '👋' : '✅';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:20px;background:#F3F4F6;">
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:${headerGradient};padding:40px 30px;text-align:center;">
      <img src="${logoUrl}" alt="${businessName}" style="height:70px;width:auto;margin:0 auto 16px;display:block;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.3));" />
      <div style="display:inline-block;background:rgba(255,255,255,0.2);border-radius:50px;padding:8px 20px;margin-bottom:8px;">
        <span style="color:white;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Notificación de Ponche</span>
      </div>
      <h1 style="color:white;margin:8px 0 0;font-size:26px;font-weight:800;">${icon} ${action}</h1>
    </div>

    <!-- Body -->
    <div style="padding:36px 32px;">

      <!-- Employee card -->
      <div style="background:#F9FAFB;border-radius:16px;padding:24px;margin-bottom:24px;border:2px solid #E5E7EB;">
        <div style="display:flex;align-items:center;gap:16px;">
          <div style="width:52px;height:52px;border-radius:50%;background:${headerGradient};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="color:white;font-size:22px;font-weight:800;">${(employee_name || 'E')[0].toUpperCase()}</span>
          </div>
          <div>
            <p style="margin:0;color:#111827;font-size:20px;font-weight:800;">${employee_name}</p>
            <span style="display:inline-block;background:${badgeBg};color:${badgeText};font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;margin-top:4px;">${roleLabel}</span>
          </div>
        </div>
      </div>

      <!-- Alert box -->
      <div style="background:${alertBg};border-radius:16px;padding:22px;border-left:6px solid ${alertBorder};margin-bottom:24px;">
        <p style="margin:0;color:${alertTitle};font-size:18px;font-weight:800;">${emoji} ${isIn ? 'Inicio de turno registrado' : 'Fin de turno registrado'}</p>
        <p style="margin:10px 0 0;color:${alertText};font-size:15px;line-height:1.6;">
          <strong>${employee_name}</strong> ${isIn ? 'comenzó su turno hoy a las' : 'terminó su turno hoy a las'} <strong>${punchTime}</strong>.
        </p>
      </div>

      <!-- Time details -->
      <div style="background:#F0F9FF;border-radius:16px;padding:22px;border:2px solid #BAE6FD;margin-bottom:24px;">
        <p style="margin:0 0 16px;color:#0369A1;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Detalles del Ponche</p>
        <div style="display:grid;gap:12px;">

          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #E0F2FE;">
            <span style="color:#6B7280;font-size:13px;font-weight:600;">📅 Fecha</span>
            <span style="color:#111827;font-size:13px;font-weight:700;">${punchDate}</span>
          </div>

          ${isIn ? `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">
            <span style="color:#6B7280;font-size:13px;font-weight:600;">🟢 Hora de Entrada</span>
            <span style="color:#065F46;font-size:16px;font-weight:800;">${punchTime}</span>
          </div>
          ` : `
          ${clockInDisplay ? `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #E0F2FE;">
            <span style="color:#6B7280;font-size:13px;font-weight:600;">🟢 Hora de Entrada</span>
            <span style="color:#065F46;font-size:15px;font-weight:700;">${clockInDisplay}</span>
          </div>
          ` : ''}
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;${hoursWorked ? 'border-bottom:1px solid #E0F2FE;' : ''}">
            <span style="color:#6B7280;font-size:13px;font-weight:600;">🔴 Hora de Salida</span>
            <span style="color:#B45309;font-size:16px;font-weight:800;">${punchTime}</span>
          </div>
          ${hoursWorked ? `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;">
            <span style="color:#6B7280;font-size:13px;font-weight:600;">⏱️ Tiempo trabajado</span>
            <span style="color:#1D4ED8;font-size:18px;font-weight:900;">${hoursWorked}</span>
          </div>
          ` : ''}
          `}
        </div>
      </div>

      ${notes ? `
      <div style="background:#F5F3FF;border-radius:12px;padding:16px;border:1px solid #DDD6FE;margin-bottom:24px;">
        <p style="margin:0 0 6px;color:#6D28D9;font-size:12px;font-weight:700;">📝 NOTAS</p>
        <p style="margin:0;color:#4C1D95;font-size:14px;line-height:1.6;">${notes}</p>
      </div>
      ` : ''}

      <!-- Footer note -->
      <p style="color:#9CA3AF;font-size:12px;line-height:1.6;margin:0;text-align:center;">
        Esta notificación fue generada automáticamente por SmartFixOS.<br>
        Puedes revisar todos los ponches en <strong>Control de Ponches</strong> dentro del sistema.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#F9FAFB;padding:20px 32px;text-align:center;border-top:1px solid #E5E7EB;">
      <img src="${logoUrl}" alt="${businessName}" style="height:32px;width:auto;opacity:0.5;margin:0 auto;display:block;" />
      <p style="margin:8px 0 0;color:#9CA3AF;font-size:12px;">${businessName}</p>
    </div>

  </div>
</body>
</html>`;
}

// ── Main handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const {
    tenant_id,
    employee_name,
    employee_role,
    punch_type,
    timestamp,
    clock_in_time,
    notes,
  } = req.body || {};

  if (!tenant_id)    return res.status(400).json({ success: false, error: 'tenant_id es requerido' });
  if (!punch_type)   return res.status(400).json({ success: false, error: 'punch_type es requerido' });
  if (!timestamp)    return res.status(400).json({ success: false, error: 'timestamp es requerido' });
  if (!SB_KEY)       return res.status(500).json({ success: false, error: 'Server misconfiguration' });
  if (!RESEND_KEY)   return res.status(500).json({ success: false, error: 'Email service not configured' });

  try {
    // ── Fetch tenant email + business info in parallel ──────────────────────
    const [tenant, mainSettings, brandingSettings] = await Promise.all([
      sbGet('tenant', `id=eq.${encodeURIComponent(tenant_id)}`, 'id,name,email'),
      sbGet('app_settings', `slug=eq.app-main-settings`, 'payload'),
      sbGet('app_settings', `slug=eq.business-branding`, 'payload'),
    ]);

    const ownerEmail = tenant?.email;
    if (!ownerEmail) {
      console.warn(`No owner email found for tenant ${tenant_id}`);
      return res.status(200).json({ success: false, message: 'No hay email del dueño configurado' });
    }

    const businessName = mainSettings?.payload?.business_name || tenant?.name || 'SmartFixOS';
    const logoUrl      = brandingSettings?.payload?.logo_url || DEFAULT_LOGO_URL;

    // ── Build email ─────────────────────────────────────────────────────────
    const isIn    = punch_type === 'in';
    const empName = employee_name || 'Empleado';
    const timeStr = formatTime(timestamp);
    const subject = isIn
      ? `🟢 ${empName} entró a trabajar — ${timeStr}`
      : `🔴 ${empName} salió del turno — ${timeStr}`;

    const html = buildPunchEmailHtml({
      punch_type,
      employee_name: empName,
      employee_role,
      timestamp,
      clock_in_time,
      businessName,
      logoUrl,
      notes,
    });

    // ── Send via Resend ─────────────────────────────────────────────────────
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    `SmartFixOS <${FROM_EMAIL}>`,
        to:      [ownerEmail],
        subject,
        html,
      }),
    });

    if (emailRes.ok) {
      console.log(`✅ Punch notification sent to ${ownerEmail} (${punch_type}, tenant: ${tenant_id})`);
      return res.status(200).json({ success: true, recipient: ownerEmail });
    } else {
      const err = await emailRes.text().catch(() => emailRes.status);
      console.error('Resend error:', err);
      return res.status(200).json({ success: false, error: String(err) });
    }

  } catch (e) {
    console.error('send-punch-notification error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
