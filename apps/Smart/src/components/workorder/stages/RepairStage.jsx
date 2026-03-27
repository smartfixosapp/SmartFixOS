import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Wrench, PhoneCall, MessageCircle, Mail, Plus,
  CheckCircle2, Circle, ClipboardList, Camera, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import AddItemModal from "@/components/workorder/AddItemModal";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";

const CLOSE_CHECKLIST = [
  "Reparación completada y verificada",
  "Sin daños adicionales al equipo",
  "Equipo limpio y presentable",
  "Evidencia fotográfica tomada",
];

export default function RepairStage({ order, onUpdate, onOrderItemsUpdate, onRemoteSaved, onPaymentClick }) {
  const o = order || {};

  // Checklist: si ya estaba done, iniciar con todo marcado
  const [checked,     setChecked]    = useState(() => o.repair_checklist_done ? CLOSE_CHECKLIST.map((_, i) => i) : []);
  const [showCatalog, setShowCatalog] = useState(false);
  const [hubTab,      setHubTab]     = useState(null);
  const hubRef = useRef(null);

  const allDone = checked.length === CLOSE_CHECKLIST.length;

  const toggle = async (i) => {
    const next = checked.includes(i)
      ? checked.filter(x => x !== i)
      : [...checked, i];
    setChecked(next);

    const nowAllDone = next.length === CLOSE_CHECKLIST.length;
    const wasDone = checked.length === CLOSE_CHECKLIST.length;

    // Solo guardar al completar todos o al desmarcar alguno habiendo estado completo
    if (nowAllDone !== wasDone) {
      try {
        await base44.entities.Order.update(order.id, { repair_checklist_done: nowAllDone });
        if (nowAllDone) toast.success("Checklist completo — listo para avanzar");
        if (onUpdate) onUpdate();
      } catch { /* silent */ }
    }
  };

  const openHub = (tab) => {
    setHubTab(tab);
    setTimeout(() => hubRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };

  const orderItems = Array.isArray(o.order_items) ? o.order_items : [];
  const itemCount  = orderItems.length;
  const itemTotal  = useMemo(
    () => orderItems.reduce((sum, item) => {
      const qty = Number(item?.qty || item?.quantity || 1);
      return sum + qty * Number(item?.price || 0);
    }, 0),
    [orderItems]
  );

  return (
    <div className="space-y-6">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[30px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.12),transparent_30%),linear-gradient(135deg,rgba(8,24,18,0.98),rgba(10,14,24,0.96))] p-4 sm:p-6 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.03),transparent)]" />
        <div className="relative z-10 space-y-4">

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
              Reparación
            </Badge>
            <Badge variant="outline" className="rounded-full border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/65">
              Mesa técnica activa
            </Badge>
            {o?.status_metadata?.quick_order === true && (
              <Badge className="rounded-full border border-amber-400/25 bg-amber-500/15 px-3 py-1 text-xs text-amber-100">
                Rápida
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-4xl">En Reparación</h2>
            {(o.device_brand || o.device_model) && (
              <span className="inline-flex items-center rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm font-semibold text-emerald-200">
                {o.device_brand} {o.device_model}
              </span>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] border border-white/10 bg-black/25 p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Cliente</p>
              <p className="truncate text-base font-bold text-emerald-200">{o.customer_name || "No registrado"}</p>
              {o.customer_phone && <p className="mt-0.5 text-xs text-white/45 truncate">{o.customer_phone}</p>}
            </div>
            <div className="rounded-[18px] border border-white/10 bg-black/25 p-4">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/35">Problema reportado</p>
              <p className="line-clamp-2 text-sm font-semibold text-white/80">{o.initial_problem || "Sin descripción"}</p>
            </div>
          </div>

          {(o.customer_phone || o.customer_email) && (() => {
            const phone  = o.customer_phone || "";
            const email  = o.customer_email || "";
            const digits = phone.replace(/\D/g, "");
            const intl   = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;
            return (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {digits && (
                  <a href={`tel:+${intl}`} className="flex items-center justify-center gap-3 h-12 rounded-2xl border border-white/15 bg-white/5 text-white hover:bg-white/10 font-bold text-sm uppercase tracking-wide transition-all active:scale-95">
                    <PhoneCall className="w-4 h-4 text-white/60" />{phone}
                  </a>
                )}
                {digits && (
                  <a href={`https://wa.me/${intl}`} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-3 h-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20 font-bold text-sm uppercase tracking-wide transition-all active:scale-95">
                    <MessageCircle className="w-4 h-4" />WhatsApp
                  </a>
                )}
                {email && (
                  <a href={`mailto:${email}`} className="flex items-center justify-center gap-3 h-12 rounded-2xl border border-blue-500/30 bg-blue-500/12 text-blue-300 hover:bg-blue-500/20 font-bold text-sm uppercase tracking-wide transition-all active:scale-95">
                    <Mail className="w-4 h-4" /><span className="truncate">{email}</span>
                  </a>
                )}
              </div>
            );
          })()}
        </div>
      </section>

      {/* ── AÑADIR PIEZA ─────────────────────────────────────────────────── */}
      <button
        onClick={() => setShowCatalog(true)}
        className="w-full flex items-center justify-between gap-4 rounded-[22px] border border-amber-500/20 bg-amber-500/8 px-5 py-4 hover:bg-amber-500/14 transition-all group text-left"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-500/15">
            <Wrench className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Piezas y Servicios</p>
            <p className="text-xs text-white/40">
              {itemCount > 0
                ? `${itemCount} item${itemCount === 1 ? "" : "s"} · $${itemTotal.toFixed(2)}`
                : "Sin piezas registradas todavía"}
            </p>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 group-hover:bg-amber-500/20 transition-all">
          <Plus className="w-3.5 h-3.5" />Añadir
        </span>
      </button>

      {/* ── CHECKLIST DE CIERRE ──────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
        <div className="border-b border-white/8 bg-gradient-to-r from-emerald-500/10 to-transparent p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-4 h-4 text-emerald-400" />
              <div>
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Checklist de Cierre</h3>
                <p className="text-[11px] text-white/35 mt-0.5">{checked.length}/{CLOSE_CHECKLIST.length} completados</p>
              </div>
            </div>
            {allDone ? (
              <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-[11px] font-bold text-emerald-300">
                <CheckCircle2 className="w-3 h-3" />Listo para avanzar
              </span>
            ) : (
              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-400">
                🔒 Bloquea avance
              </span>
            )}
          </div>
        </div>

        <div className="p-5 space-y-2">
          {/* Items del checklist */}
          {CLOSE_CHECKLIST.map((label, i) => (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                checked.includes(i)
                  ? "border-emerald-500/25 bg-emerald-500/10"
                  : "border-white/8 bg-white/2 hover:bg-white/5"
              }`}
            >
              {checked.includes(i)
                ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                : <Circle className="w-5 h-5 text-white/20 flex-shrink-0" />
              }
              <span className={`text-sm font-semibold ${checked.includes(i) ? "text-emerald-200" : "text-white/60"}`}>
                {label}
              </span>
            </button>
          ))}

          {/* Acciones rápidas: Fotos y Nota */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => openHub("photos")}
              className="flex items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 hover:bg-blue-500/14 transition-all"
            >
              <Camera className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold text-blue-300">Subir foto</span>
            </button>
            <button
              onClick={() => openHub("timeline")}
              className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3 hover:bg-cyan-500/14 transition-all"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-cyan-300">Tomar nota</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── PIEZAS Y SERVICIOS ───────────────────────────────────────────── */}
      <SharedItemsSection
        order={o}
        onUpdate={onUpdate}
        onOrderItemsUpdate={onOrderItemsUpdate}
        onRemoteSaved={onRemoteSaved}
        onPaymentClick={onPaymentClick}
        accentColor="emerald"
        subtitle="Registra piezas y servicios que impactan esta reparación."
      />

      {/* ── HISTORIAL / FOTOS / NOTAS ────────────────────────────────────── */}
      <div ref={hubRef}>
        <WorkOrderUnifiedHub
          order={order}
          onUpdate={onUpdate}
          accent="emerald"
          title="Fotos · Notas · Historial"
          subtitle="Documenta el proceso, toma evidencia y deja el historial listo para el cierre."
          openTab={hubTab}
        />
      </div>

      <AddItemModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        onSave={() => setShowCatalog(false)}
        order={o}
        onUpdate={onUpdate}
      />
    </div>
  );
}
