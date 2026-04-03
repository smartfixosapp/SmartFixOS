/**
 * GACC — Global Admin Control Center (Main Entry Point)
 * Full modular admin panel with all sections
 */
import React, { useState, useCallback } from "react";
import GACCLayout from "./GACCLayout";
import { GACCProvider } from "./gaccContext";
import CommandCenter from "./CommandCenter";
import StoresDirectory from "./StoresDirectory";
import StoreDetail from "./StoreDetail";
import RevenueView from "./RevenueView";
import OperationsView from "./OperationsView";
import SupportView from "./SupportView";
import SecurityView from "./SecurityView";
import ToolsView from "./ToolsView";
import CommandPalette from "./CommandPalette";

export default function GACC() {
  const [activeSection, setActiveSection] = useState("command-center");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [storeAction, setStoreAction] = useState(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const handleSectionChange = useCallback((section) => {
    setActiveSection(section);
    setSelectedTenant(null);
    setStoreAction(null);
  }, []);

  const handleSelectTenant = useCallback((tenant, action) => {
    setSelectedTenant(tenant);
    setStoreAction(action || null);
    if (activeSection !== "stores") setActiveSection("stores");
  }, [activeSection]);

  const handleBackFromDetail = useCallback(() => {
    setSelectedTenant(null);
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
      case "operations": return <OperationsView />;
      case "support": return <SupportView />;
      case "security": return <SecurityView />;
      case "tools": return <ToolsView />;
      default: return <CommandCenter />;
    }
  };

  return (
    <GACCProvider>
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
    </GACCProvider>
  );
}
