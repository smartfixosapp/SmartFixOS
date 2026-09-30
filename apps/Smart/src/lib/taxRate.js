export function normalizeTaxPercent(raw, fallback = 11.5) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n > 0 && n < 1 ? Math.round(n * 10000) / 100 : n;
}

export const tenantTaxPercent = (tenant, fallback = 11.5) => normalizeTaxPercent(tenant?.settings?.tax_rate, fallback);
