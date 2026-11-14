import test from 'node:test';
import assert from 'node:assert/strict';
import { priceQuote, buildQuoteOptions, laborFor, DEFAULT_TIPOS } from '../api/_lib/quotePricing.js';

test('bateria A2389 de PhoneLCDParts: (46.49 + 125) x 1.115 y deposito de la mitad', () => {
  const p = priceQuote({ costo: 46.49, manoObra: 125 });
  assert.deepEqual(p, { subtotal_sin_ivu: 171.49, ivu: 19.72, total_con_ivu: 191.21, deposito: 95.61 });
});

test('Genuine OEM de MobileSentrix: (135.59 + 125) x 1.115', () => {
  const p = priceQuote({ costo: 135.59, manoObra: 125 });
  assert.equal(p.total_con_ivu, 290.56);
  assert.equal(p.deposito, 145.28);
});

test('el deposito nunca baja del costo de la pieza', () => {
  const p = priceQuote({ costo: 200, manoObra: 20 });
  assert.equal(p.total_con_ivu, 245.3);
  assert.equal(p.deposito, 200);
});

test('manejo de bateria por DHL suma 25 antes del IVU', () => {
  const [o] = buildQuoteOptions([{ proveedor: 'PhoneLCDParts', nombre: 'Bateria A2389', precio: 46.49 }], { manoObra: 125, bateriaDhl: true });
  assert.equal(o.manejo_bateria, 25);
  assert.equal(o.total_con_ivu, 219.09);
});

test('valores invalidos no producen precio', () => {
  assert.equal(priceQuote({ costo: -1, manoObra: 125 }), null);
  assert.equal(priceQuote({ costo: 'x', manoObra: 125 }), null);
  assert.deepEqual(buildQuoteOptions([{ precio: 0 }, { precio: null }, { precio: 'abc' }], { manoObra: 50 }), []);
});

test('las opciones salen ordenadas por precio al cliente y conservan proveedor, existencia y enlace', () => {
  const opts = buildQuoteOptions([
    { proveedor: 'MobileSentrix', nombre: 'Genuine OEM', precio: 135.59, existencia: 'disponible', url: 'https://ms.test/a', visto_hace_dias: 1, desactualizado: false, total_con_envio: 140.59 },
    { proveedor: 'PhoneLCDParts', nombre: 'Aftermarket', precio: 46.49, existencia: 'disponible', url: 'https://plp.test/b', visto_hace_dias: 40, desactualizado: true, total_con_envio: null },
  ], { manoObra: 125 });
  assert.deepEqual(opts.map((o) => o.proveedor), ['PhoneLCDParts', 'MobileSentrix']);
  assert.equal(opts[0].desactualizado, true);
  assert.equal(opts[0].envio, null);
  assert.equal(opts[1].envio, 5);
  assert.equal(opts[1].url, 'https://ms.test/a');
});

test('mano de obra por tipo de equipo con palabras clave y sin inventar tipos sin monto', () => {
  assert.deepEqual(laborFor('MacBook Air M1 bateria'), { clave: 'macbook', nombre: 'Laptop y MacBook', monto: 125 });
  assert.equal(laborFor('MacBook Pro 2015 pantalla').monto, 85);
  assert.equal(laborFor('iPad 9 pantalla').monto, 75);
  assert.equal(laborFor('Galaxy Z Flip 6').monto, 100);
  assert.equal(laborFor('iPhone 14 pantalla'), null);
  assert.equal(laborFor('iPhone 14 bateria'), null);
});

test('un tipo con monto definido y palabras con + exige todas las palabras', () => {
  const tipos = [...DEFAULT_TIPOS.map((t) => (t.clave === 'pantalla_iphone' ? { ...t, monto: 60 } : t))];
  assert.equal(laborFor('iPhone 14 pantalla', tipos).monto, 60);
  assert.equal(laborFor('Samsung pantalla', tipos), null);
  assert.equal(laborFor('PANTALLA de iPhone 15 Pro', tipos).clave, 'pantalla_iphone');
});

test('el deposito y el manejo salen de las reglas configuradas', () => {
  const p = priceQuote({ costo: 46.49, manoObra: 125, depositPct: 30 });
  assert.equal(p.total_con_ivu, 191.21);
  assert.equal(p.deposito, 57.36);
  const [o] = buildQuoteOptions([{ proveedor: 'x', nombre: 'y', precio: 46.49 }], { manoObra: 125, bateriaDhl: true, dhlHandling: 30, depositPct: 50 });
  assert.equal(o.manejo_bateria, 30);
});
