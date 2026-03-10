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
    <div className="fixed bottom-4 left-4 right-4 z-[100] md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4">
      <div className="bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4 shadow-2xl relative">
        <button 
          onClick={() => setShowPrompt(false)}
          className="absolute top-2 right-2 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Smartphone className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-white mb-1">Instalar SmartFixOS</h3>
            <p className="text-sm text-gray-300 mb-3">
              Instala la aplicación para una mejor experiencia y acceso rápido.
            </p>
            
            {isIOS ? (
              <div className="text-xs text-gray-400 bg-white/5 p-2 rounded-lg border border-white/10">
                Para instalar en iOS:<br/>
                1. Toca el botón <strong>Compartir</strong> <span className="inline-block align-middle">⎋</span><br/>
                2. Selecciona <strong>"Agregar a Inicio"</strong> <span className="inline-block align-middle">➕</span>
              </div>
            ) : (
              <Button 
                onClick={handleInstallClick}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 h-9 text-sm"
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
