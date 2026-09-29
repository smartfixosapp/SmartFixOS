import { supabase } from "../../../../lib/supabase-client.js";
import { authJsonHeaders } from "@/lib/apiUrl";
import { EMAIL_TEMPLATE_DEFAULTS, ABANDONMENT_DEFAULT_TERMS } from "@/lib/emailTemplateDefaults";
import { statusInfo, NON_MAILABLE_STATUSES } from "@/lib/orderStatus";

const DENO_BASE = "https://smartfixos.onrender.com";
const STATUS_TEMPLATE_ID = {
  intake: "intake",
  diagnosing: "diagnosing",
  in_progress: "in_progress",
  waiting_customer: "waiting_customer",
  waiting_parts: "waiting_parts",
  part_arrived_waiting_device: "part_arrived",
  ready_for_pickup: "ready_for_pickup",
  delivered: "delivered",
  cancelled: "cancelled",
  not_repairable: "not_repairable",
  abandoned: "abandoned",
};

function strings(lang) {
  const t = (es, en) => (lang === "en" ? en : es);
  return {
    defaultCustomerName: t("Cliente", "Customer"),
    greeting: (n) => t(`Hola ${n}, `, `Hi ${n}, `),
    anyQuestionsLine: t("Cualquier duda respondiendo este correo y te ayudamos.", "Any questions, just reply to this email and we'll help you out."),
    sentBy: (n) => t(`Enviado por ${n} · Powered by Archilla OS`, `Sent by ${n} · Powered by Archilla OS`),
    equipmentTitle: t("EQUIPO", "DEVICE"),
    orderLabel: t("Orden", "Order"),
    typeLabel: t("Tipo", "Type"),
    brandLabel: t("Marca", "Brand"),
    familyLabel: t("Familia", "Family"),
    modelLabel: t("Modelo", "Model"),
    colorLabel: t("Color", "Color"),
    serialLabel: "Serial / IMEI",
    reportedProblemTitle: t("PROBLEMA REPORTADO", "REPORTED ISSUE"),
    shopMessageTitle: t("MENSAJE DEL TALLER", "MESSAGE FROM THE SHOP"),
    advisoriesTitle: t("IMPORTANTE — LO QUE TE ADVERTIMOS", "IMPORTANT — WHAT WE FLAGGED"),
    reportedBy: (n) => t(`Informado por ${n}`, `Reported by ${n}`),
    signatureTitle: t("FIRMA DEL CLIENTE", "CUSTOMER SIGNATURE"),
    signatureAlt: t("Firma del cliente", "Customer signature"),
    signatureNote: t("Firma registrada al recibir el equipo en el taller.", "Signature captured when the device was received at the shop."),
    abandonmentPolicyTitle: t("Política de Abandono y Almacenaje", "Abandonment & Storage Policy"),
    repairWarrantyTitle: t("Garantía de Reparación", "Repair Warranty"),
    salesTermsTitle: t("Condiciones de Venta", "Sales Terms"),
    allPhotosHeading: t("FOTOS DEL EQUIPO", "DEVICE PHOTOS"),
    repairWorkHeading: t("EL TRABAJO QUE HICIMOS", "THE WORK WE DID"),
    receivedHowHeading: t("CÓMO RECIBIMOS TU EQUIPO", "HOW WE RECEIVED YOUR DEVICE"),
    whatWeFoundHeading: t("LO QUE ENCONTRAMOS", "WHAT WE FOUND"),
    returnPhotosHeading: t("Fotos al recibir el equipo de vuelta", "Photos of the device on its return"),
    morePhotos: (n) => t(`+ ${n} foto(s) más en tu orden`, `+ ${n} more photo(s) in your order`),
    beforeAfterHeading: t("CÓMO LLEGÓ Y CÓMO TE LO ENTREGAMOS", "HOW IT ARRIVED AND HOW WE RETURNED IT"),
    arrivedLabel: t("ASÍ LLEGÓ", "HOW IT ARRIVED"),
    deliveredLabel: t("ASÍ TE LO ENTREGAMOS", "HOW WE RETURNED IT"),
    photoAlt: t("Foto del equipo", "Photo of the device"),
    itemsTitle: t("PIEZAS Y SERVICIOS", "PARTS & SERVICES"),
    colItem: "Item",
    colQty: t("Cant", "Qty"),
    colPrice: t("Precio", "Price"),
    colTotal: "Total",
    summaryTitle: t("RESUMEN", "SUMMARY"),
    laborLabel: t("Mano de obra", "Labor"),
    totalLabel: "Total",
    paidLabel: t("Pagado", "Paid"),
    pendingBalanceLabel: t("Saldo pendiente", "Balance due"),
    depositAlreadyPaidTitle: t("DEPÓSITO YA PAGADO", "DEPOSIT ALREADY PAID"),
    depositNotRefundableLabel: t("No reembolsable — cubre el diagnóstico", "Non-refundable — covers the diagnostic"),
    pickupHoursTitle: t("HORARIO PARA RECOGER", "PICKUP HOURS"),
    closedLabel: t("Cerrado", "Closed"),
    reviewShopFallback: t("nosotros", "us"),
    reviewSubject: (shop) => t(`¿Nos dejas una reseña? · ${shop}`, `Would you leave us a review? · ${shop}`),
    reviewTitle: (n) => t(`¡Gracias por tu visita, ${n}!`, `Thanks for your visit, ${n}!`),
    reviewLine: (shop, platform, url) => t(
      `Gracias por confiar en ${shop}. Si tienes un momento, nos ayudaría mucho que dejaras una reseña en ${platform}: ${url}`,
      `Thank you for trusting ${shop}. If you have a moment, it would help us a lot if you left a review on ${platform}: ${url}`
    ),
    paymentMethod: (m) => (m === "card" ? t("Tarjeta", "Card") : m === "ath_movil" ? "ATH Móvil" : t("Efectivo", "Cash")),
    paymentFinalLine: (amount, method) => t(`Monto final: ${amount} (${method}). Tu orden queda completamente pagada.`, `Final amount: ${amount} (${method}). Your order is now paid in full.`),
    depositReceivedLine: (amount, method) => t(`Recibimos tu depósito de ${amount} (${method}) para tu reparación.`, `We received your deposit of ${amount} (${method}) toward your repair.`),
    depositNotAFullPaymentNote: t("Este es un abono — no es el pago completo. Te avisaremos el total cuando terminemos el diagnóstico.", "This is a partial deposit — not the full payment. We'll let you know the total once diagnosis is done."),
    paymentReceiptTitle: t("RECIBO DE PAGO", "PAYMENT RECEIPT"),
    depositReceiptTitle: t("RECIBO DE DEPÓSITO", "DEPOSIT RECEIPT"),
    todaysPaymentLabel: t("Pago de hoy", "Today's payment"),
    todaysDepositLabel: t("Depósito de hoy", "Today's deposit"),
    methodLabel: t("Método", "Method"),
    dateLabel: t("Fecha", "Date"),
    referenceLabel: t("Referencia", "Reference"),
    orderTotalLabel: t("Total orden", "Order total"),
    paidToDateLabel: t("Pagado acumulado", "Paid to date"),
    orderPaidOffLabel: t("✓ Orden saldada", "✓ Order paid in full"),
    pendingQuoteLabel: t("Pendiente de cotizar", "Quote pending"),
    refundReceiptTitle: t("REEMBOLSO", "REFUND"),
    refundAmountLabel: t("Monto devuelto", "Amount refunded"),
    refundReasonLabel: t("Motivo", "Reason"),
    paidToDateNowLabel: t("Pagado acumulado ahora", "Paid to date now"),
    refundedLine: (amount, method) => t(`Te devolvimos ${amount} a tu método original de pago (${method}).`, `We refunded ${amount} back to your original payment method (${method}).`),
    saleReceiptTitle: t("Recibo de Venta", "Sales Receipt"),
    saleReceiptSubject: (shop) => t(`Recibo de venta · ${shop}`, `Sales receipt · ${shop}`),
    thanksForPurchase: (n) => t(`Hola ${n}, gracias por tu compra.`, `Hi ${n}, thanks for your purchase.`),
    colProduct: t("Producto", "Product"),
    colQtyShort: t("Cant.", "Qty"),
    taxLabel: t("IVU", "Sales tax (IVU)"),
    discountLabel: t("Descuento", "Discount"),
    paymentMethodLabel: t("Método de pago", "Payment method"),
    receivedLabel: t("Recibido", "Received"),
    changeLabel: t("Cambio", "Change"),
    warrantyTitle: t("GARANTÍA", "WARRANTY"),
    conditionsTitle: t("CONDICIONES", "TERMS"),
    abandonmentNoticeSubject: (n) => t(`Aviso: recoge tu equipo · Orden ${n}`, `Reminder: pick up your device · Order ${n}`),
    abandonmentNoticeTitle: t("Equipo pendiente de recoger", "Device waiting for pickup"),
    abandonmentNoticeLine: (days, fee) => t(
      `tu equipo lleva ${days} días listo para recoger. Por favor pásalo a buscar pronto. Pasado el plazo aplica un cargo diario de ${fee} por almacenaje y, de no reclamarse, el equipo podría considerarse abandonado según nuestros términos.`,
      `your device has been ready for pickup for ${days} days. Please come pick it up soon. After the deadline a daily storage fee of ${fee} applies and, if unclaimed, the device may be considered abandoned under our terms.`
    ),
  };
}

