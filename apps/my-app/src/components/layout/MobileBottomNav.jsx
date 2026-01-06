// ============================================
// 📱 iOS-Style Bottom Navigation Bar
// Liquid Glass Design - iPhone iOS 16/17 inspired
// ============================================

import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { 
  Home, 
  ClipboardList, 
  Wallet, 
  Users, 
  Settings, 
  MoreHorizontal,
  Zap,
  Package,
  DollarSign,
  BarChart3,
  Clock,
  X
} from "lucide-react";

const mainNavItems = [
  { 
    page: "Dashboard", 
    label: "Inicio", 
    icon: Home,
    gradient: "from-cyan-400 to-cyan-600"
  },
  { 
    page: "Orders", 
    label: "Órdenes", 
    icon: ClipboardList,
    gradient: "from-blue-400 to-blue-600"
  },
  { 
    page: "POS", 
    label: "Ventas", 
    icon: Wallet,
    gradient: "from-emerald-400 to-emerald-600"
  },
  { 
    page: "Customers", 
    label: "Clientes", 
    icon: Users,
    gradient: "from-green-400 to-green-600"
  }
];

const moreMenuItems = [
  { 
    page: "Recharges", 
    label: "Recargas", 
    icon: Zap,
    gradient: "from-amber-400 to-yellow-600",
    description: "Gestión de recargas"
  },
  { 
    page: "Inventory", 
    label: "Inventario", 
    icon: Package,
    gradient: "from-teal-400 to-cyan-600",
    description: "Productos y servicios"
  },
  { 
    page: "Financial", 
    label: "Finanzas", 
    icon: DollarSign,
    gradient: "from-green-400 to-emerald-600",
    description: "Caja y transacciones"
  },
  { 
    page: "Reports", 
    label: "Reportes", 
    icon: BarChart3,
    gradient: "from-blue-400 to-indigo-600",
    description: "Analíticas y reportes"
  },
  { 
    page: "TimeTracking", 
    label: "Ponches", 
    icon: Clock,
    gradient: "from-purple-400 to-pink-600",
    description: "Control de tiempo"
  },
  { 
    page: "SettingsMobile", 
    label: "Configuración", 
    icon: Settings,
    gradient: "from-orange-400 to-red-600",
    description: "Ajustes del sistema"
  }
];

