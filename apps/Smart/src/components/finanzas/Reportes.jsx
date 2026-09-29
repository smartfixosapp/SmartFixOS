import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, BarChart3, ArrowDownCircle, ArrowUpCircle, Equal, AlertCircle, PieChart, UserCheck, TrendingUp, List, Inbox, FileText, Crown, ArrowDownCircle as DownCircle } from "lucide-react";
import { Dialog, TextAction, tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { money, cardStyle, Empty, KPITile, ActionCard, Segmented, CircleIcon, GroupedBarChart, NetBarChart, Donut, Bar } from "./ui";

const METHOD_COLORS = { Efectivo: FP.success, "ATH Móvil": FP.vip, Tarjeta: FP.info, Transferencia: FP.brand, Cheque: FP.cheque };

function DayPickerDialog({ open, value, onClose, onApply }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { if (open) setDraft(value); }, [open, value]);
  return (
    <Dialog open={open} onClose={onClose} title="Escoger dia" width={420} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold onClick={() => { onApply(draft); onClose(); }}>Listo</TextAction>}>
      <input type="date" value={draft} onChange={(e) => setDraft(e.target.value || draft)} style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, background: "#2C2C2E", color: "#fff", border: "none", fontSize: 16, colorScheme: "dark" }} />
    </Dialog>
  );
}

function CustomRangeDialog({ open, from, to, onClose, onApply }) {
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  useEffect(() => { if (open) { setF(from); setT(to); } }, [open, from, to]);
  const field = { width: "100%", padding: "12px 14px", background: "transparent", color: "#fff", border: "none", fontSize: 16, colorScheme: "dark" };
  return (
    <Dialog open={open} onClose={onClose} title="Personalizar" width={440} leading={<TextAction onClick={onClose}>Cancelar</TextAction>} trailing={<TextAction bold onClick={() => { onApply(f, t); onClose(); }}>Aplicar</TextAction>}>
      <p style={{ fontSize: 12, color: "#8E8E93", textTransform: "uppercase", margin: "12px 4px 6px" }}>Rango de fechas</p>
      <div style={{ borderRadius: 12, background: "#2C2C2E" }}>
        <label className="flex items-center justify-between" style={{ paddingLeft: 14 }}><span>Desde</span><input type="date" value={f} onChange={(e) => setF(e.target.value || f)} style={{ ...field, width: 180, textAlign: "right" }} /></label>
        <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)", marginLeft: 14 }} />
        <label className="flex items-center justify-between" style={{ paddingLeft: 14 }}><span>Hasta</span><input type="date" value={t} onChange={(e) => setT(e.target.value || t)} style={{ ...field, width: 180, textAlign: "right" }} /></label>
      </div>
    </Dialog>
  );
}

