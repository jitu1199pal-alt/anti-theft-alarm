import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Heart } from 'lucide-react';

interface BatteryAvatarProps {
  level: number;
  charging: boolean;
  temperature: number;
  onBoost?: () => void;
}

export function BatteryAvatar({ level, charging, temperature, onBoost }: BatteryAvatarProps) {
  const [moodMsg, setMoodMsg] = useState<string>('Click to play with me! 😊');
  const [scale, setScale] = useState<number>(1);
  const [likes, setLikes] = useState<number>(0);
  const [showHeart, setShowHeart] = useState(false);

  // Determine battery mood
  let mood: 'happy' | 'energetic' | 'resting' | 'sick' | 'sad' = 'happy';
  let color = 'text-emerald-400';
  let bgColor = 'bg-emerald-500/10';
  let borderColor = 'border-emerald-500/20';
  let face = '(◕‿◕)';
  let tagline = 'Subah Check-in: All systems operational!';

  if (charging) {
    mood = 'energetic';
    color = 'text-[#00FF88]';
    bgColor = 'bg-emerald-500/15';
    borderColor = 'border-[#00FF88]/30';
    face = '⚡(⚡‿⚡)⚡';
    tagline = 'Ah! Power feels so good!';
  } else if (temperature > 39) {
    mood = 'sick';
    color = 'text-rose-500';
    bgColor = 'bg-rose-500/10';
    borderColor = 'border-rose-500/20';
    face = '(✖╭╮✖)';
    tagline = 'Too HOT! Please let me cool down!';
  } else if (level < 0.2) {
    mood = 'sad';
    color = 'text-amber-500';
    bgColor = 'bg-amber-500/10';
    borderColor = 'border-amber-500/20';
    face = '(ಥ﹏ಥ)';
    tagline = 'Hungry! Connect the charger fast!';
  } else {
    mood = 'happy';
    color = 'text-indigo-400';
    bgColor = 'bg-indigo-500/10';
    borderColor = 'border-indigo-500/20';
    face = '٩(◕‿◕)۶';
    tagline = 'Perfect status! Ready for school!';
  }

  const handleInteract = () => {
    setScale(1.15);
    setLikes(prev => prev + 1);
    setShowHeart(true);
    setTimeout(() => setScale(1), 150);
    setTimeout(() => setShowHeart(false), 800);

    const friendlyMessages = [
      "Yummy! Thanks for boosting me! 🔋",
      "I feel super energized now! ⚡",
      "You are the best owner! ❤️",
      "Analyzing background junk files... Clean! ✨",
      "Vroom! RAM memory booster deployed! 🚀",
      "Daily Check-in: Battery status is 100% healthy!",
      "I love stay in 20% - 80% sweet spot! No stress!"
    ];
    const randomMsg = friendlyMessages[Math.floor(Math.random() * friendlyMessages.length)];
    setMoodMsg(randomMsg);
  };

  return (
    <div className={`bento-card p-5 border ${borderColor} ${bgColor} relative overflow-hidden flex flex-col items-center justify-center text-center`}>
      <div className="absolute top-3 right-3 bg-white/5 px-2.5 py-1 rounded-full text-[9px] font-bold text-slate-400 flex items-center gap-1">
        <Sparkles size={10} className="text-yellow-400" />
        <span>Virtual Battery Pet</span>
      </div>

      <div className="relative mt-2 flex flex-col items-center justify-center">
        {/* Heart pop-up animation */}
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, y: 10, opacity: 0 }}
              animate={{ scale: 1.5, y: -40, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute text-red-500 z-20 pointer-events-none"
            >
              <Heart size={24} fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={{
            y: mood === 'sick' ? [0, 2, 0] : [0, -6, 0],
            rotate: mood === 'energetic' ? [-1, 1, -1] : 0
          }}
          transition={{
            duration: mood === 'sick' ? 1.5 : (charging ? 0.8 : 3),
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{ transform: `scale(${scale})` }}
          onClick={handleInteract}
          className="w-24 h-24 bg-slate-950/90 border border-white/10 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer shadow-lg hover:border-[#00FF88]/40 transition-all active:scale-95 my-3 relative group"
        >
          {/* Pulsing ring around pet if active */}
          <div className="absolute inset-0 rounded-[2rem] border-2 border-transparent group-hover:border-[#00FF88]/20 animate-pulse" />
          
          <span className={`text-2xl font-mono font-black ${color} tracking-tight select-none`}>
            {face}
          </span>
          <span className="text-[8px] font-extrabold uppercase mt-1 tracking-wider text-slate-500">
            Mood: {mood}
          </span>
        </motion.div>
      </div>

      <div className="space-y-1 mt-1">
        <h4 className="text-xs font-bold text-white">{tagline}</h4>
        <p className="text-[10px] text-slate-400 italic font-mono px-4 h-6 flex items-center justify-center">
          {moodMsg}
        </p>
      </div>

      <div className="mt-4 flex gap-2 w-full max-w-[280px]">
        <button
          onClick={handleInteract}
          className="flex-1 py-2 px-3 bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_10px_rgba(99,102,241,0.2)] active:scale-95"
        >
          👋 Interact / बात करें
        </button>
        <button
          onClick={() => {
            handleInteract();
            if (onBoost) onBoost();
          }}
          className="flex-1 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_10px_rgba(16,185,129,0.2)] active:scale-95"
        >
          🚀 Feed Boost / बूस्ट
        </button>
      </div>
      
      <div className="flex gap-2.5 items-center justify-center mt-3 text-[9px] font-bold text-slate-500 uppercase tracking-wider">
        <span>Pet Level: <strong className="text-yellow-400 font-mono">Lv.{Math.min(99, Math.floor(likes / 4) + 1)}</strong></span>
        <span>•</span>
        <span>Happiness: <strong className="text-rose-400 font-mono">{Math.min(100, 60 + likes * 5)}%</strong></span>
      </div>
    </div>
  );
}
