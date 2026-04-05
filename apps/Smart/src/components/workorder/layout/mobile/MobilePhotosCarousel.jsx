import React, { useState, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Camera, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobilePhotosCarousel({ photos = [], onPhotoClick, onAddPhoto }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false, align: "start" });
  const [selectedIndex, setSelectedIndex] = useState(0);

  React.useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    onSelect();
    return () => emblaApi.off("select", onSelect);
  }, [emblaApi]);

  if (photos.length === 0) {
    return (
      <button
        onClick={onAddPhoto}
        className="w-full h-32 rounded-2xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Camera className="w-6 h-6 text-white/30" />
        <span className="text-xs text-white/30 font-medium">Agregar foto</span>
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex gap-2">
          {photos.map((photo, i) => {
            const url = photo.publicUrl || photo.thumbUrl || photo.url;
            const isVideo = photo.type === "video" || photo.mime?.startsWith("video");
            return (
              <div
                key={photo.id || i}
                className="flex-[0_0_75%] min-w-0 aspect-[4/3] rounded-2xl overflow-hidden bg-white/5 cursor-pointer relative"
                onClick={() => onPhotoClick?.(i)}
              >
                {isVideo ? (
                  <video src={url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                )}
                {isVideo && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[10px] border-l-white border-y-[6px] border-y-transparent ml-1" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dot indicators */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {photos.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === selectedIndex
                  ? "w-4 bg-cyan-400"
                  : "w-1.5 bg-white/20"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
