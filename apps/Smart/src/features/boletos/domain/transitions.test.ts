import { describe, expect, it } from "vitest";
import { STATUSES } from "./statuses";
import { allowedTargets, assertStatusKey, canTransition, isClosingTarget, menuSections, reopenTargets } from "./transitions";

describe("transiciones de estatus", () => {
  it("desde en reparacion se permiten 14 destinos directos y garantia llega por reclamo", () => {
    const targets = allowedTargets("in_progress");
    expect(targets).toHaveLength(14);
    expect(targets).not.toContain("in_progress");
    expect(targets).not.toContain("warranty");
  });

  it("el menu agrupa flujo principal, especiales y cierre sin repetir ni incluir el actual", () => {
    const sections = menuSections("in_progress");
    expect(sections.map((s) => s.id)).toEqual(["main", "special", "closed"]);
    const all = sections.flatMap((s) => s.items.map((i) => i.key));
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain("in_progress");
    expect(sections.find((s) => s.id === "closed")!.items.map((i) => i.key).sort()).toEqual(["abandoned", "cancelled", "delivered", "not_repairable"]);
    expect(sections.find((s) => s.id === "closed")!.note).toMatch(/Cerradas/);
  });

  it("los cerrados salen solo con Reabrir o a garantia segun el token", () => {
    expect(allowedTargets("delivered")).toEqual(["warranty"]);
    expect(allowedTargets("cancelled")).toEqual([]);
    expect(reopenTargets("cancelled")).toContain("in_progress");
    expect(reopenTargets("cancelled")).not.toContain("cancelled");
    const sections = menuSections("abandoned");
    expect(sections.map((s) => s.id)).toEqual(["reopen"]);
  });

  it("garantia solo vuelve a en reparacion", () => {
    expect(allowedTargets("warranty")).toEqual(["in_progress"]);
    expect(reopenTargets("warranty")).toEqual([]);
  });

  it("canTransition rechaza el mismo estatus, claves invalidas y completed", () => {
    expect(canTransition("intake", "intake")).toBe(false);
    expect(canTransition("intake", "completed")).toBe(false);
    expect(canTransition("intake", "diagnosing")).toBe(true);
    expect(canTransition("warranty", "delivered")).toBe(false);
    expect(() => assertStatusKey("completed")).toThrow();
  });

  it("isClosingTarget marca solo los cuatro de cierre", () => {
    expect(STATUSES.filter((s) => isClosingTarget(s.key)).map((s) => s.key).sort()).toEqual(["abandoned", "cancelled", "delivered", "not_repairable"]);
  });

  it("un estatus desconocido no ofrece destinos", () => {
    expect(allowedTargets("completed")).toEqual([]);
    expect(menuSections(null)).toEqual([]);
  });
});
