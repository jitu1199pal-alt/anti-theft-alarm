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
          setBattery(prev => {
            const isCharging = batt.charging;
            const targetTemp = isCharging ? 38.8 : 30.2;
            const diff = targetTemp - prev.temperature;
            const step = diff * 0.08 + (Math.random() * 0.4 - 0.2);
            let nextTemp = prev.temperature + step;
            if (nextTemp < 24) nextTemp = 24;
            if (nextTemp > 44) nextTemp = 44;
            return {
              level: batt.level,
              charging: batt.charging,
              chargingTime: batt.chargingTime,
              dischargingTime: batt.dischargingTime,
              temperature: +nextTemp.toFixed(1)
            };
          });
        };

        batt.addEventListener('levelchange', update);
        batt.addEventListener('chargingchange', update);
        batt.addEventListener('chargingtimechange', update);
        batt.addEventListener('dischargingtimechange', update);
        
        update();
      });
    }

    // Dynamic temperature fluctuation monitor
    const interval = setInterval(() => {
      setBattery(prev => {
        const isCharging = prev.charging;
        const targetTemp = isCharging ? 38.8 : 30.2;
        const diff = targetTemp - prev.temperature;
        const step = diff * 0.06 + (Math.random() * 0.3 - 0.15);
        let nextTemp = prev.temperature + step;
        if (nextTemp < 24) nextTemp = 24;
        if (nextTemp > 44) nextTemp = 44;
        return {
          ...prev,
          temperature: +nextTemp.toFixed(1)
        };
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return battery;
};