function escape(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return escape(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function isValidEmail(email) {
  const e = String(email || "");
  if (!e || e.includes(" ")) return false;
  const parts = e.split("@");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const domain = parts[1];
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".");
}

export function photoThumbURL(url, width = 240) {
  if (!url || !url.includes("/storage/v1/object/") || url.includes("/storage/v1/render/image/")) return url;
  const transformed = url.replace("/storage/v1/object/", "/storage/v1/render/image/");
  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}width=${width}&quality=70&resize=contain`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function orderTotal(order) {
  if (order?.cost_estimate != null && order.cost_estimate !== "") return num(order.cost_estimate);
  if (order?.labor_cost != null && order.labor_cost !== "") return num(order.labor_cost);
  return 0;
}

export function remainingBalance(order) {
  if (order?.balance_due != null && order.balance_due !== "") return num(order.balance_due);
  return Math.max(0, orderTotal(order) - num(order?.amount_paid));
}

export function tenantEmailFromName(tenant) {
  if (tenant?.name) return tenant.name;
  if (tenant?.admin_name) return tenant.admin_name;
  return "Mi taller";
}

export function formatCurrency(tenant, amount) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: tenant?.currency || "USD" }).format(num(amount));
  } catch {
    return `$${num(amount).toFixed(2)}`;
  }
}

function tenantSettings(tenant) {
  return tenant?.settings && typeof tenant.settings === "object" ? tenant.settings : {};
}

function resolveTemplate(id, tenant, order, lang) {
  const def = EMAIL_TEMPLATE_DEFAULTS[id];
  const defaults = def
    ? { subject: def.subject[lang] || def.subject.es, heroTitle: def.hero_title[lang] || def.hero_title.es, heroLine: def.hero_line[lang] || def.hero_line.es, isActive: def.isActive }
    : { subject: "", heroTitle: "", heroLine: "", isActive: true };
  const override = tenantSettings(tenant).email_templates?.[id];
  let merged = defaults;
  if (override && typeof override === "object") {
    const s = String(override.subject || "").trim();
    const t = String(override.hero_title || "").trim();
    const l = String(override.hero_line || "").trim();
    merged = {
      subject: s ? override.subject : defaults.subject,
      heroTitle: t ? override.hero_title : defaults.heroTitle,
      heroLine: l ? override.hero_line : defaults.heroLine,
      isActive: override.isActive !== false,
    };
  }
  const number = order.order_number || order.id || "-";
  return {
    ...merged,
    subject: String(merged.subject).replaceAll("{order_number}", number).replaceAll("{number}", number),
  };
}

async function customerLanguage(order) {
  if (!order?.customer_id) return "es";
  const { data } = await supabase.from("customer").select("preferred_language").eq("id", order.customer_id).maybeSingle();
  return data?.preferred_language === "en" ? "en" : "es";
}

function photosByStage(order) {
  const urls = Array.isArray(order.device_photos) ? order.device_photos : [];
  const meta = Array.isArray(order.photos_metadata) ? order.photos_metadata : [];
  const byUrl = new Map();
  meta.forEach((m) => { if (m?.url && !byUrl.has(m.url)) byUrl.set(m.url, m); });
  const buckets = {};
  urls.forEach((u) => {
    const st = byUrl.get(u)?.status || "intake";
    (buckets[st] = buckets[st] || []).push(u);
  });
  return buckets;
}

function repairEvidenceUrls(order) {
  const meta = Array.isArray(order.photos_metadata) ? order.photos_metadata : [];
  const since = order.last_reopen_at ? new Date(order.last_reopen_at).getTime() : null;
  return new Set(
    meta
      .filter((m) => m?.url && (m.status === "in_progress" || m.status === "ready_for_pickup"))
      .filter((m) => !since || (m.taken_at && new Date(m.taken_at).getTime() >= since))
      .map((m) => m.url)
  );
}

function photoIMG(url, size, width, s) {
  return `<img src='${escapeAttr(photoThumbURL(url, size))}' alt='${escapeAttr(s.photoAlt)}' style='width:${width};height:140px;object-fit:cover;border-radius:10px;display:block;background:#f0f0f0'>`;
}

function photoGrid(urls, heading, s) {
  if (!urls.length) return null;
  const imgs = urls.slice(0, 8).map((u) => `<span style='display:inline-block;margin:4px'>${photoIMG(u, 400, "140px", s)}</span>`).join("");
  const extra = urls.length > 8 ? `<div style='font-size:12px;color:#999;margin-top:6px'>${escape(s.morePhotos(urls.length - 8))}</div>` : "";
  return `<div style='margin-top:18px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:8px'>${escape(heading)}</div><div style='font-size:0;line-height:0'>${imgs}</div>${extra}</div>`;
}

function renderPhotos(order, scope, s) {
  const all = Array.isArray(order.device_photos) ? order.device_photos : [];
  if (!all.length || !scope || scope.kind === "none") return null;
  const buckets = photosByStage(order);
  if (scope.kind === "all") return photoGrid(all, s.allPhotosHeading, s);
  if (scope.kind === "stages") return photoGrid(scope.statuses.flatMap((st) => buckets[st] || []), scope.heading, s);
  if (scope.kind === "beforeAfter") {
    const evidence = repairEvidenceUrls(order);
    const intake = buckets.intake || [];
    const before = intake.length ? intake[intake.length - 1] : null;
    const lastIn = (list) => [...(list || [])].reverse().find((u) => evidence.has(u)) || null;
    const after = lastIn(buckets.ready_for_pickup) || lastIn(buckets.in_progress);
    let out = "";
    if (before || after) {
      const cell = (url, label, color) => url
        ? `<td style='width:50%;padding:0 4px;vertical-align:top'><div style='font-size:10px;font-weight:700;letter-spacing:0.5px;color:${color};margin-bottom:6px'>${label}</div>${photoIMG(url, 500, "100%", s)}</td>`
        : "<td style='width:50%'></td>";
      out += `<div style='margin-top:18px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:8px'>${escape(s.beforeAfterHeading)}</div><table style='width:100%;border-collapse:collapse'><tr>${cell(before, s.arrivedLabel, "#9a5b4c")}${cell(after, s.deliveredLabel, "#2b6b4d")}</tr></table></div>`;
    }
    if (scope.includeRepair) {
      const grid = photoGrid(buckets.in_progress || [], s.repairWorkHeading, s);
      if (grid) out += grid;
    }
    return out || null;
  }
  return null;
}

function sectionTable(title, rows) {
  const body = rows.map(([k, v]) => `<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(k)}</td><td style='padding:6px 0;text-align:right;font-size:13px;color:#111'>${escape(v)}</td></tr>`).join("");
  return `<div style='margin-top:18px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:6px'>${escape(title)}</div><table style='width:100%;border-collapse:collapse;border-top:1px solid #eee'>${body}</table></div>`;
}

function renderDevice(order, s) {
  const rows = [[s.orderLabel, order.order_number || order.id || "-"]];
  [[s.typeLabel, order.device_type], [s.brandLabel, order.device_brand], [s.familyLabel, order.device_family], [s.modelLabel, order.device_model], [s.colorLabel, order.device_color], [s.serialLabel, order.device_serial]]
    .forEach(([k, v]) => { if (v) rows.push([k, v]); });
  return rows.length > 1 ? sectionTable(s.equipmentTitle, rows) : null;
}

function renderProblem(order, s) {
  const p = String(order.initial_problem || "").trim();
  if (!p) return null;
  return `<div style='margin-top:18px;padding:14px;background:#FFF8E5;border-radius:10px;border-left:3px solid #F5A623'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#A06A00;margin-bottom:6px'>${escape(s.reportedProblemTitle)}</div><div style='font-size:14px;color:#333;line-height:1.4'>${escape(p)}</div></div>`;
}

