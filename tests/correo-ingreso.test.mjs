import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const TENANT = '11111111-2222-4333-8444-555555555555';
const SERVICE = 's'.repeat(40);
const SECRET = 'k'.repeat(40);
process.env.SUPABASE_URL = 'https://sb.test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.MUSE_TENANT_ID = TENANT;
process.env.JAIME_TENANT_ID = TENANT;
process.env.ASSISTANT_KEY_SECRET = SECRET;
process.env.JAIME_API_TOKEN = SERVICE;

const SB = 'https://sb.test.invalid';
const META = 'https://api.meta.ai/v1/responses';
const MAIL = 'https://smartfixos.onrender.com/sendEmailInternal';
const USER_TOKEN = 'u'.repeat(50);
const ORDER_ID = 'dddddddd-0000-4000-8000-000000000001';
const CUSTOMER_ID = 'cccccccc-0000-4000-8000-000000000001';
const photo = (n) => `${SB}/storage/v1/object/public/uploads/tenants/${TENANT}/orders/tmp/${n}.jpg`;

const realFetch = globalThis.fetch;
const realWarn = console.warn;
const realError = console.error;
console.warn = () => {};
console.error = () => {};

const mod = await import('../api/_lib/intakeEmail.js');
const { sb } = await import('../api/_lib/muse.js');
const { jaimeHandler } = await import('../api/_lib/jaime.js');
const { assistantHandler, crearBoleto } = await import('../api/_lib/assistant.js');

