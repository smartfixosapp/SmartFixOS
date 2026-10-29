import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
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
  sendSimpleEmail,
  shopInfo,
  validEmail,
} from './muse.js';

const API_TOKEN = process.env.JAIME_API_TOKEN || '';
const TENANT_ID = process.env.JAIME_TENANT_ID || process.env.MUSE_TENANT_ID || '';
const PUBLIC_BASE = 'https://archillaos.com/api/jaime';
export const actorStore = new AsyncLocalStorage();

function actorName() {
  return actorStore.getStore()?.actor || 'Jaime';
}
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ORDER_COLUMNS = [
  'id', 'customer_id', 'order_number', 'status', 'status_note', 'status_history', 'customer_name', 'customer_phone',
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

function exactNameFilter(name) {
  const t = String(name || '').trim();
  if (!t || /[*%\\]/.test(t)) return null;
  return encodeURIComponent(t);
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
  const linkById = new Map(links.map((l) => [l.id, l]));
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
      costo_total: i.source_part_link_id && linkById.has(i.source_part_link_id)
        ? money(linkById.get(i.source_part_link_id).cost)
        : null,
      suplidor: i.source_part_link_id && linkById.has(i.source_part_link_id)
        ? linkById.get(i.source_part_link_id).store || null
        : null,
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
  return res.status(200).json({ ok: true, ticket: await buildTicketDetail(order) });
}

async function buildTicketDetail(order) {
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  const [piezas, pagos] = await Promise.all([
    ticketPieces(order),
    sb(
      `transaction?tenant_id=eq.${TENANT_ID}&order_id=eq.${order.id}&is_deleted=eq.false&select=id,type,amount,payment_method,description,created_at&order=created_at.desc&limit=50`
    ),
  ]);
  const photos = Array.isArray(order.photos_metadata) ? order.photos_metadata : [];
  const photoUrls = Array.isArray(order.device_photos) ? order.device_photos : [];
  const fotos = photoUrls.map((url) => {
    const meta = photos.find((p) => p && p.url === url) || {};
    return { url, estatus: meta.status || null, por: meta.by || null, fecha: meta.taken_at || null };
  });
  return {
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
        id: t.id,
        tipo: t.type,
        monto: money(t.amount),
        metodo: t.payment_method || null,
        descripcion: t.description || null,
        fecha: t.created_at,
      })),
  };
}

async function notifyCustomer(order, { subject, message }) {
  if (!validEmail(order.customer_email)) return { enviada: false, motivo: 'el cliente no tiene un email valido' };
  try {
    await sendCustomerEmail({ order, subject, message });
    return { enviada: true, destinatario: order.customer_email };
  } catch (e) {
    return { enviada: false, motivo: String(e.message || e) };
  }
}

function notificationFields(n) {
  return { notificacion_enviada: n.enviada === true, notificacion: n };
}

function wantsNotification(value, fallback = true) {
  return value === undefined || value === null ? fallback : value !== false;
}

async function changeDevice(order, body) {
  let equipoIn;
  let marcaIn;
  let modeloIn;
  let motivoIn;
  try {
    equipoIn = readText(body.equipo, 'equipo', { max: 120 });
    marcaIn = readText(body.marca, 'marca', { max: 60 });
    modeloIn = readText(body.modelo, 'modelo', { max: 100 });
    motivoIn = readText(body.motivo, 'motivo', { max: 200 });
  } catch (e) {
    return { status: 400, error: e.message, code: 'invalid_body' };
  }
  if (!equipoIn && !marcaIn && !modeloIn) return { status: 400, error: 'Envia equipo, marca o modelo con un valor', code: 'invalid_body' };

  const patch = {};
  const newModel = modeloIn || equipoIn;
  if (marcaIn) patch.device_brand = marcaIn;
  if (newModel) {
    let type = null;
    let family = null;
    const exact = exactNameFilter(newModel);
    if (exact) {
      const sib = await sb(
        `order?tenant_id=eq.${TENANT_ID}&device_model=ilike.${exact}&device_type=not.is.null&device_type=neq.temporary&select=device_type,device_family,device_brand&limit=1`
      );
      if (sib && sib[0]) {
        type = sib[0].device_type;
        family = sib[0].device_family || null;
        if (!marcaIn && sib[0].device_brand) patch.device_brand = sib[0].device_brand;
      }
    }
    if (!type) {
      const { chain } = await deviceChain(marcaIn || order.device_brand || '', newModel);
      if (chain.device_category) {
        type = chain.device_category;
        family = chain.device_family || null;
      }
    }
    if (!marcaIn && patch.device_brand === undefined) patch.device_brand = null;
    if (type) {
      patch.device_type = type;
      patch.device_family = family;
      patch.device_model = newModel;
    } else {
      patch.device_type = 'temporary';
      patch.device_family = null;
      patch.device_model = `TEMPORAL: ${newModel}`;
    }
  }
  const labelOf = (brand, model, color, type) => [brand, model, color].filter(Boolean).join(' ') || type || 'sin equipo';
  const antes = labelOf(order.device_brand, order.device_model, order.device_color, order.device_type);
  const despues = labelOf(
    patch.device_brand !== undefined ? patch.device_brand : order.device_brand,
    patch.device_model !== undefined ? patch.device_model : order.device_model,
    order.device_color,
    patch.device_type !== undefined ? patch.device_type : order.device_type
  );
  if (antes === despues) return { order, cambio: null };

  const nowIso = new Date().toISOString();
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    body: {
      ...patch,
      status_history: [
        ...history,
        {
          status: null,
          timestamp: nowIso,
          changed_by: actorName(),
          note: `Equipo cambiado por ${actorName()}: ${antes} → ${despues}${motivoIn ? ` (${motivoIn})` : ''}`,
          visible_to_customer: false,
          kind: 'internal_note',
        },
      ],
      updated_date: nowIso,
    },
    prefer: 'return=minimal',
  });
  const fresh = await findOrder(order.id);
  return { order: fresh || order, cambio: { antes, despues } };
}

async function changeStatus(req, res, ref) {
  const body = req.body || {};
  const hasDevice = ['equipo', 'marca', 'modelo'].some((k) => body[k] !== undefined);
  if (body.estatus === undefined && !hasDevice) return fail(res, 400, 'Envia estatus y/o equipo, marca o modelo', 'invalid_body');
  let order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  let cambioEquipo = null;
  if (hasDevice) {
    if (body.estatus !== undefined) {
      const pre = resolveStatus(body.estatus);
      if (!pre) return fail(res, 400, 'estatus invalido. Consulta GET /estatus', 'invalid_status');
      if (BLOCKED_STATUSES.includes(pre)) return fail(res, 409, 'Este estatus requiere un flujo con motivo y fotos. Hazlo desde la app.', 'requires_app');
    }
    const r = await changeDevice(order, body);
    if (r.error) return fail(res, r.status, r.error, r.code);
    order = r.order;
    cambioEquipo = r.cambio;
    if (body.estatus === undefined) {
      return res.status(200).json({
        ok: true,
        cambio_equipo: cambioEquipo,
        ...(cambioEquipo ? {} : { sin_cambios: true }),
        ticket: ticketResumen(order),
        ...notificationFields({ enviada: false, motivo: 'cambio de equipo: no se notifica al cliente' }),
      });
    }
  }
  const status = resolveStatus(body.estatus);
  if (!status) return fail(res, 400, 'estatus invalido. Consulta GET /estatus', 'invalid_status');
  if (BLOCKED_STATUSES.includes(status)) {
    return fail(res, 409, 'Este estatus requiere un flujo con motivo y fotos. Hazlo desde la app.', 'requires_app');
  }
  if (order.status === status) {
    if (body.notificar_cliente === true) {
      if (NON_MAILABLE.includes(status)) {
        return res.status(200).json({ ok: true, sin_cambios: true, ticket: ticketResumen(order), ...notificationFields({ enviada: false, motivo: 'estatus interno, no se notifica' }) });
      }
      const forced = await notifyCustomer(order, {
        subject: `${STATUS_LABELS[status]} · Orden ${order.order_number}`,
        message: STATUS_MESSAGES[status] || `Tu orden está en estado: ${STATUS_LABELS[status]}.`,
      });
      return res.status(200).json({ ok: true, sin_cambios: true, notificacion_forzada: true, ticket: ticketResumen(order), ...notificationFields(forced) });
    }
    return res.status(200).json({ ok: true, sin_cambios: true, ticket: ticketResumen(order), ...notificationFields({ enviada: false, motivo: 'sin cambio de estatus; envia notificar_cliente:true para reenviar el correo' }) });
  }
  if (status === 'delivered' && money(order.balance_due) > 0.005) {
    return fail(res, 409, `El boleto tiene balance pendiente de $${money(order.balance_due).toFixed(2)}. Cobra primero desde la app.`, 'balance_due');
  }
  const notify = wantsNotification(body.notificar_cliente);
  const note = typeof body.nota === 'string' ? body.nota.trim().slice(0, 500) : '';

  await sb('rpc/update_order_status', {
    method: 'POST',
    body: { p_order_id: order.id, p_new_status: status, p_changed_by: actorName(), p_visible_to_customer: true },
  });
  if (note) {
    await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
      method: 'PATCH',
      body: { status_note: note },
      prefer: 'return=minimal',
    });
  }

  let notification = { enviada: false, motivo: 'notificacion desactivada (notificar_cliente:false)' };
  if (notify) {
    if (NON_MAILABLE.includes(status)) {
      notification = { enviada: false, motivo: 'estatus interno, no se notifica' };
    } else {
      const base = STATUS_MESSAGES[status] || `El estado de tu orden cambió a: ${STATUS_LABELS[status]}.`;
      notification = await notifyCustomer({ ...order, status }, {
        subject: `${STATUS_LABELS[status]} · Orden ${order.order_number}`,
        message: note ? `${base}\n\n${note}` : base,
      });
    }
  }
  const fresh = await findOrder(order.id);
  return res.status(200).json({
    ok: true,
    estatus_anterior: order.status,
    ...(cambioEquipo ? { cambio_equipo: cambioEquipo } : {}),
    ticket: ticketResumen(fresh || order),
    ...notificationFields(notification),
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
    changed_by: actorName(),
    note: text,
    visible_to_customer: false,
    kind: kinds[tipo],
  };
  await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    body: { status_history: [...history, entry], updated_date: new Date().toISOString() },
    prefer: 'return=minimal',
  });
  let notification = { enviada: false, motivo: tipo === 'cliente' ? 'notificacion desactivada (notificar_cliente:false)' : 'las notas internas no se envian al cliente; usa tipo cliente o notificar_cliente:true' };
  if (wantsNotification(body.notificar_cliente, tipo === 'cliente')) {
    notification = await notifyCustomer(order, {
      subject: `Mensaje sobre tu orden ${order.order_number}`,
      message: text,
    });
  }
  return res.status(200).json({ ok: true, ticket: order.order_number, nota: { tipo, texto: text, fecha: entry.timestamp }, ...notificationFields(notification) });
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
  const ownPrefix = `${SB_URL}/storage/v1/object/public/uploads/`;
  let buf;
  let type;
  let ownUrl = null;
  try {
    if (typeof body.url === 'string' && body.url.trim().startsWith(ownPrefix)) {
      ownUrl = body.url.trim();
    } else if (typeof body.url === 'string' && body.url.trim()) {
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
  let publicUrl = ownUrl;
  if (!ownUrl) {
    const path = `tenants/${TENANT_ID}/orders/${order.order_number}/photo_api_${crypto.randomUUID()}.${extFor(type)}`;
    const up = await fetch(`${SB_URL}/storage/v1/object/uploads/${path}`, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': type },
      body: buf,
    });
    if (!up.ok) return fail(res, 502, 'No se pudo guardar la imagen', 'storage_failed');
    publicUrl = `${SB_URL}/storage/v1/object/public/uploads/${path}`;
  }
  const nowIso = new Date().toISOString();
  const photos = Array.isArray(order.device_photos) ? order.device_photos : [];
  const meta = Array.isArray(order.photos_metadata) ? order.photos_metadata : [];
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  const caption = typeof body.nota === 'string' ? body.nota.trim().slice(0, 300) : '';
  await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    body: {
      device_photos: [...photos, publicUrl],
      photos_metadata: [...meta, { url: publicUrl, status: order.status, by: actorName(), taken_at: nowIso }],
      status_history: [
        ...history,
        {
          status: null,
          timestamp: nowIso,
          changed_by: actorName(),
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

function rfail(status, error, code) {
  return { status, body: { ok: false, error, code } };
}

async function registerPiece(order, body) {
  if (TERMINAL.includes(order.status)) {
    return rfail(409, 'El boleto esta cerrado; no se le pueden agregar piezas.', 'closed');
  }
  let nombre = typeof body.nombre === 'string' ? body.nombre.trim().slice(0, 140) : '';
  let precio = body.precio === undefined ? null : Number(body.precio);
  let costo = body.costo === undefined || body.costo === null ? null : Number(body.costo);
  const cantidad = body.cantidad === undefined ? 1 : parseInt(body.cantidad, 10);
  let productoId = typeof body.producto_id === 'string' ? body.producto_id.trim() : '';
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) return rfail(400, 'cantidad debe ser un entero entre 1 y 100', 'invalid_body');
  const productCols = 'id,name,price,cost,stock';
  let producto = null;
  let detectado = false;
  if (productoId) {
    if (!UUID_RE.test(productoId)) return rfail(400, 'producto_id invalido', 'invalid_body');
    const rows = await sb(`product?tenant_id=eq.${TENANT_ID}&id=eq.${productoId}&select=${productCols}&limit=1`);
    producto = rows?.[0] || null;
    if (!producto) return rfail(404, 'Producto no encontrado en el inventario', 'not_found');
  } else if (nombre) {
    const exact = exactNameFilter(nombre);
    if (exact) {
      const rows = await sb(
        `product?tenant_id=eq.${TENANT_ID}&active=eq.true&type=eq.product&name=ilike.${exact}&select=${productCols}&limit=2`
      );
      if (Array.isArray(rows) && rows.length === 1) {
        producto = rows[0];
        productoId = producto.id;
        detectado = true;
      }
    }
  }
  if (producto) {
    if (!nombre) nombre = producto.name;
    if (precio === null) precio = Number(producto.price) || 0;
    if (costo === null && producto.cost !== null && producto.cost !== undefined) costo = Number(producto.cost) || 0;
  }
  if (!nombre) return rfail(400, 'nombre es requerido', 'invalid_body');
  if (precio === null || !Number.isFinite(precio) || precio < 0 || precio > 100000) return rfail(400, 'precio debe ser un numero entre 0 y 100000', 'invalid_body');
  if (costo !== null && (!Number.isFinite(costo) || costo < 0 || costo > 100000)) return rfail(400, 'costo invalido', 'invalid_body');
  const suplidor = typeof body.suplidor === 'string' ? body.suplidor.trim().slice(0, 100) : '';

  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const last = items[items.length - 1];
  const updatedAt = order.updated_date ? new Date(order.updated_date).getTime() : 0;
  if (
    last && String(last.name).toLowerCase() === nombre.toLowerCase() &&
    Number(last.quantity) === cantidad && money(last.price) === money(precio) &&
    Date.now() - updatedAt < 10 * 60_000
  ) {
    return { status: 200, body: { ok: true, duplicado: true, nota: 'La misma pieza ya estaba como ultima linea del boleto; no se duplico.' } };
  }

  const inventario = { descontado: false, producto: producto ? producto.name : null, motivo: null };
  let prevStock = null;
  let nextStock = null;
  if (!producto) {
    inventario.motivo = 'sin producto_id ni coincidencia exacta de nombre en el inventario';
  } else if (producto.stock === null || producto.stock === undefined || Number(producto.stock) < 0) {
    inventario.motivo = 'el producto no lleva control de stock';
  } else {
    prevStock = Number(producto.stock) || 0;
    nextStock = Math.max(0, prevStock - cantidad);
    const upd = await sb(`product?id=eq.${producto.id}&tenant_id=eq.${TENANT_ID}&stock=eq.${prevStock}`, {
      method: 'PATCH',
      body: { stock: nextStock },
      prefer: 'return=representation',
    });
    if (!Array.isArray(upd) || upd.length === 0) {
      return rfail(409, 'El stock cambio mientras se registraba la pieza; vuelve a intentar.', 'stock_conflict');
    }
    inventario.descontado = true;
    inventario.stock_anterior = prevStock;
    inventario.stock_nuevo = nextStock;
    if (prevStock < cantidad) inventario.aviso = `Stock insuficiente en el sistema (habia ${prevStock}, se uso ${cantidad}); quedo en 0.`;
  }

  const revertStock = async () => {
    if (!inventario.descontado) return;
    try {
      await sb(`product?id=eq.${producto.id}&tenant_id=eq.${TENANT_ID}&stock=eq.${nextStock}`, {
        method: 'PATCH',
        body: { stock: prevStock },
        prefer: 'return=minimal',
      });
    } catch {}
  };

  let linkId = null;
  let estimate = 0;
  let balance = 0;
  try {
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
    ({ estimate, balance } = recomputeTotals(order, combined));
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
            changed_by: actorName(),
            note: `Pieza agregada: ${nombre} x${cantidad} a $${money(precio).toFixed(2)}`,
            visible_to_customer: false,
            kind: 'note',
          },
        ],
        updated_date: nowIso,
      },
      prefer: 'return=minimal',
    });
  } catch (e) {
    await revertStock();
    throw e;
  }
  if (inventario.descontado) {
    sb('inventory_movement', {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        product_id: producto.id,
        movement_type: 'sale',
        quantity: cantidad,
        previous_stock: prevStock,
        new_stock: nextStock,
        unit_cost: costo === null ? 0 : money(costo),
        total_amount: money(cantidad * precio),
        reference_type: 'work_order',
        reference_id: order.id,
        reference_number: order.order_number,
        performed_by: actorName(),
      },
      prefer: 'return=minimal',
    }).catch(() => {});
  }
  return {
    status: 200,
    body: {
      ok: true,
      ticket: order.order_number,
      pieza: {
        id: productoId || null,
        nombre,
        cantidad,
        precio: money(precio),
        total: money(cantidad * precio),
        costo_total: costo === null ? null : money(costo * cantidad),
      },
      total_facturado: money(estimate),
      balance_pendiente: money(balance),
      inventario_descontado: inventario.descontado,
      inventario: { ...inventario, producto_detectado_por_nombre: detectado },
    },
  };
}

