import React from "react";

export const AuthContext = React.createContext(null);
export const useAuth = () => React.useContext(AuthContext);

const PUBLIC_PATHS = new Set([
  "/Welcome",
  "/PinAccess",
  "/Setup",
  "/InitialSetup",
  "/VerifySetup",
  "/Activate",
  "/TenantActivate",
  "/returnlogin",
]);

// ─── Timeouts ──────────────────────────────────────────────────────────────
/** Inactividad por defecto → PinAccess (si el usuario no configuró el suyo) */
const DEFAULT_INACTIVITY_MS = 5 * 60 * 1000; // 5 minutos

/** Umbral "Nunca": si el usuario elige 0 o null → no hay timer */
const NEVER_TIMEOUT = null;

/**
 * Tiempo en segundo plano (multitarea / cambio de pestaña) antes de pedir PIN.
 * 30 s → cambios rápidos de app no interrumpen, pero irse a la multitarea sí.
 */
const BACKGROUND_GRACE_MS = 30 * 1000; // 30 segundos

/** Clave en localStorage para guardar cuándo fue el último "hide" */
const BG_TS_KEY = "_sfos_bg_ts";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
  "pointerdown",
];

// ─── Helpers ───────────────────────────────────────────────────────────────
function clearAllSessions() {
  localStorage.removeItem("employee_session");
  sessionStorage.removeItem("911-session");
  localStorage.removeItem(BG_TS_KEY);
}

function isPublicPath(path = window.location.pathname) {
  return PUBLIC_PATHS.has(path);
}

function readPinSession() {
  const ssRaw = sessionStorage.getItem("911-session");
  const lsRaw = localStorage.getItem("employee_session");

  // Si sessionStorage está vacío pero localStorage tiene datos →
  // la pestaña/app fue cerrada y reabierta → forzar re-login
  if (!ssRaw && lsRaw) {
    localStorage.removeItem("employee_session");
    return null;
  }

  const raw = ssRaw || lsRaw;
  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    if (!session?.id) return null;
    return {
      id: session.id,
      email: session.email || session.userEmail || "",
      full_name: session.full_name || session.userName || "",
      role: session.role || session.userRole || "user",
      userRole: session.userRole || session.role || "user",
      position: session.position || session.role || session.userRole || "user",
      permissions: session.permissions || {},
      permissions_list: session.permissions_list || [],
      // Timeout personalizado por usuario (null = usar default del sistema)
      session_timeout_ms: session.session_timeout_ms ?? null,
    };
  } catch {
    return null;
  }
}

