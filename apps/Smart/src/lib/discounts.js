export function discountEnded(value) {
  const raw = String(value || "");
  if (!raw) return false;
  const end = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T23:59:59`) : new Date(raw);
  return Number.isFinite(end.getTime()) && end < new Date();
}
