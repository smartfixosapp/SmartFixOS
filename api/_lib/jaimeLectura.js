import { sb, prDayRange, UUID_RE } from './muse.js';

const PR_OFFSET_MS = -4 * 3600_000;
const DAY_MS = 86_400_000;
const PAGE = 1000;
const MAX_ROWS = 2000;
const MAX_RANGE_DAYS = 92;
const TOLERANCE_CENTS = 5;
const METHODS = ['efectivo', 'tarjeta', 'ath_movil', 'transferencia', 'otro'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/;
const SUPPLIER_HOSTS = [
  ['mobilesentrix', 'MobileSentrix'],
  ['phonelcdparts', 'PhoneLCDParts'],
  ['prmobile', 'PR Mobile'],
  ['amazon.', 'Amazon'],
  ['amzn.', 'Amazon'],
  ['ebay.', 'eBay'],
  ['aliexpress.', 'AliExpress'],
];

class QueryError extends Error {}

function fail(res, status, error, code) {
  return res.status(status).json({ ok: false, error, code: code || 'error' });
}

function cents(n) {
  return Math.round((Number(n) || 0) * 100);
}

function dollars(c) {
  return Math.round(c) / 100;
}

function prIso(v) {
  const ms = typeof v === 'number' ? v : Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  return `${new Date(ms + PR_OFFSET_MS).toISOString().slice(0, 19)}-04:00`;
}

function prDay(v) {
  const ms = typeof v === 'number' ? v : Date.parse(v);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + PR_OFFSET_MS).toISOString().slice(0, 10);
}

function parseBound(raw, isEnd) {
  let s = String(Array.isArray(raw) ? raw[0] : raw).trim();
  if (DATE_RE.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) return null;
    const r = prDayRange(s);
    return { ms: Date.parse(isEnd ? r.to : r.from), dateOnly: true };
  }
  s = s.replace(/(\d)\s(\d{2}:\d{2})$/, '$1+$2');
  if (!ISO_RE.test(s)) return null;
  const ms = Date.parse(/(Z|[+-]\d{2}:\d{2})$/.test(s) ? s : `${s}-04:00`);
  if (Number.isNaN(ms)) return null;
  return { ms: isEnd ? ms + 1 : ms, dateOnly: false };
}

function present(v) {
  return v !== undefined && v !== null && String(Array.isArray(v) ? v[0] : v).trim() !== '';
}

export function parseRange(q) {
  const hasD = present(q.desde);
  const hasH = present(q.hasta);
  let a;
  let b;
  if (!hasD && !hasH) {
    const r = prDayRange();
    a = { ms: Date.parse(r.from) };
    b = { ms: Date.parse(r.to), dateOnly: true };
  } else {
    if (!hasD) throw new QueryError('desde es requerido cuando se envia hasta');
    a = parseBound(q.desde, false);
    if (!a) throw new QueryError('desde debe ser YYYY-MM-DD o fecha ISO valida');
    if (hasH) {
      b = parseBound(q.hasta, true);
      if (!b) throw new QueryError('hasta debe ser YYYY-MM-DD o fecha ISO valida');
    } else {
      b = { ms: Date.parse(prDayRange().to), dateOnly: true };
    }
  }
  if (b.ms <= a.ms) throw new QueryError('desde no puede ser posterior a hasta');
  if (b.ms - a.ms > MAX_RANGE_DAYS * DAY_MS + (b.dateOnly ? DAY_MS : 0)) throw new QueryError(`El rango maximo es de ${MAX_RANGE_DAYS} dias`);
  return {
    fromMs: a.ms,
    toMs: b.ms,
    from: new Date(a.ms).toISOString(),
    to: new Date(b.ms).toISOString(),
    periodo: { desde: prIso(a.ms), hasta_exclusivo: prIso(b.ms), zona_horaria: 'America/Puerto_Rico' },
  };
}

function missingColumn(e) {
  return e && e.status === 400 && /column|42703|does not exist/i.test(String(e.message || ''));
}

function missingDetail(message) {
  const m = /column\s+([\w.]+)\s+does not exist/i.exec(String(message || ''));
  return m ? `la base no tiene la columna ${m[1]}` : 'faltan columnas opcionales en la base';
}

async function fetchAll(url, max) {
  const rows = [];
  for (let offset = 0; offset < max; offset += PAGE) {
    const size = Math.min(PAGE, max - offset);
    const part = (await sb(`${url}&limit=${size}&offset=${offset}`)) || [];
    rows.push(...part);
    if (part.length < size) return { rows, truncated: false };
  }
  const probe = (await sb(`${url}&limit=1&offset=${max}`)) || [];
  return { rows, truncated: probe.length > 0 };
}

async function fetchRows(path, selects, max = MAX_ROWS) {
  try {
    return { ...(await fetchAll(`${path}&select=${selects[0]}`, max)), basic: false, detail: null };
  } catch (e) {
    if (!missingColumn(e)) throw e;
    console.warn('lectura de jaime con columnas basicas:', e.message);
    return { ...(await fetchAll(`${path}&select=${selects[1]}`, max)), basic: true, detail: missingDetail(e.message) };
  }
}

async function chunked(ids, size, run) {
  const uniq = [...new Set(ids.filter((id) => typeof id === 'string' && UUID_RE.test(id)))];
  const out = [];
  for (let i = 0; i < uniq.length; i += size) out.push(...((await run(uniq.slice(i, i + size))) || []));
  return out;
}

