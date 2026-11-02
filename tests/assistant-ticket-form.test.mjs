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

const SB = 'https://sb.test.invalid';
const PHOTO = `${SB}/storage/v1/object/public/uploads/tenants/${TENANT}/orders/tmp/a.jpg`;
const EXISTING = { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', name: 'Maria Lopez', phone: '(787) 555-1234', email: 'maria@ejemplo.com' };
const NEW_CUSTOMER_ID = 'cccccccc-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const ORDER_ID = 'dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const REQUEST_ID = 'eeeeeeee-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function jsonResponse(status, data) {
  return new Response(data === undefined ? '' : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function fakeSupabase({ phoneMatch = null, requestsTable = 'missing', storedRequest = null } = {}) {
  const calls = [];
  let insertedOrder = null;
  const fetchImpl = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url: u, body });
    if (!u.startsWith(SB)) throw new Error(`red real bloqueada: ${u}`);
    const path = decodeURIComponent(u.slice(`${SB}/rest/v1/`.length));
    if (path.startsWith('assistant_ticket_requests')) {
      if (requestsTable === 'missing') return jsonResponse(404, { code: 'PGRST205', message: "Could not find the table 'public.assistant_ticket_requests'" });
      if (method === 'GET') return jsonResponse(200, storedRequest ? [storedRequest] : []);
      return jsonResponse(201);
    }
    if (path.startsWith('customer?') && path.includes('phone=ilike')) return jsonResponse(200, phoneMatch ? [phoneMatch] : []);
    if (path.startsWith('customer?') && path.includes(`id=eq.${EXISTING.id}`)) return jsonResponse(200, [EXISTING]);
    if (path.startsWith('customer?')) return jsonResponse(200, []);
    if (path === 'customer' && method === 'POST') return jsonResponse(201, [{ id: NEW_CUSTOMER_ID, name: body.name, phone: body.phone, email: body.email }]);
    if (path === 'rpc/next_order_number') return jsonResponse(200, 'WO-9999');
    if (path === 'order' && method === 'POST') {
      insertedOrder = { ...body, id: ORDER_ID, is_deleted: false };
      return jsonResponse(201, [insertedOrder]);
    }
    if (path.startsWith('order?') && path.includes('device_model=ilike')) return jsonResponse(200, [{ device_type: 'phone', device_family: 'iPhone', device_brand: 'Apple' }]);
    if (path.startsWith('order?') && path.includes(`id=eq.${ORDER_ID}`)) {
      const row = insertedOrder || { id: ORDER_ID, order_number: 'WO-9000', customer_id: EXISTING.id, customer_name: EXISTING.name, customer_phone: EXISTING.phone, customer_email: EXISTING.email, device_brand: 'Apple', device_model: 'iPhone 13' };
      return jsonResponse(200, [row]);
    }
    if (method === 'GET') return jsonResponse(200, []);
    return jsonResponse(200, {});
  };
  return { calls, fetchImpl, inserted: () => insertedOrder };
}

const realFetch = globalThis.fetch;
const { assistantHandler, crearBoleto, TOOLS } = await import('../api/_lib/assistant.js');
const form = await import('../api/_lib/ticketForm.js');

function call(route, { method = 'GET', body, query = {}, token = SERVICE } = {}) {
  return new Promise((resolve) => {
    const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, query: { assistant: route, ...query }, body };
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

const baseBody = () => ({
  cliente: { nombre: 'juan', apellido: 'perez', telefono: '787-555-9876' },
  equipo: { tipo: 'Celular', marca: 'Apple', modelo: 'iPhone 13', color: 'Azul' },
  problema: 'Pantalla rota',
  codigo_equipo: '1234',
  fotos: [PHOTO],
  origen: 'ios',
});

test('sin token responde 401 en las rutas nuevas', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    const a = await call('clientes', { token: '', query: { q: 'juan' } });
    assert.equal(a.status, 401);
    assert.equal(a.body.ok, false);
    assert.equal(a.body.code, 'unauthorized');
    const b = await call('boleto/nuevo', { method: 'POST', token: '', body: baseBody() });
    assert.equal(b.status, 401);
    assert.equal(b.body.code, 'unauthorized');
  });
  assert.equal(fake.calls.length, 0);
});

