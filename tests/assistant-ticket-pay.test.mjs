import test from 'node:test';
import assert from 'node:assert/strict';

const TENANT = '11111111-2222-4333-8444-555555555555';
const SERVICE = 's'.repeat(40);
process.env.SUPABASE_URL = 'https://sb.test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.MUSE_TENANT_ID = TENANT;
process.env.JAIME_TENANT_ID = TENANT;
process.env.ASSISTANT_KEY_SECRET = 'k'.repeat(40);
process.env.JAIME_API_TOKEN = SERVICE;
process.env.RESEND_API_KEY = 're_prueba';

const SB = 'https://sb.test.invalid';
const ORDER_ID = '30000000-0000-4000-8000-000000000417';
const TX_ID = '40000000-0000-4000-8000-000000000001';
const REQUEST_ID = 'eeeeeeee-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ORDER = {
  id: ORDER_ID,
  order_number: 'WO-417',
  status: 'ready_for_pickup',
  customer_id: null,
  customer_name: 'Juan Perez',
  customer_phone: '7875551234',
  customer_email: 'juan@example.com',
  device_brand: 'Apple',
  device_model: 'iPhone 13',
  cost_estimate: 120,
  amount_paid: 20,
  balance_due: 100,
  status_history: [],
  created_date: '2026-11-01T10:00:00Z',
  updated_date: '2026-11-03T10:00:00Z',
};
const SHOP = { name: '911 Smart Fix', payment_methods: { custom: [{ id: 'C-ZELLE', label: 'Zelle', enabled: true }, { id: 'C-OFF', label: 'Venmo', enabled: false }] } };

function jsonResponse(status, data) {
  return new Response(data === undefined ? '' : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function fakeSupabase({ order = ORDER, register = true, requestsTable = 'missing', storedRequest = null, existingPayments = [], tenant = SHOP } = {}) {
  const calls = [];
  const emails = [];
  let current = order ? { ...order } : null;
  const inserted = [];
  const fetchImpl = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url: u, body });
    if (u === 'https://api.resend.com/emails') {
      emails.push(body);
      return jsonResponse(200, { id: 'email-1' });
    }
    if (!u.startsWith(SB)) throw new Error(`red real bloqueada: ${u}`);
    const path = decodeURIComponent(u.slice(`${SB}/rest/v1/`.length));
    if (path.startsWith('assistant_payment_requests')) {
      if (requestsTable === 'missing') return jsonResponse(404, { code: 'PGRST205', message: "Could not find the table 'public.assistant_payment_requests'" });
      if (method === 'GET') return jsonResponse(200, storedRequest ? [storedRequest] : []);
      return jsonResponse(201);
    }
    if (path.startsWith('tenant?')) return jsonResponse(200, tenant ? [tenant] : []);
    if (path.startsWith('cash_register?')) return jsonResponse(200, register ? [{ id: 'reg-1', status: 'open' }] : []);
    if (path.startsWith('order?') && method === 'PATCH') {
      current = { ...current, ...body };
      return jsonResponse(200, []);
    }
    if (path.startsWith('order?')) return jsonResponse(200, current && (path.includes(`"${current.order_number}"`) || path.includes(`id=eq.${current.id}`)) ? [current] : []);
    if (path.startsWith('transaction?') && path.includes('id=eq.') && !path.includes('order_id')) return jsonResponse(200, [{ id: TX_ID, amount: 50, payment_method: 'cash', created_at: '2026-11-03T12:00:00Z' }]);
    if (path.startsWith('transaction?') && path.includes('type=eq.revenue&category=eq.repair_payment')) return jsonResponse(200, existingPayments);
    if (path.startsWith('transaction?') && path.includes('type=eq.refund')) return jsonResponse(200, []);
    if (path.startsWith('transaction?')) return jsonResponse(200, [
      { id: 'tx-old', type: 'revenue', amount: 20, payment_method: 'cash', description: 'Deposito', created_at: '2026-11-01T10:00:00Z' },
      { id: 'tx-exp', type: 'expense', amount: 5, payment_method: 'cash', description: 'Pieza', created_at: '2026-11-01T11:00:00Z' },
    ]);
    if (path === 'transaction' && method === 'POST') {
      const row = { ...body, id: TX_ID, created_at: '2026-11-03T12:00:00.000Z' };
      inserted.push(row);
      return jsonResponse(201, [row]);
    }
    if (method === 'GET') return jsonResponse(200, []);
    return jsonResponse(200, {});
  };
  return { calls, emails, fetchImpl, inserted, order: () => current };
}

