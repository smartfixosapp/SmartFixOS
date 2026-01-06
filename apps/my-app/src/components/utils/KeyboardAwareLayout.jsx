import { useEffect, useState } from "react";

/**
 * Hook para detectar el teclado virtual en móvil/tablet
 * Detecta cuando la altura visible baja (teclado abierto)
 */
export function useVirtualKeyboard() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let initialHeight = window.innerHeight;
    let lastHeight = initialHeight;

    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const diff = lastHeight - currentHeight;

      // Si la altura baja más de 120px, asumimos teclado abierto
      if (diff > 120) {
        setKeyboardOpen(true);
        setKeyboardHeight(diff);
        document.documentElement.classList.add("kb-open");
        document.documentElement.style.setProperty('--kb-height', `${diff}px`);
        
        // Ajustar body para prevenir scroll
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        document.body.style.top = `-${window.scrollY}px`;
      } else if (diff < -100) {
        // Si la altura sube, el teclado se cerró
        const scrollY = parseInt(document.body.style.top || '0') * -1;
        
        setKeyboardOpen(false);
        setKeyboardHeight(0);
        document.documentElement.classList.remove("kb-open");
        document.documentElement.style.setProperty('--kb-height', '0px');
        
        // Restaurar body
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
        window.scrollTo(0, scrollY);
      }

      lastHeight = currentHeight;
    };

    // Usar visualViewport si está disponible (más preciso)
    if (window.visualViewport) {
      const handleVisualViewport = () => {
        const viewportHeight = window.visualViewport.height;
        const diff = initialHeight - viewportHeight;

        if (diff > 120) {
          setKeyboardOpen(true);
          setKeyboardHeight(diff);
          document.documentElement.classList.add("kb-open");
          document.documentElement.style.setProperty('--kb-height', `${diff}px`);
          
          // Ajustar body
          const scrollY = window.scrollY;
          document.body.style.position = 'fixed';
          document.body.style.width = '100%';
          document.body.style.top = `-${scrollY}px`;
        } else if (diff < 50) {
          const scrollY = parseInt(document.body.style.top || '0') * -1;
          
          setKeyboardOpen(false);
          setKeyboardHeight(0);
          document.documentElement.classList.remove("kb-open");
          document.documentElement.style.setProperty('--kb-height', '0px');
          
          // Restaurar body
          document.body.style.position = '';
          document.body.style.width = '';
          document.body.style.top = '';
          window.scrollTo(0, scrollY);
        }
      };

      window.visualViewport.addEventListener("resize", handleVisualViewport);
      window.visualViewport.addEventListener("scroll", handleVisualViewport);

      return () => {
        window.visualViewport.removeEventListener("resize", handleVisualViewport);
        window.visualViewport.removeEventListener("scroll", handleVisualViewport);
        document.documentElement.classList.remove("kb-open");
        document.documentElement.style.setProperty('--kb-height', '0px');
        
        // Limpiar estilos del body
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
      };
    } else {
      // Fallback a window.innerHeight
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        document.documentElement.classList.remove("kb-open");
        document.documentElement.style.setProperty('--kb-height', '0px');
        
        // Limpiar estilos del body
        document.body.style.position = '';
        document.body.style.width = '';
        document.body.style.top = '';
      };
    }
  }, []);

  return { keyboardOpen, keyboardHeight };
}

/**
 * Hook para hacer scroll al input enfocado cuando se abre el teclado
 */
export function useKeyboardScrollIntoView(containerRef) {
  useEffect(() => {
    const handleFocus = (e) => {
      if (
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.tagName === "SELECT"
      ) {
        // Esperar a que el teclado se abra
        setTimeout(() => {
          // Si hay un contenedor padre con scroll, scrollear dentro de él
          if (containerRef?.current) {
            const container = containerRef.current;
            const input = e.target;
            const inputRect = input.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Si el input está fuera del viewport del contenedor
            if (inputRect.bottom > containerRect.bottom || inputRect.top < containerRect.top) {
              input.scrollIntoView({ block: "center", behavior: "smooth" });
            }
          } else {
            // Scroll global
            e.target.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }, 300);
      }
    };

    document.addEventListener("focusin", handleFocus, true);

    return () => {
      document.removeEventListener("focusin", handleFocus, true);
    };
  }, [containerRef]);
}
