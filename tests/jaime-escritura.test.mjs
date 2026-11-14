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
const realLog = console.log;
Date.now = () => NOW;
console.log = () => {};

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

function valueOf(row, key) {
  if (key.includes('->>')) {
    const [col, path] = key.split('->>');
    const obj = row[col];
    return obj && typeof obj === 'object' ? obj[path] : undefined;
  }
  return row[key];
}

function matches(row, key, expr) {
  const value = valueOf(row, key);
  const dot = expr.indexOf('.');
  const op = expr.slice(0, dot);
  const arg = expr.slice(dot + 1);
  if (op === 'is') return arg === 'null' ? value === null || value === undefined : value !== null && value !== undefined;
  if (value === null || value === undefined) return op === 'neq';
  if (op === 'eq') return String(value) === arg;
  if (op === 'neq') return String(value) !== arg;
  if (op === 'in') return arg.slice(1, -1).split(',').includes(String(value));
  if (op === 'like') return new RegExp(`^${arg.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(String(value));
  if (op === 'gt') return compare(value, arg) > 0;
  if (op === 'gte') return compare(value, arg) >= 0;
  if (op === 'lt') return compare(value, arg) < 0;
  if (op === 'lte') return compare(value, arg) <= 0;
  throw new Error(`operador no soportado: ${op}`);
}

function fakeSupabase(tables, { onInsert, onPatch } = {}) {
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(String(url));
    const method = opts.method || 'GET';
    calls.push({ method, url: String(url), body: opts.body ? JSON.parse(opts.body) : undefined });
    if (String(url).indexOf(SB) !== 0) throw new Error(`red real bloqueada: ${url}`);
    const table = u.pathname.replace('/rest/v1/', '');
    tables[table] = tables[table] || [];
    const sp = u.searchParams;
    const filtered = () => {
      let rows = [...tables[table]];
      for (const [key, expr] of sp.entries()) {
        if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
        rows = rows.filter((r) => matches(r, key, expr));
      }
      return rows;
    };
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
    if (method === 'POST') {
      const row = JSON.parse(opts.body);
      if (onInsert) {
        const forced = onInsert(table, row, tables);
        if (forced) return json({ message: forced }, 409);
      }
      if (row.id && tables[table].some((r) => r.id === row.id)) return json({ message: 'duplicate key value violates unique constraint' }, 409);
      if (table === 'time_entry' && !row.clock_out && tables[table].some((r) => r.employee_id === row.employee_id && !r.clock_out)) {
        return json({ message: 'duplicate key value violates unique constraint "time_entry_one_open_per_employee"' }, 409);
      }
      const full = { updated_at: new Date(NOW).toISOString(), ...row };
      tables[table].push(full);
      return json([full], 201);
    }
    if (method === 'PATCH') {
      const rows = filtered();
      if (onPatch) onPatch(table, rows, tables);
      const live = filtered();
      const fields = JSON.parse(opts.body);
      for (const r of live) Object.assign(r, fields);
      return json(live);
    }
    if (method === 'DELETE') throw new Error('borrado bloqueado');
    let rows = filtered();
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
    const select = (sp.get('select') || '*').split(',');
    if (!select.includes('*')) rows = rows.map((r) => Object.fromEntries(select.filter((c) => c in r).map((c) => [c, r[c]])));
    return json(rows);
  };
  return { calls, fetchImpl };
}

function jaime(parts, { body, token = SERVICE, method = 'POST' } = {}) {
  return new Promise((resolve) => {
    const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, query: { jaime: parts }, body, url: `/api/jaime/${parts.join('/')}` };
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
  try {
    const r = await jaime(parts, opts);
    return { ...r, calls: fake.calls };
  } finally {
    globalThis.fetch = realFetch;
  }
}

const writes = (r) => r.calls.filter((c) => c.method !== 'GET');

const EMP1 = '0000aaaa-0000-4000-8000-000000000001';
const EMP2 = '0000aaaa-0000-4000-8000-000000000002';
const EMP3 = '0000aaaa-0000-4000-8000-000000000003';
const AUTH1 = '0000bbbb-0000-4000-8000-000000000001';
const EMPX = '0000cccc-0000-4000-8000-000000000009';

function world(extra = {}) {
  return {
    app_employee: [
      { id: EMP1, tenant_id: TENANT, full_name: 'Maria Lopez', employee_code: 'ML01', active: true, auth_user_id: AUTH1 },
      { id: EMP2, tenant_id: TENANT, full_name: 'Maria Rivera', employee_code: 'MR02', active: true, auth_user_id: null },
      { id: EMP3, tenant_id: TENANT, full_name: 'Pedro Gomez', employee_code: 'PG03', active: false, auth_user_id: null },
      { id: EMPX, tenant_id: OTHER, full_name: 'Ajeno Otro', employee_code: 'AJ09', active: true, auth_user_id: null },
    ],
    time_entry: [],
    cash_register: [],
    transaction: [],
    ...extra,
  };
}

const PONCHE = (o) => ({ id_solicitud: 'sol-entrada-0001', empleado: EMP1, tipo: 'entrada', ...o });

test('autenticacion requerida en ambos endpoints y sin tocar la base', async () => {
  for (const parts of [['ponches'], ['caja', 'cerrar']]) {
    for (const token of ['', 'x'.repeat(40)]) {
      const r = await run(world(), parts, { token, body: PONCHE() });
      assert.equal(r.status, 401);
      assert.equal(r.body.code, 'unauthorized');
      assert.equal(r.calls.length, 0);
    }
  }
});

test('entrada crea el turno marcado como API de Jaime y devuelve el estado del turno', async () => {
  const t = world();
  const r = await run(t, ['ponches'], { body: PONCHE({ nota: 'Llego temprano' }) });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.repetido, false);
  assert.equal(r.body.tipo, 'entrada');
  assert.equal(r.body.ponche.abierto, true);
  assert.equal(r.body.ponche.origen, 'api_jaime');
  assert.equal(r.body.turno.abierto, true);
  assert.equal(r.body.turno.minutos_abierto, 0);
  assert.equal(t.time_entry.length, 1);
  const row = t.time_entry[0];
  assert.equal(row.tenant_id, TENANT);
  assert.equal(row.employee_id, EMP1);
  assert.equal(row.employee_name, 'Maria Lopez');
  assert.equal(row.clock_in, new Date(NOW).toISOString());
  assert.equal(row.clock_out, undefined);
  assert.equal(row.edited_by, 'Jaime (API)');
  assert.match(row.edit_reason, /^API Jaime: Llego temprano \[ent:sol-entrada-0001\]$/);
  assert.equal(writes(r).length, 1);
  assert.equal(writes(r)[0].method, 'POST');
});

test('repetir la misma solicitud de entrada devuelve el mismo registro con repetido:true y no escribe', async () => {
  const t = world();
  const a = await run(t, ['ponches'], { body: PONCHE() });
  const b = await run(t, ['ponches'], { body: PONCHE() });
  assert.equal(b.status, 200);
  assert.equal(b.body.repetido, true);
  assert.equal(b.body.ponche.id, a.body.ponche.id);
  assert.equal(t.time_entry.length, 1);
  assert.equal(writes(b).length, 0);
  const c = await run(t, ['ponches'], { body: PONCHE({ empleado: EMP2 }) });
  assert.equal(c.status, 409);
  assert.equal(c.body.code, 'request_id_reused');
});

test('doble entrada con otra solicitud responde 409 con el turno abierto y no escribe', async () => {
  const t = world();
  await run(t, ['ponches'], { body: PONCHE() });
  const r = await run(t, ['ponches'], { body: PONCHE({ id_solicitud: 'sol-entrada-0002', empleado: 'ML01' }) });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'shift_open');
  assert.equal(r.body.turno_abierto.abierto, true);
  assert.equal(r.body.turno.abierto, true);
  assert.equal(t.time_entry.length, 1);
  assert.equal(writes(r).length, 0);
});

test('un turno abierto con el id de usuario de la app tambien cuenta como turno abierto', async () => {
  const t = world({ time_entry: [{ id: 'e0000000-0000-4000-8000-000000000001', tenant_id: TENANT, employee_id: AUTH1, employee_name: 'Maria Lopez', clock_in: '2026-11-09T14:00:00.000Z', clock_out: null }] });
  const r = await run(t, ['ponches'], { body: PONCHE({ id_solicitud: 'sol-entrada-0003' }) });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'shift_open');
  assert.equal(r.body.turno.minutos_abierto, 120);
});

test('salida cierra el turno, calcula total_hours y conserva la marca de origen', async () => {
  const t = world();
  await run(t, ['ponches'], { body: PONCHE({ fecha_hora: '2026-11-09T08:20:00-04:00' }) });
  const r = await run(t, ['ponches'], { body: { id_solicitud: 'sol-salida-0001', empleado: 'Maria Lopez', tipo: 'salida', fecha_hora: '2026-11-09T11:50:00-04:00', nota: 'Fin de turno' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.repetido, false);
  assert.equal(r.body.ponche.abierto, false);
  assert.equal(r.body.ponche.horas, 3.5);
  assert.equal(r.body.turno.abierto, false);
  const row = t.time_entry[0];
  assert.equal(row.total_hours, 3.5);
  assert.equal(row.clock_out, '2026-11-09T15:50:00.000Z');
  assert.equal(row.edited_by, 'Jaime (API)');
  assert.match(row.edit_reason, /\[ent:sol-entrada-0001\] \| API Jaime: Fin de turno \[sal:sol-salida-0001\]$/);
  const patch = writes(r)[0];
  assert.equal(patch.method, 'PATCH');
  assert.match(patch.url, /clock_out=is\.null/);
});

test('repetir la salida con la misma solicitud devuelve repetido:true sin escribir', async () => {
  const t = world();
  await run(t, ['ponches'], { body: PONCHE({ fecha_hora: '2026-11-09T08:00:00-04:00' }) });
  const body = { id_solicitud: 'sol-salida-0001', empleado: EMP1, tipo: 'salida', fecha_hora: '2026-11-09T10:00:00-04:00' };
  const a = await run(t, ['ponches'], { body });
  const b = await run(t, ['ponches'], { body });
  assert.equal(b.status, 200);
  assert.equal(b.body.repetido, true);
  assert.equal(b.body.ponche.id, a.body.ponche.id);
  assert.equal(b.body.ponche.horas, 2);
  assert.equal(writes(b).length, 0);
});

test('salida sin turno abierto responde 409 y no escribe', async () => {
  const t = world();
  const r = await run(t, ['ponches'], { body: PONCHE({ id_solicitud: 'sol-salida-0009', tipo: 'salida' }) });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'no_open_shift');
  assert.equal(writes(r).length, 0);
});

test('salida anterior a la entrada o de un turno de 24 horas o mas se rechaza', async () => {
  const t = world();
  await run(t, ['ponches'], { body: PONCHE({ fecha_hora: '2026-11-09T09:00:00-04:00' }) });
  const early = await run(t, ['ponches'], { body: PONCHE({ id_solicitud: 'sol-salida-0010', tipo: 'salida', fecha_hora: '2026-11-09T08:00:00-04:00' }) });
  assert.equal(early.status, 400);
  const t2 = world({ time_entry: [{ id: 'e0000000-0000-4000-8000-000000000002', tenant_id: TENANT, employee_id: EMP1, employee_name: 'Maria Lopez', clock_in: '2026-11-08T12:00:00.000Z', clock_out: null }] });
  const long = await run(t2, ['ponches'], { body: PONCHE({ id_solicitud: 'sol-salida-0011', tipo: 'salida' }) });
  assert.equal(long.status, 409);
  assert.equal(long.body.code, 'shift_too_long');
  assert.equal(writes(long).length, 0);
});

test('empleado de otra tienda, inexistente, inactivo y ambiguo', async () => {
  const other = await run(world(), ['ponches'], { body: PONCHE({ empleado: EMPX }) });
  assert.equal(other.status, 403);
  assert.equal(other.body.code, 'employee_other_tenant');
  const byName = await run(world(), ['ponches'], { body: PONCHE({ empleado: 'Ajeno Otro' }) });
  assert.equal(byName.status, 404);
  const none = await run(world(), ['ponches'], { body: PONCHE({ empleado: 'Nadie Existe' }) });
  assert.equal(none.status, 404);
  const inactive = await run(world(), ['ponches'], { body: PONCHE({ empleado: 'PG03' }) });
  assert.equal(inactive.status, 403);
  assert.equal(inactive.body.code, 'employee_inactive');
  const ambiguous = await run(world(), ['ponches'], { body: PONCHE({ empleado: 'Maria' }) });
  assert.equal(ambiguous.status, 400);
  assert.equal(ambiguous.body.code, 'employee_ambiguous');
  assert.equal(ambiguous.body.candidatos.length, 2);
  for (const r of [other, byName, none, inactive, ambiguous]) assert.equal(writes(r).length, 0);
  const okName = await run(world(), ['ponches'], { body: PONCHE({ empleado: 'maria rivera' }) });
  assert.equal(okName.status, 200);
  assert.equal(okName.body.ponche.empleado_id, EMP2);
});

test('fechas invalidas: futuro, mas de 24 horas atras, formato, y los limites se aceptan', async () => {
  const bad = ['manana', '2026-02-31T10:00:00Z', '2026-11-09T16:06:00Z', '2026-11-08T15:59:00Z', 12345];
  for (const fecha_hora of bad) {
    const r = await run(world(), ['ponches'], { body: PONCHE({ fecha_hora }) });
    assert.equal(r.status, 400, String(fecha_hora));
    assert.equal(r.body.code, 'invalid_body');
    assert.equal(writes(r).length, 0);
  }
  const edgeFuture = await run(world(), ['ponches'], { body: PONCHE({ fecha_hora: '2026-11-09T16:05:00Z' }) });
  assert.equal(edgeFuture.status, 200);
  const edgePast = await run(world(), ['ponches'], { body: PONCHE({ fecha_hora: '2026-11-08T16:00:00Z' }) });
  assert.equal(edgePast.status, 200);
});

test('cuerpo invalido: id_solicitud, tipo y empleado obligatorios', async () => {
  for (const body of [{}, PONCHE({ id_solicitud: 'corto' }), PONCHE({ id_solicitud: undefined }), PONCHE({ tipo: 'descanso' }), PONCHE({ empleado: '' }), PONCHE({ nota: 'x'.repeat(201) }), 'no es json']) {
    const r = await run(world(), ['ponches'], { body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.body.ok, false);
    assert.equal(writes(r).length, 0);
  }
});

test('una entrada que se encima con un turno cerrado se rechaza', async () => {
  const t = world({ time_entry: [{ id: 'e0000000-0000-4000-8000-000000000003', tenant_id: TENANT, employee_id: EMP1, employee_name: 'Maria Lopez', clock_in: '2026-11-09T12:00:00.000Z', clock_out: '2026-11-09T15:00:00.000Z', total_hours: 3 }] });
  const r = await run(t, ['ponches'], { body: PONCHE({ fecha_hora: '2026-11-09T14:00:00Z' }) });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'punch_overlap');
  assert.equal(writes(r).length, 0);
});

test('carrera: si la base rechaza el insert por turno unico, responde 409 con el turno abierto', async () => {
  const t = world();
  const r = await run(t, ['ponches'], { body: PONCHE() }, {
    onInsert: (table, row, tables) => {
      tables.time_entry.push({ id: 'e0000000-0000-4000-8000-000000000004', tenant_id: TENANT, employee_id: EMP1, employee_name: 'Maria Lopez', clock_in: '2026-11-09T15:59:00.000Z', clock_out: null });
      return 'duplicate key value violates unique constraint';
    },
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'shift_open');
});

test('si faltan las columnas de auditoria no se registra el ponche', async () => {
  const t = world();
  globalThis.fetch = async (url, opts = {}) => {
    if ((opts.method || 'GET') === 'POST') return new Response(JSON.stringify({ code: '42703', message: 'column "edited_by" of relation "time_entry" does not exist' }), { status: 400 });
    return fakeSupabase(t).fetchImpl(url, opts);
  };
  try {
    const r = await jaime(['ponches'], { body: PONCHE() });
    assert.equal(r.status, 503);
    assert.equal(r.body.code, 'audit_columns_missing');
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(t.time_entry.length, 0);
});

const REG = '0000dddd-0000-4000-8000-000000000001';
const REG2 = '0000dddd-0000-4000-8000-000000000002';
let n = 0;
const tx = (o) => ({ id: `0000eeee-0000-4000-8000-${String(++n).padStart(12, '0')}`, tenant_id: TENANT, is_deleted: false, category: 'repair_payment', payment_method: 'cash', created_at: '2026-11-09T14:00:00.000Z', ...o });

function cajaWorld(extra = {}) {
  return world({
    cash_register: [{ id: REG, tenant_id: TENANT, status: 'open', date: '2026-11-09', created_at: '2026-11-09T12:00:00.000Z', opening_balance: 100, opened_by: 'Francis', closed_by: null, final_count: null }],
    transaction: [
      tx({ type: 'revenue', amount: 200, payment_method: 'cash' }),
      tx({ type: 'revenue', amount: 80, payment_method: 'tarjeta' }),
      tx({ type: 'revenue', amount: 40, payment_method: 'ath_movil' }),
      tx({ type: 'refund', amount: -20, payment_method: 'cash', category: 'refund' }),
      tx({ type: 'expense', amount: 30, payment_method: 'cash', category: 'supplies' }),
      tx({ type: 'expense', amount: 15, payment_method: 'tarjeta', category: 'supplies' }),
      tx({ type: 'revenue', amount: 999, payment_method: 'cash', is_deleted: true }),
      tx({ type: 'revenue', amount: 500, payment_method: 'cash', created_at: '2026-11-09T11:00:00.000Z' }),
      tx({ type: 'revenue', amount: 700, payment_method: 'cash', tenant_id: OTHER }),
    ],
    ...extra,
  });
}

const ESPERADO = 100 + 200 - 20 - 30;
const CIERRE = (o) => ({ id_solicitud: 'cierre-0001-abc', modalidad: 'con_conteo', efectivo_contado: ESPERADO, ...o });

test('cierre con conteo exacto escribe las mismas columnas que los clientes', async () => {
  const t = cajaWorld();
  const r = await run(t, ['caja', 'cerrar'], { body: CIERRE({ denominaciones: { 100: 2, 50: 1, 20: 0, 5: 0 }, observaciones: 'Todo cuadro', cerrado_por: 'Francis' }) });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.repetido, false);
  assert.equal(r.body.correo_pendiente, true);
  const c = r.body.cierre;
  assert.equal(c.efectivo_esperado, ESPERADO);
  assert.equal(c.efectivo_contado, ESPERADO);
  assert.equal(c.diferencia, 0);
  assert.equal(c.resultado, 'exacto');
  assert.equal(c.modalidad, 'con_conteo');
  assert.equal(c.requiere_revision, false);
  const row = t.cash_register[0];
  assert.equal(row.status, 'closed');
  assert.equal(row.closing_balance, ESPERADO);
  assert.equal(row.closed_by, 'Francis (Jaime (API))');
  assert.equal(row.total_revenue, 300);
  assert.equal(row.total_expenses, 45);
  assert.equal(row.net_profit, 255);
  assert.ok(Number.isFinite(Date.parse(row.last_movement_at)));
  const fc = row.final_count;
  assert.equal(fc.counted_total, ESPERADO);
  assert.equal(fc.expected_cash, ESPERADO);
  assert.equal(fc.difference, 0);
  assert.equal(fc.total_cash, 180);
  assert.equal(fc.total_card, 80);
  assert.equal(fc.total_ath, 40);
  assert.equal(fc.total_revenue, 300);
  assert.equal(fc.total_expenses, 45);
  assert.equal(fc.real_profit, 255);
  assert.deepEqual(fc.revenue_by_method, { cash: 180, tarjeta: 80, ath_movil: 40 });
  assert.equal(fc.sale_count, 3);
  assert.equal(fc.observations, 'Todo cuadro');
  assert.equal(fc.mode, 'con_conteo');
  assert.equal(fc.sin_conteo, false);
  assert.equal(fc.request_id, 'cierre-0001-abc');
  assert.equal(fc.denominations['100'], 2);
  assert.equal(Object.keys(fc.denominations).length, 10);
  assert.equal(Date.parse(fc.closed_at), NOW);
  assert.equal(writes(r).length, 1);
  assert.equal(writes(r)[0].method, 'PATCH');
  assert.match(writes(r)[0].url, /status=eq\.open/);
});

test('cierre con conteo faltante y sobrante, con tolerancia de 5 centavos', async () => {
  const short = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ efectivo_contado: ESPERADO - 12.5 }) });
  assert.equal(short.body.cierre.diferencia, -12.5);
  assert.equal(short.body.cierre.resultado, 'faltante');
  assert.equal(short.body.cierre.requiere_revision, true);
  const over = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ efectivo_contado: ESPERADO + 3 }) });
  assert.equal(over.body.cierre.resultado, 'sobrante');
  const edge = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ efectivo_contado: ESPERADO - 0.05 }) });
  assert.equal(edge.body.cierre.resultado, 'exacto');
  const justOver = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ efectivo_contado: ESPERADO - 0.06 }) });
  assert.equal(justOver.body.cierre.resultado, 'faltante');
});

test('denominaciones que no suman el efectivo contado se rechazan sin escribir', async () => {
  const r = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ denominaciones: { 100: 1 } }) });
  assert.equal(r.status, 400);
  assert.equal(writes(r).length, 0);
  const bad = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ denominaciones: { 7: 1 } }) });
  assert.equal(bad.status, 400);
});

test('cierre sin conteo: marca sin_conteo, deja denominaciones vacias y exige observacion y confirmacion', async () => {
  const sinConf = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ modalidad: 'sin_conteo', observaciones: 'Francis confirmo el total' }) });
  assert.equal(sinConf.status, 400);
  assert.equal(sinConf.body.code, 'confirmation_required');
  const falsa = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ modalidad: 'sin_conteo', observaciones: 'Francis confirmo el total', confirmo_cierre_sin_conteo: 'true' }) });
  assert.equal(falsa.status, 400);
  const sinObs = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ modalidad: 'sin_conteo', confirmo_cierre_sin_conteo: true }) });
  assert.equal(sinObs.status, 400);
  const obsCorta = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ modalidad: 'sin_conteo', confirmo_cierre_sin_conteo: true, observaciones: ' ok ' }) });
  assert.equal(obsCorta.status, 400);
  const conDenoms = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ modalidad: 'sin_conteo', confirmo_cierre_sin_conteo: true, observaciones: 'Francis confirmo el total', denominaciones: { 100: 2 } }) });
  assert.equal(conDenoms.status, 400);
  for (const r of [sinConf, falsa, sinObs, obsCorta, conDenoms]) assert.equal(writes(r).length, 0);

  const t = cajaWorld();
  const r = await run(t, ['caja', 'cerrar'], { body: CIERRE({ modalidad: 'sin_conteo', efectivo_contado: ESPERADO - 8, confirmo_cierre_sin_conteo: true, observaciones: 'Francis confirmo el total por telefono' }) });
  assert.equal(r.status, 200);
  assert.equal(r.body.cierre.modalidad, 'sin_conteo');
  assert.equal(r.body.cierre.sin_conteo, true);
  assert.equal(r.body.cierre.diferencia, -8);
  assert.equal(r.body.cierre.requiere_revision, true);
  const fc = t.cash_register[0].final_count;
  assert.equal(fc.sin_conteo, true);
  assert.equal(fc.mode, 'sin_conteo');
  assert.deepEqual(fc.denominations, {});
  assert.equal(fc.sin_conteo_confirmado, true);
  assert.equal(fc.observations, 'SIN CONTEO: Francis confirmo el total por telefono');
  assert.equal(fc.counted_total, ESPERADO - 8);
  assert.equal(t.cash_register[0].closing_balance, ESPERADO - 8);
});

test('la lectura de cierres prefiere final_count.sin_conteo cuando existe', async () => {
  const t = cajaWorld();
  await run(t, ['caja', 'cerrar'], { body: CIERRE({ modalidad: 'sin_conteo', confirmo_cierre_sin_conteo: true, observaciones: 'Francis confirmo el total' }) });
  const t2 = cajaWorld();
  await run(t2, ['caja', 'cerrar'], { body: CIERRE({ id_solicitud: 'cierre-0002-abc', efectivo_contado: 0 }) });
  for (const [world2, esperadoSinConteo] of [[t, true], [t2, false]]) {
    const lect = await new Promise((resolve) => {
      globalThis.fetch = fakeSupabase(world2).fetchImpl;
      const req = { method: 'GET', headers: { authorization: `Bearer ${SERVICE}` }, query: { jaime: ['caja', 'cierres'], desde: '2026-11-09', hasta: '2026-11-09' }, url: '/api/jaime/caja/cierres' };
      const res = { setHeader() {}, status() { return this; }, json(p) { resolve(p); return this; } };
      jaimeHandler(req, res);
    });
    globalThis.fetch = realFetch;
    const c = lect.cierres[0];
    assert.equal(c.sin_conteo_efectivo, esperadoSinConteo);
    assert.equal(c.modalidad_cierre, esperadoSinConteo ? 'sin_conteo' : 'con_conteo');
    if (esperadoSinConteo) {
      assert.equal(c.resultado, 'sin_conteo');
      assert.equal(c.efectivo_contado, ESPERADO);
    } else {
      assert.equal(c.resultado, 'faltante');
      assert.equal(c.efectivo_contado, 0);
    }
  }
});

test('repetir el cierre devuelve el cierre existente con repetido:true y no escribe', async () => {
  const t = cajaWorld();
  const a = await run(t, ['caja', 'cerrar'], { body: CIERRE() });
  const b = await run(t, ['caja', 'cerrar'], { body: CIERRE() });
  assert.equal(b.status, 200);
  assert.equal(b.body.repetido, true);
  assert.equal(b.body.cierre.id, a.body.cierre.id);
  assert.equal(b.body.cierre.cierre, a.body.cierre.cierre);
  assert.equal(b.body.cierre.efectivo_esperado, a.body.cierre.efectivo_esperado);
  assert.equal(writes(b).length, 0);
  const reused = await run(t, ['caja', 'cerrar'], { body: CIERRE({ efectivo_contado: 1 }) });
  assert.equal(reused.status, 409);
  assert.equal(reused.body.code, 'request_id_reused');
});

test('doble cierre con otra solicitud responde 409 sin caja abierta y trae el ultimo cierre', async () => {
  const t = cajaWorld();
  await run(t, ['caja', 'cerrar'], { body: CIERRE() });
  const r = await run(t, ['caja', 'cerrar'], { body: CIERRE({ id_solicitud: 'cierre-0002-abc' }) });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'no_open_register');
  assert.equal(r.body.ultimo_cierre.id, REG);
  assert.equal(writes(r).length, 0);
});

test('sin caja abierta responde 409', async () => {
  const r = await run(world(), ['caja', 'cerrar'], { body: CIERRE() });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'no_open_register');
  assert.equal(r.body.ultimo_cierre, null);
  assert.equal(writes(r).length, 0);
});

test('mas de una caja abierta responde 409 con la lista y caja_id distinta tambien', async () => {
  const two = cajaWorld();
  two.cash_register.push({ id: REG2, tenant_id: TENANT, status: 'open', date: '2026-11-09', created_at: '2026-11-09T13:00:00.000Z', opening_balance: 50, opened_by: 'Maria', final_count: null });
  const r = await run(two, ['caja', 'cerrar'], { body: CIERRE() });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'multiple_open_registers');
  assert.equal(r.body.cajas.length, 2);
  assert.equal(writes(r).length, 0);
  const mismatch = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ caja_id: REG2 }) });
  assert.equal(mismatch.status, 409);
  assert.equal(mismatch.body.code, 'register_mismatch');
  const match = await run(cajaWorld(), ['caja', 'cerrar'], { body: CIERRE({ caja_id: REG }) });
  assert.equal(match.status, 200);
});

test('carrera: la caja se cierra por otra via entre la lectura y el cierre', async () => {
  const t = cajaWorld();
  const r = await run(t, ['caja', 'cerrar'], { body: CIERRE() }, {
    onPatch: (table, rows, tables) => {
      Object.assign(tables.cash_register[0], {
        status: 'closed',
        closed_by: 'Maria',
        final_count: { counted_total: 250, expected_cash: 250, difference: 0, closed_at: '2026-11-09T15:59:00.000Z', total_revenue: 300, total_expenses: 45 },
      });
    },
  });
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'register_already_closed');
  assert.equal(r.body.cierre.cerrada_por, 'Maria');
  assert.equal(t.cash_register[0].closed_by, 'Maria');
});

test('cuerpo invalido del cierre no escribe', async () => {
  const bodies = [
    {},
    CIERRE({ id_solicitud: 'x' }),
    CIERRE({ modalidad: 'rapido' }),
    CIERRE({ efectivo_contado: undefined }),
    CIERRE({ efectivo_contado: '250' }),
    CIERRE({ efectivo_contado: -1 }),
    CIERRE({ efectivo_contado: 10.123 }),
    CIERRE({ caja_id: 'no-uuid' }),
    CIERRE({ observaciones: 'x'.repeat(501) }),
  ];
  for (const body of bodies) {
    const r = await run(cajaWorld(), ['caja', 'cerrar'], { body });
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.equal(r.body.code, 'invalid_body');
    assert.equal(writes(r).length, 0);
  }
});

test('el servidor nunca borra ni reabre: ningun DELETE y el cierre solo pasa de open a closed', async () => {
  const t = cajaWorld();
  const r = await run(t, ['caja', 'cerrar'], { body: CIERRE() });
  assert.ok(r.calls.every((c) => c.method !== 'DELETE'));
  const reopen = await run(t, ['caja', 'cerrar'], { body: CIERRE({ id_solicitud: 'cierre-0009-abc' }) });
  assert.equal(reopen.status, 409);
  assert.equal(t.cash_register[0].status, 'closed');
});

test('al final restaura el reloj', () => {
  Date.now = realNow;
  console.log = realLog;
  assert.ok(true);
});

const PIEZA_ID = '923847b4-5ecc-4124-8a67-5708035a73f4';
const pieza = (extra = {}) => ({ id: PIEZA_ID, tenant_id: TENANT, name: 'Pantalla Galaxy S22', stock: 2, min_stock: 1, cost: 40, price: 90, supplier_name: 'PR Mobile', device_brand: 'Samsung', device_model_tag: 'S22', category: 'screen', image_url: null, type: 'product', active: true, ...extra });

test('foto_url: PATCH guarda el enlace en image_url y lo devuelve como foto_url', async () => {
  const t = world({ product: [pieza()] });
  const r = await run(t, ['piezas', PIEZA_ID], { method: 'PATCH', body: { foto_url: 'https://cdn.prmobile.test/s22.jpg' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.ok, true);
  assert.equal(t.product[0].image_url, 'https://cdn.prmobile.test/s22.jpg');
  assert.equal(r.body.pieza.foto_url, 'https://cdn.prmobile.test/s22.jpg');
});

test('foto_url vacio quita la foto y es una actualizacion valida', async () => {
  const t = world({ product: [pieza({ image_url: 'https://cdn.prmobile.test/s22.jpg' })] });
  const r = await run(t, ['piezas', PIEZA_ID], { method: 'PATCH', body: { foto_url: '' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(t.product[0].image_url, null);
  assert.equal(r.body.pieza.foto_url, null);
});

test('foto_url invalido se rechaza sin escribir: http, espacios, no texto y demasiado largo', async () => {
  for (const bad of ['http://x.test/a.jpg', 'https://x.test/a b.jpg', 'ftp://x.test/a.jpg', 123, 'https://' + 'a'.repeat(2001)]) {
    const t = world({ product: [pieza()] });
    const r = await run(t, ['piezas', PIEZA_ID], { method: 'PATCH', body: { foto_url: bad } });
    assert.equal(r.status, 400, String(bad).slice(0, 30));
    assert.equal(writes(r).length, 0);
    assert.equal(t.product[0].image_url, null);
  }
});

test('foto_url: POST crea la pieza con foto y sin foto no manda image_url', async () => {
  const con = world({ product: [] });
  const r1 = await run(con, ['piezas'], { body: { nombre: 'Bateria iPhone 13', precio: 60, costo: 25, foto_url: 'https://cdn.prmobile.test/b13.jpg' } });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(con.product[0].image_url, 'https://cdn.prmobile.test/b13.jpg');
  assert.equal(r1.body.pieza.foto_url, 'https://cdn.prmobile.test/b13.jpg');
  const sin = world({ product: [] });
  const r2 = await run(sin, ['piezas'], { body: { nombre: 'Bateria iPhone 14', precio: 65 } });
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal('image_url' in sin.product[0], false);
  assert.equal(r2.body.pieza.foto_url, null);
});

test('foto_url: GET /piezas la incluye en cada pieza', async () => {
  const t = world({ product: [pieza({ image_url: 'https://cdn.prmobile.test/s22.jpg', tipo_principal: 'dispositivos', subcategoria: 'piezas_servicios' })] });
  const r = await run(t, ['piezas'], { method: 'GET' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.piezas[0].foto_url, 'https://cdn.prmobile.test/s22.jpg');
});
