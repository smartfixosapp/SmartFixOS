/**
 * gaccDataProxy — Acceso a datos del panel GACC/SuperAdmin, server-side.
 *
 * Reemplaza el hallazgo CRÍTICO de SECURITY_AUDIT_2026-04-21.md:
 * VITE_SUPABASE_SERVICE_ROLE_KEY se leía en el navegador
 * (apps/Smart/src/pages/gacc/gaccContext.jsx) y Vite la incrustaba en el
 * bundle público — cualquiera con devtools tenía acceso total a la base de
 * datos, sin RLS.
 *
 * Ahora el navegador solo guarda un token opaco de sesión (ver
 * verifyAdminOtp.js + 021_admin_panel_sessions.sql), emitido tras OTP + PIN
 * secreto. Este handler valida ese token contra admin_panel_sessions y,
 * solo si es válido, reenvía la petición a la API real de Supabase con la
 * service_role key — que nunca sale de este servidor.
 *
 * El cliente en gaccContext.jsx sigue usando supabase-js normalmente
 * (`adminSupabase.from("tenant").select(...)`), apuntando su `url` a
 * `${VITE_FUNCTION_URL}/gaccdata` en vez de a Supabase directamente — por
 * eso este proxy solo necesita reenviar /rest/v1/* y /storage/v1/*
 * transparentemente, sin reimplementar el query builder.
 */

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") || Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY");

// Tablas que la UI de GACC realmente consulta hoy (apps/Smart/src/pages/gacc/*.jsx).
// Defensa en profundidad: si el token se filtrara, solo sirve para leer/escribir
// estas tablas — no cualquier tabla de la base de datos. Añadir aquí a propósito
// cuando GACC necesite una tabla nueva.
const ALLOWED_TABLES = new Set([
  "tenant", "subscription", "order", "sale", "customer", "product",
  "users", "app_employee", "tenant_membership", "audit_log",
  "transaction", "cash_register", "notification", "inventory_movement",
]);

const ALLOWED_METHODS = new Set(["GET", "HEAD", "POST", "PATCH", "DELETE"]);

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function resolveSession(token) {
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_panel_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}&select=expires_at`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => []);
  const session = rows?.[0];
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  return session;
}

export async function gaccDataProxyHandler(req) {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("❌ gaccDataProxy: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configurados");
    return Response.json({ message: "Server misconfigured" }, { status: 500 });
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200 });
  }

  if (!ALLOWED_METHODS.has(req.method)) {
    return Response.json({ message: "Método no permitido" }, { status: 405 });
  }

  const url = new URL(req.url);
  // /gaccdata/rest/v1/tenant?select=* -> /rest/v1/tenant?select=*
  const targetPath = url.pathname.replace(/^\/gaccdata/, "");

  if (!targetPath.startsWith("/rest/v1/") && !targetPath.startsWith("/storage/v1/")) {
    return Response.json({ message: "Not found" }, { status: 404 });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : req.headers.get("apikey");
  const session = await resolveSession(token);
  if (!session) {
    return Response.json(
      { message: "Sesión inválida o expirada. Vuelve a iniciar sesión en el panel." },
      { status: 401 }
    );
  }

  if (targetPath.startsWith("/rest/v1/")) {
    const table = targetPath.slice("/rest/v1/".length).split("?")[0].split("/")[0];
    if (!ALLOWED_TABLES.has(table)) {
      console.warn(`🚫 gaccDataProxy: tabla no permitida "${table}"`);
      return Response.json({ message: `Tabla no permitida: ${table}` }, { status: 403 });
    }
  }

  const forwardHeaders = new Headers();
  forwardHeaders.set("apikey", SERVICE_KEY);
  forwardHeaders.set("Authorization", `Bearer ${SERVICE_KEY}`);
  for (const h of ["content-type", "prefer", "range", "accept-profile", "content-profile"]) {
    const v = req.headers.get(h);
    if (v) forwardHeaders.set(h, v);
  }

  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();

  let upstream;
  try {
    upstream = await fetch(`${SUPABASE_URL}${targetPath}`, {
      method: req.method,
      headers: forwardHeaders,
      body,
    });
  } catch (err) {
    console.error("❌ gaccDataProxy upstream error:", err);
    return Response.json({ message: "Error contactando la base de datos." }, { status: 502 });
  }

  const responseBody = await upstream.text();
  const headers = new Headers();
  for (const h of ["content-type", "content-range", "range-unit"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new Response(responseBody, { status: upstream.status, headers });
}
