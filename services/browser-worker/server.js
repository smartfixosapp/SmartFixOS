import http from 'node:http';
import crypto from 'node:crypto';
import httpProxy from 'http-proxy';
import { chromium } from 'playwright';

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.BROWSER_WORKER_TOKEN || '';
const PROFILE_DIR = process.env.PROFILE_DIR || '/data/profile';
const PROXY_SERVER = process.env.PROXY_SERVER || '';
const PROXY_USER = process.env.PROXY_USER || '';
const PROXY_PASS = process.env.PROXY_PASS || '';
const LIVE_TTL_MS = 10 * 60 * 1000;

if (TOKEN.length < 32) {
  console.error('BROWSER_WORKER_TOKEN debe tener al menos 32 caracteres');
  process.exit(1);
}

let contextPromise = null;
let busy = Promise.resolve();

function getContext() {
  if (!contextPromise) {
    contextPromise = chromium.launchPersistentContext(PROFILE_DIR, {
      headless: process.env.HEADLESS === '1',
      ...(process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL } : {}),
      viewport: { width: 1280, height: 760 },
      locale: 'en-US',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1280,800', '--window-position=0,0'],
      ...(PROXY_SERVER ? { proxy: { server: PROXY_SERVER, username: PROXY_USER, password: PROXY_PASS } } : {}),
    }).then((ctx) => {
      ctx.on('close', () => { contextPromise = null; });
      return ctx;
    }).catch((e) => {
      contextPromise = null;
      throw e;
    });
  }
  return contextPromise;
}

function serial(task) {
  const run = busy.then(task, task);
  busy = run.catch(() => {});
  return run;
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function signLive(expires) {
  return crypto.createHmac('sha256', TOKEN).update(`live:${expires}`).digest('hex');
}

function validLive(query) {
  const expires = Number(query.get('e'));
  const sig = query.get('t') || '';
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  return safeEqual(sig, signLive(expires));
}

function authorized(req) {
  const header = String(req.headers.authorization || '');
  return header.startsWith('Bearer ') && safeEqual(header.slice(7).trim(), TOKEN);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 100_000) { reject(new Error('cuerpo demasiado grande')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('json invalido')); }
    });
  });
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function blockedByChallenge(page) {
  const title = (await page.title().catch(() => '')) || '';
  const body = await page.evaluate(() => (document.body?.innerText || '').slice(0, 600)).catch(() => '');
  return /just a moment|verify you are human|attention required|access denied/i.test(`${title} ${body}`);
}

async function waitChallenge(page, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (!(await blockedByChallenge(page))) return true;
    await page.waitForTimeout(1500);
  }
  return false;
}

async function extractProducts(page, limit) {
  return page.evaluate((max) => {
    const priceRe = /\$\s?\d[\d,]*(?:\.\d{2})?/;
    const pairs = [];
    for (const a of Array.from(document.querySelectorAll('a[href]'))) {
      const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length < 8 || text.length > 220) continue;
      let node = a;
      let card = null;
      for (let i = 0; i < 6 && node && node.parentElement; i += 1) {
        node = node.parentElement;
        const t = (node.textContent || '').replace(/\s+/g, ' ');
        if (priceRe.test(t) && t.length < 900) { card = node; break; }
      }
      if (card) pairs.push({ a, text, card });
    }
    const cards = pairs.map((p) => p.card);
    const own = pairs.filter((p) => !cards.some((other) => other !== p.card && p.card.contains(other)));
    const seen = new Set();
    const out = [];
    for (const { a, text, card } of own) {
      if (seen.has(a.href)) continue;
      seen.add(a.href);
      const cardText = (card.textContent || '').replace(/\s+/g, ' ').trim();
      const prices = cardText.match(/\$\s?\d[\d,]*(?:\.\d{2})?/g) || [];
      const sku = (cardText.match(/(?:SKU|Item|Part)\s*#?:?\s*([A-Za-z0-9-]{5,})/i) || [])[1] || '';
      const stock = /out of stock|agotado|sold out/i.test(cardText) ? 'agotado' : /in stock|disponible|add to cart/i.test(cardText) ? 'disponible' : '';
      out.push({ nombre: text, url: a.href, precios: prices.slice(0, 3), sku, existencia: stock });
      if (out.length >= max) break;
    }
    return out;
  }, limit);
}

async function search({ url, consulta, limite }) {
  const ctx = await getContext();
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    const cleared = await waitChallenge(page, 25_000);
    if (!cleared) return { ok: false, estado: 'verificacion', error: 'El proveedor pide una verificacion humana. Abre la ventanilla y resuelvela una vez.' };
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    const loginForm = await page.locator('input[type="password"]').count();
    const productos = await extractProducts(page, Math.min(Number(limite) || 8, 20));
    if (!productos.length && loginForm > 0) return { ok: false, estado: 'sesion', error: 'La sesion del proveedor no esta iniciada. Abre la ventanilla e inicia sesion una vez.' };
    return { ok: true, consulta, pagina: page.url(), total: productos.length, productos, sesion_requerida: loginForm > 0 };
  } finally {
    await page.close().catch(() => {});
  }
}

async function openForLogin(url) {
  const ctx = await getContext();
  const pages = ctx.pages();
  const page = pages.length ? pages[0] : await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {});
  await page.bringToFront().catch(() => {});
  return page.url();
}

const proxy = httpProxy.createProxyServer({ target: 'http://127.0.0.1:6080', ws: true });
proxy.on('error', (e, req, res) => {
  if (res && typeof res.writeHead === 'function' && !res.headersSent) { res.writeHead(502); res.end('live view no disponible'); }
});

function stripLive(url) {
  return url.replace(/^\/live/, '') || '/';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/health') return send(res, 200, { ok: true });
  if (url.pathname.startsWith('/live/')) {
    if (!validLive(url.searchParams)) { res.writeHead(403); return res.end('enlace vencido'); }
    req.url = stripLive(req.url);
    return proxy.web(req, res);
  }
  if (!authorized(req)) return send(res, 401, { ok: false, error: 'no autorizado' });
  try {
    if (req.method === 'POST' && url.pathname === '/search') {
      const body = await readJson(req);
      if (!(process.env.ALLOW_HTTP === '1' ? /^https?:\/\//i : /^https:\/\//i).test(String(body.url || ''))) return send(res, 400, { ok: false, error: 'url https requerida' });
      const result = await serial(() => search(body));
      return send(res, 200, result);
    }
    if (req.method === 'POST' && url.pathname === '/live-url') {
      const body = await readJson(req);
      if (body.url && /^https:\/\//i.test(String(body.url))) await serial(() => openForLogin(body.url));
      else await serial(() => getContext());
      const expires = Date.now() + LIVE_TTL_MS;
      const t = signLive(expires);
      const qs = `e=${expires}&t=${t}`;
      const path = `/live/vnc.html?${qs}&autoconnect=1&resize=scale&path=${encodeURIComponent(`live/websockify?${qs}`)}`;
      return send(res, 200, { ok: true, path, expira_en: expires });
    }
    return send(res, 404, { ok: false, error: 'ruta no encontrada' });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e.message || e) });
  }
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith('/live/') || !validLive(url.searchParams)) { socket.destroy(); return; }
  req.url = stripLive(req.url);
  proxy.ws(req, socket, head);
});

server.listen(PORT, () => console.log(`browser-worker en ${PORT}`));
