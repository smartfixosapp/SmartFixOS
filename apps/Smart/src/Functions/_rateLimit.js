// In-memory sliding-window rate limiter for the Functions server.
// Per-route, per-client (user-id from Bearer JWT sub, fallback to IP).
// Default: 5 requests / 15 min on auth routes. Other routes get a looser default.

const buckets = new Map();
const FIFTEEN_MIN_MS = 15 * 60 * 1000;

export const RATE_LIMITS = {
  '/registerTenant':         { max: 5,   windowMs: FIFTEEN_MIN_MS },
  '/createFirstAdmin':       { max: 5,   windowMs: FIFTEEN_MIN_MS },
  '/verifyAndCreateAdmin':   { max: 5,   windowMs: FIFTEEN_MIN_MS },
  '/sendAdminOtp':           { max: 5,   windowMs: FIFTEEN_MIN_MS },
  '/verifyAdminOtp':         { max: 5,   windowMs: FIFTEEN_MIN_MS },
  '/sendVerificationEmail':  { max: 5,   windowMs: FIFTEEN_MIN_MS },
  '/createTenant':           { max: 5,   windowMs: FIFTEEN_MIN_MS },
  '/manageTenant':           { max: 30,  windowMs: FIFTEEN_MIN_MS },
  '/sendEmail':              { max: 20,  windowMs: FIFTEEN_MIN_MS },
  '/sendEmailInternal':      { max: 20,  windowMs: FIFTEEN_MIN_MS },
  '/sendTemplatedEmail':     { max: 20,  windowMs: FIFTEEN_MIN_MS },
  '/uploadFile':             { max: 60,  windowMs: FIFTEEN_MIN_MS },
  '/ai/invoke':              { max: 60,  windowMs: FIFTEEN_MIN_MS },
  '/ai/chat':                { max: 60,  windowMs: FIFTEEN_MIN_MS },
  '/ai/extract-expense':     { max: 30,  windowMs: FIFTEEN_MIN_MS },
  '/ai/generate-image':      { max: 30,  windowMs: FIFTEEN_MIN_MS },
  '/ai/gemini-summary':      { max: 30,  windowMs: FIFTEEN_MIN_MS },
  '/processPayment':         { max: 30,  windowMs: FIFTEEN_MIN_MS },
  '/createStripeCheckout':   { max: 30,  windowMs: FIFTEEN_MIN_MS },
  '/createStripeSubscription': { max: 30, windowMs: FIFTEEN_MIN_MS },
};

const DEFAULT_LIMIT = { max: 300, windowMs: FIFTEEN_MIN_MS };

const EXEMPT_PATHS = new Set([
  '/stripeWebhook',
  '/runScheduledFnTriggers',
  '/processFnTriggerEvents',
  '/onEntityFnTrigger',
  '/',
  '/health',
]);

function clientIdFromRequest(req) {
  const auth = req.headers.get('Authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const token = auth.slice(7);
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.sub) return `u:${payload.sub}`;
      }
    } catch { /* fall through to IP */ }
  }
  const fwd = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '';
  const ip = fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

function cronAllowed(req) {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) return false;
  const hdr = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return hdr === secret;
}

export function checkRateLimit(path, req) {
  if (EXEMPT_PATHS.has(path)) return { allowed: true };
  if (cronAllowed(req)) return { allowed: true };

  const cfg = RATE_LIMITS[path] || DEFAULT_LIMIT;
  const cid = clientIdFromRequest(req);
  const bucketKey = `${path}::${cid}`;
  const now = Date.now();

  let entry = buckets.get(bucketKey);
  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(bucketKey, entry);
  }

  entry.timestamps = entry.timestamps.filter(ts => now - ts < cfg.windowMs);

  if (entry.timestamps.length >= cfg.max) {
    const oldest = entry.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((cfg.windowMs - (now - oldest)) / 1000));
    return {
      allowed: false,
      retryAfter: retryAfterSec,
      max: cfg.max,
      windowMs: cfg.windowMs,
      remaining: 0,
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    max: cfg.max,
    windowMs: cfg.windowMs,
    remaining: cfg.max - entry.timestamps.length,
  };
}

// Periodic GC — keeps the Map from growing unbounded.
setInterval(() => {
  const cutoff = Date.now() - FIFTEEN_MIN_MS;
  for (const [key, entry] of buckets) {
    entry.timestamps = entry.timestamps.filter(ts => ts > cutoff);
    if (entry.timestamps.length === 0) buckets.delete(key);
  }
}, 5 * 60 * 1000);
