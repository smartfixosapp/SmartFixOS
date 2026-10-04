export function fitViewport(value) {
  if (typeof value !== "string") return value;
  return value.replace(/(-?\d*\.?\d+)(dvh|svh|lvh|vh)\b/g, "calc($1$2 / var(--ui-zoom, 1))");
}

export function uiZoom() {
  if (typeof document === "undefined") return 1;
  const z = parseFloat(window.getComputedStyle(document.body).zoom);
  return z > 0 ? z : 1;
}

export function anchorInView(x, y, width, height, margin = 8) {
  const z = uiZoom();
  const maxLeft = window.innerWidth / z - width - margin;
  const maxTop = window.innerHeight / z - height - margin;
  return { left: Math.max(margin, Math.min(x / z, maxLeft)), top: Math.max(margin, Math.min(y / z, maxTop)) };
}
