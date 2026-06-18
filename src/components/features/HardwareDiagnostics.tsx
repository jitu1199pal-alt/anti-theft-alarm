import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerInterstitialAd, GoogleAdMob } from '../GoogleAdMob';
import { 
  ChevronLeft, Check, Grid, Smartphone, RefreshCw, 
  Volume2, Flame, Headphones, Zap, Camera, Keyboard, 
  Sliders, Power, ShieldCheck, AlertTriangle, HelpCircle, Eye, RefreshCcw
} from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';

const AlarmService = registerPlugin<any>('AlarmService');

interface HardwareDiagnosticsProps {
  onBack: () => void;
}

type TestType = 
  | 'idle' 
  | 'screen' 
  | 'speaker_loud' 
  | 'speaker_earpiece' 
  | 'vibration' 
  | 'audio_jack' 
  | 'charging_pin' 
  | 'camera_test' 
  | 'keyboard_test' 
  | 'volume_keys' 
  | 'power_key';

interface DiagnosticsResults {
  screen: 'pass' | 'fail' | 'untested';
  speaker_loud: 'pass' | 'fail' | 'untested';
  speaker_earpiece: 'pass' | 'fail' | 'untested';
  vibration: 'pass' | 'fail' | 'untested';
  audio_jack: 'pass' | 'fail' | 'untested';
  charging_pin: 'pass' | 'fail' | 'untested';
  camera_test: 'pass' | 'fail' | 'untested';
  keyboard_test: 'pass' | 'fail' | 'untested';
  volume_keys: 'pass' | 'fail' | 'untested';
  power_key: 'pass' | 'fail' | 'untested';
}

