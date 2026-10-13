import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';
import {
  SB_URL,
  SB_KEY,
  STATUS_LABELS,
  TERMINAL,
  NON_MAILABLE,
  BLOCKED_STATUSES,
  STATUS_MESSAGES,
  UUID_RE,
  sb,
  money,
  cleanFilter,
  prDayRange,
  sendCustomerEmail,
  validEmail,
} from './muse.js';

const API_TOKEN = process.env.JAIME_API_TOKEN || '';
const TENANT_ID = process.env.JAIME_TENANT_ID || process.env.MUSE_TENANT_ID || '';
const PUBLIC_BASE = 'https://archillaos.com/api/jaime';
const ACTOR = 'Jaime';
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ORDER_COLUMNS = [
  'id', 'order_number', 'status', 'status_note', 'status_history', 'customer_name', 'customer_phone',
  'customer_email', 'device_type', 'device_brand', 'device_model', 'device_color', 'initial_problem',
  'labor_cost', 'cost_estimate', 'tax_rate', 'amount_paid', 'balance_due', 'paid', 'deposit_amount',
  'assigned_to_name', 'promised_date', 'created_date', 'updated_date', 'order_items', 'device_photos',
  'photos_metadata', 'priority',
].join(',');

const hits = [];

function rateLimited() {
  const now = Date.now();
  while (hits.length && hits[0] < now - 60_000) hits.shift();
  hits.push(now);
  return hits.length > 120;
}

function tokenOk(header) {
  if (!API_TOKEN || API_TOKEN.length < 32) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header || '');
  if (!match) return false;
  const a = crypto.createHash('sha256').update(match[1].trim()).digest();
  const b = crypto.createHash('sha256').update(API_TOKEN).digest();
  return crypto.timingSafeEqual(a, b);
}

function fail(res, status, error, code) {
  return res.status(status).json({ ok: false, error, code: code || 'error' });
}

function normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveStatus(input) {
  const key = normalizeKey(input);
  if (!key) return null;
  for (const [id, label] of Object.entries(STATUS_LABELS)) {
    if (normalizeKey(id) === key || normalizeKey(label) === key) return id;
  }
  return null;
}

function equipo(o) {
  return [o.device_brand, o.device_model, o.device_color].filter(Boolean).join(' ') || o.device_type || null;
}

function ticketResumen(o) {
  const created = o.created_date ? new Date(o.created_date) : null;
  return {
    id: o.id,
    numero: o.order_number,
    cliente: o.customer_name || null,
    telefono: o.customer_phone || null,
    equipo: equipo(o),
    estatus: o.status,
    estatus_nombre: STATUS_LABELS[o.status] || o.status,
    fecha_creacion: o.created_date || null,
    ultima_actualizacion: o.updated_date || null,
    total_facturado: money(o.cost_estimate ?? o.labor_cost ?? 0),
    cobrado: money(o.amount_paid),
    balance_pendiente: money(o.balance_due),
    dias_abierto: created ? Math.max(0, Math.floor((Date.now() - created.getTime()) / 86_400_000)) : null,
  };
}

async function findOrder(ref) {
  const base = `order?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&select=${ORDER_COLUMNS}&limit=1`;
  const value = decodeURIComponent(String(ref || '')).trim();
  if (!value) return null;
  if (UUID_RE.test(value)) {
    const rows = await sb(`${base}&id=eq.${value}`);
    return rows?.[0] || null;
  }
  const digits = value.replace(/\D/g, '');
  const candidates = [value, value.toUpperCase()];
  if (digits) candidates.push(`WO-${digits}`);
  const list = [...new Set(candidates.map(cleanFilter).filter(Boolean))].map((c) => `"${c}"`).join(',');
  const rows = await sb(`${base}&order_number=in.(${list})`);
  return rows?.[0] || null;
}

function dayStartIso(dateStr) {
  return prDayRange(dateStr).from;
}

function dayEndIso(dateStr) {
  return prDayRange(dateStr).to;
}

function validDate(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
}

