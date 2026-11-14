import test from 'node:test';
import assert from 'node:assert/strict';

const TENANT = '11111111-2222-4333-8444-555555555555';
const OTHER_TENANT = '99999999-2222-4333-8444-555555555555';
const SERVICE = 's'.repeat(40);
process.env.SUPABASE_URL = 'https://sb.test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.MUSE_TENANT_ID = TENANT;
process.env.JAIME_TENANT_ID = TENANT;
process.env.ASSISTANT_KEY_SECRET = 'k'.repeat(40);
process.env.JAIME_API_TOKEN = SERVICE;

const SB = 'https://sb.test.invalid';
const PID = 'aaaaaaaa-1111-4ccc-8ddd-eeeeeeeeeeee';
const CUSTOMER = 'cccccccc-1111-4ccc-8ddd-eeeeeeeeeeee';
const FOREIGN_CUSTOMER = 'cccccccc-2222-4ccc-8ddd-eeeeeeeeeeee';
const REQ = 'eeeeeeee-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const REQ2 = 'eeeeeeee-cccc-4ccc-8ddd-eeeeeeeeeeee';
const PRODUCT = { id: PID, name: 'Cargador USB-C', price: 20, cost: 8, stock: 5, min_stock: 1, type: 'product', taxable: true, sku: 'CHG1', barcode: null, device_brand: 'Apple', device_model_tag: null, category: 'Accesorios', active: true, tipo_principal: 'accesorios', subcategoria: 'cables' };

function jsonResponse(status, data) {
  return new Response(data === undefined ? '' : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

function fakeSupabase({ paymentsColumn = true, voidable = null } = {}) {
  const calls = [];
  const sales = [];
  const transactions = [];
  const requests = new Map();
  const stockPatches = [];
  const fetchImpl = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ method, url: u, body });
    if (!u.startsWith(SB)) throw new Error(`red real bloqueada: ${u}`);
    const path = decodeURIComponent(u.slice(`${SB}/rest/v1/`.length));
    if (path.startsWith('assistant_pos_requests')) {
      if (method === 'POST') {
        requests.set(body.request_id, body.venta_numero);
        return jsonResponse(201);
      }
      const id = /request_id=eq\.([0-9a-f-]+)/.exec(path)?.[1];
      return jsonResponse(200, requests.has(id) ? [{ venta_numero: requests.get(id) }] : []);
    }
    if (path.startsWith('tenant?')) return jsonResponse(200, []);
    if (path.startsWith('cash_register?')) return jsonResponse(200, [{ id: 'reg-1', status: 'open' }]);
    if (path.startsWith('customer?')) {
      const id = /[?&]id=eq\.([0-9a-f-]+)/.exec(path)?.[1];
      const tenant = /tenant_id=eq\.([0-9a-f-]+)/.exec(path)?.[1];
      const mine = { [CUSTOMER]: TENANT, [FOREIGN_CUSTOMER]: OTHER_TENANT };
      return jsonResponse(200, mine[id] === tenant ? [{ id }] : []);
    }
    if (path.startsWith('product_variant?')) return jsonResponse(200, []);
    if (path.startsWith('product?') && method === 'PATCH') {
      stockPatches.push(body.stock);
      return jsonResponse(200, [{ ...PRODUCT, stock: body.stock }]);
    }
    if (path.startsWith('product?')) {
      const one = /[?&]id=eq\.([0-9a-f-]+)/.exec(path);
      const many = /[?&]id=in\.\(([^)]*)\)/.exec(path);
      if (one) return jsonResponse(200, [PRODUCT].filter((p) => p.id === one[1]));
      if (many) return jsonResponse(200, [PRODUCT].filter((p) => many[1].split(',').includes(p.id)));
      return jsonResponse(200, [PRODUCT]);
    }
    if (path.startsWith('sale?select=payments')) return paymentsColumn ? jsonResponse(200, []) : jsonResponse(400, { message: 'column sale.payments does not exist' });
    if (path.startsWith('sale?') && method === 'GET' && voidable && path.includes('select=id,sale_number,total,payment_method,items')) {
      if (!paymentsColumn && path.includes('payments')) return jsonResponse(400, { message: 'column sale.payments does not exist' });
      return jsonResponse(200, [voidable]);
    }
    if (path.startsWith('sale?') && path.includes('sale_number=eq.')) {
      const number = /sale_number=eq\.([^&]+)/.exec(path)[1];
      const row = sales.find((x) => x.sale_number === number);
      return jsonResponse(200, row ? [row] : []);
    }
    if (path.startsWith('sale?') && method === 'PATCH') return jsonResponse(200, [{ id: 'sale-1' }]);
    if (path.startsWith('sale?')) return jsonResponse(200, []);
    if (path === 'sale' && method === 'POST') {
      const row = { ...body, id: 'sale-1' };
      sales.push(row);
      return jsonResponse(201, [row]);
    }
    if (path === 'transaction' && method === 'POST') {
      transactions.push(...(Array.isArray(body) ? body : [body]));
      return jsonResponse(201);
    }
    if (method === 'GET') return jsonResponse(200, []);
    return jsonResponse(200, {});
  };
  const money = () => transactions.filter((t) => t.type === 'revenue' || t.type === 'refund');
  return { calls, fetchImpl, sales, transactions: { get all() { return transactions; }, get length() { return money().length; }, map: (f) => money().map(f), reduce: (f, i) => money().reduce(f, i), every: (f) => money().every(f), get 0() { return money()[0]; } }, stockPatches };
}

