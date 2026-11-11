import { describe, expect, it } from "vitest";
import { checkCounts, checklistItems, checklistNote, checklistSummary, cycleCheck, markAllOk } from "./checklist";
import { classifyDevice } from "./deviceClass";
import { formatCents, parseCents } from "./money";
import { hintsFromAnalysis, problemOptions } from "./problems";
import { alreadyDeposited, depositCents, depositDecision, depositOptions, depositWarning, quoteSummary } from "./quote";
import { autoPickTechnician, buildTechnicians, orderTechnicians } from "./technicians";

describe("dinero", () => {
  it("convierte y formatea centavos", () => {
    expect(parseCents("$145.50")).toBe(14550);
    expect(parseCents("85,5")).toBe(8550);
    expect(parseCents("0")).toBeNull();
    expect(parseCents("abc")).toBeNull();
    expect(parseCents("12345678")).toBeNull();
    expect(formatCents(5000)).toBe("$50.00");
    expect(formatCents(5)).toBe("$0.05");
  });
});

describe("deposito y caja", () => {
  it("la mitad solo existe con estimado desde 2 dolares", () => {
    expect(depositCents({ estimate: "145", deposit: "half" })).toBe(7250);
    expect(depositCents({ estimate: "", deposit: "half" })).toBe(0);
    expect(depositOptions({ estimate: "", deposit: "" }).map((o) => o.id)).toEqual(["", "20", "50"]);
    expect(depositOptions({ estimate: "30", deposit: "" }).map((o) => o.id)).toEqual(["", "20", "half"]);
  });

  it("regla de caja abierta: solo cobra con la caja abierta", () => {
    expect(depositDecision(0, "open")).toBe("none");
    expect(depositDecision(5000, "open")).toBe("collect");
    expect(depositDecision(5000, "closed")).toBe("pending_closed");
    expect(depositDecision(5000, "unknown")).toBe("pending_unverified");
    expect(depositWarning("pending_closed", 5000)).toContain("caja está cerrada");
    expect(depositWarning("collect", 5000)).toBeNull();
  });

  it("no cobra dos veces un deposito ya registrado", () => {
    expect(alreadyDeposited([50], 5000)).toBe(true);
    expect(alreadyDeposited([20], 5000)).toBe(false);
    expect(alreadyDeposited([], 5000)).toBe(false);
  });

  it("resumen de cotizacion", () => {
    expect(quoteSummary({ estimate: "", deposit: "" }, "Efectivo")).toBeNull();
    expect(quoteSummary({ estimate: "145", deposit: "50" }, "ATH Móvil")).toBe("Estimado $145.00 · Depósito $50.00 · ATH Móvil");
  });
});

describe("revision del equipo", () => {
  it("quita puntos que no aplican al tipo de equipo", () => {
    const phone = checklistItems("phone").map((i) => i.id);
    expect(phone).toHaveLength(13);
    expect(checklistItems("console").map((i) => i.id)).not.toContain("screen");
    expect(checklistItems("watch").map((i) => i.id)).not.toContain("ports");
  });

  it("cicla no probado, funciona, danado y arma la nota", () => {
    const items = checklistItems("phone");
    let map = cycleCheck({}, "screen");
    expect(map).toEqual({ screen: "ok" });
    map = cycleCheck(map, "screen");
    expect(map).toEqual({ screen: "damaged" });
    expect(cycleCheck(map, "screen")).toEqual({});
    map = markAllOk(items, map);
    expect(map.screen).toBe("damaged");
    expect(checkCounts(items, map)).toEqual({ ok: 12, damaged: 1, untested: 0 });
    expect(checklistSummary(items, map)).toBe("1 dañado, 12 funcionan");
    expect(checklistNote(items, { screen: "damaged", power: "ok" })).toBe("Revisión al recibir el equipo. Dañado: Pantalla. Funciona: Encendido.");
    expect(checklistNote(items, {})).toBeNull();
  });
});

describe("tecnicos", () => {
  const list = buildTechnicians(
    [{ id: "a", full_name: "Ana M." }, { id: "b", full_name: "Jose L." }, { id: "c", email: "carlos@x.com" }, { id: "", full_name: "Sin id" }],
    { a: 3, b: 1 },
  );

  it("arma la lista con carga abierta", () => {
    expect(list.map((t) => [t.id, t.name, t.openOrders])).toEqual([["a", "Ana M.", 3], ["b", "Jose L.", 1], ["c", "carlos@x.com", 0]]);
  });

  it("pone primero al empleado actual y luego al menos cargado", () => {
    expect(orderTechnicians(list, "a", "").map((t) => t.id)).toEqual(["a", "c", "b"]);
    expect(orderTechnicians(list, null, "jose l.").map((t) => t.id)).toEqual(["b", "c", "a"]);
  });

  it("autoasigna solo si el empleado actual es tecnico", () => {
    expect(autoPickTechnician(list, "b", "")).toEqual({ id: "b", name: "Jose L.", auto: true });
    expect(autoPickTechnician(list, "zzz", "Otro")).toBeNull();
  });
});

describe("clasificacion y problemas", () => {
  it("clasifica por tipo, marca y modelo", () => {
    expect(classifyDevice("Celular")).toBe("phone");
    expect(classifyDevice("Computadora", "Apple", "iMac 24")).toBe("desktop");
    expect(classifyDevice("Computadora", "Dell", "XPS")).toBe("laptop");
    expect(classifyDevice("Otro", "Sony", "PlayStation 5")).toBe("console");
    expect(classifyDevice("Otro", "Apple", "Apple Watch 9")).toBe("watch");
    expect(classifyDevice("Otro")).toBe("other");
  });

  it("la foto sube sus problemas al inicio y Otro siempre va al final", () => {
    const opts = problemOptions("phone", ["liquid"]);
    expect(opts[0]).toMatchObject({ id: "liquid", hint: "Visto en la foto", highlighted: true });
    expect(opts[opts.length - 1].id).toBe("other");
    expect(problemOptions("console", []).map((o) => o.id)).not.toContain("screen");
    expect(problemOptions("console", [])[0].id).toBe("hdmi");
  });

  it("deduce problemas de la lectura de la foto", () => {
    expect(hintsFromAnalysis("screen", "Pantalla con cristal roto y humedad")).toEqual(["screen", "liquid"]);
    expect(hintsFromAnalysis("", "Todo normal")).toEqual([]);
  });
});
