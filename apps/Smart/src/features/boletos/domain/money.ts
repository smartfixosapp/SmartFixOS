export const MAX_CENTS = 10_000_000;

export function parseCents(raw: string): number | null {
  const text = String(raw ?? "").trim().replace(/^\$/, "").trim().replace(",", ".");
  if (!text) return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ""] = text.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return cents >= 1 && cents <= MAX_CENTS ? cents : null;
}

export function formatCents(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  return `${cents < 0 ? "-" : ""}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export const centsToAmount = (cents: number): number => Math.round(cents) / 100;

export const dollarsText = (cents: number): string => (cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2));
