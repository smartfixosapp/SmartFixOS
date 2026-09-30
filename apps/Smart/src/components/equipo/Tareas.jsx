import { useEffect, useMemo, useState } from "react";
import { Loader2, Sun, Moon, Trash2, GripVertical, CheckCircle2, CreditCard, Lightbulb, Package, CircleDollarSign, Power, Lock, Key, Video, Droplet, Fan, Brush, Thermometer, Wifi, Volume2, Wrench, Send, FileText, Calendar, Check, Circle } from "lucide-react";
import { tint } from "@/components/pos/native/posUi";
import { Banner, W } from "@/components/wizard/ui";
import { saveShiftTasks } from "@/lib/teamApi";
import { shiftTasks, isShiftTaskDone, setShiftTaskDone, shiftDayKey } from "@/lib/punchApi";
import { safeTZ } from "@/lib/finance/tz";

const BRAND = "#F2662E";
const GREEN = "#4DC780";
const RED = "#FF7373";

export const TASK_ICONS = {
  "checkmark.circle.fill": CheckCircle2, "creditcard.fill": CreditCard, "lightbulb.fill": Lightbulb, "shippingbox.fill": Package, "dollarsign.circle.fill": CircleDollarSign, power: Power, "lock.fill": Lock,
  "key.fill": Key, "video.fill": Video, "drop.fill": Droplet, "fan.fill": Fan, "trash.fill": Trash2, "broom.fill": Brush, thermometer: Thermometer, wifi: Wifi, "speaker.wave.3.fill": Volume2,
  "wrench.adjustable.fill": Wrench, "paperplane.fill": Send, "doc.text.fill": FileText,
};

