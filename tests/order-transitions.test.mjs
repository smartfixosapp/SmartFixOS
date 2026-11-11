import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as t from '../api/_lib/orderTransitions.js';

const tokens = JSON.parse(readFileSync(fileURLToPath(new URL('../packages/repara-tokens/tokens.json', import.meta.url)), 'utf8'));
const sqlText = readFileSync(fileURLToPath(new URL('../supabase/boletos-update-order-status.sql', import.meta.url)), 'utf8');
const NOW = Date.parse('2026-11-11T15:00:00Z');

test('las 16 claves coinciden con tokens.json en el mismo orden', () => {
  const keys = [...tokens.status].sort((a, b) => a.sort - b.sort).map((s) => s.key);
  assert.equal(t.STATUS_KEYS.length, 16);
  assert.deepEqual([...t.STATUS_KEYS].sort(), [...keys].sort());
});

test('los destinos de cada estatus coinciden con el campo to de tokens.json', () => {
  for (const s of tokens.status) {
    assert.deepEqual([...t.targetsFrom(s.key)].sort(), [...s.to].sort(), s.key);
  }
});

test('flujos obligatorios, reabrir y cerrados coinciden con tokens.json', () => {
  assert.deepEqual(t.VIA, tokens.transitions.via);
  assert.deepEqual([...t.REOPEN_TO].sort(), [...tokens.transitions.reopenTo].sort());
  assert.deepEqual([...t.REOPENABLE].sort(), tokens.status.filter((s) => s.reopen).map((s) => s.key).sort());
});

