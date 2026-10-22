import crypto from 'node:crypto';
import { requireMember } from '../../lib/server/requireMember.js';
import { jaimeHandler, actorStore } from './jaime.js';
import { SB_URL, SB_KEY, sb, money, prDayRange } from './muse.js';

const TENANT_ID = process.env.MUSE_TENANT_ID || '';
const SECRET = process.env.ASSISTANT_KEY_SECRET || '';
const SERVICE_TOKEN = process.env.JAIME_API_TOKEN || '';
const IVU = 0.115;
const MAX_ITERATIONS = 8;
const MAX_HISTORY = 60;
const MAX_TOOL_RESULT_CHARS = 6000;

const PROVIDERS = {
  anthropic: { label: 'Anthropic (Claude)', baseUrl: 'https://api.anthropic.com', models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5'] },
  openai: { label: 'OpenAI (ChatGPT)', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4.1', 'gpt-4.1-mini'] },
  meta: { label: 'Meta (Muse)', baseUrl: 'https://api.meta.ai/v1', models: ['muse-spark-1.3'] },
  openai_compatible: { label: 'Compatible con OpenAI (Ollama, Gemini, otros)', baseUrl: '', models: [] },
};

const PRICES = [
  { match: /opus-5-5/, entrada: 4, salida: 20, cacheLectura: 0.2, cacheEscritura: 5 },
  { match: /sonnet-5/, entrada: 2, salida: 10, cacheLectura: 0.1, cacheEscritura: 2.5 },
  { match: /haiku-5-5/, entrada: 0.1, salida: 0.5, cacheLectura: 0.01, cacheEscritura: 0.125 },
];

export function costUsd(model, u) {
  const price = PRICES.find((p) => p.match.test(String(model || '')));
  if (!price) return 0;
  return ((u.entrada || 0) * price.entrada + (u.salida || 0) * price.salida + (u.cache_lectura || 0) * price.cacheLectura + (u.cache_escritura || 0) * price.cacheEscritura) / 1_000_000;
}

function withIvu(n) {
  return money(Number(n) * (1 + IVU));
}

function fmt(n) {
  return `$${money(n).toFixed(2)}`;
}

function encryptKey(plain) {
  const key = crypto.createHash('sha256').update(SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function decryptKey(blob) {
  const raw = Buffer.from(blob, 'base64');
  const key = crypto.createHash('sha256').update(SECRET).digest();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

async function loadConfig(tenantId) {
  const rows = await sb(`app_settings?slug=eq.ai-assistant-${tenantId}&select=id,payload&limit=1`);
  const row = rows?.[0];
  if (!row) return { row: null, config: null };
  return { row, config: row.payload || null };
}

async function saveConfig(tenantId, payload) {
  const { row } = await loadConfig(tenantId);
  if (row) {
    await sb(`app_settings?id=eq.${row.id}`, { method: 'PATCH', body: { payload }, prefer: 'return=minimal' });
  } else {
    await sb('app_settings', { method: 'POST', body: { slug: `ai-assistant-${tenantId}`, payload }, prefer: 'return=minimal' });
  }
}

async function usageSlug(tenantId) {
  return `ai-usage-${tenantId}-${prDayRange().day.slice(0, 7)}`;
}

async function loadUsage(tenantId) {
  const slug = await usageSlug(tenantId);
  const rows = await sb(`app_settings?slug=eq.${slug}&select=id,payload&limit=1`);
  return { slug, row: rows?.[0] || null, usage: rows?.[0]?.payload || { entrada: 0, salida: 0, llamadas: 0 } };
}

async function addUsage(tenantId, delta) {
  const { slug, row, usage } = await loadUsage(tenantId);
  const next = {
    entrada: (usage.entrada || 0) + delta.entrada,
    salida: (usage.salida || 0) + delta.salida,
    cache_lectura: (usage.cache_lectura || 0) + (delta.cache_lectura || 0),
    cache_escritura: (usage.cache_escritura || 0) + (delta.cache_escritura || 0),
    usd: Math.round(((usage.usd || 0) + (delta.usd || 0)) * 1_000_000) / 1_000_000,
    llamadas: (usage.llamadas || 0) + delta.llamadas,
  };
  if (row) await sb(`app_settings?id=eq.${row.id}`, { method: 'PATCH', body: { payload: next }, prefer: 'return=minimal' });
  else await sb('app_settings', { method: 'POST', body: { slug, payload: next }, prefer: 'return=minimal' });
  return next;
}

function meter(usage, config) {
  const total = (usage.entrada || 0) + (usage.salida || 0) + (usage.cache_lectura || 0) + (usage.cache_escritura || 0);
  const topeTokens = Number(config?.tope_tokens_mes) || 0;
  const topeUsd = Number(config?.tope_usd_mes) || 0;
  const usd = Math.round((usage.usd || 0) * 10000) / 10000;
  let pct = null;
  if (topeUsd > 0) pct = Math.min(100, Math.round((usd / topeUsd) * 100));
  else if (topeTokens > 0) pct = Math.min(100, Math.round((total / topeTokens) * 100));
  let aviso = null;
  if (pct !== null && pct >= 100) aviso = 'Llegaste al tope mensual de consumo de IA.';
  else if (pct !== null && pct >= 80) aviso = `Llevas ${pct}% de tu tope mensual de consumo de IA.`;
  return {
    periodo: prDayRange().day.slice(0, 7),
    tokens_total: total,
    llamadas: usage.llamadas || 0,
    usd_usado: usd,
    tope_usd_mes: topeUsd,
    usd_restante: topeUsd > 0 ? Math.max(0, Math.round((topeUsd - usd) * 100) / 100) : null,
    tope_tokens_mes: topeTokens,
    tokens_restantes: topeTokens > 0 ? Math.max(0, topeTokens - total) : null,
    porcentaje_usado: pct,
    aviso,
  };
}

function publicConfig(config) {
  return {
    provider: config?.provider || 'anthropic',
    model: config?.model || '',
    base_url: config?.base_url || '',
    tiene_llave: Boolean(config?.key_enc),
    tope_tokens_mes: Number(config?.tope_tokens_mes) || 0,
    tope_usd_mes: Number(config?.tope_usd_mes) || 0,
    proveedores: Object.entries(PROVIDERS).map(([id, p]) => ({ id, nombre: p.label, modelos_sugeridos: p.models, requiere_base_url: id === 'openai_compatible' })),
  };
}

function textOf(blocks) {
  return (Array.isArray(blocks) ? blocks : []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}

export function toOpenAiMessages(system, messages) {
  const out = [{ role: 'system', content: system }];
  for (const m of messages) {
    const blocks = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
    if (m.role === 'assistant') {
      const text = textOf(blocks);
      const calls = blocks.filter((b) => b.type === 'tool_use').map((b) => ({
        id: b.id,
        type: 'function',
        function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
      }));
      const msg = { role: 'assistant', content: text || null };
      if (calls.length) msg.tool_calls = calls;
      out.push(msg);
    } else {
      const results = blocks.filter((b) => b.type === 'tool_result');
      for (const r of results) out.push({ role: 'tool', tool_call_id: r.tool_use_id, content: typeof r.content === 'string' ? r.content : JSON.stringify(r.content) });
      const text = textOf(blocks);
      if (text) out.push({ role: 'user', content: text });
    }
  }
  return out;
}

export function fromOpenAiMessage(message) {
  const blocks = [];
  if (message?.content) blocks.push({ type: 'text', text: message.content });
  for (const call of message?.tool_calls || []) {
    let input = {};
    try { input = JSON.parse(call.function?.arguments || '{}'); } catch { input = {}; }
    blocks.push({ type: 'tool_use', id: call.id, name: call.function?.name, input });
  }
  return blocks;
}

async function providerCall(config, apiKey, system, messages, tools) {
  const provider = config.provider;
  if (provider === 'anthropic') {
    const res = await fetch(`${(config.base_url || PROVIDERS.anthropic.baseUrl).replace(/\/$/, '')}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 2048,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages,
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data?.error?.message || `Anthropic ${res.status}`), { provider: true, status: res.status });
    return {
      blocks: (data.content || []).filter((b) => b.type === 'text' || b.type === 'tool_use').map((b) => (b.type === 'text' ? { type: 'text', text: b.text } : { type: 'tool_use', id: b.id, name: b.name, input: b.input || {} })),
      usage: {
        entrada: Number(data.usage?.input_tokens) || 0,
        salida: Number(data.usage?.output_tokens) || 0,
        cache_lectura: Number(data.usage?.cache_read_input_tokens) || 0,
        cache_escritura: Number(data.usage?.cache_creation_input_tokens) || 0,
      },
    };
  }
  const base = (config.base_url || PROVIDERS[provider]?.baseUrl || PROVIDERS.openai.baseUrl).replace(/\/$/, '');
  const headers = { 'content-type': 'application/json' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: toOpenAiMessages(system, messages),
      tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data?.error?.message || `Proveedor ${res.status}`), { provider: true, status: res.status });
  return {
    blocks: fromOpenAiMessage(data.choices?.[0]?.message),
    usage: { entrada: Number(data.usage?.prompt_tokens) || 0, salida: Number(data.usage?.completion_tokens) || 0 },
  };
}

function callApi(method, path, { query = {}, body } = {}, actor) {
  return new Promise((resolve) => {
    const parts = path.split('/').filter(Boolean);
    const cleanQuery = {};
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') cleanQuery[k] = String(v);
    const req = {
      method,
      headers: { authorization: `Bearer ${SERVICE_TOKEN}` },
      query: { jaime: parts.join('/'), ...cleanQuery },
      body: body || {},
      url: `/api/jaime/${parts.join('/')}`,
    };
    const res = {
      statusCode: 200,
      setHeader() {},
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
    };
    actorStore.run({ actor }, () => {
      Promise.resolve(jaimeHandler(req, res)).catch((e) => resolve({ status: 500, body: { ok: false, error: String(e.message || e) } }));
    });
  });
}

const str = (description) => ({ type: 'string', description });
const num = (description) => ({ type: 'number', description });
const ticketRef = str('Numero del boleto, ej. WO-382, o su id');
const PAYMENT_ENUM = ['efectivo', 'ath_movil', 'tarjeta', 'transferencia'];
const pieceLine = {
  type: 'object',
  properties: {
    nombre: str('Nombre de la pieza'),
    producto_id: str('Id del producto si salio de buscar_inventario'),
    cantidad: { type: 'integer' },
    precio: num('Precio unitario SIN IVU'),
    costo: num('Costo unitario del taller'),
    suplidor: str('Suplidor'),
  },
};

function pieceTotal(p) {
  return withIvu(Number(p.precio || 0) * Number(p.cantidad || 1));
}

export const TOOLS = [
  {
    name: 'buscar_boletos',
    description: 'Busca boletos. Por defecto los activos. Filtra por estatus, cliente, telefono, numero, fechas o saldo pendiente.',
    input_schema: {
      type: 'object',
      properties: {
        q: str('Cliente, telefono o numero de boleto'),
        estatus: str('activos, cerrados, todos o ids separados por coma (ver lista_estatus)'),
        desde: str('YYYY-MM-DD'),
        hasta: str('YYYY-MM-DD'),
        con_saldo: { type: 'boolean' },
        limite: { type: 'integer' },
      },
    },
    run: (a) => ({ method: 'GET', path: 'tickets', query: a }),
  },
  {
    name: 'ver_boleto',
    description: 'Detalle completo de un boleto: historial, notas, piezas con costo, fotos y pagos.',
    input_schema: { type: 'object', required: ['numero'], properties: { numero: ticketRef } },
    run: (a) => ({ method: 'GET', path: `tickets/${encodeURIComponent(a.numero)}` }),
  },
  {
    name: 'piezas_del_boleto',
    description: 'Piezas facturadas, por ordenar y compras vinculadas de un boleto, con su costo.',
    input_schema: { type: 'object', required: ['numero'], properties: { numero: ticketRef } },
    run: (a) => ({ method: 'GET', path: `tickets/${encodeURIComponent(a.numero)}/piezas` }),
  },
  {
    name: 'buscar_inventario',
    description: 'Busca productos, piezas y servicios del inventario y el POS por nombre, SKU o codigo de barras. Devuelve precio SIN IVU y stock.',
    input_schema: { type: 'object', properties: { q: str('Texto a buscar'), tipo: { type: 'string', enum: ['producto', 'servicio'] }, con_stock: { type: 'boolean' }, limite: { type: 'integer' } } },
    run: (a) => ({ method: 'GET', path: 'pos/productos', query: a }),
  },
  {
    name: 'resumen_del_dia',
    description: 'Cobrado, devoluciones, gastos, ganancia estimada y boletos creados de un dia.',
    input_schema: { type: 'object', properties: { fecha: str('YYYY-MM-DD, por defecto hoy') } },
    run: (a) => ({ method: 'GET', path: 'resumen', query: a }),
  },
  {
    name: 'alertas',
    description: 'Boletos nuevos hoy, listos sin cobrar y esperando piezas con las piezas por pedir.',
    input_schema: { type: 'object', properties: {} },
    run: () => ({ method: 'GET', path: 'alertas' }),
  },
  {
    name: 'ordenes_compra',
    description: 'Ordenes de compra a suplidores con pieza, costo, fecha y boleto asociado.',
    input_schema: { type: 'object', properties: { boleto: str('Numero de boleto'), estado: str('Estado de la orden'), desde: str('YYYY-MM-DD') } },
    run: (a) => ({ method: 'GET', path: 'ordenes-compra', query: a }),
  },
  {
    name: 'lista_estatus',
    description: 'Estatus validos del sistema con su nombre exacto.',
    input_schema: { type: 'object', properties: {} },
    run: () => ({ method: 'GET', path: 'estatus' }),
  },
  {
    name: 'crear_boleto',
    description: 'Crea un boleto nuevo en Recepcion. Antes de llamarla debes tener nombre, apellido, telefono, email (puede no tener), equipo y problema. Las piezas llevan precio SIN IVU. Si el usuario mando fotos, pasa sus URLs en fotos.',
    input_schema: {
      type: 'object',
      required: ['cliente', 'equipo', 'problema'],
      properties: {
        cliente: str('Nombre y apellido'),
        telefono: str('Telefono'),
        email: str('Email'),
        equipo: str('Descripcion del equipo, ej. Samsung Galaxy S24 Ultra'),
        marca: str('Marca'),
        modelo: str('Modelo'),
        problema: str('Problema reportado'),
        fecha_prometida: str('YYYY-MM-DD'),
        notas: { type: 'array', items: { type: 'string' } },
        piezas: { type: 'array', items: pieceLine },
        fotos: { type: 'array', items: { type: 'string' }, description: 'URLs de las fotos adjuntas por el usuario' },
        notificar_cliente: { type: 'boolean' },
      },
    },
    mutating: true,
    run: (a) => ({ method: 'POST', path: 'tickets', body: a }),
    resumen: (a) => {
      const lines = [`Crear boleto para ${a.cliente}${a.telefono ? ` (${a.telefono})` : ''}${a.email ? `, ${a.email}` : ''}`, `Equipo: ${a.equipo}`, `Problema: ${a.problema}`];
      let total = 0;
      for (const p of a.piezas || []) {
        const t = pieceTotal(p);
        total += t;
        lines.push(`Pieza: ${p.cantidad || 1} x ${p.nombre || 'pieza'}, ${fmt(p.precio || 0)} sin IVU, ${fmt(t)} con IVU`);
      }
      if (total > 0) lines.push(`Total con IVU: ${fmt(total)}`);
      if ((a.fotos || []).length) lines.push(`Fotos adjuntas: ${a.fotos.length}`);
      if (a.email && a.notificar_cliente !== false) lines.push(`Se enviara correo de recepcion a ${a.email}`);
      return lines.join('\n');
    },
    hecho: (r) => (r.body?.ok ? `Boleto ${r.body.numero} creado` : null),
  },
  {
    name: 'actualizar_boleto',
    description: 'Cambia el estatus de un boleto y/o corrige su equipo, marca o modelo. El cambio de estatus notifica al cliente por defecto.',
    input_schema: {
      type: 'object',
      required: ['numero'],
      properties: {
        numero: ticketRef,
        estatus: str('Estatus destino (ver lista_estatus)'),
        equipo: str('Descripcion del equipo'),
        marca: str('Marca'),
        modelo: str('Modelo'),
        nota: str('Mensaje del taller para el cliente'),
        motivo: str('Motivo del cambio de equipo'),
        notificar_cliente: { type: 'boolean' },
      },
    },
    mutating: true,
    run: (a) => {
      const { numero, ...rest } = a;
      return { method: 'PATCH', path: `tickets/${encodeURIComponent(numero)}`, body: rest };
    },
    resumen: (a) => {
      const lines = [`Boleto ${a.numero}`];
      if (a.estatus) lines.push(`Nuevo estatus: ${a.estatus}${a.notificar_cliente === false ? ' (sin avisar al cliente)' : ' (se avisa al cliente por correo)'}`);
      if (a.equipo || a.marca || a.modelo) lines.push(`Corregir equipo a: ${[a.marca, a.modelo || a.equipo].filter(Boolean).join(' ')}`);
      if (a.nota) lines.push(`Mensaje: ${a.nota}`);
      return lines.join('\n');
    },
    hecho: (r) => (r.body?.ok ? `Boleto actualizado${r.body.ticket?.estatus_nombre ? `: ${r.body.ticket.estatus_nombre}` : ''}` : null),
  },
  {
    name: 'agregar_nota',
    description: 'Agrega una nota al boleto. tipo interna (solo equipo), cliente (se le envia por correo) o nota.',
    input_schema: { type: 'object', required: ['numero', 'texto'], properties: { numero: ticketRef, texto: str('Texto de la nota'), tipo: { type: 'string', enum: ['interna', 'cliente', 'nota'] } } },
    mutating: true,
    run: (a) => ({ method: 'POST', path: `tickets/${encodeURIComponent(a.numero)}/notas`, body: { texto: a.texto, tipo: a.tipo } }),
    resumen: (a) => `Nota ${a.tipo === 'cliente' ? 'para el cliente (se envia por correo)' : 'interna'} en ${a.numero}:\n${a.texto}`,
    hecho: (r) => (r.body?.ok ? 'Nota agregada' : null),
  },
  {
    name: 'adjuntar_foto',
    description: 'Adjunta una foto (URL subida por el usuario) a un boleto existente.',
    input_schema: { type: 'object', required: ['numero', 'url'], properties: { numero: ticketRef, url: str('URL de la foto'), nota: str('Descripcion') } },
    mutating: true,
    run: (a) => ({ method: 'POST', path: `tickets/${encodeURIComponent(a.numero)}/fotos`, body: { url: a.url, nota: a.nota } }),
    resumen: (a) => `Adjuntar una foto al boleto ${a.numero}`,
    hecho: (r) => (r.body?.ok ? 'Foto adjuntada' : null),
  },
  {
    name: 'agregar_pieza_a_boleto',
    description: 'Agrega una pieza al boleto para facturarla y descuenta el inventario si es un producto con stock. Busca primero en el inventario con buscar_inventario. El precio es SIN IVU.',
    input_schema: { type: 'object', required: ['numero', 'precio'], properties: { numero: ticketRef, ...pieceLine.properties } },
    mutating: true,
    run: (a) => {
      const { numero, ...rest } = a;
      return { method: 'POST', path: `tickets/${encodeURIComponent(numero)}/piezas`, body: rest };
    },
    resumen: (a) => `Agregar a ${a.numero}: ${a.cantidad || 1} x ${a.nombre || 'pieza del inventario'}\nPrecio unitario sin IVU: ${fmt(a.precio)}\nTotal con IVU: ${fmt(pieceTotal(a))}${a.producto_id ? '\nSe descuenta del inventario' : ''}`,
    hecho: (r) => (r.body?.ok ? `Pieza agregada, total del boleto ${fmt(r.body.total_facturado)}` : null),
  },
  {
    name: 'crear_pieza_inventario',
    description: 'Crea una pieza nueva en el inventario cuando buscar_inventario no la encuentra. Precio y costo SIN IVU.',
    input_schema: { type: 'object', required: ['nombre', 'precio'], properties: { nombre: str('Nombre'), marca: str('Marca'), modelo: str('Modelo'), categoria: str('Categoria'), costo: num('Costo'), precio: num('Precio de venta sin IVU'), stock: num('Cantidad en stock'), stock_minimo: num('Minimo'), suplidor: str('Suplidor') } },
    mutating: true,
    run: (a) => ({ method: 'POST', path: 'piezas', body: a }),
    resumen: (a) => `Crear pieza en inventario: ${a.nombre}\nPrecio sin IVU ${fmt(a.precio)}, con IVU ${fmt(withIvu(a.precio))}${a.costo !== undefined ? `\nCosto ${fmt(a.costo)}` : ''}\nStock inicial: ${a.stock ?? 0}`,
    hecho: (r) => (r.body?.ok ? 'Pieza creada en el inventario' : null),
  },
  {
    name: 'registrar_pago',
    description: 'Registra un pago o deposito de un boleto ya recibido. Nunca lo registres si el dinero no se ha recibido.',
    input_schema: { type: 'object', required: ['numero', 'monto', 'metodo'], properties: { numero: ticketRef, monto: num('Monto exacto recibido'), metodo: { type: 'string', enum: PAYMENT_ENUM }, nota: str('Nota'), notificar_cliente: { type: 'boolean' } } },
    mutating: true,
    run: (a) => ({ method: 'POST', path: `tickets/${encodeURIComponent(a.numero)}/pagos`, body: { monto: a.monto, metodo: a.metodo, nota: a.nota, notificar_cliente: a.notificar_cliente } }),
    resumen: (a) => `Registrar pago de ${fmt(a.monto)} por ${a.metodo} en ${a.numero}${a.notificar_cliente === false ? '' : '\nSe envia recibo al cliente por correo'}`,
    hecho: (r) => (r.body?.ok ? `Pago de ${fmt(r.body.pago?.monto)} registrado, balance ${fmt(r.body.ticket?.balance_pendiente)}` : null),
  },
  {
    name: 'venta_mostrador',
    description: 'Registra una venta de mostrador: descuenta stock, registra el ingreso y la deja en el historial del POS. Requiere caja abierta. Precios SIN IVU.',
    input_schema: {
      type: 'object',
      required: ['items', 'metodo'],
      properties: {
        items: { type: 'array', items: { type: 'object', properties: { producto_id: str('Id del producto'), nombre: str('Nombre'), cantidad: { type: 'integer' }, precio: num('Precio unitario sin IVU'), descuento_pct: num('0 a 100') } } },
        metodo: { type: 'string', enum: PAYMENT_ENUM },
        monto_recibido: num('Solo efectivo'),
        email_cliente: str('Para enviar recibo'),
        notas: str('Notas'),
      },
    },
    mutating: true,
    run: (a) => ({ method: 'POST', path: 'pos/ventas', body: a }),
    resumen: (a) => {
      const lines = (a.items || []).map((i) => `${i.cantidad || 1} x ${i.nombre || 'producto'}${i.precio !== undefined ? `, ${fmt(i.precio)} sin IVU` : ''}`);
      const subtotal = (a.items || []).reduce((s, i) => s + Number(i.precio || 0) * Number(i.cantidad || 1) * (1 - Number(i.descuento_pct || 0) / 100), 0);
      const tail = subtotal > 0 ? `\nTotal estimado con IVU: ${fmt(withIvu(subtotal))}` : '\nEl total con IVU lo calcula el sistema con el precio del producto';
      return `Venta de mostrador por ${a.metodo}\n${lines.join('\n')}${tail}`;
    },
    hecho: (r) => (r.body?.ok ? `Venta ${r.body.venta?.numero} registrada por ${fmt(r.body.venta?.total)}` : null),
  },
  {
    name: 'registrar_ingreso',
    description: 'Registra un ingreso suelto que no es pago de boleto ni venta del POS.',
    input_schema: { type: 'object', required: ['monto', 'metodo', 'concepto'], properties: { monto: num('Monto'), metodo: { type: 'string', enum: PAYMENT_ENUM }, concepto: str('Concepto'), fecha: str('YYYY-MM-DD') } },
    mutating: true,
    run: (a) => ({ method: 'POST', path: 'finanzas/ingresos', body: a }),
    resumen: (a) => `Registrar ingreso de ${fmt(a.monto)} por ${a.metodo}: ${a.concepto}`,
    hecho: (r) => (r.body?.ok ? 'Ingreso registrado' : null),
  },
  {
    name: 'ajustar_stock',
    description: 'Corrige el stock de un producto con motivo. Envia stock (cantidad final) o ajuste (diferencia).',
    input_schema: { type: 'object', required: ['producto_id', 'motivo'], properties: { producto_id: str('Id del producto'), stock: num('Cantidad final'), ajuste: num('Diferencia'), motivo: str('Motivo') } },
    mutating: true,
    run: (a) => ({ method: 'PATCH', path: `pos/productos/${encodeURIComponent(a.producto_id)}`, body: { stock: a.stock, ajuste: a.ajuste, motivo: a.motivo } }),
    resumen: (a) => `Ajustar stock del producto ${a.producto_id}: ${a.stock !== undefined ? `dejar en ${a.stock}` : `sumar ${a.ajuste}`}\nMotivo: ${a.motivo}`,
    hecho: (r) => (r.body?.ok ? 'Stock ajustado' : null),
  },
];

const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

function systemPrompt(shopName, actorLabel) {
  const today = prDayRange().day;
  return [
    `Eres el Asistente IA de ${shopName}, un taller de reparacion de celulares y electronicos en Puerto Rico. Trabajas dentro de Archilla OS para ${actorLabel}. Hoy es ${today} (hora de Puerto Rico). Hablas en espanol, claro, breve y amable.`,
    'Tu trabajo es ejecutar tareas del sistema con las herramientas disponibles y reducir el trabajo de botones. Si falta informacion para una tarea, preguntala como lo haria una persona, UNA pregunta corta a la vez, sin pedir todo junto.',
    'Para crear un boleto, si solo te dicen "crea un boleto", pregunta en este orden: nombre del cliente, apellido, telefono, email (puede no tener), equipo y cual es el problema. Despues pregunta si quiere tomar fotos del equipo con la camara del chat. No inventes datos del cliente.',
    'Cuando tengas todo para una accion que escribe datos, llama la herramienta directamente: la app le muestra al usuario un resumen y espera su confirmacion, no preguntes en texto "confirmas?".',
    'Los precios de piezas y servicios se manejan SIN IVU; el sistema suma el 11.5%. Siempre que menciones un precio al usuario di el total CON IVU incluido. Antes de agregar una pieza a un boleto busca en el inventario con buscar_inventario; si no existe, pregunta el precio sin IVU y el costo, y ofrece crearla con crear_pieza_inventario.',
    'Nunca registres un pago que no se ha recibido. Pagos y piezas con precio requieren monto exacto confirmado.',
    'No puedes borrar boletos, clientes ni registros: no hay herramientas para eso, y si te lo piden explica que se hace desde la app.',
    'Si el usuario manda fotos, vienen como URLs en su mensaje; al crear el boleto pasalas en el campo fotos. Responde corto: confirma lo hecho y ofrece el siguiente paso.',
    'Usa numeros de boleto como WO-382. Si no estas seguro del boleto, buscalo primero.',
    'Estatus con frases naturales: "ya recogi la pieza", "ya llego la pieza", "voy a trabajar este equipo" o "empiezo con este" pasan el boleto a in_progress (En reparacion); "ya termine este equipo" lo pasa a ready_for_pickup (Listo para recoger) y antes de llamar la herramienta le preguntas si le avisas al cliente por correo y pasas notificar_cliente segun su respuesta; "pedi la pieza" lo pasa a waiting_parts (Esperando piezas). Si no queda claro de que boleto habla, usa el ultimo boleto de la conversacion o pregunta. Despues de cada cambio confirma en una frase que cambiaste.',
    'Reglas del negocio que siempre sigues sin que te las recuerden: todo precio que le reportas al dueno va CON IVU incluido; los precios de piezas se entran SIN IVU. Nunca bajes un precio cotizado sin aprobacion explicita del dueno. Nunca reveles a un cliente el costo de las piezas ni el margen. Formula de cotizacion: costo de la pieza del suplidor + labor + IVU 11.5%. Las pantallas de Samsung se cotizan solo con marco.',
    'Deposito para un cliente nuevo: el mayor entre el 50% del total y el costo de las piezas; es un calculo interno, al cliente solo se le pide el monto. Nunca registres un deposito o pago antes de que el dinero haya llegado de verdad. Antes de cualquier pago confirma monto, quien paga, boleto y metodo. Datos minimos de un cliente nuevo: nombre, apellido, email y telefono.',
    'Mensajes a clientes: nunca salen sin que el dueno vea el borrador y lo apruebe, mensaje por mensaje; un numero de telefono no es una aprobacion. Di "la ordenamos", nunca "compramos", al hablar de piezas. Tono suave y directo: prefiere "Tenemos dos alternativas que te podemos ofrecer" a "Tienes dos opciones", y evita frases que suenen a regano o a que la tienda fallo.',
    'Nunca actues sobre un numero de boleto que no resuelva en el sistema: si no existe, busca candidatos parecidos con buscar_boletos y preguntale al dueno cual es. Todo lo que haces queda en el historial del boleto como si lo hiciera un usuario. Nunca pidas ni repitas llaves de API o credenciales en el chat.',
    'Si al crear un boleto o agregar una pieza el inventario no la tiene, dilo y pregunta que quiere hacer: crearla en el inventario o dejarla pendiente de ordenar. Las busquedas en suplidores y las ordenes de compra desde el chat todavia no estan disponibles; no prometas hacerlas.',
  ].join('\n');
}

function trimResult(body) {
  let text = JSON.stringify(body);
  if (text.length > MAX_TOOL_RESULT_CHARS) text = `${text.slice(0, MAX_TOOL_RESULT_CHARS)}...[recortado]`;
  return text;
}

async function execTool(toolUse, actor, deps) {
  const tool = TOOL_BY_NAME.get(toolUse.name);
  if (!tool) return { status: 404, body: { ok: false, error: `Herramienta desconocida: ${toolUse.name}` } };
  const call = tool.run(toolUse.input || {});
  const result = await deps.callApi(call.method, call.path, { query: call.query, body: call.body }, actor);
  return result;
}

export function trimHistory(messages) {
  if (messages.length <= MAX_HISTORY) return messages;
  let start = messages.length - MAX_HISTORY;
  while (start < messages.length) {
    const m = messages[start];
    const isPlainUser = m.role === 'user' && (typeof m.content === 'string' || !m.content.some((b) => b.type === 'tool_result'));
    if (isPlainUser) break;
    start += 1;
  }
  return messages.slice(start);
}

export async function runAgent({ config, apiKey, messages, decisions, actor, shopName, deps }) {
  const history = [...trimHistory(messages)];
  const produced = [];
  const executed = [];
  const usage = { entrada: 0, salida: 0, cache_lectura: 0, cache_escritura: 0, usd: 0, llamadas: 0 };
  const system = systemPrompt(shopName, actor);
  const last = history[history.length - 1];

  if (last && last.role === 'assistant' && Array.isArray(last.content) && last.content.some((b) => b.type === 'tool_use')) {
    const results = [];
    for (const tu of last.content.filter((b) => b.type === 'tool_use')) {
      const tool = TOOL_BY_NAME.get(tu.name);
      let payload;
      if (!tool) {
        payload = { ok: false, error: 'Herramienta desconocida' };
      } else if (!tool.mutating) {
        payload = (await execTool(tu, actor, deps)).body;
      } else if ((decisions || []).some((d) => d.id === tu.id && d.aprobar === true)) {
        const r = await execTool(tu, actor, deps);
        payload = r.body;
        executed.push({ id: tu.id, herramienta: tu.name, ok: Boolean(r.body?.ok), resumen: (tool.hecho && tool.hecho(r)) || (r.body?.ok ? 'Hecho' : r.body?.error || 'No se pudo completar') });
      } else {
        payload = { cancelado: true, mensaje: 'El usuario cancelo esta accion' };
      }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: trimResult(payload) });
    }
    const resultMsg = { role: 'user', content: results };
    history.push(resultMsg);
    produced.push(resultMsg);
  }

  for (let i = 0; i < MAX_ITERATIONS; i += 1) {
    const resp = await deps.provider(config, apiKey, system, history, TOOLS);
    usage.entrada += resp.usage?.entrada || 0;
    usage.salida += resp.usage?.salida || 0;
    usage.cache_lectura += resp.usage?.cache_lectura || 0;
    usage.cache_escritura += resp.usage?.cache_escritura || 0;
    usage.usd += costUsd(config.model, resp.usage || {});
    usage.llamadas += 1;
    const assistantMsg = { role: 'assistant', content: resp.blocks.length ? resp.blocks : [{ type: 'text', text: '' }] };
    history.push(assistantMsg);
    produced.push(assistantMsg);
    const toolUses = resp.blocks.filter((b) => b.type === 'tool_use');
    if (toolUses.length === 0) return { produced, pending: [], executed, usage };
    const mutating = toolUses.filter((tu) => TOOL_BY_NAME.get(tu.name)?.mutating);
    if (mutating.length > 0) {
      return {
        produced,
        executed,
        usage,
        pending: mutating.map((tu) => {
          const tool = TOOL_BY_NAME.get(tu.name);
          return { id: tu.id, herramienta: tu.name, resumen: tool.resumen ? tool.resumen(tu.input || {}) : tu.name, argumentos: tu.input || {} };
        }),
      };
    }
    const results = [];
    for (const tu of toolUses) {
      const r = await execTool(tu, actor, deps);
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: trimResult(r.body) });
    }
    const resultMsg = { role: 'user', content: results };
    history.push(resultMsg);
    produced.push(resultMsg);
  }
  return { produced, pending: [], executed, usage, truncado: true };
}

function sanitizeLabel(name) {
  return String(name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
}

const hits = [];

function rateLimited() {
  const now = Date.now();
  while (hits.length && hits[0] < now - 60_000) hits.shift();
  hits.push(now);
  return hits.length > 40;
}

async function authenticate(req) {
  const header = req.headers?.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token && SERVICE_TOKEN && token.length >= 32) {
    const a = crypto.createHash('sha256').update(token).digest();
    const b = crypto.createHash('sha256').update(SERVICE_TOKEN).digest();
    if (crypto.timingSafeEqual(a, b)) return { tenantId: TENANT_ID, role: 'owner', label: 'Asistente IA - prueba' };
  }
  const member = await requireMember(req);
  if (member.error) return member;
  let label = 'Asistente IA';
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } });
    const user = await res.json().catch(() => ({}));
    const first = sanitizeLabel(String(user?.email || '').split('@')[0]);
    if (first) label = `Asistente IA - ${first}`;
  } catch {}
  return { tenantId: member.tenantId, role: member.role, label };
}

function enabledFor(auth) {
  return Boolean(TENANT_ID) && auth.tenantId === TENANT_ID && /owner|admin/i.test(String(auth.role || ''));
}

function fail(res, status, error, code) {
  return res.status(status).json({ ok: false, error, code: code || 'error' });
}

export async function assistantHandler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!SECRET || SECRET.length < 32 || !SERVICE_TOKEN || !SB_KEY) return fail(res, 503, 'Servicio no configurado', 'not_configured');
  if (rateLimited()) return fail(res, 429, 'Demasiadas solicitudes, espera un minuto', 'rate_limited');
  const auth = await authenticate(req);
  if (auth.error) return fail(res, auth.status || 401, auth.error, 'unauthorized');
  const raw = req.query?.assistant;
  const parts = (Array.isArray(raw) ? raw.join('/') : String(raw || '')).split('/').filter(Boolean);
  const route = parts.join('/');

  try {
    if (route === 'config' && req.method === 'GET') {
      const { config } = await loadConfig(auth.tenantId);
      const consumo = enabledFor(auth) ? meter((await loadUsage(auth.tenantId)).usage, config) : null;
      return res.status(200).json({ ok: true, habilitado: enabledFor(auth), ...publicConfig(config), consumo });
    }
    if (!enabledFor(auth)) return fail(res, 403, 'El asistente no esta habilitado para esta cuenta', 'not_enabled');

    if (route === 'config' && (req.method === 'PUT' || req.method === 'POST')) {
      const b = req.body || {};
      const provider = String(b.provider || '');
      if (!PROVIDERS[provider]) return fail(res, 400, `provider invalido. Validos: ${Object.keys(PROVIDERS).join(', ')}`, 'invalid_body');
      const model = String(b.model || '').trim().slice(0, 100);
      if (!model) return fail(res, 400, 'model es requerido', 'invalid_body');
      const baseUrl = String(b.base_url || '').trim().replace(/\/$/, '');
      if (baseUrl && !/^https:\/\//i.test(baseUrl)) return fail(res, 400, 'base_url debe ser https', 'invalid_body');
      if (provider === 'openai_compatible' && !baseUrl) return fail(res, 400, 'base_url es requerido para proveedores compatibles', 'invalid_body');
      const { config: current } = await loadConfig(auth.tenantId);
      const tope = b.tope_tokens_mes === undefined ? Number(current?.tope_tokens_mes) || 0 : Number(b.tope_tokens_mes);
      if (!Number.isFinite(tope) || tope < 0 || tope > 1_000_000_000) return fail(res, 400, 'tope_tokens_mes debe ser un numero entre 0 y 1000000000 (0 = sin tope)', 'invalid_body');
      const topeUsd = b.tope_usd_mes === undefined ? Number(current?.tope_usd_mes) || 0 : Number(b.tope_usd_mes);
      if (!Number.isFinite(topeUsd) || topeUsd < 0 || topeUsd > 100000) return fail(res, 400, 'tope_usd_mes debe ser un numero entre 0 y 100000 (0 = sin tope)', 'invalid_body');
      const payload = { provider, model, base_url: baseUrl, tope_tokens_mes: Math.round(tope), tope_usd_mes: topeUsd, key_enc: current?.key_enc || null, updated_at: new Date().toISOString(), updated_by: auth.label };
      if (typeof b.api_key === 'string' && b.api_key.trim()) payload.key_enc = encryptKey(b.api_key.trim());
      if (!payload.key_enc && provider !== 'openai_compatible') return fail(res, 400, 'api_key es requerida', 'invalid_body');
      await saveConfig(auth.tenantId, payload);
      return res.status(200).json({ ok: true, habilitado: true, ...publicConfig(payload), consumo: meter((await loadUsage(auth.tenantId)).usage, payload) });
    }

    if (route === 'config/test' && req.method === 'POST') {
      const { config } = await loadConfig(auth.tenantId);
      if (!config) return fail(res, 409, 'Primero guarda la configuracion', 'not_configured');
      const apiKey = config.key_enc ? decryptKey(config.key_enc) : '';
      try {
        const r = await providerCall(config, apiKey, 'Responde solo: OK', [{ role: 'user', content: [{ type: 'text', text: 'Prueba' }] }], []);
        return res.status(200).json({ ok: true, respuesta: textOf(r.blocks).slice(0, 80) });
      } catch (e) {
        return fail(res, 502, `El proveedor respondio con error: ${e.message}`, 'provider_error');
      }
    }

    if (route === 'chat' && req.method === 'POST') {
      const b = req.body || {};
      if (!Array.isArray(b.messages) || b.messages.length === 0) return fail(res, 400, 'messages es requerido', 'invalid_body');
      if (JSON.stringify(b.messages).length > 400_000) return fail(res, 400, 'La conversacion es demasiado grande; empieza una nueva', 'too_large');
      const { config } = await loadConfig(auth.tenantId);
      if (!config) return fail(res, 409, 'Configura el proveedor de IA primero', 'not_configured');
      const apiKey = config.key_enc ? decryptKey(config.key_enc) : '';
      const before = meter((await loadUsage(auth.tenantId)).usage, config);
      if (before.porcentaje_usado !== null && before.porcentaje_usado >= 100) {
        return res.status(429).json({ ok: false, error: 'Llegaste al tope mensual de consumo de IA. Sube el tope en la configuracion del asistente.', code: 'usage_limit', consumo: before });
      }
      let shopName = '911 Smart Fix';
      try {
        const rows = await sb('app_settings?slug=eq.app-main-settings&select=payload&limit=1');
        const p = rows?.[0]?.payload || {};
        shopName = p.business_name || p.shop_name || p.name || shopName;
      } catch {}
      try {
        const out = await runAgent({
          config,
          apiKey,
          messages: b.messages,
          decisions: Array.isArray(b.decisions) ? b.decisions : [],
          actor: auth.label,
          shopName,
          deps: { provider: providerCall, callApi },
        });
        const total = await addUsage(auth.tenantId, out.usage).catch(() => null);
        const consumo = total ? meter(total, config) : before;
        return res.status(200).json({ ok: true, mensajes: out.produced, pendientes: out.pending, ejecutadas: out.executed, consumo, ...(out.truncado ? { aviso: 'La respuesta se corto por limite de pasos' } : {}) });
      } catch (e) {
        if (e.provider) return fail(res, 502, `El proveedor de IA respondio con error: ${e.message}`, 'provider_error');
        throw e;
      }
    }
    return fail(res, 404, 'Ruta no encontrada', 'not_found');
  } catch (e) {
    console.error('assistant error:', e.message);
    return fail(res, 502, 'Error interno del asistente', 'upstream_error');
  }
}
