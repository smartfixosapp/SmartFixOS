// Lightweight input sanitizer for Functions server payloads.
// Defense-in-depth on top of PostgREST parameterization.
// - Strips NUL bytes and control chars
// - Caps string length
// - Removes HTML/script tags from plain-text fields
// - Blocks obvious SQL-injection signatures on fields tagged as "safe text"
// - Normalizes email / uuid shapes

const MAX_STR = 10_000;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const TAG_STRIP = /<\/?(script|style|iframe|object|embed|link|meta)[^>]*>/gi;

const SQLI_PATTERNS = [
  /(\bUNION\b\s+\bSELECT\b)/i,
  /(;\s*DROP\s+TABLE\b)/i,
  /(\bOR\b\s+1\s*=\s*1\b)/i,
  /(--\s*$)/,
  /(\/\*[\s\S]*?\*\/)/,
  /(xp_cmdshell)/i,
];

export function sanitizeString(v, { maxLen = MAX_STR, allowHtml = false } = {}) {
  if (v == null) return v;
  if (typeof v !== 'string') return v;
  let s = v.replace(CONTROL_CHARS, '');
  if (!allowHtml) s = s.replace(TAG_STRIP, '');
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

export function sanitizeObject(obj, opts = {}) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(v => sanitizeObject(v, opts));
  if (typeof obj === 'object') {
    const out = {};
    for (const k of Object.keys(obj)) {
      const safeKey = String(k).slice(0, 256);
      out[safeKey] = sanitizeObject(obj[k], opts);
    }
    return out;
  }
  if (typeof obj === 'string') return sanitizeString(obj, opts);
  return obj;
}

export function detectSqlInjection(value) {
  if (typeof value !== 'string') return false;
  return SQLI_PATTERNS.some(r => r.test(value));
}

export function isEmail(v) {
  if (typeof v !== 'string') return false;
  if (v.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function isUUID(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// Wrap a Request and return a new Request with sanitized JSON body.
// Non-JSON bodies are passed through untouched.
export async function sanitizeRequest(req) {
  const ct = req.headers.get('content-type') || '';
  if (!ct.toLowerCase().includes('application/json')) return req;
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return req;

  let raw;
  try {
    raw = await req.clone().text();
  } catch {
    return req;
  }
  if (!raw) return req;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return req;
  }

  const cleaned = sanitizeObject(parsed);
  const newBody = JSON.stringify(cleaned);
  const headers = new Headers(req.headers);
  headers.set('content-length', String(new TextEncoder().encode(newBody).length));

  return new Request(req.url, {
    method: req.method,
    headers,
    body: newBody,
  });
}
