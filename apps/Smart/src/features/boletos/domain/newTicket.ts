import type { EquipmentId } from "./types";
import { checklistItems, damagedLabels, checklistNote } from "./checklist";
import type { CheckMap } from "./checklist";
import { classifyDevice } from "./deviceClass";
import type { DeviceClass } from "./deviceClass";
import { centsToAmount, parseCents } from "./money";
import { BASE_PROBLEMS, OTHER_PROBLEM } from "./problems";
import { depositCents, estimateCents } from "./quote";
import type { DepositMethod } from "./quote";
import {
  digitsOnly, emptyRecharge, emptyUnlock, rechargeCarrierName, rechargeNote, rechargeNumber, rechargeProblem, unlockNote, unlockProblem,
} from "./services";
import type { RechargeDraft, UnlockDraft } from "./services";
import type { TechnicianPick } from "./technicians";

export type GuidedMode = "repair" | "quick" | "recharge" | "unlock";
export type StepId = "customer" | "equipment" | "problem" | "photos" | "optional" | "recharge" | "unlock" | "summary";
export type OptionalSection = "checklist" | "quote" | "technician" | "signature";

export const DEVICE_TYPE_LABEL: Record<EquipmentId, string> = {
  phones: "Celular",
  tablets: "Tableta",
  computers: "Computadora",
  consoles: "Consola",
  unlocks: "Desbloqueo",
  other: "Otro",
};

export interface BusinessDraft {
  enabled: boolean;
  companyName: string;
  taxId: string;
  billingEmail: string;
}

export interface NewTicketDraft {
  id: string;
  orderNumber: string | null;
  customerId: string | null;
  mode: GuidedMode;
  step: StepId;
  completed: StepId[];
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  business: BusinessDraft;
  equipment: EquipmentId;
  brand: string;
  model: string;
  serial: string;
  color: string;
  problems: string[];
  problemText: string;
  hints: string[];
  photoCount: number;
  checklistOn: boolean;
  checklist: CheckMap;
  quoteOn: boolean;
  estimate: string;
  deposit: string;
  depositMethod: DepositMethod;
  techOn: boolean;
  technician: TechnicianPick | null;
  signatureOn: boolean;
  signed: boolean;
  highPriority: boolean;
  liquidDamage: boolean;
  recharge: RechargeDraft;
  unlock: UnlockDraft;
}

