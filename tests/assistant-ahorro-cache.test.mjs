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

const anthropicText = (text, usage = {}) => ({ content: [{ type: 'text', text }], usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, ...usage } });

function fakeWorld({ config, usage = null, replies = [], openaiReply = { choices: [{ message: { content: 'Hola' } }], usage: { prompt_tokens: 10, completion_tokens: 2 } } }) {
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
      const r = replies[Math.min(i, replies.length - 1)] || anthropicText('Listo');
      i += 1;
      return jsonResponse(200, r);
    }
    if (u.endsWith('/chat/completions')) {
      openai.push({ url: u, body });
      return jsonResponse(200, openaiReply);
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
const mod = await import('../api/_lib/assistant.js');
const { assistantHandler, anthropicBody, slimHistory, costUsd, cacheSavingsUsd, savingsMode, systemPrompt, TOOLS } = mod;
const { prDayRange } = await import('../api/_lib/muse.js');

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

const baseConfig = (extra = {}) => ({ provider: 'anthropic', model: 'claude-sonnet-5-5', base_url: '', tope_tokens_mes: 0, tope_usd_mes: 100, autonomia: 'inteligente', key_enc: encryptKey('sk-ant-prueba'), ...extra });
const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const assistant = (text) => ({ role: 'assistant', content: [{ type: 'text', text }] });
const toolUse = (id, name, input = {}) => ({ role: 'assistant', content: [{ type: 'tool_use', id, name, input }] });
const toolResult = (id, content) => ({ role: 'user', content: [{ type: 'tool_result', tool_use_id: id, content }] });

function stripCache(value) {
  return JSON.parse(JSON.stringify(value, (k, v) => (k === 'cache_control' ? undefined : v)));
}

function countMarks(body) {
  return (JSON.stringify(body).match(/"cache_control"/g) || []).length;
}

const lastBlock = (m) => m.content[m.content.length - 1];

test('cuerpo a Anthropic: cache en la ultima herramienta, system fijo y punto movil en la conversacion, maximo 4', async () => {
  const world = fakeWorld({
    config: baseConfig(),
    usage: { entrada: 0, salida: 0, llamadas: 0, usd: 1 },
    replies: [
      { content: [{ type: 'tool_use', id: 'tu_1', name: 'lista_vigilancia', input: {} }], usage: { input_tokens: 50, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 9000 } },
      anthropicText('No hay piezas vigiladas', { cache_read_input_tokens: 9000, cache_creation_input_tokens: 60 }),
    ],
  });
  const r = await withFetch(world, () => call('chat', { method: 'POST', body: { messages: [user('hola'), assistant('Hola, en que te ayudo?'), user('que piezas vigilo?')] } }));
  assert.equal(r.status, 200);
  assert.equal(world.anthropic.length, 2);
  const [first, second] = world.anthropic;
  for (const body of world.anthropic) {
    assert.ok(countMarks(body) <= 4);
    assert.deepEqual(body.tools[body.tools.length - 1].cache_control, { type: 'ephemeral' });
    assert.equal(body.tools.slice(0, -1).some((t) => t.cache_control), false);
    assert.equal(body.system.length, 2);
    assert.deepEqual(body.system[0].cache_control, { type: 'ephemeral' });
    assert.equal(body.system[1].cache_control, undefined);
    assert.ok(body.system[1].text.startsWith('Eres el Asistente IA de Taller Prueba'));
    assert.ok(body.system[1].text.includes(prDayRange().day));
    assert.equal(body.system[0].text.includes(prDayRange().day), false);
    assert.equal(body.system[0].text.includes('Taller Prueba'), false);
    assert.deepEqual(lastBlock(body.messages[body.messages.length - 1]).cache_control, { type: 'ephemeral' });
  }
  assert.equal(countMarks(first), 4);
  assert.deepEqual(lastBlock(first.messages[0]).cache_control, { type: 'ephemeral' });
  assert.equal(second.messages.length, 5);
  assert.equal(second.messages[4].content[0].type, 'tool_result');
  assert.deepEqual(lastBlock(second.messages[2]).cache_control, { type: 'ephemeral' });
  assert.deepEqual(stripCache(second.messages.slice(0, 3)), stripCache(first.messages));
  assert.deepEqual(stripCache(second.tools), stripCache(first.tools));
  assert.deepEqual(second.system, first.system);
  assert.deepEqual(r.body.modo_ahorro, { activo: false });
  const saved = world.writes.find((w) => w.path === 'app_settings?id=eq.use');
  assert.equal(saved.body.payload.cache_lectura, 9000);
  assert.equal(saved.body.payload.cache_escritura, 9060);
  const expectedUsd = costUsd('claude-sonnet-5-5', { entrada: 50, salida: 10, cache_escritura: 9000 }) + costUsd('claude-sonnet-5-5', { entrada: 100, salida: 20, cache_lectura: 9000, cache_escritura: 60 });
  assert.ok(Math.abs(saved.body.payload.usd - (1 + expectedUsd)) < 1e-6);
  assert.ok(saved.body.payload.usd_ahorrado_cache > 0);
  assert.ok(r.body.consumo.usd_ahorrado_cache >= 0);
});

test('orden de herramientas e input canonico: mismo prefijo aunque el cliente cambie el orden de las llaves', () => {
  const cfg = baseConfig();
  const sys = systemPrompt('Taller', 'Yo');
  const a = anthropicBody(cfg, sys, [user('mueve el WO-1'), { role: 'assistant', content: [{ type: 'tool_use', id: 'x', name: 'cambiar_estatus', input: { numero: 'WO-1', estatus: 'in_progress' } }] }, toolResult('x', '{"ok":true}'), assistant('Listo'), user('gracias')], TOOLS);
  const b = anthropicBody(cfg, sys, [user('mueve el WO-1'), { role: 'assistant', content: [{ input: { estatus: 'in_progress', numero: 'WO-1' }, name: 'cambiar_estatus', id: 'x', type: 'tool_use' }] }, { role: 'user', content: [{ content: '{"ok":true}', tool_use_id: 'x', type: 'tool_result' }] }, assistant('Listo'), user('gracias')], TOOLS);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.deepEqual(a.tools.map((t) => t.name), TOOLS.map((t) => t.name));
});

test('ventana de 30 mensajes: empieza en mensaje de usuario con texto y no rompe pares tool_use/tool_result', () => {
  const msgs = [];
  for (let t = 0; t < 14; t += 1) {
    msgs.push(user(t === 0 ? 'Voy a trabajar el WO-77' : `pregunta ${t}`));
    msgs.push(toolUse(`tu_${t}`, 'ver_boleto', { numero: `WO-${100 + t}` }));
    msgs.push(toolResult(`tu_${t}`, JSON.stringify({ ok: true, t })));
    msgs.push(assistant(`respuesta ${t}`));
  }
  msgs.push(user('y ahora?'));
  const out = slimHistory(msgs);
  assert.ok(out.length <= 30);
  assert.equal(out[0].role, 'user');
  assert.equal(out[0].content.some((b) => b.type === 'tool_result'), false);
  assert.ok(out[0].content[0].text.includes('Conversacion anterior recortada'));
  assert.ok(out[0].content[0].text.includes('Voy a trabajar el WO-77'));
  assert.ok(/WO-\d+/.test(out[0].content[0].text));
  assert.deepEqual(out[out.length - 1], msgs[msgs.length - 1]);
  for (let i = 0; i < out.length; i += 1) {
    for (const b of out[i].content) {
      if (b.type === 'tool_use') assert.ok(out[i + 1]?.content.some((r) => r.type === 'tool_result' && r.tool_use_id === b.id));
      if (b.type === 'tool_result') assert.ok(out[i - 1]?.content.some((u) => u.type === 'tool_use' && u.id === b.tool_use_id));
    }
  }
  const body = anthropicBody(baseConfig(), systemPrompt('T', 'Y'), msgs, TOOLS);
  assert.equal(body.messages.length, out.length);
  assert.ok(countMarks(body) <= 4);
  const short = [user('hola'), assistant('hola')];
  assert.deepEqual(slimHistory(short), short);
});

test('la ronda en curso queda completa aunque pase de 30 mensajes y el prefijo no cambia entre rondas', () => {
  const msgs = [];
  for (let t = 0; t < 6; t += 1) {
    msgs.push(user(`pregunta ${t}`));
    msgs.push(assistant(`respuesta ${t}`));
  }
  msgs.push(user('haz muchas cosas'));
  const rounds = [];
  for (let k = 0; k < 12; k += 1) {
    rounds.push(slimHistory(msgs));
    msgs.push(toolUse(`r${k}`, 'buscar_boletos', { k }));
    msgs.push(toolResult(`r${k}`, 'x'.repeat(4000)));
  }
  rounds.push(slimHistory(msgs));
  const final = rounds[rounds.length - 1];
  assert.equal(final.length, msgs.length);
  assert.equal(final[final.length - 1].content[0].content.length, 4000);
  for (let k = 1; k < rounds.length; k += 1) assert.deepEqual(rounds[k].slice(0, rounds[k - 1].length), rounds[k - 1]);
});

test('resultados de herramientas de turnos anteriores se recortan y los del turno actual no', () => {
  const big = JSON.stringify({ ok: true, boletos: Array.from({ length: 200 }, (_, i) => ({ numero: `WO-${i}`, cliente: 'Cliente de prueba' })) });
  assert.ok(big.length > 5000);
  const msgs = [
    user('busca boletos abiertos'),
    toolUse('t1', 'buscar_boletos'),
    toolResult('t1', big),
    assistant('Hay 200 boletos'),
    user('ahora el inventario'),
    toolUse('t2', 'buscar_inventario'),
    toolResult('t2', big),
  ];
  const body = anthropicBody(baseConfig(), systemPrompt('T', 'Y'), msgs, TOOLS);
  const oldResult = body.messages[2].content[0];
  const current = body.messages[6].content[0];
  assert.ok(oldResult.content.endsWith('[resultado recortado]'));
  assert.equal(oldResult.content.length, 1500 + ' ...[resultado recortado]'.length);
  assert.ok(oldResult.content.startsWith(big.slice(0, 1500)));
  assert.equal(current.content, big);
  assert.equal(msgs[2].content[0].content, big);
  const small = anthropicBody(baseConfig(), systemPrompt('T', 'Y'), [user('a'), toolUse('s', 'buscar_boletos'), toolResult('s', '{"ok":true}'), assistant('b'), user('c')], TOOLS);
  assert.equal(small.messages[2].content[0].content, '{"ok":true}');
});

test('fotos: solo los 2 turnos de usuario mas recientes llevan imagen; las viejas quedan como [foto enviada]', () => {
  const msgs = [
    user(`foto vieja ${photo('a')}`),
    assistant('Veo el equipo'),
    user(`otra ${photo('b')} y ${photo('c')}`),
    assistant('Ok'),
    user(`foto reciente ${photo('d')}`),
    assistant('Bien'),
    user(`ultima ${photo('e')}`),
  ];
  const body = anthropicBody(baseConfig(), systemPrompt('T', 'Y'), msgs, TOOLS);
  const images = (m) => m.content.filter((b) => b.type === 'image').map((b) => b.source.url);
  assert.deepEqual(images(body.messages[0]), []);
  assert.deepEqual(images(body.messages[2]), []);
  assert.deepEqual(images(body.messages[4]), [photo('d')]);
  assert.deepEqual(images(body.messages[6]), [photo('e')]);
  assert.ok(body.messages[0].content.some((b) => b.type === 'text' && b.text === '[foto enviada]'));
  assert.ok(body.messages[2].content.some((b) => b.type === 'text' && b.text === '[2 fotos enviadas]'));
  assert.ok(body.messages[0].content[0].text.includes(photo('a')));
  assert.equal(msgs[0].content.length, 1);
});

test('modo ahorro auto: al 80% usa haiku, avisa una vez al dia y respeta las tarjetas de confirmacion', async () => {
  const world = fakeWorld({
    config: baseConfig(),
    usage: { entrada: 1000, salida: 100, llamadas: 5, usd: 80 },
    replies: [{ content: [{ type: 'tool_use', id: 'pago_1', name: 'registrar_pago', input: { numero: 'WO-5', monto: 20, metodo: 'efectivo' } }], usage: { input_tokens: 1000, output_tokens: 50 } }],
  });
  const r = await withFetch(world, () => call('chat', { method: 'POST', body: { messages: [user('cobra 20 en efectivo del WO-5')] } }));
  assert.equal(r.status, 200);
  assert.equal(world.anthropic[0].model, 'claude-haiku-5-5');
  assert.equal(r.body.modo_ahorro.activo, true);
  assert.equal(r.body.modo_ahorro.modelo, 'claude-haiku-5-5');
  assert.ok(r.body.modo_ahorro.motivo.includes('80%'));
  assert.ok(r.body.aviso.startsWith('Modo ahorro'));
  assert.equal(r.body.pendientes.length, 1);
  assert.equal(r.body.pendientes[0].herramienta, 'registrar_pago');
  assert.equal(r.body.ejecutadas.length, 0);
  const saved = world.writes.find((w) => w.path === 'app_settings?id=eq.use');
  assert.equal(saved.body.payload.ahorro_avisado, prDayRange().day);
  assert.ok(Math.abs(saved.body.payload.usd - (80 + costUsd('claude-haiku-5-5', { entrada: 1000, salida: 50 }))) < 1e-6);

  const again = fakeWorld({ config: baseConfig(), usage: { usd: 85, ahorro_avisado: prDayRange().day }, replies: [anthropicText('Hola')] });
  const r2 = await withFetch(again, () => call('chat', { method: 'POST', body: { messages: [user('hola')] } }));
  assert.equal(again.anthropic[0].model, 'claude-haiku-5-5');
  assert.equal(r2.body.modo_ahorro.activo, true);
  assert.equal(r2.body.aviso, undefined);
});

test('modo ahorro: debajo de 80% no cambia, apagado nunca cambia, siempre usa haiku, al 100% sigue el 429', async () => {
  const below = fakeWorld({ config: baseConfig(), usage: { usd: 79 }, replies: [anthropicText('Hola')] });
  const a = await withFetch(below, () => call('chat', { method: 'POST', body: { messages: [user('hola')] } }));
  assert.equal(below.anthropic[0].model, 'claude-sonnet-5-5');
  assert.deepEqual(a.body.modo_ahorro, { activo: false });
  assert.equal(a.body.aviso, undefined);

  const off = fakeWorld({ config: baseConfig({ modo_ahorro: 'apagado' }), usage: { usd: 95 }, replies: [anthropicText('Hola')] });
  const b = await withFetch(off, () => call('chat', { method: 'POST', body: { messages: [user('hola')] } }));
  assert.equal(off.anthropic[0].model, 'claude-sonnet-5-5');
  assert.equal(b.body.modo_ahorro.activo, false);

  const always = fakeWorld({ config: baseConfig({ modo_ahorro: 'siempre', tope_usd_mes: 0, model: 'claude-opus-5-5' }), usage: null, replies: [anthropicText('Hola')] });
  const c = await withFetch(always, () => call('chat', { method: 'POST', body: { messages: [user('hola')] } }));
  assert.equal(always.anthropic[0].model, 'claude-haiku-5-5');
  assert.equal(c.body.modo_ahorro.activo, true);
  assert.equal(c.body.aviso, undefined);

  const noCap = fakeWorld({ config: baseConfig({ tope_usd_mes: 0 }), usage: { usd: 500 }, replies: [anthropicText('Hola')] });
  await withFetch(noCap, () => call('chat', { method: 'POST', body: { messages: [user('hola')] } }));
  assert.equal(noCap.anthropic[0].model, 'claude-sonnet-5-5');

  const tokens = fakeWorld({ config: baseConfig({ tope_usd_mes: 0, tope_tokens_mes: 1000 }), usage: { entrada: 850 }, replies: [anthropicText('Hola')] });
  await withFetch(tokens, () => call('chat', { method: 'POST', body: { messages: [user('hola')] } }));
  assert.equal(tokens.anthropic[0].model, 'claude-haiku-5-5');

  const full = fakeWorld({ config: baseConfig(), usage: { usd: 100 } });
  const d = await withFetch(full, () => call('chat', { method: 'POST', body: { messages: [user('hola')] } }));
  assert.equal(d.status, 429);
  assert.equal(d.body.code, 'usage_limit');
  assert.equal(full.anthropic.length, 0);
});

test('otros proveedores no cambian: sin cache_control, sin cambio de modelo y system igual', async () => {
  for (const cfg of [
    { provider: 'openai', model: 'gpt-4.1', base_url: '', tope_usd_mes: 100, tope_tokens_mes: 0, key_enc: encryptKey('sk-openai'), modo_ahorro: 'siempre' },
    { provider: 'openai_compatible', model: 'llama3', base_url: 'https://llm.test.invalid/v1', tope_usd_mes: 0, tope_tokens_mes: 1000, key_enc: null },
  ]) {
    const world = fakeWorld({ config: cfg, usage: { usd: 90, entrada: 900 } });
    const msgs = [user(`foto vieja ${photo('a')}`), assistant('ok'), user(`otra ${photo('b')}`), assistant('ok'), user(`ultima ${photo('c')}`)];
    const r = await withFetch(world, () => call('chat', { method: 'POST', body: { messages: msgs } }));
    assert.equal(r.status, 200);
    assert.equal(world.anthropic.length, 0);
    const sent = world.openai[0].body;
    assert.equal(sent.model, cfg.model);
    assert.equal(JSON.stringify(sent).includes('cache_control'), false);
    const sys = systemPrompt('Taller Prueba', 'Asistente IA - prueba');
    assert.equal(sent.messages[0].content, `${sys.variable}\n${sys.fijo}`);
    assert.ok(sent.messages[0].content.startsWith('Eres el Asistente IA de Taller Prueba'));
    const imageUrls = sent.messages.flatMap((m) => (Array.isArray(m.content) ? m.content.filter((b) => b.type === 'image_url').map((b) => b.image_url.url) : []));
    assert.deepEqual(imageUrls, [photo('a'), photo('b'), photo('c')]);
    assert.deepEqual(r.body.modo_ahorro, { activo: false });
  }
});

test('config: modo_ahorro se guarda, se conserva si no viene y se valida', async () => {
  const world = fakeWorld({ config: baseConfig({ modo_ahorro: 'apagado' }), usage: { usd: 3, usd_ahorrado_cache: 1.23456 } });
  const g = await withFetch(world, () => call('config'));
  assert.equal(g.status, 200);
  assert.equal(g.body.modo_ahorro, 'apagado');
  assert.equal(g.body.consumo.usd_ahorrado_cache, 1.2346);
  assert.equal(g.body.consumo.usd_usado, 3);

  const keep = await withFetch(world, () => call('config', { method: 'PUT', body: { provider: 'anthropic', model: 'claude-sonnet-5-5' } }));
  assert.equal(keep.status, 200);
  assert.equal(keep.body.modo_ahorro, 'apagado');
  assert.equal(world.writes.at(-1).body.payload.modo_ahorro, 'apagado');

  const set = await withFetch(world, () => call('config', { method: 'PUT', body: { provider: 'anthropic', model: 'claude-sonnet-5-5', modo_ahorro: 'siempre' } }));
  assert.equal(set.body.modo_ahorro, 'siempre');
  assert.equal(world.writes.at(-1).body.payload.modo_ahorro, 'siempre');

  const bad = await withFetch(world, () => call('config', { method: 'PUT', body: { provider: 'anthropic', model: 'claude-sonnet-5-5', modo_ahorro: 'turbo' } }));
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'invalid_body');

  const fresh = fakeWorld({ config: null });
  const g2 = await withFetch(fresh, () => call('config'));
  assert.equal(g2.body.modo_ahorro, 'auto');

  const noAuth = await withFetch(fresh, () => call('config', { token: '' }));
  assert.equal(noAuth.status, 401);
});

