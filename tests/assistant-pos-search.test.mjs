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
const PID = 'aaaaaaaa-1111-4ccc-8ddd-eeeeeeeeeeee';
const PID2 = 'aaaaaaaa-2222-4ccc-8ddd-eeeeeeeeeeee';
const REQUEST_ID = 'eeeeeeee-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const PRODUCT = { id: PID, name: 'Cargador USB-C', price: 20, cost: 8, stock: 5, min_stock: 1, type: 'product', taxable: true, sku: 'CHG1', barcode: null, device_brand: 'Apple', device_model_tag: null, category: 'Accesorios', active: true };

function jsonResponse(status, data) {
  return new Response(data === undefined ? '' : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function fakeSupabase({ register = true, requestsTable = 'missing', storedRequest = null, storedSale = null } = {}) {
  const calls = [];
  let insertedSale = null;
  const fetchImpl = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url: u, body });
    if (!u.startsWith(SB)) throw new Error(`red real bloqueada: ${u}`);
    const path = decodeURIComponent(u.slice(`${SB}/rest/v1/`.length));
    if (path.startsWith('assistant_pos_requests')) {
      if (requestsTable === 'missing') return jsonResponse(404, { code: 'PGRST205', message: "Could not find the table 'public.assistant_pos_requests'" });
      if (method === 'GET') return jsonResponse(200, storedRequest ? [storedRequest] : []);
      return jsonResponse(201);
    }
    if (path.startsWith('cash_register?')) return jsonResponse(200, register ? [{ id: 'reg-1', status: 'open', opened_by: 'Francis', created_date: '2026-11-03T12:00:00.000Z' }] : []);
    if (path.startsWith('product_variant?')) return jsonResponse(200, []);
    if (path.startsWith('product?') && method === 'PATCH') return jsonResponse(200, [{ ...PRODUCT, stock: body.stock }]);
    if (path.startsWith('product?') && path.includes(`id=eq.${PID}`)) return jsonResponse(200, [PRODUCT]);
    if (path.startsWith('sale?') && path.includes('sale_number=eq.')) return jsonResponse(200, storedSale ? [storedSale] : []);
    if (path.startsWith('sale?')) return jsonResponse(200, []);
    if (path === 'sale' && method === 'POST') {
      insertedSale = { ...body, id: 'sale-1' };
      return jsonResponse(201, [insertedSale]);
    }
    if (path === 'transaction' && method === 'POST') return jsonResponse(201);
    if (method === 'GET') return jsonResponse(200, []);
    return jsonResponse(200, {});
  };
  return { calls, fetchImpl, sale: () => insertedSale };
}

const realFetch = globalThis.fetch;
const { assistantHandler, ventaMostrador, TOOLS } = await import('../api/_lib/assistant.js');
const pos = await import('../api/_lib/posForm.js');
const search = await import('../api/_lib/search.js');

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

async function quiet(fn) {
  const warns = [];
  const warn = console.warn;
  console.warn = (...a) => warns.push(a.join(' '));
  try { await fn(); } finally { console.warn = warn; }
  return warns;
}

const withIvu = (n) => Math.round(Number(n) * 1.115 * 100) / 100;
const saleBody = () => ({ items: [{ producto_id: PID, cantidad: 2 }], metodo: 'cash', monto_recibido: 50, origen: 'android' });

test('sin token responde 401 JSON en las 4 rutas nuevas', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    for (const [route, method] of [['buscar', 'GET'], ['pos/productos', 'GET'], ['pos/caja', 'GET'], ['pos/venta', 'POST']]) {
      const r = await call(route, { method, token: '', query: { q: 'ab' }, body: saleBody() });
      assert.equal(r.status, 401, route);
      assert.equal(r.body.ok, false);
      assert.equal(r.body.code, 'unauthorized');
    }
  });
  assert.equal(fake.calls.length, 0);
});