const realFetch = globalThis.fetch;
const { assistantHandler } = await import('../api/_lib/assistant.js');
const { jaimeHandler } = await import('../api/_lib/jaime.js');

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

function jaime(method, parts, body) {
  return new Promise((resolve) => {
    const req = { method, headers: { authorization: `Bearer ${SERVICE}` }, query: { jaime: parts }, body, url: `/api/jaime/${parts.join('/')}` };
    const res = {
      statusCode: 200,
      setHeader() {},
      status(c) { this.statusCode = c; return this; },
      json(p) { resolve({ status: this.statusCode, body: p }); return this; },
    };
    jaimeHandler(req, res);
  });
}

const realNow = Date.now;
let clock = realNow();

async function withFetch(fake, fn) {
  globalThis.fetch = fake.fetchImpl;
  clock += 61_000;
  Date.now = () => clock;
  try { return await fn(); } finally { globalThis.fetch = realFetch; Date.now = realNow; }
}

const writes = (fake) => fake.calls.filter((c) => c.method !== 'GET' && !c.url.includes('assistant_pos_requests'));
const sell = (extra = {}) => ({ items: [{ producto_id: PID, cantidad: 2 }], origen: 'android', ...extra });
const venta = (fake, body) => withFetch(fake, () => call('pos/venta', { method: 'POST', body }));

test('pago dividido: efectivo y tarjeta suman el total exacto y se registra un ingreso por metodo', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, sell({ pagos: [{ metodo: 'efectivo', monto: 20 }, { metodo: 'tarjeta', monto: 24.6 }], id_cliente_solicitud: REQ }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.venta.total, 44.6);
  assert.equal(r.body.venta.dividido, true);
  assert.equal(r.body.venta.cambio, 0);
  assert.deepEqual(r.body.venta.pagos, [{ metodo: 'cash', monto: 20, recibido: 20, cambio: 0 }, { metodo: 'card', monto: 24.6 }]);
  const sale = fake.sales[0];
  assert.equal(sale.is_split_payment, true);
  assert.equal(sale.payment_method, 'card');
  assert.equal(sale.amount_paid, 44.6);
  assert.equal(sale.amount_received, 44.6);
  assert.equal(sale.change_due, 0);
  assert.deepEqual(sale.payments, r.body.venta.pagos);
  assert.equal(fake.transactions.length, 2);
  assert.deepEqual(fake.transactions.map((t) => [t.type, t.payment_method, t.amount]), [['revenue', 'cash', 20], ['revenue', 'card', 24.6]]);
  assert.ok(fake.transactions.every((t) => t.description === `Venta POS ${r.body.venta.numero} (pago dividido)`));
  assert.equal(fake.stockPatches.length, 1);
  assert.equal(fake.stockPatches[0], 3);
});

