import QRCode from "qrcode";
import { abandonmentText } from "@/lib/wizard/helpers";
import { statusInfo } from "@/lib/orderStatus";

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const pdfSafe = (s) => String(s ?? "").normalize("NFC").replace(/[^\x20-\xff]/g, (c) => ({ "–": "-", "—": "-", "→": "->", "•": "-", "×": "x", "✓": "" }[c] ?? "?"));

export const totalOf = (o) => (o.cost_estimate !== null && o.cost_estimate !== undefined && o.cost_estimate !== "" ? num(o.cost_estimate) : num(o.labor_cost));
export const balanceOf = (o) => (o.balance_due !== null && o.balance_due !== undefined && o.balance_due !== "" ? num(o.balance_due) : Math.max(0, totalOf(o) - num(o.amount_paid)));

function moneyFmt(tenant, forceUSD) {
  const cur = forceUSD ? "USD" : tenant?.currency || "USD";
  return (v) => { try { return new Intl.NumberFormat("es-PR", { style: "currency", currency: cur }).format(num(v)); } catch { return `$${num(v).toFixed(2)}`; } };
}

async function imageData(url) {
  if (!url) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { mode: "cors", signal: ctrl.signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => { const img = new Image(); img.onload = () => resolve({ url: r.result, w: img.naturalWidth, h: img.naturalHeight, fmt: /png/.test(blob.type) ? "PNG" : "JPEG" }); img.onerror = () => resolve(null); img.src = r.result; };
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const orderQrUrl = (order) => `smartfixos://order/${order.id}`;
export const qrData = (text, width = 300) => QRCode.toDataURL(text, { width, margin: 0, errorCorrectionLevel: "M" });

function deviceText(o) {
  const t = [o.device_type, o.device_brand, o.device_model].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
  return t || "—";
}

function deliveredDate(o) {
  let max = null;
  (Array.isArray(o.status_history) ? o.status_history : []).forEach((e) => { if (e?.status === "delivered" && e.timestamp) { const d = new Date(e.timestamp); if (!Number.isNaN(d.getTime()) && (!max || d > max)) max = d; } });
  return max;
}

const dateTime = (d) => new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short" }).format(d);
const stampNow = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Puerto_Rico", dateStyle: "short", timeStyle: "short" }).format(new Date());

export function serviceSummary(o) {
  const items = (Array.isArray(o.order_items) ? o.order_items : []).filter((i) => i && i.type !== "discount" && String(i.name || "").trim());
  if (items.length) return items.map((i) => (num(i.quantity) > 1 ? `${i.name} x${Math.trunc(num(i.quantity))}` : i.name)).join(", ");
  return String(o.initial_problem || "").trim();
}

async function build(kind, { order, tenant }) {
  const { jsPDF } = await import("jspdf");
  const quote = kind === "quote";
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const L = 40;
  const R = W - 40;
  const BRAND = [242, 102, 46];
  const GRAY = [100, 100, 100];
  const money = moneyFmt(tenant, quote);
  const text = (t, x, y, { size = 10, style = "normal", color = [0, 0, 0], align } = {}) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(pdfSafe(t), x, y, { baseline: "top", align });
  };
  const wrap = (t, w, size, style = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); return doc.splitTextToSize(pdfSafe(t), w); };
  const fit = (t, w, size, style = "normal") => { doc.setFont("helvetica", style); doc.setFontSize(size); let o = pdfSafe(t); if (doc.getTextWidth(o) <= w) return o; while (o.length > 1 && doc.getTextWidth(`${o}...`) > w) o = o.slice(0, -1); return `${o}...`; };
  let y = 40;
  const ensure = (need) => { if (y + need > H - 90) { doc.addPage(); y = 40; return true; } return false; };

  if (!quote) {
    const qr = await qrData(orderQrUrl(order));
    doc.addImage(qr, "PNG", R - 80, 40, 80, 80);
    text(order.order_number || "", R - 40, 123, { size: 9, align: "center" });
    text("Escanear para ver orden", R - 40, 135, { size: 7, color: [170, 170, 170], align: "center" });
  }
  text(tenant?.name || "Taller de Reparación", L, y, { size: 22, style: "bold" });
  y += 26;
  [tenant?.address, tenant?.admin_phone && `Tel: ${tenant.admin_phone}`, tenant?.email, !quote && String(tenant?.settings?.merchant_registration || "").trim() && `Reg. Comerciante: ${tenant.settings.merchant_registration}`].filter(Boolean).forEach((l) => { text(l, L, y, { size: 10, color: GRAY }); y += 13; });
  y = Math.max(y, quote ? y : 128) + 4;
  doc.setDrawColor(190, 190, 190);
  doc.line(L, y, R, y);
  y += 12;
  if (quote) {
    text("COTIZACIÓN", L, y, { size: 18, style: "bold", color: BRAND });
    text(`Orden ${order.order_number || ""}`, R, y + 2, { size: 14, style: "bold", align: "right" });
    y += 26;
    text(`Emitida: ${new Intl.DateTimeFormat("es-PR", { day: "numeric", month: "short", year: "numeric" }).format(new Date())}`, L, y, { size: 10, color: GRAY });
    y += 18;
    doc.setFillColor(253, 235, 226);
    doc.setDrawColor(247, 181, 155);
    doc.roundedRect(L, y, R - L, 56, 6, 6, "FD");
    text("ESTA ES UNA ESTIMACIÓN, NO UN COBRO", L + 12, y + 10, { size: 11, style: "bold", color: BRAND });
    const valid = new Intl.DateTimeFormat("es-PR", { day: "numeric", month: "short", year: "numeric" }).format(new Date(Date.now() + 7 * 86400000));
    text(`Válida hasta el ${valid} (7 días). Confirma para iniciar el trabajo.`, L + 12, y + 30, { size: 10 });
    y += 70;
  } else {
    text(order.paid ? "RECIBO DE PAGO" : "RECIBO", L, y, { size: 18, style: "bold" });
    y += 24;
    text(`Orden ${order.order_number || ""}`, L, y, { size: 12, style: "bold", color: GRAY });
    y += 16;
    text(`Fecha: ${order.created_date ? dateTime(new Date(order.created_date)) : ""}`, L, y, { size: 10, color: GRAY });
    y += 13;
    const del = deliveredDate(order);
    if (del) { text(`Entregado: ${dateTime(del)}`, L, y, { size: 10, color: GRAY }); y += 13; }
    y += 10;
  }

  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(190, 190, 190);
  doc.roundedRect(L, y, R - L, 64, 6, 6, "FD");
  text("CLIENTE", L + 12, y + 8, { size: 9, style: "bold", color: GRAY });
  text(fit(order.customer_name || "—", R - L - 24, 13, "bold"), L + 12, y + 22, { size: 13, style: "bold" });
  text(fit([order.customer_phone, order.customer_email].filter(Boolean).join(" · "), R - L - 24, 10.5), L + 12, y + 42, { size: 10.5, color: GRAY });
  y += 78;

  text("DISPOSITIVO", L, y, { size: 9, style: "bold", color: GRAY });
  y += 13;
  text(fit(deviceText(order), R - L, 12, "bold"), L, y, { size: 12, style: "bold" });
  y += 16;
  if (order.device_serial) { text(`Serial / IMEI: ${order.device_serial}`, L, y, { size: 10, color: GRAY }); y += 14; }
  y += 6;

  const problem = String(order.initial_problem || "").trim();
  text("PROBLEMA REPORTADO", L, y, { size: 9, style: "bold", color: GRAY });
  y += 13;
  const pl = wrap(problem || "—", R - L, 10.5);
  const visible = quote ? pl.slice(0, 3) : pl;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(0, 0, 0);
  doc.text(visible, L, y, { baseline: "top" });
  y += quote ? 40 + 8 : visible.length * 13 + 10;

  if (!quote) {
    const svc = serviceSummary(order);
    if (svc && svc !== problem) {
      ensure(40);
      text("SERVICIO REALIZADO", L, y, { size: 9, style: "bold", color: GRAY });
      y += 13;
      const sl = wrap(svc, R - L, 10.5);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(0, 0, 0);
      doc.text(sl, L, y, { baseline: "top" });
      y += sl.length * 13 + 10;
    }
  }

  const photoUrl = Array.isArray(order.device_photos) ? (typeof order.device_photos[0] === "string" ? order.device_photos[0] : order.device_photos[0]?.url) : null;
  const photo = await imageData(photoUrl);
  if (photo) {
    ensure(140);
    text("FOTO DEL DISPOSITIVO", L, y, { size: 9, style: "bold", color: GRAY });
    y += 13;
    const scale = Math.min(120 / photo.h, (R - L) / photo.w);
    try { doc.addImage(photo.url, photo.fmt, L, y, photo.w * scale, photo.h * scale); y += photo.h * scale + 12; } catch { y += 0; }
  }

  const items = (Array.isArray(order.order_items) ? order.order_items : []).filter((i) => i);
  const tableW = R - L;
  const cDesc = L + 30;
  const cQty = L + tableW - 175;
  const cPrice = L + tableW - 95;
  const cTot = L + tableW - 8;
  const header = () => {
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(L, y, tableW, 22, 4, 4, "F");
    const hy = y + 7;
    text("#", L + 8, hy, { size: 8, style: "bold", color: GRAY });
    text("DESCRIPCIÓN", cDesc, hy, { size: 8, style: "bold", color: GRAY });
    text("CANT", cQty, hy, { size: 8, style: "bold", color: GRAY, align: "right" });
    text("PRECIO", cPrice, hy, { size: 8, style: "bold", color: GRAY, align: "right" });
    text("TOTAL", cTot, hy, { size: 8, style: "bold", color: GRAY, align: "right" });
    y += 22;
  };
  if (items.length) {
    ensure(60);
    header();
    items.forEach((it, i) => {
      if (y + 26 > H - 90) { doc.addPage(); y = 40; if (!quote) header(); }
      if (i % 2 === 1) { doc.setFillColor(247, 247, 247); doc.rect(L, y, tableW, 24, "F"); }
      const disc = it.type === "discount";
      const color = disc && !quote ? [200, 40, 40] : [0, 0, 0];
      text(String(i + 1), L + 8, y + 7, { size: 10, color: GRAY });
      text(fit(it.name || "—", cQty - cDesc - 50, 10), cDesc, y + 7, { size: 10, color });
      text(disc ? "" : String(Math.trunc(num(it.quantity) || 1)), cQty, y + 7, { size: 10, align: "right" });
      text(disc ? "" : money(num(it.price)), cPrice, y + 7, { size: 10, align: "right" });
      text(money(num(it.total !== undefined && it.total !== null ? it.total : num(it.price) * num(it.quantity || 1))), cTot, y + 7, { size: 10, style: "bold", color, align: "right" });
      y += 24;
    });
    y += 8;
  }

  ensure(120);
  const lx = R - 210;
  const row = (l, v, o = {}) => {
    text(l, lx, y, { size: o.size || 10, color: GRAY, style: o.style || "normal" });
    text(v, R, y, { size: o.size || 10, style: "bold", color: o.color || [0, 0, 0], align: "right" });
    y += o.gap || 16;
  };
  const total = totalOf(order);
  if (quote) {
    if (num(order.cost_estimate) > 0) row("Cotización piezas:", money(order.cost_estimate));
    if (num(order.labor_cost) > 0) row("Mano de obra:", money(order.labor_cost));
    doc.setDrawColor(190, 190, 190);
    doc.line(lx, y + 2, R, y + 2);
    y += 10;
    row("ESTIMADO TOTAL:", money(total), { size: 14, color: BRAND, gap: 22 });
  } else {
    if (num(order.cost_estimate) > 0) row("Cotización:", money(order.cost_estimate));
    if (num(order.labor_cost) > 0) row("Mano de obra:", money(order.labor_cost));
    row("Total:", money(total), { size: 12 });
    doc.setDrawColor(190, 190, 190);
    doc.line(lx, y + 2, R, y + 2);
    y += 10;
    row("Pagado:", money(order.amount_paid), { size: 13, color: [30, 150, 70], gap: 20 });
    const bal = balanceOf(order);
    if (bal > 0.004) row("Balance:", money(bal), { size: 13, color: BRAND, gap: 20 });
    else { text("PAGADO", R, y, { size: 14, style: "bold", color: [30, 150, 70], align: "right" }); y += 22; }
  }

  y += 10;
  ensure(quote ? 100 : 80);
  const terms = quote
    ? ["La cotización es estimada — el costo final puede variar si al abrir el equipo aparecen daños adicionales.", "Notificaremos cualquier cambio de presupuesto antes de continuar.", "Aceptación de la cotización por WhatsApp / mensaje queda constancia.", "La cotización es válida por 7 días desde la fecha de emisión.", abandonmentNote(tenant)]
    : [`Las piezas instaladas tienen garantía de ${order.warranty_days ?? 30} días contra defectos de fábrica.`, "La garantía no cubre golpes, agua, manipulación de terceros, o uso indebido.", "Para reclamos de garantía, presentar este recibo con el dispositivo.", "Equipos no reclamados después de 30 días se considerarán abandonados."];
  text(quote ? "TÉRMINOS DE LA COTIZACIÓN" : "TÉRMINOS DE GARANTÍA", L, y, { size: 9, style: "bold", color: GRAY });
  y += 14;
  terms.forEach((t) => {
    const ls = wrap(`- ${t}`, R - L, 9);
    if (y + ls.length * 11 > H - 90) { doc.addPage(); y = 40; }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    doc.text(ls, L, y, { baseline: "top" });
    y += ls.length * 11 + 2;
  });

  const sigUrl = order.device_security?.signatureUrl || order.device_security?.signature_url;
  let sig = await imageData(sigUrl);
  if (!sig && sigUrl) sig = await imageData(sigUrl);
  if (!sig && sigUrl) throw new Error("No se pudo cargar la firma del cliente. Revisa tu conexión e inténtalo de nuevo.");
  if (sig) {
    if (y > H - 160) { doc.addPage(); y = 40; }
    y += 10;
    text("FIRMA DEL CLIENTE", L, y, { size: 9, style: "bold", color: GRAY });
    y += 13;
    const sc = Math.min(80 / sig.h, 200 / sig.w);
    try { doc.addImage(sig.url, sig.fmt, L, y, sig.w * sc, sig.h * sc); y += sig.h * sc + 6; } catch { y += 0; }
    text("El cliente acepta los términos y condiciones del servicio.", L, y, { size: 8.5, color: GRAY });
  }

  const pages = doc.getNumberOfPages();
  doc.setPage(pages);
  if (quote) text("Confirma para iniciar el trabajo", W / 2, H - 60, { size: 11, style: "bold", color: BRAND, align: "center" });
  else text("Gracias por su preferencia", W / 2, H - 60, { size: 11, style: "bold", align: "center" });
  text(`Generado por Archilla OS · ${stampNow()}`, W / 2, H - 30, { size: 8, color: [170, 170, 170], align: "center" });
  doc.setProperties({ title: `${quote ? "Cotización" : "Recibo"} ${order.order_number || ""}` });
  return doc.output("blob");
}

