import test from 'node:test';
import assert from 'node:assert/strict';

const TENANT = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-2222-4333-8444-555555555555';
const SERVICE = 's'.repeat(40);
process.env.SUPABASE_URL = 'https://sb.test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.MUSE_TENANT_ID = TENANT;
process.env.JAIME_TENANT_ID = TENANT;
process.env.JAIME_API_TOKEN = SERVICE;

const SB = 'https://sb.test.invalid';
const NOW = Date.parse('2026-11-09T16:00:00.000Z');
const realFetch = globalThis.fetch;
const realNow = Date.now;
Date.now = () => NOW;

const { jaimeHandler } = await import('../api/_lib/jaime.js');

function stamp(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) ? Date.parse(v) : null;
}

function compare(a, b) {
  const ta = stamp(a);
  const tb = stamp(b);
  if (ta !== null && tb !== null) return ta - tb;
  if (typeof a === 'number' || (a !== '' && a !== null && !Number.isNaN(Number(a)) && !Number.isNaN(Number(b)))) return Number(a) - Number(b);
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

function matches(row, key, expr) {
  const value = row[key];
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const arg = expr.slice(dot + 1);
  if (op === 'is') return arg === 'null' ? value === null || value === undefined : value !== null && value !== undefined;
  if (value === null || value === undefined) return op === 'neq';
  if (op === 'eq') return String(value) === arg;
  if (op === 'neq') return String(value) !== arg;
  if (op === 'in') return arg.slice(1, -1).split(',').includes(String(value));
  if (op === 'gt') return compare(value, arg) > 0;
  if (op === 'gte') return compare(value, arg) >= 0;
  if (op === 'lt') return compare(value, arg) < 0;
  if (op === 'lte') return compare(value, arg) <= 0;
  throw new Error(`operador no soportado: ${op}`);
}

function fakeSupabase(tables, { missing = {} } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(String(url));
    calls.push({ method: opts.method || 'GET', url: String(url) });
    if (String(url).indexOf(SB) !== 0) throw new Error(`red real bloqueada: ${url}`);
    if ((opts.method || 'GET') !== 'GET') throw new Error(`escritura bloqueada: ${opts.method} ${url}`);
    const table = u.pathname.replace('/rest/v1/', '');
    const sp = u.searchParams;
    const select = (sp.get('select') || '*').split(',');
    for (const col of missing[table] || []) {
      if (select.includes(col)) return new Response(JSON.stringify({ code: '42703', message: `column ${table}.${col} does not exist` }), { status: 400 });
    }
    let rows = [...(tables[table] || [])];
    for (const [key, expr] of sp.entries()) {
      if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
      rows = rows.filter((r) => matches(r, key, expr));
    }
    const order = (sp.get('order') || '').split(',').filter(Boolean).map((o) => o.split('.'));
    rows.sort((a, b) => {
      for (const [col, dir] of order) {
        const c = compare(a[col] ?? '', b[col] ?? '');
        if (c) return dir === 'desc' ? -c : c;
      }
      return 0;
    });
    const offset = Number(sp.get('offset') || 0);
    const limit = sp.has('limit') ? Number(sp.get('limit')) : rows.length;
    rows = rows.slice(offset, offset + limit);
    if (!select.includes('*')) rows = rows.map((r) => Object.fromEntries(select.filter((c) => c in r).map((c) => [c, r[c]])));
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { calls, fetchImpl };
}

function jaime(parts, { query = {}, token = SERVICE, method = 'GET' } = {}) {
  return new Promise((resolve) => {
    const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, query: { jaime: parts, ...query }, url: `/api/jaime/${parts.join('/')}` };
    const res = {
      statusCode: 200,
      setHeader() {},
      status(c) { this.statusCode = c; return this; },
      json(p) { resolve({ status: this.statusCode, body: p }); return this; },
    };
    jaimeHandler(req, res);
  });
}

async function run(tables, parts, opts, fakeOpts) {
  const fake = fakeSupabase(tables, fakeOpts);
  globalThis.fetch = fake.fetchImpl;
  const warn = console.warn;
  console.warn = () => {};
  try {
    const r = await jaime(parts, opts);
    return { ...r, calls: fake.calls };
  } finally {
    globalThis.fetch = realFetch;
    console.warn = warn;
  }
}

let seq = 0;
const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const tx = (o) => ({ id: id(), tenant_id: TENANT, is_deleted: false, category: 'repair_payment', description: null, order_id: null, order_number: null, recorded_by: 'Francis', payment_method: 'cash', ...o });

const RANGE = { desde: '2026-11-08', hasta: '2026-11-09' };
const ENDPOINTS = [
  [['caja', 'cierres'], RANGE],
  [['pagos'], RANGE],
  [['gastos'], RANGE],
  [['piezas'], RANGE],
  [['ponches'], RANGE],
];
const ALL_PATHS = [['caja', 'cierres'], ['caja', 'estado'], ['pagos'], ['gastos'], ['piezas', 'registradas'], ['boletos', 'listos-sin-cobrar'], ['ponches'], ['inventario']];