function encryptKey(plain) {
  const key = crypto.createHash('sha256').update(SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function json(status, data) {
  if (status === 204 || data === undefined) return new Response(null, { status: status === 200 ? 204 : status });
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function unquote(v) {
  return v.replace(/^"|"$/g, '');
}

function matches(row, key, expr) {
  if (expr.startsWith('not.')) return !matches(row, key, expr.slice(4));
  const value = row[key];
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const arg = expr.slice(dot + 1);
  if (op === 'is') return arg === 'null' ? value === null || value === undefined : value !== null && value !== undefined;
  if (value === null || value === undefined) return op === 'neq';
  if (op === 'eq') return String(value) === arg;
  if (op === 'neq') return String(value) !== arg;
  if (op === 'in') return arg.slice(1, -1).split(',').map(unquote).includes(String(value));
  if (op === 'like' || op === 'ilike') {
    const re = new RegExp(`^${arg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`, op === 'ilike' ? 'i' : '');
    return re.test(String(value));
  }
  const a = Date.parse(value);
  const b = Date.parse(arg);
  const cmp = Number.isFinite(a) && Number.isFinite(b) ? a - b : Number(value) - Number(arg);
  if (op === 'gt') return cmp > 0;
  if (op === 'gte') return cmp >= 0;
  if (op === 'lt') return cmp < 0;
  if (op === 'lte') return cmp <= 0;
  throw new Error(`operador no soportado: ${op}`);
}

const SKIP = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'or']);

function world({ tenantSettings = {}, tenantExtra = {}, order = null, customer = null, legacyLog = false, mail = 'ok', mailDelay = 0, metaReplies = [], role = 'owner' } = {}) {
  const tables = {
    tenant: [{ id: TENANT, name: 'Taller Prueba', admin_name: 'Francis', email: 'taller@prueba.com', admin_phone: '787-555-0000', address: 'Calle 1, San Juan', logo_url: 'https://cdn.prueba.com/logo.png', currency: 'USD', settings: tenantSettings, ...tenantExtra }],
    customer: customer ? [customer] : [],
    order: order ? [order] : [],
    email_log: [],
    app_settings: [
      { id: 'cfg', slug: `ai-assistant-${TENANT}`, payload: { provider: 'meta', model: 'muse-spark-1.3', base_url: '', tope_tokens_mes: 0, tope_usd_mes: 100, autonomia: 'inteligente', key_enc: encryptKey('LLM_1_secreto') } },
      { id: 'main', slug: 'app-main-settings', payload: { business_name: 'Taller Prueba' } },
    ],
  };
  const mails = [];
  const meta = [];
  const state = { mail, mailDelay };
  let metaIndex = 0;
  let seq = 0;
  const fetchImpl = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    if (u === MAIL) {
      mails.push({ body, headers: opts.headers });
      if (state.mailDelay) await new Promise((r) => setTimeout(r, state.mailDelay));
      if (state.mail === 'hang') {
        return new Promise((resolve, reject) => {
          opts.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        });
      }
      if (state.mail === 'down') throw new TypeError('fetch failed');
      if (state.mail === 'fail') return json(500, { error: 'Failed to send email via resend: 503' });
      return json(200, { status: 'sent', message_id: `msg-${mails.length}`, provider: 'resend' });
    }
    if (u === META) {
      meta.push(body);
      const r = metaReplies[Math.min(metaIndex, metaReplies.length - 1)];
      metaIndex += 1;
      return json(200, r);
    }
    if (u === `${SB}/auth/v1/user`) return json(200, { id: 'user-1', email: 'tecnico@prueba.com' });
    if (!u.startsWith(SB)) throw new Error(`red real bloqueada: ${u}`);
    const parsed = new URL(u);
    const path = parsed.pathname.replace('/rest/v1/', '');
    const sp = parsed.searchParams;
    if (path === 'rpc/get_user_tenants') return json(200, [{ tenant_id: TENANT, role }]);
    if (path === 'rpc/next_order_number') return json(200, `WO-${1000 + tables.order.length + 1}`);
    if (path === 'rpc/append_order_history') {
      const o = tables.order.find((r) => r.id === body.p_order_id);
      if (!o) return json(404, { message: 'no existe' });
      o.status_history = [...(Array.isArray(o.status_history) ? o.status_history : []), ...body.p_entries];
      return json(200, o.status_history);
    }
    const table = path;
    tables[table] = tables[table] || [];
    const prefer = opts.headers?.Prefer || '';
    const usesDedupe = (body && 'dedupe_key' in body) || [...sp.keys()].includes('dedupe_key') || (sp.get('on_conflict') || '').includes('dedupe_key');
    if (table === 'email_log' && legacyLog && usesDedupe) {
      return method === 'GET' ? json(400, { code: '42703', message: 'column email_log.dedupe_key does not exist' }) : json(400, { code: 'PGRST204', message: "Could not find the 'dedupe_key' column of 'email_log' in the schema cache" });
    }
    const filtered = () => {
      let rows = [...tables[table]];
      for (const [k, expr] of sp.entries()) {
        if (SKIP.has(k)) continue;
        rows = rows.filter((r) => matches(r, k, expr));
      }
      return rows;
    };
    if (method === 'POST') {
      const conflict = (sp.get('on_conflict') || '').split(',').filter(Boolean);
      if (conflict.length) {
        const dup = tables[table].find((r) => conflict.every((c) => r[c] !== null && r[c] !== undefined && r[c] === body[c]));
        if (dup) {
          if (prefer.includes('ignore-duplicates')) return json(201, []);
          return json(409, { code: '23505', message: 'duplicate key value violates unique constraint' });
        }
      }
      if (table === 'email_log' && body.dedupe_key && tables.email_log.some((r) => r.tenant_id === body.tenant_id && r.dedupe_key === body.dedupe_key)) {
        return json(409, { code: '23505', message: 'duplicate key value violates unique constraint "email_log_dedupe_uidx"' });
      }
      seq += 1;
      const stamp = new Date(Date.now()).toISOString();
      const row = { id: body.id || `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`, created_at: stamp, updated_at: stamp, ...body };
      if (table === 'order') row.is_deleted = row.is_deleted ?? false;
      tables[table].push(row);
      return prefer.includes('return=minimal') ? json(201) : json(201, [row]);
    }
    if (method === 'PATCH') {
      const rows = filtered();
      for (const r of rows) Object.assign(r, body, table === 'email_log' && !('updated_at' in body) ? { updated_at: new Date(Date.now()).toISOString() } : {});
      return prefer.includes('return=representation') ? json(200, rows) : json(204);
    }
    if (method === 'DELETE') throw new Error('borrado bloqueado');
    let rows = filtered();
    if (sp.has('limit')) rows = rows.slice(0, Number(sp.get('limit')));
    const select = (sp.get('select') || '*').split(',');
    if (!select.includes('*')) rows = rows.map((r) => Object.fromEntries(select.filter((c) => c in r).map((c) => [c, r[c]])));
    return json(200, rows);
  };
  return { tables, mails, meta, state, fetchImpl };
}

