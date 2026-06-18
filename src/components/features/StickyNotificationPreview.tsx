import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Zap, Shield, Sparkles, RefreshCw, Smartphone, Clock, Bell, CheckCircle } from 'lucide-react';
import { Screen, AlarmConfig } from '../../types';
import { GoogleNativeAppAd } from '../GoogleAdMob';

interface StickyNotificationPreviewProps {
  battery: {
    level: number;
    charging: boolean;
    temperature: number;
  };
  config: AlarmConfig;
  setConfig: React.Dispatch<React.SetStateAction<AlarmConfig>>;
  onBack: () => void;
  triggerInterstitial?: (onDismiss: () => void) => void;
  setScreen?: (screen: Screen) => void;
  onSimulateNotification?: () => void; // Callback to trigger simulated system drawer popup
}

export function StickyNotificationPreview({ 
  battery, 
  config, 
  setConfig, 
  onBack, 
  triggerInterstitial,
  setScreen,
  onSimulateNotification
}: StickyNotificationPreviewProps) {
  const [boosting, setBoosting] = useState(false);
  const [justSimulated, setJustSimulated] = useState(false);

  // Default values check (Locked to 6 Hours, always active as per User request)
  const boostEnabled = true;
  const boostInterval = 6;

  // Automatically enforce these properties in the persistent configuration state
  React.useEffect(() => {
    if (config.boostReminderNotificationEnabled !== true || config.boostReminderIntervalHours !== 6 || config.stickyNotificationEnabled !== true) {
      setConfig(prev => ({
        ...prev,
        boostReminderNotificationEnabled: true,
        boostReminderIntervalHours: 6,
        stickyNotificationEnabled: true
      }));
    }
  }, [config.boostReminderNotificationEnabled, config.boostReminderIntervalHours, config.stickyNotificationEnabled, setConfig]);

  const handleBoostPhoneClick = () => {
    setBoosting(true);
    // Google AdMob & Play Store Policy Compliant presentation:
    // 1. Show the interstitial ad first
    // 2. On close, redirect to the cleanup & optimization engine page
    if (triggerInterstitial) {
      triggerInterstitial(() => {
        setBoosting(false);
        if (setScreen) {
          setScreen(Screen.CLEANER);
        }
      });
    } else {
      setTimeout(() => {
        setBoosting(false);
        if (setScreen) {
          setScreen(Screen.CLEANER);
        }
      }, 600);
    }
  };

  const handleToggleSticky = () => {
    // Locked / read-only as per user request
  };

  const handleToggleBoostReminder = () => {
    // Locked / read-only as per user request
  };

  const handleSetInterval = (hours: number) => {
    // Locked / read-only as per user request
  };

  const triggerSimulation = () => {
    setJustSimulated(true);
    if (onSimulateNotification) {
      onSimulateNotification();
    }
    setTimeout(() => {
      setJustSimulated(false);
    }, 3000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="p-8 space-y-6 pb-32 font-sans relative"
    >
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer">
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-[#00FF88] font-extrabold font-sans">Settings Panel</span>
            <h1 className="text-xl font-black text-white">Notification Panel / रिमाइन्डर सैटिंग्स</h1>
          </div>
        </div>
        <div className="p-2 bg-[#00FF88]/15 text-[#00FF88] rounded-xl"><Bell size={20} /></div>
      </header>

      {/* Persistent General Sticky Shortcut Toggle Box */}
      <div className="bento-card p-5 bg-slate-950 border border-white/5 space-y-4 text-left">
        <div className="flex items-center justify-between">
          <div className="text-left pr-3">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Option 1: Quick Shortcut</h3>
            <h2 className="text-sm font-black text-white mt-0.5 font-sans">Persistent Notification Banner</h2>
            <p className="text-[10px] text-slate-400 leading-normal mt-1">
              Keeps a general real-time status bar option enabled for fast shortcuts and monitoring.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-extrabold uppercase text-[#00FF88] bg-[#00FF88]/10 py-1 px-2 rounded-lg border border-[#00FF88]/20 shrink-0">
              ALWAYS ON / हमेशा चालू है
            </span>
          </div>
        </div>
      </div>

      {/* Recurrent 6-Hour Booster Notification Option */}
      <div className="bento-card p-5 bg-slate-950 border border-white/5 space-y-4 text-left relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 rounded-full filter blur-xl pointer-events-none" />
        
        <div className="flex items-center justify-between">
          <div className="text-left pr-3">
            <h3 className="text-xs font-black uppercase text-pink-500 tracking-wider">Option 2: Recurrent Alert / ६ घंटे में अलर्ट</h3>
            <h2 className="text-sm font-black text-white mt-0.5 font-sans">6-Hourly Optimizer Reminder</h2>
            <p className="text-[10px] text-slate-400 leading-normal mt-1">
              Triggers a system drawer notification every 6 hours to prompt booster action. Clicking it displays an AdMob sponsor ad and opens the cleaner utility.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-extrabold uppercase text-pink-500 bg-pink-500/10 py-1 px-2 rounded-lg border border-pink-500/20 shrink-0">
              ALWAYS ON / हमेशा चालू है
            </span>
          </div>
        </div>

        {boostEnabled && (
          <div className="pt-3 border-t border-white/5 space-y-4 animate-fade-in text-[11px]">
            <div>
              <span className="text-slate-500 font-bold uppercase text-[9px] tracking-wider block mb-1.5">Reminder Trigger Interval / समयान्तराल</span>
              <div className="grid grid-cols-1 font-mono">
                <div className="py-2 px-4 border border-pink-500/30 rounded-xl text-center text-xs font-bold bg-pink-500/10 text-pink-400 flex items-center justify-between">
                  <span>⏰ Fixed Interval</span>
                  <span className="font-extrabold uppercase text-[10px] tracking-wider">6 Hours Only (Locked)</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                onClick={triggerSimulation}
                className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {justSimulated ? (
                  <>
                    <CheckCircle size={12} className="text-white animate-bounce" />
                    <span>Notification Dispatched / सिम्युलेट हो गया!</span>
                  </>
                ) : (
                  <>
                    <Clock size={12} />
                    <span>Simulate Recurrent Notification Now / तुरंत टेस्ट करें</span>
                  </>
                )}
              </button>
              <p className="text-[9px] text-slate-500 text-center">
                Allows you to immediately view and test the 6-hourly notification panel layout on your device.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Native App Ad 1 */}
      <div>
        <GoogleNativeAppAd />
      </div>

      {/* Layout Live Preview Frame */}
      <div className="space-y-3.5">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Drawer Shortcut Live Preview / नोटिफिकेशन की झलक</h3>
        
        {/* Mock Smartphone top slide drawer */}
        <div className="p-6 bg-slate-950 border border-white/10 rounded-[2.25rem] relative overflow-hidden text-left shadow-[0_15px_30px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 inset-x-0 h-4 bg-slate-900/60 flex items-center justify-between px-6 text-[8px] text-slate-500 font-mono">
            <span>Carrier Network</span>
            <div className="flex items-center gap-1.5 font-bold">
              <span>{battery.temperature}°C</span>
              <span>•</span>
              <span>12:00 PM</span>
            </div>
          </div>
          
          <div className="pt-4 pb-2">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-2.5">Notification Drawer Panel</span>
            
            {/* Live Recurrent 6-hour styled notification item card */}
            <div className="p-4 bg-slate-900/90 border border-white/10 rounded-2xl flex flex-col gap-3 relative overflow-hidden shadow-lg animate-fade-in">
              <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 to-transparent pointer-events-none" />
              
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  {/* Styled battery level indicator matching 61% format */}
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-500 text-white rounded-full flex items-center justify-center font-black text-xs font-mono shadow-md">
                    {Math.round(battery.level * 100)}%
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-1 leading-none uppercase tracking-wide">
                      ChargeGuard Pro Security
                      <Shield size={11} className="text-pink-400" />
                    </h4>
                    <span className="text-[10px] text-rose-400 font-bold mt-1 block font-mono">
                      Junk full <span className="text-slate-500">|</span> Cores: Status Active
                    </span>
                  </div>
                </div>

                {/* Boost Phone Action Button */}
                <button
                  onClick={handleBoostPhoneClick}
                  disabled={boosting}
                  className="py-1.5 px-3 bg-pink-500 text-black font-extrabold text-[10px] uppercase tracking-wider rounded-xl hover:opacity-90 active:scale-95 transition-all text-center relative z-10 disabled:opacity-50 shadow-sm shrink-0"
                >
                  {boosting ? (
                    <RefreshCw size={11} className="animate-spin text-black" />
                  ) : (
                    "Boost Phone"
                  )}
                </button>
              </div>

              {/* Sticky bottom indicator specified by user */}
              <div className="pt-2 border-t border-white/5 flex justify-between items-center text-[8.5px] text-slate-500 font-bold uppercase tracking-widest leading-none z-10">
                <span>Sticky Notification Panel</span>
                <span className="font-mono text-[8px] text-pink-500/80 animate-pulse">Triggers every {boostInterval} Hours</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Compliance Statement */}
      <div className="bento-card p-5 space-y-2.5 bg-slate-900/40 text-left border border-white/5">
        <h4 className="text-xs font-black text-[#00FF88] uppercase tracking-wider">🛡️ Play Store & AdMob Policy Compliant</h4>
        <p className="text-[10.5px] text-slate-400 leading-relaxed font-sans">
          This reminder complies fully with AdMob and Play Store policies:
        </p>
        <ul className="list-disc pl-4 text-[10px] text-slate-400 space-y-1">
          <li>It provides a valuable helper configuration utility clear to the user.</li>
          <li>Clicking the button plays a preloaded interstitial ad which has a clear and safe close behavior.</li>
          <li>Ad triggers correspond specifically to user-initiated clicks on the explicit "Boost Phone" button.</li>
        </ul>
      </div>
    </motion.div>
  );
}