async function orderNumbers(tenantId, ids) {
  const rows = await chunked(ids, 100, (chunk) => sb(`order?tenant_id=eq.${tenantId}&id=in.(${chunk.join(',')})&select=id,order_number&limit=${chunk.length}`));
  return new Map(rows.map((r) => [r.id, r.order_number]));
}

function methodKey(raw) {
  const k = String(raw ?? 'cash').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (k === 'cash' || k === 'efectivo' || k === '') return 'efectivo';
  if (['ath_movil', 'ath', 'movil', 'athmovil'].includes(k)) return 'ath_movil';
  if (k.startsWith('transfer')) return 'transferencia';
  if (['card', 'tarjeta', 'credit', 'debit', 'credito', 'debito', 'visa', 'mastercard', 'amex'].includes(k) || k.includes('tarjeta')) return 'tarjeta';
  return 'otro';
}

function emptyMethods() {
  return Object.fromEntries(METHODS.map((m) => [m, 0]));
}

function stripPrefix(text, prefix) {
  const t = String(text || '').trim();
  const re = new RegExp(`^${prefix}\\s*[·-]\\s*`, 'i');
  return t.replace(re, '').trim() || null;
}

function bucketBy(rows, keyOf, init, add) {
  const map = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (!map.has(k)) map.set(k, init());
    add(map.get(k), r);
  }
  return map;
}

async function deletedCount(tenantId, extra, from, to) {
  const { rows, truncated } = await fetchAll(
    `transaction?tenant_id=eq.${tenantId}&is_deleted=eq.true${extra}&created_at=gte.${from}&created_at=lt.${to}&order=created_at.asc,id.asc&select=id,amount`,
    MAX_ROWS
  );
  return { cantidad: rows.length, monto: dollars(rows.reduce((s, r) => s + Math.abs(cents(r.amount)), 0)), ...(truncated ? { truncado: true } : {}) };
}

const TX_FULL = 'id,type,category,amount,payment_method,description,order_id,order_number,recorded_by,created_at';
const TX_BASIC = 'id,type,category,amount,payment_method,description,order_id,created_at';

async function pagos(req, res, tenantId) {
  const r = parseRange(req.query || {});
  const base = `transaction?tenant_id=eq.${tenantId}&is_deleted=eq.false&type=in.(revenue,refund)&created_at=gte.${r.from}&created_at=lt.${r.to}&order=created_at.asc,id.asc`;
  const [got, anulados] = await Promise.all([fetchRows(base, [TX_FULL, TX_BASIC]), deletedCount(tenantId, '&type=in.(revenue,refund)', r.from, r.to)]);
  const avisos = [];
  if (got.basic) avisos.push(`No se pudo leer quien registro cada cobro ni el numero de boleto guardado: ${got.detail}.`);
  const numbers = await orderNumbers(tenantId, got.rows.filter((t) => t.order_id && !t.order_number).map((t) => t.order_id));
  const pagosOut = got.rows.map((t) => {
    const refund = t.type === 'refund';
    const abs = Math.abs(cents(t.amount));
    const boleto = t.order_number || numbers.get(t.order_id) || null;
    const tipo = refund ? 'reembolso' : boleto || t.order_id ? 'cobro' : 'ingreso';
    return {
      id: t.id,
      hora: prIso(t.created_at),
      dia: prDay(t.created_at),
      tipo,
      monto: dollars(refund ? -abs : cents(t.amount)),
      metodo: methodKey(t.payment_method),
      metodo_original: t.payment_method || null,
      boleto,
      concepto: tipo === 'ingreso' ? stripPrefix(t.description, 'Venta de mostrador') : null,
      descripcion: t.description || null,
      categoria: t.category || null,
      registrado_por: t.recorded_by || null,
    };
  });
  const sinQuien = pagosOut.filter((p) => !p.registrado_por).length;
  if (!got.basic && sinQuien) avisos.push(`${sinQuien} movimientos no tienen quien los registro.`);
  const sinBoleto = got.rows.filter((t) => t.order_id && !t.order_number && !numbers.get(t.order_id)).length;
  if (sinBoleto) avisos.push(`${sinBoleto} cobros apuntan a un boleto que no se pudo encontrar.`);
  if (got.truncated) avisos.push(`El periodo tiene mas de ${MAX_ROWS} movimientos; los totales cubren solo los ${MAX_ROWS} primeros. Pide un rango menor.`);
  const sum = (list) => {
    let cob = 0;
    let ref = 0;
    for (const p of list) {
      if (p.tipo === 'reembolso') ref += -cents(p.monto);
      else cob += cents(p.monto);
    }
    return { cobrado: dollars(cob), reembolsado: dollars(ref), neto: dollars(cob - ref), cantidad: list.length };
  };
  const porMetodo = {};
  for (const m of METHODS) porMetodo[m] = sum(pagosOut.filter((p) => p.metodo === m));
  const dias = bucketBy(pagosOut, (p) => p.dia, () => [], (a, p) => a.push(p));
  const porDia = [...dias.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([dia, list]) => {
    const metodos = {};
    for (const m of METHODS) {
      const sub = list.filter((p) => p.metodo === m);
      if (sub.length) metodos[m] = sum(sub).neto;
    }
    return { dia, ...sum(list), por_metodo: metodos };
  });
  return {
    ok: true,
    periodo: r.periodo,
    cantidad: pagosOut.length,
    truncado: got.truncated,
    pagos: pagosOut,
    totales: sum(pagosOut),
    por_metodo: porMetodo,
    por_dia: porDia,
    anulados_excluidos: anulados,
    avisos,
  };
}

