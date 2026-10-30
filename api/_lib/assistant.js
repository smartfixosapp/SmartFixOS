import crypto from 'node:crypto';
import { requireMember } from '../../lib/server/requireMember.js';
import { jaimeHandler, actorStore } from './jaime.js';
import { SB_URL, SB_KEY, sb, money, prDayRange } from './muse.js';
import {
  loadConnections,
  publicConnections,
  saveWhatsAppConfig,
  testWhatsApp,
  sendWhatsApp,
  readWhatsAppInbox,
  whatsAppWebhook,
  normalizePhone,
  savePlaidConfig,
  createPlaidLink,
  finishPlaidLink,
  removePlaidItem,
  bankAccounts,
  bankTransactions,
  saveSuppliers,
  listSuppliers,
  verifySetup,
  searchSupplier,
  supplierLoginWindow,
  workerConfigured,
  searchEbay,
  saveEbayConfig,
} from './connections.js';
import { comparePrices, recordFromSearch, addWatch, listWatch, removeWatch } from './priceCatalog.js';

const TENANT_ID = process.env.MUSE_TENANT_ID || '';
const SECRET = process.env.ASSISTANT_KEY_SECRET || '';
const SERVICE_TOKEN = process.env.JAIME_API_TOKEN || '';
const IVU = 0.115;
const WEB_BASE = process.env.PUBLIC_BASE_URL || 'https://archillaos.com';
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
    autonomia: config?.autonomia === 'preguntar' ? 'preguntar' : 'inteligente',
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
      const images = blocks.filter((b) => b.type === 'image');
      if (images.length) {
        out.push({ role: 'user', content: [{ type: 'text', text: text || 'Foto' }, ...images.map((b) => ({ type: 'image_url', image_url: { url: b.url } }))] });
      } else if (text) {
        out.push({ role: 'user', content: text });
      }
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


const IMAGE_URL_RE = () => new RegExp(`${SB_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/storage/v1/object/public/uploads/[^\\s,\\]]+`, 'g');
const MAX_VISION_IMAGES = 8;

export function prepareMessages(messages) {
  const matcher = IMAGE_URL_RE();
  let budget = MAX_VISION_IMAGES;
  const out = messages.map((m) => ({ ...m }));
  for (let i = out.length - 1; i >= 0 && budget > 0; i -= 1) {
    const m = out[i];
    if (m.role !== 'user' || !Array.isArray(m.content)) continue;
    const blocks = [];
    for (const b of m.content) {
      if (b.type === 'text' && typeof b.text === 'string') {
        const urls = (b.text.match(matcher) || []).filter((u) => /\.(jpe?g|png|webp|heic)$/i.test(u));
        blocks.push(b);
        for (const url of urls.slice(0, budget)) {
          blocks.push({ type: 'image', url });
          budget -= 1;
        }
      } else {
        blocks.push(b);
      }
    }
    out[i] = { ...m, content: blocks };
  }
  return out;
}

