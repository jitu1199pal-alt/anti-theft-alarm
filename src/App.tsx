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
  Languages,
  Users,
  CreditCard,
  Gift,
  Share2
} from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { Screen, Theme, BatteryState, AlarmConfig, SecurityConfig, AlarmSound } from './types';
import { useBattery } from './lib/battery';
import { cn, formatTime } from './lib/utils';
import { BatteryIndicator, QuickPreset } from './components/BatteryIndicator';
import { translations, Language } from './translations';
import { auth, db } from './firebase';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { GoogleAdSense } from './components/GoogleAdSense';

export default function App() {
  const [screen, setScreen] = useState<Screen>(Screen.SPLASH);
  const [theme, setTheme] = useState<Theme>('dark');
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('language');
      return (saved as Language) || 'en';
    } catch {
      return 'en';
    }
  });
  const t = translations[lang] || translations.en;
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
  const [showTempWarning, setShowTempWarning] = useState(false);
  const [targetReachedAlerted, setTargetReachedAlerted] = useState(false);
  const [alarmReason, setAlarmReason] = useState<'theft' | 'full' | 'low' | 'test' | null>(null);
  const wakeLockRef = useRef<any>(null);

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

    // Android Back Button Handling
    const setupBackButton = async () => {
      if (Capacitor.isNativePlatform()) {
        CapApp.addListener('backButton', ({ canGoBack }) => {
          if (screen === Screen.HOME || screen === Screen.SPLASH || screen === Screen.LOCK) {
            CapApp.exitApp();
          } else {
            setScreen(Screen.HOME);
          }
        });
      }
    };
    setupBackButton();

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
  }, []);

  // Background Audio Heartbeat to prevent suspension
  useEffect(() => {
    if (isMonitoring && mainAudioContext && audioUnlocked) {
      const osc = mainAudioContext.createOscillator();
      const gain = mainAudioContext.createGain();
      gain.gain.value = 0.001; // Nearly silent
      osc.connect(gain);
      gain.connect(mainAudioContext.destination);
      osc.start();
      return () => {
        try { osc.stop(); } catch(e) {}
      };
    }
  }, [isMonitoring, mainAudioContext, audioUnlocked]);

  const [alarmConfig, setAlarmConfig] = useState<AlarmConfig>(() => {
    const saved = localStorage.getItem('alarmConfig');
    if (saved) return JSON.parse(saved);
    return {
      targetPercentage: 80,
      lowBatteryPercentage: 20,
      enabled: true,
      sound: AlarmSound.DEFAULT,
      volume: 80,
      repeat: false,
      voiceAlert: true,
      alarmColor: '#ef4444',
      tempWarningLevel: 40,
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
  
  // Persistence Sync
  useEffect(() => {
    localStorage.setItem('isMonitoring', JSON.stringify(isMonitoring));
  }, [isMonitoring]);

  useEffect(() => {
    localStorage.setItem('alarmConfig', JSON.stringify(alarmConfig));
  }, [alarmConfig]);

  useEffect(() => {
    localStorage.setItem('securityConfig', JSON.stringify(securityConfig));
  }, [securityConfig]);
  
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
      const timer = setTimeout(() => setScreen(Screen.HOME), 1000);
      return () => clearTimeout(timer);
    }
  }, [screen]);

  // Alert Monitor Logic
  useEffect(() => {
    if (!isMonitoring) {
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

    // 2. Low Battery Alarm (Critical Level)
    if (currentLevelPct <= alarmConfig.lowBatteryPercentage && !battery.charging) {
      if (screen !== Screen.LOCK) {
        setAlarmReason('low');
        setScreen(Screen.LOCK);
      }
    }

    // 3. Theft Alarm (Transition from Charging to Unplugged)
    if (securityConfig.theftAlarm && wasCharging && !battery.charging) {
      if (screen !== Screen.LOCK) {
        setAlarmReason('theft');
        setScreen(Screen.LOCK);
      }
    }

    setWasCharging(battery.charging);
  }, [battery.level, battery.charging, isMonitoring, alarmConfig.targetPercentage, alarmConfig.lowBatteryPercentage, securityConfig.theftAlarm, wasCharging, screen]);

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
          isNative={isNative} 
          lang={lang} 
          setLang={setLang} 
          t={t}
          onShare={async () => {
             if (user) {
               await Share.share({
                 title: t.appName,
                 text: t.shareAppText || `Protect your phone with ${t.appName}!`,
                 url: 'https://ais-dev-uwisz5o2rl7yb3zku2e7aa-142106032593.asia-east1.run.app',
                 dialogTitle: t.shareDialogTitle || 'Share with friends',
               });
             }
          }}
        />
      );
      case Screen.ALARM_SETTINGS: return <AlarmSettings config={alarmConfig} setConfig={setAlarmConfig} onBack={() => setScreen(Screen.HOME)} t={t} />;
      case Screen.SECURITY: return <SecurityScreen onBack={() => setScreen(Screen.HOME)} t={t} />;
      case Screen.HISTORY: return <HistoryScreen onBack={() => setScreen(Screen.HOME)} t={t} />;
      case Screen.HEALTH: return <HealthScreen battery={battery} onBack={() => setScreen(Screen.HOME)} t={t} />;
      case Screen.LOCK: return <AlarmOverlay battery={battery} config={alarmConfig} security={securityConfig} audioContext={mainAudioContext} reason={alarmReason} onStop={(disarm) => { 
      if (disarm) setIsMonitoring(false); 
      setTargetReachedAlerted(true);
      setAlarmReason(null);
      setScreen(Screen.HOME); 
    }} t={t} />;
    default: return <HomeScreen battery={battery} config={alarmConfig} setConfig={setAlarmConfig} isMonitoring={isMonitoring} setMonitoring={setIsMonitoring} setScreen={setScreen} onTest={() => { setAlarmReason('test'); setScreen(Screen.LOCK); }} t={t} />;
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

  return (
    <ErrorBoundary t={t}>
      <div className={cn(
        "relative h-screen w-full max-w-[480px] mx-auto overflow-y-auto transition-colors duration-1000",
        theme === 'dark' ? "bg-black text-white" : "bg-slate-50 text-slate-900",
        theme === 'neon' && "bg-[#0b0c10] text-[#66fcf1]"
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

      {/* Navigation Bar (Mobile Style) */}
      {screen !== Screen.SPLASH && screen !== Screen.LOCK && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-20 neo-blur border-t border-white/5 flex items-center justify-around px-4 pb-4 z-50">
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
        <p className="text-slate-500 text-[10px] tracking-[0.4em] font-bold mt-2 uppercase">{t.coreSystem} v1.0.28</p>
      </div>
    </motion.div>
  );
}

function HomeScreen({ battery, config, setConfig, isMonitoring, setMonitoring, setScreen, audioUnlocked, setAudioUnlocked, audioContext, onTest, isNative, lang, setLang, t, onShare }: any) {
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
        <div className="flex gap-4">
          <button 
            onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
            className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center text-accent"
          >
            <Languages size={18} />
          </button>
          <button onClick={() => setScreen(Screen.ALARM_SETTINGS)} className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-full flex items-center justify-center">
            <Settings size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-4">
        {/* AdSense (Runs for Everyone) */}
        <div className="col-span-12">
          <GoogleAdSense slot="1234567890" />
        </div>

        {/* Status indicator and Master Toggle */}
        <div className="col-span-12 glass-card relative overflow-hidden flex flex-col items-center justify-center p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#00FF8810,transparent_70%)] opacity-50"></div>
          <BatteryIndicator level={battery.level} charging={battery.charging} className="scale-110" />
          
          <div className="mt-8 flex gap-8">
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{t.playing}</p>
              <p className="text-2xl font-bold text-white">{formatTime(battery.chargingTime)}</p>
            </div>
            <div className="w-px h-10 bg-slate-800"></div>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{t.avgTemp}</p>
              <p className="text-2xl font-bold text-white">{battery.temperature}<span className="text-lg text-slate-400 font-medium ml-1">°C</span></p>
            </div>
          </div>
        </div>

        {/* Alarm Threshold */}
        <div className="col-span-12 bento-card flex flex-col justify-between p-6">
           <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-accent/20 rounded-lg text-accent"><Bell size={14} /></div>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{t.goalLevel}</h3>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  min="1" 
                  max="100"
                  placeholder="Set"
                  className="w-16 bg-slate-950 border border-slate-800 rounded-lg py-1 text-center font-mono font-bold text-accent focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50"
                  value={config.targetPercentage}
                  onChange={e => {
                    let val = parseInt(e.target.value);
                    if (isNaN(val)) {
                      setConfig({ ...config, targetPercentage: 0 });
                      return;
                    }
                    if (val > 100) val = 100;
                    if (val < 1) val = 1;
                    setConfig({ ...config, targetPercentage: val });
                  }}
                />
                <span className="text-sm font-bold text-slate-500">%</span>
              </div>
           </div>
           
           <div className="grid grid-cols-6 gap-2 mb-4">
            {[75, 80, 85, 90, 95, 100].map(p => (
              <QuickPreset 
                key={p} 
                value={p} 
                active={config.targetPercentage === p} 
                onClick={() => setConfig({ ...config, targetPercentage: p })} 
              />
            ))}
           </div>

           <div className="flex items-center gap-4">
             <span className="text-[9px] font-bold text-slate-600">1%</span>
             <input 
                type="range" 
                min="1" 
                max="100" 
                className="flex-1 h-1.5 accent-accent bg-slate-800 rounded-full appearance-none cursor-pointer" 
                value={config.targetPercentage} 
                onChange={e => setConfig({ ...config, targetPercentage: parseInt(e.target.value) })} 
              />
             <span className="text-[9px] font-bold text-slate-600">100%</span>
           </div>
        </div>

        {/* Instructions Quick Look */}
        <div className="col-span-12 glass-card p-4 flex items-center justify-between border-accent/20 bg-accent/5">
           <div className="flex items-center gap-3">
             <div className="p-2 bg-accent/20 text-accent rounded-lg"><Info size={16} /></div>
             <div>
               <p className="text-[10px] font-bold uppercase text-accent">{t.howToUse}</p>
               <p className="text-[9px] text-slate-500">{t.step1}</p>
             </div>
           </div>
           <button 
             onClick={() => setScreen(Screen.ALARM_SETTINGS)}
             className="text-[9px] font-black text-accent uppercase underline underline-offset-4"
           >
             {t.settings}
           </button>
        </div>

      {/* Status indicator and Master Toggle */}
        <div className="col-span-12 flex flex-col gap-4 mt-2">
          <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("w-2 h-2 rounded-full", isMonitoring ? "bg-[#00FF88] animate-pulse shadow-[0_0_8px_#00FF88]" : "bg-slate-700")}></div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {isMonitoring ? t.backgroundActive : t.waitingActivation}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-bold text-[#00FF88]">
                <Shield size={12} />
                <span>{t.stayAwake}</span>
              </div>
            </div>
            {isNative && isMonitoring && (
              <p className="text-[8px] text-slate-500 font-medium italic">
                Tip: Keep app open or exclude from Battery Optimization for best results on Android.
              </p>
            )}
          </div>

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
              {audioUnlocked && isMonitoring ? (
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
        <span className="flex items-center gap-2 italic text-slate-600">v1.0.28-{t.stable}</span>
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
            <span className="text-accent">{config.lowBatteryPercentage}%</span>
          </div>
          <input 
            type="range" 
            className="w-full h-2 accent-accent bg-slate-800 rounded-full appearance-none cursor-pointer" 
            value={config.lowBatteryPercentage} 
            onChange={e => setConfig({...config, lowBatteryPercentage: parseInt(e.target.value)})} 
          />
          <p className="text-[9px] text-slate-600 italic">{t.triggerAlarmDischarging}</p>
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

        <SettingsRow icon={Repeat} label={t.continuousLoop} enabled={config.repeat} onToggle={() => setConfig({...config, repeat: !config.repeat})} />
        <SettingsRow icon={Mic} label={t.voiceAlerts} enabled={config.voiceAlert} onToggle={() => setConfig({...config, voiceAlert: !config.voiceAlert})} />
        
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
    </motion.div>
  );
}

function SecurityScreen({ onBack, t }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-8 pb-32">
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
      </div>
    </motion.div>
  );
}

function HistoryScreen({ t }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{t.chargingHistory}</h2>
        <div className="p-2 bg-accent/10 text-accent rounded-lg"><History size={20} /></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bento-card text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{t.weeklyAvg}</p>
            <p className="text-2xl font-bold text-white">1.2h</p>
        </div>
        <div className="bento-card text-center">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">{t.fullCycles}</p>
            <p className="text-2xl font-bold text-accent">14</p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{t.recentSessions}</h3>
        {[
          { date: 'Today, 2:45 PM', level: '100%', duration: '45m', type: 'Full Charge' },
          { date: 'Yesterday, 8:10 AM', level: '85%', duration: '1h 10m', type: 'Partial' },
          { date: '14 May, 11:20 PM', level: '100%', duration: '2h 15m', type: 'Full Charge' },
          { date: '13 May, 4:30 PM', level: '90%', duration: '30m', type: 'Partial' },
        ].map((log, i) => (
          <div key={i} className="bento-card flex justify-between items-center bg-slate-900/30 border-slate-800/50">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-2xl",
                log.type === 'Full Charge' ? "bg-accent/10 text-accent" : "bg-blue-500/10 text-blue-500"
              )}>
                <Zap size={20} />
              </div>
              <div>
                <p className="font-bold text-sm">{log.type}</p>
                <p className="text-[10px] text-slate-500">{log.date} • {log.duration}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={cn("font-mono font-bold", log.type === 'Full Charge' ? "text-accent" : "text-white")}>{log.level}</p>
              <p className="text-[9px] text-slate-600 uppercase tracking-widest">{t.logged}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function HealthScreen({ battery, onBack, t }: any) {
  const tips = [
    {
      title: t.step1,
      tip: t.step2,
      detail: t.step3,
      icon: Battery,
      stat: t.optimal
    },
    // We'll use more realistic tips from translations if possible, 
    // but the original code had hardcoded values. I'll update the tips array to be dynamic.
  ];

  const currentTips = [
    {
      title: "The 20-80 Rule",
      tip: "Keep battery between 20% and 80% for longevity.",
      detail: "Lithium-ion batteries experience less stress when kept in this range.",
      icon: Battery,
      stat: t.optimal
    },
    {
      title: "Thermal Management",
      tip: "Avoid fast charging if the device is already hot.",
      detail: "Heat is the #1 enemy of battery health.",
      icon: Thermometer,
      stat: t.healthy
    }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 space-y-8 pb-32 font-sans">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">{t.statusHealth}</h2>
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
        <StatusHealthItem label={t.cycleCount} value="142" sub={t.optimal} />
        <StatusHealthItem label={t.avgTemp} value="32°C" sub={t.healthy} />
        <StatusHealthItem label={t.capacity} value="4820" sub="mAh" />
        <StatusHealthItem label={t.technology} value="Li-ion" sub={t.verified} />
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-600">{t.smartBatteryTips}</h3>
        <div className="space-y-3">
          {currentTips.map((item, i) => (
            <TipCard key={i} item={item} />
          ))}
        </div>
      </div>
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

function AlarmOverlay({ battery, config, security, audioContext, reason, onStop, t }: { battery: BatteryState, config: AlarmConfig, security: SecurityConfig, audioContext: AudioContext | null, reason: 'theft' | 'full' | 'low' | 'test' | null, onStop: (disarm: boolean) => void, t: any }) {
  const [isSwiped, setIsSwiped] = useState(false);
  const [isSnoozed, setIsSnoozed] = useState(false);

  const handleSnooze = () => {
    setIsSnoozed(true);
    setTimeout(() => {
      setIsSnoozed(false);
    }, 300000); // 5 minute snooze
  };

  useEffect(() => {
    // AUTO-STOP Logic
    
    // 1. If it was a theft alarm (unplugged) or low battery, and user PLUGS IT BACK IN, stop alarm
    if (battery.charging && (reason === 'theft' || reason === 'low' || reason === 'test')) {
       // If plugged back in during these alarms, silence the alarm
       onStop(false); 
    }

    // 2. If it was a goal alarm (charging) and user UNPLUGS IT, stop alarm
    if (!battery.charging && reason === 'full') {
       onStop(false);
    }
  }, [battery.charging, reason, onStop]);

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
      <div className="text-center space-y-6">
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
        
        <div className="pt-8 text-center">
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
        <div className="w-full max-w-[320px] relative h-20 bg-slate-900/50 rounded-full border border-slate-800 p-2 overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">{t.swipeToDisarm}</p>
          </div>
          
          <motion.div 
            drag="x"
            dragConstraints={{ left: 0, right: 240 }}
            dragElastic={0}
            onDragEnd={(_, info) => {
              if (info.offset.x > 200) {
                setIsSwiped(true);
                setTimeout(() => onStop(true), 200); // Manual swipe disarms monitoring
              }
            }}
            animate={isSwiped ? { x: 240 } : { x: 0 }}
            className="relative z-10 w-16 h-16 bg-accent rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing accent-glow"
          >
            <ChevronRight size={32} className="text-black" />
          </motion.div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={handleSnooze}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 border border-slate-800 rounded-full text-slate-400 hover:text-white transition-all active:scale-95"
          >
            <Moon size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t.snooze}</span>
          </button>
          
          <button 
            onClick={() => onStop(false)}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 border border-slate-800 rounded-full text-accent hover:bg-accent hover:text-black transition-all active:scale-95"
          >
            <Settings size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">{t.changeGoal}</span>
          </button>
        </div>
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