test('sin llave o con llave incorrecta responde 401 y no toca la base', async () => {
  for (const parts of ALL_PATHS) {
    for (const token of ['', 'x'.repeat(40)]) {
      const r = await run({}, parts, { token, query: RANGE });
      assert.equal(r.status, 401, parts.join('/'));
      assert.equal(r.body.code, 'unauthorized');
      assert.equal(r.calls.length, 0);
    }
  }
});

test('los endpoints de lectura rechazan metodos de escritura', async () => {
  for (const parts of ALL_PATHS.filter((p) => p[0] !== 'ponches')) {
    const r = await run({}, parts, { method: 'POST', query: RANGE });
    assert.equal(r.status, 404, parts.join('/'));
    assert.equal(r.calls.length, 0);
  }
});

test('rango invalido responde 400 invalid_query en cada endpoint con periodo', async () => {
  const bad = [
    { desde: '2026-02-31', hasta: '2026-03-02' },
    { desde: 'ayer', hasta: '2026-11-09' },
    { desde: '2026-11-09', hasta: '2026-11-01' },
    { desde: '2026-01-01', hasta: '2026-11-09' },
    { hasta: '2026-11-09' },
    { desde: '2026-11-01T10:00:00Z', hasta: '2026-11-01T09:00:00Z' },
    { desde: '2026-08-01T00:00:00Z', hasta: '2026-11-09T00:00:00Z' },
  ];
  for (const [parts] of ENDPOINTS) {
    for (const query of bad) {
      const p = parts[0] === 'piezas' ? ['piezas', 'registradas'] : parts;
      const r = await run({}, p, { query });
      assert.equal(r.status, 400, `${p.join('/')} ${JSON.stringify(query)}`);
      assert.equal(r.body.ok, false);
      assert.equal(r.body.code, 'invalid_query');
      assert.equal(r.calls.length, 0);
    }
  }
});

test('el rango maximo de 92 dias se acepta justo en el limite', async () => {
  const over = await run({ transaction: [] }, ['pagos'], { query: { desde: '2026-08-08', hasta: '2026-11-09' } });
  assert.equal(over.status, 400);
  const edge = await run({ transaction: [] }, ['pagos'], { query: { desde: '2026-08-09', hasta: '2026-11-09' } });
  assert.equal(edge.status, 200);
});

test('pagos: periodo, tenant ajeno y anulados excluidos, reembolso negativo, ingreso, totales por metodo y dia', async () => {
  const orderId = id();
  const tables = {
    order: [{ id: orderId, tenant_id: TENANT, order_number: 'WO-501' }],
    transaction: [
      tx({ id: 'p1', type: 'revenue', amount: 100, payment_method: 'cash', order_id: orderId, order_number: 'WO-500', created_at: '2026-11-08T14:00:00.000Z' }),
      tx({ id: 'p2', type: 'revenue', amount: 50.5, payment_method: 'ath_movil', order_id: orderId, created_at: '2026-11-09T01:30:00.000Z' }),
      tx({ id: 'p3', type: 'revenue', amount: 20, payment_method: 'card', description: 'Venta de mostrador · Cable USB', recorded_by: 'Maria', created_at: '2026-11-09T15:00:00.000Z' }),
      tx({ id: 'p4', type: 'refund', amount: 30, category: 'refund', payment_method: 'cash', created_at: '2026-11-09T15:30:00.000Z' }),
      tx({ id: 'p5', type: 'revenue', amount: 999, created_at: '2026-11-09T15:00:00.000Z', is_deleted: true }),
      tx({ id: 'p6', type: 'revenue', amount: 888, tenant_id: OTHER, created_at: '2026-11-09T15:00:00.000Z' }),
      tx({ id: 'p7', type: 'revenue', amount: 777, created_at: '2026-11-07T14:00:00.000Z' }),
      tx({ id: 'p8', type: 'expense', amount: 40, category: 'parts', created_at: '2026-11-09T15:00:00.000Z' }),
      tx({ id: 'p9', type: 'revenue', amount: 10, payment_method: 'transferencia', created_at: '2026-11-10T05:00:00.000Z' }),
    ],
  };
  const r = await run(tables, ['pagos'], { query: RANGE });
  assert.equal(r.status, 200);
  const b = r.body;
  assert.equal(b.ok, true);
  assert.deepEqual(b.pagos.map((p) => p.id), ['p1', 'p2', 'p3', 'p4']);
  assert.equal(b.truncado, false);
  const byId = Object.fromEntries(b.pagos.map((p) => [p.id, p]));
  assert.equal(byId.p1.hora, '2026-11-08T10:00:00-04:00');
  assert.equal(byId.p1.tipo, 'cobro');
  assert.equal(byId.p1.boleto, 'WO-500');
  assert.equal(byId.p2.boleto, 'WO-501');
  assert.equal(byId.p2.dia, '2026-11-08');
  assert.equal(byId.p2.metodo, 'ath_movil');
  assert.equal(byId.p3.tipo, 'ingreso');
  assert.equal(byId.p3.boleto, null);
  assert.equal(byId.p3.concepto, 'Cable USB');
  assert.equal(byId.p3.registrado_por, 'Maria');
  assert.equal(byId.p3.metodo, 'tarjeta');
  assert.equal(byId.p4.tipo, 'reembolso');
  assert.equal(byId.p4.monto, -30);
  assert.deepEqual(b.totales, { cobrado: 170.5, reembolsado: 30, neto: 140.5, cantidad: 4 });
  assert.equal(b.por_metodo.efectivo.neto, 70);
  assert.equal(b.por_metodo.efectivo.reembolsado, 30);
  assert.equal(b.por_metodo.ath_movil.neto, 50.5);
  assert.equal(b.por_metodo.tarjeta.neto, 20);
  assert.equal(b.por_metodo.transferencia.neto, 0);
  assert.deepEqual(b.por_dia.map((d) => [d.dia, d.neto]), [['2026-11-08', 150.5], ['2026-11-09', -10]]);
  assert.deepEqual(b.anulados_excluidos, { cantidad: 1, monto: 999 });
  assert.ok(r.calls.every((c) => c.method === 'GET'));
  assert.ok(r.calls.every((c) => c.url.includes(`tenant_id=eq.${TENANT}`) || c.url.includes('/order?')));
});

