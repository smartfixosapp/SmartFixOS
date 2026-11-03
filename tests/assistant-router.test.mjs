import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const TENANT = '11111111-2222-4333-8444-555555555555';
const SERVICE = 's'.repeat(40);
const SECRET = 'k'.repeat(40);
process.env.SUPABASE_URL = 'https://sb.test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.MUSE_TENANT_ID = TENANT;
process.env.JAIME_TENANT_ID = TENANT;
process.env.ASSISTANT_KEY_SECRET = SECRET;
process.env.JAIME_API_TOKEN = SERVICE;

const SB = 'https://sb.test.invalid';
const HAIKU = 'claude-haiku-5-5';
const SONNET = 'claude-sonnet-5-5';
const photo = (n) => `${SB}/storage/v1/object/public/uploads/tenants/${TENANT}/orders/tmp/${n}.jpg`;

function encryptKey(plain) {
  const key = crypto.createHash('sha256').update(SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function jsonResponse(status, data) {
  return new Response(data === undefined ? '' : JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const reply = (content, usage = {}) => ({ content, usage: { input_tokens: 1000, output_tokens: 100, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...usage } });
const textReply = (t) => reply([{ type: 'text', text: t }]);
const toolReply = (id, name, input = {}) => reply([{ type: 'tool_use', id, name, input }]);
const baseConfig = (extra = {}) => ({ provider: 'anthropic', model: SONNET, base_url: '', tope_tokens_mes: 0, tope_usd_mes: 100, autonomia: 'inteligente', key_enc: encryptKey('sk-ant-prueba'), ...extra });

function fakeWorld({ config = baseConfig(), usage = { entrada: 0, salida: 0, llamadas: 0, usd: 1 }, replies = [] } = {}) {
  const anthropic = [];
  const openai = [];
  const writes = [];
  let i = 0;
  const fetchImpl = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    if (u === 'https://api.anthropic.com/v1/messages') {
      anthropic.push(body);
      const r = replies[Math.min(i, replies.length - 1)] || textReply('Listo');
      i += 1;
      return jsonResponse(200, r);
    }
    if (u.endsWith('/chat/completions')) {
      openai.push(body);
      return jsonResponse(200, { choices: [{ message: { content: 'Hola' } }], usage: { prompt_tokens: 10, completion_tokens: 2 } });
    }
    if (!u.startsWith(SB)) throw new Error(`red real bloqueada: ${u}`);
    const path = decodeURIComponent(u.slice(`${SB}/rest/v1/`.length));
    if (method !== 'GET') {
      writes.push({ method, path, body });
      return jsonResponse(201);
    }
    if (path.startsWith(`app_settings?slug=eq.ai-assistant-${TENANT}`)) return jsonResponse(200, config ? [{ id: 'cfg', payload: config }] : []);
    if (path.startsWith(`app_settings?slug=eq.ai-usage-${TENANT}`)) return jsonResponse(200, usage ? [{ id: 'use', payload: usage }] : []);
    if (path.startsWith('app_settings?slug=eq.app-main-settings')) return jsonResponse(200, [{ payload: { business_name: 'Taller Prueba' } }]);
    return jsonResponse(200, []);
  };
  return { fetchImpl, anthropic, openai, writes };
}

const realFetch = globalThis.fetch;
const { assistantHandler, costUsd, systemPrompt, TOOLS, anthropicBody, planModel } = await import('../api/_lib/assistant.js');
const router = await import('../api/_lib/router.js');

function call(route, { method = 'GET', body, token = SERVICE } = {}) {
  return new Promise((resolve) => {
    const req = { method, headers: token ? { authorization: `Bearer ${token}` } : {}, query: { assistant: route }, body };
    const res = {
      statusCode: 200,
      setHeader() {},
      status(c) { this.statusCode = c; return this; },
      json(p) { resolve({ status: this.statusCode, body: p }); return this; },
      send(p) { resolve({ status: this.statusCode, body: p }); return this; },
    };
    assistantHandler(req, res);
  });
}

async function withFetch(world, fn) {
  globalThis.fetch = world.fetchImpl;
  try { return await fn(); } finally { globalThis.fetch = realFetch; }
}

const user = (t) => ({ role: 'user', content: [{ type: 'text', text: t }] });
const assistant = (t) => ({ role: 'assistant', content: [{ type: 'text', text: t }] });
const chat = (messages, extra = {}) => call('chat', { method: 'POST', body: { messages, ...extra } });
const usageWrite = (world) => world.writes.filter((w) => w.path === 'app_settings?id=eq.use').at(-1)?.body.payload;
const isMutatingTool = (name) => Boolean(TOOLS.find((t) => t.name === name)?.mutating);
const route = (text, extra = {}) => router.routeRequest({ messages: [user(text)], isMutatingTool, ...extra });

const LECTURA = [
  'cuanto debe el 417',
  'Cuánto debe el WO-417?',
  'abre el 417',
  'que boletos estan listos para recoger?',
  'qué tengo pendiente hoy',
  'dame el resumen del dia',
  'busca a Juan Perez',
  'muestrame los boletos de Samsung',
  'cual es el saldo de Maria',
  'precio de la pantalla del iPhone 13',
  'cuanto cuesta una bateria de iPhone 11?',
  'cuantos boletos hay en reparacion',
  'ver el WO-382',
  'lista los clientes con balance',
  'hay piezas bajo stock?',
  'cotizame una pantalla de Samsung A54',
  'dime el estado del 410',
  'revisa las alertas',
  'quien tiene el iPad Pro?',
  'cuanto vendimos esta semana?',
  'dónde está el iPhone de Ana?',
];

const ESCRITURA = [
  'cobra 40 en efectivo del 417',
  'cobra y adjunta esta foto',
  'cóbrale 20 por ATH',
  'registra un pago de 50 dolares',
  'pasalo a listo para recoger',
  'ponlo en espera de piezas',
  'cambia el estatus del 417 a entregado',
  'crea un boleto para Juan Perez',
  'nuevo boleto',
  'agregale una nota: ya llego la pantalla',
  'añade la pantalla al boleto',
  'anula la venta POS-1234',
  'devuelvele el deposito al cliente',
  'envíale un mensaje por whatsapp',
  'mandale el recibo por correo',
  'registra un gasto de 30 en piezas',
  'vende un cargador',
  'ya termine este equipo',
  'quitale la bateria del boleto',
  'ponle un descuento de 10%',
  'entrega el 417',
  'cancela el boleto 300',
  'cliente nuevo: Ana Rivera',
  'recuerdame llamar a Pedro el jueves',
];

test('router: frases reales de lectura van al modelo ligero', () => {
  for (const t of LECTURA) assert.deepEqual(route(t), { nivel: 'ligero', motivo: 'lectura' }, t);
});

test('router: frases con escritura o dinero van al modelo completo, con y sin acentos', () => {
  for (const t of ESCRITURA) assert.deepEqual(route(t), { nivel: 'completo', motivo: 'escritura' }, t);
  for (const t of ['cuanto pago Juan?', 'cual es el estatus del 417?', 'que nota tiene el 410?']) assert.equal(route(t).nivel, 'completo', t);
});

test('router: dudas, confirmaciones, fotos, paso a paso y continuidad van al completo', () => {
  for (const t of ['si', 'dale', 'hazlo', 'Perez', '7875551234', 'ok perfecto', '']) assert.deepEqual(route(t), { nivel: 'completo', motivo: 'duda' }, t);
  assert.equal(route('cuanto debe el 417', { decisions: [{ id: 'x', aprobar: true }] }).motivo, 'confirmacion');
  assert.equal(router.routeRequest({ messages: [user('hola'), { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'registrar_pago', input: {} }] }], isMutatingTool }).motivo, 'confirmacion');
  assert.equal(route(`que ves en esta? ${photo('a')}`).motivo, 'foto');
  assert.equal(router.routeRequest({ messages: [{ role: 'user', content: [{ type: 'text', text: 'mira' }, { type: 'image', url: photo('b') }] }], isMutatingTool }).motivo, 'foto');
  assert.equal(route('cuanto debe el 417', { pasoAPaso: true }).motivo, 'paso_a_paso');
  const afterWrite = [user('cobra 20 del 5'), { role: 'assistant', content: [{ type: 'tool_use', id: 'p1', name: 'registrar_pago', input: {} }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'p1', content: '{}' }] }, assistant('Listo'), user('cuanto debe ahora?')];
  assert.deepEqual(router.routeRequest({ messages: afterWrite, isMutatingTool }), { nivel: 'completo', motivo: 'continuidad' });
  const afterRead = [user('busca a juan'), { role: 'assistant', content: [{ type: 'tool_use', id: 'b1', name: 'buscar_boletos', input: {} }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'b1', content: '{}' }] }, assistant('No hay'), user('y cuanto debe ana?')];
  assert.deepEqual(router.routeRequest({ messages: afterRead, isMutatingTool }), { nivel: 'ligero', motivo: 'lectura' });
  assert.equal(route('cuanto debe el 417', { texto: 'y cobrale' }).nivel, 'completo');
});

