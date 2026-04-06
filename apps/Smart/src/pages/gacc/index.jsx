/**
 * GACC — Global Admin Control Center (Main Entry Point)
 * Full modular admin panel with all sections
 */
import React, { useState, useCallback } from "react";
import GACCLayout from "./GACCLayout";
import { GACCProvider, useGACC } from "./gaccContext";
import CommandCenter from "./CommandCenter";
import StoresDirectory from "./StoresDirectory";
import StoreDetail from "./StoreDetail";
import RevenueView from "./RevenueView";
import AnalyticsView from "./AnalyticsView";
import OperationsView from "./OperationsView";
import GrowthView from "./GrowthView";
import SupportView from "./SupportView";
import SecurityView from "./SecurityView";
import ToolsView from "./ToolsView";
import CommandPalette from "./CommandPalette";

function GACCInner() {
  const { tenants } = useGACC();
  const [activeSection, setActiveSection] = useState("command-center");
  const [selectedTenantId, setSelectedTenantId] = useState(null);
  const [storeAction, setStoreAction] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Always resolve fresh tenant from context
  const selectedTenant = selectedTenantId ? tenants.find(t => t.id === selectedTenantId) || null : null;

  const handleSectionChange = useCallback((section) => {
    setActiveSection(section);
    setSelectedTenantId(null);
    setStoreAction(null);
  }, []);

  const handleSelectTenant = useCallback((tenant, action) => {
    setSelectedTenantId(tenant.id);
    setStoreAction(action || null);
    setActiveSection("stores");
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setSelectedTenantId(null);
    setStoreAction(null);
  }, []);

  const handlePaletteClose = useCallback((action) => {
    if (action === "toggle") { setPaletteOpen(prev => !prev); return; }
    setPaletteOpen(false);
  }, []);

  const renderContent = () => {
    if (selectedTenant) {
      return <StoreDetail tenant={selectedTenant} onBack={handleBackFromDetail} />;
    }

    switch (activeSection) {
      case "command-center": return <CommandCenter />;
      case "stores": return <StoresDirectory onSelectTenant={handleSelectTenant} />;
      case "revenue": return <RevenueView />;
      case "analytics": return <AnalyticsView />;
      case "operations": return <OperationsView />;
      case "growth": return <GrowthView />;
      case "support": return <SupportView />;
      case "security": return <SecurityView />;
      case "tools": return <ToolsView />;
      default: return <CommandCenter />;
    }
  };

  return (
    <GACCLayout
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      onOpenPalette={() => setPaletteOpen(true)}
    >
      {renderContent()}
      <CommandPalette
        open={paletteOpen}
        onClose={handlePaletteClose}
        onNavigate={handleSectionChange}
        onSelectTenant={handleSelectTenant}
      />
    </GACCLayout>
  );
}

export default function GACC() {
  return (
    <GACCProvider>
      <GACCInner />
    </GACCProvider>
  );
}
