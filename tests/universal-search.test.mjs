import test from 'node:test';
import assert from 'node:assert/strict';

const TENANT = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
process.env.SUPABASE_URL = 'https://sb.test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.MUSE_TENANT_ID = TENANT;
process.env.JAIME_TENANT_ID = TENANT;

const search = await import('../api/_lib/search.js');

const C1 = 'c0000000-0000-4000-8000-000000000001';
const C2 = 'c0000000-0000-4000-8000-000000000002';
const order = (id, extra) => ({
  id, tenant_id: TENANT, is_deleted: false, customer_id: null, status: 'in_progress', status_note: null,
  customer_name: null, customer_phone: null, customer_email: null, device_type: 'smartphone', device_brand: null,
  device_model: null, device_family: null, device_color: null, device_serial: null, initial_problem: null,
  cost_estimate: 0, labor_cost: 0, amount_paid: 0, balance_due: 0, created_date: '2026-10-01T10:00:00Z', updated_date: '2026-10-01T10:00:00Z', ...extra,
});
const ORDERS = [
  order('o0000000-0000-4000-8000-000000000417', { order_number: 'WO-417', customer_id: C1, customer_name: 'Juan Pérez', customer_phone: '787-555-1234', customer_email: 'juan.perez@gmail.com', device_brand: 'Apple', device_model: 'iPhone 13', device_family: 'iPhone', device_color: 'Azul', device_serial: '356789101112131', initial_problem: 'Pantalla rota', balance_due: 40, updated_date: '2026-11-03T10:00:00Z' }),
  order('o0000000-0000-4000-8000-000000004170', { order_number: 'WO-4170', customer_name: 'Ana Rivera', customer_phone: '(939) 222-3333', device_brand: 'Samsung', device_model: 'Galaxy A15', device_color: 'Negro', status: 'delivered', updated_date: '2026-11-04T10:00:00Z' }),
  order('o0000000-0000-4000-8000-000000000500', { order_number: 'WO-500', customer_id: C2, customer_name: 'María Peña', customer_phone: '7874441111', device_brand: 'Motorola', device_model: 'G Power', device_color: 'Rojo', initial_problem: 'No carga, batería hinchada', status_note: 'Pieza pedida', updated_date: '2026-11-02T10:00:00Z' }),
  order('o0000000-0000-4000-8000-000000000666', { order_number: 'WO-666', is_deleted: true, customer_name: 'Juan Borrado' }),
  order('o0000000-0000-4000-8000-000000000777', { order_number: 'WO-417', tenant_id: OTHER, customer_name: 'Juan Perez Otro Taller', customer_phone: '787-555-1234' }),
];
const CUSTOMERS = [
  { id: C1, tenant_id: TENANT, name: 'Juan Pérez', phone: '787-555-1234', email: 'juan.perez@gmail.com', created_date: '2026-01-01' },
  { id: C2, tenant_id: TENANT, name: 'María Peña', phone: '7874441111', email: null, created_date: '2026-02-01' },
  { id: 'c0000000-0000-4000-8000-000000000009', tenant_id: OTHER, name: 'Juan Perez', phone: '787-555-1234', email: null, created_date: '2026-01-01' },
];
const product = (id, extra) => ({ id, tenant_id: TENANT, active: true, price: 10, cost: 5, stock: 3, min_stock: 0, type: 'product', taxable: true, sku: null, barcode: null, device_brand: null, device_model_tag: null, category: null, tipo_principal: 'dispositivos', subcategoria: 'piezas_servicios', ...extra });
const PRODUCTS = [
  product('p0000000-0000-4000-8000-000000000001', { name: 'Pantalla iPhone 13', price: 100, device_brand: 'Apple', device_model_tag: 'iPhone 13', category: 'Pantallas', sku: 'PAN-13' }),
  product('p0000000-0000-4000-8000-000000000002', { name: 'Batería Moto G Power', price: 45, device_brand: 'Motorola', category: 'Baterías', barcode: '7501234567890' }),
  product('p0000000-0000-4000-8000-000000000003', { name: 'Funda azul', price: 15, tipo_principal: 'accesorios', subcategoria: 'fundas', category: 'Accesorios' }),
  product('p0000000-0000-4000-8000-000000000004', { name: 'Pantalla vieja', active: false }),
];