async function listTickets(req, res) {
  const q = req.query || {};
  const limit = Math.min(Math.max(parseInt(q.limite, 10) || 50, 1), 200);
  const page = Math.max(parseInt(q.pagina, 10) || 1, 1);
  const offset = (page - 1) * limit;
  let url = `order?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&select=${ORDER_COLUMNS}&order=updated_date.desc&limit=${limit + 1}&offset=${offset}`;
  const estatus = String(q.estatus || 'activos').trim();
  if (estatus === 'activos') {
    url += `&status=not.in.(${TERMINAL.join(',')})`;
  } else if (estatus === 'cerrados') {
    url += `&status=in.(${TERMINAL.join(',')})`;
  } else if (estatus !== 'todos') {
    const wanted = estatus.split(',').map(resolveStatus).filter(Boolean);
    if (wanted.length === 0) return fail(res, 400, 'estatus invalido. Consulta GET /estatus', 'invalid_status');
    url += `&status=in.(${[...new Set(wanted)].join(',')})`;
  }
  if (q.desde) {
    if (!validDate(q.desde)) return fail(res, 400, 'desde debe ser YYYY-MM-DD', 'invalid_date');
    url += `&created_date=gte.${dayStartIso(q.desde)}`;
  }
  if (q.hasta) {
    if (!validDate(q.hasta)) return fail(res, 400, 'hasta debe ser YYYY-MM-DD', 'invalid_date');
    url += `&created_date=lt.${dayEndIso(q.hasta)}`;
  }
  if (q.actualizado_desde) {
    const t = new Date(q.actualizado_desde);
    if (Number.isNaN(t.getTime())) return fail(res, 400, 'actualizado_desde debe ser fecha ISO', 'invalid_date');
    url += `&updated_date=gte.${t.toISOString()}`;
  }
  if (String(q.con_saldo) === 'true') url += '&balance_due=gt.0';
  const term = cleanFilter(q.q);
  if (term) {
    const digits = term.replace(/\D/g, '');
    const parts = [`customer_name.ilike.*${term}*`, `order_number.ilike.*${term}*`, `customer_phone.ilike.*${term}*`];
    if (digits.length >= 4 && digits !== term) parts.push(`customer_phone.ilike.*${digits}*`);
    url += `&or=(${parts.join(',')})`;
  }
  const rows = (await sb(url)) || [];
  const more = rows.length > limit;
  const tickets = rows.slice(0, limit).map(ticketResumen);
  return res.status(200).json({ ok: true, pagina: page, cantidad: tickets.length, hay_mas: more, tickets });
}

async function ticketPieces(order) {
  const items = (Array.isArray(order.order_items) ? order.order_items : []).filter((i) => i && i.type !== 'discount');
  const links = (await sb(
    `part_link?tenant_id=eq.${TENANT_ID}&order_id=eq.${order.id}&select=id,title,store,cost,price,status,tracking,purchase_order_id,created_at&order=created_at.asc&limit=100`
  )) || [];
  const pos = (await sb(
    `purchase_order?tenant_id=eq.${TENANT_ID}&select=id,po_number,supplier_name,status,order_date,line_items&order=created_at.desc&limit=300`
  )) || [];
  const compras = [];
  for (const po of pos) {
    const lines = Array.isArray(po.line_items) ? po.line_items : [];
    for (const l of lines) {
      const linked = (l.linked_work_order_id && l.linked_work_order_id === order.id)
        || (l.linked_work_order_number && l.linked_work_order_number === order.order_number);
      if (!linked) continue;
      const qty = Number(l.quantity) || 1;
      const unit = Number(l.unit_cost) || 0;
      compras.push({
        orden_compra: po.po_number,
        orden_compra_id: po.id,
        estado: po.status,
        suplidor: po.supplier_name || null,
        fecha_orden: po.order_date || null,
        pieza: l.product_name || l.description || null,
        cantidad: qty,
        costo_unitario: money(unit),
        costo_total: money(qty * unit),
      });
    }
  }
  const poIdsInLinks = new Set(links.map((l) => l.purchase_order_id).filter(Boolean));
  const costoLinks = links
    .filter((l) => l.status !== 'to_order')
    .reduce((s, l) => s + (Number(l.cost) || 0), 0);
  const costoCompras = compras
    .filter((c) => !poIdsInLinks.has(c.orden_compra_id))
    .reduce((s, c) => s + c.costo_total, 0);
  return {
    facturadas: items.map((i) => ({
      id: i.id,
      nombre: i.name,
      tipo: i.type || null,
      cantidad: i.quantity ?? 1,
      precio: money(i.price),
      total: money(i.total ?? (Number(i.quantity) || 1) * (Number(i.price) || 0)),
    })),
    por_ordenar_o_ordenadas: links.map((l) => ({
      id: l.id,
      pieza: l.title || null,
      tienda: l.store || null,
      costo: money(l.cost),
      precio: money(l.price),
      estado: l.status,
      tracking: l.tracking || null,
      orden_compra_id: l.purchase_order_id || null,
    })),
    compras_vinculadas: compras.map(({ orden_compra_id, ...rest }) => rest),
    costo_piezas: money(costoLinks + costoCompras),
  };
}

async function ticketDetail(req, res, ref) {
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  const [piezas, pagos] = await Promise.all([
    ticketPieces(order),
    sb(
      `transaction?tenant_id=eq.${TENANT_ID}&order_id=eq.${order.id}&is_deleted=eq.false&select=type,amount,payment_method,description,created_at&order=created_at.desc&limit=50`
    ),
  ]);
  const photos = Array.isArray(order.photos_metadata) ? order.photos_metadata : [];
  const photoUrls = Array.isArray(order.device_photos) ? order.device_photos : [];
  const fotos = photoUrls.map((url) => {
    const meta = photos.find((p) => p && p.url === url) || {};
    return { url, estatus: meta.status || null, por: meta.by || null, fecha: meta.taken_at || null };
  });
  return res.status(200).json({
    ok: true,
    ticket: {
      ...ticketResumen(order),
      email: order.customer_email || null,
      problema: order.initial_problem || null,
      tecnico: order.assigned_to_name || null,
      fecha_prometida: order.promised_date || null,
      mensaje_taller: order.status_note || null,
      historial_estatus: history
        .filter((e) => e && e.status)
        .map((e) => ({
          estatus: e.status,
          estatus_nombre: STATUS_LABELS[e.status] || e.status,
          fecha: e.timestamp || null,
          por: e.changed_by || null,
          nota: e.note || null,
        })),
      notas: history
        .filter((e) => e && !e.status && e.note)
        .map((e) => ({ fecha: e.timestamp || null, por: e.changed_by || null, tipo: e.kind || 'nota', texto: e.note })),
      piezas,
      fotos,
      pagos: (pagos || []).map((t) => ({
        tipo: t.type,
        monto: money(t.amount),
        metodo: t.payment_method || null,
        descripcion: t.description || null,
        fecha: t.created_at,
      })),
    },
  });
}

