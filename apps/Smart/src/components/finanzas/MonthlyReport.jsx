import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ChevronDown, Share, CalendarClock, XCircle, ArrowDownRight, ArrowUpRight, Users, Percent, FileText, Table2, SlidersHorizontal, User, CreditCard, Calendar, CheckCircle2, Circle, Loader2, AlertTriangle, Package, List, Info, PieChart } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { sharePDFBlob } from "@/components/pos/native/Receipt";
import { FP, num } from "@/lib/finance/ledger";
import { monthStart, addMonths, sameMonth, zonedParts, fmt, daysBetween, startOfDay, parseDay, dayString } from "@/lib/finance/tz";
import {
  reportRange, applyFilters, pnlTotals, momPct, grouped, spansMultipleWeeks, weeklySubtotals, dailySeries, employeeStats, productStats,
  loadReport, loadSales, ivuPayload, suriSalesCode, tenantCountry, screenTaxLabel, ratePercent, methodSpanish, buildCSV, buildReportPDF,
  isRev, isOpExpense, isPayroll, monthLongLabel,
} from "@/lib/finance/monthlyReport";
import { money, Donut, Segmented, downloadText } from "./ui";

const CARD = "#1C1C1E";
const CARD2 = "#2C2C2E";
const SUB = "#8E8E93";
const TER = "rgba(235,235,245,0.3)";

