import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gnutux.gtmarkdawin',
  appName: 'GT-MARKDAWIN',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  android: {
    buildOptions: {
      keystorePath: undefined,
      releaseType: 'APK',
    },
  },
  plugins: {
    Filesystem: {
      iosScheme: 'capacitor',
    },
  },
};

export default config;
