import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chargeguard.pro.alarm',
  appName: 'ChargeGuard Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    AdMob: {
      initializeForTesting: false
    }
  }
};

export default config;
