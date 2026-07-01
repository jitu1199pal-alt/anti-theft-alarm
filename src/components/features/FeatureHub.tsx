import React from 'react';
import { motion } from 'motion/react';
import { Zap, Play, Trash2, Speech, Smartphone, Bell, HelpCircle, Activity, ShieldCheck, Gamepad, Crown } from 'lucide-react';
import { Screen, AlarmConfig } from '../../types';
import { BatteryAvatar } from './BatteryAvatar';

interface FeatureHubProps {
  battery: {
    level: number;
    charging: boolean;
    temperature: number;
  };
  alarmConfig: AlarmConfig;
  setAlarmConfig: React.Dispatch<React.SetStateAction<AlarmConfig>>;
  setScreen: (s: Screen) => void;
  onBoostIcon: () => void;
  triggerInterstitial?: (onDismiss: () => void) => void;
  isPremium?: boolean;
  setShowPremiumModal?: (show: boolean) => void;
}

export function FeatureHub({ battery, alarmConfig, setAlarmConfig, setScreen, onBoostIcon, triggerInterstitial, isPremium, setShowPremiumModal }: FeatureHubProps) {
  
  const tools = [
    {
      title: 'Charging Speed Test',
      subtitle: '⚡ 18W Fast Charging Check',
      desc: 'Check wattage intake rate & electrical current',
      icon: Zap,
      iconColor: 'text-[#00FF88] bg-[#00FF88]/10',
      screen: Screen.SPEED_TEST
    },
    {
      title: 'Battery Health Predictor',
      subtitle: '🔋 Real-Time Usage Breakdown',
      desc: 'Track remaining hours and YouTube/gaming limits',
      icon: Play,
      iconColor: 'text-indigo-400 bg-indigo-500/10',
      screen: Screen.PREDICTOR
    },
    {
      title: 'Junk Cleaner & RAM Booster',
      subtitle: '🧼 Speed Up Charging Speed',
      desc: 'Optimize background memory buffer logs',
      icon: Trash2,
      iconColor: 'text-pink-500 bg-pink-500/10',
      screen: Screen.CLEANER
    },
    {
      title: 'Charging Sound & Custom Voice',
      subtitle: '📢 Fun Voice Alerts & Speech',
      desc: 'Let phone say: "Sir, please unplug, battery is full!"',
      icon: Speech,
      iconColor: 'text-cyan-400 bg-cyan-400/10',
      screen: Screen.VOICE_ALERTS
    },
    {
      title: 'Hardware Doctor Checkup',
      subtitle: '🩺 Speaker, Touch & Sensor Tests',
      desc: 'Diagnose screen dead zones and haptic motors',
      icon: Smartphone,
      iconColor: 'text-amber-500 bg-amber-500/10',
      screen: Screen.DIAGNOSTICS
    },
    {
      title: 'Sticky Notification shortcut',
      subtitle: '📊 Persistent Panel Setup',
      desc: 'Dynamic drawer tray containing temperature metrics',
      icon: Bell,
      iconColor: 'text-purple-400 bg-purple-500/10',
      screen: Screen.NOTIFICATION_PREVIEW
    }
  ];

  const handleToolClick = (targetScreen: Screen) => {
    const isLocked = !isPremium && (targetScreen === Screen.SPEED_TEST || targetScreen === Screen.DIAGNOSTICS);
    if (isLocked) {
      setShowPremiumModal?.(true);
      return;
    }

    if (triggerInterstitial) {
      triggerInterstitial(() => {
        setScreen(targetScreen);
      });
    } else {
      setScreen(targetScreen);
    }
  };

  const renderToolCard = (t: typeof tools[0]) => {
    const isLocked = !isPremium && (t.screen === Screen.SPEED_TEST || t.screen === Screen.DIAGNOSTICS);
    return (
      <div
        onClick={() => handleToolClick(t.screen)}
        className={`p-5 bento-card border transition-all cursor-pointer flex gap-4 items-start relative overflow-hidden group ${
          isLocked 
            ? "border-amber-500/20 bg-slate-950/40 hover:border-amber-500/55" 
            : "border-white/5 bg-slate-950/80 hover:bg-slate-950 hover:border-[#00FF88]/20"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#00FF88]/2 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {isLocked && (
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400 text-black font-black text-[8px] uppercase tracking-wider shadow-[0_0_10px_rgba(251,191,36,0.3)]">
            <Crown size={8} className="fill-current shrink-0" />
            <span>🔒 Locked</span>
          </div>
        )}

        <div className={`p-3.5 rounded-[1.25rem] shrink-0 ${isLocked ? 'text-amber-400 bg-amber-400/10' : t.iconColor}`}>
          <t.icon size={22} />
        </div>

        <div className="flex-1 text-left min-w-0 pr-2">
          <span className={`text-[9px] font-black uppercase tracking-wide block ${isLocked ? 'text-amber-500/80' : 'text-slate-500'}`}>
            {isLocked ? "👑 Premium Upgrade Required" : t.subtitle}
          </span>
          <h4 className="text-sm font-black text-white mt-1 leading-snug">{t.title}</h4>
          <p className="text-[10.5px] text-slate-400 mt-1 leading-normal pr-1">{t.desc}</p>
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-8 pb-32 flex flex-col gap-6 font-sans text-left"
    >
      <header className="flex justify-between items-center mb-1">
        <div>
          <span className="text-[9px] uppercase tracking-widest text-accent font-extrabold">Advanced Utilities</span>
          <h1 className="text-2xl font-black text-white">Power Tools Hub / एक्स्ट्रा फीचर्स</h1>
        </div>
        <div className="w-9 h-9 bg-accent/10 border border-accent/20 rounded-xl flex items-center justify-center">
          <Gamepad size={18} className="text-accent animate-pulse" />
        </div>
      </header>

      {/* 🐾 Beautiful Virtual Pet/Avatar widget at top-level of the Hub */}
      <BatteryAvatar 
        level={battery.level} 
        charging={battery.charging} 
        temperature={battery.temperature}
        onBoost={onBoostIcon}
      />

      {/* Grid of Interactive Modules */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Diagnostic & Customizer Suite</h3>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderToolCard(tools[0])}
            {renderToolCard(tools[1])}
            {renderToolCard(tools[2])}
            {renderToolCard(tools[3])}
            {renderToolCard(tools[4])}
            {renderToolCard(tools[5])}
          </div>


        </div>
      </div>

      {/* Education block */}
      <div className="p-4 bg-[#0c101d] border border-white/5 rounded-2xl text-[9.5px] text-slate-500 leading-relaxed font-sans">
        🚀 <strong>Why use these premium utilities?</strong> Modern android architecture throttles battery life when background buffers fill. Routine inspection, RAM clearing, and diagnostic scans optimize lifespan, providing cooler operational ranges.
      </div>
    </motion.div>
  );
}
