import { supabase } from "../../../../lib/supabase-client.js";
import { sendRawEmail } from "@/lib/orderEmails";

export const DENOMINATIONS = [
  { id: "100", value: 100, label: "$100", isCoin: false },
  { id: "50", value: 50, label: "$50", isCoin: false },
  { id: "20", value: 20, label: "$20", isCoin: false },
  { id: "10", value: 10, label: "$10", isCoin: false },
  { id: "5", value: 5, label: "$5", isCoin: false },
  { id: "1", value: 1, label: "$1", isCoin: false },
  { id: "025", value: 0.25, label: "25¢", isCoin: true },
  { id: "010", value: 0.1, label: "10¢", isCoin: true },
  { id: "005", value: 0.05, label: "5¢", isCoin: true },
  { id: "001", value: 0.01, label: "1¢", isCoin: true },
];

const ADMIN_ROLES = ["owner", "admin", "manager", "contable"];

export function emptyCounts() {
  const out = {};
  DENOMINATIONS.forEach((d) => { out[d.id] = 0; });
  return out;
}

export function normalizeCounts(payload) {
  const out = {};
  DENOMINATIONS.forEach((d) => {
    const q = parseInt(payload?.[d.id], 10);
    out[d.id] = Number.isFinite(q) && q > 0 ? q : 0;
  });
  return out;
}

export function countsTotal(counts) {
  const cents = DENOMINATIONS.reduce((acc, d) => acc + Math.round(d.value * 100) * (counts?.[d.id] || 0), 0);
  return cents / 100;
}

export function sameCounts(a, b) {
  return DENOMINATIONS.every((d) => (a?.[d.id] || 0) === (b?.[d.id] || 0));
}

export function usd(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function readLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export const lastCloseKey = (tenantId) => `last_close_denoms_${tenantId}`;
export const standardKey = (tenantId) => `standard_open_denoms_${tenantId}`;
const openerKey = (tenantId, registerId) => `cash_register_opener_${tenantId}_${registerId}`;

export function savedDenoms(key) {
  const v = readLocal(key);
  return v && typeof v === "object" ? normalizeCounts(v) : null;
}

export function saveDenoms(key, counts) {
  writeLocal(key, normalizeCounts(counts));
}

export function employeeRoles(employee) {
  const roles = Array.isArray(employee?.roles) ? employee.roles : [];
  const all = [...roles, employee?.role].filter(Boolean).map((r) => String(r).toLowerCase());
  let pinned = "";
  try {
    pinned = String(localStorage.getItem("smartfix_tenant_role") || "").toLowerCase();
  } catch {
    pinned = "";
  }
  if (pinned) all.push(pinned);
  return all;
}

export function isAdminOrOwner(employee) {
  return employeeRoles(employee).some((r) => ADMIN_ROLES.includes(r));
}

export function employeeDisplayName(employee) {
  const n = String(employee?.full_name || "").trim();
  return n || "Usuario";
}

function safeTZ(tz) {
  const id = String(tz || "").trim();
  if (!id) return "America/Puerto_Rico";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: id });
    return id;
  } catch {
    return "America/Puerto_Rico";
  }
}

export function expectedCashFor(opening, summary) {
  return (Number(opening) || 0) + (summary?.totalCash || 0) - (summary?.cashExpenses || 0);
}

function todayInTZ(tz = "America/Puerto_Rico") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: safeTZ(tz), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dayInTZ(date, tz = "America/Puerto_Rico") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: safeTZ(tz), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function canCloseCashRegister({ register, employee, tenant }) {
  if (isAdminOrOwner(employee)) return true;
  if (!register) return false;
  const tz = safeTZ(tenant?.timezone);
  if (register.created_at && dayInTZ(new Date(register.created_at), tz) < todayInTZ(tz)) return true;
  const cached = readLocal(openerKey(register.tenant_id, register.id));
  if (cached) return !!employee?.id && String(cached) === String(employee.id);
  const opener = String(register.opened_by || "").trim().toLowerCase();
  if (!opener) return false;
  return String(employee?.full_name || "").trim().toLowerCase() === opener;
}

