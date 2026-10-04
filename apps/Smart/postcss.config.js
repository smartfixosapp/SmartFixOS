import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const HEIGHT_UNIT = /(-?\d*\.?\d+)(dvh|svh|lvh|vh)\b/g;
const WIDTH_UNIT = /(-?\d*\.?\d+)(dvw|svw|lvw|vw)\b/g;
const WIDTH_PROPS = /^(width|min-width|max-width)$/;
const HTML_ONLY = /^html(?![\w-])[^\s>+~]*$/;

const zoomSafeViewport = () => ({
  postcssPlugin: "zoom-safe-viewport",
  Declaration(decl) {
    if (decl.prop.startsWith("--") || decl.value.includes("--ui-zoom")) return;
    const rule = decl.parent;
    if (rule && rule.type === "rule" && rule.selectors.every((s) => HTML_ONLY.test(s.trim()))) return;
    let next = decl.value.replace(HEIGHT_UNIT, "calc($1$2 / var(--ui-zoom, 1))");
    if (WIDTH_PROPS.test(decl.prop)) next = next.replace(WIDTH_UNIT, "calc($1$2 / var(--ui-zoom, 1))");
    if (next !== decl.value) decl.value = next;
  },
});
zoomSafeViewport.postcss = true;

export default {
  plugins: [tailwindcss(), zoomSafeViewport(), autoprefixer()],
};
