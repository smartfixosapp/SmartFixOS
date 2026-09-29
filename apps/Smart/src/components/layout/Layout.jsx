import React, { useEffect } from "react";
import ModernTopNav from "@/components/layout/ModernTopNav";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { PanelProvider } from "@/components/utils/panelContext";
import { TenantProvider } from "@/components/utils/tenantContext";

export default function Layout({ children }) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark", "theme-dark");
    root.classList.remove("theme-light");
  }, []);

  return (
    <TenantProvider>
      <PanelProvider>
        <div className="hidden md:block" style={{ background: "#000" }}>
          <ModernTopNav />
        </div>
        {children}
        <MobileBottomNav />
      </PanelProvider>
    </TenantProvider>
  );
}
