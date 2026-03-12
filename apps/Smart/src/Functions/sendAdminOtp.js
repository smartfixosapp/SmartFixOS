/**
 * sendAdminOtp — Genera y envía OTP criptográfico al SuperAdmin
 *
 * SEGURIDAD:
 *  - OTP generado server-side con crypto.getRandomValues (no Math.random)
 *  - Rate limiting: máx 5 intentos por 15 minutos por IP
 *  - El OTP se guarda hasheado en Supabase (tabla admin_otp_sessions)
 *  - El OTP expira en 5 minutos y es de un solo uso
 *  - Solo acepta requests para el email configurado en SUPER_ADMIN_EMAIL
 */

// Rate limiting en memoria (se resetea al reiniciar el servidor)
const rateLimitMap = new Map(); // ip → { count, windowStart }
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Ventana expirada — resetear
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }
  entry.count += 1;
  rateLimitMap.set(ip, entry);
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

function generateSecureOtp() {
  // 6 dígitos usando crypto.getRandomValues (criptográficamente seguro)
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, "0");
}

async function hashOtp(otp, salt) {
  // SHA-256 del OTP + salt para guardarlo en BD
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function sendAdminOtpHandler(req) {
  console.log("🔐 sendAdminOtp called");

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

  // ── Rate limiting ──────────────────────────────────────────────────────────
  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    const minutes = Math.ceil(rateCheck.retryAfterMs / 60000);
    console.warn(`🚫 Rate limit exceeded for IP: ${ip}`);
    return Response.json({
      success: false,
      error: `Demasiados intentos. Espera ${minutes} minuto(s) antes de reintentar.`,
    }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { email } = body;

    // ── Verificar que sea el SuperAdmin ────────────────────────────────────────
    const SUPER_ADMIN_EMAIL = Deno.env.get("SUPER_ADMIN_EMAIL") || "smartfixosapp@gmail.com";
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@smartfixos.com";

    if (!email || email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      // No revelar si el email existe o no (previene enumeración)
      return Response.json({ success: true, message: "Si el email es válido, recibirás un código." });
    }

    if (!RESEND_API_KEY) {
      console.error("❌ RESEND_API_KEY not configured");
      return Response.json({ success: false, error: "Email service not configured" }, { status: 500 });
    }

    // ── Generar OTP ────────────────────────────────────────────────────────────
    const otp = generateSecureOtp();
    const sessionId = crypto.randomUUID();
    const salt = crypto.randomUUID();
    const otpHash = await hashOtp(otp, salt);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min

    // ── Guardar sesión OTP en Supabase ─────────────────────────────────────────
    const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");

    if (SUPABASE_URL && SERVICE_KEY) {
      const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_otp_sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          session_id: sessionId,
          otp_hash: otpHash,
          salt,
          email: SUPER_ADMIN_EMAIL,
          expires_at: expiresAt,
          ip_address: ip,
          attempts: 0,
          created_at: new Date().toISOString(),
        }),
      });
      if (!upsertRes.ok) {
        const err = await upsertRes.text();
        console.error("❌ Failed to save OTP session:", err);
        // Continuar de todos modos — fallback a sessionStorage en cliente
      } else {
        console.log("✅ OTP session saved:", sessionId);
      }
    }

    // ── Enviar email con OTP ───────────────────────────────────────────────────
    const emailHtml = `
<div style="font-family:Arial,sans-serif;background:#0a0a0a;color:#e5e7eb;padding:40px;max-width:520px;margin:0 auto;border-radius:16px;">
  <div style="text-align:center;margin-bottom:28px;">
    <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/e9bc537e2_DynamicsmartfixosLogowithGearandDevice.png"
      alt="SmartFixOS" style="height:48px;object-fit:contain;" />
  </div>
  <h2 style="color:#22d3ee;margin:0 0 6px;font-size:22px;">🔐 Código de acceso al Panel</h2>
  <p style="color:#9ca3af;margin:0 0 24px;font-size:14px;">Panel de Administración SmartFixOS — Acceso SuperAdmin</p>
  <div style="background:#0e4f6e;border:2px solid #06b6d4;border-radius:12px;padding:28px;text-align:center;margin-bottom:24px;">
    <p style="color:#67e8f9;font-size:11px;letter-spacing:3px;margin:0 0 14px;text-transform:uppercase;">Tu código de 6 dígitos</p>
    <div style="font-size:52px;font-weight:900;letter-spacing:18px;color:#ffffff;font-family:monospace;line-height:1;">${otp}</div>
    <p style="color:#a7f3d0;font-size:12px;margin:14px 0 0;">⏱ Expira en <strong>5 minutos</strong> · Un solo uso</p>
  </div>
  <div style="background:#1a1a1a;border:1px solid #374151;border-radius:8px;padding:16px;margin-bottom:20px;">
    <p style="color:#f87171;font-size:13px;font-weight:bold;margin:0 0 6px;">⚠️ Seguridad</p>
    <p style="color:#9ca3af;font-size:12px;margin:0;">Nunca compartas este código. El equipo de SmartFixOS jamás te pedirá tu código OTP ni tu PIN secreto.</p>
  </div>
  <p style="color:#4b5563;font-size:12px;text-align:center;margin:0;">IP de acceso: ${ip} · ${new Date().toLocaleString('es', { timeZone: 'America/Puerto_Rico' })} AST</p>
</div>`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `SmartFixOS Security <${FROM_EMAIL}>`,
        to: [SUPER_ADMIN_EMAIL],
        subject: `🔐 Código de acceso: ${otp} — Panel SuperAdmin`,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("❌ Resend error:", errBody);
      return Response.json({ success: false, error: "Error al enviar el código. Verifica la configuración de email." }, { status: 500 });
    }

    console.log(`✅ Admin OTP sent to ${SUPER_ADMIN_EMAIL} (session: ${sessionId})`);

    return Response.json({
      success: true,
      sessionId, // El cliente lo guarda para la verificación
      message: "Código enviado. Revisa tu email.",
    });

  } catch (err) {
    console.error("❌ sendAdminOtp error:", err);
    return Response.json({ success: false, error: "Error interno. Intenta nuevamente." }, { status: 500 });
  }
}