export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${hex(3)}-${hex(12)}`;
}

export function emptyDraft(id: string = newUuid()): NewTicketDraft {
  return {
    id,
    orderNumber: null,
    customerId: null,
    mode: "repair",
    step: "customer",
    completed: [],
    phone: "",
    firstName: "",
    lastName: "",
    email: "",
    business: { enabled: false, companyName: "", taxId: "", billingEmail: "" },
    equipment: "phones",
    brand: "",
    model: "",
    serial: "",
    color: "",
    problems: [],
    problemText: "",
    hints: [],
    photoCount: 0,
    checklistOn: false,
    checklist: {},
    quoteOn: false,
    estimate: "",
    deposit: "",
    depositMethod: "cash",
    techOn: false,
    technician: null,
    signatureOn: false,
    signed: false,
    highPriority: false,
    liquidDamage: false,
    recharge: emptyRecharge(),
    unlock: emptyUnlock(),
  };
}

export const phoneDigits = (v: string): string => String(v ?? "").replace(/\D/g, "");

export function optionalSections(mode: GuidedMode): OptionalSection[] {
  if (mode === "repair") return ["checklist", "quote", "technician", "signature"];
  if (mode === "quick") return ["quote"];
  return [];
}

export const sectionOn = (d: NewTicketDraft, s: OptionalSection): boolean => {
  if (!optionalSections(d.mode).includes(s)) return false;
  if (s === "checklist") return d.checklistOn;
  if (s === "quote") return d.quoteOn;
  if (s === "technician") return d.techOn;
  return d.signatureOn;
};

export const isEquipmentMode = (mode: GuidedMode): boolean => mode === "repair" || mode === "quick";

export const customerPhone = (d: NewTicketDraft): string => d.phone;

export const deviceClassOf = (d: NewTicketDraft): DeviceClass => classifyDevice(DEVICE_TYPE_LABEL[d.equipment], d.brand, d.model);

export function problemLabel(id: string): string {
  return [...BASE_PROBLEMS, OTHER_PROBLEM].find((o) => o.id === id)?.label ?? id;
}

export function problemSummary(d: NewTicketDraft): string {
  if (d.mode === "recharge") return rechargeProblem(d.recharge, d.phone);
  if (d.mode === "unlock") return unlockProblem(d.unlock);
  const labels = d.problems.filter((p) => p !== "other").map(problemLabel);
  const text = d.problemText.trim();
  return [labels.join(", "), text].filter(Boolean).join(". ").slice(0, 1000);
}

export function customerFullName(d: NewTicketDraft): string {
  return [d.firstName.trim(), d.lastName.trim()].filter(Boolean).join(" ");
}

export function effectiveEstimateCents(d: NewTicketDraft): number | null {
  if (d.mode === "recharge") return parseCents(d.recharge.amount);
  if (d.mode === "unlock") return parseCents(d.unlock.amount);
  return sectionOn(d, "quote") ? estimateCents(d) : null;
}

export function effectiveDepositCents(d: NewTicketDraft): number {
  return sectionOn(d, "quote") ? depositCents(d) : 0;
}

export function effectiveTechnician(d: NewTicketDraft): TechnicianPick | null {
  return sectionOn(d, "technician") ? d.technician : null;
}

export function effectiveChecklistNote(d: NewTicketDraft): string | null {
  if (!sectionOn(d, "checklist")) return null;
  return checklistNote(checklistItems(deviceClassOf(d)), d.checklist);
}

export interface CreateContext {
  tenantId: string;
  orderNumber: string;
  customerName: string;
  customerId: string | null;
  createdByName: string;
  photoUrls: string[];
  signatureUrl?: string | null;
  now?: string;
}

export function buildOrderPayload(d: NewTicketDraft, ctx: CreateContext): Record<string, unknown> {
  const now = ctx.now ?? new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const payload: Record<string, unknown> = {
    id: d.id,
    tenant_id: ctx.tenantId,
    order_number: ctx.orderNumber,
    customer_name: ctx.customerName,
    status: "intake",
    priority: d.highPriority && isEquipmentMode(d.mode) ? "high" : "normal",
    created_by_name: ctx.createdByName || "Web",
    created_date: now,
    updated_date: now,
    service_type: "workshop",
  };
  if (ctx.customerId) payload.customer_id = ctx.customerId;
  if (d.phone.trim()) payload.customer_phone = d.phone.trim();
  if (d.email.trim()) payload.customer_email = d.email.trim();

  const notes: string[] = [];
  if (d.mode === "recharge") {
    payload.device_type = "Recarga";
    const carrier = rechargeCarrierName(d.recharge);
    if (carrier) payload.device_brand = carrier;
    payload.device_model = rechargeNumber(d.recharge, d.phone);
    notes.push(rechargeNote(d.recharge, d.phone));
  } else if (d.mode === "unlock") {
    const carrier = d.unlock.carrier.trim();
    payload.device_type = carrier ? `Bloqueado: ${carrier}` : "Desbloqueo";
    if (d.unlock.brand.trim()) payload.device_brand = d.unlock.brand.trim();
    if (d.unlock.model.trim()) payload.device_model = d.unlock.model.trim();
    const imei = digitsOnly(d.unlock.imei);
    if (imei) payload.device_serial = imei;
    notes.push(unlockNote(d.unlock));
  } else {
    payload.device_type = DEVICE_TYPE_LABEL[d.equipment];
    if (d.brand.trim()) payload.device_brand = d.brand.trim();
    if (d.model.trim()) payload.device_model = d.model.trim();
    if (d.serial.trim()) payload.device_serial = d.serial.trim();
    if (d.color.trim()) payload.device_color = d.color.trim();
    if (d.mode === "quick") notes.push("[Quick]");
    if (sectionOn(d, "checklist")) {
      const damaged = damagedLabels(checklistItems(deviceClassOf(d)), d.checklist);
      if (damaged.length) notes.push(`Dañados: ${damaged.join(", ")}`);
    }
    if (d.liquidDamage || d.problems.includes("liquid")) payload.liquid_damage = true;
  }
  const problem = problemSummary(d);
  if (problem) payload.initial_problem = problem;
  if (notes.length) payload.status_note = notes.join(" · ");

  const est = effectiveEstimateCents(d);
  if (est !== null && est > 0) payload.cost_estimate = centsToAmount(est);

  const tech = effectiveTechnician(d);
  if (tech && tech.id) {
    payload.assigned_to = tech.id;
    payload.assigned_to_name = tech.name;
  }
  if (sectionOn(d, "signature") && d.signed && ctx.signatureUrl) {
    payload.terms_accepted = true;
    payload.device_security = { signature_url: ctx.signatureUrl };
  }
  if (ctx.photoUrls.length) payload.device_photos = ctx.photoUrls;
  return payload;
}

export const UPSERT_OPTIONS = { onConflict: "id", ignoreDuplicates: true } as const;

export interface WhatsAppCardState {
  connected: boolean;
  enabled: boolean;
  label: string;
  title: string;
  detail: string;
}

export const WHATSAPP_DISCONNECTED: WhatsAppCardState = {
  connected: false,
  enabled: false,
  label: "Sin conectar",
  title: "WhatsApp todavía no está conectado",
  detail: "Cuando el taller conecte WhatsApp, aquí verás las fotos que te envían los clientes y las podrás adjuntar al boleto sin descargarlas.",
};