async function gastos(req, res, tenantId) {
  const r = parseRange(req.query || {});
  const base = `transaction?tenant_id=eq.${tenantId}&is_deleted=eq.false&type=eq.expense&created_at=gte.${r.from}&created_at=lt.${r.to}&order=created_at.asc,id.asc`;
  const [got, anulados] = await Promise.all([fetchRows(base, [TX_FULL, TX_BASIC]), deletedCount(tenantId, '&type=eq.expense', r.from, r.to)]);
  const avisos = [];
  if (got.basic) avisos.push(`No se pudo leer quien registro cada gasto ni el numero de boleto guardado: ${got.detail}.`);
  const numbers = await orderNumbers(tenantId, got.rows.filter((t) => t.order_id && !t.order_number).map((t) => t.order_id));
  const list = got.rows.map((t) => ({
    id: t.id,
    hora: prIso(t.created_at),
    dia: prDay(t.created_at),
    monto: dollars(Math.abs(cents(t.amount))),
    concepto: stripPrefix(t.description, 'Gasto'),
    descripcion: t.description || null,
    categoria: t.category || null,
    metodo: t.payment_method ? methodKey(t.payment_method) : null,
    boleto: t.order_number || numbers.get(t.order_id) || null,
    registrado_por: t.recorded_by || null,
  }));
  const sinCategoria = list.filter((g) => !g.categoria).length;
  if (sinCategoria) avisos.push(`${sinCategoria} gastos no tienen categoria; se agrupan como sin_categoria.`);
  const sinQuien = list.filter((g) => !g.registrado_por).length;
  if (!got.basic && sinQuien) avisos.push(`${sinQuien} gastos no tienen quien los registro.`);
  if (got.truncated) avisos.push(`El periodo tiene mas de ${MAX_ROWS} gastos; los totales cubren solo los ${MAX_ROWS} primeros. Pide un rango menor.`);
  const total = (rows) => ({ total: dollars(rows.reduce((s, g) => s + cents(g.monto), 0)), cantidad: rows.length });
  const cats = bucketBy(list, (g) => g.categoria || 'sin_categoria', () => [], (a, g) => a.push(g));
  const dias = bucketBy(list, (g) => g.dia, () => [], (a, g) => a.push(g));
  return {
    ok: true,
    periodo: r.periodo,
    cantidad: list.length,
    truncado: got.truncated,
    gastos: list,
    totales: total(list),
    por_categoria: [...cats.entries()].map(([categoria, rows]) => ({ categoria, ...total(rows) })).sort((a, b) => b.total - a.total),
    por_dia: [...dias.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([dia, rows]) => ({ dia, ...total(rows) })),
    anulados_excluidos: anulados,
    avisos,
  };
}

const REG_FULL = 'id,status,date,created_at,opening_balance,closing_balance,total_revenue,total_expenses,opened_by,closed_by,last_movement_at,final_count';
const REG_BASIC = 'id,status,date,created_at,opening_balance,closing_balance,total_revenue,total_expenses,opened_by,closed_by';

function shiftTotals(txs, openingCents) {
  const by = emptyMethods();
  let refunds = 0;
  let expenses = 0;
  let cashExpenses = 0;
  let sales = 0;
  for (const t of txs) {
    const k = methodKey(t.payment_method);
    const amt = Math.abs(cents(t.amount));
    if (t.type === 'revenue') {
      by[k] += cents(t.amount);
      sales += 1;
    } else if (t.type === 'refund') {
      by[k] -= amt;
      refunds += amt;
    } else if (t.type === 'expense') {
      expenses += amt;
      if (k === 'efectivo') cashExpenses += amt;
    }
  }
  const total = METHODS.reduce((s, m) => s + by[m], 0);
  return {
    por_metodo: Object.fromEntries(METHODS.map((m) => [m, dollars(by[m])])),
    cobrado: dollars(total),
    devoluciones: dollars(refunds),
    gastos: dollars(expenses),
    gastos_en_efectivo: dollars(cashExpenses),
    efectivo_esperado: dollars(openingCents + by.efectivo - cashExpenses),
    cobros: sales,
  };
}

function finalCountOf(reg) {
  return reg.final_count && typeof reg.final_count === 'object' ? reg.final_count : null;
}

function closedAtOf(reg) {
  const fc = finalCountOf(reg);
  return fc?.closed_at || reg.last_movement_at || null;
}

function countedOf(reg) {
  const fc = finalCountOf(reg);
  const denoms = fc?.denominations && typeof fc.denominations === 'object' ? Object.values(fc.denominations) : [];
  const hasDenoms = denoms.some((q) => Number(q) > 0);
  const raw = fc?.counted_total ?? fc?.total ?? reg.closing_balance;
  const counted = raw === null || raw === undefined ? null : cents(raw);
  return { counted, hasDenoms };
}

