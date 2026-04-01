import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils/helpers";
import { Toaster } from "sonner";
// 👈 MIGRACIÓN: Usar dataClient unificado
import { dataClient } from "@/components/api/dataClient";
import { supabase } from "../../../../lib/supabase-client.js";
import { useVirtualKeyboard } from "@/components/utils/KeyboardAwareLayout";
import { I18nProvider } from "@/components/utils/i18n";
import { TenantProvider } from "@/components/utils/tenantContext";
import { PanelProvider } from "@/components/utils/panelContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { optimizedQueryClient, prefetchCommonData } from "@/components/utils/dataCache";
import { useRef } from "react";
// 🔐 SaaS Trial Management
import { useTenantTrialStatus, canAccessCore } from "@/components/utils/useTenantTrialStatus";
import TrialExpiredScreen from "@/components/auth/TrialExpiredScreen";
import PaymentActivationScreen from "@/components/auth/PaymentActivationScreen";

const queryClient = optimizedQueryClient;
// import PuertoRicoTopNav from "@/components/layout/PuertoRicoTopNav"; // Removed as per request
import ModernTopNav from "@/components/layout/ModernTopNav";
import FloatingNav from "@/components/layout/FloatingNav";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { LowStockMonitor } from "@/components/notifications/LowStockMonitor";
import { useRealtimeNotifications } from "@/components/notifications/RealtimeNotifications";
import { notificationEngine } from "@/components/notifications/AdvancedNotificationsEngine";
import PWAMetaTags from "@/components/utils/PWAMetaTags";
import GlobalPriceWidget from "@/components/layout/GlobalPriceWidget";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import ARIAChat from "@/components/aria/ARIAChat";
import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function Layout({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [showPaymentScreen, setShowPaymentScreen] = useState(false);
  const { keyboardOpen } = useVirtualKeyboard();
  const mainRef = useRef(null);
  const { requestPermission, permission } = usePushNotifications();
  const [showPushBanner, setShowPushBanner] = useState(false);
  
  // 🔐 Validar estado del trial
  const { isTrialExpired, tenant: trialTenant, loading: trialLoading } = useTenantTrialStatus(tenant?.id);
  
  // 🔔 Notificaciones en tiempo real (solo para admins/managers)
  const shouldEnableNotifications = user && (user.role === 'admin' || user.role === 'manager');
  useRealtimeNotifications({ enabled: shouldEnableNotifications });

  // 💓 Heartbeat de presencia — actualiza last_seen en tenant cada 2 min
  useHeartbeat();



  // ✅ Detectar si estamos en el Dashboard
  const isDashboard = useMemo(() => 
    location.pathname === "/Dashboard",
    [location.pathname]
  );

  // ✅ Detectar si estamos en PinAccess
  const isPinAccess = useMemo(() => 
    location.pathname === "/PinAccess",
    [location.pathname]
  );

  // ✅ Detectar si estamos en Setup/Trial
  const isSetupPage = useMemo(() =>
    location.pathname === "/Setup" ||
    location.pathname === "/InitialSetup" ||
    location.pathname === "/VerifySetup" ||
    location.pathname === "/Activate" ||
    location.pathname === "/TenantActivate",
    [location.pathname]
  );

  // ✅ Detectar si estamos en Welcome (página pública sin auth)
  const isWelcome = useMemo(() => 
    location.pathname === "/Welcome",
    [location.pathname]
  );

  // ✅ Detectar si debemos ocultar el header (todas las páginas excepto Dashboard, PinAccess, Welcome)
  const hideHeader = useMemo(() => 
    !isDashboard && !isPinAccess && !isSetupPage && !isWelcome,
    [isDashboard, isPinAccess, isSetupPage, isWelcome]
  );

  // 🔐 Detectar si mostrar pantalla de trial expirado
  const shouldShowTrialExpired = useMemo(() => 
    !trialLoading && !isPinAccess && !isSetupPage && isTrialExpired && !showPaymentScreen,
    [trialLoading, isPinAccess, isSetupPage, isTrialExpired, showPaymentScreen]
  );

  // ✅ CARGAR USUARIO DESDE SESIÓN DE PIN (SIN GOOGLE)
  useEffect(() => {
    if (isPinAccess || isWelcome || isSetupPage) {
      setUser(null);
      return;
    }

    const sessionRaw =
      localStorage.getItem("employee_session") ||
      sessionStorage.getItem("911-session");

    if (!sessionRaw) {
      setUser(null);
      window.location.href = "/Welcome";
      return;
    }

    try {
      const session = JSON.parse(sessionRaw);
      if (!session?.id) {
        throw new Error("Sesión inválida");
      }

      const fullUser = {
        id: session.id,
        role: session.role || session.userRole || "user",
        userRole: session.userRole || session.role || "user",
        position: session.position || session.role || session.userRole || "user",
        full_name: session.full_name || session.userName || "",
        email: session.email || session.userEmail || "",
        permissions: session.permissions || {},
        permissions_list: session.permissions_list || [],
      };

      setUser(fullUser);

      prefetchCommonData(dataClient).catch(err =>
        console.log("Prefetch error (non-critical):", err)
      );

      if (fullUser.role === "admin" || fullUser.role === "manager") {
        LowStockMonitor.checkLowStockProducts();
        notificationEngine.start();
      }
    } catch (err) {
      console.log("Layout: Error de sesión PIN:", err);
      setUser(null);
      localStorage.removeItem("employee_session");
      sessionStorage.removeItem("911-session");
      window.location.href = "/Welcome";
    }
  }, [isPinAccess, isWelcome, isSetupPage]);



  // 🔐 Vigilar estado del tenant — expulsar si es suspendido mientras está adentro
  useEffect(() => {
    if (!user || isPinAccess || isWelcome || isSetupPage) return;
    const tenantId = localStorage.getItem("smartfix_tenant_id");
    if (!tenantId) return;

    let alive = true;

    const checkTenantStatus = async () => {
      try {
        // Usar supabase directo — dataClient.entities.Tenant no existe en el adaptador
        const { data: t } = await supabase
          .from("tenant")
          .select("status")
          .eq("id", tenantId)
          .single();
        if (!alive) return;
        if (t && (t.status === "suspended" || t.status === "cancelled")) {
          // Limpiar sesión y sacar al usuario
          localStorage.removeItem("employee_session");
          localStorage.removeItem("smartfix_saved_creds");
          localStorage.removeItem("smartfix_tenant_id");
          sessionStorage.removeItem("911-session");
          // Mostrar mensaje antes de redirigir
          if (typeof window !== "undefined") {
            sessionStorage.setItem("smartfix_kicked_reason",
              t.status === "cancelled" ? "cancelled" : "suspended"
            );
            window.location.href = "/PinAccess";
          }
        }
      } catch {
        // Error de red — no expulsar, solo ignorar
      }
    };

    checkTenantStatus(); // Verificación inmediata al cargar
    const interval = setInterval(checkTenantStatus, 2 * 60 * 1000); // Cada 2 minutos
    return () => { alive = false; clearInterval(interval); };
  }, [user, isPinAccess, isWelcome, isSetupPage]);

  // 🔔 Push notification permission prompt — once per session
  useEffect(() => {
    if (isPinAccess || isWelcome || isSetupPage || !user) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    if (sessionStorage.getItem("push_banner_shown")) return;
    const t = setTimeout(() => {
      setShowPushBanner(true);
      sessionStorage.setItem("push_banner_shown", "1");
    }, 5000);
    return () => clearTimeout(t);
  }, [user, isPinAccess, isWelcome, isSetupPage]);

  // ✅ Load theme on mount
  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      try {
        const configs = await dataClient.entities.AppSettings.filter({ slug: "app-theme" });
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

  return (
    <QueryClientProvider client={queryClient}>
    <I18nProvider>
      <TenantProvider>
        <PanelProvider>
        <PWAMetaTags />
        <div
        className={`flex h-screen flex-col relative overflow-hidden ${theme === "light" ? "text-gray-900" : "text-slate-100"}`}
        style={{
          backgroundColor: '#000000',
          background: isPinAccess
            ? '#000'
            : theme === "light"
              ? 'linear-gradient(160deg, #f0f4f8 0%, #e8edf2 100%)'
              : 'linear-gradient(160deg, #0a0e1a 0%, #050810 60%, #000000 100%)',
        }}
      >
      {/* Overlay decorativo — SOLO SI NO ES PINACCESS */}
      {!isPinAccess && theme !== "light" && (
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-transparent via-black/60 to-black/90" />
      )}
      {!isPinAccess && theme === "light" && (
        <div className="fixed inset-0 -z-10 bg-[#F8F9FA]/80 backdrop-blur-[4px]" />
      )}

      <Toaster
        position="top-right"
        offset="calc(env(safe-area-inset-top, 0px) + 10px)"
        mobileOffset="calc(env(safe-area-inset-top, 0px) + 10px)"
        toastOptions={{
          className: theme === "light"
            ? 'bg-white border-gray-200 text-gray-900 shadow-lg'
            : 'bg-black/90 backdrop-blur-xl border border-white/10 text-white',
          style: theme === "light"
            ? {
                background: 'white',
                border: '1px solid #E5E7EB',
                color: '#111827',
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
              }
            : {
                background: 'rgba(0, 0, 0, 0.9)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'white',
              },
        }}
        richColors
      />

      {/* 🔔 Push Notification Permission Banner */}
      {showPushBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9998] w-[calc(100vw-2rem)] max-w-sm px-4 py-3 rounded-2xl bg-violet-950/95 backdrop-blur border border-violet-500/30 shadow-2xl flex items-center gap-3">
          <span className="text-xl shrink-0">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-none mb-0.5">Activar notificaciones</p>
            <p className="text-[11px] text-white/45 leading-tight">Recibe alertas cuando cambie el estado de una orden</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => setShowPushBanner(false)} className="text-[11px] text-white/30 hover:text-white/60 px-2 py-1 transition-colors">Ahora no</button>
            <button onClick={async () => { await requestPermission(); setShowPushBanner(false); }}
              className="text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-xl transition-colors">
              Activar
            </button>
          </div>
        </div>
      )}

      {/* PWA Install Prompt - REMOVED */}
      
      {/* Modern Top Nav (Desktop only) */}
      {!isPinAccess && !isWelcome && (
        <div className="hidden md:block">
          <ModernTopNav />
        </div>
      )}

      {/* 🔐 TRIAL EXPIRED SCREEN - BLOQUEA TODO */}
      {shouldShowTrialExpired && (
        <TrialExpiredScreen
          tenantName={trialTenant?.name}
          onActivatePlan={() => setShowPaymentScreen(true)}
          onContactSupport={() => {
            window.location.href = `mailto:support@smartfixos.com?subject=Activación de plan - ${trialTenant?.name}`;
          }}
        />
      )}

      {/* 💳 PAYMENT ACTIVATION SCREEN */}
      {showPaymentScreen && (
        <PaymentActivationScreen
          tenantId={tenant?.id}
          tenantName={tenant?.name}
          onPaymentSuccess={() => {
            setShowPaymentScreen(false);
            // Recargar tenant para validar nueva suscripción
            window.location.reload();
          }}
          onPaymentError={(error) => {
            console.error("Payment error:", error);
          }}
          onCancel={() => setShowPaymentScreen(false)}
        />
      )}

      {/* === Contenido === */}
      <main
        ref={mainRef}
        className={isDashboard
          ? 'flex-1 overflow-hidden overflow-x-hidden flex flex-col relative'
          : 'flex-1 overflow-y-auto overflow-x-hidden px-2 sm:px-4 md:px-5 pt-[calc(env(safe-area-inset-top,0px)+8px)] md:pt-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] md:pb-4 relative'
        }
        data-pointer-overlay="off"
        style={{ WebkitOverflowScrolling: isDashboard ? 'auto' : 'touch', scrollBehavior: 'smooth' }}
      >
        <div data-pointer-target="on" className={isDashboard ? 'flex flex-col flex-1 min-h-0' : ''}>
          <div className={isDashboard ? "flex flex-col flex-1 min-h-0" : "h-full"}>
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {!isPinAccess && !isWelcome && !shouldShowTrialExpired && !showPaymentScreen && <MobileBottomNav />}

      {/* Widget global de cotizacion — desactivado, integrado en ARIA tab 🧮 */}

      {/* ✨ ARIA — Asistente IA global (visible en todas las páginas autenticadas) */}
      {!shouldShowTrialExpired && !showPaymentScreen && (
        <ARIAChat />
      )}

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
        /* Hide scrollbars while keeping scroll */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* Mobile: prevent text selection on interactive elements */
        @media (max-width: 767px) {
          button, a, [role="button"] { -webkit-user-select: none; user-select: none; }
          /* Prevent overscroll bounce on iOS */
          html { overscroll-behavior: none; }
          /* Better font rendering */
          body { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
          /* Prevent zoom on input focus (iOS) */
          input, select, textarea { font-size: 16px !important; }
          /* Smoother touch scrolling */
          .overflow-y-auto, .overflow-auto { -webkit-overflow-scrolling: touch; scroll-behavior: smooth; }
        }

        /* Active button glow animation */
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 8px 24px rgba(0, 168, 232, 0.4); }
          50% { box-shadow: 0 12px 32px rgba(16, 185, 129, 0.6); }
        }
        header a.scale-110 { animation: pulseGlow 2s ease-in-out infinite; }

        /* Mobile-first utilities */
        @media (max-width: 430px) {
          .mobile-card { border-radius: 20px !important; }
          .mobile-text-sm { font-size: 13px !important; }
        }
      `}</style>
      </div>
      </PanelProvider>
      </TenantProvider>
      </I18nProvider>
      </QueryClientProvider>
      );
      }