function renderNote(order, s) {
  const n = String(order.status_note || "").trim();
  if (!n) return null;
  return `<div style='margin-top:18px;padding:14px;background:#EFF6FF;border-radius:10px;border-left:3px solid #FF5722'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#1A5BC4;margin-bottom:6px'>${escape(s.shopMessageTitle)}</div><div style='font-size:14px;color:#333;line-height:1.4'>${escape(n)}</div></div>`;
}

function renderAdvisories(order, s) {
  const entries = (Array.isArray(order.status_history) ? order.status_history : []).filter((e) => e?.kind === "customer_advisory");
  if (!entries.length) return null;
  const items = entries.map((e) => String(e.note || "").trim()).filter(Boolean).map((n) => `<p style='margin:0 0 7px'>• ${escape(n)}</p>`);
  if (!items.length) return null;
  const by = String(entries[entries.length - 1]?.changed_by || "").trim();
  const byLine = by ? `<div style='font-size:11px;color:#8a7c60;margin-top:10px;padding-top:8px;border-top:1px solid #EFE0C0'>${escape(s.reportedBy(by))}</div>` : "";
  return `<div style='margin-top:18px;padding:14px;background:#FFF7E6;border-radius:10px;border-left:3px solid #E0A030'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#9A6A0C;margin-bottom:8px'>${escape(s.advisoriesTitle)}</div><div style='font-size:14px;color:#333;line-height:1.55'>${items.join("")}</div>${byLine}</div>`;
}

function renderSignature(order, s) {
  const url = String(order.device_security?.signature_url || "").trim();
  if (!url) return null;
  return `<div style='margin-top:18px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:8px'>${escape(s.signatureTitle)}</div><div style='background:#fff;border:1px solid #eee;border-radius:10px;padding:10px;text-align:center'><img src='${escapeAttr(photoThumbURL(url, 500))}' alt='${escapeAttr(s.signatureAlt)}' style='max-width:260px;width:100%;height:auto;display:inline-block'></div><div style='font-size:11px;color:#999;margin-top:6px'>${escape(s.signatureNote)}</div></div>`;
}

function abandonmentTerms(tenant, lang) {
  const settings = tenantSettings(tenant);
  const custom = String(settings.policies?.abandonment_terms || "").trim();
  if (custom) return custom;
  const base = ABANDONMENT_DEFAULT_TERMS[lang] || ABANDONMENT_DEFAULT_TERMS.es;
  const p = settings.abandonment_policy || {};
  const abandonDays = p.abandon_days ?? 30;
  const claimTotal = p.claim_total_days ?? 90;
  const fee = num(p.daily_fee ?? 3);
  if (abandonDays === 30 && claimTotal === 90 && fee === 3) return base;
  const feeStr = `$${fee.toFixed(2)}`;
  return base + (lang === "en"
    ? ` (At this shop: ${abandonDays} days to pick up, ${feeStr}/day storage fee, ${claimTotal} days total claim window.)`
    : ` (En este taller: ${abandonDays} días para recoger, cargo de ${feeStr}/día, ${claimTotal} días para reclamo total.)`);
}

