import React from "react";

/**
 * ScrollPanel - Contenedor de scroll reutilizable con 3 zonas (header/scroll/footer)
 * Patrón probado que funciona en OpenDrawerDialog
 */
export default function ScrollPanel({ header, footer, children, className = "" }) {
  return (
    <div className={`scroll-panel-root ${className}`}>
      {header && (
        <div className="scroll-panel-header">
          {header}
        </div>
      )}
      
      <div className="scroll-panel-scroll custom-scrollbar">
        {children}
      </div>
      
      {footer && (
        <div className="scroll-panel-footer">
          {footer}
        </div>
      )}
    </div>
  );
}
