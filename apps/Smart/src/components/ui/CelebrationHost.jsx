import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Wallet } from "lucide-react";
import { CELEBRATE_EVENT } from "@/lib/celebrations";

const STYLE = {
  money: { color: "#30D158", Icon: BadgeCheck },
  success: { color: "#30D158", Icon: BadgeCheck },
  deposit: { color: "#FF9F0A", Icon: Wallet },
};

export default function CelebrationHost() {
  const [current, setCurrent] = useState(null);
  const queue = useRef([]);
  const timer = useRef(null);
  const showing = useRef(false);

  useEffect(() => {
    const next = () => {
      const item = queue.current.shift() || null;
      showing.current = !!item;
      setCurrent(item);
      clearTimeout(timer.current);
      if (item) timer.current = setTimeout(next, item.hold || 1600);
    };
    const onEvent = (e) => {
      queue.current.push(e.detail || {});
      if (!showing.current) next();
    };
    window.addEventListener(CELEBRATE_EVENT, onEvent);
    return () => { window.removeEventListener(CELEBRATE_EVENT, onEvent); clearTimeout(timer.current); };
  }, []);

  if (!current || typeof document === "undefined") return null;
  const { color, Icon } = STYLE[current.style] || STYLE.success;
  return createPortal(
    <div id="archilla-celebration" role="status" aria-live="polite" className="apple-type fixed inset-0 flex flex-col items-center justify-center text-center pointer-events-none" style={{ zIndex: 520, background: "rgba(0,0,0,0.85)", color: "#fff", gap: 10 }}>
      <Icon className="w-20 h-20" style={{ color }} />
      <p style={{ fontSize: 26, fontWeight: 800 }}>{current.title}</p>
      {current.subtitle && <p style={{ fontSize: 17, color: "rgba(255,255,255,0.8)" }}>{current.subtitle}</p>}
      {current.detail && <p style={{ fontSize: 15, color: "#8E8E93" }}>{current.detail}</p>}
    </div>,
    document.body,
  );
}
