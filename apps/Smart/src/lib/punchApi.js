import { supabase } from "../../../../lib/supabase-client.js";
import { sendOwnerPush } from "@/lib/cashRegisterApi";
import { safeTZ, zonedParts, zonedDate, startOfDay, fmt } from "@/lib/finance/tz";
import { periodContaining } from "@/lib/finance/payroll";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class PunchError extends Error {
  constructor(message, extra = {}) {
    super(message);
    Object.assign(this, extra);
  }
}

export function workshopCode(tenantId) {
  const clean = String(tenantId || "").replace(/-/g, "").slice(0, 8).toUpperCase();
  return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export function newEntryId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().toLowerCase();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function matchIdsFor(employee, authUid) {
  const ids = [employee?.id, employee?.auth_user_id];
  if (authUid && (!employee?.auth_user_id || employee.auth_user_id === authUid)) ids.push(authUid);
  return [...new Set(ids.filter(Boolean))];
}

export function entryIn(e) {
  return e?.clock_in ? new Date(e.clock_in) : null;
}

export function elapsedHours(e, now = new Date()) {
  if (e?.clock_out) {
    const th = Number(e.total_hours);
    if (e.total_hours !== null && e.total_hours !== undefined && e.total_hours !== "" && Number.isFinite(th)) return th;
    const a = entryIn(e);
    return a ? Math.max(0, (new Date(e.clock_out) - a) / 3600000) : 0;
  }
  const a = entryIn(e);
  return a ? Math.max(0, (now - a) / 3600000) : 0;
}

export function hm(hours) {
  const c = Math.max(0, hours || 0);
  const h = Math.trunc(c);
  return { h, m: Math.min(59, Math.trunc((c - h) * 60)) };
}

export function shortTime(date, tz = "America/Puerto_Rico") {
  if (!date) return "--:--";
  const p = zonedParts(date, safeTZ(tz));
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${h12}:${String(p.mi).padStart(2, "0")}${p.h < 12 ? "am" : "pm"}`;
}

export function punchTimeLabel(date, tz) {
  const z = safeTZ(tz);
  const today = startOfDay(new Date(), z);
  const opts = date >= today && date < new Date(today.getTime() + 86400000)
    ? { hour: "numeric", minute: "2-digit" }
    : { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" };
  return fmt(date, z, opts);
}

export async function currentAuthUid() {
  try {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

export async function fetchOwnerEmployee(tenantId) {
  const { data, error } = await supabase.from("app_employee").select("*").eq("tenant_id", tenantId).eq("role", "owner").order("created_at", { ascending: true }).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function fetchOpenTenantEntries(tenantId) {
  const { data, error } = await supabase.from("time_entry").select("*").eq("tenant_id", tenantId).is("clock_out", null).order("clock_in", { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

export async function fetchOpenEntry(tenantId, matchIds) {
  if (!matchIds.length) return null;
  const { data, error } = await supabase.from("time_entry").select("*").eq("tenant_id", tenantId).in("employee_id", matchIds).is("clock_out", null).order("clock_in", { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

export async function fetchEntry(id) {
  const { data, error } = await supabase.from("time_entry").select("*").eq("id", id).limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function pageAll(build) {
  const out = [];
  for (let offset = 0; offset < 20000; offset += 500) {
    const { data, error } = await build().range(offset, offset + 499);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 500) break;
  }
  return out;
}

export async function fetchEntries({ tenantId, matchIds, from, to }) {
  if (!matchIds.length) return [];
  return pageAll(() => supabase.from("time_entry").select("*").eq("tenant_id", tenantId).in("employee_id", matchIds)
    .gte("clock_in", from.toISOString()).lt("clock_in", to.toISOString()).order("clock_in", { ascending: true }).order("id", { ascending: true }));
}

export async function fetchTenantEntries({ tenantId, from, to }) {
  return pageAll(() => supabase.from("time_entry").select("*").eq("tenant_id", tenantId)
    .gte("clock_in", from.toISOString()).lt("clock_in", to.toISOString()).order("clock_in", { ascending: true }).order("id", { ascending: true }));
}

export async function weekHours({ tenantId, matchIds, tz }) {
  const p = periodContaining(new Date(), safeTZ(tz));
  const entries = await fetchEntries({ tenantId, matchIds, from: p.start, to: new Date() });
  return entries.reduce((s, e) => s + elapsedHours(e), 0);
}

export async function todayOverview(tenantId, tz) {
  const start = startOfDay(new Date(), safeTZ(tz));
  const [today, open] = await Promise.all([fetchTenantEntries({ tenantId, from: start, to: new Date() }), fetchOpenTenantEntries(tenantId)]);
  const byId = new Map();
  [...today, ...open].forEach((e) => byId.set(e.id, e));
  return [...byId.values()].sort((a, b) => (entryIn(b)?.getTime() || 0) - (entryIn(a)?.getTime() || 0));
}

export function subscribeTimeEntries(tenantId, onChange) {
  let timer = null;
  const channel = supabase.channel(`time-entry-${tenantId}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "time_entry", filter: `tenant_id=eq.${tenantId}` }, () => {
      clearTimeout(timer);
      timer = setTimeout(onChange, 400);
    })
    .subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(channel); };
}

