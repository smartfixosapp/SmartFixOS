import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutGrid,
  Wallet,
  ClipboardList,
  TrendingUp,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelState } from "@/components/utils/panelContext";
import { motion } from "framer-motion";
import { triggerHaptic } from "@/lib/capacitor";
import { supabase } from "../../../../../lib/supabase-client.js";

// Tab navigation history
const tabHistory = {
  home:      ["/Dashboard"],
  orders:    ["/Orders"],
  pos:       ["/POS"],
  financial: ["/Financial"],
  settings:  ["/Settings"],
};

// ── Badge counts hook ─────────────────────────────────────────────────────
// Carga en segundo plano las órdenes pendientes para mostrar badge en el tab
function useBadgeCounts() {
  const [pendingOrders, setPendingOrders] = useState(0);
  const timerRef = useRef(null);

  const load = async () => {
    try {
      const tenantId = localStorage.getItem("smartfix_tenant_id");
      if (!tenantId) return;
      const { count } = await supabase
        .from("order")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["pending", "in_progress", "waiting_parts"]);
      setPendingOrders(count || 0);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    load();
    // Refrescar cada 5 min, solo si visible
    timerRef.current = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 5 * 60 * 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Actualizar al volver al frente
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return { pendingOrders };
}

// ── Badge component ───────────────────────────────────────────────────────
function Badge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className={cn(
      "absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full",
      "bg-red-500 text-white text-[9px] font-black flex items-center justify-center",
      "shadow-[0_0_6px_rgba(239,68,68,0.6)] border border-black/30",
      count > 99 ? "min-w-[22px] px-1" : ""
    )}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function MobileBottomNav() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const [activeTab, setActiveTab] = useState("home");
  const { hasPanelsOpen }         = usePanelState();
  const lastPathRef               = useRef(location.pathname);
  const { pendingOrders }         = useBadgeCounts();

  useEffect(() => {
    const p = location.pathname;
    let currentTab = "home";
    if (p === "/" || p === "/Dashboard") currentTab = "home";
    else if (p.includes("POS"))       currentTab = "pos";
    else if (p.includes("Orders"))    currentTab = "orders";
    else if (p.includes("Customers")) currentTab = "customers";
    else if (p.includes("Settings"))  currentTab = "settings";

    setActiveTab(currentTab);

    if (p !== lastPathRef.current) {
      const history = tabHistory[currentTab];
      if (history && !history.includes(p)) {
        history[history.length - 1] = p;
      }
      lastPathRef.current = p;
    }
  }, [location.pathname]);

  const handleTabClick = (tab) => {
    // Haptic feedback al cambiar de tab
    triggerHaptic(tab.isCenter ? 'medium' : 'light');

    if (location.pathname === tab.path) {
      navigate(tab.path);
      tabHistory[tab.id] = [tab.path];
      return;
    }

    if (tab.id === activeTab) {
      navigate(tab.path);
      tabHistory[tab.id] = [tab.path];
    } else {
      const lastRoute = tabHistory[tab.id][tabHistory[tab.id].length - 1] || tab.path;
      navigate(lastRoute);
    }
  };

  const tabs = [
    {
      id: "orders",    label: "Órdenes",  icon: ClipboardList, path: "/Orders",
      gradient: "from-orange-500 to-amber-500",
      badge: pendingOrders,
    },
    {
      id: "pos",       label: "Caja",     icon: Wallet,        path: "/POS",
      gradient: "from-emerald-500 to-teal-500",
    },
    {
      id: "home",      label: "Inicio",   icon: LayoutGrid,    path: "/Dashboard",
      gradient: "from-blue-500 to-indigo-500", isCenter: true,
    },
    {
      id: "customers", label: "Clientes", icon: Users,         path: "/Customers",
      gradient: "from-purple-500 to-fuchsia-500",
    },
    {
      id: "settings",  label: "Ajustes",  icon: Settings,      path: "/Settings",
      gradient: "from-slate-400 to-slate-500",
    },
  ];

  return (
    <>
      {/* Spacer */}
      <div className={cn(
        "md:hidden w-full flex-shrink-0 transition-all duration-300",
        hasPanelsOpen ? "h-0" : "h-[88px]"
      )} />

      {/* Premium Tab Bar */}
      <nav
        data-global-dock
        className={cn(
          "fixed bottom-0 left-0 right-0 z-[100] md:hidden transition-all duration-300",
          hasPanelsOpen
            ? "translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        )}
      >
        {/* Liquid Glass Background */}
        <div className="liquid-glass-strong absolute inset-0 border-t border-white/[0.06]" />

        {/* Subtle top glow line */}
        <div className="absolute top-0 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Tab Items */}
        <div className="relative flex items-end justify-around px-1 pb-[max(env(safe-area-inset-bottom),16px)] pt-2 h-[88px]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon     = tab.icon;
            const badgeCount = tab.badge || 0;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "relative flex flex-col items-center justify-center min-w-[56px] py-1",
                  "active:scale-90 transition-transform duration-150",
                  tab.isCenter ? "min-w-[64px]" : ""
                )}
              >
                {/* Center (Dashboard) button */}
                {tab.isCenter ? (
                  <div className={cn(
                    "relative w-[52px] h-[52px] rounded-2xl flex items-center justify-center transition-all duration-300",
                    isActive
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 shadow-[0_8px_24px_rgba(99,102,241,0.5)] scale-105"
                      : "bg-white/[0.06] border border-white/[0.08]"
                  )}>
                    {isActive && (
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/30 to-indigo-600/30 blur-lg animate-pulse" />
                    )}
                    <Icon
                      className={cn(
                        "w-6 h-6 relative z-10 transition-colors duration-300",
                        isActive ? "text-white" : "text-white/40"
                      )}
                      strokeWidth={isActive ? 2.5 : 1.8}
                    />
                  </div>
                ) : (
                  <>
                    {/* Active pill indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="mobile-tab-pill"
                        className={cn(
                          "absolute -top-0.5 w-5 h-[3px] rounded-full bg-gradient-to-r",
                          tab.gradient
                        )}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}

                    {/* Icon container with badge */}
                    <div className="relative">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                        isActive ? "bg-white/[0.06]" : ""
                      )}>
                        <Icon
                          className={cn(
                            "w-[22px] h-[22px] transition-all duration-300",
                            isActive ? "text-white" : "text-white/30"
                          )}
                          strokeWidth={isActive ? 2.2 : 1.8}
                        />
                      </div>
                      {/* Badge de notificación */}
                      <Badge count={badgeCount} />
                    </div>

                    {/* Label */}
                    <span className={cn(
                      "text-[10px] font-semibold tracking-tight leading-none mt-0.5 transition-all duration-300",
                      isActive ? "text-white/90" : "text-white/25"
                    )}>
                      {tab.label}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
