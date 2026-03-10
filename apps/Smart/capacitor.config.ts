import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartfixos.pr911',
  appName: 'SmartFixOS',
  webDir: 'dist',
  server: {
    iosScheme: 'https',
    androidScheme: 'https',
    allowNavigation: ['supa-6504.ownmy.app', 'api-8686.ownmy.app']
  }
};

export default config;
