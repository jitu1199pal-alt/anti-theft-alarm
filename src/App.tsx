import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Battery, 
  Shield, 
  Bell, 
  Settings, 
  History, 
  Activity, 
  Lock,
  Thermometer,
  Zap,
  Volume2,
  Repeat,
  Mic,
  Moon,
  Sun,
  Palette,
  ChevronRight,
  ShieldCheck,
  Power,
  Music,
  Upload,
  Info,
  Users,
  CreditCard,
  Gift,
  Share2,
  Check
} from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';

interface AlarmServicePluginType {
  startService(options: {
    theftAlarm: boolean;
    targetPercentage: number;
    lowBatteryPercentage: number;
    vibrate: boolean;
  }): Promise<{ success: boolean }>;
  stopService(): Promise<{ success: boolean }>;
  getServiceState(): Promise<{ running: boolean; isAlarming: boolean; alarmReason: string }>;
  requestBatteryOptimization(): Promise<{ success: boolean }>;
  openAppInfo(): Promise<{ success: boolean }>;
  openOverlaySettings(): Promise<{ success: boolean }>;
  openAutoStartSettings(): Promise<{ success: boolean }>;
  openOtherPermissionsSettings(): Promise<{ success: boolean }>;
  openNotificationSettings(): Promise<{ success: boolean }>;
  getBatteryCapacity(): Promise<{ capacity: number }>;
  getPermissionsState(): Promise<{ batteryIgnored: boolean; overlayAllowed: boolean; notificationsEnabled?: boolean }>;
  minimizeApp(): Promise<{ success: boolean }>;
  bringAppToForeground(): Promise<{ success: boolean }>;
  savePersistedValue(options: { key: string; value: string }): Promise<{ success: boolean }>;
  getPersistedValue(options: { key: string }): Promise<{ value: string | null }>;
  saveConfig(options: {
    theftAlarm: boolean;
    targetPercentage: number;
    lowBatteryPercentage: number;
    vibrate: boolean;
  }): Promise<{ success: boolean }>;
}

const AlarmService = registerPlugin<AlarmServicePluginType>('AlarmService');
import { Screen, Theme, BatteryState, AlarmConfig, SecurityConfig, AlarmSound } from './types';
import { useBattery } from './lib/battery';
import { cn, formatTime } from './lib/utils';
import { BatteryIndicator, QuickPreset } from './components/BatteryIndicator';
import { translations } from './translations';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { GoogleAdMob } from './components/GoogleAdMob';

// =====================================================================
//                   ADMOB AD UNIT CONFIGURATION (REAL CONFIG)
// =====================================================================
// CREATEGUARD: Replace these with your actual live AdMob Ad Unit IDs from AdMob Console!
export const AD_CONFIG = {
  // 1. Android Ad Unit IDs (Production Mode Activated)
  android: {
    banner: 'ca-app-pub-2585981026340393/9149642997',       // Real production Android Banner ID
    interstitial: 'ca-app-pub-2585981026340393/3532685935', // Real production Android Interstitial ID
  },
  // 2. iOS Ad Unit IDs (For completeness/future deployment)
  ios: {
    banner: 'ca-app-pub-3940256099942544/2934735716',       // REPLACE WITH YOUR REAL iOS BANNER ID
    interstitial: 'ca-app-pub-3940256099942544/4411468910', // REPLACE WITH YOUR REAL iOS INTERSTITIAL ID
  }
};

// Helper function to resolve dynamic Ad Unit ID based on platform
export function getAdUnitId(type: 'banner' | 'interstitial'): string {
  const isIos = Capacitor.getPlatform() === 'ios';
  return isIos ? AD_CONFIG.ios[type] : AD_CONFIG.android[type];
}

