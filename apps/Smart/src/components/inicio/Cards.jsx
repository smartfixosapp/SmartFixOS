import { ArrowRight, Check, CopyPlus, FileSearch, AlertTriangle, ChevronRight, LockOpen, Lock, Clock, BadgeCheck, Sparkles, PlusCircle, Zap, ShieldCheck, Lock as LockFill, CircleAlert, Clock3, X } from "lucide-react";
import CountUp from "@/components/ui/CountUp";
import { tint } from "@/components/pos/native/posUi";
import { FP } from "@/lib/finance/ledger";
import { money } from "@/components/finanzas/ui";
import { shortTime, entryIn, elapsedHours, hm } from "@/lib/punchApi";
import { relativeDayLabel, warrantySummary, displayDevice, displayNumber, displayName } from "@/lib/inicioApi";
import { fmt } from "@/lib/finance/tz";
import { avatarInitials } from "./Header";

export const CARD = "#1C1C1E";

export function HeroRevenue({ revenue, expenses, net, goal, onClick }) {
  const hasGoal = goal > 0;
  const progress = hasGoal ? Math.min(revenue / goal, 1) : revenue > 0 ? 1 : 0;
  const reached = hasGoal && revenue >= goal;
  const ring = reached ? FP.success : FP.brand;
  const R = 27;
  const C = 2 * Math.PI * R;
  return (
    <button onClick={onClick} aria-label="Ingresos de hoy, ver en Finanzas" className="apple-press w-full text-left flex flex-col" style={{ gap: 12, padding: 20, borderRadius: 22, background: tint(ring, 0.1), border: `1px solid ${tint(ring, 0.18)}` }}>
      <div className="flex items-center gap-5">
        <div className="flex-1 min-w-0 flex flex-col" style={{ gap: 4 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#8E8E93" }}>Ventas de hoy</span>
          <span className="truncate" style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}><CountUp value={revenue} format={money} /></span>
          {hasGoal ? <span style={{ fontSize: 12, fontWeight: 600, color: ring }}>{reached ? "Meta alcanzada" : `Meta ${money(goal)}`}</span> : <span style={{ fontSize: 12, color: "#8E8E93" }}>Toca para ver Finanzas</span>}
        </div>
        <span className="relative flex-shrink-0" style={{ width: 60, height: 60 }}>
          <svg width="60" height="60" viewBox="0 0 60 60" aria-hidden="true">
            <circle cx="30" cy="30" r={R} fill="none" stroke={tint(ring, 0.15)} strokeWidth="6" />
            <circle cx="30" cy="30" r={R} fill="none" stroke={ring} strokeWidth="6" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 30 30)" style={{ transition: "stroke-dashoffset 0.5s" }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center" style={{ color: ring, fontSize: 14, fontWeight: 700 }}>
            {reached ? <Check className="w-5 h-5" strokeWidth={3} style={{ color: FP.success }} /> : hasGoal ? `${Math.floor(progress * 100)}%` : <ArrowRight className="w-4 h-4" strokeWidth={3} />}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-1.5" style={{ paddingTop: 8, borderTop: `1px solid ${tint(ring, 0.15)}`, fontSize: 12 }}>
        <span style={{ fontWeight: 600, color: net >= 0 ? FP.success : FP.danger }}>Neto {money(net)}</span>
        <span style={{ color: "rgba(235,235,245,0.3)" }}>·</span>
        <span style={{ color: "#8E8E93" }}>Gastos {money(expenses)}</span>
      </div>
    </button>
  );
}

export function ActionTile({ title, Icon, color, onClick }) {
  return (
    <button onClick={onClick} aria-label={title} className="apple-press flex flex-col items-center justify-center" style={{ gap: 8, padding: "20px 12px", borderRadius: 20, background: CARD, border: `1px solid ${tint(color, 0.18)}` }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon className="w-5 h-5" /></span>
      <span className="truncate" style={{ fontSize: 17, fontWeight: 600 }}>{title}</span>
    </button>
  );
}

export function ActionTiles({ wide, onNewOrder, onQuotes }) {
  return wide ? (
    <div className="grid grid-cols-2" style={{ gap: 12 }}>
      <ActionTile title="Nueva orden" Icon={CopyPlus} color={FP.brand} onClick={onNewOrder} />
      <ActionTile title="Cotizaciones" Icon={FileSearch} color={FP.vip} onClick={onQuotes} />
    </div>
  ) : (
    <ActionTile title="Nueva orden" Icon={CopyPlus} color={FP.info} onClick={onNewOrder} />
  );
}

export function Watchdog({ net }) {
  return (
    <div className="flex items-center gap-2" style={{ padding: 16, borderRadius: 12, background: tint(FP.danger, 0.1) }}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: FP.danger }} />
      <span style={{ fontSize: 15 }}>Hoy gastaste más de lo que entró — neto {money(net)}</span>
    </div>
  );
}

