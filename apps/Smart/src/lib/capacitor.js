import { Capacitor } from '@capacitor/core';

/**
 * Returns true if running inside a native iOS or Android app
 */
export const isNative = () => Capacitor.isNativePlatform();
export const isIOS = () => Capacitor.getPlatform() === 'ios';
export const isAndroid = () => Capacitor.getPlatform() === 'android';

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
    // ── App (back button on Android + OAuth deep link handler) ───
    const { App } = await import('@capacitor/app');

    // Handle Android back button
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Handle OAuth deep link callback (com.smartfixos.pr911://...)
    // Supabase redirects here after Google/Apple login — PKCE sends ?code=, implicit sends #access_token=
    App.addListener('appUrlOpen', async ({ url }) => {
      if (!url) return;
      try {
        // Close the in-app browser (SFSafariViewController) if it was open
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.close();
        } catch (_) { /* Browser may not be open, ignore */ }

        const urlObj = new URL(url);
        // Preserve ALL query params (Supabase PKCE sends ?code=, implicit sends #access_token=)
        // Losing the "code" param breaks the PKCE token exchange → session never established
        const search = urlObj.search || '';   // e.g. "?gintent=login&code=XXXXX"
        const hash   = urlObj.hash   || '';   // e.g. "#access_token=..." (implicit flow)
        console.log('[Capacitor] appUrlOpen → /PinAccess' + search + hash);
        window.location.href = `/PinAccess${search}${hash}`;
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
