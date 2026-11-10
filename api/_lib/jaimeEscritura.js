import crypto from 'node:crypto';
import { sb, UUID_RE } from './muse.js';
import { fetchAll, shiftTotals, cents, dollars, prIso, TOLERANCE_CENTS } from './jaimeLectura.js';

export const API_ACTOR = 'Jaime (API)';
const REQ_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{7,63}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/;
const FUTURE_LIMIT_MS = 5 * 60_000;
const PAST_LIMIT_MS = 24 * 3_600_000;
const MAX_SHIFT_MS = 24 * 3_600_000;
const MAX_NOTE = 200;
const MAX_OBS = 500;
const MAX_CASH_CENTS = 100_000_000;
const DENOMS = { '100': 10000, '50': 5000, '20': 2000, '10': 1000, '5': 500, '1': 100, '025': 25, '010': 10, '005': 5, '001': 1 };
const MAX_PER_DENOM = 99999;
const CASH_KEYS = new Set(['cash', 'efectivo']);
const ATH_KEYS = new Set(['ath_movil', 'ath', 'movil', 'athmovil']);
const SALE_CATEGORIES = new Set(['sale', 'repair_payment']);

class Reject extends Error {
  constructor(status, code, message, extra) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra || {};
  }
}

function send(res, status, body) {
  return res.status(status).json(body);
}

function parseBody(req) {
  let b = req.body;
  if (typeof b === 'string') {
    try { b = JSON.parse(b); } catch { throw new Reject(400, 'invalid_body', 'El cuerpo debe ser JSON valido'); }
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Reject(400, 'invalid_body', 'El cuerpo debe ser un objeto JSON');
  return b;
}

function readRequestId(b) {
  const v = typeof b.id_solicitud === 'string' ? b.id_solicitud.trim() : '';
  if (!REQ_RE.test(v)) throw new Reject(400, 'invalid_body', 'id_solicitud es obligatorio: texto estable de 8 a 64 caracteres (letras, numeros, . _ : -)');
  return v;
}

function readOptionalText(v, name, max) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string') throw new Reject(400, 'invalid_body', `${name} debe ser texto`);
  const t = v.replace(/\s+/g, ' ').trim();
  if (t.length > max) throw new Reject(400, 'invalid_body', `${name} no puede pasar de ${max} caracteres`);
  return t;
}