const TX_SHIFT = 'type,amount,payment_method,created_at';

async function shiftTransactions(tenantId, fromIso, toIso) {
  return fetchAll(
    `transaction?tenant_id=eq.${tenantId}&is_deleted=eq.false&created_at=gte.${fromIso}&created_at=lt.${toIso}&order=created_at.asc,id.asc&select=${TX_SHIFT}`,
    20000
  );
}

function within(txs, fromMs, toMs) {
  return txs.filter((t) => {
    const ms = Date.parse(t.created_at);
    return ms >= fromMs && ms < toMs;
  });
}

async function cierres(req, res, tenantId) {
  const r = parseRange(req.query || {});
  const base = `cash_register?tenant_id=eq.${tenantId}&created_at=gte.${r.from}&created_at=lt.${r.to}&order=created_at.asc,id.asc`;
  const got = await fetchRows(base, [REG_FULL, REG_BASIC], 500);
  const avisos = [];
  if (got.basic) avisos.push(`No se pudo leer el conteo guardado al cerrar ni la hora de cierre: ${got.detail}. Se uso closing_balance como efectivo contado.`);
  const now = Date.now();
  const windows = got.rows.map((reg) => {
    const startMs = Date.parse(reg.created_at);
    const open = String(reg.status || '').toLowerCase() === 'open';
    let endMs = now;
    let endKnown = true;
    if (!open) {
      const closed = closedAtOf(reg);
      if (closed && Number.isFinite(Date.parse(closed))) endMs = Date.parse(closed);
      else {
        endKnown = false;
        endMs = Date.parse(prDayRange(DATE_RE.test(String(reg.date || '')) ? reg.date : prDay(startMs)).to);
      }
    }
    return { reg, startMs, endMs, open, endKnown };
  }).filter((w) => Number.isFinite(w.startMs));
  let txs = [];
  let txTruncated = false;
  if (windows.length) {
    const lo = Math.min(...windows.map((w) => w.startMs));
    const hi = Math.max(...windows.map((w) => w.endMs)) + 1;
    const all = await shiftTransactions(tenantId, new Date(lo).toISOString(), new Date(hi).toISOString());
    txs = all.rows;
    txTruncated = all.truncated;
  }
  if (txTruncated) avisos.push('Hay demasiados movimientos en el periodo; los totales por turno pueden estar incompletos. Pide un rango menor.');
  const out = windows.map(({ reg, startMs, endMs, open, endKnown }) => {
    const openingC = cents(reg.opening_balance);
    const t = shiftTotals(within(txs, startMs, endMs + 1), openingC);
    const fc = finalCountOf(reg);
    const { counted, hasDenoms } = countedOf(reg);
    const expectedC = cents(t.efectivo_esperado);
    const sinConteo = !open && !hasDenoms && (counted === null || counted <= 0);
    let diferencia = null;
    let resultado = open ? 'abierta' : 'sin_conteo';
    if (!open && !sinConteo) {
      const d = counted - expectedC;
      diferencia = dollars(d);
      resultado = Math.abs(d) <= TOLERANCE_CENTS ? 'exacto' : d < 0 ? 'faltante' : 'sobrante';
    }
    const savedExpected = fc && (fc.expected_cash ?? fc.expectedCash) !== undefined ? cents(fc.expected_cash ?? fc.expectedCash) : null;
    if (!open && !endKnown) avisos.push(`El cierre ${reg.id} no guarda la hora de cierre; se calculo hasta el final del dia ${reg.date || prDay(startMs)}.`);
    if (savedExpected !== null && Math.abs(savedExpected - expectedC) > TOLERANCE_CENTS) {
      avisos.push(`Cierre ${reg.id}: el efectivo esperado guardado al cerrar ($${dollars(savedExpected).toFixed(2)}) difiere del recalculado ($${t.efectivo_esperado.toFixed(2)}).`);
    }
    return {
      id: reg.id,
      estado: open ? 'abierta' : 'cerrada',
      dia: reg.date || prDay(startMs),
      apertura: prIso(startMs),
      cierre: open ? null : endKnown ? prIso(endMs) : null,
      abierta_por: reg.opened_by || null,
      cerrada_por: open ? null : reg.closed_by || null,
      fondo_inicial: dollars(openingC),
      total_cobrado: t.cobrado,
      cobrado_por_metodo: t.por_metodo,
      devoluciones: t.devoluciones,
      gastos_turno: t.gastos,
      gastos_en_efectivo: t.gastos_en_efectivo,
      efectivo_esperado: t.efectivo_esperado,
      efectivo_contado: sinConteo || open ? null : dollars(counted ?? 0),
      diferencia,
      resultado,
      sin_conteo_efectivo: sinConteo,
      esperado_guardado_al_cerrar: savedExpected === null ? null : dollars(savedExpected),
      cobros: t.cobros,
    };
  });
  let faltante = 0;
  let sobrante = 0;
  for (const c of out) {
    if (c.resultado === 'faltante') faltante += -cents(c.diferencia);
    if (c.resultado === 'sobrante') sobrante += cents(c.diferencia);
  }
  return {
    ok: true,
    periodo: r.periodo,
    criterio: 'cajas abiertas dentro del periodo',
    tolerancia_exacto: dollars(TOLERANCE_CENTS),
    cantidad: out.length,
    truncado: got.truncated,
    cierres: out,
    resumen: {
      cerradas: out.filter((c) => c.estado === 'cerrada').length,
      abiertas: out.filter((c) => c.estado === 'abierta').length,
      sin_conteo_efectivo: out.filter((c) => c.sin_conteo_efectivo).length,
      faltante_total: dollars(faltante),
      sobrante_total: dollars(sobrante),
      total_cobrado: dollars(out.reduce((s, c) => s + cents(c.total_cobrado), 0)),
    },
    avisos: [...new Set(avisos)],
  };
}

