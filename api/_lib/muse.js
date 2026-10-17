import crypto from 'node:crypto';
import { ensureResendConfigured, sendResendEmail } from '../../lib/server/resend.js';

export const SB_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://idntuvtabecwubzswpwi.supabase.co';
export const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const API_TOKEN = process.env.MUSE_API_TOKEN || '';
const TENANT_ID = process.env.MUSE_TENANT_ID || '';
const PUBLIC_BASE = 'https://archillaos.com/api/muse';
const PR_OFFSET_HOURS = -4;
const ACTOR = 'Muse';

export const STATUS_LABELS = {
  intake: 'Recepción',
  diagnosing: 'Diagnóstico',
  waiting_customer: 'Esperando cliente',
  pending_order: 'Pendiente a ordenar',
  waiting_parts: 'Esperando piezas',
  part_arrived_waiting_device: 'Pieza lista, esperando al cliente',
  reparacion_externa: 'Reparación externa',
  por_reparar: 'Por reparar',
  in_progress: 'En reparación',
  ready_for_pickup: 'Listo para recoger',
  scheduled: 'Agendado',
  warranty: 'Garantía',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
  not_repairable: 'No reparable',
  abandoned: 'Abandonado',
};
export const TERMINAL = ['delivered', 'cancelled', 'warranty', 'not_repairable', 'abandoned'];
export const NON_MAILABLE = ['pending_order', 'reparacion_externa'];
export const BLOCKED_STATUSES = ['warranty', 'abandoned'];
export const STATUS_MESSAGES = {
  intake: 'Recibimos tu equipo y ya está en nuestra lista de trabajo.',
  diagnosing: 'Estamos diagnosticando tu equipo.',
  waiting_customer: 'Necesitamos tu respuesta para continuar con tu orden. Por favor contáctanos.',
  waiting_parts: 'Estamos esperando las piezas para tu reparación. Te avisamos cuando lleguen.',
  part_arrived_waiting_device: 'La pieza ya llegó. Pasa por el taller para continuar con la reparación.',
  por_reparar: 'Tu equipo está en cola para reparación.',
  in_progress: 'Ya estamos trabajando en la reparación de tu equipo.',
  ready_for_pickup: 'Tu equipo ya está listo. Puedes pasar a recogerlo.',
  scheduled: 'Tu cita quedó agendada.',
  delivered: 'Tu orden fue entregada. Gracias por tu confianza.',
  cancelled: 'Tu orden fue cancelada.',
  not_repairable: 'Después de evaluar tu equipo, no fue posible repararlo.',
};
const EXPENSE_CATEGORIES = ['parts', 'supplies', 'rent', 'utilities', 'marketing', 'repairs', 'taxes', 'other', 'other_expense'];
const PAYMENT_METHODS = ['cash', 'card', 'ath_movil'];
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_COLUMNS = [
  'id', 'order_number', 'status', 'status_note', 'status_history', 'customer_name', 'customer_phone',
  'customer_email', 'device_type', 'device_brand', 'device_model', 'device_color', 'initial_problem',
  'labor_cost', 'cost_estimate', 'amount_paid', 'balance_due', 'paid', 'deposit_amount', 'assigned_to_name',
  'promised_date', 'created_date', 'updated_date', 'order_items', 'priority',
].join(',');

const hits = new Map();

function rateLimited() {
  const now = Date.now();
  const windowStart = now - 60_000;
  const list = (hits.get('all') || []).filter((t) => t > windowStart);
  list.push(now);
  hits.set('all', list);
  return list.length > 90;
}

