import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutGrid, 
  Wallet, 
  ClipboardList, 
  Users, 
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelState } from "@/components/utils/panelContext";

// Almacenar el historial de navegación para cada tab
const tabHistory = {
  home: ["/Dashboard"],
  orders: ["/Orders"],
  pos: ["/POS"],
  customers: ["/Customers"],
  settings: ["/Settings"]
};

export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("home");
  const { hasPanelsOpen } = usePanelState();
  const lastPathRef = useRef(location.pathname);

  // Determine active tab based on path
  useEffect(() => {
    const p = location.pathname;
    let currentTab = "home";
    if (p === "/" || p === "/Dashboard") currentTab = "home";
    else if (p.includes("POS")) currentTab = "pos";
    else if (p.includes("Orders")) currentTab = "orders";
    else if (p.includes("Customers")) currentTab = "customers";
    else if (p.includes("Settings")) currentTab = "settings";
    
    setActiveTab(currentTab);

    // Guardar la ruta actual en el historial del tab activo
    if (p !== lastPathRef.current) {
      const history = tabHistory[currentTab];
      if (history && !history.includes(p)) {
        history[history.length - 1] = p;
      }
      lastPathRef.current = p;
    }
  }, [location.pathname]);

  const handleTabClick = (tab) => {
    if (location.pathname === tab.path) {
      navigate(tab.path);
      tabHistory[tab.id] = [tab.path];
      return;
    }

    if (tab.id === activeTab) {
      // Si el tab ya está activo, navegar a su raíz
      navigate(tab.path);
      tabHistory[tab.id] = [tab.path];
    } else {
      // Restaurar la última ruta del tab
      const lastRoute = tabHistory[tab.id][tabHistory[tab.id].length - 1] || tab.path;
      window.location.assign(lastRoute);
    }
  };

  const tabs = [
    { id: "orders", label: "Órdenes", icon: ClipboardList, path: "/Orders" },
    { id: "pos", label: "Caja", icon: Wallet, path: "/POS" },
    { id: "home", label: "Inicio", icon: LayoutGrid, path: "/Dashboard" },
    { id: "customers", label: "Clientes", icon: Users, path: "/Customers" },
    { id: "settings", label: "Ajustes", icon: Settings, path: "/Settings" }
  ];

  return (
    <>
      {/* Spacer to prevent content from being hidden behind navbar */}
      <div className={cn("md:hidden w-full flex-shrink-0 transition-all duration-300", hasPanelsOpen ? "h-0" : "h-[84px]")} />

      {/* iOS Tab Bar */}
      <nav
        data-global-dock
        className={cn(
        "fixed bottom-0 left-0 right-0 z-[100] md:hidden transition-all duration-300",
        hasPanelsOpen ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
      )}>
        {/* Blur Background */}
        <div className="absolute inset-0 bg-[#1c1c1e]/90 backdrop-blur-xl border-t border-white/10" />
        
        {/* Tab Items Container */}
        <div className="relative flex items-end justify-between px-2 pb-[max(env(safe-area-inset-bottom),20px)] pt-3 h-[84px]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className="flex flex-1 flex-col items-center justify-center gap-1 active:opacity-50 transition-opacity"
              >
                <div className={cn(
                  "relative flex items-center justify-center rounded-full transition-all duration-200",
                  isActive ? "text-[#0A84FF]" : "text-[#8E8E93]"
                )}>
                  {/* Icon */}
                  <tab.icon 
                    size={26} 
                    strokeWidth={isActive ? 2.5 : 2}
                    fill={isActive && tab.id !== 'pos' ? "currentColor" : "none"}
                    className={cn(
                        "transition-transform duration-200",
                        isActive && "scale-105"
                    )}
                  />
                </div>
                
                {/* Label */}
                <span className={cn(
                  "text-[10px] font-medium tracking-tight leading-none",
                  isActive ? "text-[#0A84FF]" : "text-[#8E8E93]"
                )}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
