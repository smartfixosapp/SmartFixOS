export const EASE = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT = [0.65, 0, 0.35, 1];
export const DUR = 0.6;
export const DUR_FAST = 0.28;
export const STAGGER = 0.08;

export const VIEWPORT = { once: true, margin: "0px 0px -12% 0px" };

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: DUR, ease: EASE } },
};

export const fadeUpSm = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: DUR, ease: EASE } },
};

export const staggerList = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER, delayChildren: 0.05 } },
};

export const fadeUpAt = (delay = 0, y = 24) => ({
  initial: { opacity: 0, y },
  whileInView: { opacity: 1, y: 0 },
  viewport: VIEWPORT,
  transition: { duration: DUR, ease: EASE, delay },
});

export const scaleInAt = (delay = 0) => ({
  initial: { opacity: 0, scale: 0.92 },
  whileInView: { opacity: 1, scale: 1 },
  viewport: VIEWPORT,
  transition: { duration: DUR, ease: EASE, delay },
});