async function estado(req, res, tenantId) {
  const base = `cash_register?tenant_id=eq.${tenantId}&order=created_at.desc,id.desc`;
  const [open, lastClosed] = await Promise.all([
    fetchRows(`${base}&status=eq.open`, [REG_FULL, REG_BASIC], 1),
    fetchRows(`${base}&status=eq.closed`, [REG_FULL, REG_BASIC], 1),
  ]);
  const avisos = [];
  if (open.basic) avisos.push(`No se pudo leer toda la informacion de la caja: ${open.detail}.`);
  const reg = open.rows[0] || null;
  const last = lastClosed.rows[0] || null;
  const ultimo = last
    ? {
        id: last.id,
        apertura: prIso(last.created_at),
        cierre: closedAtOf(last) ? prIso(closedAtOf(last)) : null,
        abierta_por: last.opened_by || null,
        cerrada_por: last.closed_by || null,
      }
    : null;
  if (!reg) return { ok: true, caja: 'cerrada', hora_actual: prIso(Date.now()), ultimo_cierre: ultimo, avisos };
  const startMs = Date.parse(reg.created_at);
  const now = Date.now();
  const all = await shiftTransactions(tenantId, new Date(startMs).toISOString(), new Date(now + 1).toISOString());
  if (all.truncated) avisos.push('Hay demasiados movimientos en el turno; los acumulados pueden estar incompletos.');
  const t = shiftTotals(all.rows, cents(reg.opening_balance));
  return {
    ok: true,
    caja: 'abierta',
    id: reg.id,
    abierta_desde: prIso(startMs),
    abierta_por: reg.opened_by || null,
    hora_actual: prIso(now),
    fondo_inicial: dollars(cents(reg.opening_balance)),
    cobrado_por_metodo: t.por_metodo,
    total_cobrado: t.cobrado,
    devoluciones: t.devoluciones,
    gastos_turno: t.gastos,
    gastos_en_efectivo: t.gastos_en_efectivo,
    efectivo_esperado_ahora: t.efectivo_esperado,
    cobros: t.cobros,
    ultimo_cierre: ultimo,
    avisos,
  };
}

function supplierFromUrl(url) {
  const lower = String(url || '').toLowerCase();
  const hit = SUPPLIER_HOSTS.find(([needle]) => lower.includes(needle));
  return hit ? hit[1] : null;
}

function supplierLabel(store) {
  const s = String(store || '').trim();
  if (!s || s.toLowerCase() === 'other') return null;
  const known = SUPPLIER_HOSTS.find(([needle]) => s.toLowerCase().replace(/[^a-z]/g, '') === needle.replace(/[^a-z]/g, ''));
  return known ? known[1] : s;
}

const LINK_FULL = 'id,order_id,order_number,title,store,url,cost,price,status,purchase_order_id,created_at';
const LINK_BASIC = 'id,order_id,order_number,title,store,cost,price,status,created_at';
const PO_COLUMNS = 'id,po_number,supplier_name,status,order_date,line_items';

