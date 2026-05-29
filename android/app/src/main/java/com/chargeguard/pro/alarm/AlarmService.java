package com.chargeguard.pro.alarm;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;

public class AlarmService extends Service {
    private static final String CHANNEL_ID = "ChargeGuardAlarmServiceChannel";
    private static final int NOTIFICATION_ID = 4512;

    private boolean theftAlarmEnabled = false;
    private int targetPercentage = 80;
    private int lowBatteryPercentage = 20;
    
    private boolean isAlarmActive = false;
    private String alarmReason = null;
    
    private boolean isFirstCheck = true;
    private boolean wasChargingOnStart = false;
    private boolean hadChargerUnplugged = false;

    private MediaPlayer mediaPlayer = null;
    private Vibrator vibrator = null;
    private PowerManager.WakeLock wakeLock = null;

    private final BroadcastReceiver batteryReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            handleBatteryChanged(intent);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ChargeGuard::AlarmServiceWakeLock");
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        AlarmServicePlugin.setServiceRunning(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("STOP_SERVICE".equals(action)) {
                SharedPreferences prefs = getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
                prefs.edit().putBoolean("isMonitoringActive", false).apply();
                stopSelf();
                return START_NOT_STICKY;
            }

            theftAlarmEnabled = intent.getBooleanExtra("theftAlarm", false);
            targetPercentage = intent.getIntExtra("targetPercentage", 80);
            lowBatteryPercentage = intent.getIntExtra("lowBatteryPercentage", 20);
        }

        isFirstCheck = true;
        isAlarmActive = false;
        alarmReason = null;
        hadChargerUnplugged = false;

        // Save active monitoring state in SharedPreferences for reboot recovery
        try {
            SharedPreferences prefs = getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
            prefs.edit()
                 .putBoolean("isMonitoringActive", true)
                 .putBoolean("theftAlarm", theftAlarmEnabled)
                 .putInt("targetPercentage", targetPercentage)
                 .putInt("lowBatteryPercentage", lowBatteryPercentage)
                 .apply();
        } catch (Exception e) {
            e.printStackTrace();
        }

        // Acquire wake lock to keep standard CPU active while lock screen is on
        if (wakeLock != null && !wakeLock.isHeld()) {
            try {
                wakeLock.acquire();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        // Register battery status receiver
        registerReceiver(batteryReceiver, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));

        // Start Foreground Service with notification
        showOngoingNotification("ChargeGuard Pro Active Monitoring", "Protecting your device in background.");

        return START_STICKY;
    }

    private void handleBatteryChanged(Intent intent) {
        int status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
        boolean isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                             status == BatteryManager.BATTERY_STATUS_FULL;

        int level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
        int scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
        int percent = Math.round((level / (float) scale) * 100);

        if (isFirstCheck) {
            wasChargingOnStart = isCharging;
            isFirstCheck = false;
        }

        if (isAlarmActive) {
            return;
        }

        // 1. Theft Alarm (Charger disconnected)
        if (theftAlarmEnabled && wasChargingOnStart && !isCharging && !hadChargerUnplugged) {
            hadChargerUnplugged = true;
            triggerAlarm("theft", "Charger Disconnected! Anti-theft triggered.");
            return;
        }

        // 2. Full Battery Alarm (Goal Reached)
        if (isCharging && percent >= targetPercentage) {
            triggerAlarm("full", "Battery Charged to " + percent + "%!");
            return;
        }

        // 3. Low Battery Alarm (Critical Level)
        if (!isCharging && percent <= lowBatteryPercentage) {
            triggerAlarm("low", "Battery Critical: " + percent + "%!");
            return;
        }

        if (isCharging) {
            wasChargingOnStart = true;
        }
    }

