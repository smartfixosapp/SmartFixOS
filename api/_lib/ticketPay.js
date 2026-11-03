import { TERMINAL, UUID_RE, money } from './muse.js';
import { ORIGENES, formActor } from './ticketForm.js';
import { loadTenantPos, readMetodo, METODO_INVALIDO, cashRegisterState } from './posForm.js';

const MAX_MONTO = 100000;
const MAX_NOTA = 300;
const MAX_PAGOS = 10;
const NO_REGISTER = 'No hay una caja abierta. Abre la caja desde otro equipo.';
const BUILTIN_IDS = { efectivo: 'efectivo', cash: 'efectivo', tarjeta: 'tarjeta', card: 'tarjeta', ath_movil: 'ath_movil', transferencia: 'transferencia' };

function bad(error, code = 'invalid_body', status = 400, extra = {}) {
  return { status, body: { ok: false, error, code, ...extra } };
}

function present(v) {
  return v !== undefined && v !== null && v !== '';
}

export function readTicketRef(raw) {
  let value = '';
  try {
    value = decodeURIComponent(String(raw || '')).trim();
  } catch {
    return null;
  }
  return /^[A-Za-z0-9-]{1,40}$/.test(value) ? value : null;
}

export function ticketSaldo(t) {
  const total = money(t.total_facturado);
  const cobrado = money(t.cobrado);
  const registrado = money(t.balance_pendiente);
  if (registrado > 0) return registrado;
  return total > 0 ? money(Math.max(0, total - cobrado)) : 0;
}

export function collectable(t) {
  if (TERMINAL.includes(t.estatus)) return { puede: false, motivo: `El boleto esta ${String(t.estatus_nombre || t.estatus).toLowerCase()}; no se le pueden registrar pagos.` };
  if (ticketSaldo(t) <= 0.004) return { puede: false, motivo: 'El boleto no tiene balance pendiente; no hay nada que cobrar.' };
  return { puede: true };
}

function boletoOut(t) {
  return { numero: t.numero, total: money(t.total_facturado), cobrado: money(t.cobrado), saldo: ticketSaldo(t), estatus: t.estatus };
}

async function loadTicket(numero, actor, deps) {
  const r = await deps.callApi('GET', `tickets/${encodeURIComponent(numero)}`, {}, actor);
  if (r.status === 404) return { error: bad('Boleto no encontrado', 'not_found', 404) };
  const t = r.body?.ticket;
  if (r.status !== 200 || !r.body?.ok || !t) return { error: { status: 502, body: { ok: false, error: r.body?.error || 'No se pudo leer el boleto', code: 'upstream_error' } } };
  return { ticket: t };
}

export async function ticketCharge({ numero, actor }, deps) {
  const ref = readTicketRef(numero);
  if (!ref) return bad('numero de boleto invalido', 'invalid_query');
  const { ticket: t, error } = await loadTicket(ref, actor, deps);
  if (error) return error;
  const c = collectable(t);
  const boleto = {
    numero: t.numero,
    id: t.id,
    cliente: { nombre: t.cliente || null, telefono: t.telefono || null, email: t.email || null },
    equipo: t.equipo || null,
    estatus: t.estatus,
    estatus_nombre: t.estatus_nombre,
    total: money(t.total_facturado),
    cobrado: money(t.cobrado),
    saldo: ticketSaldo(t),
  };
  const pagos = (Array.isArray(t.pagos) ? t.pagos : [])
    .filter((p) => p && p.tipo === 'revenue')
    .slice(0, MAX_PAGOS)
    .map((p) => ({ id: p.id, monto: money(p.monto), metodo: p.metodo || null, fecha: p.fecha || null, nota: p.descripcion || null }));
  const body = { ok: true, boleto, pagos, puede_cobrar: c.puede };
  if (!c.puede) body.motivo = c.motivo;
  return { status: 200, body };
}

