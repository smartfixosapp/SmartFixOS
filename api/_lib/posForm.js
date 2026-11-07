import { UUID_RE, cleanFilter, money } from './muse.js';
import { ORIGENES, formActor } from './ticketForm.js';
import { posKind } from './jaime.js';

const PAGE_SIZE = 30;
const POS_TIPOS = { accesorios: ['accesorio'], dispositivos: ['dispositivo'], ambos: ['accesorio', 'dispositivo'] };
export const NOT_FOR_POS = 'Este articulo es una pieza o servicio y no se vende en el POS; agregalo al boleto.';
const MAX_ITEMS = 30;
const MAX_CANTIDAD = 100;
const MAX_PRECIO = 100000;
const MAX_PAGOS = 6;
const MAX_MONTO = 1000000;
const MAX_NOMBRE_MANUAL = 120;
const METODOS = { efectivo: 'efectivo', cash: 'efectivo', tarjeta: 'tarjeta', card: 'tarjeta', ath_movil: 'ath_movil', transferencia: 'transferencia' };
const NO_REGISTER = 'No hay una caja abierta. Abre la caja desde otro equipo.';
export const DEFAULT_IVA = 0.115;
const UMBRAL_CONFIRMACION = 500;
const DESCUENTO_MAX_EMPLEADO = 20;
const CUSTOM_COLOR = '#D9A61A';
const BUILTIN_METHODS = [
  { id: 'efectivo', etiqueta: 'Efectivo', tipo: 'efectivo', flag: 'cash', qr: 'cashQR', color: '#34C759', alias: ['efectivo', 'cash'] },
  { id: 'tarjeta', etiqueta: 'Tarjeta', tipo: 'tarjeta', flag: 'card', qr: 'cardQR', color: '#007AFF', alias: ['tarjeta', 'card'] },
  { id: 'ath_movil', etiqueta: 'ATH Móvil', tipo: 'ath_movil', flag: 'ath', qr: 'athQR', color: '#ED4A17', alias: ['ath_movil', 'ath'] },
];
const BRANDS = [
  [['applepay'], '#000000'],
  [['googlepay', 'gpay'], '#4285F5'],
  [['samsungpay'], '#144FF2'],
  [['cashapp', 'cash app', '$cashtag'], '#00D633'],
  [['paypal', 'paypalme'], '#003087'],
  [['venmo'], '#3D94CF'],
  [['zelle'], '#6E1FD4'],
  [['athempresarial', 'athbusiness', 'athbiz'], '#F56B0F'],
  [['athmovil', 'ath'], '#F58C1A'],
  [['yappy'], '#1A4DA6'],
  [['nequi'], '#F20080'],
  [['daviplata'], '#D91A33'],
  [['bizum'], '#0FB575'],
  [['wise', 'transferwise'], '#9EE045'],
  [['mercadopago', 'mpago'], '#F5C72E'],
  [['stripe'], '#7357F0'],
  [['squarecash', 'square'], '#000000'],
  [['banktech'], '#F56B0F'],
  [['evertec'], '#0D59A6'],
  [['revolut'], '#000000'],
  [['wechatpay', 'wechat'], '#0DC963'],
  [['alipay'], '#009EE8'],
  [['bitcoin', 'btc', 'cripto', 'crypto'], '#F5941A'],
  [['transferencia', 'wire', 'ach'], '#4D73B3', 'transferencia'],
  [['cheque', 'check'], '#8C8C8C'],
];

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

export function readPosTipo(raw) {
  const value = String(Array.isArray(raw) ? raw[0] : raw ?? '').trim().toLowerCase();
  if (!value) return 'ambos';
  return POS_TIPOS[value] ? value : null;
}

