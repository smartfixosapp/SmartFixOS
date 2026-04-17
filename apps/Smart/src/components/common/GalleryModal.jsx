import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Download, Share2, Mail, MessageCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function GalleryModal({ open, photos = [], initialIndex = 0, onClose, customerPhone = null }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchEnd, setTouchEnd] = useState({ x: 0, y: 0 });
  const [swiping, setSwiping] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const imageRef = useRef(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowLeft") goToPrev();
      if (e.key === "ArrowRight") goToNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, currentIndex, photos.length]);

  const goToPrev = useCallback(() => {
    if (photos.length <= 1) return;
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  }, [photos.length]);

  const goToNext = useCallback(() => {
    if (photos.length <= 1) return;
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  }, [photos.length]);

  // Touch handlers optimizados
  const onTouchStart = (e) => {
    setSwiping(true);
    setTouchEnd({ x: 0, y: 0 });
    setTouchStart({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchMove = (e) => {
    setTouchEnd({
      x: e.targetTouches[0].clientX,
      y: e.targetTouches[0].clientY,
    });
  };

  const onTouchEnd = () => {
    if (!swiping) return;
    
    const diffX = touchStart.x - touchEnd.x;
    const diffY = touchStart.y - touchEnd.y;
    const isHorizontalSwipe = Math.abs(diffX) > Math.abs(diffY);
    const minSwipeDistance = 50;

    if (isHorizontalSwipe && Math.abs(diffX) > minSwipeDistance) {
      if (diffX > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }

    setSwiping(false);
    setTouchStart({ x: 0, y: 0 });
    setTouchEnd({ x: 0, y: 0 });
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
      link.download = current.filename || `imagen-${currentIndex + 1}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success("Imagen descargada");
    } catch (err) {
      console.error("Error downloading:", err);
      toast.error("Error al descargar");
    }
  };

  const togglePhotoSelection = (idx) => {
    setSelectedPhotos(prev => {
      if (prev.includes(idx)) {
        return prev.filter(i => i !== idx);
      } else {
        return [...prev, idx];
      }
    });
  };

  const handleInitiateShare = (method) => {
    setShowShareMenu(false);
    setSelectionMode(true);
    setSelectedPhotos([currentIndex]); // Pre-seleccionar la foto actual
    toast.info(`Selecciona las fotos para ${method === 'whatsapp' ? 'WhatsApp' : method === 'email' ? 'Email' : 'SMS'}`);
  };

  const handleShareViaEmail = async () => {
    const photosToShare = selectionMode && selectedPhotos.length > 0
      ? selectedPhotos.map(idx => photos[idx])
      : [photos[currentIndex]];
    
    // Intentar usar Web Share API si está disponible
    if (navigator.share && photosToShare.length <= 5) {
      try {
        const shareData = {
          title: 'Fotos de orden',
          text: 'Compartiendo fotos del dispositivo',
          files: []
        };

        // Intentar descargar y compartir las imágenes como archivos
        for (const photo of photosToShare) {
          try {
            const response = await fetch(photo.publicUrl || photo.thumbUrl);
            const blob = await response.blob();
            const filename = photo.filename || `foto-${Date.now()}.jpg`;
            const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
            shareData.files.push(file);
          } catch (err) {
            console.error('Error loading photo:', err);
          }
        }

        if (shareData.files.length > 0 && navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setSelectionMode(false);
          setSelectedPhotos([]);
          toast.success("Fotos compartidas");
          return;
        }
      } catch (err) {
        console.log('Web Share API failed, using fallback');
      }
    }
    
    // Fallback: usar mailto con URLs
    const urls = photosToShare
      .map(p => p.publicUrl || p.thumbUrl)
      .join('\n\n');
    
    window.location.href = `mailto:?subject=${encodeURIComponent('Fotos de orden')}&body=${encodeURIComponent(urls)}`;
    setSelectionMode(false);
    setSelectedPhotos([]);
    toast.success("Email abierto");
  };

  const handleShareViaWhatsApp = async () => {
    const photosToShare = selectionMode && selectedPhotos.length > 0
      ? selectedPhotos.map(idx => photos[idx])
      : [photos[currentIndex]];
    
    // Intentar usar Web Share API si está disponible
    if (navigator.share && photosToShare.length <= 5) {
      try {
        const shareData = {
          title: 'Fotos de orden',
          text: 'Fotos del dispositivo',
          files: []
        };

        // Descargar y compartir las imágenes como archivos
        for (const photo of photosToShare) {
          try {
            const response = await fetch(photo.publicUrl || photo.thumbUrl);
            const blob = await response.blob();
            const filename = photo.filename || `foto-${Date.now()}.jpg`;
            const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
            shareData.files.push(file);
          } catch (err) {
            console.error('Error loading photo:', err);
          }
        }

        if (shareData.files.length > 0 && navigator.canShare && navigator.canShare(shareData)) {
          await navigator.share(shareData);
          setSelectionMode(false);
          setSelectedPhotos([]);
          toast.success("Fotos compartidas");
          return;
        }
      } catch (err) {
        console.log('Web Share API failed, using fallback');
      }
    }
    
    // Fallback: usar WhatsApp con URLs
    const urls = photosToShare
      .map(p => p.publicUrl || p.thumbUrl)
      .join('\n\n');
    
    const phoneNumber = customerPhone ? customerPhone.replace(/[^0-9]/g, '') : '';
    const whatsappUrl = phoneNumber
      ? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(urls)}`
      : `https://wa.me/?text=${encodeURIComponent(urls)}`;
    
    window.open(whatsappUrl, '_blank');
    setSelectionMode(false);
    setSelectedPhotos([]);
    toast.success("WhatsApp abierto");
  };

  const handleShareViaSMS = () => {
    const photosToShare = selectionMode && selectedPhotos.length > 0
      ? selectedPhotos.map(idx => photos[idx])
      : [photos[currentIndex]];
    
    const urls = photosToShare
      .map(p => p.publicUrl || p.thumbUrl)
      .join('\n\n');
    
    window.location.href = `sms:?body=${encodeURIComponent(urls)}`;
    setSelectionMode(false);
    setSelectedPhotos([]);
    toast.success("SMS abierto");
  };

  if (!open || photos.length === 0) return null;
  if (typeof document === "undefined") return null;

  const current = photos[currentIndex];
  const swipeOffset = swiping && touchEnd.x ? touchStart.x - touchEnd.x : 0;

  return createPortal(
    <div className="apple-type fixed inset-0 z-[99999] bg-black flex flex-col">
      {/* Header fijo */}
      <div className="absolute top-0 left-0 right-0 z-[100] flex items-center justify-between p-4 bg-gradient-to-b from-black/90 to-transparent pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="text-white font-semibold apple-text-body px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm tabular-nums">
            {currentIndex + 1} / {photos.length}
          </span>
        </div>
        <div className="flex items-center gap-2 pointer-events-auto relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowShareMenu(!showShareMenu);
            }}
            className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 transition-all grid place-items-center text-white backdrop-blur-sm touch-manipulation"
          >
            <Share2 className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
            }}
            className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 transition-all grid place-items-center text-white backdrop-blur-sm touch-manipulation"
          >
            <Download className="w-5 h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose?.();
            }}
            className="w-11 h-11 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 transition-all grid place-items-center text-white backdrop-blur-sm touch-manipulation"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Menú de compartir */}
          {showShareMenu && (
            <div className="absolute top-14 right-0 bg-black/90 backdrop-blur-xl rounded-apple-md shadow-apple-xl overflow-hidden min-w-[200px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleInitiateShare('whatsapp');
                }}
                className="apple-press w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 active:bg-white/20 transition-all text-white"
              >
                <MessageCircle className="w-5 h-5 text-apple-green" />
                <span className="font-medium apple-text-body">WhatsApp</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleInitiateShare('email');
                }}
                className="apple-press w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 active:bg-white/20 transition-all text-white"
                style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}
              >
                <Mail className="w-5 h-5 text-apple-blue" />
                <span className="font-medium apple-text-body">Email</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleInitiateShare('sms');
                }}
                className="apple-press w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 active:bg-white/20 transition-all text-white"
                style={{ borderTop: '0.5px solid rgb(var(--separator) / 0.29)' }}
              >
                <MessageSquare className="w-5 h-5 text-apple-purple" />
                <span className="font-medium apple-text-body">SMS</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Área principal - imagen con swipe */}
      <div 
        ref={imageRef}
        className="flex-1 flex items-center justify-center relative overflow-hidden bg-black touch-none"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ touchAction: 'pan-y pinch-zoom' }}
      >
        {/* Imagen/Video con efecto de swipe */}
        <div 
          className="w-full h-full flex items-center justify-center px-20 py-24 transition-transform duration-200"
          style={{ 
            transform: swiping ? `translateX(${-swipeOffset * 0.5}px)` : 'translateX(0)',
            opacity: swiping ? Math.max(0.5, 1 - Math.abs(swipeOffset) / 500) : 1
          }}
        >
          {current?.type === "video" || current?.mime?.startsWith("video") ? (
            <video
              src={current?.publicUrl || current?.thumbUrl || ""}
              controls
              autoPlay
              playsInline
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <img
              src={current?.publicUrl || current?.thumbUrl || ""}
              alt={`Imagen ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain select-none"
              draggable={false}
            />
          )}
        </div>
      </div>



      {/* Thumbnails en la parte inferior */}
      {photos.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-black/90 to-transparent pointer-events-none">
          {selectionMode && (
            <div className="flex justify-center gap-3 mb-3 pointer-events-auto">
              <button
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedPhotos([]);
                }}
                className="apple-press px-4 py-2 bg-gray-sys3 hover:bg-gray-sys2 rounded-full text-white font-medium transition-all apple-text-footnote"
              >
                Cancelar
              </button>
              <button
                onClick={handleShareViaWhatsApp}
                disabled={selectedPhotos.length === 0}
                className="apple-press px-4 py-2 bg-apple-green hover:bg-apple-green disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-white font-medium transition-all apple-text-footnote tabular-nums"
              >
                Enviar {selectedPhotos.length} foto{selectedPhotos.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none justify-center pointer-events-auto">
            {photos.map((photo, idx) => {
              const thumbSrc = photo.thumbUrl || photo.publicUrl || "";
              const isCurrentVideo = photo.type === "video" || photo.mime?.startsWith("video");
              const isSelected = selectedPhotos.includes(idx);
              
              return (
                <button
                  key={photo.id || idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectionMode) {
                      togglePhotoSelection(idx);
                    } else {
                      setCurrentIndex(idx);
                    }
                  }}
                  className={`apple-press relative flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-apple-sm overflow-hidden transition-all active:scale-90 touch-manipulation ${
                    selectionMode && isSelected
                      ? "ring-2 ring-apple-green scale-105"
                      : idx === currentIndex
                      ? "ring-2 ring-apple-blue scale-105"
                      : "ring-1 ring-white/30"
                  }`}
                >
                  {isCurrentVideo ? (
                    <video src={thumbSrc} className="w-full h-full object-cover pointer-events-none" muted playsInline />
                  ) : (
                    <img src={thumbSrc} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover pointer-events-none" />
                  )}
                  {selectionMode && isSelected && (
                    <div className="absolute inset-0 bg-apple-green/40 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-apple-green text-white flex items-center justify-center apple-text-caption1 font-semibold">
                        ✓
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
