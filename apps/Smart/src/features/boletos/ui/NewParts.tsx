import { useEffect, useRef } from "react";
import { Icon } from "./Icon";

interface OptionCardProps {
  icon: string;
  title: string;
  hint?: string;
  on: boolean;
  multi?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function OptionCard({ icon, title, hint, on, multi, disabled, onClick }: OptionCardProps) {
  return (
    <button type="button" className={`rb-oc${on ? " on" : ""}${multi ? " multi" : ""}${disabled ? " dis" : ""}`} onClick={onClick} aria-pressed={on} disabled={disabled}>
      <i><Icon name={icon} /></i>
      <b>{title}</b>
      {hint ? <small>{hint}</small> : null}
      <u><Icon name="check" /></u>
    </button>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  wide?: boolean;
  type?: string;
  placeholder?: string;
  inputMode?: "numeric" | "decimal" | "tel" | "email" | "text";
}

export function Field({ label, value, onChange, wide, type, placeholder, inputMode }: FieldProps) {
  return (
    <label className={wide ? "w2" : undefined}>
      <small>{label}</small>
      <input value={value} type={type ?? "text"} inputMode={inputMode} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function Chips({ items, value, onChange }: { items: { id: string; label: string; hint?: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="rb-tags">
      {items.map((it) => (
        <button key={it.id || "none"} type="button" className={`rb-op${value === it.id ? " on" : ""}`} aria-pressed={value === it.id} onClick={() => onChange(it.id)}>
          {it.label}
          {it.hint ? <small>{it.hint}</small> : null}
        </button>
      ))}
    </div>
  );
}

interface AmountProps {
  value: string;
  amounts: readonly number[];
  onChange: (v: string) => void;
  noneLabel?: string;
}

export function AmountChips({ value, amounts, onChange, noneLabel }: AmountProps) {
  const items = [
    ...(noneLabel ? [{ id: "", label: noneLabel }] : []),
    ...amounts.map((a) => ({ id: String(a), label: `$${a}` })),
  ];
  return (
    <>
      <Chips items={items} value={value} onChange={onChange} />
      <div className="rb-fld" style={{ ["--fc" as string]: 1, marginTop: 8 }}>
        <Field label="Otro monto" value={items.some((i) => i.id === value) ? "" : value} onChange={onChange} placeholder="0.00" inputMode="decimal" />
      </div>
    </>
  );
}

interface PadProps {
  signed: boolean;
  onChange: (blob: Blob | null) => void;
}

export function SignaturePad({ signed, onChange }: PadProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const rect = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(rect.width * ratio));
    c.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.5 * ratio;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current as HTMLCanvasElement;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = ref.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(last.current.x + 0.1, last.current.y + 0.1);
      ctx.stroke();
    }
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    ref.current?.toBlob((b) => onChange(b), "image/png");
  };

  const clear = () => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    onChange(null);
  };

  return (
    <div className="rb-sgn">
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Firma del cliente" />
      {!signed ? <span>El cliente firma aquí</span> : null}
      <button type="button" className="rb-btn sm" onClick={clear}>Borrar firma</button>
    </div>
  );
}