test('pago dividido: tres metodos con cambio solo en efectivo', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, sell({ pagos: [{ metodo: 'efectivo', monto: 10, recibido: 20 }, { metodo: 'tarjeta', monto: 20 }, { metodo: 'ath_movil', monto: 14.6 }] }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.venta.cambio, 10);
  assert.equal(r.body.venta.pagos[0].cambio, 10);
  assert.equal(r.body.venta.pagos[1].cambio, undefined);
  const sale = fake.sales[0];
  assert.equal(sale.amount_received, 54.6);
  assert.equal(sale.amount_paid, 44.6);
  assert.equal(sale.change_due, 10);
  assert.equal(sale.payment_method, 'card');
  assert.equal(fake.transactions.length, 3);
  assert.equal(fake.transactions.reduce((s, t) => s + t.amount, 0).toFixed(2), '44.60');
  assert.deepEqual(fake.transactions.map((t) => t.payment_method), ['cash', 'card', 'ath_movil']);
});

test('pago dividido: la suma debe cuadrar al centavo con el total del servidor y no escribe nada', async () => {
  for (const pagos of [
    [{ metodo: 'efectivo', monto: 20 }, { metodo: 'tarjeta', monto: 24.59 }],
    [{ metodo: 'efectivo', monto: 20 }, { metodo: 'tarjeta', monto: 24.61 }],
    [{ metodo: 'efectivo', monto: 44.6 }, { metodo: 'tarjeta', monto: 0.01 }],
  ]) {
    const fake = fakeSupabase();
    const r = await venta(fake, sell({ pagos }));
    assert.equal(r.status, 400, JSON.stringify(pagos));
    assert.equal(r.body.code, 'invalid_body');
    assert.match(r.body.error, /suma de los pagos/);
    assert.equal(writes(fake).length, 0);
  }
});

test('pago dividido: validaciones de monto, recibido, metodo repetido y metodo invalido', async () => {
  const cases = [
    [{ pagos: [{ metodo: 'efectivo', monto: 20.005 }, { metodo: 'tarjeta', monto: 24.595 }] }, /2 decimales/],
    [{ pagos: [{ metodo: 'efectivo', monto: 20, recibido: 10 }, { metodo: 'tarjeta', monto: 24.6 }] }, /menor al monto/],
    [{ pagos: [{ metodo: 'efectivo', monto: 20 }, { metodo: 'tarjeta', monto: 24.6, recibido: 30 }] }, /solo aplica a efectivo/],
    [{ pagos: [{ metodo: 'tarjeta', monto: 20 }, { metodo: 'card', monto: 24.6 }] }, /no puede repetirse/],
    [{ pagos: [{ metodo: 'bitcoin', monto: 20 }, { metodo: 'tarjeta', monto: 24.6 }] }, /metodo/],
    [{ pagos: [{ metodo: 'efectivo', monto: 0 }, { metodo: 'tarjeta', monto: 44.6 }] }, /mayor a cero/],
    [{ pagos: [{ metodo: 'efectivo', monto: '20' }, { metodo: 'tarjeta', monto: 24.6 }] }, /mayor a cero/],
    [{ pagos: [] }, /entre 1 y 6/],
    [{ pagos: 'x' }, /entre 1 y 6/],
    [{ pagos: [{ metodo: 'efectivo', monto: 20 }, { metodo: 'tarjeta', monto: 24.6 }], monto_recibido: 50 }, /monto_recibido/],
  ];
  for (const [extra, pattern] of cases) {
    const fake = fakeSupabase();
    const r = await venta(fake, sell(extra));
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.match(r.body.error, pattern, JSON.stringify(extra));
    assert.equal(writes(fake).length, 0);
  }
});

