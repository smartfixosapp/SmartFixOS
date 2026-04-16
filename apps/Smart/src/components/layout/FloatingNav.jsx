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
      {/* Botón flotante (hamburger) estilo iOS */}
      <button
        onClick={() => setIsOpen(true)}
        className="apple-press fixed top-4 left-4 z-[60] w-10 h-10 rounded-full flex items-center justify-center apple-focusable apple-type"
        style={{
          backgroundColor: "rgb(var(--surface-elevated) / 0.72)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          backdropFilter: "blur(20px) saturate(180%)",
          boxShadow: "0 1px 2px rgb(0 0 0 / 0.1), 0 8px 24px rgb(0 0 0 / 0.12)",
          top: "calc(env(safe-area-inset-top, 0px) + 1rem)",
        }}
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5 apple-label-primary" />
      </button>

      {/* Menú Overlay */}
      {isOpen && (
        <div className="apple-type fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm animate-apple-fade-in" onClick={() => setIsOpen(false)}>
          {/* Sidebar */}
          <div
            className="absolute top-0 left-0 bottom-0 w-72 apple-surface-elevated p-4 flex flex-col animate-apple-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              borderRight: "0.5px solid rgb(var(--separator) / 0.29)",
              boxShadow: "0 0 48px rgb(0 0 0 / 0.3)",
              paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)",
            }}
          >
            <div className="flex items-center justify-between mb-5 px-1">
              <h2 className="apple-text-title2 apple-label-primary">Menú</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="apple-press w-8 h-8 rounded-full bg-gray-sys6 dark:bg-gray-sys5 apple-label-secondary flex items-center justify-center"
                aria-label="Cerrar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation items como apple-list estilo iOS Settings */}
            <div className="apple-list flex-1 overflow-y-auto apple-scroll">
              {navItems.map((item) => {
                const isActive = location.pathname.includes(item.path) || (item.path === "Dashboard" && location.pathname === "/");
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavigate(item.path)}
                    className="apple-list-row w-full text-left apple-focusable"
                  >
                    <div className={`apple-list-row-icon ${isActive ? "" : ""}`} style={{ backgroundColor: `rgb(var(--apple-blue))` }}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className={`apple-list-row-title ${isActive ? "text-apple-blue font-semibold" : ""}`}>
                      {item.label}
                    </span>
                    {isActive ? (
                      <span className="text-apple-blue">
                        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M13.5 4.5l-7 7-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>
                      </span>
                    ) : (
                      <svg className="apple-list-row-chevron" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M1 1l5 5-5 5"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Acciones auxiliares */}
            <div className="pt-4 mt-2 space-y-2">
              <button
                onClick={toggleFullscreen}
                className="apple-btn apple-btn-secondary w-full justify-start"
              >
                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                <span className="flex-1 text-left">{isFullscreen ? "Salir pantalla completa" : "Pantalla completa"}</span>
              </button>

              <button
                onClick={() => handleNavigate("Dashboard")}
                className="apple-btn apple-btn-plain w-full justify-start"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="flex-1 text-left">Volver al inicio</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
