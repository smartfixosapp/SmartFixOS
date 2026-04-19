import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  ClipboardList,
  Wallet,
  DollarSign,
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
    navigate(path);
  };

  const navItems = [
    {
      id: "orders",
      icon: ClipboardList,
      label: "Órdenes",
      path: "/Orders",
      color: "text-apple-orange"
    },
    {
      id: "pos",
      icon: Wallet,
      label: "POS",
      path: "/POS",
      color: "text-apple-green"
    },
    {
      id: "home",
      icon: Home,
      label: "Inicio",
      path: "/Dashboard",
      color: "text-apple-blue",
      isCenter: true
    },
    {
      id: "financial",
      icon: DollarSign,
      label: "Finanzas",
      path: "/Financial",
      color: "text-apple-green"
    },
    {
      id: "settings",
      icon: Settings,
      label: "Ajustes",
      path: "/Settings",
      color: "apple-label-secondary"
    }
  ];

  useEffect(() => {
    const currentPath = location.pathname;
    if (currentPath === "/" || currentPath === "/Dashboard") setActiveTab("home");
    else if (currentPath.includes("Orders")) setActiveTab("orders");
    else if (currentPath.includes("POS")) setActiveTab("pos");
    else if (currentPath.includes("Financial")) setActiveTab("financial");
    else if (currentPath.includes("Settings")) setActiveTab("settings");
    else setActiveTab("");
  }, [location.pathname]);

  return (
    <div className="apple-type px-4 py-3 sm:py-4">
      {/* Liquid glass pill — translúcido + blur + rim highlights (iOS 26 style) */}
      <div className="liquid-glass relative rounded-full h-15 flex items-center justify-between px-2 sm:px-4 max-w-sm sm:max-w-md lg:max-w-2xl mx-auto">

        {navItems.map((item) => {
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => hardNavigate(item.path)}
              className={cn(
                "apple-press relative flex flex-col items-center justify-center w-14 h-14 z-10 group"
              )}
            >
              {/* Active Indicator Background */}
              {isActive && !item.isCenter && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute inset-2 bg-gray-sys6 dark:bg-gray-sys5 rounded-apple-lg -z-10"
                  transition={{ type: "spring", stiffness: 350, damping: 35 }}
                />
              )}

              {/* Center Button */}
              {item.isCenter ? (
                <div className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300",
                  isActive
                    ? "bg-apple-blue shadow-apple-md"
                    : "bg-apple-surface-secondary"
                )}>
                  <item.icon
                    className={cn(
                      "w-5 h-5",
                      isActive ? "text-white" : "apple-label-secondary"
                    )}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <item.icon
                      className={cn(
                        "w-6 h-6",
                        isActive ? item.color : "apple-label-tertiary"
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                  </div>
                  <span className={cn(
                    "apple-text-caption2",
                    isActive ? item.color : "apple-label-tertiary"
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