async function piezas(req, res, tenantId) {
  const r = parseRange(req.query || {});
  const avisos = [];
  const links = await fetchRows(
    `part_link?tenant_id=eq.${tenantId}&created_at=gte.${r.from}&created_at=lt.${r.to}&order=created_at.asc,id.asc`,
    [LINK_FULL, LINK_BASIC]
  );
  if (links.basic) avisos.push(`No se pudo leer url ni compra de cada pieza: ${links.detail}.`);
  const dFrom = prDay(r.fromMs);
  const dTo = prDay(r.toMs - 1);
  const pos = await fetchRows(
    `purchase_order?tenant_id=eq.${tenantId}&order_date=gte.${dFrom}&order_date=lte.${dTo}&status=neq.cancelled&order=order_date.asc,id.asc`,
    [PO_COLUMNS, PO_COLUMNS],
    500
  );
  const poById = new Map(pos.rows.map((p) => [p.id, p]));
  const missingPoIds = links.rows.map((l) => l.purchase_order_id).filter((id) => id && !poById.has(id));
  const extraPos = await chunked(missingPoIds, 50, (chunk) => sb(`purchase_order?tenant_id=eq.${tenantId}&id=in.(${chunk.join(',')})&select=id,po_number,supplier_name,status&limit=${chunk.length}`));
  for (const p of extraPos) poById.set(p.id, p);
  const linkedPoIds = new Set(links.rows.map((l) => l.purchase_order_id).filter(Boolean));

  const rows = [];
  for (const l of links.rows) {
    const po = l.purchase_order_id ? poById.get(l.purchase_order_id) : null;
    const suplidor = po?.supplier_name || supplierLabel(l.store) || supplierFromUrl(l.url) || null;
    rows.push({
      origen: 'pieza_de_boleto',
      id: l.id,
      boleto: l.order_number || null,
      order_id: l.order_id || null,
      pieza: l.title || null,
      suplidor,
      orden_compra: po?.po_number || null,
      costo: l.cost === null || l.cost === undefined ? null : dollars(cents(l.cost)),
      precio: l.price === null || l.price === undefined ? null : dollars(cents(l.price)),
      estado: l.status || null,
      recibida: l.status === 'received',
      fecha_registro: prIso(l.created_at),
      dia: prDay(l.created_at),
      link_id: l.id,
      po_line_id: null,
    });
  }
  for (const po of pos.rows) {
    if (linkedPoIds.has(po.id)) continue;
    const lines = Array.isArray(po.line_items) ? po.line_items : [];
    for (const l of lines) {
      if (!l || (!l.linked_work_order_id && !l.linked_work_order_number)) continue;
      const qty = Number(l.quantity) || 1;
      const received = Number(l.received_quantity) || 0;
      rows.push({
        origen: 'orden_de_compra',
        id: l.id || null,
        boleto: l.linked_work_order_number || null,
        order_id: l.linked_work_order_id || null,
        pieza: l.product_name || l.description || null,
        suplidor: po.supplier_name || null,
        orden_compra: po.po_number || null,
        costo: l.unit_cost === null || l.unit_cost === undefined ? null : dollars(cents(l.unit_cost) * qty),
        precio: l.unit_price === null || l.unit_price === undefined || Number(l.unit_price) === 0 ? null : dollars(cents(l.unit_price) * qty),
        estado: po.status || null,
        recibida: received >= qty || po.status === 'received',
        fecha_registro: po.order_date || null,
        dia: po.order_date || null,
        link_id: null,
        po_line_id: l.id || null,
      });
    }
  }

  const orderIds = rows.map((x) => x.order_id);
  const orders = await chunked(orderIds, 50, (chunk) => sb(`order?tenant_id=eq.${tenantId}&id=in.(${chunk.join(',')})&select=id,order_number,order_items&limit=${chunk.length}`));
  const billedByLink = new Map();
  const billedByLine = new Map();
  const numberById = new Map();
  for (const o of orders) {
    numberById.set(o.id, o.order_number);
    for (const it of Array.isArray(o.order_items) ? o.order_items : []) {
      const total = cents(it.total ?? (Number(it.quantity) || 1) * (Number(it.price) || 0));
      if (it.source_part_link_id) billedByLink.set(it.source_part_link_id, total);
      if (it.source_po_line_id) billedByLine.set(it.source_po_line_id, total);
    }
  }
  const out = rows.map(({ order_id, link_id, po_line_id, ...x }) => {
    const billed = link_id ? billedByLink.get(link_id) : po_line_id ? billedByLine.get(po_line_id) : undefined;
    return {
      ...x,
      boleto: x.boleto || numberById.get(order_id) || null,
      facturada_en_boleto: billed !== undefined,
      precio_facturado: billed === undefined ? null : dollars(billed),
      instalada: null,
    };
  });

  const counted = out.filter((p) => p.estado !== 'to_order');
  const sum = (list, key) => dollars(list.reduce((s, p) => s + cents(p[key]), 0));
  const groups = bucketBy(counted, (p) => p.suplidor || 'Sin suplidor', () => [], (a, p) => a.push(p));
  const sinCosto = counted.filter((p) => p.costo === null).length;
  const sinSuplidor = counted.filter((p) => !p.suplidor).length;
  if (sinCosto) avisos.push(`${sinCosto} piezas no tienen costo registrado; el costo total esta subestimado. En part_link el costo solo se guarda al registrar la pieza por la API o al recibir una compra.`);
  if (sinSuplidor) avisos.push(`${sinSuplidor} piezas no tienen suplidor identificable (part_link.store es otro/vacio y no hay orden de compra); aparecen como Sin suplidor.`);
  avisos.push('El sistema no guarda si una pieza esta instalada: instalada es null. facturada_en_boleto indica que la pieza ya esta en la factura del boleto.');
  if (links.truncated || pos.truncated) avisos.push('El periodo tiene demasiadas piezas; los totales pueden estar incompletos. Pide un rango menor.');
  return {
    ok: true,
    periodo: r.periodo,
    cantidad: out.length,
    truncado: links.truncated || pos.truncated,
    piezas: out,
    totales: {
      piezas: counted.length,
      costo: sum(counted, 'costo'),
      precio: sum(counted, 'precio'),
      por_ordenar_sin_contar: out.length - counted.length,
    },
    por_suplidor: [...groups.entries()]
      .map(([suplidor, list]) => ({ suplidor, piezas: list.length, costo: sum(list, 'costo'), precio: sum(list, 'precio') }))
      .sort((a, b) => b.costo - a.costo),
    avisos,
  };
}

const READY_COLUMNS = 'id,order_number,customer_name,customer_phone,device_brand,device_model,device_type,cost_estimate,labor_cost,amount_paid,balance_due,status_history,created_date,updated_date';

function readySince(order) {
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  for (let i = history.length - 1; i >= 0; i--) {
    const e = history[i];
    if (e && e.status === 'ready_for_pickup' && Number.isFinite(Date.parse(e.timestamp))) return { ms: Date.parse(e.timestamp), exact: true };
  }
  const ms = Date.parse(order.updated_date);
  return Number.isFinite(ms) ? { ms, exact: false } : { ms: null, exact: false };
}