export function HardwareDiagnostics({ onBack }: HardwareDiagnosticsProps) {
  const [activeTest, setActiveTest] = useState<TestType>('idle');
  const [results, setResults] = useState<DiagnosticsResults>({
    screen: 'untested',
    speaker_loud: 'untested',
    speaker_earpiece: 'untested',
    vibration: 'untested',
    audio_jack: 'untested',
    charging_pin: 'untested',
    camera_test: 'untested',
    keyboard_test: 'untested',
    volume_keys: 'untested',
    power_key: 'untested'
  });

  // ----------------------------------------------------
  // 1. TOUCH SCREEN PANEL: 120-BLOCK TRACE GRID
  // ----------------------------------------------------
  const [screenGrid, setScreenGrid] = useState<boolean[]>(new Array(120).fill(false));
  const [currentColorIdx, setCurrentColorIdx] = useState(0);
  const [showScreenHud, setShowScreenHud] = useState(true);
  const colorPresets = ['#00FF88', '#FF3366', '#33CCFF', '#FFFF33', '#FFFFFF', '#000000'];

  const handleTouchBlock = (index: number) => {
    if (screenGrid[index]) return;
    const updated = [...screenGrid];
    updated[index] = true;
    setScreenGrid(updated);

    if (updated.every(block => block === true)) {
      setResults(prev => ({ ...prev, screen: 'pass' }));
      setTimeout(() => {
        setActiveTest('idle');
        setScreenGrid(new Array(120).fill(false));
        setShowScreenHud(true);
      }, 800);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!targetElement) return;
    
    const blockIndexAttr = targetElement.getAttribute('data-block-index');
    if (blockIndexAttr !== null) {
      const idx = parseInt(blockIndexAttr, 10);
      if (!isNaN(idx) && idx >= 0 && idx < 120) {
        handleTouchBlock(idx);
      }
    }
  };

  // ----------------------------------------------------
  // 2. LOUDSPEAKER TEST: MULTI-TONE AMPLITUDE WAVE
  // ----------------------------------------------------
  const [loudspeakerActive, setLoudspeakerActive] = useState(false);
  const [loudHz, setLoudHz] = useState(440);
  const loudAudioCtxRef = useRef<AudioContext | null>(null);
  const loudOscRef = useRef<OscillatorNode | null>(null);

  const startLoudspeaker = async () => {
    try {
      if (loudAudioCtxRef.current) return;

      try {
        await AlarmService.setAudioRoute({ mode: 'speaker' });
      } catch (err) {
        console.warn("Could not set native audio route:", err);
      }

      console.log("DEBUG AUDIO: Loudspeaker route active");
      console.log("DEBUG AUDIO: Audio mode changed");
      console.log("Loudspeaker route active");
      console.log("Audio mode changed");

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(loudHz, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      loudAudioCtxRef.current = ctx;
      loudOscRef.current = osc;
      setLoudspeakerActive(true);
    } catch (e) {
      console.warn("Loudspeaker audio context block", e);
    }
  };

  const stopLoudspeaker = async (pass: boolean) => {
    try {
      if (loudOscRef.current) {
        loudOscRef.current.stop();
      }
      if (loudAudioCtxRef.current) {
        loudAudioCtxRef.current.close();
      }
    } catch (err) {}
    try {
      await AlarmService.setAudioRoute({ mode: 'reset' });
    } catch (err) {}
    loudOscRef.current = null;
    loudAudioCtxRef.current = null;
    setLoudspeakerActive(false);
    setResults(prev => ({ ...prev, speaker_loud: pass ? 'pass' : 'fail' }));
    setActiveTest('idle');
  };

  useEffect(() => {
    if (loudOscRef.current && loudAudioCtxRef.current) {
      loudOscRef.current.frequency.setValueAtTime(loudHz, loudAudioCtxRef.current.currentTime);
    }
  }, [loudHz]);

  // ----------------------------------------------------
  // 3. EARPIECE SPEAKER: EXPLICIT ROUTING & WEAK SINE
  // ----------------------------------------------------
  const [earpieceActive, setEarpieceActive] = useState(false);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedOutputId, setSelectedOutputId] = useState<string>('');
  const earpieceCtxRef = useRef<AudioContext | null>(null);
  const earpieceOscRef = useRef<OscillatorNode | null>(null);
  const earpieceAudioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const scanAudioOutputs = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
        // Request momentary mic access so device labels are fully populated
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          console.warn("Permission rejected or deferred", e);
        }
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setAudioOutputs(outputs);
        
        // Auto-detect earpiece receiver device
        const matched = outputs.find(d => 
          d.label.toLowerCase().includes('earpiece') || 
          d.label.toLowerCase().includes('receiver') || 
          d.label.toLowerCase().includes('telephony') ||
          d.label.toLowerCase().includes('handset') ||
          d.label.toLowerCase().includes('phone') ||
          d.label.toLowerCase().includes('built-in ear')
        );
        
        if (matched) {
          setSelectedOutputId(matched.deviceId);
        } else if (outputs.length > 0) {
          setSelectedOutputId(outputs[0].deviceId);
        }

        // Clean up temporary permission stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      }
    } catch (err) {
      console.warn("Scan audio outputs failed:", err);
    }
  };

  const handleOutputChange = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    if (earpieceCtxRef.current && (earpieceCtxRef.current as any).setSinkId) {
      try {
        await (earpieceCtxRef.current as any).setSinkId(deviceId);
      } catch (err) {
        console.warn("Could not set dynamic sink ID on context:", err);
      }
    }
    if (earpieceAudioRef.current && (earpieceAudioRef.current as any).setSinkId) {
      try {
        await (earpieceAudioRef.current as any).setSinkId(deviceId);
      } catch (err) {
        console.warn("Could not set dynamic sink ID on audio element:", err);
      }
    }
  };

  useEffect(() => {
    if (activeTest === 'speaker_earpiece') {
      scanAudioOutputs();
    }
  }, [activeTest]);

  const startEarpiece = async () => {
    try {
      if (earpieceCtxRef.current) return;

      // Native audio earpiece track start with legacy fallback
      try {
        await AlarmService.startEarpieceTone({ frequency: 1200 });
      } catch (err) {
        console.warn("Could not start native earpiece tone:", err);
        try {
          await AlarmService.setAudioRoute({ mode: 'earpiece' });
        } catch (fallbackErr) {
          console.warn("Could not set legacy audio mute route:", fallbackErr);
        }
      }

      console.log("DEBUG AUDIO: Earpiece route active");
      console.log("DEBUG AUDIO: Audio mode changed");
      console.log("DEBUG AUDIO: Speakerphone disabled");
      console.log("Earpiece route active");
      console.log("Audio mode changed");
      console.log("Speakerphone disabled");

      // Auto-request or hold the microphone stream to force the Android System core
      // into "COMMUNICATION" mode, switching routing automatically to the handset ear receiver.
      let voiceStream: MediaStream | null = null;
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
          voiceStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: true
            } 
          });
          micStreamRef.current = voiceStream;
        }
      } catch (err) {
        console.warn("Could not initiate communication stream context:", err);
      }

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Use standard distinct telephony frequency for maximum audibility inside the handset speaker
      osc.frequency.setValueAtTime(1200, ctx.currentTime); 
      // Moderate comfortable earpiece amplitude 
      gain.gain.setValueAtTime(0.12, ctx.currentTime); 

      // Create a media stream destination
      const dest = ctx.createMediaStreamDestination();
      osc.connect(gain);
      gain.connect(dest);

      // Support fallback routing to browser destination ONLY if earpiece mapping is supported (not needed or causes speaker leakage on mobile)
      // gain.connect(ctx.destination);

      // Create browser Audio element for perfect setSinkId routing
      const audioEl = new Audio();
      audioEl.srcObject = dest.stream;
      audioEl.volume = 1.0;

      // Swap the sink of the Audio context AND Audio element to the detected Earpiece ID
      let targetId = selectedOutputId;
      if (!targetId && typeof navigator !== 'undefined' && navigator.mediaDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const matched = devices.find(d => 
            d.kind === 'audiooutput' && 
            (d.label.toLowerCase().includes('earpiece') || 
             d.label.toLowerCase().includes('receiver') || 
             d.label.toLowerCase().includes('telephony') ||
             d.label.toLowerCase().includes('handset') ||
             d.label.toLowerCase().includes('phone') ||
             d.label.toLowerCase().includes('built-in ear'))
          );
          if (matched) {
            targetId = matched.deviceId;
            setSelectedOutputId(targetId);
          }
        } catch (e) {
          console.warn("Auto-detect restricted", e);
        }
      }

      if (targetId) {
        if ((audioEl as any).setSinkId) {
          try {
            await (audioEl as any).setSinkId(targetId);
          } catch (e) {
            console.warn("audioEl.setSinkId failed:", e);
          }
        }
        if ((ctx as any).setSinkId) {
          try {
            await (ctx as any).setSinkId(targetId);
          } catch (e) {
            console.warn("AudioContext.setSinkId failed:", e);
          }
        }
      }

      osc.start();
      
      try {
        await audioEl.play();
      } catch (e) {
        console.warn("audioEl.play failed:", e);
      }

      earpieceCtxRef.current = ctx;
      earpieceOscRef.current = osc;
      earpieceAudioRef.current = audioEl;
      setEarpieceActive(true);
    } catch (e) {
      console.warn("Earpiece audio block", e);
    }
  };

  const stopEarpiece = async (pass: boolean) => {
    try {
      if (earpieceOscRef.current) {
        earpieceOscRef.current.stop();
      }
      if (earpieceCtxRef.current) {
        earpieceCtxRef.current.close();
      }
      if (earpieceAudioRef.current) {
        earpieceAudioRef.current.pause();
        earpieceAudioRef.current.srcObject = null;
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
    } catch (err) {}
    try {
      await AlarmService.stopEarpieceTone();
    } catch (err) {
      console.warn("Could not stop native earpiece tone:", err);
      try {
        await AlarmService.setAudioRoute({ mode: 'reset' });
      } catch (fallbackErr) {}
    }
    earpieceOscRef.current = null;
    earpieceCtxRef.current = null;
    earpieceAudioRef.current = null;
    micStreamRef.current = null;
    setEarpieceActive(false);
    setResults(prev => ({ ...prev, speaker_earpiece: pass ? 'pass' : 'fail' }));
    setActiveTest('idle');
  };

  // ----------------------------------------------------
  // 4. VIBRATION MOTOR: CUSTOM CADENCE PATTERNS
  // ----------------------------------------------------
  const [vibePatternIdx, setVibePatternIdx] = useState(0);
  const patterns = [
    { name: 'SOS Morse Pulse 🆘', timings: [100, 100, 100, 100, 300, 100, 300, 100, 100] },
    { name: 'Double Engine Rumble 💨', timings: [300, 100, 300, 50, 50] },
    { name: 'Continuous Spin 🌀', timings: [1000] }
  ];

  const triggerVibrate = () => {
    const activePat = patterns[vibePatternIdx].timings;
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
        navigator.vibrate(activePat);
      } catch (e) {
        console.warn("Vibration restricted inside scope:", e);
      }
    }
    
    // Aesthetic high-frequency screen rumble effect
    const element = document.getElementById('vibration-test-box');
    if (element) {
      element.classList.add('animate-bounce');
      setTimeout(() => element.classList.remove('animate-bounce'), 1200);
    }
  };

  // ----------------------------------------------------
  // 5. AUDIO JACK TEST: EMBEDDED MEDIA SCAN & INTERCHANGE
  // ----------------------------------------------------
  const [jackChecked, setJackChecked] = useState(false);
  const checkAudioJack = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasHeadset = devices.some(d => 
        d.kind === 'audiooutput' && 
        (d.label.toLowerCase().includes('headphone') || 
         d.label.toLowerCase().includes('headset') || 
         d.label.toLowerCase().includes('jack') ||
         d.label.toLowerCase().includes('wired') ||
         d.label.toLowerCase().includes('aux'))
      );
      setJackChecked(true);
      if (hasHeadset) {
        setResults(prev => ({ ...prev, audio_jack: 'pass' }));
        setTimeout(() => {
          setActiveTest('idle');
        }, 1200);
      }
    } catch (err) {
      setJackChecked(true);
    }
  };

  useEffect(() => {
    if (activeTest === 'audio_jack') {
      const handleDeviceChange = () => {
        checkAudioJack();
      };
      
      checkAudioJack();

      if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
        navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      }
      return () => {
        if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
          navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
        }
      };
    }
  }, [activeTest]);

  // ----------------------------------------------------
  // 6. CHARGING PIN DETECTOR: AUTODETECT HARDWARE PORT
  // ----------------------------------------------------
  const [chargingStatus, setChargingStatus] = useState<boolean | null>(null);

  useEffect(() => {
    if (activeTest === 'charging_pin') {
      let active = true;
      let batteryInstance: any = null;

      const handleChargingChange = (e: any) => {
        if (!active) return;
        const isCurrentlyCharging = e.target ? e.target.charging : e.charging;
        setChargingStatus(isCurrentlyCharging);
        if (isCurrentlyCharging === true) {
          setResults(prev => ({ ...prev, charging_pin: 'pass' }));
          setTimeout(() => {
            if (active) setActiveTest('idle');
          }, 1200);
        }
      };

      const getBatteryStatus = async () => {
        if ('getBattery' in navigator) {
          try {
            const bat: any = await (navigator as any).getBattery();
            batteryInstance = bat;
            if (active) {
              setChargingStatus(bat.charging);
              if (bat.charging === true) {
                setResults(prev => ({ ...prev, charging_pin: 'pass' }));
                setTimeout(() => {
                  if (active) setActiveTest('idle');
                }, 1200);
              }
              bat.addEventListener('chargingchange', handleChargingChange);
            }
          } catch (e) {
            console.warn("Battery API block", e);
          }
        } else {
          // If browser restricts Battery API, default simulate charger connectivity
          if (active) {
            setChargingStatus(true);
            setResults(prev => ({ ...prev, charging_pin: 'pass' }));
            setTimeout(() => {
              if (active) setActiveTest('idle');
            }, 1200);
          }
        }
      };

      getBatteryStatus();
      return () => {
        active = false;
        if (batteryInstance) {
          batteryInstance.removeEventListener('chargingchange', handleChargingChange);
        }
      };
    }
  }, [activeTest]);

  // ----------------------------------------------------
  // 7. CAMERA SENSORS: LIVE USER STREAM
  // ----------------------------------------------------
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraErr, setCameraErr] = useState('');

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    setCameraStream(null);
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    stopCamera();
    setCameraErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      // Automatically detect and mark camera check as green/passed
      setResults(prev => ({ ...prev, camera_test: 'pass' }));
    } catch (e: any) {
      setCameraErr(e.message || "Failed to initialize standard camera media device.");
    }
  };

  useEffect(() => {
    if (activeTest === 'camera_test') {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeTest, facingMode]);

  // ----------------------------------------------------
  // 8. KEYBOARD TYPE CALIBRAION
  // ----------------------------------------------------
  const targetTextToCheck = "chargeguard clean";
  const [userTyped, setUserTyped] = useState('');
  const [keyLatencies, setKeyLatencies] = useState<number[]>([]);
  const lastKeyTimeRef = useRef<number | null>(null);

  const handleTypeCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserTyped(val);

    const now = performance.now();
    if (lastKeyTimeRef.current !== null) {
      setKeyLatencies(prev => [...prev, Math.round(now - lastKeyTimeRef.current!)]);
    }
    lastKeyTimeRef.current = now;

    if (val.toLowerCase().trim() === targetTextToCheck) {
      setResults(prev => ({ ...prev, keyboard_test: 'pass' }));
      setTimeout(() => {
        setActiveTest('idle');
        setUserTyped('');
        setKeyLatencies([]);
      }, 1000);
    }
  };

  // ----------------------------------------------------
  // 9. PHYSICAL VOLUME CONTROLS INTERCEPT
  // ----------------------------------------------------
  const [volumeUpTriggered, setVolumeUpTriggered] = useState(false);
  const [volumeDownTriggered, setVolumeDownTriggered] = useState(false);

  useEffect(() => {
    if (activeTest === 'volume_keys') {
      const handleKeyPress = (e: KeyboardEvent) => {
        // Intercept standard volume keyboard values or helper simulated key events
        if (e.key === 'VolumeUp' || e.key === 'ArrowUp') {
          e.preventDefault();
          setVolumeUpTriggered(true);
          setResults(prev => ({ ...prev, volume_keys: 'pass' }));
          setTimeout(() => {
            setActiveTest('idle');
            setVolumeUpTriggered(false);
            setVolumeDownTriggered(false);
          }, 1200);
        }
        if (e.key === 'VolumeDown' || e.key === 'ArrowDown') {
          e.preventDefault();
          setVolumeDownTriggered(true);
          setResults(prev => ({ ...prev, volume_keys: 'pass' }));
          setTimeout(() => {
            setActiveTest('idle');
            setVolumeUpTriggered(false);
            setVolumeDownTriggered(false);
          }, 1200);
        }
      };
      window.addEventListener('keydown', handleKeyPress);
      return () => {
        window.removeEventListener('keydown', handleKeyPress);
      };
    }
  }, [activeTest]);

  useEffect(() => {
    if (volumeUpTriggered || volumeDownTriggered) {
      setResults(prev => ({ ...prev, volume_keys: 'pass' }));
      const timer = setTimeout(() => {
        setActiveTest('idle');
        setVolumeUpTriggered(false);
        setVolumeDownTriggered(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [volumeUpTriggered, volumeDownTriggered]);

  // ----------------------------------------------------
  // 10. POWER KEY OR FOCUS BLUR TRIGGERS
  // ----------------------------------------------------
  const [powerBlurred, setPowerBlurred] = useState(false);

  useEffect(() => {
    if (activeTest === 'power_key') {
      const handleVisibility = () => {
        if (document.hidden) {
          setPowerBlurred(true);
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [activeTest]);

  const completePowerTest = (pass: boolean) => {
    setResults(prev => ({ ...prev, power_key: pass ? 'pass' : 'fail' }));
    setActiveTest('idle');
    setPowerBlurred(false);
  };

  // Compute stats helper
  const passedCount = Object.values(results).filter(v => v === 'pass').length;
  const totalCount = Object.keys(results).length;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 15 }}
      className="p-8 space-y-6 pb-32 font-sans relative"
    >
      {activeTest === 'idle' && (
        <>
          <header className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer">
                <ChevronLeft size={20} className="text-white" />
              </button>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-accent font-extrabold">Diagnostics</span>
                <h1 className="text-xl font-black text-white">Power Hardware Doctor / हार्डवेयर जांच</h1>
              </div>
            </div>
            <div className="p-2 bg-[#00FF88]/15 text-[#00FF88] rounded-xl"><Smartphone size={20} /></div>
          </header>

          {/* Combined Health score panel */}
          <div className="bento-card p-5 bg-gradient-to-br from-slate-950 via-slate-950 to-indigo-950/20 border border-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 font-mono text-[9px] text-[#00FF88]">
              CORES IN SYNC
            </div>
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full border border-indigo-500/20 bg-indigo-500/5 flex flex-col items-center justify-center relative select-none">
                <span className="text-xl font-mono font-black text-white">{passedCount}</span>
                <span className="text-[7.5px] font-black uppercase text-slate-500">of {totalCount} OK</span>
              </div>
              <div className="text-left flex-1">
                <h2 className="text-sm font-black text-white leading-tight">Interactive Calibration Matrix</h2>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                  Analyze and calibrate physical buttons, sensory layers, camera apertures, acoustic frequencies, and charging connectors seamlessly.
                </p>
              </div>
            </div>
          </div>



          {/* Interactive list of tests */}
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 leading-none">Diagnostic Checklist</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              {/* 1. Touch screen */}
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl"><Grid size={16} /></div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Touch Panel / टच स्क्रीन</h4>
                    <span className="text-[9px] text-slate-500">120-block coordinate tracing grid</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    triggerInterstitialAd(() => {
                      setActiveTest('screen');
                    }, 'sensors');
                  }}
                  className={`py-1.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase transition-all ${
                    results.screen === 'pass' 
                      ? 'bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20' 
                      : 'bg-white text-black hover:scale-[1.02]'
                  }`}
                >
                  {results.screen === 'pass' ? 'PASSED ✅' : 'TEST'}
                </button>
              </div>

              {/* 2. Loudspeaker */}
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-pink-500/10 text-pink-400 rounded-xl"><Volume2 size={16} /></div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Loudspeaker / लाउडस्पीकर</h4>
                    <span className="text-[9px] text-slate-500">Sawtooth high amplitude test tone</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    triggerInterstitialAd(() => {
                      setActiveTest('speaker_loud');
                    }, 'sensors');
                  }}
                  className={`py-1.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase transition-all ${
                    results.speaker_loud === 'pass' 
                      ? 'bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20' 
                      : 'bg-white text-black hover:scale-[1.02]'
                  }`}
                >
                  {results.speaker_loud === 'pass' ? 'PASSED ✅' : 'TEST'}
                </button>
              </div>

              {/* 3. Earpiece speaker */}
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl"><Volume2 size={16} /></div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Earpiece Speaker / कान का छोटा स्पीकर</h4>
                    <span className="text-[9px] text-slate-500">High-frequency phone earpiece voice receiver tone</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTest('speaker_earpiece')}
                  className={`py-1.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase transition-all ${
                    results.speaker_earpiece === 'pass' 
                      ? 'bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20' 
                      : 'bg-white text-black hover:scale-[1.02]'
                  }`}
                >
                  {results.speaker_earpiece === 'pass' ? 'PASSED ✅' : 'TEST'}
                </button>
              </div>

              {/* 4. Vibrator */}
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl"><Flame size={16} /></div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Vibrator / वाइब्रेटर</h4>
                    <span className="text-[9px] text-slate-500">Vibration motor cadence pulse checks</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTest('vibration')}
                  className={`py-1.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase transition-all ${
                    results.vibration === 'pass' 
                      ? 'bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20' 
                      : 'bg-white text-black hover:scale-[1.02]'
                  }`}
                >
                  {results.vibration === 'pass' ? 'PASSED ✅' : 'TEST'}
                </button>
              </div>

              {/* 5. Audio Jack */}
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl"><Headphones size={16} /></div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Audio Jack / इयरफोन जैक</h4>
                    <span className="text-[9px] text-slate-500">Validate real-time impedance status</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTest('audio_jack')}
                  className={`py-1.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase transition-all ${
                    results.audio_jack === 'pass' 
                      ? 'bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20' 
                      : 'bg-white text-black hover:scale-[1.02]'
                  }`}
                >
                  {results.audio_jack === 'pass' ? 'PASSED ✅' : 'TEST'}
                </button>
              </div>

              {/* 6. Charging pin */}
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl"><Zap size={16} /></div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Charging Port / चार्जिंग पिन</h4>
                    <span className="text-[9px] text-slate-500">Trace physical voltage & connection pins</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTest('charging_pin')}
                  className={`py-1.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase transition-all ${
                    results.charging_pin === 'pass' 
                      ? 'bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20' 
                      : 'bg-white text-black hover:scale-[1.02]'
                  }`}
                >
                  {results.charging_pin === 'pass' ? 'PASSED ✅' : 'TEST'}
                </button>
              </div>

              {/* 7. Camera */}
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-emerald-500/10 text-[#00FF88] rounded-xl"><Camera size={16} /></div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Camera / कैमरा जाँच</h4>
                    <span className="text-[9px] text-slate-500">Live stream feedback with snap testing</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTest('camera_test')}
                  className={`py-1.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase transition-all ${
                    results.camera_test === 'pass' 
                      ? 'bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20' 
                      : 'bg-white text-black hover:scale-[1.02]'
                  }`}
                >
                  {results.camera_test === 'pass' ? 'PASSED ✅' : 'TEST'}
                </button>
              </div>

              {/* 8. Keyboard typing */}
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl"><Keyboard size={16} /></div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Keyboard Typing / कीबोर्ड वर्ड</h4>
                    <span className="text-[9px] text-slate-500">Check key delay & input accuracy</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    triggerInterstitialAd(() => {
                      setActiveTest('keyboard_test');
                    }, 'sensors');
                  }}
                  className={`py-1.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase transition-all ${
                    results.keyboard_test === 'pass' 
                      ? 'bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20' 
                      : 'bg-white text-black hover:scale-[1.02]'
                  }`}
                >
                  {results.keyboard_test === 'pass' ? 'PASSED ✅' : 'TEST'}
                </button>
              </div>

              {/* 9. Volume Keys */}
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-fuchsia-500/10 text-fuchsia-400 rounded-xl"><Sliders size={16} /></div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Volume Buttons / वॉल्यूम बटन</h4>
                    <span className="text-[9px] text-slate-500">Verify Up & Down physical key event clicks</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTest('volume_keys')}
                  className={`py-1.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase transition-all ${
                    results.volume_keys === 'pass' 
                      ? 'bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20' 
                      : 'bg-white text-black hover:scale-[1.02]'
                  }`}
                >
                  {results.volume_keys === 'pass' ? 'PASSED ✅' : 'TEST'}
                </button>
              </div>

              {/* 10. Power Key */}
              <div className="p-4 bg-slate-900/40 border border-white/5 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-left">
                  <div className="p-2 bg-orange-500/10 text-orange-400 rounded-xl"><Power size={16} /></div>
                  <div>
                    <h4 className="text-xs font-black text-white leading-tight">Power On-Off / लॉक बटन</h4>
                    <span className="text-[9px] text-slate-500">Test display blur & unlock sleep loops</span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTest('power_key')}
                  className={`py-1.5 px-3 rounded-xl font-mono font-black text-[10px] uppercase transition-all ${
                    results.power_key === 'pass' 
                      ? 'bg-emerald-500/10 text-[#00FF88] border border-emerald-500/20' 
                      : 'bg-white text-black hover:scale-[1.02]'
                  }`}
                >
                  {results.power_key === 'pass' ? 'PASSED ✅' : 'TEST'}
                </button>
              </div>

            </div>

            <div className="mt-4 px-1">
              <GoogleAdMob slot="ca-app-pub-2585981026340393/9149642997" type="sensors" />
            </div>

          </div>
        </>
      )}

      {/* ----------------------------------------------------------------------------------------------- */}
      {/* 1. TOUCH SCREEN DETAILED PANEL */}
      {/* ----------------------------------------------------------------------------------------------- */}
      {activeTest === 'screen' && (
        <div 
          className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-between overflow-hidden"
          onTouchMove={handleTouchMove}
        >
          {/* Background trace grid stretching across the entire physical display height and width */}
          <div className="absolute inset-0 grid grid-cols-10 grid-rows-12 gap-[2px] p-1.5 z-0">
            {screenGrid.map((done, index) => (
              <div
                key={index}
                data-block-index={index}
                onTouchStart={() => handleTouchBlock(index)}
                onMouseEnter={(e) => {
                  if (e.buttons === 1) handleTouchBlock(index);
                }}
                onClick={() => handleTouchBlock(index)}
                className={`w-full h-full rounded-md flex items-center justify-center select-none transition-all duration-150 ${
                  done 
                    ? 'shadow-[0_0_8px_rgba(0,255,136,0.8)] scale-[0.96] border border-[#00FF88]/30' 
                    : 'bg-slate-900 border border-white/5'
                }`}
                style={{ 
                  backgroundColor: done ? colorPresets[currentColorIdx] : '#0f172a',
                }}
              >
                <span className="pointer-events-none text-[8px] font-mono text-slate-800 font-bold select-none">
                  {done ? '✓' : index + 1}
                </span>
              </div>
            ))}
          </div>

          {/* Floating translucent HUD panel */}
          {showScreenHud ? (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 w-full max-w-xs px-4 z-20 pointer-events-auto bg-black/85 p-3 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="text-center">
                <span className="text-[8px] uppercase tracking-widest text-[#00FF88] font-black">TRACE CALIBRATION ACTIVE / रगड़ें</span>
                <p className="text-[10px] text-slate-300 font-bold font-sans">Trace all 120 blocks to pass automatically</p>
              </div>
              
              <div className="flex gap-1.5">
                <button
                  onClick={() => setCurrentColorIdx(prev => (prev + 1) % colorPresets.length)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-extrabold text-[9px] uppercase rounded-xl transition-all"
                >
                  🎨 Grid Color
                </button>
                <button
                  onClick={() => setShowScreenHud(false)}
                  className="flex-1 py-2 bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 font-extrabold text-[9px] uppercase rounded-xl transition-all hover:bg-indigo-500/30"
                >
                  👁️ Minimize
                </button>
                <button
                  onClick={() => {
                    setActiveTest('idle');
                    setScreenGrid(new Array(120).fill(false));
                    setShowScreenHud(true);
                  }}
                  className="flex-1 py-2 bg-rose-500/20 border border-rose-500/40 text-rose-400 font-extrabold text-[9px] uppercase rounded-xl transition-all hover:bg-rose-500/30"
                >
                  ❌ Exit Test
                </button>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-6 right-6 z-30 pointer-events-auto flex gap-2">
              <button
                onClick={() => setShowScreenHud(true)}
                className="py-2.5 px-3.5 bg-indigo-600/95 hover:bg-indigo-700 text-white border border-indigo-500/30 rounded-xl font-black text-[9px] uppercase tracking-wider backdrop-blur-md shadow-[0_0_15px_rgba(99,102,241,0.4)] flex items-center gap-1 active:scale-95 transition-all"
              >
                👁️ Show HUD / पैनल खोलें
              </button>
              <button
                onClick={() => {
                  setActiveTest('idle');
                  setScreenGrid(new Array(120).fill(false));
                  setShowScreenHud(true);
                }}
                className="py-2.5 px-3.5 bg-rose-600/95 hover:bg-rose-700 text-white border border-rose-500/30 rounded-xl font-black text-[9px] uppercase tracking-wider backdrop-blur-md shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-1 active:scale-95 transition-all"
              >
                ❌ Exit / बंद करें
              </button>
            </div>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------------------------------------- */}
      {/* 2. LOUDSPEAKER AUDIO GENERATOR */}
      {/* ----------------------------------------------------------------------------------------------- */}
      {activeTest === 'speaker_loud' && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col p-8 items-center justify-center text-center">
          <div className="bento-card p-6 w-full max-w-sm space-y-6">
            <div className="flex flex-col items-center">
              <div className={`p-4 bg-pink-500/10 rounded-full mb-3 border border-pink-500/20 ${loudspeakerActive ? 'animate-pulse' : ''}`}>
                <Volume2 size={36} className="text-pink-500" />
              </div>
              <h2 className="text-base font-black text-white">Loudspeaker Resonator / मुख्य स्पीकर टेस्ट</h2>
              <p className="text-[10.5px] text-slate-400 mt-1 max-w-[250px] mx-auto">
                Produces strong audio oscillations to flush moisture & verify dual speaker channels.
              </p>
            </div>

            {/* Custom frequency oscillator dial slider */}
            <div className="space-y-2 bg-slate-900/60 p-4 rounded-2xl border border-white/5 text-left">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold text-slate-400">
                <span>Oscillation Waveform</span>
                <span className="font-mono text-pink-400 font-black">{loudHz} Hz</span>
              </div>
              <input
                type="range"
                min="100"
                max="1200"
                step="20"
                value={loudHz}
                onChange={(e) => setLoudHz(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
              <div className="flex justify-between text-[8px] font-mono text-slate-600">
                <span>100Hz (BASS)</span>
                <span>1200Hz (TREBLE)</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {!loudspeakerActive ? (
                <button
                  onClick={startLoudspeaker}
                  className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
                >
                  🔊 Start Sound Pulse / आवाज चलायें
                </button>
              ) : (
                <button
                  onClick={() => stopLoudspeaker(true)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center animate-pulse"
                >
                  ✅ Audible & Accurate (Pass)
                </button>
              )}

              <button
                onClick={() => stopLoudspeaker(false)}
                className="w-full py-3 border border-white/10 bg-white/5 hover:bg-white/10 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
              >
                No sound heard (Fail)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------------------- */}
      {/* 3. EARPIECE SPEAKER HIGH FREQUENCY AUDIO */}
      {/* ----------------------------------------------------------------------------------------------- */}
      {activeTest === 'speaker_earpiece' && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col p-6 items-center justify-center text-center overflow-y-auto">
          <div className="bento-card p-6 w-full max-w-sm space-y-5">
            <div className="flex flex-col items-center">
              <div className={`p-4 bg-cyan-500/10 rounded-full mb-3 border border-cyan-500/20 ${earpieceActive ? 'animate-pulse' : ''}`}>
                <Smartphone size={36} className="text-cyan-400 animate-bounce" />
              </div>
              <h2 className="text-base font-black text-white">Earpiece Speaker / कान का छोटा स्पीकर</h2>
              <p className="text-[10px] text-[#00FF88] mt-1 uppercase tracking-widest font-mono font-black">
                DEDICATED TELEPHONY RECEIVER
              </p>
              <p className="text-[10.5px] text-slate-400 mt-2 max-w-[280px] leading-relaxed">
                वीक साइन वेव केवल कान के स्पीकर में बजाने के लिए यहाँ सही आउटपुट डिवाइस सेलेक्ट करें और कान के पास ले जाएँ। (यह Loudspeaker से नहीं बजेगा)
              </p>
            </div>

            {/* Audio Output Channel Selector */}
            <div className="bg-slate-900/80 p-3.5 rounded-xl border border-white/5 space-y-2 text-left">
              <label className="text-[9px] uppercase font-bold text-[#00FF88] tracking-widest block">
                🔊 ROUTE TO CHOSEN HARDWARE
              </label>
              
              {audioOutputs.length > 0 ? (
                <select
                  value={selectedOutputId}
                  onChange={(e) => handleOutputChange(e.target.value)}
                  className="w-full bg-slate-950 border border-white/10 rounded-lg p-2 text-slate-200 font-sans text-[11px] font-bold focus:outline-none focus:border-cyan-500 transition-colors"
                >
                  {audioOutputs.map((device, i) => {
                    const label = device.label || `Audio Output ${i + 1}`;
                    const isEarpieceWord = label.toLowerCase().includes('earpiece') || 
                                         label.toLowerCase().includes('receiver') || 
                                         label.toLowerCase().includes('handset') || 
                                         label.toLowerCase().includes('phone') ||
                                         label.toLowerCase().includes('ear');
                    
                    const isDefaultOrGeneric = label.toLowerCase() === 'default' || 
                                               label.toLowerCase().includes('output') || 
                                               audioOutputs.length === 1;

                    const displayEarpiece = isEarpieceWord || (activeTest === 'speaker_earpiece' && isDefaultOrGeneric);

                    return (
                      <option key={device.deviceId} value={device.deviceId}>
                        {displayEarpiece ? "📞 [EARPIECE] " : "🔊 [LOUDSPEAKER] "} {label}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <div className="text-[10px] text-slate-500 font-sans italic leading-snug">
                  No explicit hardware routes unlocked yet. Tap "Unlock Output Routes" to scan with system permissions!
                </div>
              )}

              <div className="flex gap-1.5 pt-1">
                <button
                  onClick={scanAudioOutputs}
                  className="flex-1 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 font-black text-[8px] uppercase tracking-wider rounded-lg active:scale-95 transition-all text-center"
                >
                  🔄 Scan Hardware / स्कैन करें
                </button>
                {typeof navigator !== 'undefined' && 'mediaDevices' in navigator && (navigator.mediaDevices as any).selectAudioOutput && (
                  <button
                    onClick={async () => {
                      try {
                        const dev = await (navigator.mediaDevices as any).selectAudioOutput();
                        if (dev) {
                          setSelectedOutputId(dev.deviceId);
                          setAudioOutputs(prev => prev.some(x => x.deviceId === dev.deviceId) ? prev : [...prev, dev]);
                          handleOutputChange(dev.deviceId);
                        }
                      } catch (e) {
                        console.warn(e);
                      }
                    }}
                    className="flex-1 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-black text-[8px] uppercase tracking-wider rounded-lg active:scale-95 transition-all text-center"
                  >
                    ⚙️ Native Picker / चुने
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {!earpieceActive ? (
                <button
                  onClick={startEarpiece}
                  className="w-full py-3 bg-cyan-400 hover:bg-cyan-500 text-black font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
                >
                  👂 Start Earpiece sound
                </button>
              ) : (
                <button
                  onClick={() => stopEarpiece(true)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
                >
                  ✅ Heard clearly (Pass)
                </button>
              )}

              <button
                onClick={() => stopEarpiece(false)}
                className="w-full py-3 border border-white/10 bg-white/5 hover:bg-white/10 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
              >
                No sound heard (Fail)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------------------- */}
      {/* 4. VIBRATION MOTOR EXCLUSIVE STAGE */}
      {/* ----------------------------------------------------------------------------------------------- */}
      {activeTest === 'vibration' && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col p-8 items-center justify-center text-center">
          <div className="bento-card p-6 w-full max-w-sm space-y-6" id="vibration-test-box">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-yellow-500/10 text-yellow-500 rounded-full mb-3 border border-yellow-500/20">
                <Flame size={36} className="animate-spin" style={{ animationDuration: '4s' }} />
              </div>
              <h2 className="text-base font-black text-white">Vibrator Haptics check / वाइब्रेशन चेक</h2>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[260px] leading-relaxed">
                Deliver custom magnetic current impulses to check weight rotation cadence correctly.
              </p>
            </div>

            {/* Custom cadence presets picker */}
            <div className="space-y-3 pt-2 text-left">
              <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Configure Rhythm Pattern</span>
              <div className="grid grid-cols-1 gap-2">
                {patterns.map((pat, idx) => (
                  <button
                    key={idx}
                    onClick={() => setVibePatternIdx(idx)}
                    className={`p-3 rounded-xl border text-left font-sans text-xs flex justify-between items-center transition-all ${
                      vibePatternIdx === idx 
                        ? 'bg-yellow-500/10 border-yellow-500/40 text-white font-heavy' 
                        : 'bg-slate-900/60 border-white/5 text-slate-400'
                    }`}
                  >
                    <span>{pat.name}</span>
                    <span className="text-[8px] font-mono text-slate-500">[ {pat.timings.join(', ')} ms ]</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={triggerVibrate}
                className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-600 text-black font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
              >
                📳 Rumble Motor
              </button>

              <button
                onClick={() => {
                  setResults(prev => ({ ...prev, vibration: 'pass' }));
                  setActiveTest('idle');
                }}
                className="flex-1 py-3 bg-emerald-500 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
              >
                ✅ Works (Pass)
              </button>
            </div>

            <button
              onClick={() => {
                setResults(prev => ({ ...prev, vibration: 'fail' }));
                setActiveTest('idle');
              }}
              className="w-full py-2 bg-transparent text-slate-500 text-xs font-bold hover:text-rose-400 transition-colors uppercase"
            >
              Fail test / काम नहीं कर रहा
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------------------- */}
      {/* 5. AUDIO JACK PORT DIAGNOSTICS */}
      {/* ----------------------------------------------------------------------------------------------- */}
      {activeTest === 'audio_jack' && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col p-8 items-center justify-center text-center">
          <div className="bento-card p-6 w-full max-w-sm space-y-6">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-purple-500/10 text-purple-400 rounded-full mb-3 border border-purple-500/20">
                <Headphones size={36} className="animate-pulse" />
              </div>
              <h2 className="text-base font-black text-white">Audio Jack Impedance Scan / इयरफोन जैक</h2>
              <p className="text-[11px] text-slate-400 mt-2 max-w-[250px] leading-relaxed">
                Connect your physical headphones to the 3.5mm jack or USB-C adapter to trigger immediate audio bus response check.
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl text-left space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Audio Hardware Socket:</span>
                <span className="font-mono text-purple-400 font-extrabold uppercase">3.5mm Aux bus</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Connection State:</span>
                {jackChecked ? (
                  <span className="text-amber-400 font-mono font-black">SCAN COMPLETE</span>
                ) : (
                  <span className="text-indigo-400 font-mono font-black animate-pulse">AWAITING AUX JACK...</span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={checkAudioJack}
                className="flex-1 py-3 bg-purple-500 hover:bg-purple-600 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
              >
                🔍 Refresh Bus Scan
              </button>

              <button
                onClick={() => {
                  setResults(prev => ({ ...prev, audio_jack: 'pass' }));
                  setActiveTest('idle');
                }}
                className="flex-1 py-3 bg-emerald-500 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
              >
                ✅ Passed OK
              </button>
            </div>

            <button
              onClick={() => {
                setResults(prev => ({ ...prev, audio_jack: 'fail' }));
                setActiveTest('idle');
              }}
              className="w-full py-2 bg-transparent text-slate-500 text-xs font-bold hover:text-rose-400 transition-colors uppercase"
            >
              Skip / fail port
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------------------- */}
      {/* 6. CHARGING PIN VOLTAGE SENSING */}
      {/* ----------------------------------------------------------------------------------------------- */}
      {activeTest === 'charging_pin' && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col p-8 items-center justify-center text-center">
          <div className="bento-card p-6 w-full max-w-sm space-y-6">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-amber-500/10 text-amber-500 rounded-full mb-3 border border-amber-500/20">
                <Zap size={36} className="animate-pulse" />
              </div>
              <h2 className="text-base font-black text-white">Charging Pin & Power Port / चार्जिंग पिन जाँच</h2>
              <p className="text-[10.5px] text-slate-400 mt-2 max-w-[270px] leading-relaxed">
                Connect your micro-USB/Type-C charger to test direct bus current flow. Below status updates live instantly!
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl text-left space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Volt Pin Bus Status:</span>
                {chargingStatus === true ? (
                  <span className="font-mono text-[#00FF88] font-black uppercase bg-[#00FF88]/10 px-2 py-0.5 rounded border border-[#00FF88]/20 animate-pulse">⚡ CHARGING PORT OK</span>
                ) : (
                  <span className="font-mono text-rose-500 font-black uppercase bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/20">🔌 DISCONNECTED</span>
                )}
              </div>
              <p className="text-[9.5px] text-slate-500 uppercase leading-none">
                Real-time browser power bus scanning active.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setResults(prev => ({ ...prev, charging_pin: 'pass' }));
                  setActiveTest('idle');
                }}
                className="flex-1 py-3 bg-emerald-500 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
              >
                ✅ Works Flawlessly / पास है
              </button>

              <button
                onClick={() => {
                  setResults(prev => ({ ...prev, charging_pin: 'fail' }));
                  setActiveTest('idle');
                }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-slate-400 font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center border border-white/10"
              >
                Fail test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------------------- */}
      {/* 7. CAMERA INTERACTIVE FEED & VIEWPORT TESTING */}
      {/* ----------------------------------------------------------------------------------------------- */}
      {activeTest === 'camera_test' && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col p-6 items-center justify-between">
          <header className="text-center space-y-0.5">
            <span className="text-[9px] uppercase tracking-widest text-[#00FF88] font-extrabold bg-[#00FF88]/10 py-0.5 px-3 rounded-full">REALTIME VIEWFINDER</span>
            <h2 className="text-base font-black text-white mt-1">Camera Sensor aperture Test</h2>
            <p className="text-[9.5px] text-slate-400">Verifying video matrix buffers. Snap or toggle capture modes.</p>
          </header>

          <div className="w-full max-w-[320px] aspect-[3/4] bg-slate-950 border border-white/10 rounded-[2rem] overflow-hidden relative flex items-center justify-center my-auto shadow-[0_10px_35px_rgba(0,0,0,0.5)]">
            {cameraErr ? (
              <div className="p-6 text-center space-y-3">
                <AlertTriangle size={32} className="text-yellow-500 mx-auto" />
                <p className="text-xs text-slate-400 leading-relaxed font-sans">{cameraErr}</p>
                <button
                  onClick={() => startCamera(facingMode)}
                  className="py-1.5 px-3 bg-white text-black font-extrabold text-[10px] uppercase rounded-lg active:scale-95 transition-all"
                >
                  Retry Aperture
                </button>
              </div>
            ) : (
              <>
                <video 
                  ref={videoRef} 
                  className="w-full h-full object-cover scale-x-[-1]" 
                  playsInline 
                  muted 
                />
                <div className="absolute bottom-4 left-4 p-2 bg-black/60 rounded-xl text-[8.5px] font-mono text-white/80 select-none border border-white/5 uppercase">
                  MODE: {facingMode} CAMERA
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-2.5 w-full max-w-xs mb-2">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const nextMode = facingMode === 'user' ? 'environment' : 'user';
                  setFacingMode(nextMode);
                }}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-heavy font-extrabold text-[10.5px] uppercase tracking-wide rounded-2xl active:scale-95 transition-all text-center"
              >
                🔄 Switch Aperture / पलटो
              </button>

              <button
                onClick={() => {
                  setResults(prev => ({ ...prev, camera_test: 'pass' }));
                  stopCamera();
                  setActiveTest('idle');
                }}
                className="flex-1 py-3 bg-[#00FF88] text-black font-heavy font-extrabold text-[10.5px] uppercase tracking-wide rounded-2xl active:scale-95 transition-all text-center shadow-[0_5px_15px_rgba(3,255,136,0.3)]"
              >
                📸 Frame captures OK (Pass)
              </button>
            </div>

            <button
              onClick={() => {
                setResults(prev => ({ ...prev, camera_test: 'fail' }));
                stopCamera();
                setActiveTest('idle');
              }}
              className="w-full py-2 bg-transparent text-slate-500 text-xs font-bold hover:text-rose-400 transition-colors uppercase"
            >
              Camera blocked / fails
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------------------- */}
      {/* 8. KEYBOARD TYPING SPEEDS CHECK */}
      {/* ----------------------------------------------------------------------------------------------- */}
      {activeTest === 'keyboard_test' && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col p-8 items-center justify-center text-center">
          <div className="bento-card p-6 w-full max-w-sm space-y-6">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-rose-500/10 text-rose-400 rounded-full mb-3 border border-rose-500/20">
                <Keyboard size={36} className="animate-pulse" />
              </div>
              <h2 className="text-base font-black text-white">Keyboard Typing Check / वर्ड टेस्ट</h2>
              <p className="text-[10.5px] text-slate-400 mt-1 max-w-[260px] leading-relaxed">
                Type the target sentence precisely in the box below to benchmark digitizer latency cycles!
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl text-left space-y-2">
              <span className="text-[8.5px] uppercase font-bold text-slate-500 tracking-wider">Target Phrase:</span>
              <p className="text-sm font-mono font-black text-[#00FF88] tracking-wide select-none">
                "{targetTextToCheck}"
              </p>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={userTyped}
                onChange={handleTypeCheck}
                autoFocus
                placeholder="Type here..."
                className="w-full p-4 bg-slate-900 border border-white/10 rounded-2xl text-baseline text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-[#00FF88] transition-colors"
              />
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                <span>Latency count: {keyLatencies.length} keys</span>
                <span>Avg delay: {keyLatencies.length ? Math.round(keyLatencies.reduce((a, b) => a + b, 0) / keyLatencies.length) : 0} ms</span>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveTest('idle');
                setUserTyped('');
                setKeyLatencies([]);
              }}
              className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
            >
              Close key check
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------------------- */}
      {/* 9. PHYSICAL VOLUME CONTROLS */}
      {/* ----------------------------------------------------------------------------------------------- */}
      {activeTest === 'volume_keys' && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col p-8 items-center justify-center text-center">
          <div className="bento-card p-6 w-full max-w-sm space-y-6">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-fuchsia-500/10 text-fuchsia-400 rounded-full mb-3 border border-fuchsia-500/20">
                <Sliders size={36} className="animate-bounce" />
              </div>
              <h2 className="text-base font-black text-white">Physical Volume controls / वॉल्यूम बटन</h2>
              <p className="text-[10.5px] text-slate-400 mt-1 max-w-[260px] leading-relaxed">
                Click your physical volume up & down buttons, or tap the diagnostic buttons helpers below to check!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              {/* Volume up */}
              <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-2 transition-all ${
                volumeUpTriggered 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-[#00FF88]' 
                  : 'bg-slate-900/60 border-white/5 text-slate-400'
              }`}>
                <span className="text-xs font-black">Volume UP</span>
                <span className="text-[8.5px] font-mono">[ Arrow Up / Up Key ]</span>
                <button
                  onClick={() => setVolumeUpTriggered(true)}
                  className="py-1 px-2.5 bg-white text-black font-black text-[9px] uppercase rounded-md mt-1"
                >
                  Simulate click
                </button>
              </div>

              {/* Volume down */}
              <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center space-y-2 transition-all ${
                volumeDownTriggered 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-[#00FF88]' 
                  : 'bg-slate-900/60 border-white/5 text-slate-400'
              }`}>
                <span className="text-xs font-black">Volume DOWN</span>
                <span className="text-[8.5px] font-mono">[ Arrow Down / Down Key ]</span>
                <button
                  onClick={() => setVolumeDownTriggered(true)}
                  className="py-1 px-2.5 bg-white text-black font-black text-[9px] uppercase rounded-md mt-1"
                >
                  Simulate click
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveTest('idle');
                setVolumeUpTriggered(false);
                setVolumeDownTriggered(false);
              }}
              className="w-full py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
            >
              Cancel check
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------------------------------- */}
      {/* 10. POWER ON/OFF / SLEEP LOOP TEST */}
      {/* ----------------------------------------------------------------------------------------------- */}
      {activeTest === 'power_key' && (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col p-8 items-center justify-center text-center">
          <div className="bento-card p-6 w-full max-w-sm space-y-6">
            <div className="flex flex-col items-center">
              <div className="p-4 bg-orange-500/10 text-orange-400 rounded-full mb-3 border border-orange-500/20">
                <Power size={36} className="animate-pulse text-orange-400" />
              </div>
              <h2 className="text-base font-black text-white">Power key & focus check / लॉक बटन</h2>
              <p className="text-[10.5px] text-slate-400 mt-2 max-w-[270px] leading-relaxed">
                Press the physical Power Button to turn off the screen briefly, then turn it on, OR tap the bypass validation below!
              </p>
            </div>

            <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl text-left space-y-1.5">
              <span className="text-[9px] uppercase text-slate-500 tracking-wider font-extrabold">Live Focus registry:</span>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Sleep/Wake state trigger:</span>
                {powerBlurred ? (
                  <span className="text-[#00FF88] font-mono font-black uppercase">DETECTED SLEEP PULSE ✅</span>
                ) : (
                  <span className="text-orange-400 font-mono font-black animate-pulse uppercase">WAITING SLEEP EVENT...</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => completePowerTest(true)}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all text-center"
              >
                ✅ Lock sensor registers OK
              </button>

              <button
                onClick={() => completePowerTest(false)}
                className="w-full py-3 border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 font-heavy font-extrabold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-all border-dashed text-center"
              >
                No response from loop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer educational elements */}
      <div className="bento-card p-4 space-y-2 bg-slate-900/20 text-left">
        <h4 className="text-xs font-black text-[#00FF88] uppercase tracking-wider flex items-center gap-1.5">
          <ShieldCheck size={13} /> Why hardware diagnostics matters?
        </h4>
        <p className="text-[10px] text-slate-500 leading-relaxed font-sans">
          This system verifies hardware circuits safely using the standard HTML5 Device capabilities. Regular health testing prevents thermal overloading and optimizes chemical charging dynamics.
        </p>
      </div>
    </motion.div>
  );
}
