export type DeviceClass = "phone" | "tablet" | "laptop" | "desktop" | "watch" | "console" | "audio" | "other";

const fold = (v: string): string =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const CONSOLE_BRANDS = ["playstation", "ps4", "ps5", "xbox", "nintendo", "switch", "steam deck"];
const DESKTOP_WORDS = ["imac", "desktop", "escritorio", "torre", "all-in-one", "mac mini", "mac studio"];

const has = (text: string, words: string[]): boolean => words.some((w) => text.includes(w));

export function classifyDevice(type: string, brand = "", model = ""): DeviceClass {
  const t = fold(type);
  const whole = fold(`${brand} ${model}`);
  if (has(t, ["consola", "console", "game"])) return "console";
  if (has(whole, CONSOLE_BRANDS) && !has(t, ["celular", "phone", "tablet", "tableta"])) return "console";
  if (has(t, ["tablet", "tableta", "ipad"])) return "tablet";
  if (has(t, ["watch", "reloj"]) || whole.includes("apple watch")) return "watch";
  if (has(t, ["audifono", "headphone", "bocina", "speaker", "airpod"])) return "audio";
  if (has(t, ["compu", "laptop", "computer", "desktop", "escritorio"])) {
    return has(whole, DESKTOP_WORDS) || has(t, ["desktop", "escritorio"]) ? "desktop" : "laptop";
  }
  if (has(t, ["celular", "phone", "smartphone", "movil"])) return "phone";
  if (has(whole, ["iphone", "galaxy s", "pixel"])) return "phone";
  return "other";
}