export async function posProductList({ q, pagina, tipo, actor }, deps) {
  const rawPage = Array.isArray(pagina) ? pagina[0] : pagina;
  const page = present(rawPage) ? Number(rawPage) : 1;
  if (!Number.isInteger(page) || page < 1 || page > 1000) return bad('pagina debe ser un entero entre 1 y 1000', 'invalid_query');
  const posTipo = readPosTipo(tipo);
  if (!posTipo) return bad('tipo invalido. Validos: accesorios, dispositivos, ambos', 'invalid_query');
  const term = cleanFilter(String(Array.isArray(q) ? q[0] : q || '')).replace(/[&#?+]/g, ' ').replace(/\s+/g, ' ').trim();
  const r = await deps.callApi('GET', 'pos/productos', { query: { q: term, pagina: page, limite: PAGE_SIZE, pos_tipo: posTipo } }, actor);
  if (r.status !== 200 || !r.body?.ok) return upstream(r, 'No se pudo leer el inventario');
  const raw = r.body.productos || [];
  const allowed = POS_TIPOS[posTipo];
  const list = raw.filter((p) => allowed.includes(p.tipo_pos) && (p.stock === null || Number(p.stock) > 0));
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
    tipo_pos: p.tipo_pos,
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

function obj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function normalizeLabel(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[ \-_.]/g, '');
}

function brandFor(label) {
  const key = normalizeLabel(label);
  if (!key) return null;
  const row = BRANDS.find(([needles]) => needles.includes(key) || needles.some((n) => key.includes(n)));
  return row ? { color: row[1], tipo: row[2] || null } : null;
}

function validQr(v) {
  const q = obj(v);
  if (!q) return false;
  return ['imageBase64', 'paymentURL'].every((k) => q[k] === undefined || q[k] === null || typeof q[k] === 'string');
}

function qrOf(v) {
  if (!validQr(v)) return null;
  const image = typeof v.imageBase64 === 'string' ? v.imageBase64.replace(/\s+/g, '') : '';
  if (image) return { image };
  const url = typeof v.paymentURL === 'string' ? v.paymentURL.trim() : '';
  if (url) return { url };
  return null;
}

function customList(raw) {
  if (!Array.isArray(raw)) return [];
  const valid = raw.every((c) => obj(c) && typeof c.id === 'string' && typeof c.label === 'string' && typeof c.enabled === 'boolean' && (c.qr === undefined || c.qr === null || validQr(c.qr)));
  return valid ? raw : [];
}

export function taxRateFrom(v) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  const rate = Number((n / 100).toFixed(6));
  return rate >= 0 && rate <= 0.5 ? rate : null;
}

function receiptChannels(v) {
  const r = obj(v);
  const ok = r && typeof r.sale_subject === 'string' && typeof r.order_subject === 'string' && ['send_email', 'send_whatsapp', 'send_print'].every((k) => typeof r[k] === 'boolean');
  return ok ? { email: r.send_email, whatsapp: r.send_whatsapp, pdf: r.send_print } : { email: true, whatsapp: true, pdf: true };
}

export function tenantPosSettings(row) {
  const pm = obj(row?.payment_methods) || {};
  const flag = (k) => (typeof pm[k] === 'boolean' ? pm[k] : true);
  const athHidden = pm.athHidden === true;
  let builtins = BUILTIN_METHODS.filter((m) => flag(m.flag) && !(m.flag === 'ath' && athHidden));
  if (!builtins.length) builtins = BUILTIN_METHODS;
  const metodos = builtins.map((m) => ({ id: m.id, etiqueta: m.etiqueta, tipo: m.tipo, color: m.color, alias: m.alias, qr: qrOf(pm[m.qr]), custom: false }));
  for (const c of customList(pm.custom)) {
    if (!c.enabled) continue;
    const brand = brandFor(c.label);
    metodos.push({ id: c.id, etiqueta: c.label, tipo: brand?.tipo || 'personalizado', color: brand?.color || CUSTOM_COLOR, alias: [], qr: qrOf(c.qr), custom: true });
  }
  const tienda = { nombre: String(row?.name || '').trim() || 'Mi taller' };
  const telefono = String(row?.admin_phone || '').trim();
  if (telefono) tienda.telefono = telefono;
  return { ivaTasa: taxRateFrom(row?.tax_rate), metodos, canales: receiptChannels(row?.pos_recibo), tienda };
}

export async function loadTenantPos(deps, tenantId) {
  if (!UUID_RE.test(String(tenantId || ''))) throw new Error('tenant invalido');
  const rows = await deps.sb(`tenant?id=eq.${tenantId}&select=name,admin_phone,tax_rate:settings->tax_rate,payment_methods:settings->payment_methods,pos_recibo:settings->pos_recibo&limit=1`);
  return tenantPosSettings(rows?.[0] || null);
}

function findMethod(metodos, raw) {
  const key = String(raw || '').trim().toLowerCase();
  if (!key) return null;
  return metodos.find((m) => (m.custom ? m.id.toLowerCase() === key : m.alias.includes(key))) || null;
}

async function capabilities(deps) {
  let splitReady = false;
  try {
    await deps.sb('sale?select=payments&limit=1');
    splitReady = true;
  } catch (e) {
    console.warn('pago dividido desactivado, falta la columna sale.payments:', e.message);
  }
  return { articulo_manual: true, pago_dividido: splitReady, cliente_en_venta: true, descuento_venta: true };
}

export async function posConfig({ tenantId }, deps) {
  let cfg;
  try {
    cfg = await loadTenantPos(deps, tenantId);
  } catch (e) {
    console.warn('configuracion del POS no disponible:', e.message);
    return { status: 502, body: { ok: false, error: 'No se pudo leer la configuracion del taller', code: 'upstream_error' } };
  }
  return {
    status: 200,
    body: {
      ok: true,
      iva_tasa: cfg.ivaTasa ?? DEFAULT_IVA,
      metodos: cfg.metodos.map((m) => ({ id: m.id, etiqueta: m.etiqueta, tipo: m.tipo, tiene_qr: Boolean(m.qr), color: m.color })),
      canales_recibo: cfg.canales,
      umbral_confirmacion: UMBRAL_CONFIRMACION,
      descuento_max_empleado: DESCUENTO_MAX_EMPLEADO,
      tienda: cfg.tienda,
      capacidades: await capabilities(deps),
    },
  };
}

function imageMime(b64) {
  if (b64.startsWith('iVBOR')) return 'image/png';
  if (b64.startsWith('R0lGOD')) return 'image/gif';
  if (b64.startsWith('UklGR')) return 'image/webp';
  return 'image/jpeg';
}

export async function posQr({ tenantId, metodo }, deps) {
  const raw = String(Array.isArray(metodo) ? metodo[0] : metodo || '').trim();
  if (!raw || raw.length > 80) return bad('metodo es requerido (id del metodo de pago)', 'invalid_query');
  let cfg;
  try {
    cfg = await loadTenantPos(deps, tenantId);
  } catch (e) {
    console.warn('configuracion del POS no disponible:', e.message);
    return { status: 502, body: { ok: false, error: 'No se pudo leer la configuracion del taller', code: 'upstream_error' } };
  }
  const m = findMethod(cfg.metodos, raw);
  if (!m) return bad('Ese metodo de pago no existe o no esta activo en el taller', 'not_found', 404);
  if (!m.qr) return bad(`${m.etiqueta} no tiene un QR configurado. Se configura en Ajustes > Metodos de pago.`, 'not_found', 404);
  if (m.qr.image) return { status: 200, body: { ok: true, tipo: 'imagen', imagen_url: `data:${imageMime(m.qr.image)};base64,${m.qr.image}`, mime: imageMime(m.qr.image), nombre_tienda: cfg.tienda.nombre } };
  return { status: 200, body: { ok: true, tipo: 'url', url: m.qr.url, nombre_tienda: cfg.tienda.nombre } };
}

export const METODO_INVALIDO = 'metodo invalido. Validos: efectivo, tarjeta, ath_movil, transferencia (o cash, card) o el id de un metodo personalizado activo del taller';

export function readMetodo(raw, customMethods = []) {
  const metodoRaw = String(raw || '').trim().toLowerCase();
  if (!metodoRaw) return null;
  if (METODOS[metodoRaw]) return { id: METODOS[metodoRaw], metodo: METODOS[metodoRaw], metodoEtiqueta: '' };
  const custom = customMethods.find((m) => m.custom && m.id.toLowerCase() === metodoRaw);
  if (!custom) return null;
  const metodoEtiqueta = custom.etiqueta.trim().replace(/\s+/g, ' ').slice(0, 60);
  return metodoEtiqueta ? { id: custom.id, metodo: 'ath_movil', metodoEtiqueta } : null;
}

function cleanManualName(v) {
  return String(v).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2060\ufeff<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE_MANUAL);
}

