import { SB_URL, UUID_RE, TERMINAL, money, validEmail } from './muse.js';

const MAX_RESULTS = 10;
const MAX_FOTOS = 10;
export const ORIGENES = { ios: 'iOS', android: 'Android' };

function bad(error, code = 'invalid_body', status = 400) {
  return { status, body: { ok: false, error, code } };
}

function text(value, label, { max = 120, required = false } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw bad(`${label} debe ser texto`);
  const t = value.trim().replace(/\s+/g, ' ');
  if (required && !t) throw bad(`${label} es requerido`);
  if (t.length > max) throw bad(`${label} demasiado largo (max ${max})`);
  return t;
}

export function phoneDigits(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  return d;
}

export function splitName(full) {
  const parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  return { nombre: parts[0] || '', apellido: parts.slice(1).join(' ') };
}

function deviceLabel(o) {
  return [o.device_brand, o.device_model, o.device_color].filter(Boolean).join(' ') || o.device_type || null;
}

export function formActor(label, origen) {
  const user = String(label || '').replace(/^Asistente IA\s*-?\s*/i, '').trim();
  return `${user || 'Usuario'} - App ${ORIGENES[origen] || 'movil'}`;
}

export async function searchCustomers({ q, actor, tenantId, saldo = false }, deps) {
  const query = String(q || '').trim().slice(0, 60);
  if (query.length < 2) return { status: 200, body: { ok: true, clientes: [] } };
  const r = await deps.callApi('GET', 'clientes', { query: { q: query, limite: MAX_RESULTS } }, actor);
  if (r.status !== 200 || !r.body?.ok) return { status: r.status === 200 ? 502 : r.status, body: { ok: false, error: r.body?.error || 'No se pudo buscar clientes', code: r.body?.code || 'upstream_error' } };
  const list = (r.body.clientes || []).slice(0, MAX_RESULTS);
  const counts = new Map();
  const balances = new Map();
  let balancesOk = false;
  if (list.length) {
    try {
      const ids = list.map((c) => c.id).filter((id) => UUID_RE.test(String(id)));
      const select = saldo ? 'customer_id,status,balance_due' : 'customer_id';
      const rows = ids.length ? await deps.sb(`order?tenant_id=eq.${tenantId}&is_deleted=eq.false&customer_id=in.(${ids.join(',')})&select=${select}&limit=5000`) : [];
      for (const row of rows || []) {
        counts.set(row.customer_id, (counts.get(row.customer_id) || 0) + 1);
        if (saldo && !TERMINAL.includes(row.status)) balances.set(row.customer_id, money((balances.get(row.customer_id) || 0) + (Number(row.balance_due) || 0)));
      }
      balancesOk = saldo;
    } catch (e) {
      console.warn('conteo de boletos por cliente fallo:', e.message);
    }
  }
  const clientes = list.map((c) => {
    const { nombre, apellido } = splitName(c.nombre);
    const out = { id: c.id, nombre, apellido, telefono: c.telefono || null, email: c.email || null, boletos: counts.get(c.id) || 0 };
    if (balancesOk) out.saldo_pendiente = balances.get(c.id) || 0;
    return out;
  });
  return { status: 200, body: { ok: true, clientes } };
}

async function customerById(deps, tenantId, id) {
  const rows = await deps.sb(`customer?tenant_id=eq.${tenantId}&id=eq.${id}&select=id,name,phone,email&limit=1`);
  return rows?.[0] || null;
}

async function customerByPhone(deps, tenantId, digits) {
  const pattern = `*${digits.slice(0, 3)}*${digits.slice(3, 6)}*${digits.slice(6)}*`;
  const rows = await deps.sb(`customer?tenant_id=eq.${tenantId}&phone=ilike.${encodeURIComponent(pattern)}&select=id,name,phone,email&order=name.asc&limit=10`);
  return (rows || []).find((c) => phoneDigits(c.phone) === digits) || null;
}

export const REQUEST_STALE_MS = 3 * 60_000;
export const REQUEST_WAIT_TRIES = 4;
export const REQUEST_WAIT_MS = 750;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nowMs = (deps) => (typeof deps.now === 'function' ? deps.now() : Date.now());
const requestPath = (tenantId, requestId) => `assistant_ticket_requests?tenant_id=eq.${tenantId}&request_id=eq.${requestId}`;

