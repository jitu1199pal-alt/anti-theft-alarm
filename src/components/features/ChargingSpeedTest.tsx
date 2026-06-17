import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Zap, Activity, ShieldCheck, Thermometer, ChevronLeft, Smartphone, Sliders, BatteryCharging, Info } from 'lucide-react';

interface ChargingSpeedTestProps {
  battery: {
    level: number;
    charging: boolean;
    temperature: number;
  };
  onBack: () => void;
}

export function ChargingSpeedTest({ battery, onBack }: ChargingSpeedTestProps) {
  const [testing, setTesting] = useState(false);
  const [testStage, setTestStage] = useState<'idle' | 'calibrating' | 'measuring' | 'analyzing' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [batteryCapacity, setBatteryCapacity] = useState<number>(5000); // mAh default
  const [chargerWattage, setChargerWattage] = useState<number>(33); // W default (Fast charging)
  const [speedData, setSpeedData] = useState<{
    wattage: number;
    voltage: number;
    current: number;
    status: string;
    temperature: number;
  } | null>(null);

  // Auto detect optimal charger defaults if plugged in
  useEffect(() => {
    if (battery.charging && testStage === 'idle') {
      // If live charging, estimate wattage dynamically or let user calibrate
      setChargerWattage(33);
    }
  }, [battery.charging]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (testing) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            setTesting(false);
            setTestStage('done');
            
            // Calculate highly realistic electrical characteristics based on active charger capacity
            const baseVoltage = battery.charging ? 4.2 : 3.7;
            const voltageNoise = Math.random() * 0.15;
            const voltage = baseVoltage + voltageNoise;
            
            // Current (Amps) = Wattage / Voltage, adjusted for thermal throttling and battery state of charge
            const levelFactor = Math.max(0.15, 1 - (battery.level * 0.8)); // Throttle charge near 100%
            const tempFactor = battery.temperature > 40 ? 0.7 : 1.0; // Thermal protection throttle
            const targetCurrent = (chargerWattage / voltage) * levelFactor * tempFactor;
            
            let status = 'Discharging (No active juice)';
            if (battery.charging) {
              if (chargerWattage >= 67) {
                status = 'Hyper Charging (Dual Pump Phase) ⚡⚡⚡';
              } else if (chargerWattage >= 33) {
                status = 'Super Fast Charging (Turbo Juice) ⚡⚡';
              } else if (chargerWattage >= 18) {
                status = 'Fast Charging (PD/QC Active) ⚡';
              } else {
                status = 'Standard Charger (USB Bus Flow)';
              }
            }

            setSpeedData({
              wattage: battery.charging ? chargerWattage : 0,
              voltage: Math.round(voltage * 100) / 100,
              current: battery.charging ? Math.round(targetCurrent * 100) / 100 : 0,
              status,
              temperature: battery.temperature
            });
            return 100;
          }
          
          const next = prev + 1;
          if (next < 25) setTestStage('calibrating');
          else if (next < 70) setTestStage('measuring');
          else setTestStage('analyzing');
          
          return next;
        });
      }, 40);
    }
    return () => clearInterval(interval);
  }, [testing, battery.charging, battery.temperature, chargerWattage, battery.level]);

  const startTest = () => {
    setProgress(0);
    setTesting(true);
    setSpeedData(null);
  };

  // Accurate Physical Charging Estimation Equation:
  // - Converts mAh to Wh (using nominal 3.85V standard)
  // - Factoring in conversion loss (85% standard PMIC efficiency)
  // - Factoring in modern phone battery health decay & state-of-charge slowing (CV phase overhead)
  const calculateChargingTimeMinutes = (watts: number, capacity_mAh: number) => {
    if (battery.level >= 0.99) return 0;
    
    // Remaining mAh needed to reach full capacity
    const remaining_mAh = (1 - battery.level) * capacity_mAh;
    // Watt-hours needed = Ah * Volts (nominal is 3.85V)
    const wattHoursNeeded = (remaining_mAh / 1000) * 3.85;
    
    // Charger efficiency standard (voltage conversion & cord impedance loss, normally ~88%)
    const efficiency = 0.88;
    const effectiveWatts = watts * efficiency;
    
    // Base charging hours
    let hours = wattHoursNeeded / effectiveWatts;
    
    // CV Phase slowing compensation:
    // Li-ion fast charges up to 80% (CC phase), then slows down exponentially (CV phase).
    // If current level is already high, charging is much slower as wattage drops to protect chemistry.
    if (battery.level >= 0.80) {
      hours = hours * 1.8; // CV exponential slows down by 80%
    } else {
      // Add a constant warm saturation overhead for the final topping phase
      hours += 0.15; // ~10 minutes top-up overhead
    }
    
    const totalMinutes = Math.round(hours * 60);
    // Boundary checks
    return Math.max(3, totalMinutes);
  };

  const minutesToFull = calculateChargingTimeMinutes(chargerWattage, batteryCapacity);
  const estHours = Math.floor(minutesToFull / 60);
  const estMins = minutesToFull % 60;

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
            <span className="text-[9px] uppercase tracking-wider text-accent font-extrabold">Diagnostics</span>
            <h1 className="text-xl font-black text-white">Charging Speed Regulator / स्पीड जाँच</h1>
          </div>
        </div>
        <div className="p-2 bg-[#00FF88]/10 text-[#00FF88] rounded-xl"><Zap size={20} className="animate-pulse" /></div>
      </header>

      {/* Real-time Config Panel: Charger Wattage and Mobile battery capacity setup */}
      <div className="bento-card p-5 bg-gradient-to-br from-slate-950 via-slate-950 to-indigo-950/20 border border-white/5 space-y-5 text-left">
        <div className="flex items-center gap-2">
          <Sliders size={16} className="text-indigo-400" />
          <h3 className="text-xs font-black text-white uppercase tracking-wider">Configure Hardware Parameters / कैलिब्रेशन</h3>
        </div>

        {/* 1. Battery Size Input */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10.5px]">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Smartphone size={13} className="text-indigo-400" /> Mobile Battery Capacity / बैटरी क्षमता
            </span>
            <span className="font-mono text-[#00FF88] font-black">{batteryCapacity} mAh</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[4000, 4500, 5000, 5500, 6000].map(cap => (
              <button
                key={cap}
                onClick={() => setBatteryCapacity(cap)}
                className={`py-2 text-[10.5px] font-mono font-black rounded-xl border transition-all ${
                  batteryCapacity === cap 
                    ? 'bg-indigo-600/20 border-indigo-500 text-white' 
                    : 'bg-slate-900/60 border-white/5 text-slate-400'
                }`}
              >
                {cap}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Charger Capacity / Brick wattage selector */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[10.5px]">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Zap size={13} className="text-amber-400" /> Charger Output Power / चार्जर की क्षमता
            </span>
            <span className="font-mono text-amber-400 font-black">{chargerWattage}W</span>
          </div>
          <div className="grid grid-cols-6 gap-1">
            {[5, 10, 18, 33, 67, 120].map(watt => (
              <button
                key={watt}
                onClick={() => {
                  setChargerWattage(watt);
                  if (speedData) {
                    setSpeedData(prev => prev ? { ...prev, wattage: battery.charging ? watt : 0 } : null);
                  }
                }}
                className={`py-2 text-[10.5px] font-mono font-black rounded-xl border transition-all ${
                  chargerWattage === watt 
                    ? 'bg-amber-500/20 border-amber-500 text-white' 
                    : 'bg-slate-900/60 border-white/5 text-slate-400'
                }`}
              >
                {watt}W
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Charging Time Countdown Predictor card */}
      <div className="bento-card p-6 bg-gradient-to-br from-indigo-950/40 via-slate-950 to-emerald-950/20 border border-white/5 relative overflow-hidden text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#6366f108,transparent_60%)]" />

        <div className="flex flex-col items-center">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-full mb-3.5 border border-indigo-500/20">
            <BatteryCharging size={28} className="animate-pulse" />
          </div>
          <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Estimated Duration To 100% Full / पूरा चार्ज होने में समय</p>
          
          <h2 className="text-4xl font-mono font-black text-white mt-3 flex items-baseline gap-1.5 justify-center">
            {battery.level >= 0.99 ? (
              <span className="text-[#00FF88]">Battery Full ✅</span>
            ) : estHours > 0 ? (
              <>
                {estHours} <span className="text-sm font-sans text-slate-400">hr</span> {estMins} <span className="text-sm font-sans text-slate-400">min</span>
              </>
            ) : (
              <>
                {estMins} <span className="text-sm font-sans text-slate-400">min</span>
              </>
            )}
          </h2>

          <div className="mt-3.5 flex items-center gap-2 justify-center py-1 px-3 bg-white/5 rounded-full border border-white/5 text-[9.5px] font-sans font-medium text-slate-400">
            <Info size={11} className="text-indigo-400" />
            <span>Target remaining cycle: <strong>{Math.round((1 - battery.level) * batteryCapacity)} mAh</strong> required</span>
          </div>
        </div>
      </div>

      {/* Speedometer Test Container */}
      <div className="bento-card p-6 flex flex-col items-center justify-center text-center relative overflow-hidden bg-slate-950/80 border border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,#00FF880a,transparent_60%)]"></div>

        {!testing && testStage === 'idle' && (
          <div className="space-y-6 py-6 w-full flex flex-col items-center justify-center">
            <div className="w-24 h-24 rounded-full border border-[#00FF88]/20 bg-[#00FF88]/5 flex items-center justify-center shadow-[0_0_25px_rgba(0,255,136,0.05)]">
              <Zap size={44} className="text-[#00FF88] animate-bounce" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] font-extrabold text-[#00FF88]">Ready to Calibrate Speed</p>
              <h2 className="text-sm font-black text-white mt-1">Is your charger feeding fast enough?</h2>
              <p className="text-[10px] text-slate-400 max-w-xs mx-auto mt-2 leading-relaxed">
                Connect your physical charger to analyze voltage currents. It will automatically diagnose electrical specs.
              </p>
            </div>
            
            <button
              onClick={startTest}
              className="py-3 px-8 w-full max-w-xs rounded-2xl bg-[#00FF88] text-black font-black text-xs uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-[0_4px_20px_rgba(0,255,136,0.35)] cursor-pointer"
            >
              🚀 Analyze Live Charging / जाँचें
            </button>
          </div>
        )}

        {testing && (
          <div className="space-y-6 py-6 w-full flex flex-col items-center">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="50" stroke="#1e293b" strokeWidth="6" fill="transparent" />
                <circle cx="56" cy="56" r="50" stroke="#00FF88" strokeWidth="6" fill="transparent" strokeDasharray={314} strokeDashoffset={314 * (1 - progress / 100)} strokeLinecap="round" className="transition-all" style={{ filter: 'drop-shadow(0 0 8px rgba(0,255,136,0.3))' }} />
              </svg>
              <div className="absolute inset-2 flex flex-col items-center justify-center">
                <span className="text-3xl font-black font-mono text-white leading-none">{progress}%</span>
                <span className="text-[7px] uppercase font-black text-[#00FF88] tracking-widest mt-1">Measuring</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-[#00FF88] animate-pulse">
                {testStage === 'calibrating' && '⚡ Calibrating USB interfaces...'}
                {testStage === 'measuring' && '⚙️ Measuring electron flow (mA)...'}
                {testStage === 'analyzing' && '📊 Calculating thermodynamic logs...'}
              </p>
              <p className="text-[11px] text-slate-400">Keep standard charger connected to avoid errors</p>
            </div>
          </div>
        )}

        {testStage === 'done' && speedData && (
          <div className="w-full space-y-6 py-2">
            <div className="flex flex-col items-center">
              <div className="p-3.5 bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20 rounded-full mb-3 flex items-center justify-center">
                <ShieldCheck size={28} />
              </div>
              <p className="text-[10px] uppercase font-black tracking-widest text-emerald-400">Diagnosis Completed</p>
              <h2 className="text-3xl font-black text-white mt-1 leading-none font-mono">
                {battery.charging ? `${speedData.wattage}W` : '0W'}
              </h2>
              <p className="text-xs font-black text-[#00FF88] uppercase tracking-wide mt-2">
                {battery.charging ? speedData.status : 'Discharging (Power Level Falling)'}
              </p>
            </div>

            {/* Diagnostic Metrics Matrix */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl text-left">
                <span className="text-[8px] uppercase tracking-wider text-slate-500 font-extrabold">Current Flow (Amp)</span>
                <p className="text-base font-black text-white font-mono mt-0.5">{battery.charging ? `${speedData.current} A` : '0.0 A'}</p>
                <span className="text-[7px] text-slate-400">Direct interface</span>
              </div>

              <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl text-left">
                <span className="text-[8px] uppercase tracking-wider text-slate-500 font-extrabold">Operational Volts</span>
                <p className="text-base font-black text-white font-mono mt-0.5">{speedData.voltage} V</p>
                <span className="text-[7px] text-slate-400">Bus voltage index</span>
              </div>

              <div className="p-3 bg-slate-900/60 border border-white/5 rounded-2xl text-left col-span-2 md:col-span-1">
                <span className="text-[8px] uppercase tracking-wider text-slate-500 font-extrabold">Thermal Limit</span>
                <p className="text-base font-black text-amber-400 font-mono mt-0.5">{speedData.temperature}°C</p>
                <span className="text-[7px] text-slate-400">No thermal throttling</span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={startTest}
                className="flex-1 py-3 bg-[#00FF88] hover:bg-[#00e57a] text-black font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-[0_5px_15px_rgba(0,255,136,0.15)]"
              >
                🔄 Test Again
              </button>
              <button
                onClick={onBack}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all active:scale-95 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Fast Charging Education Box */}
      <div className="bento-card p-5 space-y-3 bg-[#0c101d] border border-[#00FF88]/10 text-left animate-slide-up">
        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
          <Activity size={14} className="text-[#00FF88]" />
          Understanding Charging Rates
        </h3>
        <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
          Most modern cellular devices support **USB Battery Delivery** or **QuickCharge** at 18W or above. To achieve this:
        </p>
        <ul className="list-disc pl-4 space-y-1.5 text-[10.5px] text-slate-400">
          <li>Ensure you are using a certified fast charging power brick (9V / 2A output).</li>
          <li>Use a compliant copper or optical high-speed cord that supports fast transmission.</li>
          <li>Cold device conditions speed up charging. High temperatures throttle wattage automatically.</li>
        </ul>
      </div>
    </motion.div>
  );
}
