import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import {
  validate, generate, loadTokens, contrast, parseHex, composite, pillColors,
  STATUS_KEYS, STATUS_GROUPS, COLOR_KEYS, TYPE_KEYS, THEMES
} from '../build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const clone = (o) => JSON.parse(JSON.stringify(o));
const tokens = loadTokens();

test('tokens.json pasa la validacion', () => {
  assert.equal(validate(tokens), true);
});

test('la validacion rechaza un hex invalido', () => {
  const t = clone(tokens);
  t.color.brand.light = '#ff5722';
  assert.throws(() => validate(t), /color\.brand\.light/);
});

test('la validacion rechaza un color faltante', () => {
  const t = clone(tokens);
  delete t.color.text1;
  assert.throws(() => validate(t), /color\.text1 falta/);
});

test('la validacion rechaza una escala de radios incompleta', () => {
  const t = clone(tokens);
  delete t.radius.sheet;
  assert.throws(() => validate(t), /radius\.sheet/);
});

test('la validacion rechaza menos de 16 estatus', () => {
  const t = clone(tokens);
  t.status.pop();
  assert.throws(() => validate(t), /16 entradas/);
});

test('la validacion rechaza destinos desconocidos', () => {
  const t = clone(tokens);
  t.status[0].to.push('inventado');
  assert.throws(() => validate(t), /clave desconocida/);
});

test('radios unificados 8, 12, 16, 22 y capsula', () => {
  assert.deepEqual(
    [tokens.radius.chip, tokens.radius.field, tokens.radius.card, tokens.radius.sheet, tokens.radius.pill],
    [8, 12, 16, 22, 999]
  );
});

test('marca y degradados coinciden con el diseno aprobado', () => {
  assert.equal(tokens.color.brand.light, '#FF5722');
  assert.equal(tokens.color.brand.dark, '#FF5722');
  assert.equal(tokens.color.gradStart.light, '#FF5721');
  assert.equal(tokens.color.gradEnd.light, '#E64A1A');
  assert.equal(tokens.color.gradStart.dark, '#FF6B38');
  assert.equal(tokens.color.gradEnd.dark, '#FF7333');
});

test('hay 16 estatus con las claves de la base de datos', () => {
  assert.equal(tokens.status.length, 16);
  assert.deepEqual(tokens.status.map((s) => s.key).sort(), [...STATUS_KEYS].sort());
});

