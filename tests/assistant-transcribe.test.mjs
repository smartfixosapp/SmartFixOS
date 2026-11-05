import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://sb.test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.MUSE_TENANT_ID = '11111111-2222-4333-8444-555555555555';
process.env.GEMINI_API_KEY = 'gemini-test';

const { transcribeAudio, transcribePrompt } = await import('../api/_lib/assistant.js');

function fakeGemini(text = 'abre el WO-417') {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url: String(url), body: JSON.parse(opts.body) });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  };
  return { calls, fetchImpl };
}

test('transcribe acepta aac y envia el tipo correcto', async () => {
  const g = fakeGemini();
  const r = await transcribeAudio({ audioBase64: 'AAAA', mimeType: 'audio/aac' }, g.fetchImpl);
  assert.equal(r.status, 200);
  assert.equal(r.body.texto, 'abre el WO-417');
  assert.equal(g.calls[0].body.contents[0].parts[1].inline_data.mime_type, 'audio/aac');
});

test('transcribe con tipo desconocido usa wav', async () => {
  const g = fakeGemini();
  await transcribeAudio({ audioBase64: 'AAAA', mimeType: 'text/html' }, g.fetchImpl);
  assert.equal(g.calls[0].body.contents[0].parts[1].inline_data.mime_type, 'audio/wav');
});

test('transcribe agrega pista del campo y vocabulario limpio y acotado', async () => {
  const g = fakeGemini('787-555-1234');
  const vocab = ['Moto G', 'batería', 'Moto G', '"<script>"', 'x'.repeat(80), ...Array.from({ length: 100 }, (_, i) => `t${i}`)];
  await transcribeAudio({ audioBase64: 'AAAA', mimeType: 'audio/wav', campo: 'telefono', vocabulario: vocab }, g.fetchImpl);
  const prompt = g.calls[0].body.contents[0].parts[0].text;
  assert.match(prompt, /numero de telefono de Puerto Rico/);
  assert.match(prompt, /Vocabulario frecuente/);
  assert.match(prompt, /Moto G, batería/);
  assert.equal(prompt.includes('<script>'), false);
  assert.equal(prompt.includes('x'.repeat(41)), false);
  assert.equal(prompt.includes('t99'), false);
});

test('sin campo ni vocabulario el prompt sigue igual de base', () => {
  const p = transcribePrompt(undefined, undefined);
  assert.match(p, /Transcribe literalmente/);
  assert.equal(p.includes('Vocabulario'), false);
  assert.equal(transcribePrompt('desconocido', 'no-lista'), p);
});
