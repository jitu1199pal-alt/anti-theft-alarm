import React, { useEffect } from 'react';

interface GoogleAdSenseProps {
  slot: string;
  format?: 'auto' | 'fluid';
  responsive?: 'true' | 'false';
  style?: React.CSSProperties;
}

export const GoogleAdSense: React.FC<GoogleAdSenseProps> = ({ 
  slot, 
  format = 'auto', 
  responsive = 'true',
  style = { display: 'block' }
}) => {
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.warn("AdSense script not loaded or blocked:", e);
    }
  }, []);

  return (
    <div className="my-4 w-full overflow-hidden rounded-xl bg-slate-900/50 border border-slate-800 p-2 text-center">
      <p className="text-[8px] text-slate-500 uppercase tracking-widest mb-1">Sponsored</p>
      <ins 
        className="adsbygoogle"
        style={style}
        data-ad-client="ca-pub-3940256099942544"
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive}
      />
      {/* Fallback for development/testing */}
      <div className="h-16 flex items-center justify-center border-t border-slate-800 mt-1">
        <span className="text-[10px] text-slate-600 italic">Google AdSense Module Ready</span>
      </div>
    </div>
  );
};
