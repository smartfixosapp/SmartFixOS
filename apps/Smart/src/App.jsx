import './App.css'
import React from "react"
import Pages from "@/pages/index.jsx"
import { Toaster } from "@/components/ui/toaster"
import { QueryClient, QueryClientProvider, onlineManager } from "@tanstack/react-query"
import { useEffect, useState, useCallback, useRef } from "react"
import { isNative } from "@/lib/capacitor"
import { Wifi, WifiOff } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import SplashLoader from "@/components/SplashLoader"
import { SplashScreen } from '@capacitor/splash-screen'

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[AppErrorBoundary]", error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ position: "fixed", inset: 0, background: "#0a0a0a", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "monospace", zIndex: 99999 }}>
          <div style={{ maxWidth: 480, width: "100%", background: "#1a1a1a", borderRadius: 12, padding: 24, border: "1px solid #333" }}>
            <p style={{ color: "#f87171", fontWeight: "bold", marginBottom: 12, fontSize: 16 }}>⚠️ Error al cargar SmartFixOS</p>
            <pre style={{ fontSize: 11, color: "#fca5a5", whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 200, overflow: "auto" }}>{this.state.error?.toString()}</pre>
            <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "8px 16px", background: "#06b6d4", color: "#000", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold", fontSize: 13 }}>
              Recargar app
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── React Query — configuración optimizada para mobile ─────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // En mobile/native: no refetch al enfocar ventana (no tiene sentido para apps nativas)
      // En web: sí refetch al volver al tab
      refetchOnWindowFocus: !isNative(),
      refetchOnReconnect: true,      // Recarga automática al recuperar red
      retry: 2,                      // 2 reintentos en mobile (conexión intermitente)
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 60 * 1000,          // 1 min — balance entre frescura y performance
      gcTime:    5 * 60 * 1000,      // 5 min en cache (era default 5m, explícito)
      networkMode: 'offlineFirst',   // No lanzar error inmediato si offline
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
})

// ── Sync al volver al frente (Capacitor visibilitychange) ──────────────────
function AppSyncListener() {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") {
        // Solo invalida queries críticos — no todo de golpe
        queryClient.invalidateQueries({ predicate: (q) => {
          const key = q.queryKey?.[0];
          return key === 'orders' || key === 'notifications' || key === 'dashboard';
        }});
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);
  return null;
}

// ── Banner de staging (solo visible cuando VITE_APP_ENV=staging) ─────────
function StagingBanner() {
  if (import.meta.env.VITE_APP_ENV !== 'staging') return null;
  return (
    <div
      style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 99998, pointerEvents: 'none' }}
      className="flex items-center justify-center gap-2 py-1 bg-amber-500/90 backdrop-blur-sm text-black text-[10px] font-black tracking-widest uppercase"
    >
      ⚠ STAGING — ambiente de pruebas, no usar datos reales ⚠
    </div>
  );
}

// ── Banner de estado de red (Offline / Online) ────────────────────────────
function NetworkStatusBanner() {
  const [status, setStatus] = useState(null); // null | 'offline' | 'back-online'
  const timerRef = useRef(null);

  const handleOffline = useCallback(() => {
    clearTimeout(timerRef.current);
    setStatus('offline');
    onlineManager.setOnline(false);
  }, []);

  const handleOnline = useCallback(() => {
    clearTimeout(timerRef.current);
    setStatus('back-online');
    onlineManager.setOnline(true);
    // Esconder el banner de "volviste online" después de 3s
    timerRef.current = setTimeout(() => setStatus(null), 3000);
  }, []);

  useEffect(() => {
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online',  handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online',  handleOnline);
      clearTimeout(timerRef.current);
    };
  }, [handleOffline, handleOnline]);

  return (
    <AnimatePresence>
      {status && (
        <motion.div
          key={status}
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0,   opacity: 1 }}
          exit={{    y: -48, opacity: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 py-2.5 text-xs font-bold ${
            status === 'offline'
              ? 'bg-red-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
          style={{ paddingTop: `calc(0.625rem + env(safe-area-inset-top, 0px))` }}
        >
          {status === 'offline' ? (
            <><WifiOff className="w-3.5 h-3.5" /> Sin conexión — algunos datos pueden estar desactualizados</>
          ) : (
            <><Wifi className="w-3.5 h-3.5" /> Conexión restaurada ✓</>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function App() {
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    // 1. Ocultar el splash nativo de iOS lo antes posible
    // para mostrar nuestra animación personalizada de React
    const hideNativeSplash = async () => {
      try {
        await SplashScreen.hide();
      } catch (err) {
        console.warn("Could not hide native splash:", err);
      }
    };
    
    hideNativeSplash();

    // 2. Saltar animación de carga forzada para máxima velocidad
    setAppLoading(false);
  }, []);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppSyncListener />
        <StagingBanner />
        <NetworkStatusBanner />
        <Pages />
        <Toaster />
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}

export default App
