import crypto from 'node:crypto';

export const EMAIL_ENDPOINT = 'https://smartfixos.onrender.com/sendEmailInternal';
export const SENDER_ADDRESS = 'noreply@smartfixos.com';
export const INTAKE_TYPE = 'intake';
export const MAX_FOTOS_CORREO = 8;
export const CLAIM_STALE_MS = 10 * 60_000;
export const SEND_TIMEOUT_MS = 25_000;
export const AFTER_CREATE_CAP_MS = 8_000;
const FORCE_ROLES = /owner|admin|manager|gerente|dueno/i;
const SCHEMA_CODES = new Set(['PGRST204', '42703', '42P10', 'PGRST205', '42P01']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const INTAKE_DEFAULTS = {
  subject: { es: 'Recibimos tu equipo · Boleto {order_number}', en: 'We received your device · Order {order_number}' },
  hero_title: { es: 'Hemos recibido tu equipo', en: "We've received your device" },
  hero_line: {
    es: 'Recibimos tu equipo en el taller. Te contactamos cuando completemos el diagnóstico.',
    en: "We received your device at the shop. We'll contact you when we complete the diagnosis.",
  },
};

export const ABANDONMENT_DEFAULT_TERMS = {
  es: 'El cliente debe recoger su equipo dentro de los 30 días luego de ser notificado que está listo. Pasado ese plazo aplica un cargo diario por almacenaje. Los equipos no reclamados dentro de los 90 días desde dicha notificación se considerarán abandonados, y el taller podrá disponer de ellos conforme a la ley aplicable para recuperar los costos de reparación y almacenaje.',
  en: 'The customer must pick up their device within 30 days after being notified it is ready. After that period a daily storage fee applies. Devices not claimed within 90 days from that notification will be considered abandoned, and the shop may dispose of them in accordance with applicable law to recover repair and storage costs.',
};

export function strings(lang) {
  const t = (es, en) => (lang === 'en' ? en : es);
  return {
    defaultCustomerName: t('Cliente', 'Customer'),
    greeting: (n) => t(`Hola ${n}, `, `Hi ${n}, `),
    anyQuestionsLine: t('Cualquier duda respondiendo este correo y te ayudamos.', "Any questions, just reply to this email and we'll help you out."),
    sentBy: (n) => t(`Enviado por ${n} · Powered by Archilla OS`, `Sent by ${n} · Powered by Archilla OS`),
    equipmentTitle: t('EQUIPO', 'DEVICE'),
    orderLabel: t('Boleto', 'Order'),
    typeLabel: t('Tipo', 'Type'),
    brandLabel: t('Marca', 'Brand'),
    familyLabel: t('Familia', 'Family'),
    modelLabel: t('Modelo', 'Model'),
    colorLabel: t('Color', 'Color'),
    serialLabel: 'Serial / IMEI',
    reportedProblemTitle: t('PROBLEMA REPORTADO', 'REPORTED ISSUE'),
    advisoriesTitle: t('IMPORTANTE — LO QUE TE ADVERTIMOS', 'IMPORTANT — WHAT WE FLAGGED'),
    reportedBy: (n) => t(`Informado por ${n}`, `Reported by ${n}`),
    signatureTitle: t('FIRMA DEL CLIENTE', 'CUSTOMER SIGNATURE'),
    signatureAlt: t('Firma del cliente', 'Customer signature'),
    signatureNote: t('Firma registrada al recibir el equipo en el taller.', 'Signature captured when the device was received at the shop.'),
    abandonmentPolicyTitle: t('Política de Abandono y Almacenaje', 'Abandonment & Storage Policy'),
    repairWarrantyTitle: t('Garantía de Reparación', 'Repair Warranty'),
    salesTermsTitle: t('Condiciones de Venta', 'Sales Terms'),
    allPhotosHeading: t('FOTOS DEL EQUIPO', 'DEVICE PHOTOS'),
    morePhotos: (n) => t(`+ ${n} foto(s) más en tu boleto`, `+ ${n} more photo(s) in your order`),
    photoAlt: t('Foto del equipo', 'Photo of the device'),
    itemsTitle: t('PIEZAS Y SERVICIOS', 'PARTS & SERVICES'),
    colItem: 'Item',
    colQty: t('Cant', 'Qty'),
    colPrice: t('Precio', 'Price'),
    colTotal: 'Total',
    summaryTitle: t('RESUMEN', 'SUMMARY'),
    laborLabel: t('Mano de obra', 'Labor'),
    totalLabel: 'Total',
    paidLabel: t('Pagado', 'Paid'),
    pendingBalanceLabel: t('Saldo pendiente', 'Balance due'),
    historyNote: (subject) => t(`Correo enviado al cliente (Boleto recibido): ${subject}`, `Email sent to customer (Ticket received): ${subject}`),
  };
}

function escape(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escape(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function isValidEmail(email) {
  const e = String(email || '').trim();
  if (!e || /\s/.test(e) || /[^\x00-\x7F]/.test(e)) return false;
  const parts = e.split('@');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  const domain = parts[1];
  return domain.includes('.') && !domain.startsWith('.') && !domain.endsWith('.');
}

export function photoThumbURL(url, width = 240) {
  if (!url || !url.includes('/storage/v1/object/') || url.includes('/storage/v1/render/image/')) return url;
  const transformed = url.replace('/storage/v1/object/', '/storage/v1/render/image/');
  const sep = transformed.includes('?') ? '&' : '?';
  return `${transformed}${sep}width=${width}&quality=70&resize=contain`;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function orderTotal(order) {
  if (order?.cost_estimate != null && order.cost_estimate !== '') return num(order.cost_estimate);
  if (order?.labor_cost != null && order.labor_cost !== '') return num(order.labor_cost);
  return 0;
}

function remainingBalance(order) {
  if (order?.balance_due != null && order.balance_due !== '') return num(order.balance_due);
  return Math.max(0, orderTotal(order) - num(order?.amount_paid));
}

export function tenantFromName(tenant) {
  if (tenant?.name) return tenant.name;
  if (tenant?.admin_name) return tenant.admin_name;
  return 'Mi taller';
}

function formatCurrency(tenant, amount) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: tenant?.currency || 'USD' }).format(num(amount));
  } catch {
    return `$${num(amount).toFixed(2)}`;
  }
}

