import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { applyAppearance, clearAppearance } from "@/lib/appearance";
import ModernTopNav from "@/components/layout/ModernTopNav";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { PanelProvider } from "@/components/utils/panelContext";
import { TenantProvider } from "@/components/utils/tenantContext";
import AppLock from "@/components/auth/AppLock";
import CelebrationHost from "@/components/ui/CelebrationHost";
import ChangePinGate from "@/components/auth/ChangePinGate";
import TeamAlerts from "@/components/notifications/TeamAlerts";

export default function Layout({ children }) {
  const { pathname } = useLocation();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark", "theme-dark");
    root.classList.remove("theme-light");
    applyAppearance();
    return clearAppearance;
  }, []);

  return (
    <TenantProvider>
      <PanelProvider>
        <div className="hidden md:block" style={{ position: "sticky", top: 0, zIndex: 40, background: "#000", boxShadow: "0 0.5px 0 rgba(84,84,88,0.45)" }}>
          <ModernTopNav />
        </div>
        <div key={pathname} className="page-fade">{children}</div>
        <MobileBottomNav />
        <AppLock />
        <CelebrationHost />
        <ChangePinGate />
        <TeamAlerts />
      </PanelProvider>
    </TenantProvider>
  );
}
