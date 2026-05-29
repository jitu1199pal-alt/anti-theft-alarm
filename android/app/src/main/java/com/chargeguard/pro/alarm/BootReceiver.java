package com.chargeguard.pro.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) {
            SharedPreferences prefs = context.getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
            boolean isMonitoringActive = prefs.getBoolean("isMonitoringActive", false);

            if (isMonitoringActive) {
                Intent serviceIntent = new Intent(context, AlarmService.class);
                boolean theftAlarm = prefs.getBoolean("theftAlarm", false);
                int targetPercentage = prefs.getInt("targetPercentage", 80);
                int lowBatteryPercentage = prefs.getInt("lowBatteryPercentage", 20);
                boolean vibrate = prefs.getBoolean("vibrate", true);

                serviceIntent.putExtra("theftAlarm", theftAlarm);
                serviceIntent.putExtra("targetPercentage", targetPercentage);
                serviceIntent.putExtra("lowBatteryPercentage", lowBatteryPercentage);
                serviceIntent.putExtra("vibrate", vibrate);

                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        context.startForegroundService(serviceIntent);
                    } else {
                        context.startService(serviceIntent);
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }
}
