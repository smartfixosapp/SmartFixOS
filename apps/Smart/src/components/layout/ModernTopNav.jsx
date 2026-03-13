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
    <div className="px-4 py-2">
        <div className="relative bg-[#1c1c1e]/80 backdrop-blur-2xl border border-white/5 rounded-full h-14 shadow-2xl flex items-center justify-between px-4 max-w-sm mx-auto">

          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => hardNavigate(item.path)}
                className={cn(
                  "relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-300 z-10"
                )}
              >
                {/* Active Indicator Background */}
                {isActive && !item.isCenter && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 bg-white/5 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}

                {/* Center Button Special Style - Apple Style */}
                {item.isCenter ? (
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300",
                    isActive 
                      ? "bg-blue-600 text-white shadow-blue-500/25" 
                      : "bg-transparent text-slate-400 hover:text-slate-200"
                  )}>
                    <item.icon 
                      className={cn(
                        "w-5 h-5 transition-colors",
                        isActive ? "text-white" : "text-slate-400"
                      )} 
                      strokeWidth={3}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <item.icon 
                      className={cn(
                        "w-6 h-6 transition-all duration-300",
                        isActive ? item.color : "text-slate-500 group-hover:text-slate-300",
                        isActive && "scale-110"
                      )} 
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    {isActive && (
                      <motion.span
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn("text-[10px] font-bold", item.color)}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
    </div>
  );
}