const isUnique = (e) => String(e?.code || "") === "23505" || /duplicate key/i.test(String(e?.message || ""));
const isMissingColumn = (e) => ["PGRST204", "42703"].includes(String(e?.code || "")) || /column/i.test(String(e?.message || "")) && /does not exist|could not find/i.test(String(e?.message || ""));

export async function punchIn({ tenantId, employee, at = new Date(), clientId = newEntryId() }) {
  const matchIds = matchIdsFor(employee);
  const existing = await fetchOpenEntry(tenantId, matchIds);
  if (existing) {
    if (existing.id === clientId) return existing;
    throw new PunchError("alreadyOpen", { kind: "alreadyOpen", entry: existing });
  }
  const name = String(employee.full_name || "").trim() || "Usuario";
  const { data, error } = await supabase.from("time_entry").insert({ id: clientId, tenant_id: tenantId, employee_id: employee.id, employee_name: name, clock_in: at.toISOString() }).select("*").single();
  if (error) {
    if (!isUnique(error)) throw error;
    const mine = await fetchEntry(clientId).catch(() => null);
    if (mine) {
      if (!mine.clock_out && matchIds.includes(mine.employee_id)) return mine;
      return punchIn({ tenantId, employee, at });
    }
    const open = await fetchOpenEntry(tenantId, matchIds).catch(() => null);
    if (open) throw new PunchError("alreadyOpen", { kind: "alreadyOpen", entry: open });
    throw error;
  }
  sendOwnerPush(tenantId, "Ponche de entrada", `${name} ponchó entrada`);
  return data;
}

export async function closeEntry({ entryId, at = new Date(), autoReason = null, tenantId }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await fetchEntry(entryId);
    if (!current) return { status: "alreadyClosed", entry: null };
    if (current.clock_out) return { status: "alreadyClosed", entry: current };
    const inAt = entryIn(current);
    if (!inAt) throw new PunchError("Falta la hora de entrada de este ponche.");
    const floor = autoReason ? new Date(inAt.getTime() + 60000) : inAt;
    const out = at > floor ? at : floor;
    const rounded = Math.round(((out - inAt) / 3600000) * 100) / 100;
    const fields = { clock_out: out.toISOString(), total_hours: rounded };
    if (autoReason) { fields.edited_by = "Sistema (auto)"; fields.edit_reason = autoReason; }
    const run = (f) => {
      let q = supabase.from("time_entry").update(f).eq("id", entryId).is("clock_out", null);
      if (current.updated_at) q = q.eq("updated_at", current.updated_at);
      return q.select("*");
    };
    let { data, error } = await run(fields);
    if (error && autoReason && isMissingColumn(error)) {
      ({ data, error } = await run({ clock_out: fields.clock_out, total_hours: rounded }));
    }
    if (error) throw error;
    const row = data?.[0];
    if (!row) continue;
    const who = String(row.employee_name || current.employee_name || "").trim() || "Empleado";
    const hoursText = (Number(row.total_hours ?? rounded) || 0).toFixed(2);
    sendOwnerPush(row.tenant_id || current.tenant_id || tenantId, "Ponche de salida", autoReason ? `Turno de ${who} cerrado automaticamente · ${hoursText}h` : `${who} ponchó salida · ${hoursText}h`);
    return { status: "closed", entry: row };
  }
  const latest = await fetchEntry(entryId).catch(() => null);
  if (latest?.clock_out) return { status: "alreadyClosed", entry: latest };
  throw new PunchError("Otro dispositivo cambió este ponche. Intenta de nuevo.");
}

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const minutesOf = (hhmm) => {
  const parts = String(hhmm || "").split(":").map((x) => parseInt(x, 10));
  if (parts.length !== 2 || !(parts[0] >= 0 && parts[0] < 24) || !(parts[1] >= 0 && parts[1] < 60)) return null;
  return parts[0] * 60 + parts[1];
};