test('cada estatus tiene todas las claves y tipos correctos', () => {
  for (const s of tokens.status) {
    for (const f of ['key', 'group', 'es', 'esLong', 'en', 'enLong']) {
      assert.equal(typeof s[f], 'string', `${s.key}.${f}`);
      assert.ok(s[f].length > 0, `${s.key}.${f} vacio`);
    }
    for (const f of ['email', 'emailPhotos', 'terminal', 'reopen']) assert.equal(typeof s[f], 'boolean', `${s.key}.${f}`);
    assert.ok(Number.isInteger(s.sort), `${s.key}.sort`);
    assert.ok(STATUS_GROUPS.includes(s.group), `${s.key}.group`);
    assert.ok(Array.isArray(s.to), `${s.key}.to`);
    for (const th of THEMES) assert.match(s.color[th], /^#[0-9A-F]{6}$/, `${s.key}.color.${th}`);
  }
});

test('los grupos suman 6 principal, 6 especiales y 4 cerrados', () => {
  const n = (g) => tokens.status.filter((s) => s.group === g).length;
  assert.deepEqual([n('main'), n('special'), n('closed')], [6, 6, 4]);
});

test('orden de estatus sin huecos ni repetidos', () => {
  assert.deepEqual(tokens.status.map((s) => s.sort).sort((a, b) => a - b), Array.from({ length: 16 }, (_, i) => i));
});

test('solo pending_order y reparacion_externa no mandan correo', () => {
  const noMail = tokens.status.filter((s) => !s.email).map((s) => s.key).sort();
  assert.deepEqual(noMail, ['pending_order', 'reparacion_externa']);
  assert.deepEqual(tokens.status.filter((s) => s.emailPhotos).map((s) => s.key), ['delivered']);
});

test('colores de estatus iguales a los de Android e iOS', () => {
  const expected = {
    intake: '#3B82F6', diagnosing: '#8B5CF6', waiting_customer: '#F43F5E', pending_order: '#B71C1C',
    waiting_parts: '#F97316', part_arrived_waiting_device: '#FACC15', reparacion_externa: '#EC4899',
    por_reparar: '#6366F2', in_progress: '#06B6D4', ready_for_pickup: '#10B981', scheduled: '#6B7280',
    warranty: '#F59E0B', delivered: '#059669', cancelled: '#DC2626', not_repairable: '#44403C', abandoned: '#800021'
  };
  for (const s of tokens.status) assert.equal(s.color.light, expected[s.key], s.key);
});

test('las transiciones solo apuntan a estatus existentes y coinciden con la regla comun', () => {
  const byKey = Object.fromEntries(tokens.status.map((s) => [s.key, s]));
  for (const s of tokens.status) for (const t of s.to) assert.ok(byKey[t], `${s.key} -> ${t}`);
  for (const k of tokens.transitions.reopenTo) assert.ok(byKey[k]);
  assert.ok(!tokens.status.some((s) => s.group !== 'closed' && s.key !== 'warranty' && s.to.includes('warranty')));
  assert.deepEqual(byKey.warranty.to, ['in_progress']);
  assert.deepEqual(byKey.delivered.to, ['warranty']);
  for (const k of ['cancelled', 'not_repairable', 'abandoned']) {
    assert.deepEqual(byKey[k].to, []);
    assert.equal(byKey[k].reopen, true);
  }
});

test('los pares de texto cumplen el contraste minimo en claro y oscuro', () => {
  for (const [group, spec] of Object.entries(tokens.contrast)) {
    for (const th of THEMES) {
      for (const [fg, bg] of spec.pairs) {
        const bgc = composite(tokens.color[bg][th], '#000000');
        const fgc = composite(tokens.color[fg][th], bgc);
        const ratio = contrast(fgc, bgc);
        assert.ok(ratio >= spec.min, `${group} ${th} ${fg} sobre ${bg}: ${ratio.toFixed(2)} < ${spec.min}`);
      }
    }
  }
});

test('el texto de la pastilla de cada estatus cumple 4.5:1 en ambos temas', () => {
  const surfaces = ['bg', 'surface1', 'surface2'];
  for (const s of tokens.status) {
    for (const th of THEMES) {
      for (const surf of surfaces) {
        const t2 = clone(tokens);
        t2.color.surface1[th] = tokens.color[surf][th];
        const { text, bg } = pillColors(t2, s.key, th);
        const ratio = contrast(text, bg);
        assert.ok(ratio >= 4.5, `${s.key} ${th} sobre ${surf}: ${ratio.toFixed(2)}`);
      }
    }
  }
});

test('la generacion produce los cuatro archivos no vacios', () => {
  const files = generate(tokens);
  assert.deepEqual(Object.keys(files).sort(), ['ReparaTokens.kt', 'ReparaTokens.swift', 'repara-tokens.css', 'tailwind-preset.cjs']);
  for (const c of Object.values(files)) assert.ok(c.length > 500);
});

test('la generacion no escribe comentarios', () => {
  const files = generate(tokens);
  assert.ok(!/\/\/|\/\*/.test(files['ReparaTokens.swift'].replace(/https?:\/\/\S+/g, '')));
  assert.ok(!/\/\/|\/\*/.test(files['ReparaTokens.kt']));
  assert.ok(!/\/\*/.test(files['repara-tokens.css']));
});

test('cada color y cada estatus aparece en los tres formatos', () => {
  const files = generate(tokens);
  for (const k of COLOR_KEYS) {
    assert.match(files['ReparaTokens.swift'], new RegExp(`static let ${k} = `));
    assert.match(files['ReparaTokens.kt'], new RegExp(`val ${k} = ReparaColor`));
    assert.ok(files['repara-tokens.css'].includes(`--repara-${k.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}:`), k);
  }
  for (const k of STATUS_KEYS) {
    assert.ok(files['ReparaTokens.swift'].includes(`"${k}"`));
    assert.ok(files['ReparaTokens.kt'].includes(`"${k}"`));
    assert.ok(files['repara-tokens.css'].includes(`--repara-status-${k.replace(/_/g, '-')}:`));
  }
  for (const k of TYPE_KEYS) assert.ok(files['ReparaTokens.swift'].includes(`static let ${k} = ReparaTextStyle`));
});

test('el CSS trae modo oscuro por preferencia y por atributo', () => {
  const css = generate(tokens)['repara-tokens.css'];
  assert.ok(css.includes('@media (prefers-color-scheme: dark)'));
  assert.ok(css.includes(':root[data-theme="dark"]'));
  assert.ok(css.includes(':root:not([data-theme="light"])'));
});

test('el preset de Tailwind carga y expone los colores', () => {
  const dir = mkdtempSync(join(tmpdir(), 'repara-'));
  const r = spawnSync(process.execPath, [join(ROOT, 'build.mjs'), '--out-web', dir]);
  assert.equal(r.status, 0, String(r.stderr));
  const preset = createRequire(import.meta.url)(join(dir, 'tailwind.repara.cjs'));
  assert.equal(preset.theme.extend.colors.repara.brand, 'var(--repara-brand)');
  assert.equal(preset.theme.extend.colors.repara.status['waiting-parts'], 'var(--repara-status-waiting-parts)');
  assert.equal(preset.theme.extend.borderRadius['repara-sheet'], 'var(--repara-radius-sheet)');
  assert.deepEqual(readdirSync(dir).sort(), ['repara-tokens.css', 'tailwind.repara.cjs']);
});

test('la generacion es determinista: dos corridas dan lo mismo', () => {
  const a = generate(loadTokens());
  const b = generate(loadTokens());
  assert.deepEqual(a, b);
  const c = generate(clone(tokens));
  assert.deepEqual(a, c);
});

test('dos ejecuciones del comando escriben archivos identicos y dist esta al dia', () => {
  const d1 = mkdtempSync(join(tmpdir(), 'repara-a-'));
  const d2 = mkdtempSync(join(tmpdir(), 'repara-b-'));
  for (const d of [d1, d2]) {
    const r = spawnSync(process.execPath, [join(ROOT, 'build.mjs'), '--out-ios', d, '--out-android', d, '--out-web', d]);
    assert.equal(r.status, 0, String(r.stderr));
  }
  for (const f of readdirSync(d1)) assert.equal(readFileSync(join(d1, f), 'utf8'), readFileSync(join(d2, f), 'utf8'), f);
  const chk = spawnSync(process.execPath, [join(ROOT, 'build.mjs'), '--check', '--out-ios', d1, '--out-android', d1, '--out-web', d1]);
  assert.equal(chk.status, 0, String(chk.stderr));
});

test('--check falla cuando un destino se quedo atras', () => {
  const d = mkdtempSync(join(tmpdir(), 'repara-c-'));
  const chk = spawnSync(process.execPath, [join(ROOT, 'build.mjs'), '--check', '--out-ios', d]);
  assert.equal(chk.status, 1);
});