function settingsOf(tenant) {
  return tenant?.settings && typeof tenant.settings === 'object' ? tenant.settings : {};
}

export function resolveIntakeTemplate(tenant, order, lang) {
  const l = lang === 'en' ? 'en' : 'es';
  const defaults = { subject: INTAKE_DEFAULTS.subject[l], heroTitle: INTAKE_DEFAULTS.hero_title[l], heroLine: INTAKE_DEFAULTS.hero_line[l], isActive: true };
  const override = settingsOf(tenant).email_templates?.[INTAKE_TYPE];
  let merged = defaults;
  if (override && typeof override === 'object') {
    const s = String(override.subject || '').trim();
    const t = String(override.hero_title || '').trim();
    const h = String(override.hero_line || '').trim();
    const active = override.isActive ?? override.is_active ?? override.active;
    merged = {
      subject: s ? override.subject : defaults.subject,
      heroTitle: t ? override.hero_title : defaults.heroTitle,
      heroLine: h ? override.hero_line : defaults.heroLine,
      isActive: active !== false,
    };
  }
  const number = order?.order_number || order?.id || '-';
  return { ...merged, subject: String(merged.subject).replaceAll('{order_number}', number).replaceAll('{number}', number) };
}

export function serverSendEnabled(tenant) {
  const settings = settingsOf(tenant);
  if (settings.server_emails && typeof settings.server_emails === 'object' && settings.server_emails[INTAKE_TYPE] === false) return false;
  const tpl = settings.email_templates?.[INTAKE_TYPE];
  if (tpl && typeof tpl === 'object' && tpl.server_send === false) return false;
  return true;
}

function photoIMG(url, size, width, s) {
  return `<img src='${escapeAttr(photoThumbURL(url, size))}' alt='${escapeAttr(s.photoAlt)}' style='width:${width};height:140px;object-fit:cover;border-radius:10px;display:block;background:#f0f0f0'>`;
}

