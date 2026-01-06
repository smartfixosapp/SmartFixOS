import { useState, useEffect } from "react";

export function useDeviceDetection() {
  const [deviceType, setDeviceType] = useState("desktop");
  const [screenSize, setScreenSize] = useState({
    width: typeof window !== "undefined" ? window.innerWidth : 1024,
    height: typeof window !== "undefined" ? window.innerHeight : 768
  });

  useEffect(() => {
    const updateDeviceType = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setScreenSize({ width, height });

      // Móvil pequeño: hasta 6.7" (aprox 430px en landscape, 390px portrait)
      if (width <= 430) {
        setDeviceType("mobile-small");
      }
      // Móvil grande / phablet: hasta 7" (aprox 540px)
      else if (width <= 540) {
        setDeviceType("mobile-large");
      }
      // Tablet pequeña: hasta 8" (aprox 768px)
      else if (width <= 768) {
        setDeviceType("tablet-small");
      }
      // Tablet grande: hasta 10" (aprox 1024px)
      else if (width <= 1024) {
        setDeviceType("tablet-large");
      }
      // Desktop
      else {
        setDeviceType("desktop");
      }
    };

    updateDeviceType();
    window.addEventListener("resize", updateDeviceType);
    window.addEventListener("orientationchange", updateDeviceType);

    return () => {
      window.removeEventListener("resize", updateDeviceType);
      window.removeEventListener("orientationchange", updateDeviceType);
    };
  }, []);

  return {
    deviceType,
    screenSize,
    isMobile: deviceType === "mobile-small" || deviceType === "mobile-large",
    isTablet: deviceType === "tablet-small" || deviceType === "tablet-large",
    isDesktop: deviceType === "desktop",
    isMobileSmall: deviceType === "mobile-small",
    width: screenSize.width,
    height: screenSize.height
  };
}