function isDuplicateError(e) {
  return !!e && (e.status === 409 || e.code === '23505' || /duplicate key|unique/i.test(String(e.message || '')));
}

async function findRequest(deps, tenantId, requestId) {
  try {
    const rows = await deps.sb(`${requestPath(tenantId, requestId)}&select=order_id&limit=1`);
    return { available: true, orderId: rows?.[0]?.order_id || null };
  } catch (e) {
    console.warn('assistant_ticket_requests no disponible, boleto sin idempotencia:', e.message);
    return { available: false, orderId: null };
  }
}

async function saveRequest(deps, tenantId, requestId, orderId) {
  try {
    await deps.sb('assistant_ticket_requests', { method: 'POST', body: { tenant_id: tenantId, request_id: requestId, order_id: orderId }, prefer: 'return=minimal' });
  } catch (e) {
    if (isDuplicateError(e)) console.warn('carrera en solicitud de boleto: otro envio guardo la misma llave primero; revisar boleto repetido', requestId);
    else console.warn('no se pudo guardar la solicitud de boleto:', e.message);
  }
}

async function reserveRequest(deps, tenantId, requestId) {
  const rows = await deps.sb('assistant_ticket_requests?on_conflict=tenant_id,request_id', {
    method: 'POST',
    body: { tenant_id: tenantId, request_id: requestId, order_id: null, estado: 'creando', actualizado_en: new Date(nowMs(deps)).toISOString() },
    prefer: 'resolution=ignore-duplicates,return=representation',
  });
  return Array.isArray(rows) && rows.length > 0;
}

async function takeOverRequest(deps, tenantId, requestId) {
  const now = nowMs(deps);
  const cutoff = new Date(now - REQUEST_STALE_MS).toISOString();
  const rows = await deps.sb(`${requestPath(tenantId, requestId)}&order_id=is.null&or=(estado.eq.fallido,and(estado.eq.creando,actualizado_en.lt.${cutoff}))`, {
    method: 'PATCH',
    body: { estado: 'creando', actualizado_en: new Date(now).toISOString() },
    prefer: 'return=representation',
  });
  return Array.isArray(rows) && rows.length > 0;
}

async function finishRequest(deps, tenantId, requestId, patch) {
  try {
    await deps.sb(`${requestPath(tenantId, requestId)}&order_id=is.null&estado=eq.creando`, {
      method: 'PATCH',
      body: { ...patch, actualizado_en: new Date(nowMs(deps)).toISOString() },
      prefer: 'return=minimal',
    });
  } catch (e) {
    console.warn('no se pudo cerrar la reserva de la solicitud de boleto:', requestId, e.message);
  }
}

function repeatedResponse(prev) {
  return { status: 200, body: { ok: true, boleto: prev, cliente_existente: true, repetido: true, duplicado: false, notificacion_enviada: false, avisos: [] } };
}

async function withIntakeRetry(response, deps) {
  const orderId = response?.body?.boleto?.id;
  const again = response?.body?.repetido === true || response?.body?.duplicado === true;
  if (typeof deps.correoIngreso !== 'function' || !again || !orderId) return response;
  let correo;
  try {
    correo = await deps.correoIngreso(orderId);
  } catch (e) {
    correo = { enviada: false, codigo: 'fallo_envio', motivo: String(e?.message || e) };
  }
  return { ...response, body: { ...response.body, notificacion_enviada: correo?.enviada === true, notificacion: correo } };
}

async function claimRequest(deps, tenantId, requestId) {
  if (await reserveRequest(deps, tenantId, requestId)) return { owner: true };
  const wait = typeof deps.sleep === 'function' ? deps.sleep : sleep;
  for (let i = 0; i < REQUEST_WAIT_TRIES; i++) {
    const rows = await deps.sb(`${requestPath(tenantId, requestId)}&select=order_id,estado,actualizado_en&limit=1`);
    const row = rows?.[0];
    if (!row) {
      if (await reserveRequest(deps, tenantId, requestId)) return { owner: true };
    } else if (row.order_id) {
      const prev = await existingTicket(deps, tenantId, row.order_id);
      if (prev) return { response: repeatedResponse(prev) };
      return { response: bad('La solicitud ya creo un boleto que no esta disponible; usa un id_cliente_solicitud nuevo', 'request_order_missing', 409) };
    } else {
      const stale = row.estado === 'creando' && Date.parse(row.actualizado_en || '') < nowMs(deps) - REQUEST_STALE_MS;
      if ((row.estado === 'fallido' || stale) && (await takeOverRequest(deps, tenantId, requestId))) return { owner: true };
    }
    if (i < REQUEST_WAIT_TRIES - 1) await wait(REQUEST_WAIT_MS);
  }
  return { response: bad('El boleto de esta solicitud se esta creando; reintenta con el mismo id_cliente_solicitud en unos segundos', 'request_in_progress', 409) };
}

