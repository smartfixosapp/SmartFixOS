import React, { useMemo } from "react";
import {
  ChevronRight, DollarSign, Printer, Phone, MessageCircle,
  Mail, Shield, Trash2, ChevronDown, Zap, Clock, Camera,
  ClipboardCheck, Package, Link2, Send, FileText, ShoppingCart
} from "lucide-react";
import { getStatusConfig, normalizeStatusId } from "@/components/utils/statusRegistry";
import { cn } from "@/lib/utils";

// ── Contextual actions per stage ──
const STAGE_ACTIONS = {
  intake: [
    { icon: Camera, label: "Subir foto", action: "photos" },
  ],
  diagnosing: [
    { icon: ClipboardCheck, label: "Checklist", action: "checklist" },
  ],
  waiting_parts: [
    { icon: Package, label: "Tracking", action: "tracking" },
  ],
  pending_order: [
    { icon: Link2, label: "Agregar link", action: "links" },
  ],
  in_progress: [
    { icon: ClipboardCheck, label: "Checklist cierre", action: "checklist" },
    { icon: Camera, label: "Foto evidencia", action: "photos" },
  ],
  ready_for_pickup: [
    { icon: Send, label: "Notificar cliente", action: "notify" },
  ],
  awaiting_approval: [
    { icon: FileText, label: "Link aprobación", action: "approval" },
  ],
};