function recomputeTotals(order, items) {
  const itemsTotal = items.reduce((s, i) => (i.type === 'discount' ? s : s + (Number(i.total) || 0)), 0);
  const discountTotal = items.reduce((s, i) => (i.type === 'discount' ? s + Math.abs(Number(i.total) || 0) : s), 0);
  const subtotal = itemsTotal + (Number(order.labor_cost) || 0);
  const rate = Number(order.tax_rate) || 0;
  const estimate = Math.max(0, subtotal + subtotal * rate - discountTotal);
  const balance = Math.max(0, estimate - (Number(order.amount_paid) || 0));
  return { estimate, balance };
}

async function addPiece(req, res, ref) {
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  const r = await registerPiece(order, req.body || {});
  return res.status(r.status).json(r.body);
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
    `&select=id,name,stock,min_stock,cost,price,supplier_name,device_brand,device_model_tag,category,part_type&order=name.asc&limit=${limit}&offset=${(page - 1) * limit}`;
  if (String(q.todos) !== 'true') url += '&tipo_principal=eq.dispositivos&subcategoria=eq.piezas_servicios';
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
      categoria: p.category || null,
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
  let { day, from, to } = prDayRange(req.query?.fecha);
  const desde = req.query?.desde;
  const hasta = req.query?.hasta;
  let rango = null;
  if (desde || hasta) {
    if (!validDate(desde) || !validDate(hasta) || desde > hasta) return fail(res, 400, 'desde y hasta deben ser fechas YYYY-MM-DD y desde no puede ser posterior a hasta', 'invalid_query');
    if ((new Date(hasta) - new Date(desde)) / 86_400_000 > 92) return fail(res, 400, 'El rango maximo es de 92 dias', 'invalid_query');
    from = prDayRange(desde).from;
    to = prDayRange(hasta).to;
    rango = { desde, hasta };
    day = `${desde} a ${hasta}`;
  }
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
    ...(rango ? { rango } : {}),
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

const NAME_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'van', 'von', 'da', 'do', 'dos']);

function normalizeName(raw) {
  const clean = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!clean) return '';
  if (clean !== clean.toLowerCase() && clean !== clean.toUpperCase()) return clean;
  return clean
    .split(' ')
    .map((w, i) => (i > 0 && NAME_PARTICLES.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

function productShape(p) {
  return {
    id: p.id,
    nombre: p.name,
    stock: Number(p.stock) || 0,
    stock_minimo: Number(p.min_stock) || 0,
    costo: money(p.cost),
    precio: money(p.price),
    suplidor: p.supplier_name || null,
    marca: p.device_brand || null,
    modelo: p.device_model_tag || null,
    categoria: p.category || null,
  };
}

const PRODUCT_SHAPE_COLUMNS = 'id,name,stock,min_stock,cost,price,supplier_name,device_brand,device_model_tag,category';

const PRODUCT_CATEGORIES = [
  'accesorios_puertodecarga', 'battery', 'cable', 'case', 'charger', 'consola_de_juegos_servicio', 'diagnostic',
  'laptop_servicio', 'other', 'screen', 'smartphone_puertodecarga', 'smartphone_servicio', 'tablet_servicio',
];

function mapCategory(label) {
  const key = normalizeKey(label);
  if (!key) return null;
  if (PRODUCT_CATEGORIES.includes(key)) return key;
  if (/pantalla|screen|lcd|oled|display/.test(key)) return 'screen';
  if (/bateria|battery/.test(key)) return 'battery';
  if (/cargador|charger/.test(key)) return 'charger';
  if (/cable/.test(key)) return 'cable';
  if (/case|funda|cover|forro/.test(key)) return 'case';
  if (/puerto/.test(key) && /carga/.test(key)) return 'smartphone_puertodecarga';
  if (/diagnostic/.test(key)) return 'diagnostic';
  return 'other';
}

function readNumber(value, label, { min = 0, max = 100000 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    const err = new Error(`${label} debe ser un numero entre ${min} y ${max}`);
    err.status = 400;
    throw err;
  }
  return n;
}

function readText(value, label, { max = 140, required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) {
      const err = new Error(`${label} es requerido`);
      err.status = 400;
      throw err;
    }
    return '';
  }
  if (typeof value !== 'string') {
    const err = new Error(`${label} debe ser texto`);
    err.status = 400;
    throw err;
  }
  const t = value.trim();
  if (required && !t) {
    const err = new Error(`${label} es requerido`);
    err.status = 400;
    throw err;
  }
  if (t.length > max) {
    const err = new Error(`${label} demasiado largo (max ${max})`);
    err.status = 400;
    throw err;
  }
  return t;
}

async function deviceChain(marca, modelo) {
  const brand = cleanFilter(marca);
  const model = cleanFilter(modelo);
  if (!brand && !model) return { chain: {}, aviso: null };
  const cols = 'device_brand,device_category,device_family,device_model_tag';
  const base = `product?tenant_id=eq.${TENANT_ID}&device_brand=not.is.null&device_family=not.is.null&device_category=not.is.null&select=${cols}&limit=1`;
  let sib = null;
  if (model) {
    const rows = await sb(`${base}&device_model_tag=ilike.${encodeURIComponent(model)}`);
    sib = rows?.[0] || null;
  }
  if (!sib && brand && model) {
    const token = model.split(/\s+/)[0];
    const rows = await sb(`${base}&device_brand=ilike.${encodeURIComponent(brand)}&device_family=ilike.${encodeURIComponent(token)}`);
    sib = rows?.[0] || null;
    if (sib) sib = { ...sib, device_model_tag: modelo };
  }
  if (!sib && brand) {
    const rows = await sb(`${base}&device_brand=ilike.${encodeURIComponent(brand)}`);
    const found = rows?.[0] || null;
    if (found && model) {
      sib = { device_brand: found.device_brand, device_category: found.device_category, device_family: model.split(/\s+/)[0], device_model_tag: modelo };
    }
  }
  if (!sib) {
    return {
      chain: {},
      aviso: 'No habia una pieza similar en el inventario para completar marca, categoria y familia; se creo sin marca/modelo para que aparezca en "sin categoria".',
    };
  }
  return {
    chain: {
      device_brand: sib.device_brand,
      device_category: sib.device_category,
      device_family: sib.device_family,
      device_model_tag: sib.device_model_tag || modelo,
    },
    aviso: null,
  };
}

async function logStockMovement(product, prev, next, reason, number) {
  try {
    await sb('inventory_movement', {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        product_id: product.id,
        movement_type: 'adjustment',
        quantity: Math.abs(next - prev),
        previous_stock: prev,
        new_stock: next,
        unit_cost: money(product.cost),
        total_amount: money(Math.abs(next - prev) * (Number(product.cost) || 0)),
        reference_type: reason,
        reference_number: number || null,
        performed_by: actorName(),
      },
      prefer: 'return=minimal',
    });
  } catch {}
}

