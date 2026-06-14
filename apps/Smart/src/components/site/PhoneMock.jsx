import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { GlowBlob, cx } from "./primitives";

export function PhoneMock({ src, alt = "", width = 280, glow = true, float = false, tilt = 0, className = "" }) {
  const reduce = useReducedMotion();
  const animate = float && !reduce ? { y: [0, -10, 0] } : undefined;
  return (
    <div className={cx("relative inline-block", className)} style={{ width }}>
      {glow && (
        <GlowBlob
          size={width * 1.5}
          opacity={0.4}
          pulse={float}
          className="left-1/2 top-1/2"
          style={{ transform: "translate(-50%,-50%)" }}
        />
      )}
      <motion.div
        animate={animate}
        transition={animate ? { duration: 6, repeat: Infinity, ease: "easeInOut" } : undefined}
        className="relative ar-shadow-device"
        style={{
          borderRadius: 48,
          background: "#0f0f0f",
          padding: 6,
          border: "1px solid rgba(255,255,255,0.06)",
          transform: tilt ? `rotate(${tilt}deg)` : undefined,
        }}
      >
        <div className="absolute left-1/2 top-[14px] z-10 h-[18px] w-[78px] -translate-x-1/2 rounded-full bg-black" />
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="block w-full object-cover object-top"
          style={{ borderRadius: 38, aspectRatio: "9 / 19.5" }}
        />
      </motion.div>
    </div>
  );
}
