import { ChevronRight, PlusCircle } from "lucide-react";
import { tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";

export const money = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(v) || 0);

export const cardStyle = { background: "#1C1C1E", borderRadius: 16 };

export function Card({ children, style, className = "" }) {
  return <div className={className} style={{ ...cardStyle, ...style }}>{children}</div>;
}

export function Empty({ children }) {
  return <p className="text-center" style={{ fontSize: 13, color: "#8E8E93", padding: "12px 0" }}>{children}</p>;
}

export function KPITile({ label, value, Icon, color, accented, trend }) {
  return (
    <div className="flex flex-col" style={{ gap: 4, padding: 12, borderRadius: 12, background: accented ? FP.warning : "#1C1C1E" }}>
      <div className="flex items-center gap-1">
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: accented ? "#fff" : color }} />}
        <span className="truncate" style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.03em", color: accented ? "rgba(255,255,255,0.85)" : "#8E8E93" }}>{String(label).toUpperCase()}</span>
      </div>
      <span className="truncate" style={{ fontSize: 16, fontWeight: 700, color: accented ? "#fff" : color, fontVariantNumeric: "tabular-nums" }}>{money(value)}</span>
      {trend}
    </div>
  );
}

export function ActionCard({ Icon, title, subtitle, color, onClick }) {
  return (
    <button onClick={onClick} className="apple-press w-full flex items-center gap-3 text-left" style={{ ...cardStyle, padding: 12 }}>
      <span style={{ width: 44, height: 44, borderRadius: 12, background: tint(color, 0.12), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon className="w-6 h-6" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span className="block" style={{ fontSize: 12, color: "#8E8E93" }}>{subtitle}</span>
      </span>
      <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
    </button>
  );
}

export function BigActionRow({ label, color, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} className="w-full flex items-center gap-2 text-left disabled:opacity-40" style={{ padding: 12, color, fontSize: 16, fontWeight: 600 }}>
      <PlusCircle className="w-5 h-5" /> {label}
    </button>
  );
}

export function Segmented({ options, value, onChange, style }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)`, padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)", ...style }}>
      {options.map(([k, l]) => (
        <button key={String(k)} onClick={() => onChange(k)} style={{ padding: "6px 8px", borderRadius: 7, fontSize: 13, fontWeight: 600, background: value === k ? "#636366" : "transparent", color: "#fff" }}>{l}</button>
      ))}
    </div>
  );
}

export function CircleIcon({ Icon, onClick, label }) {
  return (
    <button onClick={onClick} aria-label={label} className="apple-press" style={{ width: 36, height: 36, borderRadius: 999, background: tint(FP.brand, 0.12), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <Icon className="w-4 h-4" strokeWidth={2.5} />
    </button>
  );
}

function niceMax(v) {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * exp;
}

function shortMoney(v) {
  const a = Math.abs(v);
  const s = v < 0 ? "-" : "";
  if (a >= 1000000) return `${s}$${(a / 1000000).toFixed(a >= 10000000 ? 0 : 1)}M`;
  if (a >= 1000) return `${s}$${(a / 1000).toFixed(a >= 10000 ? 0 : 1)}k`;
  return `${s}$${Math.round(a)}`;
}

export function GroupedBarChart({ data, height = 220 }) {
  const W = 600;
  const H = height;
  const padL = 46;
  const padB = 24;
  const padT = 10;
  const max = niceMax(Math.max(1, ...data.flatMap((d) => [d.ingresos, d.gastos])));
  const plotW = W - padL - 8;
  const plotH = H - padB - padT;
  const group = plotW / Math.max(1, data.length);
  const bw = Math.min(28, group * 0.32);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max);
  const y = (v) => padT + plotH - (v / max) * plotH;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Ingresos vs gastos">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.08)" />
            <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#8E8E93">{shortMoney(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + group * i + group / 2;
          return (
            <g key={d.label + i}>
              <rect x={cx - bw - 1} y={y(d.ingresos)} width={bw} height={Math.max(0, padT + plotH - y(d.ingresos))} rx="3" fill={FP.success}><title>{`Ingresos ${money(d.ingresos)}`}</title></rect>
              <rect x={cx + 1} y={y(d.gastos)} width={bw} height={Math.max(0, padT + plotH - y(d.gastos))} rx="3" fill={FP.danger}><title>{`Gastos ${money(d.gastos)}`}</title></rect>
              <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#8E8E93">{d.label}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center gap-4" style={{ fontSize: 12, color: "#8E8E93", marginTop: 4 }}>
        <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 999, background: FP.success }} /> Ingresos</span>
        <span className="flex items-center gap-1.5"><span style={{ width: 8, height: 8, borderRadius: 999, background: FP.danger }} /> Gastos</span>
      </div>
    </div>
  );
}

export function NetBarChart({ months, height = 200 }) {
  const W = 600;
  const H = height;
  const padL = 46;
  const padB = 24;
  const padT = 10;
  const maxAbs = niceMax(Math.max(1, ...months.map((m) => Math.abs(m.neto))));
  const hasNeg = months.some((m) => m.neto < 0);
  const min = hasNeg ? -maxAbs : 0;
  const plotW = W - padL - 8;
  const plotH = H - padB - padT;
  const y = (v) => padT + plotH - ((v - min) / (maxAbs - min)) * plotH;
  const group = plotW / Math.max(1, months.length);
  const bw = Math.min(40, group * 0.55);
  const ticks = hasNeg ? [-maxAbs, -maxAbs / 2, 0, maxAbs / 2, maxAbs] : [0, maxAbs / 4, maxAbs / 2, (3 * maxAbs) / 4, maxAbs];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Neto por mes">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} stroke={t === 0 ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)"} />
          <text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#8E8E93">{shortMoney(t)}</text>
        </g>
      ))}
      {months.map((m, i) => {
        const cx = padL + group * i + group / 2;
        const top = Math.min(y(m.neto), y(0));
        const h = Math.abs(y(m.neto) - y(0));
        return (
          <g key={m.key}>
            <rect x={cx - bw / 2} y={top} width={bw} height={Math.max(0, h)} rx="4" fill={m.neto >= 0 ? FP.entra : FP.sale} opacity={m.isCurrent ? 1 : 0.65}><title>{`${m.label} ${money(m.neto)}`}</title></rect>
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="#8E8E93">{m.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

const DONUT_COLORS = [FP.brand, FP.info, FP.success, FP.warning, FP.vip];

export function Donut({ data, total }) {
  const R = 52;
  const r = 32;
  const C = 60;
  let acc = 0;
  const sum = data.reduce((s, d) => s + d.amount, 0) || 1;
  const arcs = data.map((d, i) => {
    const start = (acc / sum) * Math.PI * 2;
    acc += d.amount;
    const end = (acc / sum) * Math.PI * 2;
    const gap = data.length > 1 ? 0.025 : 0;
    const a0 = start + gap - Math.PI / 2;
    const a1 = Math.max(a0, end - gap - Math.PI / 2);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad, ang) => [C + rad * Math.cos(ang), C + rad * Math.sin(ang)];
    if (data.length === 1) return <circle key={i} cx={C} cy={C} r={(R + r) / 2} fill="none" stroke={DONUT_COLORS[0]} strokeWidth={R - r} />;
    const [x0, y0] = p(R, a0);
    const [x1, y1] = p(R, a1);
    const [x2, y2] = p(r, a1);
    const [x3, y3] = p(r, a0);
    return <path key={i} d={`M${x0},${y0} A${R},${R} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r},${r} 0 ${large} 0 ${x3},${y3} Z`} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />;
  });
  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: 120, height: 120, flexShrink: 0 }}>
        <svg viewBox="0 0 120 120" width="120" height="120">{arcs}</svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ padding: 8 }}>
          <span className="truncate" style={{ maxWidth: 70, fontSize: 13, fontWeight: 700 }}>{money(total)}</span>
          <span style={{ fontSize: 9, fontWeight: 600, color: "#8E8E93" }}>Total</span>
        </div>
      </div>
      <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-1.5" style={{ fontSize: 12 }}>
            <span style={{ width: 9, height: 9, borderRadius: 999, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
            <span className="truncate flex-1">{d.label}</span>
            <span style={{ fontWeight: 600, color: "#8E8E93" }}>{money(d.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Bar({ fraction, color, height = 6 }) {
  return (
    <div style={{ height, borderRadius: 999, background: "#2C2C2E", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.max(0, Math.min(1, fraction)) * 100}%`, minWidth: 4, background: color, borderRadius: 999 }} />
    </div>
  );
}

export function downloadText(content, filename, type = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