export default function WOActionSidebar({
  order,
  status,
  activeStatuses = [],
  closedStatuses = [],
  changingStatus,
  onChangeStatus,
  onPaymentClick,
  onPrint,
  onDelete,
  onSecurityEdit,
  onContextAction,
}) {
  const o = order || {};

  // Determine if current stage is "ready to advance"
  const stageReady = useMemo(() => {
    const s = normalizeStatusId(status);
    if (s === "in_progress") return !!o.repair_checklist_done;
    if (s === "warranty") return !!o.warranty_verdict;
    if (s === "ready_for_pickup" || s === "delivered") {
      const total = Number(o.total || o.cost_estimate || 0);
      const paid = Number(o.amount_paid ?? o.total_paid ?? 0);
      const balance = o.balance_due != null ? Number(o.balance_due || 0) : total - paid;
      return balance <= 0.01;
    }
    // For other stages, always ready
    return true;
  }, [status, o]);

  // Find next logical status
  const nextStatus = useMemo(() => {
    const currentOrder = getStatusConfig(status).order || 0;
    return activeStatuses
      .filter(s => (s.order || 0) > currentOrder && !s.isTerminal)
      .sort((a, b) => (a.order || 0) - (b.order || 0))[0] || null;
  }, [status, activeStatuses]);

  const allStatuses = useMemo(() => {
    return [...activeStatuses, ...closedStatuses]
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [activeStatuses, closedStatuses]);

  // Progress
  const currentIdx = activeStatuses.findIndex(s => normalizeStatusId(status) === s.id);
  const progressPct = activeStatuses.length > 1 ? Math.round(((currentIdx >= 0 ? currentIdx : 0) / (activeStatuses.length - 1)) * 100) : 0;

  // Time in current status
  const timeInStatus = useMemo(() => {
    const history = o.status_history;
    if (!Array.isArray(history) || history.length === 0) {
      return o.created_date ? timeSince(new Date(o.created_date)) : null;
    }
    const last = [...history].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0];
    return last?.timestamp ? timeSince(new Date(last.timestamp)) : null;
  }, [o.status_history, o.created_date]);

  const phone = o.customer_phone || o.phone;
  const customerName = o.customer_name || "Cliente";
  const contextActions = STAGE_ACTIONS[normalizeStatusId(status)] || [];

  const [showAllStatuses, setShowAllStatuses] = React.useState(false);

  return (
    <div className="space-y-2">
      {/* ── Progress Stepper ── */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Progreso</span>
          <span className="text-[10px] font-bold text-white/50">{currentIdx + 1}/{activeStatuses.length}</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all duration-500"
            style={{ width: `${Math.max(progressPct, 5)}%` }}
          />
        </div>
        {/* Mini dots */}
        <div className="flex gap-1">
          {activeStatuses.map((s, i) => (
            <div
              key={s.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-all",
                i <= currentIdx ? "bg-cyan-500/60" : "bg-white/[0.06]"
              )}
              title={s.label}
            />
          ))}
        </div>
        {/* Timer */}
        {timeInStatus && (
          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
            <Clock className="w-3 h-3" />
            <span>{timeInStatus} en {getStatusConfig(status).label}</span>
          </div>
        )}
      </div>

      {/* ── Next Status Button ── */}
      {nextStatus && (
        <button
          onClick={() => onChangeStatus?.(nextStatus.id)}
          disabled={changingStatus}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-3 rounded-xl font-bold text-sm transition-all active:scale-95",
            changingStatus ? "opacity-50 cursor-not-allowed" : "hover:brightness-110",
            stageReady
              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
              : (nextStatus.colorClasses || "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"),
            "border"
          )}
        >
          {stageReady ? <Check className="w-4 h-4 shrink-0" /> : <Zap className="w-4 h-4 shrink-0" />}
          <span className="flex-1 text-left truncate">Pasar a {nextStatus.label}</span>
          <ChevronRight className="w-3.5 h-3.5 opacity-50" />
        </button>
      )}

      {/* ── Status Dropdown ── */}
      <button
        onClick={() => setShowAllStatuses(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-xs font-semibold text-white/50 transition-all"
      >
        <span>Cambiar estado...</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", showAllStatuses && "rotate-180")} />
      </button>

      {showAllStatuses && (
        <div className="space-y-1 p-1 rounded-xl border border-white/10 bg-[#0D0D0F]">
          {allStatuses.map(s => {
            const isCurrent = normalizeStatusId(status) === s.id;
            return (
              <button
                key={s.id}
                onClick={() => { if (!isCurrent) { onChangeStatus?.(s.id); setShowAllStatuses(false); } }}
                disabled={changingStatus || isCurrent}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all text-left",
                  isCurrent
                    ? "bg-white/10 text-white cursor-default"
                    : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color || "#6B7280" }} />
                <span className="truncate">{s.label}</span>
                {isCurrent && <span className="ml-auto text-[10px] text-white/30">actual</span>}
              </button>
            );
          })}
        </div>
      )}

      <div className="border-t border-white/[0.06] my-2" />

      {/* ── Contextual Actions (per stage) ── */}
      {contextActions.length > 0 && (
        <>
          {contextActions.map(act => (
            <ActionBtn
              key={act.action}
              icon={act.icon}
              label={act.label}
              color="text-cyan-400"
              onClick={() => onContextAction?.(act.action)}
            />
          ))}
          <div className="border-t border-white/[0.06] my-2" />
        </>
      )}

      {/* ── Core Actions ── */}
      <ActionBtn icon={ShoppingCart} label="Piezas y Servicios" color="text-cyan-400" onClick={() => onContextAction?.("catalog")} />
      <ActionBtn icon={DollarSign} label="Cobrar" color="text-emerald-400" onClick={() => onPaymentClick?.("full")} />
      <ActionBtn icon={Printer} label="Imprimir" onClick={onPrint} />

      {phone && (
        <>
          <div className="border-t border-white/[0.06] my-2" />
          <ActionBtn icon={Phone} label="Llamar" href={`tel:${phone}`} />
          <ActionBtn icon={MessageCircle} label="WhatsApp" color="text-green-400" href={`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola ${customerName}, le contactamos de SmartFixOS sobre su orden #${o.order_number || ""}.`)}`} target="_blank" />
          {o.customer_email && <ActionBtn icon={Mail} label="Email" href={`mailto:${o.customer_email}`} />}
        </>
      )}

      <div className="border-t border-white/[0.06] my-2" />

      <ActionBtn icon={Shield} label="Seguridad" onClick={onSecurityEdit} />
      <ActionBtn icon={Trash2} label="Eliminar" color="text-red-400" onClick={onDelete} />
    </div>
  );
}

function ActionBtn({ icon: Icon, label, color, onClick, href, target }) {
  const cls = cn(
    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all",
    "border border-white/[0.06] hover:bg-white/[0.06] active:scale-95",
    color || "text-white/70"
  );

  if (href) {
    return (
      <a href={href} target={target} rel="noopener noreferrer" className={cls}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </a>
    );
  }

  return (
    <button onClick={onClick} className={cls}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}

function timeSince(date) {
  const now = new Date();
  const diff = Math.max(0, now - date);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
