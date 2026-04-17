import React, { useRef, useState } from "react";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle, AlertCircle,
  PhoneCall, MessageCircle, Mail, Camera, Activity, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";

// ── Opciones de veredicto ─────────────────────────────────────────────────────
const VERDICTS = [
  {
    id: "covered",
    label: "Cubierto",
    sublabel: "Sin costo para el cliente",
    icon: CheckCircle2,
    idle: "border-emerald-500/30 bg-emerald-500/8 text-emerald-300 hover:bg-emerald-500/18",
    active: "border-emerald-500 bg-emerald-500/22 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.18)] scale-[1.02]",
  },
  {
    id: "partial",
    label: "Parcial",
    sublabel: "Parte cubierta, hay extras",
    icon: AlertCircle,
    idle: "border-amber-500/30 bg-amber-500/8 text-amber-300 hover:bg-amber-500/18",
    active: "border-amber-500 bg-amber-500/22 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.18)] scale-[1.02]",
  },
  {
    id: "not_covered",
    label: "No aplica",
    sublabel: "Daño fuera de garantía",
    icon: XCircle,
    idle: "border-red-500/30 bg-red-500/8 text-red-300 hover:bg-red-500/18",
    active: "border-red-500 bg-red-500/22 text-red-200 shadow-[0_0_20px_rgba(239,68,68,0.18)] scale-[1.02]",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function WarrantyStage({
  order,
  onUpdate,
  onPaymentClick,
  onOrderItemsUpdate,
  onRemoteSaved,
  onClose,
  compact,
}) {
  const o = order || {};
  const photoInputRef = useRef(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showNote, setShowNote]             = useState(false);
  const [noteText, setNoteText]             = useState("");
  const [savingNote, setSavingNote]         = useState(false);
  const [verdict, setVerdict]               = useState(o.warranty_verdict || null);
  const [savingVerdict, setSavingVerdict]   = useState(false);

  // ── Datos de garantía ────────────────────────────────────────────────────
  const claimReason    = String(o?.warranty_mode?.warranty_reason || "").trim();
  const originalProblem = String(o?.initial_problem || "").trim();
  const daysRemaining  = Number(o?.warranty_countdown?.days_remaining ?? -1);
  const warrantyExpired = o?.warranty_countdown?.expired === true || daysRemaining === 0;

  const phone  = o.customer_phone || "";
  const email  = o.customer_email || "";
  const digits = phone.replace(/\D/g, "");
  const intl   = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;

  // ── Tono según estado de garantía ────────────────────────────────────────
  const warrantyTone = warrantyExpired
    ? { badge: "border-red-400/25 bg-red-500/10 text-red-200", label: "Vencida", icon: AlertTriangle }
    : daysRemaining >= 0 && daysRemaining <= 7
    ? { badge: "border-amber-400/25 bg-amber-500/10 text-amber-100", label: `${daysRemaining}d restantes`, icon: Shield }
    : { badge: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100", label: daysRemaining >= 0 ? `${daysRemaining}d restantes` : "Activa", icon: Shield };

  const StatusIcon = warrantyTone.icon;

  // ── Guardar veredicto ────────────────────────────────────────────────────
  async function handleVerdict(id) {
    if (savingVerdict) return;
    setSavingVerdict(true);
    try {
      await base44.entities.Order.update(o.id, { warranty_verdict: id });
      setVerdict(id);
      onUpdate?.();
    } catch {
      toast.error("No se pudo guardar el veredicto");
    } finally {
      setSavingVerdict(false);
    }
  }

  // ── Subir foto ───────────────────────────────────────────────────────────
  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error("sin url");
      const prev = Array.isArray(o.photos_metadata) ? o.photos_metadata : [];
      await base44.entities.Order.update(o.id, {
        photos_metadata: [...prev, { url: file_url, created_at: new Date().toISOString(), context: "warranty" }],
      });
      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "photo_added",
        description: "Foto de garantía subida",
        metadata: { url: file_url },
      });
      toast.success("Foto guardada");
      onUpdate?.();
    } catch {
      toast.error("Error subiendo foto");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  }

  // ── Guardar nota ─────────────────────────────────────────────────────────
  async function handleSaveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "note_added",
        description: noteText.trim(),
        metadata: { context: "warranty" },
      });
      setNoteText("");
      setShowNote(false);
      toast.success("Nota guardada");
      onUpdate?.();
    } catch {
      toast.error("Error guardando nota");
    } finally {
      setSavingNote(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── HERO: dispositivo + estado + contacto ─────────────────────────── */}
      {!compact && (
      <section className="relative overflow-hidden rounded-[28px] border border-amber-500/15 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_28%),linear-gradient(135deg,rgba(28,18,8,0.98),rgba(18,14,10,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">
        {/* badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.25em] text-amber-100">
            Garantía
          </Badge>
          <Badge variant="outline" className={`rounded-full px-3 py-1 text-xs flex items-center gap-1 ${warrantyTone.badge}`}>
            <StatusIcon className="w-3 h-3" />
            {warrantyTone.label}
          </Badge>
        </div>

        {/* dispositivo + cliente */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-5">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
            {o.device_brand} {o.device_model}
          </h2>
          <p className="text-sm font-bold text-white/50">{o.customer_name}</p>
        </div>

        {/* contacto */}
        {(digits || email) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {digits && (
              <a
                href={`tel:+${intl}`}
                className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-white/15 bg-white/5 text-white hover:bg-white/10 font-semibold text-sm transition-all active:scale-95"
              >
                <PhoneCall className="w-4 h-4 text-white/60 flex-shrink-0" />
                <span className="hidden sm:inline truncate">{phone}</span>
                <span className="sm:hidden">Llamar</span>
              </a>
            )}
            {digits && (
              <a
                href={`https://wa.me/${intl}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 font-semibold text-sm transition-all active:scale-95"
              >
                <MessageCircle className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">WhatsApp</span>
              </a>
            )}
            {email && (
              <a
                href={`mailto:${email}`}
                className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 font-semibold text-sm transition-all active:scale-95 col-span-2 sm:col-span-1"
              >
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline truncate">{email}</span>
                <span className="sm:hidden">Email</span>
              </a>
            )}
          </div>
        )}
      </section>
      )}

      {/* ── COMPARACIÓN: reclamo actual vs problema original ─────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[22px] border border-amber-500/20 bg-black/30 p-4 space-y-2">
          <p className="text-[10px] font-semibold tracking-[0.28em] text-amber-400/70">
            Cliente reclama ahora
          </p>
          {claimReason
            ? <p className="text-sm leading-relaxed text-white/80">{claimReason}</p>
            : <p className="text-sm text-white/25 italic">Sin motivo registrado</p>
          }
        </div>
        <div className="rounded-[22px] border border-white/10 bg-black/30 p-4 space-y-2">
          <p className="text-[10px] font-semibold tracking-[0.28em] text-white/30">
            Problema original
          </p>
          {originalProblem
            ? <p className="text-sm leading-relaxed text-white/80">{originalProblem}</p>
            : <p className="text-sm text-white/25 italic">Sin descripción inicial</p>
          }
        </div>
      </div>

      {/* ── VEREDICTO ────────────────────────────────────────────────────── */}
      <section className="rounded-[28px] border border-white/10 bg-black/25 p-5 space-y-4">
        {/* header */}
        <div className="flex flex-wrap items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-[11px] font-semibold tracking-[0.28em] text-white/40">
            Veredicto de garantía
          </p>
          {verdict
            ? <span className="ml-auto text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2 py-0.5 rounded-full">
                Listo para avanzar
              </span>
            : <span className="ml-auto text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/25 px-2 py-0.5 rounded-full">
                🔒 Requerido para avanzar
              </span>
          }
        </div>

        {/* botones veredicto */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {VERDICTS.map(({ id, label, sublabel, icon: Icon, idle, active }) => (
            <button
              key={id}
              onClick={() => handleVerdict(id)}
              disabled={savingVerdict}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-4 transition-all active:scale-95 disabled:opacity-60 ${
                verdict === id ? active : idle
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="font-semibold text-sm">{label}</span>
              <span className="text-[10px] opacity-70 text-center leading-tight">{sublabel}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── ACCIONES RÁPIDAS: foto + nota — solo en modo completo ─────────── */}
      {!compact && (
      <>
      <div className="grid grid-cols-2 gap-2">
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhoto}
        />
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={uploadingPhoto}
          className="flex items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 hover:bg-blue-500/14 transition-all disabled:opacity-50 active:scale-95"
        >
          {uploadingPhoto
            ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            : <Camera className="w-4 h-4 text-blue-400" />
          }
          <span className="text-sm font-semibold text-blue-300">
            {uploadingPhoto ? "Subiendo…" : "Foto"}
          </span>
        </button>

        <button
          onClick={() => setShowNote(v => !v)}
          className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/8 px-4 py-3 hover:bg-cyan-500/14 transition-all active:scale-95"
        >
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-semibold text-cyan-300">Nota</span>
        </button>
      </div>

      {/* nota inline */}
      {showNote && (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 space-y-2">
          <Textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Escribe la nota de garantía…"
            className="bg-black/40 border-white/15 text-white resize-none text-sm min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSaveNote}
              disabled={savingNote || !noteText.trim()}
              size="sm"
              className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl"
            >
              {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar"}
            </Button>
            <Button
              onClick={() => { setShowNote(false); setNoteText(""); }}
              size="sm"
              variant="ghost"
              className="text-white/50 rounded-xl"
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
      </>
      )}

      {/* ── PIEZAS Y EXTRAS ──────────────────────────────────────────────── */}
      {!compact && (
      <SharedItemsSection
        order={o}
        onUpdate={onUpdate}
        onOrderItemsUpdate={onOrderItemsUpdate}
        onRemoteSaved={onRemoteSaved}
        onClose={onClose}
        accentColor="amber"
        subtitle="Solo si la garantía requiere piezas nuevas o hay cargos fuera de cobertura."
        catalogButtonLabel="Añadir extras"
        onPaymentClick={onPaymentClick}
      />
      )}

      {/* ── HISTORIAL ────────────────────────────────────────────────────── */}
      {!compact && (
      <WorkOrderUnifiedHub
        order={order}
        onUpdate={onUpdate}
        accent="amber"
        title="Centro de Garantía"
        subtitle="Historial, notas y evidencias del reclamo."
      />
      )}
    </div>
  );
}
