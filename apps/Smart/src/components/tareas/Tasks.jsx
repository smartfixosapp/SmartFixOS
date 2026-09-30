import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, X, Search, Wrench, CheckCircle2, Trash2, Pencil, CalendarClock, User, DollarSign, Bell } from "lucide-react";
import { Dialog, TextAction, AlertDialog, tint } from "@/components/pos/native/posUi";
import { Banner, W, money } from "@/components/wizard/ui";
import { fetchEmployees, isActive } from "@/lib/teamApi";
import { createTask, updateTask, completeTask, deleteTask, fetchOrderTasks, fetchAllOrdersForPicker, linkedOrdersOf, dueLabel, isOverdue, OFFSETS, num } from "@/lib/tasksApi";

const BRAND = "#F2662E";
const GOLD = "#FFC733";
const RED = "#FF7373";
const GREEN = "#4DC780";

const toInput = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}T${String(x.getHours()).padStart(2, "0")}:${String(x.getMinutes()).padStart(2, "0")}`; };

function Toggle({ on, onChange, label, disabled }) {
  return <button onClick={() => !disabled && onChange(!on)} role="switch" aria-checked={on} aria-label={label} disabled={disabled} style={{ width: 46, height: 28, borderRadius: 999, background: on ? GREEN : "#3A3A3C", position: "relative", flexShrink: 0, opacity: disabled ? 0.4 : 1 }}><span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 24, height: 24, borderRadius: 999, background: "#fff", transition: "left 0.2s" }} /></button>;
}

function Group({ title, footer, children }) {
  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>{title}</p>
      <div style={{ borderRadius: 14, background: "#2C2C2E", padding: 12 }} className="flex flex-col gap-3">{children}</div>
      {footer && <p style={{ fontSize: 12, color: W.sub }}>{footer}</p>}
    </div>
  );
}

function OrderPickerAll({ open, tenantId, onPick, onClose }) {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { if (open) { setRows(null); setQ(""); fetchAllOrdersForPicker(tenantId).then(setRows, () => setRows([])); } }, [open, tenantId]);
  const list = (rows || []).filter((o) => { const s = q.trim().toLowerCase(); return !s || [o.customer_name, o.order_number, o.device_model, o.device_family, o.device_brand].some((v) => String(v || "").toLowerCase().includes(s)); });
  return (
    <Dialog open={open} onClose={onClose} title="Vincular a orden" width={480} height="80dvh" leading={<span />} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
      <div className="flex flex-col" style={{ gap: 10, paddingTop: 6 }}>
        <label className="flex items-center gap-2" style={{ height: 42, padding: "0 12px", borderRadius: 12, background: "#2C2C2E" }}><Search className="w-4 h-4" style={{ color: W.sub }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cliente, # de orden, dispositivo…" className="flex-1 bg-transparent outline-none" style={{ color: "#fff", fontSize: 15, minWidth: 0 }} /></label>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.06em", color: W.sub, textTransform: "uppercase" }}>Todas las órdenes</p>
        {rows === null ? <p className="flex items-center gap-2" style={{ color: W.sub }}><Loader2 className="w-4 h-4 animate-spin" /> Cargando órdenes…</p> : (
          <div style={{ borderRadius: 12, background: "#2C2C2E", overflow: "hidden" }}>
            {list.map((o, i) => <button key={o.id} onClick={() => { onPick(o); onClose(); }} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "10px 12px", borderTop: i ? `0.5px solid ${W.sep}` : "none" }}><Wrench className="w-4 h-4" style={{ color: BRAND }} /><span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 14, fontWeight: 700 }}>{o.order_number}</span><span className="block truncate" style={{ fontSize: 12, color: W.sub }}>{o.customer_name || "—"} · {[o.device_brand, o.device_family, o.device_model].filter(Boolean).join(" ")}</span></span></button>)}
            {!list.length && <p className="text-center" style={{ padding: 20, color: W.sub }}>Sin resultados</p>}
          </div>
        )}
      </div>
    </Dialog>
  );
}

export function TaskFormDialog({ open, task, tenantId, employeeName, prelinked, onClose, onSaved }) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [hasCost, setHasCost] = useState(false);
  const [cost, setCost] = useState("");
  const [assignee, setAssignee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [hasDue, setHasDue] = useState(false);
  const [due, setDue] = useState("");
  const [notify, setNotify] = useState(false);
  const [offset, setOffset] = useState(1800);
  const [orders, setOrders] = useState([]);
  const [pickOpen, setPickOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetchEmployees(tenantId).then((r) => setEmployees(r.filter(isActive)), () => setEmployees([]));
    if (task) {
      setTitle(task.title || ""); setNotes(task.notes || ""); setHasCost(num(task.cost) > 0); setCost(num(task.cost) > 0 ? String(task.cost) : "");
      setAssignee(task.assigned_to ? { id: task.assigned_to, full_name: task.assigned_name } : null);
      setHasDue(!!task.due_at); setDue(task.due_at ? toInput(task.due_at) : toInput(Date.now() + 86400000));
      const off = task.due_at && task.notify_at ? Math.round((new Date(task.due_at) - new Date(task.notify_at)) / 1000) : null;
      setNotify(off !== null); setOffset(off === null ? 1800 : OFFSETS.reduce((b, o) => (Math.abs(o[0] - off) < Math.abs(b - off) ? o[0] : b), OFFSETS[0][0]));
      setOrders(linkedOrdersOf(task));
    } else {
      setTitle(""); setNotes(""); setHasCost(false); setCost(""); setAssignee(null); setHasDue(false); setDue(toInput(Date.now() + 86400000)); setNotify(false); setOffset(1800);
      setOrders(prelinked ? [{ id: prelinked.id, order_number: prelinked.order_number, customer_name: prelinked.customer_name }] : []);
    }
  }, [open, task?.id]);

  const save = async () => {
    if (!title.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const keepDue = task?.due_at && due === toInput(task.due_at) ? new Date(task.due_at) : null;
      const f = { title, notes, hasCost, cost, assignee, dueAt: hasDue && due ? (keepDue || new Date(due)) : null, notify: hasDue && notify, offset, orders };
      const saved = task ? await updateTask(task.id, f) : await createTask(tenantId, f, employeeName);
      onSaved?.(saved); onClose();
    } catch (e) { setError(e?.message || String(e)); } finally { setBusy(false); }
  };

  const field = { background: "#1C1C1E", color: "#fff", borderRadius: 12, padding: "12px 14px", fontSize: 16 };
  return (
    <>
      <Dialog open={open} onClose={() => !busy && onClose()} dismissable={!busy} title={task ? "Editar tarea" : "Nueva tarea"} width={500} height="92dvh" leading={<TextAction onClick={onClose} disabled={busy}>Cancelar</TextAction>} trailing={<TextAction bold onClick={save} disabled={!title.trim() || busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}</TextAction>}>
        <div className="flex flex-col" style={{ gap: 14, paddingTop: 8 }}>
          <Group title="Tarea"><textarea value={title} onChange={(e) => setTitle(e.target.value)} rows={2} placeholder="¿Qué tienes que hacer?" aria-label="Tarea" className="w-full outline-none" style={field} /></Group>
          <Group title="Notas"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Detalles opcionales..." aria-label="Notas" className="w-full outline-none" style={field} /></Group>
          <Group title="Costo" footer="Solo informativo — no crea ni modifica renglones de la cotización. Si no tiene costo (ej. instalar un programa), déjalo apagado.">
            <div className="flex items-center gap-2"><DollarSign className="w-4 h-4" style={{ color: GREEN }} /><span className="flex-1">Tiene costo</span><Toggle on={hasCost} onChange={setHasCost} label="Tiene costo" /></div>
            {hasCost && <div className="flex items-center gap-2" style={{ ...field, padding: "0 14px", height: 46 }}><span style={{ color: W.sub }}>$</span><input value={cost} onChange={(e) => { const r = e.target.value.replace(",", "."); if (/^\d*\.?\d{0,2}$/.test(r)) setCost(r); }} inputMode="decimal" placeholder="0.00" aria-label="Costo" className="bg-transparent outline-none flex-1" style={{ color: "#fff", fontSize: 16 }} /></div>}
          </Group>
          <Group title="Responsable">
            <div className="flex items-center gap-2"><User className="w-4 h-4" style={{ color: BRAND }} /><select value={assignee?.id || ""} onChange={(e) => setAssignee(employees.find((x) => x.id === e.target.value) || null)} aria-label="Responsable" className="flex-1" style={{ ...field, colorScheme: "dark" }}><option value="">Sin asignar</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>
          </Group>
          <Group title="Vencimiento">
            <div className="flex items-center gap-2"><CalendarClock className="w-4 h-4" style={{ color: BRAND }} /><span className="flex-1">Fecha límite</span><Toggle on={hasDue} onChange={(v) => { setHasDue(v); if (!v) setNotify(false); }} label="Fecha límite" /></div>
            {hasDue && <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Fecha" style={{ ...field, colorScheme: "dark" }} />}
          </Group>
          <Group title="Notificación" footer={hasDue ? null : "Activa una fecha límite para poder configurar recordatorios."}>
            <div className="flex items-center gap-2"><Bell className="w-4 h-4" style={{ color: BRAND }} /><span className="flex-1">Recordarme</span><Toggle on={notify && hasDue} onChange={setNotify} disabled={!hasDue} label="Recordarme" /></div>
            {notify && hasDue && <select value={offset} onChange={(e) => setOffset(Number(e.target.value))} aria-label="Recordarme" style={{ ...field, colorScheme: "dark" }}>{OFFSETS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>}
            {notify && hasDue && <p style={{ fontSize: 12, color: W.sub }}>La web no programa recordatorios en el dispositivo; se guarda la hora para la app.</p>}
          </Group>
          <Group title="Órdenes vinculadas">
            {orders.map((o) => (
              <div key={o.id} className="flex items-center gap-2"><Wrench className="w-4 h-4" style={{ color: BRAND }} /><span className="flex-1 min-w-0"><b style={{ fontSize: 13, color: W.sub }}>{o.order_number}</b> <span style={{ fontSize: 14 }}>{o.customer_name}</span></span>
                {!(prelinked && prelinked.id === o.id) && <button onClick={() => setOrders((p) => p.filter((x) => x.id !== o.id))} aria-label="Quitar orden"><X className="w-4 h-4" style={{ color: W.sub }} /></button>}</div>
            ))}
            <button onClick={() => setPickOpen(true)} className="apple-press flex items-center gap-2 self-start" style={{ color: BRAND, fontWeight: 700, fontSize: 14 }}><Plus className="w-4 h-4" /> {orders.length ? "Añadir otra orden" : "Vincular a orden de trabajo"}</button>
          </Group>
          {error && <Banner color={RED}>{error}</Banner>}
        </div>
      </Dialog>
      <OrderPickerAll open={pickOpen} tenantId={tenantId} onClose={() => setPickOpen(false)} onPick={(o) => setOrders((p) => (p.some((x) => x.id === o.id) ? p : [...p, { id: o.id, order_number: o.order_number, customer_name: o.customer_name }]))} />
    </>
  );
}

export function TaskDetailDialog({ open, task, tenantId, employeeName, onClose, onChanged }) {
  const [edit, setEdit] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [cur, setCur] = useState(task);
  useEffect(() => { setCur(task); setError(null); }, [task?.id, open]);
  if (!cur) return null;
  const linked = linkedOrdersOf(cur);
  const overdue = isOverdue(cur);
  const run = async (fn) => { setBusy(true); setError(null); try { await fn(); onChanged?.(); onClose(); } catch (e) { setError(e?.message || String(e)); } finally { setBusy(false); } };
  const sec = (title, children) => <div className="flex flex-col" style={{ gap: 6 }}><p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.06em", color: W.sub }}>{title}</p>{children}</div>;
  return (
    <>
      <Dialog open={open && !edit} onClose={onClose} title="Detalle de tarea" width={460} leading={<TextAction onClick={() => setEdit(true)}>Editar</TextAction>} trailing={<TextAction bold onClick={onClose}>Cerrar</TextAction>}>
        <div className="flex flex-col" style={{ gap: 16, paddingTop: 8 }}>
          <div><p style={{ fontSize: 19, fontWeight: 700 }}>{cur.title}</p>{cur.notes && <p style={{ fontSize: 14, color: W.sub, marginTop: 6, whiteSpace: "pre-wrap" }}>{cur.notes}</p>}</div>
          {num(cur.cost) > 0 && sec("COSTO", <><p className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 700 }}><DollarSign className="w-4 h-4" style={{ color: GREEN }} />{money(cur.cost)}</p><p style={{ fontSize: 12, color: W.sub }}>Informativo — no está en la cotización de esta orden.</p></>)}
          {cur.assigned_name && sec("RESPONSABLE", <span style={{ alignSelf: "flex-start", padding: "4px 12px", borderRadius: 999, background: tint(BRAND, 0.16), color: BRAND, fontWeight: 700, fontSize: 13 }}>{cur.assigned_name}</span>)}
          {cur.due_at && sec("FECHA LÍMITE", <p style={{ fontSize: 15, color: overdue ? RED : "#fff", fontWeight: 600 }}>{overdue ? "Vencida · " : "Vence · "}{new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(cur.due_at))}</p>)}
          {linked.length > 0 && sec("ÓRDENES VINCULADAS", linked.map((o) => <p key={o.id} style={{ fontSize: 14 }}><b style={{ color: W.sub }}>{o.order_number}</b> {o.customer_name}</p>))}
          {cur.created_by && sec("CREADA POR", <p style={{ fontSize: 14 }}>{cur.created_by}</p>)}
          {error && <Banner color={RED}>{error}</Banner>}
          <button onClick={() => run(() => completeTask(cur.id))} disabled={busy} className="apple-press flex items-center justify-center gap-2 disabled:opacity-50" style={{ padding: "13px 0", borderRadius: 14, background: GREEN, color: "#fff", fontWeight: 700 }}><CheckCircle2 className="w-4 h-4" /> Marcar como completada</button>
          <button onClick={() => setDelOpen(true)} disabled={busy} className="apple-press flex items-center justify-center gap-2" style={{ padding: "13px 0", borderRadius: 14, background: tint(RED, 0.14), color: RED, fontWeight: 700 }}><Trash2 className="w-4 h-4" /> Eliminar tarea</button>
        </div>
      </Dialog>
      <TaskFormDialog open={open && edit} task={cur} tenantId={tenantId} employeeName={employeeName} onClose={() => setEdit(false)} onSaved={(t) => { setCur(t); onChanged?.(); }} />
      <AlertDialog open={delOpen} title="¿Eliminar tarea?" message="Esta acción no se puede deshacer." onClose={() => setDelOpen(false)} actions={[{ label: "Cancelar" }, { label: "Eliminar", destructive: true, onPress: () => run(() => deleteTask(cur.id)) }]} />
    </>
  );
}

export function OrderTasksCard({ order, tenantId, employeeName }) {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(false);
  const [detail, setDetail] = useState(null);
  const load = useCallback(() => fetchOrderTasks(tenantId, order.id).then(setTasks, () => setTasks([])), [tenantId, order.id]);
  useEffect(() => { load(); }, [load]);
  return (
    <div style={{ background: "#1C1C1E", borderRadius: 20, border: "0.5px solid rgba(255,255,255,0.08)", padding: 16 }}>
      <div className="flex items-center gap-3" style={{ marginBottom: 8 }}>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: tint(GOLD, 0.16), color: GOLD, display: "flex", alignItems: "center", justifyContent: "center" }}><CheckCircle2 className="w-4 h-4" /></span>
        <b className="flex-1" style={{ fontSize: 17 }}>Tareas de esta orden</b>
        <button onClick={() => setForm(true)} className="apple-press flex items-center gap-1" style={{ color: BRAND, fontWeight: 700, fontSize: 13 }}><Plus className="w-4 h-4" /> {tasks.length ? "Añadir otra tarea" : "Añadir tarea a esta orden"}</button>
      </div>
      {tasks.map((t) => (
        <button key={t.id} onClick={() => setDetail(t)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "9px 0", borderTop: "0.5px solid rgba(255,255,255,0.08)" }}>
          <span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 14, fontWeight: 600 }}>{t.title}</span><span className="block" style={{ fontSize: 12, color: isOverdue(t) ? RED : W.sub }}>{[t.assigned_name, t.due_at ? (isOverdue(t) ? "Vencida" : dueLabel(t)) : null].filter(Boolean).join(" · ")}</span></span>
          <Pencil className="w-3.5 h-3.5" style={{ color: W.sub }} />
        </button>
      ))}
      <TaskFormDialog open={form} tenantId={tenantId} employeeName={employeeName} prelinked={order} onClose={() => setForm(false)} onSaved={load} />
      <TaskDetailDialog open={!!detail} task={detail} tenantId={tenantId} employeeName={employeeName} onClose={() => setDetail(null)} onChanged={load} />
    </div>
  );
}
