import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";
import { MOTION, dur } from "@/lib/motion";

export default function CountUp({ value, format = (v) => String(Math.round(v)) }) {
  const target = Number(value) || 0;
  const [shown, setShown] = useState(target);
  const prev = useRef(target);

  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target || dur(1) === 0) { setShown(target); return undefined; }
    const controls = animate(from, target, { duration: MOTION.slow * 2, ease: MOTION.enter, onUpdate: setShown });
    return () => controls.stop();
  }, [target]);

  return <>{format(shown)}</>;
}
