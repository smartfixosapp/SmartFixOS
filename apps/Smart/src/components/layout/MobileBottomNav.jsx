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

// ── Badge component (iOS-style red pill) ─────────────────────────────────
function Badge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className={cn(
      "absolute -top-1 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full",
      "bg-apple-red text-white text-[11px] font-semibold tabular-nums flex items-center justify-center",
      "shadow-apple-sm ring-2 ring-[rgb(var(--surface-primary))] dark:ring-[rgb(var(--surface-tertiary))]",
      count > 99 ? "min-w-[24px]" : ""
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
    else if (p.includes("Financial")) currentTab = "financial";
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
    { id: "orders",    label: "Órdenes",  icon: ClipboardList, path: "/Orders",    badge: pendingOrders },
    { id: "pos",       label: "Caja",     icon: Wallet,        path: "/POS" },
    { id: "home",      label: "Inicio",   icon: LayoutGrid,    path: "/Dashboard" },
    { id: "financial", label: "Finanzas", icon: TrendingUp,    path: "/Financial" },
    { id: "settings",  label: "Ajustes",  icon: Settings,      path: "/Settings" },
  ];

  return (
    <>
      {/* Spacer */}
      <div className={cn(
        "md:hidden w-full flex-shrink-0 transition-all duration-300",
        hasPanelsOpen ? "h-0" : "h-[72px]"
      )} />

      {/* Tab Bar estilo iOS — translúcido con blur, uniforme */}
      <nav
        data-global-dock
        className={cn(
          "apple-type fixed bottom-0 left-0 right-0 z-[100] md:hidden transition-all duration-300",
          hasPanelsOpen
            ? "translate-y-full opacity-0 pointer-events-none"
            : "translate-y-0 opacity-100"
        )}
      >
        {/* Fondo translúcido Apple (vibrancy) */}
        <div
          className="absolute inset-0 border-t border-[rgb(var(--separator)/0.29)]"
          style={{
            backgroundColor: "rgb(var(--surface-elevated) / 0.72)",
            WebkitBackdropFilter: "blur(28px) saturate(190%)",
            backdropFilter: "blur(28px) saturate(190%)",
          }}
        />

        {/* Tab items */}
        <div className="relative flex items-stretch justify-around px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon     = tab.icon;
            const badgeCount = tab.badge || 0;

            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "apple-press relative flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1.5 px-1 rounded-apple-sm",
                  "apple-focusable"
                )}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
              >
                {/* Icon container with badge */}
                <div className="relative">
                  <Icon
                    className={cn(
                      "w-[26px] h-[26px] transition-colors duration-200",
                      isActive ? "text-apple-blue" : "apple-label-tertiary"
                    )}
                    strokeWidth={isActive ? 2.1 : 1.8}
                  />
                  <Badge count={badgeCount} />
                </div>

                {/* Label estilo iOS — caption2 (11px) */}
                <span className={cn(
                  "text-[11px] leading-[13px] transition-colors duration-200",
                  isActive
                    ? "text-apple-blue font-semibold"
                    : "apple-label-tertiary font-medium"
                )}>
                  {tab.label}
                </span>

                {/* Animación subtle del active tab: leve pill superior */}
                {isActive && (
                  <motion.div
                    layoutId="mobile-tab-active"
                    className="absolute -top-1 w-6 h-[2.5px] rounded-full bg-apple-blue"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