function exactCents(v) {
  return Math.abs(v * 100 - Math.round(v * 100)) <= 1e-6;
}

function readPagos(raw, customMethods) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_PAGOS) throw bad(`pagos debe tener entre 1 y ${MAX_PAGOS} metodos`);
  const seen = new Set();
  return raw.map((p, i) => {
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw bad(`pagos[${i}] invalido`);
    const pago = readMetodo(p.metodo, customMethods);
    if (!pago) throw bad(`pagos[${i}].metodo: ${METODO_INVALIDO}`);
    if (seen.has(pago.id)) throw bad('Un metodo de pago no puede repetirse en la misma venta');
    seen.add(pago.id);
    const monto = p.monto;
    if (typeof monto !== 'number' || !Number.isFinite(monto) || monto <= 0 || monto > MAX_MONTO) throw bad(`pagos[${i}].monto debe ser un numero mayor a cero`);
    if (!exactCents(monto)) throw bad(`pagos[${i}].monto no puede tener mas de 2 decimales`);
    const entry = { metodo: pago.metodo, etiqueta: pago.metodoEtiqueta, monto: money(monto) };
    if (present(p.recibido)) {
      const recibido = p.recibido;
      if (typeof recibido !== 'number' || !Number.isFinite(recibido) || recibido <= 0 || recibido > MAX_MONTO) throw bad(`pagos[${i}].recibido invalido`);
      if (!exactCents(recibido)) throw bad(`pagos[${i}].recibido no puede tener mas de 2 decimales`);
      if (pago.metodo !== 'efectivo' && money(recibido) !== entry.monto) throw bad(`pagos[${i}].recibido solo aplica a efectivo`);
      if (money(recibido) < entry.monto) throw bad(`pagos[${i}].recibido es menor al monto`);
      entry.recibido = money(recibido);
    }
    return entry;
  });
}

