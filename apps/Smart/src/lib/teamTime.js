import { supabase } from "../../../../lib/supabase-client.js";
import { sendRawEmail } from "@/lib/orderEmails";
import { safeTZ, zonedParts, zonedDate, startOfDay } from "@/lib/finance/tz";
import { fetchOpenEntry, shortTime, entryIn, matchIdsFor } from "@/lib/punchApi";
import { employeeRate } from "@/lib/finance/payroll";
import { patchLocked } from "@/lib/teamApi";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export const DAY_LONG = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const DAY_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
export const DAY_INITIAL = ["D", "L", "M", "M", "J", "V", "S"];
const ICS_DAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

export function emptySchedule(hourlyRate = 0) {
  return {
    days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, enabled: false, startHour: 9, startMinute: 0, endHour: 17, endMinute: 0 })),
    reminderLeadMinutes: 10, remindersEnabled: false, hourlyRate,
  };
}

export function normalizeSchedule(raw, rate = 0) {
  const base = emptySchedule(rate);
  if (!raw || typeof raw !== "object") return base;
  const days = base.days.map((d, i) => {
    const src = Array.isArray(raw.days) ? raw.days.find((x) => Number(x?.weekday) === d.weekday) || raw.days[i] : null;
    if (!src) return d;
    const n = (v, fb) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fb);
    return { weekday: d.weekday, enabled: src.enabled === true, startHour: n(src.startHour, 9), startMinute: n(src.startMinute, 0), endHour: n(src.endHour, 17), endMinute: n(src.endMinute, 0) };
  });
  return {
    days,
    reminderLeadMinutes: Number.isFinite(Number(raw.reminderLeadMinutes)) ? Math.trunc(Number(raw.reminderLeadMinutes)) : 10,
    remindersEnabled: raw.remindersEnabled === true,
    hourlyRate: Number.isFinite(Number(raw.hourlyRate)) ? Number(raw.hourlyRate) : rate,
  };
}

export function serializeSchedule(s, rate) {
  const n = normalizeSchedule(s, rate);
  return { ...n, hourlyRate: Number(rate) || 0 };
}

export function dayHours(d) {
  let mins = (d.endHour * 60 + d.endMinute) - (d.startHour * 60 + d.startMinute);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

export const scheduleTotal = (s) => s.days.filter((d) => d.enabled).reduce((t, d) => t + dayHours(d), 0);

export function clockLabel(h, m) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")}${h < 12 ? "am" : "pm"}`;
}
export const dayRange = (d) => `${clockLabel(d.startHour, d.startMinute)} – ${clockLabel(d.endHour, d.endMinute)}`;
export const hoursText = (h) => `${(Math.round(h * 10) / 10).toFixed(1)}h`;
export const timeValue = (h, m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
export function parseTimeValue(v) {
  const [h, m] = String(v || "").split(":").map((x) => parseInt(x, 10));
  return Number.isFinite(h) && Number.isFinite(m) ? { h, m } : null;
}

export const scheduleSig = (s) => JSON.stringify(s.days.map((d) => [d.enabled, d.startHour, d.startMinute, d.endHour, d.endMinute]));

export function applyTemplate(s, kind) {
  const days = s.days.map((d) => ({ ...d }));
  const setAll = (fn, sh, eh) => days.forEach((d) => { const on = fn(d.weekday); d.enabled = on; if (on) { d.startHour = sh; d.startMinute = 0; d.endHour = eh; d.endMinute = 0; } });
  if (kind === "weekday10-5") setAll((w) => w >= 2 && w <= 6, 10, 17);
  else if (kind === "weeksat10-6") setAll((w) => w >= 2 && w <= 7, 10, 18);
  else if (kind === "copyFirst") { const first = days.find((d) => d.enabled); if (first) days.forEach((d) => { if (d.enabled) { d.startHour = first.startHour; d.startMinute = first.startMinute; d.endHour = first.endHour; d.endMinute = first.endMinute; } }); }
  else if (kind === "clear") days.forEach((d) => { d.enabled = false; });
  return { ...s, days };
}

export function scheduleLines(s) {
  return [2, 3, 4, 5, 6, 7, 1].map((w) => {
    const d = s.days.find((x) => x.weekday === w);
    return { key: DAY_SHORT[w - 1], day: d, text: d.enabled ? `${dayRange(d)} (${hoursText(dayHours(d))})` : "Libre" };
  });
}

export function scheduleMessage({ shop, schedule, url }) {
  const lines = scheduleLines(schedule).map((l) => `${l.key}: ${l.text}`);
  const out = [`Tu horario semanal — ${shop}`, "", ...lines, "", `Total: ${hoursText(scheduleTotal(schedule))}/semana`];
  if (url) out.push(`Agrega tu horario a tu calendario: ${url}`);
  return out.join("\n");
}

export function whatsappUrl(phone, text) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) digits = `1${digits}`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function scheduleEmailHtml({ shop, employee, schedule, url }) {
  const first = String(employee.full_name || "").trim().split(/\s+/)[0] || "";
  const cells = scheduleLines(schedule).map((l) => `<td style="padding:8px 4px;text-align:center;border:1px solid #eee;font-size:12px;vertical-align:top"><div style="font-weight:700;color:#666;margin-bottom:4px">${esc(l.key)}</div>${l.day.enabled ? `<div>${esc(clockLabel(l.day.startHour, l.day.startMinute))}</div><div style="color:#999">a</div><div>${esc(clockLabel(l.day.endHour, l.day.endMinute))}</div><div style="color:#F2662E;font-weight:700;margin-top:4px">${esc(hoursText(dayHours(l.day)))}</div>` : `<div style="color:#999;margin-top:14px">Libre</div>`}</td>`).join("");
  const btn = url ? `<div style="margin:18px 0"><a href="${esc(url)}" style="display:inline-block;padding:10px 18px;background:#F2662E;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">Agregar a mi calendario</a></div>` : "";
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111"><div style="font-size:18px;font-weight:700;color:#F2662E">${esc(shop)}</div><h2 style="margin:6px 0">Tu horario semanal</h2><p style="font-size:14px">Hola ${esc(first)}, este es tu horario asignado.</p><table style="width:100%;border-collapse:collapse;margin-top:10px"><tr>${cells}</tr></table><p style="font-weight:700;margin-top:12px">Total: ${esc(hoursText(scheduleTotal(schedule)))} horas/semana</p>${btn}</div>`;
}

