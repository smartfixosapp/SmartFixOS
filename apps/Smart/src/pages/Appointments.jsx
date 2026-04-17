import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { dataClient } from "@/components/api/dataClient";
import { ChevronLeft, ChevronRight, Plus, X, Clock, Phone, Wrench } from "lucide-react";

/* ─── Helpers ─── */
function startOfWeek(d) {
  const dt = new Date(d);
  const day = dt.getDay(); // 0=dom
  const diff = day === 0 ? -6 : 1 - day; // lunes como inicio
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}
function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt;
}
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit", hour12: true });
}
function fmtDate(d) {
  return d.toLocaleDateString("es-PR", { weekday: "short", month: "short", day: "numeric" });
}
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8am–7pm

/* ─── Componente principal ─── */
export default function Appointments() {
  const navigate     = useNavigate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [appts, setAppts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [selected, setSelected]   = useState(null); // { date, hour }
  const [viewAppt, setViewAppt]   = useState(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const today = new Date();

  useEffect(() => { loadAppts(); }, []);

  const loadAppts = async () => {
    try {
      // Citas son órdenes con status "scheduled" o con campo scheduled_date
      const orders = await dataClient.entities.Order.list("-created_date", 300);
      const citas = (orders || []).filter(o =>
        o.status === "scheduled" || (o.scheduled_date && o.status !== "completed" && o.status !== "cancelled")
      );
      setAppts(citas);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const apptsForDay = (day) =>
    appts.filter(a => a.scheduled_date && isSameDay(new Date(a.scheduled_date), day));

  return (
    <div className="min-h-screen apple-surface apple-type flex flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
      >
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-press">
          <ChevronLeft className="w-4 h-4 apple-label-secondary" />
        </button>
        <div className="text-center">
          <h1 className="apple-text-headline apple-label-primary">Calendario de Citas</h1>
          <p className="apple-text-caption2 apple-label-tertiary">
            {weekStart.toLocaleDateString("es-PR", { month: "long", year: "numeric" })}
          </p>
        </div>
        <button
          onClick={() => { setSelected({ date: today, hour: 10 }); setShowForm(true); }}
          className="w-9 h-9 rounded-apple-sm bg-apple-purple flex items-center justify-center apple-press transition-colors"
        >
          <Plus className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Navegación semana */}
      <div className="flex items-center justify-between px-4 py-2 shrink-0">
        <button onClick={() => setWeekStart(d => addDays(d, -7))}
          className="w-8 h-8 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-press transition-colors">
          <ChevronLeft className="w-4 h-4 apple-label-secondary" />
        </button>
        <p className="apple-text-caption1 apple-label-secondary tabular-nums">
          {fmtDate(weekStart)} — {fmtDate(addDays(weekStart, 6))}
        </p>
        <button onClick={() => setWeekStart(d => addDays(d, 7))}
          className="w-8 h-8 rounded-apple-sm bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-press transition-colors">
          <ChevronRight className="w-4 h-4 apple-label-secondary" />
        </button>
      </div>

      {/* Cabeceras de días */}
      <div
        className="grid grid-cols-8 shrink-0"
        style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
      >
        <div className="py-2" /> {/* columna horas */}
        {days.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} className="py-2 text-center">
              <p className="apple-text-caption2 apple-label-tertiary">
                {d.toLocaleDateString("es-PR", { weekday: "short" })}
              </p>
              <p className={`apple-text-callout leading-none mt-0.5 tabular-nums ${isToday ? "text-apple-purple" : "apple-label-primary"}`}>
                {d.getDate()}
              </p>
              {apptsForDay(d).length > 0 && (
                <div className="flex justify-center mt-0.5 gap-0.5">
                  {apptsForDay(d).slice(0, 3).map((_, j) => (
                    <div key={j} className="w-1 h-1 rounded-full bg-apple-purple" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grid de horas */}
      <div className="flex-1 overflow-y-auto">
        {HOURS.map(hour => (
          <div
            key={hour}
            className="grid grid-cols-8 min-h-[56px]"
            style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
          >
            {/* Etiqueta hora */}
            <div className="flex items-start justify-end pr-2 pt-1">
              <span className="apple-text-caption2 apple-label-secondary tabular-nums">
                {hour % 12 || 12}{hour < 12 ? "am" : "pm"}
              </span>
            </div>
            {/* Celdas por día */}
            {days.map((day, di) => {
              const appt = appts.find(a => {
                if (!a.scheduled_date) return false;
                const d = new Date(a.scheduled_date);
                return isSameDay(d, day) && d.getHours() === hour;
              });
              return (
                <div
                  key={di}
                  onClick={() => appt ? setViewAppt(appt) : (setSelected({ date: day, hour }), setShowForm(true))}
                  className="relative cursor-pointer apple-press transition-colors"
                  style={{ borderLeft: "0.5px solid rgb(var(--separator) / 0.29)" }}
                >
                  {appt && (
                    <div className="absolute inset-x-0.5 top-0.5 rounded-apple-xs bg-apple-purple/15 px-1.5 py-1 overflow-hidden">
                      <p className="apple-text-caption2 text-apple-purple leading-tight truncate">{appt.customer_name}</p>
                      <p className="apple-text-caption2 apple-label-secondary leading-tight truncate">{appt.device_brand} {appt.device_model}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Modal ver cita */}
      {viewAppt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setViewAppt(null)}>
          <div className="w-full max-w-sm rounded-apple-lg apple-surface-elevated p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="apple-text-headline apple-label-primary">Detalle de Cita</h3>
              <button onClick={() => setViewAppt(null)}
                className="w-7 h-7 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-press">
                <X className="w-3.5 h-3.5 apple-label-secondary" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                [<Clock className="w-3.5 h-3.5" />, fmtTime(viewAppt.scheduled_date)],
                [<span>👤</span>, viewAppt.customer_name],
                [<Phone className="w-3.5 h-3.5" />, viewAppt.customer_phone || "—"],
                [<Wrench className="w-3.5 h-3.5" />, `${viewAppt.device_brand || ""} ${viewAppt.device_model || ""}`.trim() || "—"],
              ].map(([icon, val], i) => (
                <div key={i} className="flex items-center gap-3 apple-text-subheadline apple-label-primary">
                  <span className="apple-label-tertiary shrink-0">{icon}</span>
                  <span className="tabular-nums">{val}</span>
                </div>
              ))}
              {viewAppt.initial_problem && (
                <p
                  className="apple-text-footnote apple-label-secondary leading-relaxed pt-3"
                  style={{ borderTop: "0.5px solid rgb(var(--separator) / 0.29)" }}
                >
                  {viewAppt.initial_problem}
                </p>
              )}
            </div>
            <button
              onClick={() => { navigate(`/Orders?openOrderId=${viewAppt.id}`); setViewAppt(null); }}
              className="apple-btn apple-btn-primary apple-press w-full">
              Ver orden completa
            </button>
          </div>
        </div>
      )}

      {/* Modal crear cita */}
      {showForm && <NewAppointmentForm
        defaultDate={selected?.date}
        defaultHour={selected?.hour}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); loadAppts(); }}
      />}
    </div>
  );
}

/* ─── Formulario nueva cita ─── */
function NewAppointmentForm({ defaultDate, defaultHour, onClose, onSaved }) {
  const [form, setForm] = useState({
    customer_name:  "",
    customer_phone: "",
    device_brand:   "",
    device_model:   "",
    initial_problem:"",
    scheduled_date: (() => {
      const d = defaultDate ? new Date(defaultDate) : new Date();
      d.setHours(defaultHour || 10, 0, 0, 0);
      return d.toISOString().slice(0, 16);
    })(),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const save = async () => {
    if (!form.customer_name.trim()) { setErr("El nombre del cliente es obligatorio."); return; }
    setSaving(true);
    try {
      await dataClient.entities.Order.create({
        ...form,
        status:      "scheduled",
        order_items: [],
      });
      onSaved();
    } catch (e) { setErr(e.message || "Error al guardar."); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-apple-lg apple-surface-elevated p-5 space-y-4"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="apple-text-headline apple-label-primary">Nueva Cita</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-sys6 dark:bg-gray-sys5 flex items-center justify-center apple-press">
            <X className="w-3.5 h-3.5 apple-label-secondary" />
          </button>
        </div>

        <div className="space-y-3">
          {[
            { label: "Fecha y hora", key: "scheduled_date", type: "datetime-local" },
            { label: "Cliente *",    key: "customer_name",  type: "text", placeholder: "Nombre completo" },
            { label: "Teléfono",     key: "customer_phone", type: "tel",  placeholder: "787-000-0000" },
            { label: "Marca",        key: "device_brand",   type: "text", placeholder: "Apple, Samsung…" },
            { label: "Modelo",       key: "device_model",   type: "text", placeholder: "iPhone 14, Galaxy S24…" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="apple-text-caption1 apple-label-secondary">{label}</label>
              <input
                type={type}
                placeholder={placeholder}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="apple-input w-full"
              />
            </div>
          ))}
          <div className="space-y-1">
            <label className="apple-text-caption1 apple-label-secondary">Motivo / Problema</label>
            <textarea
              rows={2}
              placeholder="Descripción breve del motivo de la cita…"
              value={form.initial_problem}
              onChange={e => setForm(f => ({ ...f, initial_problem: e.target.value }))}
              className="apple-input w-full resize-none"
            />
          </div>
        </div>

        {err && <p className="apple-text-footnote text-apple-red">{err}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="apple-btn apple-btn-primary apple-press w-full disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Agendar Cita"}
        </button>
      </div>
    </div>
  );
}
