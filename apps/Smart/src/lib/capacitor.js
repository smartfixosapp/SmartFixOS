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
    // Supabase redirects here after Google/Apple login with tokens in URL hash
    App.addListener('appUrlOpen', ({ url }) => {
      if (!url) return;
      try {
        const urlObj = new URL(url);
        const gintent = urlObj.searchParams.get('gintent') || 'login';
        // Preserve the hash — Supabase SDK reads access_token/refresh_token from it
        const hash = urlObj.hash || '';
        window.location.href = `/PinAccess?gintent=${gintent}${hash}`;
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
