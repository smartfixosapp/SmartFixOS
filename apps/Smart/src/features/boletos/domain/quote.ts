import { formatCents, parseCents } from "./money";

export type DepositMethod = "cash" | "card" | "ath_movil";

export const DEPOSIT_METHODS: readonly { id: DepositMethod; label: string }[] = [
  { id: "cash", label: "Efectivo" },
  { id: "card", label: "Tarjeta" },
  { id: "ath_movil", label: "ATH Móvil" },
];

export const ESTIMATE_AMOUNTS: readonly number[] = [25, 50, 75, 100, 150, 200];
export const DEPOSIT_AMOUNTS: readonly number[] = [20, 50];
export const DEPOSIT_HALF = "half";

export interface QuoteInput {
  estimate: string;
  deposit: string;
}

export function estimateCents(q: QuoteInput): number | null {
  return parseCents(q.estimate);
}

export function depositCents(q: QuoteInput): number {
  const raw = q.deposit.trim();
  if (!raw) return 0;
  if (raw === DEPOSIT_HALF) {
    const est = estimateCents(q);
    return est !== null && est >= 200 ? Math.floor(est / 2) : 0;
  }
  return parseCents(raw) ?? 0;
}

export function depositOptions(q: QuoteInput): { id: string; label: string; hint?: string }[] {
  const est = estimateCents(q);
  const fixed = DEPOSIT_AMOUNTS.filter((a) => est === null || a * 100 <= est).map((a) => ({ id: String(a), label: `$${a}` }));
  const half = est !== null && est >= 200 ? [{ id: DEPOSIT_HALF, label: "Mitad", hint: formatCents(Math.floor(est / 2)) }] : [];
  return [{ id: "", label: "Sin depósito" }, ...fixed, ...half];
}

export function quoteError(q: QuoteInput): string | null {
  const est = q.estimate.trim();
  if (est && parseCents(est) === null) return "El estimado no es un monto válido.";
  const dep = q.deposit.trim();
  if (dep && dep !== DEPOSIT_HALF && parseCents(dep) === null) return "El depósito no es un monto válido.";
  const e = estimateCents(q);
  const d = depositCents(q);
  if (dep && d === 0 && dep === DEPOSIT_HALF) return "La mitad necesita un estimado de al menos $2.00.";
  if (d > 0 && e === null) return "Para cobrar un depósito escribe primero el estimado.";
  if (d > 0 && e !== null && d > e) return "El depósito no puede pasar del estimado.";
  return null;
}

export function quoteSummary(q: QuoteInput, methodLabel: string): string | null {
  const e = estimateCents(q);
  const d = depositCents(q);
  if (e === null && d === 0) return null;
  const parts: string[] = [];
  if (e !== null) parts.push(`Estimado ${formatCents(e)}`);
  if (d > 0) parts.push(`Depósito ${formatCents(d)} · ${methodLabel}`);
  return parts.join(" · ");
}

export type RegisterState = "open" | "closed" | "unknown";
export type DepositAction = "none" | "collect" | "pending_closed" | "pending_unverified";

export function depositDecision(cents: number, register: RegisterState): DepositAction {
  if (cents <= 0) return "none";
  if (register === "open") return "collect";
  if (register === "closed") return "pending_closed";
  return "pending_unverified";
}

export function depositWarning(action: DepositAction, cents: number): string | null {
  if (action === "pending_closed") return `La caja está cerrada: el depósito de ${formatCents(cents)} quedó pendiente. Abre la caja y cóbralo desde el boleto.`;
  if (action === "pending_unverified") return `No se pudo verificar la caja: el depósito de ${formatCents(cents)} quedó pendiente. Cóbralo desde el boleto.`;
  return null;
}

export function alreadyDeposited(existingAmounts: number[], cents: number): boolean {
  const paid = existingAmounts.reduce((s, a) => s + (Number(a) || 0), 0);
  return paid + 0.005 >= cents / 100;
}