test('pagos: sin parametros usa el dia de hoy de Puerto Rico y acepta fechas ISO con hora', async () => {
  const tables = {
    transaction: [
      tx({ id: 'a', type: 'revenue', amount: 5, created_at: '2026-11-09T04:00:00.000Z' }),
      tx({ id: 'b', type: 'revenue', amount: 6, created_at: '2026-11-09T03:59:59.000Z' }),
    ],
  };
  const hoy = await run(tables, ['pagos']);
  assert.deepEqual(hoy.body.pagos.map((p) => p.id), ['a']);
  const iso = await run(tables, ['pagos'], { query: { desde: '2026-11-09T00:00:00-04:00', hasta: '2026-11-09T11:59:59-04:00' } });
  assert.deepEqual(iso.body.pagos.map((p) => p.id), ['a']);
  const plus = await run(tables, ['pagos'], { query: { desde: '2026-11-08T23:00:00 04:00', hasta: '2026-11-09T12:00:00-04:00' } });
  assert.deepEqual(plus.body.pagos.map((p) => p.id), ['b', 'a']);
});

test('pagos: si falta recorded_by devuelve el resto y avisa', async () => {
  const tables = { transaction: [tx({ id: 'a', type: 'revenue', amount: 5, created_at: '2026-11-09T15:00:00.000Z' })] };
  const r = await run(tables, ['pagos'], { query: RANGE }, { missing: { transaction: ['recorded_by'] } });
  assert.equal(r.status, 200);
  assert.equal(r.body.pagos.length, 1);
  assert.equal(r.body.pagos[0].registrado_por, null);
  assert.ok(r.body.avisos.some((a) => /recorded_by/.test(a) && /quien registro/.test(a)));
});

test('pagos: corta en 2000 filas con truncado true y avisa', async () => {
  const many = Array.from({ length: 2001 }, (_, i) => tx({ id: `m${i}`, type: 'revenue', amount: 1, created_at: '2026-11-09T15:00:00.000Z' }));
  const r = await run({ transaction: many }, ['pagos'], { query: RANGE });
  assert.equal(r.status, 200);
  assert.equal(r.body.truncado, true);
  assert.equal(r.body.cantidad, 2000);
  assert.ok(r.body.avisos.some((a) => /2000/.test(a)));
});

test('gastos: totales por categoria y dia, boleto, anulados y tenant ajeno excluidos', async () => {
  const tables = {
    transaction: [
      tx({ id: 'g1', type: 'expense', amount: 80, category: 'parts', description: 'Gasto · Pantallas', order_number: 'WO-7', created_at: '2026-11-08T15:00:00.000Z' }),
      tx({ id: 'g2', type: 'expense', amount: -20, category: 'supplies', payment_method: 'cash', recorded_by: 'Maria', created_at: '2026-11-09T15:00:00.000Z' }),
      tx({ id: 'g3', type: 'expense', amount: 10, category: 'parts', created_at: '2026-11-09T16:00:00.000Z' }),
      tx({ id: 'g4', type: 'expense', amount: 500, category: 'rent', is_deleted: true, created_at: '2026-11-09T16:00:00.000Z' }),
      tx({ id: 'g5', type: 'expense', amount: 700, category: 'rent', tenant_id: OTHER, created_at: '2026-11-09T16:00:00.000Z' }),
      tx({ id: 'g6', type: 'expense', amount: 5, category: null, created_at: '2026-11-09T17:00:00.000Z' }),
      tx({ id: 'r1', type: 'revenue', amount: 5, created_at: '2026-11-09T17:00:00.000Z' }),
    ],
  };
  const r = await run(tables, ['gastos'], { query: RANGE });
  assert.equal(r.status, 200);
  const b = r.body;
  assert.deepEqual(b.gastos.map((g) => g.id), ['g1', 'g2', 'g3', 'g6']);
  assert.equal(b.gastos[0].concepto, 'Pantallas');
  assert.equal(b.gastos[0].boleto, 'WO-7');
  assert.equal(b.gastos[1].monto, 20);
  assert.equal(b.gastos[1].registrado_por, 'Maria');
  assert.deepEqual(b.totales, { total: 115, cantidad: 4 });
  assert.deepEqual(b.por_categoria, [
    { categoria: 'parts', total: 90, cantidad: 2 },
    { categoria: 'supplies', total: 20, cantidad: 1 },
    { categoria: 'sin_categoria', total: 5, cantidad: 1 },
  ]);
  assert.deepEqual(b.por_dia, [{ dia: '2026-11-08', total: 80, cantidad: 1 }, { dia: '2026-11-09', total: 35, cantidad: 3 }]);
  assert.deepEqual(b.anulados_excluidos, { cantidad: 1, monto: 500 });
  assert.ok(b.avisos.some((a) => /sin_categoria/.test(a)));
});

