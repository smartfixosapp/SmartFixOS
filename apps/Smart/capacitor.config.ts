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
      'smartfixos-api.onrender.com',
      'idntuvtabecwubzswpwi.supabase.co',
      '*.supabase.co',
    ],
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