const realFetch = globalThis.fetch;
const { assistantHandler, registrarPago, TOOLS } = await import('../api/_lib/assistant.js');
const pay = await import('../api/_lib/ticketPay.js');

function call(route, { method = 'GET', body, token = SERVICE } = {}) {
  return new Promise((resolve) => {
    const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, query: { assistant: route }, body };
    const res = {
      statusCode: 200,
      setHeader() {},
      status(c) { this.statusCode = c; return this; },
      json(p) { resolve({ status: this.statusCode, body: p }); return this; },
      send(p) { resolve({ status: this.statusCode, body: p }); return this; },
    };
    assistantHandler(req, res);
  });
}

async function withFetch(fake, fn) {
  globalThis.fetch = fake.fetchImpl;
  try { return await fn(); } finally { globalThis.fetch = realFetch; }
}

async function quiet(fn) {
  const warns = [];
  const warn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try { await fn(); } finally { console.warn = warn; }
  return warns;
}

const payBody = (extra = {}) => ({ monto: 50, metodo: 'tarjeta', origen: 'android', ...extra });

test('sin token responde 401 JSON en las rutas de cobro', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    for (const [route, method] of [['boleto/WO-417/cobro', 'GET'], ['boleto/WO-417/pago', 'POST']]) {
      const r = await call(route, { method, token: '', body: payBody() });
      assert.equal(r.status, 401, route);
      assert.equal(r.body.code, 'unauthorized');
    }
  });
  assert.equal(fake.calls.length, 0);
});

test('GET cobro: datos del boleto, ultimos pagos de ingreso y puede_cobrar', async () => {
  const fake = fakeSupabase();
  const r = await withFetch(fake, () => call('boleto/WO-417/cobro'));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.boleto, {
    numero: 'WO-417',
    id: ORDER_ID,
    cliente: { nombre: 'Juan Perez', telefono: '7875551234', email: 'juan@example.com' },
    equipo: r.body.boleto.equipo,
    estatus: 'ready_for_pickup',
    estatus_nombre: r.body.boleto.estatus_nombre,
    total: 120,
    cobrado: 20,
    saldo: 100,
  });
  assert.ok(r.body.boleto.equipo.includes('iPhone 13'));
  assert.deepEqual(r.body.pagos, [{ id: 'tx-old', monto: 20, metodo: 'cash', fecha: '2026-11-01T10:00:00Z', nota: 'Deposito' }]);
  assert.equal(r.body.puede_cobrar, true);
  assert.equal('motivo' in r.body, false);
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
  const orderRead = fake.calls.find((c) => c.url.includes('/order?'));
  assert.ok(decodeURIComponent(orderRead.url).includes(`tenant_id=eq.${TENANT}`));
});

test('GET cobro: cancelado, abandonado, entregado o sin balance no se puede cobrar; 404 si no existe', async () => {
  for (const [patch, re] of [[{ status: 'cancelled' }, /cancelado/], [{ status: 'abandoned' }, /abandonado/], [{ status: 'delivered' }, /entregado/i], [{ amount_paid: 120, balance_due: 0 }, /no tiene balance/], [{ cost_estimate: 0, amount_paid: 0, balance_due: 0 }, /no tiene balance/]]) {
    const fake = fakeSupabase({ order: { ...ORDER, ...patch } });
    const r = await withFetch(fake, () => call('boleto/WO-417/cobro'));
    assert.equal(r.body.puede_cobrar, false, JSON.stringify(patch));
    assert.match(r.body.motivo, re);
  }
  const none = fakeSupabase({ order: null });
  const r = await withFetch(none, () => call('boleto/WO-999/cobro'));
  assert.equal(r.status, 404);
  assert.equal(r.body.code, 'not_found');
  const bad = await withFetch(none, () => call('boleto/WO%3B1/cobro'));
  assert.equal(bad.status, 400);
});