function toAnthropicMessages(messages) {
  return prepareMessages(messages).map((m) => ({
    ...m,
    content: Array.isArray(m.content)
      ? m.content.map((b) => (b.type === 'image' ? { type: 'image', source: { type: 'url', url: b.url } } : b))
      : m.content,
  }));
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
        messages: toAnthropicMessages(messages),
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
      messages: toOpenAiMessages(system, prepareMessages(messages)),
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
    name: 'ebay_buscar',
    description: 'Busca una pieza en eBay con la API oficial: solo vendedores de EE. UU. con envio a EE. UU. y precio fijo, ordenado de menor a mayor precio, con precio, envio y total. Solo lectura. Verifica siempre el modelo y la generacion exactos (por ejemplo tipo de maquina o FRU) en la descripcion antes de recomendar comprar.',
    input_schema: { type: 'object', required: ['consulta'], properties: { consulta: str('Pieza o numero de parte, por ejemplo "A2337 logic board" o "FRU 5B20Z"'), limite: { type: 'integer' }, solo_nuevos: { type: 'boolean' } } },
    mutating: false,
    local: async (a, ctx) => {
      const r = await searchEbay(ctx.tenantId, a);
      await recordFromSearch(ctx.tenantId, 'eBay', r.body);
      return r;
    },
  },
  {
    name: 'precios_catalogo',
    description: 'Consulta el catalogo de precios guardado en la base de datos (PhoneLCDParts, eBay y los demas proveedores que se hayan consultado): devuelve el precio de la pieza en cada proveedor, de menor a mayor, con la fecha en que se vio y el cambio contra el precio anterior. USALA PRIMERO para cualquier pregunta de precio o cotizacion; solo si no hay datos o estan viejos consulta al proveedor en vivo. Los precios de proveedor son costo del taller SIN IVU.',
    input_schema: { type: 'object', required: ['consulta'], properties: { consulta: str('Pieza, modelo o numero de parte, por ejemplo "iPhone 14 Pro pantalla"'), proveedor: str('Opcional: limitar a un proveedor'), limite: { type: 'integer' } } },
    mutating: false,
    local: (a, ctx) => comparePrices(ctx.tenantId, a),
  },
  {
    name: 'vigilar_pieza',
    description: 'Agrega una pieza a la lista de vigilancia de precios: el sistema revisara su precio cada semana y avisara cuando suba o baje. Usala cuando el usuario diga "vigila", "monitorea" o "avisame si cambia el precio de".',
    input_schema: { type: 'object', required: ['consulta'], properties: { consulta: str('Pieza y modelo a vigilar, por ejemplo "iPhone 15 pantalla OLED"'), proveedor: str('Opcional: solo en este proveedor') } },
    mutating: true,
    auto: true,
    local: (a, ctx) => addWatch(ctx.tenantId, a),
    resumen: (a) => `Vigilar el precio de: ${a.consulta}`,
    hecho: (r) => (r.body?.ok ? (r.body.ya_existia ? `Ya se vigilaba: ${r.body.consulta}` : `Vigilando: ${r.body.consulta}`) : null),
  },
  {
    name: 'lista_vigilancia',
    description: 'Muestra las piezas que se estan vigilando cada semana y cuando se revisaron por ultima vez.',
    input_schema: { type: 'object', properties: {} },
    mutating: false,
    local: (a, ctx) => listWatch(ctx.tenantId),
  },
  {
    name: 'dejar_de_vigilar',
    description: 'Quita una pieza de la lista de vigilancia de precios.',
    input_schema: { type: 'object', properties: { id: str('Id de lista_vigilancia'), consulta: str('Texto de la pieza si no tienes el id') } },
    mutating: true,
    auto: true,
    local: (a, ctx) => removeWatch(ctx.tenantId, a),
    resumen: (a) => `Dejar de vigilar: ${a.consulta || a.id}`,
    hecho: (r) => (r.body?.ok ? 'Pieza quitada de la vigilancia' : null),
  },
  {
    name: 'notificaciones_recientes',
    description: 'Lee los avisos recientes que le llegaron al dueno: nueva orden, cambios de estado de una orden y cobros. Sirve para responder "que me llego hoy", "de que era ese aviso" o "que paso con la ultima orden"; despues puedes abrir el boleto con ver_boleto.',
    input_schema: { type: 'object', properties: { limite: { type: 'integer', description: 'Cuantos avisos, por defecto 15, maximo 40' }, tipo: { type: 'string', enum: ['nueva_orden', 'cambio_estado', 'cobro'] } } },
    mutating: false,
    local: async (a, ctx) => {
      const kinds = { nueva_orden: 'order_intake', cambio_estado: 'order_status', cobro: 'order_payment' };
      const wanted = kinds[a.tipo] ? [kinds[a.tipo]] : Object.values(kinds);
      const limit = Math.min(Math.max(Number(a.limite) || 15, 1), 40);
      const rows = await sb(`push_queue?tenant_id=eq.${ctx.tenantId}&kind=in.(${wanted.join(',')})&status=neq.skipped&order=created_at.desc&limit=${limit * 2}&select=kind,title,body,data,created_at`);
      const list = (Array.isArray(rows) ? rows : [])
        .filter((r) => r.kind !== 'order_payment' || /^Cobro registrado/i.test(r.title || ''))
        .slice(0, limit)
        .map((r) => ({ tipo: r.kind, titulo: r.title, detalle: r.body, boleto: r.data?.order_number || r.data?.order_id || null, cuando: r.created_at }));
      return { status: 200, body: { ok: true, total: list.length, avisos: list } };
    },
  },
  {
    name: 'whatsapp_abrir',
    description: 'Pone en el chat un boton de WhatsApp para un cliente con el mensaje ya redactado; el usuario toca el boton, se abre WhatsApp con el texto escrito y copiado, y solo toca enviar. Es la forma por defecto de escribirle a un cliente por WhatsApp, igual que el boton de WhatsApp de la app. Redacta tu el mensaje en tono suave y directo.',
    input_schema: { type: 'object', required: ['telefono', 'texto'], properties: { telefono: str('Telefono del cliente'), texto: str('Mensaje completo, listo para enviar') } },
    mutating: false,
    local: (a) => {
      const to = normalizePhone(a.telefono);
      if (!to) return { status: 400, body: { ok: false, error: 'Telefono invalido' } };
      const text = String(a.texto || '').trim().slice(0, 1500);
      if (!text) return { status: 400, body: { ok: false, error: 'texto es requerido' } };
      return { status: 200, body: { ok: true, mensaje: 'Boton de WhatsApp listo en el chat; el usuario lo toca y envia', abrir_url: `https://wa.me/${to}?text=${encodeURIComponent(text)}`, telefono: to, texto: text } };
    },
  },
  {
    name: 'proveedor_buscar_precio',
    description: 'Busca un producto por SKU o nombre en la pagina de un proveedor registrado, usando el navegador en la nube con la sesion del dueno. Solo lectura. Devuelve nombre, SKU, precio y existencia. Los precios del proveedor son el costo del taller, SIN IVU: nunca se los reveles a un cliente.',
    input_schema: { type: 'object', required: ['proveedor', 'consulta'], properties: { proveedor: str('Nombre del proveedor tal como sale en proveedores_listar'), consulta: str('SKU, numero de parte o texto a buscar') } },
    mutating: false,
    local: async (a, ctx) => {
      const r = await searchSupplier(ctx.tenantId, a);
      await recordFromSearch(ctx.tenantId, r.body?.proveedor || String(a.proveedor || ''), r.body);
      return r;
    },
  },
  {
    name: 'solicitar_datos',
    description: 'Muestra en el chat una tarjeta segura para que el usuario escriba claves, tokens o credenciales de un proveedor, de WhatsApp (API de Meta) o del banco (Plaid). Los datos van directo al servidor y tu nunca los ves ni los repites. Antes de llamarla pregunta en texto solo lo que no es sensible (nombre del proveedor y su direccion web) y pasalo como nombre y url.',
    input_schema: {
      type: 'object',
      required: ['tipo'],
      properties: {
        tipo: { type: 'string', enum: ['proveedor', 'whatsapp', 'banco', 'ebay'] },
        nombre: str('Nombre del proveedor, solo para tipo proveedor'),
        url: str('Direccion web https del proveedor, solo para tipo proveedor'),
      },
    },
    mutating: true,
    local: (a, ctx) => verifySetup(ctx.tenantId, a.tipo, a.nombre),
    resumen: (a) => (a.tipo === 'proveedor' ? `Guardar el proveedor ${a.nombre || ''}`.trim() : a.tipo === 'whatsapp' ? 'Conectar WhatsApp (API de Meta)' : a.tipo === 'ebay' ? 'Conectar eBay (API oficial, solo lectura)' : 'Conectar el banco (solo lectura)'),
    hecho: (r) => {
      if (!r.body?.ok) return null;
      if (r.body.proveedor) return `Proveedor guardado: ${r.body.proveedor}`;
      if (r.body.bancos) return `Banco conectado: ${r.body.bancos.join(', ')}`;
      if (r.body.ebay) return 'eBay conectado';
      return `WhatsApp conectado${r.body.numero ? `: ${r.body.numero}` : ''}`;
    },
  },
  {
    name: 'whatsapp_enviar',
    description: 'Envia un mensaje de WhatsApp a un cliente desde el numero del taller. El usuario ve el borrador y lo aprueba antes de salir. Fuera de las 24 horas desde el ultimo mensaje del cliente solo se permiten plantillas aprobadas por Meta (campo plantilla).',
    input_schema: {
      type: 'object',
      required: ['telefono'],
      properties: {
        telefono: str('Telefono del cliente con 10 digitos o con codigo de pais'),
        texto: str('Texto del mensaje, tono suave y directo'),
        plantilla: str('Nombre de una plantilla aprobada, solo si el cliente no ha escrito en 24 horas'),
        idioma: str('Codigo de idioma de la plantilla, por defecto es'),
        variables: { type: 'array', items: { type: 'string' } },
      },
    },
    mutating: true,
    local: (a, ctx) => sendWhatsApp(ctx.tenantId, a),
    resumen: (a) => `Enviar WhatsApp a ${normalizePhone(a.telefono) ? `+${normalizePhone(a.telefono)}` : a.telefono}:\n${a.plantilla ? `Plantilla ${a.plantilla}${Array.isArray(a.variables) && a.variables.length ? ` (${a.variables.join(', ')})` : ''}` : `"${a.texto || ''}"`}`,
    hecho: (r) => (r.body?.ok ? `WhatsApp enviado a +${r.body.enviado_a}` : null),
  },
  {
    name: 'whatsapp_bandeja',
    description: 'Lee los mensajes recientes de WhatsApp del taller (entrantes y salientes), del mas nuevo al mas viejo. Puede filtrar por telefono.',
    input_schema: { type: 'object', properties: { telefono: str('Filtrar por telefono'), limite: { type: 'integer' } } },
    mutating: false,
    local: (a, ctx) => readWhatsAppInbox(ctx.tenantId, a),
  },
  {
    name: 'banco_cuentas',
    description: 'Lee los saldos de las cuentas bancarias conectadas (solo lectura).',
    input_schema: { type: 'object', properties: {} },
    mutating: false,
    local: (a, ctx) => bankAccounts(ctx.tenantId),
  },
  {
    name: 'banco_movimientos',
    description: 'Lee movimientos bancarios (solo lectura) entre dos fechas, con totales de entradas y salidas. Util para cuadrar depositos, pagos ATH Movil y gastos con Finanzas.',
    input_schema: { type: 'object', properties: { desde: str('YYYY-MM-DD'), hasta: str('YYYY-MM-DD'), texto: str('Filtrar por texto de la descripcion') } },
    mutating: false,
    local: (a, ctx) => bankTransactions(ctx.tenantId, a),
  },
  {
    name: 'proveedores_listar',
    description: 'Lista los proveedores registrados del taller con su direccion web. Nunca muestra claves.',
    input_schema: { type: 'object', properties: {} },
    mutating: false,
    local: (a, ctx) => listSuppliers(ctx.tenantId),
  },
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
    description: 'Cobrado, devoluciones, gastos, ganancia estimada y boletos creados de un dia o de un rango (desde y hasta, para la semana o el mes).',
    input_schema: { type: 'object', properties: { fecha: str('YYYY-MM-DD, por defecto hoy'), desde: str('YYYY-MM-DD inicio de un rango (maximo 92 dias), junto con hasta'), hasta: str('YYYY-MM-DD fin del rango') } },
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
        notificar_cliente: { type: 'boolean', description: 'Omitir. Solo false si el usuario pide expresamente no avisar al cliente' },
      },
    },
    mutating: true,
    auto: true,
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
    description: 'Cambia el estatus de un boleto y/o corrige su equipo, marca o modelo. El cambio de estatus envia por defecto el correo automatico al cliente, igual que la app; no pases notificar_cliente salvo que el usuario pida expresamente no avisar.',
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
        notificar_cliente: { type: 'boolean', description: 'Omitir. Solo false si el usuario pide expresamente no avisar al cliente' },
      },
    },
    mutating: true,
    auto: true,
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
    auto: (a) => a.tipo !== 'cliente',
    run: (a) => ({ method: 'POST', path: `tickets/${encodeURIComponent(a.numero)}/notas`, body: { texto: a.texto, tipo: a.tipo } }),
    resumen: (a) => `Nota ${a.tipo === 'cliente' ? 'para el cliente (se envia por correo)' : 'interna'} en ${a.numero}:\n${a.texto}`,
    hecho: (r) => (r.body?.ok ? 'Nota agregada' : null),
  },
  {
    name: 'adjuntar_foto',
    description: 'Adjunta una foto (URL subida por el usuario) a un boleto existente.',
    input_schema: { type: 'object', required: ['numero', 'url'], properties: { numero: ticketRef, url: str('URL de la foto'), nota: str('Descripcion') } },
    mutating: true,
    auto: true,
    run: (a) => ({ method: 'POST', path: `tickets/${encodeURIComponent(a.numero)}/fotos`, body: { url: a.url, nota: a.nota } }),
    resumen: (a) => `Adjuntar una foto al boleto ${a.numero}`,
    hecho: (r) => (r.body?.ok ? 'Foto adjuntada' : null),
  },
  {
    name: 'agregar_pieza_a_boleto',
    description: 'Agrega una pieza al boleto para facturarla y descuenta el inventario si es un producto con stock. Busca primero en el inventario con buscar_inventario. El precio es SIN IVU.',
    input_schema: { type: 'object', required: ['numero', 'precio'], properties: { numero: ticketRef, ...pieceLine.properties } },
    mutating: true,
    auto: (a) => Boolean(a.producto_id),
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
    auto: true,
    run: (a) => ({ method: 'POST', path: 'piezas', body: a }),
    resumen: (a) => `Crear pieza en inventario: ${a.nombre}\nPrecio sin IVU ${fmt(a.precio)}, con IVU ${fmt(withIvu(a.precio))}${a.costo !== undefined ? `\nCosto ${fmt(a.costo)}` : ''}\nStock inicial: ${a.stock ?? 0}`,
    hecho: (r) => (r.body?.ok ? 'Pieza creada en el inventario' : null),
  },
  {
    name: 'registrar_pago',
    description: 'Registra un pago o deposito de un boleto ya recibido. Nunca lo registres si el dinero no se ha recibido.',
    input_schema: { type: 'object', required: ['numero', 'monto', 'metodo'], properties: { numero: ticketRef, monto: num('Monto exacto recibido'), metodo: { type: 'string', enum: PAYMENT_ENUM }, nota: str('Nota'), notificar_cliente: { type: 'boolean', description: 'Omitir. Solo false si el usuario pide expresamente no avisar al cliente' } } },
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
  {
    name: 'catalogo_piezas',
    description: 'Catalogo de piezas del inventario con filtro por texto o por bajo stock. Sirve para "que piezas estan bajo el minimo" y para obtener el id de un producto.',
    input_schema: { type: 'object', properties: { q: str('Texto a buscar'), bajo_stock: { type: 'boolean' }, todos: { type: 'boolean', description: 'true incluye todo el inventario y no solo piezas' }, limite: { type: 'integer' }, pagina: { type: 'integer' } } },
    mutating: false,
    run: (a) => ({ method: 'GET', path: 'piezas', query: a }),
  },
  {
    name: 'buscar_clientes',
    description: 'Busca clientes por nombre, telefono o email.',
    input_schema: { type: 'object', required: ['q'], properties: { q: str('Nombre, telefono o email'), limite: { type: 'integer' } } },
    mutating: false,
    run: (a) => ({ method: 'GET', path: 'clientes', query: a }),
  },
  {
    name: 'ver_cliente',
    description: 'Datos de un cliente, sus boletos recientes y cuanto debe en total. Usa el id que devuelve buscar_clientes.',
    input_schema: { type: 'object', required: ['cliente_id'], properties: { cliente_id: str('Id del cliente') } },
    mutating: false,
    run: (a) => ({ method: 'GET', path: `clientes/${encodeURIComponent(a.cliente_id)}` }),
  },
  {
    name: 'editar_cliente',
    description: 'Corrige el nombre, telefono o email de un cliente.',
    input_schema: { type: 'object', required: ['cliente_id'], properties: { cliente_id: str('Id del cliente'), nombre: str('Nombre completo'), telefono: str('Telefono'), email: str('Email, sin acentos') } },
    mutating: true,
    auto: true,
    run: (a) => ({ method: 'PATCH', path: `clientes/${encodeURIComponent(a.cliente_id)}`, body: { nombre: a.nombre, telefono: a.telefono, email: a.email } }),
    resumen: (a) => `Corregir cliente: ${[a.nombre, a.telefono, a.email].filter(Boolean).join(' · ')}`,
    hecho: (r) => (r.body?.ok ? `Cliente actualizado: ${r.body.cliente?.nombre || ''}` : null),
  },
  {
    name: 'actualizar_costo_pieza',
    description: 'Corrige el costo interno o el suplidor de una pieza ya agregada a un boleto. No cambia el precio al cliente. Usa el id de piezas_del_boleto.',
    input_schema: { type: 'object', required: ['numero', 'pieza_id'], properties: { numero: ticketRef, pieza_id: str('Id de la pieza dentro del boleto'), costo: num('Costo unitario del taller'), suplidor: str('Suplidor') } },
    mutating: true,
    auto: true,
    run: (a) => ({ method: 'PATCH', path: `tickets/${encodeURIComponent(a.numero)}/piezas/${encodeURIComponent(a.pieza_id)}`, body: { costo: a.costo, suplidor: a.suplidor } }),
    resumen: (a) => `Corregir costo de la pieza en ${a.numero}${a.costo !== undefined ? `: ${fmt(a.costo)}` : ''}${a.suplidor ? ` (${a.suplidor})` : ''}`,
    hecho: (r) => (r.body?.ok ? 'Costo de la pieza actualizado' : null),
  },
  {
    name: 'editar_pieza',
    description: 'Edita un producto del inventario: nombre, marca, modelo, categoria, costo, stock minimo o suplidor. Cambiar el precio de venta, el stock o desactivarlo pide confirmacion. Precios SIN IVU.',
    input_schema: { type: 'object', required: ['producto_id'], properties: { producto_id: str('Id del producto'), nombre: str('Nombre'), marca: str('Marca'), modelo: str('Modelo'), categoria: str('Categoria'), costo: num('Costo'), precio: num('Precio de venta sin IVU'), stock: num('Cantidad en stock'), stock_minimo: num('Minimo'), suplidor: str('Suplidor'), activo: { type: 'boolean' } } },
    mutating: true,
    auto: (a) => a.precio === undefined && a.stock === undefined && a.activo === undefined,
    run: (a) => {
      const { producto_id, ...rest } = a;
      return { method: 'PATCH', path: `piezas/${encodeURIComponent(producto_id)}`, body: rest };
    },
    resumen: (a) => `Editar producto ${a.producto_id}:\n${Object.entries(a).filter(([k]) => k !== 'producto_id').map(([k, v]) => `${k}: ${v}`).join('\n')}${a.precio !== undefined ? `\nPrecio con IVU: ${fmt(withIvu(a.precio))}` : ''}`,
    hecho: (r) => (r.body?.ok ? `Producto actualizado${r.body.pieza?.nombre ? `: ${r.body.pieza.nombre}` : ''}` : null),
  },
  {
    name: 'quitar_pieza_de_boleto',
    description: 'Quita una pieza de un boleto abierto y devuelve el stock. Baja el total facturado. Usa el id de piezas_del_boleto.',
    input_schema: { type: 'object', required: ['numero', 'pieza_id'], properties: { numero: ticketRef, pieza_id: str('Id de la pieza dentro del boleto') } },
    mutating: true,
    run: (a) => ({ method: 'DELETE', path: `tickets/${encodeURIComponent(a.numero)}/piezas/${encodeURIComponent(a.pieza_id)}` }),
    resumen: (a) => `Quitar una pieza del boleto ${a.numero} (baja el total facturado y devuelve el stock)`,
    hecho: (r) => (r.body?.ok ? 'Pieza quitada del boleto' : null),
  },
  {
    name: 'reversar_pago',
    description: 'Anula un cobro registrado en un boleto (no borra: queda el reembolso en Finanzas). Requiere el id del pago de ver_boleto y un motivo.',
    input_schema: { type: 'object', required: ['numero', 'pago_id', 'motivo'], properties: { numero: ticketRef, pago_id: str('Id del pago'), motivo: str('Motivo, minimo 3 caracteres') } },
    mutating: true,
    run: (a) => ({ method: 'POST', path: `tickets/${encodeURIComponent(a.numero)}/pagos/${encodeURIComponent(a.pago_id)}/reversar`, body: { motivo: a.motivo } }),
    resumen: (a) => `Reversar un pago del boleto ${a.numero}\nMotivo: ${a.motivo}\nBaja lo cobrado y deja el reembolso en Finanzas`,
    hecho: (r) => (r.body?.ok ? 'Pago reversado' : null),
  },
  {
    name: 'anular_venta',
    description: 'Anula una venta de mostrador hecha por el asistente o la API (no borra: queda el reembolso y se devuelve el stock). Las ventas hechas desde la app se anulan en la app.',
    input_schema: { type: 'object', required: ['venta', 'motivo'], properties: { venta: str('Id o numero POS-XXXXXXXX de la venta'), motivo: str('Motivo'), restaurar_stock: { type: 'boolean' } } },
    mutating: true,
    run: (a) => ({ method: 'POST', path: `pos/ventas/${encodeURIComponent(a.venta)}/anular`, body: { motivo: a.motivo, restaurar_stock: a.restaurar_stock } }),
    resumen: (a) => `Anular la venta ${a.venta}\nMotivo: ${a.motivo}${a.restaurar_stock === false ? '\nNo se devuelve el stock' : '\nSe devuelve el stock'}`,
    hecho: (r) => (r.body?.ok ? 'Venta anulada' : null),
  },
  {
    name: 'registrar_gasto',
    description: 'Registra un gasto del taller en Finanzas (piezas, suministros, renta, utilidades, mercadeo, reparaciones, impuestos u otro). Monto exacto ya pagado.',
    input_schema: { type: 'object', required: ['monto', 'concepto', 'categoria'], properties: { monto: num('Monto exacto'), concepto: str('Concepto'), categoria: { type: 'string', enum: ['parts', 'supplies', 'rent', 'utilities', 'marketing', 'repairs', 'taxes', 'other'] }, metodo: { type: 'string', enum: PAYMENT_ENUM }, fecha: str('YYYY-MM-DD, por defecto hoy') } },
    mutating: true,
    run: (a) => ({ method: 'POST', path: 'finanzas/gastos', body: a }),
    resumen: (a) => `Registrar gasto de ${fmt(a.monto)}\nConcepto: ${a.concepto}\nCategoria: ${a.categoria}${a.metodo ? `\nMetodo: ${a.metodo}` : ''}${a.fecha ? `\nFecha: ${a.fecha}` : ''}`,
    hecho: (r) => (r.body?.ok ? `Gasto registrado: ${fmt(r.body.gasto?.monto)}` : null),
  },
  {
    name: 'crear_tarea',
    description: 'Crea una tarea o recordatorio para el dueno en la lista de tareas del taller, opcionalmente con fecha y hora.',
    input_schema: { type: 'object', required: ['titulo'], properties: { titulo: str('Titulo corto'), notas: str('Detalle'), fecha_hora: str('Fecha y hora ISO 8601 con zona, por ejemplo 2026-10-30T14:00:00-04:00') } },
    mutating: true,
    auto: true,
    local: async (a, ctx) => {
      const title = String(a.titulo || '').trim().slice(0, 200);
      if (title.length < 3) return { status: 400, body: { ok: false, error: 'titulo demasiado corto' } };
      let due = null;
      if (a.fecha_hora) {
        const d = new Date(a.fecha_hora);
        if (Number.isNaN(d.getTime())) return { status: 400, body: { ok: false, error: 'fecha_hora invalida' } };
        due = d.toISOString();
      }
      const body = { id: crypto.randomUUID(), tenant_id: ctx.tenantId, title, created_by: 'Asistente IA', notes: a.notas ? String(a.notas).slice(0, 1000) : null, due_at: due, notify_at: due };
      await sb('workshop_task', { method: 'POST', body, prefer: 'return=minimal' });
      return { status: 200, body: { ok: true, tarea: { titulo: title, para: due } } };
    },
    resumen: (a) => `Crear tarea: ${a.titulo}${a.fecha_hora ? `\nPara: ${a.fecha_hora}` : ''}`,
    hecho: (r) => (r.body?.ok ? `Tarea creada: ${r.body.tarea?.titulo}` : null),
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
    'Notificaciones: igual que en la app, cada cambio de estatus, pago o creacion de boleto envia automaticamente el correo al cliente. NUNCA preguntes si avisas al cliente y NUNCA pases notificar_cliente:false por tu cuenta; solo lo haces si el usuario pide expresamente no avisar. Despues de cada accion revisa notificacion_enviada en el resultado: si es true di que se le aviso al cliente por correo; si es false di el motivo real que trae la respuesta (por ejemplo que el cliente no tiene email o que es un estatus interno), sin inventar otro.',
    'WhatsApp: puedes leer la bandeja con whatsapp_bandeja y redactar mensajes con whatsapp_enviar; nunca sale un mensaje sin que el dueno vea el borrador en la tarjeta de confirmacion. Si el cliente no ha escrito en 24 horas Meta solo deja plantillas aprobadas; si el envio falla por eso, dilo y ofrece otro medio. Banco: solo lectura con banco_cuentas y banco_movimientos; nunca muevas dinero ni prometas hacerlo. Proveedores: proveedores_listar muestra los registrados; no tienes acceso a sus claves. Para precios usa proveedor_buscar_precio: si responde que la sesion no esta iniciada o que hay una verificacion, dile al usuario que abra la ventanilla del proveedor desde Ajustes, Conexiones, Proveedores, y que entre una vez; no intentes evadir verificaciones. Si el proveedor no tiene direccion de busqueda, pidele una busqueda de ejemplo. Conexiones guiadas: si el usuario dice "agrega este proveedor", "conecta el WhatsApp" o "conecta el banco", guialo paso a paso en el chat, una pregunta a la vez. Para un proveedor pregunta primero el nombre y la direccion web y luego llama solicitar_datos con tipo proveedor; para WhatsApp explica brevemente de donde salen el token, el Phone Number ID y el App Secret en developers.facebook.com y llama solicitar_datos con tipo whatsapp; para el banco explica que se usa Plaid en modo solo lectura, que necesita Client ID y Secret de plaid.com, y llama solicitar_datos con tipo banco. NUNCA pidas ni aceptes claves, tokens o contrasenas escritos en el chat: si el usuario las escribe, dile que no las repita y usa la tarjeta segura.',
    'AUTONOMIA: tu trabajo es quitarle trabajo al dueno, no pedirle permiso por todo. Cuando la instruccion es clara, ejecutala de una vez con la herramienta, sin preguntar "confirmas" en texto. Las acciones de bajo riesgo (cambiar estatus, crear boleto con los datos dados, notas internas, adjuntar fotos, corregir equipo, agregar piezas del inventario) se ejecutan directo. Solo se piden con tarjeta de confirmacion lo sensible: pagos, devoluciones, ventas, ingresos, mensajes al cliente y precios que no vengan del inventario. Una respuesta tipo "si", "dale" o "hazlo" a una pregunta tuya ES la autorizacion: ejecuta la herramienta en ese mismo turno sin volver a preguntar.',
    'BOLETO ACTIVO Y FOTOS: recuerda cual es el boleto activo de la conversacion. Si el usuario dice "voy a trabajar este boleto", "empiezo con el WO-xxx" o similar, ese es el boleto activo y lo pasas a in_progress. Las fotos que llegan en el chat las ves de verdad (vienen como imagenes): si hay un boleto activo adjuntalas a ese boleto con adjuntar_foto sin preguntar y describe en una frase lo que ves (por ejemplo equipo abierto, pieza nueva instalada, equipo terminado y encendido). Si las fotos muestran que la reparacion quedo terminada (equipo armado, pantalla instalada, enciende y funciona), dilo y pregunta una sola vez: "Ya quedo, lo pongo en Listo para recoger?"; si responde que si, haz el cambio de estatus de inmediato, sin tarjeta ni nueva pregunta. Si no hay boleto activo y llegan fotos, pregunta a cual boleto pertenecen o si es un boleto nuevo.',
    'ALCANCE COMPLETO: tienes casi todo lo que hace el dueno en la app y la API del taller: boletos, fotos, piezas e inventario, clientes (buscar_clientes, ver_cliente, editar_cliente), cobros y reversos, ventas de mostrador y anulaciones, ingresos y gastos, resumen del dia o de un rango, tareas (crear_tarea), WhatsApp y avisos. Usa cada herramienta sin pedirle al usuario que lo haga en la app. Solo di que algo se hace desde la app cuando de verdad no tienes herramienta (abrir o cerrar caja, nomina, ponches, cotizaciones formales, citas).',
    'CREAR UN BOLETO NUEVO: cuando el usuario diga "crear boleto" o "llego un cliente", esto es un flujo aparte que puede ocurrir en medio de otro trabajo: NO toques el boleto activo, y no mezcles sus datos. Pregunta UNA cosa a la vez, corta y amable, en este orden: nombre, apellido, telefono, email (o que no tiene), equipo y problema; luego pide las fotos del equipo ("mandame las fotos aqui mismo"). Si el usuario manda varios datos juntos, no los vuelvas a pedir. Cuando tengas lo minimo (nombre, apellido, telefono, equipo y problema) crea el boleto sin pedir otra confirmacion, adjunta las fotos que lleguen y ofrece volver al boleto anterior en una frase ("Listo el WO-xxx. Seguimos con el WO-yyy?"). Si el cliente ya existe (busca con buscar_clientes por telefono), usalo en vez de duplicarlo.',
    'CATALOGO DE PRECIOS: para cualquier pregunta de precio de una pieza llama primero precios_catalogo; ahi estan los precios ya guardados de cada proveedor con su fecha. Responde con el precio en cada proveedor, cual es el mas barato y una recomendacion de precio de venta, aclarando la fecha del dato. Si no hay datos, o estan marcados como desactualizados y el usuario necesita precio firme, consulta en vivo con proveedor_buscar_precio o ebay_buscar (lo que consultes se guarda solo en el catalogo). Si el usuario pide vigilar o monitorear una pieza usa vigilar_pieza.',
    'COMPRAS Y PRECIOS DE PROVEEDORES: cuando cotices una pieza o compares proveedores aplica las reglas que ya conoce el dueno. Verifica el modelo y la generacion exactos en la ficha (hay fichas casi iguales con precios muy distintos, como iPad Pro 3 y 4 gen contra 5 y 6 gen). En MobileSentrix toma el precio de la variante exacta (calidad, version y color) y cuidado con la coma decimal ($344,45 es $344.45). El precio del proveedor no incluye envio: reporta precio mas envio cuando lo sepas. En eBay solo vendedores de EE. UU. con envio domestico y descarta anuncios con envio internacional. Las pantallas de laptop de PhoneLCDParts tardan unas 2 semanas: dilo en la cotizacion. Los correos de ETA no son fiables, manda el rastreo del transportista. Los costos del proveedor son internos: nunca se los digas a un cliente. Nunca compres ni pagues nada; solo cotizas y preparas.',
    'AYUDA PROACTIVA: ademas de obedecer, propone. Al empezar el dia o si dicen "briefing", "que tengo hoy" o "que hay pendiente": usa resumen_del_dia, alertas y buscar_boletos y da una lista priorizada y corta (cobros pendientes, listos sin recoger, esperando al cliente, piezas que llegaron). Para cobranza o seguimientos arma los mensajes de WhatsApp uno por cliente con whatsapp_abrir. Al ver un gasto, un recibo o una factura en una foto, ofrece registrarlo con registrar_gasto. Si el usuario dicta algo que suena a recordatorio ("recuerdame llamar a X el jueves") usa crear_tarea. Nunca inventes datos: si no los encuentras con las herramientas, dilo.',
    'PROACTIVIDAD: trabaja como un asistente de taller que piensa por delante. Despues de cada accion ofrece el siguiente paso logico en UNA frase y con una pregunta corta (ejemplos: "Anadi la foto al WO-410, la dejo como foto de reparacion?", "Ya esta en reparacion, le aviso al cliente por WhatsApp?", "Hay balance pendiente de $40, lo cobro?"). Cuando el usuario manda varias fotos y ya hay boleto activo, adjuntalas todas, describe brevemente cada una y pregunta que mas quiere hacer. Si falta un dato para actuar (a cual boleto va, que estatus), pregunta lo minimo, nunca un formulario largo. Nunca digas que algo requiere una API de pago de WhatsApp (Meta, Twilio): para WhatsApp siempre usas whatsapp_abrir.',
    'NOTAS Y AVISOS AL CLIENTE: cuando el usuario dicta una nota de un boleto, decide tu si es INTERNA (para el equipo: diagnostico tecnico, observaciones, recordatorios) o PARA EL CLIENTE (algo que el cliente debe saber: estado, que hacer, cuando recoger). Si es evidente, usa el tipo correcto sin preguntar; si no queda claro, pregunta en una frase "la dejo interna o se la mando al cliente?". Una nota para el cliente se envia por correo y pide tarjeta; despues de guardarla, ofrece de inmediato el boton de WhatsApp con el mismo mensaje usando whatsapp_abrir. Lo mismo despues de cambios de estatus que le importan al cliente (listo para recoger, esperando piezas, llego la pieza, cotizacion lista, entregado): llama whatsapp_abrir con un mensaje breve y amable, el telefono lo sacas del boleto con ver_boleto. En estatus internos (diagnostico, en reparacion) no pongas boton salvo que lo pida.',
    'WHATSAPP A CLIENTES: para escribirle a un cliente por WhatsApp usa whatsapp_abrir: redactas el mensaje completo (tono suave y directo, sin precios que el dueno no haya confirmado) y el chat muestra un boton; el dueno lo toca, se abre WhatsApp con el texto escrito y copiado, y solo toca enviar. Eso es lo normal, no pidas confirmacion antes. Si existe whatsapp_enviar entre tus herramientas (solo cuando la API de Meta esta conectada) usalo unicamente si el usuario lo pide expresamente. El telefono sale del boleto o del cliente: buscalo tu, no se lo pidas al usuario.',
    'AVISOS: el dueno solo recibe avisos de ponche, nueva orden, cambios de estado de una orden, cobros, meta diaria y el recordatorio de cerrar el ponche. Si pregunta por un aviso o por lo que paso, usa notificaciones_recientes y luego ver_boleto del boleto que menciona; ofrece el siguiente paso (por ejemplo cobrar o avisarle al cliente) en una sola frase.',
    'Usa numeros de boleto como WO-382. Si no estas seguro del boleto, buscalo primero.',
    'Estatus con frases naturales: "ya recogi la pieza", "ya llego la pieza", "voy a trabajar este equipo" o "empiezo con este" pasan el boleto a in_progress (En reparacion); "ya termine este equipo" lo pasa a ready_for_pickup (Listo para recoger); "pedi la pieza" lo pasa a waiting_parts (Esperando piezas). Si no queda claro de que boleto habla, usa el ultimo boleto de la conversacion o pregunta. Despues de cada cambio confirma en una frase que cambiaste.',
    'Reglas del negocio que siempre sigues sin que te las recuerden: todo precio que le reportas al dueno va CON IVU incluido; los precios de piezas se entran SIN IVU. Nunca bajes un precio cotizado sin aprobacion explicita del dueno. Nunca reveles a un cliente el costo de las piezas ni el margen. Formula de cotizacion: costo de la pieza del suplidor + labor + IVU 11.5%. Las pantallas de Samsung se cotizan solo con marco.',
    'Deposito para un cliente nuevo: el mayor entre el 50% del total y el costo de las piezas; es un calculo interno, al cliente solo se le pide el monto. Nunca registres un deposito o pago antes de que el dinero haya llegado de verdad. Antes de cualquier pago confirma monto, quien paga, boleto y metodo. Datos minimos de un cliente nuevo: nombre, apellido, email y telefono.',
    'Mensajes a clientes: nunca salen sin que el dueno vea el borrador y lo apruebe, mensaje por mensaje; un numero de telefono no es una aprobacion. Di "la ordenamos", nunca "compramos", al hablar de piezas. Tono suave y directo: prefiere "Tenemos dos alternativas que te podemos ofrecer" a "Tienes dos opciones", y evita frases que suenen a regano o a que la tienda fallo.',
    'Nunca actues sobre un numero de boleto que no resuelva en el sistema: si no existe, busca candidatos parecidos con buscar_boletos y preguntale al dueno cual es. Todo lo que haces queda en el historial del boleto como si lo hiciera un usuario. Nunca pidas ni repitas llaves de API o credenciales en el chat.',
    'Si al crear un boleto o agregar una pieza el inventario no la tiene, dilo y pregunta que quiere hacer: crearla en el inventario o dejarla pendiente de ordenar. Las ordenes de compra desde el chat todavia no estan disponibles; no prometas hacerlas.',
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
  if (tool.local) return tool.local(toolUse.input || {}, { tenantId: TENANT_ID, callApi: (m, p, o) => deps.callApi(m, p, o, actor) });
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


function isAuto(tool, input, config) {
  if (!tool || !tool.mutating) return false;
  if (config?.autonomia === 'preguntar') return false;
  return typeof tool.auto === 'function' ? Boolean(tool.auto(input || {})) : tool.auto === true;
}

function noteClientAction(executed, toolUse, body) {
  if (body && typeof body.abrir_url === 'string') {
    executed.push({ id: `${toolUse.id}-abrir`, herramienta: toolUse.name, ok: true, resumen: `WhatsApp listo para +${body.telefono}`, url: body.abrir_url, telefono: body.telefono, texto: body.texto });
  }
}

export async function runAgent({ config, apiKey, messages, decisions, actor, shopName, deps, extraText = '', tools = TOOLS, maxIterations = MAX_ITERATIONS }) {
  const history = [...trimHistory(messages)];
  const produced = [];
  const executed = [];
  const steps = [];
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
        steps.push({ herramienta: tu.name, ok: payload?.ok !== false });
        noteClientAction(executed, tu, payload);
      } else if ((decisions || []).some((d) => d.id === tu.id && d.aprobar === true)) {
        const r = await execTool(tu, actor, deps);
        steps.push({ herramienta: tu.name, ok: r.body?.ok !== false });
        payload = r.body;
        executed.push({ id: tu.id, herramienta: tu.name, ok: Boolean(r.body?.ok), resumen: (tool.hecho && tool.hecho(r)) || (r.body?.ok ? 'Hecho' : r.body?.error || 'No se pudo completar') });
      } else {
        payload = { cancelado: true, mensaje: 'El usuario cancelo esta accion' };
      }
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: trimResult(payload) });
    }
    if (extraText) results.push({ type: 'text', text: extraText });
    const resultMsg = { role: 'user', content: results };
    history.push(resultMsg);
    produced.push(resultMsg);
  }

  for (let i = 0; i < maxIterations; i += 1) {
    const resp = await deps.provider(config, apiKey, system, history, tools);
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
    if (toolUses.length === 0) return { produced, pending: [], executed, usage, steps };
    const mutating = toolUses.filter((tu) => TOOL_BY_NAME.get(tu.name)?.mutating);
    const needsCard = mutating.filter((tu) => !isAuto(TOOL_BY_NAME.get(tu.name), tu.input, config));
    if (needsCard.length > 0) {
      return {
        produced,
        executed,
        usage,
        steps,
        pending: mutating.map((tu) => {
          const tool = TOOL_BY_NAME.get(tu.name);
          return { id: tu.id, herramienta: tu.name, resumen: tool.resumen ? tool.resumen(tu.input || {}) : tu.name, argumentos: tu.input || {} };
        }),
      };
    }
    const results = [];
    for (const tu of toolUses) {
      const tool = TOOL_BY_NAME.get(tu.name);
      const r = await execTool(tu, actor, deps);
      steps.push({ herramienta: tu.name, ok: r.body?.ok !== false });
      if (tool?.mutating) {
        executed.push({ id: tu.id, herramienta: tu.name, ok: Boolean(r.body?.ok), resumen: (tool.hecho && tool.hecho(r)) || (r.body?.ok ? 'Hecho' : r.body?.error || 'No se pudo completar') });
      }
      noteClientAction(executed, tu, r.body);
      results.push({ type: 'tool_result', tool_use_id: tu.id, content: trimResult(r.body) });
    }
    const resultMsg = { role: 'user', content: results };
    history.push(resultMsg);
    produced.push(resultMsg);
  }
  return { produced, pending: [], executed, usage, steps, truncado: true };
}