async function createProduct(req, res) {
  const b = req.body || {};
  let nombre;
  let precio;
  let costo = 0;
  let stock = 0;
  let stockMin = 0;
  try {
    nombre = readText(b.nombre, 'nombre', { required: true });
    precio = readNumber(b.precio, 'precio');
    if (b.costo !== undefined && b.costo !== null) costo = readNumber(b.costo, 'costo');
    if (b.stock !== undefined && b.stock !== null) stock = readNumber(b.stock, 'stock', { max: 100000 });
    if (b.stock_minimo !== undefined && b.stock_minimo !== null) stockMin = readNumber(b.stock_minimo, 'stock_minimo');
  } catch (e) {
    return fail(res, e.status || 400, e.message, 'invalid_body');
  }
  const marca = readText(b.marca, 'marca', { max: 60 });
  const modelo = readText(b.modelo, 'modelo', { max: 100 });
  const categoria = readText(b.categoria, 'categoria', { max: 60 });
  const suplidor = readText(b.suplidor, 'suplidor', { max: 100 });

  const exact = exactNameFilter(nombre);
  if (exact) {
    const dup = await sb(
      `product?tenant_id=eq.${TENANT_ID}&name=ilike.${exact}&select=${PRODUCT_SHAPE_COLUMNS}&limit=1`
    );
    if (dup && dup.length > 0) {
      return res.status(409).json({
        ok: false,
        error: 'Ya existe un producto con ese nombre. Usa PATCH /piezas/{id} para editarlo.',
        code: 'duplicate',
        existente: productShape(dup[0]),
      });
    }
  }

  const { chain, aviso } = await deviceChain(marca, modelo);
  const row = {
    tenant_id: TENANT_ID,
    name: nombre,
    type: 'product',
    tipo_principal: 'dispositivos',
    subcategoria: 'piezas_servicios',
    part_type: 'pieza',
    price: money(precio),
    cost: money(costo),
    stock,
    min_stock: stockMin,
    taxable: true,
    active: true,
    ...chain,
  };
  let categoriaAviso = null;
  if (categoria) {
    const mapped = mapCategory(categoria);
    row.category = mapped;
    if (normalizeKey(categoria) !== mapped) {
      row.description = categoria;
      categoriaAviso = `La categoria "${categoria}" no existe en el sistema; se guardo como "${mapped}" y el nombre original quedo en la descripcion.`;
    }
  }
  if (suplidor) row.supplier_name = suplidor;
  const inserted = await sb('product', { method: 'POST', body: row, prefer: 'return=representation' });
  const created = Array.isArray(inserted) ? inserted[0] : inserted;
  if (created && stock > 0) await logStockMovement({ ...created, cost: costo }, 0, stock, 'api_create', null);
  const avisosProducto = [aviso, categoriaAviso].filter(Boolean);
  return res.status(200).json({ ok: true, pieza: productShape({ ...row, ...created }), ...(avisosProducto.length ? { avisos: avisosProducto } : {}) });
}

async function patchProduct(req, res, id) {
  if (!UUID_RE.test(String(id))) return fail(res, 400, 'id de pieza invalido', 'invalid_id');
  const rows = await sb(`product?tenant_id=eq.${TENANT_ID}&id=eq.${id}&select=${PRODUCT_SHAPE_COLUMNS}&limit=1`);
  const current = rows?.[0];
  if (!current) return fail(res, 404, 'Pieza no encontrada', 'not_found');
  const b = req.body || {};
  const patch = {};
  const avisosPatch = [];
  try {
    if (b.nombre !== undefined) patch.name = readText(b.nombre, 'nombre', { required: true });
    if (b.marca !== undefined) patch.device_brand = readText(b.marca, 'marca', { max: 60 }) || null;
    if (b.modelo !== undefined) patch.device_model_tag = readText(b.modelo, 'modelo', { max: 100 }) || null;
    if (b.categoria !== undefined) {
      const label = readText(b.categoria, 'categoria', { max: 60 });
      patch.category = label ? mapCategory(label) : null;
      if (label && normalizeKey(label) !== patch.category) {
        avisosPatch.push(`La categoria "${label}" no existe en el sistema; se guardo como "${patch.category}".`);
      }
    }
    if (b.suplidor !== undefined) patch.supplier_name = readText(b.suplidor, 'suplidor', { max: 100 }) || null;
    if (b.costo !== undefined) patch.cost = money(readNumber(b.costo, 'costo'));
    if (b.precio !== undefined) patch.price = money(readNumber(b.precio, 'precio'));
    if (b.stock !== undefined) patch.stock = readNumber(b.stock, 'stock');
    if (b.stock_minimo !== undefined) patch.min_stock = readNumber(b.stock_minimo, 'stock_minimo');
    if (b.activo !== undefined) {
      if (typeof b.activo !== 'boolean') throw Object.assign(new Error('activo debe ser true o false'), { status: 400 });
      patch.active = b.activo;
    }
  } catch (e) {
    return fail(res, e.status || 400, e.message, 'invalid_body');
  }
  if (Object.keys(patch).length === 0) return fail(res, 400, 'No hay campos para actualizar', 'invalid_body');
  if (patch.device_brand || patch.device_model_tag) {
    const { chain } = await deviceChain(
      patch.device_brand || current.device_brand || '',
      patch.device_model_tag || current.device_model_tag || ''
    );
    if (chain.device_brand) {
      patch.device_brand = chain.device_brand;
      patch.device_category = chain.device_category;
      patch.device_family = chain.device_family;
      patch.device_model_tag = chain.device_model_tag;
    } else {
      avisosPatch.push('No habia una pieza similar para completar categoria y familia; puede no aparecer en el catalogo por marca de la app.');
    }
  }
  const updated = await sb(`product?id=eq.${id}&tenant_id=eq.${TENANT_ID}`, {
    method: 'PATCH',
    body: patch,
    prefer: 'return=representation',
  });
  const next = Array.isArray(updated) ? updated[0] : updated;
  if (patch.stock !== undefined && Number(current.stock) !== patch.stock) {
    await logStockMovement({ ...current, cost: patch.cost ?? current.cost }, Number(current.stock) || 0, patch.stock, 'api_adjustment', null);
  }
  return res.status(200).json({
    ok: true,
    pieza: productShape({ ...current, ...patch, ...(next || {}) }),
    ...(avisosPatch.length ? { avisos: avisosPatch } : {}),
  });
}

async function findCustomer(telefono, email, cliente) {
  const first = (cliente.split(/\s+/)[0] || '').toLowerCase();
  const digits = String(telefono || '').replace(/\D/g, '');
  const cols = 'id,name,phone,email';
  if (digits.length >= 10) {
    const d = digits.slice(-10);
    const pattern = `*${d.slice(0, 3)}*${d.slice(3, 6)}*${d.slice(6)}*`;
    const rows = await sb(`customer?tenant_id=eq.${TENANT_ID}&phone=ilike.${encodeURIComponent(pattern)}&select=${cols}&limit=5`);
    const match = (rows || []).find((c) => String(c.name || '').toLowerCase().includes(first));
    if (match) return match;
  }
  if (email) {
    const rows = await sb(`customer?tenant_id=eq.${TENANT_ID}&email=ilike.${encodeURIComponent(email)}&select=${cols}&limit=5`);
    const match = (rows || []).find((c) => String(c.name || '').toLowerCase().includes(first));
    if (match) return match;
  }
  if (!digits && !email) {
    const exact = cleanFilter(cliente);
    if (exact) {
      const rows = await sb(
        `customer?tenant_id=eq.${TENANT_ID}&name=ilike.${encodeURIComponent(exact)}&phone=is.null&email=is.null&select=${cols}&limit=1`
      );
      if (rows && rows[0]) return rows[0];
    }
  }
  return null;
}

async function nextOrderNumber() {
  try {
    const r = await sb('rpc/next_order_number', { method: 'POST', body: { p_tenant_id: TENANT_ID } });
    const v = typeof r === 'string' ? r : (r && (r.next_order_number || r.order_number));
    if (v && /^WO-\d+$/i.test(String(v))) return String(v).toUpperCase();
  } catch {}
  const rows = await sb(`order?tenant_id=eq.${TENANT_ID}&order_number=not.is.null&select=order_number&order=created_date.desc&limit=500`);
  const max = (rows || [])
    .map((r) => parseInt(String(r.order_number).split('-').pop(), 10))
    .filter((n) => Number.isInteger(n))
    .reduce((m, n) => Math.max(m, n), 0);
  return `WO-${max + 1}`;
}

async function createTicket(req, res) {
  const b = req.body || {};
  let cliente;
  let equipo;
  let problema;
  let telefono;
  let email;
  let marca;
  let modelo;
  let tecnico;
  let fechaPrometida;
  try {
    cliente = normalizeName(readText(b.cliente, 'cliente', { required: true, max: 120 }));
    equipo = readText(b.equipo, 'equipo', { required: true, max: 120 });
    problema = readText(b.problema, 'problema', { required: true, max: 1000 });
    telefono = readText(b.telefono, 'telefono', { max: 30 });
    email = readText(b.email, 'email', { max: 120 }).toLowerCase();
    marca = readText(b.marca, 'marca', { max: 60 });
    modelo = readText(b.modelo, 'modelo', { max: 100 });
    tecnico = readText(b.tecnico, 'tecnico', { max: 80 });
    fechaPrometida = readText(b.fecha_prometida, 'fecha_prometida', { max: 10 });
  } catch (e) {
    return fail(res, e.status || 400, e.message, 'invalid_body');
  }
  if (telefono) {
    const d = telefono.replace(/\D/g, '');
    if (d.length < 7 || d.length > 15) return fail(res, 400, 'telefono invalido', 'invalid_body');
  }
  if (email && (!validEmail(email) || /[^\x00-\x7F]/.test(email))) return fail(res, 400, 'email invalido (solo caracteres basicos, sin acentos)', 'invalid_body');
  if (fechaPrometida && !validDate(fechaPrometida)) return fail(res, 400, 'fecha_prometida debe ser YYYY-MM-DD', 'invalid_body');
  const photoPrefix = `${SB_URL}/storage/v1/object/public/uploads/`;
  const fotos = Array.isArray(b.fotos) ? b.fotos.filter((u) => typeof u === 'string' && u.trim()).map((u) => u.trim()).slice(0, 10) : [];
  if (fotos.some((u) => !u.startsWith(photoPrefix))) return fail(res, 400, 'fotos debe contener URLs de fotos subidas al sistema', 'invalid_body');
  const notas = Array.isArray(b.notas) ? b.notas.filter((n) => typeof n === 'string' && n.trim()).map((n) => n.trim().slice(0, 500)).slice(0, 10) : [];
  const piezas = Array.isArray(b.piezas) ? b.piezas.slice(0, 20) : [];
  const avisos = [];

  const sinceIso = new Date(Date.now() - 10 * 60_000).toISOString();
  const recent = await sb(
    `order?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&created_date=gte.${sinceIso}&select=${ORDER_COLUMNS}&order=created_date.desc&limit=20`
  );
  const deviceLabel = (modelo || equipo).toLowerCase();
  const dup = (recent || []).find(
    (o) =>
      String(o.customer_name || '').toLowerCase() === cliente.toLowerCase() &&
      String(o.device_model || '').toLowerCase() === deviceLabel &&
      String(o.initial_problem || '').toLowerCase() === problema.toLowerCase()
  );
  if (dup) {
    return res.status(200).json({
      ok: true,
      creado: false,
      duplicado: true,
      nota: 'Ya existia un boleto identico creado en los ultimos 10 minutos; no se duplico.',
      ticket: await buildTicketDetail(dup),
      ...notificationFields({ enviada: false, motivo: 'boleto duplicado; no se envio otra notificacion' }),
    });
  }

  let customer = null;
  let clienteNuevo = false;
  customer = await findCustomer(telefono, email, cliente);
  if (!customer) {
    const payload = { tenant_id: TENANT_ID, name: cliente, preferred_language: 'es', risk_flag: false };
    if (telefono) payload.phone = telefono;
    if (email) payload.email = email;
    const created = await sb('customer', { method: 'POST', body: payload, prefer: 'return=representation' });
    customer = Array.isArray(created) ? created[0] : created;
    clienteNuevo = true;
    if (!telefono && !email) avisos.push('Cliente creado sin telefono ni email.');
  }

  let employee = null;
  if (tecnico) {
    const term = cleanFilter(tecnico);
    const rows = await sb(
      `app_employee?tenant_id=eq.${TENANT_ID}&active=eq.true&full_name=ilike.${encodeURIComponent(`*${term}*`)}&select=id,full_name&limit=5`
    );
    const exact = (rows || []).find((r) => String(r.full_name).toLowerCase() === tecnico.toLowerCase());
    if (exact) employee = exact;
    else if (rows && rows.length === 1) employee = rows[0];
    else avisos.push(rows && rows.length > 1 ? `El tecnico "${tecnico}" coincide con varios empleados; el boleto quedo sin asignar.` : `No se encontro al tecnico "${tecnico}"; el boleto quedo sin asignar.`);
  }

  let deviceType = null;
  let deviceFamily = null;
  const sibling = await sb(
    `order?tenant_id=eq.${TENANT_ID}&device_model=ilike.${encodeURIComponent(cleanFilter(modelo || equipo))}&device_type=not.is.null&select=device_type,device_family,device_brand&limit=1`
  );
  if (sibling && sibling[0]) {
    deviceType = sibling[0].device_type;
    deviceFamily = sibling[0].device_family;
    if (!marca && sibling[0].device_brand) marca = sibling[0].device_brand;
  }

  const stores = await sb(`order?tenant_id=eq.${TENANT_ID}&select=store_id&order=created_date.desc&limit=5`);
  const storeIds = [...new Set((stores || []).map((r) => r.store_id))];
  const storeId = storeIds.length === 1 && storeIds[0] ? storeIds[0] : null;

  const nowIso = new Date().toISOString();
  const orderNumber = await nextOrderNumber();
  const row = {
    tenant_id: TENANT_ID,
    order_number: orderNumber,
    customer_name: cliente,
    status: 'intake',
    priority: 'normal',
    created_by_name: actorName(),
    created_date: nowIso,
    updated_date: nowIso,
    is_quick_service: false,
    service_type: 'workshop',
    initial_problem: problema,
    device_model: modelo || equipo,
  };
  if (customer && customer.id) row.customer_id = customer.id;
  row.customer_phone = telefono || (customer && customer.phone) || '';
  row.customer_email = email || (customer && customer.email) || '';
  if (marca) row.device_brand = marca;
  if (!deviceType && (marca || modelo)) {
    const { chain } = await deviceChain(marca, modelo);
    if (chain.device_category) deviceType = chain.device_category;
    if (!deviceFamily && chain.device_family) deviceFamily = chain.device_family;
  }
  if (deviceType) {
    row.device_type = deviceType;
  } else {
    row.device_type = 'temporary';
    row.device_model = `TEMPORAL: ${modelo || equipo}`;
  }
  if (deviceFamily) row.device_family = deviceFamily;
  if (storeId) row.store_id = storeId;
  if (employee) {
    row.assigned_to = employee.id;
    row.assigned_to_name = employee.full_name;
  }
  if (fechaPrometida) row.promised_date = `${fechaPrometida}T12:00:00-04:00`;
  if (fotos.length > 0) {
    row.device_photos = fotos;
    row.photos_metadata = fotos.map((url) => ({ url, status: 'intake', by: actorName(), taken_at: nowIso }));
  }
  if (notas.length > 0) {
    row.status_history = notas.map((n) => ({
      status: null,
      timestamp: nowIso,
      changed_by: actorName(),
      note: n,
      visible_to_customer: false,
      kind: 'note',
    }));
  }
  const insertedRows = await sb('order', { method: 'POST', body: row, prefer: 'return=representation' });
  const inserted = Array.isArray(insertedRows) ? insertedRows[0] : insertedRows;
  let order = await findOrder(inserted.id);

  const piezasResultado = [];
  for (const p of piezas) {
    const r = await registerPiece(order, p && typeof p === 'object' ? p : {});
    piezasResultado.push({ nombre: p && p.nombre ? String(p.nombre) : null, ok: r.body.ok === true, ...(r.body.ok ? { inventario_descontado: r.body.inventario_descontado } : { error: r.body.error }) });
    order = (await findOrder(inserted.id)) || order;
  }

  let notification = { enviada: false, motivo: 'notificacion desactivada (notificar_cliente:false)' };
  if (wantsNotification(b.notificar_cliente)) {
    const total = money(order.cost_estimate ?? order.labor_cost ?? 0);
    const lines = [`Recibimos tu equipo (${equipo}) y ya está en nuestra lista de trabajo.`, `Problema reportado: ${problema}`];
    if (total > 0) lines.push(`Total estimado: $${total.toFixed(2)}.`);
    lines.push('Te avisaremos por este medio en cada paso de la reparación.');
    notification = await notifyCustomer(order, { subject: `Recibimos tu equipo · Orden ${order.order_number}`, message: lines.join('\n\n') });
  }
  return res.status(200).json({
    ok: true,
    creado: true,
    numero: order.order_number,
    cliente_nuevo: clienteNuevo,
    avisos,
    piezas_resultado: piezasResultado,
    ticket: await buildTicketDetail(order),
    ...notificationFields(notification),
  });
}

