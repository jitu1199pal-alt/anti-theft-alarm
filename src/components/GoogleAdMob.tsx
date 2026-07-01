import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Star, ShieldAlert } from 'lucide-react';

// Dynamically check if AdMob is available to prevent compile-time/run-time errors
// if loaded in environment without native builds
let AdMob: any = null;
let BannerAdSize: any = null;
let BannerAdPosition: any = null;

try {
  // @ts-ignore
  import('@capacitor-community/admob').then((module) => {
    AdMob = module.AdMob;
    BannerAdSize = module.BannerAdSize;
    BannerAdPosition = module.BannerAdPosition;
  }).catch((err) => {
    console.warn("Could not lazily import AdMob. This is normal on Web/Preview.", err);
  });
} catch (e) {
  console.warn("Dynamic import of @capacitor-community/admob failed", e);
}

const checkIsPremiumPaid = (): boolean => {
  const isPaidPremium = localStorage.getItem('is_premium_active') === 'true';
  return isPaidPremium;
};

export const getActivePageType = (type?: 'cleaner' | 'battery' | 'security' | 'sensors' | 'general'): 'cleaner' | 'battery' | 'security' | 'sensors' | 'general' => {
  if (type) return type;
  const pathText = (window.location.hash || window.location.pathname || '').toLowerCase();
  
  if (pathText.includes('clean') || pathText.includes('junk') || pathText.includes('boost')) {
    return 'cleaner';
  }
  if (pathText.includes('battery') || pathText.includes('charging') || pathText.includes('saver')) {
    return 'battery';
  }
  if (pathText.includes('theft') || pathText.includes('pocket') || pathText.includes('motion') || pathText.includes('alert')) {
    return 'security';
  }
  if (pathText.includes('diagnost') || pathText.includes('sensor') || pathText.includes('hardware') || pathText.includes('speaker')) {
    return 'sensors';
  }

  const charCodeSum = pathText.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const options: Array<'cleaner' | 'battery' | 'security' | 'sensors' | 'general'> = [
    'cleaner', 'battery', 'security', 'sensors', 'general'
  ];
  return options[charCodeSum % options.length] || 'general';
};

interface GoogleAdMobProps {
  slot: string;
  format?: 'auto' | 'fluid';
  responsive?: 'true' | 'false';
  style?: React.CSSProperties;
  position?: 'TOP_CENTER' | 'BOTTOM_CENTER';
  type?: 'cleaner' | 'battery' | 'security' | 'sensors' | 'general';
}

let isAdMobInitialized = false;
let activeMounts = 0;
let isBannerActive = false;
let lastAdId = '';
let destroyTimeoutId: any = null;

// Mutex / Queue to serialize physical AdMob calls
class AdMobMutex {
  private queue: Promise<any> = Promise.resolve();

  async run(op: () => Promise<any>): Promise<any> {
    const next = this.queue.then(op).catch((err) => {
      console.warn("Error in AdMob synchronized sequence:", err);
    });
    this.queue = next;
    return next;
  }
}
const admobMutex = new AdMobMutex();

export const removeGlobalBanner = async () => {
  isBannerActive = false;
  lastAdId = '';
  try {
    if (!AdMob) {
      const module = await import('@capacitor-community/admob');
      AdMob = module.AdMob;
    }
    if (AdMob) {
      await AdMob.removeBanner();
      console.log("Global Banner: Native banner successfully removed and states reset.");
    }
  } catch (err) {
    console.warn("Global Banner: Failed to remove native banner overlay:", err);
  }
};

