package com.chargeguard.pro.alarm;

import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AlarmService")
public class AlarmServicePlugin extends Plugin {

    private static boolean isServiceRunning = false;
    private static boolean activeAlarmTriggered = false;
    private static String activeAlarmReason = null;

    public static void setAlarmState(boolean alarming, String reason) {
        activeAlarmTriggered = alarming;
        activeAlarmReason = reason;
        if (alarming) {
            isServiceRunning = true;
        }
    }

    @PluginMethod
    public void startService(PluginCall call) {
        Context context = getContext();
        boolean theftAlarm = call.getBoolean("theftAlarm", false);
        int targetPercentage = call.getInt("targetPercentage", 80);
        int lowBatteryPercentage = call.getInt("lowBatteryPercentage", 20);

        Intent serviceIntent = new Intent(context, AlarmService.class);
        serviceIntent.putExtra("theftAlarm", theftAlarm);
        serviceIntent.putExtra("targetPercentage", targetPercentage);
        serviceIntent.putExtra("lowBatteryPercentage", lowBatteryPercentage);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }
            isServiceRunning = true;
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to start background alarm service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Context context = getContext();
        android.content.SharedPreferences prefs = context.getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
        prefs.edit().putBoolean("isMonitoringActive", false).apply();
        
        Intent serviceIntent = new Intent(context, AlarmService.class);
        try {
            context.stopService(serviceIntent);
            isServiceRunning = false;
            activeAlarmTriggered = false;
            activeAlarmReason = null;
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to stop background service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getServiceState(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", isServiceRunning);
        result.put("isAlarming", activeAlarmTriggered);
        result.put("alarmReason", activeAlarmReason != null ? activeAlarmReason : "");
        call.resolve(result);
    }
}