const REG = (o) => ({ tenant_id: TENANT, date: '2026-11-09', final_count: null, closed_by: null, last_movement_at: null, closing_balance: null, ...o });

test('caja/estado: abierta con acumulado por metodo del turno actual', async () => {
  const tables = {
    cash_register: [
      REG({ id: 'old', status: 'closed', created_at: '2026-11-08T12:00:00.000Z', opening_balance: 100, closed_by: 'Maria', last_movement_at: '2026-11-08T22:00:00.000Z', opened_by: 'Maria' }),
      REG({ id: 'cur', status: 'open', created_at: '2026-11-09T12:00:00.000Z', opening_balance: 150, opened_by: 'Francis' }),
      REG({ id: 'x', status: 'open', tenant_id: OTHER, created_at: '2026-11-09T13:00:00.000Z', opening_balance: 1, opened_by: 'Otro' }),
    ],
    transaction: [
      tx({ type: 'revenue', amount: 100, payment_method: 'cash', created_at: '2026-11-09T13:00:00.000Z' }),
      tx({ type: 'revenue', amount: 40, payment_method: 'card', created_at: '2026-11-09T14:00:00.000Z' }),
      tx({ type: 'revenue', amount: 25, payment_method: 'ath_movil', created_at: '2026-11-09T15:00:00.000Z' }),
      tx({ type: 'refund', amount: -10, payment_method: 'cash', created_at: '2026-11-09T15:10:00.000Z' }),
      tx({ type: 'expense', amount: 30, payment_method: 'cash', created_at: '2026-11-09T15:20:00.000Z' }),
      tx({ type: 'revenue', amount: 500, payment_method: 'cash', created_at: '2026-11-09T11:00:00.000Z' }),
      tx({ type: 'revenue', amount: 700, payment_method: 'cash', tenant_id: OTHER, created_at: '2026-11-09T13:00:00.000Z' }),
      tx({ type: 'revenue', amount: 900, payment_method: 'cash', is_deleted: true, created_at: '2026-11-09T13:00:00.000Z' }),
    ],
  };
  const r = await run(tables, ['caja', 'estado']);
  assert.equal(r.status, 200);
  const b = r.body;
  assert.equal(b.caja, 'abierta');
  assert.equal(b.abierta_por, 'Francis');
  assert.equal(b.abierta_desde, '2026-11-09T08:00:00-04:00');
  assert.equal(b.fondo_inicial, 150);
  assert.deepEqual(b.cobrado_por_metodo, { efectivo: 90, tarjeta: 40, ath_movil: 25, transferencia: 0, otro: 0 });
  assert.equal(b.total_cobrado, 155);
  assert.equal(b.gastos_turno, 30);
  assert.equal(b.efectivo_esperado_ahora, 210);
  assert.equal(b.ultimo_cierre.cerrada_por, 'Maria');
});

test('caja/estado: cerrada cuando no hay turno abierto del tenant', async () => {
  const tables = { cash_register: [REG({ id: 'x', status: 'open', tenant_id: OTHER, created_at: '2026-11-09T13:00:00.000Z', opening_balance: 1 })], transaction: [] };
  const r = await run(tables, ['caja', 'estado']);
  assert.equal(r.status, 200);
  assert.equal(r.body.caja, 'cerrada');
  assert.equal(r.body.ultimo_cierre, null);
});

