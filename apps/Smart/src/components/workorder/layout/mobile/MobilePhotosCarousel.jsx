import React, { useState } from "react";
import { Camera, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

export default function MobilePhotosCarousel({ photos = [], onAddPhoto }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (photos.length === 0) {
    return (
      <button
        onClick={onAddPhoto}
        className="w-full h-32 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Camera className="w-6 h-6 text-white/50" />
        <span className="text-xs text-white/50 font-medium">Agregar foto</span>
      </button>
    );
  }

  const openLightbox = (i) => {
    setLightboxIndex(i);
    setLightboxOpen(true);
  };

  return (
    <>
      {/* Thumbnail grid */}
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo, i) => {
          const url = photo.publicUrl || photo.thumbUrl || photo.url;
          const isVideo = photo.type === "video" || photo.mime?.startsWith("video");
          return (
            <div
              key={photo.id || i}
              className="aspect-square rounded-xl overflow-hidden bg-white/5 cursor-pointer relative active:scale-95 transition-transform"
              onClick={() => openLightbox(i)}
            >
              {isVideo ? (
                <video src={url} className="w-full h-full object-cover" muted />
              ) : (
                <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
              {isVideo && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[5px] border-y-transparent ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fullscreen Lightbox */}
      {lightboxOpen && <PhotoLightbox
        photos={photos}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        onMove={setLightboxIndex}
      />}
    </>
  );
}

function PhotoLightbox({ photos, index, onClose, onMove }) {
  const current = photos[index];
  const url = current?.publicUrl || current?.thumbUrl || current?.url;
  const isVideo = current?.type === "video" || current?.mime?.startsWith("video");

  // Swipe handling for lightbox
  const [touchStart, setTouchStart] = React.useState(null);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (touchStart === null) return;
    const diff = e.changedTouches[0].clientX - touchStart;
    if (Math.abs(diff) > 60) {
      if (diff < 0 && index < photos.length - 1) onMove(index + 1);
      if (diff > 0 && index > 0) onMove(index - 1);
    }
    setTouchStart(null);
  };

  // Keyboard nav
  React.useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onMove(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) onMove(index + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index, photos.length, onClose, onMove]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 20px) + 10px)" }}
      >
        <span className="text-sm text-white/50">{index + 1} / {photos.length}</span>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center active:scale-90"
        >
          <X className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-2 overflow-hidden">
        {isVideo ? (
          <video src={url} className="max-w-full max-h-full rounded-xl" controls autoPlay />
        ) : (
          <img src={url} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
        )}
      </div>

      {/* Nav arrows */}
      {index > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onMove(index - 1); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      )}
      {index < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onMove(index + 1); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Bottom dots */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-4 flex-shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 10px) + 10px)" }}
        >
          {photos.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-cyan-400" : "w-1.5 bg-white/25"
              )}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}
