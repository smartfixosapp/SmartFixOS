import { UUID_RE, cleanFilter, money } from './muse.js';
import { ORIGENES, formActor } from './ticketForm.js';

const PAGE_SIZE = 30;
const MAX_ITEMS = 30;
const MAX_CANTIDAD = 100;
const MAX_PRECIO = 100000;
const METODOS = { efectivo: 'efectivo', cash: 'efectivo', tarjeta: 'tarjeta', card: 'tarjeta', ath_movil: 'ath_movil', transferencia: 'transferencia' };
const NO_REGISTER = 'No hay una caja abierta. Abre la caja desde otro equipo.';

function bad(error, code = 'invalid_body', status = 400) {
  return { status, body: { ok: false, error, code } };
}

function upstream(r, fallback) {
  const status = r.status && r.status !== 200 ? r.status : 502;
  return { status, body: { ok: false, error: r.body?.error || fallback, code: r.body?.code || 'upstream_error' } };
}

function present(v) {
  return v !== undefined && v !== null && v !== '';
}

export async function posProductList({ q, pagina, actor }, deps) {
  const rawPage = Array.isArray(pagina) ? pagina[0] : pagina;
  const page = present(rawPage) ? Number(rawPage) : 1;
  if (!Number.isInteger(page) || page < 1 || page > 1000) return bad('pagina debe ser un entero entre 1 y 1000', 'invalid_query');
  const term = cleanFilter(String(Array.isArray(q) ? q[0] : q || '')).replace(/[&#?+]/g, ' ').replace(/\s+/g, ' ').trim();
  const r = await deps.callApi('GET', 'pos/productos', { query: { q: term, pagina: page, limite: PAGE_SIZE } }, actor);
  if (r.status !== 200 || !r.body?.ok) return upstream(r, 'No se pudo leer el inventario');
  const raw = r.body.productos || [];
  const list = raw.filter((p) => p.tipo === 'servicio' || p.stock === null || Number(p.stock) > 0);
  const withVariants = new Set();
  const ids = list.filter((p) => p.tipo !== 'servicio').map((p) => p.id).filter((id) => UUID_RE.test(String(id)));
  if (ids.length) {
    try {
      const rows = await deps.sb(`product_variant?product_id=in.(${ids.join(',')})&select=product_id&limit=1000`);
      for (const row of rows || []) withVariants.add(row.product_id);
    } catch (e) {
      console.warn('variantes de productos no disponibles:', e.message);
    }
  }
  const productos = list.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    precio_sin_ivu: p.precio,
    precio_con_ivu: p.gravable === false ? p.precio : deps.withIvu(p.precio),
    stock: p.stock,
    tipo: p.tipo,
    categoria: p.categoria || null,
    tiene_variantes: withVariants.has(p.id),
  }));
  return { status: 200, body: { ok: true, pagina: page, productos, hay_mas: raw.length >= PAGE_SIZE } };
}

export async function cashRegisterState({ tenantId }, deps) {
  const rows = await deps.sb(`cash_register?tenant_id=eq.${tenantId}&status=eq.open&select=*&limit=1`);
  const reg = rows?.[0];
  if (!reg) return { status: 200, body: { ok: true, abierta: false } };
  const body = { ok: true, abierta: true };
  const por = reg.opened_by || reg.created_by || null;
  const desde = reg.created_date || reg.created_at || reg.opened_at || reg.date || null;
  if (por) body.abierta_por = String(por);
  if (desde) body.desde = String(desde);
  return { status: 200, body };
}

