import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  Wrench, PhoneCall, MessageCircle, Mail, Plus,
  CheckCircle2, Circle, ClipboardList, Camera, Activity,
  Send, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import AddItemModal from "@/components/workorder/AddItemModal";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";
import DiagnosticAI from "@/components/workorder/DiagnosticAI";
import JeaniStageReportPanel from "@/components/workorder/JeaniStageReportPanel";

function detectRepairDeviceCategory(order) {
  const raw = [order?.device_type || "", order?.device_brand || "", order?.device_model || ""].join(" ").toLowerCase();
  if (/imac/.test(raw)) return "imac";
  if (/macbook|mac book/.test(raw)) return "macbook";
  if (/iphone|galaxy|pixel|celular|smartphone|android|oneplus|motorola|xiaomi|huawei/.test(raw)) return "smartphone";
  if (/ipad|tablet|kindle|surface(?!\s*pro)|samsung\s*tab/.test(raw)) return "tablet";
  if (/apple\s*watch|smartwatch|galaxy\s*watch|fitbit/.test(raw)) return "smartwatch";
  if (/airpods|headphone|audifonos|audífonos|headset|earbuds|beats|bose/.test(raw)) return "headphones";
  if (/playstation|xbox|nintendo|ps4|ps5|switch|consola/.test(raw)) return "game_console";
  if (/printer|impresora|epson|hp\s*(laserjet|deskjet)|canon\s*pixma|brother/.test(raw)) return "printer";
  if (/desktop|torre|pc tower|all.in.one/.test(raw)) return "desktop_pc";
  if (/laptop|notebook|chromebook|thinkpad|ideapad|inspiron|pavilion/.test(raw)) return "laptop_windows";
  return "generic";
}

const CLOSE_CHECKLIST = [
  "Reparación completada y verificada",
  "Sin daños adicionales al equipo",
  "Equipo limpio y presentable",
  "Evidencia fotográfica tomada",
];

