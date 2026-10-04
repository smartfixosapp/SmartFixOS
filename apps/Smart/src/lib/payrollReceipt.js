const pdfSafe = (s) => String(s ?? "").normalize("NFC").replace(/[^\x20-\xff]/g, (c) => ({ "–": "-", "—": "-", "→": "->" }[c] || "?"));
const money = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);

export const PAY_METHOD_LABEL = { cash: "Efectivo", card: "Tarjeta", ath_movil: "ATH Móvil", transfer: "Transferencia", check: "Cheque" };
export const PAY_METHOD_COLOR = { cash: "#4DC780", card: "#66B3FF", ath_movil: "#BF5AF2", transfer: "#0A84FF", check: "#8E8E93" };

export async function buildPayrollReceiptPDF({ tenant, employeeName, role, hours, rate, method, date, periodLabel, amount }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612;
  const L = 48;
  const R = W - 48;
  const text = (t, x, y, { size = 11, style = "normal", color = [0, 0, 0], align } = {}) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(pdfSafe(t), x, y, { baseline: "top", align });
  };
  let y = 48;
  text(tenant?.name || tenant?.admin_name || "Taller", L, y, { size: 22, style: "bold" });
  y += 28;
  if (tenant?.address) { text(tenant.address, L, y, { size: 11, color: [110, 110, 110] }); y += 16; }
  y += 6;
  doc.setDrawColor(190, 190, 190);
  doc.line(L, y, R, y);
  y += 18;
  text("COMPROBANTE DE NOMINA", L, y, { size: 18, style: "bold" });
  const d = new Intl.DateTimeFormat("es-PR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(date || new Date());
  text(d.replace(",", " ·"), R, y + 4, { size: 10, color: [110, 110, 110], align: "right" });
  y += 40;
  text("DETALLE DEL PAGO", L, y, { size: 10, style: "bold", color: [110, 110, 110] });
  y += 20;
  const pair = (l1, v1, l2, v2) => {
    text(l1, L, y, { size: 9, style: "bold", color: [110, 110, 110] });
    text(v1, L, y + 13, { size: 13, style: "bold" });
    if (l2) { text(l2, W / 2 + 10, y, { size: 9, style: "bold", color: [110, 110, 110] }); text(v2, W / 2 + 10, y + 13, { size: 13, style: "bold" }); }
    y += 44;
  };
  pair("EMPLEADO", employeeName, "ROL", role || "");
  if (hours !== null && hours !== undefined) pair("HORAS TRABAJADAS", `${(Number(hours) || 0).toFixed(1)} h`, "TARIFA POR HORA", money(rate));
  pair("METODO DE PAGO", PAY_METHOD_LABEL[method] || method, "FECHA", new Intl.DateTimeFormat("es-PR", { dateStyle: "medium" }).format(date || new Date()));
  if (periodLabel) pair("PERIODO", periodLabel);
  y += 6;
  doc.setFillColor(242, 242, 242);
  doc.roundedRect(L, y, R - L, 70, 10, 10, "F");
  text("TOTAL PAGADO", L + 18, y + 14, { size: 10, style: "bold", color: [110, 110, 110] });
  text(money(amount), L + 18, y + 32, { size: 26, style: "bold", color: [30, 130, 70] });
  text("Generado con Archilla OS · Este comprobante no sustituye documentos oficiales de nomina.", W / 2, 740, { size: 8, color: [160, 160, 160], align: "center" });
  return doc.output("blob");
}

export const receiptFileName = (name) => `Nomina_${String(name || "Empleado").trim().replace(/\s+/g, "_")}.pdf`;