    private void triggerAlarm(String reason, String title) {
        isAlarmActive = true;
        alarmReason = reason;

        // Propagate state update immediately to the Capacitor plugin
        AlarmServicePlugin.setAlarmState(true, reason);

        startAlarmSound();
        startVibrations();

        showAlarmNotification(title, "Unlock/swipe to stop the alarm.");
        launchMainActivity();
    }

    private void launchMainActivity() {
        try {
            Intent mainIntent = new Intent(this, MainActivity.class);
            mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | 
                                 Intent.FLAG_ACTIVITY_CLEAR_TOP | 
                                 Intent.FLAG_ACTIVITY_SINGLE_TOP);
            mainIntent.putExtra("alarmActive", true);
            mainIntent.putExtra("alarmReason", alarmReason);
            startActivity(mainIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void startAlarmSound() {
        if (mediaPlayer != null) {
            return;
        }
        try {
            mediaPlayer = new MediaPlayer();
            
            // Bypass silent mode by using Alarm stream
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                mediaPlayer.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
            } else {
                mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            }
            
            // Set data source to the raw resource
            try (android.content.res.AssetFileDescriptor afd = getResources().openRawResourceFd(R.raw.alarm)) {
                if (afd != null) {
                    mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                } else {
                    return; // Fail safe
                }
            } catch (Exception e) {
                e.printStackTrace();
                return;
            }

            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
            
            // Also ensure volume is up for alarm stream
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, 0);
            }
        } catch (Exception e) {
            e.printStackTrace();
            mediaPlayer = null;
        }
    }

    private void startVibrations() {
        if (vibrator == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0, 500, 200, 500}, 0));
            } else {
                vibrator.vibrate(new long[]{0, 500, 200, 500}, 0);
            }
        } catch (Exception e) { e.printStackTrace(); }
    }

    private void stopAlarmSound() {
        if (mediaPlayer != null) {
            try {
                mediaPlayer.stop();
                mediaPlayer.release();
            } catch (Exception e) { e.printStackTrace(); }
            mediaPlayer = null;
        }
        if (vibrator != null) {
            try { vibrator.cancel(); } catch (Exception e) { e.printStackTrace(); }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "ChargeGuard Background Monitor",
                    NotificationManager.IMPORTANCE_HIGH
            );
            serviceChannel.setDescription("Shows battery protection states in background.");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    private void showOngoingNotification(String title, String desc) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(desc)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build();

        startForeground(NOTIFICATION_ID, notification);
    }

    private void showAlarmNotification(String title, String desc) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        notificationIntent.putExtra("alarmActive", true);
        notificationIntent.putExtra("alarmReason", alarmReason);
        
        PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                0,
                notificationIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(desc)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setFullScreenIntent(pendingIntent, true)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setAutoCancel(false)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .build();

        startForeground(NOTIFICATION_ID, notification);
    }

    @Override
    public void onDestroy() {
        try {
            unregisterReceiver(batteryReceiver);
        } catch (Exception e) {}
        stopAlarmSound();
        if (wakeLock != null && wakeLock.isHeld()) {
            try {
                wakeLock.release();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        AlarmServicePlugin.setServiceRunning(false);
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        super.onTaskRemoved(rootIntent);
        
        // This keeps the service active. When the user swipes away our app from recent tasks,
        // we reschedule the service with AlarmManager to restart after 1 second!
        try {
            Intent restartServiceIntent = new Intent(getApplicationContext(), this.getClass());
            restartServiceIntent.setPackage(getPackageName());
            restartServiceIntent.putExtra("theftAlarm", theftAlarmEnabled);
            restartServiceIntent.putExtra("targetPercentage", targetPercentage);
            restartServiceIntent.putExtra("lowBatteryPercentage", lowBatteryPercentage);

            PendingIntent restartServicePendingIntent = PendingIntent.getService(
                getApplicationContext(), 
                1001, 
                restartServiceIntent, 
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
            );
            AlarmManager alarmManager = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 1000, restartServicePendingIntent);
                } else {
                    alarmManager.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 1000, restartServicePendingIntent);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