export function availableTools(conn) {
  const hidden = new Set();
  if (!conn?.whatsapp?.token_enc) {
    hidden.add('whatsapp_enviar');
    hidden.add('whatsapp_bandeja');
  }
  if (!(conn?.plaid?.items || []).length) {
    hidden.add('banco_cuentas');
    hidden.add('banco_movimientos');
  }
  if (!workerConfigured() && !(conn?.proveedores || []).some((p) => /phonelcdparts\.com/i.test(p.url || ''))) hidden.add('proveedor_buscar_precio');
  if (!conn?.ebay?.secret_enc) hidden.add('ebay_buscar');
  return TOOLS.filter((t) => !hidden.has(t.name));
}

export function lastTicketNumber(produced) {
  let found = null;
  for (const m of produced || []) {
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    for (const b of m.content) {
      if (b.type !== 'tool_use') continue;
      const raw = String(b.input?.numero || '').trim();
      const digits = raw.replace(/\D/g, '');
      if (/^wo-?\d+$/i.test(raw) || (digits && raw.length <= 10 && /\d/.test(raw))) found = `WO-${digits}`;
    }
  }
  return found;
}

export function panelFromDetail(t) {
  const events = [];
  for (const e of t.historial_estatus || []) {
    events.push({ tipo: 'estatus', titulo: e.estatus_nombre || e.estatus, detalle: e.nota || null, por: e.por || null, fecha: e.fecha || null });
  }
  for (const n of t.notas || []) {
    events.push({ tipo: n.tipo === 'photo' ? 'foto' : 'nota', titulo: n.tipo === 'customer_advisory' ? 'Nota para el cliente' : n.tipo === 'photo' ? 'Foto' : 'Nota interna', detalle: n.texto || null, por: n.por || null, fecha: n.fecha || null });
  }
  for (const p of t.pagos || []) {
    events.push({ tipo: 'pago', titulo: `Pago ${money(p.monto).toFixed(2)}`, detalle: [p.metodo, p.descripcion].filter(Boolean).join(' · ') || null, por: null, fecha: p.fecha || null });
  }
  events.sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
  return {
    numero: t.numero,
    cliente: t.cliente,
    telefono: t.telefono || null,
    equipo: t.equipo,
    problema: t.problema || null,
    estatus: t.estatus,
    estatus_nombre: t.estatus_nombre,
    tecnico: t.tecnico || null,
    fecha_prometida: t.fecha_prometida || null,
    total_facturado: t.total_facturado ?? null,
    cobrado: t.cobrado ?? null,
    balance_pendiente: t.balance_pendiente ?? null,
    piezas: (t.piezas?.facturadas || t.piezas?.items || []).slice(0, 12).map((x) => x.nombre || x.pieza || '').filter(Boolean),
    fotos: (t.fotos || []).slice(-60).map((f) => ({ url: f.url, estatus: f.estatus || null, fecha: f.fecha || null })),
    eventos: events.slice(0, 80),
  };
}