export function readSaleForm(b, customMethods = []) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('Cuerpo JSON requerido');
  const origen = String(b.origen || '').toLowerCase();
  if (!ORIGENES[origen]) throw bad('origen debe ser ios o android');
  let requestId = '';
  if (present(b.id_cliente_solicitud)) {
    requestId = String(b.id_cliente_solicitud).trim().toLowerCase();
    if (!UUID_RE.test(requestId)) throw bad('id_cliente_solicitud debe ser un uuid');
  }
  const hasPagos = present(b.pagos);
  let pagos = null;
  let metodo = '';
  let metodoEtiqueta = '';
  if (hasPagos) {
    if (present(b.monto_recibido)) throw bad('Con pagos no envies monto_recibido; usa recibido dentro de cada pago en efectivo');
    pagos = readPagos(b.pagos, customMethods);
  } else {
    const pago = readMetodo(b.metodo, customMethods);
    if (!pago) throw bad(METODO_INVALIDO);
    metodo = pago.metodo;
    metodoEtiqueta = pago.metodoEtiqueta;
  }
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > MAX_ITEMS) throw bad(`items debe tener entre 1 y ${MAX_ITEMS} lineas`);
  const items = b.items.map((raw, i) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw bad(`items[${i}] invalido`);
    const productoId = typeof raw.producto_id === 'string' ? raw.producto_id.trim() : '';
    const manual = !present(raw.producto_id) && present(raw.nombre);
    if (!manual && !UUID_RE.test(productoId)) throw bad(`items[${i}].producto_id debe ser el id del producto`);
    const cantidad = present(raw.cantidad) ? raw.cantidad : 1;
    if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > MAX_CANTIDAD) throw bad(`items[${i}].cantidad debe ser un entero entre 1 y ${MAX_CANTIDAD}`);
    let line;
    if (manual) {
      if (typeof raw.nombre !== 'string') throw bad(`items[${i}].nombre debe ser texto`);
      const nombre = cleanManualName(raw.nombre);
      if (!nombre) throw bad(`items[${i}].nombre es requerido en un articulo manual`);
      if (typeof raw.precio !== 'number' || !Number.isFinite(raw.precio) || raw.precio <= 0 || raw.precio > MAX_PRECIO) throw bad(`items[${i}].precio debe ser un numero entre 0.01 y ${MAX_PRECIO}`);
      if (present(raw.gravable) && typeof raw.gravable !== 'boolean') throw bad(`items[${i}].gravable debe ser true o false`);
      line = { manual: true, nombre, precio: money(raw.precio), cantidad, gravable: raw.gravable !== false };
    } else {
      line = { producto_id: productoId, cantidad };
    }
    if (!manual && present(raw.precio)) {
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
  if (!hasPagos && metodo === 'efectivo') {
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
  let customerId = '';
  if (present(b.customer_id)) {
    customerId = typeof b.customer_id === 'string' ? b.customer_id.trim().toLowerCase() : '';
    if (!UUID_RE.test(customerId)) throw bad('customer_id debe ser el id de un cliente');
  }
  let descuentoPct;
  let descuentoMonto;
  if (present(b.descuento_venta_pct) && present(b.descuento_venta_monto)) throw bad('Envia descuento_venta_pct o descuento_venta_monto, no los dos');
  if (present(b.descuento_venta_pct)) {
    const d = b.descuento_venta_pct;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 0 || d > 100) throw bad('descuento_venta_pct debe ser un numero entre 0 y 100');
    if (d > 0) descuentoPct = d;
  }
  if (present(b.descuento_venta_monto)) {
    const d = b.descuento_venta_monto;
    if (typeof d !== 'number' || !Number.isFinite(d) || d < 0 || d > MAX_MONTO) throw bad('descuento_venta_monto debe ser un numero mayor o igual a cero');
    if (!exactCents(d)) throw bad('descuento_venta_monto no puede tener mas de 2 decimales');
    if (d > 0) descuentoMonto = money(d);
  }
  const hasCash = hasPagos ? pagos.some((p) => p.metodo === 'efectivo') : metodo === 'efectivo';
  return { origen, requestId, metodo, metodoEtiqueta, pagos, hasCash, items, montoRecibido, email, notas, customerId, descuentoPct, descuentoMonto };
}

