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

    public static boolean isServiceRunning = false;
    public static boolean activeAlarmTriggered = false;
    public static String activeAlarmReason = null;

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
        Context context = getContext();
        android.content.SharedPreferences prefs = context.getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
        boolean monitoringActive = prefs.getBoolean("isMonitoringActive", false);

        JSObject result = new JSObject();
        result.put("running", isServiceRunning || monitoringActive);
        result.put("isAlarming", activeAlarmTriggered);
        result.put("alarmReason", activeAlarmReason != null ? activeAlarmReason : "");
        result.put("theftAlarm", prefs.getBoolean("theftAlarm", true));
        result.put("targetPercentage", prefs.getInt("targetPercentage", 95));
        result.put("lowBatteryPercentage", prefs.getInt("lowBatteryPercentage", 20));
        result.put("vibrate", prefs.getBoolean("vibrate", true));
        call.resolve(result);
    }

    @PluginMethod
    public void minimizeApp(PluginCall call) {
        try {
            if (getActivity() != null) {
                getActivity().moveTaskToBack(true);
            }
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to minimize application: " + e.getMessage());
        }
    }

    @PluginMethod
    public void bringAppToForeground(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(context, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                               Intent.FLAG_ACTIVITY_CLEAR_TOP | 
                               Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.putExtra("alarmActive", true);
            context.startActivity(intent);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to bring app to foreground: " + e.getMessage());
        }
    }

    @PluginMethod
    public void savePersistedValue(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null) {
            call.reject("Missing key parameter");
            return;
        }
        try {
            Context context = getContext();
            android.content.SharedPreferences prefs = context.getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
            prefs.edit().putString("persisted_" + key, value).apply();
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to persist value natively: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPersistedValue(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("Missing key parameter");
            return;
        }
        try {
            Context context = getContext();
            android.content.SharedPreferences prefs = context.getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
            String value = prefs.getString("persisted_" + key, null);
            JSObject result = new JSObject();
            result.put("value", value);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to retrieve native persisted value: " + e.getMessage());
        }
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
    public void openOtherPermissionsSettings(PluginCall call) {
        Context context = getContext();
        boolean opened = false;
        
        String[][] intents = {
            {"com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity"},
            {"com.miui.securitycenter", "com.miui.permcenter.permissions.AppPermissionsEditorActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.PermissionManagerActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.PermissionAppListActivity"},
            {"com.oppo.safe", "com.oppo.safe.permission.PermissionAppListActivity"},
            {"com.iqoo.secure", "com.iqoo.secure.ui.permission.PermissionManagerActivity"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.SoftPermissionDetailActivity"}
        };

        for (String[] intentInfo : intents) {
            try {
                Intent intent = new Intent();
                intent.setClassName(intentInfo[0], intentInfo[1]);
                intent.putExtra("extra_pkgname", context.getPackageName());
                intent.putExtra("package_name", context.getPackageName());
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

        // Check active app notification permissions natively
        boolean notificationsEnabled = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            android.app.NotificationManager manager = (android.app.NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                notificationsEnabled = manager.areNotificationsEnabled();
            }
        }
        result.put("notificationsEnabled", notificationsEnabled);

        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                intent.setAction("android.settings.APP_NOTIFICATION_SETTINGS");
                intent.putExtra("app_package", context.getPackageName());
                intent.putExtra("app_uid", context.getApplicationInfo().uid);
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            // Backup fallback to Application Details view if specialized notifications intent fails on custom OS skins
            try {
                Context context = getContext();
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + context.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
            } catch (Exception ex) {
                call.reject("Failed to open Notification Settings: " + ex.getMessage());
            }
        }
    }

    @PluginMethod
    public void getBatteryCapacity(PluginCall call) {
        Context context = getContext();
        
        // Use SharedPreferences to cache the detected capacity forever to guarantee it NEVER fluctuates
        android.content.SharedPreferences prefs = context.getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
        int cachedCapacity = prefs.getInt("detected_battery_capacity", 0);
        if (cachedCapacity > 0) {
            JSObject result = new JSObject();
            result.put("capacity", cachedCapacity);
            call.resolve(result);
            return;
        }

        double batteryCapacity = 0.0;

        // 1. Try reading standard Android PowerProfile designed battery configuration via reflection
        try {
            Object powerProfile = Class.forName("com.android.internal.os.PowerProfile")
                    .getConstructor(Context.class)
                    .newInstance(context);
            double val = (Double) Class.forName("com.android.internal.os.PowerProfile")
                    .getMethod("getAveragePower", String.class)
                    .invoke(powerProfile, "battery.capacity");
            if (val >= 1000 && val <= 15000) {
                batteryCapacity = val;
            }
        } catch (Exception e) {
            // Ignore power profile errors
        }

        // 2. If reflection was not successful or returned empty/weird values, try reading battery charge_full_design files from Linux kernel/sysfs
        if (batteryCapacity <= 0) {
            String[] paths = {
                "/sys/class/power_supply/battery/charge_full_design",
                "/sys/class/power_supply/bms/charge_full_design",
                "/sys/class/power_supply/battery/charge_full"
            };
            for (String path : paths) {
                try {
                    java.io.File file = new java.io.File(path);
                    if (file.exists() && file.canRead()) {
                        java.io.BufferedReader br = new java.io.BufferedReader(new java.io.FileReader(file));
                        String line = br.readLine();
                        br.close();
                        if (line != null) {
                            double val = Double.parseDouble(line.trim());
                            if (val > 100000) { // standard µAh
                                val = val / 1000.0;
                            }
                            if (val >= 1000 && val <= 15000) {
                                batteryCapacity = val;
                                break;
                            }
                        }
                    }
                } catch (Exception eLog) {
                    // Ignore path errors and try next
                }
            }
        }

        // 3. Try reading battery uevent specs from power_supply
        if (batteryCapacity <= 0) {
            try {
                java.io.File file = new java.io.File("/sys/class/power_supply/battery/uevent");
                if (file.exists() && file.canRead()) {
                    java.io.BufferedReader br = new java.io.BufferedReader(new java.io.FileReader(file));
                    String line;
                    while ((line = br.readLine()) != null) {
                        if (line.startsWith("POWER_SUPPLY_CHARGE_FULL_DESIGN=") || line.startsWith("POWER_SUPPLY_CHARGE_FULL=")) {
                            String[] parts = line.split("=");
                            if (parts.length == 2) {
                                double val = Double.parseDouble(parts[1].trim());
                                if (val > 100000) { // standard µAh
                                    val = val / 1000.0;
                                }
                                if (val >= 1000 && val <= 15000) {
                                    batteryCapacity = val;
                                    break;
                                }
                            }
                        }
                    }
                    br.close();
                }
            } catch (Exception eLog) {
                // Ignore
            }
        }

        // 4. Absolute robust fallback (e.g. standard mock/hardware profile average)
        if (batteryCapacity <= 0) {
            batteryCapacity = 5000.0;
        }

        // Now round it to a solid clean number (like 5000 mAh, 4500 mAh, 6000 mAh etc.)
        int capacityInt = (int) Math.round(batteryCapacity);

        // Normalize typical values if very close (e.g., if 4800 to 5200 mAh, represent it perfectly as 5000 mAh)
        if (capacityInt >= 4750 && capacityInt <= 5250) {
            capacityInt = 5000;
        } else if (capacityInt >= 4250 && capacityInt < 4750) {
            capacityInt = 4500;
        } else if (capacityInt >= 5750 && capacityInt <= 6250) {
            capacityInt = 6000;
        } else if (capacityInt >= 3750 && capacityInt < 4250) {
            capacityInt = 4000;
        } else if (capacityInt >= 3250 && capacityInt < 3750) {
            capacityInt = 3300;
        } else if (capacityInt >= 2750 && capacityInt < 3250) {
            capacityInt = 3000;
        } else if (capacityInt >= 6251 && capacityInt < 7500) {
            capacityInt = 7000;
        } else if (capacityInt >= 7500 && capacityInt < 9500) {
            capacityInt = 8000;
        }

        // Cache the value in SharedPreferences so we NEVER recalculate or fluctuate on subsequent calls
        prefs.edit().putInt("detected_battery_capacity", capacityInt).apply();

        JSObject result = new JSObject();
        result.put("capacity", capacityInt);
        call.resolve(result);
    }
}
