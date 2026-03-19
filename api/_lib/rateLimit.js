/**
 * Rate Limiter — SmartFixOS API
 * Protección contra brute force y abuso sin base de datos ni función extra.
 * Usa un Map en memoria del proceso (persiste dentro del mismo serverless instance).
 * Para protección global entre instancias usar Upstash Redis (futuro).
 */

// { key: { count, resetAt } }
const store = new Map();

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (val.resetAt <= now) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Verifica si una IP puede hacer una petición.
 * @param {string} ip
 * @param {string} endpoint  — nombre del endpoint (ej: "register")
 * @param {object} opts      — { max: 10, windowMs: 60_000 }
 * @returns {{ ok: boolean, remaining: number, retryAfterSec: number }}
 */
export function checkRateLimit(ip, endpoint, opts = {}) {
  const { max = 10, windowMs = 60_000 } = opts;
  const key  = `${endpoint}:${ip}`;
  const now  = Date.now();
  let entry  = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }

  entry.count++;

  if (entry.count > max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  return {
    ok: true,
    remaining: max - entry.count,
    retryAfterSec: 0,
  };
}

/**
 * Extrae la IP real del request de Vercel.
 */
export function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    "unknown"
  );
}

/**
 * Responde con 429 Too Many Requests.
 */
export function tooManyRequests(res, retryAfterSec = 60) {
  res.setHeader("Retry-After", String(retryAfterSec));
  res.setHeader("X-RateLimit-Limit", "exceeded");
  return res.status(429).json({
    error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos.",
    retryAfter: retryAfterSec,
  });
}
