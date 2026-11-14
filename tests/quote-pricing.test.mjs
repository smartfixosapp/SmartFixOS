import test from 'node:test';
import assert from 'node:assert/strict';
import { priceQuote, buildQuoteOptions, laborFor } from '../api/_lib/quotePricing.js';

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

test('mano de obra por tipo de equipo con alias y sin inventar tipos desconocidos', () => {
  assert.deepEqual(laborFor('MacBook Air M1 bateria'), { clave: 'macbook', monto: 125 });
  assert.deepEqual(laborFor('MacBook Pro 2015 pantalla'), { clave: 'macbook_viejo', monto: 85 });
  assert.deepEqual(laborFor('iPad 9 pantalla'), { clave: 'ipad', monto: 75 });
  assert.deepEqual(laborFor('Galaxy Z Flip 6'), { clave: 'plegable', monto: 100 });
  assert.equal(laborFor('iPhone 14 pantalla'), null);
  assert.deepEqual(laborFor('iPhone 14 pantalla', { iphone: 99 }), null);
});
