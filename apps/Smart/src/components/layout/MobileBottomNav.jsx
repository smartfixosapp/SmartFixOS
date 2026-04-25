import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
import { motion, AnimatePresence } from "framer-motion";
import { triggerHaptic } from "@/lib/capacitor";
import { supabase } from "../../../../../lib/supabase-client.js";

const tabHistory = {
  home:      ["/Dashboard"],
  orders:    ["/Orders"],
  pos:       ["/POS"],
  financial: ["/Financial"],
  settings:  ["/Settings"],
};

// ── Badge counts hook ──────────────────────────────────────────────────────
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
    timerRef.current = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 5 * 60 * 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    const handler = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return { pendingOrders };
}

// ── Badge (iOS red pill) ────────────────────────────────────────────────────
function Badge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      className={cn(
        "absolute -top-1 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full",
        "bg-red-500 text-white text-[10px] font-bold tabular-nums flex items-center justify-center",
        "shadow-sm ring-[1.5px] ring-black/30",
        count > 99 ? "min-w-[24px]" : ""
      )}
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}

export default function MobileBottomNav() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const [activeTab, setActiveTab] = useState("home");
  const { hasPanelsOpen }         = usePanelState();
  const lastPathRef               = useRef(location.pathname);
  const { pendingOrders }         = useBadgeCounts();

  // ── Visual Viewport API ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateViewport = () => {
      const vv = window.visualViewport;
      const realH = window.innerHeight;
      const visualH = vv ? vv.height : realH;
      const visualOffsetTop = vv ? vv.offsetTop : 0;
      const trueBottom = Math.round(visualH + visualOffsetTop);
      const diff = Math.max(0, window.innerHeight - trueBottom);
      document.documentElement.style.setProperty("--nav-real-vh", `${trueBottom}px`);
      document.documentElement.style.setProperty("--nav-gap-fix", `${diff}px`);
    };
    updateViewport();
    window.addEventListener("resize", updateViewport, { passive: true });
    window.addEventListener("orientationchange", updateViewport, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateViewport, { passive: true });
      window.visualViewport.addEventListener("scroll", updateViewport, { passive: true });
    }
    return () => {
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateViewport);
        window.visualViewport.removeEventListener("scroll", updateViewport);
      }
    };
  }, []);

  // ── Sync active tab con location ────────────────────────────────────────
  useEffect(() => {
    const p = location.pathname;
    let tab = "home";
    if (p === "/" || p === "/Dashboard") tab = "home";
    else if (p.includes("POS"))         tab = "pos";
    else if (p.includes("Orders"))      tab = "orders";
    else if (p.includes("Financial"))   tab = "financial";
    else if (p.includes("Settings"))    tab = "settings";
    setActiveTab(tab);
    if (p !== lastPathRef.current) {
      const history = tabHistory[tab];
      if (history && !history.includes(p)) history[history.length - 1] = p;
      lastPathRef.current = p;
    }
  }, [location.pathname]);

  const handleTabClick = (tab) => {
    triggerHaptic(tab.isCenter ? "medium" : "light");
    if (tab.id === activeTab || location.pathname === tab.path) {
      navigate(tab.path);
      tabHistory[tab.id] = [tab.path];
      return;
    }
    const lastRoute = tabHistory[tab.id]?.[tabHistory[tab.id].length - 1] || tab.path;
    navigate(lastRoute);
  };

  const tabs = [
    { id: "orders",    label: "Órdenes",  icon: ClipboardList, path: "/Orders",    badge: pendingOrders },
    { id: "pos",       label: "Caja",     icon: Wallet,        path: "/POS" },
    { id: "home",      label: "Inicio",   icon: LayoutGrid,    path: "/Dashboard",  isCenter: true },
    { id: "financial", label: "Finanzas", icon: TrendingUp,    path: "/Financial" },
    { id: "settings",  label: "Ajustes",  icon: Settings,      path: "/Settings" },
  ];

  const spacer = (
    <div
      className={cn(
        "md:hidden w-full flex-shrink-0 transition-all duration-300",
        hasPanelsOpen ? "h-0" : ""
      )}
      style={!hasPanelsOpen ? {
        height: "calc(72px + clamp(16px, env(safe-area-inset-bottom, 28px), 44px))"
      } : undefined}
    />
  );

  const tabBar = (
    <nav
      data-global-dock
      className={cn(
        "apple-type fixed left-0 right-0 z-[100] md:hidden",
        "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        hasPanelsOpen
          ? "translate-y-full opacity-0 pointer-events-none"
          : "translate-y-0 opacity-100"
      )}
      style={{
        position: "fixed",
        bottom: "var(--nav-gap-fix, 0px)",
        paddingBottom: "clamp(16px, env(safe-area-inset-bottom, 28px), 44px)",
        paddingLeft: "12px",
        paddingRight: "12px",
        paddingTop: "8px",
        background: "transparent",
        border: "none",
        boxShadow: "none",
      }}
    >
      {/* The floating pill container */}
      <div
        className="liquid-glass-floating relative flex items-center justify-around px-2 h-[60px] w-full"
        style={{
          borderRadius: "28px",
        }}
      >
        {/* Sliding background bubble for active tab */}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          if (!isActive) return null;
          return (
            <motion.div
              key="bubble"
              layoutId="nav-bubble"
              className="absolute inset-y-[7px] rounded-[18px] pointer-events-none"
              style={{
                left: `calc(${tabs.findIndex(t => t.id === tab.id)} * 20% + 6px)`,
                width: "calc(20% - 8px)",
                background: tab.isCenter
                  ? "linear-gradient(135deg, rgba(255,149,0,0.28) 0%, rgba(255,149,0,0.16) 100%)"
                  : "rgba(255,149,0,0.18)",
                boxShadow: "0 0 0 1px rgba(255,149,0,0.22)",
              }}
              transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
            />
          );
        })}

        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon     = tab.icon;
          const badgeCount = tab.badge || 0;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              className="relative z-10 flex flex-col items-center justify-center gap-[3px] flex-1 h-full py-1 rounded-[18px] focus:outline-none active:scale-[0.93] transition-transform duration-[80ms]"
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {/* Icon */}
              <div className="relative">
                <motion.div
                  animate={isActive
                    ? { scale: 1.18, y: -1 }
                    : { scale: 1,    y: 0  }
                  }
                  transition={{ type: "spring", stiffness: 420, damping: 28 }}
                >
                  <Icon
                    className="w-[23px] h-[23px] transition-colors duration-150"
                    style={{ color: isActive ? "rgb(var(--apple-orange))" : "rgb(var(--label-tertiary) / 0.55)" }}
                    strokeWidth={isActive ? 2.2 : 1.7}
                  />
                </motion.div>
                <AnimatePresence>
                  {badgeCount > 0 && <Badge count={badgeCount} />}
                </AnimatePresence>
              </div>

              {/* Label */}
              <motion.span
                animate={isActive
                  ? { opacity: 1, scale: 1,    y: 0 }
                  : { opacity: 0.45, scale: 0.92, y: 0 }
                }
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="text-[10px] leading-none font-medium transition-none"
                style={{ color: isActive ? "rgb(var(--apple-orange))" : "rgb(var(--label-tertiary) / 0.55)" }}
              >
                {tab.label}
              </motion.span>
            </button>
          );
        })}
      </div>
    </nav>
  );

  return (
    <>
      {spacer}
      {typeof document !== "undefined" ? createPortal(tabBar, document.body) : null}
    </>
  );
}
