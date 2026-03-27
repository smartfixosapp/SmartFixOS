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

/** Mínimo grace en background para evitar kicks en cambios rápidos de app */
const MIN_BACKGROUND_GRACE_MS = 10 * 1000; // 10 segundos mínimo

/** Clave en localStorage para guardar cuándo fue el último "hide" */
const BG_TS_KEY = "_sfos_bg_ts";

/** Clave base para preferencias locales de timeout por usuario+dispositivo */
const LOCAL_TIMEOUT_KEY = (userId) => `_sfos_local_timeout_${userId}`;

// ─── Preferencias locales de timeout (por dispositivo) ────────────────────
export function readLocalTimeout(userId) {
  if (!userId) return undefined;
  try {
    const raw = localStorage.getItem(LOCAL_TIMEOUT_KEY(userId));
    if (raw === null) return undefined;
    if (raw === "null") return null; // "Nunca"
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  } catch { return undefined; }
}

export function saveLocalTimeout(userId, ms) {
  if (!userId) return;
  try {
    localStorage.setItem(LOCAL_TIMEOUT_KEY(userId), ms === null ? "null" : String(ms));
  } catch {}
}

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

  // sessionStorage vacío + localStorage con datos:
  //   - BG_TS_KEY = "0"  → beforeunload marcó cierre explícito → re-login obligatorio
  //   - cualquier otro caso → iOS/Android mató el proceso en background;
  //     el AuthGate ya verificó el tiempo transcurrido antes de llamar aquí,
  //     así que restauramos la sesión desde localStorage (no forzar Google OAuth)
  if (!ssRaw && lsRaw) {
    const bgTs = localStorage.getItem(BG_TS_KEY);
    if (bgTs === "0") {
      // Cierre explícito de pestaña en escritorio → re-login
      localStorage.removeItem("employee_session");
      localStorage.removeItem(BG_TS_KEY);
      return null;
    }
    // Proceso matado por el SO → restaurar sessionStorage para esta sesión
    try { sessionStorage.setItem("911-session", lsRaw); } catch {}
  }

  const raw = ssRaw || lsRaw;
  if (!raw) return null;

  try {
    const session = JSON.parse(raw);
    if (!session?.id) return null;
    // Preferencia local del dispositivo tiene prioridad sobre el valor de Supabase
    const localTimeout = readLocalTimeout(session.id);
    const timeoutMs = localTimeout !== undefined
      ? localTimeout
      : (session.session_timeout_ms ?? null);
    return {
      id: session.id,
      email: session.email || session.userEmail || "",
      full_name: session.full_name || session.userName || "",
      role: session.role || session.userRole || "user",
      userRole: session.userRole || session.role || "user",
      position: session.position || session.role || session.userRole || "user",
      permissions: session.permissions || {},
      permissions_list: session.permissions_list || [],
      // Timeout: local del dispositivo primero, luego Supabase, luego null
      session_timeout_ms: timeoutMs,
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
  // ── Protección de orden activa ────────────────────────────────────────
  // Cuando WorkOrderPanel tiene una orden abierta, incrementa este contador.
  // El timer de inactividad no expulsa al usuario mientras orderActiveCount > 0.
  const orderActiveCountRef = React.useRef(0);

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

  // Exponer setter para que WorkOrderPanel registre/libere órdenes activas
  React.useEffect(() => {
    // __sfos_setOrderActive(true)  → orden abierta  (incrementa contador)
    // __sfos_setOrderActive(false) → orden cerrada  (decrementa contador, mín. 0)
    window.__sfos_setOrderActive = (active) => {
      if (active) {
        orderActiveCountRef.current = (orderActiveCountRef.current || 0) + 1;
      } else {
        orderActiveCountRef.current = Math.max(0, (orderActiveCountRef.current || 0) - 1);
      }
    };
    return () => { delete window.__sfos_setOrderActive; };
  }, []);

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
    // No expulsar si hay una orden activa abierta — reiniciar el timer en su lugar.
    if (orderActiveCountRef.current > 0) {
      const ms = inactivityMsRef.current;
      if (ms) {
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(requirePin, ms);
      }
      return;
    }
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
    // IMPORTANTE: no usar ?? aquí — null significa "Nunca" y debe preservarse.
    // undefined = usar default; null = nunca; número = ms específico.
    inactivityMsRef.current = (newMs !== undefined) ? newMs : DEFAULT_INACTIVITY_MS;
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
      // Leer la preferencia local del usuario para respetar "Nunca"
      // Intentamos obtener el userId de localStorage para leer su preferencia local
      let localUserTimeout = undefined;
      try {
        const lsRaw = localStorage.getItem("employee_session");
        const lsSession = lsRaw ? JSON.parse(lsRaw) : null;
        if (lsSession?.id) localUserTimeout = readLocalTimeout(lsSession.id);
      } catch {}
      // Si el usuario configuró "Nunca" en este dispositivo, no pedir PIN
      const shouldNever = localUserTimeout === null || localUserTimeout === 0;
      if (!shouldNever) {
        const graceMs = localUserTimeout != null
          ? Math.max(MIN_BACKGROUND_GRACE_MS, localUserTimeout)
          : DEFAULT_INACTIVITY_MS; // 5 min por defecto si el usuario no configuró timeout
        if (elapsed > graceMs) {
          // El app fue cerrado mientras estaba en background → re-login
          clearAllSessions();
          if (!isPublicPath(currentPath)) {
            window.location.href = "/PinAccess";
            return;
          }
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
          const userMs = inactivityMsRef.current;
          // Si el usuario eligió "Nunca" (null) → nunca pedir PIN por background
          if (userMs === null || userMs === 0) {
            // No hacer nada — respetar la preferencia del usuario
          } else if (orderActiveCountRef.current > 0) {
            // Hay una orden activa abierta → no expulsar por background
          } else {
            // Usar el timeout del usuario como grace period (mínimo 10s)
            const graceMs = Math.max(MIN_BACKGROUND_GRACE_MS, userMs);
            if (elapsed >= graceMs) {
              requirePin();
              return;
            }
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