async function listosSinCobrar(req, res, tenantId) {
  const got = await fetchRows(
    `order?tenant_id=eq.${tenantId}&is_deleted=eq.false&status=eq.ready_for_pickup&balance_due=gt.0&order=updated_date.asc,id.asc`,
    [READY_COLUMNS, READY_COLUMNS],
    500
  );
  const now = Date.now();
  const avisos = [];
  const list = got.rows.map((o) => {
    const since = readySince(o);
    return {
      id: o.id,
      numero: o.order_number,
      cliente: o.customer_name || null,
      telefono: o.customer_phone || null,
      equipo: [o.device_brand, o.device_model].filter(Boolean).join(' ') || o.device_type || null,
      total_facturado: dollars(cents(o.cost_estimate ?? o.labor_cost ?? 0)),
      cobrado: dollars(cents(o.amount_paid)),
      balance_pendiente: dollars(cents(o.balance_due)),
      listo_desde: since.ms === null ? null : prIso(since.ms),
      listo_desde_aproximado: !since.exact,
      dias_esperando: since.ms === null ? null : Math.max(0, Math.floor((now - since.ms) / DAY_MS)),
    };
  }).sort((a, b) => (b.dias_esperando ?? -1) - (a.dias_esperando ?? -1));
  const aprox = list.filter((b) => b.listo_desde_aproximado).length;
  if (aprox) avisos.push(`${aprox} boletos no tienen en su historial la fecha en que pasaron a Listo para recoger; se uso la ultima actualizacion (listo_desde_aproximado).`);
  if (got.truncated) avisos.push('Hay mas de 500 boletos listos con balance; se devuelven los 500 mas antiguos por actualizacion.');
  return {
    ok: true,
    hora_actual: prIso(now),
    cantidad: list.length,
    truncado: got.truncated,
    balance_total: dollars(list.reduce((s, b) => s + cents(b.balance_pendiente), 0)),
    boletos: list,
    avisos,
  };
}

const TIME_FULL = 'id,employee_id,employee_name,clock_in,clock_out,total_hours,edited_by,edit_reason';
const TIME_BASIC = 'id,employee_id,employee_name,clock_in,clock_out,total_hours';

async function ponches(req, res, tenantId) {
  const r = parseRange(req.query || {});
  const got = await fetchRows(
    `time_entry?tenant_id=eq.${tenantId}&clock_in=gte.${r.from}&clock_in=lt.${r.to}&order=clock_in.asc,id.asc`,
    [TIME_FULL, TIME_BASIC]
  );
  const avisos = [];
  if (got.basic) avisos.push(`No se pudo leer si un ponche fue editado: ${got.detail}.`);
  const events = [];
  const shifts = [];
  const open = [];
  for (const t of got.rows) {
    const who = t.employee_name || t.employee_id || 'Sin nombre';
    const inMs = Date.parse(t.clock_in);
    const outMs = t.clock_out ? Date.parse(t.clock_out) : null;
    const editado = !!t.edited_by;
    events.push({ id: t.id, empleado: who, empleado_id: t.employee_id || null, tipo: 'entrada', hora: prIso(inMs), dia: prDay(inMs), editado });
    if (outMs !== null && Number.isFinite(outMs)) {
      events.push({ id: t.id, empleado: who, empleado_id: t.employee_id || null, tipo: 'salida', hora: prIso(outMs), dia: prDay(outMs), editado });
      const stored = t.total_hours === null || t.total_hours === undefined ? null : Number(t.total_hours);
      const hours = stored !== null && Number.isFinite(stored) ? stored : Math.round((Math.max(0, outMs - inMs) / 3_600_000) * 100) / 100;
      shifts.push({ empleado: who, empleado_id: t.employee_id || null, dia: prDay(inMs), horas: hours, derivado: stored === null });
    } else {
      open.push({ id: t.id, empleado: who, entrada: prIso(inMs), dia: prDay(inMs) });
    }
  }
  events.sort((a, b) => (a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0));
  const derivados = shifts.filter((s) => s.derivado).length;
  if (derivados) avisos.push(`${derivados} turnos no guardan total_hours; las horas se calcularon de entrada y salida.`);
  if (open.length) avisos.push(`${open.length} turnos siguen abiertos (sin salida); no suman horas hasta que se cierren.`);
  if (got.truncated) avisos.push(`El periodo tiene mas de ${MAX_ROWS} turnos; las horas cubren solo los primeros. Pide un rango menor.`);
  avisos.push('Cada turno se atribuye al dia de su entrada, aunque la salida sea despues de medianoche.');
  const perDay = bucketBy(shifts, (s) => `${s.empleado}|${s.dia}`, () => ({ horas: 0, turnos: 0, empleado: '', empleado_id: null, dia: '' }), (a, s) => {
    a.horas += cents(s.horas);
    a.turnos += 1;
    a.empleado = s.empleado;
    a.empleado_id = s.empleado_id;
    a.dia = s.dia;
  });
  const porDia = [...perDay.values()]
    .map((v) => ({ empleado: v.empleado, empleado_id: v.empleado_id, dia: v.dia, horas: dollars(v.horas), turnos: v.turnos }))
    .sort((a, b) => (a.dia < b.dia ? -1 : a.dia > b.dia ? 1 : a.empleado < b.empleado ? -1 : 1));
  const perEmp = bucketBy(porDia, (d) => d.empleado, () => ({ horas: 0, dias: 0 }), (a, d) => {
    a.horas += cents(d.horas);
    a.dias += 1;
  });
  return {
    ok: true,
    periodo: r.periodo,
    cantidad: events.length,
    truncado: got.truncated,
    ponches: events,
    turnos_abiertos: open,
    horas_por_dia: porDia,
    horas_por_empleado: [...perEmp.entries()].map(([empleado, v]) => ({ empleado, horas: dollars(v.horas), dias: v.dias })).sort((a, b) => b.horas - a.horas),
    avisos,
  };
}

