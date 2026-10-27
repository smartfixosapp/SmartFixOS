import crypto from 'node:crypto';
import { sb, money } from './muse.js';

const SECRET = process.env.ASSISTANT_KEY_SECRET || '';
const GRAPH = 'https://graph.facebook.com/v23.0';
const PLAID_HOSTS = { sandbox: 'https://sandbox.plaid.com', production: 'https://production.plaid.com' };
const INBOX_LIMIT = 200;
const WORKER_URL = (process.env.BROWSER_WORKER_URL || '').replace(/\/$/, '');
const WORKER_TOKEN = process.env.BROWSER_WORKER_TOKEN || '';
const SEARCH_TEMPLATES = { 'mobilesentrix.com': 'https://www.mobilesentrix.com/catalogsearch/result/?q={q}' };

function secretKey() {
  return crypto.createHash('sha256').update(SECRET).digest();
}

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

export function decryptSecret(blob) {
  const raw = Buffer.from(blob, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

async function loadSlug(slug) {
  const rows = await sb(`app_settings?slug=eq.${slug}&select=id,payload&limit=1`);
  return rows?.[0] || null;
}

async function saveSlug(slug, payload) {
  const row = await loadSlug(slug);
  if (row) await sb(`app_settings?id=eq.${row.id}`, { method: 'PATCH', body: { payload }, prefer: 'return=minimal' });
  else await sb('app_settings', { method: 'POST', body: { slug, payload }, prefer: 'return=minimal' });
}

export async function loadConnections(tenantId) {
  const row = await loadSlug(`ai-connections-${tenantId}`);
  return row?.payload || {};
}

async function saveConnections(tenantId, payload) {
  await saveSlug(`ai-connections-${tenantId}`, payload);
}

async function loadInbox(tenantId) {
  const row = await loadSlug(`ai-wa-inbox-${tenantId}`);
  return row?.payload?.mensajes || [];
}

async function saveInbox(tenantId, mensajes) {
  await saveSlug(`ai-wa-inbox-${tenantId}`, { mensajes: mensajes.slice(-INBOX_LIMIT) });
}

function clip(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

export function publicConnections(conn, webhookBase) {
  const wa = conn.whatsapp || null;
  const plaid = conn.plaid || null;
  return {
    whatsapp: wa
      ? {
          configurado: Boolean(wa.token_enc && wa.phone_number_id),
          phone_number_id: wa.phone_number_id || '',
          waba_id: wa.waba_id || '',
          numero: wa.display_phone || '',
          tiene_app_secret: Boolean(wa.app_secret_enc),
          verify_token: wa.verify_token || '',
          webhook_url: `${webhookBase}/api/assistant/whatsapp/webhook`,
        }
      : { configurado: false, phone_number_id: '', waba_id: '', numero: '', tiene_app_secret: false, verify_token: '', webhook_url: `${webhookBase}/api/assistant/whatsapp/webhook` },
    banco: plaid
      ? {
          configurado: Boolean(plaid.client_id && plaid.secret_enc),
          client_id: plaid.client_id || '',
          entorno: plaid.env || 'sandbox',
          conexiones: (plaid.items || []).map((i) => ({ id: i.item_id, institucion: i.institution || 'Banco', cuentas: (i.accounts || []).map((a) => ({ nombre: a.name, mascara: a.mask })) })),
        }
      : { configurado: false, client_id: '', entorno: 'sandbox', conexiones: [] },
    proveedores: (conn.proveedores || []).map((p) => ({ id: p.id, nombre: p.nombre, url: p.url, busqueda: p.busqueda || '', usuario: p.usuario || '', tiene_clave: Boolean(p.clave_enc), notas: p.notas || '' })),
    navegador_configurado: Boolean(WORKER_URL && WORKER_TOKEN),
  };
}

export async function saveWhatsAppConfig(tenantId, b) {
  const conn = await loadConnections(tenantId);
  const current = conn.whatsapp || {};
  const next = {
    ...current,
    phone_number_id: clip(b.phone_number_id ?? current.phone_number_id, 40),
    waba_id: clip(b.waba_id ?? current.waba_id, 40),
    verify_token: current.verify_token || crypto.randomBytes(16).toString('hex'),
    updated_at: new Date().toISOString(),
  };
  if (typeof b.token === 'string' && b.token.trim()) next.token_enc = encryptSecret(b.token.trim());
  if (typeof b.app_secret === 'string' && b.app_secret.trim()) next.app_secret_enc = encryptSecret(b.app_secret.trim());
  if (!next.phone_number_id) return { error: 'phone_number_id es requerido' };
  if (!next.token_enc) return { error: 'token es requerido' };
  conn.whatsapp = next;
  await saveConnections(tenantId, conn);
  return { ok: true };
}

async function graph(path, token, { method = 'GET', body } = {}) {
  const res = await fetch(`${GRAPH}/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

export async function testWhatsApp(tenantId) {
  const conn = await loadConnections(tenantId);
  const wa = conn.whatsapp;
  if (!wa?.token_enc) return { status: 409, body: { ok: false, error: 'Primero guarda el token y el Phone Number ID' } };
  const r = await graph(`${wa.phone_number_id}?fields=display_phone_number,verified_name,quality_rating`, decryptSecret(wa.token_enc));
  if (r.status !== 200) return { status: 502, body: { ok: false, error: `Meta respondio: ${r.body?.error?.message || r.status}` } };
  conn.whatsapp = { ...wa, display_phone: r.body.display_phone_number || wa.display_phone || '' };
  await saveConnections(tenantId, conn);
  return { status: 200, body: { ok: true, numero: r.body.display_phone_number, nombre: r.body.verified_name, calidad: r.body.quality_rating } };
}

export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

export async function sendWhatsApp(tenantId, input) {
  const conn = await loadConnections(tenantId);
  const wa = conn.whatsapp;
  if (!wa?.token_enc) return { status: 409, body: { ok: false, error: 'WhatsApp no esta conectado. Configuralo en Conexiones.' } };
  const to = normalizePhone(input.telefono);
  if (!to) return { status: 400, body: { ok: false, error: 'Telefono invalido' } };
  const token = decryptSecret(wa.token_enc);
  let payload;
  if (input.plantilla) {
    payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: String(input.plantilla),
        language: { code: String(input.idioma || 'es') },
        ...(Array.isArray(input.variables) && input.variables.length
          ? { components: [{ type: 'body', parameters: input.variables.map((v) => ({ type: 'text', text: String(v) })) }] }
          : {}),
      },
    };
  } else {
    const text = clip(input.texto, 4000);
    if (!text) return { status: 400, body: { ok: false, error: 'texto es requerido' } };
    payload = { messaging_product: 'whatsapp', to, type: 'text', text: { body: text, preview_url: false } };
  }
  const r = await graph(`${wa.phone_number_id}/messages`, token, { method: 'POST', body: payload });
  if (r.status !== 200) {
    const code = r.body?.error?.code;
    const outsideWindow = code === 131047 || code === 131026;
    return {
      status: 502,
      body: {
        ok: false,
        error: outsideWindow
          ? 'El cliente no ha escrito en las ultimas 24 horas: WhatsApp solo permite una plantilla aprobada. Usa el campo plantilla o escribele por otro medio.'
          : `Meta respondio: ${r.body?.error?.message || r.status}`,
        codigo_meta: code || null,
      },
    };
  }
  const messageId = r.body?.messages?.[0]?.id || null;
  const inbox = await loadInbox(tenantId);
  inbox.push({ id: messageId || `out-${Date.now()}`, direccion: 'saliente', telefono: to, texto: input.plantilla ? `[plantilla ${input.plantilla}]` : clip(input.texto, 4000), ts: new Date().toISOString() });
  await saveInbox(tenantId, inbox).catch(() => {});
  return { status: 200, body: { ok: true, enviado_a: to, id: messageId } };
}

export async function readWhatsAppInbox(tenantId, { telefono, limite } = {}) {
  let list = await loadInbox(tenantId);
  if (telefono) {
    const want = normalizePhone(telefono);
    list = list.filter((m) => m.telefono === want);
  }
  const n = Math.min(Math.max(Number(limite) || 20, 1), 50);
  return { status: 200, body: { ok: true, total: list.length, mensajes: list.slice(-n).reverse() } };
}

export async function whatsAppWebhook(req, res, tenantId) {
  const conn = await loadConnections(tenantId);
  const wa = conn.whatsapp;
  if (req.method === 'GET') {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];
    if (wa?.verify_token && mode === 'subscribe' && token === wa.verify_token && challenge) {
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(String(challenge));
    }
    return res.status(403).json({ ok: false });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!wa?.app_secret_enc) return res.status(403).json({ ok: false });
  const signature = String(req.headers?.['x-hub-signature-256'] || '');
  const plain = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
  const escaped = plain.replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const appSecret = decryptSecret(wa.app_secret_enc);
  const valid = [plain, escaped].some((payload) => {
    const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', appSecret).update(payload).digest('hex')}`);
    const given = Buffer.from(signature);
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
  if (!valid) return res.status(403).json({ ok: false });
  const inbox = await loadInbox(tenantId);
  const seen = new Set(inbox.map((m) => m.id));
  let added = 0;
  for (const entry of req.body?.entry || []) {
    for (const change of entry.changes || []) {
      const contacts = change.value?.contacts || [];
      for (const m of change.value?.messages || []) {
        if (!m.id || seen.has(m.id)) continue;
        const name = contacts.find((c) => c.wa_id === m.from)?.profile?.name || '';
        const text = m.type === 'text' ? m.text?.body : `[${m.type}]`;
        inbox.push({ id: m.id, direccion: 'entrante', telefono: m.from, nombre: name, texto: clip(text, 4000), tipo: m.type, ts: new Date(Number(m.timestamp) * 1000 || Date.now()).toISOString() });
        seen.add(m.id);
        added += 1;
      }
    }
  }
  if (added) await saveInbox(tenantId, inbox);
  return res.status(200).json({ ok: true });
}

export async function savePlaidConfig(tenantId, b) {
  const conn = await loadConnections(tenantId);
  const current = conn.plaid || {};
  const env = b.entorno === 'production' ? 'production' : 'sandbox';
  const next = { ...current, client_id: clip(b.client_id ?? current.client_id, 60), env, items: current.items || [], updated_at: new Date().toISOString() };
  if (typeof b.secret === 'string' && b.secret.trim()) next.secret_enc = encryptSecret(b.secret.trim());
  if (!next.client_id) return { error: 'client_id es requerido' };
  if (!next.secret_enc) return { error: 'secret es requerido' };
  conn.plaid = next;
  await saveConnections(tenantId, conn);
  return { ok: true };
}

async function plaid(conn, path, body) {
  const cfg = conn.plaid;
  const res = await fetch(`${PLAID_HOSTS[cfg.env] || PLAID_HOSTS.sandbox}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: cfg.client_id, secret: decryptSecret(cfg.secret_enc), ...body }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error_message || `Plaid ${res.status}`);
    err.plaidCode = json?.error_code;
    throw err;
  }
  return json;
}

export async function createPlaidLink(tenantId, webhookBase) {
  const conn = await loadConnections(tenantId);
  if (!conn.plaid?.secret_enc) return { status: 409, body: { ok: false, error: 'Primero guarda el Client ID y el Secret de Plaid' } };
  try {
    const out = await plaid(conn, '/link/token/create', {
      client_name: 'Archilla OS',
      language: 'es',
      country_codes: ['US'],
      user: { client_user_id: tenantId },
      products: ['transactions'],
      hosted_link: { is_mobile_app: true, completion_redirect_uri: `${webhookBase}/api/assistant/plaid/done` },
    });
    conn.plaid.pending_link = { link_token: out.link_token, created_at: new Date().toISOString() };
    await saveConnections(tenantId, conn);
    return { status: 200, body: { ok: true, url: out.hosted_link_url } };
  } catch (e) {
    return { status: 502, body: { ok: false, error: `Plaid respondio: ${e.message}` } };
  }
}

export async function finishPlaidLink(tenantId) {
  const conn = await loadConnections(tenantId);
  const pending = conn.plaid?.pending_link;
  if (!pending?.link_token) return { status: 409, body: { ok: false, error: 'No hay una conexion bancaria en curso' } };
  try {
    const info = await plaid(conn, '/link/token/get', { link_token: pending.link_token });
    const results = (info.link_sessions || []).flatMap((s) => s.results?.item_add_results || []);
    if (!results.length) return { status: 202, body: { ok: false, pendiente: true, error: 'Todavia no terminas de conectar el banco' } };
    const added = [];
    for (const r of results) {
      const ex = await plaid(conn, '/item/public_token/exchange', { public_token: r.public_token });
      const accounts = await plaid(conn, '/accounts/get', { access_token: ex.access_token });
      let institution = '';
      if (accounts.item?.institution_id) {
        institution = await plaid(conn, '/institutions/get_by_id', { institution_id: accounts.item.institution_id, country_codes: ['US'] }).then((i) => i.institution?.name || '').catch(() => '');
      }
      conn.plaid.items = (conn.plaid.items || []).filter((i) => i.item_id !== ex.item_id);
      conn.plaid.items.push({
        item_id: ex.item_id,
        access_token_enc: encryptSecret(ex.access_token),
        institution,
        accounts: (accounts.accounts || []).map((a) => ({ id: a.account_id, name: a.name, mask: a.mask, tipo: a.subtype || a.type })),
        added_at: new Date().toISOString(),
      });
      added.push(institution || ex.item_id);
    }
    delete conn.plaid.pending_link;
    await saveConnections(tenantId, conn);
    return { status: 200, body: { ok: true, bancos: added } };
  } catch (e) {
    return { status: 502, body: { ok: false, error: `Plaid respondio: ${e.message}` } };
  }
}

export async function removePlaidItem(tenantId, itemId) {
  const conn = await loadConnections(tenantId);
  const item = (conn.plaid?.items || []).find((i) => i.item_id === itemId);
  if (!item) return { status: 404, body: { ok: false, error: 'Conexion no encontrada' } };
  try {
    await plaid(conn, '/item/remove', { access_token: decryptSecret(item.access_token_enc) });
  } catch {}
  conn.plaid.items = conn.plaid.items.filter((i) => i.item_id !== itemId);
  await saveConnections(tenantId, conn);
  return { status: 200, body: { ok: true } };
}

export async function bankAccounts(tenantId) {
  const conn = await loadConnections(tenantId);
  const items = conn.plaid?.items || [];
  if (!items.length) return { status: 409, body: { ok: false, error: 'No hay un banco conectado. Conectalo en Conexiones.' } };
  const out = [];
  try {
    for (const item of items) {
      const r = await plaid(conn, '/accounts/balance/get', { access_token: decryptSecret(item.access_token_enc) });
      for (const a of r.accounts || []) {
        out.push({ banco: item.institution, cuenta: a.name, mascara: a.mask, tipo: a.subtype || a.type, disponible: a.balances?.available ?? null, balance: a.balances?.current ?? null });
      }
    }
  } catch (e) {
    return { status: 502, body: { ok: false, error: `Plaid respondio: ${e.message}` } };
  }
  return { status: 200, body: { ok: true, cuentas: out } };
}

export async function bankTransactions(tenantId, { desde, hasta, texto } = {}) {
  const conn = await loadConnections(tenantId);
  const items = conn.plaid?.items || [];
  if (!items.length) return { status: 409, body: { ok: false, error: 'No hay un banco conectado. Conectalo en Conexiones.' } };
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(hasta || '')) ? hasta : new Date().toISOString().slice(0, 10);
  const start = /^\d{4}-\d{2}-\d{2}$/.test(String(desde || '')) ? desde : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const needle = String(texto || '').trim().toLowerCase();
  const rows = [];
  try {
    for (const item of items) {
      const r = await plaid(conn, '/transactions/get', { access_token: decryptSecret(item.access_token_enc), start_date: start, end_date: end, options: { count: 250, offset: 0 } });
      const names = new Map((r.accounts || []).map((a) => [a.account_id, a.name]));
      for (const t of r.transactions || []) {
        const name = t.merchant_name || t.name || '';
        if (needle && !`${name} ${t.name || ''}`.toLowerCase().includes(needle)) continue;
        rows.push({ fecha: t.date, descripcion: name, monto: money(Math.abs(t.amount)), tipo: t.amount > 0 ? 'salida' : 'entrada', cuenta: names.get(t.account_id) || '', banco: item.institution, pendiente: Boolean(t.pending) });
      }
    }
  } catch (e) {
    if (e.plaidCode === 'PRODUCT_NOT_READY') return { status: 202, body: { ok: false, error: 'El banco todavia esta sincronizando los movimientos. Intenta en unos minutos.' } };
    return { status: 502, body: { ok: false, error: `Plaid respondio: ${e.message}` } };
  }
  rows.sort((x, y) => (x.fecha < y.fecha ? 1 : -1));
  const entradas = money(rows.filter((r) => r.tipo === 'entrada').reduce((s, r) => s + r.monto, 0));
  const salidas = money(rows.filter((r) => r.tipo === 'salida').reduce((s, r) => s + r.monto, 0));
  return { status: 200, body: { ok: true, desde: start, hasta: end, total: rows.length, entradas, salidas, movimientos: rows.slice(0, 80) } };
}

export async function saveSuppliers(tenantId, list) {
  if (!Array.isArray(list) || list.length > 40) return { error: 'proveedores debe ser una lista de hasta 40' };
  const conn = await loadConnections(tenantId);
  const current = new Map((conn.proveedores || []).map((p) => [p.id, p]));
  const next = [];
  for (const raw of list) {
    const nombre = clip(raw?.nombre, 80);
    const url = clip(raw?.url, 300);
    if (!nombre) return { error: 'Cada proveedor necesita nombre' };
    if (url && !/^https:\/\//i.test(url)) return { error: `La direccion de ${nombre} debe empezar con https://` };
    const id = clip(raw?.id, 40) || crypto.randomBytes(6).toString('hex');
    const prev = current.get(id) || {};
    const busqueda = clip(raw?.busqueda ?? prev.busqueda, 400);
    if (busqueda && (!/^https:\/\//i.test(busqueda) || !busqueda.includes('{q}'))) return { error: `La busqueda de ${nombre} debe ser una direccion https con {q} donde va el texto a buscar` };
    const item = { id, nombre, url, busqueda, usuario: clip(raw?.usuario, 120), notas: clip(raw?.notas, 300), clave_enc: prev.clave_enc || null };
    if (typeof raw?.clave === 'string' && raw.clave.trim()) item.clave_enc = encryptSecret(raw.clave.trim());
    next.push(item);
  }
  conn.proveedores = next;
  await saveConnections(tenantId, conn);
  return { ok: true };
}

export async function listSuppliers(tenantId) {
  const conn = await loadConnections(tenantId);
  return { status: 200, body: { ok: true, proveedores: (conn.proveedores || []).map((p) => ({ nombre: p.nombre, url: p.url, notas: p.notas || '', tiene_acceso: Boolean(p.usuario && p.clave_enc), busca_precios: Boolean(searchTemplate(p)) })) } };
}

export async function verifySetup(tenantId, tipo, nombre) {
  if (tipo === 'whatsapp') return testWhatsApp(tenantId);
  const conn = await loadConnections(tenantId);
  if (tipo === 'proveedor') {
    const list = conn.proveedores || [];
    const wanted = String(nombre || '').trim().toLowerCase();
    const found = wanted ? list.find((p) => p.nombre.toLowerCase() === wanted) : list[list.length - 1];
    if (!found) return { status: 409, body: { ok: false, error: 'El usuario no guardo el proveedor' } };
    return { status: 200, body: { ok: true, proveedor: found.nombre, url: found.url, tiene_acceso: Boolean(found.usuario && found.clave_enc) } };
  }
  if (tipo === 'banco') {
    const items = conn.plaid?.items || [];
    if (items.length) return { status: 200, body: { ok: true, bancos: items.map((i) => i.institution || 'Banco') } };
    if (conn.plaid?.secret_enc) return { status: 409, body: { ok: false, error: 'Se guardaron las credenciales de Plaid pero falta conectar el banco' } };
    return { status: 409, body: { ok: false, error: 'El usuario no completo la conexion del banco' } };
  }
  return { status: 400, body: { ok: false, error: 'tipo invalido' } };
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function searchTemplate(supplier) {
  return supplier.busqueda || SEARCH_TEMPLATES[hostOf(supplier.url)] || '';
}

async function worker(path, body, timeoutMs) {
  if (!WORKER_URL || !WORKER_TOKEN) return { status: 409, body: { ok: false, error: 'El navegador en la nube todavia no esta configurado' } };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${WORKER_URL}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WORKER_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.ok ? 200 : 502, body: json };
  } catch (e) {
    return { status: 504, body: { ok: false, error: e.name === 'AbortError' ? 'El navegador tardo demasiado en responder' : `No se pudo contactar el navegador: ${e.message}` } };
  } finally {
    clearTimeout(timer);
  }
}

export async function searchSupplier(tenantId, { proveedor, consulta } = {}) {
  const query = clip(consulta, 120);
  if (!query) return { status: 400, body: { ok: false, error: 'consulta es requerida' } };
  const conn = await loadConnections(tenantId);
  const wanted = String(proveedor || '').trim().toLowerCase();
  const supplier = (conn.proveedores || []).find((p) => p.nombre.toLowerCase() === wanted) || (conn.proveedores || []).find((p) => wanted && p.nombre.toLowerCase().includes(wanted));
  if (!supplier) return { status: 404, body: { ok: false, error: 'Proveedor no encontrado. Revisa proveedores_listar.' } };
  const template = searchTemplate(supplier);
  if (!template) return { status: 409, body: { ok: false, error: `Falta la direccion de busqueda de ${supplier.nombre}. Pidele al usuario la direccion de una busqueda de ejemplo en su pagina para guardarla.` } };
  const r = await worker('/search', { url: template.replace('{q}', encodeURIComponent(query)), consulta: query, limite: 8 }, 58_000);
  if (r.body?.ok) return { status: 200, body: { ...r.body, proveedor: supplier.nombre } };
  return { status: r.status, body: { ok: false, proveedor: supplier.nombre, estado: r.body?.estado || null, error: r.body?.error || 'No se pudo consultar el proveedor' } };
}

export async function supplierLoginWindow(tenantId, id) {
  const conn = await loadConnections(tenantId);
  const supplier = (conn.proveedores || []).find((p) => p.id === id);
  if (!supplier) return { status: 404, body: { ok: false, error: 'Proveedor no encontrado' } };
  if (!supplier.url) return { status: 409, body: { ok: false, error: 'El proveedor no tiene direccion web' } };
  const r = await worker('/live-url', { url: supplier.url }, 50_000);
  if (!r.body?.ok) return { status: r.status, body: { ok: false, error: r.body?.error || 'No se pudo abrir la ventanilla' } };
  return { status: 200, body: { ok: true, url: `${WORKER_URL}${r.body.path}` } };
}

export function workerConfigured() {
  return Boolean(WORKER_URL && WORKER_TOKEN);
}