test('ventaMostrador usa la misma herramienta venta_mostrador (POST pos/ventas)', async () => {
  const seen = [];
  const deps = { callApi: async (m, p, o, actor) => { seen.push({ m, p, o, actor }); return { status: 200, body: { ok: true } }; } };
  const input = { items: [{ producto_id: PID, cantidad: 1 }], metodo: 'tarjeta' };
  await ventaMostrador(input, 'Yo', deps);
  const tool = TOOLS.find((t) => t.name === 'venta_mostrador');
  assert.deepEqual(seen[0], { m: 'POST', p: 'pos/ventas', o: { query: undefined, body: input }, actor: 'Yo' });
  assert.deepEqual(tool.run(input), { method: 'POST', path: 'pos/ventas', body: input });
  assert.deepEqual(tool.input_schema.properties.metodo.enum, ['efectivo', 'ath_movil', 'tarjeta', 'transferencia']);
  assert.equal(tool.mutating, true);
  assert.equal(tool.auto, undefined);
});

test('la herramienta venta_mostrador sigue igual de punta a punta (Asistente IA, efectivo sin monto)', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    const r = await ventaMostrador({ items: [{ producto_id: PID, cantidad: 1 }], metodo: 'efectivo' }, 'Asistente IA - prueba');
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.ok, true);
    assert.equal(r.body.venta.total, 22.3);
    assert.equal(r.body.venta.iva, 2.3);
  });
  const sale = fake.sale();
  assert.equal(sale.employee, 'Asistente IA - prueba');
  assert.equal(sale.payment_method, 'cash');
  assert.equal(sale.amount_received, 22.3);
  assert.equal(sale.cash_register_id, 'reg-1');
});