function renderTerms(tenant, kinds, lang, s) {
  const p = tenantSettings(tenant).policies || {};
  const parts = [];
  kinds.forEach((k) => {
    if (k === "abandonment") parts.push([s.abandonmentPolicyTitle, abandonmentTerms(tenant, lang)]);
    if (k === "repairWarranty") {
      const rw = String(p.repair_warranty || "").trim();
      if (rw) parts.push([s.repairWarrantyTitle, rw]);
    }
    if (k === "sales") {
      const body = String(p.sales_terms || "").trim() || String(p.sales_warranty || "").trim();
      if (body) parts.push([s.salesTermsTitle, body]);
    }
  });
  if (!parts.length) return null;
  const inner = parts.map(([title, body]) => `<div style='margin-bottom:10px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#C2410C;margin-bottom:4px'>${escape(title)}</div><div style='font-size:13px;color:#333;line-height:1.5'>${escape(body).replace(/\n/g, "<br>")}</div></div>`).join("");
  return `<div style='margin-top:18px;padding:14px;background:#FFF7ED;border-radius:10px;border-left:3px solid #F97316'>${inner}</div>`;
}

function formatHHmm(raw) {
  const [h, m] = String(raw || "").split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return raw;
  const period = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, "0")}${period}`;
}

function renderPickupHours(tenant, lang, s) {
  const hours = tenantSettings(tenant).business_hours;
  if (!hours || typeof hours !== "object") return null;
  const keys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const abbr = lang === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  if (!keys.every((k) => hours[k])) return null;
  const label = (d) => (d.closed ? s.closedLabel : `${formatHHmm(d.open)}–${formatHHmm(d.close)}`);
  const groups = [];
  let i = 0;
  while (i < keys.length) {
    const l = label(hours[keys[i]]);
    let j = i;
    while (j + 1 < keys.length && label(hours[keys[j + 1]]) === l) j += 1;
    groups.push(`${j > i ? `${abbr[i]}-${abbr[j]}` : abbr[i]}: ${l}`);
    i = j + 1;
  }
  const addr = tenant?.address ? `<div style='font-size:11.5px;color:#666;margin-top:4px'>${escape(tenant.address)}</div>` : "";
  return `<div style='margin-top:18px;padding:14px;background:#EFF6FF;border-radius:10px;border-left:3px solid #FF5722'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#1A5BC4;margin-bottom:6px'>${escape(s.pickupHoursTitle)}</div><div style='font-size:13px;color:#333'>${escape(groups.join(" · "))}</div>${addr}</div>`;
}

function renderDepositStatus(order, tenant, s) {
  const paid = num(order.amount_paid);
  if (paid <= 0) return null;
  return `<div style='margin-top:18px;padding:14px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#0AA94B;margin-bottom:8px'>${escape(s.depositAlreadyPaidTitle)}</div><table style='width:100%;border-collapse:collapse;font-size:13px'><tr><td style='padding:4px 0;color:#666'>${escape(s.paidLabel)}</td><td style='padding:4px 0;text-align:right;font-weight:600'>${escape(formatCurrency(tenant, paid))}</td></tr></table><div style='font-size:12px;color:#B45309;margin-top:6px;font-weight:600'>${escape(s.depositNotRefundableLabel)}</div></div>`;
}

function renderItems(order, tenant, s) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  if (!items.length) return null;
  const parts = items.filter((i) => i?.type !== "discount");
  const discount = items.find((i) => i?.type === "discount");
  if (!parts.length && !discount) return null;
  const rows = parts.map((i) => {
    const qty = parseInt(i.quantity ?? 1, 10) || 1;
    const price = num(i.price);
    return `<tr><td style='padding:8px 6px;font-size:13px;color:#333'>${escape(i.name || "Item")}</td><td style='padding:8px 6px;font-size:13px;color:#666;text-align:center'>×${qty}</td><td style='padding:8px 6px;font-size:13px;color:#333;text-align:right'>${escape(formatCurrency(tenant, price))}</td><td style='padding:8px 6px;font-size:13px;color:#111;text-align:right;font-weight:600'>${escape(formatCurrency(tenant, qty * price))}</td></tr>`;
  }).join("");
  const dRow = discount
    ? `<tr><td colspan='3' style='padding:8px 6px;font-size:13px;color:#E5484D'>${escape(discount.name || "")}</td><td style='padding:8px 6px;font-size:13px;color:#E5484D;text-align:right;font-weight:600'>${escape(formatCurrency(tenant, num(discount.price)))}</td></tr>`
    : "";
  return `<div style='margin-top:18px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:8px'>${escape(s.itemsTitle)}</div><table style='width:100%;border-collapse:collapse;border:1px solid #eee;border-radius:10px;overflow:hidden'><thead><tr style='background:#F8F9FA'><th style='padding:8px 6px;font-size:11px;color:#666;text-align:left;font-weight:600'>${escape(s.colItem)}</th><th style='padding:8px 6px;font-size:11px;color:#666;text-align:center;font-weight:600'>${escape(s.colQty)}</th><th style='padding:8px 6px;font-size:11px;color:#666;text-align:right;font-weight:600'>${escape(s.colPrice)}</th><th style='padding:8px 6px;font-size:11px;color:#666;text-align:right;font-weight:600'>${escape(s.colTotal)}</th></tr></thead><tbody>${rows}${dRow}</tbody></table></div>`;
}

function renderFinancial(order, tenant, s) {
  const total = orderTotal(order);
  const labor = num(order.labor_cost);
  const paid = num(order.amount_paid);
  const balance = remainingBalance(order);
  if (!(total > 0 || labor > 0 || paid > 0)) return null;
  const rows = [];
  if (labor > 0) rows.push(`<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(s.laborLabel)}</td><td style='padding:6px 0;text-align:right;font-size:13px'>${escape(formatCurrency(tenant, labor))}</td></tr>`);
  if (total > 0) rows.push(`<tr><td style='padding:6px 0;color:#111;font-size:14px;font-weight:600'>${escape(s.totalLabel)}</td><td style='padding:6px 0;text-align:right;font-size:14px;font-weight:600'>${escape(formatCurrency(tenant, total))}</td></tr>`);
  if (paid > 0) rows.push(`<tr><td style='padding:6px 0;color:#0AA94B;font-size:13px'>${escape(s.paidLabel)}</td><td style='padding:6px 0;text-align:right;color:#0AA94B;font-size:13px;font-weight:600'>${escape(formatCurrency(tenant, paid))}</td></tr>`);
  if (balance > 0) rows.push(`<tr><td style='padding:6px 0;color:#E5484D;font-size:14px;font-weight:600'>${escape(s.pendingBalanceLabel)}</td><td style='padding:6px 0;text-align:right;color:#E5484D;font-size:14px;font-weight:700'>${escape(formatCurrency(tenant, balance))}</td></tr>`);
  return `<div style='margin-top:18px;padding:14px;background:#F8F9FA;border-radius:10px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:8px'>${escape(s.summaryTitle)}</div><table style='width:100%;border-collapse:collapse'>${rows.join("")}</table></div>`;
}