test('lectura usa haiku con el mismo esquema de cache y responde modo_ia', async () => {
  const full = fakeWorld();
  await withFetch(full, () => chat([user('hola'), assistant('Hola'), user('hazlo')]));
  const world = fakeWorld();
  const r = await withFetch(world, () => chat([user('hola'), assistant('Hola'), user('cuanto debe el 417?')]));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(world.anthropic.length, 1);
  const [light] = world.anthropic;
  const [heavy] = full.anthropic;
  assert.equal(light.model, HAIKU);
  assert.equal(heavy.model, SONNET);
  assert.deepEqual(light.system, heavy.system);
  assert.deepEqual(light.tools, heavy.tools);
  assert.equal((JSON.stringify(light).match(/"cache_control"/g) || []).length, (JSON.stringify(heavy).match(/"cache_control"/g) || []).length);
  assert.deepEqual(r.body.modo_ia, { modo: 'automatico', modelo: HAIKU, escalado: false, motivo: 'lectura' });
  assert.deepEqual(r.body.modo_ahorro, { activo: false });
  const saved = usageWrite(world);
  assert.equal(saved.llamadas_ligero, 1);
  assert.equal(saved.llamadas_completo, undefined);
  assert.ok(Math.abs(saved.usd - (1 + costUsd(HAIKU, { entrada: 1000, salida: 100 }))) < 1e-9);
  assert.equal(r.body.consumo.llamadas_ligero, 1);
  assert.equal(r.body.consumo.llamadas_completo, 0);
});

