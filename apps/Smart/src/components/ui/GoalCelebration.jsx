import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import { money } from "@/components/finanzas/ui";

const GOLD = "#FFD60A";
const CIRC = 2 * Math.PI * 48;

export default function GoalCelebration({ goal, revenue, onDone }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => doneRef.current?.(), 2600);
    return () => clearTimeout(t);
  }, []);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="apple-type fixed inset-0 flex flex-col items-center justify-center text-center pointer-events-none"
      style={{ zIndex: 520, background: "linear-gradient(180deg, rgba(0,0,0,0.96), #1A1A1F)", color: "#fff", fontVariantNumeric: "tabular-nums" }}
    >
      <style>{`
        @keyframes goal-ring{from{stroke-dashoffset:${CIRC}}to{stroke-dashoffset:0}}
        @keyframes goal-star{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes goal-fade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @media (prefers-reduced-motion: reduce){.goal-anim{animation:none!important;stroke-dashoffset:0!important;opacity:1!important;transform:none!important}}
      `}</style>
      <div style={{ position: "relative", width: 104, height: 104 }}>
        <svg width="104" height="104" viewBox="0 0 104 104" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="52" cy="52" r="48" fill="none" stroke={GOLD} strokeOpacity="0.25" strokeWidth="4" />
          <circle className="goal-anim" cx="52" cy="52" r="48" fill="none" stroke={GOLD} strokeWidth="4" strokeLinecap="round" strokeDasharray={CIRC} style={{ animation: "goal-ring 0.9s ease-out forwards" }} />
        </svg>
        <span className="goal-anim" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", animation: "goal-star 0.5s 0.15s ease-out both" }}>
          <Star style={{ width: 44, height: 44, color: GOLD, fill: GOLD }} />
        </span>
      </div>
      <p className="goal-anim" style={{ fontSize: 22, fontWeight: 700, marginTop: 22, animation: "goal-fade 0.4s 0.5s ease-out both" }}>Meta del día alcanzada</p>
      <p className="goal-anim" style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginTop: 6, animation: "goal-fade 0.4s 0.6s ease-out both" }}>Meta {money(goal)}</p>
      <p className="goal-anim" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 4, animation: "goal-fade 0.4s 0.7s ease-out both" }}>Llevas {money(revenue)} hoy</p>
    </div>,
    document.body,
  );
}