// Helper to eagerly preload and cache native interstitial ad in background
export async function preloadAdMobInterstitial() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { AdMob } = await import('@capacitor-community/admob');
    const finalAdId = getAdUnitId('interstitial');
    const isRealAdId = finalAdId && finalAdId.startsWith('ca-app-pub-');
    const isTestingAd = !isRealAdId || finalAdId.includes('3940256099942544');

    console.log(`AdMob: Preloading Interstitial ad (ID: ${finalAdId}, isTesting: ${isTestingAd}) in background to guarantee instant display...`);
    await AdMob.prepareInterstitial({
      adId: finalAdId,
      isTesting: isTestingAd,
    });
    console.log("AdMob: Interstitial preloaded successfully.");
  } catch (err) {
    console.warn("AdMob: Failed to preload interstitial in background:", err);
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(Screen.SPLASH);
  const [theme, setTheme] = useState<Theme>('dark');
  const lang = 'en';
  const t = translations.en;
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [mainAudioContext, setMainAudioContext] = useState<AudioContext | null>(null);
  const battery = useBattery();
  const [wasCharging, setWasCharging] = useState(battery.charging);
  const [isMonitoring, setIsMonitoring] = useState(() => {
    try {
      const saved = localStorage.getItem('isMonitoring');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  }); 
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [appWasOpenedByUser, setAppWasOpenedByUser] = useState(false);
  const [adDuration, setAdDuration] = useState<number>(5);
  const [adKeepAppOpen, setAdKeepAppOpen] = useState<boolean>(false);
  const [adForceMinimize, setAdForceMinimize] = useState<boolean>(false);
  const [showTempWarning, setShowTempWarning] = useState(false);
  const [targetReachedAlerted, setTargetReachedAlerted] = useState(false);
  const [lowBatteryAlerted, setLowBatteryAlerted] = useState(false);
  const [initialLaunchChecksDone, setInitialLaunchChecksDone] = useState(false);
  const [alarmReason, setAlarmReason] = useState<'theft' | 'full' | 'low' | 'test' | null>(null);
  const latestAlarmReasonRef = useRef<any>(null);
  useEffect(() => {
    latestAlarmReasonRef.current = alarmReason;
  }, [alarmReason]);
  const wakeLockRef = useRef<any>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Persistent stats for charging cycles and real-time charging history
  const [chargingCycles, setChargingCycles] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('chargingCycles');
      return saved ? parseInt(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [chargingLogs, setChargingLogs] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('chargingHistory');
      return saved ? JSON.parse(saved) : [
        { id: '1', date: '20 May, 02:45 PM', startLevel: 45, endLevel: 100, duration: 2700, type: 'full' },
        { id: '2', date: '19 May, 08:10 AM', startLevel: 25, endLevel: 85, duration: 4200, type: 'partial' },
        { id: '3', date: '18 May, 11:20 PM', startLevel: 15, endLevel: 100, duration: 8100, type: 'full' },
        { id: '4', date: '17 May, 04:30 PM', startLevel: 60, endLevel: 90, duration: 1800, type: 'partial' }
      ];
    } catch {
      return [];
    }
  });

  const [activeSession, setActiveSession] = useState<{ id: string; date: string; startLevel: number; startTime: number } | null>(() => {
    try {
      const saved = localStorage.getItem('activeChargingSession');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const lastChargingRef = useRef(battery.charging);

  // Monitor charger connections and automatically record live sessions
  useEffect(() => {
    const isCharging = battery.charging;
    const currentLevelPct = Math.round(battery.level * 100);
    const wasChg = lastChargingRef.current;

    if (isCharging && !wasChg) {
      // Plugged In
      setChargingCycles(prev => {
        const next = prev + 1;
        localStorage.setItem('chargingCycles', String(next));
        return next;
      });

      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
      const dateStr = `${now.toLocaleDateString('en-US', options)}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;

      const sess = {
        id: Date.now().toString(),
        date: dateStr,
        startLevel: currentLevelPct,
        startTime: Date.now()
      };
      setActiveSession(sess);
      localStorage.setItem('activeChargingSession', JSON.stringify(sess));
    }
    else if (!isCharging && wasChg) {
      // Unplugged
      if (activeSession) {
        const durationSec = Math.round((Date.now() - activeSession.startTime) / 1000);
        if (durationSec >= 3) { // Log any session over 3 seconds for direct testing validation
          const newLog = {
            id: activeSession.id,
            date: activeSession.date,
            startLevel: activeSession.startLevel,
            endLevel: currentLevelPct,
            duration: durationSec,
            type: currentLevelPct >= 98 ? 'full' : 'partial'
          };
          setChargingLogs(prev => {
            const next = [newLog, ...prev.filter(l => l.id !== newLog.id)];
            localStorage.setItem('chargingHistory', JSON.stringify(next));
            return next;
          });
        }
        setActiveSession(null);
        localStorage.removeItem('activeChargingSession');
      }
    }

    lastChargingRef.current = isCharging;
  }, [battery.charging, battery.level, activeSession]);

  // Background Lock-Screen Compatibility & Permissions States
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsActivePage, setPermissionsActivePage] = useState(1);
  const [hasAutoStartConfirmed, setHasAutoStartConfirmed] = useState(() => {
    try {
      return localStorage.getItem('hasAutoStartConfirmed') === 'true';
    } catch {
      return false;
    }
  });
  const [hasOtherPermissionsConfirmed, setHasOtherPermissionsConfirmed] = useState(() => {
    try {
      return localStorage.getItem('hasOtherPermissionsConfirmed') === 'true';
    } catch {
      return false;
    }
  });
  const [hasAlarmVerified, setHasAlarmVerified] = useState(() => {
    try {
      return localStorage.getItem('hasAlarmVerified') === 'true';
    } catch {
      return false;
    }
  });
  const [hasNotificationPermission, setHasNotificationPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  });
  const [permissionReminderDismissed, setPermissionReminderDismissed] = useState(() => {
    try {
      const saved = localStorage.getItem('permissionReminderDismissed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  const [nativePermissions, setNativePermissions] = useState<{
    batteryIgnored: boolean;
    overlayAllowed: boolean;
  }>({
    batteryIgnored: true,
    overlayAllowed: true,
  });

  const fetchNativePermissions = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const state = await AlarmService.getPermissionsState();
        setNativePermissions(state);
        if (state.notificationsEnabled !== undefined) {
          setHasNotificationPermission(state.notificationsEnabled);
        }
      } catch (e) {
        console.error("Error fetching permissions state:", e);
      }
    }
  };

  const syncNativeServiceState = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        const state = await AlarmService.getServiceState() as any;
        
        // If local storage explicitly indicates monitoring is off, respect that
        // and do not resurrect it because of asynchronous background service stopping delay
        const savedMonitoringValue = localStorage.getItem('isMonitoring');
        const isLocalMonitoringOff = savedMonitoringValue !== null && JSON.parse(savedMonitoringValue) === false;

        if (state.running) {
          if (isLocalMonitoringOff) {
            console.log("syncNativeServiceState: Local monitoring is off, cleaning native state.");
            await AlarmService.stopService();
            setIsMonitoring(false);
            return;
          }
          setIsMonitoring(true);
          if (state.targetPercentage) {
            setAlarmConfig(prev => ({
              ...prev,
              targetPercentage: state.targetPercentage,
              lowBatteryPercentage: 20, // Force 20% as requested
              vibrate: state.vibrate ?? prev.vibrate
            }));
          }
          if (state.isAlarming && state.alarmReason) {
            setAlarmReason(state.alarmReason as any);
            setScreen(Screen.LOCK);
          }
        } else {
          setIsMonitoring(false);
        }
      } catch (e) {
        console.error("Error syncing native state:", e);
      }
    }
  };

  // Automatically monitor and update permissions & sync native alarm service when user returns to app focus
  useEffect(() => {
    const checkNotificationPermission = () => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const isGranted = Notification.permission === 'granted';
        setHasNotificationPermission(isGranted);
      }
    };

    const restoreNativelyPersistedState = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          const securityData = await AlarmService.getPersistedValue({ key: 'securityConfig' });
          if (securityData && securityData.value) {
            setSecurityConfig(JSON.parse(securityData.value));
            localStorage.setItem('securityConfig', securityData.value);
          }
          const configData = await AlarmService.getPersistedValue({ key: 'alarmConfig' });
          if (configData && configData.value) {
            setAlarmConfig(JSON.parse(configData.value));
            localStorage.setItem('alarmConfig', configData.value);
          }
          const autoStartData = await AlarmService.getPersistedValue({ key: 'hasAutoStartConfirmed' });
          if (autoStartData && autoStartData.value) {
            setHasAutoStartConfirmed(autoStartData.value === 'true');
            localStorage.setItem('hasAutoStartConfirmed', autoStartData.value);
          }
          const otherPermsData = await AlarmService.getPersistedValue({ key: 'hasOtherPermissionsConfirmed' });
          if (otherPermsData && otherPermsData.value) {
            setHasOtherPermissionsConfirmed(otherPermsData.value === 'true');
            localStorage.setItem('hasOtherPermissionsConfirmed', otherPermsData.value);
          }
        } catch (e) {
          console.error("Error restoring natively persisted state on mount:", e);
        }
      }
    };

    restoreNativelyPersistedState().then(async () => {
      checkNotificationPermission();
      fetchNativePermissions();
      await syncNativeServiceState();
      
      if (Capacitor.isNativePlatform()) {
        try {
          const { AdMob } = await import('@capacitor-community/admob');
          await (AdMob as any).initialize({
            requestTrackingAuthorization: true,
            initializeForTesting: false,
          });
          console.log("AdMob SDK initialized on boot with initializeForTesting: false");
          // Eagerly preload interstitial on boot so it displays immediately when needed
          preloadAdMobInterstitial();
        } catch (adError) {
          console.error("AdMob initialization on boot failed:", adError);
        }
        
        try {
          const state = await AlarmService.getServiceState() as any;
          if (!state.isAlarming && !state.alarmReason) {
            setAppWasOpenedByUser(true);
          }
        } catch (e) {
          console.error("Error setting appWasOpenedByUser on boot:", e);
          setAppWasOpenedByUser(true);
        }
      } else {
        setAppWasOpenedByUser(true);
      }
      
      const pending = localStorage.getItem('pendingAdReason');
      if (pending === 'low' || pending === 'full') {
        setAlarmReason(pending as any);
        setScreen(Screen.LOCK);
      }
      
      setIsInitialized(true);
    });

    const handleFocus = () => {
      checkNotificationPermission();
      fetchNativePermissions();
      syncNativeServiceState();
      
      const pending = localStorage.getItem('pendingAdReason');
      if (pending === 'low' || pending === 'full') {
        setAlarmReason(pending as any);
        setScreen(Screen.LOCK);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // Preload AdMob interstitial whenever monitoring is active so it's ready of any alarm trigger
  useEffect(() => {
    if (isMonitoring) {
      preloadAdMobInterstitial();
    }
  }, [isMonitoring]);

  const prevChargingRef = useRef(battery.charging);
  // Automatically arm active alarm set to 98% and start monitoring immediately when charger is plugged in (same as clicking "Set Alarm" manually)
  useEffect(() => {
    const wasPluggedInTransition = battery.charging && !prevChargingRef.current;
    if (wasPluggedInTransition) {
      setAlarmConfig(prev => {
        if (prev.targetPercentage !== 98) {
          return { ...prev, targetPercentage: 98 };
        }
        return prev;
      });
      setIsMonitoring(true);
      setAudioUnlocked(true);
      if (mainAudioContext) {
        mainAudioContext.resume().catch(() => {});
      }
    }
    prevChargingRef.current = battery.charging;
  }, [battery.charging, mainAudioContext]);

  // Basic Auth setup
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else {
        signInAnonymously(auth).catch(() => setLoading(false));
      }
    });

    // Android Event Trackers (Back Button and Resume State)
    const setupNativeListeners = async () => {
      if (Capacitor.isNativePlatform()) {
        CapApp.addListener('backButton', ({ canGoBack }) => {
          if (screen === Screen.HOME || screen === Screen.SPLASH || screen === Screen.LOCK) {
            CapApp.exitApp();
          } else {
            setScreen(Screen.HOME);
          }
        });

        CapApp.addListener('appStateChange', async ({ isActive }) => {
          if (isActive) {
            await syncNativeServiceState();
            try {
              const state = await AlarmService.getServiceState() as any;
              if (!state.isAlarming && !state.alarmReason) {
                setAppWasOpenedByUser(true);
              }
            } catch (e) {
              console.error("Error setting appWasOpenedByUser on state change:", e);
              setAppWasOpenedByUser(true);
            }
            
            const pending = localStorage.getItem('pendingAdReason');
            if (pending === 'low' || pending === 'full') {
              setAlarmReason(pending as any);
              setScreen(Screen.LOCK);
            }
          } else {
            setAppWasOpenedByUser(false);
            
            // Prevent escaping low and full alarms by bringing the app right back
            const pending = localStorage.getItem('pendingAdReason') || latestAlarmReasonRef.current;
            if (pending === 'low' || pending === 'full') {
              if (Capacitor.isNativePlatform()) {
                setTimeout(async () => {
                  try {
                    await AlarmService.bringAppToForeground();
                    console.log("Auto-restored app to foreground: Escape prevented.");
                  } catch (err) {
                    console.error("Error on drag-bounce foreground:", err);
                  }
                }, 1000);
              }
            }
          }
        });
      }
    };
    setupNativeListeners();

    return () => {
      unsubscribe();
      if (Capacitor.isNativePlatform()) {
        CapApp.removeAllListeners();
      }
    };
  }, [screen]);

  // Android Native Persistence
  const isNative = Capacitor.getPlatform() !== 'web';

  // Wake Lock implementation to keep screen on while monitoring
  useEffect(() => {
    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isMonitoring && (screen === Screen.HOME || screen === Screen.LOCK)) {
        try {
          if (wakeLockRef.current) return;
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => {
             if (isMonitoring) wakeLockRef.current = null;
          });
        } catch (err: any) {
          if (err.name !== 'NotAllowedError') {
            console.error(`${err.name}, ${err.message}`);
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isMonitoring) {
        requestWakeLock();
      }
    };

    if (isMonitoring) {
      requestWakeLock();
      document.addEventListener('visibilitychange', handleVisibilityChange);
    } else {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
      }
    };
  }, [isMonitoring, screen]);

  useEffect(() => {
    // Single persistent audio context
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctx && !mainAudioContext) {
      setMainAudioContext(new Ctx());
    }

    // Initialize silent background audio element to prevent browser sleep when screen is locked
    const audio = new window.Audio();
    // 1-second completely silent standard WAV base64
    audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
    audio.loop = true;
    audio.volume = 0.01;
    silentAudioRef.current = audio;

    return () => {
      if (silentAudioRef.current) {
        try {
          silentAudioRef.current.pause();
        } catch (e) {}
      }
    };
  }, []);

  // Background Audio Heartbeat + HTML5 Keepalive audio play/pause + Action Handlers
  useEffect(() => {
    let osc: OscillatorNode | null = null;
    let gain: GainNode | null = null;

    if (isMonitoring && mainAudioContext && audioUnlocked) {
      // 1. Oscillator Heartbeat
      try {
        osc = mainAudioContext.createOscillator();
        gain = mainAudioContext.createGain();
        gain.gain.value = 0.001; // Nearly silent
        osc.connect(gain);
        gain.connect(mainAudioContext.destination);
        osc.start();
      } catch (err) {
        console.error("Failed to start oscillator heartbeat", err);
      }

      // 2. Play HTML5 silent background audio loop and register media session
      if (silentAudioRef.current) {
        silentAudioRef.current.play()
          .then(() => {
            if ('mediaSession' in navigator) {
              const nav = navigator as any;
              nav.mediaSession.metadata = new (window as any).MediaMetadata({
                title: t.appName || "ChargeGuard Pro",
                artist: t.securedMonitoring || "Active Anti-Theft Guard",
                album: "ChargeGuard Security System",
                artwork: [{ src: "/icon.svg", sizes: "512x512", type: "image/svg+xml" }]
              });
              nav.mediaSession.playbackState = "playing";
              
              // Enable audio commands to signal persistent background media
              nav.mediaSession.setActionHandler('play', () => {
                silentAudioRef.current?.play().catch(() => {});
              });
              nav.mediaSession.setActionHandler('pause', () => {
                silentAudioRef.current?.pause();
              });
            }
          })
          .catch(err => {
            console.warn("Autoplay or background audio playback was delayed:", err);
          });
      }
    }

    return () => {
      // Clean up oscillator
      if (osc) {
        try {
          osc.stop();
        } catch (e) {}
      }
      // Pause silent audio loop
      if (silentAudioRef.current) {
        try {
          silentAudioRef.current.pause();
        } catch (e) {}
      }
      if ('mediaSession' in navigator) {
        try {
          (navigator as any).mediaSession.playbackState = "paused";
        } catch (e) {}
      }
    };
  }, [isMonitoring, mainAudioContext, audioUnlocked, t]);

  // Persistent System Notification to keep background process alive and signal user visually in status tray
  useEffect(() => {
    let activeNotification: any = null;
    if (isMonitoring && hasNotificationPermission && 'Notification' in window) {
      try {
        activeNotification = new Notification(t.appName || "ChargeGuard Pro", {
          body: t.securedMonitoring || "🛡️ Active Anti-Theft Guard monitoring active...",
          icon: "/icon.svg",
          tag: "chargeguard-persistent-bg-alarm",
          silent: true,
          badge: "/icon.svg",
          requireInteraction: true // Keeps it persistent
        });
      } catch (err) {
        console.warn("Could not display background keep-alive notification:", err);
      }
    }
    return () => {
      if (activeNotification) {
        try {
          activeNotification.close();
        } catch (e) {}
      }
    };
  }, [isMonitoring, hasNotificationPermission, t]);

  const [alarmConfig, setAlarmConfig] = useState<AlarmConfig>(() => {
    const saved = localStorage.getItem('alarmConfig');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          if (!parsed.batteryCapacity) parsed.batteryCapacity = 5000;
          if (parsed.vibrate === undefined) parsed.vibrate = true;
          parsed.lowBatteryPercentage = 20; // Force low battery alarm to 20% as requested
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse saved alarmConfig:", e);
      }
    }
    return {
      targetPercentage: 98,
      lowBatteryPercentage: 20, // Force 20% as requested
      enabled: true,
      sound: AlarmSound.DEFAULT,
      volume: 80,
      repeat: false,
      voiceAlert: true,
      alarmColor: '#ef4444',
      tempWarningLevel: 40,
      batteryCapacity: 5000,
      vibrate: true,
    };
  });

  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => {
    const saved = localStorage.getItem('securityConfig');
    const config = saved ? JSON.parse(saved) : {
      type: 'pin',
      code: '1234',
      isLocked: false,
      theftAlarm: true,
    };
    // Force true regardless of saved state
    return { ...config, theftAlarm: true };
  });

  // Auto-enable monitoring and lock 98/20 config when permissions are allowed
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      if (nativePermissions.batteryIgnored && nativePermissions.overlayAllowed && hasNotificationPermission) {
        if (!isMonitoring) {
          setIsMonitoring(true);
        }
        setAlarmConfig(prev => {
          if (prev.targetPercentage !== 98 || prev.lowBatteryPercentage !== 20) {
            return { ...prev, targetPercentage: 98, lowBatteryPercentage: 20 };
          }
          return prev;
        });
      }
    }
  }, [nativePermissions, hasNotificationPermission, isMonitoring]);
  
  // Persistence Sync & Native Service Sync
  useEffect(() => {
    localStorage.setItem('isMonitoring', JSON.stringify(isMonitoring));
    
    if (!isInitialized) return; // Prevent overwriting background running service on boot up before state is resolved
    
    const syncNativeService = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          if (isMonitoring) {
            await AlarmService.requestBatteryOptimization();
            await AlarmService.startService({
              theftAlarm: securityConfig.theftAlarm,
              targetPercentage: alarmConfig.targetPercentage,
              lowBatteryPercentage: alarmConfig.lowBatteryPercentage,
              vibrate: alarmConfig.vibrate
            });
          } else {
            await AlarmService.stopService();
          }
        } catch (e) {
          console.error("Failed to sync Native Foreground Service:", e);
        }
      }
    };
    syncNativeService();
  }, [isMonitoring, isInitialized, securityConfig.theftAlarm, alarmConfig.targetPercentage, alarmConfig.lowBatteryPercentage, alarmConfig.vibrate]);

  // Refresh Native Service if alarm is disarmed/dismissed but monitoring is kept active
  useEffect(() => {
    if (!alarmReason && isMonitoring && Capacitor.isNativePlatform()) {
      AlarmService.startService({
        theftAlarm: securityConfig.theftAlarm,
        targetPercentage: alarmConfig.targetPercentage,
        lowBatteryPercentage: alarmConfig.lowBatteryPercentage,
        vibrate: alarmConfig.vibrate
      }).catch(e => console.error("Failed to reset Native Service on disarm:", e));
    }
  }, [alarmReason, isMonitoring, securityConfig.theftAlarm, alarmConfig.targetPercentage, alarmConfig.lowBatteryPercentage, alarmConfig.vibrate]);

  useEffect(() => {
    localStorage.setItem('alarmConfig', JSON.stringify(alarmConfig));
    if (Capacitor.isNativePlatform()) {
      AlarmService.saveConfig({
        theftAlarm: securityConfig.theftAlarm,
        targetPercentage: alarmConfig.targetPercentage,
        lowBatteryPercentage: alarmConfig.lowBatteryPercentage,
        vibrate: alarmConfig.vibrate
      }).catch(e => console.error("Failed to sync AlarmConfig to Native SharedPreferences:", e));
      AlarmService.savePersistedValue({ key: 'alarmConfig', value: JSON.stringify(alarmConfig) }).catch(() => {});
    }
  }, [alarmConfig, securityConfig.theftAlarm]);

  useEffect(() => {
    localStorage.setItem('securityConfig', JSON.stringify(securityConfig));
    if (Capacitor.isNativePlatform()) {
      AlarmService.savePersistedValue({ key: 'securityConfig', value: JSON.stringify(securityConfig) }).catch(() => {});
    }
  }, [securityConfig]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      AlarmService.savePersistedValue({ key: 'hasAutoStartConfirmed', value: String(hasAutoStartConfirmed) }).catch(() => {});
    }
  }, [hasAutoStartConfirmed]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      AlarmService.savePersistedValue({ key: 'hasOtherPermissionsConfirmed', value: String(hasOtherPermissionsConfirmed) }).catch(() => {});
    }
  }, [hasOtherPermissionsConfirmed]);

  // Load real physical device battery capacity if available natively of that specific phone (e.g. 5000 mAh or specific size)
  useEffect(() => {
    const fetchPhysicalBatteryCapacity = async () => {
      // If we already fetched the physical battery capacity from native, do not overwrite to keep it 100% stable
      const savedConfig = localStorage.getItem('alarmConfig');
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig);
          if (parsed && parsed.hasFetchedPhysicalCapacity) {
            return; // Already cached, complete early
          }
        } catch (e) {
          console.error("Error reading saved config for battery cache check:", e);
        }
      }

      if (Capacitor.isNativePlatform()) {
        try {
          const result = await AlarmService.getBatteryCapacity();
          if (result && result.capacity > 0) {
            setAlarmConfig(prev => {
              return {
                ...prev,
                batteryCapacity: result.capacity,
                hasFetchedPhysicalCapacity: true
              };
            });
          }
        } catch (e) {
          console.error("Failed to query physical battery capacity natively:", e);
        }
      }
    };
    fetchPhysicalBatteryCapacity();
  }, []);
  
  // Temperature Watcher
  useEffect(() => {
    if (battery.temperature > alarmConfig.tempWarningLevel && !showTempWarning) {
      setShowTempWarning(true);
    } else if (battery.temperature <= alarmConfig.tempWarningLevel && showTempWarning) {
      setShowTempWarning(false);
    }
  }, [battery.temperature, alarmConfig.tempWarningLevel]);

  // Handle Splash Screen
  useEffect(() => {
    if (screen === Screen.SPLASH) {
      const timer = setTimeout(() => {
        setScreen(Screen.HOME);
        
        // Show permissions modal on first launch or if any critical native permission is missing
        const isDeviceMissingPermissions = Capacitor.isNativePlatform() && 
          (!nativePermissions.batteryIgnored || !nativePermissions.overlayAllowed || !hasNotificationPermission);

        if (!permissionReminderDismissed || isDeviceMissingPermissions) {
          setShowPermissionsModal(true);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [screen, permissionReminderDismissed, nativePermissions, hasNotificationPermission]);

  // Initial launch check guard to prevent false alarms on app boot
  useEffect(() => {
    if (isInitialized && !initialLaunchChecksDone) {
      const currentLevelPct = Math.round(battery.level * 100);
      if (currentLevelPct >= alarmConfig.targetPercentage) {
        setTargetReachedAlerted(true);
      }
      if (currentLevelPct <= alarmConfig.lowBatteryPercentage) {
        setLowBatteryAlerted(true);
      }
      setInitialLaunchChecksDone(true);
    }
  }, [isInitialized, battery.level, alarmConfig.targetPercentage, alarmConfig.lowBatteryPercentage, initialLaunchChecksDone]);

  // Reset low battery alerted status when battery is charged above lowBatteryPercentage (20%) or plugged in
  useEffect(() => {
    const currentLevelPct = Math.round(battery.level * 100);
    if (currentLevelPct > alarmConfig.lowBatteryPercentage || battery.charging) {
      setLowBatteryAlerted(false);
    }
  }, [battery.level, battery.charging, alarmConfig.lowBatteryPercentage]);

  // Alert Monitor Logic
  useEffect(() => {
    if (!isInitialized || !isMonitoring) {
      setWasCharging(battery.charging);
      return;
    }

    const currentLevelPct = Math.round(battery.level * 100);

    // Reset alert state if we drop below target or stop charging
    if (targetReachedAlerted && (currentLevelPct < alarmConfig.targetPercentage || !battery.charging)) {
      setTargetReachedAlerted(false);
    }

    // 1. High Battery Alarm (Goal Reached)
    // CRITICAL: We check for equality or greater to ensure it triggers exactly at the target
    if (currentLevelPct >= alarmConfig.targetPercentage && battery.charging && !targetReachedAlerted) {
      if (screen !== Screen.LOCK) {
        setAlarmReason('full');
        setScreen(Screen.LOCK);
      }
    }

    // 2. Low Battery Alarm (Critical Level) - Rings only once (lowBatteryAlerted is reset on charging)
    if (currentLevelPct <= alarmConfig.lowBatteryPercentage && !battery.charging && !lowBatteryAlerted) {
      if (screen !== Screen.LOCK) {
        setLowBatteryAlerted(true);
        setAlarmReason('low');
        setScreen(Screen.LOCK);
      }
    }

    // 3. Theft Alarm (Transition from Charging to Unplugged and battery is under 98%)
    if (securityConfig.theftAlarm && wasCharging && !battery.charging && currentLevelPct < 98) {
      if (screen !== Screen.LOCK) {
        setAlarmReason('theft');
        setScreen(Screen.LOCK);
      }
    }

    setWasCharging(battery.charging);
  }, [battery.level, battery.charging, isMonitoring, isInitialized, alarmConfig.targetPercentage, alarmConfig.lowBatteryPercentage, lowBatteryAlerted, securityConfig.theftAlarm, wasCharging, screen]);

  const renderScreen = () => {
    // If trial/subscription expired, force subscription screen but let them see referrals
    // For now, I'll let them browse but show a banner if not active.
    
    switch (screen) {
      case Screen.SPLASH: return <SplashScreen t={t} />;
      case Screen.HOME: return (
        <HomeScreen 
          battery={battery} 
          config={alarmConfig} 
          setConfig={setAlarmConfig} 
          isMonitoring={isMonitoring} 
          setMonitoring={setIsMonitoring} 
          setScreen={setScreen} 
          audioUnlocked={audioUnlocked} 
          setAudioUnlocked={setAudioUnlocked} 
          audioContext={mainAudioContext} 
          chargingCycles={chargingCycles} 
          isNative={isNative} 
          t={t}
          showPermissionsModal={showPermissionsModal}
          setShowPermissionsModal={setShowPermissionsModal}
          hasNotificationPermission={hasNotificationPermission}
          setHasNotificationPermission={setHasNotificationPermission}
          nativePermissions={nativePermissions}
          hasOtherPermissionsConfirmed={hasOtherPermissionsConfirmed}
          setHasOtherPermissionsConfirmed={setHasOtherPermissionsConfirmed}
          onShare={async () => {
            try {
              if (Capacitor.isNativePlatform()) {
                await Share.share({
                  title: t.appName,
                  text: t.shareAppText || `Protect your phone with ${t.appName}!`,
                  url: 'https://ais-dev-uwisz5o2rl7yb3zku2e7aa-142106032593.asia-east1.run.app',
                  dialogTitle: t.shareDialogTitle || 'Share with friends',
                });
              } else if (navigator.share) {
                await navigator.share({
                  title: t.appName,
                  text: t.shareAppText || `Protect your phone with ${t.appName}!`,
                  url: window.location.href,
                });
              } else {
                await navigator.clipboard.writeText(window.location.href);
                alert("App link copied to clipboard to share!");
              }
            } catch (e) {
              console.error("Share failed", e);
            }
          }}
        />
      );
      case Screen.ALARM_SETTINGS: return <AlarmSettings config={alarmConfig} setConfig={setAlarmConfig} onBack={() => setScreen(Screen.HOME)} t={t} />;
      case Screen.SECURITY: return <SecurityScreen onBack={() => setScreen(Screen.HOME)} t={t} />;
      case Screen.HISTORY: return <HistoryScreen logs={chargingLogs} setLogs={setChargingLogs} chargingCycles={chargingCycles} onBack={() => setScreen(Screen.HOME)} t={t} />;
      case Screen.HEALTH: return <HealthScreen battery={battery} batteryCapacity={alarmConfig.batteryCapacity || 5000} chargingCycles={chargingCycles} onBack={() => setScreen(Screen.HOME)} t={t} />;
      case Screen.LOCK: return <AlarmOverlay battery={battery} config={alarmConfig} security={securityConfig} audioContext={mainAudioContext} reason={alarmReason} onStop={async (disarm, openWithAd) => { 
      const currentReason = alarmReason;
      
      // Stop monitoring and stop native service immediately in all cases to prevent re-triggering loops
      setIsMonitoring(false);
      localStorage.setItem('isMonitoring', JSON.stringify(false));
      if (Capacitor.isNativePlatform()) {
        try {
          await AlarmService.stopService();
          console.log("onStop: Stopped native alarm service.");
        } catch (e) {
          console.error("onStop: Error stopping native service:", e);
        }
      }

      setAlarmReason(null);
      setAdDuration(10);
      setAdKeepAppOpen(openWithAd === true);
      setAdForceMinimize(openWithAd !== true);
      setScreen(Screen.ADS);
    }} t={t} />;
      case Screen.ADS: return (
        <GoogleAdScreen 
          duration={adDuration}
          onClose={async () => {
            setScreen(Screen.HOME);
            setAdForceMinimize(false);
            preloadAdMobInterstitial(); // Preload for the next alarm trigger
            if (Capacitor.isNativePlatform() && !adKeepAppOpen) {
              try {
                await AlarmService.minimizeApp();
                console.log("onClose: App minimized successfully on ad completion.");
              } catch (e) {
                console.error("Error minimizing app on ad close:", e);
              }
            }
          }} 
          t={t} 
        />
      );
    default: return <HomeScreen battery={battery} config={alarmConfig} setConfig={setAlarmConfig} isMonitoring={isMonitoring} setMonitoring={setIsMonitoring} setScreen={setScreen} nativePermissions={nativePermissions} hasOtherPermissionsConfirmed={hasOtherPermissionsConfirmed} setHasOtherPermissionsConfirmed={setHasOtherPermissionsConfirmed} onTest={() => { setAlarmReason('test'); setScreen(Screen.LOCK); }} t={t} />;
  }
};

  if (loading) {
    return (
      <div className="h-screen w-full bg-black flex items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center"
        >
          <Shield size={32} className="text-black" />
        </motion.div>
      </div>
    );
  }

  if (screen === Screen.ADS) {
    return (
      <ErrorBoundary t={t}>
        <GoogleAdScreen 
          duration={adDuration}
          onClose={async () => {
            setScreen(Screen.HOME);
            setAdForceMinimize(false);
            preloadAdMobInterstitial(); // Preload for the next alarm trigger
            if (Capacitor.isNativePlatform() && !adKeepAppOpen) {
              try {
                await AlarmService.minimizeApp();
                console.log("onClose: App minimized successfully on ad completion (outer).");
              } catch (e) {
                console.error("Error minimizing app on ad close (outer):", e);
              }
            }
          }} 
          t={t} 
        />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary t={t}>
      <div className={cn(
        "relative h-screen w-full max-w-[480px] mx-auto overflow-y-auto transition-colors duration-1000",
        theme === 'dark' ? "bg-black text-white" : "bg-slate-50 text-slate-900",
        theme === 'neon' && "bg-[#0b0c10] text-[#66fcf1]",
        Capacitor.isNativePlatform() && screen !== Screen.SPLASH && screen !== Screen.LOCK ? "pb-[65px]" : ""
      )}>
      {/* Dynamic Background Gradient */}
      <div className={cn(
        "absolute inset-0 opacity-20 pointer-events-none transition-all duration-1000",
        battery.charging ? "bg-[radial-gradient(circle_at_50%_0%,#22c55e_0%,transparent_70%)]" : "bg-[radial-gradient(circle_at_50%_0%,#3b82f6_0%,transparent_70%)]"
      )} />
    <AnimatePresence mode="wait">
      {renderScreen()}
    </AnimatePresence>

      <AnimatePresence>
        {showTempWarning && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute top-12 left-6 right-6 z-[60] glass-card bg-red-500/20 border-red-500/50 flex items-center gap-4 animate-bounce"
          >
            <div className="p-3 bg-red-500 rounded-2xl text-white"><Thermometer size={24} /></div>
            <div className="flex-1">
              <p className="font-bold text-red-500 text-sm">{t.overheatWarning}</p>
              <p className="text-[10px] opacity-60">{t.coolDownRecommended}</p>
            </div>
            <button onClick={() => setShowTempWarning(false)} className="p-1 opacity-40 hover:opacity-100">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPermissionsModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/98 backdrop-blur-xl z-[120] flex items-center justify-center p-4 overflow-y-auto"
            id="permissions-modal-overlay"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 40 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 40 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-full max-w-[400px] bg-[#0c101d] border border-white/10 rounded-[2.5rem] p-6 pb-8 relative flex flex-col gap-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] my-auto text-left"
              id="permissions-modal-card"
            >
              {/* Close Button / Skip */}
              <button 
                onClick={() => {
                  setShowPermissionsModal(false);
                  localStorage.setItem('permissionReminderDismissed', 'true');
                  setPermissionReminderDismissed(true);
                }}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 text-lg transition-all duration-200 z-[130]"
                id="permissions-modal-close"
              >
                ×
              </button>

              {/* Share Box directly accessible */}
              <button 
                onClick={async () => {
                  try {
                    if (Capacitor.isNativePlatform()) {
                      await Share.share({
                        title: "ChargeGuard Pro Anti-Theft Protection",
                        text: "Install ChargeGuard Pro to protect your phone from theft and overcharging! Secure background & lock-screen alarm.",
                        url: "https://ais-dev-uwisz5o2rl7yb3zku2e7aa-142106032593.asia-east1.run.app",
                        dialogTitle: "Share ChargeGuard Pro App",
                      });
                    } else if (navigator.share) {
                      await navigator.share({
                        title: "ChargeGuard Pro Anti-Theft Protection",
                        text: "Install ChargeGuard Pro to protect your phone from theft and overcharging! Secure background & lock-screen alarm.",
                        url: window.location.href,
                      });
                    } else {
                      await navigator.clipboard.writeText(window.location.href);
                      alert("App link copied to clipboard to share!");
                    }
                  } catch (e) {
                    console.error("Share failed", e);
                  }
                }}
                className="absolute top-4 right-14 flex items-center gap-1 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-[#00FF88] font-bold rounded-full text-[9px] shadow-[0_0_10px_rgba(0,255,136,0.1)] transition-all hover:bg-emerald-500/20 active:scale-95 z-[130]"
              >
                <Share2 size={10} />
                <span>ऐप शेयर (Share)</span>
              </button>

              {/* Progress Stepper Header */}
              <div className="space-y-3 pt-6">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] bg-[#00FF88]/15 border border-[#00FF88]/20 text-[#00FF88] px-2.5 py-1 rounded-full font-black tracking-widest font-mono">
                    STEP {permissionsActivePage} of 6
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold tracking-wider font-sans">
                    {permissionsActivePage === 1 && "Notification / नोटीफिकेशन"}
                    {permissionsActivePage === 2 && "Alarm Service / कवच सुरक्षा"}
                    {permissionsActivePage === 3 && "Battery Optimizer / बैटरी सेट"}
                    {permissionsActivePage === 4 && "Auto-Start / ऑटो-स्टार्ट"}
                    {permissionsActivePage === 5 && "Other Permissions / अन्य अनुमतियां"}
                    {permissionsActivePage === 6 && "Overlay Display / स्क्रीन ओवरले"}
                  </span>
                </div>

                {/* Progress Indicators */}
                <div className="flex gap-1.5 h-1.5 w-full bg-slate-900 border border-white/5 p-[2px] rounded-full overflow-hidden">
                  {[1, 2, 3, 4, 5, 6].map((step) => {
                    const isCompleted = 
                      (step === 1 && hasNotificationPermission) ||
                      (step === 2 && hasAlarmVerified) ||
                      (step === 3 && nativePermissions.batteryIgnored) ||
                      (step === 4 && hasAutoStartConfirmed) ||
                      (step === 5 && hasOtherPermissionsConfirmed) ||
                      (step === 6 && nativePermissions.overlayAllowed);

                    const isActive = permissionsActivePage === step;

                    return (
                      <button
                        key={step}
                        onClick={() => setPermissionsActivePage(step)}
                        className={`flex-1 h-full rounded-full transition-all duration-300 ${
                          isActive 
                            ? 'bg-[#00FF88] shadow-[0_0_8px_rgba(0,255,136,0.5)]' 
                            : isCompleted 
                              ? 'bg-emerald-500/60' 
                              : 'bg-slate-800'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Steps Body */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={permissionsActivePage}
                  initial={{ x: 15, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -15, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* STEP 1: NOTIFICATION PERMISSION */}
                  {permissionsActivePage === 1 && (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="w-16 h-16 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-[1.5rem] flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                          <Bell size={32} className="animate-bounce" />
                        </div>
                        <h2 className="text-lg font-black text-white px-2 mt-1 leading-snug">
                          १. नोटिफिकेशन अनुमति<br />
                          <span className="text-blue-400 text-xs tracking-wider uppercase font-mono">1. Notification Permission</span>
                        </h2>
                      </div>

                      <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 text-xs text-slate-300 leading-relaxed text-left">
                        <p className="font-semibold text-white">🔔 यह क्यों आवश्यक है?</p>
                        <p>एंड्रॉइड फ़ोन पर सिक्योरिटी कवच सेवा को बैकग्राउंड में चालू रखने और चार्ज फुल/थेफ़्ट होने पर अलार्म नोटिफिकेशन भेजने के लिए यह अनुमति अनिवार्य है।</p>
                      </div>

                      <div className="flex items-center justify-between p-3.5 bg-slate-900/80 border border-white/5 rounded-2xl">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">अनुमति स्थिति (Status)</span>
                        {hasNotificationPermission ? (
                          <span className="text-[10px] font-black tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-[#00FF88] px-3 py-1 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#00FF88] rounded-full animate-ping" />
                            GRANTED / सक्रिय
                          </span>
                        ) : (
                          <span className="text-[10px] font-black tracking-widest bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1 rounded-full animate-pulse">
                            REQUIRED / आवश्यक
                          </span>
                        )}
                      </div>

                      <button
                        onClick={async () => {
                          if (hasNotificationPermission) {
                            setPermissionsActivePage(2);
                          } else {
                            if (Capacitor.isNativePlatform()) {
                              try {
                                await AlarmService.openNotificationSettings();
                              } catch (e) {
                                console.error(e);
                              }
                            } else if ('Notification' in window) {
                              try {
                                const perm = await Notification.requestPermission();
                                if (perm === 'granted') {
                                  setHasNotificationPermission(true);
                                  setPermissionsActivePage(2);
                                }
                              } catch (e) {
                                console.error(e);
                              }
                            } else {
                              setHasNotificationPermission(true);
                              setPermissionsActivePage(2);
                            }
                          }
                        }}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                          hasNotificationPermission 
                            ? 'bg-[#00FF88] text-black shadow-[0_4px_20px_rgba(0,255,136,0.25)]' 
                            : 'bg-blue-500 text-black hover:brightness-110 shadow-[0_4px_20px_rgba(59,130,246,0.3)] hover:shadow-blue-500/40'
                        }`}
                      >
                        {hasNotificationPermission ? 'NEXT STEP / आगे बढ़ें ➔' : 'ENABLE NOW / अभी अनुमति दें 🚀'}
                      </button>
                    </div>
                  )}

                  {/* STEP 2: ALARM SERVICE ACTIVE / WAKE LOCK */}
                  {permissionsActivePage === 2 && (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="w-16 h-16 bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20 rounded-[1.5rem] flex items-center justify-center shadow-[0_0_20px_rgba(0,255,136,0.1)]">
                          <ShieldCheck size={32} className="animate-pulse" />
                        </div>
                        <h2 className="text-lg font-black text-white px-2 mt-1 leading-snug">
                          २. कवच सर्विस वेरिफिकेशन<br />
                          <span className="text-[#00FF88] text-xs tracking-wider uppercase font-mono">2. Persistent Alarm Security</span>
                        </h2>
                      </div>

                      <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 text-xs text-slate-300 leading-relaxed text-left">
                        <p className="font-semibold text-white">🛡️ यह क्या करता है?</p>
                        <p>यह वेक-लॉक सिस्टम है। जब आपका मोबाइल बंद या लॉक होता है, तब भी यह अंदरूनी सर्विस को जगाए रखता है ताकि चोरी या केबल हटते ही तुरंत फुल साउंड अलार्म बज सके।</p>
                      </div>

                      <div className="flex items-center justify-between p-3.5 bg-slate-900/80 border border-white/5 rounded-2xl">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">सुरक्षा कवच स्थिति</span>
                        {hasAlarmVerified ? (
                          <span className="text-[10px] font-black tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-[#00FF88] px-3 py-1 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#00FF88] rounded-full animate-ping" />
                            VERIFIED / जांची गई
                          </span>
                        ) : (
                          <span className="text-[10px] font-black tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3 py-1 rounded-full animate-pulse">
                            UNCHECKED / जांचें
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => {
                          setHasAlarmVerified(true);
                          localStorage.setItem('hasAlarmVerified', 'true');
                          setPermissionsActivePage(3);
                        }}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                          hasAlarmVerified 
                            ? 'bg-[#00FF88] text-black shadow-[0_4px_20px_rgba(0,255,136,0.25)]' 
                            : 'bg-emerald-600 text-white hover:brightness-110 shadow-[0_4px_20px_rgba(16,185,129,0.3)] hover:shadow-emerald-500/40'
                        }`}
                      >
                        {hasAlarmVerified ? 'NEXT STEP / आगे बढ़ें ➔' : 'VERIFY NOW / सुरक्षा सुनिश्चित करें 💫'}
                      </button>
                    </div>
                  )}

                  {/* STEP 3: BATTERY OPTIMIZATION */}
                  {permissionsActivePage === 3 && (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="w-16 h-16 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-[1.5rem] flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                          <Battery size={32} className="animate-bounce" />
                        </div>
                        <h2 className="text-lg font-black text-white px-2 mt-1 leading-snug">
                          ३. बैटरी ऑप्टिमाइजेशन बंद करें<br />
                          <span className="text-amber-400 text-xs tracking-wider uppercase font-mono">3. Battery Saver Immunity</span>
                        </h2>
                      </div>

                      <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 text-xs text-slate-300 leading-relaxed text-left font-sans">
                        <p className="font-semibold text-white">🔋 आवश्यक सेटिंग्स:</p>
                        <p>एंड्रॉइड की बैटरी सेविंग पॉलिसी ऐप को बंद कर देती है। सेटिंग्स पेज खुलने पर <strong>{'\'Unrestricted / नो रेस्ट्रिक्शन्स / बैटरी छूट\''}</strong> चुनें ताकि सुरक्षा अलार्म 100% समय काम करे।</p>
                      </div>

                      <div className="flex items-center justify-between p-3.5 bg-slate-900/80 border border-white/5 rounded-2xl">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">अनुमति स्थिति</span>
                        {nativePermissions.batteryIgnored ? (
                          <span className="text-[10px] font-black tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-[#00FF88] px-3 py-1 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#00FF88] rounded-full animate-ping" />
                            UNRESTRICTED / सक्रिय
                          </span>
                        ) : (
                          <span className="text-[10px] font-black tracking-widest bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1 rounded-full animate-pulse">
                            RESTRICTED / बंद
                          </span>
                        )}
                      </div>

                      <button
                        onClick={async () => {
                          if (nativePermissions.batteryIgnored) {
                            setPermissionsActivePage(4);
                          } else {
                            if (Capacitor.isNativePlatform()) {
                              try {
                                await AlarmService.requestBatteryOptimization();
                              } catch (e) {
                                console.error(e);
                              }
                            } else {
                              alert("This option is only available on Mobile APK.");
                              setPermissionsActivePage(4);
                            }
                          }
                        }}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                          nativePermissions.batteryIgnored 
                            ? 'bg-[#00FF88] text-black shadow-[0_4px_20px_rgba(0,255,136,0.25)]' 
                            : 'bg-amber-500 text-black hover:brightness-110 shadow-[0_4px_20px_rgba(245,158,11,0.3)] hover:shadow-amber-500/40'
                        }`}
                      >
                        {nativePermissions.batteryIgnored ? 'NEXT STEP / आगे बढ़ें ➔' : 'DISABLE SAVER / अभी बंद करें💡'}
                      </button>
                    </div>
                  )}

                  {/* STEP 4: AUTO START ENABLE */}
                  {permissionsActivePage === 4 && (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="w-16 h-16 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-[1.5rem] flex items-center justify-center shadow-[0_0_20px_rgba(168,85,247,0.1)]">
                          <Power size={32} className="animate-pulse" />
                        </div>
                        <h2 className="text-lg font-black text-white px-2 mt-1 leading-snug">
                          ४. ऑटो-स्टार्ट अनुमति<br />
                          <span className="text-purple-400 text-xs tracking-wider uppercase font-mono">4. Auto-Start Settings</span>
                        </h2>
                      </div>

                      <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 text-xs text-slate-300 leading-relaxed text-left font-sans">
                        <p className="font-semibold text-white">🔄 ब्रांड विशिष्ट सेटिंग्स:</p>
                        <p>Xiaomi, Redmi, Vivo, Oppo, Realme और Samsung फ़ोन ऑटोमैटिक ऐप्स को बंद कर देते हैं। सेटिंग्स में जाकर <strong>{'\'ऑतो-स्टार्ट / Auto-Start\''}</strong> बटन को अवश्य चालू करें।</p>
                      </div>

                      <div className="flex items-center justify-between p-3.5 bg-slate-900/80 border border-white/5 rounded-2xl font-sans">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">ऑटो-स्टार्ट स्थिति</span>
                        {hasAutoStartConfirmed ? (
                          <span className="text-[10px] font-black tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-[#00FF88] px-3 py-1 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#00FF88] rounded-full animate-ping" />
                            CONFIRMED / सक्रिय (OK)
                          </span>
                        ) : (
                          <span className="text-[10px] font-black tracking-widest bg-purple-300/10 border border-purple-500/30 text-[#e0aaff] px-3 py-1 rounded-full animate-pulse">
                            MANUAL CHECK / सेट करें
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        <button
                          onClick={async () => {
                            if (Capacitor.isNativePlatform()) {
                              try {
                                await AlarmService.openAutoStartSettings();
                              } catch (e) {
                                console.error(e);
                              }
                            } else {
                              alert("This option is only available on Mobile APK.");
                            }
                            setHasAutoStartConfirmed(true);
                            localStorage.setItem('hasAutoStartConfirmed', 'true');
                          }}
                          className="col-span-3 py-4 bg-purple-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer shadow-[0_4px_15px_rgba(168,85,247,0.25)]"
                        >
                          🔄 OPEN SETTINGS / पेज खोलें
                        </button>
                        <button
                          onClick={() => {
                            const val = !hasAutoStartConfirmed;
                            setHasAutoStartConfirmed(val);
                            localStorage.setItem('hasAutoStartConfirmed', val.toString());
                          }}
                          className={`col-span-2 py-4 border rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center text-center ${
                            hasAutoStartConfirmed 
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00FF88]' 
                              : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {hasAutoStartConfirmed ? '✓ CONFIRMED' : 'चालू कर दिया!'}
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setPermissionsActivePage(5);
                        }}
                        className="w-full py-2 bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all text-center leading-none"
                      >
                        Skip to Step 5 / आगे बढ़ें ➔
                      </button>
                    </div>
                  )}

                  {/* STEP 5: OTHER PERMISSIONS / अन्य अनुमतियाँ */}
                  {permissionsActivePage === 5 && (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="w-16 h-16 bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 rounded-[1.5rem] flex items-center justify-center shadow-[0_0_20px_rgba(217,70,239,0.1)]">
                          <Settings size={32} className="animate-pulse" />
                        </div>
                        <h2 className="text-lg font-black text-white px-2 mt-1 leading-snug">
                          ५. अन्य अनुमतियाँ सेट करें<br />
                          <span className="text-fuchsia-400 text-xs tracking-wider uppercase font-mono">5. Other Brand Permissions</span>
                        </h2>
                      </div>

                      <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 text-xs text-slate-300 leading-relaxed text-left font-sans animate-fade-in">
                        <p className="font-semibold text-[#00FF88]">⚙️ महत्वपूर्ण ब्रांड सेटिंग (MI/Oppo/Vivo):</p>
                        <p>Xiaomi, Redmi, Vivo, Oppo फ़ोनों में लॉकस्क्रीन या बैकग्राउंड में अलार्म बजाने के लिए ये अनुमतियाँ चालू करें:</p>
                        <ul className="list-disc pl-4 space-y-1 text-slate-300 mt-2">
                          <li><strong>Show on Lock Screen</strong> (लॉक स्क्रीन पर दिखाएं) ➔ <span className="text-emerald-400 font-bold">Always Allow / Enabled</span></li>
                          <li><strong>Display pop-up windows</strong> (बैकग्राउंड में पॉप-अप विंडो) ➔ <span className="text-emerald-400 font-bold">Always Allow / Enabled</span></li>
                        </ul>
                      </div>

                      <div className="flex items-center justify-between p-3.5 bg-slate-900/80 border border-white/5 rounded-2xl font-sans">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">अनुमति स्थिति</span>
                        {hasOtherPermissionsConfirmed ? (
                          <span className="text-[10px] font-black tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-[#00FF88] px-3 py-1 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#00FF88] rounded-full animate-ping" />
                            CONFIRMED / सक्रिय (OK)
                          </span>
                        ) : (
                          <span className="text-[10px] font-black tracking-widest bg-fuchsia-300/10 border border-fuchsia-500/30 text-[#f5d0fe] px-3 py-1 rounded-full animate-pulse">
                            NOT CONFIGURED / चेक करें
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-5 gap-2">
                        <button
                          onClick={async () => {
                            if (Capacitor.isNativePlatform()) {
                              try {
                                await AlarmService.openOtherPermissionsSettings();
                              } catch (e) {
                                console.error(e);
                              }
                            } else {
                              alert("This option is only available on Mobile APK.");
                            }
                            setHasOtherPermissionsConfirmed(true);
                            localStorage.setItem('hasOtherPermissionsConfirmed', 'true');
                          }}
                          className="col-span-3 py-4 bg-fuchsia-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer shadow-[0_4px_15px_rgba(217,70,239,0.25)]"
                        >
                          ⚙️ OPEN OTHER PERM / पेज खोलें
                        </button>
                        <button
                          onClick={() => {
                            const val = !hasOtherPermissionsConfirmed;
                            setHasOtherPermissionsConfirmed(val);
                            localStorage.setItem('hasOtherPermissionsConfirmed', val.toString());
                          }}
                          className={`col-span-2 py-4 border rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center justify-center text-center ${
                            hasOtherPermissionsConfirmed 
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-[#00FF88]' 
                              : 'bg-slate-900 border-white/10 text-slate-400 hover:bg-slate-800'
                          }`}
                        >
                          {hasOtherPermissionsConfirmed ? '✓ CONFIRMED' : 'चालू कर दिया!'}
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setPermissionsActivePage(6);
                        }}
                        className="w-full py-2 bg-white/5 border border-white/5 text-slate-400 hover:bg-white/10 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all text-center leading-none"
                      >
                        Skip to Step 6 / आगे बढ़ें ➔
                      </button>
                    </div>
                  )}

                  {/* STEP 6: OVERLAY PERMISSION */}
                  {permissionsActivePage === 6 && (
                    <div className="space-y-4">
                      <div className="flex flex-col items-center text-center gap-2">
                        <div className="w-16 h-16 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-[1.5rem] flex items-center justify-center shadow-[0_0_20px_rgba(244,63,94,0.1)]">
                          <Lock size={32} className="animate-bounce" />
                        </div>
                        <h2 className="text-lg font-black text-white px-2 mt-1 leading-snug">
                          ६. डिस्प्ले ओवर अन्य ऐप्स अनुमति<br />
                          <span className="text-rose-400 text-xs tracking-wider uppercase font-mono">6. Display Over Other Apps</span>
                        </h2>
                      </div>

                      <div className="p-4 bg-slate-900/60 border border-white/5 rounded-2xl space-y-2 text-xs text-slate-300 leading-relaxed text-left">
                        <p className="font-semibold text-white">📺 ओवरले क्यों आवश्यक है?</p>
                        <p>स्क्रीन लॉक रहने की स्थिति में जब कोई अलार्म बजेगा, तब इस अनुमति के कारण अलार्म स्क्रीन तुरंत आपके मोबाइल पर सबसे ऊपर प्रदर्शित होकर बजने लगेगी।</p>
                      </div>

                      <div className="flex items-center justify-between p-3.5 bg-slate-900/80 border border-white/5 rounded-2xl">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">अनुमति स्थिति</span>
                        {nativePermissions.overlayAllowed ? (
                          <span className="text-[10px] font-black tracking-widest bg-emerald-500/10 border border-emerald-500/30 text-[#00FF88] px-3 py-1 rounded-full flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-[#00FF88] rounded-full animate-ping" />
                            ALLOWED / सक्रिय
                          </span>
                        ) : (
                          <span className="text-[10px] font-black tracking-widest bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-1 rounded-full animate-pulse">
                            REQUIRED / आवश्यक
                          </span>
                        )}
                      </div>

                      <button
                        onClick={async () => {
                          if (nativePermissions.overlayAllowed) {
                            // Finish and Activate monitoring
                            setShowPermissionsModal(false);
                            localStorage.setItem('permissionReminderDismissed', 'true');
                            setPermissionReminderDismissed(true);
                            setIsMonitoring(true);
                          } else {
                            if (Capacitor.isNativePlatform()) {
                              try {
                                await AlarmService.openOverlaySettings();
                              } catch (e) {
                                console.error(e);
                              }
                            } else {
                              alert("This option is only available on Mobile APK.");
                              setShowPermissionsModal(false);
                              localStorage.setItem('permissionReminderDismissed', 'true');
                              setPermissionReminderDismissed(true);
                              setIsMonitoring(true);
                            }
                          }
                        }}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                          nativePermissions.overlayAllowed 
                            ? 'bg-[#00FF88] text-black shadow-[0_4px_20px_rgba(0,255,136,0.25)] font-black' 
                            : 'bg-rose-500 text-black hover:brightness-110 shadow-[0_4px_20px_rgba(244,63,94,0.3)] hover:shadow-rose-500/40'
                        }`}
                      >
                        {nativePermissions.overlayAllowed ? '⚡ ACTIVATE KAVACH / कवच सक्रिय करें' : 'ALLOW OVERLAY / अभी चालू करें 🎥'}
                      </button>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Back / Next Slider Footer Nav */}
              <div className="flex justify-between items-center pt-4 border-t border-white/5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                <button
                  disabled={permissionsActivePage === 1}
                  onClick={() => setPermissionsActivePage(p => Math.max(1, p - 1))}
                  className="px-4 py-2 border border-white/5 rounded-xl bg-slate-900/40 text-slate-400 hover:text-white disabled:opacity-20 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer"
                >
                  ◀ Back / पीछे
                </button>
                <div className="h-2 w-2 rounded-full bg-white/10 animate-pulse" />
                <button
                  disabled={permissionsActivePage === 6}
                  onClick={() => setPermissionsActivePage(p => Math.min(6, p + 1))}
                  className="px-4 py-2 border border-[#00FF88]/20 bg-[#00FF88]/5 rounded-xl text-[#00FF88] hover:bg-[#00FF88]/10 disabled:opacity-20 disabled:pointer-events-none transition-all flex items-center gap-1 cursor-pointer"
                >
                  Skip / आगे ➔
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Bar (Mobile Style) */}
      {screen !== Screen.SPLASH && screen !== Screen.LOCK && (
        <div className={cn(
          "fixed left-1/2 -translate-x-1/2 w-full max-w-[480px] h-20 neo-blur border-t border-white/5 flex items-center justify-around px-4 pb-4 z-50 transition-all duration-300",
          "bottom-0"
        )}>
          <NavButton active={screen === Screen.HOME} icon={Battery} onClick={() => setScreen(Screen.HOME)} />
          <NavButton active={screen === Screen.HISTORY} icon={History} onClick={() => setScreen(Screen.HISTORY)} />
          <NavButton active={screen === Screen.HEALTH} icon={Activity} onClick={() => setScreen(Screen.HEALTH)} />
          <NavButton active={screen === Screen.SECURITY} icon={Shield} onClick={() => setScreen(Screen.SECURITY)} />
        </div>
      )}
      </div>
    </ErrorBoundary>
  );
}

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode, t: any }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error suppressed:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-8 text-center">
          <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6">
            <Shield size={40} />
          </div>
          <h2 className="text-xl font-black italic tracking-tighter text-white uppercase mb-2">Defense System Error</h2>
          <p className="text-slate-500 text-xs mb-8">An unexpected error occurred. The system is attempting to recover automatically.</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-accent text-black px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest"
          >
            Restart Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function NavButton({ icon: Icon, active, onClick }: { icon: any, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "p-3 rounded-2xl transition-all duration-300 flex flex-col items-center gap-1",
      active ? "bg-accent text-black scale-110 accent-glow" : "text-slate-500 hover:text-white"
    )}>
      <Icon size={24} />
      {active && <div className="w-1 h-1 bg-black rounded-full" />}
    </button>
  );
}

function GoogleAdScreen({ duration = 15, onClose, t }: { duration?: number, onClose: () => void, t: any }) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [showHtmlAd, setShowHtmlAd] = useState(true);

  // Keep a stable ref to onClose to completely prevent re-running the AdMob useEffect!
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setSecondsLeft(duration);
  }, [duration]);

  // Handle local countdown for fallback HTML Ad
  useEffect(() => {
    if (!showHtmlAd) return;
    
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onCloseRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showHtmlAd]);

  // Dynamically load & trigger real Native AdMob Interstitial on mobile devices!
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    if (isNative) {
      let dismissedListener: any = null;
      let failedToShowListener: any = null;
      let isClosed = false;

      const triggerClose = () => {
        if (!isClosed) {
          isClosed = true;
          // Clean up native listeners
          try {
            dismissedListener?.remove();
            failedToShowListener?.remove();
          } catch (e) {
            console.warn("Error removing listeners:", e);
          }
          onCloseRef.current();
        }
      };

      const showNativeInterstitial = async () => {
        try {
          // Hide standard HTML countdown block and wait for full native ad experience
          setShowHtmlAd(false);
          
          const module = await import('@capacitor-community/admob');
          const AdMob = module.AdMob;

          // Crucial: ALWAYS initialize AdMob first in case the app was opened in alarm mode directly
          try {
            await (AdMob as any).initialize({
              requestTrackingAuthorization: true,
              initializeForTesting: false,
            });
            console.log("AdMob SDK initialized successfully inside GoogleAdScreen.");
          } catch (initErr) {
            console.warn("AdMob SDK already initialized or failed to initialize in GoogleAdScreen:", initErr);
          }
          
          const finalAdId = getAdUnitId('interstitial');
          const isRealAdId = finalAdId && finalAdId.startsWith('ca-app-pub-');
          const isTestingAd = !isRealAdId || finalAdId.includes('3940256099942544');

          console.log(`Preparing native AdMob Interstitial (ID: ${finalAdId}, isTesting: ${isTestingAd})...`);

          // 1. Temporarily clear any active banner so that they do not conflict or overlay on top of each other!
          try {
            await AdMob.removeBanner();
            console.log("Temporarily removed banner before displaying interstitial.");
          } catch (bannerErr) {
            console.warn("Could not remove banner before interstitial (might not be active):", bannerErr);
          }

          // 2. Set up event listeners for the interstitial BEFORE showing it!
          dismissedListener = await (AdMob.addListener as any)('interstitialAdDismissed', () => {
            console.log("AdMob: Interstitial ad closed by the user.");
            triggerClose();
          });

          failedToShowListener = await (AdMob.addListener as any)('interstitialAdFailedToShow', (info: any) => {
            console.warn("AdMob: Interstitial failed to show:", info);
            // Fallback to HTML Countdown ad display
            setShowHtmlAd(true);
            try {
              dismissedListener?.remove();
              failedToShowListener?.remove();
            } catch (e) {}
          });

          // 3. Try showing instantly since we preloaded it on boot or on arming
          try {
            console.log("AdMob: Attempting to present already preloaded Interstitial...");
            await AdMob.showInterstitial();
            console.log("Native AdMob Interstitial overlay presented successfully from background cache.");
          } catch (showErr) {
            console.log("AdMob: Preloaded interstitial was not ready or expired. Preparing fresh...", showErr);
            // Fallback: Prepare interstitial
            await AdMob.prepareInterstitial({
              adId: finalAdId,
              isTesting: isTestingAd,
            });

            // Show native interstitial
            await AdMob.showInterstitial();
            console.log("Native AdMob Interstitial overlay presented successfully.");
          }
          
          // NOTE: We do NOT call onClose() here! We wait for 'interstitialAdDismissed' event.
        } catch (err) {
          console.warn("Failed to load or present native AdMob Interstitial. Falling back to simulated HTML ad screen:", err);
          setShowHtmlAd(true);
          try {
            dismissedListener?.remove();
            failedToShowListener?.remove();
          } catch (e) {}
        }
      };
      
      showNativeInterstitial();

      return () => {
        try {
          dismissedListener?.remove();
          failedToShowListener?.remove();
        } catch (e) {}
      };
    }
  }, []); // Run EXACTLY ONCE on component mount

  // If native interstitial is rendering or playing, don't obstruct the user
  if (!showHtmlAd) {
    return (
      <div className="fixed inset-0 bg-black z-[9999] w-screen h-screen flex flex-col justify-center items-center p-6 text-white text-center font-sans">
        <div className="w-16 h-16 rounded-full border-4 border-accent border-t-transparent animate-spin mb-4" />
        <h3 className="text-sm font-bold tracking-wide">Loading AdMob Premium Ad...</h3>
        <p className="text-xs text-slate-500 mt-2">Connecting with Google Mobile Ads SDK</p>
      </div>
    );
  }

  // Fallback beautiful HTML on-screen ad countdown
  const bannerAdId = getAdUnitId('banner');
  return (
    <div className="fixed inset-0 bg-slate-950 z-[9999] w-screen h-screen flex flex-col justify-between p-6 select-none text-white font-sans animate-fade-in">
      {/* Ad Header */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
          <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
          <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400">Ad</span>
          <span className="text-[9px] text-slate-500">•</span>
          <span className="text-[9px] text-slate-400 font-bold">Google AdMob</span>
        </div>

        <div className="flex items-center gap-2">
          {/* AdChoices Badge */}
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 px-2 py-1 rounded-full text-[9px] text-slate-500">
            <span className="font-bold">AdChoices</span>
            <span className="w-2.5 h-2.5 bg-blue-500 rounded-full flex items-center justify-center text-[8px] text-white font-serif">i</span>
          </div>

          <div className="bg-white/10 px-3 py-1.5 rounded-full text-[10px] font-black uppercase text-accent tracking-widest border border-white/5 shadow-sm">
            Closing in {secondsLeft}s
          </div>
        </div>
      </div>

      {/* Ad Body containing responsive Google AdMob element */}
      <div className="flex-1 flex flex-col items-stretch justify-stretch w-full my-4 px-2">
        <div className="w-full h-full flex-1 bg-slate-900/40 border border-slate-800/60 rounded-3xl p-4 shadow-2xl relative overflow-hidden flex flex-col justify-center items-center">
          {/* Real Google AdMob Component slot integration */}
          <GoogleAdMob slot={bannerAdId} format="auto" responsive="true" style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
      </div>

      {/* Ad Footer / Loader Bar */}
      <div className="w-full flex flex-col items-center space-y-3 pb-4">
        {/* Ad Progress Bar */}
        <div className="w-full max-w-[340px] h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
          <div 
            className="h-full bg-gradient-to-r from-accent to-emerald-400 transition-all duration-1000 ease-linear rounded-full"
            style={{ width: `${((duration - secondsLeft) / duration) * 100}%` }}
          />
        </div>
        <div className="flex items-center justify-between w-full max-w-[340px] px-1">
          <p className="text-[9px] text-slate-600 uppercase tracking-widest font-bold">Ad via Google AdMob</p>
          <p className="text-[9px] text-slate-500 font-medium font-mono">Please wait for {secondsLeft}s before returning</p>
        </div>
      </div>
    </div>
  );
}

function SplashScreen({ t }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center h-full space-y-8 bg-[#020617]"
    >
      <motion.div 
        animate={{ 
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-32 h-32 bg-[#00FF88] rounded-[40px] flex items-center justify-center p-6 shadow-[0_0_50px_rgba(0,255,136,0.3)]"
      >
        <Zap size={64} className="text-black fill-current" />
      </motion.div>
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">{t.appName}<span className="text-[#00FF88]">.</span></h1>
        {/* sync_v1.0.26 */}
        <p className="text-slate-500 text-[10px] tracking-[0.4em] font-bold mt-2 uppercase">{t.coreSystem} v1.0.31</p>
      </div>
    </motion.div>
  );
}

function HomeScreen({ 
  battery, 
  config, 
  setConfig, 
  isMonitoring, 
  setMonitoring, 
  setScreen, 
  audioUnlocked, 
  setAudioUnlocked, 
  audioContext, 
  chargingCycles,
  onTest, 
  isNative, 
  t, 
  onShare,
  showPermissionsModal,
  setShowPermissionsModal,
  hasNotificationPermission,
  setHasNotificationPermission,
  nativePermissions,
  hasOtherPermissionsConfirmed,
  setHasOtherPermissionsConfirmed
}: any) {
  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 pb-32 flex flex-col"
    >
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(0,255,136,0.4)]">
             <Zap size={20} className="text-black" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">{t.appName}<span className="text-accent">.</span></h1>
        </div>
        <div className="flex gap-2 items-center">
          <button 
            onClick={onShare} 
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[#00FF88] text-[10px] font-black uppercase rounded-full tracking-wider transition-all duration-200 active:scale-95"
          >
            <Share2 size={12} />
            <span>Share App / शेयर</span>
          </button>
          <button onClick={() => setScreen(Screen.ALARM_SETTINGS)} className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center shrink-0">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* 🛡️ App Security Setup Card with 4 Direct Buttons directly on HomeScreen */}
      <div className="w-full mb-6 bg-[#0c101d] border border-white/10 rounded-3xl p-5 flex flex-col gap-4 shadow-[0_15px_30px_rgba(0,0,0,0.4)]">
        <div className="flex items-start gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center shrink-0">
              <Shield size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-black text-amber-500 uppercase tracking-wide">
                Required Permissions Setup
              </h3>
              <p className="text-[10px] text-slate-400">Grant the following critical permissions to ensure background protection & alarms work properly:</p>
            </div>
          </div>
          <button 
            onClick={() => setShowPermissionsModal(true)}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold text-[9px] uppercase tracking-wider rounded-lg transition-all"
          >
            Detailed Help 📖
          </button>
        </div>

        {/* 5 Bento Columns representing the key setup actions directly accessible */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. BATTERY IMMUNITY */}
          <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col justify-between gap-3">
            <div className="flex justify-between items-start gap-1">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500">Step 1: Battery</p>
                <h4 className="text-[11px] font-extrabold text-white">Battery Optimization</h4>
              </div>
              {nativePermissions.batteryIgnored ? (
                <span className="text-[8px] bg-emerald-500/15 border border-emerald-500/30 text-[#00FF88] px-2 py-0.5 rounded-md font-extrabold">GRANTED (OK)</span>
              ) : (
                <span className="text-[8px] bg-red-400/10 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-md font-extrabold">REQUIRED</span>
              )}
            </div>
            <button
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  try {
                    await AlarmService.requestBatteryOptimization();
                  } catch (e) {
                    console.error(e);
                  }
                } else {
                  alert("This option is only available on Mobile APK.");
                }
              }}
              className={`w-full py-2 ${nativePermissions.batteryIgnored ? 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10' : 'bg-blue-500 hover:bg-blue-600 text-black shadow-[0_3px_12px_rgba(59,130,246,0.2)]'} font-black text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-1`}
            >
              🔋 {nativePermissions.batteryIgnored ? 'Battery Allowed' : 'Allow Battery'}
            </button>
          </div>

          {/* 2. OVERLAY */}
          <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col justify-between gap-3">
            <div className="flex justify-between items-start gap-1">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500">Step 6: Overlay</p>
                <h4 className="text-[11px] font-extrabold text-white">Display Over Apps</h4>
              </div>
              {nativePermissions.overlayAllowed ? (
                <span className="text-[8px] bg-emerald-500/15 border border-emerald-500/30 text-[#00FF88] px-2 py-0.5 rounded-md font-extrabold">GRANTED (OK)</span>
              ) : (
                <span className="text-[8px] bg-red-400/10 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-md font-extrabold">REQUIRED</span>
              )}
            </div>
            <button
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  try {
                    await AlarmService.openOverlaySettings();
                  } catch (e) {
                    console.error(e);
                  }
                } else {
                  alert("This option is only available on Mobile APK.");
                }
              }}
              className={`w-full py-2 ${nativePermissions.overlayAllowed ? 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10' : 'bg-amber-500 hover:bg-amber-600 text-black shadow-[0_3px_12px_rgba(245,158,11,0.2)]'} font-black text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-1`}
            >
              📺 {nativePermissions.overlayAllowed ? 'Overlay Allowed' : 'Allow Overlay'}
            </button>
          </div>

          {/* 3. NOTIFICATION */}
          <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col justify-between gap-3">
            <div className="flex justify-between items-start gap-1">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500">Step 3: Notification</p>
                <h4 className="text-[11px] font-extrabold text-white">Push Notifications</h4>
              </div>
              {hasNotificationPermission ? (
                <span className="text-[8px] bg-emerald-500/15 border border-emerald-500/30 text-[#00FF88] px-2 py-0.5 rounded-md font-extrabold">GRANTED (OK)</span>
              ) : (
                <span className="text-[8px] bg-red-400/10 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-md font-extrabold">REQUIRED</span>
              )}
            </div>
            <button
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  try {
                    await AlarmService.openNotificationSettings();
                  } catch (e) {
                    console.error("Failed to open native notification settings:", e);
                  }
                } else if ('Notification' in window) {
                  try {
                    const perm = await Notification.requestPermission();
                    if (perm === 'granted') {
                      setHasNotificationPermission(true);
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }
              }}
              className={`w-full py-2 ${hasNotificationPermission ? 'bg-white/5 border border-white/10 text-slate-400 hover:bg-white/10' : 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-[0_3px_12px_rgba(16,185,129,0.2)]'} font-black text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-1`}
            >
              🔔 {hasNotificationPermission ? 'Notifications OK' : 'Allow Notifications'}
            </button>
          </div>

          {/* 4. AUTO START */}
          <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col justify-between gap-3">
            <div className="flex justify-between items-start gap-1">
              <div>
                <p className="text-[9px] font-black uppercase text-slate-500">Step 4: Background</p>
                <h4 className="text-[11px] font-extrabold text-white">Auto-Start Setting</h4>
              </div>
              <span className="text-[8px] bg-purple-500/10 border border-purple-500/30 text-purple-400 px-2 py-0.5 rounded-md font-extrabold">RECOMMENDED</span>
            </div>
            <button
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  try {
                    await AlarmService.openAutoStartSettings();
                  } catch (e) {
                    console.error(e);
                  }
                } else {
                  alert("This option is only available on Mobile APK.");
                }
              }}
              className="w-full py-2 bg-purple-505 hover:bg-purple-600 text-black shadow-[0_3px_12px_rgba(168,85,247,0.2)] font-black text-[10px] uppercase rounded-xl transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: '#a855f7' }}
            >
              🔄 Launch Auto-Start
            </button>
          </div>

          {/* 5. OTHER PERMISSIONS */}
          <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col justify-between gap-3 font-sans">
            <div className="flex justify-between items-start gap-1">
              <div>
                <p className="text-[9px] font-black uppercase text-[#00FF88]">Step 5: Brand Settings</p>
                <h4 className="text-[11px] font-extrabold text-white">Other Permissions</h4>
              </div>
              {hasOtherPermissionsConfirmed ? (
                <span className="text-[8px] bg-emerald-500/15 border border-emerald-500/30 text-[#00FF88] px-2 py-0.5 rounded-md font-extrabold">GRANTED (OK)</span>
              ) : (
                <span className="text-[8px] bg-[#00FF88]/10 border border-[#00FF88]/30 text-[#00FF88] px-2 py-0.5 rounded-md font-extrabold">RECOMMENDED</span>
              )}
            </div>
            <button
              onClick={async () => {
                if (Capacitor.isNativePlatform()) {
                  try {
                    await AlarmService.openOtherPermissionsSettings();
                  } catch (e) {
                     console.error(e);
                  }
                } else {
                  alert("This option is only available on Mobile APK.");
                }
                setHasOtherPermissionsConfirmed(true);
                localStorage.setItem('hasOtherPermissionsConfirmed', 'true');
              }}
              className="w-full py-2 bg-emerald-500/10 border border-[#00FF88]/30 hover:bg-emerald-500/25 text-[#00FF88] font-black text-[9px] uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[0_3px_12px_rgba(0,255,136,0.1)] active:scale-95"
            >
              ⚙️ Launch Other Perms
            </button>
          </div>
        </div>
      </div>
 
      <div className="flex-1 grid grid-cols-12 gap-4">
        {/* Status indicator and Master Toggle */}
        <div className="col-span-12 glass-card relative overflow-hidden flex flex-col items-center justify-center p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#00FF8810,transparent_70%)] opacity-50"></div>
          <BatteryIndicator level={battery.level} charging={battery.charging} className="scale-110" />
          
          <div className="mt-8 grid grid-cols-3 gap-3 w-full border-t border-slate-800/60 pt-6">
            <div className="text-center flex flex-col items-center justify-center">
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black mb-1">Battery / क्षमता</p>
              <p className="text-lg font-black text-emerald-400 font-mono leading-none flex items-center gap-1">
                <span>{Math.round(battery.level * (config.batteryCapacity || 5000))}</span>
                <span className="text-[10px] text-slate-400 font-bold font-sans">mAh</span>
              </p>
              <p className="text-[9px] text-slate-500 font-medium font-mono mt-1">/ {config.batteryCapacity || 5000} mAh</p>
            </div>

            <div className="text-center flex flex-col items-center justify-center border-x border-slate-800/60">
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black mb-1">Temp / तापमान</p>
              <p className={cn(
                "text-lg font-black font-mono leading-none flex items-center justify-center gap-1",
                battery.temperature > 39 ? "text-red-500" : (battery.temperature > 36 ? "text-amber-400" : "text-emerald-400")
              )}>
                <Thermometer size={12} className="shrink-0" />
                <span>{battery.temperature}°C</span>
              </p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                {battery.temperature > 39 ? '🔥 Hot' : (battery.temperature > 36 ? '⚡ Warm' : '❄️ Cool')}
              </p>
            </div>

            <div className="text-center flex flex-col items-center justify-center">
              <p className="text-[9px] uppercase tracking-widest text-slate-500 font-black mb-1">Plugs / चक्र</p>
              <p className="text-lg font-black text-accent font-mono leading-none flex items-center justify-center gap-1">
                <Zap size={11} className="text-accent animate-pulse shrink-0" />
                <span>{chargingCycles}</span>
              </p>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Times Charged</p>
            </div>
          </div>
        </div>
 
        {/* Alarm Threshold - Locked Intelligent Battery Guard Settings */}
        <div className="col-span-12 bento-card p-6 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5 pointer-events-none" />
          <div className="flex items-center gap-2.5 relative z-10">
            <div className="p-2 bg-[#00FF88]/15 text-[#00FF88] rounded-xl">
              <ShieldCheck size={18} />
            </div>
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-[#00FF88] font-sans">
              Intelligent Battery Guard Settings
            </h3>
          </div>

          <p className="text-xs font-semibold leading-relaxed text-slate-300 relative z-10 font-sans">
            Automatically alarm system first setup permission and without open charging app please charge plugin start automatically alarm
          </p>

          <div className="grid grid-cols-2 gap-3 relative z-10 mt-1">
            <div className="p-3.5 bg-slate-950/80 border border-white/5 rounded-2xl flex flex-col gap-1 items-center justify-center text-center">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold font-sans">Minimum Charge</span>
              <span className="text-2xl font-black text-rose-500 font-mono">20%</span>
              <span className="text-[8px] text-slate-400 font-medium font-sans">Low Warning limit</span>
            </div>

            <div className="p-3.5 bg-slate-950/80 border border-white/5 rounded-2xl flex flex-col gap-1 items-center justify-center text-center">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold font-sans">Maximum Charge</span>
              <span className="text-2xl font-black text-[#00FF88] font-mono">98%</span>
              <span className="text-[8px] text-slate-400 font-medium font-sans">Full protect limit</span>
            </div>
          </div>
        </div>
 
        {/* AdMob (Moved from Top) */}
        <div className="col-span-12 mt-2">
          <GoogleAdMob slot={getAdUnitId('banner')} />
        </div>
 
        {/* Master Toggle */}
        <div className="col-span-12 flex flex-col gap-4 mt-2">
          <div className="bg-[#00FF88] rounded-[2rem] p-1 flex shadow-[0_20px_50px_rgba(0,255,136,0.2)]">
            <button 
              onClick={() => {
                setAudioUnlocked(true);
                if (audioContext) {
                  audioContext.resume();
                }

                setMonitoring(!isMonitoring);
              }}
              className="flex-1 min-h-[80px] bg-black text-white rounded-[1.8rem] flex items-center justify-center gap-4 relative overflow-hidden group transition-all active:scale-95"
            >
              {isMonitoring ? (
                <>
                  <motion.div 
                    animate={{ opacity: [0.05, 0.15, 0.05] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-[#00FF88]"
                  />
                  <div className="w-10 h-10 rounded-full border-2 border-[#00FF88] flex items-center justify-center bg-[#00FF88] relative z-10 shadow-[0_0_20px_rgba(0,255,136,0.5)]">
                    <ShieldCheck size={24} className="text-black" />
                  </div>
                  <div className="flex flex-col items-start relative z-10">
                    <span className="text-xl font-black tracking-tight uppercase italic text-[#00FF88] leading-none">
                      {t.armed}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-tight text-[#00FF88]/60">
                      {t.securedMonitoring}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full border-2 border-white/20 flex items-center justify-center bg-white/5 relative z-10 group-hover:border-[#00FF88] transition-colors">
                    <Power size={24} className="text-white group-hover:text-[#00FF88] transition-colors" />
                  </div>
                  <div className="flex flex-col items-start relative z-10 text-left">
                    <span className="text-xl font-black tracking-tight uppercase italic text-white leading-none group-hover:text-[#00FF88] transition-colors">
                      {t.setAlarm}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-tight text-white/40 group-hover:text-[#00FF88]/40">
                      {t.backgroundDefense}
                    </span>
                  </div>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <footer className="mt-8 flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase tracking-widest">
        <span>{t.mode}: <span className="text-accent">Auto</span></span>
        <span className="flex items-center gap-2 italic text-slate-600">v1.0.31-{t.stable}</span>
      </footer>
    </motion.div>
  );
}

function StatusCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="glass-card flex items-center gap-4 p-4">
      <div className={cn("p-2 rounded-xl bg-white/5", color)}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
        <p className="text-sm font-bold font-mono">{value}</p>
      </div>
    </div>
  );
}

function AlarmSettings({ config, setConfig, onBack, t }: any) {
  const [showPicker, setShowPicker] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCapacityDialogOpen, setIsCapacityDialogOpen] = useState(false);
  const [customCapacityInput, setCustomCapacityInput] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setConfig({
        ...config,
        sound: 'Custom',
        customSoundUrl: url,
        customSoundName: file.name
      });
      setShowPicker(false);
    }
  };

    const togglePreview = async () => {
      if (isPreviewing) {
        if (previewAudioRef.current) {
          previewAudioRef.current.pause();
          previewAudioRef.current = null;
        }
        setIsPreviewing(false);
        return;
      }

      setIsPreviewing(true);
      if (config.sound === 'Custom' && config.customSoundUrl) {
        const audio = new Audio(config.customSoundUrl);
        audio.volume = Math.min(1, (config.volume / 100) * 1.5);
        audio.onended = () => setIsPreviewing(false);
        audio.play().catch(e => console.error("Preview blocked", e));
        previewAudioRef.current = audio;
      } else {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const vol = (config.volume / 100) * 1.5;
        
        switch(config.sound) {
          case AlarmSound.SIREN:
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1600, audioCtx.currentTime + 0.4);
            osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.8);
            gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(vol * 2.5, audioCtx.currentTime + 0.2);
            break;
          case AlarmSound.RADAR:
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1760, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(3520, audioCtx.currentTime + 0.8);
            gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(vol * 2.5, audioCtx.currentTime + 0.1);
            break;
          case AlarmSound.CYBER:
            osc.type = 'square';
            osc.frequency.setValueAtTime(1500, audioCtx.currentTime);
            osc.frequency.setValueAtTime(500, audioCtx.currentTime + 0.2);
            osc.frequency.setValueAtTime(2000, audioCtx.currentTime + 0.4);
            osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.6);
            gain.gain.setValueAtTime(vol * 1.8, audioCtx.currentTime);
            break;
          case AlarmSound.PULSE:
            osc.type = 'square';
            osc.frequency.setValueAtTime(3000, audioCtx.currentTime);
            gain.gain.setValueAtTime(vol * 2.0, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.01, audioCtx.currentTime + 0.1);
            gain.gain.setValueAtTime(vol * 2.0, audioCtx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.01, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(vol * 2.0, audioCtx.currentTime + 0.4);
            gain.gain.setValueAtTime(0.01, audioCtx.currentTime + 0.5);
            break;
          case AlarmSound.ENERGY:
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(60, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(6000, audioCtx.currentTime + 0.8);
            gain.gain.setValueAtTime(0.01, audioCtx.currentTime);
            gain.gain.linearRampToValueAtTime(vol * 2.5, audioCtx.currentTime + 0.4);
            break;
          default:
            osc.type = 'square';
            osc.frequency.setValueAtTime(2040, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1020, audioCtx.currentTime + 0.4);
            gain.gain.setValueAtTime(vol * 1.5, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
            break;
        }

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        setTimeout(() => {
          osc.stop();
          audioCtx.close();
          setIsPreviewing(false);
        }, 1000);
      }
    };

  return (
    <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="p-6 pb-32 space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-slate-900 border border-slate-800 rounded-xl"><ChevronRight size={20} className="rotate-180" /></button>
          <h2 className="text-xl font-bold">{t.alarmSettings}</h2>
        </div>
        <button 
          onClick={togglePreview}
          className={cn(
            "p-3 rounded-xl transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest",
            isPreviewing ? "bg-accent text-black accent-glow" : "bg-slate-900 text-slate-400 border border-slate-800"
          )}
        >
          <Volume2 size={16} />
          {isPreviewing ? t.playing : t.testSound}
        </button>
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="audio/mp3,audio/*" 
        className="hidden" 
      />

      <div className="space-y-4">
        {/* Custom Song Selector - More Prominent */}
        <div className="bento-card p-6 space-y-4 border-accent/20 bg-accent/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-accent/20 text-accent rounded-2xl"><Music size={24} /></div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-accent">{t.customAlarm}</p>
                <p className="text-sm font-bold text-white">
                  {config.sound === 'Custom' ? (config.customSoundName || 'Custom File') : t.noCustomSongSelected || 'No Custom Song Selected'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-accent text-black text-[10px] font-bold uppercase tracking-widest rounded-full accent-glow"
            >
              {config.sound === 'Custom' ? t.changeSong : t.pickSong}
            </button>
          </div>
        </div>

        <div className="relative">
          <ToggleRow 
            icon={Bell} 
            label={t.builtInTones} 
            value={config.sound === 'Custom' ? 'Classic' : config.sound} 
            onClick={() => setShowPicker(!showPicker)} 
          />
          
          <AnimatePresence>
            {showPicker && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-2 space-y-2"
              >
                <div className="grid grid-cols-1 gap-2 p-2 bg-slate-950 rounded-2xl border border-slate-800">
                  {Object.values(AlarmSound).map(sound => (
                    <button 
                      key={sound}
                      onClick={() => { setConfig({...config, sound, customSoundUrl: undefined, customSoundName: undefined}); setShowPicker(false); }}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl transition-all",
                        config.sound === sound ? "bg-accent/10 text-accent" : "hover:bg-white/5 text-slate-400"
                      )}
                    >
                      <span className="text-xs font-bold">{sound}</span>
                      {config.sound === sound && <div className="w-2 h-2 bg-accent rounded-full accent-glow" />}
                    </button>
                  ))}
                  
                  <div className="h-px bg-slate-800 my-1 mx-2" />
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-all text-left",
                      config.sound === 'Custom' ? "bg-accent/10 text-accent" : "text-slate-400"
                    )}
                  >
                    <Upload size={16} />
                    <div className="flex-1 overflow-hidden">
                      <span className="text-xs font-bold uppercase tracking-widest block">Pick Custom File</span>
                      {config.sound === 'Custom' && config.customSoundName && (
                        <span className="text-[10px] opacity-60 truncate block">{config.customSoundName}</span>
                      )}
                    </div>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bento-card space-y-4">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>{t.volumeLevel}</span>
            <span className="text-accent">{config.volume}%</span>
          </div>
          <input 
            type="range" 
            className="w-full h-2 accent-accent bg-slate-800 rounded-full appearance-none cursor-pointer" 
            value={config.volume} 
            onChange={e => setConfig({...config, volume: parseInt(e.target.value)})} 
          />
        </div>
        <div className="bento-card space-y-4">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>{t.lowBatteryAlert}</span>
            <span className="text-accent">20% (Fixed)</span>
          </div>
          <input 
            type="range" 
            min="20"
            max="20"
            className="w-full h-2 accent-accent bg-slate-800 rounded-full appearance-none opacity-50 cursor-not-allowed" 
            value={20} 
            disabled
          />
          <p className="text-[9px] text-slate-600 italic">This is fixed at 20% as requested.</p>
        </div>

        <div className="bento-card space-y-4">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>{t.tempWarningLevel}</span>
            <span className="text-red-500">{config.tempWarningLevel}°C</span>
          </div>
          <input 
            type="range" 
            min="30"
            max="60"
            className="w-full h-2 accent-red-500 bg-slate-800 rounded-full appearance-none cursor-pointer" 
            value={config.tempWarningLevel} 
            onChange={e => setConfig({...config, tempWarningLevel: parseInt(e.target.value)})} 
          />
          <p className="text-[9px] text-slate-600 italic">{t.overheatThreshold}</p>
        </div>

        <div className="bento-card space-y-4">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
            <span>Battery Size / बैटरी क्षमता</span>
            <button 
              onClick={() => {
                setCustomCapacityInput((config.batteryCapacity || 5000).toString());
                setIsCapacityDialogOpen(true);
              }}
              className="px-3 py-1 bg-[#00FF88]/10 border border-[#00FF88]/30 text-[#00FF88] hover:bg-[#00FF88]/20 active:scale-95 text-[10px] font-black font-mono uppercase tracking-widest rounded-lg flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(0,255,136,0.05)] cursor-pointer"
            >
              <span className="text-white text-xs">{config.batteryCapacity || 5000}</span>
              <span className="bg-[#00FF88] text-black font-extrabold px-1.5 py-0.5 rounded text-[8px] animate-pulse">SET</span>
            </button>
          </div>
          <input 
            type="range" 
            min="2000"
            max="10000"
            step="100"
            className="w-full h-2 accent-accent bg-slate-800 rounded-full appearance-none cursor-pointer" 
            value={config.batteryCapacity || 5000} 
            onChange={e => setConfig({...config, batteryCapacity: parseInt(e.target.value)})} 
          />
          <p className="text-[9px] text-slate-600 italic">Configure your device battery size to display exact remaining charge. Click SET to enter custom capacity.</p>
        </div>

        <SettingsRow icon={Repeat} label={t.continuousLoop} enabled={config.repeat} onToggle={() => setConfig({...config, repeat: !config.repeat})} />
        <SettingsRow icon={Mic} label={t.voiceAlerts} enabled={config.voiceAlert} onToggle={() => setConfig({...config, voiceAlert: !config.voiceAlert})} />
        <SettingsRow icon={Activity} label="Vibrate with Alarm / अलार्म के साथ कंपन (वाइब्रेशन)" enabled={config.vibrate} onToggle={() => setConfig({...config, vibrate: !config.vibrate})} />
        

        
        <div className="bento-card space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.alarmColor}</h3>
          <div className="flex gap-4 justify-between">
            {['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#00FF88'].map(color => (
              <button
                key={color}
                onClick={() => setConfig({...config, alarmColor: color})}
                className={cn(
                  "w-10 h-10 rounded-full border-2 transition-all",
                  config.alarmColor === color ? "border-white scale-110 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      <GoogleAdMob slot={getAdUnitId('banner')} />

      {/* Custom Battery Capacity Input Dialog Modal */}
      <AnimatePresence>
        {isCapacityDialogOpen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[120] flex items-center justify-center p-6">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-[325px] text-center space-y-5 shadow-2xl shadow-black/90"
            >
              <div className="space-y-1">
                <div className="mx-auto w-12 h-12 bg-[#00FF88]/10 border border-[#00FF88]/20 rounded-2xl flex items-center justify-center text-[#00FF88] mb-2 shadow-[0_0_15px_rgba(0,255,136,0.1)]">
                  <Zap size={22} className="animate-bounce" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Set Capacity / क्षमता</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none">Enter Battery Size (mAh)</p>
              </div>

              <div className="relative">
                <input 
                  type="number"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  className="w-full bg-slate-950 border border-white/10 focus:border-[#00FF88] text-center font-mono text-2xl font-black rounded-2xl py-3 text-white placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-[#00FF88] transition-all"
                  placeholder="5000"
                  value={customCapacityInput}
                  onChange={e => setCustomCapacityInput(e.target.value.replace(/[^0-9]/g, ''))}
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">mAh</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCapacityDialogOpen(false)}
                  className="py-3 bg-white/5 hover:bg-white/10 text-slate-400 font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 border border-white/5 cursor-pointer"
                >
                  Cancel / रद्द
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseInt(customCapacityInput);
                    if (parsed && parsed >= 500 && parsed <= 25000) {
                      setConfig({ ...config, batteryCapacity: parsed, hasFetchedPhysicalCapacity: true });
                      setIsCapacityDialogOpen(false);
                    } else {
                      alert("Please enter a valid battery size between 500 mAh and 25000 mAh.");
                    }
                  }}
                  className="py-3 bg-[#00FF88] text-black hover:brightness-110 font-extrabold text-[10px] uppercase tracking-widest rounded-xl shadow-[0_3px_15px_rgba(0,255,136,0.25)] transition-all active:scale-95 cursor-pointer"
                >
                  OK / सेट करें
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SecurityScreen({ onBack, t }: any) {
  const [showPrivacy, setShowPrivacy] = useState(false);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-8 pb-32 relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-slate-900 border border-slate-800 rounded-xl"><ChevronRight size={20} className="rotate-180" /></button>
          <h2 className="text-xl font-bold">{t.appSecurity}</h2>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bento-card border-accent/30 bg-accent/5">
          <div className="flex items-center gap-4 text-accent">
            <Shield size={24} className="accent-glow" />
            <div>
              <p className="font-bold text-sm">{t.safeGuardActive}</p>
              <p className="text-[10px] opacity-60">{t.coreProtectionLocked}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bento-card border-accent/20">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-accent/20 text-accent rounded-xl"><Zap size={20} /></div>
              <span className="font-bold text-sm tracking-tight">{t.chargingTheftAlarm}</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent">{t.alwaysOn}</span>
          </div>
        </div>

        <div className="divider opacity-10 my-4" />

        <div className="bento-card bg-slate-900/50">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-4">{t.verificationLayer}</h3>
          <div className="flex items-center gap-4 text-slate-400">
            <Lock size={16} />
            <span className="text-xs font-medium">{t.verificationBypassed}</span>
          </div>
        </div>

        {/* Dynamic Privacy Card compliant with Google Play Policy */}
        <div className="bento-card bg-slate-900/50 border border-slate-800">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-3 flex items-center gap-2">
            <ShieldCheck size={14} className="text-accent" /> Privacy & Policy / गोपनीयता नीति
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-4">
            Our app processes security alerts and charging statuses locally. We collect no personal identifiable profiles.
          </p>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowPrivacy(true)}
              className="text-xs font-bold text-accent hover:underline flex items-center gap-1 bg-accent/10 px-3 py-1.5 rounded-lg border border-accent/20 cursor-pointer"
            >
              <Info size={13} /> View Policy
            </button>
            <a 
              href="/privacy.html" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-xs text-slate-300 hover:text-white hover:underline flex items-center gap-1 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700"
            >
              <Share2 size={13} /> Play Store Link
            </a>
          </div>
        </div>

        <GoogleAdMob slot={getAdUnitId('banner')} />
      </div>

      {/* Modern sliding overlay modal for on-device privacy readability */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4">
          <motion.div 
            initial={{ y: 100, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }} 
            className="bg-slate-950 border border-slate-800 w-full max-w-md max-h-[75vh] rounded-2xl p-6 overflow-y-auto space-y-6 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Shield size={18} className="text-accent" /> Privacy & Permissions
              </h3>
              <button 
                onClick={() => setShowPrivacy(false)} 
                className="text-xs bg-slate-800 hover:bg-slate-755 text-white px-3 py-1 rounded-full border border-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-4 leading-relaxed">
              <section className="space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-accent border-l-2 border-accent pl-2">Data Protection Minimization</h4>
                <p>
                  <strong>No Personal Data Harvesting:</strong> We do NOT collect, read, or upload any personal demographics, real email directories, SIM card values, contacts, or real GPS coordinates.
                </p>
                <p>
                  <strong>Local Persistence:</strong> Configuration settings, alarms log history, and custom presets compile fully client-side and rest in standard Sandboxed Android Storage.
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-accent border-l-2 border-accent pl-2">Why we require Android permissions</h4>
                <div className="space-y-2">
                  <p><strong>• FOREGROUND_SERVICE (Special Use):</strong> Resolves state changes when the app goes background, rendering responsive alerts dynamically.</p>
                  <p><strong>• SYSTEM_ALERT_WINDOW:</strong> Renders secure disarm keypads instantly on top of device lockscreens during alarms.</p>
                  <p><strong>• DISABLE_KEYGUARD:</strong> Assists instant overlay inputs without safety bypass collisions.</p>
                  <p><strong>• WAKE_LOCK:</strong> Preserves responsive alert routines by keeping sensors tracking continuously.</p>
                  <p><strong>• RECEIVE_BOOT_COMPLETED:</strong> Revives sentinel protection immediately upon hardware power restarts.</p>
                </div>
              </section>

              <section className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                <h4 className="font-bold text-white text-xs uppercase tracking-wider text-accent border-l-2 border-accent pl-2">गोपनीयता नीति (Hindi)</h4>
                <p className="text-slate-400 font-sans">
                  <strong>कोई व्यक्तिगत डेटा संग्रह नहीं:</strong> यह ऐप आपका नाम, ईमेल, संपर्क, या वास्तविक लोकेशन आदि किसी भी प्रकार के व्यक्तिगत डेटा का संग्रह अथवा स्थानांतरण बिल्कुल नहीं करता है।
                </p>
                <p className="text-slate-400 font-sans">
                  <strong>स्थानीय संग्रहण:</strong> अलार्म पासवर्ड (PIN), सेटिंग्स एवं इतिहास केवल आपके स्वयं के डिवाइस पर सुरक्षित रहते हैं।
                </p>
              </section>

              <div className="text-[10px] text-slate-500 text-center pt-4 border-t border-slate-800/80">
                Authorized Controller Support: jitu1199pal@gmail.com
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function HistoryScreen({ logs, setLogs, chargingCycles, onBack, t }: any) {
  const formatDuration = (sec: number) => {
    if (sec < 60) return `${sec}s`;
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    if (mins < 60) return `${mins}m ${secs > 0 ? secs + 's' : ''}`;
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins > 0 ? remMins + 'm' : ''}`;
  };

  const clearHistory = () => {
    if (window.confirm("Do you want to reset all charging sessions history? / क्या आप चार्जिंग इतिहास मिटाना चाहते हैं?")) {
      setLogs([]);
      localStorage.setItem('chargingHistory', JSON.stringify([]));
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-slate-900 border border-slate-800 rounded-xl"><ChevronRight size={20} className="rotate-180" /></button>
          <h2 className="text-2xl font-bold tracking-tight">{t.recentSessions}</h2>
        </div>
        <div className="p-2 bg-accent/10 text-accent rounded-lg"><History size={20} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bento-card p-4 flex flex-col items-center justify-center bg-slate-900/30">
          <p className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Total Sessions</p>
          <p className="text-2xl font-black text-accent mt-1">{chargingCycles}</p>
        </div>
        <button 
          onClick={clearHistory}
          className="bento-card p-4 flex flex-col items-center justify-center bg-red-500/5 border border-red-500/20 hover:bg-red-500/10 transition-all font-bold text-[10px] uppercase tracking-widest text-red-400"
        >
          <span>Reset History</span>
          <span className="text-[9px] opacity-60 mt-1">डेटा साफ़ करें</span>
        </button>
      </div>

      <div className="space-y-4">
        {logs.length === 0 ? (
          <div className="text-center p-12 bg-slate-900/10 border border-slate-800/40 rounded-3xl">
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">No history recorded yet</p>
            <p className="text-[10px] text-slate-600 mt-2">Connect your charger to start automatic recording!</p>
          </div>
        ) : (
          logs.map((log: any, i: number) => {
            const isFull = log.type === 'full';
            return (
              <div key={log.id || i} className="bento-card flex justify-between items-center bg-slate-900/30 border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "p-3 rounded-2xl",
                    isFull ? "bg-accent/10 text-accent" : "bg-blue-500/10 text-blue-500"
                  )}>
                    <Zap size={20} className={cn(isFull && "animate-pulse")} />
                  </div>
                  <div>
                    <p className="font-bold text-sm">
                      {isFull ? (t.fullCharge || 'Full Charge') : (t.partialCharge || 'Partial Charge')}
                    </p>
                    <p className="text-[10px] text-slate-500">{log.date} • {formatDuration(log.duration)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("font-mono font-bold text-xs")}>
                    {log.startLevel}% → {log.endLevel}%
                  </p>
                  <p className="text-[9px] text-slate-600 uppercase tracking-widest">{t.logged}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <GoogleAdMob slot={getAdUnitId('banner')} />
    </motion.div>
  );
}

function HealthScreen({ battery, batteryCapacity, chargingCycles, onBack, t }: any) {
  const tips = [
    {
      title: t.step1,
      tip: t.step2,
      detail: t.step3,
      icon: Battery,
      stat: t.optimal
    },
  ];

  const currentTips = [
    {
      title: t.rule2080Title || "The 20-80 Rule",
      tip: t.rule2080Tip || "Keep battery between 20% and 80% for longevity.",
      detail: t.rule2080Detail || "Lithium-ion batteries experience less stress when kept in this range.",
      icon: Battery,
      stat: t.optimal
    },
    {
      title: t.thermalTitle || "Thermal Management",
      tip: t.thermalTip || "Avoid fast charging if the device is already hot.",
      detail: t.thermalDetail || "Heat is the #1 enemy of battery health.",
      icon: Thermometer,
      stat: t.healthy
    }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-8 pb-32 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 bg-slate-900 border border-slate-800 rounded-xl"><ChevronRight size={20} className="rotate-180" /></button>
          <h2 className="text-2xl font-bold tracking-tight">{t.statusHealth}</h2>
        </div>
        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Activity size={20} /></div>
      </div>

      <div className="bento-card h-56 flex flex-col items-center justify-center relative overflow-hidden bg-gradient-to-br from-slate-900 to-black">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#22c55e20,transparent_70%)]"></div>
        <div className="relative">
          <svg className="w-32 h-32 transform -rotate-90">
            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-accent" strokeDasharray={364.4} strokeDashoffset={364.4 * (1 - 0.98)} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-white">98%</span>
            <span className="text-[10px] text-accent font-bold uppercase tracking-widest">{t.excellent}</span>
          </div>
        </div>
        <p className="mt-4 text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold">{t.estimatedHealth}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatusHealthItem label="Temp / तापमान" value={`${battery.temperature}°C`} sub={battery.temperature > 39 ? '🔥 Hot / गर्म' : '❄️ Cool / सामान्य'} />
        <StatusHealthItem label="Capacity / क्षमता" value={`${batteryCapacity} mAh`} sub={`Act: ${Math.round(battery.level * batteryCapacity)} mAh`} />
        <StatusHealthItem label="Cycles / चक्र" value={`${chargingCycles}`} sub="Total Plugs Count" />
        <StatusHealthItem label="Tech / तकनीक" value="Li-Polymer" sub="Smart Shield" />
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{t.smartBatteryTips}</h3>
        <div className="space-y-3">
          {currentTips.map((item, i) => (
            <TipCard key={i} item={item} />
          ))}
        </div>
      </div>

      <GoogleAdMob slot={getAdUnitId('banner')} />
    </motion.div>
  );
}

function TipCard({ item }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = item.icon;

  return (
    <div 
      onClick={() => setIsOpen(!isOpen)}
      className={cn(
        "p-4 rounded-2xl border transition-all cursor-pointer",
        isOpen ? "bg-slate-900 border-accent/30" : "bg-slate-900/50 border-slate-800 hover:border-slate-700"
      )}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "p-2 rounded-xl transition-colors",
          isOpen ? "bg-accent text-black" : "bg-slate-800 text-accent"
        )}>
          <Icon size={18} />
        </div>
        <div className="flex-1">
          <p className={cn("text-xs font-bold transition-colors", isOpen ? "text-white" : "text-slate-400")}>{item.title}</p>
          {!isOpen && <p className="text-[10px] text-slate-500 line-clamp-1">{item.tip}</p>}
        </div>
        <motion.div animate={{ rotate: isOpen ? 90 : 0 }} className="text-slate-600">
          <ChevronRight size={16} />
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-4 space-y-3">
              <p className="text-[11px] text-slate-400 leading-relaxed italic">"{item.tip}"</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">{item.detail}</p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 rounded-full">
                <Activity size={10} className="text-accent" />
                <span className="text-[10px] font-bold text-accent uppercase tracking-widest">{item.stat}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusHealthItem({ label, value, sub }: any) {
  return (
    <div className="bento-card flex flex-col items-center justify-center p-6 space-y-1">
      <p className="text-[10px] uppercase tracking-widest text-slate-600 font-bold">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-[10px] text-accent uppercase font-bold tracking-tighter">{sub}</p>
    </div>
  );
}

function AlarmOverlay({ battery, config, security, audioContext, reason, onStop, t }: { battery: BatteryState, config: AlarmConfig, security: SecurityConfig, audioContext: AudioContext | null, reason: 'theft' | 'full' | 'low' | 'test' | null, onStop: (disarm: boolean, openWithAd?: boolean) => void, t: any }) {
  const [isSwiped, setIsSwiped] = useState(false);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keep a stable ref of onStop to prevent standard React re-render loops from resetting our auto-disarm timers
  const onStopRef = useRef(onStop);
  useEffect(() => {
    onStopRef.current = onStop;
  }, [onStop]);

  const handleSnooze = () => {
    setIsSnoozed(true);
    setTimeout(() => {
      setIsSnoozed(false);
    }, 300000); // 5 minute snooze
  };

  useEffect(() => {
    if (reason === 'theft') {
      const timer = setTimeout(() => {
        console.log("Automatically disarming theft alarm after 3 seconds");
        if (onStopRef.current) {
          onStopRef.current(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [reason]);

  useEffect(() => {
    // AUTO-STOP Logic
    
    // Only theft and test alarms can be auto-stopped by plugging back in
    if (battery.charging && (reason === 'theft' || reason === 'test')) {
       if (reason === 'theft') {
         if (onStopRef.current) onStopRef.current(true);
       } else {
         if (onStopRef.current) onStopRef.current(false);
       }
    }

    // 98% (full) alarm auto stops as soon as the charger is unplugged
    if (reason === 'full' && !battery.charging) {
       console.log("98% Full alarm auto stops because charger was unplugged");
       if (onStopRef.current) onStopRef.current(true);
    }
  }, [battery.charging, reason]);

  useEffect(() => {
    if (isSnoozed || isSwiped) return;

    const isTheft = reason === 'theft' || reason === 'test';
    const isFull = reason === 'full';
    const isLow = reason === 'low';

    // Voice Alert Announcement
    if (config.voiceAlert && typeof window !== 'undefined' && window.speechSynthesis && 'SpeechSynthesisUtterance' in window) {
      const text = isTheft ? t.chargerDisconnected : (isFull ? t.chargingAchieved : (isLow ? t.batteryExhausted : t.systemAlert));
      
      const msg = new window.SpeechSynthesisUtterance(text);
      msg.rate = 0.9;
      msg.pitch = 1.1;
      msg.volume = config.volume / 100;
      window.speechSynthesis.speak(msg);
    }

    // If custom sound is selected, use HTML5 Audio
    if (config.sound === 'Custom' && config.customSoundUrl) {
      const audio = new Audio(config.customSoundUrl);
      audio.loop = config.repeat;
      audio.volume = Math.min(1, (config.volume / 100) * 1.5); // Boost volume
      audio.play().catch(e => {
        console.error("Audio playback failed", e);
        // Play fallback beep if custom fails
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        o.stop(ctx.currentTime + 1);
      });

      const flashInterval = setInterval(() => {
        document.body.style.backgroundColor = document.body.style.backgroundColor === 'rgb(2, 6, 23)' ? (config.alarmColor || 'rgb(239, 68, 68)') : 'rgb(2, 6, 23)';
      }, 500);

      return () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        audio.pause();
        audio.src = '';
        clearInterval(flashInterval);
        document.body.style.backgroundColor = 'rgb(2, 6, 23)';
      };
    }

    // Fallback to Web Audio API for default alarm sound
    const audioCtx = audioContext || new (window.AudioContext || (window as any).webkitAudioContext)();
    let oscillator: OscillatorNode | null = null;
    let gainNode: GainNode | null = null;

    const startAlarm = async () => {
      if (isSnoozed || isSwiped) return;
      
      // Force resume even if suspended
      if (audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
        } catch (e) {
          console.error("Context resume failed", e);
        }
      }

      oscillator = audioCtx.createOscillator();
      gainNode = audioCtx.createGain();
      
      const vol = (config.volume / 100) * 1.5;

      switch(config.sound) {
        case AlarmSound.SIREN:
          oscillator.type = 'sawtooth';
          const now = audioCtx.currentTime;
          oscillator.frequency.setValueAtTime(800, now);
          oscillator.frequency.exponentialRampToValueAtTime(1600, now + 0.4);
          oscillator.frequency.exponentialRampToValueAtTime(800, now + 0.8);
          gainNode.gain.setValueAtTime(0.01, now);
          gainNode.gain.exponentialRampToValueAtTime(vol * 3.0, now + 0.2);
          break;
        case AlarmSound.RADAR:
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(3520, audioCtx.currentTime + 0.8);
          gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(vol * 3.0, audioCtx.currentTime + 0.1);
          break;
        case AlarmSound.CYBER:
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(1500, audioCtx.currentTime);
          oscillator.frequency.setValueAtTime(500, audioCtx.currentTime + 0.2);
          oscillator.frequency.setValueAtTime(2000, audioCtx.currentTime + 0.4);
          oscillator.frequency.setValueAtTime(800, audioCtx.currentTime + 0.6);
          gainNode.gain.setValueAtTime(vol * 2.2, audioCtx.currentTime);
          break;
        case AlarmSound.PULSE:
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(3000, audioCtx.currentTime);
          gainNode.gain.setValueAtTime(vol * 2.5, audioCtx.currentTime);
          gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime + 0.1);
          gainNode.gain.setValueAtTime(vol * 2.5, audioCtx.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime + 0.3);
          gainNode.gain.setValueAtTime(vol * 2.5, audioCtx.currentTime + 0.4);
          gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime + 0.5);
          break;
        case AlarmSound.ENERGY:
          oscillator.type = 'sawtooth';
          oscillator.frequency.setValueAtTime(60, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(6000, audioCtx.currentTime + 0.8);
          gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
          gainNode.gain.linearRampToValueAtTime(vol * 3.0, audioCtx.currentTime + 0.4);
          break;
        default:
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(2040, audioCtx.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(1020, audioCtx.currentTime + 0.4);
          gainNode.gain.setValueAtTime(vol * 2.0, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
          break;
      }

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.8);
    };

    // Global listener to unlock audio context on first screen touch of the overlay
    const unlockAudio = () => {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    };
    window.addEventListener('touchstart', unlockAudio);
    window.addEventListener('click', unlockAudio);

    const soundInterval = setInterval(startAlarm, 900);
    const flashInterval = setInterval(() => {
      document.body.style.backgroundColor = document.body.style.backgroundColor === 'rgb(2, 6, 23)' ? (config.alarmColor || 'rgb(239, 68, 68)') : 'rgb(2, 6, 23)';
    }, 500);

    return () => {
      window.removeEventListener('touchstart', unlockAudio);
      window.removeEventListener('click', unlockAudio);
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      clearInterval(soundInterval);
      clearInterval(flashInterval);
      if (oscillator) {
        try { (oscillator as any).stop(); } catch(e) {}
      }
      // If we used a shared context, don't close it
      if (!audioContext) {
        audioCtx.close();
      }
      document.body.style.backgroundColor = 'rgb(2, 6, 23)';
    };
  }, [config.sound, config.customSoundUrl, config.repeat, config.volume, isSnoozed, config.alarmColor, isSwiped, config.voiceAlert, battery.charging, battery.level, config.targetPercentage, security.theftAlarm, config.lowBatteryPercentage, audioContext]);

  if (isSnoozed) {
    return (
      <div className="absolute inset-0 bg-slate-950 z-[110] flex flex-col items-center justify-center p-8 space-y-6">
        {/* 📱 Open APK Button (30s Ad Trigger) */}
        <div className="absolute top-6 left-0 right-0 px-8 flex justify-center z-[120]">
          <button 
            onClick={() => onStop(true, true)}
            className="w-full max-w-[320px] bg-gradient-to-r from-accent to-emerald-400 text-black font-black uppercase tracking-widest py-3 px-6 rounded-full text-xs shadow-lg shadow-accent/25 transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 animate-bounce animate-infinite"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>APK OPEN</span>
          </button>
        </div>

        <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center">
          <Moon size={40} className="text-slate-500" />
        </div>
        <p className="text-xl font-bold">{t.snooze}</p>
        <p className="text-slate-500 text-sm text-center">We'll alert you again in 5 minutes if battery condition persists.</p>
        <button onClick={() => setIsSnoozed(false)} className="px-8 py-3 bg-accent text-black font-bold rounded-full accent-glow">Resume Alarm</button>
        <button onClick={() => onStop(false)} className="text-slate-600 text-xs uppercase tracking-widest font-bold">Stop Monitoring</button>
      </div>
    );
  }

  const isTheft = reason === 'theft' || reason === 'test';
  const isFull = reason === 'full';
  const isLow = reason === 'low';

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 bg-slate-950 z-[100] flex flex-col items-center justify-between py-24 px-8"
    >
      <div className="text-center space-y-6 w-full flex flex-col items-center">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }} 
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="mx-auto w-24 h-24 bg-accent rounded-[2.5rem] flex items-center justify-center mb-8 accent-glow"
        >
          {isTheft ? <Shield size={48} className="text-black" /> : <Bell size={48} className="text-black" />}
        </motion.div>
        
        <div className="space-y-4">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">
            {isFull ? t.chargingAchieved : (isTheft ? t.securityBreach : (isLow ? t.criticalLow : t.systemAlert))}
          </h1>
          <p className="text-accent text-sm font-bold uppercase tracking-[0.3em] animate-pulse">
            {isFull ? t.pleaseTurnOff : (isTheft ? t.chargerDisconnected : (isLow ? t.batteryExhausted : t.systemAlert))}
          </p>
          {isTheft && !isLow && !isFull && (
            <p className="text-white text-xs font-bold uppercase tracking-widest mt-2">
              {t.reconnectImmediately}
            </p>
          )}
        </div>
        
        <div className="pt-8 text-center flex flex-col items-center w-full">
          {/* 📱 Open APK Button (Ad Trigger) placed just above the percentage */}
          <button 
            onClick={() => onStop(true, true)}
            className="mb-6 w-full max-w-[280px] bg-gradient-to-r from-accent to-emerald-400 text-black font-black uppercase tracking-widest py-3.5 px-6 rounded-full text-xs shadow-lg shadow-accent/25 transition-all duration-200 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 animate-bounce animate-infinite cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span>APK OPEN</span>
          </button>

          <p className="text-7xl font-black text-white tracking-tighter">{Math.round(battery.level * 100)}<span className="text-2xl text-slate-500">%</span></p>
          <div className="flex items-center justify-center gap-2 mt-4 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl">
             <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
             <p className="text-[10px] text-slate-300 uppercase tracking-[0.2em] font-bold">
               {isTheft ? t.reconnectImmediately : (isFull ? t.pleaseTurnOff : t.unplugSafely)}
             </p>
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col items-center space-y-6">
        {/* Glowing live guidance indicator */}
        {(reason === 'full' || reason === 'low') && (
          <div className="w-full max-w-[320px] p-4 rounded-2xl border text-center transition-all duration-300 bg-red-500/10 border-red-500/20 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <p className="text-sm font-black uppercase tracking-wider text-red-400">
              {reason === 'low' ? "Please connect charger" : "Please remove charger"}
            </p>
            <p className="text-[11px] font-sans font-bold text-slate-400 mt-1">
              {reason === 'low' ? "कृपया चार्जर कनेक्ट करें" : "कृपया चार्जर अनप्लग करें"}
            </p>
          </div>
        )}

        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[320px] px-4 py-2.5 bg-red-600 rounded-2xl text-white text-[11px] font-extrabold uppercase tracking-wider text-center shadow-[0_4px_16px_rgba(220,38,38,0.3)] animate-bounce"
          >
            {errorMessage}
          </motion.div>
        )}

        {/* Premium Pulsing Disable Alarm Button - Render ONLY on 20% Low Battery Alarm ('low') */}
        {reason === 'low' && (
          <div className="w-full flex justify-center">
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => {
                setErrorMessage(null);
                onStop(true); // Manual button disarms monitoring and triggers ads directly
              }}
              className="w-full max-w-[320px] py-4 px-8 rounded-2xl font-black text-sm uppercase tracking-wider text-center transition-all duration-300 shadow-xl border cursor-pointer bg-gradient-to-r from-emerald-500 to-teal-400 border-emerald-500/20 text-black shadow-emerald-500/10 hover:from-emerald-400 hover:to-teal-300 animate-pulse"
            >
              Disable Alarm
            </motion.button>
          </div>
        )}

        {reason !== 'low' && reason !== 'full' && (
          <div className="flex gap-4">
            <button 
              onClick={handleSnooze}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-white transition-all active:scale-95 cursor-pointer"
            >
              <Moon size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t.snooze}</span>
            </button>
            
            <button 
              onClick={() => onStop(false)}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 border border-slate-800 rounded-full text-accent hover:bg-accent hover:text-black transition-all active:scale-95 cursor-pointer"
            >
              <Settings size={16} />
              <span className="text-[10px] font-bold uppercase tracking-widest">{t.changeGoal}</span>
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 text-slate-600 bg-slate-900 px-4 py-2 rounded-full border border-slate-800">
           <Zap size={14} className="text-accent" />
           <span className="text-[10px] font-bold uppercase tracking-widest">{t.autoMonitoring}</span>
        </div>
      </div>
    </motion.div>
  );
}

// Helpers
function SettingsRow({ icon: Icon, label, enabled, onToggle }: any) {
  return (
    <div className="flex items-center justify-between p-4 bento-card">
      <div className="flex items-center gap-4">
          <div className="p-2 bg-slate-800 rounded-xl text-accent"><Icon size={20} /></div>
          <span className="font-bold text-sm tracking-tight">{label}</span>
      </div>
      <button 
        onClick={onToggle}
        className={cn(
          "w-12 h-6 rounded-full p-1 transition-all",
          enabled ? "bg-accent" : "bg-slate-800"
        )}
      >
        <div className={cn("h-4 w-4 rounded-full transition-all", enabled ? "bg-black translate-x-6" : "bg-slate-600 translate-x-0")} />
      </button>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, value, onClick }: any) {
  return (
    <div onClick={onClick} className="flex items-center justify-between p-4 bento-card cursor-pointer hover:bg-slate-800/80 transition-colors">
      <div className="flex items-center gap-4">
          <div className="p-2 bg-slate-800 rounded-xl text-accent"><Icon size={20} /></div>
          <span className="font-bold text-sm tracking-tight">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-[10px] font-bold uppercase tracking-widest">{value}</span>
        <ChevronRight size={14} />
      </div>
    </div>
  );
}
