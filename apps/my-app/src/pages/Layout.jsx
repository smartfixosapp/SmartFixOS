import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { Toaster } from "sonner";
// 👈 MIGRACIÓN: Usar dataClient unificado
import { dataClient } from "@/components/api/dataClient";
import { useVirtualKeyboard } from "@/components/utils/KeyboardAwareLayout";
import { I18nProvider } from "@/components/utils/i18n";
import { TenantProvider } from "@/components/utils/tenantContext";
import PuertoRicoTopNav from "@/components/layout/PuertoRicoTopNav";
import { LowStockMonitor } from "@/components/notifications/LowStockMonitor";
import { useRealtimeNotifications } from "@/components/notifications/RealtimeNotifications";
import { notificationEngine } from "@/components/notifications/AdvancedNotificationsEngine";
import PWAMetaTags from "@/components/utils/PWAMetaTags";

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState("dark");
  const { keyboardOpen } = useVirtualKeyboard();

  // 🔔 Notificaciones en tiempo real (solo para admins/managers)
  const shouldEnableNotifications =
    user && (user.role === "admin" || user.role === "manager");
  useRealtimeNotifications({ enabled: shouldEnableNotifications });

  // ✅ Detectar si estamos en el Dashboard
  const isDashboard = useMemo(
    () => location.pathname === "/" || location.pathname === "/Dashboard",
    [location.pathname],
  );

  // ✅ Detectar si estamos en PinAccess
  const isPinAccess = useMemo(
    () => location.pathname === "/PinAccess",
    [location.pathname],
  );

  // ✅ Detectar si debemos ocultar el header (todas las páginas excepto Dashboard y PinAccess/Welcome)
  const hideHeader = useMemo(
    () => !isDashboard && !isPinAccess,
    [isDashboard, isPinAccess],
  );

  // ✅ CARGAR USUARIO - ACCESO LIBRE SIN AUTENTICACIÓN
  useEffect(() => {
    // Si estamos en páginas públicas, NO cargar usuario
    if (isPinAccess) {
      setUser(null);
      return;
    }

    // Crear usuario invitado automático si no hay sesión
    let isMounted = true;

    (async () => {
      try {
        const u = await dataClient.auth.me();
        if (isMounted && u) {
          setUser(u);

          // AI NOTE: Iniciar monitor de stock bajo solo para admins
          if (u.role === "admin" || u.role === "manager") {
            LowStockMonitor.checkLowStockProducts();
            // Iniciar motor de notificaciones avanzadas
            notificationEngine.start();
          }
        }
      } catch (err) {
        if (isMounted) {
          console.log("Layout: No hay usuario autenticado");
          setUser(null);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isPinAccess]);

  // ✅ Load theme on mount
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const configs = await dataClient.entities.AppSettings.filter({
          slug: "app-theme",
        });
        if (isMounted && configs?.length) {
          const savedTheme = configs[0].payload?.theme || "dark";
          setTheme(savedTheme);
          if (savedTheme === "light") {
            document.documentElement.classList.add("theme-light");
            document.documentElement.classList.remove("theme-dark");
          } else {
            document.documentElement.classList.remove("theme-light");
            document.documentElement.classList.add("theme-dark");
          }
        }
      } catch (error) {
        console.error("Error loading theme:", error);
        // Fallback to dark theme
        if (isMounted) {
          setTheme("dark");
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const darkBgUrl =
    "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/572f84138_IMG_0296.png";
  const lightBgUrl =
    "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68f767a3d5fce1486d4cf555/5e30d189f_IMG_1003.png";

  return (
    <I18nProvider>
      <TenantProvider>
        <PWAMetaTags />
        <div
          className={`flex h-screen flex-col relative ${theme === "light" ? "text-gray-900" : "text-slate-100"}`}
          style={{
            backgroundImage: isPinAccess
              ? "none"
              : `url(${theme === "light" ? lightBgUrl : darkBgUrl})`,
            backgroundColor: "#000000",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundAttachment: "fixed",
          }}
        >
          {/* Overlay para mejorar legibilidad - SOLO SI NO ES PINACCESS */}
          {!isPinAccess && (
            <div
              className={`fixed inset-0 -z-10 ${theme === "light" ? "bg-[#F5F5F5]/95" : "bg-black/70"} backdrop-blur-sm`}
            />
          )}

          <Toaster
            position="top-right"
            toastOptions={{
              className:
                theme === "light"
                  ? "bg-white border-gray-200 text-gray-900 shadow-lg"
                  : "bg-black/90 backdrop-blur-xl border border-white/10 text-white",
              style:
                theme === "light"
                  ? {
                      background: "white",
                      border: "1px solid #E5E7EB",
                      color: "#111827",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                    }
                  : {
                      background: "rgba(0, 0, 0, 0.9)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      color: "white",
                    },
            }}
            richColors
          />

          {/* === Contenido === */}
          <main
            className="flex-1 overflow-y-auto px-3 sm:px-5 pt-20 pb-6"
            data-pointer-overlay="off"
          >
            <div data-pointer-target="on">{children}</div>
          </main>

          {/* 🇵🇷 Top Nav - VISIBLE EN TODAS LAS PANTALLAS EXCEPTO PINACCESS */}
          {!isPinAccess && <PuertoRicoTopNav />}

          {/* ===== CSS PARA OCULTAR BARRA BLANCA DE NAVEGADOR EN iOS ===== */}
          <style>{`
        @supports (-webkit-touch-callout: none) {
          body {
            padding-bottom: env(safe-area-inset-bottom);
          }
        }
      `}</style>

          {/* ===== CSS GLOBAL PARA TEMAS Y ANIMACIONES ===== */}
          <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* ✅ ANIMACIÓN DE BOTONES ACTIVOS */
        @keyframes pulseGlow {
          0%, 100% {
            box-shadow: 0 8px 24px rgba(0, 168, 232, 0.4);
          }
          50% {
            box-shadow: 0 12px 32px rgba(16, 185, 129, 0.6);
          }
        }

        header a.scale-110 {
          animation: pulseGlow 2s ease-in-out infinite;
        }
      `}</style>
        </div>
      </TenantProvider>
    </I18nProvider>
  );
}