function renderSocial(tenant) {
  const social = tenantSettings(tenant).social;
  if (!social) return "";
  const links = [];
  if (social.facebook) links.push(`<a href='${escapeAttr(social.facebook)}' style='color:#1877F2;text-decoration:none;margin:0 6px'>Facebook</a>`);
  if (social.instagram) links.push(`<a href='${escapeAttr(social.instagram)}' style='color:#E4405F;text-decoration:none;margin:0 6px'>Instagram</a>`);
  if (social.google_reviews) links.push(`<a href='${escapeAttr(social.google_reviews)}' style='color:#EA4335;text-decoration:none;margin:0 6px'>Google</a>`);
  if (social.yelp) links.push(`<a href='${escapeAttr(social.yelp)}' style='color:#D32323;text-decoration:none;margin:0 6px'>Yelp</a>`);
  if (social.website) links.push(`<a href='${escapeAttr(social.website)}' style='color:#FF5722;text-decoration:none;margin:0 6px'>Web</a>`);
  return links.length ? `<div style='text-align:center;margin-top:14px;font-size:13px;line-height:2'>${links.join(" · ")}</div>` : "";
}

export function renderOrderEmailHTML({ order, tenant, heroTitle, heroLine, sections, lang = "es", customBlock = null }) {
  const s = strings(lang);
  const customer = escape(order.customer_name || s.defaultCustomerName);
  const blocks = [];
  sections.forEach((sec) => {
    let html = null;
    if (sec.type === "deviceDetails") html = renderDevice(order, s);
    if (sec.type === "initialProblem") html = renderProblem(order, s);
    if (sec.type === "photos") html = renderPhotos(order, sec.scope, s);
    if (sec.type === "statusNote") html = renderNote(order, s);
    if (sec.type === "lineItems") html = renderItems(order, tenant, s);
    if (sec.type === "financialSummary") html = renderFinancial(order, tenant, s);
    if (sec.type === "advisories") html = renderAdvisories(order, s);
    if (sec.type === "customerSignature") html = renderSignature(order, s);
    if (sec.type === "terms") html = renderTerms(tenant, sec.kinds, lang, s);
    if (sec.type === "pickupHours") html = renderPickupHours(tenant, lang, s);
    if (sec.type === "depositStatus") html = renderDepositStatus(order, tenant, s);
    if (html) blocks.push(html);
  });
  if (customBlock) blocks.push(customBlock);
  const fromName = tenantEmailFromName(tenant);
  const phoneLine = tenant?.admin_phone ? `<br><span style='color:#999;font-size:12px'>Tel. ${escape(tenant.admin_phone)}</span>` : "";
  const addressLine = tenant?.address ? `<br><span style='color:#999;font-size:12px'>${escape(tenant.address)}</span>` : "";
  const emailLine = tenant?.email ? `<br><span style='color:#999;font-size:12px'>${escape(tenant.email)}</span>` : "";
  const logo = tenant?.logo_url ? `<img src='${escapeAttr(tenant.logo_url)}' alt='${escape(fromName)}' style='max-height:60px;max-width:200px;object-fit:contain;margin-bottom:12px;display:block'>` : "";
  return `<!doctype html>
<html><body style='margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111'>
  <div style='max-width:640px;margin:0 auto;padding:24px'>
    <div style='background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04)'>
      ${logo}
      <div style='font-size:18px;font-weight:700;color:#FF5722;margin-bottom:18px'>${escape(fromName)}</div>
      <div style='font-size:20px;font-weight:700;color:#111;margin-bottom:6px;line-height:1.3'>${escape(heroTitle)}</div>
      <div style='font-size:14px;color:#444;margin-bottom:20px;line-height:1.5'>${s.greeting(customer)}${escape(heroLine)}</div>
      ${blocks.join("\n")}
      <div style='margin-top:28px;padding-top:18px;border-top:1px solid #eee;font-size:13px;color:#666;line-height:1.5'>
        ${escape(s.anyQuestionsLine)}
        ${phoneLine}
        ${emailLine}
        ${addressLine}
      </div>
      ${renderSocial(tenant)}
    </div>
    <div style='text-align:center;font-size:11px;color:#999;margin-top:14px'>
      ${escape(s.sentBy(fromName))}
    </div>
  </div>
</body></html>`;
}

async function logEmail({ tenantId, to, subject, html, fromName, ok, error }) {
  if (!tenantId) return;
  const row = {
    tenant_id: tenantId,
    to_email: to,
    subject,
    body_html: html,
    status: ok ? "sent" : "failed",
    created_by: "Web",
    created_by_id: "web",
  };
  if (fromName) row.from_name = fromName;
  if (error) row.error_message = String(error).slice(0, 800);
  if (ok) row.sent_at = new Date().toISOString();
  await supabase.from("email_log").insert(row);
}

