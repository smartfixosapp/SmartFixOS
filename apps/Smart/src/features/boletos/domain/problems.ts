import type { DeviceClass } from "./deviceClass";

export interface ProblemOption {
  id: string;
  label: string;
  icon: string;
  hint?: string;
  highlighted?: boolean;
}

export const BASE_PROBLEMS: readonly ProblemOption[] = [
  { id: "screen", label: "Pantalla", icon: "phone" },
  { id: "battery", label: "Batería", icon: "bat" },
  { id: "port", label: "Puerto de carga", icon: "plug" },
  { id: "power", label: "No prende", icon: "power" },
  { id: "liquid", label: "Líquido o agua", icon: "drop" },
  { id: "camera", label: "Cámara", icon: "cam" },
  { id: "audio", label: "Audio", icon: "spk" },
  { id: "software", label: "Software", icon: "code" },
];

export const OTHER_PROBLEM: ProblemOption = { id: "other", label: "Otro", icon: "pen" };

const CLASS_EXTRAS: Partial<Record<DeviceClass, readonly ProblemOption[]>> = {
  console: [
    { id: "hdmi", label: "Puerto HDMI", icon: "plug", hint: "Imagen o señal" },
    { id: "disc", label: "Lector de discos", icon: "devices" },
  ],
  laptop: [{ id: "keyboard", label: "Teclado", icon: "laptop", hint: "Teclas o trackpad" }],
  desktop: [{ id: "no_image", label: "Sin imagen", icon: "laptop" }],
  watch: [{ id: "strap", label: "Correa o botón", icon: "clock" }],
};

const IRRELEVANT: Partial<Record<DeviceClass, readonly string[]>> = {
  console: ["screen", "camera", "battery"],
  desktop: ["battery"],
  audio: ["screen", "camera"],
};

export function problemOptions(cls: DeviceClass, hints: readonly string[]): ProblemOption[] {
  const drop = IRRELEVANT[cls] ?? [];
  const extras = CLASS_EXTRAS[cls] ?? [];
  const candidates = [...extras, ...BASE_PROBLEMS].filter((o) => !drop.includes(o.id));
  const ranked = candidates.map((o, index) => {
    const rank = hints.includes(o.id) ? 0 : extras.includes(o) ? 1 : 2;
    return { o, rank, index };
  });
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return [
    ...ranked.map(({ o, rank }) => ({ ...o, highlighted: rank < 2, hint: rank === 0 ? "Visto en la foto" : o.hint })),
    OTHER_PROBLEM,
  ];
}

const fold = (v: string): string =>
  String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

const HINT_WORDS: readonly (readonly [string, readonly string[]])[] = [
  ["screen", ["pantalla", "screen", "display", "cristal", "glass", "crack", "rota", "quebrad"]],
  ["liquid", ["liquid", "liquido", "agua", "water", "corros", "humed"]],
  ["port", ["puerto", "port", "charging", "carga"]],
  ["battery", ["bater", "battery", "swollen", "hinchad"]],
  ["camera", ["camara", "camera", "lens", "lente"]],
];

export function hintsFromAnalysis(category: string, diagnosis: string): string[] {
  const text = fold(`${category} ${diagnosis}`);
  return HINT_WORDS.filter(([, words]) => words.some((w) => text.includes(w))).map(([id]) => id);
}