const PAYMENT_METHODS = {
  efectivo: 'cash',
  cash: 'cash',
  ath_movil: 'ath_movil',
  ath: 'ath_movil',
  tarjeta: 'card',
  card: 'card',
  transferencia: 'transferencia',
};

async function addPayment(req, res, ref) {
  const b = req.body || {};
  const metodo = PAYMENT_METHODS[normalizeKey(b.metodo)];
  if (!metodo) return fail(res, 400, 'metodo invalido. Validos: efectivo, ath_movil, tarjeta, transferencia', 'invalid_body');
  let monto;
  try {
    monto = readNumber(b.monto, 'monto', { min: 0.01, max: 100000 });
  } catch (e) {
    return fail(res, 400, e.message, 'invalid_body');
  }
  monto = money(monto);
  const nota = typeof b.nota === 'string' ? b.nota.trim().slice(0, 150) : '';
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  if (TERMINAL.includes(order.status)) {
    return fail(res, 409, 'El boleto esta cerrado; no se le pueden registrar pagos.', 'closed');
  }
  const total = Number(order.cost_estimate ?? order.labor_cost ?? 0) || 0;
  const paid = Number(order.amount_paid) || 0;
  const hasEstimate = total > 0;
  const outstanding = Math.max(0, total - paid);
  if (hasEstimate && outstanding <= 0.004) {
    return fail(res, 409, 'El boleto ya esta saldado; no hay balance que cobrar.', 'already_paid');
  }
  const applied = hasEstimate && outstanding > 0 ? Math.min(monto, outstanding) : monto;
  const newPaid = hasEstimate ? Math.min(paid + monto, total) : paid + monto;
  const newBalance = hasEstimate ? Math.max(0, total - newPaid) : 0;
  const paidNow = hasEstimate && newBalance <= 0.004;

  const existing = (await sb(
    `transaction?tenant_id=eq.${TENANT_ID}&order_id=eq.${order.id}&is_deleted=eq.false&type=eq.revenue&category=eq.repair_payment` +
    `&select=amount,created_at&order=created_at.desc&limit=20`
  )) || [];
  const refunds = (await sb(
    `transaction?tenant_id=eq.${TENANT_ID}&order_id=eq.${order.id}&is_deleted=eq.false&type=eq.refund&select=created_at&order=created_at.desc&limit=1`
  )) || [];
  const lastRefund = refunds[0] ? new Date(refunds[0].created_at).getTime() : 0;
  const repeated = existing.some((t) => {
    const at = new Date(t.created_at).getTime();
    return Math.abs(Number(t.amount) - applied) < 0.005 && at > lastRefund && Date.now() - at < 120_000;
  });
  if (repeated) {
    return res.status(200).json({
      ok: true,
      duplicado: true,
      nota: 'Ya habia un pago identico en los ultimos 2 minutos; no se registro otro.',
      ticket: ticketResumen(order),
      ...notificationFields({ enviada: false, motivo: 'pago duplicado; no se envio otro recibo' }),
    });
  }

  const description = `Pago orden ${order.order_number} · ${order.customer_name || 'Cliente'}${nota ? ` · ${nota}` : ''}`;
  await sb('transaction', {
    method: 'POST',
    body: {
      tenant_id: TENANT_ID,
      type: 'revenue',
      category: 'repair_payment',
      amount: money(applied),
      description,
      payment_method: metodo,
      recorded_by: actorName(),
      order_id: order.id,
      order_number: order.order_number,
      is_settled: metodo !== 'card',
    },
    prefer: 'return=minimal',
  });

  const nowIso = new Date().toISOString();
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  const patchBody = {
    amount_paid: money(newPaid),
    balance_due: money(newBalance),
    paid: paidNow,
    status_history: [
      ...history,
      {
        status: null,
        timestamp: nowIso,
        changed_by: actorName(),
        note: `Pago registrado: $${money(applied).toFixed(2)} (${metodo})${nota ? ` - ${nota}` : ''}`,
        visible_to_customer: false,
        kind: 'note',
      },
    ],
    updated_date: nowIso,
  };
  let patched = false;
  for (let attempt = 0; attempt < 2 && !patched; attempt += 1) {
    try {
      await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, { method: 'PATCH', body: patchBody, prefer: 'return=minimal' });
      patched = true;
    } catch (e) {
      if (attempt === 1) {
        return fail(res, 502, 'El pago se registro en Finanzas pero no se pudo actualizar el boleto. Revisalo en la app antes de reintentar.', 'partial_failure');
      }
    }
  }
  if (order.customer_id && applied >= 1) {
    sb('rpc/increment_loyalty_points', {
      method: 'POST',
      body: { p_customer_id: order.customer_id, p_tenant_id: TENANT_ID, p_delta: Math.round(applied) },
    }).catch(() => {});
  }
  const fresh = await findOrder(order.id);
  let notification = { enviada: false, motivo: 'notificacion desactivada (notificar_cliente:false)' };
  if (wantsNotification(b.notificar_cliente)) {
    const target = fresh || order;
    const methodLabel = { cash: 'efectivo', card: 'tarjeta', ath_movil: 'ATH Móvil', transferencia: 'transferencia' }[metodo] || metodo;
    const lines = [paidNow
      ? `Recibimos tu pago de $${money(applied).toFixed(2)} (${methodLabel}) y tu orden quedó saldada. Gracias por tu confianza.`
      : `Recibimos tu pago de $${money(applied).toFixed(2)} (${methodLabel}) para tu orden.`];
    if (!paidNow && hasEstimate) lines.push(`Pagado a la fecha: $${money(newPaid).toFixed(2)}. Saldo pendiente: $${money(newBalance).toFixed(2)}.`);
    notification = await notifyCustomer(target, { subject: `Recibo de pago · Orden ${order.order_number}`, message: lines.join('\n\n') });
  }
  return res.status(200).json({
    ok: true,
    pago: { monto: money(applied), metodo, saldado: paidNow, recibido: monto },
    ticket: ticketResumen(fresh || order),
    ...notificationFields(notification),
  });
}

async function voidPayment(req, res, ref, pagoId) {
  if (!UUID_RE.test(String(pagoId))) return fail(res, 400, 'pagoId invalido', 'invalid_id');
  const b = req.body || {};
  const motivo = typeof b.motivo === 'string' ? b.motivo.trim() : '';
  if (motivo.length < 3) return fail(res, 400, 'motivo es requerido (minimo 3 caracteres)', 'invalid_body');
  if (motivo.length > 300) return fail(res, 400, 'motivo demasiado largo (max 300)', 'invalid_body');
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  if (TERMINAL.includes(order.status)) {
    return fail(res, 409, 'El boleto esta cerrado; reversa el pago desde la app.', 'closed');
  }
  const rows = await sb(
    `transaction?tenant_id=eq.${TENANT_ID}&order_id=eq.${order.id}&id=eq.${pagoId}&select=id,type,category,amount,payment_method,description,is_deleted&limit=1`
  );
  const tx = rows?.[0];
  if (!tx) return fail(res, 404, 'Pago no encontrado en este boleto', 'not_found');
  if (tx.type !== 'revenue') return fail(res, 409, 'Solo se pueden reversar cobros, no devoluciones ni gastos.', 'not_a_payment');
  if (tx.is_deleted) return fail(res, 409, 'Ese pago ya fue anulado.', 'already_voided');

  const nowIso = new Date().toISOString();
  const voided = await sb(`transaction?id=eq.${tx.id}&tenant_id=eq.${TENANT_ID}&is_deleted=eq.false`, {
    method: 'PATCH',
    body: { is_deleted: true, deleted_at: nowIso, delete_reason: `Anulado por ${actorName()}: ${motivo}` },
    prefer: 'return=representation',
  });
  if (!Array.isArray(voided) || voided.length === 0) {
    return fail(res, 409, 'Ese pago ya fue anulado.', 'already_voided');
  }

  const amount = Math.abs(Number(tx.amount) || 0);
  const total = Number(order.cost_estimate ?? order.labor_cost ?? 0) || 0;
  const hasEstimate = total > 0;
  const newPaid = Math.max(0, (Number(order.amount_paid) || 0) - amount);
  const newBalance = hasEstimate ? Math.max(0, total - newPaid) : 0;
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  const patchBody = {
    amount_paid: money(newPaid),
    balance_due: money(newBalance),
    paid: hasEstimate && newBalance <= 0.004,
    status_history: [
      ...history,
      {
        status: null,
        timestamp: nowIso,
        changed_by: actorName(),
        note: `Pago anulado: $${money(amount).toFixed(2)} (${tx.payment_method || 'sin metodo'}) - ${motivo}`,
        visible_to_customer: false,
        kind: 'note',
      },
    ],
    updated_date: nowIso,
  };
  try {
    await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, { method: 'PATCH', body: patchBody, prefer: 'return=minimal' });
  } catch (e) {
    try {
      await sb(`transaction?id=eq.${tx.id}&tenant_id=eq.${TENANT_ID}`, {
        method: 'PATCH',
        body: { is_deleted: false, deleted_at: null, delete_reason: null },
        prefer: 'return=minimal',
      });
    } catch {}
    throw e;
  }
  let puntos = { revertidos: 0 };
  if (order.customer_id && Math.round(amount) >= 1) {
    try {
      await sb('rpc/increment_loyalty_points', {
        method: 'POST',
        body: { p_customer_id: order.customer_id, p_tenant_id: TENANT_ID, p_delta: -Math.round(amount) },
      });
      puntos = { revertidos: Math.round(amount) };
    } catch {
      puntos = { revertidos: 0, aviso: 'No se pudieron revertir los puntos de lealtad.' };
    }
  }
  const fresh = await findOrder(order.id);
  return res.status(200).json({
    ok: true,
    anulado: { id: tx.id, monto: money(amount), metodo: tx.payment_method || null, motivo },
    puntos_lealtad: puntos,
    ticket: ticketResumen(fresh || order),
  });
}

