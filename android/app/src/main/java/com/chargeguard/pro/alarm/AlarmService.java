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
    private int targetPercentage = 98;
    private int lowBatteryPercentage = 20;
    private boolean vibrateEnabled = true;

    // Added Voice Alert parameters for offline lock screen operations helper
    private boolean voiceAlertMode = true;
    private String sound = "Rapid Beep";
    private boolean connectVoiceSpeakEnabled = true;
    private boolean fullVoiceSpeakEnabled = true;
    private String connectVoiceSpeakText = "Thank you for charging me!";
    private String fullVoiceSpeakText = "Sir, please unplug the charger, battery is full!";
    
    private boolean isAlarmActive = false;
    private String alarmReason = null;
    
    private boolean isFirstCheck = true;
    private boolean wasChargingOnStart = false;
    private boolean hadChargerUnplugged = false;
    private boolean lowBatteryAlerted = false;
    private boolean targetReachedAlerted = false;

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
        SharedPreferences prefs = getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
        theftAlarmEnabled = prefs.getBoolean("theftAlarm", true);
        targetPercentage = prefs.getInt("targetPercentage", 98);
        lowBatteryPercentage = prefs.getInt("lowBatteryPercentage", 20);
        vibrateEnabled = prefs.getBoolean("vibrate", true);
        voiceAlertMode = prefs.getBoolean("voiceAlertMode", true);
        sound = prefs.getString("sound", "Rapid Beep");
        connectVoiceSpeakEnabled = prefs.getBoolean("connectVoiceSpeakEnabled", true);
        fullVoiceSpeakEnabled = prefs.getBoolean("fullVoiceSpeakEnabled", true);
        connectVoiceSpeakText = prefs.getString("connectVoiceSpeakText", "Thank you for charging me!");
        fullVoiceSpeakText = prefs.getString("fullVoiceSpeakText", "Sir, please unplug the charger, battery is full!");

        if (intent != null) {
            String action = intent.getAction();
            if ("STOP_SERVICE".equals(action)) {
                prefs.edit().putBoolean("isMonitoringActive", false).apply();
                stopSelf();
                return START_NOT_STICKY;
            }

            if ("BOOST_PHONE".equals(action)) {
                try {
                    prefs.edit().putString("persisted_pending_boost", "true").apply();
                } catch (Exception e) {
                    e.printStackTrace();
                }

                new android.os.Handler(android.os.Looper.getMainLooper()).post(new Runnable() {
                    @Override
                    public void run() {
                        android.widget.Toast.makeText(getApplicationContext(), "Phone Booster Activated! Memory cleared.", android.widget.Toast.LENGTH_LONG).show();
                    }
                });

                try {
                    Intent mainIntent = new Intent(this, MainActivity.class);
                    mainIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    mainIntent.putExtra("triggerBoost", true);
                    startActivity(mainIntent);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }

            if (intent.hasExtra("theftAlarm")) {
                theftAlarmEnabled = intent.getBooleanExtra("theftAlarm", theftAlarmEnabled);
            }
            if (intent.hasExtra("targetPercentage")) {
                targetPercentage = intent.getIntExtra("targetPercentage", targetPercentage);
            }
            if (intent.hasExtra("lowBatteryPercentage")) {
                lowBatteryPercentage = intent.getIntExtra("lowBatteryPercentage", lowBatteryPercentage);
            }
            if (intent.hasExtra("vibrate")) {
                vibrateEnabled = intent.getBooleanExtra("vibrate", vibrateEnabled);
            }
            if (intent.hasExtra("voiceAlertMode")) {
                voiceAlertMode = intent.getBooleanExtra("voiceAlertMode", voiceAlertMode);
            }
            if (intent.hasExtra("sound")) {
                sound = intent.getStringExtra("sound");
            }
            if (intent.hasExtra("connectVoiceSpeakEnabled")) {
                connectVoiceSpeakEnabled = intent.getBooleanExtra("connectVoiceSpeakEnabled", connectVoiceSpeakEnabled);
            }
            if (intent.hasExtra("fullVoiceSpeakEnabled")) {
                fullVoiceSpeakEnabled = intent.getBooleanExtra("fullVoiceSpeakEnabled", fullVoiceSpeakEnabled);
            }
            if (intent.hasExtra("connectVoiceSpeakText")) {
                connectVoiceSpeakText = intent.getStringExtra("connectVoiceSpeakText");
            }
            if (intent.hasExtra("fullVoiceSpeakText")) {
                fullVoiceSpeakText = intent.getStringExtra("fullVoiceSpeakText");
            }
        }

        isFirstCheck = true;
        isAlarmActive = false;
        alarmReason = null;
        hadChargerUnplugged = false;
        stopAlarmSound();

        // Save active monitoring state in SharedPreferences for reboot recovery
        try {
            prefs.edit()
                 .putBoolean("isMonitoringActive", true)
                 .putBoolean("theftAlarm", theftAlarmEnabled)
                 .putInt("targetPercentage", targetPercentage)
                 .putInt("lowBatteryPercentage", lowBatteryPercentage)
                 .putBoolean("vibrate", vibrateEnabled)
                 .putBoolean("voiceAlertMode", voiceAlertMode)
                 .putString("sound", sound)
                 .putBoolean("connectVoiceSpeakEnabled", connectVoiceSpeakEnabled)
                 .putBoolean("fullVoiceSpeakEnabled", fullVoiceSpeakEnabled)
                 .putString("connectVoiceSpeakText", connectVoiceSpeakText)
                 .putString("fullVoiceSpeakText", fullVoiceSpeakText)
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
        IntentFilter filter = new IntentFilter();
        filter.addAction(Intent.ACTION_BATTERY_CHANGED);
        filter.addAction(Intent.ACTION_POWER_CONNECTED);
        filter.addAction(Intent.ACTION_POWER_DISCONNECTED);
        registerReceiver(batteryReceiver, filter);

        // Start Foreground Service with notification
        showOngoingNotification("ChargeGuard Pro Security", "Junk full | Cores: Status Active");

        // Also post the designated Sticky Notification Panel with text "Recurrent reminder active"
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                Intent stickyIntent = new Intent(this, MainActivity.class);
                PendingIntent stickyPendingIntent = PendingIntent.getActivity(
                        this,
                        333,
                        stickyIntent,
                        PendingIntent.FLAG_IMMUTABLE
                );
                Notification stickyNotification = new NotificationCompat.Builder(this, CHANNEL_ID)
                        .setContentTitle("Sticky Notification Panel")
                        .setContentText("Recurrent reminder active")
                        .setSmallIcon(R.mipmap.ic_launcher)
                        .setContentIntent(stickyPendingIntent)
                        .setOngoing(true)
                        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                        .build();
                nm.notify(NOTIFICATION_ID + 100, stickyNotification);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return START_STICKY;
    }

    private void handleBatteryChanged(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        boolean isCharging = false;
        int percent = -1;

        if (Intent.ACTION_BATTERY_CHANGED.equals(action)) {
            int status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                                 status == BatteryManager.BATTERY_STATUS_FULL;

            int level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
            percent = Math.round((level / (float) scale) * 100);
        } else {
            // Instant trigger on ACTION_POWER_CONNECTED or ACTION_POWER_DISCONNECTED
            isCharging = Intent.ACTION_POWER_CONNECTED.equals(action);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
                if (bm != null) {
                    percent = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
                }
            }
            if (percent < 0) {
                // query standard sticky intent if capacity API failed
                try {
                    Intent sticky = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
                    if (sticky != null) {
                        int level = sticky.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                        int scale = sticky.getIntExtra(BatteryManager.EXTRA_SCALE, -1);
                        percent = Math.round((level / (float) scale) * 100);
                    }
                } catch (Exception e) {}
            }
        }

        if (percent < 0) {
            percent = 50; // safe fallback
        }

        if (isFirstCheck) {
            wasChargingOnStart = isCharging || Intent.ACTION_POWER_CONNECTED.equals(action);
            isFirstCheck = false;
        }

        // Handle alerts reset states based on charger status
        if (isCharging || Intent.ACTION_POWER_CONNECTED.equals(action)) {
            if (Intent.ACTION_POWER_CONNECTED.equals(action)) {
                if (connectVoiceSpeakEnabled) {
                    playShortGreeting(getPresetAssetPath(connectVoiceSpeakText, false));
                }
            }
            wasChargingOnStart = true;
            lowBatteryAlerted = false; // Reset low battery alerted status when charging
        } else if (Intent.ACTION_POWER_DISCONNECTED.equals(action)) {
            targetReachedAlerted = false; // Reset target reached status when charger unplugged
        }

        // Dynamic thresholds based soft reset states
        if (percent > lowBatteryPercentage) {
            lowBatteryAlerted = false; // Reset when battery charges back above low limit
        }
        if (percent < targetPercentage) {
            targetReachedAlerted = false; // Reset when battery drops back below target limit
        }

        if (isAlarmActive) {
            return;
        }

        // 1. Theft Alarm (Charger disconnected)
        boolean isUnpluggedDisconnection = Intent.ACTION_POWER_DISCONNECTED.equals(action) || (!isCharging && wasChargingOnStart);
        if (theftAlarmEnabled && wasChargingOnStart && isUnpluggedDisconnection && !hadChargerUnplugged) {
            hadChargerUnplugged = true;
            triggerAlarm("theft", "Charger Disconnected! Anti-theft triggered.");
            return;
        }

        // 2. Full Battery Alarm (Goal Reached)
        if (isCharging && percent >= targetPercentage) {
            if (!targetReachedAlerted) {
                targetReachedAlerted = true;
                triggerAlarm("full", "Battery Charged to " + percent + "%!");
            }
            return;
        }

        // 3. Low Battery Alarm (Critical Level)
        if (!isCharging && percent <= lowBatteryPercentage) {
            if (!lowBatteryAlerted) {
                lowBatteryAlerted = true;
                triggerAlarm("low", "Battery Critical: " + percent + "%!");
            }
            return;
        }
    }

    private void triggerAlarm(final String reason, String title) {
        isAlarmActive = true;
        alarmReason = reason;

        // Propagate state update immediately to the Capacitor plugin
        AlarmServicePlugin.setAlarmState(true, reason);

        // Turn on screen instantly even under locked device
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock screenWakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "ChargeGuard::AlarmScreenWakeLock"
                );
                screenWakeLock.acquire(10000); // 10 seconds is plenty to show lock screen UI
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        startAlarmSound(reason);
        startVibrations();

        showAlarmNotification(title, "Unlock/swipe to stop the alarm.");
        launchMainActivity();

        if ("theft".equals(reason) || "low".equals(reason)) {
            int playtimeMs = voiceAlertMode ? 5000 : 3000;
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
                @Override
                public void run() {
                    if (isAlarmActive && (reason.equals(alarmReason))) {
                        stopAlarmSound();
                        isAlarmActive = false;
                        alarmReason = null;
                        AlarmServicePlugin.setAlarmState(false, null);
                        
                        try {
                            SharedPreferences prefs = getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
                            prefs.edit().putBoolean("isMonitoringActive", false).apply();
                            stopSelf();
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                    }
                }
            }, playtimeMs); // alarm playtime set to 5000ms for full voice alert playback or 3000ms for standard tune
        }
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

    private String getPresetAssetPath(String text, boolean isFull) {
        if (text == null) return isFull ? "public/audio/professional_full.mp3" : "public/audio/professional_connect.mp3";
        String tLower = text.toLowerCase();
        if (tLower.contains("thank") || tLower.contains("professional")) {
            return isFull ? "public/audio/professional_full.mp3" : "public/audio/professional_connect.mp3";
        }
        if (tLower.contains("bhai") || tLower.contains("khana") || tLower.contains("comedy") || tLower.contains("pet khali")) {
            return isFull ? "public/audio/hindi_comedy_full.mp3" : "public/audio/hindi_comedy_connect.mp3";
        }
        if (tLower.contains("quantum") || tLower.contains("tachyon") || tLower.contains("cyber")) {
            return isFull ? "public/audio/cyber_bot_full.mp3" : "public/audio/cyber_bot_connect.mp3";
        }
        if (tLower.contains("onii-chan") || tLower.contains("anime") || tLower.contains("kawaii") || tLower.contains("super full")) {
            return isFull ? "public/audio/anime_kawaii_full.mp3" : "public/audio/anime_kawaii_connect.mp3";
        }
        return isFull ? "public/audio/professional_full.mp3" : "public/audio/professional_connect.mp3";
    }

    private void playShortGreeting(String assetPath) {
        try {
            final MediaPlayer mp = new MediaPlayer();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                mp.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                );
            } else {
                mp.setAudioStreamType(AudioManager.STREAM_MUSIC);
            }
            try (android.content.res.AssetFileDescriptor afd = getAssets().openFd(assetPath)) {
                mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            }
            mp.prepare();
            mp.start();
            mp.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer mediaPlayer2) {
                    try {
                        mp.release();
                    } catch (Exception e) {}
                }
            });
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void startAlarmSound(String reason) {
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
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                );
            } else {
                mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            }
            
            boolean playedPath = false;
            if (voiceAlertMode) {
                String assetPath = null;
                if ("theft".equals(reason) || "low".equals(reason)) {
                    // "Please connect charger" voice warning
                    assetPath = "public/audio/battery_exhausted.mp3";
                } else if ("full".equals(reason)) {
                    if (fullVoiceSpeakEnabled) {
                        assetPath = getPresetAssetPath(fullVoiceSpeakText, true);
                    }
                }
                
                if (assetPath != null) {
                    try (android.content.res.AssetFileDescriptor afd = getAssets().openFd(assetPath)) {
                        mediaPlayer.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
                        playedPath = true;
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
            
            if (!playedPath) {
                // Set data source to the raw resource (standard buzzer beep)
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
            SharedPreferences prefs = getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
            vibrateEnabled = prefs.getBoolean("vibrate", true);
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (!vibrateEnabled) {
            return;
        }

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

        // Boost Phone action
        Intent boostIntent = new Intent(this, AlarmService.class);
        boostIntent.setAction("BOOST_PHONE");
        PendingIntent boostPendingIntent = PendingIntent.getService(
                this,
                111,
                boostIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // Dismiss action
        Intent dismissIntent = new Intent(this, AlarmService.class);
        dismissIntent.setAction("STOP_SERVICE");
        PendingIntent dismissPendingIntent = PendingIntent.getService(
                this,
                222,
                dismissIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(desc)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(pendingIntent)
                .setOngoing(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .addAction(0, "Boost Phone", boostPendingIntent)
                .addAction(0, "Dismiss", dismissPendingIntent)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    @Override
    public void onDestroy() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(NOTIFICATION_ID + 100);
            }
        } catch (Exception e) {}

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
        
        // Auto restart foreground monitoring service if it was explicitly active and terminated under OS memory pressure
        try {
            SharedPreferences prefs = getSharedPreferences("ChargeGuardPrefs", Context.MODE_PRIVATE);
            boolean isMonitoringActive = prefs.getBoolean("isMonitoringActive", false);
            if (isMonitoringActive) {
                Intent restartServiceIntent = new Intent(getApplicationContext(), this.getClass());
                restartServiceIntent.setPackage(getPackageName());
                restartServiceIntent.putExtra("theftAlarm", theftAlarmEnabled);
                restartServiceIntent.putExtra("targetPercentage", targetPercentage);
                restartServiceIntent.putExtra("lowBatteryPercentage", lowBatteryPercentage);
                restartServiceIntent.putExtra("vibrate", vibrateEnabled);
                restartServiceIntent.putExtra("voiceAlertMode", voiceAlertMode);
                restartServiceIntent.putExtra("sound", sound);
                restartServiceIntent.putExtra("connectVoiceSpeakEnabled", connectVoiceSpeakEnabled);
                restartServiceIntent.putExtra("fullVoiceSpeakEnabled", fullVoiceSpeakEnabled);
                restartServiceIntent.putExtra("connectVoiceSpeakText", connectVoiceSpeakText);
                restartServiceIntent.putExtra("fullVoiceSpeakText", fullVoiceSpeakText);
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    try {
                        startForegroundService(restartServiceIntent);
                        System.out.println("AlarmService: Resurrected foreground monitor immediately.");
                    } catch (Exception re) {
                        PendingIntent restartServicePendingIntent = PendingIntent.getForegroundService(
                            getApplicationContext(), 
                            1001, 
                            restartServiceIntent, 
                            PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
                        );
                        AlarmManager alarmManager = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
                        if (alarmManager != null) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 1000, restartServicePendingIntent);
                            System.out.println("AlarmService: Fallback scheduled service resurrection in 1s.");
                        }
                    }
                } else {
                    startService(restartServiceIntent);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
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
            restartServiceIntent.putExtra("vibrate", vibrateEnabled);
            restartServiceIntent.putExtra("voiceAlertMode", voiceAlertMode);
            restartServiceIntent.putExtra("sound", sound);
            restartServiceIntent.putExtra("connectVoiceSpeakEnabled", connectVoiceSpeakEnabled);
            restartServiceIntent.putExtra("fullVoiceSpeakEnabled", fullVoiceSpeakEnabled);
            restartServiceIntent.putExtra("connectVoiceSpeakText", connectVoiceSpeakText);
            restartServiceIntent.putExtra("fullVoiceSpeakText", fullVoiceSpeakText);

            PendingIntent restartServicePendingIntent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                restartServicePendingIntent = PendingIntent.getForegroundService(
                    getApplicationContext(), 
                    1001, 
                    restartServiceIntent, 
                    PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
                );
            } else {
                restartServicePendingIntent = PendingIntent.getService(
                    getApplicationContext(), 
                    1001, 
                    restartServiceIntent, 
                    PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
                );
            }
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