async function within(w, fn) {
  globalThis.fetch = w.fetchImpl;
  try { return await fn(); } finally { globalThis.fetch = realFetch; }
}

const baseOrder = (extra = {}) => ({
  id: ORDER_ID,
  tenant_id: TENANT,
  is_deleted: false,
  order_number: 'WO-501',
  status: 'intake',
  customer_id: CUSTOMER_ID,
  customer_name: 'Juan Perez',
  customer_email: 'juan@ejemplo.com',
  customer_phone: '7875559876',
  device_type: 'phone',
  device_brand: 'Apple',
  device_family: 'iPhone',
  device_model: 'iPhone 13',
  device_color: 'Azul',
  initial_problem: 'Pantalla rota',
  device_photos: [photo('a'), photo('b')],
  photos_metadata: [],
  status_history: [],
  order_items: [{ id: 'l1', type: 'part', name: 'Pantalla OLED', quantity: 1, price: 120 }],
  cost_estimate: 120,
  amount_paid: 20,
  ...extra,
});

const baseCustomer = (lang = 'es') => ({ id: CUSTOMER_ID, tenant_id: TENANT, name: 'Juan Perez', email: 'juan@ejemplo.com', preferred_language: lang });

const deps = () => ({ sb, waitUntil: null });
const send = (extra = {}) => mod.sendIntakeEmail({ tenantId: TENANT, orderId: ORDER_ID, sender: 'servidor', actor: 'Prueba', ...extra }, deps());

