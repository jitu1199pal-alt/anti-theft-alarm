import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Zap, Shield, Sparkles, RefreshCw, Smartphone, Volume2, ShieldCheck } from 'lucide-react';
import { AlarmConfig } from '../../types';

interface StickyNotificationPreviewProps {
  battery: {
    level: number;
    charging: boolean;
    temperature: number;
  };
  config: AlarmConfig;
  setConfig: React.Dispatch<React.SetStateAction<AlarmConfig>>;
  onBack: () => void;
}

export function StickyNotificationPreview({ battery, config, setConfig, onBack }: StickyNotificationPreviewProps) {
  const [boosting, setBoosting] = useState(false);
  const [boostedText, setBoostedText] = useState('Boost Phone');

  const handleBoost = () => {
    setBoosting(true);
    setBoostedText('Boosting Memory...');
    setTimeout(() => {
      setBoosting(false);
      setBoostedText('Clean & Boosted! ✅');
      setTimeout(() => setBoostedText('Boost Phone'), 2000);
    }, 1200);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="p-8 space-y-6 pb-32 font-sans"
    >
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer">
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-accent font-extrabold">Configurator</span>
            <h1 className="text-xl font-black text-white">Sticky Notification Panel / नोटिफिकेशन बार</h1>
          </div>
        </div>
        <div className="p-2 bg-[#00FF88]/15 text-[#00FF88] rounded-xl"><Smartphone size={20} /></div>
      </header>

      {/* Main Persistent Toggle Box */}
      <div className="bento-card p-5 bg-slate-950 border border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-left">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-wider">Master Strategy Toggle</h3>
            <h2 className="text-base font-black text-white mt-0.5">Notification Panel Shortcut</h2>
            <p className="text-[10px] text-slate-400 leading-normal mt-1">
              Toggle constant, low-battery resistant persistent overlay shortcuts in your system drawer shelf.
            </p>
          </div>
          <button
            onClick={() => setConfig(prev => ({ ...prev, stickyNotificationEnabled: !prev.stickyNotificationEnabled }))}
            className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${config.stickyNotificationEnabled ? 'bg-[#00FF88]' : 'bg-slate-850'}`}
          >
            <div className={`w-5 h-5 bg-black rounded-full absolute top-0.5 transition-all ${config.stickyNotificationEnabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Actual Drawer Shortcut Simulation preview frame */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Drawer Shortcut Live Preview / नोटिफिकेशन की झलक</h3>
        
        {/* Mock Smartphone top slide drawer */}
        <div className="p-6 bg-slate-950 border border-white/10 rounded-[2rem] relative overflow-hidden text-left shadow-[0_15px_30px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 inset-x-0 h-4 bg-slate-900/60 flex items-center justify-between px-6 text-[8px] text-slate-500 font-mono">
            <span>Carrier Network</span>
            <div className="flex items-center gap-1.5 font-bold">
              <span>{battery.temperature}°C</span>
              <span>•</span>
              <span>12:00 PM</span>
            </div>
          </div>
          
          <div className="pt-4 pb-2">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-2">Notification Drawer Panel</span>
            
            {config.stickyNotificationEnabled ? (
              /* Live notification item card */
              <div className="p-4 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-between gap-4 relative overflow-hidden shadow-lg animate-fade-in">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-10 h-10 bg-[#00FF88] text-black rounded-full flex items-center justify-center font-black text-sm font-mono shadow-[0_0_12px_rgba(0,255,136,0.3)]">
                    {Math.round(battery.level * 100)}%
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-1 leading-none">
                      ChargeGuard Pro Security
                      <Shield size={11} className="text-[#00FF88]" />
                    </h4>
                    <span className="text-[9px] text-slate-400 mt-1 block">
                      Temp: <strong className="text-amber-400 font-mono">{battery.temperature}°C</strong> | Cores: Status Active
                    </span>
                  </div>
                </div>

                {/* Simulated direct action button */}
                <button
                  onClick={handleBoost}
                  disabled={boosting}
                  className="py-1.5 px-3 bg-[#0a0f1d] border border-white/10 text-xs font-extrabold text-[#00FF88] uppercase tracking-wider rounded-xl hover:bg-[#00FF88]/10 active:scale-95 transition-all text-center relative z-10 font-mono disabled:opacity-50"
                >
                  {boosting ? (
                    <RefreshCw size={11} className="animate-spin text-[#00FF88]" />
                  ) : (
                    boostedText
                  )}
                </button>
              </div>
            ) : (
              /* Empty state */
              <div className="p-6 bg-slate-900/40 border border-dashed border-white/5 rounded-2xl text-center">
                <span className="text-[10px] text-slate-500 font-bold uppercase block">Sticky Bar Disabled</span>
                <p className="text-[9px] text-slate-650 max-w-xs mx-auto mt-1">Enable "Sticky Shortcut" above to see the interactive launcher in action.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Strategy highlights / engagement factor list */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">User Engagement Benefit</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="p-4 bg-slate-900/30 border border-white/5 rounded-2xl text-left">
            <span className="text-[8px] font-extrabold uppercase text-[#00FF88]">Daily Engagement Metric</span>
            <h4 className="text-xs font-bold text-white mt-0.5">2.5x Open Rates Surge</h4>
            <p className="text-[9.5px] text-slate-400 leading-relaxed mt-1">
              Users continuously preview temperature cycles directly from the status tray, resulting in continuous brand recall.
            </p>
          </div>

          <div className="p-4 bg-slate-900/30 border border-white/5 rounded-2xl text-left">
            <span className="text-[8px] font-extrabold uppercase text-[#00FF88]">Ad-Integration Ready</span>
            <h4 className="text-xs font-bold text-white mt-0.5">Direct Cleaner Interstitials</h4>
            <p className="text-[9.5px] text-slate-400 leading-relaxed mt-1">
              Clicking the tray "Boost" button launches cleaner logs and triggers sponsored app panels instantly.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
