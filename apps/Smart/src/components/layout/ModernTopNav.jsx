import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Home, 
  ClipboardList, 
  Wallet, 
  Users, 
  Settings,
  LayoutGrid
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useDeviceDetection } from "@/components/utils/useDeviceDetection";

export default function ModernTopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("home");

  const hardNavigate = (path) => {
    if (location.pathname === path) return;
    window.location.assign(path);
  };

  const navItems = [
    { 
      id: "orders", 
      icon: ClipboardList, 
      label: "Órdenes", 
      path: "/Orders",
      color: "text-orange-400"
    },
    { 
      id: "pos", 
      icon: Wallet, 
      label: "POS", 
      path: "/POS",
      color: "text-emerald-400"
    },
    { 
      id: "home", 
      icon: Home, 
      label: "Inicio", 
      path: "/Dashboard",
      color: "text-cyan-400",
      isCenter: true
    },
    { 
      id: "customers", 
      icon: Users, 
      label: "Clientes", 
      path: "/Customers",
      color: "text-purple-400"
    },
    { 
      id: "settings", 
      icon: Settings, 
      label: "Ajustes", 
      path: "/Settings",
      color: "text-slate-400"
    }
  ];

  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath === "/" || currentPath === "/Dashboard") setActiveTab("home");
    else if (currentPath.includes("Orders")) setActiveTab("orders");
    else if (currentPath.includes("POS")) setActiveTab("pos");
    else if (currentPath.includes("Customers")) setActiveTab("customers");
    else if (currentPath.includes("Settings")) setActiveTab("settings");
    else setActiveTab("");
  }, [location.pathname]);

  return (
    <div className="px-4 py-3 sm:py-4">
      <div className="liquid-glass-strong relative rounded-full h-15 flex items-center justify-between px-2 sm:px-4 max-w-sm sm:max-w-md lg:max-w-2xl mx-auto transition-all duration-500">
        
        {/* Glass Glow Effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => hardNavigate(item.path)}
              className={cn(
                "relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-500 z-10 group"
              )}
            >
              {/* Active Indicator Background - Premium Glass */}
              {isActive && !item.isCenter && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-2 bg-gradient-to-b from-white/[0.12] to-white/[0.02] border border-white/10 rounded-2xl -z-10 shadow-inner"
                  transition={{ type: "spring", stiffness: 350, damping: 35 }}
                />
              )}

              {/* Center Button Special Style - Apple Style */}
              {item.isCenter ? (
                <div className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.4)] transition-all duration-500",
                  isActive 
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/30 scale-105" 
                    : "bg-white/[0.03] border border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.08] hover:scale-105"
                )}>
                  <item.icon 
                    className={cn(
                      "w-5 h-5 transition-transform duration-500",
                      isActive ? "text-white rotate-0" : "text-slate-400 -rotate-3 group-hover:rotate-0"
                    )} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 transition-transform duration-300 group-active:scale-90">
                  <div className="relative">
                    <item.icon 
                      className={cn(
                        "w-6 h-6 transition-all duration-500",
                        isActive ? item.color : "text-white/40 group-hover:text-white/80",
                        isActive && "drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                      )} 
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {isActive && (
                      <motion.div 
                        layoutId="active-dot"
                        className={cn("absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full blur-[1px]", item.color.replace('text-', 'bg-'))} 
                      />
                    )}
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold tracking-tight transition-all duration-500",
                    isActive ? item.color : "text-white/50 group-hover:text-white/40"
                  )}>
                    {item.label}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
