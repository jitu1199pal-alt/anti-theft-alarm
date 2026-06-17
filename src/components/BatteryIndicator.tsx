import React from 'react';
import { cn } from '../lib/utils';

export const BatteryIndicator = ({ 
  level, 
  charging, 
  className 
}: { 
  level: number; 
  charging: boolean; 
  className?: string;
}) => {
  const percentage = Math.round(level * 100);
  
  return (
    <div className={cn("relative flex items-center justify-center p-8", className)}>
      {/* Outer Ring */}
      <div className="relative w-64 h-64 rounded-full border-4 border-white/5 flex items-center justify-center shadow-[0_0_40px_rgba(0,255,136,0.1)]">
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <defs>
            <linearGradient id="neonGreenPinkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00FF88" />
              <stop offset="100%" stopColor="#FF007F" />
            </linearGradient>
          </defs>
          <circle
            cx="128"
            cy="128"
            r="120"
            fill="none"
            stroke="url(#neonGreenPinkGrad)"
            strokeWidth="8"
            strokeDasharray={2 * Math.PI * 120}
            strokeDashoffset={2 * Math.PI * 120 * (1 - level)}
            className="transition-all duration-1000"
            strokeLinecap="round"
          />
        </svg>

        {/* Center Content */}
        <div className="text-center z-10">
          <div className="text-8xl font-black tracking-tighter text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
            {percentage}<span className="text-3xl text-slate-500">%</span>
          </div>
          <div className="text-[#00FF88] uppercase text-[10px] font-black tracking-[0.25em] mt-2 flex items-center justify-center gap-1.5 bg-black/40 px-3 py-1 rounded-full border border-white/5 mx-auto w-max">
            <span className={cn("w-1.5 h-1.5 rounded-full animate-ping", charging ? "bg-[#00FF88]" : "bg-[#FF007F]-500 bg-rose-500")} />
            <span className="bg-gradient-to-r from-[#00FF88] to-[#FF007F] bg-clip-text text-transparent">
              {charging ? "Charging Fast" : "Discharging"}
            </span>
          </div>
        </div>

        {/* Pulsing glow and particles if charging */}
        {charging && (
          <>
            <div className="absolute inset-0 bg-gradient-to-tr from-[#00FF88]/15 to-[#FF007F]/15 rounded-full animate-pulse blur-3xl" />
            <div className="absolute inset-x-0 bottom-12 flex justify-center gap-1.5 opacity-60">
               {[1,2,3,4,5].map(i => (
                 <div 
                   key={i} 
                   className={cn(
                     "w-1 rounded-full animate-bounce",
                     i % 2 === 0 ? "bg-[#FF007F] shadow-[0_0_8px_#FF007F]" : "bg-[#00FF88] shadow-[0_0_8px_#00FF88]"
                   )}
                   style={{ 
                     height: `${Math.random() * 20 + 20}px`,
                     animationDelay: `${i * 0.12}s`,
                     animationDuration: `${Math.random() * 0.6 + 0.4}s`
                   }} 
                 />
               ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const QuickPreset = ({ 
  value, 
  active, 
  onClick 
}: { 
  value: number; 
  active: boolean; 
  onClick: () => void;
  [key: string]: any;
}) => (
  <button
    id={`preset-${value}`}
    onClick={onClick}
    className={cn(
      "h-12 rounded-xl flex items-center justify-center font-bold transition-all",
      active 
        ? "bg-[#00FF88] text-black shadow-[0_0_15px_rgba(0,255,136,0.4)] scale-105" 
        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
    )}
  >
    {value}%
  </button>
);