test('crearBoleto usa la misma herramienta crear_boleto (POST tickets)', async () => {
  const seen = [];
  const deps = { callApi: async (m, p, o, actor) => { seen.push({ m, p, o, actor }); return { status: 200, body: { ok: true } }; } };
  const input = { cliente: 'Juan Perez', equipo: 'Apple iPhone', problema: 'x' };
  await crearBoleto(input, 'Yo', deps);
  const tool = TOOLS.find((t) => t.name === 'crear_boleto');
  assert.deepEqual(seen[0], { m: 'POST', p: 'tickets', o: { query: undefined, body: input }, actor: 'Yo' });
  assert.deepEqual(tool.run(input), { method: 'POST', path: 'tickets', body: input });
});

test('buscar clientes: menos de 2 caracteres devuelve lista vacia sin consultar', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    const r = await call('clientes', { query: { q: 'a' } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true, clientes: [] });
  });
  assert.equal(fake.calls.length, 0);
});

test('buscar clientes: forma de salida, maximo 10 y conteo de boletos', async () => {
  const rows = Array.from({ length: 14 }, (_, i) => ({ id: `aaaaaaaa-bbbb-4ccc-8ddd-${String(i).padStart(12, '0')}`, name: `Ana Maria Rivera ${i}`, phone: '7875550000', email: null, loyalty_points: 5, total_spent: 900 }));
  const deps = {
    callApi: async (m, p, o) => {
      assert.equal(p, 'clientes');
      assert.equal(o.query.limite, 10);
      return { status: 200, body: { ok: true, clientes: rows.map((c) => ({ id: c.id, nombre: c.name, telefono: c.phone, email: c.email, puntos: 5, total_gastado: 900 })) } };
    },
    sb: async (path) => {
      assert.ok(path.includes(`tenant_id=eq.${TENANT}`));
      return [{ customer_id: rows[0].id }, { customer_id: rows[0].id }, { customer_id: rows[1].id }];
    },
  };
  const r = await form.searchCustomers({ q: 'ana', actor: 'x', tenantId: TENANT }, deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.clientes.length, 10);
  assert.deepEqual(r.body.clientes[0], { id: rows[0].id, nombre: 'Ana', apellido: 'Maria Rivera 0', telefono: '7875550000', email: null, boletos: 2 });
  assert.equal(r.body.clientes[1].boletos, 1);
  assert.equal(r.body.clientes[2].boletos, 0);
  assert.equal('puntos' in r.body.clientes[0], false);
});

test('validaciones del formulario', () => {
  const bad = (mut, msg) => {
    const b = baseBody();
    mut(b);
    assert.throws(() => form.readTicketForm(b, TENANT), (e) => e.status === 400 && e.body.code === 'invalid_body' && e.body.error.includes(msg));
  };
  bad((b) => { b.origen = 'web'; }, 'origen');
  bad((b) => { b.cliente.telefono = '555-1234'; }, '10 digitos');
  bad((b) => { delete b.cliente.apellido; }, 'apellido');
  bad((b) => { delete b.cliente.nombre; }, 'nombre');
  bad((b) => { delete b.cliente; }, 'cliente_id o cliente');
  bad((b) => { b.equipo.modelo = ' '; }, 'equipo.modelo');
  bad((b) => { delete b.equipo; }, 'equipo es requerido');
  bad((b) => { b.problema = ''; }, 'problema');
  bad((b) => { b.fotos = ['https://evil.example.com/a.jpg']; }, 'fotos');
  bad((b) => { b.fotos = [`${SB}/storage/v1/object/public/uploads/tenants/otro-tenant/a.jpg`]; }, 'fotos');
  bad((b) => { b.fotos = [`${SB}/storage/v1/object/public/uploads/tenants/${TENANT}/../x.jpg`]; }, 'fotos');
  bad((b) => { b.id_cliente_solicitud = 'no-uuid'; }, 'uuid');
  bad((b) => { b.cliente_id = 'x'; }, 'cliente_id');
  bad((b) => { b.cliente.email = 'josé@x.com'; }, 'email');
  const ok = form.readTicketForm({ ...baseBody(), cliente: { nombre: 'A', apellido: 'B', telefono: '+1 (787) 555-0000' } }, TENANT);
  assert.equal(ok.cliente.telefono, '7875550000');
});

