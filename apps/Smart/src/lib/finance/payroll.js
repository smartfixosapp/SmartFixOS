import { supabase } from "../../../../../lib/supabase-client.js";
import { zonedParts, zonedDate, startOfDay, addDays, dayString, parseDay, daysBetween, fmt } from "@/lib/finance/tz";

export const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

const toDate = (v) => (v ? new Date(v) : null);

export function periodContaining(date, tz) {
  const day = startOfDay(date, tz);
  const weekday = zonedParts(day, tz).weekday;
  const back = (weekday - 1 + 7) % 7;
  const start = addDays(day, -back, tz);
  const end = addDays(start, 7, tz);
  return makePeriod(start, end, tz);
}

function makePeriod(start, end, tz) {
  const lastDay = addDays(end, -1, tz);
  return {
    start,
    end,
    tz,
    lastDay,
    tagValue: `${dayString(start, tz)}..${dayString(lastDay, tz)}`,
    contains: (d) => d >= start && d < end,
    overlaps: (s, e) => s < end && start < e,
  };
}

export function previousPeriod(p) {
  return periodContaining(new Date(p.start.getTime() - 60000), p.tz);
}

export function nextPeriod(p) {
  return periodContaining(new Date(p.end.getTime() + 60000), p.tz);
}

export function lastClosedWeek(tz, now = new Date()) {
  return previousPeriod(periodContaining(now, tz));
}

export function periodRangeLabel(p) {
  const f = (d) => fmt(d, p.tz, { day: "numeric", month: "short" });
  return `${f(p.start)} – ${f(p.lastDay)}`;
}

export function parsePayrollTag(description, tz) {
  let rest = String(description || "").trim();
  let employeeId = null;
  let periodStart = null;
  let periodEnd = null;
  let kind = null;
  while (rest.startsWith("[")) {
    const close = rest.indexOf("]");
    if (close < 0) break;
    const inner = rest.slice(1, close);
    const colon = inner.indexOf(":");
    if (colon < 0) break;
    const key = inner.slice(0, colon).toLowerCase();
    const value = inner.slice(colon + 1).trim();
    if (key === "emp") employeeId = value || null;
    else if (key === "periodo") {
      const bounds = value.split("..");
      if (bounds.length === 2) {
        const first = parseDay(bounds[0], tz);
        const last = parseDay(bounds[1], tz);
        if (first && last && last >= first) {
          periodStart = first;
          periodEnd = addDays(last, 1, tz);
        }
      }
    } else if (key === "tipo") {
      const v = value.toLowerCase();
      kind = ["sueldo", "adelanto", "comision"].includes(v) ? v : null;
    } else break;
    rest = rest.slice(close + 1).trim();
  }
  return { employeeId, periodStart, periodEnd, kind, label: rest };
}

export function payrollTagDescription(employeeId, period, kind, label) {
  let tags = `[emp:${employeeId}]`;
  if (period) tags += `[periodo:${period.tagValue}]`;
  tags += `[tipo:${kind}]`;
  const trimmed = String(label || "").trim();
  return trimmed ? `${tags} ${trimmed}` : tags;
}

export function employeeRate(emp) {
  const r = emp?.hourly_rate;
  if (r !== null && r !== undefined && r !== "") return Number(r) || 0;
  const s = emp?.schedule?.hourlyRate;
  return Number(s) || 0;
}

async function pageAll(build, pageSize = 500) {
  const all = [];
  const seen = new Set();
  let from = 0;
  for (;;) {
    const { data, error } = await build().range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    let added = 0;
    page.forEach((row) => {
      if (row.id) {
        if (seen.has(row.id)) return;
        seen.add(row.id);
      }
      all.push(row);
      added += 1;
    });
    if (page.length < pageSize || added === 0) break;
    from += page.length;
  }
  return all;
}

export async function fetchEmployees(tenantId) {
  const { data, error } = await supabase.from("app_employee").select("*").eq("tenant_id", tenantId).order("full_name", { ascending: true }).limit(200);
  if (error) throw error;
  return (data || []).sort((a, b) => {
    const aa = a.active !== false;
    const bb = b.active !== false;
    if (aa !== bb) return aa ? -1 : 1;
    return String(a.full_name || "").localeCompare(String(b.full_name || ""));
  });
}

