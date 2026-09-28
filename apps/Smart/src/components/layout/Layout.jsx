import React from "react";
import ModernTopNav from "@/components/layout/ModernTopNav";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { PanelProvider } from "@/components/utils/panelContext";

export default function Layout({ children }) {
  return (
    <PanelProvider>
      <div className="hidden md:block">
        <ModernTopNav />
      </div>
      {children}
      <MobileBottomNav />
    </PanelProvider>
  );
}