test('POST boleto/nuevo con datos invalidos responde 400 sin escribir', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    const r = await call('boleto/nuevo', { method: 'POST', body: { ...baseBody(), problema: '' } });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'invalid_body');
  });
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('cliente nuevo: crea por el mismo camino del asistente con color, codigo y fotos; sin tabla de idempotencia sigue funcionando', async () => {
  const fake = fakeSupabase({ requestsTable: 'missing' });
  const warns = [];
  const warn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try {
    await withFetch(fake, async () => {
      const r = await call('boleto/nuevo', { method: 'POST', body: { ...baseBody(), id_cliente_solicitud: REQUEST_ID } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.ok, true);
      assert.equal(r.body.boleto.numero, 'WO-9999');
      assert.equal(r.body.boleto.id, ORDER_ID);
      assert.equal(r.body.boleto.cliente.id, NEW_CUSTOMER_ID);
      assert.equal(r.body.boleto.cliente.nombre, 'Juan Perez');
      assert.equal(r.body.cliente_existente, false);
      assert.equal(r.body.repetido, false);
    });
  } finally {
    console.warn = warn;
  }
  const row = fake.inserted();
  assert.equal(row.tenant_id, TENANT);
  assert.equal(row.status, 'intake');
  assert.equal(row.device_brand, 'Apple');
  assert.equal(row.device_model, 'iPhone 13');
  assert.equal(row.device_color, 'Azul');
  assert.deepEqual(row.device_security, { device_pin: '1234' });
  assert.deepEqual(row.device_photos, [PHOTO]);
  assert.equal(row.customer_id, NEW_CUSTOMER_ID);
  assert.equal(row.created_by_name, 'prueba - App iOS');
  assert.ok(warns.some((w) => w.includes('assistant_ticket_requests')));
  assert.equal(fake.calls.filter((c) => c.method === 'POST' && c.url.includes('assistant_ticket_requests')).length, 0);
  assert.equal(fake.calls.filter((c) => c.method === 'DELETE' || c.method === 'PATCH').length, 0);
});

test('telefono existente: usa el cliente existente sin duplicar y lo indica', async () => {
  const fake = fakeSupabase({ phoneMatch: EXISTING, requestsTable: 'ok' });
  await withFetch(fake, async () => {
    const r = await call('boleto/nuevo', { method: 'POST', body: { ...baseBody(), cliente: { nombre: 'Otra', apellido: 'Persona', telefono: '7875551234' }, id_cliente_solicitud: REQUEST_ID, origen: 'android' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.cliente_existente, true);
    assert.equal(r.body.boleto.cliente.id, EXISTING.id);
  });
  assert.equal(fake.calls.filter((c) => c.method === 'POST' && c.url.endsWith('/rest/v1/customer')).length, 0);
  const row = fake.inserted();
  assert.equal(row.customer_id, EXISTING.id);
  assert.equal(row.customer_name, EXISTING.name);
  assert.equal(row.created_by_name, 'prueba - App Android');
  const saved = fake.calls.find((c) => c.method === 'POST' && c.url.includes('assistant_ticket_requests'));
  assert.deepEqual(saved.body, { tenant_id: TENANT, request_id: REQUEST_ID, order_id: ORDER_ID });
});

test('cliente_id: usa ese cliente del taller', async () => {
  const fake = fakeSupabase({ requestsTable: 'ok' });
  await withFetch(fake, async () => {
    const b = baseBody();
    delete b.cliente;
    const r = await call('boleto/nuevo', { method: 'POST', body: { ...b, cliente_id: EXISTING.id, codigo_equipo: 'abc12' } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.cliente_existente, true);
  });
  const row = fake.inserted();
  assert.equal(row.customer_id, EXISTING.id);
  assert.deepEqual(row.device_security, { device_password: 'abc12' });
});

test('id_cliente_solicitud repetido devuelve el boleto ya creado sin crear otro', async () => {
  const fake = fakeSupabase({ requestsTable: 'ok', storedRequest: { order_id: ORDER_ID } });
  await withFetch(fake, async () => {
    const r = await call('boleto/nuevo', { method: 'POST', body: { ...baseBody(), id_cliente_solicitud: REQUEST_ID } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.repetido, true);
    assert.equal(r.body.boleto.numero, 'WO-9000');
    assert.equal(r.body.boleto.id, ORDER_ID);
  });
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('la herramienta crear_boleto sin campos nuevos sigue igual (sin color, codigo ni cliente_id)', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    const r = await crearBoleto({ cliente: 'pedro gomez', telefono: '7875550001', equipo: 'Samsung S24', marca: 'Samsung', modelo: 'S24', problema: 'No carga' }, 'Asistente IA - prueba');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.creado, true);
    assert.equal(r.body.numero, 'WO-9999');
  });
  const row = fake.inserted();
  assert.equal('device_color' in row, false);
  assert.equal('device_security' in row, false);
  assert.equal(row.created_by_name, 'Asistente IA - prueba');
});
