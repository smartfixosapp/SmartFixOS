import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Phone, MessageCircle, Mail, Smartphone, Laptop, Tablet, Watch, Gamepad2, Box, Pencil, Check, X, Plus, Send, Loader2, Camera, Image as ImageIcon, Brain } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import AddItemModal from "@/components/workorder/AddItemModal";
import JeaniDiagnosticPanel from "@/components/workorder/JeaniDiagnosticPanel";
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
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [timelineKey, setTimelineKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const photoInputRef = useRef(null);

  // Listen for ALL sidebar action events
  useEffect(() => {
    const handler = (e) => {
      const action = e.detail?.action;
      if (action === "catalog") setShowCatalog(true);
      if (action === "photos") photoInputRef.current?.click();
      if (action === "notify") {
        const ph = (e.detail?.order?.customer_phone || "").replace(/\D/g, "");
        if (ph) window.open(`https://wa.me/${ph}`, "_blank");
      }
      // checklist, links, tracking, quote, approval — handled by stage components directly via wo:action
      if (action === "quote") document.dispatchEvent(new CustomEvent("wo:send-quote"));
      // Open JEANI assistant — carga contenido de archivos HTML/TXT adjuntos primero
      if (action === "ai") {
        (async () => {
          const ord = e.detail?.order || {};
          const photos = Array.isArray(ord.photos_metadata) ? ord.photos_metadata : [];
          // Extraer contenido de archivos HTML/TXT para que JEANI los pueda analizar
          const textAttachments = [];
          for (const f of photos) {
            const mime = f?.mime || "";
            const name = f?.filename || "";
            const url = f?.publicUrl || f?.thumbUrl || f?.url;
            if (!url) continue;
            const isHtml = mime === "text/html" || /\.(html|htm)$/i.test(name);
            const isText = mime.startsWith("text/") || /\.(txt|csv|log|json)$/i.test(name);
            if (!isHtml && !isText) continue;
            try {
              const res = await fetch(url);
              let content = await res.text();
              // Si es HTML, extraer solo el texto visible (sin tags)
              if (isHtml) {
                const tmp = document.createElement("div");
                tmp.innerHTML = content;
                // Remover scripts y styles
                tmp.querySelectorAll("script,style").forEach(el => el.remove());
                content = (tmp.innerText || tmp.textContent || "").trim();
              }
              // Limitar tamaño para no sobrecargar el prompt
              if (content.length > 6000) content = content.slice(0, 6000) + "\n...[truncado]";
              textAttachments.push({ filename: name, type: isHtml ? "HTML" : "Texto", content });
            } catch (err) {
              console.warn("[JEANI] No se pudo leer adjunto:", name, err);
            }
          }
          const orderWithAttachments = { ...ord, _textAttachments: textAttachments };
          const evt = new CustomEvent("wo:open-jeani", { detail: { order: orderWithAttachments } });
          window.dispatchEvent(evt);
          document.dispatchEvent(evt);
        })();
      }
      // Add note from sidebar
      if (action === "add-note") {
        const input = document.querySelector("[data-note-input]");
        if (input) { input.focus(); input.scrollIntoView({ behavior: "smooth", block: "center" }); }
      }
      // Mark order as quick (saltar regla secuencial)
      if (action === "mark-quick") {
        const ord = e.detail?.order;
        if (!ord?.id) return;
        (async () => {
          try {
            const prevMeta = ord.status_metadata && typeof ord.status_metadata === "object" ? ord.status_metadata : {};
            await base44.entities.Order.update(ord.id, {
              status_metadata: { ...prevMeta, quick_order: true, marked_quick_at: new Date().toISOString() }
            });
            toast.success("⚡ Marcada como reparación rápida — ya no bloquea el flujo");
            onUpdate?.();
          } catch (err) {
            toast.error("No se pudo marcar como rápida");
            console.error(err);
          }
        })();
      }
    };
    document.addEventListener("wo:action", handler);
    return () => document.removeEventListener("wo:action", handler);
  }, [onUpdate]);

  // Local photo state for instant display
  const [localPhotos, setLocalPhotos] = useState([]);
  useEffect(() => {
    setLocalPhotos(Array.isArray(o.photos_metadata) ? o.photos_metadata : []);
  }, [o.photos_metadata]);

  // Photo/file upload handler with optimistic UI
  // Acepta imágenes, videos, PDFs, documentos, y otros archivos
  const handlePhotoUpload = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
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
          // Detectar tipo de archivo
          const mime = file.type || "application/octet-stream";
          let fileType = "file";
          if (mime.startsWith("image/")) fileType = "image";
          else if (mime.startsWith("video/")) fileType = "video";
          else if (mime === "application/pdf") fileType = "pdf";
          else if (mime.includes("document") || mime.includes("word")) fileType = "document";
          // Detectar stage actual de la orden para categorizar el archivo
          const currentStatus = o.status || "intake";
          const stageLabelMap = {
            intake: "Recepción",
            diagnosing: "Diagnóstico",
            in_progress: "Reparación",
            waiting_parts: "Esperando Piezas",
            pending_order: "Pendiente Ordenar",
            part_arrived_waiting_device: "Pieza Lista",
            ready_for_pickup: "Listo Recoger",
            delivered: "Entregado",
            completed: "Completado",
            warranty: "Garantía",
            reparacion_externa: "Reparación Externa",
            awaiting_approval: "Esperando Aprobación",
          };
          newItems.push({
            id: `${Date.now()}-${file.name}`,
            type: fileType,
            mime,
            filename: file.name,
            publicUrl: versionedUrl,
            thumbUrl: versionedUrl,
            stage_id: currentStatus,
            stage_label: stageLabelMap[currentStatus] || "General",
            captured_at: new Date().toISOString(),
            captured_by: me?.full_name || me?.email || "Sistema"
          });
        } catch (err) {
          console.error("Upload error:", err);
        }
      }
      if (!newItems.length) throw new Error("No se pudo subir");
      const merged = [...localPhotos, ...newItems];
      // Optimistic: update local state immediately
      setLocalPhotos(merged);
      // Persist to DB
      await base44.entities.Order.update(o.id, { photos_metadata: merged });
      onUpdate?.();
      try { await logWorkOrderPhotoEvent({ order: o, count: newItems.length, source: "detail_center" }); } catch {}
      toast.success(`${newItems.length} foto(s) subida(s)`);
    } catch {
      toast.error("Error al subir fotos");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }, [o, onUpdate, localPhotos]);

  const items = useMemo(() => Array.isArray(o.order_items) ? o.order_items : [], [o.order_items]);

  // Financial summary (respects discount_percentage and taxable per item)
  // Always calculated from items — never trust stale DB values
  const financial = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const base = Number(item.price || 0) * Number(item.quantity || item.qty || 1);
      const discount = Number(item.discount_percentage || item.discount_percent || 0);
      return sum + (base - base * (discount / 100));
    }, 0);
    const taxableBase = items.reduce((sum, item) => {
      if (item.taxable === false) return sum;
      const base = Number(item.price || 0) * Number(item.quantity || item.qty || 1);
      const discount = Number(item.discount_percentage || item.discount_percent || 0);
      return sum + (base - base * (discount / 100));
    }, 0);
    const tax = taxableBase * IVU_RATE;
    // Always calculate total as subtotal + tax, not from stale DB value
    const total = subtotal + tax;
    const paid = Number(o.amount_paid ?? o.total_paid ?? o.deposit_amount ?? 0);
    const balance = Math.max(0, total - paid);
    return { subtotal, tax, total, paid, balance };
  }, [items, o.amount_paid, o.total_paid, o.deposit_amount]);

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

      {/* ── Diagnóstico IA — botón + panel ── */}
      {!showDiagnostic ? (
        <button
          onClick={() => setShowDiagnostic(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-violet-500/[0.08] border border-violet-500/20 text-violet-300 text-xs font-black hover:bg-violet-500/15 transition-all active:scale-[0.98]"
        >
          <Brain className="w-4 h-4" />
          🧠 Diagnóstico IA — Analizar historial del cliente
        </button>
      ) : (
        <JeaniDiagnosticPanel
          order={o}
          onClose={() => setShowDiagnostic(false)}
        />
      )}

      {/* ── Hidden file input — acepta cualquier archivo ── */}
      <input
        ref={photoInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handlePhotoUpload}
        disabled={uploading}
      />

      {/* ── Attachments thumbnail strip (imágenes + documentos) ── */}
      {(() => {
        const validAttachments = localPhotos.filter(p => p?.publicUrl || p?.thumbUrl || p?.url);
        if (validAttachments.length === 0) return null;
        return (
          <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">
              Archivos ({validAttachments.length})
              {uploading && <span className="ml-2 text-cyan-400 animate-pulse">subiendo...</span>}
            </h4>
            <div className="flex gap-2 overflow-x-auto">
              {validAttachments.map((file, i) => {
                const src = file.publicUrl || file.thumbUrl || file.url;
                const mime = file.mime || "";
                const filename = file.filename || `Archivo ${i + 1}`;
                const stageLabel = file.stage_label || "";
                const stageId = file.stage_id || "";
                const stageColorMap = {
                  intake: "bg-blue-500/20 text-blue-300 border-blue-500/30",
                  diagnosing: "bg-purple-500/20 text-purple-300 border-purple-500/30",
                  in_progress: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
                  waiting_parts: "bg-orange-500/20 text-orange-300 border-orange-500/30",
                  pending_order: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
                  warranty: "bg-amber-500/20 text-amber-300 border-amber-500/30",
                };
                const stageBadgeClass = stageColorMap[stageId] || "bg-white/10 text-white/60 border-white/15";
                const isImage = file.type === "image" || mime.startsWith("image/");
                const isVideo = file.type === "video" || mime.startsWith("video/");
                const isPdf = file.type === "pdf" || mime === "application/pdf" || /\.pdf$/i.test(filename);
                const isHtml = mime === "text/html" || /\.(html|htm)$/i.test(filename);

                const handleClick = async () => {
                  if (isImage) {
                    setPreviewPhoto(src);
                    return;
                  }
                  // Para HTML: fetch contenido y abrir como blob para que el browser lo renderice como HTML
                  if (isHtml) {
                    try {
                      const res = await fetch(src);
                      const text = await res.text();
                      const blob = new Blob([text], { type: "text/html" });
                      const blobUrl = URL.createObjectURL(blob);
                      window.open(blobUrl, "_blank", "noopener,noreferrer");
                      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
                      return;
                    } catch (err) {
                      console.warn("HTML blob render failed, fallback to direct URL:", err);
                    }
                  }
                  // Default: abrir directamente
                  window.open(src, "_blank", "noopener,noreferrer");
                };

                return (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    onClick={handleClick}
                    title={filename}
                    className="h-14 w-14 rounded-lg overflow-hidden border border-white/10 shrink-0 hover:scale-105 transition-transform active:scale-95 relative bg-white/5"
                  >
                    {isImage ? (
                      <img src={src} alt={filename} className="h-full w-full object-cover" loading="lazy" />
                    ) : isVideo ? (
                      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-900/50 to-purple-950/50 text-purple-300">
                        <span className="text-lg">🎬</span>
                        <span className="text-[8px] font-bold mt-0.5">VIDEO</span>
                      </div>
                    ) : isPdf ? (
                      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-red-900/50 to-red-950/50 text-red-300">
                        <span className="text-lg">📄</span>
                        <span className="text-[8px] font-bold mt-0.5">PDF</span>
                      </div>
                    ) : isHtml ? (
                      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-orange-900/50 to-orange-950/50 text-orange-300">
                        <span className="text-lg">🌐</span>
                        <span className="text-[8px] font-bold mt-0.5">HTML</span>
                      </div>
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-cyan-900/50 to-cyan-950/50 text-cyan-300">
                        <span className="text-lg">📎</span>
                        <span className="text-[8px] font-bold mt-0.5 truncate px-1 w-full text-center">
                          {(filename.split(".").pop() || "FILE").toUpperCase().slice(0, 4)}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
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
            {items.map((item, i) => {
              const qty = Number(item.quantity || item.qty || 1);
              const base = Number(item.price || 0) * qty;
              const disc = Number(item.discount_percentage || item.discount_percent || 0);
              const lineTotal = base - base * (disc / 100);
              return (
                <div key={item.id || i} className="flex items-center justify-between text-xs">
                  <span className="text-white/70 truncate flex-1">
                    {item.name || item.product_name || item.service_name || "Item"}
                    {qty > 1 && <span className="text-white/30 ml-1">×{qty}</span>}
                    {disc > 0 && <span className="text-amber-400 ml-1">-{disc}%</span>}
                    {item.taxable === false && <span className="text-cyan-400/60 ml-1">sin IVU</span>}
                  </span>
                  <span className="text-white/90 font-semibold ml-3">${lineTotal.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-white/30 mb-3">Sin items registrados</p>
        )}

        {/* Totals */}
        <div className="border-t border-white/[0.06] pt-2 space-y-1 text-xs">
          <div className="flex justify-between text-white/60">
            <span>Subtotal</span><span className="font-semibold">${financial.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-cyan-400/80">
            <span>IVU (11.5%)</span><span className="font-semibold">+${financial.tax.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-white font-black text-base pt-2 border-t border-white/[0.06]">
            <span>TOTAL</span><span>${financial.total.toFixed(2)}</span>
          </div>
          {financial.paid > 0 && (
            <div className="flex justify-between text-emerald-400 pt-1">
              <span>Pagado</span><span className="font-semibold">-${financial.paid.toFixed(2)}</span>
            </div>
          )}
          {financial.balance > 0.01 && (
            <div className="flex justify-between text-red-400 font-black text-sm pt-1">
              <span>BALANCE</span><span>${financial.balance.toFixed(2)}</span>
            </div>
          )}
          {financial.balance <= 0.01 && financial.total > 0 && (
            <div className="flex justify-center pt-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-0.5">Saldado</span>
            </div>
          )}
        </div>

      </div>

      {/* ── Comment Input (inline, compact) ── */}
      <div className="flex gap-2">
        <input
          data-note-input
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Agregar nota..."
          className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-cyan-500/50"
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

      {/* ── Photo Lightbox ── */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4" onClick={() => setPreviewPhoto(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center" onClick={() => setPreviewPhoto(null)}>
            <X className="w-5 h-5" />
          </button>
          <img src={previewPhoto} alt="Vista previa" className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}
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
      <Pencil className="w-3 h-3 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0" />
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
