import { discountEnded } from "@/lib/discounts";
export const IOS = {
  blue: "#0A84FF", pink: "#FF375F", orange: "#FF9F0A", indigo: "#5E5CE6", yellow: "#FFD60A", red: "#FF453A",
  green: "#30D158", teal: "#40C8E0", purple: "#BF5AF2", mint: "#66D4CF", gray: "#8E8E93",
};

export const STEPS = {
  1: { key: "customer", title: "Cliente", subtitle: "Busca un cliente o crea uno nuevo", color: IOS.blue },
  2: { key: "device", title: "Dispositivo", subtitle: "Categoría, familia y modelo", color: IOS.pink },
  3: { key: "problem", title: "Problema", subtitle: "Describe lo que reporta el cliente", color: IOS.orange },
  4: { key: "photos", title: "Fotos", subtitle: "Adjunta evidencia del estado del equipo", color: IOS.indigo },
  5: { key: "checklist", title: "Checklist", subtitle: "Síntomas comunes — escoge los que aplican", color: IOS.yellow },
  6: { key: "security", title: "Seguridad", subtitle: "PIN, patrón o contraseña del dispositivo", color: IOS.red },
  7: { key: "estimate", title: "Cotización", subtitle: "Mano de obra y costo estimado", color: IOS.green },
  8: { key: "assignment", title: "Asignación", subtitle: "¿Quién va a trabajar esta orden?", color: IOS.teal },
  9: { key: "signature", title: "Firma", subtitle: "Firma + aceptación de términos", color: IOS.purple },
  10: { key: "confirm", title: "Confirmar", subtitle: "Revisa los datos antes de crear la orden", color: IOS.mint },
};
export const TOTAL_STEPS = 10;

export const MODES = {
  regular: { label: "Orden regular", color: IOS.blue },
  quick: { label: "Orden rápida", color: IOS.orange },
  recharge: { label: "Recarga", color: IOS.green },
  unlock: { label: "Desbloqueo", color: IOS.purple },
};

const QUICK_SKIP = new Set([4, 6, 7, 9]);
const RECHARGE_SKIP = new Set([2, 4, 5, 6, 7, 8, 9]);
const UNLOCK_SKIP = new Set([5, 6, 7, 8, 9]);

export function shouldSkipStep(step, mode) {
  if (step === 6 || step === 8) return true;
  if (mode === "quick" && QUICK_SKIP.has(step)) return true;
  if (mode === "recharge" && RECHARGE_SKIP.has(step)) return true;
  if (mode === "unlock" && UNLOCK_SKIP.has(step)) return true;
  return false;
}

export function activeSteps(mode) {
  return Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).filter((s) => !shouldSkipStep(s, mode));
}

export const UNLOCK_TYPES = {
  blacklist: { label: "Lista Negra", description: "Verificar y gestionar reportes de robo/pérdida", color: IOS.red },
  carrier_unlock: { label: "Desbloqueo Carrier", description: "Liberación para uso con cualquier operadora", color: IOS.purple },
  imei_change: { label: "Cambio de IMEI", description: "Modificación del número IMEI del equipo", color: IOS.orange },
};

export const CARRIERS = ["Telcel", "AT&T", "Movistar", "Telmex", "Unefon", "Bait", "T-Mobile", "Verizon", "Cricket", "Metro", "Boost", "Virgin Mobile", "Claro", "Tigo", "Otro"];

export const CHECKLIST_ITEMS = [
  ["power", "Encendido"], ["screen", "Pantalla"], ["touch", "Touch"], ["speakers", "Bocinas"], ["microphone", "Micrófono"],
  ["camera_front", "Cámara Frontal"], ["camera_back", "Cámara Trasera"], ["buttons", "Botones"], ["wifi", "WiFi"],
  ["bluetooth", "Bluetooth"], ["charging", "Carga"], ["battery", "Batería"], ["ports", "Puertos"],
];

export const PHOTO_EXCEPTIONS = ["Equipo no disponible en el taller", "Cliente no lo tiene disponible ahora"];

export const LIQUID_ADVISORY = "El equipo presenta indicios de daño por líquido anteriores a esta reparación. Pueden surgir fallas futuras no relacionadas con el trabajo realizado.";

export const IVU = 0.115;

export function nowISONoFrac(d = new Date()) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function newUUID() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  }).toUpperCase();
}

export function naturalCompare(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
}

export function sanitizeEmail(raw) {
  let s = String(raw || "");
  ["​", "‌", "‍", "﻿", " ", " ", " "].forEach((c) => { s = s.split(c).join(""); });
  s = s.trim().toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, "\"");
  s = s.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return [...s].filter((ch) => ch.charCodeAt(0) < 128).join("");
}