export function readPayForm(b, customMethods = []) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('Cuerpo JSON requerido');
  const origen = String(b.origen || '').toLowerCase();
  if (!ORIGENES[origen]) throw bad('origen debe ser ios o android');
  let requestId = '';
  if (present(b.id_cliente_solicitud)) {
    requestId = String(b.id_cliente_solicitud).trim().toLowerCase();
    if (!UUID_RE.test(requestId)) throw bad('id_cliente_solicitud debe ser un uuid');
  }
  if (typeof b.monto !== 'number' || !Number.isFinite(b.monto) || b.monto <= 0 || b.monto > MAX_MONTO) throw bad(`monto debe ser un numero mayor que 0 y hasta ${MAX_MONTO}`);
  const monto = money(b.monto);
  if (monto <= 0) throw bad('monto debe ser mayor que 0');
  const pago = readMetodo(b.metodo, customMethods);
  if (!pago) throw bad(METODO_INVALIDO);
  let montoRecibido;
  if (pago.metodo === 'efectivo' && present(b.monto_recibido)) {
    if (typeof b.monto_recibido !== 'number' || !Number.isFinite(b.monto_recibido) || b.monto_recibido <= 0 || b.monto_recibido > 1000000) throw bad('monto_recibido invalido');
    montoRecibido = money(b.monto_recibido);
    if (montoRecibido < monto) throw bad(`monto_recibido ($${montoRecibido.toFixed(2)}) es menor que el monto a cobrar ($${monto.toFixed(2)})`);
  }
  let nota = '';
  if (present(b.nota)) {
    if (typeof b.nota !== 'string') throw bad('nota debe ser texto');
    nota = b.nota.trim().replace(/\s+/g, ' ');
    if (nota.length > MAX_NOTA) throw bad(`nota demasiado larga (max ${MAX_NOTA})`);
  }
  if (present(b.notificar_cliente) && typeof b.notificar_cliente !== 'boolean') throw bad('notificar_cliente debe ser true o false');
  return { origen, requestId, monto, metodo: pago.metodo, metodoId: pago.id, metodoEtiqueta: pago.metodoEtiqueta, montoRecibido, nota, notificar: b.notificar_cliente !== false };
}

async function findPayRequest(deps, tenantId, requestId) {
  try {
    const rows = await deps.sb(`assistant_payment_requests?tenant_id=eq.${tenantId}&request_id=eq.${requestId}&select=order_id,pago_id&limit=1`);
    return { available: true, row: rows?.[0] || null };
  } catch (e) {
    console.warn('assistant_payment_requests no disponible, pago sin idempotencia:', e.message);
    return { available: false, row: null };
  }
}

async function savePayRequest(deps, tenantId, requestId, orderId, pagoId) {
  try {
    await deps.sb('assistant_payment_requests', { method: 'POST', body: { tenant_id: tenantId, request_id: requestId, order_id: String(orderId), pago_id: pagoId ? String(pagoId) : null }, prefer: 'return=minimal' });
  } catch (e) {
    console.warn('no se pudo guardar la solicitud de pago:', e.message);
  }
}

async function repeatedPayment(deps, tenantId, row, ticket) {
  let pago = null;
  if (row.pago_id) {
    try {
      const rows = await deps.sb(`transaction?tenant_id=eq.${tenantId}&id=eq.${encodeURIComponent(row.pago_id)}&select=id,amount,payment_method,created_at&limit=1`);
      const tx = rows?.[0];
      if (tx) pago = { id: tx.id, monto: money(tx.amount), metodo: tx.payment_method || null, fecha: tx.created_at || null };
    } catch (e) {
      console.warn('no se pudo leer el pago repetido:', e.message);
    }
  }
  return {
    status: 200,
    body: {
      ok: true,
      repetido: true,
      pago: pago || { id: row.pago_id || null },
      boleto: ticket ? boletoOut(ticket) : null,
      recibo: { enviado: false, motivo: 'solicitud repetida; no se envio otro recibo' },
      avisos: [],
    },
  };
}

function reciboOf(body) {
  const n = body?.notificacion || {};
  if (body?.notificacion_enviada === true) return { enviado: true, canal: 'correo' };
  return { enviado: false, motivo: String(n.motivo || 'no se envio el recibo') };
}