test('pagos con un solo metodo se guarda como venta normal sin marca de dividida', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, sell({ pagos: [{ metodo: 'efectivo', monto: 44.6, recibido: 50 }] }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.venta.cambio, 5.4);
  const sale = fake.sales[0];
  assert.equal(sale.is_split_payment, false);
  assert.equal('payments' in sale, false);
  assert.equal(sale.payment_method, 'cash');
  assert.equal(sale.amount_received, 50);
  assert.equal(fake.transactions.length, 1);
  assert.equal(fake.transactions[0].description, 'Venta POS');
});

test('pago dividido es idempotente por id_cliente_solicitud: una venta, un descuento de inventario', async () => {
  const fake = fakeSupabase();
  const body = sell({ pagos: [{ metodo: 'efectivo', monto: 20 }, { metodo: 'tarjeta', monto: 24.6 }], id_cliente_solicitud: REQ });
  const first = await venta(fake, body);
  const second = await venta(fake, body);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal(second.body.repetido, true);
  assert.equal(second.body.venta.numero, first.body.venta.numero);
  assert.equal(second.body.venta.total, 44.6);
  assert.equal(second.body.venta.dividido, true);
  assert.equal(second.body.venta.pagos.length, 2);
  assert.equal(fake.sales.length, 1);
  assert.equal(fake.transactions.length, 2);
  assert.equal(fake.stockPatches.length, 1);
  const other = await venta(fake, { ...body, id_cliente_solicitud: REQ2 });
  assert.equal(other.body.repetido, false);
  assert.equal(fake.sales.length, 2);
});

test('articulo manual: sin producto_id, no toca inventario y se guarda con IVU segun gravable', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, {
    origen: 'android',
    metodo: 'tarjeta',
    items: [
      { nombre: '  Instalacion   de\u0007 vidrio <b>', precio: 10, cantidad: 2, gravable: true },
      { nombre: 'Cargador USB-C', precio: 5, cantidad: 1, gravable: false },
    ],
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual({ subtotal: r.body.venta.subtotal, ivu: r.body.venta.ivu, total: r.body.venta.total }, { subtotal: 25, ivu: 2.3, total: 27.3 });
  const items = fake.sales[0].items;
  assert.deepEqual(items.map((i) => i.product_name), ['Instalacion de vidrio b', 'Cargador USB-C']);
  assert.ok(items.every((i) => i.manual === true && i.product_id === undefined));
  assert.deepEqual(items.map((i) => i.tax_rate), [0.115, 0]);
  assert.equal(fake.stockPatches.length, 0);
  assert.equal(fake.calls.filter((c) => c.url.includes('/product?')).length, 0);
  assert.equal(fake.transactions.length, 1);
  assert.equal(fake.transactions[0].amount, 27.3);
});

test('articulo manual: topes de precio y cantidad, nombre obligatorio y gravable booleano', async () => {
  const base = { origen: 'android', metodo: 'tarjeta' };
  const cases = [
    [{ nombre: 'x', precio: 100000.01, cantidad: 1 }, /precio/],
    [{ nombre: 'x', precio: 0, cantidad: 1 }, /precio/],
    [{ nombre: 'x', precio: '5', cantidad: 1 }, /precio/],
    [{ nombre: 'x', precio: 5, cantidad: 101 }, /cantidad/],
    [{ nombre: 'x', precio: 5, cantidad: 0 }, /cantidad/],
    [{ nombre: ' \u0007 ', precio: 5, cantidad: 1 }, /nombre/],
    [{ nombre: 'x', precio: 5, cantidad: 1, gravable: 'si' }, /gravable/],
  ];
  for (const [item, pattern] of cases) {
    const fake = fakeSupabase();
    const r = await venta(fake, { ...base, items: [item] });
    assert.equal(r.status, 400, JSON.stringify(item));
    assert.match(r.body.error, pattern, JSON.stringify(item));
    assert.equal(writes(fake).length, 0);
  }
  const fake = fakeSupabase();
  const long = await venta(fake, { ...base, items: [{ nombre: 'a'.repeat(300), precio: 5, cantidad: 1 }] });
  assert.equal(long.status, 200);
  assert.equal(fake.sales[0].items[0].product_name.length, 120);
});