async function postEmail(payload) {
  const doFetch = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);
    try {
      return await fetch(`${DENO_BASE}/sendEmailInternal`, {
        method: "POST",
        headers: await authJsonHeaders(),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await doFetch();
  } catch (e) {
    if (e?.name !== "AbortError") throw e;
    await new Promise((r) => setTimeout(r, 2000));
    return doFetch();
  }
}

async function sendRawCore({ to, subject, html, replyTo, fromName }) {
  const cleanTo = String(to || "").trim();
  if (!isValidEmail(cleanTo)) {
    throw new Error(`Email del cliente inválido ("${cleanTo.slice(0, 60)}") — corrígelo en la ficha del cliente.`);
  }
  const safeName = fromName ? String(fromName).replace(/"/g, "'") : "Archilla OS";
  const payload = { to: cleanTo, subject, body: html, from_name: safeName, from: `${safeName} <noreply@smartfixos.com>` };
  const rt = String(replyTo || "").trim();
  if (rt.includes("@")) payload.replyTo = rt;
  const res = await postEmail(payload);
  const text = await res.text().catch(() => "");
  let reply = null;
  try { reply = JSON.parse(text); } catch { reply = null; }
  if (res.status === 500) {
    if (reply?.error) throw new Error(reply.error);
    return true;
  }
  if (!res.ok) throw new Error(reply?.error || text.slice(0, 200) || `Error ${res.status}`);
  if (reply) {
    if (reply.error) {
      if (reply.error.includes("validation_error") || (reply.error.includes("Invalid") && reply.error.includes("to"))) {
        throw new Error("Email del cliente inválido — corrígelo en la ficha del cliente.");
      }
      throw new Error(reply.error);
    }
    return reply.status === "sent";
  }
  throw new Error(`Respuesta inesperada del servidor: ${text.slice(0, 200) || "(vacío)"}`);
}

export async function sendRawEmail({ tenantId, to, subject, html, replyTo, fromName }) {
  try {
    const ok = await sendRawCore({ to, subject, html, replyTo, fromName });
    await logEmail({ tenantId, to, subject, html, fromName, ok, error: ok ? null : "El servidor no confirmó el envío" });
    return ok;
  } catch (e) {
    await logEmail({ tenantId, to, subject, html, fromName, ok: false, error: e?.message || String(e) });
    throw e;
  }
}

async function sendOrderEmail({ order, tenant, lang, subject, heroTitle, heroLine, sections }) {
  const email = String(order.customer_email || "").trim();
  if (!email) throw new Error("El cliente no tiene email registrado.");
  const html = renderOrderEmailHTML({ order, tenant, heroTitle, heroLine, sections, lang });
  return sendRawEmail({ tenantId: tenant?.id || order.tenant_id, to: email, subject, html, replyTo: tenant?.email, fromName: tenantEmailFromName(tenant) });
}

function sectionsForStatus(status, s, opts = {}) {
  const D = { type: "deviceDetails" };
  const P = { type: "initialProblem" };
  const N = { type: "statusNote" };
  const L = { type: "lineItems" };
  const F = { type: "financialSummary" };
  const A = { type: "advisories" };
  const SIG = { type: "customerSignature" };
  const photos = (scope) => ({ type: "photos", scope });
  const terms = (...kinds) => ({ type: "terms", kinds });
  switch (status) {
    case "intake": return [D, P, photos({ kind: "all" }), A, L, F, SIG, terms("repairWarranty", "sales", "abandonment")];
    case "diagnosing": return [D, P, photos({ kind: "all" }), A];
    case "in_progress": return [D, N, A, L, F];
    case "waiting_customer": return [D, N, A, F];
    case "waiting_parts":
    case "part_arrived_waiting_device": return [D, N, A];
    case "ready_for_pickup": return [D, L, F, { type: "pickupHours" }, terms("abandonment")];
    case "delivered": return [D, photos(opts.photoScope || { kind: "none" }), A, L, F, SIG, terms("repairWarranty", "sales")];
    case "cancelled": return [D, photos(opts.includeIntakePhotos ? { kind: "stages", statuses: ["intake"], heading: s.receivedHowHeading } : { kind: "none" }), N, { type: "depositStatus" }, terms("abandonment")];
    case "not_repairable": return [D, photos({ kind: "stages", statuses: ["diagnosing", "not_repairable"], heading: s.whatWeFoundHeading }), N, F, { type: "depositStatus" }, terms("abandonment")];
    case "abandoned": return [D, F, terms("abandonment")];
    default: return null;
  }
}

export async function sendOrderUpdate({ order, tenant, customStatusLine = null }) {
  const lang = await customerLanguage(order);
  const number = order.order_number || order.id || "-";
  const label = statusInfo(order.status).label;
  const fromName = tenantEmailFromName(tenant);
  const t = (es, en) => (lang === "en" ? en : es);
  return sendOrderEmail({
    order, tenant, lang,
    subject: t(`Actualización · Orden ${number} · ${fromName}`, `Update · Order ${number} · ${fromName}`),
    heroTitle: t(`Actualización de tu orden ${number}`, `Update on your order ${number}`),
    heroLine: customStatusLine || t(`Tu orden ${number} ahora está en estado: ${label}.`, `Your order ${number} is now: ${label}.`),
    sections: [{ type: "deviceDetails" }, { type: "lineItems" }, { type: "financialSummary" }],
  });
}

export async function sendStatusEmail({ order, tenant, status, photoScope, includeIntakePhotos }) {
  const templateId = STATUS_TEMPLATE_ID[status];
  if (!templateId) return sendOrderUpdate({ order, tenant });
  const lang = await customerLanguage(order);
  const s = strings(lang);
  const r = resolveTemplate(templateId, tenant, order, lang);
  if (!r.isActive) return false;
  return sendOrderEmail({
    order, tenant, lang,
    subject: r.subject, heroTitle: r.heroTitle, heroLine: r.heroLine,
    sections: sectionsForStatus(status, s, { photoScope, includeIntakePhotos }),
  });
}

export function isMailableStatus(status) {
  return !NON_MAILABLE_STATUSES.includes(status);
}

export function daysSinceReadyForPickup(order) {
  if (order?.status !== "ready_for_pickup") return null;
  const hist = Array.isArray(order.status_history) ? order.status_history : [];
  const last = [...hist].reverse().find((e) => e?.status === "ready_for_pickup");
  if (!last?.timestamp) return null;
  return Math.floor((Date.now() - new Date(last.timestamp).getTime()) / 86400000);
}

export async function sendAbandonmentNotice({ order, tenant }) {
  const lang = await customerLanguage(order);
  const s = strings(lang);
  const fee = formatCurrency(tenant, num(tenantSettings(tenant).abandonment_policy?.daily_fee ?? 3));
  return sendOrderEmail({
    order, tenant, lang,
    subject: s.abandonmentNoticeSubject(order.order_number || order.id || "-"),
    heroTitle: s.abandonmentNoticeTitle,
    heroLine: s.abandonmentNoticeLine(daysSinceReadyForPickup(order) ?? 0, fee),
    sections: [{ type: "deviceDetails" }, { type: "financialSummary" }, { type: "terms", kinds: ["abandonment"] }],
  });
}

export async function sendReviewRequest({ order, tenant, reviewUrl, platformLabel }) {
  const lang = await customerLanguage(order);
  const s = strings(lang);
  const shop = tenant?.name || s.reviewShopFallback;
  return sendOrderEmail({
    order, tenant, lang,
    subject: s.reviewSubject(shop),
    heroTitle: s.reviewTitle(order.customer_name || s.defaultCustomerName),
    heroLine: s.reviewLine(shop, platformLabel, reviewUrl),
    sections: [],
  });
}

const pendingByOrder = new Map();

export function scheduleStatusEmail(orderId, run, graceMs = 5000) {
  cancelScheduledEmail(orderId);
  const entry = { cancelled: false };
  entry.promise = new Promise((resolve) => {
    entry.resolve = resolve;
    entry.timer = setTimeout(async () => {
      pendingByOrder.delete(orderId);
      if (entry.cancelled) return resolve({ sent: false, cancelled: true });
      try {
        const sent = await run();
        resolve({ sent, cancelled: false });
      } catch (e) {
        resolve({ sent: false, cancelled: false, error: e?.message || String(e) });
      }
    }, graceMs);
  });
  pendingByOrder.set(orderId, entry);
  return entry.promise;
}

export function cancelScheduledEmail(orderId) {
  const entry = pendingByOrder.get(orderId);
  if (!entry) return false;
  entry.cancelled = true;
  clearTimeout(entry.timer);
  pendingByOrder.delete(orderId);
  entry.resolve?.({ sent: false, cancelled: true });
  return true;
}

function tenantDateTime(tenant, lang) {
  const opts = { dateStyle: "medium", timeStyle: "short" };
  if (tenant?.timezone) opts.timeZone = tenant.timezone;
  try {
    return new Date().toLocaleString(lang === "en" ? "en-US" : "es-PR", opts);
  } catch {
    return new Date().toLocaleString();
  }
}

function paymentReceiptBlock({ amount, method, order, tenant, isFull, ref, s, lang }) {
  const total = orderTotal(order);
  const hasEstimate = total > 0;
  const paid = num(order.amount_paid);
  const balance = remainingBalance(order);
  const row = (k, v, style = "") => `<tr><td style='padding:6px 0;color:#666;font-size:13px${style}'>${escape(k)}</td><td style='padding:6px 0;text-align:right;font-size:13px${style}'>${v}</td></tr>`;
  const rule = "<tr><td colspan='2' style='padding:8px 0'><div style='border-top:1px dashed #ddd'></div></td></tr>";
  const rows = [
    `<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(s.orderLabel)}</td><td style='padding:6px 0;text-align:right;font-size:13px;font-weight:600'>${escape(order.order_number || order.id || "-")}</td></tr>`,
  ];
  if (ref) rows.push(row(s.referenceLabel, `#${escape(ref)}`));
  rows.push(rule);
  rows.push(`<tr><td style='padding:6px 0;color:#0AA94B;font-size:14px;font-weight:700'>${escape(isFull ? s.todaysPaymentLabel : s.todaysDepositLabel)}</td><td style='padding:6px 0;text-align:right;color:#0AA94B;font-size:14px;font-weight:700'>${escape(formatCurrency(tenant, amount))}</td></tr>`);
  rows.push(row(s.methodLabel, escape(s.paymentMethod(method))));
  rows.push(row(s.dateLabel, escape(tenantDateTime(tenant, lang))));
  rows.push(rule);
  if (hasEstimate) rows.push(row(s.orderTotalLabel, escape(formatCurrency(tenant, total))));
  rows.push(`<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(s.paidToDateLabel)}</td><td style='padding:6px 0;text-align:right;font-size:13px;font-weight:600'>${escape(formatCurrency(tenant, paid))}</td></tr>`);
  if (!hasEstimate && !isFull) {
    rows.push(`<tr><td style='padding:6px 0;color:#A06A00;font-size:13px;font-weight:600'>${escape(s.orderTotalLabel)}</td><td style='padding:6px 0;text-align:right;color:#A06A00;font-size:13px;font-weight:700'>${escape(s.pendingQuoteLabel)}</td></tr>`);
  } else if (balance > 0) {
    rows.push(`<tr><td style='padding:6px 0;color:#E5484D;font-size:14px;font-weight:600'>${escape(s.pendingBalanceLabel)}</td><td style='padding:6px 0;text-align:right;color:#E5484D;font-size:14px;font-weight:700'>${escape(formatCurrency(tenant, balance))}</td></tr>`);
  } else {
    rows.push(`<tr><td style='padding:6px 0;color:#0AA94B;font-size:14px;font-weight:700'>${escape(s.orderPaidOffLabel)}</td><td style='padding:6px 0;text-align:right;color:#0AA94B;font-size:14px;font-weight:700'>${escape(formatCurrency(tenant, 0))}</td></tr>`);
  }
  return `<div style='margin-top:18px;padding:16px;background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#0AA94B;margin-bottom:8px'>${escape(isFull ? s.paymentReceiptTitle : s.depositReceiptTitle)}</div><table style='width:100%;border-collapse:collapse'>${rows.join("")}</table></div>`;
}

export async function sendPaymentReceipt({ order, tenant, amount, method, isFull, transactionId }) {
  const lang = await customerLanguage(order);
  const s = strings(lang);
  const r = resolveTemplate(isFull ? "payment_receipt" : "deposit_receipt", tenant, order, lang);
  if (!r.isActive) return false;
  const amt = formatCurrency(tenant, amount);
  const m = s.paymentMethod(method).toLowerCase();
  const heroLine = isFull
    ? `${r.heroLine}\n\n${s.paymentFinalLine(amt, m)}`
    : `${r.heroLine}\n\n${s.depositReceivedLine(amt, m)}\n\n${s.depositNotAFullPaymentNote}`;
  const ref = transactionId ? String(transactionId).split("-").pop().slice(0, 8).toUpperCase() : null;
  const sections = [{ type: "deviceDetails" }, { type: "lineItems" }, { type: "terms", kinds: ["sales"] }];
  if (!isFull && !(Array.isArray(order.order_items) && order.order_items.length)) sections.splice(1, 0, { type: "initialProblem" });
  const email = String(order.customer_email || "").trim();
  if (!email) throw new Error("El cliente no tiene email registrado.");
  const html = renderOrderEmailHTML({
    order, tenant, lang, heroTitle: r.heroTitle, heroLine, sections,
    customBlock: paymentReceiptBlock({ amount, method, order, tenant, isFull, ref, s, lang }),
  });
  return sendRawEmail({ tenantId: tenant?.id || order.tenant_id, to: email, subject: r.subject, html, replyTo: tenant?.email, fromName: tenantEmailFromName(tenant) });
}

export async function sendRefundReceipt({ order, tenant, amount, method, reason }) {
  const lang = await customerLanguage(order);
  const s = strings(lang);
  const r = resolveTemplate("refund_processed", tenant, order, lang);
  if (!r.isActive) return false;
  const amt = formatCurrency(tenant, amount);
  const heroLine = `${r.heroLine}\n\n${s.refundedLine(amt, s.paymentMethod(method).toLowerCase())}`;
  const rule = "<tr><td colspan='2' style='padding:8px 0'><div style='border-top:1px dashed #ddd'></div></td></tr>";
  const row = (k, v) => `<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(k)}</td><td style='padding:6px 0;text-align:right;font-size:13px'>${escape(v)}</td></tr>`;
  const rows = [
    `<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(s.orderLabel)}</td><td style='padding:6px 0;text-align:right;font-size:13px;font-weight:600'>${escape(order.order_number || order.id || "-")}</td></tr>`,
    rule,
    `<tr><td style='padding:6px 0;color:#DC2626;font-size:14px;font-weight:700'>${escape(s.refundAmountLabel)}</td><td style='padding:6px 0;text-align:right;color:#DC2626;font-size:14px;font-weight:700'>${escape(amt)}</td></tr>`,
    row(s.methodLabel, s.paymentMethod(method)),
    row(s.dateLabel, tenantDateTime(tenant, lang)),
  ];
  const cleanReason = String(reason || "").trim();
  if (cleanReason) rows.push(row(s.refundReasonLabel, cleanReason));
  rows.push(rule);
  rows.push(`<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(s.paidToDateNowLabel)}</td><td style='padding:6px 0;text-align:right;font-size:13px;font-weight:600'>${escape(formatCurrency(tenant, num(order.amount_paid)))}</td></tr>`);
  const block = `<div style='margin-top:18px;padding:16px;background:#FEF2F2;border:1px solid #FECACA;border-radius:10px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#DC2626;margin-bottom:8px'>${escape(s.refundReceiptTitle)}</div><table style='width:100%;border-collapse:collapse'>${rows.join("")}</table></div>`;
  const email = String(order.customer_email || "").trim();
  if (!email) throw new Error("El cliente no tiene email registrado.");
  const html = renderOrderEmailHTML({ order, tenant, lang, heroTitle: r.heroTitle, heroLine, sections: [{ type: "deviceDetails" }], customBlock: block });
  return sendRawEmail({ tenantId: tenant?.id || order.tenant_id, to: email, subject: r.subject, html, replyTo: tenant?.email, fromName: tenantEmailFromName(tenant) });
}

export async function sendPOSReceipt({ to, customerName, items, subtotal, taxAmount, discount, total, method, customLabel, amountReceived, changeDue, tenant, lang = "es" }) {
  const email = String(to || "").trim();
  if (!email) throw new Error("El cliente no tiene email registrado.");
  const s = strings(lang);
  const usd = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num(v));
  const methodLabel = customLabel || s.paymentMethod(method);
  const customer = escape(customerName || s.defaultCustomerName);
  const fromName = tenantEmailFromName(tenant);
  const rows = (items || []).map((it) => `<tr>
      <td style='padding:8px 0;font-size:13px;color:#111'>${escape(it.productName)}</td>
      <td style='padding:8px 0;text-align:center;font-size:13px;color:#666'>${it.quantity}</td>
      <td style='padding:8px 0;text-align:right;font-size:13px;color:#111'>${usd(it.totalWithTax)}</td>
    </tr>`).join("");
  const itemsBlock = `<div style='margin-top:18px'>
    <div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:8px'>${escape(s.itemsTitle)}</div>
    <table style='width:100%;border-collapse:collapse'>
      <thead>
        <tr style='border-bottom:1px solid #eee'>
          <th style='text-align:left;padding:8px 0;font-size:11px;color:#999;font-weight:600'>${escape(s.colProduct)}</th>
          <th style='text-align:center;padding:8px 0;font-size:11px;color:#999;font-weight:600'>${escape(s.colQtyShort)}</th>
          <th style='text-align:right;padding:8px 0;font-size:11px;color:#999;font-weight:600'>${escape(s.colTotal)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
  const totalRows = [];
  totalRows.push(`<tr><td style='padding:6px 0;color:#666;font-size:13px'>Subtotal</td><td style='padding:6px 0;text-align:right;font-size:13px'>${usd(subtotal)}</td></tr>`);
  if (num(taxAmount) > 0) totalRows.push(`<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(s.taxLabel)}</td><td style='padding:6px 0;text-align:right;font-size:13px'>${usd(taxAmount)}</td></tr>`);
  if (num(discount) > 0) totalRows.push(`<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(s.discountLabel)}</td><td style='padding:6px 0;text-align:right;font-size:13px;color:#dc2626'>-${usd(discount)}</td></tr>`);
  totalRows.push(`<tr style='border-top:1px solid #eee'><td style='padding:10px 0;font-size:14px;font-weight:700'>${escape(s.totalLabel)}</td><td style='padding:10px 0;text-align:right;font-size:16px;font-weight:700;color:#FF5722'>${usd(total)}</td></tr>`);
  totalRows.push(`<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(s.paymentMethodLabel)}</td><td style='padding:6px 0;text-align:right;font-size:13px'>${escape(methodLabel)}</td></tr>`);
  if (method === "cash" && !customLabel && num(amountReceived) > 0) {
    totalRows.push(`<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(s.receivedLabel)}</td><td style='padding:6px 0;text-align:right;font-size:13px'>${usd(amountReceived)}</td></tr>`);
    if (num(changeDue) > 0) totalRows.push(`<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(s.changeLabel)}</td><td style='padding:6px 0;text-align:right;font-size:13px'>${usd(changeDue)}</td></tr>`);
  }
  const totalsBlock = `<div style='margin-top:18px;padding-top:14px;border-top:1px solid #eee'><table style='width:100%;border-collapse:collapse'>${totalRows.join("")}</table></div>`;
  const pol = tenantSettings(tenant).policies || {};
  const policyParts = [];
  if (String(pol.sales_warranty || "").trim()) policyParts.push(`<div style='margin-top:14px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:6px'>${escape(s.warrantyTitle)}</div><div style='font-size:12px;color:#555;line-height:1.5'>${escape(pol.sales_warranty)}</div></div>`);
  if (String(pol.sales_terms || "").trim()) policyParts.push(`<div style='margin-top:14px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:6px'>${escape(s.conditionsTitle)}</div><div style='font-size:12px;color:#555;line-height:1.5'>${escape(pol.sales_terms)}</div></div>`);
  const phoneLine = tenant?.admin_phone ? `<br><span style='color:#999;font-size:12px'>Tel. ${escape(tenant.admin_phone)}</span>` : "";
  const addressLine = tenant?.address ? `<br><span style='color:#999;font-size:12px'>${escape(tenant.address)}</span>` : "";
  const emailLine = tenant?.email ? `<br><span style='color:#999;font-size:12px'>${escape(tenant.email)}</span>` : "";
  const logo = tenant?.logo_url ? `<img src='${escapeAttr(tenant.logo_url)}' alt='${escape(fromName)}' style='max-height:60px;max-width:200px;object-fit:contain;margin-bottom:12px;display:block'>` : "";
  const html = `<!doctype html>
