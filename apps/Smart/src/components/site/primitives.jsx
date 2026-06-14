import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { EASE, DUR_FAST, VIEWPORT } from "./motion";
import "./tokens.css";

const cx = (...c) => c.filter(Boolean).join(" ");

export function Container({ narrow = false, className = "", children, ...rest }) {
  return (
    <div
      className={cx("mx-auto w-full px-5 sm:px-8 xl:px-10", className)}
      style={{ maxWidth: narrow ? "var(--ar-container-narrow)" : "var(--ar-container)" }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Section({ id, border = false, narrow = false, className = "", containerClassName = "", children }) {
  return (
    <section
      id={id}
      className={cx("relative scroll-mt-[72px]", border && "border-t border-ar-line", className)}
      style={{ paddingBlock: "clamp(72px, 12vw, 140px)" }}
    >
      <Container narrow={narrow} className={containerClassName}>
        {children}
      </Container>
    </section>
  );
}

export function Eyebrow({ children, align = "left", className = "" }) {
  return (
    <div
      className={cx(
        "inline-flex items-center gap-2.5 font-mono uppercase",
        align === "center" && "justify-center",
        className
      )}
      style={{ fontSize: 12, letterSpacing: "0.22em", color: "var(--ar-text-2)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ar-accent)", boxShadow: "0 0 8px var(--ar-accent)" }} />
      <span>{children}</span>
    </div>
  );
}

const HEADING_SIZE = {
  display: "text-[clamp(40px,9vw,92px)] font-extrabold tracking-[-0.04em] leading-[1.02]",
  h1: "text-[clamp(32px,5vw,60px)] font-extrabold tracking-[-0.04em] leading-[1.04]",
  h2: "text-[clamp(26px,3.4vw,40px)] font-bold tracking-[-0.035em] leading-[1.06]",
  h3: "text-[clamp(20px,2.2vw,26px)] font-bold tracking-[-0.03em] leading-[1.1]",
};

export function Heading({ as = "h2", size = "h2", className = "", children, ...rest }) {
  const Tag = motion[as] || motion.h2;
  return (
    <Tag
      className={cx("font-brico text-balance", HEADING_SIZE[size], className)}
      style={{ color: "var(--ar-text)" }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function Grad({ children }) {
  return <span className="ar-grad-text">{children}</span>;
}

export function Lede({ className = "", children, ...rest }) {
  return (
    <p
      className={cx("text-[clamp(17px,2vw,21px)] leading-[1.5]", className)}
      style={{ color: "var(--ar-text-2)" }}
      {...rest}
    >
      {children}
    </p>
  );
}

export function LogoLockup({ size = 28, mono = false, className = "" }) {
  return (
    <span className={cx("inline-flex items-center gap-2 select-none", className)} aria-label="Archilla OS">
      <img src="/images/logo.png" alt="" style={{ width: size, height: size, objectFit: "contain" }} />
      <span
        className="font-brico font-bold tracking-[-0.03em]"
        style={{ fontSize: size * 0.62, color: "var(--ar-text)" }}
      >
        Archilla <span style={{ color: "var(--ar-accent)" }}>{mono ? "OS" : "OS"}</span>
      </span>
    </span>
  );
}

export function GlowBlob({ size = 480, color = "var(--ar-glow)", blur = 80, opacity = 0.5, pulse = false, className = "", style = {} }) {
  return (
    <div
      aria-hidden
      className={cx("pointer-events-none absolute -z-10 rounded-full", pulse && "ar-anim-halo", className)}
      style={{
        width: size,
        height: size,
        background: color,
        filter: `blur(${blur}px)`,
        opacity,
        ...style,
      }}
    />
  );
}

function ButtonBase({ href, to, className = "", children, whileHover, whileTap = { scale: 0.97 }, ...rest }) {
  const common = {
    className: cx("ar-focus-ring inline-flex items-center justify-center gap-2.5 font-semibold", className),
    whileHover,
    whileTap,
    transition: { duration: DUR_FAST, ease: EASE },
    ...rest,
  };
  if (href) return <motion.a href={href} {...common}>{children}</motion.a>;
  if (to) { const ML = motion(Link); return <ML to={to} {...common}>{children}</ML>; }
  return <motion.button type="button" {...common}>{children}</motion.button>;
}

export function ButtonPrimary({ children, subLabel, icon = <ArrowRight className="h-4 w-4" strokeWidth={2.2} />, className = "", ...rest }) {
  return (
    <ButtonBase
      className={cx("ar-grad ar-shadow-btn h-14 rounded-2xl px-7 text-[15px] text-white", className)}
      whileHover={{ y: -3 }}
      {...rest}
    >
      {subLabel ? (
        <span className="flex flex-col items-start leading-tight">
          <span className="inline-flex items-center gap-2">{children}{icon}</span>
          <span className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-white/80">{subLabel}</span>
        </span>
      ) : (
        <>{children}{icon}</>
      )}
    </ButtonBase>
  );
}

export function ButtonSecondary({ children, icon, className = "", ...rest }) {
  return (
    <ButtonBase
      className={cx("h-14 rounded-2xl border px-6 text-[15px]", className)}
      style={{ borderColor: "var(--ar-border)", color: "var(--ar-text)" }}
      whileHover={{ y: -3, borderColor: "var(--ar-border-accent)" }}
      {...rest}
    >
      {children}{icon}
    </ButtonBase>
  );
}

export function ButtonGhost({ children, icon, className = "", ...rest }) {
  return (
    <ButtonBase
      className={cx("h-auto rounded-lg px-2 py-1 text-[14px]", className)}
      style={{ color: "var(--ar-text-2)" }}
      whileHover={{ color: "var(--ar-text)" }}
      whileTap={{ scale: 0.98 }}
      {...rest}
    >
      {children}{icon}
    </ButtonBase>
  );
}

export function Chip({ children, className = "", active = false }) {
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[12px]", className)}
      style={{
        borderColor: active ? "var(--ar-border-accent)" : "var(--ar-border)",
        color: active ? "var(--ar-text)" : "var(--ar-text-2)",
        background: active ? "rgba(255,87,34,0.10)" : "transparent",
      }}
    >
      {children}
    </span>
  );
}

export function TrustLine({ children, className = "" }) {
  return (
    <div
      className={cx("inline-flex items-center gap-2 font-mono uppercase", className)}
      style={{ fontSize: 12, letterSpacing: "0.18em", color: "var(--ar-text-3)" }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--ar-accent)", boxShadow: "0 0 8px var(--ar-accent)" }} />
      {children}
    </div>
  );
}

export function useCountUp(target, inView, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const end = parseFloat(target) || 0;
    const reduce = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setValue(end); return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(end * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, inView, duration]);
  return value;
}

export function useInViewOnce(margin = "-80px") {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }),
      { rootMargin: margin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, margin]);
  return [ref, seen];
}

export { cx, VIEWPORT };
