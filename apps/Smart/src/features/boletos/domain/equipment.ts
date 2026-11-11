import type { EquipmentId, OrderRow } from "./types";

export const EQUIPMENT: readonly { id: EquipmentId; label: string; icon: string }[] = [
  { id: "phones", label: "Celulares", icon: "phone" },
  { id: "tablets", label: "Tabletas", icon: "tablet" },
  { id: "computers", label: "Computadoras", icon: "laptop" },
  { id: "consoles", label: "Consolas", icon: "game" },
  { id: "unlocks", label: "Desbloqueos", icon: "unlock" },
  { id: "other", label: "Otros", icon: "devices" },
];

const fold = (v: unknown): string =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const has = (s: string, words: string[]): boolean => words.some((w) => s.includes(w));

export function equipmentOf(order: Pick<OrderRow, "status_note" | "device_type" | "device_brand" | "device_family" | "device_model">): EquipmentId {
  const note = fold(order.status_note);
  const type = fold(order.device_type);
  if (note.includes("[desbloqueo]") || type === "software" || type === "desbloqueo" || type.startsWith("bloqueado:")) return "unlocks";
  if (note.includes("[recarga]")) return "other";
  const text = `${type} ${fold(order.device_brand)} ${fold(order.device_family)} ${fold(order.device_model)}`;
  if (has(type, ["audifono", "headphone", "watch", "reloj", "impresora", "printer", "accesorio"])) return "other";
  if (has(text, ["consola", "console", "playstation", "ps5", "ps4", "xbox", "nintendo", "switch"])) return "consoles";
  if (has(text, ["tablet", "tableta", "ipad"])) return "tablets";
  if (has(text, ["laptop", "computadora", "computer", "desktop", "torre", "all in one", "imac", "macbook", "notebook", "chromebook", "surface", "pc"])) return "computers";
  if (has(text, ["celular", "phone", "iphone", "telefono", "smartphone", "movil", "galaxy", "pixel"])) return "phones";
  return "other";
}

export function equipmentMeta(id: EquipmentId): { id: EquipmentId; label: string; icon: string } {
  return EQUIPMENT.find((e) => e.id === id) ?? EQUIPMENT[EQUIPMENT.length - 1];
}
