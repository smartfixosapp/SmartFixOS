import { supabase } from "../../../../../lib/supabase-client.js";
import { zonedParts, zonedDate, startOfDay, addDays, daysBetween, fmt, monthStart, addMonths } from "./tz";
import { num } from "./ledger";

export const isRev = (tx) => tx.type === "revenue";
export const isExp = (tx) => tx.type === "expense";
export const isPayroll = (tx) => tx.category === "payroll";
export const isOpExpense = (tx) => isExp(tx) && !isPayroll(tx);
const txTime = (tx) => (tx.created_at ? new Date(tx.created_at) : null);
const sumAmt = (rows) => rows.reduce((s, t) => s + num(t.amount), 0);

const CAT_LABEL = {
  repair: "Reparaciones", deposit: "Depósitos", balance: "Balances", sale: "Ventas", rent: "Renta", utilities: "Servicios",
  supplies: "Insumos", marketing: "Marketing", repairs: "Reparaciones local", taxes: "Impuestos", parts: "Piezas", payroll: "Nómina",
};

export function capitalizeWords(s) {
  return String(s || "").toLowerCase().replace(/(^|[\s_-])\S/g, (c) => c.toUpperCase());
}

export function categorySpanish(cat) {
  return CAT_LABEL[cat] || capitalizeWords(cat);
}

export function methodSpanish(m) {
  const k = String(m || "").toLowerCase();
  const map = { cash: "Efectivo", card: "Tarjeta", ath: "ATH Móvil", ath_movil: "ATH Móvil", transfer: "Transferencia", check: "Cheque" };
  if (map[k]) return map[k];
  return k ? capitalizeWords(m) : "—";
}

export function reportRange({ month, customStart, customEnd, tz }) {
  if (customStart && customEnd) return { start: startOfDay(customStart, tz), end: addDays(startOfDay(customEnd, tz), 1, tz) };
  const start = monthStart(month, tz);
  return { start, end: addMonths(start, 1, tz) };
}

export function applyFilters(txs, employeeFilter, methodFilter) {
  return txs.filter((tx) => {
    if (employeeFilter.size && !(tx.recorded_by && employeeFilter.has(tx.recorded_by))) return false;
    if (methodFilter.size && !(tx.payment_method && methodFilter.has(tx.payment_method))) return false;
    return true;
  });
}

export function pnlTotals(txs) {
  const revenue = sumAmt(txs.filter(isRev));
  const expenses = sumAmt(txs.filter(isOpExpense));
  const payroll = sumAmt(txs.filter(isPayroll));
  const saleCount = txs.filter(isRev).length;
  return { revenue, expenses, payroll, net: revenue - expenses - payroll, saleCount, avgTicket: saleCount ? revenue / saleCount : 0 };
}

export function momPct(current, previous) {
  if (!(previous > 0)) return null;
  return ((current - previous) / previous) * 100;
}

export function grouped(txs) {
  const by = {};
  txs.forEach((t) => { const k = t.category || "other"; (by[k] = by[k] || []).push(t); });
  return Object.entries(by).map(([key, items]) => ({
    key,
    label: categorySpanish(key),
    total: sumAmt(items),
    count: items.length,
    txs: [...items].sort((a, b) => (txTime(b)?.getTime() || 0) - (txTime(a)?.getTime() || 0)),
  })).sort((a, b) => b.total - a.total);
}

function weekOfMonth(d, tz) {
  const p = zonedParts(d, tz);
  const firstWeekday = zonedParts(zonedDate(p.y, p.m, 1, tz), tz).weekday;
  return Math.floor((p.d - 1 + firstWeekday - 1) / 7) + 1;
}

export function spansMultipleWeeks(txs, tz) {
  const dates = txs.map(txTime).filter(Boolean);
  if (!dates.length) return false;
  const min = new Date(Math.min(...dates.map((d) => d.getTime())));
  const max = new Date(Math.max(...dates.map((d) => d.getTime())));
  return weekOfMonth(min, tz) !== weekOfMonth(max, tz);
}

export function weeklySubtotals(txs, tz) {
  const by = {};
  txs.forEach((t) => { const d = txTime(t); const w = d ? weekOfMonth(d, tz) : 0; (by[w] = by[w] || []).push(t); });
  return Object.entries(by).map(([w, items]) => ({ label: `Semana ${w}`, total: sumAmt(items), count: items.length }))
    .sort((a, b) => (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));
}

