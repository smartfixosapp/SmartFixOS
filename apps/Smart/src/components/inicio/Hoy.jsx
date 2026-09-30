import { useCallback, useEffect, useMemo, useState } from "react";
import { Hammer, Phone, MessageCircle, MoreHorizontal, CircleDollarSign, ClipboardCheck, PackageSearch, Clock, Check, ChevronRight, ChevronDown, Plus, Loader2, Banknote } from "lucide-react";
import { Overlay, W } from "@/components/wizard/ui";
import { tint } from "@/components/pos/native/posUi";
import { statusInfo } from "@/lib/orderStatus";
import { displayDevice, displayName, displayNumber, remainingBalance, waMessage, waLink, cleanPhone } from "@/lib/inicioApi";
import { fetchPendingTasks, completeTask, dueLabel, isOverdue } from "@/lib/tasksApi";
import { TaskFormDialog, TaskDetailDialog } from "@/components/tareas/Tasks";
import { safeTZ, zonedParts, fmt } from "@/lib/finance/tz";

const BRAND = "#F2662E";
const GOLD = "#FFC733";
const WARN = "#FFA640";
const RED = "#FF7373";
const GREEN = "#4DC780";
const SNOOZE_KEY = "sfos_hoy_snooze";
export const BRIEFING_KEY = "sfos_last_briefing_ts";

const ACTION = ["intake", "diagnosing", "pending_order", "in_progress", "part_arrived_waiting_device"];
const FOLLOW = ["ready_for_pickup", "waiting_customer"];

const readSnooze = () => { try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || "{}") || {}; } catch { return {}; } };
const writeSnooze = (m) => { try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(m)); } catch { return; } };

export function shouldAutoBriefing(tz, now = new Date()) {
  let last = 0;
  try { last = Number(localStorage.getItem(BRIEFING_KEY)) || 0; } catch { last = 0; }
  const p = zonedParts(now, safeTZ(tz));
  if (p.h < 5 || p.h > 11) return false;
  if (!last) return true;
  const a = zonedParts(new Date(last), safeTZ(tz));
  return !(a.y === p.y && a.m === p.m && a.d === p.d);
}

export function markBriefingShown() {
  try { localStorage.setItem(BRIEFING_KEY, String(Date.now())); } catch { return; }
}

function ageText(o) {
  const d = Math.floor((Date.now() - new Date(o.created_date || o.created_at || Date.now()).getTime()) / 86400000);
  return { text: d <= 0 ? "hoy" : d === 1 ? "1 día" : `${d} días`, late: d >= 3 };
}

