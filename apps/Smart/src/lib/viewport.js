export function fitViewport(value) {
  if (typeof value !== "string") return value;
  return value.replace(/(-?\d*\.?\d+)(dvh|svh|lvh|vh)\b/g, "calc($1$2 / var(--ui-zoom, 1))");
}