export function isValidEmail(email) {
  return !!email && email.length <= 254 && /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(email);
}

function catKey(category) {
  return String(category?.slug || category?.name || "").toLowerCase();
}

export function categoryKind(category) {
  const k = catKey(category);
  const has = (...w) => w.some((x) => k.includes(x));
  if (has("phone", "smartphone", "celular", "movil", "móvil")) return "phone";
  if (has("tablet", "tableta", "ipad")) return "tablet";
  if (has("imac", "desktop", "escritorio", "torre", "all-in-one")) return "desktop";
  if (has("laptop", "computer", "computadora", "pc")) return "computer";
  if (has("watch", "reloj")) return "watch";
  if (has("console", "consola", "game")) return "console";
  if (has("headset", "headphone", "audifono", "audífono", "airpod", "bocina", "speaker", "mp3", "ipod")) return "audio";
  if (k.includes("tv")) return "tv";
  if (has("printer", "impresora")) return "printer";
  if (has("camera", "camara", "cámara")) return "camera";
  if (has("drone", "dron")) return "drone";
  return "other";
}

export function problemSuggestions(category) {
  const k = categoryKind(category);
  if (k === "phone") return ["No enciende", "Pantalla rota", "Batería descarga rápido", "No carga", "Cámara no funciona", "Touch no responde", "Sin audio", "Sin señal", "Daño por agua"];
  if (k === "tablet") return ["No enciende", "Pantalla rota", "Batería falla", "No carga", "Touch no responde", "Sin WiFi", "Bocina dañada", "Daño por agua"];
  if (k === "computer" || k === "desktop") return ["No enciende", "Pantalla en negro", "Teclado dañado", "Trackpad no responde", "No carga", "Lento", "Pantalla rota", "Daño por agua"];
  if (k === "watch") return ["No enciende", "Pantalla rota", "Correa rota", "No carga", "Botón dañado"];
  return ["No enciende", "Pantalla dañada", "No carga", "Botón dañado", "Sin audio"];
}

export function toggleProblemText(current, text) {
  const needle = String(text || "").trim();
  if (!needle) return current;
  const cur = String(current || "");
  if (cur.toLowerCase().includes(needle.toLowerCase())) {
    return cur.split(",").map((p) => p.trim()).filter((p) => p && p.toLowerCase() !== needle.toLowerCase()).join(", ");
  }
  if (!cur) return needle;
  return `${cur}, ${needle}`;
}

export function appendProblemText(current, text) {
  const cur = String(current || "");
  if (!cur) return text;
  if (cur.toLowerCase().includes(String(text).toLowerCase())) return cur;
  return `${cur}, ${text}`;
}

export function keywordDays(problem) {
  const t = String(problem || "").toLowerCase();
  const has = (...w) => w.some((x) => t.includes(x));
  if (has("board", "placa", "logic", "agua", "liquido", "mojad")) return 5;
  if (has("software", "bloque", "icloud", "frp")) return 2;
  if (has("pantalla", "bateria", "puerto", "camara", "boton")) return 1;
  return 2;
}

export function contextualWaivers(problem) {
  const t = String(problem || "").toLowerCase();
  const out = [];
  if (/agua|liquido|líquido|mojad|humedad/.test(t)) out.push("Este equipo presenta o presentó exposición a líquido. La reparación no garantiza que no aparezcan fallas nuevas por corrosión interna, incluso después de un diagnóstico exitoso.");
  if (/pantalla|cristal|trizad/.test(t)) out.push("Las pantallas y piezas de cristal no tienen garantía contra golpes, caídas o roturas después de la entrega.");
  if (/board|placa|logic/.test(t)) out.push("Las reparaciones de placa/board conllevan riesgo de pérdida de datos. El taller no se hace responsable por información no respaldada por el cliente.");
  return out;
}

export function abandonmentText(tenant) {
  const s = tenant?.settings || {};
  const custom = String(s.policies?.abandonment_terms || "").trim();
  if (custom) return custom;
  const base = "El cliente debe recoger su equipo dentro de los 30 días luego de ser notificado que está listo. Pasado ese plazo aplica un cargo diario por almacenaje. Los equipos no reclamados dentro de los 90 días desde dicha notificación se considerarán abandonados, y el taller podrá disponer de ellos conforme a la ley aplicable para recuperar los costos de reparación y almacenaje.";
  const p = s.abandonment_policy || {};
  const days = Number(p.abandon_days ?? 30);
  const claim = Number(p.claim_total_days ?? 90);
  const fee = Number(p.daily_fee ?? 3);
  if (days === 30 && claim === 90 && Math.abs(fee - 3) < 0.001) return base;
  return `${base} (En este taller: ${days} días para recoger, cargo de $${fee.toFixed(2)}/día, ${claim} días para reclamo total.)`;
}