test('escalado: si el ligero pide una herramienta que escribe se descarta y se rehace con el completo', async () => {
  const world = fakeWorld({ replies: [toolReply('tu_ligero', 'registrar_pago', { numero: 'WO-417', monto: 20, metodo: 'efectivo' }), toolReply('tu_completo', 'registrar_pago', { numero: 'WO-417', monto: 20, metodo: 'efectivo' })] });
  const r = await withFetch(world, () => chat([user('cuanto debe el 417?')]));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(world.anthropic.map((b) => b.model), [HAIKU, SONNET]);
  assert.deepEqual(world.anthropic[1].messages, world.anthropic[0].messages);
  assert.equal(JSON.stringify(r.body).includes('tu_ligero'), false);
  assert.deepEqual(r.body.pendientes.map((p) => p.id), ['tu_completo']);
  assert.deepEqual(r.body.ejecutadas, []);
  assert.equal(world.writes.some((w) => !w.path.startsWith('app_settings')), false);
  assert.deepEqual(r.body.modo_ia, { modo: 'automatico', modelo: SONNET, escalado: true, motivo: 'lectura' });
  const saved = usageWrite(world);
  assert.equal(saved.llamadas, 2);
  assert.equal(saved.llamadas_ligero, 1);
  assert.equal(saved.llamadas_completo, 1);
  const expected = costUsd(HAIKU, { entrada: 1000, salida: 100 }) + costUsd(SONNET, { entrada: 1000, salida: 100 });
  assert.ok(Math.abs(saved.usd - (1 + expected)) < 1e-9);
});