test('caja/cierres: faltante, exacto con tolerancia de 5 centavos, sobrante, sin conteo y abierta', async () => {
  const closed = (idv, day, hours, extra) => REG({
    id: idv, status: 'closed', date: day, created_at: `${day}T12:00:00.000Z`, opening_balance: 100, opened_by: 'Francis', closed_by: 'Maria',
    final_count: { closed_at: `${day}T${hours}:00:00.000Z`, ...extra.final_count }, closing_balance: extra.closing_balance,
  });
  const tables = {
    cash_register: [
      closed('c1', '2026-11-03', '22', { closing_balance: 180, final_count: { denominations: { bills_20: 9 }, counted_total: 180, expected_cash: 190 } }),
      closed('c2', '2026-11-04', '22', { closing_balance: 190.04, final_count: { denominations: { bills_20: 9 }, counted_total: 190.04 } }),
      closed('c3', '2026-11-05', '22', { closing_balance: 200, final_count: { denominations: { bills_20: 10 }, counted_total: 200 } }),
      closed('c4', '2026-11-06', '22', { closing_balance: 0, final_count: { denominations: {}, counted_total: 0 } }),
      REG({ id: 'c5', status: 'open', date: '2026-11-09', created_at: '2026-11-09T12:00:00.000Z', opening_balance: 50, opened_by: 'Francis' }),
      REG({ id: 'c6', status: 'closed', tenant_id: OTHER, date: '2026-11-03', created_at: '2026-11-03T12:00:00.000Z', opening_balance: 1 }),
    ],
    transaction: [3, 4, 5, 6].flatMap((d) => [
      tx({ type: 'revenue', amount: 100, payment_method: 'cash', created_at: `2026-11-0${d}T14:00:00.000Z` }),
      tx({ type: 'revenue', amount: 60, payment_method: 'card', created_at: `2026-11-0${d}T15:00:00.000Z` }),
      tx({ type: 'revenue', amount: 20, payment_method: 'ath_movil', created_at: `2026-11-0${d}T16:00:00.000Z` }),
      tx({ type: 'revenue', amount: 5, payment_method: 'transferencia', created_at: `2026-11-0${d}T16:30:00.000Z` }),
      tx({ type: 'expense', amount: 10, payment_method: 'cash', created_at: `2026-11-0${d}T17:00:00.000Z` }),
      tx({ type: 'revenue', amount: 1000, payment_method: 'cash', tenant_id: OTHER, created_at: `2026-11-0${d}T17:00:00.000Z` }),
      tx({ type: 'revenue', amount: 1000, payment_method: 'cash', is_deleted: true, created_at: `2026-11-0${d}T17:00:00.000Z` }),
      tx({ type: 'revenue', amount: 1000, payment_method: 'cash', created_at: `2026-11-0${d}T23:00:00.000Z` }),
    ]),
  };
  const r = await run(tables, ['caja', 'cierres'], { query: { desde: '2026-11-03', hasta: '2026-11-09' } });
  assert.equal(r.status, 200);
  const b = r.body;
  assert.deepEqual(b.cierres.map((c) => c.id), ['c1', 'c2', 'c3', 'c4', 'c5']);
  const c = Object.fromEntries(b.cierres.map((x) => [x.id, x]));
  assert.equal(c.c1.apertura, '2026-11-03T08:00:00-04:00');
  assert.equal(c.c1.cierre, '2026-11-03T18:00:00-04:00');
  assert.equal(c.c1.abierta_por, 'Francis');
  assert.equal(c.c1.cerrada_por, 'Maria');
  assert.equal(c.c1.fondo_inicial, 100);
  assert.deepEqual(c.c1.cobrado_por_metodo, { efectivo: 100, tarjeta: 60, ath_movil: 20, transferencia: 5, otro: 0 });
  assert.equal(c.c1.total_cobrado, 185);
  assert.equal(c.c1.gastos_turno, 10);
  assert.equal(c.c1.efectivo_esperado, 190);
  assert.equal(c.c1.efectivo_contado, 180);
  assert.equal(c.c1.diferencia, -10);
  assert.equal(c.c1.resultado, 'faltante');
  assert.equal(c.c1.sin_conteo_efectivo, false);
  assert.equal(c.c2.diferencia, 0.04);
  assert.equal(c.c2.resultado, 'exacto');
  assert.equal(c.c3.diferencia, 10);
  assert.equal(c.c3.resultado, 'sobrante');
  assert.equal(c.c4.sin_conteo_efectivo, true);
  assert.equal(c.c4.efectivo_contado, null);
  assert.equal(c.c4.diferencia, null);
  assert.equal(c.c4.resultado, 'sin_conteo');
  assert.equal(c.c5.estado, 'abierta');
  assert.equal(c.c5.cierre, null);
  assert.equal(c.c5.sin_conteo_efectivo, false);
  assert.equal(b.resumen.sin_conteo_efectivo, 1);
  assert.equal(b.resumen.cerradas, 4);
  assert.equal(b.resumen.abiertas, 1);
  assert.equal(b.resumen.faltante_total, 10);
  assert.equal(b.resumen.sobrante_total, 10);
  assert.equal(b.tolerancia_exacto, 0.05);
});

test('caja/cierres: borde exacto de 5 centavos y aviso cuando el esperado guardado difiere', async () => {
  const tables = {
    cash_register: [REG({
      id: 'c1', status: 'closed', date: '2026-11-03', created_at: '2026-11-03T12:00:00.000Z', opening_balance: 100, opened_by: 'F', closed_by: 'M',
      closing_balance: 100.05, final_count: { closed_at: '2026-11-03T22:00:00.000Z', denominations: { coins_005: 1 }, counted_total: 100.05, expected_cash: 140 },
    })],
    transaction: [],
  };
  const r = await run(tables, ['caja', 'cierres'], { query: { desde: '2026-11-03', hasta: '2026-11-03' } });
  assert.equal(r.body.cierres[0].diferencia, 0.05);
  assert.equal(r.body.cierres[0].resultado, 'exacto');
  assert.equal(r.body.cierres[0].esperado_guardado_al_cerrar, 140);
  assert.ok(r.body.avisos.some((a) => /difiere/.test(a)));
});

test('caja/cierres: sin final_count usa closing_balance y avisa', async () => {
  const tables = {
    cash_register: [REG({ id: 'c1', status: 'closed', date: '2026-11-03', created_at: '2026-11-03T12:00:00.000Z', opening_balance: 100, opened_by: 'F', closed_by: 'M', closing_balance: 100 })],
    transaction: [],
  };
  const r = await run(tables, ['caja', 'cierres'], { query: { desde: '2026-11-03', hasta: '2026-11-03' } }, { missing: { cash_register: ['final_count'] } });
  assert.equal(r.status, 200);
  assert.equal(r.body.cierres[0].efectivo_contado, 100);
  assert.equal(r.body.cierres[0].resultado, 'exacto');
  assert.ok(r.body.avisos.some((a) => /final_count/.test(a)));
});