test('producto de inventario sin IVU por linea: gravable false quita el impuesto y descuenta inventario', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, { origen: 'android', metodo: 'efectivo', monto_recibido: 100, items: [{ producto_id: PID, cantidad: 1, gravable: false }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual({ subtotal: r.body.venta.subtotal, ivu: r.body.venta.ivu, total: r.body.venta.total }, { subtotal: 20, ivu: 0, total: 20 });
  assert.equal(fake.sales[0].items[0].tax_rate, 0);
  assert.deepEqual(fake.stockPatches, [4]);
});

test('producto de inventario: gravable invalido se rechaza y sin gravable conserva el IVU del producto', async () => {
  const bad = fakeSupabase();
  const r1 = await venta(bad, { origen: 'android', metodo: 'efectivo', monto_recibido: 100, items: [{ producto_id: PID, cantidad: 1, gravable: 'no' }] });
  assert.equal(r1.status, 400);
  assert.match(JSON.stringify(r1.body), /gravable/);
  assert.equal(bad.sales.length, 0);
  const ok = fakeSupabase();
  const r2 = await venta(ok, { origen: 'android', metodo: 'efectivo', monto_recibido: 100, items: [{ producto_id: PID, cantidad: 1 }] });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal(r2.body.venta.ivu, 2.3);
});

test('articulo manual mezclado con producto de inventario descuenta solo el producto', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, { origen: 'android', metodo: 'efectivo', monto_recibido: 100, items: [{ producto_id: PID, cantidad: 1 }, { nombre: 'Servicio extra', precio: 10, cantidad: 1, gravable: false }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.venta.total, 32.3);
  assert.deepEqual(fake.stockPatches, [4]);
});

test('customer_id del mismo taller se guarda en la venta', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, sell({ metodo: 'tarjeta', customer_id: CUSTOMER, email_cliente: 'a@b.com', notas: 'Cliente: Ana' }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.venta.customer_id, CUSTOMER);
  assert.equal(fake.sales[0].customer_id, CUSTOMER);
  assert.equal(fake.sales[0].notes, 'Cliente: Ana');
});

test('customer_id de otro taller o invalido se rechaza sin escribir ni descontar inventario', async () => {
  for (const id of [FOREIGN_CUSTOMER, 'cccccccc-9999-4ccc-8ddd-eeeeeeeeeeee']) {
    const fake = fakeSupabase();
    const r = await venta(fake, sell({ metodo: 'tarjeta', customer_id: id }));
    assert.equal(r.status, 400);
    assert.equal(r.body.code, 'invalid_body');
    assert.match(r.body.error, /customer_id/);
    assert.equal(writes(fake).length, 0);
  }
  const fake = fakeSupabase();
  const bad = await venta(fake, sell({ metodo: 'tarjeta', customer_id: 'no-es-uuid' }));
  assert.equal(bad.status, 400);
  assert.equal(writes(fake).length, 0);
  const none = await venta(fake, sell({ metodo: 'tarjeta' }));
  assert.equal(none.status, 200);
  assert.equal(fake.sales[0].customer_id, null);
});