// ─── Componente ────────────────────────────────────────────────────────────
export default function AuthGate({ children }) {
  const [user, setUser] = React.useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = React.useState(true);
  const inactivityTimerRef = React.useRef(null);
  // ── Timeout dinámico por usuario ─────────────────────────────────────
  // Ref para no crear stale closures en los callbacks del timer.
  const inactivityMsRef = React.useRef(DEFAULT_INACTIVITY_MS);

  // ── Refresh session (llamado por PinAccess tras login exitoso) ───────
  const refreshSession = React.useCallback(() => {
    const sessionUser = readPinSession();
    if (sessionUser) {
      inactivityMsRef.current = sessionUser.session_timeout_ms ?? DEFAULT_INACTIVITY_MS;
      setUser(sessionUser);
    }
  }, []);

  // Exponer en window para que PinAccess (ruta pública, sin AuthContext) lo llame
  React.useEffect(() => {
    window.__sfos_refreshAuth = refreshSession;
    return () => { delete window.__sfos_refreshAuth; };
  }, [refreshSession]);

  // ── Logout ────────────────────────────────────────────────────────────
  const handleLogout = React.useCallback((reason = "manual") => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    clearAllSessions();
    setUser(null);
    window.location.href = reason === "manual" ? "/Welcome" : "/PinAccess";
  }, []);

  // ── Ir a PinAccess sin destruir la sesión visual ──────────────────────
  // (la sesión se re-valida cuando el usuario entra el PIN exitosamente)
  const requirePin = React.useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    clearAllSessions();
    setUser(null);
    window.location.href = "/PinAccess";
  }, []);

  // ── Timer de inactividad (respeta la preferencia del usuario) ─────────
  const resetInactivityTimer = React.useCallback(() => {
    if (isPublicPath()) return;
    const ms = inactivityMsRef.current;
    // null o 0 → "Nunca" → no armar timer
    if (!ms) return;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(requirePin, ms);
  }, [requirePin]);

  // ── Actualizar timeout en vivo (llamado desde UserSessionSettings) ────
  const updateSessionTimeout = React.useCallback((newMs) => {
    inactivityMsRef.current = newMs ?? DEFAULT_INACTIVITY_MS;
    // Re-armar el timer con el nuevo valor inmediatamente
    if (!isPublicPath() && inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (!isPublicPath()) {
      const ms = inactivityMsRef.current;
      if (ms) inactivityTimerRef.current = setTimeout(requirePin, ms);
    }
  }, [requirePin]);

  // ── Verificar auth en mount ───────────────────────────────────────────
  React.useEffect(() => {
    const currentPath = window.location.pathname;

    // Limpiar cualquier _bg_ts que pudo haber quedado de un cierre previo.
    // IMPORTANTE: si sessionStorage ya tiene una sesión fresca (mismo tab/navegación),
    // ignorar BG_TS_KEY — el usuario acaba de hacer login en este tab.
    const freshSS = sessionStorage.getItem("911-session");
    const bgTs = localStorage.getItem(BG_TS_KEY);
    if (bgTs && !freshSS) {
      const elapsed = Date.now() - parseInt(bgTs, 10);
      if (elapsed > BACKGROUND_GRACE_MS) {
        // El app fue cerrado mientras estaba en background → re-login
        clearAllSessions();
        if (!isPublicPath(currentPath)) {
          window.location.href = "/PinAccess";
          return;
        }
      }
      localStorage.removeItem(BG_TS_KEY);
    } else if (bgTs && freshSS) {
      // Sesión fresca presente — limpiar el flag obsoleto sin borrar la sesión
      localStorage.removeItem(BG_TS_KEY);
    }

    const sessionUser = readPinSession();

    if (sessionUser) {
      // Cargar el timeout personal del usuario en el ref antes de activar el timer
      inactivityMsRef.current = sessionUser.session_timeout_ms ?? DEFAULT_INACTIVITY_MS;
      setUser(sessionUser);
      setIsCheckingAuth(false);
      return;
    }

    setUser(null);
    setIsCheckingAuth(false);

    if (!isPublicPath(currentPath)) {
      window.location.href = "/PinAccess";
    }
  }, []);

  // ── Eventos de actividad → resetear timer ────────────────────────────
  React.useEffect(() => {
    if (!user || isPublicPath()) return;

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, resetInactivityTimer, { passive: true })
    );
    resetInactivityTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, resetInactivityTimer)
      );
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [user, resetInactivityTimer]);

  // ── visibilitychange: segunda plano ↔ primer plano ───────────────────
  // Funciona para:
  //   • Cambio de pestaña en navegador de escritorio
  //   • Bloqueo de pantalla (web / PWA)
  //   • Ir a multitarea en móvil (PWA)
  React.useEffect(() => {
    if (!user) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App va al fondo → guardar timestamp
        if (!isPublicPath()) {
          localStorage.setItem(BG_TS_KEY, Date.now().toString());
        }
      } else {
        // App vuelve al frente → verificar cuánto tiempo estuvo en fondo
        const bgTs = localStorage.getItem(BG_TS_KEY);
        localStorage.removeItem(BG_TS_KEY);

        if (bgTs) {
          const elapsed = Date.now() - parseInt(bgTs, 10);
          if (elapsed >= BACKGROUND_GRACE_MS) {
            // Estuvo ≥ 30 s en segundo plano → pedir PIN
            requirePin();
            return;
          }
        }

        // Verificar que la sesión siga válida (por si el timer la limpió)
        const ssRaw = sessionStorage.getItem("911-session");
        const lsRaw = localStorage.getItem("employee_session");
        if (!ssRaw && !lsRaw) {
          window.location.href = "/PinAccess";
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, requirePin]);

  // ── beforeunload: cerrar ventana / pestaña en escritorio ─────────────
  // Limpia localStorage para que al reabrir no exista sesión persistente.
  // sessionStorage ya se limpia automáticamente por el navegador al cerrar.
  React.useEffect(() => {
    if (isPublicPath()) return;

    const handleBeforeUnload = () => {
      localStorage.removeItem("employee_session");
      // Guardar un timestamp de cierre para que, si beforeunload no se
      // disparó en móvil, Auth detecte en el siguiente mount que fue cerrado.
      localStorage.setItem(BG_TS_KEY, "0"); // 0 = cerrado definitivamente
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // ─────────────────────────────────────────────────────────────────────
  if (isCheckingAuth) return null;

  if (user) {
    return (
      <AuthContext.Provider value={{ user, handleLogout, updateSessionTimeout }}>
        {children}
      </AuthContext.Provider>
    );
  }

  if (isPublicPath()) return <>{children}</>;

  return null;
}
