import type { DeviceClass } from "./deviceClass";

export type CheckStatus = "untested" | "ok" | "damaged";
export type CheckMap = Record<string, "ok" | "damaged">;

export interface CheckItem {
  id: string;
  label: string;
}

const ALL: readonly CheckItem[] = [
  { id: "power", label: "Encendido" },
  { id: "screen", label: "Pantalla" },
  { id: "touch", label: "Touch" },
  { id: "speakers", label: "Bocinas" },
  { id: "microphone", label: "Micrófono" },
  { id: "camera_front", label: "Cámara frontal" },
  { id: "camera_back", label: "Cámara trasera" },
  { id: "buttons", label: "Botones" },
  { id: "wifi", label: "WiFi" },
  { id: "bluetooth", label: "Bluetooth" },
  { id: "charging", label: "Carga" },
  { id: "battery", label: "Batería" },
  { id: "ports", label: "Puertos" },
];

const SKIP: Partial<Record<DeviceClass, readonly string[]>> = {
  console: ["screen", "touch", "microphone", "camera_front", "camera_back", "battery"],
  desktop: ["touch", "camera_back", "battery", "charging"],
  laptop: ["camera_back"],
  watch: ["camera_front", "camera_back", "ports"],
  audio: ["screen", "touch", "camera_front", "camera_back"],
};

export function checklistItems(cls: DeviceClass): CheckItem[] {
  const drop = SKIP[cls] ?? [];
  return ALL.filter((i) => !drop.includes(i.id));
}

export const statusOf = (map: CheckMap, id: string): CheckStatus => map[id] ?? "untested";

export function cycleCheck(map: CheckMap, id: string): CheckMap {
  const cur = statusOf(map, id);
  const next: CheckMap = { ...map };
  if (cur === "untested") next[id] = "ok";
  else if (cur === "ok") next[id] = "damaged";
  else Reflect.deleteProperty(next, id);
  return next;
}

export function markAllOk(items: CheckItem[], map: CheckMap): CheckMap {
  const next: CheckMap = { ...map };
  for (const i of items) if (!next[i.id]) next[i.id] = "ok";
  return next;
}

export function checkCounts(items: CheckItem[], map: CheckMap): { ok: number; damaged: number; untested: number } {
  const ok = items.filter((i) => map[i.id] === "ok").length;
  const damaged = items.filter((i) => map[i.id] === "damaged").length;
  return { ok, damaged, untested: items.length - ok - damaged };
}

export function damagedLabels(items: CheckItem[], map: CheckMap): string[] {
  return items.filter((i) => map[i.id] === "damaged").map((i) => i.label);
}

export function checklistNote(items: CheckItem[], map: CheckMap): string | null {
  const damaged = damagedLabels(items, map);
  const ok = items.filter((i) => map[i.id] === "ok").map((i) => i.label);
  if (!damaged.length && !ok.length) return null;
  let text = "Revisión al recibir el equipo.";
  if (damaged.length) text += ` Dañado: ${damaged.join(", ")}.`;
  if (ok.length) text += ` Funciona: ${ok.join(", ")}.`;
  return text;
}

export function checklistSummary(items: CheckItem[], map: CheckMap): string | null {
  const { ok, damaged } = checkCounts(items, map);
  if (!ok && !damaged) return null;
  return `${damaged} ${damaged === 1 ? "dañado" : "dañados"}, ${ok} ${ok === 1 ? "funciona" : "funcionan"}`;
}
