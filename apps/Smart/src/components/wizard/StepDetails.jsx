import { useEffect, useState } from "react";
import { Check, X, Minus, Droplets, Lock, UserRound, Loader2, Info, Undo2, Eraser, ShieldAlert, Power, Smartphone, Hand, Volume2, Mic, Camera, MousePointerClick, Wifi, Bluetooth, Zap, BatteryMedium, Cable } from "lucide-react";
import { tint } from "@/components/pos/native/posUi";
import { loadTechnicians, normalizedRoles } from "@/lib/wizard/api";
import { IOS, LIQUID_ADVISORY } from "@/lib/wizard/helpers";
import { Avatar, Caption, Card, Input, TextArea, W } from "./ui";

const ITEM_ICON = { power: Power, screen: Smartphone, touch: Hand, speakers: Volume2, microphone: Mic, camera_front: Camera, camera_back: Camera, buttons: MousePointerClick, wifi: Wifi, bluetooth: Bluetooth, charging: Zap, battery: BatteryMedium, ports: Cable };
const STATUS_COLOR = { ok: IOS.green, damaged: IOS.red, not_tested: W.sub };

function PatternPad({ value, onChange }) {
  const seq = value || [];
  const toggle = (n) => { if (!seq.includes(n) && seq.length < 9) onChange([...seq, n]); };
  const pos = (n) => ({ x: ((n - 1) % 3) * 80 + 30, y: Math.floor((n - 1) / 3) * 80 + 30 });
  return (
    <div className="flex flex-col items-center" style={{ gap: 8 }}>
      <p style={{ fontSize: 12, color: W.sub }}>Toca los puntos en orden para registrar el patrón</p>
      <svg width="220" height="220" viewBox="0 0 220 220" style={{ background: W.card2, borderRadius: 16 }} role="group" aria-label="Patrón de bloqueo">
        {seq.slice(1).map((n, i) => { const a = pos(seq[i]); const b = pos(n); return <line key={`${seq[i]}-${n}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={IOS.red} strokeWidth="4" strokeLinecap="round" />; })}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => { const p = pos(n); const on = seq.includes(n); return (
          <g key={n} onClick={() => toggle(n)} style={{ cursor: "pointer" }} role="button" aria-label={`Punto ${n}`}>
            <circle cx={p.x} cy={p.y} r="22" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={on ? 11 : 7} fill={on ? IOS.red : "#636366"} />
            {on && <text x={p.x} y={p.y + 4} textAnchor="middle" fontSize="11" fill="#fff" fontWeight="700">{seq.indexOf(n) + 1}</text>}
          </g>
        ); })}
      </svg>
      {seq.length > 0 && <p style={{ fontSize: 13, fontWeight: 600 }}>Patrón: {seq.join("→")}</p>}
      <div className="flex" style={{ gap: 14 }}>
        <button onClick={() => onChange(seq.slice(0, -1))} disabled={!seq.length} className="flex items-center gap-1 disabled:opacity-40" style={{ fontSize: 13, color: IOS.orange }}><Undo2 className="w-3.5 h-3.5" /> Deshacer</button>
        <button onClick={() => onChange([])} disabled={!seq.length} className="flex items-center gap-1 disabled:opacity-40" style={{ fontSize: 13, color: IOS.red }}><Eraser className="w-3.5 h-3.5" /> Limpiar</button>
      </div>
    </div>
  );
}

const ROLE_COLOR = { owner: IOS.purple, admin: IOS.purple, manager: IOS.indigo, cashier: IOS.blue };

export default function StepDetails({ w, tenantId, currentEmployee }) {
  const { s, set } = w;
  const [techs, setTechs] = useState({ loading: true, employees: [], counts: {}, error: null });
  const [patternOpen, setPatternOpen] = useState(false);
  const setSec = (patch) => set((p) => ({ security: { ...p.security, ...patch } }));

  useEffect(() => {
    let alive = true;
    loadTechnicians(tenantId).then((r) => {
      if (!alive) return;
      setTechs({ loading: false, ...r, error: null });
      const st = w.ref.current;
      if (!st.employee && !st.employeeTouched) {
        const cur = currentEmployee;
        let pick = r.employees.find((e) => cur?.id && e.id === cur.id) || r.employees.find((e) => cur?.full_name && e.full_name === cur.full_name) || (r.employees.length === 1 ? r.employees[0] : null);
        if (pick) set({ employee: pick, employeeAuto: true });
      }
    }, (e) => { if (alive) setTechs({ loading: false, employees: [], counts: {}, error: e?.message || String(e) }); });
    return () => { alive = false; };
  }, [tenantId]);

  const ok = s.checklist.filter((c) => c.status === "ok").length;
  const bad = s.checklist.filter((c) => c.status === "damaged").length;
  const untested = s.checklist.filter((c) => c.status === "not_tested").length;
  const setStatus = (id, status) => set((p) => ({ checklist: p.checklist.map((c) => (c.id === id ? { ...c, status } : c)) }));
  const markAll = () => set((p) => ({ checklist: p.checklist.map((c) => (c.status === "not_tested" ? { ...c, status: "ok" } : c)) }));
  const stat = (n, label, color) => <div className="flex-1 flex flex-col items-center" style={{ gap: 2, padding: "12px 0", borderRadius: 14, background: tint(color, 0.1) }}><span style={{ fontSize: 22, fontWeight: 800, color }}>{n}</span><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", color: W.sub }}>{label}</span></div>;
  const indicator = (key, label) => (
    <button key={key} onClick={() => set((p) => ({ [key]: !p[key] }))} className="apple-press flex items-center gap-1.5" style={{ padding: "7px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, background: s[key] ? tint(IOS.blue, 0.25) : "#3A3A3C", color: s[key] ? IOS.blue : "#fff" }}>{s[key] && <Check className="w-3.5 h-3.5" />} {label}</button>
  );
  const imeiDigits = String(s.security.device_imei || "").replace(/\D/g, "");

  return (
    <div className="mx-auto flex flex-col" style={{ gap: 18, maxWidth: 860 }}>
      <div><p style={{ fontSize: 18, fontWeight: 700 }}>Detalles de recepción</p><p style={{ fontSize: 14, color: W.sub }}>Checklist, seguridad y asignación en un solo lugar</p></div>
      <div className="flex" style={{ gap: 10 }}>{stat(ok, "FUNCIONAN", IOS.green)}{stat(bad, "DAÑADOS", IOS.red)}{stat(untested, "NO PROBADOS", W.sub)}</div>
      <Card style={{ padding: 14, border: s.liquidDamage ? `1px solid ${IOS.blue}` : "1px solid transparent" }}>
        <button onClick={() => set((p) => ({ liquidDamage: !p.liquidDamage }))} className="w-full flex items-center gap-3 text-left" aria-pressed={s.liquidDamage}>
          <span style={{ width: 34, height: 34, borderRadius: 999, background: tint(IOS.blue, 0.18), color: IOS.blue, display: "flex", alignItems: "center", justifyContent: "center" }}><Droplets className="w-4 h-4" /></span>
          <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Daño por agua o líquido</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{s.liquidDamage ? "Activado — se documenta y se avisa al cliente" : "El equipo llegó mojado o con indicios de líquido"}</span></span>
          <span style={{ width: 51, height: 31, borderRadius: 999, background: s.liquidDamage ? IOS.blue : "#3A3A3C", position: "relative" }}><span style={{ position: "absolute", top: 2, left: s.liquidDamage ? 22 : 2, width: 27, height: 27, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></span>
        </button>
        {s.liquidDamage && (
          <div className="flex flex-col" style={{ gap: 10, marginTop: 12 }}>
            <Caption>Qué se ve al recibirlo</Caption>
            <div className="flex flex-wrap" style={{ gap: 8 }}>{indicator("liquidCorrosion", "Corrosión visible")}{indicator("liquidHumidity", "Indicador de humedad activado")}{indicator("liquidDried", "Cliente dice que lo secó")}</div>
            <p className="flex items-start gap-2" style={{ padding: 10, borderRadius: 10, background: tint(IOS.orange, 0.12), color: IOS.orange, fontSize: 12 }}><ShieldAlert className="w-4 h-4 flex-shrink-0" /> {LIQUID_ADVISORY}</p>
          </div>
        )}
      </Card>
      <button onClick={markAll} disabled={untested === 0} className="apple-press self-start disabled:opacity-40" style={{ padding: "9px 16px", borderRadius: 12, background: tint(IOS.green, 0.15), color: IOS.green, fontSize: 14, fontWeight: 700 }}>Marcar todos como funcionan</button>
      <div className="grid" style={{ gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        {s.checklist.map((c) => {
          const Icon = ITEM_ICON[c.id] || Check;
          const color = STATUS_COLOR[c.status];
          return (
            <div key={c.id} className="flex items-center gap-3" style={{ padding: 12, borderRadius: 14, background: W.card, border: `1px solid ${c.status === "not_tested" ? "transparent" : tint(color, 0.5)}` }}>
              <span style={{ width: 32, height: 32, borderRadius: 9, background: tint(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" /></span>
              <span className="flex-1" style={{ fontSize: 15, fontWeight: 600 }}>{c.label}</span>
              <span className="flex" style={{ gap: 4 }}>
                {[["ok", Check, IOS.green, "Funciona"], ["damaged", X, IOS.red, "Dañado"], ["not_tested", Minus, W.sub, "No probado"]].map(([k, I, col, label]) => (
                  <button key={k} onClick={() => setStatus(c.id, k)} aria-label={`${c.label}: ${label}`} aria-pressed={c.status === k} style={{ width: 34, height: 30, borderRadius: 8, background: c.status === k ? col : "#3A3A3C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><I className="w-4 h-4" strokeWidth={3} /></button>
                ))}
              </span>
            </div>
          );
        })}
      </div>
      <p className="flex items-start gap-2" style={{ padding: 12, borderRadius: 12, background: tint(IOS.blue, 0.1), fontSize: 13 }}><Info className="w-4 h-4 flex-shrink-0" style={{ color: IOS.blue }} /> <span><b>¿Para qué sirve este paso?</b><br />Documenta el estado del equipo antes de tocarlo. Aparece en el recibo y en el correo al cliente — útil para evitar disputas.</span></p>

      <p className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: W.sub, paddingTop: 8 }}><Lock className="w-3.5 h-3.5" style={{ color: IOS.red }} /> SEGURIDAD</p>
      <div className="grid" style={{ gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <Card style={{ padding: 14 }}><Input label="PIN" value={s.security.device_pin} onChange={(v) => setSec({ device_pin: v })} placeholder="Ingresa PIN…" type="password" inputMode="numeric" /><p style={{ fontSize: 11, color: W.sub, marginTop: 6 }}>Código numérico del bloqueo · 4–6 dígitos numéricos</p></Card>
        <Card style={{ padding: 14 }}><Input label="Contraseña" value={s.security.device_password} onChange={(v) => setSec({ device_password: v })} placeholder="Ingresa contraseña…" type="password" /><p style={{ fontSize: 11, color: W.sub, marginTop: 6 }}>Para usuarios con contraseña en vez de PIN</p></Card>
        <Card style={{ padding: 14 }}>
          <p style={{ fontSize: 15, fontWeight: 600 }}>Patrón de bloqueo</p><p style={{ fontSize: 12, color: W.sub, marginBottom: 8 }}>Android · 3×3</p>
          <button onClick={() => setPatternOpen((v) => !v)} className="apple-press" style={{ padding: "9px 14px", borderRadius: 12, background: tint(IOS.red, 0.15), color: IOS.red, fontSize: 14, fontWeight: 600 }}>{s.security.pattern_vector?.length ? "Patrón configurado · toca para editar" : "Configurar Patrón"}</button>
          {patternOpen && <div style={{ marginTop: 12 }}><PatternPad value={s.security.pattern_vector} onChange={(v) => setSec({ pattern_vector: v })} /></div>}
        </Card>
        <Card style={{ padding: 14 }}>
          <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>IMEI / Serial</p>
          <div className="flex flex-col" style={{ gap: 10 }}>
            <Input value={s.security.device_imei} onChange={(v) => setSec({ device_imei: v })} placeholder="IMEI (15 dígitos · marca *#06#)" inputMode="numeric" mono />
            <Input value={s.security.device_serial} onChange={(v) => setSec({ device_serial: v })} placeholder="Serial / S/N" mono />
            {imeiDigits.length >= 14 && (
              <>
                <a href={`https://swappa.com/esn/check/${imeiDigits}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: IOS.blue }}>Verificar si está reportado robado</a>
                <div className="grid grid-cols-3" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
                  {[["", "Sin revisar"], ["clean", "Limpio"], ["reported", "Reportado"]].map(([k, l]) => <button key={l} onClick={() => setSec({ imei_check_result: k })} style={{ padding: "6px 0", borderRadius: 7, fontSize: 12, fontWeight: 600, background: (s.security.imei_check_result || "") === k ? "#636366" : "transparent" }}>{l}</button>)}
                </div>
                {s.security.imei_check_result === "reported" && <p style={{ fontSize: 12, color: IOS.red }}>Equipo reportado — evalúa si continuar con la reparación.</p>}
              </>
            )}
          </div>
        </Card>
      </div>
      <Card style={{ padding: 14 }}><TextArea label="Notas de seguridad" value={s.security.notes} onChange={(v) => setSec({ notes: v })} placeholder="Cuenta Google, observaciones, accesorios faltantes…" rows={3} /></Card>

      <p className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", color: W.sub, paddingTop: 8 }}><UserRound className="w-3.5 h-3.5" style={{ color: IOS.teal }} /> TÉCNICO</p>
      <div className="flex flex-wrap" style={{ gap: 12 }}>
        <button onClick={() => set({ employee: null, employeeAuto: false, employeeTouched: true })} className="apple-press flex items-center gap-3 text-left flex-1" style={{ minWidth: 240, padding: 14, borderRadius: 14, background: !s.employee ? tint(IOS.orange, 0.12) : W.card, border: `1px solid ${!s.employee ? tint(IOS.orange, 0.5) : "transparent"}` }}>
          <span className="flex-1"><span className="block" style={{ fontSize: 15, fontWeight: 600 }}>Asignar después</span><span className="block" style={{ fontSize: 12, color: W.sub }}>La orden entra a la cola sin técnico asignado</span></span>
          {!s.employee && <Check className="w-5 h-5" style={{ color: IOS.orange }} />}
        </button>
        <p className="flex items-start gap-2 flex-1" style={{ minWidth: 240, padding: 12, borderRadius: 12, background: tint(IOS.blue, 0.1), fontSize: 12 }}><Info className="w-4 h-4 flex-shrink-0" style={{ color: IOS.blue }} /> Saltar este paso deja la orden en la cola sin asignar. El dispatcher la puede asignar después desde el detalle.</p>
      </div>
      <div className="flex items-center gap-2"><Caption>Empleados activos</Caption><span style={{ padding: "1px 8px", borderRadius: 999, background: "#3A3A3C", fontSize: 11, fontWeight: 700 }}>{techs.employees.length}</span></div>
      {techs.loading ? <p className="flex items-center gap-2" style={{ fontSize: 14, color: W.sub }}><Loader2 className="w-4 h-4 animate-spin" /> Cargando empleados…</p>
        : techs.error ? <p style={{ fontSize: 14, color: IOS.red }}>No se pudieron cargar los empleados: {techs.error}</p>
          : techs.employees.length === 0 ? <div className="text-center" style={{ padding: 16 }}><p style={{ fontSize: 15, fontWeight: 600, color: W.sub }}>Sin empleados activos</p><p style={{ fontSize: 13, color: W.ter }}>Agrega empleados desde Ajustes → Empleados.</p></div>
            : (
              <div className="grid" style={{ gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                {techs.employees.map((e) => {
                  const on = s.employee?.id === e.id;
                  const role = String(e.role || normalizedRoles(e)[0] || "technician");
                  const n = techs.counts[e.id] || 0;
                  return (
                    <button key={e.id} onClick={() => set({ employee: e, employeeAuto: false, employeeTouched: true })} className="apple-press flex items-center gap-3 text-left" style={{ padding: 12, borderRadius: 14, background: on ? tint(IOS.teal, 0.1) : W.card, border: `1px solid ${on ? IOS.teal : "transparent"}` }}>
                      <Avatar name={e.full_name} color={ROLE_COLOR[role.toLowerCase()] || IOS.teal} />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-1.5"><span className="truncate" style={{ fontSize: 15, fontWeight: 600 }}>{e.full_name}</span>{on && s.employeeAuto && <span style={{ padding: "1px 7px", borderRadius: 999, background: tint(IOS.teal, 0.2), color: IOS.teal, fontSize: 10, fontWeight: 700 }}>Auto</span>}</span>
                        <span className="block" style={{ fontSize: 12, color: W.sub }}>{role.charAt(0).toUpperCase() + role.slice(1)} · {n} activa{n === 1 ? "" : "s"}</span>
                      </span>
                      {on && <Check className="w-5 h-5" style={{ color: IOS.teal }} />}
                    </button>
                  );
                })}
              </div>
            )}
    </div>
  );
}