export function LeftOpenYesterday({ punchAt, cashAt, cashExpected, tz, onPunch, onCash }) {
  const row = (title, sub, value, onClick) => (
    <button onClick={onClick} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: "12px 14px", borderRadius: 12, background: CARD }}>
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span className="block truncate" style={{ fontSize: 12, color: "#8E8E93" }}>{sub}</span>
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: FP.warning, fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />
    </button>
  );
  const punchDur = punchAt ? hm((Date.now() - punchAt.getTime()) / 3600000) : null;
  return (
    <div className="flex flex-col" style={{ gap: 10, padding: 16, borderRadius: 16, background: tint(FP.warning, 0.1), border: `1px solid ${tint(FP.warning, 0.38)}` }}>
      <p className="flex items-center gap-2" style={{ fontSize: 15, fontWeight: 700, color: FP.warning }}><AlertTriangle className="w-4 h-4" /> Quedó de ayer sin cerrar</p>
      <p style={{ fontSize: 13, color: "#8E8E93" }}>Pasó la medianoche con esto abierto. Ciérralo antes de empezar hoy o los números del día se mezclan.</p>
      {punchAt && row("Tu ponche", `abierto desde ${relativeDayLabel(punchAt, tz)}`, `${punchDur.h}h ${punchDur.m}m`, onPunch)}
      {cashAt && row("Caja del turno", `abierta desde ${relativeDayLabel(cashAt, tz)}`, cashExpected !== null && cashExpected !== undefined ? money(cashExpected) : "—", onCash)}
    </div>
  );
}

