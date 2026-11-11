import { describe, expect, it } from "vitest";
import {
  activeChips, applyFilters, clearAll, EMPTY_FILTERS, equipmentCounts, filterBubble, groupByStatus, inVista, isClosed,
  matchesQuery, removeChip, statusCounts, toggleIn, toggleVista, vistaCounts,
} from "./filters";
import type { OrderRow } from "./types";

const o = (id: string, status: string, extra: Partial<OrderRow> = {}): OrderRow => ({ id, order_number: `WO-${id}`, status, customer_name: "Cliente", device_model: "iPhone 13", device_type: "Celular", ...extra });

const rows: OrderRow[] = [
  o("1", "in_progress"),
  o("2", "in_progress", { device_model: "Switch", device_type: "Consola" }),
  o("3", "waiting_parts", { device_model: "MacBook Air", device_type: "Computadora" }),
  o("4", "delivered"),
  o("5", "warranty"),
  o("6", "scheduled", { appointment_at: "2026-11-12T10:00:00Z", service_type: "visit" }),
  o("7", "cancelled"),
  o("8", "cancelled", { not_repairable_resolved_at: "2026-11-01T00:00:00Z" }),
  o("9", "intake", { is_deleted: true }),
];

describe("filtros de la lista", () => {
  it("sin filtros muestra los abiertos y oculta cerrados y borrados", () => {
    expect(applyFilters(rows, EMPTY_FILTERS).map((x) => x.id)).toEqual(["1", "2", "3", "5", "6", "7"]);
  });

  it("cancelado sin resolver sigue abierto, resuelto pasa a cerrado", () => {
    expect(isClosed(rows[6])).toBe(false);
    expect(isClosed(rows[7])).toBe(true);
    expect(isClosed(rows[3])).toBe(true);
  });

  it("filtra por estatus y por equipo en conjunto", () => {
    const f = { ...EMPTY_FILTERS, statuses: ["in_progress", "waiting_parts"], equipos: ["phones" as const] };
    expect(applyFilters(rows, f).map((x) => x.id)).toEqual(["1"]);
  });

  it("las vistas citas, piezas, garantias y cerradas", () => {
    expect(inVista(rows[5], "citas")).toBe(true);
    expect(inVista(rows[2], "piezas")).toBe(true);
    expect(inVista(rows[4], "garantias")).toBe(true);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, vista: "cerradas" }).map((x) => x.id)).toEqual(["4", "8"]);
    expect(vistaCounts(rows)).toEqual({ citas: 1, piezas: 1, garantias: 1, cerradas: 2 });
  });

  it("los conteos del panel ignoran su propia seleccion", () => {
    const f = { ...EMPTY_FILTERS, statuses: ["in_progress"], equipos: ["phones" as const] };
    expect(statusCounts(rows, f)).toMatchObject({ in_progress: 1, scheduled: 1, warranty: 1 });
    expect(equipmentCounts(rows, f)).toMatchObject({ phones: 1, consoles: 1, computers: 0 });
  });

  it("la burbuja cuenta las opciones marcadas", () => {
    const f = { ...EMPTY_FILTERS, statuses: ["in_progress", "intake"], equipos: ["phones" as const] };
    expect(filterBubble(f, "statuses")).toBe(2);
    expect(filterBubble(f, "equipos")).toBe(1);
  });

  it("las pastillas se arman y se quitan una por una", () => {
    const f = { statuses: ["in_progress", "intake"], equipos: ["phones" as const], vista: "piezas" as const, query: "abc" };
    const chips = activeChips(f);
    expect(chips.map((c) => `${c.kind}:${c.key}`)).toEqual(["vista:piezas", "status:in_progress", "status:intake", "equipo:phones"]);
    expect(removeChip(f, chips[1]).statuses).toEqual(["intake"]);
    expect(removeChip(f, chips[0]).vista).toBeNull();
    expect(clearAll(f)).toEqual({ ...EMPTY_FILTERS, query: "abc" });
  });

  it("toggleIn y toggleVista alternan", () => {
    expect(toggleIn(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleIn(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleVista(EMPTY_FILTERS, "citas").vista).toBe("citas");
    expect(toggleVista({ ...EMPTY_FILTERS, vista: "citas" }, "citas").vista).toBeNull();
  });

  it("la busqueda ignora acentos y mayusculas y entiende telefonos", () => {
    const x = o("1", "intake", { customer_name: "María Rivera", customer_phone: "(787) 555-0142" });
    expect(matchesQuery(x, "maria")).toBe(true);
    expect(matchesQuery(x, "555 0142")).toBe(true);
    expect(matchesQuery(x, "carlos")).toBe(false);
    expect(matchesQuery(x, "wo-1")).toBe(true);
  });

  it("agrupa por estatus en el orden de los tokens con su conteo", () => {
    const g = groupByStatus(applyFilters(rows, EMPTY_FILTERS));
    expect(g.map((x) => `${x.status}:${x.orders.length}`)).toEqual(["waiting_parts:1", "in_progress:2", "scheduled:1", "warranty:1", "cancelled:1"]);
  });

  it("un estatus viejo desconocido va al final", () => {
    const g = groupByStatus([o("1", "completed"), o("2", "intake")]);
    expect(g.map((x) => x.status)).toEqual(["intake", "completed"]);
  });
});
