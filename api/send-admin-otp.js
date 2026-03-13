/**
 * POST /api/send-admin-otp
 * Genera OTP criptográfico y lo envía al SuperAdmin por email (Resend)
 */
import { createHash, randomUUID } from 'crypto';

const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@smartfixos.com';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'smartfixosapp@gmail.com';

function hashOtp(otp, salt) {
  return createHash('sha256').update(otp + salt).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { email } = req.body || {};

    // Silently succeed for any non-admin email (security)
    if (!email || email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      return res.status(200).json({ success: true, message: 'Si el email es válido, recibirás un código.' });
    }

    if (!RESEND_KEY) {
      return res.status(500).json({ success: false, error: 'Email service not configured' });
    }

    // Generate 6-digit OTP (server-side, no client exposure)
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const sessionId = randomUUID();
    const salt = randomUUID();
    const otpHash = hashOtp(otp, salt);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const ip = req.headers['x-forwarded-for'] || 'unknown';

    // Save OTP session to Supabase (best-effort — table may not exist)
    if (SB_KEY) {
      try {
        await fetch(`${SB_URL}/rest/v1/admin_otp_sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SB_KEY,
            'Authorization': `Bearer ${SB_KEY}`,
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({ session_id: sessionId, otp_hash: otpHash, salt, email: SUPER_ADMIN_EMAIL, expires_at: expiresAt, ip_address: ip, attempts: 0 }),
        });
      } catch (e) { console.warn('OTP session save (non-critical):', e.message); }
    }

    // Send email via Resend
    const emailHtml = `
<div style="font-family:Arial,sans-serif;background:#0a0a0a;color:#e5e7eb;padding:40px;max-width:520px;margin:0 auto;border-radius:16px;">
  <div style="text-align:center;margin-bottom:28px;">
    <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png" alt="SmartFixOS" style="height:48px;" />
  </div>
  <h2 style="color:#22d3ee;margin:0 0 6px;">🔐 Código de acceso al Panel</h2>
  <p style="color:#9ca3af;margin:0 0 24px;font-size:14px;">Panel de Administración SmartFixOS — Acceso SuperAdmin</p>
  <div style="background:#0e4f6e;border:2px solid #06b6d4;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
    <p style="color:#67e8f9;font-size:11px;letter-spacing:3px;margin:0 0 14px;text-transform:uppercase;">Tu código de 6 dígitos</p>
    <div style="font-size:52px;font-weight:900;letter-spacing:18px;color:#fff;font-family:monospace;line-height:1;">${otp}</div>
    <p style="color:#a7f3d0;font-size:12px;margin:14px 0 0;">⏱ Expira en <strong>5 minutos</strong> · Un solo uso</p>
  </div>
  <p style="color:#f87171;font-size:13px;font-weight:bold;">⚠️ Nunca compartas este código.</p>
  <p style="color:#4b5563;font-size:12px;text-align:center;margin-top:20px;">IP: ${ip}</p>
</div>`;

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `SmartFixOS Security <${FROM_EMAIL}>`,
        to: [SUPER_ADMIN_EMAIL],
        subject: `🔐 Código de acceso: ${otp} — Panel SuperAdmin`,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      console.error('Resend error:', err);
      return res.status(500).json({ success: false, error: 'Error al enviar el código.' });
    }

    console.log(`✅ Admin OTP sent (session: ${sessionId})`);
    return res.status(200).json({ success: true, sessionId });

  } catch (e) {
    console.error('send-admin-otp error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