export function closeTime(clockIn, hours, tz) {
  if (!hours || typeof hours !== "object") return null;
  const z = safeTZ(tz);
  const p = zonedParts(clockIn, z);
  const day = hours[DAY_KEYS[p.weekday - 1]];
  if (!day || day.closed) return null;
  const open = minutesOf(day.open);
  const close = minutesOf(day.close);
  if (open === null || close === null || !(close > open)) return null;
  const at = zonedDate(p.y, p.m, p.d, z, Math.floor(close / 60), close % 60, 0);
  return clockIn < at ? at : null;
}

export function cutoff(clockIn, hours, tz) {
  const hardCap = new Date(clockIn.getTime() + 12 * 3600000);
  const close = closeTime(clockIn, hours, tz);
  if (!close) return hardCap;
  const withGrace = new Date(close.getTime() + 3600000);
  return withGrace < hardCap ? withGrace : hardCap;
}

export function isFromEarlierDay(entry, tz, now = new Date()) {
  const inAt = entryIn(entry);
  return !entry?.clock_out && !!inAt && inAt < startOfDay(now, safeTZ(tz));
}

export function requiresAutomaticClose(entry, hours, tz, now = new Date()) {
  const inAt = entryIn(entry);
  return isFromEarlierDay(entry, tz, now) && now > cutoff(inAt, hours, tz);
}

export function usesBusinessClose(clockIn, hours, tz) {
  const close = closeTime(clockIn, hours, tz);
  return !!close && close <= new Date(clockIn.getTime() + 12 * 3600000);
}

export function automaticClockOut(clockIn, hours, tz, now = new Date()) {
  const hardCap = new Date(clockIn.getTime() + 12 * 3600000);
  const close = closeTime(clockIn, hours, tz) || hardCap;
  const target = close < hardCap ? close : hardCap;
  const floor = new Date(clockIn.getTime() + 60000);
  const t = target > floor ? target : floor;
  return t < now ? t : now;
}

function reasonLabel(date, tz) {
  const z = safeTZ(tz);
  const p = zonedParts(date, z);
  const mon = fmt(date, z, { month: "short" }, "es-PR").replace(".", "");
  const h12 = p.h % 12 === 0 ? 12 : p.h % 12;
  return `${p.d} ${mon} ${h12}:${String(p.mi).padStart(2, "0")} ${p.h < 12 ? "a. m." : "p. m."}`;
}

export function automaticCloseReason(clockIn, hours, tz, closeAt) {
  return usesBusinessClose(clockIn, hours, tz)
    ? `Cerrado automaticamente: quedo abierto de un dia anterior. Se registro la hora de cierre del negocio (${reasonLabel(closeAt, tz)}). Revisa si la hora es correcta.`
    : `Cerrado automaticamente: quedo abierto de un dia anterior. Se registro el tope de 12 horas desde la entrada (${reasonLabel(closeAt, tz)}). Revisa si la hora es correcta.`;
}

export function automaticCloseMessage(clockIn, hours, tz) {
  const at = automaticClockOut(clockIn, hours, tz);
  const label = punchTimeLabel(at, tz);
  return usesBusinessClose(clockIn, hours, tz)
    ? `Nadie ponchó la salida. Se cierra a las ${label} (hora de cierre) y queda marcado como automático. Si no es correcto, el dueño lo corrige en Editar ponches.`
    : `Nadie ponchó la salida. Se cierra a las ${label} (12 horas después de la entrada) y queda marcado como automático. Si no es correcto, el dueño lo corrige en Editar ponches.`;
}

export async function closeAutomatically(entry, hours, tz, tenantId) {
  const inAt = entryIn(entry);
  const out = automaticClockOut(inAt, hours, tz);
  return closeEntry({ entryId: entry.id, at: out, autoReason: automaticCloseReason(inAt, hours, tz, out), tenantId });
}

export async function closeIfOverdue(entry, hours, tz, tenantId, extraHours = 0) {
  const inAt = entryIn(entry);
  if (!entry || entry.clock_out || !inAt) return null;
  const now = new Date();
  if (!requiresAutomaticClose(entry, hours, tz, now)) return null;
  if (!(now > new Date(cutoff(inAt, hours, tz).getTime() + extraHours * 3600000))) return null;
  if (now - inAt < 2 * 3600000) return null;
  return closeAutomatically(entry, hours, tz, tenantId).catch(() => null);
}

