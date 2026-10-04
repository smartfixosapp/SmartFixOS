const reduced = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const MOTION = {
  fast: 0.16,
  base: 0.22,
  slow: 0.32,
  ease: [0.2, 0, 0, 1],
  enter: [0.05, 0.7, 0.1, 1],
  exit: [0.3, 0, 0.8, 0.15],
};

export const dur = (s) => (reduced() ? 0 : s);

export const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1, pointerEvents: "auto" },
  exit: { opacity: 0, pointerEvents: "none" },
  transition: { duration: dur(MOTION.base) },
};

export const panelMotion = {
  initial: { opacity: 0, y: 28, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 18, scale: 0.99 },
  transition: { duration: dur(MOTION.base), ease: MOTION.enter },
};