test('descuento de venta en porcentaje se aplica a cada linea con el redondeo del servidor', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, sell({ metodo: 'tarjeta', descuento_venta_pct: 10 }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual({ subtotal: r.body.venta.subtotal, ivu: r.body.venta.ivu, total: r.body.venta.total }, { subtotal: 36, ivu: 4.14, total: 40.14 });
  assert.deepEqual(r.body.venta.descuento_venta, { pct: 10, monto: 4.46 });
  const item = fake.sales[0].items[0];
  assert.equal(item.discount_percent, 10);
  assert.equal(item.discount_amount, 4);
  assert.equal(fake.transactions[0].amount, 40.14);
});

test('descuento de venta se combina con el descuento de la linea como el POS de Android', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, { origen: 'android', metodo: 'tarjeta', items: [{ producto_id: PID, cantidad: 2, descuento_pct: 10 }], descuento_venta_pct: 10 });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const item = fake.sales[0].items[0];
  assert.equal(item.discount_percent, 19);
  assert.equal(item.discount_amount, 7.6);
  assert.equal(r.body.venta.subtotal, 32.4);
  assert.equal(r.body.venta.total, 36.13);
});

test('descuento de venta en monto busca el porcentaje mas cercano sobre el total con IVU', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, sell({ metodo: 'tarjeta', descuento_venta_monto: 4.46 }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.venta.total, 40.14);
  assert.equal(r.body.venta.descuento_venta.monto, 4.46);
  assert.ok(Math.abs(r.body.venta.descuento_venta.pct - 10) < 0.01);
  const fake2 = fakeSupabase();
  const r2 = await venta(fake2, sell({ metodo: 'tarjeta', descuento_venta_monto: 10 }));
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal(r2.body.venta.descuento_venta.monto, 10);
  assert.equal(r2.body.venta.total, 34.6);
});

test('descuento de venta invalido: ambos campos, fuera de rango, mayor al total o total en cero', async () => {
  const cases = [
    [{ descuento_venta_pct: 10, descuento_venta_monto: 5 }, /no los dos/],
    [{ descuento_venta_pct: 101 }, /entre 0 y 100/],
    [{ descuento_venta_pct: -1 }, /entre 0 y 100/],
    [{ descuento_venta_pct: '10' }, /entre 0 y 100/],
    [{ descuento_venta_monto: 44.61 }, /mayor al total/],
    [{ descuento_venta_monto: 5.123 }, /2 decimales/],
    [{ descuento_venta_pct: 100 }, /mayor a cero/],
    [{ descuento_venta_monto: 44.6 }, /mayor a cero/],
  ];
  for (const [extra, pattern] of cases) {
    const fake = fakeSupabase();
    const r = await venta(fake, sell({ metodo: 'tarjeta', ...extra }));
    assert.equal(r.status, 400, JSON.stringify(extra));
    assert.match(r.body.error, pattern, JSON.stringify(extra));
    assert.equal(writes(fake).length, 0);
  }
});

test('pago dividido se valida contra el total ya descontado', async () => {
  const fake = fakeSupabase();
  const bad = await venta(fake, sell({ descuento_venta_pct: 10, pagos: [{ metodo: 'efectivo', monto: 20 }, { metodo: 'tarjeta', monto: 24.6 }] }));
  assert.equal(bad.status, 400);
  assert.equal(writes(fake).length, 0);
  const ok = await venta(fake, sell({ descuento_venta_pct: 10, pagos: [{ metodo: 'efectivo', monto: 20, recibido: 20 }, { metodo: 'tarjeta', monto: 20.14 }] }));
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.venta.total, 40.14);
});

test('contrato anterior intacto: un metodo, monto_recibido, sin campos nuevos en la venta', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, sell({ metodo: 'cash', monto_recibido: 50 }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual({ ...r.body.venta, numero: 'x' }, { id: 'sale-1', numero: 'x', total: 44.6, subtotal: 40, ivu: 4.6, cambio: 5.4 });
  const sale = fake.sales[0];
  assert.equal(sale.is_split_payment, false);
  assert.equal('payments' in sale, false);
  assert.equal(sale.customer_id, null);
  assert.equal(sale.payment_method, 'cash');
  assert.deepEqual(fake.transactions.map((t) => [t.amount, t.payment_method, t.description]), [[44.6, 'cash', 'Venta POS']]);
  const noMethod = await venta(fakeSupabase(), sell({}));
  assert.equal(noMethod.status, 400);
  assert.match(noMethod.body.error, /metodo invalido/);
});

