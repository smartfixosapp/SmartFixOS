import React, { createContext, useContext, useState } from "react";

const PanelContext = createContext();

export function PanelProvider({ children }) {
  const [openPanels, setOpenPanels] = useState(new Set());

  const registerPanel = (panelId) => {
    setOpenPanels(prev => new Set([...prev, panelId]));
  };

  const unregisterPanel = (panelId) => {
    setOpenPanels(prev => {
      const next = new Set(prev);
      next.delete(panelId);
      return next;
    });
  };

  const hasPanelsOpen = openPanels.size > 0;

  return (
    <PanelContext.Provider value={{ registerPanel, unregisterPanel, hasPanelsOpen }}>
      {children}
    </PanelContext.Provider>
  );
}

export function usePanelState() {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error("usePanelState must be used within PanelProvider");
  }
  return context;
}