export function dailySeries(txs, range, tz) {
  const startDay = startOfDay(range.start, tz);
  const totalDays = Math.max(1, daysBetween(startDay, range.end, tz));
  const elapsed = daysBetween(startDay, new Date(), tz);
  const capped = Math.max(1, Math.min(totalDays, Math.max(1, elapsed + 1)));
  const by = {};
  txs.forEach((t) => { const d = txTime(t); if (!d) return; const i = daysBetween(startDay, d, tz); by[i] = (by[i] || 0) + num(t.amount); });
  return Array.from({ length: capped }, (_, i) => by[i] || 0);
}

export function employeeStats(txs, prevTxs) {
  const by = {};
  const prev = {};
  txs.filter(isRev).forEach((t) => { const k = t.recorded_by || "—"; (by[k] = by[k] || []).push(t); });
  prevTxs.filter(isRev).forEach((t) => { const k = t.recorded_by || "—"; prev[k] = (prev[k] || 0) + num(t.amount); });
  return Object.entries(by).filter(([name]) => name && name !== "—").map(([name, items]) => {
    const revenue = sumAmt(items);
    return { name, revenue, txCount: items.length, avgTicket: items.length ? revenue / items.length : 0, prevRevenue: prev[name] || 0 };
  }).sort((a, b) => b.revenue - a.revenue);
}

export function productStats(sales, range, employeeFilter, byQty) {
  const rows = sales.filter((s) => {
    const d = s.created_at ? new Date(s.created_at) : null;
    if (d && !(d >= range.start && d < range.end)) return false;
    if (employeeFilter.size && !(s.employee && employeeFilter.has(s.employee))) return false;
    return true;
  });
  const by = {};
  rows.forEach((s) => (Array.isArray(s.items) ? s.items : []).forEach((it) => {
    const name = it?.product_name || "Sin nombre";
    const e = (by[name] = by[name] || { name, quantity: 0, revenue: 0, txCount: 0 });
    e.quantity += Math.trunc(Number(it?.quantity) || 0);
    e.revenue += num(it?.total);
    e.txCount += 1;
  }));
  const list = Object.values(by);
  return list.sort(byQty ? (a, b) => b.quantity - a.quantity : (a, b) => b.revenue - a.revenue);
}

async function selectTx(tenantId, from, to) {
  const { data, error } = await supabase.from("transaction").select("*").eq("tenant_id", tenantId).eq("is_deleted", false)
    .gte("created_at", from.toISOString()).lt("created_at", to.toISOString()).order("created_at", { ascending: false }).limit(2000);
  if (error) throw error;
  return data || [];
}

function decodeIVU(raw) {
  const r = Array.isArray(raw) ? raw[0] : raw;
  if (!r || typeof r !== "object") return null;
  const n = (v) => Number(v) || 0;
  return {
    grossTaxableSales: n(r.gross_taxable_sales),
    grossExemptSales: n(r.gross_exempt_sales),
    grossTotalSales: n(r.gross_total_sales),
    ivuCollected: n(r.ivu_collected),
    ivuPaidOnExpenses: n(r.ivu_paid_on_expenses),
    ivuDue: n(r.ivu_due),
    transactionCount: Math.trunc(n(r.transaction_count)),
    salesByTaxRate: (Array.isArray(r.sales_by_tax_rate) ? r.sales_by_tax_rate : []).map((x) => ({
      taxRate: n(x?.tax_rate), taxableSales: n(x?.taxable_sales), taxCollected: n(x?.tax_collected), transactionCount: Math.trunc(n(x?.transaction_count)),
    })),
  };
}

export async function loadReport({ tenantId, range, isCustom, month, tz }) {
  const span = range.end.getTime() - range.start.getTime();
  const prevStart = new Date(range.start.getTime() - span);
  const p = zonedParts(monthStart(month, tz), tz);
  const ivuTask = isCustom
    ? Promise.resolve(null)
    : supabase.rpc("get_ivu_monthly_report", { p_tenant_id: tenantId, p_year: p.y, p_month: p.m }).then(({ data, error }) => (error ? null : decodeIVU(data)), () => null);
  const [transactions, prev, ivu] = await Promise.all([
    selectTx(tenantId, range.start, range.end),
    selectTx(tenantId, prevStart, range.start).catch(() => []),
    ivuTask,
  ]);
  return { transactions, prev, ivu };
}

