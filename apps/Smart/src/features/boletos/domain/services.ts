import { formatCents, parseCents } from "./money";

export const CARRIERS: readonly string[] = ["T-Mobile", "Claro", "Liberty", "Verizon", "AT&T", "Cricket", "Metro", "Boost", "Tigo", "Virgin Mobile"];
export const OTHER_CARRIER = "Otra";
export const RECHARGE_AMOUNTS: readonly number[] = [10, 15, 20, 25, 30, 40, 50];
export const UNLOCK_AMOUNTS: readonly number[] = [20, 35, 50, 75, 100, 150];

export type UnlockType = "blacklist" | "carrier_unlock" | "imei_change";

export const UNLOCK_TYPES: readonly { id: UnlockType; label: string; hint: string }[] = [
  { id: "blacklist", label: "Lista negra", hint: "Verificar o gestionar reportes de robo o pérdida" },
  { id: "carrier_unlock", label: "Desbloqueo de operadora", hint: "Para usar con cualquier operadora" },
  { id: "imei_change", label: "Cambio de IMEI", hint: "Modificar el IMEI del equipo" },
];

export interface RechargeDraft {
  carrier: string;
  carrierOther: string;
  sameNumber: boolean;
  phone: string;
  amount: string;
}

export interface UnlockDraft {
  type: UnlockType | "";
  brand: string;
  model: string;
  carrier: string;
  imei: string;
  amount: string;
}

export const emptyRecharge = (): RechargeDraft => ({ carrier: "", carrierOther: "", sameNumber: true, phone: "", amount: "" });
export const emptyUnlock = (): UnlockDraft => ({ type: "", brand: "", model: "", carrier: "", imei: "", amount: "" });

export const digitsOnly = (v: string): string => String(v ?? "").replace(/\D/g, "");

export function normalizePhone(raw: string): string {
  const d = digitsOnly(raw);
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

export const rechargeCarrierName = (r: RechargeDraft): string => (r.carrier === OTHER_CARRIER ? r.carrierOther.trim() : r.carrier.trim());

export const rechargeNumber = (r: RechargeDraft, customerPhone: string): string => normalizePhone(r.sameNumber ? customerPhone : r.phone);

export function rechargeError(r: RechargeDraft, customerPhone: string): string | null {
  if (!rechargeCarrierName(r)) return "Elige la operadora.";
  if (rechargeNumber(r, customerPhone).length !== 10) return "El número a recargar debe tener 10 dígitos.";
  if (parseCents(r.amount) === null) return "Elige el monto de la recarga.";
  return null;
}

export function rechargeProblem(r: RechargeDraft, customerPhone: string): string {
  const cents = parseCents(r.amount) ?? 0;
  return `Recarga de ${formatCents(cents)} al ${rechargeNumber(r, customerPhone)} (${rechargeCarrierName(r)})`;
}

export function rechargeNote(r: RechargeDraft, customerPhone: string): string {
  return ["[Recarga]", `Tel: ${rechargeNumber(r, customerPhone)}`, `Operadora: ${rechargeCarrierName(r)}`, `Monto: ${formatCents(parseCents(r.amount) ?? 0)}`].join(" · ");
}

export const unlockTypeLabel = (u: UnlockDraft): string => UNLOCK_TYPES.find((t) => t.id === u.type)?.label ?? "";

export function unlockError(u: UnlockDraft): string | null {
  if (!u.type) return "Elige el tipo de trabajo.";
  if (!u.brand.trim()) return "Falta la marca del equipo.";
  if (!u.model.trim()) return "Falta el modelo del equipo.";
  if (u.imei.trim() && digitsOnly(u.imei).length !== 15) return "El IMEI debe tener 15 dígitos.";
  if (parseCents(u.amount) === null) return "Elige el monto del servicio.";
  return null;
}

export function unlockProblem(u: UnlockDraft): string {
  let text = unlockTypeLabel(u);
  if (u.carrier.trim()) text += ` · Operadora: ${u.carrier.trim()}`;
  if (u.imei.trim()) text += ` · IMEI: ${digitsOnly(u.imei)}`;
  return text;
}

export function unlockNote(u: UnlockDraft): string {
  const parts = ["[Desbloqueo]", `Tipo: ${unlockTypeLabel(u)}`];
  if (u.carrier.trim()) parts.push(`Carrier: ${u.carrier.trim()}`);
  parts.push(`Monto: ${formatCents(parseCents(u.amount) ?? 0)}`);
  return parts.join(" · ");
}