async function rejectNonPosItems(deps, tenantId, items) {
  const ids = [...new Set(items.filter((i) => !i.manual).map((i) => i.producto_id))];
  if (!ids.length) return null;
  let rows;
  try {
    rows = await deps.sb(`product?tenant_id=eq.${tenantId}&id=in.(${ids.join(',')})&select=id,name,type,tipo_principal,subcategoria&limit=${ids.length}`);
  } catch (e) {
    console.warn('no se pudo validar los productos de la venta:', e.message);
    return { status: 502, body: { ok: false, error: 'No se pudieron validar los productos de la venta; intenta de nuevo', code: 'upstream_error' } };
  }
  const byId = new Map((rows || []).map((p) => [String(p.id).toLowerCase(), p]));
  const rechazados = [];
  items.forEach((item, indice) => {
    if (item.manual) return;
    const p = byId.get(item.producto_id.toLowerCase());
    if (p && !posKind(p)) rechazados.push({ indice, producto_id: item.producto_id, nombre: p.name || null });
  });
  if (!rechazados.length) return null;
  return { status: 400, body: { ok: false, error: NOT_FOR_POS, code: 'invalid_body', rechazados } };
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
    const base = 'id,sale_number,subtotal,tax_amount,total,change_due,payment_method';
    const where = `sale?tenant_id=eq.${tenantId}&sale_number=eq.${encodeURIComponent(numero)}`;
    let rows;
    try {
      rows = await deps.sb(`${where}&select=${base},is_split_payment,payments,customer_id&limit=1`);
    } catch {
      rows = await deps.sb(`${where}&select=${base}&limit=1`);
    }
    const s = rows?.[0];
    if (s) {
      if (s.id) venta.id = s.id;
      venta.total = money(s.total);
      venta.subtotal = money(s.subtotal);
      venta.ivu = money(s.tax_amount);
      const split = s.is_split_payment === true;
      const payments = Array.isArray(s.payments) ? s.payments : [];
      if (s.payment_method === 'cash' || (split && (payments.some((p) => p && p.recibido !== undefined) || money(s.change_due) > 0))) venta.cambio = money(s.change_due);
      if (split) venta.dividido = true;
      if (split && payments.length) venta.pagos = payments;
      if (s.customer_id) venta.customer_id = s.customer_id;
    }
  } catch (e) {
    console.warn('no se pudo leer la venta repetida:', e.message);
  }
  return venta;
}

