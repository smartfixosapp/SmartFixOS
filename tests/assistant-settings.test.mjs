import test from 'node:test';
import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'https://sb.test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.ASSISTANT_KEY_SECRET = 'k'.repeat(40);

const { normalizePricingRules, loadPricingRules, savePricingRules, saveInstructions, loadInstructions, saveSuppliers, publicConnections, searchSupplier } = await import('../api/_lib/connections.js');
const { availableTools } = await import('../api/_lib/assistant.js');
const TENANT = 'aaaaaaaa-0000-4000-8000-000000000001';
const realFetch = globalThis.fetch;

function fakeSettings(store = {}) {
  globalThis.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    const table = u.pathname.replace('/rest/v1/', '');
    assert.equal(table, 'app_settings');
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    const json = (d, st = 200) => new Response(JSON.stringify(d), { status: st, headers: { 'content-type': 'application/json' } });
    if (method === 'GET') {
      const slug = /slug=eq\.([^&]+)/.exec(u.search)?.[1];
      const row = store[decodeURIComponent(slug)];
      return json(row ? [{ id: slug, payload: row }] : []);
    }
    if (method === 'POST') { store[body.slug] = body.payload; return json([], 201); }
    if (method === 'PATCH') {
      const id = /id=eq\.([^&]+)/.exec(u.search)?.[1];
      store[decodeURIComponent(id)] = body.payload;
      return json([]);
    }
    throw new Error(`metodo no soportado ${method}`);
  };
  return store;
}
test.afterEach(() => { globalThis.fetch = realFetch; });

test('reglas de precio: sin guardar devuelven los valores por defecto', async () => {
  fakeSettings();
  const r = await loadPricingRules(TENANT);
  assert.equal(r.deposito_pct, 50);
  assert.equal(r.manejo_dhl, 25);
  assert.equal(r.tipos.find((t) => t.clave === 'macbook').monto, 125);
  assert.equal(r.tipos.find((t) => t.clave === 'pantalla_iphone').monto, null);
});

test('reglas de precio: guardar y volver a leer conserva montos, palabras y tipos nuevos', async () => {
  const store = fakeSettings();
  const saved = await savePricingRules(TENANT, {
    deposito_pct: 40,
    manejo_dhl: 20,
    tipos: [
      { nombre: 'Pantalla iPhone', monto: 60, palabras: ['iPhone+Pantalla'] },
      { nombre: 'Consola', monto: '90', palabras: ['ps5', 'xbox'] },
      { nombre: 'Pantalla iPhone', monto: 61, palabras: [] },
    ],
  });
  assert.equal(saved.ok, true);
  assert.deepEqual(saved.rules.tipos.map((t) => [t.clave, t.monto]), [['pantalla_iphone', 60], ['consola', 90], ['pantalla_iphone_2', 61]]);
  assert.deepEqual(saved.rules.tipos[0].palabras, ['iphone+pantalla']);
  assert.ok(store[`ai-pricing-rules-${TENANT}`]);
  const back = await loadPricingRules(TENANT);
  assert.equal(back.deposito_pct, 40);
  assert.equal(back.manejo_dhl, 20);
  assert.equal(back.tipos.length, 3);
});

test('reglas de precio: montos y porcentajes fuera de rango se rechazan sin guardar', async () => {
  const store = fakeSettings();
  for (const bad of [{ tipos: [{ nombre: 'x', monto: -1 }] }, { tipos: [{ nombre: 'x', monto: 99999 }] }, { deposito_pct: 101 }, { manejo_dhl: 501 }, { tipos: [{ nombre: 'x', monto: 'abc' }] }]) {
    const r = await savePricingRules(TENANT, bad);
    assert.ok(r.error, JSON.stringify(bad));
  }
  assert.equal(Object.keys(store).length, 0);
  assert.equal(normalizePricingRules({ tipos: [{ nombre: '', monto: 5 }] }).rules.tipos.length, 0);
});

test('instrucciones del taller: se guardan limpias, se leen y tienen tope', async () => {
  fakeSettings();
  assert.equal(await loadInstructions(TENANT), '');
  const ok = await saveInstructions(TENANT, '  Mira primero la lista de precios.  ');
  assert.equal(ok.texto, 'Mira primero la lista de precios.');
  assert.equal(await loadInstructions(TENANT), 'Mira primero la lista de precios.');
  assert.ok((await saveInstructions(TENANT, 'x'.repeat(8001))).error);
  assert.ok((await saveInstructions(TENANT, 123)).error);
});

test('suplidores: activo por defecto, se puede pausar y un suplidor pausado no se busca ni ofrece su herramienta', async () => {
  fakeSettings();
  const first = await saveSuppliers(TENANT, [{ nombre: 'MobileSentrix', url: 'https://www.mobilesentrix.com' }, { nombre: 'PhoneLCDParts', url: 'https://www.phonelcdparts.com' }]);
  assert.equal(first.ok, true);
  let pub = publicConnections(await (await import('../api/_lib/connections.js')).loadConnections(TENANT), 'https://x.test');
  assert.deepEqual(pub.proveedores.map((p) => p.activo), [true, true]);
  const ids = pub.proveedores.map((p) => p.id);
  await saveSuppliers(TENANT, [{ id: ids[0], nombre: 'MobileSentrix', url: 'https://www.mobilesentrix.com', activo: false }, { id: ids[1], nombre: 'PhoneLCDParts', url: 'https://www.phonelcdparts.com' }]);
  pub = publicConnections(await (await import('../api/_lib/connections.js')).loadConnections(TENANT), 'https://x.test');
  assert.deepEqual(pub.proveedores.map((p) => p.activo), [false, true]);
  const r = await searchSupplier(TENANT, { proveedor: 'MobileSentrix', consulta: 'A2389' });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /desactivado/);
});

test('herramientas: sin suplidores activos ni eBay activo no se ofrece la busqueda', () => {
  const names = (conn) => availableTools(conn).map((t) => t.name);
  const inactive = { proveedores: [{ nombre: 'MS', url: 'https://www.mobilesentrix.com', activo: false }], ebay: { secret_enc: 'x', activo: false } };
  assert.equal(names(inactive).includes('proveedor_buscar_precio'), false);
  assert.equal(names(inactive).includes('ebay_buscar'), false);
  const active = { proveedores: [{ nombre: 'PLP', url: 'https://www.phonelcdparts.com' }], ebay: { secret_enc: 'x' } };
  assert.equal(names(active).includes('proveedor_buscar_precio'), true);
  assert.equal(names(active).includes('ebay_buscar'), true);
  assert.equal(names(active).includes('cotizar_pieza'), true);
});