async function fetchTicketPanel(numero, actor) {
  const r = await callApi('GET', `tickets/${encodeURIComponent(numero)}`, {}, actor);
  const t = r.body?.ticket;
  if (!r.body?.ok || !t) return null;
  return panelFromDetail(t);
}

async function activeTicketFrom(produced, actor) {
  const numero = lastTicketNumber(produced);
  if (!numero) return null;
  try {
    return await fetchTicketPanel(numero, actor);
  } catch {
    return null;
  }
}


const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-2.5-flash';
const MAX_AUDIO_B64 = 4_000_000;

export async function transcribeAudio({ audioBase64, mimeType }, fetchImpl = fetch) {
  if (!GEMINI_KEY) return { status: 503, body: { ok: false, error: 'La transcripcion no esta configurada', code: 'not_configured' } };
  const audio = String(audioBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!audio) return { status: 400, body: { ok: false, error: 'audio_base64 es requerido', code: 'invalid_body' } };
  if (audio.length > MAX_AUDIO_B64) return { status: 413, body: { ok: false, error: 'El audio es demasiado largo', code: 'too_large' } };
  const prompt = 'Transcribe literalmente este audio en espanol de Puerto Rico. Es alguien del taller de reparacion de celulares y computadoras dandole instrucciones a un asistente: boletos como WO-410, iPhone, Samsung, pantalla, bateria, OLED, LCD, IVU, ATH Movil, nombres de clientes. Usa puntuacion natural y respeta cada palabra, incluso si habla rapido o hace pausas. Devuelve SOLO la transcripcion, sin comillas ni comentarios. Si no hay voz humana clara, devuelve una cadena vacia.';
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mimeType || 'audio/wav', data: audio } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { status: 502, body: { ok: false, error: `La transcripcion fallo: ${data?.error?.message || res.status}`, code: 'provider_error' } };
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
  return { status: 200, body: { ok: true, texto: text } };
}


