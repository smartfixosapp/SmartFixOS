#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const STATUS_KEYS = [
  'intake', 'diagnosing', 'waiting_parts', 'por_reparar', 'in_progress', 'ready_for_pickup',
  'waiting_customer', 'pending_order', 'part_arrived_waiting_device', 'reparacion_externa', 'scheduled', 'warranty',
  'delivered', 'cancelled', 'not_repairable', 'abandoned'
];
export const STATUS_GROUPS = ['main', 'special', 'closed'];
export const COLOR_KEYS = [
  'brand', 'onBrand', 'brandText', 'gradStart', 'gradEnd', 'brandSoft', 'surfaceTint',
  'bg', 'surface1', 'surface2', 'surface3', 'glass', 'scrim', 'line',
  'text1', 'text2', 'text3', 'success', 'warning', 'danger', 'info', 'vip', 'whatsapp', 'pillMix'
];
export const TYPE_KEYS = ['title', 'heading', 'cardTitle', 'money', 'body', 'label', 'caption', 'iconLabel'];
export const SPACE_KEYS = ['xs', 's', 'm', 'l', 'xl', 'xxl'];
export const RADIUS_KEYS = ['chip', 'field', 'card', 'sheet', 'pill'];
export const MOTION_KEYS = ['fast', 'standard', 'panel', 'reduced'];
export const ELEVATION_KEYS = ['e0', 'e1', 'e2', 'e3'];
export const TOUCH_KEYS = ['ios', 'web', 'android'];
export const THEMES = ['light', 'dark'];

const HEX6 = /^#[0-9A-F]{6}$/;
const HEX68 = /^#[0-9A-F]{6}([0-9A-F]{2})?$/;

export function parseHex(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = hex.length === 9 ? parseInt(hex.slice(7, 9), 16) / 255 : 1;
  return { r, g, b, a };
}

export function toHex({ r, g, b }) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function composite(top, bottom) {
  const t = typeof top === 'string' ? parseHex(top) : top;
  const b = typeof bottom === 'string' ? parseHex(bottom) : bottom;
  const a = t.a;
  return {
    r: t.r * a + b.r * (1 - a),
    g: t.g * a + b.g * (1 - a),
    b: t.b * a + b.b * (1 - a),
    a: 1
  };
}

export function luminance(c) {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}

