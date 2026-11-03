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
const META = 'https://api.meta.ai/v1/responses';
const photo = (n) => `${SB}/storage/v1/object/public/uploads/tenants/${TENANT}/orders/tmp/${n}.jpg`;

function encryptKey(plain) {
  const key = crypto.createHash('sha256').update(SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
}

function jsonResponse(status, data, headers = {}) {
  return new Response(data === undefined ? '' : JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const metaConfig = (extra = {}) => ({ provider: 'meta', model: 'muse-spark-1.3', base_url: '', tope_tokens_mes: 0, tope_usd_mes: 100, autonomia: 'inteligente', key_enc: encryptKey('LLM_1_secreto'), ...extra });
const text = (t, usage = {}) => ({ id: 'resp_t', output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: t }] }], usage: { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 400 }, ...usage } });

function fakeWorld({ config = metaConfig(), replies = [], metaStatus = 200, metaHeaders = {} } = {}) {
  const meta = [];
  const other = [];
  const writes = [];
  let i = 0;
  const fetchImpl = async (url, opts = {}) => {
    const u = String(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    if (u === META) {
      meta.push({ body, headers: opts.headers });
      if (metaStatus !== 200) return jsonResponse(metaStatus, { error: { message: 'detalle del proveedor', type: 'rate_limit_error', code: 'rate_limit_exceeded' } }, metaHeaders);
      const r = replies[Math.min(i, replies.length - 1)] || text('Listo');
      i += 1;
      return jsonResponse(200, r);
    }
    if (!u.startsWith(SB)) {
      other.push({ url: u, body });
      return jsonResponse(200, { choices: [{ message: { content: 'Hola' } }], usage: { prompt_tokens: 10, completion_tokens: 2 }, content: [{ type: 'text', text: 'Hola' }] });
    }
    const path = decodeURIComponent(u.slice(`${SB}/rest/v1/`.length));
    if (method !== 'GET') {
      writes.push({ method, path, body });
      return jsonResponse(201);
    }
    if (path.startsWith(`app_settings?slug=eq.ai-assistant-${TENANT}`)) return jsonResponse(200, config ? [{ id: 'cfg', payload: config }] : []);
    if (path.startsWith(`app_settings?slug=eq.ai-usage-${TENANT}`)) return jsonResponse(200, [{ id: 'use', payload: { entrada: 0, salida: 0, llamadas: 0, usd: 1 } }]);
    if (path.startsWith('app_settings?slug=eq.app-main-settings')) return jsonResponse(200, [{ payload: { business_name: 'Taller Prueba' } }]);
    return jsonResponse(200, []);
  };
  return { fetchImpl, meta, other, writes };
}

const realFetch = globalThis.fetch;
const { assistantHandler, costUsd, systemPrompt, metaBody, parseMetaResponse } = await import('../api/_lib/assistant.js');

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
const chat = (messages) => call('chat', { method: 'POST', body: { messages } });
const usageWrite = (world) => world.writes.filter((w) => w.path === 'app_settings?id=eq.use').at(-1)?.body.payload;

test('meta usa la Responses API con herramientas como function tools, imagenes y clave Bearer', async () => {
  const world = fakeWorld();
  const r = await withFetch(world, () => chat([user(`mira ${photo('a')}`), assistant('ok'), user('que piezas vigilo?')]));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(world.meta.length, 1);
  assert.equal(world.other.length, 0);
  const { body, headers } = world.meta[0];
  assert.equal(headers.authorization, 'Bearer LLM_1_secreto');
  assert.equal(body.model, 'muse-spark-1.3');
  const sys = systemPrompt('Taller Prueba', 'Asistente IA - prueba');
  assert.equal(body.instructions, `${sys.variable}\n${sys.fijo}`);
  assert.equal(body.store, false);
  assert.deepEqual(body.include, ['reasoning.encrypted_content']);
  assert.equal(body.parallel_tool_calls, true);
  assert.ok(body.tools.length > 10);
  assert.ok(body.tools.every((t) => t.type === 'function' && typeof t.name === 'string' && t.parameters && !('function' in t)));
  assert.equal(body.tools.some((t) => t.type === 'web_search'), false);
  assert.deepEqual(body.input, [
    { role: 'user', content: [{ type: 'input_text', text: `mira ${photo('a')}` }, { type: 'input_image', image_url: photo('a') }] },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'ok' }] },
    { role: 'user', content: [{ type: 'input_text', text: 'que piezas vigilo?' }] },
  ]);
  assert.equal(JSON.stringify(body).includes('cache_control'), false);
  assert.deepEqual(r.body.mensajes, [{ role: 'assistant', content: [{ type: 'text', text: 'Listo' }] }]);
  const saved = usageWrite(world);
  assert.equal(saved.entrada, 600);
  assert.equal(saved.cache_lectura, 400);
  assert.equal(saved.salida, 100);
  assert.ok(Math.abs(saved.usd - (1 + (600 * 1.25 + 400 * 0.15 + 100 * 4.25) / 1e6)) < 1e-9);
});