export function emailPhotos(order) {
  const all = Array.isArray(order?.device_photos) ? order.device_photos : [];
  return all.filter((u) => typeof u === 'string' && /^https:\/\//i.test(u.trim())).map((u) => u.trim());
}

function renderPhotos(order, s, max) {
  const urls = emailPhotos(order);
  if (!urls.length) return null;
  const imgs = urls.slice(0, max).map((u) => `<span style='display:inline-block;margin:4px'><a href='${escapeAttr(u)}' style='text-decoration:none'>${photoIMG(u, 400, '140px', s)}</a></span>`).join('');
  const extra = urls.length > max ? `<div style='font-size:12px;color:#999;margin-top:6px'>${escape(s.morePhotos(urls.length - max))}</div>` : '';
  return `<div style='margin-top:18px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:8px'>${escape(s.allPhotosHeading)}</div><div style='font-size:0;line-height:0'>${imgs}</div>${extra}</div>`;
}

function sectionTable(title, rows) {
  const body = rows.map(([k, v]) => `<tr><td style='padding:6px 0;color:#666;font-size:13px'>${escape(k)}</td><td style='padding:6px 0;text-align:right;font-size:13px;color:#111'>${escape(v)}</td></tr>`).join('');
  return `<div style='margin-top:18px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:6px'>${escape(title)}</div><table style='width:100%;border-collapse:collapse;border-top:1px solid #eee'>${body}</table></div>`;
}

function renderDevice(order, s) {
  const rows = [[s.orderLabel, order.order_number || order.id || '-']];
  [[s.typeLabel, order.device_type], [s.brandLabel, order.device_brand], [s.familyLabel, order.device_family], [s.modelLabel, order.device_model], [s.colorLabel, order.device_color], [s.serialLabel, order.device_serial]]
    .forEach(([k, v]) => { if (v) rows.push([k, v]); });
  return rows.length > 1 ? sectionTable(s.equipmentTitle, rows) : null;
}

function renderProblem(order, s) {
  const p = String(order.initial_problem || '').trim();
  if (!p) return null;
  return `<div style='margin-top:18px;padding:14px;background:#FFF8E5;border-radius:10px;border-left:3px solid #F5A623'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#A06A00;margin-bottom:6px'>${escape(s.reportedProblemTitle)}</div><div style='font-size:14px;color:#333;line-height:1.4'>${escape(p)}</div></div>`;
}

function renderAdvisories(order, s) {
  const entries = (Array.isArray(order.status_history) ? order.status_history : []).filter((e) => e?.kind === 'customer_advisory');
  if (!entries.length) return null;
  const items = entries.map((e) => String(e.note || '').trim()).filter(Boolean).map((n) => `<p style='margin:0 0 7px'>• ${escape(n)}</p>`);
  if (!items.length) return null;
  const by = String(entries[entries.length - 1]?.changed_by || '').trim();
  const byLine = by ? `<div style='font-size:11px;color:#8a7c60;margin-top:10px;padding-top:8px;border-top:1px solid #EFE0C0'>${escape(s.reportedBy(by))}</div>` : '';
  return `<div style='margin-top:18px;padding:14px;background:#FFF7E6;border-radius:10px;border-left:3px solid #E0A030'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#9A6A0C;margin-bottom:8px'>${escape(s.advisoriesTitle)}</div><div style='font-size:14px;color:#333;line-height:1.55'>${items.join('')}</div>${byLine}</div>`;
}

function renderSignature(order, s) {
  const sec = order.device_security && typeof order.device_security === 'object' ? order.device_security : {};
  const url = String(sec.signature_url || '').trim();
  if (!url) return null;
  return `<div style='margin-top:18px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:8px'>${escape(s.signatureTitle)}</div><div style='background:#fff;border:1px solid #eee;border-radius:10px;padding:10px;text-align:center'><img src='${escapeAttr(photoThumbURL(url, 500))}' alt='${escapeAttr(s.signatureAlt)}' style='max-width:260px;width:100%;height:auto;display:inline-block'></div><div style='font-size:11px;color:#999;margin-top:6px'>${escape(s.signatureNote)}</div></div>`;
}

function abandonmentTerms(tenant, lang) {
  const settings = settingsOf(tenant);
  const custom = String(settings.policies?.abandonment_terms || '').trim();
  if (custom) return custom;
  const base = ABANDONMENT_DEFAULT_TERMS[lang] || ABANDONMENT_DEFAULT_TERMS.es;
  const p = settings.abandonment_policy || {};
  const abandonDays = p.abandon_days ?? 30;
  const claimTotal = p.claim_total_days ?? 90;
  const fee = num(p.daily_fee ?? 3);
  if (abandonDays === 30 && claimTotal === 90 && fee === 3) return base;
  const feeStr = `$${fee.toFixed(2)}`;
  return base + (lang === 'en'
    ? ` (At this shop: ${abandonDays} days to pick up, ${feeStr}/day storage fee, ${claimTotal} days total claim window.)`
    : ` (En este taller: ${abandonDays} días para recoger, cargo de ${feeStr}/día, ${claimTotal} días para reclamo total.)`);
}

function renderTerms(tenant, lang, s) {
  const p = settingsOf(tenant).policies || {};
  const parts = [];
  const rw = String(p.repair_warranty || '').trim();
  if (rw) parts.push([s.repairWarrantyTitle, rw]);
  const sales = String(p.sales_terms || '').trim() || String(p.sales_warranty || '').trim();
  if (sales) parts.push([s.salesTermsTitle, sales]);
  parts.push([s.abandonmentPolicyTitle, abandonmentTerms(tenant, lang)]);
  const inner = parts.map(([title, body]) => `<div style='margin-bottom:10px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#C2410C;margin-bottom:4px'>${escape(title)}</div><div style='font-size:13px;color:#333;line-height:1.5'>${escape(body).replace(/\n/g, '<br>')}</div></div>`).join('');
  return `<div style='margin-top:18px;padding:14px;background:#FFF7ED;border-radius:10px;border-left:3px solid #F97316'>${inner}</div>`;
}

function renderItems(order, tenant, s) {
  const items = Array.isArray(order.order_items) ? order.order_items : [];
  if (!items.length) return null;
  const parts = items.filter((i) => i?.type !== 'discount');
  const discount = items.find((i) => i?.type === 'discount');
  if (!parts.length && !discount) return null;
  const rows = parts.map((i) => {
    const qty = parseInt(i.quantity ?? 1, 10) || 1;
    const price = num(i.price);
    return `<tr><td style='padding:8px 6px;font-size:13px;color:#333'>${escape(i.name || 'Item')}</td><td style='padding:8px 6px;font-size:13px;color:#666;text-align:center'>×${qty}</td><td style='padding:8px 6px;font-size:13px;color:#333;text-align:right'>${escape(formatCurrency(tenant, price))}</td><td style='padding:8px 6px;font-size:13px;color:#111;text-align:right;font-weight:600'>${escape(formatCurrency(tenant, qty * price))}</td></tr>`;
  }).join('');
  const dRow = discount
    ? `<tr><td colspan='3' style='padding:8px 6px;font-size:13px;color:#E5484D'>${escape(discount.name || '')}</td><td style='padding:8px 6px;font-size:13px;color:#E5484D;text-align:right;font-weight:600'>${escape(formatCurrency(tenant, num(discount.price)))}</td></tr>`
    : '';
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
  return `<div style='margin-top:18px;padding:14px;background:#F8F9FA;border-radius:10px'><div style='font-size:11px;font-weight:700;letter-spacing:0.4px;color:#666;margin-bottom:8px'>${escape(s.summaryTitle)}</div><table style='width:100%;border-collapse:collapse'>${rows.join('')}</table></div>`;
}

function renderSocial(tenant) {
  const social = settingsOf(tenant).social;
  if (!social || typeof social !== 'object') return '';
  const links = [];
  if (social.facebook) links.push(`<a href='${escapeAttr(social.facebook)}' style='color:#1877F2;text-decoration:none;margin:0 6px'>Facebook</a>`);
  if (social.instagram) links.push(`<a href='${escapeAttr(social.instagram)}' style='color:#E4405F;text-decoration:none;margin:0 6px'>Instagram</a>`);
  if (social.google_reviews) links.push(`<a href='${escapeAttr(social.google_reviews)}' style='color:#EA4335;text-decoration:none;margin:0 6px'>Google</a>`);
  if (social.yelp) links.push(`<a href='${escapeAttr(social.yelp)}' style='color:#D32323;text-decoration:none;margin:0 6px'>Yelp</a>`);
  if (social.website) links.push(`<a href='${escapeAttr(social.website)}' style='color:#FF5722;text-decoration:none;margin:0 6px'>Web</a>`);
  return links.length ? `<div style='text-align:center;margin-top:14px;font-size:13px;line-height:2'>${links.join(' · ')}</div>` : '';
}

export function renderIntakeEmail({ order, tenant, lang = 'es', maxPhotos = MAX_FOTOS_CORREO }) {
  const l = lang === 'en' ? 'en' : 'es';
  const s = strings(l);
  const tpl = resolveIntakeTemplate(tenant, order, l);
  const blocks = [
    renderDevice(order, s),
    renderProblem(order, s),
    renderPhotos(order, s, maxPhotos),
    renderAdvisories(order, s),
    renderItems(order, tenant, s),
    renderFinancial(order, tenant, s),
    renderSignature(order, s),
    renderTerms(tenant, l, s),
  ].filter(Boolean);
  const fromName = tenantFromName(tenant);
  const customer = escape(order.customer_name || s.defaultCustomerName);
  const phoneLine = tenant?.admin_phone ? `<br><span style='color:#999;font-size:12px'>Tel. ${escape(tenant.admin_phone)}</span>` : '';
  const addressLine = tenant?.address ? `<br><span style='color:#999;font-size:12px'>${escape(tenant.address)}</span>` : '';
  const emailLine = tenant?.email ? `<br><span style='color:#999;font-size:12px'>${escape(tenant.email)}</span>` : '';
  const logo = tenant?.logo_url ? `<img src='${escapeAttr(tenant.logo_url)}' alt='${escape(fromName)}' style='max-height:60px;max-width:200px;object-fit:contain;margin-bottom:12px;display:block'>` : '';
  const html = `<!doctype html>
<html><body style='margin:0;padding:0;background:#F4F4F5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111'>
  <div style='max-width:640px;margin:0 auto;padding:24px'>
    <div style='background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 1px 3px rgba(0,0,0,0.04)'>
      ${logo}
      <div style='font-size:18px;font-weight:700;color:#FF5722;margin-bottom:18px'>${escape(fromName)}</div>
      <div style='font-size:20px;font-weight:700;color:#111;margin-bottom:6px;line-height:1.3'>${escape(tpl.heroTitle)}</div>
      <div style='font-size:14px;color:#444;margin-bottom:20px;line-height:1.5'>${s.greeting(customer)}${escape(tpl.heroLine)}</div>
      ${blocks.join('\n')}
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
  return { subject: tpl.subject, html, heroTitle: tpl.heroTitle, heroLine: tpl.heroLine, active: tpl.isActive, lang: l, fromName };
}

export function emailPayload({ to, subject, html, tenant }) {
  const safeName = String(tenantFromName(tenant)).replace(/[\r\n]/g, ' ').replace(/"/g, "'").trim() || 'Archilla OS';
  const payload = { to: String(to).trim(), subject, body: html, from_name: safeName, from: `${safeName} <${SENDER_ADDRESS}>` };
  const rt = String(tenant?.email || '').trim();
  if (rt.includes('@')) payload.replyTo = rt;
  return payload;
}

export function intakeDedupeKey(orderId, manualId = null) {
  return manualId ? `ingreso:${orderId}:manual:${manualId}` : `ingreso:${orderId}`;
}

function isSchemaError(e) {
  if (!e) return false;
  if (SCHEMA_CODES.has(String(e.code || ''))) return true;
  return /column .* does not exist|could not find the .* column|no unique or exclusion constraint/i.test(String(e.message || ''));
}

async function postEmail(payload, deps) {
  const fetchImpl = deps.fetch || globalThis.fetch;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), deps.sendTimeoutMs || SEND_TIMEOUT_MS) : null;
  let res;
  try {
    res = await fetchImpl(deps.endpoint || EMAIL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined,
    });
  } catch (e) {
    return { ok: false, error: e?.name === 'AbortError' ? 'El servicio de correo no respondio a tiempo' : `No se pudo conectar con el servicio de correo: ${e?.message || e}` };
  } finally {
    if (timer) clearTimeout(timer);
  }
  const text = await res.text().catch(() => '');
  let reply = null;
  try { reply = text ? JSON.parse(text) : null; } catch { reply = null; }
  if (res.status === 500) {
    if (reply?.error) return { ok: false, error: String(reply.error) };
    return { ok: true, messageId: null };
  }
  if (!res.ok) return { ok: false, error: String(reply?.error || text.slice(0, 200) || `Error ${res.status}`) };
  if (reply && reply.error) {
    const err = String(reply.error);
    if (err.includes('validation_error') || (err.includes('Invalid') && err.includes('to'))) return { ok: false, error: 'Email del cliente inválido — corrígelo en la ficha del cliente.' };
    return { ok: false, error: err };
  }
  if (reply && reply.status === 'sent') return { ok: true, messageId: reply.message_id || null };
  return { ok: false, error: `Respuesta inesperada del servidor: ${text.slice(0, 200) || '(vacío)'}` };
}

async function loadOrder(deps, tenantId, orderId) {
  const rows = await deps.sb(`order?tenant_id=eq.${tenantId}&id=eq.${orderId}&is_deleted=eq.false&select=*&limit=1`);
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function loadTenant(deps, tenantId) {
  try {
    const rows = await deps.sb(`tenant?id=eq.${tenantId}&select=id,name,admin_name,email,address,admin_phone,logo_url,currency,settings&limit=1`);
    return (Array.isArray(rows) && rows[0]) || { id: tenantId };
  } catch (e) {
    console.warn('correo de ingreso: no se pudo leer el taller', e.message);
    return { id: tenantId };
  }
}

async function loadLanguage(deps, tenantId, order) {
  const id = String(order?.customer_id || '');
  if (!UUID_RE.test(id)) return 'es';
  try {
    const rows = await deps.sb(`customer?tenant_id=eq.${tenantId}&id=eq.${id}&select=preferred_language&limit=1`);
    return rows?.[0]?.preferred_language === 'en' ? 'en' : 'es';
  } catch {
    return 'es';
  }
}

function historyShowsSent(order) {
  const history = Array.isArray(order?.status_history) ? order.status_history : [];
  return history.some((e) => e && e.kind === 'email' && e.email_type === INTAKE_TYPE);
}

async function loggedByClient(deps, tenantId, to, subject) {
  try {
    const rows = await deps.sb(`email_log?tenant_id=eq.${tenantId}&to_email=eq.${encodeURIComponent(to)}&subject=eq.${encodeURIComponent(subject)}&status=eq.sent&select=id&limit=1`);
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

function claimBody({ tenantId, orderId, to, rendered, key, sender, actor, manual }) {
  return {
    tenant_id: tenantId,
    to_email: to,
    subject: rendered.subject,
    from_name: rendered.fromName,
    status: 'pending',
    order_id: orderId,
    order_status: INTAKE_TYPE,
    dedupe_key: key,
    sender,
    created_by: 'Servidor',
    created_by_id: 'servidor',
    metadata: { tipo: INTAKE_TYPE, actor: actor || null, manual: manual === true },
  };
}

async function claim(deps, params) {
  const { tenantId, key } = params;
  let rows;
  try {
    rows = await deps.sb('email_log?on_conflict=tenant_id,dedupe_key', {
      method: 'POST',
      body: claimBody(params),
      prefer: 'resolution=ignore-duplicates,return=representation',
    });
  } catch (e) {
    if (isSchemaError(e)) return { mode: 'legacy' };
    return { mode: 'error', error: e };
  }
  if (Array.isArray(rows) && rows.length > 0 && rows[0]?.id) return { mode: 'key', owner: true, logId: rows[0].id };
  let existing;
  try {
    const found = await deps.sb(`email_log?tenant_id=eq.${tenantId}&dedupe_key=eq.${encodeURIComponent(key)}&select=id,status,updated_at,created_at&limit=1`);
    existing = Array.isArray(found) ? found[0] : null;
  } catch (e) {
    if (isSchemaError(e)) return { mode: 'legacy' };
    return { mode: 'error', error: e };
  }
  if (!existing) {
    if (Array.isArray(rows)) return { mode: 'error', error: new Error('no se pudo reclamar el envio en email_log') };
    return { mode: 'legacy' };
  }
  if (existing.status === 'sent') return { mode: 'key', owner: false, state: 'sent', logId: existing.id };
  const now = typeof deps.now === 'function' ? deps.now() : Date.now();
  const stamp = new Date(now).toISOString();
  if (existing.status === 'failed' || existing.status === 'bounced') {
    const taken = await deps.sb(`email_log?id=eq.${existing.id}&tenant_id=eq.${tenantId}&status=eq.${existing.status}`, {
      method: 'PATCH',
      body: { status: 'pending', error_message: null, updated_at: stamp },
      prefer: 'return=representation',
    });
    if (Array.isArray(taken) && taken.length) return { mode: 'key', owner: true, logId: existing.id, retry: true };
    return { mode: 'key', owner: false, state: 'pending', logId: existing.id };
  }
  const touched = Date.parse(existing.updated_at || existing.created_at || '');
  if (Number.isFinite(touched) && touched < now - CLAIM_STALE_MS) {
    const cutoff = new Date(now - CLAIM_STALE_MS).toISOString();
    const taken = await deps.sb(`email_log?id=eq.${existing.id}&tenant_id=eq.${tenantId}&status=eq.pending&updated_at=lt.${cutoff}`, {
      method: 'PATCH',
      body: { status: 'pending', updated_at: stamp },
      prefer: 'return=representation',
    });
    if (Array.isArray(taken) && taken.length) return { mode: 'key', owner: true, logId: existing.id, retry: true };
  }
  return { mode: 'key', owner: false, state: 'pending', logId: existing.id };
}

async function closeClaim(deps, tenantId, logId, { ok, error, html, now }) {
  const body = ok
    ? { status: 'sent', sent_at: new Date(now).toISOString(), body_html: html, error_message: null }
    : { status: 'failed', body_html: html, error_message: String(error || 'fallo').slice(0, 800) };
  try {
    await deps.sb(`email_log?id=eq.${logId}&tenant_id=eq.${tenantId}`, { method: 'PATCH', body, prefer: 'return=minimal' });
  } catch (e) {
    console.warn('correo de ingreso: no se pudo cerrar la fila de email_log', logId, e.message);
  }
}

async function legacyLog(deps, tenantId, { to, rendered, ok, error, now }) {
  const row = {
    tenant_id: tenantId,
    to_email: to,
    subject: rendered.subject,
    body_html: rendered.html,
    from_name: rendered.fromName,
    status: ok ? 'sent' : 'failed',
    created_by: 'Servidor',
    created_by_id: 'servidor',
  };
  if (ok) row.sent_at = new Date(now).toISOString();
  if (error) row.error_message = String(error).slice(0, 800);
  try {
    const rows = await deps.sb('email_log', { method: 'POST', body: row, prefer: 'return=representation' });
    return Array.isArray(rows) ? rows[0]?.id || null : null;
  } catch (e) {
    console.warn('correo de ingreso: no se pudo registrar en email_log', e.message);
    return null;
  }
}

async function noteHistory(deps, orderId, { subject, lang, logId, actor, now }) {
  const entry = {
    status: null,
    timestamp: new Date(now).toISOString(),
    changed_by: actor || 'Sistema',
    note: strings(lang).historyNote(subject),
    visible_to_customer: false,
    kind: 'email',
    email_type: INTAKE_TYPE,
    note_id: (deps.uuid || crypto.randomUUID)().toUpperCase(),
  };
  if (logId) entry.email_log_id = String(logId);
  try {
    await deps.sb('rpc/append_order_history', { method: 'POST', body: { p_order_id: orderId, p_entries: [entry] } });
  } catch (e) {
    console.warn('correo de ingreso: no se pudo anotar en el historial del boleto', e.message);
  }
}

function result(enviada, codigo, motivo, extra = {}) {
  return { enviada, codigo, motivo, canal: 'correo_ingreso', ...extra };
}

export async function sendIntakeEmail({ tenantId, orderId, sender = 'servidor', actor = 'Sistema', force = false, manual = false, automatic = true }, deps) {
  const now = () => (typeof deps.now === 'function' ? deps.now() : Date.now());
  if (!tenantId || !orderId) return result(false, 'datos_incompletos', 'falta el taller o el boleto');
  const order = await loadOrder(deps, tenantId, orderId);
  if (!order) return result(false, 'no_encontrado', 'no se encontro el boleto');
  const tenant = await loadTenant(deps, tenantId);
  if (automatic && !force && !serverSendEnabled(tenant)) {
    return result(false, 'servidor_apagado', 'el envio del correo de ingreso desde el servidor esta apagado en el taller');
  }
  const to = String(order.customer_email || '').trim();
  if (!to) return result(false, 'sin_email', 'el cliente no tiene email');
  if (!isValidEmail(to)) return result(false, 'email_invalido', 'el email del cliente no es valido');
  const lang = await loadLanguage(deps, tenantId, order);
  const rendered = renderIntakeEmail({ order, tenant, lang });
  if (!force && !rendered.active) return result(false, 'plantilla_apagada', 'la plantilla del correo de ingreso esta apagada en los ajustes del taller');
  const base = { destinatario: to, asunto: rendered.subject, idioma: lang, fotos: Math.min(emailPhotos(order).length, MAX_FOTOS_CORREO) };

  if (!force && (historyShowsSent(order) || (await loggedByClient(deps, tenantId, to, rendered.subject)))) {
    return result(false, 'ya_enviado', 'el correo de ingreso ya se habia enviado para este boleto', base);
  }

  const manualId = force ? (deps.uuid || crypto.randomUUID)() : null;
  const key = intakeDedupeKey(orderId, manualId);
  const c = await claim(deps, { tenantId, orderId, to, rendered, key, sender, actor, manual });
  if (c.mode === 'error') {
    console.warn('correo de ingreso: no se pudo reclamar el envio', c.error?.message);
    return result(false, 'registro_fallo', 'no se pudo registrar el envio en email_log; no se envio para no duplicar', base);
  }
  if (c.mode === 'key' && !c.owner) {
    if (c.state === 'sent') return result(false, 'ya_enviado', 'el correo de ingreso ya se habia enviado para este boleto', { ...base, log_id: c.logId });
    return result(false, 'en_proceso', 'otro envio del correo de ingreso esta en curso para este boleto', { ...base, log_id: c.logId });
  }

  const sent = await postEmail(emailPayload({ to, subject: rendered.subject, html: rendered.html, tenant }), deps);
  let logId = c.logId || null;
  if (c.mode === 'key') await closeClaim(deps, tenantId, logId, { ok: sent.ok, error: sent.error, html: rendered.html, now: now() });
  else logId = await legacyLog(deps, tenantId, { to, rendered, ok: sent.ok, error: sent.error, now: now() });

  const modo = c.mode === 'key' ? 'llave' : 'sin_llave';
  if (!sent.ok) return result(false, 'fallo_envio', sent.error || 'el servicio de correo fallo', { ...base, log_id: logId, modo, reintentable: true });
  await noteHistory(deps, orderId, { subject: rendered.subject, lang, logId, actor, now: now() });
  return result(true, 'enviado', null, { ...base, log_id: logId, modo, ...(c.retry ? { reintento: true } : {}), ...(force ? { forzado: true } : {}) });
}

export function vercelWaitUntil() {
  try {
    const ctx = globalThis[Symbol.for('@vercel/request-context')];
    const fn = ctx?.get?.()?.waitUntil;
    return typeof fn === 'function' ? fn : null;
  } catch {
    return null;
  }
}

export async function intakeAfterCreate(params, deps, { capMs = AFTER_CREATE_CAP_MS } = {}) {
  const task = Promise.resolve()
    .then(() => sendIntakeEmail({ ...params, automatic: true, force: false }, deps))
    .catch((e) => {
      console.warn('correo de ingreso fallo sin romper la creacion:', e?.message || e);
      return result(false, 'fallo_envio', String(e?.message || e), { reintentable: true });
    });
  const waitUntil = deps.waitUntil === undefined ? vercelWaitUntil() : deps.waitUntil;
  if (typeof waitUntil === 'function') {
    try { waitUntil(task); } catch {}
  }
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(null), capMs);
  });
  const r = await Promise.race([task, timeout]);
  clearTimeout(timer);
  if (r) return r;
  return result(false, 'pendiente', typeof waitUntil === 'function'
    ? 'el correo de ingreso se sigue enviando en segundo plano'
    : 'el correo de ingreso no termino a tiempo; quedo pendiente en email_log y se puede reenviar', { pendiente: true });
}

async function resolveOrderId(deps, tenantId, ref) {
  const value = decodeURIComponent(String(ref || '')).trim();
  if (!value) return null;
  if (UUID_RE.test(value)) return value.toLowerCase();
  const clean = value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase().slice(0, 30);
  if (!clean) return null;
  const candidates = [...new Set([clean, /^\d+$/.test(clean) ? `WO-${clean}` : clean])].map((c) => `"${c}"`).join(',');
  const rows = await deps.sb(`order?tenant_id=eq.${tenantId}&is_deleted=eq.false&order_number=in.(${candidates})&select=id&limit=1`);
  return rows?.[0]?.id || null;
}

export function canForce(role) {
  return FORCE_ROLES.test(String(role || ''));
}

export async function resendIntakeFromRequest({ ref, body, auth }, deps) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const forzar = b.forzar === true;
  if (forzar && !canForce(auth?.role)) return { status: 403, body: { ok: false, error: 'Solo el dueno o un administrador puede forzar el reenvio', code: 'forzar_no_autorizado' } };
  const orderId = await resolveOrderId(deps, auth.tenantId, ref);
  if (!orderId) return { status: 404, body: { ok: false, error: 'Boleto no encontrado', code: 'not_found' } };
  if (b.confirmar !== true) {
    const order = await loadOrder(deps, auth.tenantId, orderId);
    if (!order) return { status: 404, body: { ok: false, error: 'Boleto no encontrado', code: 'not_found' } };
    const tenant = await loadTenant(deps, auth.tenantId);
    const lang = await loadLanguage(deps, auth.tenantId, order);
    const rendered = renderIntakeEmail({ order, tenant, lang });
    const to = String(order.customer_email || '').trim();
    const yaEnviado = historyShowsSent(order) || (to ? await loggedByClient(deps, auth.tenantId, to, rendered.subject) : false);
    return {
      status: 400,
      body: {
        ok: false,
        error: 'Confirma el reenvio con confirmar:true',
        code: 'confirmacion_requerida',
        vista_previa: { boleto: order.order_number || orderId, para: to || null, asunto: rendered.subject, idioma: lang, plantilla_activa: rendered.active, ya_enviado: yaEnviado },
      },
    };
  }
  const origen = ['ios', 'android', 'web'].includes(String(b.origen || '').toLowerCase()) ? String(b.origen).toLowerCase() : 'servidor';
  const r = await sendIntakeEmail({ tenantId: auth.tenantId, orderId, sender: origen, actor: auth.label || 'Usuario', force: forzar, manual: true, automatic: false }, deps);
  if (r.codigo === 'no_encontrado') return { status: 404, body: { ok: false, error: 'Boleto no encontrado', code: 'not_found' } };
  if (r.codigo === 'fallo_envio' || r.codigo === 'registro_fallo') return { status: 502, body: { ok: false, error: r.motivo, code: r.codigo, correo: r } };
  return { status: 200, body: { ok: true, enviado: r.enviada, correo: r } };
}
