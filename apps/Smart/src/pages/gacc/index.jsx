/**
 * GACC — Global Admin Control Center (Main Entry Point)
 * Replaces the monolithic SuperAdmin.jsx with modular sub-views
 */
import React, { useState, useCallback } from "react";
import GACCLayout from "./GACCLayout";
import { GACCProvider } from "./gaccContext";
import CommandCenter from "./CommandCenter";
import StoresDirectory from "./StoresDirectory";
import StoreDetail from "./StoreDetail";
import { RevenueView, OperationsView, SupportView, SecurityView, ToolsView } from "./PlaceholderViews";

export default function GACC() {
  const [activeSection, setActiveSection] = useState("command-center");
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [storeAction, setStoreAction] = useState(null);

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

  const renderContent = () => {
    // If a tenant is selected, show store detail regardless of section
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
      <GACCLayout activeSection={activeSection} onSectionChange={handleSectionChange}>
        {renderContent()}
      </GACCLayout>
    </GACCProvider>
  );
}