export async function sendScheduleEmail({ tenant, tenantId, employee, schedule, url }) {
  const to = String(employee.email || "").trim();
  if (!to) return false;
  const shop = String(tenant?.name || "").trim() || "Archilla OS";
  return sendRawEmail({ tenantId, to, subject: `Tu horario semanal — ${shop}`, html: scheduleEmailHtml({ shop, employee, schedule, url }), replyTo: String(tenant?.email || "").includes("@") ? tenant.email : undefined, fromName: shop });
}

const icsDate = (y, m, d, h, mi) => `${String(y).padStart(4, "0")}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}${String(mi).padStart(2, "0")}00`;
const icsEscape = (t) => String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

function nextOccurrence(weekday, tz, hour = 0, minute = 0) {
  const now = new Date();
  const p = zonedParts(now, tz);
  let diff = (weekday - p.weekday + 7) % 7;
  if (diff === 0 && p.h * 60 + p.mi >= hour * 60 + minute) diff = 7;
  const base = zonedDate(p.y, p.m, p.d, tz);
  const target = new Date(base.getTime() + diff * 86400000 + 12 * 3600000);
  const tp = zonedParts(target, tz);
  return { y: tp.y, m: tp.m, d: tp.d };
}

function utcOffsetLabel(tz) {
  const now = new Date();
  const p = zonedParts(now, tz);
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  const mins = Math.round((asUTC - Math.floor(now.getTime() / 1000) * 1000) / 60000);
  const sign = mins < 0 ? "-" : "+";
  const a = Math.abs(mins);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, "0")}${String(a % 60).padStart(2, "0")}`;
}

export function buildIcs({ employee, shop, schedule, tz, previousIcs }) {
  const zone = safeTZ(tz);
  const seq = Math.floor(Date.now() / 60000);
  const off = utcOffsetLabel(zone);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Archilla OS//Horario//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(`Horario ${employee.full_name}`)}`, `X-WR-TIMEZONE:${zone}`,
    "BEGIN:VTIMEZONE", `TZID:${zone}`, "BEGIN:STANDARD", "DTSTART:19700101T000000", `TZOFFSETFROM:${off}`, `TZOFFSETTO:${off}`, "END:STANDARD", "END:VTIMEZONE"];
  const known = new Set();
  const previousUids = previousIcs ? [...previousIcs.matchAll(/^UID:(.+)$/gm)].map((m) => m[1].trim()) : [];
  schedule.days.forEach((d) => {
    const uid = `archillaos-${employee.id}-${ICS_DAY[d.weekday - 1]}@archillaos`;
    if (!d.enabled && !previousUids.includes(uid)) return;
    known.add(uid);
    const occ = nextOccurrence(d.weekday, zone, d.startHour, d.startMinute);
    const endNext = d.endHour * 60 + d.endMinute <= d.startHour * 60 + d.startMinute;
    const endDate = endNext ? (() => { const t = new Date(Date.UTC(occ.y, occ.m - 1, occ.d + 1)); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; })() : occ;
    lines.push("BEGIN:VEVENT", `UID:${uid}`, `SEQUENCE:${seq}`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${zone}:${icsDate(occ.y, occ.m, occ.d, d.startHour, d.startMinute)}`, `DTEND;TZID=${zone}:${icsDate(endDate.y, endDate.m, endDate.d, d.endHour, d.endMinute)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAY[d.weekday - 1]}`, `SUMMARY:${icsEscape(`Trabajo — ${shop}`)}`, `DESCRIPTION:${icsEscape(`Tu turno en ${shop}`)}`, `STATUS:${d.enabled ? "CONFIRMED" : "CANCELLED"}`, "END:VEVENT");
  });
  if (previousIcs) {
    const uids = [...previousIcs.matchAll(/^UID:(.+)$/gm)].map((m) => m[1].trim());
    uids.filter((u) => !known.has(u)).forEach((u) => {
      const occ = nextOccurrence(2, zone);
      lines.push("BEGIN:VEVENT", `UID:${u}`, `SEQUENCE:${seq}`, `DTSTAMP:${stamp}`, `DTSTART;TZID=${zone}:${icsDate(occ.y, occ.m, occ.d, 9, 0)}`, `DTEND;TZID=${zone}:${icsDate(occ.y, occ.m, occ.d, 10, 0)}`, `SUMMARY:${icsEscape(`Trabajo — ${shop}`)}`, "STATUS:CANCELLED", "END:VEVENT");
    });
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export async function publishIcs({ tenantId, employee, shop, schedule, tz }) {
  const path = `schedules/${tenantId}/${employee.id}.ics`;
  let previous = null;
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/public/uploads/${path}?v=${Math.floor(Date.now() / 1000)}`, { cache: "no-store" });
    if (res.ok) previous = await res.text();
  } catch {
    previous = null;
  }
  const body = buildIcs({ employee, shop, schedule, tz, previousIcs: previous });
  const blob = new Blob([body], { type: "text/calendar" });
  const bucket = supabase.storage.from("uploads");
  const { error } = await bucket.upload(path, blob, { contentType: "text/calendar", upsert: true });
  if (!error) return { url: `${bucket.getPublicUrl(path).data.publicUrl}?v=${Math.floor(Date.now() / 1000)}`, stable: true };
  const alt = `schedules/${tenantId}/${employee.id}-${Math.random().toString(16).slice(2, 10)}.ics`;
  const { error: e2 } = await bucket.upload(alt, blob, { contentType: "text/calendar" });
  if (e2) return { url: null, stable: false };
  return { url: bucket.getPublicUrl(alt).data.publicUrl, stable: false };
}

