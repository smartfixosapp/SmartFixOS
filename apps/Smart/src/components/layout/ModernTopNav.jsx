import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Wrench, ShoppingCart, Home, Users, PieChart, Package, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { useBusinessMode } from "@/lib/businessMode";

const BRAND = "#F2662E";

const ITEMS = [
  { id: "orders", icon: Wrench, label: "Órdenes", path: "/Orders" },
  { id: "pos", icon: ShoppingCart, label: "POS", path: "/POS" },
  { id: "home", icon: Home, label: "Inicio", path: "/Dashboard" },
  { id: "customers", icon: Users, label: "Clientes", path: "/Customers" },
  { id: "financial", icon: PieChart, label: "Finanzas", path: "/Financial" },
];

const INVENTORY_ITEM = { id: "inventory", icon: Package, label: "Inventario", path: "/Inventory" };
const SETTINGS_PATH = "/Settings";
const lastRoutes = {};

function activeIdFor(pathname, retail) {
  if (pathname === "/" || pathname.startsWith("/Dashboard")) return "home";
  if (pathname.startsWith("/Inventory")) return retail ? "inventory" : "settings";
  if (pathname.startsWith("/Settings")) return "settings";
  const match = ITEMS.find((item) => item.id !== "home" && pathname.startsWith(item.path));
  return match ? match.id : "";
}

export default function ModernTopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const retail = useBusinessMode() === "retail";
  const activeId = activeIdFor(location.pathname, retail);
  const items = retail ? [INVENTORY_ITEM, ...ITEMS.slice(1)] : ITEMS;
  const settingsActive = activeId === "settings";

  useEffect(() => {
    if (!activeId) return;
    if (activeId === "settings" && location.pathname.startsWith("/Inventory")) return;
    lastRoutes[activeId] = location.pathname;
  }, [activeId, location.pathname]);

  const go = (id, rootPath) => {
    const here = location.pathname;
    if (id === activeId) {
      if (here !== rootPath || location.search) navigate(rootPath);
      return;
    }
    navigate(lastRoutes[id] || rootPath);
  };

  return (
    <div className="apple-type app-nav-wrap" style={{ height: "var(--app-nav-h)", boxSizing: "border-box", paddingTop: "env(safe-area-inset-top, 0px)", display: "grid", gridTemplateColumns: "42px minmax(0, 1fr) 42px", alignItems: "center", gap: 12, paddingLeft: 16, paddingRight: 16 }}>
      <span aria-hidden="true" />
      <nav aria-label="Navegación principal" className="flex justify-center min-w-0">
        <div className="flex items-center overflow-x-auto" style={{ gap: 2, padding: 5, borderRadius: 999, background: "#1C1C1E", border: "0.5px solid rgba(84,84,88,0.6)", maxWidth: "100%", scrollbarWidth: "none" }}>
          {items.map((item) => {
            const isActive = activeId === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id, item.path)}
                aria-current={isActive ? "page" : undefined}
                className="apple-press relative flex items-center whitespace-nowrap"
                style={{ gap: 7, padding: "9px 16px", borderRadius: 999, color: isActive ? "#fff" : "rgba(235,235,245,0.6)", fontSize: 15, fontWeight: 600 }}
              >
                {isActive && (
                  <motion.span layoutId="top-nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} style={{ position: "absolute", inset: 0, borderRadius: 999, background: BRAND }} />
                )}
                <Icon className="relative" style={{ width: 17, height: 17 }} strokeWidth={2.2} />
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      <button
        onClick={() => go("settings", SETTINGS_PATH)}
        aria-label="Ajustes"
        aria-current={settingsActive ? "page" : undefined}
        className="apple-press flex items-center justify-center"
        style={{ width: 42, height: 42, borderRadius: 999, background: settingsActive ? BRAND : "#1C1C1E", border: "0.5px solid rgba(84,84,88,0.6)", color: settingsActive ? "#fff" : "rgba(235,235,245,0.7)" }}
      >
        <Settings style={{ width: 18, height: 18 }} strokeWidth={2.2} />
      </button>
    </div>
  );
}