export async function loadSales({ tenantId, range }) {
  const { data, error } = await supabase.from("sale").select("*").eq("tenant_id", tenantId).eq("voided", false).eq("is_deleted", false)
    .gte("created_at", range.start.toISOString()).lt("created_at", range.end.toISOString()).order("created_at", { ascending: false }).limit(5000);
  if (error) return [];
  return data || [];
}

const DEFAULT_TAX_LABEL = {
  PR: "IVU", DO: "ITBIS", MX: "IVA", CO: "IVA", CR: "IVA", AR: "IVA", UY: "IVA", EC: "IVA", PE: "IVA", GT: "IVA", PA: "IVA", CA: "GST",
  GB: "VAT", UK: "VAT", ES: "VAT", FR: "VAT", DE: "VAT", IT: "VAT", NL: "VAT", PT: "VAT", IE: "VAT", US: "Sales Tax", BR: "ICMS",
};

export function tenantCountry(tenant) {
  const c = String(tenant?.country || "").trim().toUpperCase();
  return c || "PR";
}

export function resolvedTaxLabel(tenant) {
  const raw = String(tenant?.tax_label || "").trim();
  if (raw) return raw;
  return DEFAULT_TAX_LABEL[tenantCountry(tenant)] || "Impuesto";
}

export function screenTaxLabel(tenant) {
  const raw = String(tenant?.tax_label || "").trim();
  return raw || "IVU";
}

const PORTALS = {
  PR: { name: "SURI (Hacienda PR)", authority: "Hacienda PR", url: "https://suri.hacienda.pr.gov" },
  MX: { name: "SAT", authority: "SAT México", url: "https://www.sat.gob.mx" },
  CO: { name: "DIAN MUISCA", authority: "DIAN Colombia", url: "https://muisca.dian.gov.co" },
  DO: { name: "DGII", authority: "DGII República Dominicana", url: "https://dgii.gov.do" },
  AR: { name: "AFIP", authority: "AFIP Argentina", url: "https://www.afip.gob.ar" },
  CR: { name: "ATV", authority: "Hacienda Costa Rica", url: "https://www.hacienda.go.cr" },
  PE: { name: "SUNAT", authority: "SUNAT Perú", url: "https://www.sunat.gob.pe" },
  EC: { name: "SRI", authority: "SRI Ecuador", url: "https://www.sri.gob.ec" },
  CL: { name: "SII", authority: "SII Chile", url: "https://www.sii.cl" },
  US: { name: "State Tax Portal", authority: "tu estado", url: null },
};

const near = (a, b) => Math.abs(a - b) < 1e-6;

