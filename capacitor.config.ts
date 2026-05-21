import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chargeguard.pro.alarm',
  appName: 'Charging Alarm Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    AdMob: {
      initializeForTesting: true
    }
  }
};

export default config;