test('el SQL de update_order_status_v2 usa las mismas listas que la regla en JS', () => {
  const list = (name) => {
    const m = new RegExp(`${name}\\s+constant\\s+text\\[\\]\\s*:=\\s*array\\[([^\\]]*)\\]`, 'i').exec(sqlText);
    assert.ok(m, `falta ${name} en el SQL`);
    return m[1].split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
  };
  assert.deepEqual(list('v_keys').sort(), [...t.STATUS_KEYS].sort());
  assert.deepEqual(list('v_open').sort(), [...t.OPEN].sort());
  assert.deepEqual(list('v_reopen_to').sort(), [...t.REOPEN_TO].sort());
  assert.deepEqual(list('v_closed').sort(), [...t.CLOSED].sort());
  assert.match(sqlText, /security invoker/i);
  assert.doesNotMatch(sqlText, /security definer/i);
  assert.doesNotMatch(sqlText, /\bdelete\s+from\b|\bdrop\s+(table|column|function)\b|\btruncate\b/i);
  assert.match(sqlText, /function public\.update_order_status_v2\(/);
  assert.doesNotMatch(sqlText, /function public\.update_order_status\(/);
});

test('rechaza claves fuera de las 16, incluida completed', () => {
  for (const bad of ['completed', 'picked_up', 'ready', '', null, 'INTAKE']) {
    assert.equal(t.checkTransition({ from: 'intake', to: bad }).code, 'estatus_invalido', String(bad));
  }
});

test('mismo estatus es idempotente y no cambia nada', () => {
  assert.deepEqual(t.checkTransition({ from: 'in_progress', to: 'in_progress' }), { ok: true, code: 'sin_cambio', changed: false });
});

test('activo y en espera pasan directo entre si, menos agendado y garantia', () => {
  assert.equal(t.checkTransition({ from: 'intake', to: 'diagnosing' }).ok, true);
  assert.equal(t.checkTransition({ from: 'waiting_customer', to: 'ready_for_pickup' }).ok, true);
  assert.equal(t.checkTransition({ from: 'scheduled', to: 'in_progress' }).ok, true);
  assert.deepEqual(t.checkTransition({ from: 'intake', to: 'scheduled' }), { ok: false, code: 'requiere_flujo', via_requerida: 'agendar' });
  assert.equal(t.checkTransition({ from: 'intake', to: 'scheduled', via: 'agendar' }).ok, true);
  assert.equal(t.checkTransition({ from: 'in_progress', to: 'warranty', via: 'reclamo', note: 'volvio a fallar' }).code, 'transicion_no_permitida');
});

test('entregado solo por Entrega y los cierres solo por Cierre con motivo', () => {
  assert.equal(t.checkTransition({ from: 'ready_for_pickup', to: 'delivered' }).via_requerida, 'entrega');
  assert.equal(t.checkTransition({ from: 'ready_for_pickup', to: 'delivered', via: 'entrega' }).ok, true);
  assert.equal(t.checkTransition({ from: 'diagnosing', to: 'cancelled' }).via_requerida, 'cierre');
  assert.equal(t.checkTransition({ from: 'diagnosing', to: 'cancelled', via: 'cierre' }).code, 'nota_requerida');
  assert.equal(t.checkTransition({ from: 'diagnosing', to: 'not_repairable', via: 'cierre', note: 'no hay pieza' }).ok, true);
  assert.equal(t.checkTransition({ from: 'warranty', to: 'delivered', via: 'entrega' }).code, 'transicion_no_permitida');
});

test('garantia solo desde entregado por reclamo y vuelve a reparacion', () => {
  assert.equal(t.checkTransition({ from: 'delivered', to: 'warranty', via: 'reclamo', note: 'mismo problema' }).ok, true);
  assert.equal(t.checkTransition({ from: 'warranty', to: 'in_progress' }).ok, true);
  assert.equal(t.checkTransition({ from: 'warranty', to: 'diagnosing' }).code, 'transicion_no_permitida');
});

test('para salir de un cerrado hay que reabrir con motivo y suma reapertura', () => {
  assert.deepEqual(t.checkTransition({ from: 'cancelled', to: 'diagnosing' }), { ok: false, code: 'requiere_flujo', via_requerida: 'reabrir' });
  assert.equal(t.checkTransition({ from: 'delivered', to: 'in_progress' }).via_requerida, 'reabrir');
  assert.equal(t.checkTransition({ from: 'delivered', to: 'in_progress', via: 'reabrir' }).code, 'nota_requerida');
  assert.deepEqual(t.checkTransition({ from: 'delivered', to: 'in_progress', via: 'reabrir', note: 'retrabajo' }), { ok: true, code: 'ok', changed: true, reopen: true });
  assert.equal(t.checkTransition({ from: 'abandoned', to: 'scheduled', via: 'reabrir', note: 'volvio el cliente' }).code, 'destino_reabrir_invalido');
  assert.equal(t.checkTransition({ from: 'in_progress', to: 'intake', via: 'reabrir', note: 'x y z' }).code, 'no_esta_cerrado');
  assert.equal(t.checkTransition({ from: 'warranty', to: 'in_progress', via: 'reabrir', note: 'x y z' }).code, 'no_esta_cerrado');
});

test('claves viejas como completed solo salen por reabrir', () => {
  assert.equal(t.checkTransition({ from: 'completed', to: 'in_progress' }).via_requerida, 'reabrir');
  assert.equal(t.checkTransition({ from: 'picked_up', to: 'in_progress', via: 'reabrir', note: 'retrabajo' }).ok, true);
});

test('deshacer vuelve al estatus anterior dentro de la ventana', () => {
  const at = new Date(NOW - 5_000).toISOString();
  assert.equal(t.checkTransition({ from: 'delivered', to: 'ready_for_pickup', via: 'deshacer', previous: 'ready_for_pickup', lastChangedAt: at, now: NOW }).ok, true);
  assert.equal(t.checkTransition({ from: 'delivered', to: 'intake', via: 'deshacer', previous: 'ready_for_pickup', lastChangedAt: at, now: NOW }).code, 'deshacer_no_coincide');
  const old = new Date(NOW - t.UNDO_WINDOW_MS - 1).toISOString();
  assert.equal(t.checkTransition({ from: 'delivered', to: 'ready_for_pickup', via: 'deshacer', previous: 'ready_for_pickup', lastChangedAt: old, now: NOW }).code, 'deshacer_vencido');
});

test('via desconocida se rechaza', () => {
  assert.equal(t.checkTransition({ from: 'intake', to: 'diagnosing', via: 'magia' }).code, 'via_invalida');
});