async function addIncome(req, res) {
  const b = req.body || {};
  const metodo = PAYMENT_METHODS[normalizeKey(b.metodo)];
  if (!metodo) return fail(res, 400, 'metodo invalido. Validos: efectivo, ath_movil, tarjeta, transferencia', 'invalid_body');
  let monto;
  let concepto;
  try {
    monto = money(readNumber(b.monto, 'monto', { min: 0.01, max: 100000 }));
    concepto = readText(b.concepto, 'concepto', { required: true, max: 200 });
  } catch (e) {
    return fail(res, 400, e.message, 'invalid_body');
  }
  if (concepto.length < 3) return fail(res, 400, 'concepto demasiado corto', 'invalid_body');
  const today = prDayRange().day;
  let fecha = today;
  if (b.fecha !== undefined && b.fecha !== null && b.fecha !== '') {
    if (!validDate(b.fecha)) return fail(res, 400, 'fecha debe ser YYYY-MM-DD', 'invalid_body');
    if (b.fecha > today) return fail(res, 400, 'la fecha no puede ser futura', 'invalid_body');
    const oldest = new Date(Date.now() - 366 * 86_400_000).toISOString().slice(0, 10);
    if (b.fecha < oldest) return fail(res, 400, 'la fecha no puede tener mas de un ano', 'invalid_body');
    fecha = b.fecha;
  }

  const descripcion = `Venta de mostrador · ${concepto}`;
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const dupes = await sb(
    `transaction?tenant_id=eq.${TENANT_ID}&type=eq.revenue&category=eq.repair_payment&recorded_by=eq.${actorName()}` +
    `&amount=eq.${monto}&payment_method=eq.${metodo}&description=eq.${encodeURIComponent(descripcion)}` +
    `&created_at=gte.${since}&is_deleted=eq.false&select=id&limit=1`
  );
  if (dupes && dupes.length > 0) {
    return res.status(200).json({
      ok: true,
      duplicado: true,
      id: dupes[0].id,
      nota: 'Ya existia un ingreso identico de los ultimos 10 minutos; no se duplico.',
    });
  }

  const row = {
    tenant_id: TENANT_ID,
    type: 'revenue',
    category: 'repair_payment',
    amount: monto,
    description: descripcion,
    payment_method: metodo,
    recorded_by: actorName(),
    is_settled: metodo !== 'card',
    deductible_tax: false,
  };
  if (fecha !== today) row.created_at = `${fecha}T12:00:00-04:00`;
  const inserted = await sb('transaction', { method: 'POST', body: row, prefer: 'return=representation' });
  const tx = Array.isArray(inserted) ? inserted[0] : inserted;
  return res.status(200).json({
    ok: true,
    ingreso: { id: tx?.id || null, monto, metodo, concepto, fecha },
  });
}


const EXPENSE_CATS = ['parts', 'supplies', 'rent', 'utilities', 'marketing', 'repairs', 'taxes', 'other'];

async function addExpense(req, res) {
  const b = req.body || {};
  const metodo = b.metodo === undefined || b.metodo === null || b.metodo === '' ? null : PAYMENT_METHODS[normalizeKey(b.metodo)];
  if (b.metodo && !metodo) return fail(res, 400, 'metodo invalido. Validos: efectivo, ath_movil, tarjeta, transferencia', 'invalid_body');
  const categoria = String(b.categoria || 'other').toLowerCase();
  if (!EXPENSE_CATS.includes(categoria)) return fail(res, 400, `categoria invalida. Validas: ${EXPENSE_CATS.join(', ')}`, 'invalid_body');
  let monto;
  let concepto;
  try {
    monto = money(readNumber(b.monto, 'monto', { min: 0.01, max: 100000 }));
    concepto = readText(b.concepto, 'concepto', { required: true, max: 200 });
  } catch (e) {
    return fail(res, 400, e.message, 'invalid_body');
  }
  if (concepto.length < 3) return fail(res, 400, 'concepto demasiado corto', 'invalid_body');
  const today = prDayRange().day;
  let fecha = today;
  if (b.fecha !== undefined && b.fecha !== null && b.fecha !== '') {
    if (!validDate(b.fecha)) return fail(res, 400, 'fecha debe ser YYYY-MM-DD', 'invalid_body');
    if (b.fecha > today) return fail(res, 400, 'la fecha no puede ser futura', 'invalid_body');
    const oldest = new Date(Date.now() - 366 * 86_400_000).toISOString().slice(0, 10);
    if (b.fecha < oldest) return fail(res, 400, 'la fecha no puede tener mas de un ano', 'invalid_body');
    fecha = b.fecha;
  }
  const descripcion = `Gasto · ${concepto}`;
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const dupes = await sb(
    `transaction?tenant_id=eq.${TENANT_ID}&type=eq.expense&category=eq.${categoria}&recorded_by=eq.${actorName()}` +
    `&amount=eq.${monto}&description=eq.${encodeURIComponent(descripcion)}&created_at=gte.${since}&is_deleted=eq.false&select=id&limit=1`
  );
  if (dupes && dupes.length > 0) {
    return res.status(200).json({ ok: true, duplicado: true, id: dupes[0].id, nota: 'Ya existia un gasto identico de los ultimos 10 minutos; no se duplico.' });
  }
  const row = {
    tenant_id: TENANT_ID,
    type: 'expense',
    category: categoria,
    amount: monto,
    description: descripcion,
    recorded_by: actorName(),
    is_settled: true,
    deductible_tax: false,
    ...(metodo ? { payment_method: metodo } : {}),
  };
  if (fecha !== today) row.created_at = `${fecha}T12:00:00-04:00`;
  const inserted = await sb('transaction', { method: 'POST', body: row, prefer: 'return=representation' });
  const tx = Array.isArray(inserted) ? inserted[0] : inserted;
  return res.status(200).json({ ok: true, gasto: { id: tx?.id || null, monto, categoria, concepto, fecha } });
}

function customerShape(c) {
  return {
    id: c.id,
    nombre: c.name || null,
    telefono: c.phone || null,
    email: c.email || null,
    puntos: c.loyalty_points ?? null,
    total_gastado: c.total_spent !== undefined && c.total_spent !== null ? money(c.total_spent) : null,
    creado: c.created_date || c.created_at || null,
  };
}

async function listCustomers(req, res) {
  const q = cleanFilter(String(req.query?.q || '').trim());
  if (!q || q.length < 2) return fail(res, 400, 'q es requerido (minimo 2 caracteres): nombre, telefono o email', 'invalid_query');
  const digits = q.replace(/\D/g, '');
  const clauses = [`name.ilike.*${q}*`, `email.ilike.*${q}*`];
  if (digits.length >= 4) clauses.push(`phone.ilike.*${digits.split('').join('*')}*`);
  const limit = Math.min(Math.max(parseInt(req.query?.limite, 10) || 10, 1), 30);
  const rows = await sb(`customer?tenant_id=eq.${TENANT_ID}&or=(${clauses.join(',')})&select=*&order=created_date.desc&limit=${limit}`);
  return res.status(200).json({ ok: true, cantidad: (rows || []).length, clientes: (rows || []).map(customerShape) });
}

async function customerDetail(req, res, id) {
  if (!UUID_RE.test(String(id))) return fail(res, 400, 'id de cliente invalido', 'invalid_id');
  const rows = await sb(`customer?tenant_id=eq.${TENANT_ID}&id=eq.${id}&select=*&limit=1`);
  const c = rows?.[0];
  if (!c) return fail(res, 404, 'Cliente no encontrado', 'not_found');
  const orders = await sb(
    `order?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&customer_id=eq.${id}` +
    `&select=${ORDER_COLUMNS}&order=created_date.desc&limit=25`
  );
  const boletos = (orders || []).map((o) => ticketResumen(o));
  const balance = boletos.reduce((s, t) => s + (Number(t.balance_pendiente) || 0), 0);
  return res.status(200).json({ ok: true, cliente: customerShape(c), boletos_recientes: boletos, balance_pendiente_total: money(balance) });
}