export function EnTurnoAhora({ entries, onClick }) {
  const open = entries.filter((e) => !e.clock_out);
  const flash = entries.filter((e) => e.clock_out && (e.total_hours === null || e.total_hours === undefined ? 1 : Number(e.total_hours)) < 10 / 60);
  const long = open.filter((e) => elapsedHours(e) > 12).length;
  const visible = [...open, ...flash];
  if (!visible.length) return null;
  const parts = [`${open.length} ponchado${open.length === 1 ? "" : "s"}`];
  if (long) parts.push(`${long} turno largo`);
  if (flash.length) parts.push(`${flash.length} relámpago`);
  const flag = (e) => (!e.clock_out ? (elapsedHours(e) > 12 ? "long" : null) : "flash");
  const color = (e) => ({ long: FP.warning, flash: FP.danger }[flag(e)] || FP.success);
  return (
    <button onClick={onClick} className="apple-press w-full text-left flex flex-col" style={{ gap: 10, padding: 16, borderRadius: 16, background: CARD }}>
      <div className="flex items-center gap-2">
        <span style={{ width: 8, height: 8, borderRadius: 999, background: FP.success }} />
        <span className="flex-1" style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.04em", color: "#8E8E93" }}>EN TURNO AHORA</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: long || flash.length ? FP.warning : "#8E8E93" }}>{parts.join(" · ")}</span>
      </div>
      <div className="flex overflow-x-auto" style={{ gap: 14 }}>
        {visible.map((e, i) => (
          <span key={e.id || i} className="flex flex-col items-center" style={{ width: 64, gap: 3, flexShrink: 0 }}>
            <span className="relative" style={{ width: 40, height: 40, borderRadius: 999, background: tint(color(e), 0.22), color: color(e), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700 }}>
              {avatarInitials(e.employee_name)}
              {flag(e) && (
                <span className="absolute" style={{ top: -4, right: -4, width: 16, height: 16, borderRadius: 999, background: color(e), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {flag(e) === "long" ? <Clock3 className="w-2.5 h-2.5" /> : <Zap className="w-2.5 h-2.5" />}
                </span>
              )}
            </span>
            <span className="truncate w-full text-center" style={{ fontSize: 11, fontWeight: 600 }}>{e.employee_name || "—"}</span>
          </span>
        ))}
      </div>
    </button>
  );
}

export function ShiftControls({ register, openEntry, showPunch, tz, onCash, onPunch }) {
  const cashOpen = !!register;
  const tile = (Icon, color, title, sub, onClick, pulse) => (
    <button onClick={onClick} className="apple-press flex-1 min-w-0 flex items-center gap-3 text-left" style={{ padding: 14, borderRadius: 16, background: CARD, border: `1px solid ${tint(color, 0.18)}` }}>
      <span className="relative" style={{ width: 40, height: 40, borderRadius: 12, background: tint(color, 0.18), color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon className="w-5 h-5" />
        {pulse && <span className="absolute animate-pulse" style={{ top: 4, right: 4, width: 7, height: 7, borderRadius: 999, background: FP.success }} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block truncate" style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span className="block truncate" style={{ fontSize: 12, color: "#8E8E93" }}>{sub}</span>
      </span>
      {cashOpen && Icon === LockOpen && <ChevronRight className="w-4 h-4" style={{ color: "rgba(235,235,245,0.3)" }} />}
    </button>
  );
  const openedAt = register?.created_at ? new Date(register.created_at) : null;
  return (
    <div className="flex" style={{ gap: 10 }}>
      {cashOpen ? tile(LockOpen, FP.success, "Caja abierta", `desde ${shortTime(openedAt, tz)}`, onCash, true) : tile(Lock, "#8E8E93", "Caja cerrada", "Abrir caja", onCash)}
      {showPunch && (openEntry ? tile(BadgeCheck, FP.info, "Ponchado", `desde ${shortTime(entryIn(openEntry), tz)}`, onPunch) : tile(Clock, FP.brand, "Sin ponchar", "Ponchar entrada", onPunch))}
    </div>
  );
}

export function TrialBanner({ info, onClick }) {
  if (!info) return null;
  let bg; let Icon; let title; let sub;
  if (info.kind === "beta") {
    bg = FP.success; Icon = Sparkles; title = "Plan Beta — Gratis"; sub = "Acceso completo hasta el lanzamiento oficial";
  } else {
    const d = info.days;
    if (d === null) { bg = "#636366"; Icon = Clock; title = "Prueba gratis"; sub = "Tu prueba está activa"; return (<button onClick={onClick} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: 16, borderRadius: 16, background: bg, color: "#fff" }}><Icon className="w-6 h-6 flex-shrink-0" /><span className="flex-1 min-w-0"><span className="block" style={{ fontSize: 15, fontWeight: 700 }}>{title}</span><span className="block" style={{ fontSize: 13, opacity: 0.9 }}>{sub}</span></span><ChevronRight className="w-4 h-4" /></button>); }
    title = d === 0 ? "Tu trial termina HOY" : d === 1 ? "1 día de trial restante" : `${d} días de trial restantes`;
    if (d > 7) { bg = FP.info; Icon = Clock; sub = "Tu prueba está activa"; } else if (d >= 3) { bg = FP.brand; Icon = CircleAlert; sub = "Tu prueba está por terminar"; } else if (d >= 1) { bg = FP.danger; Icon = AlertTriangle; sub = "Tu prueba termina pronto"; } else { bg = FP.danger; Icon = LockFill; sub = "Prueba finalizada"; }
  }
  return (
    <button onClick={onClick} className="apple-press w-full flex items-center gap-3 text-left" style={{ padding: 16, borderRadius: 16, background: bg, color: "#fff" }}>
      <Icon className="w-6 h-6 flex-shrink-0" />
      <span className="flex-1 min-w-0">
        <span className="block" style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        <span className="block" style={{ fontSize: 13, opacity: 0.9 }}>{sub}</span>
      </span>
      <ChevronRight className="w-4 h-4" />
    </button>
  );
}

export function WelcomeCard({ onNewOrder }) {
  return (
    <div className="flex flex-col" style={{ gap: 12, padding: 16, borderRadius: 20, background: CARD }}>
      <div className="flex items-center gap-3">
        <span style={{ width: 48, height: 48, borderRadius: 999, background: tint(FP.brand, 0.12), color: FP.brand, display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles className="w-6 h-6" /></span>
        <span className="flex flex-col">
          <span style={{ fontSize: 15, fontWeight: 700 }}>¡Bienvenido a Archilla OS!</span>
          <span style={{ fontSize: 12, color: "#8E8E93" }}>Empieza creando tu primera orden de trabajo.</span>
        </span>
      </div>
      <button onClick={onNewOrder} className="apple-press flex items-center justify-center gap-2" style={{ padding: "10px 0", borderRadius: 12, background: FP.brand, color: "#fff", fontSize: 15, fontWeight: 600 }}>
        <PlusCircle className="w-4 h-4" /> Nueva orden
      </button>
    </div>
  );
}

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2" style={{ padding: "12px 14px", borderRadius: 12, background: tint(FP.danger, 0.12), color: FP.danger, fontSize: 14 }}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" /> <span className="flex-1">{message}</span>
      <button onClick={onDismiss} aria-label="Cerrar"><X className="w-4 h-4" /></button>
    </div>
  );
}

export function WarrantiesCard({ list, tz, onOpen }) {
  const s = warrantySummary(list);
  const color = s.claims > 0 || s.urgent > 0 ? FP.warning : FP.success;
  const stat = (count, label, c) => (
    <div className="flex-1 flex flex-col items-center" style={{ gap: 2, padding: "8px 0", borderRadius: 12, background: tint(c, count > 0 ? 0.1 : 0.04), border: `1px solid ${tint(c, count > 0 ? 0.3 : 0.1)}` }}>
      <span style={{ fontSize: 20, fontWeight: 700, color: count > 0 ? c : "#8E8E93" }}>{count}</span>
      <span style={{ fontSize: 9, fontWeight: 600, color: "#8E8E93", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
  const ringColor = (dl) => (dl === null ? FP.danger : dl <= 3 ? FP.danger : dl <= 7 ? FP.warning : FP.success);
  return (
    <div className="flex flex-col" style={{ gap: 10, padding: 16, borderRadius: 20, background: tint(color, 0.08), border: `1px solid ${tint(color, 0.2)}` }}>
      <button onClick={onOpen} className="flex items-center gap-3 text-left">
        <span style={{ width: 38, height: 38, borderRadius: 10, background: tint(color, 0.15), color, display: "flex", alignItems: "center", justifyContent: "center" }}><ShieldCheck className="w-5 h-5" /></span>
        <span className="flex-1">
          <span className="block" style={{ fontSize: 15, fontWeight: 700 }}>Garantías</span>
          <span className="block" style={{ fontSize: 12, color: "#8E8E93" }}>{list.length} activa{list.length === 1 ? "" : "s"}</span>
        </span>
        <span className="flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: FP.info }}>Ver todas <ChevronRight className="w-3 h-3" strokeWidth={3} /></span>
      </button>
      <div className="flex" style={{ gap: 8 }}>
        {stat(s.alDia, "Al día", FP.success)}
        {stat(s.urgent, "Vence pronto", FP.warning)}
        {stat(s.claims, s.claims === 1 ? "Reclamo" : "Reclamos", FP.danger)}
      </div>
      <div>
        {s.preview.map((it, i) => {
          const c = ringColor(it.daysLeft);
          const R = 14;
          const Cc = 2 * Math.PI * R;
          const frac = it.daysLeft === null ? 1 : Math.max(0, Math.min(it.total, it.daysLeft)) / Math.max(1, it.total);
          const ref = new Date(it.order.updated_date || it.order.created_date || Date.now());
          const vence = new Date(ref.getTime() + it.total * 86400000);
          return (
            <button key={it.order.id} onClick={onOpen} className="w-full flex items-center gap-3 text-left" style={{ padding: "8px 0", borderTop: i ? "0.5px solid rgba(255,255,255,0.06)" : "none" }}>
              <span className="relative flex-shrink-0" style={{ width: 34, height: 34 }}>
                <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
                  <circle cx="17" cy="17" r={R} fill="none" stroke={tint(c, 0.2)} strokeWidth="3.5" />
                  <circle cx="17" cy="17" r={R} fill="none" stroke={c} strokeWidth="3.5" strokeLinecap="round" strokeDasharray={Cc} strokeDashoffset={Cc * (1 - frac)} transform="rotate(-90 17 17)" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 10, fontWeight: 800, color: c }}>{it.daysLeft === null ? "!" : `${it.daysLeft}d`}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate" style={{ fontSize: 12, fontWeight: 700 }}>{displayDevice(it.order) || "Equipo"} · {displayNumber(it.order)}</span>
                <span className="block truncate" style={{ fontSize: 11, color: "#8E8E93" }}>{displayName(it.order)}{it.daysLeft !== null ? ` · vence ${fmt(vence, tz, { day: "numeric", month: "short" }).replace(".", "")}` : ""}</span>
              </span>
              {it.daysLeft === null && <span style={{ padding: "3px 8px", borderRadius: 999, background: tint(FP.danger, 0.16), color: FP.danger, fontSize: 9, fontWeight: 800 }}>RECLAMO</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function OrderCreatedToast({ order, onView }) {
  if (!order) return null;
  return (
    <button onClick={onView} className="fixed left-1/2 flex items-center gap-3 text-left apple-press" style={{ zIndex: 250, top: 16, transform: "translateX(-50%)", maxWidth: "calc(100vw - 32px)", padding: "12px 16px", borderRadius: 16, background: "#2C2C2E", boxShadow: "0 12px 32px rgba(0,0,0,0.5)", color: "#fff" }}>
      <BadgeCheck className="w-6 h-6 flex-shrink-0" style={{ color: FP.success }} />
      <span className="min-w-0">
        <span className="block" style={{ fontSize: 15, fontWeight: 700 }}>Orden creada</span>
        <span className="block truncate" style={{ fontSize: 13, color: "#8E8E93" }}>{order.order_number || ""} · {order.customer_name || ""} · <span style={{ color: FP.brand, fontWeight: 600 }}>Ver</span></span>
      </span>
    </button>
  );
}