export function ratePercent(rate) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(rate * 100)}%`;
}

function rateLabel(rate, country) {
  if (rate === 0) return "Ventas exentas";
  if (country === "PR") {
    if (near(rate, 0.115)) return "Ventas tributables tasa estatal (11.5%)";
    if (near(rate, 0.105)) return "Ventas tributables tasa estatal (10.5%)";
    if (near(rate, 0.07)) return "Ventas alimentos preparados (7%)";
    if (near(rate, 0.04)) return "Servicios tributables tasa especial (4%)";
    if (near(rate, 0.01)) return "Ventas tasa municipal (1%)";
  }
  return `Ventas tributables tasa ${ratePercent(rate)}`;
}

export function suriSalesCode(rate, country) {
  if (country !== "PR") return null;
  if (near(rate, 0.115) || near(rate, 0.105)) return "L1";
  if (near(rate, 0.07)) return "L2";
  if (near(rate, 0.04)) return "L3";
  if (rate === 0) return "L3a";
  return null;
}

function suriCollectedCode(rate, country) {
  if (country !== "PR") return null;
  if (near(rate, 0.115) || near(rate, 0.105)) return "L5";
  if (near(rate, 0.07)) return "L5a";
  if (near(rate, 0.04)) return "L6";
  return null;
}

function instructionsFor(country, portal, taxLabel) {
  if (country === "PR") {
    return [
      "Abre el portal SURI en https://suri.hacienda.pr.gov",
      "Inicia sesión y entra a IVU → Planilla Mensual del período correspondiente.",
      "Copia cada línea L1–L9 del cuadro de arriba al campo equivalente de SURI.",
      `Verifica que el monto de L9 (${taxLabel} a remitir) coincide con el de SURI antes de radicar.`,
      "Guarda el confirmatorio que SURI genera al radicar.",
    ];
  }
  if (country === "MX") {
    return [
      "Abre el portal del SAT (https://www.sat.gob.mx).",
      "Entra a Declaraciones → IVA mensual del período.",
      "Usa los totales de arriba para llenar IVA trasladado e IVA acreditable.",
      "El neto a pagar coincide con la línea final del cuadro.",
    ];
  }
  if (country === "CO") {
    return [
      "Abre DIAN MUISCA (https://muisca.dian.gov.co).",
      "Selecciona Formulario 300 — Declaración bimestral / cuatrimestral de IVA.",
      "Carga los valores de ventas, IVA generado e IVA descontable desde el cuadro.",
    ];
  }
  return [
    `Abre el portal oficial de ${portal.authority}.`,
    `Localiza la declaración mensual de ${taxLabel}.`,
    "Copia los valores del cuadro al formulario correspondiente.",
    "Confirma que el neto a pagar coincide antes de radicar.",
  ];
}

const usd = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);

export function ivuPayload(report, tenant, monthLabel) {
  const country = tenantCountry(tenant);
  const taxLabel = resolvedTaxLabel(tenant);
  const portal = PORTALS[country] || { name: "portal oficial", authority: "autoridad fiscal", url: null };
  const fields = [];
  const sorted = [...report.salesByTaxRate].sort((a, b) => b.taxRate - a.taxRate);
  sorted.forEach((r) => fields.push({ group: "sales", label: rateLabel(r.taxRate, country), value: r.taxableSales, code: suriSalesCode(r.taxRate, country), isTotal: false, taxRate: r.taxRate }));
  fields.push({ group: "sales", label: "Total ventas", value: report.grossTotalSales, code: country === "PR" ? "L4" : null, isTotal: true });
  sorted.filter((r) => r.taxRate > 0).forEach((r) => fields.push({ group: "tax", label: `${taxLabel} recaudado tasa ${ratePercent(r.taxRate)}`, value: r.taxCollected, code: suriCollectedCode(r.taxRate, country), isTotal: false, taxRate: r.taxRate }));
  fields.push({ group: "tax", label: `Total ${taxLabel} recaudado`, value: report.ivuCollected, code: country === "PR" ? "L7" : null, isTotal: true });
  fields.push({ group: "tax", label: `${taxLabel} pagado en gastos deducibles`, value: report.ivuPaidOnExpenses, code: country === "PR" ? "L8" : null, isTotal: false });
  fields.push({ group: "netDue", label: `${taxLabel} a remitir a ${portal.authority}`, value: report.ivuDue, code: country === "PR" ? "L9" : null, isTotal: true });
  return {
    country, taxLabel, portal, fields, monthLabel,
    totalSales: report.grossTotalSales, totalTaxCollected: report.ivuCollected, totalTaxPaidOnExpenses: report.ivuPaidOnExpenses, totalTaxDue: report.ivuDue,
    instructions: instructionsFor(country, portal, taxLabel),
    disclaimer: "Este documento es un resumen interno generado por Archilla OS. No reemplaza la declaración oficial. El dueño o contador debe radicar los valores en el portal correspondiente del país.",
  };
}

export const IVU_GROUP_LABEL = { sales: "Ventas del período", tax: "Impuesto", netDue: "Neto a pagar" };

const csvSan = (s) => String(s || "").replace(/,/g, ";").replace(/\n/g, " ").replace(/"/g, "'");

export function buildCSV(txs, tz) {
  const rows = ["Fecha,Tipo,Categoría,Descripción,Empleado,Método,Monto,Orden"];
  const stamp = (d) => {
    const p = zonedParts(d, tz);
    const z = (n) => String(n).padStart(2, "0");
    return `${p.y}-${z(p.m)}-${z(p.d)} ${z(p.h)}:${z(p.mi)}:${z(p.s)}`;
  };
  [...txs].sort((a, b) => (txTime(a)?.getTime() || 0) - (txTime(b)?.getTime() || 0)).forEach((tx) => {
    const d = txTime(tx);
    const sign = isExp(tx) ? "-" : "";
    rows.push([d ? stamp(d) : "", tx.type || "", csvSan(tx.category), csvSan(tx.description), csvSan(tx.recorded_by), csvSan(tx.payment_method), `${sign}${num(tx.amount).toFixed(2)}`, csvSan(tx.order_number)].join(","));
  });
  return rows.join("\n");
}

const GREEN = [31, 166, 89];
const RED = [230, 64, 64];
const PURPLE = [115, 77, 217];
const BLUE = [0, 122, 255];

const pdfSafe = (s) => String(s || "").replace(/−/g, "-").replace(/→/g, ">");

export async function buildReportPDF({ tenant, monthLabel, transactions, payload }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612;
  const H = 792;
  const L = 40;
  const R = W - 40;
  const tint = (c, a) => c.map((v) => Math.round(255 - (255 - v) * a));
  const text = (s, x, y, { size = 10, style = "normal", color = [0, 0, 0], align } = {}) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(pdfSafe(s), x, y, { baseline: "top", align });
  };
  const footer = () => {
    const when = new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    text(`Generado por Archilla OS · ${when}`, W / 2, H - 30, { size: 8, color: [170, 170, 170], align: "center" });
  };
  const header = () => {
    let y = 40;
    text(tenant?.name || tenant?.admin_name || "Taller", L, y, { size: 20, style: "bold" });
    y += 24;
    if (tenant?.address) { text(tenant.address, L, y, { size: 9, color: [85, 85, 85] }); y += 12; }
    y += 2;
    doc.setDrawColor(...BLUE);
    doc.setLineWidth(1.5);
    doc.line(L, y, R, y);
    return y + 4;
  };
  const box = (x, y, w, h, color, label, value, labelSize, valueSize) => {
    doc.setFillColor(...tint(color, 0.1));
    doc.setDrawColor(...tint(color, 0.4));
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, w, h, 6, 6, "FD");
    text(label, x + 8, y + 8, { size: labelSize, style: "bold", color: tint(color, 0.85) });
    text(value, x + 8, y + 22, { size: valueSize, style: "bold", color });
  };

  let y = header() + 16;
  text("REPORTE MENSUAL", L, y, { size: 10, color: [128, 128, 128] });
  y += 14;
  text(monthLabel, L, y, { size: 26, style: "bold" });
  y += 50;
  const t = pnlTotals(transactions);
  const bw = (W - 80 - 12) / 4;
  [["INGRESOS", t.revenue, GREEN], ["GASTOS", t.expenses, RED], ["NÓMINA", t.payroll, PURPLE], ["UTILIDAD", t.net, t.net >= 0 ? GREEN : RED]]
    .forEach(([l, v, c], i) => box(L + i * (bw + 4), y, bw, 56, c, l, usd(v), 8, 15));
  y += 80;

  const ensure = (need) => {
    if (y + need > H - 50) { footer(); doc.addPage(); y = header() + 16; }
  };
  const section = (title, color) => {
    ensure(40);
    doc.setFillColor(...tint(color, 0.12));
    doc.roundedRect(L, y, W - 80, 18, 3, 3, "F");
    text(title, L + 8, y + 4, { size: 10, style: "bold", color });
    y += 20;
  };
  const row = (desc, amount, expense) => {
    ensure(16);
    const color = expense ? RED : GREEN;
    const amt = `${expense ? "-" : "+"}${usd(amount)}`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const maxW = R - L - 12 - doc.getTextWidth(amt) - 12;
    const d = doc.splitTextToSize(pdfSafe(desc), maxW)[0] || "";
    text(d, L + 12, y + 2, { size: 9.5, color: [85, 85, 85] });
    text(amt, R, y + 2, { size: 9.5, style: "bold", color, align: "right" });
    y += 16;
    doc.setDrawColor(211, 211, 211);
    doc.setLineWidth(0.3);
    doc.line(L, y, R, y);
  };
  const subtotal = (label, amount, expense) => {
    ensure(20);
    text(label, L + 8, y + 3, { size: 10, style: "bold" });
    text(`${expense ? "-" : "+"}${usd(amount)}`, R, y + 3, { size: 10, style: "bold", color: expense ? RED : GREEN, align: "right" });
    y += 20;
  };
  const byCat = (rows) => {
    const g = {};
    rows.forEach((tx) => { const k = tx.category || "other"; (g[k] = g[k] || []).push(tx); });
    return Object.keys(g).sort().map((k) => [k, g[k]]);
  };
  const revenues = transactions.filter(isRev);
  if (revenues.length) {
    section("INGRESOS", GREEN);
    byCat(revenues).forEach(([k, items]) => row(`${categorySpanish(k)} (${items.length})`, sumAmt(items), false));
    subtotal("Total Ingresos", sumAmt(revenues), false);
  }
  const expenses = transactions.filter(isOpExpense);
  if (expenses.length) {
    y += 8;
    section("GASTOS", RED);
    byCat(expenses).forEach(([k, items]) => row(`${categorySpanish(k)} (${items.length})`, sumAmt(items), true));
    subtotal("Total Gastos", sumAmt(expenses), true);
  }
  const payrolls = transactions.filter(isPayroll);
  if (payrolls.length) {
    y += 8;
    section("NÓMINA", PURPLE);
    payrolls.forEach((tx) => row(tx.description || "Pago empleado", num(tx.amount), true));
    subtotal("Total Nómina", sumAmt(payrolls), true);
  }
  y += 12;
  ensure(36);
  const net = sumAmt(revenues) - sumAmt(transactions.filter(isExp));
  const nc = net >= 0 ? GREEN : RED;
  doc.setFillColor(...tint(nc, 0.15));
  doc.roundedRect(L, y, W - 80, 28, 5, 5, "F");
  text(`UTILIDAD NETA: ${net >= 0 ? "+" : ""}${usd(net)}`, L + 10, y + 8, { size: 12, style: "bold", color: nc });
  footer();

  if (payload) {
    doc.addPage();
    y = header() + 16;
    text(`RESUMEN ${payload.taxLabel.toUpperCase()} DEL MES`, L, y, { size: 10, color: [128, 128, 128] });
    y += 14;
    text(payload.monthLabel, L, y, { size: 22, style: "bold" });
    y += 30;
    const tl = payload.taxLabel.toUpperCase();
    [["TOTAL VENTAS", payload.totalSales, GREEN], [`${tl} RECAUDADO`, payload.totalTaxCollected, BLUE], [`${tl} DEDUCIBLE`, payload.totalTaxPaidOnExpenses, PURPLE], [`${tl} A PAGAR`, payload.totalTaxDue, RED]]
      .forEach(([l, v, c], i) => box(L + i * (bw + 4), y, bw, 50, c, l, usd(v), 7, 14));
    y += 68;
    ["sales", "tax", "netDue"].forEach((g, gi) => {
      const rows = payload.fields.filter((f) => f.group === g);
      if (!rows.length) return;
      if (gi) y += 10;
      doc.setFillColor(240, 240, 240);
      doc.roundedRect(L, y, W - 80, 18, 3, 3, "F");
      text(IVU_GROUP_LABEL[g].toUpperCase(), L + 8, y + 4, { size: 9.5, style: "bold" });
      y += 20;
      rows.forEach((f) => {
        let x = L + 8;
        if (f.code) {
          doc.setFont("courier", "bold");
          doc.setFontSize(7.5);
          const cw = Math.max(doc.getTextWidth(f.code) + 8, 22);
          doc.setFillColor(...BLUE);
          doc.roundedRect(x, y + 1, cw, 12, 2, 2, "F");
          doc.setTextColor(255, 255, 255);
          doc.text(f.code, x + cw / 2, y + 7, { align: "center", baseline: "middle" });
          x += cw + 6;
        }
        text(f.label, x, y + 2, { size: 9.5, style: f.isTotal ? "bold" : "normal", color: f.isTotal ? [0, 0, 0] : [85, 85, 85] });
        text(usd(f.value), R, y + 2, { size: 10, style: "bold", color: f.isTotal ? [0, 0, 0] : [85, 85, 85], align: "right" });
        y += 15;
        doc.setDrawColor(224, 224, 224);
        doc.setLineWidth(0.3);
        doc.line(L + 8, y, R, y);
        y += 1;
      });
    });
    y += 16;
    const bh = payload.instructions.length * 13 + 30 + (payload.portal.url ? 12 : 0);
    doc.setFillColor(247, 247, 247);
    doc.setDrawColor(224, 224, 224);
    doc.setLineWidth(0.5);
    doc.roundedRect(L, y, W - 80, bh, 4, 4, "FD");
    text(`Cómo radicar en ${payload.portal.name}`, L + 10, y + 8, { size: 9, style: "bold" });
    y += 22;
    payload.instructions.forEach((step, i) => {
      doc.setFont("courier", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...BLUE);
      doc.text(`${i + 1}.`, L + 10, y, { baseline: "top" });
      text(step, L + 26, y, { size: 8, color: [85, 85, 85] });
      y += 13;
    });
    if (payload.portal.url) {
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...BLUE);
      doc.text(payload.portal.url, L + 26, y, { baseline: "top" });
      y += 12;
    }
    y += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(128, 128, 128);
    doc.text(doc.splitTextToSize(payload.disclaimer, R - L), L, y, { baseline: "top" });
    footer();
  }
  return doc.output("blob");
}

export function monthLongLabel(date, tz) {
  return fmt(date, tz, { month: "long", year: "numeric" });
}
