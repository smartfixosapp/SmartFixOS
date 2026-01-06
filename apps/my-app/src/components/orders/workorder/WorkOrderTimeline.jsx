import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Activity, User, Send, ImagePlus, Camera } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import GalleryModal from "@/components/common/GalleryModal";

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
      const rows = await base44.entities.WorkOrderEvent.filter({ order_id: order.id });
      rows.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setEvents(rows);
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
      await base44.entities.WorkOrderEvent.create({
        order_id: order.id,
        order_number: order.order_number,
        event_type: "note",
        description: body,
        user_id: me?.id,
        user_name: me?.full_name || me?.email,
        user_role: me?.role,
        metadata: { note_text: body },
      });

      setText("");
      await loadEvents();
      onUpdate?.({});
    } catch (e) {
      console.error("Error enviando nota", e);
      alert("No se pudo enviar la nota");
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
    <Card className="bg-gradient-to-br from-[#2B2B2B] to-black border-red-900/30">
      <CardHeader className="border-b border-red-900/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#FF0000]" />
            Historial & Comentarios
          </CardTitle>

          {/* Botones de foto/cámara */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={onFilesPicked}
            />
            <Button
              variant="outline"
              className="h-8 border-white/20 bg-white/5"
              onClick={openFilePicker}
              disabled={uploading}
              title="Añadir foto o usar la cámara"
            >
              <Camera className="w-4 h-4 mr-2" />
              {uploading ? "Subiendo..." : "Foto / Cámara"}
            </Button>
            <Button
              variant="outline"
              className="h-8 border-white/20 bg-white/5"
              onClick={openFilePicker}
              disabled={uploading}
              title="Adjuntar imágenes"
            >
              <ImagePlus className="w-4 h-4 mr-2" />
              Adjuntar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Composer */}
        <div className="rounded-xl border border-white/10 bg-black/30 p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Escribe un comentario… (Enter para enviar, Shift+Enter para nueva línea)"
            className="bg-black/40 border-gray-700 text-white min-h-[72px]"
          />

          <div className="mt-2 flex items-center justify-between gap-2">
            {/* Cola de subida */}
            {uploadQueue.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto max-w-[65%]">
                {uploadQueue.map(item => (
                  <div
                    key={item.id}
                    className="relative w-12 h-12 rounded-md overflow-hidden border border-white/15 bg-black/50"
                    title={item.name}
                  >
                    {item.previewUrl ? (
                      <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
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
              <Button onClick={sendNote} disabled={busySend || !text.trim()} className="h-8">
                <Send className="w-4 h-4 mr-2" />
                {busySend ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="text-center py-6 text-gray-500">Cargando…</div>
        ) : events.length === 0 ? (
          <div className="text-center py-6 text-gray-500">No hay eventos</div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto app-scroll">
            {events.map((event, idx) => {
              const isAttachment = (event.event_type || "").includes("attachment");
              const url = event?.metadata?.url || null;
              const filename = event?.metadata?.filename || null;

              return (
                <div key={event.id || idx} className="rounded-lg border border-white/10 bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 text-white/80">
                      <span className="w-8 h-8 rounded-full bg-white/10 grid place-items-center shrink-0">
                        <Activity className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-white break-words">
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
                                      className="max-h-48 rounded-md border border-white/10 mt-1 cursor-zoom-in"
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

                        <div className="mt-1 flex items-center gap-2 text-[11px] text-white/50">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> {event.user_name}
                          </span>
                          {event.user_role && (
                            <Badge variant="outline" className="text-[10px]">
                              {event.user_role}
                            </Badge>
                          )}
                          <span>
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
