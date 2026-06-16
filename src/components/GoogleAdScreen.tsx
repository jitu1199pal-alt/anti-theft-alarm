import React, { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { removeGlobalBanner } from './GoogleAdMob';
import { adMobManager } from '../services/AdMobManager';

interface GoogleAdScreenProps {
  duration?: number;
  onClose: () => void;
  t: any;
}

export function GoogleAdScreen({ duration = 15, onClose, t }: GoogleAdScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [showHtmlAd, setShowHtmlAd] = useState(true);
  const onCloseRef = useRef(onClose);
  const hasShownAdRef = useRef(false);

  // Keep onClose stable
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Update countdown duration
  useEffect(() => {
    setSecondsLeft(duration);
  }, [duration]);

  // HTML Ad fallback countdown
  useEffect(() => {
    if (!showHtmlAd) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onCloseRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showHtmlAd]);

  // Show native interstitial (only once per screen mount)
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative || hasShownAdRef.current) return;

    hasShownAdRef.current = true;

    const showAd = async () => {
      try {
        // Wait for screen to settle
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Temporarily remove banner
        try {
          await removeGlobalBanner();
          console.log('[GoogleAdScreen] Removed banner before interstitial');
        } catch (e) {}

        // Attempt to show cached interstitial
        const shown = await adMobManager.showInterstitial(
          () => {
            // Ad dismissed - close screen
            onCloseRef.current();
          },
          (err) => {
            // Ad failed - fallback to HTML
            console.warn('[GoogleAdScreen] Ad failed, showing HTML fallback:', err);
            setShowHtmlAd(true);
          }
        );

        if (!shown) {
          // Ad was skipped (locked/inactive) - show HTML as fallback
          setShowHtmlAd(true);
        } else {
          // Native ad is showing - hide HTML
          setShowHtmlAd(false);
        }
      } catch (err) {
        console.warn('[GoogleAdScreen] Error showing ad:', err);
        setShowHtmlAd(true);
      }
    };

    showAd();
  }, []);

  return (
    <div className="h-screen w-full bg-black flex flex-col items-center justify-center p-4 text-center">
      {showHtmlAd ? (
        // HTML Ad Fallback
        <div className="flex flex-col items-center gap-6">
          <div className="w-full max-w-xs p-6 bg-gradient-to-br from-slate-900 to-black border border-slate-700 rounded-2xl">
            <h3 className="text-lg font-bold text-white mb-2">Advertisement</h3>
            <p className="text-slate-400 text-sm mb-4">
              {t.dismissing_in || 'Dismissing in'}
            </p>
            <div className="text-4xl font-black text-accent">{Math.max(0, secondsLeft)}</div>
          </div>
          <div className="text-xs text-slate-500">
            Google AdMob Interstitial Loading...
          </div>
        </div>
      ) : (
        // Native Ad Showing (minimal UI)
        <div className="text-xs text-slate-500">
          Native Ad Displayed
        </div>
      )}
    </div>
  );
}
