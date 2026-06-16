package com.chargeguard.pro.alarm;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

public class PowerConnectionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_POWER_CONNECTED.equals(action)) {
            SharedPreferences prefs = context.getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
            
            // Set active monitoring state to true of the background guard with default 98% target percentage
            prefs.edit()
                 .putBoolean("isMonitoringActive", true)
                 .putInt("targetPercentage", 98)
                 .putBoolean("theftAlarm", true)
                 .apply();
            
            boolean theftAlarm = true;
            int targetPercentage = 98;
            int lowBatteryPercentage = prefs.getInt("lowBatteryPercentage", 20);
            boolean vibrate = prefs.getBoolean("vibrate", true);

            Intent serviceIntent = new Intent(context, AlarmService.class);
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
                AlarmServicePlugin.setServiceRunning(true);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
