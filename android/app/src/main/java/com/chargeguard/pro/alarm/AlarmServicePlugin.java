package com.chargeguard.pro.alarm;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.media.AudioManager;
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

    private android.media.AudioTrack nativeEarpieceTrack = null;
    private boolean isNativeEarpiecePlaying = false;

    private static AlarmServicePlugin instance = null;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void setAlarmState(boolean alarming, String reason) {
        activeAlarmTriggered = alarming;
        activeAlarmReason = reason;
        if (alarming) {
            isServiceRunning = true;
        }
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("isAlarming", alarming);
            data.put("alarmReason", reason != null ? reason : "");
            instance.notifyListeners("alarmStateChanged", data);
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

        boolean voiceAlertMode = call.getBoolean("voiceAlertMode", true);
        boolean useHindi = call.getBoolean("useHindi", false);
        String sound = call.getString("sound", "Rapid Beep");
        boolean connectVoiceSpeakEnabled = call.getBoolean("connectVoiceSpeakEnabled", true);
        boolean fullVoiceSpeakEnabled = call.getBoolean("fullVoiceSpeakEnabled", true);
        String connectVoiceSpeakText = call.getString("connectVoiceSpeakText", "Thank you for charging me!");
        String fullVoiceSpeakText = call.getString("fullVoiceSpeakText", "Sir, please unplug the charger, battery is full!");

        Intent serviceIntent = new Intent(context, AlarmService.class);
        serviceIntent.putExtra("theftAlarm", theftAlarm);
        serviceIntent.putExtra("targetPercentage", targetPercentage);
        serviceIntent.putExtra("lowBatteryPercentage", lowBatteryPercentage);
        serviceIntent.putExtra("vibrate", vibrate);

        serviceIntent.putExtra("voiceAlertMode", voiceAlertMode);
        serviceIntent.putExtra("useHindi", useHindi);
        serviceIntent.putExtra("sound", sound);
        serviceIntent.putExtra("connectVoiceSpeakEnabled", connectVoiceSpeakEnabled);
        serviceIntent.putExtra("fullVoiceSpeakEnabled", fullVoiceSpeakEnabled);
        serviceIntent.putExtra("connectVoiceSpeakText", connectVoiceSpeakText);
        serviceIntent.putExtra("fullVoiceSpeakText", fullVoiceSpeakText);

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
        boolean voiceAlertMode = call.getBoolean("voiceAlertMode", true);
        boolean useHindi = call.getBoolean("useHindi", false);
        String sound = call.getString("sound", "Rapid Beep");
        boolean connectVoiceSpeakEnabled = call.getBoolean("connectVoiceSpeakEnabled", true);
        boolean fullVoiceSpeakEnabled = call.getBoolean("fullVoiceSpeakEnabled", true);
        String connectVoiceSpeakText = call.getString("connectVoiceSpeakText", "Thank you for charging me!");
        String fullVoiceSpeakText = call.getString("fullVoiceSpeakText", "Sir, please unplug the charger, battery is full!");

        try {
            android.content.SharedPreferences prefs = context.getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
            prefs.edit()
                 .putBoolean("theftAlarm", theftAlarm)
                 .putInt("targetPercentage", targetPercentage)
                 .putInt("lowBatteryPercentage", lowBatteryPercentage)
                 .putBoolean("vibrate", vibrate)
                 .putBoolean("voiceAlertMode", voiceAlertMode)
                 .putBoolean("useHindi", useHindi)
                 .putString("sound", sound)
                 .putBoolean("connectVoiceSpeakEnabled", connectVoiceSpeakEnabled)
                 .putBoolean("fullVoiceSpeakEnabled", fullVoiceSpeakEnabled)
                 .putString("connectVoiceSpeakText", connectVoiceSpeakText)
                 .putString("fullVoiceSpeakText", fullVoiceSpeakText)
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

    @PluginMethod
    public void setAudioRoute(PluginCall call) {
        String mode = call.getString("mode", "reset");
        try {
            Context context = getContext();
            android.media.AudioManager audioManager = (android.media.AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                if ("earpiece".equals(mode)) {
                    audioManager.setMode(android.media.AudioManager.MODE_IN_COMMUNICATION);
                    android.util.Log.d("AlarmServicePlugin", "DEBUG AUDIO: Audio mode changed");
                    
                    audioManager.setSpeakerphoneOn(false);
                    android.util.Log.d("AlarmServicePlugin", "DEBUG AUDIO: Speakerphone disabled");

                    if (audioManager.isBluetoothScoOn()) {
                        audioManager.stopBluetoothSco();
                        audioManager.setBluetoothScoOn(false);
                    }

                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                        java.util.List<android.media.AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
                        for (android.media.AudioDeviceInfo device : devices) {
                            if (device.getType() == android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                                audioManager.setCommunicationDevice(device);
                                break;
                            }
                        }
                    }
                    android.util.Log.d("AlarmServicePlugin", "DEBUG AUDIO: Earpiece route active");
                } else if ("speaker".equals(mode)) {
                    audioManager.setMode(android.media.AudioManager.MODE_NORMAL);
                    android.util.Log.d("AlarmServicePlugin", "DEBUG AUDIO: Audio mode changed");

                    audioManager.setSpeakerphoneOn(true);
                    
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                        audioManager.clearCommunicationDevice();
                    }
                    android.util.Log.d("AlarmServicePlugin", "DEBUG AUDIO: Loudspeaker route active");
                } else {
                    audioManager.setMode(android.media.AudioManager.MODE_NORMAL);
                    android.util.Log.d("AlarmServicePlugin", "DEBUG AUDIO: Audio mode changed");
                    
                    audioManager.setSpeakerphoneOn(false);
                    
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                        audioManager.clearCommunicationDevice();
                    }
                    android.util.Log.d("AlarmServicePlugin", "DEBUG AUDIO: Audio route reset to normal");
                }
            }
            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to set audio route: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startEarpieceTone(PluginCall call) {
        try {
            Context context = getContext();
            android.media.AudioManager audioManager = (android.media.AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            
            if (audioManager != null) {
                // Set to IN_COMMUNICATION to enable VoIP/Earpiece routing
                audioManager.setMode(android.media.AudioManager.MODE_IN_COMMUNICATION);
                audioManager.setSpeakerphoneOn(false);
                
                if (audioManager.isBluetoothScoOn()) {
                    audioManager.stopBluetoothSco();
                    audioManager.setBluetoothScoOn(false);
                }

                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                    java.util.List<android.media.AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
                    for (android.media.AudioDeviceInfo device : devices) {
                        if (device.getType() == android.media.AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                            audioManager.setCommunicationDevice(device);
                            android.util.Log.d("AlarmServicePlugin", "Set active communication device to Built-in Earpiece");
                            break;
                        }
                    }
                }
            }

            // Clean up any previously playing tone
            stopNativeToneInternal();

            isNativeEarpiecePlaying = true;
            
            int sampleRate = 44100;
            // High frequency (approx 1000Hz or 1200Hz is standard for clean earpiece testing)
            int frequencyHz = call.getInt("frequency", 1200);
            int numSamples = sampleRate; // 1 second loop buffer
            double[] sample = new double[numSamples];
            byte[] generatedSnd = new byte[2 * numSamples];
            
            for (int i = 0; i < numSamples; ++i) {
                sample[i] = Math.sin(2 * Math.PI * i / ((double) sampleRate / frequencyHz));
            }
            
            int idx = 0;
            for (final double dVal : sample) {
                // 50% comfortable receiver volume
                final short val = (short) ((dVal * 32767.0 * 0.50));
                generatedSnd[idx++] = (byte) (val & 0x00ff);
                generatedSnd[idx++] = (byte) ((val & 0xff00) >>> 8);
            }
            
            android.media.AudioAttributes attributes = new android.media.AudioAttributes.Builder()
                    .setUsage(android.media.AudioAttributes.USAGE_VOICE_COMMUNICATION)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build();
                    
            android.media.AudioFormat format = new android.media.AudioFormat.Builder()
                    .setSampleRate(sampleRate)
                    .setEncoding(android.media.AudioFormat.ENCODING_PCM_16BIT)
                    .setChannelMask(android.media.AudioFormat.CHANNEL_OUT_MONO)
                    .build();
                    
            nativeEarpieceTrack = new android.media.AudioTrack(
                    attributes,
                    format,
                    generatedSnd.length,
                    android.media.AudioTrack.MODE_STATIC,
                    android.media.AudioManager.AUDIO_SESSION_ID_GENERATE
            );
            
            nativeEarpieceTrack.write(generatedSnd, 0, generatedSnd.length);
            nativeEarpieceTrack.setLoopPoints(0, numSamples, -1); // looping indefinitely
            nativeEarpieceTrack.play();

            android.util.Log.d("AlarmServicePlugin", "Native looping earpiece audio track started successfully!");

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to start earpiece: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopEarpieceTone(PluginCall call) {
        try {
            stopNativeToneInternal();
            
            Context context = getContext();
            android.media.AudioManager audioManager = (android.media.AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.setMode(android.media.AudioManager.MODE_NORMAL);
                audioManager.setSpeakerphoneOn(false);
                if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                    audioManager.clearCommunicationDevice();
                }
            }
            
            android.util.Log.d("AlarmServicePlugin", "Native earpiece audio track stopped successfully!");

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to stop earpiece: " + e.getMessage());
        }
    }

    private void stopNativeToneInternal() {
        isNativeEarpiecePlaying = false;
        if (nativeEarpieceTrack != null) {
            try {
                if (nativeEarpieceTrack.getPlayState() == android.media.AudioTrack.PLAYSTATE_PLAYING) {
                    nativeEarpieceTrack.stop();
                }
                nativeEarpieceTrack.release();
            } catch (Exception e) {
                // suppress release exception
            }
            nativeEarpieceTrack = null;
        }
    }
}
