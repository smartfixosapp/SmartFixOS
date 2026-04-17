import React, { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if iOS
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIosDevice);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    // Handle install prompt for Android/Desktop
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt automatically on load or keep hidden until user action
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, just show if not standalone
    if (isIosDevice && !isStandalone) {
      setShowPrompt(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="apple-type fixed bottom-4 left-4 right-4 z-[100] md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4">
      <div className="apple-card rounded-apple-lg p-4 shadow-apple-lg relative">
        <button
          onClick={() => setShowPrompt(false)}
          className="apple-press absolute top-2 right-2 apple-label-tertiary hover:apple-label-secondary"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-apple-blue/15 rounded-apple-sm flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-apple-blue" />
          </div>
          <div className="flex-1">
            <h3 className="apple-text-headline apple-label-primary mb-1">Instalar SmartFixOS</h3>
            <p className="apple-text-subheadline apple-label-secondary mb-3">
              Instala la aplicación para una mejor experiencia y acceso rápido.
            </p>

            {isIOS ? (
              <div
                className="apple-text-footnote apple-label-secondary bg-apple-surface-secondary p-2 rounded-apple-sm"
                style={{ borderBottom: "0.5px solid rgb(var(--separator) / 0.29)" }}
              >
                Para instalar en iOS:<br/>
                1. Toca el botón <strong>Compartir</strong> <span className="inline-block align-middle">⎋</span><br/>
                2. Selecciona <strong>"Agregar a Inicio"</strong> <span className="inline-block align-middle">➕</span>
              </div>
            ) : (
              <Button
                onClick={handleInstallClick}
                className="apple-btn apple-btn-primary w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Instalar Ahora
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