test('POST pago: registra por la misma funcion de registrar_pago, atribuido a la app, con recibo por correo', async () => {
  const fake = fakeSupabase();
  const r = await withFetch(fake, () => call('boleto/WO-417/pago', { method: 'POST', body: payBody({ nota: 'abono' }) }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, {
    ok: true,
    pago: { id: TX_ID, monto: 50, metodo: 'tarjeta', fecha: '2026-11-03T12:00:00.000Z' },
    boleto: { numero: 'WO-417', total: 120, cobrado: 70, saldo: 50, estatus: 'ready_for_pickup' },
    repetido: false,
    recibo: { enviado: true, canal: 'correo' },
    avisos: [],
  });
  assert.equal(fake.inserted.length, 1);
  assert.equal(fake.inserted[0].recorded_by, 'prueba - App Android');
  assert.equal(fake.inserted[0].payment_method, 'card');
  assert.equal(fake.inserted[0].category, 'repair_payment');
  assert.ok(fake.inserted[0].description.includes('abono'));
  assert.equal(fake.emails.length, 1);
  assert.deepEqual([fake.emails[0].to].flat(), ['juan@example.com']);
  assert.equal(fake.order().amount_paid, 70);
  assert.equal(fake.calls.filter((c) => c.method === 'DELETE').length, 0);
});

test('POST pago: sobrecobro 409 over_balance, cancelado 409 not_collectable, 404 y sin caja 409, sin escribir', async () => {
  const cases = [
    [{}, payBody({ monto: 100.01 }), 409, 'over_balance'],
    [{ order: { ...ORDER, status: 'cancelled' } }, payBody(), 409, 'not_collectable'],
    [{ order: { ...ORDER, amount_paid: 120, balance_due: 0 } }, payBody(), 409, 'not_collectable'],
    [{ order: null }, payBody(), 404, 'not_found'],
    [{ register: false }, payBody(), 409, 'no_open_register'],
  ];
  for (const [opts, body, status, code] of cases) {
    const fake = fakeSupabase(opts);
    const r = await withFetch(fake, () => call('boleto/WO-417/pago', { method: 'POST', body }));
    assert.equal(r.status, status, `${code} ${JSON.stringify(r.body)}`);
    assert.equal(r.body.code, code);
    assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0, code);
  }
});

test('POST pago: validaciones claras con 400 invalid_body', () => {
  const badForm = (b, msg) => assert.throws(() => pay.readPayForm(b, []), (e) => e.status === 400 && e.body.code === 'invalid_body' && e.body.error.includes(msg));
  badForm(payBody({ origen: 'web' }), 'origen');
  badForm(payBody({ monto: 0 }), 'monto');
  badForm(payBody({ monto: '50' }), 'monto');
  badForm(payBody({ monto: -1 }), 'monto');
  badForm(payBody({ metodo: 'bitcoin' }), 'metodo');
  badForm(payBody({ metodo: 'efectivo', monto_recibido: 40 }), 'menor');
  badForm(payBody({ nota: 'x'.repeat(301) }), 'nota');
  badForm(payBody({ notificar_cliente: 'no' }), 'notificar_cliente');
  badForm(payBody({ id_cliente_solicitud: 'x' }), 'uuid');
  const ok = pay.readPayForm(payBody({ metodo: 'cash', monto: 25.555, monto_recibido: 40 }), []);
  assert.equal(ok.metodo, 'efectivo');
  assert.equal(ok.monto, 25.56);
  assert.equal(ok.montoRecibido, 40);
  assert.equal(ok.notificar, true);
});