function historyStart(payments, period, lookbackStart) {
  let earliest = null;
  payments.forEach((tx) => {
    if (tx.is_deleted) return;
    const tag = parsePayrollTag(tx.description, period.tz);
    if (tag.kind !== "adelanto" || !tag.periodStart || !(tag.periodStart < period.start)) return;
    if (!earliest || tag.periodStart < earliest) earliest = tag.periodStart;
  });
  if (!earliest) return period.start;
  const clamped = earliest > lookbackStart ? earliest : lookbackStart;
  const s = periodContaining(clamped, period.tz).start;
  return s < period.start ? s : period.start;
}

export async function loadPayroll(tenantId, period) {
  let lookback = period;
  for (let i = 0; i < 6; i += 1) lookback = previousPeriod(lookback);
  const paymentsSince = new Date(lookback.start.getTime() - 7 * 86400000);
  const [employees, payments] = await Promise.all([
    fetchEmployees(tenantId),
    pageAll(() => supabase.from("transaction").select("*").eq("tenant_id", tenantId).eq("type", "expense").eq("category", "payroll")
      .ilike("description", "[emp:%").eq("is_deleted", false).gte("created_at", paymentsSince.toISOString())
      .order("created_at", { ascending: true }).order("id", { ascending: true })),
  ]);
  const hStart = historyStart(payments, period, lookback.start);
  const commissionIds = [...new Set(employees.filter((e) => Number(e.commission_rate) > 0).flatMap((e) => [e.id, e.auth_user_id]).filter(Boolean))];
  const [entries, orders] = await Promise.all([
    pageAll(() => supabase.from("time_entry").select("*").eq("tenant_id", tenantId).gte("clock_in", hStart.toISOString()).lt("clock_in", period.end.toISOString())
      .order("clock_in", { ascending: true }).order("id", { ascending: true })),
    commissionIds.length
      ? pageAll(() => supabase.from("order").select("id,assigned_to,status,status_history,cost_estimate,labor_cost,updated_at").eq("tenant_id", tenantId)
        .in("assigned_to", commissionIds).in("status", ["delivered", "warranty", "picked_up", "completed"]).eq("is_deleted", false)
        .gte("updated_at", hStart.toISOString()).order("id", { ascending: true }), 1000)
      : Promise.resolve([]),
  ]);
  return { employees, entries, orders, payments, historyStart: hStart, paymentsSince };
}

const DELIVERED = new Set(["delivered", "picked_up", "completed"]);

function orderAmount(o) {
  const ce = o.cost_estimate;
  if (ce !== null && ce !== undefined && ce !== "") return Number(ce) || 0;
  const lc = o.labor_cost;
  return lc !== null && lc !== undefined && lc !== "" ? Number(lc) || 0 : 0;
}

function orderDeliveredAt(o) {
  let min = null;
  (Array.isArray(o.status_history) ? o.status_history : []).forEach((e) => {
    if (!e || !DELIVERED.has(e.status)) return;
    if (e.kind && e.kind !== "status") return;
    const t = toDate(e.timestamp);
    if (t && !Number.isNaN(t.getTime()) && (!min || t < min)) min = t;
  });
  return min;
}

function coverage(s, e, period) {
  if (!period.overlaps(s, e)) return null;
  if (s >= period.start && e <= period.end) return { fraction: 1, partial: false };
  const total = daysBetween(s, e, period.tz);
  const covered = daysBetween(s > period.start ? s : period.start, e < period.end ? e : period.end, period.tz);
  if (total <= 0 || covered <= 0) return null;
  return { fraction: Math.min(1, covered / total), partial: true };
}

function ownerIndex(employees) {
  const owner = {};
  employees.forEach((e, i) => { if (e.id) owner[e.id] = i; });
  employees.forEach((e, i) => { if (e.auth_user_id && owner[e.auth_user_id] === undefined) owner[e.auth_user_id] = i; });
  return owner;
}

