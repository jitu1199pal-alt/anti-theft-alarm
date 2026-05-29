package com.chargeguard.pro.alarm;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
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

    public static void setServiceRunning(boolean running) {
        isServiceRunning = running;
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Context context = getContext();
            String packageName = context.getPackageName();
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + packageName));
                    getActivity().startActivity(intent);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
        JSObject result = new JSObject();
        result.put("success", true);
        call.resolve(result);
    }

    @PluginMethod
    public void startService(PluginCall call) {
        Context context = getContext();
        boolean theftAlarm = call.getBoolean("theftAlarm", false);
        int targetPercentage = call.getInt("targetPercentage", 80);
        int lowBatteryPercentage = call.getInt("lowBatteryPercentage", 20);
        boolean vibrate = call.getBoolean("vibrate", true);

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

    @PluginMethod
    public void saveConfig(PluginCall call) {
        Context context = getContext();
        boolean theftAlarm = call.getBoolean("theftAlarm", true);
        int targetPercentage = call.getInt("targetPercentage", 80);
        int lowBatteryPercentage = call.getInt("lowBatteryPercentage", 20);
        boolean vibrate = call.getBoolean("vibrate", true);

        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
            prefs.edit()
                 .putBoolean("theftAlarm", theftAlarm)
                 .putInt("targetPercentage", targetPercentage)
                 .putInt("lowBatteryPercentage", lowBatteryPercentage)
                 .putBoolean("vibrate", vibrate)
                 .apply();

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to save configuration: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openAppInfo(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + context.getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to open App Info: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        try {
            Context context = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to open Overlay Settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openAutoStartSettings(PluginCall call) {
        Context context = getContext();
        boolean opened = false;
        String[][] intents = {
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.letv.android.letvsafe", "com.letv.android.letvsafe.AutobootManageActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
            {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
            {"com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"},
            {"com.htc.pitroad", "com.htc.pitroad.landingpage.ActivityLandingPage"},
            {"com.asus.mobilemanager", "com.asus.mobilemanager.entry.FunctionActivity"},
            {"com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"}
        };

        for (String[] intentInfo : intents) {
            try {
                Intent intent = new Intent();
                intent.setClassName(intentInfo[0], intentInfo[1]);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                opened = true;
                break;
            } catch (Exception e) {
                // Try next
            }
        }

        if (!opened) {
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                opened = true;
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        JSObject result = new JSObject();
        result.put("success", opened);
        call.resolve(result);
    }

    @PluginMethod
    public void getPermissionsState(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        
        boolean batteryIgnored = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                batteryIgnored = pm.isIgnoringBatteryOptimizations(context.getPackageName());
            }
        }
        result.put("batteryIgnored", batteryIgnored);

        boolean overlayAllowed = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            overlayAllowed = Settings.canDrawOverlays(context);
        }
        result.put("overlayAllowed", overlayAllowed);

        call.resolve(result);
    }
}