export default function HoyBriefing({ open, onClose, tenant, tenantId, tz, employee, orders, products, hasPunch, hasCash, onPunch, onCash, onOpenOrder, onPay }) {
  const zone = safeTZ(tz);
  const shop = String(tenant?.name || "").trim() || "Archilla OS";
  const [tasks, setTasks] = useState(null);
  const [snooze, setSnooze] = useState(readSnooze());
  const [menuFor, setMenuFor] = useState(null);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [invOpen, setInvOpen] = useState(false);
  const [form, setForm] = useState(false);
  const [detail, setDetail] = useState(null);

  const loadTasks = useCallback(() => fetchPendingTasks(tenantId).then(setTasks, () => setTasks([])), [tenantId]);
  useEffect(() => { if (open) { loadTasks(); setSnooze(readSnooze()); markBriefingShown(); } }, [open, loadTasks]);

  const now = Date.now();
  const hidden = (id) => (snooze[id] || 0) > now;
  const action = useMemo(() => (orders || []).filter((o) => ACTION.includes(o.status)).sort((a, b) => new Date(a.created_date) - new Date(b.created_date)), [orders]);
  const follow = useMemo(() => (orders || []).filter((o) => FOLLOW.includes(o.status) && !hidden(o.id)).sort((a, b) => new Date(a.created_date) - new Date(b.created_date)), [orders, snooze]);
  const cobros = useMemo(() => (orders || []).filter((o) => o.status === "delivered" && remainingBalance(o) > 0.005 && !hidden(o.id)).sort((a, b) => remainingBalance(b) - remainingBalance(a)), [orders, snooze]);
  const low = useMemo(() => (products || []).filter((p) => p.stock !== null && p.stock !== undefined && p.min_stock !== null && p.min_stock !== undefined && Number(p.stock) <= Number(p.min_stock)), [products]);
  const total = action.length + follow.length + cobros.length + (tasks || []).length;

  const h = zonedParts(new Date(), zone).h;
  const greeting = h >= 5 && h <= 11 ? "Buenos días" : h >= 12 && h <= 18 ? "Buenas tardes" : "Buenas noches";
  const dateText = fmt(new Date(), zone, { weekday: "long", day: "numeric", month: "long" }).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  const summary = tasks === null ? "Revisando tu día…" : total === 0 ? "Todo al día, nada urgente." : total === 1 ? "Tienes 1 cosa por atender hoy." : `Tienes ${total} cosas por atender hoy.`;

  const snoozeTo = (id, kind) => {
    const d = new Date();
    if (kind === "contacted") { d.setDate(d.getDate() + 1); d.setHours(5, 0, 0, 0); }
    else if (kind === "tomorrow") { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); }
    else { d.setDate(d.getDate() + 2); d.setHours(8, 0, 0, 0); }
    const next = { ...snooze, [id]: d.getTime() };
    writeSnooze(next); setSnooze(next); setMenuFor(null);
  };

  if (!open) return null;

  const orderCard = (o, kind) => {
    const info = statusInfo(o.status);
    const Icon = info.Icon;
    const age = ageText(o);
    const bal = remainingBalance(o);
    const phone = cleanPhone(o.customer_phone);
    return (
      <div key={o.id} className="flex items-center gap-3 relative" style={{ padding: 12, borderRadius: 14, background: "#1C1C1E" }}>
        <button onClick={() => { onClose(); onOpenOrder(o.id); }} className="apple-press flex items-center gap-3 flex-1 min-w-0 text-left">
          <span style={{ width: 40, height: 40, borderRadius: 999, background: tint(info.color, 0.18), color: info.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{Icon ? <Icon className="w-5 h-5" /> : null}</span>
          <span className="flex-1 min-w-0"><span className="block truncate" style={{ fontSize: 15, fontWeight: 700 }}>{displayName(o)}</span><span className="block truncate" style={{ fontSize: 12, color: W.sub }}>{displayDevice(o) || displayNumber(o)}</span>
            <span className="block" style={{ fontSize: 12, color: kind === "cobros" ? RED : age.late ? RED : W.sub, fontWeight: 600 }}>{kind === "cobros" ? `$${bal.toFixed(0)}` : `${info.label} · ${age.text}`}</span></span>
          {kind === "action" && <ChevronRight className="w-4 h-4" style={{ color: W.sub }} />}
        </button>
        {kind !== "action" && (
          <span className="flex items-center" style={{ gap: 6 }}>
            {phone && <a href={`tel:${phone}`} aria-label="Llamar" className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: tint(BRAND, 0.18), color: BRAND, display: "flex", alignItems: "center", justifyContent: "center" }}><Phone className="w-4 h-4" /></a>}
            {phone && <a href={waLink(phone, waMessage(o, shop))} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: tint(GREEN, 0.18), color: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}><MessageCircle className="w-4 h-4" /></a>}
            <button onClick={() => setMenuFor(menuFor === o.id ? null : o.id)} aria-label="Más" className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: "#2C2C2E", display: "flex", alignItems: "center", justifyContent: "center" }}><MoreHorizontal className="w-4 h-4" /></button>
            {kind === "cobros" && <button onClick={() => { onClose(); onPay(o.id); }} aria-label="Cobrar" className="apple-press" style={{ width: 34, height: 34, borderRadius: 999, background: GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 4, fontWeight: 800 }}>$</button>}
          </span>
        )}
        {menuFor === o.id && (
          <div className="absolute" style={{ right: 12, top: 52, zIndex: 20, background: "#2C2C2E", borderRadius: 12, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", minWidth: 190 }}>
            {[["contacted", "Ya lo contacté"], ["tomorrow", "Posponer a mañana"], ["two", "Posponer 2 días"]].map(([k, l], i) => <button key={k} onClick={() => snoozeTo(o.id, k)} className="apple-press w-full text-left" style={{ padding: "11px 14px", fontSize: 14, borderTop: i ? `0.5px solid ${W.sep}` : "none" }}>{l}</button>)}
          </div>
        )}
      </div>
    );
  };

  const section = (title, Icon, color, list, kind) => list.length > 0 && (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <p className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", color }}><Icon className="w-4 h-4" /> {title.toUpperCase()}<span style={{ padding: "1px 8px", borderRadius: 999, background: tint(color, 0.18), fontSize: 11 }}>{list.length}</span></p>
      {list.slice(0, 8).map((o) => orderCard(o, kind))}
      {list.length > 8 && <p style={{ fontSize: 12, color: W.sub }}>y {list.length - 8} más</p>}
    </div>
  );

  const ritual = (label, done, doneLabel, Icon, onClick) => <button onClick={() => { if (!done) { onClose(); onClick(); } }} disabled={done} className="apple-press flex-1 flex items-center justify-center gap-2" style={{ padding: "11px 0", borderRadius: 14, background: done ? "rgba(77,199,128,0.18)" : "#fff", color: done ? GREEN : BRAND, fontWeight: 700, fontSize: 14 }}><Icon className="w-4 h-4" /> {done ? doneLabel : label}</button>;

  return (
    <Overlay z={310} onEscape={onClose}>
      <div className="flex-1 overflow-y-auto">
        <div style={{ background: "linear-gradient(135deg,#FF6B38,#FF7333)", padding: "34px 20px 22px" }}>
          <div className="mx-auto" style={{ maxWidth: 820 }}>
            <p style={{ fontSize: 34, fontWeight: 800, color: "#fff" }}>{greeting}{employee?.full_name ? `, ${String(employee.full_name).trim().split(/\s+/)[0]}` : ""}</p>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.85)" }}>{dateText}</p>
            <p style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginTop: 10 }}>{summary}</p>
            <div className="flex" style={{ gap: 10, marginTop: 16 }}>
              {ritual("Ponchar entrada", hasPunch, "Ponchado", Clock, onPunch)}
              {ritual("Abrir caja", hasCash, "Caja abierta", Banknote, onCash)}
            </div>
          </div>
        </div>
        <div className="mx-auto flex flex-col" style={{ maxWidth: 820, padding: "18px 16px 110px", gap: 18 }}>
          {section("Acción ahora", Hammer, BRAND, action, "action")}
          {section("Seguimientos", Phone, WARN, follow, "follow")}
          {section("Cobros pendientes", CircleDollarSign, RED, cobros, "cobros")}
          <div style={{ borderRadius: 14, background: "#1C1C1E", overflow: "hidden" }}>
            <button onClick={() => setTasksOpen((v) => !v)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: 14 }}>
              <ClipboardCheck className="w-5 h-5" style={{ color: GOLD }} />
              <span className="flex-1"><span className="block" style={{ fontWeight: 700 }}>Tareas pendientes</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{tasks === null ? "Cargando…" : tasks.length ? `${tasks.length} tarea${tasks.length === 1 ? "" : "s"} · toca para ver` : "Sin tareas · toca para agregar"}</span></span>
              {tasksOpen ? <ChevronDown className="w-4 h-4" style={{ color: W.sub }} /> : <ChevronRight className="w-4 h-4" style={{ color: W.sub }} />}
            </button>
            {tasksOpen && (
              <div style={{ padding: "0 14px 14px" }}>
                {(tasks || []).map((t) => (
                  <div key={t.id} className="flex items-center gap-3" style={{ padding: "8px 0", borderTop: `0.5px solid ${W.sep}` }}>
                    <button onClick={() => { setTasks((p) => p.filter((x) => x.id !== t.id)); completeTask(t.id).catch(() => loadTasks()); }} aria-label={`Completar ${t.title}`} style={{ width: 26, height: 26, borderRadius: 999, border: `2px solid ${GOLD}`, display: "flex", alignItems: "center", justifyContent: "center" }}><Check className="w-3.5 h-3.5" style={{ color: "transparent" }} /></button>
                    <button onClick={() => setDetail(t)} className="flex-1 min-w-0 text-left"><span className="block" style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{t.title}</span>{t.due_at && <span className="block" style={{ fontSize: 12, color: isOverdue(t) ? RED : W.sub }}>{isOverdue(t) ? "Vencida" : t.due_at && dueLabel(t).startsWith("Hoy") ? "Vence hoy" : `Vence ${dueLabel(t)}`}</span>}</button>
                  </div>
                ))}
                <button onClick={() => setForm(true)} className="apple-press flex items-center gap-2" style={{ marginTop: 8, color: BRAND, fontWeight: 700, fontSize: 14 }}><Plus className="w-4 h-4" /> Agregar tarea</button>
              </div>
            )}
          </div>
          {low.length > 0 && (
            <div style={{ borderRadius: 14, background: "#1C1C1E", overflow: "hidden" }}>
              <button onClick={() => setInvOpen((v) => !v)} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: 14 }}>
                <PackageSearch className="w-5 h-5" style={{ color: WARN }} />
                <span className="flex-1"><span className="block" style={{ fontWeight: 700 }}>Inventario bajo</span><span className="block" style={{ fontSize: 12, color: W.sub }}>{low.length} por ordenar · toca para ver</span></span>
                {invOpen ? <ChevronDown className="w-4 h-4" style={{ color: W.sub }} /> : <ChevronRight className="w-4 h-4" style={{ color: W.sub }} />}
              </button>
              {invOpen && <div style={{ padding: "0 14px 14px" }}>{low.slice(0, 10).map((p) => <div key={p.id} style={{ padding: "8px 0", borderTop: `0.5px solid ${W.sep}` }}><span className="block" style={{ fontSize: 14, fontWeight: 600 }}>Reordenar {p.name}</span><span className="block" style={{ fontSize: 12, color: W.sub }}>Quedan {p.stock} · mín {p.min_stock}</span></div>)}{low.length > 10 && <p style={{ fontSize: 12, color: W.sub, paddingTop: 6 }}>y {low.length - 10} más por ordenar</p>}</div>}
            </div>
          )}
          {total === 0 && low.length === 0 && tasks !== null && (
            <div className="flex flex-col items-center text-center" style={{ padding: "30px 0", gap: 6 }}>
              <span style={{ width: 70, height: 70, borderRadius: 999, background: tint(GREEN, 0.16), color: GREEN, display: "flex", alignItems: "center", justifyContent: "center" }}><Check className="w-9 h-9" strokeWidth={3} /></span>
              <b style={{ fontSize: 22 }}>¡Todo al día!</b><span style={{ color: W.sub }}>No hay nada pendiente. Agrega una tarea para no olvidarla.</span>
              <button onClick={() => setForm(true)} className="apple-press" style={{ marginTop: 8, padding: "10px 20px", borderRadius: 999, background: BRAND, color: "#fff", fontWeight: 700 }}>Agregar tarea</button>
            </div>
          )}
          {tasks === null && <div className="flex justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: W.sub }} /></div>}
        </div>
      </div>
      <div className="fixed left-0 right-0" style={{ zIndex: 311, bottom: 0, padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(14px)" }}>
        <button onClick={onClose} className="apple-press block mx-auto w-full" style={{ maxWidth: 820, padding: "15px 0", borderRadius: 16, background: BRAND, color: "#fff", fontWeight: 800, fontSize: 17 }}>Empezar mi día</button>
      </div>
      <TaskFormDialog open={form} tenantId={tenantId} employeeName={employee?.full_name} onClose={() => setForm(false)} onSaved={loadTasks} />
      <TaskDetailDialog open={!!detail} task={detail} tenantId={tenantId} employeeName={employee?.full_name} onClose={() => setDetail(null)} onChanged={loadTasks} />
    </Overlay>
  );
}