export function readSaleForm(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('Cuerpo JSON requerido');
  const origen = String(b.origen || '').toLowerCase();
  if (!ORIGENES[origen]) throw bad('origen debe ser ios o android');
  let requestId = '';
  if (present(b.id_cliente_solicitud)) {
    requestId = String(b.id_cliente_solicitud).trim().toLowerCase();
    if (!UUID_RE.test(requestId)) throw bad('id_cliente_solicitud debe ser un uuid');
  }
  const metodo = METODOS[String(b.metodo || '').trim().toLowerCase()];
  if (!metodo) throw bad('metodo invalido. Validos: efectivo, tarjeta, ath_movil, transferencia (o cash, card)');
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > MAX_ITEMS) throw bad(`items debe tener entre 1 y ${MAX_ITEMS} lineas`);
  const items = b.items.map((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad(`items[${i}] invalido`);
    const productoId = typeof raw.producto_id === 'string' ? raw.producto_id.trim() : '';
    if (!UUID_RE.test(productoId)) throw bad(`items[${i}].producto_id debe ser el id del producto`);
    const cantidad = present(raw.cantidad) ? raw.cantidad : 1;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) throw bad(`items[${i}].cantidad debe ser un entero entre 1 y ${MAX_CANTIDAD}`);
    const line = { producto_id: productoId, cantidad };
    if (present(raw.precio)) {
      const precio = Number(raw.precio);
      if (typeof raw.precio === 'boolean' || !Number.isFinite(precio) || precio < 0 || precio > MAX_PRECIO) throw bad(`items[${i}].precio debe ser un numero entre 0 y ${MAX_PRECIO}`);
      line.precio = money(precio);
    }
    if (present(raw.descuento_pct)) {
      const d = Number(raw.descuento_pct);
      if (typeof raw.descuento_pct === 'boolean' || !Number.isFinite(d) || d < 0 || d > 100) throw bad(`items[${i}].descuento_pct debe estar entre 0 y 100`);
      if (d > 0) line.descuento_pct = d;
    }
    return line;
  });
  let montoRecibido;
  if (metodo === 'efectivo') {
    if (!present(b.monto_recibido)) throw bad('monto_recibido es requerido en efectivo');
    montoRecibido = Number(b.monto_recibido);
    if (typeof b.monto_recibido === 'boolean' || !Number.isFinite(montoRecibido) || montoRecibido <= 0 || montoRecibido > 1000000) throw bad('monto_recibido invalido');
    montoRecibido = money(montoRecibido);
  }
  let email = '';
  if (present(b.email_cliente)) {
    if (typeof b.email_cliente !== 'string') throw bad('email_cliente debe ser texto');
    email = b.email_cliente.trim().toLowerCase();
    if (email.length > 120) throw bad('email_cliente demasiado largo (max 120)');
  }
  let notas = '';
  if (present(b.notas)) {
    if (typeof b.notas !== 'string') throw bad('notas debe ser texto');
    notas = b.notas.trim().replace(/\s+/g, ' ');
    if (notas.length > 300) throw bad('notas demasiado largo (max 300)');
  }
  return { origen, requestId, metodo, items, montoRecibido, email, notas };
}

async function findPosRequest(deps, tenantId, requestId) {
  try {
    const rows = await deps.sb(`assistant_pos_requests?tenant_id=eq.${tenantId}&request_id=eq.${requestId}&select=venta_numero&limit=1`);
    return { available: true, numero: rows?.[0]?.venta_numero || null };
  } catch (e) {
    console.warn('assistant_pos_requests no disponible, venta sin idempotencia:', e.message);
    return { available: false, numero: null };
  }
}

async function savePosRequest(deps, tenantId, requestId, numero) {
  try {
    await deps.sb('assistant_pos_requests', { method: 'POST', body: { tenant_id: tenantId, request_id: requestId, venta_numero: numero }, prefer: 'return=minimal' });
  } catch (e) {
    console.warn('no se pudo guardar la solicitud de venta:', e.message);
  }
}

async function existingSale(deps, tenantId, numero) {
  const venta = { numero };
  try {
    const rows = await deps.sb(`sale?tenant_id=eq.${tenantId}&sale_number=eq.${encodeURIComponent(numero)}&select=sale_number,subtotal,tax_amount,total,change_due,payment_method&limit=1`);
    const s = rows?.[0];
    if (s) {
      venta.total = money(s.total);
      venta.subtotal = money(s.subtotal);
      venta.ivu = money(s.tax_amount);
      if (s.payment_method === 'cash') venta.cambio = money(s.change_due);
    }
  } catch (e) {
    console.warn('no se pudo leer la venta repetida:', e.message);
  }
  return venta;
}

export async function createSaleFromForm({ body, label, tenantId }, deps) {
  let form;
  try {
    form = readSaleForm(body);
  } catch (e) {
    if (e && e.status && e.body) return e;
    throw e;
  }
  const actor = formActor(label, form.origen);

  let idem = { available: false, numero: null };
  if (form.requestId) {
    idem = await findPosRequest(deps, tenantId, form.requestId);
    if (idem.numero) return { status: 200, body: { ok: true, venta: await existingSale(deps, tenantId, idem.numero), repetido: true } };
  }

  const input = { items: form.items, metodo: form.metodo };
  if (form.montoRecibido !== undefined) input.monto_recibido = form.montoRecibido;
  if (form.email) input.email_cliente = form.email;
  if (form.notas) input.notas = form.notas;

  const r = await deps.ventaMostrador(input, actor);
  if (r.status === 409 && r.body?.code === 'no_open_register') return { status: 409, body: { ok: false, code: 'no_open_register', error: NO_REGISTER } };
  if (r.status !== 200 || !r.body?.ok) return upstream(r, 'No se pudo registrar la venta');
  const v = r.body.venta || {};
  if (form.requestId && idem.available && v.numero) await savePosRequest(deps, tenantId, form.requestId, v.numero);
  const venta = { numero: v.numero, total: v.total };
  if (v.subtotal !== undefined) venta.subtotal = v.subtotal;
  if (v.iva !== undefined) venta.ivu = v.iva;
  if (form.metodo === 'efectivo' && v.cambio !== undefined) venta.cambio = v.cambio;
  return {
    status: 200,
    body: {
      ok: true,
      venta,
      repetido: false,
      duplicado: r.body.duplicado === true,
      notificacion_enviada: r.body.notificacion_enviada === true,
      avisos: Array.isArray(r.body.avisos) ? r.body.avisos : [],
    },
  };
}
