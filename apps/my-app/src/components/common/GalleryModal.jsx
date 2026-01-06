import React, { useState, useEffect, useRef, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GalleryModal({ open, photos = [], initialIndex = 0, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowLeft") handlePrev();
      if (e.key === "ArrowRight") handleNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [photos.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  // Touch handlers para swipe
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (touchStartX.current === null) return;
    
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - touchStartX.current;
    const deltaY = currentY - touchStartY.current;

    // Solo horizontal swipe (no vertical scroll)
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      e.preventDefault();
      setDragOffset(deltaX);
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;

    const deltaX = dragOffset;
    const threshold = 50; // mínimo 50px para cambiar

    if (deltaX > threshold) {
      handlePrev();
    } else if (deltaX < -threshold) {
      handleNext();
    }

    // Reset
    touchStartX.current = null;
    touchStartY.current = null;
    setDragOffset(0);
    setIsDragging(false);
  };

  // Mouse handlers para desktop
  const handleMouseDown = (e) => {
    touchStartX.current = e.clientX;
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (touchStartX.current === null || !isDragging) return;
    const deltaX = e.clientX - touchStartX.current;
    setDragOffset(deltaX);
  };

  const handleMouseUp = () => {
    if (touchStartX.current === null) return;

    const threshold = 50;
    if (dragOffset > threshold) {
      handlePrev();
    } else if (dragOffset < -threshold) {
      handleNext();
    }

    touchStartX.current = null;
    setDragOffset(0);
    setIsDragging(false);
  };

  const handleDownload = async () => {
    const current = photos[currentIndex];
    if (!current) return;

    try {
      const url = current.publicUrl || current.thumbUrl;
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = current.filename || `foto-${currentIndex + 1}.jpg`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      console.error("Error downloading:", err);
    }
  };

  if (!open || photos.length === 0) return null;

  const current = photos[currentIndex];
  const isVideo = current?.type === "video" || current?.mime?.startsWith("video");
  const src = current?.publicUrl || current?.thumbUrl || "";

  return (
    <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 bg-black/60 backdrop-blur-sm border-b border-white/10">
        <div className="flex items-center gap-3">
          <span className="text-white font-medium">
            {currentIndex + 1} / {photos.length}
          </span>
          {current?.filename && (
            <span className="text-gray-400 text-sm truncate max-w-xs">
              {current.filename}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-white hover:bg-white/10"
          >
            <Download className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Main content con swipe */}
      <div 
        className="flex-1 flex items-center justify-center relative overflow-hidden select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Imagen/Video actual */}
        <div 
          className="max-w-[95vw] max-h-[85vh] transition-transform duration-200"
          style={{ 
            transform: `translateX(${dragOffset}px)`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
        >
          {isVideo ? (
            <video
              src={src}
              controls
              autoPlay
              className="max-w-full max-h-[85vh] object-contain"
            />
          ) : (
            <img
              src={src}
              alt={`Foto ${currentIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain"
              draggable={false}
            />
          )}
        </div>

        {/* Navegación lateral */}
        {photos.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 grid place-items-center text-white transition backdrop-blur-sm"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 grid place-items-center text-white transition backdrop-blur-sm"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </>
        )}

        {/* Indicador de swipe */}
        {isDragging && Math.abs(dragOffset) > 10 && (
          <div className={`absolute ${dragOffset > 0 ? 'left-8' : 'right-8'} top-1/2 -translate-y-1/2 text-white/60 text-6xl`}>
            {dragOffset > 0 ? '‹' : '›'}
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {photos.length > 1 && (
        <div className="flex-shrink-0 p-4 bg-black/60 backdrop-blur-sm border-t border-white/10">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
            {photos.map((photo, idx) => {
              const thumbSrc = photo.thumbUrl || photo.publicUrl || "";
              const isCurrentVideo = photo.type === "video" || photo.mime?.startsWith("video");
              
              return (
                <button
                  key={photo.id || idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                    idx === currentIndex
                      ? "border-red-500 ring-2 ring-red-500/50"
                      : "border-white/20 hover:border-white/40"
                  }`}
                >
                  {isCurrentVideo ? (
                    <video src={thumbSrc} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