export function isServiceItem(p) {
  const bucket = String(p?.tipo_principal || "").toLowerCase();
  if (bucket === "servicios") return true;
  if (p?.type === "service") return true;
  if (bucket) return false;
  if (String(p?.part_type || "").toLowerCase() === "servicio") return true;
  return String(p?.category || "").toLowerCase() === "diagnostic";
}

export function isFullDeviceItem(p) {
  const bucket = String(p?.tipo_principal || "").toLowerCase();
  const sub = String(p?.subcategoria || "").toLowerCase();
  if (bucket) return bucket === "dispositivos" && sub === "dispositivo_completo";
  return String(p?.type || "").toLowerCase() === "device";
}

export function effectivePrice(p) {
  const price = Number(p?.price) || 0;
  const pct = Number(p?.discount_percentage) || 0;
  return p?.discount_active === true && pct > 0 && !discountEnded(p?.discount_end_date) ? price * (1 - pct / 100) : price;
}

export function lineSubtotal(line) {
  return line.unitPrice * line.quantity;
}

export function lineTax(line, rate = IVU) {
  return line.product?.taxable === false ? 0 : lineSubtotal(line) * rate;
}

export function cartTotals(lines, rate = IVU) {
  const subtotal = lines.reduce((s, l) => s + lineSubtotal(l), 0);
  const tax = lines.reduce((s, l) => s + lineTax(l, rate), 0);
  return { subtotal, tax, total: subtotal + tax };
}

export function willDeductStock(line) {
  if (line.product?.type === "service" || !line.product?.id) return false;
  return (Number(line.product.stock) || 0) >= line.quantity;
}

const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function normalizeForMatch(s) {
  return fold(s).replace(/[^a-z0-9 ]/g, " ").split(" ").filter(Boolean).join(" ");
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1).fill(0);
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function scoreProductMatch(p, raw, normalized, qTokens) {
  const sku = String(p.sku || "").trim();
  if (sku && sku.toLowerCase() === raw.toLowerCase()) return 1;
  const bc = String(p.barcode || "").trim();
  if (bc && bc.toLowerCase() === raw.toLowerCase()) return 1;
  const pn = normalizeForMatch(p.name);
  if (pn === normalized) return 0.95;
  const pTokens = new Set(pn.split(" ").filter((t) => t.length >= 2));
  const union = new Set([...qTokens, ...pTokens]).size;
  let inter = 0;
  qTokens.forEach((t) => { if (pTokens.has(t)) inter += 1; });
  const jaccard = union ? inter / union : 0;
  const maxLen = Math.max(normalized.length, pn.length);
  const lev = normalized === pn ? 1 : !normalized || !pn ? 0 : 1 - levenshtein(normalized, pn) / maxLen;
  const combined = jaccard * 0.65 + lev * 0.35;
  if (pn.startsWith(normalized) || normalized.startsWith(pn)) return Math.min(1, combined + 0.15);
  return combined;
}

export function catalogTopMatches(query, pool, limit = 5) {
  const raw = String(query || "").trim();
  if (!raw || !pool.length) return [];
  const normalized = normalizeForMatch(raw);
  const qTokens = new Set(normalized.split(" ").filter((t) => t.length >= 2));
  return pool.map((p) => ({ product: p, score: scoreProductMatch(p, raw, normalized, qTokens) }))
    .filter((m) => m.score > 0.3).sort((a, b) => b.score - a.score).slice(0, limit);
}

export function partMatchContext({ category, brand, family, model }) {
  const n = (s) => String(s || "").trim().toLowerCase();
  return { category: n(category), brand: n(brand), family: n(family), model: n(model) };
}

export function scorePart(p, ctx) {
  const n = (s) => String(s || "").trim().toLowerCase();
  const tag = n(p.device_model_tag);
  const fam = n(p.device_family);
  const cat = n(p.device_category);
  const brand = n(p.device_brand);
  let ok;
  if (fam) ok = !!ctx.family && fam === ctx.family;
  else if (cat) ok = !!ctx.category && cat === ctx.category && (!ctx.brand || !brand || brand === ctx.brand);
  else ok = false;
  if (!ok) return 0;
  if (tag) return !ctx.model ? 60 : tag === ctx.model ? 100 : 0;
  return 60;
}

const hasDeviceTag = (p) => !!(String(p.device_model_tag || "") || String(p.device_family || "") || String(p.device_category || ""));

