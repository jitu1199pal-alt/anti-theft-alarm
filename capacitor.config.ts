import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.battery.alarm.pro',
  appName: 'Battery Alarm Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
