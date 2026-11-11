import { describe, expect, it } from "vitest";
import { advance, back, canAdvance, goTo, missingSteps, readyToCreate, selectMode, stepErrors, stepsFor } from "./guided";
import { emptyDraft } from "./newTicket";
import type { NewTicketDraft } from "./newTicket";

function filled(): NewTicketDraft {
  const d = emptyDraft("11111111-1111-4111-8111-111111111111");
  d.firstName = "Maria";
  d.phone = "787-555-0142";
  d.brand = "Apple";
  d.model = "iPhone 13";
  d.problems = ["screen"];
  return d;
}

describe("maquina de estados de los pasos", () => {
  it("cada modo tiene sus pasos", () => {
    expect(stepsFor("repair")).toEqual(["customer", "equipment", "problem", "photos", "optional", "summary"]);
    expect(stepsFor("quick")).toEqual(["customer", "equipment", "problem", "optional", "summary"]);
    expect(stepsFor("recharge")).toEqual(["customer", "recharge", "summary"]);
    expect(stepsFor("unlock")).toEqual(["customer", "unlock", "summary"]);
  });

  it("no avanza con errores y avanza marcando el paso completo", () => {
    const d = emptyDraft();
    expect(advance(d)).toBe(d);
    const ok = advance(filled());
    expect(ok.step).toBe("equipment");
    expect(ok.completed).toEqual(["customer"]);
  });

  it("atras y goTo respetan lo ya completado", () => {
    let d = advance(filled());
    d = advance(d);
    expect(d.step).toBe("problem");
    expect(back(d).step).toBe("equipment");
    expect(goTo(d, "customer").step).toBe("customer");
    expect(goTo(d, "optional")).toBe(d);
    expect(goTo(d, "recharge")).toBe(d);
  });

  it("cambiar de modo vuelve al primer paso y descarta lo que ya no aplica", () => {
    const d = advance(advance(filled()));
    const r = selectMode(d, "recharge");
    expect(r.mode).toBe("recharge");
    expect(r.step).toBe("customer");
    expect(r.completed).toEqual(["customer"]);
    expect(selectMode(r, "recharge")).toBe(r);
    expect(r.firstName).toBe("Maria");
  });

  it("recarga exige operadora, numero de 10 digitos y monto", () => {
    const d = { ...filled(), mode: "recharge" as const };
    expect(stepErrors("recharge", d)).toContain("Elige la operadora.");
    const ok = { ...d, recharge: { carrier: "Claro", carrierOther: "", sameNumber: true, phone: "", amount: "15" } };
    expect(canAdvance("recharge", ok)).toBe(true);
    expect(stepErrors("recharge", { ...ok, recharge: { ...ok.recharge, sameNumber: false, phone: "123" } })).toContain("El número a recargar debe tener 10 dígitos.");
    expect(stepErrors("recharge", { ...ok, recharge: { ...ok.recharge, amount: "" } })).toContain("Elige el monto de la recarga.");
    expect(stepErrors("recharge", { ...ok, recharge: { ...ok.recharge, carrier: "Otra", carrierOther: "" } })).toContain("Elige la operadora.");
  });

  it("desbloqueo exige tipo, marca, modelo, imei valido y monto", () => {
    const d = { ...filled(), mode: "unlock" as const };
    expect(stepErrors("unlock", d)).toContain("Elige el tipo de trabajo.");
    const ok = { ...d, unlock: { type: "blacklist" as const, brand: "Apple", model: "X", carrier: "", imei: "", amount: "35" } };
    expect(canAdvance("unlock", ok)).toBe(true);
    expect(stepErrors("unlock", { ...ok, unlock: { ...ok.unlock, imei: "123" } })).toContain("El IMEI debe tener 15 dígitos.");
  });

  it("empresa pide nombre de empresa y correo de facturacion valido", () => {
    const d = { ...filled(), business: { enabled: true, companyName: "", taxId: "", billingEmail: "mal" } };
    const errs = stepErrors("customer", d);
    expect(errs).toContain("Falta el nombre de la empresa.");
    expect(errs).toContain("El correo de facturación no es válido.");
    expect(canAdvance("customer", { ...d, business: { ...d.business, companyName: "Taller SA", billingEmail: "" } })).toBe(true);
  });

  it("cliente existente no pide nombre; telefono y correo se validan", () => {
    const d = { ...emptyDraft(), customerId: "c1" };
    expect(canAdvance("customer", d)).toBe(true);
    expect(stepErrors("customer", { ...d, phone: "12" })).toContain("El teléfono parece incompleto.");
    expect(stepErrors("customer", { ...d, email: "mal" })).toContain("El correo no es válido.");
  });

  it("problema y equipo", () => {
    const d = emptyDraft();
    expect(canAdvance("equipment", d)).toBe(false);
    expect(canAdvance("problem", d)).toBe(false);
    expect(stepErrors("problem", { ...d, problems: ["other"] })).toContain("Describe el problema en Otro.");
  });

  it("opcionales: cotizacion, deposito y firma solo se validan si estan activos", () => {
    const d = filled();
    expect(canAdvance("optional", { ...d, estimate: "abc", signed: false })).toBe(true);
    expect(stepErrors("optional", { ...d, quoteOn: true, estimate: "abc" })).toContain("El estimado no es un monto válido.");
    expect(stepErrors("optional", { ...d, quoteOn: true, estimate: "", deposit: "20" })).toContain("Para cobrar un depósito escribe primero el estimado.");
    expect(stepErrors("optional", { ...d, quoteOn: true, estimate: "30", deposit: "50" })).toContain("El depósito no puede pasar del estimado.");
    expect(canAdvance("optional", { ...d, quoteOn: true, estimate: "100", deposit: "half" })).toBe(true);
    expect(stepErrors("optional", { ...d, signatureOn: true, signed: false }).length).toBe(1);
    expect(canAdvance("optional", { ...d, signatureOn: true, signed: true })).toBe(true);
  });

  it("en modo rapido la firma y la revision no aplican", () => {
    expect(canAdvance("optional", { ...filled(), mode: "quick", signatureOn: true, signed: false })).toBe(true);
  });

  it("missing y readyToCreate", () => {
    expect(readyToCreate(filled())).toBe(true);
    expect(missingSteps(emptyDraft())).toEqual(["customer", "equipment", "problem"]);
    expect(readyToCreate({ ...filled(), mode: "recharge" })).toBe(false);
  });
});