export async function createSaleFromForm({ body, label, tenantId }, deps) {
  let tenantPos = null;
  try {
    tenantPos = await loadTenantPos(deps, tenantId);
  } catch (e) {
    console.warn('configuracion del taller no disponible, venta con IVU por defecto:', e.message);
  }
  const wanted = body && typeof body === 'object' ? (Array.isArray(body.pagos) ? body.pagos.map((p) => p && p.metodo) : [body.metodo]) : [];
  if (!tenantPos && wanted.some((m) => present(m) && !METODOS[String(m).trim().toLowerCase()])) {
    return { status: 502, body: { ok: false, error: 'No se pudieron leer los metodos de pago del taller; intenta de nuevo', code: 'upstream_error' } };
  }
  let form;
  try {
    form = readSaleForm(body, tenantPos ? tenantPos.metodos : []);
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

  const rejected = await rejectNonPosItems(deps, tenantId, form.items);
  if (rejected) return rejected;

  const input = { items: form.items };
  if (form.pagos) input.pagos = form.pagos;
  else input.metodo = form.metodo;
  if (form.montoRecibido !== undefined) input.monto_recibido = form.montoRecibido;
  if (form.email) input.email_cliente = form.email;
  if (form.notas) input.notas = form.notas;
  if (form.customerId) input.customer_id = form.customerId;
  if (form.descuentoPct !== undefined) input.descuento_venta_pct = form.descuentoPct;
  if (form.descuentoMonto !== undefined) input.descuento_venta_monto = form.descuentoMonto;

  const query = {};
  if (tenantPos && tenantPos.ivaTasa !== null) query.tasa_ivu = tenantPos.ivaTasa;
  if (form.metodoEtiqueta && !form.pagos) query.metodo_etiqueta = form.metodoEtiqueta;
  if (form.requestId && idem.available) query.sin_filtro_duplicados = '1';

  const r = Object.keys(query).length ? await deps.ventaMostrador(input, actor, query) : await deps.ventaMostrador(input, actor);
  if (r.status === 409 && r.body?.code === 'no_open_register') return { status: 409, body: { ok: false, code: 'no_open_register', error: NO_REGISTER } };
  if (r.status !== 200 || !r.body?.ok) return upstream(r, 'No se pudo registrar la venta');
  const v = r.body.venta || {};
  if (form.requestId && idem.available && v.numero) await savePosRequest(deps, tenantId, form.requestId, v.numero);
  const venta = { id: v.id || null, numero: v.numero, total: v.total };
  if (v.subtotal !== undefined) venta.subtotal = v.subtotal;
  if (v.iva !== undefined) venta.ivu = v.iva;
  if (form.hasCash && v.cambio !== undefined) venta.cambio = v.cambio;
  if (form.pagos) {
    venta.dividido = v.dividido === true;
    if (Array.isArray(v.pagos)) venta.pagos = v.pagos;
  }
  if (v.descuento_venta) venta.descuento_venta = v.descuento_venta;
  if (v.customer_id) venta.customer_id = v.customer_id;
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