function Sparkline({ series, color, height = 60 }) {
  const W = 300;
  const max = Math.max(...series, 0) || 1;
  const n = series.length;
  const pts = series.map((v, i) => [n === 1 ? W / 2 : (i / (n - 1)) * W, height - 4 - (v / max) * (height - 8)]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const id = `g${color.replace("#", "")}`;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Mini({ label, value }) {
  return (
    <div className="flex flex-col" style={{ gap: 1 }}>
      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", color: SUB }}>{label.toUpperCase()}</span>
      <span style={{ fontSize: 12, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function Capsule({ children, color, bg }) {
  return <span className="whitespace-nowrap" style={{ padding: "4px 8px", borderRadius: 999, fontSize: 11, fontWeight: 600, color: color || SUB, background: bg || "#3A3A3C" }}>{children}</span>;
}

function DeltaRow({ delta, positiveIsGood, suffix = "vs período anterior" }) {
  if (delta === null) return <span style={{ fontSize: 11, color: TER }}>Sin data previa</span>;
  const up = delta >= 0;
  const good = up === positiveIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: good ? FP.success : FP.danger }}>
      <Icon className="w-3.5 h-3.5" strokeWidth={3} /> {Math.abs(delta).toFixed(1)}% {suffix}
    </span>
  );
}

function KPICard({ title, value, prev, color, Icon, positiveIsGood, series, periodLabel }) {
  const delta = momPct(value, prev);
  return (
    <div className="flex flex-col" style={{ gap: 8, padding: 16, borderRadius: 20, background: CARD }}>
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4" style={{ color }} strokeWidth={2.5} />
        <span className="flex-1" style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        <Capsule>{periodLabel}</Capsule>
      </div>
      <span className="truncate" style={{ fontSize: 28, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{money(value)}</span>
      {series.some((v) => v > 0) && <Sparkline series={series} color={color} />}
      <DeltaRow delta={delta} positiveIsGood={positiveIsGood} />
    </div>
  );
}

function TxRow({ tx, color, expense, tz }) {
  const d = tx.created_at ? new Date(tx.created_at) : null;
  const method = tx.payment_method ? methodSpanish(tx.payment_method) : "";
  const meta = { fontSize: 10, color: SUB };
  return (
    <div className="flex items-start gap-2" style={{ padding: "8px 16px 8px 28px" }}>
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>{String(tx.description || "").trim() || "Sin descripción"}</p>
        <div className="flex flex-wrap items-center" style={{ gap: "2px 8px", marginTop: 2 }}>
          <span className="flex items-center gap-1" style={meta}><Calendar className="w-2.5 h-2.5" /> {d ? fmt(d, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).replace(",", " ·") : "—"}</span>
          <span className="flex items-center gap-1" style={meta}><User className="w-2.5 h-2.5" /> {tx.recorded_by || "—"}</span>
          {method && <span className="flex items-center gap-1" style={meta}><CreditCard className="w-2.5 h-2.5" /> {method}</span>}
          {tx.order_number && <span style={{ fontSize: 10, fontWeight: 500, color: FP.info }}>Orden {tx.order_number}</span>}
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{expense ? "−" : "+"}{money(num(tx.amount))}</span>
    </div>
  );
}

function CategorySection({ title, Icon, color, groups, total, expense, open, onToggle, openCats, toggleCat, openWeekly, toggleWeekly, tz }) {
  const txCount = groups.reduce((s, g) => s + g.count, 0);
  const all = groups.flatMap((g) => g.txs);
  const showWeekly = open && spansMultipleWeeks(all, tz);
  const weeklyOpen = openWeekly.has(title);
  const weeks = weeklyOpen ? weeklySubtotals(all, tz) : [];
  return (
    <div style={{ borderRadius: 20, background: CARD, overflow: "hidden" }}>
      <button onClick={onToggle} className="w-full flex items-center gap-2 text-left" style={{ padding: 16, background: tint(color, 0.1) }} aria-expanded={open}>
        <Icon className="w-4 h-4" style={{ color }} strokeWidth={2.5} />
        <span className="flex-1 min-w-0">
          <span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
          <span className="block" style={{ fontSize: 11, color: SUB }}>{groups.length} {groups.length === 1 ? "categoría" : "categorías"} · {txCount} tx</span>
        </span>
        <span style={{ fontSize: 15, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{money(total)}</span>
        <ChevronRight className="w-3.5 h-3.5" style={{ color: TER, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div>
          {groups.map((g) => {
            const key = `${title}::${g.key}`;
            const catOpen = openCats.has(key);
            return (
              <div key={g.key} style={{ borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
                <button onClick={() => toggleCat(key)} className="w-full flex items-center gap-1.5 text-left" style={{ padding: "12px 16px" }} aria-expanded={catOpen}>
                  <span style={{ fontSize: 15 }}>{g.label}</span>
                  <span style={{ fontSize: 12, color: SUB }}>({g.count})</span>
                  <span className="flex-1" />
                  <span style={{ fontSize: 15, fontWeight: 500, color, fontVariantNumeric: "tabular-nums" }}>{money(g.total)}</span>
                  <ChevronRight className="w-3 h-3" style={{ color: TER, transform: catOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                </button>
                {catOpen && (
                  <div style={{ background: CARD2 }}>
                    {g.txs.map((tx, i) => (
                      <div key={tx.id || i} style={{ borderTop: i ? "0.5px solid rgba(84,84,88,0.45)" : "none" }}>
                        <TxRow tx={tx} color={color} expense={expense} tz={tz} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {showWeekly && (
            <div style={{ borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
              <button onClick={() => toggleWeekly(title)} className="w-full flex items-center gap-2 text-left" style={{ padding: "10px 16px", background: tint(color, 0.04) }} aria-expanded={weeklyOpen}>
                <CalendarClock className="w-3.5 h-3.5" style={{ color }} />
                <span className="flex-1" style={{ fontSize: 12, fontWeight: 600, color: SUB }}>Por semana</span>
                <ChevronRight className="w-3 h-3" style={{ color: TER, transform: weeklyOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
              </button>
              {weeklyOpen && weeks.map((w, i) => (
                <div key={w.label} className="flex items-center gap-1.5" style={{ padding: "8px 16px 8px 24px", background: tint(color, 0.03), borderTop: i ? "0.5px solid rgba(84,84,88,0.45)" : "none" }}>
                  <span style={{ fontSize: 12 }}>{w.label}</span>
                  <span style={{ fontSize: 11, color: SUB }}>({w.count} tx)</span>
                  <span className="flex-1" />
                  <span style={{ fontSize: 12, fontWeight: 600, color, fontVariantNumeric: "tabular-nums" }}>{money(w.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RankBar({ fraction, leader }) {
  return (
    <div style={{ height: 6, borderRadius: 999, background: "#3A3A3C", overflow: "hidden" }}>
      <div style={{ width: `max(8px, ${Math.min(1, fraction) * 100}%)`, height: "100%", borderRadius: 999, background: leader ? `linear-gradient(90deg, ${FP.vip}, ${FP.brand})` : `linear-gradient(90deg, ${tint(FP.brand, 0.6)}, ${FP.brand})` }} />
    </div>
  );
}

function EmptyState({ Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ gap: 8, padding: "40px 16px" }}>
      <Icon className="w-9 h-9" style={{ color: TER }} />
      <p style={{ fontSize: 15, fontWeight: 600, color: SUB }}>{title}</p>
      <p style={{ fontSize: 12, color: TER }}>{subtitle}</p>
    </div>
  );
}

function CheckRow({ label, Icon, on, onClick }) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px" }}>
      {Icon && <Icon className="w-4 h-4" style={{ color: SUB }} />}
      <span className="flex-1" style={{ fontSize: 15 }}>{label}</span>
      {on ? <CheckCircle2 className="w-5 h-5" style={{ color: FP.brand }} /> : <Circle className="w-5 h-5" style={{ color: "#48484A" }} />}
    </button>
  );
}

function FilterDialog({ open, onClose, employees, methods, empSel, setEmpSel, methodSel, setMethodSel }) {
  const toggle = (set, setter, v) => { const n = new Set(set); if (n.has(v)) n.delete(v); else n.add(v); setter(n); };
  const group = (header, empty, items, sel, setter, allLabel, Icon, labelFor) => (
    <div>
      <p style={{ fontSize: 13, color: SUB, padding: "12px 4px 6px", textTransform: "uppercase" }}>{header}</p>
      <div style={{ borderRadius: 12, background: CARD2, overflow: "hidden" }}>
        {items.length === 0 ? <p style={{ padding: 14, fontSize: 15, color: SUB }}>{empty}</p> : (
          <>
            <CheckRow label={allLabel} on={sel.size === 0} onClick={() => setter(new Set())} />
            {items.map((v) => (
              <div key={v} style={{ borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
                <CheckRow label={labelFor(v)} Icon={Icon} on={sel.has(v)} onClick={() => toggle(sel, setter, v)} />
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
  return (
    <Dialog open={open} onClose={onClose} title="Filtros" width={460} leading={<span />} trailing={<TextAction bold onClick={onClose}>Listo</TextAction>}>
      {group("Empleados", "Sin empleados con transacciones", employees, empSel, setEmpSel, "Mostrar todos los empleados", User, (v) => v)}
      {group("Métodos de pago", "Sin métodos registrados", methods, methodSel, setMethodSel, "Mostrar todos los métodos", CreditCard, methodSpanish)}
      {(empSel.size > 0 || methodSel.size > 0) && (
        <button onClick={() => { setEmpSel(new Set()); setMethodSel(new Set()); }} className="w-full flex items-center justify-center gap-2" style={{ marginTop: 16, padding: 14, borderRadius: 12, background: CARD2, color: "#FF453A", fontSize: 15 }}>
          <XCircle className="w-4 h-4" /> Limpiar todos los filtros
        </button>
      )}
    </Dialog>
  );
}

function RangeDialog({ open, onClose, initialStart, initialEnd, onApply, onClear, tz }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => {
    if (!open) return;
    setFrom(dayString(initialStart, tz));
    setTo(dayString(initialEnd, tz));
  }, [open]);
  const canApply = from && to && to >= from;
  const input = { background: "transparent", color: "#fff", colorScheme: "dark", fontSize: 15, textAlign: "right" };
  return (
    <Dialog open={open} onClose={onClose} title="Elegir fechas" width={440}
      leading={<TextAction onClick={onClose}>Cancelar</TextAction>}
      trailing={<TextAction bold disabled={!canApply} onClick={() => { onApply(parseDay(from, tz), parseDay(to, tz)); onClose(); }}>Aplicar</TextAction>}>
      <p style={{ fontSize: 13, color: SUB, padding: "12px 4px 6px", textTransform: "uppercase" }}>Rango personalizado</p>
      <div style={{ borderRadius: 12, background: CARD2 }}>
        <label className="flex items-center justify-between" style={{ padding: "10px 14px" }}>
          <span style={{ fontSize: 15 }}>Desde</span>
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={input} />
        </label>
        <label className="flex items-center justify-between" style={{ padding: "10px 14px", borderTop: "0.5px solid rgba(84,84,88,0.6)" }}>
          <span style={{ fontSize: 15 }}>Hasta</span>
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={input} />
        </label>
      </div>
      <p style={{ fontSize: 12, color: SUB, padding: "6px 4px 0" }}>Para navegar mes a mes usa las flechas. Aquí solo elige fechas específicas.</p>
      <button onClick={() => { onClear(); onClose(); }} className="w-full flex items-center justify-center gap-2" style={{ marginTop: 20, padding: 14, borderRadius: 12, background: CARD2, color: "#FF453A", fontSize: 15 }}>
        <XCircle className="w-4 h-4" /> Quitar rango — volver a modo mes
      </button>
    </Dialog>
  );
}

function ShareMenu({ onPDF, onCSV, onFilters, disabled, filterLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const item = (Icon, label, onClick, off) => (
    <button disabled={off} onClick={() => { setOpen(false); onClick(); }} className="w-full flex items-center gap-3 text-left disabled:opacity-40" style={{ padding: "11px 14px", fontSize: 15 }}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Compartir" aria-expanded={open} className="apple-press" style={{ color: FP.brand, padding: 4 }}><Share className="w-5 h-5" /></button>
      {open && (
        <div className="absolute right-0 z-10" style={{ top: 34, width: 230, borderRadius: 14, background: "#3A3A3C", boxShadow: "0 12px 32px rgba(0,0,0,0.5)", overflow: "hidden" }}>
          {item(FileText, "Compartir PDF", onPDF, disabled)}
          {item(Table2, "Compartir CSV", onCSV, disabled)}
          {onFilters && <div style={{ height: 6, background: "#2C2C2E" }} />}
          {onFilters && item(SlidersHorizontal, filterLabel, onFilters, false)}
        </div>
      )}
    </div>
  );
}

export default function MonthlyReportDialog({ open, onClose, tenantId, tenant, tz }) {
  const [month, setMonth] = useState(() => monthStart(new Date(), tz));
  const [customStart, setCustomStart] = useState(null);
  const [customEnd, setCustomEnd] = useState(null);
  const [data, setData] = useState({ transactions: [], prev: [], ivu: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("pnl");
  const [sales, setSales] = useState([]);
  const [salesLoaded, setSalesLoaded] = useState(false);
  const [byQty, setByQty] = useState(false);
  const [empSel, setEmpSel] = useState(() => new Set());
  const [methodSel, setMethodSel] = useState(() => new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showRange, setShowRange] = useState(false);
  const [openSections, setOpenSections] = useState(() => new Set());
  const [openCats, setOpenCats] = useState(() => new Set());
  const [openWeekly, setOpenWeekly] = useState(() => new Set());
  const [ivuOpen, setIvuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 700px)").matches);
  const reqRef = useRef(0);

  useEffect(() => {
    const m = window.matchMedia("(min-width: 700px)");
    const on = () => setWide(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    setMonth(monthStart(new Date(), tz));
    setCustomStart(null);
    setCustomEnd(null);
    setTab("pnl");
    setEmpSel(new Set());
    setMethodSel(new Set());
  }, [open, tz]);

  const isCustom = !!(customStart && customEnd);
  const range = useMemo(() => reportRange({ month, customStart, customEnd, tz }), [month, customStart, customEnd, tz]);
  const rangeKey = `${range.start.getTime()}-${range.end.getTime()}`;

  useEffect(() => {
    if (!open || !tenantId) return;
    const id = ++reqRef.current;
    setLoading(true);
    setError(null);
    setSales([]);
    setSalesLoaded(false);
    loadReport({ tenantId, range, isCustom, month, tz }).then(
      (d) => { if (reqRef.current === id) { setData(d); setLoading(false); } },
      (e) => { if (reqRef.current === id) { setError(e?.message || String(e)); setData((x) => ({ ...x, transactions: [], prev: [] })); setLoading(false); } },
    );
  }, [open, tenantId, rangeKey, isCustom]);

  useEffect(() => {
    if (!open || tab !== "productos" || salesLoaded || loading || !tenantId) return;
    const id = reqRef.current;
    loadSales({ tenantId, range }).then((rows) => { if (reqRef.current === id) { setSales(rows); setSalesLoaded(true); } });
  }, [open, tab, salesLoaded, loading, tenantId, rangeKey]);

  const txs = useMemo(() => applyFilters(data.transactions, empSel, methodSel), [data.transactions, empSel, methodSel]);
  const prevTxs = useMemo(() => applyFilters(data.prev, empSel, methodSel), [data.prev, empSel, methodSel]);
  const t = pnlTotals(txs);
  const pt = pnlTotals(prevTxs);
  const employees = useMemo(() => [...new Set(data.transactions.map((x) => x.recorded_by).filter(Boolean))].sort(), [data.transactions]);
  const methods = useMemo(() => [...new Set(data.transactions.map((x) => x.payment_method).filter(Boolean))].sort(), [data.transactions]);
  const filterable = employees.length > 1 || methods.length > 1;
  const activeFilters = (empSel.size ? 1 : 0) + (methodSel.size ? 1 : 0);
  const now = new Date();
  const isCurrentMonth = sameMonth(month, now, tz);
  const canGoForward = month < monthStart(now, tz);
  const monthLabel = monthLongLabel(month, tz);
  const shortDate = (d) => fmt(d, tz, { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");
  const customLabel = isCustom ? `${shortDate(customStart)} — ${shortDate(customEnd)}` : "—";
  const customDays = isCustom ? daysBetween(customStart, customEnd, tz) + 1 : 0;
  const periodLabel = isCustom ? customLabel : isCurrentMonth ? "Mes en curso" : monthLabel;
  const taxLabel = screenTaxLabel(tenant);
  const navTitle = (() => {
    if (!isCustom) return "Reporte Mensual";
    if (customDays === 1 && daysBetween(customStart, now, tz) === 0) return "Reporte del Día";
    if (customDays <= 7) return "Reporte Semanal";
    return "Reporte del Período";
  })();
  const fileLabel = isCustom ? `${dayString(customStart, tz)}_${dayString(customEnd, tz)}` : dayString(month, tz).slice(0, 7);

  const revenueGroups = useMemo(() => grouped(txs.filter(isRev)), [txs]);
  const expenseGroups = useMemo(() => grouped(txs.filter(isOpExpense)), [txs]);
  const payrollGroups = useMemo(() => grouped(txs.filter(isPayroll)), [txs]);
  const revenueSeries = useMemo(() => dailySeries(txs.filter(isRev), range, tz), [txs, rangeKey, tz]);
  const expenseSeries = useMemo(() => dailySeries(txs.filter(isOpExpense), range, tz), [txs, rangeKey, tz]);
  const payload = useMemo(() => (data.ivu && !isCustom ? ivuPayload(data.ivu, tenant, monthLabel) : null), [data.ivu, isCustom, tenant, monthLabel]);
  const country = tenantCountry(tenant);

  const toggleIn = (setter, key) => setter((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  const clearFilters = () => { setEmpSel(new Set()); setMethodSel(new Set()); };

  const exportPDF = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const blob = await buildReportPDF({ tenant, monthLabel: isCustom ? customLabel : monthLabel, transactions: txs, payload: isCustom ? null : payload });
      await sharePDFBlob(blob, `Reporte_${fileLabel}.pdf`);
    } catch (e) {
      setError(`No se pudo generar el PDF: ${e?.message || e}`);
    }
    setExporting(false);
  };
  const exportCSV = () => downloadText(buildCSV(txs, tz), `Reporte_${fileLabel}.csv`);

  const circleBtn = (Icon, onClick, disabled, label) => (
    <button onClick={onClick} disabled={disabled} aria-label={label} className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: disabled ? "#2C2C2E" : tint(FP.brand, 0.2), color: disabled ? "#48484A" : FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon className="w-5 h-5" strokeWidth={2.8} />
    </button>
  );
  const chip = (label, Icon, active) => (
    <button onClick={() => setShowFilters(true)} className="apple-press flex items-center gap-1.5 whitespace-nowrap" style={{ padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: active ? FP.brand : "#3A3A3C", color: "#fff" }}>
      <Icon className="w-3.5 h-3.5" /> {label} <ChevronDown className="w-3 h-3" strokeWidth={3} />
    </button>
  );
  const empChip = empSel.size === 0 ? "Todos los empleados" : empSel.size === 1 ? [...empSel][0] : `${empSel.size} empleados`;
  const methodChip = methodSel.size === 0 ? "Todos los métodos" : methodSel.size === 1 ? methodSpanish([...methodSel][0]) : `${methodSel.size} métodos`;

  const net = t.net;
  const netColor = net >= 0 ? FP.success : FP.danger;
  const margin = t.revenue > 0 ? (net / t.revenue) * 100 : 0;
  const empStats = useMemo(() => employeeStats(txs, prevTxs), [txs, prevTxs]);
  const prodStats = useMemo(() => productStats(sales, range, empSel, byQty), [sales, rangeKey, empSel, byQty]);

  const pnl = (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {filterable && (wide ? (
        <div className="flex items-center gap-2 overflow-x-auto" style={{ paddingBottom: 2 }}>
          {chip(empChip, User, empSel.size > 0)}
          {chip(methodChip, CreditCard, methodSel.size > 0)}
          {activeFilters > 0 && <button onClick={clearFilters} className="flex items-center gap-1 whitespace-nowrap" style={{ padding: "7px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: FP.danger, background: tint(FP.danger, 0.1) }}><XCircle className="w-3.5 h-3.5" /> Limpiar</button>}
        </div>
      ) : activeFilters > 0 && (
        <div className="flex items-center gap-2" style={{ padding: "8px 12px", borderRadius: 12, background: tint(FP.brand, 0.08) }}>
          <SlidersHorizontal className="w-3.5 h-3.5" style={{ color: FP.brand }} />
          <span className="flex-1" style={{ fontSize: 12, fontWeight: 600 }}>{activeFilters} filtro{activeFilters === 1 ? "" : "s"} activo{activeFilters === 1 ? "" : "s"}</span>
          <button onClick={clearFilters} style={{ fontSize: 12, fontWeight: 600, color: FP.danger }}>Limpiar</button>
        </div>
      ))}
      <div className="grid" style={{ gap: 16, gridTemplateColumns: wide ? "1fr 1fr" : "1fr" }}>
        <KPICard title="Ingresos" value={t.revenue} prev={pt.revenue} color={FP.success} Icon={ArrowDownRight} positiveIsGood series={revenueSeries} periodLabel={periodLabel} />
        <KPICard title="Gastos" value={t.expenses} prev={pt.expenses} color={FP.danger} Icon={ArrowUpRight} positiveIsGood={false} series={expenseSeries} periodLabel={periodLabel} />
      </div>
      <div className="flex flex-col" style={{ gap: 8, padding: 16, borderRadius: 20, background: tint(netColor, 0.1), border: `1px solid ${tint(netColor, 0.25)}` }}>
        <div className="flex items-center gap-2">
          {net >= 0 ? <ArrowUpRight className="w-4 h-4" style={{ color: netColor }} strokeWidth={2.5} /> : <ArrowDownRight className="w-4 h-4" style={{ color: netColor }} strokeWidth={2.5} />}
          <span className="flex-1" style={{ fontSize: 15, fontWeight: 600 }}>Utilidad neta</span>
          <Capsule color={netColor} bg={tint(netColor, 0.15)}>{margin >= 0 ? `Margen ${margin.toFixed(1)}%` : `Pérdida ${Math.abs(margin).toFixed(1)}%`}</Capsule>
        </div>
        <span className="truncate" style={{ fontSize: 28, fontWeight: 800, color: netColor, fontVariantNumeric: "tabular-nums" }}>{money(net)}</span>
        <div className="flex gap-6"><Mini label="Ticket prom." value={money(t.avgTicket)} /><Mini label="# Ventas" value={String(t.saleCount)} /></div>
      </div>
      {!isCustom && data.ivu && data.ivu.ivuDue !== 0 && (() => {
        const due = data.ivu.ivuDue;
        const c = due >= 0 ? FP.danger : FP.success;
        return (
          <div className="flex flex-col" style={{ gap: 8, padding: 16, borderRadius: 20, background: tint(FP.vip, 0.1) }}>
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4" style={{ color: FP.vip }} strokeWidth={2.5} />
              <span className="flex-1" style={{ fontSize: 15, fontWeight: 600 }}>{taxLabel} del mes</span>
              <Capsule color={c} bg={tint(c, 0.15)}>{due >= 0 ? "Por pagar" : "Crédito"}</Capsule>
            </div>
            <span style={{ fontSize: 28, fontWeight: 800, color: c, fontVariantNumeric: "tabular-nums" }}>{money(Math.abs(due))}</span>
            <div className="flex gap-6"><Mini label="Recaudado" value={money(data.ivu.ivuCollected)} /><Mini label="Deducible" value={money(data.ivu.ivuPaidOnExpenses)} /></div>
          </div>
        );
      })()}
      <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: SUB, paddingTop: 4 }}>DETALLE</p>
      <CategorySection title="Ingresos" Icon={ArrowDownRight} color={FP.success} groups={revenueGroups} total={t.revenue} expense={false}
        open={openSections.has("Ingresos")} onToggle={() => toggleIn(setOpenSections, "Ingresos")} openCats={openCats} toggleCat={(k) => toggleIn(setOpenCats, k)} openWeekly={openWeekly} toggleWeekly={(k) => toggleIn(setOpenWeekly, k)} tz={tz} />
      <CategorySection title="Gastos" Icon={ArrowUpRight} color={FP.danger} groups={expenseGroups} total={t.expenses} expense
        open={openSections.has("Gastos")} onToggle={() => toggleIn(setOpenSections, "Gastos")} openCats={openCats} toggleCat={(k) => toggleIn(setOpenCats, k)} openWeekly={openWeekly} toggleWeekly={(k) => toggleIn(setOpenWeekly, k)} tz={tz} />
      {openSections.has("Gastos") && expenseGroups.length >= 2 && (
        <div className="flex flex-col" style={{ gap: 12, padding: 16, borderRadius: 20, background: CARD }}>
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4" style={{ color: FP.danger }} />
            <span className="flex-1" style={{ fontSize: 15, fontWeight: 600 }}>Gastos por categoría</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: FP.danger }}>{money(t.expenses)}</span>
          </div>
          <Donut data={expenseGroups.map((g) => ({ label: g.label, amount: g.total }))} total={t.expenses} />
        </div>
      )}
      {payrollGroups.length > 0 && (
        <CategorySection title="Nómina" Icon={Users} color={FP.vip} groups={payrollGroups} total={t.payroll} expense
          open={openSections.has("Nómina")} onToggle={() => toggleIn(setOpenSections, "Nómina")} openCats={openCats} toggleCat={(k) => toggleIn(setOpenCats, k)} openWeekly={openWeekly} toggleWeekly={(k) => toggleIn(setOpenWeekly, k)} tz={tz} />
      )}
      {!isCustom && data.ivu && (
        <div style={{ borderRadius: 20, background: CARD, overflow: "hidden" }}>
          <button onClick={() => setIvuOpen((v) => !v)} className="w-full flex items-center gap-2 text-left" style={{ padding: 16, background: tint(FP.vip, 0.1) }} aria-expanded={ivuOpen}>
            <Percent className="w-4 h-4" style={{ color: FP.vip }} strokeWidth={2.5} />
            <span className="flex-1">
              <span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Resumen {taxLabel} del mes</span>
              <span className="block" style={{ fontSize: 11, color: SUB }}>{data.ivu.transactionCount} venta{data.ivu.transactionCount === 1 ? "" : "s"}</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5" style={{ color: TER, transform: ivuOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
          </button>
          <div className="flex flex-col" style={{ gap: 10, padding: 16 }}>
            <div className="grid grid-cols-3" style={{ gap: 8 }}>
              {[["Recaudado", data.ivu.ivuCollected, FP.brand, 700], ["Deducible", data.ivu.ivuPaidOnExpenses, FP.vip, 700], ["A pagar", data.ivu.ivuDue, FP.danger, 800]].map(([l, v, c, w]) => (
                <div key={l} className="flex flex-col" style={{ gap: 4, padding: 10, borderRadius: 12, background: tint(c, 0.1) }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: SUB }}>{l}</span>
                  <span className="truncate" style={{ fontSize: 15, fontWeight: w, color: c, fontVariantNumeric: "tabular-nums" }}>{money(v)}</span>
                </div>
              ))}
            </div>
            {ivuOpen ? (
              <>
                {data.ivu.salesByTaxRate.length > 0 && (
                  <div className="flex flex-col" style={{ gap: 4 }}>
                    <div className="flex items-center">
                      <span className="flex-1" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: SUB }}>DESGLOSE POR TASA</span>
                      <span style={{ fontSize: 11, color: SUB }}>Total {money(data.ivu.grossTotalSales)}</span>
                    </div>
                    {[...data.ivu.salesByTaxRate].sort((a, b) => b.taxRate - a.taxRate).map((row) => {
                      const code = suriSalesCode(row.taxRate, country);
                      return (
                        <div key={row.taxRate} className="flex items-center gap-2" style={{ padding: "8px 10px", borderRadius: 8, background: CARD2 }}>
                          {code && <span style={{ padding: "2px 6px", borderRadius: 4, background: FP.brand, color: "#fff", fontSize: 11, fontWeight: 800 }}>{code}</span>}
                          <span className="flex-1" style={{ fontSize: 15, color: row.taxRate === 0 ? SUB : "#fff" }}>{row.taxRate === 0 ? "Exento" : ratePercent(row.taxRate)}</span>
                          <span className="flex flex-col items-end">
                            <span style={{ fontSize: 15, fontWeight: 600, color: row.taxCollected > 0 ? FP.brand : SUB }}>{money(row.taxCollected)}</span>
                            <span style={{ fontSize: 11, color: SUB }}>Ventas {money(row.taxableSales)}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {country === "PR" && <p className="flex items-center gap-1.5" style={{ fontSize: 11, color: SUB }}><Info className="w-3 h-3" /> Códigos L1–L9 listos para SURI. Exporta PDF para entregar al contador.</p>}
              </>
            ) : data.ivu.salesByTaxRate.length > 0 && (
              <p className="flex items-center gap-1" style={{ fontSize: 11, color: TER }}><List className="w-3 h-3" /> Toca para ver desglose de {data.ivu.salesByTaxRate.length} tasa{data.ivu.salesByTaxRate.length === 1 ? "" : "s"}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const empleados = empStats.length === 0
    ? <EmptyState Icon={Users} title="Sin ventas con empleado asignado" subtitle="Verifica que cada venta en POS registre el cajero." />
    : (
      <div className="flex flex-col" style={{ gap: 12 }}>
        <div className="flex items-center">
          <span className="flex-1" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: SUB }}>RANKING DE EMPLEADOS</span>
          <span style={{ fontSize: 11, color: TER }}>{empStats.length} activo{empStats.length === 1 ? "" : "s"}</span>
        </div>
        {empStats.map((s, i) => {
          const delta = momPct(s.revenue, s.prevRevenue);
          return (
            <div key={s.name} className="flex flex-col" style={{ gap: 8, padding: 16, borderRadius: 20, background: CARD }}>
              <div className="flex items-baseline gap-2">
                <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? FP.vip : SUB }}>#{i + 1}</span>
                <span className="flex-1 truncate" style={{ fontSize: 15, fontWeight: 600 }}>{s.name}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: FP.success, fontVariantNumeric: "tabular-nums" }}>{money(s.revenue)}</span>
              </div>
              <RankBar fraction={empStats[0].revenue > 0 ? s.revenue / empStats[0].revenue : 0} leader={i === 0} />
              <div className="flex items-center gap-4">
                <Mini label="Ventas" value={String(s.txCount)} />
                <Mini label="Ticket prom." value={money(s.avgTicket)} />
                <span className="flex-1" />
                {delta !== null && <DeltaRow delta={delta} positiveIsGood suffix="vs mes ant." />}
              </div>
            </div>
          );
        })}
      </div>
    );

  const productos = !salesLoaded
    ? <div className="flex justify-center" style={{ padding: 60 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: SUB }} /></div>
    : prodStats.length === 0
      ? <EmptyState Icon={Package} title="Sin productos vendidos en el período" subtitle="Cuando registres ventas en POS verás aquí el top de productos." />
      : (
        <div className="flex flex-col" style={{ gap: 12 }}>
          <div className="flex items-center gap-3">
            <span className="flex-1" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", color: SUB }}>TOP PRODUCTOS</span>
            <Segmented options={[[false, "Por ingresos"], [true, "Por cantidad"]]} value={byQty} onChange={setByQty} style={{ width: 220 }} />
          </div>
          {prodStats.map((p, i) => (
            <div key={p.name} className="flex flex-col" style={{ gap: 8, padding: 16, borderRadius: 20, background: CARD }}>
              <div className="flex items-baseline gap-2">
                <span style={{ fontSize: 12, fontWeight: 800, color: i === 0 ? FP.vip : SUB }}>#{i + 1}</span>
                <span className="flex-1" style={{ fontSize: 15, fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.name}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: FP.brand, fontVariantNumeric: "tabular-nums" }}>{money(p.revenue)}</span>
              </div>
              <RankBar fraction={prodStats[0].revenue > 0 ? p.revenue / prodStats[0].revenue : 0} />
              <div className="flex gap-4"><Mini label="Cantidad" value={String(p.quantity)} /><Mini label="Ventas" value={String(p.txCount)} /></div>
            </div>
          ))}
        </div>
      );

  return (
    <>
      <Dialog open={open} onClose={onClose} title={navTitle} width={1100} height="94dvh"
        leading={<TextAction onClick={onClose}>Cerrar</TextAction>}
        trailing={<ShareMenu onPDF={exportPDF} onCSV={exportCSV} disabled={loading || data.transactions.length === 0 || exporting}
          onFilters={filterable ? () => setShowFilters(true) : null} filterLabel={activeFilters ? `Filtros (${activeFilters} activos)` : "Filtros"} />}
        bodyPadding="8px 16px 32px">
        <div className="flex flex-col" style={{ gap: 16 }}>
          <div className="flex flex-col" style={{ gap: 10 }}>
            {isCustom ? (
              <div className="flex flex-col" style={{ gap: 4, padding: 12, borderRadius: 12, background: tint(FP.brand, 0.06) }}>
                <span className="flex items-center gap-1.5" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: FP.brand }}><CalendarClock className="w-3.5 h-3.5" /> RANGO PERSONALIZADO</span>
                <span style={{ fontSize: 20, fontWeight: 700 }}>{customLabel}</span>
                <span style={{ fontSize: 11, color: SUB }}>{customDays} día{customDays === 1 ? "" : "s"}</span>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                {circleBtn(ChevronLeft, () => setMonth((m) => addMonths(m, -1, tz)), false, "Mes anterior")}
                <div className="flex-1 flex flex-col items-center" style={{ gap: 2 }}>
                  <span style={{ fontSize: 22, fontWeight: 700 }}>{monthLabel}</span>
                  <span style={{ fontSize: 12, color: SUB }}>{isCurrentMonth ? "Mes en curso" : zonedParts(month, tz).y}</span>
                </div>
                {circleBtn(ChevronRight, () => canGoForward && setMonth((m) => addMonths(m, 1, tz)), !canGoForward, "Mes siguiente")}
              </div>
            )}
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setShowRange(true)} className="apple-press flex items-center gap-1.5" style={{ padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: FP.brand, background: tint(FP.brand, 0.1) }}>
                <CalendarClock className="w-3.5 h-3.5" /> {isCustom ? "Editar rango" : "Rango personalizado"}
              </button>
              {isCustom && (
                <button onClick={() => { setCustomStart(null); setCustomEnd(null); }} className="apple-press flex items-center gap-1.5" style={{ padding: "6px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: FP.danger, background: tint(FP.danger, 0.1) }}>
                  <XCircle className="w-3.5 h-3.5" /> Volver al mes
                </button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center" style={{ padding: 80 }}><Loader2 className="w-6 h-6 animate-spin" style={{ color: SUB }} /></div>
          ) : error ? (
            <div className="flex items-center gap-2" style={{ padding: 16, borderRadius: 16, background: CARD }}>
              <AlertTriangle className="w-4 h-4" style={{ color: FP.danger }} />
              <span className="flex-1" style={{ fontSize: 15, color: SUB }}>{error}</span>
            </div>
          ) : (
            <>
              <Segmented options={[["pnl", "P&L"], ["empleados", "Empleados"], ["productos", "Productos"]]} value={tab} onChange={setTab} />
              {tab === "pnl" && pnl}
              {tab === "empleados" && empleados}
              {tab === "productos" && productos}
            </>
          )}
        </div>
      </Dialog>
      <FilterDialog open={showFilters} onClose={() => setShowFilters(false)} employees={employees} methods={methods} empSel={empSel} setEmpSel={setEmpSel} methodSel={methodSel} setMethodSel={setMethodSel} />
      <RangeDialog open={showRange} onClose={() => setShowRange(false)} tz={tz}
        initialStart={customStart || range.start} initialEnd={customEnd || new Date(range.end.getTime() - 86400000)}
        onApply={(s, e) => { if (s && e) { setCustomStart(startOfDay(s, tz)); setCustomEnd(startOfDay(e, tz)); } }}
        onClear={() => { setCustomStart(null); setCustomEnd(null); }} />
    </>
  );
}
