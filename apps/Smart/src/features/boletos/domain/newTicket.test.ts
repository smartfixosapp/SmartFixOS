import { describe, expect, it } from "vitest";
import {
  allStepsValid, buildOrderPayload, canAdvance, emptyDraft, newUuid, problemSummary, stepErrors, UPSERT_OPTIONS,
  WHATSAPP_DISCONNECTED,
} from "./newTicket";

const ctx = { tenantId: "t1", orderNumber: "WO-500", customerName: "Maria Rivera", customerId: "c1", createdByName: "Web", photoUrls: [] as string[], now: "2026-11-11T12:00:00Z" };

function filled() {
  const d = emptyDraft("11111111-1111-4111-8111-111111111111");
  d.firstName = "Maria";
  d.lastName = "Rivera";
  d.phone = "787-555-0142";
  d.brand = "Apple";
  d.model = "iPhone 13";
  d.problems = ["screen", "other"];
  d.problemText = "El tactil no responde abajo";
  return d;
}

describe("nuevo boleto guiado", () => {
  it("genera ids uuid v4 distintos", () => {
    const a = newUuid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newUuid()).not.toBe(a);
  });

  it("valida cada paso", () => {
    const d = emptyDraft();
    expect(canAdvance(0, d)).toBe(false);
    expect(canAdvance(1, d)).toBe(false);
    expect(canAdvance(2, d)).toBe(false);
    expect(canAdvance(3, d)).toBe(true);
    expect(canAdvance(4, d)).toBe(true);
    expect(allStepsValid(d)).toBe(false);
    expect(allStepsValid(filled())).toBe(true);
    expect(stepErrors(0, { ...filled(), email: "mal" })).toContain("El correo no es válido.");
    expect(stepErrors(2, { ...filled(), problems: ["other"], problemText: "" })).toContain("Describe el problema en Otro.");
    expect(stepErrors(4, { ...filled(), estimate: "abc" })).toHaveLength(1);
  });

  it("el cuerpo conserva el id generado en el cliente para la idempotencia", () => {
    const d = filled();
    const a = buildOrderPayload(d, ctx);
    const b = buildOrderPayload(d, { ...ctx, now: "2026-11-11T12:05:00Z" });
    expect(a.id).toBe(d.id);
    expect(b.id).toBe(a.id);
    expect(a).toMatchObject({ tenant_id: "t1", order_number: "WO-500", status: "intake", customer_id: "c1", device_type: "Celular", device_brand: "Apple", device_model: "iPhone 13" });
    expect(a.initial_problem).toBe("Pantalla. El tactil no responde abajo");
  });

  it("el upsert ignora duplicados sobre el id", () => {
    expect(UPSERT_OPTIONS).toEqual({ onConflict: "id", ignoreDuplicates: true });
  });

  it("agrega estimado, prioridad, liquido, rapido y fotos solo cuando aplican", () => {
    const d = { ...filled(), estimate: "145,50", highPriority: true, quick: true, problems: ["liquid"] };
    const p = buildOrderPayload(d, { ...ctx, photoUrls: ["u1", "u2"] });
    expect(p).toMatchObject({ cost_estimate: 145.5, priority: "high", is_quick_service: true, status_note: "[Quick]", liquid_damage: true, device_photos: ["u1", "u2"] });
    const plain = buildOrderPayload(filled(), { ...ctx, customerId: null });
    expect(plain).not.toHaveProperty("customer_id");
    expect(plain).not.toHaveProperty("cost_estimate");
    expect(plain).not.toHaveProperty("device_photos");
    expect(plain.priority).toBe("normal");
  });

  it("problemSummary junta etiquetas y texto", () => {
    expect(problemSummary({ ...filled(), problems: ["battery", "port"], problemText: "" })).toBe("Batería, Puerto de carga");
  });

  it("WhatsApp siempre llega sin conectar, apagado y sin datos de ejemplo", () => {
    expect(WHATSAPP_DISCONNECTED).toMatchObject({ connected: false, enabled: false, label: "Sin conectar" });
    expect(JSON.stringify(WHATSAPP_DISCONNECTED)).not.toMatch(/787|555|ejemplo/i);
  });
});