function abandonmentNote(tenant) {
  return abandonmentText(tenant);
}

export const buildReceiptPDF = (args) => build("receipt", args);
export const buildQuotePDF = (args) => build("quote", args);
export const docFileName = (kind, order) => `${kind === "quote" ? "Cotizacion" : "Recibo"}-${String(order.order_number || order.id).replace(/\//g, "-")}.pdf`;
export const QUOTE_STATUSES = ["intake", "diagnosing", "waiting_customer", "pending_order", "waiting_parts", "reparacion_externa", "part_arrived_waiting_device"];

export async function printLabel(order, tenant) {
  const qr = await qrData(orderQrUrl(order), 360);
  const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const device = [order.device_brand, order.device_model].filter(Boolean).join(" ");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta ${esc(order.order_number)}</title><style>@page{size:200pt 110pt;margin:0}html,body{margin:0;padding:0}body{width:200pt;height:110pt;font-family:-apple-system,Helvetica,Arial,sans-serif}.box{position:absolute;inset:1pt;border:0.75pt solid #000;border-radius:6pt;overflow:hidden}.qr{position:absolute;left:4pt;top:50%;transform:translateY(-50%);width:90pt;height:90pt}.col{position:absolute;left:100pt;right:4pt;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center;gap:3pt}.col div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style></head><body><div class="box"><img class="qr" src="${qr}"><div class="col"><div style="font-size:7pt;font-weight:600">${esc(tenant?.name || "Taller")}</div><div style="font-size:18pt;font-weight:900">${esc(order.order_number)}</div><div style="font-size:9pt;font-weight:600">${esc(device)}</div><div style="font-size:8pt;font-weight:600">${esc(statusInfo(order.status).label)}</div><div style="font-size:6.5pt">Escanear para ver historial</div></div></div></body></html>`;
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  await new Promise((r) => { const img = doc.querySelector("img"); if (!img || img.complete) r(); else { img.onload = r; img.onerror = r; } });
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 60000);
}

export const labelsEnabled = () => { try { return localStorage.getItem("print.labelsEnabled") === "true"; } catch { return false; } };
export const setLabelsEnabled = (v) => { try { localStorage.setItem("print.labelsEnabled", v ? "true" : "false"); } catch { return; } };
