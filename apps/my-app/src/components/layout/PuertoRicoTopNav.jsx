// ============================================
// 🎨 MODERN TOP NAVIGATION BAR
// Diseño minimalista y elegante
// ============================================

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { 
  Home, 
  ClipboardList, 
  ShoppingCart, 
  Users, 
  Settings, 
  Sparkles
} from "lucide-react";

const navItems = [
  { 
    page: "Orders", 
    label: "Órdenes", 
    icon: ClipboardList
  },
  { 
    page: "POS", 
    label: "POS", 
    icon: ShoppingCart
  },
  { 
    page: "Dashboard", 
    label: "Inicio", 
    icon: Home,
    isHome: true
  },
  { 
    page: "Customers", 
    label: "Clientes", 
    icon: Users
  },
  { 
    page: "SettingsMobile", 
    label: "Ajustes", 
    icon: Settings
  }
];

export default function PuertoRicoTopNav() {
  const location = useLocation();

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 pt-[env(safe-area-inset-top)]"
      data-top-nav
      data-pointer-target="on"
      role="navigation"
      aria-label="Navegación principal"
    >
      <div className="relative">
        {/* Fondo con degradado */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900" />
        
        {/* Contenedor principal */}
        <div className="relative backdrop-blur-xl bg-black/30 border-b border-white/5">
          <div className="max-w-screen-xl mx-auto px-4 py-2">
            <div className="flex items-end justify-center gap-3 pb-1">
              {navItems.map(({ page, label, icon: Icon, isHome }) => {
                const pagePath = createPageUrl(page);
                const isActive = location.pathname === pagePath || 
                                (page === "Dashboard" && location.pathname === "/");

                return (
                  <Link
                    key={page}
                    to={pagePath}
                    className="group relative flex flex-col items-center"
                  >
                    {/* Brillo de fondo cuando está activo (solo para home) */}
                    {isActive && isHome && (
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-emerald-500/30 to-cyan-500/30 blur-xl animate-pulse" />
                    )}
                    
                    {/* Botón */}
                    <div className={`
                      relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300
                      ${isActive && isHome
                        ? 'bg-gradient-to-br from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/50' 
                        : isActive
                        ? 'bg-white/20 shadow-md'
                        : 'bg-transparent group-hover:bg-white/10'
                      }
                    `}>
                      <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`} />
                      
                      {/* Estrella decorativa solo para home activo */}
                      {isActive && isHome && (
                        <div className="absolute -top-0.5 -right-0.5">
                          <Sparkles className="w-3 h-3 text-yellow-300 animate-pulse" fill="currentColor" />
                        </div>
                      )}
                    </div>
                    
                    {/* Label debajo */}
                    <span className={`text-[10px] font-medium mt-1 ${isActive ? 'text-cyan-400' : 'text-white/50'}`}>
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Línea decorativa inferior */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        </div>
      </div>

      <style>{`
        [data-top-nav] {
          animation: slideDown 0.5s ease-out;
        }

        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @supports (backdrop-filter: blur(20px)) {
          [data-top-nav] > div > div {
            backdrop-filter: blur(24px) saturate(180%);
            -webkit-backdrop-filter: blur(24px) saturate(180%);
          }
        }
      `}</style>
    </nav>
  );
}
