import test from 'node:test';
import assert from 'node:assert/strict';

const TENANT = '11111111-2222-4333-8444-555555555555';
process.env.SUPABASE_URL = 'https://sb.test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.MUSE_TENANT_ID = TENANT;
process.env.JAIME_TENANT_ID = TENANT;
process.env.ASSISTANT_KEY_SECRET = 'k'.repeat(40);
process.env.JAIME_API_TOKEN = 's'.repeat(40);

const realFetch = globalThis.fetch;
const { TOOLS } = await import('../api/_lib/assistant.js');
const tool = TOOLS.find((t) => t.name === 'cotizar_pieza');

function withRows(rows, fn) {
  globalThis.fetch = async (url) => {
    if (!String(url).startsWith('https://sb.test.invalid')) throw new Error('red real bloqueada');
    return new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return fn().finally(() => { globalThis.fetch = realFetch; });
}

const ROWS = [
  { supplier: 'PhoneLCDParts', name: 'Battery MacBook Air A2389', sku: 'A2389', price: 46.49, prev_price: null, shipping: null, stock: 'disponible', url: 'https://plp.test/a2389', seen_at: new Date().toISOString() },
  { supplier: 'MobileSentrix', name: 'Genuine OEM Battery A2389', sku: 'A2389-OEM', price: 135.59, prev_price: null, shipping: 5, stock: 'disponible', url: 'https://ms.test/a2389', seen_at: new Date().toISOString() },
];

test('la herramienta cotizar_pieza existe, es de solo lectura y no escribe', () => {
  assert.ok(tool);
  assert.equal(tool.mutating, false);
  assert.equal(typeof tool.local, 'function');
});

test('cotiza con la mano de obra de MacBook y devuelve las opciones ordenadas', async () => {
  const r = await withRows(ROWS, () => tool.local({ consulta: 'MacBook Air A2389 bateria', tipo_equipo: 'macbook' }, { tenantId: TENANT }));
  assert.equal(r.status, 200);
  assert.equal(r.body.mano_obra, 125);
  assert.deepEqual(r.body.opciones.map((o) => [o.proveedor, o.total_con_ivu, o.deposito]), [['PhoneLCDParts', 191.21, 95.61], ['MobileSentrix', 290.56, 145.28]]);
});

test('sin mano de obra conocida pide el dato y no inventa precios', async () => {
  const r = await withRows(ROWS, () => tool.local({ consulta: 'iPhone 14 pantalla' }, { tenantId: TENANT }));
  assert.equal(r.status, 200);
  assert.equal(r.body.requiere_mano_obra, true);
  assert.equal(r.body.opciones, undefined);
});

test('una mano de obra explicita manda sobre la tabla', async () => {
  const r = await withRows(ROWS, () => tool.local({ consulta: 'MacBook Air A2389 bateria', mano_obra: 100 }, { tenantId: TENANT }));
  assert.equal(r.body.mano_obra, 100);
  assert.equal(r.body.opciones[0].total_con_ivu, Math.round((46.49 + 100) * 1.115 * 100) / 100);
});

test('bateria por DHL suma el manejo en la herramienta', async () => {
  const r = await withRows(ROWS, () => tool.local({ consulta: 'MacBook Air A2389 bateria', tipo_equipo: 'macbook', bateria_dhl: true }, { tenantId: TENANT }));
  assert.equal(r.body.opciones[0].manejo_bateria, 25);
  assert.equal(r.body.opciones[0].total_con_ivu, 219.09);
});

const { noteQuote, runAgent } = await import('../api/_lib/assistant.js');

test('noteQuote guarda solo cotizaciones con opciones, recorta campos y descarta enlaces no https', () => {
  const quotes = [];
  noteQuote(quotes, { id: 't1', name: 'ver_boleto' }, { ok: true, opciones: [{ proveedor: 'x' }] });
  noteQuote(quotes, { id: 't2', name: 'cotizar_pieza' }, { ok: true, opciones: [] });
  noteQuote(quotes, { id: 't3', name: 'cotizar_pieza' }, { ok: false });
  assert.equal(quotes.length, 0);
  noteQuote(quotes, { id: 't4', name: 'cotizar_pieza', input: { consulta: 'bateria' } }, {
    ok: true,
    mano_obra: 125,
    opciones: [
      { proveedor: 'PLP', nombre: 'Bateria', sku: 'A2389', costo: 46.49, url: 'javascript:alert(1)', total_con_ivu: 191.21, deposito: 95.61, extra_interno: 'no sale' },
      { proveedor: 'MS', nombre: 'OEM', costo: 135.59, url: 'https://ms.test/a', total_con_ivu: 290.56, deposito: 145.28 },
    ],
  });
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].id, 't4');
  assert.equal(quotes[0].consulta, 'bateria');
  assert.equal(quotes[0].opciones[0].url, null);
  assert.equal(quotes[0].opciones[1].url, 'https://ms.test/a');
  assert.equal('extra_interno' in quotes[0].opciones[0], false);
});

test('runAgent devuelve las cotizaciones junto con los mensajes cuando el modelo usa cotizar_pieza', async () => {
  let call = 0;
  const provider = async () => {
    call += 1;
    if (call === 1) return { blocks: [{ type: 'tool_use', id: 'tu-1', name: 'cotizar_pieza', input: { consulta: 'MacBook Air A2389 bateria', tipo_equipo: 'macbook' } }], usage: {} };
    return { blocks: [{ type: 'text', text: 'Encontre 2 opciones.' }], usage: {} };
  };
  const out = await withRows(ROWS, () => runAgent({
    config: { provider: 'anthropic', model: 'm' },
    apiKey: 'k',
    messages: [{ role: 'user', content: [{ type: 'text', text: 'cotiza la bateria' }] }],
    decisions: [],
    actor: 'test',
    shopName: 'Taller',
    deps: { provider, callApi: async () => ({ status: 200, body: {} }) },
  }));
  assert.equal(out.cotizaciones.length, 1);
  assert.equal(out.cotizaciones[0].opciones.length, 2);
  assert.equal(out.cotizaciones[0].opciones[0].total_con_ivu, 191.21);
  assert.equal(out.pending.length, 0);
});
