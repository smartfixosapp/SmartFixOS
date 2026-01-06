import React from "react";
import { Image as ImageIcon, Video } from "lucide-react";

export default function OrderPhotosGallery({ photos = [], onPhotoClick }) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 bg-black/20 rounded-lg border border-dashed border-white/10">
        <div className="text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-2 text-gray-500" />
          <p className="text-gray-400 text-sm">No hay fotos cargadas</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {photos.map((photo, idx) => {
        const isVideo = photo.type === "video" || photo.mime?.startsWith("video");
        const src = photo.publicUrl || photo.thumbUrl || "";
        
        return (
          <button
            key={photo.id || idx}
            onClick={() => onPhotoClick?.(idx)}
            className="relative aspect-square rounded-lg overflow-hidden bg-black/40 border border-white/10 hover:border-red-500/50 transition-all group cursor-pointer"
          >
            {isVideo ? (
              <>
                <video
                  src={src}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Video className="w-8 h-8 text-white" />
                </div>
              </>
            ) : (
              <img
                src={src}
                alt={`Foto ${idx + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            )}
            
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-sm font-medium">Ver en grande</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