async function patchCustomer(req, res, id) {
  if (!UUID_RE.test(String(id))) return fail(res, 400, 'id de cliente invalido', 'invalid_id');
  const b = req.body || {};
  const patch = {};
  try {
    if (b.nombre !== undefined) patch.name = readText(b.nombre, 'nombre', { required: true, max: 120 });
    if (b.telefono !== undefined) {
      const digits = String(b.telefono || '').replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 15) return fail(res, 400, 'telefono invalido', 'invalid_body');
      patch.phone = digits.length === 10 ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : digits;
    }
    if (b.email !== undefined) {
      const email = String(b.email || '').trim();
      if (email && (!validEmail(email) || /[^\x00-\x7F]/.test(email))) return fail(res, 400, 'email invalido (solo caracteres basicos, sin acentos)', 'invalid_body');
      patch.email = email || null;
    }
  } catch (e) {
    return fail(res, 400, e.message, 'invalid_body');
  }
  if (Object.keys(patch).length === 0) return fail(res, 400, 'Envia nombre, telefono o email', 'invalid_body');
  const updated = await sb(`customer?tenant_id=eq.${TENANT_ID}&id=eq.${id}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
  const row = Array.isArray(updated) ? updated[0] : updated;
  if (!row) return fail(res, 404, 'Cliente no encontrado', 'not_found');
  return res.status(200).json({ ok: true, cliente: customerShape(row) });
}

const IVU_RATE = 0.115;

function posProductShape(p) {
  const tracked = p.stock !== null && p.stock !== undefined && Number(p.stock) >= 0;
  return {
    id: p.id,
    nombre: p.name,
    precio: money(p.price),
    costo: money(p.cost),
    stock: tracked ? Number(p.stock) : null,
    stock_minimo: Number(p.min_stock) || 0,
    tipo: p.type === 'service' ? 'servicio' : 'producto',
    gravable: p.taxable !== false,
    sku: p.sku || null,
    codigo_barras: p.barcode || null,
    marca: p.device_brand || null,
    modelo: p.device_model_tag || null,
    categoria: p.category || null,
  };
}

const POS_COLUMNS = 'id,name,price,cost,stock,min_stock,type,taxable,sku,barcode,device_brand,device_model_tag,category,active';

async function posProducts(req, res) {
  const q = req.query || {};
  const limit = Math.min(Math.max(parseInt(q.limite, 10) || 30, 1), 100);
  const page = Math.max(parseInt(q.pagina, 10) || 1, 1);
  let url = `product?tenant_id=eq.${TENANT_ID}&active=eq.true&select=${POS_COLUMNS}&order=name.asc&limit=${limit}&offset=${(page - 1) * limit}`;
  const term = cleanFilter(q.q);
  if (term) url += `&or=(name.ilike.*${term}*,sku.ilike.*${term}*,barcode.ilike.*${term}*)`;
  if (q.tipo === 'servicio') url += '&type=eq.service';
  else if (q.tipo === 'producto') url += '&type=eq.product';
  let rows = (await sb(url)) || [];
  if (String(q.bajo_stock) === 'true') rows = rows.filter((p) => p.stock !== null && Number(p.stock) >= 0 && Number(p.stock) <= Number(p.min_stock || 0));
  if (String(q.con_stock) === 'true') rows = rows.filter((p) => p.stock === null || Number(p.stock) < 0 || Number(p.stock) > 0);
  return res.status(200).json({ ok: true, pagina: page, cantidad: rows.length, productos: rows.map(posProductShape) });
}

async function resolveSaleLine(raw, index) {
  if (!raw || typeof raw !== 'object') return { error: `items[${index}] invalido` };
  const cantidad = raw.cantidad === undefined ? 1 : parseInt(raw.cantidad, 10);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 100) return { error: `items[${index}].cantidad debe ser un entero entre 1 y 100` };
  const descuento = raw.descuento_pct === undefined ? 0 : Number(raw.descuento_pct);
  if (!Number.isFinite(descuento) || descuento < 0 || descuento > 100) return { error: `items[${index}].descuento_pct debe estar entre 0 y 100` };
  let product = null;
  const productoId = typeof raw.producto_id === 'string' ? raw.producto_id.trim() : '';
  const nombreIn = typeof raw.nombre === 'string' ? raw.nombre.trim().slice(0, 140) : '';
  if (productoId) {
    if (!UUID_RE.test(productoId)) return { error: `items[${index}].producto_id invalido` };
    const rows = await sb(`product?tenant_id=eq.${TENANT_ID}&active=eq.true&id=eq.${productoId}&select=${POS_COLUMNS}&limit=1`);
    product = rows?.[0] || null;
    if (!product) return { error: `items[${index}]: producto no encontrado en el inventario`, status: 404 };
  } else if (nombreIn) {
    const exact = exactNameFilter(nombreIn);
    if (exact) {
      const rows = await sb(`product?tenant_id=eq.${TENANT_ID}&active=eq.true&name=ilike.${exact}&select=${POS_COLUMNS}&limit=2`);
      if (Array.isArray(rows) && rows.length === 1) product = rows[0];
    }
  }
  if (product) {
    const variants = await sb(`product_variant?product_id=eq.${product.id}&select=id&limit=1`).catch(() => []);
    if (variants && variants.length > 0) {
      return { error: `items[${index}]: "${product.name}" tiene variantes; vendelo desde la app`, status: 409 };
    }
  }
  const nombre = nombreIn || (product ? product.name : '');
  if (!nombre) return { error: `items[${index}] necesita producto_id o nombre` };
  let precio = raw.precio === undefined || raw.precio === null ? null : Number(raw.precio);
  if (precio === null && product) precio = Number(product.price) || 0;
  if (precio === null || !Number.isFinite(precio) || precio < 0 || precio > 100000) return { error: `items[${index}].precio debe ser un numero entre 0 y 100000` };
  const gravable = raw.gravable === undefined ? (product ? product.taxable !== false : true) : raw.gravable === true;
  return { product, nombre: product && !nombreIn ? product.name : nombre, cantidad, precio: money(precio), descuento, gravable };
}

async function posSale(req, res) {
  const b = req.body || {};
  const metodo = PAYMENT_METHODS[normalizeKey(b.metodo)];
  if (!metodo) return fail(res, 400, 'metodo invalido. Validos: efectivo, ath_movil, tarjeta, transferencia', 'invalid_body');
  const rawItems = Array.isArray(b.items) ? b.items : [];
  if (rawItems.length < 1 || rawItems.length > 30) return fail(res, 400, 'items debe tener entre 1 y 30 lineas', 'invalid_body');
  const notas = typeof b.notas === 'string' ? b.notas.trim().slice(0, 300) : '';
  const emailCliente = typeof b.email_cliente === 'string' ? b.email_cliente.trim().toLowerCase() : '';
  if (emailCliente && (!validEmail(emailCliente) || /[^\x00-\x7F]/.test(emailCliente))) return fail(res, 400, 'email_cliente invalido', 'invalid_body');

  const lines = [];
  for (let i = 0; i < rawItems.length; i += 1) {
    const l = await resolveSaleLine(rawItems[i], i);
    if (l.error) return fail(res, l.status || 400, l.error, l.status === 404 ? 'not_found' : l.status === 409 ? 'has_variants' : 'invalid_body');
    lines.push(l);
  }

  let subtotal = 0;
  let taxTotal = 0;
  const saleItems = lines.map((l) => {
    const gross = money(l.precio * l.cantidad);
    const discount = money((gross * l.descuento) / 100);
    const lineTotal = Math.max(0, money(gross - discount));
    const rate = l.gravable ? IVU_RATE : 0;
    const tax = money(lineTotal * rate);
    subtotal = money(subtotal + lineTotal);
    taxTotal = money(taxTotal + tax);
    const item = {
      product_name: l.nombre,
      quantity: l.cantidad,
      unit_price: l.precio,
      tax_rate: rate,
      tax_amount: tax,
      total: money(lineTotal + tax),
    };
    if (l.descuento > 0) {
      item.discount_percent = l.descuento;
      item.discount_amount = discount;
    }
    if (l.product) item.product_id = l.product.id;
    return item;
  });
  const total = money(subtotal + taxTotal);
  if (total <= 0) return fail(res, 400, 'El total de la venta debe ser mayor a cero', 'invalid_body');

  let recibido = total;
  if (b.monto_recibido !== undefined && b.monto_recibido !== null) {
    recibido = money(Number(b.monto_recibido));
    if (!Number.isFinite(recibido) || recibido <= 0) return fail(res, 400, 'monto_recibido invalido', 'invalid_body');
    if (metodo !== 'cash' && Math.abs(recibido - total) > 0.004) return fail(res, 400, 'monto_recibido solo aplica a efectivo; en otros metodos debe ser igual al total', 'invalid_body');
    if (recibido + 0.004 < total) return fail(res, 400, `monto_recibido ($${recibido.toFixed(2)}) es menor al total ($${total.toFixed(2)})`, 'invalid_body');
  }
  const cambio = money(Math.max(0, recibido - total));

  const registers = await sb(`cash_register?tenant_id=eq.${TENANT_ID}&status=eq.open&select=id&limit=1`);
  const register = registers?.[0];
  if (!register) return fail(res, 409, 'No hay una caja abierta. Abre la caja desde la app para registrar ventas de mostrador.', 'no_open_register');

  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const recent = (await sb(
    `sale?tenant_id=eq.${TENANT_ID}&employee=eq.${actorName()}&created_at=gte.${since}&select=id,sale_number,total,payment_method,items&limit=20`
  )) || [];
  const signature = (items) => (Array.isArray(items) ? items : []).map((i) => `${String(i.product_name).toLowerCase()}x${i.quantity}`).sort().join('|');
  const dupe = recent.find((s) => Math.abs(Number(s.total) - total) < 0.005 && s.payment_method === metodo && signature(s.items) === signature(saleItems));
  if (dupe) {
    return res.status(200).json({
      ok: true,
      duplicado: true,
      venta: { id: dupe.id, numero: dupe.sale_number, total },
      nota: 'Ya existia una venta identica de los ultimos 5 minutos; no se registro otra.',
      ...notificationFields({ enviada: false, motivo: 'venta duplicada; no se envio otro recibo' }),
    });
  }

  const avisos = [];
  const stockChanges = [];
  const revertStocks = async () => {
    for (const c of stockChanges) {
      try {
        await sb(`product?id=eq.${c.product.id}&tenant_id=eq.${TENANT_ID}&stock=eq.${c.next}`, { method: 'PATCH', body: { stock: c.prev }, prefer: 'return=minimal' });
      } catch {}
    }
  };
  const perProduct = new Map();
  for (const l of lines) {
    if (!l.product) continue;
    perProduct.set(l.product.id, { product: l.product, qty: (perProduct.get(l.product.id)?.qty || 0) + l.cantidad });
  }
  for (const { product, qty } of perProduct.values()) {
    if (product.stock === null || product.stock === undefined || Number(product.stock) <= 0) {
      if (product.stock !== null && product.stock !== undefined && Number(product.stock) === 0) avisos.push(`"${product.name}" estaba en stock 0 en el sistema; la venta se registro igual.`);
      continue;
    }
    const prev = Number(product.stock);
    const next = Math.max(0, prev - qty);
    const upd = await sb(`product?id=eq.${product.id}&tenant_id=eq.${TENANT_ID}&stock=eq.${prev}`, { method: 'PATCH', body: { stock: next }, prefer: 'return=representation' });
    if (!Array.isArray(upd) || upd.length === 0) {
      await revertStocks();
      return fail(res, 409, `El stock de "${product.name}" cambio mientras se registraba la venta; vuelve a intentar.`, 'stock_conflict');
    }
    stockChanges.push({ product, prev, next, qty });
    if (prev < qty) avisos.push(`Stock insuficiente de "${product.name}" (habia ${prev}, se vendieron ${qty}); quedo en 0.`);
  }

  const saleNumber = `POS-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  let sale;
  try {
    const inserted = await sb('sale', {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        sale_number: saleNumber,
        items: saleItems,
        subtotal,
        tax_amount: taxTotal,
        total,
        payment_method: metodo,
        employee: actorName(),
        amount_received: recibido,
        amount_paid: total,
        change_due: cambio,
        customer_id: null,
        order_id: null,
        cash_register_id: register.id,
        is_split_payment: false,
        notes: notas || null,
      },
      prefer: 'return=representation',
    });
    sale = Array.isArray(inserted) ? inserted[0] : inserted;
    await sb('transaction', {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        type: 'revenue',
        amount: total,
        category: 'repair_payment',
        payment_method: metodo,
        description: 'Venta POS',
        recorded_by: actorName(),
      },
      prefer: 'return=minimal',
    });
  } catch (e) {
    await revertStocks();
    if (sale && sale.id) {
      try {
        await sb(`sale?id=eq.${sale.id}&tenant_id=eq.${TENANT_ID}`, {
          method: 'PATCH',
          body: { voided: true, is_deleted: true, voided_at: new Date().toISOString(), void_reason: 'Error al registrar el ingreso; revertida automaticamente' },
          prefer: 'return=minimal',
        });
      } catch {}
    }
    throw e;
  }

  for (const c of stockChanges) {
    sb('transaction', {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        type: 'stock_adjustment',
        category: 'stock_out',
        amount: Math.abs(c.prev - c.next),
        description: `[${c.product.name}] Venta POS`,
        recorded_by: actorName(),
      },
      prefer: 'return=minimal',
    }).catch(() => {});
  }

  let notification = { enviada: false, motivo: emailCliente ? 'notificacion desactivada (notificar_cliente:false)' : 'sin email_cliente; envialo para mandar el recibo' };
  if (emailCliente && wantsNotification(b.notificar_cliente)) {
    const methodLabel = { cash: 'efectivo', card: 'tarjeta', ath_movil: 'ATH Móvil', transferencia: 'transferencia' }[metodo] || metodo;
    const detail = saleItems.map((i) => `${i.quantity} x ${i.product_name}: $${i.total.toFixed(2)}`).join('\n');
    const text = [`Gracias por tu compra. Este es el recibo de tu venta ${saleNumber}.`, detail, `Subtotal: $${subtotal.toFixed(2)}\nIVU: $${taxTotal.toFixed(2)}\nTotal: $${total.toFixed(2)} (${methodLabel})`].join('\n\n');
    try {
      const shop = await shopInfo();
      await sendSimpleEmail({ to: emailCliente, name: '', subject: `Recibo de venta · ${shop.name}`, message: text });
      notification = { enviada: true, destinatario: emailCliente };
    } catch (e) {
      notification = { enviada: false, motivo: String(e.message || e) };
    }
  }
  return res.status(200).json({
    ok: true,
    ...notificationFields(notification),
    venta: {
      id: sale?.id || null,
      numero: saleNumber,
      subtotal,
      iva: taxTotal,
      total,
      metodo,
      recibido,
      cambio,
      items: saleItems.map((i) => ({ nombre: i.product_name, cantidad: i.quantity, precio: i.unit_price, total: i.total })),
    },
    inventario: stockChanges.map((c) => ({ producto: c.product.name, stock_anterior: c.prev, stock_nuevo: c.next })),
    avisos,
  });
}

async function posVoidSale(req, res, ref) {
  const b = req.body || {};
  const motivo = typeof b.motivo === 'string' ? b.motivo.trim() : '';
  if (motivo.length < 3) return fail(res, 400, 'motivo es requerido (minimo 3 caracteres)', 'invalid_body');
  if (motivo.length > 300) return fail(res, 400, 'motivo demasiado largo (max 300)', 'invalid_body');
  const restoreStock = b.restaurar_stock !== false;
  const value = decodeURIComponent(String(ref || '')).trim();
  const key = UUID_RE.test(value) ? `id=eq.${value}` : `sale_number=eq.${encodeURIComponent(value)}`;
  const rows = await sb(
    `sale?tenant_id=eq.${TENANT_ID}&${key}&select=id,sale_number,total,payment_method,items,voided,is_deleted,employee&limit=1`
  );
  const sale = rows?.[0];
  if (!sale) return fail(res, 404, 'Venta no encontrada', 'not_found');
  if (sale.voided || sale.is_deleted) return fail(res, 409, 'Esa venta ya fue anulada.', 'already_voided');
  if (sale.employee !== actorName()) {
    return fail(res, 409, 'Solo se pueden anular desde la API las ventas registradas por la API. Anula esta desde la app.', 'not_api_sale');
  }

  const nowIso = new Date().toISOString();
  const voided = await sb(`sale?id=eq.${sale.id}&tenant_id=eq.${TENANT_ID}&voided=eq.false`, {
    method: 'PATCH',
    body: { voided: true, is_deleted: true, voided_at: nowIso, void_reason: `Anulada por ${actorName()}: ${motivo}`, voided_by: actorName() },
    prefer: 'return=representation',
  });
  if (!Array.isArray(voided) || voided.length === 0) return fail(res, 409, 'Esa venta ya fue anulada.', 'already_voided');

  try {
    await sb('transaction', {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        type: 'refund',
        amount: -money(sale.total),
        category: 'refund',
        payment_method: sale.payment_method || 'cash',
        description: `Venta ${sale.sale_number} anulada`,
        recorded_by: actorName(),
      },
      prefer: 'return=minimal',
    });
  } catch (e) {
    try {
      await sb(`sale?id=eq.${sale.id}&tenant_id=eq.${TENANT_ID}`, {
        method: 'PATCH',
        body: { voided: false, is_deleted: false, voided_at: null, void_reason: null, voided_by: null },
        prefer: 'return=minimal',
      });
    } catch {}
    throw e;
  }

  const inventario = [];
  if (restoreStock) {
    const items = Array.isArray(sale.items) ? sale.items : [];
    for (const item of items) {
      if (!item || !UUID_RE.test(String(item.product_id || ''))) continue;
      const qty = parseInt(item.quantity, 10) || 0;
      if (qty < 1) continue;
      const rowsP = await sb(`product?tenant_id=eq.${TENANT_ID}&id=eq.${item.product_id}&select=id,name,stock&limit=1`);
      const product = rowsP?.[0];
      if (!product || product.stock === null || product.stock === undefined || Number(product.stock) < 0) continue;
      const prev = Number(product.stock) || 0;
      const next = prev + qty;
      const upd = await sb(`product?id=eq.${product.id}&tenant_id=eq.${TENANT_ID}&stock=eq.${prev}`, {
        method: 'PATCH',
        body: { stock: next },
        prefer: 'return=representation',
      });
      if (!Array.isArray(upd) || upd.length === 0) {
        inventario.push({ producto: product.name, restaurado: false, aviso: 'El stock cambio durante la anulacion; ajustalo con PATCH /pos/productos/{id}.' });
        continue;
      }
      inventario.push({ producto: product.name, restaurado: true, stock_anterior: prev, stock_nuevo: next });
      sb('transaction', {
        method: 'POST',
        body: {
          tenant_id: TENANT_ID,
          type: 'stock_adjustment',
          category: 'stock_in',
          amount: qty,
          description: `[${product.name}] Venta ${sale.sale_number} anulada`,
          recorded_by: actorName(),
        },
        prefer: 'return=minimal',
      }).catch(() => {});
    }
  }

  return res.status(200).json({
    ok: true,
    anulada: { id: sale.id, numero: sale.sale_number, total: money(sale.total), metodo: sale.payment_method, motivo },
    reembolso_registrado: true,
    stock_restaurado: restoreStock,
    inventario,
  });
}

