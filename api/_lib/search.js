import { TERMINAL, UUID_RE, cleanFilter } from './muse.js';
import { ticketResumen, posProductShape, POS_COLUMNS } from './jaime.js';
import { searchCustomers } from './ticketForm.js';

const MAX_PER_GROUP = 8;
const TIPOS = ['boletos', 'clientes', 'piezas'];
const TICKET_COLUMNS = 'id,order_number,status,status_note,customer_name,customer_phone,device_type,device_brand,device_model,device_color,cost_estimate,labor_cost,amount_paid,balance_due,created_date,updated_date';

export function readTipos(raw) {
  const value = Array.isArray(raw) ? raw.join(',') : String(raw || '');
  const wanted = value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return [...TIPOS];
  const unknown = wanted.filter((t) => !TIPOS.includes(t));
  if (unknown.length) return { error: `tipos invalido: ${unknown.join(', ')}. Validos: ${TIPOS.join(', ')}` };
  return [...new Set(wanted)];
}

function digitsPattern(digits) {
  return `*${digits.split('').join('*')}*`;
}

export function ticketQuery(term) {
  const wo = /^w\s*o\s*-?\s*(\d+)$/i.exec(term);
  return wo ? `WO-${wo[1]}` : term;
}

function ticketOut(t, note) {
  const out = {
    numero: t.numero,
    id: t.id,
    cliente: t.cliente || null,
    telefono: t.telefono || null,
    equipo: t.equipo || null,
    estatus: t.estatus,
    estatus_nombre: t.estatus_nombre,
    actualizado: t.ultima_actualizacion || t.fecha_creacion || null,
  };
  const n = typeof note === 'string' ? note.trim() : '';
  if (n) out.ultima_nota = n.slice(0, 200);
  return out;
}

export function sortTickets(list) {
  const open = (t) => (TERMINAL.includes(t.estatus) ? 1 : 0);
  return [...list].sort((a, b) => open(a) - open(b) || String(b.ultima_actualizacion || '').localeCompare(String(a.ultima_actualizacion || '')));
}

async function searchTickets(term, { actor, tenantId }, deps) {
  const apiQuery = ticketQuery(term);
  const digits = term.replace(/\D/g, '');
  const clauses = [`device_brand.ilike.*${term}*`, `device_model.ilike.*${term}*`, `device_serial.ilike.*${term}*`];
  if (digits.length >= 4) clauses.push(`customer_phone.ilike.${digitsPattern(digits)}`);
  const [api, extra] = await Promise.all([
    deps.callApi('GET', 'tickets', { query: { q: apiQuery, estatus: 'todos', limite: 40 } }, actor),
    deps.sb(`order?tenant_id=eq.${tenantId}&is_deleted=eq.false&or=(${clauses.join(',')})&select=${TICKET_COLUMNS}&order=updated_date.desc&limit=24`).then(
      (rows) => ({ ok: true, rows: rows || [] }),
      (e) => ({ ok: false, error: e.message }),
    ),
  ]);
  const apiOk = api.status === 200 && api.body?.ok;
  if (!apiOk && !extra.ok) throw new Error(api.body?.error || extra.error || 'busqueda de boletos fallo');
  if (!apiOk) console.warn('busqueda de boletos por API fallo:', api.body?.error || api.status);
  if (!extra.ok) console.warn('busqueda de boletos por equipo fallo:', extra.error);
  const notes = new Map();
  const byId = new Map();
  for (const t of apiOk ? api.body.tickets || [] : []) byId.set(t.id, t);
  for (const row of extra.ok ? extra.rows : []) {
    notes.set(row.id, row.status_note);
    if (!byId.has(row.id)) byId.set(row.id, ticketResumen(row));
  }
  const top = sortTickets([...byId.values()]).slice(0, MAX_PER_GROUP);
  const missing = top.map((t) => t.id).filter((id) => !notes.has(id) && UUID_RE.test(String(id)));
  if (missing.length) {
    try {
      const rows = await deps.sb(`order?tenant_id=eq.${tenantId}&id=in.(${missing.join(',')})&select=id,status_note`);
      for (const row of rows || []) notes.set(row.id, row.status_note);
    } catch (e) {
      console.warn('notas de boletos no disponibles:', e.message);
    }
  }
  return top.map((t) => ticketOut(t, notes.get(t.id)));
}