const DEFAULTS = {
  opening: [{ label: "Verificar caja registradora", icon: "creditcard.fill" }, { label: "Encender luces y rótulos", icon: "lightbulb.fill" }, { label: "Revisar inventario crítico", icon: "shippingbox.fill" }],
  closing: [{ label: "Contar efectivo en caja", icon: "dollarsign.circle.fill" }, { label: "Apagar equipos y luces", icon: "power" }, { label: "Asegurar puertas y rejas", icon: "lock.fill" }],
};

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().toUpperCase() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function TareasConfig({ tenant, tenantId, onSaved }) {
  const current = tenant?.settings?.shift_tasks;
  const init = (k) => (Array.isArray(current?.[k]) ? current[k].filter((t) => t && t.id && t.label).map((t) => ({ id: t.id, label: t.label, icon: t.icon || "checkmark.circle.fill" })) : []);
  const [phase, setPhase] = useState("opening");
  const [draft, setDraft] = useState({ opening: init("opening"), closing: init("closing") });
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("checkmark.circle.fill");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);

  useEffect(() => { setDraft({ opening: init("opening"), closing: init("closing") }); }, [tenant?.id]);

  const list = draft[phase];
  const name = phase === "opening" ? "Apertura" : "Cierre";
  const color = phase === "opening" ? BRAND : "#66B3FF";
  const Preview = TASK_ICONS[icon] || CheckCircle2;

  const add = () => { const t = label.trim(); if (!t) return; setDraft((p) => ({ ...p, [phase]: [...p[phase], { id: uid(), label: t, icon }] })); setLabel(""); setSaved(false); };
  const remove = (id) => { setDraft((p) => ({ ...p, [phase]: p[phase].filter((t) => t.id !== id) })); setSaved(false); };
  const move = (from, to) => { if (from === null || from === to) return; setDraft((p) => { const arr = [...p[phase]]; const [x] = arr.splice(from, 1); arr.splice(to, 0, x); return { ...p, [phase]: arr }; }); setSaved(false); };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const empty = !draft.opening.length && !draft.closing.length;
      const settings = await saveShiftTasks(tenantId, empty ? null : { opening: draft.opening, closing: draft.closing });
      onSaved?.(settings); setSaved(true);
    } catch (e) { setError(`No se pudo guardar: ${e?.message || e}`); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col" style={{ gap: 14, maxWidth: 640 }}>
      <div className="grid grid-cols-2" style={{ padding: 2, gap: 2, borderRadius: 9, background: "rgba(118,118,128,0.24)" }}>
        {[["opening", "Apertura", Sun, BRAND], ["closing", "Cierre", Moon, "#66B3FF"]].map(([k, l, Icon, c]) => <button key={k} onClick={() => setPhase(k)} className="flex items-center justify-center gap-2" style={{ padding: "9px 0", borderRadius: 7, fontSize: 14, fontWeight: 600, background: phase === k ? "#636366" : "transparent" }}><Icon className="w-4 h-4" style={{ color: c }} /> {l}</button>)}
      </div>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Tareas de {name} ({list.length})</p>
      <div style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>
        {!list.length ? <p style={{ padding: 18, color: W.sub, fontSize: 14 }}>No hay tareas de {name.toLowerCase()} configuradas.</p> : list.map((t, i) => { const Icon = TASK_ICONS[t.icon] || CheckCircle2; return (
          <div key={t.id} draggable onDragStart={() => setDragIdx(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { move(dragIdx, i); setDragIdx(null); }} className="flex items-center gap-3" style={{ padding: "10px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
            <GripVertical className="w-4 h-4" style={{ color: W.sub, cursor: "grab" }} />
            <span style={{ width: 34, height: 34, borderRadius: 10, background: tint(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" /></span>
            <span className="flex-1" style={{ fontSize: 15 }}>{t.label}</span>
            <button onClick={() => move(i, Math.max(0, i - 1))} disabled={i === 0} aria-label="Subir" style={{ color: W.sub, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
            <button onClick={() => move(i, Math.min(list.length - 1, i + 1))} disabled={i === list.length - 1} aria-label="Bajar" style={{ color: W.sub, opacity: i === list.length - 1 ? 0.3 : 1 }}>↓</button>
            <button onClick={() => remove(t.id)} aria-label={`Borrar ${t.label}`} style={{ color: RED }}><Trash2 className="w-4 h-4" /></button>
          </div>); })}
      </div>
      <p style={{ fontSize: 12, color: W.sub }}>Arrastra para reordenar · Usa la papelera para borrar</p>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Nueva tarea de {name.toLowerCase()}</p>
      <div style={{ borderRadius: 16, background: "#1C1C1E", padding: 14 }} className="flex flex-col">
        <div className="flex items-center gap-3">
          <span style={{ width: 40, height: 40, borderRadius: 12, background: tint(color, 0.16), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Preview className="w-5 h-5" /></span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Ej: Contar efectivo, encender pantallas..." aria-label="Nueva tarea" className="flex-1 outline-none" style={{ background: "#2C2C2E", color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 15, minWidth: 0 }} />
        </div>
        <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
          {Object.entries(TASK_ICONS).map(([k, Icon]) => <button key={k} onClick={() => setIcon(k)} aria-label={k} aria-pressed={icon === k} style={{ width: 38, height: 38, borderRadius: 10, background: icon === k ? tint(color, 0.3) : "#2C2C2E", color: icon === k ? color : W.sub, border: `1px solid ${icon === k ? color : "transparent"}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-4 h-4" /></button>)}
        </div>
        <button onClick={add} disabled={!label.trim()} className="apple-press disabled:opacity-40" style={{ marginTop: 12, padding: "11px 0", borderRadius: 12, background: color, color: "#fff", fontWeight: 700 }}>Agregar tarea</button>
      </div>
      {error && <Banner color={RED}>{error}</Banner>}
      {saved && <Banner color={GREEN}>Tareas guardadas</Banner>}
      <button onClick={save} disabled={busy} className="apple-press flex items-center justify-center gap-2 disabled:opacity-50" style={{ padding: "13px 0", borderRadius: 14, background: BRAND, color: "#fff", fontWeight: 700, fontSize: 16 }}>{busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando...</> : "Guardar Tareas"}</button>
      <button onClick={() => { setDraft({ opening: DEFAULTS.opening.map((t) => ({ ...t, id: uid() })), closing: DEFAULTS.closing.map((t) => ({ ...t, id: uid() })) }); setSaved(false); }} className="apple-press" style={{ color: BRAND, fontWeight: 600, fontSize: 14 }}>Cargar plantillas sugeridas</button>
    </div>
  );
}


export function HistorialHoy({ tenant, tenantId, employeeName }) {
  const tz = safeTZ(tenant?.timezone);
  const [tick, setTick] = useState(0);
  const sets = useMemo(() => ({ opening: shiftTasks(tenant, "opening"), closing: shiftTasks(tenant, "closing") }), [tenant]);
  const read = (kind, id) => { try { const raw = localStorage.getItem(`shiftCompletion.${tenantId}_${shiftDayKey(tz)}_${kind}_${id}`); return raw ? JSON.parse(raw) : null; } catch { return null; } };
  const all = [...sets.opening, ...sets.closing];
  const done = [...sets.opening.map((t) => ["opening", t]), ...sets.closing.map((t) => ["closing", t])].filter(([k, t]) => isShiftTaskDone(tenantId, tz, k, t.id)).length;
  const pct = all.length ? done / all.length : 0;
  const pillColor = pct >= 1 ? GREEN : pct >= 0.5 ? BRAND : RED;
  const dateText = new Intl.DateTimeFormat("es-PR", { timeZone: tz, weekday: "long", day: "numeric", month: "short", year: "numeric" }).format(new Date()).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  if (!all.length) return <div className="text-center" style={{ padding: 40, color: W.sub }}><b style={{ color: "#fff" }}>Sin tareas configuradas</b><p style={{ fontSize: 13, marginTop: 4 }}>Define las tareas de apertura y cierre en Tareas de Turno para verlas aquí.</p></div>;
  const section = (kind, title, Icon, color) => sets[kind].length ? (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <p className="flex items-center gap-2" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}><Icon className="w-3.5 h-3.5" style={{ color }} /> {title}</p>
      <div style={{ borderRadius: 16, background: "#1C1C1E", overflow: "hidden" }}>
        {sets[kind].map((t, i) => { const c = read(kind, t.id); const TI = TASK_ICONS[t.icon] || CheckCircle2; const on = !!c; return (
          <button key={t.id} onClick={() => { setShiftTaskDone(tenantId, tz, kind, t.id, !on, employeeName); setTick((n) => n + 1); }} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>
            {on ? <Check className="w-5 h-5" style={{ color: GREEN }} strokeWidth={3} /> : <Circle className="w-5 h-5" style={{ color: W.sub }} />}
            <TI className="w-4 h-4" style={{ color }} />
            <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 15, textDecoration: on ? "line-through" : "none", color: on ? W.sub : "#fff" }}>{t.label}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{on ? `Completado por ${c.employeeName || "Empleado"} · ${new Intl.DateTimeFormat("es-PR", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(c.completedAt)).toLowerCase().replace(/\s/g, "")}` : "Pendiente"}</span></span>
          </button>); })}
      </div>
    </div>) : null;
  return (
    <div className="flex flex-col" style={{ gap: 14, maxWidth: 640 }} data-tick={tick}>
      <h2 style={{ fontSize: 26, fontWeight: 800 }}>Historial hoy</h2>
      <div className="flex items-center gap-3"><Calendar className="w-5 h-5" style={{ color: BRAND }} /><span className="flex-1" style={{ fontWeight: 600 }}>{dateText}</span><span style={{ padding: "3px 12px", borderRadius: 999, background: tint(pillColor, 0.16), color: pillColor, fontSize: 13, fontWeight: 800 }}>{done} / {all.length} completas</span></div>
      {section("opening", "Apertura", Sun, BRAND)}
      {section("closing", "Cierre", Moon, "#66B3FF")}
      <p style={{ fontSize: 12, color: W.sub }}>Solo muestra lo completado en este navegador.</p>
    </div>
  );
}
