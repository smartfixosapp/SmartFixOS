import React, { useMemo, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Loader2, Share2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import GalleryModal from "@/components/common/GalleryModal";
import { toast } from "sonner";
import { logWorkOrderPhotoEvent } from "@/components/workorder/utils/auditEvents";

export default function OrderMultimedia({ order, onUpdate }) {
  const o = order || {};
  const [uploading, setUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const photos = useMemo(() => {
    const source = o.photos_metadata || o.device_photos || [];
    return (Array.isArray(source) ? source : []).filter((item) => !(item?.type === "video" || item?.mime?.startsWith("video")));
  }, [o.photos_metadata, o.device_photos]);

  async function handleUpload(e) {
    const files = Array.from(e.target.files || []).filter((file) => file.type?.startsWith("image/"));
    if (!files.length) return;

    setUploading(true);
    try {
      const newItems = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        newItems.push({
          id: `${Date.now()}-${file.name}`,
          type: "image",
          mime: file.type || "image/jpeg",
          filename: file.name,
          publicUrl: file_url,
          thumbUrl: file_url
        });
      }

      const next = [...photos, ...newItems];
      await base44.entities.Order.update(o.id, { photos_metadata: next });
      
      await logWorkOrderPhotoEvent({
        order: o,
        count: newItems.length,
        source: "order_multimedia"
      });

      onUpdate?.();
      toast.success("Archivos subidos correctamente");
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
          <label className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl cursor-pointer text-xs font-bold transition-all hover:scale-105 active:scale-95 ${uploading ? "bg-white/10 text-gray-400" : "bg-cyan-500 hover:bg-cyan-400 text-white shadow-lg shadow-cyan-900/20"}`}>
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Subir"}
            <input type="file" accept="image/*,video/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>
      <div className="p-5">
        {photos.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-2xl bg-black/20">
              <ImageIcon className="w-10 h-10 mx-auto text-white/20 mb-2" />
              <p className="text-white/40 text-sm">No hay fotos cargadas</p>
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo, idx) => {
              const src = photo.publicUrl || photo.thumbUrl || "";
              return (
                <div key={photo.id || idx} className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  <button
                    type="button"
                    onClick={() => {
                      setGalleryIndex(idx);
                      setGalleryOpen(true);
                    }}
                    className="block aspect-square w-full"
                  >
                    <img
                      src={src}
                      alt={`Foto ${idx + 1}`}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                      loading="lazy"
                    />
                  </button>
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/85 to-transparent p-2">
                    <span className="truncate text-xs font-medium text-white/75">
                      {photo.filename || `Foto ${idx + 1}`}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full bg-white/10 text-white hover:bg-white/20"
                      onClick={() => handleShare(photo)}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <GalleryModal
        open={galleryOpen}
        images={photos.map((photo) => photo.publicUrl || photo.thumbUrl || photo.url).filter(Boolean)}
        startIndex={galleryIndex}
        onClose={() => setGalleryOpen(false)}
      />
    </div>
  );
}
