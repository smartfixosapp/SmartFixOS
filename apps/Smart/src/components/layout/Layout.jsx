import React, { useEffect } from "react";
import ModernTopNav from "@/components/layout/ModernTopNav";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { PanelProvider } from "@/components/utils/panelContext";

export default function Layout({ children }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark", "theme-dark");
    root.classList.remove("theme-light");
    return () => root.classList.remove("dark", "theme-dark");
  }, []);

  return (
    <PanelProvider>
      <div className="hidden md:block" style={{ background: "#000" }}>
        <ModernTopNav />
      </div>
      {children}
      <MobileBottomNav />
    </PanelProvider>
  );
}
