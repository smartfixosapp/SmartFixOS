import { offerLive, offerType, offerPromoPrice, offerLabel } from "@/lib/inicioApi";
import { partMatchContext, scorePart, isServiceItem, isFullDeviceItem, effectivePrice } from "@/lib/wizard/helpers";

const clean = (v) => String(v || "").trim();
const norm = (v) => clean(v).toLowerCase();
const fold = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const CATEGORY_LABELS = { screen: "Pantalla", battery: "Bateria", charger: "Cargador", cable: "Cable", case: "Funda", diagnostic: "Diagnostico" };

function displayCategory(c) {
  const k = clean(c);
  if (!k) return "Otro";
  return CATEGORY_LABELS[k] || k.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, sp, ch) => sp + ch.toUpperCase());
}

export const offerIsDevice = (o) => !!(clean(o?.device_brand) || clean(o?.device_family) || clean(o?.device_model_tag));

export function offerDeviceLabel(o) {
  const parts = [clean(o?.device_family), clean(o?.device_model_tag)].filter(Boolean);
  return parts.length ? parts.join(" ") : clean(o?.device_brand);
}

export function offerDeviceCtx(sel) {
  return partMatchContext({
    category: sel?.category?.name,
    brand: sel?.brand?.name,
    family: sel?.family?.name,
    model: sel?.model?.name || sel?.customModelText,
  });
}

export function offerMatchesDevice(o, ctx) {
  if (!offerIsDevice(o) || !offerLive(o)) return false;
  if (!ctx.brand && !ctx.family && !ctx.model) return false;
  if (norm(o.device_brand) && norm(o.device_brand) !== ctx.brand) return false;
  if (norm(o.device_family) && norm(o.device_family) !== ctx.family) return false;
  if (norm(o.device_model_tag) && norm(o.device_model_tag) !== ctx.model) return false;
  return true;
}

export function offerMatchesProduct(o, product, ctx) {
  if (!offerMatchesDevice(o, ctx)) return false;
  if (!product?.id || isServiceItem(product) || isFullDeviceItem(product)) return false;
  if (scorePart(product, ctx) <= 0) return false;
  const tokens = fold(o.part_filter).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = fold(`${product.name} ${product.category} ${product.part_type} ${product.subcategoria} ${displayCategory(product.category)}`);
  return tokens.every((t) => hay.includes(t));
}

export function resolveDeviceOffer(product, offers, ctx) {
  if (!offers?.length || !product?.id) return null;
  const base = effectivePrice(product);
  const matching = offers.filter((o) => offerType(o) !== "combo" && offerMatchesProduct(o, product, ctx) && offerPromoPrice(o, base) < base - 0.001);
  if (!matching.length) return null;
  const best = matching.reduce((a, b) => (offerPromoPrice(b, base) < offerPromoPrice(a, base) ? b : a));
  return { offer: best, original: base, promo: offerPromoPrice(best, base), label: offerLabel(best) };
}

export const deviceOffersFor = (offers, ctx) => (offers || []).filter((o) => offerType(o) !== "combo" && offerMatchesDevice(o, ctx));

export function applyOfferToLine(line, res) {
  if (res) return { ...line, unitPrice: res.promo, originalPrice: res.original, offerId: res.offer.id, offerLabel: res.label };
  if (line.offerId) {
    const next = { ...line, unitPrice: line.originalPrice ?? line.unitPrice };
    delete next.originalPrice;
    delete next.offerId;
    delete next.offerLabel;
    return next;
  }
  return line;
}

export const lineOfferSavings = (l) => (l.originalPrice !== undefined && l.originalPrice - l.unitPrice > 0.001 ? (l.originalPrice - l.unitPrice) * l.quantity : 0);
