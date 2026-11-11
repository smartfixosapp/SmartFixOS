import type { EquipmentId } from "./types";

export const NEW_TICKET_STEPS = ["Cliente", "Equipo", "Problema", "Fotos", "Opcionales", "Resumen"] as const;
export type NewTicketStep = 0 | 1 | 2 | 3 | 4 | 5;

export const PROBLEM_OPTIONS: readonly { id: string; label: string; icon: string }[] = [
  { id: "screen", label: "Pantalla", icon: "phone" },
  { id: "battery", label: "Batería", icon: "bat" },
  { id: "port", label: "Puerto de carga", icon: "plug" },
  { id: "power", label: "No prende", icon: "power" },
  { id: "liquid", label: "Líquido o agua", icon: "drop" },
  { id: "camera", label: "Cámara", icon: "cam" },
  { id: "audio", label: "Audio", icon: "spk" },
  { id: "software", label: "Software", icon: "code" },
  { id: "other", label: "Otro", icon: "pen" },
];

export const DEVICE_TYPE_LABEL: Record<EquipmentId, string> = {
  phones: "Celular",
  tablets: "Tableta",
  computers: "Computadora",
  consoles: "Consola",
  unlocks: "Desbloqueo",
  other: "Otro",
};

export interface NewTicketDraft {
  id: string;
  orderNumber: string | null;
  customerId: string | null;
  quick: boolean;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  equipment: EquipmentId;
  brand: string;
  model: string;
  serial: string;
  problems: string[];
  problemText: string;
  photoCount: number;
  estimate: string;
  highPriority: boolean;
  liquidDamage: boolean;
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
    quick: false,
    phone: "",
    firstName: "",
    lastName: "",
    email: "",
    equipment: "phones",
    brand: "",
    model: "",
    serial: "",
    problems: [],
    problemText: "",
    photoCount: 0,
    estimate: "",
    highPriority: false,
    liquidDamage: false,
  };
}

export const phoneDigits = (v: string): string => String(v ?? "").replace(/\D/g, "");

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function stepErrors(step: NewTicketStep, d: NewTicketDraft): string[] {
  const errs: string[] = [];
  if (step === 0) {
    if (!d.firstName.trim() && !d.customerId) errs.push("Falta el nombre del cliente.");
    if (d.phone.trim() && phoneDigits(d.phone).length < 7) errs.push("El teléfono parece incompleto.");
    if (d.email.trim() && !EMAIL.test(d.email.trim())) errs.push("El correo no es válido.");
  }
  if (step === 1) {
    if (!d.model.trim() && !d.brand.trim()) errs.push("Indica la marca o el modelo del equipo.");
  }
  if (step === 2) {
    if (!d.problems.length && !d.problemText.trim()) errs.push("Marca al menos un problema o descríbelo.");
    if (d.problems.includes("other") && !d.problemText.trim()) errs.push("Describe el problema en Otro.");
  }
  if (step === 4) {
    const est = d.estimate.trim();
    if (est && !(Number(est.replace(",", ".")) >= 0)) errs.push("El estimado no es un monto válido.");
  }
  return errs;
}

export function canAdvance(step: NewTicketStep, d: NewTicketDraft): boolean {
  return stepErrors(step, d).length === 0;
}

export function allStepsValid(d: NewTicketDraft): boolean {
  return ([0, 1, 2, 4] as NewTicketStep[]).every((s) => canAdvance(s, d));
}

export function problemSummary(d: NewTicketDraft): string {
  const labels = d.problems.filter((p) => p !== "other").map((p) => PROBLEM_OPTIONS.find((o) => o.id === p)?.label ?? p);
  const text = d.problemText.trim();
  return [labels.join(", "), text].filter(Boolean).join(". ");
}

export function customerFullName(d: NewTicketDraft): string {
  return [d.firstName.trim(), d.lastName.trim()].filter(Boolean).join(" ");
}

export interface CreateContext {
  tenantId: string;
  orderNumber: string;
  customerName: string;
  customerId: string | null;
  createdByName: string;
  photoUrls: string[];
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
    priority: d.highPriority ? "high" : "normal",
    created_by_name: ctx.createdByName || "Web",
    created_date: now,
    updated_date: now,
    is_quick_service: d.quick,
    service_type: "workshop",
    device_type: DEVICE_TYPE_LABEL[d.equipment],
  };
  if (ctx.customerId) payload.customer_id = ctx.customerId;
  if (d.phone.trim()) payload.customer_phone = d.phone.trim();
  if (d.email.trim()) payload.customer_email = d.email.trim();
  if (d.brand.trim()) payload.device_brand = d.brand.trim();
  if (d.model.trim()) payload.device_model = d.model.trim();
  if (d.serial.trim()) payload.device_serial = d.serial.trim();
  const problem = problemSummary(d);
  if (problem) payload.initial_problem = problem;
  if (d.quick) payload.status_note = "[Quick]";
  if (d.liquidDamage || d.problems.includes("liquid")) payload.liquid_damage = true;
  const est = Number(d.estimate.trim().replace(",", "."));
  if (d.estimate.trim() && est > 0) payload.cost_estimate = est;
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