function tokenOk(header) {
  if (!API_TOKEN || API_TOKEN.length < 32) return false;
  const match = /^Bearer\s+(.+)$/i.exec(header || '');
  if (!match) return false;
  const a = crypto.createHash('sha256').update(match[1].trim()).digest();
  const b = crypto.createHash('sha256').update(API_TOKEN).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function sb(path, { method = 'GET', body, prefer } = {}) {
  const headers = {
    apikey: SB_KEY,
    Authorization: `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const err = new Error((data && data.message) || `Supabase ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function fail(res, status, error, code) {
  return res.status(status).json({ ok: false, error, code: code || 'error' });
}

export function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function cleanFilter(s) {
  return String(s || '').replace(/[,()*%\\"']/g, ' ').trim().slice(0, 60);
}

export function prDayRange(dateStr) {
  const today = new Date(Date.now() + PR_OFFSET_HOURS * 3600_000).toISOString().slice(0, 10);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dateStr || '') ? dateStr : today;
  const start = new Date(`${day}T00:00:00.000Z`).getTime() - PR_OFFSET_HOURS * 3600_000;
  return { day, from: new Date(start).toISOString(), to: new Date(start + 86_400_000).toISOString() };
}

function lastUpdate(history) {
  if (!Array.isArray(history) || history.length === 0) return null;
  const e = history[history.length - 1] || {};
  return { status: e.status || null, at: e.timestamp || null, by: e.changed_by || null, note: e.note || null };
}

function compactOrder(o) {
  const items = Array.isArray(o.order_items) ? o.order_items : [];
  const created = o.created_date ? new Date(o.created_date) : null;
  return {
    id: o.id,
    order_number: o.order_number,
    status: o.status,
    status_label: STATUS_LABELS[o.status] || o.status,
    customer: { name: o.customer_name || null, phone: o.customer_phone || null, email: o.customer_email || null },
    device: [o.device_brand, o.device_model, o.device_color].filter(Boolean).join(' ') || o.device_type || null,
    problem: o.initial_problem || null,
    total: money(o.cost_estimate ?? o.labor_cost ?? 0),
    paid: money(o.amount_paid),
    balance_due: money(o.balance_due),
    assigned_to: o.assigned_to_name || null,
    promised_date: o.promised_date || null,
    created_at: o.created_date || null,
    updated_at: o.updated_date || null,
    days_open: created ? Math.max(0, Math.floor((Date.now() - created.getTime()) / 86_400_000)) : null,
    parts: items.map((i) => ({ name: i.name, quantity: i.quantity ?? 1, type: i.type || null })),
    shop_message: o.status_note || null,
    last_update: lastUpdate(o.status_history),
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

async function shopInfo() {
  let name = process.env.MUSE_SHOP_NAME || '';
  let replyTo = null;
  try {
    const rows = await sb(`app_settings?slug=eq.app-main-settings&select=payload&limit=1`);
    const p = rows?.[0]?.payload || {};
    name = name || p.business_name || p.shop_name || p.name || '';
    replyTo = p.business_email || null;
  } catch {}
  return { name: name || '911 Smart Fix', replyTo };
}

function emailHtml({ shop, greetingName, message, order }) {
  const paragraphs = String(message)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const summary = order
    ? `<table style="margin-top:18px;width:100%;border-top:1px solid #e5e7eb;padding-top:12px;font-size:14px;color:#374151">
        <tr><td style="padding:3px 0;color:#6b7280">Orden</td><td style="padding:3px 0;text-align:right">${escapeHtml(order.order_number)}</td></tr>
        <tr><td style="padding:3px 0;color:#6b7280">Equipo</td><td style="padding:3px 0;text-align:right">${escapeHtml(order.device || '')}</td></tr>
        <tr><td style="padding:3px 0;color:#6b7280">Estado</td><td style="padding:3px 0;text-align:right">${escapeHtml(order.status_label)}</td></tr>
        ${order.balance_due > 0 ? `<tr><td style="padding:3px 0;color:#6b7280">Saldo pendiente</td><td style="padding:3px 0;text-align:right">$${order.balance_due.toFixed(2)}</td></tr>` : ''}
      </table>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111827">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px">
      <div style="background:#ffffff;border-radius:14px;padding:28px 26px">
        <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:14px">${escapeHtml(shop)}</div>
        <p style="margin:0 0 14px;font-size:17px;font-weight:600">Hola ${escapeHtml(greetingName || 'cliente')},</p>
        ${paragraphs}
        ${summary}
      </div>
      <div style="text-align:center;font-size:12px;color:#9ca3af;margin-top:14px">Enviado por ${escapeHtml(shop)} · Powered by Archilla OS</div>
    </div></body></html>`;
}

export async function sendCustomerEmail({ order, subject, message }) {
  ensureResendConfigured();
  const shop = await shopInfo();
  const compact = compactOrder(order);
  const firstName = String(order.customer_name || '').trim().split(/\s+/)[0] || 'cliente';
  const html = emailHtml({ shop: shop.name, greetingName: firstName, message, order: compact });
  await sendResendEmail({
    to: order.customer_email,
    subject,
    html,
    fromName: shop.name,
    replyTo: shop.replyTo || undefined,
  });
}

export function validEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

async function listOrders(req, res) {
  const q = req.query || {};
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 30, 1), 100);
  let url = `order?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&select=${ORDER_COLUMNS}&order=updated_date.desc&limit=${limit}`;
  const statusParam = String(q.status || 'active').trim();
  if (statusParam === 'active') {
    url += `&status=not.in.(${TERMINAL.join(',')})`;
  } else if (statusParam !== 'all') {
    const wanted = statusParam.split(',').map((s) => s.trim()).filter((s) => STATUS_LABELS[s]);
    if (wanted.length === 0) return fail(res, 400, 'status invalido', 'invalid_status');
    url += `&status=in.(${wanted.join(',')})`;
  }
  const term = cleanFilter(q.q);
  if (term) {
    url += `&or=(customer_name.ilike.*${term}*,order_number.ilike.*${term}*,device_model.ilike.*${term}*,customer_phone.ilike.*${term}*)`;
  }
  const rows = await sb(url);
  const orders = (rows || []).map(compactOrder);
  const byStatus = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  return res.status(200).json({ ok: true, count: orders.length, by_status: byStatus, orders });
}

async function getOrder(req, res, ref) {
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  const txs = await sb(
    `transaction?tenant_id=eq.${TENANT_ID}&order_id=eq.${order.id}&is_deleted=eq.false&select=type,amount,payment_method,description,created_at&order=created_at.desc&limit=30`
  );
  const history = (Array.isArray(order.status_history) ? order.status_history : []).slice(-15).reverse().map((e) => ({
    status: e.status,
    status_label: STATUS_LABELS[e.status] || e.status,
    at: e.timestamp,
    by: e.changed_by || null,
    note: e.note || null,
  }));
  return res.status(200).json({
    ok: true,
    order: { ...compactOrder(order), status_history: history, payments: txs || [] },
  });
}

async function changeStatus(req, res, ref) {
  const body = req.body || {};
  const status = String(body.status || '').trim();
  if (!STATUS_LABELS[status]) return fail(res, 400, `status invalido. Validos: ${Object.keys(STATUS_LABELS).join(', ')}`, 'invalid_status');
  if (BLOCKED_STATUSES.includes(status)) {
    return fail(res, 409, 'Este estado requiere un flujo con motivo y fotos. Hazlo desde la app.', 'requires_app');
  }
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  if (order.status === status) {
    return res.status(200).json({ ok: true, unchanged: true, order: compactOrder(order) });
  }
  if (status === 'delivered' && money(order.balance_due) > 0.005) {
    return fail(res, 409, `El boleto tiene saldo pendiente de $${money(order.balance_due).toFixed(2)}. Cobra primero desde la app.`, 'balance_due');
  }
  const notify = body.notify_customer === true;
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

  await sb('rpc/update_order_status', {
    method: 'POST',
    body: {
      p_order_id: order.id,
      p_new_status: status,
      p_changed_by: ACTOR,
      p_visible_to_customer: true,
    },
  });
  if (note) {
    await sb(`order?id=eq.${order.id}&tenant_id=eq.${TENANT_ID}`, {
      method: 'PATCH',
      body: { status_note: note },
      prefer: 'return=minimal',
    });
  }

  let email = { requested: notify, sent: false, reason: null };
  if (notify) {
    if (NON_MAILABLE.includes(status)) email.reason = 'estado interno, no se notifica';
    else if (!validEmail(order.customer_email)) email.reason = 'cliente sin email valido';
    else {
      try {
        const base = STATUS_MESSAGES[status] || `El estado de tu orden cambió a: ${STATUS_LABELS[status]}.`;
        const message = note ? `${base}\n\n${note}` : base;
        await sendCustomerEmail({
          order: { ...order, status },
          subject: `${STATUS_LABELS[status]} · Orden ${order.order_number}`,
          message,
        });
        email.sent = true;
      } catch (e) {
        email.reason = String(e.message || e);
      }
    }
  }
  const fresh = await findOrder(order.id);
  return res.status(200).json({ ok: true, previous_status: order.status, order: compactOrder(fresh || order), email });
}

async function emailCustomer(req, res, ref) {
  const body = req.body || {};
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) return fail(res, 400, 'message es requerido', 'invalid_body');
  if (message.length > 3000) return fail(res, 400, 'message demasiado largo (max 3000)', 'invalid_body');
  const order = await findOrder(ref);
  if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
  if (!validEmail(order.customer_email)) return fail(res, 409, 'El cliente no tiene un email valido registrado', 'no_email');
  const subject = (typeof body.subject === 'string' && body.subject.trim())
    ? body.subject.trim().slice(0, 140)
    : `Mensaje sobre tu orden ${order.order_number}`;
  try {
    await sendCustomerEmail({ order, subject, message });
  } catch (e) {
    return fail(res, 502, `No se pudo enviar: ${e.message || e}`, 'email_failed');
  }
  return res.status(200).json({ ok: true, sent_to: order.customer_email, subject, order_number: order.order_number });
}

async function financeSummary(req, res) {
  const { day, from, to } = prDayRange(req.query?.date);
  const rows = await sb(
    `transaction?tenant_id=eq.${TENANT_ID}&is_deleted=eq.false&created_at=gte.${from}&created_at=lt.${to}` +
    `&select=type,category,amount,payment_method,description,order_number,recorded_by,created_at&order=created_at.desc&limit=1000`
  );
  let revenue = 0;
  let refunds = 0;
  let expenses = 0;
  const byMethod = {};
  const expenseByCategory = {};
  for (const t of rows || []) {
    const amount = Number(t.amount) || 0;
    if (t.type === 'revenue') {
      revenue += amount;
      const m = t.payment_method || 'other';
      byMethod[m] = money((byMethod[m] || 0) + amount);
    } else if (t.type === 'refund') {
      refunds += Math.abs(amount);
    } else if (t.type === 'expense') {
      expenses += Math.abs(amount);
      const c = t.category || 'other';
      expenseByCategory[c] = money((expenseByCategory[c] || 0) + Math.abs(amount));
    }
  }
  return res.status(200).json({
    ok: true,
    date: day,
    timezone: 'America/Puerto_Rico',
    revenue: money(revenue),
    refunds: money(refunds),
    expenses: money(expenses),
    net: money(revenue - refunds - expenses),
    revenue_by_payment_method: byMethod,
    expenses_by_category: expenseByCategory,
    transaction_count: (rows || []).length,
    recent: (rows || []).slice(0, 25).map((t) => ({
      type: t.type,
      category: t.category,
      amount: money(t.amount),
      payment_method: t.payment_method,
      description: t.description,
      order_number: t.order_number || null,
      at: t.created_at,
    })),
  });
}

async function recordMoney(req, res, kind) {
  const body = req.body || {};
  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return fail(res, 400, 'amount debe ser un numero entre 0 y 100000', 'invalid_body');
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 300) : '';
  if (!description) return fail(res, 400, 'description es requerido', 'invalid_body');
  const method = body.payment_method ? String(body.payment_method) : 'cash';
  if (!PAYMENT_METHODS.includes(method)) return fail(res, 400, `payment_method invalido. Validos: ${PAYMENT_METHODS.join(', ')}`, 'invalid_body');

  let orderNumber = null;
  let finalDescription = description;
  if (body.order && kind === 'expense') {
    const order = await findOrder(body.order);
    if (!order) return fail(res, 404, 'Boleto no encontrado', 'not_found');
    orderNumber = order.order_number;
    if (!description.includes(order.order_number)) finalDescription = `${description} · ${order.order_number}`;
  }

  let category;
  if (kind === 'income') {
    category = 'repair_payment';
  } else {
    category = body.category ? String(body.category) : (orderNumber ? 'parts' : 'other_expense');
    if (!EXPENSE_CATEGORIES.includes(category)) return fail(res, 400, `category invalida. Validas: ${EXPENSE_CATEGORIES.join(', ')}`, 'invalid_body');
  }
  const type = kind === 'income' ? 'revenue' : 'expense';

  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const dupes = await sb(
    `transaction?tenant_id=eq.${TENANT_ID}&type=eq.${type}&recorded_by=eq.${ACTOR}&amount=eq.${amount}` +
    `&description=eq.${encodeURIComponent(finalDescription)}&created_at=gte.${since}&is_deleted=eq.false&select=id,created_at&limit=1`
  );
  if (dupes && dupes.length > 0) {
    return res.status(200).json({ ok: true, duplicate: true, id: dupes[0].id, note: 'Ya existia un registro identico de los ultimos 10 minutos; no se duplico.' });
  }

  const row = {
    tenant_id: TENANT_ID,
    type,
    category,
    amount: money(amount),
    description: finalDescription,
    payment_method: method,
    recorded_by: ACTOR,
    is_settled: true,
  };
  if (orderNumber) row.order_number = orderNumber;
  if (kind === 'income') row.deductible_tax = false;
  const inserted = await sb('transaction', { method: 'POST', body: row, prefer: 'return=representation' });
  const tx = Array.isArray(inserted) ? inserted[0] : inserted;
  return res.status(200).json({
    ok: true,
    id: tx?.id || null,
    type,
    category,
    amount: money(amount),
    description: finalDescription,
    payment_method: method,
  });
}

function openapi() {
  const bearer = [{ bearerAuth: [] }];
  const refParam = {
    name: 'ref',
    in: 'path',
    required: true,
    description: 'Numero de boleto (ej. WO-25001 o 25001) o id del boleto',
    schema: { type: 'string' },
  };
  return {
    openapi: '3.0.3',
    info: {
      title: 'Archilla OS - Operaciones del taller (uso personal)',
      version: '1.0.0',
      description:
        'API personal para consultar boletos, cambiar estatus, escribirle al cliente y registrar gastos o ingresos del taller. ' +
        'Todas las rutas (excepto este documento) requieren el header Authorization: Bearer <token>. ' +
        'Antes de cambiar un estatus, enviar un email o registrar dinero, confirma con el dueno.',
    },
    servers: [{ url: PUBLIC_BASE }],
    security: bearer,
    components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } } },
    paths: {
      '/ping': {
        get: { operationId: 'ping', summary: 'Verifica el token y devuelve el nombre del taller', responses: { 200: { description: 'ok' } } },
      },
      '/orders': {
        get: {
          operationId: 'listOrders',
          summary: 'Lista boletos. Por defecto los activos (no cerrados), el mas reciente primero.',
          parameters: [
            {
              name: 'status', in: 'query', required: false,
              description: 'active (default), all, o lista separada por comas: ' + Object.keys(STATUS_LABELS).join(', '),
              schema: { type: 'string', default: 'active' },
            },
            { name: 'q', in: 'query', required: false, description: 'Busca por nombre, telefono, numero de boleto o modelo', schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', default: 30, maximum: 100 } },
          ],
          responses: { 200: { description: 'Lista de boletos con estado, piezas, saldo y ultima actualizacion' } },
        },
      },
      '/orders/{ref}': {
        get: {
          operationId: 'getOrder',
          summary: 'Detalle de un boleto: historial de estatus, piezas, pagos y ultimo mensaje al cliente',
          parameters: [refParam],
          responses: { 200: { description: 'Boleto' }, 404: { description: 'No existe' } },
        },
      },
      '/orders/{ref}/status': {
        post: {
          operationId: 'changeOrderStatus',
          summary: 'Cambia el estatus de un boleto. Confirma con el dueno antes de llamarlo.',
          parameters: [refParam],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: {
                    status: { type: 'string', enum: Object.keys(STATUS_LABELS).filter((s) => !BLOCKED_STATUSES.includes(s)) },
                    note: { type: 'string', description: 'Mensaje del taller guardado en el boleto (el cliente lo ve en el correo de estatus)' },
                    notify_customer: { type: 'boolean', default: false, description: 'true envia el correo de actualizacion al cliente' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Boleto actualizado' }, 409: { description: 'Requiere hacerse desde la app (saldo pendiente, garantia, abandono)' } },
        },
      },
      '/orders/{ref}/email': {
        post: {
          operationId: 'emailCustomer',
          summary: 'Envia un correo al cliente del boleto con un mensaje libre. Confirma el texto con el dueno antes.',
          parameters: [refParam],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['message'],
                  properties: {
                    message: { type: 'string', description: 'Texto del correo, en espanol, tono cordial' },
                    subject: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Enviado' }, 409: { description: 'El cliente no tiene email' } },
        },
      },
      '/finance/summary': {
        get: {
          operationId: 'financeSummary',
          summary: 'Resumen del dia: ventas, devoluciones, gastos, neto, por metodo de pago y movimientos recientes',
          parameters: [{ name: 'date', in: 'query', required: false, description: 'YYYY-MM-DD en hora de Puerto Rico. Por defecto hoy.', schema: { type: 'string' } }],
          responses: { 200: { description: 'Resumen' } },
        },
      },
      '/finance/expense': {
        post: {
          operationId: 'addExpense',
          summary: 'Registra un gasto (por ejemplo piezas compradas). Confirma monto y descripcion con el dueno.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount', 'description'],
                  properties: {
                    amount: { type: 'number' },
                    description: { type: 'string' },
                    category: { type: 'string', enum: EXPENSE_CATEGORIES, description: 'parts por defecto si se liga a un boleto, other si no' },
                    payment_method: { type: 'string', enum: PAYMENT_METHODS, default: 'cash' },
                    order: { type: 'string', description: 'Numero de boleto al que pertenece el gasto (opcional)' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Registrado (o duplicado ignorado)' } },
        },
      },
      '/finance/income': {
        post: {
          operationId: 'addIncome',
          summary: 'Registra un ingreso manual que no es el pago de un boleto. Los pagos de boletos se cobran desde la app.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount', 'description'],
                  properties: {
                    amount: { type: 'number' },
                    description: { type: 'string' },
                    payment_method: { type: 'string', enum: PAYMENT_METHODS, default: 'cash' },
                  },
                },
              },
            },
          },
          responses: { 200: { description: 'Registrado (o duplicado ignorado)' } },
        },
      },
    },
  };
}

