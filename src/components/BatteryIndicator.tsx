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
      <div className="relative w-64 h-64 rounded-full border-4 border-white/5 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="128"
            cy="128"
            r="120"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={2 * Math.PI * 120}
            strokeDashoffset={2 * Math.PI * 120 * (1 - level)}
            className={cn(
              "transition-all duration-1000",
              level > 0.2 ? "text-[#00FF88]" : "text-red-500"
            )}
            strokeLinecap="round"
          />
        </svg>

        {/* Center Content */}
        <div className="text-center z-10">
          <div className="text-8xl font-black tracking-tighter text-white">
            {percentage}<span className="text-3xl text-slate-500">%</span>
          </div>
          <div className="text-[#00FF88] uppercase text-[10px] font-bold tracking-[0.2em] mt-2">
            {charging ? "Charging Fast" : "Discharging"}
          </div>
        </div>

        {/* Pulsing glow and particles if charging */}
        {charging && (
          <>
            <div className="absolute inset-0 bg-[#00FF88]/10 rounded-full animate-pulse blur-3xl" />
            <div className="absolute inset-x-0 bottom-12 flex justify-center gap-1 opacity-40">
               {[1,2,3,4,5].map(i => (
                 <div 
                   key={i} 
                   className="w-1 bg-[#00FF88] rounded-full animate-bounce" 
                   style={{ 
                     height: `${Math.random() * 20 + 20}px`,
                     animationDelay: `${i * 0.1}s`,
                     animationDuration: `${Math.random() * 0.5 + 0.5}s`
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