export async function saveSchedule(emp, schedule) {
  const rate = employeeRate(emp);
  return patchLocked(emp, { schedule: serializeSchedule(schedule, rate) });
}

const isMissingColumn = (e) => ["PGRST204", "42703"].includes(String(e?.code || ""));

export async function overlappingEntry({ tenantId, matchIds, clockIn, clockOut, excludeId, now = new Date(), tz }) {
  const open = await fetchOpenEntry(tenantId, matchIds);
  if (open && open.id !== excludeId && (!clockOut || entryIn(open) < clockOut)) {
    return { kind: "open", entry: open, message: `Ya hay un turno abierto desde ${shortTime(entryIn(open), tz)}.` };
  }
  const end = clockOut || now;
  const { data, error } = await supabase.from("time_entry").select("*").eq("tenant_id", tenantId).in("employee_id", matchIds)
    .gte("clock_in", new Date(clockIn.getTime() - 36 * 3600000).toISOString()).lt("clock_in", new Date(end.getTime() + 60000).toISOString()).limit(200);
  if (error) throw error;
  for (const e of data || []) {
    if (e.id === excludeId) continue;
    const eIn = entryIn(e);
    const eOut = e.clock_out ? new Date(e.clock_out) : null;
    if (eIn < (clockOut || new Date(8.64e15)) && clockIn < (eOut || new Date(8.64e15))) {
      return { kind: "overlap", entry: e, message: `Se encima con otro ponche: ${shortTime(eIn, tz)} a ${eOut ? shortTime(eOut, tz) : "en curso"}.` };
    }
  }
  return null;
}