test('piezas: costo y precio por suplidor, orden de compra, tenant ajeno y fuera de periodo excluidos', async () => {
  const oid = id();
  const po1 = id();
  const po2 = id();
  const tables = {
    order: [
      { id: oid, tenant_id: TENANT, order_number: 'WO-10', order_items: [{ id: 'i1', name: 'Pantalla', quantity: 1, price: 150, total: 150, source_part_link_id: 'L1' }] },
    ],
    purchase_order: [
      { id: po1, tenant_id: TENANT, po_number: 'PO-1', supplier_name: 'MobileSentrix', status: 'received', order_date: '2026-11-07', line_items: [] },
      {
        id: po2, tenant_id: TENANT, po_number: 'PO-2', supplier_name: 'PhoneLCDParts', status: 'received', order_date: '2026-11-08',
        line_items: [
          { id: 'pl1', product_name: 'Bateria', quantity: 2, unit_cost: 10, unit_price: 25, received_quantity: 2, linked_work_order_id: oid, linked_work_order_number: 'WO-10' },
          { id: 'pl2', product_name: 'Stock general', quantity: 5, unit_cost: 3 },
        ],
      },
      { id: id(), tenant_id: OTHER, po_number: 'PO-X', supplier_name: 'Ajeno', status: 'received', order_date: '2026-11-08', line_items: [{ id: 'z', quantity: 1, unit_cost: 99, linked_work_order_number: 'WO-1' }] },
    ],
    part_link: [
      { id: 'L1', tenant_id: TENANT, order_id: oid, order_number: 'WO-10', title: 'Pantalla iPhone', store: 'other', url: '', cost: 70, price: 150, status: 'received', purchase_order_id: po1, created_at: '2026-11-08T15:00:00.000Z' },
      { id: 'L2', tenant_id: TENANT, order_id: oid, order_number: 'WO-10', title: 'Flex', store: 'amazon', url: 'https://www.amazon.com/x', cost: 12.5, price: 30, status: 'ordered', purchase_order_id: null, created_at: '2026-11-08T16:00:00.000Z' },
      { id: 'L3', tenant_id: TENANT, order_id: oid, order_number: 'WO-10', title: 'Tapa', store: 'other', url: 'https://mobilesentrix.com/p', cost: null, price: 20, status: 'to_order', purchase_order_id: null, created_at: '2026-11-09T10:00:00.000Z' },
      { id: 'L4', tenant_id: TENANT, order_id: oid, order_number: 'WO-10', title: 'Otra', store: 'other', url: '', cost: null, price: 5, status: 'ordered', purchase_order_id: null, created_at: '2026-11-09T11:00:00.000Z' },
      { id: 'L5', tenant_id: OTHER, order_id: oid, order_number: 'WO-10', title: 'Ajena', store: 'amazon', url: '', cost: 500, price: 600, status: 'received', purchase_order_id: null, created_at: '2026-11-09T11:00:00.000Z' },
      { id: 'L6', tenant_id: TENANT, order_id: oid, order_number: 'WO-10', title: 'Vieja', store: 'amazon', url: '', cost: 400, price: 500, status: 'received', purchase_order_id: null, created_at: '2026-10-01T11:00:00.000Z' },
    ],
  };
  const r = await run(tables, ['piezas'], { query: RANGE });
  assert.equal(r.status, 200);
  const b = r.body;
  const byName = Object.fromEntries(b.piezas.map((p) => [p.pieza, p]));
  assert.deepEqual(Object.keys(byName).sort(), ['Bateria', 'Flex', 'Otra', 'Pantalla iPhone', 'Tapa']);
  assert.equal(byName['Pantalla iPhone'].suplidor, 'MobileSentrix');
  assert.equal(byName['Pantalla iPhone'].costo, 70);
  assert.equal(byName['Pantalla iPhone'].recibida, true);
  assert.equal(byName['Pantalla iPhone'].facturada_en_boleto, true);
  assert.equal(byName['Pantalla iPhone'].precio_facturado, 150);
  assert.equal(byName['Pantalla iPhone'].fecha_registro, '2026-11-08T11:00:00-04:00');
  assert.equal(byName.Flex.suplidor, 'Amazon');
  assert.equal(byName.Flex.recibida, false);
  assert.equal(byName.Flex.instalada, null);
  assert.equal(byName.Tapa.suplidor, 'MobileSentrix');
  assert.equal(byName.Tapa.estado, 'to_order');
  assert.equal(byName.Otra.suplidor, null);
  assert.equal(byName.Bateria.origen, 'orden_de_compra');
  assert.equal(byName.Bateria.costo, 20);
  assert.equal(byName.Bateria.precio, 50);
  assert.equal(byName.Bateria.suplidor, 'PhoneLCDParts');
  assert.equal(byName.Bateria.boleto, 'WO-10');
  assert.equal(b.totales.piezas, 4);
  assert.equal(b.totales.costo, 102.5);
  assert.equal(b.totales.precio, 235);
  assert.equal(b.totales.por_ordenar_sin_contar, 1);
  const sup = Object.fromEntries(b.por_suplidor.map((s) => [s.suplidor, s]));
  assert.deepEqual(sup.MobileSentrix, { suplidor: 'MobileSentrix', piezas: 1, costo: 70, precio: 150 });
  assert.deepEqual(sup.PhoneLCDParts, { suplidor: 'PhoneLCDParts', piezas: 1, costo: 20, precio: 50 });
  assert.deepEqual(sup.Amazon, { suplidor: 'Amazon', piezas: 1, costo: 12.5, precio: 30 });
  assert.deepEqual(sup['Sin suplidor'], { suplidor: 'Sin suplidor', piezas: 1, costo: 0, precio: 5 });
  assert.ok(b.avisos.some((a) => /sin costo|no tienen costo/.test(a)));
  assert.ok(b.avisos.some((a) => /instalada/.test(a)));
  assert.ok(b.avisos.some((a) => /suplidor/.test(a)));
});

