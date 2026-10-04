export const DEVICE_BUCKETS = [
  { id: "phones", label: "Celulares" },
  { id: "computers", label: "Computadoras" },
  { id: "tablets", label: "Tabletas" },
  { id: "consoles", label: "Consolas" },
  { id: "unlocks", label: "Desbloqueos" },
  { id: "other", label: "Otros" },
];

const fold = (v) => String(v || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const has = (s, words) => words.some((w) => s.includes(w));

export function deviceBucket(order) {
  const note = fold(order?.status_note);
  const type = fold(order?.device_type);
  if (note.includes("[desbloqueo]") || type === "software" || type === "desbloqueo" || type.startsWith("bloqueado:")) return "unlocks";
  if (note.includes("[recarga]")) return "other";
  const text = `${type} ${fold(order?.device_brand)} ${fold(order?.device_family)} ${fold(order?.device_model)}`;
  if (has(type, ["audifono", "headphone", "watch", "reloj", "impresora", "printer", "accesorio"])) return "other";
  if (has(text, ["consola", "console", "playstation", "ps5", "ps4", "xbox", "nintendo", "switch"])) return "consoles";
  if (has(text, ["tablet", "tableta", "ipad"])) return "tablets";
  if (has(text, ["laptop", "computadora", "computer", "desktop", "torre", "all in one", "imac", "macbook", "notebook", "chromebook", "surface", "pc"])) return "computers";
  if (has(text, ["celular", "phone", "iphone", "telefono", "smartphone", "movil", "galaxy", "pixel"])) return "phones";
  return "other";
}
