/**
 * verifyAdminOtp — Verifica el OTP + PIN secreto del SuperAdmin
 *
 * SEGURIDAD:
 *  - Máx 3 intentos por sesión antes de invalidarla
 *  - OTP comparado contra hash (no se guarda en texto plano)
 *  - PIN secreto verificado contra ADMIN_SECRET_PIN en env var (jamás en código)
 *  - Sesión eliminada después del primer uso exitoso (one-time use)
 *  - Rate limiting adicional por IP
 *  - Al verificar con éxito, emite un token opaco de sesión de panel
 *    (admin_panel_sessions, 2h) que el cliente usa contra gaccDataProxy.js
 *    en vez de recibir la service_role key real (ver gaccDataProxy.js)
 */

const verifyRateLimitMap = new Map();
const VERIFY_RATE_MAX = 10;
const VERIFY_RATE_WINDOW_MS = 15 * 60 * 1000;
const PANEL_SESSION_MS = 2 * 60 * 60 * 1000; // 2 horas

function generatePanelToken() {
  // 256 bits de entropía, hex — nunca se guarda en texto plano server-side
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function checkVerifyRateLimit(ip) {
  const now = Date.now();
  const entry = verifyRateLimitMap.get(ip) || { count: 0, windowStart: now };
  if (now - entry.windowStart > VERIFY_RATE_WINDOW_MS) {
    verifyRateLimitMap.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= VERIFY_RATE_MAX) return false;
  entry.count += 1;
  verifyRateLimitMap.set(ip, entry);
  return true;
}

async function hashOtp(otp, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo constante (previene timing attacks)
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifyAdminOtpHandler(req) {
  console.log("🔐 verifyAdminOtp called");

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";

  if (!checkVerifyRateLimit(ip)) {
    return Response.json({ success: false, error: "Demasiados intentos. Espera 15 minutos." }, { status: 429 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { sessionId, otp, adminPin } = body;

    if (!sessionId || !otp || !adminPin) {
      return Response.json({ success: false, error: "Datos incompletos." }, { status: 400 });
    }

    // ── Verificar PIN secreto ──────────────────────────────────────────────────
    const ADMIN_SECRET_PIN = Deno.env.get("ADMIN_SECRET_PIN");
    if (!ADMIN_SECRET_PIN) {
      console.error("❌ ADMIN_SECRET_PIN env var not configured");
      return Response.json({ success: false, error: "Configuración de seguridad incompleta. Contacta al equipo técnico." }, { status: 500 });
    }
    if (!timingSafeEqual(adminPin.trim(), ADMIN_SECRET_PIN.trim())) {
      console.warn(`🚫 Invalid admin PIN attempt from IP: ${ip}`);
      // Respuesta genérica para no revelar si falló OTP o PIN
      return Response.json({ success: false, error: "Código o PIN incorrecto. Verifica e intenta nuevamente." });
    }

    // ── Buscar sesión OTP en Supabase ──────────────────────────────────────────
    const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return Response.json({ success: false, error: "Configuración de servidor incompleta." }, { status: 500 });
    }

    const sessionRes = await fetch(
      `${SUPABASE_URL}/rest/v1/admin_otp_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
      {
        headers: {
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
      }
    );

    const sessions = await sessionRes.json();
    const session = sessions?.[0];

    if (!session) {
      return Response.json({ success: false, error: "Sesión inválida o expirada. Solicita un nuevo código." });
    }

    // ── Verificar expiración ───────────────────────────────────────────────────
    if (new Date(session.expires_at) < new Date()) {
      // Eliminar sesión expirada
      await fetch(`${SUPABASE_URL}/rest/v1/admin_otp_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
      });
      return Response.json({ success: false, error: "El código expiró. Solicita uno nuevo." });
    }

    // ── Verificar intentos máximos ─────────────────────────────────────────────
    if (session.attempts >= 3) {
      await fetch(`${SUPABASE_URL}/rest/v1/admin_otp_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
      });
      return Response.json({ success: false, error: "Demasiados intentos fallidos. Solicita un nuevo código." });
    }

    // ── Verificar OTP ──────────────────────────────────────────────────────────
    const expectedHash = await hashOtp(otp.trim(), session.salt);
    if (!timingSafeEqual(expectedHash, session.otp_hash)) {
      // Incrementar contador de intentos
      await fetch(`${SUPABASE_URL}/rest/v1/admin_otp_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ attempts: (session.attempts || 0) + 1 }),
      });
      const remaining = 3 - (session.attempts + 1);
      return Response.json({
        success: false,
        error: remaining > 0
          ? `Código o PIN incorrecto. Te quedan ${remaining} intento(s).`
          : "Demasiados intentos. Solicita un nuevo código.",
      });
    }

    // ── OTP + PIN correctos ✅ — Eliminar sesión OTP (one-time use) ──────────────
    await fetch(`${SUPABASE_URL}/rest/v1/admin_otp_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
    });

    // ── Emitir token de sesión del panel (2h) ────────────────────────────────
    // El cliente solo se queda con `panelToken` (opaco); gaccDataProxy.js es
    // el único que puede canjearlo — y es el único que conoce la
    // service_role key real. Ver 021_admin_panel_sessions.sql.
    const panelToken = generatePanelToken();
    const panelTokenHash = await sha256Hex(panelToken);
    const panelExpiresAt = new Date(Date.now() + PANEL_SESSION_MS).toISOString();

    const sessionInsertRes = await fetch(`${SUPABASE_URL}/rest/v1/admin_panel_sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        token_hash: panelTokenHash,
        expires_at: panelExpiresAt,
        ip_address: ip,
      }),
    });

    if (!sessionInsertRes.ok) {
      const err = await sessionInsertRes.text();
      console.error("❌ Failed to create admin panel session:", err);
      return Response.json({ success: false, error: "Error interno creando la sesión del panel." }, { status: 500 });
    }

    console.log(`✅ Admin OTP verified successfully (session: ${sessionId}, IP: ${ip})`);

    return Response.json({
      success: true,
      message: "Verificación exitosa.",
      token: panelToken,
      expiresAt: panelExpiresAt,
    });

  } catch (err) {
    console.error("❌ verifyAdminOtp error:", err);
    return Response.json({ success: false, error: "Error interno. Intenta nuevamente." }, { status: 500 });
  }
}
