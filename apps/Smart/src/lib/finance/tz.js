export function safeTZ(tz) {
  const id = String(tz || "").trim();
  if (!id) return "America/Puerto_Rico";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: id });
    return id;
  } catch {
    return "America/Puerto_Rico";
  }
}

const partsCache = new Map();

function formatter(tz) {
  if (!partsCache.has(tz)) {
    partsCache.set(tz, new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    }));
  }
  return partsCache.get(tz);
}

const WD = { Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7 };

export function zonedParts(date, tz) {
  const parts = formatter(tz).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    h: Number(get("hour")),
    mi: Number(get("minute")),
    s: Number(get("second")),
    weekday: WD[get("weekday")] || 1,
  };
}

function offsetMs(date, tz) {
  const p = zonedParts(date, tz);
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUTC - Math.floor(date.getTime() / 1000) * 1000;
}

export function zonedDate(y, m, d, tz, h = 0, mi = 0, s = 0) {
  const guess = Date.UTC(y, m - 1, d, h, mi, s);
  const a = guess - offsetMs(new Date(guess), tz);
  const b = guess - offsetMs(new Date(a), tz);
  let ts = b;
  const p = zonedParts(new Date(ts), tz);
  if (p.y !== y || p.m !== m || p.d !== d || p.h !== h || p.mi !== mi) ts = Math.max(a, b);
  return new Date(ts);
}

export function startOfDay(date, tz) {
  const p = zonedParts(date, tz);
  return zonedDate(p.y, p.m, p.d, tz);
}

export function addDays(date, days, tz) {
  const p = zonedParts(date, tz);
  const base = new Date(Date.UTC(p.y, p.m - 1, p.d + days));
  return zonedDate(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), tz, p.h, p.mi, p.s);
}

export function monthStart(date, tz) {
  const p = zonedParts(date, tz);
  return zonedDate(p.y, p.m, 1, tz);
}

export function addMonths(date, months, tz) {
  const p = zonedParts(date, tz);
  const base = new Date(Date.UTC(p.y, p.m - 1 + months, 1));
  return zonedDate(base.getUTCFullYear(), base.getUTCMonth() + 1, 1, tz);
}

export function monthRange(date, tz) {
  const start = monthStart(date, tz);
  const next = addMonths(start, 1, tz);
  return { start, end: new Date(next.getTime() - 1000) };
}

export function sameDay(a, b, tz) {
  const x = zonedParts(a, tz);
  const y = zonedParts(b, tz);
  return x.y === y.y && x.m === y.m && x.d === y.d;
}

export function sameMonth(a, b, tz) {
  const x = zonedParts(a, tz);
  const y = zonedParts(b, tz);
  return x.y === y.y && x.m === y.m;
}

export function daysInMonth(date, tz) {
  const p = zonedParts(date, tz);
  return new Date(Date.UTC(p.y, p.m, 0)).getUTCDate();
}

export function dayString(date, tz) {
  const p = zonedParts(date, tz);
  return `${String(p.y).padStart(4, "0")}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function parseDay(raw, tz) {
  const parts = String(raw || "").trim().split("-").map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return zonedDate(parts[0], parts[1], parts[2], tz);
}

export function daysBetween(a, b, tz) {
  const x = zonedParts(a, tz);
  const y = zonedParts(b, tz);
  return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 86400000);
}

export function fmt(date, tz, options, locale = "es-PR") {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, ...options }).format(date);
}

export function capitalize(s) {
  return String(s || "").replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