test('POST pago en efectivo devuelve el cambio y guarda solo el monto cobrado', async () => {
  const fake = fakeSupabase();
  const r = await withFetch(fake, () => call('boleto/WO-417/pago', { method: 'POST', body: payBody({ metodo: 'efectivo', monto: 100, monto_recibido: 120 }) }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.cambio, 20);
  assert.equal(r.body.pago.metodo, 'efectivo');
  assert.equal(r.body.boleto.saldo, 0);
  assert.equal(fake.inserted[0].amount, 100);
  assert.equal(fake.inserted[0].payment_method, 'cash');
  assert.equal(fake.order().paid, true);
});

test('POST pago con metodo personalizado lo graba con su etiqueta como el iPad', async () => {
  const fake = fakeSupabase();
  const r = await withFetch(fake, () => call('boleto/WO-417/pago', { method: 'POST', body: payBody({ metodo: 'c-zelle' }) }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.pago.metodo, 'C-ZELLE');
  assert.equal(fake.inserted[0].payment_method, 'zelle');
  assert.equal(fake.inserted[0].is_settled, true);
  assert.ok(fake.order().status_history.at(-1).note.includes('(Zelle)'));
  const off = fakeSupabase();
  const r2 = await withFetch(off, () => call('boleto/WO-417/pago', { method: 'POST', body: payBody({ metodo: 'C-OFF' }) }));
  assert.equal(r2.status, 400);
  assert.match(r2.body.error, /metodo invalido/);
});

test('recibo no enviado por falta de email se avisa en recibo.motivo', async () => {
  const fake = fakeSupabase({ order: { ...ORDER, customer_email: null } });
  const r = await withFetch(fake, () => call('boleto/WO-417/pago', { method: 'POST', body: payBody() }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.recibo, { enviado: false, motivo: 'el cliente no tiene un email valido' });
  assert.equal(fake.emails.length, 0);
  const off = fakeSupabase();
  const r2 = await withFetch(off, () => call('boleto/WO-417/pago', { method: 'POST', body: payBody({ notificar_cliente: false }) }));
  assert.equal(r2.body.recibo.enviado, false);
  assert.equal(off.emails.length, 0);
});

test('id_cliente_solicitud repetido devuelve el pago ya hecho sin registrar otro', async () => {
  const fake = fakeSupabase({ requestsTable: 'ok', storedRequest: { order_id: ORDER_ID, pago_id: TX_ID } });
  const r = await withFetch(fake, () => call('boleto/WO-417/pago', { method: 'POST', body: payBody({ id_cliente_solicitud: REQUEST_ID }) }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.repetido, true);
  assert.deepEqual(r.body.pago, { id: TX_ID, monto: 50, metodo: 'cash', fecha: '2026-11-03T12:00:00Z' });
  assert.equal(r.body.boleto.numero, 'WO-417');
  assert.equal(r.body.recibo.enviado, false);
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('con la tabla creada guarda la solicitud y omite el bloqueo de 2 minutos; sin tabla lo mantiene', async () => {
  const recent = [{ amount: 50, created_at: new Date(Date.now() - 30_000).toISOString() }];
  const withTable = fakeSupabase({ requestsTable: 'ok', existingPayments: recent });
  const r = await withFetch(withTable, () => call('boleto/WO-417/pago', { method: 'POST', body: payBody({ id_cliente_solicitud: REQUEST_ID }) }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.pago.id, TX_ID);
  const saved = withTable.calls.find((c) => c.method === 'POST' && c.url.includes('assistant_payment_requests'));
  assert.deepEqual(saved.body, { tenant_id: TENANT, request_id: REQUEST_ID, order_id: ORDER_ID, pago_id: TX_ID });
  for (const body of [payBody({ id_cliente_solicitud: REQUEST_ID }), payBody()]) {
    const noTable = fakeSupabase({ requestsTable: 'missing', existingPayments: recent });
    let r2;
    const warns = await quiet(() => withFetch(noTable, async () => { r2 = await call('boleto/WO-417/pago', { method: 'POST', body }); }));
    assert.equal(r2.status, 200, JSON.stringify(r2.body));
    assert.equal(r2.body.duplicado, true);
    assert.equal(r2.body.pago, null);
    assert.equal(noTable.inserted.length, 0);
    assert.equal(r2.body.avisos.length, 1);
    if (body.id_cliente_solicitud) assert.ok(warns.some((w) => w.includes('assistant_payment_requests')));
  }
});

test('la herramienta registrar_pago del asistente sigue igual', async () => {
  const tool = TOOLS.find((t) => t.name === 'registrar_pago');
  const input = { numero: 'WO-417', monto: 50, metodo: 'efectivo', nota: 'x' };
  assert.deepEqual(tool.run(input), { method: 'POST', path: 'tickets/WO-417/pagos', body: { monto: 50, metodo: 'efectivo', nota: 'x', notificar_cliente: undefined } });
  assert.equal(tool.mutating, true);
  const seen = [];
  await registrarPago(input, 'Yo', { callApi: async (m, p, o, actor) => { seen.push({ m, p, o, actor }); return { status: 200, body: { ok: true } }; } });
  assert.deepEqual(seen[0], { m: 'POST', p: 'tickets/WO-417/pagos', o: { query: undefined, body: tool.run(input).body }, actor: 'Yo' });
  const recent = [{ amount: 50, created_at: new Date(Date.now() - 30_000).toISOString() }];
  const fake = fakeSupabase({ register: false, existingPayments: recent, order: { ...ORDER, customer_email: null } });
  const dup = await withFetch(fake, () => registrarPago({ ...input, sin_filtro_duplicados: '1' }, 'Asistente IA - prueba'));
  assert.equal(dup.body.duplicado, true);
  const fresh = fakeSupabase({ register: false, order: { ...ORDER, customer_email: null } });
  const ok = await withFetch(fresh, () => registrarPago({ numero: 'WO-417', monto: 150, metodo: 'efectivo', nota: 'y'.repeat(200) }, 'Asistente IA - prueba'));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.pago.monto, 100);
  assert.equal(ok.body.pago.recibido, 150);
  assert.equal(fresh.inserted[0].recorded_by, 'Asistente IA - prueba');
  assert.equal(fresh.inserted[0].payment_method, 'cash');
  assert.ok(fresh.inserted[0].description.endsWith(`· ${'y'.repeat(150)}`));
  assert.equal(fresh.calls.filter((c) => c.url.includes('cash_register')).length, 0);
});
