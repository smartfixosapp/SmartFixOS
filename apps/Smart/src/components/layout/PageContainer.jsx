// ============================================
// 📱 PageContainer - Contenedor responsivo y seguro para móviles
// Evita overlays invisibles y optimiza layout en todas las pantallas
// ============================================

import React from "react";

export default function PageContainer({ className = "", children }) {
  return (
    <div
      className={`
        app-page
        px-3 sm:px-4 md:px-6
        max-w-7xl mx-auto w-full
        ${className}
      `.trim()}
      data-pointer-overlay="off"
    >
      {children}
    </div>
  );
}