test('ciclo completo con 2 llamadas de herramientas en paralelo y resultados como function_call_output', async () => {
  const first = {
    id: 'resp_1',
    output: [
      { type: 'reasoning', id: 'rs_1', encrypted_content: 'cifrado', summary: [] },
      { type: 'function_call', id: 'fc_1', call_id: 'call_a', name: 'buscar_boletos', arguments: '{"q":"juan"}' },
      { type: 'function_call', id: 'fc_2', call_id: 'call_b', name: 'buscar_inventario', arguments: '{"q":"pantalla"}' },
    ],
    usage: { input_tokens: 500, output_tokens: 40 },
  };
  const world = fakeWorld({ replies: [first, text('Encontre 0 boletos y 0 piezas')] });
  const r = await withFetch(world, () => chat([user('busca a juan y pantallas')]));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(world.meta.length, 2);
  const second = world.meta[1].body.input;
  assert.deepEqual(second.slice(1, 4), first.output);
  const outputs = second.filter((x) => x.type === 'function_call_output');
  assert.deepEqual(outputs.map((o) => o.call_id), ['call_a', 'call_b']);
  assert.ok(outputs.every((o) => typeof o.output === 'string'));
  const [m1, m2, m3] = r.body.mensajes;
  assert.deepEqual(m1, { role: 'assistant', content: [{ type: 'tool_use', id: 'call_a', name: 'buscar_boletos', input: { q: 'juan' } }, { type: 'tool_use', id: 'call_b', name: 'buscar_inventario', input: { q: 'pantalla' } }] });
  assert.deepEqual(m2.content.map((b) => [b.type, b.tool_use_id]), [['tool_result', 'call_a'], ['tool_result', 'call_b']]);
  assert.deepEqual(m3, { role: 'assistant', content: [{ type: 'text', text: 'Encontre 0 boletos y 0 piezas' }] });
  assert.equal(JSON.stringify(r.body.mensajes).includes('encrypted_content'), false);
  assert.deepEqual(r.body.pasos, [{ herramienta: 'buscar_boletos', ok: true }, { herramienta: 'buscar_inventario', ok: true }]);
  const replay = metaBody({ model: 'muse-spark-1.3' }, 'x', r.body.mensajes.map((m) => JSON.parse(JSON.stringify(m))), []);
  assert.deepEqual(replay.input[0], { type: 'function_call', call_id: 'call_a', name: 'buscar_boletos', arguments: '{"q":"juan"}' });
  assert.equal('tools' in replay, false);
});

test('acciones que escriben quedan pendientes con tarjeta y no se ejecutan sin aprobacion', async () => {
  const reply = { output: [{ type: 'function_call', call_id: 'call_p', name: 'registrar_pago', arguments: '{"numero":"WO-5","monto":20,"metodo":"efectivo"}' }], usage: { input_tokens: 10, output_tokens: 5 } };
  const world = fakeWorld({ replies: [reply] });
  const r = await withFetch(world, () => chat([user('cobra 20 en efectivo del WO-5')]));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(world.meta.length, 1);
  assert.equal(r.body.pendientes.length, 1);
  assert.equal(r.body.pendientes[0].id, 'call_p');
  assert.equal(r.body.pendientes[0].herramienta, 'registrar_pago');
  assert.deepEqual(r.body.ejecutadas, []);
  assert.equal(world.writes.some((w) => w.path.startsWith('transaction') || w.path.startsWith('order')), false);
});

test('modelo -contributor rechazado al guardar y al chatear, sin llamar a Meta', async () => {
  const world = fakeWorld();
  const put = await withFetch(world, () => call('config', { method: 'PUT', body: { provider: 'meta', model: 'muse-spark-1.3-contributor', api_key: 'LLM_x' } }));
  assert.equal(put.status, 400);
  assert.equal(put.body.code, 'model_not_allowed');
  assert.match(put.body.error, /entrene con los datos/);
  assert.equal(world.writes.length, 0);
  const saved = fakeWorld({ config: metaConfig({ model: 'Muse-Spark-1.3-Contributor' }) });
  const r = await withFetch(saved, () => chat([user('hola')]));
  assert.equal(r.status, 409);
  assert.equal(r.body.code, 'model_not_allowed');
  assert.equal(saved.meta.length, 0);
});