const failKey = (tid) => `pin_failures_${tid}`;
const lockKey = (tid) => `pin_lockout_until_${tid}`;

export function pinLockoutUntil(tid) {
  try {
    const v = Number(localStorage.getItem(lockKey(tid))) || 0;
    return v > 0 ? new Date(v * 1000) : null;
  } catch {
    return null;
  }
}

export function resetPinLockout(tid) {
  try {
    localStorage.removeItem(failKey(tid));
    localStorage.removeItem(lockKey(tid));
  } catch {
    return;
  }
}

export function registerPinFailure(tid) {
  let failures = 1;
  try {
    const until = Number(localStorage.getItem(lockKey(tid))) || 0;
    if (until > 0 && Date.now() / 1000 >= until) {
      localStorage.removeItem(failKey(tid));
      localStorage.removeItem(lockKey(tid));
    }
    failures = (Number(localStorage.getItem(failKey(tid))) || 0) + 1;
    localStorage.setItem(failKey(tid), String(failures));
    if (failures >= 5) localStorage.setItem(lockKey(tid), String(Math.floor(Date.now() / 1000) + 300));
  } catch {
    return { failures, locked: false };
  }
  return { failures, locked: failures >= 5 };
}

export async function verifyOwnerPinStrict(tenantId, pin) {
  let res;
  try {
    res = await supabase.functions.invoke("owner-pin", { body: { action: "verify", tenant_id: tenantId, pin } });
  } catch (e) {
    throw new PunchError("network", { kind: "network", cause: e });
  }
  if (res.error) {
    const status = res.error?.context?.status;
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
    throw new PunchError("network", { kind: "network", cause: res.error });
  }
  return res.data?.ok === true;
}

export async function verifyEmployeePin({ tenantId, pin }) {
  const ownerOk = await verifyOwnerPinStrict(tenantId, pin);
  if (ownerOk) {
    const owner = await fetchOwnerEmployee(tenantId).catch((e) => { throw new PunchError("network", { kind: "network", cause: e }); });
    if (!owner) throw new PunchError("No encontramos tu ficha de empleado para registrar el ponche.", { kind: "noOwner" });
    return owner;
  }
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/employee-verify-pin`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ workshop_code: workshopCode(tenantId), pin }),
    });
  } catch (e) {
    throw new PunchError("network", { kind: "network", cause: e });
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) throw new PunchError("rejected", { kind: "rejected" });
    throw new PunchError("server", { kind: "server" });
  }
  if (!body?.employee) throw new PunchError("server", { kind: "server" });
  return body.employee;
}

export function lastPunchEmployee(tenantId) {
  try {
    return localStorage.getItem(`punch.lastEmployee.${tenantId}`) || null;
  } catch {
    return null;
  }
}

export function saveLastPunchEmployee(tenantId, name) {
  try {
    if (name) localStorage.setItem(`punch.lastEmployee.${tenantId}`, name);
  } catch {
    return;
  }
}

export function shiftDayKey(tz) {
  const p = zonedParts(new Date(), safeTZ(tz));
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

const completionKey = (tenantId, day, kind, taskId) => `shiftCompletion.${tenantId}_${day}_${kind}_${taskId}`;

export function shiftTasks(tenant, kind) {
  const set = tenant?.settings?.shift_tasks;
  const list = set && Array.isArray(set[kind]) ? set[kind] : [];
  return list.filter((t) => t && t.id && t.label);
}

export function isShiftTaskDone(tenantId, tz, kind, taskId) {
  try {
    return !!localStorage.getItem(completionKey(tenantId, shiftDayKey(tz), kind, taskId));
  } catch {
    return false;
  }
}

export function setShiftTaskDone(tenantId, tz, kind, taskId, done, employeeName) {
  try {
    const k = completionKey(tenantId, shiftDayKey(tz), kind, taskId);
    if (done) localStorage.setItem(k, JSON.stringify({ completedAt: new Date().toISOString(), employeeName: employeeName || "Empleado" }));
    else localStorage.removeItem(k);
  } catch {
    return;
  }
}

export function pendingShiftTasks(tenant, tenantId, tz, kind) {
  return shiftTasks(tenant, kind).filter((t) => !isShiftTaskDone(tenantId, tz, kind, t.id));
}
