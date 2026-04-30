"use client";
import { useTheme } from "next-themes"
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
  const { theme = "system" } = useTheme()

  return (
    (<Sonner
      theme={theme}
      position="bottom-center"
      duration={2200}
      visibleToasts={3}
      offset={16}
      mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
      closeButton={false}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props} />)
  );
}

export { Toaster }