function derivedUuid(tenantId, kind, requestId) {
  const h = crypto.createHash('sha1').update(`jaime|${tenantId}|${kind}|${requestId}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

function isDuplicate(e) {
  return e && (e.status === 409 || /duplicate|unique|23505/i.test(String(e.message || '')));
}

function isMissingColumn(e) {
  return e && e.status === 400 && /column|42703|does not exist/i.test(String(e.message || ''));
}

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function audit(kind, data) {
  console.log(`jaime escritura ${kind}:`, JSON.stringify(data));
}

const EMP_COLS = 'id,full_name,employee_code,active,status,auth_user_id';
const PUNCH_COLS = 'id,tenant_id,employee_id,employee_name,clock_in,clock_out,total_hours,updated_at,edited_by,edit_reason';

function empShape(e) {
  return { id: e.id, nombre: e.full_name || null, codigo: e.employee_code || null };
}

async function resolveEmployee(tenantId, refRaw) {
  const ref = typeof refRaw === 'string' ? refRaw.trim() : '';
  if (!ref) throw new Reject(400, 'invalid_body', 'empleado es obligatorio: id, codigo o nombre');
  if (ref.length > 120) throw new Reject(400, 'invalid_body', 'empleado es demasiado largo');
  const rows = (await sb(`app_employee?tenant_id=eq.${tenantId}&select=${EMP_COLS}&order=full_name.asc,id.asc&limit=500`)) || [];
  const isActive = (e) => e.active !== false;
  if (UUID_RE.test(ref)) {
    const key = ref.toLowerCase();
    const hit = rows.find((e) => String(e.id).toLowerCase() === key || String(e.auth_user_id || '').toLowerCase() === key);
    if (hit) {
      if (!isActive(hit)) throw new Reject(403, 'employee_inactive', 'El empleado esta inactivo', { empleado: empShape(hit) });
      return hit;
    }
    const other = await sb(`app_employee?id=eq.${key}&select=id,tenant_id&limit=1`);
    if (other && other[0] && other[0].tenant_id !== tenantId) throw new Reject(403, 'employee_other_tenant', 'El empleado pertenece a otra tienda');
    throw new Reject(404, 'employee_not_found', 'Empleado no encontrado');
  }
  const q = norm(ref);
  if (!q) throw new Reject(400, 'invalid_body', 'empleado es obligatorio: id, codigo o nombre');
  const tokens = q.split(' ');
  const stages = [
    (e) => e.employee_code && norm(e.employee_code) === q,
    (e) => norm(e.full_name) === q,
    (e) => { const n = norm(e.full_name); return tokens.every((t) => n.split(' ').some((w) => w.startsWith(t))); },
  ];
  let inactive = null;
  for (const test of stages) {
    const hits = rows.filter(test);
    const active = hits.filter(isActive);
    if (active.length === 1) return active[0];
    if (active.length > 1) throw new Reject(400, 'employee_ambiguous', 'El empleado es ambiguo; usa el id', { candidatos: active.slice(0, 10).map(empShape) });
    if (hits.length && !inactive) inactive = hits[0];
  }
  if (inactive) throw new Reject(403, 'employee_inactive', 'El empleado esta inactivo', { empleado: empShape(inactive) });
  throw new Reject(404, 'employee_not_found', 'Empleado no encontrado');
}

function parseWhen(raw, now) {
  if (raw === undefined || raw === null || raw === '') return now;
  if (typeof raw !== 'string') throw new Reject(400, 'invalid_body', 'fecha_hora debe ser fecha ISO');
  let s = raw.trim();
  if (!ISO_RE.test(s)) throw new Reject(400, 'invalid_body', 'fecha_hora debe ser fecha ISO valida (ej. 2026-11-09T08:00:00-04:00)');
  const ms = Date.parse(/(Z|[+-]\d{2}:\d{2})$/.test(s) ? s : `${s}-04:00`);
  if (!Number.isFinite(ms)) throw new Reject(400, 'invalid_body', 'fecha_hora no es una fecha valida');
  if (ms > now + FUTURE_LIMIT_MS) throw new Reject(400, 'invalid_body', 'fecha_hora no puede estar en el futuro (maximo 5 minutos)', { codigo_detalle: 'fecha_futura' });
  if (ms < now - PAST_LIMIT_MS) throw new Reject(400, 'invalid_body', 'fecha_hora no puede tener mas de 24 horas de antiguedad', { codigo_detalle: 'fecha_antigua' });
  return ms;
}

function voided(t) {
  return String(t.edit_reason || '').startsWith('ANULADO: ') && Number(t.total_hours || 0) <= 0;
}

function shapePunch(t) {
  const inMs = Date.parse(t.clock_in);
  const outMs = t.clock_out ? Date.parse(t.clock_out) : null;
  return {
    id: t.id,
    empleado: t.employee_name || null,
    empleado_id: t.employee_id || null,
    entrada: Number.isFinite(inMs) ? prIso(inMs) : null,
    salida: outMs !== null && Number.isFinite(outMs) ? prIso(outMs) : null,
    horas: t.total_hours === null || t.total_hours === undefined ? null : Number(t.total_hours),
    abierto: !t.clock_out,
    origen: t.edited_by === API_ACTOR ? 'api_jaime' : null,
    editado_por: t.edited_by || null,
    nota: t.edit_reason || null,
  };
}

function shiftState(t, now) {
  const open = !!t && !t.clock_out;
  const inMs = t ? Date.parse(t.clock_in) : NaN;
  return {
    abierto: open,
    entrada_desde: open && Number.isFinite(inMs) ? prIso(inMs) : null,
    minutos_abierto: open && Number.isFinite(inMs) ? Math.max(0, Math.floor((now - inMs) / 60_000)) : null,
  };
}

function employeeIds(emp) {
  return [...new Set([emp.id, emp.auth_user_id].filter(Boolean).map((x) => String(x).toLowerCase()))];
}

async function fetchPunch(id) {
  const rows = await sb(`time_entry?id=eq.${id}&select=${PUNCH_COLS}&limit=1`);
  return rows && rows[0] ? rows[0] : null;
}

async function openPunch(tenantId, ids) {
  const rows = await sb(`time_entry?tenant_id=eq.${tenantId}&employee_id=in.(${ids.join(',')})&clock_out=is.null&order=clock_in.desc,id.desc&select=${PUNCH_COLS}&limit=1`);
  return rows && rows[0] ? rows[0] : null;
}

async function recentPunches(tenantId, ids) {
  return (await sb(`time_entry?tenant_id=eq.${tenantId}&employee_id=in.(${ids.join(',')})&order=clock_in.desc,id.desc&select=${PUNCH_COLS}&limit=5`)) || [];
}

function overlaps(rows, tMs) {
  for (const r of rows) {
    if (voided(r)) continue;
    const inMs = Date.parse(r.clock_in);
    if (!Number.isFinite(inMs)) continue;
    const outMs = r.clock_out ? Date.parse(r.clock_out) : Infinity;
    if (tMs >= inMs && tMs < outMs) return r;
    if (inMs >= tMs) return r;
  }
  return null;
}

function conflict(code, message, punch, now, extra) {
  return new Reject(409, code, message, { turno_abierto: punch ? shapePunch(punch) : null, turno: shiftState(punch, now), ...(extra || {}) });
}

function tagOf(kind, sid) {
  return `[${kind}:${sid}]`;
}

async function ponchar(req, res, tenantId) {
  const b = parseBody(req);
  const sid = readRequestId(b);
  const tipo = typeof b.tipo === 'string' ? b.tipo.trim().toLowerCase() : '';
  if (tipo !== 'entrada' && tipo !== 'salida') throw new Reject(400, 'invalid_body', "tipo debe ser 'entrada' o 'salida'");
  const nota = readOptionalText(b.nota, 'nota', MAX_NOTE);
  const now = Date.now();
  const whenMs = parseWhen(b.fecha_hora, now);
  const emp = await resolveEmployee(tenantId, b.empleado);
  const ids = employeeIds(emp);
  try {
    return tipo === 'entrada'
      ? await clockIn({ res, tenantId, sid, nota, whenMs, now, emp, ids })
      : await clockOut({ res, tenantId, sid, nota, whenMs, now, emp, ids });
  } catch (e) {
    if (isMissingColumn(e)) throw new Reject(503, 'audit_columns_missing', 'Faltan las columnas de auditoria de time_entry (edited_by, edit_reason, updated_at); no se registra el ponche sin marcar su origen');
    throw e;
  }
}

function okPunch(res, tipo, repetido, punch, now, extra) {
  return send(res, 200, { ok: true, tipo, repetido, ponche: shapePunch(punch), turno: shiftState(punch, now), ...(extra || {}) });
}

async function clockIn({ res, tenantId, sid, nota, whenMs, now, emp, ids }) {
  const rid = derivedUuid(tenantId, 'ponche-entrada', sid);
  const existing = await fetchPunch(rid);
  if (existing) {
    if (existing.tenant_id !== tenantId || !ids.includes(String(existing.employee_id).toLowerCase())) {
      throw new Reject(409, 'request_id_reused', 'id_solicitud ya se uso con otro empleado');
    }
    return okPunch(res, 'entrada', true, existing, now);
  }
  const open = await openPunch(tenantId, ids);
  if (open) throw conflict('shift_open', 'El empleado ya tiene un turno abierto', open, now);
  const recent = await recentPunches(tenantId, ids);
  const clash = overlaps(recent, whenMs);
  if (clash) throw conflict('punch_overlap', 'La entrada se encima con otro ponche del empleado', clash, now);
  const body = {
    id: rid,
    tenant_id: tenantId,
    employee_id: emp.id,
    employee_name: (emp.full_name || '').trim() || 'Usuario',
    clock_in: new Date(whenMs).toISOString(),
    edited_by: API_ACTOR,
    edit_reason: `API Jaime: ${nota || 'entrada registrada por API'} ${tagOf('ent', sid)}`,
  };
  let row;
  try {
    const inserted = await sb('time_entry', { method: 'POST', body, prefer: 'return=representation' });
    row = Array.isArray(inserted) ? inserted[0] : inserted;
  } catch (e) {
    if (!isDuplicate(e)) throw e;
    const mine = await fetchPunch(rid);
    if (mine) return okPunch(res, 'entrada', true, mine, now);
    const raced = await openPunch(tenantId, ids);
    if (raced) throw conflict('shift_open', 'El empleado ya tiene un turno abierto', raced, now);
    throw e;
  }
  if (!row) row = await fetchPunch(rid);
  if (!row) throw new Reject(502, 'upstream_error', 'No se pudo confirmar el ponche');
  audit('ponche', { tipo: 'entrada', id: row.id, empleado_id: emp.id, id_solicitud: sid, clock_in: body.clock_in });
  return okPunch(res, 'entrada', false, row, now);
}

async function clockOut({ res, tenantId, sid, nota, whenMs, now, emp, ids }) {
  const tag = tagOf('sal', sid);
  const marked = await sb(`time_entry?tenant_id=eq.${tenantId}&employee_id=in.(${ids.join(',')})&edit_reason=like.${encodeURIComponent(`*${tag}*`)}&select=${PUNCH_COLS}&limit=5`);
  const prior = (marked || []).find((r) => String(r.edit_reason || '').includes(tag));
  if (prior) return okPunch(res, 'salida', true, prior, now);
  const other = await sb(`time_entry?tenant_id=eq.${tenantId}&edit_reason=like.${encodeURIComponent(`*${tag}*`)}&select=id&limit=1`);
  if (other && other.length) throw new Reject(409, 'request_id_reused', 'id_solicitud ya se uso con otro empleado');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const open = await openPunch(tenantId, ids);
    if (!open) {
      const recent = await recentPunches(tenantId, ids);
      const last = recent.find((r) => !voided(r)) || null;
      throw new Reject(409, 'no_open_shift', 'El empleado no tiene un turno abierto', { turno_abierto: null, turno: shiftState(null, now), ultimo_ponche: last ? shapePunch(last) : null });
    }
    const inMs = Date.parse(open.clock_in);
    if (!Number.isFinite(inMs)) throw new Reject(409, 'shift_invalid', 'El turno abierto no tiene hora de entrada valida', { turno_abierto: shapePunch(open) });
    if (whenMs <= inMs) throw new Reject(400, 'invalid_body', 'La salida debe ser posterior a la entrada', { turno_abierto: shapePunch(open) });
    if (whenMs - inMs >= MAX_SHIFT_MS) throw new Reject(409, 'shift_too_long', 'El turno abierto lleva 24 horas o mas; corrigelo desde la app con un motivo', { turno_abierto: shapePunch(open) });
    const hours = Math.round(((whenMs - inMs) / 3_600_000) * 100) / 100;
    const addition = `API Jaime: ${nota || 'salida registrada por API'} ${tag}`;
    const prevReason = String(open.edit_reason || '').trim();
    const fields = {
      clock_out: new Date(whenMs).toISOString(),
      total_hours: hours,
      edited_by: open.edited_by || API_ACTOR,
      edit_reason: prevReason ? `${prevReason} | ${addition}` : addition,
    };
    let filter = `time_entry?id=eq.${open.id}&tenant_id=eq.${tenantId}&clock_out=is.null`;
    if (open.updated_at) filter += `&updated_at=eq.${encodeURIComponent(open.updated_at)}`;
    const rows = await sb(`${filter}&select=${PUNCH_COLS}`, { method: 'PATCH', body: fields, prefer: 'return=representation' });
    if (rows && rows[0]) {
      audit('ponche', { tipo: 'salida', id: rows[0].id, empleado_id: emp.id, id_solicitud: sid, clock_out: fields.clock_out, total_hours: hours });
      return okPunch(res, 'salida', false, rows[0], now);
    }
    const latest = await fetchPunch(open.id);
    if (latest && latest.clock_out && String(latest.edit_reason || '').includes(tag)) return okPunch(res, 'salida', true, latest, now);
    if (latest && latest.clock_out) throw new Reject(409, 'no_open_shift', 'El turno ya se cerro desde otro dispositivo', { turno_abierto: null, ponche: shapePunch(latest) });
  }
  throw new Reject(409, 'changed_elsewhere', 'El ponche cambio en otro dispositivo; revisa y vuelve a intentar');
}

const REG_COLS = 'id,tenant_id,status,date,created_at,opening_balance,opened_by,closed_by,total_revenue,total_expenses,last_movement_at,final_count';
const TX_COLS = 'type,amount,payment_method,category,created_at';

function summarize(rows, nowMs) {
  let revenue = 0;
  let expenses = 0;
  let cashExpenses = 0;
  let cashRefunds = 0;
  let sales = 0;
  const byMethod = {};
  for (const t of rows) {
    const at = Date.parse(t.created_at);
    if (Number.isFinite(at) && at > nowMs) continue;
    const method = String(t.payment_method ?? 'cash').trim().toLowerCase() || 'cash';
    const amt = cents(t.amount);
    if (t.type === 'revenue') {
      revenue += amt;
      byMethod[method] = (byMethod[method] || 0) + amt;
      if (SALE_CATEGORIES.has(t.category)) sales += 1;
    } else if (t.type === 'expense') {
      expenses += amt;
      if (CASH_KEYS.has(method)) cashExpenses += Math.abs(amt);
    } else if (t.type === 'refund') {
      const r = Math.abs(amt);
      revenue -= r;
      byMethod[method] = (byMethod[method] || 0) - r;
      if (CASH_KEYS.has(method)) cashRefunds += r;
    }
  }
  let cash = 0;
  let card = 0;
  let ath = 0;
  for (const [m, sum] of Object.entries(byMethod)) {
    if (CASH_KEYS.has(m)) cash += sum;
    else if (ATH_KEYS.has(m)) ath += sum;
    else card += sum;
  }
  return { revenue, expenses, cashExpenses, cashRefunds, sales, byMethod, cash, card, ath };
}

function readMoney(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Reject(400, 'invalid_body', `${name} es obligatorio y debe ser un numero`);
  const c = Math.round(v * 100);
  if (Math.abs(v * 100 - c) > 1e-6) throw new Reject(400, 'invalid_body', `${name} no puede tener mas de 2 decimales`);
  if (c < 0 || c > MAX_CASH_CENTS) throw new Reject(400, 'invalid_body', `${name} esta fuera de rango`);
  return c;
}

function readDenominations(v) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) throw new Reject(400, 'invalid_body', 'denominaciones debe ser un objeto');
  const out = {};
  let total = 0;
  for (const [k, q] of Object.entries(v)) {
    if (!(k in DENOMS)) throw new Reject(400, 'invalid_body', `denominacion desconocida: ${k}. Validas: ${Object.keys(DENOMS).join(', ')}`);
    if (!Number.isInteger(q) || q < 0 || q > MAX_PER_DENOM) throw new Reject(400, 'invalid_body', `cantidad invalida en la denominacion ${k}`);
    out[k] = q;
  }
  const full = {};
  for (const k of Object.keys(DENOMS)) {
    full[k] = out[k] || 0;
    total += full[k] * DENOMS[k];
  }
  return { payload: full, total, empty: Object.keys(out).length === 0 || total === 0 };
}

function classify(diffC) {
  return Math.abs(diffC) <= TOLERANCE_CENTS ? 'exacto' : diffC < 0 ? 'faltante' : 'sobrante';
}

function shapeCierre(reg, fc, repetido) {
  const counted = cents(fc.counted_total);
  const expected = cents(fc.expected_cash);
  const diff = fc.difference !== undefined ? cents(fc.difference) : counted - expected;
  const sinConteo = fc.sin_conteo === true;
  return {
    id: reg.id,
    estado: 'cerrada',
    modalidad: sinConteo ? 'sin_conteo' : 'con_conteo',
    id_solicitud: fc.request_id || null,
    dia: reg.date || null,
    apertura: reg.created_at ? prIso(reg.created_at) : null,
    cierre: fc.closed_at ? prIso(fc.closed_at) : null,
    abierta_por: reg.opened_by || null,
    cerrada_por: reg.closed_by || null,
    fondo_inicial: dollars(cents(reg.opening_balance)),
    total_cobrado: Number(fc.total_revenue) || 0,
    cobrado_por_metodo: fc.revenue_by_method || {},
    gastos_turno: Number(fc.total_expenses) || 0,
    gastos_en_efectivo: Number(fc.total_cash_expenses) || 0,
    devoluciones_en_efectivo: Number(fc.total_cash_refunds) || 0,
    efectivo_esperado: dollars(expected),
    efectivo_contado: dollars(counted),
    diferencia: dollars(diff),
    resultado: classify(diff),
    tolerancia_exacto: dollars(TOLERANCE_CENTS),
    requiere_revision: Math.abs(diff) > TOLERANCE_CENTS || sinConteo,
    sin_conteo: sinConteo,
    observaciones: fc.observations || '',
    cobros: Number(fc.sale_count) || 0,
    repetido,
  };
}

function registerBrief(r) {
  return { id: r.id, abierta_por: r.opened_by || null, apertura: r.created_at ? prIso(r.created_at) : null, fondo_inicial: dollars(cents(r.opening_balance)) };
}

function finalOf(reg) {
  return reg && reg.final_count && typeof reg.final_count === 'object' ? reg.final_count : null;
}

async function findByRequest(tenantId, sid) {
  const rows = await sb(`cash_register?tenant_id=eq.${tenantId}&status=eq.closed&final_count->>request_id=eq.${encodeURIComponent(sid)}&select=${REG_COLS}&limit=1`);
  const reg = rows && rows[0];
  return reg && finalOf(reg)?.request_id === sid ? reg : null;
}

async function cerrarCaja(req, res, tenantId, actor) {
  const b = parseBody(req);
  const sid = readRequestId(b);
  const modalidad = typeof b.modalidad === 'string' ? b.modalidad.trim().toLowerCase() : '';
  if (modalidad !== 'con_conteo' && modalidad !== 'sin_conteo') throw new Reject(400, 'invalid_body', "modalidad debe ser 'con_conteo' o 'sin_conteo'");
  const sinConteo = modalidad === 'sin_conteo';
  const countedC = readMoney(b.efectivo_contado, 'efectivo_contado');
  const obs = readOptionalText(b.observaciones, 'observaciones', MAX_OBS);
  const quien = readOptionalText(b.cerrado_por, 'cerrado_por', 60);
  const denoms = readDenominations(b.denominaciones);
  let cajaId = null;
  if (b.caja_id !== undefined && b.caja_id !== null && b.caja_id !== '') {
    if (typeof b.caja_id !== 'string' || !UUID_RE.test(b.caja_id)) throw new Reject(400, 'invalid_body', 'caja_id debe ser un uuid');
    cajaId = b.caja_id.toLowerCase();
  }
  if (sinConteo) {
    if (b.confirmo_cierre_sin_conteo !== true) throw new Reject(400, 'confirmation_required', 'El cierre sin conteo exige confirmo_cierre_sin_conteo:true');
    if (obs.length < 5) throw new Reject(400, 'invalid_body', 'observaciones es obligatoria (minimo 5 caracteres) en el cierre sin conteo');
    if (denoms && !denoms.empty) throw new Reject(400, 'invalid_body', 'El cierre sin conteo no admite denominaciones');
  } else if (denoms && !denoms.empty && denoms.total !== countedC) {
    throw new Reject(400, 'invalid_body', `Las denominaciones suman $${dollars(denoms.total).toFixed(2)} y efectivo_contado es $${dollars(countedC).toFixed(2)}`);
  }

  const prior = await findByRequest(tenantId, sid);
  if (prior) {
    const fc = finalOf(prior);
    if (cents(fc.counted_total) !== countedC || (fc.sin_conteo === true) !== sinConteo) throw new Reject(409, 'request_id_reused', 'id_solicitud ya se uso con otros datos', { cierre: shapeCierre(prior, fc, true) });
    return send(res, 200, { ok: true, repetido: true, correo_pendiente: true, cierre: shapeCierre(prior, fc, true) });
  }

  const opens = (await sb(`cash_register?tenant_id=eq.${tenantId}&status=eq.open&order=created_at.desc,id.desc&select=${REG_COLS}&limit=10`)) || [];
  if (opens.length === 0) {
    const last = (await sb(`cash_register?tenant_id=eq.${tenantId}&status=eq.closed&order=created_at.desc,id.desc&select=${REG_COLS}&limit=1`)) || [];
    const lastFc = last[0] ? finalOf(last[0]) : null;
    throw new Reject(409, 'no_open_register', 'No hay una caja abierta', { ultimo_cierre: last[0] && lastFc && lastFc.counted_total !== undefined ? shapeCierre(last[0], lastFc, false) : null });
  }
  if (opens.length > 1) throw new Reject(409, 'multiple_open_registers', 'Hay mas de una caja abierta; resuelvelo desde la app', { cajas: opens.map(registerBrief) });
  const reg = opens[0];
  if (cajaId && String(reg.id).toLowerCase() !== cajaId) throw new Reject(409, 'register_mismatch', 'La caja abierta no es la indicada en caja_id', { caja_abierta: registerBrief(reg) });

  const startMs = Date.parse(reg.created_at);
  if (!Number.isFinite(startMs)) throw new Reject(409, 'register_invalid', 'La caja abierta no tiene hora de apertura valida', { caja_abierta: registerBrief(reg) });
  const nowMs = Date.now();
  const all = await fetchAll(
    `transaction?tenant_id=eq.${tenantId}&is_deleted=eq.false&created_at=gte.${new Date(startMs).toISOString()}&created_at=lt.${new Date(nowMs + 1).toISOString()}&order=created_at.asc,id.asc&select=${TX_COLS}`,
    20000
  );
  if (all.truncated) throw new Reject(409, 'transactions_truncated', 'Hay demasiados movimientos en el turno para calcular el efectivo esperado con seguridad');
  const openingC = cents(reg.opening_balance);
  const s = summarize(all.rows, nowMs);
  const expectedC = openingC + s.cash - s.cashExpenses;
  const reading = cents(shiftTotals(all.rows, openingC).efectivo_esperado);
  if (reading !== expectedC) throw new Reject(409, 'calculation_mismatch', 'El efectivo esperado no coincide entre los dos calculos; no se cierra', { esperado_cierre: dollars(expectedC), esperado_lectura: dollars(reading) });
  const diffC = countedC - expectedC;
  const closedAt = new Date(nowMs).toISOString();
  const closedBy = quien ? `${quien} (${API_ACTOR})` : API_ACTOR;
  const observations = sinConteo ? `SIN CONTEO: ${obs}` : obs;
  const profit = s.revenue - s.expenses;
  const byMethod = Object.fromEntries(Object.entries(s.byMethod).map(([k, v]) => [k, dollars(v)]));
  const finalCount = {
    denominations: sinConteo || !denoms ? {} : denoms.payload,
    counted_total: dollars(countedC),
    expected_cash: dollars(expectedC),
    difference: dollars(diffC),
    total_revenue: dollars(s.revenue),
    total_cash: dollars(s.cash),
    total_card: dollars(s.card),
    total_ath: dollars(s.ath),
    total_expenses: dollars(s.expenses),
    total_cash_expenses: dollars(s.cashExpenses),
    total_cash_refunds: dollars(s.cashRefunds),
    real_profit: dollars(profit),
    revenue_by_method: byMethod,
    sale_count: s.sales,
    observations,
    closed_at: closedAt,
    mode: modalidad,
    sin_conteo: sinConteo,
    request_id: sid,
    source: 'jaime_api',
    closed_via: API_ACTOR,
    actor,
  };
  if (sinConteo) finalCount.sin_conteo_confirmado = true;
  const fields = {
    status: 'closed',
    closing_balance: dollars(countedC),
    total_revenue: dollars(s.revenue),
    total_expenses: dollars(s.expenses),
    net_profit: dollars(profit),
    last_movement_at: closedAt,
    closed_by: closedBy,
    final_count: finalCount,
  };
  const updated = await sb(`cash_register?id=eq.${reg.id}&tenant_id=eq.${tenantId}&status=eq.open&select=${REG_COLS}`, { method: 'PATCH', body: fields, prefer: 'return=representation' });
  if (!updated || !updated[0]) {
    const now = (await sb(`cash_register?id=eq.${reg.id}&tenant_id=eq.${tenantId}&select=${REG_COLS}&limit=1`)) || [];
    const cur = now[0];
    const curFc = cur ? finalOf(cur) : null;
    if (cur && String(cur.status).toLowerCase() !== 'open') {
      if (curFc?.request_id === sid) return send(res, 200, { ok: true, repetido: true, correo_pendiente: true, cierre: shapeCierre(cur, curFc, true) });
      throw new Reject(409, 'register_already_closed', 'La caja ya fue cerrada por otra via', { cierre: curFc && curFc.counted_total !== undefined ? shapeCierre(cur, curFc, false) : { id: cur.id, cerrada_por: cur.closed_by || null } });
    }
    throw new Reject(502, 'upstream_error', 'No se pudo cerrar la caja');
  }
  audit('cierre-caja', { id: reg.id, id_solicitud: sid, modalidad, contado: dollars(countedC), esperado: dollars(expectedC), diferencia: dollars(diffC), cerrado_por: closedBy });
  const row = updated[0];
  return send(res, 200, { ok: true, repetido: false, correo_pendiente: true, cierre: shapeCierre({ ...reg, ...row, closed_by: closedBy }, finalCount, false) });
}

const ROUTES = {
  ponches: ponchar,
  'caja/cerrar': cerrarCaja,
};

export async function escrituraRoute(parts, req, res, tenantId, actor) {
  const key = parts.join('/');
  if (!Object.prototype.hasOwnProperty.call(ROUTES, key)) return false;
  try {
    await ROUTES[key](req, res, tenantId, actor || 'Jaime');
  } catch (e) {
    if (e instanceof Reject) {
      send(res, e.status, { ok: false, error: e.message, code: e.code, ...e.extra });
      return true;
    }
    throw e;
  }
  return true;
}