<html><body style='margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111'>
  <div style='max-width:640px;margin:0 auto;padding:24px'>
    <div style='background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04)'>
      ${logo}
      <div style='font-size:18px;font-weight:700;color:#FF5722;margin-bottom:6px'>${escape(fromName)}</div>
      <div style='font-size:11px;color:#999;margin-bottom:18px'>${escape(tenantDateTime(tenant, lang))}</div>
      <div style='font-size:20px;font-weight:700;color:#111;margin-bottom:6px;line-height:1.3'>${escape(s.saleReceiptTitle)}</div>
      <div style='font-size:14px;color:#444;margin-bottom:20px;line-height:1.5'>${s.thanksForPurchase(customer)}</div>
      ${itemsBlock}
      ${totalsBlock}
      ${policyParts.join("")}
      <div style='margin-top:28px;padding-top:18px;border-top:1px solid #eee;font-size:13px;color:#666;line-height:1.5'>
        ${escape(s.anyQuestionsLine)}
        ${phoneLine}
        ${emailLine}
        ${addressLine}
      </div>
      ${renderSocial(tenant)}
    </div>
    <div style='text-align:center;font-size:11px;color:#999;margin-top:14px'>
      ${escape(s.sentBy(fromName))}
    </div>
  </div>
</body></html>`;
  return sendRawEmail({ tenantId: tenant?.id, to: email, subject: s.saleReceiptSubject(fromName), html, replyTo: tenant?.email, fromName });
}
