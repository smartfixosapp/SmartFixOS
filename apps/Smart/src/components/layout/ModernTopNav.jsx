import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home,
  ClipboardList,
  Wallet,
  DollarSign,
  Settings,
  Package,
  Users,
} from "lucide-react";

import { useBusinessMode } from "@/lib/businessMode";
const NAV_ITEMS = [
  { id: "orders", icon: ClipboardList, label: "Órdenes", path: "/Orders" },
  { id: "pos", icon: Wallet, label: "POS", path: "/POS" },
  { id: "inventory", icon: Package, label: "Inventario", path: "/Inventory" },
  { id: "home", icon: Home, label: "Inicio", path: "/Dashboard" },
  { id: "customers", icon: Users, label: "Clientes", path: "/Customers" },
  { id: "financial", icon: DollarSign, label: "Finanzas", path: "/Financial" },
  { id: "settings", icon: Settings, label: "Ajustes", path: "/Settings" },
];

function activeIdFor(pathname) {
  if (pathname === "/" || pathname === "/Dashboard") return "home";
  const match = NAV_ITEMS.find((item) => item.path !== "/Dashboard" && pathname.startsWith(item.path));
  return match ? match.id : "";
}

export default function ModernTopNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = activeIdFor(location.pathname);
  const mode = useBusinessMode();
  const items = mode === "retail" ? NAV_ITEMS.filter((item) => item.id !== "orders") : NAV_ITEMS;

  return (
    <div className="apple-type px-4 py-3 sm:py-4">
      <nav
        className="liquid-glass relative rounded-full flex items-center justify-between gap-1 p-1.5 max-w-3xl mx-auto"
        aria-label="Navegación principal"
      >
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { if (location.pathname !== item.path) navigate(item.path); }}
              aria-current={isActive ? "page" : undefined}
              className="apple-press flex-1 flex flex-col items-center justify-center gap-0.5 h-12 rounded-full transition-colors"
              style={{
                background: isActive ? "#F2662E" : "transparent",
                color: isActive ? "#fff" : "rgba(150,150,165,0.85)",
              }}
            >
              <Icon className="w-[19px] h-[19px]" strokeWidth={isActive ? 2.2 : 1.8} />
              <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
