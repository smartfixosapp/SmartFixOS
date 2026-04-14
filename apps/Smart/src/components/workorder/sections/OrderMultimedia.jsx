import React, { useEffect, useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Image as ImageIcon, Loader2, Share2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import GalleryModal from "@/components/common/GalleryModal";
import { toast } from "sonner";
import { getOrderStageContext, logWorkOrderPhotoEvent } from "@/components/workorder/utils/auditEvents";

const PHOTO_STAGE_OPTIONS = [
  { id: "intake", label: "Recepcion" },
  { id: "diagnosing", label: "Diagnostico" },
  { id: "in_progress", label: "En reparacion" },
  { id: "ready_for_pickup", label: "Listo para entrega" },
  { id: "delivered", label: "Entrega" }
];

function resolveDefaultPhotoStage(order) {
  const { stageId, stageLabel } = getOrderStageContext(order);
  if (stageId === "intake") return { id: "intake", label: "Recepcion" };
  if (stageId === "diagnosing" || stageId === "pending_order" || stageId === "waiting_parts") {
    return { id: "diagnosing", label: "Diagnostico" };
  }
  if (stageId === "in_progress" || stageId === "reparacion_externa") {
    return { id: "in_progress", label: "En reparacion" };
  }
  if (stageId === "ready_for_pickup" || stageId === "delivered" || stageId === "completed") {
    return { id: "ready_for_pickup", label: "Listo para entrega" };
  }
  return { id: stageId || "general", label: stageLabel || "General" };
}

function normalizePhotoStage(photo, order) {
  if (photo?.stage_id && photo?.stage_label) {
    return { stageId: photo.stage_id, stageLabel: photo.stage_label };
  }
  if (photo?.stage_id) {
    const known = PHOTO_STAGE_OPTIONS.find((item) => item.id === photo.stage_id);
    return { stageId: photo.stage_id, stageLabel: known?.label || photo.stage_id };
  }
  if (photo?.stage || photo?.stage_label) {
    return {
      stageId: photo.stage || photo.stage_label,
      stageLabel: photo.stage_label || photo.stage || "General"
    };
  }
  return { stageId: "general", stageLabel: "General" };
}

export default function OrderMultimedia({ order, onUpdate }) {
  const o = order || {};
  const [uploading, setUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedStage, setSelectedStage] = useState(() => resolveDefaultPhotoStage(order).id);

  useEffect(() => {
    setSelectedStage(resolveDefaultPhotoStage(order).id);
  }, [order?.id, order?.status]);

  const photos = useMemo(() => {
    const source = o.photos_metadata || o.device_photos || [];
    return (Array.isArray(source) ? source : [])
      .filter((item) => !(item?.type === "video" || item?.mime?.startsWith("video")))
      .map((item, index) => {
        const { stageId, stageLabel } = normalizePhotoStage(item, order);
        return {
          ...item,
          stage_id: stageId,
          stage_label: stageLabel,
          sort_key: item?.captured_at || item?.uploaded_at || item?.created_date || item?.created_at || `${index}`
        };
      });
  }, [o.photos_metadata, o.device_photos]);

  const groupedPhotos = useMemo(() => {
    const groups = new Map();
    for (const option of PHOTO_STAGE_OPTIONS) {
      groups.set(option.id, { id: option.id, label: option.label, items: [] });
    }
    if (!groups.has("general")) {
      groups.set("general", { id: "general", label: "General", items: [] });
    }

    for (const photo of photos) {
      const key = photo.stage_id || "general";
      if (!groups.has(key)) {
        groups.set(key, { id: key, label: photo.stage_label || "General", items: [] });
      }
      groups.get(key).items.push(photo);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => String(b.sort_key).localeCompare(String(a.sort_key)))
      }))
      .filter((group) => group.items.length > 0);
  }, [photos]);

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !o?.id) return;

    setUploading(true);
    try {
      let me = null;
      try {
        me = await base44.auth.me();
      } catch {}

      const stage = PHOTO_STAGE_OPTIONS.find((option) => option.id === selectedStage) || resolveDefaultPhotoStage(order);
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
            stage_id: stage.id,
            stage_label: stage.label,
            captured_at: new Date().toISOString(),
            captured_by: me?.full_name || me?.email || "Sistema"
          });
        } catch (uploadError) {
          console.error("Error uploading evidence file:", uploadError);
        }
      }

      if (!newItems.length) {
        throw new Error("No se pudo subir ninguna imagen");
      }

      const next = [...photos, ...newItems];
      await base44.entities.Order.update(o.id, { photos_metadata: next });

      onUpdate?.();

      try {
        await logWorkOrderPhotoEvent({
          order: o,
          count: newItems.length,
          source: "order_multimedia"
        });
      } catch (eventError) {
        console.warn("Photo event logging skipped:", eventError);
      }

      toast.success(`${newItems.length} archivo(s) subido(s) correctamente`);
    } catch (err) {
      console.error(err);
      toast.error("Error al subir archivos");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleShare(photo) {
    const url = photo?.publicUrl || photo?.thumbUrl || photo?.url;
    if (!url) return;

    const text = `Foto de evidencia de la orden ${o?.order_number || ""}`.trim();

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Orden ${o?.order_number || ""}`.trim(),
          text,
          url,
        });
        return;
      }
    } catch (error) {
      console.error("Error sharing photo", error);
    }

    try {
      const shareByWhatsApp = window.confirm("¿Quieres compartir esta foto por WhatsApp? Pulsa Cancelar para copiar el link.");
      if (shareByWhatsApp) {
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link de la foto copiado. Ya puedes compartirlo por WhatsApp o donde necesites.");
    } catch {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] overflow-hidden shadow-lg">
      <div className="border-b border-white/10 py-3 px-5 bg-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-cyan-400" />
            Fotos y Evidencias
          </h3>
          <div className="flex items-center gap-2">
            {/* Selector de etapa: oculto en móvil para no desplazar el botón de cámara */}
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="hidden sm:block h-9 rounded-xl border border-white/10 bg-black/30 px-3 text-xs font-semibold text-white outline-none theme-light:border-gray-300 theme-light:bg-white theme-light:text-gray-900"
            >
              {PHOTO_STAGE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {/* Botón de cámara — icono, siempre visible en móvil */}
            <label
              className={`inline-flex items-center justify-center w-9 h-9 rounded-xl cursor-pointer transition-all hover:scale-105 active:scale-95 flex-shrink-0 ${
                uploading
                  ? "bg-white/10 text-gray-400 cursor-not-allowed"
                  : "bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-900/20"
              }`}
              title="Subir foto"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              <input type="file" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.html,.htm,.csv,.rtf,.odt,.ods" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
            </label>
          </div>
        </div>
      </div>
      <div className="p-5">
        {photos.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-2xl bg-black/20">
              <ImageIcon className="w-10 h-10 mx-auto text-white/50 mb-2" />
              <p className="text-white/40 text-sm">No hay fotos cargadas</p>
            </div>
          ) : (
          <div className="space-y-5">
            {groupedPhotos.map((group) => (
              <div key={group.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">{group.label}</p>
                    <p className="text-xs text-white/45">{group.items.length} evidencia{group.items.length === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {group.items.map((photo) => {
                    const src = photo.publicUrl || photo.thumbUrl || "";
                    const globalIndex = photos.findIndex((item) => item.id === photo.id);
                    return (
                      <div key={photo.id || src} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
                        <button
                          type="button"
                          onClick={() => {
                            setGalleryIndex(globalIndex >= 0 ? globalIndex : 0);
                            setGalleryOpen(true);
                          }}
                          className="block aspect-square w-full"
                        >
                          <img
                            src={src}
                            alt={photo.filename || group.label}
                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs font-medium text-white/75">
                              {photo.filename || "Foto"}
                            </span>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
                              onClick={() => handleShare(photo)}
                              aria-label={`Compartir foto ${photo.filename || ""}`}
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="mt-1 flex flex-col gap-0.5">
                            {photo.captured_at && (
                              <span className="text-[10px] text-white/55">
                                {new Date(photo.captured_at).toLocaleString("es-PR")}
                              </span>
                            )}
                            {photo.captured_by && (
                              <span className="text-[10px] text-white/40">{photo.captured_by}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <GalleryModal
        open={galleryOpen}
        photos={photos}
        initialIndex={galleryIndex}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  );
}
