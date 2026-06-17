export enum AlarmSound {
  SIREN = 'Emergency Siren',
  RADAR = 'Radar Alert',
  CYBER = 'Cyber Pulse',
  PULSE = 'Rapid Beep',
  ENERGY = 'High Energy',
  DEFAULT = 'Classic Alarm'
}

export enum Screen {
  SPLASH = 'splash',
  HOME = 'home',
  ALARM_SETTINGS = 'alarm_settings',
  SECURITY = 'security',
  HISTORY = 'history',
  HEALTH = 'health',
  THEMES = 'themes',
  LOCK = 'lock',
  ADS = 'ads',
  FEATURES = 'features',
  SPEED_TEST = 'speed_test',
  PREDICTOR = 'predictor',
  CLEANER = 'cleaner',
  VOICE_ALERTS = 'voice_alerts',
  DIAGNOSTICS = 'diagnostics',
  NOTIFICATION_PREVIEW = 'notification_preview'
}

export type Theme = 'dark' | 'light' | 'neon';

export interface BatteryState {
  level: number;
  charging: boolean;
  chargingTime: number; // seconds
  dischargingTime: number; // seconds
  temperature: number; // degrees C
}

export interface AlarmConfig {
  targetPercentage: number;
  lowBatteryPercentage: number;
  enabled: boolean;
  sound: string;
  customSoundUrl?: string;
  customSoundName?: string;
  volume: number;
  repeat: boolean;
  voiceAlert: boolean;
  alarmColor?: string;
  tempWarningLevel: number;
  batteryCapacity?: number;
  vibrate: boolean;
  connectVoiceSpeakEnabled?: boolean;
  fullVoiceSpeakEnabled?: boolean;
  connectVoiceSpeakText?: string;
  fullVoiceSpeakText?: string;
  stickyNotificationEnabled?: boolean;
  stickyNotificationTitle?: string;
  stickyNotificationStyle?: 'compact' | 'detailed';
  hasCustomizedLowBatteryPercentage?: boolean;
  hasCustomizedTargetPercentage?: boolean;
}

export interface SecurityConfig {
  type: 'pin' | 'pattern' | 'none';
  code: string;
  isLocked: boolean;
  theftAlarm: boolean;
}

export interface ChargingLog {
  id: string;
  date: string;
  startLevel: number;
  endLevel: number;
  duration: number;
  type: 'full' | 'partial';
}
