import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CLOSED_KEYS, REOPEN_TO, STATUSES, isStatusKey, statusColorVar, statusLabel } from "./statuses";

const tokens = JSON.parse(readFileSync(resolve(process.cwd(), "../../packages/repara-tokens/tokens.json"), "utf8"));

describe("estatus contra repara-tokens", () => {
  it("tiene los 16 estatus en el mismo orden y con las mismas claves", () => {
    expect(STATUSES.map((s) => s.key)).toEqual(tokens.status.map((s: { key: string }) => s.key));
    expect(STATUSES).toHaveLength(16);
  });

  it("copia etiqueta corta, larga, grupo, destinos y reabrir", () => {
    for (const t of tokens.status) {
      const s = STATUSES.find((x) => x.key === t.key)!;
      expect(s.label).toBe(t.es);
      expect(s.long).toBe(t.esLong);
      expect(s.group).toBe(t.group);
      expect(s.to).toEqual(t.to);
      expect(s.reopen).toBe(t.reopen === true);
    }
    expect(REOPEN_TO).toEqual(tokens.transitions.reopenTo);
  });

  it("los cuatro cerrados son entregado, cancelado, no reparable y abandonado", () => {
    expect([...CLOSED_KEYS].sort()).toEqual(["abandoned", "cancelled", "delivered", "not_repairable"]);
  });

  it("no existe la clave completed", () => {
    expect(isStatusKey("completed")).toBe(false);
    expect(statusLabel("completed")).toBe("completed");
  });

  it("usa la variable CSS del token por estatus", () => {
    expect(statusColorVar("waiting_parts")).toBe("var(--repara-status-waiting-parts)");
    expect(statusColorVar("xyz")).toBe("var(--repara-text3)");
  });
});