export function fuzzyPartMatches(ctx, pool, limit = 12) {
  const q = [ctx.brand, ctx.family, ctx.model].filter(Boolean).join(" ");
  if (!q) return [];
  return catalogTopMatches(q, pool.filter((p) => !hasDeviceTag(p) && !isFullDeviceItem(p)), limit);
}

export function wordTokens(s) {
  return new Set(fold(s).split(/[^a-z0-9ñ]+/i).filter(Boolean));
}

export function buildSuggestions(products, { category, brand, family, model }) {
  if (!category) return [];
  const categoryName = String(category.name || "").toLowerCase();
  const familyNeedle = family?.name || "";
  const partNeedle = String(model?.name || family?.name || "").trim();
  const cKey = String(category.slug || category.name || "").toLowerCase();
  const needle = wordTokens(`${familyNeedle} ${model?.name || ""}`);
  const services = products.filter((p) => {
    if (!isServiceItem(p)) return false;
    const dc = String(p.device_category || "").toLowerCase();
    if (dc) return dc === categoryName;
    const name = String(p.name || "").toLowerCase();
    if (cKey && name.includes(cKey)) return true;
    if (partNeedle && name.includes(partNeedle.toLowerCase())) return true;
    if (familyNeedle && name.includes(familyNeedle.toLowerCase())) return true;
    const prefix = cKey.slice(0, 4);
    return !!prefix && name.split(" ").some((t) => t.startsWith(prefix));
  });
  const svcPool = products.filter((p) => isServiceItem(p) && !String(p.device_category || ""));
  const svcQuery = cKey || familyNeedle;
  const extra = svcQuery ? catalogTopMatches(svcQuery, svcPool, 3).filter((m) => m.score >= 0.25).map((m) => m.product).filter((x) => !services.some((s) => s.id === x.id)) : [];
  const ctx = partMatchContext({ category: category?.name, brand: brand?.name, family: family?.name, model: model?.name });
  const candidates = products.filter((p) => !isServiceItem(p) && !isFullDeviceItem(p));
  const tagged = candidates.filter((p) => scorePart(p, ctx) > 0);
  const exact = tagged.filter((p) => String(p.device_model_tag || ""));
  const general = tagged.filter((p) => !String(p.device_model_tag || ""));
  const fuzzy = needle.size ? fuzzyPartMatches(ctx, candidates).map((m) => m.product).filter((p) => { const t = wordTokens(p.name); return [...needle].every((x) => t.has(x)); }) : [];
  return [...[...services, ...extra].slice(0, 4), ...exact.slice(0, 4), ...general.slice(0, 3), ...fuzzy.slice(0, 3)];
}

export function deviceMatchedProducts(products, sel) {
  const fam = sel.family?.name;
  if (!fam) return [];
  const ctx = partMatchContext({ category: sel.category?.name, brand: "", family: fam, model: sel.model?.name });
  const tagged = products.filter((p) => scorePart(p, ctx) > 0).sort((a, b) => scorePart(b, ctx) - scorePart(a, ctx));
  const needle = sel.model?.name ? wordTokens(`${fam} ${sel.model.name}`) : null;
  const fuzzy = fuzzyPartMatches(ctx, products).map((m) => m.product).filter((p) => !tagged.some((t) => t.id === p.id))
    .filter((p) => { if (!needle) return true; const t = wordTokens(p.name); return [...needle].every((x) => t.has(x)); });
  return [...tagged, ...fuzzy];
}

export function searchProducts(products, query) {
  const q = fold(query).trim();
  if (!q) return products;
  const words = q.split(/\s+/).filter(Boolean);
  const hay = (p) => fold(`${p.name} ${p.sku || ""} ${p.category || ""}`);
  const multi = products.filter((p) => words.every((w) => hay(p).includes(w)));
  return multi.length ? multi : products.filter((p) => hay(p).includes(q));
}

export function isVIP(c) {
  const tier = String(c?.loyalty_tier || "").toLowerCase();
  return ["vip", "gold", "platinum"].includes(tier) || (Number(c?.total_spent) || 0) >= 500;
}

export const customerDisplayName = (c) => c?.company_name || c?.name || "Cliente";

export function initialsOf(name) {
  const n = String(name || "").trim();
  if (!n) return "?";
  return n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function similarName(typed, existing) {
  const norm = (s) => fold(s).replace(/[\s-]/g, "");
  const t = norm(typed);
  if (t.length < 3) return null;
  return existing.find((e) => { const x = norm(e); return x && (x.includes(t) || t.includes(x)); }) || null;
}