function splitTop(s) {
  const out = [];
  let depth = 0;
  let quote = false;
  let cur = '';
  for (const ch of s) {
    if (ch === '"') quote = !quote;
    if (!quote && ch === '(') depth += 1;
    if (!quote && ch === ')') depth -= 1;
    if (!quote && depth === 0 && ch === ',') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function likeRegex(pattern) {
  const body = pattern.replace(/^"|"$/g, '').split('').map((c) => (c === '*' || c === '%' ? '.*' : c === '_' ? '.' : c.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))).join('');
  return new RegExp(`^${body}$`, 'isu');
}

function evalExpr(expr, row) {
  const m = /^(and|or)\((.*)\)$/s.exec(expr);
  if (m) {
    const parts = splitTop(m[2]).map((p) => evalExpr(p, row));
    return m[1] === 'and' ? parts.every(Boolean) : parts.some(Boolean);
  }
  const [field, op, ...rest] = expr.split('.');
  const value = rest.join('.');
  if (op !== 'ilike') throw new Error(`operador no soportado ${op}`);
  return row[field] !== null && row[field] !== undefined && likeRegex(value).test(String(row[field]));
}

function evalParam(key, value, row) {
  if (key === 'and' || key === 'or') return evalExpr(`${key}${value}`, row);
  const [op, ...rest] = value.split('.');
  const arg = rest.join('.');
  if (op === 'eq') return String(row[key]) === arg;
  if (op === 'in') return arg.replace(/^\(|\)$/g, '').split(',').includes(String(row[key]));
  throw new Error(`filtro no soportado ${key}=${value}`);
}

function fakeDb({ fail = null, missing = null } = {}) {
  const calls = [];
  const tables = { order: ORDERS, customer: CUSTOMERS, product: PRODUCTS };
  const sb = async (path) => {
    calls.push(path);
    const [table, qs] = path.split('?');
    if (fail === table) throw Object.assign(new Error('caido'), { status: 503 });
    if (missing && table === 'order' && path.includes(missing)) throw Object.assign(new Error(`column order.${missing} does not exist`), { status: 400 });
    let rows = tables[table];
    if (!rows) throw new Error(`tabla ${table}`);
    let limit = Infinity;
    for (const pair of qs.split('&')) {
      const i = pair.indexOf('=');
      const key = pair.slice(0, i);
      const value = decodeURI(pair.slice(i + 1));
      if (key === 'select' || key === 'order') continue;
      if (key === 'limit') { limit = Number(value); continue; }
      rows = rows.filter((r) => evalParam(key, value, r));
    }
    return rows.slice(0, limit);
  };
  return { sb, calls };
}

const withIvu = (n) => Math.round(Number(n) * 1.115 * 100) / 100;

async function find(q, opts = {}) {
  const db = fakeDb(opts.db);
  const r = await search.universalSearch({ q, tipos: opts.tipos, actor: 'prueba', tenantId: TENANT }, { sb: db.sb, withIvu, callApi: async () => { throw new Error('no debe usar la API interna'); } });
  assert.equal(r.status, 200);
  return { ...r.body, calls: db.calls };
}

const numbers = (r) => r.boletos.map((b) => b.numero);

test('numero de boleto: 417, WO-417, wo417 y wo 417 traen el boleto exacto primero', async () => {
  for (const q of ['417', 'WO-417', 'wo417', 'wo 417', 'Wo-417']) {
    const r = await find(q);
    assert.equal(numbers(r)[0], 'WO-417', q);
    assert.ok(!numbers(r).includes('WO-666'), q);
  }
});

test('nombre y apellido sin acentos, en cualquier orden y en mayusculas', async () => {
  for (const q of ['juan', 'perez', 'Pérez', 'juan perez', 'PEREZ JUAN', '  juan   perez ']) {
    const r = await find(q);
    assert.deepEqual(numbers(r), ['WO-417'], q);
    assert.deepEqual(r.clientes.map((c) => c.id), [C1], q);
  }
  const pena = await find('maria pena');
  assert.deepEqual(numbers(pena), ['WO-500']);
  assert.equal(pena.clientes[0].nombre, 'María');
  assert.equal(pena.clientes[0].apellido, 'Peña');
});

test('telefono con o sin guiones, parentesis o espacios', async () => {
  for (const q of ['7875551234', '787-555-1234', '(787) 555-1234', '787 555 1234', '5551234']) {
    const r = await find(q);
    assert.deepEqual(numbers(r), ['WO-417'], q);
    assert.deepEqual(r.clientes.map((c) => c.id), [C1], q);
  }
  const ana = await find('939-222-3333');
  assert.deepEqual(numbers(ana), ['WO-4170']);
});

test('email, marca, modelo, color, serie o IMEI y problema', async () => {
  assert.deepEqual(numbers(await find('juan.perez@gmail.com')), ['WO-417']);
  assert.deepEqual(numbers(await find('samsung')), ['WO-4170']);
  assert.deepEqual(numbers(await find('galaxy a15')), ['WO-4170']);
  assert.deepEqual(numbers(await find('iphone 13 azul')), ['WO-417']);
  assert.deepEqual(numbers(await find('356789101112131')), ['WO-417']);
  assert.deepEqual(numbers(await find('pantalla rota')), ['WO-417']);
  assert.deepEqual(numbers(await find('bateria')), ['WO-500']);
  assert.deepEqual(numbers(await find('pieza pedida')), ['WO-500']);
});

test('piezas por nombre, marca, categoria, sku o codigo, sin acentos y sin inactivas', async () => {
  const r = await find('pantalla');
  assert.deepEqual(r.piezas.map((p) => p.nombre), ['Pantalla iPhone 13']);
  assert.equal(r.piezas[0].precio_con_ivu, 111.5);
  assert.deepEqual((await find('bateria moto')).piezas.map((p) => p.nombre), ['Batería Moto G Power']);
  assert.deepEqual((await find('PAN-13')).piezas.map((p) => p.nombre), ['Pantalla iPhone 13']);
  assert.deepEqual((await find('7501234567890')).piezas.map((p) => p.nombre), ['Batería Moto G Power']);
  const funda = await find('funda azul');
  assert.equal(funda.piezas[0].vendible_pos, true);
  assert.equal(funda.piezas[0].tipo_pos, 'accesorio');
});

test('cada palabra debe aparecer en algun campo (AND por palabra)', async () => {
  assert.deepEqual(numbers(await find('juan samsung')), []);
  assert.deepEqual(numbers(await find('ana samsung')), ['WO-4170']);
});

test('solo el taller de la sesion y sin la API interna de otro taller', async () => {
  const r = await find('juan perez');
  assert.ok(r.boletos.every((b) => !b.cliente.includes('Otro Taller')));
  assert.equal(r.clientes.length, 1);
  assert.ok(r.calls.every((p) => p.includes(`tenant_id=eq.${TENANT}`)));
});

test('clientes traen boletos y saldo pendiente de boletos abiertos', async () => {
  const r = await find('juan perez', { tipos: 'clientes' });
  assert.deepEqual(r.clientes, [{ id: C1, nombre: 'Juan', apellido: 'Pérez', telefono: '787-555-1234', email: 'juan.perez@gmail.com', boletos: 1, saldo_pendiente: 40 }]);
});

test('boletos con nota y forma de salida estable', async () => {
  const r = await find('motorola');
  assert.equal(r.boletos[0].ultima_nota, 'Pieza pedida');
  assert.deepEqual(Object.keys((await find('samsung')).boletos[0]).sort(), ['actualizado', 'cliente', 'equipo', 'estatus', 'estatus_nombre', 'id', 'numero', 'telefono']);
});

test('una falla de un grupo deja aviso y no borra los otros grupos', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const r = await find('juan', { db: { fail: 'customer' } });
    assert.deepEqual(numbers(r), ['WO-417']);
    assert.deepEqual(r.clientes, []);
    assert.deepEqual(r.avisos, ['No se pudo buscar clientes; intenta de nuevo.']);
  } finally {
    console.warn = warn;
  }
});

