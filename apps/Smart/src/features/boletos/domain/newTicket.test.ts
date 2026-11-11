import { describe, expect, it } from "vitest";
import {
  buildOrderPayload, emptyDraft, newUuid, problemSummary, UPSERT_OPTIONS, WHATSAPP_DISCONNECTED,
} from "./newTicket";
import type { NewTicketDraft } from "./newTicket";

const ctx = { tenantId: "t1", orderNumber: "WO-500", customerName: "Maria Rivera", customerId: "c1", createdByName: "Web", photoUrls: [] as string[], now: "2026-11-11T12:00:00Z" };

function filled(): NewTicketDraft {
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

describe("payload del boleto guiado", () => {
  it("genera ids uuid v4 distintos", () => {
    const a = newUuid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(newUuid()).not.toBe(a);
  });

  it("el cuerpo conserva el id generado en el cliente para la idempotencia", () => {
    const d = filled();
    const a = buildOrderPayload(d, ctx);
    const b = buildOrderPayload(d, { ...ctx, now: "2026-11-11T12:05:00Z" });
    expect(a.id).toBe(d.id);
    expect(b.id).toBe(a.id);
    expect(a).toMatchObject({ tenant_id: "t1", order_number: "WO-500", status: "intake", customer_id: "c1", device_type: "Celular", device_brand: "Apple", device_model: "iPhone 13", is_quick_service: false });
    expect(a.initial_problem).toBe("Pantalla. El tactil no responde abajo");
  });

  it("el upsert ignora duplicados sobre el id", () => {
    expect(UPSERT_OPTIONS).toEqual({ onConflict: "id", ignoreDuplicates: true });
  });

  it("agrega estimado, prioridad, liquido, color y fotos solo cuando aplican", () => {
    const d = { ...filled(), quoteOn: true, estimate: "145,50", highPriority: true, color: "Azul", problems: ["liquid"] };
    const p = buildOrderPayload(d, { ...ctx, photoUrls: ["u1", "u2"] });
    expect(p).toMatchObject({ cost_estimate: 145.5, priority: "high", liquid_damage: true, device_color: "Azul", device_photos: ["u1", "u2"] });
    const plain = buildOrderPayload(filled(), { ...ctx, customerId: null });
    expect(plain).not.toHaveProperty("customer_id");
    expect(plain).not.toHaveProperty("cost_estimate");
    expect(plain).not.toHaveProperty("device_photos");
    expect(plain).not.toHaveProperty("status_note");
    expect(plain.priority).toBe("normal");
  });

  it("un estimado escrito pero con la cotizacion apagada no se guarda", () => {
    expect(buildOrderPayload({ ...filled(), quoteOn: false, estimate: "90" }, ctx)).not.toHaveProperty("cost_estimate");
  });

  it("modo rapido marca el boleto y la nota", () => {
    const p = buildOrderPayload({ ...filled(), mode: "quick" }, ctx);
    expect(p).toMatchObject({ is_quick_service: true, status_note: "[Quick]" });
  });

  it("tecnico, revision y firma viajan solo si su seccion esta activa", () => {
    const base = { ...filled(), technician: { id: "e1", name: "Jose L.", auto: false }, checklist: { screen: "damaged", power: "ok" } as const, signed: true };
    const off = buildOrderPayload(base, { ...ctx, signatureUrl: "https://x/firma.png" });
    expect(off).not.toHaveProperty("assigned_to");
    expect(off).not.toHaveProperty("device_security");
    expect(off).not.toHaveProperty("terms_accepted");
    const on = buildOrderPayload({ ...base, techOn: true, checklistOn: true, signatureOn: true }, { ...ctx, signatureUrl: "https://x/firma.png" });
    expect(on).toMatchObject({ assigned_to: "e1", assigned_to_name: "Jose L.", terms_accepted: true, device_security: { signature_url: "https://x/firma.png" }, status_note: "Dañados: Pantalla" });
  });

  it("recarga arma equipo, problema, nota y monto sin datos de equipo", () => {
    const d = { ...filled(), mode: "recharge" as const, recharge: { carrier: "Claro", carrierOther: "", sameNumber: true, phone: "", amount: "20" } };
    const p = buildOrderPayload(d, ctx);
    expect(p).toMatchObject({ device_type: "Recarga", device_brand: "Claro", device_model: "7875550142", cost_estimate: 20, is_quick_service: false });
    expect(p.initial_problem).toBe("Recarga de $20.00 al 7875550142 (Claro)");
    expect(String(p.status_note)).toContain("[Recarga]");
    expect(p).not.toHaveProperty("device_serial");
  });

  it("desbloqueo usa operadora, imei y monto", () => {
    const d = { ...filled(), mode: "unlock" as const, unlock: { type: "carrier_unlock" as const, brand: "Apple", model: "iPhone 12", carrier: "AT&T", imei: "356938035643809", amount: "50" } };
    const p = buildOrderPayload(d, ctx);
    expect(p).toMatchObject({ device_type: "Bloqueado: AT&T", device_brand: "Apple", device_model: "iPhone 12", device_serial: "356938035643809", cost_estimate: 50 });
    expect(p.initial_problem).toBe("Desbloqueo de operadora · Operadora: AT&T · IMEI: 356938035643809");
    expect(String(p.status_note)).toContain("[Desbloqueo]");
  });

  it("problemSummary junta etiquetas y texto", () => {
    expect(problemSummary({ ...filled(), problems: ["battery", "port"], problemText: "" })).toBe("Batería, Puerto de carga");
  });

  it("WhatsApp siempre llega sin conectar, apagado y sin datos de ejemplo", () => {
    expect(WHATSAPP_DISCONNECTED).toMatchObject({ connected: false, enabled: false, label: "Sin conectar" });
    expect(JSON.stringify(WHATSAPP_DISCONNECTED)).not.toMatch(/787|555|ejemplo/i);
  });
});