async function posAdjustStock(req, res, id) {
  if (!UUID_RE.test(String(id))) return fail(res, 400, 'id de producto invalido', 'invalid_id');
  const b = req.body || {};
  const motivo = typeof b.motivo === 'string' ? b.motivo.trim() : '';
  if (motivo.length < 3) return fail(res, 400, 'motivo es requerido (minimo 3 caracteres)', 'invalid_body');
  if (motivo.length > 200) return fail(res, 400, 'motivo demasiado largo (max 200)', 'invalid_body');
  const hasStock = b.stock !== undefined && b.stock !== null;
  const hasDelta = b.ajuste !== undefined && b.ajuste !== null;
  if (hasStock === hasDelta) return fail(res, 400, 'Envia stock (cantidad final) o ajuste (diferencia, puede ser negativa), uno solo', 'invalid_body');
  const rows = await sb(`product?tenant_id=eq.${TENANT_ID}&id=eq.${id}&select=${POS_COLUMNS}&limit=1`);
  const product = rows?.[0];
  if (!product) return fail(res, 404, 'Producto no encontrado', 'not_found');
  if (product.stock === null || product.stock === undefined || Number(product.stock) < 0) {
    return fail(res, 409, 'Este producto no lleva control de stock.', 'not_tracked');
  }
  const prev = Number(product.stock) || 0;
  let next;
  try {
    next = hasStock ? readNumber(b.stock, 'stock', { max: 100000 }) : Math.max(0, prev + readNumber(b.ajuste, 'ajuste', { min: -100000, max: 100000 }));
  } catch (e) {
    return fail(res, 400, e.message, 'invalid_body');
  }
  if (next === prev) return res.status(200).json({ ok: true, sin_cambios: true, producto: { id: product.id, nombre: product.name, stock: prev } });
  const upd = await sb(`product?id=eq.${product.id}&tenant_id=eq.${TENANT_ID}&stock=eq.${prev}`, { method: 'PATCH', body: { stock: next }, prefer: 'return=representation' });
  if (!Array.isArray(upd) || upd.length === 0) return fail(res, 409, 'El stock cambio mientras se ajustaba; vuelve a intentar.', 'stock_conflict');
  await sb('transaction', {
    method: 'POST',
    body: {
      tenant_id: TENANT_ID,
      type: 'stock_adjustment',
      category: next > prev ? 'stock_in' : 'stock_out',
      amount: Math.abs(next - prev),
      description: `[${product.name}] ${motivo}`,
      recorded_by: actorName(),
    },
    prefer: 'return=minimal',
  }).catch(() => {});
  return res.status(200).json({
    ok: true,
    producto: { id: product.id, nombre: product.name, stock_anterior: prev, stock_nuevo: next },
    motivo,
  });
}

function findLine(order, piezaId) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const index = items.findIndex((i) => i && String(i.id) === String(piezaId));
  return { items, index, line: index >= 0 ? items[index] : null };
}

async function removePiece(req, res, ref, piezaId) {
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  if (TERMINAL.includes(order.status)) return fail(res, 409, 'El boleto esta cerrado; no se pueden quitar piezas.', 'closed');
  const { items, index, line } = findLine(order, piezaId);
  if (!line) return fail(res, 404, 'Pieza no encontrada en el boleto', 'not_found');
  const quantity = parseInt(line.quantity, 10) || 1;

  const inventario = { restaurado: false, motivo: null };
  let product = null;
  let prev = null;
  let next = null;
  if (line.type === 'part' && UUID_RE.test(String(line.id))) {
    const rows = await sb(`product?tenant_id=eq.${TENANT_ID}&id=eq.${line.id}&select=id,name,stock,cost&limit=1`);
    product = rows?.[0] || null;
    if (product && product.stock !== null && product.stock !== undefined && Number(product.stock) >= 0) {
      prev = Number(product.stock) || 0;
      next = prev + quantity;
      const upd = await sb(`product?id=eq.${product.id}&tenant_id=eq.${TENANT_ID}&stock=eq.${prev}`, {
        method: 'PATCH',
        body: { stock: next },
        prefer: 'return=representation',
      });
      if (!Array.isArray(upd) || upd.length === 0) {
        return fail(res, 409, 'El stock cambio mientras se quitaba la pieza; vuelve a intentar.', 'stock_conflict');
      }
      inventario.restaurado = true;
      inventario.stock_anterior = prev;
      inventario.stock_nuevo = next;
    } else {
      inventario.motivo = product ? 'el producto no lleva control de stock' : 'el producto ya no existe en el inventario';
    }
  } else {
    inventario.motivo = 'la linea no descontaba inventario';
  }

  const remaining = items.filter((_, i) => i !== index);
  const { estimate, balance } = recomputeTotals(order, remaining);
  const nowIso = new Date().toISOString();
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  try {
    await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
      method: 'PATCH',
      body: {
        order_items: remaining,
        cost_estimate: money(estimate),
        balance_due: money(balance),
        paid: balance <= 0.005 && estimate > 0,
        status_history: [
          ...history,
          {
            status: null,
            timestamp: nowIso,
            changed_by: actorName(),
            note: `Pieza eliminada por Jaime: ${line.name} x${quantity}`,
            visible_to_customer: false,
            kind: 'note',
          },
        ],
        updated_date: nowIso,
      },
      prefer: 'return=minimal',
    });
  } catch (e) {
    if (inventario.restaurado) {
      try {
        await sb(`product?id=eq.${product.id}&tenant_id=eq.${TENANT_ID}&stock=eq.${next}`, {
          method: 'PATCH',
          body: { stock: prev },
          prefer: 'return=minimal',
        });
      } catch {}
    }
    throw e;
  }
  if (inventario.restaurado) {
    await logStockMovement({ ...product }, prev, next, 'work_order_piece_removed', order.order_number);
  }
  if (line.source_part_link_id) {
    try {
      const links = await sb(`part_link?tenant_id=eq.${TENANT_ID}&id=eq.${line.source_part_link_id}&select=id,url,status&limit=1`);
      if (links?.[0] && links[0].url === '' && links[0].status === 'received') {
        await sb(`part_link?id=eq.${links[0].id}&tenant_id=eq.${TENANT_ID}`, { method: 'DELETE', prefer: 'return=minimal' });
      }
    } catch {}
  }
  const fresh = await findOrder(order.id);
  return res.status(200).json({
    ok: true,
    eliminada: { id: line.id, nombre: line.name, cantidad: quantity },
    inventario,
    total_facturado: money(estimate),
    balance_pendiente: money(balance),
    ticket: ticketResumen(fresh || order),
  });
}