test('si falta una columna opcional en order vuelve a buscar con las basicas', async () => {
  const warn = console.warn;
  console.warn = () => {};
  try {
    const r = await find('juan perez', { db: { missing: 'device_family' } });
    assert.deepEqual(numbers(r), ['WO-417']);
    assert.equal('avisos' in r, false);
  } finally {
    console.warn = warn;
  }
});

test('textos con comas, parentesis, comillas o porcentajes no rompen el filtro', async () => {
  for (const q of ['juan, perez', 'perez (juan)', '"juan"', '100% juan', "o'neil", 'juan*']) {
    const r = await find(q);
    assert.ok(Array.isArray(r.boletos), q);
    assert.equal('avisos' in r, false, q);
  }
  assert.deepEqual(numbers(await find('juan, perez')), ['WO-417']);
});

test('menos de 2 caracteres utiles no consulta', async () => {
  for (const q of ['a', '((', '  ', '*']) {
    const r = await find(q);
    assert.deepEqual([r.boletos, r.clientes, r.piezas], [[], [], []], q);
    assert.equal(r.calls.length, 0, q);
  }
});

test('tokenizador: numeros, WO, telefonos y palabras', () => {
  assert.deepEqual(search.searchTokens('WO-417'), [{ kind: 'order', value: '417' }]);
  assert.deepEqual(search.searchTokens('(787) 555-1234'), [{ kind: 'digits', value: '7875551234' }]);
  assert.deepEqual(search.searchTokens('Juan Pérez'), [{ kind: 'text', value: 'juan' }, { kind: 'text', value: 'perez' }]);
  assert.deepEqual(search.accentVariants('pena').includes('peña'), true);
  assert.deepEqual(search.accentVariants('bateria').includes('batería'), true);
});