const PRODUCT_FULL = 'id,name,stock,min_stock,cost,price,category,supplier_name';
const PRODUCT_BASIC = 'id,name,stock,min_stock,price,category';
const LOW_LIMIT = 200;
const LIST_LIMIT = 500;

async function inventario(req, res, tenantId) {
  const got = await fetchRows(
    `product?tenant_id=eq.${tenantId}&active=eq.true&type=eq.product&order=name.asc,id.asc`,
    [PRODUCT_FULL, PRODUCT_BASIC],
    5000
  );
  const avisos = [];
  const hasCost = !got.basic;
  if (got.basic) avisos.push(`No se pudo leer el costo de los productos (${got.detail}); no se puede calcular capital parado.`);
  const tracked = got.rows.filter((p) => p.stock !== null && p.stock !== undefined && Number(p.stock) >= 0);
  const sinCosto = hasCost ? tracked.filter((p) => Number(p.stock) > 0 && (p.cost === null || p.cost === undefined || Number(p.cost) <= 0)).length : 0;
  if (sinCosto) avisos.push(`${sinCosto} productos con existencia no tienen costo; su capital cuenta como 0 y el total esta subestimado.`);
  const noTracked = got.rows.length - tracked.length;
  if (noTracked) avisos.push(`${noTracked} productos no llevan control de existencia y no cuentan en el capital.`);
  if (got.truncated) avisos.push('Hay mas de 5000 productos; los totales cubren solo los primeros 5000.');
  const capitalOf = (p) => (hasCost ? Number(p.stock) * cents(p.cost) : null);
  const withStock = tracked.filter((p) => Number(p.stock) > 0);
  const capital = hasCost ? dollars(withStock.reduce((s, p) => s + capitalOf(p), 0)) : null;
  const cats = bucketBy(withStock, (p) => p.category || 'sin_categoria', () => ({ productos: 0, unidades: 0, capital: 0 }), (a, p) => {
    a.productos += 1;
    a.unidades += Number(p.stock);
    a.capital += capitalOf(p) || 0;
  });
  const low = tracked.filter((p) => Number(p.stock) <= Number(p.min_stock || 0));
  const shape = (p) => ({
    id: p.id,
    nombre: p.name,
    existencia: Number(p.stock),
    minimo: Number(p.min_stock) || 0,
    costo: hasCost && p.cost !== null && p.cost !== undefined ? dollars(cents(p.cost)) : null,
    precio: dollars(cents(p.price)),
    categoria: p.category || null,
    suplidor: hasCost ? p.supplier_name || null : null,
    capital: hasCost ? dollars(capitalOf(p)) : null,
  });
  return {
    ok: true,
    cantidad_productos: got.rows.length,
    con_existencia: withStock.length,
    unidades_totales: withStock.reduce((s, p) => s + Number(p.stock), 0),
    capital_parado: capital,
    por_categoria: [...cats.entries()]
      .map(([categoria, v]) => ({ categoria, productos: v.productos, unidades: v.unidades, capital: hasCost ? dollars(v.capital) : null }))
      .sort((a, b) => (b.capital ?? 0) - (a.capital ?? 0)),
    existencia_baja: {
      cantidad: low.length,
      truncado: low.length > LOW_LIMIT,
      productos: low.slice(0, LOW_LIMIT).map(shape),
    },
    truncado: got.truncated,
    productos_truncado: withStock.length > LIST_LIMIT,
    productos: [...withStock].sort((a, b) => (capitalOf(b) ?? Number(b.stock)) - (capitalOf(a) ?? Number(a.stock))).slice(0, LIST_LIMIT).map(shape),
    avisos,
  };
}

const ROUTES = {
  'caja/cierres': cierres,
  'caja/estado': estado,
  pagos,
  gastos,
  'boletos/listos-sin-cobrar': listosSinCobrar,
  ponches,
  inventario,
};

export async function lecturaRoute(parts, req, res, tenantId) {
  const key = parts.join('/');
  let handler = Object.prototype.hasOwnProperty.call(ROUTES, key) ? ROUTES[key] : null;
  if (!handler && key === 'piezas' && (present(req.query?.desde) || present(req.query?.hasta))) handler = piezas;
  if (!handler && key === 'piezas/registradas') handler = piezas;
  if (!handler) return false;
  try {
    const body = await handler(req, res, tenantId);
    res.status(200).json(body);
  } catch (e) {
    if (e instanceof QueryError) {
      fail(res, 400, e.message, 'invalid_query');
      return true;
    }
    throw e;
  }
  return true;
}
