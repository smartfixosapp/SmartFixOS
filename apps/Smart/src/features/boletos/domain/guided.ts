import { phoneDigits, sectionOn } from "./newTicket";
import type { GuidedMode, NewTicketDraft, StepId } from "./newTicket";
import { quoteError } from "./quote";
import { rechargeError, unlockError } from "./services";

export const MODES: readonly { id: GuidedMode; label: string; hint: string; icon: string }[] = [
  { id: "repair", label: "Reparación", hint: "Diagnóstico, piezas y entrega", icon: "tool" },
  { id: "quick", label: "Rápida", hint: "Se hace mientras el cliente espera", icon: "bolt" },
  { id: "recharge", label: "Recarga", hint: "Tiempo o datos, sin equipo", icon: "sim" },
  { id: "unlock", label: "Desbloqueo", hint: "Operadora, lista negra o IMEI", icon: "unlock" },
];

export const STEP_LABEL: Record<StepId, string> = {
  customer: "Cliente",
  equipment: "Equipo",
  problem: "Problema",
  photos: "Fotos",
  optional: "Opcionales",
  recharge: "Recarga",
  unlock: "Desbloqueo",
  summary: "Resumen",
};

export function stepsFor(mode: GuidedMode): StepId[] {
  if (mode === "repair") return ["customer", "equipment", "problem", "photos", "optional", "summary"];
  if (mode === "quick") return ["customer", "equipment", "problem", "optional", "summary"];
  if (mode === "recharge") return ["customer", "recharge", "summary"];
  return ["customer", "unlock", "summary"];
}

const EMAIL = /^[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const emailValid = (raw: string): boolean => {
  const v = raw.trim();
  return !v || (v.length <= 120 && EMAIL.test(v));
};

export function stepErrors(step: StepId, d: NewTicketDraft): string[] {
  const errs: string[] = [];
  if (step === "customer") {
    if (!d.firstName.trim() && !d.customerId) errs.push("Falta el nombre del cliente.");
    if (d.phone.trim() && phoneDigits(d.phone).length < 7) errs.push("El teléfono parece incompleto.");
    if (!emailValid(d.email)) errs.push("El correo no es válido.");
    if (d.business.enabled) {
      if (!d.business.companyName.trim()) errs.push("Falta el nombre de la empresa.");
      if (d.business.billingEmail.trim() && !emailValid(d.business.billingEmail)) errs.push("El correo de facturación no es válido.");
    }
  }
  if (step === "equipment") {
    if (!d.model.trim() && !d.brand.trim()) errs.push("Indica la marca o el modelo del equipo.");
  }
  if (step === "problem") {
    if (!d.problems.length && !d.problemText.trim()) errs.push("Marca al menos un problema o descríbelo.");
    if (d.problems.includes("other") && !d.problemText.trim()) errs.push("Describe el problema en Otro.");
  }
  if (step === "optional") {
    if (sectionOn(d, "quote")) {
      const e = quoteError(d);
      if (e) errs.push(e);
    }
    if (sectionOn(d, "signature") && !d.signed) errs.push("El cliente aún no ha firmado. Pídele la firma o desactiva ese paso.");
  }
  if (step === "recharge") {
    const e = rechargeError(d.recharge, d.phone);
    if (e) errs.push(e);
  }
  if (step === "unlock") {
    const e = unlockError(d.unlock);
    if (e) errs.push(e);
  }
  return errs;
}

export const canAdvance = (step: StepId, d: NewTicketDraft): boolean => stepErrors(step, d).length === 0;

const nextAfter = (mode: GuidedMode, step: StepId): StepId => {
  const list = stepsFor(mode);
  return list[list.indexOf(step) + 1] ?? step;
};

export function selectMode(d: NewTicketDraft, mode: GuidedMode): NewTicketDraft {
  if (d.mode === mode) return d;
  const valid = stepsFor(mode);
  return { ...d, mode, step: "customer", completed: d.completed.filter((s) => valid.includes(s) && s === "customer") };
}

export function advance(d: NewTicketDraft): NewTicketDraft {
  if (d.step === "summary" || !canAdvance(d.step, d)) return d;
  return { ...d, completed: d.completed.includes(d.step) ? d.completed : [...d.completed, d.step], step: nextAfter(d.mode, d.step) };
}

export function back(d: NewTicketDraft): NewTicketDraft {
  const list = stepsFor(d.mode);
  const i = list.indexOf(d.step);
  return i > 0 ? { ...d, step: list[i - 1] } : d;
}

export function goTo(d: NewTicketDraft, target: StepId): NewTicketDraft {
  const list = stepsFor(d.mode);
  if (!list.includes(target) || target === d.step) return d;
  const reachable = list.indexOf(target) < list.indexOf(d.step) || d.completed.includes(target);
  return reachable ? { ...d, step: target } : d;
}

export function missingSteps(d: NewTicketDraft): StepId[] {
  return stepsFor(d.mode).filter((s) => s !== "summary" && !canAdvance(s, d));
}

export const readyToCreate = (d: NewTicketDraft): boolean => missingSteps(d).length === 0;