test('pos/config declara las cinco capacidades y pago dividido solo si existe sale.payments', async () => {
  const on = fakeSupabase();
  const a = await withFetch(on, () => call('pos/config'));
  assert.deepEqual(a.body.capacidades, { articulo_manual: true, pago_dividido: true, cliente_en_venta: true, descuento_venta: true, iva_linea: true });
  const off = fakeSupabase({ paymentsColumn: false });
  const warn = console.warn;
  console.warn = () => {};
  let b;
  try { b = await withFetch(off, () => call('pos/config')); } finally { console.warn = warn; }
  assert.deepEqual(b.body.capacidades, { articulo_manual: true, pago_dividido: false, cliente_en_venta: true, descuento_venta: true, iva_linea: true });
});

test('anular una venta dividida registra un reembolso por metodo con su monto', async () => {
  const sale = { id: 'sale-1', sale_number: 'POS-AAAA1111', total: 44.6, payment_method: 'card', items: [], voided: false, is_deleted: false, employee: 'Jaime', is_split_payment: true, payments: [{ metodo: 'cash', monto: 20, recibido: 20, cambio: 0 }, { metodo: 'card', monto: 24.6 }] };
  const fake = fakeSupabase({ voidable: sale });
  const r = await withFetch(fake, () => jaime('POST', ['pos', 'ventas', 'POS-AAAA1111', 'anular'], { motivo: 'Cobro duplicado' }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.anulada.reembolsos, [{ metodo: 'cash', monto: 20 }, { metodo: 'card', monto: 24.6 }]);
  assert.deepEqual(fake.transactions.map((t) => [t.type, t.payment_method, t.amount]), [['refund', 'cash', -20], ['refund', 'card', -24.6]]);
  assert.equal(fake.transactions.reduce((s, t) => s + t.amount, 0).toFixed(2), '-44.60');
});

test('anular una venta de un solo metodo sigue igual y funciona aunque falte la columna payments', async () => {
  const sale = { id: 'sale-2', sale_number: 'POS-BBBB2222', total: 44.6, payment_method: 'cash', items: [], voided: false, is_deleted: false, employee: 'Jaime' };
  const fake = fakeSupabase({ voidable: sale, paymentsColumn: false });
  const r = await withFetch(fake, () => jaime('POST', ['pos', 'ventas', 'POS-BBBB2222', 'anular'], { motivo: 'Error al cobrar' }));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.anulada.reembolsos, undefined);
  assert.deepEqual(fake.transactions.map((t) => [t.payment_method, t.amount, t.description]), [['cash', -44.6, 'Venta POS-BBBB2222 anulada']]);
});

test('dividido, manual, cliente y descuento juntos en una sola venta', async () => {
  const fake = fakeSupabase();
  const r = await venta(fake, {
    origen: 'android',
    id_cliente_solicitud: REQ,
    items: [{ producto_id: PID, cantidad: 1 }, { nombre: 'Mano de obra', precio: 30, cantidad: 1, gravable: false }],
    customer_id: CUSTOMER,
    descuento_venta_pct: 20,
    pagos: [{ metodo: 'efectivo', monto: 20, recibido: 25 }, { metodo: 'ath_movil', monto: 21.84 }],
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.venta.total, 41.84);
  assert.equal(r.body.venta.cambio, 5);
  assert.equal(r.body.venta.descuento_venta.pct, 20);
  const sale = fake.sales[0];
  assert.equal(sale.customer_id, CUSTOMER);
  assert.equal(sale.is_split_payment, true);
  assert.equal(fake.transactions.length, 2);
  assert.deepEqual(fake.stockPatches, [4]);
});