export async function payTicketFromForm({ numero, body, label, tenantId }, deps) {
  const ref = readTicketRef(numero);
  if (!ref) return bad('numero de boleto invalido');
  let tenantPos = null;
  try {
    tenantPos = await loadTenantPos(deps, tenantId);
  } catch (e) {
    console.warn('configuracion del taller no disponible para el cobro:', e.message);
  }
  const rawMetodo = body && typeof body === 'object' ? String(body.metodo || '').trim().toLowerCase() : '';
  if (!tenantPos && rawMetodo && !BUILTIN_IDS[rawMetodo]) {
    return { status: 502, body: { ok: false, error: 'No se pudieron leer los metodos de pago del taller; intenta de nuevo', code: 'upstream_error' } };
  }
  let form;
  try {
    form = readPayForm(body, tenantPos ? tenantPos.metodos : []);
  } catch (e) {
    if (e && e.status && e.body) return e;
    throw e;
  }
  const actor = formActor(label, form.origen);

  let idem = { available: false, row: null };
  if (form.requestId) idem = await findPayRequest(deps, tenantId, form.requestId);

  const { ticket: t, error } = await loadTicket(ref, actor, deps);
  if (idem.row) return repeatedPayment(deps, tenantId, idem.row, t || null);
  if (error) return error;
  const c = collectable(t);
  if (!c.puede) return bad(c.motivo, 'not_collectable', 409);
  const saldo = ticketSaldo(t);
  if (form.monto > saldo + 0.004) return bad(`El monto ($${form.monto.toFixed(2)}) es mayor que el balance pendiente ($${saldo.toFixed(2)}); no se puede cobrar de mas.`, 'over_balance', 409, { saldo });

  let caja;
  try {
    caja = await cashRegisterState({ tenantId }, deps);
  } catch (e) {
    console.warn('estado de caja no disponible:', e.message);
    return { status: 502, body: { ok: false, error: 'No se pudo revisar la caja; intenta de nuevo', code: 'upstream_error' } };
  }
  if (!caja.body?.abierta) return { status: 409, body: { ok: false, code: 'no_open_register', error: NO_REGISTER } };

  const input = { numero: t.numero, monto: form.monto, metodo: form.metodo };
  if (form.nota) input.nota = form.nota;
  if (!form.notificar) input.notificar_cliente = false;
  const query = {};
  if (form.metodoEtiqueta) query.metodo_etiqueta = form.metodoEtiqueta;
  if (form.nota.length > 150) query.nota_larga = '1';
  if (form.requestId && idem.available) query.sin_filtro_duplicados = '1';

  const r = Object.keys(query).length ? await deps.registrarPago(input, actor, query) : await deps.registrarPago(input, actor);
  if (r.status === 404) return bad('Boleto no encontrado', 'not_found', 404);
  if (r.status === 409 && ['closed', 'already_paid'].includes(r.body?.code)) return bad(r.body.error, 'not_collectable', 409);
  if (r.status === 400) return bad(r.body?.error || 'Datos del pago invalidos');
  if (r.status !== 200 || !r.body?.ok) return { status: r.status && r.status !== 200 ? r.status : 502, body: { ok: false, error: r.body?.error || 'No se pudo registrar el pago', code: r.body?.code || 'upstream_error' } };

  const boleto = r.body.ticket ? boletoOut(r.body.ticket) : boletoOut(t);
  if (r.body.duplicado === true) {
    return {
      status: 200,
      body: { ok: true, duplicado: true, pago: null, boleto, recibo: reciboOf(r.body), avisos: [r.body.nota || 'Ya habia un pago identico en los ultimos 2 minutos; no se registro otro.'] },
    };
  }
  const p = r.body.pago || {};
  if (form.requestId && idem.available) await savePayRequest(deps, tenantId, form.requestId, t.id, p.id);
  const out = {
    ok: true,
    pago: { id: p.id || null, monto: money(p.monto), metodo: form.metodoId, fecha: p.fecha || null },
    boleto,
    repetido: false,
    recibo: reciboOf(r.body),
    avisos: [],
  };
  if (form.metodo === 'efectivo' && form.montoRecibido !== undefined) out.cambio = money(form.montoRecibido - money(p.monto));
  return { status: 200, body: out };
}