function segments(req) {
  const raw = req.query?.muse;
  if (Array.isArray(raw)) return raw.flatMap((r) => String(r).split('/')).filter(Boolean);
  if (typeof raw === 'string' && raw) return raw.split('/').filter(Boolean);
  const path = String(req.url || '').split('?')[0].replace(/^\/api\/muse\/?/, '');
  return path.split('/').filter(Boolean);
}

export async function museHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const parts = segments(req);

  if (req.method === 'GET' && parts.length === 1 && parts[0] === 'openapi.json') {
    return res.status(200).json(openapi());
  }

  if (!API_TOKEN || !TENANT_ID || !SB_KEY) return fail(res, 503, 'Servicio no configurado', 'not_configured');
  if (!tokenOk(req.headers.authorization)) return fail(res, 401, 'Token invalido', 'unauthorized');
  if (rateLimited()) return fail(res, 429, 'Demasiadas solicitudes, espera un minuto', 'rate_limited');

  try {
    const [a, b, c] = parts;
    if (req.method === 'GET' && a === 'ping' && !b) {
      const shop = await shopInfo();
      return res.status(200).json({ ok: true, shop: shop.name, server_time: new Date().toISOString(), today: prDayRange().day });
    }
    if (a === 'orders') {
      if (req.method === 'GET' && !b) return await listOrders(req, res);
      if (req.method === 'GET' && b && !c) return await getOrder(req, res, b);
      if (req.method === 'POST' && b && c === 'status') return await changeStatus(req, res, b);
      if (req.method === 'POST' && b && c === 'email') return await emailCustomer(req, res, b);
    }
    if (a === 'finance') {
      if (req.method === 'GET' && b === 'summary') return await financeSummary(req, res);
      if (req.method === 'POST' && b === 'expense') return await recordMoney(req, res, 'expense');
      if (req.method === 'POST' && b === 'income') return await recordMoney(req, res, 'income');
    }
    return fail(res, 404, 'Ruta no encontrada', 'not_found');
  } catch (e) {
    console.error('muse api error:', e.message);
    return fail(res, e.status && e.status < 500 ? 400 : 502, 'Error al hablar con la base de datos', 'upstream_error');
  }
}
