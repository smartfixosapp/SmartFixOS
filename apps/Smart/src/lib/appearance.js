export function preferredMode() {
  try { return localStorage.getItem("appearance.preferredMode") === "light" ? "light" : "dark"; } catch { return "dark"; }
}

export function applyAppearance(mode = preferredMode()) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("app-light", mode === "light");
}

export function clearAppearance() {
  if (typeof document === "undefined") return;
  document.documentElement.classList.remove("app-light");
}
