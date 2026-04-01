import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Activity, User, Send, ImagePlus, Camera, Sparkles, Clock3 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import GalleryModal from "@/components/common/GalleryModal";
import DeviceConditionMap from "@/components/workorder/DeviceConditionMap";
import { toast } from "sonner";
import { loadOrderLinks } from "@/components/workorder/utils/orderLinksStore";

/* Mini util para enlazar URLs en el texto */
function linkify(text = "") {
  const parts = [];
  const urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;
  let lastIndex = 0;
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    const url = m[0];
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index));
    const href = url.startsWith("http") ? url : `https://${url}`;
    parts.push(
      <a
        key={`${href}-${m.index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline text-blue-300 hover:text-blue-200 break-all"
      >
        {url}
      </a>
    );
    lastIndex = m.index + url.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

const isImageUrl = (url = "") =>
  /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i.test(url);

export default function WorkOrderTimeline({ order, onUpdate }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);
  const [text, setText] = useState("");
  const [busySend, setBusySend] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const fileInputRef = useRef(null);

  // Lightbox / Galería
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me().catch(() => null);
        setMe(u);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    loadEvents();
  }, [order?.id]);

  const loadEvents = async () => {
    if (!order?.id) return;
    setLoading(true);
    try {
      const byOrderId = await base44.entities.WorkOrderEvent.filter({ order_id: order.id }).catch(() => []);
      const byOrderNumber =
        (!Array.isArray(byOrderId) || byOrderId.length === 0) && order?.order_number
          ? await base44.entities.WorkOrderEvent.filter({ order_number: order.order_number }).catch(() => [])
          : [];

      const fetched = Array.isArray(byOrderId) && byOrderId.length > 0 ? byOrderId : byOrderNumber;
      const freshOrder = await base44.entities.Order.get(order.id).catch(() => order);
      const commentEvents = (Array.isArray(freshOrder?.comments) ? freshOrder.comments : []).map((comment, index) => ({
        id: comment.id || `comment-${index}`,
        event_type: "comment",
        description: comment.text || "",
        user_name: comment.author || "Sistema",
        created_date: comment.timestamp || freshOrder?.updated_date || new Date().toISOString(),
        metadata: {
          internal: comment.internal === true,
          source: "order_comment",
        },
      }));

      const mergedMap = new Map();
      [...fetched, ...commentEvents].forEach((row, index) => {
        const key = row?.id || `${row?.event_type || "event"}-${row?.created_date || index}-${index}`;
        if (!mergedMap.has(key)) mergedMap.set(key, row);
      });

      const merged = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(b.created_date || b.created_at || 0) - new Date(a.created_date || a.created_at || 0)
      );
      setEvents(merged);
    } catch (e) {
      console.error("Error loading events", e);
    } finally {
      setLoading(false);
    }
  };

  const sendNote = async () => {
    if (busySend) return;
    const body = (text || "").trim();
    if (!body) return;

    setBusySend(true);
    try {
      const created = await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "note_added",
        description: body,
        user_id: me?.id,
        user_name: me?.full_name || me?.email,
        user_role: me?.role,
        metadata: { note_text: body },
      });

      const optimisticEvent = created || {
        id: `local-note-${Date.now()}`,
        order_id: order.id,
        order_number: order.order_number,
        event_type: "note_added",
        description: body,
        user_id: me?.id,
        user_name: me?.full_name || me?.email || "Usuario",
        user_role: me?.role,
        created_date: new Date().toISOString(),
        metadata: { note_text: body },
      };

      setEvents((prev) => [optimisticEvent, ...prev]);
      setText("");
      toast.success("Comentario guardado");
      setTimeout(() => {
        loadEvents();
      }, 250);
      onUpdate?.({});
    } catch (e) {
      console.error("Error enviando nota", e);
      toast.error("No se pudo enviar la nota");
    } finally {
      setBusySend(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendNote();
    }
  };

  /* ---------- Subida de imágenes ---------- */

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  const onFilesPicked = async (e) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
    if (!files.length) return;
    await uploadImages(files);
    e.target.value = "";
  };

  const uploadViaGeneric = async (file) => {
    // Use Core.UploadFile integration
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    return { url: file_url, thumbUrl: file_url };
  };

  const createPhotoEvent = async ({ url, filename }) => {
    try {
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "attachment",
        description: `Foto subida: ${filename}`,
        user_id: me?.id,
        user_name: me?.full_name || me?.email,
        user_role: me?.role,
        metadata: { type: "image", url, filename }
      });
    } catch (e) {
      console.error("No se pudo crear evento de foto", e);
    }
  };

  const uploadImages = useCallback(async (files) => {
    if (!order?.id) return;
    setUploading(true);

    // Optimista: mostrar cola con previews
    const optimistic = files.map((f, i) => ({
      id: `${Date.now()}-${i}`,
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      done: false,
      url: null,
      failed: false
    }));
    setUploadQueue(prev => [...optimistic, ...prev]);

    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        let out = null;

        try {
          out = await uploadViaGeneric(f);
        } catch (uploadError) {
          console.error("Error uploading file:", uploadError);
          // Mark as failed and continue
          setUploadQueue(prev =>
            prev.map(item => item.name === f.name && !item.done
              ? { ...item, done: true, failed: true }
              : item
            )
          );
          continue;
        }

        // Create event in the timeline
        if (out?.url) {
          await createPhotoEvent({ url: out.url, filename: f.name });
        }

        // marca done en UI
        setUploadQueue(prev =>
          prev.map(item => item.name === f.name && !item.done
            ? { ...item, done: true, url: out?.url || null }
            : item
          )
        );
      }
      await loadEvents();
      onUpdate?.({});
    } catch (e) {
      console.error("Error subiendo imágenes", e);
      alert("No se pudieron subir algunas imágenes.");
    } finally {
      setUploading(false);
      // limpiar los objectURLs en un rato
      setTimeout(() => {
        setUploadQueue(prev => prev.filter(x => !x.previewUrl || x.done));
      }, 1200);
    }
  }, [order?.id, me]);

  /* ---------- Construye lista de imágenes para la galería ---------- */
  const galleryImages = useMemo(() => {
    const imgs = [];
    events.forEach(ev => {
      const url = ev?.metadata?.url || "";
      if ((ev.event_type || "").includes("attachment") && isImageUrl(url)) {
        imgs.push(url);
      }
    });
    return imgs;
  }, [events]);

  const openLightboxWith = (url) => {
    const idx = galleryImages.findIndex((u) => u === url);
    setLightboxIndex(Math.max(0, idx));
    setLightboxOpen(true);
  };

  return (
    <Card className="overflow-hidden rounded-[28px] border border-cyan-500/15 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.10),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(8,145,178,0.08),transparent_28%),linear-gradient(180deg,rgba(28,28,30,0.98),rgba(10,10,12,0.98))] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <CardHeader className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 to-transparent px-6 py-5">
        <CardTitle className="flex items-center gap-3 text-2xl font-black tracking-tight text-white">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-500/15 shadow-[0_10px_30px_rgba(34,211,238,0.12)]">
            <Sparkles className="h-5 w-5 text-cyan-300" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Linea de tiempo</p>
            <span>Historial & Comentarios</span>
          </div>
        </CardTitle>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={onFilesPicked}
        />
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        {(order?.initial_problem || order?.comments) && (
          <div className="rounded-[22px] border border-orange-500/20 bg-[linear-gradient(135deg,rgba(249,115,22,0.10),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-200/70">Problema reportado</p>
              <Badge className="rounded-full border-white/10 bg-white/5 px-3 py-1 text-white/70">Recepción</Badge>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/80">
              {order?.initial_problem || order?.comments || "Sin descripción del problema."}
            </p>
          </div>
        )}

        {/* Composer */}
        <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Nuevo comentario</p>
              <p className="mt-1 text-sm text-white/50">Registra acuerdos, hallazgos y contexto importante sin salir de la orden.</p>
            </div>
            <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/45 sm:block">
              Enter para enviar
            </div>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe un comentario… (Enter para enviar, Shift+Enter para nueva línea)"
            className="min-h-[88px] rounded-[18px] border-white/10 bg-black/35 text-white placeholder:text-white/28"
          />

          <div className="mt-4 flex items-center justify-between gap-2">
            {/* Cola de subida */}
            {uploadQueue.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto max-w-[65%]">
                {uploadQueue.map(item => (
                  <div
                    key={item.id}
                    className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/15 bg-black/50"
                    title={item.name}
                  >
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-white/40 text-[10px] px-1 text-center">IMG</div>
                    )}
                    {!item.done && (
                      <div className="absolute inset-0 bg-black/60 grid place-items-center text-[10px] text-white/80">
                        {uploading ? "Subiendo…" : "Pendiente"}
                      </div>
                    )}
                    {item.failed && (
                      <div className="absolute inset-0 bg-red-600/80 grid place-items-center text-[10px] text-white">
                        Error
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="ml-auto">
              <Button
                onClick={sendNote}
                disabled={busySend || !text.trim()}
                className="h-11 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-5 font-bold text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.22)] hover:from-cyan-400 hover:to-sky-400"
              >
                <Send className="w-4 h-4 mr-2" />
                {busySend ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="text-center py-6 text-gray-500">Cargando…</div>
        ) : events.length === 0 && !((order?.checklist_items?.length || 0) > 0 || (order?.device_condition_map?.length || 0) > 0) ? (
          <div className="text-center py-6 text-gray-500">No hay eventos</div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto app-scroll">
            {((order?.checklist_items?.length || 0) > 0 || (order?.device_condition_map?.length || 0) > 0) && (
              <div className="rounded-[22px] border border-cyan-500/20 bg-cyan-500/5 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-200/65">Recepción inicial</p>
                    <p className="mt-1 text-sm text-white/70">Condiciones visibles y checklist documentados al recibir el equipo.</p>
                  </div>
                  <Badge className="rounded-full border-white/10 bg-white/5 text-white">
                    {(order?.checklist_items?.length || 0) + (order?.device_condition_map?.length || 0)} registros
                  </Badge>
                </div>

                {Array.isArray(order?.device_condition_map) && order.device_condition_map.length > 0 && (
                  <div className="mb-4">
                    <DeviceConditionMap
                      markers={order.device_condition_map}
                      editable={false}
                      title="Daños marcados visualmente"
                      subtitle="Referencia visual capturada durante la recepción."
                    />
                  </div>
                )}

                {Array.isArray(order?.checklist_items) && order.checklist_items.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {order.checklist_items.map((item, index) => (
                      <Badge key={`${item.id || item.key || index}-${index}`} className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-rose-100">
                        {item.label || item.issue_label || item.id}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {events.map((event, idx) => {
              const isAttachment = (event.event_type || "").includes("attachment");
              const url = event?.metadata?.url || null;
              const filename = event?.metadata?.filename || null;

              return (
                <div key={event.id || idx} className="rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors hover:bg-white/[0.035]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 text-white/80">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5">
                        <Activity className="h-4 w-4 text-cyan-300" />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-[17px] font-bold text-white">
                          {!isAttachment ? (
                            linkify(event.description || "")
                          ) : (
                            <>
                              {event.description || "Archivo adjunto"}
                              {url && (
                                <div className="mt-2">
                                  {isImageUrl(url) ? (
                                    <img
                                      src={url}
                                      alt={filename || "foto"}
                                      className="mt-2 max-h-48 cursor-zoom-in rounded-xl border border-white/10"
                                      onClick={() => openLightboxWith(url)}
                                    />
                                  ) : (
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="underline text-blue-300 break-all"
                                    >
                                      {filename || url}
                                    </a>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </p>

                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {event.user_name}
                          </span>
                          {event.user_role && (
                            <Badge variant="outline" className="text-[10px]">
                              {event.user_role}
                            </Badge>
                          )}
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-3 w-3" />
                            {event.created_date
                              ? format(new Date(event.created_date), "dd MMM yyyy HH:mm", { locale: es })
                              : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Lightbox / Galería */}
      <GalleryModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        images={galleryImages}
        startIndex={lightboxIndex}
      />
    </Card>
  );
}