export default function RepairStage({ order, onUpdate, onOrderItemsUpdate, onRemoteSaved, onPaymentClick, compact }) {
  const o = order || {};

  // Checklist: si ya estaba done, iniciar con todo marcado
  const [checked,      setChecked]     = useState(() => o.repair_checklist_done ? CLOSE_CHECKLIST.map((_, i) => i) : []);
  const [showCatalog,  setShowCatalog]  = useState(false);
  const [showNote,     setShowNote]     = useState(false);
  const [noteText,     setNoteText]     = useState("");
  const [savingNote,   setSavingNote]   = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showJeaniReport, setShowJeaniReport] = useState(false);
  const photoInputRef = useRef(null);

  // Listen for sidebar action (Diagnóstico IA)
  useEffect(() => {
    if (!compact) return;
    const handler = (e) => {
      if (e.detail?.action === "diagnostico-ia") setShowJeaniReport(true);
    };
    document.addEventListener("wo:action", handler);
    return () => document.removeEventListener("wo:action", handler);
  }, [compact]);

  // Build a minimal checklist for JEANI (based on closure items + photos)
  const jeaniChecklist = useMemo(() => CLOSE_CHECKLIST.map((label, i) => ({
    id: `repair-${i}`,
    label,
    status: checked.includes(i) ? "ok" : "not_tested",
  })), [checked]);

  const allDone = checked.length === CLOSE_CHECKLIST.length;

  const photoCount = (Array.isArray(o.photos_metadata) ? o.photos_metadata.length : 0) +
                     (Array.isArray(o.device_photos) ? o.device_photos.length : 0);

  // Auto-marcar "Evidencia fotográfica tomada" cuando hay fotos (sincroniza con uploads externos del sidebar)
  useEffect(() => {
    if (photoCount > 0 && !checked.includes(3)) {
      setChecked(prev => prev.includes(3) ? prev : [...prev, 3]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoCount]);

  const toggle = async (i) => {
    // Item 3 = "Evidencia fotográfica tomada" — require at least 1 photo
    if (i === 3 && !checked.includes(i) && photoCount === 0) {
      toast("Sube al menos 1 foto antes de marcar evidencia fotográfica", { icon: "📷" });
      // Trigger photo upload
      document.dispatchEvent(new CustomEvent("wo:action", { detail: { action: "photos" } }));
      return;
    }

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

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type?.startsWith("image/"));
    if (!files.length || !order?.id) return;
    setUploadingPhoto(true);
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      const newItems = [];
      for (const file of files) {
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          const url = `${file_url}${file_url.includes("?") ? "&" : "?"}v=${Date.now()}`;
          newItems.push({
            id: `${Date.now()}-${file.name}`,
            type: "image", mime: file.type || "image/jpeg",
            filename: file.name, publicUrl: url, thumbUrl: url,
            stage_id: "in_progress", stage_label: "Reparación",
            captured_at: new Date().toISOString(),
            captured_by: me?.full_name || me?.email || "Técnico"
          });
        } catch { /* skip failed file */ }
      }
      if (newItems.length) {
        const existing = Array.isArray(o.photos_metadata) ? o.photos_metadata : [];
        await base44.entities.Order.update(order.id, { photos_metadata: [...existing, ...newItems] });
        // Auto-marcar "Evidencia fotográfica tomada" (item 3) si no estaba marcado
        if (!checked.includes(3)) {
          const next = [...checked, 3];
          setChecked(next);
          const nowAllDone = next.length === CLOSE_CHECKLIST.length;
          if (nowAllDone) {
            try {
              await base44.entities.Order.update(order.id, { repair_checklist_done: true });
              toast.success("Foto subida — checklist completo");
            } catch {}
          } else {
            toast.success(`${newItems.length} foto${newItems.length > 1 ? "s" : ""} subida${newItems.length > 1 ? "s" : ""} — evidencia marcada`);
          }
        } else {
          toast.success(`${newItems.length} foto${newItems.length > 1 ? "s" : ""} subida${newItems.length > 1 ? "s" : ""}`);
        }
        if (onUpdate) onUpdate();
      }
    } catch { toast.error("Error al subir foto"); }
    finally { setUploadingPhoto(false); e.target.value = ""; }
  };

  const handleSaveNote = async () => {
    const body = noteText.trim();
    if (!body || !order?.id) return;
    setSavingNote(true);
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "note_added",
        description: body,
        user_id: me?.id || null,
        user_name: me?.full_name || me?.email || "Técnico",
        user_role: me?.role || null,
        metadata: { note_text: body }
      });
      toast.success("Nota guardada");
      setNoteText("");
      setShowNote(false);
      if (onUpdate) onUpdate();
    } catch { toast.error("Error al guardar nota"); }
    finally { setSavingNote(false); }
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
      {!compact && (
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
      )}

      {/* ── AÑADIR PIEZA ─────────────────────────────────────────────────── */}
      {!compact && (
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
      )}

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
                : <Circle className="w-5 h-5 text-white/50 flex-shrink-0" />
              }
              <span className={`text-sm font-semibold ${checked.includes(i) ? "text-emerald-200" : "text-white/60"}`}>
                {label}
              </span>
            </button>
          ))}

          {/* Acciones rápidas: Fotos y Nota — solo en modo completo */}
          {!compact && (
          <>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="flex items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 hover:bg-blue-500/14 transition-all disabled:opacity-50"
            >
              {uploadingPhoto
                ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                : <Camera className="w-4 h-4 text-blue-400" />
              }
              <span className="text-sm font-semibold text-blue-300">
                {uploadingPhoto ? "Subiendo…" : "Subir foto"}
              </span>
            </button>
            <button
              onClick={() => setShowNote(v => !v)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3 hover:bg-cyan-500/14 transition-all"
            >
              <Activity className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-semibold text-cyan-300">Tomar nota</span>
            </button>
          </div>

          {/* Input de nota inline */}
          {showNote && (
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2">
              <Textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                placeholder="Escribe la nota técnica…"
                className="bg-black/40 border-white/15 text-white resize-none text-sm min-h-[80px]"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowNote(false); setNoteText(""); }}
                  className="text-white/50 hover:text-white text-xs">Cancelar</Button>
                <Button size="sm" onClick={handleSaveNote} disabled={savingNote || !noteText.trim()}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs gap-1.5">
                  {savingNote ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  Guardar nota
                </Button>
              </div>
            </div>
          )}

          {/* Input de foto oculto */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={handlePhotoUpload}
            className="hidden"
          />
          </>
          )}
        </div>
      </div>

      {/* ── PIEZAS Y SERVICIOS ───────────────────────────────────────────── */}
      {!compact && (
        <SharedItemsSection
          order={o}
          onUpdate={onUpdate}
          onOrderItemsUpdate={onOrderItemsUpdate}
          onRemoteSaved={onRemoteSaved}
          onPaymentClick={onPaymentClick}
          accentColor="emerald"
          subtitle="Registra piezas y servicios que impactan esta reparación."
        />
      )}

      {/* ── Asistente de Reparacion IA ── */}
      {!compact && (
        <DiagnosticAI
          order={order}
          checklist={Array.isArray(o.checklist_items) ? o.checklist_items : []}
          deviceCategory={detectRepairDeviceCategory(o)}
          mode="repair"
        />
      )}

      {/* ── HISTORIAL / FOTOS / NOTAS ────────────────────────────────────── */}
      {!compact && (
        <WorkOrderUnifiedHub
          order={order}
          onUpdate={onUpdate}
          accent="emerald"
          title="Fotos · Notas · Historial"
          subtitle="Historial completo, galería de evidencia y seguridad."
        />
      )}

      <AddItemModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        onSave={() => setShowCatalog(false)}
        order={o}
        onUpdate={onUpdate}
      />

      {showJeaniReport && (
        <JeaniStageReportPanel
          order={o}
          checklist={jeaniChecklist}
          checklistNotes={noteText}
          stageId="in_progress"
          stageLabel="Reparación"
          onClose={() => setShowJeaniReport(false)}
          onApplyAsNote={() => { setShowJeaniReport(false); onUpdate?.(); }}
        />
      )}
    </div>
  );
}
