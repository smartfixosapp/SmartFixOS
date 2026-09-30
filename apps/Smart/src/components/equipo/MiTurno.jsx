import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { W, money } from "@/components/wizard/ui";
import { periodContaining } from "@/lib/finance/payroll";
import { safeTZ } from "@/lib/finance/tz";
import { fetchEmployeeEntries, normalizeSchedule, DAY_LONG } from "@/lib/teamTime";
import { employeeRate } from "@/lib/teamApi";
import { elapsedHours } from "@/lib/punchApi";

const GREEN = "#4DC780";

export default function MiTurno({ tenant, tenantId, self }) {
  const tz = safeTZ(tenant?.timezone);
  const [hours, setHours] = useState(null);
  useEffect(() => {
    if (!self?.id) { setHours(0); return; }
    const p = periodContaining(new Date(), tz);
    fetchEmployeeEntries({ tenantId, employee: self, from: p.start, to: new Date(Date.now() + 60000) }).then((es) => setHours(es.reduce((s, e) => s + elapsedHours(e), 0)), () => setHours(0));
  }, [tenantId, self?.id, tz]);
  const rate = employeeRate(self);
  const s = normalizeSchedule(self?.schedule, rate);
  const active = [2, 3, 4, 5, 6, 7, 1].map((w) => s.days.find((d) => d.weekday === w)).filter((d) => d.enabled);
  const p2 = (n) => String(n).padStart(2, "0");
  return (
    <div className="flex flex-col" style={{ gap: 14, maxWidth: 560 }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Tu pago esta semana</p>
      <div style={{ padding: 14, borderRadius: 16, background: "#1C1C1E" }}>
        {hours === null ? <div className="flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: W.sub }} /></div> : (
          <>
            <div className="flex justify-between" style={{ padding: "6px 0", fontSize: 15 }}><span>Horas trabajadas</span><b>{hours.toFixed(1)} h</b></div>
            <div className="flex justify-between" style={{ padding: "6px 0", fontSize: 15 }}><span>Tarifa</span><b>{rate > 0 ? `${money(rate)}/h` : "—"}</b></div>
            <div className="flex justify-between" style={{ padding: "6px 0", fontSize: 16 }}><span>Pago acumulado</span><b style={{ color: GREEN }}>{money(hours * rate)}</b></div>
          </>
        )}
      </div>
      <p style={{ fontSize: 12, color: W.sub }}>Estimado: no descuenta ponches encimados ni adelantos.</p>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Tu horario</p>
      <div style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>
        {!active.length ? <p style={{ padding: 16, color: W.sub }}>Sin horario asignado</p> : active.map((d, i) => (
          <div key={d.weekday} className="flex justify-between" style={{ padding: "11px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none", fontSize: 15 }}><span style={{ fontWeight: 600 }}>{DAY_LONG[d.weekday - 1]}</span><span>{`${d.startHour}:${p2(d.startMinute)} – ${d.endHour}:${p2(d.endMinute)}`}</span></div>
        ))}
      </div>
    </div>
  );
}