test('piezas: sin desde ni hasta GET /piezas sigue siendo el catalogo', async () => {
  const tables = { product: [{ id: id(), tenant_id: TENANT, name: 'Pantalla', stock: 2, min_stock: 1, cost: 40, price: 90, active: true, type: 'product', tipo_principal: 'dispositivos', subcategoria: 'piezas_servicios', supplier_name: null, device_brand: null, device_model_tag: null, category: 'Pantallas', part_type: null }] };
  const r = await run(tables, ['piezas']);
  assert.equal(r.status, 200);
  assert.equal(r.body.piezas[0].nombre, 'Pantalla');
  assert.equal(r.body.piezas[0].costo, 40);
});

test('boletos/listos-sin-cobrar: balance, fecha en que paso a listo, dias esperando y aislamiento', async () => {
  const o = (idv, extra) => ({
    id: idv, tenant_id: TENANT, is_deleted: false, order_number: `WO-${idv}`, customer_name: `Cliente ${idv}`, customer_phone: '787', device_brand: 'Apple', device_model: 'iPhone 13', device_type: 'phone',
    cost_estimate: 200, labor_cost: 0, amount_paid: 50, balance_due: 150, status: 'ready_for_pickup', created_date: '2026-10-01T12:00:00.000Z', updated_date: '2026-11-08T12:00:00.000Z',
    status_history: [], ...extra,
  });
  const tables = {
    order: [
      o('1', { status_history: [{ status: 'ready_for_pickup', timestamp: '2026-10-20T14:00:00.000Z' }, { status: 'in_progress', timestamp: '2026-10-25T14:00:00.000Z' }, { status: 'ready_for_pickup', timestamp: '2026-11-01T14:00:00.000Z' }] }),
      o('2', { balance_due: 80 }),
      o('3', { balance_due: 0 }),
      o('4', { status: 'delivered' }),
      o('5', { tenant_id: OTHER }),
      o('6', { is_deleted: true }),
    ],
  };
  const r = await run(tables, ['boletos', 'listos-sin-cobrar']);
  assert.equal(r.status, 200);
  const b = r.body;
  assert.deepEqual(b.boletos.map((x) => x.numero), ['WO-1', 'WO-2']);
  assert.equal(b.boletos[0].listo_desde, '2026-11-01T10:00:00-04:00');
  assert.equal(b.boletos[0].listo_desde_aproximado, false);
  assert.equal(b.boletos[0].dias_esperando, 8);
  assert.equal(b.boletos[0].balance_pendiente, 150);
  assert.equal(b.boletos[0].total_facturado, 200);
  assert.equal(b.boletos[0].cobrado, 50);
  assert.equal(b.boletos[0].telefono, '787');
  assert.equal(b.boletos[0].equipo, 'Apple iPhone 13');
  assert.equal(b.boletos[1].listo_desde_aproximado, true);
  assert.equal(b.boletos[1].dias_esperando, 1);
  assert.equal(b.balance_total, 230);
  assert.equal(b.truncado, false);
  assert.ok(b.avisos.some((a) => /aproximado/.test(a)));
});