async function existingTicket(deps, tenantId, orderId) {
  const rows = await deps.sb(`order?tenant_id=eq.${tenantId}&id=eq.${orderId}&is_deleted=eq.false&select=id,order_number,customer_id,customer_name,customer_phone,customer_email,device_type,device_brand,device_model,device_color&limit=1`);
  const o = rows?.[0];
  if (!o) return null;
  return {
    numero: o.order_number,
    id: o.id,
    cliente: { id: o.customer_id || null, nombre: o.customer_name || null, telefono: o.customer_phone || null, email: o.customer_email || null },
    equipo: deviceLabel(o),
  };
}

export function readTicketForm(b, tenantId) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('Cuerpo JSON requerido');
  const origen = String(b.origen || '').toLowerCase();
  if (!ORIGENES[origen]) throw bad('origen debe ser ios o android');
  let requestId = '';
  if (b.id_cliente_solicitud !== undefined && b.id_cliente_solicitud !== null && b.id_cliente_solicitud !== '') {
    requestId = String(b.id_cliente_solicitud).trim().toLowerCase();
    if (!UUID_RE.test(requestId)) throw bad('id_cliente_solicitud debe ser un uuid');
  }
  const eq = b.equipo && typeof b.equipo === 'object' && !Array.isArray(b.equipo) ? b.equipo : null;
  if (!eq) throw bad('equipo es requerido');
  const equipo = {
    tipo: text(eq.tipo, 'equipo.tipo', { max: 40, required: true }),
    marca: text(eq.marca, 'equipo.marca', { max: 60, required: true }),
    modelo: text(eq.modelo, 'equipo.modelo', { max: 100, required: true }),
    color: text(eq.color, 'equipo.color', { max: 40 }),
  };
  const problema = text(b.problema, 'problema', { max: 1000, required: true });
  const codigo = text(b.codigo_equipo, 'codigo_equipo', { max: 60 });
  if (b.fotos !== undefined && b.fotos !== null && !Array.isArray(b.fotos)) throw bad('fotos debe ser una lista de URLs');
  const fotos = (b.fotos || []).map((u) => (typeof u === 'string' ? u.trim() : '')).filter(Boolean);
  if (fotos.length > MAX_FOTOS) throw bad(`maximo ${MAX_FOTOS} fotos`);
  const prefix = `${SB_URL}/storage/v1/object/public/uploads/tenants/${tenantId}/`;
  if (fotos.some((u) => !u.startsWith(prefix) || u.length > 600 || /\.\.|[\s?#]/.test(u.slice(prefix.length)))) {
    throw bad('fotos solo acepta URLs publicas del bucket uploads bajo tenants/{tenant}/');
  }
  let clienteId = '';
  let cliente = null;
  if (b.cliente_id !== undefined && b.cliente_id !== null && b.cliente_id !== '') {
    clienteId = String(b.cliente_id).trim();
    if (!UUID_RE.test(clienteId)) throw bad('cliente_id invalido');
  } else {
    const c = b.cliente && typeof b.cliente === 'object' && !Array.isArray(b.cliente) ? b.cliente : null;
    if (!c) throw bad('cliente_id o cliente es requerido');
    const telefono = phoneDigits(text(c.telefono, 'cliente.telefono', { max: 30, required: true }));
    if (telefono.length !== 10) throw bad('cliente.telefono debe tener 10 digitos');
    const email = text(c.email, 'cliente.email', { max: 120 }).toLowerCase();
    if (email && (!validEmail(email) || /[^\x00-\x7F]/.test(email))) throw bad('cliente.email invalido (solo caracteres basicos, sin acentos)');
    cliente = {
      nombre: text(c.nombre, 'cliente.nombre', { max: 60, required: true }),
      apellido: text(c.apellido, 'cliente.apellido', { max: 60, required: true }),
      telefono,
      email,
    };
  }
  return { origen, requestId, equipo, problema, codigo, fotos, clienteId, cliente };
}

export async function createTicketFromForm({ body, label, tenantId }, deps) {
  let form;
  try {
    form = readTicketForm(body, tenantId);
  } catch (e) {
    if (e && e.status && e.body) return e;
    throw e;
  }
  const actor = formActor(label, form.origen);

  let existing = null;
  if (form.clienteId) {
    existing = await customerById(deps, tenantId, form.clienteId);
    if (!existing) return bad('Cliente no encontrado', 'not_found', 404);
  } else {
    existing = await customerByPhone(deps, tenantId, form.cliente.telefono);
  }

  let mode = 'none';
  let idem = { available: false, orderId: null };
  if (form.requestId) {
    let claim = null;
    try {
      claim = await claimRequest(deps, tenantId, form.requestId);
    } catch (e) {
      console.warn('reserva atomica de solicitud no disponible, se usa el camino anterior:', e.code || '', e.message);
    }
    if (claim && claim.response) return withIntakeRetry(claim.response, deps);
    if (claim && claim.owner) {
      mode = 'atomic';
    } else {
      mode = 'legacy';
      idem = await findRequest(deps, tenantId, form.requestId);
      if (idem.orderId) {
        const prev = await existingTicket(deps, tenantId, idem.orderId);
        if (prev) return withIntakeRetry(repeatedResponse(prev), deps);
      }
    }
  }

  const typedName = form.cliente ? `${form.cliente.nombre} ${form.cliente.apellido}` : '';
  const input = {
    cliente: (existing && String(existing.name || '').trim()) || typedName,
    telefono: (existing && existing.phone) || (form.cliente ? form.cliente.telefono : ''),
    email: (form.cliente && form.cliente.email) || (existing && existing.email) || '',
    equipo: `${form.equipo.marca} ${form.equipo.modelo}`,
    marca: form.equipo.marca,
    modelo: form.equipo.modelo,
    problema: form.problema,
  };
  if (existing) input.cliente_id = existing.id;
  if (form.equipo.color) input.color = form.equipo.color;
  if (form.codigo) input.codigo_equipo = form.codigo;
  if (form.fotos.length) input.fotos = form.fotos;
  if (!input.email) delete input.email;
  if (!input.telefono) delete input.telefono;

  let r;
  try {
    r = await deps.crearBoleto(input, actor);
  } catch (e) {
    if (mode === 'atomic') await finishRequest(deps, tenantId, form.requestId, { estado: 'fallido' });
    throw e;
  }
  if (r.status !== 200 || !r.body?.ok) {
    if (mode === 'atomic') await finishRequest(deps, tenantId, form.requestId, { estado: 'fallido' });
    const status = r.status && r.status !== 200 ? r.status : 502;
    return { status, body: { ok: false, error: r.body?.error || 'No se pudo crear el boleto', code: r.body?.code || 'upstream_error' } };
  }
  const t = r.body.ticket || {};
  const orderId = t.id;
  if (mode === 'atomic') {
    if (orderId) await finishRequest(deps, tenantId, form.requestId, { order_id: orderId, estado: 'listo' });
    else await finishRequest(deps, tenantId, form.requestId, { estado: 'fallido' });
  } else if (mode === 'legacy' && idem.available && orderId) {
    await saveRequest(deps, tenantId, form.requestId, orderId);
  }
  return withIntakeRetry({
    status: 200,
    body: {
      ok: true,
      boleto: {
        numero: r.body.numero || t.numero,
        id: orderId,
        cliente: { id: r.body.cliente_id || (existing && existing.id) || null, nombre: t.cliente || input.cliente, telefono: t.telefono || null, email: t.email || null },
        equipo: t.equipo || input.equipo,
      },
      cliente_existente: r.body.duplicado === true ? true : r.body.cliente_nuevo === false,
      repetido: false,
      duplicado: r.body.duplicado === true,
      notificacion_enviada: r.body.notificacion_enviada === true,
      ...(r.body.notificacion ? { notificacion: r.body.notificacion } : {}),
      avisos: Array.isArray(r.body.avisos) ? r.body.avisos : [],
    },
  }, deps);
}