export function contrast(a, b) {
  const ca = typeof a === 'string' ? parseHex(a) : a;
  const cb = typeof b === 'string' ? parseHex(b) : b;
  const la = luminance(ca);
  const lb = luminance(cb);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export function mixColors(from, to, amount) {
  const a = typeof from === 'string' ? parseHex(from) : from;
  const b = typeof to === 'string' ? parseHex(to) : to;
  return {
    r: a.r * (1 - amount) + b.r * amount,
    g: a.g * (1 - amount) + b.g * amount,
    b: a.b * (1 - amount) + b.b * amount,
    a: 1
  };
}

export function pillColors(tokens, statusKey, theme) {
  const s = tokens.status.find((x) => x.key === statusKey);
  const c = s.color[theme];
  const surface = tokens.color.surface1[theme];
  const text = mixColors(c, tokens.color.pillMix[theme], tokens.pill.textMix);
  const bg = composite({ ...parseHex(c), a: tokens.pill.bgAlpha }, parseHex(surface));
  const border = composite({ ...parseHex(c), a: tokens.pill.borderAlpha }, parseHex(surface));
  return { text, bg, border };
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.length > 0;

export function validate(tokens) {
  const errors = [];
  const err = (m) => errors.push(m);

  if (!isObj(tokens)) {
    throw new Error('tokens.json debe ser un objeto');
  }
  if (!isStr(tokens.version) || !/^\d{4}\.\d+\.\d+$/.test(tokens.version)) err('version debe tener la forma AAAA.N.N');

  if (!isObj(tokens.color)) err('color falta');
  else {
    for (const k of COLOR_KEYS) {
      const c = tokens.color[k];
      if (!isObj(c)) {
        err(`color.${k} falta`);
        continue;
      }
      for (const th of THEMES) {
        if (typeof c[th] !== 'string' || !HEX68.test(c[th])) err(`color.${k}.${th} no es un hex valido en mayusculas: ${c[th]}`);
      }
    }
    for (const k of Object.keys(tokens.color)) if (!COLOR_KEYS.includes(k)) err(`color.${k} no esta en la lista de colores`);
  }

  if (!isObj(tokens.pill)) err('pill falta');
  else {
    for (const k of ['textMix', 'bgAlpha', 'borderAlpha']) {
      if (!isNum(tokens.pill[k]) || tokens.pill[k] < 0 || tokens.pill[k] > 1) err(`pill.${k} debe estar entre 0 y 1`);
    }
  }

  if (!isObj(tokens.font)) err('font falta');
  else {
    for (const k of ['display', 'body']) {
      const f = tokens.font[k];
      if (!isObj(f) || !isStr(f.name) || !isStr(f.fallback)) err(`font.${k} necesita name y fallback`);
    }
    if (isObj(tokens.font.display) && (!Array.isArray(tokens.font.display.weights) || !tokens.font.display.weights.every(isNum))) {
      err('font.display.weights debe ser una lista de numeros');
    }
  }

  if (!isObj(tokens.type)) err('type falta');
  else {
    for (const k of TYPE_KEYS) {
      const t = tokens.type[k];
      if (!isObj(t)) {
        err(`type.${k} falta`);
        continue;
      }
      for (const f of ['size', 'line', 'weight', 'tracking']) if (!isNum(t[f])) err(`type.${k}.${f} debe ser numero`);
      if (isNum(t.line) && isNum(t.size) && t.line < t.size) err(`type.${k}.line no puede ser menor que size`);
      if (!['display', 'body'].includes(t.family)) err(`type.${k}.family debe ser display o body`);
      if (typeof t.tabular !== 'boolean') err(`type.${k}.tabular debe ser booleano`);
    }
  }

  const numberMap = (name, keys) => {
    if (!isObj(tokens[name])) {
      err(`${name} falta`);
      return;
    }
    for (const k of keys) if (!isNum(tokens[name][k]) || tokens[name][k] < 0) err(`${name}.${k} debe ser numero no negativo`);
  };
  numberMap('space', SPACE_KEYS);
  numberMap('radius', RADIUS_KEYS);
  numberMap('touch', TOUCH_KEYS);

  if (!isObj(tokens.elevation)) err('elevation falta');
  else {
    for (const k of ELEVATION_KEYS) {
      const e = tokens.elevation[k];
      if (!isObj(e) || !isNum(e.y) || !isNum(e.blur) || !isObj(e.alpha)) {
        err(`elevation.${k} necesita y, blur y alpha`);
        continue;
      }
      for (const th of THEMES) if (!isNum(e.alpha[th]) || e.alpha[th] < 0 || e.alpha[th] > 1) err(`elevation.${k}.alpha.${th} fuera de rango`);
    }
  }

  if (!isObj(tokens.motion)) err('motion falta');
  else {
    for (const k of MOTION_KEYS) {
      const m = tokens.motion[k];
      if (!isObj(m) || !isNum(m.ms) || m.ms <= 0) {
        err(`motion.${k}.ms debe ser positivo`);
        continue;
      }
      if (!Array.isArray(m.curve) || m.curve.length !== 4 || !m.curve.every(isNum)) err(`motion.${k}.curve necesita 4 numeros`);
      else if (m.curve[0] < 0 || m.curve[0] > 1 || m.curve[2] < 0 || m.curve[2] > 1) err(`motion.${k}.curve: x fuera de 0 a 1`);
    }
  }

  if (isObj(tokens.contrast) && isObj(tokens.color)) {
    for (const [group, spec] of Object.entries(tokens.contrast)) {
      if (!isObj(spec) || !isNum(spec.min) || !Array.isArray(spec.pairs)) {
        err(`contrast.${group} necesita min y pairs`);
        continue;
      }
      for (const p of spec.pairs) {
        if (!Array.isArray(p) || p.length !== 2 || !p.every((n) => isObj(tokens.color[n]))) err(`contrast.${group} tiene un par invalido: ${JSON.stringify(p)}`);
      }
    }
  } else err('contrast falta');

  if (!Array.isArray(tokens.status)) err('status debe ser una lista');
  else {
    if (tokens.status.length !== STATUS_KEYS.length) err(`status debe tener ${STATUS_KEYS.length} entradas, tiene ${tokens.status.length}`);
    const seen = new Set();
    const sorts = new Set();
    for (const s of tokens.status) {
      const tag = `status.${s && s.key}`;
      if (!isObj(s)) {
        err('status tiene una entrada que no es objeto');
        continue;
      }
      if (!STATUS_KEYS.includes(s.key)) err(`${tag} no es una clave conocida`);
      if (seen.has(s.key)) err(`${tag} repetida`);
      seen.add(s.key);
      if (!Number.isInteger(s.sort) || s.sort < 0 || s.sort >= STATUS_KEYS.length) err(`${tag}.sort invalido`);
      if (sorts.has(s.sort)) err(`${tag}.sort repetido`);
      sorts.add(s.sort);
      if (!STATUS_GROUPS.includes(s.group)) err(`${tag}.group debe ser uno de ${STATUS_GROUPS.join(', ')}`);
      for (const f of ['es', 'esLong', 'en', 'enLong']) if (!isStr(s[f])) err(`${tag}.${f} falta`);
      for (const f of ['email', 'emailPhotos', 'terminal', 'reopen']) if (typeof s[f] !== 'boolean') err(`${tag}.${f} debe ser booleano`);
      if (!isObj(s.color)) err(`${tag}.color falta`);
      else for (const th of THEMES) if (typeof s.color[th] !== 'string' || !HEX6.test(s.color[th])) err(`${tag}.color.${th} no es un hex de 6 digitos`);
      if (!Array.isArray(s.to)) err(`${tag}.to debe ser lista`);
      else {
        for (const t of s.to) {
          if (!STATUS_KEYS.includes(t)) err(`${tag}.to apunta a una clave desconocida: ${t}`);
          if (t === s.key) err(`${tag}.to no puede apuntarse a si mismo`);
        }
        if (new Set(s.to).size !== s.to.length) err(`${tag}.to tiene repetidos`);
      }
    }
    for (const k of STATUS_KEYS) if (!seen.has(k)) err(`status.${k} falta`);
  }

  if (!isObj(tokens.transitions)) err('transitions falta');
  else {
    const via = tokens.transitions.via;
    if (!isObj(via)) err('transitions.via falta');
    else
      for (const [k, v] of Object.entries(via)) {
        if (!STATUS_KEYS.includes(k)) err(`transitions.via.${k} no es una clave conocida`);
        if (!isStr(v)) err(`transitions.via.${k} debe ser texto`);
      }
    const rt = tokens.transitions.reopenTo;
    if (!Array.isArray(rt) || !rt.every((k) => STATUS_KEYS.includes(k))) err('transitions.reopenTo debe ser lista de claves de estatus');
  }

  if (errors.length) {
    const e = new Error('tokens.json invalido:\n' + errors.map((m) => '  - ' + m).join('\n'));
    e.errors = errors;
    throw e;
  }
  return true;
}

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
const pascal = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const num = (n) => String(Number(Number(n).toFixed(4)));
const rgbInt = (hex) => hex.slice(1, 7).toUpperCase();
const alphaOf = (hex) => num(parseHex(hex).a);
const argbHex = (hex) => {
  const c = parseHex(hex);
  const a = Math.round(c.a * 255).toString(16).padStart(2, '0').toUpperCase();
  return a + rgbInt(hex);
};
const q = (s) => JSON.stringify(s);
const cssRgba = (hex) => {
  const c = parseHex(hex);
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${num(c.a)})`;
};

const SWIFT_WEIGHT = { 400: '.regular', 500: '.medium', 600: '.semibold', 700: '.bold', 800: '.heavy' };

function swiftWeight(w) {
  if (!SWIFT_WEIGHT[w]) throw new Error(`peso sin equivalente en Swift: ${w}`);
  return SWIFT_WEIGHT[w];
}

export function generateSwift(t) {
  const L = [];
  const p = (s = '') => L.push(s);
  p('import SwiftUI');
  p('#if canImport(UIKit)');
  p('import UIKit');
  p('#endif');
  p();
  p('extension Color {');
  p('    init(reparaLight: UInt32, _ lightAlpha: Double, dark: UInt32, _ darkAlpha: Double) {');
  p('        #if canImport(UIKit)');
  p('        self.init(UIColor { trait in');
  p('            let isDark = trait.userInterfaceStyle == .dark');
  p('            let rgb = isDark ? dark : reparaLight');
  p('            let a = isDark ? darkAlpha : lightAlpha');
  p('            return UIColor(');
  p('                red: CGFloat((rgb >> 16) & 0xFF) / 255,');
  p('                green: CGFloat((rgb >> 8) & 0xFF) / 255,');
  p('                blue: CGFloat(rgb & 0xFF) / 255,');
  p('                alpha: CGFloat(a)');
  p('            )');
  p('        })');
  p('        #else');
  p('        self.init(');
  p('            .sRGB,');
  p('            red: Double((reparaLight >> 16) & 0xFF) / 255,');
  p('            green: Double((reparaLight >> 8) & 0xFF) / 255,');
  p('            blue: Double(reparaLight & 0xFF) / 255,');
  p('            opacity: lightAlpha');
  p('        )');
  p('        #endif');
  p('    }');
  p('}');
  p();
  p('public struct ReparaCurve {');
  p('    public let duration: Double');
  p('    public let x1: Double');
  p('    public let y1: Double');
  p('    public let x2: Double');
  p('    public let y2: Double');
  p('    public var animation: Animation { .timingCurve(x1, y1, x2, y2, duration: duration) }');
  p('}');
  p();
  p('public struct ReparaTextStyle {');
  p('    public let size: CGFloat');
  p('    public let line: CGFloat');
  p('    public let weight: Font.Weight');
  p('    public let display: Bool');
  p('    public let tracking: CGFloat');
  p('    public let tabular: Bool');
  p(`    public var font: Font {`);
  p(`        let base: Font = display ? .custom(ReparaTokens.Fonts.displayName, size: size) : .system(size: size)`);
  p('        let weighted = base.weight(weight)');
  p('        return tabular ? weighted.monospacedDigit() : weighted');
  p('    }');
  p('    public var lineSpacing: CGFloat { max(0, line - size) }');
  p('}');
  p();
  p('public struct ReparaShadow {');
  p('    public let y: CGFloat');
  p('    public let blur: CGFloat');
  p('    public let color: Color');
  p('}');
  p();
  p('public struct ReparaStatus: Identifiable, Hashable {');
  p('    public enum Group: String { case main, special, closed }');
  p('    public let key: String');
  p('    public let group: Group');
  p('    public let sort: Int');
  p('    public let es: String');
  p('    public let esLong: String');
  p('    public let en: String');
  p('    public let enLong: String');
  p('    public let color: Color');
  p('    public let email: Bool');
  p('    public let emailPhotos: Bool');
  p('    public let terminal: Bool');
  p('    public let to: [String]');
  p('    public let reopen: Bool');
  p('    public var id: String { key }');
  p('}');
  p();
  p('public enum ReparaTokens {');
  p(`    public static let version = ${q(t.version)}`);
  p();
  p('    public enum Palette {');
  for (const k of COLOR_KEYS) {
    const c = t.color[k];
    p(`        public static let ${k} = Color(reparaLight: 0x${rgbInt(c.light)}, ${alphaOf(c.light)}, dark: 0x${rgbInt(c.dark)}, ${alphaOf(c.dark)})`);
  }
  p('    }');
  p();
  p('    public enum Pill {');
  p(`        public static let textMix: Double = ${num(t.pill.textMix)}`);
  p(`        public static let bgAlpha: Double = ${num(t.pill.bgAlpha)}`);
  p(`        public static let borderAlpha: Double = ${num(t.pill.borderAlpha)}`);
  p('    }');
  p();
  p('    public enum Fonts {');
  p(`        public static let displayName = ${q(t.font.display.name)}`);
  p('    }');
  p();
  p('    public enum Typography {');
  for (const k of TYPE_KEYS) {
    const s = t.type[k];
    p(`        public static let ${k} = ReparaTextStyle(size: ${num(s.size)}, line: ${num(s.line)}, weight: ${swiftWeight(s.weight)}, display: ${s.family === 'display'}, tracking: ${num(s.tracking * s.size)}, tabular: ${s.tabular})`);
  }
  p('    }');
  p();
  p('    public enum Spacing {');
  for (const k of SPACE_KEYS) p(`        public static let ${k}: CGFloat = ${num(t.space[k])}`);
  p('    }');
  p();
  p('    public enum Radius {');
  for (const k of RADIUS_KEYS) p(`        public static let ${k}: CGFloat = ${num(t.radius[k])}`);
  p('    }');
  p();
  p('    public enum Touch {');
  for (const k of TOUCH_KEYS) p(`        public static let ${k}: CGFloat = ${num(t.touch[k])}`);
  p('    }');
  p();
  p('    public enum Elevation {');
  for (const k of ELEVATION_KEYS) {
    const e = t.elevation[k];
    p(`        public static let ${k} = ReparaShadow(y: ${num(e.y)}, blur: ${num(e.blur)}, color: Color(reparaLight: 0x000000, ${num(e.alpha.light)}, dark: 0x000000, ${num(e.alpha.dark)}))`);
  }
  p('    }');
  p();
  p('    public enum Motion {');
  for (const k of MOTION_KEYS) {
    const m = t.motion[k];
    p(`        public static let ${k} = ReparaCurve(duration: ${num(m.ms / 1000)}, x1: ${num(m.curve[0])}, y1: ${num(m.curve[1])}, x2: ${num(m.curve[2])}, y2: ${num(m.curve[3])})`);
  }
  p('    }');
  p();
  p('    public enum Statuses {');
  p('        public static let all: [ReparaStatus] = [');
  const sorted = [...t.status].sort((a, b) => a.sort - b.sort);
  for (const s of sorted) {
    p(`            ReparaStatus(key: ${q(s.key)}, group: .${s.group}, sort: ${s.sort}, es: ${q(s.es)}, esLong: ${q(s.esLong)}, en: ${q(s.en)}, enLong: ${q(s.enLong)}, color: Color(reparaLight: 0x${rgbInt(s.color.light)}, 1, dark: 0x${rgbInt(s.color.dark)}, 1), email: ${s.email}, emailPhotos: ${s.emailPhotos}, terminal: ${s.terminal}, to: [${s.to.map(q).join(', ')}], reopen: ${s.reopen}),`);
  }
  p('        ]');
  p('        public static func status(for key: String) -> ReparaStatus? { all.first { $0.key == key } }');
  p(`        public static let reopenTo: [String] = [${t.transitions.reopenTo.map(q).join(', ')}]`);
  p('        public static let via: [String: String] = [');
  for (const [k, v] of Object.entries(t.transitions.via)) p(`            ${q(k)}: ${q(v)},`);
  p('        ]');
  p('    }');
  p('}');
  return L.join('\n') + '\n';
}

function ktColor(hex) {
  return `Color(0x${argbHex(hex)})`;
}

export function generateKotlin(t) {
  const L = [];
  const p = (s = '') => L.push(s);
  p('package com.archillastudios.archillachat.ui.theme');
  p();
  p('import androidx.compose.animation.core.CubicBezierEasing');
  p('import androidx.compose.ui.graphics.Color');
  p('import androidx.compose.ui.text.font.FontWeight');
  p('import androidx.compose.ui.unit.dp');
  p('import androidx.compose.ui.unit.em');
  p('import androidx.compose.ui.unit.sp');
  p();
  p('class ReparaColor(val light: Color, val dark: Color) {');
  p('    fun resolve(isDark: Boolean): Color = if (isDark) dark else light');
  p('}');
  p();
  p('class ReparaTextStyleToken(');
  p('    val size: Float,');
  p('    val line: Float,');
  p('    val weight: FontWeight,');
  p('    val display: Boolean,');
  p('    val tracking: Float,');
  p('    val tabular: Boolean,');
  p(') {');
  p('    val sizeSp get() = size.sp');
  p('    val lineSp get() = line.sp');
  p('    val trackingEm get() = tracking.em');
  p('}');
  p();
  p('class ReparaMotionToken(val ms: Int, val easing: CubicBezierEasing)');
  p();
  p('class ReparaShadowToken(val y: Float, val blur: Float, val alphaLight: Float, val alphaDark: Float)');
  p();
  p('class ReparaStatusToken(');
  p('    val key: String,');
  p('    val group: String,');
  p('    val sort: Int,');
  p('    val es: String,');
  p('    val esLong: String,');
  p('    val en: String,');
  p('    val enLong: String,');
  p('    val color: ReparaColor,');
  p('    val email: Boolean,');
  p('    val emailPhotos: Boolean,');
  p('    val terminal: Boolean,');
  p('    val to: List<String>,');
  p('    val reopen: Boolean,');
  p(')');
  p();
  p('object ReparaTokens {');
  p(`    const val VERSION = ${q(t.version)}`);
  p();
  p('    object Palette {');
  for (const k of COLOR_KEYS) {
    const c = t.color[k];
    p(`        val ${k} = ReparaColor(${ktColor(c.light)}, ${ktColor(c.dark)})`);
  }
  p('    }');
  p();
  p('    object Pill {');
  p(`        const val TEXT_MIX = ${num(t.pill.textMix)}f`);
  p(`        const val BG_ALPHA = ${num(t.pill.bgAlpha)}f`);
  p(`        const val BORDER_ALPHA = ${num(t.pill.borderAlpha)}f`);
  p('    }');
  p();
  p('    object Fonts {');
  p(`        const val DISPLAY_NAME = ${q(t.font.display.name)}`);
  p('    }');
  p();
  p('    object Typography {');
  for (const k of TYPE_KEYS) {
    const s = t.type[k];
    p(`        val ${k} = ReparaTextStyleToken(${num(s.size)}f, ${num(s.line)}f, FontWeight(${s.weight}), ${s.family === 'display'}, ${num(s.tracking)}f, ${s.tabular})`);
  }
  p('    }');
  p();
  p('    object Spacing {');
  for (const k of SPACE_KEYS) p(`        val ${k} = ${num(t.space[k])}.dp`);
  p('    }');
  p();
  p('    object Radius {');
  for (const k of RADIUS_KEYS) p(`        val ${k} = ${num(t.radius[k])}.dp`);
  p('    }');
  p();
  p('    object Touch {');
  for (const k of TOUCH_KEYS) p(`        val ${k} = ${num(t.touch[k])}.dp`);
  p('    }');
  p();
  p('    object Elevation {');
  for (const k of ELEVATION_KEYS) {
    const e = t.elevation[k];
    p(`        val ${k} = ReparaShadowToken(${num(e.y)}f, ${num(e.blur)}f, ${num(e.alpha.light)}f, ${num(e.alpha.dark)}f)`);
  }
  p('    }');
  p();
  p('    object Motion {');
  for (const k of MOTION_KEYS) {
    const m = t.motion[k];
    p(`        val ${k} = ReparaMotionToken(${m.ms}, CubicBezierEasing(${m.curve.map((v) => num(v) + 'f').join(', ')}))`);
  }
  p('    }');
  p();
  p('    object Statuses {');
  p('        val all: List<ReparaStatusToken> = listOf(');
  const sorted = [...t.status].sort((a, b) => a.sort - b.sort);
  for (const s of sorted) {
    p(`            ReparaStatusToken(${q(s.key)}, ${q(s.group)}, ${s.sort}, ${q(s.es)}, ${q(s.esLong)}, ${q(s.en)}, ${q(s.enLong)}, ReparaColor(${ktColor(s.color.light)}, ${ktColor(s.color.dark)}), ${s.email}, ${s.emailPhotos}, ${s.terminal}, listOf(${s.to.map(q).join(', ')}), ${s.reopen}),`);
  }
  p('        )');
  p('        fun byKey(key: String?): ReparaStatusToken? = all.firstOrNull { it.key == key }');
  p(`        val reopenTo: List<String> = listOf(${t.transitions.reopenTo.map(q).join(', ')})`);
  p('        val via: Map<String, String> = mapOf(');
  for (const [k, v] of Object.entries(t.transitions.via)) p(`            ${q(k)} to ${q(v)},`);
  p('        )');
  p('    }');
  p('}');
  return L.join('\n') + '\n';
}

function themeVars(t, theme) {
  const V = [];
  for (const k of COLOR_KEYS) V.push(`--repara-${kebab(k)}: ${t.color[k][theme]};`);
  for (const k of ELEVATION_KEYS) {
    const e = t.elevation[k];
    V.push(`--repara-shadow-${k}: ${e.alpha[theme] === 0 ? 'none' : `0 ${e.y}px ${e.blur}px rgba(0, 0, 0, ${num(e.alpha[theme])})`};`);
  }
  for (const s of [...t.status].sort((a, b) => a.sort - b.sort)) V.push(`--repara-status-${kebab(s.key)}: ${s.color[theme]};`);
  V.push(`color-scheme: ${theme};`);
  return V;
}

export function generateCss(t) {
  const L = [];
  const p = (s = '') => L.push(s);
  const block = (sel, vars, indent = '') => {
    p(`${indent}${sel} {`);
    for (const v of vars) p(`${indent}  ${v}`);
    p(`${indent}}`);
  };
  const shared = [];
  shared.push(`--repara-version: ${q(t.version)};`);
  shared.push(`--repara-font-display: ${q(t.font.display.name)}, ${t.font.display.fallback};`);
  shared.push(`--repara-font-body: ${t.font.body.fallback};`);
  for (const k of TYPE_KEYS) {
    const s = t.type[k];
    shared.push(`--repara-type-${kebab(k)}-size: ${s.size}px;`);
    shared.push(`--repara-type-${kebab(k)}-line: ${s.line}px;`);
    shared.push(`--repara-type-${kebab(k)}-weight: ${s.weight};`);
    shared.push(`--repara-type-${kebab(k)}-tracking: ${num(s.tracking)}em;`);
    shared.push(`--repara-type-${kebab(k)}-family: var(--repara-font-${s.family});`);
    shared.push(`--repara-type-${kebab(k)}-numeric: ${s.tabular ? 'tabular-nums' : 'normal'};`);
  }
  for (const k of SPACE_KEYS) shared.push(`--repara-space-${k}: ${t.space[k]}px;`);
  for (const k of RADIUS_KEYS) shared.push(`--repara-radius-${k}: ${t.radius[k]}px;`);
  for (const k of TOUCH_KEYS) shared.push(`--repara-touch-${k}: ${t.touch[k]}px;`);
  for (const k of MOTION_KEYS) {
    const m = t.motion[k];
    shared.push(`--repara-motion-${k}: ${m.ms}ms;`);
    shared.push(`--repara-ease-${k}: cubic-bezier(${m.curve.map(num).join(', ')});`);
  }
  shared.push(`--repara-pill-text-mix: ${num(t.pill.textMix * 100)}%;`);
  shared.push(`--repara-pill-bg-mix: ${num(t.pill.bgAlpha * 100)}%;`);
  shared.push(`--repara-pill-border-mix: ${num(t.pill.borderAlpha * 100)}%;`);
  block(':root', [...shared, ...themeVars(t, 'light')]);
  p();
  p('@media (prefers-color-scheme: dark) {');
  block(':root:not([data-theme="light"])', themeVars(t, 'dark'), '  ');
  p('}');
  p();
  block(':root[data-theme="dark"]', themeVars(t, 'dark'));
  p();
  block(':root[data-theme="light"]', themeVars(t, 'light'));
  p();
  p('.repara-pill {');
  p('  --c: var(--repara-text3);');
  p('  display: inline-flex;');
  p('  align-items: center;');
  p('  border-radius: var(--repara-radius-pill);');
  p('  background: color-mix(in srgb, var(--c) var(--repara-pill-bg-mix), transparent);');
  p('  color: color-mix(in srgb, var(--c) calc(100% - var(--repara-pill-text-mix)), var(--repara-pill-mix));');
  p('  border: 1px solid color-mix(in srgb, var(--c) var(--repara-pill-border-mix), transparent);');
  p('}');
  for (const s of [...t.status].sort((a, b) => a.sort - b.sort)) {
    p(`.repara-pill[data-status="${s.key}"] { --c: var(--repara-status-${kebab(s.key)}); }`);
  }
  return L.join('\n') + '\n';
}

export function generateTailwind(t) {
  const colors = {};
  for (const k of COLOR_KEYS) colors[k] = `var(--repara-${kebab(k)})`;
  const status = {};
  for (const s of [...t.status].sort((a, b) => a.sort - b.sort)) status[kebab(s.key)] = `var(--repara-status-${kebab(s.key)})`;
  const fontSize = {};
  for (const k of TYPE_KEYS) {
    fontSize[kebab(k)] = [
      `var(--repara-type-${kebab(k)}-size)`,
      {
        lineHeight: `var(--repara-type-${kebab(k)}-line)`,
        fontWeight: `var(--repara-type-${kebab(k)}-weight)`,
        letterSpacing: `var(--repara-type-${kebab(k)}-tracking)`
      }
    ];
  }
  const spacing = {};
  for (const k of SPACE_KEYS) spacing[k] = `var(--repara-space-${k})`;
  const borderRadius = {};
  for (const k of RADIUS_KEYS) borderRadius[k] = `var(--repara-radius-${k})`;
  const boxShadow = {};
  for (const k of ELEVATION_KEYS) boxShadow[k] = `var(--repara-shadow-${k})`;
  const transitionDuration = {};
  const transitionTimingFunction = {};
  for (const k of MOTION_KEYS) {
    transitionDuration[k] = `var(--repara-motion-${k})`;
    transitionTimingFunction[k] = `var(--repara-ease-${k})`;
  }
  const minHeight = {};
  const minWidth = {};
  for (const k of TOUCH_KEYS) {
    minHeight[`touch-${k}`] = `var(--repara-touch-${k})`;
    minWidth[`touch-${k}`] = `var(--repara-touch-${k})`;
  }
  const preset = {
    theme: {
      extend: {
        colors: { repara: { ...colors, status } },
        fontFamily: {
          'repara-display': ['var(--repara-font-display)'],
          'repara-body': ['var(--repara-font-body)']
        },
        fontSize: Object.fromEntries(Object.entries(fontSize).map(([k, v]) => ['repara-' + k, v])),
        spacing: Object.fromEntries(Object.entries(spacing).map(([k, v]) => ['repara-' + k, v])),
        borderRadius: Object.fromEntries(Object.entries(borderRadius).map(([k, v]) => ['repara-' + k, v])),
        boxShadow: Object.fromEntries(Object.entries(boxShadow).map(([k, v]) => ['repara-' + k, v])),
        transitionDuration: Object.fromEntries(Object.entries(transitionDuration).map(([k, v]) => ['repara-' + k, v])),
        transitionTimingFunction: Object.fromEntries(Object.entries(transitionTimingFunction).map(([k, v]) => ['repara-' + k, v])),
        minHeight,
        minWidth
      }
    }
  };
  return `module.exports = ${JSON.stringify(preset, null, 2)};\n`;
}

export function generate(tokens) {
  validate(tokens);
  return {
    'ReparaTokens.swift': generateSwift(tokens),
    'ReparaTokens.kt': generateKotlin(tokens),
    'repara-tokens.css': generateCss(tokens),
    'tailwind-preset.cjs': generateTailwind(tokens)
  };
}

export function loadTokens(path = join(HERE, 'tokens.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const TARGETS = {
  'out-ios': [['ReparaTokens.swift', 'ReparaTokens.swift']],
  'out-android': [['ReparaTokens.kt', 'ReparaTokens.kt']],
  'out-web': [
    ['repara-tokens.css', 'repara-tokens.css'],
    ['tailwind-preset.cjs', 'tailwind.repara.cjs']
  ]
};

function parseArgs(argv) {
  const opts = { check: false, dirs: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') opts.check = true;
    else if (a.startsWith('--out-') && TARGETS[a.slice(2)]) {
      const v = argv[++i];
      if (!v) throw new Error(`${a} necesita una ruta`);
      opts.dirs[a.slice(2)] = resolve(v);
    } else throw new Error(`argumento desconocido: ${a}`);
  }
  return opts;
}

export function run(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  const files = generate(loadTokens());
  const dist = join(HERE, 'dist');
  const pairs = [];
  for (const name of Object.keys(files)) pairs.push([join(dist, name), files[name]]);
  for (const [opt, dir] of Object.entries(opts.dirs)) {
    for (const [src, dst] of TARGETS[opt]) pairs.push([join(dir, dst), files[src]]);
  }
  if (opts.check) {
    const stale = pairs.filter(([path, content]) => !existsSync(path) || readFileSync(path, 'utf8') !== content).map(([path]) => path);
    if (stale.length) {
      process.stderr.write('Desactualizados:\n' + stale.map((s) => '  ' + s).join('\n') + '\n');
      return 1;
    }
    process.stdout.write('Todo al dia, version ' + loadTokens().version + '\n');
    return 0;
  }
  for (const [path, content] of pairs) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  process.stdout.write(`Generados ${pairs.length} archivos, version ${loadTokens().version}\n`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = run();
  } catch (e) {
    process.stderr.write(String(e.message) + '\n');
    process.exitCode = 1;
  }
}