test('ponches: entradas, salidas, horas por dia y empleado, turno abierto y tenant ajeno', async () => {
  const te = (o) => ({ id: id(), tenant_id: TENANT, employee_id: 'e1', employee_name: 'Maria', clock_out: null, total_hours: null, edited_by: null, edit_reason: null, ...o });
  const tables = {
    time_entry: [
      te({ id: 't1', clock_in: '2026-11-08T12:00:00.000Z', clock_out: '2026-11-08T16:00:00.000Z', total_hours: 4 }),
      te({ id: 't2', clock_in: '2026-11-08T17:00:00.000Z', clock_out: '2026-11-08T21:30:00.000Z' }),
      te({ id: 't3', employee_id: 'e2', employee_name: 'Luis', clock_in: '2026-11-09T12:00:00.000Z', clock_out: '2026-11-09T20:00:00.000Z', total_hours: 8, edited_by: 'Francis' }),
      te({ id: 't4', employee_id: 'e2', employee_name: 'Luis', clock_in: '2026-11-09T15:00:00.000Z' }),
      te({ id: 't5', tenant_id: OTHER, clock_in: '2026-11-08T12:00:00.000Z', clock_out: '2026-11-08T20:00:00.000Z', total_hours: 8 }),
      te({ id: 't6', clock_in: '2026-11-01T12:00:00.000Z', clock_out: '2026-11-01T20:00:00.000Z', total_hours: 8 }),
    ],
  };
  const r = await run(tables, ['ponches'], { query: RANGE });
  assert.equal(r.status, 200);
  const b = r.body;
  assert.deepEqual(b.ponches.map((p) => `${p.id}:${p.tipo}`), ['t1:entrada', 't1:salida', 't2:entrada', 't2:salida', 't3:entrada', 't4:entrada', 't3:salida']);
  assert.equal(b.ponches[0].hora, '2026-11-08T08:00:00-04:00');
  assert.equal(b.ponches[0].empleado, 'Maria');
  assert.equal(b.ponches.find((p) => p.id === 't3' && p.tipo === 'salida').editado, true);
  assert.deepEqual(b.horas_por_dia, [
    { empleado: 'Maria', empleado_id: 'e1', dia: '2026-11-08', horas: 8.5, turnos: 2 },
    { empleado: 'Luis', empleado_id: 'e2', dia: '2026-11-09', horas: 8, turnos: 1 },
  ]);
  assert.deepEqual(b.horas_por_empleado, [{ empleado: 'Maria', horas: 8.5, dias: 1 }, { empleado: 'Luis', horas: 8, dias: 1 }]);
  assert.equal(b.turnos_abiertos.length, 1);
  assert.equal(b.turnos_abiertos[0].id, 't4');
  assert.ok(b.avisos.some((a) => /abiertos/.test(a)));
  assert.ok(b.avisos.some((a) => /total_hours/.test(a)));
});

test('inventario: capital parado total y por categoria, existencia baja y avisos de costo', async () => {
  const p = (o) => ({ id: id(), tenant_id: TENANT, active: true, type: 'product', supplier_name: null, category: 'Pantallas', min_stock: 1, price: 100, ...o });
  const tables = {
    product: [
      p({ name: 'Pantalla A', stock: 3, cost: 40 }),
      p({ name: 'Pantalla B', stock: 1, cost: 60, min_stock: 2 }),
      p({ name: 'Cable', stock: 10, cost: 2.5, category: 'Accesorios' }),
      p({ name: 'Sin costo', stock: 4, cost: null, category: 'Accesorios' }),
      p({ name: 'Agotado', stock: 0, cost: 9, min_stock: 0 }),
      p({ name: 'Servicio sin stock', stock: null, cost: 0, type: 'product' }),
      p({ name: 'Inactivo', stock: 9, cost: 9, active: false }),
      p({ name: 'Ajeno', stock: 50, cost: 50, tenant_id: OTHER }),
      p({ name: 'Servicio', stock: 5, cost: 5, type: 'service' }),
    ],
  };
  const r = await run(tables, ['inventario']);
  assert.equal(r.status, 200);
  const b = r.body;
  assert.equal(b.capital_parado, 205);
  assert.equal(b.con_existencia, 4);
  assert.equal(b.unidades_totales, 18);
  assert.deepEqual(b.por_categoria, [
    { categoria: 'Pantallas', productos: 2, unidades: 4, capital: 180 },
    { categoria: 'Accesorios', productos: 2, unidades: 14, capital: 25 },
  ]);
  assert.deepEqual(b.existencia_baja.productos.map((x) => x.nombre).sort(), ['Agotado', 'Pantalla B']);
  assert.equal(b.existencia_baja.cantidad, 2);
  assert.ok(b.avisos.some((a) => /no tienen costo/.test(a)));
  const a = b.productos.find((x) => x.nombre === 'Pantalla A');
  assert.equal(a.capital, 120);
  assert.equal(a.costo, 40);
});

test('inventario: si la tabla no tiene cost devuelve existencia y avisa que no hay capital', async () => {
  const tables = { product: [{ id: id(), tenant_id: TENANT, active: true, type: 'product', name: 'X', stock: 2, min_stock: 1, price: 10, category: 'C' }] };
  const r = await run(tables, ['inventario'], {}, { missing: { product: ['cost'] } });
  assert.equal(r.status, 200);
  assert.equal(r.body.capital_parado, null);
  assert.equal(r.body.productos[0].costo, null);
  assert.equal(r.body.productos[0].existencia, 2);
  assert.ok(r.body.avisos.some((a) => /costo/.test(a) && /capital/.test(a)));
});

test('ninguna consulta de lectura escribe ni sale del tenant configurado', async () => {
  const tables = { transaction: [], cash_register: [], part_link: [], purchase_order: [], order: [], time_entry: [], product: [] };
  for (const parts of ALL_PATHS) {
    const r = await run(tables, parts, { query: RANGE });
    assert.equal(r.status, 200, parts.join('/'));
    assert.equal(r.body.ok, true);
    assert.ok(Array.isArray(r.body.avisos));
    for (const c of r.calls) {
      assert.equal(c.method, 'GET');
      assert.ok(c.url.includes(`tenant_id=eq.${TENANT}`), c.url);
    }
  }
});

test('al final restaura el reloj', () => {
  Date.now = realNow;
  assert.ok(Math.abs(Date.now() - realNow()) < 1000);
});
