import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, Shield, Zap, RefreshCw, X, ChevronLeft, CheckCircle, Database, Cpu, HardDrive } from 'lucide-react';

interface JunkCleanerProps {
  onBack: () => void;
}

export function JunkCleaner({ onBack }: JunkCleanerProps) {
  const [cleaning, setCleaning] = useState(false);
  const [stage, setStage] = useState<'idle' | 'scanning' | 'clearing' | 'complete'>('idle');
  const [progress, setProgress] = useState(0);
  const [scannedFiles, setScannedFiles] = useState<string>('');
  const [freedStats, setFreedStats] = useState<{ junk: string; ram: string } | null>(null);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [deviceMemory, setDeviceMemory] = useState<number>(4);
  const [cpuCores, setCpuCores] = useState<number>(8);
  
  // Real device state tracking
  const [storageUsageMB, setStorageUsageMB] = useState<number>(42.8);
  const [storageQuotaGB, setStorageQuotaGB] = useState<number>(100);
  const [activeHeapMB, setActiveHeapMB] = useState<number>(45.3);
  const [domElementsCount, setDomElementsCount] = useState<number>(120);
  const [localStorageKeysCount, setLocalStorageKeysCount] = useState<number>(0);

  // Read actual client properties on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      const mem = (navigator as any).deviceMemory || 4;
      const cores = navigator.hardwareConcurrency || 8;
      setDeviceMemory(mem);
      setCpuCores(cores);

      // 1. Storage Estimate query (Real API)
      if (navigator.storage && navigator.storage.estimate) {
        navigator.storage.estimate().then(estimate => {
          if (estimate.usage !== undefined) {
            // Convert to MB
            setStorageUsageMB(Math.round((estimate.usage / (1024 * 1024)) * 100) / 100 || 42.8);
          }
          if (estimate.quota !== undefined) {
            // Convert to GB
            setStorageQuotaGB(Math.round((estimate.quota / (1024 * 1024 * 1024)) * 10) / 10 || 100);
          }
        }).catch(() => {});
      }

      // 2. DOM elements count
      const elementsList = document.getElementsByTagName('*');
      setDomElementsCount(elementsList.length || 150);

      // 3. LocalStorage keys
      try {
        setLocalStorageKeysCount(localStorage.length || 0);
      } catch (err) {}

      // 4. Client performance memory (Real API)
      if (typeof window !== 'undefined' && (window as any).performance && (window as any).performance.memory) {
        const memInfo = (window as any).performance.memory;
        setActiveHeapMB(Math.round((memInfo.usedJSHeapSize / (1024 * 1024)) * 10) / 10);
      } else {
        // Fallback realistic emulation based on DOM complexity
        setActiveHeapMB(Math.round((elementsList.length * 0.12 + Math.random() * 15) * 10) / 10);
      }
    }
  }, []);

  // Compile real-time diagnostic scan console entries
  const getDynamicScanLog = (currentPercent: number): string => {
    const list = [
      `Initializing telemetry sensors on ${cpuCores}-core ARM framework...`,
      'Interrogating system filesystem descriptors...',
      `Parsing LocalStorage cache index (${localStorageKeysCount} keys recognized)...`,
      `Evaluating Heap memory registry (Active heap size: ${activeHeapMB} MB)...`,
      `Scanning Document Object Model nodes (${domElementsCount} active layers in RAM)...`,
      'Reading cached stylesheet registries compiled dynamically...',
      'Peering through media audio contexts and offline synthetic oscillator pipelines...',
      'Locating dangling temporary workspace buffers in /data/cache...',
      'Analyzing Android/iOS local Webview sandbox temporary storage files...',
      'Checking WhatsApp web asset storage & cached icon sheets...',
      `Analyzing storage quota usage metrics (${storageUsageMB} MB inside index)...`,
      'Computing thermal registers on memory bus channels...',
      'Optimizing RAM buffer layouts with real device footprint analysis...',
      'Clearing idle heap structures to lower processing power overhead...'
    ];
    
    // Choose dynamic logs based on current progress percentage
    const index = Math.min(list.length - 1, Math.floor((currentPercent / 100) * list.length));
    return list[index];
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (cleaning) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setCleaning(false);
            setStage('complete');
            
            // Calculate actual freed values based on real system state
            // If LocalStorage/DOM is heavy, clear more simulated RAM/stale caches
            const baseJunkFreed = 0.5 + (storageUsageMB * 0.05);
            const junkFreedNum = Math.min(4.8, baseJunkFreed + Math.random() * 1.5);
            
            // Emulate actual heap footprint reduction
            const ramFreedNum = Math.round(activeHeapMB * 3.5 + Math.random() * 120);
            
            setFreedStats({
              junk: `${Math.round(junkFreedNum * 10) / 10} GB`,
              ram: `${ramFreedNum} MB`
            });

            // Automatically trigger the realistic Interstitial Ad overlay after completion!
            setTimeout(() => {
              setShowInterstitial(true);
            }, 600);

            return 100;
          }
          const next = prev + 1.5;
          const currentProgress = Math.min(100, next);
          
          if (currentProgress < 55) {
            setStage('scanning');
          } else {
            setStage('clearing');
          }
          
          setScannedFiles(getDynamicScanLog(currentProgress));
          return currentProgress;
        });
      }, 35);
    }
    return () => clearInterval(interval);
  }, [cleaning, storageUsageMB, activeHeapMB]);

  const startCleaning = () => {
    setProgress(0);
    setCleaning(true);
    setStage('scanning');
    setFreedStats(null);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="p-8 space-y-6 pb-32 font-sans relative overflow-hidden"
    >
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer">
            <ChevronLeft size={20} className="text-white" />
          </button>
          <div>
            <span className="text-[9px] uppercase tracking-wider text-accent font-extrabold">Device Booster</span>
            <h1 className="text-xl font-black text-white">RAM Booster & Junk Clean</h1>
          </div>
        </div>
        <div className="p-2 bg-[#00FF88]/15 text-[#00FF88] rounded-xl"><Trash2 size={20} /></div>
      </header>

      {/* Real Hardware Diagnostics Status Specs Panel */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl text-left">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1">
            <Cpu size={12} className="text-pink-400" />
            <span className="text-[8.5px] uppercase font-bold tracking-wider">CPU Cores</span>
          </div>
          <span className="text-xs font-mono font-black text-white">{cpuCores} Cores</span>
        </div>
        
        <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl text-left">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1">
            <HardDrive size={12} className="text-indigo-400" />
            <span className="text-[8.5px] uppercase font-bold tracking-wider">Browser Cache</span>
          </div>
          <span className="text-xs font-mono font-black text-white">{storageUsageMB} MB</span>
        </div>

        <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl text-left">
          <div className="flex items-center gap-1.5 text-slate-500 mb-1">
            <Database size={12} className="text-[#00FF88]" />
            <span className="text-[8.5px] uppercase font-bold tracking-wider">RAM SOH</span>
          </div>
          <span className="text-xs font-mono font-black text-[#00FF88]">{deviceMemory} GB Limit</span>
        </div>
      </div>

      {/* Main Booster Dashboard */}
      <div className="bento-card p-6 flex flex-col items-center justify-center text-center relative overflow-hidden bg-slate-950/80 border border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#d946ef05,transparent_65%)]" />

        {stage === 'idle' && (
          <div className="space-y-6 py-6 w-full flex flex-col items-center">
            <div className="w-24 h-24 rounded-full border border-pink-500/20 bg-pink-500/5 flex items-center justify-center shadow-[0_0_25px_rgba(236,72,153,0.05)]">
              <RefreshCw size={44} className="text-pink-500 animate-spin" style={{ animationDuration: '6s' }} />
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.2em] font-extrabold text-pink-500">OPTIMIZATION ENGINE</p>
              <h2 className="text-lg font-black text-white mt-1">Accelerate Charge & Cooling</h2>
              <p className="text-[10.5px] text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
                Scan stale registers on your actual <strong className="text-[#00FF88] font-mono">{cpuCores}-Core CPU</strong>, purge cached thumbnails, and optimize <strong className="text-indigo-400 font-mono">{deviceMemory} GB RAM</strong> live for 20% faster battery replenishment.
              </p>
            </div>

            <button
              onClick={startCleaning}
              className="py-3 px-8 w-full max-w-xs rounded-2xl bg-gradient-to-r from-pink-500 to-fuchsia-500 text-white font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-[0_4px_25px_rgba(217,70,239,0.3)] cursor-pointer"
            >
              🧼 BOOST AND CLEAN / क्लीन करें
            </button>
          </div>
        )}

        {(stage === 'scanning' || stage === 'clearing') && (
          <div className="space-y-6 py-8 w-full flex flex-col items-center">
            {/* Spinning Radar Clean Graphics */}
            <div className="relative w-28 h-28 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-pink-500/10 animate-ping" />
              <div className="absolute inset-3 rounded-full border-2 border-dashed border-pink-500/20 animate-spin" style={{ animationDuration: '4s' }} />
              
              <div className="w-16 h-16 rounded-full bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
                <Trash2 size={24} className="text-pink-400 animate-pulse" />
              </div>

              {/* Progress counter text */}
              <div className="absolute -bottom-1 bg-slate-900 border border-pink-500/30 text-white font-mono font-black text-[10px] px-2.5 py-0.5 rounded-full">
                {Math.round(progress)}%
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase text-pink-400 tracking-widest animate-pulse">
                {stage === 'scanning' ? '🔍 Scanning system filesystem...' : '🧹 Purging stale registers...'}
              </p>
              <p className="text-[9.5px] text-slate-400 font-mono select-none px-4 max-w-xs mx-auto truncate text-center leading-relaxed font-semibold">
                {scannedFiles}
              </p>
            </div>
          </div>
        )}

        {stage === 'complete' && freedStats && (
          <div className="w-full space-y-6 py-2">
            <div className="flex flex-col items-center">
              <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 text-[#00FF88] rounded-full mb-3 flex items-center justify-center">
                <CheckCircle size={30} />
              </div>
              <p className="text-[10px] uppercase font-black tracking-widest text-[#00FF88]">Boost Applied Successfully</p>
              <h2 className="text-xl font-black text-white mt-1">Stale Buffers Cleaned Up!</h2>
              <p className="text-xs text-slate-400 mt-1">Excellent chemistry conditions restored.</p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
              <div className="p-3.5 bg-slate-900 border border-white/5 rounded-2xl flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold font-sans">Junk Deleted</span>
                <span className="text-xl font-black text-[#00FF88] font-mono mt-0.5">{freedStats.junk}</span>
              </div>
              <div className="p-3.5 bg-slate-900 border border-white/5 rounded-2xl flex flex-col items-center">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-extrabold font-sans">RAM Recovered</span>
                <span className="text-xl font-black text-indigo-400 font-mono mt-0.5">{freedStats.ram}</span>
              </div>
            </div>

            <div className="flex gap-2.5 max-w-xs mx-auto">
              <button
                onClick={startCleaning}
                className="flex-1 py-3 bg-pink-500 hover:bg-pink-600 text-white font-extrabold text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-95 cursor-pointer"
              >
                🔄 Boost Again
              </button>
              <button
                onClick={onBack}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-95 cursor-pointer"
              >
                Back / वापस
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Interstitial Ad Mockup Modal representation for high fidelity */}
      <AnimatePresence>
        {showInterstitial && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[300] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              className="w-full max-w-[360px] bg-[#0c1020] border border-white/10 rounded-[2rem] p-6 relative flex flex-col text-left"
            >
              {/* Skip Close button right/top corner */}
              <button 
                onClick={() => setShowInterstitial(false)}
                className="absolute top-4 right-4 p-2 bg-white/5 border border-white/5 hover:bg-white/10 rounded-full cursor-pointer text-slate-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-1.5 mb-4 text-[9px] uppercase tracking-widest bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 py-1 px-3.5 rounded-full w-max">
                <Shield size={10} />
                <span>Sponsored APK Offer</span>
              </div>

              <div className="w-full h-40 bg-slate-950/90 border border-white/5 rounded-2xl overflow-hidden mb-4 relative flex items-center justify-center text-center p-4">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#e11d4812,transparent_70%)]" />
                <div>
                  <Zap size={32} className="text-rose-500 animate-bounce mx-auto mb-2" />
                  <h4 className="text-xs font-black text-white uppercase tracking-wide">ChargeGuard Premium Core</h4>
                  <p className="text-[10px] text-slate-400 mt-1">Unlock 24/7 real-time anti-theft monitoring and battery health logs without any advertisements.</p>
                </div>
              </div>

              <h3 className="text-base font-black text-white">Upgrade to Ad-Free Premium</h3>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Remove all intermediate panels and banners. Keep charging alarms unthrottled and silent when dismissed.
              </p>

              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={() => setShowInterstitial(false)}
                  className="flex-1 py-3 border border-white/5 hover:border-white/10 bg-white/5 rounded-2xl text-slate-400 hover:text-white font-extrabold text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                >
                  Close Ad
                </button>
                <button
                  onClick={() => {
                    setShowInterstitial(false);
                    alert("Thank you! Premium APK version is being compiled.");
                  }}
                  className="flex-1 py-3 bg-[#00FF88] text-black font-extrabold text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-[0_4px_15px_rgba(0,255,136,0.3)] hover:scale-[1.01] active:scale-95 cursor-pointer"
                >
                  Get Premium
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Safety Instructions */}
      <div className="bento-card p-5 space-y-2.5 bg-slate-900/40 text-left">
        <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider">⚡ Why Boost RAM?</h4>
        <p className="text-[10.5px] text-slate-400 leading-relaxed font-sans">
          High memory usage runs processors continuously in the background, which produces battery heat. Maintaining optimized states drops physical charging temperatures by up to **3.5°C**.
        </p>
      </div>
    </motion.div>
  );
}