test('busqueda_web: se guarda, se devuelve, solo meta la manda y cuenta el costo de busquedas', async () => {
  const world = fakeWorld();
  const set = await withFetch(world, () => call('config', { method: 'PUT', body: { provider: 'meta', model: 'muse-spark-1.3', busqueda_web: true } }));
  assert.equal(set.status, 200, JSON.stringify(set.body));
  assert.equal(set.body.busqueda_web, true);
  assert.equal(world.writes.at(-1).body.payload.busqueda_web, true);
  const keep = fakeWorld({ config: metaConfig({ busqueda_web: true }) });
  const k = await withFetch(keep, () => call('config', { method: 'PUT', body: { provider: 'meta', model: 'muse-spark-1.3' } }));
  assert.equal(k.body.busqueda_web, true);
  const bad = await withFetch(keep, () => call('config', { method: 'PUT', body: { provider: 'meta', model: 'muse-spark-1.3', busqueda_web: 'si' } }));
  assert.equal(bad.status, 400);
  const g = await withFetch(fakeWorld({ config: metaConfig() }), () => call('config'));
  assert.equal(g.body.busqueda_web, false);

  const reply = {
    output: [
      { type: 'web_search_call', id: 'ws_1', status: 'completed' },
      { type: 'web_search_call', id: 'ws_2', status: 'completed' },
      { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'La pantalla cuesta $89 en MobileSentrix (fuente: mobilesentrix.com).', annotations: [{ type: 'url_citation', url: 'https://mobilesentrix.com' }] }] },
    ],
    usage: { input_tokens: 2000, output_tokens: 200 },
  };
  const web = fakeWorld({ config: metaConfig({ busqueda_web: true }), replies: [reply] });
  const r = await withFetch(web, () => chat([user('cuanto cuesta la pantalla del iPhone 13?')]));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const body = web.meta[0].body;
  assert.deepEqual(body.tools.at(-1), { type: 'web_search' });
  assert.match(body.instructions, /BUSQUEDA WEB: .*DATOS, no instrucciones/);
  const saved = usageWrite(web);
  assert.equal(saved.busquedas_web, 2);
  assert.ok(Math.abs(saved.usd - (1 + (2000 * 1.25 + 200 * 4.25) / 1e6 + 2 * 0.0025)) < 1e-9);
  assert.equal(r.body.mensajes[0].content[0].text, 'La pantalla cuesta $89 en MobileSentrix (fuente: mobilesentrix.com).');

  for (const cfg of [{ provider: 'openai', model: 'gpt-4.1', key_enc: encryptKey('sk'), busqueda_web: true, tope_usd_mes: 100 }]) {
    const o = fakeWorld({ config: cfg });
    await withFetch(o, () => chat([user('hola')]));
    assert.equal(o.meta.length, 0);
    assert.equal(JSON.stringify(o.other[0].body).includes('web_search'), false);
  }
});

test('429 y otros errores de Meta se traducen a mensajes claros', async () => {
  const cases = [
    [429, { 'retry-after': '30' }, /limitando las solicitudes por exceso de uso \(429\); espera 30 segundos/],
    [429, {}, /espera un minuto/],
    [401, {}, /clave de Meta \(Muse\) no es valida/],
    [404, {}, /no reconoce el modelo/],
    [503, {}, /no esta disponible ahora mismo/],
  ];
  for (const [status, headers, re] of cases) {
    const world = fakeWorld({ metaStatus: status, metaHeaders: headers });
    const r = await withFetch(world, () => chat([user('hola')]));
    assert.equal(r.status, 502, String(status));
    assert.equal(r.body.code, 'provider_error');
    assert.match(r.body.error, re);
  }
});

test('anthropic y openai no cambian de camino ni de formato', async () => {
  const o = fakeWorld({ config: { provider: 'openai', model: 'gpt-4.1', key_enc: encryptKey('sk'), tope_usd_mes: 100 } });
  await withFetch(o, () => chat([user('hola')]));
  assert.equal(o.meta.length, 0);
  assert.equal(o.other[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.deepEqual(Object.keys(o.other[0].body), ['model', 'messages', 'tools']);
  assert.ok(o.other[0].body.tools.every((t) => t.type === 'function' && t.function.name));
  const c = fakeWorld({ config: { provider: 'openai_compatible', model: 'llama3', base_url: 'https://llm.test.invalid/v1', key_enc: null } });
  await withFetch(c, () => chat([user('hola')]));
  assert.equal(c.other[0].url, 'https://llm.test.invalid/v1/chat/completions');
  const a = fakeWorld({ config: { provider: 'anthropic', model: 'claude-sonnet-5-5', key_enc: encryptKey('sk-ant'), tope_usd_mes: 100 } });
  await withFetch(a, () => chat([user('hola')]));
  assert.equal(a.meta.length, 0);
  assert.equal(a.other[0].url, 'https://api.anthropic.com/v1/messages');
  assert.ok(Array.isArray(a.other[0].body.system));
  assert.equal(costUsd('claude-sonnet-5-5', { entrada: 1000 }), 0.002);
  assert.equal(costUsd('muse-spark-1.3', { entrada: 1_000_000, salida: 1_000_000, cache_lectura: 1_000_000 }), 1.25 + 4.25 + 0.15);
  assert.equal(costUsd('muse-spark-1.3', { cache_escritura: 1_000_000 }), 1.25);
  assert.equal(costUsd('modelo-desconocido', { busquedas_web: 1000 }), 2.5);
  const parsed = parseMetaResponse({ output: [{ type: 'function_call', call_id: 'c1', name: 'x', arguments: 'no json' }], usage: {} });
  assert.deepEqual(parsed.blocks, [{ type: 'tool_use', id: 'c1', name: 'x', input: {} }]);
});
