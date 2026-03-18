import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartfixos.pr911',
  appName: 'SmartFixOS',
  webDir: 'dist',
  server: {
    iosScheme: 'https',
    androidScheme: 'https',
    allowNavigation: [
      // Production API (Deno / Render)
      'smartfixos-api.onrender.com',
      // Supabase Cloud (DB + Auth + Storage)
      'idntuvtabecwubzswpwi.supabase.co',
      // Frontend (Vercel)
      'smart-fix-os.vercel.app',
      // Legacy (keep for backward compat)
      'supa-6504.ownmy.app',
      'api-8686.ownmy.app',
    ]
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#000000',
      showSpinner: false,
    },
  },
};

export default config;
