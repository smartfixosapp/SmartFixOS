import { Capacitor } from '@capacitor/core';

/**
 * Returns true if running inside a native iOS or Android app
 */
export const isNative = () => Capacitor.isNativePlatform();
export const isIOS = () => Capacitor.getPlatform() === 'ios';
export const isAndroid = () => Capacitor.getPlatform() === 'android';

/**
 * triggerHaptic — feedback táctil en acciones clave
 * type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
 */
export async function triggerHaptic(type = 'light') {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
    if (type === 'success')  return Haptics.notification({ type: NotificationType.Success });
    if (type === 'warning')  return Haptics.notification({ type: NotificationType.Warning });
    if (type === 'error')    return Haptics.notification({ type: NotificationType.Error });
    const style = type === 'heavy' ? ImpactStyle.Heavy
                : type === 'medium' ? ImpactStyle.Medium
                : ImpactStyle.Light;
    return Haptics.impact({ style });
  } catch { /* no-op */ }
}

/**
 * Initialize all Capacitor plugins.
 * Called once at app startup in main.jsx.
 */
export async function initCapacitor() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // ── Status Bar ────────────────────────────────────────────
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#000000' });
    await StatusBar.show();
  } catch (e) {
    // Plugin may not be available on all platforms
  }

  try {
    // ── Keyboard ──────────────────────────────────────────────
    const { Keyboard } = await import('@capacitor/keyboard');
    Keyboard.addListener('keyboardWillShow', () => {
      document.body.classList.add('keyboard-open');
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.body.classList.remove('keyboard-open');
    });
  } catch (e) {
    // no-op
  }

  try {
    // ── App (back button on Android + OAuth deep link handler + background lock) ───
    const { App } = await import('@capacitor/app');

    // Handle Android back button
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // ── Bloqueo por multitarea / segundo plano (iOS & Android) ─────────
    // Cuando el usuario manda la app al fondo, guardamos el timestamp.
    // Al volver, verificamos cuánto tiempo estuvo en fondo y el timeout
    // configurado por el usuario (24h por defecto en nativo → "Immortal Session").
    const BG_TS_KEY = "_sfos_bg_ts";
    const DEFAULT_NATIVE_GRACE_MS = 24 * 60 * 60 * 1000; // 24h por defecto en nativo

    /** Lee el timeout preferido del usuario desde localStorage */
    function getEffectiveGraceMs() {
      try {
        const lsRaw = localStorage.getItem("employee_session");
        const lsSession = lsRaw ? JSON.parse(lsRaw) : null;
        if (!lsSession?.id) return DEFAULT_NATIVE_GRACE_MS;

        // Leer preferencia local del dispositivo (clave igual que Auth.jsx)
        const localKey = `_sfos_local_timeout_${lsSession.id}`;
        const localRaw = localStorage.getItem(localKey);

        if (localRaw === "null" || localRaw === "0") return null; // "Nunca" → no expulsar
        if (localRaw !== null) {
          const n = Number(localRaw);
          if (Number.isFinite(n) && n > 0) return Math.max(DEFAULT_NATIVE_GRACE_MS, n);
        }

        // Sin preferencia local → usar el timeout guardado en la sesión
        const sessionMs = lsSession.session_timeout_ms;
        if (sessionMs === null || sessionMs === 0) return null; // "Nunca"
        if (typeof sessionMs === 'number' && sessionMs > 0) {
          return Math.max(DEFAULT_NATIVE_GRACE_MS, sessionMs);
        }
      } catch { /* no-op */ }
      return DEFAULT_NATIVE_GRACE_MS;
    }

    App.addListener('appStateChange', ({ isActive }) => {
      const PUBLIC = new Set(["/Welcome","/PinAccess","/Setup","/InitialSetup","/VerifySetup","/Activate","/TenantActivate","/returnlogin"]);
      const currentPath = window.location.pathname;

      if (!isActive) {
        // App va al fondo → guardar timestamp (solo si hay sesión activa)
        if (!PUBLIC.has(currentPath)) {
          localStorage.setItem(BG_TS_KEY, Date.now().toString());
        }
      } else {
        // App vuelve al frente
        const bgTs = localStorage.getItem(BG_TS_KEY);
        localStorage.removeItem(BG_TS_KEY);

        if (bgTs) {
          const elapsed = Date.now() - parseInt(bgTs, 10);
          // bgTs === "0" significa cierre definitivo (beforeunload en web)
          const wasDefinitelyClosed = bgTs === "0";
          // Obtener el grace period real del usuario (null = "Nunca")
          const graceMs = getEffectiveGraceMs();

          if (wasDefinitelyClosed || (graceMs !== null && elapsed >= graceMs)) {
            // Solo limpiar si no hay una orden activa abierta
            const orderActive = typeof window.__sfos_setOrderActive !== 'undefined'
              && (window._sfos_order_active_count || 0) > 0;
            if (!orderActive) {
              // No borrar employee_session en nativo — Auth.jsx maneja la sesión
              sessionStorage.removeItem("911-session");
              if (!PUBLIC.has(currentPath)) {
                window.location.href = "/PinAccess";
              }
            }
          }
        }
      }
    });

    // Handle OAuth deep link callback (com.smartfixos.pr911://...)
    // Supabase redirects here after Google/Apple login — PKCE sends ?code=, implicit sends #access_token=
    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url) return;
      try {
        // Close the in-app browser (SFSafariViewController) IMMEDIATELY
        // This must be the very first thing we do to return control to the app
        try {
          const { Browser } = await import('@capacitor/browser');
          Browser.close().catch(() => {}); // fire and forget to avoid blocking
        } catch (_) { /* no-op */ }

        const urlObj = new URL(url);
        const code    = urlObj.searchParams.get('code')    || null;
        const gintent = urlObj.searchParams.get('gintent') || 'login';
        const hash    = urlObj.hash   || '';
        const search  = urlObj.search || '';

        console.log('[Capacitor] appUrlOpen — code:', !!code, 'gintent:', gintent);

        // Dispatch a custom event so PinAccess handles the token exchange
        // without a full page reload (avoids race conditions with the browser close animation)
        window.dispatchEvent(new CustomEvent('capacitor:deeplink', {
          detail: { code, gintent, hash, search, url }
        }));
      } catch (e) {
        console.warn('[Capacitor] appUrlOpen error:', e);
      }
    });
  } catch (e) {
    // no-op
  }

  try {
    // ── Splash Screen ─────────────────────────────────────────
    const { SplashScreen } = await import('@capacitor/splash-screen');
    setTimeout(() => SplashScreen.hide(), 500);
  } catch (e) {
    // no-op
  }
}
