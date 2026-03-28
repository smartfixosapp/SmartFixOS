import React, { useRef, useState } from "react";
import {
  PackageCheck, CheckCircle2, AlertCircle,
  PhoneCall, MessageCircle, Mail, Camera, Activity, Loader2,
  DollarSign, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import WorkOrderUnifiedHub from "@/components/workorder/WorkOrderUnifiedHub";
import SharedItemsSection from "@/components/workorder/SharedItemsSection";

// ─────────────────────────────────────────────────────────────────────────────
export default function DeliveryStage({
  order,
  onUpdate,
  onPaymentClick,
  onOrderItemsUpdate,
  onRemoteSaved,
  onClose,
}) {
  const o = order || {};
  const photoInputRef = useRef(null);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showNote,       setShowNote]       = useState(false);
  const [noteText,       setNoteText]       = useState("");
  const [savingNote,     setSavingNote]     = useState(false);

  // ── Datos financieros ──────────────────────────────────────────────────────
  const items         = Array.isArray(o.order_items) ? o.order_items : [];
  const subtotal      = items.reduce((s, it) => s + Number(it.price || 0) * Number(it.qty || 1), 0);
  const taxable       = items.reduce((s, it) => it.taxable !== false ? s + Number(it.price || 0) * Number(it.qty || 1) : s, 0);
  const tax           = taxable * 0.115;
  const total         = subtotal + tax;
  const amountPaid    = Number(o.total_paid || o.amount_paid || 0);
  const balanceDue    = o.balance_due != null
    ? Math.max(0, Number(o.balance_due))
    : Math.max(0, total - amountPaid);
  const isSaldado     = balanceDue <= 0.01;

  // ── Contacto ───────────────────────────────────────────────────────────────
  const phone  = o.customer_phone || "";
  const email  = o.customer_email || "";
  const digits = phone.replace(/\D/g, "");
  const intl   = digits.startsWith("1") ? digits : digits.length === 10 ? `1${digits}` : digits;

  // ── Subir foto ─────────────────────────────────────────────────────────────
  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error("sin url");
      const prev = Array.isArray(o.photos_metadata) ? o.photos_metadata : [];
      await base44.entities.Order.update(o.id, {
        photos_metadata: [...prev, { url: file_url, created_at: new Date().toISOString(), context: "delivery" }],
      });
      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "photo_added",
        description: "Foto de entrega subida",
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

  // ── Guardar nota ───────────────────────────────────────────────────────────
  async function handleSaveNote() {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "note_added",
        description: noteText.trim(),
        metadata: { context: "delivery" },
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

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-[28px] border border-emerald-500/15 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_28%),linear-gradient(135deg,rgba(8,24,18,0.98),rgba(10,18,22,0.96))] p-5 shadow-[0_22px_70px_rgba(0,0,0,0.35)]">

        {/* badges */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-200">
            Entrega
          </Badge>
          <Badge
            variant="outline"
            className={`rounded-full px-3 py-1 text-xs flex items-center gap-1 ${
              isSaldado
                ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                : "border-amber-400/25 bg-amber-500/10 text-amber-100"
            }`}
          >
            {isSaldado
              ? <CheckCircle2 className="w-3 h-3" />
              : <AlertCircle className="w-3 h-3" />
            }
            {isSaldado ? "Saldado" : `$${balanceDue.toFixed(2)} pendiente`}
          </Badge>
        </div>

        {/* dispositivo + cliente */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1 mb-5">
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {o.device_brand} {o.device_model}
          </h2>
          <p className="text-sm font-bold text-white/50">{o.customer_name}</p>
        </div>

        {/* cobro rápido si hay balance */}
        {!isSaldado && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => onPaymentClick?.("deposit")}
              className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-white/15 bg-white/5 text-white hover:bg-white/10 font-semibold text-sm transition-all active:scale-95"
            >
              <Wallet className="w-4 h-4 text-white/60 flex-shrink-0" />
              <span className="hidden sm:inline">Depósito</span>
              <span className="sm:hidden">Dep.</span>
            </button>
            <button
              onClick={() => onPaymentClick?.("full")}
              className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 font-semibold text-sm transition-all active:scale-95"
            >
              <DollarSign className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Cobrar restante</span>
              <span className="sm:hidden">Cobrar</span>
            </button>
          </div>
        )}

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

        {/* badge saldado grande */}
        {isSaldado && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-black text-emerald-200">Orden saldada</p>
              <p className="text-xs text-emerald-300/60">Lista para entregar al cliente</p>
            </div>
          </div>
        )}
      </section>

      {/* ── ACCIONES RÁPIDAS: foto + nota ─────────────────────────────────── */}
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
            placeholder="Escribe una nota de entrega…"
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

      {/* ── PIEZAS Y COBRO ────────────────────────────────────────────────── */}
      <SharedItemsSection
        order={o}
        onUpdate={onUpdate}
        onOrderItemsUpdate={onOrderItemsUpdate}
        onRemoteSaved={onRemoteSaved}
        onClose={onClose}
        accentColor="emerald"
        subtitle="Confirma piezas y servicios finales antes de cerrar la orden."
        catalogButtonLabel="Añadir ítem"
        onPaymentClick={onPaymentClick}
      />

      {/* ── HISTORIAL ─────────────────────────────────────────────────────── */}
      <WorkOrderUnifiedHub
        order={order}
        onUpdate={onUpdate}
        accent="emerald"
        title="Centro de Entrega"
        subtitle="Historial, evidencias y actividad del cierre de orden."
      />
    </div>
  );
}
