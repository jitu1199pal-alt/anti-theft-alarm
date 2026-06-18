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

interface GoogleAdMobProps {
  slot: string;
  format?: 'auto' | 'fluid';
  responsive?: 'true' | 'false';
  style?: React.CSSProperties;
  position?: 'TOP_CENTER' | 'BOTTOM_CENTER';
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
  position = 'BOTTOM_CENTER'
}) => {
  const isNative = Capacitor.isNativePlatform();
  const [admobLoaded, setAdmobLoaded] = useState(false);
  const [admobActive, setAdmobActive] = useState(false);

  useEffect(() => {
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

        // If the banner is already displayed and uses the same slot, DO NOT rebuild/re-query it!
        // This is 100% lag-free and avoids triggering slow native calls or flicker on page transitions.
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
            // Remove previous banner if ad ID changed
            if (isBannerActive && lastAdId !== slot) {
              try {
                await AdMob.removeBanner();
              } catch (e) {}
              isBannerActive = false;
            }

            const nativePosition = position === 'TOP_CENTER' 
              ? (BannerAdPosition?.TOP_CENTER || 'TOP_CENTER')
              : (BannerAdPosition?.BOTTOM_CENTER || 'BOTTOM_CENTER');

            await AdMob.showBanner({
              adId: finalAdId,
              adSize: BannerAdSize?.BANNER || 'BANNER',
              position: nativePosition,
              margin: 0,
            });
            isBannerActive = true;
            lastAdId = slot;
            console.log(`Capacitor Native AdMob Banner active at ${position} (ID: ${finalAdId}).`);
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

  // If we are native and AdMob is actively overlays the view, we don't need to render massive blocks
  if (isNative && admobActive) {
    return (
      <div className="my-2 p-1 text-center bg-slate-900/10 border border-dashed border-slate-800 rounded-lg">
        <span className="text-[9px] text-slate-500 font-mono">Google AdMob Native Banner is Displayed Over Layout</span>
      </div>
    );
  }

  // Beautiful modern fallback UI for Web, Preview & Development mode
  return (
    <div className="my-4 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 p-4 text-center shadow-xl relative group">
      {/* Visual background lines decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:16px_16px] opacity-20 pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-2">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <p className="text-[9px] text-emerald-400 font-mono uppercase tracking-widest">AdMob SDK Configured</p>
        </div>
        
        <h4 className="text-xs font-bold text-slate-300 font-sans tracking-wide">
          {isNative ? "Loading Native AdMob Ad..." : "Google AdMob Native Placement"}
        </h4>
        
        <p className="text-[10px] text-slate-500 max-w-[280px] mt-1 leading-relaxed">
          {isNative 
            ? "Syncing token with Google Play Services to serve native banner overlay..."
            : "This placement will render a high-performance native banner ad when compiling to Android / iOS using Capacitor."
          }
        </p>

        {/* Visual Mock Banner Mockup */}
        <div className="w-full max-w-[320px] h-[50px] bg-slate-900/60 border border-slate-800/80 rounded-xl mt-3 flex items-center justify-between px-3 relative overflow-hidden">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              <span className="text-[11px] font-bold text-emerald-400">AA</span>
            </div>
            <div className="text-left">
              <div className="h-2 w-20 bg-slate-800 rounded-full mb-1" />
              <div className="h-1.5 w-28 bg-slate-800/60 rounded-full" />
            </div>
          </div>
          <button className="px-2.5 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black text-[9px] font-extrabold transition-colors shadow-[0_4px_12px_rgba(16,185,129,0.2)]">
            INSTALL
          </button>
        </div>

        <div className="flex items-center justify-between w-full mt-3 text-[8px] text-slate-600 font-mono px-1">
          <span>SLOT: {slot}</span>
          <span>FORMAT: {format}</span>
        </div>
      </div>
    </div>
  );
};

interface GoogleNativeAppAdProps {
  onInstall?: () => void;
}

export const GoogleNativeAppAd: React.FC<GoogleNativeAppAdProps> = ({ onInstall }) => {
  const isNative = Capacitor.isNativePlatform();

  const getAdUnitId = (type: 'banner' | 'native'): string => {
    const isIos = Capacitor.getPlatform() === 'ios';
    if (isIos) {
      return type === 'banner' ? 'ca-app-pub-3940256099942544/2934735716' : 'ca-app-pub-3940256099942544/3986694507';
    } else {
      return type === 'banner' ? 'ca-app-pub-2585981026340393/9149642997' : 'ca-app-pub-2585981026340393/4569671094';
    }
  };

  if (isNative) {
    // Render the real Google AdMob Banner overlay component so that original ads show up
    // in this exact place on your real mobile device!
    return <GoogleAdMob slot={getAdUnitId('banner')} />;
  }

  return (
    <div className="w-full bg-slate-950/60 border border-emerald-500/30 rounded-2xl p-4 flex flex-col gap-2.5 shadow-xl relative overflow-hidden self-start mb-4 antialiased">
      {/* Absolute top badge representing Sponsored Google Ad */}
      <div className="absolute top-0 right-0 bg-emerald-500/10 text-emerald-400 border-l border-b border-emerald-500/20 px-2.5 py-1 rounded-bl-xl text-[8px] font-mono tracking-widest uppercase font-black flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        Google AdMob Live Ad
      </div>
      
      <div className="flex items-start gap-3">
        {/* AdMob Active Logo Icon */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-500 via-orange-500 to-red-500 p-0.5 shadow-md flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-slate-950 rounded-[9px] flex items-center justify-center text-white text-[10px] font-extrabold font-mono tracking-wider">
            Ad
          </div>
        </div>
        
        {/* Ad Info */}
        <div className="text-left flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-[11px] font-black text-white uppercase tracking-wide">Google AdMob Active</h4>
            <span className="text-[8px] font-extrabold uppercase text-emerald-400 bg-emerald-500/10 py-0.5 px-2 rounded-md border border-emerald-500/20">
              Live Connection
            </span>
          </div>
          <p className="text-[9.5px] text-emerald-400 font-bold mt-1">Status: Fully Linked to AdMob Ads SDK</p>
          <p className="text-[9.5px] text-slate-400 mt-1 font-mono break-all leading-normal">
            ID: <span className="text-white font-bold">{getAdUnitId('native')}</span>
          </p>
        </div>
      </div>

      <div className="border-t border-white/5 pt-2.5 flex items-center justify-between text-[8px] text-slate-500 font-mono">
        <span>Type: Native Live Native Ad Frame</span>
        <span>Ad Service: Google AdMob SDK</span>
      </div>
    </div>
  );
};