export async function addManualEntry({ tenantId, employee, clockIn, clockOut }) {
  const row = { tenant_id: tenantId, employee_id: employee.id, employee_name: String(employee.full_name || "").trim() || "Usuario", clock_in: clockIn.toISOString() };
  if (clockOut) { row.clock_out = clockOut.toISOString(); row.total_hours = r2((clockOut - clockIn) / 3600000); }
  const { data, error } = await supabase.from("time_entry").insert(row).select("*").single();
  if (error) throw error;
  return data;
}

function guard(q, entry) {
  let out = q.eq("id", entry.id);
  if (entry.updated_at) out = out.eq("updated_at", entry.updated_at);
  return entry.clock_out ? out.not("clock_out", "is", null) : out.is("clock_out", null);
}

export class EntryConflict extends Error {}

export async function updateEntry({ entry, clockIn, clockOut, reason, by }) {
  const fields = { edited_by: by || "Dueño", edit_reason: reason };
  const oldIn = entryIn(entry);
  const oldOut = entry.clock_out ? new Date(entry.clock_out) : null;
  const inChanged = Math.abs(clockIn - oldIn) >= 1000;
  const outChanged = (clockOut ? clockOut.getTime() : null) !== (oldOut ? oldOut.getTime() : null) && !(clockOut && oldOut && Math.abs(clockOut - oldOut) < 1000);
  if (inChanged) fields.clock_in = clockIn.toISOString();
  if (outChanged) fields.clock_out = clockOut ? clockOut.toISOString() : null;
  if (inChanged || outChanged) fields.total_hours = clockOut ? r2((clockOut - clockIn) / 3600000) : null;
  const run = (f) => guard(supabase.from("time_entry").update(f), entry).select("*");
  let { data, error } = await run(fields);
  if (error && isMissingColumn(error)) {
    const rest = { ...fields };
    delete rest.edited_by;
    delete rest.edit_reason;
    ({ data, error } = await run(rest));
  }
  if (error) throw error;
  if (!data?.[0]) throw new EntryConflict("conflict");
  return data[0];
}

export async function deleteEntry(entry) {
  const { data, error } = await guard(supabase.from("time_entry").delete(), entry).select("*");
  if (error) throw error;
  if (!data?.[0]) throw new EntryConflict("conflict");
  return data[0];
}

export async function trimSecond({ first, second, by }) {
  const newIn = new Date(first.clock_out);
  const out = second.clock_out ? new Date(second.clock_out) : null;
  const fields = { clock_in: newIn.toISOString(), edited_by: by || "Dueño", edit_reason: "Encimado con otro ponche" };
  if (out) fields.total_hours = r2((out - newIn) / 3600000);
  const run = (f) => guard(supabase.from("time_entry").update(f), second).select("*");
  let { data, error } = await run(fields);
  if (error && isMissingColumn(error)) {
    const rest = { ...fields };
    delete rest.edited_by;
    delete rest.edit_reason;
    ({ data, error } = await run(rest));
  }
  if (error) throw error;
  if (!data?.[0]) throw new EntryConflict("conflict");
  return data[0];
}

export async function fetchEmployeeEntries({ tenantId, employee, from, to }) {
  const ids = matchIdsFor(employee, null);
  const out = [];
  for (let off = 0; off < 10000; off += 500) {
    const { data, error } = await supabase.from("time_entry").select("*").eq("tenant_id", tenantId).in("employee_id", ids).gte("clock_in", from.toISOString()).lt("clock_in", to.toISOString()).order("clock_in", { ascending: true }).order("id", { ascending: true }).range(off, off + 499);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return out;
}

export async function fetchPaymentsFor(tenantId, employeeId) {
  const { data, error } = await supabase.from("transaction").select("*").eq("tenant_id", tenantId).eq("type", "expense").eq("category", "payroll").ilike("description", `[emp:${employeeId}]%`).eq("is_deleted", false).order("created_at", { ascending: false }).limit(25);
  if (error) throw error;
  return data || [];
}

export { startOfDay };
