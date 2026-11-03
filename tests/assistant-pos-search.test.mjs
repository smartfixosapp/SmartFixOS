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
const PRODUCT = { id: PID, name: 'Cargador USB-C', price: 20, cost: 8, stock: 5, min_stock: 1, type: 'product', taxable: true, sku: 'CHG1', barcode: null, device_brand: 'Apple', device_model_tag: null, category: 'Accesorios', active: true, tipo_principal: 'accesorios', subcategoria: 'cables' };
const PIEZA_ID = 'bbbbbbbb-1111-4ccc-8ddd-eeeeeeeeeeee';
const SERVICIO_ID = 'bbbbbbbb-2222-4ccc-8ddd-eeeeeeeeeeee';
const EQUIPO_ID = 'bbbbbbbb-3333-4ccc-8ddd-eeeeeeeeeeee';
const LEGADO_ID = 'bbbbbbbb-4444-4ccc-8ddd-eeeeeeeeeeee';
const PIEZA = { ...PRODUCT, id: PIEZA_ID, name: 'Pantalla iPhone 13', price: 100, stock: 3, tipo_principal: 'dispositivos', subcategoria: 'piezas_servicios', category: 'Pantallas' };
const SERVICIO = { ...PRODUCT, id: SERVICIO_ID, name: 'Diagnostico', price: 30, stock: null, type: 'service', taxable: false, tipo_principal: 'servicios', subcategoria: 'servicio', category: 'Servicios' };
const EQUIPO = { ...PRODUCT, id: EQUIPO_ID, name: 'Samsung A06 5G', price: 151, stock: 1, tipo_principal: 'dispositivos', subcategoria: 'dispositivo_completo', category: 'smartphone' };
const LEGADO = { ...PRODUCT, id: LEGADO_ID, name: 'iPhone 11 usado', price: 200, stock: 1, type: 'device', tipo_principal: null, subcategoria: null, category: null };
const CATALOG = [PRODUCT, PIEZA, SERVICIO, EQUIPO, LEGADO];

function jsonResponse(status, data) {
  return new Response(data === undefined ? '' : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function fakeSupabase({ register = true, requestsTable = 'missing', storedRequest = null, storedSale = null, tenant = null, tenantFail = false, recentSales = [], products = CATALOG } = {}) {
  const calls = [];
  let insertedSale = null;
  const transactions = [];
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
    if (path.startsWith('tenant?')) return tenantFail ? jsonResponse(500, { message: 'caido' }) : jsonResponse(200, tenant ? [tenant] : []);
    if (path.startsWith('cash_register?')) return jsonResponse(200, register ? [{ id: 'reg-1', status: 'open', opened_by: 'Francis', created_date: '2026-11-03T12:00:00.000Z' }] : []);
    if (path.startsWith('product_variant?')) return jsonResponse(200, []);
    if (path.startsWith('product?') && method === 'PATCH') return jsonResponse(200, [{ ...PRODUCT, stock: body.stock }]);
    if (path.startsWith('product?') && method === 'GET') {
      const one = /[?&]id=eq\.([0-9a-f-]+)/.exec(path);
      const many = /[?&]id=in\.\(([^)]*)\)/.exec(path);
      if (one) return jsonResponse(200, products.filter((p) => p.id === one[1]));
      if (many) return jsonResponse(200, products.filter((p) => many[1].split(',').includes(p.id)));
      return jsonResponse(200, products);
    }
    if (path.startsWith('sale?') && path.includes('sale_number=eq.')) return jsonResponse(200, storedSale ? [storedSale] : []);
    if (path.startsWith('sale?')) return jsonResponse(200, path.includes('created_at=gte.') ? recentSales : []);
    if (path === 'sale' && method === 'POST') {
      insertedSale = { ...body, id: 'sale-1' };
      return jsonResponse(201, [insertedSale]);
    }
    if (path === 'transaction' && method === 'POST') {
      transactions.push(body);
      return jsonResponse(201);
    }
    if (method === 'GET') return jsonResponse(200, []);
    return jsonResponse(200, {});
  };
  return { calls, fetchImpl, sale: () => insertedSale, transactions };
}

