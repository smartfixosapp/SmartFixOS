import { lineItems, lineQty, num, cleanNotes, longDate, r2 } from "@/lib/comprasApi";

const pdfSafe = (s) => String(s ?? "").normalize("NFC").replace(/[^\x20-\xff\n]/g, (c) => ({ "→": "->", "–": "-", "—": "-", "×": "x" }[c] || "?"));
const money = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);

export async function buildPurchaseOrderPDF({ po, supplier, tenant }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const L = 40;
  const R = W - 40;
  const GRAY = [90, 90, 90];
  const text = (t, x, y, { size = 10, style = "normal", color = [0, 0, 0], align, font = "helvetica" } = {}) => {
    doc.setFont(font, style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(pdfSafe(t), x, y, { baseline: "top", align });
  };
  const fit = (t, maxW, size, style = "normal") => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    let out = pdfSafe(t);
    if (doc.getTextWidth(out) <= maxW) return out;
    while (out.length > 1 && doc.getTextWidth(`${out}...`) > maxW) out = out.slice(0, -1);
    return `${out}...`;
  };
  let y = 40;
  text(tenant?.admin_name || tenant?.name || "Taller", L, y, { size: 20, style: "bold" });
  y += 24;
  if (tenant?.admin_phone) { text(`Tel: ${tenant.admin_phone}`, L, y, { size: 10, color: GRAY }); y += 13; }
  y += 6;
  doc.setDrawColor(190, 190, 190);
  doc.setLineWidth(0.6);
  doc.line(L, y, R, y);
  y += 14;
  text("ORDEN DE COMPRA", L, y, { size: 18, style: "bold", color: [46, 97, 242] });
  text(po.po_number || "", R, y + 2, { size: 14, style: "bold", font: "courier", align: "right" });
  y += 26;
  text(`Fecha: ${longDate(po.order_date)}`, L, y, { size: 10, color: GRAY });
  if (po.expected_date) text(`Esperada: ${longDate(po.expected_date)}`, R, y, { size: 10, color: GRAY, align: "right" });
  y += 22;

  const sup = [supplier?.name || po.supplier_name || "Suplidor desconocido"];
  const lines = [[sup[0], 13, "bold", [0, 0, 0]]];
  if (supplier?.contact_name) lines.push([`Contacto: ${supplier.contact_name}`, 10.5, "normal", GRAY]);
  if (supplier?.phone) lines.push([`Tel: ${supplier.phone}`, 10.5, "normal", GRAY]);
  const boxH = lines.length * 15 + 28;
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(190, 190, 190);
  doc.roundedRect(L, y, W - 80, boxH, 6, 6, "FD");
  text("SUPLIDOR", L + 12, y + 8, { size: 9, style: "bold", color: GRAY });
  let iy = y + 22;
  lines.forEach(([t, size, style, color]) => { text(fit(t, W - 104, size, style), L + 12, iy, { size, style, color }); iy += 15; });
  y += boxH + 16;

  const tableW = W - 80;
  const cQty = L + tableW - 170;
  const cCost = L + tableW - 95;
  const cTot = L + tableW - 8;
  const header = () => {
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(L, y, tableW, 22, 4, 4, "F");
    const hy = y + 7;
    text("Descripción", L + 8, hy, { size: 8, style: "bold", color: GRAY });
    text("CANT", cQty, hy, { size: 8, style: "bold", color: GRAY, align: "right" });
    text("COSTO", cCost, hy, { size: 8, style: "bold", color: GRAY, align: "right" });
    text("TOTAL", cTot, hy, { size: 8, style: "bold", color: GRAY, align: "right" });
    y += 22;
  };
  header();
  lineItems(po).forEach((l, i) => {
    if (y > H - 190) { doc.addPage(); y = 40; header(); }
    if (i % 2 === 1) { doc.setFillColor(247, 247, 247); doc.rect(L, y, tableW, 24, "F"); }
    text(fit(l.product_name || "—", cQty - L - 60, 10), L + 8, y + 7, { size: 10 });
    text(String(lineQty(l)), cQty, y + 7, { size: 10, align: "right" });
    text(money(num(l.unit_cost)), cCost, y + 7, { size: 10, align: "right" });
    text(money(r2(lineQty(l) * num(l.unit_cost))), cTot, y + 7, { size: 10, style: "bold", align: "right" });
    y += 24;
  });
  y += 12;
  if (y + 90 > H - 70) { doc.addPage(); y = 40; }
  const lx = R - 200;
  const row = (label, value, bold) => {
    text(label, lx, y, { size: bold ? 13 : 10, style: bold ? "bold" : "normal", color: bold ? [46, 97, 242] : GRAY });
    text(value, R, y, { size: bold ? 13 : 10, style: "bold", color: bold ? [46, 97, 242] : [0, 0, 0], align: "right" });
    y += bold ? 20 : 15;
  };
  row("Subtotal:", money(po.subtotal !== null && po.subtotal !== undefined ? num(po.subtotal) : r2(lineItems(po).reduce((s, l) => s + lineQty(l) * num(l.unit_cost), 0))));
  row("Envío:", money(num(po.shipping_cost)));
  row("Impuesto:", money(num(po.tax_amount)));
  row("TOTAL:", money(num(po.total_amount)), true);
  const notes = cleanNotes(po.notes);
  if (notes) {
    y += 10;
    text("NOTAS", L, y, { size: 9, style: "bold", color: GRAY });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(doc.splitTextToSize(pdfSafe(notes), W - 80), L, y + 13, { baseline: "top" });
    y += 13 + doc.splitTextToSize(pdfSafe(notes), W - 80).length * 12;
  }
  if (po.tracking_number) { y += 10; text(`Tracking: ${po.tracking_number}`, L, y, { size: 10, color: GRAY }); }
  text("Generado por Archilla OS", W / 2, H - 30, { size: 8, color: [170, 170, 170], align: "center" });
  return doc.output("blob");
}