function rawHoursOnly(entries) {
  const raw = entries.reduce((t, e) => {
    const inAt = toDate(e.clock_in);
    const out = toDate(e.clock_out);
    if (!inAt || !out) return t;
    const th = e.total_hours;
    return t + (th !== null && th !== undefined && th !== "" ? Number(th) || 0 : Math.max(0, (out - inAt) / 3600000));
  }, 0);
  return { rawHours: round2(raw), overlapHours: 0, overlaps: [] };
}

function isDuplicatePair(a, b) {
  const aIn = toDate(a.clock_in);
  const bIn = toDate(b.clock_in);
  if (!aIn || !bIn || Math.abs(aIn - bIn) > 120000) return false;
  const ao = toDate(a.clock_out);
  const bo = toDate(b.clock_out);
  if (!ao && !bo) return true;
  if (ao && bo) return Math.abs(ao - bo) <= 120000;
  return false;
}

export function detectOverlaps(entries, now = new Date()) {
  if (entries.length <= 1) return rawHoursOnly(entries);
  const far = new Date(8640000000000000);
  const sorted = [...entries].sort((a, b) => {
    const ai = toDate(a.clock_in) || new Date(0);
    const bi = toDate(b.clock_in) || new Date(0);
    if (ai - bi) return ai - bi;
    const ao = toDate(a.clock_out) || far;
    const bo = toDate(b.clock_out) || far;
    if (ao - bo) return ao - bo;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
  let rawHoursTotal = 0;
  let rawClock = 0;
  let paidClock = 0;
  const overlaps = [];
  let coveredEnd = null;
  let coveredEntry = null;
  let closedCoveredEnd = null;
  sorted.forEach((entry) => {
    const start = toDate(entry.clock_in);
    if (!start) return;
    const isOpen = !entry.clock_out;
    const end = toDate(entry.clock_out) || now;
    if (!isOpen) {
      const dur = Math.max(0, end - start) / 3600000;
      rawClock += dur;
      const th = entry.total_hours;
      rawHoursTotal += th !== null && th !== undefined && th !== "" ? Number(th) || 0 : dur;
    }
    if (coveredEnd && coveredEntry && start < coveredEnd) {
      const overlapEnd = end < coveredEnd ? end : coveredEnd;
      const secs = (overlapEnd - start) / 1000;
      if (secs > 60) {
        const bothClosed = !isOpen && !!coveredEntry.clock_out;
        overlaps.push({
          kind: !bothClosed ? "openOverlap" : isDuplicatePair(coveredEntry, entry) ? "duplicate" : "overlap",
          first: coveredEntry, second: entry, start, end: overlapEnd, hours: secs / 3600, id: `${coveredEntry.id || ""}|${entry.id || ""}`,
        });
      }
    }
    if (!isOpen) {
      const uniqueStart = closedCoveredEnd && closedCoveredEnd > start ? closedCoveredEnd : start;
      paidClock += Math.max(0, end - uniqueStart) / 3600000;
      if (!closedCoveredEnd || end > closedCoveredEnd) closedCoveredEnd = end;
    }
    if (!coveredEnd || end > coveredEnd) {
      coveredEnd = end;
      coveredEntry = entry;
    }
  });
  return { rawHours: round2(rawHoursTotal), overlapHours: Math.max(0, round2(rawClock - paidClock)), overlaps };
}

function compute(data, period, owner, payments, carryIn) {
  const n = data.employees.length;
  const byEmp = Array.from({ length: n }, () => []);
  const orphanEntries = {};
  const orphanNames = {};
  data.entries.forEach((entry) => {
    const ci = toDate(entry.clock_in);
    if (!ci || !period.contains(ci)) return;
    const key = entry.employee_id || "";
    const idx = owner[key];
    if (idx !== undefined) byEmp[idx].push(entry);
    else {
      const name = String(entry.employee_name || "").trim();
      if (name) orphanNames[key] = name;
      (orphanEntries[key] = orphanEntries[key] || []).push(entry);
    }
  });
  const overlapBy = {};
  for (let i = 0; i < n; i += 1) if (byEmp[i].length > 1) overlapBy[i] = detectOverlaps(byEmp[i]);
  const commissionBase = new Array(n).fill(0);
  const undated = new Array(n).fill(0);
  data.orders.forEach((o) => {
    const idx = o.assigned_to !== null && o.assigned_to !== undefined ? owner[o.assigned_to] : undefined;
    if (idx === undefined) return;
    const delivered = orderDeliveredAt(o);
    if (delivered) {
      if (period.contains(delivered)) commissionBase[idx] += orderAmount(o);
    } else if (o.status && DELIVERED.has(o.status)) {
      const up = toDate(o.updated_at);
      if (up && period.contains(up)) undated[idx] += 1;
    }
  });
  const unperiodedEnd = addDays(period.end, 7, period.tz);
  const paidBy = {};
  const proratedBy = {};
  const advancesBy = {};
  const unperiodedBy = {};
  const unperiodedDatesBy = {};
  payments.forEach(({ tx, tag }) => {
    const empId = tag.employeeId;
    if (!empId) return;
    const oi = owner[empId];
    const key = oi !== undefined ? data.employees[oi].id : empId;
    const amt = Number(tx.amount) || 0;
    if (tag.periodStart && tag.periodEnd) {
      const share = coverage(tag.periodStart, tag.periodEnd, period);
      if (!share) return;
      const a = amt * share.fraction;
      if (tag.kind === "adelanto") advancesBy[key] = (advancesBy[key] || 0) + a;
      else {
        paidBy[key] = (paidBy[key] || 0) + a;
        if (share.partial) proratedBy[key] = (proratedBy[key] || 0) + a;
      }
    } else {
      const created = toDate(tx.created_at);
      if (created && created >= period.start && created < unperiodedEnd) {
        unperiodedBy[key] = (unperiodedBy[key] || 0) + amt;
        (unperiodedDatesBy[key] = unperiodedDatesBy[key] || []).push(created);
      }
    }
  });
  const result = [];
  data.employees.forEach((emp, index) => {
    const id = emp.id;
    if (!id || owner[id] !== index) return;
    const ents = byEmp[index];
    const det = overlapBy[index] || rawHoursOnly(ents);
    const rawHours = round2(det.rawHours);
    const paid = round2(paidBy[id] || 0);
    const prorated = round2(proratedBy[id] || 0);
    const hasUnperiodedInPeriod = (unperiodedDatesBy[id] || []).some((d) => d >= period.start && d < period.end);
    const alreadyPaid = paid - prorated > 0.009 || hasUnperiodedInPeriod;
    const hours = alreadyPaid ? rawHours : Math.max(0, round2(rawHours - det.overlapHours));
    const rate = employeeRate(emp);
    const labor = round2(hours * rate);
    const cRate = Number(emp.commission_rate) || 0;
    const base = cRate > 0 ? round2(commissionBase[index]) : 0;
    const commission = round2((base * cRate) / 100);
    const line = makeLine({
      id, employee: emp, isOrphan: false, hours, rawHours, overlapHours: round2(det.overlapHours), overlaps: det.overlaps, rate, labor,
      commissionBase: base, commissionRate: cRate, commission, gross: round2(labor + commission), salaryPaid: paid, proratedPaid: prorated,
      advances: round2(advancesBy[id] || 0), advanceCarry: round2(carryIn[id] || 0), unperiodedPaid: round2(unperiodedBy[id] || 0),
      unperiodedDates: (unperiodedDatesBy[id] || []).sort((a, b) => a - b), undatedOrders: cRate > 0 ? undated[index] : 0,
      openEntries: ents.filter((e) => !e.clock_out),
    });
    if (emp.active !== false || line.hasActivity) result.push(line);
  });
  Object.keys(orphanEntries).sort().forEach((key) => {
    const ents = orphanEntries[key];
    const hours = round2(rawHoursOnly(ents).rawHours);
    const lineId = `orphan:${key}`;
    result.push(makeLine({
      id: lineId, employee: { id: key || null, full_name: orphanNames[key] || "Sin empleado", active: false }, isOrphan: true, hours, rawHours: hours,
      overlapHours: 0, overlaps: [], rate: 0, labor: 0, commissionBase: 0, commissionRate: 0, commission: 0, gross: 0,
      salaryPaid: round2(paidBy[key] || 0), proratedPaid: round2(proratedBy[key] || 0), advances: round2(advancesBy[key] || 0),
      advanceCarry: round2(carryIn[lineId] || 0), unperiodedPaid: round2(unperiodedBy[key] || 0), unperiodedDates: (unperiodedDatesBy[key] || []).sort((a, b) => a - b),
      undatedOrders: 0, openEntries: ents.filter((e) => !e.clock_out),
    }));
  });
  return result;
}

function makeLine(l) {
  const totalAdvances = round2(l.advances + l.advanceCarry);
  const balance = Math.max(0, round2(l.gross - l.salaryPaid - totalAdvances));
  const excess = round2(totalAdvances + l.salaryPaid - l.gross);
  return {
    ...l,
    totalAdvances,
    balance,
    advanceLeftover: Math.min(Math.max(0, excess), totalAdvances),
    hasUnperiodedPayments: l.unperiodedPaid > 0.009,
    hasOverlaps: l.overlapHours > 0.009,
    overlapCount: l.overlaps.length,
    overlapAmount: round2(l.overlapHours * l.rate),
    hasActivity: l.hours > 0 || l.rawHours > 0 || l.openEntries.length > 0 || l.commissionBase > 0 || l.salaryPaid > 0 || totalAdvances > 0 || l.unperiodedPaid > 0 || l.undatedOrders > 0,
  };
}

export function payrollLines(data, period) {
  const owner = ownerIndex(data.employees);
  const payments = data.payments.filter((tx) => !tx.is_deleted)
    .map((tx) => ({ tx, tag: parsePayrollTag(tx.description, period.tz) }))
    .filter((x) => x.tag.employeeId);
  const carry = {};
  let step = periodContaining(data.historyStart, period.tz);
  let steps = 0;
  while (step.start < period.start && steps < 400) {
    compute(data, step, owner, payments, carry).forEach((line) => { carry[line.id] = line.advanceLeftover; });
    step = nextPeriod(step);
    steps += 1;
  }
  return compute(data, period, owner, payments, carry);
}

export function paymentsDiffer(a, b) {
  return Math.abs((a?.salaryPaid || 0) - (b?.salaryPaid || 0)) > 0.009
    || Math.abs((a?.totalAdvances || 0) - (b?.totalAdvances || 0)) > 0.009
    || Math.abs((a?.unperiodedPaid || 0) - (b?.unperiodedPaid || 0)) > 0.009;
}

export function punchesDiffer(fresh, shown) {
  if (!shown) return fresh.hours > 0.009 || fresh.hasOverlaps;
  if (Math.abs(fresh.hours - shown.hours) > 0.009) return true;
  const a = new Set(fresh.overlaps.map((o) => o.id));
  const b = new Set(shown.overlaps.map((o) => o.id));
  if (a.size !== b.size) return true;
  for (const x of a) if (!b.has(x)) return true;
  return false;
}

export function hoursLabel(hours) {
  const c = Math.max(0, hours || 0);
  const h = Math.trunc(c);
  const m = Math.round((c - h) * 60);
  if (h <= 0 && m <= 0) return "0h";
  if (h <= 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export async function recordPayrollPayment({ tenantId, employeeId, employeeName, amount, method, notes, period, kind = "sueldo" }) {
  const label = String(notes || "").trim() ? notes : `Pago a ${employeeName}`;
  const { data, error } = await supabase.from("transaction").insert({
    tenant_id: tenantId,
    type: "expense",
    category: "payroll",
    amount,
    description: payrollTagDescription(employeeId, period, kind, label),
    payment_method: method,
    recorded_by: employeeName,
  }).select("*").single();
  if (error) throw error;
  return data;
}

export function payrollDbLabel(period) {
  const f = (d) => new Intl.DateTimeFormat("es-PR", { timeZone: period.tz, day: "numeric", month: "short" }).format(d);
  return `${f(period.start)} – ${f(period.lastDay)}`;
}

export { zonedDate };
