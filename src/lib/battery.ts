import { useState, useEffect } from 'react';
import { BatteryState } from '../types';

export const useBattery = () => {
  const [battery, setBattery] = useState<BatteryState>({
    level: 0.85,
    charging: true,
    chargingTime: 1200,
    dischargingTime: Infinity,
    temperature: 32.5,
  });

  useEffect(() => {
    // Attempt real API
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((batt: any) => {
        const update = () => {
          setBattery(prev => ({
            ...prev,
            level: batt.level,
            charging: batt.charging,
            chargingTime: batt.chargingTime,
            dischargingTime: batt.dischargingTime,
          }));
        };

        batt.addEventListener('levelchange', update);
        batt.addEventListener('chargingchange', update);
        batt.addEventListener('chargingtimechange', update);
        batt.addEventListener('dischargingtimechange', update);
        
        update();
      });
    }

    // temperature simulation toggle
    const interval = setInterval(() => {
      setBattery(prev => ({
        ...prev,
        temperature: +(prev.temperature + (Math.random() * 0.4 - 0.2)).toFixed(1)
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return battery;
};
