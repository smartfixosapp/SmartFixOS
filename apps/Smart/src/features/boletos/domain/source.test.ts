import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd(), "src/features/boletos");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

describe("reglas del modulo", () => {
  const sources = files(root).map((p) => ({ p, s: readFileSync(p, "utf8") }));

  it("nunca escribe el estatus directo ni usa la clave completed", () => {
    for (const { p, s } of sources) {
      expect(s, p).not.toMatch(/\.from\(["']order["']\)\s*\.update/);
      expect(s, p).not.toMatch(/["']completed["']/);
      expect(s, p).not.toMatch(/import[^;]*\bpatchOrder\b[^;]*orderDetailApi/);
    }
  });

  it("el cambio de estatus usa el RPC existente", () => {
    const api = sources.find((x) => x.p.endsWith("data/api.ts"))!.s;
    expect(api).toContain("changeStatusRpc");
  });

  it("no contiene comentarios de linea ni emojis", () => {
    for (const { p, s } of sources) {
      expect(s.split("\n").filter((l) => /^\s*\/\//.test(l)), p).toEqual([]);
      expect(s, p).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