export default function ReportesTab({ r, wide, onOpenModule, onOpenMonthly }) {
  const [dayPicker, setDayPicker] = useState(false);
  const [custom, setCustom] = useState(false);
  const nav = (() => {
    if (r.customActive) return { label: r.navLabel, prev: null, next: null, tap: () => setCustom(true) };
    if (r.period === "dia") return { label: r.navLabel, prev: () => r.advanceDay(-1), next: () => r.advanceDay(1), tap: () => setDayPicker(true) };
    if (r.period === "semana") return { label: r.navLabel, prev: () => r.advanceWeek(-1), next: () => r.advanceWeek(1), tap: null };
    return { label: "", prev: null, next: null, tap: null };
  })();
  const chartTitle = r.customActive ? "Ingresos vs Gastos — rango" : r.period === "dia" ? "Ingresos vs Gastos — por dia" : r.period === "semana" ? "Ingresos vs Gastos — por semana" : "Ingresos vs Gastos — por mes";
  const methodTotal = r.byMethod.reduce((s, x) => s + x.amount, 0);
  const methodMax = Math.max(0, ...r.byMethod.map((x) => x.amount)) || 1;
  const rankTotal = r.ranking.reduce((s, x) => s + x.amount, 0);
  const months = r.months;
  const best = months.length ? Math.max(...months.map((m) => m.neto)) : null;
  const worst = months.length ? Math.min(...months.map((m) => m.neto)) : null;
  const avg = months.length ? months.reduce((s, m) => s + m.neto, 0) / months.length : 0;
  const totalNet = months.reduce((s, m) => s + m.neto, 0);

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <Segmented options={[["dia", "Dia"], ["semana", "Semana"], ["mes", "Mes"]]} value={r.period} onChange={r.setPeriod} />
      <div className="flex items-center gap-3">
        {nav.prev ? <CircleIcon Icon={ChevronLeft} onClick={nav.prev} label="Anterior" /> : <span style={{ width: 36 }} />}
        <div className="flex-1 text-center">
          {!nav.label ? <span style={{ fontSize: 13, color: "#8E8E93" }}>Usa el navegador de mes de arriba</span>
            : nav.tap ? <button onClick={nav.tap} style={{ fontSize: 17, fontWeight: 700 }}>{nav.label}</button>
              : <span style={{ fontSize: 17, fontWeight: 700 }}>{nav.label}</span>}
        </div>
        {nav.next ? <CircleIcon Icon={ChevronRight} onClick={nav.next} label="Siguiente" /> : <span style={{ width: 36 }} />}
        <button onClick={() => setCustom(true)} style={{ height: 36, padding: "0 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: r.customActive ? FP.brand : tint(FP.brand, 0.12), color: r.customActive ? "#fff" : FP.brand }}>Personalizar</button>
      </div>
      <div className="grid" style={{ gap: 8, gridTemplateColumns: wide ? "repeat(4, 1fr)" : "repeat(2, 1fr)" }}>
        <KPITile label="Entró" value={r.periodEntro} Icon={ArrowDownCircle} color={FP.entra} />
        <KPITile label="Salió" value={r.periodSalio} Icon={ArrowUpCircle} color={FP.sale} />
        <KPITile label="Neto" value={r.periodNeto} Icon={Equal} color={r.periodNeto >= 0 ? FP.entra : FP.sale} />
        <KPITile label="Por pagar" value={r.totalPorPagar} Icon={AlertCircle} color={FP.warning} accented />
      </div>
      <div style={{ ...cardStyle, padding: 12 }}>
        <p className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}><BarChart3 className="w-5 h-5" style={{ color: FP.brand }} /> {chartTitle}</p>
        {r.chart.every((d) => d.ingresos === 0 && d.gastos === 0) ? <Empty>Sin datos para graficar</Empty> : <GroupedBarChart data={r.chart} />}
      </div>
      <div style={{ ...cardStyle, padding: 12 }}>
        <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>De dónde entró el dinero</p>
        {r.byCategory.length === 0 ? <Empty>Sin entradas en este período</Empty> : <Donut data={r.byCategory} total={r.totalEntro} />}
      </div>
      {r.byMethod.length > 0 && (
        <div className="flex flex-col" style={{ ...cardStyle, padding: 12, gap: 8 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#8E8E93" }}>Entró por método</p>
          {r.byMethod.map((x) => (
            <div key={x.label} className="flex flex-col" style={{ gap: 3 }}>
              <div className="flex items-center gap-2" style={{ fontSize: 12 }}>
                <span className="flex-1">{x.label}</span>
                <span style={{ fontSize: 11, color: "rgba(235,235,245,0.3)" }}>{methodTotal > 0 ? ((x.amount / methodTotal) * 100).toFixed(0) : 0}%</span>
                <span style={{ color: "#8E8E93" }}>{money(x.amount)}</span>
              </div>
              <Bar fraction={x.amount / methodMax} color={METHOD_COLORS[x.label] || "#8E8E93"} />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-col" style={{ ...cardStyle, padding: 12, gap: 12 }}>
        <p style={{ fontSize: 17, fontWeight: 700 }}>En qué se va el dinero</p>
        {r.ranking.length === 0 || rankTotal <= 0 ? <Empty>Sin gastos en este período</Empty> : r.ranking.map((x) => (
          <div key={x.label} className="flex flex-col" style={{ gap: 4 }}>
            <div className="flex items-center justify-between">
              <span style={{ fontSize: 15, fontWeight: 600 }}>{x.label}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#8E8E93" }}>{money(x.amount)} · {((x.amount / rankTotal) * 100).toFixed(0)}%</span>
            </div>
            <Bar fraction={x.amount / rankTotal} color={FP.sale} height={8} />
          </div>
        ))}
      </div>
      <div className="flex flex-col" style={{ ...cardStyle, padding: 12, gap: 10 }}>
        <div className="flex items-center gap-2">
          <span className="flex-1" style={{ fontSize: 17, fontWeight: 700 }}>Comparar meses</span>
          <Segmented options={[[false, "6 meses"], [true, "Este año"]]} value={r.thisYear} onChange={r.setThisYear} style={{ width: 180 }} />
        </div>
        <div className="flex items-center" style={{ fontSize: 9, fontWeight: 600, color: "#8E8E93" }}>
          <span className="flex-1">MES</span><span style={{ width: 78, textAlign: "right" }}>ENTRÓ</span><span style={{ width: 78, textAlign: "right" }}>SALIÓ</span><span style={{ width: 78, textAlign: "right" }}>NETO</span>
        </div>
        {months.map((m) => {
          const isBest = best !== null && m.neto === best && m.neto > 0;
          const isWorst = worst !== null && m.neto === worst && m.neto < 0 && !isBest;
          return (
            <div key={m.key} className="flex items-center" style={{ padding: "2px 4px", borderRadius: 8, background: isBest ? tint(FP.entra, 0.1) : isWorst ? tint(FP.sale, 0.1) : "transparent" }}>
              <span className="flex-1 flex items-center gap-1" style={{ fontSize: 15, fontWeight: m.isCurrent ? 700 : 400, color: m.isCurrent ? "#fff" : "#8E8E93" }}>
                {isBest && <Crown className="w-3 h-3" style={{ color: FP.entra }} />}
                {isWorst && <DownCircle className="w-3 h-3" style={{ color: FP.sale }} />}
                {m.label}
              </span>
              <span className="truncate" style={{ width: 78, textAlign: "right", fontSize: 12, color: "#8E8E93" }}>{money(m.entro)}</span>
              <span className="truncate" style={{ width: 78, textAlign: "right", fontSize: 12, color: "#8E8E93" }}>{money(m.salio)}</span>
              <span className="truncate" style={{ width: 78, textAlign: "right", fontSize: 12, fontWeight: 700, color: m.neto >= 0 ? FP.entra : FP.sale }}>{money(m.neto)}</span>
            </div>
          );
        })}
        <div style={{ height: 0.5, background: "rgba(84,84,88,0.6)" }} />
        <div className="flex justify-between">
          <div><p style={{ fontSize: 9, fontWeight: 600, color: "#8E8E93" }}>PROMEDIO NETO</p><p style={{ fontSize: 15, fontWeight: 700, color: avg >= 0 ? FP.entra : FP.sale }}>{money(avg)}</p></div>
          <div className="text-right"><p style={{ fontSize: 9, fontWeight: 600, color: "#8E8E93" }}>TOTAL DEL PERÍODO</p><p style={{ fontSize: 15, fontWeight: 700, color: totalNet >= 0 ? FP.entra : FP.sale }}>{money(totalNet)}</p></div>
        </div>
      </div>
      <div style={{ ...cardStyle, padding: 12 }}>
        <p style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Neto por mes</p>
        {months.every((m) => m.neto === 0) ? <Empty>Sin datos para graficar</Empty> : <NetBarChart months={months} />}
      </div>
      <ActionCard Icon={PieChart} title="Rentabilidad real" subtitle="Utilidad bruta por dispositivo y técnico" color={FP.brand} onClick={() => onOpenModule("rentabilidad")} />
      <ActionCard Icon={UserCheck} title="Desempeño por técnico" subtitle="Días promedio, entregas a tiempo, reseñas" color={FP.brand} onClick={() => onOpenModule("tecnicos")} />
      <ActionCard Icon={TrendingUp} title="Pronóstico de ingresos" subtitle="Proyección de las próximas 4 semanas" color={FP.brand} onClick={() => onOpenModule("pronostico")} />
      <ActionCard Icon={List} title="Ventas manuales por cajero" subtitle="Qué % de las ventas no está ligado al catálogo" color={FP.warning} onClick={() => onOpenModule("ventasManuales")} />
      <ActionCard Icon={Inbox} title="Historial de cuadres de caja" subtitle="Diferencias por cierre y quién cerró cada uno" color={FP.warning} onClick={() => onOpenModule("cuadres")} />
      {r.projection && (
        <div className="flex flex-col" style={{ padding: 12, borderRadius: 16, background: FP.cheque, color: "#fff", gap: 6 }}>
          <p className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 700 }}><TrendingUp className="w-5 h-5" /> Proyección fin de mes</p>
          <p style={{ fontSize: 15, opacity: 0.9 }}>Vas {r.periodNeto >= 0 ? "+" : ""}{money(r.periodNeto)} en {r.projection.elapsedDays} {r.projection.elapsedDays === 1 ? "día" : "días"}.</p>
          <p style={{ fontSize: 20, fontWeight: 700 }}>Al ritmo actual, cierras el mes en ~{money(r.projection.projectedNet)}.</p>
        </div>
      )}
      <ActionCard Icon={FileText} title="Reporte para Hacienda (SURI)" subtitle="Generar PDF del mes, IVU y exportar CSV" color={FP.brand} onClick={onOpenMonthly} />
      <DayPickerDialog open={dayPicker} value={r.selectedDayStr} onClose={() => setDayPicker(false)} onApply={r.setSelectedDayStr} />
      <CustomRangeDialog open={custom} from={r.customFromStr} to={r.customToStr} onClose={() => setCustom(false)} onApply={r.applyCustom} />
    </div>
  );
}