async function updatePieceCost(req, res, ref, piezaId) {
  const b = req.body || {};
  if (b.costo === undefined && b.suplidor === undefined) return fail(res, 400, 'Envia costo y/o suplidor', 'invalid_body');
  let costo = null;
  try {
    if (b.costo !== undefined && b.costo !== null) costo = readNumber(b.costo, 'costo');
  } catch (e) {
    return fail(res, 400, e.message, 'invalid_body');
  }
  const suplidor = typeof b.suplidor === 'string' ? b.suplidor.trim().slice(0, 100) : null;
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  if (TERMINAL.includes(order.status)) return fail(res, 409, 'El boleto esta cerrado; no se puede editar el costo de sus piezas.', 'closed');
  const { items, index, line } = findLine(order, piezaId);
  if (!line) return fail(res, 404, 'Pieza no encontrada en el boleto', 'not_found');
  const quantity = parseInt(line.quantity, 10) || 1;
  const nowIso = new Date().toISOString();
  const history = Array.isArray(order.status_history) ? order.status_history : [];
  const note = {
    status: null,
    timestamp: nowIso,
    changed_by: actorName(),
    note: `Costo de pieza actualizado por Jaime: ${line.name}${costo !== null ? ` costo $${money(costo).toFixed(2)} c/u` : ''}${suplidor ? ` (${suplidor})` : ''}`,
    visible_to_customer: false,
    kind: 'note',
  };

  let link = null;
  if (line.source_part_link_id) {
    const rows = await sb(`part_link?tenant_id=eq.${TENANT_ID}&id=eq.${line.source_part_link_id}&select=id,cost,store&limit=1`);
    link = rows?.[0] || null;
  }
  if (link) {
    const patch = {};
    if (costo !== null) patch.cost = money(costo * quantity);
    if (suplidor !== null) patch.store = suplidor || null;
    await sb(`part_link?id=eq.${link.id}&tenant_id=eq.${TENANT_ID}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
    await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
      method: 'PATCH',
      body: { status_history: [...history, note], updated_date: nowIso },
      prefer: 'return=minimal',
    });
  } else {
    if (costo === null) return fail(res, 400, 'Esta pieza no tiene costo registrado; envia costo.', 'invalid_body');
    const inserted = await sb('part_link', {
      method: 'POST',
      body: {
        tenant_id: TENANT_ID,
        order_id: order.id,
        order_number: order.order_number,
        url: '',
        title: line.name,
        store: suplidor || null,
        cost: money(costo * quantity),
        price: money(Number(line.total) || (Number(line.price) || 0) * quantity),
        status: 'received',
      },
      prefer: 'return=representation',
    });
    const created = Array.isArray(inserted) ? inserted[0] : inserted;
    const updatedItems = items.map((it, i) => (i === index ? { ...it, source_part_link_id: created.id } : it));
    await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
      method: 'PATCH',
      body: { order_items: updatedItems, status_history: [...history, note], updated_date: nowIso },
      prefer: 'return=minimal',
    });
  }
  const fresh = await findOrder(order.id);
  const piezas = await ticketPieces(fresh || order);
  const updatedLine = piezas.facturadas.find((p) => String(p.id) === String(piezaId)) || null;
  return res.status(200).json({
    ok: true,
    ticket: order.order_number,
    pieza: updatedLine,
    costo_piezas: piezas.costo_piezas,
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
        'Sin webhooks por ahora: consulta periodicamente GET /tickets?actualizado_desde=<ISO> y GET /alertas. ' +
        'Paridad con la app: crear boletos, cambiar estatus, registrar pagos y notas al cliente envian el correo al cliente por defecto; ' +
        'cada respuesta de escritura trae notificacion_enviada (true/false) y notificacion con el detalle. Usa notificar_cliente:false para omitirlo.',
    },
    servers: [{ url: PUBLIC_BASE }],
    security: bearer,
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    paths: {
      '/tickets': {
        post: {
          operationId: 'crearTicket',
          summary: 'Crea un boleto en estatus Recepcion (como el wizard de la app), con cliente, equipo, problema y piezas opcionales. Confirma los datos con el dueno.',
          requestBody: body({
            type: 'object',
            required: ['cliente', 'equipo', 'problema'],
            properties: {
              cliente: { type: 'string' },
              telefono: { type: 'string' },
              email: { type: 'string' },
              equipo: { type: 'string', description: 'Descripcion del equipo, ej. Apple iPhone 15 Plus' },
              marca: { type: 'string' },
              modelo: { type: 'string' },
              problema: { type: 'string' },
              tecnico: { type: 'string', description: 'Nombre del empleado a asignar' },
              fecha_prometida: { type: 'string', description: 'YYYY-MM-DD' },
              notificar_cliente: { type: 'boolean', default: true, description: 'Envia por correo la confirmacion de recepcion al cliente (si tiene email). false la omite.' },
              fotos: { type: 'array', items: { type: 'string' }, description: 'URLs de fotos ya subidas al almacenamiento del sistema (maximo 10)' },
              notas: { type: 'array', items: { type: 'string' } },
              piezas: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['nombre', 'precio'],
                  properties: {
                    nombre: { type: 'string' },
                    cantidad: { type: 'integer', default: 1 },
                    precio: { type: 'number' },
                    costo: { type: 'number' },
                    suplidor: { type: 'string' },
                    producto_id: { type: 'string' },
                  },
                },
              },
            },
          }),
          responses: { 200: { description: 'Boleto creado (mismo shape que GET /tickets/{id})' } },
        },
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
      '/tickets/{id}/pagos': {
        post: {
          operationId: 'registrarPago',
          summary: 'Registra un cobro del boleto: crea el ingreso en Finanzas y actualiza cobrado y balance. Confirma monto y metodo con el dueno.',
          parameters: [idParam],
          requestBody: body({
            type: 'object',
            required: ['monto', 'metodo'],
            properties: {
              monto: { type: 'number' },
              metodo: { type: 'string', enum: ['efectivo', 'ath_movil', 'tarjeta', 'transferencia'] },
              nota: { type: 'string' },
              notificar_cliente: { type: 'boolean', default: true, description: 'Envia el recibo de pago por correo al cliente. false lo omite.' },
            },
          }),
          responses: { 200: { description: 'Pago registrado' }, 409: { description: 'Boleto cerrado o ya saldado' } },
        },
      },
      '/tickets/{id}/pagos/{pagoId}/reversar': {
        post: {
          operationId: 'reversarPago',
          summary: 'Anula un cobro registrado por error: lo marca como anulado en Finanzas (no se borra), baja cobrado, recalcula el balance, revierte los puntos de lealtad y deja rastro con el motivo.',
          parameters: [idParam, { name: 'pagoId', in: 'path', required: true, description: 'id del pago (campo id en GET /tickets/{id}, seccion pagos)', schema: { type: 'string' } }],
          requestBody: body({
            type: 'object',
            required: ['motivo'],
            properties: { motivo: { type: 'string', description: 'Obligatorio. Por que se anula el pago' } },
          }),
          responses: { 200: { description: 'Pago anulado' }, 404: { description: 'No existe' }, 409: { description: 'Ya anulado, no es un cobro o boleto cerrado' } },
        },
      },
      '/tickets/{id}/piezas/{piezaId}': {
        delete: {
          operationId: 'quitarPieza',
          summary: 'Quita una pieza agregada por error (solo correcciones): restaura el stock si lo habia descontado y recalcula el total.',
          parameters: [idParam, { name: 'piezaId', in: 'path', required: true, description: 'id de la linea (campo id en GET /tickets/{id}/piezas)', schema: { type: 'string' } }],
          responses: { 200: { description: 'Pieza quitada' }, 404: { description: 'No existe' }, 409: { description: 'Boleto cerrado' } },
        },
        patch: {
          operationId: 'actualizarCostoPieza',
          summary: 'Actualiza el costo interno (y suplidor) de una pieza facturada. No cambia el precio al cliente.',
          parameters: [idParam, { name: 'piezaId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: body({
            type: 'object',
            properties: {
              costo: { type: 'number', description: 'Costo unitario para el taller' },
              suplidor: { type: 'string' },
            },
          }),
          responses: { 200: { description: 'Costo actualizado' }, 409: { description: 'Boleto cerrado' } },
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
          summary: 'Cambia el estatus del boleto y/o corrige el equipo (equipo, marca, modelo). El cambio de equipo deja una nota interna automatica y nunca notifica al cliente.',
          parameters: [idParam],
          requestBody: body({
            type: 'object',
            properties: {
              equipo: { type: 'string', description: 'Descripcion del equipo, ej. Apple iPhone 15 Plus' },
              marca: { type: 'string' },
              modelo: { type: 'string' },
              motivo: { type: 'string', description: 'Opcional, se agrega a la nota interna del cambio de equipo' },
              estatus: { type: 'string', description: 'id o nombre exacto (ver GET /estatus), ej. ready_for_pickup' },
              nota: { type: 'string', description: 'Mensaje del taller guardado en el boleto' },
              notificar_cliente: { type: 'boolean', default: true, description: 'Por defecto se envia el correo de actualizacion al cliente (como en la app). false lo omite; true con el mismo estatus reenvia el correo.' },
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
              notificar_cliente: { type: 'boolean', description: 'Por defecto true en notas tipo cliente (se le envia por correo) y false en las demas' },
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
          summary: 'Registra una pieza usada: la agrega al boleto para facturarla, recalcula el total, guarda su costo y descuenta el inventario si es un producto con control de stock (por producto_id o por coincidencia exacta de nombre).',
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
      '/piezas/{id}': {
        patch: {
          operationId: 'editarPieza',
          summary: 'Edita un producto del inventario (cualquier subconjunto de campos)',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: body({
            type: 'object',
            properties: {
              nombre: { type: 'string' }, marca: { type: 'string' }, modelo: { type: 'string' }, categoria: { type: 'string' },
              costo: { type: 'number' }, precio: { type: 'number' }, stock: { type: 'number' }, stock_minimo: { type: 'number' },
              suplidor: { type: 'string' },
              activo: { type: 'boolean', description: 'false oculta la pieza del inventario sin borrarla' },
            },
          }),
          responses: { 200: { description: 'Producto actualizado' }, 404: { description: 'No existe' } },
        },
      },
      '/piezas': {
        post: {
          operationId: 'crearPieza',
          summary: 'Crea un producto de inventario (pieza). Completa marca, categoria y familia desde una pieza similar para que aparezca en el catalogo de la app.',
          requestBody: body({
            type: 'object',
            required: ['nombre', 'precio'],
            properties: {
              nombre: { type: 'string' }, marca: { type: 'string' }, modelo: { type: 'string' }, categoria: { type: 'string' },
              costo: { type: 'number' }, precio: { type: 'number' }, stock: { type: 'number' }, stock_minimo: { type: 'number' },
              suplidor: { type: 'string' },
            },
          }),
          responses: { 200: { description: 'Producto creado' }, 409: { description: 'Ya existe uno con ese nombre' } },
        },
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
      '/pos/productos': {
        get: {
          operationId: 'posProductos',
          summary: 'Productos y servicios del POS con precio y stock (stock null = no lleva control)',
          parameters: [
            { name: 'q', in: 'query', description: 'Busca por nombre, SKU o codigo de barras', schema: { type: 'string' } },
            { name: 'tipo', in: 'query', schema: { type: 'string', enum: ['producto', 'servicio'] } },
            { name: 'bajo_stock', in: 'query', schema: { type: 'boolean' } },
            { name: 'con_stock', in: 'query', description: 'true oculta los que tienen stock 0', schema: { type: 'boolean' } },
            { name: 'limite', in: 'query', schema: { type: 'integer', default: 30, maximum: 100 } },
            { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          ],
          responses: { 200: { description: 'Lista de productos' } },
        },
      },
      '/pos/productos/{id}': {
        patch: {
          operationId: 'posAjustarStock',
          summary: 'Corrige el stock de un producto con motivo obligatorio. Envia stock (cantidad final) o ajuste (diferencia).',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: body({
            type: 'object',
            required: ['motivo'],
            properties: {
              stock: { type: 'number', description: 'Cantidad final' },
              ajuste: { type: 'number', description: 'Diferencia, negativa para restar' },
              motivo: { type: 'string' },
            },
          }),
          responses: { 200: { description: 'Stock ajustado' }, 409: { description: 'Producto sin control de stock' } },
        },
      },
      '/pos/ventas/{id}/anular': {
        post: {
          operationId: 'posAnularVenta',
          summary: 'Anula una venta registrada por la API (no borra: queda marcada como anulada, se registra el reembolso en Finanzas y se devuelve el stock). Motivo obligatorio. Las ventas hechas desde la app se anulan desde la app.',
          parameters: [{ name: 'id', in: 'path', required: true, description: 'Id de la venta o su numero POS-XXXXXXXX', schema: { type: 'string' } }],
          requestBody: body({
            type: 'object',
            required: ['motivo'],
            properties: {
              motivo: { type: 'string' },
              restaurar_stock: { type: 'boolean', default: true, description: 'false si el stock ya se corrigio a mano' },
            },
          }),
          responses: { 200: { description: 'Venta anulada' }, 409: { description: 'Ya anulada o no fue registrada por la API' } },
        },
      },
      '/pos/ventas': {
        post: {
          operationId: 'posVenta',
          summary: 'Registra una venta de mostrador en una sola llamada: descuenta stock, registra el ingreso en Finanzas y la deja en el historial del POS. Requiere caja abierta. Confirma items, metodo y total con el dueno.',
          requestBody: body({
            type: 'object',
            required: ['items', 'metodo'],
            properties: {
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    producto_id: { type: 'string', description: 'Id del producto (de GET /pos/productos)' },
                    nombre: { type: 'string', description: 'Sin producto_id: nombre exacto del producto o descripcion de una venta libre' },
                    cantidad: { type: 'integer', default: 1 },
                    precio: { type: 'number', description: 'Precio unitario sin IVU; obligatorio en venta libre, por defecto el del producto' },
                    descuento_pct: { type: 'number', description: '0 a 100' },
                    gravable: { type: 'boolean', description: 'Aplica IVU 11.5%. Por defecto el del producto, o true en venta libre' },
                  },
                },
              },
              metodo: { type: 'string', enum: ['efectivo', 'ath_movil', 'tarjeta', 'transferencia'] },
              monto_recibido: { type: 'number', description: 'Solo efectivo: lo que entrego el cliente, para calcular el cambio' },
              email_cliente: { type: 'string', description: 'Si se envia, el recibo de la venta le llega por correo' },
              notificar_cliente: { type: 'boolean', default: true, description: 'false no envia el recibo aunque haya email_cliente' },
              notas: { type: 'string' },
            },
          }),
          responses: { 200: { description: 'Venta registrada' }, 409: { description: 'No hay caja abierta o el producto tiene variantes' } },
        },
      },
      '/finanzas/ingresos': {
        post: {
          operationId: 'registrarIngreso',
          summary: 'Registra una venta de mostrador o ingreso que no es el pago de un boleto. Aparece en Finanzas como el resto de los cobros. Confirma monto, metodo y concepto con el dueno.',
          requestBody: body({
            type: 'object',
            required: ['monto', 'metodo', 'concepto'],
            properties: {
              monto: { type: 'number', description: 'Monto cobrado, ej. 44.58' },
              metodo: { type: 'string', enum: ['efectivo', 'ath_movil', 'tarjeta', 'transferencia'] },
              concepto: { type: 'string', description: 'Ej. Protector de pantalla + cover' },
              fecha: { type: 'string', description: 'YYYY-MM-DD, hora de PR. Por defecto hoy; no puede ser futura.' },
            },
          }),
          responses: { 200: { description: 'Ingreso registrado (o duplicado ignorado)' } },
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
      if (m === 'POST' && !b) return await createTicket(req, res);
      if (m === 'POST' && b && c === 'pagos' && !parts[3]) return await addPayment(req, res, b);
      if (m === 'POST' && b && c === 'pagos' && parts[3] && parts[4] === 'reversar') return await voidPayment(req, res, b, parts[3]);
      if (m === 'DELETE' && b && c === 'piezas' && parts[3]) return await removePiece(req, res, b, parts[3]);
      if (m === 'PATCH' && b && c === 'piezas' && parts[3]) return await updatePieceCost(req, res, b, parts[3]);
    }
    if (m === 'POST' && a === 'finanzas' && b === 'ingresos' && !c) return await addIncome(req, res);
    if (m === 'POST' && a === 'finanzas' && b === 'gastos' && !c) return await addExpense(req, res);
    if (a === 'clientes') {
      if (m === 'GET' && !b) return await listCustomers(req, res);
      if (m === 'GET' && b && !c) return await customerDetail(req, res, b);
      if (m === 'PATCH' && b && !c) return await patchCustomer(req, res, b);
    }
    if (a === 'pos') {
      if (m === 'GET' && b === 'productos' && !c) return await posProducts(req, res);
      if (m === 'POST' && b === 'ventas' && !c) return await posSale(req, res);
      if (m === 'POST' && b === 'ventas' && c && parts[3] === 'anular') return await posVoidSale(req, res, c);
      if (m === 'PATCH' && b === 'productos' && c && !parts[3]) return await posAdjustStock(req, res, c);
    }
    if (m === 'GET' && a === 'estatus' && !b) return await statuses(req, res);
    if (m === 'POST' && a === 'piezas' && !b) return await createProduct(req, res);
    if (m === 'PATCH' && a === 'piezas' && b && !c) return await patchProduct(req, res, b);
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
