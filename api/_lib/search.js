import { TERMINAL, money } from './muse.js';
import { ticketResumen, posProductShape, POS_COLUMNS } from './jaime.js';
import { splitName } from './ticketForm.js';

const MAX_PER_GROUP = 8;
const FETCH_LIMIT = 60;
const MAX_TOKENS = 4;
const PHONE_MIN = 4;
const TIPOS = ['boletos', 'clientes', 'piezas'];
const TICKET_COLUMNS = 'id,order_number,status,status_note,customer_name,customer_phone,customer_email,device_type,device_brand,device_model,device_family,device_color,device_serial,initial_problem,cost_estimate,labor_cost,amount_paid,balance_due,created_date,updated_date';
const TICKET_COLUMNS_BASIC = 'id,order_number,status,status_note,customer_name,customer_phone,device_type,device_brand,device_model,device_color,cost_estimate,labor_cost,amount_paid,balance_due,created_date,updated_date';
const TICKET_TEXT = ['order_number', 'customer_name', 'customer_email', 'device_brand', 'device_model', 'device_family', 'device_color', 'device_serial', 'device_type', 'initial_problem', 'status_note'];
const TICKET_TEXT_BASIC = ['order_number', 'customer_name', 'device_brand', 'device_model', 'device_color', 'device_type', 'status_note'];
const CUSTOMER_TEXT = ['name', 'email'];
const PRODUCT_TEXT = ['name', 'sku', 'barcode', 'device_brand', 'device_model_tag', 'category'];
const ACCENTS = { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', n: 'ñ' };
const MAX_VARIANTS = 8;
const TICKET_ACCENT = ['customer_name', 'initial_problem', 'device_color', 'status_note'];
const CUSTOMER_ACCENT = ['name'];
const PRODUCT_ACCENT = ['name', 'category'];

export function readTipos(raw) {
  const value = Array.isArray(raw) ? raw.join(',') : String(raw || '');
  const wanted = value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return [...TIPOS];
  const unknown = wanted.filter((t) => !TIPOS.includes(t));
  if (unknown.length) return { error: `tipos invalido: ${unknown.join(', ')}. Validos: ${TIPOS.join(', ')}` };
  return [...new Set(wanted)];
}

export function fold(s) {
  return String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '');

export function ticketQuery(term) {
  const wo = /^w\s*o\s*-?\s*(\d+)$/i.exec(String(term || '').trim());
  return wo ? `WO-${wo[1]}` : term;
}

export function searchTokens(raw) {
  let text = fold(raw).replace(/\bw\s*o\s*-?\s*(\d+)\b/g, ' wo-$1 ');
  text = text.replace(/[^a-z0-9@.\-+()\s]/g, ' ').trim();
  if (!text) return [];
  if (/^[\d\s\-+().]+$/.test(text) && onlyDigits(text).length >= 2) return [{ kind: 'digits', value: onlyDigits(text) }];
  const out = [];
  for (const piece of text.split(/\s+/)) {
    const wo = /^wo-(\d+)$/.exec(piece);
    if (wo) { out.push({ kind: 'order', value: wo[1] }); continue; }
    if (/^[\d\-+().]+$/.test(piece) && onlyDigits(piece)) { out.push({ kind: 'digits', value: onlyDigits(piece) }); continue; }
    const word = piece.replace(/[()+]/g, '').replace(/^[.\-]+|[.\-]+$/g, '');
    if (word) out.push({ kind: 'text', value: word });
  }
  const useful = out.length > 1 ? out.filter((t) => t.kind !== 'text' || t.value.length > 1) : out;
  const seen = new Set();
  return useful.filter((t) => {
    const key = `${t.kind}:${t.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, MAX_TOKENS);
}

const quoted = (pattern) => `"${pattern}"`;
export function accentVariants(word) {
  const out = [];
  if (word.length < 3 || !/^[a-z]+$/.test(word)) return out;
  for (let i = 0; i < word.length && out.length < MAX_VARIANTS; i += 1) {
    const mark = ACCENTS[word[i]];
    if (mark) out.push(word.slice(0, i) + mark + word.slice(i + 1));
  }
  if (word.includes('u') && out.length < MAX_VARIANTS) out.push(word.replace('u', 'ü'));
  return out;
}
const spaced = (digits) => `*${digits.split('').join('*')}*`;

function tokenClauses(token, textFields, phoneField, accentFields = []) {
  if (token.kind === 'order') return textFields.includes('order_number') ? [`order_number.ilike.${quoted(`*${token.value}*`)}`] : [];
  if (token.kind === 'digits') {
    const list = textFields.map((f) => `${f}.ilike.${quoted(`*${token.value}*`)}`);
    if (phoneField && token.value.length >= PHONE_MIN) list.push(`${phoneField}.ilike.${quoted(spaced(token.value))}`);
    return list;
  }
  const list = textFields.map((f) => `${f}.ilike.${quoted(`*${token.value}*`)}`);
  const variants = accentVariants(token.value);
  for (const f of accentFields.filter((x) => textFields.includes(x))) for (const v of variants) list.push(`${f}.ilike.${quoted(`*${v}*`)}`);
  return list;
}

export function tokenFilter(tokens, textFields, phoneField, accentFields = []) {
  const groups = tokens.map((t) => tokenClauses(t, textFields, phoneField, accentFields)).filter((g) => g.length);
  if (groups.length !== tokens.length || !groups.length) return null;
  return `and=(${groups.map((g) => `or(${g.join(',')})`).join(',')})`;
}

export function rowMatches(row, tokens, textFields, phoneField) {
  const hay = textFields.map((f) => fold(row[f])).join(' \u0001 ');
  const textDigits = textFields.map((f) => onlyDigits(row[f])).filter(Boolean);
  const phoneDigits = phoneField ? onlyDigits(row[phoneField]) : '';
  return tokens.every((t) => {
    if (t.kind === 'order') return onlyDigits(row.order_number).includes(t.value);
    if (t.kind === 'digits') return hay.includes(t.value) || textDigits.some((d) => d.includes(t.value)) || (t.value.length >= PHONE_MIN && phoneDigits.includes(t.value));
    return hay.includes(t.value);
  });
}

function missingColumn(e) {
  return e && e.status === 400 && /column|42703|does not exist/i.test(String(e.message || ''));
}

async function filtered(deps, base, tokens, { fields, phone = null, accents = [] }, select, order) {
  const filter = tokenFilter(tokens, fields, phone, accents);
  if (!filter) return [];
  const rows = await deps.sb(`${base}&${encodeURI(filter)}&select=${select}&order=${order}&limit=${FETCH_LIMIT}`);
  return (rows || []).filter((row) => rowMatches(row, tokens, fields, phone));
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

export function sortTickets(list, exactNumber = null) {
  const exact = (t) => (exactNumber && onlyDigits(t.numero) === exactNumber ? 0 : 1);
  const open = (t) => (TERMINAL.includes(t.estatus) ? 1 : 0);
  return [...list].sort((a, b) => exact(a) - exact(b) || open(a) - open(b) || String(b.ultima_actualizacion || '').localeCompare(String(a.ultima_actualizacion || '')));
}

async function searchTickets(tokens, { tenantId }, deps) {
  const base = `order?tenant_id=eq.${tenantId}&is_deleted=eq.false`;
  let rows;
  try {
    rows = await filtered(deps, base, tokens, { fields: TICKET_TEXT, phone: 'customer_phone', accents: TICKET_ACCENT }, TICKET_COLUMNS, 'updated_date.desc');
  } catch (e) {
    if (!missingColumn(e)) throw e;
    console.warn('busqueda de boletos con columnas basicas:', e.message);
    rows = await filtered(deps, base, tokens, { fields: TICKET_TEXT_BASIC, phone: 'customer_phone', accents: TICKET_ACCENT }, TICKET_COLUMNS_BASIC, 'updated_date.desc');
  }
  const numbers = tokens.filter((t) => t.kind !== 'text').map((t) => t.value);
  const exactNumber = tokens.length === 1 && numbers.length === 1 ? numbers[0] : null;
  const notes = new Map(rows.map((r) => [r.id, r.status_note]));
  return sortTickets(rows.map(ticketResumen), exactNumber).slice(0, MAX_PER_GROUP).map((t) => ticketOut(t, notes.get(t.id)));
}

async function customerBalances(deps, tenantId, ids) {
  const counts = new Map();
  const balances = new Map();
  if (!ids.length) return { counts, balances, ok: true };
  try {
    const rows = await deps.sb(`order?tenant_id=eq.${tenantId}&is_deleted=eq.false&customer_id=in.(${ids.join(',')})&select=customer_id,status,balance_due&limit=5000`);
    for (const row of rows || []) {
      counts.set(row.customer_id, (counts.get(row.customer_id) || 0) + 1);
      if (!TERMINAL.includes(row.status)) balances.set(row.customer_id, money((balances.get(row.customer_id) || 0) + (Number(row.balance_due) || 0)));
    }
    return { counts, balances, ok: true };
  } catch (e) {
    console.warn('conteo de boletos por cliente fallo:', e.message);
    return { counts, balances, ok: false };
  }
}

async function searchClients(tokens, { tenantId }, deps) {
  const usable = tokens.map((t) => (t.kind === 'order' ? null : t));
  if (usable.some((t) => !t)) return [];
  const rows = await filtered(deps, `customer?tenant_id=eq.${tenantId}`, usable, { fields: CUSTOMER_TEXT, phone: 'phone', accents: CUSTOMER_ACCENT }, 'id,name,phone,email', 'name.asc');
  const list = rows.slice(0, MAX_PER_GROUP);
  const { counts, balances, ok } = await customerBalances(deps, tenantId, list.map((c) => c.id));
  return list.map((c) => {
    const { nombre, apellido } = splitName(c.name);
    const out = { id: c.id, nombre, apellido, telefono: c.phone || null, email: c.email || null, boletos: counts.get(c.id) || 0 };
    if (ok) out.saldo_pendiente = balances.get(c.id) || 0;
    return out;
  });
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

async function searchPieces(tokens, { tenantId }, deps) {
  const usable = tokens.map((t) => (t.kind === 'order' ? null : t));
  if (usable.some((t) => !t)) return [];
  const rows = await filtered(deps, `product?tenant_id=eq.${tenantId}&active=eq.true`, usable, { fields: PRODUCT_TEXT, accents: PRODUCT_ACCENT }, POS_COLUMNS, 'name.asc');
  return rows.slice(0, MAX_PER_GROUP).map((row) => pieceOut(posProductShape(row), deps.withIvu));
}

export async function universalSearch({ q, tipos, tenantId }, deps) {
  const wanted = readTipos(tipos);
  if (wanted.error) return { status: 400, body: { ok: false, error: wanted.error, code: 'invalid_query' } };
  const empty = { ok: true, boletos: [], clientes: [], piezas: [] };
  const raw = String(Array.isArray(q) ? q[0] : q || '').trim().slice(0, 80);
  const tokens = searchTokens(raw);
  const size = tokens.reduce((n, t) => n + t.value.length, 0);
  if (raw.length < 2 || size < 2) return { status: 200, body: empty };
  const runners = { boletos: searchTickets, clientes: searchClients, piezas: searchPieces };
  const ctx = { tenantId };
  const results = await Promise.all(wanted.map((tipo) => runners[tipo](tokens, ctx, deps).then(
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
