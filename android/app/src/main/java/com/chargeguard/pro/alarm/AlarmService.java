package com.chargeguard.pro.alarm;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.IBinder;
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
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("STOP_SERVICE".equals(action)) {
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

        // Register batter status receiver
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
            return;
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
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (soundUri == null) {
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            }
            mediaPlayer.setDataSource(this, soundUri);
            
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            mediaPlayer.setAudioAttributes(audioAttributes);
            mediaPlayer.setLooping(true);
            
            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                int maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                audioManager.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, 0);
            }

            mediaPlayer.prepare();
            mediaPlayer.start();
        } catch (Exception e) {
            e.printStackTrace();
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
                .setSmallIcon(android.R.drawable.stat_sys_phone_call)
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
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
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
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