test('contenido con fotos: miniaturas enlazadas, tope de 8, datos del equipo, problema, piezas y resumen', () => {
  const order = baseOrder({ device_photos: Array.from({ length: 10 }, (_, i) => photo(`f${i}`)) });
  const r = mod.renderIntakeEmail({ order, tenant: { name: 'Taller Prueba' }, lang: 'es' });
  assert.equal(r.subject, 'Recibimos tu equipo · Boleto WO-501');
  assert.equal(r.active, true);
  assert.ok(r.html.includes('Hemos recibido tu equipo'));
  assert.ok(r.html.includes('Hola Juan Perez, Recibimos tu equipo en el taller.'));
  assert.ok(r.html.includes('FOTOS DEL EQUIPO'));
  assert.equal((r.html.match(/\/storage\/v1\/render\/image\/public\/uploads\//g) || []).length, 8);
  assert.ok(r.html.includes('width=400&amp;quality=70&amp;resize=contain') || r.html.includes('width=400&quality=70&resize=contain'));
  assert.ok(r.html.includes(`href='${photo('f0')}'`));
  assert.ok(!r.html.includes(photo('f9').replace('/object/', '/render/image/')));
  assert.ok(r.html.includes('+ 2 foto(s) más en tu boleto'));
  for (const t of ['EQUIPO', 'WO-501', 'Apple', 'iPhone 13', 'Azul', 'PROBLEMA REPORTADO', 'Pantalla rota', 'PIEZAS Y SERVICIOS', 'Pantalla OLED', '$120.00', 'RESUMEN', 'Saldo pendiente', '$100.00']) assert.ok(r.html.includes(t), t);
});

test('contenido sin fotos: no aparece el bloque de fotos', () => {
  const r = mod.renderIntakeEmail({ order: baseOrder({ device_photos: [] }), tenant: {}, lang: 'es' });
  assert.ok(!r.html.includes('FOTOS DEL EQUIPO'));
  assert.ok(!r.html.includes('render/image'));
  const bad = mod.renderIntakeEmail({ order: baseOrder({ device_photos: ['javascript:alert(1)', 'http://x.test/a.jpg'] }), tenant: {}, lang: 'es' });
  assert.ok(!bad.html.includes('FOTOS DEL EQUIPO'));
});

test('contenido con terminos: garantia, condiciones de venta y abandono del taller', () => {
  const tenant = { name: 'Taller Prueba', settings: { policies: { repair_warranty: '90 dias en piezas', sales_terms: 'No hay devoluciones\nen accesorios' }, abandonment_policy: { abandon_days: 15, claim_total_days: 60, daily_fee: 5 } } };
  const r = mod.renderIntakeEmail({ order: baseOrder(), tenant, lang: 'es' });
  assert.ok(r.html.includes('Garantía de Reparación'));
  assert.ok(r.html.includes('90 dias en piezas'));
  assert.ok(r.html.includes('Condiciones de Venta'));
  assert.ok(r.html.includes('No hay devoluciones<br>en accesorios'));
  assert.ok(r.html.includes('Política de Abandono y Almacenaje'));
  assert.ok(r.html.includes('(En este taller: 15 días para recoger, cargo de $5.00/día, 60 días para reclamo total.)'));
  const custom = mod.renderIntakeEmail({ order: baseOrder(), tenant: { settings: { policies: { abandonment_terms: 'Texto propio de abandono' } } }, lang: 'es' });
  assert.ok(custom.html.includes('Texto propio de abandono'));
  assert.ok(!custom.html.includes('Garantía de Reparación'));
});

test('contenido sin firma y con firma', () => {
  const sin = mod.renderIntakeEmail({ order: baseOrder(), tenant: {}, lang: 'es' });
  assert.ok(!sin.html.includes('FIRMA DEL CLIENTE'));
  const url = `${SB}/storage/v1/object/public/uploads/tenants/${TENANT}/firmas/f.png`;
  const con = mod.renderIntakeEmail({ order: baseOrder({ device_security: { signature_url: url, device_pin: '1234' } }), tenant: {}, lang: 'es' });
  assert.ok(con.html.includes('FIRMA DEL CLIENTE'));
  assert.ok(con.html.includes(url.replace('/object/', '/render/image/')));
  assert.ok(!con.html.includes('1234'));
});

test('contenido en ingles y datos del taller: logo, telefono, direccion, redes, plantilla propia', () => {
  const tenant = {
    name: 'Taller Prueba', email: 'taller@prueba.com', admin_phone: '787-555-0000', address: 'Calle 1', logo_url: 'https://cdn.prueba.com/logo.png',
    settings: { social: { facebook: 'https://fb.com/t', instagram: 'https://ig.com/t' }, email_templates: { intake: { subject: 'Ya tenemos tu {order_number}', hero_title: '', hero_line: '', isActive: true } } },
  };
  const en = mod.renderIntakeEmail({ order: baseOrder(), tenant: { ...tenant, settings: { social: tenant.settings.social } }, lang: 'en' });
  assert.equal(en.subject, 'We received your device · Order WO-501');
  assert.ok(en.html.includes("We've received your device"));
  assert.ok(en.html.includes('Hi Juan Perez, '));
  assert.ok(en.html.includes('DEVICE PHOTOS'));
  assert.ok(en.html.includes('Abandonment &amp; Storage Policy'));
  assert.ok(en.html.includes('Sent by Taller Prueba · Powered by Archilla OS'));
  for (const t of ["src='https://cdn.prueba.com/logo.png'", 'Tel. 787-555-0000', 'Calle 1', 'taller@prueba.com', 'Facebook', 'Instagram']) assert.ok(en.html.includes(t), t);
  const es = mod.renderIntakeEmail({ order: baseOrder(), tenant, lang: 'es' });
  assert.equal(es.subject, 'Ya tenemos tu WO-501');
  assert.ok(es.html.includes('Hemos recibido tu equipo'));
  const payload = mod.emailPayload({ to: ' juan@ejemplo.com ', subject: es.subject, html: es.html, tenant });
  assert.deepEqual(Object.keys(payload).sort(), ['body', 'from', 'from_name', 'replyTo', 'subject', 'to']);
  assert.equal(payload.to, 'juan@ejemplo.com');
  assert.equal(payload.from, 'Taller Prueba <noreply@smartfixos.com>');
  assert.equal(payload.replyTo, 'taller@prueba.com');
});

test('envio: idioma del cliente en ingles, un solo correo, fila sent con llave y nota en el historial', async () => {
  const w = world({ order: baseOrder(), customer: baseCustomer('en') });
  const r = await within(w, () => send());
  assert.equal(r.enviada, true, JSON.stringify(r));
  assert.equal(r.codigo, 'enviado');
  assert.equal(r.idioma, 'en');
  assert.equal(r.modo, 'llave');
  assert.equal(w.mails.length, 1);
  assert.equal(w.mails[0].body.subject, 'We received your device · Order WO-501');
  assert.equal(w.mails[0].body.to, 'juan@ejemplo.com');
  assert.equal(w.mails[0].headers.Authorization, undefined);
  const log = w.tables.email_log;
  assert.equal(log.length, 1);
  assert.equal(log[0].dedupe_key, `ingreso:${ORDER_ID}`);
  assert.equal(log[0].status, 'sent');
  assert.equal(log[0].order_id, ORDER_ID);
  assert.equal(log[0].order_status, 'intake');
  assert.equal(log[0].sender, 'servidor');
  assert.ok(log[0].sent_at);
  assert.ok(log[0].body_html.includes('DEVICE PHOTOS'));
  const note = w.tables.order[0].status_history.at(-1);
  assert.equal(note.kind, 'email');
  assert.equal(note.email_type, 'intake');
  assert.equal(note.email_log_id, log[0].id);
  const again = await within(w, () => send());
  assert.equal(again.enviada, false);
  assert.equal(again.codigo, 'ya_enviado');
  assert.equal(w.mails.length, 1);
});

test('idempotencia: dos envios simultaneos mandan un solo correo', async () => {
  const w = world({ order: baseOrder(), customer: baseCustomer(), mailDelay: 20 });
  const [a, b] = await within(w, () => Promise.all([send(), send()]));
  assert.equal(w.mails.length, 1);
  assert.deepEqual([a.enviada, b.enviada].sort(), [false, true]);
  const loser = a.enviada ? b : a;
  assert.ok(['en_proceso', 'ya_enviado'].includes(loser.codigo), loser.codigo);
  assert.equal(w.tables.email_log.length, 1);
});

test('idempotencia: si un cliente (iOS o web) ya lo envio no se envia otra vez', async () => {
  const w = world({ order: baseOrder(), customer: baseCustomer() });
  w.tables.email_log.push({ id: 'ios-1', tenant_id: TENANT, to_email: 'juan@ejemplo.com', subject: 'Recibimos tu equipo · Boleto WO-501', status: 'sent', created_by: 'iOS' });
  const r = await within(w, () => send());
  assert.equal(r.codigo, 'ya_enviado');
  assert.equal(w.mails.length, 0);
  assert.equal(w.tables.email_log.length, 1);
});

test('idempotencia: si Android ya lo anoto en el historial no se envia otra vez', async () => {
  const w = world({ order: baseOrder({ status_history: [{ status: 'intake', kind: 'email', email_type: 'intake', note: 'Correo enviado' }] }), customer: baseCustomer() });
  const r = await within(w, () => send());
  assert.equal(r.codigo, 'ya_enviado');
  assert.equal(w.mails.length, 0);
});

test('reintento: si fallo, el siguiente intento retoma la misma fila y envia', async () => {
  const w = world({ order: baseOrder(), customer: baseCustomer(), mail: 'fail' });
  const first = await within(w, () => send());
  assert.equal(first.enviada, false);
  assert.equal(first.codigo, 'fallo_envio');
  assert.equal(first.reintentable, true);
  assert.equal(w.tables.email_log[0].status, 'failed');
  assert.ok(w.tables.email_log[0].error_message.includes('503'));
  w.state.mail = 'ok';
  const second = await within(w, () => send());
  assert.equal(second.enviada, true);
  assert.equal(second.reintento, true);
  assert.equal(w.tables.email_log.length, 1);
  assert.equal(w.tables.email_log[0].status, 'sent');
  assert.equal(w.mails.length, 2);
  const third = await within(w, () => send());
  assert.equal(third.codigo, 'ya_enviado');
  assert.equal(w.mails.length, 2);
});

test('una reserva pendiente vieja se retoma; una reciente no', async () => {
  const w = world({ order: baseOrder(), customer: baseCustomer() });
  const fresh = new Date(Date.now() - 60_000).toISOString();
  w.tables.email_log.push({ id: 'p-1', tenant_id: TENANT, to_email: 'juan@ejemplo.com', subject: 'x', status: 'pending', dedupe_key: `ingreso:${ORDER_ID}`, created_at: fresh, updated_at: fresh });
  const busy = await within(w, () => send());
  assert.equal(busy.codigo, 'en_proceso');
  assert.equal(w.mails.length, 0);
  const old = new Date(Date.now() - 11 * 60_000).toISOString();
  w.tables.email_log[0].updated_at = old;
  const taken = await within(w, () => send());
  assert.equal(taken.enviada, true);
  assert.equal(w.mails.length, 1);
});

test('cliente sin email o con email invalido: no envia ni registra', async () => {
  for (const email of ['', 'no-es-email', 'josé@x.com']) {
    const w = world({ order: baseOrder({ customer_email: email }), customer: baseCustomer() });
    const r = await within(w, () => send());
    assert.equal(r.enviada, false);
    assert.equal(r.codigo, email ? 'email_invalido' : 'sin_email');
    assert.equal(w.mails.length, 0);
    assert.equal(w.tables.email_log.length, 0);
  }
});

test('plantilla desactivada o envio del servidor apagado: no envia', async () => {
  const off = world({ order: baseOrder(), customer: baseCustomer(), tenantSettings: { email_templates: { intake: { subject: '', hero_title: '', hero_line: '', isActive: false } } } });
  const a = await within(off, () => send());
  assert.equal(a.codigo, 'plantilla_apagada');
  assert.equal(off.mails.length, 0);
  for (const settings of [{ server_emails: { intake: false } }, { email_templates: { intake: { subject: '', hero_title: '', hero_line: '', isActive: true, server_send: false } } }]) {
    const w = world({ order: baseOrder(), customer: baseCustomer(), tenantSettings: settings });
    const r = await within(w, () => send());
    assert.equal(r.codigo, 'servidor_apagado');
    assert.equal(w.mails.length, 0);
    const manual = await within(w, () => mod.sendIntakeEmail({ tenantId: TENANT, orderId: ORDER_ID, automatic: false, manual: true }, deps()));
    assert.equal(manual.enviada, true);
  }
  assert.equal(mod.serverSendEnabled({ settings: {} }), true);
  assert.equal(mod.serverSendEnabled(null), true);
});

test('sin la columna dedupe_key: envia como hoy, registra la fila y no repite por asunto', async () => {
  const w = world({ order: baseOrder(), customer: baseCustomer(), legacyLog: true });
  const r = await within(w, () => send());
  assert.equal(r.enviada, true);
  assert.equal(r.modo, 'sin_llave');
  assert.equal(w.tables.email_log.length, 1);
  assert.equal(w.tables.email_log[0].status, 'sent');
  assert.equal(w.tables.email_log[0].dedupe_key, undefined);
  const again = await within(w, () => send());
  assert.equal(again.codigo, 'ya_enviado');
  assert.equal(w.mails.length, 1);
});

test('la falla del servicio de correo no rompe y el tope de espera deja el envio pendiente', async () => {
  const w = world({ order: baseOrder(), customer: baseCustomer(), mail: 'down' });
  const down = await within(w, () => mod.intakeAfterCreate({ tenantId: TENANT, orderId: ORDER_ID }, deps()));
  assert.equal(down.enviada, false);
  assert.equal(down.codigo, 'fallo_envio');
  const h = world({ order: baseOrder(), customer: baseCustomer(), mail: 'hang' });
  const kept = [];
  globalThis.fetch = h.fetchImpl;
  try {
    const r = await mod.intakeAfterCreate({ tenantId: TENANT, orderId: ORDER_ID }, { sb, waitUntil: (p) => kept.push(p), sendTimeoutMs: 80 }, { capMs: 30 });
    assert.equal(r.enviada, false);
    assert.equal(r.pendiente, true);
    assert.equal(r.codigo, 'pendiente');
    assert.equal(kept.length, 1);
    assert.equal(h.tables.email_log[0].status, 'pending');
    const late = await kept[0];
    assert.equal(late.codigo, 'fallo_envio');
    assert.equal(h.tables.email_log[0].status, 'failed');
  } finally {
    globalThis.fetch = realFetch;
  }
  const crash = await mod.intakeAfterCreate({ tenantId: TENANT, orderId: ORDER_ID }, { sb: async () => { throw new Error('base caida'); }, waitUntil: null });
  assert.equal(crash.enviada, false);
  assert.equal(crash.codigo, 'fallo_envio');
});

function jaime(parts, body) {
  return new Promise((resolve) => {
    const req = { method: 'POST', headers: { authorization: `Bearer ${SERVICE}` }, query: { jaime: parts }, body, url: `/api/jaime/${parts.join('/')}` };
    const res = { statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(p) { resolve({ status: this.statusCode, body: p }); return this; } };
    jaimeHandler(req, res);
  });
}

function assistant(route, { method = 'POST', body, token = SERVICE } = {}) {
  return new Promise((resolve) => {
    const req = { method, headers: { authorization: `Bearer ${token}` }, query: { assistant: route }, body };
    const res = { statusCode: 200, setHeader() {}, status(c) { this.statusCode = c; return this; }, json(p) { resolve({ status: this.statusCode, body: p }); return this; }, send(p) { resolve({ status: this.statusCode, body: p }); return this; } };
    assistantHandler(req, res);
  });
}

const ticketInput = (extra = {}) => ({ cliente: 'Juan Perez', telefono: '7875559876', email: 'juan@ejemplo.com', equipo: 'Apple iPhone 13', marca: 'Apple', modelo: 'iPhone 13', problema: 'Pantalla rota', fotos: [photo('a'), photo('b')], ...extra });

function onlyOrder(w) {
  assert.equal(w.tables.order.length, 1);
  return w.tables.order[0];
}

test('camino Jaime: POST /tickets crea, adjunta fotos y despues envia el correo de ingreso una vez', async () => {
  const w = world();
  const r = await within(w, () => jaime(['tickets'], ticketInput()));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.creado, true);
  assert.equal(r.body.notificacion_enviada, true, JSON.stringify(r.body.notificacion));
  assert.equal(r.body.notificacion.canal, 'correo_ingreso');
  const order = onlyOrder(w);
  assert.equal(w.mails.length, 1);
  const mail = w.mails[0].body;
  assert.equal(mail.to, 'juan@ejemplo.com');
  assert.equal(mail.subject, `Recibimos tu equipo · Boleto ${order.order_number}`);
  assert.ok(mail.body.includes(photo('a').replace('/object/', '/render/image/')));
  assert.ok(mail.body.includes('Pantalla rota'));
  assert.equal(w.tables.email_log[0].dedupe_key, `ingreso:${order.id}`);
});

test('camino Jaime: notificar_cliente false no envia y una falla del correo no rompe la creacion', async () => {
  const quiet = world();
  const a = await within(quiet, () => jaime(['tickets'], ticketInput({ notificar_cliente: false })));
  assert.equal(a.body.creado, true);
  assert.equal(quiet.mails.length, 0);
  const down = world({ mail: 'down' });
  const b = await within(down, () => jaime(['tickets'], ticketInput()));
  assert.equal(b.status, 200);
  assert.equal(b.body.creado, true);
  assert.equal(b.body.notificacion_enviada, false);
  assert.equal(b.body.notificacion.codigo, 'fallo_envio');
  assert.equal(down.tables.order.length, 1);
  const noMail = world();
  const c = await within(noMail, () => jaime(['tickets'], ticketInput({ email: '' })));
  assert.equal(c.body.creado, true);
  assert.equal(c.body.notificacion.codigo, 'sin_email');
  assert.equal(noMail.mails.length, 0);
});

test('camino asistente: la herramienta crear_boleto envia el correo de ingreso', async () => {
  const w = world();
  const r = await within(w, () => crearBoleto(ticketInput(), 'Asistente IA - prueba'));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.notificacion_enviada, true);
  assert.equal(w.mails.length, 1);
  assert.equal(w.tables.order[0].status_history.at(-1).changed_by, 'Asistente IA - prueba');
});

test('camino Muse (Meta): el chat ejecuta crear_boleto y el cliente recibe el correo de ingreso', async () => {
  const call = { type: 'function_call', call_id: 'call_1', name: 'crear_boleto', arguments: JSON.stringify(ticketInput()) };
  const replies = [
    { id: 'r1', output: [call], usage: { input_tokens: 10, output_tokens: 5 } },
    { id: 'r2', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Boleto creado y se le aviso al cliente.' }] }], usage: { input_tokens: 10, output_tokens: 5 } },
  ];
  const w = world({ metaReplies: replies });
  const r = await within(w, () => assistant('chat', { body: { messages: [{ role: 'user', content: [{ type: 'text', text: 'Crea boleto para Juan Perez' }] }] } }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(w.meta.length, 2);
  assert.equal(w.tables.order.length, 1);
  assert.equal(w.mails.length, 1);
  assert.equal(w.mails[0].body.subject, `Recibimos tu equipo · Boleto ${w.tables.order[0].order_number}`);
});

test('camino formulario (boleto/nuevo): envia una vez y el reintento con la misma llave no repite el correo', async () => {
  const w = world();
  const body = { cliente: { nombre: 'Juan', apellido: 'Perez', telefono: '787-555-9876', email: 'juan@ejemplo.com' }, equipo: { tipo: 'Celular', marca: 'Apple', modelo: 'iPhone 13' }, problema: 'Pantalla rota', fotos: [photo('a')], origen: 'android', id_cliente_solicitud: 'eeeeeeee-0000-4000-8000-000000000001' };
  const a = await within(w, () => assistant('boleto/nuevo', { body }));
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.notificacion_enviada, true);
  assert.equal(w.mails.length, 1);
  const b = await within(w, () => assistant('boleto/nuevo', { body }));
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.repetido, true);
  assert.equal(b.body.notificacion.codigo, 'ya_enviado');
  assert.equal(w.mails.length, 1);
  assert.equal(w.tables.order.length, 1);
});

test('camino formulario: si el correo fallo al crear, el reintento con la misma llave lo envia', async () => {
  const w = world({ mail: 'fail' });
  const body = { cliente: { nombre: 'Juan', apellido: 'Perez', telefono: '787-555-9876', email: 'juan@ejemplo.com' }, equipo: { tipo: 'Celular', marca: 'Apple', modelo: 'iPhone 13' }, problema: 'Pantalla rota', origen: 'ios', id_cliente_solicitud: 'eeeeeeee-0000-4000-8000-000000000002' };
  const a = await within(w, () => assistant('boleto/nuevo', { body }));
  assert.equal(a.body.notificacion_enviada, false);
  w.state.mail = 'ok';
  const b = await within(w, () => assistant('boleto/nuevo', { body }));
  assert.equal(b.body.repetido, true);
  assert.equal(b.body.notificacion_enviada, true);
  assert.equal(w.mails.length, 2);
  assert.equal(w.tables.email_log.filter((r) => r.status === 'sent').length, 1);
});

test('reenvio manual: pide confirmacion, respeta la idempotencia y forzar solo para dueno o admin', async () => {
  const w = world({ order: baseOrder(), customer: baseCustomer() });
  const preview = await within(w, () => assistant(`boleto/WO-501/correo-ingreso`, { body: {} }));
  assert.equal(preview.status, 400);
  assert.equal(preview.body.code, 'confirmacion_requerida');
  assert.equal(preview.body.vista_previa.para, 'juan@ejemplo.com');
  assert.equal(preview.body.vista_previa.ya_enviado, false);
  assert.equal(w.mails.length, 0);
  const first = await within(w, () => assistant(`boleto/${ORDER_ID}/correo-ingreso`, { body: { confirmar: true, origen: 'ios' } }));
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(first.body.enviado, true);
  assert.equal(w.tables.email_log[0].sender, 'ios');
  const second = await within(w, () => assistant(`boleto/501/correo-ingreso`, { body: { confirmar: true } }));
  assert.equal(second.status, 200);
  assert.equal(second.body.enviado, false);
  assert.equal(second.body.correo.codigo, 'ya_enviado');
  assert.equal(w.mails.length, 1);
  const tech = world({ order: baseOrder(), customer: baseCustomer(), role: 'technician' });
  const denied = await within(tech, () => assistant(`boleto/WO-501/correo-ingreso`, { token: USER_TOKEN, body: { confirmar: true, forzar: true } }));
  assert.equal(denied.status, 403);
  assert.equal(denied.body.code, 'forzar_no_autorizado');
  const techSend = await within(tech, () => assistant(`boleto/WO-501/correo-ingreso`, { token: USER_TOKEN, body: { confirmar: true } }));
  assert.equal(techSend.status, 200, JSON.stringify(techSend.body));
  assert.equal(techSend.body.enviado, true);
  const forced = await within(w, () => assistant(`boleto/WO-501/correo-ingreso`, { body: { confirmar: true, forzar: true } }));
  assert.equal(forced.status, 200);
  assert.equal(forced.body.enviado, true);
  assert.equal(forced.body.correo.forzado, true);
  assert.equal(w.mails.length, 2);
  assert.ok(w.tables.email_log[1].dedupe_key.startsWith(`ingreso:${ORDER_ID}:manual:`));
  const missing = await within(w, () => assistant(`boleto/WO-9999/correo-ingreso`, { body: { confirmar: true } }));
  assert.equal(missing.status, 404);
});

test.after(() => {
  console.warn = realWarn;
  console.error = realError;
});