export async function fetchOpenRegister(tenantId) {
  const { data, error } = await supabase.from("cash_register").select("*").eq("tenant_id", tenantId).eq("status", "open").limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function fetchRegister(id) {
  if (!id) return null;
  const { data, error } = await supabase.from("cash_register").select("*").eq("id", id).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export function subscribeToRegisters(tenantId, onChange) {
  const ch = supabase
    .channel(`cash-register-${tenantId}-${Math.random().toString(36).slice(2, 8)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "cash_register", filter: `tenant_id=eq.${tenantId}` }, () => onChange())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}

async function currentUserId() {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

export async function sendOwnerPush(tenantId, title, body) {
  if (!tenantId || !title) return;
  const actor = await currentUserId();
  const payload = { tenant_id: tenantId, title, body };
  if (actor) payload.actor_user_id = actor;
  try {
    await supabase.functions.invoke("send-owner-push", { body: payload });
  } catch {
    return;
  }
}

function alreadyOpenMessage(existing) {
  const name = String(existing?.opened_by || "").trim();
  return name ? `Ya hay una caja abierta por ${name}.` : "Ya hay una caja abierta.";
}

export async function openRegister({ tenantId, counts, employee }) {
  const total = countsTotal(counts);
  const existing = await fetchOpenRegister(tenantId);
  if (existing) throw new Error(alreadyOpenMessage(existing));
  const openedBy = employeeDisplayName(employee);
  const { data, error } = await supabase
    .from("cash_register")
    .insert({
      tenant_id: tenantId,
      date: todayInTZ("America/Puerto_Rico"),
      status: "open",
      opening_balance: total,
      total_revenue: 0,
      total_expenses: 0,
      net_profit: 0,
      opened_by: openedBy,
    })
    .select("*")
    .single();
  if (error) {
    const msg = `${error.code || ""} ${error.message || ""}`;
    if (/409|23P01|23505|unique|idx_one_open_register/i.test(msg)) {
      const again = await fetchOpenRegister(tenantId).catch(() => null);
      if (again) throw new Error(alreadyOpenMessage(again));
      throw new Error("Ya hay una caja abierta en este momento.");
    }
    throw new Error(error.message || "No se pudo abrir la caja.");
  }
  if (employee?.id) writeLocal(openerKey(tenantId, data.id), employee.id);
  sendOwnerPush(tenantId, "Caja abierta", `${openedBy} abrió la caja · inicio ${usd(total)}`);
  try {
    window.dispatchEvent(new Event("cash-register-changed"));
  } catch {
    return data;
  }
  return data;
}

export const EMPTY_SUMMARY = {
  totalRevenue: 0,
  totalCash: 0,
  totalCard: 0,
  totalAth: 0,
  totalExpenses: 0,
  revenueByMethod: {},
  saleCount: 0,
  cashExpenses: 0,
  cashRefunds: 0,
  realProfit: 0,
};

export async function fetchShiftSummary(register, tenantId) {
  if (!register?.created_at) return { ...EMPTY_SUMMARY };
  const { data, error } = await supabase
    .from("transaction")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("created_at", new Date(register.created_at).toISOString())
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw error;
  let totalRevenue = 0;
  let totalExpenses = 0;
  let cashExpenses = 0;
  let cashRefunds = 0;
  let saleCount = 0;
  const byMethod = {};
  const now = Date.now();
  const cashKeys = ["cash", "efectivo"];
  (data || []).forEach((tx) => {
    const created = tx.created_at ? new Date(tx.created_at).getTime() : 0;
    if (created > now) return;
    const amount = Number(tx.amount) || 0;
    const method = String(tx.payment_method || "cash").toLowerCase();
    const type = String(tx.type || "").toLowerCase();
    if (type === "revenue") {
      totalRevenue += amount;
      byMethod[method] = (byMethod[method] || 0) + amount;
      if (tx.category === "sale" || tx.category === "repair_payment") saleCount += 1;
    } else if (type === "expense") {
      totalExpenses += amount;
      if (cashKeys.includes(method)) cashExpenses += Math.abs(amount);
    } else if (type === "refund") {
      const r = Math.abs(amount);
      totalRevenue -= r;
      byMethod[method] = (byMethod[method] || 0) - r;
      if (cashKeys.includes(method)) cashRefunds += r;
    }
  });
  let totalCash = 0;
  let totalCard = 0;
  let totalAth = 0;
  Object.entries(byMethod).forEach(([m, sum]) => {
    if (cashKeys.includes(m)) totalCash += sum;
    else if (["ath_movil", "ath", "movil", "athmovil"].includes(m)) totalAth += sum;
    else totalCard += sum;
  });
  return {
    totalRevenue,
    totalCash,
    totalCard,
    totalAth,
    totalExpenses,
    revenueByMethod: byMethod,
    saleCount,
    cashExpenses,
    cashRefunds,
    realProfit: totalRevenue - totalExpenses,
  };
}

export function summaryChanged(a, b) {
  if (a.saleCount !== b.saleCount) return true;
  const keys = ["totalRevenue", "totalCash", "totalCard", "totalAth", "totalExpenses", "cashExpenses", "cashRefunds"];
  return keys.some((k) => Math.abs((a[k] || 0) - (b[k] || 0)) > 0.005);
}

export async function fetchOpenTimeEntries(tenantId) {
  const { data, error } = await supabase
    .from("time_entry")
    .select("*")
    .eq("tenant_id", tenantId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(200);
  if (error) return [];
  const seen = new Set();
  return (data || [])
    .filter((e) => {
      const key = e.employee_id || e.id;
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((x, y) => new Date(x.clock_in || 0) - new Date(y.clock_in || 0));
}

export class RegisterAlreadyClosedError extends Error {
  constructor(closedBy) {
    const name = String(closedBy || "").trim();
    super(name ? `La caja ya fue cerrada por ${name}.` : "La caja ya fue cerrada en otro dispositivo.");
    this.name = "RegisterAlreadyClosedError";
  }
}

export async function closeRegister({ register, counts, employee, summary, observations }) {
  const opening = Number(register.opening_balance) || 0;
  const counted = countsTotal(counts);
  const expectedCash = expectedCashFor(opening, summary);
  const difference = counted - expectedCash;
  const closedBy = employeeDisplayName(employee);
  const nowIso = new Date().toISOString();
  const finalCount = {
    denominations: normalizeCounts(counts),
    counted_total: counted,
    expected_cash: expectedCash,
    difference,
    total_revenue: summary.totalRevenue,
    total_cash: summary.totalCash,
    total_card: summary.totalCard,
    total_ath: summary.totalAth,
    total_expenses: summary.totalExpenses,
    real_profit: summary.realProfit,
    revenue_by_method: summary.revenueByMethod,
    sale_count: summary.saleCount,
    observations: observations || "",
    closed_at: nowIso,
  };
  const { data, error } = await supabase
    .from("cash_register")
    .update({
      status: "closed",
      closing_balance: counted,
      total_revenue: summary.totalRevenue,
      total_expenses: summary.totalExpenses,
      net_profit: summary.realProfit,
      last_movement_at: nowIso,
      closed_by: closedBy,
      final_count: finalCount,
    })
    .eq("id", register.id)
    .eq("status", "open")
    .select("id");
  if (error) throw new Error(error.message || "No se pudo cerrar la caja. Intenta de nuevo.");
  if (!data || data.length === 0) {
    const current = await fetchRegister(register.id).catch(() => null);
    if (current && String(current.status || "").toLowerCase() !== "open") throw new RegisterAlreadyClosedError(current.closed_by);
    throw new Error("No se pudo cerrar la caja. Intenta de nuevo.");
  }
  const balanced = Math.abs(difference) <= 0.05;
  sendOwnerPush(register.tenant_id, "Caja cerrada", `${closedBy} cerró la caja · ${balanced ? "cuadró" : `diferencia ${usd(difference)}`}`);
  saveDenoms(lastCloseKey(register.tenant_id), counts);
  try {
    window.dispatchEvent(new Event("cash-register-changed"));
  } catch {
    return { counted, expectedCash, difference };
  }
  return { counted, expectedCash, difference };
}

export function openDuration(register) {
  if (!register?.created_at) return "—";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(register.created_at).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function esDateLabel(date) {
  const d = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric" }).formatToParts(date);
  const get = (t) => d.find((p) => p.type === t)?.value;
  const time = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  return `${get("day")} de ${get("month")}, ${get("year")} a las ${time}`;
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function buildClosingPDF({ tenant, register, closedBy, closedAt, opening, counted, expected, difference, summary, counts, observations }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = 612;
  const L = 40;
  let y = 40;
  const gray = [128, 128, 128];
  const dark = [85, 85, 85];
  const green = [52, 199, 89];
  const red = [255, 59, 48];
  const orange = [255, 149, 0];
  const blue = [0, 122, 255];
  const text = (s, x, yy, { size = 11, bold = false, color = [0, 0, 0], align = "left" } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(s), x, yy, { align, baseline: "top" });
  };
  const hr = (yy) => {
    doc.setDrawColor(209, 209, 209);
    doc.setLineWidth(0.5);
    doc.line(L, yy, W - L, yy);
  };
  const name = tenant?.name || "Taller";
  text(name, L, y, { size: 22, bold: true });
  y += 28;
  if (tenant?.address) {
    text(tenant.address, L, y, { size: 11, color: dark });
    y += 16;
  }
  hr(y + 6);
  y += 12 + 16;
  text("CIERRE DE CAJA", L, y, { size: 18, bold: true });
  const dateText = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(closedAt)
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  text(dateText, L, y + 22, { size: 11, color: dark });
  y += 40 + 20;
  text("INFORMACIÓN DEL TURNO", L, y, { size: 9, bold: true, color: gray });
  y += 14;
  const mid = W / 2;
  const openedAtStr = register?.created_at
    ? new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(register.created_at))
    : "—";
  const pair = (l1, v1, l2, v2) => {
    text(l1.toUpperCase(), L, y, { size: 9, bold: true, color: gray });
    text(v1, L, y + 12, { size: 12, bold: true });
    text(l2.toUpperCase(), mid, y, { size: 9, bold: true, color: gray });
    text(v2, mid, y + 12, { size: 12, bold: true });
    y += 28;
  };
  pair("Abierta por", register?.opened_by || "—", "Cerrada por", closedBy || "—");
  pair("Apertura", openedAtStr, "Saldo inicial", usd(opening));
  y += 18;
  text("RESUMEN FINANCIERO DEL TURNO", L, y, { size: 9, bold: true, color: gray });
  y += 16;
  const rows = [
    ["Efectivo recibido", summary.totalCash, [0, 0, 0], false],
    ["Tarjeta", summary.totalCard, [0, 0, 0], false],
    ["ATH Móvil", summary.totalAth, [0, 0, 0], false],
    ["INGRESOS TOTALES", summary.totalRevenue, green, true],
    ["Gastos del turno", -summary.totalExpenses, red, false],
    ["GANANCIA NETA", summary.realProfit, summary.realProfit >= 0 ? green : red, true],
  ];
  rows.forEach(([label, amount, color, isTotal]) => {
    text(label, L, y, { size: isTotal ? 12 : 11, bold: isTotal });
    text(usd(amount), W - L, y, { size: isTotal ? 12 : 11, bold: true, color, align: "right" });
    y += 18;
    if (isTotal) {
      hr(y - 4);
      y += 4;
    }
  });
  text(`${summary.saleCount} venta${summary.saleCount === 1 ? "" : "s"} procesadas`, L, y, { size: 10, color: dark });
  y += 18 + 18;
  text("CUADRE DE CAJA", L, y, { size: 9, bold: true, color: gray });
  y += 16;
  const balanced = Math.abs(difference) <= 0.05;
  const diffColor = balanced ? green : difference < 0 ? red : orange;
  const pad = 12;
  const cellW = (W - L * 2 - pad * 2) / 3;
  const cells = [["ESPERADO", expected, blue], ["CONTADO", counted, [0, 0, 0]], ["DIFERENCIA", difference, diffColor]];
  cells.forEach(([label, value, color], i) => {
    const x = L + i * (cellW + pad);
    doc.setDrawColor(...color);
    doc.setFillColor(Math.round(255 - (255 - color[0]) * 0.1), Math.round(255 - (255 - color[1]) * 0.1), Math.round(255 - (255 - color[2]) * 0.1));
    doc.setLineWidth(0.6);
    doc.roundedRect(x, y, cellW, 56, 8, 8, "FD");
    text(label, x + 10, y + 8, { size: 9, bold: true, color: dark });
    text(usd(value), x + 10, y + 26, { size: 16, bold: true, color });
  });
  y += 56 + 8;
  text(balanced ? "Cuadre exacto" : difference < 0 ? "Faltante de caja" : "Sobrante de caja", L, y, { size: 11, bold: true, color: diffColor });
  y += 18 + 18;
  text("DESGLOSE DE EFECTIVO", L, y, { size: 9, bold: true, color: gray });
  y += 16;
  const counted_ = DENOMINATIONS.filter((d) => (counts?.[d.id] || 0) > 0);
  if (counted_.length === 0) {
    text("Sin denominaciones contadas.", L, y, { size: 10, color: dark });
    y += 14;
  } else {
    counted_.forEach((d) => {
      const q = counts[d.id];
      text(d.label, L, y, { size: 10.5 });
      text(String(q), L + 220, y, { size: 10.5, bold: true, align: "right" });
      text(usd(q * d.value), W - L, y, { size: 10.5, bold: true, align: "right" });
      y += 16;
    });
  }
  if (observations) {
    y += 18;
    text("OBSERVACIONES", L, y, { size: 9, bold: true, color: gray });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(doc.splitTextToSize(observations, W - L * 2), L, y + 14, { baseline: "top" });
  }
  const footer = `Generado por Archilla OS · ${new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  text(footer, L, 792 - 30, { size: 8.5, color: gray });
  return doc.output("blob");
}

function stamp(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

export async function sendClosingEmail({ tenant, register, closedBy, closedAt, opening, counted, expected, difference, summary, counts, observations }) {
  const recipient = String(tenant?.email || "").trim();
  if (!recipient) return;
  const tenantName = tenant?.name || "Taller";
  let pdfURL = null;
  try {
    const blob = await buildClosingPDF({ tenant, register, closedBy, closedAt, opening, counted, expected, difference, summary, counts, observations });
    const uuid = (crypto?.randomUUID?.() || Math.random().toString(16).slice(2)).toUpperCase().slice(0, 8);
    const path = `closings/${register.tenant_id}/${stamp(closedAt)}-${uuid}.pdf`;
    const { error } = await supabase.storage.from("uploads").upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (!error) pdfURL = supabase.storage.from("uploads").getPublicUrl(path).data?.publicUrl || null;
  } catch {
    pdfURL = null;
  }
  const dateLabel = esDateLabel(closedAt);
  const balanced = Math.abs(difference) <= 0.05;
  const diffStatus = balanced ? "Cuadre exacto" : difference < 0 ? "Faltante" : "Sobrante";
  const diffColor = balanced ? "#22C55E" : difference < 0 ? "#EF4444" : "#F59E0B";
  const netColor = summary.realProfit >= 0 ? "#22C55E" : "#EF4444";
  const pdfBlock = pdfURL
    ? `<div style="margin:24px 0;padding:18px;background:#EEF2FF;border-radius:12px;text-align:center"><p style="margin:0 0 10px;font-size:14px;color:#4338CA">Reporte completo en PDF (cuadre, denominaciones, observaciones)</p><a href="${pdfURL}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:white;text-decoration:none;border-radius:8px;font-weight:600">Descargar PDF</a></div>`
    : "";
  const obs = String(observations || "").trim();
  const obsBlock = obs
    ? `<div style="margin-top:18px;padding:14px;background:#F4F4F5;border-radius:10px"><p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#737373;letter-spacing:0.5px">OBSERVACIONES</p><p style="margin:0;font-size:14px;color:#1F2937">${esc(obs)}</p></div>`
    : "";
  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#F9FAFB;margin:0;padding:24px">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.08)">
<div style="border-bottom:1px solid #E5E7EB;padding-bottom:18px;margin-bottom:22px"><h1 style="margin:0;font-size:22px;font-weight:800;color:#111827">${esc(tenantName)}</h1><p style="margin:6px 0 0;font-size:13px;color:#6B7280">Cierre de caja · ${dateLabel}</p></div>
<h2 style="margin:0 0 14px;font-size:16px;color:#111827">Resumen financiero</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><td style="padding:8px 0;color:#4B5563">Efectivo</td><td style="text-align:right;padding:8px 0;font-weight:600">${usd(summary.totalCash)}</td></tr>
<tr><td style="padding:8px 0;color:#4B5563">Tarjeta</td><td style="text-align:right;padding:8px 0;font-weight:600">${usd(summary.totalCard)}</td></tr>
<tr><td style="padding:8px 0;color:#4B5563">ATH Móvil</td><td style="text-align:right;padding:8px 0;font-weight:600">${usd(summary.totalAth)}</td></tr>
<tr><td style="padding:10px 0 8px;border-top:1px solid #E5E7EB;font-weight:700;color:#111827">Ingresos totales</td><td style="text-align:right;padding:10px 0 8px;border-top:1px solid #E5E7EB;font-weight:800;color:#22C55E">${usd(summary.totalRevenue)}</td></tr>
<tr><td style="padding:8px 0;color:#4B5563">Gastos del turno</td><td style="text-align:right;padding:8px 0;font-weight:600;color:#EF4444">−${usd(summary.totalExpenses)}</td></tr>
<tr><td style="padding:10px 0 8px;border-top:1px solid #E5E7EB;font-weight:800;color:#111827">Ganancia neta</td><td style="text-align:right;padding:10px 0 8px;border-top:1px solid #E5E7EB;font-weight:800;color:${netColor}">${usd(summary.realProfit)}</td></tr>
</table>
<p style="margin:6px 0 22px;font-size:12px;color:#6B7280">${summary.saleCount} venta${summary.saleCount === 1 ? "" : "s"} procesadas</p>
<h2 style="margin:0 0 14px;font-size:16px;color:#111827">Cuadre</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><td style="padding:8px 0;color:#4B5563">Saldo inicial</td><td style="text-align:right;padding:8px 0;font-weight:600">${usd(opening)}</td></tr>
<tr><td style="padding:8px 0;color:#4B5563">Esperado</td><td style="text-align:right;padding:8px 0;font-weight:600">${usd(expected)}</td></tr>
<tr><td style="padding:8px 0;color:#4B5563">Contado</td><td style="text-align:right;padding:8px 0;font-weight:600">${usd(counted)}</td></tr>
<tr><td style="padding:10px 0;border-top:1px solid #E5E7EB;font-weight:700;color:${diffColor}">${diffStatus}</td><td style="text-align:right;padding:10px 0;border-top:1px solid #E5E7EB;font-weight:800;color:${diffColor}">${usd(difference)}</td></tr>
</table>
${pdfBlock}
${obsBlock}
<p style="margin:24px 0 0;font-size:12px;color:#9CA3AF">Cerrada por ${esc(closedBy)} · Generado automáticamente por Archilla OS</p>
</div></body></html>`;
  try {
    await sendRawEmail({ tenantId: register.tenant_id, to: recipient, subject: `Cierre de caja - ${tenantName} - ${dateLabel}`, html, replyTo: recipient, fromName: tenantName });
  } catch {
    return;
  }
}
