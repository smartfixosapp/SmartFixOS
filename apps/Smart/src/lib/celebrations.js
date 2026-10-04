export const CELEBRATE_EVENT = "archilla:celebrate";

export function presentCelebration(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CELEBRATE_EVENT, { detail }));
}
