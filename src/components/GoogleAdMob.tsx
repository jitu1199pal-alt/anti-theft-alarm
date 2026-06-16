import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

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

export const GoogleAdMob: React.FC<GoogleAdMobProps> = ({ 
  slot, 
  format = 'auto', 
  responsive = 'true',
  style = { display: 'block' }
}) => {
  const isNative = Capacitor.isNativePlatform();
  const [admobLoaded, setAdmobLoaded] = useState(false);
  const [admobActive, setAdmobActive] = useState(false);

  useEffect(() => {
    let active = true;

    if (!isNative) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {}
      return;
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

          const isRealAdId = slot && slot.startsWith('ca-app-pub-');
          const finalAdId = isRealAdId 
            ? slot 
            : (Capacitor.getPlatform() === 'ios'
                ? 'ca-app-pub-3940256099942544/2934735716'
                : 'ca-app-pub-3940256099942544/6300978111');

          const isTestingAd = !isRealAdId || slot.includes('3940256099942544');

          try {
            // Remove previous banner first to guarantee clean redraw
            try {
              await AdMob.removeBanner();
            } catch (e) {}

            await AdMob.showBanner({
              adId: finalAdId,
              adSize: BannerAdSize?.BANNER || 'BANNER',
              position: BannerAdPosition?.BOTTOM_CENTER || 'BOTTOM_CENTER',
              margin: 0,
              isTesting: isTestingAd,
            });
            isBannerActive = true;
            lastAdId = slot;
            console.log(`Capacitor Native AdMob Banner active (ID: ${finalAdId}, testing: ${isTestingAd}).`);
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
      if (isNative) {
        admobMutex.run(async () => {
          try {
            if (AdMob) {
              await AdMob.removeBanner();
              console.log("Capacitor Native AdMob Banner removed on unmount.");
            }
          } catch (err) {
            console.warn("Error removing native banner on unmount:", err);
          }
          isBannerActive = false;
          lastAdId = '';
        });
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