test('POST pos/venta: registra por la misma funcion, atribuida a la app Android, sin tabla de idempotencia sigue', async () => {
  const fake = fakeSupabase({ requestsTable: 'missing' });
  let r;
  const warns = await quiet(() => withFetch(fake, async () => {
    r = await call('pos/venta', { method: 'POST', body: { ...saleBody(), id_cliente_solicitud: REQUEST_ID, notas: '  mostrador  ' } });
  }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(r.body.repetido, false);
  assert.match(r.body.venta.numero, /^POS-[0-9A-F]{8}$/);
  assert.deepEqual({ ...r.body.venta, numero: 'x' }, { numero: 'x', total: 44.6, subtotal: 40, ivu: 4.6, cambio: 5.4 });
  const sale = fake.sale();
  assert.equal(sale.employee, 'prueba - App Android');
  assert.equal(sale.notes, 'mostrador');
  assert.equal(sale.amount_received, 50);
  assert.ok(warns.some((w) => w.includes('assistant_pos_requests')));
  assert.equal(fake.calls.filter((c) => c.method === 'POST' && c.url.includes('assistant_pos_requests')).length, 0);
  assert.equal(fake.calls.filter((c) => c.method === 'DELETE').length, 0);
  assert.equal(fake.calls.filter((c) => c.method === 'PATCH' && !c.url.includes('/product?')).length, 0);
});

test('POST pos/venta sin caja abierta responde 409 no_open_register sin escribir', async () => {
  const fake = fakeSupabase({ register: false });
  await withFetch(fake, async () => {
    const r = await call('pos/venta', { method: 'POST', body: { ...saleBody(), metodo: 'card', monto_recibido: undefined, origen: 'ios' } });
    assert.equal(r.status, 409);
    assert.deepEqual(r.body, { ok: false, code: 'no_open_register', error: 'No hay una caja abierta. Abre la caja desde otro equipo.' });
  });
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('POST pos/venta: efectivo con monto menor al total lo rechaza la funcion compartida', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    const r = await call('pos/venta', { method: 'POST', body: { ...saleBody(), monto_recibido: 10 } });
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'invalid_body');
    assert.match(r.body.error, /menor al total/);
  });
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('id_cliente_solicitud repetido devuelve la venta ya hecha sin registrar otra', async () => {
  const fake = fakeSupabase({ requestsTable: 'ok', storedRequest: { venta_numero: 'POS-ABCD1234' }, storedSale: { sale_number: 'POS-ABCD1234', subtotal: 40, tax_amount: 4.6, total: 44.6, change_due: 5.4, payment_method: 'cash' } });
  await withFetch(fake, async () => {
    const r = await call('pos/venta', { method: 'POST', body: { ...saleBody(), id_cliente_solicitud: REQUEST_ID } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body, { ok: true, repetido: true, venta: { numero: 'POS-ABCD1234', total: 44.6, subtotal: 40, ivu: 4.6, cambio: 5.4 } });
  });
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('con la tabla creada guarda la solicitud despues de la venta', async () => {
  const fake = fakeSupabase({ requestsTable: 'ok' });
  let r;
  await withFetch(fake, async () => {
    r = await call('pos/venta', { method: 'POST', body: { ...saleBody(), metodo: 'ath_movil', monto_recibido: undefined, id_cliente_solicitud: REQUEST_ID } });
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal('cambio' in r.body.venta, false);
  assert.equal(fake.sale().payment_method, 'ath_movil');
  const saved = fake.calls.find((c) => c.method === 'POST' && c.url.includes('assistant_pos_requests'));
  assert.deepEqual(saved.body, { tenant_id: TENANT, request_id: REQUEST_ID, venta_numero: r.body.venta.numero });
});

test('validaciones de la venta', () => {
  const bad = (mut, msg) => {
    const b = saleBody();
    mut(b);
    assert.throws(() => pos.readSaleForm(b), (e) => e.status === 400 && e.body.code === 'invalid_body' && e.body.error.includes(msg));
  };
  bad((b) => { b.origen = 'web'; }, 'origen');
  bad((b) => { b.metodo = 'bitcoin'; }, 'metodo');
  bad((b) => { b.items = []; }, 'items');
  bad((b) => { b.items = Array.from({ length: 31 }, () => ({ producto_id: PID, cantidad: 1 })); }, 'items');
  bad((b) => { b.items[0].cantidad = 0; }, 'cantidad');
  bad((b) => { b.items[0].cantidad = 1.5; }, 'cantidad');
  bad((b) => { b.items[0].cantidad = 101; }, 'cantidad');
  bad((b) => { b.items[0].cantidad = '2'; }, 'cantidad');
  bad((b) => { b.items[0].descuento_pct = 120; }, 'descuento_pct');
  bad((b) => { b.items[0].descuento_pct = -1; }, 'descuento_pct');
  bad((b) => { b.items[0].precio = -5; }, 'precio');
  bad((b) => { b.items[0].producto_id = 'x'; }, 'producto_id');
  bad((b) => { delete b.monto_recibido; }, 'monto_recibido');
  bad((b) => { b.monto_recibido = 0; }, 'monto_recibido');
  bad((b) => { b.id_cliente_solicitud = 'no-uuid'; }, 'uuid');
  bad((b) => { b.notas = 'x'.repeat(301); }, 'notas');
  const ok = pos.readSaleForm({ items: [{ producto_id: PID, cantidad: 3, precio: '12.5', descuento_pct: 10 }], metodo: 'card', monto_recibido: 99, origen: 'ios' });
  assert.equal(ok.metodo, 'tarjeta');
  assert.equal(ok.montoRecibido, undefined);
  assert.deepEqual(ok.items, [{ producto_id: PID, cantidad: 3, precio: 12.5, descuento_pct: 10 }]);
  assert.equal(pos.readSaleForm({ ...saleBody(), metodo: 'efectivo' }).metodo, 'efectivo');
});

test('pos/caja: abierta con quien y desde cuando, y cerrada', async () => {
  const open = fakeSupabase({ register: true });
  await withFetch(open, async () => {
    const r = await call('pos/caja');
    assert.deepEqual(r.body, { ok: true, abierta: true, abierta_por: 'Francis', desde: '2026-11-03T12:00:00.000Z' });
  });
  assert.equal(open.calls.filter((c) => c.method !== 'GET').length, 0);
  const closed = fakeSupabase({ register: false });
  await withFetch(closed, async () => {
    const r = await call('pos/caja');
    assert.deepEqual(r.body, { ok: true, abierta: false });
  });
});

test('pos/productos: solo con stock o servicios, IVU calculado, variantes y hay_mas', async () => {
  const productos = [
    { id: PID, nombre: 'Cargador', precio: 20, stock: 5, tipo: 'producto', gravable: true, categoria: 'Accesorios' },
    { id: PID2, nombre: 'Cable', precio: 10, stock: 0, tipo: 'producto', gravable: true, categoria: null },
    { id: 'svc', nombre: 'Diagnostico', precio: 30, stock: null, tipo: 'servicio', gravable: false, categoria: 'Servicios' },
  ];
  const deps = {
    callApi: async (m, p, o) => {
      assert.equal(p, 'pos/productos');
      assert.deepEqual(o.query, { q: 'car', pagina: 2, limite: 30 });
      return { status: 200, body: { ok: true, productos } };
    },
    sb: async (path) => {
      assert.ok(path.startsWith(`product_variant?product_id=in.(${PID})`));
      return [{ product_id: PID }];
    },
    withIvu,
  };
  const r = await pos.posProductList({ q: 'car', pagina: '2', actor: 'x' }, deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.hay_mas, false);
  assert.deepEqual(r.body.productos, [
    { id: PID, nombre: 'Cargador', precio_sin_ivu: 20, precio_con_ivu: 22.3, stock: 5, tipo: 'producto', categoria: 'Accesorios', tiene_variantes: true },
    { id: 'svc', nombre: 'Diagnostico', precio_sin_ivu: 30, precio_con_ivu: 30, stock: null, tipo: 'servicio', categoria: 'Servicios', tiene_variantes: false },
  ]);
  const many = await pos.posProductList({ q: '', actor: 'x' }, { ...deps, callApi: async () => ({ status: 200, body: { ok: true, productos: Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, nombre: 'x', precio: 1, stock: 1, tipo: 'producto' })) } }), sb: async () => [] });
  assert.equal(many.body.hay_mas, true);
  assert.equal(many.body.productos.length, 30);
  const badPage = await pos.posProductList({ pagina: '0' }, deps);
  assert.equal(badPage.status, 400);
});

test('buscar: menos de 2 caracteres devuelve listas vacias sin consultar', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    const r = await call('buscar', { query: { q: 'a' } });
    assert.deepEqual(r.body, { ok: true, boletos: [], clientes: [], piezas: [] });
    const r2 = await call('buscar', { query: { q: '((' } });
    assert.deepEqual(r2.body, { ok: true, boletos: [], clientes: [], piezas: [] });
    const r3 = await call('buscar', { query: { q: 'juan', tipos: 'boletos,otros' } });
    assert.equal(r3.status, 400);
  });
  assert.equal(fake.calls.length, 0);
});

test('buscar: boletos abiertos primero, WO sin guion, notas, clientes con saldo y piezas con IVU', async () => {
  const T = (id, numero, status, updated, extra = {}) => ({ id, order_number: numero, status, status_note: null, customer_name: 'Juan Perez', customer_phone: '787-555-1234', device_brand: 'Apple', device_model: 'iPhone 13', updated_date: updated, created_date: updated, ...extra });
  const ids = ['10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003'];
  const seen = [];
  const deps = {
    withIvu,
    callApi: async (m, p, o) => {
      seen.push({ p, q: o.query });
      if (p === 'tickets') return { status: 200, body: { ok: true, tickets: [
        { id: ids[0], numero: 'WO-382', cliente: 'Juan Perez', telefono: '787-555-1234', equipo: 'Apple iPhone 13', estatus: 'delivered', estatus_nombre: 'Entregado', ultima_actualizacion: '2026-11-03T10:00:00Z' },
        { id: ids[1], numero: 'WO-3820', cliente: 'Ana', telefono: null, equipo: 'Samsung', estatus: 'in_progress', estatus_nombre: 'En reparacion', ultima_actualizacion: '2026-10-01T10:00:00Z' },
      ] } };
      if (p === 'clientes') return { status: 200, body: { ok: true, clientes: [{ id: ids[0], nombre: 'Juan Perez', telefono: '7875551234', email: null }] } };
      if (p === 'pos/productos') return { status: 200, body: { ok: true, productos: [{ id: PID, nombre: 'Pantalla', precio: 100, stock: 2, tipo: 'producto', gravable: true, categoria: 'Pantallas' }] } };
      throw new Error(p);
    },
    sb: async (path) => {
      if (path.startsWith('order?') && path.includes('or=(device_brand')) return [T(ids[2], 'WO-500', 'waiting_parts', '2026-11-02T10:00:00Z', { status_note: 'Pieza pedida' })];
      if (path.startsWith('order?') && path.includes('customer_id=in.')) return [{ customer_id: ids[0], status: 'ready_for_pickup', balance_due: 40 }, { customer_id: ids[0], status: 'delivered', balance_due: 15 }];
      if (path.startsWith('order?') && path.includes('id=in.')) return [{ id: ids[1], status_note: 'Cambiando pantalla' }];
      if (path.startsWith('product?')) return [{ ...PRODUCT, id: PID2, name: 'Bateria Apple', taxable: false, price: 50, stock: 3 }];
      throw new Error(path);
    },
  };
  const r = await search.universalSearch({ q: 'wo382', actor: 'x', tenantId: TENANT }, deps);
  assert.equal(r.status, 200);
  assert.equal(seen.find((s) => s.p === 'tickets').q.q, 'WO-382');
  assert.equal(seen.find((s) => s.p === 'tickets').q.estatus, 'todos');
  assert.deepEqual(r.body.boletos.map((b) => b.numero), ['WO-500', 'WO-3820', 'WO-382']);
  assert.equal(r.body.boletos[0].ultima_nota, 'Pieza pedida');
  assert.equal(r.body.boletos[1].ultima_nota, 'Cambiando pantalla');
  assert.equal('ultima_nota' in r.body.boletos[2], false);
  assert.deepEqual(Object.keys(r.body.boletos[2]).sort(), ['actualizado', 'cliente', 'equipo', 'estatus', 'estatus_nombre', 'id', 'numero', 'telefono']);
  assert.deepEqual(r.body.clientes, [{ id: ids[0], nombre: 'Juan', apellido: 'Perez', telefono: '7875551234', email: null, boletos: 2, saldo_pendiente: 40 }]);
  assert.deepEqual(r.body.piezas, [
    { id: PID, nombre: 'Pantalla', precio_sin_ivu: 100, precio_con_ivu: 111.5, stock: 2, categoria: 'Pantallas' },
    { id: PID2, nombre: 'Bateria Apple', precio_sin_ivu: 50, precio_con_ivu: 50, stock: 3, categoria: 'Accesorios' },
  ]);
  assert.equal('avisos' in r.body, false);
});

test('buscar: si un grupo falla devuelve ese grupo vacio con aviso y los demas siguen', async () => {
  const deps = {
    withIvu,
    callApi: async (m, p) => {
      if (p === 'clientes') return { status: 502, body: { ok: false, error: 'caido' } };
      if (p === 'tickets') return { status: 200, body: { ok: true, tickets: [] } };
      return { status: 200, body: { ok: true, productos: [] } };
    },
    sb: async () => [],
  };
  let r;
  await quiet(async () => { r = await search.universalSearch({ q: 'juan', tipos: 'clientes,boletos', actor: 'x', tenantId: TENANT }, deps); });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.clientes, []);
  assert.deepEqual(r.body.piezas, []);
  assert.deepEqual(r.body.avisos, ['No se pudo buscar clientes; intenta de nuevo.']);
});

test('buscar clientes sin saldo (ruta clientes) no cambia su forma', async () => {
  const form = await import('../api/_lib/ticketForm.js');
  const deps = {
    callApi: async () => ({ status: 200, body: { ok: true, clientes: [{ id: PID, nombre: 'Ana Rivera', telefono: null, email: null }] } }),
    sb: async (path) => {
      assert.ok(path.includes('select=customer_id&'));
      return [{ customer_id: PID }];
    },
  };
  const r = await form.searchCustomers({ q: 'ana', actor: 'x', tenantId: TENANT }, deps);
  assert.deepEqual(r.body.clientes[0], { id: PID, nombre: 'Ana', apellido: 'Rivera', telefono: null, email: null, boletos: 1 });
});