export default function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <>
      <nav
        className="
          fixed bottom-0 left-0 right-0 z-50
          pb-[env(safe-area-inset-bottom)]
        "
        data-bottom-nav
        data-pointer-target="on"
        role="navigation"
        aria-label="Navegación principal"
      >
        {/* iOS Liquid Glass Background */}
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 via-emerald-500/5 to-transparent blur-2xl" />
          
          {/* Glass container */}
          <div className="relative backdrop-blur-2xl bg-black/80 border-t border-white/10 shadow-[0_-10px_40px_rgba(0,168,232,0.15)]">
            {/* Subtle top highlight */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />
            
            <ul className="grid grid-cols-5 px-2 py-2 gap-1">
              {mainNavItems.map(({ page, label, icon: Icon, gradient }) => {
                const pagePath = createPageUrl(page);
                const isActive = location.pathname === pagePath || 
                                (page === "Dashboard" && location.pathname === "/");

                return (
                  <li key={page}>
                    <Link
                      to={pagePath}
                      className="flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-300 group relative overflow-hidden min-h-[64px]"
                    >
                      {/* Active background glow */}
                      {isActive && (
                        <>
                          <div className={`absolute inset-0 bg-gradient-to-t ${gradient} opacity-20 blur-xl`} />
                          <div className={`absolute inset-0 bg-gradient-to-t ${gradient} opacity-10 rounded-2xl`} />
                        </>
                      )}
                      
                      {/* Icon container */}
                      <div className={`
                        relative mb-1 p-2 rounded-xl transition-all duration-300
                        ${isActive 
                          ? `bg-gradient-to-t ${gradient} shadow-lg scale-110` 
                          : 'bg-white/5 group-hover:bg-white/10 group-hover:scale-105'
                        }
                      `}>
                        <Icon 
                          className={`w-5 h-5 transition-all duration-300 ${
                            isActive 
                              ? 'text-white drop-shadow-[0_2px_8px_rgba(0,168,232,0.6)]' 
                              : 'text-gray-400 group-hover:text-gray-200'
                          }`}
                          aria-hidden="true"
                        />
                      </div>
                      
                      {/* Label */}
                      <span className={`
                        text-[10px] font-semibold leading-tight transition-all duration-300
                        ${isActive 
                          ? `bg-gradient-to-r ${gradient} bg-clip-text text-transparent` 
                          : 'text-gray-400 group-hover:text-gray-200'
                        }
                      `}>
                        {label}
                      </span>

                      {/* Active indicator dot */}
                      {isActive && (
                        <div className={`absolute -bottom-1 w-1 h-1 rounded-full bg-gradient-to-r ${gradient} shadow-lg animate-pulse`} />
                      )}
                    </Link>
                  </li>
                );
              })}
              
              {/* More button */}
              <li>
                <button
                  onClick={() => setShowMoreMenu(true)}
                  className="w-full flex flex-col items-center justify-center py-2 px-1 rounded-2xl transition-all duration-300 group relative overflow-hidden min-h-[64px]"
                >
                  <div className="relative mb-1 p-2 rounded-xl transition-all duration-300 bg-white/5 group-hover:bg-white/10 group-hover:scale-105">
                    <MoreHorizontal 
                      className="w-5 h-5 transition-all duration-300 text-gray-400 group-hover:text-gray-200"
                      aria-hidden="true"
                    />
                  </div>
                  
                  <span className="text-[10px] font-semibold leading-tight transition-all duration-300 text-gray-400 group-hover:text-gray-200">
                    Más
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </div>

      <style>{`
        /* iOS-style spring animation */
        @keyframes spring {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }

        [data-bottom-nav] a:active .relative.mb-1,
        [data-bottom-nav] button:active .relative.mb-1 {
          animation: spring 0.3s ease-in-out;
        }

        /* Smooth glass blur */
        @supports (backdrop-filter: blur(20px)) {
          [data-bottom-nav] > div > div {
            backdrop-filter: blur(20px) saturate(180%);
            -webkit-backdrop-filter: blur(20px) saturate(180%);
          }
        }
      `}</style>
    </nav>

    {/* More Menu Modal */}
    {showMoreMenu && (
      <div 
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm"
        onClick={() => setShowMoreMenu(false)}
      >
        <div 
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-b from-slate-900 to-black border-t-2 border-cyan-500/30 rounded-t-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white text-xl font-bold flex items-center gap-2">
              <MoreHorizontal className="w-6 h-6 text-cyan-400" />
              Todas las secciones
            </h3>
            <button
              onClick={() => setShowMoreMenu(false)}
              className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all active:scale-95"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Menu Grid */}
          <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
            {moreMenuItems.map(({ page, label, icon: Icon, gradient, description }) => {
              const pagePath = createPageUrl(page);
              
              return (
                <button
                  key={page}
                  onClick={() => {
                    navigate(pagePath);
                    setShowMoreMenu(false);
                  }}
                  className="relative overflow-hidden bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-left transition-all active:scale-95 hover:border-cyan-500/30 min-h-[100px]"
                >
                  <div className={`absolute top-2 right-2 w-16 h-16 bg-gradient-to-br ${gradient} opacity-10 blur-2xl rounded-full`} />
                  
                  <div className="relative">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-lg`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="text-white font-bold text-sm mb-1">{label}</h4>
                    <p className="text-gray-400 text-xs leading-tight">{description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <style>{`
          @keyframes slide-up {
            from {
              transform: translateY(100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }

          .animate-slide-up {
            animation: slide-up 0.3s ease-out;
          }
        `}</style>
      </div>
    )}
    </>
  );
}
