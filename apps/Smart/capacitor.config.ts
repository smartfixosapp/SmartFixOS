import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartfixos.pr911',
  appName: 'SmartFixOS',
  webDir: 'dist',
  server: {
    // url: 'https://smart-fix-os-smart.vercel.app',
    cleartext: false,
    iosScheme: 'https',
    androidScheme: 'https',
    allowNavigation: [
      'smart-fix-os-smart.vercel.app',
      'smartfixos.onrender.com',
      'idntuvtabecwubzswpwi.supabase.co',
      '*.supabase.co',
    ],
  },
  ios: {
    // 'never' → el WebView se extiende edge-to-edge incluyendo bajo el
    // home indicator. El tab bar usa env(safe-area-inset-bottom) para
    // dejar espacio respirable. (Antes: 'automatic' causaba un gap negro
    // nativo bajo el tab bar porque el WebView terminaba arriba del
    // home indicator).
    contentInset: 'never',
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      iosSpinnerStyle: 'small',
      spinnerColor: '#06b6d4',
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#000000',
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