async function searchClients(term, { actor, tenantId }, deps) {
  const r = await searchCustomers({ q: term, actor, tenantId, saldo: true }, deps);
  if (r.status !== 200 || !r.body?.ok) throw new Error(r.body?.error || 'busqueda de clientes fallo');
  return r.body.clientes.slice(0, MAX_PER_GROUP);
}

export function pieceOut(p, withIvu) {
  const out = {
    id: p.id,
    nombre: p.nombre,
    precio_sin_ivu: p.precio,
    precio_con_ivu: p.gravable === false ? p.precio : withIvu(p.precio),
    stock: p.stock,
  };
  if (p.categoria) out.categoria = p.categoria;
  out.vendible_pos = Boolean(p.tipo_pos);
  if (p.tipo_pos) out.tipo_pos = p.tipo_pos;
  return out;
}

async function searchPieces(term, { actor, tenantId }, deps) {
  const [api, extra] = await Promise.all([
    deps.callApi('GET', 'pos/productos', { query: { q: term, limite: MAX_PER_GROUP } }, actor),
    deps.sb(`product?tenant_id=eq.${tenantId}&active=eq.true&or=(device_brand.ilike.*${term}*,device_model_tag.ilike.*${term}*)&select=${POS_COLUMNS}&order=name.asc&limit=${MAX_PER_GROUP}`).then(
      (rows) => ({ ok: true, rows: rows || [] }),
      (e) => ({ ok: false, error: e.message }),
    ),
  ]);
  const apiOk = api.status === 200 && api.body?.ok;
  if (!apiOk && !extra.ok) throw new Error(api.body?.error || extra.error || 'busqueda de piezas fallo');
  if (!apiOk) console.warn('busqueda de piezas por API fallo:', api.body?.error || api.status);
  if (!extra.ok) console.warn('busqueda de piezas por marca o modelo fallo:', extra.error);
  const byId = new Map();
  for (const p of apiOk ? api.body.productos || [] : []) byId.set(p.id, p);
  for (const row of extra.ok ? extra.rows : []) if (!byId.has(row.id)) byId.set(row.id, posProductShape(row));
  return [...byId.values()].slice(0, MAX_PER_GROUP).map((p) => pieceOut(p, deps.withIvu));
}

export async function universalSearch({ q, tipos, actor, tenantId }, deps) {
  const wanted = readTipos(tipos);
  if (wanted.error) return { status: 400, body: { ok: false, error: wanted.error, code: 'invalid_query' } };
  const empty = { ok: true, boletos: [], clientes: [], piezas: [] };
  const raw = String(Array.isArray(q) ? q[0] : q || '').trim();
  const term = cleanFilter(raw).replace(/[&#?+]/g, ' ').replace(/\s+/g, ' ').trim();
  if (raw.length < 2 || term.length < 2) return { status: 200, body: empty };
  const runners = { boletos: searchTickets, clientes: searchClients, piezas: searchPieces };
  const ctx = { actor, tenantId };
  const results = await Promise.all(wanted.map((tipo) => runners[tipo](term, ctx, deps).then(
    (list) => ({ tipo, list }),
    (e) => ({ tipo, list: [], error: e }),
  )));
  const body = { ...empty };
  const avisos = [];
  for (const r of results) {
    body[r.tipo] = r.list;
    if (r.error) {
      console.warn(`busqueda universal de ${r.tipo} fallo:`, r.error.message);
      avisos.push(`No se pudo buscar ${r.tipo}; intenta de nuevo.`);
    }
  }
  if (avisos.length) body.avisos = avisos;
  return { status: 200, body };
}