const realFetch = globalThis.fetch;
const { assistantHandler, ventaMostrador, TOOLS } = await import('../api/_lib/assistant.js');
const pos = await import('../api/_lib/posForm.js');
const search = await import('../api/_lib/search.js');
const { sb } = await import('../api/_lib/muse.js');
const directSale = (body) => pos.createSaleFromForm({ body, label: 'prueba', tenantId: TENANT }, { sb, ventaMostrador: (input, actor, query) => ventaMostrador(input, actor, undefined, query) });

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

test('sin token responde 401 JSON en las rutas nuevas', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    for (const [route, method] of [['buscar', 'GET'], ['pos/productos', 'GET'], ['pos/caja', 'GET'], ['pos/venta', 'POST'], ['pos/config', 'GET'], ['pos/qr', 'GET']]) {
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
  assert.deepEqual({ ...r.body.venta, numero: 'x' }, { id: 'sale-1', numero: 'x', total: 44.6, subtotal: 40, ivu: 4.6, cambio: 5.4 });
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
  const fake = fakeSupabase({ requestsTable: 'ok', storedRequest: { venta_numero: 'POS-ABCD1234' }, storedSale: { id: 'sale-9', sale_number: 'POS-ABCD1234', subtotal: 40, tax_amount: 4.6, total: 44.6, change_due: 5.4, payment_method: 'cash' } });
  await withFetch(fake, async () => {
    const r = await call('pos/venta', { method: 'POST', body: { ...saleBody(), id_cliente_solicitud: REQUEST_ID } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body, { ok: true, repetido: true, venta: { id: 'sale-9', numero: 'POS-ABCD1234', total: 44.6, subtotal: 40, ivu: 4.6, cambio: 5.4 } });
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

test('pos/productos: solo accesorios y dispositivos con stock, IVU calculado, variantes y hay_mas', async () => {
  const productos = [
    { id: PID, nombre: 'Cargador', precio: 20, stock: 5, tipo: 'producto', gravable: true, categoria: 'Accesorios', tipo_pos: 'accesorio' },
    { id: PID2, nombre: 'Cable', precio: 10, stock: 0, tipo: 'producto', gravable: true, categoria: null, tipo_pos: 'accesorio' },
    { id: EQUIPO_ID, nombre: 'Samsung A06', precio: 151, stock: null, tipo: 'producto', gravable: true, categoria: null, tipo_pos: 'dispositivo' },
    { id: 'svc', nombre: 'Diagnostico', precio: 30, stock: null, tipo: 'servicio', gravable: false, categoria: 'Servicios', tipo_pos: null },
    { id: PIEZA_ID, nombre: 'Pantalla', precio: 100, stock: 3, tipo: 'producto', gravable: true, categoria: 'Pantallas', tipo_pos: null },
  ];
  const deps = {
    callApi: async (m, p, o) => {
      assert.equal(p, 'pos/productos');
      assert.deepEqual(o.query, { q: 'car', pagina: 2, limite: 30, pos_tipo: 'ambos' });
      return { status: 200, body: { ok: true, productos } };
    },
    sb: async (path) => {
      assert.ok(path.startsWith(`product_variant?product_id=in.(${PID},${EQUIPO_ID})`));
      return [{ product_id: PID }];
    },
    withIvu,
  };
  const r = await pos.posProductList({ q: 'car', pagina: '2', actor: 'x' }, deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.hay_mas, false);
  assert.deepEqual(r.body.productos, [
    { id: PID, nombre: 'Cargador', precio_sin_ivu: 20, precio_con_ivu: 22.3, stock: 5, tipo: 'producto', categoria: 'Accesorios', tipo_pos: 'accesorio', tiene_variantes: true },
    { id: EQUIPO_ID, nombre: 'Samsung A06', precio_sin_ivu: 151, precio_con_ivu: 168.37, stock: null, tipo: 'producto', categoria: null, tipo_pos: 'dispositivo', tiene_variantes: false },
  ]);
  const many = await pos.posProductList({ q: '', actor: 'x' }, { ...deps, callApi: async () => ({ status: 200, body: { ok: true, productos: Array.from({ length: 30 }, (_, i) => ({ id: `p${i}`, nombre: 'x', precio: 1, stock: 1, tipo: 'producto', tipo_pos: i % 2 ? 'accesorio' : null })) } }), sb: async () => [] });
  assert.equal(many.body.hay_mas, true);
  assert.equal(many.body.productos.length, 15);
  const badPage = await pos.posProductList({ pagina: '0' }, deps);
  assert.equal(badPage.status, 400);
});

test('posKind replica las reglas de iOS (isAccessoryItem / isFullDevice)', async () => {
  const { posKind } = await import('../api/_lib/jaime.js');
  const cases = [
    [{ tipo_principal: 'accesorios', subcategoria: 'covers', type: 'product' }, 'accesorio'],
    [{ tipo_principal: 'Accesorios', type: 'service' }, 'accesorio'],
    [{ tipo_principal: 'dispositivos', subcategoria: 'dispositivo_completo', type: 'product' }, 'dispositivo'],
    [{ tipo_principal: 'DISPOSITIVOS', subcategoria: 'Dispositivo_Completo' }, 'dispositivo'],
    [{ tipo_principal: 'dispositivos', subcategoria: 'piezas_servicios', type: 'product' }, null],
    [{ tipo_principal: 'dispositivos', subcategoria: null, type: 'device' }, null],
    [{ tipo_principal: 'servicios', subcategoria: 'servicio', type: 'service' }, null],
    [{ tipo_principal: 'servicios', type: 'accessory' }, null],
    [{ tipo_principal: null, type: 'accessory' }, 'accesorio'],
    [{ tipo_principal: '', type: 'Device' }, 'dispositivo'],
    [{ type: 'product' }, null],
    [{ type: 'service' }, null],
    [{}, null],
  ];
  for (const [row, want] of cases) assert.equal(posKind(row), want, JSON.stringify(row));
});

test('pos/productos de punta a punta: filtro en la consulta segun tipo y sin piezas ni servicios', async () => {
  const want = {
    accesorios: 'and=(or(tipo_principal.ilike.accesorios,and(tipo_principal.is.null,type.ilike.accessory)))',
    dispositivos: 'and=(or(and(tipo_principal.ilike.dispositivos,subcategoria.ilike.dispositivo_completo),and(tipo_principal.is.null,type.ilike.device)))',
    ambos: 'and=(or(tipo_principal.ilike.accesorios,and(tipo_principal.is.null,type.ilike.accessory),and(tipo_principal.ilike.dispositivos,subcategoria.ilike.dispositivo_completo),and(tipo_principal.is.null,type.ilike.device)))',
  };
  const ids = { accesorios: [PID], dispositivos: [EQUIPO_ID, LEGADO_ID], ambos: [PID, EQUIPO_ID, LEGADO_ID] };
  for (const [tipo, filter] of Object.entries(want)) {
    for (const query of tipo === 'ambos' ? [{ tipo }, {}, { tipo: ' AMBOS ' }] : [{ tipo }]) {
      const fake = fakeSupabase();
      let r;
      await withFetch(fake, async () => { r = await call('pos/productos', { query }); });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.deepEqual(r.body.productos.map((p) => p.id).sort(), [...ids[tipo]].sort(), tipo);
      assert.ok(r.body.productos.every((p) => (tipo === 'accesorios' ? p.tipo_pos === 'accesorio' : tipo === 'dispositivos' ? p.tipo_pos === 'dispositivo' : ['accesorio', 'dispositivo'].includes(p.tipo_pos))));
      const list = fake.calls.find((c) => c.url.includes('/product?') && c.url.includes('order=name.asc'));
      const url = decodeURIComponent(list.url);
      assert.ok(url.includes(`&${filter}`), url);
      assert.ok(url.includes('&limit=30&offset=0'));
      assert.ok(url.includes('tipo_principal') && url.includes('subcategoria'));
      assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
    }
  }
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    const bad = await call('pos/productos', { query: { tipo: 'piezas' } });
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'invalid_query');
    assert.match(bad.body.error, /accesorios, dispositivos, ambos/);
  });
  assert.equal(fake.calls.length, 0);
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
    { id: PID, nombre: 'Pantalla', precio_sin_ivu: 100, precio_con_ivu: 111.5, stock: 2, categoria: 'Pantallas', vendible_pos: false },
    { id: PID2, nombre: 'Bateria Apple', precio_sin_ivu: 50, precio_con_ivu: 50, stock: 3, categoria: 'Accesorios', vendible_pos: true, tipo_pos: 'accesorio' },
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

const DEFAULT_METODOS = [
  { id: 'efectivo', etiqueta: 'Efectivo', tipo: 'efectivo', tiene_qr: false, color: '#34C759' },
  { id: 'tarjeta', etiqueta: 'Tarjeta', tipo: 'tarjeta', tiene_qr: false, color: '#007AFF' },
  { id: 'ath_movil', etiqueta: 'ATH Móvil', tipo: 'ath_movil', tiene_qr: false, color: '#ED4A17' },
];
const SHOP = {
  name: '911 Smart Fix',
  admin_phone: '787-555-0000',
  tax_rate: '10.5',
  payment_methods: {
    cash: true,
    card: false,
    ath: true,
    athHidden: true,
    athQR: { imageBase64: '/9j/athqr' },
    custom: [
      { id: 'C-ZELLE', label: 'Zelle', enabled: true, qr: { paymentURL: ' https://zelle.test/pagar ' } },
      { id: 'C-OFF', label: 'Venmo', enabled: false },
      { id: 'C-TR', label: 'Transferencia bancaria', enabled: true },
      { id: 'C-PNG', label: 'ATH Empresarial', enabled: true, qr: { imageBase64: 'iVBORw0K\nGgo=' } },
      { id: 'C-X', label: 'Cupón', enabled: true },
    ],
  },
  pos_recibo: { sale_subject: 'a', order_subject: 'b', send_email: true, send_whatsapp: false, send_print: false },
};

test('pos/config sin configuracion del taller usa los valores del iPad', async () => {
  const fake = fakeSupabase();
  await withFetch(fake, async () => {
    const r = await call('pos/config');
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, {
      ok: true,
      iva_tasa: 0.115,
      metodos: DEFAULT_METODOS,
      canales_recibo: { email: true, whatsapp: true, pdf: true },
      umbral_confirmacion: 500,
      descuento_max_empleado: 20,
      tienda: { nombre: 'Mi taller' },
    });
  });
  const read = fake.calls.find((c) => c.url.includes('/tenant?'));
  assert.ok(decodeURIComponent(read.url).includes(`tenant?id=eq.${TENANT}&select=name,admin_phone,tax_rate:settings->tax_rate,payment_methods:settings->payment_methods,pos_recibo:settings->pos_recibo`));
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('pos/config lee metodos, ATH oculto, personalizados activos en orden, colores, IVU y canales del taller', async () => {
  const fake = fakeSupabase({ tenant: SHOP });
  await withFetch(fake, async () => {
    const r = await call('pos/config');
    assert.equal(r.status, 200);
    assert.equal(r.body.iva_tasa, 0.105);
    assert.deepEqual(r.body.metodos, [
      { id: 'efectivo', etiqueta: 'Efectivo', tipo: 'efectivo', tiene_qr: false, color: '#34C759' },
      { id: 'C-ZELLE', etiqueta: 'Zelle', tipo: 'personalizado', tiene_qr: true, color: '#6E1FD4' },
      { id: 'C-TR', etiqueta: 'Transferencia bancaria', tipo: 'transferencia', tiene_qr: false, color: '#4D73B3' },
      { id: 'C-PNG', etiqueta: 'ATH Empresarial', tipo: 'personalizado', tiene_qr: true, color: '#F56B0F' },
      { id: 'C-X', etiqueta: 'Cupón', tipo: 'personalizado', tiene_qr: false, color: '#D9A61A' },
    ]);
    assert.deepEqual(r.body.canales_recibo, { email: true, whatsapp: false, pdf: false });
    assert.deepEqual(r.body.tienda, { nombre: '911 Smart Fix', telefono: '787-555-0000' });
  });
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('pos/config: valores invalidos caen al valor por defecto como en el iPad', async () => {
  const cases = [
    [{ tax_rate: 80, payment_methods: { cash: false, card: false, ath: false }, pos_recibo: { send_email: false } }, 0.115, DEFAULT_METODOS],
    [{ tax_rate: 'abc', payment_methods: { custom: [{ id: 'A', label: 'Zelle', enabled: true }, { id: 'B', label: 'Venmo' }] } }, 0.115, DEFAULT_METODOS],
    [{ tax_rate: 0, payment_methods: 'x' }, 0, DEFAULT_METODOS],
  ];
  for (const [tenant, iva, metodos] of cases) {
    const fake = fakeSupabase({ tenant });
    await withFetch(fake, async () => {
      const r = await call('pos/config');
      assert.equal(r.body.iva_tasa, iva);
      assert.deepEqual(r.body.metodos, metodos);
      assert.deepEqual(r.body.canales_recibo, { email: true, whatsapp: true, pdf: true });
    });
  }
  const down = fakeSupabase({ tenantFail: true });
  let r;
  await quiet(() => withFetch(down, async () => { r = await call('pos/config'); }));
  assert.equal(r.status, 502);
  assert.equal(r.body.code, 'upstream_error');
});

test('pos/qr: imagen como data URL, URL de pago, 404 sin QR o metodo inactivo y 400 sin metodo', async () => {
  const fake = fakeSupabase({ tenant: SHOP });
  await withFetch(fake, async () => {
    const url = await call('pos/qr', { query: { metodo: 'c-zelle' } });
    assert.deepEqual(url.body, { ok: true, tipo: 'url', url: 'https://zelle.test/pagar', nombre_tienda: '911 Smart Fix' });
    const png = await call('pos/qr', { query: { metodo: 'C-PNG' } });
    assert.deepEqual(png.body, { ok: true, tipo: 'imagen', imagen_url: 'data:image/png;base64,iVBORw0KGgo=', mime: 'image/png', nombre_tienda: '911 Smart Fix' });
    const sinQr = await call('pos/qr', { query: { metodo: 'efectivo' } });
    assert.equal(sinQr.status, 404);
    assert.equal(sinQr.body.code, 'not_found');
    assert.match(sinQr.body.error, /Efectivo no tiene un QR configurado/);
    for (const metodo of ['ath_movil', 'C-OFF', 'nada']) {
      const r = await call('pos/qr', { query: { metodo } });
      assert.equal(r.status, 404, metodo);
      assert.equal(r.body.code, 'not_found');
    }
    const falta = await call('pos/qr');
    assert.equal(falta.status, 400);
    assert.equal(falta.body.code, 'invalid_query');
  });
  const visible = fakeSupabase({ tenant: { ...SHOP, payment_methods: { ...SHOP.payment_methods, athHidden: false } } });
  await withFetch(visible, async () => {
    const r = await call('pos/qr', { query: { metodo: 'ath_movil' } });
    assert.deepEqual(r.body, { ok: true, tipo: 'imagen', imagen_url: 'data:image/jpeg;base64,/9j/athqr', mime: 'image/jpeg', nombre_tienda: '911 Smart Fix' });
  });
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('POST pos/venta usa la tasa de IVU del taller solo si es valida', async () => {
  const fake = fakeSupabase({ tenant: { tax_rate: 7 } });
  let r;
  await withFetch(fake, async () => { r = await call('pos/venta', { method: 'POST', body: saleBody() }); });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual({ ...r.body.venta, numero: 'x' }, { id: 'sale-1', numero: 'x', total: 42.8, subtotal: 40, ivu: 2.8, cambio: 7.2 });
  assert.equal(fake.sale().items[0].tax_rate, 0.07);
  for (const tax_rate of [60, 'abc', null]) {
    const other = fakeSupabase({ tenant: { tax_rate } });
    await withFetch(other, async () => { r = await call('pos/venta', { method: 'POST', body: saleBody() }); });
    assert.equal(r.body.venta.ivu, 4.6, String(tax_rate));
    assert.equal(other.sale().items[0].tax_rate, 0.115);
  }
});

test('la herramienta venta_mostrador del asistente no lee la tasa del taller (IVU 11.5% como antes)', async () => {
  const fake = fakeSupabase({ tenant: { tax_rate: 7 } });
  await withFetch(fake, async () => {
    const r = await ventaMostrador({ items: [{ producto_id: PID, cantidad: 1 }], metodo: 'efectivo', tasa_ivu: 0.07 }, 'Asistente IA - prueba');
    assert.equal(r.body.venta.iva, 2.3);
  });
  assert.equal(fake.calls.filter((c) => c.url.includes('/tenant?')).length, 0);
});

test('POST pos/venta con metodo personalizado lo graba con su etiqueta en minuscula como el iPad', async () => {
  const fake = fakeSupabase({ tenant: SHOP });
  let r;
  await withFetch(fake, async () => {
    r = await call('pos/venta', { method: 'POST', body: { ...saleBody(), metodo: 'c-zelle', monto_recibido: undefined } });
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal('cambio' in r.body.venta, false);
  assert.equal(r.body.venta.ivu, 4.2);
  const sale = fake.sale();
  assert.equal(sale.payment_method, 'zelle');
  assert.equal(sale.amount_received, sale.total);
  assert.equal(sale.change_due, 0);
  assert.deepEqual(fake.transactions.filter((t) => t.type === 'revenue').map((t) => t.payment_method), ['zelle']);
  for (const metodo of ['C-OFF', 'bitcoin']) {
    const other = fakeSupabase({ tenant: SHOP });
    await withFetch(other, async () => {
      const bad = await call('pos/venta', { method: 'POST', body: { ...saleBody(), metodo } });
      assert.equal(bad.status, 400, metodo);
      assert.equal(bad.body.code, 'invalid_body');
      assert.match(bad.body.error, /metodo invalido/);
    });
    assert.equal(other.calls.filter((c) => c.method !== 'GET').length, 0);
  }
});

test('POST pos/venta si no se puede leer el taller: metodo personalizado 502 sin escribir, metodo normal sigue con IVU por defecto', async () => {
  const fake = fakeSupabase({ tenantFail: true });
  let custom;
  let normal;
  await quiet(() => withFetch(fake, async () => {
    custom = await call('pos/venta', { method: 'POST', body: { ...saleBody(), metodo: 'C-ZELLE' } });
  }));
  assert.equal(custom.status, 502);
  assert.equal(custom.body.code, 'upstream_error');
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
  await quiet(() => withFetch(fake, async () => {
    normal = await call('pos/venta', { method: 'POST', body: saleBody() });
  }));
  assert.equal(normal.status, 200, JSON.stringify(normal.body));
  assert.equal(normal.body.venta.ivu, 4.6);
});

const RECENT = [{ id: 'old-1', sale_number: 'POS-OLD00001', total: 44.6, payment_method: 'cash', items: [{ product_name: 'Cargador USB-C', quantity: 2 }] }];
const recentQueries = (fake) => fake.calls.filter((c) => c.url.includes('/sale?') && c.url.includes('created_at=gte.')).length;

test('filtro de 5 minutos: la herramienta venta_mostrador del asistente lo mantiene aunque el input traiga banderas', async () => {
  const fake = fakeSupabase({ recentSales: RECENT });
  let r;
  await withFetch(fake, async () => {
    r = await ventaMostrador({ items: [{ producto_id: PID, cantidad: 2 }], metodo: 'efectivo', monto_recibido: 50, sin_filtro_duplicados: '1' }, 'Asistente IA - prueba');
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.duplicado, true);
  assert.equal(r.body.venta.id, 'old-1');
  assert.equal(fake.sale(), null);
  assert.equal(recentQueries(fake), 1);
  const tool = TOOLS.find((t) => t.name === 'venta_mostrador');
  assert.equal(tool.run({ items: [], metodo: 'efectivo' }).query, undefined);
});

test('filtro de 5 minutos: POST pos/venta con id_cliente_solicitud y tabla disponible lo omite y registra la venta', async () => {
  const fake = fakeSupabase({ recentSales: RECENT, requestsTable: 'ok' });
  let r;
  await withFetch(fake, async () => {
    r = await call('pos/venta', { method: 'POST', body: { ...saleBody(), id_cliente_solicitud: REQUEST_ID } });
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.duplicado, false);
  assert.equal(r.body.venta.id, 'sale-1');
  assert.ok(fake.sale());
  assert.equal(recentQueries(fake), 0);
  assert.equal(fake.calls.filter((c) => c.method === 'POST' && c.url.includes('assistant_pos_requests')).length, 1);
});

test('filtro de 5 minutos: POST pos/venta sin id_cliente_solicitud o sin tabla lo mantiene como hoy', async () => {
  for (const [body, requestsTable] of [[saleBody(), 'ok'], [{ ...saleBody(), id_cliente_solicitud: REQUEST_ID }, 'missing']]) {
    const fake = fakeSupabase({ recentSales: RECENT, requestsTable });
    let r;
    await quiet(() => withFetch(fake, async () => { r = await call('pos/venta', { method: 'POST', body }); }));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.duplicado, true, requestsTable);
    assert.equal(r.body.venta.id, 'old-1');
    assert.equal(fake.sale(), null);
    assert.equal(recentQueries(fake), 1);
  }
});

test('buscar piezas: marca vendible_pos y tipo_pos sin quitar piezas ni servicios', async () => {
  const fake = fakeSupabase();
  let r;
  await withFetch(fake, async () => { r = await call('buscar', { query: { q: 'pantalla', tipos: 'piezas' } }); });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const byId = Object.fromEntries(r.body.piezas.map((p) => [p.id, p]));
  assert.deepEqual(Object.keys(byId).sort(), CATALOG.map((p) => p.id).sort());
  assert.equal(byId[PID].vendible_pos, true);
  assert.equal(byId[PID].tipo_pos, 'accesorio');
  assert.equal(byId[EQUIPO_ID].tipo_pos, 'dispositivo');
  assert.equal(byId[LEGADO_ID].tipo_pos, 'dispositivo');
  for (const id of [PIEZA_ID, SERVICIO_ID]) {
    assert.equal(byId[id].vendible_pos, false);
    assert.equal('tipo_pos' in byId[id], false);
  }
  const reads = fake.calls.filter((c) => c.url.includes('/product?')).map((c) => decodeURIComponent(c.url));
  assert.equal(reads.length, 2);
  assert.ok(reads.every((u) => u.includes('tipo_principal,subcategoria') && !u.includes('and=(')));
  assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
});

test('POST pos/venta rechaza piezas y servicios con 400 invalid_body sin escribir', async () => {
  for (const ids of [[PIEZA_ID], [SERVICIO_ID], [PID, PIEZA_ID]]) {
    const fake = fakeSupabase({ requestsTable: 'ok' });
    let r;
    await withFetch(fake, async () => {
      r = await directSale({ ...saleBody(), monto_recibido: 1000, id_cliente_solicitud: REQUEST_ID, items: ids.map((producto_id) => ({ producto_id, cantidad: 1 })) });
    });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.equal(r.body.ok, false);
    assert.equal(r.body.code, 'invalid_body');
    assert.equal(r.body.error, 'Este articulo es una pieza o servicio y no se vende en el POS; agregalo al boleto.');
    const bad = ids.length - 1;
    assert.deepEqual(r.body.rechazados, [{ indice: bad, producto_id: ids[bad], nombre: CATALOG.find((p) => p.id === ids[bad]).name }]);
    assert.equal(fake.sale(), null);
    assert.equal(fake.calls.filter((c) => c.method !== 'GET').length, 0);
    const check = fake.calls.find((c) => c.url.includes('/product?') && c.url.includes('id=in.'));
    assert.ok(decodeURIComponent(check.url).includes(`tenant_id=eq.${TENANT}&id=in.(${ids.join(',')})`));
  }
});

test('POST pos/venta acepta accesorio, dispositivo completo y legado type device', async () => {
  const fake = fakeSupabase();
  let r;
  await withFetch(fake, async () => {
    r = await directSale({ ...saleBody(), metodo: 'card', monto_recibido: undefined, items: [{ producto_id: PID, cantidad: 1 }, { producto_id: EQUIPO_ID, cantidad: 1 }, { producto_id: LEGADO_ID, cantidad: 1 }] });
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.venta.subtotal, 371);
  assert.deepEqual(fake.sale().items.map((i) => i.product_name), ['Cargador USB-C', 'Samsung A06 5G', 'iPhone 11 usado']);
});

test('POST pos/venta: si no se pueden validar los productos responde 502 sin escribir', async () => {
  const fake = fakeSupabase();
  const fetchImpl = fake.fetchImpl;
  fake.fetchImpl = async (url, opts) => (String(url).includes('/product?') && String(url).includes('id=in.') ? jsonResponse(500, { message: 'caido' }) : fetchImpl(url, opts));
  let r;
  await quiet(() => withFetch(fake, async () => { r = await directSale(saleBody()); }));
  assert.equal(r.status, 502);
  assert.equal(r.body.code, 'upstream_error');
  assert.equal(fake.sale(), null);
});

test('la herramienta venta_mostrador del asistente sigue vendiendo piezas y servicios como antes', async () => {
  for (const item of [PIEZA, SERVICIO]) {
    const fake = fakeSupabase();
    let r;
    await withFetch(fake, async () => {
      r = await ventaMostrador({ items: [{ producto_id: item.id, cantidad: 1 }], metodo: 'tarjeta' }, 'Asistente IA - prueba');
    });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.ok, true);
    assert.equal(fake.sale().items[0].product_name, item.name);
    assert.equal(fake.calls.filter((c) => c.url.includes('id=in.')).length, 0);
  }
});
