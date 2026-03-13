/**
 * POST /api/verify-admin-otp
 * Verifica el OTP + PIN secreto del SuperAdmin
 */
import { createHash } from 'crypto';

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sbH = { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` };

function hashOtp(otp, salt) {
  return createHash('sha256').update(otp + salt).digest('hex');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { sessionId, otp, adminPin } = req.body || {};
    if (!sessionId || !otp || !adminPin) {
      return res.status(400).json({ success: false, error: 'Datos incompletos.' });
    }

    // ── Verify admin PIN ──────────────────────────────────────────────────────
    const ADMIN_SECRET_PIN = process.env.ADMIN_SECRET_PIN;
    if (!ADMIN_SECRET_PIN) {
      // If not configured, skip PIN check (fallback for initial setup)
      console.warn('ADMIN_SECRET_PIN not set — skipping PIN verification');
    } else if (!timingSafeEqual(adminPin.trim(), ADMIN_SECRET_PIN.trim())) {
      return res.status(200).json({ success: false, error: 'Código o PIN incorrecto. Verifica e intenta nuevamente.' });
    }

    // ── Lookup OTP session in Supabase ────────────────────────────────────────
    if (!SB_KEY) {
      return res.status(500).json({ success: false, error: 'Server misconfiguration.' });
    }

    const sessionRes = await fetch(
      `${SB_URL}/rest/v1/admin_otp_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
      { headers: sbH }
    );
    const sessions = await sessionRes.json();
    const session = sessions?.[0];

    if (!session) {
      return res.status(200).json({ success: false, error: 'Sesión inválida o expirada. Solicita un nuevo código.' });
    }

    if (new Date(session.expires_at) < new Date()) {
      await fetch(`${SB_URL}/rest/v1/admin_otp_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, { method: 'DELETE', headers: sbH });
      return res.status(200).json({ success: false, error: 'El código expiró. Solicita uno nuevo.' });
    }

    if ((session.attempts || 0) >= 3) {
      await fetch(`${SB_URL}/rest/v1/admin_otp_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, { method: 'DELETE', headers: sbH });
      return res.status(200).json({ success: false, error: 'Demasiados intentos fallidos. Solicita un nuevo código.' });
    }

    // ── Verify OTP hash ───────────────────────────────────────────────────────
    const expectedHash = hashOtp(otp.trim(), session.salt);
    if (!timingSafeEqual(expectedHash, session.otp_hash)) {
      await fetch(`${SB_URL}/rest/v1/admin_otp_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
        method: 'PATCH',
        headers: sbH,
        body: JSON.stringify({ attempts: (session.attempts || 0) + 1 }),
      });
      const remaining = 3 - ((session.attempts || 0) + 1);
      return res.status(200).json({
        success: false,
        error: remaining > 0 ? `Código incorrecto. Te quedan ${remaining} intento(s).` : 'Demasiados intentos. Solicita un nuevo código.',
      });
    }

    // ── Success — delete session (one-time use) ───────────────────────────────
    await fetch(`${SB_URL}/rest/v1/admin_otp_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, { method: 'DELETE', headers: sbH });
    console.log(`✅ Admin OTP verified (session: ${sessionId})`);
    return res.status(200).json({ success: true });

  } catch (e) {
    console.error('verify-admin-otp error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