test('mixto: el ligero lee primero y al pedir escribir el resto sigue con el completo', async () => {
  const world = fakeWorld({ replies: [
    toolReply('tu_1', 'lista_vigilancia'),
    toolReply('tu_2', 'crear_tarea', { titulo: 'x' }),
    toolReply('tu_3', 'lista_vigilancia'),
    textReply('Listo'),
  ] });
  const r = await withFetch(world, () => chat([user('que tengo pendiente hoy?')]));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(world.anthropic.map((b) => b.model), [HAIKU, HAIKU, SONNET, SONNET]);
  const ids = r.body.mensajes.flatMap((m) => m.content.filter((b) => b.type === 'tool_use').map((b) => b.id));
  assert.deepEqual(ids, ['tu_1', 'tu_3']);
  assert.equal(JSON.stringify(r.body.mensajes).includes('tu_2'), false);
  assert.deepEqual(r.body.pendientes, []);
  assert.equal(r.body.modo_ia.escalado, true);
  assert.equal(r.body.modo_ia.modelo, SONNET);
  const saved = usageWrite(world);
  assert.equal(saved.llamadas_ligero, 2);
  assert.equal(saved.llamadas_completo, 2);
});

test('el ligero nunca ejecuta una herramienta que escribe aunque sea automatica', async () => {
  const world = fakeWorld({ replies: [toolReply('tu_auto', 'crear_tarea', { titulo: 'llamar a Pedro' }), textReply('Te aviso luego')] });
  const r = await withFetch(world, () => chat([user('que tengo hoy?')]));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(world.anthropic.map((b) => b.model), [HAIKU, SONNET]);
  assert.deepEqual(r.body.ejecutadas, []);
  assert.equal(world.writes.some((w) => !w.path.startsWith('app_settings')), false);
  assert.equal(JSON.stringify(world.writes).includes('llamar a Pedro'), false);
});

test('escritura empieza directo con el completo sin llamar al ligero', async () => {
  const world = fakeWorld({ replies: [toolReply('tu_c', 'registrar_pago', { numero: 'WO-417', monto: 40, metodo: 'efectivo' })] });
  const r = await withFetch(world, () => chat([user('cobra 40 en efectivo del 417')]));
  assert.deepEqual(world.anthropic.map((b) => b.model), [SONNET]);
  assert.deepEqual(r.body.modo_ia, { modo: 'automatico', modelo: SONNET, escalado: false, motivo: 'escritura' });
  assert.equal(r.body.pendientes.length, 1);
  assert.equal(usageWrite(world).llamadas_completo, 1);
});

test('modo_ia siempre_completo ignora el router y modo_ahorro al 80% sigue usando haiku', async () => {
  const always = fakeWorld({ config: baseConfig({ modo_ia: 'siempre_completo' }) });
  const a = await withFetch(always, () => chat([user('cuanto debe el 417?')]));
  assert.deepEqual(always.anthropic.map((b) => b.model), [SONNET]);
  assert.deepEqual(a.body.modo_ia, { modo: 'siempre_completo', modelo: SONNET, escalado: false, motivo: 'siempre_completo' });
  const saving = fakeWorld({ config: baseConfig({ tope_usd_mes: 10 }), usage: { usd: 8.5, entrada: 0, salida: 0, llamadas: 0 }, replies: [toolReply('tu_h', 'registrar_pago', { numero: 'WO-5', monto: 20, metodo: 'efectivo' })] });
  const s = await withFetch(saving, () => chat([user('cobra 20 en efectivo del WO-5')]));
  assert.deepEqual(saving.anthropic.map((b) => b.model), [HAIKU]);
  assert.equal(s.body.modo_ahorro.activo, true);
  assert.deepEqual(s.body.modo_ia, { modo: 'automatico', modelo: HAIKU, escalado: false, motivo: 'ahorro' });
  assert.deepEqual(s.body.pendientes.map((p) => p.id), ['tu_h']);
  const off = fakeWorld({ config: baseConfig({ modo_ahorro: 'apagado', tope_usd_mes: 10 }), usage: { usd: 8.5, entrada: 0, salida: 0, llamadas: 0 } });
  const o = await withFetch(off, () => chat([user('cuanto debe el 417?')]));
  assert.deepEqual(off.anthropic.map((b) => b.model), [HAIKU]);
  assert.equal(o.body.modo_ia.motivo, 'lectura');
  const haikuCfg = fakeWorld({ config: baseConfig({ model: HAIKU }), replies: [toolReply('tu_x', 'registrar_pago', { numero: 'WO-5', monto: 1, metodo: 'efectivo' })] });
  const h = await withFetch(haikuCfg, () => chat([user('cuanto debe el 417?')]));
  assert.deepEqual(haikuCfg.anthropic.map((b) => b.model), [HAIKU]);
  assert.equal(h.body.modo_ia.escalado, false);
});

