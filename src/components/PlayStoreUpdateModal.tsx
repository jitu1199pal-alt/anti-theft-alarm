import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Sparkles, AlertTriangle, ArrowRight, X } from 'lucide-react';

interface PlayStoreUpdateModalProps {
  show: boolean;
  onClose: () => void;
  updateInfo: {
    latestVersion: string;
    minRequiredVersion: string;
    updateUrl: string;
    releaseNotes: string[];
    isForceUpdate: boolean;
    releaseDate: string;
  } | null;
}

export function PlayStoreUpdateModal({ show, onClose, updateInfo }: PlayStoreUpdateModalProps) {
  if (!updateInfo) return null;

  const handleUpdateClick = () => {
    window.open(updateInfo.updateUrl, '_blank');
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[200] flex items-center justify-center p-6">
          {/* Backdrop click to dismiss ONLY if not a forced critical update */}
          {!updateInfo.isForceUpdate && (
            <div className="absolute inset-0 cursor-pointer animate-fade-in" onClick={onClose} />
          )}

          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-[340px] text-center space-y-6 shadow-2xl shadow-black/90 relative z-10"
          >
            {/* Close Button if NOT force update */}
            {!updateInfo.isForceUpdate && (
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/5 text-slate-400 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            )}

            {/* Google Play themed Pulse Icon Header */}
            <div className="relative mx-auto w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/20 rounded-3xl animate-ping opacity-75 duration-1000" />
              <div className="relative w-16 h-16 bg-gradient-to-tr from-blue-600 to-cyan-400 border border-blue-400/30 rounded-3xl flex items-center justify-center text-white shadow-[0_0_20px_rgba(59,130,246,0.35)]">
                <Download size={28} className="animate-bounce" />
              </div>
            </div>

            {/* Header Title */}
            <div className="space-y-1.5">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest inline-block animate-pulse">
                {updateInfo.isForceUpdate ? "🚨 Critical Security Update" : "Google Play Store Update"}
              </span>
              <h3 className="text-base font-black text-white leading-tight mt-1">
                {updateInfo.isForceUpdate ? "Critical Update Required!" : "New Update Available!"}<br />
                <span className="text-blue-400 text-sm font-extrabold font-mono">
                  {updateInfo.isForceUpdate ? "महत्वपूर्ण अपडेट आवश्यक है!" : "नया अपडेट उपलब्ध है!"}
                </span>
              </h3>
            </div>

            {/* Version Comparison Row */}
            <div className="bg-slate-950/60 rounded-2xl p-3 border border-white/5 flex items-center justify-around font-mono text-xs font-black">
              <div className="text-left">
                <span className="text-[8px] font-bold text-slate-500 block uppercase">Installed</span>
                <span className="text-slate-400">v1.0.36</span>
              </div>
              <ArrowRight size={14} className="text-slate-600 shrink-0" />
              <div className="text-right">
                <span className="text-[8px] font-bold text-blue-400 block uppercase">New Version</span>
                <span className="text-[#00FF88] drop-shadow-[0_0_10px_rgba(0,255,136,0.2)]">v{updateInfo.latestVersion}</span>
              </div>
            </div>

            {/* Release Notes Changelog */}
            <div className="space-y-2 text-left">
              <p className="text-[9.5px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Sparkles size={11} className="text-blue-400" />
                <span>What's New / नया क्या है?</span>
              </p>
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1">
                {updateInfo.releaseNotes.map((note, index) => (
                  <div key={index} className="flex gap-2 items-start text-[11px] text-slate-300 leading-snug">
                    <span className="text-blue-400 shrink-0 mt-0.5">•</span>
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Update Info Footer */}
            {updateInfo.isForceUpdate && (
              <div className="flex flex-col gap-1 items-center justify-center text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20 animate-pulse">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={11} className="shrink-0" />
                  <span>Critical Security Update Required</span>
                </div>
                <span className="text-[8px] text-amber-400 font-extrabold lowercase font-sans">महत्वपूर्ण सुरक्षा अपडेट अनिवार्य है</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleUpdateClick}
                className="w-full py-3.5 bg-blue-500 hover:bg-blue-600 text-white font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-[0_5px_15px_rgba(59,130,246,0.35)] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Download size={13} />
                <span>Update Now / अभी अपडेट करें</span>
              </button>

              {!updateInfo.isForceUpdate && (
                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-400 font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all active:scale-95 cursor-pointer"
                >
                  Later / बाद में
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
