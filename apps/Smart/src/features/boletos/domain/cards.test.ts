import { describe, expect, it } from "vitest";
import { dueAmount, isLate, moneyView, money, partLines, partsProfit, shortAge, summarize, toCard } from "./cards";
import type { OrderRow } from "./types";

const base: OrderRow = {
  id: "1", order_number: "WO-417", status: "in_progress", customer_name: "Maria Rivera", device_model: "iPhone 13", device_type: "Celular",
  initial_problem: "Pantalla rota", assigned_to_name: "Jose Luis", cost_estimate: 161.68, amount_paid: 50, tax_rate: 0.115,
  order_items: [
    { id: "a", type: "part", name: "Pantalla OLED", quantity: 1, price: 120, total: 120, cost: 62, supplier_name: "Suplidor PR" },
    { id: "b", type: "service", name: "Mano de obra", quantity: 1, price: 20, total: 20 },
  ],
  labor_cost: 5,
};

describe("tarjetas y dinero", () => {
  it("arma la tarjeta con etiqueta corta, saldo y tecnico", () => {
    const c = toCard(base, Date.parse("2026-11-11T12:00:00Z"));
    expect(c).toMatchObject({ number: "WO-417", title: "iPhone 13", customer: "Maria Rivera", statusLabel: "En reparación", tech: "JL", amount: "$111.68", icon: "phone" });
  });

  it("marca atrasado solo si hay promesa vencida y el boleto sigue abierto", () => {
    const now = Date.parse("2026-11-11T12:00:00Z");
    expect(isLate({ ...base, promised_date: "2026-11-10T10:00:00Z" }, now)).toBe(true);
    expect(isLate({ ...base, promised_date: "2026-11-12T10:00:00Z" }, now)).toBe(false);
    expect(isLate({ ...base, status: "delivered", promised_date: "2026-11-01T10:00:00Z" }, now)).toBe(false);
  });

  it("calcula saldo, resumen y edad corta", () => {
    expect(dueAmount(base)).toBe(111.68);
    expect(dueAmount({ ...base, balance_due: 0 })).toBe(0);
    expect(summarize([base, { ...base, id: "2" }])).toMatchObject({ active: 2, toCollect: 223.36 });
    const now = Date.parse("2026-11-11T12:00:00Z");
    expect(shortAge("2026-11-11T11:55:00Z", now)).toBe("5 min");
    expect(shortAge("2026-11-11T09:00:00Z", now)).toBe("3 h");
    expect(shortAge("2026-11-09T12:00:00Z", now)).toBe("2 d");
    expect(money("12.5")).toBe("$12.50");
  });

  it("moneyView usa el estimado guardado y descuenta lo pagado", () => {
    expect(moneyView(base)).toMatchObject({ total: 161.68, paid: 50, balance: 111.68 });
  });

  it("costo y suplidor de las piezas solo se ven con permiso", () => {
    const hidden = partLines(base, false);
    expect(hidden.every((l) => l.cost === null && l.supplier === "")).toBe(true);
    expect(partsProfit(hidden, 140)).toBeNull();
    const shown = partLines(base, true);
    expect(shown[0]).toMatchObject({ cost: 62, supplier: "Suplidor PR" });
    expect(partsProfit(shown, 140)).toEqual({ cost: 62, gain: 78 });
  });
});