test('otros proveedores no cambian', async () => {
  const world = fakeWorld({ config: { provider: 'openai', model: 'gpt-4.1', key_enc: encryptKey('sk'), tope_usd_mes: 100 } });
  const r = await withFetch(world, () => chat([user('cuanto debe el 417?')]));
  assert.equal(world.anthropic.length, 0);
  assert.equal(world.openai[0].model, 'gpt-4.1');
  assert.deepEqual(r.body.modo_ia, { modo: 'automatico', modelo: 'gpt-4.1', escalado: false, motivo: 'proveedor' });
  const saved = usageWrite(world);
  assert.equal(saved.llamadas_ligero, undefined);
  assert.equal(saved.llamadas_completo, undefined);
  assert.equal('llamadas_ligero' in r.body.consumo, false);
  assert.equal(planModel({ provider: 'meta', model: 'muse-spark-1.3' }, null, { messages: [user('cuanto debe?')] }).router, null);
});

test('config: modo_ia por defecto automatico, se guarda, se conserva y se valida', async () => {
  const world = fakeWorld({ config: baseConfig() });
  const g = await withFetch(world, () => call('config'));
  assert.equal(g.body.modo_ia, 'automatico');
  const set = await withFetch(world, () => call('config', { method: 'PUT', body: { provider: 'anthropic', model: SONNET, modo_ia: 'siempre_completo' } }));
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.equal(set.body.modo_ia, 'siempre_completo');
  assert.equal(world.writes.at(-1).body.payload.modo_ia, 'siempre_completo');
  const keepWorld = fakeWorld({ config: baseConfig({ modo_ia: 'siempre_completo' }) });
  const keep = await withFetch(keepWorld, () => call('config', { method: 'PUT', body: { provider: 'anthropic', model: SONNET } }));
  assert.equal(keep.body.modo_ia, 'siempre_completo');
  const bad = await withFetch(world, () => call('config', { method: 'PUT', body: { provider: 'anthropic', model: SONNET, modo_ia: 'turbo' } }));
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'invalid_body');
});

test('tarifas y minimo de cache: el prefijo cacheado supera el minimo de haiku', () => {
  assert.ok(Math.abs(costUsd(HAIKU, { entrada: 10_000, salida: 10_000 }) - 0.006) < 1e-12);
  assert.ok(Math.abs(costUsd(SONNET, { entrada: 10_000, salida: 10_000 }) - 0.12) < 1e-12);
  assert.ok(Math.abs(costUsd(HAIKU, { cache_lectura: 10_000, cache_escritura: 10_000 }) - 0.00135) < 1e-12);
  assert.ok(Math.abs(costUsd(HAIKU, { entrada: 200_000 }) - 0.1) < 1e-12);
  const body = anthropicBody({ model: HAIKU }, systemPrompt('T', 'Yo'), [user('hola')], TOOLS);
  const prefixChars = JSON.stringify(body.tools).length + body.system[0].text.length;
  assert.ok(prefixChars / 4 > 4096, String(prefixChars));
});
