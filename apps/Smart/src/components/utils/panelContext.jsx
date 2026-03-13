import React, { createContext, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const PanelContext = createContext();

export function PanelProvider({ children }) {
  const location = useLocation();
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

  useEffect(() => {
    // Si cambiamos de pantalla, limpiar paneles colgados para no bloquear la navegación.
    setOpenPanels(new Set());
  }, [location.pathname]);

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
