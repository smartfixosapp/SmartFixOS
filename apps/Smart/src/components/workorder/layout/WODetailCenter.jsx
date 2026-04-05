import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Phone, MessageCircle, Mail, Smartphone, Laptop, Tablet, Watch, Gamepad2, Box, Pencil, Check, X, Plus, Send, Loader2, Camera, Image as ImageIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import AddItemModal from "@/components/workorder/AddItemModal";
import WorkOrderTimeline from "@/components/orders/workorder/WorkOrderTimeline";
import { logWorkOrderPhotoEvent } from "@/components/workorder/utils/auditEvents";

const DEVICE_ICONS = {
  smartphone: Smartphone, phone: Smartphone, celular: Smartphone,
  laptop: Laptop, notebook: Laptop, macbook: Laptop,
  tablet: Tablet, ipad: Tablet,
  watch: Watch, smartwatch: Watch, reloj: Watch,
  console: Gamepad2, consola: Gamepad2,
};

function DeviceIcon({ type }) {
  const key = (type || "").toLowerCase();
  const Icon = Object.entries(DEVICE_ICONS).find(([k]) => key.includes(k))?.[1] || Box;
  return <Icon className="w-4 h-4 text-white/40" />;
}

const IVU_RATE = 0.115;

export default function WODetailCenter({
  order,
  onUpdate,
  onOrderItemsUpdate,
  onRemoteSaved,
  onPaymentClick,
  onClose,
  children,
}) {
  const o = order || {};
  const phone = o.customer_phone || o.phone;
  const [showCatalog, setShowCatalog] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef(null);

  // Listen for sidebar events
  useEffect(() => {
    const onCatalog = () => setShowCatalog(true);
    const onPhotos = () => photoInputRef.current?.click();
    document.addEventListener("wo:open-catalog", onCatalog);
    document.addEventListener("wo:open-photos", onPhotos);
    return () => {
      document.removeEventListener("wo:open-catalog", onCatalog);
      document.removeEventListener("wo:open-photos", onPhotos);
    };
  }, []);

  // Photo upload handler
  const handlePhotoUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type?.startsWith("image/"));
    if (!files.length || !o.id) return;
    setUploading(true);
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      const newItems = [];
      for (const file of files) {
        try {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          const versionedUrl = `${file_url}${file_url.includes("?") ? "&" : "?"}v=${Date.now()}`;
          newItems.push({
            id: `${Date.now()}-${file.name}`,
            type: "image",
            mime: file.type || "image/jpeg",
            filename: file.name,
            publicUrl: versionedUrl,
            thumbUrl: versionedUrl,
            stage_id: "general",
            stage_label: "General",
            captured_at: new Date().toISOString(),
            captured_by: me?.full_name || me?.email || "Sistema"
          });
        } catch (err) {
          console.error("Upload error:", err);
        }
      }
      if (!newItems.length) throw new Error("No se pudo subir");
      const existing = Array.isArray(o.photos_metadata) ? o.photos_metadata : [];
      await base44.entities.Order.update(o.id, { photos_metadata: [...existing, ...newItems] });
      onUpdate?.();
      try { await logWorkOrderPhotoEvent({ order: o, count: newItems.length, source: "detail_center" }); } catch {}
      toast.success(`${newItems.length} foto(s) subida(s)`);
    } catch {
      toast.error("Error al subir fotos");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [o, onUpdate]);

  const items = useMemo(() => Array.isArray(o.order_items) ? o.order_items : [], [o.order_items]);

  // Financial summary
  const financial = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 1)), 0);
    const tax = subtotal * IVU_RATE;
    const total = Number(o.total || o.cost_estimate || 0) || (subtotal + tax);
    const paid = Number(o.amount_paid ?? o.total_paid ?? 0);
    const balance = o.balance_due != null ? Math.max(0, Number(o.balance_due || 0)) : Math.max(0, total - paid);
    return { subtotal, tax, total, paid, balance };
  }, [items, o.total, o.cost_estimate, o.amount_paid, o.total_paid, o.balance_due]);

  // Post comment
  const postComment = useCallback(async () => {
    if (!comment.trim() || !o.id) return;
    setPosting(true);
    try {
      let me = null;
      try { me = await base44.auth.me(); } catch {}
      await base44.entities.WorkOrderEvent.create({
        order_id: o.id,
        order_number: o.order_number,
        event_type: "note",
        description: comment.trim(),
        user_name: me?.full_name || me?.email || "Sistema",
        user_id: me?.id || null,
      });
      setComment("");
      setTimelineKey(k => k + 1); // force timeline refresh
      onUpdate?.();
      toast.success("Nota agregada");
    } catch {
      toast.error("Error al guardar nota");
    } finally {
      setPosting(false);
    }
  }, [comment, o.id, o.order_number, onUpdate]);

  return (
    <div className="space-y-3">
      {/* ── Customer & Device ── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4 space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Cliente</h4>
          <EditableField orderId={o.id} field="customer_name" value={o.customer_name} onUpdate={onUpdate} className="text-sm font-bold text-white" />
          {phone && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Phone className="w-3 h-3" />
              <a href={`tel:${phone}`} className="hover:text-white transition-colors">{phone}</a>
              <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-400 hover:text-green-300">
                <MessageCircle className="w-3 h-3" />
              </a>
            </div>
          )}
          {o.customer_email && (
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Mail className="w-3 h-3" />
              <a href={`mailto:${o.customer_email}`} className="hover:text-white transition-colors truncate">{o.customer_email}</a>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4 space-y-2">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Dispositivo</h4>
          <div className="flex items-center gap-2">
            <DeviceIcon type={o.device_type} />
            <p className="text-sm font-bold text-white">
              {[o.device_brand, o.device_model].filter(Boolean).join(" ") || o.device_type || "—"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/50">
            {o.device_color && <InfoField label="Color" value={o.device_color} />}
            {o.device_imei && <InfoField label="IMEI" value={o.device_imei} />}
          </div>
        </div>
      </div>

      {/* ── Problem ── */}
      {o.initial_problem && (
        <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1.5">Problema reportado</h4>
          <EditableField orderId={o.id} field="initial_problem" value={o.initial_problem} onUpdate={onUpdate} className="text-sm text-white/80 leading-relaxed" multiline />
        </div>
      )}

      {/* ── Hidden photo input ── */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handlePhotoUpload}
        disabled={uploading}
      />

      {/* ── Photos thumbnail strip ── */}
      {(() => {
        const allPhotos = (Array.isArray(o.photos_metadata) ? o.photos_metadata : [])
          .map(p => p?.publicUrl || p?.thumbUrl || p?.url).filter(Boolean);
        if (allPhotos.length === 0 && !uploading) return null;
        return (
          <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30">Fotos ({allPhotos.length})</h4>
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                {uploading ? "Subiendo..." : "Subir"}
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {allPhotos.slice(0, 6).map((src, i) => (
                <img key={`${src}-${i}`} src={src} alt={`Foto ${i + 1}`} className="h-14 w-14 rounded-lg object-cover border border-white/10 shrink-0" loading="lazy" />
              ))}
              {allPhotos.length > 6 && (
                <div className="h-14 w-14 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-xs text-white/40 shrink-0">
                  +{allPhotos.length - 6}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Stage-specific content ── */}
      {children}

      {/* ── Financial Summary ── */}
      <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-3">Resumen financiero</h4>

        {/* Items list */}
        {items.length > 0 ? (
          <div className="space-y-1 mb-3">
            {items.map((item, i) => (
              <div key={item.id || i} className="flex items-center justify-between text-xs">
                <span className="text-white/70 truncate flex-1">
                  {item.name || item.product_name || item.service_name || "Item"}
                  {Number(item.quantity || 1) > 1 && <span className="text-white/30 ml-1">×{item.quantity}</span>}
                </span>
                <span className="text-white/90 font-semibold ml-3">${(Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/30 mb-3">Sin items registrados</p>
        )}

        {/* Totals */}
        <div className="border-t border-white/[0.06] pt-2 space-y-1 text-xs">
          <div className="flex justify-between text-white/40">
            <span>Subtotal</span><span>${financial.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-white/40">
            <span>IVU (11.5%)</span><span>${financial.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-white font-bold text-sm pt-1">
            <span>Total</span><span>${financial.total.toFixed(2)}</span>
          </div>
          {financial.paid > 0 && (
            <div className="flex justify-between text-emerald-400">
              <span>Pagado</span><span>${financial.paid.toFixed(2)}</span>
            </div>
          )}
          {financial.balance > 0.01 && (
            <div className="flex justify-between text-red-400 font-bold">
              <span>Balance</span><span>${financial.balance.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Pay button */}
        {financial.balance > 0.01 && (
          <button
            onClick={() => onPaymentClick?.("full")}
            className="w-full mt-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all active:scale-95"
          >
            Cobrar ${financial.balance.toFixed(2)}
          </button>
        )}
      </div>

      {/* ── Comment Input ── */}
      <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">Agregar nota</h4>
        <div className="flex gap-2">
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Escribe un comentario..."
            className="flex-1 bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-cyan-500/50"
            onKeyDown={e => { if (e.key === "Enter") postComment(); }}
          />
          <button
            onClick={postComment}
            disabled={posting || !comment.trim()}
            className="px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-30"
          >
            {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Timeline / History ── */}
      <div className="rounded-xl border border-white/[0.08] bg-[#121215] overflow-hidden">
        <WorkOrderTimeline key={timelineKey} order={order} onUpdate={onUpdate} hideComposer hideProblem />
      </div>

      {/* ── Add Item Modal ── */}
      <AddItemModal
        open={showCatalog}
        onClose={() => setShowCatalog(false)}
        order={o}
        onItemsUpdated={(newItems) => {
          onOrderItemsUpdate?.(newItems);
          setShowCatalog(false);
        }}
        onRemoteSaved={onRemoteSaved}
      />
    </div>
  );
}

// ── Inline Editable Field ──
function EditableField({ orderId, field, value, onUpdate, className, multiline }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (editValue === value || !orderId) { setEditing(false); return; }
    setSaving(true);
    try {
      await base44.entities.Order.update(orderId, { [field]: editValue });
      onUpdate?.();
      toast.success("Actualizado");
    } catch {
      toast.error("Error al guardar");
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [editValue, value, orderId, field, onUpdate]);

  if (editing) {
    const inputCls = "w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-cyan-500";
    return (
      <div className="flex items-start gap-1.5">
        {multiline ? (
          <textarea value={editValue} onChange={e => setEditValue(e.target.value)} className={inputCls + " min-h-[60px] resize-none"} autoFocus onKeyDown={e => { if (e.key === "Escape") setEditing(false); }} />
        ) : (
          <input value={editValue} onChange={e => setEditValue(e.target.value)} className={inputCls} autoFocus onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }} />
        )}
        <button onClick={save} disabled={saving} className="p-1 rounded-md hover:bg-white/10 text-emerald-400"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={() => setEditing(false)} className="p-1 rounded-md hover:bg-white/10 text-white/40"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-1.5 cursor-pointer" onClick={() => { setEditValue(value || ""); setEditing(true); }}>
      <span className={className}>{value || "—"}</span>
      <Pencil className="w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
    </div>
  );
}

function InfoField({ label, value }) {
  return (
    <div>
      <span className="text-white/30">{label}: </span>
      <span className="text-white/70">{value}</span>
    </div>
  );
}