export const GoogleAdMob: React.FC<GoogleAdMobProps> = ({ 
  slot, 
  format = 'auto', 
  responsive = 'true',
  style = { display: 'block' },
  position = 'BOTTOM_CENTER',
  type
}) => {
  const isNative = Capacitor.isNativePlatform();
  const [isPremium, setIsPremium] = useState(() => checkIsPremiumPaid());
  const [admobLoaded, setAdmobLoaded] = useState(false);
  const [admobActive, setAdmobActive] = useState(false);
  const activeType = getActivePageType(type);

  useEffect(() => {
    const handleChanged = () => {
      setIsPremium(checkIsPremiumPaid());
    };
    window.addEventListener('premium_status_changed', handleChanged);
    return () => window.removeEventListener('premium_status_changed', handleChanged);
  }, []);

  useEffect(() => {
    if (isPremium) return;
    let active = true;
    let loadedListener: any = null;
    let failedListener: any = null;

    if (!isNative) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {}
      return;
    }

    // Increment active mount count for reference tracking
    activeMounts++;

    // Cancel any pending unmount destruction timeout since we have an active component view
    if (destroyTimeoutId) {
      clearTimeout(destroyTimeoutId);
      destroyTimeoutId = null;
      console.log("AdMob: Canceled pending banner destruction. Reusing on-screen banner.");
    }

    const setupNativeAdMob = async () => {
      try {
        if (!AdMob) {
          const module = await import('@capacitor-community/admob');
          AdMob = module.AdMob;
          BannerAdSize = module.BannerAdSize;
          BannerAdPosition = module.BannerAdPosition;
        }

        if (!active) return;
        setAdmobLoaded(true);

        // Bind event listeners to log exact performance or issues
        try {
          const { BannerAdPluginEvents } = await import('@capacitor-community/admob');
          loadedListener = await AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
            console.log("🚩 AdMob SUCCESS: Banner Ad loaded successfully onto the screen!");
          });
          failedListener = await AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (info: any) => {
            console.error("🚩 AdMob ERROR: Banner advertisement failed to load! Details:", JSON.stringify(info));
          });
        } catch (eventListenerErr) {
          console.warn("Could not bind AdMob listener events:", eventListenerErr);
        }

        // Check if banner is already active for this exact slot
        if (isBannerActive && lastAdId === slot) {
          console.log("AdMob: Reuse existing native banner seamlessly.");
          if (active) {
            setAdmobActive(true);
          }
          return;
        }

        await admobMutex.run(async () => {
          if (!active) return;

          // Initialize AdMob if needed
          if (!isAdMobInitialized) {
            try {
              await AdMob.initialize({
                requestTrackingAuthorization: true,
                initializeForTesting: false,
              });
              isAdMobInitialized = true;
              console.log("Capacitor AdMob SDK initialized successfully.");
            } catch (initErr) {
              console.error("AdMob Initialization failed:", initErr);
            }
          }

          if (!slot) {
            console.error("Ad Unit ID Missing");
            return;
          }

          const finalAdId = slot;

          try {
            // ALWAYS remove previous active native banner on transition to prevent overlaps/freezing!
            // This ensures maximum UI responsiveness and completely eliminates AdMob lag on older devices.
            try {
              await AdMob.removeBanner();
            } catch (e) {}
            isBannerActive = false;

            const nativePosition = position === 'TOP_CENTER' 
              ? (BannerAdPosition?.TOP_CENTER || 'TOP_CENTER')
              : (BannerAdPosition?.BOTTOM_CENTER || 'BOTTOM_CENTER');

            // Select distinct banner sizes dynamically according to active page category
            let resolvedSize = BannerAdSize?.BANNER || 'BANNER';
            if (activeType === 'sensors') {
              resolvedSize = BannerAdSize?.MEDIUM_RECTANGLE || 'MEDIUM_RECTANGLE';
            } else if (activeType === 'cleaner' || activeType === 'battery') {
              resolvedSize = BannerAdSize?.LARGE_BANNER || 'LARGE_BANNER';
            }

            await AdMob.showBanner({
              adId: finalAdId,
              adSize: resolvedSize,
              position: nativePosition,
              margin: 0,
            });
            isBannerActive = true;
            lastAdId = slot;
            console.log(`Capacitor Native AdMob Banner (${resolvedSize}) active at ${position} (ID: ${finalAdId}).`);
          } catch (showErr) {
            console.warn("Failed to show native AdMob banner overlay:", showErr);
          }
        });

        if (active) {
          setAdmobActive(true);
        }
      } catch (err) {
        console.warn("Failed to setup native AdMob wrapper:", err);
      }
    };

    setupNativeAdMob();

    return () => {
      active = false;
      if (loadedListener) {
        try { loadedListener.remove(); } catch (e) {}
      }
      if (failedListener) {
        try { failedListener.remove(); } catch (e) {}
      }
      if (isNative) {
        activeMounts--;
        if (activeMounts < 0) {
          activeMounts = 0;
        }
        console.log("AdMob: Component unmounted, remaining active mounts:", activeMounts);
        
        if (activeMounts === 0) {
          // If no more AdMob banner components are mounted on the active screen,
          // remove the native banner overlay after a tiny delay to allow transitions.
          if (destroyTimeoutId) {
            clearTimeout(destroyTimeoutId);
          }
          destroyTimeoutId = setTimeout(async () => {
            try {
              if (activeMounts === 0) {
                await removeGlobalBanner();
                console.log("AdMob: Last banner unmounted. Native banner hidden.");
              }
            } catch (err) {
              console.warn("Failed to hide banner on unmount:", err);
            }
          }, 150);
        }
      }
    };
  }, [isNative, slot]);

  if (isPremium) {
    return null;
  }

  // If we are native and AdMob is actively overlays the view, we don't need to render massive blocks
  if (isNative && admobActive) {
    return (
      <div className="my-2 p-1 text-center bg-slate-900/10 border border-dashed border-slate-800 rounded-lg">
        <span className="text-[9px] text-slate-500 font-mono">Google AdMob Native Banner is Displayed Over Layout</span>
      </div>
    );
  }

  const adInfo = adPlacements[activeType] || adPlacements.general;

  // Beautiful modern fallback UI for Web, Preview & Development mode
  return (
    <div 
      onClick={() => triggerInterstitialAd(() => {}, activeType)}
      className={`my-4 w-full overflow-hidden rounded-2xl bg-[#030712]/90 border ${adInfo.borderGlow} p-4 text-center shadow-xl relative group cursor-pointer active:scale-[0.99] transition-all duration-300`}
    >
      <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full blur-[40px] opacity-25" style={{ backgroundColor: adInfo.themeColor }} />
      
      <div className={`absolute top-0 right-0 ${adInfo.badgeBg} ${adInfo.badgeText} border-l border-b border-white/5 px-2.5 py-1 rounded-bl-xl text-[8px] font-mono tracking-widest uppercase font-black flex items-center gap-1.5`}>
        <div className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: adInfo.themeColor }} />
        {adInfo.badge}
      </div>

      <div className="relative z-10 flex items-start gap-3 text-left">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${adInfo.gradient} p-0.5 shadow-lg flex items-center justify-center shrink-0`}>
          <div className="w-full h-full bg-slate-950 rounded-[9px] flex items-center justify-center text-base">
            {adInfo.iconText}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-xs font-black text-white uppercase tracking-normal">{adInfo.titleEn}</h4>
            <span className="text-[7px] font-mono leading-none py-0.5 px-1 rounded-md bg-[#00ff88]/10 text-[#00ff88] font-extrabold border border-[#00ff88]/20 uppercase">
              GOOGLE SPONSORED
            </span>
          </div>
          <h5 className="text-[9.5px] font-black mt-0.5 leading-normal" style={{ color: adInfo.themeColor }}>
            👉 {adInfo.titleHi}
          </h5>
          <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">
            {adInfo.subtitleHi}
          </p>
          <div className="flex justify-between items-center mt-2 pt-1 border-t border-white/5 text-[8px] font-mono text-slate-600">
            <span>SLOT: {slot}</span>
            <span className="text-emerald-400 font-bold font-sans flex items-center gap-1">VIEW REAL AD ➔</span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface GoogleNativeAppAdProps {
  onInstall?: () => void;
  type?: 'cleaner' | 'battery' | 'security' | 'sensors' | 'general';
}

interface AdPlacementConfig {
  gradient: string;
  iconText: string;
  titleEn: string;
  titleHi: string;
  subtitleEn: string;
  subtitleHi: string;
  downloads: string;
  badge: string;
  themeColor: string;
  btnGradient: string;
  borderGlow: string;
  badgeBg: string;
  badgeText: string;
}

const adPlacements: Record<string, AdPlacementConfig> = {
  cleaner: {
    gradient: "from-[#00ff88] via-emerald-500 to-green-600",
    iconText: "🧹",
    titleEn: "Ram & Junk Cleaner Pro",
    titleHi: "सुपर जंक क्लीनर कवच",
    subtitleEn: "1-click deep cache cleaner & 4GB memory booster.",
    subtitleHi: "1-क्लिक में फोन का फालतू कचरा और कैशे साफ करें।",
    downloads: "50M+ Downloads • Certified Secure",
    badge: "FAST BOOSTER",
    themeColor: "#00ff88",
    btnGradient: "from-emerald-500 via-[#00ff88] to-emerald-400",
    borderGlow: "border-emerald-500/35 hover:border-emerald-400/70 shadow-emerald-950/40",
    badgeBg: "bg-emerald-500/15 border-emerald-500/30",
    badgeText: "text-[#00ff88]"
  },
  battery: {
    gradient: "from-yellow-400 via-orange-500 to-amber-600",
    iconText: "🔋",
    titleEn: "Ultra Battery Saver & Fast Charger",
    titleHi: "अल्ट्रा बैटरी लाइफ सेवर",
    subtitleEn: "Detect battery wear, cool down CPU and extend backup up to 5 hours.",
    subtitleHi: "ओवरचार्ज होने से बचाएं, बैटरी लाइफ बढ़ाएं एवं गर्म फोन ठंडा करें।",
    downloads: "20M+ Downloads • Verified Utility",
    badge: "BATTERY GOLD",
    themeColor: "#eab308",
    btnGradient: "from-yellow-500 via-amber-500 to-orange-500",
    borderGlow: "border-yellow-500/30 hover:border-yellow-400/60 shadow-yellow-950/40",
    badgeBg: "bg-yellow-500/10 border-yellow-500/20",
    badgeText: "text-yellow-400"
  },
  security: {
    gradient: "from-red-500 via-rose-600 to-crimson-700",
    iconText: "🚨",
    titleEn: "Anti-Theft Pocket Guard Pro",
    titleHi: "एंटी-थेफ्ट अलार्म प्रोटेक्टर",
    subtitleEn: "Instant siren if pocket picked, phone moved or unplugged.",
    subtitleHi: "जेब से फोन निकालने या चार्जर हटाए जाने पर तुरंत पुलिस अलार्म बजाएं।",
    downloads: "15M+ Downloads • Active Shield",
    badge: "HIGH SAFETY",
    themeColor: "#f43f5e",
    btnGradient: "from-rose-600 to-red-500",
    borderGlow: "border-rose-500/30 hover:border-rose-400/60 shadow-rose-950/40",
    badgeBg: "bg-rose-500/10 border-rose-500/20",
    badgeText: "text-rose-400"
  },
  sensors: {
    gradient: "from-violet-500 via-purple-600 to-fuchsia-700",
    iconText: "⚙️",
    titleEn: "Sensor Repair & Speaker Dust Cleaner",
    titleHi: "सेंसर रिपेयर और वाटर क्लीनर",
    subtitleEn: "Remove trapped speaker water or dust using sonic wave sound frequencies.",
    subtitleHi: "कस्टम सोनिक साउंड तरंगों से स्पीकर में फंसा पानी व धूल तुरंत निकालें।",
    downloads: "10M+ Downloads • Device Lab",
    badge: "HARDWARE LAB",
    themeColor: "#a855f7",
    btnGradient: "from-purple-500 via-indigo-500 to-violet-500",
    borderGlow: "border-purple-500/30 hover:border-purple-400/60 shadow-purple-950/40",
    badgeBg: "bg-purple-500/10 border-purple-500/20",
    badgeText: "text-purple-400"
  },
  general: {
    gradient: "from-cyan-400 via-blue-500 to-indigo-600",
    iconText: "🛡️",
    titleEn: "Kavach App Locker & Secure WiFi Shield",
    titleHi: "कवच ऐप लॉकर सुरक्षा शील्ड",
    subtitleEn: "Lock private gallery apps and scan open unsecured WiFi hotspots.",
    subtitleHi: "व्हाट्सएप, फेसबुक लॉक करें एवं असुरक्षित पब्लिक वाईफाई ब्लॉक करें।",
    downloads: "30M+ Downloads • Safe Privacy",
    badge: "ACTIVE SECURE",
    themeColor: "#06b6d4",
    btnGradient: "from-cyan-500 via-blue-500 to-indigo-500",
    borderGlow: "border-cyan-500/30 hover:border-cyan-400/60 shadow-cyan-950/40",
    badgeBg: "bg-cyan-500/10 border-cyan-500/20",
    badgeText: "text-cyan-400"
  }
};

export const triggerInterstitialAd = async (
  onComplete: () => void,
  type: 'cleaner' | 'battery' | 'security' | 'sensors' | 'general' = 'general'
) => {
  const isPaidPremium = localStorage.getItem('is_premium_active') === 'true';
  
  if (isPaidPremium) {
    console.log("Premium Active - Ads bypassed.");
    onComplete();
    return;
  }

  if (!navigator.onLine) {
    console.log("No internet connection - executing option directly without showing ads.");
    onComplete();
    return;
  }

  const isNative = Capacitor.isNativePlatform();
  const getAdUnitId = (adrType: 'banner' | 'native' | 'interstitial'): string => {
    const isIos = Capacitor.getPlatform() === 'ios';
    if (isIos) {
      if (adrType === 'banner') return 'ca-app-pub-3940256099942544/2934735716';
      if (adrType === 'interstitial') return 'ca-app-pub-3940256099942544/4411468910';
      return 'ca-app-pub-3940256099942544/3986694507';
    } else {
      if (adrType === 'banner') return 'ca-app-pub-2585981026340393/9149642997';
      if (adrType === 'interstitial') return 'ca-app-pub-2585981026340393/3532685935';
      return 'ca-app-pub-2585981026340393/4569671094';
    }
  };

  const adInfo = adPlacements[type] || adPlacements.general;

  if (!isNative) {
    console.log(`Web Preview: Simulated Real AdMob Interstitial Trigger for page type ${type}.`);
    alert(`System Shield Boost Utility Activation:\n\n👉 Title: ${adInfo.titleEn}\n\n[Real full-screen app interstitial ad will show here instantly inside your physical APK!]`);
    onComplete();
    return;
  }

  let dismissedSub: any = null;
  let failedSub: any = null;

  const cleanup = () => {
    try {
      if (dismissedSub) dismissedSub.remove();
      if (failedSub) failedSub.remove();
    } catch (e) {
      console.warn("Error cleaning listeners:", e);
    }
  };

  try {
    const { AdMob: CoreAdMob } = await import('@capacitor-community/admob');
    const adId = getAdUnitId('interstitial');

    console.log("AdMob: Launching programmatic interstitial. ID:", adId);

    try {
      await (CoreAdMob as any).initialize({
        requestTrackingAuthorization: true,
        initializeForTesting: false,
      });
    } catch (e) {
      console.log("AdMob: Already pre-initialized on startup:", e);
    }

    try {
      dismissedSub = await (CoreAdMob.addListener as any)('interstitialAdDismissed', () => {
        cleanup();
        onComplete();
      });
      failedSub = await (CoreAdMob.addListener as any)('interstitialAdFailedToShow', () => {
        cleanup();
        onComplete();
      });
    } catch (errListener) {
      console.warn("Failed to register dynamic programmatic listeners:", errListener);
    }

    try {
      await CoreAdMob.prepareInterstitial({ adId });
      await CoreAdMob.showInterstitial();
    } catch (err1) {
      console.warn("Fast presentation missed. Compiling fresh presentation queue...", err1);
      await CoreAdMob.prepareInterstitial({ adId });
      setTimeout(async () => {
        try {
          await CoreAdMob.showInterstitial();
        } catch (err2) {
          console.error("AdMob: Failed final presentation phase:", err2);
          cleanup();
          onComplete();
        }
      }, 500);
    }
  } catch (err) {
    console.error("Core AdMob runtime error during launch sequence:", err);
    cleanup();
    onComplete();
  }
};

export const GoogleNativeAppAd: React.FC<GoogleNativeAppAdProps> = ({ onInstall, type }) => {
  const isNative = Capacitor.isNativePlatform();
  const [isPremium, setIsPremium] = useState(() => checkIsPremiumPaid());
  const [loadingAd, setLoadingAd] = useState(false);

  useEffect(() => {
    const handleChanged = () => {
      setIsPremium(checkIsPremiumPaid());
    };
    window.addEventListener('premium_status_changed', handleChanged);
    return () => window.removeEventListener('premium_status_changed', handleChanged);
  }, []);

  if (isPremium) {
    return null;
  }

  // Auto detect placement type based on dynamic hash context to ensure match consistency across active page slots
  const getDeductedType = (): 'cleaner' | 'battery' | 'security' | 'sensors' | 'general' => {
    if (type) return type;
    const pathText = (window.location.hash || window.location.pathname || '').toLowerCase();
    
    if (pathText.includes('clean') || pathText.includes('junk') || pathText.includes('boost')) {
      return 'cleaner';
    }
    if (pathText.includes('battery') || pathText.includes('charging') || pathText.includes('saver')) {
      return 'battery';
    }
    if (pathText.includes('theft') || pathText.includes('pocket') || pathText.includes('motion') || pathText.includes('alert')) {
      return 'security';
    }
    if (pathText.includes('diagnost') || pathText.includes('sensor') || pathText.includes('hardware') || pathText.includes('speaker')) {
      return 'sensors';
    }

    // Hash-based deterministic rotation to ensure all 5 slots on Page A remain identical to Page A ad context!
    const charCodeSum = pathText.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
    const options: Array<'cleaner' | 'battery' | 'security' | 'sensors' | 'general'> = [
      'cleaner', 'battery', 'security', 'sensors', 'general'
    ];
    return options[charCodeSum % options.length] || 'general';
  };

  const activeType = getDeductedType();
  const adInfo = adPlacements[activeType] || adPlacements.general;

  const handleLaunchAd = async () => {
    setLoadingAd(true);
    await triggerInterstitialAd(() => {
      (window as any).triggerPermissionsWizard?.();
    }, activeType);
    setTimeout(() => setLoadingAd(false), 2000);
  };

  return (
    <div 
      onClick={handleLaunchAd}
      className={`w-full bg-[#030712]/90 border ${adInfo.borderGlow} cursor-pointer active:scale-[0.98] rounded-2xl p-4 flex flex-col gap-3 shadow-2xl relative overflow-hidden self-start mb-4 antialiased transition-all duration-300`}
    >
      {/* Decorative colored visual ambient point */}
      <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full blur-[40px] opacity-25" style={{ backgroundColor: adInfo.themeColor }} />
      
      {/* Sponsor Label */}
      <div className={`absolute top-0 right-0 ${adInfo.badgeBg} ${adInfo.badgeText} border-l border-b border-white/5 px-2.5 py-1 rounded-bl-xl text-[8px] font-mono tracking-widest uppercase font-black flex items-center gap-1.5`}>
        <div className="w-1.5 h-1.5 rounded-full animate-ping" style={{ backgroundColor: adInfo.themeColor }} />
        {adInfo.badge}
      </div>
      
      <div className="flex items-start gap-3 relative z-10">
        {/* Ad Dynamic Colored Icon */}
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-tr ${adInfo.gradient} p-0.5 shadow-lg flex items-center justify-center shrink-0`}>
          <div className="w-full h-full bg-slate-950 rounded-[9px] flex items-center justify-center text-lg">
            {adInfo.iconText}
          </div>
        </div>
        
        {/* Content detail layout */}
        <div className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-xs font-black text-white uppercase tracking-normal">{adInfo.titleEn}</h4>
            <span className="text-[7.5px] font-mono leading-none py-0.5 px-1.5 rounded-md bg-[#00ff88]/10 text-[#00ff88] font-extrabold border border-[#00ff88]/20 uppercase shrink-0">
              PRO CRITICAL
            </span>
          </div>
          
          <h5 className="text-[10px] font-black mt-1 leading-normal" style={{ color: adInfo.themeColor }}>
            👉 {adInfo.titleHi}
          </h5>
          
          <p className="text-[10px] text-slate-400 mt-1 leading-snug">
            {adInfo.subtitleHi}
          </p>
          
          <p className="text-[9px] text-slate-500 mt-1 leading-snug italic font-serif">
            {adInfo.subtitleEn}
          </p>

          <p className="text-[8.5px] font-mono text-emerald-400 font-bold mt-1.5">
            ✓ {adInfo.downloads}
          </p>
        </div>
      </div>

      <div className="relative z-10 w-full flex flex-col gap-2">
        <button 
          onClick={(e) => { e.stopPropagation(); handleLaunchAd(); }}
          style={{ 
            backgroundImage: `linear-gradient(to right, ${adInfo.themeColor}d8, ${adInfo.themeColor})` 
          }}
          className="w-full py-2.5 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all hover:scale-[1.01] active:scale-[0.97] text-center flex items-center justify-center gap-2 shadow-lg"
        >
          {loadingAd ? (
            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          ) : (
            <span>सुरक्षित तरीके से अनलॉक करें / VIEW REAL AD ➔</span>
          )}
        </button>

        {/* 
          Backend Configuration Metadata:
          Ad Unit Registered: ca-app-pub-2585981026340393/3532685935
          Target Framework: Google AdMob SDK Live Premium
        */}
      </div>
    </div>
  );
};

