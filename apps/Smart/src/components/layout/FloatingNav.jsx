import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Menu, 
  X, 
  Home, 
  ClipboardList, 
  Wallet, 
  Users, 
  Maximize, 
  Minimize, 
  ArrowLeft,
  Settings
} from "lucide-react";
import { createPageUrl } from "@/components/utils/helpers";
import { Button } from "@/components/ui/button";

export default function FloatingNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  const toggleFullscreen = () => {
    const doc = document;
    const elem = doc.documentElement;

    // Check for fullscreen state using standard and vendor-prefixed properties
    const isFullscreenNow = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

    if (!isFullscreenNow) {
      // Enter fullscreen
      if (elem.requestFullscreen) {
        elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(e => console.log(e));
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen(); // Safari/iOS
        setIsFullscreen(true);
      } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen(); // Firefox
        setIsFullscreen(true);
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen(); // IE/Edge
        setIsFullscreen(true);
      }
    } else {
      // Exit fullscreen
      if (doc.exitFullscreen) {
        doc.exitFullscreen().then(() => setIsFullscreen(false)).catch(e => console.log(e));
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
        setIsFullscreen(false);
      } else if (doc.mozCancelFullScreen) {
        doc.mozCancelFullScreen();
        setIsFullscreen(false);
      } else if (doc.msExitFullscreen) {
        doc.msExitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  const navItems = [
    { label: "Inicio", icon: Home, path: "Dashboard" },
    { label: "Ventas (POS)", icon: Wallet, path: "POS" },
    { label: "Órdenes", icon: ClipboardList, path: "Orders" },
    { label: "Clientes", icon: Users, path: "Customers" },
    { label: "Ajustes", icon: Settings, path: "Settings" },
  ];

  const handleNavigate = (path) => {
    navigate(createPageUrl(path));
    setIsOpen(false);
  };

  return (
    <>
      {/* Botón Flotante (Hamburger) */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-[60] w-10 h-10 bg-black/60 backdrop-blur-md border border-white/10 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-black/80 transition-all active:scale-95"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Menú Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsOpen(false)}>
          {/* Sidebar */}
          <div 
            className="absolute top-0 left-0 bottom-0 w-64 bg-[#0F0F12] border-r border-white/10 shadow-2xl p-4 flex flex-col animate-in slide-in-from-left duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-white">Menú</h2>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                    location.pathname.includes(item.path) || (item.path === "Dashboard" && location.pathname === "/") 
                      ? "bg-cyan-600/20 text-cyan-400 border border-cyan-500/30" 
                      : "text-gray-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="pt-4 border-t border-white/10 space-y-3">
              <Button
                variant="outline"
                onClick={toggleFullscreen}
                className="w-full justify-start gap-3 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                {isFullscreen ? "Salir Pantalla Completa" : "Pantalla Completa"}
              </Button>
              
              <Button
                variant="ghost"
                onClick={() => handleNavigate("Dashboard")}
                className="w-full justify-start gap-3 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al Inicio
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
