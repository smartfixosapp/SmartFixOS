import { normalizeTaxPercent } from "@/lib/taxRate";
export function r2(value) {
  const x = Number(value);
  if (!Number.isFinite(x)) return 0;
  const sign = x < 0 ? -1 : 1;
  const scaled = Math.abs(x) * 100;
  const floor = Math.floor(scaled);
  const frac = scaled - floor;
  let cents;
  if (Math.abs(frac - 0.5) < 1e-7) cents = floor % 2 === 0 ? floor : floor + 1;
  else cents = Math.round(scaled);
  return (sign * cents) / 100;
}

export function usd(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function parseMoney(text) {
  const clean = String(text ?? "").replace(/\$/g, "").replace(/\s/g, "").replace(",", ".");
  if (!clean) return null;
  const n = Number(clean);
  return Number.isFinite(n) ? n : null;
}

export function tenantTaxPercent(tenant) {
  return normalizeTaxPercent(tenant?.settings?.tax_rate);
}

export function tenantTaxRate(tenant) {
  return tenantTaxPercent(tenant) / 100;
}

export function taxRateLabel(tenant) {
  const p = tenantTaxPercent(tenant);
  return Number.isInteger(p) ? `${p}%` : `${p.toFixed(1)}%`;
}

export function posRecibo(tenant) {
  const pr = tenant?.settings?.pos_recibo || {};
  const on = (k) => (pr[k] === undefined || pr[k] === null ? true : !!pr[k]);
  return { sendEmail: on("send_email"), sendWhatsApp: on("send_whatsapp"), sendPrint: on("send_print") };
}

export function tenantDisplayName(tenant) {
  return tenant?.admin_name || tenant?.name || "Mi taller";
}

export function newLineId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function lineGross(item) {
  return r2(Number(item.unitPrice) * item.quantity);
}

export function lineDiscount(item) {
  const pct = Math.max(0, Math.min(100, Number(item.discountPercent) || 0));
  if (pct <= 0) return 0;
  return r2((lineGross(item) * pct) / 100);
}

export function lineTotal(item) {
  return Math.max(0, r2(lineGross(item) - lineDiscount(item)));
}

export function lineTax(item) {
  return r2(lineTotal(item) * (Number(item.taxRate) || 0));
}

export function lineTotalWithTax(item) {
  return r2(lineTotal(item) + lineTax(item));
}

export function itemToPayload(item) {
  const payload = {
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: Number(item.unitPrice),
    tax_rate: Number(item.taxRate),
    tax_amount: lineTax(item),
    total: lineTotalWithTax(item),
  };
  if ((Number(item.discountPercent) || 0) > 0) {
    payload.discount_percent = Number(item.discountPercent);
    payload.discount_amount = lineDiscount(item);
  }
  if (item.productId) payload.product_id = item.productId;
  return payload;
}

export function cartTotals({ cart, taxEnabled, discountAmount, customer }) {
  const subtotal = r2(cart.reduce((s, i) => s + lineTotal(i), 0));
  const taxAmount = taxEnabled ? r2(cart.reduce((s, i) => s + lineTax(i), 0)) : 0;
  const memberDiscount = customer?.is_member === true && subtotal > 0 ? r2((subtotal * 5) / 100) : 0;
  const totalDiscount = Math.min(subtotal + taxAmount, (Number(discountAmount) || 0) + memberDiscount);
  const total = r2(Math.max(0, subtotal + taxAmount - totalDiscount));
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
  return { subtotal, taxAmount, memberDiscount, totalDiscount, total, itemCount };
}

export function isService(p) {
  return p?.type === "service";
}

export function isAccessoryItem(p) {
  const bucket = String(p?.tipo_principal || "").toLowerCase();
  if (bucket) return bucket === "accesorios";
  return String(p?.type || "").toLowerCase() === "accessory";
}

export function isFullDevice(p) {
  const bucket = String(p?.tipo_principal || "").toLowerCase();
  const sub = String(p?.subcategoria || "").toLowerCase();
  if (bucket) return bucket === "dispositivos" && sub === "dispositivo_completo";
  return String(p?.type || "").toLowerCase() === "device";
}

export function isActive(p) {
  return p?.active !== false;
}

export function num(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function effectivePrice(p) {
  const price = num(p?.price) ?? 0;
  const pct = num(p?.discount_percentage);
  if (p?.discount_active === true && pct && pct > 0) return price * (1 - pct / 100);
  return price;
}

export function displayCategory(p) {
  const c = p?.category;
  switch (c) {
    case "screen": return "Pantalla";
    case "battery": return "Bateria";
    case "charger": return "Cargador";
    case "cable": return "Cable";
    case "case": return "Funda";
    case "diagnostic": return "Diagnostico";
    default: return c ? c.charAt(0).toUpperCase() + c.slice(1).toLowerCase() : "Otro";
  }
}

export const TIPO_FILTERS = [
  { id: "all", label: "Todos" },
  { id: "product", label: "Piezas" },
  { id: "service", label: "Servicios" },
  { id: "accessory", label: "Accesorios" },
  { id: "device", label: "Dispositivos" },
];

export function matchesTipo(p, tipo) {
  switch (tipo) {
    case "all": return isAccessoryItem(p) || isFullDevice(p);
    case "product": return !isService(p) && String(p?.type || "").toLowerCase() !== "accessory";
    case "service": return isService(p);
    case "accessory": return isAccessoryItem(p);
    case "device": return isFullDevice(p);
    default: return true;
  }
}

export function categoriesFor(products, tipo) {
  const set = new Set();
  products.forEach((p) => { if (matchesTipo(p, tipo) && p.category) set.add(p.category); });
  return [...set].sort();
}

function offerLive(o) {
  if (o?.active === false) return false;
  if (o?.ends_at && new Date(o.ends_at).getTime() <= Date.now()) return false;
  return true;
}

function offerApplies(o, p) {
  if (!offerLive(o)) return false;
  if (o.device_brand || o.device_family || o.device_model_tag) return false;
  if (o.product_id) return p.id === o.product_id;
  if (o.category) return String(p.category || "").toLowerCase() === String(o.category).toLowerCase();
  return false;
}

function offerType(o) {
  return ["fixed", "percent", "combo", "amount"].includes(o?.offer_type) ? o.offer_type : "percent";
}

function offerPromo(o, base) {
  const v = num(o.value);
  switch (offerType(o)) {
    case "fixed": return v === null ? base : Math.max(0, v);
    case "percent": return v === null || v <= 0 ? base : Math.max(0, base * (1 - v / 100));
    case "amount": return v === null || v <= 0 ? base : Math.max(0, base - v);
    default: return base;
  }
}

function offerLabel(o) {
  if (o.label) return o.label;
  const t = offerType(o);
  return t === "fixed" ? "Precio especial" : t === "combo" ? "Combo" : "Descuento";
}

export function offerResolution(product, offers) {
  const price = num(product?.price) ?? 0;
  const pct = num(product?.discount_percentage);
  const productLevel = product?.discount_active === true && pct && pct > 0
    ? { promoPrice: effectivePrice(product), originalPrice: price, label: "Oferta", offerType: "percent" }
    : null;
  const matching = (offers || []).filter((o) => offerApplies(o, product));
  let tableLevel = null;
  if (matching.length) {
    const priority = (o) => (offerType(o) === "combo" ? price : offerPromo(o, price));
    const best = matching.reduce((a, b) => (priority(b) < priority(a) ? b : a));
    tableLevel = { promoPrice: offerPromo(best, price), originalPrice: price, label: offerLabel(best), offerType: offerType(best) };
  }
  if (productLevel && tableLevel) return productLevel.promoPrice <= tableLevel.promoPrice ? productLevel : tableLevel;
  return productLevel || tableLevel;
}

export function hasSavings(res) {
  return !!res && Math.max(0, res.originalPrice - res.promoPrice) > 0.001;
}

export function effectiveUnitPrice(product, offers) {
  const res = offerResolution(product, offers);
  if (hasSavings(res)) return res.promoPrice;
  return effectivePrice(product);
}

const SCREEN = new Set(["led", "oled", "incell", "amoled", "lcd", "tft", "display", "panel", "pantalla", "frame", "screen", "vivid", "soft", "hard", "refurb", "refurbished", "original", "aftermarket"]);
const BATTERY = new Set(["bat", "batt", "battery", "bateria", "batería", "pila"]);
const CHARGER = new Set(["charger", "cargador", "adaptador", "block", "brick", "watt"]);
const CABLE = new Set(["cable", "cord", "wire", "usb", "lightning", "tipoc", "typec"]);
const CASE = new Set(["case", "funda", "cover", "protector", "estuche"]);
const DIAG = new Set(["diag", "diagnostic", "diagnostico", "diagnóstico", "test"]);
const NEVER_SINGULAR = new Set(["plus", "ios", "gps", "nfc", "aos", "mas", "iphones"]);
const VARIANT_SUFFIXES = new Set(["promax", "pro", "plus", "mini", "air", "ultra", "max"]);

export function fold(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function singularize(token) {
  if (token.length <= 3 || NEVER_SINGULAR.has(token) || /\d/.test(token)) return token;
  return token.endsWith("s") ? token.slice(0, -1) : token;
}

export function searchTokens(query) {
  return fold(query).split(/\s+/).filter(Boolean).map(singularize);
}

function numericTokens(text) {
  return new Set((fold(text).match(/\d+/g) || []));
}

function variantKey(modelTag) {
  const f = fold(modelTag).replace(/ /g, "");
  if (!f) return null;
  return VARIANT_SUFFIXES.has(f) ? f : "other";
}

function variantInText(text) {
  const sq = ` ${fold(text).replace(/-/g, " ").replace(/\//g, " ").replace(/—/g, " ")} `;
  if (sq.includes(" pro max ") || sq.includes(" promax ")) return "promax";
  if (sq.includes(" pro ")) return "pro";
  if (sq.includes(" plus ") || sq.includes("+ ")) return "plus";
  if (sq.includes(" mini ")) return "mini";
  if (sq.includes(" air ")) return "air";
  if (sq.includes(" ultra ")) return "ultra";
  if (sq.includes(" max ")) return "max";
  return null;
}

function detectVariant(tokens) {
  const remaining = [...tokens];
  const removeWord = (word) => {
    let idx = remaining.indexOf(word);
    if (idx >= 0) { remaining.splice(idx, 1); return true; }
    idx = remaining.findIndex((t) => t.endsWith(word) && t.length > word.length);
    if (idx >= 0) {
      const stripped = remaining[idx].slice(0, -word.length);
      if (stripped) remaining[idx] = stripped;
      else remaining.splice(idx, 1);
      return true;
    }
    return false;
  };
  for (let i = 0; i + 1 < remaining.length; i += 1) {
    if (remaining[i] === "pro" && remaining[i + 1] === "max") {
      remaining.splice(i, 2);
      return { variant: "promax", remaining };
    }
  }
  for (const w of ["promax", "pro", "plus", "mini", "air", "ultra", "max"]) {
    if (removeWord(w)) return { variant: w, remaining };
  }
  return { variant: null, remaining };
}

function tokenMatches(token, name, cat, searchable, modelNumbers) {
  if (/^\d+$/.test(token)) return modelNumbers.has(token);
  if (searchable.includes(token)) return true;
  if (SCREEN.has(token) && (cat === "screen" || name.includes("pantalla") || name.includes("screen"))) return true;
  if (BATTERY.has(token) && (cat === "battery" || name.includes("bater") || name.includes("battery"))) return true;
  if (CHARGER.has(token) && (cat === "charger" || name.includes("cargador") || name.includes("charger"))) return true;
  if (CABLE.has(token) && (cat === "cable" || name.includes("cable"))) return true;
  if (CASE.has(token) && (cat === "case" || name.includes("funda") || name.includes("case"))) return true;
  if (DIAG.has(token) && (cat === "diagnostic" || name.includes("diagn"))) return true;
  return false;
}

export function productMatches(product, tokens) {
  if (!tokens.length) return true;
  const name = fold(product.name);
  const cat = fold(product.category);
  const searchable = [name, fold(product.sku), fold(product.barcode), cat, fold(displayCategory(product)), fold(product.device_brand), fold(product.device_family), fold(product.device_model_tag), fold(product.location)].join(" ");
  const modelNumbers = new Set([...numericTokens(product.name), ...numericTokens(product.device_family), ...numericTokens(product.device_model_tag)]);
  const { variant, remaining } = detectVariant(tokens);
  if (!remaining.every((t) => tokenMatches(t, name, cat, searchable, modelNumbers))) return false;
  const model = fold(product.device_model_tag);
  const named = `${name} ${fold(product.device_family)} ${model}`;
  if (variant) {
    const tagged = variantKey(model);
    if (tagged) return tagged === variant;
    return variantInText(named) === variant;
  }
  if (remaining.some((t) => /\d/.test(t))) {
    const vk = variantKey(model) ?? variantInText(named);
    return vk === null || vk === "other";
  }
  return true;
}

export function filterCatalog({ products, tipo, category, query }) {
  const tokens = searchTokens(query);
  return products.filter((p) => {
    if (!isActive(p) || !matchesTipo(p, tipo)) return false;
    if (category && p.category !== category) return false;
    if (!query) return true;
    if (tokens.length) return productMatches(p, tokens);
    return fold(p.name).includes(fold(query));
  });
}

export function isVIP(customer) {
  const tier = String(customer?.loyalty_tier || "").toLowerCase();
  if (["vip", "gold", "platinum"].includes(tier)) return true;
  return (Number(customer?.total_spent) || 0) >= 500;
}

export function customerDisplayName(customer) {
  return customer?.company_name || customer?.name || "Cliente";
}

export function initials(name) {
  const n = String(name || "").trim();
  if (!n) return "?";
  return n.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export function changeBreakdown(amount) {
  let cents = Math.round((Number(amount) || 0) * 100);
  const denoms = [[10000, "$100"], [5000, "$50"], [2000, "$20"], [1000, "$10"], [500, "$5"], [100, "$1"], [25, "25¢"], [10, "10¢"], [5, "5¢"], [1, "1¢"]];
  const out = [];
  denoms.forEach(([v, label]) => {
    const n = Math.floor(cents / v);
    if (n > 0) {
      out.push({ count: n, label });
      cents -= n * v;
    }
  });
  return out;
}

export function quickCashAmounts(total) {
  const t = Number(total) || 0;
  const vals = [20, 50, 100].map((step) => Math.ceil(t / step) * step).filter((v) => v >= t && v > 0);
  return [...new Set(vals)].sort((a, b) => a - b).slice(0, 3);
}

export function productThumb(p) {
  if (p?.image_url) return p.image_url;
  if (Array.isArray(p?.photo_urls) && p.photo_urls[0]) return p.photo_urls[0];
  return null;
}

function searchScore(product, tokens) {
  const name = fold(product.name);
  const cat = fold(product.category);
  const sku = fold(product.sku);
  const barcode = fold(product.barcode);
  const displayCat = fold(displayCategory(product));
  let total = 0;
  tokens.forEach((t) => {
    if (name.includes(t)) total += 3;
    else if (sku.includes(t) || barcode.includes(t)) total += 2;
    else if (cat.includes(t) || displayCat.includes(t)) total += 1;
    if (SCREEN.has(t) && (cat === "screen" || name.includes("pantalla") || name.includes("screen") || displayCat.includes("pantalla"))) total += 3;
    else if (BATTERY.has(t) && (cat === "battery" || name.includes("bater") || name.includes("battery"))) total += 3;
    else if (CHARGER.has(t) && (cat === "charger" || name.includes("cargador") || name.includes("charger"))) total += 3;
    else if (CABLE.has(t) && (cat === "cable" || name.includes("cable"))) total += 3;
    else if (CASE.has(t) && (cat === "case" || name.includes("funda") || name.includes("case"))) total += 3;
    else if (DIAG.has(t) && (cat === "diagnostic" || name.includes("diagn"))) total += 3;
  });
  return total;
}

export function rankedSearch(products, query) {
  const tokens = searchTokens(query);
  if (!tokens.length) return { results: products, partial: false };
  const strict = products.filter((p) => productMatches(p, tokens));
  if (strict.length) return { results: strict, partial: false };
  const loose = products.map((p) => ({ p, s: searchScore(p, tokens) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).map((x) => x.p);
  return { results: loose, partial: loose.length > 0 };
}