async function changeStatus(req, res, ref) {
  const body = req.body || {};
  const status = resolveStatus(body.estatus);
  if (!status) return fail(res, 400, 'estatus invalido. Consulta GET /estatus', 'invalid_status');
  if (BLOCKED_STATUSES.includes(status)) {
    return fail(res, 409, 'Este estatus requiere un flujo con motivo y fotos. Hazlo desde la app.', 'requires_app');
  }
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  if (order.status === status) {
    return res.status(200).json({ ok: true, sin_cambios: true, ticket: ticketResumen(order) });
  }
  if (status === 'delivered' && money(order.balance_due) > 0.005) {
    return fail(res, 409, `El boleto tiene balance pendiente de $${money(order.balance_due).toFixed(2)}. Cobra primero desde la app.`, 'balance_due');
  }
  const notify = body.notificar_cliente === true;
  const note = typeof body.nota === 'string' ? body.nota.trim().slice(0, 500) : '';

  await sb('rpc/update_order_status', {
    method: 'POST',
    body: { p_order_id: order.id, p_new_status: status, p_changed_by: ACTOR, p_visible_to_customer: true },
  });
  if (note) {
    await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
      method: 'PATCH',
      body: { status_note: note },
      prefer: 'return=minimal',
    });
  }

  const email = { solicitado: notify, enviado: false, motivo: null };
  if (notify) {
    if (NON_MAILABLE.includes(status)) email.motivo = 'estatus interno, no se notifica';
    else if (!validEmail(order.customer_email)) email.motivo = 'cliente sin email valido';
    else {
      try {
        const base = STATUS_MESSAGES[status] || `El estado de tu orden cambio a: ${STATUS_LABELS[status]}.`;
        await sendCustomerEmail({
          order: { ...order, status },
          subject: `${STATUS_LABELS[status]} · Orden ${order.order_number}`,
          message: note ? `${base}\n\n${note}` : base,
        });
        email.enviado = true;
      } catch (e) {
        email.motivo = String(e.message || e);
      }
    }
  }
  const fresh = await findOrder(order.id);
  return res.status(200).json({
    ok: true,
    estatus_anterior: order.status,
    ticket: ticketResumen(fresh || order),
    email,
  });
}

async function addNote(req, res, ref) {
  const body = req.body || {};
  const text = typeof body.texto === 'string' ? body.texto.trim() : '';
  if (!text) return fail(res, 400, 'texto es requerido', 'invalid_body');
  if (text.length > 2000) return fail(res, 400, 'texto demasiado largo (max 2000)', 'invalid_body');
  const kinds = { interna: 'internal_note', cliente: 'customer_advisory', nota: 'note' };
  const tipo = body.tipo ? String(body.tipo) : 'interna';
  if (!kinds[tipo]) return fail(res, 400, 'tipo invalido. Validos: interna, cliente, nota', 'invalid_body');
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  const entry = {
    status: null,
    timestamp: new Date().toISOString(),
    changed_by: ACTOR,
    note: text,
    visible_to_customer: false,
    kind: kinds[tipo],
  };
  await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    body: { status_history: [...history, entry], updated_date: new Date().toISOString() },
    prefer: 'return=minimal',
  });
  return res.status(200).json({ ok: true, ticket: order.order_number, nota: { tipo, texto: text, fecha: entry.timestamp } });
}

function privateAddress(addr) {
  if (net.isIPv6(addr)) {
    const a = addr.toLowerCase();
    return a === '::1' || a.startsWith('fc') || a.startsWith('fd') || a.startsWith('fe80') || a.startsWith('::ffff:');
  }
  const p = addr.split('.').map(Number);
  if (p.length !== 4) return true;
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] === 0 ||
    (p[0] === 169 && p[1] === 254) ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127)
  );
}

async function fetchImage(rawUrl) {
  let u;
  try { u = new URL(rawUrl); } catch { throw Object.assign(new Error('url invalida'), { status: 400 }); }
  if (u.protocol !== 'https:') throw Object.assign(new Error('la url debe ser https'), { status: 400 });
  if (net.isIP(u.hostname) || /^localhost$/i.test(u.hostname) || /\.(local|internal|lan)$/i.test(u.hostname)) {
    throw Object.assign(new Error('host no permitido'), { status: 400 });
  }
  const addrs = await dns.lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => privateAddress(a.address))) {
    throw Object.assign(new Error('host no permitido'), { status: 400 });
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const r = await fetch(u.toString(), { redirect: 'error', signal: ctrl.signal });
    if (!r.ok) throw Object.assign(new Error(`no se pudo descargar la imagen (${r.status})`), { status: 400 });
    const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!type.startsWith('image/')) throw Object.assign(new Error('la url no es una imagen'), { status: 400 });
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX_IMAGE_BYTES) throw Object.assign(new Error('imagen demasiado grande (max 8MB)'), { status: 400 });
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES) throw Object.assign(new Error('imagen demasiado grande (max 8MB)'), { status: 400 });
    return { buf, type };
  } finally {
    clearTimeout(timer);
  }
}

