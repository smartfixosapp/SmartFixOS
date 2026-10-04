"use client";
import { Toaster as Sonner } from "sonner"

/**
 * Toaster — wrapper sobre Sonner con configuración específica para SmartFixOS.
 *
 * Decisiones de UX:
 *   - position="bottom-center"    → no tapa el header ni la barra de navegación
 *                                    superior donde el usuario suele estar interactuando.
 *   - duration={2200}             → 2.2s, lo justo para leer "Guardado" sin
 *                                    interrumpir el flujo de trabajo.
 *   - offset={16}                 → respira de los bordes
 *   - mobileOffset                → respeta el bottom-tab nav del móvil
 *   - closeButton={false}         → menos clics para descartar; se va solo.
 *   - visibleToasts={3}           → si hay muchos eventos seguidos no apilan en una columna gigante.
 *   - pointer-events solo sobre el toast, NO sobre el contenedor (Sonner lo hace ya).
 */
const Toaster = ({
  ...props
}) => {
  return (
    (<Sonner
      theme="dark"
      position="top-center"
      duration={2600}
      visibleToasts={3}
      offset={80}
      mobileOffset={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      closeButton={false}
      className="toaster group"
      toastOptions={{
        style: {
          borderRadius: 999,
          background: "rgba(44,44,46,0.94)",
          color: "#fff",
          border: "0.5px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(20px)",
          padding: "12px 22px",
          fontSize: 14,
          fontWeight: 600,
          boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
        },
      }}
      {...props} />)
  );
}

export { Toaster }