const MAX_HISTORY_DOC = 900_000;

function historySlug(auth) {
  const user = String(auth.userId || '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 64);
  return user ? `ai-chat-${auth.tenantId}-${user}` : null;
}

export async function loadHistory(auth) {
  const slug = historySlug(auth);
  if (!slug) return { status: 400, body: { ok: false, error: 'No se pudo identificar tu usuario', code: 'no_user' } };
  const rows = await sb(`app_settings?slug=eq.${slug}&select=payload&limit=1`);
  const doc = rows?.[0]?.payload;
  return { status: 200, body: { ok: true, rev: Number(doc?.rev) || 0, estado: doc?.estado || null } };
}

export async function saveHistory(auth, { rev, estado }) {
  const slug = historySlug(auth);
  if (!slug) return { status: 400, body: { ok: false, error: 'No se pudo identificar tu usuario', code: 'no_user' } };
  const newRev = Number(rev);
  if (!Number.isFinite(newRev) || newRev <= 0) return { status: 400, body: { ok: false, error: 'rev invalido', code: 'invalid_body' } };
  if (!estado || typeof estado !== 'object' || !Array.isArray(estado.messages) || !Array.isArray(estado.timeline)) {
    return { status: 400, body: { ok: false, error: 'estado invalido', code: 'invalid_body' } };
  }
  const trimmed = { ...estado, messages: estado.messages.slice(-80), timeline: estado.timeline.slice(-300), pending: Array.isArray(estado.pending) ? estado.pending.slice(0, 10) : [] };
  const text = JSON.stringify(trimmed);
  if (text.length > MAX_HISTORY_DOC) return { status: 413, body: { ok: false, error: 'La conversacion es demasiado grande', code: 'too_large' } };
  const rows = await sb(`app_settings?slug=eq.${slug}&select=id,payload&limit=1`);
  const row = rows?.[0];
  if (row && Number(row.payload?.rev) > newRev) return { status: 409, body: { ok: false, error: 'Hay una version mas reciente', code: 'stale', rev: Number(row.payload.rev) } };
  const payload = { rev: newRev, estado: trimmed, updated_at: new Date().toISOString() };
  if (row) await sb(`app_settings?id=eq.${row.id}`, { method: 'PATCH', body: { payload }, prefer: 'return=minimal' });
  else await sb('app_settings', { method: 'POST', body: { slug, payload }, prefer: 'return=minimal' });
  return { status: 200, body: { ok: true, rev: newRev } };
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
    if (crypto.timingSafeEqual(a, b)) return { tenantId: TENANT_ID, role: 'owner', label: 'Asistente IA - prueba', userId: 'servicio' };
  }
  const member = await requireMember(req);
  if (member.error) return member;
  let label = 'Asistente IA';
  let userId = '';
  try {
    const res = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_KEY, Authorization: `Bearer ${token}` } });
    const user = await res.json().catch(() => ({}));
    const first = sanitizeLabel(String(user?.email || '').split('@')[0]);
    if (first) label = `Asistente IA - ${first}`;
    userId = String(user?.id || '');
  } catch {}
  return { tenantId: member.tenantId, role: member.role, label, userId };
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
  const raw = req.query?.assistant;
  const parts = (Array.isArray(raw) ? raw.join('/') : String(raw || '')).split('/').filter(Boolean);
  const route = parts.join('/');
  if (route === 'whatsapp/webhook') {
    try {
      return await whatsAppWebhook(req, res, TENANT_ID);
    } catch (e) {
      console.error('whatsapp webhook error:', e.message);
      return res.status(500).json({ ok: false });
    }
  }
  if (route === 'plaid/done') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Banco conectado</title></head><body style="font-family:-apple-system,system-ui,sans-serif;text-align:center;padding:64px 24px"><h2>Listo</h2><p>Puedes cerrar esta ventana y volver a Archilla OS.</p></body></html>');
  }
  if (rateLimited()) return fail(res, 429, 'Demasiadas solicitudes, espera un minuto', 'rate_limited');
  const auth = await authenticate(req);
  if (auth.error) return fail(res, auth.status || 401, auth.error, 'unauthorized');

  try {
    if (route === 'config' && req.method === 'GET') {
      const { config } = await loadConfig(auth.tenantId);
      const consumo = enabledFor(auth) ? meter((await loadUsage(auth.tenantId)).usage, config) : null;
      return res.status(200).json({ ok: true, habilitado: enabledFor(auth), ...publicConfig(config), consumo });
    }
    if (!enabledFor(auth)) return fail(res, 403, 'El asistente no esta habilitado para esta cuenta', 'not_enabled');

    if (route === 'history' && req.method === 'GET') {
      const r = await loadHistory(auth);
      return res.status(r.status).json(r.body);
    }
    if (route === 'history' && (req.method === 'PUT' || req.method === 'POST')) {
      const r = await saveHistory(auth, { rev: req.body?.rev, estado: req.body?.estado });
      return res.status(r.status).json(r.body);
    }
    if (route === 'transcribe' && req.method === 'POST') {
      const r = await transcribeAudio({ audioBase64: req.body?.audio_base64, mimeType: req.body?.mime_type });
      return res.status(r.status).json(r.body);
    }
    if (route.startsWith('boleto/') && req.method === 'GET') {
      const numero = decodeURIComponent(route.slice('boleto/'.length));
      const panel = await fetchTicketPanel(numero, auth.label).catch(() => null);
      if (!panel) return fail(res, 404, 'Boleto no encontrado', 'not_found');
      return res.status(200).json({ ok: true, boleto_activo: panel });
    }
    if (route === 'connections' && req.method === 'GET') {
      return res.status(200).json({ ok: true, ...publicConnections(await loadConnections(auth.tenantId), WEB_BASE) });
    }
    if (route === 'connections/whatsapp' && (req.method === 'PUT' || req.method === 'POST')) {
      const saved = await saveWhatsAppConfig(auth.tenantId, req.body || {});
      if (saved.error) return fail(res, 400, saved.error, 'invalid_body');
      return res.status(200).json({ ok: true, ...publicConnections(await loadConnections(auth.tenantId), WEB_BASE) });
    }
    if (route === 'connections/whatsapp/test' && req.method === 'POST') {
      const r = await testWhatsApp(auth.tenantId);
      return res.status(r.status).json(r.body);
    }
    if (route === 'connections/plaid' && (req.method === 'PUT' || req.method === 'POST')) {
      const saved = await savePlaidConfig(auth.tenantId, req.body || {});
      if (saved.error) return fail(res, 400, saved.error, 'invalid_body');
      return res.status(200).json({ ok: true, ...publicConnections(await loadConnections(auth.tenantId), WEB_BASE) });
    }
    if (route === 'connections/plaid/link' && req.method === 'POST') {
      const r = await createPlaidLink(auth.tenantId, WEB_BASE);
      return res.status(r.status).json(r.body);
    }
    if (route === 'connections/plaid/finish' && req.method === 'POST') {
      const r = await finishPlaidLink(auth.tenantId);
      if (r.body?.ok) return res.status(200).json({ ...r.body, ...publicConnections(await loadConnections(auth.tenantId), WEB_BASE) });
      return res.status(r.status).json(r.body);
    }
    if (route === 'connections/plaid/remove' && req.method === 'POST') {
      const r = await removePlaidItem(auth.tenantId, String(req.body?.id || ''));
      return res.status(r.status).json(r.body);
    }
    if (route === 'connections/proveedores' && (req.method === 'PUT' || req.method === 'POST')) {
      const saved = await saveSuppliers(auth.tenantId, req.body?.proveedores);
      if (saved.error) return fail(res, 400, saved.error, 'invalid_body');
      return res.status(200).json({ ok: true, ...publicConnections(await loadConnections(auth.tenantId), WEB_BASE) });
    }

    if (route === 'connections/ebay' && (req.method === 'PUT' || req.method === 'POST')) {
      const saved = await saveEbayConfig(auth.tenantId, req.body || {});
      if (saved.error) return fail(res, 400, saved.error, 'invalid_body');
      return res.status(200).json({ ok: true, ...publicConnections(await loadConnections(auth.tenantId), WEB_BASE) });
    }
    if (route === 'connections/proveedores/sesion' && req.method === 'POST') {
      const r = await supplierLoginWindow(auth.tenantId, String(req.body?.id || ''));
      return res.status(r.status).json(r.body);
    }

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
      const autonomia = b.autonomia === undefined ? (current?.autonomia || 'inteligente') : b.autonomia;
      if (!['inteligente', 'preguntar'].includes(autonomia)) return fail(res, 400, 'autonomia debe ser inteligente o preguntar', 'invalid_body');
      const payload = { provider, model, base_url: baseUrl, tope_tokens_mes: Math.round(tope), tope_usd_mes: topeUsd, autonomia, key_enc: current?.key_enc || null, updated_at: new Date().toISOString(), updated_by: auth.label };
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
          extraText: typeof b.texto === 'string' ? b.texto.trim().slice(0, 4000) : '',
          actor: auth.label,
          shopName,
          tools: availableTools(await loadConnections(auth.tenantId)),
          maxIterations: b.paso_a_paso === true ? 1 : MAX_ITERATIONS,
          deps: { provider: providerCall, callApi },
        });
        const boletoActivo = await activeTicketFrom(out.produced, auth.label);
        const total = await addUsage(auth.tenantId, out.usage).catch(() => null);
        const consumo = total ? meter(total, config) : before;
        return res.status(200).json({ ok: true, mensajes: out.produced, pendientes: out.pending, ejecutadas: out.executed, pasos: out.steps || [], continuar: Boolean(out.truncado && b.paso_a_paso === true), consumo, ...(boletoActivo ? { boleto_activo: boletoActivo } : {}), ...(out.truncado && b.paso_a_paso !== true ? { aviso: 'La respuesta se corto por limite de pasos' } : {}) });
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