function extFor(type) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  if (type === 'image/heic') return 'heic';
  return 'jpg';
}

async function addPhoto(req, res, ref) {
  const body = req.body || {};
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  let buf;
  let type;
  try {
    if (typeof body.url === 'string' && body.url.trim()) {
      ({ buf, type } = await fetchImage(body.url.trim()));
    } else if (typeof body.imagen_base64 === 'string' && body.imagen_base64.trim()) {
      const raw = body.imagen_base64.replace(/^data:([^;]+);base64,/, '');
      const declared = /^data:([^;]+);base64,/.exec(body.imagen_base64);
      type = String(body.content_type || (declared && declared[1]) || 'image/jpeg').toLowerCase();
      if (!type.startsWith('image/')) return fail(res, 400, 'content_type debe ser image/*', 'invalid_body');
      buf = Buffer.from(raw, 'base64');
      if (!buf.length) return fail(res, 400, 'imagen_base64 vacia', 'invalid_body');
      if (buf.length > MAX_IMAGE_BYTES) return fail(res, 400, 'imagen demasiado grande (max 8MB)', 'invalid_body');
    } else {
      return fail(res, 400, 'Envia url (https) o imagen_base64', 'invalid_body');
    }
  } catch (e) {
    return fail(res, e.status || 400, e.message || 'imagen invalida', 'invalid_image');
  }
  const path = `tenants/${TENANT_ID}/orders/${order.order_number}/photo_api_${crypto.randomUUID()}.${extFor(type)}`;
  const up = await fetch(`${SB_URL}/storage/v1/object/uploads/${path}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': type },
    body: buf,
  });
  if (!up.ok) return fail(res, 502, 'No se pudo guardar la imagen', 'storage_failed');
  const publicUrl = `${SB_URL}/storage/v1/object/public/uploads/${path}`;
  const nowIso = new Date().toISOString();
  const photos = Array.isArray(order.device_photos) ? order.device_photos : [];
  const meta = Array.isArray(order.photos_metadata) ? order.photos_metadata : [];
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  const caption = typeof body.nota === 'string' ? body.nota.trim().slice(0, 300) : '';
  await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    body: {
      device_photos: [...photos, publicUrl],
      photos_metadata: [...meta, { url: publicUrl, status: order.status, by: ACTOR, taken_at: nowIso }],
      status_history: [
        ...history,
        {
          status: null,
          timestamp: nowIso,
          changed_by: ACTOR,
          note: caption || 'Foto subida',
          visible_to_customer: false,
          kind: 'photo',
        },
      ],
      updated_date: nowIso,
    },
    prefer: 'return=minimal',
  });
  return res.status(200).json({ ok: true, ticket: order.order_number, url: publicUrl, total_fotos: photos.length + 1 });
}

async function addPiece(req, res, ref) {
  const body = req.body || {};
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  if (TERMINAL.includes(order.status)) {
    return fail(res, 409, 'El boleto esta cerrado; no se le pueden agregar piezas.', 'closed');
  }
  let nombre = typeof body.nombre === 'string' ? body.nombre.trim().slice(0, 140) : '';
  let precio = body.precio === undefined ? null : Number(body.precio);
  let costo = body.costo === undefined || body.costo === null ? null : Number(body.costo);
  const cantidad = body.cantidad === undefined ? 1 : parseInt(body.cantidad, 10);
  const productoId = typeof body.producto_id === 'string' ? body.producto_id.trim() : '';
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) return fail(res, 400, 'cantidad debe ser un entero entre 1 y 100', 'invalid_body');
  if (productoId) {
    if (!UUID_RE.test(productoId)) return fail(res, 400, 'producto_id invalido', 'invalid_body');
    const rows = await sb(`product?tenant_id=eq.${TENANT_ID}&id=eq.${productoId}&select=id,name,price,cost&limit=1`);
    const p = rows?.[0];
    if (!p) return fail(res, 404, 'Producto no encontrado en el inventario', 'not_found');
    if (!nombre) nombre = p.name;
    if (precio === null) precio = Number(p.price) || 0;
    if (costo === null && p.cost !== null && p.cost !== undefined) costo = Number(p.cost) || 0;
  }
  if (!nombre) return fail(res, 400, 'nombre es requerido', 'invalid_body');
  if (precio === null || !Number.isFinite(precio) || precio < 0 || precio > 100000) return fail(res, 400, 'precio debe ser un numero entre 0 y 100000', 'invalid_body');
  if (costo !== null && (!Number.isFinite(costo) || costo < 0 || costo > 100000)) return fail(res, 400, 'costo invalido', 'invalid_body');
  const suplidor = typeof body.suplidor === 'string' ? body.suplidor.trim().slice(0, 100) : '';

  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const last = items[items.length - 1];
  const updatedAt = order.updated_date ? new Date(order.updated_date).getTime() : 0;
  if (
    last && String(last.name).toLowerCase() === nombre.toLowerCase() &&
    Number(last.quantity) === cantidad && money(last.price) === money(precio) &&
    Date.now() - updatedAt < 10 * 60_000
  ) {
    return res.status(200).json({ ok: true, duplicado: true, nota: 'La misma pieza ya estaba como ultima linea del boleto; no se duplico.' });
  }

  let linkId = null;
  if (costo !== null) {
    const inserted = await sb('part_link', {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        order_id: order.id,
        order_number: order.order_number,
        url: '',
        title: nombre,
        store: suplidor || null,
        cost: money(costo * cantidad),
        price: money(precio * cantidad),
        status: 'received',
      },
      prefer: 'return=representation',
    });
    linkId = (Array.isArray(inserted) ? inserted[0] : inserted)?.id || null;
  }

  const line = {
    id: productoId || crypto.randomUUID(),
    type: productoId ? 'part' : 'manual',
    name: nombre,
    quantity: cantidad,
    price: money(precio),
    total: money(cantidad * precio),
  };
  if (linkId) line.source_part_link_id = linkId;
  const combined = [...items, line];
  const itemsTotal = combined.reduce((s, i) => (i.type === 'discount' ? s : s + (Number(i.total) || 0)), 0);
  const discountTotal = combined.reduce((s, i) => (i.type === 'discount' ? s + Math.abs(Number(i.total) || 0) : s), 0);
  const subtotal = itemsTotal + (Number(order.labor_cost) || 0);
  const rate = Number(order.tax_rate) || 0;
  const estimate = Math.max(0, subtotal + subtotal * rate - discountTotal);
  const balance = Math.max(0, estimate - (Number(order.amount_paid) || 0));
  const nowIso = new Date().toISOString();
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    body: {
      order_items: combined,
      cost_estimate: money(estimate),
      balance_due: money(balance),
      paid: balance <= 0.005 && estimate > 0,
      status_history: [
        ...history,
        {
          status: null,
          timestamp: nowIso,
          changed_by: ACTOR,
          note: `Pieza agregada: ${nombre} x${cantidad} a $${money(precio).toFixed(2)}`,
          visible_to_customer: false,
          kind: 'note',
        },
      ],
      updated_date: nowIso,
    },
    prefer: 'return=minimal',
  });
  return res.status(200).json({
    ok: true,
    ticket: order.order_number,
    pieza: { nombre, cantidad, precio: money(precio), total: money(cantidad * precio), costo_total: costo === null ? null : money(costo * cantidad) },
    total_facturado: money(estimate),
    balance_pendiente: money(balance),
    inventario_descontado: false,
  });
}

async function listPieces(req, res, ref) {
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  const piezas = await ticketPieces(order);
  return res.status(200).json({ ok: true, ticket: order.order_number, ...piezas });
}

async function catalog(req, res) {
  const q = req.query || {};
  const limit = Math.min(Math.max(parseInt(q.limite, 10) || 100, 1), 200);
  const page = Math.max(parseInt(q.pagina, 10) || 1, 1);
  let url =
    `product?tenant_id=eq.${TENANT_ID}&active=eq.true&type=eq.product` +
    `&select=id,name,stock,min_stock,cost,price,supplier_name,device_brand,device_model_tag,part_type&order=name.asc&limit=${limit}&offset=${(page - 1) * limit}`;
  if (String(q.todos) !== 'true') url += '&part_type=eq.pieza';
  const term = cleanFilter(q.q);
  if (term) url += `&name=ilike.*${term}*`;
  let rows = (await sb(url)) || [];
  if (String(q.bajo_stock) === 'true') rows = rows.filter((p) => Number(p.stock) <= Number(p.min_stock || 0));
  return res.status(200).json({
    ok: true,
    pagina: page,
    cantidad: rows.length,
    piezas: rows.map((p) => ({
      id: p.id,
      nombre: p.name,
      stock: Number(p.stock) || 0,
      stock_minimo: Number(p.min_stock) || 0,
      costo: money(p.cost),
      precio: money(p.price),
      suplidor: p.supplier_name || null,
      marca: p.device_brand || null,
      modelo: p.device_model_tag || null,
    })),
  });
}

async function purchaseOrders(req, res) {
  const q = req.query || {};
  const limit = Math.min(Math.max(parseInt(q.limite, 10) || 50, 1), 200);
  let url =
    `purchase_order?tenant_id=eq.${TENANT_ID}&select=id,po_number,supplier_name,status,order_date,expected_date,received_date,line_items,total_amount,tracking_number` +
    `&order=created_at.desc&limit=${limit}`;
  if (q.estado) url += `&status=eq.${cleanFilter(q.estado)}`;
  if (q.desde) {
    if (!validDate(q.desde)) return fail(res, 400, 'desde debe ser YYYY-MM-DD', 'invalid_date');
    url += `&order_date=gte.${q.desde}`;
  }
  const rows = (await sb(url)) || [];
  const ticketFilter = q.boleto ? String(q.boleto).trim().toUpperCase() : '';
  const lineas = [];
  const ordenes = [];
  for (const po of rows) {
    const lines = Array.isArray(po.line_items) ? po.line_items : [];
    const mapped = lines.map((l) => {
      const qty = Number(l.quantity) || 1;
      const unit = Number(l.unit_cost) || 0;
      return {
        orden_compra: po.po_number,
        estado: po.status,
        suplidor: po.supplier_name || null,
        fecha_orden: po.order_date || null,
        fecha_esperada: po.expected_date || null,
        fecha_recibida: po.received_date || null,
        pieza: l.product_name || l.description || null,
        cantidad: qty,
        cantidad_recibida: Number(l.received_quantity) || 0,
        costo_unitario: money(unit),
        costo_total: money(qty * unit),
        boleto_id: l.linked_work_order_id || null,
        boleto_numero: l.linked_work_order_number || null,
        tracking: po.tracking_number || null,
      };
    });
    const filtered = ticketFilter
      ? mapped.filter((m) => String(m.boleto_numero || '').toUpperCase() === ticketFilter || m.boleto_id === q.boleto)
      : mapped;
    if (ticketFilter && filtered.length === 0) continue;
    lineas.push(...filtered);
    ordenes.push({
      orden_compra: po.po_number,
      estado: po.status,
      suplidor: po.supplier_name || null,
      fecha_orden: po.order_date || null,
      total: money(po.total_amount),
      tracking: po.tracking_number || null,
      lineas: filtered.length,
    });
  }
  return res.status(200).json({ ok: true, ordenes, lineas });
}

async function statuses(req, res) {
  return res.status(200).json({
    ok: true,
    estatus: Object.entries(STATUS_LABELS).map(([id, nombre]) => ({
      id,
      nombre,
      cerrado: TERMINAL.includes(id),
      cambiable_por_api: !BLOCKED_STATUSES.includes(id),
      notifica_al_cliente: !NON_MAILABLE.includes(id),
    })),
  });
}

async function dailySummary(req, res) {
  const { day, from, to } = prDayRange(req.query?.fecha);
  const [txs, created] = await Promise.all([
    sb(
      `transaction?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&created_at=gte.${from}&created_at=lt.${to}` +
      `&select=type,category,amount,payment_method,description,order_number&order=created_at.desc&limit=1000`
    ),
    sb(
      `order?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&created_date=gte.${from}&created_date=lt.${to}` +
      `&select=order_number,cost_estimate,labor_cost&limit=500`
    ),
  ]);
  let cobrado = 0;
  let devoluciones = 0;
  let gastos = 0;
  const gastosPorCategoria = {};
  const porMetodo = {};
  for (const t of txs || []) {
    const amount = Number(t.amount) || 0;
    if (t.type === 'revenue') {
      cobrado += amount;
      const m = t.payment_method || 'otro';
      porMetodo[m] = money((porMetodo[m] || 0) + amount);
    } else if (t.type === 'refund') {
      devoluciones += Math.abs(amount);
    } else if (t.type === 'expense') {
      gastos += Math.abs(amount);
      const c = t.category || 'other';
      gastosPorCategoria[c] = money((gastosPorCategoria[c] || 0) + Math.abs(amount));
    }
  }
  const facturadoNuevos = (created || []).reduce((s, o) => s + (Number(o.cost_estimate ?? o.labor_cost) || 0), 0);
  return res.status(200).json({
    ok: true,
    fecha: day,
    zona_horaria: 'America/Puerto_Rico',
    cobrado: money(cobrado),
    devoluciones: money(devoluciones),
    gastos: money(gastos),
    gastos_por_categoria: gastosPorCategoria,
    costo_piezas_gastos: money(gastosPorCategoria.parts || 0),
    cobrado_por_metodo: porMetodo,
    ganancia_estimada: money(cobrado - devoluciones - gastos),
    boletos_creados: (created || []).length,
    facturado_en_boletos_creados: money(facturadoNuevos),
    movimientos: (txs || []).length,
    nota: 'ganancia_estimada = cobrado - devoluciones - gastos del dia. El costo de piezas por boleto esta en GET /tickets/{id}/piezas.',
  });
}

async function alerts(req, res) {
  const { from } = prDayRange();
  const [nuevos, listos, esperando, porOrdenar] = await Promise.all([
    sb(`order?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&created_date=gte.${from}&select=${ORDER_COLUMNS}&order=created_date.desc&limit=100`),
    sb(`order?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&status=eq.ready_for_pickup&balance_due=gt.0&select=${ORDER_COLUMNS}&order=updated_date.asc&limit=100`),
    sb(`order?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&status=in.(pending_order,waiting_parts)&select=${ORDER_COLUMNS}&order=updated_date.asc&limit=200`),
    sb(`part_link?tenant_id=eq.${TENANT_ID}&status=eq.to_order&select=order_number,title,store&limit=300`),
  ]);
  const porBoleto = {};
  for (const l of porOrdenar || []) {
    if (!l.order_number) continue;
    (porBoleto[l.order_number] ||= []).push(l.title || 'pieza sin nombre');
  }
  return res.status(200).json({
    ok: true,
    boletos_nuevos_hoy: (nuevos || []).map(ticketResumen),
    listos_sin_cobrar: (listos || []).map(ticketResumen),
    esperando_piezas: (esperando || []).map((o) => ({ ...ticketResumen(o), piezas_por_pedir: porBoleto[o.order_number] || [] })),
    boletos_con_piezas_por_pedir: Object.entries(porBoleto).map(([numero, piezas]) => ({ numero, piezas })),
  });
}

function openapi() {
  const bearer = [{ bearerAuth: [] }];
  const idParam = {
    name: 'id',
    in: 'path',
    required: true,
    description: 'Numero de boleto (WO-379 o 379) o id del boleto',
    schema: { type: 'string' },
  };
  const body = (schema, required = true) => ({ required, content: { 'application/json': { schema } } });
  return {
    openapi: '3.0.3',
    info: {
      title: 'Archilla OS - API de la tienda 911SmartFix para Jaime',
      version: '1.0.0',
      description:
        'Acceso exclusivo a los datos de la tienda 911SmartFix. Autenticacion: header Authorization: Bearer <llave>. ' +
        'La llave esta atada al tenant de la tienda; no puede leer ni escribir datos de otras tiendas. ' +
        'Sin webhooks por ahora: consulta periodicamente GET /tickets?actualizado_desde=<ISO> y GET /alertas.',
    },
    servers: [{ url: PUBLIC_BASE }],
    security: bearer,
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    paths: {
      '/tickets': {
        get: {
          operationId: 'listarTickets',
          summary: 'Lista boletos (id, numero, cliente, telefono, equipo, estatus, fechas, total facturado, cobrado y balance)',
          parameters: [
            { name: 'estatus', in: 'query', description: 'activos (default), cerrados, todos, o ids/nombres separados por coma (ver GET /estatus)', schema: { type: 'string' } },
            { name: 'desde', in: 'query', description: 'Creados desde YYYY-MM-DD (hora de PR)', schema: { type: 'string' } },
            { name: 'hasta', in: 'query', description: 'Creados hasta YYYY-MM-DD inclusive', schema: { type: 'string' } },
            { name: 'actualizado_desde', in: 'query', description: 'Fecha ISO; devuelve boletos modificados desde entonces', schema: { type: 'string' } },
            { name: 'con_saldo', in: 'query', description: 'true = solo boletos con balance pendiente', schema: { type: 'boolean' } },
            { name: 'q', in: 'query', description: 'Busca por cliente, telefono o numero de boleto', schema: { type: 'string' } },
            { name: 'limite', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
            { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          ],
          responses: { 200: { description: 'Lista paginada' } },
        },
      },
      '/tickets/{id}': {
        get: {
          operationId: 'detalleTicket',
          summary: 'Detalle: notas, historial de estatus, piezas (facturadas, por ordenar, compras) con costo, fotos y pagos',
          parameters: [idParam],
          responses: { 200: { description: 'Boleto' }, 404: { description: 'No existe' } },
        },
        patch: {
          operationId: 'cambiarEstatus',
          summary: 'Cambia el estatus del boleto',
          parameters: [idParam],
          requestBody: body({
            type: 'object',
            required: ['estatus'],
            properties: {
              estatus: { type: 'string', description: 'id o nombre exacto (ver GET /estatus), ej. ready_for_pickup' },
              nota: { type: 'string', description: 'Mensaje del taller guardado en el boleto' },
              notificar_cliente: { type: 'boolean', default: false, description: 'true envia el correo de actualizacion' },
            },
          }),
          responses: { 200: { description: 'Boleto actualizado' }, 409: { description: 'Debe hacerse desde la app (balance pendiente, garantia, abandono)' } },
        },
      },
      '/tickets/{id}/notas': {
        post: {
          operationId: 'agregarNota',
          summary: 'Agrega una nota al historial del boleto',
          parameters: [idParam],
          requestBody: body({
            type: 'object',
            required: ['texto'],
            properties: {
              texto: { type: 'string' },
              tipo: { type: 'string', enum: ['interna', 'cliente', 'nota'], default: 'interna' },
            },
          }),
          responses: { 200: { description: 'Nota agregada' } },
        },
      },
      '/tickets/{id}/fotos': {
        post: {
          operationId: 'adjuntarFoto',
          summary: 'Adjunta una foto al boleto, por url https o en base64 (hasta 8MB)',
          parameters: [idParam],
          requestBody: body({
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL https publica de la imagen' },
              imagen_base64: { type: 'string', description: 'Imagen en base64 (alternativa a url; recomendado hasta 3MB)' },
              content_type: { type: 'string', default: 'image/jpeg' },
              nota: { type: 'string' },
            },
          }),
          responses: { 200: { description: 'Foto guardada' } },
        },
      },
      '/tickets/{id}/piezas': {
        get: {
          operationId: 'piezasDelTicket',
          summary: 'Piezas del boleto: facturadas, por ordenar/ordenadas, compras vinculadas y costo total de piezas',
          parameters: [idParam],
          responses: { 200: { description: 'Piezas' } },
        },
        post: {
          operationId: 'registrarPieza',
          summary: 'Registra una pieza usada: la agrega al boleto para facturarla, recalcula el total y guarda su costo. No descuenta inventario.',
          parameters: [idParam],
          requestBody: body({
            type: 'object',
            required: ['nombre', 'precio'],
            properties: {
              nombre: { type: 'string' },
              cantidad: { type: 'integer', default: 1 },
              precio: { type: 'number', description: 'Precio unitario al cliente' },
              costo: { type: 'number', description: 'Costo unitario para el taller (opcional)' },
              suplidor: { type: 'string' },
              producto_id: { type: 'string', description: 'Id de producto del inventario (opcional; toma nombre, precio y costo si faltan)' },
            },
          }),
          responses: { 200: { description: 'Pieza registrada' }, 409: { description: 'Boleto cerrado' } },
        },
      },
      '/estatus': {
        get: { operationId: 'listarEstatus', summary: 'Estatus validos del sistema con nombre exacto', responses: { 200: { description: 'Lista' } } },
      },
      '/piezas': {
        get: {
          operationId: 'catalogoPiezas',
          summary: 'Catalogo de piezas con stock actual',
          parameters: [
            { name: 'q', in: 'query', schema: { type: 'string' } },
            { name: 'bajo_stock', in: 'query', description: 'true = solo piezas en o bajo el minimo', schema: { type: 'boolean' } },
            { name: 'todos', in: 'query', description: 'true incluye todo el inventario, no solo piezas', schema: { type: 'boolean' } },
            { name: 'limite', in: 'query', schema: { type: 'integer', default: 100, maximum: 200 } },
            { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          ],
          responses: { 200: { description: 'Catalogo' } },
        },
      },
      '/ordenes-compra': {
        get: {
          operationId: 'ordenesCompra',
          summary: 'Ordenes de compra con suplidor, pieza, costo, fecha y boleto asociado',
          parameters: [
            { name: 'estado', in: 'query', schema: { type: 'string' } },
            { name: 'desde', in: 'query', description: 'YYYY-MM-DD', schema: { type: 'string' } },
            { name: 'boleto', in: 'query', description: 'Solo lineas asociadas a este boleto', schema: { type: 'string' } },
            { name: 'limite', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
          ],
          responses: { 200: { description: 'Ordenes y lineas' } },
        },
      },
      '/resumen': {
        get: {
          operationId: 'resumenDelDia',
          summary: 'Cobrado, devoluciones, gastos y ganancia estimada del dia',
          parameters: [{ name: 'fecha', in: 'query', description: 'YYYY-MM-DD hora de PR; por defecto hoy', schema: { type: 'string' } }],
          responses: { 200: { description: 'Resumen' } },
        },
      },
      '/alertas': {
        get: {
          operationId: 'alertas',
          summary: 'Boletos nuevos hoy, listos sin cobrar y esperando piezas con piezas por pedir',
          responses: { 200: { description: 'Alertas' } },
        },
      },
    },
  };
}

function segments(req) {
  const raw = req.query?.jaime;
  if (Array.isArray(raw)) return raw.flatMap((r) => String(r).split('/')).filter(Boolean);
  if (typeof raw === 'string' && raw) return raw.split('/').filter(Boolean);
  return String(req.url || '').split('?')[0].replace(/^\/api\/jaime\/?/, '').split('/').filter(Boolean);
}

export async function jaimeHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const parts = segments(req);

  if (req.method === 'GET' && parts.length === 1 && parts[0] === 'openapi.json') {
    return res.status(200).json(openapi());
  }

  if (!API_TOKEN || !TENANT_ID || !SB_KEY) return fail(res, 503, 'Servicio no configurado', 'not_configured');
  if (!tokenOk(req.headers.authorization)) return fail(res, 401, 'Llave invalida', 'unauthorized');
  if (rateLimited()) return fail(res, 429, 'Demasiadas solicitudes, espera un minuto', 'rate_limited');

  try {
    const [a, b, c] = parts;
    const m = req.method;
    if (a === 'tickets') {
      if (m === 'GET' && !b) return await listTickets(req, res);
      if (m === 'GET' && b && !c) return await ticketDetail(req, res, b);
      if (m === 'PATCH' && b && !c) return await changeStatus(req, res, b);
      if (m === 'POST' && b && c === 'notas') return await addNote(req, res, b);
      if (m === 'POST' && b && c === 'fotos') return await addPhoto(req, res, b);
      if (m === 'GET' && b && c === 'piezas') return await listPieces(req, res, b);
      if (m === 'POST' && b && c === 'piezas') return await addPiece(req, res, b);
    }
    if (m === 'GET' && a === 'estatus' && !b) return await statuses(req, res);
    if (m === 'GET' && a === 'piezas' && !b) return await catalog(req, res);
    if (m === 'GET' && a === 'ordenes-compra' && !b) return await purchaseOrders(req, res);
    if (m === 'GET' && a === 'resumen' && !b) return await dailySummary(req, res);
    if (m === 'GET' && a === 'alertas' && !b) return await alerts(req, res);
    if (m === 'GET' && a === 'ping' && !b) return res.status(200).json({ ok: true, tienda: '911SmartFix', hoy: prDayRange().day });
    return fail(res, 404, 'Ruta no encontrada', 'not_found');
  } catch (e) {
    console.error('jaime api error:', e.message);
    return fail(res, e.status && e.status < 500 ? 400 : 502, 'Error al hablar con la base de datos', 'upstream_error');
  }
}