test('tarifas: cache de sonnet 5.5 y 5, haiku largo y ahorro de cache', () => {
  assert.ok(Math.abs(costUsd('claude-sonnet-5-5', { cache_lectura: 1_000_000 }) - 0.1) < 1e-9);
  assert.ok(Math.abs(costUsd('claude-sonnet-5', { cache_lectura: 1_000_000 }) - 0.2) < 1e-9);
  assert.ok(Math.abs(costUsd('claude-opus-5-5', { entrada: 1_000_000, cache_escritura: 1_000_000 }) - 9) < 1e-9);
  assert.ok(Math.abs(costUsd('claude-haiku-5-5', { entrada: 50_000, salida: 1000 }) - (0.005 + 0.0005)) < 1e-9);
  assert.ok(Math.abs(costUsd('claude-haiku-5-5', { entrada: 120_000 }) - 0.06) < 1e-9);
  assert.ok(Math.abs(cacheSavingsUsd('claude-sonnet-5-5', { cache_lectura: 1_000_000 }) - 1.9) < 1e-9);
  assert.ok(Math.abs(cacheSavingsUsd('claude-sonnet-5-5', { cache_escritura: 1_000_000 }) + 0.5) < 1e-9);
  assert.equal(costUsd('gpt-4.1', { entrada: 1000 }), 0);
  assert.equal(savingsMode({ provider: 'anthropic', model: 'claude-haiku-5-5' }, { porcentaje_usado: 95 }), null);
});
