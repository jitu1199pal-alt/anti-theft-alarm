import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Volume2, Play, CheckCircle2, ShieldCheck, Speech } from 'lucide-react';
import { AlarmConfig } from '../../types';
import { triggerInterstitialAd } from '../GoogleAdMob';

interface VoiceAlertSettingsProps {
  config: AlarmConfig;
  setConfig: React.Dispatch<React.SetStateAction<AlarmConfig>>;
  onBack: () => void;
}

export function VoiceAlertSettings({ config, setConfig, onBack }: VoiceAlertSettingsProps) {
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleToggleConnect = () => {
    const isTurningOn = !config.connectVoiceSpeakEnabled;
    if (isTurningOn) {
      triggerInterstitialAd(() => {
        setConfig(prev => ({ ...prev, connectVoiceSpeakEnabled: true }));
      }, 'security');
    } else {
      setConfig(prev => ({ ...prev, connectVoiceSpeakEnabled: false }));
    }
  };

  const handleToggleFull = () => {
    const isTurningOn = !config.fullVoiceSpeakEnabled;
    if (isTurningOn) {
      triggerInterstitialAd(() => {
        setConfig(prev => ({ ...prev, fullVoiceSpeakEnabled: true }));
      }, 'security');
    } else {
      setConfig(prev => ({ ...prev, fullVoiceSpeakEnabled: false }));
    }
  };

  const connectInputRef = React.useRef<HTMLInputElement>(null);
  const fullInputRef = React.useRef<HTMLInputElement>(null);

  const handleConnectReplaceClick = () => {
    triggerInterstitialAd(() => {
      connectInputRef.current?.click();
    }, 'sensors');
  };

  const handleFullReplaceClick = () => {
    triggerInterstitialAd(() => {
      fullInputRef.current?.click();
    }, 'sensors');
  };

  const [hasCustomConnect, setHasCustomConnect] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('custom_audio_connect');
    } catch {
      return false;
    }
  });

  const [hasCustomFull, setHasCustomFull] = useState<boolean>(() => {
    try {
      return !!localStorage.getItem('custom_audio_full');
    } catch {
      return false;
    }
  });

  const handleConnectUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Please select an MP3 file smaller than 2MB to save browser storage space.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        localStorage.setItem('custom_audio_connect', base64);
        setHasCustomConnect(true);
        setErrorMsg(null);
        // Play preview
        const audio = new Audio(base64);
        audio.volume = config.volume / 100;
        audio.play().catch(err => console.log("Failed to play custom sound:", err));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetConnect = () => {
    localStorage.removeItem('custom_audio_connect');
    setHasCustomConnect(false);
  };

  const handleFullUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("Please select an MP3 file smaller than 2MB to save browser storage space.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        localStorage.setItem('custom_audio_full', base64);
        setHasCustomFull(true);
        setErrorMsg(null);
        // Play preview
        const audio = new Audio(base64);
        audio.volume = config.volume / 100;
        audio.play().catch(err => console.log("Failed to play custom sound:", err));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetFull = () => {
    localStorage.removeItem('custom_audio_full');
    setHasCustomFull(false);
  };

  const presets = [
    {
      id: 'professional',
      name: '👔 Professional Assistant (English)',
      connect: 'Thank you for charging me!',
      full: 'Sir, please unplug the charger, battery is full!'
    },
    {
      id: 'hindi_comedy',
      name: '🤪 Funny Desi Hindi Joke (Hindustani)',
      connect: 'Aha! Pet khali tha, khana mil gaya. Thank you!',
      full: 'Arre bhai! Phone bol raha hu, full charge ho gaya, ab to nikaalo charger!'
    },
    {
      id: 'cyber_bot',
      name: '🤖 Sci-Fi Cyber Bot (Futuristic)',
      connect: 'Tachyon power couplings locked. Rejuvenating backup cells.',
      full: 'Warning: Quantum core fully saturated. Sever external links immediately.'
    },
    {
      id: 'anime_kawaii',
      name: '🌸 Sweet Anime Mascot (Kawaii)',
      connect: 'Yay! Thank you for giving me energy! Let\'s do our best!',
      full: 'Onii-chan! Battery is super full! Plis unplug me now!'
    }
  ];

  const currentPresetId = presets.find(
    p => p.connect === config.connectVoiceSpeakText && p.full === config.fullVoiceSpeakText
  )?.id || 'professional';

  const selectPreset = (connectText: string, fullText: string) => {
    setConfig(prev => ({
      ...prev,
      connectVoiceSpeakText: connectText,
      fullVoiceSpeakText: fullText
    }));
  };

  const playWebAudioChime = (volumeVal: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);

      const now = ctx.currentTime;
      
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15); // E6
      
      osc2.frequency.setValueAtTime(440, now); // A4
      osc2.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volumeVal * 0.15, now + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.4);
      osc2.stop(now + 0.4);
    } catch (e) {
      console.error("Web Audio Chime failed", e);
    }
  };

  const speakFallbackSpeech = (textToSpeak: string, pId: string) => {
    if (!('speechSynthesis' in window)) {
      playWebAudioChime(config.volume / 100);
      return;
    }
    try {
      window.speechSynthesis.cancel(); // Clears any ongoing speech
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.volume = config.volume / 100;
      utterance.lang = pId === 'hindi_comedy' ? 'hi-IN' : 'en-US';
      utterance.onend = () => setPlayingVoice(null);
      utterance.onerror = () => {
        playWebAudioChime(config.volume / 100);
        setPlayingVoice(null);
      };
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn("Speech synthesis fallback failed:", err);
      playWebAudioChime(config.volume / 100);
      setPlayingVoice(null);
    }
  };

  const handleSpeechSpeak = (text: string, type: 'connect' | 'full', presetId: string) => {
    try {
      let audio: HTMLAudioElement;
      let primaryUrl = '';
      let fallbackUrl = `audio/${presetId}_${type}.mp3`;

      if (type === 'connect') {
        const customConnect = localStorage.getItem('custom_audio_connect');
        if (customConnect) {
          console.log("Playing custom connection tone for preview");
          primaryUrl = customConnect;
        } else {
          primaryUrl = window.location.origin + `/audio/${presetId}_${type}.mp3`;
        }
      } else {
        const customFull = localStorage.getItem('custom_audio_full');
        if (customFull) {
          console.log("Playing custom full charged tone for preview");
          primaryUrl = customFull;
        } else {
          primaryUrl = window.location.origin + `/audio/${presetId}_${type}.mp3`;
        }
      }

      audio = new Audio(primaryUrl);
      setPlayingVoice(`${type}_active`);
      audio.volume = config.volume / 100;

      // Ensure we clear out any previously active preview sound instantly
      if ((window as any)._activePreviewAudio) {
        try {
          (window as any)._activePreviewAudio.pause();
        } catch (e) {}
      }
      (window as any)._activePreviewAudio = audio;

      audio.onended = () => {
        setPlayingVoice(null);
      };

      let triedFallback = false;
      audio.onerror = (err) => {
        if (!triedFallback && !primaryUrl.startsWith('data:') && !primaryUrl.startsWith('blob:')) {
          console.warn("Primary offline voice loading failed, trying direct relative path:", fallbackUrl);
          triedFallback = true;
          try {
            audio.src = fallbackUrl;
            audio.play().catch(fe => {
              console.warn("Relative path lookup failed:", fe);
              speakFallbackSpeech(text, presetId);
            });
          } catch(err2) {
            speakFallbackSpeech(text, presetId);
          }
        } else {
          console.warn("Offline voice MP3 playback failed, falling back to TTS:", err);
          speakFallbackSpeech(text, presetId);
        }
      };

      audio.play().catch(e => {
        if (!triedFallback && !primaryUrl.startsWith('data:') && !primaryUrl.startsWith('blob:')) {
          console.warn("Primary play promise failed, trying direct relative path:", fallbackUrl);
          triedFallback = true;
          try {
            audio.src = fallbackUrl;
            audio.play().catch(fe => {
              console.warn("Relative path play promise failed:", fe);
              speakFallbackSpeech(text, presetId);
            });
          } catch(err2) {
            speakFallbackSpeech(text, presetId);
          }
        } else {
          console.warn("Offline voice playable exception, falling back to TTS:", e);
          speakFallbackSpeech(text, presetId);
        }
      });
    } catch (e) {
      console.error("Audio block error, falling back to TTS:", e);
      speakFallbackSpeech(text, presetId);
    }
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
            <span className="text-[9px] uppercase tracking-wider text-accent font-extrabold">Customizer</span>
            <h1 className="text-xl font-black text-white">Voice Alerts / बोलकर बताने वाला</h1>
          </div>
        </div>
        <div className="p-2 bg-[#00FF88]/15 text-[#00FF88] rounded-xl"><Speech size={20} /></div>
      </header>

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between text-left">
          <div className="flex-1 min-w-0 pr-2">
            <span className="text-[9px] uppercase tracking-wider text-rose-400 font-extrabold block">SOUND NOTICE / ध्वनि सूचना</span>
            <p className="text-[11px] text-rose-200 mt-1 leading-normal font-medium">
              {errorMsg}
            </p>
          </div>
          <button 
            onClick={() => setErrorMsg(null)}
            className="p-1 px-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-bold text-slate-400 cursor-pointer transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 🟢 Dual-green Switch for Voice Alert vs. Tune 🟢 */}
      <div className="bento-card p-5 bg-slate-950 border border-white/5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between px-2">
          <span className={`text-[13px] font-black transition-all ${config.voiceAlert ? 'text-[#00FF88] opacity-100 scale-105' : 'text-slate-400 opacity-60'}`}>Voice Alert</span>
          
          <button
            onClick={() => {
              triggerInterstitialAd(() => {
                setConfig(prev => ({ ...prev, voiceAlert: !prev.voiceAlert }));
              }, 'security');
            }}
            className="w-14 h-7 bg-[#00FF88] rounded-full relative transition-all cursor-pointer shadow-[0_0_15px_rgba(0,255,136,0.3)] flex items-center shrink-0"
          >
            <div 
              className={`w-5 h-5 bg-slate-950 rounded-full absolute transition-all border border-[#00FF88] ${
                config.voiceAlert ? 'left-1' : 'left-8'
              }`} 
            />
          </button>

          <span className={`text-[13px] font-black transition-all ${!config.voiceAlert ? 'text-[#00FF88] opacity-100 scale-105' : 'text-slate-400 opacity-60'}`}>Tune</span>
        </div>
        <p className="text-[10px] text-slate-400 font-bold text-center leading-relaxed">
          {config.voiceAlert 
            ? "🎙️ Voice Alerts Mode Active - Spoken alerts play for anti-theft, low battery, and full charging." 
            : "🎵 Default Tune Mode Active - Classic sound beeps play for anti-theft, low battery, and full charging."}
        </p>
      </div>

      {/* Main Switch Panel */}
      <div className="bento-card p-5 space-y-4 bg-slate-950 border border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">Sound & Voice Modality</h3>
            <p className="text-[10px] text-slate-400">Speak voice feedback upon connection and disconnections</p>
          </div>
          <span className="text-[9px] bg-indigo-500/10 text-indigo-400 font-bold px-2 py-0.5 rounded border border-indigo-500/20">SPEECH ENG</span>
        </div>

        <div className="space-y-3.5 pt-2">
          {/* Charger Connection Voice Alert toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-white/5 rounded-2xl">
            <div className="text-left">
              <h4 className="text-xs font-bold text-white">Plug-In Welcome Voice Greeting</h4>
              <p className="text-[9.5px] text-slate-400">Speak "Thank you for charging me" when cable matches</p>
            </div>
            <button
              onClick={handleToggleConnect}
              className={`w-12 h-6 rounded-full transition-all relative ${config.connectVoiceSpeakEnabled ? 'bg-[#00FF88]' : 'bg-slate-800'}`}
            >
              <div className={`w-5 h-5 bg-black rounded-full absolute top-0.5 transition-all ${config.connectVoiceSpeakEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>

          {/* Full Charged Voice Alert toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-white/5 rounded-2xl">
            <div className="text-left">
              <h4 className="text-xs font-bold text-white">Full Alert Speech Unplug</h4>
              <p className="text-[9.5px] text-slate-400">Voice shoutout "Sir, please unplug..." at 100% limit</p>
            </div>
            <button
              onClick={handleToggleFull}
              className={`w-12 h-6 rounded-full transition-all relative ${config.fullVoiceSpeakEnabled ? 'bg-[#00FF88]' : 'bg-slate-800'}`}
            >
              <div className={`w-5 h-5 bg-black rounded-full absolute top-0.5 transition-all ${config.fullVoiceSpeakEnabled ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>



      {/* 🔌 Replace Connection Tone with Custom MP3 */}
      <div className="bento-card p-5 space-y-4 bg-slate-950 border border-white/5">
        <div>
          <span className="text-[9px] bg-[#00FF88]/15 text-[#00FF88] font-bold px-2 py-0.5 rounded border border-[#00FF88]/20">CUSTOM AUDIO UPLOADER</span>
          <h3 className="text-xs font-black text-white uppercase tracking-wider mt-2">Replace Tones / मर्जी का MP3 लगाएं</h3>
          <p className="text-[10px] text-slate-400">Replace the welcome plug-in tone and full charge alert tone with your own custom MP3s</p>
        </div>

        <div className="space-y-3 pt-1">
          {/* Connection Tone Upload Row */}
          <div className="p-3.5 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
            <div>
              <span className="text-[8px] font-extrabold uppercase text-slate-500 block">🔌 Plug-In Connection Audio (MP3)</span>
              <p className="text-[11px] text-white font-bold mt-0.5">
                {hasCustomConnect ? "🎵 Custom MP3 Applied" : "🗣️ Standard Preset Voice Greeting"}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1 sm:mt-0">
              <button 
                onClick={handleConnectReplaceClick}
                className="p-2 px-3 bg-[#00FF88]/15 hover:bg-[#00FF88]/25 border border-[#00FF88]/20 text-[#00FF88] text-[10px] font-extrabold uppercase rounded-xl cursor-pointer transition-all active:scale-95 text-center shrink-0"
              >
                Replace MP3
              </button>
              <input 
                ref={connectInputRef}
                type="file" 
                accept="audio/*" 
                className="hidden" 
                onChange={handleConnectUpload} 
              />
              {hasCustomConnect && (
                <>
                  <button
                    onClick={() => {
                      const base64 = localStorage.getItem('custom_audio_connect');
                      if (base64) {
                        const audio = new Audio(base64);
                        audio.volume = config.volume / 100;
                        audio.play().catch(e => console.warn("Failed to play custom sound:", e));
                      }
                    }}
                    className="p-2.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/20 rounded-xl cursor-pointer transition-colors"
                  >
                    <Play size={12} fill="currentColor" />
                  </button>
                  <button
                    onClick={handleResetConnect}
                    className="p-2 px-3 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Full Charged Tone Upload Row */}
          <div className="p-3.5 bg-slate-900/60 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
            <div>
              <span className="text-[8px] font-extrabold uppercase text-slate-500 block">🔋 Full Charged Alert Audio (MP3)</span>
              <p className="text-[11px] text-white font-bold mt-0.5">
                {hasCustomFull ? "🎵 Custom MP3 Applied" : "🗣️ Standard Preset Full Charge Alert"}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1 sm:mt-0">
              <button 
                onClick={handleFullReplaceClick}
                className="p-2 px-3 bg-[#00FF88]/15 hover:bg-[#00FF88]/25 border border-[#00FF88]/20 text-[#00FF88] text-[10px] font-extrabold uppercase rounded-xl cursor-pointer transition-all active:scale-95 text-center shrink-0"
              >
                Replace MP3
              </button>
              <input 
                ref={fullInputRef}
                type="file" 
                accept="audio/*" 
                className="hidden" 
                onChange={handleFullUpload} 
              />
              {hasCustomFull && (
                <>
                  <button
                    onClick={() => {
                      const base64 = localStorage.getItem('custom_audio_full');
                      if (base64) {
                        const audio = new Audio(base64);
                        audio.volume = config.volume / 100;
                        audio.play().catch(e => console.warn("Failed to play custom sound:", e));
                      }
                    }}
                    className="p-2.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/20 rounded-xl cursor-pointer transition-colors"
                  >
                    <Play size={12} fill="currentColor" />
                  </button>
                  <button
                    onClick={handleResetFull}
                    className="p-2 px-3 bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/20 rounded-xl text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Reset
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Preset Custom Voice alert lists */}
      <div className="space-y-4">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Select Voice Presets / आवाज चुनें</h3>

        <div className="grid grid-cols-1 gap-3.5">
          {presets.map(p => {
            const isActive = currentPresetId === p.id;
            
            return (
              <div 
                key={p.id}
                onClick={() => selectPreset(p.connect, p.full)}
                className={`p-4 border rounded-[1.5rem] flex flex-col gap-3.5 cursor-pointer transition-all text-left ${
                  isActive 
                    ? 'bg-[#00FF88]/5 border-[#00FF88]/40 shadow-[0_5px_15px_rgba(3,255,136,0.06)]' 
                    : 'bg-slate-950/40 border-white/5 hover:border-white/10 hover:bg-slate-950/60'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-white">{p.name}</span>
                  {isActive && (
                    <span className="text-[9px] bg-[#00FF88]/15 text-[#00FF88] px-2 py-0.5 rounded font-extrabold uppercase">Selected</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Test Connect Statement */}
                  <div className="p-3 bg-slate-950/90 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] font-extrabold uppercase text-slate-500">🔌 Connection Tone</span>
                      <p className="text-[10.5px] text-slate-300 italic font-medium truncate mt-0.5">"{p.connect}"</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeechSpeak(p.connect, 'connect', p.id);
                      }}
                      className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg hover:bg-indigo-500/20 active:scale-95 transition-all text-center shrink-0"
                    >
                      {playingVoice === 'connect_active' ? (
                        <Volume2 size={12} className="animate-bounce" />
                      ) : (
                        <Play size={12} fill="currentColor" />
                      )}
                    </button>
                  </div>

                  {/* Test Full Statement */}
                  <div className="p-3 bg-slate-950/90 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-[8px] font-extrabold uppercase text-slate-500">🔋 Full Charged Tone</span>
                      <p className="text-[10.5px] text-slate-300 italic font-medium truncate mt-0.5">"{p.full}"</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSpeechSpeak(p.full, 'full', p.id);
                      }}
                      className="p-2.5 bg-[#00FF88]/10 border border-[#00FF88]/20 text-[#00FF88] rounded-lg hover:bg-[#00FF88]/20 active:scale-95 transition-all text-center shrink-0"
                    >
                      {playingVoice === 'full_active' ? (
                        <Volume2 size={12} className="animate-bounce" />
                      ) : (
                        <Play size={12} fill="currentColor" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanatory footer block */}
      <div className="bento-card p-4 text-slate-500 text-[10px] leading-relaxed">
        <strong>💡 Real Voice Alerts Enabled:</strong> This feature utilizes pre-installed, offline-ready high-quality MP3 voice assets designed to play seamlessly on your device. When active, plugging or unplugging the charger will welcome or alert you loud and clear.
      </div>
    </motion.div>
  );
}
